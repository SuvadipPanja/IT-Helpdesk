const db = require('../config/database');
const ticketService = require('./ticketService');
const contextAwareness = require('./contextAwareness.service');
const logger = require('../utils/logger');

class TicketCreationWizard {
  constructor() {
    this.steps = [
      'greeting',
      'department_selection',
      'priority_selection',
      'category_selection',
      'description_input',
      'confirmation',
      'creation'
    ];
  }

  /**
   * Start ticket creation wizard
   * @param {number} userId - User ID
   * @param {string} sessionId - Session ID
   * @param {object} initialData - Initial data from intent parsing (optional)
   * @returns {Promise<Object>} Wizard state and first prompt
   */
  async startWizard(userId, sessionId, initialData = {}) {
    try {
      // Initialize wizard state
      const wizardState = {
        step: 0,
        user_id: userId,
        start_time: new Date(),
        completed: false,
        draft_ticket: {
          subject: null,
          description: null,
          priority_name: initialData.priority || 'Medium',
          category_name: initialData.category || 'General',
          department_id: null,
          requester_id: userId
        }
      };

      await contextAwareness.updateContext(sessionId, 'wizard_state', wizardState);
      await contextAwareness.updateContext(sessionId, 'current_step', this.steps[0]);

      const firstPrompt = this.getStepPrompt(0, wizardState.draft_ticket);
      return {
        success: true,
        wizard_active: true,
        step: 0,
        step_name: this.steps[0],
        prompt: firstPrompt
      };
    } catch (error) {
      logger.error(`Error starting wizard:`, error);
      throw error;
    }
  }

  /**
   * Get prompt for specific step
   * @param {number} step - Step number
   * @param {object} draftTicket - Current draft ticket
   * @returns {string} Prompt text
   */
  getStepPrompt(step, draftTicket) {
    const prompts = {
      0: `👋 Welcome to the Ticket Creation Wizard!\n\nI'll help you create a support ticket in just a few steps.\n\nLet's start: **What department are you in?**\n\nExamples: IT Operations, HR, Finance, Sales`,

      1: `Got it! Now, **how urgent is this issue?**\n\nChoose one:\n• 🔴 Critical (immediate attention)\n• 🟠 High (within hours)\n• 🟡 Medium (within a day)\n• 🟢 Low (whenever possible)`,

      2: `Sure! What **category** does this issue fall under?\n\nCommon categories:\n• 📧 Email\n• 🔐 Account Access\n• 🌐 Network\n• 💻 Equipment\n• 📱 Mobile\n• 🛠️ General Support`,

      3: `Perfect! Now please **describe the issue** in detail.\n\nInclude:\n• What's the problem?\n• What have you tried?\n• How is this affecting you?\n\n(Please provide at least a few sentences)`,

      4: `Let me confirm the details of your ticket:\n\n**Summary:**\n• Department: ${draftTicket.department_id || '(pending)'}\n• Priority: ${draftTicket.priority_name}\n• Category: ${draftTicket.category_name}\n• Subject: ${draftTicket.subject}\n\nIs everything correct? Reply with **Yes** or **No** to make changes.`,

      5: `🎉 Creating your ticket now...`
    };

    return prompts[step] || prompts[5];
  }

  /**
   * Process user input for current step
   * @param {number} userId - User ID
   * @param {string} sessionId - Session ID
   * @param {string} userInput - User's input
   * @returns {Promise<Object>} Updated state and next prompt
   */
  async processStep(userId, sessionId, userInput) {
    try {
      const wizardState = await contextAwareness.getContext(sessionId, 'wizard_state');
      
      if (!wizardState) {
        throw new Error('Wizard not initialized');
      }

      const currentStep = wizardState.step;
      let validation = { valid: true, message: '' };

      // Process input based on current step
      switch (currentStep) {
        case 0: // Department selection
          validation = this.validateDepartment(userInput);
          if (validation.valid) {
            const dept = await this.getDepartmentByName(userInput);
            wizardState.draft_ticket.department_id = dept?.department_id || 1;
          }
          break;

        case 2: // Priority selection
          validation = this.validatePriority(userInput);
          if (validation.valid) {
            wizardState.draft_ticket.priority_name = userInput.trim();
          }
          break;

        case 3: // Category selection
          validation = this.validateCategory(userInput);
          if (validation.valid) {
            wizardState.draft_ticket.category_name = userInput.trim();
          }
          break;

        case 4: // Description input
          validation = this.validateDescription(userInput);
          if (validation.valid) {
            // Extract subject (first 100 chars)
            const lines = userInput.split('\n');
            wizardState.draft_ticket.subject = lines[0].substring(0, 100);
            wizardState.draft_ticket.description = userInput;
          }
          break;

        case 5: // Confirmation
          if (/^yes|^y|confirm|ok|proceed/i.test(userInput)) {
            validation.valid = true;
            wizardState.step = 6; // Move to creation
          } else if (/^no|^n|change|edit/i.test(userInput)) {
            validation.valid = true;
            // Ask what to change
            return {
              success: true,
              step: currentStep,
              step_name: this.steps[currentStep],
              prompt: 'What would you like to change? (department, priority, category, description)',
              action: 'clarify'
            };
          } else {
            validation.valid = false;
            validation.message = 'Please reply with "Yes" or "No"';
          }
          break;
      }

      if (!validation.valid) {
        return {
          success: false,
          step: currentStep,
          step_name: this.steps[currentStep],
          prompt: `❌ ${validation.message}\n\n${this.getStepPrompt(currentStep, wizardState.draft_ticket)}`,
          error: validation.message
        };
      }

      // Move to next step
      if (currentStep < this.steps.length - 1) {
        wizardState.step++;
      }

      await contextAwareness.updateContext(sessionId, 'wizard_state', wizardState);

      // If we've reached creation step, create the ticket
      if (wizardState.step === 6) {
        return await this.createTicket(userId, sessionId, wizardState);
      }

      const nextStep = wizardState.step;
      const nextPrompt = this.getStepPrompt(nextStep, wizardState.draft_ticket);

      return {
        success: true,
        step: nextStep,
        step_name: this.steps[nextStep],
        prompt: nextPrompt,
        action: 'continue'
      };
    } catch (error) {
      logger.error(`Error processing wizard step:`, error);
      return {
        success: false,
        error: error.message,
        prompt: '❌ An error occurred. Please try again or contact support.'
      };
    }
  }

  /**
   * Create the ticket with wizard data
   * @param {number} userId - User ID
   * @param {string} sessionId - Session ID
   * @param {object} wizardState - Wizard state
   * @returns {Promise<Object>} Creation result
   */
  async createTicket(userId, sessionId, wizardState) {
    try {
      const draft = wizardState.draft_ticket;

      // Get priority ID
      const priorityQuery = `SELECT TOP 1 priority_id FROM ticket_priorities WHERE UPPER(priority_name) = UPPER(@priorityName)`;
      const priorityResult = await db.executeQuery(priorityQuery, { priorityName: draft.priority_name });
      const priorityId = priorityResult.recordset?.[0]?.priority_id || 2;

      // Get category ID
      const categoryQuery = `SELECT TOP 1 category_id FROM ticket_categories WHERE UPPER(category_name) = UPPER(@categoryName)`;
      const categoryResult = await db.executeQuery(categoryQuery, { categoryName: draft.category_name });
      const categoryId = categoryResult.recordset?.[0]?.category_id || 1;

      // Create ticket
      const ticket = await ticketService.createTicketFromBot({
        subject: draft.subject,
        description: draft.description,
        priority_id: priorityId,
        category_id: categoryId,
        department_id: draft.department_id || 1,
        requester_id: userId
      }, userId);

      // Update wizard state
      wizardState.completed = true;
      wizardState.ticket_id = ticket.ticket_id;
      wizardState.end_time = new Date();
      await contextAwareness.updateContext(sessionId, 'wizard_state', wizardState);

      logger.info(`Wizard completed for user ${userId}, ticket ${ticket.ticket_number} created`);

      return {
        success: true,
        wizard_completed: true,
        step: 6,
        step_name: 'completed',
        ticket_number: ticket.ticket_number,
        ticket_id: ticket.ticket_id,
        prompt: `✅ **Success!**\n\nYour ticket **${ticket.ticket_number}** has been created!\n\n**Next steps:**\n• Your request has been logged\n• The appropriate team has been notified\n• You'll receive updates via email\n\n**Need anything else?**`,
        followUp: ['View ticket details', 'Check ticket status', 'Create another ticket', 'Return to main menu']
      };
    } catch (error) {
      logger.error(`Error creating ticket in wizard:`, error);
      return {
        success: false,
        error: error.message,
        prompt: `❌ Failed to create ticket: ${error.message}\n\nPlease try again or contact support.`
      };
    }
  }

  /**
   * Validation methods
   */
  validateDepartment(input) {
    const input_lower = input.toLowerCase();
    const validDepts = ['it', 'operations', 'hr', 'finance', 'sales', 'marketing', 'support'];
    
    if (validDepts.some(d => input_lower.includes(d))) {
      return { valid: true };
    }
    
    return { valid: false, message: 'Please enter a valid department name' };
  }

  validatePriority(input) {
    const priorities = ['critical', 'high', 'medium', 'low'];
    const input_lower = input.toLowerCase();
    
    if (priorities.some(p => input_lower.includes(p))) {
      return { valid: true };
    }
    
    return { valid: false, message: 'Please choose: Critical, High, Medium, or Low' };
  }

  validateCategory(input) {
    const categories = ['email', 'account', 'network', 'equipment', 'mobile', 'general'];
    const input_lower = input.toLowerCase();
    
    if (categories.some(c => input_lower.includes(c))) {
      return { valid: true };
    }
    
    return { valid: false, message: 'Please select a valid category' };
  }

  validateDescription(input) {
    if (!input || input.trim().length < 10) {
      return { valid: false, message: 'Please provide at least 10 characters describing the issue' };
    }
    
    return { valid: true };
  }

  /**
   * Helper method to get department by name
   */
  async getDepartmentByName(deptName) {
    try {
      const query = `SELECT TOP 1 department_id, department_name FROM departments WHERE department_name LIKE @departmentName`;
      const result = await db.executeQuery(query, { departmentName: `%${deptName}%` });
      return result.recordset?.[0] || null;
    } catch (error) {
      logger.error(`Error getting department:`, error);
      return null;
    }
  }

  /**
   * Cancel wizard
   */
  async cancelWizard(sessionId) {
    try {
      await contextAwareness.updateContext(sessionId, 'wizard_state', {
        completed: false,
        cancelled: true,
        cancelled_at: new Date()
      });

      logger.info(`Wizard cancelled for session ${sessionId}`);
      return { success: true, message: 'Wizard cancelled. You can start a new ticket anytime.' };
    } catch (error) {
      logger.error(`Error cancelling wizard:`, error);
      throw error;
    }
  }
}

module.exports = new TicketCreationWizard();

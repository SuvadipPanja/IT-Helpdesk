const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const ticketService = require('../services/ticketService');
const botIntentHandler = require('../services/botIntentHandler.service');
const contextAwareness = require('../services/contextAwareness.service');
const ticketCreationWizard = require('../services/ticketCreationWizard.service');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * POST /api/v1/bot/tickets/create
 * Create a ticket using the bot interface
 */
router.post('/create', authenticate, async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    const userId = req.user.user_id;

    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    // Initialize session if needed
    let sid = sessionId;
    if (!sid) {
      sid = uuidv4();
      await contextAwareness.initializeConversation(userId, sid);
    }

    // Check if wizard is active
    let wizardState = await contextAwareness.getContext(sid, 'wizard_state');
    
    if (wizardState && !wizardState.completed && !wizardState.cancelled) {
      // Continue wizard flow
      const wizardResult = await ticketCreationWizard.processStep(userId, sid, message);
      await contextAwareness.persistConversationHistory(userId, sid, [
        { role: 'user', message, timestamp: new Date() },
        { role: 'bot', message: wizardResult.prompt, timestamp: new Date() }
      ]);
      
      return res.json({
        success: true,
        sessionId: sid,
        wizard_active: true,
        ...wizardResult
      });
    }

    // Parse intent from message
    const intent = botIntentHandler.parseCreateTicketIntent(message, req.user);

    if (intent.confidence < 0.6) {
      // Low confidence - ask for clarification
      return res.json({
        success: true,
        sessionId: sid,
        type: 'clarification_needed',
        message: 'I want to create a ticket for you. Could you provide more details about the issue?',
        extracted: intent.extracted
      });
    }

    // Start ticket creation wizard with pre-filled data
    const wizardStart = await ticketCreationWizard.startWizard(userId, sid, {
      priority: intent.extracted.priority,
      category: intent.extracted.category
    });

    await contextAwareness.persistConversationHistory(userId, sid, [
      { role: 'user', message, timestamp: new Date() },
      { role: 'bot', message: wizardStart.prompt, timestamp: new Date() }
    ]);

    return res.json({
      success: true,
      sessionId: sid,
      wizard_active: true,
      ...wizardStart
    });

  } catch (error) {
    logger.error('Error in ticket creation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v1/bot/tickets/search
 * Search for tickets
 */
router.post('/search', authenticate, async (req, res) => {
  try {
    const { message, query, sessionId, filters } = req.body;
    const userId = req.user.user_id;

    let sid = sessionId;
    if (!sid) {
      sid = uuidv4();
      await contextAwareness.initializeConversation(userId, sid);
    }

    let searchQuery = query;
    let intent = null;

    // If message provided, parse intent first
    if (message && !query) {
      intent = botIntentHandler.parseTicketSearchIntent(message, req.user);
      searchQuery = intent.extracted.keywords.join(' ');
    }

    const results = await ticketService.searchTickets(searchQuery, userId);

    // Track the search in conversation flow
    await contextAwareness.trackConversationFlow(sid, 'SEARCH_TICKETS', {
      query: searchQuery,
      result_count: results.length
    });

    await contextAwareness.persistConversationHistory(userId, sid, [
      { role: 'user', message: message || searchQuery, timestamp: new Date() },
      { 
        role: 'bot', 
        message: `Found ${results.length} ticket(s) matching "${searchQuery}"`,
        timestamp: new Date()
      }
    ]);

    return res.json({
      success: true,
      sessionId: sid,
      type: 'SEARCH_RESULTS',
      query: searchQuery,
      count: results.length,
      results
    });

  } catch (error) {
    logger.error('Error searching tickets:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/bot/tickets/:id
 * Get ticket details
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.user_id;
    const sessionId = req.query.sessionId;

    const ticket = await ticketService.getTicketById(id, userId);

    if (!ticket) {
      return res.status(404).json({ success: false, error: 'Ticket not found' });
    }

    if (sessionId) {
      await contextAwareness.trackConversationFlow(sessionId, 'VIEW_TICKET', {
        ticket_id: id,
        ticket_number: ticket.ticket_number
      });
    }

    return res.json({
      success: true,
      type: 'TICKET_DETAILS',
      ticket
    });

  } catch (error) {
    logger.error('Error fetching ticket:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/v1/bot/tickets/:id/status
 * Update ticket status
 */
router.patch('/:id/status', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { newStatus, message, sessionId } = req.body;
    const userId = req.user.user_id;

    let sid = sessionId;
    if (!sid && message) {
      sid = uuidv4();
      await contextAwareness.initializeConversation(userId, sid);
    }

    let status = newStatus;
    if (!status && message) {
      const intent = botIntentHandler.parseTicketUpdateIntent(message, req.user);
      status = intent.extracted.new_status;
    }

    if (!status) {
      return res.status(400).json({ success: false, error: 'Status is required' });
    }

    const result = await ticketService.updateTicketStatus(id, status, userId);

    if (sid) {
      await contextAwareness.trackConversationFlow(sid, 'UPDATE_TICKET', {
        ticket_id: id,
        new_status: status
      });
    }

    return res.json({
      success: true,
      type: 'TICKET_UPDATED',
      ticket_id: id,
      new_status: status,
      updated_at: new Date()
    });

  } catch (error) {
    logger.error('Error updating ticket status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/v1/bot/tickets/:id/assign
 * Assign ticket to user
 */
router.patch('/:id/assign', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { assigneeId, sessionId } = req.body;
    const userId = req.user.user_id;

    if (!assigneeId) {
      return res.status(400).json({ success: false, error: 'Assignee ID is required' });
    }

    const result = await ticketService.assignTicket(id, assigneeId, userId);

    if (sessionId) {
      await contextAwareness.trackConversationFlow(sessionId, 'ASSIGN_TICKET', {
        ticket_id: id,
        assigned_to: assigneeId
      });
    }

    return res.json({
      success: true,
      type: 'TICKET_ASSIGNED',
      ticket_id: id,
      assigned_to: assigneeId,
      assigned_at: new Date()
    });

  } catch (error) {
    logger.error('Error assigning ticket:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/bot/tickets/:id/activity
 * Get ticket activity and comments
 */
router.get('/:id/activity', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.user_id;

    const activity = await ticketService.getTicketActivity(id);

    return res.json({
      success: true,
      type: 'TICKET_ACTIVITY',
      ticket_id: id,
      activity: activity || []
    });

  } catch (error) {
    logger.error('Error fetching ticket activity:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/bot/tickets
 * Get user's tickets with filters
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { status, priority, department, sessionId, message } = req.query;
    const filters = {};

    if (status) filters.status = status;
    if (priority) filters.priority = priority;
    if (department) filters.department = department;

    let sid = sessionId;
    if (!sid && message) {
      sid = uuidv4();
      await contextAwareness.initializeConversation(userId, sid);
    }

    const tickets = await ticketService.getMyTickets(userId, filters);

    if (sid) {
      await contextAwareness.trackConversationFlow(sid, 'VIEW_TICKETS', {
        filter_count: Object.keys(filters).length,
        result_count: tickets.length
      });
    }

    return res.json({
      success: true,
      type: 'TICKETS_LIST',
      count: tickets.length,
      tickets
    });

  } catch (error) {
    logger.error('Error fetching user tickets:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v1/bot/tickets/:id/comment
 * Add comment to ticket
 */
router.post('/:id/comment', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { comment, isInternal, sessionId } = req.body;
    const userId = req.user.user_id;

    if (!comment) {
      return res.status(400).json({ success: false, error: 'Comment is required' });
    }

    const result = await ticketService.addTicketComment(id, comment, userId, isInternal || false);

    if (sessionId) {
      await contextAwareness.trackConversationFlow(sessionId, 'ADD_COMMENT', {
        ticket_id: id,
        comment_type: isInternal ? 'internal' : 'public'
      });
    }

    return res.json({
      success: true,
      type: 'COMMENT_ADDED',
      ticket_id: id,
      comment: result,
      created_at: new Date()
    });

  } catch (error) {
    logger.error('Error adding comment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

// ============================================
// Email Template Renderer Service
// Handles dynamic variable replacement in email templates
// Created by: Suvadip Panja
// ============================================

const { executeQuery } = require('../config/database');
const logger = require('../utils/logger');
const settingsService = require('./settings.service');

/**
 * Render email template by replacing variables with actual data
 * @param {string} templateHtml - HTML template with variables
 * @param {object} data - Data object containing all necessary information
 * @returns {Promise<string>} - Rendered HTML with replaced variables
 */
const renderTemplate = async (templateHtml, data) => {
  try {
    logger.info('🎨 Rendering email template with variables');
    
    // Step 1: Get system settings for system variables
    const systemSettings = await settingsService.getByCategory('general');
    const systemName = systemSettings.system_name || 'IT Helpdesk';
    const systemTitle = systemSettings.system_title || 'Support System';
    const companyName = systemSettings.company_name || 'Company';
    
    // Step 2: Initialize rendered HTML
    let renderedHtml = templateHtml;
    
    // Step 3: Replace System Variables
    renderedHtml = renderedHtml
      .replace(/\{\{system_name\}\}/g, systemName)
      .replace(/\{\{system_title\}\}/g, systemTitle)
      .replace(/\{\{company_name\}\}/g, companyName);
    
    // Step 4: Replace User Variables (if user data provided)
    if (data.user) {
      const userName = `${data.user.first_name || ''} ${data.user.last_name || ''}`.trim() || 'User';
      const userEmail = data.user.email || 'N/A';
      const userPhone = data.user.phone_number || 'N/A';
      const userDepartment = data.user.department_name || 'N/A';
      
      renderedHtml = renderedHtml
        .replace(/\{\{user_name\}\}/g, userName)
        .replace(/\{\{user_email\}\}/g, userEmail)
        .replace(/\{\{user_phone\}\}/g, userPhone)
        .replace(/\{\{user_department\}\}/g, userDepartment);
    }
    
    // Step 5: Replace Ticket Variables (if ticket data provided)
    if (data.ticket) {
      const ticketNumber = data.ticket.ticket_number || 'N/A';
      const ticketId = data.ticket.ticket_id || 'N/A';
      const subject = data.ticket.subject || 'N/A';
      const description = data.ticket.description || 'N/A';
      const category = data.ticket.category_name || 'N/A';
      const priority = data.ticket.priority_name || 'N/A';
      const status = data.ticket.status_name || 'N/A';
      const createdAt = data.ticket.created_at ? new Date(data.ticket.created_at).toLocaleString() : 'N/A';
      const dueDate = data.ticket.due_date ? new Date(data.ticket.due_date).toLocaleString() : 'N/A';
      
      renderedHtml = renderedHtml
        .replace(/\{\{ticket_number\}\}/g, ticketNumber)
        .replace(/\{\{ticket_id\}\}/g, ticketId)
        .replace(/\{\{subject\}\}/g, subject)
        .replace(/\{\{description\}\}/g, description)
        .replace(/\{\{category\}\}/g, category)
        .replace(/\{\{priority\}\}/g, priority)
        .replace(/\{\{status\}\}/g, status)
        .replace(/\{\{created_at\}\}/g, createdAt)
        .replace(/\{\{due_date\}\}/g, dueDate);
      
      // Generate ticket URL
      const ticketUrl = `http://localhost:5173/tickets/${ticketId}`;
      renderedHtml = renderedHtml.replace(/\{\{ticket_url\}\}/g, ticketUrl);
    }
    
    // Step 6: Replace Status Change Variables
    if (data.oldStatus || data.old_status) {
      const oldStatus = data.oldStatus || data.old_status || 'N/A';
      renderedHtml = renderedHtml
        .replace(/\{\{old_status\}\}/g, oldStatus)
        .replace(/\{\{previous_status\}\}/g, oldStatus);
    }
    
    if (data.newStatus || data.new_status) {
      const newStatus = data.newStatus || data.new_status || 'N/A';
      renderedHtml = renderedHtml.replace(/\{\{new_status\}\}/g, newStatus);
    }
    
    // Step 7: Replace Assignment Variables
    if (data.assignedTo || data.assigned_to) {
      const assignedToName = data.assignedTo?.name || data.assigned_to?.name || 'N/A';
      const assignedToEmail = data.assignedTo?.email || data.assigned_to?.email || 'N/A';
      
      renderedHtml = renderedHtml
        .replace(/\{\{assigned_to_name\}\}/g, assignedToName)
        .replace(/\{\{assigned_to_email\}\}/g, assignedToEmail);
    }
    
    if (data.assignedBy || data.assigned_by) {
      const assignedByName = data.assignedBy?.name || data.assigned_by?.name || 'N/A';
      
      renderedHtml = renderedHtml.replace(/\{\{assigned_by_name\}\}/g, assignedByName);
    }
    
    // Step 8: Replace Requester Variables
    if (data.requester) {
      const requesterName = `${data.requester.first_name || ''} ${data.requester.last_name || ''}`.trim() || 'User';
      const requesterEmail = data.requester.email || 'N/A';
      const requesterPhone = data.requester.phone_number || 'N/A';
      
      renderedHtml = renderedHtml
        .replace(/\{\{requester_name\}\}/g, requesterName)
        .replace(/\{\{requester_email\}\}/g, requesterEmail)
        .replace(/\{\{requester_phone\}\}/g, requesterPhone);
    }
    
    // Step 9: Replace Comment Variables
    if (data.comment) {
      const commentText = data.comment.comment_text || 'N/A';
      const commentByName = data.comment.user_name || 'N/A';
      const commentDate = data.comment.created_at ? new Date(data.comment.created_at).toLocaleString() : 'N/A';
      
      renderedHtml = renderedHtml
        .replace(/\{\{comment_text\}\}/g, commentText)
        .replace(/\{\{comment_by_name\}\}/g, commentByName)
        .replace(/\{\{comment_date\}\}/g, commentDate);
    }
    
    // Step 10: Replace Updated By Variables (for status changes, assignments, etc.)
    if (data.updatedBy || data.updated_by) {
      const updatedByName = data.updatedBy?.name || data.updated_by?.name || 
                            `${data.updatedBy?.first_name || data.updated_by?.first_name || ''} ${data.updatedBy?.last_name || data.updated_by?.last_name || ''}`.trim() || 'Administrator';
      const updatedByEmail = data.updatedBy?.email || data.updated_by?.email || 'N/A';
      
      renderedHtml = renderedHtml
        .replace(/\{\{updated_by_name\}\}/g, updatedByName)
        .replace(/\{\{updated_by_email\}\}/g, updatedByEmail);
    }
    
    // Step 11: Replace Dashboard URL
    const dashboardUrl = 'http://localhost:5173/dashboard';
    renderedHtml = renderedHtml.replace(/\{\{dashboard_url\}\}/g, dashboardUrl);
    
    // Step 12: Replace any remaining unreplaced variables with empty string to clean up
    // This prevents showing {{variable_name}} if variable wasn't provided
    renderedHtml = renderedHtml.replace(/\{\{[a-zA-Z0-9_]+\}\}/g, '');
    
    logger.success('✅ Email template rendered successfully');
    
    return renderedHtml;
    
  } catch (error) {
    logger.error('❌ Error rendering email template:', error);
    // Return original template if rendering fails
    return templateHtml;
  }
};

/**
 * Get full ticket data for email rendering
 * @param {number} ticketId - Ticket ID
 * @returns {Promise<object>} - Complete ticket data with related information
 */
const getTicketDataForEmail = async (ticketId) => {
  try {
    logger.info(`📧 Fetching ticket data for email rendering: ${ticketId}`);
    
    const query = `
      SELECT 
        t.ticket_id,
        t.ticket_number,
        t.subject,
        t.description,
        t.created_at,
        t.due_date,
        
        tc.category_name,
        tp.priority_name,
        ts.status_name,
        
        u_req.user_id as requester_id,
        u_req.username as requester_username,
        u_req.email as requester_email,
        u_req.phone_number as requester_phone,
        u_req.first_name as requester_first_name,
        u_req.last_name as requester_last_name,
        
        u_eng.user_id as assigned_to_id,
        u_eng.username as assigned_to_username,
        u_eng.email as assigned_to_email,
        u_eng.first_name as assigned_to_first_name,
        u_eng.last_name as assigned_to_last_name,
        
        d.department_name as requester_department
        
      FROM tickets t
      LEFT JOIN ticket_categories tc ON t.category_id = tc.category_id
      LEFT JOIN ticket_priorities tp ON t.priority_id = tp.priority_id
      LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
      LEFT JOIN users u_req ON t.requester_id = u_req.user_id
      LEFT JOIN users u_eng ON t.assigned_to = u_eng.user_id
      LEFT JOIN departments d ON u_req.department_id = d.department_id
      
      WHERE t.ticket_id = @ticketId
    `;
    
    const result = await executeQuery(query, { ticketId });
    
    if (result.recordset.length === 0) {
      logger.warn(`⚠️ Ticket not found: ${ticketId}`);
      return null;
    }
    
    const ticket = result.recordset[0];
    
    // Structure the data properly for template rendering
    return {
      ticket: {
        ticket_id: ticket.ticket_id,
        ticket_number: ticket.ticket_number,
        subject: ticket.subject,
        description: ticket.description,
        category_name: ticket.category_name,
        priority_name: ticket.priority_name,
        status_name: ticket.status_name,
        created_at: ticket.created_at,
        due_date: ticket.due_date
      },
      requester: {
        user_id: ticket.requester_id,
        username: ticket.requester_username,
        email: ticket.requester_email,
        phone_number: ticket.requester_phone,
        first_name: ticket.requester_first_name,
        last_name: ticket.requester_last_name,
        department_name: ticket.requester_department
      },
      assignedTo: ticket.assigned_to_id ? {
        user_id: ticket.assigned_to_id,
        username: ticket.assigned_to_username,
        email: ticket.assigned_to_email,
        first_name: ticket.assigned_to_first_name,
        last_name: ticket.assigned_to_last_name,
        name: `${ticket.assigned_to_first_name} ${ticket.assigned_to_last_name}`
      } : null
    };
    
  } catch (error) {
    logger.error('❌ Error fetching ticket data for email:', error);
    throw error;
  }
};

/**
 * Get user data for email rendering
 * @param {number} userId - User ID
 * @returns {Promise<object>} - User data
 */
const getUserDataForEmail = async (userId) => {
  try {
    logger.info(`👤 Fetching user data for email rendering: ${userId}`);
    
    const query = `
      SELECT 
        u.user_id,
        u.username,
        u.email,
        u.phone_number,
        u.first_name,
        u.last_name,
        d.department_name
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.department_id
      WHERE u.user_id = @userId
    `;
    
    const result = await executeQuery(query, { userId });
    
    if (result.recordset.length === 0) {
      logger.warn(`⚠️ User not found: ${userId}`);
      return null;
    }
    
    return result.recordset[0];
    
  } catch (error) {
    logger.error('❌ Error fetching user data for email:', error);
    throw error;
  }
};

// ============================================
// Export Functions
// ============================================
module.exports = {
  renderTemplate,
  getTicketDataForEmail,
  getUserDataForEmail
};
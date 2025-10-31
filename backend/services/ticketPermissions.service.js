// ============================================
// TICKET PERMISSIONS SERVICE
// Handle ticket closure permissions and approval workflow
// Developed by: Suvadip Panja
// FILE: backend/services/ticketPermissions.service.js
// ============================================

const { executeQuery } = require('../config/database');
const settingsService = require('./settings.service');
const emailQueueService = require('./emailQueue.service');
const logger = require('../utils/logger');

class TicketPermissionsService {

  // ============================================
  // CHECK IF USER CAN CLOSE TICKET
  // ============================================
  async canUserCloseTicket(userId, ticketId) {
    try {
      // Get user and ticket info
      const query = `
        SELECT 
          t.ticket_id,
          t.ticket_number,
          t.created_by,
          t.assigned_to,
          t.status_id,
          u.role_id,
          r.role_name
        FROM tickets t
        INNER JOIN users u ON u.user_id = @userId
        INNER JOIN user_roles r ON u.role_id = r.role_id
        WHERE t.ticket_id = @ticketId
      `;

      const result = await executeQuery(query, { userId, ticketId });

      if (result.recordset.length === 0) {
        return {
          allowed: false,
          reason: 'Ticket not found'
        };
      }

      const ticket = result.recordset[0];
      const roleName = ticket.role_name.toLowerCase();

      // Admin and Manager can always close tickets
      if (roleName === 'admin' || roleName === 'manager') {
        return {
          allowed: true,
          requiresApproval: false,
          reason: 'Admin/Manager privilege'
        };
      }

      // Check if users are allowed to close tickets
      const allowUserClose = await settingsService.getSetting('ticket_allow_user_close');
      
      if (allowUserClose !== 'true') {
        // Engineers can close if they're assigned
        if (roleName === 'engineer' && ticket.assigned_to === userId) {
          return {
            allowed: true,
            requiresApproval: await this.requiresApproval(),
            reason: 'Assigned engineer'
          };
        }

        return {
          allowed: false,
          reason: 'Only assigned engineers, managers, and admins can close tickets'
        };
      }

      // Users are allowed to close - check if it's their ticket
      if (ticket.created_by === userId || ticket.assigned_to === userId) {
        return {
          allowed: true,
          requiresApproval: await this.requiresApproval(),
          reason: 'Ticket creator or assignee'
        };
      }

      return {
        allowed: false,
        reason: 'You can only close tickets you created or are assigned to'
      };

    } catch (error) {
      logger.error('Error checking ticket close permission:', error);
      return {
        allowed: false,
        reason: 'Error checking permissions'
      };
    }
  }

  // ============================================
  // CHECK IF APPROVAL IS REQUIRED
  // ============================================
  async requiresApproval() {
    const requireApproval = await settingsService.getSetting('ticket_require_approval_close');
    return requireApproval === 'true';
  }

  // ============================================
  // REQUEST TICKET CLOSURE
  // ============================================
  async requestClosure(ticketId, userId) {
    try {
      // Get "Pending Closure" status
      const statusQuery = `
        SELECT status_id 
        FROM ticket_statuses 
        WHERE status_name = 'Pending Closure'
      `;
      
      const statusResult = await executeQuery(statusQuery);
      
      if (statusResult.recordset.length === 0) {
        throw new Error('Pending Closure status not found');
      }

      const pendingStatusId = statusResult.recordset[0].status_id;

      // Update ticket
      const updateQuery = `
        UPDATE tickets
        SET 
          status_id = @pendingStatusId,
          closure_requested_at = GETDATE(),
          closure_requested_by = @userId,
          closure_approved_at = NULL,
          closure_approved_by = NULL,
          closure_rejected_at = NULL,
          closure_rejected_by = NULL,
          closure_rejection_reason = NULL,
          updated_at = GETDATE()
        WHERE ticket_id = @ticketId
      `;

      await executeQuery(updateQuery, {
        pendingStatusId,
        userId,
        ticketId
      });

      // Log activity
      await this.logActivity(ticketId, 'closure_requested', 'Closure approval requested', userId);

      // Get ticket details for notification
      const ticketQuery = `
        SELECT 
          t.ticket_number,
          t.subject,
          t.created_by,
          u.full_name as requester_name,
          u.email as requester_email
        FROM tickets t
        INNER JOIN users u ON t.closure_requested_by = u.user_id
        WHERE t.ticket_id = @ticketId
      `;

      const ticketResult = await executeQuery(ticketQuery, { ticketId });
      const ticket = ticketResult.recordset[0];

      // Send notification to managers
      await this.notifyManagers(ticketId, ticket, 'closure_request');

      return {
        success: true,
        message: 'Closure request submitted for manager approval'
      };

    } catch (error) {
      logger.error('Error requesting ticket closure:', error);
      throw error;
    }
  }

  // ============================================
  // APPROVE TICKET CLOSURE
  // ============================================
  async approveClosure(ticketId, managerId, autoClose = true) {
    try {
      // Update ticket with approval
      const updateQuery = `
        UPDATE tickets
        SET 
          closure_approved_at = GETDATE(),
          closure_approved_by = @managerId,
          closure_rejected_at = NULL,
          closure_rejected_by = NULL,
          closure_rejection_reason = NULL,
          updated_at = GETDATE()
        WHERE ticket_id = @ticketId
      `;

      await executeQuery(updateQuery, {
        managerId,
        ticketId
      });

      // Log activity
      await this.logActivity(ticketId, 'closure_approved', 'Closure request approved by manager', managerId);

      // Auto-close if enabled
      if (autoClose) {
        await this.closeTicket(ticketId, managerId);
      }

      // Get ticket details for notification
      const ticketQuery = `
        SELECT 
          t.ticket_number,
          t.subject,
          t.closure_requested_by,
          u.email as requester_email,
          u.full_name as requester_name,
          m.full_name as manager_name
        FROM tickets t
        INNER JOIN users u ON t.closure_requested_by = u.user_id
        INNER JOIN users m ON m.user_id = @managerId
        WHERE t.ticket_id = @ticketId
      `;

      const result = await executeQuery(ticketQuery, { ticketId, managerId });
      const ticket = result.recordset[0];

      // Send notification to requester
      await this.sendApprovalNotification(ticket, 'approved');

      return {
        success: true,
        message: autoClose ? 'Ticket closure approved and closed' : 'Ticket closure approved'
      };

    } catch (error) {
      logger.error('Error approving ticket closure:', error);
      throw error;
    }
  }

  // ============================================
  // REJECT TICKET CLOSURE
  // ============================================
  async rejectClosure(ticketId, managerId, reason) {
    try {
      // Get the previous status (before pending closure)
      // For now, set it back to "Open" or "In Progress"
      const openStatusQuery = `
        SELECT status_id 
        FROM ticket_statuses 
        WHERE status_name = 'In Progress'
      `;
      
      const statusResult = await executeQuery(openStatusQuery);
      const openStatusId = statusResult.recordset[0]?.status_id || 2;

      // Update ticket with rejection
      const updateQuery = `
        UPDATE tickets
        SET 
          status_id = @openStatusId,
          closure_rejected_at = GETDATE(),
          closure_rejected_by = @managerId,
          closure_rejection_reason = @reason,
          closure_requested_at = NULL,
          closure_requested_by = NULL,
          updated_at = GETDATE()
        WHERE ticket_id = @ticketId
      `;

      await executeQuery(updateQuery, {
        openStatusId,
        managerId,
        reason,
        ticketId
      });

      // Log activity
      await this.logActivity(
        ticketId, 
        'closure_rejected', 
        `Closure request rejected: ${reason}`, 
        managerId
      );

      // Get ticket details for notification
      const ticketQuery = `
        SELECT 
          t.ticket_number,
          t.subject,
          t.closure_requested_by,
          u.email as requester_email,
          u.full_name as requester_name,
          m.full_name as manager_name
        FROM tickets t
        LEFT JOIN users u ON t.closure_requested_by = u.user_id
        INNER JOIN users m ON m.user_id = @managerId
        WHERE t.ticket_id = @ticketId
      `;

      const result = await executeQuery(ticketQuery, { ticketId, managerId });
      const ticket = result.recordset[0];

      // Send notification to requester
      await this.sendApprovalNotification(ticket, 'rejected', reason);

      return {
        success: true,
        message: 'Ticket closure request rejected'
      };

    } catch (error) {
      logger.error('Error rejecting ticket closure:', error);
      throw error;
    }
  }

  // ============================================
  // CLOSE TICKET (FINAL)
  // ============================================
  async closeTicket(ticketId, userId) {
    try {
      // Get "Closed" status
      const statusQuery = `
        SELECT status_id 
        FROM ticket_statuses 
        WHERE status_name = 'Closed'
      `;
      
      const statusResult = await executeQuery(statusQuery);
      
      if (statusResult.recordset.length === 0) {
        throw new Error('Closed status not found');
      }

      const closedStatusId = statusResult.recordset[0].status_id;

      // Update ticket to closed
      const updateQuery = `
        UPDATE tickets
        SET 
          status_id = @closedStatusId,
          updated_at = GETDATE()
        WHERE ticket_id = @ticketId
      `;

      await executeQuery(updateQuery, {
        closedStatusId,
        ticketId
      });

      // Log activity
      await this.logActivity(ticketId, 'closed', 'Ticket closed', userId);

      // Send notifications
      await this.sendClosureNotifications(ticketId);

      return {
        success: true,
        message: 'Ticket closed successfully'
      };

    } catch (error) {
      logger.error('Error closing ticket:', error);
      throw error;
    }
  }

  // ============================================
  // GET PENDING CLOSURE REQUESTS
  // ============================================
  async getPendingClosureRequests(managerId = null) {
    try {
      const query = `
        SELECT 
          t.ticket_id,
          t.ticket_number,
          t.subject,
          t.priority_id,
          t.closure_requested_at,
          t.closure_requested_by,
          u.full_name as requester_name,
          u.email as requester_email,
          p.priority_name,
          p.priority_color
        FROM tickets t
        INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
        INNER JOIN users u ON t.closure_requested_by = u.user_id
        LEFT JOIN ticket_priorities p ON t.priority_id = p.priority_id
        WHERE ts.status_name = 'Pending Closure'
          AND t.closure_requested_at IS NOT NULL
          AND t.closure_approved_at IS NULL
          AND t.closure_rejected_at IS NULL
        ORDER BY t.closure_requested_at ASC
      `;

      const result = await executeQuery(query);
      return result.recordset;

    } catch (error) {
      logger.error('Error getting pending closure requests:', error);
      return [];
    }
  }

  // ============================================
  // LOG ACTIVITY
  // ============================================
  async logActivity(ticketId, activityType, description, userId = null) {
    try {
      const query = `
        INSERT INTO ticket_activities (
          ticket_id,
          user_id,
          activity_type,
          description,
          created_at
        )
        VALUES (
          @ticketId,
          @userId,
          @activityType,
          @description,
          GETDATE()
        )
      `;

      await executeQuery(query, {
        ticketId,
        userId,
        activityType,
        description
      });

    } catch (error) {
      logger.error('Error logging activity:', error);
    }
  }

  // ============================================
  // SEND APPROVAL NOTIFICATION
  // ============================================
  async sendApprovalNotification(ticket, status, reason = null) {
    try {
      if (!ticket.requester_email) return;

      const subject = status === 'approved' 
        ? `Ticket Closure Approved: ${ticket.ticket_number}`
        : `Ticket Closure Rejected: ${ticket.ticket_number}`;

      await emailQueueService.queueEmail({
        template_name: `closure_${status}`,
        recipient_email: ticket.requester_email,
        recipient_name: ticket.requester_name,
        ticket_number: ticket.ticket_number,
        subject: ticket.subject,
        manager_name: ticket.manager_name,
        rejection_reason: reason
      });

    } catch (error) {
      logger.error('Error sending approval notification:', error);
    }
  }

  // ============================================
  // NOTIFY MANAGERS OF CLOSURE REQUEST
  // ============================================
  async notifyManagers(ticketId, ticket, type) {
    try {
      // Get all managers
      const managersQuery = `
        SELECT u.user_id, u.email, u.full_name
        FROM users u
        INNER JOIN user_roles r ON u.role_id = r.role_id
        WHERE r.role_name IN ('Admin', 'Manager')
          AND u.is_active = 1
      `;

      const result = await executeQuery(managersQuery);
      const managers = result.recordset;

      // Send email to each manager
      for (const manager of managers) {
        await emailQueueService.queueEmail({
          template_name: 'closure_request_manager',
          recipient_email: manager.email,
          recipient_name: manager.full_name,
          ticket_number: ticket.ticket_number,
          subject: ticket.subject,
          requester_name: ticket.requester_name
        });
      }

    } catch (error) {
      logger.error('Error notifying managers:', error);
    }
  }

  // ============================================
  // SEND CLOSURE NOTIFICATIONS
  // ============================================
  async sendClosureNotifications(ticketId) {
    try {
      const emailEnabled = await settingsService.getSetting('email_ticket_closed');
      if (emailEnabled !== 'true') return;

      // Get ticket and user details
      const query = `
        SELECT 
          t.ticket_number,
          t.subject,
          t.created_by,
          t.assigned_to,
          creator.email as creator_email,
          creator.full_name as creator_name,
          assignee.email as assignee_email,
          assignee.full_name as assignee_name
        FROM tickets t
        LEFT JOIN users creator ON t.created_by = creator.user_id
        LEFT JOIN users assignee ON t.assigned_to = assignee.user_id
        WHERE t.ticket_id = @ticketId
      `;

      const result = await executeQuery(query, { ticketId });
      const ticket = result.recordset[0];

      // Send to creator
      if (ticket.creator_email) {
        await emailQueueService.queueEmail({
          template_name: 'ticket_closed',
          recipient_email: ticket.creator_email,
          recipient_name: ticket.creator_name,
          ticket_number: ticket.ticket_number,
          subject: ticket.subject
        });
      }

      // Send to assignee if different
      if (ticket.assignee_email && ticket.assignee_email !== ticket.creator_email) {
        await emailQueueService.queueEmail({
          template_name: 'ticket_closed',
          recipient_email: ticket.assignee_email,
          recipient_name: ticket.assignee_name,
          ticket_number: ticket.ticket_number,
          subject: ticket.subject
        });
      }

    } catch (error) {
      logger.error('Error sending closure notifications:', error);
    }
  }
}

module.exports = new TicketPermissionsService();
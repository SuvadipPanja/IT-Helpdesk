// ============================================
// TICKET PERMISSIONS SERVICE
// Handle ticket closure permissions and approval workflow
// Developed by: Suvadip Panja
// FILE: backend/services/ticketPermissions.service.js
// UPDATED: settingsService.get (not getSetting), role_code, SQL name concat,
//          full close parity, activity insert schema, route safety
// ============================================

const { executeQuery } = require('../config/database');
const settingsService = require('./settings.service');
const emailQueueService = require('./emailQueue.service');
const logger = require('../utils/logger');

const PENDING_CLOSURE = 'Pending Closure';

class TicketPermissionsService {

  // ============================================
  // CHECK IF USER CAN CLOSE TICKET
  // ============================================
  async canUserCloseTicket(userId, ticketId) {
    try {
      const query = `
        SELECT 
          t.ticket_id,
          t.ticket_number,
          t.created_by,
          t.assigned_to,
          t.status_id,
          r.role_id,
          r.role_code,
          r.role_name,
          ts.status_name,
          ts.status_code,
          ts.is_final_status
        FROM tickets t
        INNER JOIN users u ON u.user_id = @userId
        INNER JOIN user_roles r ON u.role_id = r.role_id
        INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
        WHERE t.ticket_id = @ticketId
      `;

      const result = await executeQuery(query, { userId, ticketId });

      if (result.recordset.length === 0) {
        return {
          allowed: false,
          reason: 'Ticket not found',
        };
      }

      const ticket = result.recordset[0];
      const roleCode = (ticket.role_code || '').toUpperCase();
      const roleName = (ticket.role_name || '').toLowerCase();

      if (ticket.is_final_status) {
        return {
          allowed: false,
          reason: 'Ticket is already closed',
        };
      }

      // Waiting for manager closure decision — use approve/reject APIs, not direct close
      if ((ticket.status_name || '') === PENDING_CLOSURE) {
        return {
          allowed: false,
          reason: 'This ticket is already waiting for manager approval to close.',
          pending_closure: true,
        };
      }

      const isElevated =
        roleCode === 'ADMIN' ||
        roleCode === 'MANAGER' ||
        roleCode === 'CENTRAL_MGMT' ||
        roleName === 'admin' ||
        roleName === 'manager';

      // Admin / Manager / Central — may close directly (subject to global setting if you extend later)
      if (isElevated) {
        return {
          allowed: true,
          requiresApproval: false,
          reason: 'Manager or admin privilege',
        };
      }

      const allowUserClose = await settingsService.get('ticket_allow_user_close');

      if (allowUserClose !== 'true') {
        if (roleName === 'engineer' && ticket.assigned_to === userId) {
          return {
            allowed: true,
            requiresApproval: await this.requiresApproval(),
            reason: 'Assigned engineer',
          };
        }

        return {
          allowed: false,
          reason: 'Only assigned engineers, managers, and admins can close tickets',
        };
      }

      if (ticket.created_by === userId || ticket.assigned_to === userId) {
        return {
          allowed: true,
          requiresApproval: await this.requiresApproval(),
          reason: 'Ticket creator or assignee',
        };
      }

      return {
        allowed: false,
        reason: 'You can only close tickets you created or are assigned to',
      };
    } catch (error) {
      logger.error('Error checking ticket close permission:', error);
      return {
        allowed: false,
        reason: 'Error checking permissions',
      };
    }
  }

  /**
   * Manager may review a ticket stuck in Pending Closure (approve / reject UI).
   */
  canReviewPendingClosure(userRoleCode) {
    const rc = (userRoleCode || '').toUpperCase();
    return rc === 'ADMIN' || rc === 'MANAGER' || rc === 'CENTRAL_MGMT';
  }

  // ============================================
  // CHECK IF APPROVAL IS REQUIRED
  // ============================================
  async requiresApproval() {
    const requireApproval = await settingsService.get('ticket_require_approval_close');
    return requireApproval === 'true';
  }

  // ============================================
  // REQUEST TICKET CLOSURE
  // ============================================
  async requestClosure(ticketId, userId) {
    try {
      const ticketRow = await executeQuery(
        `SELECT ts.status_name, ts.is_final_status, t.approval_pending
         FROM tickets t
         INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
         WHERE t.ticket_id = @ticketId`,
        { ticketId }
      );
      if (!ticketRow.recordset?.length) {
        throw new Error('Ticket not found');
      }
      const st = ticketRow.recordset[0];
      if (st.is_final_status) {
        throw new Error('Ticket is already closed');
      }
      if ((st.status_name || '') === PENDING_CLOSURE) {
        throw new Error('A closure request is already pending for this ticket');
      }
      if (st.approval_pending) {
        throw new Error('Complete or cancel the in-progress approval request before requesting closure');
      }

      const statusQuery = `
        SELECT status_id 
        FROM ticket_statuses 
        WHERE status_name = @pendingName
      `;

      const statusResult = await executeQuery(statusQuery, { pendingName: PENDING_CLOSURE });

      if (statusResult.recordset.length === 0) {
        throw new Error(
          `"${PENDING_CLOSURE}" status not found — add it to ticket_statuses or run DB scripts`
        );
      }

      const pendingStatusId = statusResult.recordset[0].status_id;

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
        ticketId,
      });

      await this.logActivity(
        ticketId,
        'closure_requested',
        'Closure approval requested',
        userId
      );

      const ticketQuery = `
        SELECT 
          t.ticket_number,
          t.subject,
          t.created_by,
          ISNULL(u.first_name, '') + ' ' + ISNULL(u.last_name, '') AS requester_name,
          u.email AS requester_email
        FROM tickets t
        INNER JOIN users u ON t.closure_requested_by = u.user_id
        WHERE t.ticket_id = @ticketId
      `;

      const ticketResult = await executeQuery(ticketQuery, { ticketId });
      const ticket = ticketResult.recordset[0];

      await this.notifyManagers(ticketId, ticket, 'closure_request');

      return {
        success: true,
        message: 'Closure request submitted for manager approval',
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
        ticketId,
      });

      await this.logActivity(
        ticketId,
        'closure_approved',
        'Closure request approved by manager',
        managerId
      );

      if (autoClose) {
        await this.closeTicket(
          ticketId,
          managerId,
          'Ticket closed after manager approved the closure request.'
        );
      }

      const ticketQuery = `
        SELECT 
          t.ticket_number,
          t.subject,
          t.closure_requested_by,
          u.email AS requester_email,
          ISNULL(u.first_name, '') + ' ' + ISNULL(u.last_name, '') AS requester_name,
          ISNULL(m.first_name, '') + ' ' + ISNULL(m.last_name, '') AS manager_name
        FROM tickets t
        INNER JOIN users u ON t.closure_requested_by = u.user_id
        INNER JOIN users m ON m.user_id = @managerId
        WHERE t.ticket_id = @ticketId
      `;

      const result = await executeQuery(ticketQuery, { ticketId, managerId });
      const ticket = result.recordset[0];

      await this.sendApprovalNotification(ticket, 'approved');

      return {
        success: true,
        message: autoClose ? 'Ticket closure approved and closed' : 'Ticket closure approved',
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
      const ticketQueryBefore = `
        SELECT 
          t.ticket_number,
          t.subject,
          t.closure_requested_by,
          u.email AS requester_email,
          ISNULL(u.first_name, '') + ' ' + ISNULL(u.last_name, '') AS requester_name,
          ISNULL(m.first_name, '') + ' ' + ISNULL(m.last_name, '') AS manager_name
        FROM tickets t
        LEFT JOIN users u ON t.closure_requested_by = u.user_id
        INNER JOIN users m ON m.user_id = @managerId
        WHERE t.ticket_id = @ticketId
      `;
      const beforeResult = await executeQuery(ticketQueryBefore, { ticketId, managerId });
      const ticket = beforeResult.recordset[0];

      const openStatusQuery = `
        SELECT status_id 
        FROM ticket_statuses 
        WHERE status_code = 'IN_PROGRESS'
      `;

      const statusResult = await executeQuery(openStatusQuery);
      const openStatusId = statusResult.recordset[0]?.status_id;
      if (!openStatusId) {
        throw new Error('IN_PROGRESS status not found');
      }

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
        ticketId,
      });

      await this.logActivity(
        ticketId,
        'closure_rejected',
        `Closure request rejected: ${reason}`,
        managerId
      );

      if (ticket) {
        await this.sendApprovalNotification(ticket, 'rejected', reason);
      }

      return {
        success: true,
        message: 'Ticket closure request rejected',
      };
    } catch (error) {
      logger.error('Error rejecting ticket closure:', error);
      throw error;
    }
  }

  // ============================================
  // CLOSE TICKET (FINAL) — parity with PATCH /tickets/:id/close
  // ============================================
  async closeTicket(ticketId, userId, resolutionNotes = 'Ticket closed.') {
    try {
      const statusQuery = `
        SELECT status_id 
        FROM ticket_statuses 
        WHERE status_code = 'CLOSED'
      `;

      const statusResult = await executeQuery(statusQuery);

      if (statusResult.recordset.length === 0) {
        throw new Error('CLOSED status not found');
      }

      const closedStatusId = statusResult.recordset[0].status_id;

      const updateQuery = `
        UPDATE tickets
        SET 
          status_id = @closedStatusId,
          resolution_notes = @resolutionNotes,
          resolved_at = COALESCE(resolved_at, GETDATE()),
          closed_at = GETDATE(),
          updated_at = GETDATE()
        WHERE ticket_id = @ticketId
      `;

      await executeQuery(updateQuery, {
        closedStatusId,
        resolutionNotes,
        ticketId,
      });

      await this.logActivity(ticketId, 'closed', `Ticket closed. ${resolutionNotes}`, userId);

      await this.sendClosureNotifications(ticketId);

      return {
        success: true,
        message: 'Ticket closed successfully',
      };
    } catch (error) {
      logger.error('Error closing ticket:', error);
      throw error;
    }
  }

  // ============================================
  // GET PENDING CLOSURE REQUESTS
  // ============================================
  async getPendingClosureRequests() {
    try {
      const query = `
        SELECT 
          t.ticket_id,
          t.ticket_number,
          t.subject,
          t.priority_id,
          t.closure_requested_at,
          t.closure_requested_by,
          ISNULL(u.first_name, '') + ' ' + ISNULL(u.last_name, '') AS requester_name,
          u.email AS requester_email,
          p.priority_name,
          p.color_code AS priority_color
        FROM tickets t
        INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
        INNER JOIN users u ON t.closure_requested_by = u.user_id
        LEFT JOIN ticket_priorities p ON t.priority_id = p.priority_id
        WHERE ts.status_name = @pendingName
          AND t.closure_requested_at IS NOT NULL
          AND t.closure_approved_at IS NULL
          AND t.closure_rejected_at IS NULL
        ORDER BY t.closure_requested_at ASC
      `;

      const result = await executeQuery(query, { pendingName: PENDING_CLOSURE });
      return result.recordset;
    } catch (error) {
      logger.error('Error getting pending closure requests:', error);
      return [];
    }
  }

  // ============================================
  // LOG ACTIVITY (aligned with ticket_activities schema)
  // ============================================
  async logActivity(ticketId, activityType, description, userId = null) {
    try {
      const query = `
        INSERT INTO ticket_activities (
          ticket_id, activity_type, field_name, old_value, new_value, description, performed_by
        )
        VALUES (
          @ticketId, @activityType, 'workflow', NULL, NULL, @description, @userId
        )
      `;

      await executeQuery(query, {
        ticketId,
        activityType,
        description,
        userId,
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
      if (!ticket?.requester_email) return;

      await emailQueueService.queueEmail({
        template_name: `closure_${status}`,
        recipient_email: ticket.requester_email,
        recipient_name: ticket.requester_name,
        ticket_number: ticket.ticket_number,
        subject: ticket.subject,
        manager_name: ticket.manager_name,
        rejection_reason: reason,
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
      const notify = await settingsService.get('notify_on_closure_request');
      if (notify !== 'true' && notify !== true) {
        logger.info('notify_on_closure_request is off; skipping manager emails for closure request', {
          ticketId,
        });
        return;
      }

      const managersQuery = `
        SELECT u.user_id, u.email,
          ISNULL(u.first_name, '') + ' ' + ISNULL(u.last_name, '') AS full_name
        FROM users u
        INNER JOIN user_roles r ON u.role_id = r.role_id
        WHERE r.role_code IN ('ADMIN', 'MANAGER', 'CENTRAL_MGMT')
          AND u.is_active = 1
      `;

      const result = await executeQuery(managersQuery);
      const managers = result.recordset;

      for (const manager of managers) {
        await emailQueueService.queueEmail({
          template_name: 'closure_request_manager',
          recipient_email: manager.email,
          recipient_name: manager.full_name,
          ticket_number: ticket.ticket_number,
          subject: ticket.subject,
          requester_name: ticket.requester_name,
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
      const emailEnabled = await settingsService.get('email_ticket_closed');
      if (emailEnabled !== 'true') return;

      const query = `
        SELECT 
          t.ticket_number,
          t.subject,
          t.created_by,
          t.assigned_to,
          creator.email AS creator_email,
          ISNULL(creator.first_name, '') + ' ' + ISNULL(creator.last_name, '') AS creator_name,
          assignee.email AS assignee_email,
          ISNULL(assignee.first_name, '') + ' ' + ISNULL(assignee.last_name, '') AS assignee_name
        FROM tickets t
        LEFT JOIN users creator ON t.created_by = creator.user_id
        LEFT JOIN users assignee ON t.assigned_to = assignee.user_id
        WHERE t.ticket_id = @ticketId
      `;

      const result = await executeQuery(query, { ticketId });
      const ticket = result.recordset[0];

      if (ticket.creator_email) {
        await emailQueueService.queueEmail({
          template_name: 'ticket_closed',
          recipient_email: ticket.creator_email,
          recipient_name: ticket.creator_name,
          ticket_number: ticket.ticket_number,
          subject: ticket.subject,
        });
      }

      if (ticket.assignee_email && ticket.assignee_email !== ticket.creator_email) {
        await emailQueueService.queueEmail({
          template_name: 'ticket_closed',
          recipient_email: ticket.assignee_email,
          recipient_name: ticket.assignee_name,
          ticket_number: ticket.ticket_number,
          subject: ticket.subject,
        });
      }
    } catch (error) {
      logger.error('Error sending closure notifications:', error);
    }
  }
}

module.exports = new TicketPermissionsService();

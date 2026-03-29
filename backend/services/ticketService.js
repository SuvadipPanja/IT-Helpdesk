const db = require('../config/database');
const logger = require('../utils/logger');

class TicketService {
  async getMyTickets(userId, filters = {}) {
    try {
      let query = `
        SELECT TOP 50
          t.ticket_id,
          t.ticket_number,
          t.subject,
          t.description,
          t.priority_id,
          tp.priority_name,
          t.status_id,
          ts.status_name,
          t.requester_id,
          u.first_name + ' ' + u.last_name AS requester_name,
          t.assigned_to,
          u2.first_name + ' ' + u2.last_name AS assigned_to_name,
          t.category_id,
          tc.category_name,
          t.department_id,
          d.department_name,
          t.created_at,
          t.updated_at
        FROM tickets t
        LEFT JOIN ticket_priorities tp ON t.priority_id = tp.priority_id
        LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
        LEFT JOIN users u ON t.requester_id = u.user_id
        LEFT JOIN users u2 ON t.assigned_to = u2.user_id
        LEFT JOIN ticket_categories tc ON t.category_id = tc.category_id
        LEFT JOIN departments d ON t.department_id = d.department_id
        WHERE t.requester_id = @userId
      `;

      const params = { userId };

      if (filters.status) {
        query += ' AND ts.status_name = @status';
        params.status = filters.status;
      }
      if (filters.priority) {
        query += ' AND tp.priority_name = @priority';
        params.priority = filters.priority;
      }
      if (filters.department) {
        query += ' AND t.department_id = @departmentId';
        params.departmentId = filters.department;
      }

      query += ' ORDER BY t.created_at DESC';

      const result = await db.executeQuery(query, params);
      const rows = result.recordset || [];
      logger.info(`Retrieved ${rows.length} tickets for user ${userId}`);
      return rows;
    } catch (error) {
      logger.error(`Error getting tickets for user ${userId}:`, error);
      throw error;
    }
  }

  async getTicketById(ticketId, userId) {
    try {
      const query = `
        SELECT TOP 1
          t.*,
          tp.priority_name,
          ts.status_name,
          ur.first_name + ' ' + ur.last_name AS requester_name,
          ur.email AS requester_email,
          ua.first_name + ' ' + ua.last_name AS assigned_to_name,
          ua.email AS assigned_to_email,
          tc.category_name,
          d.department_name
        FROM tickets t
        LEFT JOIN ticket_priorities tp ON t.priority_id = tp.priority_id
        LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
        LEFT JOIN users ur ON t.requester_id = ur.user_id
        LEFT JOIN users ua ON t.assigned_to = ua.user_id
        LEFT JOIN ticket_categories tc ON t.category_id = tc.category_id
        LEFT JOIN departments d ON t.department_id = d.department_id
        WHERE t.ticket_id = @ticketId
      `;

      const result = await db.executeQuery(query, { ticketId });
      const ticket = result.recordset?.[0] || null;

      if (!ticket) {
        return null;
      }

      if (ticket.requester_id !== userId && ticket.assigned_to !== userId) {
        logger.warn(`User ${userId} viewing ticket ${ticketId} they don't own`);
      }

      return ticket;
    } catch (error) {
      logger.error(`Error getting ticket ${ticketId}:`, error);
      throw error;
    }
  }

  async createTicketFromBot(ticketData, userId) {
    try {
      const required = ['subject', 'description', 'priority_id', 'category_id', 'department_id'];
      for (const field of required) {
        if (!ticketData[field]) {
          throw new Error(`Missing required field: ${field}`);
        }
      }

      const year = new Date().getFullYear();
      const countQuery = 'SELECT COUNT(*) AS count FROM tickets WHERE YEAR(created_at) = @year';
      const countResult = await db.executeQuery(countQuery, { year });
      const nextNumber = (Number(countResult.recordset?.[0]?.count || 0) + 1).toString().padStart(5, '0');
      const ticketNumber = `TKT-${year}-${nextNumber}`;

      const openStatusQuery = "SELECT TOP 1 status_id FROM ticket_statuses WHERE UPPER(status_name) = 'OPEN'";
      const openStatusResult = await db.executeQuery(openStatusQuery);
      const openStatusId = openStatusResult.recordset?.[0]?.status_id || 1;

      const insertQuery = `
        INSERT INTO tickets (
          ticket_number, subject, description, priority_id, category_id,
          department_id, requester_id, status_id, created_at, updated_at
        )
        OUTPUT INSERTED.ticket_id
        VALUES (
          @ticketNumber, @subject, @description, @priorityId, @categoryId,
          @departmentId, @requesterId, @statusId, GETDATE(), GETDATE()
        )
      `;

      const insertResult = await db.executeQuery(insertQuery, {
        ticketNumber,
        subject: ticketData.subject,
        description: ticketData.description,
        priorityId: ticketData.priority_id,
        categoryId: ticketData.category_id,
        departmentId: ticketData.department_id,
        requesterId: userId || ticketData.requester_id,
        statusId: openStatusId,
      });

      const ticketId = insertResult.recordset?.[0]?.ticket_id;

      logger.info(`Created ticket ${ticketNumber} for user ${userId}`);

      return {
        ticket_id: ticketId,
        ticket_number: ticketNumber,
        subject: ticketData.subject,
        status: 'Open',
        created_at: new Date(),
      };
    } catch (error) {
      logger.error(`Error creating ticket for user ${userId}:`, error);
      throw error;
    }
  }

  async updateTicketStatus(ticketId, newStatus, userId) {
    try {
      const statusQuery = 'SELECT TOP 1 status_id FROM ticket_statuses WHERE UPPER(status_name) = UPPER(@statusName)';
      const statusResult = await db.executeQuery(statusQuery, { statusName: newStatus });
      const statusId = statusResult.recordset?.[0]?.status_id;

      if (!statusId) {
        throw new Error(`Invalid status: ${newStatus}`);
      }

      const updateQuery = `
        UPDATE tickets
        SET status_id = @statusId, updated_at = GETDATE()
        WHERE ticket_id = @ticketId
      `;
      const updateResult = await db.executeQuery(updateQuery, { statusId, ticketId });

      if (!updateResult.rowsAffected?.[0]) {
        throw new Error(`Ticket ${ticketId} not found`);
      }

      logger.info(`Updated ticket ${ticketId} status to ${newStatus} by user ${userId}`);
      return true;
    } catch (error) {
      logger.error(`Error updating ticket ${ticketId}:`, error);
      throw error;
    }
  }

  async searchTickets(searchQuery, userId) {
    try {
      const keyword = `%${searchQuery || ''}%`;
      const query = `
        SELECT TOP 20
          t.ticket_id,
          t.ticket_number,
          t.subject,
          t.description,
          tp.priority_name,
          ts.status_name,
          t.created_at
        FROM tickets t
        LEFT JOIN ticket_priorities tp ON t.priority_id = tp.priority_id
        LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
        WHERE (t.ticket_number LIKE @keyword OR t.subject LIKE @keyword OR t.description LIKE @keyword)
          AND (t.requester_id = @userId OR t.assigned_to = @userId)
        ORDER BY t.created_at DESC
      `;

      const result = await db.executeQuery(query, { keyword, userId });
      return result.recordset || [];
    } catch (error) {
      logger.error('Error searching tickets:', error);
      throw error;
    }
  }

  async assignTicket(ticketId, assigneeId, userId) {
    try {
      const query = `
        UPDATE tickets
        SET assigned_to = @assigneeId, updated_at = GETDATE()
        WHERE ticket_id = @ticketId
      `;
      await db.executeQuery(query, { assigneeId, ticketId });
      logger.info(`Assigned ticket ${ticketId} to user ${assigneeId} by user ${userId}`);
      return true;
    } catch (error) {
      logger.error(`Error assigning ticket ${ticketId}:`, error);
      throw error;
    }
  }

  async getTicketActivity(ticketId) {
    try {
      const query = `
        SELECT TOP 50
          tc.comment_id,
          tc.ticket_id,
          tc.commented_by AS user_id,
          u.first_name + ' ' + u.last_name AS user_name,
          tc.comment_text,
          tc.is_internal,
          tc.commented_at AS created_at
        FROM ticket_comments tc
        LEFT JOIN users u ON tc.commented_by = u.user_id
        WHERE tc.ticket_id = @ticketId AND tc.is_deleted = 0
        ORDER BY tc.commented_at DESC
      `;
      const result = await db.executeQuery(query, { ticketId });
      return result.recordset || [];
    } catch (error) {
      logger.error('Error getting ticket activity:', error);
      throw error;
    }
  }

  async addTicketComment(ticketId, comment, userId, isInternal = false) {
    try {
      const query = `
        INSERT INTO ticket_comments (ticket_id, comment_text, is_internal, commented_by, commented_at, is_deleted)
        OUTPUT INSERTED.comment_id
        VALUES (@ticketId, @commentText, @isInternal, @userId, GETDATE(), 0)
      `;
      const result = await db.executeQuery(query, {
        ticketId,
        commentText: comment,
        isInternal: isInternal ? 1 : 0,
        userId,
      });
      return { comment_id: result.recordset?.[0]?.comment_id, success: true };
    } catch (error) {
      logger.error('Error adding comment to ticket:', error);
      throw error;
    }
  }

  async getTicketsByCategory(categoryId, userId) {
    try {
      const query = `
        SELECT TOP 30
          t.ticket_id,
          t.ticket_number,
          t.subject,
          tp.priority_name,
          ts.status_name,
          t.created_at
        FROM tickets t
        LEFT JOIN ticket_priorities tp ON t.priority_id = tp.priority_id
        LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
        WHERE t.category_id = @categoryId
          AND (t.requester_id = @userId OR t.assigned_to = @userId)
        ORDER BY t.created_at DESC
      `;
      const result = await db.executeQuery(query, { categoryId, userId });
      return result.recordset || [];
    } catch (error) {
      logger.error('Error getting tickets by category:', error);
      throw error;
    }
  }

  async getTeamTicketStats() {
    try {
      const query = `
        SELECT
          COUNT(*) AS total_tickets,
          SUM(CASE WHEN ts.is_final_status = 0 THEN 1 ELSE 0 END) AS open_tickets,
          SUM(CASE WHEN ts.is_final_status = 1 THEN 1 ELSE 0 END) AS closed_tickets,
          SUM(CASE WHEN UPPER(tp.priority_code) = 'CRITICAL' AND ts.is_final_status = 0 THEN 1 ELSE 0 END) AS critical_open
        FROM tickets t
        LEFT JOIN ticket_priorities tp ON t.priority_id = tp.priority_id
        LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
      `;
      const result = await db.executeQuery(query);
      return result.recordset?.[0] || {
        total_tickets: 0,
        open_tickets: 0,
        closed_tickets: 0,
        critical_open: 0,
      };
    } catch (error) {
      logger.error('Error getting team statistics:', error);
      throw error;
    }
  }
}

module.exports = new TicketService();

/**
 * ============================================
 * TICKET BUCKET CONTROLLER
 * ============================================
 * Open Ticket Bucket System for Engineers
 * 
 * PURPOSE:
 * - Engineers can browse unassigned tickets filtered by location
 * - Engineers can self-assign (pick up) tickets from the bucket
 * - Secure: only self-assignment, only unassigned + non-final tickets
 * 
 * SECURITY:
 * - All endpoints require authentication
 * - List/Stats: ENGINEER, ADMIN, MANAGER roles
 * - Self-Assign: ENGINEER only (assigns req.user.user_id)
 * - Cannot assign to another user
 * - Cannot pick up already-assigned tickets
 * - Cannot pick up final-status tickets
 * - Full audit trail via ticket_activities
 * 
 * Developer: Suvadip Panja
 * Company: Digitide
 * Created: March 2026
 * ============================================
 */

const { executeQuery } = require('../config/database');
const { createResponse, getPaginationMeta } = require('../utils/helpers');
const logger = require('../utils/logger');
const settingsService = require('../services/settings.service');
const emailQueueService = require('../services/emailQueue.service');
const dateUtils = require('../utils/dateUtils');
const { getPublicAppUrl } = require('../utils/publicUrl');

// ============================================
// GET BUCKET TICKETS (Unassigned, non-final)
// ============================================
/**
 * Get unassigned open tickets for the bucket view
 * @route GET /api/v1/ticket-bucket
 * @access ENGINEER, ADMIN, MANAGER
 * 
 * Query Params:
 *   - location_id: Filter by location (optional, 'all' or empty = all locations)
 *   - page, limit: Pagination
 *   - search: Search by ticket number, subject
 *   - priority_id: Filter by priority
 *   - category_id: Filter by category
 *   - department_id: Filter by department
 *   - sortBy, sortOrder: Sorting
 */
const getBucketTickets = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const location_id = req.query.location_id || null;
    const priority_id = req.query.priority_id || null;
    const category_id = req.query.category_id || null;
    const department_id = req.query.department_id || null;
    const offset = (page - 1) * limit;

    const userId = req.user.user_id;

    logger.try('Fetching bucket tickets (unassigned)', {
      userId,
      location_id,
      page,
      limit,
    });

    // Build WHERE clause — core: unassigned + non-final status + not routed to any team
    let whereConditions = [
      't.assigned_to IS NULL',
      'ts.is_final_status = 0',
      't.team_id IS NULL'
    ];
    let params = {};

    // Location filter
    if (location_id && location_id !== 'all') {
      whereConditions.push('t.location_id = @locationId');
      params.locationId = parseInt(location_id);
    }

    // Search
    if (search) {
      whereConditions.push(`(
        t.ticket_number LIKE '%' + @search + '%' OR 
        t.subject LIKE '%' + @search + '%' OR
        t.description LIKE '%' + @search + '%'
      )`);
      params.search = search;
    }

    // Priority filter
    if (priority_id) {
      whereConditions.push('t.priority_id = @priorityId');
      params.priorityId = parseInt(priority_id);
    }

    // Category filter
    if (category_id) {
      whereConditions.push('t.category_id = @categoryId');
      params.categoryId = parseInt(category_id);
    }

    // Department filter
    if (department_id) {
      whereConditions.push('t.department_id = @departmentId');
      params.departmentId = parseInt(department_id);
    }

    const whereClause = 'WHERE ' + whereConditions.join(' AND ');

    // Count total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM tickets t
      LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
      ${whereClause}
    `;
    const countResult = await executeQuery(countQuery, params);
    const totalRecords = countResult.recordset[0].total;

    // Validate sort column
    const allowedSortColumns = ['created_at', 'updated_at', 'ticket_number', 'subject', 'due_date', 'priority_id', 'status_id'];
    const sortBy = allowedSortColumns.includes(req.query.sortBy) ? req.query.sortBy : 'created_at';
    const sortOrder = req.query.sortOrder === 'ASC' ? 'ASC' : 'DESC';

    // Fetch tickets
    const ticketsQuery = `
      SELECT 
        t.ticket_id,
        t.ticket_number,
        t.subject,
        t.description,
        t.created_at,
        t.updated_at,
        t.due_date,
        t.is_escalated,

        tc.category_id,
        tc.category_name,

        tp.priority_id,
        tp.priority_name,
        tp.priority_code,
        tp.color_code as priority_color,

        ts.status_id,
        ts.status_name,
        ts.status_code,
        ts.color_code as status_color,

        u_req.user_id as requester_id,
        u_req.first_name + ' ' + u_req.last_name as requester_name,
        u_req.profile_picture as requester_profile_picture,

        d.department_id,
        d.department_name,

        loc.location_id as ticket_location_id,
        loc.location_name as ticket_location_name,

        prc.process_name

      FROM tickets t
      LEFT JOIN ticket_categories tc ON t.category_id = tc.category_id
      LEFT JOIN ticket_priorities tp ON t.priority_id = tp.priority_id
      LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
      LEFT JOIN users u_req ON t.requester_id = u_req.user_id
      LEFT JOIN departments d ON t.department_id = d.department_id
      LEFT JOIN locations loc ON t.location_id = loc.location_id
      LEFT JOIN processes prc ON t.process_id = prc.process_id
      ${whereClause}
      ORDER BY t.${sortBy} ${sortOrder}
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `;

    params.offset = offset;
    params.limit = limit;

    const ticketsResult = await executeQuery(ticketsQuery, params);
    const paginationMeta = getPaginationMeta(totalRecords, page, limit);

    logger.success('Bucket tickets fetched', {
      count: ticketsResult.recordset.length,
      total: totalRecords,
    });

    return res.status(200).json(
      createResponse(true, 'Bucket tickets fetched successfully', {
        tickets: ticketsResult.recordset,
        pagination: paginationMeta
      })
    );
  } catch (error) {
    logger.error('Get bucket tickets error', error);
    next(error);
  }
};


// ============================================
// GET BUCKET STATS (Counts by location)
// ============================================
/**
 * Get unassigned ticket counts grouped by location
 * @route GET /api/v1/ticket-bucket/stats
 * @access ENGINEER, ADMIN, MANAGER
 */
const getBucketStats = async (req, res, next) => {
  try {
    const userId = req.user.user_id;

    logger.try('Fetching bucket stats', { userId });

    // Get engineer's own location for highlighting
    const userQuery = `SELECT location_id FROM users WHERE user_id = @userId`;
    const userResult = await executeQuery(userQuery, { userId });
    const userLocationId = userResult.recordset[0]?.location_id || null;

    // Get counts by location + total
    const statsQuery = `
      SELECT 
        -- Total unassigned non-final tickets
        COUNT(*) as total_unassigned,
        
        -- By location (NULL = no location set)
        SUM(CASE WHEN t.location_id IS NULL THEN 1 ELSE 0 END) as no_location_count

      FROM tickets t
      LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
      WHERE t.assigned_to IS NULL
        AND ts.is_final_status = 0
        AND t.team_id IS NULL
    `;

    const statsResult = await executeQuery(statsQuery, {});
    const totalStats = statsResult.recordset[0];

    // Get per-location breakdown
    const locationStatsQuery = `
      SELECT 
        l.location_id,
        l.location_name,
        COUNT(t.ticket_id) as ticket_count
      FROM locations l
      LEFT JOIN tickets t ON t.location_id = l.location_id
        AND t.assigned_to IS NULL
        AND t.status_id IN (SELECT status_id FROM ticket_statuses WHERE is_final_status = 0)
        AND t.team_id IS NULL
      WHERE l.is_active = 1
      GROUP BY l.location_id, l.location_name
      ORDER BY l.location_name
    `;

    const locationStatsResult = await executeQuery(locationStatsQuery, {});

    logger.success('Bucket stats fetched', {
      total: totalStats.total_unassigned,
      locationCount: locationStatsResult.recordset.length,
    });

    return res.status(200).json(
      createResponse(true, 'Bucket stats fetched successfully', {
        total_unassigned: totalStats.total_unassigned || 0,
        no_location_count: totalStats.no_location_count || 0,
        user_location_id: userLocationId,
        locations: locationStatsResult.recordset
      })
    );
  } catch (error) {
    logger.error('Get bucket stats error', error);
    next(error);
  }
};


// ============================================
// SELF-ASSIGN TICKET FROM BUCKET
// ============================================
/**
 * Engineer picks up / self-assigns a ticket from the bucket
 * @route POST /api/v1/ticket-bucket/:id/self-assign
 * @access ENGINEER only (assigns req.user.user_id)
 * 
 * SECURITY CHECKS:
 * 1. User must be ENGINEER role
 * 2. Ticket must exist
 * 3. Ticket must be unassigned (assigned_to IS NULL)
 * 4. Ticket must NOT be in a final status
 * 5. Only assigns req.user.user_id (cannot specify another user)
 * 6. Engineer must be active
 * 7. Race condition protection via WHERE clause
 */
const selfAssignTicket = async (req, res, next) => {
  try {
    const ticketId = parseInt(req.params.id);
    const userId = req.user.user_id;
    const roleCode = req.user.role?.role_code || '';

    logger.separator('TICKET BUCKET - SELF ASSIGNMENT');
    logger.try('Engineer self-assigning ticket', {
      ticketId,
      userId,
      roleCode,
    });

    // SECURITY CHECK 1: Must be ENGINEER role
    if (roleCode !== 'ENGINEER') {
      logger.warn('Non-engineer attempted bucket self-assign', { userId, roleCode });
      logger.separator();
      return res.status(403).json(
        createResponse(false, 'Only engineers can self-assign tickets from the bucket')
      );
    }

    // SECURITY CHECK 2: Engineer must be active
    const engineerCheck = await executeQuery(
      `SELECT user_id, is_active, first_name + ' ' + last_name as full_name, email, location_id
       FROM users WHERE user_id = @userId`,
      { userId }
    );

    if (!engineerCheck.recordset.length || !engineerCheck.recordset[0].is_active) {
      logger.warn('Inactive or invalid engineer', { userId });
      logger.separator();
      return res.status(403).json(
        createResponse(false, 'Your account is not active')
      );
    }

    const engineer = engineerCheck.recordset[0];

    // SECURITY CHECK 3 & 4: Ticket must exist, be unassigned, and non-final
    const ticketCheck = await executeQuery(
      `SELECT 
        t.ticket_id, t.ticket_number, t.subject, t.assigned_to,
        t.requester_id, t.department_id, t.location_id,
        ts.status_code, ts.status_name, ts.is_final_status,
        tp.priority_name,
        t.due_date,
        u_req.email as requester_email,
        u_req.first_name + ' ' + u_req.last_name as requester_name
      FROM tickets t
      LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
      LEFT JOIN ticket_priorities tp ON t.priority_id = tp.priority_id
      LEFT JOIN users u_req ON t.requester_id = u_req.user_id
      WHERE t.ticket_id = @ticketId`,
      { ticketId }
    );

    if (!ticketCheck.recordset.length) {
      logger.warn('Ticket not found for bucket self-assign', { ticketId });
      logger.separator();
      return res.status(404).json(
        createResponse(false, 'Ticket not found')
      );
    }

    const ticket = ticketCheck.recordset[0];

    // Already assigned?
    if (ticket.assigned_to !== null) {
      logger.warn('Ticket already assigned — cannot self-assign', { ticketId, currentAssignee: ticket.assigned_to });
      logger.separator();
      return res.status(409).json(
        createResponse(false, 'This ticket has already been assigned to another engineer. Please refresh the bucket.')
      );
    }

    // Final status?
    if (ticket.is_final_status) {
      logger.warn('Ticket in final status — cannot self-assign', { ticketId, status: ticket.status_code });
      logger.separator();
      return res.status(400).json(
        createResponse(false, `Cannot pick up a ticket with status "${ticket.status_name}"`)
      );
    }

    // ============================================
    // RACE CONDITION PROTECTION
    // Use UPDATE ... WHERE assigned_to IS NULL
    // If another engineer grabbed it first, rowsAffected = 0
    // ============================================
    const updateResult = await executeQuery(
      `UPDATE tickets
       SET assigned_to = @userId,
           updated_at = GETDATE()
       WHERE ticket_id = @ticketId
         AND assigned_to IS NULL
         AND status_id IN (SELECT status_id FROM ticket_statuses WHERE is_final_status = 0)`,
      { ticketId, userId }
    );

    if (updateResult.rowsAffected[0] === 0) {
      logger.warn('Race condition: ticket was grabbed by another engineer', { ticketId });
      logger.separator();
      return res.status(409).json(
        createResponse(false, 'This ticket was just picked up by another engineer. Please refresh the bucket.')
      );
    }

    // ============================================
    // AUDIT TRAIL — Log self-assignment in ticket_activities
    // ============================================
    const activityQuery = `
      INSERT INTO ticket_activities (
        ticket_id, activity_type, field_name, old_value, new_value, description, performed_by
      )
      VALUES (
        @ticketId, 'SELF_ASSIGNED', 'assigned_to', 'Unassigned', @engineerName,
        @description, @userId
      )
    `;

    await executeQuery(activityQuery, {
      ticketId,
      engineerName: engineer.full_name?.trim() || 'Engineer',
      description: `${engineer.full_name?.trim() || 'Engineer'} picked up ticket #${ticket.ticket_number} from the open bucket`,
      userId,
    });

    // ============================================
    // NOTIFICATIONS — Notify requester
    // ============================================
    try {
      // In-app notification to requester
      if (ticket.requester_id && ticket.requester_id !== userId) {
        const notifQuery = `
          INSERT INTO notifications (
            user_id, notification_type, title, message, related_ticket_id
          )
          VALUES (
            @requesterId,
            'TICKET_ASSIGNED',
            'Your Ticket Has Been Picked Up',
            'Ticket #' + @ticketNumber + ' - ' + @subject + ' has been picked up by ' + @engineerName,
            @ticketId
          )
        `;

        await executeQuery(notifQuery, {
          requesterId: ticket.requester_id,
          ticketNumber: ticket.ticket_number,
          subject: ticket.subject,
          engineerName: engineer.full_name?.trim() || 'Engineer',
          ticketId,
        });
      }

      // Email notification
      const notificationSettings = await settingsService.getByCategory('notification');
      const emailEnabled = notificationSettings.notify_on_ticket_assigned === 'true' || notificationSettings.notify_on_ticket_assigned === true;

      if (emailEnabled && ticket.requester_email) {
        const generalSettings = await settingsService.getByCategory('general');
        const appUrl = getPublicAppUrl();
        const dueDateFormatted = ticket.due_date ? await dateUtils.formatDateTime(ticket.due_date) : 'Not set';

        await emailQueueService.queueEmail({
          to: ticket.requester_email,
          subject: `Your Ticket #${ticket.ticket_number} Has Been Picked Up`,
          template: 'ticket_assigned',
          context: {
            requesterName: ticket.requester_name?.trim() || 'User',
            ticketNumber: ticket.ticket_number,
            ticketSubject: ticket.subject,
            assigneeName: engineer.full_name?.trim() || 'Engineer',
            assignedBy: engineer.full_name?.trim() || 'Engineer',
            priority: ticket.priority_name || 'Normal',
            dueDate: dueDateFormatted,
            ticketUrl: `${appUrl}/tickets/${ticketId}`,
            systemName: generalSettings.system_name || 'IT Helpdesk',
          }
        });
      }

      // Email to engineer (self — confirmation)
      if (engineer.email) {
        const generalSettings = await settingsService.getByCategory('general');
        const appUrl = getPublicAppUrl();
        const dueDateFormatted = ticket.due_date ? await dateUtils.formatDateTime(ticket.due_date) : 'Not set';

        await emailQueueService.queueEmail({
          to: engineer.email,
          subject: `You Picked Up Ticket #${ticket.ticket_number}`,
          template: 'ticket_assigned',
          context: {
            requesterName: engineer.full_name?.trim() || 'Engineer',
            ticketNumber: ticket.ticket_number,
            ticketSubject: ticket.subject,
            assigneeName: engineer.full_name?.trim() || 'You',
            assignedBy: 'Self (Bucket Pick-up)',
            priority: ticket.priority_name || 'Normal',
            dueDate: dueDateFormatted,
            ticketUrl: `${appUrl}/tickets/${ticketId}`,
            systemName: generalSettings?.system_name || 'IT Helpdesk',
          }
        });
      }
    } catch (notifError) {
      // Notification failures should not block the assignment
      logger.warn('Notification failed for bucket self-assign', { ticketId, error: notifError.message });
    }

    logger.success('Ticket self-assigned from bucket', {
      ticketId,
      ticketNumber: ticket.ticket_number,
      engineerId: userId,
      engineerName: engineer.full_name,
    });
    logger.separator();

    return res.status(200).json(
      createResponse(true, `Ticket #${ticket.ticket_number} has been assigned to you successfully`, {
        ticket_id: ticketId,
        ticket_number: ticket.ticket_number,
        assigned_to: userId,
        assigned_to_name: engineer.full_name?.trim(),
      })
    );
  } catch (error) {
    logger.error('Bucket self-assign error', error);
    logger.separator();
    next(error);
  }
};


// ============================================
// EXPORTS
// ============================================
module.exports = {
  getBucketTickets,
  getBucketStats,
  selfAssignTicket,
};

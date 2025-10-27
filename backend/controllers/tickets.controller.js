// ============================================
// Tickets Controller - FIXED VERSION
// Fixed: Changed getAllSettings() to getByCategory()
// ============================================

const { executeQuery } = require('../config/database');
const { createResponse, getPaginationMeta } = require('../utils/helpers');
const logger = require('../utils/logger');
const sql = require('mssql');
const settingsService = require('../services/settings.service');
const emailQueueService = require('../services/emailQueue.service');

/**
 * Get all tickets with pagination and filters
 * @route GET /api/v1/tickets
 * @access Private
 */
const getTickets = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const status_id = req.query.status_id || null;
    const priority_id = req.query.priority_id || null;
    const category_id = req.query.category_id || null;
    const assigned_to = req.query.assigned_to || null;
    const requester_id = req.query.requester_id || null;
    const department_id = req.query.department_id || null;

    const offset = (page - 1) * limit;
    
    const canViewAll = req.user.permissions?.can_view_all_tickets || false;
    const userId = req.user.user_id;

    logger.try('Fetching tickets list', {
      userId,
      canViewAll,
      page,
      limit,
      filters: { status_id, priority_id, category_id },
    });

    // Build WHERE clause based on permissions
    let whereConditions = [];
    let params = {};

    if (!canViewAll) {
      whereConditions.push('(t.requester_id = @userId OR t.assigned_to = @userId)');
      params.userId = userId;
    }

    if (search) {
      whereConditions.push(`(
        t.ticket_number LIKE '%' + @search + '%' OR 
        t.subject LIKE '%' + @search + '%' OR 
        t.description LIKE '%' + @search + '%'
      )`);
      params.search = search;
    }

    if (status_id) {
      whereConditions.push('t.status_id = @statusId');
      params.statusId = status_id;
    }

    if (priority_id) {
      whereConditions.push('t.priority_id = @priorityId');
      params.priorityId = priority_id;
    }

    if (category_id) {
      whereConditions.push('t.category_id = @categoryId');
      params.categoryId = category_id;
    }

    if (assigned_to) {
      whereConditions.push('t.assigned_to = @assignedTo');
      params.assignedTo = assigned_to;
    }

    if (requester_id) {
      whereConditions.push('t.requester_id = @requesterId');
      params.requesterId = requester_id;
    }

    if (department_id) {
      whereConditions.push('t.department_id = @departmentId');
      params.departmentId = department_id;
    }

    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM tickets t
      ${whereClause}
    `;

    const countResult = await executeQuery(countQuery, params);
    const totalRecords = countResult.recordset[0].total;

    // Get paginated tickets
    const ticketsQuery = `
      SELECT 
        t.ticket_id,
        t.ticket_number,
        t.subject,
        t.description,
        t.created_at,
        t.updated_at,
        t.due_date,
        t.resolved_at,
        t.closed_at,
        t.is_escalated,
        
        tc.category_id,
        tc.category_name,
        tc.category_code,
        
        tp.priority_id,
        tp.priority_name,
        tp.priority_code,
        tp.priority_level,
        tp.color_code as priority_color,
        
        ts.status_id,
        ts.status_name,
        ts.status_code,
        ts.status_type,
        ts.color_code as status_color,
        
        t.requester_id,
        u_req.username as requester_username,
        u_req.first_name + ' ' + u_req.last_name as requester_name,
        
        t.assigned_to as assigned_to_id,
        u_eng.username as assigned_to_username,
        u_eng.first_name + ' ' + u_eng.last_name as assigned_to_name,
        
        d.department_id,
        d.department_name,
        
        (SELECT COUNT(*) FROM ticket_comments WHERE ticket_id = t.ticket_id) as comments_count,
        (SELECT COUNT(*) FROM ticket_attachments WHERE ticket_id = t.ticket_id) as attachments_count
        
      FROM tickets t
      LEFT JOIN ticket_categories tc ON t.category_id = tc.category_id
      LEFT JOIN ticket_priorities tp ON t.priority_id = tp.priority_id
      LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
      LEFT JOIN users u_req ON t.requester_id = u_req.user_id
      LEFT JOIN users u_eng ON t.assigned_to = u_eng.user_id
      LEFT JOIN departments d ON t.department_id = d.department_id
      ${whereClause}
      ORDER BY t.created_at DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `;

    const ticketsResult = await executeQuery(ticketsQuery, {
      ...params,
      offset,
      limit,
    });

    const paginationMeta = getPaginationMeta(totalRecords, page, limit);

    logger.success('Tickets fetched successfully', {
      totalRecords,
      returnedRecords: ticketsResult.recordset.length,
      page,
    });

    return res.status(200).json({
      success: true,
      message: 'Tickets fetched successfully',
      data: {
        tickets: ticketsResult.recordset,
        pagination: paginationMeta
      }
    });
  } catch (error) {
    logger.error('Get tickets error', error);
    next(error);
  }
};

/**
 * Get single ticket by ID
 * @route GET /api/v1/tickets/:id
 * @access Private
 */
const getTicketById = async (req, res, next) => {
  try {
    const ticketId = req.params.id;
    const userId = req.user.user_id;
    
    const canViewAll = req.user.permissions?.can_view_all_tickets || false;

    logger.try('Fetching ticket details', {
      ticketId,
      userId,
      canViewAll,
    });

    const query = `
      SELECT 
        t.ticket_id,
        t.ticket_number,
        t.subject,
        t.subject as title,
        t.description,
        t.resolution_notes,
        t.created_at,
        t.updated_at,
        t.due_date,
        t.resolved_at,
        t.closed_at,
        t.is_escalated,
        t.escalated_at,
        t.escalation_reason,
        t.rating,
        t.feedback,
        t.first_response_at,
        t.first_response_sla_met,
        t.resolution_sla_met,
        
        tc.category_id,
        tc.category_name,
        tc.category_code,
        tc.sla_hours,
        
        tp.priority_id,
        tp.priority_name,
        tp.priority_code,
        tp.priority_level,
        tp.color_code as priority_color,
        tp.response_time_hours,
        tp.resolution_time_hours,
        
        ts.status_id,
        ts.status_name,
        ts.status_code,
        ts.status_type,
        ts.color_code as status_color,
        ts.is_final_status,
        
        t.requester_id,
        u_req.username as requester_username,
        u_req.email as requester_email,
        u_req.first_name + ' ' + u_req.last_name as requester_name,
        u_req.phone_number as requester_phone,
        
        t.assigned_to as assigned_to_id,
        u_eng.username as assigned_to_username,
        u_eng.email as assigned_to_email,
        u_eng.first_name + ' ' + u_eng.last_name as assigned_to_name,
        
        t.escalated_to as escalated_to_id,
        u_esc.first_name + ' ' + u_esc.last_name as escalated_to_name,
        
        d.department_id,
        d.department_name,
        d.department_code,
        
        u_creator.first_name + ' ' + u_creator.last_name as created_by_name
        
      FROM tickets t
      LEFT JOIN ticket_categories tc ON t.category_id = tc.category_id
      LEFT JOIN ticket_priorities tp ON t.priority_id = tp.priority_id
      LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
      LEFT JOIN users u_req ON t.requester_id = u_req.user_id
      LEFT JOIN users u_eng ON t.assigned_to = u_eng.user_id
      LEFT JOIN users u_esc ON t.escalated_to = u_esc.user_id
      LEFT JOIN departments d ON t.department_id = d.department_id
      LEFT JOIN users u_creator ON t.created_by = u_creator.user_id
      WHERE t.ticket_id = @ticketId
    `;

    const result = await executeQuery(query, { ticketId });

    if (result.recordset.length === 0) {
      logger.warn('Ticket not found', { ticketId });
      return res.status(404).json(
        createResponse(false, 'Ticket not found')
      );
    }

    const ticket = result.recordset[0];

    // Check permission
    if (!canViewAll && 
        ticket.requester_id !== userId && 
        ticket.assigned_to_id !== userId) {
      logger.warn('Unauthorized ticket access attempt', {
        ticketId,
        userId,
      });
      return res.status(403).json(
        createResponse(false, 'You do not have permission to view this ticket')
      );
    }

    // Get ticket attachments
    const attachmentsQuery = `
      SELECT 
        attachment_id,
        file_name,
        file_path,
        file_size_kb,
        file_type,
        uploaded_by,
        uploaded_at,
        u.first_name + ' ' + u.last_name as uploaded_by_name
      FROM ticket_attachments ta
      LEFT JOIN users u ON ta.uploaded_by = u.user_id
      WHERE ta.ticket_id = @ticketId
      ORDER BY ta.uploaded_at DESC
    `;

    const attachmentsResult = await executeQuery(attachmentsQuery, { ticketId });

    // Get ticket comments
    const commentsQuery = `
      SELECT 
        comment_id,
        comment_text,
        is_internal,
        commented_at,
        edited_at,
        u.user_id as commenter_id,
        u.first_name + ' ' + u.last_name as commenter_name,
        r.role_name as commenter_role
      FROM ticket_comments tc
      LEFT JOIN users u ON tc.commented_by = u.user_id
      LEFT JOIN user_roles r ON u.role_id = r.role_id
      WHERE tc.ticket_id = @ticketId 
        AND tc.is_deleted = 0
      ORDER BY tc.commented_at ASC
    `;

    const commentsResult = await executeQuery(commentsQuery, { ticketId });

    // Get ticket activities
    const activitiesQuery = `
      SELECT 
        activity_id,
        activity_type,
        field_name,
        old_value,
        new_value,
        description,
        performed_at,
        u.first_name + ' ' + u.last_name as performed_by_name
      FROM ticket_activities ta
      LEFT JOIN users u ON ta.performed_by = u.user_id
      WHERE ta.ticket_id = @ticketId
      ORDER BY ta.performed_at DESC
    `;

    const activitiesResult = await executeQuery(activitiesQuery, { ticketId });

    const ticketData = {
      ...ticket,
      attachments: attachmentsResult.recordset,
      comments: commentsResult.recordset,
      activities: activitiesResult.recordset,
    };

    logger.success('Ticket details fetched successfully', {
      ticketId,
      ticketNumber: ticket.ticket_number,
    });

    return res.status(200).json(
      createResponse(true, 'Ticket fetched successfully', ticketData)
    );
  } catch (error) {
    logger.error('Get ticket by ID error', error);
    next(error);
  }
};

/**
 * Create new ticket
 * @route POST /api/v1/tickets
 * @access Private
 */
const createTicket = async (req, res, next) => {
  try {
    const {
      subject,
      description,
      category_id,
      priority_id,
      department_id,
    } = req.body;

    const userId = req.user.user_id;

    logger.separator('TICKET CREATION');
    logger.try('Creating new ticket', {
      subject,
      categoryId: category_id,
      priorityId: priority_id,
      createdBy: userId,
    });

    // Generate unique ticket number
    logger.try('Generating unique ticket number');
    
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    
    const seqQuery = `
      SELECT ISNULL(MAX(CAST(RIGHT(ticket_number, 4) AS INT)), 0) + 1 AS next_seq
      FROM tickets
      WHERE ticket_number LIKE 'TKT-${dateStr}-%'
    `;
    
    const seqResult = await executeQuery(seqQuery);
    const sequence = seqResult.recordset[0].next_seq;
    const ticketNumber = `TKT-${dateStr}-${String(sequence).padStart(4, '0')}`;
    
    logger.success('Ticket number generated', { ticketNumber });

    // Get default status (Open)
    const statusQuery = `
      SELECT status_id 
      FROM ticket_statuses 
      WHERE status_code = 'OPEN' AND is_active = 1
    `;
    
    const statusResult = await executeQuery(statusQuery);
    const statusId = statusResult.recordset[0].status_id;

    // Calculate due date based on priority SLA
    const priorityQuery = `
      SELECT resolution_time_hours 
      FROM ticket_priorities 
      WHERE priority_id = @priorityId
    `;
    
    const priorityResult = await executeQuery(priorityQuery, { priorityId: priority_id });
    const slaHours = priorityResult.recordset[0].resolution_time_hours;

    // Insert ticket
    logger.try('Inserting ticket into database');
    
    const insertQuery = `
      INSERT INTO tickets (
        ticket_number, subject, description,
        category_id, priority_id, status_id,
        requester_id, department_id, due_date,
        created_by
      )
      OUTPUT INSERTED.ticket_id
      VALUES (
        @ticketNumber, @subject, @description,
        @categoryId, @priorityId, @statusId,
        @requesterId, @departmentId, DATEADD(HOUR, @slaHours, GETDATE()),
        @createdBy
      )
    `;

    const insertResult = await executeQuery(insertQuery, {
      ticketNumber,
      subject,
      description,
      categoryId: category_id,
      priorityId: priority_id,
      statusId,
      requesterId: userId,
      departmentId: department_id || null,
      slaHours,
      createdBy: userId,
    });

    const ticketId = insertResult.recordset[0].ticket_id;

    logger.success('Ticket inserted successfully', {
      ticketId,
      ticketNumber,
    });

    // Log ticket creation activity
    logger.try('Logging ticket creation activity');
    
    const activityQuery = `
      INSERT INTO ticket_activities (
        ticket_id, activity_type, description, performed_by
      )
      VALUES (@ticketId, 'CREATED', 'Ticket created', @userId)
    `;
    
    await executeQuery(activityQuery, { ticketId, userId });

    logger.success('Activity logged');

    // Create notification for admins/managers
    logger.try('Creating notification for administrators');
    
    const notificationQuery = `
      INSERT INTO notifications (
        user_id, notification_type, title, message, related_ticket_id
      )
      SELECT 
        u.user_id,
        'TICKET_CREATED',
        'New Ticket Created',
        'Ticket #' + @ticketNumber + ' - ' + @subject,
        @ticketId
      FROM users u
      INNER JOIN user_roles r ON u.role_id = r.role_id
      WHERE r.role_code IN ('ADMIN', 'MANAGER') 
        AND u.is_active = 1
        AND u.user_id != @userId
    `;
    
    await executeQuery(notificationQuery, {
      ticketNumber,
      subject,
      ticketId,
      userId,
    });

    logger.success('Notifications created');

    // ✅ FIXED: Send email to admins/managers
    try {
      logger.try('Sending ticket creation emails');

      // ✅ FIXED: Use getByCategory instead of getAllSettings
      const emailSettings = await settingsService.getByCategory('email');
      const notificationSettings = await settingsService.getByCategory('notification');
      const generalSettings = await settingsService.getByCategory('general');

      if (notificationSettings.notify_on_ticket_created !== 'false' && notificationSettings.notify_on_ticket_created !== false) {
        const adminQuery = `
          SELECT u.user_id, u.email, u.first_name + ' ' + u.last_name as full_name
          FROM users u
          INNER JOIN user_roles r ON u.role_id = r.role_id
          WHERE r.role_code IN ('ADMIN', 'MANAGER')
            AND u.is_active = 1
            AND u.email IS NOT NULL
            AND u.user_id != @userId
        `;

        const admins = await executeQuery(adminQuery, { userId });

        const ticketDetailsQuery = `
          SELECT 
            t.ticket_id,
            t.ticket_number,
            t.subject,
            t.description,
            tp.priority_name,
            tc.category_name,
            u.first_name + ' ' + u.last_name as requester_name,
            u.email as requester_email,
            t.created_at
          FROM tickets t
          LEFT JOIN ticket_priorities tp ON t.priority_id = tp.priority_id
          LEFT JOIN ticket_categories tc ON t.category_id = tc.category_id
          LEFT JOIN users u ON t.requester_id = u.user_id
          WHERE t.ticket_id = @ticketId
        `;

        const ticketDetails = await executeQuery(ticketDetailsQuery, { ticketId });
        const ticket = ticketDetails.recordset[0];

        const appUrl = process.env.APP_URL || 'http://localhost:5173';

        for (const admin of admins.recordset) {
          await emailQueueService.sendTemplatedEmail(
            'TICKET_CREATED',
            admin.email,
            {
              ticket_number: ticketNumber,
              subject: ticket.subject,
              description: ticket.description,
              priority: ticket.priority_name,
              category: ticket.category_name,
              requester_name: ticket.requester_name,
              requester_email: ticket.requester_email,
              created_at: new Date(ticket.created_at).toLocaleString(),
              ticket_url: `${appUrl}/tickets/${ticketId}`,
              system_name: generalSettings.system_name || 'IT Helpdesk'
            },
            {
              recipientName: admin.full_name,
              recipientUserId: admin.user_id,
              emailType: 'TICKET_CREATED',
              relatedEntityType: 'TICKET',
              relatedEntityId: ticketId,
              priority: 2
            }
          );
        }

        logger.success(`Ticket creation emails queued for ${admins.recordset.length} admin(s)/manager(s)`);
      } else {
        logger.info('Ticket creation email notifications disabled in settings');
      }
    } catch (emailError) {
      logger.error('Failed to send ticket creation emails', emailError);
    }

    logger.separator('TICKET CREATED SUCCESSFULLY');
    logger.success('New ticket created', {
      ticketId,
      ticketNumber,
      subject,
    });
    logger.separator();

    return res.status(201).json(
      createResponse(true, 'Ticket created successfully', {
        ticket_id: ticketId,
        ticket_number: ticketNumber,
      })
    );
  } catch (error) {
    logger.error('Create ticket error', error);
    logger.separator();
    next(error);
  }
};

/**
 * Update ticket
 * @route PUT /api/v1/tickets/:id
 * @access Private
 */
const updateTicket = async (req, res, next) => {
  try {
    const ticketId = req.params.id;
    const userId = req.user.user_id;
    
    const canAssign = req.user.permissions?.can_assign_tickets || false;
    const canClose = req.user.permissions?.can_close_tickets || false;

    logger.separator('TICKET UPDATE');
    logger.try('Updating ticket', {
      ticketId,
      updatedBy: userId,
      canAssign,
      canClose,
    });

    const {
      subject,
      description,
      category_id,
      priority_id,
      status_id,
      assigned_to,
      department_id,
      resolution_notes,
    } = req.body;

    // Check if ticket exists
    const ticketCheck = await executeQuery(
      'SELECT ticket_id, requester_id, assigned_to, status_id FROM tickets WHERE ticket_id = @ticketId',
      { ticketId }
    );

    if (ticketCheck.recordset.length === 0) {
      logger.warn('Ticket not found', { ticketId });
      logger.separator();
      return res.status(404).json(
        createResponse(false, 'Ticket not found')
      );
    }

    const ticket = ticketCheck.recordset[0];
    const oldStatusId = ticket.status_id;

    // Check permission
    const isOwner = ticket.requester_id === userId;
    const isAssigned = ticket.assigned_to === userId;

    if (!isOwner && !isAssigned && !canAssign) {
      logger.warn('Unauthorized update attempt', {
        ticketId,
        userId,
      });
      logger.separator();
      return res.status(403).json(
        createResponse(false, 'You do not have permission to update this ticket')
      );
    }

    // Build update query
    const updateFields = [];
    const params = { ticketId };

    if (subject !== undefined) {
      updateFields.push('subject = @subject');
      params.subject = subject;
    }
    if (description !== undefined) {
      updateFields.push('description = @description');
      params.description = description;
    }
    if (category_id !== undefined) {
      updateFields.push('category_id = @categoryId');
      params.categoryId = category_id;
    }
    if (priority_id !== undefined) {
      updateFields.push('priority_id = @priorityId');
      params.priorityId = priority_id;
    }
    if (status_id !== undefined) {
      updateFields.push('status_id = @statusId');
      params.statusId = status_id;
    }
    if (assigned_to !== undefined && canAssign) {
      updateFields.push('assigned_to = @assignedTo');
      params.assignedTo = assigned_to || null;
    }
    if (department_id !== undefined) {
      updateFields.push('department_id = @departmentId');
      params.departmentId = department_id || null;
    }
    if (resolution_notes !== undefined) {
      updateFields.push('resolution_notes = @resolutionNotes');
      params.resolutionNotes = resolution_notes;
    }

    if (updateFields.length === 0) {
      logger.warn('No fields to update');
      logger.separator();
      return res.status(400).json(
        createResponse(false, 'No fields to update')
      );
    }

    updateFields.push('updated_at = GETDATE()');

    const updateQuery = `
      UPDATE tickets
      SET ${updateFields.join(', ')}
      WHERE ticket_id = @ticketId
    `;

    await executeQuery(updateQuery, params);

    // Log activity
    const activityQuery = `
      INSERT INTO ticket_activities (
        ticket_id, activity_type, description, performed_by
      )
      VALUES (@ticketId, 'UPDATED', 'Ticket updated', @userId)
    `;
    
    await executeQuery(activityQuery, { ticketId, userId });

    // ✅ FIXED: Send email if status changed
    if (status_id !== undefined && status_id !== oldStatusId) {
      try {
        logger.try('Sending status change email');

        // ✅ FIXED: Use getByCategory instead of getAllSettings
        const notificationSettings = await settingsService.getByCategory('notification');
        const generalSettings = await settingsService.getByCategory('general');

        if (notificationSettings.notify_on_ticket_updated !== 'false' && notificationSettings.notify_on_ticket_updated !== false) {
          const statusQuery = `
            SELECT 
              t.ticket_number,
              t.subject,
              t.requester_id,
              old_status.status_name as old_status_name,
              new_status.status_name as new_status_name,
              requester.email as requester_email,
              requester.first_name + ' ' + requester.last_name as requester_name,
              updater.first_name + ' ' + updater.last_name as updated_by_name
            FROM tickets t
            LEFT JOIN ticket_statuses old_status ON old_status.status_id = @oldStatusId
            LEFT JOIN ticket_statuses new_status ON new_status.status_id = @newStatusId
            LEFT JOIN users requester ON t.requester_id = requester.user_id
            LEFT JOIN users updater ON updater.user_id = @userId
            WHERE t.ticket_id = @ticketId
          `;

          const statusResult = await executeQuery(statusQuery, {
            ticketId,
            oldStatusId,
            newStatusId: status_id,
            userId,
          });

          if (statusResult.recordset.length > 0 && statusResult.recordset[0].requester_email) {
            const statusInfo = statusResult.recordset[0];
            const appUrl = process.env.APP_URL || 'http://localhost:5173';

            await emailQueueService.sendTemplatedEmail(
              'TICKET_STATUS_CHANGED',
              statusInfo.requester_email,
              {
                ticket_number: statusInfo.ticket_number,
                subject: statusInfo.subject,
                old_status: statusInfo.old_status_name,
                new_status: statusInfo.new_status_name,
                updated_by_name: statusInfo.updated_by_name,
                ticket_url: `${appUrl}/tickets/${ticketId}`,
                system_name: generalSettings.system_name || 'IT Helpdesk'
              },
              {
                recipientName: statusInfo.requester_name,
                recipientUserId: statusInfo.requester_id,
                emailType: 'TICKET_STATUS_CHANGED',
                relatedEntityType: 'TICKET',
                relatedEntityId: ticketId,
                priority: 3
              }
            );

            logger.success('Status change email queued');
          }
        }
      } catch (emailError) {
        logger.error('Failed to send status change email', emailError);
      }
    }

    logger.success('Ticket updated successfully', { ticketId });
    logger.separator();

    return res.status(200).json(
      createResponse(true, 'Ticket updated successfully')
    );
  } catch (error) {
    logger.error('Update ticket error', error);
    logger.separator();
    next(error);
  }
};

/**
 * Assign ticket to engineer
 * @route PATCH /api/v1/tickets/:id/assign
 * @access Private (Manager/Admin only)
 */
const assignTicket = async (req, res, next) => {
  try {
    const ticketId = req.params.id;
    const { assigned_to } = req.body;
    const userId = req.user.user_id;

    logger.separator('TICKET ASSIGNMENT');
    logger.try('Assigning ticket', {
      ticketId,
      assignedTo: assigned_to,
      userId,
    });

    // Check permission
    const canAssign = req.user.permissions?.can_assign_tickets || false;

    if (!canAssign) {
      logger.warn('Unauthorized assignment attempt', {
        userId,
        hasPermissions: !!req.user.permissions,
        canAssign: req.user.permissions?.can_assign_tickets
      });
      logger.separator();
      return res.status(403).json(
        createResponse(false, 'You do not have permission to assign tickets')
      );
    }

    // Check if ticket exists
    const ticketCheck = await executeQuery(
      `SELECT 
        ticket_id, 
        ticket_number, 
        subject,
        assigned_to as current_assigned_to,
        requester_id,
        status_id
      FROM tickets 
      WHERE ticket_id = @ticketId`,
      { ticketId }
    );

    if (ticketCheck.recordset.length === 0) {
      logger.warn('Ticket not found', { ticketId });
      logger.separator();
      return res.status(404).json(
        createResponse(false, 'Ticket not found')
      );
    }

    const ticket = ticketCheck.recordset[0];

    // Validate assigned_to user exists (if provided)
    if (assigned_to) {
      const engineerCheck = await executeQuery(
        `SELECT 
          u.user_id, 
          u.first_name, 
          u.last_name,
          u.is_active
        FROM users u
        WHERE u.user_id = @userId`,
        { userId: assigned_to }
      );

      if (engineerCheck.recordset.length === 0) {
        logger.warn('Invalid engineer', { assigned_to });
        logger.separator();
        return res.status(400).json(
          createResponse(false, 'Invalid engineer. User not found.')
        );
      }

      if (!engineerCheck.recordset[0].is_active) {
        logger.warn('Inactive engineer', { assigned_to });
        logger.separator();
        return res.status(400).json(
          createResponse(false, 'Cannot assign to inactive user.')
        );
      }
    }

    // Update ticket assignment
    const updateQuery = `
      UPDATE tickets
      SET 
        assigned_to = @assignedTo,
        updated_at = GETDATE()
      WHERE ticket_id = @ticketId
    `;

    await executeQuery(updateQuery, {
      ticketId,
      assignedTo: assigned_to || null,
    });

    logger.success('Ticket assignment updated');

    // Log activity
    const activityDescription = assigned_to 
      ? `Ticket assigned to engineer` 
      : `Engineer unassigned from ticket`;

    const activityQuery = `
      INSERT INTO ticket_activities (
        ticket_id, 
        activity_type, 
        description, 
        performed_by,
        new_value
      )
      VALUES (
        @ticketId, 
        'ASSIGNED', 
        @description, 
        @userId,
        @newValue
      )
    `;

    await executeQuery(activityQuery, {
      ticketId,
      description: activityDescription,
      userId,
      newValue: assigned_to ? assigned_to.toString() : null,
    });

    logger.success('Activity logged');

    // Create notification for assigned engineer
    if (assigned_to && assigned_to !== userId) {
      const notificationQuery = `
        INSERT INTO notifications (
          user_id, 
          notification_type, 
          title, 
          message, 
          related_ticket_id
        )
        VALUES (
          @assignedTo,
          'TICKET_ASSIGNED',
          'Ticket Assigned to You',
          'Ticket #' + @ticketNumber + ' - ' + @subject,
          @ticketId
        )
      `;

      await executeQuery(notificationQuery, {
        assignedTo: assigned_to,
        ticketNumber: ticket.ticket_number,
        subject: ticket.subject,
        ticketId,
      });

      logger.success('Notification sent to assigned engineer');

      // ✅ FIXED: Send email to assigned engineer
      try {
        logger.try('Sending ticket assignment email');

        // ✅ FIXED: Use getByCategory instead of getAllSettings
        const notificationSettings = await settingsService.getByCategory('notification');
        const generalSettings = await settingsService.getByCategory('general');

        if (notificationSettings.notify_on_ticket_assigned !== 'false' && notificationSettings.notify_on_ticket_assigned !== false) {
          const engineerQuery = `
            SELECT u.email, u.first_name + ' ' + u.last_name as full_name
            FROM users u
            WHERE u.user_id = @assignedTo AND u.email IS NOT NULL
          `;

          const engineerResult = await executeQuery(engineerQuery, { assignedTo: assigned_to });

          if (engineerResult.recordset.length > 0) {
            const engineer = engineerResult.recordset[0];

            const ticketDetailsQuery = `
              SELECT 
                t.ticket_number,
                t.subject,
                tp.priority_name,
                t.due_date
              FROM tickets t
              LEFT JOIN ticket_priorities tp ON t.priority_id = tp.priority_id
              WHERE t.ticket_id = @ticketId
            `;

            const ticketDetails = await executeQuery(ticketDetailsQuery, { ticketId });
            const ticketInfo = ticketDetails.recordset[0];

            const appUrl = process.env.APP_URL || 'http://localhost:5173';

            await emailQueueService.sendTemplatedEmail(
              'TICKET_ASSIGNED',
              engineer.email,
              {
                ticket_number: ticketInfo.ticket_number,
                subject: ticketInfo.subject,
                priority: ticketInfo.priority_name,
                due_date: ticketInfo.due_date ? new Date(ticketInfo.due_date).toLocaleString() : 'Not set',
                assigned_to_name: engineer.full_name,
                ticket_url: `${appUrl}/tickets/${ticketId}`,
                system_name: generalSettings.system_name || 'IT Helpdesk'
              },
              {
                recipientName: engineer.full_name,
                recipientUserId: assigned_to,
                emailType: 'TICKET_ASSIGNED',
                relatedEntityType: 'TICKET',
                relatedEntityId: ticketId,
                priority: 2
              }
            );

            logger.success('Ticket assignment email queued');
          }
        }
      } catch (emailError) {
        logger.error('Failed to send ticket assignment email', emailError);
      }
    }

    logger.separator('TICKET ASSIGNED SUCCESSFULLY');
    logger.success('Assignment completed', {
      ticketId,
      ticketNumber: ticket.ticket_number,
      assignedTo: assigned_to,
    });
    logger.separator();

    return res.status(200).json(
      createResponse(true, 'Ticket assigned successfully', {
        ticket_id: parseInt(ticketId),
        assigned_to: assigned_to || null,
      })
    );
  } catch (error) {
    logger.error('Assign ticket error', error);
    logger.separator();
    next(error);
  }
};

/**
 * Add comment to ticket
 * @route POST /api/v1/tickets/:id/comments
 * @access Private
 */
const addComment = async (req, res, next) => {
  try {
    const ticketId = req.params.id;
    const { comment_text, is_internal } = req.body;
    const userId = req.user.user_id;

    logger.try('Adding comment to ticket', { ticketId, userId });

    if (!comment_text || comment_text.trim().length === 0) {
      return res.status(400).json(
        createResponse(false, 'Comment text is required')
      );
    }

    // Check if ticket exists
    const ticketCheck = await executeQuery(
      'SELECT ticket_id, ticket_number FROM tickets WHERE ticket_id = @ticketId',
      { ticketId }
    );

    if (ticketCheck.recordset.length === 0) {
      return res.status(404).json(
        createResponse(false, 'Ticket not found')
      );
    }

    // Insert comment
    const insertQuery = `
      INSERT INTO ticket_comments (
        ticket_id, comment_text, is_internal, commented_by
      )
      OUTPUT INSERTED.comment_id
      VALUES (@ticketId, @commentText, @isInternal, @userId)
    `;

    const result = await executeQuery(insertQuery, {
      ticketId,
      commentText: comment_text,
      isInternal: is_internal || false,
      userId,
    });

    const commentId = result.recordset[0].comment_id;

    logger.success('Comment added successfully');

    // Log activity
    const activityQuery = `
      INSERT INTO ticket_activities (
        ticket_id, activity_type, description, performed_by
      )
      VALUES (@ticketId, 'COMMENTED', 'Comment added', @userId)
    `;

    await executeQuery(activityQuery, { ticketId, userId });

    // ✅ FIXED: Send email to requester and assigned engineer
    try {
      logger.try('Sending comment notification emails');

      // ✅ FIXED: Use getByCategory instead of getAllSettings
      const notificationSettings = await settingsService.getByCategory('notification');
      const generalSettings = await settingsService.getByCategory('general');

      if (notificationSettings.notify_on_ticket_commented !== 'false' && notificationSettings.notify_on_ticket_commented !== false) {
        const commentDetailsQuery = `
          SELECT 
            t.ticket_number,
            t.requester_id,
            t.assigned_to,
            requester.email as requester_email,
            requester.first_name + ' ' + requester.last_name as requester_name,
            engineer.email as engineer_email,
            engineer.first_name + ' ' + engineer.last_name as engineer_name,
            commenter.first_name + ' ' + commenter.last_name as commenter_name
          FROM tickets t
          LEFT JOIN users requester ON t.requester_id = requester.user_id
          LEFT JOIN users engineer ON t.assigned_to = engineer.user_id
          LEFT JOIN users commenter ON commenter.user_id = @userId
          WHERE t.ticket_id = @ticketId
        `;

        const commentDetails = await executeQuery(commentDetailsQuery, { ticketId, userId });

        if (commentDetails.recordset.length > 0) {
          const details = commentDetails.recordset[0];
          const appUrl = process.env.APP_URL || 'http://localhost:5173';

          // Send to requester (if not the commenter)
          if (details.requester_id !== userId && details.requester_email) {
            await emailQueueService.sendTemplatedEmail(
              'TICKET_COMMENT_ADDED',
              details.requester_email,
              {
                ticket_number: details.ticket_number,
                commenter_name: details.commenter_name,
                comment_text: comment_text.substring(0, 200) + (comment_text.length > 200 ? '...' : ''),
                ticket_url: `${appUrl}/tickets/${ticketId}`,
                system_name: generalSettings.system_name || 'IT Helpdesk'
              },
              {
                recipientName: details.requester_name,
                recipientUserId: details.requester_id,
                emailType: 'TICKET_COMMENT_ADDED',
                relatedEntityType: 'TICKET',
                relatedEntityId: ticketId,
                priority: 3
              }
            );
          }

          // Send to assigned engineer (if exists and not the commenter)
          if (details.assigned_to && details.assigned_to !== userId && details.engineer_email) {
            await emailQueueService.sendTemplatedEmail(
              'TICKET_COMMENT_ADDED',
              details.engineer_email,
              {
                ticket_number: details.ticket_number,
                commenter_name: details.commenter_name,
                comment_text: comment_text.substring(0, 200) + (comment_text.length > 200 ? '...' : ''),
                ticket_url: `${appUrl}/tickets/${ticketId}`,
                system_name: generalSettings.system_name || 'IT Helpdesk'
              },
              {
                recipientName: details.engineer_name,
                recipientUserId: details.assigned_to,
                emailType: 'TICKET_COMMENT_ADDED',
                relatedEntityType: 'TICKET',
                relatedEntityId: ticketId,
                priority: 3
              }
            );
          }

          logger.success('Comment notification emails queued');
        }
      }
    } catch (emailError) {
      logger.error('Failed to send comment notification emails', emailError);
    }

    logger.success('Comment added successfully', {
      ticketId,
      commentId,
    });

    return res.status(201).json(
      createResponse(true, 'Comment added successfully', {
        comment_id: commentId,
      })
    );
  } catch (error) {
    logger.error('Add comment error', error);
    next(error);
  }
};

/**
 * Delete ticket
 * @route DELETE /api/v1/tickets/:id
 * @access Private (Admin only)
 */
const deleteTicket = async (req, res, next) => {
  let transaction = null;
  
  try {
    const ticketId = req.params.id;
    const userId = req.user.user_id;

    logger.separator('TICKET DELETION');
    logger.try('Deleting ticket', {
      ticketId,
      deletedBy: userId,
    });

    if (!req.user.permissions || !req.user.permissions.can_delete_tickets) {
      logger.warn('Unauthorized deletion attempt', {
        userId,
        ticketId,
      });
      logger.separator();
      return res.status(403).json(
        createResponse(false, 'You do not have permission to delete tickets')
      );
    }

    // Check if ticket exists
    const ticketCheck = await executeQuery(
      'SELECT ticket_id, ticket_number, subject FROM tickets WHERE ticket_id = @ticketId',
      { ticketId }
    );

    if (ticketCheck.recordset.length === 0) {
      logger.warn('Ticket not found', { ticketId });
      logger.separator();
      return res.status(404).json(
        createResponse(false, 'Ticket not found')
      );
    }

    const ticket = ticketCheck.recordset[0];

    // Begin transaction
    const pool = await require('../config/database').getPool();
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    logger.try('Transaction started');

    // Delete related records
    const deleteCommentsRequest = new sql.Request(transaction);
    deleteCommentsRequest.input('ticketId', sql.Int, ticketId);
    await deleteCommentsRequest.query('DELETE FROM ticket_comments WHERE ticket_id = @ticketId');
    logger.success('Comments deleted');

    const deleteAttachmentsRequest = new sql.Request(transaction);
    deleteAttachmentsRequest.input('ticketId', sql.Int, ticketId);
    await deleteAttachmentsRequest.query('DELETE FROM ticket_attachments WHERE ticket_id = @ticketId');
    logger.success('Attachments deleted');

    const deleteActivitiesRequest = new sql.Request(transaction);
    deleteActivitiesRequest.input('ticketId', sql.Int, ticketId);
    await deleteActivitiesRequest.query('DELETE FROM ticket_activities WHERE ticket_id = @ticketId');
    logger.success('Activities deleted');

    const deleteNotificationsRequest = new sql.Request(transaction);
    deleteNotificationsRequest.input('ticketId', sql.Int, ticketId);
    await deleteNotificationsRequest.query(`
      DELETE FROM notifications 
      WHERE related_entity_type = 'TICKET' 
        AND related_entity_id = @ticketId
    `);
    logger.success('Notifications deleted');

    // Delete ticket
    const deleteTicketRequest = new sql.Request(transaction);
    deleteTicketRequest.input('ticketId', sql.Int, ticketId);
    const deleteResult = await deleteTicketRequest.query('DELETE FROM tickets WHERE ticket_id = @ticketId');

    if (deleteResult.rowsAffected[0] === 0) {
      await transaction.rollback();
      logger.error('Failed to delete ticket');
      logger.separator();
      return res.status(500).json(
        createResponse(false, 'Failed to delete ticket')
      );
    }

    logger.success('Ticket deleted from database');

    // Commit transaction
    await transaction.commit();
    logger.success('Transaction committed successfully');

    logger.separator('TICKET DELETED SUCCESSFULLY');
    logger.success('All related data removed', {
      ticketId,
      ticketNumber: ticket.ticket_number,
    });
    logger.separator();

    return res.status(200).json(
      createResponse(true, 'Ticket deleted successfully', {
        deleted_ticket_id: parseInt(ticketId),
        ticket_number: ticket.ticket_number,
        subject: ticket.subject
      })
    );

  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
        logger.warn('Transaction rolled back due to error');
      } catch (rollbackError) {
        logger.error('Rollback error', rollbackError);
      }
    }

    logger.error('Delete ticket error', error);
    logger.separator();
    next(error);
  }
};

// ============================================
// EXPORT ALL FUNCTIONS
// ============================================
module.exports = {
  getTickets,
  getTicketById,
  createTicket,
  updateTicket,
  assignTicket,
  addComment,
  deleteTicket,
};
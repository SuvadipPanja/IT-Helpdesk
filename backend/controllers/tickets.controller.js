// ============================================
// TICKETS CONTROLLER - COMPLETE NOTIFICATION SYSTEM
// Handles all ticket-related operations with comprehensive notifications
// Developed by: Suvadip Panja
// Created: November 01, 2025
// Updated: February 06, 2026 - COMPLETE: All ticket events trigger notifications
// FILE: backend/controllers/tickets.controller.js
// ============================================

const { executeQuery, executeInTransaction, executeInTransactionQuery } = require('../config/database');
const { createResponse, getPaginationMeta } = require('../utils/helpers');
const logger = require('../utils/logger');
const sql = require('mssql');
const settingsService = require('../services/settings.service');
const emailQueueService = require('../services/emailQueue.service');
const waNotify = require('../services/whatsappNotificationService'); // 📱 Phase 9: WhatsApp Notifications
const slaService = require('../services/sla.service');
const autoAssignmentService = require('../services/autoAssignment.service');
const dateUtils = require('../utils/dateUtils');
const { getPublicAppUrl } = require('../utils/publicUrl');
const ticketPermissionsService = require('../services/ticketPermissions.service');

const GUIDANCE_VAR_LIMIT = 200;

const stringifyGuidanceValue = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const normalizeGuidanceList = (values) => {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => stringifyGuidanceValue(value))
    .filter(Boolean)
    .slice(0, 50);
};

const normalizeGuidanceChecklist = (values) => {
  if (!Array.isArray(values)) return [];
  return values
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const text = stringifyGuidanceValue(item.text || item.label);
      if (!text) return null;
      return {
        id: stringifyGuidanceValue(item.id) || `check_${index + 1}`,
        text,
        checked: Boolean(item.checked),
      };
    })
    .filter(Boolean)
    .slice(0, 50);
};

const normalizeGuidanceVariables = (values) => {
  if (!values || typeof values !== 'object' || Array.isArray(values)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(values)
      .slice(0, GUIDANCE_VAR_LIMIT)
      .map(([key, value]) => [stringifyGuidanceValue(key), stringifyGuidanceValue(value)])
      .filter(([key, value]) => key && value)
  );
};

const normalizeGuidancePayload = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  const selectedTemplate = payload.selected_template && typeof payload.selected_template === 'object'
    ? {
        id: stringifyGuidanceValue(payload.selected_template.id),
        label: stringifyGuidanceValue(payload.selected_template.label),
        template: stringifyGuidanceValue(payload.selected_template.template),
        resolved_text: stringifyGuidanceValue(payload.selected_template.resolved_text),
      }
    : null;

  const normalized = {
    category_code: stringifyGuidanceValue(payload.category_code),
    category_name: stringifyGuidanceValue(payload.category_name),
    icon: stringifyGuidanceValue(payload.icon),
    tips: normalizeGuidanceList(payload.tips),
    checklist: normalizeGuidanceChecklist(payload.checklist),
    selected_template: selectedTemplate && (selectedTemplate.id || selectedTemplate.label || selectedTemplate.resolved_text)
      ? selectedTemplate
      : null,
    resolved_variables: normalizeGuidanceVariables(payload.resolved_variables),
    submitted_at: new Date().toISOString(),
  };

  if (!normalized.category_code && !normalized.category_name && !normalized.tips.length && !normalized.checklist.length && !normalized.selected_template) {
    return null;
  }

  return normalized;
};

const parseJsonSafely = (value) => {
  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
};

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
    const ratingFilter = req.query.ratingFilter || null;
    const sla_status = req.query.sla_status || null;
    const is_escalated = req.query.is_escalated || null;
    const exclude_final = req.query.exclude_final === '1' || req.query.exclude_final === 'true';

    const offset = (page - 1) * limit;
    
    const canViewAll = req.user.permissions?.can_view_all_tickets || false;
    const userId = req.user.user_id;

    // Load SLA warning threshold from settings (default 80 = 0.8)
    const slaThresholdPct = parseInt(await settingsService.get('sla_warning_threshold')) || 80;
    const slaThresholdDecimal = slaThresholdPct / 100; // e.g. 90 → 0.9

    logger.try('Fetching tickets list', {
      userId,
      canViewAll,
      page,
      limit,
      filters: { status_id, priority_id, category_id },
    });

    // Build WHERE clause based on permissions
    let whereConditions = [];
    let params = { slaThresholdList: slaThresholdDecimal };

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

    if (exclude_final) {
      whereConditions.push('t.status_id IN (SELECT status_id FROM ticket_statuses WHERE is_final_status = 0)');
    }

    if (requester_id) {
      whereConditions.push('t.requester_id = @requesterId');
      params.requesterId = requester_id;
    }

    if (department_id) {
      whereConditions.push('t.department_id = @departmentId');
      params.departmentId = department_id;
    }

    // Escalation filter
    if (is_escalated === '1' || is_escalated === 'true') {
      whereConditions.push('t.is_escalated = 1');
    } else if (is_escalated === '0' || is_escalated === 'false') {
      whereConditions.push('t.is_escalated = 0');
    }

    // Rating filter: rated = has entry in ticket_ratings, unrated = closed but no rating
    if (ratingFilter === 'rated') {
      whereConditions.push('EXISTS (SELECT 1 FROM ticket_ratings tr WHERE tr.ticket_id = t.ticket_id)');
    } else if (ratingFilter === 'unrated') {
      whereConditions.push('NOT EXISTS (SELECT 1 FROM ticket_ratings tr WHERE tr.ticket_id = t.ticket_id)');
      whereConditions.push('t.status_id IN (SELECT status_id FROM ticket_statuses WHERE is_final_status = 1)');
    }

    // SLA status filter - uses due_date vs current time (server-side)
    // Threshold comes from sla_warning_threshold setting (e.g. 90% → 0.9)
    if (sla_status === 'breached') {
      whereConditions.push(`(
        (t.due_date IS NOT NULL AND t.due_date < GETDATE() AND t.status_id IN (SELECT status_id FROM ticket_statuses WHERE is_final_status = 0))
        OR (t.due_date IS NOT NULL AND t.resolved_at IS NOT NULL AND t.resolved_at > t.due_date)
      )`);
    } else if (sla_status === 'warning') {
      whereConditions.push(`(
        t.due_date IS NOT NULL
        AND t.status_id IN (SELECT status_id FROM ticket_statuses WHERE is_final_status = 0)
        AND t.due_date >= GETDATE()
        AND DATEDIFF(SECOND, t.created_at, GETDATE()) >= DATEDIFF(SECOND, t.created_at, t.due_date) * @slaThreshold
      )`);
      params.slaThreshold = slaThresholdDecimal;
    } else if (sla_status === 'ok') {
      whereConditions.push(`(
        t.due_date IS NOT NULL
        AND (
          (t.status_id IN (SELECT status_id FROM ticket_statuses WHERE is_final_status = 0)
           AND t.due_date >= GETDATE()
           AND DATEDIFF(SECOND, t.created_at, GETDATE()) < DATEDIFF(SECOND, t.created_at, t.due_date) * @slaThreshold)
          OR (t.resolved_at IS NOT NULL AND t.resolved_at <= t.due_date)
        )
      )`);
      params.slaThreshold = slaThresholdDecimal;
    }

    const whereClause = whereConditions.length > 0 
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    // Count total records
    const countQuery = `
      SELECT COUNT(*) as total
      FROM tickets t
      ${whereClause}
    `;

    const countResult = await executeQuery(countQuery, params);
    const totalRecords = countResult.recordset?.[0]?.total ?? 0;

    // Fetch tickets
    // Validate sortBy against allowed columns to prevent SQL injection
    const allowedSortColumns = ['created_at', 'updated_at', 'ticket_number', 'subject', 'due_date', 'priority_id', 'status_id'];
    const sortBy = allowedSortColumns.includes(req.query.sortBy) ? req.query.sortBy : 'created_at';
    const sortOrder = req.query.sortOrder === 'ASC' ? 'ASC' : 'DESC';

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
        t.is_escalated,
        t.first_response_sla_met,
        t.resolution_sla_met,
        ISNULL(t.sla_paused, 0) as sla_paused,
        ISNULL(t.approval_pending, 0) as approval_pending,
        t.sla_pause_reason,
        
        -- Server-side SLA status (threshold from sla_warning_threshold setting) - paused when need more details
        CASE
          WHEN ISNULL(t.sla_paused, 0) = 1 THEN 'paused'
          WHEN t.due_date IS NULL THEN 'none'
          WHEN ts.is_final_status = 1 AND t.resolved_at IS NOT NULL AND t.resolved_at <= t.due_date THEN 'met'
          WHEN ts.is_final_status = 1 AND t.resolved_at IS NOT NULL AND t.resolved_at > t.due_date THEN 'breached'
          WHEN ts.is_final_status = 0 AND GETDATE() > t.due_date THEN 'breached'
          WHEN ts.is_final_status = 0 AND DATEDIFF(SECOND, t.created_at, GETDATE()) >= DATEDIFF(SECOND, t.created_at, t.due_date) * @slaThresholdList THEN 'warning'
          ELSE 'ok'
        END as sla_status,
        
        tc.category_id,
        tc.category_name,
        tc.category_code,
        
        tp.priority_id,
        tp.priority_name,
        tp.priority_code,
        tp.color_code as priority_color,
        tp.response_time_hours,
        tp.resolution_time_hours,
        
        ts.status_id,
        ts.status_name,
        ts.status_code,
        ts.status_type,
        ts.color_code as status_color,
        ts.is_final_status,
        
        u_req.user_id as requester_id,
        u_req.first_name + ' ' + u_req.last_name as requester_name,
        u_req.profile_picture as requester_profile_picture,
        
        u_eng.user_id as assigned_to_id,
        u_eng.first_name + ' ' + u_eng.last_name as assigned_to_name,
        u_eng.profile_picture as assigned_profile_picture,
        
        d.department_id,
        d.department_name,
        
        -- Sub-category, Location, Process (list view)
        sc.sub_category_name,
        t.other_category_text,
        loc.location_name,
        prc.process_name
        
      FROM tickets t
      LEFT JOIN ticket_categories tc ON t.category_id = tc.category_id
      LEFT JOIN ticket_priorities tp ON t.priority_id = tp.priority_id
      LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
      LEFT JOIN users u_req ON t.requester_id = u_req.user_id
      LEFT JOIN users u_eng ON t.assigned_to = u_eng.user_id
      LEFT JOIN departments d ON t.department_id = d.department_id
      LEFT JOIN ticket_sub_categories sc ON t.sub_category_id = sc.sub_category_id
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

    logger.success('Tickets fetched successfully', {
      count: ticketsResult.recordset.length,
      page,
      totalPages: paginationMeta.totalPages,
    });

    return res.status(200).json(
      createResponse(true, 'Tickets fetched successfully', {
        tickets: ticketsResult.recordset,
        pagination: paginationMeta
      })
    );
  } catch (error) {
    logger.error('Get tickets error', error);
    next(error);
  }
};

// ============================================
// ⭐ NEW: GET TICKET STATS - OPTIMIZED FOR PERFORMANCE
// ============================================
/**
 * Get ticket statistics/counts for current user
 * @route GET /api/v1/tickets/stats
 * @access Private
 * 
 * ⭐ PERFORMANCE OPTIMIZED:
 * - Uses COUNT with CASE WHEN (single query)
 * - No data fetching, only counts
 * - Handles 1 Lakh+ tickets in < 150ms
 * 
 * Added: February 2026
 * Developer: Suvadip Panja
 */
const getTicketStats = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const canViewAll = req.user.permissions?.can_view_all_tickets || false;

    // Load SLA warning threshold from settings
    const slaThresholdPct = parseInt(await settingsService.get('sla_warning_threshold')) || 80;
    const slaThresholdStats = slaThresholdPct / 100;

    logger.try('Fetching ticket stats (optimized)', { userId, canViewAll });

    // ⭐ SINGLE OPTIMIZED QUERY - Gets all counts at once
    // This is 100x faster than multiple queries or fetching data
    const query = `
      SELECT 
        -- Total tickets (based on permissions)
        COUNT(*) as total_tickets,
        
        -- Created by current user
        SUM(CASE WHEN t.requester_id = @userId THEN 1 ELSE 0 END) as created_by_me,
        
        -- Assigned to current user
        SUM(CASE WHEN t.assigned_to = @userId THEN 1 ELSE 0 END) as assigned_to_me,
        
        -- My Queue: assigned to me, non-final status (active open work)
        SUM(CASE WHEN t.assigned_to = @userId AND ts.is_final_status = 0 THEN 1 ELSE 0 END) as my_queue_count,
        
        -- By Status
        SUM(CASE WHEN ts.status_code = 'OPEN' THEN 1 ELSE 0 END) as open_count,
        SUM(CASE WHEN ts.status_code = 'IN_PROGRESS' THEN 1 ELSE 0 END) as in_progress_count,
        SUM(CASE WHEN ts.status_code = 'PENDING' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN ts.status_code = 'RESOLVED' THEN 1 ELSE 0 END) as resolved_count,
        SUM(CASE WHEN ts.status_code = 'CLOSED' THEN 1 ELSE 0 END) as closed_count,
        SUM(CASE WHEN ts.status_code = 'REOPENED' THEN 1 ELSE 0 END) as reopened_count,
        
        -- Escalated tickets
        SUM(CASE WHEN t.is_escalated = 1 THEN 1 ELSE 0 END) as escalated_count,
        
        -- Unassigned tickets
        SUM(CASE WHEN t.assigned_to IS NULL THEN 1 ELSE 0 END) as unassigned_count,
        
        -- SLA Status (only for open tickets - threshold from settings)
        SUM(CASE 
          WHEN ts.is_final_status = 0 AND t.due_date IS NOT NULL AND t.due_date < GETDATE() 
          THEN 1 ELSE 0 
        END) as sla_breached_count,
        
        SUM(CASE 
          WHEN ts.is_final_status = 0 
            AND t.due_date IS NOT NULL
            AND t.due_date >= GETDATE() 
            AND DATEDIFF(SECOND, t.created_at, GETDATE()) >= DATEDIFF(SECOND, t.created_at, t.due_date) * @slaThresholdStats
          THEN 1 ELSE 0 
        END) as sla_warning_count

      FROM tickets t
      LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
      WHERE 1=1
        ${!canViewAll ? 'AND (t.requester_id = @userId OR t.assigned_to = @userId)' : ''}
    `;

    const result = await executeQuery(query, { userId, slaThresholdStats });
    const stats = result.recordset[0];

    logger.success('Ticket stats fetched successfully', {
      total: stats.total_tickets,
      created: stats.created_by_me,
      assigned: stats.assigned_to_me
    });

    return res.status(200).json(
      createResponse(true, 'Ticket stats fetched successfully', {
        total: stats.total_tickets || 0,
        created_by_me: stats.created_by_me || 0,
        assigned_to_me: stats.assigned_to_me || 0,
        my_queue_count: stats.my_queue_count || 0,
        by_status: {
          open: stats.open_count || 0,
          in_progress: stats.in_progress_count || 0,
          pending: stats.pending_count || 0,
          resolved: stats.resolved_count || 0,
          closed: stats.closed_count || 0,
          reopened: stats.reopened_count || 0
        },
        escalated: stats.escalated_count || 0,
        unassigned: stats.unassigned_count || 0,
        sla: {
          breached: stats.sla_breached_count || 0,
          warning: stats.sla_warning_count || 0
        }
      })
    );

  } catch (error) {
    logger.error('Get ticket stats error', error);
    next(error);
  }
};

/**
 * Reassign invalid assigned open tickets and/or assign unassigned open tickets
 * @route POST /api/v1/tickets/reassign-open
 * @access Admin/Manager (or users with can_assign_tickets)
 */
const reassignOpenTickets = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const roleCode = req.user.role?.role_code || '';
    const canAssign = req.user.permissions?.can_assign_tickets || false;

    if (!canAssign && !['ADMIN', 'MANAGER'].includes(roleCode)) {
      return res.status(403).json(
        createResponse(false, 'You do not have permission to run reassignment')
      );
    }

    const {
      includeInvalidAssigned = true,
      includeUnassigned = true,
      limit = 200,
      dryRun = false,
    } = req.body || {};

    const result = await autoAssignmentService.reassignOpenTickets({
      includeInvalidAssigned: Boolean(includeInvalidAssigned),
      includeUnassigned: Boolean(includeUnassigned),
      limit: Math.max(1, Math.min(parseInt(limit, 10) || 200, 1000)),
      dryRun: Boolean(dryRun),
      triggeredBy: `manual:user:${userId}`,
    });

    if (!result.success) {
      return res.status(500).json(
        createResponse(false, result.error || 'Reassignment failed', result)
      );
    }

    return res.status(200).json(
      createResponse(true, dryRun ? 'Reassignment dry-run completed' : 'Reassignment completed', result)
    );
  } catch (error) {
    logger.error('Reassign open tickets error', error);
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

    // Load SLA warning threshold from settings
    const slaThresholdPct = parseInt(await settingsService.get('sla_warning_threshold')) || 80;
    const slaThresholdDetail = slaThresholdPct / 100;

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
        t.rated_at,
        t.first_response_at,
        t.first_response_sla_met,
        t.resolution_sla_met,
        ISNULL(t.sla_paused, 0) as sla_paused,
        t.sla_paused_at,
        t.sla_pause_reason,
        ISNULL(t.approval_pending, 0) as approval_pending,
        t.info_requested_at,
        t.info_provided_at,
        
        -- Server-side SLA status (threshold from settings) - SLA paused when need more details or approval pending
        CASE
          WHEN ISNULL(t.sla_paused, 0) = 1 THEN 'paused'
          WHEN t.due_date IS NULL THEN 'none'
          WHEN ts.is_final_status = 1 AND t.resolved_at IS NOT NULL AND t.resolved_at <= t.due_date THEN 'met'
          WHEN ts.is_final_status = 1 AND t.resolved_at IS NOT NULL AND t.resolved_at > t.due_date THEN 'breached'
          WHEN ts.is_final_status = 0 AND GETDATE() > t.due_date THEN 'breached'
          WHEN ts.is_final_status = 0 AND DATEDIFF(SECOND, t.created_at, GETDATE()) >= DATEDIFF(SECOND, t.created_at, t.due_date) * @slaThresholdDetail THEN 'warning'
          ELSE 'ok'
        END as sla_status,
        
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
        
        u_creator.first_name + ' ' + u_creator.last_name as created_by_name,
        
        -- Sub-category, Location, Process
        t.sub_category_id,
        sc.sub_category_name,
        t.other_category_text,
        t.location_id,
        loc.location_name,
        loc.location_code,
        t.process_id,
        prc.process_name,
        prc.process_code,
        
        -- Team / bucket info
        t.team_id,
        tm.team_name,
        tm.team_code,
        tm.is_central AS team_is_central,
        t.routed_at,
        u_router.first_name + ' ' + u_router.last_name AS routed_by_name
        
      FROM tickets t
      LEFT JOIN ticket_categories tc ON t.category_id = tc.category_id
      LEFT JOIN ticket_priorities tp ON t.priority_id = tp.priority_id
      LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
      LEFT JOIN users u_req ON t.requester_id = u_req.user_id
      LEFT JOIN users u_eng ON t.assigned_to = u_eng.user_id
      LEFT JOIN users u_esc ON t.escalated_to = u_esc.user_id
      LEFT JOIN departments d ON t.department_id = d.department_id
      LEFT JOIN users u_creator ON t.created_by = u_creator.user_id
      LEFT JOIN ticket_sub_categories sc ON t.sub_category_id = sc.sub_category_id
      LEFT JOIN locations loc ON t.location_id = loc.location_id
      LEFT JOIN processes prc ON t.process_id = prc.process_id
      LEFT JOIN teams tm ON t.team_id = tm.team_id
      LEFT JOIN users u_router ON t.routed_by_user_id = u_router.user_id
      WHERE t.ticket_id = @ticketId
    `;

    const result = await executeQuery(query, { ticketId, slaThresholdDetail });

    if (result.recordset.length === 0) {
      logger.warn('Ticket not found', { ticketId });
      return res.status(404).json(
        createResponse(false, 'Ticket not found')
      );
    }

    const ticket = result.recordset[0];

    // Check if user has permission to view this ticket
    const hasPermission = canViewAll || 
                         ticket.requester_id === userId || 
                         ticket.assigned_to_id === userId;

    if (!hasPermission) {
      logger.warn('Unauthorized access attempt', {
        ticketId,
        userId,
        requester: ticket.requester_id,
        assigned: ticket.assigned_to_id,
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
        uploaded_at,
        uploaded_by,
        u.first_name + ' ' + u.last_name as uploaded_by_name
      FROM ticket_attachments ta
      LEFT JOIN users u ON ta.uploaded_by = u.user_id
      WHERE ta.ticket_id = @ticketId
      ORDER BY ta.uploaded_at DESC
    `;

    const attachmentsResult = await executeQuery(attachmentsQuery, { ticketId });

    // Get ticket comments
    // Hide internal comments from the ticket requester (unless they have can_view_all_tickets)
    const isRequester = ticket.requester_id === userId && !canViewAll;
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
        ${isRequester ? 'AND tc.is_internal = 0' : ''}
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

    // Get custom field values
    const customFieldsQuery = `
      SELECT 
        cfv.value_id,
        cfv.field_id,
        cfv.field_value,
        f.field_name,
        f.field_label,
        f.field_type
      FROM ticket_custom_field_values cfv
      LEFT JOIN ticket_sub_category_fields f ON cfv.field_id = f.field_id
      WHERE cfv.ticket_id = @ticketId
      ORDER BY f.display_order
    `;

    const customFieldsResult = await executeQuery(customFieldsQuery, { ticketId });

    let guidance = null;
    try {
      const guidanceQuery = `
        SELECT
          guided_intake_id,
          category_code,
          selected_template_id,
          selected_template_label,
          selected_template_text,
          payload_json,
          created_at,
          updated_at
        FROM ticket_guided_intake
        WHERE ticket_id = @ticketId
      `;
      const guidanceResult = await executeQuery(guidanceQuery, { ticketId });
      const guidanceRecord = guidanceResult.recordset?.[0];
      if (guidanceRecord) {
        const payload = parseJsonSafely(guidanceRecord.payload_json) || {};
        guidance = {
          guided_intake_id: guidanceRecord.guided_intake_id,
          category_code: guidanceRecord.category_code,
          selected_template_id: guidanceRecord.selected_template_id,
          selected_template_label: guidanceRecord.selected_template_label,
          selected_template_text: guidanceRecord.selected_template_text,
          created_at: guidanceRecord.created_at,
          updated_at: guidanceRecord.updated_at,
          ...payload,
        };
      }
    } catch (_) {
      guidance = null;
    }

    // Get active pending info request (need more details flag)
    let pendingInfoRequest = null;
    try {
      const pendingInfoQuery = `
        SELECT TOP 1
          r.request_id, r.ticket_id, r.request_note, r.requested_at,
          r.provided_at, r.provider_note, r.is_active,
          u.first_name + ' ' + u.last_name as requested_by_name
        FROM ticket_info_requests r
        LEFT JOIN users u ON r.requested_by = u.user_id
        WHERE r.ticket_id = @ticketId AND r.is_active = 1
        ORDER BY r.requested_at DESC
      `;
      const pendingInfoResult = await executeQuery(pendingInfoQuery, { ticketId });
      pendingInfoRequest = pendingInfoResult.recordset?.[0] || null;
    } catch (_) { /* table may not exist in older DBs */ }

    // Get most recent approval request (any status).
    // Returns PENDING if active, or last REJECTED/APPROVED/CANCELLED otherwise,
    // so the frontend can show appropriate banners after a rejection.
    let activeApproval = null;
    try {
      const approvalQuery = `
        SELECT TOP 1
          ta.approval_id, ta.ticket_id, ta.approval_note, ta.status,
          ta.requested_at, ta.decided_at, ta.decision_note,
          u_eng.first_name + ' ' + u_eng.last_name AS engineer_name,
          u_apr.first_name + ' ' + u_apr.last_name AS approver_name,
          u_apr.user_id AS approver_id,
          u_apr.email AS approver_email
        FROM ticket_approvals ta
        LEFT JOIN users u_eng ON ta.requested_by = u_eng.user_id
        LEFT JOIN users u_apr ON ta.approver_id = u_apr.user_id
        WHERE ta.ticket_id = @ticketId
        ORDER BY ta.requested_at DESC
      `;
      const approvalResult = await executeQuery(approvalQuery, { ticketId });
      activeApproval = approvalResult.recordset?.[0] || null;
    } catch (_) { /* ticket_approvals table may not exist in older DBs */ }

    const ticketData = {
      ...ticket,
      attachments: attachmentsResult.recordset,
      comments: commentsResult.recordset,
      activities: activitiesResult.recordset,
      custom_fields: customFieldsResult.recordset,
      guidance,
      pending_info_request: pendingInfoRequest,
      active_approval: activeApproval,
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
 * Create new ticket with COMPLETE NOTIFICATION SYSTEM
 * @route POST /api/v1/tickets
 * @access Private
 * ⭐ Sends notification and email to:
 *    - Ticket creator (confirmation)
 *    - Admins/Managers (new ticket alert)
 *    - Assigned engineer (if auto-assigned)
 */
const createTicket = async (req, res, next) => {
  try {
    const {
      subject,
      description,
      category_id,
      priority_id,
      department_id,
      sub_category_id,
      other_category_text,
      location_id,
      process_id,
      custom_fields,
      guidance_payload,
      team_id,
    } = req.body;

    const userId = req.user.user_id;

    logger.separator('TICKET CREATION - COMPLETE NOTIFICATION SYSTEM');
    logger.try('Creating new ticket', {
      subject,
      categoryId: category_id,
      priorityId: priority_id,
      createdBy: userId,
    });

    // ============================================
    // STEP 1: FETCH ALL SETTINGS
    // ============================================
    logger.try('Fetching all settings from database');
    const ticketSettings = await settingsService.getByCategory('ticket');
    const slaSettings = await settingsService.getByCategory('sla');
    const notificationSettings = await settingsService.getByCategory('notification');
    const generalSettings = await settingsService.getByCategory('general');
    
    logger.success('All settings loaded', {
      prefix: ticketSettings.ticket_number_prefix || 'TKT',
      defaultPriority: ticketSettings.ticket_default_priority || 3,
      defaultCategory: ticketSettings.ticket_default_category || 9,
      autoAssignment: ticketSettings.ticket_auto_assignment === 'true' || ticketSettings.ticket_auto_assignment === true,
      assignmentMethod: ticketSettings.ticket_assignment_method || 'round_robin',
      slaEnabled: slaSettings.sla_enabled
    });

    // STEP 2: USE DEFAULT PRIORITY IF NOT PROVIDED
    const finalPriorityId = priority_id || ticketSettings.ticket_default_priority || 3;
    
    // STEP 3: USE DEFAULT CATEGORY IF NOT PROVIDED
    const finalCategoryId = category_id || ticketSettings.ticket_default_category || 9;

    // STEP 4: GENERATE TICKET NUMBER (atomic within transaction to prevent race under concurrent load)
    const prefix = (ticketSettings.ticket_number_prefix || 'TKT').toUpperCase().replace(/[^A-Z]/g, '');
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    // Get default status (Open)
    const statusQuery = `
      SELECT status_id 
      FROM ticket_statuses 
      WHERE status_code = 'OPEN' AND is_active = 1
    `;
    
    const statusResult = await executeQuery(statusQuery);
    const statusId = statusResult.recordset[0].status_id;

    // STEP 5: CALCULATE DUE DATE (SLA)
    // Resolve SLA hours via policy matrix (category × priority fallback chain)
    const slaHours = await slaService.getSLAPolicyHours(finalCategoryId, finalPriorityId);

    const slaEnabled = slaSettings.sla_enabled === 'true' || slaSettings.sla_enabled === true;
    
    const createdAt = new Date();
    let dueDate;

    if (slaEnabled) {
      dueDate = await slaService.calculateDueDate(createdAt, slaHours);
    } else {
      dueDate = null;
    }

    // STEP 6: AUTO-ASSIGNMENT LOGIC (via AutoAssignment Service)
    // For location-wise assignment: use creator's location_id from user profile
    // If assignment scope is 'team_first' and central team routing is active, skip auto-assignment
    // so the ticket lands in the team bucket for engineer self-assignment.
    let assignedToId = null;
    let assignedEngineerDetails = null;

    const assignmentScope = ticketSettings.ticket_auto_assignment_scope || 'direct';
    const centralTeamEnabled = ticketSettings.ticket_central_team_enabled === 'true' || ticketSettings.ticket_central_team_enabled === true;
    const skipAutoAssign = assignmentScope === 'team_first' && centralTeamEnabled;

    if (skipAutoAssign) {
      logger.info('Auto-assignment skipped: scope is team_first with central team routing enabled');
    } else {
      // Get creator's location_id from profile for location-wise assignment
      let creatorLocationId = location_id || null;
      try {
        const creatorQuery = `SELECT location_id FROM users WHERE user_id = @userId`;
        const creatorResult = await executeQuery(creatorQuery, { userId });
        if (creatorResult.recordset.length > 0 && creatorResult.recordset[0].location_id) {
          creatorLocationId = creatorResult.recordset[0].location_id;
        }
      } catch (locErr) {
        logger.warn('Could not fetch creator location_id, using request body value', { error: locErr.message });
      }

      const engineer = await autoAssignmentService.findEngineer({
        departmentId: department_id || null,
        priorityId: finalPriorityId,
        categoryId: finalCategoryId,
        locationId: creatorLocationId,
      });

      if (engineer) {
        assignedToId = engineer.user_id;
        assignedEngineerDetails = engineer;
        logger.success('Ticket auto-assigned', {
          engineerId: engineer.user_id,
          engineerName: engineer.full_name,
          roleCode: engineer.role_code,
        });
      }
    }

    // STEP 7: INSERT TICKET (atomic with sequence generation - prevents concurrent duplicate ticket_number)
    const seqQuery = `
      SELECT ISNULL(MAX(CAST(RIGHT(ticket_number, 4) AS INT)), 0) + 1 AS next_seq
      FROM tickets WITH (UPDLOCK, HOLDLOCK)
      WHERE ticket_number LIKE @ticketPrefix
    `;
    const insertQuery = `
      INSERT INTO tickets (
        ticket_number, subject, description,
        category_id, priority_id, status_id,
        requester_id, department_id, due_date,
        assigned_to, created_by,
        sub_category_id, other_category_text, location_id, process_id
      )
      OUTPUT INSERTED.ticket_id
      VALUES (
        @ticketNumber, @subject, @description,
        @categoryId, @priorityId, @statusId,
        @requesterId, @departmentId, @dueDate,
        @assignedTo, @createdBy,
        @subCategoryId, @otherCategoryText, @locationId, @processId
      )
    `;

    const normalizedGuidancePayload = normalizeGuidancePayload(guidance_payload);

    const { ticketId, ticketNumber, customFieldCount, guidanceSaved } = await executeInTransaction(async (transaction) => {
      // Serialize ticket creation globally to prevent race on ticket_number (sp_getapplock blocks concurrent sessions)
      await executeInTransactionQuery(transaction, `EXEC sp_getapplock @Resource = 'ticket_number_gen', @LockMode = 'Exclusive', @LockOwner = 'Transaction'`, {});
      const seqResult = await executeInTransactionQuery(transaction, seqQuery, {
        ticketPrefix: `${prefix}-${dateStr}-%`,
      });
      const sequence = seqResult.recordset[0].next_seq;
      const ticketNumber = `${prefix}-${dateStr}-${String(sequence).padStart(4, '0')}`;
      logger.success('Ticket number generated', { ticketNumber, prefix });

      const insertResult = await executeInTransactionQuery(transaction, insertQuery, {
        ticketNumber,
        subject,
        description,
        categoryId: finalCategoryId,
        priorityId: finalPriorityId,
        statusId,
        requesterId: userId,
        departmentId: department_id || null,
        dueDate: dueDate,
        assignedTo: assignedToId,
        createdBy: userId,
        subCategoryId: sub_category_id || null,
        otherCategoryText: other_category_text || null,
        locationId: location_id || null,
        processId: process_id || null,
      });
      const ticketId = insertResult.recordset[0].ticket_id;

      let customFieldCount = 0;
      if (Array.isArray(custom_fields) && custom_fields.length > 0) {
        for (const cf of custom_fields) {
          if (cf.field_id && cf.value !== undefined && cf.value !== null && cf.value !== '') {
            await executeInTransactionQuery(
              transaction,
              `INSERT INTO ticket_custom_field_values (ticket_id, field_id, field_value) VALUES (@ticketId, @fieldId, @fieldValue)`,
              { ticketId, fieldId: cf.field_id, fieldValue: String(cf.value) }
            );
            customFieldCount += 1;
          }
        }
      }

      let guidanceSaved = false;
      if (normalizedGuidancePayload) {
        await executeInTransactionQuery(
          transaction,
          `
            INSERT INTO ticket_guided_intake (
              ticket_id,
              category_code,
              selected_template_id,
              selected_template_label,
              selected_template_text,
              payload_json
            )
            VALUES (
              @ticketId,
              @categoryCode,
              @selectedTemplateId,
              @selectedTemplateLabel,
              @selectedTemplateText,
              @payloadJson
            )
          `,
          {
            ticketId,
            categoryCode: normalizedGuidancePayload.category_code || null,
            selectedTemplateId: normalizedGuidancePayload.selected_template?.id || null,
            selectedTemplateLabel: normalizedGuidancePayload.selected_template?.label || null,
            selectedTemplateText: normalizedGuidancePayload.selected_template?.resolved_text || null,
            payloadJson: JSON.stringify(normalizedGuidancePayload),
          }
        );
        guidanceSaved = true;
      }

      return { ticketId, ticketNumber, customFieldCount, guidanceSaved };
    });

    logger.success('Ticket inserted successfully', {
      ticketId,
      ticketNumber,
      assignedTo: assignedToId || 'Not assigned'
    });

    // ============================================
    // TEAM ROUTING — Assign ticket to a team bucket
    // ============================================
    // If admin/manager explicitly provided a team_id, use that directly.
    // Otherwise, use settings-driven routing strategy:
    //   1. Read ticket_central_team_enabled + ticket_central_team_id + ticket_central_team_mode from system_settings.
    //   2. If mode = 'always' and central routing is enabled → route to configured central team.
    //   3. If mode = 'category_fallback' → try category→team rule first; if none found, route to central team.
    //   4. If central routing is disabled, fall back to the is_central=1 DB flag for backward compat.
    //   5. If still no team found, leave team_id NULL.
    try {
      // If admin/manager explicitly provided a team_id, skip auto-routing
      const explicitTeamId = team_id ? parseInt(team_id) : null;

      const centralEnabled = await settingsService.get('ticket_central_team_enabled');
      const centralTeamIdSetting = await settingsService.get('ticket_central_team_id');
      const centralMode = (await settingsService.get('ticket_central_team_mode')) || 'always';

      const isCentralEnabled = centralEnabled === 'true' || centralEnabled === true;
      const configuredCentralTeamId = parseInt(centralTeamIdSetting) || 0;

      let routedTeamId = explicitTeamId || null;

      if (!routedTeamId && isCentralEnabled && configuredCentralTeamId > 0) {
        if (centralMode === 'always') {
          // Always send to the configured central team first
          routedTeamId = configuredCentralTeamId;
          logger.success('Ticket routed to Central Team (settings: always)', { ticketId, teamId: routedTeamId });
        } else {
          // category_fallback: try direct category→team rule first
          const categoryRouteResult = await executeQuery(
            `SELECT team_id FROM team_category_routing
             WHERE category_id = @categoryId AND is_active = 1`,
            { categoryId: finalCategoryId }
          );
          if (categoryRouteResult.recordset.length) {
            routedTeamId = categoryRouteResult.recordset[0].team_id;
            logger.success('Ticket routed via category mapping (central fallback mode)', { ticketId, teamId: routedTeamId });
          } else {
            // No direct rule — fall back to central
            routedTeamId = configuredCentralTeamId;
            logger.success('Ticket routed to Central Team (settings: category_fallback, no category rule)', { ticketId, teamId: routedTeamId });
          }
        }
      } else if (!routedTeamId) {
        // Central routing not configured via settings — use legacy is_central=1 flag
        const centralTeamResult = await executeQuery(
          'SELECT team_id FROM teams WHERE is_central = 1 AND is_active = 1'
        );
        if (centralTeamResult.recordset.length) {
          routedTeamId = centralTeamResult.recordset[0].team_id;
          logger.success('Ticket routed to Central Ticketing Team (legacy is_central flag)', { ticketId, teamId: routedTeamId });
        } else {
          // No central team at all — try direct category→team routing
          const categoryRouteResult = await executeQuery(
            `SELECT team_id FROM team_category_routing
             WHERE category_id = @categoryId AND is_active = 1`,
            { categoryId: finalCategoryId }
          );
          if (categoryRouteResult.recordset.length) {
            routedTeamId = categoryRouteResult.recordset[0].team_id;
            logger.success('Ticket routed via category mapping', { ticketId, teamId: routedTeamId });
          }
        }
      }

      if (routedTeamId) {
        // Verify the target team is still active before assigning
        const teamCheck = await executeQuery(
          'SELECT team_id, team_name FROM teams WHERE team_id = @teamId AND is_active = 1',
          { teamId: routedTeamId }
        );
        if (teamCheck.recordset.length) {
          await executeQuery(
            `UPDATE tickets SET team_id = @teamId, routed_at = GETDATE(), updated_at = GETDATE() WHERE ticket_id = @ticketId`,
            { teamId: routedTeamId, ticketId }
          );

          // Log TEAM_ROUTED activity so it appears in the Ticket Journey
          const teamName = teamCheck.recordset[0].team_name;
          await executeQuery(
            `INSERT INTO ticket_activities (ticket_id, activity_type, field_name, old_value, new_value, description, performed_by)
             VALUES (@ticketId, 'TEAM_ROUTED', 'team_id', NULL, @teamName, @desc, @userId)`,
            {
              ticketId,
              teamName,
              desc: `Ticket routed to ${teamName} bucket`,
              userId,
            }
          );
        } else {
          logger.warn('Configured central team is inactive — ticket created without team assignment', {
            ticketId, configuredTeamId: routedTeamId,
          });
        }
      }
    } catch (routeErr) {
      // Team routing failure should NOT block ticket creation
      logger.warn('Team routing failed — ticket created without team assignment', {
        ticketId,
        error: routeErr.message,
      });
    }

    // Log ticket creation activity
    const activityQuery = `
      INSERT INTO ticket_activities (
        ticket_id, activity_type, description, performed_by
      )
      VALUES (@ticketId, 'CREATED', 'Ticket created', @userId)
    `;
    
    await executeQuery(activityQuery, { 
      ticketId, 
      userId 
    });

    if (customFieldCount > 0) {
      logger.success('Custom field values saved', { count: customFieldCount });
    }

    if (guidanceSaved) {
      logger.success('Guided intake snapshot saved', { ticketId });
    }

    // Log separate ASSIGNED activity when auto-assigned
    if (assignedToId) {
      const autoAssignActivityQuery = `
        INSERT INTO ticket_activities (
          ticket_id, activity_type, field_name, old_value, new_value, description, performed_by
        )
        VALUES (@ticketId, 'ASSIGNED', 'assigned_to', 'Unassigned', @newValue, @description, @userId)
      `;
      await executeQuery(autoAssignActivityQuery, {
        ticketId,
        newValue: assignedEngineerDetails?.full_name || 'Engineer',
        description: `Auto-assigned to ${assignedEngineerDetails?.full_name || 'Engineer'}`,
        userId,
      });
    }

    // ============================================
    // ⭐ NOTIFICATION SECTION - ALL PARTIES
    // ============================================
    const appUrl = getPublicAppUrl();

    // Get full ticket details for notifications
    const ticketDetailsQuery = `
      SELECT 
        t.ticket_number,
        t.subject,
        t.description,
        t.created_at,
        t.due_date,
        tp.priority_name,
        tc.category_name,
        u_req.user_id as requester_id,
        u_req.first_name + ' ' + u_req.last_name as requester_name,
        u_req.email as requester_email
      FROM tickets t
      LEFT JOIN ticket_priorities tp ON t.priority_id = tp.priority_id
      LEFT JOIN ticket_categories tc ON t.category_id = tc.category_id
      LEFT JOIN users u_req ON t.requester_id = u_req.user_id
      WHERE t.ticket_id = @ticketId
    `;
    
    const details = (await executeQuery(ticketDetailsQuery, { ticketId })).recordset[0];
    
    // Format dates using configured timezone
    const createdAtFormatted = await dateUtils.formatDateTime(details.created_at);
    
    const dueDateFormatted = details.due_date ? await dateUtils.formatDateTime(details.due_date) : 'Not set (SLA disabled)';

    // ============================================
    // NOTIFICATION 1: ADMINS/MANAGERS - New Ticket Alert
    // ============================================
    logger.try('Creating notifications for administrators');
    
    const adminNotificationQuery = `
      INSERT INTO notifications (
        user_id, notification_type, title, message, related_ticket_id
      )
      SELECT 
        u.user_id,
        'TICKET_CREATED',
        'New Ticket Created',
        'Ticket #' + @ticketNumber + ' - ' + @subject + ' has been created by ' + @requesterName,
        @ticketId
      FROM users u
      INNER JOIN user_roles r ON u.role_id = r.role_id
      WHERE r.role_code IN ('ADMIN', 'MANAGER') 
        AND u.is_active = 1
        AND u.user_id != @userId
    `;
    
    await executeQuery(adminNotificationQuery, {
      ticketNumber,
      subject,
      requesterName: details.requester_name,
      ticketId,
      userId,
    });

    logger.success('Notifications created for administrators');

    // ============================================
    // NOTIFICATION 2: REQUESTER - Ticket Created Confirmation
    // ============================================
    logger.try('Creating confirmation notification for ticket creator');

    let requesterMessage = `Your ticket #${ticketNumber} - ${subject} has been created successfully.`;
    if (assignedToId && assignedEngineerDetails) {
      requesterMessage += ` It has been assigned to ${assignedEngineerDetails.full_name}.`;
    } else {
      requesterMessage += ` Our support team has been notified.`;
    }

    const requesterNotificationQuery = `
      INSERT INTO notifications (
        user_id, notification_type, title, message, related_ticket_id
      )
      VALUES (
        @userId,
        'TICKET_CONFIRMATION',
        'Ticket Created Successfully',
        @message,
        @ticketId
      )
    `;

    await executeQuery(requesterNotificationQuery, {
      userId,
      message: requesterMessage,
      ticketId,
    });

    logger.success('Confirmation notification created for ticket creator');

    // ============================================
    // NOTIFICATION 3: ASSIGNED ENGINEER - New Assignment
    // ============================================
    if (assignedToId) {
      logger.try('Creating notification for assigned engineer');

      const engineerNotificationQuery = `
        INSERT INTO notifications (
          user_id, notification_type, title, message, related_ticket_id
        )
        VALUES (
          @assignedTo,
          'TICKET_ASSIGNED',
          'New Ticket Assigned to You',
          'Ticket #' + @ticketNumber + ' - ' + @subject + ' has been assigned to you. Priority: ' + @priority,
          @ticketId
        )
      `;

      await executeQuery(engineerNotificationQuery, {
        assignedTo: assignedToId,
        ticketNumber,
        subject,
        priority: details.priority_name,
        ticketId,
      });

      logger.success('Notification created for assigned engineer', { assignedToId });
    }

    // ============================================
    // EMAIL NOTIFICATIONS
    // ============================================
    try {
      const emailEnabled = notificationSettings.notify_on_ticket_created === 'true' || notificationSettings.notify_on_ticket_created === true;
      
      if (emailEnabled) {
        logger.try('Sending ticket creation email notifications');
        
        // EMAIL 1: Send to admins/managers
        const adminsQuery = `
          SELECT 
            u.user_id,
            u.email,
            u.first_name + ' ' + u.last_name as full_name
          FROM users u
          INNER JOIN user_roles r ON u.role_id = r.role_id
          WHERE r.role_code IN ('ADMIN', 'MANAGER')
            AND u.is_active = 1
            AND u.email IS NOT NULL
            AND u.user_id != @userId
        `;
        
        const admins = await executeQuery(adminsQuery, { userId });
        
        for (const admin of admins.recordset) {
          await emailQueueService.sendTemplatedEmail(
            'TICKET_CREATED',
            admin.email,
            {
              ticket_number: ticketNumber,
              subject: details.subject,
              description: details.description,
              priority: details.priority_name,
              category: details.category_name,
              requester_name: details.requester_name,
              requester_email: details.requester_email,
              created_at: createdAtFormatted,
              due_date: dueDateFormatted,
              ticket_url: `${appUrl}/tickets/${ticketId}`,
              system_name: generalSettings.system_name || 'IT Helpdesk',
              sla_enabled: slaEnabled ? 'Yes' : 'No'
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
        
        logger.success('Email notifications queued for admins/managers', {
          count: admins.recordset.length
        });

        // EMAIL 2: Send confirmation to requester
        if (details.requester_email) {
          await emailQueueService.sendTemplatedEmail(
            'TICKET_CONFIRMATION',
            details.requester_email,
            {
              ticket_number: ticketNumber,
              subject: details.subject,
              description: details.description,
              priority: details.priority_name,
              category: details.category_name,
              requester_name: details.requester_name,
              created_at: createdAtFormatted,
              due_date: dueDateFormatted,
              assigned_to_name: assignedEngineerDetails?.full_name || 'Pending Assignment',
              ticket_url: `${appUrl}/tickets/${ticketId}`,
              system_name: generalSettings.system_name || 'IT Helpdesk'
            },
            {
              recipientName: details.requester_name,
              recipientUserId: userId,
              emailType: 'TICKET_CONFIRMATION',
              relatedEntityType: 'TICKET',
              relatedEntityId: ticketId,
              priority: 2
            }
          );

          logger.success('Confirmation email queued for ticket creator', {
            email: details.requester_email
          });
        }

        // EMAIL 3: Send assignment notification to engineer
        if (assignedToId && assignedEngineerDetails?.email) {
          await emailQueueService.sendTemplatedEmail(
            'TICKET_ASSIGNED',
            assignedEngineerDetails.email,
            {
              ticket_number: ticketNumber,
              subject: details.subject,
              description: details.description,
              priority: details.priority_name,
              category: details.category_name,
              requester_name: details.requester_name,
              assigned_to_name: assignedEngineerDetails.full_name,
              created_at: createdAtFormatted,
              due_date: dueDateFormatted,
              ticket_url: `${appUrl}/tickets/${ticketId}`,
              system_name: generalSettings.system_name || 'IT Helpdesk'
            },
            {
              recipientName: assignedEngineerDetails.full_name,
              recipientUserId: assignedToId,
              emailType: 'TICKET_ASSIGNED',
              relatedEntityType: 'TICKET',
              relatedEntityId: ticketId,
              priority: 1  // High priority for assignment
            }
          );

          logger.success('Assignment email queued for engineer', {
            email: assignedEngineerDetails.email,
            engineerName: assignedEngineerDetails.full_name
          });
        }

      } else {
        logger.info('Email notifications disabled in settings');
      }
    } catch (emailError) {
      logger.error('Failed to send email notifications', emailError);
    }

    // 📱 WhatsApp notification (Phase 9 - fire-and-forget, never blocks ticket creation)
    waNotify.notifyTicketCreated(userId, {
      ticketNumber, subject: details.subject,
      priority: details.priority_name, ticketId
    }).catch(() => {});

    if (assignedToId && assignedEngineerDetails) {
      waNotify.notifyTicketAssigned(assignedToId, userId, {
        ticketNumber, subject: details.subject,
        priority: details.priority_name, assignerName: 'System',
        engineerName: assignedEngineerDetails.full_name, ticketId
      }).catch(() => {});
    }

    logger.separator('TICKET CREATED SUCCESSFULLY');
    logger.success('New ticket created with all notifications', {
      ticketId,
      ticketNumber,
      assignedTo: assignedToId || 'Unassigned'
    });
    logger.separator();

    return res.status(201).json(
      createResponse(true, 'Ticket created successfully', {
        ticket_id: ticketId,
        ticket_number: ticketNumber,
        due_date: dueDate,
        sla_enabled: slaEnabled,
        assigned_to: assignedToId
      })
    );
  } catch (error) {
    logger.error('Create ticket error', error);
    logger.separator();
    next(error);
  }
};

/**
 * Update ticket with COMPLETE NOTIFICATION SYSTEM
 * @route PUT /api/v1/tickets/:id
 * @access Private
 * ⭐ Sends notifications on status change to requester and assigned engineer
 */
const updateTicket = async (req, res, next) => {
  try {
    const ticketId = req.params.id;
    const userId = req.user.user_id;
    
    const canAssign = req.user.permissions?.can_assign_tickets || false;
    const canClose = req.user.permissions?.can_close_tickets || false;

    logger.separator('TICKET UPDATE - WITH NOTIFICATIONS');
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
      sub_category_id,
      other_category_text,
      location_id,
      process_id,
      team_id,
      custom_fields,
    } = req.body;

    // Check if ticket exists and get current state (including lookup names for change tracking)
    const ticketCheck = await executeQuery(
      `SELECT 
        t.ticket_id, t.ticket_number, t.subject, t.description, t.requester_id, 
        t.assigned_to, t.status_id, t.priority_id, t.category_id, t.department_id,
        t.resolution_notes, t.team_id,
        ts.status_name as old_status_name,
        tp.priority_name as old_priority_name,
        tc.category_name as old_category_name,
        d.department_name as old_department_name,
        tm.team_name as old_team_name,
        u_req.email as requester_email,
        u_req.first_name + ' ' + u_req.last_name as requester_name,
        u_eng.email as assigned_email,
        u_eng.first_name + ' ' + u_eng.last_name as assigned_name
      FROM tickets t
      LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
      LEFT JOIN ticket_priorities tp ON t.priority_id = tp.priority_id
      LEFT JOIN ticket_categories tc ON t.category_id = tc.category_id
      LEFT JOIN departments d ON t.department_id = d.department_id
      LEFT JOIN teams tm ON t.team_id = tm.team_id
      LEFT JOIN users u_req ON t.requester_id = u_req.user_id
      LEFT JOIN users u_eng ON t.assigned_to = u_eng.user_id
      WHERE t.ticket_id = @ticketId`,
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
    const oldAssignedTo = ticket.assigned_to;

    // Check permission using role, not just permission flags
    const isOwner = ticket.requester_id === userId;
    const isAssigned = ticket.assigned_to === userId;
    const roleCode = req.user.role?.role_code || '';
    const isAdminOrManager = roleCode === 'ADMIN' || roleCode === 'MANAGER';
    const isEngineerRole = roleCode === 'ENGINEER';

    // Check if ticket is in final status (CLOSED/RESOLVED/CANCELLED)
    // For final-status tickets, only the requester (owner) or admin/manager can edit
    const statusCheckQuery = `SELECT is_final_status, status_code FROM ticket_statuses WHERE status_id = @statusId`;
    const statusCheckResult = await executeQuery(statusCheckQuery, { statusId: ticket.status_id });
    const currentStatus = statusCheckResult.recordset[0];
    const isFinalStatus = currentStatus?.is_final_status;

    if (isFinalStatus) {
      // Only owner or admin/manager can edit closed/resolved tickets
      if (!isOwner && !isAdminOrManager) {
        logger.warn('Unauthorized update on closed/resolved ticket', { ticketId, userId, status: currentStatus?.status_code });
        logger.separator();
        return res.status(403).json(
          createResponse(false, 'Only the ticket creator or admin can edit closed/resolved tickets')
        );
      }
    } else {
      // For non-final tickets, owner, assigned engineer, or admin/manager can edit
      if (!isOwner && !isAssigned && !isAdminOrManager) {
        logger.warn('Unauthorized update attempt', { ticketId, userId });
        logger.separator();
        return res.status(403).json(
          createResponse(false, 'You do not have permission to update this ticket')
        );
      }
    }

    // Build update query
    const updateFields = [];
    const params = { ticketId };

    // ROLE-BASED FIELD RESTRICTIONS (server-side enforcement)
    // Engineers can ONLY change status_id and resolution_notes
    if (isEngineerRole && !isAdminOrManager) {
      const restrictedFields = ['subject', 'description', 'category_id', 'priority_id', 
        'assigned_to', 'department_id', 'sub_category_id', 'other_category_text', 
        'location_id', 'process_id'];
      
      const attemptedRestrictedFields = restrictedFields.filter(f => req.body[f] !== undefined);
      
      if (attemptedRestrictedFields.length > 0) {
        logger.warn('Engineer attempted to modify restricted fields', { 
          ticketId, userId, fields: attemptedRestrictedFields 
        });
        logger.separator();
        return res.status(403).json(
          createResponse(false, 'Engineers can only update status and resolution notes')
        );
      }
    }

    // Creators cannot change subject and department after creation
    if (isOwner && !isAdminOrManager && !isEngineerRole) {
      if (subject !== undefined && subject !== ticket.subject) {
        logger.warn('Creator attempted to change subject', { ticketId, userId });
        logger.separator();
        return res.status(403).json(
          createResponse(false, 'Ticket subject cannot be changed after creation')
        );
      }
      if (department_id !== undefined && department_id !== ticket.department_id) {
        logger.warn('Creator attempted to change department', { ticketId, userId });
        logger.separator();
        return res.status(403).json(
          createResponse(false, 'Ticket department cannot be changed after creation')
        );
      }
    }

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

      const statusCheckQuery = `
        SELECT is_final_status 
        FROM ticket_statuses 
        WHERE status_id = @statusId
      `;
      const statusResult = await executeQuery(statusCheckQuery, { statusId: status_id });
      
      if (statusResult.recordset[0].is_final_status) {
        // Set both resolved_at and closed_at for final status
        updateFields.push('resolved_at = COALESCE(resolved_at, GETDATE())');
        updateFields.push('closed_at = GETDATE()');
      }
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
    if (sub_category_id !== undefined) {
      updateFields.push('sub_category_id = @subCategoryId');
      params.subCategoryId = sub_category_id || null;
    }
    if (other_category_text !== undefined) {
      updateFields.push('other_category_text = @otherCategoryText');
      params.otherCategoryText = other_category_text || null;
    }
    if (location_id !== undefined) {
      updateFields.push('location_id = @locationId');
      params.locationId = location_id || null;
    }
    if (process_id !== undefined) {
      updateFields.push('process_id = @processId');
      params.processId = process_id || null;
    }
    if (team_id !== undefined && canAssign) {
      const newTeamId = team_id ? parseInt(team_id) : null;
      if (newTeamId !== ticket.team_id) {
        updateFields.push('team_id = @teamId');
        updateFields.push('routed_at = GETDATE()');
        updateFields.push('routed_by_user_id = @routedByUserId');
        params.teamId = newTeamId;
        params.routedByUserId = userId;
      }
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

    // Update custom field values if provided
    if (custom_fields && Array.isArray(custom_fields) && custom_fields.length > 0) {
      // Delete existing custom field values for this ticket
      await executeQuery(
        'DELETE FROM ticket_custom_field_values WHERE ticket_id = @ticketId',
        { ticketId }
      );
      // Insert new values
      for (const field of custom_fields) {
        if (field.field_id && field.value !== undefined && field.value !== null && field.value !== '') {
          await executeQuery(
            `INSERT INTO ticket_custom_field_values (ticket_id, field_id, field_value)
             VALUES (@ticketId, @fieldId, @fieldValue)`,
            { ticketId, fieldId: field.field_id, fieldValue: String(field.value) }
          );
        }
      }
    }

    // Get updater's name
    const updaterQuery = `SELECT ISNULL(first_name, '') + ' ' + ISNULL(last_name, '') as full_name FROM users WHERE user_id = @userId`;
    const updaterResult = await executeQuery(updaterQuery, { userId });
    const updaterName = updaterResult.recordset[0]?.full_name?.trim() || 'System';

    // ============================================
    // LOG SPECIFIC ACTIVITIES — one per changed field
    // When status is changing, suppress minor UPDATED activities
    // (they are noise alongside the status change)
    // ============================================
    const statusChanging = status_id !== undefined && parseInt(status_id) !== ticket.status_id;

    const activityInsert = `
      INSERT INTO ticket_activities (
        ticket_id, activity_type, field_name, old_value, new_value, description, performed_by
      )
      VALUES (@ticketId, @activityType, @fieldName, @oldValue, @newValue, @desc, @userId)
    `;

    // --- Status change ---
    if (statusChanging) {
      const newStatusResult = await executeQuery(
        `SELECT status_name FROM ticket_statuses WHERE status_id = @statusId`,
        { statusId: status_id }
      );
      const newStatusName = newStatusResult.recordset[0]?.status_name || 'Unknown';
      await executeQuery(activityInsert, {
        ticketId, userId,
        activityType: 'STATUS_CHANGED',
        fieldName: 'status',
        oldValue: ticket.old_status_name || 'Unknown',
        newValue: newStatusName,
        desc: `Status changed from "${ticket.old_status_name}" to "${newStatusName}" by ${updaterName}`,
      });
      logger.success('Activity logged: STATUS_CHANGED');
    }

    // --- Priority change ---
    if (priority_id !== undefined && parseInt(priority_id) !== ticket.priority_id) {
      const newPriorityResult = await executeQuery(
        `SELECT priority_name FROM ticket_priorities WHERE priority_id = @priorityId`,
        { priorityId: priority_id }
      );
      const newPriorityName = newPriorityResult.recordset[0]?.priority_name || 'Unknown';
      await executeQuery(activityInsert, {
        ticketId, userId,
        activityType: 'PRIORITY_CHANGED',
        fieldName: 'priority',
        oldValue: ticket.old_priority_name || 'Unknown',
        newValue: newPriorityName,
        desc: `Priority changed from "${ticket.old_priority_name}" to "${newPriorityName}" by ${updaterName}`,
      });
      logger.success('Activity logged: PRIORITY_CHANGED');
    }

    // --- Category change (skip if status also changing) ---
    if (category_id !== undefined && parseInt(category_id) !== ticket.category_id && !statusChanging) {
      const newCatResult = await executeQuery(
        `SELECT category_name FROM ticket_categories WHERE category_id = @categoryId`,
        { categoryId: category_id }
      );
      const newCatName = newCatResult.recordset[0]?.category_name || 'Unknown';
      await executeQuery(activityInsert, {
        ticketId, userId,
        activityType: 'UPDATED',
        fieldName: 'category',
        oldValue: ticket.old_category_name || 'Unknown',
        newValue: newCatName,
        desc: `Category changed from "${ticket.old_category_name}" to "${newCatName}" by ${updaterName}`,
      });
      logger.success('Activity logged: category change');
    }

    // --- Department change (skip if status also changing) ---
    if (department_id !== undefined && (department_id || null) !== (ticket.department_id || null) && !statusChanging) {
      const newDeptResult = department_id ? await executeQuery(
        `SELECT department_name FROM departments WHERE department_id = @departmentId`,
        { departmentId: department_id }
      ) : { recordset: [{ department_name: 'None' }] };
      const newDeptName = newDeptResult.recordset[0]?.department_name || 'None';
      await executeQuery(activityInsert, {
        ticketId, userId,
        activityType: 'UPDATED',
        fieldName: 'department',
        oldValue: ticket.old_department_name || 'None',
        newValue: newDeptName,
        desc: `Department changed from "${ticket.old_department_name || 'None'}" to "${newDeptName}" by ${updaterName}`,
      });
      logger.success('Activity logged: department change');
    }

    // --- Assignment change (via update endpoint) ---
    if (assigned_to !== undefined && canAssign && (assigned_to || null) !== (ticket.assigned_to || null)) {
      let newAssigneeName = 'Unassigned';
      if (assigned_to) {
        const newAssigneeResult = await executeQuery(
          `SELECT first_name + ' ' + last_name as full_name FROM users WHERE user_id = @assignedTo`,
          { assignedTo: assigned_to }
        );
        newAssigneeName = newAssigneeResult.recordset[0]?.full_name || 'Unknown';
      }
      await executeQuery(activityInsert, {
        ticketId, userId,
        activityType: 'ASSIGNED',
        fieldName: 'assigned_to',
        oldValue: ticket.assigned_name || 'Unassigned',
        newValue: newAssigneeName,
        desc: `Ticket ${assigned_to ? `assigned to ${newAssigneeName}` : 'unassigned'} by ${updaterName}`,
      });
      logger.success('Activity logged: assignment change');
    }

    // --- Team / bucket change ---
    if (team_id !== undefined && canAssign) {
      const newTeamId = team_id ? parseInt(team_id) : null;
      if (newTeamId !== ticket.team_id) {
        let newTeamName = 'None';
        if (newTeamId) {
          const newTeamResult = await executeQuery(
            `SELECT team_name FROM teams WHERE team_id = @teamId`,
            { teamId: newTeamId }
          );
          newTeamName = newTeamResult.recordset[0]?.team_name || 'Unknown';
        }
        await executeQuery(activityInsert, {
          ticketId, userId,
          activityType: 'TEAM_ROUTED',
          fieldName: 'team_id',
          oldValue: ticket.old_team_name || 'None',
          newValue: newTeamName,
          desc: `Ticket ${newTeamId ? `routed to ${newTeamName}` : 'removed from team bucket'} by ${updaterName}`,
        });
        logger.success('Activity logged: team change');
      }
    }

    // --- Subject change (skip if status also changing) ---
    if (subject !== undefined && subject !== ticket.subject && !statusChanging) {
      await executeQuery(activityInsert, {
        ticketId, userId,
        activityType: 'UPDATED',
        fieldName: 'subject',
        oldValue: ticket.subject,
        newValue: subject,
        desc: `Subject updated by ${updaterName}`,
      });
      logger.success('Activity logged: subject change');
    }

    // --- Description change (skip if status also changing) ---
    if (description !== undefined && description !== ticket.description && !statusChanging) {
      await executeQuery(activityInsert, {
        ticketId, userId,
        activityType: 'UPDATED',
        fieldName: 'description',
        oldValue: null,
        newValue: null,
        desc: `Description updated by ${updaterName}`,
      });
      logger.success('Activity logged: description change');
    }

    // --- Resolution notes change (skip if status also changing) ---
    if (resolution_notes !== undefined && resolution_notes !== ticket.resolution_notes && !statusChanging) {
      await executeQuery(activityInsert, {
        ticketId, userId,
        activityType: 'UPDATED',
        fieldName: 'resolution_notes',
        oldValue: null,
        newValue: null,
        desc: `Resolution notes ${ticket.resolution_notes ? 'updated' : 'added'} by ${updaterName}`,
      });
      logger.success('Activity logged: resolution notes change');
    }

    // ============================================
    // ⭐ NOTIFICATIONS FOR STATUS CHANGE
    // ============================================
    if (status_id !== undefined && status_id !== oldStatusId) {
      try {
        logger.try('Sending status change notifications');

        const notificationSettings = await settingsService.getByCategory('notification');
        const generalSettings = await settingsService.getByCategory('general');
        const appUrl = getPublicAppUrl();

        // Get new status name
        const newStatusQuery = `SELECT status_name FROM ticket_statuses WHERE status_id = @statusId`;
        const newStatusResult = await executeQuery(newStatusQuery, { statusId: status_id });
        const newStatusName = newStatusResult.recordset[0]?.status_name || 'Updated';

        // NOTIFICATION: Requester - Status Changed
        if (ticket.requester_id !== userId) {
          const requesterNotifQuery = `
            INSERT INTO notifications (
              user_id, notification_type, title, message, related_ticket_id
            )
            VALUES (
              @requesterId,
              'STATUS_CHANGED',
              'Ticket Status Updated',
              'Your ticket #' + @ticketNumber + ' status has been changed to "' + @newStatus + '" by ' + @updaterName,
              @ticketId
            )
          `;

          await executeQuery(requesterNotifQuery, {
            requesterId: ticket.requester_id,
            ticketNumber: ticket.ticket_number,
            newStatus: newStatusName,
            updaterName,
            ticketId,
          });

          logger.success('Status change notification sent to requester');
        }

        // NOTIFICATION: Assigned Engineer - Status Changed (if not the one who updated)
        if (ticket.assigned_to && ticket.assigned_to !== userId) {
          const engineerNotifQuery = `
            INSERT INTO notifications (
              user_id, notification_type, title, message, related_ticket_id
            )
            VALUES (
              @assignedTo,
              'STATUS_CHANGED',
              'Ticket Status Updated',
              'Ticket #' + @ticketNumber + ' status has been changed to "' + @newStatus + '" by ' + @updaterName,
              @ticketId
            )
          `;

          await executeQuery(engineerNotifQuery, {
            assignedTo: ticket.assigned_to,
            ticketNumber: ticket.ticket_number,
            newStatus: newStatusName,
            updaterName,
            ticketId,
          });

          logger.success('Status change notification sent to assigned engineer');
        }

        // EMAIL: Send status change email
        const emailEnabled = notificationSettings.notify_on_ticket_updated === 'true' || notificationSettings.notify_on_ticket_updated === true;

        if (emailEnabled) {
          // Email to requester
          if (ticket.requester_email && ticket.requester_id !== userId) {
            await emailQueueService.sendTemplatedEmail(
              'TICKET_STATUS_CHANGED',
              ticket.requester_email,
              {
                ticket_number: ticket.ticket_number,
                subject: ticket.subject,
                old_status: ticket.old_status_name,
                new_status: newStatusName,
                updated_by_name: updaterName,
                user_name: ticket.requester_name,
                ticket_url: `${appUrl}/tickets/${ticketId}`,
                system_name: generalSettings.system_name || 'IT Helpdesk'
              },
              {
                recipientName: ticket.requester_name,
                emailType: 'TICKET_STATUS_CHANGED',
                relatedEntityType: 'TICKET',
                relatedEntityId: ticketId,
                priority: 3
              }
            );

            logger.success('Status change email queued for requester');
          }

          // Email to assigned engineer
          if (ticket.assigned_email && ticket.assigned_to !== userId) {
            await emailQueueService.sendTemplatedEmail(
              'TICKET_STATUS_CHANGED',
              ticket.assigned_email,
              {
                ticket_number: ticket.ticket_number,
                subject: ticket.subject,
                old_status: ticket.old_status_name,
                new_status: newStatusName,
                updated_by_name: updaterName,
                user_name: ticket.assigned_name,
                ticket_url: `${appUrl}/tickets/${ticketId}`,
                system_name: generalSettings.system_name || 'IT Helpdesk'
              },
              {
                recipientName: ticket.assigned_name,
                emailType: 'TICKET_STATUS_CHANGED',
                relatedEntityType: 'TICKET',
                relatedEntityId: ticketId,
                priority: 3
              }
            );

            logger.success('Status change email queued for assigned engineer');
          }
        }

        // 📱 WhatsApp notification (Phase 9 - fire-and-forget)
        waNotify.notifyStatusChanged(
          ticket.requester_id, ticket.assigned_to, userId,
          { ticketNumber: ticket.ticket_number, subject: ticket.subject,
            oldStatus: ticket.old_status_name, newStatus: newStatusName,
            updaterName, ticketId }
        ).catch(() => {});
      } catch (notifError) {
        logger.error('Failed to send status change notifications', notifError);
      }
    }

    logger.separator('TICKET UPDATED SUCCESSFULLY');
    logger.success('Ticket updated', {
      ticketId,
      fieldsUpdated: updateFields.length,
    });
    logger.separator();

    // ============================================
    // AUTO-TRAINING: Learn from resolved ticket
    // Non-blocking — fires when status moves to a final state and resolution_notes exist
    // ============================================
    if (status_id !== undefined) {
      try {
        const finalCheck = await executeQuery(
          `SELECT is_final_status FROM ticket_statuses WHERE status_id = @statusId`,
          { statusId: status_id }
        );
        const isFinjal = finalCheck.recordset[0]?.is_final_status;
        const finalNotes = resolution_notes || ticket.resolution_notes;
        if (isFinjal && finalNotes && String(finalNotes).length >= 20) {
          const botTrainingService = require('../services/botTrainingService');
          botTrainingService.learnFromTicket(
            {
              ticket_id: ticketId,
              ticket_number: ticket.ticket_number,
              subject: subject || ticket.subject,
              description: description || ticket.description,
              resolution_notes: finalNotes,
            },
            { patternsSkipped: 0, newPatternsLearned: 0 }
          ).catch(err => logger.warn('Auto-training on resolve failed (non-blocking):', err.message));
        }
      } catch (trainCheckErr) {
        logger.warn('Auto-training status check failed (non-blocking):', trainCheckErr.message);
      }
    }

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
 * Assign ticket to engineer with COMPLETE NOTIFICATION SYSTEM
 * @route PATCH /api/v1/tickets/:id/assign
 * @access Private (Admin/Manager/Engineer)
 * ⭐ Sends notifications to:
 *    - Newly assigned engineer (you have a new ticket)
 *    - Ticket requester (your ticket was assigned to X)
 *    - Previously assigned engineer (ticket reassigned - if applicable)
 */
const assignTicket = async (req, res, next) => {
  try {
    const ticketId = req.params.id;
    const { assigned_to } = req.body;
    const userId = req.user.user_id;

    logger.separator('TICKET ASSIGNMENT - WITH NOTIFICATIONS');
    logger.try('Assigning ticket', {
      ticketId,
      assignedTo: assigned_to,
      assignedBy: userId,
    });

    // Get ticket details with current assignment first (needed for permission check)
    const ticketCheck = await executeQuery(
      `SELECT 
        t.ticket_id, t.ticket_number, t.subject, t.requester_id, t.assigned_to,
        tp.priority_name,
        t.due_date,
        ts.is_final_status, ts.status_code,
        u_req.email as requester_email,
        u_req.first_name + ' ' + u_req.last_name as requester_name,
        u_old.email as old_assigned_email,
        u_old.first_name + ' ' + u_old.last_name as old_assigned_name
      FROM tickets t
      LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
      LEFT JOIN ticket_priorities tp ON t.priority_id = tp.priority_id
      LEFT JOIN users u_req ON t.requester_id = u_req.user_id
      LEFT JOIN users u_old ON t.assigned_to = u_old.user_id
      WHERE t.ticket_id = @ticketId`,
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
    const oldAssignedTo = ticket.assigned_to;
    const isReassignment = !!oldAssignedTo && assigned_to && oldAssignedTo !== assigned_to;

    // Permission check:
    // - Admin/Manager (role_code ADMIN/MANAGER) can always assign/reassign
    // - Assigned engineer can ONLY reassign (ticket must already be assigned to them)
    const roleCode = req.user.role?.role_code || '';
    const isAdminOrManager = roleCode === 'ADMIN' || roleCode === 'MANAGER';
    const isCurrentlyAssigned = ticket.assigned_to === userId;

    if (!isAdminOrManager && !(isCurrentlyAssigned && isReassignment)) {
      logger.warn('Unauthorized assignment attempt', { userId, roleCode, isCurrentlyAssigned, isReassignment });
      logger.separator();
      return res.status(403).json(
        createResponse(false, isCurrentlyAssigned 
          ? 'You can only reassign tickets that are assigned to you' 
          : 'You do not have permission to assign tickets')
      );
    }

    // Get new assignee details — with role validation
    let newAssigneeDetails = null;
    if (assigned_to) {
      // Validate the assignee is eligible (must be ENGINEER, MANAGER, or ADMIN)
      const autoAssignmentService = require('../services/autoAssignment.service');
      const validation = await autoAssignmentService.validateAssignee(assigned_to);
      
      if (!validation.valid) {
        logger.warn('Invalid assignee', { assignedTo: assigned_to, reason: validation.reason });
        logger.separator();
        return res.status(400).json(
          createResponse(false, validation.reason)
        );
      }

      newAssigneeDetails = {
        user_id: validation.user.user_id,
        email: null, // will fetch below
        full_name: validation.user.full_name,
      };

      // Get email for notifications
      const emailQuery = `SELECT email FROM users WHERE user_id = @assignedTo`;
      const emailResult = await executeQuery(emailQuery, { assignedTo: assigned_to });
      if (emailResult.recordset.length > 0) {
        newAssigneeDetails.email = emailResult.recordset[0].email;
      }
    }

    // Get assigner's name
    const assignerQuery = `SELECT ISNULL(first_name, '') + ' ' + ISNULL(last_name, '') as full_name FROM users WHERE user_id = @userId`;
    const assignerResult = await executeQuery(assignerQuery, { userId });
    const assignerName = assignerResult.recordset[0]?.full_name?.trim() || 'System';

    // Update assignment (no first_response_at — assignment is NOT first response)
    const updateQuery = `
      UPDATE tickets
      SET assigned_to = @assignedTo, 
          updated_at = GETDATE()
      WHERE ticket_id = @ticketId
    `;

    await executeQuery(updateQuery, {
      ticketId,
      assignedTo: assigned_to || null,
    });

    // Log activity with proper field tracking — differentiate ASSIGNED vs REASSIGNED
    const newAssigneeName = newAssigneeDetails?.full_name?.trim() || 'Engineer';
    const activityType = isReassignment ? 'REASSIGNED' : 'ASSIGNED';
    const activityDescription = isReassignment
      ? `Ticket reassigned from ${ticket.old_assigned_name?.trim() || 'Engineer'} to ${newAssigneeName} by ${assignerName}`
      : assigned_to 
        ? `Ticket assigned to ${newAssigneeName} by ${assignerName}`
        : `Ticket unassigned by ${assignerName}`;

    const activityQuery = `
      INSERT INTO ticket_activities (
        ticket_id, activity_type, field_name, old_value, new_value, description, performed_by
      )
      VALUES (@ticketId, @activityType, 'assigned_to', @oldValue, @newValue, @description, @userId)
    `;

    await executeQuery(activityQuery, {
      ticketId,
      activityType,
      oldValue: ticket.old_assigned_name?.trim() || 'Unassigned',
      newValue: newAssigneeName,
      description: activityDescription,
      userId,
    });

    // ============================================
    // ⭐ NOTIFICATION SECTION - ALL PARTIES
    // ============================================
    const notificationSettings = await settingsService.getByCategory('notification');
    const generalSettings = await settingsService.getByCategory('general');
    const appUrl = getPublicAppUrl();

    const emailEnabled = notificationSettings.notify_on_ticket_assigned === 'true' || notificationSettings.notify_on_ticket_assigned === true;

    // Format due date
    const dueDateFormatted = ticket.due_date ? await dateUtils.formatDateTime(ticket.due_date) : 'Not set';

    // ============================================
    // NOTIFICATION 1: NEW ASSIGNEE - Ticket assigned to you
    // ============================================
    if (assigned_to && newAssigneeDetails) {
      // In-app notification
      const engineerNotifQuery = `
        INSERT INTO notifications (
          user_id, notification_type, title, message, related_ticket_id
        )
        VALUES (
          @assignedTo,
          'TICKET_ASSIGNED',
          'New Ticket Assigned to You',
          'Ticket #' + @ticketNumber + ' - ' + @subject + ' has been assigned to you by ' + @assignerName + '. Priority: ' + @priority,
          @ticketId
        )
      `;

      await executeQuery(engineerNotifQuery, {
        assignedTo: assigned_to,
        ticketNumber: ticket.ticket_number,
        subject: ticket.subject,
        assignerName,
        priority: ticket.priority_name,
        ticketId,
      });

      logger.success('Assignment notification sent to new engineer', { assignedTo: assigned_to });

      // Email notification
      if (emailEnabled && newAssigneeDetails.email) {
        await emailQueueService.sendTemplatedEmail(
          'TICKET_ASSIGNED',
          newAssigneeDetails.email,
          {
            ticket_number: ticket.ticket_number,
            subject: ticket.subject,
            priority: ticket.priority_name,
            due_date: dueDateFormatted,
            assigned_to_name: newAssigneeDetails.full_name,
            assigned_by_name: assignerName,
            requester_name: ticket.requester_name,
            ticket_url: `${appUrl}/tickets/${ticketId}`,
            system_name: generalSettings.system_name || 'IT Helpdesk'
          },
          {
            recipientName: newAssigneeDetails.full_name,
            recipientUserId: assigned_to,
            emailType: 'TICKET_ASSIGNED',
            relatedEntityType: 'TICKET',
            relatedEntityId: ticketId,
            priority: 1  // High priority
          }
        );

        logger.success('Assignment email queued for new engineer', { email: newAssigneeDetails.email });
      }
    }

    // ============================================
    // NOTIFICATION 2: REQUESTER - Your ticket was assigned
    // ============================================
    if (ticket.requester_id !== userId) {
      const requesterMessage = assigned_to && newAssigneeDetails
        ? `Your ticket #${ticket.ticket_number} has been assigned to ${newAssigneeDetails.full_name}. They will be assisting you with your request.`
        : `Your ticket #${ticket.ticket_number} has been unassigned and is pending reassignment.`;

      // In-app notification
      const requesterNotifQuery = `
        INSERT INTO notifications (
          user_id, notification_type, title, message, related_ticket_id
        )
        VALUES (
          @requesterId,
          'TICKET_ASSIGNED',
          'Ticket Assignment Update',
          @message,
          @ticketId
        )
      `;

      await executeQuery(requesterNotifQuery, {
        requesterId: ticket.requester_id,
        message: requesterMessage,
        ticketId,
      });

      logger.success('Assignment notification sent to requester');

      // Email notification
      if (emailEnabled && ticket.requester_email) {
        await emailQueueService.sendTemplatedEmail(
          'TICKET_ASSIGNED_REQUESTER',
          ticket.requester_email,
          {
            ticket_number: ticket.ticket_number,
            subject: ticket.subject,
            assigned_to_name: newAssigneeDetails?.full_name || 'Pending',
            requester_name: ticket.requester_name,
            ticket_url: `${appUrl}/tickets/${ticketId}`,
            system_name: generalSettings.system_name || 'IT Helpdesk'
          },
          {
            recipientName: ticket.requester_name,
            recipientUserId: ticket.requester_id,
            emailType: 'TICKET_ASSIGNED_REQUESTER',
            relatedEntityType: 'TICKET',
            relatedEntityId: ticketId,
            priority: 3
          }
        );

        logger.success('Assignment email queued for requester', { email: ticket.requester_email });
      }
    }

    // ============================================
    // NOTIFICATION 3: OLD ASSIGNEE - Ticket reassigned (if different)
    // ============================================
    if (oldAssignedTo && oldAssignedTo !== assigned_to && oldAssignedTo !== userId) {
      // In-app notification
      const oldAssigneeNotifQuery = `
        INSERT INTO notifications (
          user_id, notification_type, title, message, related_ticket_id
        )
        VALUES (
          @oldAssignedTo,
          'TICKET_REASSIGNED',
          'Ticket Reassigned',
          'Ticket #' + @ticketNumber + ' - ' + @subject + ' has been reassigned to another engineer by ' + @assignerName,
          @ticketId
        )
      `;

      await executeQuery(oldAssigneeNotifQuery, {
        oldAssignedTo,
        ticketNumber: ticket.ticket_number,
        subject: ticket.subject,
        assignerName,
        ticketId,
      });

      logger.success('Reassignment notification sent to old engineer', { oldAssignedTo });

      // Email notification
      if (emailEnabled && ticket.old_assigned_email) {
        await emailQueueService.sendTemplatedEmail(
          'TICKET_REASSIGNED',
          ticket.old_assigned_email,
          {
            ticket_number: ticket.ticket_number,
            subject: ticket.subject,
            new_assigned_name: newAssigneeDetails?.full_name || 'Another Engineer',
            reassigned_by_name: assignerName,
            ticket_url: `${appUrl}/tickets/${ticketId}`,
            system_name: generalSettings.system_name || 'IT Helpdesk'
          },
          {
            recipientName: ticket.old_assigned_name,
            recipientUserId: oldAssignedTo,
            emailType: 'TICKET_REASSIGNED',
            relatedEntityType: 'TICKET',
            relatedEntityId: ticketId,
            priority: 3
          }
        );

        logger.success('Reassignment email queued for old engineer', { email: ticket.old_assigned_email });
      }
    }

    // 📱 WhatsApp notification (Phase 9 - fire-and-forget)
    if (assigned_to) {
      waNotify.notifyTicketAssigned(assigned_to, ticket.requester_id, {
        ticketNumber: ticket.ticket_number, subject: ticket.subject,
        priority: ticket.priority_name || 'Normal', assignerName,
        engineerName: newAssigneeDetails?.full_name || '', ticketId
      }).catch(() => {});
    }

    logger.separator('TICKET ASSIGNED SUCCESSFULLY');
    logger.success('Assignment completed with all notifications', {
      ticketId,
      oldAssignedTo: oldAssignedTo || 'None',
      newAssignedTo: assigned_to || 'Unassigned',
    });
    logger.separator();

    return res.status(200).json(
      createResponse(true, 'Ticket assigned successfully', {
        ticket_id: ticketId,
        assigned_to: assigned_to,
        assigned_to_name: newAssigneeDetails?.full_name || null
      })
    );
  } catch (error) {
    logger.error('Assign ticket error', error);
    logger.separator();
    next(error);
  }
};

/**
 * Add comment to ticket with COMPLETE NOTIFICATION SYSTEM
 * @route POST /api/v1/tickets/:id/comments
 * @access Private
 * ⭐ Sends notifications to:
 *    - Ticket requester (if commenter is not the requester)
 *    - Assigned engineer (if commenter is not the assigned engineer)
 */
const addComment = async (req, res, next) => {
  try {
    const ticketId = req.params.id;
    const { comment_text, is_internal } = req.body;
    const userId = req.user.user_id;

    if (!comment_text || typeof comment_text !== 'string' || !comment_text.trim()) {
      return res.status(400).json(
        createResponse(false, 'Comment text is required')
      );
    }

    logger.separator('ADD COMMENT - WITH NOTIFICATIONS');
    logger.try('Adding comment to ticket', {
      ticketId,
      isInternal: is_internal || false,
      userId,
    });

    // Get ticket details
    const ticketCheck = await executeQuery(
      `SELECT 
        t.ticket_id, t.ticket_number, t.subject, t.requester_id, t.assigned_to,
        u_req.email as requester_email,
        u_req.first_name + ' ' + u_req.last_name as requester_name,
        u_eng.email as assigned_email,
        u_eng.first_name + ' ' + u_eng.last_name as assigned_name
      FROM tickets t
      LEFT JOIN users u_req ON t.requester_id = u_req.user_id
      LEFT JOIN users u_eng ON t.assigned_to = u_eng.user_id
      WHERE t.ticket_id = @ticketId`,
      { ticketId }
    );

    if (ticketCheck.recordset.length === 0) {
      logger.warn('Ticket not found', { ticketId });
      return res.status(404).json(
        createResponse(false, 'Ticket not found')
      );
    }

    const ticket = ticketCheck.recordset[0];

    // Check if user has permission to comment on this ticket
    const roleCode = req.user.role?.role_code || '';
    const isAdminOrManager = roleCode === 'ADMIN' || roleCode === 'MANAGER';
    const isRequester = ticket.requester_id === userId;
    const isAssigned = ticket.assigned_to === userId;

    // Unassigned ticket: only admin/manager/requester can comment
    // Assigned ticket: only assigned engineer/admin/manager/requester can comment
    let hasAccess = false;
    if (isAdminOrManager || isRequester) {
      hasAccess = true;
    } else if (ticket.assigned_to && isAssigned) {
      hasAccess = true;
    }

    if (!hasAccess) {
      logger.warn('Unauthorized comment attempt', {
        ticketId,
        userId,
        requester: ticket.requester_id,
        assigned: ticket.assigned_to,
      });
      return res.status(403).json(
        createResponse(false, 'You do not have permission to comment on this ticket')
      );
    }

    // Get commenter's name
    const commenterQuery = `SELECT first_name + ' ' + last_name as full_name FROM users WHERE user_id = @userId`;
    const commenterResult = await executeQuery(commenterQuery, { userId });
    const commenterName = commenterResult.recordset[0]?.full_name || 'User';

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

    // Note: No separate activity log needed — comments are tracked in ticket_comments
    // and shown directly in the ticket journey via the comments query.

    // ============================================
    // ⭐ FIRST RESPONSE TRACKING
    // First response = first non-internal comment by someone other than the requester
    // ============================================
    if (!is_internal && userId !== ticket.requester_id) {
      try {
        const frCheck = await executeQuery(
          `SELECT first_response_at, created_at FROM tickets WHERE ticket_id = @ticketId`,
          { ticketId }
        );
        const ticketRow = frCheck.recordset[0];
        if (!ticketRow.first_response_at) {
          // Get SLA response_time_hours for this ticket's priority
          const slaQuery = `
            SELECT tp.response_time_hours 
            FROM tickets t 
            JOIN ticket_priorities tp ON t.priority_id = tp.priority_id 
            WHERE t.ticket_id = @ticketId
          `;
          const slaResult = await executeQuery(slaQuery, { ticketId });
          const responseTimeHours = slaResult.recordset[0]?.response_time_hours;

          // Calculate if SLA was met (using business hours via slaService)
          let slaMet = null;
          if (responseTimeHours) {
            const createdAt = new Date(ticketRow.created_at);
            try {
              // Calculate the SLA response due date using business hours
              const responseDueDate = await slaService.calculateDueDate(createdAt, responseTimeHours);
              if (responseDueDate) {
                slaMet = new Date() <= responseDueDate ? 1 : 0;
              } else {
                // SLA disabled — still record response but don't mark SLA
                slaMet = null;
              }
            } catch (slaErr) {
              // Fallback to wall-clock if slaService fails
              logger.warn('SLA business hours calc failed, using wall-clock fallback', { error: slaErr.message });
              const now = new Date();
              const diffMinutes = (now - createdAt) / (1000 * 60);
              slaMet = diffMinutes <= (responseTimeHours * 60) ? 1 : 0;
            }
          }

          await executeQuery(
            `UPDATE tickets 
             SET first_response_at = GETDATE(),
                 first_response_sla_met = @slaMet
             WHERE ticket_id = @ticketId`,
            { ticketId, slaMet }
          );
          logger.success('First response recorded', { ticketId, slaMet });
        }
      } catch (frErr) {
        logger.warn('Failed to track first response', { error: frErr.message });
      }
    }

    // ============================================
    // ⭐ NOTIFICATION SECTION (Only for non-internal comments)
    // ============================================
    if (!is_internal) {
      try {
        const notificationSettings = await settingsService.getByCategory('notification');
        const generalSettings = await settingsService.getByCategory('general');
        const appUrl = getPublicAppUrl();

        const emailEnabled = notificationSettings.notify_on_ticket_commented === 'true' || notificationSettings.notify_on_ticket_commented === true;

        // Truncate comment for notification (first 100 chars)
        const commentPreview = comment_text.length > 100 
          ? comment_text.substring(0, 100) + '...' 
          : comment_text;

        // ============================================
        // NOTIFICATION 1: REQUESTER (if commenter is not the requester)
        // ============================================
        if (ticket.requester_id !== userId) {
          // In-app notification
          const requesterNotifQuery = `
            INSERT INTO notifications (
              user_id, notification_type, title, message, related_ticket_id
            )
            VALUES (
              @requesterId,
              'COMMENT_ADDED',
              'New Comment on Your Ticket',
              @commenterName + ' commented on ticket #' + @ticketNumber + ': "' + @commentPreview + '"',
              @ticketId
            )
          `;

          await executeQuery(requesterNotifQuery, {
            requesterId: ticket.requester_id,
            commenterName,
            ticketNumber: ticket.ticket_number,
            commentPreview,
            ticketId,
          });

          logger.success('Comment notification sent to requester');

          // Email notification
          if (emailEnabled && ticket.requester_email) {
            await emailQueueService.sendTemplatedEmail(
              'TICKET_COMMENTED',
              ticket.requester_email,
              {
                ticket_number: ticket.ticket_number,
                subject: ticket.subject,
                commenter_name: commenterName,
                comment_text: comment_text,
                user_name: ticket.requester_name,
                ticket_url: `${appUrl}/tickets/${ticketId}`,
                system_name: generalSettings.system_name || 'IT Helpdesk'
              },
              {
                recipientName: ticket.requester_name,
                recipientUserId: ticket.requester_id,
                emailType: 'TICKET_COMMENTED',
                relatedEntityType: 'TICKET',
                relatedEntityId: ticketId,
                priority: 3
              }
            );

            logger.success('Comment email queued for requester', { email: ticket.requester_email });
          }
        }

        // ============================================
        // NOTIFICATION 2: ASSIGNED ENGINEER (if commenter is not the assigned engineer)
        // ============================================
        if (ticket.assigned_to && ticket.assigned_to !== userId) {
          // In-app notification
          const engineerNotifQuery = `
            INSERT INTO notifications (
              user_id, notification_type, title, message, related_ticket_id
            )
            VALUES (
              @assignedTo,
              'COMMENT_ADDED',
              'New Comment on Assigned Ticket',
              @commenterName + ' commented on ticket #' + @ticketNumber + ': "' + @commentPreview + '"',
              @ticketId
            )
          `;

          await executeQuery(engineerNotifQuery, {
            assignedTo: ticket.assigned_to,
            commenterName,
            ticketNumber: ticket.ticket_number,
            commentPreview,
            ticketId,
          });

          logger.success('Comment notification sent to assigned engineer');

          // Email notification
          if (emailEnabled && ticket.assigned_email) {
            await emailQueueService.sendTemplatedEmail(
              'TICKET_COMMENTED',
              ticket.assigned_email,
              {
                ticket_number: ticket.ticket_number,
                subject: ticket.subject,
                commenter_name: commenterName,
                comment_text: comment_text,
                user_name: ticket.assigned_name,
                ticket_url: `${appUrl}/tickets/${ticketId}`,
                system_name: generalSettings.system_name || 'IT Helpdesk'
              },
              {
                recipientName: ticket.assigned_name,
                recipientUserId: ticket.assigned_to,
                emailType: 'TICKET_COMMENTED',
                relatedEntityType: 'TICKET',
                relatedEntityId: ticketId,
                priority: 3
              }
            );

            logger.success('Comment email queued for assigned engineer', { email: ticket.assigned_email });
          }
        }

        // 📱 WhatsApp notification (Phase 9 - fire-and-forget)
        waNotify.notifyCommentAdded(
          ticket.requester_id, ticket.assigned_to, userId,
          { ticketNumber: ticket.ticket_number, subject: ticket.subject,
            commentPreview, commenterName, ticketId }
        ).catch(() => {});
      } catch (notifError) {
        logger.error('Failed to send comment notifications', notifError);
      }
    } else {
      logger.info('Internal comment - skipping external notifications');
    }

    logger.separator('COMMENT ADDED SUCCESSFULLY');
    logger.success('Comment added with notifications', {
      commentId,
      ticketId,
      isInternal: is_internal || false,
    });
    logger.separator();

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
 * Request more info (Engineer raises "Need More Details" flag)
 * @route POST /api/v1/tickets/:id/request-info
 * @access Private (Assigned Engineer or Admin/Manager)
 */
const requestInfo = async (req, res, next) => {
  try {
    const ticketId = req.params.id;
    const { request_note } = req.body || {};
    const userId = req.user.user_id;

    if (!request_note || !String(request_note).trim()) {
      return res.status(400).json(
        createResponse(false, 'Request note is required. Please specify what details or files you need from the ticket creator.')
      );
    }

    const ticketCheck = await executeQuery(
      `SELECT t.ticket_id, t.ticket_number, t.subject, t.requester_id, t.assigned_to, t.status_id, t.sla_paused,
        ts.is_final_status,
        u_req.email as requester_email, u_req.first_name + ' ' + u_req.last_name as requester_name,
        u_eng.email as assigned_email, u_eng.first_name + ' ' + u_eng.last_name as assigned_name
       FROM tickets t
       LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
       LEFT JOIN users u_req ON t.requester_id = u_req.user_id
       LEFT JOIN users u_eng ON t.assigned_to = u_eng.user_id
       WHERE t.ticket_id = @ticketId`,
      { ticketId }
    );

    if (ticketCheck.recordset.length === 0) {
      return res.status(404).json(createResponse(false, 'Ticket not found'));
    }

    const ticket = ticketCheck.recordset[0];

    if (ticket.is_final_status) {
      return res.status(400).json(createResponse(false, 'Cannot request info on a closed ticket'));
    }

    const roleCode = req.user.role?.role_code || '';
    const isAdminOrManager = roleCode === 'ADMIN' || roleCode === 'MANAGER';
    const isAssigned = ticket.assigned_to === userId;
    if (!isAssigned && !isAdminOrManager) {
      return res.status(403).json(createResponse(false, 'Only the assigned engineer or admin can request more details'));
    }

    if (ticket.sla_paused) {
      return res.status(400).json(createResponse(false, 'This ticket already has an active "Need More Details" request. Wait for the requester to respond.'));
    }

    const pendingStatusResult = await executeQuery(
      `SELECT status_id FROM ticket_statuses WHERE status_code = 'PENDING_INFO'`
    );
    const pendingStatusId = pendingStatusResult.recordset?.[0]?.status_id;
    if (!pendingStatusId) {
      return res.status(500).json(createResponse(false, 'PENDING_INFO status not configured. Please run migrations.'));
    }

    await executeQuery(
      `INSERT INTO ticket_info_requests (ticket_id, requested_by, request_note) VALUES (@ticketId, @userId, @requestNote)`,
      { ticketId, userId, requestNote: String(request_note).trim() }
    );

    await executeQuery(
      `UPDATE tickets SET
        sla_paused = 1,
        sla_paused_at = GETDATE(),
        info_requested_at = GETDATE(),
        info_provided_at = NULL,
        status_id = @pendingStatusId,
        updated_at = GETDATE()
       WHERE ticket_id = @ticketId`,
      { ticketId, pendingStatusId }
    );

    const engineerName = ticket.assigned_name || 'Engineer';
    await executeQuery(
      `INSERT INTO ticket_activities (ticket_id, activity_type, field_name, old_value, new_value, description, performed_by)
       VALUES (@ticketId, 'INFO_REQUESTED', 'sla_paused', '0', '1', 
         @engineerName + ' requested more details from the ticket creator. SLA paused until requester responds.', @userId)`,
      { ticketId, engineerName, userId }
    );

    const appUrl = getPublicAppUrl();
    const generalSettings = await settingsService.getByCategory('general');
    const notificationSettings = await settingsService.getByCategory('notification');
    const emailEnabled = notificationSettings.notify_on_ticket_updated === 'true' || notificationSettings.notify_on_ticket_updated === true;

    await executeQuery(
      `INSERT INTO notifications (user_id, notification_type, title, message, related_ticket_id)
       VALUES (@requesterId, 'PENDING_INFO', 'More Details Needed',
         'Engineer requested additional information for ticket #' + @ticketNumber + '. Please provide the requested details.',
         @ticketId)`,
      { requesterId: ticket.requester_id, ticketNumber: ticket.ticket_number, ticketId }
    );

    if (emailEnabled && ticket.requester_email) {
      await emailQueueService.sendTemplatedEmail(
        'TICKET_PENDING_INFO',
        ticket.requester_email,
        {
          ticket_number: ticket.ticket_number,
          subject: ticket.subject,
          requester_name: ticket.requester_name,
          engineer_name: engineerName,
          request_note: String(request_note).trim(),
          ticket_url: `${appUrl}/tickets/${ticketId}`,
          system_name: generalSettings.system_name || 'IT Helpdesk',
        },
        { recipientName: ticket.requester_name, recipientUserId: ticket.requester_id, emailType: 'TICKET_PENDING_INFO', relatedEntityType: 'TICKET', relatedEntityId: ticketId, priority: 2 }
      );
    }

    // 📱 WhatsApp notification (Phase 9 - fire-and-forget)
    waNotify.notifyPendingInfo(ticket.requester_id, {
      ticketNumber: ticket.ticket_number, subject: ticket.subject,
      engineerName, requestNote: String(request_note || '').trim(), ticketId
    }).catch(() => {});

    logger.success('Request info raised', { ticketId, ticketNumber: ticket.ticket_number });

    return res.status(200).json(
      createResponse(true, 'Need More Details flag raised. Requester has been notified.', { ticket_id: parseInt(ticketId) })
    );
  } catch (error) {
    logger.error('Request info error', error);
    next(error);
  }
};

/**
 * Provide info (Requester responds to "Need More Details")
 * @route POST /api/v1/tickets/:id/provide-info
 * @access Private (Ticket creator or Admin)
 */
const provideInfo = async (req, res, next) => {
  try {
    const ticketId = req.params.id;
    const { provider_note, description } = req.body || {};
    const userId = req.user.user_id;

    const ticketCheck = await executeQuery(
      `SELECT t.ticket_id, t.ticket_number, t.subject, t.requester_id, t.assigned_to, t.sla_paused,
        u_req.first_name + ' ' + u_req.last_name as requester_name,
        u_eng.email as assigned_email, u_eng.first_name + ' ' + u_eng.last_name as assigned_name
       FROM tickets t
       LEFT JOIN users u_req ON t.requester_id = u_req.user_id
       LEFT JOIN users u_eng ON t.assigned_to = u_eng.user_id
       WHERE t.ticket_id = @ticketId`,
      { ticketId }
    );

    if (ticketCheck.recordset.length === 0) {
      return res.status(404).json(createResponse(false, 'Ticket not found'));
    }

    const ticket = ticketCheck.recordset[0];

    const roleCode = req.user.role?.role_code || '';
    const isAdminOrManager = roleCode === 'ADMIN' || roleCode === 'MANAGER';
    const isRequester = ticket.requester_id === userId;
    if (!isRequester && !isAdminOrManager) {
      return res.status(403).json(createResponse(false, 'Only the ticket creator or admin can provide the requested details'));
    }

    if (!ticket.sla_paused) {
      return res.status(400).json(createResponse(false, 'This ticket does not have a pending info request'));
    }

    const activeRequest = await executeQuery(
      `SELECT request_id FROM ticket_info_requests WHERE ticket_id = @ticketId AND is_active = 1 ORDER BY requested_at DESC`,
      { ticketId }
    );
    const requestRow = activeRequest.recordset?.[0];
    if (!requestRow) {
      return res.status(400).json(createResponse(false, 'No active info request found for this ticket'));
    }

    const providerNote = (provider_note != null ? String(provider_note) : '').trim();

    await executeQuery(
      `UPDATE ticket_info_requests SET provided_at = GETDATE(), provided_by = @userId, provider_note = @providerNote, is_active = 0 WHERE request_id = @requestId`,
      { userId, providerNote: providerNote || null, requestId: requestRow.request_id }
    );

    const updateFields = ['sla_paused = 0', 'sla_paused_at = NULL', 'info_provided_at = GETDATE()', 'updated_at = GETDATE()'];
    const updateParams = { ticketId };

    const inProgressStatusResult = await executeQuery(
      `SELECT status_id FROM ticket_statuses WHERE status_code = 'IN_PROGRESS'`
    );
    const inProgressStatusId = inProgressStatusResult.recordset?.[0]?.status_id;
    if (inProgressStatusId) {
      updateFields.push('status_id = @inProgressStatusId');
      updateParams.inProgressStatusId = inProgressStatusId;
    }

    if (description != null && String(description).trim()) {
      updateFields.push('description = @description');
      updateParams.description = String(description).trim();
    }

    await executeQuery(
      `UPDATE tickets SET ${updateFields.join(', ')} WHERE ticket_id = @ticketId`,
      updateParams
    );

    // Extend due_date by the paused duration (SLA was frozen during pending info)
    const ticketRow = await executeQuery(
      `SELECT due_date, sla_paused_at FROM tickets WHERE ticket_id = @ticketId`,
      { ticketId }
    );
    const tr = ticketRow.recordset?.[0];
    if (tr?.due_date && tr?.sla_paused_at) {
      const dueDate = new Date(tr.due_date);
      const pausedAt = new Date(tr.sla_paused_at);
      const now = new Date();
      const pausedDurationMs = now - pausedAt;
      const newDueDate = new Date(dueDate.getTime() + pausedDurationMs);
      await executeQuery(
        `UPDATE tickets SET due_date = @newDueDate WHERE ticket_id = @ticketId`,
        { newDueDate, ticketId }
      );
    }

    await executeQuery(
      `INSERT INTO ticket_activities (ticket_id, activity_type, field_name, old_value, new_value, description, performed_by)
       VALUES (@ticketId, 'INFO_PROVIDED', 'sla_paused', '1', '0',
         'Requester provided the requested details. SLA resumed.', @userId)`,
      { ticketId, userId }
    );

    const appUrl = getPublicAppUrl();
    const generalSettings = await settingsService.getByCategory('general');
    const notificationSettings = await settingsService.getByCategory('notification');
    const emailEnabled = notificationSettings.notify_on_ticket_updated === 'true' || notificationSettings.notify_on_ticket_updated === true;

    if (ticket.assigned_to) {
      await executeQuery(
        `INSERT INTO notifications (user_id, notification_type, title, message, related_ticket_id)
         VALUES (@assignedTo, 'INFO_PROVIDED', 'Details Provided',
           'The ticket creator has provided the requested details for ticket #' + @ticketNumber + '. You can continue working on the ticket.',
           @ticketId)`,
        { assignedTo: ticket.assigned_to, ticketNumber: ticket.ticket_number, ticketId }
      );

      if (emailEnabled && ticket.assigned_email) {
        await emailQueueService.sendTemplatedEmail(
          'TICKET_INFO_PROVIDED',
          ticket.assigned_email,
          {
            ticket_number: ticket.ticket_number,
            subject: ticket.subject,
            engineer_name: ticket.assigned_name,
            requester_name: ticket.requester_name,
            provider_note: providerNote || 'No additional message.',
            ticket_url: `${appUrl}/tickets/${ticketId}`,
            system_name: generalSettings.system_name || 'IT Helpdesk',
          },
          { recipientName: ticket.assigned_name, recipientUserId: ticket.assigned_to, emailType: 'TICKET_INFO_PROVIDED', relatedEntityType: 'TICKET', relatedEntityId: ticketId, priority: 2 }
        );
      }
    }

    logger.success('Info provided, SLA resumed', { ticketId, ticketNumber: ticket.ticket_number });

    return res.status(200).json(
      createResponse(true, 'Details submitted. Engineer has been notified. SLA has been resumed.', { ticket_id: parseInt(ticketId) })
    );
  } catch (error) {
    logger.error('Provide info error', error);
    next(error);
  }
};

/**
 * Delete ticket
 * @route DELETE /api/v1/tickets/:id
 * @access Private (Admin only)
 */
const deleteTicket = async (req, res, next) => {
  let transaction;
  
  try {
    const ticketId = req.params.id;
    const userId = req.user.user_id;

    logger.separator('TICKET DELETION');
    logger.try('Deleting ticket', {
      ticketId,
      deletedBy: userId,
    });

    // Check permission
    const canDelete = req.user.permissions?.can_delete_tickets || false;

    if (!canDelete) {
      logger.warn('Unauthorized deletion attempt', { userId });
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

    // Start transaction for cascade delete
    const pool = await require('../config/database').getPool();
    transaction = new sql.Transaction(pool);
    await transaction.begin();

    logger.try('Starting transaction for cascade delete');

    // Delete attachments
    const deleteAttachmentsRequest = new sql.Request(transaction);
    deleteAttachmentsRequest.input('ticketId', sql.Int, ticketId);
    await deleteAttachmentsRequest.query('DELETE FROM ticket_attachments WHERE ticket_id = @ticketId');
    logger.success('Attachments deleted');

    // Delete comments
    const deleteCommentsRequest = new sql.Request(transaction);
    deleteCommentsRequest.input('ticketId', sql.Int, ticketId);
    await deleteCommentsRequest.query('DELETE FROM ticket_comments WHERE ticket_id = @ticketId');
    logger.success('Comments deleted');

    // Delete activities
    const deleteActivitiesRequest = new sql.Request(transaction);
    deleteActivitiesRequest.input('ticketId', sql.Int, ticketId);
    await deleteActivitiesRequest.query('DELETE FROM ticket_activities WHERE ticket_id = @ticketId');
    logger.success('Activities deleted');

    // Delete notifications
    const deleteNotificationsRequest = new sql.Request(transaction);
    deleteNotificationsRequest.input('ticketId', sql.Int, ticketId);
    await deleteNotificationsRequest.query('DELETE FROM notifications WHERE related_ticket_id = @ticketId');
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

/**
 * Close ticket directly with close notes
 * @route PATCH /api/v1/tickets/:id/close
 * @access Private (Assigned Engineer / Admin)
 * Only the assigned engineer or users with can_close_tickets / can_assign_tickets permission
 */
const closeTicket = async (req, res, next) => {
  try {
    const ticketId = req.params.id;
    const { close_notes } = req.body;
    const userId = req.user.user_id;

    logger.separator('TICKET CLOSE - DIRECT CLOSE');
    logger.try('Closing ticket', { ticketId, closedBy: userId });

    // Validate close notes
    if (!close_notes || !close_notes.trim()) {
      logger.warn('Close notes required', { ticketId });
      logger.separator();
      return res.status(400).json(
        createResponse(false, 'Close notes are required')
      );
    }

    // Get ticket details
    const ticketCheck = await executeQuery(
      `SELECT 
        t.ticket_id, t.ticket_number, t.subject, t.status_id,
        t.requester_id, t.assigned_to, t.resolution_notes,
        ts.status_name as old_status_name, ts.status_code as old_status_code,
        ts.is_final_status,
        u_req.email as requester_email,
        u_req.first_name + ' ' + u_req.last_name as requester_name,
        u_eng.email as assigned_email,
        u_eng.first_name + ' ' + u_eng.last_name as assigned_name
      FROM tickets t
      LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
      LEFT JOIN users u_req ON t.requester_id = u_req.user_id
      LEFT JOIN users u_eng ON t.assigned_to = u_eng.user_id
      WHERE t.ticket_id = @ticketId`,
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

    // Check if already closed
    if (ticket.is_final_status) {
      logger.warn('Ticket already in final status', { ticketId, status: ticket.old_status_code });
      logger.separator();
      return res.status(400).json(
        createResponse(false, `Ticket is already ${ticket.old_status_name}`)
      );
    }

    // Awaiting manager closure approval — must use approve/reject closure APIs
    if ((ticket.old_status_name || '').trim() === 'Pending Closure') {
      return res.status(400).json(
        createResponse(
          false,
          'This ticket is waiting for manager approval to close. Use Approve or Reject closure on the ticket (or My Approvals / pending closure list).'
        )
      );
    }

    // Permission check: must be assigned engineer OR admin/manager/central
    const isAssigned = ticket.assigned_to === userId;
    const roleCode = req.user.role?.role_code || '';
    const isPrivilegedCloser =
      roleCode === 'ADMIN' || roleCode === 'MANAGER' || roleCode === 'CENTRAL_MGMT';

    if (!isAssigned && !isPrivilegedCloser) {
      logger.warn('Unauthorized close attempt', { userId, assignedTo: ticket.assigned_to });
      logger.separator();
      return res.status(403).json(
        createResponse(false, 'Only the assigned engineer or admin can close this ticket')
      );
    }

    // Settings: ticket_require_approval_close — engineers must request closure first
    const closePerm = await ticketPermissionsService.canUserCloseTicket(userId, ticketId);
    if (!closePerm.allowed) {
      return res.status(403).json(createResponse(false, closePerm.reason));
    }
    const canBypassClosureApproval =
      roleCode === 'ADMIN' || roleCode === 'MANAGER' || roleCode === 'CENTRAL_MGMT';
    if (closePerm.requiresApproval && !canBypassClosureApproval) {
      return res.status(403).json(
        createResponse(
          false,
          'Closure requires manager approval. Use "Request closure approval" on the ticket (Settings → Tickets → require approval to close), or ask a manager/admin to close.',
          { code: 'CLOSURE_APPROVAL_REQUIRED' }
        )
      );
    }

    // Get CLOSED status_id
    const closedStatusResult = await executeQuery(
      `SELECT status_id, status_name FROM ticket_statuses WHERE status_code = 'CLOSED'`
    );

    if (closedStatusResult.recordset.length === 0) {
      logger.error('CLOSED status not found in ticket_statuses');
      logger.separator();
      return res.status(500).json(
        createResponse(false, 'System error: CLOSED status not configured')
      );
    }

    const closedStatusId = closedStatusResult.recordset[0].status_id;
    const closedStatusName = closedStatusResult.recordset[0].status_name;
    const oldStatusId = ticket.status_id;
    const oldStatusName = ticket.old_status_name;

    // Get closer's name
    const closerQuery = `SELECT ISNULL(first_name, '') + ' ' + ISNULL(last_name, '') as full_name FROM users WHERE user_id = @userId`;
    const closerResult = await executeQuery(closerQuery, { userId });
    const closerName = closerResult.recordset[0]?.full_name?.trim() || 'System';

    // Update ticket: set status to CLOSED, add resolution notes, set timestamps
    const updateQuery = `
      UPDATE tickets
      SET status_id = @closedStatusId,
          resolution_notes = @closeNotes,
          resolved_at = COALESCE(resolved_at, GETDATE()),
          closed_at = GETDATE(),
          updated_at = GETDATE()
      WHERE ticket_id = @ticketId
    `;

    await executeQuery(updateQuery, {
      closedStatusId,
      closeNotes: close_notes.trim(),
      ticketId,
    });

    logger.success('Ticket status updated to CLOSED');

    // Log activity
    const activityQuery = `
      INSERT INTO ticket_activities (
        ticket_id, activity_type, field_name, old_value, new_value, description, performed_by
      )
      VALUES (@ticketId, 'STATUS_CHANGED', 'status', @oldValue, @newValue, @description, @userId)
    `;

    await executeQuery(activityQuery, {
      ticketId,
      oldValue: oldStatusName,
      newValue: closedStatusName,
      description: `Ticket closed by ${closerName}. Notes: ${close_notes.trim()}`,
      userId,
    });

    logger.success('Activity logged: ticket closed');

    // ============================================
    // ⭐ NOTIFICATIONS FOR CLOSE
    // ============================================
    try {
      const notificationSettings = await settingsService.getByCategory('notification');
      const generalSettings = await settingsService.getByCategory('general');
      const appUrl = getPublicAppUrl();

      // NOTIFICATION: Requester — Ticket Closed
      if (ticket.requester_id !== userId) {
        const requesterNotifQuery = `
          INSERT INTO notifications (
            user_id, notification_type, title, message, related_ticket_id
          )
          VALUES (
            @requesterId,
            'STATUS_CHANGED',
            'Ticket Closed',
            'Your ticket #' + @ticketNumber + ' has been closed by ' + @closerName + '.',
            @ticketId
          )
        `;

        await executeQuery(requesterNotifQuery, {
          requesterId: ticket.requester_id,
          ticketNumber: ticket.ticket_number,
          closerName,
          ticketId,
        });

        logger.success('Close notification sent to requester');
      }

      // NOTIFICATION: Assigned Engineer (if not the one who closed)
      if (ticket.assigned_to && ticket.assigned_to !== userId) {
        const engineerNotifQuery = `
          INSERT INTO notifications (
            user_id, notification_type, title, message, related_ticket_id
          )
          VALUES (
            @assignedTo,
            'STATUS_CHANGED',
            'Ticket Closed',
            'Ticket #' + @ticketNumber + ' has been closed by ' + @closerName + '.',
            @ticketId
          )
        `;

        await executeQuery(engineerNotifQuery, {
          assignedTo: ticket.assigned_to,
          ticketNumber: ticket.ticket_number,
          closerName,
          ticketId,
        });

        logger.success('Close notification sent to assigned engineer');
      }

      // EMAIL: Send status change email
      const emailEnabled = notificationSettings.notify_on_ticket_updated === 'true' || notificationSettings.notify_on_ticket_updated === true;

      if (emailEnabled) {
        if (ticket.requester_email && ticket.requester_id !== userId) {
          await emailQueueService.sendTemplatedEmail(
            'TICKET_STATUS_CHANGED',
            ticket.requester_email,
            {
              ticket_number: ticket.ticket_number,
              subject: ticket.subject,
              old_status: oldStatusName,
              new_status: closedStatusName,
              updated_by_name: closerName,
              user_name: ticket.requester_name,
              ticket_url: `${appUrl}/tickets/${ticketId}`,
              system_name: generalSettings.system_name || 'IT Helpdesk'
            },
            {
              recipientName: ticket.requester_name,
              emailType: 'TICKET_STATUS_CHANGED',
              relatedEntityType: 'TICKET',
              relatedEntityId: ticketId,
              priority: 3
            }
          );
          logger.success('Close email queued for requester');
        }

        if (ticket.assigned_email && ticket.assigned_to !== userId) {
          await emailQueueService.sendTemplatedEmail(
            'TICKET_STATUS_CHANGED',
            ticket.assigned_email,
            {
              ticket_number: ticket.ticket_number,
              subject: ticket.subject,
              old_status: oldStatusName,
              new_status: closedStatusName,
              updated_by_name: closerName,
              user_name: ticket.assigned_name,
              ticket_url: `${appUrl}/tickets/${ticketId}`,
              system_name: generalSettings.system_name || 'IT Helpdesk'
            },
            {
              recipientName: ticket.assigned_name,
              emailType: 'TICKET_STATUS_CHANGED',
              relatedEntityType: 'TICKET',
              relatedEntityId: ticketId,
              priority: 3
            }
          );
          logger.success('Close email queued for assigned engineer');
        }
      }

      // ============================================
      // ⭐ RATING REQUEST - Notify ticket creator to rate
      // Only if ticket has an assigned engineer
      // ============================================
      if (ticket.assigned_to && ticket.requester_email) {
        // Send rating request notification to requester
        await executeQuery(
          `INSERT INTO notifications (user_id, notification_type, title, message, related_ticket_id)
           VALUES (@requesterId, 'RATING_REQUEST', 'Rate Your Experience',
                   @message, @ticketId)`,
          {
            requesterId: ticket.requester_id,
            message: `Your ticket #${ticket.ticket_number} has been closed. Please rate this ticket to help improve our engineer quality and service standards. Your feedback makes a difference!`,
            ticketId
          }
        );
        logger.success('Rating request notification sent to requester');

        // Send rating request email
        if (emailEnabled) {
          await emailQueueService.sendTemplatedEmail(
            'TICKET_RATING_REQUEST',
            ticket.requester_email,
            {
              ticket_number: ticket.ticket_number,
              subject: ticket.subject,
              user_name: ticket.requester_name,
              closed_by_name: closerName,
              rating_url: `${appUrl}/tickets/${ticketId}`,
              system_name: generalSettings.system_name || 'IT Helpdesk'
            },
            {
              recipientName: ticket.requester_name,
              emailType: 'TICKET_RATING_REQUEST',
              relatedEntityType: 'TICKET',
              relatedEntityId: ticketId,
              priority: 2
            }
          );
          logger.success('Rating request email queued for requester');
        }

        // 📱 WhatsApp: ask requester to rate (fire-and-forget)
        waNotify.notifyRatingRequest(ticket.requester_id, {
          ticketNumber: ticket.ticket_number,
          subject: ticket.subject,
          ticketId,
        }).catch(() => {});
      }
    } catch (notifError) {
      logger.error('Failed to send close notifications', notifError);
    }

    logger.separator('TICKET CLOSED SUCCESSFULLY');
    logger.success('Ticket closed', { ticketId, closedBy: closerName });
    logger.separator();

    return res.status(200).json(
      createResponse(true, 'Ticket closed successfully')
    );
  } catch (error) {
    logger.error('Close ticket error', error);
    logger.separator();
    next(error);
  }
};

/**
 * Reopen a closed/resolved ticket with a reason
 * @route PATCH /api/v1/tickets/:id/reopen
 * @access Private (Ticket creator / Admin / Manager)
 */
const reopenTicket = async (req, res, next) => {
  try {
    const ticketId = req.params.id;
    const { reopen_reason } = req.body;
    const userId = req.user.user_id;

    logger.separator('TICKET REOPEN');
    logger.try('Reopening ticket', { ticketId, reopenedBy: userId });

    // Validate reason
    if (!reopen_reason || !reopen_reason.trim()) {
      logger.warn('Reopen reason required', { ticketId });
      logger.separator();
      return res.status(400).json(
        createResponse(false, 'Reopen reason is required')
      );
    }

    // Get ticket details
    const ticketCheck = await executeQuery(
      `SELECT 
        t.ticket_id, t.ticket_number, t.subject, t.status_id,
        t.requester_id, t.assigned_to, t.resolution_notes,
        ts.status_name as old_status_name, ts.status_code as old_status_code,
        ts.is_final_status,
        u_req.email as requester_email,
        u_req.first_name + ' ' + u_req.last_name as requester_name,
        u_eng.email as assigned_email,
        u_eng.first_name + ' ' + u_eng.last_name as assigned_name
      FROM tickets t
      LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
      LEFT JOIN users u_req ON t.requester_id = u_req.user_id
      LEFT JOIN users u_eng ON t.assigned_to = u_eng.user_id
      WHERE t.ticket_id = @ticketId`,
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

    // Only closed/resolved tickets can be reopened
    if (!ticket.is_final_status) {
      logger.warn('Ticket is not in final status', { ticketId, status: ticket.old_status_code });
      logger.separator();
      return res.status(400).json(
        createResponse(false, `Ticket is currently ${ticket.old_status_name} and cannot be reopened`)
      );
    }

    // Permission check: ticket creator or users with explicit reopen permission
    const isRequester = ticket.requester_id === userId;
    const hasReopenPermission = req.user.permissions?.can_reopen_tickets === true
      || req.user.permissions?.can_manage_system === true;

    if (!isRequester && !hasReopenPermission) {
      logger.warn('Unauthorized reopen attempt', { userId, requesterId: ticket.requester_id });
      logger.separator();
      return res.status(403).json(
        createResponse(false, 'Only the ticket creator or an authorized role can reopen this ticket')
      );
    }

    // Ensure REOPENED status exists (auto-create if missing)
    let reopenedStatusResult = await executeQuery(
      `SELECT status_id, status_name FROM ticket_statuses WHERE status_code = 'REOPENED'`
    );

    if (reopenedStatusResult.recordset.length === 0) {
      // Create REOPENED status (status_type = 'OPEN' since it's an active ticket again)
      await executeQuery(
        `INSERT INTO ticket_statuses (status_name, status_code, status_type, is_final_status, is_active, display_order)
         VALUES ('Reopened', 'REOPENED', 'OPEN', 0, 1, 6)`
      );
      reopenedStatusResult = await executeQuery(
        `SELECT status_id, status_name FROM ticket_statuses WHERE status_code = 'REOPENED'`
      );
      logger.success('Created REOPENED status in ticket_statuses');
    }

    const reopenedStatusId = reopenedStatusResult.recordset[0].status_id;
    const reopenedStatusName = reopenedStatusResult.recordset[0].status_name;
    const oldStatusName = ticket.old_status_name;

    // Get reopener's name
    const reopenerQuery = `SELECT ISNULL(first_name, '') + ' ' + ISNULL(last_name, '') as full_name FROM users WHERE user_id = @userId`;
    const reopenerResult = await executeQuery(reopenerQuery, { userId });
    const reopenerName = reopenerResult.recordset[0]?.full_name?.trim() || 'System';

    // Update ticket: set status to REOPENED, clear closed_at
    const updateQuery = `
      UPDATE tickets
      SET status_id = @reopenedStatusId,
          closed_at = NULL,
          resolved_at = NULL,
          updated_at = GETDATE()
      WHERE ticket_id = @ticketId
    `;

    await executeQuery(updateQuery, {
      reopenedStatusId,
      ticketId,
    });

    logger.success('Ticket status updated to REOPENED');

    // Log activity
    const activityQuery = `
      INSERT INTO ticket_activities (
        ticket_id, activity_type, field_name, old_value, new_value, description, performed_by
      )
      VALUES (@ticketId, 'REOPENED', 'status', @oldValue, @newValue, @description, @userId)
    `;

    await executeQuery(activityQuery, {
      ticketId,
      oldValue: oldStatusName,
      newValue: reopenedStatusName,
      description: `Ticket reopened by ${reopenerName}. Reason: ${reopen_reason.trim()}`,
      userId,
    });

    logger.success('Activity logged: ticket reopened');

    // ============================================
    // NOTIFICATIONS FOR REOPEN
    // ============================================
    try {
      const notificationSettings = await settingsService.getByCategory('notification');
      const generalSettings = await settingsService.getByCategory('general');
      const appUrl = getPublicAppUrl();

      // NOTIFICATION: Requester (if not the one who reopened)
      if (ticket.requester_id !== userId) {
        await executeQuery(
          `INSERT INTO notifications (user_id, notification_type, title, message, related_ticket_id)
           VALUES (@requesterId, 'STATUS_CHANGED', 'Ticket Reopened',
                   'Your ticket #' + @ticketNumber + ' has been reopened by ' + @reopenerName + '.',
                   @ticketId)`,
          { requesterId: ticket.requester_id, ticketNumber: ticket.ticket_number, reopenerName, ticketId }
        );
        logger.success('Reopen notification sent to requester');
      }

      // NOTIFICATION: Assigned Engineer (if exists and not the one who reopened)
      if (ticket.assigned_to && ticket.assigned_to !== userId) {
        await executeQuery(
          `INSERT INTO notifications (user_id, notification_type, title, message, related_ticket_id)
           VALUES (@assignedTo, 'STATUS_CHANGED', 'Ticket Reopened',
                   'Ticket #' + @ticketNumber + ' has been reopened by ' + @reopenerName + '.',
                   @ticketId)`,
          { assignedTo: ticket.assigned_to, ticketNumber: ticket.ticket_number, reopenerName, ticketId }
        );
        logger.success('Reopen notification sent to assigned engineer');
      }

      // EMAIL notifications
      const emailEnabled = notificationSettings.notify_on_ticket_updated === 'true' || notificationSettings.notify_on_ticket_updated === true;

      if (emailEnabled) {
        if (ticket.requester_email && ticket.requester_id !== userId) {
          await emailQueueService.sendTemplatedEmail(
            'TICKET_REOPENED',
            ticket.requester_email,
            {
              ticket_number: ticket.ticket_number,
              subject: ticket.subject,
              old_status: oldStatusName,
              reopened_by_name: reopenerName,
              reopen_reason: reopen_reason.trim(),
              user_name: ticket.requester_name,
              ticket_url: `${appUrl}/tickets/${ticketId}`,
              system_name: generalSettings.system_name || 'IT Helpdesk'
            },
            {
              recipientName: ticket.requester_name,
              emailType: 'TICKET_REOPENED',
              relatedEntityType: 'TICKET',
              relatedEntityId: ticketId,
              priority: 3
            }
          );
          logger.success('Reopen email queued for requester');
        }

        if (ticket.assigned_email && ticket.assigned_to !== userId) {
          await emailQueueService.sendTemplatedEmail(
            'TICKET_REOPENED',
            ticket.assigned_email,
            {
              ticket_number: ticket.ticket_number,
              subject: ticket.subject,
              old_status: oldStatusName,
              reopened_by_name: reopenerName,
              reopen_reason: reopen_reason.trim(),
              user_name: ticket.assigned_name,
              ticket_url: `${appUrl}/tickets/${ticketId}`,
              system_name: generalSettings.system_name || 'IT Helpdesk'
            },
            {
              recipientName: ticket.assigned_name,
              emailType: 'TICKET_REOPENED',
              relatedEntityType: 'TICKET',
              relatedEntityId: ticketId,
              priority: 3
            }
          );
          logger.success('Reopen email queued for assigned engineer');
        }
      }

      // 📱 WhatsApp: notify engineer (and requester if different from reopener) — fire-and-forget
      waNotify.notifyTicketReopened(
        ticket.assigned_to !== userId ? ticket.assigned_to : null,
        ticket.requester_id !== userId ? ticket.requester_id : null,
        {
          ticketNumber: ticket.ticket_number,
          subject: ticket.subject,
          updaterName: reopenerName,
          ticketId,
        }
      ).catch(() => {});
    } catch (notifError) {
      logger.error('Failed to send reopen notifications', notifError);
    }

    logger.separator('TICKET REOPENED SUCCESSFULLY');
    logger.success('Ticket reopened', { ticketId, reopenedBy: reopenerName });
    logger.separator();

    return res.status(200).json(
      createResponse(true, 'Ticket reopened successfully')
    );
  } catch (error) {
    logger.error('Reopen ticket error', error);
    logger.separator();
    next(error);
  }
};

// ============================================
// EXPORT ALL FUNCTIONS
// ============================================
module.exports = {
  getTickets,
  getTicketStats,  // ⭐ NEW - Optimized stats endpoint
  reassignOpenTickets,
  getTicketById,
  createTicket,
  updateTicket,
  assignTicket,
  addComment,
  deleteTicket,
  closeTicket,
  reopenTicket,
  requestInfo,
  provideInfo,
};
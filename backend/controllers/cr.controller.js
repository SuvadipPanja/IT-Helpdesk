// ============================================
// CR (Change Request) CONTROLLER
// Full CRUD + workflow transitions
// ============================================

const { executeQuery, executeInTransaction, executeInTransactionQuery } = require('../config/database');
const { createResponse, getPaginationMeta } = require('../utils/helpers');
const logger = require('../utils/logger');
const crService = require('../services/cr.service');
const crApprovalService = require('../services/crApproval.service');
const crNotification = require('../services/crNotification.service');
const crAutoAssignment = require('../services/crAutoAssignment.service');
const settingsService = require('../services/settings.service');

/**
 * Helper: fetch CR with requester/assignee details for notification purposes
 */
async function getCRForNotification(crId) {
  const result = await executeQuery(`
    SELECT cr.cr_id, cr.cr_number, cr.title, cr.risk_level, cr.requester_id, cr.assigned_to,
           cr.scheduled_start, cr.scheduled_end, cr.estimated_downtime_mins,
           ct.type_name,
           req.first_name + ' ' + req.last_name AS requester_name, req.email AS requester_email,
           asgn.first_name + ' ' + asgn.last_name AS assigned_to_name, asgn.email AS assigned_to_email
    FROM change_requests cr
    LEFT JOIN cr_types ct ON cr.cr_type_id = ct.type_id
    LEFT JOIN users req ON cr.requester_id = req.user_id
    LEFT JOIN users asgn ON cr.assigned_to = asgn.user_id
    WHERE cr.cr_id = @crId
  `, { crId });
  return result.recordset[0] || null;
}

// ============================================
// GET /api/v1/cr/lookups — Form dropdowns
// ============================================
const getLookups = async (req, res, next) => {
  try {
    const lookups = await crService.getLookups();
    return res.status(200).json(createResponse(true, 'CR lookups fetched', lookups));
  } catch (error) {
    logger.error('Get CR lookups error', error);
    next(error);
  }
};

// ============================================
// GET /api/v1/cr/approvers — Users who can approve CRs
// ============================================
const getApprovers = async (req, res, next) => {
  try {
    const approvers = await crService.getApprovers();
    return res.status(200).json(createResponse(true, 'CR approvers fetched', approvers));
  } catch (error) {
    logger.error('Get CR approvers error', error);
    next(error);
  }
};

// ============================================
// GET /api/v1/cr/settings — CR routing/workflow settings
// ============================================
const getCRSettings = async (req, res, next) => {
  try {
    const settings = await crService.getCRSettings();
    return res.status(200).json(createResponse(true, 'CR settings fetched', settings));
  } catch (error) {
    logger.error('Get CR settings error', error);
    next(error);
  }
};

// ============================================
// GET /api/v1/cr/my-cr-approvals — CRs pending my approval decision
// ============================================
const getMyCRApprovals = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const isAdmin = ['ADMIN', 'SUB_ADMIN'].includes(req.user.role?.role_code);
    const canApprove = req.user.permissions?.can_approve_cr || isAdmin;

    if (!canApprove) {
      return res.status(403).json(createResponse(false, 'You do not have permission to approve CRs'));
    }

    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(50, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const search = req.query.search?.trim() || '';
    const statusFilter = req.query.status || 'PENDING_APPROVAL'; // PENDING_APPROVAL | ALL

    // Base WHERE — admin sees all PENDING_APPROVAL; approver only sees ones routed to them
    let approverWhere = isAdmin
      ? `cs.status_code = 'PENDING_APPROVAL'`
      : `cs.status_code = 'PENDING_APPROVAL' AND (cr.requested_approver_id = @userId OR cr.assigned_to = @userId)`;

    if (statusFilter === 'ALL') {
      approverWhere = isAdmin
        ? `cs.status_code IN ('PENDING_APPROVAL','APPROVED','REJECTED','CANCELLED')`
        : `(cr.requested_approver_id = @userId OR cr.assigned_to = @userId) AND cs.status_code IN ('PENDING_APPROVAL','APPROVED','REJECTED','CANCELLED')`;
    }

    let searchWhere = '';
    const params = { userId, limit, offset };
    if (search) {
      searchWhere = `AND (cr.cr_number LIKE @search OR cr.title LIKE @search OR req.first_name + ' ' + req.last_name LIKE @search)`;
      params.search = `%${search}%`;
    }

    const countResult = await executeQuery(`
      SELECT COUNT(*) AS total
      FROM change_requests cr
      INNER JOIN cr_statuses cs ON cr.cr_status_id = cs.status_id
      LEFT JOIN users req ON cr.requester_id = req.user_id
      WHERE ${approverWhere} ${searchWhere}
    `, params);

    const total = countResult.recordset[0]?.total || 0;

    const rows = await executeQuery(`
      SELECT cr.cr_id, cr.cr_number, cr.title, cr.risk_level,
             cs.status_code, cs.status_name, cs.color_code,
             ct.type_name,
             tp.priority_name,
             cr.created_at, cr.updated_at, cr.scheduled_start, cr.scheduled_end,
             req.user_id AS requester_id,
             req.first_name + ' ' + req.last_name AS requester_name, req.email AS requester_email,
             asgn.first_name + ' ' + asgn.last_name AS assigned_to_name,
             approver.first_name + ' ' + approver.last_name AS requested_approver_name,
             cr.requested_approver_id,
             cr.assigned_to,
             (SELECT COUNT(*) FROM cr_activities ca WHERE ca.cr_id = cr.cr_id) AS activity_count
      FROM change_requests cr
      INNER JOIN cr_statuses cs ON cr.cr_status_id = cs.status_id
      LEFT JOIN cr_types ct ON cr.cr_type_id = ct.type_id
      LEFT JOIN ticket_priorities tp ON cr.priority_id = tp.priority_id
      LEFT JOIN users req ON cr.requester_id = req.user_id
      LEFT JOIN users asgn ON cr.assigned_to = asgn.user_id
      LEFT JOIN users approver ON cr.requested_approver_id = approver.user_id
      WHERE ${approverWhere} ${searchWhere}
      ORDER BY cr.updated_at DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `, params);

    // Stats counts
    const statsResult = await executeQuery(`
      SELECT
        SUM(CASE WHEN cs.status_code = 'PENDING_APPROVAL' AND (${isAdmin ? '1=1' : 'cr.requested_approver_id = @userId OR cr.assigned_to = @userId'}) THEN 1 ELSE 0 END) AS pending_count,
        SUM(CASE WHEN cs.status_code = 'APPROVED' AND (${isAdmin ? '1=1' : 'cr.requested_approver_id = @userId OR cr.assigned_to = @userId'}) THEN 1 ELSE 0 END) AS approved_count,
        SUM(CASE WHEN cs.status_code IN ('REJECTED','CANCELLED') AND (${isAdmin ? '1=1' : 'cr.requested_approver_id = @userId OR cr.assigned_to = @userId'}) THEN 1 ELSE 0 END) AS rejected_count
      FROM change_requests cr
      INNER JOIN cr_statuses cs ON cr.cr_status_id = cs.status_id
    `, { userId });

    return res.status(200).json(createResponse(true, 'My CR approvals fetched', {
      rows: rows.recordset,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      stats: statsResult.recordset[0] || {}
    }));
  } catch (error) {
    logger.error('Get my CR approvals error', error);
    next(error);
  }
};

// ============================================
// GET /api/v1/cr/stats — Dashboard stats
// ============================================
const getCRStats = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const canViewAll = req.user.permissions?.can_view_all_cr || false;
    const trendDays = Math.min(Math.max(parseInt(req.query.days) || 7, 7), 30);

    const crFilter = canViewAll
      ? '1=1'
      : '(cr.requester_id = @userId OR cr.assigned_to = @userId)';

    const params = { userId, trendDays };

    const query = `
      -- 1) Status distribution
      SELECT
        cs.status_code, cs.status_name, cs.color_code,
        COUNT(cr.cr_id) AS count
      FROM cr_statuses cs
      LEFT JOIN change_requests cr ON cs.status_id = cr.cr_status_id AND ${crFilter}
      WHERE cs.is_active = 1
      GROUP BY cs.status_code, cs.status_name, cs.color_code, cs.display_order
      ORDER BY cs.display_order;

      -- 2) Type distribution
      SELECT ct.type_code, ct.type_name, COUNT(cr.cr_id) AS count
      FROM cr_types ct
      LEFT JOIN change_requests cr ON ct.type_id = cr.cr_type_id AND ${crFilter}
      GROUP BY ct.type_code, ct.type_name;

      -- 3) Risk distribution
      SELECT
        cr.risk_level,
        COUNT(*) AS count
      FROM change_requests cr
      WHERE ${crFilter} AND cr.risk_level IS NOT NULL
      GROUP BY cr.risk_level;

      -- 4) My created CRs count
      SELECT COUNT(*) AS cnt FROM change_requests cr WHERE cr.requester_id = @userId;

      -- 5) My assigned CRs count (non-final)
      SELECT COUNT(*) AS cnt
      FROM change_requests cr
      INNER JOIN cr_statuses cs ON cr.cr_status_id = cs.status_id
      WHERE cr.assigned_to = @userId
        AND cs.status_code NOT IN ('IMPLEMENTED','CLOSED','ROLLED_BACK','CANCELLED');

      -- 6) Pending my approval count
      SELECT COUNT(*) AS cnt
      FROM cr_approvals ca
      INNER JOIN change_requests cr ON ca.cr_id = cr.cr_id
      WHERE ca.approver_id = @userId AND ca.status = 'PENDING';

      -- 7) CR trend — last N days
      SELECT
        CAST(cr.created_at AS DATE) AS date_key,
        COUNT(*) AS created_count,
        SUM(CASE WHEN cs.status_code IN ('IMPLEMENTED','CLOSED','ROLLED_BACK') THEN 1 ELSE 0 END) AS completed_count
      FROM change_requests cr
      INNER JOIN cr_statuses cs ON cr.cr_status_id = cs.status_id
      WHERE cr.created_at >= DATEADD(DAY, -(@trendDays - 1), CAST(GETDATE() AS DATE))
        AND ${crFilter}
      GROUP BY CAST(cr.created_at AS DATE)
      ORDER BY date_key;

      -- 8) Success vs Rollback counts
      SELECT
        SUM(CASE WHEN cs.status_code IN ('IMPLEMENTED','CLOSED') THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN cs.status_code = 'ROLLED_BACK' THEN 1 ELSE 0 END) AS rolled_back
      FROM change_requests cr
      INNER JOIN cr_statuses cs ON cr.cr_status_id = cs.status_id
      WHERE ${crFilter}
        AND cs.status_code IN ('IMPLEMENTED','CLOSED','ROLLED_BACK');

      -- 9) Category distribution
      SELECT
        cc.category_name,
        COUNT(cr.cr_id) AS count
      FROM cr_categories cc
      LEFT JOIN change_requests cr ON cc.category_id = cr.cr_category_id AND ${crFilter}
      WHERE cc.is_active = 1
      GROUP BY cc.category_name
      HAVING COUNT(cr.cr_id) > 0
      ORDER BY count DESC;
    `;

    const result = await executeQuery(query, params);
    const rs = result.recordsets || [];

    const statusRows = rs[0] || [];
    const typeRows = rs[1] || [];
    const riskRows = rs[2] || [];
    const myCreated = rs[3]?.[0]?.cnt || 0;
    const myAssigned = rs[4]?.[0]?.cnt || 0;
    const pendingMyApproval = rs[5]?.[0]?.cnt || 0;
    const trendRows = rs[6] || [];
    const successRow = rs[7]?.[0] || {};
    const categoryRows = rs[8] || [];

    const total = statusRows.reduce((sum, r) => sum + r.count, 0);

    // Build status map for quick lookup
    const statusMap = {};
    statusRows.forEach(r => { statusMap[r.status_code] = r.count; });

    // Fill N-day trend
    const crTrend = [];
    for (let i = trendDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const row = (trendRows || []).find(r => {
        const rKey = new Date(r.date_key).toISOString().slice(0, 10);
        return rKey === key;
      });
      crTrend.push({
        date: key,
        day: d.toLocaleDateString('en-US', { weekday: 'short' }),
        created: row?.created_count || 0,
        completed: row?.completed_count || 0,
      });
    }

    // Success rate
    const completedCount = successRow.completed || 0;
    const rolledBackCount = successRow.rolled_back || 0;
    const successRate = (completedCount + rolledBackCount) > 0
      ? parseFloat(((completedCount / (completedCount + rolledBackCount)) * 100).toFixed(1))
      : 0;

    return res.status(200).json(createResponse(true, 'CR stats fetched', {
      total,
      by_status: statusRows,
      by_type: typeRows,
      by_risk: riskRows,
      by_category: categoryRows.map(r => ({ label: r.category_name, value: r.count })),
      summary: {
        total,
        draft: statusMap['DRAFT'] || 0,
        submitted: statusMap['SUBMITTED'] || 0,
        under_review: statusMap['UNDER_REVIEW'] || 0,
        approved: statusMap['APPROVED'] || 0,
        scheduled: statusMap['SCHEDULED'] || 0,
        in_progress: statusMap['IN_PROGRESS'] || 0,
        completed: (statusMap['IMPLEMENTED'] || 0) + (statusMap['CLOSED'] || 0),
        implemented: statusMap['IMPLEMENTED'] || 0,
        closed: statusMap['CLOSED'] || 0,
        rolled_back: statusMap['ROLLED_BACK'] || 0,
        rejected: statusMap['REJECTED'] || 0,
        cancelled: statusMap['CANCELLED'] || 0,
        pending_info: statusMap['PENDING_INFO'] || 0,
        my_created: myCreated,
        my_assigned: myAssigned,
        pending_my_approval: pendingMyApproval,
        success_rate: successRate,
      },
      trend: crTrend,
      trendDays,
    }));
  } catch (error) {
    logger.error('Get CR stats error', error);
    next(error);
  }
};

// ============================================
// GET /api/v1/cr — List CRs (paginated, filtered)
// ============================================
const getCRs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const status = req.query.status || null;
    const type = req.query.type || null;
    const priority_id = req.query.priority_id || null;
    const category_id = req.query.category_id || null;
    const risk_level = req.query.risk_level || null;
    const assigned_to = req.query.assigned_to || null;
    const requester_id = req.query.requester_id || null;
    const department_id = req.query.department_id || null;
    const date_from = req.query.date_from || null;
    const date_to = req.query.date_to || null;
    const queue_mode = req.query.queue_mode || null; // 'reviewer' = show CRs for approvers
    const sort = req.query.sort || 'created_at';
    const order = req.query.order === 'ASC' ? 'ASC' : 'DESC';

    const canViewAll = req.user.permissions?.can_view_all_cr || false;
    const canApproveCR = req.user.permissions?.can_approve_cr || false;
    const canImplementCR = req.user.permissions?.can_implement_cr || false;
    const userId = req.user.user_id;

    let whereConditions = [];
    let params = {};

    if (queue_mode === 'reviewer' && (canApproveCR || canViewAll)) {
      // Reviewer queue: show CRs assigned to me OR unassigned CRs in reviewable statuses
      whereConditions.push(`(
        cr.assigned_to = @userId 
        OR (cr.assigned_to IS NULL AND cs.status_code IN ('SUBMITTED','UNDER_REVIEW','PENDING_INFO','PENDING_APPROVAL'))
      )`);
      params.userId = userId;
    } else if (queue_mode === 'implementer' && (canImplementCR || canViewAll)) {
      // Implementer queue: show CRs assigned to me in implementable statuses
      whereConditions.push('cr.assigned_to = @userId');
      params.userId = userId;
    } else if (!canViewAll) {
      whereConditions.push('(cr.requester_id = @userId OR cr.assigned_to = @userId)');
      params.userId = userId;
    }

    if (search) {
      whereConditions.push(`(cr.cr_number LIKE '%' + @search + '%' OR cr.title LIKE '%' + @search + '%' OR cr.description LIKE '%' + @search + '%')`);
      params.search = search;
    }

    if (status) {
      const statusCodes = status.split(',').map(s => s.trim()).filter(Boolean);
      whereConditions.push(`cs.status_code IN (${statusCodes.map((_, i) => `@status${i}`).join(',')})`);
      statusCodes.forEach((s, i) => { params[`status${i}`] = s; });
    }

    if (type) {
      const typeCodes = type.split(',').map(t => t.trim()).filter(Boolean);
      whereConditions.push(`ct.type_code IN (${typeCodes.map((_, i) => `@type${i}`).join(',')})`);
      typeCodes.forEach((t, i) => { params[`type${i}`] = t; });
    }

    if (priority_id) {
      whereConditions.push('cr.priority_id = @priorityId');
      params.priorityId = priority_id;
    }

    if (category_id) {
      whereConditions.push('cr.cr_category_id = @categoryId');
      params.categoryId = category_id;
    }

    if (risk_level) {
      whereConditions.push('cr.risk_level = @riskLevel');
      params.riskLevel = risk_level;
    }

    if (assigned_to) {
      whereConditions.push('cr.assigned_to = @assignedTo');
      params.assignedTo = assigned_to;
    }

    if (requester_id) {
      whereConditions.push('cr.requester_id = @requesterId');
      params.requesterId = requester_id;
    }

    if (department_id) {
      whereConditions.push('cr.department_id = @departmentId');
      params.departmentId = department_id;
    }

    if (date_from) {
      whereConditions.push('cr.created_at >= @dateFrom');
      params.dateFrom = date_from;
    }

    if (date_to) {
      whereConditions.push('cr.created_at <= @dateTo');
      params.dateTo = date_to;
    }

    const whereSQL = whereConditions.length ? 'WHERE ' + whereConditions.join(' AND ') : '';

    // Whitelist sort columns
    const allowedSorts = ['created_at', 'updated_at', 'cr_number', 'title', 'risk_level', 'proposed_start', 'scheduled_start'];
    const sortCol = allowedSorts.includes(sort) ? `cr.${sort}` : 'cr.created_at';

    const countQuery = `
      SELECT COUNT(*) AS total 
      FROM change_requests cr
      LEFT JOIN cr_statuses cs ON cr.cr_status_id = cs.status_id
      LEFT JOIN cr_types ct ON cr.cr_type_id = ct.type_id
      ${whereSQL}
    `;

    const dataQuery = `
      SELECT 
        cr.cr_id, cr.cr_number, cr.title, cr.risk_level,
        cr.estimated_downtime_mins, cr.users_affected_count,
        cr.proposed_start, cr.proposed_end,
        cr.scheduled_start, cr.scheduled_end,
        cr.created_at, cr.updated_at,
        cr.maintenance_window,
        cs.status_id, cs.status_name, cs.status_code, cs.color_code,
        ct.type_id, ct.type_name, ct.type_code,
        cc.category_name, cc.category_code,
        tp.priority_name,
        req.first_name + ' ' + req.last_name AS requester_name,
        asgn.first_name + ' ' + asgn.last_name AS assigned_to_name,
        d.department_name,
        l.location_name
      FROM change_requests cr
      LEFT JOIN cr_statuses cs ON cr.cr_status_id = cs.status_id
      LEFT JOIN cr_types ct ON cr.cr_type_id = ct.type_id
      LEFT JOIN cr_categories cc ON cr.cr_category_id = cc.category_id
      LEFT JOIN ticket_priorities tp ON cr.priority_id = tp.priority_id
      LEFT JOIN users req ON cr.requester_id = req.user_id
      LEFT JOIN users asgn ON cr.assigned_to = asgn.user_id
      LEFT JOIN departments d ON cr.department_id = d.department_id
      LEFT JOIN locations l ON cr.location_id = l.location_id
      ${whereSQL}
      ORDER BY ${sortCol} ${order}
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `;

    params.offset = offset;
    params.limit = limit;

    const [countResult, dataResult] = await Promise.all([
      executeQuery(countQuery, params),
      executeQuery(dataQuery, params),
    ]);

    const total = countResult.recordset[0].total;
    const meta = getPaginationMeta(total, page, limit);

    return res.status(200).json(createResponse(true, 'Change requests fetched', dataResult.recordset, meta));
  } catch (error) {
    logger.error('Get CRs error', error);
    next(error);
  }
};

// ============================================
// GET /api/v1/cr/:id — Detail with related data
// ============================================
const getCRById = async (req, res, next) => {
  try {
    const crId = parseInt(req.params.id, 10);
    if (isNaN(crId)) {
      return res.status(400).json(createResponse(false, 'Invalid CR ID'));
    }

    const query = `
      SELECT 
        cr.*,
        cs.status_name, cs.status_code, cs.color_code, cs.is_final_status,
        ct.type_name, ct.type_code, ct.requires_cab_approval, ct.requires_manager_approval,
        cc.category_name, cc.category_code, cc.icon AS category_icon,
        csc.sub_category_name,
        tp.priority_name,
        req.first_name + ' ' + req.last_name AS requester_name, req.email AS requester_email,
        reqfor.first_name + ' ' + reqfor.last_name AS requested_for_name,
        asgn.first_name + ' ' + asgn.last_name AS assigned_to_name, asgn.email AS assigned_to_email,
        canc.first_name + ' ' + canc.last_name AS cancelled_by_name,
        d.department_name,
        l.location_name,
        p.process_name,
        t.ticket_number AS related_ticket_number, t.subject AS related_ticket_subject
      FROM change_requests cr
      LEFT JOIN cr_statuses cs ON cr.cr_status_id = cs.status_id
      LEFT JOIN cr_types ct ON cr.cr_type_id = ct.type_id
      LEFT JOIN cr_categories cc ON cr.cr_category_id = cc.category_id
      LEFT JOIN cr_sub_categories csc ON cr.cr_sub_category_id = csc.sub_category_id
      LEFT JOIN ticket_priorities tp ON cr.priority_id = tp.priority_id
      LEFT JOIN users req ON cr.requester_id = req.user_id
      LEFT JOIN users reqfor ON cr.requested_for_id = reqfor.user_id
      LEFT JOIN users asgn ON cr.assigned_to = asgn.user_id
      LEFT JOIN users canc ON cr.cancelled_by = canc.user_id
      LEFT JOIN departments d ON cr.department_id = d.department_id
      LEFT JOIN locations l ON cr.location_id = l.location_id
      LEFT JOIN processes p ON cr.process_id = p.process_id
      LEFT JOIN tickets t ON cr.related_ticket_id = t.ticket_id
      WHERE cr.cr_id = @crId
    `;

    const result = await executeQuery(query, { crId });

    if (!result.recordset.length) {
      return res.status(404).json(createResponse(false, 'Change request not found'));
    }

    const cr = result.recordset[0];

    // Check permission: user can view own CRs, or must have can_view_all_cr
    const canViewAll = req.user.permissions?.can_view_all_cr || false;
    if (!canViewAll && cr.requester_id !== req.user.user_id && cr.assigned_to !== req.user.user_id) {
      return res.status(403).json(createResponse(false, 'You do not have permission to view this CR'));
    }

    // Fetch related data in parallel
    const [comments, activities, approvals, affectedSystems, checklist, attachments, implSteps, journey] = await Promise.all([
      executeQuery(`SELECT c.*, u.first_name + ' ' + u.last_name AS commenter_name FROM cr_comments c LEFT JOIN users u ON c.commented_by = u.user_id WHERE c.cr_id = @crId ORDER BY c.commented_at DESC`, { crId }),
      executeQuery(`SELECT a.*, u.first_name + ' ' + u.last_name AS performer_name FROM cr_activities a LEFT JOIN users u ON a.performed_by = u.user_id WHERE a.cr_id = @crId ORDER BY a.performed_at DESC`, { crId }),
      executeQuery(`SELECT a.*, u.first_name + ' ' + u.last_name AS approver_name, u.email AS approver_email FROM cr_approvals a LEFT JOIN users u ON a.approver_id = u.user_id WHERE a.cr_id = @crId ORDER BY a.approval_order`, { crId }),
      executeQuery(`SELECT * FROM cr_affected_systems WHERE cr_id = @crId`, { crId }),
      executeQuery(`SELECT c.*, u.first_name + ' ' + u.last_name AS completed_by_name FROM cr_checklist_items c LEFT JOIN users u ON c.completed_by = u.user_id WHERE c.cr_id = @crId ORDER BY c.sort_order`, { crId }),
      executeQuery(`SELECT a.*, u.first_name + ' ' + u.last_name AS uploader_name FROM cr_attachments a LEFT JOIN users u ON a.uploaded_by = u.user_id WHERE a.cr_id = @crId ORDER BY a.uploaded_at DESC`, { crId }),
      executeQuery(`SELECT s.*, u.first_name + ' ' + u.last_name AS performer_name FROM cr_implementation_steps s LEFT JOIN users u ON s.performed_by = u.user_id WHERE s.cr_id = @crId ORDER BY s.step_number`, { crId }),
      crService.getJourney(crId),
    ]);

    cr.comments = comments.recordset;
    cr.activities = activities.recordset;
    cr.approvals = approvals.recordset;
    cr.affected_systems = affectedSystems.recordset;
    cr.checklist = checklist.recordset;
    cr.attachments = attachments.recordset;
    cr.implementation_steps = implSteps.recordset;
    cr.journey = journey;

    return res.status(200).json(createResponse(true, 'Change request fetched', cr));
  } catch (error) {
    logger.error('Get CR by ID error', error);
    next(error);
  }
};

// ============================================
// POST /api/v1/cr — Create new CR (DRAFT)
// ============================================
const createCR = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const {
      title, description, reason, expected_benefits, impact_description,
      risk_level, risk_assessment_notes, implementation_plan, test_plan,
      rollback_plan, communication_plan, estimated_downtime_mins, users_affected_count,
      cr_type_id, cr_category_id, cr_sub_category_id, priority_id,
      requested_for_id, department_id, location_id, process_id,
      related_ticket_id, proposed_start, proposed_end, maintenance_window,
      affected_systems, checklist_items,
      requested_approver_id,
    } = req.body;

    // Validate type exists
    const crType = await crService.getTypeById(cr_type_id);
    if (!crType) {
      return res.status(400).json(createResponse(false, 'Invalid change type'));
    }

    // Get DRAFT status
    const draftStatusId = await crService.getStatusId('DRAFT');

    const { crId, crNumber } = await executeInTransaction(async (transaction) => {
      // Generate CR number atomically
      const crNumber = await crService.generateCRNumber(transaction, executeInTransactionQuery);

      // Insert the CR
      const insertResult = await executeInTransactionQuery(transaction, `
        INSERT INTO change_requests (
          cr_number, title, description, reason, expected_benefits, impact_description,
          risk_level, risk_assessment_notes, implementation_plan, test_plan,
          rollback_plan, communication_plan, estimated_downtime_mins, users_affected_count,
          cr_type_id, cr_status_id, cr_category_id, cr_sub_category_id, priority_id,
          requester_id, requested_for_id, department_id, location_id, process_id,
          related_ticket_id, proposed_start, proposed_end, maintenance_window,
          requested_approver_id
        )
        OUTPUT INSERTED.cr_id
        VALUES (
          @crNumber, @title, @description, @reason, @expectedBenefits, @impactDescription,
          @riskLevel, @riskAssessmentNotes, @implementationPlan, @testPlan,
          @rollbackPlan, @communicationPlan, @estimatedDowntimeMins, @usersAffectedCount,
          @crTypeId, @crStatusId, @crCategoryId, @crSubCategoryId, @priorityId,
          @requesterId, @requestedForId, @departmentId, @locationId, @processId,
          @relatedTicketId, @proposedStart, @proposedEnd, @maintenanceWindow,
          @requestedApproverId
        )
      `, {
        crNumber,
        title,
        description: description ?? '',
        reason: reason || null,
        expectedBenefits: expected_benefits || null,
        impactDescription: impact_description || null,
        riskLevel: risk_level || crType.default_risk_level || 'MEDIUM',
        riskAssessmentNotes: risk_assessment_notes || null,
        implementationPlan: implementation_plan || null,
        testPlan: test_plan || null,
        rollbackPlan: rollback_plan || null,
        communicationPlan: communication_plan || null,
        estimatedDowntimeMins: estimated_downtime_mins || 0,
        usersAffectedCount: users_affected_count || 0,
        crTypeId: cr_type_id,
        crStatusId: draftStatusId,
        crCategoryId: cr_category_id || null,
        crSubCategoryId: cr_sub_category_id || null,
        priorityId: priority_id || null,
        requesterId: userId,
        requestedForId: requested_for_id || null,
        departmentId: department_id || null,
        locationId: location_id || null,
        processId: process_id || null,
        relatedTicketId: related_ticket_id || null,
        proposedStart: proposed_start ? new Date(proposed_start) : null,
        proposedEnd: proposed_end ? new Date(proposed_end) : null,
        maintenanceWindow: maintenance_window ? 1 : 0,
        requestedApproverId: requested_approver_id || null,
      });

      const crId = insertResult.recordset[0].cr_id;

      // Insert affected systems
      if (Array.isArray(affected_systems) && affected_systems.length) {
        for (const sys of affected_systems) {
          if (!sys.system_name) continue;
          await executeInTransactionQuery(transaction, `
            INSERT INTO cr_affected_systems (cr_id, system_name, system_type, impact_level, expected_downtime_mins, notes)
            VALUES (@crId, @systemName, @systemType, @impactLevel, @downtime, @notes)
          `, {
            crId,
            systemName: sys.system_name,
            systemType: sys.system_type || null,
            impactLevel: sys.impact_level || 'MEDIUM',
            downtime: sys.expected_downtime_mins || 0,
            notes: sys.notes || null,
          });
        }
      }

      // Insert checklist items
      if (Array.isArray(checklist_items) && checklist_items.length) {
        for (let i = 0; i < checklist_items.length; i++) {
          const item = checklist_items[i];
          if (!item.item_text) continue;
          await executeInTransactionQuery(transaction, `
            INSERT INTO cr_checklist_items (cr_id, item_text, sort_order)
            VALUES (@crId, @itemText, @sortOrder)
          `, {
            crId,
            itemText: item.item_text,
            sortOrder: i + 1,
          });
        }
      }

      // Log activity
      await executeInTransactionQuery(transaction, `
        INSERT INTO cr_activities (cr_id, activity_type, description, performed_by)
        VALUES (@crId, 'CR_CREATED', @desc, @userId)
      `, { crId, desc: `Change request ${crNumber} created as Draft`, userId });

      return { crId, crNumber };
    });

    // Log journey step (outside transaction is fine for journey)
    crService.logJourney(crId, 'CREATED', userId, {
      toStatus: 'DRAFT',
      summary: `Change request ${crNumber} created`,
    }).catch(err => logger.error('Journey log error', err));

    logger.success('CR created', { crId, crNumber, userId });

    return res.status(201).json(createResponse(true, 'Change request created', { cr_id: crId, cr_number: crNumber }));
  } catch (error) {
    logger.error('Create CR error', error);
    next(error);
  }
};

// ============================================
// PUT /api/v1/cr/:id — Update CR (DRAFT/REJECTED only)
// ============================================
const updateCR = async (req, res, next) => {
  try {
    const crId = parseInt(req.params.id, 10);
    if (isNaN(crId)) {
      return res.status(400).json(createResponse(false, 'Invalid CR ID'));
    }

    // Fetch current CR
    const current = await executeQuery(
      `SELECT cr.*, cs.status_code FROM change_requests cr
       LEFT JOIN cr_statuses cs ON cr.cr_status_id = cs.status_id
       WHERE cr.cr_id = @crId`,
      { crId }
    );

    if (!current.recordset.length) {
      return res.status(404).json(createResponse(false, 'Change request not found'));
    }

    const cr = current.recordset[0];

    // Only requester can edit, and only in DRAFT or REJECTED status
    if (cr.requester_id !== req.user.user_id) {
      return res.status(403).json(createResponse(false, 'Only the requester can edit this CR'));
    }
    if (!['DRAFT', 'REJECTED'].includes(cr.status_code)) {
      return res.status(400).json(createResponse(false, `Cannot edit CR in '${cr.status_code}' status`));
    }

    const updatableFields = [
      'title', 'description', 'reason', 'expected_benefits', 'impact_description',
      'risk_level', 'risk_assessment_notes', 'implementation_plan', 'test_plan',
      'rollback_plan', 'communication_plan', 'estimated_downtime_mins', 'users_affected_count',
      'cr_type_id', 'cr_category_id', 'cr_sub_category_id', 'priority_id',
      'requested_for_id', 'department_id', 'location_id', 'process_id',
      'related_ticket_id', 'proposed_start', 'proposed_end', 'maintenance_window',
    ];

    const setClauses = ['updated_at = GETDATE()'];
    const params = { crId };
    const changes = [];
    const preserveEmptyStringFields = new Set(['description']);

    for (const field of updatableFields) {
      if (req.body[field] !== undefined) {
        const paramName = field.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        setClauses.push(`${field} = @${paramName}`);
        params[paramName] = req.body[field] === '' && !preserveEmptyStringFields.has(field) ? null : req.body[field];
        if (String(cr[field]) !== String(req.body[field])) {
          changes.push({ field, old: cr[field], new: req.body[field] });
        }
      }
    }

    if (setClauses.length <= 1) {
      return res.status(400).json(createResponse(false, 'No fields to update'));
    }

    await executeQuery(
      `UPDATE change_requests SET ${setClauses.join(', ')} WHERE cr_id = @crId`,
      params
    );

    // Log significant changes
    for (const change of changes.slice(0, 10)) {
      await crService.logActivity(crId, 'CR_UPDATED', req.user.user_id, {
        fieldName: change.field,
        oldValue: String(change.old || '').substring(0, 500),
        newValue: String(change.new || '').substring(0, 500),
      });
    }

    logger.success('CR updated', { crId, changesCount: changes.length });

    return res.status(200).json(createResponse(true, 'Change request updated'));
  } catch (error) {
    logger.error('Update CR error', error);
    next(error);
  }
};

// ============================================
// DELETE /api/v1/cr/:id — Delete (DRAFT only)
// ============================================
const deleteCR = async (req, res, next) => {
  try {
    const crId = parseInt(req.params.id, 10);
    if (isNaN(crId)) {
      return res.status(400).json(createResponse(false, 'Invalid CR ID'));
    }

    const current = await executeQuery(
      `SELECT cr.requester_id, cs.status_code FROM change_requests cr
       LEFT JOIN cr_statuses cs ON cr.cr_status_id = cs.status_id
       WHERE cr.cr_id = @crId`,
      { crId }
    );

    if (!current.recordset.length) {
      return res.status(404).json(createResponse(false, 'Change request not found'));
    }

    const cr = current.recordset[0];

    const isAdmin = req.user.role?.role_code === 'ADMIN';
    if (cr.status_code !== 'DRAFT' && !isAdmin) {
      return res.status(400).json(createResponse(false, 'Only DRAFT change requests can be deleted'));
    }
    if (cr.requester_id !== req.user.user_id && !isAdmin) {
      return res.status(403).json(createResponse(false, 'Only the requester or admin can delete this CR'));
    }

    // Delete related data first, then the CR
    await executeInTransaction(async (transaction) => {
      const tables = ['cr_activities', 'cr_comments', 'cr_approvals', 'cr_affected_systems', 'cr_checklist_items', 'cr_attachments', 'cr_implementation_steps'];
      for (const table of tables) {
        await executeInTransactionQuery(transaction, `DELETE FROM ${table} WHERE cr_id = @crId`, { crId });
      }
      await executeInTransactionQuery(transaction, `DELETE FROM change_requests WHERE cr_id = @crId`, { crId });
    });

    logger.success('CR deleted', { crId });

    return res.status(200).json(createResponse(true, 'Change request deleted'));
  } catch (error) {
    logger.error('Delete CR error', error);
    next(error);
  }
};

// ============================================
// WORKFLOW TRANSITIONS
// ============================================

/**
 * Helper to perform a status transition
 */
const transitionCR = async (req, res, crId, toStatusCode, { 
  allowedRoles, 
  requesterOnly = false,
  extraUpdates = {},
  activityType,
  activityDescription,
  validate,
} = {}) => {
  const current = await executeQuery(
    `SELECT cr.*, cs.status_code FROM change_requests cr
     LEFT JOIN cr_statuses cs ON cr.cr_status_id = cs.status_id
     WHERE cr.cr_id = @crId`,
    { crId }
  );

  if (!current.recordset.length) {
    res.status(404).json(createResponse(false, 'Change request not found'));
    return false;
  }

  const cr = current.recordset[0];

  // Check valid transition
  if (!crService.isValidTransition(cr.status_code, toStatusCode)) {
    res.status(400).json(createResponse(false, `Cannot transition from '${cr.status_code}' to '${toStatusCode}'`));
    return false;
  }

  // Check permission
  if (requesterOnly && cr.requester_id !== req.user.user_id) {
    res.status(403).json(createResponse(false, 'Only the requester can perform this action'));
    return false;
  }

  if (allowedRoles && !allowedRoles.includes(req.user.role?.role_code)) {
    // Also check specific permissions
    const hasPermission = (
      req.user.permissions?.can_approve_cr || 
      req.user.permissions?.can_implement_cr || 
      req.user.permissions?.can_manage_cr_settings ||
      req.user.user_id === cr.requester_id ||
      req.user.user_id === cr.assigned_to
    );
    if (!hasPermission) {
      res.status(403).json(createResponse(false, 'Insufficient permissions'));
      return false;
    }
  }

  // Custom validation
  if (validate) {
    const validationError = await validate(cr, req);
    if (validationError) {
      res.status(400).json(createResponse(false, validationError));
      return false;
    }
  }

  const newStatusId = await crService.getStatusId(toStatusCode);

  // Build SET clause
  const setClauses = ['cr_status_id = @newStatusId', 'updated_at = GETDATE()'];
  const params = { crId, newStatusId };

  for (const [key, value] of Object.entries(extraUpdates)) {
    const paramName = `extra_${key}`;
    setClauses.push(`${key} = @${paramName}`);
    params[paramName] = value;
  }

  await executeQuery(
    `UPDATE change_requests SET ${setClauses.join(', ')} WHERE cr_id = @crId`,
    params
  );

  // Log activity
  await crService.logActivity(crId, activityType || `CR_${toStatusCode}`, req.user.user_id, {
    oldValue: cr.status_code,
    newValue: toStatusCode,
    description: activityDescription || `Status changed from ${cr.status_code} to ${toStatusCode}`,
  });

  // Log journey step
  crService.logJourney(crId, toStatusCode, req.user.user_id, {
    fromStatus: cr.status_code,
    toStatus: toStatusCode,
    fromUserId: cr.assigned_to || null,
    toUserId: extraUpdates.assigned_to || cr.assigned_to || null,
    summary: activityDescription || `Status changed from ${cr.status_code} to ${toStatusCode}`,
  }).catch(err => logger.error('Journey log error', err));

  res.status(200).json(createResponse(true, `Change request ${toStatusCode.toLowerCase().replace(/_/g, ' ')}`));
  return true;
};

// PATCH /api/v1/cr/:id/submit
const submitCR = async (req, res, next) => {
  try {
    const crId = parseInt(req.params.id, 10);
    if (isNaN(crId)) return res.status(400).json(createResponse(false, 'Invalid CR ID'));

    // Get CR with routing info
    const cr = await executeQuery(
      `SELECT cr_type_id, requested_approver_id, assigned_to, department_id, location_id 
       FROM change_requests WHERE cr_id = @crId`,
      { crId }
    );
    if (!cr.recordset.length) return res.status(404).json(createResponse(false, 'CR not found'));
    
    const crData = cr.recordset[0];
    const reviewDueDate = await crService.calculateReviewDueDate(crData.cr_type_id);

    // Load CR settings
    const crSettings = await settingsService.getByCategory('cr');
    const centralTeamEnabled = crSettings.cr_central_team_enabled === 'true' || crSettings.cr_central_team_enabled === true;
    const centralTeamId = crSettings.cr_central_team_id ? parseInt(crSettings.cr_central_team_id) : null;
    const centralTeamMode = crSettings.cr_central_team_mode || 'always';
    const allowApproverSelect = crSettings.cr_allow_requester_approver_select === 'true' || crSettings.cr_allow_requester_approver_select === true;

    // Determine which path: approver selected → PENDING_APPROVAL; otherwise → SUBMITTED + CTT
    const hasApprover = !!(crData.requested_approver_id && allowApproverSelect);

    const extraUpdates = { 
      submitted_at: new Date(),
      review_due_date: reviewDueDate,
    };

    if (hasApprover) {
      // ---- APPROVER PATH ----
      // Assign directly to the selected approver, skip CTT routing entirely
      extraUpdates.assigned_to = crData.requested_approver_id;

      // Create approval chain before transitioning
      await crApprovalService.createApprovalChain(crId, crData.cr_type_id);

      // Go directly DRAFT → PENDING_APPROVAL (no SUBMITTED step, no CTT)
      await transitionCR(req, res, crId, 'PENDING_APPROVAL', {
        requesterOnly: true,
        extraUpdates,
        activityType: 'CR_SUBMITTED_TO_APPROVAL',
        activityDescription: 'Submitted and sent directly to approval queue',
      });

      // Notify the approver (fire-and-forget)
      ;(async () => {
        try {
          const crNum = await executeQuery(`SELECT cr_number, title FROM change_requests WHERE cr_id = @crId`, { crId });
          const crInfo = crNum.recordset[0];
          await executeQuery(`
            INSERT INTO notifications (user_id, notification_type, title, message, related_ticket_id)
            VALUES (@userId, 'CR_APPROVAL_REQUESTED', 'CR Awaiting Your Approval', @msg, NULL)
          `, {
            userId: crData.requested_approver_id,
            msg: `CR #${crInfo?.cr_number} - "${crInfo?.title}" has been submitted and requires your approval`,
          });
        } catch (err) {
          logger.warn('Approver notification error (non-blocking)', { error: err.message });
        }
      })();

    } else {
      // ---- CTT REVIEW PATH ----
      // Try auto-assignment to an engineer
      const engineer = await crAutoAssignment.findEngineer({
        departmentId: crData.department_id,
        locationId: crData.location_id,
      });
      if (engineer) {
        extraUpdates.assigned_to = engineer.user_id;
      }

      // Route to central team
      if (centralTeamEnabled && centralTeamId) {
        if (centralTeamMode === 'always' || centralTeamMode === 'category_fallback') {
          extraUpdates.team_id = centralTeamId;
          extraUpdates.routed_at = new Date();
        }
      }

      await transitionCR(req, res, crId, 'SUBMITTED', {
        requesterOnly: true,
        extraUpdates,
        activityType: 'CR_SUBMITTED',
        activityDescription: 'Change request submitted for review',
      });

      // Log team routing journey step
      if (extraUpdates.team_id) {
        const teamResult = await executeQuery(
          `SELECT team_name FROM teams WHERE team_id = @teamId`, { teamId: extraUpdates.team_id }
        );
        const teamName = teamResult.recordset[0]?.team_name || 'Team';
        crService.logJourney(crId, 'TEAM_ROUTED', req.user.user_id, {
          toStatus: 'SUBMITTED',
          summary: `Routed to ${teamName}`,
        }).catch(err => logger.error('Journey log error', err));
      }
    }

    // ---- Notifications to admins/managers (both paths) ----
    try {
      const admins = await executeQuery(
        `SELECT u.user_id FROM users u 
         INNER JOIN user_roles r ON u.role_id = r.role_id 
         WHERE r.role_code IN ('ADMIN', 'MANAGER') AND u.is_active = 1`
      );
      const crNum = await executeQuery(`SELECT cr_number, title FROM change_requests WHERE cr_id = @crId`, { crId });
      const crInfo = crNum.recordset[0];

      for (const admin of admins.recordset) {
        if (admin.user_id !== req.user.user_id) {
          await executeQuery(`
            INSERT INTO notifications (user_id, notification_type, title, message, related_ticket_id)
            VALUES (@userId, 'CR_SUBMITTED', 'New Change Request Submitted', @msg, NULL)
          `, {
            userId: admin.user_id,
            msg: `CR #${crInfo?.cr_number} - ${crInfo?.title} submitted by ${req.user.full_name}`,
          });
        }
      }

      // Notify assigned engineer (CTT path only — approver gets their own notification above)
      if (!hasApprover && extraUpdates.assigned_to && extraUpdates.assigned_to !== req.user.user_id) {
        await executeQuery(`
          INSERT INTO notifications (user_id, notification_type, title, message, related_ticket_id)
          VALUES (@userId, 'CR_ASSIGNED', 'CR Assigned to You', @msg, NULL)
        `, {
          userId: extraUpdates.assigned_to,
          msg: `CR #${crInfo?.cr_number} - ${crInfo?.title} has been assigned to you`,
        });
      }
    } catch (notifErr) {
      logger.warn('CR submit notification error (non-blocking)', { error: notifErr.message });
    }

    // Fire-and-forget email notification
    getCRForNotification(crId).then(n => {
      if (n) crNotification.notifyCRSubmitted(n, n.requester_email, n.requester_name);
    }).catch(err => logger.error('Submit notification error', err));
  } catch (error) {
    logger.error('Submit CR error', error);
    next(error);
  }
};

// PATCH /api/v1/cr/:id/start-review
const startReview = async (req, res, next) => {
  try {
    const crId = parseInt(req.params.id, 10);
    if (isNaN(crId)) return res.status(400).json(createResponse(false, 'Invalid CR ID'));

    // Get CR type to create approval chain
    const cr = await executeQuery(`SELECT cr_type_id FROM change_requests WHERE cr_id = @crId`, { crId });
    if (cr.recordset.length) {
      await crApprovalService.createApprovalChain(crId, cr.recordset[0].cr_type_id);
    }

    // Check if approval chain was created — if so go to PENDING_APPROVAL
    const approvals = await crApprovalService.getApprovalChain(crId);
    const targetStatus = approvals.length > 0 ? 'PENDING_APPROVAL' : 'UNDER_REVIEW';

    await transitionCR(req, res, crId, targetStatus, {
      extraUpdates: { assigned_to: req.user.user_id },
      activityType: 'CR_REVIEWED',
      activityDescription: approvals.length > 0
        ? `Review started by ${req.user.full_name}. Awaiting ${approvals.length} approval(s).`
        : `Review started by ${req.user.full_name}`,
    });

    // Notify approvers if approval chain was created
    if (approvals.length > 0) {
      getCRForNotification(crId).then(n => {
        if (!n) return;
        for (const a of approvals) {
          crNotification.notifyApprovalRequest(n, a.approver_email, a.approver_name, a.approver_id, a.approver_role);
        }
      }).catch(err => logger.error('Approval request notification error', err));
    }
  } catch (error) {
    logger.error('Start review error', error);
    next(error);
  }
};

// PATCH /api/v1/cr/:id/request-info
const requestInfo = async (req, res, next) => {
  try {
    const crId = parseInt(req.params.id, 10);
    if (isNaN(crId)) return res.status(400).json(createResponse(false, 'Invalid CR ID'));

    const { comment_text } = req.body;

    // Determine source status to know where to return after info provided
    const current = await executeQuery(
      `SELECT cs.status_code FROM change_requests cr
       LEFT JOIN cr_statuses cs ON cr.cr_status_id = cs.status_id
       WHERE cr.cr_id = @crId`, { crId }
    );
    const fromStatus = current.recordset[0]?.status_code || 'UNDER_REVIEW';

    await transitionCR(req, res, crId, 'PENDING_INFO', {
      extraUpdates: { pir_notes: fromStatus }, // store source status for return routing
      activityType: 'CR_INFO_REQUESTED',
      activityDescription: comment_text || 'More information requested',
    });

    // Add the info request as a comment
    if (comment_text) {
      await executeQuery(`
        INSERT INTO cr_comments (cr_id, comment_text, is_internal, commented_by)
        VALUES (@crId, @commentText, 0, @userId)
      `, { crId, commentText: comment_text, userId: req.user.user_id });
    }
  } catch (error) {
    logger.error('Request info error', error);
    next(error);
  }
};

// PATCH /api/v1/cr/:id/provide-info
const provideInfo = async (req, res, next) => {
  try {
    const crId = parseInt(req.params.id, 10);
    if (isNaN(crId)) return res.status(400).json(createResponse(false, 'Invalid CR ID'));

    const { comment_text } = req.body;

    // Check if this came from PENDING_APPROVAL (pir_notes stores source status)
    const current = await executeQuery(
      `SELECT pir_notes FROM change_requests WHERE cr_id = @crId`, { crId }
    );
    const fromStatus = current.recordset[0]?.pir_notes;
    const returnStatus = fromStatus === 'PENDING_APPROVAL' ? 'PENDING_APPROVAL' : 'UNDER_REVIEW';

    await transitionCR(req, res, crId, returnStatus, {
      requesterOnly: true,
      activityType: 'CR_INFO_PROVIDED',
      activityDescription: 'Additional information provided by requester',
    });

    if (comment_text) {
      await executeQuery(`
        INSERT INTO cr_comments (cr_id, comment_text, is_internal, commented_by)
        VALUES (@crId, @commentText, 0, @userId)
      `, { crId, commentText: comment_text, userId: req.user.user_id });
    }
  } catch (error) {
    logger.error('Provide info error', error);
    next(error);
  }
};

// PATCH /api/v1/cr/:id/approve
const approveCR = async (req, res, next) => {
  try {
    const crId = parseInt(req.params.id, 10);
    if (isNaN(crId)) return res.status(400).json(createResponse(false, 'Invalid CR ID'));

    const approved = await transitionCR(req, res, crId, 'APPROVED', {
      extraUpdates: { 
        approved_at: new Date(),
        reviewed_at: new Date(),
        review_sla_met: 1,
      },
      activityType: 'CR_APPROVED',
      activityDescription: `Approved by ${req.user.full_name}`,
      validate: async (cr) => {
        // Check if user can approve
        if (!req.user.permissions?.can_approve_cr && req.user.role?.role_code !== 'ADMIN') {
          return 'You do not have permission to approve CRs';
        }
        if (cr.requester_id === req.user.user_id) {
          return 'You cannot approve your own change request';
        }
        return null;
      },
    });
    if (!approved) return;

    // Post-approval routing: check cr_post_approval_routing setting
    (async () => {
      try {
        const crSettings = await settingsService.getByCategory('cr');
        const postApprovalRouting = crSettings.cr_post_approval_routing || 'tcc_team';
        const centralTeamEnabled = crSettings.cr_central_team_enabled === 'true' || crSettings.cr_central_team_enabled === true;
        const centralTeamId = crSettings.cr_central_team_id ? parseInt(crSettings.cr_central_team_id) : null;

        if (postApprovalRouting === 'tcc_team' && centralTeamEnabled && centralTeamId) {
          // Route approved CR to TCC/central team for assignment to an implementer
          // Clear assigned_to so it appears in CTT team bucket as unassigned
          await executeQuery(
            `UPDATE change_requests SET team_id = @teamId, assigned_to = NULL, routed_at = GETDATE(), updated_at = GETDATE() WHERE cr_id = @crId`,
            { crId, teamId: centralTeamId }
          );

          const teamResult = await executeQuery(
            `SELECT team_name FROM teams WHERE team_id = @teamId`, { teamId: centralTeamId }
          );
          const teamName = teamResult.recordset[0]?.team_name || 'TCC Team';

          crService.logJourney(crId, 'TEAM_ROUTED', req.user.user_id, {
            toStatus: 'APPROVED',
            summary: `Routed to ${teamName} for assignment after approval`,
          }).catch(() => {});

          await crService.logActivity(crId, 'CR_ROUTED_POST_APPROVAL', req.user.user_id, {
            description: `Routed to ${teamName} — awaiting assignment to implementer`,
          });
        }
      } catch (err) {
        logger.error('Post-approval routing error (non-blocking)', { error: err.message });
      }
    })();

    // Notify requester of approval
    getCRForNotification(crId).then(n => {
      if (n) crNotification.notifyCRApproved(n, n.requester_email, n.requester_name);
    }).catch(err => logger.error('Approve notification error', err));
  } catch (error) {
    logger.error('Approve CR error', error);
    next(error);
  }
};

// PATCH /api/v1/cr/:id/reject
const rejectCR = async (req, res, next) => {
  try {
    const crId = parseInt(req.params.id, 10);
    if (isNaN(crId)) return res.status(400).json(createResponse(false, 'Invalid CR ID'));

    const { reason } = req.body;

    // Check current status - if PENDING_APPROVAL, auto-cancel
    const current = await executeQuery(
      `SELECT cr.*, cs.status_code FROM change_requests cr
       LEFT JOIN cr_statuses cs ON cr.cr_status_id = cs.status_id
       WHERE cr.cr_id = @crId`,
      { crId }
    );
    if (!current.recordset.length) return res.status(404).json(createResponse(false, 'CR not found'));
    const currentStatus = current.recordset[0].status_code;

    if (currentStatus === 'PENDING_APPROVAL') {
      // Reject from approval queue → auto-cancel
      const cancelReason = reason || `Rejected and cancelled by approver ${req.user.full_name}`;
      await transitionCR(req, res, crId, 'CANCELLED', {
        extraUpdates: { rejected_at: new Date() },
        activityType: 'CR_REJECTED_CANCELLED',
        activityDescription: cancelReason,
        validate: async () => {
          if (!req.user.permissions?.can_approve_cr && req.user.role?.role_code !== 'ADMIN') {
            return 'You do not have permission to reject CRs';
          }
          return null;
        },
      });
      if (reason) {
        await executeQuery(`
          INSERT INTO cr_comments (cr_id, comment_text, is_internal, commented_by)
          VALUES (@crId, @commentText, 0, @userId)
        `, { crId, commentText: `CR rejected and cancelled. Reason: ${reason}`, userId: req.user.user_id });
      }
    } else {
      await transitionCR(req, res, crId, 'REJECTED', {
        extraUpdates: { 
          rejected_at: new Date(),
          reviewed_at: new Date(),
        },
        activityType: 'CR_REJECTED',
        activityDescription: reason || `Rejected by ${req.user.full_name}`,
        validate: async () => {
          if (!req.user.permissions?.can_approve_cr && req.user.role?.role_code !== 'ADMIN') {
            return 'You do not have permission to reject CRs';
          }
          return null;
        },
      });
      if (reason) {
        await executeQuery(`
          INSERT INTO cr_comments (cr_id, comment_text, is_internal, commented_by)
          VALUES (@crId, @commentText, 0, @userId)
        `, { crId, commentText: `Rejection reason: ${reason}`, userId: req.user.user_id });
      }
    }

    // Notify requester of rejection
    getCRForNotification(crId).then(n => {
      if (n) crNotification.notifyCRRejected(n, n.requester_email, n.requester_name, req.user.full_name, reason);
    }).catch(err => logger.error('Reject notification error', err));
  } catch (error) {
    logger.error('Reject CR error', error);
    next(error);
  }
};

// PATCH /api/v1/cr/:id/schedule
const scheduleCR = async (req, res, next) => {
  try {
    const crId = parseInt(req.params.id, 10);
    if (isNaN(crId)) return res.status(400).json(createResponse(false, 'Invalid CR ID'));

    const { scheduled_start, scheduled_end } = req.body;

    if (!scheduled_start || !scheduled_end) {
      return res.status(400).json(createResponse(false, 'Scheduled start and end dates are required'));
    }

    const start = new Date(scheduled_start);
    const end = new Date(scheduled_end);

    if (end <= start) {
      return res.status(400).json(createResponse(false, 'End date must be after start date'));
    }

    // Check blackout periods
    const blackouts = await crService.checkBlackoutPeriod(start, end);
    if (blackouts.length) {
      return res.status(400).json(createResponse(false, 
        `Schedule conflicts with blackout period: ${blackouts[0].title} (${blackouts[0].start_date} - ${blackouts[0].end_date})`,
        { blackouts }
      ));
    }

    await transitionCR(req, res, crId, 'SCHEDULED', {
      extraUpdates: { scheduled_start: start, scheduled_end: end },
      activityType: 'CR_SCHEDULED',
      activityDescription: `Scheduled for ${start.toISOString()} to ${end.toISOString()}`,
    });

    // Notify requester of schedule
    getCRForNotification(crId).then(n => {
      if (n) crNotification.notifyCRScheduled(n, n.requester_email, n.requester_name, n.requester_id);
    }).catch(err => logger.error('Schedule notification error', err));
  } catch (error) {
    logger.error('Schedule CR error', error);
    next(error);
  }
};

// PATCH /api/v1/cr/:id/start
const startImplementation = async (req, res, next) => {
  try {
    const crId = parseInt(req.params.id, 10);
    if (isNaN(crId)) return res.status(400).json(createResponse(false, 'Invalid CR ID'));

    const { planned_end_date } = req.body || {};

    const extraUpdates = { actual_start: new Date() };
    if (planned_end_date) {
      const end = new Date(planned_end_date);
      if (!isNaN(end.getTime())) {
        extraUpdates.scheduled_start = new Date();
        extraUpdates.scheduled_end = end;
      }
    }

    const endLabel = planned_end_date ? `. Planned completion: ${new Date(planned_end_date).toLocaleDateString()}` : '';

    await transitionCR(req, res, crId, 'IN_PROGRESS', {
      extraUpdates,
      activityType: 'CR_STARTED',
      activityDescription: `Implementation started by ${req.user.full_name}${endLabel}`,
      validate: async (cr) => {
        const isAssignee = cr.assigned_to === req.user.user_id;
        if (!req.user.permissions?.can_implement_cr && req.user.role?.role_code !== 'ADMIN' && !isAssignee) {
          return 'Only the assigned engineer, implementers, or admins can start implementation';
        }
        return null;
      },
    });

    // Notify requester that implementation started
    getCRForNotification(crId).then(n => {
      if (n) crNotification.notifyCRImplementationStarted(n, n.requester_email, n.requester_name, n.requester_id, req.user.full_name);
    }).catch(err => logger.error('Start implementation notification error', err));
  } catch (error) {
    logger.error('Start implementation error', error);
    next(error);
  }
};

// PATCH /api/v1/cr/:id/complete
const completeCR = async (req, res, next) => {
  try {
    const crId = parseInt(req.params.id, 10);
    if (isNaN(crId)) return res.status(400).json(createResponse(false, 'Invalid CR ID'));

    const { implementation_notes, pir_notes, pir_outcome } = req.body;

    await transitionCR(req, res, crId, 'IMPLEMENTED', {
      extraUpdates: {
        actual_end: new Date(),
        completed_at: new Date(),
        implementation_notes: implementation_notes || null,
        pir_notes: pir_notes || null,
        pir_outcome: pir_outcome || null,
      },
      activityType: 'CR_COMPLETED',
      activityDescription: `Implementation completed by ${req.user.full_name}. Outcome: ${pir_outcome || 'Not specified'}`,
    });

    // Notify requester of completion
    getCRForNotification(crId).then(n => {
      if (n) crNotification.notifyCRCompleted(n, n.requester_email, n.requester_name, n.requester_id);
    }).catch(err => logger.error('Complete notification error', err));
  } catch (error) {
    logger.error('Complete CR error', error);
    next(error);
  }
};

// PATCH /api/v1/cr/:id/rollback
const rollbackCR = async (req, res, next) => {
  try {
    const crId = parseInt(req.params.id, 10);
    if (isNaN(crId)) return res.status(400).json(createResponse(false, 'Invalid CR ID'));

    const { reason } = req.body;

    await transitionCR(req, res, crId, 'ROLLED_BACK', {
      extraUpdates: {
        actual_end: new Date(),
        completed_at: new Date(),
        pir_outcome: 'Rolled Back',
        implementation_notes: reason || 'Rollback executed',
      },
      activityType: 'CR_ROLLED_BACK',
      activityDescription: reason || `Rollback executed by ${req.user.full_name}`,
    });

    // Notify requester of rollback
    getCRForNotification(crId).then(n => {
      if (n) crNotification.notifyCRRolledBack(n, n.requester_email, n.requester_name, n.requester_id);
    }).catch(err => logger.error('Rollback notification error', err));
  } catch (error) {
    logger.error('Rollback CR error', error);
    next(error);
  }
};

// PATCH /api/v1/cr/:id/cancel
const cancelCR = async (req, res, next) => {
  try {
    const crId = parseInt(req.params.id, 10);
    if (isNaN(crId)) return res.status(400).json(createResponse(false, 'Invalid CR ID'));

    const { reason } = req.body;

    await transitionCR(req, res, crId, 'CANCELLED', {
      extraUpdates: {
        cancelled_at: new Date(),
        cancelled_by: req.user.user_id,
        cancel_reason: reason || null,
      },
      activityType: 'CR_CANCELLED',
      activityDescription: reason || `Cancelled by ${req.user.full_name}`,
    });

    // Notify requester of cancellation
    getCRForNotification(crId).then(n => {
      if (n && n.requester_id !== req.user.user_id) {
        crNotification.notifyCRCancelled(n, n.requester_email, n.requester_name, n.requester_id, req.user.full_name, reason);
      }
    }).catch(err => logger.error('Cancel notification error', err));
  } catch (error) {
    logger.error('Cancel CR error', error);
    next(error);
  }
};

// PATCH /api/v1/cr/:id/resubmit
const resubmitCR = async (req, res, next) => {
  try {
    const crId = parseInt(req.params.id, 10);
    if (isNaN(crId)) return res.status(400).json(createResponse(false, 'Invalid CR ID'));

    const reviewDueDate = await (async () => {
      const cr = await executeQuery(`SELECT cr_type_id FROM change_requests WHERE cr_id = @crId`, { crId });
      if (!cr.recordset.length) return null;
      return crService.calculateReviewDueDate(cr.recordset[0].cr_type_id);
    })();

    await transitionCR(req, res, crId, 'SUBMITTED', {
      requesterOnly: true,
      extraUpdates: {
        submitted_at: new Date(),
        rejected_at: null,
        review_due_date: reviewDueDate,
      },
      activityType: 'CR_RESUBMITTED',
      activityDescription: 'Change request revised and resubmitted',
    });
  } catch (error) {
    logger.error('Resubmit CR error', error);
    next(error);
  }
};

// PATCH /api/v1/cr/:id/close
const closeCR = async (req, res, next) => {
  try {
    const crId = parseInt(req.params.id, 10);
    if (isNaN(crId)) return res.status(400).json(createResponse(false, 'Invalid CR ID'));

    const { pir_notes, pir_outcome } = req.body;

    await transitionCR(req, res, crId, 'CLOSED', {
      extraUpdates: {
        completed_at: new Date(),
        pir_notes: pir_notes || null,
        pir_outcome: pir_outcome || null,
      },
      activityType: 'CR_CLOSED',
      activityDescription: `CR closed. PIR outcome: ${pir_outcome || 'Not specified'}`,
    });
  } catch (error) {
    logger.error('Close CR error', error);
    next(error);
  }
};

// PATCH /api/v1/cr/:id/reschedule
// Reassign schedule dates while staying in SCHEDULED status
const rescheduleCR = async (req, res, next) => {
  try {
    const crId = parseInt(req.params.id, 10);
    if (isNaN(crId)) return res.status(400).json(createResponse(false, 'Invalid CR ID'));

    const { scheduled_start, scheduled_end, maintenance_window, reschedule_reason } = req.body;

    if (!scheduled_start || !scheduled_end) {
      return res.status(400).json(createResponse(false, 'Scheduled start and end dates are required'));
    }

    const start = new Date(scheduled_start);
    const end = new Date(scheduled_end);

    if (end <= start) {
      return res.status(400).json(createResponse(false, 'End date must be after start date'));
    }

    const current = await executeQuery(
      `SELECT cr.*, cs.status_code FROM change_requests cr
       LEFT JOIN cr_statuses cs ON cr.cr_status_id = cs.status_id
       WHERE cr.cr_id = @crId`,
      { crId }
    );
    if (!current.recordset.length) return res.status(404).json(createResponse(false, 'Change request not found'));

    const cr = current.recordset[0];

    if (cr.status_code !== 'SCHEDULED') {
      return res.status(400).json(createResponse(false, 'Only SCHEDULED change requests can be rescheduled'));
    }

    const isAssignee = cr.assigned_to === req.user.user_id;
    const canImpl = req.user.permissions?.can_implement_cr;
    const isAdmin = req.user.role?.role_code === 'ADMIN';

    if (!isAssignee && !canImpl && !isAdmin) {
      return res.status(403).json(createResponse(false, 'Only the assigned engineer, implementers, or admins can reschedule CRs'));
    }

    const blackouts = await crService.checkBlackoutPeriod(start, end);
    if (blackouts.length) {
      return res.status(400).json(createResponse(false,
        `Schedule conflicts with blackout period: ${blackouts[0].title} (${blackouts[0].start_date} - ${blackouts[0].end_date})`,
        { blackouts }
      ));
    }

    await executeQuery(
      `UPDATE change_requests SET scheduled_start = @scheduledStart, scheduled_end = @scheduledEnd,
       maintenance_window = @maintenanceWindow, updated_at = GETDATE() WHERE cr_id = @crId`,
      { crId, scheduledStart: start, scheduledEnd: end, maintenanceWindow: maintenance_window ? 1 : 0 }
    );

    const desc = reschedule_reason
      ? `Rescheduled by ${req.user.full_name}. Reason: ${reschedule_reason}`
      : `Rescheduled by ${req.user.full_name} to ${start.toLocaleDateString()} – ${end.toLocaleDateString()}`;

    await crService.logActivity(crId, 'CR_RESCHEDULED', req.user.user_id, { description: desc });

    crService.logJourney(crId, 'SCHEDULED', req.user.user_id, {
      fromStatus: 'SCHEDULED',
      toStatus: 'SCHEDULED',
      summary: desc,
    }).catch(() => {});

    return res.status(200).json(createResponse(true, 'Change request rescheduled successfully'));
  } catch (error) {
    logger.error('Reschedule CR error', error);
    next(error);
  }
};

// PATCH /api/v1/cr/:id/send-to-approval
// Assigned engineer sends CR from UNDER_REVIEW to PENDING_APPROVAL
const sendToApproval = async (req, res, next) => {
  try {
    const crId = parseInt(req.params.id, 10);
    if (isNaN(crId)) return res.status(400).json(createResponse(false, 'Invalid CR ID'));

    const current = await executeQuery(
      `SELECT cr.*, cs.status_code FROM change_requests cr
       LEFT JOIN cr_statuses cs ON cr.cr_status_id = cs.status_id
       WHERE cr.cr_id = @crId`,
      { crId }
    );
    if (!current.recordset.length) return res.status(404).json(createResponse(false, 'Change request not found'));

    const cr = current.recordset[0];

    if (cr.status_code !== 'UNDER_REVIEW') {
      return res.status(400).json(createResponse(false, 'CR must be in UNDER_REVIEW status to send for approval'));
    }

    const isAssignee = cr.assigned_to === req.user.user_id;
    const canImpl = req.user.permissions?.can_implement_cr;
    const canApprove = req.user.permissions?.can_approve_cr;
    const isAdmin = req.user.role?.role_code === 'ADMIN';

    if (!isAssignee && !canImpl && !canApprove && !isAdmin) {
      return res.status(403).json(createResponse(false, 'You do not have permission to send this CR for approval'));
    }

    // Ensure approval chain exists (create if not already created)
    const existingApprovals = await crApprovalService.getApprovalChain(crId);
    if (existingApprovals.length === 0) {
      await crApprovalService.createApprovalChain(crId, cr.cr_type_id);
    }

    const approvals = await crApprovalService.getApprovalChain(crId);

    if (approvals.length === 0) {
      // No approval chain for this type — treat as directly approved
      await transitionCR(req, res, crId, 'APPROVED', {
        extraUpdates: { approved_at: new Date() },
        activityType: 'CR_APPROVED',
        activityDescription: `No formal approval required. Pre-approved by ${req.user.full_name}`,
      });
      return;
    }

    await transitionCR(req, res, crId, 'PENDING_APPROVAL', {
      activityType: 'CR_SENT_FOR_APPROVAL',
      activityDescription: `Sent for approval by ${req.user.full_name}. Awaiting ${approvals.length} approval(s).`,
    });

    // Notify approvers
    getCRForNotification(crId).then(n => {
      if (!n) return;
      for (const a of approvals) {
        crNotification.notifyApprovalRequest(n, a.approver_email, a.approver_name, a.approver_id, a.approver_role);
      }
    }).catch(err => logger.error('Send-to-approval notification error', err));
  } catch (error) {
    logger.error('Send to approval error', error);
    next(error);
  }
};

// ============================================
// COMMENTS
// ============================================

// POST /api/v1/cr/:id/comments
const addComment = async (req, res, next) => {
  try {
    const crId = parseInt(req.params.id, 10);
    if (isNaN(crId)) return res.status(400).json(createResponse(false, 'Invalid CR ID'));

    const { comment_text, is_internal } = req.body;

    // Verify CR exists
    const cr = await executeQuery(`SELECT cr_id FROM change_requests WHERE cr_id = @crId`, { crId });
    if (!cr.recordset.length) {
      return res.status(404).json(createResponse(false, 'Change request not found'));
    }

    const result = await executeQuery(`
      INSERT INTO cr_comments (cr_id, comment_text, is_internal, commented_by)
      OUTPUT INSERTED.comment_id
      VALUES (@crId, @commentText, @isInternal, @userId)
    `, {
      crId,
      commentText: comment_text,
      isInternal: is_internal ? 1 : 0,
      userId: req.user.user_id,
    });

    await crService.logActivity(crId, 'CR_COMMENT', req.user.user_id, {
      description: `Comment added by ${req.user.full_name}`,
    });

    return res.status(201).json(createResponse(true, 'Comment added', { comment_id: result.recordset[0].comment_id }));
  } catch (error) {
    logger.error('Add CR comment error', error);
    next(error);
  }
};

// ============================================
// ASSIGN
// ============================================

// PATCH /api/v1/cr/:id/assign
const assignCR = async (req, res, next) => {
  try {
    const crId = parseInt(req.params.id, 10);
    if (isNaN(crId)) return res.status(400).json(createResponse(false, 'Invalid CR ID'));

    const { assigned_to } = req.body;
    if (!assigned_to) {
      return res.status(400).json(createResponse(false, 'assigned_to is required'));
    }

    // Verify CR exists
    const cr = await executeQuery(
      `SELECT cr.cr_id, cr.assigned_to, cs.status_code FROM change_requests cr 
       LEFT JOIN cr_statuses cs ON cr.cr_status_id = cs.status_id WHERE cr.cr_id = @crId`,
      { crId }
    );
    if (!cr.recordset.length) {
      return res.status(404).json(createResponse(false, 'Change request not found'));
    }

    const currentCR = cr.recordset[0];
    if (['CLOSED', 'CANCELLED'].includes(currentCR.status_code)) {
      return res.status(400).json(createResponse(false, 'Cannot assign a closed or cancelled CR'));
    }

    // Validate assignee (same as ticket — only ENGINEER, MANAGER, ADMIN can be assigned)
    const isValid = await crAutoAssignment.validateAssignee(assigned_to);
    if (!isValid) {
      return res.status(400).json(createResponse(false, 'Selected user cannot be assigned CRs (must be an active Engineer, Manager, or Admin)'));
    }

    await executeQuery(
      `UPDATE change_requests SET assigned_to = @assignedTo, updated_at = GETDATE() WHERE cr_id = @crId`,
      { crId, assignedTo: assigned_to }
    );

    // Get assignee name
    const assignee = await executeQuery(`SELECT first_name + ' ' + last_name AS full_name FROM users WHERE user_id = @userId`, { userId: assigned_to });
    const assigneeName = assignee.recordset[0]?.full_name || 'Unknown';

    await crService.logActivity(crId, 'CR_ASSIGNED', req.user.user_id, {
      fieldName: 'assigned_to',
      oldValue: String(currentCR.assigned_to || ''),
      newValue: String(assigned_to),
      description: `Assigned to ${assigneeName}`,
    });

    // Log journey
    crService.logJourney(crId, 'ASSIGNED', req.user.user_id, {
      fromUserId: currentCR.assigned_to || null,
      toUserId: assigned_to,
      summary: `Assigned to ${assigneeName} by ${req.user.full_name}`,
    }).catch(() => {});

    return res.status(200).json(createResponse(true, `CR assigned to ${assigneeName}`));
  } catch (error) {
    logger.error('Assign CR error', error);
    next(error);
  }
};

// ============================================
// PENDING APPROVALS
// ============================================

// GET /api/v1/cr/pending-approvals
const getPendingApprovals = async (req, res, next) => {
  try {
    const approvals = await crApprovalService.getPendingForUser(req.user.user_id);
    return res.status(200).json(createResponse(true, 'Pending approvals fetched', approvals));
  } catch (error) {
    logger.error('Get pending approvals error', error);
    next(error);
  }
};

// GET /api/v1/cr/approval-stats
const getApprovalStats = async (req, res, next) => {
  try {
    const stats = await crApprovalService.getApprovalStats(req.user.user_id);
    return res.status(200).json(createResponse(true, 'Approval stats fetched', stats));
  } catch (error) {
    logger.error('Get approval stats error', error);
    next(error);
  }
};

// PATCH /api/v1/cr/:id/approvals/decide — Process an individual approval decision
const decideApproval = async (req, res, next) => {
  try {
    const crId = parseInt(req.params.id, 10);
    if (isNaN(crId)) return res.status(400).json(createResponse(false, 'Invalid CR ID'));

    const { decision, comments } = req.body;
    if (!decision || !['APPROVED', 'REJECTED'].includes(decision.toUpperCase())) {
      return res.status(400).json(createResponse(false, 'Decision must be APPROVED or REJECTED'));
    }

    const result = await crApprovalService.processApproval(crId, req.user.user_id, decision, comments);
    if (!result.success) {
      return res.status(400).json(createResponse(false, result.message));
    }

    // Log the approval activity
    await crService.logActivity(crId, `CR_APPROVAL_${decision.toUpperCase()}`, req.user.user_id, {
      description: `${decision.toUpperCase()} by ${req.user.full_name}${comments ? ': ' + comments : ''}`,
    });

    // If rejected, transition the CR to REJECTED
    if (result.rejected) {
      const newStatusId = await crService.getStatusId('REJECTED');
      await executeQuery(
        `UPDATE change_requests SET cr_status_id = @newStatusId, rejected_at = GETDATE(), reviewed_at = GETDATE(), updated_at = GETDATE() WHERE cr_id = @crId`,
        { crId, newStatusId }
      );
      await crService.logActivity(crId, 'CR_REJECTED', req.user.user_id, {
        oldValue: 'PENDING_APPROVAL',
        newValue: 'REJECTED',
        description: `Rejected by ${req.user.full_name}`,
      });
      // Log journey
      crService.logJourney(crId, 'REJECTED', req.user.user_id, {
        fromStatus: 'PENDING_APPROVAL', toStatus: 'REJECTED',
        summary: `Rejected by ${req.user.full_name}`,
      }).catch(() => {});
      return res.status(200).json(createResponse(true, 'Approval rejected. Change request has been rejected.'));
    }

    // If all approved, transition to APPROVED
    if (result.allApproved) {
      const newStatusId = await crService.getStatusId('APPROVED');

      // Check if this was a user-selected approver — if so, route to TCC team
      const crInfo = await executeQuery(
        `SELECT cr.requested_approver_id, cr.assigned_to FROM change_requests cr WHERE cr.cr_id = @crId`,
        { crId }
      );
      const crRow = crInfo.recordset[0];
      const crSettings = await crService.getCRSettings();
      
      const updateFields = {
        cr_status_id: newStatusId,
        approved_at: new Date(),
        reviewed_at: new Date(),
        review_sla_met: 1,
        updated_at: new Date(),
      };

      // If the approver was user-selected and post_approval_routing is tcc_team, unassign so TCC sees it
      if (crRow?.requested_approver_id && crSettings.post_approval_routing === 'tcc_team') {
        updateFields.assigned_to = null; // Goes back to TCC team queue
      }

      const setClauses = Object.keys(updateFields).map(k => `${k} = @${k}`).join(', ');
      const params = { crId, ...updateFields };
      // Fix param naming for SQL
      await executeQuery(
        `UPDATE change_requests SET cr_status_id = @newStatusId, approved_at = @approvedAt, reviewed_at = @reviewedAt, review_sla_met = 1, updated_at = GETDATE()${crRow?.requested_approver_id && crSettings.post_approval_routing === 'tcc_team' ? ', assigned_to = NULL' : ''} WHERE cr_id = @crId`,
        { crId, newStatusId, approvedAt: new Date(), reviewedAt: new Date() }
      );

      await crService.logActivity(crId, 'CR_APPROVED', req.user.user_id, {
        oldValue: 'PENDING_APPROVAL',
        newValue: 'APPROVED',
        description: 'All approvals received. Change request approved.',
      });
      // Log journey
      crService.logJourney(crId, 'APPROVED', req.user.user_id, {
        fromStatus: 'PENDING_APPROVAL', toStatus: 'APPROVED',
        summary: 'All approvals received. Change request approved.' + 
          (crRow?.requested_approver_id && crSettings.post_approval_routing === 'tcc_team' ? ' Routed to TCC team.' : ''),
      }).catch(() => {});
      return res.status(200).json(createResponse(true, 'All approvals received. Change request approved.'));
    }

    return res.status(200).json(createResponse(true, 'Approval decision recorded. Awaiting remaining approvals.'));
  } catch (error) {
    logger.error('Decide approval error', error);
    next(error);
  }
};

// ============================================
// CALENDAR & BLACKOUT ENDPOINTS
// ============================================

const getCalendar = async (req, res, next) => {
  try {
    const { start, end } = req.query;
    const startDate = start || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const endDate = end || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString();
    const data = await crService.getCalendarData(startDate, endDate);
    return res.status(200).json(createResponse(true, 'Calendar data fetched', data));
  } catch (error) {
    logger.error('Get calendar error', error);
    next(error);
  }
};

const getBlackouts = async (req, res, next) => {
  try {
    const blackouts = await crService.getBlackouts();
    return res.status(200).json(createResponse(true, 'Blackout periods fetched', blackouts));
  } catch (error) {
    logger.error('Get blackouts error', error);
    next(error);
  }
};

const createBlackout = async (req, res, next) => {
  try {
    const { title, description, start_date, end_date } = req.body;
    if (!title || !start_date || !end_date) {
      return res.status(400).json(createResponse(false, 'Title, start date, and end date are required'));
    }
    if (new Date(start_date) >= new Date(end_date)) {
      return res.status(400).json(createResponse(false, 'End date must be after start date'));
    }
    const result = await crService.createBlackout({ title, description, start_date, end_date }, req.user.user_id);
    return res.status(201).json(createResponse(true, 'Blackout period created', result));
  } catch (error) {
    logger.error('Create blackout error', error);
    next(error);
  }
};

const deleteBlackout = async (req, res, next) => {
  try {
    await crService.deleteBlackout(req.params.id);
    return res.status(200).json(createResponse(true, 'Blackout period deleted'));
  } catch (error) {
    logger.error('Delete blackout error', error);
    next(error);
  }
};

// PATCH /api/v1/cr/:id/raise-issue
// Allow raising a post-implementation issue within 24 hours of implementation
const raiseIssue = async (req, res, next) => {
  try {
    const crId = parseInt(req.params.id, 10);
    if (isNaN(crId)) return res.status(400).json(createResponse(false, 'Invalid CR ID'));

    const { issue_description } = req.body;
    if (!issue_description?.trim()) {
      return res.status(400).json(createResponse(false, 'Issue description is required'));
    }

    const current = await executeQuery(
      `SELECT cr.*, cs.status_code FROM change_requests cr
       LEFT JOIN cr_statuses cs ON cr.cr_status_id = cs.status_id
       WHERE cr.cr_id = @crId`,
      { crId }
    );
    if (!current.recordset.length) return res.status(404).json(createResponse(false, 'Change request not found'));

    const cr = current.recordset[0];

    if (cr.status_code !== 'IMPLEMENTED') {
      return res.status(400).json(createResponse(false, 'Only IMPLEMENTED change requests can have a post-implementation issue raised'));
    }

    // Check 24-hour window from completed_at (or actual_end)
    const completedAt = cr.completed_at || cr.actual_end;
    if (!completedAt) {
      return res.status(400).json(createResponse(false, 'Implementation completion time not recorded'));
    }
    const hoursSinceCompletion = (Date.now() - new Date(completedAt).getTime()) / (1000 * 60 * 60);
    if (hoursSinceCompletion > 24) {
      return res.status(400).json(createResponse(false, 'Post-implementation issues can only be raised within 24 hours of implementation'));
    }

    // Transition back to IN_PROGRESS
    await transitionCR(req, res, crId, 'IN_PROGRESS', {
      extraUpdates: { actual_end: null },
      activityType: 'CR_ISSUE_RAISED',
      activityDescription: `Post-implementation issue raised by ${req.user.full_name}: ${issue_description.trim()}`,
      validate: async (cr) => {
        const isAssignee = cr.assigned_to === req.user.user_id;
        const isRequester = cr.requester_id === req.user.user_id;
        const isAdmin = req.user.role?.role_code === 'ADMIN';
        const canImpl = req.user.permissions?.can_implement_cr;
        if (!isAssignee && !isRequester && !isAdmin && !canImpl) {
          return 'Only the assignee, requester, implementers, or admins can raise a post-implementation issue';
        }
        return null;
      },
    });

    // Notify assignee and requester of the issue
    getCRForNotification(crId).then(n => {
      if (n) crNotification.notifyCRImplementationStarted(n, n.requester_email, n.requester_name, n.requester_id, req.user.full_name);
    }).catch(err => logger.error('Raise issue notification error', err));
  } catch (error) {
    logger.error('Raise issue error', error);
    next(error);
  }
};

// PATCH /api/v1/cr/:id/not-belongs-to-me
// Approver declines ownership — CR is returned to SUBMITTED so requester picks correct approver
const notBelongsToMe = async (req, res, next) => {
  try {
    const crId = parseInt(req.params.id, 10);
    if (isNaN(crId)) return res.status(400).json(createResponse(false, 'Invalid CR ID'));

    const { message } = req.body;

    const current = await executeQuery(
      `SELECT cr.*, cs.status_code FROM change_requests cr
       LEFT JOIN cr_statuses cs ON cr.cr_status_id = cs.status_id
       WHERE cr.cr_id = @crId`,
      { crId }
    );
    if (!current.recordset.length) return res.status(404).json(createResponse(false, 'CR not found'));
    const cr = current.recordset[0];

    if (cr.status_code !== 'PENDING_APPROVAL') {
      return res.status(400).json(createResponse(false, 'This action is only available for CRs in PENDING_APPROVAL status'));
    }

    if (!req.user.permissions?.can_approve_cr && req.user.role?.role_code !== 'ADMIN') {
      return res.status(403).json(createResponse(false, 'You do not have permission to perform this action'));
    }

    const note = message?.trim() || `${req.user.full_name} indicated this CR does not belong to their approval queue. Please select the correct approver and resubmit.`;

    // Return CR to SUBMITTED and clear the assigned approver
    await transitionCR(req, res, crId, 'SUBMITTED', {
      extraUpdates: {
        assigned_to: null,
        requested_approver_id: null,
      },
      activityType: 'CR_NOT_BELONGS',
      activityDescription: note,
    });

    // Add visible comment to CR for requester
    await executeQuery(`
      INSERT INTO cr_comments (cr_id, comment_text, is_internal, commented_by)
      VALUES (@crId, @commentText, 0, @userId)
    `, { crId, commentText: note, userId: req.user.user_id });

    // Notify requester
    const crInfo = await getCRForNotification(crId);
    if (crInfo) {
      await executeQuery(`
        INSERT INTO notifications (user_id, notification_type, title, message, related_ticket_id)
        VALUES (@userId, 'CR_NOT_BELONGS', 'Action Required: Choose correct approver', @msg, NULL)
      `, {
        userId: cr.requester_id,
        msg: `CR #${crInfo.cr_number} - "${crInfo.title}" was returned: ${note}`,
      });
    }
  } catch (error) {
    logger.error('Not belongs to me error', error);
    next(error);
  }
};

module.exports = {
  raiseIssue,
  notBelongsToMe,
  getMyCRApprovals,
  getLookups,
  getApprovers,
  getCRSettings,
  getCRStats,
  getCRs,
  getCRById,
  createCR,
  updateCR,
  deleteCR,
  submitCR,
  startReview,
  requestInfo,
  provideInfo,
  approveCR,
  rejectCR,
  scheduleCR,
  startImplementation,
  completeCR,
  rollbackCR,
  cancelCR,
  resubmitCR,
  closeCR,
  rescheduleCR,
  sendToApproval,
  addComment,
  assignCR,
  getPendingApprovals,
  getApprovalStats,
  decideApproval,
  getCalendar,
  getBlackouts,
  createBlackout,
  deleteBlackout,
};

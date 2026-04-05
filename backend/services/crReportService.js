/**
 * ============================================
 * Change Request Report Service
 * Query builders for the ReportsHub integration.
 * Follows the existing reports.service.js / outageReportService.js pattern.
 * ============================================
 */

function normalizeIds(arr) {
  if (!Array.isArray(arr)) return [];
  return [...new Set(arr.map((x) => parseInt(x, 10)).filter((n) => !Number.isNaN(n) && n > 0))];
}

function addInClause(column, ids, paramPrefix, baseParams) {
  if (!ids.length) return { clause: '', params: {} };
  const keys = [];
  const extra = {};
  ids.forEach((id, i) => {
    const k = `${paramPrefix}${i}`;
    keys.push(`@${k}`);
    extra[k] = id;
  });
  return { clause: ` AND ${column} IN (${keys.join(',')})`, params: { ...baseParams, ...extra } };
}

function computePaging(page, pageSize) {
  const ps = Math.min(500, Math.max(1, parseInt(pageSize, 10) || 200));
  const pg = Math.max(1, parseInt(page, 10) || 1);
  const off = (pg - 1) * ps;
  const rowEnd = off + ps;
  return { off, ps, rowEnd };
}

function buildCRDimensionFilters(mergeParams, { departmentIds = [], locationIds = [], priorityIds = [] } = {}) {
  let extraClause = '';
  let p = { ...mergeParams };
  const dIn = addInClause('cr.department_id', normalizeIds(departmentIds), 'crdep', p);
  extraClause += dIn.clause;
  p = { ...p, ...dIn.params };
  const prIn = addInClause('cr.priority_id', normalizeIds(priorityIds), 'crpr', p);
  extraClause += prIn.clause;
  p = { ...p, ...prIn.params };
  return { extraClause, params: p };
}

/**
 * CR Master Report — full listing of change requests
 */
function buildCRMasterQuery({ startDate, endDate, statusScope = 'all', departmentIds = [], priorityIds = [], page = 1, pageSize = 200 }) {
  const { off, rowEnd } = computePaging(page, pageSize);
  const baseParams = { startDate, endDate, off, rowEnd };

  let statusFilter = '';
  if (statusScope === 'open') statusFilter = " AND cs.is_final_status = 0";
  else if (statusScope === 'closed') statusFilter = " AND cs.is_final_status = 1";

  const { extraClause, params } = buildCRDimensionFilters(baseParams, { departmentIds, priorityIds });

  const baseWhere = `
    WHERE cr.created_at >= @startDate AND cr.created_at < DATEADD(DAY, 1, CAST(@endDate AS DATE))
    ${statusFilter}${extraClause}
  `;

  const query = `
    ;WITH cte AS (
      SELECT cr.cr_id, cr.cr_number, cr.title,
             cs.status_name, ct.type_name, cc.category_name,
             cr.risk_level, cr.priority_id,
             p.priority_name,
             cr.estimated_downtime_mins, cr.users_affected_count,
             d.department_name,
             ur.first_name + ' ' + ur.last_name AS requester_name,
             ua.first_name + ' ' + ua.last_name AS assigned_to_name,
             cr.proposed_start, cr.proposed_end,
             cr.scheduled_start, cr.scheduled_end,
             cr.actual_start, cr.actual_end,
             cr.review_sla_met,
             cr.created_at, cr.updated_at,
             ROW_NUMBER() OVER (ORDER BY cr.created_at DESC) AS rn
      FROM change_requests cr
      INNER JOIN cr_statuses cs ON cr.cr_status_id = cs.status_id
      INNER JOIN cr_types ct ON cr.cr_type_id = ct.type_id
      LEFT JOIN cr_categories cc ON cr.cr_category_id = cc.category_id
      LEFT JOIN ticket_priorities p ON cr.priority_id = p.priority_id
      LEFT JOIN departments d ON cr.department_id = d.department_id
      LEFT JOIN users ur ON cr.requester_id = ur.user_id
      LEFT JOIN users ua ON cr.assigned_to = ua.user_id
      ${baseWhere}
    )
    SELECT * FROM cte WHERE rn > @off AND rn <= @rowEnd ORDER BY rn
  `;

  const countQuery = `
    SELECT COUNT(*) AS total
    FROM change_requests cr
    INNER JOIN cr_statuses cs ON cr.cr_status_id = cs.status_id
    ${baseWhere}
  `;

  return { query, countQuery, params };
}

/**
 * CR Journey Report — activity trail for change requests
 */
function buildCRJourneyQuery({ startDate, endDate, departmentIds = [], priorityIds = [], page = 1, pageSize = 200 }) {
  const { off, rowEnd } = computePaging(page, pageSize);
  const baseParams = { startDate, endDate, off, rowEnd };
  const { extraClause, params } = buildCRDimensionFilters(baseParams, { departmentIds, priorityIds });

  const baseWhere = `
    WHERE a.performed_at >= @startDate AND a.performed_at < DATEADD(DAY, 1, CAST(@endDate AS DATE))
    ${extraClause}
  `;

  const query = `
    ;WITH cte AS (
      SELECT a.activity_id, cr.cr_number, cr.title AS cr_title,
             a.activity_type, a.field_name, a.old_value, a.new_value,
             a.description AS activity_description,
             u.first_name + ' ' + u.last_name AS performed_by_name,
             a.performed_at,
             ROW_NUMBER() OVER (ORDER BY a.performed_at DESC) AS rn
      FROM cr_activities a
      INNER JOIN change_requests cr ON a.cr_id = cr.cr_id
      LEFT JOIN users u ON a.performed_by = u.user_id
      ${baseWhere}
    )
    SELECT * FROM cte WHERE rn > @off AND rn <= @rowEnd ORDER BY rn
  `;

  const countQuery = `
    SELECT COUNT(*) AS total
    FROM cr_activities a
    INNER JOIN change_requests cr ON a.cr_id = cr.cr_id
    ${baseWhere}
  `;

  return { query, countQuery, params };
}

/**
 * CR Summary by Type — aggregate counts grouped by change type
 */
function buildCRSummaryByType({ startDate, endDate, departmentIds = [], priorityIds = [] }) {
  const baseParams = { startDate, endDate };
  const { extraClause, params } = buildCRDimensionFilters(baseParams, { departmentIds, priorityIds });

  const query = `
    SELECT ct.type_name,
           COUNT(*) AS cr_count,
           SUM(CASE WHEN cs.is_final_status = 1 THEN 1 ELSE 0 END) AS completed_count,
           SUM(CASE WHEN cs.is_final_status = 0 THEN 1 ELSE 0 END) AS open_count,
           AVG(cr.estimated_downtime_mins) AS avg_downtime_mins,
           AVG(cr.users_affected_count) AS avg_users_affected
    FROM change_requests cr
    INNER JOIN cr_types ct ON cr.cr_type_id = ct.type_id
    INNER JOIN cr_statuses cs ON cr.cr_status_id = cs.status_id
    WHERE cr.created_at >= @startDate AND cr.created_at < DATEADD(DAY, 1, CAST(@endDate AS DATE))
    ${extraClause}
    GROUP BY ct.type_name
    ORDER BY cr_count DESC
  `;

  return { query, params };
}

/**
 * CR Summary by Category — aggregate counts grouped by CR category
 */
function buildCRSummaryByCategory({ startDate, endDate, departmentIds = [], priorityIds = [] }) {
  const baseParams = { startDate, endDate };
  const { extraClause, params } = buildCRDimensionFilters(baseParams, { departmentIds, priorityIds });

  const query = `
    SELECT ISNULL(cc.category_name, 'Uncategorized') AS category_name,
           COUNT(*) AS cr_count,
           SUM(CASE WHEN cs.is_final_status = 1 THEN 1 ELSE 0 END) AS completed_count,
           SUM(CASE WHEN cs.is_final_status = 0 THEN 1 ELSE 0 END) AS open_count,
           SUM(CASE WHEN cr.risk_level = 'HIGH' THEN 1 ELSE 0 END) AS high_risk_count,
           AVG(cr.estimated_downtime_mins) AS avg_downtime_mins
    FROM change_requests cr
    INNER JOIN cr_statuses cs ON cr.cr_status_id = cs.status_id
    LEFT JOIN cr_categories cc ON cr.cr_category_id = cc.category_id
    WHERE cr.created_at >= @startDate AND cr.created_at < DATEADD(DAY, 1, CAST(@endDate AS DATE))
    ${extraClause}
    GROUP BY cc.category_name
    ORDER BY cr_count DESC
  `;

  return { query, params };
}

/**
 * CR Approval Report — approval chain status for each CR
 */
function buildCRApprovalQuery({ startDate, endDate, departmentIds = [], priorityIds = [], page = 1, pageSize = 200 }) {
  const { off, rowEnd } = computePaging(page, pageSize);
  const baseParams = { startDate, endDate, off, rowEnd };
  const { extraClause, params } = buildCRDimensionFilters(baseParams, { departmentIds, priorityIds });

  const baseWhere = `
    WHERE cr.created_at >= @startDate AND cr.created_at < DATEADD(DAY, 1, CAST(@endDate AS DATE))
    ${extraClause}
  `;

  const query = `
    ;WITH cte AS (
      SELECT cr.cr_number, cr.title AS cr_title,
             ct.type_name, cs.status_name,
             ca.approver_role, ca.approval_order, ca.status AS approval_status,
             u.first_name + ' ' + u.last_name AS approver_name,
             ca.comments AS approval_comments,
             ca.requested_at, ca.decided_at,
             CASE WHEN ca.decided_at IS NOT NULL AND ca.requested_at IS NOT NULL
                  THEN DATEDIFF(HOUR, ca.requested_at, ca.decided_at) END AS decision_hours,
             ca.reminder_count,
             ROW_NUMBER() OVER (ORDER BY cr.created_at DESC, ca.approval_order) AS rn
      FROM cr_approvals ca
      INNER JOIN change_requests cr ON ca.cr_id = cr.cr_id
      INNER JOIN cr_types ct ON cr.cr_type_id = ct.type_id
      INNER JOIN cr_statuses cs ON cr.cr_status_id = cs.status_id
      LEFT JOIN users u ON ca.approver_id = u.user_id
      ${baseWhere}
    )
    SELECT * FROM cte WHERE rn > @off AND rn <= @rowEnd ORDER BY rn
  `;

  const countQuery = `
    SELECT COUNT(*) AS total
    FROM cr_approvals ca
    INNER JOIN change_requests cr ON ca.cr_id = cr.cr_id
    ${baseWhere}
  `;

  return { query, countQuery, params };
}

/**
 * CR Risk Report — change requests grouped by risk level with details
 */
function buildCRRiskQuery({ startDate, endDate, departmentIds = [], priorityIds = [], page = 1, pageSize = 200 }) {
  const { off, rowEnd } = computePaging(page, pageSize);
  const baseParams = { startDate, endDate, off, rowEnd };
  const { extraClause, params } = buildCRDimensionFilters(baseParams, { departmentIds, priorityIds });

  const baseWhere = `
    WHERE cr.created_at >= @startDate AND cr.created_at < DATEADD(DAY, 1, CAST(@endDate AS DATE))
    ${extraClause}
  `;

  const query = `
    ;WITH cte AS (
      SELECT cr.cr_number, cr.title,
             cr.risk_level, cr.risk_assessment_notes,
             ct.type_name, cs.status_name, cc.category_name,
             cr.estimated_downtime_mins, cr.users_affected_count,
             d.department_name,
             ur.first_name + ' ' + ur.last_name AS requester_name,
             (SELECT COUNT(*) FROM cr_affected_systems s WHERE s.cr_id = cr.cr_id) AS affected_systems_count,
             (SELECT COUNT(*) FROM cr_approvals a2 WHERE a2.cr_id = cr.cr_id AND a2.status = 'APPROVED') AS approvals_granted,
             (SELECT COUNT(*) FROM cr_approvals a3 WHERE a3.cr_id = cr.cr_id) AS approvals_total,
             cr.proposed_start, cr.proposed_end,
             cr.review_sla_met,
             cr.created_at,
             ROW_NUMBER() OVER (ORDER BY
               CASE cr.risk_level WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 WHEN 'LOW' THEN 4 ELSE 5 END,
               cr.created_at DESC
             ) AS rn
      FROM change_requests cr
      INNER JOIN cr_statuses cs ON cr.cr_status_id = cs.status_id
      INNER JOIN cr_types ct ON cr.cr_type_id = ct.type_id
      LEFT JOIN cr_categories cc ON cr.cr_category_id = cc.category_id
      LEFT JOIN departments d ON cr.department_id = d.department_id
      LEFT JOIN users ur ON cr.requester_id = ur.user_id
      ${baseWhere}
    )
    SELECT * FROM cte WHERE rn > @off AND rn <= @rowEnd ORDER BY rn
  `;

  const countQuery = `
    SELECT COUNT(*) AS total
    FROM change_requests cr
    INNER JOIN cr_statuses cs ON cr.cr_status_id = cs.status_id
    ${baseWhere}
  `;

  return { query, countQuery, params };
}

module.exports = {
  buildCRMasterQuery,
  buildCRJourneyQuery,
  buildCRSummaryByType,
  buildCRSummaryByCategory,
  buildCRApprovalQuery,
  buildCRRiskQuery,
};

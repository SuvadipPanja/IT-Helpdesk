/**
 * ============================================
 * Outage Report Service
 * Query builders for the ReportsHub integration.
 * Follows the existing reports.service.js pattern.
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

/**
 * Outage Master Report — all outage notifications with key fields
 */
function buildOutageMasterQuery({ startDate, endDate, statusScope = 'all', page = 1, pageSize = 200 }) {
  const { off, ps, rowEnd } = computePaging(page, pageSize);
  let statusFilter = '';
  if (statusScope === 'active') statusFilter = " AND n.status = 'active'";
  else if (statusScope === 'resolved') statusFilter = " AND n.status = 'resolved'";
  else if (statusScope === 'draft') statusFilter = " AND n.status = 'draft'";

  const params = { startDate, endDate, off, rowEnd };

  const baseWhere = `
    WHERE n.created_at >= @startDate AND n.created_at < DATEADD(DAY, 1, CAST(@endDate AS DATE))
    ${statusFilter}
  `;

  const query = `
    ;WITH cte AS (
      SELECT n.notification_id, n.title, n.status, n.severity,
             n.audience_type, n.published_at, n.resolved_at, n.cancelled_at, n.created_at,
             t.template_name,
             uc.first_name + ' ' + uc.last_name AS created_by_name,
             up.first_name + ' ' + up.last_name AS published_by_name,
             ur.first_name + ' ' + ur.last_name AS resolved_by_name,
             (SELECT COUNT(*) FROM outage_notification_views v WHERE v.notification_id = n.notification_id) AS view_count,
             CASE WHEN n.resolved_at IS NOT NULL AND n.published_at IS NOT NULL
                  THEN DATEDIFF(MINUTE, n.published_at, n.resolved_at) END AS resolution_minutes,
             ROW_NUMBER() OVER (ORDER BY n.created_at DESC) AS rn
      FROM outage_notifications n
      INNER JOIN outage_templates t ON n.template_id = t.template_id
      LEFT JOIN users uc ON n.created_by = uc.user_id
      LEFT JOIN users up ON n.published_by = up.user_id
      LEFT JOIN users ur ON n.resolved_by = ur.user_id
      ${baseWhere}
    )
    SELECT * FROM cte WHERE rn > @off AND rn <= @rowEnd ORDER BY rn
  `;

  const countQuery = `
    SELECT COUNT(*) AS total FROM outage_notifications n ${baseWhere}
  `;

  return { query, countQuery, params };
}

/**
 * Outage Audit Trail — log of all outage actions
 */
function buildOutageAuditQuery({ startDate, endDate, page = 1, pageSize = 200 }) {
  const { off, ps, rowEnd } = computePaging(page, pageSize);
  const params = { startDate, endDate, off, rowEnd };

  const baseWhere = `
    WHERE al.created_at >= @startDate AND al.created_at < DATEADD(DAY, 1, CAST(@endDate AS DATE))
  `;

  const query = `
    ;WITH cte AS (
      SELECT al.log_id, al.action,
             al.notification_id, n.title AS notification_title,
             al.template_id, t.template_name,
             u.first_name + ' ' + u.last_name AS actor_name,
             al.ip_address, al.details, al.created_at,
             ROW_NUMBER() OVER (ORDER BY al.created_at DESC) AS rn
      FROM outage_audit_log al
      LEFT JOIN outage_notifications n ON al.notification_id = n.notification_id
      LEFT JOIN outage_templates t ON al.template_id = t.template_id
      LEFT JOIN users u ON al.actor_id = u.user_id
      ${baseWhere}
    )
    SELECT * FROM cte WHERE rn > @off AND rn <= @rowEnd ORDER BY rn
  `;

  const countQuery = `
    SELECT COUNT(*) AS total FROM outage_audit_log al ${baseWhere}
  `;

  return { query, countQuery, params };
}

/**
 * Outage Overview summary — counts by status, severity, template
 */
function buildOutageOverviewQuery({ startDate, endDate }) {
  const params = { startDate, endDate };

  const baseWhere = `
    WHERE n.created_at >= @startDate AND n.created_at < DATEADD(DAY, 1, CAST(@endDate AS DATE))
  `;

  const query = `
    SELECT
      t.template_name,
      n.status,
      n.severity,
      COUNT(*) AS notification_count,
      SUM(CASE WHEN n.resolved_at IS NOT NULL AND n.published_at IS NOT NULL
               THEN DATEDIFF(MINUTE, n.published_at, n.resolved_at) END) / NULLIF(
        SUM(CASE WHEN n.resolved_at IS NOT NULL AND n.published_at IS NOT NULL THEN 1 END), 0
      ) AS avg_resolution_minutes,
      SUM((SELECT COUNT(*) FROM outage_notification_views v WHERE v.notification_id = n.notification_id)) AS total_views
    FROM outage_notifications n
    INNER JOIN outage_templates t ON n.template_id = t.template_id
    ${baseWhere}
    GROUP BY t.template_name, n.status, n.severity
    ORDER BY t.template_name, n.status
  `;

  return { query, params };
}

module.exports = {
  buildOutageMasterQuery,
  buildOutageAuditQuery,
  buildOutageOverviewQuery,
};

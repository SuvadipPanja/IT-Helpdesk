// ============================================
// CR Analytics Controller
// Change Request analytics metrics and charts
// ============================================

const { executeQuery } = require('../config/database');
const { createResponse } = require('../utils/helpers');
const logger = require('../utils/logger');

/**
 * Get comprehensive CR analytics dashboard
 * @route GET /api/v1/analytics/cr-dashboard
 * @access Private (Admin/Manager — via analytics auth middleware)
 */
const getCRDashboard = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;

    logger.info('Fetching CR analytics dashboard', {
      userId: req.user.user_id,
      startDate: start_date,
      endDate: end_date,
    });

    const hasDateRange = start_date && end_date;
    const params = {
      startDate: hasDateRange ? start_date : null,
      endDate: hasDateRange ? end_date : null,
    };

    const dateFilter = `(@startDate IS NULL OR cr.created_at >= @startDate)
      AND (@endDate IS NULL OR cr.created_at < DATEADD(DAY, 1, @endDate))`;

    const query = `
      -- 1) KPI metrics (single row)
      SELECT
        (SELECT COUNT(*) FROM change_requests cr WHERE ${dateFilter}) AS total_crs,

        (SELECT COUNT(*) FROM change_requests cr
         INNER JOIN cr_statuses cs ON cr.cr_status_id = cs.status_id
         WHERE cs.status_code = 'COMPLETED' AND ${dateFilter}) AS completed_crs,

        (SELECT COUNT(*) FROM change_requests cr
         INNER JOIN cr_statuses cs ON cr.cr_status_id = cs.status_id
         WHERE cs.status_code = 'ROLLED_BACK' AND ${dateFilter}) AS rolled_back_crs,

        (SELECT COUNT(*) FROM change_requests cr
         INNER JOIN cr_statuses cs ON cr.cr_status_id = cs.status_id
         WHERE cs.status_code IN ('APPROVED','SCHEDULED','IN_PROGRESS','COMPLETED','ROLLED_BACK')
           AND ${dateFilter}) AS approved_crs,

        (SELECT COUNT(*) FROM change_requests cr
         INNER JOIN cr_statuses cs ON cr.cr_status_id = cs.status_id
         WHERE cs.status_code = 'REJECTED' AND ${dateFilter}) AS rejected_crs,

        (SELECT COUNT(*) FROM change_requests cr
         INNER JOIN cr_statuses cs ON cr.cr_status_id = cs.status_id
         WHERE cs.status_code NOT IN ('DRAFT','COMPLETED','ROLLED_BACK','CANCELLED')
           AND ${dateFilter}) AS active_crs,

        (SELECT COUNT(*) FROM change_requests cr
         INNER JOIN cr_statuses cs ON cr.cr_status_id = cs.status_id
         WHERE cs.status_code = 'CANCELLED' AND ${dateFilter}) AS cancelled_crs,

        (SELECT COUNT(*) FROM change_requests cr
         WHERE cr.risk_level = 'CRITICAL' AND ${dateFilter}) AS critical_risk_crs,

        (SELECT AVG(DATEDIFF(HOUR, cr.created_at, cr.approved_at))
         FROM change_requests cr
         WHERE cr.approved_at IS NOT NULL AND ${dateFilter}) AS avg_approval_hours,

        (SELECT AVG(DATEDIFF(HOUR, cr.scheduled_start, cr.completed_at))
         FROM change_requests cr
         WHERE cr.completed_at IS NOT NULL AND cr.scheduled_start IS NOT NULL
           AND ${dateFilter}) AS avg_implementation_hours,

        (SELECT COUNT(*) FROM cr_approvals ca
         INNER JOIN change_requests cr ON ca.cr_id = cr.cr_id
         WHERE ca.status = 'PENDING' AND ${dateFilter}) AS pending_approvals,

        (SELECT COUNT(DISTINCT cr.assigned_to) FROM change_requests cr
         INNER JOIN cr_statuses cs ON cr.cr_status_id = cs.status_id
         WHERE cs.status_code NOT IN ('DRAFT','COMPLETED','ROLLED_BACK','CANCELLED')
           AND cr.assigned_to IS NOT NULL AND ${dateFilter}) AS active_implementers;

      -- 2) Status distribution
      SELECT
        cs.status_code, cs.status_name, cs.color_code,
        COUNT(cr.cr_id) AS count
      FROM cr_statuses cs
      LEFT JOIN change_requests cr ON cs.status_id = cr.cr_status_id
        AND ${dateFilter}
      WHERE cs.is_active = 1
      GROUP BY cs.status_code, cs.status_name, cs.color_code, cs.display_order
      ORDER BY cs.display_order;

      -- 3) Type distribution
      SELECT ct.type_code, ct.type_name, COUNT(cr.cr_id) AS count
      FROM cr_types ct
      LEFT JOIN change_requests cr ON ct.type_id = cr.cr_type_id
        AND ${dateFilter}
      GROUP BY ct.type_code, ct.type_name;

      -- 4) Risk distribution
      SELECT cr.risk_level, COUNT(*) AS count
      FROM change_requests cr
      WHERE cr.risk_level IS NOT NULL AND ${dateFilter}
      GROUP BY cr.risk_level;

      -- 5) Category distribution
      SELECT cc.category_name, COUNT(cr.cr_id) AS count
      FROM cr_categories cc
      LEFT JOIN change_requests cr ON cc.category_id = cr.cr_category_id
        AND ${dateFilter}
      WHERE cc.is_active = 1
      GROUP BY cc.category_name
      HAVING COUNT(cr.cr_id) > 0
      ORDER BY count DESC;

      -- 6) Trend (daily volume)
      SELECT
        CAST(cr.created_at AS DATE) AS date_key,
        COUNT(*) AS created_count,
        SUM(CASE WHEN cs.status_code = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_count,
        SUM(CASE WHEN cs.status_code = 'ROLLED_BACK' THEN 1 ELSE 0 END) AS rollback_count
      FROM change_requests cr
      INNER JOIN cr_statuses cs ON cr.cr_status_id = cs.status_id
      WHERE ${dateFilter}
      GROUP BY CAST(cr.created_at AS DATE)
      ORDER BY date_key;

      -- 7) Monthly summary (last 12 months)
      SELECT
        FORMAT(cr.created_at, 'yyyy-MM') AS month_key,
        FORMAT(cr.created_at, 'MMM yyyy') AS month_label,
        COUNT(*) AS total,
        SUM(CASE WHEN cs.status_code = 'COMPLETED' THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN cs.status_code = 'ROLLED_BACK' THEN 1 ELSE 0 END) AS rolled_back
      FROM change_requests cr
      INNER JOIN cr_statuses cs ON cr.cr_status_id = cs.status_id
      WHERE cr.created_at >= DATEADD(MONTH, -12, GETDATE())
      GROUP BY FORMAT(cr.created_at, 'yyyy-MM'), FORMAT(cr.created_at, 'MMM yyyy')
      ORDER BY month_key;

      -- 8) Top implementers
      SELECT TOP 10
        u.first_name + ' ' + u.last_name AS implementer_name,
        COUNT(cr.cr_id) AS total_assigned,
        SUM(CASE WHEN cs.status_code = 'COMPLETED' THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN cs.status_code = 'ROLLED_BACK' THEN 1 ELSE 0 END) AS rolled_back,
        AVG(CASE WHEN cr.completed_at IS NOT NULL AND cr.scheduled_start IS NOT NULL
            THEN DATEDIFF(HOUR, cr.scheduled_start, cr.completed_at) ELSE NULL END) AS avg_impl_hours
      FROM users u
      INNER JOIN change_requests cr ON u.user_id = cr.assigned_to
      INNER JOIN cr_statuses cs ON cr.cr_status_id = cs.status_id
      WHERE ${dateFilter}
      GROUP BY u.first_name, u.last_name
      HAVING COUNT(cr.cr_id) > 0
      ORDER BY total_assigned DESC;

      -- 9) Approval performance (avg time per approver)
      SELECT TOP 10
        u.first_name + ' ' + u.last_name AS approver_name,
        COUNT(*) AS total_reviews,
        SUM(CASE WHEN ca.status = 'APPROVED' THEN 1 ELSE 0 END) AS approved,
        SUM(CASE WHEN ca.status = 'REJECTED' THEN 1 ELSE 0 END) AS rejected,
        AVG(CASE WHEN ca.decided_at IS NOT NULL
            THEN DATEDIFF(HOUR, ca.requested_at, ca.decided_at) ELSE NULL END) AS avg_review_hours
      FROM cr_approvals ca
      INNER JOIN users u ON ca.approver_id = u.user_id
      INNER JOIN change_requests cr ON ca.cr_id = cr.cr_id
      WHERE ca.status IN ('APPROVED','REJECTED') AND ${dateFilter}
      GROUP BY u.first_name, u.last_name
      ORDER BY total_reviews DESC;
    `;

    const result = await executeQuery(query, params);
    const rs = result.recordsets || [];

    const kpis = rs[0]?.[0] || {};
    const statusRows = rs[1] || [];
    const typeRows = rs[2] || [];
    const riskRows = rs[3] || [];
    const categoryRows = rs[4] || [];
    const trendRows = rs[5] || [];
    const monthlyRows = rs[6] || [];
    const implementerRows = rs[7] || [];
    const approverRows = rs[8] || [];

    // Compute derived KPIs
    const totalFinished = (kpis.completed_crs || 0) + (kpis.rolled_back_crs || 0);
    const successRate = totalFinished > 0
      ? parseFloat(((kpis.completed_crs / totalFinished) * 100).toFixed(1))
      : 0;

    const totalDecisions = (kpis.approved_crs || 0) + (kpis.rejected_crs || 0);
    const approvalRate = totalDecisions > 0
      ? parseFloat(((kpis.approved_crs / totalDecisions) * 100).toFixed(1))
      : 0;

    const rollbackRate = totalFinished > 0
      ? parseFloat(((kpis.rolled_back_crs / totalFinished) * 100).toFixed(1))
      : 0;

    const data = {
      kpis: {
        total_crs: kpis.total_crs || 0,
        completed_crs: kpis.completed_crs || 0,
        rolled_back_crs: kpis.rolled_back_crs || 0,
        approved_crs: kpis.approved_crs || 0,
        rejected_crs: kpis.rejected_crs || 0,
        active_crs: kpis.active_crs || 0,
        cancelled_crs: kpis.cancelled_crs || 0,
        critical_risk_crs: kpis.critical_risk_crs || 0,
        pending_approvals: kpis.pending_approvals || 0,
        active_implementers: kpis.active_implementers || 0,
        avg_approval_hours: kpis.avg_approval_hours != null ? Math.round(kpis.avg_approval_hours) : null,
        avg_implementation_hours: kpis.avg_implementation_hours != null ? Math.round(kpis.avg_implementation_hours) : null,
        success_rate: successRate,
        approval_rate: approvalRate,
        rollback_rate: rollbackRate,
      },
      by_status: statusRows.map(r => ({
        label: r.status_name, value: r.count, code: r.status_code, color: r.color_code,
      })),
      by_type: typeRows.map(r => ({
        label: r.type_name, value: r.count, code: r.type_code,
      })),
      by_risk: riskRows.map(r => ({
        label: r.risk_level, value: r.count,
      })),
      by_category: categoryRows.map(r => ({
        label: r.category_name, value: r.count,
      })),
      trend: trendRows.map(r => ({
        date: new Date(r.date_key).toISOString().slice(0, 10),
        created: r.created_count || 0,
        completed: r.completed_count || 0,
        rolled_back: r.rollback_count || 0,
      })),
      monthly: monthlyRows.map(r => ({
        month: r.month_label,
        total: r.total || 0,
        completed: r.completed || 0,
        rolled_back: r.rolled_back || 0,
      })),
      top_implementers: implementerRows.map(r => ({
        name: r.implementer_name,
        total: r.total_assigned || 0,
        completed: r.completed || 0,
        rolled_back: r.rolled_back || 0,
        avg_impl_hours: r.avg_impl_hours != null ? Math.round(r.avg_impl_hours) : null,
      })),
      approval_performance: approverRows.map(r => ({
        name: r.approver_name,
        total_reviews: r.total_reviews || 0,
        approved: r.approved || 0,
        rejected: r.rejected || 0,
        avg_review_hours: r.avg_review_hours != null ? Math.round(r.avg_review_hours) : null,
      })),
    };

    logger.success('CR analytics dashboard fetched');

    return res.status(200).json(
      createResponse(true, 'CR analytics fetched successfully', data)
    );
  } catch (error) {
    logger.error('CR analytics dashboard error', error);
    next(error);
  }
};

module.exports = {
  getCRDashboard,
};

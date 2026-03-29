// ============================================================
// METRICS ROUTE — /api/v1/metrics
// Exposes lightweight operational telemetry for monitoring.
// Stats are computed real-time from the database.
// ============================================================

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { authorizeRoles } = require('../middleware/auth');
const { executeQuery } = require('../config/database');
const logger = require('../utils/logger');

const ADMIN_ROLES = ['ADMIN', 'MANAGER'];

/**
 * GET /api/v1/metrics/health
 * Public lightweight health check (used by load balancers, uptime monitors).
 */
router.get('/health', async (req, res) => {
  const start = Date.now();
  try {
    // Pings the DB with a trivial query to verify connectivity
    await executeQuery('SELECT 1 AS ping', {});
    const latencyMs = Date.now() - start;
    return res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime_seconds: Math.floor(process.uptime()),
      db_latency_ms: latencyMs,
      version: process.env.npm_package_version || '1.0.0',
      node_env: process.env.NODE_ENV || 'development',
    });
  } catch (err) {
    logger.error('Health check DB ping failed', err);
    return res.status(503).json({
      status: 'degraded',
      timestamp: new Date().toISOString(),
      error: 'Database connectivity issue',
    });
  }
});

/**
 * GET /api/v1/metrics/summary
 * Operational metrics — requires ADMIN or MANAGER role.
 * Returns ticket counts, SLA compliance, user activity.
 */
router.get('/summary', authenticate, authorizeRoles(ADMIN_ROLES), async (req, res) => {
  try {
    const [ticketStats, slaStats, userStats, queueStats] = await Promise.all([
      // Ticket status distribution
      executeQuery(`
        SELECT
          ts.status_name,
          ts.status_code,
          ts.is_final_status,
          COUNT(t.ticket_id) AS count
        FROM ticket_statuses ts
        LEFT JOIN tickets t ON t.status_id = ts.status_id
        GROUP BY ts.status_name, ts.status_code, ts.is_final_status
        ORDER BY ts.is_final_status, ts.status_name
      `, {}),

      // SLA compliance (open tickets only)
      executeQuery(`
        SELECT
          COUNT(*) AS total_open,
          SUM(CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END) AS no_sla_set,
          SUM(CASE
            WHEN t.due_date IS NOT NULL AND GETDATE() > t.due_date AND ts.is_final_status = 0
            THEN 1 ELSE 0
          END) AS sla_breached,
          SUM(CASE
            WHEN t.due_date IS NOT NULL AND GETDATE() <= t.due_date AND ts.is_final_status = 0
            THEN 1 ELSE 0
          END) AS sla_within
        FROM tickets t
        LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
        WHERE ts.is_final_status = 0
      `, {}),

      // Active users / engineers with open load
      executeQuery(`
        SELECT
          COUNT(DISTINCT t.assigned_to) AS active_engineers,
          SUM(CASE WHEN t.assigned_to IS NULL AND ts.is_final_status = 0 THEN 1 ELSE 0 END) AS unassigned_open
        FROM tickets t
        LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
      `, {}),

      // Email queue depth
      executeQuery(`
        SELECT
          COUNT(*) AS total_pending
        FROM email_queue
        WHERE status IN ('pending', 'failed')
          AND (retry_count IS NULL OR retry_count < 5)
      `, {}),
    ]);

    // Compute SLA compliance %
    const sla = slaStats.recordset[0] || {};
    const slaTotal = (sla.sla_breached || 0) + (sla.sla_within || 0);
    const slaCompliancePct = slaTotal > 0
      ? Math.round((sla.sla_within / slaTotal) * 100)
      : 100;

    return res.status(200).json({
      success: true,
      data: {
        generated_at: new Date().toISOString(),
        uptime_seconds: Math.floor(process.uptime()),
        tickets: {
          by_status: ticketStats.recordset,
          unassigned_open: userStats.recordset[0]?.unassigned_open || 0,
        },
        sla: {
          total_open: sla.total_open || 0,
          breached: sla.sla_breached || 0,
          within: sla.sla_within || 0,
          compliance_pct: slaCompliancePct,
        },
        engineers: {
          active_with_tickets: userStats.recordset[0]?.active_engineers || 0,
        },
        email_queue: {
          pending_or_failed: queueStats.recordset[0]?.total_pending || 0,
        },
      },
    });
  } catch (err) {
    logger.error('Metrics summary failed', err);
    return res.status(500).json({ success: false, message: 'Failed to collect metrics' });
  }
});

module.exports = router;

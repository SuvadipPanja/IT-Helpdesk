// ============================================
// Dashboard Controller — Enhanced v2
// Production-ready with parameterized queries,
// consolidated SQL, trend data, and activity feed
// ============================================

const { executeQuery } = require('../config/database');
const { createResponse } = require('../utils/helpers');
const settingsService = require('../services/settings.service');
const logger = require('../utils/logger');

/**
 * Get Dashboard Statistics — Enhanced
 * @route GET /api/v1/dashboard/stats
 * @access Private
 */
const getDashboardStats = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const canViewAll = req.user.permissions?.can_view_all_tickets || false;

    logger.info('Fetching dashboard statistics', { userId, canViewAll });

    // ── Build safe ticket filter ──
    const ticketWhere = canViewAll
      ? '1=1'
      : '(t.requester_id = @userId OR t.assigned_to = @userId)';

    const params = { userId };

    // Trend window: 7, 14, or 30 days (default 7)
    const trendDays = Math.min(Math.max(parseInt(req.query.days) || 7, 7), 30);
    params.trendDays = trendDays;

    // Load SLA warning threshold from settings (e.g. 90 → 0.9)
    const slaThresholdPct = parseInt(await settingsService.get('sla_warning_threshold')) || 80;
    const slaThresholdDash = slaThresholdPct / 100;
    params.slaThresholdDash = slaThresholdDash;

    // ── CONSOLIDATED QUERY: Summary + Status + Priority + SLA (server-side) ──
    const mainQuery = `
      -- 1) Ticket status counts
      SELECT
        ts.status_code,
        ts.status_name,
        COUNT(t.ticket_id) AS cnt
      FROM ticket_statuses ts
      LEFT JOIN tickets t ON ts.status_id = t.status_id AND ${ticketWhere}
      WHERE ts.is_active = 1
      GROUP BY ts.status_code, ts.status_name, ts.status_id
      ORDER BY ts.status_id;

      -- 2) Priority distribution
      SELECT
        tp.priority_code,
        tp.priority_name,
        COUNT(t.ticket_id) AS cnt
      FROM ticket_priorities tp
      LEFT JOIN tickets t ON tp.priority_id = t.priority_id AND ${ticketWhere}
      WHERE ISNULL(tp.is_active, 1) = 1
      GROUP BY tp.priority_code, tp.priority_name, tp.priority_level
      ORDER BY tp.priority_level DESC;

      -- 3) SLA summary (threshold from sla_warning_threshold setting)
      SELECT
        SUM(CASE WHEN sla_status = 'OK' THEN 1 ELSE 0 END)       AS on_track,
        SUM(CASE WHEN sla_status = 'WARNING' THEN 1 ELSE 0 END)  AS at_risk,
        SUM(CASE WHEN sla_status = 'BREACHED' THEN 1 ELSE 0 END) AS breached,
        SUM(CASE WHEN sla_status = 'NO_SLA' THEN 1 ELSE 0 END)   AS no_sla,
        COUNT(*) AS total
      FROM (
        SELECT
          CASE
            WHEN ISNULL(t.sla_paused, 0) = 1 THEN 'NO_SLA'
            WHEN t.due_date IS NULL THEN 'NO_SLA'
            WHEN ts2.is_final_status = 1 AND t.resolved_at IS NOT NULL AND t.resolved_at <= t.due_date THEN 'OK'
            WHEN ts2.is_final_status = 1 AND t.resolved_at IS NOT NULL AND t.resolved_at > t.due_date THEN 'BREACHED'
            WHEN ts2.is_final_status = 0 AND GETDATE() > t.due_date THEN 'BREACHED'
            WHEN ts2.is_final_status = 0
              AND DATEDIFF(SECOND, t.created_at, GETDATE()) >= DATEDIFF(SECOND, t.created_at, t.due_date) * @slaThresholdDash
              THEN 'WARNING'
            ELSE 'OK'
          END AS sla_status
        FROM tickets t
        INNER JOIN ticket_statuses ts2 ON t.status_id = ts2.status_id
        WHERE ${ticketWhere}
      ) sla;

      -- 4) Escalated count (open only)
      SELECT COUNT(*) AS cnt
      FROM tickets t
      INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
      WHERE ${ticketWhere}
        AND t.is_escalated = 1
        AND ts.is_final_status = 0;

      -- 5) My assigned (open)
      SELECT COUNT(*) AS cnt
      FROM tickets t
      INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
      WHERE t.assigned_to = @userId;

      -- 6) Total active users (admins only)
      SELECT COUNT(*) AS cnt FROM users WHERE is_active = 1;

      -- 7) Recent tickets (last 10)
      SELECT TOP 10
        t.ticket_id,
        t.ticket_number,
        t.subject,
        t.created_at,
        t.due_date,
        tc.category_name,
        tp.priority_name,
        tp.priority_code,
        ts.status_name,
        ts.status_code,
        u.first_name + ' ' + u.last_name AS requester_name,
        a.first_name + ' ' + a.last_name AS assigned_name
      FROM tickets t
      LEFT JOIN ticket_categories tc ON t.category_id = tc.category_id
      LEFT JOIN ticket_priorities tp ON t.priority_id = tp.priority_id
      LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
      LEFT JOIN users u ON t.requester_id = u.user_id
      LEFT JOIN users a ON t.assigned_to = a.user_id
      WHERE ${ticketWhere}
      ORDER BY t.created_at DESC;

      -- 8) Ticket trend — last N days (parameterised by @trendDays)
      SELECT
        CAST(t.created_at AS DATE) AS date_key,
        COUNT(*)                   AS created_count,
        SUM(CASE WHEN ts.is_final_status = 1 THEN 1 ELSE 0 END) AS closed_count
      FROM tickets t
      INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
      WHERE t.created_at >= DATEADD(DAY, -(@trendDays-1), CAST(GETDATE() AS DATE))
        AND ${ticketWhere}
      GROUP BY CAST(t.created_at AS DATE)
      ORDER BY date_key;

      -- 9) Department distribution (open tickets)
      SELECT
        d.department_name,
        COUNT(t.ticket_id) AS cnt
      FROM departments d
      LEFT JOIN tickets t ON d.department_id = t.department_id AND ${ticketWhere}
        AND t.status_id IN (SELECT status_id FROM ticket_statuses WHERE is_final_status = 0)
      WHERE ISNULL(d.is_active, 1) = 1
      GROUP BY d.department_name
      HAVING COUNT(t.ticket_id) > 0
      ORDER BY cnt DESC;

      -- 10) Top performers (last 30 days)
      SELECT TOP 5
        u.first_name + ' ' + u.last_name AS agent_name,
        COUNT(t.ticket_id) AS resolved_count,
        AVG(DATEDIFF(HOUR, t.created_at, COALESCE(t.closed_at, t.resolved_at))) AS avg_hours
      FROM users u
      INNER JOIN tickets t ON u.user_id = t.assigned_to
      INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
      WHERE ts.is_final_status = 1
        AND (t.closed_at IS NOT NULL OR t.resolved_at IS NOT NULL)
        AND t.created_at >= DATEADD(DAY, -30, GETDATE())
      GROUP BY u.first_name, u.last_name
      HAVING COUNT(t.ticket_id) > 0
      ORDER BY resolved_count DESC;

      -- 11) Category distribution
      SELECT
        tc.category_name,
        COUNT(t.ticket_id) AS cnt
      FROM ticket_categories tc
      LEFT JOIN tickets t ON tc.category_id = t.category_id AND ${ticketWhere}
      WHERE ISNULL(tc.is_active, 1) = 1
      GROUP BY tc.category_name
      HAVING COUNT(t.ticket_id) > 0
      ORDER BY cnt DESC;

      -- 12) My performance (for engineer's own stats)
      SELECT
        COUNT(t.ticket_id) AS total_assigned,
        SUM(CASE WHEN ts.is_final_status = 1 THEN 1 ELSE 0 END) AS resolved_count,
        SUM(CASE WHEN ts.is_final_status = 0 THEN 1 ELSE 0 END) AS open_count,
        AVG(CASE WHEN ts.is_final_status = 1 AND (t.closed_at IS NOT NULL OR t.resolved_at IS NOT NULL)
            THEN DATEDIFF(HOUR, t.created_at, COALESCE(t.closed_at, t.resolved_at))
            ELSE NULL END) AS avg_resolution_hours,
        SUM(CASE WHEN ts.is_final_status = 1 AND t.created_at >= DATEADD(DAY, -30, GETDATE()) THEN 1 ELSE 0 END) AS resolved_last_30,
        SUM(CASE WHEN ts.is_final_status = 1 AND t.created_at >= DATEADD(DAY, -7, GETDATE()) THEN 1 ELSE 0 END) AS resolved_last_7,
        SUM(CASE WHEN t.due_date IS NOT NULL AND ts.is_final_status = 1
            AND COALESCE(t.resolved_at, t.closed_at) <= t.due_date THEN 1 ELSE 0 END) AS within_sla,
        SUM(CASE WHEN t.due_date IS NOT NULL AND ts.is_final_status = 1 THEN 1 ELSE 0 END) AS total_with_sla
      FROM tickets t
      INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
      WHERE t.assigned_to = @userId;

      -- 13) My rating stats (engineer's customer satisfaction)
      SELECT
        COUNT(*) AS total_ratings,
        CAST(AVG(CAST(r.overall_rating AS FLOAT)) AS DECIMAL(3,2)) AS avg_rating,
        CAST(AVG(CAST(r.resolution_quality AS FLOAT)) AS DECIMAL(3,2)) AS avg_resolution_quality,
        CAST(AVG(CAST(r.timeliness AS FLOAT)) AS DECIMAL(3,2)) AS avg_timeliness,
        CAST(AVG(CAST(r.satisfaction AS FLOAT)) AS DECIMAL(3,2)) AS avg_satisfaction,
        CAST(AVG(CAST(r.professionalism AS FLOAT)) AS DECIMAL(3,2)) AS avg_professionalism,
        SUM(CASE WHEN r.overall_rating >= 4.0 THEN 1 ELSE 0 END) AS positive_ratings,
        SUM(CASE WHEN r.overall_rating < 3.0 THEN 1 ELSE 0 END) AS negative_ratings,
        (SELECT COUNT(*) FROM tickets t2
         INNER JOIN ticket_statuses ts2 ON t2.status_id = ts2.status_id
         WHERE t2.assigned_to = @userId AND ts2.is_final_status = 1) AS total_closed
      FROM ticket_ratings r
      WHERE r.rated_engineer_id = @userId;

      -- 14) Location-wise ticket distribution
      SELECT
        l.location_id,
        l.location_name,
        l.location_code,
        COUNT(t.ticket_id) AS total,
        SUM(CASE WHEN ts.is_final_status = 0 THEN 1 ELSE 0 END) AS open_count,
        SUM(CASE WHEN ts.is_final_status = 1 THEN 1 ELSE 0 END) AS closed_count
      FROM locations l
      LEFT JOIN tickets t ON l.location_id = t.location_id AND ${ticketWhere}
      LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
      WHERE ISNULL(l.is_active, 1) = 1
      GROUP BY l.location_id, l.location_name, l.location_code
      ORDER BY total DESC;

      -- 15) Process-wise ticket distribution
      SELECT
        p.process_name,
        p.process_code,
        COUNT(t.ticket_id) AS total,
        SUM(CASE WHEN ts.is_final_status = 0 THEN 1 ELSE 0 END) AS open_count,
        SUM(CASE WHEN ts.is_final_status = 1 THEN 1 ELSE 0 END) AS closed_count
      FROM processes p
      LEFT JOIN tickets t ON p.process_id = t.process_id AND ${ticketWhere}
      LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
      WHERE ISNULL(p.is_active, 1) = 1
      GROUP BY p.process_name, p.process_code, p.process_id
      ORDER BY total DESC;

      -- 16) Assigned by me (created by me)
      SELECT COUNT(*) AS cnt
      FROM tickets t
      WHERE t.requester_id = @userId;

      -- 17) Location bucket count (unassigned + open)
      SELECT COUNT(*) AS cnt
      FROM tickets t
      INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
      WHERE t.assigned_to IS NULL
        AND ts.is_final_status = 0
        AND (
          @userLocationId IS NULL
          OR t.location_id = @userLocationId
        );

      -- 18) Need more details (tickets where requester needs to provide info)
      SELECT COUNT(*) AS cnt
      FROM tickets t
      WHERE t.requester_id = @userId
        AND ISNULL(t.sla_paused, 0) = 1;

      -- 19) Overdue open tickets (past due_date, not yet resolved)
      SELECT COUNT(*) AS cnt
      FROM tickets t
      INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
      WHERE ${ticketWhere}
        AND ts.is_final_status = 0
        AND t.due_date IS NOT NULL
        AND t.due_date < GETDATE();

      -- 20) System avg resolution time in hours (last 30 days)
      SELECT
        AVG(DATEDIFF(HOUR, t.created_at, COALESCE(t.resolved_at, t.closed_at))) AS avg_hours,
        COUNT(*) AS resolved_count
      FROM tickets t
      INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
      WHERE ts.is_final_status = 1
        AND (t.resolved_at IS NOT NULL OR t.closed_at IS NOT NULL)
        AND t.created_at >= DATEADD(DAY, -30, GETDATE())
        AND ${ticketWhere};

      -- 21) Active outage notifications count
      SELECT COUNT(*) AS cnt FROM outage_notifications WHERE status = 'active';
    `;

    params.userLocationId = req.user.location_id || null;

    const result = await executeQuery(mainQuery, params);

    // ── Parse recordsets (with safe defaults to prevent crashes) ──
    const rs = result.recordsets || [];
    const statusRows      = rs[0] || [];
    const priorityRows    = rs[1] || [];
    const slaRow          = rs[2]?.[0] || null;
    const escalatedCount  = rs[3]?.[0]?.cnt || 0;
    const myAssigned      = rs[4]?.[0]?.cnt || 0;
    const totalUsers      = rs[5]?.[0]?.cnt || 0;
    const recentTickets   = rs[6] || [];
    const trendRows       = rs[7] || [];
    const deptRows        = rs[8] || [];
    const topPerformers   = rs[9] || [];
    const categoryRows    = rs[10] || [];
    const myPerfRow       = rs[11]?.[0];
    const myRatingRow     = rs[12]?.[0];
    const locationRows    = rs[13] || [];
    const processRows     = rs[14] || [];
    const myCreatedCount  = rs[15]?.[0]?.cnt || 0;
    const locationBucketCount = rs[16]?.[0]?.cnt || 0;
    const needMoreDetailsCount = rs[17]?.[0]?.cnt || 0;
    const overdueCount    = rs[18]?.[0]?.cnt || 0;
    const avgResolutionRow = rs[19]?.[0] || null;
    const activeOutages   = rs[20]?.[0]?.cnt || 0;

    // ── Build status map ──
    const statusMap = {};
    let totalTickets = 0;
    (statusRows || []).forEach(r => { statusMap[r.status_code] = r.cnt; totalTickets += r.cnt; });

    // ── SLA compliance ──
    const onTrack  = slaRow?.on_track  || 0;
    const atRisk   = slaRow?.at_risk   || 0;
    const breached = slaRow?.breached  || 0;
    const noSla    = slaRow?.no_sla    || 0;
    const totalWithSla = onTrack + atRisk + breached;
    const complianceRate = totalWithSla > 0
      ? parseFloat(((onTrack + atRisk) / totalWithSla * 100).toFixed(1))
      : 0;

    // ── Fill N-day trend (fill missing dates with 0) ──
    const trend = [];
    for (let i = trendDays - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const row = (trendRows || []).find(r => {
        const rKey = new Date(r.date_key).toISOString().slice(0, 10);
        return rKey === key;
      });
      trend.push({
        date: key,
        day: d.toLocaleDateString('en-US', { weekday: 'short' }),
        created: row?.created_count || 0,
        closed: row?.closed_count || 0,
      });
    }

    // ── Compute comparison vs yesterday ──
    const todayCreated = trend[trend.length - 1]?.created || 0;
    const yesterdayCreated = trend[trend.length - 2]?.created || 0;
    const trendDirection = todayCreated > yesterdayCreated ? 'up' :
                           todayCreated < yesterdayCreated ? 'down' : 'flat';
    const trendPercent = yesterdayCreated > 0
      ? Math.round(Math.abs(todayCreated - yesterdayCreated) / yesterdayCreated * 100)
      : 0;

    // ── Build response ──
    const dashboardData = {
      summary: {
        totalTickets,
        openTickets: statusMap['OPEN'] || 0,
        inProgressTickets: statusMap['IN_PROGRESS'] || 0,
        pendingTickets: statusMap['PENDING'] || 0,
        onHoldTickets: statusMap['ON_HOLD'] || 0,
        closedTickets: (statusMap['CLOSED'] || 0) + (statusMap['RESOLVED'] || 0),
        cancelledTickets: statusMap['CANCELLED'] || 0,
        reopenedTickets: statusMap['REOPENED'] || 0,
        escalatedTickets: escalatedCount,
        totalUsers: canViewAll ? totalUsers : null,
        myAssignedTickets: myAssigned,
        myCreatedTickets: myCreatedCount,
        myLocationBucketTickets: locationBucketCount,
        needMoreDetailsTickets: needMoreDetailsCount,
        overdueTickets: overdueCount,
        activeOutages,
        avgResolutionHours: avgResolutionRow?.avg_hours != null ? Math.round(avgResolutionRow.avg_hours) : null,
        resolutionRate: totalTickets > 0
          ? parseFloat((((statusMap['CLOSED'] || 0) + (statusMap['RESOLVED'] || 0)) / totalTickets * 100).toFixed(1))
          : 0,
        slaStats: { onTrack, atRisk, breached, noSla, total: slaRow?.total || 0, complianceRate },
        trendDirection,
        trendPercent,
        trendDays,
        todayCreated,
      },
      recentTickets,
      ticketsByStatus: (statusRows || []).map(r => ({ label: r.status_name, value: r.cnt, code: r.status_code })),
      ticketsByPriority: (priorityRows || []).map(r => ({ label: r.priority_name, value: r.cnt, code: r.priority_code })),
      trend,
      departmentLoad: (deptRows || []).map(r => ({ name: r.department_name, count: r.cnt })),
      topPerformers: (topPerformers || []).map(r => ({
        name: r.agent_name,
        resolved: r.resolved_count,
        avgHours: Math.round(r.avg_hours || 0),
      })),
      ticketsByCategory: (categoryRows || []).map(r => ({ label: r.category_name, value: r.cnt })),
      ticketsByLocation: locationRows.map(r => ({
        id: r.location_id,
        name: r.location_name,
        code: r.location_code,
        total: r.total,
        open: r.open_count,
        closed: r.closed_count,
      })),
      ticketsByProcess: processRows.map(r => ({
        name: r.process_name,
        code: r.process_code,
        total: r.total,
        open: r.open_count,
        closed: r.closed_count,
      })),
      myPerformance: myPerfRow ? {
        totalAssigned: myPerfRow.total_assigned || 0,
        resolved: myPerfRow.resolved_count || 0,
        open: myPerfRow.open_count || 0,
        avgHours: Math.round(myPerfRow.avg_resolution_hours || 0),
        resolvedLast30: myPerfRow.resolved_last_30 || 0,
        resolvedLast7: myPerfRow.resolved_last_7 || 0,
        slaCompliance: myPerfRow.total_with_sla > 0
          ? Math.round((myPerfRow.within_sla / myPerfRow.total_with_sla) * 100)
          : 0,
        // Rating stats from ticket_ratings table
        avgRating: myRatingRow?.total_ratings > 0
          ? parseFloat(myRatingRow.avg_rating) || 0
          : 0,
        totalRatings: myRatingRow?.total_ratings || 0,
        positiveRatings: myRatingRow?.positive_ratings || 0,
        negativeRatings: myRatingRow?.negative_ratings || 0,
        satisfactionPct: myRatingRow?.total_ratings > 0
          ? Math.round((myRatingRow.positive_ratings / myRatingRow.total_ratings) * 100)
          : 0,
        ratingRate: myRatingRow?.total_closed > 0
          ? Math.round((myRatingRow.total_ratings / myRatingRow.total_closed) * 100)
          : 0,
        avgResolutionQuality: myRatingRow?.total_ratings > 0
          ? parseFloat(myRatingRow.avg_resolution_quality) || 0 : 0,
        avgTimeliness: myRatingRow?.total_ratings > 0
          ? parseFloat(myRatingRow.avg_timeliness) || 0 : 0,
        avgSatisfaction: myRatingRow?.total_ratings > 0
          ? parseFloat(myRatingRow.avg_satisfaction) || 0 : 0,
        avgProfessionalism: myRatingRow?.total_ratings > 0
          ? parseFloat(myRatingRow.avg_professionalism) || 0 : 0,
      } : null,
      roleCode: req.user.role?.role_code || '',
      userLocationId: req.user.location_id || null,
      userPermissions: {
        canViewAll,
        canCreateTickets: req.user.permissions?.can_create_tickets || false,
        canManageUsers: req.user.permissions?.can_manage_users || false,
        canViewAnalytics: req.user.permissions?.can_view_analytics || false,
      },
    };

    logger.success('Dashboard stats fetched');

    return res.status(200).json(
      createResponse(true, 'Dashboard statistics fetched successfully', dashboardData)
    );
  } catch (error) {
    logger.error('Dashboard stats error', error);
    next(error);
  }
};

/**
 * Get Recent Activity Feed
 * @route GET /api/v1/dashboard/activity
 * @access Private
 */
const getUserActivity = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const canViewAll = req.user.permissions?.can_view_all_tickets || false;
    const limit = Math.min(parseInt(req.query.limit) || 15, 50);

    const filter = canViewAll
      ? '1=1'
      : '(t.requester_id = @userId OR t.assigned_to = @userId)';

    const query = `
      SELECT TOP (@limit)
        ta.activity_id,
        ta.activity_type,
        ta.description,
        ta.performed_at,
        u.first_name + ' ' + u.last_name AS performed_by_name,
        t.ticket_number,
        t.subject AS ticket_subject
      FROM ticket_activities ta
      INNER JOIN tickets t ON ta.ticket_id = t.ticket_id
      INNER JOIN users u ON ta.performed_by = u.user_id
      WHERE ${filter}
      ORDER BY ta.performed_at DESC
    `;

    const result = await executeQuery(query, { userId, limit });

    return res.status(200).json(
      createResponse(true, 'Activity feed fetched successfully', result.recordset)
    );
  } catch (error) {
    logger.error('User activity error', error);
    next(error);
  }
};

module.exports = {
  getDashboardStats,
  getUserActivity,
};

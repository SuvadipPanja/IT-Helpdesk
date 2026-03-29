// ============================================
// Enhanced Analytics Controller
// Industry-standard analytics with SLA, CSAT, Escalation, Aging metrics
// ============================================

const { executeQuery } = require('../config/database');
const { createResponse } = require('../utils/helpers');
const settingsService = require('../services/settings.service');
const logger = require('../utils/logger');

/**
 * Get comprehensive dashboard overview
 * @route GET /api/v1/analytics/dashboard
 * @access Private (Admin/Manager)
 */
const getDashboard = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;

    logger.info('Fetching enhanced dashboard analytics', {
      userId: req.user.user_id,
      startDate: start_date,
      endDate: end_date,
    });

    const hasDateRange = start_date && end_date;
    const params = {
      startDate: hasDateRange ? start_date : null,
      endDate: hasDateRange ? end_date : null,
    };

    const query = `
      SELECT 
        -- Basic Metrics
        (SELECT COUNT(*) FROM tickets WHERE 1=1 AND (@startDate IS NULL OR created_at >= @startDate) AND (@endDate IS NULL OR created_at < DATEADD(DAY, 1, @endDate))) as total_tickets,
        (SELECT COUNT(*) FROM tickets t
         INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
         WHERE ts.is_final_status = 0 AND (@startDate IS NULL OR t.created_at >= @startDate) AND (@endDate IS NULL OR t.created_at < DATEADD(DAY, 1, @endDate))) as open_tickets,
        (SELECT COUNT(*) FROM tickets t
         INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
         WHERE ts.is_final_status = 1 AND (@startDate IS NULL OR t.created_at >= @startDate) AND (@endDate IS NULL OR t.created_at < DATEADD(DAY, 1, @endDate))) as closed_tickets,
        
        -- Resolution Metrics
        (SELECT AVG(DATEDIFF(HOUR, t.created_at, COALESCE(t.closed_at, t.resolved_at)))
         FROM tickets t
         INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
         WHERE ts.is_final_status = 1 
           AND (t.closed_at IS NOT NULL OR t.resolved_at IS NOT NULL) AND (@startDate IS NULL OR t.created_at >= @startDate) AND (@endDate IS NULL OR t.created_at < DATEADD(DAY, 1, @endDate))) as avg_resolution_hours,
        
        -- First Response Metrics
        (SELECT AVG(DATEDIFF(MINUTE, created_at, first_response_at))
         FROM tickets 
         WHERE first_response_at IS NOT NULL AND (@startDate IS NULL OR created_at >= @startDate) AND (@endDate IS NULL OR created_at < DATEADD(DAY, 1, @endDate))) as avg_first_response_minutes,
        
        -- SLA Compliance (computed dynamically from timestamps)
        (SELECT CAST(COUNT(CASE WHEN DATEDIFF(MINUTE, t.created_at, t.first_response_at) <= tp.response_time_hours * 60 THEN 1 END) AS FLOAT) 
            / NULLIF(COUNT(t.first_response_at), 0) * 100
         FROM tickets t
         INNER JOIN ticket_priorities tp ON t.priority_id = tp.priority_id
         WHERE t.first_response_at IS NOT NULL AND (@startDate IS NULL OR t.created_at >= @startDate) AND (@endDate IS NULL OR t.created_at < DATEADD(DAY, 1, @endDate))) as first_response_sla_percent,
        
        (SELECT CAST(COUNT(CASE WHEN DATEDIFF(MINUTE, t.created_at, COALESCE(t.closed_at, t.resolved_at)) <= tp.resolution_time_hours * 60 THEN 1 END) AS FLOAT) 
            / NULLIF(COUNT(*), 0) * 100
         FROM tickets t
         INNER JOIN ticket_priorities tp ON t.priority_id = tp.priority_id
         INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
         WHERE ts.is_final_status = 1 AND (t.closed_at IS NOT NULL OR t.resolved_at IS NOT NULL) AND (@startDate IS NULL OR t.created_at >= @startDate) AND (@endDate IS NULL OR t.created_at < DATEADD(DAY, 1, @endDate))) as resolution_sla_percent,
        
        -- Customer Satisfaction
        (SELECT AVG(CAST(rating AS FLOAT))
         FROM tickets 
         WHERE rating IS NOT NULL AND (@startDate IS NULL OR created_at >= @startDate) AND (@endDate IS NULL OR created_at < DATEADD(DAY, 1, @endDate))) as avg_csat_rating,
        
        (SELECT COUNT(*) 
         FROM tickets 
         WHERE rating IS NOT NULL AND (@startDate IS NULL OR created_at >= @startDate) AND (@endDate IS NULL OR created_at < DATEADD(DAY, 1, @endDate))) as total_rated_tickets,
        
        -- Escalation Metrics
        (SELECT COUNT(*) 
         FROM tickets 
         WHERE is_escalated = 1 AND (@startDate IS NULL OR created_at >= @startDate) AND (@endDate IS NULL OR created_at < DATEADD(DAY, 1, @endDate))) as escalated_tickets,
        
        (SELECT CAST(COUNT(CASE WHEN is_escalated = 1 THEN 1 END) AS FLOAT) / NULLIF(COUNT(*), 0) * 100
         FROM tickets 
         WHERE 1=1 AND (@startDate IS NULL OR created_at >= @startDate) AND (@endDate IS NULL OR created_at < DATEADD(DAY, 1, @endDate))) as escalation_rate,
        
        -- Workload Metrics
        (SELECT COUNT(*) FROM users WHERE is_active = 1) as active_agents,
        (SELECT COUNT(*) FROM departments WHERE is_active = 1) as active_departments,
        
        -- Time-based Metrics
        (SELECT COUNT(*) FROM tickets 
         WHERE CAST(created_at AS DATE) = CAST(GETDATE() AS DATE)) as tickets_today,
        
        (SELECT COUNT(*) FROM tickets 
         WHERE created_at >= DATEADD(WEEK, -1, GETDATE())) as tickets_this_week,
        
        (SELECT COUNT(*) FROM tickets 
         WHERE created_at >= DATEADD(MONTH, -1, GETDATE())) as tickets_this_month,
        
        -- Closure Metrics
        (SELECT COUNT(*) FROM tickets WHERE auto_closed = 1 AND (@startDate IS NULL OR created_at >= @startDate) AND (@endDate IS NULL OR created_at < DATEADD(DAY, 1, @endDate))) as auto_closed_count
    `;

    const result = await executeQuery(query, params);
    const data = result.recordset[0];

    // Calculate derived metrics
    const enhancedData = {
      ...data,
      avg_resolution_hours: Math.round(data.avg_resolution_hours || 0),
      avg_first_response_minutes: Math.round(data.avg_first_response_minutes || 0),
      first_response_sla_percent: Math.round(data.first_response_sla_percent || 0),
      resolution_sla_percent: Math.round(data.resolution_sla_percent || 0),
      avg_csat_rating: Math.round((data.avg_csat_rating || 0) * 10) / 10,
      escalation_rate: Math.round((data.escalation_rate || 0) * 10) / 10,
      closure_rate: data.total_tickets > 0 
        ? Math.round((data.closed_tickets / data.total_tickets) * 100) 
        : 0,
      tickets_per_agent: data.active_agents > 0 
        ? Math.round(data.total_tickets / data.active_agents) 
        : 0,
      csat_response_rate: data.total_tickets > 0
        ? Math.round((data.total_rated_tickets / data.total_tickets) * 100)
        : 0,
    };

    logger.success('Enhanced dashboard fetched successfully');

    return res.status(200).json(
      createResponse(true, 'Dashboard analytics fetched successfully', enhancedData)
    );
  } catch (error) {
    logger.error('Get dashboard analytics error', error);
    next(error);
  }
};

/**
 * Get SLA performance metrics
 * @route GET /api/v1/analytics/sla-performance
 * @access Private (Admin/Manager)
 */
const getSLAPerformance = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;

    logger.info('Fetching SLA performance', { userId: req.user.user_id });

    const hasDateRange = start_date && end_date;
    const params = {
      startDate: hasDateRange ? start_date : null,
      endDate: hasDateRange ? end_date : null,
    };

    const query = `
      SELECT 
        -- By Priority (SLA computed dynamically from timestamps)
        tp.priority_name,
        tp.response_time_hours,
        tp.resolution_time_hours,
        COUNT(t.ticket_id) as total_tickets,
        
        -- First Response SLA: compare actual first_response time vs SLA target
        COUNT(CASE WHEN t.first_response_at IS NOT NULL 
          AND DATEDIFF(MINUTE, t.created_at, t.first_response_at) <= tp.response_time_hours * 60 
          THEN 1 END) as first_response_met,
        COUNT(CASE WHEN t.first_response_at IS NOT NULL 
          AND DATEDIFF(MINUTE, t.created_at, t.first_response_at) > tp.response_time_hours * 60 
          THEN 1 END) as first_response_missed,
        
        -- Resolution SLA: compare actual resolution time vs SLA target
        COUNT(CASE WHEN (t.resolved_at IS NOT NULL OR t.closed_at IS NOT NULL) 
          AND DATEDIFF(MINUTE, t.created_at, COALESCE(t.closed_at, t.resolved_at)) <= tp.resolution_time_hours * 60 
          THEN 1 END) as resolution_met,
        COUNT(CASE WHEN (t.resolved_at IS NOT NULL OR t.closed_at IS NOT NULL) 
          AND DATEDIFF(MINUTE, t.created_at, COALESCE(t.closed_at, t.resolved_at)) > tp.resolution_time_hours * 60 
          THEN 1 END) as resolution_missed,
        
        -- SLA Percentages
        CAST(COUNT(CASE WHEN t.first_response_at IS NOT NULL 
          AND DATEDIFF(MINUTE, t.created_at, t.first_response_at) <= tp.response_time_hours * 60 
          THEN 1 END) AS FLOAT) 
          / NULLIF(COUNT(CASE WHEN t.first_response_at IS NOT NULL THEN 1 END), 0) * 100 as first_response_sla_percent,
        CAST(COUNT(CASE WHEN (t.resolved_at IS NOT NULL OR t.closed_at IS NOT NULL) 
          AND DATEDIFF(MINUTE, t.created_at, COALESCE(t.closed_at, t.resolved_at)) <= tp.resolution_time_hours * 60 
          THEN 1 END) AS FLOAT) 
          / NULLIF(COUNT(CASE WHEN t.resolved_at IS NOT NULL OR t.closed_at IS NOT NULL THEN 1 END), 0) * 100 as resolution_sla_percent,

        -- Extra metrics for enrichment
        COUNT(CASE WHEN t.first_response_at IS NOT NULL THEN 1 END) as responded_tickets,
        COUNT(CASE WHEN t.resolved_at IS NOT NULL OR t.closed_at IS NOT NULL THEN 1 END) as resolved_tickets
      FROM ticket_priorities tp
      LEFT JOIN tickets t ON tp.priority_id = t.priority_id AND (@startDate IS NULL OR t.created_at >= @startDate) AND (@endDate IS NULL OR t.created_at < DATEADD(DAY, 1, @endDate))
      WHERE ISNULL(tp.is_active, 1) = 1
      GROUP BY tp.priority_name, tp.priority_level, tp.response_time_hours, tp.resolution_time_hours
      ORDER BY tp.priority_level DESC
    `;

    const result = await executeQuery(query, params);

    const formatted = result.recordset.map(row => ({
      ...row,
      first_response_sla_percent: Math.round(row.first_response_sla_percent || 0),
      resolution_sla_percent: Math.round(row.resolution_sla_percent || 0),
    }));

    // Include SLA target threshold from settings
    let slaTarget = 90; // default
    try {
      const threshold = await settingsService.get('sla_warning_threshold');
      if (threshold) slaTarget = parseInt(threshold) || 90;
    } catch { /* use default */ }

    logger.success('SLA performance fetched successfully');

    return res.status(200).json(
      createResponse(true, 'SLA performance fetched successfully', {
        priorities: formatted,
        slaTarget
      })
    );
  } catch (error) {
    logger.error('Get SLA performance error', error);
    next(error);
  }
};

/**
 * Get customer satisfaction (CSAT) metrics
 * @route GET /api/v1/analytics/csat
 * @access Private (Admin/Manager)
 */
const getCSATMetrics = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;

    logger.info('Fetching CSAT metrics', { userId: req.user.user_id });

    const hasDateRange = start_date && end_date;
    const params = {
      startDate: hasDateRange ? start_date : null,
      endDate: hasDateRange ? end_date : null,
    };

    const queries = `
      -- Overall CSAT from ticket_ratings table
      SELECT 
        AVG(CAST(r.overall_rating AS FLOAT)) as avg_rating,
        COUNT(*) as total_ratings,
        COUNT(CASE WHEN r.overall_rating >= 4.0 THEN 1 END) as positive_ratings,
        COUNT(CASE WHEN r.overall_rating >= 3.0 AND r.overall_rating < 4.0 THEN 1 END) as neutral_ratings,
        COUNT(CASE WHEN r.overall_rating < 3.0 THEN 1 END) as negative_ratings,
        AVG(CAST(r.resolution_quality AS FLOAT)) as avg_resolution_quality,
        AVG(CAST(r.timeliness AS FLOAT)) as avg_timeliness,
        AVG(CAST(r.satisfaction AS FLOAT)) as avg_satisfaction,
        AVG(CAST(r.professionalism AS FLOAT)) as avg_professionalism
      FROM ticket_ratings r
      WHERE 1=1 AND (@startDate IS NULL OR r.created_at >= @startDate) AND (@endDate IS NULL OR r.created_at < DATEADD(DAY, 1, @endDate));
      
      -- Rating Distribution (1-5 stars based on overall_rating)
      SELECT 
        CAST(ROUND(r.overall_rating, 0) AS INT) as rating,
        COUNT(*) as count
      FROM ticket_ratings r
      WHERE 1=1 AND (@startDate IS NULL OR r.created_at >= @startDate) AND (@endDate IS NULL OR r.created_at < DATEADD(DAY, 1, @endDate))
      GROUP BY CAST(ROUND(r.overall_rating, 0) AS INT)
      ORDER BY rating DESC;
      
      -- CSAT by Department (using ticket_ratings)
      SELECT 
        d.department_name,
        AVG(CAST(r.overall_rating AS FLOAT)) as avg_rating,
        COUNT(r.rating_id) as rating_count
      FROM departments d
      INNER JOIN tickets t ON d.department_id = t.department_id
      INNER JOIN ticket_ratings r ON t.ticket_id = r.ticket_id AND (@startDate IS NULL OR r.created_at >= @startDate) AND (@endDate IS NULL OR r.created_at < DATEADD(DAY, 1, @endDate))
      WHERE ISNULL(d.is_active, 1) = 1 AND (@startDate IS NULL OR t.created_at >= @startDate) AND (@endDate IS NULL OR t.created_at < DATEADD(DAY, 1, @endDate))
      GROUP BY d.department_name
      HAVING COUNT(r.rating_id) > 0
      ORDER BY avg_rating DESC;
      
      -- CSAT by Category (using ticket_ratings)
      SELECT 
        tc.category_name,
        AVG(CAST(r.overall_rating AS FLOAT)) as avg_rating,
        COUNT(r.rating_id) as rating_count
      FROM ticket_categories tc
      INNER JOIN tickets t ON tc.category_id = t.category_id
      INNER JOIN ticket_ratings r ON t.ticket_id = r.ticket_id AND (@startDate IS NULL OR r.created_at >= @startDate) AND (@endDate IS NULL OR r.created_at < DATEADD(DAY, 1, @endDate))
      WHERE ISNULL(tc.is_active, 1) = 1 AND (@startDate IS NULL OR t.created_at >= @startDate) AND (@endDate IS NULL OR t.created_at < DATEADD(DAY, 1, @endDate))
      GROUP BY tc.category_name
      HAVING COUNT(r.rating_id) > 0
      ORDER BY avg_rating DESC;

      -- Rated vs Closed tickets counts
      SELECT
        (SELECT COUNT(*) FROM tickets t
         INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
         WHERE ts.is_final_status = 1 AND (@startDate IS NULL OR t.created_at >= @startDate) AND (@endDate IS NULL OR t.created_at < DATEADD(DAY, 1, @endDate))) as total_closed,
        (SELECT COUNT(*) FROM ticket_ratings r
         INNER JOIN tickets t ON r.ticket_id = t.ticket_id
         WHERE 1=1 AND (@startDate IS NULL OR r.created_at >= @startDate) AND (@endDate IS NULL OR r.created_at < DATEADD(DAY, 1, @endDate))) as total_rated;
    `;

    const result = await executeQuery(queries, params);

    const overall = result.recordsets[0][0];
    const distribution = result.recordsets[1];
    const byDepartment = result.recordsets[2];
    const byCategory = result.recordsets[3];
    const ratedVsClosed = result.recordsets[4][0];

    const data = {
      overall: {
        avg_rating: Math.round((overall.avg_rating || 0) * 10) / 10,
        total_ratings: overall.total_ratings,
        positive_ratings: overall.positive_ratings,
        neutral_ratings: overall.neutral_ratings,
        negative_ratings: overall.negative_ratings,
        satisfaction_score: overall.total_ratings > 0 
          ? Math.round((overall.positive_ratings / overall.total_ratings) * 100) 
          : 0,
        avg_resolution_quality: Math.round((overall.avg_resolution_quality || 0) * 10) / 10,
        avg_timeliness: Math.round((overall.avg_timeliness || 0) * 10) / 10,
        avg_satisfaction: Math.round((overall.avg_satisfaction || 0) * 10) / 10,
        avg_professionalism: Math.round((overall.avg_professionalism || 0) * 10) / 10,
      },
      distribution: distribution.map(d => ({
        rating: d.rating,
        count: d.count,
      })),
      by_department: byDepartment.map(d => ({
        department_name: d.department_name,
        avg_rating: Math.round((d.avg_rating || 0) * 10) / 10,
        rating_count: d.rating_count,
      })),
      by_category: byCategory.map(c => ({
        category_name: c.category_name,
        avg_rating: Math.round((c.avg_rating || 0) * 10) / 10,
        rating_count: c.rating_count,
      })),
      rated_vs_closed: {
        total_closed: ratedVsClosed?.total_closed || 0,
        total_rated: ratedVsClosed?.total_rated || 0,
        total_unrated: (ratedVsClosed?.total_closed || 0) - (ratedVsClosed?.total_rated || 0),
        rating_rate: ratedVsClosed?.total_closed > 0
          ? Math.round((ratedVsClosed.total_rated / ratedVsClosed.total_closed) * 100)
          : 0,
      },
    };

    logger.success('CSAT metrics fetched successfully');

    return res.status(200).json(
      createResponse(true, 'CSAT metrics fetched successfully', data)
    );
  } catch (error) {
    logger.error('Get CSAT metrics error', error);
    next(error);
  }
};

/**
 * Get escalation analytics
 * @route GET /api/v1/analytics/escalations
 * @access Private (Admin/Manager)
 */
const getEscalationAnalytics = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;

    logger.info('Fetching escalation analytics', { userId: req.user.user_id });

    const hasDateRange = start_date && end_date;
    const params = {
      startDate: hasDateRange ? start_date : null,
      endDate: hasDateRange ? end_date : null,
    };

    const query = `
      -- Escalation Overview
      SELECT 
        COUNT(*) as total_escalations,
        COUNT(CASE WHEN ts.is_final_status = 0 THEN 1 END) as open_escalations,
        COUNT(CASE WHEN ts.is_final_status = 1 THEN 1 END) as closed_escalations,
        AVG(DATEDIFF(HOUR, t.created_at, t.escalated_at)) as avg_time_to_escalation_hours
      FROM tickets t
      INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
      WHERE t.is_escalated = 1 AND (@startDate IS NULL OR t.created_at >= @startDate) AND (@endDate IS NULL OR t.created_at < DATEADD(DAY, 1, @endDate));
      
      -- Escalation by Priority
      SELECT 
        tp.priority_name,
        COUNT(t.ticket_id) as escalation_count,
        CAST(COUNT(t.ticket_id) AS FLOAT) / NULLIF((SELECT COUNT(*) FROM tickets WHERE is_escalated = 1 AND (@startDate IS NULL OR created_at >= @startDate) AND (@endDate IS NULL OR created_at < DATEADD(DAY, 1, @endDate))), 0) * 100 as percentage
      FROM ticket_priorities tp
      INNER JOIN tickets t ON tp.priority_id = t.priority_id
      WHERE t.is_escalated = 1 AND (@startDate IS NULL OR t.created_at >= @startDate) AND (@endDate IS NULL OR t.created_at < DATEADD(DAY, 1, @endDate))
      GROUP BY tp.priority_name, tp.priority_level
      ORDER BY tp.priority_level DESC;
      
      -- Escalation by Department
      SELECT 
        d.department_name,
        COUNT(t.ticket_id) as escalation_count
      FROM departments d
      INNER JOIN tickets t ON d.department_id = t.department_id
      WHERE t.is_escalated = 1 AND (@startDate IS NULL OR t.created_at >= @startDate) AND (@endDate IS NULL OR t.created_at < DATEADD(DAY, 1, @endDate))
      GROUP BY d.department_name
      ORDER BY escalation_count DESC;
      
      -- Escalation Reasons (Top 10)
      SELECT TOP 10
        COALESCE(escalation_reason, 'No reason specified') as reason,
        COUNT(*) as count
      FROM tickets
      WHERE is_escalated = 1 AND (@startDate IS NULL OR created_at >= @startDate) AND (@endDate IS NULL OR created_at < DATEADD(DAY, 1, @endDate))
      GROUP BY escalation_reason
      ORDER BY count DESC;
    `;

    const result = await executeQuery(query, params);

    const overview = result.recordsets[0][0];
    const byPriority = result.recordsets[1];
    const byDepartment = result.recordsets[2];
    const reasons = result.recordsets[3];

    // Handle zero escalation case gracefully
    const data = {
      overview: {
        total_escalations: overview?.total_escalations || 0,
        open_escalations: overview?.open_escalations || 0,
        closed_escalations: overview?.closed_escalations || 0,
        avg_time_to_escalation_hours: Math.round(overview?.avg_time_to_escalation_hours || 0),
      },
      by_priority: (byPriority || []).map(p => ({
        priority_name: p.priority_name,
        escalation_count: p.escalation_count,
        percentage: Math.round((p.percentage || 0) * 10) / 10,
      })),
      by_department: byDepartment || [],
      reasons: reasons || [],
    };

    logger.success('Escalation analytics fetched successfully');

    return res.status(200).json(
      createResponse(true, 'Escalation analytics fetched successfully', data)
    );
  } catch (error) {
    logger.error('Get escalation analytics error', error);
    next(error);
  }
};

/**
 * Get ticket aging analysis
 * @route GET /api/v1/analytics/aging
 * @access Private (Admin/Manager)
 */
const getTicketAging = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;

    logger.info('Fetching ticket aging analysis', { userId: req.user.user_id });

    const hasDateRange = start_date && end_date;
    const params = {
      startDate: hasDateRange ? start_date : null,
      endDate: hasDateRange ? end_date : null,
    };

    const query = `
      -- Age Distribution (Open Tickets Only)
      SELECT 
        age_bucket,
        COUNT(*) as count
      FROM (
        SELECT 
          CASE 
            WHEN DATEDIFF(HOUR, t.created_at, GETDATE()) < 24 THEN '0-24 hours'
            WHEN DATEDIFF(HOUR, t.created_at, GETDATE()) < 48 THEN '24-48 hours'
            WHEN DATEDIFF(DAY, t.created_at, GETDATE()) < 7 THEN '2-7 days'
            WHEN DATEDIFF(DAY, t.created_at, GETDATE()) < 30 THEN '7-30 days'
            ELSE '30+ days'
          END as age_bucket
        FROM tickets t
        INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
        WHERE ts.is_final_status = 0 AND (@startDate IS NULL OR t.created_at >= @startDate) AND (@endDate IS NULL OR t.created_at < DATEADD(DAY, 1, @endDate))
      ) s
      GROUP BY age_bucket
      ORDER BY 
        CASE age_bucket
          WHEN '0-24 hours' THEN 1
          WHEN '24-48 hours' THEN 2
          WHEN '2-7 days' THEN 3
          WHEN '7-30 days' THEN 4
          ELSE 5
        END;
      
      -- Oldest Open Tickets
      SELECT TOP 10
        t.ticket_number,
        t.subject,
        tp.priority_name,
        d.department_name,
        t.created_at,
        DATEDIFF(DAY, t.created_at, GETDATE()) as age_days
      FROM tickets t
      INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
      LEFT JOIN ticket_priorities tp ON t.priority_id = tp.priority_id
      LEFT JOIN departments d ON t.department_id = d.department_id
      WHERE ts.is_final_status = 0 AND (@startDate IS NULL OR t.created_at >= @startDate) AND (@endDate IS NULL OR t.created_at < DATEADD(DAY, 1, @endDate))
      ORDER BY t.created_at ASC;
      
      -- Average Age by Priority
      SELECT 
        tp.priority_name,
        tp.priority_level,
        AVG(DATEDIFF(HOUR, t.created_at, GETDATE())) as avg_age_hours,
        COUNT(t.ticket_id) as ticket_count
      FROM ticket_priorities tp
      LEFT JOIN tickets t ON tp.priority_id = t.priority_id
      INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
      WHERE ISNULL(tp.is_active, 1) = 1 AND ts.is_final_status = 0 AND (@startDate IS NULL OR t.created_at >= @startDate) AND (@endDate IS NULL OR t.created_at < DATEADD(DAY, 1, @endDate))
      GROUP BY tp.priority_name, tp.priority_level
      ORDER BY tp.priority_level DESC;
    `;

    const result = await executeQuery(query, params);

    const ageDistribution = result.recordsets[0];
    const oldestTickets = result.recordsets[1];
    const avgByPriority = result.recordsets[2];

    const data = {
      age_distribution: ageDistribution,
      oldest_tickets: oldestTickets.map(t => ({
        ...t,
        created_at: t.created_at,
      })),
      avg_by_priority: avgByPriority.map(p => ({
        priority_name: p.priority_name,
        avg_age_hours: Math.round(p.avg_age_hours || 0),
        ticket_count: p.ticket_count,
      })),
    };

    logger.success('Ticket aging analysis fetched successfully');

    return res.status(200).json(
      createResponse(true, 'Ticket aging analysis fetched successfully', data)
    );
  } catch (error) {
    logger.error('Get ticket aging error', error);
    next(error);
  }
};

/**
 * Get time-based patterns (hourly/daily)
 * @route GET /api/v1/analytics/time-patterns
 * @access Private (Admin/Manager)
 */
const getTimePatterns = async (req, res, next) => {
  try {
    const { days = 30 } = req.query;

    logger.info('Fetching time patterns', { userId: req.user.user_id, days });

    const safeDays = parseInt(days) || 30;

    const query = `
      -- Hourly Distribution
      SELECT 
        DATEPART(HOUR, created_at) as hour,
        COUNT(*) as ticket_count
      FROM tickets
      WHERE created_at >= DATEADD(DAY, -@days, GETDATE())
      GROUP BY DATEPART(HOUR, created_at)
      ORDER BY hour;
      
      -- Day of Week Distribution
      SELECT 
        DATENAME(WEEKDAY, created_at) as day_name,
        DATEPART(WEEKDAY, created_at) as day_number,
        COUNT(*) as ticket_count
      FROM tickets
      WHERE created_at >= DATEADD(DAY, -@days, GETDATE())
      GROUP BY DATENAME(WEEKDAY, created_at), DATEPART(WEEKDAY, created_at)
      ORDER BY day_number;
    `;

    const result = await executeQuery(query, { days: safeDays });

    const hourly = result.recordsets[0];
    const daily = result.recordsets[1];

    // Find peak hours
    const sortedHourly = [...hourly].sort((a, b) => b.ticket_count - a.ticket_count);
    const peakHour = sortedHourly[0];

    const data = {
      hourly_distribution: hourly,
      daily_distribution: daily,
      peak_hour: peakHour ? {
        hour: peakHour.hour,
        ticket_count: peakHour.ticket_count,
        formatted_time: `${peakHour.hour}:00 - ${peakHour.hour + 1}:00`,
      } : null,
    };

    logger.success('Time patterns fetched successfully');

    return res.status(200).json(
      createResponse(true, 'Time patterns fetched successfully', data)
    );
  } catch (error) {
    logger.error('Get time patterns error', error);
    next(error);
  }
};

/**
 * Get agent performance metrics
 * @route GET /api/v1/analytics/agent-performance
 * @access Private (Admin/Manager)
 */
const getAgentPerformance = async (req, res, next) => {
  try {
    const { start_date, end_date, limit = 20 } = req.query;

    logger.info('Fetching agent performance', { userId: req.user.user_id });

    const hasDateRange = start_date && end_date;
    const safeLimit = parseInt(limit) || 20;
    const params = {
      startDate: hasDateRange ? start_date : null,
      endDate: hasDateRange ? end_date : null,
    };

    const query = `
      SELECT TOP (${safeLimit})
        u.user_id,
        u.first_name + ' ' + u.last_name as agent_name,
        r.role_name,
        d.department_name,
        
        -- Workload
        COUNT(t.ticket_id) as total_assigned,
        SUM(CASE WHEN ts.is_final_status = 0 THEN 1 ELSE 0 END) as currently_open,
        SUM(CASE WHEN ts.is_final_status = 1 THEN 1 ELSE 0 END) as tickets_resolved,
        
        -- Performance
        CAST(SUM(CASE WHEN ts.is_final_status = 1 THEN 1 ELSE 0 END) AS FLOAT) / NULLIF(COUNT(t.ticket_id), 0) * 100 as resolution_rate,
        AVG(CASE WHEN ts.is_final_status = 1 AND (t.closed_at IS NOT NULL OR t.resolved_at IS NOT NULL)
          THEN DATEDIFF(HOUR, t.created_at, COALESCE(t.closed_at, t.resolved_at))
          ELSE NULL 
        END) as avg_resolution_hours,
        
        -- SLA (computed dynamically)
        CAST(SUM(CASE WHEN t.first_response_at IS NOT NULL 
          AND DATEDIFF(MINUTE, t.created_at, t.first_response_at) <= tp.response_time_hours * 60 
          THEN 1 END) AS FLOAT) 
          / NULLIF(SUM(CASE WHEN t.first_response_at IS NOT NULL THEN 1 END), 0) * 100 as first_response_sla_percent,
        CAST(SUM(CASE WHEN (t.resolved_at IS NOT NULL OR t.closed_at IS NOT NULL) 
          AND DATEDIFF(MINUTE, t.created_at, COALESCE(t.closed_at, t.resolved_at)) <= tp.resolution_time_hours * 60 
          THEN 1 END) AS FLOAT) 
          / NULLIF(SUM(CASE WHEN t.resolved_at IS NOT NULL OR t.closed_at IS NOT NULL THEN 1 END), 0) * 100 as resolution_sla_percent,
        
        -- CSAT
        AVG(CAST(t.rating AS FLOAT)) as avg_csat,
        COUNT(t.rating) as rating_count
        
      FROM users u
      INNER JOIN user_roles r ON u.role_id = r.role_id
      LEFT JOIN departments d ON u.department_id = d.department_id
      LEFT JOIN tickets t ON u.user_id = t.assigned_to AND (@startDate IS NULL OR t.created_at >= @startDate) AND (@endDate IS NULL OR t.created_at < DATEADD(DAY, 1, @endDate))
      LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
      LEFT JOIN ticket_priorities tp ON t.priority_id = tp.priority_id
      WHERE u.is_active = 1 
        AND r.role_code IN ('ENGINEER', 'MANAGER', 'ADMIN')
      GROUP BY u.user_id, u.first_name, u.last_name, r.role_name, d.department_name
      HAVING COUNT(t.ticket_id) > 0
      ORDER BY tickets_resolved DESC, resolution_rate DESC
    `;

    const result = await executeQuery(query, params);

    const agents = result.recordset.map(agent => ({
      ...agent,
      resolution_rate: Math.round(agent.resolution_rate || 0),
      avg_resolution_hours: Math.round(agent.avg_resolution_hours || 0),
      first_response_sla_percent: Math.round(agent.first_response_sla_percent || 0),
      resolution_sla_percent: Math.round(agent.resolution_sla_percent || 0),
      avg_csat: Math.round((agent.avg_csat || 0) * 10) / 10,
    }));

    logger.success('Agent performance fetched successfully');

    return res.status(200).json(
      createResponse(true, 'Agent performance fetched successfully', agents)
    );
  } catch (error) {
    logger.error('Get agent performance error', error);
    next(error);
  }
};

/**
 * Get tickets by location
 * @route GET /api/v1/analytics/by-location
 */
const getByLocation = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    const hasDateRange = start_date && end_date;
    const params = {
      startDate: hasDateRange ? start_date : null,
      endDate: hasDateRange ? end_date : null,
    };

    const query = `
      SELECT
        l.location_id,
        l.location_name,
        l.location_code,
        COUNT(t.ticket_id) AS total_tickets,
        SUM(CASE WHEN ts.is_final_status = 0 THEN 1 ELSE 0 END) AS open_tickets,
        SUM(CASE WHEN ts.is_final_status = 1 THEN 1 ELSE 0 END) AS closed_tickets,
        SUM(CASE WHEN t.is_escalated = 1 THEN 1 ELSE 0 END) AS escalated_tickets
      FROM locations l
      LEFT JOIN tickets t ON l.location_id = t.location_id
        AND (@startDate IS NULL OR t.created_at >= @startDate)
        AND (@endDate IS NULL OR t.created_at < DATEADD(DAY, 1, @endDate))
      LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
      WHERE ISNULL(l.is_active, 1) = 1
      GROUP BY l.location_id, l.location_name, l.location_code
      ORDER BY total_tickets DESC
    `;

    const result = await executeQuery(query, params);
    return res.status(200).json(
      createResponse(true, 'Location analytics fetched successfully', result.recordset)
    );
  } catch (error) {
    logger.error('Get by location error', error);
    next(error);
  }
};

/**
 * Get tickets by process
 * @route GET /api/v1/analytics/by-process
 */
const getByProcess = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    const hasDateRange = start_date && end_date;
    const params = {
      startDate: hasDateRange ? start_date : null,
      endDate: hasDateRange ? end_date : null,
    };

    const query = `
      SELECT
        p.process_id,
        p.process_name,
        p.process_code,
        COUNT(t.ticket_id) AS total_tickets,
        SUM(CASE WHEN ts.is_final_status = 0 THEN 1 ELSE 0 END) AS open_tickets,
        SUM(CASE WHEN ts.is_final_status = 1 THEN 1 ELSE 0 END) AS closed_tickets,
        SUM(CASE WHEN t.is_escalated = 1 THEN 1 ELSE 0 END) AS escalated_tickets
      FROM processes p
      LEFT JOIN tickets t ON p.process_id = t.process_id
        AND (@startDate IS NULL OR t.created_at >= @startDate)
        AND (@endDate IS NULL OR t.created_at < DATEADD(DAY, 1, @endDate))
      LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
      WHERE ISNULL(p.is_active, 1) = 1
      GROUP BY p.process_id, p.process_name, p.process_code
      ORDER BY total_tickets DESC
    `;

    const result = await executeQuery(query, params);
    return res.status(200).json(
      createResponse(true, 'Process analytics fetched successfully', result.recordset)
    );
  } catch (error) {
    logger.error('Get by process error', error);
    next(error);
  }
};

/**
 * Get bot activity summary analytics
 * @route GET /api/v1/analytics/bot
 * @access Private (Admin/Manager)
 */
const getBotAnalytics = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    const hasDateRange = start_date && end_date;
    const params = {
      startDate: hasDateRange ? start_date : null,
      endDate: hasDateRange ? end_date : null,
    };

    const query = `
      -- Overall bot session stats
      SELECT
        COUNT(*) AS total_sessions,
        SUM(ISNULL(total_messages, 0)) AS total_messages,
        SUM(ISNULL(tickets_created, 0)) AS tickets_created,
        SUM(ISNULL(intents_matched, 0)) AS intents_matched,
        ROUND(AVG(CAST(ISNULL(total_messages, 0) AS FLOAT)), 1) AS avg_msgs_per_session,
        COUNT(CASE WHEN is_active = 1 THEN 1 END) AS active_sessions
      FROM bot_chat_sessions
      WHERE (@startDate IS NULL OR started_at >= @startDate)
        AND (@endDate IS NULL OR started_at < DATEADD(DAY, 1, @endDate));

      -- Daily session volume
      SELECT
        CAST(started_at AS DATE) AS session_date,
        COUNT(*) AS session_count,
        SUM(ISNULL(tickets_created, 0)) AS tickets_created,
        SUM(ISNULL(total_messages, 0)) AS total_messages
      FROM bot_chat_sessions
      WHERE (@startDate IS NULL OR started_at >= @startDate)
        AND (@endDate IS NULL OR started_at < DATEADD(DAY, 1, @endDate))
      GROUP BY CAST(started_at AS DATE)
      ORDER BY session_date;

      -- Top intents (from bot messages)
      SELECT TOP 10
        ISNULL(intent_matched, '(no intent)') AS intent_name,
        COUNT(*) AS match_count
      FROM bot_chat_messages
      WHERE message_type = 'user'
        AND (@startDate IS NULL OR created_at >= @startDate)
        AND (@endDate IS NULL OR created_at < DATEADD(DAY, 1, @endDate))
      GROUP BY intent_matched
      ORDER BY match_count DESC;
    `;

    const result = await executeQuery(query, params);

    const overview = result.recordsets[0][0] || {};
    const daily = result.recordsets[1] || [];
    const topIntents = result.recordsets[2] || [];

    return res.status(200).json(
      createResponse(true, 'Bot analytics fetched successfully', {
        overview: {
          total_sessions: overview.total_sessions || 0,
          total_messages: overview.total_messages || 0,
          tickets_created: overview.tickets_created || 0,
          intents_matched: overview.intents_matched || 0,
          avg_msgs_per_session: overview.avg_msgs_per_session || 0,
          active_sessions: overview.active_sessions || 0,
        },
        daily,
        top_intents: topIntents,
      })
    );
  } catch (error) {
    logger.error('Get bot analytics error', error);
    next(error);
  }
};

module.exports = {
  getDashboard,
  getSLAPerformance,
  getCSATMetrics,
  getEscalationAnalytics,
  getTicketAging,
  getTimePatterns,
  getAgentPerformance,
  getByLocation,
  getByProcess,
  getBotAnalytics,
};

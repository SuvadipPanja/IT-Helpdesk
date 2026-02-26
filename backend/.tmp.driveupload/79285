// ============================================
// Analytics Controller
// Handles analytics and reporting data
// ============================================

const { executeQuery } = require('../config/database');
const { createResponse } = require('../utils/helpers');
const logger = require('../utils/logger');

/**
 * Get dashboard overview statistics
 * @route GET /api/v1/analytics/overview
 * @access Private (Admin/Manager)
 */
const getOverview = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;

    logger.info('Fetching analytics overview', {
      userId: req.user.user_id,
      startDate: start_date,
      endDate: end_date,
    });

    // Date filter condition
    const dateFilter = start_date && end_date 
      ? `AND t.created_at BETWEEN '${start_date}' AND '${end_date}'`
      : '';

    const query = `
      -- Total Tickets
      SELECT 
        (SELECT COUNT(*) FROM tickets WHERE 1=1 ${dateFilter}) as total_tickets,
        
        -- Open Tickets
        (SELECT COUNT(*) FROM tickets t
         INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
         WHERE ts.is_final_status = 0 ${dateFilter}) as open_tickets,
        
        -- Closed Tickets
        (SELECT COUNT(*) FROM tickets t
         INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
         WHERE ts.is_final_status = 1 ${dateFilter}) as closed_tickets,
        
        -- Average Resolution Time (in hours)
        (SELECT AVG(DATEDIFF(HOUR, t.created_at, COALESCE(t.closed_at, t.resolved_at)))
         FROM tickets t
         INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
         WHERE ts.is_final_status = 1 AND (t.closed_at IS NOT NULL OR t.resolved_at IS NOT NULL) ${dateFilter}) as avg_resolution_hours,
        
        -- Active Users
        (SELECT COUNT(*) FROM users WHERE is_active = 1) as active_users,
        
        -- Active Departments
        (SELECT COUNT(*) FROM departments WHERE is_active = 1) as active_departments,
        
        -- Tickets Created Today
        (SELECT COUNT(*) FROM tickets 
         WHERE CAST(created_at AS DATE) = CAST(GETDATE() AS DATE)) as tickets_today,
        
        -- Tickets Created This Week
        (SELECT COUNT(*) FROM tickets 
         WHERE created_at >= DATEADD(WEEK, -1, GETDATE())) as tickets_this_week,
        
        -- Tickets Created This Month
        (SELECT COUNT(*) FROM tickets 
         WHERE created_at >= DATEADD(MONTH, -1, GETDATE())) as tickets_this_month
    `;

    const result = await executeQuery(query);
    const overview = result.recordset[0];

    // Calculate SLA compliance (assuming 24 hours SLA)
    const slaCompliance = overview.closed_tickets > 0
      ? Math.round(((overview.closed_tickets - (overview.avg_resolution_hours > 24 ? overview.closed_tickets : 0)) / overview.closed_tickets) * 100)
      : 100;

    const data = {
      ...overview,
      avg_resolution_hours: Math.round(overview.avg_resolution_hours || 0),
      sla_compliance: slaCompliance
    };

    logger.success('Analytics overview fetched successfully');

    return res.status(200).json(
      createResponse(true, 'Analytics overview fetched successfully', data)
    );
  } catch (error) {
    logger.error('Get analytics overview error', error);
    next(error);
  }
};

/**
 * Get ticket status distribution
 * @route GET /api/v1/analytics/status-distribution
 * @access Private (Admin/Manager)
 */
const getStatusDistribution = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;

    logger.info('Fetching status distribution', {
      userId: req.user.user_id,
    });

    const dateFilter = start_date && end_date 
      ? `AND t.created_at BETWEEN '${start_date}' AND '${end_date}'`
      : '';

    const query = `
      SELECT 
        ts.status_name,
        COUNT(t.ticket_id) as count,
        ts.color_code
      FROM ticket_statuses ts
      LEFT JOIN tickets t ON ts.status_id = t.status_id ${dateFilter ? 'AND 1=1 ' + dateFilter : ''}
      WHERE ts.is_active = 1
      GROUP BY ts.status_name, ts.color_code
      ORDER BY count DESC
    `;

    const result = await executeQuery(query);

    logger.success('Status distribution fetched successfully', {
      count: result.recordset.length,
    });

    return res.status(200).json(
      createResponse(true, 'Status distribution fetched successfully', result.recordset)
    );
  } catch (error) {
    logger.error('Get status distribution error', error);
    next(error);
  }
};

/**
 * Get tickets by department
 * @route GET /api/v1/analytics/by-department
 * @access Private (Admin/Manager)
 */
const getTicketsByDepartment = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;

    logger.info('Fetching tickets by department', {
      userId: req.user.user_id,
    });

    const dateFilter = start_date && end_date 
      ? `AND t.created_at BETWEEN '${start_date}' AND '${end_date}'`
      : '';

    const query = `
      SELECT 
        d.department_name,
        COUNT(t.ticket_id) as total_tickets,
        SUM(CASE WHEN ts.is_final_status = 0 THEN 1 ELSE 0 END) as open_tickets,
        SUM(CASE WHEN ts.is_final_status = 1 THEN 1 ELSE 0 END) as closed_tickets
      FROM departments d
      LEFT JOIN tickets t ON d.department_id = t.department_id ${dateFilter ? 'AND 1=1 ' + dateFilter : ''}
      LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
      WHERE d.is_active = 1
      GROUP BY d.department_name
      ORDER BY total_tickets DESC
    `;

    const result = await executeQuery(query);

    logger.success('Tickets by department fetched successfully', {
      count: result.recordset.length,
    });

    return res.status(200).json(
      createResponse(true, 'Tickets by department fetched successfully', result.recordset)
    );
  } catch (error) {
    logger.error('Get tickets by department error', error);
    next(error);
  }
};

/**
 * Get tickets by priority
 * @route GET /api/v1/analytics/by-priority
 * @access Private (Admin/Manager)
 */
const getTicketsByPriority = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;

    logger.info('Fetching tickets by priority', {
      userId: req.user.user_id,
    });

    const dateFilter = start_date && end_date 
      ? `AND t.created_at BETWEEN '${start_date}' AND '${end_date}'`
      : '';

    const query = `
      SELECT 
        tp.priority_name,
        COUNT(t.ticket_id) as count,
        tp.color_code
      FROM ticket_priorities tp
      LEFT JOIN tickets t ON tp.priority_id = t.priority_id ${dateFilter ? 'AND 1=1 ' + dateFilter : ''}
      WHERE tp.is_active = 1
      GROUP BY tp.priority_name, tp.priority_level, tp.color_code
      ORDER BY tp.priority_level DESC
    `;

    const result = await executeQuery(query);

    logger.success('Tickets by priority fetched successfully', {
      count: result.recordset.length,
    });

    return res.status(200).json(
      createResponse(true, 'Tickets by priority fetched successfully', result.recordset)
    );
  } catch (error) {
    logger.error('Get tickets by priority error', error);
    next(error);
  }
};

/**
 * Get ticket trends (last 30 days)
 * @route GET /api/v1/analytics/trends
 * @access Private (Admin/Manager)
 */
const getTicketTrends = async (req, res, next) => {
  try {
    const { days = 30 } = req.query;

    logger.info('Fetching ticket trends', {
      userId: req.user.user_id,
      days,
    });

    const query = `
      WITH DateRange AS (
        SELECT CAST(DATEADD(DAY, -${days}, GETDATE()) AS DATE) as start_date,
               CAST(GETDATE() AS DATE) as end_date
      ),
      AllDates AS (
        SELECT CAST(DATEADD(DAY, number, start_date) AS DATE) as date
        FROM master..spt_values, DateRange
        WHERE type = 'P' 
          AND DATEADD(DAY, number, start_date) <= end_date
      )
      SELECT 
        CONVERT(VARCHAR(10), ad.date, 23) as date,
        COALESCE(COUNT(t.ticket_id), 0) as tickets_created,
        COALESCE(SUM(CASE WHEN ts.is_final_status = 1 THEN 1 ELSE 0 END), 0) as tickets_closed
      FROM AllDates ad
      LEFT JOIN tickets t ON CAST(t.created_at AS DATE) = ad.date
      LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
      GROUP BY ad.date
      ORDER BY ad.date
    `;

    const result = await executeQuery(query);

    logger.success('Ticket trends fetched successfully', {
      count: result.recordset.length,
    });

    return res.status(200).json(
      createResponse(true, 'Ticket trends fetched successfully', result.recordset)
    );
  } catch (error) {
    logger.error('Get ticket trends error', error);
    next(error);
  }
};

/**
 * Get top performing engineers
 * @route GET /api/v1/analytics/top-engineers
 * @access Private (Admin/Manager)
 */
const getTopEngineers = async (req, res, next) => {
  try {
    const { start_date, end_date, limit = 10 } = req.query;

    logger.info('Fetching top engineers', {
      userId: req.user.user_id,
    });

    const dateFilter = start_date && end_date 
      ? `AND t.created_at BETWEEN '${start_date}' AND '${end_date}'`
      : '';

    const query = `
      SELECT TOP ${limit}
        u.user_id,
        u.first_name + ' ' + u.last_name as engineer_name,
        r.role_name,
        COUNT(t.ticket_id) as total_assigned,
        SUM(CASE WHEN ts.is_final_status = 1 THEN 1 ELSE 0 END) as tickets_resolved,
        CASE 
          WHEN COUNT(t.ticket_id) > 0 
          THEN CAST(SUM(CASE WHEN ts.is_final_status = 1 THEN 1 ELSE 0 END) AS FLOAT) / COUNT(t.ticket_id) * 100
          ELSE 0 
        END as resolution_rate,
        AVG(CASE 
          WHEN ts.is_final_status = 1 AND (t.closed_at IS NOT NULL OR t.resolved_at IS NOT NULL)
          THEN DATEDIFF(HOUR, t.created_at, COALESCE(t.closed_at, t.resolved_at))
          ELSE NULL 
        END) as avg_resolution_hours
      FROM users u
      INNER JOIN user_roles r ON u.role_id = r.role_id
      LEFT JOIN tickets t ON u.user_id = t.assigned_to ${dateFilter ? 'AND 1=1 ' + dateFilter : ''}
      LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
      WHERE u.is_active = 1 
        AND r.role_code IN ('ENGINEER', 'MANAGER', 'ADMIN')
      GROUP BY u.user_id, u.first_name, u.last_name, r.role_name
      HAVING COUNT(t.ticket_id) > 0
      ORDER BY tickets_resolved DESC, resolution_rate DESC
    `;

    const result = await executeQuery(query);

    // Format the data
    const engineers = result.recordset.map(eng => ({
      ...eng,
      resolution_rate: Math.round(eng.resolution_rate || 0),
      avg_resolution_hours: Math.round(eng.avg_resolution_hours || 0)
    }));

    logger.success('Top engineers fetched successfully', {
      count: engineers.length,
    });

    return res.status(200).json(
      createResponse(true, 'Top engineers fetched successfully', engineers)
    );
  } catch (error) {
    logger.error('Get top engineers error', error);
    next(error);
  }
};

/**
 * Get recent activity
 * @route GET /api/v1/analytics/recent-activity
 * @access Private (Admin/Manager)
 */
const getRecentActivity = async (req, res, next) => {
  try {
    const { limit = 20 } = req.query;

    logger.info('Fetching recent activity', {
      userId: req.user.user_id,
    });

    const query = `
      SELECT TOP ${limit}
        ta.activity_id,
        ta.ticket_id,
        t.ticket_number,
        t.subject,
        ta.activity_type,
        ta.field_name,
        ta.old_value,
        ta.new_value,
        ta.description,
        ta.performed_at,
        ta.performed_by,
        COALESCE(u.first_name + ' ' + u.last_name, 'System') as performed_by_name
      FROM ticket_activities ta
      INNER JOIN tickets t ON ta.ticket_id = t.ticket_id
      LEFT JOIN users u ON ta.performed_by = u.user_id
      ORDER BY ta.performed_at DESC
    `;

    const result = await executeQuery(query);

    logger.success('Recent activity fetched successfully', {
      count: result.recordset.length,
    });

    return res.status(200).json(
      createResponse(true, 'Recent activity fetched successfully', result.recordset)
    );
  } catch (error) {
    logger.error('Get recent activity error', error);
    next(error);
  }
};

/**
 * Get category distribution
 * @route GET /api/v1/analytics/by-category
 * @access Private (Admin/Manager)
 */
const getTicketsByCategory = async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;

    logger.info('Fetching tickets by category', {
      userId: req.user.user_id,
    });

    const dateFilter = start_date && end_date 
      ? `AND t.created_at BETWEEN '${start_date}' AND '${end_date}'`
      : '';

    const query = `
      SELECT 
        tc.category_name,
        COUNT(t.ticket_id) as count
      FROM ticket_categories tc
      LEFT JOIN tickets t ON tc.category_id = t.category_id ${dateFilter ? 'AND 1=1 ' + dateFilter : ''}
      WHERE tc.is_active = 1
      GROUP BY tc.category_name
      ORDER BY count DESC
    `;

    const result = await executeQuery(query);

    logger.success('Tickets by category fetched successfully', {
      count: result.recordset.length,
    });

    return res.status(200).json(
      createResponse(true, 'Tickets by category fetched successfully', result.recordset)
    );
  } catch (error) {
    logger.error('Get tickets by category error', error);
    next(error);
  }
};

module.exports = {
  getOverview,
  getStatusDistribution,
  getTicketsByDepartment,
  getTicketsByPriority,
  getTicketTrends,
  getTopEngineers,
  getRecentActivity,
  getTicketsByCategory,
};
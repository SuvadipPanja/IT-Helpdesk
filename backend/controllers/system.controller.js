// ============================================
// System/Lookup Controller
// Handles system data and lookups for dropdowns
// ============================================

const { executeQuery } = require('../config/database');
const { createResponse } = require('../utils/helpers');
const logger = require('../utils/logger');

/**
 * Get all ticket categories
 * @route GET /api/v1/system/categories
 * @access Private
 */
const getCategories = async (req, res, next) => {
  try {
    logger.try('Fetching ticket categories', {
      userId: req.user?.user_id,
    });

    const query = `
      SELECT 
        category_id,
        category_name,
        category_code,
        description,
        default_priority_id,
        sla_hours,
        is_active,
        display_order
      FROM ticket_categories
      WHERE is_active = 1
      ORDER BY display_order, category_name
    `;

    const result = await executeQuery(query);

    logger.success('Ticket categories fetched successfully', {
      count: result.recordset.length,
    });

    return res.status(200).json(
      createResponse(true, 'Categories fetched successfully', result.recordset)
    );
  } catch (error) {
    logger.error('Get categories error', error);
    next(error);
  }
};

/**
 * Get all ticket priorities
 * @route GET /api/v1/system/priorities
 * @access Private
 */
const getPriorities = async (req, res, next) => {
  try {
    logger.try('Fetching ticket priorities', {
      userId: req.user?.user_id,
    });

    const query = `
      SELECT 
        priority_id,
        priority_name,
        priority_code,
        priority_level,
        color_code,
        response_time_hours,
        resolution_time_hours,
        is_active
      FROM ticket_priorities
      WHERE is_active = 1
      ORDER BY priority_level
    `;

    const result = await executeQuery(query);

    logger.success('Ticket priorities fetched successfully', {
      count: result.recordset.length,
    });

    return res.status(200).json(
      createResponse(true, 'Priorities fetched successfully', result.recordset)
    );
  } catch (error) {
    logger.error('Get priorities error', error);
    next(error);
  }
};

/**
 * Get all ticket statuses
 * @route GET /api/v1/system/statuses
 * @access Private
 */
const getStatuses = async (req, res, next) => {
  try {
    logger.try('Fetching ticket statuses', {
      userId: req.user?.user_id,
    });

    const query = `
      SELECT 
        status_id,
        status_name,
        status_code,
        status_type,
        color_code,
        is_active,
        is_final_status,
        display_order
      FROM ticket_statuses
      WHERE is_active = 1
      ORDER BY display_order
    `;

    const result = await executeQuery(query);

    logger.success('Ticket statuses fetched successfully', {
      count: result.recordset.length,
    });

    return res.status(200).json(
      createResponse(true, 'Statuses fetched successfully', result.recordset)
    );
  } catch (error) {
    logger.error('Get statuses error', error);
    next(error);
  }
};

/**
 * Get all roles
 * @route GET /api/v1/system/roles
 * @access Private
 */
const getRoles = async (req, res, next) => {
  try {
    logger.try('Fetching user roles', {
      userId: req.user?.user_id,
    });

    const query = `
      SELECT 
        role_id,
        role_name,
        role_code,
        description,
        can_create_tickets,
        can_view_all_tickets,
        can_assign_tickets,
        can_close_tickets,
        can_delete_tickets,
        can_manage_users,
        can_manage_departments,
        can_manage_roles,
        can_view_analytics,
        can_manage_system,
        is_active,
        is_system_role
      FROM user_roles
      WHERE is_active = 1
      ORDER BY role_name
    `;

    const result = await executeQuery(query);

    logger.success('User roles fetched successfully', {
      count: result.recordset.length,
    });

    return res.status(200).json(
      createResponse(true, 'Roles fetched successfully', result.recordset)
    );
  } catch (error) {
    logger.error('Get roles error', error);
    next(error);
  }
};

/**
 * Get all departments
 * @route GET /api/v1/system/departments
 * @access Private
 */
const getDepartments = async (req, res, next) => {
  try {
    logger.try('Fetching departments', {
      userId: req.user?.user_id,
    });

    const query = `
      SELECT 
        d.department_id,
        d.department_name,
        d.department_code,
        d.description,
        d.manager_id,
        d.is_active,
        u.first_name + ' ' + u.last_name as manager_name
      FROM departments d
      LEFT JOIN users u ON d.manager_id = u.user_id
      WHERE d.is_active = 1
      ORDER BY d.department_name
    `;

    const result = await executeQuery(query);

    logger.success('Departments fetched successfully', {
      count: result.recordset.length,
    });

    return res.status(200).json(
      createResponse(true, 'Departments fetched successfully', result.recordset)
    );
  } catch (error) {
    logger.error('Get departments error', error);
    next(error);
  }
};

/**
 * Get all engineers (for ticket assignment)
 * @route GET /api/v1/system/engineers
 * @access Private
 */
const getEngineers = async (req, res, next) => {
  try {
    logger.try('Fetching engineers', {
      userId: req.user?.user_id,
    });

    const query = `
      SELECT 
        u.user_id,
        u.username,
        u.email,
        u.first_name + ' ' + u.last_name as full_name,
        r.role_name,
        d.department_name
      FROM users u
      INNER JOIN user_roles r ON u.role_id = r.role_id
      LEFT JOIN departments d ON u.department_id = d.department_id
      WHERE u.is_active = 1 
        AND (r.can_assign_tickets = 1 OR r.role_code IN ('ADMIN', 'MANAGER', 'ENGINEER'))
      ORDER BY u.first_name, u.last_name
    `;

    const result = await executeQuery(query);

    logger.success('Engineers fetched successfully', {
      count: result.recordset.length,
    });

    return res.status(200).json(
      createResponse(true, 'Engineers fetched successfully', result.recordset)
    );
  } catch (error) {
    logger.error('Get engineers error', error);
    next(error);
  }
};

/**
 * Get system settings
 * @route GET /api/v1/system/settings
 * @access Private (Admin only)
 */
const getSettings = async (req, res, next) => {
  try {
    logger.try('Fetching system settings', {
      userId: req.user.user_id,
    });

    const query = `
      SELECT 
        setting_id,
        setting_key,
        setting_value,
        setting_type,
        description,
        is_editable
      FROM system_settings
      ORDER BY setting_key
    `;

    const result = await executeQuery(query);

    logger.success('System settings fetched successfully', {
      count: result.recordset.length,
    });

    return res.status(200).json(
      createResponse(true, 'Settings fetched successfully', result.recordset)
    );
  } catch (error) {
    logger.error('Get settings error', error);
    next(error);
  }
};

/**
 * Get dashboard statistics
 * @route GET /api/v1/system/dashboard-stats
 * @access Private
 */
const getDashboardStats = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const canViewAll = req.user.can_view_all_tickets;

    logger.try('Fetching dashboard statistics', {
      userId,
      canViewAll,
    });

    // Base where clause for ticket filtering
    const whereClause = canViewAll 
      ? '1=1' 
      : `(t.requester_id = ${userId} OR t.assigned_to = ${userId})`;

    const query = `
      -- Total tickets
      SELECT 
        (SELECT COUNT(*) FROM tickets t WHERE ${whereClause}) as total_tickets,
        
        (SELECT COUNT(*) FROM tickets t 
         INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
         WHERE ${whereClause} AND ts.status_type = 'OPEN') as open_tickets,
        
        (SELECT COUNT(*) FROM tickets t 
         INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
         WHERE ${whereClause} AND ts.status_type = 'IN_PROGRESS') as in_progress_tickets,
        
        (SELECT COUNT(*) FROM tickets t 
         INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
         WHERE ${whereClause} AND ts.status_type = 'RESOLVED') as resolved_tickets,
        
        (SELECT COUNT(*) FROM tickets t 
         WHERE ${whereClause} AND t.assigned_to = ${userId}) as assigned_to_me,
        
        (SELECT COUNT(*) FROM tickets t 
         WHERE ${whereClause} AND t.requester_id = ${userId}) as created_by_me,
        
        (SELECT COUNT(*) FROM tickets t 
         INNER JOIN ticket_priorities tp ON t.priority_id = tp.priority_id
         WHERE ${whereClause} AND tp.priority_code = 'CRITICAL') as critical_tickets,
        
        (SELECT COUNT(*) FROM tickets t 
         WHERE ${whereClause} AND t.due_date < GETDATE() 
         AND t.status_id NOT IN (SELECT status_id FROM ticket_statuses WHERE is_final_status = 1)) as overdue_tickets
    `;

    const result = await executeQuery(query);
    const stats = result.recordset[0];

    logger.success('Dashboard statistics fetched successfully', {
      userId,
      totalTickets: stats.total_tickets,
    });

    return res.status(200).json(
      createResponse(true, 'Dashboard stats fetched successfully', stats)
    );
  } catch (error) {
    logger.error('Get dashboard stats error', error);
    next(error);
  }
};

// ============================================
// ✅ NEW FUNCTION FOR SETTINGS PAGE
// Get priorities and categories for Settings dropdown
// ============================================
/**
 * Get lookups for Settings page (priorities + categories)
 * @route GET /api/v1/system/lookups/settings
 * @access Private (Admin only)
 */
const getLookupsForSettings = async (req, res, next) => {
  try {
    logger.try('Fetching lookup data for settings', { 
      userId: req.user?.user_id 
    });

    // Fetch priorities
    const prioritiesQuery = `
      SELECT 
        priority_id,
        priority_name,
        priority_level,
        color_code
      FROM ticket_priorities
      WHERE is_active = 1
      ORDER BY priority_level ASC
    `;

    const prioritiesResult = await executeQuery(prioritiesQuery);
    const priorities = prioritiesResult.recordset;

    // Fetch categories
    const categoriesQuery = `
      SELECT 
        category_id,
        category_name
      FROM ticket_categories
      WHERE is_active = 1
      ORDER BY category_name ASC
    `;

    const categoriesResult = await executeQuery(categoriesQuery);
    const categories = categoriesResult.recordset;

    logger.success('Lookup data fetched successfully', {
      priorities: priorities.length,
      categories: categories.length
    });

    return res.status(200).json(
      createResponse(true, 'Lookups fetched successfully', {
        priorities,
        categories
      })
    );

  } catch (error) {
    logger.error('Error fetching lookup data', error);
    next(error);
  }
};

module.exports = {
  getCategories,
  getPriorities,
  getStatuses,
  getRoles,
  getDepartments,
  getEngineers,
  getSettings,
  getDashboardStats,
  getLookupsForSettings,  // ✅ NEW EXPORT
};
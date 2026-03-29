// ============================================
// System/Lookup Controller
// Handles system data and lookups for dropdowns
// Cached with node-cache for performance
// ============================================

const { executeQuery } = require('../config/database');
const { createResponse } = require('../utils/helpers');
const logger = require('../utils/logger');
const cacheService = require('../services/cache.service');

// Shared fetch functions for cache consistency
const _fetchCategories = async () => {
  const q = `SELECT category_id, category_name, category_code, description, default_priority_id, sla_hours, is_active, display_order FROM ticket_categories WHERE is_active = 1 ORDER BY display_order, category_name`;
  const r = await executeQuery(q);
  return r.recordset;
};
const _fetchPriorities = async () => {
  const q = `SELECT priority_id, priority_name, priority_code, priority_level, color_code, response_time_hours, resolution_time_hours, is_active FROM ticket_priorities WHERE is_active = 1 ORDER BY priority_level`;
  const r = await executeQuery(q);
  return r.recordset;
};

/**
 * Get all ticket categories (cached 30 min)
 * @route GET /api/v1/system/categories
 * @access Private
 */
const getCategories = async (req, res, next) => {
  try {
    const data = await cacheService.getOrSet(cacheService.KEYS.CATEGORIES, _fetchCategories);

    return res.status(200).json(
      createResponse(true, 'Categories fetched successfully', data)
    );
  } catch (error) {
    logger.error('Get categories error', error);
    next(error);
  }
};

/**
 * Get all ticket priorities (cached 30 min)
 * @route GET /api/v1/system/priorities
 * @access Private
 */
const getPriorities = async (req, res, next) => {
  try {
    const data = await cacheService.getOrSet(cacheService.KEYS.PRIORITIES, _fetchPriorities);

    return res.status(200).json(
      createResponse(true, 'Priorities fetched successfully', data)
    );
  } catch (error) {
    logger.error('Get priorities error', error);
    next(error);
  }
};

/**
 * Get all ticket statuses (cached 30 min)
 * @route GET /api/v1/system/statuses
 * @access Private
 */
const getStatuses = async (req, res, next) => {
  try {
    const data = await cacheService.getOrSet(cacheService.KEYS.STATUSES, async () => {
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
      return result.recordset;
    });

    return res.status(200).json(
      createResponse(true, 'Statuses fetched successfully', data)
    );
  } catch (error) {
    logger.error('Get statuses error', error);
    next(error);
  }
};

/**
 * Get all roles (cached 30 min)
 * @route GET /api/v1/system/roles
 * @access Private
 */
const getRoles = async (req, res, next) => {
  try {
    const data = await cacheService.getOrSet(cacheService.KEYS.ROLES, async () => {
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
      return result.recordset;
    });

    return res.status(200).json(
      createResponse(true, 'Roles fetched successfully', data)
    );
  } catch (error) {
    logger.error('Get roles error', error);
    next(error);
  }
};

/**
 * Get all departments (cached 30 min)
 * @route GET /api/v1/system/departments
 * @access Private
 */
const getDepartments = async (req, res, next) => {
  try {
    const data = await cacheService.getOrSet(cacheService.KEYS.DEPARTMENTS, async () => {
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
      return result.recordset;
    });

    return res.status(200).json(
      createResponse(true, 'Departments fetched successfully', data)
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
    logger.try('Fetching assignable engineers', {
      userId: req.user?.user_id,
    });

    const autoAssignmentService = require('../services/autoAssignment.service');
    const engineers = await autoAssignmentService.getAssignableUsers();

    logger.success('Assignable engineers fetched successfully', {
      count: engineers.length,
    });

    return res.status(200).json(
      createResponse(true, 'Engineers fetched successfully', engineers)
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

    // Base where clause for ticket filtering - parameterized
    const params = {};
    let whereClause;
    if (canViewAll) {
      whereClause = '1=1';
    } else {
      whereClause = '(t.requester_id = @userId OR t.assigned_to = @userId)';
      params.userId = userId;
    }

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
         WHERE ${whereClause} AND t.assigned_to = @currentUserId) as assigned_to_me,
        
        (SELECT COUNT(*) FROM tickets t 
         WHERE ${whereClause} AND t.requester_id = @currentUserId) as created_by_me,
        
        (SELECT COUNT(*) FROM tickets t 
         INNER JOIN ticket_priorities tp ON t.priority_id = tp.priority_id
         WHERE ${whereClause} AND tp.priority_code = 'CRITICAL') as critical_tickets,
        
        (SELECT COUNT(*) FROM tickets t 
         WHERE ${whereClause} AND t.due_date < GETDATE() 
         AND t.status_id NOT IN (SELECT status_id FROM ticket_statuses WHERE is_final_status = 1)) as overdue_tickets
    `;

    params.currentUserId = userId;

    const result = await executeQuery(query, params);
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
    const [prioritiesFull, categoriesFull, teamsResult] = await Promise.all([
      cacheService.getOrSet(cacheService.KEYS.PRIORITIES, _fetchPriorities),
      cacheService.getOrSet(cacheService.KEYS.CATEGORIES, _fetchCategories),
      executeQuery('SELECT team_id, team_name, is_central FROM teams WHERE is_active = 1 ORDER BY is_central DESC, team_name'),
    ]);

    const priorities = prioritiesFull.map((p) => ({
      priority_id: p.priority_id,
      priority_name: p.priority_name,
      priority_level: p.priority_level,
      color_code: p.color_code,
    }));
    const categories = categoriesFull.map((c) => ({
      category_id: c.category_id,
      category_name: c.category_name,
    }));
    const teams = teamsResult.recordset.map((t) => ({
      team_id: t.team_id,
      team_name: t.team_name,
      is_central: t.is_central,
    }));

    return res.status(200).json(
      createResponse(true, 'Lookups fetched successfully', {
        priorities,
        categories,
        teams,
      })
    );
  } catch (error) {
    logger.error('Error fetching lookup data', error);
    next(error);
  }
};

// ============================================
// Sub-Categories by Category
// ============================================
/**
 * Get sub-categories for a given category
 * @route GET /api/v1/system/sub-categories/:categoryId
 * @access Private
 */
const getSubCategories = async (req, res, next) => {
  try {
    const { categoryId } = req.params;
    const key = cacheService.KEYS.SUBCATEGORIES(categoryId);

    const data = await cacheService.getOrSet(key, async () => {
      const query = `
        SELECT 
          sub_category_id,
          category_id,
          sub_category_name,
          description,
          display_order,
          is_active
        FROM ticket_sub_categories
        WHERE category_id = @categoryId AND is_active = 1
        ORDER BY display_order, sub_category_name
      `;
      const result = await executeQuery(query, { categoryId });
      return result.recordset;
    }, 15 * 60);

    return res.status(200).json(
      createResponse(true, 'Sub-categories fetched successfully', data)
    );
  } catch (error) {
    logger.error('Get sub-categories error', error);
    next(error);
  }
};

/**
 * Get custom fields for a sub-category
 * @route GET /api/v1/system/sub-category-fields/:subCategoryId
 * @access Private
 */
const getSubCategoryFields = async (req, res, next) => {
  try {
    const { subCategoryId } = req.params;
    const key = cacheService.KEYS.SUBCAT_FIELDS(subCategoryId);

    const data = await cacheService.getOrSet(key, async () => {
      const query = `
        SELECT 
          field_id,
          sub_category_id,
          field_name,
          field_label,
          field_type,
          is_required,
          placeholder,
          options,
          display_order,
          is_active
        FROM ticket_sub_category_fields
        WHERE sub_category_id = @subCategoryId AND is_active = 1
        ORDER BY display_order
      `;
      const result = await executeQuery(query, { subCategoryId });
      return result.recordset.map((f) => ({
        ...f,
        options: f.options ? JSON.parse(f.options) : null,
      }));
    }, 15 * 60);

    return res.status(200).json(
      createResponse(true, 'Sub-category fields fetched successfully', data)
    );
  } catch (error) {
    logger.error('Get sub-category fields error', error);
    next(error);
  }
};

/**
 * Get all active locations (cached 30 min)
 * @route GET /api/v1/system/locations
 * @access Private
 */
const getLocations = async (req, res, next) => {
  try {
    const data = await cacheService.getOrSet(cacheService.KEYS.LOCATIONS, async () => {
      const query = `
        SELECT 
          location_id,
          location_name,
          location_code,
          address,
          is_active,
          display_order
        FROM locations
        WHERE is_active = 1
        ORDER BY display_order, location_name
      `;
      const result = await executeQuery(query);
      return result.recordset;
    });

    return res.status(200).json(
      createResponse(true, 'Locations fetched successfully', data)
    );
  } catch (error) {
    logger.error('Get locations error', error);
    next(error);
  }
};

/**
 * Get all active processes/clients (cached 30 min)
 * @route GET /api/v1/system/processes
 * @access Private
 */
const getProcesses = async (req, res, next) => {
  try {
    const data = await cacheService.getOrSet(cacheService.KEYS.PROCESSES, async () => {
      const query = `
        SELECT 
          process_id,
          process_name,
          process_code,
          description,
          is_active,
          display_order
        FROM processes
        WHERE is_active = 1
        ORDER BY display_order, process_name
      `;
      const result = await executeQuery(query);
      return result.recordset;
    });

    return res.status(200).json(
      createResponse(true, 'Processes fetched successfully', data)
    );
  } catch (error) {
    logger.error('Get processes error', error);
    next(error);
  }
};

// ============================================
// Get Active Teams (for ticket create/edit dropdowns)
// ============================================
const getTeamsLookup = async (req, res, next) => {
  try {
    const result = await executeQuery(
      `SELECT team_id, team_name, team_code, is_central
       FROM teams WHERE is_active = 1
       ORDER BY is_central DESC, team_name`
    );
    return res.status(200).json(
      createResponse(true, 'Teams fetched successfully', result.recordset)
    );
  } catch (error) {
    logger.error('Error fetching teams lookup', error);
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
  getLookupsForSettings,
  getSubCategories,
  getSubCategoryFields,
  getLocations,
  getProcesses,
  getTeamsLookup,
};
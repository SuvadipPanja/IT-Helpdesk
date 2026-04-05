// ============================================
// CR Auto-Assignment Service
// Handles intelligent CR assignment to engineers
// Mirrors ticket autoAssignment.service.js
// Supports: Round Robin, Load Balanced, Department Based, Location Wise
// ============================================

const { executeQuery } = require('../config/database');
const settingsService = require('./settings.service');
const logger = require('../utils/logger');

// Assignable role codes — only these roles can receive auto-assigned CRs
const ASSIGNABLE_ROLES = ['ENGINEER'];

// Roles that can appear in manual assignment dropdown
const MANUAL_ASSIGNABLE_ROLES = ['ENGINEER', 'MANAGER', 'ADMIN'];

class CRAutoAssignmentService {

  /**
   * Get CR auto-assignment settings from DB
   */
  async getSettings() {
    try {
      const crSettings = await settingsService.getByCategory('cr');

      const enabled = crSettings.cr_auto_assignment === 'true'
        || crSettings.cr_auto_assignment === true;

      const method = crSettings.cr_assignment_method || 'round_robin';
      const scope = crSettings.cr_auto_assignment_scope || 'direct';

      return {
        enabled,
        method,
        scope,
        assignableRoles: ASSIGNABLE_ROLES,
      };
    } catch (error) {
      logger.error('Failed to load CR auto-assignment settings', error);
      return {
        enabled: false,
        method: 'round_robin',
        scope: 'direct',
        assignableRoles: ASSIGNABLE_ROLES,
      };
    }
  }

  /**
   * Get CR central team routing settings
   */
  async getCentralTeamSettings() {
    try {
      const crSettings = await settingsService.getByCategory('cr');
      return {
        enabled: crSettings.cr_central_team_enabled === 'true' || crSettings.cr_central_team_enabled === true,
        teamId: crSettings.cr_central_team_id ? parseInt(crSettings.cr_central_team_id) : null,
        mode: crSettings.cr_central_team_mode || 'always',
      };
    } catch (error) {
      logger.error('Failed to load CR central team settings', error);
      return { enabled: false, teamId: null, mode: 'always' };
    }
  }

  /**
   * Find the best engineer to assign a CR to
   * @param {Object} options
   * @param {number} options.departmentId
   * @param {number} options.locationId
   * @returns {Object|null} { user_id, email, full_name } or null
   */
  async findEngineer({ departmentId = null, locationId = null } = {}) {
    try {
      const settings = await this.getSettings();

      if (!settings.enabled) {
        logger.debug('CR auto-assignment is disabled');
        return null;
      }

      // If scope is team_first, don't auto-assign (goes to bucket)
      if (settings.scope === 'team_first') {
        logger.debug('CR assignment scope is team_first — skipping auto-assign');
        return null;
      }

      logger.try(`Finding engineer for CR using method: ${settings.method}`, { departmentId });

      let engineer = null;

      switch (settings.method) {
        case 'round_robin':
          engineer = await this._roundRobin(departmentId);
          break;
        case 'load_balanced':
        case 'least_loaded':
          engineer = await this._loadBalanced(departmentId);
          break;
        case 'department':
          engineer = await this._departmentBased(departmentId);
          break;
        case 'location_wise':
          engineer = await this._locationWise(locationId);
          break;
        default:
          logger.warn(`Unknown CR assignment method: ${settings.method}, falling back to round_robin`);
          engineer = await this._roundRobin(departmentId);
          break;
      }

      if (engineer) {
        logger.success('Engineer found for CR auto-assignment', {
          method: settings.method,
          engineerId: engineer.user_id,
          engineerName: engineer.full_name,
        });
      } else {
        logger.warn('No eligible engineer found for CR auto-assignment', { method: settings.method, departmentId });
      }

      return engineer;
    } catch (error) {
      logger.error('CR auto-assignment findEngineer failed', error);
      return null;
    }
  }

  /**
   * Round Robin — assigns to the engineer least recently assigned a CR
   */
  async _roundRobin(departmentId) {
    const roleFilter = ASSIGNABLE_ROLES.map((_, i) => `@role${i}`).join(', ');
    const roleParams = {};
    ASSIGNABLE_ROLES.forEach((role, i) => { roleParams[`role${i}`] = role; });

    if (departmentId) {
      const query = `
        SELECT TOP 1 
          u.user_id, u.email, 
          ISNULL(u.first_name, '') + ' ' + ISNULL(u.last_name, '') as full_name,
          r.role_code
        FROM users u
        INNER JOIN user_roles r ON u.role_id = r.role_id
        WHERE r.role_code IN (${roleFilter})
          AND u.is_active = 1
          AND u.department_id = @departmentId
        ORDER BY 
          ISNULL(
            (SELECT MAX(cr.created_at) FROM change_requests cr WHERE cr.assigned_to = u.user_id),
            '1900-01-01'
          ) ASC,
          u.user_id ASC
      `;
      const result = await executeQuery(query, { ...roleParams, departmentId });
      if (result.recordset.length > 0) return result.recordset[0];
      logger.debug('No engineer in target department for CR, trying all departments');
    }

    const fallbackQuery = `
      SELECT TOP 1 
        u.user_id, u.email, 
        ISNULL(u.first_name, '') + ' ' + ISNULL(u.last_name, '') as full_name,
        r.role_code
      FROM users u
      INNER JOIN user_roles r ON u.role_id = r.role_id
      WHERE r.role_code IN (${roleFilter})
        AND u.is_active = 1
      ORDER BY 
        ISNULL(
          (SELECT MAX(cr.created_at) FROM change_requests cr WHERE cr.assigned_to = u.user_id),
          '1900-01-01'
        ) ASC,
        u.user_id ASC
    `;
    const result = await executeQuery(fallbackQuery, roleParams);
    return result.recordset.length > 0 ? result.recordset[0] : null;
  }

  /**
   * Load Balanced — assigns to the engineer with the fewest open CRs
   */
  async _loadBalanced(departmentId) {
    const roleFilter = ASSIGNABLE_ROLES.map((_, i) => `@role${i}`).join(', ');
    const roleParams = {};
    ASSIGNABLE_ROLES.forEach((role, i) => { roleParams[`role${i}`] = role; });

    if (departmentId) {
      const query = `
        SELECT TOP 1 
          u.user_id, u.email, 
          ISNULL(u.first_name, '') + ' ' + ISNULL(u.last_name, '') as full_name,
          r.role_code,
          COUNT(cr.cr_id) as open_cr_count
        FROM users u
        INNER JOIN user_roles r ON u.role_id = r.role_id
        LEFT JOIN change_requests cr ON u.user_id = cr.assigned_to 
          AND cr.cr_status_id IN (SELECT status_id FROM cr_statuses WHERE is_final_status = 0)
        WHERE r.role_code IN (${roleFilter})
          AND u.is_active = 1
          AND u.department_id = @departmentId
        GROUP BY u.user_id, u.email, u.first_name, u.last_name, r.role_code
        ORDER BY COUNT(cr.cr_id) ASC, u.user_id ASC
      `;
      const result = await executeQuery(query, { ...roleParams, departmentId });
      if (result.recordset.length > 0) return result.recordset[0];
      logger.debug('No engineer in target department for CR, trying all departments');
    }

    const fallbackQuery = `
      SELECT TOP 1 
        u.user_id, u.email, 
        ISNULL(u.first_name, '') + ' ' + ISNULL(u.last_name, '') as full_name,
        r.role_code,
        COUNT(cr.cr_id) as open_cr_count
      FROM users u
      INNER JOIN user_roles r ON u.role_id = r.role_id
      LEFT JOIN change_requests cr ON u.user_id = cr.assigned_to 
        AND cr.cr_status_id IN (SELECT status_id FROM cr_statuses WHERE is_final_status = 0)
      WHERE r.role_code IN (${roleFilter})
        AND u.is_active = 1
      GROUP BY u.user_id, u.email, u.first_name, u.last_name, r.role_code
      ORDER BY COUNT(cr.cr_id) ASC, u.user_id ASC
    `;
    const result = await executeQuery(fallbackQuery, roleParams);
    return result.recordset.length > 0 ? result.recordset[0] : null;
  }

  /**
   * Department Based — strictly assigns within the CR's department only
   */
  async _departmentBased(departmentId) {
    if (!departmentId) {
      logger.warn('Department-based CR assignment requires a department_id, falling back to load_balanced');
      return this._loadBalanced(departmentId);
    }

    const roleFilter = ASSIGNABLE_ROLES.map((_, i) => `@role${i}`).join(', ');
    const roleParams = {};
    ASSIGNABLE_ROLES.forEach((role, i) => { roleParams[`role${i}`] = role; });

    const query = `
      SELECT TOP 1 
        u.user_id, u.email, 
        ISNULL(u.first_name, '') + ' ' + ISNULL(u.last_name, '') as full_name,
        r.role_code,
        COUNT(cr.cr_id) as open_cr_count
      FROM users u
      INNER JOIN user_roles r ON u.role_id = r.role_id
      LEFT JOIN change_requests cr ON u.user_id = cr.assigned_to 
        AND cr.cr_status_id IN (SELECT status_id FROM cr_statuses WHERE is_final_status = 0)
      WHERE r.role_code IN (${roleFilter})
        AND u.is_active = 1
        AND u.department_id = @departmentId
      GROUP BY u.user_id, u.email, u.first_name, u.last_name, r.role_code
      ORDER BY COUNT(cr.cr_id) ASC, u.user_id ASC
    `;
    const result = await executeQuery(query, { ...roleParams, departmentId });
    return result.recordset.length > 0 ? result.recordset[0] : null;
  }

  /**
   * Location Wise — assigns to the engineer at the same location with fewest open CRs
   */
  async _locationWise(locationId) {
    if (!locationId) {
      logger.warn('Location-wise CR assignment requires a location_id, falling back to load_balanced');
      return this._loadBalanced(null);
    }

    const roleFilter = ASSIGNABLE_ROLES.map((_, i) => `@role${i}`).join(', ');
    const roleParams = {};
    ASSIGNABLE_ROLES.forEach((role, i) => { roleParams[`role${i}`] = role; });

    const query = `
      SELECT TOP 1 
        u.user_id, u.email, 
        ISNULL(u.first_name, '') + ' ' + ISNULL(u.last_name, '') as full_name,
        r.role_code,
        COUNT(cr.cr_id) as open_cr_count
      FROM users u
      INNER JOIN user_roles r ON u.role_id = r.role_id
      LEFT JOIN change_requests cr ON u.user_id = cr.assigned_to 
        AND cr.cr_status_id IN (SELECT status_id FROM cr_statuses WHERE is_final_status = 0)
      WHERE r.role_code IN (${roleFilter})
        AND u.is_active = 1
        AND u.location_id = @locationId
      GROUP BY u.user_id, u.email, u.first_name, u.last_name, r.role_code
      ORDER BY COUNT(cr.cr_id) ASC, u.user_id ASC
    `;

    const result = await executeQuery(query, { ...roleParams, locationId });
    if (result.recordset.length > 0) return result.recordset[0];

    logger.debug('No engineer at location for CR, falling back to load_balanced', { locationId });
    return this._loadBalanced(null);
  }

  /**
   * Get list of users eligible for manual CR assignment
   */
  async getAssignableUsers(departmentId = null) {
    try {
      const roleFilter = MANUAL_ASSIGNABLE_ROLES.map((_, i) => `@role${i}`).join(', ');
      const params = {};
      MANUAL_ASSIGNABLE_ROLES.forEach((role, i) => { params[`role${i}`] = role; });

      const query = `
        SELECT 
          u.user_id,
          u.username,
          u.email,
          ISNULL(u.first_name, '') + ' ' + ISNULL(u.last_name, '') as full_name,
          r.role_name,
          r.role_code,
          d.department_name,
          u.department_id,
          (SELECT COUNT(*) FROM change_requests cr 
           INNER JOIN cr_statuses cs ON cr.cr_status_id = cs.status_id 
           WHERE cr.assigned_to = u.user_id AND cs.is_final_status = 0) as open_crs
        FROM users u
        INNER JOIN user_roles r ON u.role_id = r.role_id
        LEFT JOIN departments d ON u.department_id = d.department_id
        WHERE u.is_active = 1 
          AND r.role_code IN (${roleFilter})
          ${departmentId ? 'AND u.department_id = @departmentId' : ''}
        ORDER BY r.role_code, u.first_name, u.last_name
      `;

      if (departmentId) params.departmentId = departmentId;

      const result = await executeQuery(query, params);
      return result.recordset;
    } catch (error) {
      logger.error('Failed to get assignable users for CR', error);
      return [];
    }
  }

  /**
   * Validate if a user is eligible to be assigned a CR
   */
  async validateAssignee(userId) {
    try {
      const query = `
        SELECT 
          u.user_id, u.is_active, u.username,
          ISNULL(u.first_name, '') + ' ' + ISNULL(u.last_name, '') as full_name,
          r.role_code
        FROM users u
        INNER JOIN user_roles r ON u.role_id = r.role_id
        WHERE u.user_id = @userId
      `;
      const result = await executeQuery(query, { userId });

      if (!result.recordset.length) {
        return { valid: false, reason: 'User not found' };
      }

      const user = result.recordset[0];
      if (!user.is_active) {
        return { valid: false, reason: 'User account is inactive', user };
      }

      if (!MANUAL_ASSIGNABLE_ROLES.includes(user.role_code)) {
        return { valid: false, reason: `Role "${user.role_code}" cannot be assigned CRs`, user };
      }

      return { valid: true, user };
    } catch (error) {
      logger.error('Failed to validate CR assignee', error);
      return { valid: false, reason: 'Validation error' };
    }
  }
}

module.exports = new CRAutoAssignmentService();


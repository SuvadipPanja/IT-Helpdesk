// ============================================
// Auto-Assignment Service
// Handles intelligent ticket assignment to engineers
// Supports: Round Robin, Load Balanced, Department Based
// ============================================

const { executeQuery } = require('../config/database');
const settingsService = require('./settings.service');
const logger = require('../utils/logger');

// Assignable role codes — only these roles can receive auto-assigned tickets
const ASSIGNABLE_ROLES = ['ENGINEER'];

// Roles that can appear in manual assignment dropdown
const MANUAL_ASSIGNABLE_ROLES = ['ENGINEER', 'MANAGER', 'ADMIN'];

class AutoAssignmentService {

  /**
   * Get auto-assignment settings from DB
   * @returns {Object} { enabled, method, assignableRoles }
   */
  async getSettings() {
    try {
      const ticketSettings = await settingsService.getByCategory('ticket');
      
      const enabled = ticketSettings.ticket_auto_assignment === 'true' 
        || ticketSettings.ticket_auto_assignment === true;
      
      const method = ticketSettings.ticket_assignment_method || 'round_robin';

      return {
        enabled,
        method,
        assignableRoles: ASSIGNABLE_ROLES,
      };
    } catch (error) {
      logger.error('Failed to load auto-assignment settings', error);
      return {
        enabled: false,
        method: 'round_robin',
        assignableRoles: ASSIGNABLE_ROLES,
      };
    }
  }

  /**
   * Find the best engineer to assign a ticket to
   * @param {Object} options
   * @param {number} options.departmentId - Target department (optional)
   * @param {number} options.priorityId - Ticket priority (optional)
   * @param {number} options.categoryId - Ticket category (optional)
   * @param {number} options.locationId - Ticket location (optional, for location_wise)
   * @returns {Object|null} { user_id, email, full_name } or null
   */
  async findEngineer({ departmentId = null, priorityId = null, categoryId = null, locationId = null } = {}) {
    try {
      const settings = await this.getSettings();
      
      if (!settings.enabled) {
        logger.debug('Auto-assignment is disabled');
        return null;
      }

      logger.try(`Finding engineer using method: ${settings.method}`, { departmentId, priorityId });

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

        case 'skill_based':
          engineer = await this._skillBased(categoryId, departmentId);
          break;

        default:
          logger.warn(`Unknown assignment method: ${settings.method}, falling back to round_robin`);
          engineer = await this._roundRobin(departmentId);
          break;
      }

      if (engineer) {
        logger.success(`Engineer found for auto-assignment`, {
          method: settings.method,
          engineerId: engineer.user_id,
          engineerName: engineer.full_name,
        });
      } else {
        logger.warn('No eligible engineer found for auto-assignment', {
          method: settings.method,
          departmentId,
        });
      }

      return engineer;
    } catch (error) {
      logger.error('Auto-assignment findEngineer failed', error);
      return null;
    }
  }

  /**
   * Round Robin — assigns to the engineer who was least recently assigned
   * True round-robin based on last assignment timestamp, not total count
   */
  async _roundRobin(departmentId) {
    // Build role filter
    const roleFilter = ASSIGNABLE_ROLES.map((_, i) => `@role${i}`).join(', ');
    const roleParams = {};
    ASSIGNABLE_ROLES.forEach((role, i) => { roleParams[`role${i}`] = role; });

    // Try department-specific first
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
            (SELECT MAX(t.created_at) FROM tickets t WHERE t.assigned_to = u.user_id),
            '1900-01-01'
          ) ASC,
          u.user_id ASC
      `;

      const result = await executeQuery(query, { ...roleParams, departmentId });
      if (result.recordset.length > 0) {
        return result.recordset[0];
      }

      logger.debug('No engineer in target department, trying all departments');
    }

    // Fallback: any active engineer across all departments
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
          (SELECT MAX(t.created_at) FROM tickets t WHERE t.assigned_to = u.user_id),
          '1900-01-01'
        ) ASC,
        u.user_id ASC
    `;

    const result = await executeQuery(fallbackQuery, roleParams);
    return result.recordset.length > 0 ? result.recordset[0] : null;
  }

  /**
   * Load Balanced — assigns to the engineer with the fewest OPEN tickets
   */
  async _loadBalanced(departmentId) {
    const roleFilter = ASSIGNABLE_ROLES.map((_, i) => `@role${i}`).join(', ');
    const roleParams = {};
    ASSIGNABLE_ROLES.forEach((role, i) => { roleParams[`role${i}`] = role; });

    // Try department-specific first
    if (departmentId) {
      const query = `
        SELECT TOP 1 
          u.user_id, u.email, 
          ISNULL(u.first_name, '') + ' ' + ISNULL(u.last_name, '') as full_name,
          r.role_code,
          COUNT(t.ticket_id) as open_ticket_count
        FROM users u
        INNER JOIN user_roles r ON u.role_id = r.role_id
        LEFT JOIN tickets t ON u.user_id = t.assigned_to 
          AND t.status_id IN (SELECT status_id FROM ticket_statuses WHERE is_final_status = 0)
        WHERE r.role_code IN (${roleFilter})
          AND u.is_active = 1
          AND u.department_id = @departmentId
        GROUP BY u.user_id, u.email, u.first_name, u.last_name, r.role_code
        ORDER BY COUNT(t.ticket_id) ASC, u.user_id ASC
      `;

      const result = await executeQuery(query, { ...roleParams, departmentId });
      if (result.recordset.length > 0) {
        return result.recordset[0];
      }

      logger.debug('No engineer in target department, trying all departments');
    }

    // Fallback: any active engineer
    const fallbackQuery = `
      SELECT TOP 1 
        u.user_id, u.email, 
        ISNULL(u.first_name, '') + ' ' + ISNULL(u.last_name, '') as full_name,
        r.role_code,
        COUNT(t.ticket_id) as open_ticket_count
      FROM users u
      INNER JOIN user_roles r ON u.role_id = r.role_id
      LEFT JOIN tickets t ON u.user_id = t.assigned_to 
        AND t.status_id IN (SELECT status_id FROM ticket_statuses WHERE is_final_status = 0)
      WHERE r.role_code IN (${roleFilter})
        AND u.is_active = 1
      GROUP BY u.user_id, u.email, u.first_name, u.last_name, r.role_code
      ORDER BY COUNT(t.ticket_id) ASC, u.user_id ASC
    `;

    const result = await executeQuery(fallbackQuery, roleParams);
    return result.recordset.length > 0 ? result.recordset[0] : null;
  }

  /**
   * Department Based — strictly assigns within the ticket's department only
   * Does NOT fall back to other departments
   */
  async _departmentBased(departmentId) {
    if (!departmentId) {
      logger.warn('Department-based assignment requires a department_id, falling back to load_balanced');
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
        COUNT(t.ticket_id) as open_ticket_count
      FROM users u
      INNER JOIN user_roles r ON u.role_id = r.role_id
      LEFT JOIN tickets t ON u.user_id = t.assigned_to 
        AND t.status_id IN (SELECT status_id FROM ticket_statuses WHERE is_final_status = 0)
      WHERE r.role_code IN (${roleFilter})
        AND u.is_active = 1
        AND u.department_id = @departmentId
      GROUP BY u.user_id, u.email, u.first_name, u.last_name, r.role_code
      ORDER BY COUNT(t.ticket_id) ASC, u.user_id ASC
    `;

    const result = await executeQuery(query, { ...roleParams, departmentId });
    return result.recordset.length > 0 ? result.recordset[0] : null;
  }

  /**
   * Location Wise — assigns to the engineer at the same location with fewest OPEN tickets
   * Only considers active engineers at the ticket's location
   * Falls back to load balanced if no engineer found at the location
   */
  async _locationWise(locationId) {
    if (!locationId) {
      logger.warn('Location-wise assignment requires a location_id, falling back to load_balanced');
      return this._loadBalanced(null);
    }

    const roleFilter = ASSIGNABLE_ROLES.map((_, i) => `@role${i}`).join(', ');
    const roleParams = {};
    ASSIGNABLE_ROLES.forEach((role, i) => { roleParams[`role${i}`] = role; });

    // Find engineer at the same location with fewest open tickets
    const query = `
      SELECT TOP 1 
        u.user_id, u.email, 
        ISNULL(u.first_name, '') + ' ' + ISNULL(u.last_name, '') as full_name,
        r.role_code,
        COUNT(t.ticket_id) as open_ticket_count
      FROM users u
      INNER JOIN user_roles r ON u.role_id = r.role_id
      LEFT JOIN tickets t ON u.user_id = t.assigned_to 
        AND t.status_id IN (SELECT status_id FROM ticket_statuses WHERE is_final_status = 0)
      WHERE r.role_code IN (${roleFilter})
        AND u.is_active = 1
        AND u.location_id = @locationId
      GROUP BY u.user_id, u.email, u.first_name, u.last_name, r.role_code
      ORDER BY COUNT(t.ticket_id) ASC, u.user_id ASC
    `;

    const result = await executeQuery(query, { ...roleParams, locationId });
    
    if (result.recordset.length > 0) {
      logger.success('Location-wise engineer found', {
        locationId,
        engineerId: result.recordset[0].user_id,
        openTickets: result.recordset[0].open_ticket_count,
      });
      return result.recordset[0];
    }

    // Fallback: no engineer at that location, try load balanced across all
    logger.debug('No engineer at location, falling back to load_balanced', { locationId });
    return this._loadBalanced(null);
  }

  /**
   * Skill-Based — matches engineer by category/skill rules, falls back to load-balanced.
   * Requires assignmentRules table to be populated via the Assignment Rules settings page.
   */
  async _skillBased(categoryId, departmentId) {
    try {
      const assignmentRules = require('./assignmentRules.service');
      const match = await assignmentRules.findEngineerByRules({ categoryId });

      if (match?.user_id) {
        // Direct user assignment from a matching rule
        logger.success('Skill-based assignment: rule matched a specific user', {
          userId: match.user_id,
          categoryId,
        });
        return { user_id: match.user_id, email: match.email, full_name: match.full_name };
      }

      // No rule matched — fall back to load-balanced for the department
      logger.debug('Skill-based: no rule matched, falling back to load_balanced', { categoryId });
      return this._loadBalanced(departmentId);
    } catch (err) {
      logger.error('Skill-based assignment error', err);
      return this._loadBalanced(departmentId);
    }
  }

  /**
   * Get list of users eligible for manual ticket assignment
   * Only returns users with roles that can handle tickets (ENGINEER, MANAGER, ADMIN)
   * @param {number} departmentId - Optional filter by department
   * @returns {Array} List of assignable users
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
          (SELECT COUNT(*) FROM tickets t 
           INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id 
           WHERE t.assigned_to = u.user_id AND ts.is_final_status = 0) as open_tickets
        FROM users u
        INNER JOIN user_roles r ON u.role_id = r.role_id
        LEFT JOIN departments d ON u.department_id = d.department_id
        WHERE u.is_active = 1 
          AND r.role_code IN (${roleFilter})
          ${departmentId ? 'AND u.department_id = @departmentId' : ''}
        ORDER BY r.role_code, u.first_name, u.last_name
      `;

      if (departmentId) {
        params.departmentId = departmentId;
      }

      const result = await executeQuery(query, params);
      return result.recordset;
    } catch (error) {
      logger.error('Failed to get assignable users', error);
      return [];
    }
  }

  /**
   * Validate if a user is eligible to be assigned a ticket
   * @param {number} userId - The user_id to validate
   * @returns {Object} { valid: boolean, reason: string, user: Object }
   */
  async validateAssignee(userId) {
    try {
      const query = `
        SELECT 
          u.user_id, u.is_active, u.username,
          ISNULL(u.first_name, '') + ' ' + ISNULL(u.last_name, '') as full_name,
          r.role_code, r.role_name,
          d.department_name
        FROM users u
        INNER JOIN user_roles r ON u.role_id = r.role_id
        LEFT JOIN departments d ON u.department_id = d.department_id
        WHERE u.user_id = @userId
      `;

      const result = await executeQuery(query, { userId });

      if (result.recordset.length === 0) {
        return { valid: false, reason: 'User not found', user: null };
      }

      const user = result.recordset[0];

      if (!user.is_active) {
        return { valid: false, reason: `User "${user.full_name}" is inactive`, user };
      }

      if (!MANUAL_ASSIGNABLE_ROLES.includes(user.role_code)) {
        return { 
          valid: false, 
          reason: `User "${user.full_name}" has role "${user.role_name}" which cannot be assigned tickets. Only ${MANUAL_ASSIGNABLE_ROLES.join(', ')} roles can be assigned tickets.`,
          user 
        };
      }

      return { valid: true, reason: 'User is eligible', user };
    } catch (error) {
      logger.error('Validate assignee failed', error);
      return { valid: false, reason: 'Validation error', user: null };
    }
  }

  /**
   * Reassign open tickets with invalid assignees and optionally assign unassigned open tickets
   * Invalid assignee conditions:
   * - assigned engineer is inactive
   * - assigned user role is not assignable (not ENGINEER)
   * - ticket has department and engineer department no longer matches
   */
  async reassignOpenTickets(options = {}) {
    const {
      includeInvalidAssigned = true,
      includeUnassigned = true,
      limit = 200,
      triggeredBy = 'system',
      dryRun = false,
    } = options;

    const stats = {
      scannedInvalidAssigned: 0,
      scannedUnassigned: 0,
      reassignedFromInvalid: 0,
      assignedFromUnassigned: 0,
      skipped: 0,
      failed: 0,
      details: [],
      dryRun,
      triggeredBy,
    };

    const pushDetail = (ticketId, ticketNumber, action, reason, targetEngineer = null) => {
      stats.details.push({
        ticket_id: ticketId,
        ticket_number: ticketNumber,
        action,
        reason,
        target_engineer_id: targetEngineer?.user_id || null,
        target_engineer_name: targetEngineer?.full_name || null,
      });
    };

    try {
      const roleFilter = ASSIGNABLE_ROLES.map((_, i) => `@role${i}`).join(', ');
      const roleParams = {};
      ASSIGNABLE_ROLES.forEach((role, i) => { roleParams[`role${i}`] = role; });

      if (includeInvalidAssigned) {
        const invalidAssignedQuery = `
          SELECT TOP (@limit)
            t.ticket_id,
            t.ticket_number,
            t.department_id,
            t.priority_id,
            t.category_id,
            t.location_id,
            t.assigned_to,
            u.is_active as assignee_active,
            r.role_code as assignee_role_code,
            u.department_id as assignee_department_id
          FROM tickets t
          INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
          LEFT JOIN users u ON t.assigned_to = u.user_id
          LEFT JOIN user_roles r ON u.role_id = r.role_id
          WHERE ts.is_final_status = 0
            AND t.assigned_to IS NOT NULL
            AND (
              u.user_id IS NULL
              OR u.is_active = 0
              OR ISNULL(r.role_code, '') NOT IN (${roleFilter})
              OR (t.department_id IS NOT NULL AND ISNULL(u.department_id, -1) <> t.department_id)
            )
          ORDER BY t.updated_at ASC, t.ticket_id ASC
        `;

        const invalidResult = await executeQuery(invalidAssignedQuery, {
          ...roleParams,
          limit,
        });

        const invalidTickets = invalidResult.recordset || [];
        stats.scannedInvalidAssigned = invalidTickets.length;

        for (const ticket of invalidTickets) {
          try {
            const engineer = await this.findEngineer({
              departmentId: ticket.department_id || null,
              priorityId: ticket.priority_id || null,
              categoryId: ticket.category_id || null,
              locationId: ticket.location_id || null,
            });

            if (!engineer) {
              stats.skipped++;
              pushDetail(ticket.ticket_id, ticket.ticket_number, 'skipped', 'no_eligible_engineer_found');
              continue;
            }

            if (engineer.user_id === ticket.assigned_to) {
              stats.skipped++;
              pushDetail(ticket.ticket_id, ticket.ticket_number, 'skipped', 'same_assignee_selected', engineer);
              continue;
            }

            if (!dryRun) {
              await executeQuery(
                `UPDATE tickets
                 SET assigned_to = @assignedTo,
                     updated_at = GETDATE()
                 WHERE ticket_id = @ticketId`,
                { assignedTo: engineer.user_id, ticketId: ticket.ticket_id }
              );

              await executeQuery(
                `INSERT INTO ticket_activities
                 (ticket_id, activity_type, field_name, old_value, new_value, description, performed_by)
                 VALUES
                 (@ticketId, 'REASSIGNED', 'assigned_to', @oldValue, @newValue, @description, NULL)`,
                {
                  ticketId: ticket.ticket_id,
                  oldValue: String(ticket.assigned_to),
                  newValue: String(engineer.user_id),
                  description: `Auto-reassigned from invalid assignee to ${engineer.full_name || 'Engineer'} (${triggeredBy})`,
                }
              );
            }

            stats.reassignedFromInvalid++;
            pushDetail(ticket.ticket_id, ticket.ticket_number, dryRun ? 'would_reassign' : 'reassigned', 'invalid_assignee', engineer);
          } catch (err) {
            stats.failed++;
            pushDetail(ticket.ticket_id, ticket.ticket_number, 'failed', err.message);
            logger.error('Failed to reassign invalid-assigned ticket', err);
          }
        }
      }

      if (includeUnassigned) {
        const unassignedQuery = `
          SELECT TOP (@limit)
            t.ticket_id,
            t.ticket_number,
            t.department_id,
            t.priority_id,
            t.category_id,
            t.location_id
          FROM tickets t
          INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
          WHERE ts.is_final_status = 0
            AND t.assigned_to IS NULL
          ORDER BY t.created_at ASC, t.ticket_id ASC
        `;

        const unassignedResult = await executeQuery(unassignedQuery, { limit });
        const unassignedTickets = unassignedResult.recordset || [];
        stats.scannedUnassigned = unassignedTickets.length;

        for (const ticket of unassignedTickets) {
          try {
            const engineer = await this.findEngineer({
              departmentId: ticket.department_id || null,
              priorityId: ticket.priority_id || null,
              categoryId: ticket.category_id || null,
              locationId: ticket.location_id || null,
            });

            if (!engineer) {
              stats.skipped++;
              pushDetail(ticket.ticket_id, ticket.ticket_number, 'skipped', 'no_eligible_engineer_found');
              continue;
            }

            if (!dryRun) {
              await executeQuery(
                `UPDATE tickets
                 SET assigned_to = @assignedTo,
                     updated_at = GETDATE()
                 WHERE ticket_id = @ticketId
                   AND assigned_to IS NULL`,
                { assignedTo: engineer.user_id, ticketId: ticket.ticket_id }
              );

              await executeQuery(
                `INSERT INTO ticket_activities
                 (ticket_id, activity_type, field_name, old_value, new_value, description, performed_by)
                 VALUES
                 (@ticketId, 'ASSIGNED', 'assigned_to', 'Unassigned', @newValue, @description, NULL)`,
                {
                  ticketId: ticket.ticket_id,
                  newValue: String(engineer.user_id),
                  description: `Auto-assigned from unassigned bucket to ${engineer.full_name || 'Engineer'} (${triggeredBy})`,
                }
              );
            }

            stats.assignedFromUnassigned++;
            pushDetail(ticket.ticket_id, ticket.ticket_number, dryRun ? 'would_assign' : 'assigned', 'unassigned_open_ticket', engineer);
          } catch (err) {
            stats.failed++;
            pushDetail(ticket.ticket_id, ticket.ticket_number, 'failed', err.message);
            logger.error('Failed to auto-assign unassigned ticket', err);
          }
        }
      }

      return {
        success: true,
        ...stats,
      };
    } catch (error) {
      logger.error('Reassign open tickets failed', error);
      return {
        success: false,
        ...stats,
        error: error.message,
      };
    }
  }
}

module.exports = new AutoAssignmentService();

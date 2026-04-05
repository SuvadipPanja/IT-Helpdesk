// ============================================
// CR (Change Request) SERVICE
// Business logic for CR number generation, SLA, lookups
// ============================================

const { executeQuery } = require('../config/database');
const logger = require('../utils/logger');
const settingsService = require('./settings.service');

class CRService {

  /**
   * Generate the next CR number atomically (within a transaction)
   * Format: CR-YYYYMMDD-0001
   */
  async generateCRNumber(transaction, executeInTransactionQuery) {
    const prefix = ((await settingsService.get('cr_number_prefix')) || 'CR').toUpperCase().replace(/[^A-Z]/g, '');
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    // Lock to prevent concurrent duplicate numbers
    await executeInTransactionQuery(
      transaction,
      `EXEC sp_getapplock @Resource = 'cr_number_gen', @LockMode = 'Exclusive', @LockOwner = 'Transaction'`,
      {}
    );

    const seqResult = await executeInTransactionQuery(
      transaction,
      `SELECT ISNULL(MAX(CAST(RIGHT(cr_number, 4) AS INT)), 0) + 1 AS next_seq
       FROM change_requests WITH (UPDLOCK, HOLDLOCK)
       WHERE cr_number LIKE @crPrefix`,
      { crPrefix: `${prefix}-${dateStr}-%` }
    );

    const sequence = seqResult.recordset[0].next_seq;
    return `${prefix}-${dateStr}-${String(sequence).padStart(4, '0')}`;
  }

  /**
   * Get the status_id for a given status_code
   */
  async getStatusId(statusCode) {
    const result = await executeQuery(
      `SELECT status_id FROM cr_statuses WHERE status_code = @statusCode AND is_active = 1`,
      { statusCode }
    );
    if (!result.recordset.length) {
      throw new Error(`CR status '${statusCode}' not found`);
    }
    return result.recordset[0].status_id;
  }

  /**
   * Get status code from status_id
   */
  async getStatusCode(statusId) {
    const result = await executeQuery(
      `SELECT status_code FROM cr_statuses WHERE status_id = @statusId`,
      { statusId }
    );
    return result.recordset[0]?.status_code || null;
  }

  /**
   * Get CR type details
   */
  async getTypeById(typeId) {
    const result = await executeQuery(
      `SELECT * FROM cr_types WHERE type_id = @typeId AND is_active = 1`,
      { typeId }
    );
    return result.recordset[0] || null;
  }

  /**
   * Calculate review due date based on CR type SLA
   */
  async calculateReviewDueDate(crTypeId) {
    const crType = await this.getTypeById(crTypeId);
    if (!crType) return null;

    const now = new Date();
    now.setHours(now.getHours() + crType.review_sla_hours);
    return now;
  }

  /**
   * Validate status transition
   */
  isValidTransition(fromCode, toCode) {
    const validTransitions = {
      'DRAFT': ['SUBMITTED', 'CANCELLED'],
      'SUBMITTED': ['UNDER_REVIEW', 'PENDING_APPROVAL', 'CANCELLED'],
      'UNDER_REVIEW': ['PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PENDING_INFO'],
      'PENDING_INFO': ['UNDER_REVIEW', 'PENDING_APPROVAL'],
      'PENDING_APPROVAL': ['APPROVED', 'REJECTED', 'CANCELLED', 'SUBMITTED', 'PENDING_INFO'],
      'APPROVED': ['SCHEDULED', 'IN_PROGRESS', 'CANCELLED'],
      'REJECTED': ['SUBMITTED'],
      'SCHEDULED': ['IN_PROGRESS', 'CANCELLED'],
      'IN_PROGRESS': ['IMPLEMENTED', 'ROLLED_BACK', 'CANCELLED'],
      'IMPLEMENTED': ['CLOSED', 'IN_PROGRESS'],
      'ROLLED_BACK': ['CLOSED'],
    };

    const allowed = validTransitions[fromCode] || [];
    return allowed.includes(toCode);
  }

  /**
   * Log a CR activity
   */
  async logActivity(crId, activityType, performedBy, { fieldName, oldValue, newValue, description } = {}) {
    await executeQuery(
      `INSERT INTO cr_activities (cr_id, activity_type, field_name, old_value, new_value, description, performed_by)
       VALUES (@crId, @activityType, @fieldName, @oldValue, @newValue, @description, @performedBy)`,
      {
        crId,
        activityType,
        fieldName: fieldName || null,
        oldValue: oldValue || null,
        newValue: newValue || null,
        description: description || null,
        performedBy,
      }
    );
  }

  /**
   * Check if date falls within a blackout period
   */
  async checkBlackoutPeriod(startDate, endDate) {
    const result = await executeQuery(
      `SELECT blackout_id, title, start_date, end_date 
       FROM cr_blackout_periods 
       WHERE is_active = 1 
         AND start_date <= @endDate 
         AND end_date >= @startDate`,
      { startDate, endDate }
    );
    return result.recordset;
  }

  /**
   * Get all lookup data for the CR form (types, categories, statuses)
   */
  async getLookups() {
    const [statuses, types, categories] = await Promise.all([
      executeQuery(`SELECT status_id, status_name, status_code, color_code, is_final_status, display_order FROM cr_statuses WHERE is_active = 1 ORDER BY display_order`),
      executeQuery(`SELECT type_id, type_name, type_code, description, requires_cab_approval, requires_manager_approval, default_risk_level, review_sla_hours FROM cr_types WHERE is_active = 1`),
      executeQuery(`SELECT c.category_id, c.category_name, c.category_code, c.icon, c.color_code, c.sort_order,
                           s.sub_category_id, s.sub_category_name
                    FROM cr_categories c
                    LEFT JOIN cr_sub_categories s ON c.category_id = s.category_id AND s.is_active = 1
                    WHERE c.is_active = 1
                    ORDER BY c.sort_order, s.sub_category_name`),
    ]);

    // Group sub-categories under their parent category
    const categoryMap = {};
    for (const row of categories.recordset) {
      if (!categoryMap[row.category_id]) {
        categoryMap[row.category_id] = {
          category_id: row.category_id,
          category_name: row.category_name,
          category_code: row.category_code,
          icon: row.icon,
          color_code: row.color_code,
          sort_order: row.sort_order,
          sub_categories: [],
        };
      }
      if (row.sub_category_id) {
        categoryMap[row.category_id].sub_categories.push({
          sub_category_id: row.sub_category_id,
          sub_category_name: row.sub_category_name,
        });
      }
    }

    return {
      statuses: statuses.recordset,
      types: types.recordset,
      categories: Object.values(categoryMap),
    };
  }

  /**
   * Get calendar data: scheduled CRs + blackout periods for a date range
   */
  async getCalendarData(startDate, endDate) {
    const [crs, blackouts] = await Promise.all([
      executeQuery(
        `SELECT cr.cr_id, cr.cr_number, cr.title, cr.priority_id,
                cr.risk_level, cr.scheduled_start, cr.scheduled_end,
                cr.proposed_start, cr.proposed_end,
                cs.status_code, cs.status_name, cs.color_code,
                ct.type_name, ct.type_code,
                u.first_name + ' ' + u.last_name AS requester_name,
                ua.first_name + ' ' + ua.last_name AS assigned_name
         FROM change_requests cr
         INNER JOIN cr_statuses cs ON cr.cr_status_id = cs.status_id
         INNER JOIN cr_types ct ON cr.cr_type_id = ct.type_id
         INNER JOIN users u ON cr.requester_id = u.user_id
         LEFT JOIN users ua ON cr.assigned_to = ua.user_id
         WHERE cs.status_code NOT IN ('CANCELLED','CLOSED')
           AND (
             (cr.scheduled_start IS NOT NULL AND cr.scheduled_start <= @endDate AND ISNULL(cr.scheduled_end, cr.scheduled_start) >= @startDate)
             OR
             (cr.proposed_start IS NOT NULL AND cr.proposed_start <= @endDate AND ISNULL(cr.proposed_end, cr.proposed_start) >= @startDate)
           )
         ORDER BY ISNULL(cr.scheduled_start, cr.proposed_start)`,
        { startDate, endDate }
      ),
      executeQuery(
        `SELECT blackout_id, title, description, start_date, end_date
         FROM cr_blackout_periods
         WHERE is_active = 1
           AND start_date <= @endDate AND end_date >= @startDate
         ORDER BY start_date`,
        { startDate, endDate }
      ),
    ]);

    return {
      events: crs.recordset.map(cr => ({
        id: cr.cr_id,
        cr_number: cr.cr_number,
        title: cr.title,
        start: cr.scheduled_start || cr.proposed_start,
        end: cr.scheduled_end || cr.proposed_end || cr.scheduled_start || cr.proposed_start,
        priority: cr.priority_id,
        risk_level: cr.risk_level,
        status_code: cr.status_code,
        status_name: cr.status_name,
        color: cr.color_code,
        type_name: cr.type_name,
        type_code: cr.type_code,
        requester_name: cr.requester_name,
        assigned_name: cr.assigned_name,
        is_scheduled: !!cr.scheduled_start,
      })),
      blackouts: blackouts.recordset,
    };
  }

  /**
   * Get all blackout periods
   */
  async getBlackouts() {
    const result = await executeQuery(
      `SELECT b.blackout_id, b.title, b.description, b.start_date, b.end_date,
              b.is_active, b.created_at,
              u.first_name + ' ' + u.last_name AS created_by_name
       FROM cr_blackout_periods b
       INNER JOIN users u ON b.created_by = u.user_id
       ORDER BY b.start_date DESC`
    );
    return result.recordset;
  }

  /**
   * Create a blackout period
   */
  async createBlackout(data, userId) {
    const result = await executeQuery(
      `INSERT INTO cr_blackout_periods (title, description, start_date, end_date, created_by)
       OUTPUT INSERTED.blackout_id
       VALUES (@title, @description, @startDate, @endDate, @userId)`,
      {
        title: data.title,
        description: data.description || null,
        startDate: data.start_date,
        endDate: data.end_date,
        userId,
      }
    );
    return result.recordset[0];
  }

  /**
   * Delete a blackout period (soft delete)
   */
  async deleteBlackout(blackoutId) {
    await executeQuery(
      `UPDATE cr_blackout_periods SET is_active = 0 WHERE blackout_id = @blackoutId`,
      { blackoutId }
    );
  }

  /**
   * Log a CR journey step — rich step-by-step tracking
   */
  async logJourney(crId, stepType, performedBy, {
    fromStatus = null, toStatus = null,
    fromUserId = null, toUserId = null,
    summary = '', details = null,
  } = {}) {
    try {
      // Auto-increment step_order
      const orderResult = await executeQuery(
        `SELECT ISNULL(MAX(step_order), 0) + 1 AS next_order FROM cr_journey WHERE cr_id = @crId`,
        { crId }
      );
      const stepOrder = orderResult.recordset[0].next_order;

      await executeQuery(
        `INSERT INTO cr_journey (cr_id, step_order, step_type, from_status, to_status, from_user_id, to_user_id, performed_by, summary, details)
         VALUES (@crId, @stepOrder, @stepType, @fromStatus, @toStatus, @fromUserId, @toUserId, @performedBy, @summary, @details)`,
        {
          crId, stepOrder, stepType,
          fromStatus: fromStatus || null,
          toStatus: toStatus || null,
          fromUserId: fromUserId || null,
          toUserId: toUserId || null,
          performedBy,
          summary: summary || stepType,
          details: details || null,
        }
      );
    } catch (err) {
      logger.error('Failed to log CR journey step', { crId, stepType, err: err.message });
    }
  }

  /**
   * Get journey for a CR
   */
  async getJourney(crId) {
    const result = await executeQuery(
      `SELECT j.*, 
              pb.first_name + ' ' + pb.last_name AS performed_by_name,
              fu.first_name + ' ' + fu.last_name AS from_user_name,
              tu.first_name + ' ' + tu.last_name AS to_user_name
       FROM cr_journey j
       LEFT JOIN users pb ON j.performed_by = pb.user_id
       LEFT JOIN users fu ON j.from_user_id = fu.user_id
       LEFT JOIN users tu ON j.to_user_id = tu.user_id
       WHERE j.cr_id = @crId
       ORDER BY j.step_order ASC`,
      { crId }
    );
    return result.recordset;
  }

  /**
   * Get CR settings from system_settings
   */
  async getCRSettings() {
    return {
      routing_mode: await settingsService.get('cr_routing_mode') || 'tcc_team',
      default_team_id: await settingsService.get('cr_default_team_id') || '',
      auto_assign_on_submit: (await settingsService.get('cr_auto_assign_on_submit')) === 'true',
      allow_approver_select: (await settingsService.get('cr_allow_requester_approver_select')) !== 'false',
      post_approval_routing: await settingsService.get('cr_post_approval_routing') || 'tcc_team',
    };
  }

  /**
   * Get users who can approve CRs (for dropdown)
   */
  async getApprovers() {
    const result = await executeQuery(
      `SELECT u.user_id, u.first_name + ' ' + u.last_name AS full_name, u.email,
              r.role_name, d.department_name
       FROM users u
       INNER JOIN user_roles r ON u.role_id = r.role_id
       LEFT JOIN departments d ON u.department_id = d.department_id
       WHERE u.is_active = 1
         AND r.can_approve_cr = 1
       ORDER BY u.first_name, u.last_name`
    );
    return result.recordset;
  }
}

module.exports = new CRService();

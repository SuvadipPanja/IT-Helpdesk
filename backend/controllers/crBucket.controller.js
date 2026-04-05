/**
 * ============================================
 * CR BUCKET CONTROLLER
 * ============================================
 * Open CR Bucket System for Engineers
 * 
 * PURPOSE:
 * - Engineers can browse unassigned CRs filtered by location
 * - Engineers can self-assign (pick up) CRs from the bucket
 * - Secure: only self-assignment, only unassigned + non-final CRs
 * 
 * SECURITY:
 * - All endpoints require authentication
 * - List/Stats: ENGINEER, ADMIN, MANAGER roles
 * - Self-Assign: ENGINEER only (assigns req.user.user_id)
 * - Cannot assign to another user
 * - Cannot pick up already-assigned CRs
 * - Cannot pick up final-status CRs
 * - Full audit trail via cr_activities
 * ============================================
 */

const { executeQuery } = require('../config/database');
const { createResponse, getPaginationMeta } = require('../utils/helpers');
const logger = require('../utils/logger');
const crService = require('../services/cr.service');

// ============================================
// GET BUCKET CRs (Unassigned, non-final)
// ============================================
const getBucketCRs = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const location_id = req.query.location_id || null;
    const priority_id = req.query.priority_id || null;
    const category_id = req.query.category_id || null;
    const department_id = req.query.department_id || null;
    const offset = (page - 1) * limit;

    // Build WHERE clause — core: unassigned + non-final status + not routed to any team
    let whereConditions = [
      'cr.assigned_to IS NULL',
      'cs.is_final_status = 0',
      'cr.team_id IS NULL'
    ];
    let params = {};

    if (location_id && location_id !== 'all') {
      whereConditions.push('cr.location_id = @locationId');
      params.locationId = parseInt(location_id);
    }

    if (search) {
      whereConditions.push(`(
        cr.cr_number LIKE '%' + @search + '%' OR 
        cr.title LIKE '%' + @search + '%' OR
        cr.description LIKE '%' + @search + '%'
      )`);
      params.search = search;
    }

    if (priority_id) {
      whereConditions.push('cr.priority_id = @priorityId');
      params.priorityId = parseInt(priority_id);
    }

    if (category_id) {
      whereConditions.push('cr.cr_category_id = @categoryId');
      params.categoryId = parseInt(category_id);
    }

    if (department_id) {
      whereConditions.push('cr.department_id = @departmentId');
      params.departmentId = parseInt(department_id);
    }

    const whereClause = 'WHERE ' + whereConditions.join(' AND ');

    // Count total
    const countResult = await executeQuery(`
      SELECT COUNT(*) as total
      FROM change_requests cr
      LEFT JOIN cr_statuses cs ON cr.cr_status_id = cs.status_id
      ${whereClause}
    `, params);
    const totalRecords = countResult.recordset[0].total;

    // Validate sort column
    const allowedSortColumns = ['created_at', 'updated_at', 'cr_number', 'title', 'priority_id', 'cr_status_id'];
    const sortBy = allowedSortColumns.includes(req.query.sortBy) ? req.query.sortBy : 'created_at';
    const sortOrder = req.query.sortOrder === 'ASC' ? 'ASC' : 'DESC';

    // Fetch CRs
    const crsResult = await executeQuery(`
      SELECT 
        cr.cr_id,
        cr.cr_number,
        cr.title,
        cr.description,
        cr.risk_level,
        cr.created_at,
        cr.updated_at,
        cr.submitted_at,

        cc.category_id as cr_category_id,
        cc.category_name,

        tp.priority_id,
        tp.priority_name,
        tp.priority_code,
        tp.color_code as priority_color,

        cs.status_id as cr_status_id,
        cs.status_name,
        cs.status_code,
        cs.color_code as status_color,

        ct.type_name as cr_type_name,

        u_req.user_id as requester_id,
        u_req.first_name + ' ' + u_req.last_name as requester_name,
        u_req.profile_picture as requester_profile_picture,

        d.department_id,
        d.department_name,

        loc.location_id as cr_location_id,
        loc.location_name as cr_location_name

      FROM change_requests cr
      LEFT JOIN cr_categories cc ON cr.cr_category_id = cc.category_id
      LEFT JOIN ticket_priorities tp ON cr.priority_id = tp.priority_id
      LEFT JOIN cr_statuses cs ON cr.cr_status_id = cs.status_id
      LEFT JOIN cr_types ct ON cr.cr_type_id = ct.type_id
      LEFT JOIN users u_req ON cr.requester_id = u_req.user_id
      LEFT JOIN departments d ON cr.department_id = d.department_id
      LEFT JOIN locations loc ON cr.location_id = loc.location_id
      ${whereClause}
      ORDER BY cr.${sortBy} ${sortOrder}
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `, { ...params, offset, limit });

    const paginationMeta = getPaginationMeta(totalRecords, page, limit);

    return res.status(200).json(
      createResponse(true, 'Bucket CRs fetched successfully', {
        change_requests: crsResult.recordset,
        pagination: paginationMeta
      })
    );
  } catch (error) {
    logger.error('Get bucket CRs error', error);
    next(error);
  }
};


// ============================================
// GET BUCKET STATS (Counts by location)
// ============================================
const getBucketStats = async (req, res, next) => {
  try {
    const userId = req.user.user_id;

    // Get engineer's own location
    const userResult = await executeQuery(
      `SELECT location_id FROM users WHERE user_id = @userId`, { userId }
    );
    const userLocationId = userResult.recordset[0]?.location_id || null;

    // Get total counts
    const statsResult = await executeQuery(`
      SELECT 
        COUNT(*) as total_unassigned,
        SUM(CASE WHEN cr.location_id IS NULL THEN 1 ELSE 0 END) as no_location_count
      FROM change_requests cr
      LEFT JOIN cr_statuses cs ON cr.cr_status_id = cs.status_id
      WHERE cr.assigned_to IS NULL
        AND cs.is_final_status = 0
        AND cr.team_id IS NULL
    `, {});
    const totalStats = statsResult.recordset[0];

    // Get per-location breakdown
    const locationStatsResult = await executeQuery(`
      SELECT 
        l.location_id,
        l.location_name,
        COUNT(cr.cr_id) as cr_count
      FROM locations l
      LEFT JOIN change_requests cr ON cr.location_id = l.location_id
        AND cr.assigned_to IS NULL
        AND cr.cr_status_id IN (SELECT status_id FROM cr_statuses WHERE is_final_status = 0)
        AND cr.team_id IS NULL
      WHERE l.is_active = 1
      GROUP BY l.location_id, l.location_name
      ORDER BY l.location_name
    `, {});

    return res.status(200).json(
      createResponse(true, 'Bucket stats fetched successfully', {
        total_unassigned: totalStats.total_unassigned || 0,
        no_location_count: totalStats.no_location_count || 0,
        user_location_id: userLocationId,
        locations: locationStatsResult.recordset
      })
    );
  } catch (error) {
    logger.error('Get bucket stats error', error);
    next(error);
  }
};


// ============================================
// SELF-ASSIGN CR FROM BUCKET
// ============================================
const selfAssignCR = async (req, res, next) => {
  try {
    const crId = parseInt(req.params.id);
    const userId = req.user.user_id;
    const roleCode = req.user.role?.role_code || '';

    // SECURITY: Must be ENGINEER role
    if (roleCode !== 'ENGINEER') {
      return res.status(403).json(
        createResponse(false, 'Only engineers can self-assign CRs from the bucket')
      );
    }

    // Engineer must be active
    const engineerCheck = await executeQuery(
      `SELECT user_id, is_active, first_name + ' ' + last_name as full_name, email, location_id
       FROM users WHERE user_id = @userId`,
      { userId }
    );

    if (!engineerCheck.recordset.length || !engineerCheck.recordset[0].is_active) {
      return res.status(403).json(createResponse(false, 'Your account is not active'));
    }

    const engineer = engineerCheck.recordset[0];

    // CR must exist, be unassigned, and non-final
    const crCheck = await executeQuery(
      `SELECT 
        cr.cr_id, cr.cr_number, cr.title, cr.assigned_to,
        cr.requester_id, cr.department_id, cr.location_id,
        cs.status_code, cs.status_name, cs.is_final_status
      FROM change_requests cr
      LEFT JOIN cr_statuses cs ON cr.cr_status_id = cs.status_id
      WHERE cr.cr_id = @crId`,
      { crId }
    );

    if (!crCheck.recordset.length) {
      return res.status(404).json(createResponse(false, 'Change request not found'));
    }

    const cr = crCheck.recordset[0];

    if (cr.assigned_to !== null) {
      return res.status(409).json(
        createResponse(false, 'This CR has already been assigned to another engineer. Please refresh the bucket.')
      );
    }

    if (cr.is_final_status) {
      return res.status(400).json(
        createResponse(false, `Cannot pick up a CR with status "${cr.status_name}"`)
      );
    }

    // RACE CONDITION PROTECTION
    const updateResult = await executeQuery(
      `UPDATE change_requests
       SET assigned_to = @userId,
           updated_at = GETDATE()
       WHERE cr_id = @crId
         AND assigned_to IS NULL
         AND cr_status_id IN (SELECT status_id FROM cr_statuses WHERE is_final_status = 0)`,
      { crId, userId }
    );

    if (updateResult.rowsAffected[0] === 0) {
      return res.status(409).json(
        createResponse(false, 'This CR was just picked up by another engineer. Please refresh the bucket.')
      );
    }

    // AUDIT TRAIL
    await executeQuery(`
      INSERT INTO cr_activities (cr_id, activity_type, field_name, old_value, new_value, description, performed_by)
      VALUES (@crId, 'SELF_ASSIGNED', 'assigned_to', 'Unassigned', @engineerName, @description, @userId)
    `, {
      crId,
      engineerName: engineer.full_name?.trim() || 'Engineer',
      description: `${engineer.full_name?.trim() || 'Engineer'} picked up CR #${cr.cr_number} from the open bucket`,
      userId,
    });

    // Journey log
    crService.logJourney(crId, 'SELF_ASSIGNED', userId, {
      summary: `${engineer.full_name?.trim()} picked up from bucket`,
    }).catch(err => logger.error('Journey log error', err));

    // Notifications
    try {
      if (cr.requester_id && cr.requester_id !== userId) {
        await executeQuery(`
          INSERT INTO notifications (user_id, notification_type, title, message, related_ticket_id)
          VALUES (@requesterId, 'CR_ASSIGNED', 'Your CR Has Been Picked Up',
                  'CR #' + @crNumber + ' - ' + @title + ' has been picked up by ' + @engineerName,
                  NULL)
        `, {
          requesterId: cr.requester_id,
          crNumber: cr.cr_number,
          title: cr.title,
          engineerName: engineer.full_name?.trim() || 'Engineer',
        });
      }
    } catch (notifError) {
      logger.warn('Notification failed for CR bucket self-assign', { crId, error: notifError.message });
    }

    logger.success('CR self-assigned from bucket', {
      crId,
      crNumber: cr.cr_number,
      engineerId: userId,
    });

    return res.status(200).json(
      createResponse(true, `CR #${cr.cr_number} has been assigned to you successfully`, {
        cr_id: crId,
        cr_number: cr.cr_number,
        assigned_to: userId,
        assigned_to_name: engineer.full_name?.trim(),
      })
    );
  } catch (error) {
    logger.error('CR bucket self-assign error', error);
    next(error);
  }
};


module.exports = {
  getBucketCRs,
  getBucketStats,
  selfAssignCR,
};


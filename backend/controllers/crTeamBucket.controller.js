/**
 * ============================================
 * CR TEAM BUCKET CONTROLLER
 * ============================================
 * Team-scoped CR queue.
 *
 * How it works:
 *   1. When a CR is submitted it may be routed to the Central CR Team.
 *   2. Central team (TCC) members can view CRs, and forward them to another team.
 *   3. Specialist team members see only CRs routed to their team.
 *   4. Engineers can self-assign a CR from their team bucket.
 *   5. ADMIN/MANAGER can see any team bucket.
 *
 * Developer: Suvadip Panja
 * Company: Digitide
 * ============================================
 */

const { executeQuery } = require('../config/database');
const { createResponse, getPaginationMeta } = require('../utils/helpers');
const logger = require('../utils/logger');
const crService = require('../services/cr.service');

// ==============================================================
// HELPERS
// ==============================================================
async function resolveUserTeamAccess(userId, roleCode, requestedTeamId) {
  const isAdmin = roleCode === 'ADMIN' || roleCode === 'MANAGER' || roleCode === 'CENTRAL_MGMT';

  if (isAdmin) {
    return { allowedTeamId: requestedTeamId || null, isCentral: false, isAdmin: true };
  }

  const memberResult = await executeQuery(
    `SELECT tm.team_id, t.is_central
     FROM team_members tm
     INNER JOIN teams t ON tm.team_id = t.team_id
     WHERE tm.user_id = @userId AND tm.is_active = 1 AND t.is_active = 1`,
    { userId }
  );

  if (!memberResult.recordset.length) {
    return { allowedTeamId: null, isCentral: false, isAdmin: false, noTeam: true };
  }

  if (requestedTeamId) {
    const belongs = memberResult.recordset.find(r => r.team_id === requestedTeamId);
    if (!belongs) return { allowedTeamId: null, noTeam: true, isAdmin: false };
    return { allowedTeamId: requestedTeamId, isCentral: !!belongs.is_central, isAdmin: false };
  }

  const central = memberResult.recordset.find(r => r.is_central);
  const team = central || memberResult.recordset[0];
  return { allowedTeamId: team.team_id, isCentral: !!team.is_central, isAdmin: false };
}

// ==============================================================
// GET CR TEAM BUCKET ITEMS
// ==============================================================
const getCRTeamBucketItems = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const roleCode = req.user.role?.role_code || '';
    const requestedTeamId = req.query.team_id ? parseInt(req.query.team_id) : null;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const status = req.query.status || null;
    const risk_level = req.query.risk_level || null;

    const access = await resolveUserTeamAccess(userId, roleCode, requestedTeamId);

    if (access.noTeam) {
      return res.status(200).json(
        createResponse(true, 'You are not assigned to any team', {
          change_requests: [],
          pagination: getPaginationMeta(0, page, limit),
          team: null,
        })
      );
    }

    let whereConditions = [
      'cr.assigned_to IS NULL',
      'cs.is_final_status = 0',
    ];
    let params = {};

    if (access.allowedTeamId !== null) {
      whereConditions.push('cr.team_id = @teamId');
      params.teamId = access.allowedTeamId;
    } else {
      // Admin global view — show all team-routed CRs
      whereConditions.push('cr.team_id IS NOT NULL');
    }

    if (search) {
      whereConditions.push(`(cr.cr_number LIKE '%' + @search + '%' OR cr.title LIKE '%' + @search + '%')`);
      params.search = search;
    }
    if (status) { whereConditions.push('cs.status_code = @status'); params.status = status; }
    if (risk_level) { whereConditions.push('cr.risk_level = @riskLevel'); params.riskLevel = risk_level; }

    const whereClause = 'WHERE ' + whereConditions.join(' AND ');

    const countResult = await executeQuery(
      `SELECT COUNT(*) AS total FROM change_requests cr
       LEFT JOIN cr_statuses cs ON cr.cr_status_id = cs.status_id
       ${whereClause}`,
      params
    );
    const totalRecords = countResult.recordset[0].total;

    const allowedSort = ['created_at', 'updated_at', 'cr_number', 'title', 'risk_level'];
    const sortBy = allowedSort.includes(req.query.sortBy) ? req.query.sortBy : 'created_at';
    const sortOrder = req.query.sortOrder === 'ASC' ? 'ASC' : 'DESC';

    const crsResult = await executeQuery(
      `SELECT
        cr.cr_id, cr.cr_number, cr.title, cr.risk_level,
        cr.proposed_start, cr.proposed_end,
        cr.created_at, cr.updated_at,
        cr.team_id, cr.requester_id,

        cs.status_id, cs.status_name, cs.status_code, cs.color_code AS status_color,
        ct.type_id, ct.type_name, ct.type_code,
        cc.category_name,
        tp.priority_name,

        req.first_name + ' ' + req.last_name AS requester_name,
        req.profile_picture AS requester_profile_picture,
        d.department_name,

        -- Team info
        tm_t.team_name, tm_t.team_code, tm_t.is_central,

        -- Who routed it (from last TEAM_ROUTED journey entry)
        (SELECT TOP 1 pb.first_name + ' ' + pb.last_name
         FROM cr_journey j INNER JOIN users pb ON j.performed_by = pb.user_id
         WHERE j.cr_id = cr.cr_id AND j.step_type = 'TEAM_ROUTED'
         ORDER BY j.step_order DESC) AS routed_by_name

       FROM change_requests cr
       LEFT JOIN cr_statuses cs ON cr.cr_status_id = cs.status_id
       LEFT JOIN cr_types ct ON cr.cr_type_id = ct.type_id
       LEFT JOIN cr_categories cc ON cr.cr_category_id = cc.category_id
       LEFT JOIN ticket_priorities tp ON cr.priority_id = tp.priority_id
       LEFT JOIN users req ON cr.requester_id = req.user_id
       LEFT JOIN departments d ON cr.department_id = d.department_id
       LEFT JOIN teams tm_t ON cr.team_id = tm_t.team_id
       ${whereClause}
       ORDER BY cr.${sortBy} ${sortOrder}
       OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
      { ...params, offset, limit }
    );

    let teamInfo = null;
    if (access.allowedTeamId) {
      const teamResult = await executeQuery(
        'SELECT team_id, team_name, team_code, is_central FROM teams WHERE team_id = @teamId',
        { teamId: access.allowedTeamId }
      );
      teamInfo = teamResult.recordset[0] || null;
    }

    return res.status(200).json(
      createResponse(true, 'CR team bucket fetched', {
        change_requests: crsResult.recordset,
        pagination: getPaginationMeta(totalRecords, page, limit),
        team: teamInfo,
      })
    );
  } catch (error) {
    logger.error('getCRTeamBucketItems error', error);
    next(error);
  }
};

// ==============================================================
// GET CR TEAM BUCKET STATS
// ==============================================================
const getCRTeamBucketStats = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const roleCode = req.user.role?.role_code || '';
    const isAdmin = roleCode === 'ADMIN' || roleCode === 'MANAGER' || roleCode === 'CENTRAL_MGMT';

    const allTeamsStats = await executeQuery(`
      SELECT
        tm.team_id,
        tm.team_name,
        tm.team_code,
        tm.is_central,
        (
          SELECT COUNT(*)
          FROM change_requests cr
          LEFT JOIN cr_statuses cs ON cr.cr_status_id = cs.status_id
          WHERE cr.team_id = tm.team_id
            AND cr.assigned_to IS NULL
            AND cs.is_final_status = 0
        ) AS unassigned_count
      FROM teams tm
      WHERE tm.is_active = 1
      ORDER BY tm.is_central DESC, tm.team_name
    `);

    const myTeams = await executeQuery(
      `SELECT tm.team_id, t.team_name, t.team_code, t.is_central
       FROM team_members tm
       INNER JOIN teams t ON tm.team_id = t.team_id
       WHERE tm.user_id = @userId AND tm.is_active = 1 AND t.is_active = 1`,
      { userId }
    );

    const allRows = (allTeamsStats.recordset || []).map(row => ({
      ...row,
      unassigned_count: Number.isFinite(Number(row.unassigned_count)) ? Number(row.unassigned_count) : 0,
    }));

    const filteredTeams = isAdmin
      ? allRows
      : allRows.filter(t => myTeams.recordset.some(m => m.team_id === t.team_id));

    return res.status(200).json(
      createResponse(true, 'CR team bucket stats fetched', {
        all_teams: filteredTeams,
        my_teams: myTeams.recordset,
      })
    );
  } catch (error) {
    logger.error('getCRTeamBucketStats error', error);
    next(error);
  }
};

// ==============================================================
// SELF-ASSIGN FROM CR TEAM BUCKET
// ==============================================================
const selfAssignFromCRTeamBucket = async (req, res, next) => {
  try {
    const crId = parseInt(req.params.id);
    const userId = req.user.user_id;
    const roleCode = req.user.role?.role_code || '';

    if (roleCode !== 'ENGINEER') {
      return res.status(403).json(createResponse(false, 'Only engineers can self-assign CRs from the bucket'));
    }

    // Verify engineer
    const engineerResult = await executeQuery(
      `SELECT user_id, is_active, first_name + ' ' + last_name AS full_name FROM users WHERE user_id = @userId`,
      { userId }
    );
    if (!engineerResult.recordset.length || !engineerResult.recordset[0].is_active) {
      return res.status(403).json(createResponse(false, 'Your account is not active'));
    }
    const engineer = engineerResult.recordset[0];

    // Fetch CR
    const crResult = await executeQuery(
      `SELECT cr.cr_id, cr.cr_number, cr.title, cr.assigned_to, cr.team_id, cr.requester_id,
              cs.status_code, cs.is_final_status
       FROM change_requests cr
       LEFT JOIN cr_statuses cs ON cr.cr_status_id = cs.status_id
       WHERE cr.cr_id = @crId`,
      { crId }
    );
    if (!crResult.recordset.length) return res.status(404).json(createResponse(false, 'CR not found'));
    const cr = crResult.recordset[0];

    if (cr.assigned_to !== null) return res.status(409).json(createResponse(false, 'CR already assigned. Please refresh.'));
    if (cr.is_final_status) return res.status(400).json(createResponse(false, 'Cannot pick up a closed CR'));

    // Verify engineer belongs to this CR's team
    if (cr.team_id) {
      const memberCheck = await executeQuery(
        `SELECT 1 AS ok FROM team_members WHERE team_id = @teamId AND user_id = @userId AND is_active = 1`,
        { teamId: cr.team_id, userId }
      );
      if (!memberCheck.recordset.length) {
        return res.status(403).json(createResponse(false, 'You are not a member of the team that owns this CR'));
      }
    }

    // Atomic assignment
    const updateResult = await executeQuery(
      `UPDATE change_requests SET assigned_to = @userId, updated_at = GETDATE()
       WHERE cr_id = @crId AND assigned_to IS NULL`,
      { crId, userId }
    );
    if (updateResult.rowsAffected[0] === 0) {
      return res.status(409).json(createResponse(false, 'CR was just picked up by another engineer. Please refresh.'));
    }

    // Audit trail
    await crService.logActivity(crId, 'CR_ASSIGNED', userId, {
      fieldName: 'assigned_to',
      oldValue: 'Unassigned',
      newValue: engineer.full_name,
      description: `${engineer.full_name} picked up CR ${cr.cr_number} from team bucket`,
    });

    crService.logJourney(crId, 'ASSIGNED', userId, {
      toUserId: userId,
      summary: `Auto → ${engineer.full_name} (picked up from team bucket)`,
    }).catch(() => {});

    return res.status(200).json(createResponse(true, `CR ${cr.cr_number} picked up successfully!`));
  } catch (error) {
    logger.error('selfAssignFromCRTeamBucket error', error);
    next(error);
  }
};

// ==============================================================
// ROUTE CR TO ANOTHER TEAM
// ==============================================================
const routeCRToTeam = async (req, res, next) => {
  try {
    const crId = parseInt(req.params.id);
    const userId = req.user.user_id;
    const roleCode = req.user.role?.role_code || '';
    const { target_team_id } = req.body;

    if (!target_team_id) return res.status(400).json(createResponse(false, 'target_team_id is required'));

    const targetTeamIdInt = parseInt(target_team_id);

    // Check permission: ADMIN, MANAGER, or member of a central team
    const isAdmin = roleCode === 'ADMIN' || roleCode === 'MANAGER' || roleCode === 'CENTRAL_MGMT';
    if (!isAdmin) {
      // Check if user is in a central team
      const centralCheck = await executeQuery(
        `SELECT 1 AS ok FROM team_members tm INNER JOIN teams t ON tm.team_id = t.team_id
         WHERE tm.user_id = @userId AND tm.is_active = 1 AND t.is_active = 1 AND t.is_central = 1`,
        { userId }
      );
      if (!centralCheck.recordset.length) {
        return res.status(403).json(createResponse(false, 'Only central team members, managers, or admins can route CRs'));
      }
    }

    // Validate target team
    const targetTeam = await executeQuery(
      `SELECT team_id, team_name FROM teams WHERE team_id = @teamId AND is_active = 1`,
      { teamId: targetTeamIdInt }
    );
    if (!targetTeam.recordset.length) return res.status(404).json(createResponse(false, 'Target team not found'));
    const teamName = targetTeam.recordset[0].team_name;

    // Fetch CR
    const crResult = await executeQuery(
      `SELECT cr.cr_id, cr.cr_number, cr.team_id, cs.status_code, cs.is_final_status
       FROM change_requests cr
       LEFT JOIN cr_statuses cs ON cr.cr_status_id = cs.status_id
       WHERE cr.cr_id = @crId`,
      { crId }
    );
    if (!crResult.recordset.length) return res.status(404).json(createResponse(false, 'CR not found'));
    const cr = crResult.recordset[0];
    if (cr.is_final_status) return res.status(400).json(createResponse(false, 'Cannot route a closed or cancelled CR'));

    // Perform route
    await executeQuery(
      `UPDATE change_requests SET team_id = @teamId, assigned_to = NULL, updated_at = GETDATE()
       WHERE cr_id = @crId`,
      { crId, teamId: targetTeamIdInt }
    );

    // Audit trail
    await crService.logActivity(crId, 'CR_ROUTED', userId, {
      fieldName: 'team_id',
      oldValue: String(cr.team_id || ''),
      newValue: String(targetTeamIdInt),
      description: `CR routed to team: ${teamName}`,
    });

    crService.logJourney(crId, 'TEAM_ROUTED', userId, {
      summary: `Routed to ${teamName}`,
    }).catch(() => {});

    return res.status(200).json(createResponse(true, `CR ${cr.cr_number} routed to ${teamName}`));
  } catch (error) {
    logger.error('routeCRToTeam error', error);
    next(error);
  }
};

module.exports = {
  getCRTeamBucketItems,
  getCRTeamBucketStats,
  selfAssignFromCRTeamBucket,
  routeCRToTeam,
};

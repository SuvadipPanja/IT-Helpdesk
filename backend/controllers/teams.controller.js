/**
 * ============================================
 * TEAM MANAGEMENT CONTROLLER
 * ============================================
 * Full CRUD for Teams, Team Members, and
 * Category → Team Routing rules.
 *
 * Concepts:
 *   - A "team" is a group of engineers/managers that handle a specific
 *     type of support work (e.g. Network Team, System Team, IVR Team).
 *   - One team may be flagged as "Central Ticketing Team" (is_central=1).
 *     ALL new tickets are first routed to the central team.  The central
 *     team can then forward (route) tickets to specialist teams.
 *   - team_category_routing maps ticket categories to destination teams.
 *     When the central team forwards a ticket it auto-suggests a team
 *     based on the ticket's category.
 *
 * Security:
 *   - GET endpoints: ADMIN, MANAGER (+ ENGINEER for own-team lookup)
 *   - Mutation (POST/PUT/DELETE): ADMIN only
 *   - Route forwards (in teamBucket.controller): ADMIN, MANAGER, central team members
 *
 * Developer: Suvadip Panja
 * Company: Digitide
 * Created: April 2026
 * ============================================
 */

const { executeQuery } = require('../config/database');
const { createResponse } = require('../utils/helpers');
const logger = require('../utils/logger');

// ==============================================================
// TEAMS — CRUD
// ==============================================================

/**
 * GET /api/v1/teams
 * List all active teams with member count, manager info, and routing rules.
 */
const getTeams = async (req, res, next) => {
  try {
    const includeInactive = req.query.include_inactive === 'true';
    const whereClause = includeInactive ? '' : 'WHERE t.is_active = 1';

    const query = `
      SELECT
        t.team_id,
        t.team_name,
        t.team_code,
        t.description,
        t.is_central,
        t.is_active,
        t.created_at,
        t.updated_at,
        -- Manager info (nullable)
        t.team_manager_id,
        u.first_name + ' ' + u.last_name  AS team_manager_name,
        u.email                            AS team_manager_email,
        -- Aggregate member count
        (
          SELECT COUNT(*) FROM team_members tm
          WHERE tm.team_id = t.team_id AND tm.is_active = 1
        ) AS member_count,
        -- Active ticket count in this team bucket
        (
          SELECT COUNT(*) FROM tickets tk
          INNER JOIN ticket_statuses ts ON tk.status_id = ts.status_id
          WHERE tk.team_id = t.team_id
            AND tk.assigned_to IS NULL
            AND ts.is_final_status = 0
        ) AS unassigned_ticket_count
      FROM teams t
      LEFT JOIN users u ON t.team_manager_id = u.user_id
      ${whereClause}
      ORDER BY t.is_central DESC, t.team_name
    `;

    const result = await executeQuery(query);

    return res.status(200).json(
      createResponse(true, 'Teams fetched successfully', result.recordset)
    );
  } catch (error) {
    logger.error('getTeams error', error);
    next(error);
  }
};

/**
 * GET /api/v1/teams/:id
 * Single team detail with members and category routing rules.
 */
const getTeamById = async (req, res, next) => {
  try {
    const teamId = parseInt(req.params.id);
    if (isNaN(teamId)) {
      return res.status(400).json(createResponse(false, 'Invalid team ID'));
    }

    const teamQuery = `
      SELECT
        t.team_id, t.team_name, t.team_code, t.description,
        t.is_central, t.is_active, t.created_at, t.updated_at,
        t.team_manager_id,
        u.first_name + ' ' + u.last_name AS team_manager_name,
        u.email AS team_manager_email
      FROM teams t
      LEFT JOIN users u ON t.team_manager_id = u.user_id
      WHERE t.team_id = @teamId
    `;

    const membersQuery = `
      SELECT
        tm.member_id, tm.team_id, tm.user_id, tm.is_active, tm.joined_at,
        u.first_name + ' ' + u.last_name AS full_name,
        u.email,
        u.profile_picture,
        r.role_name, r.role_code
      FROM team_members tm
      INNER JOIN users u  ON tm.user_id  = u.user_id
      INNER JOIN user_roles r ON u.role_id = r.role_id
      WHERE tm.team_id = @teamId AND tm.is_active = 1
      ORDER BY u.first_name, u.last_name
    `;

    const routingQuery = `
      SELECT
        tcr.routing_id, tcr.team_id, tcr.category_id, tcr.is_active, tcr.created_at,
        tc.category_name, tc.category_code
      FROM team_category_routing tcr
      INNER JOIN ticket_categories tc ON tcr.category_id = tc.category_id
      WHERE tcr.team_id = @teamId AND tcr.is_active = 1
      ORDER BY tc.category_name
    `;

    const [teamResult, membersResult, routingResult] = await Promise.all([
      executeQuery(teamQuery, { teamId }),
      executeQuery(membersQuery, { teamId }),
      executeQuery(routingQuery, { teamId }),
    ]);

    if (!teamResult.recordset.length) {
      return res.status(404).json(createResponse(false, 'Team not found'));
    }

    const team = {
      ...teamResult.recordset[0],
      members: membersResult.recordset,
      category_routing: routingResult.recordset,
    };

    return res.status(200).json(createResponse(true, 'Team fetched successfully', team));
  } catch (error) {
    logger.error('getTeamById error', error);
    next(error);
  }
};

/**
 * POST /api/v1/teams
 * Create a new team.
 */
const createTeam = async (req, res, next) => {
  try {
    const { team_name, team_code, description, is_central, team_manager_id } = req.body;

    if (!team_name || !team_name.trim()) {
      return res.status(400).json(createResponse(false, 'team_name is required'));
    }
    if (!team_code || !team_code.trim()) {
      return res.status(400).json(createResponse(false, 'team_code is required'));
    }

    const normalizedCode = team_code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
    const isCentral = is_central ? 1 : 0;

    // If attempting to create a central team, ensure none exists
    if (isCentral) {
      const centralCheck = await executeQuery(
        'SELECT team_id FROM teams WHERE is_central = 1 AND is_active = 1'
      );
      if (centralCheck.recordset.length) {
        return res.status(409).json(
          createResponse(false, 'A Central Ticketing Team already exists. Only one central team is allowed.')
        );
      }
    }

    // team_code uniqueness
    const codeCheck = await executeQuery(
      'SELECT team_id FROM teams WHERE team_code = @code',
      { code: normalizedCode }
    );
    if (codeCheck.recordset.length) {
      return res.status(409).json(
        createResponse(false, `Team code "${normalizedCode}" is already in use`)
      );
    }

    const result = await executeQuery(
      `INSERT INTO teams (team_name, team_code, description, is_central, team_manager_id)
       OUTPUT INSERTED.team_id
       VALUES (@name, @code, @description, @isCentral, @managerId)`,
      {
        name: team_name.trim(),
        code: normalizedCode,
        description: description?.trim() || null,
        isCentral,
        managerId: team_manager_id || null,
      }
    );

    const teamId = result.recordset[0].team_id;

    logger.success('Team created', { teamId, team_name, isCentral });

    return res.status(201).json(
      createResponse(true, 'Team created successfully', { team_id: teamId })
    );
  } catch (error) {
    logger.error('createTeam error', error);
    next(error);
  }
};

/**
 * PUT /api/v1/teams/:id
 * Update team details.
 */
const updateTeam = async (req, res, next) => {
  try {
    const teamId = parseInt(req.params.id);
    if (isNaN(teamId)) {
      return res.status(400).json(createResponse(false, 'Invalid team ID'));
    }

    const { team_name, team_code, description, is_central, team_manager_id, is_active } = req.body;

    // Fetch existing
    const existing = await executeQuery(
      'SELECT team_id, is_central FROM teams WHERE team_id = @teamId',
      { teamId }
    );
    if (!existing.recordset.length) {
      return res.status(404).json(createResponse(false, 'Team not found'));
    }

    const isCentral = is_central !== undefined ? (is_central ? 1 : 0) : existing.recordset[0].is_central;

    // If promoting to central, ensure no other central team
    if (isCentral && !existing.recordset[0].is_central) {
      const centralCheck = await executeQuery(
        'SELECT team_id FROM teams WHERE is_central = 1 AND is_active = 1 AND team_id != @teamId',
        { teamId }
      );
      if (centralCheck.recordset.length) {
        return res.status(409).json(
          createResponse(false, 'Another Central Ticketing Team already exists.')
        );
      }
    }

    // If team_code is changing, check uniqueness
    if (team_code) {
      const normalizedCode = team_code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
      const codeCheck = await executeQuery(
        'SELECT team_id FROM teams WHERE team_code = @code AND team_id != @teamId',
        { code: normalizedCode, teamId }
      );
      if (codeCheck.recordset.length) {
        return res.status(409).json(
          createResponse(false, `Team code "${normalizedCode}" is already in use`)
        );
      }
    }

    await executeQuery(
      `UPDATE teams SET
        team_name       = COALESCE(@name,        team_name),
        team_code       = COALESCE(@code,        team_code),
        description     = COALESCE(@description, description),
        is_central      = @isCentral,
        team_manager_id = @managerId,
        is_active       = COALESCE(@isActive,    is_active),
        updated_at      = GETDATE()
       WHERE team_id = @teamId`,
      {
        name: team_name?.trim() || null,
        code: team_code ? team_code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '') : null,
        description: description?.trim() ?? null,
        isCentral,
        managerId: team_manager_id !== undefined ? (team_manager_id || null) : undefined,
        isActive: is_active !== undefined ? (is_active ? 1 : 0) : null,
        teamId,
      }
    );

    logger.success('Team updated', { teamId });

    return res.status(200).json(createResponse(true, 'Team updated successfully'));
  } catch (error) {
    logger.error('updateTeam error', error);
    next(error);
  }
};

/**
 * DELETE /api/v1/teams/:id
 * Soft-deletes (deactivates) a team. Cannot deactivate a team that still
 * holds unresolved tickets in its bucket.
 */
const deleteTeam = async (req, res, next) => {
  try {
    const teamId = parseInt(req.params.id);
    if (isNaN(teamId)) {
      return res.status(400).json(createResponse(false, 'Invalid team ID'));
    }

    const existing = await executeQuery(
      'SELECT team_id, is_central, team_name FROM teams WHERE team_id = @teamId',
      { teamId }
    );
    if (!existing.recordset.length) {
      return res.status(404).json(createResponse(false, 'Team not found'));
    }
    if (existing.recordset[0].is_central) {
      return res.status(400).json(createResponse(false, 'Cannot delete the Central Ticketing Team'));
    }

    // Check for active tickets in the bucket
    const ticketCheck = await executeQuery(
      `SELECT COUNT(*) AS cnt FROM tickets tk
       INNER JOIN ticket_statuses ts ON tk.status_id = ts.status_id
       WHERE tk.team_id = @teamId AND ts.is_final_status = 0`,
      { teamId }
    );
    if (ticketCheck.recordset[0].cnt > 0) {
      return res.status(409).json(
        createResponse(
          false,
          `Team "${existing.recordset[0].team_name}" still has ${ticketCheck.recordset[0].cnt} open ticket(s). Reassign or close them before deactivating.`
        )
      );
    }

    await executeQuery(
      'UPDATE teams SET is_active = 0, updated_at = GETDATE() WHERE team_id = @teamId',
      { teamId }
    );

    logger.success('Team deactivated', { teamId });

    return res.status(200).json(createResponse(true, 'Team deactivated successfully'));
  } catch (error) {
    logger.error('deleteTeam error', error);
    next(error);
  }
};

// ==============================================================
// TEAM MEMBERS
// ==============================================================

/**
 * GET /api/v1/teams/:id/members
 * List members (active) of a team.
 */
const getTeamMembers = async (req, res, next) => {
  try {
    const teamId = parseInt(req.params.id);
    if (isNaN(teamId)) {
      return res.status(400).json(createResponse(false, 'Invalid team ID'));
    }

    const query = `
      SELECT
        tm.member_id, tm.user_id, tm.is_active, tm.joined_at,
        u.first_name + ' ' + u.last_name AS full_name,
        u.email, u.profile_picture,
        r.role_name, r.role_code,
        d.department_name
      FROM team_members tm
      INNER JOIN users      u ON tm.user_id  = u.user_id
      INNER JOIN user_roles r ON u.role_id   = r.role_id
      LEFT  JOIN departments d ON u.department_id = d.department_id
      WHERE tm.team_id = @teamId AND tm.is_active = 1
      ORDER BY u.first_name, u.last_name
    `;

    const result = await executeQuery(query, { teamId });

    return res.status(200).json(
      createResponse(true, 'Team members fetched successfully', result.recordset)
    );
  } catch (error) {
    logger.error('getTeamMembers error', error);
    next(error);
  }
};

/**
 * POST /api/v1/teams/:id/members
 * Add a user to a team.
 * Body: { user_id }
 */
const addTeamMember = async (req, res, next) => {
  try {
    const teamId = parseInt(req.params.id);
    const userId = parseInt(req.body.user_id);

    if (isNaN(teamId) || isNaN(userId)) {
      return res.status(400).json(createResponse(false, 'Invalid team_id or user_id'));
    }

    // Ensure team exists
    const teamCheck = await executeQuery(
      'SELECT team_id FROM teams WHERE team_id = @teamId AND is_active = 1',
      { teamId }
    );
    if (!teamCheck.recordset.length) {
      return res.status(404).json(createResponse(false, 'Team not found'));
    }

    // Ensure user exists and is active
    const userCheck = await executeQuery(
      'SELECT user_id FROM users WHERE user_id = @userId AND is_active = 1',
      { userId }
    );
    if (!userCheck.recordset.length) {
      return res.status(404).json(createResponse(false, 'User not found or inactive'));
    }

    // Upsert: if soft-deleted record exists, reactivate it; otherwise insert
    const existing = await executeQuery(
      'SELECT member_id, is_active FROM team_members WHERE team_id = @teamId AND user_id = @userId',
      { teamId, userId }
    );

    if (existing.recordset.length) {
      if (existing.recordset[0].is_active) {
        return res.status(409).json(createResponse(false, 'User is already a member of this team'));
      }
      // Re-activate
      await executeQuery(
        'UPDATE team_members SET is_active = 1, joined_at = GETDATE() WHERE team_id = @teamId AND user_id = @userId',
        { teamId, userId }
      );
    } else {
      await executeQuery(
        'INSERT INTO team_members (team_id, user_id) VALUES (@teamId, @userId)',
        { teamId, userId }
      );
    }

    logger.success('Team member added', { teamId, userId });

    return res.status(201).json(createResponse(true, 'User added to team successfully'));
  } catch (error) {
    logger.error('addTeamMember error', error);
    next(error);
  }
};

/**
 * DELETE /api/v1/teams/:id/members/:userId
 * Remove a user from a team (soft-delete).
 */
const removeTeamMember = async (req, res, next) => {
  try {
    const teamId  = parseInt(req.params.id);
    const userId  = parseInt(req.params.userId);

    if (isNaN(teamId) || isNaN(userId)) {
      return res.status(400).json(createResponse(false, 'Invalid team_id or user_id'));
    }

    const result = await executeQuery(
      `UPDATE team_members SET is_active = 0
       WHERE team_id = @teamId AND user_id = @userId AND is_active = 1`,
      { teamId, userId }
    );

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json(createResponse(false, 'Member not found in this team'));
    }

    logger.success('Team member removed', { teamId, userId });

    return res.status(200).json(createResponse(true, 'User removed from team successfully'));
  } catch (error) {
    logger.error('removeTeamMember error', error);
    next(error);
  }
};

// ==============================================================
// CATEGORY → TEAM ROUTING
// ==============================================================

/**
 * GET /api/v1/teams/routing
 * All active category→team routing rules.
 */
const getCategoryRoutings = async (req, res, next) => {
  try {
    const query = `
      SELECT
        tcr.routing_id, tcr.team_id, tcr.category_id, tcr.is_active, tcr.created_at,
        t.team_name, t.team_code, t.is_central,
        tc.category_name, tc.category_code
      FROM team_category_routing tcr
      INNER JOIN teams            t  ON tcr.team_id     = t.team_id
      INNER JOIN ticket_categories tc ON tcr.category_id = tc.category_id
      WHERE tcr.is_active = 1
      ORDER BY tc.category_name
    `;

    const result = await executeQuery(query);

    return res.status(200).json(
      createResponse(true, 'Category routing rules fetched successfully', result.recordset)
    );
  } catch (error) {
    logger.error('getCategoryRoutings error', error);
    next(error);
  }
};

/**
 * POST /api/v1/teams/routing
 * Create a category → team routing rule.
 * Body: { team_id, category_id }
 */
const createCategoryRouting = async (req, res, next) => {
  try {
    const { team_id, category_id } = req.body;

    if (!team_id || !category_id) {
      return res.status(400).json(createResponse(false, 'team_id and category_id are required'));
    }

    const teamId     = parseInt(team_id);
    const categoryId = parseInt(category_id);

    if (isNaN(teamId) || isNaN(categoryId)) {
      return res.status(400).json(createResponse(false, 'Invalid team_id or category_id'));
    }

    // Central teams should not be the destination for category routing
    const teamCheck = await executeQuery(
      'SELECT team_id, is_central FROM teams WHERE team_id = @teamId AND is_active = 1',
      { teamId }
    );
    if (!teamCheck.recordset.length) {
      return res.status(404).json(createResponse(false, 'Team not found'));
    }
    if (teamCheck.recordset[0].is_central) {
      return res.status(400).json(
        createResponse(
          false,
          'Cannot create a routing rule pointing to the Central Ticketing Team. The central team receives all tickets automatically.'
        )
      );
    }

    // Category existence
    const catCheck = await executeQuery(
      'SELECT category_id FROM ticket_categories WHERE category_id = @categoryId AND is_active = 1',
      { categoryId }
    );
    if (!catCheck.recordCheck && !catCheck.recordset.length) {
      return res.status(404).json(createResponse(false, 'Category not found'));
    }

    // Check if category is already routed to another team
    const existing = await executeQuery(
      `SELECT tcr.routing_id, t.team_name FROM team_category_routing tcr
       INNER JOIN teams t ON tcr.team_id = t.team_id
       WHERE tcr.category_id = @categoryId AND tcr.is_active = 1`,
      { categoryId }
    );
    if (existing.recordset.length) {
      return res.status(409).json(
        createResponse(
          false,
          `This category is already routed to team "${existing.recordset[0].team_name}". Remove that rule first.`
        )
      );
    }

    // Re-activate soft-deleted record or insert new
    const softDeleted = await executeQuery(
      'SELECT routing_id FROM team_category_routing WHERE team_id = @teamId AND category_id = @categoryId',
      { teamId, categoryId }
    );

    if (softDeleted.recordset.length) {
      await executeQuery(
        'UPDATE team_category_routing SET is_active = 1, created_at = GETDATE() WHERE team_id = @teamId AND category_id = @categoryId',
        { teamId, categoryId }
      );
    } else {
      await executeQuery(
        'INSERT INTO team_category_routing (team_id, category_id) VALUES (@teamId, @categoryId)',
        { teamId, categoryId }
      );
    }

    logger.success('Category routing created', { teamId, categoryId });

    return res.status(201).json(
      createResponse(true, 'Category routing rule created successfully')
    );
  } catch (error) {
    logger.error('createCategoryRouting error', error);
    next(error);
  }
};

/**
 * DELETE /api/v1/teams/routing/:routingId
 * Remove a category → team routing rule (soft-delete).
 */
const deleteCategoryRouting = async (req, res, next) => {
  try {
    const routingId = parseInt(req.params.routingId);
    if (isNaN(routingId)) {
      return res.status(400).json(createResponse(false, 'Invalid routing ID'));
    }

    const result = await executeQuery(
      'UPDATE team_category_routing SET is_active = 0 WHERE routing_id = @routingId AND is_active = 1',
      { routingId }
    );

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json(createResponse(false, 'Routing rule not found'));
    }

    logger.success('Category routing deleted', { routingId });

    return res.status(200).json(createResponse(true, 'Routing rule removed successfully'));
  } catch (error) {
    logger.error('deleteCategoryRouting error', error);
    next(error);
  }
};

/**
 * GET /api/v1/teams/my-team
 * Return the team(s) the current user belongs to.
 * Used by frontend to decide which team bucket to show.
 */
const getMyTeam = async (req, res, next) => {
  try {
    const userId = req.user.user_id;

    const query = `
      SELECT
        t.team_id, t.team_name, t.team_code, t.is_central, t.is_active,
        t.team_manager_id,
        tm.member_id, tm.joined_at
      FROM team_members tm
      INNER JOIN teams t ON tm.team_id = t.team_id
      WHERE tm.user_id = @userId AND tm.is_active = 1 AND t.is_active = 1
      ORDER BY t.is_central DESC, t.team_name
    `;

    const result = await executeQuery(query, { userId });

    return res.status(200).json(
      createResponse(true, 'Your team memberships fetched', result.recordset)
    );
  } catch (error) {
    logger.error('getMyTeam error', error);
    next(error);
  }
};

/**
 * GET /api/v1/users/:id/teams
 * Return all active teams that a specific user belongs to.
 * Used by EditUserModal to display and manage a user's team memberships.
 */
const getUserTeams = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json(createResponse(false, 'Invalid user_id'));
    }

    const result = await executeQuery(
      `SELECT
         tm.member_id,
         t.team_id,
         t.team_name,
         t.team_code,
         t.is_central,
         tm.joined_at
       FROM team_members tm
       JOIN teams t ON t.team_id = tm.team_id
       WHERE tm.user_id = @userId
         AND tm.is_active = 1
         AND t.is_active = 1
       ORDER BY t.is_central DESC, t.team_name`,
      { userId }
    );

    return res.status(200).json(createResponse(true, 'User teams fetched', result.recordset));
  } catch (error) {
    logger.error('getUserTeams error', error);
    next(error);
  }
};

// ==============================================================
// EXPORTS
// ==============================================================
module.exports = {
  getTeams,
  getTeamById,
  createTeam,
  updateTeam,
  deleteTeam,
  getTeamMembers,
  addTeamMember,
  removeTeamMember,
  getCategoryRoutings,
  createCategoryRouting,
  deleteCategoryRouting,
  getMyTeam,
  getUserTeams,
};

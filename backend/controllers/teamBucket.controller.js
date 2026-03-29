/**
 * ============================================
 * TEAM BUCKET CONTROLLER
 * ============================================
 * Team-scoped ticket bucket system.
 *
 * How it works:
 *   1. When a ticket is created it is automatically routed to the Central
 *      Ticketing Team (team_id = central team's ID).
 *   2. Central team members can view tickets in their bucket, validate them,
 *      reset priority, and forward them to a specialist team.
 *   3. Specialist team members (Network, System, IVR, Telecom, etc.) see only
 *      tickets that have been routed to their team.
 *   4. Engineers can self-assign a ticket from their team bucket.
 *   5. ADMIN/MANAGER can see any team's bucket and perform all actions.
 *
 * SECURITY:
 *   - All endpoints require authentication.
 *   - Engineers only see their own team bucket.
 *   - Forwarding tickets is limited to central-team members or ADMIN/MANAGER.
 *   - Priority reset requires ADMIN, MANAGER, or the team's own manager.
 *   - Self-assign: ENGINEER only (assigns req.user.user_id).
 *
 * Developer: Suvadip Panja
 * Company: Digitide
 * Created: April 2026
 * ============================================
 */

const { executeQuery } = require('../config/database');
const { createResponse, getPaginationMeta } = require('../utils/helpers');
const logger = require('../utils/logger');
const settingsService = require('../services/settings.service');
const slaService = require('../services/sla.service');
const emailQueueService = require('../services/emailQueue.service');
const dateUtils = require('../utils/dateUtils');
const { getPublicAppUrl } = require('../utils/publicUrl');

// ==============================================================
// HELPERS
// ==============================================================

/**
 * Determine which team(s) the current user may see tickets for.
 * ADMIN and MANAGER can query any team; ENGINEER is limited to their team.
 * Returns { allowedTeamIds: int[]|null, isCentral: bool, isAdmin: bool }
 *   null = no restriction (admin/manager global view)
 */
async function resolveUserTeamAccess(userId, roleCode, requestedTeamId) {
  const isAdmin = roleCode === 'ADMIN' || roleCode === 'MANAGER' || roleCode === 'CENTRAL_MGMT';

  if (isAdmin) {
    return { allowedTeamId: requestedTeamId || null, isCentral: false, isAdmin: true };
  }

  // ENGINEER: find their teams
  const memberQuery = `
    SELECT tm.team_id, t.is_central
    FROM team_members tm
    INNER JOIN teams t ON tm.team_id = t.team_id
    WHERE tm.user_id = @userId AND tm.is_active = 1 AND t.is_active = 1
  `;
  const memberResult = await executeQuery(memberQuery, { userId });

  if (!memberResult.recordset.length) {
    return { allowedTeamId: null, isCentral: false, isAdmin: false, noTeam: true };
  }

  // If requested a specific team, verify membership
  if (requestedTeamId) {
    const belongs = memberResult.recordset.find(r => r.team_id === requestedTeamId);
    if (!belongs) return { allowedTeamId: null, noTeam: true, isAdmin: false };
    return { allowedTeamId: requestedTeamId, isCentral: belongs.is_central, isAdmin: false };
  }

  // Default to first team (prefer central if member of it)
  const central = memberResult.recordset.find(r => r.is_central);
  const team    = central || memberResult.recordset[0];
  return { allowedTeamId: team.team_id, isCentral: !!team.is_central, isAdmin: false };
}

// ==============================================================
// GET TEAM BUCKET TICKETS
// ==============================================================
/**
 * GET /api/v1/team-bucket
 * Returns unassigned, non-final tickets for the user's team (or a specified team for admins).
 *
 * Query params:
 *   team_id        — (admin/manager only) view a specific team's bucket
 *   page, limit    — pagination
 *   search         — full-text on ticket_number, subject
 *   priority_id    — filter
 *   category_id    — filter
 *   department_id  — filter
 *   sortBy/sortOrder
 */
const getTeamBucketTickets = async (req, res, next) => {
  try {
    const userId   = req.user.user_id;
    const roleCode = req.user.role?.role_code || '';
    const requestedTeamId = req.query.team_id ? parseInt(req.query.team_id) : null;

    const page   = parseInt(req.query.page)  || 1;
    const limit  = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const search      = req.query.search       || '';
    const priority_id = req.query.priority_id  || null;
    const category_id = req.query.category_id  || null;
    const department_id = req.query.department_id || null;

    const access = await resolveUserTeamAccess(userId, roleCode, requestedTeamId);

    if (access.noTeam) {
      return res.status(200).json(
        createResponse(true, 'You are not assigned to any team', {
          tickets: [], pagination: getPaginationMeta(0, page, limit), team: null
        })
      );
    }

    // Build WHERE conditions
    let whereConditions = [
      't.assigned_to IS NULL',
      'ts.is_final_status = 0',
    ];
    let params = {};

    if (access.allowedTeamId !== null) {
      whereConditions.push('t.team_id = @teamId');
      params.teamId = access.allowedTeamId;
    } else {
      // Admin global view — show all team-routed tickets (team_id IS NOT NULL)
      whereConditions.push('t.team_id IS NOT NULL');
    }

    if (search) {
      whereConditions.push(`(t.ticket_number LIKE '%' + @search + '%' OR t.subject LIKE '%' + @search + '%')`);
      params.search = search;
    }
    if (priority_id)   { whereConditions.push('t.priority_id = @priorityId');     params.priorityId   = parseInt(priority_id); }
    if (category_id)   { whereConditions.push('t.category_id = @categoryId');     params.categoryId   = parseInt(category_id); }
    if (department_id) { whereConditions.push('t.department_id = @departmentId'); params.departmentId = parseInt(department_id); }

    const whereClause = 'WHERE ' + whereConditions.join(' AND ');

    // Count
    const countResult = await executeQuery(
      `SELECT COUNT(*) AS total FROM tickets t
       LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
       ${whereClause}`,
      params
    );
    const totalRecords = countResult.recordset[0].total;

    // Sort
    const allowedSort = ['created_at', 'updated_at', 'ticket_number', 'subject', 'due_date', 'priority_id'];
    const sortBy    = allowedSort.includes(req.query.sortBy) ? req.query.sortBy : 'created_at';
    const sortOrder = req.query.sortOrder === 'ASC' ? 'ASC' : 'DESC';

    // Fetch
    const ticketsResult = await executeQuery(
      `SELECT
        t.ticket_id, t.ticket_number, t.subject, t.description,
        t.created_at, t.updated_at, t.due_date, t.is_escalated,
        t.team_id, t.routed_at, t.routed_by_user_id,

        tc.category_id, tc.category_name,
        tp.priority_id, tp.priority_name, tp.priority_code, tp.color_code AS priority_color,
        ts.status_id, ts.status_name, ts.status_code, ts.color_code AS status_color,

        u_req.user_id AS requester_id,
        u_req.first_name + ' ' + u_req.last_name AS requester_name,
        u_req.profile_picture AS requester_profile_picture,

        d.department_id, d.department_name,
        loc.location_id AS ticket_location_id, loc.location_name AS ticket_location_name,
        prc.process_name,

        -- Team info
        tm_t.team_name, tm_t.team_code, tm_t.is_central,

        -- Who routed it
        u_routed.first_name + ' ' + u_routed.last_name AS routed_by_name

       FROM tickets t
       LEFT JOIN ticket_categories  tc      ON t.category_id         = tc.category_id
       LEFT JOIN ticket_priorities  tp      ON t.priority_id         = tp.priority_id
       LEFT JOIN ticket_statuses    ts      ON t.status_id           = ts.status_id
       LEFT JOIN users              u_req   ON t.requester_id        = u_req.user_id
       LEFT JOIN departments        d       ON t.department_id       = d.department_id
       LEFT JOIN locations          loc     ON t.location_id         = loc.location_id
       LEFT JOIN processes          prc     ON t.process_id          = prc.process_id
       LEFT JOIN teams              tm_t    ON t.team_id             = tm_t.team_id
       LEFT JOIN users              u_routed ON t.routed_by_user_id  = u_routed.user_id
       ${whereClause}
       ORDER BY t.${sortBy} ${sortOrder}
       OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
      { ...params, offset, limit }
    );

    // Attach the team object in the response
    let teamInfo = null;
    if (access.allowedTeamId) {
      const teamResult = await executeQuery(
        'SELECT team_id, team_name, team_code, is_central FROM teams WHERE team_id = @teamId',
        { teamId: access.allowedTeamId }
      );
      teamInfo = teamResult.recordset[0] || null;
    }

    return res.status(200).json(
      createResponse(true, 'Team bucket tickets fetched', {
        tickets: ticketsResult.recordset,
        pagination: getPaginationMeta(totalRecords, page, limit),
        team: teamInfo,
      })
    );
  } catch (error) {
    logger.error('getTeamBucketTickets error', error);
    next(error);
  }
};

// ==============================================================
// GET TEAM BUCKET STATS
// ==============================================================
/**
 * GET /api/v1/team-bucket/stats
 * Per-team unassigned ticket counts and current user's team info.
 */
const getTeamBucketStats = async (req, res, next) => {
  try {
    const userId   = req.user.user_id;
    const roleCode = req.user.role?.role_code || '';
    const isAdmin  = roleCode === 'ADMIN' || roleCode === 'MANAGER' || roleCode === 'CENTRAL_MGMT';

    // Per-team counts MUST use the same predicates as GET /team-bucket list/count
    // (see getTeamBucketTickets). A grouped INNER JOIN can diverge from LEFT JOIN + filters.
    const allTeamsStats = await executeQuery(`
      SELECT
        tm.team_id,
        tm.team_name,
        tm.team_code,
        tm.is_central,
        (
          SELECT COUNT(*)
          FROM tickets t
          LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
          WHERE t.team_id = tm.team_id
            AND t.assigned_to IS NULL
            AND ts.is_final_status = 0
        ) AS unassigned_count
      FROM teams tm
      WHERE tm.is_active = 1
      ORDER BY tm.is_central DESC, tm.team_name
    `);

    // Current user's membership
    const myTeams = await executeQuery(
      `SELECT tm.team_id, t.team_name, t.team_code, t.is_central
       FROM team_members tm
       INNER JOIN teams t ON tm.team_id = t.team_id
       WHERE tm.user_id = @userId AND tm.is_active = 1 AND t.is_active = 1`,
      { userId }
    );

    const mapTeamRow = (row) => {
      const raw = row.unassigned_count ?? row.Unassigned_Count;
      const n = Number(raw);
      return {
        ...row,
        unassigned_count: Number.isFinite(n) ? n : 0,
      };
    };

    const allRows = (allTeamsStats.recordset || []).map(mapTeamRow);
    const filteredTeams = isAdmin
      ? allRows
      : allRows.filter((t) => myTeams.recordset.some((m) => m.team_id === t.team_id));

    return res.status(200).json(
      createResponse(true, 'Team bucket stats fetched', {
        all_teams: filteredTeams,
        my_teams: myTeams.recordset,
      })
    );
  } catch (error) {
    logger.error('getTeamBucketStats error', error);
    next(error);
  }
};

// ==============================================================
// SELF-ASSIGN FROM TEAM BUCKET
// ==============================================================
/**
 * POST /api/v1/team-bucket/:id/self-assign
 * Engineer picks up a ticket from their team bucket.
 */
const selfAssignFromTeamBucket = async (req, res, next) => {
  try {
    const ticketId = parseInt(req.params.id);
    const userId   = req.user.user_id;
    const roleCode = req.user.role?.role_code || '';

    if (roleCode !== 'ENGINEER') {
      return res.status(403).json(
        createResponse(false, 'Only engineers can self-assign tickets from the bucket')
      );
    }

    // Verify engineer is active
    const engineerResult = await executeQuery(
      `SELECT user_id, is_active, first_name + ' ' + last_name AS full_name, email
       FROM users WHERE user_id = @userId`,
      { userId }
    );
    if (!engineerResult.recordset.length || !engineerResult.recordset[0].is_active) {
      return res.status(403).json(createResponse(false, 'Your account is not active'));
    }
    const engineer = engineerResult.recordset[0];

    // Fetch ticket — must exist, unassigned, non-final, and be in user's team
    const ticketResult = await executeQuery(
      `SELECT
         t.ticket_id, t.ticket_number, t.subject, t.assigned_to, t.team_id,
         t.requester_id, t.due_date,
         ts.status_code, ts.status_name, ts.is_final_status,
         tp.priority_name,
         u_req.email AS requester_email,
         u_req.first_name + ' ' + u_req.last_name AS requester_name
       FROM tickets t
       LEFT JOIN ticket_statuses  ts    ON t.status_id    = ts.status_id
       LEFT JOIN ticket_priorities tp   ON t.priority_id  = tp.priority_id
       LEFT JOIN users             u_req ON t.requester_id = u_req.user_id
       WHERE t.ticket_id = @ticketId`,
      { ticketId }
    );

    if (!ticketResult.recordset.length) {
      return res.status(404).json(createResponse(false, 'Ticket not found'));
    }
    const ticket = ticketResult.recordset[0];

    if (ticket.assigned_to !== null) {
      return res.status(409).json(createResponse(false, 'Ticket already assigned. Please refresh.'));
    }
    if (ticket.is_final_status) {
      return res.status(400).json(createResponse(false, `Cannot pick up a closed ticket`));
    }

    // Verify engineer belongs to this ticket's team
    if (ticket.team_id) {
      const memberCheck = await executeQuery(
        `SELECT 1 AS ok FROM team_members
         WHERE team_id = @teamId AND user_id = @userId AND is_active = 1`,
        { teamId: ticket.team_id, userId }
      );
      if (!memberCheck.recordset.length) {
        return res.status(403).json(
          createResponse(false, 'You are not a member of the team that owns this ticket')
        );
      }
    }

    // Atomic assignment with race-condition protection
    const updateResult = await executeQuery(
      `UPDATE tickets SET assigned_to = @userId, updated_at = GETDATE()
       WHERE ticket_id = @ticketId AND assigned_to IS NULL
         AND status_id IN (SELECT status_id FROM ticket_statuses WHERE is_final_status = 0)`,
      { ticketId, userId }
    );

    if (updateResult.rowsAffected[0] === 0) {
      return res.status(409).json(
        createResponse(false, 'Ticket was just grabbed by another engineer. Please refresh.')
      );
    }

    // Audit trail
    await executeQuery(
      `INSERT INTO ticket_activities (ticket_id, activity_type, field_name, old_value, new_value, description, performed_by)
       VALUES (@ticketId, 'SELF_ASSIGNED', 'assigned_to', 'Unassigned', @name, @desc, @userId)`,
      {
        ticketId,
        name: engineer.full_name?.trim(),
        desc: `${engineer.full_name?.trim()} picked up ticket #${ticket.ticket_number} from team bucket`,
        userId,
      }
    );

    // Notifications (non-blocking)
    try {
      if (ticket.requester_id && ticket.requester_id !== userId) {
        await executeQuery(
          `INSERT INTO notifications (user_id, notification_type, title, message, related_ticket_id)
           VALUES (@requesterId, 'TICKET_ASSIGNED', 'Ticket Picked Up',
             'Ticket #' + @ticketNumber + ' has been picked up by ' + @name, @ticketId)`,
          { requesterId: ticket.requester_id, ticketNumber: ticket.ticket_number, name: engineer.full_name?.trim(), ticketId }
        );
      }

      const notifSettings = await settingsService.getByCategory('notification');
      if ((notifSettings.notify_on_ticket_assigned === 'true' || notifSettings.notify_on_ticket_assigned === true) && ticket.requester_email) {
        const generalSettings = await settingsService.getByCategory('general');
        const appUrl = getPublicAppUrl();
        await emailQueueService.queueEmail({
          to: ticket.requester_email,
          subject: `Your Ticket #${ticket.ticket_number} Has Been Picked Up`,
          template: 'ticket_assigned',
          context: {
            requesterName: ticket.requester_name?.trim() || 'User',
            ticketNumber: ticket.ticket_number,
            ticketSubject: ticket.subject,
            assigneeName: engineer.full_name?.trim(),
            assignedBy: engineer.full_name?.trim(),
            priority: ticket.priority_name || 'Normal',
            dueDate: ticket.due_date ? await dateUtils.formatDateTime(ticket.due_date) : 'Not set',
            ticketUrl: `${appUrl}/tickets/${ticketId}`,
            systemName: generalSettings?.system_name || 'IT Helpdesk',
          },
        });
      }
    } catch (notifErr) {
      logger.warn('Notification failed for team bucket self-assign', { ticketId, error: notifErr.message });
    }

    return res.status(200).json(
      createResponse(true, `Ticket #${ticket.ticket_number} assigned to you`, {
        ticket_id: ticketId,
        ticket_number: ticket.ticket_number,
        assigned_to: userId,
        assigned_to_name: engineer.full_name?.trim(),
      })
    );
  } catch (error) {
    logger.error('selfAssignFromTeamBucket error', error);
    next(error);
  }
};

// ==============================================================
// ROUTE TICKET (central team → specialist team)
// ==============================================================
/**
 * POST /api/v1/team-bucket/:id/route
 * Forward a ticket from the central team bucket to a specialist team.
 * Body: { team_id }
 *
 * Access: ADMIN, MANAGER, or a member of the central team.
 */
const routeTicketToTeam = async (req, res, next) => {
  try {
    const ticketId    = parseInt(req.params.id);
    const targetTeamId = parseInt(req.body.team_id);
    const userId      = req.user.user_id;
    const roleCode    = req.user.role?.role_code || '';

    if (isNaN(ticketId) || isNaN(targetTeamId)) {
      return res.status(400).json(createResponse(false, 'Invalid ticket_id or team_id'));
    }

    // Validate target team
    const teamCheck = await executeQuery(
      'SELECT team_id, team_name, is_central FROM teams WHERE team_id = @teamId AND is_active = 1',
      { teamId: targetTeamId }
    );
    if (!teamCheck.recordset.length) {
      return res.status(404).json(createResponse(false, 'Target team not found'));
    }
    if (teamCheck.recordset[0].is_central) {
      return res.status(400).json(createResponse(false, 'Cannot route a ticket back to the central team'));
    }

    // Fetch ticket
    const ticketResult = await executeQuery(
      `SELECT t.ticket_id, t.ticket_number, t.subject, t.team_id, t.assigned_to,
              ts.is_final_status, teams.is_central AS current_team_is_central
       FROM tickets t
       LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
       LEFT JOIN teams            ON t.team_id = teams.team_id
       WHERE t.ticket_id = @ticketId`,
      { ticketId }
    );

    if (!ticketResult.recordset.length) {
      return res.status(404).json(createResponse(false, 'Ticket not found'));
    }
    const ticket = ticketResult.recordset[0];

    if (ticket.is_final_status) {
      return res.status(400).json(createResponse(false, 'Cannot route a closed ticket'));
    }

    // Authorization: ADMIN/MANAGER or a member of the central team (or current team)
    const isAdminMgr = roleCode === 'ADMIN' || roleCode === 'MANAGER';
    if (!isAdminMgr) {
      const memberCheck = await executeQuery(
        `SELECT 1 AS ok FROM team_members tm
         INNER JOIN teams t ON tm.team_id = t.team_id
         WHERE tm.user_id = @userId AND tm.is_active = 1
           AND (t.is_central = 1 OR tm.team_id = @currentTeamId)`,
        { userId, currentTeamId: ticket.team_id || 0 }
      );
      if (!memberCheck.recordset.length) {
        return res.status(403).json(
          createResponse(false, 'Only central team members, managers, or admins can route tickets')
        );
      }
    }

    // Route the ticket
    await executeQuery(
      `UPDATE tickets
       SET team_id            = @targetTeamId,
           routed_by_user_id  = @userId,
           routed_at          = GETDATE(),
           updated_at         = GETDATE()
       WHERE ticket_id = @ticketId`,
      { targetTeamId, userId, ticketId }
    );

    // Audit trail
    await executeQuery(
      `INSERT INTO ticket_activities
         (ticket_id, activity_type, field_name, old_value, new_value, description, performed_by)
       VALUES
         (@ticketId, 'ROUTED', 'team_id', @oldTeam, @newTeam, @desc, @userId)`,
      {
        ticketId,
        oldTeam: ticket.team_id ? `Team #${ticket.team_id}` : 'Unrouted',
        newTeam: teamCheck.recordset[0].team_name,
        desc:    `Ticket routed to ${teamCheck.recordset[0].team_name}`,
        userId,
      }
    );

    // In-app notifications to target team members
    try {
      await executeQuery(
        `INSERT INTO notifications (user_id, notification_type, title, message, related_ticket_id)
         SELECT tm.user_id, 'TICKET_ROUTED',
           'New Ticket in Your Team Bucket',
           'Ticket #' + @ticketNumber + ' - ' + @subject + ' has been routed to your team.',
           @ticketId
         FROM team_members tm
         WHERE tm.team_id = @targetTeamId AND tm.is_active = 1 AND tm.user_id != @userId`,
        {
          ticketNumber: ticket.ticket_number,
          subject:      ticket.subject,
          ticketId,
          targetTeamId,
          userId,
        }
      );
    } catch (notifErr) {
      logger.warn('Notify failed for ticket route', { ticketId, error: notifErr.message });
    }

    return res.status(200).json(
      createResponse(true, `Ticket #${ticket.ticket_number} routed to ${teamCheck.recordset[0].team_name}`, {
        ticket_id:   ticketId,
        new_team_id: targetTeamId,
        new_team:    teamCheck.recordset[0].team_name,
      })
    );
  } catch (error) {
    logger.error('routeTicketToTeam error', error);
    next(error);
  }
};

// ==============================================================
// RESET TICKET PRIORITY (triggers SLA recalc)
// ==============================================================
/**
 * PUT /api/v1/team-bucket/:id/priority
 * Change a ticket's priority.  SLA due date is recalculated.
 * Body: { priority_id }
 *
 * Access: ADMIN, MANAGER, or team manager of the ticket's current team.
 */
const resetTicketPriority = async (req, res, next) => {
  try {
    const ticketId   = parseInt(req.params.id);
    const priorityId = parseInt(req.body.priority_id);
    const userId     = req.user.user_id;
    const roleCode   = req.user.role?.role_code || '';

    if (isNaN(ticketId) || isNaN(priorityId)) {
      return res.status(400).json(createResponse(false, 'Invalid ticket_id or priority_id'));
    }

    // Verify priority
    const priorityCheck = await executeQuery(
      'SELECT priority_id, priority_name FROM ticket_priorities WHERE priority_id = @priorityId AND is_active = 1',
      { priorityId }
    );
    if (!priorityCheck.recordset.length) {
      return res.status(404).json(createResponse(false, 'Priority not found'));
    }

    // Fetch ticket
    const ticketResult = await executeQuery(
      `SELECT t.ticket_id, t.ticket_number, t.category_id, t.priority_id,
              t.team_id, ts.is_final_status,
              tp_old.priority_name AS old_priority_name
       FROM tickets t
       LEFT JOIN ticket_statuses  ts     ON t.status_id   = ts.status_id
       LEFT JOIN ticket_priorities tp_old ON t.priority_id = tp_old.priority_id
       WHERE t.ticket_id = @ticketId`,
      { ticketId }
    );
    if (!ticketResult.recordset.length) {
      return res.status(404).json(createResponse(false, 'Ticket not found'));
    }
    const ticket = ticketResult.recordset[0];
    if (ticket.is_final_status) {
      return res.status(400).json(createResponse(false, 'Cannot change priority of a closed ticket'));
    }

    // Authorization: ADMIN/MANAGER/CENTRAL_MGMT or team manager or central-team member
    const isAdminMgr = roleCode === 'ADMIN' || roleCode === 'MANAGER' || roleCode === 'CENTRAL_MGMT';
    if (!isAdminMgr && ticket.team_id) {
      // Allow if user is the team manager of the ticket's team
      const teamMgrCheck = await executeQuery(
        'SELECT team_manager_id FROM teams WHERE team_id = @teamId AND team_manager_id = @userId',
        { teamId: ticket.team_id, userId }
      );
      // Also allow if user is a member of any central team
      const centralMemberCheck = await executeQuery(
        `SELECT tm.team_member_id
         FROM team_members tm
         INNER JOIN teams t ON tm.team_id = t.team_id
         WHERE tm.user_id = @userId AND t.is_central = 1 AND tm.is_active = 1`,
        { userId }
      );
      if (!teamMgrCheck.recordset.length && !centralMemberCheck.recordset.length) {
        return res.status(403).json(
          createResponse(false, 'Only ticket team managers, managers, admins, or central team members can change priority')
        );
      }
    }

    // Recalculate SLA due date
    const slaSettings = await settingsService.getByCategory('sla');
    let newDueDate = null;
    if (slaSettings.sla_enabled === 'true' || slaSettings.sla_enabled === true) {
      const slaHours = await slaService.getSLAPolicyHours(ticket.category_id, priorityId);
      newDueDate = await slaService.calculateDueDate(new Date(), slaHours);
    }

    await executeQuery(
      `UPDATE tickets SET priority_id = @priorityId, due_date = @dueDate, updated_at = GETDATE()
       WHERE ticket_id = @ticketId`,
      { ticketId, priorityId, dueDate: newDueDate }
    );

    // Audit trail
    await executeQuery(
      `INSERT INTO ticket_activities
         (ticket_id, activity_type, field_name, old_value, new_value, description, performed_by)
       VALUES
         (@ticketId, 'UPDATED', 'priority_id', @oldPriority, @newPriority, @desc, @userId)`,
      {
        ticketId,
        oldPriority: ticket.old_priority_name,
        newPriority: priorityCheck.recordset[0].priority_name,
        desc:        `Priority changed from ${ticket.old_priority_name} to ${priorityCheck.recordset[0].priority_name}; SLA recalculated`,
        userId,
      }
    );

    return res.status(200).json(
      createResponse(true, 'Priority updated and SLA recalculated', {
        ticket_id:    ticketId,
        priority_id:  priorityId,
        priority_name: priorityCheck.recordset[0].priority_name,
        new_due_date: newDueDate,
      })
    );
  } catch (error) {
    logger.error('resetTicketPriority error', error);
    next(error);
  }
};

// ==============================================================
// EXPORTS
// ==============================================================
module.exports = {
  getTeamBucketTickets,
  getTeamBucketStats,
  selfAssignFromTeamBucket,
  routeTicketToTeam,
  resetTicketPriority,
};

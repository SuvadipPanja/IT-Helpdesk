/**
 * Team-scoped approvers for mid-ticket approval workflow.
 * Engineers (and non-ADMIN staff) may only select their ticket's team manager(s).
 *
 * Rules:
 * - If ticket.team_id is set: approver must be teams.team_manager_id for that team,
 *   and the requester must be the assigned engineer who is allowed to request
 *   (membership in that team OR assigned_to on the ticket for that team context).
 * - If ticket.team_id is null: any team_manager for teams where the requester is an active member.
 */

const { executeQuery } = require('../config/database');

/**
 * @param {number} ticketId
 * @param {number} requesterUserId - user raising the approval (usually assigned engineer)
 * @param {{ ignoreTeamMembership?: boolean }} [options] — MANAGER/CENTRAL may request on behalf; still pick ticket's team manager
 * @returns {Promise<number[]>} user_ids allowed as approver
 */
async function getEligibleTeamManagerApproverIds(ticketId, requesterUserId, options = {}) {
  const { ignoreTeamMembership = false } = options;

  const tRes = await executeQuery(
    `SELECT ticket_id, team_id, assigned_to FROM tickets WHERE ticket_id = @ticketId`,
    { ticketId }
  );
  if (!tRes.recordset?.length) return [];

  const { team_id: teamId, assigned_to: assignedTo } = tRes.recordset[0];

  if (teamId != null) {
    const mgr = await executeQuery(
      `
      SELECT t.team_manager_id AS user_id
      FROM teams t
      WHERE t.team_id = @teamId
        AND t.is_active = 1
        AND t.team_manager_id IS NOT NULL
        AND (
          @ignoreMembership = 1
          OR EXISTS (
            SELECT 1 FROM team_members tm
            WHERE tm.team_id = @teamId AND tm.user_id = @requesterUserId AND tm.is_active = 1
          )
          OR @assignedTo = @requesterUserId
        )
      `,
      { teamId, requesterUserId, assignedTo, ignoreMembership: ignoreTeamMembership ? 1 : 0 }
    );
    const id = mgr.recordset?.[0]?.user_id;
    return id ? [id] : [];
  }

  const multi = await executeQuery(
    `
    SELECT DISTINCT t.team_manager_id AS user_id
    FROM team_members tm
    INNER JOIN teams t ON tm.team_id = t.team_id AND t.is_active = 1
    WHERE tm.user_id = @requesterUserId
      AND tm.is_active = 1
      AND t.team_manager_id IS NOT NULL
    `,
    { requesterUserId }
  );
  return (multi.recordset || []).map((r) => r.user_id).filter(Boolean);
}

/**
 * Full rows for UI dropdown (same shape as legacy getApprovers).
 * @param {number[]} userIds
 */
async function fetchApproverRowsByIds(userIds) {
  if (!userIds.length) return [];
  const placeholders = userIds.map((_, i) => `@id${i}`).join(', ');
  const params = {};
  userIds.forEach((id, i) => {
    params[`id${i}`] = id;
  });
  const result = await executeQuery(
    `
    SELECT
      u.user_id,
      u.first_name + ' ' + u.last_name AS full_name,
      u.email,
      r.role_name,
      r.role_code,
      d.department_name,
      mgrteam.team_name
    FROM users u
    INNER JOIN user_roles r ON u.role_id = r.role_id
    LEFT JOIN departments d ON u.department_id = d.department_id
    OUTER APPLY (
      SELECT TOP 1 t2.team_name
      FROM teams t2
      WHERE t2.team_manager_id = u.user_id AND t2.is_active = 1
      ORDER BY t2.team_name
    ) mgrteam
    WHERE u.user_id IN (${placeholders})
      AND u.is_active = 1
      AND u.is_locked = 0
    ORDER BY u.first_name, u.last_name
    `,
    params
  );
  return result.recordset || [];
}

module.exports = {
  getEligibleTeamManagerApproverIds,
  fetchApproverRowsByIds,
};

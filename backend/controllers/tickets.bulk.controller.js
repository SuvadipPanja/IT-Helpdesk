// ============================================================
// BULK TICKETS CONTROLLER
// Perform operations on multiple tickets in one request.
// Supported actions: assign, close, change_priority, change_status
// Only ADMIN / IT_STAFF can use bulk operations.
// ============================================================

const { executeQuery } = require('../config/database');
const { createResponse } = require('../utils/helpers');
const logger = require('../utils/logger');

// Maximum tickets per bulk operation (prevents abuse)
const MAX_BULK_SIZE = 50;

/**
 * POST /api/v1/tickets/bulk
 * Body: { action, ticket_ids[], [assignee_id], [priority_id], [status_id] }
 */
const bulkAction = async (req, res, next) => {
  try {
    const { action, ticket_ids, assignee_id, priority_id, status_id } = req.body;
    const actorId = req.user.user_id;

    // -------------------------
    // Input validation
    // -------------------------
    if (!action) {
      return res.status(400).json(createResponse(false, 'action is required'));
    }

    if (!Array.isArray(ticket_ids) || ticket_ids.length === 0) {
      return res.status(400).json(createResponse(false, 'ticket_ids must be a non-empty array'));
    }

    if (ticket_ids.length > MAX_BULK_SIZE) {
      return res.status(400).json(
        createResponse(false, `Cannot process more than ${MAX_BULK_SIZE} tickets at once`)
      );
    }

    // Ensure all IDs are valid integers
    const ids = ticket_ids.map(id => parseInt(id)).filter(id => !isNaN(id) && id > 0);
    if (ids.length === 0) {
      return res.status(400).json(createResponse(false, 'No valid ticket IDs provided'));
    }

    const VALID_ACTIONS = ['assign', 'close', 'change_priority', 'change_status'];
    if (!VALID_ACTIONS.includes(action)) {
      return res.status(400).json(
        createResponse(false, `Invalid action. Valid: ${VALID_ACTIONS.join(', ')}`)
      );
    }

    // -------------------------
    // Build parameterised ID list
    // Each id gets its own named param (id0, id1, ...) to avoid SQL injection
    // -------------------------
    const idParams = {};
    ids.forEach((id, i) => { idParams[`id${i}`] = id; });
    const idPlaceholders = ids.map((_, i) => `@id${i}`).join(', ');

    let rowsAffected = 0;

    // -------------------------
    // Dispatch by action
    // -------------------------
    if (action === 'assign') {
      const toUserId = parseInt(assignee_id);
      if (!toUserId || isNaN(toUserId)) {
        return res.status(400).json(createResponse(false, 'assignee_id is required for assign'));
      }
      const result = await executeQuery(
        `UPDATE tickets SET assigned_to = @assignee, updated_at = GETUTCDATE()
         WHERE ticket_id IN (${idPlaceholders})`,
        { assignee: toUserId, ...idParams }
      );
      rowsAffected = result.rowsAffected?.[0] ?? ids.length;
      logger.info('Bulk assign', { actor: actorId, tickets: ids, assignee: toUserId });

    } else if (action === 'close') {
      const statusRes = await executeQuery(
        `SELECT TOP 1 status_id FROM ticket_statuses WHERE LOWER(status_code) IN ('closed','close') ORDER BY status_id`
      );
      const closedStatusId = statusRes.recordset?.[0]?.status_id;
      if (!closedStatusId) {
        return res.status(500).json(createResponse(false, 'Could not find Closed status'));
      }
      const result = await executeQuery(
        `UPDATE tickets SET status_id = @statusId, closed_at = GETUTCDATE(), updated_at = GETUTCDATE()
         WHERE ticket_id IN (${idPlaceholders})`,
        { statusId: closedStatusId, ...idParams }
      );
      rowsAffected = result.rowsAffected?.[0] ?? ids.length;
      logger.info('Bulk close', { actor: actorId, tickets: ids });

    } else if (action === 'change_priority') {
      const pId = parseInt(priority_id);
      if (!pId || isNaN(pId)) {
        return res.status(400).json(createResponse(false, 'priority_id is required'));
      }
      const result = await executeQuery(
        `UPDATE tickets SET priority_id = @priorityId, updated_at = GETUTCDATE()
         WHERE ticket_id IN (${idPlaceholders})`,
        { priorityId: pId, ...idParams }
      );
      rowsAffected = result.rowsAffected?.[0] ?? ids.length;
      logger.info('Bulk priority change', { actor: actorId, tickets: ids, priority: pId });

    } else if (action === 'change_status') {
      const sId = parseInt(status_id);
      if (!sId || isNaN(sId)) {
        return res.status(400).json(createResponse(false, 'status_id is required'));
      }
      const result = await executeQuery(
        `UPDATE tickets SET status_id = @sId, updated_at = GETUTCDATE()
         WHERE ticket_id IN (${idPlaceholders})`,
        { sId, ...idParams }
      );
      rowsAffected = result.rowsAffected?.[0] ?? ids.length;
      logger.info('Bulk status change', { actor: actorId, tickets: ids, status: sId });
    }

    return res.json(
      createResponse(true, `${action} applied to ${rowsAffected} ticket(s)`, { affected: rowsAffected })
    );

  } catch (err) {
    logger.error('bulkAction error', { error: err?.message });
    next(err);
  }
};

module.exports = { bulkAction };

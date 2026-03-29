// ============================================
// WhatsApp Notification Service
// Sends ticket event notifications via WhatsApp.
// Uses the whatsappTemplates service for variable-rich
// message templates that mirror the email template system.
//
// Notification types covered:
//   notifyTicketCreated       — requester confirmation
//   notifyTicketAssigned      — engineer + requester
//   notifyStatusChanged       — requester + engineer
//   notifyCommentAdded        — other party on ticket
//   notifySLAWarning          — assigned engineer
//   notifySLABreach           — engineer + requester
//   notifyPendingInfo         — requester
//   notifyApprovalRequest     — approver (new)
//   notifyApprovalDecision    — engineer who raised it + requester (new)
//   notifyTicketEscalated     — requester + assigned engineer (new)
//   notifyTicketReopened      — engineer (new)
//   notifyRatingRequest       — requester (new)
// ============================================

const { executeQuery } = require('../config/database');
const settingsService = require('./settings.service');
const whatsappService = require('./whatsappService');
const waTemplates = require('./whatsappTemplates.service');
const logger = require('../utils/logger');

// ── User lookup ───────────────────────────────────────────────────────────────

/**
 * Get a user's WhatsApp phone + opt-in status
 * @returns {{ phone: string|null, optedIn: boolean }} or null if user not found
 */
const getUserWAData = async (userId) => {
  if (!userId) return null;
  try {
    const r = await executeQuery(
      `SELECT whatsapp_phone, whatsapp_opted_in FROM users WHERE user_id = @userId AND is_active = 1`,
      { userId }
    );
    const row = r.recordset[0];
    if (!row || !row.whatsapp_opted_in || !row.whatsapp_phone) return null;
    return { phone: row.whatsapp_phone, optedIn: true };
  } catch {
    return null;
  }
};

/**
 * Fetch user_channel_preferences row for a user+channel
 * Returns the row or null (meaning "use defaults — notify everything")
 */
const getChannelPrefs = async (userId) => {
  try {
    const r = await executeQuery(
      `SELECT * FROM user_channel_preferences WHERE user_id = @userId AND channel = 'whatsapp'`,
      { userId }
    );
    return r.recordset[0] || null;
  } catch {
    return null;
  }
};

/**
 * Check master system setting and per-user prefs for a given event column
 * @param {number} userId
 * @param {string} prefColumn - column name in user_channel_preferences
 * @returns {Promise<{allowed: boolean, phone: string|null}>}
 */
const canNotify = async (userId, prefColumn) => {
  // System-level check
  const notifyEnabled = await settingsService.get('whatsapp_notify_enabled');
  if (notifyEnabled !== 'true' && notifyEnabled !== true) return { allowed: false, phone: null };

  const waEnabled = await settingsService.get('whatsapp_enabled');
  if (waEnabled !== 'true' && waEnabled !== true) return { allowed: false, phone: null };

  // User opt-in check
  const userData = await getUserWAData(userId);
  if (!userData) return { allowed: false, phone: null };

  // Per-user channel prefs (if row exists)
  const prefs = await getChannelPrefs(userId);
  if (prefs) {
    if (!prefs.is_enabled) return { allowed: false, phone: null };
    if (prefColumn && prefs[prefColumn] === false) return { allowed: false, phone: null };
  }

  return { allowed: true, phone: userData.phone };
};

/**
 * Fire-and-forget send — wraps whatsappService.sendTextMessage, never throws
 */
const send = async (phone, message, meta = {}) => {
  try {
    await whatsappService.sendTextMessage(phone, message, meta);
  } catch (err) {
    logger.warn('WhatsApp notification send failed (non-blocking)', { error: err.message, phone: phone?.slice(-4) });
  }
};

// ── Notification Methods ──────────────────────────────────────────────────────

/**
 * Ticket Created — notify the requester (confirmation)
 */
const notifyTicketCreated = async (requesterId, { ticketNumber, subject, priority, ticketId, departmentName }) => {
  const { allowed, phone } = await canNotify(requesterId, 'notify_new_ticket');
  if (!allowed) return;

  const msg = await waTemplates.getMessage('TICKET_CREATED', {
    ticket_number: ticketNumber, subject, priority: priority || 'Normal',
    ticket_id: ticketId, department_name: departmentName || '',
  });
  await send(phone, msg, { ticketId });
};

/**
 * Ticket Assigned — notify the engineer AND requester
 */
const notifyTicketAssigned = async (engineerId, requesterId, {
  ticketNumber, subject, priority, assignerName, engineerName, ticketId, departmentName
}) => {
  // Notify engineer
  const eng = await canNotify(engineerId, 'notify_assigned');
  if (eng.allowed) {
    const msg = await waTemplates.getMessage('TICKET_ASSIGNED_ENGINEER', {
      ticket_number: ticketNumber, subject, priority: priority || 'Normal',
      assigner_name: assignerName || 'System', ticket_id: ticketId,
      department_name: departmentName || '',
    });
    await send(eng.phone, msg, { ticketId });
  }

  // Notify requester (if different user)
  if (requesterId && requesterId !== engineerId) {
    const req = await canNotify(requesterId, 'notify_assigned');
    if (req.allowed) {
      const msg = await waTemplates.getMessage('TICKET_ASSIGNED_REQUESTER', {
        ticket_number: ticketNumber, subject, priority: priority || 'Normal',
        engineer_name: engineerName || 'an engineer', ticket_id: ticketId,
      });
      await send(req.phone, msg, { ticketId });
    }
  }
};

/**
 * Status Changed — notify requester and assigned engineer
 */
const notifyStatusChanged = async (requesterId, assignedId, actorId, {
  ticketNumber, subject, oldStatus, newStatus, updaterName, ticketId
}) => {
  const isResolved = /resolv|close|done|complet/i.test(newStatus);
  const prefColumn = isResolved ? 'notify_resolved' : 'notify_update';
  const reqTemplate = isResolved ? 'TICKET_RESOLVED_REQUESTER' : 'TICKET_STATUS_CHANGED_REQUESTER';
  const vars = {
    ticket_number: ticketNumber, subject, old_status: oldStatus,
    new_status: newStatus, updater_name: updaterName, ticket_id: ticketId,
  };

  // Notify requester (if not the one making the change)
  if (requesterId !== actorId) {
    const req = await canNotify(requesterId, prefColumn);
    if (req.allowed) {
      const msg = await waTemplates.getMessage(reqTemplate, vars);
      await send(req.phone, msg, { ticketId });
    }
  }

  // Notify engineer (if different from requester and actor)
  if (assignedId && assignedId !== actorId && assignedId !== requesterId) {
    const eng = await canNotify(assignedId, prefColumn);
    if (eng.allowed) {
      const msg = await waTemplates.getMessage('TICKET_STATUS_CHANGED_ENGINEER', vars);
      await send(eng.phone, msg, { ticketId });
    }
  }
};

/**
 * Comment Added — notify the other party
 */
const notifyCommentAdded = async (requesterId, assignedId, commenterId, {
  ticketNumber, subject, commentPreview, commenterName, ticketId
}) => {
  const vars = {
    ticket_number: ticketNumber, subject, ticket_id: ticketId,
    comment_preview: (commentPreview || '').substring(0, 200),
    commenter_name: commenterName,
  };

  // Notify requester if they didn't comment
  if (requesterId !== commenterId) {
    const req = await canNotify(requesterId, 'notify_comment');
    if (req.allowed) {
      const msg = await waTemplates.getMessage('TICKET_COMMENT_ADDED', vars);
      await send(req.phone, msg, { ticketId });
    }
  }

  // Notify engineer if they didn't comment
  if (assignedId && assignedId !== commenterId) {
    const eng = await canNotify(assignedId, 'notify_comment');
    if (eng.allowed) {
      const msg = await waTemplates.getMessage('TICKET_COMMENT_ADDED', vars);
      await send(eng.phone, msg, { ticketId });
    }
  }
};

/**
 * SLA Warning — notify assigned engineer
 */
const notifySLAWarning = async (assignedId, { ticketNumber, subject, remainingHours, percentage, ticketId }) => {
  if (!assignedId) return;
  const { allowed, phone } = await canNotify(assignedId, 'notify_sla_breach');
  if (!allowed) return;

  const msg = await waTemplates.getMessage('TICKET_SLA_WARNING', {
    ticket_number: ticketNumber, subject, ticket_id: ticketId,
    remaining_hours: remainingHours, sla_percentage: percentage,
  });
  await send(phone, msg, { ticketId });
};

/**
 * SLA Breach — notify assigned engineer and requester
 */
const notifySLABreach = async (assignedId, requesterId, { ticketNumber, subject, elapsedHours, ticketId }) => {
  if (assignedId) {
    const eng = await canNotify(assignedId, 'notify_sla_breach');
    if (eng.allowed) {
      const msg = await waTemplates.getMessage('TICKET_SLA_BREACHED_ENGINEER', {
        ticket_number: ticketNumber, subject, ticket_id: ticketId, elapsed_hours: elapsedHours,
      });
      await send(eng.phone, msg, { ticketId });
    }
  }

  if (requesterId) {
    const req = await canNotify(requesterId, 'notify_sla_breach');
    if (req.allowed) {
      const msg = await waTemplates.getMessage('TICKET_SLA_BREACHED_REQUESTER', {
        ticket_number: ticketNumber, subject, ticket_id: ticketId, elapsed_hours: elapsedHours,
      });
      await send(req.phone, msg, { ticketId });
    }
  }
};

/**
 * Pending Info — engineer requests more details from requester
 */
const notifyPendingInfo = async (requesterId, { ticketNumber, subject, engineerName, requestNote, ticketId }) => {
  const { allowed, phone } = await canNotify(requesterId, 'notify_update');
  if (!allowed) return;

  const noteClean = requestNote ? (String(requestNote).trim().substring(0, 280)) : '';
  const vars = {
    ticket_number: ticketNumber, subject, ticket_id: ticketId,
    engineer_name: engineerName || 'Your engineer',
    request_note_line: noteClean ? `📝 "${noteClean}"` : '',
  };
  const msg = await waTemplates.getMessage('TICKET_PENDING_INFO', vars);
  await send(phone, msg, { ticketId });
};

// ── New Notification Functions ────────────────────────────────────────────────

/**
 * Approval Request — notify the approver that their decision is needed
 * @param {number} approverId
 * @param {number} requestedById - engineer who raised the approval
 * @param {{ ticketNumber, subject, priority, departmentName, approvalNote, approverName, engineerName, ticketId }} data
 */
const notifyApprovalRequest = async (approverId, requestedById, {
  ticketNumber, subject, priority, departmentName, approvalNote, approverName, engineerName, ticketId
}) => {
  if (!approverId) return;
  const { allowed, phone } = await canNotify(approverId, 'notify_approval');
  if (!allowed) return;

  const msg = await waTemplates.getMessage('TICKET_APPROVAL_REQUEST', {
    ticket_number: ticketNumber, subject, priority: priority || 'Normal',
    department_name: departmentName || '',
    approval_note: approvalNote ? String(approvalNote).trim().substring(0, 280) : 'No note provided',
    approver_name: approverName || 'Approver',
    engineer_name: engineerName || 'Engineer',
    ticket_id: ticketId,
  });
  await send(phone, msg, { ticketId });
};

/**
 * Approval Decision — notify the engineer who raised the approval, and optionally the requester
 * @param {number} requestedById - engineer who raised the approval
 * @param {number|null} requesterId - ticket requester (for APPROVED decisions)
 * @param {{ ticketNumber, subject, decision, decisionNote, approverName, ticketId }} data
 */
const notifyApprovalDecision = async (requestedById, requesterId, {
  ticketNumber, subject, decision, decisionNote, approverName, ticketId
}) => {
  const decisionLabel = decision === 'APPROVED' ? '✅ APPROVED' : '❌ REJECTED';
  const noteClean = decisionNote ? String(decisionNote).trim().substring(0, 280) : '';
  const vars = {
    ticket_number: ticketNumber, subject, ticket_id: ticketId,
    decision: decisionLabel,
    approver_name: approverName || 'Approver',
    decision_note_line: noteClean ? `📝 Note: "${noteClean}"` : '',
  };

  // Notify engineer (who raised the request)
  if (requestedById) {
    const eng = await canNotify(requestedById, 'notify_approval');
    if (eng.allowed) {
      const msg = await waTemplates.getMessage('TICKET_APPROVAL_DECIDED_ENGINEER', vars);
      await send(eng.phone, msg, { ticketId });
    }
  }

  // Notify requester (only if approved and different from engineer)
  if (requesterId && requesterId !== requestedById && decision === 'APPROVED') {
    const req = await canNotify(requesterId, 'notify_approval');
    if (req.allowed) {
      const msg = await waTemplates.getMessage('TICKET_APPROVAL_DECIDED_REQUESTER', vars);
      await send(req.phone, msg, { ticketId });
    }
  }
};

/**
 * Ticket Escalated — notify requester + assigned engineer
 * @param {number|null} assignedId
 * @param {number} requesterId
 * @param {{ ticketNumber, subject, priority, updaterName, ticketId }} data
 */
const notifyTicketEscalated = async (assignedId, requesterId, {
  ticketNumber, subject, priority, updaterName, ticketId
}) => {
  const vars = {
    ticket_number: ticketNumber, subject, ticket_id: ticketId,
    priority: priority || 'Normal', updater_name: updaterName || 'System',
  };

  if (requesterId) {
    const req = await canNotify(requesterId, 'notify_update');
    if (req.allowed) {
      const msg = await waTemplates.getMessage('TICKET_ESCALATED_REQUESTER', vars);
      await send(req.phone, msg, { ticketId });
    }
  }

  if (assignedId && assignedId !== requesterId) {
    const eng = await canNotify(assignedId, 'notify_update');
    if (eng.allowed) {
      const msg = await waTemplates.getMessage('TICKET_ESCALATED_ENGINEER', vars);
      await send(eng.phone, msg, { ticketId });
    }
  }
};

/**
 * Ticket Reopened — notify assigned engineer
 * @param {number|null} assignedId
 * @param {number} requesterId
 * @param {{ ticketNumber, subject, updaterName, ticketId }} data
 */
const notifyTicketReopened = async (assignedId, requesterId, {
  ticketNumber, subject, updaterName, ticketId
}) => {
  const vars = {
    ticket_number: ticketNumber, subject, ticket_id: ticketId,
    updater_name: updaterName || 'User',
  };

  // Notify engineer
  if (assignedId) {
    const eng = await canNotify(assignedId, 'notify_update');
    if (eng.allowed) {
      const msg = await waTemplates.getMessage('TICKET_REOPENED_ENGINEER', vars);
      await send(eng.phone, msg, { ticketId });
    }
  }

  // Notify requester if they didn't reopen it themselves (actor != requester handled by caller)
  if (requesterId && requesterId !== assignedId) {
    const req = await canNotify(requesterId, 'notify_update');
    if (req.allowed) {
      // Reuse the engineer template — both get the same "ticket reopened" message
      const msg = await waTemplates.getMessage('TICKET_REOPENED_ENGINEER', vars);
      await send(req.phone, msg, { ticketId });
    }
  }
};

/**
 * Rating Request — ask requester to rate the resolved ticket
 * @param {number} requesterId
 * @param {{ ticketNumber, subject, ticketId }} data
 */
const notifyRatingRequest = async (requesterId, { ticketNumber, subject, ticketId }) => {
  if (!requesterId) return;
  const { allowed, phone } = await canNotify(requesterId, 'notify_resolved');
  if (!allowed) return;

  // Build the rating URL (pointing to ticket detail page)
  const ctx = await waTemplates.getGlobalContext();
  const ratingUrl = `${ctx.system_url}/tickets/${ticketId}`;

  const msg = await waTemplates.getMessage('TICKET_RATING_REQUEST', {
    ticket_number: ticketNumber, subject, ticket_id: ticketId, rating_url: ratingUrl,
  });
  await send(phone, msg, { ticketId });
};

// ── Outage Notification Methods ───────────────────────────────────────────────

/**
 * Outage Published — notify a list of audience-matched users
 * @param {Array<{user_id: number}>} users — audience-matched user list
 * @param {{ title: string, severity: string, details: string }} data
 */
const notifyOutagePublished = async (users, { title, severity, details }) => {
  if (!users?.length) return;
  for (const u of users) {
    try {
      const { allowed, phone } = await canNotify(u.user_id, 'notify_update');
      if (!allowed) continue;
      const msg = await waTemplates.getMessage('OUTAGE_PUBLISHED', {
        outage_title: title, outage_severity: severity || 'Unknown', outage_details: details || '',
      });
      await send(phone, msg, { type: 'outage_published' });
    } catch { /* fire-and-forget */ }
  }
};

/**
 * Outage Resolved — notify a list of audience-matched users
 * @param {Array<{user_id: number}>} users — audience-matched user list
 * @param {{ title: string }} data
 */
const notifyOutageResolved = async (users, { title }) => {
  if (!users?.length) return;
  for (const u of users) {
    try {
      const { allowed, phone } = await canNotify(u.user_id, 'notify_resolved');
      if (!allowed) continue;
      const msg = await waTemplates.getMessage('OUTAGE_RESOLVED', {
        outage_title: title,
      });
      await send(phone, msg, { type: 'outage_resolved' });
    } catch { /* fire-and-forget */ }
  }
};

// ── User Preferences API helpers ──────────────────────────────────────────────

/**
 * Get or create a user's WhatsApp channel preferences
 */
const getUserPreferences = async (userId) => {
  const r = await executeQuery(
    `SELECT * FROM user_channel_preferences WHERE user_id = @userId AND channel = 'whatsapp'`,
    { userId }
  );
  if (r.recordset[0]) return r.recordset[0];

  // Return sensible defaults (not persisted until user saves)
  return {
    is_enabled: true,
    notify_new_ticket: true,
    notify_update: true,
    notify_resolved: true,
    notify_sla_breach: true,
    notify_assigned: true,
    notify_comment: true,
    notify_approval: true,
  };
};

/**
 * Upsert user_channel_preferences
 */
const setUserPreferences = async (userId, prefs) => {
  const exists = await executeQuery(
    `SELECT 1 FROM user_channel_preferences WHERE user_id = @userId AND channel = 'whatsapp'`,
    { userId }
  );

  const p = {
    userId,
    isEnabled: prefs.is_enabled !== false,
    notifyNewTicket: prefs.notify_new_ticket !== false,
    notifyUpdate: prefs.notify_update !== false,
    notifyResolved: prefs.notify_resolved !== false,
    notifySla: prefs.notify_sla_breach !== false,
    notifyAssigned: prefs.notify_assigned !== false,
    notifyComment: prefs.notify_comment !== false,
    notifyApproval: prefs.notify_approval !== false,
  };

  if (exists.recordset.length > 0) {
    await executeQuery(`
      UPDATE user_channel_preferences
      SET is_enabled = @isEnabled,
          notify_new_ticket = @notifyNewTicket,
          notify_update = @notifyUpdate,
          notify_resolved = @notifyResolved,
          notify_sla_breach = @notifySla,
          notify_assigned = @notifyAssigned,
          notify_comment = @notifyComment,
          notify_approval = @notifyApproval,
          updated_at = GETDATE()
      WHERE user_id = @userId AND channel = 'whatsapp'
    `, p);
  } else {
    await executeQuery(`
      INSERT INTO user_channel_preferences
        (user_id, channel, is_enabled, notify_new_ticket, notify_update, notify_resolved,
         notify_sla_breach, notify_assigned, notify_comment, notify_approval)
      VALUES
        (@userId, 'whatsapp', @isEnabled, @notifyNewTicket, @notifyUpdate, @notifyResolved,
         @notifySla, @notifyAssigned, @notifyComment, @notifyApproval)
    `, p);
  }
};

module.exports = {
  // Existing notifications
  notifyTicketCreated,
  notifyTicketAssigned,
  notifyStatusChanged,
  notifyCommentAdded,
  notifySLAWarning,
  notifySLABreach,
  notifyPendingInfo,
  // New notifications
  notifyApprovalRequest,
  notifyApprovalDecision,
  notifyTicketEscalated,
  notifyTicketReopened,
  notifyRatingRequest,
  // Outage notifications
  notifyOutagePublished,
  notifyOutageResolved,
  // User preferences
  getUserPreferences,
  setUserPreferences,
};

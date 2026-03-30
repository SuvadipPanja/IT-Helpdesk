// ============================================
// WhatsApp Bot Bridge — Phase 9
// Bridges incoming WhatsApp messages ↔ existing Nexus bot engine
// Reuses ALL NLP, intents, AI, and session infrastructure
// ============================================

const { executeQuery, executeInTransaction, executeInTransactionQuery } = require('../config/database');
const logger = require('../utils/logger');
const settingsService = require('./settings.service');
const slaService = require('./sla.service');
const autoAssignmentService = require('./autoAssignment.service');

// ── Bot engine services (same as ai.routes.js) ───────────────────────────────
const { handleChat, processQuery, resolveSecurityPlaceholders } = require('./ai-engine.service');
const botPhase2Service = require('./botPhase2.service');
const botApiIntegrationService = require('./botApiIntegrationService');
const botApiProviderService = require('./botApiProviderService');
const botSessionService = require('./botSessionService');
const botTrainingService = require('./botTrainingService');
const spellingService = require('./spellingCorrection.service');
const userIntelligence = require('./botUserIntelligence.service');
const botBehaviorConfig = require('./botBehaviorConfig.service');
const botKnowledgeGroundingService = require('./botKnowledgeGrounding.service');
const botDataQueryService = require('./botDataQuery.service');

// ── WhatsApp services ─────────────────────────────────────────────────────────
const whatsappService = require('./whatsappService');const whatsappMediaService = require('./whatsappMediaService');
// ── Constants ─────────────────────────────────────────────────────────────────
const DEFAULT_BOT_NAME = 'IT Support Assistant';
const DEFAULT_CONFIDENCE_THRESHOLD = 0.45;

// ─────────────────────────────────────────────────────────────────────────────
// TICKET CREATION — Multi-step conversation state
// Steps: subject → priority → description → confirm → create
// State auto-expires after 10 minutes of inactivity
// ─────────────────────────────────────────────────────────────────────────────
const _createFlowState = new Map(); // key: user_id, value: { step, data, updatedAt }
const CREATE_FLOW_TTL = 10 * 60 * 1000; // 10 minutes

function getCreateFlowState(userId) {
  const state = _createFlowState.get(userId);
  if (!state) return null;
  if (Date.now() - state.updatedAt > CREATE_FLOW_TTL) {
    _createFlowState.delete(userId);
    return null;
  }
  return state;
}

function setCreateFlowState(userId, step, data = {}) {
  _createFlowState.set(userId, { step, data, updatedAt: Date.now() });
}

function clearCreateFlowState(userId) {
  _createFlowState.delete(userId);
}

const CANCEL_RE = /^\s*(cancel|exit|quit|stop|back|abort)\s*$/i;

/**
 * Handle multi-step ticket creation conversation.
 * Returns { handled: true, answer, followUp } if the message was consumed,
 * or { handled: false } to let normal pipeline continue.
 */
async function handleCreateTicketFlow(user, phone, rawMessage, buttonId, listId) {
  const state = getCreateFlowState(user.user_id);
  if (!state) return { handled: false };

  // Allow cancellation at any step
  if (CANCEL_RE.test(rawMessage)) {
    clearCreateFlowState(user.user_id);
    return {
      handled: true,
      answer: '❌ Ticket creation cancelled.',
      followUp: ['Create a ticket', 'My ticket summary', 'Help'],
    };
  }

  try {
    switch (state.step) {
      case 'await_subject': {
        const subject = rawMessage.trim();
        if (subject.length < 3) {
          return { handled: true, answer: '⚠️ Subject must be at least 3 characters. Please try again:', followUp: [] };
        }
        if (subject.length > 200) {
          return { handled: true, answer: '⚠️ Subject must be 200 characters or fewer. Please try again:', followUp: [] };
        }
        setCreateFlowState(user.user_id, 'await_priority', { ...state.data, subject });

        // Send priority selection via interactive list
        const priorities = await executeQuery(
          `SELECT priority_id, priority_name FROM ticket_priorities WHERE is_active = 1 ORDER BY sort_order ASC, priority_id ASC`
        );
        const rows = priorities.recordset.map(p => ({
          id: `tktpri_${p.priority_id}`,
          title: p.priority_name,
        }));
        if (rows.length > 0) {
          await whatsappService.sendInteractiveList(
            phone,
            '📋 *Step 2/4* — Select a priority:',
            'Choose Priority',
            rows,
            { userId: user.user_id }
          );
          return { handled: true, answer: null, followUp: [] }; // already sent interactively
        }
        // Fallback if no priorities exist — use default
        setCreateFlowState(user.user_id, 'await_description', { ...state.data, subject, priority_id: null, priority_name: 'Default' });
        return { handled: true, answer: '📝 *Step 3/4* — Describe your issue in detail:', followUp: [] };
      }

      case 'await_priority': {
        // Parse priority from interactive list reply or raw text
        let priorityId = null;
        let priorityName = 'Default';

        // Check for interactive list reply (id = tktpri_N)
        const priIdMatch = (listId || buttonId || '').match(/^tktpri_(\d+)$/);
        if (priIdMatch) {
          priorityId = parseInt(priIdMatch[1], 10);
          priorityName = rawMessage; // list title = priority name
        } else {
          // Try to match by name from text
          const priorities = await executeQuery(
            `SELECT priority_id, priority_name FROM ticket_priorities WHERE is_active = 1`
          );
          const match = priorities.recordset.find(p =>
            p.priority_name.toLowerCase() === rawMessage.toLowerCase()
          );
          if (match) {
            priorityId = match.priority_id;
            priorityName = match.priority_name;
          } else {
            // Send the list again
            const rows = priorities.recordset.map(p => ({
              id: `tktpri_${p.priority_id}`,
              title: p.priority_name,
            }));
            await whatsappService.sendInteractiveList(
              phone,
              '⚠️ Please select a valid priority from the list:',
              'Choose Priority',
              rows,
              { userId: user.user_id }
            );
            return { handled: true, answer: null, followUp: [] };
          }
        }

        setCreateFlowState(user.user_id, 'await_description', {
          ...state.data, priority_id: priorityId, priority_name: priorityName,
        });
        return { handled: true, answer: '📝 *Step 3/4* — Describe your issue in detail:', followUp: [] };
      }

      case 'await_description': {
        const description = rawMessage.trim();
        if (description.length < 5) {
          return { handled: true, answer: '⚠️ Description must be at least 5 characters. Please try again:', followUp: [] };
        }
        if (description.length > 4000) {
          return { handled: true, answer: '⚠️ Description must be 4000 characters or fewer. Please try again:', followUp: [] };
        }
        setCreateFlowState(user.user_id, 'await_confirm', { ...state.data, description });

        const summary =
          `📋 *Step 4/4* — Please confirm your ticket:\n\n` +
          `*Subject:* ${state.data.subject}\n` +
          `*Priority:* ${state.data.priority_name}\n` +
          `*Description:* ${description.substring(0, 300)}${description.length > 300 ? '...' : ''}\n\n` +
          `Reply *Yes* to create or *Cancel* to discard.`;

        await whatsappService.sendInteractiveButtons(
          phone,
          summary,
          [
            { id: 'tkt_confirm_yes', title: 'Yes, Create' },
            { id: 'tkt_confirm_no', title: 'Cancel' },
          ],
          { userId: user.user_id }
        );
        return { handled: true, answer: null, followUp: [] };
      }

      case 'await_confirm': {
        const reply = (buttonId || rawMessage || '').toLowerCase().trim();
        const isConfirm = reply === 'tkt_confirm_yes' || /^(yes|confirm|create|ok|sure|y)$/i.test(rawMessage.trim());
        const isCancel = reply === 'tkt_confirm_no' || CANCEL_RE.test(rawMessage);

        if (isCancel) {
          clearCreateFlowState(user.user_id);
          return { handled: true, answer: '❌ Ticket creation cancelled.', followUp: ['Create a ticket', 'My ticket summary'] };
        }
        if (!isConfirm) {
          return { handled: true, answer: '⚠️ Please reply *Yes* to create the ticket or *Cancel* to discard.', followUp: [] };
        }

        // ── Actually create the ticket ─────────────────────────────
        clearCreateFlowState(user.user_id);
        const result = await createTicketFromWhatsApp(user, state.data);
        return {
          handled: true,
          answer: result.answer,
          followUp: ['Last ticket status', 'My ticket summary', 'Help'],
        };
      }

      default:
        clearCreateFlowState(user.user_id);
        return { handled: false };
    }
  } catch (err) {
    logger.error('WA bot: create ticket flow error', { error: err.message, userId: user.user_id, step: state.step });
    clearCreateFlowState(user.user_id);
    return {
      handled: true,
      answer: '❌ Something went wrong creating your ticket. Please try again or use the portal.',
      followUp: ['Create a ticket', 'Help'],
    };
  }
}

/**
 * Insert a ticket into the database — mirrors the logic from tickets.controller.js createTicket
 */
async function createTicketFromWhatsApp(user, data) {
  const { subject, description, priority_id } = data;

  // Fetch settings
  const ticketSettings = await settingsService.getByCategory('ticket');
  const slaSettings = await settingsService.getByCategory('sla');

  const finalPriorityId = priority_id || ticketSettings.ticket_default_priority || 3;
  const finalCategoryId = ticketSettings.ticket_default_category || 9;

  // Ticket number prefix + date
  const prefix = (ticketSettings.ticket_number_prefix || 'TKT').toUpperCase().replace(/[^A-Z]/g, '');
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  // Get default status (Open)
  const statusResult = await executeQuery(
    `SELECT status_id FROM ticket_statuses WHERE status_code = 'OPEN' AND is_active = 1`
  );
  const statusId = statusResult.recordset[0]?.status_id;
  if (!statusId) throw new Error('No OPEN status found in database');

  // SLA due date
  const slaHours = await slaService.getSLAPolicyHours(finalCategoryId, finalPriorityId);
  const slaEnabled = slaSettings.sla_enabled === 'true' || slaSettings.sla_enabled === true;
  const createdAt = new Date();
  const dueDate = slaEnabled ? await slaService.calculateDueDate(createdAt, slaHours) : null;

  // Auto-assignment
  let assignedToId = null;
  try {
    let creatorLocationId = null;
    const creatorResult = await executeQuery(
      `SELECT location_id FROM users WHERE user_id = @userId`,
      { userId: user.user_id }
    );
    if (creatorResult.recordset[0]?.location_id) {
      creatorLocationId = creatorResult.recordset[0].location_id;
    }

    const engineer = await autoAssignmentService.findEngineer({
      departmentId: user.department_id || null,
      priorityId: finalPriorityId,
      categoryId: finalCategoryId,
      locationId: creatorLocationId,
    });
    if (engineer) assignedToId = engineer.user_id;
  } catch (autoErr) {
    logger.warn('WA bot: auto-assignment failed (non-blocking)', { error: autoErr.message });
  }

  // Insert ticket in transaction (atomic ticket_number generation)
  const seqQuery = `
    SELECT ISNULL(MAX(CAST(RIGHT(ticket_number, 4) AS INT)), 0) + 1 AS next_seq
    FROM tickets WITH (UPDLOCK, HOLDLOCK)
    WHERE ticket_number LIKE @ticketPrefix
  `;
  const insertQuery = `
    INSERT INTO tickets (
      ticket_number, subject, description,
      category_id, priority_id, status_id,
      requester_id, department_id, due_date,
      assigned_to, created_by,
      location_id, process_id
    )
    OUTPUT INSERTED.ticket_id
    VALUES (
      @ticketNumber, @subject, @description,
      @categoryId, @priorityId, @statusId,
      @requesterId, @departmentId, @dueDate,
      @assignedTo, @createdBy,
      @locationId, @processId
    )
  `;

  const { ticketId, ticketNumber } = await executeInTransaction(async (transaction) => {
    await executeInTransactionQuery(transaction,
      `EXEC sp_getapplock @Resource = 'ticket_number_gen', @LockMode = 'Exclusive', @LockOwner = 'Transaction'`, {});

    const seqResult = await executeInTransactionQuery(transaction, seqQuery, {
      ticketPrefix: `${prefix}-${dateStr}-%`,
    });
    const sequence = seqResult.recordset[0].next_seq;
    const ticketNumber = `${prefix}-${dateStr}-${String(sequence).padStart(4, '0')}`;

    const insertResult = await executeInTransactionQuery(transaction, insertQuery, {
      ticketNumber,
      subject,
      description,
      categoryId: finalCategoryId,
      priorityId: finalPriorityId,
      statusId,
      requesterId: user.user_id,
      departmentId: user.department_id || null,
      dueDate,
      assignedTo: assignedToId,
      createdBy: user.user_id,
      locationId: user.location_id || null,
      processId: user.process_id || null,
    });

    return { ticketId: insertResult.recordset[0].ticket_id, ticketNumber };
  });

  // Log activity
  await executeQuery(
    `INSERT INTO ticket_activities (ticket_id, activity_type, description, performed_by)
     VALUES (@ticketId, 'CREATED', @desc, @userId)`,
    { ticketId, desc: 'Ticket created via WhatsApp', userId: user.user_id }
  ).catch(() => {});

  // Team routing (simplified — uses same logic as controller)
  try {
    const centralEnabled = await settingsService.get('ticket_central_team_enabled');
    const centralTeamIdSetting = await settingsService.get('ticket_central_team_id');
    const isCentralEnabled = centralEnabled === 'true' || centralEnabled === true;
    const configuredCentralTeamId = parseInt(centralTeamIdSetting) || 0;

    let routedTeamId = null;
    if (isCentralEnabled && configuredCentralTeamId > 0) {
      routedTeamId = configuredCentralTeamId;
    } else {
      const centralTeamResult = await executeQuery(
        'SELECT team_id FROM teams WHERE is_central = 1 AND is_active = 1'
      );
      if (centralTeamResult.recordset.length) {
        routedTeamId = centralTeamResult.recordset[0].team_id;
      }
    }

    if (routedTeamId) {
      await executeQuery(
        `UPDATE tickets SET team_id = @teamId, routed_at = GETDATE(), updated_at = GETDATE() WHERE ticket_id = @ticketId`,
        { teamId: routedTeamId, ticketId }
      );
    }
  } catch (routeErr) {
    logger.warn('WA bot: team routing failed (non-blocking)', { error: routeErr.message });
  }

  // Trigger WhatsApp notification for ticket created (non-blocking)
  try {
    const whatsappNotificationService = require('./whatsappNotificationService');
    whatsappNotificationService.onTicketCreated({
      ticket_id: ticketId,
      ticket_number: ticketNumber,
      subject,
      requester_id: user.user_id,
      assigned_to: assignedToId,
    }).catch(() => {});
  } catch { /* non-blocking */ }

  logger.success('Ticket created via WhatsApp', { ticketId, ticketNumber, userId: user.user_id });

  const assignedMsg = assignedToId ? '(auto-assigned to an engineer)' : '(pending assignment)';
  return {
    answer: `✅ *Ticket Created Successfully!*\n\n` +
      `🎫 *${ticketNumber}*\n` +
      `📌 Subject: ${subject}\n` +
      `⚡ Priority: ${data.priority_name || 'Default'}\n` +
      `📝 Description: ${description.substring(0, 200)}${description.length > 200 ? '...' : ''}\n\n` +
      `${assignedMsg}\n\nYou can track it by saying: *${ticketNumber}*`,
  };
}
const buildUserContext = async (basicUser) => {
  const query = `
    SELECT
      u.user_id, u.username, u.email,
      u.first_name, u.last_name,
      u.role_id, u.department_id, u.location_id, u.process_id,
      r.role_name, r.role_code, r.description as role_description, r.is_system_role,
      r.can_create_tickets, r.can_view_all_tickets, r.can_assign_tickets,
      r.can_close_tickets, r.can_reopen_tickets, r.can_delete_tickets,
      r.can_manage_users, r.can_manage_departments, r.can_manage_roles,
      r.can_view_analytics, r.can_manage_system, r.can_manage_kb,
      r.can_manage_incidents, r.can_manage_snippets, r.can_use_ai_features,
      r.can_view_job_monitor, r.can_manage_settings_general,
      r.can_manage_settings_email, r.can_manage_settings_tickets,
      r.can_manage_settings_sla, r.can_manage_settings_security,
      r.can_manage_settings_bot, r.can_manage_settings_license,
      r.can_manage_settings_backup
    FROM users u
    INNER JOIN user_roles r ON u.role_id = r.role_id
    WHERE u.user_id = @userId AND u.is_active = 1
  `;

  const result = await executeQuery(query, { userId: basicUser.user_id });
  const d = result.recordset[0];
  if (!d) return null;

  const permissions = {};
  Object.keys(d).forEach(key => {
    if (key.startsWith('can_')) {
      permissions[key] = d[key] === 1 || d[key] === true || d[key] === '1';
    }
  });

  return {
    user_id:      d.user_id,
    username:     d.username,
    email:        d.email,
    first_name:   d.first_name,
    last_name:    d.last_name,
    full_name:    `${d.first_name || ''} ${d.last_name || ''}`.trim() || d.username,
    role_id:      d.role_id,
    department_id: d.department_id,
    location_id:  d.location_id || null,
    process_id:   d.process_id || null,
    role: {
      role_id:     d.role_id,
      role_name:   d.role_name,
      role_code:   d.role_code,
      description: d.role_description,
      is_system_role: d.is_system_role,
    },
    permissions,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// BOT NAME — cached, same pattern as ai.routes.js
// ─────────────────────────────────────────────────────────────────────────────
let _cachedBotName = null;
let _botNameCacheTime = 0;

const getBotName = async () => {
  const now = Date.now();
  if (_cachedBotName && now - _botNameCacheTime < 5 * 60 * 1000) return _cachedBotName;
  try {
    const r = await executeQuery(
      `SELECT setting_value FROM system_settings WHERE setting_key = @key`,
      { key: 'bot_name' }
    );
    _cachedBotName = r.recordset?.[0]?.setting_value || DEFAULT_BOT_NAME;
    _botNameCacheTime = now;
    return _cachedBotName;
  } catch { return DEFAULT_BOT_NAME; }
};

// ─────────────────────────────────────────────────────────────────────────────
// INTENT HELPERS — mirrors of the private functions in ai.routes.js
// ─────────────────────────────────────────────────────────────────────────────

const isLastTicketIntent = (msg) => [
  /last\s+ticket\s+status/i, /latest\s+ticket\s+status/i,
  /my\s+last\s+ticket/i, /my\s+latest\s+ticket/i,
  /recent\s+ticket\s+status/i,
  /what\s+was\s+my\s+last\s+ticket\s+status/i,
  /what\s+is\s+my\s+last\s+ticket\s+status/i,
  /status\s+of\s+my\s+last\s+ticket/i,
].some(p => p.test(msg));

const isBotIdentityIntent = (msg) => [
  /what(?:'s|\s+is)?\s+your\s+name/i, /who\s+are\s+you/i, /what\s+are\s+you/i,
  /tell\s+me\s+about\s+yourself/i, /introduce\s+yourself/i,
  /are\s+you\s+an?\s+(?:ai|bot|assistant|robot)/i,
  /what\s+(?:kind|type)\s+of\s+(?:ai|bot|assistant)/i, /your\s+name\b/i,
].some(p => p.test(msg));

const isWhoAmIIntent = (msg) => [
  /who\s+am\s+i/i, /my\s+role/i, /my\s+permission/i,
  /my\s+credential/i, /what\s+can\s+i\s+do/i,
].some(p => p.test(msg));

const isMyTicketSummaryIntent = (msg) => [
  /my\s+open\s+tickets?/i, /ticket\s+summary/i,
  /summar(?:y|ize)\s+my\s+tickets?/i,
  /how\s+many\s+tickets?\s+do\s+i\s+have/i,
  /my\s+ticket\s+count/i, /show\s+my\s+tickets?/i,
].some(p => p.test(msg));

const isTeamStatsIntent = (msg) => [
  /team\s+ticket\s+stat(?:s|istics|us)?/i, /show\s+team\s+ticket/i,
  /team\s+open\s+tickets?/i, /show\s+team\s+stat(?:s|istics)/i,
  /how\s+many\s+tickets?\s+does\s+(?:the\s+)?team\s+have/i,
  /team\s+summary/i, /team\s+stat(?:s|istics)/i,
].some(p => p.test(msg));

const isQuickCreateIntent = (msg) => [
  /create\s+a\s+ticket/i, /new\s+ticket/i, /create\s+new\s+ticket/i,
  /report\s+issue/i, /submit\s+ticket/i,
].some(p => p.test(msg));

const isHelpIntent = (msg) => [
  /^\s*help\s*[?!.]*\s*$/i, /\bassistant\s+help\b/i,
  /^what\s+(?:can\s+)?you\s+(?:can\s+)?do/i,
  /^what\s+(?:do\s+)?you\s+(?:know|offer|provide|support)/i,
  /your\s+(?:capabilit|feature|function)/i,
  /^commands?\s*[?!.]*\s*$/i, /\bavailable\s+commands\b/i,
  /^show\s+(?:me\s+)?(?:available\s+)?commands?/i,
  /^(?:i\s+)?need\s+(?:some\s+)?help\s*[?!.]*\s*$/i,
  /^(?:can|could)\s+(?:you\s+)?help\s*(?:me\s*)?[?!.]*\s*$/i,
  /^how\s+(?:can|do)\s+(?:i|you)\s+(?:use|help)/i,
  /^(?:list|show)\s+(?:me\s+)?(?:all\s+)?(?:your\s+)?(?:options|capabilities|features|commands)/i,
].some(p => p.test(msg));

const isDataQueryIntent = (msg) => botDataQueryService.isDataQueryIntent
  ? botDataQueryService.isDataQueryIntent(msg)
  : [/how\s+many\s+ticket/i, /ticket\s+count/i, /ticket\s+status\s+breakdown/i].some(p => p.test(msg));

// ── New intents: comment, pending approvals, approve/reject via WhatsApp ──────

const ADD_COMMENT_RE = /^(?:add\s+)?comment\s+on\s+(?:ticket\s+)?#?(\w[\w.-]*)\s*[:\-]\s*(.+)/is;
const isAddCommentIntent = (msg) => ADD_COMMENT_RE.test(msg);

const MY_APPROVALS_RE = /my\s+(?:pending\s+)?approval|pending\s+approval|show\s+approval|approval\s+list|approvals\s+pending/i;
const isMyApprovalsIntent = (msg) => MY_APPROVALS_RE.test(msg);

const APPROVE_REJECT_RE = /^(approve|reject)\s+(?:ticket\s+)?#?(\w[\w.-]*)/is;
const isApproveRejectIntent = (msg) => APPROVE_REJECT_RE.test(msg);

const TICKET_NUMBER_ONLY = /^\s*(?:#?\d+|[A-Z]{2,}-\d{8}-\d{4,5}|TKT-\d{4}-\d{4,5})\s*$/i;
const TICKET_NUMBER_EMBEDDED = /(?:(?:ticket|tkt|#)\s*[-:]?\s*)?((?:[A-Z]{2,}-\d{8}-\d{4,5})|(?:TKT-\d{4}-\d{4,5})|(?:#\d{3,}))/i;
const TICKET_INQUIRY_PATTERNS = [
  /(?:status|detail|info|check|show|view|get|find|look\s*up|what\s+is|what's|tell\s+me\s+about|inquir|enquir|about)\b.*(?:[A-Z]{2,}-\d{8}-\d{4,5}|TKT-\d{4}-\d{4,5}|#\d{3,})/i,
  /(?:[A-Z]{2,}-\d{8}-\d{4,5}|TKT-\d{4}-\d{4,5}|#\d{3,}).*(?:status|detail|info|update|progress|where|how)/i,
  /(?:ticket)\s*(?:number|no|#)?\s*(?::|-|–)?\s*(?:[A-Z]{2,}-\d{8}-\d{4,5}|\d{3,})/i,
];
const FIND_TICKET_PATTERNS = [/find\s+ticket/i, /search\s+ticket/i, /look\s+for\s+ticket/i, /ticket\s+number/i];

function extractTicketLookupInput(message) {
  const text = (message || '').trim();
  if (TICKET_NUMBER_ONLY.test(text)) {
    const norm = text.replace(/^#/, '').trim();
    const numId = /^\d+$/.test(norm) ? parseInt(norm, 10) : null;
    return { raw: norm, numericId: numId, ticketNumber: numId ? null : norm.toUpperCase() };
  }
  const m = text.match(TICKET_NUMBER_EMBEDDED);
  if (m) {
    const ex = (m[1] || m[0]).replace(/^#/, '').trim();
    const numId = /^\d+$/.test(ex) ? parseInt(ex, 10) : null;
    return { raw: ex, numericId: numId, ticketNumber: numId ? null : ex.toUpperCase() };
  }
  if (TICKET_INQUIRY_PATTERNS.some(p => p.test(text)) || FIND_TICKET_PATTERNS.some(p => p.test(text))) {
    const nm = text.match(/\b(\d{3,})\b/);
    if (nm) return { raw: nm[1], numericId: parseInt(nm[1], 10), ticketNumber: null };
  }
  return null;
}

async function getTicketDetailsForLookup(lookup, user) {
  const canViewAll = user?.permissions?.can_view_all_tickets || false;
  const params = { userId: user?.user_id };
  let filterClause;
  if (lookup.numericId) {
    filterClause = 't.ticket_id = @ticketId';
    params.ticketId = lookup.numericId;
  } else {
    filterClause = 'UPPER(t.ticket_number) = @ticketNumber';
    params.ticketNumber = lookup.ticketNumber;
  }
  const query = `
    SELECT TOP 1 t.ticket_id, t.ticket_number, t.subject, t.description, t.resolution_notes,
      t.created_at, t.updated_at,
      ts.status_name, ts.status_code, ts.is_final_status,
      tp.priority_name, tc.category_name, d.department_name,
      req.first_name + ' ' + req.last_name as requester_name,
      eng.first_name + ' ' + eng.last_name as assigned_to_name
    FROM tickets t
    LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
    LEFT JOIN ticket_priorities tp ON t.priority_id = tp.priority_id
    LEFT JOIN ticket_categories tc ON t.category_id = tc.category_id
    LEFT JOIN departments d ON t.department_id = d.department_id
    LEFT JOIN users req ON t.requester_id = req.user_id
    LEFT JOIN users eng ON t.assigned_to = eng.user_id
    WHERE ${filterClause}
      AND (${canViewAll ? '1=1' : '(t.requester_id = @userId OR t.assigned_to = @userId)'})
  `;
  const result = await executeQuery(query, params);
  return result.recordset?.[0] || null;
}

function formatTicketLookupResponse(ticket) {
  const createdAt = ticket?.created_at ? new Date(ticket.created_at).toLocaleString() : 'N/A';
  const updatedAt = ticket?.updated_at ? new Date(ticket.updated_at).toLocaleString() : 'N/A';
  return `*${ticket.ticket_number || `#${ticket.ticket_id}`}*\n\n` +
    `Subject: ${ticket.subject || 'N/A'}\n` +
    `Status: *${ticket.status_name || 'Unknown'}*${ticket.is_final_status ? ' (Final)' : ''}\n` +
    `Priority: ${ticket.priority_name || 'N/A'}\n` +
    `Category: ${ticket.category_name || 'N/A'}\n` +
    `Dept: ${ticket.department_name || 'N/A'}\n` +
    `Requester: ${(ticket.requester_name || '').trim() || 'N/A'}\n` +
    `Assigned: ${(ticket.assigned_to_name || '').trim() || 'Unassigned'}\n` +
    `Created: ${createdAt}\n` +
    `Updated: ${updatedAt}\n\n` +
    `Description: ${(ticket.description || 'N/A').substring(0, 300)}`;
}

async function getLastTicketForUser(userId) {
  const result = await executeQuery(`
    SELECT TOP 1 t.ticket_id, t.ticket_number, t.subject, t.created_at, t.updated_at,
      ts.status_name, ts.status_code, ts.is_final_status,
      u.first_name + ' ' + u.last_name as assigned_to_name
    FROM tickets t
    LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
    LEFT JOIN users u ON t.assigned_to = u.user_id
    WHERE t.requester_id = @userId
    ORDER BY t.created_at DESC, t.ticket_id DESC
  `, { userId });
  return result.recordset?.[0] || null;
}

function formatLastTicketAnswer(ticket, user) {
  if (!ticket) return `No tickets found for your account yet. Say *create a ticket* to get started.`;
  const userName = user?.first_name || user?.username || 'there';
  return `Hi ${userName}, here is your latest ticket:\n\n` +
    `*${ticket.ticket_number || `#${ticket.ticket_id}`}*\n` +
    `Subject: ${ticket.subject || 'N/A'}\n` +
    `Status: *${ticket.status_name || 'Unknown'}*\n` +
    `Assigned: ${(ticket.assigned_to_name || '').trim() || 'Not assigned'}\n` +
    `Created: ${ticket.created_at ? new Date(ticket.created_at).toLocaleString() : 'N/A'}`;
}

async function getMyTicketSummary(userId) {
  const r = await executeQuery(`
    SELECT COUNT(*) AS total_tickets,
      SUM(CASE WHEN ts.is_final_status = 0 THEN 1 ELSE 0 END) AS open_tickets,
      SUM(CASE WHEN ts.is_final_status = 1 THEN 1 ELSE 0 END) AS closed_tickets,
      SUM(CASE WHEN UPPER(ts.status_code) = 'PENDING' THEN 1 ELSE 0 END) AS pending_tickets,
      SUM(CASE WHEN UPPER(tp.priority_code) IN ('CRITICAL','HIGH') AND ts.is_final_status=0 THEN 1 ELSE 0 END) AS urgent_open_tickets
    FROM tickets t
    LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
    LEFT JOIN ticket_priorities tp ON t.priority_id = tp.priority_id
    WHERE t.requester_id = @userId
  `, { userId });
  return r.recordset?.[0] || null;
}

async function getTeamStats() {
  const r = await executeQuery(`
    SELECT COUNT(*) AS total_tickets,
      SUM(CASE WHEN ts.is_final_status = 0 THEN 1 ELSE 0 END) AS open_tickets,
      SUM(CASE WHEN ts.is_final_status = 1 THEN 1 ELSE 0 END) AS closed_tickets,
      SUM(CASE WHEN UPPER(tp.priority_code) IN ('CRITICAL','HIGH') AND ts.is_final_status=0 THEN 1 ELSE 0 END) AS urgent_open
    FROM tickets t
    LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
    LEFT JOIN ticket_priorities tp ON t.priority_id = tp.priority_id
  `);
  return r.recordset?.[0] || null;
}

function getCredentialCapabilities(user) {
  const p = user?.permissions || {};
  const caps = [];
  if (p.can_create_tickets)   caps.push('Create support tickets');
  if (p.can_view_all_tickets) caps.push('View all team tickets');
  if (p.can_assign_tickets)   caps.push('Assign tickets to engineers');
  if (p.can_close_tickets)    caps.push('Close or reopen tickets');
  if (p.can_manage_users)     caps.push('Manage users');
  if (p.can_manage_system)    caps.push('Manage system settings');
  if (caps.length === 0) caps.push('View and track your own tickets');
  return caps;
}

function createHelpMessage(user, botName) {
  const canViewAll = user?.permissions?.can_view_all_tickets || user?.permissions?.can_manage_system || false;
  let msg = `*${botName}* — Help\n\n`;
  msg += `*Tickets:*\n• Last ticket status\n• Show ticket summary\n• Create a ticket\n• Track a ticket #123\n• Add comment on #TKT-123: text\n\n`;
  msg += `*Approvals:*\n• My pending approvals\n• Approve #TKT-123\n• Reject #TKT-123\n\n`;
  msg += `*Account:*\n• Who am I?\n• Change my password\n\n`;
  if (canViewAll) {
    msg += `*Analytics (Manager/Admin):*\n• How many tickets today?\n• Tickets by department\n• Priority breakdown\n• Agent workload\n• SLA performance\n\n`;
  }
  msg += `*IT Support:*\n• Network / VPN / Email / Password issues\n• Software & hardware troubleshooting\n\nJust type your question!`;
  return msg;
}

function decorateWithRoleFlow(result, user) {
  const followUp = Array.isArray(result.followUp) ? [...result.followUp] : [];
  if (!user?.permissions?.can_create_tickets) {
    result.followUp = followUp.filter(i => i.toLowerCase() !== 'create a ticket');
  }
  if (user?.permissions?.can_view_all_tickets && !(result.followUp || []).includes('Show team ticket stats')) {
    result.followUp = [...(result.followUp || []), 'Show team ticket stats'];
  }
  return result;
}

// ── New intent handler functions ──────────────────────────────────────────────

/**
 * Add a comment to a ticket via WhatsApp message.
 * Message format: "add comment on #TKT-123: comment text"
 */
async function handleAddComment(user, msg) {
  const m = ADD_COMMENT_RE.exec(msg);
  if (!m) return '❌ Format not recognised. Try: *add comment on #TICKET-123: your comment text*';
  const ticketRef = m[1].trim().toUpperCase();
  const commentText = m[2].trim();

  if (!commentText || commentText.length < 2) {
    return '❌ Comment text cannot be empty.';
  }
  if (commentText.length > 2000) {
    return '❌ Comment is too long (max 2000 characters).';
  }

  try {
    const ticketResult = await executeQuery(
      `SELECT t.ticket_id, t.ticket_number, t.subject
       FROM tickets t
       WHERE (UPPER(t.ticket_number) = @ticketRef OR CAST(t.ticket_id AS VARCHAR) = @rawRef)
         AND (t.requester_id = @userId OR t.assigned_to = @userId)
         AND t.status_id NOT IN (SELECT status_id FROM ticket_statuses WHERE is_final_status = 1)`,
      { ticketRef, rawRef: m[1].trim(), userId: user.user_id }
    );

    if (!ticketResult.recordset.length) {
      return `❌ Ticket *${ticketRef}* not found, is closed, or you don't have access to it.`;
    }
    const ticket = ticketResult.recordset[0];

    await executeQuery(
      `INSERT INTO ticket_comments (ticket_id, user_id, comment_text, created_at)
       VALUES (@ticketId, @userId, @commentText, GETDATE())`,
      { ticketId: ticket.ticket_id, userId: user.user_id, commentText }
    );
    await executeQuery(
      `INSERT INTO ticket_activities (ticket_id, activity_type, description, performed_by)
       VALUES (@ticketId, 'COMMENT_ADDED', @description, @userId)`,
      {
        ticketId: ticket.ticket_id,
        description: `WhatsApp comment: ${commentText.substring(0, 200)}`,
        userId: user.user_id,
      }
    );
    return `✅ *Comment Added*\n\nTicket *#${ticket.ticket_number}* — ${ticket.subject}\n\n💬 "${commentText.substring(0, 300)}"`;
  } catch (err) {
    logger.error('WA bot: add comment failed', err);
    return '❌ Failed to add comment. Please try again or use the portal.';
  }
}

/**
 * List all pending approval requests assigned to this user.
 */
async function handleMyApprovals(user) {
  try {
    const result = await executeQuery(
      `SELECT ta.approval_id, ta.approval_note, ta.created_at,
              t.ticket_number, t.subject,
              u_req.first_name + ' ' + u_req.last_name AS requested_by_name
       FROM ticket_approvals ta
       INNER JOIN tickets t ON ta.ticket_id = t.ticket_id
       LEFT JOIN users u_req ON ta.requested_by = u_req.user_id
       WHERE ta.approver_id = @userId AND ta.status = 'PENDING' AND ta.is_active = 1
       ORDER BY ta.created_at ASC`,
      { userId: user.user_id }
    );

    const approvals = result.recordset;
    if (!approvals.length) {
      return '✅ *No Pending Approvals*\n\nYou have no pending approval requests at this time.';
    }

    const lines = approvals.map((a, i) => {
      const note = a.approval_note ? `"${String(a.approval_note).substring(0, 80)}"` : 'No note';
      return `${i + 1}. Ticket *#${a.ticket_number}*\n   ${a.subject}\n   By: ${a.requested_by_name}\n   Note: ${note}`;
    });

    return `🔔 *Pending Approvals (${approvals.length})*\n\n${lines.join('\n\n')}\n\nTo decide, reply:\n• *approve #TICKET-NUMBER*\n• *reject #TICKET-NUMBER*`;
  } catch (err) {
    logger.error('WA bot: my approvals failed', err);
    return '❌ Failed to fetch approvals. Please try again or use the portal.';
  }
}

/**
 * Approve or reject a pending approval request for a ticket.
 * Message format: "approve #TKT-123" or "reject #TKT-123"
 */
async function handleApproveReject(user, msg) {
  const m = APPROVE_REJECT_RE.exec(msg);
  if (!m) return '❌ Format not recognised. Try: *approve #TICKET-123* or *reject #TICKET-123*';
  const action = m[1].toLowerCase();
  const ticketRef = m[2].trim().toUpperCase();
  const decision = action === 'approve' ? 'APPROVED' : 'REJECTED';

  try {
    const approvalResult = await executeQuery(
      `SELECT ta.approval_id, t.ticket_number, t.subject
       FROM ticket_approvals ta
       INNER JOIN tickets t ON ta.ticket_id = t.ticket_id
       WHERE ta.approver_id = @userId AND ta.status = 'PENDING' AND ta.is_active = 1
         AND (UPPER(t.ticket_number) = @ticketRef OR CAST(t.ticket_id AS VARCHAR) = @rawRef)`,
      { userId: user.user_id, ticketRef, rawRef: m[2].trim() }
    );

    if (!approvalResult.recordset.length) {
      return `❌ No pending approval request found for ticket *${ticketRef}* assigned to you.\n\nType *my approvals* to see your pending requests.`;
    }

    const approval = approvalResult.recordset[0];
    const decisionNote = `${decision.charAt(0) + decision.slice(1).toLowerCase()} via WhatsApp by ${user.full_name || user.username}`;

    // Use shared workflow to ensure SLA is resumed + notifications sent
    const { processApprovalDecision } = require('./approvalWorkflow.service');
    const result = await processApprovalDecision({
      approvalId: approval.approval_id,
      decision,
      decisionNote,
      actingUserId: user.user_id,
    });

    if (!result.success) {
      return `❌ Could not process decision: ${result.message}`;
    }

    const emoji = decision === 'APPROVED' ? '✅' : '❌';
    return `${emoji} *Approval ${decision}*\n\nTicket *#${approval.ticket_number}* — ${approval.subject}\n\nYour decision has been recorded. The engineer has been notified.`;
  } catch (err) {
    logger.error('WA bot: approve/reject failed', err);
    return '❌ Failed to process decision. Please use the portal to approve or reject.';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// WHATSAPP FORMATTING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send up to 3 follow-up suggestions as interactive reply buttons.
 * Falls back to plain text list if whatsappService doesn't have interactive support
 * or if count > 3 (WhatsApp limit).
 */
async function sendFollowUps(phone, followUps) {
  if (!followUps || followUps.length === 0) return;
  const buttons = followUps.slice(0, 3);
  try {
    await whatsappService.sendInteractiveButtons(
      phone,
      'What would you like to do next?',
      buttons.map((title, i) => ({ id: `fu_${i}`, title: title.substring(0, 20) }))
    );
  } catch {
    // Fall back to sending them as plain text suggestions
    const suggestions = `💡 *Suggestions:*\n${buttons.map(b => `• ${b}`).join('\n')}`;
    await whatsappService.sendTextMessage(phone, suggestions, {}).catch(() => {});
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ENTRY POINT — called from whatsapp.controller.js webhookReceive
// ─────────────────────────────────────────────────────────────────────────────

/**
 * handleMessage(event)
 * @param {object} event — from whatsappService.parseIncomingWebhook()
 *   { phone, messageType, text, buttonTitle, listTitle, buttonId, listId, user }
 */
const handleMessage = async (event) => {
  const { phone, messageType, text, buttonTitle, listTitle, buttonId, listId, user: basicUser } = event;

  // ── 1. Gate: user must have a linked + opted-in WhatsApp account ──────────
  if (!basicUser) {
    await whatsappService.sendTextMessage(
      phone,
      `👋 Welcome to *IT Helpdesk*!\n\nTo use the bot, please link your WhatsApp number in the helpdesk portal:\n*Profile → WhatsApp Notifications → Link Number*`,
      { ticketId: null }
    );
    return;
  }

  // ── 2. Get the raw message text (text or button/list reply) ──────────────
  const rawMessage = (text || buttonTitle || listTitle || '').trim();

  // ── 2a. Media messages (image / document / video / audio) ─────────────────
  //  Only handle if the user is linked (basicUser already checked above) and
  //  the event carries a media ID.
  if (event.mediaId && whatsappMediaService.ALLOWED_MEDIA_TYPES.has(event.mediaType)) {
    try {
      // Find the user's most recent open ticket to attach the file to
      const ticket = await whatsappMediaService.getLatestOpenTicketForUser(basicUser.user_id);
      if (!ticket) {
        await whatsappService.sendTextMessage(
          phone,
          `❌ No open ticket found to attach your file to.\n\nPlease create a ticket first or send the file after opening one.`,
          { userId: basicUser.user_id }
        );
        return;
      }

      const attachResult = await whatsappMediaService.handleIncomingMedia(
        event, ticket.ticket_id, basicUser.user_id
      );

      if (attachResult.success) {
        await whatsappService.sendTextMessage(
          phone,
          `✅ File received and attached to ticket *${ticket.ticket_number}*!\n\nFile: ${attachResult.fileName} (${attachResult.fileSizeKb} KB)`,
          { userId: basicUser.user_id, ticketId: ticket.ticket_id }
        );
      } else {
        await whatsappService.sendTextMessage(
          phone,
          `⚠️ Could not attach your file: ${attachResult.message}`,
          { userId: basicUser.user_id }
        );
      }
    } catch (mediaErr) {
      logger.error('WA bot: media handling error', { error: mediaErr.message, userId: basicUser.user_id });
      await whatsappService.sendTextMessage(
        phone,
        `Sorry, there was a problem saving your file. Please try again or use the portal.`,
        { userId: basicUser.user_id }
      ).catch(() => {});
    }
    return;
  }

  if (!rawMessage) return; // Ignore empty / unsupported message types

  // ── 3. Build full user context (role + permissions) ───────────────────────
  const user = await buildUserContext(basicUser);
  if (!user) {
    logger.warn('WhatsApp bot: user not found or inactive', { userId: basicUser.user_id });
    await whatsappService.sendTextMessage(phone, `Your account is not active. Please contact the IT team.`, {});
    return;
  }

  // ── 3a. Check for active ticket creation flow ─────────────────────────────
  const createFlowResult = await handleCreateTicketFlow(user, phone, rawMessage, buttonId || null, listId || null);
  if (createFlowResult.handled) {
    if (createFlowResult.answer) {
      const chunks = whatsappService.splitMessage(whatsappService.formatForWhatsApp(createFlowResult.answer));
      for (const chunk of chunks) {
        await whatsappService.sendTextMessage(phone, chunk, { userId: user.user_id });
      }
    }
    if (createFlowResult.followUp && createFlowResult.followUp.length > 0) {
      sendFollowUps(phone, createFlowResult.followUp).catch(() => {});
    }
    return;
  }

  // ── 4. Session management — keyed wa-{user_id} to separate from web ───────
  const sid = `wa-${user.user_id}`;
  const startTime = Date.now();

  try {
    await botSessionService.startSession({
      sessionId: sid,
      userId: user.user_id,
      userName: user.full_name,
      userRole: user.role?.role_name || 'User',
      ipAddress: 'whatsapp',
      userAgent: 'WhatsApp',
    });
  } catch (e) {
    logger.warn('WA bot: session start failed (non-blocking)', { error: e.message });
  }

  // ── 5. Record user message ───────────────────────────────────────────────
  botSessionService.recordUserMessage({
    sessionId: sid,
    userId: user.user_id,
    messageContent: rawMessage,
  }).catch(e => logger.warn('WA bot: user message record failed', { error: e.message }));

  // ── 6. Run through the bot processing pipeline ────────────────────────────
  let answer = '';
  let followUp = [];
  let intentId = 'nlp-engine';
  let category = 'general';
  let confidence = 0;
  const botName = await getBotName();

  try {
    // Step A: Spelling correction
    const spellResult = spellingService.correctMessage(rawMessage);
    const msg = spellResult.corrected;

    // Step B: Ticket number lookup
    const ticketLookup = extractTicketLookupInput(msg);
    if (ticketLookup) {
      try {
        const ticket = await getTicketDetailsForLookup(ticketLookup, user);
        if (ticket) {
          answer = formatTicketLookupResponse(ticket);
          followUp = ['My ticket summary', 'Last ticket status', 'Create a ticket'];
          intentId = 'ticket-lookup-direct';
          category = 'helpdesk';
          confidence = 1;
        } else {
          answer = `I couldn't find a ticket matching *${ticketLookup.raw}*.\n\nPlease check the ticket number and try again.`;
          followUp = ['Last ticket status', 'Show my ticket summary'];
          intentId = 'ticket-lookup-not-found';
          category = 'helpdesk';
          confidence = 1;
        }
        // Short-circuit to send
        throw new _ShortCircuit(answer, followUp, intentId, category, confidence);
      } catch (e) {
        if (e instanceof _ShortCircuit) throw e;
        logger.warn('WA bot: ticket lookup failed', { error: e.message });
      }
    }

    // Step C: Named intents
    if (isLastTicketIntent(msg)) {
      const ticket = await getLastTicketForUser(user.user_id);
      answer = formatLastTicketAnswer(ticket, user);
      followUp = ['Show my ticket summary', 'Create a ticket', 'Help'];
      intentId = 'last-ticket-status-live';
      category = 'helpdesk';
      confidence = 1;
      throw new _ShortCircuit(answer, followUp, intentId, category, confidence);
    }

    if (isBotIdentityIntent(msg)) {
      answer = `Hi ${user.first_name || user.username}! I'm *${botName}*, your IT support assistant.\n\n` +
        `I can help you with:\n• Ticket management\n• IT troubleshooting\n• Account help\n\nType *help* for a full list.`;
      followUp = ['What can you do?', 'Create a ticket', 'Last ticket status'];
      intentId = 'bot-identity';
      category = 'identity';
      confidence = 1;
      throw new _ShortCircuit(answer, followUp, intentId, category, confidence);
    }

    if (isWhoAmIIntent(msg)) {
      const caps = getCredentialCapabilities(user);
      answer = `You are *${user.full_name}* (${user.role?.role_name || 'User'}).\n\n*Your permissions:*\n${caps.map(c => `• ${c}`).join('\n')}`;
      followUp = ['Last ticket status', 'Show my ticket summary'];
      intentId = 'credential-aware-flow';
      category = 'account';
      confidence = 1;
      throw new _ShortCircuit(answer, followUp, intentId, category, confidence);
    }

    if (isMyTicketSummaryIntent(msg)) {
      const summary = await getMyTicketSummary(user.user_id);
      const total = Number(summary?.total_tickets || 0);
      answer = total === 0
        ? `You don't have any tickets yet. Say *create a ticket* to get started.`
        : `Your ticket summary:\n\n` +
          `🎫 Total: ${total}\n` +
          `📂 Open: ${Number(summary.open_tickets || 0)}\n` +
          `✅ Closed: ${Number(summary.closed_tickets || 0)}\n` +
          `⏳ Pending: ${Number(summary.pending_tickets || 0)}\n` +
          `🚨 Urgent: ${Number(summary.urgent_open_tickets || 0)}`;
      followUp = ['Last ticket status', 'Create a ticket'];
      intentId = 'my-ticket-summary-live';
      category = 'helpdesk';
      confidence = 1;
      throw new _ShortCircuit(answer, followUp, intentId, category, confidence);
    }

    if (isTeamStatsIntent(msg) && user?.permissions?.can_view_all_tickets) {
      const stats = await getTeamStats();
      answer = `📊 *Team Ticket Stats*\n\n` +
        `🎫 Total: ${Number(stats?.total_tickets || 0)}\n` +
        `📂 Open: ${Number(stats?.open_tickets || 0)}\n` +
        `✅ Closed: ${Number(stats?.closed_tickets || 0)}\n` +
        `🚨 Urgent Open: ${Number(stats?.urgent_open || 0)}`;
      followUp = ['My ticket summary', 'Show status breakdown', 'Help'];
      intentId = 'team-stats-live';
      category = 'admin';
      confidence = 1;
      throw new _ShortCircuit(answer, followUp, intentId, category, confidence);
    }

    if (isQuickCreateIntent(msg)) {
      if (!user?.permissions?.can_create_tickets) {
        answer = `❌ You don't have permission to create tickets. Please contact your administrator.`;
        followUp = ['Who am I?', 'Help'];
        intentId = 'quick-create-denied';
        category = 'helpdesk';
        confidence = 1;
        throw new _ShortCircuit(answer, followUp, intentId, category, confidence);
      }
      // Start multi-step ticket creation flow
      setCreateFlowState(user.user_id, 'await_subject', {});
      answer = `🎟️ *Create a Ticket*\n\n📋 *Step 1/4* — Enter the subject (brief title of your issue):`;
      followUp = [];
      intentId = 'quick-create-start';
      category = 'helpdesk';
      confidence = 1;
      throw new _ShortCircuit(answer, followUp, intentId, category, confidence);
    }

    // New intent: add comment on a ticket via WhatsApp
    if (isAddCommentIntent(msg)) {
      answer = await handleAddComment(user, msg);
      followUp = ['My ticket summary', 'Last ticket status'];
      intentId = 'add-comment-wa';
      category = 'helpdesk';
      confidence = 1;
      throw new _ShortCircuit(answer, followUp, intentId, category, confidence);
    }

    // New intent: view my pending approvals
    if (isMyApprovalsIntent(msg)) {
      answer = await handleMyApprovals(user);
      followUp = ['My ticket summary', 'Help'];
      intentId = 'my-approvals-wa';
      category = 'helpdesk';
      confidence = 1;
      throw new _ShortCircuit(answer, followUp, intentId, category, confidence);
    }

    // New intent: approve or reject an approval request
    if (isApproveRejectIntent(msg)) {
      answer = await handleApproveReject(user, msg);
      followUp = ['My approvals', 'My ticket summary'];
      intentId = 'approve-reject-wa';
      category = 'helpdesk';
      confidence = 1;
      throw new _ShortCircuit(answer, followUp, intentId, category, confidence);
    }

    if (isHelpIntent(msg)) {
      answer = createHelpMessage(user, botName);
      followUp = ['Show my tickets', 'Create a ticket', 'Who am I?'];
      intentId = 'help-guide';
      category = 'general';
      confidence = 1;
      throw new _ShortCircuit(answer, followUp, intentId, category, confidence);
    }

    // Step D: Data query
    if (isDataQueryIntent(msg)) {
      try {
        const dataResult = await botDataQueryService.processDataQuery(msg, user);
        if (dataResult) {
          answer = dataResult.answer;
          followUp = ['Show ticket summary', 'Tickets by department', 'Priority breakdown'];
          intentId = `data-query-${dataResult.queryType}`;
          category = 'data-query';
          confidence = 1;
          throw new _ShortCircuit(answer, followUp, intentId, category, confidence);
        }
      } catch (e) {
        if (e instanceof _ShortCircuit) throw e;
        logger.warn('WA bot: data query failed', { error: e.message });
      }
    }

    // Step E: Custom intents (Phase 2)
    try {
      const customIntent = await botPhase2Service.matchCustomIntent(msg);
      if (customIntent) {
        const dept = await botPhase2Service.getDepartmentResponseContext(user);
        await botPhase2Service.executeWorkflowAction(
          customIntent.action_type, customIntent.action_config,
          { user_id: user.user_id, message: rawMessage }
        );
        const base = customIntent.response_template || `Custom intent: ${customIntent.intent_name}`;
        answer = botPhase2Service.buildDepartmentSpecificResponse(base, dept);
        followUp = ['Run another command', 'Help'];
        intentId = `custom-${customIntent.intent_name}`;
        category = 'custom-intent';
        confidence = 0.95;
        throw new _ShortCircuit(answer, followUp, intentId, category, confidence);
      }
    } catch (e) {
      if (e instanceof _ShortCircuit) throw e;
      logger.warn('WA bot: custom intent failed', { error: e.message });
    }

    // Step F: Core NLP engine
    let result;
    try {
      result = await handleChat(sid, msg);
      // Note: handleChat already calls resolveSecurityPlaceholders(result.answer) internally.
      // Do NOT pass the full result object here — it is not a string.
      result = decorateWithRoleFlow(result, user);
      try {
        const dept = await botPhase2Service.getDepartmentResponseContext(user);
        result.answer = botPhase2Service.buildDepartmentSpecificResponse(result.answer, dept);
      } catch { /* non-blocking */ }
    } catch (e) {
      logger.warn('WA bot: handleChat failed, using processQuery fallback', { error: e.message });
      result = processQuery(msg, []);
      result.answer = await resolveSecurityPlaceholders(result.answer) || result.answer;
      result = decorateWithRoleFlow(result, user);
    }

    // Step G: Knowledge grounding
    try {
      const grounded = await botKnowledgeGroundingService.getGroundedAnswer(msg);
      if (grounded) {
        const prot = ['help-', 'data-query-', 'last-ticket-', 'team-stats-', 'my-ticket-', 'bot-identity', 'credential-', 'quick-create', 'custom-'];
        const isProtected = prot.some(prefix => result.matchedTopic?.id?.startsWith(prefix));
        if (!isProtected && (!result.matchedTopic?.id || result.confidence < 0.9 || result.category === 'general')) {
          result.answer = grounded.answer;
          result.confidence = Math.max(result.confidence || 0, grounded.primary.confidence);
          result.followUp = grounded.followUp;
        }
      }
    } catch { /* non-blocking */ }

    // Step H: Training data
    const behaviorCfg = await botBehaviorConfig.getBehaviorConfig().catch(() => ({}));
    const threshold = behaviorCfg.bot_confidence_threshold ?? DEFAULT_CONFIDENCE_THRESHOLD;
    if ((result.confidence || 0) < threshold) {
      try {
        const matches = await botTrainingService.searchTrainingData(msg, 2);
        if (matches.length > 0) {
          const best = matches[0];
          result.answer = `Based on resolved tickets:\n\n${best.resolution_text}`;
          result.confidence = Math.max(result.confidence || 0, best.confidence_score || 0.65);
        }
      } catch { /* non-blocking */ }
    }

    // Step I: External AI enhancement
    const shouldTryExternal = (result.confidence || 0) < threshold || behaviorCfg.bot_ai_always_enhance;
    if (shouldTryExternal) {
      try {
        const enabledProviders = await botApiProviderService.getEnabledProviders();
        if (enabledProviders.length > 0) {
          const userContext = await userIntelligence.getPersonalizationContext(user.user_id);
          const systemPrompt = await botBehaviorConfig.buildAISystemPrompt(botName, user, userContext);
          const aiMessages = [{ role: 'system', content: systemPrompt }];
          try {
            const history = await botSessionService.getSessionMessages(sid);
            if (history?.length > 0) {
              let skipped = false;
              for (const m of history.slice(-20).reverse().reverse()) {
                if (!skipped && m.message_type === 'user' && m.message_content === rawMessage) { skipped = true; continue; }
                if (m.message_type === 'user') aiMessages.push({ role: 'user', content: m.message_content });
                else if (m.message_type === 'bot') aiMessages.push({ role: 'assistant', content: (m.message_content || '').substring(0, 500) });
              }
            }
          } catch { /* ignore */ }
          aiMessages.push({ role: 'user', content: rawMessage });
          const aiResult = await botApiIntegrationService.callWithFallback(aiMessages, sid, user.user_id, { max_tokens: 2000, temperature: 0.7 });
          if (aiResult.success && aiResult.content) {
            result.answer = aiResult.content;
            result.confidence = 0.9;
          }
        }
      } catch { /* non-blocking */ }
    }

    answer = whatsappService.formatForWhatsApp(result.answer || '');
    followUp = result.followUp || [];
    intentId = result.matchedTopic?.id || 'nlp-engine';
    category = result.category || 'general';
    confidence = result.confidence || 0;

  } catch (e) {
    if (e instanceof _ShortCircuit) {
      // Controlled early exit from the pipeline — not a real error
      answer = whatsappService.formatForWhatsApp(e.answer);
      followUp = e.followUp;
      intentId = e.intentId;
      category = e.category;
      confidence = e.confidence;
    } else {
      logger.error('WA bot: processing pipeline error', { error: e.message, userId: user.user_id });
      answer = `Sorry, I ran into an issue. 😅 Please try again or visit the helpdesk portal for assistance.`;
    }
  }

  // ── 7. Record bot response to session ─────────────────────────────────────
  const responseTimeMs = Date.now() - startTime;
  botSessionService.recordBotMessage({
    sessionId: sid,
    userId: user.user_id,
    messageContent: answer,
    intentMatched: intentId,
    category,
    confidence,
    responseTimeMs,
    followUpOptions: followUp,
    aiEnhanced: false,
  }).catch(e => logger.warn('WA bot: bot message record failed', { error: e.message }));

  // ── 8. Record user intelligence interaction ───────────────────────────────
  userIntelligence.recordInteraction(user.user_id, rawMessage, intentId, confidence, category)
    .catch(() => {});

  // ── 9. Send response ───────────────────────────────────────────────────────
  const chunks = whatsappService.splitMessage(answer);
  for (const chunk of chunks) {
    await whatsappService.sendTextMessage(phone, chunk, { userId: user.user_id });
  }

  // ── 10. Send follow-up buttons (non-blocking) ─────────────────────────────
  if (followUp.length > 0) {
    sendFollowUps(phone, followUp).catch(() => {});
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Internal: short-circuit helper (throw to exit the pipeline cleanly)
// ─────────────────────────────────────────────────────────────────────────────
class _ShortCircuit extends Error {
  constructor(answer, followUp, intentId, category, confidence) {
    super('short_circuit');
    this.answer = answer;
    this.followUp = followUp;
    this.intentId = intentId;
    this.category = category;
    this.confidence = confidence;
  }
}

module.exports = { handleMessage };

// ============================================
// WhatsApp Message Templates Service
// Manages all WhatsApp notification templates with
// full variable substitution (mirrors email template system).
//
// Variables available in every template:
//   {{system_name}}       — e.g. "Nexus Support"
//   {{company_name}}      — e.g. "Acme Corp"
//   {{system_url}}        — base URL, e.g. "https://helpdesk.acme.com"
//   {{support_email}}     — support contact email
//   {{current_date}}      — YYYY-MM-DD
//
// Ticket variables (per-notification):
//   {{ticket_number}}     — e.g. "IT-20240315-00042"
//   {{ticket_id}}         — numeric DB ID
//   {{ticket_url}}        — direct link: {{system_url}}/tickets/{{ticket_id}}
//   {{subject}}           — ticket subject / title
//   {{description}}       — ticket description (truncated)
//   {{priority}}          — priority label
//   {{status}}            — current status label
//   {{old_status}}        — previous status (for status-change events)
//   {{new_status}}        — new status
//   {{department_name}}   — department
//   {{category_name}}     — category
//
// People variables:
//   {{requester_name}}    — full name of ticket creator
//   {{engineer_name}}     — full name of assigned engineer
//   {{assigner_name}}     — who made the assignment
//   {{updater_name}}      — who made the last change
//   {{commenter_name}}    — who left the comment
//   {{comment_preview}}   — first 200 chars of comment
//   {{approver_name}}     — name of approver
//   {{approval_note}}     — reason/note on approval request
//   {{decision_note}}     — reason/note on approval decision
//   {{decision}}          — "APPROVED" | "REJECTED"
//
// SLA variables:
//   {{remaining_hours}}   — hours until SLA breach
//   {{elapsed_hours}}     — hours since SLA breach
//   {{sla_percentage}}    — e.g. "85"
//
// Rating variables:
//   {{rating_url}}        — direct link to submit rating
// ============================================

const settingsService = require('./settings.service');
const { getPublicAppUrl } = require('../utils/publicUrl');
const logger = require('../utils/logger');

// ── Global context cache (TTL = 5 min to avoid DB hammering) ─────────────────
let _ctxCache = null;
let _ctxTs = 0;
const CTX_TTL = 5 * 60 * 1000;

/**
 * Build the global template context from settings.
 * All variables are safe strings — never null/undefined.
 */
const getGlobalContext = async () => {
  const now = Date.now();
  if (_ctxCache && now - _ctxTs < CTX_TTL) return _ctxCache;

  try {
    const keys = ['system_name', 'company_name', 'system_title', 'email_from_address'];
    const s = await settingsService.getMany(keys, false);

    const systemName  = (s.system_name  && String(s.system_name).trim())  || 'IT Helpdesk';
    const companyName = (s.company_name && String(s.company_name).trim()) || systemName;
    const appUrl      = getPublicAppUrl() || 'http://localhost:5173';
    const supportEmail =
      process.env.SUPPORT_EMAIL ||
      (s.email_from_address && String(s.email_from_address).trim()) ||
      'support@helpdesk.local';

    _ctxCache = {
      system_name:   systemName,
      company_name:  companyName,
      system_url:    appUrl,
      support_email: supportEmail,
      current_date:  new Date().toISOString().slice(0, 10),
    };
    _ctxTs = now;
  } catch (err) {
    logger.warn('whatsappTemplates: could not load global context', { error: err.message });
    _ctxCache = {
      system_name:   'IT Helpdesk',
      company_name:  'IT Helpdesk',
      system_url:    'http://localhost:5173',
      support_email: 'support@helpdesk.local',
      current_date:  new Date().toISOString().slice(0, 10),
    };
    _ctxTs = now;
  }

  return _ctxCache;
};

/**
 * Invalidate the global context cache (call after settings change).
 */
const invalidateCache = () => {
  _ctxCache = null;
  _ctxTs = 0;
};

/**
 * Render a template string by replacing {{variable}} tokens.
 * Unknown tokens are replaced with an empty string.
 * @param {string} template
 * @param {Record<string, string|number>} vars
 * @returns {string}
 */
const render = (template, vars = {}) => {
  const safe = {};
  Object.entries(vars).forEach(([k, v]) => {
    safe[k] = v != null ? String(v) : '';
  });
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => safe[key] !== undefined ? safe[key] : '');
};

/**
 * Build full variable context by merging global context + per-notification vars.
 * Also auto-builds {{ticket_url}} if ticket_id and system_url are present.
 * @param {Record<string, any>} ticketVars  — ticket/event-specific variables
 * @returns {Promise<Record<string, string>>}
 */
const buildContext = async (ticketVars = {}) => {
  const global = await getGlobalContext();
  const merged = { ...global };

  // Coerce all vars to strings
  Object.entries(ticketVars).forEach(([k, v]) => {
    merged[k] = v != null ? String(v) : '';
  });

  // Auto-build ticket_url if not already provided
  if (!merged.ticket_url && merged.ticket_id && merged.system_url) {
    merged.ticket_url = `${merged.system_url}/tickets/${merged.ticket_id}`;
  }

  return merged;
};

// ── Message Templates ─────────────────────────────────────────────────────────
// Each template is a function (vars) → string so it reads the FINAL vars object.
// This makes it trivial to customise copy later without touching logic.

const TEMPLATES = {
  // ── Ticket Created (confirmation for requester) ──────────────────────────
  TICKET_CREATED: (v) =>
    `✅ *Ticket Confirmed — {{company_name}}*\n\n` +
    `Ticket *#{{ticket_number}}* has been created.\n\n` +
    `📋 *{{subject}}*\n` +
    `🎯 Priority: {{priority}}\n` +
    `🏢 Department: {{department_name}}\n\n` +
    `You'll receive updates as your ticket progresses.\n` +
    `📎 View ticket: {{ticket_url}}`,

  // ── Ticket Assigned (engineer) ───────────────────────────────────────────
  TICKET_ASSIGNED_ENGINEER: (v) =>
    `📌 *New Ticket Assigned — {{company_name}}*\n\n` +
    `Ticket *#{{ticket_number}}* has been assigned to you by *{{assigner_name}}*.\n\n` +
    `📋 *{{subject}}*\n` +
    `🎯 Priority: {{priority}}\n` +
    `🏢 Department: {{department_name}}\n\n` +
    `📎 View ticket: {{ticket_url}}`,

  // ── Ticket Assigned (requester notification) ─────────────────────────────
  TICKET_ASSIGNED_REQUESTER: (v) =>
    `👤 *Engineer Assigned — {{company_name}}*\n\n` +
    `Ticket *#{{ticket_number}}* is now assigned to *{{engineer_name}}*.\n\n` +
    `📋 *{{subject}}*\n` +
    `🎯 Priority: {{priority}}\n\n` +
    `They will contact you shortly.\n` +
    `📎 View ticket: {{ticket_url}}`,

  // ── Status Changed (requester) ────────────────────────────────────────────
  TICKET_STATUS_CHANGED_REQUESTER: (v) =>
    `🔄 *Status Update — {{company_name}}*\n\n` +
    `Ticket *#{{ticket_number}}* status changed:\n` +
    `{{old_status}} → *{{new_status}}*\n\n` +
    `📋 *{{subject}}*\n\n` +
    `📎 View ticket: {{ticket_url}}`,

  // ── Status Changed — Resolved (requester) ────────────────────────────────
  TICKET_RESOLVED_REQUESTER: (v) =>
    `✅ *Ticket Resolved — {{company_name}}*\n\n` +
    `Ticket *#{{ticket_number}}* has been marked as *{{new_status}}*.\n\n` +
    `📋 *{{subject}}*\n\n` +
    `If this didn't resolve your issue, you can reopen the ticket from the portal.\n` +
    `📎 View ticket: {{ticket_url}}`,

  // ── Status Changed (engineer) ─────────────────────────────────────────────
  TICKET_STATUS_CHANGED_ENGINEER: (v) =>
    `🔄 *Status Update — {{company_name}}*\n\n` +
    `Ticket *#{{ticket_number}}* updated by *{{updater_name}}*:\n` +
    `{{old_status}} → *{{new_status}}*\n\n` +
    `📋 *{{subject}}*\n\n` +
    `📎 View ticket: {{ticket_url}}`,

  // ── Comment Added ─────────────────────────────────────────────────────────
  TICKET_COMMENT_ADDED: (v) =>
    `💬 *New Comment — {{company_name}}*\n\n` +
    `On ticket *#{{ticket_number}}*:\n\n` +
    `*{{commenter_name}}:* "{{comment_preview}}"\n\n` +
    `📋 *{{subject}}*\n` +
    `📎 View ticket: {{ticket_url}}`,

  // ── Pending Info ──────────────────────────────────────────────────────────
  TICKET_PENDING_INFO: (v) =>
    `❓ *More Details Needed — {{company_name}}*\n\n` +
    `Ticket *#{{ticket_number}}* — *{{engineer_name}}* has requested additional information.\n\n` +
    `📋 *{{subject}}*\n` +
    `{{request_note_line}}\n` +
    `Please log in to the portal to provide the details.\n` +
    `📎 View ticket: {{ticket_url}}`,

  // ── SLA Warning ───────────────────────────────────────────────────────────
  TICKET_SLA_WARNING: (v) =>
    `⚠️ *SLA Warning — {{company_name}}*\n\n` +
    `Ticket *#{{ticket_number}}* is at *{{sla_percentage}}%* of its SLA target.\n` +
    `⏱ *{{remaining_hours}}h* remaining.\n\n` +
    `📋 *{{subject}}*\n` +
    `📎 View ticket: {{ticket_url}}`,

  // ── SLA Breach (engineer) ─────────────────────────────────────────────────
  TICKET_SLA_BREACHED_ENGINEER: (v) =>
    `🚨 *SLA Breached — {{company_name}}*\n\n` +
    `Ticket *#{{ticket_number}}* has exceeded its SLA target ({{elapsed_hours}}h elapsed).\n\n` +
    `📋 *{{subject}}*\n\n` +
    `⚡ Please update the ticket immediately.\n` +
    `📎 View ticket: {{ticket_url}}`,

  // ── SLA Breach (requester) ────────────────────────────────────────────────
  TICKET_SLA_BREACHED_REQUESTER: (v) =>
    `🚨 *SLA Update — {{company_name}}*\n\n` +
    `We apologise — Ticket *#{{ticket_number}}* has exceeded its expected resolution time.\n\n` +
    `📋 *{{subject}}*\n\n` +
    `Our team is actively working on it.\n` +
    `📎 View ticket: {{ticket_url}}`,

  // ── Approval Request (approver) ───────────────────────────────────────────
  TICKET_APPROVAL_REQUEST: (v) =>
    `📋 *Approval Required — {{company_name}}*\n\n` +
    `*{{engineer_name}}* has raised an approval request for:\n\n` +
    `🎫 Ticket *#{{ticket_number}}* — *{{subject}}*\n` +
    `🎯 Priority: {{priority}}\n` +
    `🏢 Department: {{department_name}}\n\n` +
    `📝 Reason: "{{approval_note}}"\n\n` +
    `Please review and decide from the portal.\n` +
    `📎 View ticket: {{ticket_url}}`,

  // ── Approval Decided (engineer who raised it) ─────────────────────────────
  TICKET_APPROVAL_DECIDED_ENGINEER: (v) =>
    `✅ *Approval Decision — {{company_name}}*\n\n` +
    `Your approval request for Ticket *#{{ticket_number}}* has been *{{decision}}* by *{{approver_name}}*.\n\n` +
    `📋 *{{subject}}*\n` +
    `{{decision_note_line}}\n` +
    `📎 View ticket: {{ticket_url}}`,

  // ── Approval Decided (requester) ─────────────────────────────────────────
  TICKET_APPROVAL_DECIDED_REQUESTER: (v) =>
    `📋 *Approval Update — {{company_name}}*\n\n` +
    `Ticket *#{{ticket_number}}* approval has been *{{decision}}*.\n\n` +
    `📋 *{{subject}}*\n` +
    `📎 View ticket: {{ticket_url}}`,

  // ── Ticket Escalated (requester) ─────────────────────────────────────────
  TICKET_ESCALATED_REQUESTER: (v) =>
    `🔺 *Ticket Escalated — {{company_name}}*\n\n` +
    `Ticket *#{{ticket_number}}* has been escalated to a higher support tier.\n\n` +
    `📋 *{{subject}}*\n` +
    `🎯 Priority: {{priority}}\n\n` +
    `Our senior team will review it soon.\n` +
    `📎 View ticket: {{ticket_url}}`,

  // ── Ticket Escalated (engineer) ───────────────────────────────────────────
  TICKET_ESCALATED_ENGINEER: (v) =>
    `🔺 *Ticket Escalated — {{company_name}}*\n\n` +
    `Ticket *#{{ticket_number}}* has been escalated by *{{updater_name}}*.\n\n` +
    `📋 *{{subject}}*\n` +
    `🎯 Priority: {{priority}}\n\n` +
    `📎 View ticket: {{ticket_url}}`,

  // ── Ticket Reopened ───────────────────────────────────────────────────────
  TICKET_REOPENED_ENGINEER: (v) =>
    `🔄 *Ticket Reopened — {{company_name}}*\n\n` +
    `Ticket *#{{ticket_number}}* has been reopened by *{{updater_name}}*.\n\n` +
    `📋 *{{subject}}*\n\n` +
    `📎 View ticket: {{ticket_url}}`,

  // ── CSAT / Rating Request (requester) ────────────────────────────────────
  TICKET_RATING_REQUEST: (v) =>
    `⭐ *How did we do? — {{company_name}}*\n\n` +
    `Ticket *#{{ticket_number}}* has been resolved.\n\n` +
    `📋 *{{subject}}*\n\n` +
    `We'd love your feedback! Rate your experience:\n` +
    `📎 {{rating_url}}`,

  // ── Weekly Digest ─────────────────────────────────────────────────────────
  WEEKLY_DIGEST: (v) =>
    `📊 *Weekly Ticket Digest — {{company_name}}*\n\n` +
    `Here's your summary for the week:\n\n` +
    `🎫 Open: {{open_count}}\n` +
    `✅ Resolved: {{resolved_count}}\n` +
    `🚫 SLA Breached: {{breached_count}}\n` +
    `⏳ Avg Resolution: {{avg_hours}}h\n\n` +
    `📎 View your tickets: {{system_url}}/tickets`,

  // ── Outage Notification Published ────────────────────────────────────────
  OUTAGE_PUBLISHED: (v) =>
    `🚨 *Service Alert — {{company_name}}*\n\n` +
    `*{{outage_title}}*\n` +
    `Severity: *{{outage_severity}}*\n\n` +
    `{{outage_details}}\n\n` +
    `📎 View status: {{system_url}}/outage-wall`,

  // ── Outage Resolved ──────────────────────────────────────────────────────
  OUTAGE_RESOLVED: (v) =>
    `✅ *Service Restored — {{company_name}}*\n\n` +
    `*{{outage_title}}* has been resolved.\n\n` +
    `📎 View status: {{system_url}}/outage-wall`,
};

/**
 * Get a rendered WhatsApp message for a given event type.
 * @param {string} eventType   — one of the keys in TEMPLATES
 * @param {Record<string,any>} vars  — ticket/event-specific variables
 * @returns {Promise<string>}  — rendered message ready to send
 */
const getMessage = async (eventType, vars = {}) => {
  const template = TEMPLATES[eventType];
  if (!template) {
    logger.warn('whatsappTemplates: unknown event type', { eventType });
    return '';
  }
  const ctx = await buildContext(vars);
  // template() just returns the raw template string (vars not used inside template fn)
  const raw = template(ctx);
  return render(raw, ctx);
};

/**
 * List all available template keys.
 * @returns {string[]}
 */
const listTemplates = () => Object.keys(TEMPLATES);

/**
 * Get the raw (un-rendered) template string for a given event.
 * @param {string} eventType
 * @returns {string|null}
 */
const getRawTemplate = (eventType) => {
  const fn = TEMPLATES[eventType];
  if (!fn) return null;
  // Create a dummy context to obtain the template string
  const dummy = new Proxy({}, { get: (_, k) => `{{${k}}}` });
  return fn(dummy);
};

module.exports = {
  getMessage,
  buildContext,
  render,
  getGlobalContext,
  invalidateCache,
  listTemplates,
  getRawTemplate,
  TEMPLATES,
};

// ============================================
// AI ASSISTANT ROUTES
// POST /api/ai/chat — Process a chat message
// GET  /api/ai/topics — List available topics
// ============================================

const express = require('express');
const router = express.Router();
const { authenticate, authorizeEngineerAiAssist } = require('../middleware/auth');
const { enforceLicensedFeature } = require('../middleware/license.middleware');
const { handleChat, processQuery, resolveSecurityPlaceholders, KNOWLEDGE_BASE } = require('../services/ai-engine.service');
const { executeQuery } = require('../config/database');
const logger = require('../utils/logger');
const botPhase2Service = require('../services/botPhase2.service');
const botApiIntegrationService = require('../services/botApiIntegrationService');
const botApiProviderService = require('../services/botApiProviderService');
const botSessionService = require('../services/botSessionService');
const botTrainingService = require('../services/botTrainingService');
const spellingService = require('../services/spellingCorrection.service');
const userIntelligence = require('../services/botUserIntelligence.service');
const botBehaviorConfig = require('../services/botBehaviorConfig.service');
const botKnowledgeGroundingService = require('../services/botKnowledgeGrounding.service');
const botDataQueryService = require('../services/botDataQuery.service');
const { getClientIp } = require('../utils/clientIp');

const DEFAULT_BOT_NAME = 'IT Support Assistant';

// Cache bot name for 5 minutes to avoid DB hits on every chat
let cachedBotName = null;
let botNameCacheTime = 0;
const BOT_NAME_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getBotName() {
  const now = Date.now();
  if (cachedBotName && (now - botNameCacheTime) < BOT_NAME_CACHE_TTL) {
    return cachedBotName;
  }
  try {
    // bot_name is stored in system_settings table (not bot_config)
    const result = await executeQuery(
      `SELECT setting_value FROM system_settings WHERE setting_key = @key`,
      { key: 'bot_name' }
    );
    cachedBotName = result.recordset?.[0]?.setting_value || DEFAULT_BOT_NAME;
    botNameCacheTime = now;
    return cachedBotName;
  } catch (err) {
    logger.warn('Failed to fetch bot name from settings, using default:', err.message);
    return cachedBotName || DEFAULT_BOT_NAME;
  }
}

// Default confidence threshold (can be overridden by bot_confidence_threshold in settings)
const DEFAULT_EXTERNAL_API_CONFIDENCE_THRESHOLD = 0.45;

const LAST_TICKET_PATTERNS = [
  /last\s+ticket\s+status/i,
  /latest\s+ticket\s+status/i,
  /my\s+last\s+ticket/i,
  /my\s+latest\s+ticket/i,
  /recent\s+ticket\s+status/i,
  /what\s+was\s+my\s+last\s+ticket\s+status/i,
  /what\s+is\s+my\s+last\s+ticket\s+status/i,
  /status\s+of\s+my\s+last\s+ticket/i,
];

const WHO_AM_I_PATTERNS = [
  /who\s+am\s+i/i,
  /my\s+role/i,
  /my\s+permission/i,
  /my\s+credential/i,
  /what\s+can\s+i\s+do/i,
];

const BOT_IDENTITY_PATTERNS = [
  /what(?:'s|\s+is)?\s+your\s+name/i,
  /who\s+are\s+you/i,
  /what\s+are\s+you/i,
  /tell\s+me\s+about\s+yourself/i,
  /introduce\s+yourself/i,
  /are\s+you\s+an?\s+(?:ai|bot|assistant|robot)/i,
  /what\s+(?:kind|type)\s+of\s+(?:ai|bot|assistant)/i,
  /your\s+name\b/i,
];

const MY_TICKET_SUMMARY_PATTERNS = [
  /my\s+open\s+tickets?/i,
  /ticket\s+summary/i,
  /summar(?:y|ize)\s+my\s+tickets?/i,
  /how\s+many\s+tickets?\s+do\s+i\s+have/i,
  /my\s+ticket\s+count/i,
  /show\s+my\s+tickets?/i,
];

const TEAM_STATS_PATTERNS = [
  /team\s+ticket\s+stat(?:s|istics|us)?/i,  // team ticket stats/status/statistics
  /show\s+team\s+ticket/i,                   // show team ticket ...
  /team\s+open\s+tickets?/i,
  /show\s+team\s+stat(?:s|istics)/i,
  /how\s+many\s+tickets?\s+does\s+(?:the\s+)?team\s+have/i,
  /team\s+summary/i,
  /team\s+stat(?:s|istics)/i,
];

const QUICK_CREATE_PATTERNS = [
  /create\s+a\s+ticket/i,
  /new\s+ticket/i,
  /create\s+new\s+ticket/i,
  /report\s+issue/i,
  /submit\s+ticket/i,
];

const FIND_TICKET_PATTERNS = [
  /find\s+ticket/i,
  /search\s+ticket/i,
  /look\s+for\s+ticket/i,
  /ticket\s+number/i,
];

const HELP_PATTERNS = [
  /^\s*help\s*[?!.]*\s*$/i,                       // standalone "help" or "help?"
  /\bassistant\s+help\b/i,                         // "assistant help"
  /^what\s+(?:can\s+)?you\s+(?:can\s+)?do/i,     // "what can you do?" / "what you can do?" / "what you do?"
  /^what\s+(?:do\s+)?you\s+(?:know|offer|provide|support)/i,  // "what do you know/offer/support"
  /your\s+(?:capabilit|feature|function)/i,       // "your capabilities" / "your features"
  /^commands?\s*[?!.]*\s*$/i,                     // standalone "commands"
  /\bavailable\s+commands\b/i,                    // "available commands"
  /^show\s+(?:me\s+)?(?:available\s+)?commands?/i,
  /^(?:show\s+)?help\s+(?:guide|menu|options?|center)\s*[?!.]*\s*$/i,
  /^(?:i\s+)?need\s+(?:some\s+)?help\s*[?!.]*\s*$/i,   // "i need help" alone
  /^(?:can|could)\s+(?:you\s+)?help\s*(?:me\s*)?[?!.]*\s*$/i,  // "can you help?"
  /^how\s+(?:can|do)\s+(?:i|you)\s+(?:use|help)/i,  // "how can I use this?" / "how do you help?"
  /^(?:list|show)\s+(?:me\s+)?(?:all\s+)?(?:your\s+)?(?:options|capabilities|features|commands)/i,
];

// ============================================
// DATA QUERY PATTERNS — Natural language DB queries
// Matches questions about ticket counts, department stats,
// user workload, status breakdowns, etc.
// ============================================
const DATA_QUERY_PATTERNS = [
  // Ticket counts (today/week/month/total)
  /how\s+many\s+ticket/i,
  /ticket\s+count/i,
  /total\s+(?:number\s+of\s+)?tickets?/i,
  /count\s+(?:of\s+)?(?:all\s+)?tickets?/i,
  /tickets?\s+(?:created|opened|raised|submitted|logged)\s+(?:today|yesterday|this\s+week|this\s+month|last\s+week|last\s+month)/i,
  /(?:today|yesterday|this\s+week|this\s+month)(?:'s)?\s+tickets?/i,

  // Department queries
  /(?:tickets?\s+(?:for|in|from|of|by)\s+)(?:the\s+)?(?:\w+\s+)?(?:department|dept)/i,
  /(?:department|dept)\s+(?:\w+\s+)?(?:tickets?|stats?|statistics?|report|summary)/i,
  /(?:which|what)\s+department\s+has\s+(?:the\s+)?(?:most|least|highest|lowest)/i,
  /tickets?\s+(?:per|by|for\s+each)\s+department/i,
  /department\s+(?:wise|breakdown)/i,

  // Status queries
  /(?:how\s+many\s+)?(?:open|closed|pending|resolved|in[\s-]progress|overdue|escalated)\s+tickets?/i,
  /tickets?\s+(?:that\s+are|which\s+are|with\s+status)\s+(?:open|closed|pending|resolved)/i,
  /(?:status|state)\s+(?:of\s+)?(?:all\s+)?tickets?/i,
  /ticket\s+status\s+(?:breakdown|summary|distribution|report|overview)/i,
  /(?:unresolved|outstanding|active|backlog)\s+tickets?/i,

  // Priority queries
  /(?:high|critical|urgent|low|medium)\s+priority\s+tickets?/i,
  /tickets?\s+(?:by|per|with)\s+priority/i,
  /priority\s+(?:breakdown|summary|distribution|wise)/i,

  // User/assignee queries
  /(?:tickets?\s+(?:assigned\s+to|for|of|handled\s+by))\s+\w/i,
  /(?:who|which\s+(?:agent|engineer|user|person))\s+has\s+(?:the\s+)?(?:most|least|highest|lowest)/i,
  /(?:workload|load)\s+(?:of|for|per)\s+(?:each\s+)?(?:agent|engineer|user)/i,
  /(?:agent|engineer)\s+(?:performance|stats?|workload|tickets?)/i,
  /(?:top|busiest|least\s+busy)\s+(?:agents?|engineers?)/i,

  // Time-based analytics
  /(?:average|avg|mean)\s+(?:resolution|response|close|closing)\s+time/i,
  /(?:resolution|response)\s+(?:time|rate|speed)/i,
  /(?:sla|service\s+level)\s+(?:compliance|breach|met|performance)/i,
  /(?:overdue|breached|expired)\s+(?:tickets?|sla)/i,

  // General analytics / dashboard-like questions
  /(?:give|show|get|tell|provide|display)\s+(?:me\s+)?(?:a\s+)?(?:summary|overview|report|stats?|statistics?|dashboard|breakdown|analysis)\s+(?:of\s+)?(?:all\s+)?tickets?/i,
  /ticket\s+(?:summary|overview|report|stats?|statistics?|dashboard|analysis)/i,
  /(?:daily|weekly|monthly)\s+(?:ticket\s+)?(?:report|summary|stats?)/i,

  // Category queries
  /tickets?\s+(?:by|per|in|for)\s+(?:each\s+)?category/i,
  /(?:which|what)\s+category\s+has\s+(?:the\s+)?(?:most|least)/i,
  /category\s+(?:breakdown|summary|distribution|wise)/i,
];

function isDataQueryIntent(message) {
  return DATA_QUERY_PATTERNS.some(p => p.test(message));
}

// Matches when the ENTIRE message is just a ticket number
const TICKET_NUMBER_ONLY_PATTERN = /^\s*(?:#?\d+|[A-Z]{2,}-\d{8}-\d{4,5}|TKT-\d{4}-\d{4,5})\s*$/i;

// Matches ticket numbers EMBEDDED inside natural language (non-anchored)
const TICKET_NUMBER_EMBEDDED_PATTERN = /(?:(?:ticket|tkt|#)\s*[-:]?\s*)?((?:[A-Z]{2,}-\d{8}-\d{4,5})|(?:TKT-\d{4}-\d{4,5})|(?:#\d{3,}))/i;

// Intent patterns for ticket inquiry in natural language
const TICKET_INQUIRY_PATTERNS = [
  /(?:status|detail|info|check|show|view|get|find|look\s*up|what\s+is|what's|tell\s+me\s+about|inquir|enquir|about)\b.*(?:[A-Z]{2,}-\d{8}-\d{4,5}|TKT-\d{4}-\d{4,5}|#\d{3,})/i,
  /(?:[A-Z]{2,}-\d{8}-\d{4,5}|TKT-\d{4}-\d{4,5}|#\d{3,}).*(?:status|detail|info|update|progress|where|how)/i,
  /(?:ticket)\s*(?:number|no|#)?\s*(?::|-|–)?\s*(?:[A-Z]{2,}-\d{8}-\d{4,5}|\d{3,})/i,
];

function isLastTicketIntent(message) {
  return LAST_TICKET_PATTERNS.some((pattern) => pattern.test(message));
}

function isWhoAmIIntent(message) {
  return WHO_AM_I_PATTERNS.some((pattern) => pattern.test(message));
}

function isBotIdentityIntent(message) {
  return BOT_IDENTITY_PATTERNS.some((pattern) => pattern.test(message));
}

function isMyTicketSummaryIntent(message) {
  return MY_TICKET_SUMMARY_PATTERNS.some((pattern) => pattern.test(message));
}

function isTeamStatsIntent(message) {
  return TEAM_STATS_PATTERNS.some((pattern) => pattern.test(message));
}

function isQuickCreateIntent(message) {
  return QUICK_CREATE_PATTERNS.some((pattern) => pattern.test(message));
}

function isFindTicketIntent(message) {
  return FIND_TICKET_PATTERNS.some((pattern) => pattern.test(message));
}

function isTicketInquiryIntent(message) {
  return TICKET_INQUIRY_PATTERNS.some((pattern) => pattern.test(message));
}

function isHelpIntent(message) {
  return HELP_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * Extract ticket lookup input from a message.
 * Supports:
 *   1. Bare ticket number: "ABCD-20260302-0016", "#123", "TKT-2026-00001"
 *   2. Natural language: "show me ticket ABCD-20260302-0016", "status of #123"
 */
function extractTicketLookupInput(message) {
  const text = (message || '').trim();

  // Case 1: Entire message is just a ticket number
  if (TICKET_NUMBER_ONLY_PATTERN.test(text)) {
    const normalized = text.replace(/^#/, '').trim();
    const numericId = /^\d+$/.test(normalized) ? parseInt(normalized, 10) : null;
    return {
      raw: normalized,
      numericId,
      ticketNumber: numericId ? null : normalized.toUpperCase(),
    };
  }

  // Case 2: Ticket number embedded in natural language
  const embeddedMatch = text.match(TICKET_NUMBER_EMBEDDED_PATTERN);
  if (embeddedMatch) {
    const extracted = (embeddedMatch[1] || embeddedMatch[0]).replace(/^#/, '').trim();
    const numericId = /^\d+$/.test(extracted) ? parseInt(extracted, 10) : null;
    return {
      raw: extracted,
      numericId,
      ticketNumber: numericId ? null : extracted.toUpperCase(),
    };
  }

  // Case 3: Check for ticket inquiry intent with a bare number
  if (isTicketInquiryIntent(text) || isFindTicketIntent(text)) {
    const numMatch = text.match(/\b(\d{3,})\b/);
    if (numMatch) {
      return {
        raw: numMatch[1],
        numericId: parseInt(numMatch[1], 10),
        ticketNumber: null,
      };
    }
  }

  return null;
}

async function getTicketDetailsForLookup(lookup, user) {
  const canViewAll = user?.permissions?.can_view_all_tickets || false;
  const userId = user?.user_id;

  let filterClause = '';
  const params = { userId };

  if (lookup.numericId) {
    filterClause = 't.ticket_id = @ticketId';
    params.ticketId = lookup.numericId;
  } else {
    filterClause = 'UPPER(t.ticket_number) = @ticketNumber';
    params.ticketNumber = lookup.ticketNumber;
  }

  const query = `
    SELECT TOP 1
      t.ticket_id,
      t.ticket_number,
      t.subject,
      t.description,
      t.resolution_notes,
      t.created_at,
      t.updated_at,
      ts.status_name,
      ts.status_code,
      ts.is_final_status,
      tp.priority_name,
      tc.category_name,
      d.department_name,
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
  const statusLabel = ticket?.status_name || 'Unknown';
  const priority = ticket?.priority_name || 'N/A';
  const category = ticket?.category_name || 'N/A';
  const department = ticket?.department_name || 'N/A';
  const requester = ticket?.requester_name?.trim() || 'N/A';
  const assigned = ticket?.assigned_to_name?.trim() || 'Unassigned';
  const description = ticket?.description?.trim() || 'No description available';

  return `Here are the details for **${ticket.ticket_number || `#${ticket.ticket_id}`}**:\n\n` +
    `📝 **Subject**: ${ticket.subject || 'N/A'}\n` +
    `📌 **Status**: ${statusLabel}${ticket.is_final_status ? ' (Final)' : ''}\n` +
    `⚡ **Priority**: ${priority}\n` +
    `🏷️ **Category**: ${category}\n` +
    `🏢 **Department**: ${department}\n` +
    `👤 **Requester**: ${requester}\n` +
    `🛠️ **Assigned To**: ${assigned}\n` +
    `🕒 **Created**: ${createdAt}\n` +
    `🕒 **Updated**: ${updatedAt}\n\n` +
    `**Description:**\n${description}`;
}

function getCredentialCapabilities(user) {
  const capabilities = [];
  const p = user?.permissions || {};

  if (p.can_create_tickets) capabilities.push('Create new support tickets');
  if (p.can_view_all_tickets) capabilities.push('View all team tickets');
  if (p.can_assign_tickets) capabilities.push('Assign tickets to engineers');
  if (p.can_close_tickets) capabilities.push('Close or reopen tickets');
  if (p.can_manage_users) capabilities.push('Manage users');
  if (p.can_manage_system) capabilities.push('Manage system settings');

  if (capabilities.length === 0) {
    capabilities.push('View and track your own tickets');
  }

  return capabilities;
}

async function getLastTicketForUser(userId) {
  const query = `
    SELECT TOP 1
      t.ticket_id,
      t.ticket_number,
      t.subject,
      t.created_at,
      t.updated_at,
      t.requester_id,
      ts.status_name,
      ts.status_code,
      ts.is_final_status,
      u.first_name + ' ' + u.last_name as assigned_to_name
    FROM tickets t
    LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
    LEFT JOIN users u ON t.assigned_to = u.user_id
    WHERE t.requester_id = @userId
    ORDER BY t.created_at DESC, t.ticket_id DESC
  `;

  const result = await executeQuery(query, { userId });
  return result.recordset?.[0] || null;
}

function formatLastTicketAnswer(ticket, user) {
  if (!ticket) {
    return `I checked your account, but I couldn't find any tickets created by you yet.\n\nYou can create one from **Tickets → Create** or just say **create a ticket**.`;
  }

  const status = ticket.status_name || 'Unknown';
  const ticketNo = ticket.ticket_number || `#${ticket.ticket_id}`;
  const subject = ticket.subject || 'No subject';
  const assigned = ticket.assigned_to_name?.trim() || 'Not assigned yet';
  const createdAt = ticket.created_at ? new Date(ticket.created_at).toLocaleString() : 'N/A';
  const stateLabel = ticket.is_final_status ? 'Final status' : 'Current status';
  const userName = user?.full_name || user?.username || 'User';

  return `Sure ${userName}, I checked your latest ticket from the backend.\n\n` +
    `🎫 **Ticket**: ${ticketNo}\n` +
    `📝 **Subject**: ${subject}\n` +
    `📌 **${stateLabel}**: ${status}\n` +
    `👤 **Assigned To**: ${assigned}\n` +
    `🕒 **Created At**: ${createdAt}\n\n` +
    `Want me to help you with the next action for this ticket?`;
}

async function getMyTicketSummary(userId) {
  const query = `
    SELECT
      COUNT(*) AS total_tickets,
      SUM(CASE WHEN ts.is_final_status = 0 THEN 1 ELSE 0 END) AS open_tickets,
      SUM(CASE WHEN ts.is_final_status = 1 THEN 1 ELSE 0 END) AS closed_tickets,
      SUM(CASE WHEN UPPER(ts.status_code) = 'PENDING' THEN 1 ELSE 0 END) AS pending_tickets,
      SUM(CASE WHEN UPPER(tp.priority_code) IN ('CRITICAL', 'HIGH') AND ts.is_final_status = 0 THEN 1 ELSE 0 END) AS urgent_open_tickets
    FROM tickets t
    LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
    LEFT JOIN ticket_priorities tp ON t.priority_id = tp.priority_id
    WHERE t.requester_id = @userId
  `;

  const result = await executeQuery(query, { userId });
  return result.recordset?.[0] || null;
}

function decorateWithRoleFlow(result, user) {
  const roleName = user?.role?.role_name || 'User';
  const permissions = user?.permissions || {};
  const followUp = Array.isArray(result.followUp) ? [...result.followUp] : [];

  if (!permissions.can_create_tickets) {
    const filtered = followUp.filter((item) => item.toLowerCase() !== 'create a ticket');
    result.followUp = filtered;
  }

  if (permissions.can_view_all_tickets && !followUp.includes('Show team ticket stats')) {
    result.followUp = [...(result.followUp || []), 'Show team ticket stats'];
  }

  if (result.category === 'helpdesk' || result.category === 'account' || result.category === 'general') {
    // Responses are already personalized based on user permissions
  }

  return result;
}

async function getTeamStats(user) {
  const query = `
    SELECT
      COUNT(*) AS total_tickets,
      SUM(CASE WHEN ts.is_final_status = 0 THEN 1 ELSE 0 END) AS open_tickets,
      SUM(CASE WHEN ts.is_final_status = 1 THEN 1 ELSE 0 END) AS closed_tickets,
      SUM(CASE WHEN UPPER(tp.priority_code) IN ('CRITICAL', 'HIGH') AND ts.is_final_status = 0 THEN 1 ELSE 0 END) AS urgent_open
    FROM tickets t
    LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
    LEFT JOIN ticket_priorities tp ON t.priority_id = tp.priority_id
  `;

  const result = await executeQuery(query);
  return result.recordset?.[0] || null;
}

function createHelpMessage(user, botName) {
  let helpText = `## 🤖 **${botName}** — Help Guide\n\nHere's what I can help you with:\n\n`;
  helpText += `**📋 Tickets:**\n`;
  helpText += `• "What is my last ticket status?"\n`;
  helpText += `• "Show my ticket summary"\n`;
  helpText += `• "Create a ticket"\n`;
  helpText += `• "Track my ticket"\n\n`;
  helpText += `**👤 Account:**\n`;
  helpText += `• "Who am I?" — View your role and permissions\n`;
  helpText += `• "Change my password"\n\n`;
  
  const canViewAll = user?.permissions?.can_view_all_tickets || user?.permissions?.can_manage_system || false;

  if (canViewAll) {
    helpText += `**📊 Data & Analytics (Manager/Admin):**\n`;
    helpText += `• "How many tickets today?" — Real-time ticket counts\n`;
    helpText += `• "Show tickets by department" — Department breakdown\n`;
    helpText += `• "Tickets for IT department" — Specific department stats\n`;
    helpText += `• "Show status breakdown" — Open/Closed/Pending distribution\n`;
    helpText += `• "Priority breakdown" — Tickets by priority level\n`;
    helpText += `• "Agent workload" — Who has the most tickets\n`;
    helpText += `• "Average resolution time" — Resolution time analysis\n`;
    helpText += `• "SLA performance" — SLA compliance stats\n`;
    helpText += `• "Ticket summary this week" — Time-filtered summaries\n\n`;

    helpText += `**⚙️ Administration:**\n`;
    helpText += `• "Show team statistics"\n`;
    helpText += `• "System status"\n\n`;
  }

  helpText += `**💡 IT Support:**\n`;
  helpText += `• Network, email, VPN, printer, and software troubleshooting\n`;
  helpText += `• Password resets and account access issues\n`;
  helpText += `• Hardware and performance problems\n\n`;
  helpText += `Type your question and I'll do my best to help!`;
  
  return helpText;
}

/**
 * POST /api/ai/chat
 * Body: { message: string, sessionId?: string }
 * Returns: { answer, confidence, category, followUp, entities, matchedTopic }
 * NOW: Records every message & response in bot_chat_sessions / bot_chat_messages
 */
router.post('/chat', authenticate, enforceLicensedFeature('ai_assistant'), async (req, res) => {
  const startTime = Date.now();
  try {
    const { message, sessionId } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    if (message.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Message too long (max 1000 characters)'
      });
    }

    // ============================================
    // SPELLING CORRECTION — fix typos before processing
    // ============================================
    const spellResult = spellingService.correctMessage(message.trim());
    const processedMessage = spellResult.corrected;
    if (spellResult.wasCorrected) {
      logger.info('Spelling corrected', {
        userId: req.user?.user_id,
        original: message.trim().substring(0, 100),
        corrected: processedMessage.substring(0, 100),
        corrections: spellResult.corrections.map(c => `${c.original}->${c.corrected}`).join(', ')
      });
    }

    // Ticket number lookup intent — handles both bare numbers and natural language
    const ticketLookup = extractTicketLookupInput(processedMessage);
    if (ticketLookup) {
      try {
        const ticket = await getTicketDetailsForLookup(ticketLookup, req.user);

        if (!ticket) {
          return res.json({
            success: true,
            data: {
              answer: `I couldn't find a ticket matching **${ticketLookup.raw}**. This could mean:\n\n• The ticket number doesn't exist\n• You don't have permission to view it\n• The number format might be incorrect\n\nPlease double-check the ticket number and try again.`,
              confidence: 1,
              category: 'helpdesk',
              followUp: ['What is my last ticket status?', 'Show my ticket summary', 'Create a ticket'],
              entities: [],
              matchedTopic: { id: 'ticket-lookup-not-found', category: 'helpdesk' },
              botName: await getBotName(),
            }
          });
        }

        return res.json({
          success: true,
          data: {
            answer: formatTicketLookupResponse(ticket),
            confidence: 1,
            category: 'helpdesk',
            followUp: ['What is my last ticket status?', 'Show my ticket summary', 'Create a ticket'],
            entities: [],
            matchedTopic: { id: 'ticket-lookup-direct', category: 'helpdesk' },
            botName: await getBotName(),
          }
        });
      } catch (lookupErr) {
        logger.error('Ticket lookup failed:', lookupErr.message);
        // Fall through to regular AI handling
      }
    }

    // Use user ID as session identifier for context tracking
    const sid = sessionId || `user-${req.user?.user_id || 'anon'}`;

    // ============================================
    // SESSION TRACKING: Start/resume session
    // ============================================
    try {
      await botSessionService.startSession({
        sessionId: sid,
        userId: req.user?.user_id,
        userName: req.user?.full_name || req.user?.username || 'Unknown',
        userRole: req.user?.role?.role_name || 'User',
        ipAddress: getClientIp(req),
        userAgent: req.headers?.['user-agent']
      });
    } catch (sessionErr) {
      logger.warn('Session start failed (non-blocking):', sessionErr.message);
    }

    // ============================================
    // SESSION TRACKING: Record user message
    // ============================================
    botSessionService.recordUserMessage({
      sessionId: sid,
      userId: req.user?.user_id,
      messageContent: message.trim()
    }).catch(err => logger.warn('User message record failed:', err.message));

    // ============================================
    // HELPER: Record bot response and send
    // ============================================
    const botName = await getBotName();
    const sendAndRecord = async (responseData, intentId, actionType = null, actionData = null) => {
      const responseTimeMs = Date.now() - startTime;
      const data = responseData;

      // Record bot message (non-blocking)
      botSessionService.recordBotMessage({
        sessionId: sid,
        userId: req.user?.user_id,
        messageContent: data.answer,
        intentMatched: intentId || data.matchedTopic?.id || null,
        category: data.category || null,
        confidence: data.confidence || null,
        aiEnhanced: data.aiEnhanced || false,
        aiProvider: data.aiProvider || null,
        responseTimeMs,
        followUpOptions: data.followUp || null,
        actionType,
        actionData
      }).catch(err => logger.warn('Bot message record failed:', err.message));

      return res.json({ success: true, data: { ...data, botName } });
    };

    if (isLastTicketIntent(processedMessage)) {
      const ticket = await getLastTicketForUser(req.user.user_id);
      const answer = formatLastTicketAnswer(ticket, req.user);

      logger.info('AI personalized intent handled', {
        userId: req.user?.user_id,
        intent: 'last-ticket-status',
        ticketNumber: ticket?.ticket_number || null,
      });

      return sendAndRecord({
        answer,
        confidence: 1,
        category: 'helpdesk',
        followUp: ['Track my ticket', 'Create a ticket', 'Talk to support'],
        entities: [],
        matchedTopic: { id: 'last-ticket-status-live', category: 'helpdesk' },
      }, 'last-ticket-status');
    }

    if (isBotIdentityIntent(processedMessage)) {
      const firstName = req.user?.first_name || req.user?.username || 'there';
      const answer = `Hi ${firstName}! I'm **${botName}**, your IT support assistant.\n\n` +
        `I'm an AI-powered chatbot that can help you with:\n` +
        `• **Ticket Management** — create, track, and update support tickets\n` +
        `• **IT Troubleshooting** — network, email, VPN, software, and hardware issues\n` +
        `• **Account Help** — password resets, 2FA, and access requests\n` +
        `• **Self-Service** — guided workflows for common IT tasks\n\n` +
        `Type **"help"** to see everything I can do for you!`;

      logger.info('AI bot-identity intent handled', {
        userId: req.user?.user_id,
        intent: 'bot-identity',
      });

      return sendAndRecord({
        answer,
        confidence: 1,
        category: 'identity',
        followUp: ['What can you do?', 'Create a ticket', 'What is my last ticket status?'],
        entities: [],
        matchedTopic: { id: 'bot-identity', category: 'general' },
      }, 'bot-identity');
    }

    if (isWhoAmIIntent(processedMessage)) {
      const capabilities = getCredentialCapabilities(req.user);
      const fullName = req.user?.full_name || req.user?.username || 'User';
      const roleName = req.user?.role?.role_name || 'Unknown';
      const answer = `You're logged in as **${fullName}** (${roleName}).\n\n` +
        `**Your permissions:**\n` +
        capabilities.map((item) => `• ${item}`).join('\n');

      logger.info('AI credential intent handled', {
        userId: req.user?.user_id,
        intent: 'who-am-i',
        role: req.user?.role?.role_code,
      });

      return sendAndRecord({
        answer,
        confidence: 1,
        category: 'account',
        followUp: ['What is my last ticket status?', 'Track my ticket'],
        entities: [],
        matchedTopic: { id: 'credential-aware-flow', category: 'account' },
      }, 'who-am-i');
    }

    if (isMyTicketSummaryIntent(processedMessage)) {
      const summary = await getMyTicketSummary(req.user.user_id);
      const total = Number(summary?.total_tickets || 0);
      const open = Number(summary?.open_tickets || 0);
      const closed = Number(summary?.closed_tickets || 0);
      const pending = Number(summary?.pending_tickets || 0);
      const urgent = Number(summary?.urgent_open_tickets || 0);

      const answer = total === 0
        ? `You don't have any tickets yet. I can help you create one now.`
        : `Here is your live ticket summary:\n\n` +
          `🎫 **Total**: ${total}\n` +
          `📂 **Open**: ${open}\n` +
          `✅ **Closed**: ${closed}\n` +
          `⏳ **Pending**: ${pending}\n` +
          `🚨 **Urgent Open (High/Critical)**: ${urgent}`;

      logger.info('AI ticket summary intent handled', {
        userId: req.user?.user_id,
        intent: 'my-ticket-summary',
        total,
        open,
        urgent,
      });

      return sendAndRecord({
        answer,
        confidence: 1,
        category: 'helpdesk',
        followUp: ['Track my ticket', 'What is my last ticket status?', 'Create a ticket'],
        entities: [],
        matchedTopic: { id: 'my-ticket-summary-live', category: 'helpdesk' },
      }, 'my-ticket-summary');
    }

    // Handle Team Statistics (for admins/managers)
    if (isTeamStatsIntent(processedMessage) && req.user?.permissions?.can_view_all_tickets) {
      const stats = await getTeamStats(req.user);
      const total = Number(stats?.total_tickets || 0);
      const open = Number(stats?.open_tickets || 0);
      const closed = Number(stats?.closed_tickets || 0);
      const urgent = Number(stats?.urgent_open || 0);

      const answer = `📊 **Team Ticket Statistics**\n\n` +
        `🎫 **Total Tickets**: ${total}\n` +
        `📂 **Open Tickets**: ${open}\n` +
        `✅ **Closed Tickets**: ${closed}\n` +
        `🚨 **Urgent Open (High/Critical)**: ${urgent}\n\n` +
        `*Last updated:* ${new Date().toLocaleString()}\n\n` +
        `You can view detailed stats in **Analytics → Tickets** section.`;

      logger.info('AI team stats intent handled', {
        userId: req.user?.user_id,
        intent: 'team-stats',
        total,
        open,
        urgent,
      });

      return sendAndRecord({
        answer,
        confidence: 1,
        category: 'helpdesk',
        followUp: ['Show my ticket summary', 'Recent activity', 'System health'],
        entities: [],
        matchedTopic: { id: 'team-stats-live', category: 'admin' },
      }, 'team-stats');
    }

    // Handle Quick Ticket Creation
    if (isQuickCreateIntent(processedMessage)) {
      const answer = `🎟️ **Create New Ticket**\n\n` +
        `I can help you create a support ticket. Go to **Tickets → Create Ticket** and I'll guide you through the process.\n\n` +
        `**You'll need:**\n` +
        `• Subject (what's the issue?)\n` +
        `• Department (where should it go?)\n` +
        `• Priority Level (how urgent?)\n` +
        `• Detailed Description\n\n` +
        `**Tips:**\n` +
        `✓ Be specific in the subject\n` +
        `✓ Include error messages if any\n` +
        `✓ Attach screenshots if helpful\n\n` +
        `Ready to create? Click the button or navigate to **Tickets → Create**.`;

      return sendAndRecord({
        answer,
        confidence: 0.95,
        category: 'helpdesk',
        followUp: ['Go to Tickets', 'Show ticket template', 'Cancel'],
        entities: [],
        matchedTopic: { id: 'quick-create-guide', category: 'helpdesk' },
      }, 'quick-create', 'navigation', { target: 'tickets/create' });
    }

    // Handle Help Intent
    if (isHelpIntent(processedMessage)) {
      const answer = createHelpMessage(req.user, botName);

      logger.info('AI help intent handled', {
        userId: req.user?.user_id,
        intent: 'help',
        role: req.user?.role?.role_code,
      });

      return sendAndRecord({
        answer,
        confidence: 1,
        category: 'general',
        followUp: ['Show my tickets', 'Create a ticket', 'Who am I?'],
        entities: [],
        matchedTopic: { id: 'help-guide', category: 'general' },
      }, 'help');
    }

    // ============================================
    // DATA QUERY INTENT — DB-powered ticket analytics
    // ============================================
    if (isDataQueryIntent(processedMessage) || botDataQueryService.isDataQueryIntent(processedMessage)) {
      try {
        const dataResult = await botDataQueryService.processDataQuery(processedMessage, req.user);
        if (dataResult) {
          logger.info('AI data query intent handled', {
            userId: req.user?.user_id,
            intent: 'data-query',
            queryType: dataResult.queryType,
            success: dataResult.success,
          });

          return sendAndRecord({
            answer: dataResult.answer,
            confidence: 1,
            category: 'data-query',
            followUp: ['Show ticket summary', 'Tickets by department', 'Show status breakdown', 'Priority breakdown'],
            entities: [],
            matchedTopic: { id: `data-query-${dataResult.queryType}`, category: 'analytics' },
          }, `data-query-${dataResult.queryType}`);
        }
      } catch (dataErr) {
        logger.error('Data query intent failed:', dataErr.message);
        // Fall through to regular AI handling
      }
    }

    let customIntent = null;
    try {
      customIntent = await botPhase2Service.matchCustomIntent(processedMessage);
    } catch (e) {
      logger.warn('Custom intent match failed:', e.message);
    }
    if (customIntent) {
      const departmentName = await botPhase2Service.getDepartmentResponseContext(req.user);
      const workflowResult = await botPhase2Service.executeWorkflowAction(
        customIntent.action_type,
        customIntent.action_config,
        { user_id: req.user?.user_id, message }
      );

      const answerBase = customIntent.response_template || `Custom intent matched: ${customIntent.intent_name}`;
      const answer = botPhase2Service.buildDepartmentSpecificResponse(answerBase, departmentName);

      return sendAndRecord({
        answer,
        confidence: 0.95,
        category: 'custom-intent',
        followUp: ['Run another custom command', 'Show analytics summary', 'Help'],
        entities: [],
        matchedTopic: { id: `custom-${customIntent.intent_id}`, category: 'custom' },
        workflow: workflowResult,
      }, `custom-${customIntent.intent_name}`, customIntent.action_type || null);
    }

    let result;
    let personalized;
    try {
      result = await handleChat(sid, processedMessage);
      personalized = decorateWithRoleFlow(result, req.user);
      try {
        const departmentName = await botPhase2Service.getDepartmentResponseContext(req.user);
        personalized.answer = botPhase2Service.buildDepartmentSpecificResponse(personalized.answer, departmentName);
      } catch (deptErr) {
        logger.warn('Department context failed:', deptErr.message);
      }
    } catch (chatErr) {
      logger.error('handleChat failed, using processQuery fallback:', chatErr.message);
      result = processQuery(processedMessage, []);
      result.answer = await resolveSecurityPlaceholders(result.answer);
      personalized = decorateWithRoleFlow(result, req.user);
    }

    const groundedKnowledge = await botKnowledgeGroundingService.getGroundedAnswer(processedMessage);
    if (groundedKnowledge) {
      // Don't override high-confidence intent results or data/help/ticket results
      const protectedIntents = ['help-', 'data-query-', 'last-ticket-', 'team-stats-', 'my-ticket-', 'bot-identity', 'credential-', 'quick-create', 'custom-'];
      const isProtectedResult = protectedIntents.some(prefix => personalized.matchedTopic?.id?.startsWith(prefix));
      const shouldReplaceWithGrounded = !isProtectedResult && (!personalized.matchedTopic?.id || personalized.confidence < 0.9 || personalized.category === 'general');

      if (shouldReplaceWithGrounded) {
        personalized.answer = groundedKnowledge.answer;
        personalized.confidence = Math.max(personalized.confidence || 0, groundedKnowledge.primary.confidence);
        personalized.category = groundedKnowledge.primary.sourceType === 'training' ? 'resolved-ticket-grounded' : 'help-center-grounded';
        personalized.followUp = groundedKnowledge.followUp;
        personalized.matchedTopic = {
          id: `${groundedKnowledge.primary.sourceType || 'article'}-${groundedKnowledge.primary.articleId}`,
          category: groundedKnowledge.primary.category,
        };
        personalized.sources = groundedKnowledge.sources;
      } else {
        const sourcePrefix = groundedKnowledge.primary.sourceType === 'training' ? 'Resolved ticket source' : 'Help Center source';
        personalized.answer += `\n\n---\n**${sourcePrefix}:** ${groundedKnowledge.primary.title}`;
        personalized.sources = groundedKnowledge.sources;
      }
    }

    // ============================================
    // AUTO-TRAINING DATA ENHANCEMENT
    // If confidence is below threshold, check trained patterns from resolved tickets
    // AND user-confirmed feedback answers (higher priority: confidence_score = 0.85)
    // ============================================
    let trainingDataUsed = false;
    if (personalized.confidence < DEFAULT_EXTERNAL_API_CONFIDENCE_THRESHOLD) {
      try {
        const trainingMatches = await botTrainingService.searchTrainingData(processedMessage, 2);
        if (trainingMatches.length > 0) {
          const bestMatch = trainingMatches[0];
          let trainedAnswer = `Based on our resolved support tickets:\n\n`;
          trainedAnswer += bestMatch.resolution_text;
          if (bestMatch.source_ticket_number) {
            trainedAnswer += `\n\n*Learned from ticket ${bestMatch.source_ticket_number}*`;
          }
          personalized.answer = trainedAnswer;
          // Use the actual confidence from training data (0.85 for user-feedback, 0.7 for auto-trained)
          personalized.confidence = Math.max(personalized.confidence, bestMatch.confidence_score || 0.65);
          personalized.category = 'trained-knowledge';
          trainingDataUsed = true;
          logger.info('Training data enhanced response', {
            trainingId: bestMatch.training_id,
            category: bestMatch.category,
            createdBy: bestMatch.created_by,
            usageCount: bestMatch.usage_count,
            confidenceScore: bestMatch.confidence_score
          });
        }
      } catch (trainErr) {
        logger.warn('Training data lookup failed (non-blocking):', trainErr.message);
      }
    }

    // ============================================
    // EXTERNAL API ENHANCEMENT
    // If confidence is still low, try external AI providers
    // Uses human-like, empathetic, admin-configurable prompts
    // ============================================
    let externalUsed = false;
    let externalProvider = null;
    const behaviorConfig = await botBehaviorConfig.getBehaviorConfig();
    const confidenceThreshold = behaviorConfig.bot_confidence_threshold ?? DEFAULT_EXTERNAL_API_CONFIDENCE_THRESHOLD;
    const shouldTryExternal = personalized.confidence < confidenceThreshold || behaviorConfig.bot_ai_always_enhance;

    if (shouldTryExternal) {
      try {
        let enabledProviders = await botApiProviderService.getEnabledProviders();

        // Fallback: if no providers configured, try Ollama directly (for general questions)
        if (enabledProviders.length === 0) {
          const ollamaBase = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
          const ollamaEndpoint = ollamaBase.replace(/\/$/, '') + '/api/chat';
          try {
            const userContext = await userIntelligence.getPersonalizationContext(req.user?.user_id);
            let systemPrompt = await botBehaviorConfig.buildAISystemPrompt(botName, req.user, userContext);
            const aiMessages = [{ role: 'system', content: systemPrompt }];
            try {
              const sessionMessages = await botSessionService.getSessionMessages(sid);
              if (sessionMessages?.length > 0) {
                // Skip the most recent occurrence of the current user message (it may have just been recorded)
                let skippedCurrent = false;
                const recentReversed = sessionMessages.slice(-20).reverse();
                const filteredHistory = [];
                for (const msg of recentReversed) {
                  if (!skippedCurrent && msg.message_type === 'user' && msg.message_content === message.trim()) {
                    skippedCurrent = true;
                    continue;
                  }
                  filteredHistory.unshift(msg);
                }
                for (const msg of filteredHistory) {
                  if (msg.message_type === 'user' && msg.message_content) {
                    aiMessages.push({ role: 'user', content: msg.message_content });
                  } else if (msg.message_type === 'bot' && msg.message_content) {
                    aiMessages.push({ role: 'assistant', content: msg.message_content.length > 500 ? msg.message_content.substring(0, 500) + '...' : msg.message_content });
                  }
                }
              }
            } catch (_) { /* ignore */ }
            aiMessages.push({ role: 'user', content: message.trim() });
            const aiResult = await botApiIntegrationService.callLocalLLM(
              aiMessages,
              ollamaEndpoint,
              'llama3:8b',
              { max_tokens: 2000, temperature: 0.7 }
            );
            if (aiResult.success && aiResult.content) {
              personalized.answer = aiResult.content;
              personalized.confidence = 0.9;
              personalized.category = 'ai-enhanced';
              externalUsed = true;
              externalProvider = 'Ollama (llama3:8b)';
              logger.info('Ollama fallback used (no providers configured)', { userId: req.user?.user_id });
            }
          } catch (fallbackErr) {
            logger.warn('Ollama fallback failed:', fallbackErr.message);
          }
        }

        if (enabledProviders.length > 0 && !externalUsed) {
          // Get user intelligence context for personalization
          const userContext = await userIntelligence.getPersonalizationContext(req.user?.user_id);
          let systemPrompt = await botBehaviorConfig.buildAISystemPrompt(botName, req.user, userContext);

          // Add empathy cues when user seems frustrated or urgent
          const needsEmpathy = behaviorConfig.bot_empathy_enabled && botBehaviorConfig.detectEmpathyNeeded(processedMessage);
          if (needsEmpathy) {
            systemPrompt += botBehaviorConfig.getEmpathyPreamble(true);
          }

          // Build conversation history for multi-turn context
          const aiMessages = [{ role: 'system', content: systemPrompt }];

          try {
            const sessionMessages = await botSessionService.getSessionMessages(sid);
            if (sessionMessages && sessionMessages.length > 0) {
              // Skip the most recent occurrence of the current user message (may have just been recorded)
              let skippedCurrent = false;
              const recentReversed = sessionMessages.slice(-20).reverse();
              const filteredHistory = [];
              for (const msg of recentReversed) {
                if (!skippedCurrent && msg.message_type === 'user' && msg.message_content === message.trim()) {
                  skippedCurrent = true;
                  continue;
                }
                filteredHistory.unshift(msg);
              }
              for (const msg of filteredHistory) {
                if (msg.message_type === 'user' && msg.message_content) {
                  aiMessages.push({ role: 'user', content: msg.message_content });
                } else if (msg.message_type === 'bot' && msg.message_content) {
                  // Truncate long bot responses to save tokens
                  const content = msg.message_content.length > 500
                    ? msg.message_content.substring(0, 500) + '...'
                    : msg.message_content;
                  aiMessages.push({ role: 'assistant', content });
                }
              }
              logger.info('Conversation memory loaded', {
                sessionId: sid,
                historyMessages: aiMessages.length - 1
              });
            }
          } catch (historyErr) {
            logger.warn('Failed to load conversation history (non-blocking):', historyErr.message);
          }

          // Add the current user message last
          aiMessages.push({ role: 'user', content: message.trim() });
          
          const aiResult = await botApiIntegrationService.callWithFallback(
            aiMessages,
            sid,
            req.user?.user_id,
            { max_tokens: 2000, temperature: 0.7 }
          );
          
          if (aiResult.success && aiResult.content) {
            personalized.answer = aiResult.content;
            personalized.confidence = 0.9;
            personalized.category = 'ai-enhanced';
            externalUsed = true;
            externalProvider = aiResult.provider_label || aiResult.provider;
            
            logger.info('External AI enhanced response', {
              userId: req.user?.user_id,
              provider: aiResult.provider,
              model: aiResult.model,
              tokens: aiResult.totalTokens,
              latency: aiResult.latency_ms
            });
          }
        }
      } catch (externalError) {
        logger.warn('External API enhancement failed, using local response:', externalError.message);
      }
    }

    logger.info('AI Chat processed', {
      userId: req.user?.user_id,
      query: message.substring(0, 100),
      matchedTopic: personalized.matchedTopic?.id || 'none',
      confidence: personalized.confidence,
      externalUsed
    });

    // ============================================
    // USER INTELLIGENCE: Record interaction for learning
    // ============================================
    userIntelligence.recordInteraction(
      req.user?.user_id,
      processedMessage,
      personalized.matchedTopic?.id || null,
      personalized.confidence,
      personalized.category || 'general'
    ).catch(err => logger.warn('User intelligence record failed:', err.message));

    // Build response — include spelling note only when corrections are meaningful
    // Don't show note for high-confidence matches (intent was understood fine)
    const showSpellingNote = spellResult.wasCorrected && personalized.confidence < 0.9;
    const spellingNote = showSpellingNote
      ? `*(I understood your message as: "${processedMessage}")*\n\n`
      : '';

    return sendAndRecord({
      answer: spellingNote + personalized.answer,
      confidence: personalized.confidence,
      category: personalized.category,
      followUp: personalized.followUp,
      entities: personalized.entities,
      matchedTopic: personalized.matchedTopic,
      ...(externalUsed && { aiProvider: externalProvider, aiEnhanced: true })
    }, personalized.matchedTopic?.id || 'nlp-engine');
  } catch (error) {
    logger.error('AI Chat error', { error: error.message, stack: error.stack });
    // Return 200 with fallback so chat doesn't break; frontend shows the message
    const fallbackAnswer = `Sorry, I'm having a bit of trouble right now. 😅 This is likely a temporary issue — please give it a moment and try again.\n\nIn the meantime, you can:\n• **Create a support ticket** and our IT team will help you directly\n• **Browse the Help Center** for self-service guides\n• Try rephrasing your question in a different way\n\n*(Admin note: If Ollama is configured, ensure it is running with \`ollama serve\` and the model is loaded.)*`;
    return res.status(200).json({
      success: true,
      data: {
        answer: fallbackAnswer,
        confidence: 0,
        category: 'error',
        followUp: ['Create a ticket', 'Password reset', 'Help Center'],
        entities: [],
        matchedTopic: null,
        botName: await getBotName().catch(() => 'IT Support Assistant')
      }
    });
  }
});

/**
 * GET /api/ai/topics
 * Returns list of available help topics
 */
router.get('/topics', authenticate, enforceLicensedFeature('ai_assistant'), (req, res) => {
  try {
    const topics = KNOWLEDGE_BASE.map(entry => ({
      id: entry.id,
      category: entry.category,
      sample: entry.patterns?.[0] || entry.id // first example question
    }));

    res.json({
      success: true,
      data: topics
    });
  } catch (error) {
    logger.error('AI Topics error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to load topics'
    });
  }
});

/**
 * POST /api/ai/feedback
 * Record 👍/👎 user feedback for a bot response.
 * Positive feedback is stored as high-confidence (0.85) training data so the
 * bot can reuse the confirmed answer in future conversations.
 */
router.post('/feedback', authenticate, enforceLicensedFeature('ai_assistant'), async (req, res) => {
  try {
    const { sessionId, userQuestion, botAnswer, feedback } = req.body;
    const userId = req.user?.user_id;

    if (!feedback || !['positive', 'negative'].includes(feedback)) {
      return res.status(400).json({ success: false, message: 'feedback must be "positive" or "negative"' });
    }
    if (!botAnswer || String(botAnswer).trim().length < 5) {
      return res.status(400).json({ success: false, message: 'botAnswer is required' });
    }

    // Stamp feedback on the most recent matching bot message in this session
    if (sessionId) {
      try {
        const safeAnswer = String(botAnswer).substring(0, 4000);
        await executeQuery(`
          UPDATE TOP(1) bot_chat_messages
          SET feedback = @feedback
          WHERE session_id = @sessionId
            AND message_type = 'bot'
            AND message_content = @botAnswer
        `, { feedback, sessionId, botAnswer: safeAnswer });
      } catch (dbErr) {
        logger.warn('Failed to stamp message feedback flag:', dbErr.message);
      }
    }

    // Positive feedback → store as verified training data for future RAG lookups
    if (feedback === 'positive' && userQuestion && String(userQuestion).trim().length >= 5) {
      try {
        const q = String(userQuestion).trim();
        const a = String(botAnswer).trim();
        const kws = q.toLowerCase()
          .replace(/[^a-z0-9\s]/g, '')
          .split(/\s+/)
          .filter(w => w.length > 2)
          .slice(0, 15);

        // De-duplicate: only insert if no identical question already stored from user feedback
        await executeQuery(`
          IF NOT EXISTS (
            SELECT 1 FROM bot_training_data
            WHERE created_by = 'user_feedback'
              AND question_pattern = @questionPattern
          )
          INSERT INTO bot_training_data
            (source_ticket_id, category, keywords, question_pattern, resolution_text,
             confidence_score, is_active, is_verified, created_by)
          VALUES
            (NULL, 'user-feedback', @keywords, @questionPattern, @resolutionText,
             0.85, 1, 0, 'user_feedback')
        `, {
          questionPattern: q.substring(0, 1000),
          keywords: JSON.stringify(kws),
          resolutionText: a.substring(0, 4000),
        });

        logger.info('Feedback-training data stored', { userId, questionLen: q.length });
      } catch (trainErr) {
        logger.warn('Failed to store feedback training data:', trainErr.message);
      }
    }

    // Record the feedback interaction in user intelligence (non-blocking)
    userIntelligence.recordInteraction(
      userId,
      userQuestion || '',
      'feedback',
      1.0,
      feedback === 'positive' ? 'feedback-positive' : 'feedback-negative'
    ).catch(err => logger.warn('User intelligence feedback record failed:', err.message));

    return res.status(200).json({ success: true, message: 'Feedback recorded' });
  } catch (error) {
    logger.error('AI Feedback error', { error: error.message });
    return res.status(500).json({ success: false, message: 'Failed to record feedback' });
  }
});

// =============================================================
// ENGINEER AI ASSIST ENDPOINTS
// These are INTERNAL tools for IT staff / engineers only.
// They don't use the chatbot NLP — they use rule-based logic
// and DB queries to provide contextual ticket suggestions.
// =============================================================

const engineerAiAssist = require('../services/engineerAiAssist.service');

/**
 * POST /api/ai/engineer/summarize
 * LLM summary when providers are configured; rich template fallback otherwise.
 * Body: { ticket_id }
 */
router.post('/engineer/summarize', authenticate, authorizeEngineerAiAssist, async (req, res) => {
  try {
    const { ticket_id } = req.body;
    if (!ticket_id) return res.status(400).json({ success: false, message: 'ticket_id is required' });

    const userId = req.user.user_id;
    const out = await engineerAiAssist.summarizeTicket(ticket_id, userId);
    if (!out.ok) {
      return res.status(out.status || 500).json({ success: false, message: out.message || 'Failed' });
    }
    return res.status(200).json({ success: true, data: out.data });
  } catch (error) {
    logger.error('AI engineer/summarize error', { error: error.message });
    return res.status(500).json({ success: false, message: 'Failed to generate summary' });
  }
});

/**
 * POST /api/ai/engineer/draft_reply
 * Multi-variant LLM drafts when configured; snippets + templates otherwise.
 * Body: { ticket_id, tone? }  — tone: 'professional' | 'friendly' | 'brief'
 */
router.post('/engineer/draft_reply', authenticate, authorizeEngineerAiAssist, async (req, res) => {
  try {
    const { ticket_id, tone = 'professional' } = req.body;
    if (!ticket_id) return res.status(400).json({ success: false, message: 'ticket_id is required' });

    const engineerName =
      req.user?.full_name ||
      [req.user?.first_name, req.user?.last_name].filter(Boolean).join(' ').trim() ||
      req.user?.username ||
      'IT Support';

    const out = await engineerAiAssist.draftTicketReplies(ticket_id, tone, engineerName, req.user.user_id);
    if (!out.ok) {
      return res.status(out.status || 500).json({ success: false, message: out.message || 'Failed' });
    }
    return res.status(200).json({ success: true, data: out.data });
  } catch (error) {
    logger.error('AI engineer/draft_reply error', { error: error.message });
    return res.status(500).json({ success: false, message: 'Failed to generate draft reply' });
  }
});

/**
 * POST /api/ai/engineer/next_best_action
 * Returns a prioritized list of recommended actions for the engineer.
 * Body: { ticket_id }
 */
router.post('/engineer/next_best_action', authenticate, authorizeEngineerAiAssist, async (req, res) => {
  try {
    const { ticket_id } = req.body;
    if (!ticket_id) return res.status(400).json({ success: false, message: 'ticket_id is required' });

    const ticketResult = await executeQuery(`
      SELECT
        t.ticket_id, t.ticket_number, t.subject,
        t.created_at, t.updated_at, t.due_date,
        t.assigned_to, t.requester_id,
        ts.status_code, ts.is_final_status,
        tp.priority_code,
        t.sla_paused,
        (SELECT COUNT(*) FROM ticket_comments tc WHERE tc.ticket_id = t.ticket_id AND tc.is_deleted = 0) AS comment_count,
        (SELECT MAX(tc2.commented_at) FROM ticket_comments tc2 WHERE tc2.ticket_id = t.ticket_id AND tc2.is_deleted = 0) AS last_comment_at
      FROM tickets t
      LEFT JOIN ticket_statuses ts   ON t.status_id   = ts.status_id
      LEFT JOIN ticket_priorities tp ON t.priority_id  = tp.priority_id
      WHERE t.ticket_id = @ticketId
    `, { ticketId: ticket_id });

    if (!ticketResult.recordset?.length) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }
    const t = ticketResult.recordset[0];

    const actions = [];
    const now = new Date();
    const statusCode  = (t.status_code  || '').toLowerCase();
    const priorityCode = (t.priority_code || '').toUpperCase();

    // --- RULE ENGINE ---

    // R1: Ticket is unassigned and still open
    if (!t.assigned_to && !t.is_final_status) {
      actions.push({
        action: 'assign_ticket',
        label: 'Assign this ticket',
        reason: 'Ticket has no assignee — it may go unnoticed.',
        priority: priorityCode === 'P1' || priorityCode === 'CRITICAL' ? 'critical' : 'high'
      });
    }

    // R2: SLA breach
    if (!t.is_final_status && !t.sla_paused && t.due_date) {
      const msLeft = new Date(t.due_date) - now;
      if (msLeft < 0) {
        actions.push({
          action: 'escalate',
          label: 'Escalate — SLA breached',
          reason: `SLA deadline was ${new Date(t.due_date).toLocaleString()}. Immediate escalation recommended.`,
          priority: 'critical'
        });
      } else if (msLeft < 3600000) {
        actions.push({
          action: 'escalate',
          label: 'Escalate — SLA due in < 1 hour',
          reason: `Only ${Math.round(msLeft / 60000)} minutes left before SLA breach.`,
          priority: 'high'
        });
      }
    }

    // R3: High priority + no comments
    if ((priorityCode === 'P1' || priorityCode === 'P2' || priorityCode === 'CRITICAL' || priorityCode === 'HIGH')
        && t.comment_count === 0 && !t.is_final_status) {
      actions.push({
        action: 'add_comment',
        label: 'Acknowledge the ticket',
        reason: `${priorityCode} priority ticket has no acknowledgement comment yet.`,
        priority: 'high'
      });
    }

    // R4: Open/in-progress with no activity in 24h
    if (!t.is_final_status && t.last_comment_at) {
      const hoursSinceComment = (now - new Date(t.last_comment_at)) / 3600000;
      if (hoursSinceComment > 24) {
        actions.push({
          action: 'add_update',
          label: 'Send a status update',
          reason: `No activity in ${Math.round(hoursSinceComment)} hours — requester may be waiting.`,
          priority: 'medium'
        });
      }
    }

    // R5: No comments at all and ticket is older than 2 hours
    if (!t.is_final_status && t.comment_count === 0) {
      const ageHours = (now - new Date(t.created_at)) / 3600000;
      if (ageHours > 2) {
        actions.push({
          action: 'investigate',
          label: 'Start investigation',
          reason: `Ticket is ${Math.round(ageHours)} hours old with no comments. Begin triage.`,
          priority: 'medium'
        });
      }
    }

    // R6: Status is 'open' (not in-progress) and assigned
    if (statusCode === 'open' && t.assigned_to) {
      actions.push({
        action: 'update_status',
        label: 'Mark as In Progress',
        reason: 'Ticket is assigned but status is still Open. Update status to reflect active work.',
        priority: 'low'
      });
    }

    // R7: Ticket looks resolved but not closed
    if ((statusCode.includes('resolv') || statusCode.includes('pending_close'))
        && !t.is_final_status) {
      actions.push({
        action: 'close_ticket',
        label: 'Close or confirm resolution',
        reason: 'Ticket appears resolved. Confirm with requester and close if confirmed.',
        priority: 'low'
      });
    }

    // If no actions were triggered, add a generic "looks good" entry
    if (actions.length === 0) {
      actions.push({
        action: 'monitor',
        label: 'No immediate action required',
        reason: 'Ticket is progressing normally. Continue monitoring.',
        priority: 'info'
      });
    }

    // Sort: critical > high > medium > low > info
    const ORDER = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    actions.sort((a, b) => (ORDER[a.priority] ?? 5) - (ORDER[b.priority] ?? 5));

    return res.status(200).json({
      success: true,
      data: { actions }
    });
  } catch (error) {
    logger.error('AI engineer/next_best_action error', { error: error.message });
    return res.status(500).json({ success: false, message: 'Failed to compute next best action' });
  }
});

module.exports = router;

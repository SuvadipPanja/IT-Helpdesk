/**
 * Enterprise-style AI Assist for engineers: ticket summaries & reply drafts.
 * Uses configured LLM (OpenAI / Claude / Ollama via bot providers) when available;
 * falls back to rich template + snippets when not.
 */

const { executeQuery } = require('../config/database');
const logger = require('../utils/logger');
const botApiIntegrationService = require('./botApiIntegrationService');

const STAFF_ROLES_FOR_AI = new Set(['ADMIN', 'MANAGER', 'CENTRAL_MGMT', 'ENGINEER', 'IT_STAFF', 'SUB_ADMIN']);

/** Roles that may use engineer AI endpoints (in addition to can_use_ai_features). */
function isStaffEngineerRole(roleCode) {
  return roleCode && STAFF_ROLES_FOR_AI.has(String(roleCode).toUpperCase());
}

function stripCodeFence(text) {
  let t = String(text || '').trim();
  if (t.startsWith('```')) {
    t = t.replace(/^```[a-z0-9]*\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  }
  return t.trim();
}

function safeJsonParse(text) {
  try {
    return JSON.parse(stripCodeFence(text));
  } catch {
    return null;
  }
}

/**
 * Load ticket + comments + activities for prompts.
 */
async function loadTicketContext(ticketId) {
  const ticketResult = await executeQuery(
    `
    SELECT
      t.ticket_id, t.ticket_number, t.subject, t.description,
      t.created_at, t.updated_at, t.due_date, t.resolved_at,
      t.approval_pending, t.sla_paused,
      ts.status_name, ts.status_code, ts.is_final_status,
      tp.priority_name, tp.priority_code,
      tc.category_name,
      ISNULL(req.first_name,'') + ' ' + ISNULL(req.last_name,'') AS requester_name,
      req.email AS requester_email,
      ISNULL(asg.first_name,'') + ' ' + ISNULL(asg.last_name,'') AS assigned_to_name,
      d.department_name
    FROM tickets t
    LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
    LEFT JOIN ticket_priorities tp ON t.priority_id = tp.priority_id
    LEFT JOIN ticket_categories tc ON t.category_id = tc.category_id
    LEFT JOIN users req ON t.requester_id = req.user_id
    LEFT JOIN users asg ON t.assigned_to = asg.user_id
    LEFT JOIN departments d ON t.department_id = d.department_id
    WHERE t.ticket_id = @ticketId
    `,
    { ticketId }
  );
  const ticket = ticketResult.recordset?.[0];
  if (!ticket) return { ticket: null };

  const commentsResult = await executeQuery(
    `
    SELECT TOP 25
      comment_text, is_internal, commented_at,
      ISNULL(u.first_name,'') + ' ' + ISNULL(u.last_name,'') AS author,
      r.role_name AS author_role
    FROM ticket_comments tc
    LEFT JOIN users u ON tc.commented_by = u.user_id
    LEFT JOIN user_roles r ON u.role_id = r.role_id
    WHERE tc.ticket_id = @ticketId AND tc.is_deleted = 0
    ORDER BY tc.commented_at DESC
    `,
    { ticketId }
  );
  const comments = (commentsResult.recordset || []).slice().reverse();

  const actResult = await executeQuery(
    `
    SELECT TOP 20
      activity_type, description, performed_at,
      ISNULL(u.first_name,'') + ' ' + ISNULL(u.last_name,'') AS performer
    FROM ticket_activities ta
    LEFT JOIN users u ON ta.performed_by = u.user_id
    WHERE ta.ticket_id = @ticketId
    ORDER BY ta.performed_at DESC
    `,
    { ticketId }
  );
  const activities = (actResult.recordset || []).slice().reverse();

  return { ticket, comments, activities };
}

function buildSlaLine(ticket, now = new Date()) {
  let slaStatus = 'On track';
  if (ticket.is_final_status) slaStatus = 'Resolved / closed';
  else if (ticket.sla_paused) slaStatus = 'Paused';
  else if (ticket.due_date) {
    const msLeft = new Date(ticket.due_date) - now;
    if (msLeft < 0) slaStatus = 'BREACHED';
    else if (msLeft < 3600000) slaStatus = 'Due within 1 hour';
    else if (msLeft < 86400000) slaStatus = 'Due within 24 hours';
  }
  return slaStatus;
}

/**
 * Template summary (no LLM) — structured markdown.
 */
function buildTemplateSummary(ctx) {
  const t = ctx.ticket;
  const now = new Date();
  const slaStatus = buildSlaLine(t, now);
  const lines = [
    `**Ticket ${t.ticket_number}** — ${t.subject}`,
    ``,
    `| Field | Value |`,
    `| --- | --- |`,
    `| Status | ${t.status_name || '—'} |`,
    `| Priority | ${t.priority_name || t.priority_code || '—'} |`,
    `| Category | ${t.category_name || 'Unclassified'} |`,
    `| Requester | ${t.requester_name?.trim() || '—'} (${t.requester_email || 'no email'}) |`,
    `| Assigned | ${t.assigned_to_name?.trim() || 'Unassigned'} |`,
    `| Department | ${t.department_name || '—'} |`,
    `| SLA | ${slaStatus}${t.due_date ? ` · Due ${new Date(t.due_date).toLocaleString()}` : ''} |`,
    `| Approval pending | ${t.approval_pending ? 'Yes' : 'No'} |`,
    ``,
    `### Description`,
    (t.description || '_(no description)_').substring(0, 4000),
  ];

  if (ctx.comments?.length) {
    lines.push(``, `### Comment thread (chronological, ${ctx.comments.length} shown)`);
    ctx.comments.forEach((c, i) => {
      const ts = new Date(c.commented_at).toLocaleString();
      const tag = c.is_internal ? ' **[internal]**' : '';
      lines.push(`- **${i + 1}.** ${c.author} (${c.author_role || 'User'})${tag} · ${ts}`);
      lines.push(`  ${String(c.comment_text || '').substring(0, 500)}${String(c.comment_text || '').length > 500 ? '…' : ''}`);
    });
  } else {
    lines.push(``, `_No comments yet._`);
  }

  if (ctx.activities?.length) {
    lines.push(``, `### Recent activity (latest ${ctx.activities.length})`);
    ctx.activities.slice(-12).forEach((a) => {
      const ts = new Date(a.performed_at).toLocaleString();
      lines.push(`- **${a.activity_type}** · ${a.performer} · ${ts}`);
      if (a.description) lines.push(`  _${String(a.description).substring(0, 280)}_`);
    });
  }

  return lines.join('\n');
}

function buildSummaryUserPrompt(ctx) {
  const t = ctx.ticket;
  const sla = buildSlaLine(t);
  const parts = [
    '## Raw ticket data (only use what is below; do not invent facts)',
    `Ticket: ${t.ticket_number} | Subject: ${t.subject}`,
    `Status: ${t.status_name} (${t.status_code}) | Priority: ${t.priority_name} | Category: ${t.category_name || 'n/a'}`,
    `Requester: ${t.requester_name} <${t.requester_email || ''}> | Assigned: ${t.assigned_to_name || 'Unassigned'} | Dept: ${t.department_name || 'n/a'}`,
    `SLA: ${sla} | Due: ${t.due_date ? new Date(t.due_date).toISOString() : 'n/a'} | Approval pending: ${t.approval_pending ? 'yes' : 'no'}`,
    '',
    '### Description',
    String(t.description || '').slice(0, 8000),
    '',
  ];
  if (ctx.comments?.length) {
    parts.push('### Comments (oldest first in this list)');
    ctx.comments.forEach((c, idx) => {
      parts.push(
        `${idx + 1}. [${c.is_internal ? 'INTERNAL' : 'PUBLIC'}] ${c.author} @ ${new Date(c.commented_at).toISOString()}: ${String(c.comment_text || '').slice(0, 1200)}`
      );
    });
  }
  if (ctx.activities?.length) {
    parts.push('', '### Activity log');
    ctx.activities.slice(-15).forEach((a) => {
      parts.push(`- ${a.activity_type} @ ${new Date(a.performed_at).toISOString()} by ${a.performer}: ${String(a.description || '').slice(0, 400)}`);
    });
  }
  parts.push(
    '',
    'Write the summary in clear Markdown with these sections:',
    '1) Executive overview (2–4 sentences)',
    '2) Current state & ownership',
    '3) Timeline / what happened (bullets)',
    '4) Open risks, blockers, or SLA notes',
    '5) Suggested next step for the engineer (one short paragraph)',
    'If something is unknown, say "Not stated in ticket."'
  );
  return parts.join('\n');
}

async function summarizeWithLlm(ctx, userId) {
  const userContent = buildSummaryUserPrompt(ctx);
  const messages = [
    {
      role: 'system',
      content:
        'You are a senior IT service desk lead. Produce accurate, professional summaries for engineers. Never fabricate ticket facts. Use Markdown headings and bullets.',
    },
    { role: 'user', content: userContent },
  ];
  const result = await botApiIntegrationService.callWithFallback(messages, null, userId, {
    max_tokens: 2800,
    temperature: 0.25,
  });
  if (result.success && result.content && String(result.content).trim().length > 40) {
    return {
      ok: true,
      text: String(result.content).trim(),
      provider_label: result.provider_label || null,
      model: result.model || null,
    };
  }
  logger.warn('Engineer AI summarize: LLM unavailable or empty', { error: result.error });
  return { ok: false };
}

async function summarizeTicket(ticketId, userId) {
  const ctx = await loadTicketContext(ticketId);
  if (!ctx.ticket) {
    return { ok: false, status: 404, message: 'Ticket not found' };
  }
  const template = buildTemplateSummary(ctx);
  const llm = await summarizeWithLlm(ctx, userId);
  if (llm.ok) {
    return {
      ok: true,
      data: {
        summary: llm.text,
        source: 'llm',
        provider_label: llm.provider_label,
        model: llm.model,
        fallback_available: true,
      },
    };
  }
  return {
    ok: true,
    data: {
      summary: template,
      source: 'template',
      provider_label: null,
      model: null,
      hint: 'Connect an AI provider under Bot / API settings for GPT-quality summaries.',
    },
  };
}

async function loadDraftContext(ticketId) {
  const ctx = await loadTicketContext(ticketId);
  if (!ctx.ticket) return null;
  const t = ctx.ticket;
  const snippetsResult = await executeQuery(
    `
    SELECT TOP 8 snippet_id, title, body, category
    FROM response_snippets
    WHERE is_shared = 1
      AND (
        LOWER(category) = LOWER(@categoryName)
        OR category = 'General'
      )
    ORDER BY
      CASE WHEN LOWER(category) = LOWER(@categoryName) THEN 0 ELSE 1 END,
      snippet_id DESC
    `,
    { categoryName: t.category_name || 'General' }
  );
  const snippets = snippetsResult.recordset || [];
  return { ...ctx, snippets };
}

function buildSnippetOnlyDraft(ctx, tone, engineerName) {
  const t = ctx.ticket;
  const requesterFirst = (t.requester_name || '').trim().split(/\s+/)[0] || 'there';
  const bestSnippet = ctx.snippets?.[0] || null;
  let draftBody = '';
  if (bestSnippet) {
    draftBody = bestSnippet.body;
  } else {
    const statusCode = (t.status_code || '').toLowerCase();
    if (statusCode.includes('progress') || statusCode.includes('pending')) {
      draftBody = `Thank you for reaching out. I wanted to update you that your ticket regarding "${t.subject}" is currently being investigated. We are working to resolve this as quickly as possible.\n\nI will keep you informed of any updates.`;
    } else if (statusCode.includes('resolv') || statusCode.includes('close')) {
      draftBody = `Thank you for your patience. I am pleased to let you know that your ticket regarding "${t.subject}" has been resolved.\n\nPlease let us know if the issue recurs or if there is anything else we can assist you with.`;
    } else {
      draftBody = `Thank you for submitting your request regarding "${t.subject}". We have received your ticket and will begin investigating shortly.\n\nYou will receive an update once we have more information.`;
    }
  }
  const ticketNumber = t.ticket_number || `#${t.ticket_id}`;
  draftBody = draftBody
    .replace(/\[Name\]/gi, requesterFirst)
    .replace(/\[TICKET[_\s]NUMBER\]/gi, ticketNumber)
    .replace(/\[TICKET_NO\]/gi, ticketNumber);
  draftBody = draftBody.replace(/^(Hi|Hello|Dear)\s+[^\n]+\n+/i, '');
  draftBody = draftBody.replace(/\n+(Best regards?|Kind regards?|Regards|Sincerely|Best wishes|Warm regards)[,\s]*\n[\s\S]*$/i, '').trim();

  let opener = `Hi ${requesterFirst},`;
  if (tone === 'friendly') opener = `Hi ${requesterFirst}, hope you're doing well.`;
  if (tone === 'brief') opener = `Hi ${requesterFirst},`;

  const closing = tone === 'brief' ? `Thanks,\n${engineerName}` : `Regards,\n${engineerName}`;
  const draft = `${opener}\n\n${draftBody}\n\n${closing}`;
  return {
    primary: draft,
    alternatives: [],
    snippets_used: bestSnippet
      ? [{ snippet_id: bestSnippet.snippet_id, title: bestSnippet.title, category: bestSnippet.category }]
      : [],
    source: 'template',
  };
}

function buildDraftPrompt(ctx, tone, engineerName) {
  const t = ctx.ticket;
  const requester = t.requester_name || 'Requester';
  const snippetHint =
    ctx.snippets?.length > 0
      ? `Optional snippet titles to inspire tone (do not copy verbatim if it conflicts with facts): ${ctx.snippets.map((s) => s.title).join('; ')}`
      : 'No snippets; use professional IT support language.';

  const thread = (ctx.comments || [])
    .map(
      (c, i) =>
        `${i + 1}. [${c.is_internal ? 'internal' : 'public'}] ${c.author}: ${String(c.comment_text || '').slice(0, 900)}`
    )
    .join('\n');

  return [
    `Ticket ${t.ticket_number}: ${t.subject}`,
    `Status: ${t.status_name} | Priority: ${t.priority_name} | Requester first name (for greeting): ${(requester || '').split(/\s+/)[0] || 'there'}`,
    `Tone requested: ${tone} (professional = neutral; friendly = warm; brief = short sentences).`,
    `Engineer signing as: ${engineerName}`,
    snippetHint,
    '',
    '### Description',
    String(t.description || '').slice(0, 4000),
    '',
    '### Thread',
    thread || '(no comments)',
  ].join('\n');
}

async function draftRepliesWithLlm(ctx, tone, engineerName, userId) {
  const userContent = buildDraftPrompt(ctx, tone, engineerName);
  const messages = [
    {
      role: 'system',
      content:
        'You help IT engineers write replies to end users. Output valid JSON only, no markdown fences, with this shape: {"primary":"<full email body>","alternatives":["<variant2>","<variant3>","<variant4>"]}. primary = best external reply. alternatives = three meaningfully different options (e.g. status update, asking a clarifying question, closure confirmation). Use the requester\'s first name in greeting. Sign off with the engineer name provided. Do not invent ticket numbers or promises not supported by the thread.',
    },
    { role: 'user', content: userContent },
  ];
  const result = await botApiIntegrationService.callWithFallback(messages, null, userId, {
    max_tokens: 3200,
    temperature: tone === 'friendly' ? 0.75 : 0.55,
  });
  if (!result.success || !result.content) return { ok: false };
  const parsed = safeJsonParse(result.content);
  if (!parsed || typeof parsed.primary !== 'string') return { ok: false };
  const alternatives = Array.isArray(parsed.alternatives) ? parsed.alternatives.filter((x) => typeof x === 'string').slice(0, 4) : [];
  return {
    ok: true,
    primary: parsed.primary.trim(),
    alternatives,
    provider_label: result.provider_label,
    model: result.model,
  };
}

async function draftTicketReplies(ticketId, tone, engineerName, userId) {
  const ctx = await loadDraftContext(ticketId);
  if (!ctx) {
    return { ok: false, status: 404, message: 'Ticket not found' };
  }
  const llm = await draftRepliesWithLlm(ctx, tone, engineerName, userId);
  if (llm.ok) {
    return {
      ok: true,
      data: {
        draft: llm.primary,
        alternatives: llm.alternatives,
        tone,
        snippets_used: [],
        source: 'llm',
        provider_label: llm.provider_label,
        model: llm.model,
      },
    };
  }
  const fb = buildSnippetOnlyDraft(ctx, tone, engineerName);
  return {
    ok: true,
    data: {
      draft: fb.primary,
      alternatives: fb.alternatives,
      tone,
      snippets_used: fb.snippets_used,
      source: 'template',
      provider_label: null,
      model: null,
      hint: 'Configure Bot AI providers for multiple smart reply variants.',
    },
  };
}

module.exports = {
  isStaffEngineerRole,
  loadTicketContext,
  summarizeTicket,
  draftTicketReplies,
  buildTemplateSummary,
};

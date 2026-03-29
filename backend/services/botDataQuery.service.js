// ============================================
// BOT DATA QUERY SERVICE
// Natural language → parameterized SQL for the
// AI chatbot. Role-based access control enforced.
// ============================================

const { executeQuery } = require('../config/database');
const logger = require('../utils/logger');

// ── Temporal helpers ───────────────────────────
function todayRange() {
  return { start: "CAST(GETDATE() AS DATE)", end: "DATEADD(DAY, 1, CAST(GETDATE() AS DATE))" };
}
function yesterdayRange() {
  return { start: "DATEADD(DAY, -1, CAST(GETDATE() AS DATE))", end: "CAST(GETDATE() AS DATE)" };
}
function thisWeekRange() {
  return { start: "DATEADD(DAY, 1 - DATEPART(WEEKDAY, GETDATE()), CAST(GETDATE() AS DATE))", end: "DATEADD(DAY, 1, CAST(GETDATE() AS DATE))" };
}
function lastWeekRange() {
  return { start: "DATEADD(DAY, 1 - DATEPART(WEEKDAY, GETDATE()) - 7, CAST(GETDATE() AS DATE))", end: "DATEADD(DAY, 1 - DATEPART(WEEKDAY, GETDATE()), CAST(GETDATE() AS DATE))" };
}
function thisMonthRange() {
  return { start: "DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1)", end: "DATEADD(DAY, 1, CAST(GETDATE() AS DATE))" };
}
function lastMonthRange() {
  return { start: "DATEFROMPARTS(YEAR(DATEADD(MONTH, -1, GETDATE())), MONTH(DATEADD(MONTH, -1, GETDATE())), 1)", end: "DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1)" };
}

// ── Extract time period from message ───────────
function extractTimePeriod(message) {
  const lower = message.toLowerCase();
  if (/\byesterday\b/.test(lower))   return { label: 'yesterday',   ...yesterdayRange() };
  if (/\btoday\b/.test(lower))       return { label: 'today',       ...todayRange() };
  if (/\blast\s+week\b/.test(lower)) return { label: 'last week',   ...lastWeekRange() };
  if (/\bthis\s+week\b/.test(lower)) return { label: 'this week',   ...thisWeekRange() };
  if (/\blast\s+month\b/.test(lower))return { label: 'last month',  ...lastMonthRange() };
  if (/\bthis\s+month\b/.test(lower))return { label: 'this month',  ...thisMonthRange() };
  return null; // no time filter
}

// ── Extract department name from message ───────
function extractDepartment(message) {
  // Patterns: "for IT department", "in HR", "of Finance department", "from Sales dept"
  const m = message.match(/(?:for|in|of|from|by)\s+(?:the\s+)?([A-Za-z][A-Za-z\s&-]{1,40}?)(?:\s+(?:department|dept))?(?:\s*\?|$|,|\.|!)/i);
  if (m) {
    const name = m[1].trim().replace(/\s+department$/i, '').replace(/\s+dept$/i, '').trim();
    // Filter out common non-department words that might false-match
    const blocked = new Set(['each', 'every', 'all', 'any', 'the', 'this', 'that', 'today', 'yesterday',
      'week', 'month', 'year', 'status', 'priority', 'category', 'agent', 'engineer', 'user',
      'ticket', 'tickets', 'open', 'closed', 'pending', 'resolved', 'me', 'my', 'team']);
    if (blocked.has(name.toLowerCase())) return null;
    return name;
  }
  return null;
}

// ── Extract status filter from message ─────────
function extractStatus(message) {
  const lower = message.toLowerCase();
  if (/\bopen\b/.test(lower))                return 'open';
  if (/\bclosed?\b/.test(lower))             return 'closed';
  if (/\bpending\b/.test(lower))             return 'pending';
  if (/\bresolved?\b/.test(lower))           return 'resolved';
  if (/\bin[\s-]?progress\b/.test(lower))    return 'in_progress';
  if (/\bescalated?\b/.test(lower))          return 'escalated';
  if (/\boverdue\b/.test(lower))             return 'overdue';
  if (/\bunresolved|outstanding|active|backlog/.test(lower)) return 'open';
  return null;
}

// ── Extract priority filter from message ───────
function extractPriority(message) {
  const lower = message.toLowerCase();
  if (/\bcritical\b/.test(lower)) return 'CRITICAL';
  if (/\bhigh\b/.test(lower))     return 'HIGH';
  if (/\bmedium\b/.test(lower))   return 'MEDIUM';
  if (/\blow\b/.test(lower))      return 'LOW';
  if (/\burgent\b/.test(lower))   return 'CRITICAL';
  return null;
}

// ── Extract user/agent name from message ───────
function extractAgentName(message) {
  const m = message.match(/(?:assigned\s+to|for|of|handled\s+by|by)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
  if (m) return m[1].trim();
  return null;
}

// ── Detect query type ──────────────────────────
function classifyQuery(message) {
  const lower = message.toLowerCase();

  // Department breakdown
  if (/(?:per|by|for\s+each|breakdown|wise)\s+department/i.test(lower) ||
      /department\s+(?:wise|breakdown|summary)/i.test(lower) ||
      /which\s+department\s+has/i.test(lower)) {
    return 'department_breakdown';
  }
  // Specific department
  if (extractDepartment(message)) {
    return 'department_specific';
  }
  // Priority breakdown
  if (/(?:per|by|for\s+each)\s+priority/i.test(lower) ||
      /priority\s+(?:breakdown|summary|distribution|wise)/i.test(lower)) {
    return 'priority_breakdown';
  }
  // Category breakdown
  if (/(?:per|by|for\s+each)\s+category/i.test(lower) ||
      /category\s+(?:breakdown|summary|distribution|wise)/i.test(lower) ||
      /which\s+category\s+has/i.test(lower)) {
    return 'category_breakdown';
  }
  // Agent/engineer stats
  if (/(?:agent|engineer)\s+(?:performance|stats?|workload|tickets?)/i.test(lower) ||
      /(?:who|which\s+(?:agent|engineer))\s+has\s+(?:the\s+)?(?:most|least)/i.test(lower) ||
      /(?:top|busiest)\s+(?:agents?|engineers?)/i.test(lower) ||
      /(?:workload|load)\s+(?:of|for|per)/i.test(lower)) {
    return 'agent_stats';
  }
  // Specific agent
  if (extractAgentName(message)) {
    return 'agent_specific';
  }
  // Resolution time
  if (/(?:average|avg|mean)\s+(?:resolution|response|close)/i.test(lower) ||
      /(?:resolution|response)\s+(?:time|rate|speed)/i.test(lower)) {
    return 'resolution_time';
  }
  // SLA
  if (/sla|service\s+level/i.test(lower)) {
    return 'sla_stats';
  }
  // Status breakdown (must come after specific status checks)
  if (/(?:status|state)\s+(?:breakdown|summary|distribution|of\s+(?:all\s+)?tickets)/i.test(lower) ||
      /ticket\s+status\s+(?:breakdown|summary|distribution|report|overview)/i.test(lower)) {
    return 'status_breakdown';
  }
  // General summary / overview
  if (/(?:summary|overview|report|stats|statistics|dashboard|analysis)\s+(?:of\s+)?(?:all\s+)?tickets?/i.test(lower) ||
      /ticket\s+(?:summary|overview|report|stats|statistics|dashboard|analysis)/i.test(lower) ||
      /(?:daily|weekly|monthly)\s+(?:ticket\s+)?(?:report|summary|stats)/i.test(lower)) {
    return 'general_summary';
  }
  // Default: count with optional filters
  return 'ticket_count';
}

// ============================================
// QUERY EXECUTORS
// All use parameterized queries for safety
// ============================================

async function executeTicketCount(message, user) {
  const timePeriod = extractTimePeriod(message);
  const status = extractStatus(message);
  const priority = extractPriority(message);

  const conditions = ['1=1'];
  const params = {};
  let dateFilter = '';

  if (timePeriod) {
    dateFilter = `AND t.created_at >= ${timePeriod.start} AND t.created_at < ${timePeriod.end}`;
  }
  if (status === 'overdue') {
    conditions.push('t.due_date < GETDATE() AND ts.is_final_status = 0');
  } else if (status === 'escalated') {
    conditions.push('t.is_escalated = 1');
  } else if (status === 'open') {
    conditions.push('ts.is_final_status = 0');
  } else if (status === 'closed') {
    conditions.push('ts.is_final_status = 1');
  } else if (status === 'pending') {
    conditions.push("UPPER(ts.status_code) = 'PENDING_INFO'");
  } else if (status === 'resolved') {
    conditions.push("UPPER(ts.status_code) = 'RESOLVED'");
  } else if (status === 'in_progress') {
    conditions.push("UPPER(ts.status_code) = 'IN_PROGRESS'");
  }
  if (priority) {
    conditions.push('UPPER(tp.priority_code) = @priority');
    params.priority = priority;
  }

  // Scope to user's own tickets if no can_view_all_tickets
  if (!user?.permissions?.can_view_all_tickets) {
    conditions.push('(t.requester_id = @userId OR t.assigned_to = @userId)');
    params.userId = user.user_id;
  }

  const sql = `
    SELECT COUNT(*) AS total,
      SUM(CASE WHEN ts.is_final_status = 0 THEN 1 ELSE 0 END) AS open_count,
      SUM(CASE WHEN ts.is_final_status = 1 THEN 1 ELSE 0 END) AS closed_count,
      SUM(CASE WHEN UPPER(tp.priority_code) IN ('CRITICAL','HIGH') AND ts.is_final_status = 0 THEN 1 ELSE 0 END) AS urgent_count
    FROM tickets t
    LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
    LEFT JOIN ticket_priorities tp ON t.priority_id = tp.priority_id
    WHERE ${conditions.join(' AND ')} ${dateFilter}
  `;

  const result = await executeQuery(sql, params);
  const row = result.recordset?.[0] || {};
  const total = Number(row.total || 0);
  const open = Number(row.open_count || 0);
  const closed = Number(row.closed_count || 0);
  const urgent = Number(row.urgent_count || 0);

  const periodLabel = timePeriod ? ` ${timePeriod.label}` : '';
  const statusLabel = status ? ` ${status}` : '';
  const priorityLabel = priority ? ` ${priority.toLowerCase()} priority` : '';
  const scopeLabel = user?.permissions?.can_view_all_tickets ? '' : ' (your tickets)';

  let answer = `📊 **Ticket Count${periodLabel}${statusLabel}${priorityLabel}**${scopeLabel}\n\n`;
  answer += `🎫 **Total**: ${total}\n`;
  if (!status) {
    answer += `📂 **Open**: ${open}\n`;
    answer += `✅ **Closed**: ${closed}\n`;
    if (urgent > 0) answer += `🚨 **Urgent (High/Critical)**: ${urgent}\n`;
  }

  return { answer, total, open, closed };
}

async function executeDepartmentBreakdown(message, user) {
  const timePeriod = extractTimePeriod(message);
  let dateFilter = '';
  if (timePeriod) {
    dateFilter = `AND t.created_at >= ${timePeriod.start} AND t.created_at < ${timePeriod.end}`;
  }

  const sql = `
    SELECT d.department_name,
      COUNT(*) AS total,
      SUM(CASE WHEN ts.is_final_status = 0 THEN 1 ELSE 0 END) AS open_count,
      SUM(CASE WHEN ts.is_final_status = 1 THEN 1 ELSE 0 END) AS closed_count
    FROM tickets t
    LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
    LEFT JOIN departments d ON t.department_id = d.department_id
    WHERE 1=1 ${dateFilter}
    GROUP BY d.department_name
    ORDER BY COUNT(*) DESC
  `;

  const result = await executeQuery(sql);
  const rows = result.recordset || [];
  const periodLabel = timePeriod ? ` (${timePeriod.label})` : '';

  if (rows.length === 0) {
    return { answer: `No ticket data found for department breakdown${periodLabel}.` };
  }

  let answer = `📊 **Tickets by Department${periodLabel}**\n\n`;
  answer += `| Department | Total | Open | Closed |\n`;
  answer += `|---|---|---|---|\n`;
  for (const r of rows) {
    const dept = r.department_name || 'Unassigned';
    answer += `| ${dept} | ${r.total} | ${r.open_count} | ${r.closed_count} |\n`;
  }
  const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);
  answer += `\n**Grand Total**: ${grandTotal} tickets across ${rows.length} departments`;

  return { answer };
}

async function executeDepartmentSpecific(message, user) {
  const deptName = extractDepartment(message);
  if (!deptName) return { answer: 'I could not determine which department you mean. Please specify, e.g. "tickets for IT department".' };

  const timePeriod = extractTimePeriod(message);
  let dateFilter = '';
  if (timePeriod) {
    dateFilter = `AND t.created_at >= ${timePeriod.start} AND t.created_at < ${timePeriod.end}`;
  }

  const sql = `
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN ts.is_final_status = 0 THEN 1 ELSE 0 END) AS open_count,
      SUM(CASE WHEN ts.is_final_status = 1 THEN 1 ELSE 0 END) AS closed_count,
      SUM(CASE WHEN UPPER(tp.priority_code) IN ('CRITICAL','HIGH') AND ts.is_final_status = 0 THEN 1 ELSE 0 END) AS urgent_count,
      d.department_name
    FROM tickets t
    LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
    LEFT JOIN ticket_priorities tp ON t.priority_id = tp.priority_id
    LEFT JOIN departments d ON t.department_id = d.department_id
    WHERE d.department_name LIKE @deptPattern ${dateFilter}
    GROUP BY d.department_name
  `;

  const result = await executeQuery(sql, { deptPattern: `%${deptName}%` });
  const row = result.recordset?.[0];
  const periodLabel = timePeriod ? ` ${timePeriod.label}` : '';

  if (!row) {
    return { answer: `I couldn't find any tickets for a department matching "**${deptName}**". Please check the department name and try again.` };
  }

  let answer = `📊 **${row.department_name} Department — Tickets${periodLabel}**\n\n`;
  answer += `🎫 **Total**: ${row.total}\n`;
  answer += `📂 **Open**: ${row.open_count}\n`;
  answer += `✅ **Closed**: ${row.closed_count}\n`;
  if (Number(row.urgent_count) > 0) answer += `🚨 **Urgent (High/Critical)**: ${row.urgent_count}\n`;

  return { answer };
}

async function executeStatusBreakdown(message, user) {
  const timePeriod = extractTimePeriod(message);
  let dateFilter = '';
  if (timePeriod) {
    dateFilter = `AND t.created_at >= ${timePeriod.start} AND t.created_at < ${timePeriod.end}`;
  }

  const sql = `
    SELECT ts.status_name, ts.status_code, ts.is_final_status, COUNT(*) AS total
    FROM tickets t
    LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
    WHERE 1=1 ${dateFilter}
    GROUP BY ts.status_name, ts.status_code, ts.is_final_status
    ORDER BY COUNT(*) DESC
  `;

  const result = await executeQuery(sql);
  const rows = result.recordset || [];
  const periodLabel = timePeriod ? ` (${timePeriod.label})` : '';

  if (rows.length === 0) {
    return { answer: `No ticket data found for status breakdown${periodLabel}.` };
  }

  let answer = `📊 **Ticket Status Breakdown${periodLabel}**\n\n`;
  const grandTotal = rows.reduce((sum, r) => sum + r.total, 0);
  for (const r of rows) {
    const icon = r.is_final_status ? '✅' : '📂';
    const pct = grandTotal > 0 ? ((r.total / grandTotal) * 100).toFixed(1) : '0';
    answer += `${icon} **${r.status_name}**: ${r.total} (${pct}%)\n`;
  }
  answer += `\n**Total**: ${grandTotal} tickets`;

  return { answer };
}

async function executePriorityBreakdown(message, user) {
  const timePeriod = extractTimePeriod(message);
  let dateFilter = '';
  if (timePeriod) {
    dateFilter = `AND t.created_at >= ${timePeriod.start} AND t.created_at < ${timePeriod.end}`;
  }

  const sql = `
    SELECT tp.priority_name, tp.priority_code, COUNT(*) AS total,
      SUM(CASE WHEN ts.is_final_status = 0 THEN 1 ELSE 0 END) AS open_count
    FROM tickets t
    LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
    LEFT JOIN ticket_priorities tp ON t.priority_id = tp.priority_id
    WHERE 1=1 ${dateFilter}
    GROUP BY tp.priority_name, tp.priority_code, tp.priority_level
    ORDER BY tp.priority_level ASC
  `;

  const result = await executeQuery(sql);
  const rows = result.recordset || [];
  const periodLabel = timePeriod ? ` (${timePeriod.label})` : '';

  if (rows.length === 0) {
    return { answer: `No ticket data found for priority breakdown${periodLabel}.` };
  }

  const icons = { CRITICAL: '🔴', HIGH: '🟠', MEDIUM: '🟡', LOW: '🟢' };
  let answer = `📊 **Tickets by Priority${periodLabel}**\n\n`;
  for (const r of rows) {
    const icon = icons[r.priority_code] || '⚪';
    answer += `${icon} **${r.priority_name}**: ${r.total} total (${r.open_count} open)\n`;
  }

  return { answer };
}

async function executeCategoryBreakdown(message, user) {
  const timePeriod = extractTimePeriod(message);
  let dateFilter = '';
  if (timePeriod) {
    dateFilter = `AND t.created_at >= ${timePeriod.start} AND t.created_at < ${timePeriod.end}`;
  }

  const sql = `
    SELECT tc.category_name, COUNT(*) AS total,
      SUM(CASE WHEN ts.is_final_status = 0 THEN 1 ELSE 0 END) AS open_count
    FROM tickets t
    LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
    LEFT JOIN ticket_categories tc ON t.category_id = tc.category_id
    WHERE 1=1 ${dateFilter}
    GROUP BY tc.category_name
    ORDER BY COUNT(*) DESC
  `;

  const result = await executeQuery(sql);
  const rows = result.recordset || [];
  const periodLabel = timePeriod ? ` (${timePeriod.label})` : '';

  if (rows.length === 0) {
    return { answer: `No ticket data found for category breakdown${periodLabel}.` };
  }

  let answer = `📊 **Tickets by Category${periodLabel}**\n\n`;
  for (const r of rows) {
    answer += `🏷️ **${r.category_name || 'Uncategorized'}**: ${r.total} total (${r.open_count} open)\n`;
  }

  return { answer };
}

async function executeAgentStats(message, user) {
  const timePeriod = extractTimePeriod(message);
  let dateFilter = '';
  if (timePeriod) {
    dateFilter = `AND t.created_at >= ${timePeriod.start} AND t.created_at < ${timePeriod.end}`;
  }

  const sql = `
    SELECT TOP 15
      u.first_name + ' ' + u.last_name AS agent_name,
      COUNT(*) AS total,
      SUM(CASE WHEN ts.is_final_status = 0 THEN 1 ELSE 0 END) AS open_count,
      SUM(CASE WHEN ts.is_final_status = 1 THEN 1 ELSE 0 END) AS closed_count
    FROM tickets t
    LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
    LEFT JOIN users u ON t.assigned_to = u.user_id
    WHERE t.assigned_to IS NOT NULL ${dateFilter}
    GROUP BY u.first_name, u.last_name
    ORDER BY COUNT(*) DESC
  `;

  const result = await executeQuery(sql);
  const rows = result.recordset || [];
  const periodLabel = timePeriod ? ` (${timePeriod.label})` : '';

  if (rows.length === 0) {
    return { answer: `No assigned ticket data found${periodLabel}.` };
  }

  let answer = `📊 **Agent Workload${periodLabel}**\n\n`;
  answer += `| Agent | Total | Open | Closed |\n`;
  answer += `|---|---|---|---|\n`;
  for (const r of rows) {
    answer += `| ${r.agent_name?.trim() || 'Unknown'} | ${r.total} | ${r.open_count} | ${r.closed_count} |\n`;
  }

  return { answer };
}

async function executeAgentSpecific(message, user) {
  const agentName = extractAgentName(message);
  if (!agentName) return { answer: 'I could not determine which agent you mean. Please specify, e.g. "tickets assigned to John".' };

  const timePeriod = extractTimePeriod(message);
  let dateFilter = '';
  if (timePeriod) {
    dateFilter = `AND t.created_at >= ${timePeriod.start} AND t.created_at < ${timePeriod.end}`;
  }

  const sql = `
    SELECT
      u.first_name + ' ' + u.last_name AS agent_name,
      COUNT(*) AS total,
      SUM(CASE WHEN ts.is_final_status = 0 THEN 1 ELSE 0 END) AS open_count,
      SUM(CASE WHEN ts.is_final_status = 1 THEN 1 ELSE 0 END) AS closed_count,
      SUM(CASE WHEN UPPER(tp.priority_code) IN ('CRITICAL','HIGH') AND ts.is_final_status = 0 THEN 1 ELSE 0 END) AS urgent_count
    FROM tickets t
    LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
    LEFT JOIN ticket_priorities tp ON t.priority_id = tp.priority_id
    LEFT JOIN users u ON t.assigned_to = u.user_id
    WHERE (u.first_name + ' ' + u.last_name LIKE @namePattern
           OR u.first_name LIKE @namePattern) ${dateFilter}
    GROUP BY u.first_name, u.last_name
  `;

  const result = await executeQuery(sql, { namePattern: `%${agentName}%` });
  const row = result.recordset?.[0];
  const periodLabel = timePeriod ? ` ${timePeriod.label}` : '';

  if (!row) {
    return { answer: `I couldn't find any tickets assigned to someone matching "**${agentName}**".` };
  }

  let answer = `📊 **Tickets for ${row.agent_name?.trim()}${periodLabel}**\n\n`;
  answer += `🎫 **Total**: ${row.total}\n`;
  answer += `📂 **Open**: ${row.open_count}\n`;
  answer += `✅ **Closed**: ${row.closed_count}\n`;
  if (Number(row.urgent_count) > 0) answer += `🚨 **Urgent**: ${row.urgent_count}\n`;

  return { answer };
}

async function executeResolutionTime(message, user) {
  const timePeriod = extractTimePeriod(message);
  let dateFilter = '';
  if (timePeriod) {
    dateFilter = `AND t.closed_at >= ${timePeriod.start} AND t.closed_at < ${timePeriod.end}`;
  }

  const sql = `
    SELECT
      COUNT(*) AS resolved_count,
      AVG(DATEDIFF(MINUTE, t.created_at, COALESCE(t.resolved_at, t.closed_at))) AS avg_resolution_mins,
      MIN(DATEDIFF(MINUTE, t.created_at, COALESCE(t.resolved_at, t.closed_at))) AS min_resolution_mins,
      MAX(DATEDIFF(MINUTE, t.created_at, COALESCE(t.resolved_at, t.closed_at))) AS max_resolution_mins,
      AVG(DATEDIFF(MINUTE, t.created_at, t.first_response_at)) AS avg_first_response_mins
    FROM tickets t
    LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
    WHERE ts.is_final_status = 1
      AND COALESCE(t.resolved_at, t.closed_at) IS NOT NULL
      ${dateFilter}
  `;

  const result = await executeQuery(sql);
  const row = result.recordset?.[0] || {};
  const periodLabel = timePeriod ? ` (${timePeriod.label})` : '';

  const resolved = Number(row.resolved_count || 0);
  if (resolved === 0) {
    return { answer: `No resolved tickets found${periodLabel} to calculate resolution time.` };
  }

  function formatMins(mins) {
    if (!mins || mins < 0) return 'N/A';
    if (mins < 60) return `${mins} min`;
    if (mins < 1440) return `${(mins / 60).toFixed(1)} hrs`;
    return `${(mins / 1440).toFixed(1)} days`;
  }

  let answer = `📊 **Resolution Time Analysis${periodLabel}**\n\n`;
  answer += `📈 **Tickets Resolved**: ${resolved}\n`;
  answer += `⏱️ **Avg Resolution**: ${formatMins(row.avg_resolution_mins)}\n`;
  answer += `⚡ **Fastest**: ${formatMins(row.min_resolution_mins)}\n`;
  answer += `🐌 **Slowest**: ${formatMins(row.max_resolution_mins)}\n`;
  if (row.avg_first_response_mins) {
    answer += `💬 **Avg First Response**: ${formatMins(row.avg_first_response_mins)}\n`;
  }

  return { answer };
}

async function executeSlaStats(message, user) {
  const timePeriod = extractTimePeriod(message);
  let dateFilter = '';
  if (timePeriod) {
    dateFilter = `AND t.created_at >= ${timePeriod.start} AND t.created_at < ${timePeriod.end}`;
  }

  const sql = `
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN t.first_response_sla_met = 1 THEN 1 ELSE 0 END) AS response_sla_met,
      SUM(CASE WHEN t.first_response_sla_met = 0 THEN 1 ELSE 0 END) AS response_sla_breached,
      SUM(CASE WHEN t.resolution_sla_met = 1 THEN 1 ELSE 0 END) AS resolution_sla_met,
      SUM(CASE WHEN t.resolution_sla_met = 0 THEN 1 ELSE 0 END) AS resolution_sla_breached,
      SUM(CASE WHEN t.due_date < GETDATE() AND ts.is_final_status = 0 THEN 1 ELSE 0 END) AS currently_overdue
    FROM tickets t
    LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
    WHERE 1=1 ${dateFilter}
  `;

  const result = await executeQuery(sql);
  const row = result.recordset?.[0] || {};
  const total = Number(row.total || 0);
  const periodLabel = timePeriod ? ` (${timePeriod.label})` : '';

  if (total === 0) {
    return { answer: `No ticket data found for SLA analysis${periodLabel}.` };
  }

  const respMet = Number(row.response_sla_met || 0);
  const resMet = Number(row.resolution_sla_met || 0);
  const overdue = Number(row.currently_overdue || 0);
  const respPct = total > 0 ? ((respMet / total) * 100).toFixed(1) : '0';
  const resPct = total > 0 ? ((resMet / total) * 100).toFixed(1) : '0';

  let answer = `📊 **SLA Performance${periodLabel}**\n\n`;
  answer += `🎫 **Total Tickets**: ${total}\n`;
  answer += `💬 **First Response SLA Met**: ${respMet} (${respPct}%)\n`;
  answer += `✅ **Resolution SLA Met**: ${resMet} (${resPct}%)\n`;
  if (overdue > 0) answer += `⚠️ **Currently Overdue**: ${overdue}\n`;

  return { answer };
}

async function executeGeneralSummary(message, user) {
  const timePeriod = extractTimePeriod(message);
  let dateFilter = '';
  if (timePeriod) {
    dateFilter = `AND t.created_at >= ${timePeriod.start} AND t.created_at < ${timePeriod.end}`;
  }

  const sql = `
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN ts.is_final_status = 0 THEN 1 ELSE 0 END) AS open_count,
      SUM(CASE WHEN ts.is_final_status = 1 THEN 1 ELSE 0 END) AS closed_count,
      SUM(CASE WHEN UPPER(ts.status_code) = 'PENDING_INFO' THEN 1 ELSE 0 END) AS pending_count,
      SUM(CASE WHEN UPPER(tp.priority_code) IN ('CRITICAL','HIGH') AND ts.is_final_status = 0 THEN 1 ELSE 0 END) AS urgent_count,
      SUM(CASE WHEN t.is_escalated = 1 AND ts.is_final_status = 0 THEN 1 ELSE 0 END) AS escalated_count,
      SUM(CASE WHEN t.due_date < GETDATE() AND ts.is_final_status = 0 THEN 1 ELSE 0 END) AS overdue_count
    FROM tickets t
    LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
    LEFT JOIN ticket_priorities tp ON t.priority_id = tp.priority_id
    WHERE 1=1 ${dateFilter}
  `;

  const result = await executeQuery(sql);
  const row = result.recordset?.[0] || {};
  const periodLabel = timePeriod ? ` (${timePeriod.label})` : '';

  const total = Number(row.total || 0);
  const open = Number(row.open_count || 0);
  const closed = Number(row.closed_count || 0);
  const pending = Number(row.pending_count || 0);
  const urgent = Number(row.urgent_count || 0);
  const escalated = Number(row.escalated_count || 0);
  const overdue = Number(row.overdue_count || 0);

  let answer = `📊 **Ticket Summary${periodLabel}**\n\n`;
  answer += `🎫 **Total**: ${total}\n`;
  answer += `📂 **Open**: ${open}\n`;
  answer += `✅ **Closed**: ${closed}\n`;
  answer += `⏳ **Pending Info**: ${pending}\n`;
  if (urgent > 0) answer += `🚨 **Urgent (High/Critical)**: ${urgent}\n`;
  if (escalated > 0) answer += `📢 **Escalated**: ${escalated}\n`;
  if (overdue > 0) answer += `⚠️ **Overdue**: ${overdue}\n`;
  if (total > 0 && closed > 0) {
    answer += `\n📈 **Resolution Rate**: ${((closed / total) * 100).toFixed(1)}%`;
  }

  return { answer };
}

// ============================================
// MAIN ENTRY POINT
// ============================================

/**
 * Process a natural-language data query from the chatbot.
 * Returns { answer, queryType, success } or null if the message
 * is not a data query.
 *
 * @param {string} message - User's message
 * @param {object} user - Authenticated user (from req.user)
 */
async function processDataQuery(message, user) {
  // Access control — global ticket data requires elevated permissions
  const canViewAll = user?.permissions?.can_view_all_tickets || user?.permissions?.can_manage_system || false;
  const queryType = classifyQuery(message);

  try {
    // Queries that need global access
    const globalQueries = new Set([
      'department_breakdown', 'department_specific', 'agent_stats', 'agent_specific',
      'status_breakdown', 'priority_breakdown', 'category_breakdown',
      'resolution_time', 'sla_stats', 'general_summary'
    ]);

    if (globalQueries.has(queryType) && !canViewAll) {
      return {
        answer: `🔒 You need **Manager** or **Admin** access to view organization-wide ticket data.\n\n` +
          `With your current permissions, I can show you:\n` +
          `• "Show my ticket summary"\n` +
          `• "How many tickets do I have?"\n` +
          `• "What is my last ticket status?"\n\n` +
          `Contact your administrator if you need broader access.`,
        queryType: 'access_denied',
        success: true
      };
    }

    let result;
    switch (queryType) {
      case 'ticket_count':        result = await executeTicketCount(message, user); break;
      case 'department_breakdown': result = await executeDepartmentBreakdown(message, user); break;
      case 'department_specific':  result = await executeDepartmentSpecific(message, user); break;
      case 'status_breakdown':     result = await executeStatusBreakdown(message, user); break;
      case 'priority_breakdown':   result = await executePriorityBreakdown(message, user); break;
      case 'category_breakdown':   result = await executeCategoryBreakdown(message, user); break;
      case 'agent_stats':          result = await executeAgentStats(message, user); break;
      case 'agent_specific':       result = await executeAgentSpecific(message, user); break;
      case 'resolution_time':      result = await executeResolutionTime(message, user); break;
      case 'sla_stats':            result = await executeSlaStats(message, user); break;
      case 'general_summary':      result = await executeGeneralSummary(message, user); break;
      default:                     result = await executeTicketCount(message, user); break;
    }

    result.answer += '\n\n*Data queried in real-time from the database.*';

    return {
      answer: result.answer,
      queryType,
      success: true
    };
  } catch (err) {
    logger.error('Bot data query failed', { queryType, error: err.message });
    return {
      answer: `Sorry, I encountered an error while querying the data. Please try again or rephrase your question.\n\n*Error: ${err.message}*`,
      queryType,
      success: false
    };
  }
}

module.exports = {
  processDataQuery,
  isDataQueryIntent: (message) => {
    const DATA_QUERY_PATTERNS_LOCAL = [
      /how\s+many\s+ticket/i,
      /ticket\s+count/i,
      /total\s+(?:number\s+of\s+)?tickets?/i,
      /tickets?\s+(?:created|opened|raised|submitted|logged)\s+(?:today|yesterday|this\s+week|this\s+month|last\s+week|last\s+month)/i,
      /(?:today|yesterday|this\s+week|this\s+month)(?:'s)?\s+tickets?/i,
      /(?:tickets?\s+(?:for|in|from|of|by)\s+)(?:the\s+)?(?:\w+\s+)?(?:department|dept)/i,
      /(?:department|dept)\s+(?:\w+\s+)?(?:tickets?|stats?|statistics?|report|summary)/i,
      /(?:which|what)\s+department\s+has/i,
      /tickets?\s+(?:per|by|for\s+each)\s+department/i,
      /(?:how\s+many\s+)?(?:open|closed|pending|resolved|in[\s-]progress|overdue|escalated)\s+tickets?/i,
      /(?:status|state)\s+(?:of\s+)?(?:all\s+)?tickets?/i,
      /ticket\s+status\s+(?:breakdown|summary|distribution|report|overview)/i,
      /(?:unresolved|outstanding|active|backlog)\s+tickets?/i,
      /(?:high|critical|urgent|low|medium)\s+priority\s+tickets?/i,
      /tickets?\s+(?:by|per|with)\s+priority/i,
      /priority\s+(?:breakdown|summary|distribution|wise)/i,
      /(?:tickets?\s+(?:assigned\s+to|for|of|handled\s+by))\s+\w/i,
      /(?:who|which\s+(?:agent|engineer))\s+has\s+(?:the\s+)?(?:most|least)/i,
      /(?:agent|engineer)\s+(?:performance|stats?|workload|tickets?)/i,
      /(?:top|busiest)\s+(?:agents?|engineers?)/i,
      /(?:average|avg|mean)\s+(?:resolution|response|close)/i,
      /(?:resolution|response)\s+(?:time|rate|speed)/i,
      /(?:sla|service\s+level)\s+(?:compliance|breach|met|performance)/i,
      /(?:overdue|breached|expired)\s+(?:tickets?|sla)/i,
      /(?:give|show|get|tell|provide|display)\s+(?:me\s+)?(?:a\s+)?(?:summary|overview|report|stats?|statistics?|dashboard|breakdown|analysis)\s+(?:of\s+)?(?:all\s+)?tickets?/i,
      /ticket\s+(?:summary|overview|report|stats?|statistics?|dashboard|analysis)/i,
      /(?:daily|weekly|monthly)\s+(?:ticket\s+)?(?:report|summary|stats?)/i,
      /tickets?\s+(?:by|per|in|for)\s+(?:each\s+)?category/i,
      /(?:which|what)\s+category\s+has/i,
      /category\s+(?:breakdown|summary|distribution|wise)/i,
      /department\s+(?:wise|breakdown)/i,
    ];
    return DATA_QUERY_PATTERNS_LOCAL.some(p => p.test(message));
  }
};

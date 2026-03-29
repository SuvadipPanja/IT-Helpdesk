/**
 * Operational reports API — uses reports.service (parameterized SQL).
 * Optional stored procedures: see migrations/Reports_StoredProcedures.sql
 */

const { executeQuery } = require('../config/database');
const { createResponse } = require('../utils/helpers');
const logger = require('../utils/logger');
const rs = require('../services/reports.service');
const outageRs = require('../services/outageReportService');

const VALID_TYPES = new Set([
  'ticket_master',
  'ticket_journey',
  'summary_department',
  'summary_location',
  'summary_team',
  'summary_priority',
  'summary_category',
  'sla_breach_detail',
  'kb_usage',
  'user_sessions',
  'login_attempts',
  'security_audit',
  'bot_sessions',
  'bot_messages',
  'outage_master',
  'outage_audit',
  'outage_overview',
]);

/** Normalize to YYYY-MM-DD (accepts date inputs or ISO datetime strings). */
function normalizeReportDate(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function parseBodyDates(body) {
  const startRaw = body.startDate || body.start_date;
  const endRaw = body.endDate || body.end_date;
  if (!startRaw || !endRaw) {
    return { error: 'startDate and endDate are required (YYYY-MM-DD).' };
  }
  const s = normalizeReportDate(startRaw);
  const e = normalizeReportDate(endRaw);
  if (!s || !e) {
    return { error: 'startDate and endDate must include a valid calendar day (YYYY-MM-DD).' };
  }
  if (new Date(s + 'T00:00:00') > new Date(e + 'T00:00:00')) {
    return { error: 'startDate must be on or before endDate.' };
  }
  return { startDate: s, endDate: e };
}

function parseUserIds(body) {
  const raw = body.userIds ?? body.user_ids;
  if (raw == null || raw === '') return [];
  if (Array.isArray(raw)) {
    return raw.map((x) => parseInt(x, 10)).filter((n) => !Number.isNaN(n) && n > 0);
  }
  if (typeof raw === 'string') {
    return raw
      .split(/[,;\s]+/)
      .map((p) => parseInt(p.trim(), 10))
      .filter((n) => !Number.isNaN(n) && n > 0);
  }
  return [];
}

/** Accept array or comma-separated string (some clients send a single string). */
function parseAuditActionTypes(body) {
  const raw = body.auditActionTypes ?? body.audit_action_types;
  if (raw == null || raw === '') return [];
  if (Array.isArray(raw)) {
    return raw.map((s) => String(s).trim()).filter(Boolean);
  }
  if (typeof raw === 'string') {
    return raw
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function parseBoolLoose(v, defaultVal = false) {
  if (v === null || v === undefined) return defaultVal;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') {
    const t = v.trim().toLowerCase();
    if (t === '' || t === 'false' || t === '0' || t === 'no') return false;
    if (t === 'true' || t === '1' || t === 'yes') return true;
  }
  return !!v;
}

function isMissingTableError(err) {
  const msg = (err && (err.message || err.originalError?.message)) || '';
  return /invalid object name/i.test(msg) || /does not exist/i.test(msg);
}

/**
 * GET /api/v1/reports/filter-options
 */
const getFilterOptions = async (req, res, next) => {
  try {
    const [dept, loc, team, pri] = await Promise.all([
      executeQuery(
        `SELECT department_id, department_name FROM departments WHERE is_active = 1 ORDER BY department_name`
      ),
      executeQuery(
        `SELECT location_id, location_name FROM locations WHERE is_active = 1 ORDER BY location_name`
      ),
      executeQuery(`SELECT team_id, team_name, team_code FROM teams WHERE is_active = 1 ORDER BY team_name`),
      executeQuery(
        `SELECT priority_id, priority_name FROM ticket_priorities WHERE ISNULL(is_active, 1) = 1 ORDER BY priority_name`
      ),
    ]);
    return res.json(
      createResponse(true, 'Filter options', {
        departments: dept.recordset || [],
        locations: loc.recordset || [],
        teams: team.recordset || [],
        priorities: pri.recordset || [],
      })
    );
  } catch (e) {
    logger.error('getFilterOptions', e);
    next(e);
  }
};

/**
 * POST /api/v1/reports/run
 */
const runReport = async (req, res, next) => {
  try {
    const body = req.body || {};
    const reportType = (body.reportType || body.report_type || '').trim();
    if (!VALID_TYPES.has(reportType)) {
      return res.status(400).json(
        createResponse(false, `Invalid reportType. One of: ${[...VALID_TYPES].join(', ')}`)
      );
    }

    const parsed = parseBodyDates(body);
    if (parsed.error) {
      return res.status(400).json(createResponse(false, parsed.error));
    }
    const { startDate, endDate } = parsed;

    const statusScope = ['all', 'open', 'closed'].includes(body.statusScope) ? body.statusScope : 'all';
    const departmentIds = body.departmentIds || body.department_ids || [];
    const locationIds = body.locationIds || body.location_ids || [];
    const teamIds = body.teamIds || body.team_ids || [];
    const priorityIds = body.priorityIds || body.priority_ids || [];
    const page = parseInt(body.page, 10) || 1;
    const pageSize = Math.min(500, Math.max(1, parseInt(body.pageSize || body.page_size, 10) || 200));

    const userIds = parseUserIds(body);
    const auditActionTypes = parseAuditActionTypes(body);
    const journeyDateScope = ['event', 'ticket_created'].includes(body.journeyDateScope || body.journey_date_scope)
      ? body.journeyDateScope || body.journey_date_scope
      : 'event';
    const journeyMode = ['summary', 'timeline'].includes(body.journeyMode || body.journey_mode)
      ? body.journeyMode || body.journey_mode
      : 'summary';
    const ticketNumber =
      body.ticketNumber != null && String(body.ticketNumber).trim() !== ''
        ? String(body.ticketNumber).trim()
        : null;
    const onlyFailures = parseBoolLoose(body.onlyFailures ?? body.only_failures, false);

    let rows;
    let total = null;
    let meta = {
      reportType,
      startDate,
      endDate,
      statusScope,
    };

    /** Run data + count sequentially with cloned params (avoids mssql edge cases with parallel requests). */
    const runPaged = async (buildFn, args) => {
      const { query, countQuery, params } = buildFn(args);
      const base = { ...params };
      const dataRes = await executeQuery(query, { ...base });
      const countRes = await executeQuery(countQuery, { ...base });
      return {
        rows: dataRes.recordset || [],
        total: countRes.recordset?.[0]?.total ?? null,
        params: base,
      };
    };

    try {
      if (reportType === 'ticket_master') {
        const { query, countQuery, params } = rs.buildTicketMasterQuery({
          startDate,
          endDate,
          statusScope,
          departmentIds,
          locationIds,
          teamIds,
          priorityIds,
          page,
          pageSize,
        });
        const base = { ...params };
        const dataRes = await executeQuery(query, { ...base });
        const countRes = await executeQuery(countQuery, { ...base });
        rows = dataRes.recordset || [];
        total = countRes.recordset?.[0]?.total ?? rows.length;
        meta = { ...meta, page, pageSize, total, priorityIds };
      } else if (reportType === 'ticket_journey') {
        const ticketId = body.ticketId || body.ticket_id || null;
        const buildFn =
          journeyMode === 'timeline' ? rs.buildTicketJourneyQuery : rs.buildTicketJourneySummaryQuery;
        const { query, countQuery, params } = buildFn({
          startDate,
          endDate,
          statusScope,
          departmentIds,
          locationIds,
          teamIds,
          priorityIds,
          ticketId,
          ticketNumber,
          dateScope: journeyDateScope,
          page,
          pageSize,
        });
        const base = { ...params };
        const dataRes = await executeQuery(query, { ...base });
        const countRes = await executeQuery(countQuery, { ...base });
        rows = dataRes.recordset || [];
        total = countRes.recordset?.[0]?.total ?? rows.length;
        meta = {
          ...meta,
          page,
          pageSize,
          total,
          ticketId,
          ticketNumber,
          journeyDateScope,
          journeyMode,
        };
      } else if (reportType === 'summary_department') {
        const { query, params } = rs.buildSummaryByDepartment({
          startDate,
          endDate,
          statusScope,
          departmentIds,
          locationIds,
          teamIds,
          priorityIds,
        });
        const dataRes = await executeQuery(query, params);
        rows = dataRes.recordset || [];
      } else if (reportType === 'summary_location') {
        const { query, params } = rs.buildSummaryByLocation({
          startDate,
          endDate,
          statusScope,
          departmentIds,
          locationIds,
          teamIds,
          priorityIds,
        });
        const dataRes = await executeQuery(query, params);
        rows = dataRes.recordset || [];
      } else if (reportType === 'summary_team') {
        const { query, params } = rs.buildSummaryByTeam({
          startDate,
          endDate,
          statusScope,
          departmentIds,
          locationIds,
          teamIds,
          priorityIds,
        });
        const dataRes = await executeQuery(query, params);
        rows = dataRes.recordset || [];
      } else if (reportType === 'summary_priority') {
        const { query, params } = rs.buildSummaryByPriority({
          startDate,
          endDate,
          statusScope,
          departmentIds,
          locationIds,
          teamIds,
          priorityIds,
        });
        const dataRes = await executeQuery(query, params);
        rows = dataRes.recordset || [];
      } else if (reportType === 'summary_category') {
        const { query, params } = rs.buildSummaryByCategory({
          startDate,
          endDate,
          statusScope,
          departmentIds,
          locationIds,
          teamIds,
          priorityIds,
        });
        const dataRes = await executeQuery(query, params);
        rows = dataRes.recordset || [];
      } else if (reportType === 'sla_breach_detail') {
        const r = await runPaged(rs.buildSLABreachDetail, {
          startDate,
          endDate,
          statusScope,
          departmentIds,
          locationIds,
          teamIds,
          priorityIds,
          page,
          pageSize,
        });
        rows = r.rows;
        total = r.total;
        meta = { ...meta, page, pageSize, total };
      } else if (reportType === 'kb_usage') {
        const r = await runPaged(rs.buildKBUsageReport, { startDate, endDate, page, pageSize });
        rows = r.rows;
        total = r.total;
        meta = { ...meta, page, pageSize, total };
      } else if (reportType === 'user_sessions') {
        const r = await runPaged(rs.buildUserSessionsReport, { startDate, endDate, userIds, page, pageSize });
        rows = r.rows;
        total = r.total;
        meta = { ...meta, page, pageSize, total, userIds };
      } else if (reportType === 'login_attempts') {
        const r = await runPaged(rs.buildLoginAttemptsReport, {
          startDate,
          endDate,
          userIds,
          onlyFailures,
          page,
          pageSize,
        });
        rows = r.rows;
        total = r.total;
        meta = { ...meta, page, pageSize, total, userIds, onlyFailures };
      } else if (reportType === 'security_audit') {
        const r = await runPaged(rs.buildSecurityAuditReport, {
          startDate,
          endDate,
          actionTypes: auditActionTypes,
          userIds,
          page,
          pageSize,
        });
        rows = r.rows;
        total = r.total;
        meta = { ...meta, page, pageSize, total, userIds, auditActionTypes };
      } else if (reportType === 'bot_sessions') {
        const r = await runPaged(rs.buildBotSessionsReport, { startDate, endDate, userIds, page, pageSize });
        rows = r.rows;
        total = r.total;
        meta = { ...meta, page, pageSize, total, userIds };
      } else if (reportType === 'bot_messages') {
        const r = await runPaged(rs.buildBotMessagesReport, { startDate, endDate, userIds, page, pageSize });
        rows = r.rows;
        total = r.total;
        meta = { ...meta, page, pageSize, total, userIds };
      } else if (reportType === 'outage_master') {
        const r = await runPaged(outageRs.buildOutageMasterQuery, { startDate, endDate, statusScope, page, pageSize });
        rows = r.rows;
        total = r.total;
        meta = { ...meta, page, pageSize, total };
      } else if (reportType === 'outage_audit') {
        const r = await runPaged(outageRs.buildOutageAuditQuery, { startDate, endDate, page, pageSize });
        rows = r.rows;
        total = r.total;
        meta = { ...meta, page, pageSize, total };
      } else if (reportType === 'outage_overview') {
        const { query, params } = outageRs.buildOutageOverviewQuery({ startDate, endDate });
        const dataRes = await executeQuery(query, params);
        rows = dataRes.recordset || [];
      }
    } catch (e) {
      if (isMissingTableError(e)) {
        return res.status(503).json(
          createResponse(
            false,
            'This report needs database objects that are not present (e.g. bot or audit tables). Run the latest migrations or pick another report.'
          )
        );
      }
      const sqlMsg = e?.message || e?.originalError?.message || String(e);
      const sqlNumber = e?.number ?? e?.originalError?.number;
      logger.error('runReport query failed', { reportType, sqlMsg, sqlNumber });
      return res.status(500).json(
        createResponse(
          false,
          process.env.NODE_ENV === 'development' ? sqlMsg : 'Report query failed. Check server logs or contact support.',
          null,
          { sqlMessage: sqlMsg, sqlNumber }
        )
      );
    }

    logger.info('Report run', { reportType, userId: req.user?.user_id, rowCount: rows?.length });

    return res.json(
      createResponse(true, 'Report generated', {
        meta,
        columns: rows.length ? Object.keys(rows[0]) : [],
        rows,
      })
    );
  } catch (e) {
    logger.error('runReport', e);
    next(e);
  }
};

module.exports = {
  getFilterOptions,
  runReport,
};

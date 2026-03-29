/**
 * Operational reports — parameterized SQL (mirrors optional stored procedures in
 * migrations/Reports_StoredProcedures.sql). Safe ID list handling (no raw concat).
 */

function normalizeIds(arr) {
  if (!Array.isArray(arr)) return [];
  return [...new Set(arr.map((x) => parseInt(x, 10)).filter((n) => !Number.isNaN(n) && n > 0))];
}

function addInClause(column, ids, paramPrefix, baseParams) {
  if (!ids.length) return { clause: '', params: {} };
  const keys = [];
  const extra = {};
  ids.forEach((id, i) => {
    const k = `${paramPrefix}${i}`;
    keys.push(`@${k}`);
    extra[k] = id;
  });
  return { clause: ` AND ${column} IN (${keys.join(',')})`, params: { ...baseParams, ...extra } };
}

function addStringInClause(column, values, paramPrefix, baseParams) {
  if (!Array.isArray(values) || !values.length) return { clause: '', params: {} };
  const keys = [];
  const extra = {};
  values.forEach((v, i) => {
    const k = `${paramPrefix}${i}`;
    keys.push(`@${k}`);
    extra[k] = String(v);
  });
  return { clause: ` AND ${column} IN (${keys.join(',')})`, params: { ...baseParams, ...extra } };
}

/** Page window: ROW_NUMBER() > @off AND <= @rowEnd (avoids OFFSET/FETCH param issues on some SQL Server drivers) */
function computePaging(page, pageSize, maxPs = 500) {
  const fallbackPs = maxPs >= 1000 ? 500 : 200;
  const ps = Math.min(maxPs, Math.max(1, parseInt(pageSize, 10) || fallbackPs));
  const pg = Math.max(1, parseInt(page, 10) || 1);
  const off = (pg - 1) * ps;
  const rowEnd = off + ps;
  return { off, ps, rowEnd };
}

function buildTicketDimensionFilters(mergeParams, { departmentIds = [], locationIds = [], teamIds = [], priorityIds = [] } = {}) {
  let extraClause = '';
  let p = { ...mergeParams };
  const dIn = addInClause('t.department_id', normalizeIds(departmentIds), 'sfdep', p);
  extraClause += dIn.clause;
  p = { ...p, ...dIn.params };
  const lIn = addInClause('t.location_id', normalizeIds(locationIds), 'sfloc', p);
  extraClause += lIn.clause;
  p = { ...p, ...lIn.params };
  const tIn = addInClause('t.team_id', normalizeIds(teamIds), 'sftm', p);
  extraClause += tIn.clause;
  p = { ...p, ...tIn.params };
  const prIn = addInClause('t.priority_id', normalizeIds(priorityIds), 'sfpr', p);
  extraClause += prIn.clause;
  p = { ...p, ...prIn.params };
  return { extraClause, params: p };
}

/**
 * Ticket master listing — full row set for reports / export
 */
function buildTicketMasterQuery({
  startDate,
  endDate,
  statusScope = 'all',
  departmentIds = [],
  locationIds = [],
  teamIds = [],
  priorityIds = [],
  page = 1,
  pageSize = 200,
}) {
  const deps = normalizeIds(departmentIds);
  const locs = normalizeIds(locationIds);
  const teams = normalizeIds(teamIds);
  const prios = normalizeIds(priorityIds);

  let statusClause = '';
  if (statusScope === 'open') {
    statusClause = ' AND ts.is_final_status = 0';
  } else if (statusScope === 'closed') {
    statusClause = ' AND ts.is_final_status = 1';
  }

  const { off, ps, rowEnd } = computePaging(page, pageSize);
  const p0 = {
    startDate,
    endDate,
    off,
    ps,
    rowEnd,
  };

  let extraClause = '';
  let mergeParams = { ...p0 };

  const dIn = addInClause('t.department_id', deps, 'dep', mergeParams);
  extraClause += dIn.clause;
  mergeParams = { ...mergeParams, ...dIn.params };

  const lIn = addInClause('t.location_id', locs, 'loc', mergeParams);
  extraClause += lIn.clause;
  mergeParams = { ...mergeParams, ...lIn.params };

  const tIn = addInClause('t.team_id', teams, 'tm', mergeParams);
  extraClause += tIn.clause;
  mergeParams = { ...mergeParams, ...tIn.params };

  const pIn = addInClause('t.priority_id', prios, 'prio', mergeParams);
  extraClause += pIn.clause;
  mergeParams = { ...mergeParams, ...pIn.params };

  const query = `
    SELECT
      p.ticket_id,
      p.ticket_number,
      p.subject,
      p.created_at,
      p.updated_at,
      p.closed_at,
      p.resolved_at,
      p.first_response_at,
      p.due_date,
      p.status_name,
      p.status_code,
      p.priority_name,
      p.department_name,
      p.location_name,
      p.team_name,
      p.requester_name,
      p.assignee_name,
      p.is_escalated,
      p.rating,
      p.sla_paused,
      p.category_name,
      p.process_name
    FROM (
      SELECT
        inn.*,
        ROW_NUMBER() OVER (ORDER BY inn.created_at DESC) AS __rn
      FROM (
        SELECT
          t.ticket_id,
          t.ticket_number,
          t.subject,
          t.created_at,
          t.updated_at,
          t.closed_at,
          t.resolved_at,
          t.first_response_at,
          t.due_date,
          ts.status_name,
          ts.status_code,
          tp.priority_name,
          d.department_name,
          loc.location_name,
          tm.team_name,
          LTRIM(RTRIM(CONCAT(ISNULL(req.first_name, ''), ' ', ISNULL(req.last_name, '')))) AS requester_name,
          LTRIM(RTRIM(CONCAT(ISNULL(eng.first_name, ''), ' ', ISNULL(eng.last_name, '')))) AS assignee_name,
          t.is_escalated,
          t.rating,
          t.sla_paused,
          cat.category_name,
          prc.process_name
        FROM tickets t
        INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
        LEFT JOIN ticket_priorities tp ON t.priority_id = tp.priority_id
        LEFT JOIN departments d ON t.department_id = d.department_id
        LEFT JOIN locations loc ON t.location_id = loc.location_id
        LEFT JOIN teams tm ON t.team_id = tm.team_id
        LEFT JOIN users req ON t.requester_id = req.user_id
        LEFT JOIN users eng ON t.assigned_to = eng.user_id
        LEFT JOIN ticket_categories cat ON t.category_id = cat.category_id
        LEFT JOIN processes prc ON t.process_id = prc.process_id
        WHERE t.created_at >= @startDate
          AND t.created_at < DATEADD(DAY, 1, CAST(@endDate AS DATE))
          ${statusClause}
          ${extraClause}
      ) inn
    ) p
    WHERE p.__rn > @off AND p.__rn <= @rowEnd
    ORDER BY p.__rn
  `;

  const countQuery = `
    SELECT COUNT(*) AS total
    FROM tickets t
    INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
    LEFT JOIN ticket_priorities tp ON t.priority_id = tp.priority_id
    WHERE t.created_at >= @startDate
      AND t.created_at < DATEADD(DAY, 1, CAST(@endDate AS DATE))
      ${statusClause}
      ${extraClause}
  `;

  return { query, countQuery, params: mergeParams };
}

/**
 * Ticket journey — one row per event: activities + public/internal comments (union).
 * dateScope: 'event' = filter by when the event happened; 'ticket_created' = legacy window on ticket.created_at.
 */
function buildTicketJourneyQuery({
  startDate,
  endDate,
  statusScope = 'all',
  departmentIds = [],
  locationIds = [],
  teamIds = [],
  priorityIds = [],
  ticketId = null,
  ticketNumber = null,
  dateScope = 'event',
  page = 1,
  pageSize = 500,
}) {
  const deps = normalizeIds(departmentIds);
  const locs = normalizeIds(locationIds);
  const teams = normalizeIds(teamIds);
  const prios = normalizeIds(priorityIds);

  let statusClause = '';
  if (statusScope === 'open') statusClause = ' AND ts.is_final_status = 0';
  if (statusScope === 'closed') statusClause = ' AND ts.is_final_status = 1';

  const { off, ps, rowEnd } = computePaging(page, pageSize, 1000);
  let mergeParams = {
    startDate,
    endDate,
    off,
    ps,
    rowEnd,
  };

  let ticketClause = '';
  if (ticketId != null && ticketId !== '') {
    const tid = parseInt(ticketId, 10);
    if (!Number.isNaN(tid) && tid > 0) {
      mergeParams.ticketId = tid;
      ticketClause = ' AND t.ticket_id = @ticketId';
    }
  }

  if (ticketNumber != null && String(ticketNumber).trim() !== '') {
    mergeParams.ticketNumber = String(ticketNumber).trim();
    ticketClause += ' AND t.ticket_number = @ticketNumber';
  }

  let extraClause = '';
  const dIn = addInClause('t.department_id', deps, 'jdep', mergeParams);
  extraClause += dIn.clause;
  mergeParams = { ...mergeParams, ...dIn.params };

  const lIn = addInClause('t.location_id', locs, 'jloc', mergeParams);
  extraClause += lIn.clause;
  mergeParams = { ...mergeParams, ...lIn.params };

  const tIn = addInClause('t.team_id', teams, 'jtm', mergeParams);
  extraClause += tIn.clause;
  mergeParams = { ...mergeParams, ...tIn.params };

  const prIn = addInClause('t.priority_id', prios, 'jpr', mergeParams);
  extraClause += prIn.clause;
  mergeParams = { ...mergeParams, ...prIn.params };

  const ticketCreatedFilter =
    dateScope === 'ticket_created'
      ? `t.created_at >= @startDate AND t.created_at < DATEADD(DAY, 1, CAST(@endDate AS DATE))`
      : '1=1';

  const eventDateFilter =
    dateScope === 'event'
      ? `ev.event_at >= @startDate AND ev.event_at < DATEADD(DAY, 1, CAST(@endDate AS DATE))`
      : `t.created_at >= @startDate AND t.created_at < DATEADD(DAY, 1, CAST(@endDate AS DATE))`;

  const query = `
    SELECT
      p.event_source,
      p.event_id,
      p.ticket_id,
      p.ticket_number,
      p.subject,
      p.activity_type,
      p.field_name,
      p.old_value,
      p.new_value,
      p.description,
      p.event_at,
      p.performed_by_name
    FROM (
      SELECT
        x.*,
        ROW_NUMBER() OVER (ORDER BY x.ticket_id, x.event_at, x.event_source) AS __rn
      FROM (
        SELECT
          ev.event_source,
          ev.event_id,
          ev.ticket_id,
          t.ticket_number,
          t.subject,
          ev.activity_type,
          ev.field_name,
          ev.old_value,
          ev.new_value,
          ev.description,
          ev.event_at,
          ev.performed_by_name
        FROM (
          SELECT
            'activity' AS event_source,
            CAST(ta.activity_id AS VARCHAR(32)) AS event_id,
            ta.ticket_id,
            ta.activity_type,
            ta.field_name,
            ta.old_value,
            ta.new_value,
            ta.description,
            ta.performed_at AS event_at,
            u.first_name + ' ' + u.last_name AS performed_by_name
          FROM ticket_activities ta
          INNER JOIN tickets t2 ON ta.ticket_id = t2.ticket_id
          LEFT JOIN users u ON ta.performed_by = u.user_id
          WHERE ${dateScope === 'event' ? 'ta.performed_at >= @startDate AND ta.performed_at < DATEADD(DAY, 1, CAST(@endDate AS DATE))' : ticketCreatedFilter.replace('t.', 't2.')}
          UNION ALL
          SELECT
            'comment' AS event_source,
            CAST(tc.comment_id AS VARCHAR(32)) AS event_id,
            tc.ticket_id,
            'COMMENT' AS activity_type,
            CASE WHEN tc.is_internal = 1 THEN 'internal_note' ELSE 'public_comment' END AS field_name,
            NULL AS old_value,
            LEFT(CAST(tc.comment_text AS NVARCHAR(MAX)), 4000) AS new_value,
            NULL AS description,
            tc.commented_at AS event_at,
            uc.first_name + ' ' + uc.last_name AS performed_by_name
          FROM ticket_comments tc
          INNER JOIN tickets t3 ON tc.ticket_id = t3.ticket_id
          LEFT JOIN users uc ON tc.commented_by = uc.user_id
          WHERE tc.is_deleted = 0
            AND (${dateScope === 'event' ? 'tc.commented_at >= @startDate AND tc.commented_at < DATEADD(DAY, 1, CAST(@endDate AS DATE))' : ticketCreatedFilter.replace('t.', 't3.')})
        ) ev
        INNER JOIN tickets t ON ev.ticket_id = t.ticket_id
        INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
        WHERE ${eventDateFilter}
          ${statusClause}
          ${ticketClause}
          ${extraClause}
      ) x
    ) p
    WHERE p.__rn > @off AND p.__rn <= @rowEnd
    ORDER BY p.__rn
  `;

  const countQuery = `
    SELECT COUNT(*) AS total
    FROM (
      SELECT ev.ticket_id, ev.event_at
      FROM (
        SELECT
          ta.ticket_id,
          ta.performed_at AS event_at
        FROM ticket_activities ta
        INNER JOIN tickets t2 ON ta.ticket_id = t2.ticket_id
        WHERE ${dateScope === 'event' ? 'ta.performed_at >= @startDate AND ta.performed_at < DATEADD(DAY, 1, CAST(@endDate AS DATE))' : ticketCreatedFilter.replace('t.', 't2.')}
        UNION ALL
        SELECT
          tc.ticket_id,
          tc.commented_at AS event_at
        FROM ticket_comments tc
        INNER JOIN tickets t3 ON tc.ticket_id = t3.ticket_id
        WHERE tc.is_deleted = 0
          AND (${dateScope === 'event' ? 'tc.commented_at >= @startDate AND tc.commented_at < DATEADD(DAY, 1, CAST(@endDate AS DATE))' : ticketCreatedFilter.replace('t.', 't3.')})
      ) ev
      INNER JOIN tickets t ON ev.ticket_id = t.ticket_id
      INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
      WHERE ${eventDateFilter}
        ${statusClause}
        ${ticketClause}
        ${extraClause}
    ) c
  `;

  return { query, countQuery, params: mergeParams };
}

/**
 * One row per ticket: counts + human-readable timeline (STRING_AGG). Same filters as detailed journey.
 */
function buildTicketJourneySummaryQuery({
  startDate,
  endDate,
  statusScope = 'all',
  departmentIds = [],
  locationIds = [],
  teamIds = [],
  priorityIds = [],
  ticketId = null,
  ticketNumber = null,
  dateScope = 'event',
  page = 1,
  pageSize = 500,
}) {
  const deps = normalizeIds(departmentIds);
  const locs = normalizeIds(locationIds);
  const teams = normalizeIds(teamIds);
  const prios = normalizeIds(priorityIds);

  let statusClause = '';
  if (statusScope === 'open') statusClause = ' AND ts.is_final_status = 0';
  if (statusScope === 'closed') statusClause = ' AND ts.is_final_status = 1';

  const { off, ps, rowEnd } = computePaging(page, pageSize, 1000);
  let mergeParams = {
    startDate,
    endDate,
    off,
    ps,
    rowEnd,
  };

  let ticketClause = '';
  if (ticketId != null && ticketId !== '') {
    const tid = parseInt(ticketId, 10);
    if (!Number.isNaN(tid) && tid > 0) {
      mergeParams.ticketId = tid;
      ticketClause = ' AND t.ticket_id = @ticketId';
    }
  }

  if (ticketNumber != null && String(ticketNumber).trim() !== '') {
    mergeParams.ticketNumber = String(ticketNumber).trim();
    ticketClause += ' AND t.ticket_number = @ticketNumber';
  }

  let extraClause = '';
  const dIn = addInClause('t.department_id', deps, 'sjdep', mergeParams);
  extraClause += dIn.clause;
  mergeParams = { ...mergeParams, ...dIn.params };

  const lIn = addInClause('t.location_id', locs, 'sjloc', mergeParams);
  extraClause += lIn.clause;
  mergeParams = { ...mergeParams, ...lIn.params };

  const tIn = addInClause('t.team_id', teams, 'sjtm', mergeParams);
  extraClause += tIn.clause;
  mergeParams = { ...mergeParams, ...tIn.params };

  const prIn = addInClause('t.priority_id', prios, 'sjpr', mergeParams);
  extraClause += prIn.clause;
  mergeParams = { ...mergeParams, ...prIn.params };

  const ticketCreatedFilter =
    dateScope === 'ticket_created'
      ? `t.created_at >= @startDate AND t.created_at < DATEADD(DAY, 1, CAST(@endDate AS DATE))`
      : '1=1';

  const eventDateFilter =
    dateScope === 'event'
      ? `ev.event_at >= @startDate AND ev.event_at < DATEADD(DAY, 1, CAST(@endDate AS DATE))`
      : `t.created_at >= @startDate AND t.created_at < DATEADD(DAY, 1, CAST(@endDate AS DATE))`;

  const unionActivity = `
        SELECT
          'activity' AS event_source,
          CAST(ta.activity_id AS VARCHAR(32)) AS event_id,
          ta.ticket_id,
          ta.activity_type,
          ta.field_name,
          ta.old_value,
          ta.new_value,
          ta.description,
          ta.performed_at AS event_at,
          LTRIM(RTRIM(CONCAT(ISNULL(u.first_name, ''), ' ', ISNULL(u.last_name, '')))) AS performed_by_name
        FROM ticket_activities ta
        INNER JOIN tickets t2 ON ta.ticket_id = t2.ticket_id
        LEFT JOIN users u ON ta.performed_by = u.user_id
        WHERE ${dateScope === 'event' ? 'ta.performed_at >= @startDate AND ta.performed_at < DATEADD(DAY, 1, CAST(@endDate AS DATE))' : ticketCreatedFilter.replace('t.', 't2.')}
  `;

  const unionComment = `
        SELECT
          'comment' AS event_source,
          CAST(tc.comment_id AS VARCHAR(32)) AS event_id,
          tc.ticket_id,
          'COMMENT' AS activity_type,
          CASE WHEN tc.is_internal = 1 THEN 'internal_note' ELSE 'public_comment' END AS field_name,
          NULL AS old_value,
          LEFT(CAST(tc.comment_text AS NVARCHAR(MAX)), 4000) AS new_value,
          NULL AS description,
          tc.commented_at AS event_at,
          LTRIM(RTRIM(CONCAT(ISNULL(uc.first_name, ''), ' ', ISNULL(uc.last_name, '')))) AS performed_by_name
        FROM ticket_comments tc
        INNER JOIN tickets t3 ON tc.ticket_id = t3.ticket_id
        LEFT JOIN users uc ON tc.commented_by = uc.user_id
        WHERE tc.is_deleted = 0
          AND (${dateScope === 'event' ? 'tc.commented_at >= @startDate AND tc.commented_at < DATEADD(DAY, 1, CAST(@endDate AS DATE))' : ticketCreatedFilter.replace('t.', 't3.')})
  `;

  const query = `
    SELECT
      p.ticket_id,
      p.ticket_number,
      p.subject,
      p.status_name,
      p.department_name,
      p.location_name,
      p.team_name,
      p.priority_name,
      p.total_events,
      p.activity_events,
      p.comment_events,
      p.first_event_at,
      p.last_event_at,
      p.journey_timeline
    FROM (
      SELECT
        inn.*,
        ROW_NUMBER() OVER (ORDER BY inn.last_event_at DESC) AS __rn
      FROM (
        SELECT
          t.ticket_id,
          MAX(t.ticket_number) AS ticket_number,
          MAX(t.subject) AS subject,
          MAX(ts.status_name) AS status_name,
          MAX(d.department_name) AS department_name,
          MAX(loc.location_name) AS location_name,
          MAX(tm.team_name) AS team_name,
          MAX(tp.priority_name) AS priority_name,
          COUNT(*) AS total_events,
          SUM(CASE WHEN ev.event_source = 'activity' THEN 1 ELSE 0 END) AS activity_events,
          SUM(CASE WHEN ev.event_source = 'comment' THEN 1 ELSE 0 END) AS comment_events,
          MIN(ev.event_at) AS first_event_at,
          MAX(ev.event_at) AS last_event_at,
          STRING_AGG(
            CONVERT(
              NVARCHAR(MAX),
              CONCAT(
                CONVERT(VARCHAR(19), ev.event_at, 120),
                N' | ',
                ev.event_source,
                N' | ',
                ev.activity_type,
                CASE
                  WHEN ev.field_name IS NOT NULL AND LTRIM(RTRIM(CAST(ev.field_name AS NVARCHAR(200)))) <> N'' THEN CONCAT(N' (', ev.field_name, N')')
                  ELSE N''
                END,
                CASE
                  WHEN ev.description IS NOT NULL AND LTRIM(RTRIM(CAST(ev.description AS NVARCHAR(MAX)))) <> N'' THEN CONCAT(N' — ', LEFT(CAST(ev.description AS NVARCHAR(MAX)), 400))
                  WHEN ev.new_value IS NOT NULL AND LTRIM(RTRIM(CAST(ev.new_value AS NVARCHAR(MAX)))) <> N'' THEN CONCAT(N' — ', LEFT(CAST(ev.new_value AS NVARCHAR(MAX)), 400))
                  ELSE N''
                END,
                N' · ',
                ISNULL(NULLIF(LTRIM(RTRIM(ev.performed_by_name)), ''), N'(system)')
              )
            ),
            NCHAR(10)
          ) WITHIN GROUP (ORDER BY ev.event_at) AS journey_timeline
        FROM (
          ${unionActivity}
          UNION ALL
          ${unionComment}
        ) ev
        INNER JOIN tickets t ON ev.ticket_id = t.ticket_id
        INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
        LEFT JOIN departments d ON t.department_id = d.department_id
        LEFT JOIN locations loc ON t.location_id = loc.location_id
        LEFT JOIN teams tm ON t.team_id = tm.team_id
        LEFT JOIN ticket_priorities tp ON t.priority_id = tp.priority_id
        WHERE ${eventDateFilter}
          ${statusClause}
          ${ticketClause}
          ${extraClause}
        GROUP BY t.ticket_id
      ) inn
    ) p
    WHERE p.__rn > @off AND p.__rn <= @rowEnd
    ORDER BY p.__rn
  `;

  const countQuery = `
    SELECT COUNT(*) AS total
    FROM (
      SELECT t.ticket_id
      FROM (
        SELECT ta.ticket_id, ta.performed_at AS event_at
        FROM ticket_activities ta
        INNER JOIN tickets t2 ON ta.ticket_id = t2.ticket_id
        WHERE ${dateScope === 'event' ? 'ta.performed_at >= @startDate AND ta.performed_at < DATEADD(DAY, 1, CAST(@endDate AS DATE))' : ticketCreatedFilter.replace('t.', 't2.')}
        UNION ALL
        SELECT tc.ticket_id, tc.commented_at AS event_at
        FROM ticket_comments tc
        INNER JOIN tickets t3 ON tc.ticket_id = t3.ticket_id
        WHERE tc.is_deleted = 0
          AND (${dateScope === 'event' ? 'tc.commented_at >= @startDate AND tc.commented_at < DATEADD(DAY, 1, CAST(@endDate AS DATE))' : ticketCreatedFilter.replace('t.', 't3.')})
      ) ev
      INNER JOIN tickets t ON ev.ticket_id = t.ticket_id
      INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
      WHERE ${eventDateFilter}
        ${statusClause}
        ${ticketClause}
        ${extraClause}
      GROUP BY t.ticket_id
    ) cnt
  `;

  return { query, countQuery, params: mergeParams };
}

function buildSummaryByDepartment({
  startDate,
  endDate,
  statusScope = 'all',
  departmentIds = [],
  locationIds = [],
  teamIds = [],
  priorityIds = [],
}) {
  let statusClause = '';
  if (statusScope === 'open') statusClause = ' AND ts.is_final_status = 0';
  if (statusScope === 'closed') statusClause = ' AND ts.is_final_status = 1';

  const { extraClause, params } = buildTicketDimensionFilters(
    { startDate, endDate },
    { departmentIds, locationIds, teamIds, priorityIds }
  );

  const query = `
    SELECT
      ISNULL(d.department_name, '(No department)') AS dimension_name,
      d.department_id,
      COUNT(*) AS ticket_count,
      SUM(CASE WHEN ts.is_final_status = 1 THEN 1 ELSE 0 END) AS closed_count,
      SUM(CASE WHEN ts.is_final_status = 0 THEN 1 ELSE 0 END) AS open_count
    FROM tickets t
    INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
    LEFT JOIN departments d ON t.department_id = d.department_id
    WHERE t.created_at >= @startDate
      AND t.created_at < DATEADD(DAY, 1, CAST(@endDate AS DATE))
      ${statusClause}
      ${extraClause}
    GROUP BY d.department_id, d.department_name
    ORDER BY COUNT(*) DESC
  `;
  return { query, params };
}

function buildSummaryByLocation({
  startDate,
  endDate,
  statusScope = 'all',
  departmentIds = [],
  locationIds = [],
  teamIds = [],
  priorityIds = [],
}) {
  let statusClause = '';
  if (statusScope === 'open') statusClause = ' AND ts.is_final_status = 0';
  if (statusScope === 'closed') statusClause = ' AND ts.is_final_status = 1';

  const { extraClause, params } = buildTicketDimensionFilters(
    { startDate, endDate },
    { departmentIds, locationIds, teamIds, priorityIds }
  );

  const query = `
    SELECT
      ISNULL(loc.location_name, '(No location)') AS dimension_name,
      loc.location_id,
      COUNT(*) AS ticket_count,
      SUM(CASE WHEN ts.is_final_status = 1 THEN 1 ELSE 0 END) AS closed_count,
      SUM(CASE WHEN ts.is_final_status = 0 THEN 1 ELSE 0 END) AS open_count
    FROM tickets t
    INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
    LEFT JOIN locations loc ON t.location_id = loc.location_id
    WHERE t.created_at >= @startDate
      AND t.created_at < DATEADD(DAY, 1, CAST(@endDate AS DATE))
      ${statusClause}
      ${extraClause}
    GROUP BY loc.location_id, loc.location_name
    ORDER BY COUNT(*) DESC
  `;
  return { query, params };
}

function buildSummaryByTeam({
  startDate,
  endDate,
  statusScope = 'all',
  departmentIds = [],
  locationIds = [],
  teamIds = [],
  priorityIds = [],
}) {
  let statusClause = '';
  if (statusScope === 'open') statusClause = ' AND ts.is_final_status = 0';
  if (statusScope === 'closed') statusClause = ' AND ts.is_final_status = 1';

  const { extraClause, params } = buildTicketDimensionFilters(
    { startDate, endDate },
    { departmentIds, locationIds, teamIds, priorityIds }
  );

  const query = `
    SELECT
      ISNULL(tm.team_name, '(No team)') AS dimension_name,
      tm.team_id,
      COUNT(*) AS ticket_count,
      SUM(CASE WHEN ts.is_final_status = 1 THEN 1 ELSE 0 END) AS closed_count,
      SUM(CASE WHEN ts.is_final_status = 0 THEN 1 ELSE 0 END) AS open_count
    FROM tickets t
    INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
    LEFT JOIN teams tm ON t.team_id = tm.team_id
    WHERE t.created_at >= @startDate
      AND t.created_at < DATEADD(DAY, 1, CAST(@endDate AS DATE))
      ${statusClause}
      ${extraClause}
    GROUP BY tm.team_id, tm.team_name
    ORDER BY COUNT(*) DESC
  `;
  return { query, params };
}

function buildSummaryByPriority({
  startDate,
  endDate,
  statusScope = 'all',
  departmentIds = [],
  locationIds = [],
  teamIds = [],
  priorityIds = [],
}) {
  let statusClause = '';
  if (statusScope === 'open') statusClause = ' AND ts.is_final_status = 0';
  if (statusScope === 'closed') statusClause = ' AND ts.is_final_status = 1';

  const { extraClause, params } = buildTicketDimensionFilters(
    { startDate, endDate },
    { departmentIds, locationIds, teamIds, priorityIds }
  );

  const query = `
    SELECT
      tp.priority_name AS dimension_name,
      tp.priority_id,
      COUNT(*) AS ticket_count
    FROM tickets t
    INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
    INNER JOIN ticket_priorities tp ON t.priority_id = tp.priority_id
    WHERE t.created_at >= @startDate
      AND t.created_at < DATEADD(DAY, 1, CAST(@endDate AS DATE))
      ${statusClause}
      ${extraClause}
    GROUP BY tp.priority_id, tp.priority_name
    ORDER BY COUNT(*) DESC
  `;
  return { query, params };
}

/** Active sessions — login window, IP, last activity (logout = is_active=0 or audit LOGOUT row) */
function buildUserSessionsReport({ startDate, endDate, userIds = [], page = 1, pageSize = 200 }) {
  const { off, ps, rowEnd } = computePaging(page, pageSize);
  let mergeParams = {
    startDate,
    endDate,
    off,
    ps,
    rowEnd,
  };
  const uIn = addInClause('us.user_id', normalizeIds(userIds), 'sessu', mergeParams);
  const extra = uIn.clause;
  mergeParams = { ...mergeParams, ...uIn.params };

  const query = `
    SELECT
      p.session_id,
      p.user_id,
      p.username,
      p.full_name,
      p.login_at,
      p.last_activity,
      p.expires_at,
      p.is_active,
      p.ip_address,
      p.user_agent,
      p.session_state
    FROM (
      SELECT
        inn.*,
        ROW_NUMBER() OVER (ORDER BY inn.login_at DESC) AS __rn
      FROM (
        SELECT
          us.session_id,
          us.user_id,
          u.username,
          u.first_name + ' ' + u.last_name AS full_name,
          us.login_at,
          us.last_activity,
          us.expires_at,
          us.is_active,
          us.ip_address,
          LEFT(us.user_agent, 500) AS user_agent,
          CASE
            WHEN us.is_active = 1 AND us.expires_at > GETDATE() THEN 'active'
            WHEN us.is_active = 0 THEN 'ended_or_invalidated'
            ELSE 'expired_inactive'
          END AS session_state
        FROM user_sessions us
        INNER JOIN users u ON us.user_id = u.user_id
        WHERE us.login_at >= @startDate
          AND us.login_at < DATEADD(DAY, 1, CAST(@endDate AS DATE))
          ${extra}
      ) inn
    ) p
    WHERE p.__rn > @off AND p.__rn <= @rowEnd
    ORDER BY p.__rn
  `;
  const countQuery = `
    SELECT COUNT(*) AS total
    FROM user_sessions us
    WHERE us.login_at >= @startDate
      AND us.login_at < DATEADD(DAY, 1, CAST(@endDate AS DATE))
      ${extra}
  `;
  return { query, countQuery, params: mergeParams };
}

/** All login attempts (success + failure) with IP */
function buildLoginAttemptsReport({ startDate, endDate, userIds = [], onlyFailures = false, page = 1, pageSize = 200 }) {
  const { off, ps, rowEnd } = computePaging(page, pageSize);
  let mergeParams = {
    startDate,
    endDate,
    off,
    ps,
    rowEnd,
  };
  const uIn = addInClause('la.user_id', normalizeIds(userIds), 'lau', mergeParams);
  mergeParams = { ...mergeParams, ...uIn.params };
  let failClause = '';
  if (onlyFailures) failClause = ' AND la.attempt_successful = 0';

  const query = `
    SELECT
      p.username,
      p.user_id,
      p.ip_address,
      p.user_agent,
      p.attempt_successful,
      p.failure_reason,
      p.attempted_at
    FROM (
      SELECT
        inn.*,
        ROW_NUMBER() OVER (ORDER BY inn.attempted_at DESC) AS __rn
      FROM (
        SELECT
          la.username,
          la.user_id,
          la.ip_address,
          LEFT(CAST(la.user_agent AS NVARCHAR(MAX)), 500) AS user_agent,
          la.attempt_successful,
          la.failure_reason,
          la.attempted_at
        FROM login_attempts la
        WHERE la.attempted_at >= @startDate
          AND la.attempted_at < DATEADD(DAY, 1, CAST(@endDate AS DATE))
          ${uIn.clause}
          ${failClause}
      ) inn
    ) p
    WHERE p.__rn > @off AND p.__rn <= @rowEnd
    ORDER BY p.__rn
  `;
  const countQuery = `
    SELECT COUNT(*) AS total
    FROM login_attempts la
    WHERE la.attempted_at >= @startDate
      AND la.attempted_at < DATEADD(DAY, 1, CAST(@endDate AS DATE))
      ${uIn.clause}
      ${failClause}
  `;
  return { query, countQuery, params: mergeParams };
}

/** Security audit — LOGIN_SUCCESS, LOGOUT, password changes, etc. */
function buildSecurityAuditReport({ startDate, endDate, actionTypes = [], userIds = [], page = 1, pageSize = 200 }) {
  const { off, ps, rowEnd } = computePaging(page, pageSize);
  let mergeParams = {
    startDate,
    endDate,
    off,
    ps,
    rowEnd,
  };
  const uIn = addInClause('sal.user_id', normalizeIds(userIds), 'audu', mergeParams);
  mergeParams = { ...mergeParams, ...uIn.params };
  const aIn = addStringInClause('sal.action_type', actionTypes, 'auda', mergeParams);
  mergeParams = { ...mergeParams, ...aIn.params };
  const typeClause = actionTypes.length ? aIn.clause : '';

  const query = `
    SELECT
      p.user_id,
      p.username,
      p.action_type,
      p.action_details,
      p.ip_address,
      p.user_agent,
      p.[success],
      p.error_message,
      p.created_at
    FROM (
      SELECT
        inn.*,
        ROW_NUMBER() OVER (ORDER BY inn.created_at DESC) AS __rn
      FROM (
        SELECT
          sal.user_id,
          sal.username,
          sal.action_type,
          sal.action_details,
          sal.ip_address,
          LEFT(CAST(sal.user_agent AS NVARCHAR(MAX)), 500) AS user_agent,
          sal.[success],
          sal.error_message,
          sal.created_at
        FROM security_audit_log sal
        WHERE sal.created_at >= @startDate
          AND sal.created_at < DATEADD(DAY, 1, CAST(@endDate AS DATE))
          ${uIn.clause}
          ${typeClause}
      ) inn
    ) p
    WHERE p.__rn > @off AND p.__rn <= @rowEnd
    ORDER BY p.__rn
  `;
  const countQuery = `
    SELECT COUNT(*) AS total
    FROM security_audit_log sal
    WHERE sal.created_at >= @startDate
      AND sal.created_at < DATEADD(DAY, 1, CAST(@endDate AS DATE))
      ${uIn.clause}
      ${typeClause}
  `;
  return { query, countQuery, params: mergeParams };
}

function buildBotSessionsReport({ startDate, endDate, userIds = [], page = 1, pageSize = 200 }) {
  const { off, ps, rowEnd } = computePaging(page, pageSize);
  let mergeParams = {
    startDate,
    endDate,
    off,
    ps,
    rowEnd,
  };
  const uIn = addInClause('b.user_id', normalizeIds(userIds), 'botu', mergeParams);
  mergeParams = { ...mergeParams, ...uIn.params };

  const query = `
    SELECT
      p.id,
      p.session_id,
      p.user_id,
      p.username,
      p.user_name,
      p.user_role,
      p.started_at,
      p.ended_at,
      p.is_active,
      p.total_messages,
      p.user_messages,
      p.bot_messages,
      p.intents_matched,
      p.tickets_created,
      p.ip_address,
      p.user_agent
    FROM (
      SELECT
        inn.*,
        ROW_NUMBER() OVER (ORDER BY inn.started_at DESC) AS __rn
      FROM (
        SELECT
          b.id,
          b.session_id,
          b.user_id,
          u.username,
          b.user_name,
          b.user_role,
          b.started_at,
          b.ended_at,
          b.is_active,
          b.total_messages,
          b.user_messages,
          b.bot_messages,
          b.intents_matched,
          b.tickets_created,
          b.ip_address,
          LEFT(b.user_agent, 500) AS user_agent
        FROM bot_chat_sessions b
        INNER JOIN users u ON b.user_id = u.user_id
        WHERE b.started_at >= @startDate
          AND b.started_at < DATEADD(DAY, 1, CAST(@endDate AS DATE))
          ${uIn.clause}
      ) inn
    ) p
    WHERE p.__rn > @off AND p.__rn <= @rowEnd
    ORDER BY p.__rn
  `;
  const countQuery = `
    SELECT COUNT(*) AS total
    FROM bot_chat_sessions b
    WHERE b.started_at >= @startDate
      AND b.started_at < DATEADD(DAY, 1, CAST(@endDate AS DATE))
      ${uIn.clause}
  `;
  return { query, countQuery, params: mergeParams };
}

function buildBotMessagesReport({ startDate, endDate, userIds = [], page = 1, pageSize = 200 }) {
  const { off, ps, rowEnd } = computePaging(page, pageSize);
  let mergeParams = {
    startDate,
    endDate,
    off,
    ps,
    rowEnd,
  };
  const uIn = addInClause('m.user_id', normalizeIds(userIds), 'bmsgu', mergeParams);
  mergeParams = { ...mergeParams, ...uIn.params };

  const query = `
    SELECT
      p.id,
      p.session_id,
      p.user_id,
      p.username,
      p.message_type,
      p.message_content,
      p.intent_matched,
      p.category,
      p.confidence,
      p.ai_enhanced,
      p.action_type,
      p.created_at
    FROM (
      SELECT
        inn.*,
        ROW_NUMBER() OVER (ORDER BY inn.created_at DESC) AS __rn
      FROM (
        SELECT
          m.id,
          m.session_id,
          m.user_id,
          u.username,
          m.message_type,
          LEFT(CAST(m.message_content AS NVARCHAR(MAX)), 2000) AS message_content,
          m.intent_matched,
          m.category,
          m.confidence,
          m.ai_enhanced,
          m.action_type,
          m.created_at
        FROM bot_chat_messages m
        INNER JOIN users u ON m.user_id = u.user_id
        WHERE m.created_at >= @startDate
          AND m.created_at < DATEADD(DAY, 1, CAST(@endDate AS DATE))
          ${uIn.clause}
      ) inn
    ) p
    WHERE p.__rn > @off AND p.__rn <= @rowEnd
    ORDER BY p.__rn
  `;
  const countQuery = `
    SELECT COUNT(*) AS total
    FROM bot_chat_messages m
    WHERE m.created_at >= @startDate
      AND m.created_at < DATEADD(DAY, 1, CAST(@endDate AS DATE))
      ${uIn.clause}
  `;
  return { query, countQuery, params: mergeParams };
}

/**
 * Summary by ticket category — ticket counts per category.
 */
function buildSummaryByCategory({
  startDate,
  endDate,
  statusScope = 'all',
  departmentIds = [],
  locationIds = [],
  teamIds = [],
  priorityIds = [],
}) {
  let statusClause = '';
  if (statusScope === 'open') statusClause = ' AND ts.is_final_status = 0';
  if (statusScope === 'closed') statusClause = ' AND ts.is_final_status = 1';

  const { extraClause, params } = buildTicketDimensionFilters(
    { startDate, endDate },
    { departmentIds, locationIds, teamIds, priorityIds }
  );

  const query = `
    SELECT
      ISNULL(tc.category_name, '(No category)') AS dimension_name,
      tc.category_id,
      COUNT(*) AS ticket_count,
      SUM(CASE WHEN ts.is_final_status = 1 THEN 1 ELSE 0 END) AS closed_count,
      SUM(CASE WHEN ts.is_final_status = 0 THEN 1 ELSE 0 END) AS open_count,
      SUM(CASE WHEN t.is_escalated = 1 THEN 1 ELSE 0 END) AS escalated_count
    FROM tickets t
    INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
    LEFT JOIN ticket_categories tc ON t.category_id = tc.category_id
    WHERE t.created_at >= @startDate
      AND t.created_at < DATEADD(DAY, 1, CAST(@endDate AS DATE))
      ${statusClause}
      ${extraClause}
    GROUP BY tc.category_id, tc.category_name
    ORDER BY COUNT(*) DESC
  `;
  return { query, params };
}

/**
 * SLA breach detail — tickets that missed first-response or resolution SLA targets.
 */
function buildSLABreachDetail({
  startDate,
  endDate,
  statusScope = 'all',
  departmentIds = [],
  locationIds = [],
  teamIds = [],
  priorityIds = [],
  page = 1,
  pageSize = 200,
}) {
  let statusClause = '';
  if (statusScope === 'open') statusClause = ' AND ts.is_final_status = 0';
  if (statusScope === 'closed') statusClause = ' AND ts.is_final_status = 1';

  const { off, ps, rowEnd } = computePaging(page, pageSize);
  const { extraClause, params: dimParams } = buildTicketDimensionFilters(
    { startDate, endDate },
    { departmentIds, locationIds, teamIds, priorityIds }
  );
  const mergeParams = { ...dimParams, off, ps, rowEnd };

  const query = `
    SELECT
      p.ticket_number,
      p.subject,
      p.priority_name,
      p.department_name,
      p.assignee_name,
      p.status_name,
      p.created_at,
      p.first_response_at,
      p.closed_at,
      p.response_sla_target_minutes,
      p.actual_response_minutes,
      p.response_sla_status,
      p.resolution_sla_target_hours,
      p.actual_resolution_hours,
      p.resolution_sla_status
    FROM (
      SELECT
        inn.*,
        ROW_NUMBER() OVER (ORDER BY inn.created_at DESC) AS __rn
      FROM (
        SELECT
          t.ticket_number,
          t.subject,
          tp.priority_name,
          d.department_name,
          LTRIM(RTRIM(CONCAT(ISNULL(eng.first_name,''),' ',ISNULL(eng.last_name,'')))) AS assignee_name,
          ts.status_name,
          t.created_at,
          t.first_response_at,
          COALESCE(t.closed_at, t.resolved_at) AS closed_at,
          tp.response_time_hours * 60 AS response_sla_target_minutes,
          CASE WHEN t.first_response_at IS NOT NULL
            THEN DATEDIFF(MINUTE, t.created_at, t.first_response_at)
            ELSE NULL END AS actual_response_minutes,
          CASE
            WHEN t.first_response_at IS NULL AND ts.is_final_status = 0 THEN 'No Response'
            WHEN t.first_response_at IS NOT NULL AND DATEDIFF(MINUTE, t.created_at, t.first_response_at) > tp.response_time_hours * 60 THEN 'Breached'
            ELSE 'Met'
          END AS response_sla_status,
          tp.resolution_time_hours AS resolution_sla_target_hours,
          CASE WHEN t.closed_at IS NOT NULL OR t.resolved_at IS NOT NULL
            THEN DATEDIFF(HOUR, t.created_at, COALESCE(t.closed_at, t.resolved_at))
            ELSE NULL END AS actual_resolution_hours,
          CASE
            WHEN t.closed_at IS NULL AND t.resolved_at IS NULL THEN 'Open'
            WHEN DATEDIFF(HOUR, t.created_at, COALESCE(t.closed_at, t.resolved_at)) > tp.resolution_time_hours THEN 'Breached'
            ELSE 'Met'
          END AS resolution_sla_status
        FROM tickets t
        INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
        INNER JOIN ticket_priorities tp ON t.priority_id = tp.priority_id
        LEFT JOIN departments d ON t.department_id = d.department_id
        LEFT JOIN users eng ON t.assigned_to = eng.user_id
        WHERE t.created_at >= @startDate
          AND t.created_at < DATEADD(DAY, 1, CAST(@endDate AS DATE))
          AND tp.response_time_hours IS NOT NULL
          AND tp.resolution_time_hours IS NOT NULL
          AND (
            (t.first_response_at IS NULL AND ts.is_final_status = 0)
            OR (t.first_response_at IS NOT NULL AND DATEDIFF(MINUTE, t.created_at, t.first_response_at) > tp.response_time_hours * 60)
            OR ((t.closed_at IS NOT NULL OR t.resolved_at IS NOT NULL) AND DATEDIFF(HOUR, t.created_at, COALESCE(t.closed_at, t.resolved_at)) > tp.resolution_time_hours)
          )
          ${statusClause}
          ${extraClause}
      ) inn
    ) p
    WHERE p.__rn > @off AND p.__rn <= @rowEnd
    ORDER BY p.__rn
  `;

  const countQuery = `
    SELECT COUNT(*) AS total
    FROM tickets t
    INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
    INNER JOIN ticket_priorities tp ON t.priority_id = tp.priority_id
    WHERE t.created_at >= @startDate
      AND t.created_at < DATEADD(DAY, 1, CAST(@endDate AS DATE))
      AND tp.response_time_hours IS NOT NULL
      AND tp.resolution_time_hours IS NOT NULL
      AND (
        (t.first_response_at IS NULL AND ts.is_final_status = 0)
        OR (t.first_response_at IS NOT NULL AND DATEDIFF(MINUTE, t.created_at, t.first_response_at) > tp.response_time_hours * 60)
        OR ((t.closed_at IS NOT NULL OR t.resolved_at IS NOT NULL) AND DATEDIFF(HOUR, t.created_at, COALESCE(t.closed_at, t.resolved_at)) > tp.resolution_time_hours)
      )
      ${statusClause}
      ${extraClause}
  `;

  return { query, countQuery, params: mergeParams };
}

/**
 * KB usage — published article view activity within the date range.
 */
function buildKBUsageReport({ startDate, endDate, page = 1, pageSize = 200 }) {
  const { off, ps, rowEnd } = computePaging(page, pageSize);
  const mergeParams = { startDate, endDate, off, ps, rowEnd };

  const query = `
    SELECT
      p.title,
      p.category_name,
      p.status,
      p.views_in_period,
      p.views_total,
      p.helpful_yes,
      p.helpful_no,
      p.published_at
    FROM (
      SELECT
        inn.*,
        ROW_NUMBER() OVER (ORDER BY inn.views_in_period DESC, inn.views_total DESC) AS __rn
      FROM (
        SELECT
          a.title,
          ISNULL(kc.name, '(No category)') AS category_name,
          a.status,
          COUNT(av.view_id) AS views_in_period,
          a.views AS views_total,
          a.helpful_yes,
          a.helpful_no,
          a.published_at
        FROM kb_articles a
        LEFT JOIN kb_categories kc ON a.category_id = kc.category_id
        LEFT JOIN kb_article_views av
          ON a.article_id = av.article_id
          AND av.viewed_date >= CAST(@startDate AS DATE)
          AND av.viewed_date <= CAST(@endDate AS DATE)
        WHERE a.status = 'published'
        GROUP BY a.article_id, a.title, kc.name, a.status, a.views, a.helpful_yes, a.helpful_no, a.published_at
      ) inn
    ) p
    WHERE p.__rn > @off AND p.__rn <= @rowEnd
    ORDER BY p.__rn
  `;

  const countQuery = `
    SELECT COUNT(*) AS total
    FROM kb_articles a
    WHERE a.status = 'published'
  `;

  return { query, countQuery, params: mergeParams };
}

module.exports = {
  normalizeIds,
  addStringInClause,
  buildTicketMasterQuery,
  buildTicketJourneyQuery,
  buildTicketJourneySummaryQuery,
  buildSummaryByDepartment,
  buildSummaryByLocation,
  buildSummaryByTeam,
  buildSummaryByPriority,
  buildSummaryByCategory,
  buildSLABreachDetail,
  buildKBUsageReport,
  buildUserSessionsReport,
  buildLoginAttemptsReport,
  buildSecurityAuditReport,
  buildBotSessionsReport,
  buildBotMessagesReport,
};

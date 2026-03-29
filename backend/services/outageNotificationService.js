/**
 * ============================================
 * Outage Notification Service
 * Core business logic: templates, notifications, wall feed,
 * audience targeting, view tracking, access control, audit.
 * ============================================
 */

const { executeQuery } = require('../config/database');
const logger = require('../utils/logger');
const { getClientIp } = require('../utils/clientIp');

// Lazy-loaded to avoid circular deps
let _waNotify, _emailQueue;
const getWaNotify = () => { if (!_waNotify) _waNotify = require('./whatsappNotificationService'); return _waNotify; };
const getEmailQueue = () => { if (!_emailQueue) _emailQueue = require('./emailQueue.service'); return _emailQueue; };

// ============================================
// ALERT DISPATCH (WhatsApp + Email)
// ============================================

/**
 * Get audience-matched users for a notification (with email for alerts).
 * Reuses the same audience targeting logic as previewAudience.
 */
const getAudienceUsers = async (audienceType, audienceData) => {
  if (audienceType === 'all' || !audienceData) {
    const r = await executeQuery('SELECT user_id, first_name, last_name, email FROM users WHERE is_active = 1');
    return r.recordset;
  }

  let targets;
  try { targets = typeof audienceData === 'string' ? JSON.parse(audienceData) : audienceData; } catch { targets = []; }
  const ids = Array.isArray(targets) ? targets.map(Number) : [];
  if (!ids.length) return [];

  const keys = [];
  const params = {};
  ids.forEach((id, i) => { const k = `id${i}`; keys.push(`@${k}`); params[k] = id; });
  const inClause = keys.join(',');

  const queryMap = {
    department: `SELECT user_id, first_name, last_name, email FROM users WHERE is_active = 1 AND department_id IN (${inClause})`,
    location: `SELECT user_id, first_name, last_name, email FROM users WHERE is_active = 1 AND location_id IN (${inClause})`,
    team: `SELECT DISTINCT u.user_id, u.first_name, u.last_name, u.email FROM users u INNER JOIN team_members tm ON tm.user_id = u.user_id AND tm.is_active = 1 WHERE u.is_active = 1 AND tm.team_id IN (${inClause})`,
    user: `SELECT user_id, first_name, last_name, email FROM users WHERE is_active = 1 AND user_id IN (${inClause})`,
    role: `SELECT user_id, first_name, last_name, email FROM users WHERE is_active = 1 AND role_id IN (${inClause})`,
  };

  const query = queryMap[audienceType];
  if (!query) return [];

  const r = await executeQuery(query, params);
  return r.recordset;
};

/**
 * Dispatch outage alerts (WhatsApp + email) — fire-and-forget.
 * @param {number} notificationId
 * @param {'published'|'resolved'} action
 */
const dispatchOutageAlerts = async (notificationId, action) => {
  try {
    // Fetch notification details
    const n = await executeQuery(`
      SELECT n.title, n.severity, n.audience_type, n.audience_data
      FROM outage_notifications n WHERE n.notification_id = @nid
    `, { nid: notificationId });
    if (!n.recordset.length) return;
    const notif = n.recordset[0];

    // Get field values for details text
    const fv = await executeQuery(`
      SELECT f.field_label, v.field_value
      FROM outage_notification_values v
      INNER JOIN outage_template_fields f ON v.field_id = f.field_id
      WHERE v.notification_id = @nid ORDER BY f.sort_order
    `, { nid: notificationId });
    const details = fv.recordset.map(r => `${r.field_label}: ${r.field_value || 'N/A'}`).join('\n');

    // Get audience users
    const users = await getAudienceUsers(notif.audience_type, notif.audience_data);
    if (!users.length) return;

    // WhatsApp alerts
    try {
      const waNotify = getWaNotify();
      if (action === 'published') {
        waNotify.notifyOutagePublished(users, { title: notif.title, severity: notif.severity, details }).catch(() => {});
      } else {
        waNotify.notifyOutageResolved(users, { title: notif.title }).catch(() => {});
      }
    } catch { /* WhatsApp service not available */ }

    // Email alerts
    try {
      const emailQueue = getEmailQueue();
      const subject = action === 'published'
        ? `🚨 Service Alert: ${notif.title}`
        : `✅ Service Restored: ${notif.title}`;
      const body = action === 'published'
        ? `<h2>Service Alert</h2><p><strong>${notif.title}</strong></p><p>Severity: <strong>${notif.severity || 'Unknown'}</strong></p><pre>${details}</pre><p>View the status wall for more details.</p>`
        : `<h2>Service Restored</h2><p><strong>${notif.title}</strong> has been resolved.</p><p>View the status wall for more details.</p>`;

      for (const u of users) {
        if (!u.email) continue;
        emailQueue.addToQueue({
          recipientEmail: u.email,
          recipientName: `${u.first_name} ${u.last_name}`.trim(),
          recipientUserId: u.user_id,
          subject,
          body,
          emailType: `outage_${action}`,
          relatedEntityType: 'outage_notification',
          relatedEntityId: notificationId,
          priority: 1,
        }).catch(() => {});
      }
    } catch { /* Email service not available */ }

    logger.info(`Outage ${action} alerts dispatched`, { notificationId, userCount: users.length });
  } catch (err) {
    logger.warn('Failed to dispatch outage alerts (non-blocking)', { notificationId, error: err.message });
  }
};

// ============================================
// TEMPLATE CRUD
// ============================================

const getTemplates = async ({ activeOnly = false } = {}) => {
  const where = activeOnly ? 'WHERE t.is_active = 1' : '';
  const result = await executeQuery(`
    SELECT t.template_id, t.template_code, t.template_name,
           t.header_color, t.icon_name, t.is_active, t.is_system,
           t.sort_order, t.created_at, t.updated_at,
           (SELECT COUNT(*) FROM outage_template_fields f WHERE f.template_id = t.template_id) AS field_count
    FROM outage_templates t
    ${where}
    ORDER BY t.sort_order, t.template_name
  `);
  return result.recordset;
};

const getTemplateById = async (templateId) => {
  const tpl = await executeQuery(`
    SELECT * FROM outage_templates WHERE template_id = @templateId
  `, { templateId });
  if (!tpl.recordset.length) return null;

  const fields = await executeQuery(`
    SELECT * FROM outage_template_fields
    WHERE template_id = @templateId
    ORDER BY sort_order, field_id
  `, { templateId });

  return { ...tpl.recordset[0], fields: fields.recordset };
};

const createTemplate = async ({ template_code, template_name, header_color, icon_name, sort_order }, userId) => {
  const result = await executeQuery(`
    INSERT INTO outage_templates (template_code, template_name, header_color, icon_name, is_system, sort_order, created_by)
    OUTPUT INSERTED.template_id
    VALUES (@code, @name, @color, @icon, 0, @sort, @userId)
  `, {
    code: template_code,
    name: template_name,
    color: header_color || '#dc2626',
    icon: icon_name || 'AlertTriangle',
    sort: sort_order || 0,
    userId,
  });
  return result.recordset[0].template_id;
};

const updateTemplate = async (templateId, { template_name, header_color, icon_name, is_active, sort_order }) => {
  await executeQuery(`
    UPDATE outage_templates
    SET template_name = COALESCE(@name, template_name),
        header_color  = COALESCE(@color, header_color),
        icon_name     = COALESCE(@icon, icon_name),
        is_active     = COALESCE(@active, is_active),
        sort_order    = COALESCE(@sort, sort_order),
        updated_at    = GETDATE()
    WHERE template_id = @templateId
  `, {
    templateId,
    name: template_name ?? null,
    color: header_color ?? null,
    icon: icon_name ?? null,
    active: is_active != null ? (is_active ? 1 : 0) : null,
    sort: sort_order ?? null,
  });
};

// ============================================
// TEMPLATE FIELDS
// ============================================

const addField = async (templateId, { field_key, field_label, field_type, is_required, sort_order, placeholder, default_value, field_options }) => {
  const result = await executeQuery(`
    INSERT INTO outage_template_fields
      (template_id, field_key, field_label, field_type, is_required, sort_order, placeholder, default_value, field_options)
    OUTPUT INSERTED.field_id
    VALUES (@tid, @key, @label, @type, @req, @sort, @ph, @def, @opts)
  `, {
    tid: templateId,
    key: field_key,
    label: field_label,
    type: field_type || 'text',
    req: is_required ? 1 : 0,
    sort: sort_order || 0,
    ph: placeholder || null,
    def: default_value || null,
    opts: field_options || null,
  });
  return result.recordset[0].field_id;
};

const updateField = async (fieldId, data) => {
  await executeQuery(`
    UPDATE outage_template_fields
    SET field_label   = COALESCE(@label, field_label),
        field_type    = COALESCE(@type, field_type),
        is_required   = COALESCE(@req, is_required),
        sort_order    = COALESCE(@sort, sort_order),
        placeholder   = COALESCE(@ph, placeholder),
        default_value = COALESCE(@def, default_value),
        field_options = COALESCE(@opts, field_options)
    WHERE field_id = @fieldId
  `, {
    fieldId,
    label: data.field_label ?? null,
    type: data.field_type ?? null,
    req: data.is_required != null ? (data.is_required ? 1 : 0) : null,
    sort: data.sort_order ?? null,
    ph: data.placeholder ?? null,
    def: data.default_value ?? null,
    opts: data.field_options ?? null,
  });
};

const deleteField = async (fieldId) => {
  await executeQuery('DELETE FROM outage_notification_values WHERE field_id = @fieldId', { fieldId });
  await executeQuery('DELETE FROM outage_template_fields WHERE field_id = @fieldId', { fieldId });
};

const replaceFields = async (templateId, fields) => {
  // Delete removed fields' values first, then fields
  await executeQuery(`
    DELETE FROM outage_notification_values
    WHERE field_id IN (SELECT field_id FROM outage_template_fields WHERE template_id = @tid)
  `, { tid: templateId });
  await executeQuery('DELETE FROM outage_template_fields WHERE template_id = @tid', { tid: templateId });

  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    await addField(templateId, { ...f, sort_order: f.sort_order ?? i + 1 });
  }
};

// ============================================
// NOTIFICATIONS LIFECYCLE
// ============================================

const createNotification = async (data, userId) => {
  const result = await executeQuery(`
    INSERT INTO outage_notifications
      (template_id, title, status, severity, audience_type, audience_data, created_by)
    OUTPUT INSERTED.notification_id
    VALUES (@tid, @title, 'draft', @severity, @audType, @audData, @userId)
  `, {
    tid: data.template_id,
    title: data.title,
    severity: data.severity || 'high',
    audType: data.audience_type || 'all',
    audData: data.audience_data ? JSON.stringify(data.audience_data) : null,
    userId,
  });
  const notificationId = result.recordset[0].notification_id;

  // Insert field values
  if (Array.isArray(data.field_values)) {
    for (const fv of data.field_values) {
      await executeQuery(`
        INSERT INTO outage_notification_values (notification_id, field_id, field_value)
        VALUES (@nid, @fid, @val)
      `, { nid: notificationId, fid: fv.field_id, val: fv.field_value || null });
    }
  }

  return notificationId;
};

const updateNotification = async (notificationId, data) => {
  await executeQuery(`
    UPDATE outage_notifications
    SET title         = COALESCE(@title, title),
        severity      = COALESCE(@severity, severity),
        audience_type = COALESCE(@audType, audience_type),
        audience_data = COALESCE(@audData, audience_data),
        updated_at    = GETDATE()
    WHERE notification_id = @nid AND status = 'draft'
  `, {
    nid: notificationId,
    title: data.title ?? null,
    severity: data.severity ?? null,
    audType: data.audience_type ?? null,
    audData: data.audience_data ? JSON.stringify(data.audience_data) : null,
  });

  // Update field values if provided
  if (Array.isArray(data.field_values)) {
    await executeQuery('DELETE FROM outage_notification_values WHERE notification_id = @nid', { nid: notificationId });
    for (const fv of data.field_values) {
      await executeQuery(`
        INSERT INTO outage_notification_values (notification_id, field_id, field_value)
        VALUES (@nid, @fid, @val)
      `, { nid: notificationId, fid: fv.field_id, val: fv.field_value || null });
    }
  }
};

const publishNotification = async (notificationId, userId) => {
  const result = await executeQuery(`
    UPDATE outage_notifications
    SET status = 'active', published_at = GETDATE(), published_by = @userId, updated_at = GETDATE()
    OUTPUT INSERTED.notification_id
    WHERE notification_id = @nid AND status = 'draft'
  `, { nid: notificationId, userId });
  if (result.recordset.length === 0) return false;

  // Fire-and-forget: dispatch WhatsApp + email alerts to audience
  dispatchOutageAlerts(notificationId, 'published').catch(() => {});
  return true;
};

const resolveNotification = async (notificationId, userId) => {
  const result = await executeQuery(`
    UPDATE outage_notifications
    SET status = 'resolved', resolved_at = GETDATE(), resolved_by = @userId, updated_at = GETDATE()
    OUTPUT INSERTED.notification_id
    WHERE notification_id = @nid AND status = 'active'
  `, { nid: notificationId, userId });
  if (result.recordset.length === 0) return false;

  // Fire-and-forget: dispatch resolve alerts to audience
  dispatchOutageAlerts(notificationId, 'resolved').catch(() => {});
  return true;
};

const cancelNotification = async (notificationId, userId) => {
  const result = await executeQuery(`
    UPDATE outage_notifications
    SET status = 'cancelled', cancelled_at = GETDATE(), cancelled_by = @userId, updated_at = GETDATE()
    OUTPUT INSERTED.notification_id
    WHERE notification_id = @nid AND status IN ('draft','active')
  `, { nid: notificationId, userId });
  return result.recordset.length > 0;
};

// ============================================
// NOTIFICATION QUERIES
// ============================================

const getNotificationById = async (notificationId) => {
  const n = await executeQuery(`
    SELECT n.*,
           t.template_code, t.template_name, t.header_color, t.icon_name,
           uc.first_name + ' ' + uc.last_name AS created_by_name,
           up.first_name + ' ' + up.last_name AS published_by_name,
           ur.first_name + ' ' + ur.last_name AS resolved_by_name
    FROM outage_notifications n
    INNER JOIN outage_templates t ON n.template_id = t.template_id
    LEFT JOIN users uc ON n.created_by = uc.user_id
    LEFT JOIN users up ON n.published_by = up.user_id
    LEFT JOIN users ur ON n.resolved_by = ur.user_id
    WHERE n.notification_id = @nid
  `, { nid: notificationId });
  if (!n.recordset.length) return null;

  const values = await executeQuery(`
    SELECT v.value_id, v.field_id, v.field_value,
           f.field_key, f.field_label, f.field_type, f.is_required, f.sort_order
    FROM outage_notification_values v
    INNER JOIN outage_template_fields f ON v.field_id = f.field_id
    WHERE v.notification_id = @nid
    ORDER BY f.sort_order
  `, { nid: notificationId });

  const viewCount = await executeQuery(`
    SELECT COUNT(*) AS cnt FROM outage_notification_views WHERE notification_id = @nid
  `, { nid: notificationId });

  return {
    ...n.recordset[0],
    field_values: values.recordset,
    view_count: viewCount.recordset[0].cnt,
  };
};

const listNotifications = async ({ status, page = 1, pageSize = 20 } = {}) => {
  let statusFilter = '';
  const params = {};

  if (status) {
    statusFilter = 'WHERE n.status = @status';
    params.status = status;
  }

  const off = (page - 1) * pageSize;
  params.off = off;
  params.rowEnd = off + pageSize;

  const data = await executeQuery(`
    SELECT n.notification_id, n.title, n.status, n.severity,
           n.audience_type, n.published_at, n.resolved_at, n.created_at,
           t.template_code, t.template_name, t.header_color, t.icon_name,
           uc.first_name + ' ' + uc.last_name AS created_by_name,
           (SELECT COUNT(*) FROM outage_notification_views v WHERE v.notification_id = n.notification_id) AS view_count,
           rn = ROW_NUMBER() OVER (ORDER BY
             CASE n.status WHEN 'active' THEN 1 WHEN 'draft' THEN 2 ELSE 3 END,
             n.created_at DESC)
    FROM outage_notifications n
    INNER JOIN outage_templates t ON n.template_id = t.template_id
    LEFT JOIN users uc ON n.created_by = uc.user_id
    ${statusFilter}
  `, params);

  const filtered = data.recordset.filter(r => r.rn > off && r.rn <= off + pageSize);

  const countResult = await executeQuery(`
    SELECT COUNT(*) AS total FROM outage_notifications n ${statusFilter}
  `, status ? { status } : {});

  return {
    notifications: filtered,
    total: countResult.recordset[0].total,
  };
};

// ============================================
// WALL FEED (audience-targeted)
// ============================================

const getWallFeed = async (userId) => {
  // Get user context
  const userCtx = await executeQuery(`
    SELECT u.user_id, u.department_id, u.location_id, u.role_id,
           r.role_code
    FROM users u
    INNER JOIN user_roles r ON u.role_id = r.role_id
    WHERE u.user_id = @userId
  `, { userId });

  if (!userCtx.recordset.length) return [];
  const user = userCtx.recordset[0];

  // Get user's teams
  const teams = await executeQuery(`
    SELECT team_id FROM team_members WHERE user_id = @userId AND is_active = 1
  `, { userId });
  const teamIds = teams.recordset.map(t => t.team_id);

  // Fetch active + recently resolved notifications (last 48h)
  const notifications = await executeQuery(`
    SELECT n.notification_id, n.title, n.status, n.severity,
           n.audience_type, n.audience_data, n.published_at, n.resolved_at,
           t.template_code, t.template_name, t.header_color, t.icon_name,
           uc.first_name + ' ' + uc.last_name AS created_by_name,
           CASE WHEN vw.view_id IS NOT NULL THEN 1 ELSE 0 END AS is_viewed
    FROM outage_notifications n
    INNER JOIN outage_templates t ON n.template_id = t.template_id
    LEFT JOIN users uc ON n.created_by = uc.user_id
    LEFT JOIN outage_notification_views vw ON vw.notification_id = n.notification_id AND vw.user_id = @userId
    WHERE (
      n.status = 'active'
      OR (n.status = 'resolved' AND n.resolved_at >= DATEADD(HOUR, -48, GETDATE()))
    )
    AND n.published_at IS NOT NULL
    ORDER BY n.severity DESC, n.published_at DESC
  `, { userId });

  // Filter by audience
  const feed = [];
  for (const n of notifications.recordset) {
    if (matchesAudience(n, user, teamIds)) {
      // Fetch field values for this notification
      const values = await executeQuery(`
        SELECT v.field_value, f.field_key, f.field_label, f.field_type, f.sort_order
        FROM outage_notification_values v
        INNER JOIN outage_template_fields f ON v.field_id = f.field_id
        WHERE v.notification_id = @nid
        ORDER BY f.sort_order
      `, { nid: n.notification_id });

      feed.push({
        ...n,
        audience_data: undefined, // Don't expose targeting data to end users
        field_values: values.recordset,
      });
    }
  }

  return feed;
};

/**
 * Check whether a user matches the notification's audience
 */
function matchesAudience(notification, user, userTeamIds) {
  const { audience_type, audience_data } = notification;

  if (audience_type === 'all') return true;

  let targets;
  try {
    targets = typeof audience_data === 'string' ? JSON.parse(audience_data) : audience_data;
  } catch {
    return true; // Fail-open: if data is corrupt, show to everyone
  }

  if (!Array.isArray(targets) || targets.length === 0) return true;

  const ids = targets.map(Number);

  switch (audience_type) {
    case 'department':
      return ids.includes(user.department_id);
    case 'location':
      return ids.includes(user.location_id);
    case 'team':
      return userTeamIds.some(tid => ids.includes(tid));
    case 'user':
      return ids.includes(user.user_id);
    case 'role':
      return ids.includes(user.role_id);
    default:
      return true;
  }
}

// ============================================
// VIEW TRACKING
// ============================================

const markViewed = async (notificationId, userId) => {
  try {
    await executeQuery(`
      IF NOT EXISTS (
        SELECT 1 FROM outage_notification_views
        WHERE notification_id = @nid AND user_id = @userId
      )
      INSERT INTO outage_notification_views (notification_id, user_id)
      VALUES (@nid, @userId)
    `, { nid: notificationId, userId });
  } catch (e) {
    // Unique constraint might fire on race condition — ignore
    if (!e.message.includes('UQ_onvw_unique')) throw e;
  }
};

const getViewStats = async (notificationId) => {
  const result = await executeQuery(`
    SELECT v.user_id, u.first_name + ' ' + u.last_name AS name,
           u.email, d.department_name, v.viewed_at
    FROM outage_notification_views v
    INNER JOIN users u ON v.user_id = u.user_id
    LEFT JOIN departments d ON u.department_id = d.department_id
    WHERE v.notification_id = @nid
    ORDER BY v.viewed_at DESC
  `, { nid: notificationId });
  return result.recordset;
};

// ============================================
// ACCESS CONTROL
// ============================================

const getUserAccess = async (userId) => {
  const result = await executeQuery(`
    SELECT can_view_wall, can_publish, can_manage
    FROM outage_access_control
    WHERE user_id = @userId
  `, { userId });
  if (result.recordset.length === 0) {
    return { can_view_wall: true, can_publish: false, can_manage: false };
  }
  return result.recordset[0];
};

const setUserAccess = async (targetUserId, { can_view_wall, can_publish, can_manage }, updatedBy) => {
  // Upsert
  const exists = await executeQuery(
    'SELECT 1 FROM outage_access_control WHERE user_id = @uid', { uid: targetUserId }
  );

  if (exists.recordset.length > 0) {
    await executeQuery(`
      UPDATE outage_access_control
      SET can_view_wall = @view, can_publish = @pub, can_manage = @mgmt,
          updated_by = @updBy, updated_at = GETDATE()
      WHERE user_id = @uid
    `, {
      uid: targetUserId,
      view: can_view_wall ? 1 : 0,
      pub: can_publish ? 1 : 0,
      mgmt: can_manage ? 1 : 0,
      updBy: updatedBy,
    });
  } else {
    await executeQuery(`
      INSERT INTO outage_access_control (user_id, can_view_wall, can_publish, can_manage, updated_by)
      VALUES (@uid, @view, @pub, @mgmt, @updBy)
    `, {
      uid: targetUserId,
      view: can_view_wall ? 1 : 0,
      pub: can_publish ? 1 : 0,
      mgmt: can_manage ? 1 : 0,
      updBy: updatedBy,
    });
  }
};

const listAccessControl = async ({ page = 1, pageSize = 50, search } = {}) => {
  const off = (page - 1) * pageSize;
  let searchClause = '';
  const params = { off, rowEnd: off + pageSize };

  if (search) {
    searchClause = `AND (u.first_name + ' ' + u.last_name LIKE '%' + @search + '%' OR u.email LIKE '%' + @search + '%')`;
    params.search = search;
  }

  const data = await executeQuery(`
    SELECT u.user_id, u.first_name + ' ' + u.last_name AS name, u.email,
           r.role_name, d.department_name,
           ISNULL(oac.can_view_wall, 1) AS can_view_wall,
           ISNULL(oac.can_publish, 0) AS can_publish,
           ISNULL(oac.can_manage, 0) AS can_manage,
           rn = ROW_NUMBER() OVER (ORDER BY u.first_name, u.last_name)
    FROM users u
    INNER JOIN user_roles r ON u.role_id = r.role_id
    LEFT JOIN departments d ON u.department_id = d.department_id
    LEFT JOIN outage_access_control oac ON oac.user_id = u.user_id
    WHERE u.is_active = 1 ${searchClause}
  `, params);

  const rows = data.recordset.filter(r => r.rn > off && r.rn <= off + pageSize);

  const countResult = await executeQuery(`
    SELECT COUNT(*) AS total FROM users u WHERE u.is_active = 1
    ${search ? "AND (u.first_name + ' ' + u.last_name LIKE '%' + @search + '%' OR u.email LIKE '%' + @search + '%')" : ''}
  `, search ? { search } : {});

  return { users: rows, total: countResult.recordset[0].total };
};

// ============================================
// AUDIENCE PREVIEW
// ============================================

const previewAudience = async (audienceType, audienceData) => {
  let targets;
  try {
    targets = typeof audienceData === 'string' ? JSON.parse(audienceData) : audienceData;
  } catch {
    targets = [];
  }

  if (audienceType === 'all' || !targets || !targets.length) {
    const result = await executeQuery('SELECT COUNT(*) AS cnt FROM users WHERE is_active = 1');
    return { count: result.recordset[0].cnt, sample: [] };
  }

  const ids = Array.isArray(targets) ? targets.map(Number) : [];
  const keys = [];
  const params = {};
  ids.forEach((id, i) => {
    const k = `id${i}`;
    keys.push(`@${k}`);
    params[k] = id;
  });
  const inClause = keys.join(',');

  let query;
  switch (audienceType) {
    case 'department':
      query = `SELECT u.user_id, u.first_name + ' ' + u.last_name AS name, u.email
               FROM users u WHERE u.is_active = 1 AND u.department_id IN (${inClause})`;
      break;
    case 'location':
      query = `SELECT u.user_id, u.first_name + ' ' + u.last_name AS name, u.email
               FROM users u WHERE u.is_active = 1 AND u.location_id IN (${inClause})`;
      break;
    case 'team':
      query = `SELECT DISTINCT u.user_id, u.first_name + ' ' + u.last_name AS name, u.email
               FROM users u
               INNER JOIN team_members tm ON tm.user_id = u.user_id AND tm.is_active = 1
               WHERE u.is_active = 1 AND tm.team_id IN (${inClause})`;
      break;
    case 'user':
      query = `SELECT u.user_id, u.first_name + ' ' + u.last_name AS name, u.email
               FROM users u WHERE u.is_active = 1 AND u.user_id IN (${inClause})`;
      break;
    case 'role':
      query = `SELECT u.user_id, u.first_name + ' ' + u.last_name AS name, u.email
               FROM users u WHERE u.is_active = 1 AND u.role_id IN (${inClause})`;
      break;
    default:
      return { count: 0, sample: [] };
  }

  const result = await executeQuery(query, params);
  return {
    count: result.recordset.length,
    sample: result.recordset.slice(0, 10),
  };
};

// ============================================
// AUDIT LOGGING
// ============================================

const logAudit = async ({ notification_id, template_id, action, actor_id, details, ip_address }) => {
  await executeQuery(`
    INSERT INTO outage_audit_log (notification_id, template_id, action, actor_id, details, ip_address)
    VALUES (@nid, @tid, @action, @actorId, @details, @ip)
  `, {
    nid: notification_id || null,
    tid: template_id || null,
    action,
    actorId: actor_id,
    details: details ? JSON.stringify(details) : null,
    ip: ip_address || null,
  });
};

// ============================================
// STATS / DASHBOARD
// ============================================

const getOutageStats = async () => {
  const result = await executeQuery(`
    SELECT
      (SELECT COUNT(*) FROM outage_notifications WHERE status = 'active') AS active_count,
      (SELECT COUNT(*) FROM outage_notifications WHERE status = 'draft') AS draft_count,
      (SELECT COUNT(*) FROM outage_notifications WHERE status = 'resolved') AS resolved_count,
      (SELECT COUNT(*) FROM outage_notifications WHERE status = 'cancelled') AS cancelled_count,
      (SELECT COUNT(*) FROM outage_templates WHERE is_active = 1) AS template_count
  `);
  return result.recordset[0];
};

module.exports = {
  // Templates
  getTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  addField,
  updateField,
  deleteField,
  replaceFields,
  // Notifications
  createNotification,
  updateNotification,
  publishNotification,
  resolveNotification,
  cancelNotification,
  getNotificationById,
  listNotifications,
  // Wall
  getWallFeed,
  // Views
  markViewed,
  getViewStats,
  // Access
  getUserAccess,
  setUserAccess,
  listAccessControl,
  // Audience
  previewAudience,
  // Audit
  logAudit,
  // Stats
  getOutageStats,
};

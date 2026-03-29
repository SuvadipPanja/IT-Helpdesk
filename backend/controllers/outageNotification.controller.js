/**
 * ============================================
 * Outage Notification Controller
 * Handles all REST endpoints for outage templates,
 * notifications, wall feed, access control, stats.
 * ============================================
 */

const { createResponse, getPaginationMeta } = require('../utils/helpers');
const logger = require('../utils/logger');
const outageService = require('../services/outageNotificationService');
const { getClientIp } = require('../utils/clientIp');

// ============================================
// TEMPLATE ENDPOINTS
// ============================================

/**
 * GET /api/v1/outage/templates
 */
const getTemplates = async (req, res, next) => {
  try {
    const activeOnly = req.query.active_only === 'true';
    const templates = await outageService.getTemplates({ activeOnly });
    return res.json(createResponse(true, 'Templates retrieved', templates));
  } catch (e) {
    logger.error('getTemplates', e);
    next(e);
  }
};

/**
 * GET /api/v1/outage/templates/:id
 */
const getTemplateById = async (req, res, next) => {
  try {
    const template = await outageService.getTemplateById(req.params.id);
    if (!template) {
      return res.status(404).json(createResponse(false, 'Template not found'));
    }
    return res.json(createResponse(true, 'Template retrieved', template));
  } catch (e) {
    logger.error('getTemplateById', e);
    next(e);
  }
};

/**
 * POST /api/v1/outage/templates
 */
const createTemplate = async (req, res, next) => {
  try {
    const { template_code, template_name, header_color, icon_name, sort_order, fields } = req.body;

    if (!template_code || !template_name) {
      return res.status(400).json(createResponse(false, 'template_code and template_name are required'));
    }

    const templateId = await outageService.createTemplate(
      { template_code, template_name, header_color, icon_name, sort_order },
      req.user.user_id
    );

    // Add fields if provided
    if (Array.isArray(fields) && fields.length > 0) {
      for (let i = 0; i < fields.length; i++) {
        await outageService.addField(templateId, { ...fields[i], sort_order: fields[i].sort_order ?? i + 1 });
      }
    }

    await outageService.logAudit({
      template_id: templateId,
      action: 'TEMPLATE_CREATED',
      actor_id: req.user.user_id,
      details: { template_code, template_name },
      ip_address: getClientIp(req),
    });

    logger.info('Template created', { templateId, by: req.user.user_id });
    return res.status(201).json(createResponse(true, 'Template created', { template_id: templateId }));
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) {
      return res.status(409).json(createResponse(false, 'Template code already exists'));
    }
    logger.error('createTemplate', e);
    next(e);
  }
};

/**
 * PUT /api/v1/outage/templates/:id
 */
const updateTemplate = async (req, res, next) => {
  try {
    const templateId = req.params.id;
    const existing = await outageService.getTemplateById(templateId);
    if (!existing) {
      return res.status(404).json(createResponse(false, 'Template not found'));
    }

    const { template_name, header_color, icon_name, is_active, sort_order, fields } = req.body;

    await outageService.updateTemplate(templateId, { template_name, header_color, icon_name, is_active, sort_order });

    // Replace fields if provided
    if (Array.isArray(fields)) {
      await outageService.replaceFields(templateId, fields);
    }

    await outageService.logAudit({
      template_id: parseInt(templateId),
      action: 'TEMPLATE_UPDATED',
      actor_id: req.user.user_id,
      details: { template_name, is_active },
      ip_address: getClientIp(req),
    });

    return res.json(createResponse(true, 'Template updated'));
  } catch (e) {
    logger.error('updateTemplate', e);
    next(e);
  }
};

// ============================================
// NOTIFICATION ENDPOINTS
// ============================================

/**
 * GET /api/v1/outage/notifications
 */
const listNotifications = async (req, res, next) => {
  try {
    const status = req.query.status || null;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;

    const { notifications, total } = await outageService.listNotifications({ status, page, pageSize });
    const pagination = getPaginationMeta(total, page, pageSize);

    return res.json(createResponse(true, 'Notifications retrieved', { notifications, pagination }));
  } catch (e) {
    logger.error('listNotifications', e);
    next(e);
  }
};

/**
 * GET /api/v1/outage/notifications/:id
 */
const getNotification = async (req, res, next) => {
  try {
    const notification = await outageService.getNotificationById(req.params.id);
    if (!notification) {
      return res.status(404).json(createResponse(false, 'Notification not found'));
    }
    return res.json(createResponse(true, 'Notification retrieved', notification));
  } catch (e) {
    logger.error('getNotification', e);
    next(e);
  }
};

/**
 * POST /api/v1/outage/notifications
 */
const createNotification = async (req, res, next) => {
  try {
    const { template_id, title, severity, audience_type, audience_data, field_values } = req.body;

    if (!template_id || !title) {
      return res.status(400).json(createResponse(false, 'template_id and title are required'));
    }

    // Verify template exists
    const template = await outageService.getTemplateById(template_id);
    if (!template) {
      return res.status(404).json(createResponse(false, 'Template not found'));
    }

    const notificationId = await outageService.createNotification(
      { template_id, title, severity, audience_type, audience_data, field_values },
      req.user.user_id
    );

    await outageService.logAudit({
      notification_id: notificationId,
      action: 'NOTIFICATION_CREATED',
      actor_id: req.user.user_id,
      details: { title, severity, audience_type },
      ip_address: getClientIp(req),
    });

    logger.info('Notification created', { notificationId, by: req.user.user_id });
    return res.status(201).json(createResponse(true, 'Notification created', { notification_id: notificationId }));
  } catch (e) {
    logger.error('createNotification', e);
    next(e);
  }
};

/**
 * PUT /api/v1/outage/notifications/:id
 */
const updateNotificationHandler = async (req, res, next) => {
  try {
    const notificationId = req.params.id;
    const existing = await outageService.getNotificationById(notificationId);
    if (!existing) {
      return res.status(404).json(createResponse(false, 'Notification not found'));
    }
    if (existing.status !== 'draft') {
      return res.status(400).json(createResponse(false, 'Only draft notifications can be edited'));
    }

    await outageService.updateNotification(notificationId, req.body);

    await outageService.logAudit({
      notification_id: parseInt(notificationId),
      action: 'NOTIFICATION_UPDATED',
      actor_id: req.user.user_id,
      details: { title: req.body.title },
      ip_address: getClientIp(req),
    });

    return res.json(createResponse(true, 'Notification updated'));
  } catch (e) {
    logger.error('updateNotification', e);
    next(e);
  }
};

/**
 * POST /api/v1/outage/notifications/:id/publish
 */
const publishNotification = async (req, res, next) => {
  try {
    const notificationId = req.params.id;
    const ok = await outageService.publishNotification(notificationId, req.user.user_id);
    if (!ok) {
      return res.status(400).json(createResponse(false, 'Could not publish. Notification may not be in draft status.'));
    }

    await outageService.logAudit({
      notification_id: parseInt(notificationId),
      action: 'NOTIFICATION_PUBLISHED',
      actor_id: req.user.user_id,
      ip_address: getClientIp(req),
    });

    logger.info('Notification published', { notificationId, by: req.user.user_id });
    return res.json(createResponse(true, 'Notification published'));
  } catch (e) {
    logger.error('publishNotification', e);
    next(e);
  }
};

/**
 * POST /api/v1/outage/notifications/:id/resolve
 */
const resolveNotification = async (req, res, next) => {
  try {
    const notificationId = req.params.id;
    const ok = await outageService.resolveNotification(notificationId, req.user.user_id);
    if (!ok) {
      return res.status(400).json(createResponse(false, 'Could not resolve. Notification may not be active.'));
    }

    await outageService.logAudit({
      notification_id: parseInt(notificationId),
      action: 'NOTIFICATION_RESOLVED',
      actor_id: req.user.user_id,
      ip_address: getClientIp(req),
    });

    logger.info('Notification resolved', { notificationId, by: req.user.user_id });
    return res.json(createResponse(true, 'Notification resolved'));
  } catch (e) {
    logger.error('resolveNotification', e);
    next(e);
  }
};

/**
 * POST /api/v1/outage/notifications/:id/cancel
 */
const cancelNotification = async (req, res, next) => {
  try {
    const notificationId = req.params.id;
    const ok = await outageService.cancelNotification(notificationId, req.user.user_id);
    if (!ok) {
      return res.status(400).json(createResponse(false, 'Could not cancel notification.'));
    }

    await outageService.logAudit({
      notification_id: parseInt(notificationId),
      action: 'NOTIFICATION_CANCELLED',
      actor_id: req.user.user_id,
      ip_address: getClientIp(req),
    });

    return res.json(createResponse(true, 'Notification cancelled'));
  } catch (e) {
    logger.error('cancelNotification', e);
    next(e);
  }
};

// ============================================
// WALL FEED (end users)
// ============================================

/**
 * GET /api/v1/outage/wall
 */
const getWallFeed = async (req, res, next) => {
  try {
    const feed = await outageService.getWallFeed(req.user.user_id);
    return res.json(createResponse(true, 'Wall feed', feed));
  } catch (e) {
    logger.error('getWallFeed', e);
    next(e);
  }
};

/**
 * POST /api/v1/outage/wall/:id/view
 */
const markViewed = async (req, res, next) => {
  try {
    await outageService.markViewed(req.params.id, req.user.user_id);
    return res.json(createResponse(true, 'View recorded'));
  } catch (e) {
    logger.error('markViewed', e);
    next(e);
  }
};

/**
 * GET /api/v1/outage/notifications/:id/views
 */
const getViewStats = async (req, res, next) => {
  try {
    const views = await outageService.getViewStats(req.params.id);
    return res.json(createResponse(true, 'View stats', views));
  } catch (e) {
    logger.error('getViewStats', e);
    next(e);
  }
};

// ============================================
// ACCESS CONTROL
// ============================================

/**
 * GET /api/v1/outage/access
 */
const listAccess = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 50;
    const search = req.query.search || null;

    const { users, total } = await outageService.listAccessControl({ page, pageSize, search });
    const pagination = getPaginationMeta(total, page, pageSize);

    return res.json(createResponse(true, 'Access list', { users, pagination }));
  } catch (e) {
    logger.error('listAccess', e);
    next(e);
  }
};

/**
 * GET /api/v1/outage/access/me
 */
const getMyAccess = async (req, res, next) => {
  try {
    const access = await outageService.getUserAccess(req.user.user_id);
    return res.json(createResponse(true, 'Your access', access));
  } catch (e) {
    logger.error('getMyAccess', e);
    next(e);
  }
};

/**
 * PUT /api/v1/outage/access/:userId
 */
const setAccess = async (req, res, next) => {
  try {
    const targetUserId = req.params.userId;
    const { can_view_wall, can_publish, can_manage } = req.body;

    await outageService.setUserAccess(
      targetUserId,
      {
        can_view_wall: can_view_wall !== false,
        can_publish: !!can_publish,
        can_manage: !!can_manage,
      },
      req.user.user_id
    );

    await outageService.logAudit({
      action: 'ACCESS_UPDATED',
      actor_id: req.user.user_id,
      details: { target_user_id: targetUserId, can_view_wall, can_publish, can_manage },
      ip_address: getClientIp(req),
    });

    return res.json(createResponse(true, 'Access updated'));
  } catch (e) {
    logger.error('setAccess', e);
    next(e);
  }
};

// ============================================
// AUDIENCE PREVIEW
// ============================================

/**
 * POST /api/v1/outage/audience-preview
 */
const audiencePreview = async (req, res, next) => {
  try {
    const { audience_type, audience_data } = req.body;
    if (!audience_type) {
      return res.status(400).json(createResponse(false, 'audience_type is required'));
    }
    const result = await outageService.previewAudience(audience_type, audience_data);
    return res.json(createResponse(true, 'Audience preview', result));
  } catch (e) {
    logger.error('audiencePreview', e);
    next(e);
  }
};

// ============================================
// STATS
// ============================================

/**
 * GET /api/v1/outage/stats
 */
const getStats = async (req, res, next) => {
  try {
    const stats = await outageService.getOutageStats();
    return res.json(createResponse(true, 'Outage stats', stats));
  } catch (e) {
    logger.error('getStats', e);
    next(e);
  }
};

// ============================================
// FILTER OPTIONS (for reports)
// ============================================

/**
 * GET /api/v1/outage/filter-options
 */
const getFilterOptions = async (req, res, next) => {
  try {
    const [departments, locations, teams, templates] = await Promise.all([
      require('../config/database').executeQuery(
        'SELECT department_id, department_name FROM departments WHERE is_active = 1 ORDER BY department_name'
      ),
      require('../config/database').executeQuery(
        'SELECT location_id, location_name FROM locations WHERE is_active = 1 ORDER BY location_name'
      ),
      require('../config/database').executeQuery(
        'SELECT team_id, team_name FROM teams WHERE is_active = 1 ORDER BY team_name'
      ),
      require('../config/database').executeQuery(
        'SELECT template_id, template_name FROM outage_templates WHERE is_active = 1 ORDER BY sort_order'
      ),
    ]);

    return res.json(createResponse(true, 'Filter options', {
      departments: departments.recordset,
      locations: locations.recordset,
      teams: teams.recordset,
      templates: templates.recordset,
    }));
  } catch (e) {
    logger.error('getFilterOptions', e);
    next(e);
  }
};

module.exports = {
  getTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  listNotifications,
  getNotification,
  createNotification,
  updateNotification: updateNotificationHandler,
  publishNotification,
  resolveNotification,
  cancelNotification,
  getWallFeed,
  markViewed,
  getViewStats,
  listAccess,
  getMyAccess,
  setAccess,
  audiencePreview,
  getStats,
  getFilterOptions,
};

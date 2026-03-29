/**
 * ============================================
 * Outage Notification Routes
 * RESTful endpoints for outage management
 * ============================================
 */

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/outageNotification.controller');
const outageService = require('../services/outageNotificationService');

// All routes require authentication
router.use(authenticate);

// ============================================
// ACCESS MIDDLEWARE
// ============================================

/**
 * Check outage publish permission (can_publish or can_manage)
 */
const requirePublish = async (req, res, next) => {
  try {
    const access = await outageService.getUserAccess(req.user.user_id);
    if (!access.can_publish && !access.can_manage) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to publish outage notifications',
      });
    }
    req.outageAccess = access;
    next();
  } catch (e) {
    next(e);
  }
};

/**
 * Check outage admin/manage permission
 */
const requireManage = async (req, res, next) => {
  try {
    const access = await outageService.getUserAccess(req.user.user_id);
    if (!access.can_manage) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to manage outage templates',
      });
    }
    req.outageAccess = access;
    next();
  } catch (e) {
    next(e);
  }
};

/**
 * Check wall view permission
 */
const requireView = async (req, res, next) => {
  try {
    const access = await outageService.getUserAccess(req.user.user_id);
    if (!access.can_view_wall && !access.can_publish && !access.can_manage) {
      return res.status(403).json({
        success: false,
        message: 'You do not have access to the outage wall',
      });
    }
    req.outageAccess = access;
    next();
  } catch (e) {
    next(e);
  }
};

// ============================================
// TEMPLATE ROUTES (admin/manage only)
// ============================================
router.get('/templates', requirePublish, ctrl.getTemplates);
router.get('/templates/:id', requirePublish, ctrl.getTemplateById);
router.post('/templates', requireManage, ctrl.createTemplate);
router.put('/templates/:id', requireManage, ctrl.updateTemplate);

// ============================================
// NOTIFICATION ROUTES (publisher + admin)
// ============================================
router.get('/notifications', requirePublish, ctrl.listNotifications);
router.get('/notifications/:id', requirePublish, ctrl.getNotification);
router.post('/notifications', requirePublish, ctrl.createNotification);
router.put('/notifications/:id', requirePublish, ctrl.updateNotification);
router.post('/notifications/:id/publish', requirePublish, ctrl.publishNotification);
router.post('/notifications/:id/resolve', requirePublish, ctrl.resolveNotification);
router.post('/notifications/:id/cancel', requirePublish, ctrl.cancelNotification);
router.get('/notifications/:id/views', requirePublish, ctrl.getViewStats);

// ============================================
// WALL ROUTES (end user - view permission)
// ============================================
router.get('/wall', requireView, ctrl.getWallFeed);
router.post('/wall/:id/view', requireView, ctrl.markViewed);

// ============================================
// ACCESS CONTROL (admin/manage only)
// ============================================
router.get('/access', requireManage, ctrl.listAccess);
router.get('/access/me', ctrl.getMyAccess);
router.put('/access/:userId', requireManage, ctrl.setAccess);

// ============================================
// AUDIENCE PREVIEW (publisher + admin)
// ============================================
router.post('/audience-preview', requirePublish, ctrl.audiencePreview);

// ============================================
// STATS & FILTERS
// ============================================
router.get('/stats', requirePublish, ctrl.getStats);
router.get('/filter-options', requirePublish, ctrl.getFilterOptions);

module.exports = router;

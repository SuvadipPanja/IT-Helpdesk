// ============================================
// SETTINGS ROUTES
// All routes for system settings management
// ============================================

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  getPublicSettings,
  getAllSettings,
  getSettingsByCategory,
  getSetting,
  updateSetting,
  updateMultipleSettings,
  testSmtpConnection,
  sendTestEmail,
  clearCache,
} = require('../controllers/settings.controller');

// ============================================
// PUBLIC ROUTE (NO AUTHENTICATION REQUIRED)
// MUST BE FIRST TO AVOID ROUTE CONFLICTS
// ============================================

// @route   GET /api/v1/settings/public
// @desc    Get public settings (for login page)
// @access  Public (No authentication)
router.get('/public', getPublicSettings);

// ============================================
// ALL ROUTES BELOW REQUIRE AUTHENTICATION
// Admin-only permission checked in controller
// ============================================

// @route   GET /api/v1/settings
// @desc    Get all settings grouped by category
// @access  Private (Admin only - checked in controller)
router.get('/', authenticate, authorize('can_manage_system'), getAllSettings);

// @route   GET /api/v1/settings/category/:category
// @desc    Get all settings for a specific category
// @access  Private (Admin only - checked in controller)
router.get('/category/:category', authenticate, authorize('can_manage_system'), getSettingsByCategory);

// @route   POST /api/v1/settings/test-smtp
// @desc    Test SMTP connection
// @access  Private (Admin only - checked in controller)
router.post('/test-smtp', authenticate, authorize('can_manage_system'), testSmtpConnection);

// @route   POST /api/v1/settings/send-test-email
// @desc    Send test email
// @access  Private (Admin only - checked in controller)
router.post('/send-test-email', authenticate, authorize('can_manage_system'), sendTestEmail);

// @route   POST /api/v1/settings/clear-cache
// @desc    Clear settings cache and reload
// @access  Private (Admin only - checked in controller)
router.post('/clear-cache', authenticate, authorize('can_manage_system'), clearCache);

// @route   PUT /api/v1/settings/bulk
// @desc    Update multiple settings at once
// @access  Private (Admin only - checked in controller)
router.put('/bulk', authenticate, authorize('can_manage_system'), updateMultipleSettings);

// @route   GET /api/v1/settings/:key
// @desc    Get single setting by key
// @access  Private (Admin only - checked in controller)
router.get('/:key', authenticate, authorize('can_manage_system'), getSetting);

// @route   PUT /api/v1/settings/:key
// @desc    Update single setting
// @access  Private (Admin only - checked in controller)
router.put('/:key', authenticate, authorize('can_manage_system'), updateSetting);

// ============================================
// EXPORT ROUTER
// ============================================
module.exports = router;
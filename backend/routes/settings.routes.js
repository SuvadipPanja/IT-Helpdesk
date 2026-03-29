// ============================================
// SETTINGS ROUTES
// All routes for system settings management
// ============================================

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate, authorize, authorizeAny } = require('../middleware/auth');
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
  getRateLimitConfig,
  reloadRateLimitConfig,
  uploadLogo,
  deleteLogo,
  getBotConfig,
  updateBotConfig,
  uploadBotIcon,
  deleteBotIcon,
  getFullBotConfig,
  updateBotGreeting,
  updateBotDefaultContext,
  updateBotIntelligence,
} = require('../controllers/settings.controller');

// ============================================
// LOGO UPLOAD MULTER CONFIG
// ============================================
const brandingDir = path.join(__dirname, '../uploads/branding');
if (!fs.existsSync(brandingDir)) {
  fs.mkdirSync(brandingDir, { recursive: true });
}

const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, brandingDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `logo_${Date.now()}${ext}`);
  }
});

const logoUpload = multer({
  storage: logoStorage,
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|svg|webp|gif/;
    const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowed.test(file.mimetype) || file.mimetype === 'image/svg+xml';
    if (extOk && mimeOk) cb(null, true);
    else cb(new Error('Only image files are allowed (jpeg, jpg, png, svg, webp, gif)'));
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

const botIconStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, brandingDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `bot_icon_${Date.now()}${ext}`);
  }
});

const botIconUpload = multer({
  storage: botIconStorage,
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|svg|webp|gif/;
    const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowed.test(file.mimetype) || file.mimetype === 'image/svg+xml';
    if (extOk && mimeOk) cb(null, true);
    else cb(new Error('Only image files are allowed (jpeg, jpg, png, svg, webp, gif)'));
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

// ============================================
// PUBLIC ROUTE (NO AUTHENTICATION REQUIRED)
// MUST BE FIRST TO AVOID ROUTE CONFLICTS
// ============================================

// @route   GET /api/v1/settings/public
// @desc    Get public settings (for login page)
// @access  Public (No authentication)
router.get('/public', getPublicSettings);

// ============================================
// GRANULAR SETTINGS PERMISSIONS
// Users with can_manage_system bypass all checks (backward compat).
// Otherwise each route group requires its specific permission.
// ============================================
const ANY_SETTINGS = [
  'can_manage_system',
  'can_manage_settings_general',
  'can_manage_settings_email',
  'can_manage_settings_tickets',
  'can_manage_settings_sla',
  'can_manage_settings_security',
  'can_manage_settings_bot',
  'can_manage_settings_license',
  'can_manage_settings_backup',
];
const GENERAL_PERMS   = ['can_manage_system', 'can_manage_settings_general'];
const EMAIL_PERMS     = ['can_manage_system', 'can_manage_settings_email'];
const TICKETS_PERMS   = ['can_manage_system', 'can_manage_settings_tickets'];
const SLA_PERMS       = ['can_manage_system', 'can_manage_settings_sla'];
const SECURITY_PERMS  = ['can_manage_system', 'can_manage_settings_security'];
const BOT_PERMS       = ['can_manage_system', 'can_manage_settings_bot'];
const LICENSE_PERMS   = ['can_manage_system', 'can_manage_settings_license'];
const BACKUP_PERMS    = ['can_manage_system', 'can_manage_settings_backup'];

// ============================================
// ALL ROUTES BELOW REQUIRE AUTHENTICATION
// ============================================

// @route   GET /api/v1/settings
// @desc    Get all settings grouped by category
// @access  Private (any settings permission)
router.get('/', authenticate, authorizeAny(ANY_SETTINGS), getAllSettings);

// @route   GET /api/v1/settings/category/:category
// @desc    Get all settings for a specific category
// @access  Private (any settings permission)
router.get('/category/:category', authenticate, authorizeAny(ANY_SETTINGS), getSettingsByCategory);

// @route   POST /api/v1/settings/test-smtp
// @desc    Test SMTP connection
// @access  Private (email settings permission)
router.post('/test-smtp', authenticate, authorizeAny(EMAIL_PERMS), testSmtpConnection);

// @route   POST /api/v1/settings/send-test-email
// @desc    Send test email
// @access  Private (email settings permission)
router.post('/send-test-email', authenticate, authorizeAny(EMAIL_PERMS), sendTestEmail);

// @route   POST /api/v1/settings/clear-cache
// @desc    Clear settings cache and reload
// @access  Private (any settings permission)
router.post('/clear-cache', authenticate, authorizeAny(ANY_SETTINGS), clearCache);

// @route   GET /api/v1/settings/rate-limits
// @desc    Get current runtime rate limit configuration
// @access  Private (security settings permission)
router.get('/rate-limits', authenticate, authorizeAny(SECURITY_PERMS), getRateLimitConfig);

// @route   POST /api/v1/settings/rate-limits/reload
// @desc    Reload rate limit configuration from DB (after admin changes)
// @access  Private (security settings permission)
router.post('/rate-limits/reload', authenticate, authorizeAny(SECURITY_PERMS), reloadRateLimitConfig);

// @route   POST /api/v1/settings/logo
// @desc    Upload system logo
// @access  Private (general settings permission)
router.post('/logo', authenticate, authorizeAny(GENERAL_PERMS), logoUpload.single('logo'), uploadLogo);

// @route   DELETE /api/v1/settings/logo
// @desc    Reset logo to default
// @access  Private (general settings permission)
router.delete('/logo', authenticate, authorizeAny(GENERAL_PERMS), deleteLogo);

// @route   GET /api/v1/settings/bot-config
// @desc    Get bot name and icon settings
// @access  Private (bot settings permission)
router.get('/bot-config', authenticate, authorizeAny(BOT_PERMS), getBotConfig);

// @route   PUT /api/v1/settings/bot-config
// @desc    Update bot name setting
// @access  Private (bot settings permission)
router.put('/bot-config', authenticate, authorizeAny(BOT_PERMS), updateBotConfig);

// @route   POST /api/v1/settings/bot-icon
// @desc    Upload bot icon image
// @access  Private (bot settings permission)
router.post('/bot-icon', authenticate, authorizeAny(BOT_PERMS), botIconUpload.single('bot_icon'), uploadBotIcon);

// @route   DELETE /api/v1/settings/bot-icon
// @desc    Reset bot icon to default
// @access  Private (bot settings permission)
router.delete('/bot-icon', authenticate, authorizeAny(BOT_PERMS), deleteBotIcon);

// @route   GET /api/v1/settings/bot/full-config
// @desc    Get complete bot configuration (name, greeting, context, intelligence)
// @access  Private (bot settings permission)
router.get('/bot/full-config', authenticate, authorizeAny(BOT_PERMS), getFullBotConfig);

// @route   POST /api/v1/settings/bot/greeting
// @desc    Update bot greeting message
// @access  Private (bot settings permission)
router.post('/bot/greeting', authenticate, authorizeAny(BOT_PERMS), updateBotGreeting);

// @route   POST /api/v1/settings/bot/context
// @desc    Update bot default context
// @access  Private (bot settings permission)
router.post('/bot/context', authenticate, authorizeAny(BOT_PERMS), updateBotDefaultContext);

// @route   POST /api/v1/settings/bot/intelligence
// @desc    Update bot intelligence settings
// @access  Private (bot settings permission)
router.post('/bot/intelligence', authenticate, authorizeAny(BOT_PERMS), updateBotIntelligence);

// @route   PUT /api/v1/settings/bulk
// @desc    Update multiple settings at once
// @access  Private (any settings permission - controller validates individual keys)
router.put('/bulk', authenticate, authorizeAny(ANY_SETTINGS), updateMultipleSettings);

// @route   GET /api/v1/settings/:key
// @desc    Get single setting by key
// @access  Private (any settings permission)
router.get('/:key', authenticate, authorizeAny(ANY_SETTINGS), getSetting);

// @route   PUT /api/v1/settings/:key
// @desc    Update single setting
// @access  Private (any settings permission - controller validates key category)
router.put('/:key', authenticate, authorizeAny(ANY_SETTINGS), updateSetting);

// ============================================
// EXPORT ROUTER
// ============================================
module.exports = router;
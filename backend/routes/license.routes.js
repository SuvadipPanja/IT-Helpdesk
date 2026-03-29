// ============================================
// LICENSE ROUTES
// Offline signed license management
// ============================================

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { licenseRecoveryLimiter } = require('../middleware/rateLimiter');
const {
  getPublicLicenseStatus,
  getLicenseStatus,
  getClientLicenseState,
  getRecoveryContext,
  installLicense,
  installLicenseWithRecovery,
  refreshLicenseState,
} = require('../controllers/license.controller');

// Public status endpoint for login page / lock screen
router.get('/public-status', getPublicLicenseStatus);
router.get('/client-state', authenticate, getClientLicenseState);
router.get('/recovery-context', getRecoveryContext);
router.post('/recovery/install', licenseRecoveryLimiter, installLicenseWithRecovery);

// Admin endpoints
router.get('/status', authenticate, authorize('can_manage_settings_license'), getLicenseStatus);
router.post('/install', authenticate, authorize('can_manage_settings_license'), installLicense);
router.post('/refresh-state', authenticate, authorize('can_manage_settings_license'), refreshLicenseState);

module.exports = router;

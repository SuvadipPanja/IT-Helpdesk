// ============================================
// SECURITY ROUTES
// Routes for security settings endpoints
// ============================================
// Developer: Suvadip Panja
// Created: November 08, 2025
// File: backend/routes/securityRoutes.js
// ============================================

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  getSecuritySettings,
  getPasswordPolicy,
  getSessionSettings,
  getAccountSecuritySettings
} = require('../controllers/securityController');

// ============================================
// SECURITY ROUTES (All require authentication)
// ============================================

/**
 * @route   GET /api/v1/security/settings
 * @desc    Get all security settings (password policy, session, account security)
 * @access  Private (requires can_manage_settings_security)
 * @returns All security settings from database
 */
router.get('/settings', authenticate, authorize('can_manage_settings_security'), getSecuritySettings);

/**
 * @route   GET /api/v1/security/password-policy
 * @desc    Get password policy settings only
 * @access  Private (all authenticated users - needed for password change UI)
 * @returns Password policy settings
 */
router.get('/password-policy', authenticate, getPasswordPolicy);

/**
 * @route   GET /api/v1/security/session-settings
 * @desc    Get session management settings only
 * @access  Private (requires can_manage_settings_security)
 * @returns Session management settings
 */
router.get('/session-settings', authenticate, authorize('can_manage_settings_security'), getSessionSettings);

/**
 * @route   GET /api/v1/security/account-settings
 * @desc    Get account security settings only
 * @access  Private (requires can_manage_settings_security)
 * @returns Account security settings
 */
router.get('/account-settings', authenticate, authorize('can_manage_settings_security'), getAccountSecuritySettings);

module.exports = router;


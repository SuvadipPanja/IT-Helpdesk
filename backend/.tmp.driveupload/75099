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
const {
  getSecuritySettings,
  getPasswordPolicy,
  getSessionSettings,
  getAccountSecuritySettings
} = require('../controllers/securityController');

// Import auth middleware (if you have one)
// const { authenticateToken } = require('../middleware/authMiddleware');

// ============================================
// SECURITY ROUTES
// ============================================

/**
 * @route   GET /api/v1/security/settings
 * @desc    Get all security settings (password policy, session, account security)
 * @access  Private (requires authentication)
 * @returns All security settings from database
 */
router.get('/settings', getSecuritySettings);

/**
 * @route   GET /api/v1/security/password-policy
 * @desc    Get password policy settings only
 * @access  Private
 * @returns Password policy settings
 */
router.get('/password-policy', getPasswordPolicy);

/**
 * @route   GET /api/v1/security/session-settings
 * @desc    Get session management settings only
 * @access  Private
 * @returns Session management settings
 */
router.get('/session-settings', getSessionSettings);

/**
 * @route   GET /api/v1/security/account-settings
 * @desc    Get account security settings only
 * @access  Private
 * @returns Account security settings
 */
router.get('/account-settings', getAccountSecuritySettings);

module.exports = router;


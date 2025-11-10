// ============================================
// TWO-FACTOR AUTHENTICATION ROUTES
// All 2FA API endpoints
// Developer: Suvadip Panja
// Date: November 10, 2025
// FILE LOCATION: backend/routes/twoFactor.routes.js
// ============================================

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  get2FASettings,
  setupEmail2FA,
  sendOTP,
  verifyOTP,
  enable2FA,
  disable2FA,
  generateBackupCodes,
  getBackupCodesStats
} = require('../controllers/twoFactor.controller');

// ============================================
// ALL ROUTES REQUIRE AUTHENTICATION
// ============================================
router.use(authenticate);

// ============================================
// @route   GET /api/v1/2fa/settings
// @desc    Get user's 2FA settings
// @access  Private
// ============================================
router.get('/settings', get2FASettings);

// ============================================
// @route   POST /api/v1/2fa/setup/email
// @desc    Setup email-based 2FA
// @access  Private
// ============================================
router.post('/setup/email', setupEmail2FA);

// ============================================
// @route   POST /api/v1/2fa/send-otp
// @desc    Send OTP to user's email
// @access  Private
// ============================================
router.post('/send-otp', sendOTP);

// ============================================
// @route   POST /api/v1/2fa/verify
// @desc    Verify OTP code
// @access  Private
// @body    { code: string, method: 'email' | 'backup_code' }
// ============================================
router.post('/verify', verifyOTP);

// ============================================
// @route   POST /api/v1/2fa/enable
// @desc    Enable 2FA for user
// @access  Private
// ============================================
router.post('/enable', enable2FA);

// ============================================
// @route   POST /api/v1/2fa/disable
// @desc    Disable 2FA for user
// @access  Private
// @body    { password: string } (optional for now)
// ============================================
router.post('/disable', disable2FA);

// ============================================
// @route   POST /api/v1/2fa/backup-codes/generate
// @desc    Generate new backup codes
// @access  Private
// ============================================
router.post('/backup-codes/generate', generateBackupCodes);

// ============================================
// @route   GET /api/v1/2fa/backup-codes/stats
// @desc    Get backup codes statistics
// @access  Private
// ============================================
router.get('/backup-codes/stats', getBackupCodesStats);

// ============================================
// EXPORT ROUTER
// ============================================
module.exports = router;
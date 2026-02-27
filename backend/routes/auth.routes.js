// ============================================
// AUTH ROUTES - UPDATED WITH 2FA & PASSWORD RESET
// Authentication API endpoints
// Developer: Suvadip Panja
// Created: October 11, 2024
// Updated: November 11, 2025 - Added 2FA verification route
// Updated: January 26, 2026 - Added password reset routes
// ============================================

const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const {
  login,
  verifyTwoFactorLogin, // ⭐ 2FA verification function
  logout,
  getMe,
  changePassword
} = require('../controllers/auth.controller');

// ⭐ NEW: Password reset controller
const passwordResetController = require('../controllers/password-reset.controller');

const { authenticate } = require('../middleware/auth');

// ============================================
// RATE LIMITERS for sensitive auth endpoints
// ============================================

// Strict rate limit for 2FA OTP verification — prevent brute-force
const twoFactorLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,                    // 5 attempts per window
  message: { success: false, message: 'Too many verification attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limit for login attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // 10 attempts per window
  message: { success: false, message: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limit for password reset requests
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,                    // 5 attempts per window
  message: { success: false, message: 'Too many password reset requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================
// PUBLIC ROUTES (No authentication required)
// ============================================

/**
 * @route   POST /api/v1/auth/login
 * @desc    User login with username/password
 * @access  Public
 * @returns JWT token if successful, or 2FA required response
 */
router.post('/login', loginLimiter, login);

/**
 * ⭐ 2FA OTP Verification Endpoint
 * @route   POST /api/v1/auth/verify-2fa-login
 * @desc    Verify OTP code and complete login
 * @access  Public (but requires valid userId and OTP code)
 * @body    { userId: number, code: string }
 * @returns JWT token if OTP is valid
 * @created November 11, 2025
 */
router.post('/verify-2fa-login', twoFactorLimiter, verifyTwoFactorLogin);

// ============================================
// ⭐ NEW: PASSWORD RESET ROUTES (Public)
// Added: January 26, 2026
// ============================================

/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Request password reset (send email with token)
 * @access  Public
 * @body    { email: string }
 * @returns Success message (doesn't reveal if email exists)
 * @created January 26, 2026
 */
router.post('/forgot-password', passwordResetLimiter, passwordResetController.forgotPassword);

/**
 * @route   GET /api/v1/auth/validate-reset-token/:token
 * @desc    Validate reset token before showing form
 * @access  Public
 * @params  token (in URL)
 * @returns { isValid: boolean, email: string, full_name: string }
 * @created January 26, 2026
 */
router.get('/validate-reset-token/:token', passwordResetController.validateResetToken);

/**
 * @route   POST /api/v1/auth/reset-password
 * @desc    Reset password using token
 * @access  Public
 * @body    { token: string, newPassword: string, confirmPassword: string }
 * @returns Success message
 * @created January 26, 2026
 */
router.post('/reset-password', passwordResetLimiter, passwordResetController.resetPassword);

// ============================================
// PROTECTED ROUTES (Authentication required)
// ============================================

/**
 * @route   POST /api/v1/auth/logout
 * @desc    User logout (invalidates session)
 * @access  Private
 */
router.post('/logout', authenticate, logout);

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', authenticate, getMe);

/**
 * @route   PUT /api/v1/auth/change-password
 * @desc    Change user password
 * @access  Private
 * @body    { current_password: string, new_password: string }
 */
router.put('/change-password', authenticate, changePassword);

// ============================================
// EXPORT ROUTER
// ============================================
module.exports = router;
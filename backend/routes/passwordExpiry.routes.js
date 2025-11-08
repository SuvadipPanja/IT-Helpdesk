// ============================================
// PASSWORD EXPIRY ROUTES
// Developer: Suvadip Panja
// Created: November 08, 2025
// ============================================

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  getPasswordExpiryStatus,
  getUsersWithExpiringPasswords,
  getPasswordExpiryStatistics
} = require('../controllers/passwordExpiry.controller');

// All routes require authentication
router.use(authenticate);

// GET /api/v1/password-expiry/status
// Get current user's password expiry status
router.get('/status', getPasswordExpiryStatus);

// GET /api/v1/password-expiry/users-expiring
// Get all users with expiring passwords (admin only)
router.get('/users-expiring', authorize('can_manage_users'), getUsersWithExpiringPasswords);

// GET /api/v1/password-expiry/statistics
// Get password expiry statistics (admin only)
router.get('/statistics', authorize('can_view_analytics'), getPasswordExpiryStatistics);

module.exports = router;
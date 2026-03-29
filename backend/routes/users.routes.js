// ============================================
// USERS ROUTES - UPDATED WITH PASSWORD EXPIRY
// User management with password expiry features
// Developer: Suvadip Panja
// Updated: January 26, 2026
// ============================================

const express = require('express');
const router = express.Router();
const {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  hardDeleteUser,
  extendPasswordExpiry,
  forcePasswordReset,
  unlockUser,
} = require('../controllers/users.controller');
const { getUserTeams } = require('../controllers/teams.controller');
const { authenticate, authorize } = require('../middleware/auth');

// ✅ Input validation
const { validateRequest } = require('../middleware/validateRequest');
const { createUserValidator, updateUserValidator } = require('../validators/users.validators');

// All routes require authentication
router.use(authenticate);
router.use(authorize('can_manage_users'));

// ============================================
// USER CRUD ROUTES
// ============================================

// Get all users (with pagination and filters)
router.get('/', getUsers);

// Get single user by ID
router.get('/:id', getUserById);

// Create new user (Admin only)
router.post('/', createUserValidator, validateRequest, createUser);

// Update user (Admin only)
router.put('/:id', updateUserValidator, validateRequest, updateUser);

// Delete user / soft delete (can_manage_users)
router.delete('/:id', deleteUser);

// Hard delete user — ADMIN role only (permanent, non-reversible)
router.delete('/:id/hard-delete', hardDeleteUser);

// ============================================
// ⭐ NEW: PASSWORD EXPIRY MANAGEMENT ROUTES
// Admin-only routes for password management
// ============================================

/**
 * @route   PUT /api/v1/users/:id/extend-password-expiry
 * @desc    Extend user's password expiry by 90 days
 * @access  Private - Admin only
 * @created January 26, 2026
 */
router.put('/:id/extend-password-expiry', 
  authorize('can_manage_users'), 
  extendPasswordExpiry
);

/**
 * @route   PUT /api/v1/users/:id/force-password-reset
 * @desc    Force user to reset password on next login
 * @access  Private - Admin only
 * @created January 26, 2026
 */
router.put('/:id/force-password-reset', 
  authorize('can_manage_users'), 
  forcePasswordReset
);

/**
 * @route   PUT /api/v1/users/:id/unlock
 * @desc    Manually unlock a locked user account
 * @access  Private - Admin only
 */
router.put('/:id/unlock', 
  authorize('can_manage_users'), 
  unlockUser
);

// Get all teams a specific user belongs to
router.get('/:id/teams', getUserTeams);

module.exports = router;
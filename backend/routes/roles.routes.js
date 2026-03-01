// ============================================
// Role Routes
// Handles all role-related routes
// ============================================

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  getRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  getAvailablePermissions,
} = require('../controllers/roles.controller');

// ============================================
// AUTHENTICATION MIDDLEWARE
// All routes require authentication
// ============================================
router.use(authenticate);
router.use(authorize('can_manage_roles'));

// ============================================
// ROUTES
// IMPORTANT: Specific routes MUST come BEFORE parameterized routes
// ============================================

/**
 * @route   GET /api/v1/roles/permissions/available
 * @desc    Get list of available permissions
 * @access  Private (Admin only)
 * @note    This MUST be defined BEFORE /:id route
 */
router.get('/permissions/available', getAvailablePermissions);

/**
 * @route   GET /api/v1/roles
 * @desc    Get all roles with user counts
 * @access  Private (Admin only)
 */
router.get('/', getRoles);

/**
 * @route   GET /api/v1/roles/:id
 * @desc    Get single role by ID
 * @access  Private (Admin only)
 */
router.get('/:id', getRoleById);

/**
 * @route   POST /api/v1/roles
 * @desc    Create new role
 * @access  Private (Admin only)
 */
router.post('/', createRole);

/**
 * @route   PUT /api/v1/roles/:id
 * @desc    Update role by ID
 * @access  Private (Admin only)
 */
router.put('/:id', updateRole);

/**
 * @route   DELETE /api/v1/roles/:id
 * @desc    Delete (soft delete) role by ID
 * @access  Private (Admin only)
 */
router.delete('/:id', deleteRole);

// ============================================
// EXPORT ROUTER
// ============================================
module.exports = router;
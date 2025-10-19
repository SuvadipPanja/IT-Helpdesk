// ============================================
// Departments Routes
// Handles all department-related routes
// ============================================

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getAvailableManagers,
} = require('../controllers/departments.controller');  // ← FIXED: Added 's'

// ============================================
// AUTHENTICATION MIDDLEWARE
// All routes require authentication
// ============================================
router.use(authenticate);

// ============================================
// ROUTES
// IMPORTANT: Specific routes MUST come BEFORE parameterized routes
// ============================================

/**
 * @route   GET /api/v1/departments/managers/available
 * @desc    Get list of available managers (Admin/Manager users)
 * @access  Private (Admin/Manager)
 * @note    This MUST be defined BEFORE /:id route
 */
router.get('/managers/available', getAvailableManagers);

/**
 * @route   GET /api/v1/departments
 * @desc    Get all departments with stats
 * @access  Private (Admin/Manager)
 */
router.get('/', getDepartments);

/**
 * @route   GET /api/v1/departments/:id
 * @desc    Get single department by ID
 * @access  Private (Admin/Manager)
 */
router.get('/:id', getDepartmentById);

/**
 * @route   POST /api/v1/departments
 * @desc    Create new department
 * @access  Private (Admin only)
 */
router.post('/', createDepartment);

/**
 * @route   PUT /api/v1/departments/:id
 * @desc    Update department by ID
 * @access  Private (Admin only)
 */
router.put('/:id', updateDepartment);

/**
 * @route   DELETE /api/v1/departments/:id
 * @desc    Delete (soft delete) department by ID
 * @access  Private (Admin only)
 */
router.delete('/:id', deleteDepartment);

// ============================================
// EXPORT ROUTER
// ============================================
module.exports = router;
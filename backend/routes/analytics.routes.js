// ============================================
// Analytics Routes
// Handles all analytics and reporting routes
// ============================================

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getOverview,
  getStatusDistribution,
  getTicketsByDepartment,
  getTicketsByPriority,
  getTicketTrends,
  getTopEngineers,
  getRecentActivity,
  getTicketsByCategory,
} = require('../controllers/analytics.controller');

// ============================================
// AUTHENTICATION MIDDLEWARE
// All routes require authentication
// ============================================
router.use(authenticate);

// ============================================
// ANALYTICS ROUTES
// ============================================

/**
 * @route   GET /api/v1/analytics/overview
 * @desc    Get dashboard overview statistics
 * @access  Private (Admin/Manager)
 * @query   start_date, end_date (optional)
 */
router.get('/overview', getOverview);

/**
 * @route   GET /api/v1/analytics/status-distribution
 * @desc    Get ticket status distribution
 * @access  Private (Admin/Manager)
 * @query   start_date, end_date (optional)
 */
router.get('/status-distribution', getStatusDistribution);

/**
 * @route   GET /api/v1/analytics/by-department
 * @desc    Get tickets grouped by department
 * @access  Private (Admin/Manager)
 * @query   start_date, end_date (optional)
 */
router.get('/by-department', getTicketsByDepartment);

/**
 * @route   GET /api/v1/analytics/by-priority
 * @desc    Get tickets grouped by priority
 * @access  Private (Admin/Manager)
 * @query   start_date, end_date (optional)
 */
router.get('/by-priority', getTicketsByPriority);

/**
 * @route   GET /api/v1/analytics/by-category
 * @desc    Get tickets grouped by category
 * @access  Private (Admin/Manager)
 * @query   start_date, end_date (optional)
 */
router.get('/by-category', getTicketsByCategory);

/**
 * @route   GET /api/v1/analytics/trends
 * @desc    Get ticket trends over time
 * @access  Private (Admin/Manager)
 * @query   days (default: 30)
 */
router.get('/trends', getTicketTrends);

/**
 * @route   GET /api/v1/analytics/top-engineers
 * @desc    Get top performing engineers
 * @access  Private (Admin/Manager)
 * @query   start_date, end_date, limit (optional)
 */
router.get('/top-engineers', getTopEngineers);

/**
 * @route   GET /api/v1/analytics/recent-activity
 * @desc    Get recent ticket activity
 * @access  Private (Admin/Manager)
 * @query   limit (default: 20)
 */
router.get('/recent-activity', getRecentActivity);

// ============================================
// EXPORT ROUTER
// ============================================
module.exports = router;
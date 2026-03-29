// ============================================
// Dashboard Routes
// Routes for dashboard statistics and metrics
// ============================================

const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getUserActivity,
} = require('../controllers/dashboard.controller');
const { authenticate } = require('../middleware/auth');

// All dashboard routes require authentication
router.use(authenticate);

// Get dashboard statistics
router.get('/stats', getDashboardStats);

// Get user activity summary
router.get('/activity', getUserActivity);

module.exports = router;
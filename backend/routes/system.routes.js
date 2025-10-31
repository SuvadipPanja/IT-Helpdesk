// ============================================
// System Routes
// ============================================

const express = require('express');
const router = express.Router();
const {
  getCategories,
  getPriorities,
  getStatuses,
  getRoles,
  getDepartments,
  getEngineers,
  getDashboardStats,
  getLookupsForSettings  // ✅ NEW IMPORT
} = require('../controllers/system.controller');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// System lookup endpoints
router.get('/categories', getCategories);
router.get('/priorities', getPriorities);
router.get('/statuses', getStatuses);
router.get('/roles', getRoles);
router.get('/departments', getDepartments);
router.get('/engineers', getEngineers);

// Dashboard statistics
router.get('/dashboard-stats', getDashboardStats);

// ✅ NEW ROUTE - Lookups for Settings page
router.get('/lookups/settings', getLookupsForSettings);

module.exports = router;
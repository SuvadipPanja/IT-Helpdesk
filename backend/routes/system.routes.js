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
  getLookupsForSettings,
  getSubCategories,
  getSubCategoryFields,
  getLocations,
  getProcesses,
  getTeamsLookup,
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

// Sub-categories, locations, processes
router.get('/sub-categories/:categoryId', getSubCategories);
router.get('/sub-category-fields/:subCategoryId', getSubCategoryFields);
router.get('/locations', getLocations);
router.get('/processes', getProcesses);
router.get('/teams', getTeamsLookup);

// Dashboard statistics
router.get('/dashboard-stats', getDashboardStats);

// Lookups for Settings page
router.get('/lookups/settings', getLookupsForSettings);

module.exports = router;
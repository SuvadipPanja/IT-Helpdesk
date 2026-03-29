// ============================================
// Ticket Configuration Routes
// Admin CRUD for Sub-Categories, Fields, Locations, Processes
// ============================================

const express = require('express');
const router = express.Router();
const {
  // Sub-categories
  getAllSubCategories,
  createSubCategory,
  updateSubCategory,
  deleteSubCategory,
  // Custom Fields
  getFieldsBySubCategory,
  createField,
  updateField,
  deleteField,
  // Locations
  getAllLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  // Processes
  getAllProcesses,
  createProcess,
  updateProcess,
  deleteProcess,
} = require('../controllers/ticketConfig.controller');
const { authenticate, authorizeAny } = require('../middleware/auth');

const GENERAL_SETTINGS_PERMS = ['can_manage_system', 'can_manage_settings_general'];
const TICKET_SETTINGS_PERMS = ['can_manage_system', 'can_manage_settings_tickets'];

router.use(authenticate);

// ============================================
// SUB-CATEGORIES
// ============================================
router.get('/sub-categories', authorizeAny(TICKET_SETTINGS_PERMS), getAllSubCategories);
router.post('/sub-categories', authorizeAny(TICKET_SETTINGS_PERMS), createSubCategory);
router.put('/sub-categories/:id', authorizeAny(TICKET_SETTINGS_PERMS), updateSubCategory);
router.delete('/sub-categories/:id', authorizeAny(TICKET_SETTINGS_PERMS), deleteSubCategory);

// ============================================
// CUSTOM FIELDS
// ============================================
router.get('/fields/:subCategoryId', authorizeAny(TICKET_SETTINGS_PERMS), getFieldsBySubCategory);
router.post('/fields', authorizeAny(TICKET_SETTINGS_PERMS), createField);
router.put('/fields/:id', authorizeAny(TICKET_SETTINGS_PERMS), updateField);
router.delete('/fields/:id', authorizeAny(TICKET_SETTINGS_PERMS), deleteField);

// ============================================
// LOCATIONS
// ============================================
router.get('/locations', authorizeAny(GENERAL_SETTINGS_PERMS), getAllLocations);
router.post('/locations', authorizeAny(GENERAL_SETTINGS_PERMS), createLocation);
router.put('/locations/:id', authorizeAny(GENERAL_SETTINGS_PERMS), updateLocation);
router.delete('/locations/:id', authorizeAny(GENERAL_SETTINGS_PERMS), deleteLocation);

// ============================================
// PROCESSES / CLIENTS
// ============================================
router.get('/processes', authorizeAny(TICKET_SETTINGS_PERMS), getAllProcesses);
router.post('/processes', authorizeAny(TICKET_SETTINGS_PERMS), createProcess);
router.put('/processes/:id', authorizeAny(TICKET_SETTINGS_PERMS), updateProcess);
router.delete('/processes/:id', authorizeAny(TICKET_SETTINGS_PERMS), deleteProcess);

module.exports = router;

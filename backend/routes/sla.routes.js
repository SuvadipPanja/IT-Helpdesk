// ============================================
// SLA POLICIES ROUTES
// Exposes endpoints for per-category × per-priority
// SLA threshold management.
//
// All routes require authentication + admin/manager role.
//
// Developer: Suvadip Panja
// Date: March 2026
// FILE: backend/routes/sla.routes.js
// ============================================

const express = require('express');
const router = express.Router();
const { authenticate, authorizeRoles } = require('../middleware/auth');
const {
  getPolicies,
  bulkUpsertPolicies,
  recalculateOpenTickets
} = require('../controllers/sla.controller');

// Roles that may view or manage SLA settings
const SLA_VIEW_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
const SLA_WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN'];

// GET  /api/v1/sla/policies        — fetch all policies + categories + priorities
router.get('/policies', authenticate, authorizeRoles(SLA_VIEW_ROLES), getPolicies);

// PUT  /api/v1/sla/policies        — bulk upsert policy matrix
router.put('/policies', authenticate, authorizeRoles(SLA_WRITE_ROLES), bulkUpsertPolicies);

// POST /api/v1/sla/recalculate     — recalculate due dates for all open tickets
router.post('/recalculate', authenticate, authorizeRoles(SLA_WRITE_ROLES), recalculateOpenTickets);

module.exports = router;

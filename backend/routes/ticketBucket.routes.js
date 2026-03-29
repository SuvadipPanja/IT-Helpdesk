/**
 * ============================================
 * TICKET BUCKET ROUTES
 * ============================================
 * Open Ticket Bucket System — Routes
 * 
 * SECURITY:
 * - All routes require authentication
 * - List/Stats: ENGINEER, ADMIN, MANAGER roles only
 * - Self-assign: Controller enforces ENGINEER-only
 * 
 * Developer: Suvadip Panja
 * Company: Digitide
 * Created: March 2026
 * ============================================
 */

const express = require('express');
const router = express.Router();
const {
  getBucketTickets,
  getBucketStats,
  selfAssignTicket,
} = require('../controllers/ticketBucket.controller');
const { authenticate, authorizeRoles } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Role gate — only ENGINEER, ADMIN, MANAGER can access bucket
router.use(authorizeRoles(['ENGINEER', 'ADMIN', 'MANAGER']));

// ============================================
// ROUTES
// ============================================

// Stats route MUST come before /:id to avoid matching "stats" as :id
router.get('/stats', getBucketStats);

// Get unassigned open tickets (paginated, filterable)
router.get('/', getBucketTickets);

// Self-assign a ticket from the bucket (ENGINEER only — enforced in controller)
router.post('/:id/self-assign', selfAssignTicket);

module.exports = router;

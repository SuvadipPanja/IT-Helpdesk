/**
 * ============================================
 * TEAM BUCKET ROUTES
 * ============================================
 * Team-scoped ticket queue for engineers, team managers,
 * admins, and the central ticketing team.
 *
 * Developer: Suvadip Panja
 * Company: Digitide
 * Created: April 2026
 * ============================================
 */

const express = require('express');
const router = express.Router();
const {
  getTeamBucketTickets,
  getTeamBucketStats,
  selfAssignFromTeamBucket,
  routeTicketToTeam,
  resetTicketPriority,
} = require('../controllers/teamBucket.controller');
const { authenticate, authorizeRoles } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// All routes require at least ENGINEER role (or CENTRAL_MGMT for the central inbox)
router.use(authorizeRoles(['ENGINEER', 'ADMIN', 'MANAGER', 'CENTRAL_MGMT']));

// Stats route before /:id  (avoid "stats" being consumed as :id)
router.get('/stats', getTeamBucketStats);

// List team bucket tickets
router.get('/', getTeamBucketTickets);

// Self-assign (ENGINEER only — enforced in controller)
router.post('/:id/self-assign', selfAssignFromTeamBucket);

// Route ticket to a specialist team (central team / admin / manager)
router.post('/:id/route', routeTicketToTeam);

// Reset priority — triggers SLA recalculation (manager / admin)
router.put('/:id/priority', resetTicketPriority);

module.exports = router;

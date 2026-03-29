/**
 * ============================================
 * TEAMS ROUTES
 * ============================================
 * Endpoints for Team Management System
 *
 * - All routes require authentication
 * - Mutation routes (POST/PUT/DELETE for teams): ADMIN only
 * - Read routes: ADMIN, MANAGER, ENGINEER (own team queries)
 * - Member management: ADMIN only
 * - Routing rules: ADMIN only
 *
 * Developer: Suvadip Panja
 * Company: Digitide
 * Created: April 2026
 * ============================================
 */

const express = require('express');
const router = express.Router();
const {
  getTeams,
  getTeamById,
  createTeam,
  updateTeam,
  deleteTeam,
  getTeamMembers,
  addTeamMember,
  removeTeamMember,
  getCategoryRoutings,
  createCategoryRouting,
  deleteCategoryRouting,
  getMyTeam,
} = require('../controllers/teams.controller');
const { authenticate, authorizeRoles } = require('../middleware/auth');

// All routes require a valid JWT
router.use(authenticate);

// ============================================
// MY TEAM (any authenticated user)
// ============================================
router.get('/my-team', getMyTeam);

// ============================================
// CATEGORY ROUTING RULES
// NOTE: /routing must come BEFORE /:id to avoid "routing" being caught as :id
// ============================================
router.get('/routing', authorizeRoles(['ADMIN', 'MANAGER']), getCategoryRoutings);
router.post('/routing', authorizeRoles(['ADMIN']), createCategoryRouting);
router.delete('/routing/:routingId', authorizeRoles(['ADMIN']), deleteCategoryRouting);

// ============================================
// TEAM CRUD
// ============================================
router.get('/', authorizeRoles(['ADMIN', 'MANAGER', 'ENGINEER']), getTeams);
router.post('/', authorizeRoles(['ADMIN']), createTeam);

router.get('/:id', authorizeRoles(['ADMIN', 'MANAGER', 'ENGINEER']), getTeamById);
router.put('/:id', authorizeRoles(['ADMIN']), updateTeam);
router.delete('/:id', authorizeRoles(['ADMIN']), deleteTeam);

// ============================================
// TEAM MEMBERS
// ============================================
router.get('/:id/members', authorizeRoles(['ADMIN', 'MANAGER']), getTeamMembers);
router.post('/:id/members', authorizeRoles(['ADMIN']), addTeamMember);
router.delete('/:id/members/:userId', authorizeRoles(['ADMIN']), removeTeamMember);

module.exports = router;

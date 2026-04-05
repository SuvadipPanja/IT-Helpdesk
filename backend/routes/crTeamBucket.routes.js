/**
 * CR TEAM BUCKET ROUTES
 */
const express = require('express');
const router = express.Router();
const {
  getCRTeamBucketItems,
  getCRTeamBucketStats,
  selfAssignFromCRTeamBucket,
  routeCRToTeam,
} = require('../controllers/crTeamBucket.controller');
const { authenticate, authorizeRoles } = require('../middleware/auth');

router.use(authenticate);
router.use(authorizeRoles(['ENGINEER', 'ADMIN', 'MANAGER', 'CENTRAL_MGMT']));

router.get('/stats', getCRTeamBucketStats);
router.get('/', getCRTeamBucketItems);
router.post('/:id/self-assign', selfAssignFromCRTeamBucket);
router.post('/:id/route', routeCRToTeam);

module.exports = router;

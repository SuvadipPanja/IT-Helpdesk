/**
 * CR BUCKET ROUTES
 * Open CR Bucket System — Routes
 */

const express = require('express');
const router = express.Router();
const {
  getBucketCRs,
  getBucketStats,
  selfAssignCR,
} = require('../controllers/crBucket.controller');
const { authenticate, authorizeRoles } = require('../middleware/auth');

router.use(authenticate);
router.use(authorizeRoles(['ENGINEER', 'ADMIN', 'MANAGER']));

router.get('/stats', getBucketStats);
router.get('/', getBucketCRs);
router.post('/:id/self-assign', selfAssignCR);

module.exports = router;

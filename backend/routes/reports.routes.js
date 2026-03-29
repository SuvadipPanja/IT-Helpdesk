/**
 * Reports API — operational exports (tickets, journey, summaries)
 */
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { enforceLicensedFeature } = require('../middleware/license.middleware');
const reportsCtrl = require('../controllers/reports.controller');

router.use(authenticate);
router.use(authorize('can_view_analytics'));
router.use(enforceLicensedFeature('analytics'));

router.get('/filter-options', reportsCtrl.getFilterOptions);
router.post('/run', reportsCtrl.runReport);

module.exports = router;

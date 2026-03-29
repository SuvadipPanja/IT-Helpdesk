// ============================================
// JOB MONITOR ROUTES
// Provides admin endpoints for background job status, triggers and toggle
// Updated: March 2026 — added toggle (start/stop) route
// FILE: backend/routes/jobs.routes.js
// ============================================

const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getAllJobStatuses, triggerJob, toggleJob } = require('../controllers/jobs.controller');

// All routes require authentication + job monitor permission
router.use(authenticate);
router.use(authorize('can_view_job_monitor'));

// GET /api/v1/jobs — list all job statuses (real-time)
router.get('/', getAllJobStatuses);

// POST /api/v1/jobs/:name/run — manually trigger a job
router.post('/:name/run', triggerJob);

// PATCH /api/v1/jobs/:name/toggle — start or stop a scheduled job
// Body: { action: 'start' | 'stop' }
router.patch('/:name/toggle', toggleJob);

module.exports = router;

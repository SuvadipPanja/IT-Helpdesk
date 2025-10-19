// ============================================
// EMAIL QUEUE ROUTES
// Handles all email queue management routes
// ============================================

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getEmailQueue,
  getEmailQueueStats,
  getEmailById,
  retryEmail,
  retryAllFailed,
  deleteEmail,
  clearOldEmails
} = require('../controllers/emailQueue.controller');

// ============================================
// ALL ROUTES REQUIRE AUTHENTICATION & ADMIN
// ============================================
router.use(authenticate);

// ============================================
// EMAIL QUEUE ROUTES
// ============================================

/**
 * @route   GET /api/v1/email-queue/stats
 * @desc    Get email queue statistics
 * @access  Private (Admin only)
 */
router.get('/stats', getEmailQueueStats);

/**
 * @route   GET /api/v1/email-queue
 * @desc    Get all emails with filters and pagination
 * @access  Private (Admin only)
 * @query   page, limit, status, email_type, search, start_date, end_date
 */
router.get('/', getEmailQueue);

/**
 * @route   GET /api/v1/email-queue/:id
 * @desc    Get single email details
 * @access  Private (Admin only)
 */
router.get('/:id', getEmailById);

/**
 * @route   POST /api/v1/email-queue/:id/retry
 * @desc    Retry sending a failed email
 * @access  Private (Admin only)
 */
router.post('/:id/retry', retryEmail);

/**
 * @route   POST /api/v1/email-queue/retry-all-failed
 * @desc    Retry all failed emails
 * @access  Private (Admin only)
 */
router.post('/retry-all-failed', retryAllFailed);

/**
 * @route   DELETE /api/v1/email-queue/:id
 * @desc    Delete single email from queue
 * @access  Private (Admin only)
 */
router.delete('/:id', deleteEmail);

/**
 * @route   DELETE /api/v1/email-queue/clear-old
 * @desc    Clear old emails (sent/failed) older than X days
 * @access  Private (Admin only)
 * @query   days (default: 30)
 */
router.delete('/clear-old', clearOldEmails);

// ============================================
// EXPORT ROUTER
// ============================================
module.exports = router;
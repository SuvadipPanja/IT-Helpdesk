// ============================================
// NOTIFICATIONS ROUTES
// Handles all notification-related routes
// ============================================

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearReadNotifications,
} = require('../controllers/notifications.controller');

// ============================================
// AUTHENTICATION MIDDLEWARE
// All notification routes require authentication
// Users can only access their own notifications
// ============================================
router.use(authenticate);

// ============================================
// NOTIFICATION ROUTES
// ============================================

/**
 * @route   GET /api/v1/notifications
 * @desc    Get all notifications for logged-in user
 * @access  Private
 * @query   page, limit, unread_only
 * @example GET /api/v1/notifications?page=1&limit=20&unread_only=true
 * 
 * SECURITY: Users can only see their own notifications
 * No admin override - privacy is respected
 */
router.get('/', getNotifications);

/**
 * @route   GET /api/v1/notifications/unread-count
 * @desc    Get count of unread notifications
 * @access  Private
 * @returns {number} unread_count
 * 
 * PURPOSE: Used for notification badge in header
 * POLLING: Frontend should call this every 30-60 seconds
 */
router.get('/unread-count', getUnreadCount);

/**
 * @route   PATCH /api/v1/notifications/read-all
 * @desc    Mark all notifications as read
 * @access  Private
 * NOTE: Must be before /:id/read to avoid "read-all" being matched as id
 */
router.patch('/read-all', markAllAsRead);

/**
 * @route   PATCH /api/v1/notifications/:id/read
 * @desc    Mark single notification as read
 * @access  Private
 */
router.patch('/:id/read', markAsRead);

/**
 * @route   DELETE /api/v1/notifications/clear-read
 * @desc    Delete all read notifications (cleanup)
 * @access  Private
 * NOTE: Must be before /:id to avoid "clear-read" being matched as id
 */
router.delete('/clear-read', clearReadNotifications);

/**
 * @route   DELETE /api/v1/notifications/:id
 * @desc    Delete single notification
 * @access  Private
 */
router.delete('/:id', deleteNotification);

// ============================================
// EXPORT ROUTER
// ============================================
module.exports = router;
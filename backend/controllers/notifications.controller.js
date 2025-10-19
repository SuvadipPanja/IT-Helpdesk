// ============================================
// NOTIFICATIONS CONTROLLER
// Handles all notification operations
// UPDATED: Added username display, role-based visibility, admin-only delete
// ============================================

const { executeQuery } = require('../config/database');
const { createResponse } = require('../utils/helpers');
const logger = require('../utils/logger');

// ============================================
// SECURITY NOTE:
// - Admin/Manager can see ALL notifications
// - Other users can only see their own notifications
// - Only Admin can delete notifications
// - All queries use parameterized inputs (SQL injection prevention)
// - Authorization checked on every endpoint
// ============================================

/**
 * Get all notifications for logged-in user
 * UPDATED: Admin/Manager see all notifications, others see only theirs
 * @route GET /api/v1/notifications
 * @access Private
 * @query page, limit, unread_only
 */
const getNotifications = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const userRole = req.user.role_code; // ADMIN, MANAGER, ENGINEER, USER
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const unreadOnly = req.query.unread_only === 'true';
    const offset = (page - 1) * limit;

    logger.try('Fetching notifications', {
      userId,
      userRole,
      page,
      limit,
      unreadOnly,
    });

    // Build WHERE clause based on role
    let whereClause = '';
    let countWhereClause = '';
    
    if (userRole === 'ADMIN' || userRole === 'MANAGER') {
      // Admin and Manager see ALL notifications
      whereClause = 'WHERE 1=1';
      countWhereClause = 'WHERE 1=1';
      logger.info('Admin/Manager viewing all notifications');
    } else {
      // Other users see only their own notifications
      whereClause = 'WHERE n.user_id = @userId';
      countWhereClause = 'WHERE user_id = @userId';
      logger.info('Regular user viewing own notifications', { userId });
    }

    // Add unread filter if requested
    if (unreadOnly) {
      whereClause += ' AND n.is_read = 0';
      countWhereClause += ' AND is_read = 0';
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM notifications
      ${countWhereClause}
    `;

    const countResult = await executeQuery(countQuery, { userId });
    const totalRecords = countResult.recordset[0].total;

    // Get notifications with pagination
    // UPDATED: Added username from users table
    const query = `
      SELECT 
        n.notification_id,
        n.user_id,
        n.notification_type,
        n.title,
        n.message,
        n.is_read,
        n.read_at,
        n.created_at,
        n.related_ticket_id,
        -- User info (who the notification is FOR)
        u.username,
        u.first_name,
        u.last_name,
        CONCAT(u.first_name, ' ', u.last_name) as full_name,
        u.email,
        -- Ticket info if exists
        t.ticket_number,
        t.subject as ticket_subject
      FROM notifications n
      INNER JOIN users u ON n.user_id = u.user_id
      LEFT JOIN tickets t ON n.related_ticket_id = t.ticket_id
      ${whereClause}
      ORDER BY n.created_at DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `;

    const result = await executeQuery(query, {
      userId,
      offset,
      limit,
    });

    const notifications = result.recordset;

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalRecords / limit);

    logger.success('Notifications fetched successfully', {
      userId,
      userRole,
      count: notifications.length,
      totalRecords,
    });

    return res.status(200).json(
      createResponse(true, 'Notifications fetched successfully', {
        notifications,
        pagination: {
          current_page: page,
          total_pages: totalPages,
          total_records: totalRecords,
          per_page: limit,
          has_next: page < totalPages,
          has_prev: page > 1,
        },
      })
    );
  } catch (error) {
    logger.error('Get notifications error', error);
    next(error);
  }
};

/**
 * Get unread notification count
 * UPDATED: Admin/Manager see count of ALL unread, others see only theirs
 * @route GET /api/v1/notifications/unread-count
 * @access Private
 */
const getUnreadCount = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const userRole = req.user.role_code;

    logger.try('Fetching unread count', { userId, userRole });

    let query;
    if (userRole === 'ADMIN' || userRole === 'MANAGER') {
      // Admin/Manager see count of ALL unread notifications
      query = `
        SELECT COUNT(*) as unread_count
        FROM notifications
        WHERE is_read = 0
      `;
    } else {
      // Other users see only their unread count
      query = `
        SELECT COUNT(*) as unread_count
        FROM notifications
        WHERE user_id = @userId AND is_read = 0
      `;
    }

    const result = await executeQuery(query, { userId });
    const unreadCount = result.recordset[0].unread_count;

    logger.success('Unread count fetched', {
      userId,
      userRole,
      unreadCount,
    });

    return res.status(200).json(
      createResponse(true, 'Unread count fetched successfully', {
        unread_count: unreadCount,
      })
    );
  } catch (error) {
    logger.error('Get unread count error', error);
    next(error);
  }
};

/**
 * Mark notification as read
 * UPDATED: Admin/Manager can mark any notification, others only their own
 * @route PATCH /api/v1/notifications/:id/read
 * @access Private
 */
const markAsRead = async (req, res, next) => {
  try {
    const notificationId = req.params.id;
    const userId = req.user.user_id;
    const userRole = req.user.role_code;

    logger.try('Marking notification as read', {
      notificationId,
      userId,
      userRole,
    });

    // Check if notification exists
    const checkQuery = `
      SELECT notification_id, user_id, is_read
      FROM notifications
      WHERE notification_id = @notificationId
    `;

    const checkResult = await executeQuery(checkQuery, { notificationId });

    if (checkResult.recordset.length === 0) {
      logger.warn('Notification not found', { notificationId });
      return res.status(404).json(
        createResponse(false, 'Notification not found')
      );
    }

    const notification = checkResult.recordset[0];

    // SECURITY: Verify ownership (unless Admin/Manager)
    if (userRole !== 'ADMIN' && userRole !== 'MANAGER') {
      if (notification.user_id !== userId) {
        logger.warn('Unauthorized access attempt', {
          notificationId,
          userId,
          actualUserId: notification.user_id,
        });
        return res.status(403).json(
          createResponse(false, 'You do not have permission to access this notification')
        );
      }
    }

    // Check if already read
    if (notification.is_read === true) {
      logger.info('Notification already marked as read', { notificationId });
      return res.status(200).json(
        createResponse(true, 'Notification already marked as read')
      );
    }

    // Mark as read
    const updateQuery = `
      UPDATE notifications
      SET is_read = 1, read_at = GETDATE()
      WHERE notification_id = @notificationId
    `;

    await executeQuery(updateQuery, { notificationId });

    logger.success('Notification marked as read', { notificationId });

    return res.status(200).json(
      createResponse(true, 'Notification marked as read')
    );
  } catch (error) {
    logger.error('Mark as read error', error);
    next(error);
  }
};

/**
 * Mark all notifications as read
 * UPDATED: Admin/Manager mark ALL, others mark only theirs
 * @route PATCH /api/v1/notifications/read-all
 * @access Private
 */
const markAllAsRead = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const userRole = req.user.role_code;

    logger.try('Marking all notifications as read', { userId, userRole });

    let query;
    if (userRole === 'ADMIN' || userRole === 'MANAGER') {
      // Mark ALL notifications as read
      query = `
        UPDATE notifications
        SET is_read = 1, read_at = GETDATE()
        WHERE is_read = 0
      `;
    } else {
      // Mark only user's notifications as read
      query = `
        UPDATE notifications
        SET is_read = 1, read_at = GETDATE()
        WHERE user_id = @userId AND is_read = 0
      `;
    }

    const result = await executeQuery(query, { userId });
    const updatedCount = result.rowsAffected[0];

    logger.success('All notifications marked as read', {
      userId,
      userRole,
      updatedCount,
    });

    return res.status(200).json(
      createResponse(true, 'All notifications marked as read', {
        updated_count: updatedCount,
      })
    );
  } catch (error) {
    logger.error('Mark all as read error', error);
    next(error);
  }
};

/**
 * Delete notification
 * UPDATED: ONLY ADMIN can delete notifications
 * @route DELETE /api/v1/notifications/:id
 * @access Private (Admin Only)
 */
const deleteNotification = async (req, res, next) => {
  try {
    const notificationId = req.params.id;
    const userId = req.user.user_id;
    const userRole = req.user.role_code;

    logger.try('Deleting notification', {
      notificationId,
      userId,
      userRole,
    });

    // SECURITY: Only Admin can delete notifications
    if (userRole !== 'ADMIN') {
      logger.warn('Non-admin attempted to delete notification', {
        notificationId,
        userId,
        userRole,
      });
      return res.status(403).json(
        createResponse(false, 'Only administrators can delete notifications')
      );
    }

    // Check if notification exists
    const checkQuery = `
      SELECT notification_id
      FROM notifications
      WHERE notification_id = @notificationId
    `;

    const checkResult = await executeQuery(checkQuery, { notificationId });

    if (checkResult.recordset.length === 0) {
      logger.warn('Notification not found', { notificationId });
      return res.status(404).json(
        createResponse(false, 'Notification not found')
      );
    }

    // Delete notification
    const deleteQuery = `
      DELETE FROM notifications
      WHERE notification_id = @notificationId
    `;

    await executeQuery(deleteQuery, { notificationId });

    logger.success('Notification deleted by admin', {
      notificationId,
      adminId: userId,
    });

    return res.status(200).json(
      createResponse(true, 'Notification deleted successfully')
    );
  } catch (error) {
    logger.error('Delete notification error', error);
    next(error);
  }
};

/**
 * Delete all read notifications
 * UPDATED: ONLY ADMIN can clear read notifications
 * @route DELETE /api/v1/notifications/clear-read
 * @access Private (Admin Only)
 */
const clearReadNotifications = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const userRole = req.user.role_code;

    logger.try('Clearing read notifications', { userId, userRole });

    // SECURITY: Only Admin can clear notifications
    if (userRole !== 'ADMIN') {
      logger.warn('Non-admin attempted to clear notifications', {
        userId,
        userRole,
      });
      return res.status(403).json(
        createResponse(false, 'Only administrators can clear notifications')
      );
    }

    const query = `
      DELETE FROM notifications
      WHERE is_read = 1
    `;

    const result = await executeQuery(query);
    const deletedCount = result.rowsAffected[0];

    logger.success('Read notifications cleared by admin', {
      adminId: userId,
      deletedCount,
    });

    return res.status(200).json(
      createResponse(true, 'Read notifications cleared successfully', {
        deleted_count: deletedCount,
      })
    );
  } catch (error) {
    logger.error('Clear read notifications error', error);
    next(error);
  }
};

// ============================================
// HELPER FUNCTION: Create Notification
// Called by other controllers to create notifications
// ============================================

/**
 * Create a notification (helper function for other controllers)
 * @param {number} userId - User to notify
 * @param {string} type - Notification type (TICKET_CREATED, TICKET_ASSIGNED, etc.)
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {number|null} ticketId - Related ticket ID (optional)
 */
const createNotification = async (userId, type, title, message, ticketId = null) => {
  try {
    logger.try('Creating notification', {
      userId,
      type,
      ticketId,
    });

    const query = `
      INSERT INTO notifications (
        user_id, notification_type, title, message, related_ticket_id
      )
      VALUES (@userId, @type, @title, @message, @ticketId)
    `;

    await executeQuery(query, {
      userId,
      type,
      title,
      message,
      ticketId,
    });

    logger.success('Notification created', {
      userId,
      type,
    });

    return true;
  } catch (error) {
    logger.error('Create notification error', error);
    return false;
  }
};

/**
 * Create bulk notifications (for multiple users)
 * @param {Array} userIds - Array of user IDs
 * @param {string} type - Notification type
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {number|null} ticketId - Related ticket ID (optional)
 */
const createBulkNotifications = async (userIds, type, title, message, ticketId = null) => {
  try {
    logger.try('Creating bulk notifications', {
      userCount: userIds.length,
      type,
      ticketId,
    });

    // Build values for each user
    const promises = userIds.map((userId) => {
      const query = `
        INSERT INTO notifications (
          user_id, notification_type, title, message, related_ticket_id
        )
        VALUES (@userId, @type, @title, @message, @ticketId)
      `;
      return executeQuery(query, {
        userId,
        type,
        title,
        message,
        ticketId,
      });
    });

    await Promise.all(promises);

    logger.success('Bulk notifications created', {
      count: userIds.length,
      type,
    });

    return true;
  } catch (error) {
    logger.error('Create bulk notifications error', error);
    return false;
  }
};

// ============================================
// EXPORT ALL FUNCTIONS
// ============================================

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearReadNotifications,
  createNotification,
  createBulkNotifications,
};
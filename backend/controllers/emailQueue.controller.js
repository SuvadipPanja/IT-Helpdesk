// ============================================
// EMAIL QUEUE CONTROLLER
// Handles email queue management endpoints
// FILE: backend/controllers/emailQueue.controller.js
// ============================================

const { executeQuery } = require('../config/database');
const { createResponse } = require('../utils/helpers');
const logger = require('../utils/logger');
const emailQueueService = require('../services/emailQueue.service');

// ============================================
// GET EMAIL QUEUE
// With filters and pagination
// @route GET /api/v1/email-queue
// @access Private (Admin only)
// ============================================
const getEmailQueue = async (req, res, next) => {
  try {
    logger.try('Fetching email queue', { userId: req.user.user_id });

    // Check admin permission
    if (!req.user.permissions?.can_manage_system) {
      return res.status(403).json(
        createResponse(false, 'You do not have permission to view email queue')
      );
    }

    const {
      page = 1,
      limit = 50,
      status = '',
      email_type = '',
      search = '',
      start_date = '',
      end_date = ''
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build WHERE clause
    const conditions = [];
    const params = {};

    if (status) {
      conditions.push('eq.status = @status');
      params.status = status;
    }

    if (email_type) {
      conditions.push('eq.email_type = @emailType');
      params.emailType = email_type;
    }

    if (search) {
      conditions.push('(eq.recipient_email LIKE @search OR eq.subject LIKE @search)');
      params.search = `%${search}%`;
    }

    if (start_date) {
      conditions.push('eq.created_at >= @startDate');
      params.startDate = start_date;
    }

    if (end_date) {
      conditions.push('eq.created_at <= @endDate');
      params.endDate = end_date;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM email_queue eq
      ${whereClause}
    `;

    const countResult = await executeQuery(countQuery, params);
    const totalRecords = countResult.recordset[0].total;

    // Get paginated data
    const dataQuery = `
      SELECT 
        eq.email_id,
        eq.recipient_email,
        eq.recipient_name,
        eq.subject,
        eq.email_type,
        eq.status,
        eq.priority,
        eq.retry_count,
        eq.max_retries,
        eq.error_message,
        eq.created_at,
        eq.sent_at,
        eq.failed_at,
        eq.next_retry_at,
        eq.related_entity_type,
        eq.related_entity_id,
        eq.template_used,
        u.username as recipient_username
      FROM email_queue eq
      LEFT JOIN users u ON eq.recipient_user_id = u.user_id
      ${whereClause}
      ORDER BY eq.created_at DESC
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `;

    const dataResult = await executeQuery(dataQuery, params);

    logger.success('Email queue fetched', {
      count: dataResult.recordset.length,
      total: totalRecords
    });

    return res.status(200).json(
      createResponse(true, 'Email queue fetched successfully', {
        emails: dataResult.recordset,
        pagination: {
          currentPage: parseInt(page),
          limit: parseInt(limit),
          totalRecords,
          totalPages: Math.ceil(totalRecords / parseInt(limit))
        }
      })
    );

  } catch (error) {
    logger.error('Get email queue error', error);
    next(error);
  }
};

// ============================================
// GET EMAIL QUEUE STATISTICS
// @route GET /api/v1/email-queue/stats
// @access Private (Admin only)
// ============================================
const getEmailQueueStats = async (req, res, next) => {
  try {
    logger.try('Fetching email queue statistics');

    // Check admin permission
    if (!req.user.permissions?.can_manage_system) {
      return res.status(403).json(
        createResponse(false, 'You do not have permission to view statistics')
      );
    }

    const stats = await emailQueueService.getQueueStats();

    // Get recent 7 days trend
    const trendQuery = `
      SELECT 
        CAST(created_at AS DATE) as date,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'SENT' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed
      FROM email_queue
      WHERE created_at >= DATEADD(DAY, -7, GETDATE())
      GROUP BY CAST(created_at AS DATE)
      ORDER BY date DESC
    `;

    const trendResult = await executeQuery(trendQuery);

    // Get email types distribution
    const typeQuery = `
      SELECT 
        email_type,
        COUNT(*) as count,
        SUM(CASE WHEN status = 'SENT' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed
      FROM email_queue
      GROUP BY email_type
      ORDER BY count DESC
    `;

    const typeResult = await executeQuery(typeQuery);

    logger.success('Email queue statistics fetched');

    return res.status(200).json(
      createResponse(true, 'Statistics fetched successfully', {
        overview: stats,
        trend: trendResult.recordset,
        byType: typeResult.recordset
      })
    );

  } catch (error) {
    logger.error('Get email stats error', error);
    next(error);
  }
};

// ============================================
// GET SINGLE EMAIL DETAILS
// @route GET /api/v1/email-queue/:id
// @access Private (Admin only)
// ============================================
const getEmailById = async (req, res, next) => {
  try {
    const emailId = req.params.id;

    logger.try('Fetching email details', { emailId });

    // Check admin permission
    if (!req.user.permissions?.can_manage_system) {
      return res.status(403).json(
        createResponse(false, 'You do not have permission to view email details')
      );
    }

    const query = `
      SELECT 
        eq.*,
        u.username as recipient_username,
        u.email as recipient_user_email
      FROM email_queue eq
      LEFT JOIN users u ON eq.recipient_user_id = u.user_id
      WHERE eq.email_id = @emailId
    `;

    const result = await executeQuery(query, { emailId });

    if (result.recordset.length === 0) {
      return res.status(404).json(
        createResponse(false, 'Email not found')
      );
    }

    logger.success('Email details fetched', { emailId });

    return res.status(200).json(
      createResponse(true, 'Email fetched successfully', result.recordset[0])
    );

  } catch (error) {
    logger.error('Get email by ID error', error);
    next(error);
  }
};

// ============================================
// RETRY FAILED EMAIL
// @route POST /api/v1/email-queue/:id/retry
// @access Private (Admin only)
// ============================================
const retryEmail = async (req, res, next) => {
  try {
    const emailId = req.params.id;

    logger.try('Retrying failed email', { emailId, userId: req.user.user_id });

    // Check admin permission
    if (!req.user.permissions?.can_manage_system) {
      return res.status(403).json(
        createResponse(false, 'You do not have permission to retry emails')
      );
    }

    const success = await emailQueueService.retryEmail(emailId);

    if (success) {
      logger.success('Email retry successful', { emailId });
      return res.status(200).json(
        createResponse(true, 'Email retried successfully')
      );
    } else {
      logger.warn('Email retry failed', { emailId });
      return res.status(400).json(
        createResponse(false, 'Failed to retry email')
      );
    }

  } catch (error) {
    logger.error('Retry email error', error);
    next(error);
  }
};

// ============================================
// RETRY ALL FAILED EMAILS
// @route POST /api/v1/email-queue/retry-all-failed
// @access Private (Admin only)
// ============================================
const retryAllFailed = async (req, res, next) => {
  try {
    logger.try('Retrying all failed emails', { userId: req.user.user_id });

    // Check admin permission
    if (!req.user.permissions?.can_manage_system) {
      return res.status(403).json(
        createResponse(false, 'You do not have permission to retry emails')
      );
    }

    // Get all failed emails
    const query = `
      SELECT email_id
      FROM email_queue
      WHERE status = 'FAILED'
        AND retry_count < max_retries
    `;

    const result = await executeQuery(query);
    const failedEmails = result.recordset;

    if (failedEmails.length === 0) {
      return res.status(200).json(
        createResponse(true, 'No failed emails to retry', { retried: 0 })
      );
    }

    let successCount = 0;
    for (const email of failedEmails) {
      const success = await emailQueueService.retryEmail(email.email_id);
      if (success) successCount++;
    }

    logger.success('Bulk retry completed', {
      total: failedEmails.length,
      success: successCount
    });

    return res.status(200).json(
      createResponse(true, `Retried ${successCount}/${failedEmails.length} emails`, {
        total: failedEmails.length,
        retried: successCount
      })
    );

  } catch (error) {
    logger.error('Retry all failed error', error);
    next(error);
  }
};

// ============================================
// DELETE EMAIL FROM QUEUE
// @route DELETE /api/v1/email-queue/:id
// @access Private (Admin only)
// ============================================
const deleteEmail = async (req, res, next) => {
  try {
    const emailId = req.params.id;

    logger.try('Deleting email from queue', { emailId, userId: req.user.user_id });

    // Check admin permission
    if (!req.user.permissions?.can_manage_system) {
      return res.status(403).json(
        createResponse(false, 'You do not have permission to delete emails')
      );
    }

    const query = `
      DELETE FROM email_queue
      WHERE email_id = @emailId
    `;

    await executeQuery(query, { emailId });

    logger.success('Email deleted from queue', { emailId });

    return res.status(200).json(
      createResponse(true, 'Email deleted successfully')
    );

  } catch (error) {
    logger.error('Delete email error', error);
    next(error);
  }
};

// ============================================
// CLEAR OLD EMAILS
// @route DELETE /api/v1/email-queue/clear-old
// @access Private (Admin only)
// ============================================
const clearOldEmails = async (req, res, next) => {
  try {
    const { days = 30 } = req.query;

    logger.try('Clearing old emails', { days, userId: req.user.user_id });

    // Check admin permission
    if (!req.user.permissions?.can_manage_system) {
      return res.status(403).json(
        createResponse(false, 'You do not have permission to clear emails')
      );
    }

    const query = `
      DELETE FROM email_queue
      WHERE status IN ('SENT', 'FAILED')
        AND created_at < DATEADD(DAY, -@days, GETDATE())
    `;

    const result = await executeQuery(query, { days: parseInt(days) });

    logger.success('Old emails cleared', { deletedCount: result.rowsAffected[0] });

    return res.status(200).json(
      createResponse(true, `Cleared ${result.rowsAffected[0]} old emails`, {
        deletedCount: result.rowsAffected[0]
      })
    );

  } catch (error) {
    logger.error('Clear old emails error', error);
    next(error);
  }
};

// ============================================
// EXPORT
// ============================================
module.exports = {
  getEmailQueue,
  getEmailQueueStats,
  getEmailById,
  retryEmail,
  retryAllFailed,
  deleteEmail,
  clearOldEmails
};
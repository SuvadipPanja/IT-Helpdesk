// ============================================
// RATINGS CONTROLLER - Full Rating & Feedback System
// Handles ticket ratings, engineer analytics, and feedback
// Developer: Suvadip Panja
// Created: March 2026
// FILE: backend/controllers/ratings.controller.js
// ============================================

const { executeQuery } = require('../config/database');
const { createResponse } = require('../utils/helpers');
const logger = require('../utils/logger');
const settingsService = require('../services/settings.service');
const emailQueueService = require('../services/emailQueue.service');
const { getPublicAppUrl } = require('../utils/publicUrl');

// ============================================
// Helper: Generate star string for email (HTML)
// ============================================
const generateStars = (rating) => {
  const full = Math.floor(rating);
  const empty = 5 - full;
  // Use HTML entities that render reliably in all email clients
  const starFull = '<span style="color:#f59e0b;font-size:18px;">&#9733;</span>';
  const starEmpty = '<span style="color:#d1d5db;font-size:18px;">&#9734;</span>';
  return starFull.repeat(full) + starEmpty.repeat(empty) + ` <strong>(${rating}/5)</strong>`;
};

// ============================================
// SUBMIT RATING
// @route   POST /api/v1/ratings/:ticketId
// @access  Private (Ticket Creator only)
// ============================================
const submitRating = async (req, res, next) => {
  try {
    const ticketId = req.params.ticketId;
    const userId = req.user.user_id;
    const {
      resolution_quality,
      timeliness,
      satisfaction,
      professionalism,
      feedback_text
    } = req.body;

    logger.separator('TICKET RATING SUBMISSION');
    logger.try('Submitting rating', { ticketId, userId });

    // Validate ratings (1-5)
    const ratings = { resolution_quality, timeliness, satisfaction, professionalism };
    for (const [key, val] of Object.entries(ratings)) {
      const num = parseInt(val);
      if (!num || num < 1 || num > 5) {
        logger.warn('Invalid rating value', { field: key, value: val });
        logger.separator();
        return res.status(400).json(
          createResponse(false, `${key.replace(/_/g, ' ')} must be between 1 and 5`)
        );
      }
    }

    // Get ticket details
    const ticketResult = await executeQuery(
      `SELECT 
        t.ticket_id, t.ticket_number, t.subject,
        t.requester_id, t.assigned_to,
        ts.status_code, ts.is_final_status,
        u_req.first_name + ' ' + u_req.last_name as requester_name,
        u_req.email as requester_email,
        u_eng.first_name + ' ' + u_eng.last_name as engineer_name,
        u_eng.email as engineer_email
      FROM tickets t
      LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
      LEFT JOIN users u_req ON t.requester_id = u_req.user_id
      LEFT JOIN users u_eng ON t.assigned_to = u_eng.user_id
      WHERE t.ticket_id = @ticketId`,
      { ticketId }
    );

    if (ticketResult.recordset.length === 0) {
      logger.warn('Ticket not found for rating', { ticketId });
      logger.separator();
      return res.status(404).json(createResponse(false, 'Ticket not found'));
    }

    const ticket = ticketResult.recordset[0];

    // Verify: only ticket creator can rate
    if (ticket.requester_id !== userId) {
      logger.warn('Unauthorized rating attempt', { userId, requesterId: ticket.requester_id });
      logger.separator();
      return res.status(403).json(
        createResponse(false, 'Only the ticket creator can submit a rating')
      );
    }

    // Verify: ticket must be closed/resolved
    if (!ticket.is_final_status) {
      logger.warn('Ticket not in final status for rating', { ticketId, status: ticket.status_code });
      logger.separator();
      return res.status(400).json(
        createResponse(false, 'Ticket must be closed or resolved before rating')
      );
    }

    // Verify: ticket must have an assigned engineer
    if (!ticket.assigned_to) {
      logger.warn('No engineer assigned to rate', { ticketId });
      logger.separator();
      return res.status(400).json(
        createResponse(false, 'Cannot rate — no engineer was assigned to this ticket')
      );
    }

    // Check if already rated
    const existingRating = await executeQuery(
      'SELECT rating_id FROM ticket_ratings WHERE ticket_id = @ticketId',
      { ticketId }
    );

    if (existingRating.recordset.length > 0) {
      logger.warn('Ticket already rated', { ticketId });
      logger.separator();
      return res.status(400).json(
        createResponse(false, 'This ticket has already been rated')
      );
    }

    // Calculate overall rating (average of 4 criteria)
    const rq = parseInt(resolution_quality, 10) || 0;
    const tl = parseInt(timeliness, 10) || 0;
    const sf = parseInt(satisfaction, 10) || 0;
    const pf = parseInt(professionalism, 10) || 0;
    const overall = parseFloat(((rq + tl + sf + pf) / 4).toFixed(2)) || 0;

    // Insert rating
    const insertResult = await executeQuery(
      `INSERT INTO ticket_ratings (
        ticket_id, rated_by, rated_engineer_id,
        resolution_quality, timeliness, satisfaction, professionalism,
        overall_rating, feedback_text
      )
      OUTPUT INSERTED.rating_id
      VALUES (
        @ticketId, @ratedBy, @engineerId,
        @resolutionQuality, @timeliness, @satisfaction, @professionalism,
        @overallRating, @feedbackText
      )`,
      {
        ticketId,
        ratedBy: userId,
        engineerId: ticket.assigned_to,
        resolutionQuality: rq,
        timeliness: tl,
        satisfaction: sf,
        professionalism: pf,
        overallRating: overall,
        feedbackText: feedback_text?.trim() || null
      }
    );

    const ratingId = insertResult.recordset?.[0]?.rating_id;

    // Update ticket with overall rating and feedback
    await executeQuery(
      `UPDATE tickets 
       SET rating = @rating, feedback = @feedback, rated_at = GETDATE(), updated_at = GETDATE()
       WHERE ticket_id = @ticketId`,
      {
        rating: overall,
        feedback: feedback_text?.trim() || null,
        ticketId
      }
    );

    // Log activity
    await executeQuery(
      `INSERT INTO ticket_activities (
        ticket_id, activity_type, field_name, old_value, new_value, description, performed_by
      )
      VALUES (@ticketId, 'RATED', 'rating', NULL, @rating, @description, @userId)`,
      {
        ticketId,
        rating: `${overall}/5`,
        description: `Ticket rated ${overall}/5 by ${ticket.requester_name}. Resolution: ${rq}/5, Timeliness: ${tl}/5, Satisfaction: ${sf}/5, Professionalism: ${pf}/5`,
        userId
      }
    );

    logger.success('Rating submitted', { ratingId, ticketId, overall });

    // ============================================
    // NOTIFICATIONS & EMAIL
    // ============================================
    try {
      const notificationSettings = await settingsService.getByCategory('notification');
      const generalSettings = await settingsService.getByCategory('general');
      const appUrl = getPublicAppUrl();

      // NOTIFICATION: Engineer — Rating received
      await executeQuery(
        `INSERT INTO notifications (user_id, notification_type, title, message, related_ticket_id)
         VALUES (@engineerId, 'RATING_RECEIVED', 'New Rating Received',
                 @message, @ticketId)`,
        {
          engineerId: ticket.assigned_to,
          message: `You received a ${overall}/5 rating on ticket #${ticket.ticket_number} from ${ticket.requester_name}`,
          ticketId
        }
      );
      logger.success('Rating notification sent to engineer');

      // EMAIL: Send rating received email to engineer
      const emailEnabled = notificationSettings.notify_on_ticket_updated === 'true' || notificationSettings.notify_on_ticket_updated === true;

      if (emailEnabled && ticket.engineer_email) {
        await emailQueueService.sendTemplatedEmail(
          'TICKET_RATING_RECEIVED',
          ticket.engineer_email,
          {
            ticket_number: ticket.ticket_number,
            subject: ticket.subject,
            user_name: ticket.engineer_name,
            rated_by_name: ticket.requester_name,
            resolution_quality_stars: generateStars(rq),
            timeliness_stars: generateStars(tl),
            satisfaction_stars: generateStars(sf),
            professionalism_stars: generateStars(pf),
            overall_rating_stars: generateStars(Math.round(overall)),
            feedback_text: feedback_text?.trim() || '',
            ticket_url: `${appUrl}/tickets/${ticketId}`,
            system_name: generalSettings.system_name || 'IT Helpdesk'
          },
          {
            recipientName: ticket.engineer_name,
            emailType: 'TICKET_RATING_RECEIVED',
            relatedEntityType: 'TICKET',
            relatedEntityId: ticketId,
            priority: 3
          }
        );
        logger.success('Rating email queued for engineer');
      }
    } catch (notifError) {
      logger.error('Failed to send rating notifications', notifError);
    }

    logger.separator('RATING SUBMITTED SUCCESSFULLY');

    return res.status(201).json(
      createResponse(true, 'Rating submitted successfully', {
        rating_id: ratingId,
        overall_rating: overall,
        resolution_quality: rq,
        timeliness: tl,
        satisfaction: sf,
        professionalism: pf,
        feedback_text: feedback_text?.trim() || null
      })
    );
  } catch (error) {
    logger.error('Submit rating error', error);
    logger.separator();
    next(error);
  }
};

// ============================================
// GET RATING FOR A TICKET
// @route   GET /api/v1/ratings/:ticketId
// @access  Private
// ============================================
const getTicketRating = async (req, res, next) => {
  try {
    const ticketId = req.params.ticketId;

    const result = await executeQuery(
      `SELECT 
        r.rating_id, r.ticket_id, r.rated_by, r.rated_engineer_id,
        r.resolution_quality, r.timeliness, r.satisfaction, r.professionalism,
        r.overall_rating, r.feedback_text, r.created_at,
        u_rater.first_name + ' ' + u_rater.last_name as rated_by_name,
        u_eng.first_name + ' ' + u_eng.last_name as engineer_name
      FROM ticket_ratings r
      LEFT JOIN users u_rater ON r.rated_by = u_rater.user_id
      LEFT JOIN users u_eng ON r.rated_engineer_id = u_eng.user_id
      WHERE r.ticket_id = @ticketId`,
      { ticketId }
    );

    if (result.recordset.length === 0) {
      return res.status(200).json(
        createResponse(true, 'No rating found', null)
      );
    }

    return res.status(200).json(
      createResponse(true, 'Rating fetched', result.recordset[0])
    );
  } catch (error) {
    logger.error('Get ticket rating error', error);
    next(error);
  }
};

// ============================================
// GET ENGINEER RATINGS SUMMARY
// @route   GET /api/v1/ratings/engineer/:engineerId
// @access  Private (Admin/Manager/Self)
// ============================================
const getEngineerRatings = async (req, res, next) => {
  try {
    const engineerId = req.params.engineerId;
    const userId = req.user.user_id;
    const roleCode = req.user.role?.role_code || '';
    const isAdminOrManager = roleCode === 'ADMIN' || roleCode === 'MANAGER';

    // Only admin/manager or the engineer themselves can view
    if (!isAdminOrManager && parseInt(engineerId) !== userId) {
      return res.status(403).json(
        createResponse(false, 'You do not have permission to view these ratings')
      );
    }

    // Get summary stats
    const summaryResult = await executeQuery(
      `SELECT 
        COUNT(*) as total_ratings,
        CAST(AVG(CAST(overall_rating AS FLOAT)) AS DECIMAL(3,2)) as avg_overall,
        CAST(AVG(CAST(resolution_quality AS FLOAT)) AS DECIMAL(3,2)) as avg_resolution_quality,
        CAST(AVG(CAST(timeliness AS FLOAT)) AS DECIMAL(3,2)) as avg_timeliness,
        CAST(AVG(CAST(satisfaction AS FLOAT)) AS DECIMAL(3,2)) as avg_satisfaction,
        CAST(AVG(CAST(professionalism AS FLOAT)) AS DECIMAL(3,2)) as avg_professionalism,
        MIN(overall_rating) as min_rating,
        MAX(overall_rating) as max_rating,
        SUM(CASE WHEN overall_rating >= 4.0 THEN 1 ELSE 0 END) as positive_ratings,
        SUM(CASE WHEN overall_rating < 3.0 THEN 1 ELSE 0 END) as negative_ratings
      FROM ticket_ratings
      WHERE rated_engineer_id = @engineerId`,
      { engineerId }
    );

    // Get rating distribution (1-5)
    const distributionResult = await executeQuery(
      `SELECT 
        CAST(ROUND(overall_rating, 0) AS INT) as stars,
        COUNT(*) as count
      FROM ticket_ratings
      WHERE rated_engineer_id = @engineerId
      GROUP BY CAST(ROUND(overall_rating, 0) AS INT)
      ORDER BY stars`,
      { engineerId }
    );

    // Build distribution array (always 5 entries)
    const distribution = [1, 2, 3, 4, 5].map(star => {
      const found = distributionResult.recordset.find(d => d.stars === star);
      return { stars: star, count: found ? found.count : 0 };
    });

    // Get recent ratings (last 10)
    const recentResult = await executeQuery(
      `SELECT TOP 10
        r.rating_id, r.ticket_id, r.resolution_quality, r.timeliness,
        r.satisfaction, r.professionalism, r.overall_rating,
        r.feedback_text, r.created_at,
        t.ticket_number, t.subject,
        u.first_name + ' ' + u.last_name as rated_by_name
      FROM ticket_ratings r
      LEFT JOIN tickets t ON r.ticket_id = t.ticket_id
      LEFT JOIN users u ON r.rated_by = u.user_id
      WHERE r.rated_engineer_id = @engineerId
      ORDER BY r.created_at DESC`,
      { engineerId }
    );

    // Get monthly trend (last 6 months)
    const trendResult = await executeQuery(
      `SELECT 
        FORMAT(created_at, 'yyyy-MM') as month,
        COUNT(*) as count,
        CAST(AVG(CAST(overall_rating AS FLOAT)) AS DECIMAL(3,2)) as avg_rating
      FROM ticket_ratings
      WHERE rated_engineer_id = @engineerId
        AND created_at >= DATEADD(MONTH, -6, GETDATE())
      GROUP BY FORMAT(created_at, 'yyyy-MM')
      ORDER BY month`,
      { engineerId }
    );

    return res.status(200).json(
      createResponse(true, 'Engineer ratings fetched', {
        summary: summaryResult.recordset[0],
        distribution,
        recent_ratings: recentResult.recordset,
        monthly_trend: trendResult.recordset
      })
    );
  } catch (error) {
    logger.error('Get engineer ratings error', error);
    next(error);
  }
};

// ============================================
// GET ALL ENGINEERS RATING LEADERBOARD
// @route   GET /api/v1/ratings/leaderboard
// @access  Private (Admin/Manager)
// ============================================
const getRatingLeaderboard = async (req, res, next) => {
  try {
    const roleCode = req.user.role?.role_code || '';
    const isAdminOrManager = roleCode === 'ADMIN' || roleCode === 'MANAGER';

    if (!isAdminOrManager) {
      return res.status(403).json(
        createResponse(false, 'Only admin/manager can view the leaderboard')
      );
    }

    const result = await executeQuery(
      `SELECT 
        r.rated_engineer_id,
        u.first_name + ' ' + u.last_name as engineer_name,
        u.username,
        u.email,
        d.department_name,
        COUNT(*) as total_ratings,
        CAST(AVG(CAST(r.overall_rating AS FLOAT)) AS DECIMAL(3,2)) as avg_overall,
        CAST(AVG(CAST(r.resolution_quality AS FLOAT)) AS DECIMAL(3,2)) as avg_resolution_quality,
        CAST(AVG(CAST(r.timeliness AS FLOAT)) AS DECIMAL(3,2)) as avg_timeliness,
        CAST(AVG(CAST(r.satisfaction AS FLOAT)) AS DECIMAL(3,2)) as avg_satisfaction,
        CAST(AVG(CAST(r.professionalism AS FLOAT)) AS DECIMAL(3,2)) as avg_professionalism,
        SUM(CASE WHEN r.overall_rating >= 4.0 THEN 1 ELSE 0 END) as positive_count,
        SUM(CASE WHEN r.overall_rating < 3.0 THEN 1 ELSE 0 END) as negative_count
      FROM ticket_ratings r
      LEFT JOIN users u ON r.rated_engineer_id = u.user_id
      LEFT JOIN departments d ON u.department_id = d.department_id
      GROUP BY r.rated_engineer_id, u.first_name, u.last_name, u.username, u.email, d.department_name
      ORDER BY avg_overall DESC, total_ratings DESC`
    );

    return res.status(200).json(
      createResponse(true, 'Rating leaderboard fetched', result.recordset)
    );
  } catch (error) {
    logger.error('Get rating leaderboard error', error);
    next(error);
  }
};

// ============================================
// GET RATING ANALYTICS (Overview Stats)
// @route   GET /api/v1/ratings/analytics
// @access  Private (Admin/Manager)
// ============================================
const getRatingAnalytics = async (req, res, next) => {
  try {
    const roleCode = req.user.role?.role_code || '';
    const isAdminOrManager = roleCode === 'ADMIN' || roleCode === 'MANAGER';

    if (!isAdminOrManager) {
      return res.status(403).json(
        createResponse(false, 'Only admin/manager can view rating analytics')
      );
    }

    const { start_date, end_date } = req.query;

    let dateFilter = '';
    const params = {};
    if (start_date && end_date) {
      dateFilter = 'AND r.created_at BETWEEN @startDate AND @endDate';
      params.startDate = start_date;
      params.endDate = end_date;
    }

    // Overall stats
    const statsResult = await executeQuery(
      `SELECT 
        COUNT(*) as total_ratings,
        CAST(AVG(CAST(overall_rating AS FLOAT)) AS DECIMAL(3,2)) as avg_overall,
        CAST(AVG(CAST(resolution_quality AS FLOAT)) AS DECIMAL(3,2)) as avg_resolution_quality,
        CAST(AVG(CAST(timeliness AS FLOAT)) AS DECIMAL(3,2)) as avg_timeliness,
        CAST(AVG(CAST(satisfaction AS FLOAT)) AS DECIMAL(3,2)) as avg_satisfaction,
        CAST(AVG(CAST(professionalism AS FLOAT)) AS DECIMAL(3,2)) as avg_professionalism,
        SUM(CASE WHEN overall_rating >= 4.0 THEN 1 ELSE 0 END) as positive,
        SUM(CASE WHEN overall_rating >= 3.0 AND overall_rating < 4.0 THEN 1 ELSE 0 END) as neutral,
        SUM(CASE WHEN overall_rating < 3.0 THEN 1 ELSE 0 END) as negative,
        (SELECT COUNT(*) FROM tickets t 
         INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id 
         WHERE ts.is_final_status = 1) as total_closed_tickets
      FROM ticket_ratings r
      WHERE 1=1 ${dateFilter}`,
      params
    );

    // Rating distribution
    const distResult = await executeQuery(
      `SELECT 
        CAST(ROUND(overall_rating, 0) AS INT) as stars,
        COUNT(*) as count
      FROM ticket_ratings r
      WHERE 1=1 ${dateFilter}
      GROUP BY CAST(ROUND(overall_rating, 0) AS INT)
      ORDER BY stars`,
      params
    );

    const distribution = [1, 2, 3, 4, 5].map(star => {
      const found = distResult.recordset.find(d => d.stars === star);
      return { stars: star, count: found ? found.count : 0 };
    });

    // Monthly trend
    const trendResult = await executeQuery(
      `SELECT 
        FORMAT(r.created_at, 'yyyy-MM') as month,
        COUNT(*) as count,
        CAST(AVG(CAST(r.overall_rating AS FLOAT)) AS DECIMAL(3,2)) as avg_rating
      FROM ticket_ratings r
      WHERE r.created_at >= DATEADD(MONTH, -12, GETDATE()) ${dateFilter.replace('AND', 'AND')}
      GROUP BY FORMAT(r.created_at, 'yyyy-MM')
      ORDER BY month`,
      params
    );

    // Top rated engineers (top 5)
    const topEngineersResult = await executeQuery(
      `SELECT TOP 5
        r.rated_engineer_id,
        u.first_name + ' ' + u.last_name as engineer_name,
        COUNT(*) as total_ratings,
        CAST(AVG(CAST(r.overall_rating AS FLOAT)) AS DECIMAL(3,2)) as avg_rating
      FROM ticket_ratings r
      LEFT JOIN users u ON r.rated_engineer_id = u.user_id
      WHERE 1=1 ${dateFilter}
      GROUP BY r.rated_engineer_id, u.first_name, u.last_name
      HAVING COUNT(*) >= 1
      ORDER BY avg_rating DESC, total_ratings DESC`,
      params
    );

    // Category-wise satisfaction
    const categoryResult = await executeQuery(
      `SELECT 
        'Resolution Quality' as category, 
        CAST(AVG(CAST(r.resolution_quality AS FLOAT)) AS DECIMAL(3,2)) as avg_score
      FROM ticket_ratings r WHERE 1=1 ${dateFilter}
      UNION ALL
      SELECT 'Timeliness', CAST(AVG(CAST(r.timeliness AS FLOAT)) AS DECIMAL(3,2))
      FROM ticket_ratings r WHERE 1=1 ${dateFilter}
      UNION ALL
      SELECT 'Satisfaction', CAST(AVG(CAST(r.satisfaction AS FLOAT)) AS DECIMAL(3,2))
      FROM ticket_ratings r WHERE 1=1 ${dateFilter}
      UNION ALL
      SELECT 'Professionalism', CAST(AVG(CAST(r.professionalism AS FLOAT)) AS DECIMAL(3,2))
      FROM ticket_ratings r WHERE 1=1 ${dateFilter}`,
      params
    );

    const stats = statsResult.recordset[0];

    return res.status(200).json(
      createResponse(true, 'Rating analytics fetched', {
        overview: {
          total_ratings: stats.total_ratings,
          total_closed_tickets: stats.total_closed_tickets,
          rating_rate: stats.total_closed_tickets > 0
            ? parseFloat(((stats.total_ratings / stats.total_closed_tickets) * 100).toFixed(1))
            : 0,
          avg_overall: stats.avg_overall,
          avg_resolution_quality: stats.avg_resolution_quality,
          avg_timeliness: stats.avg_timeliness,
          avg_satisfaction: stats.avg_satisfaction,
          avg_professionalism: stats.avg_professionalism,
          positive: stats.positive,
          neutral: stats.neutral,
          negative: stats.negative
        },
        distribution,
        monthly_trend: trendResult.recordset,
        top_engineers: topEngineersResult.recordset,
        category_scores: categoryResult.recordset
      })
    );
  } catch (error) {
    logger.error('Get rating analytics error', error);
    next(error);
  }
};

// ============================================
// EXPORT
// ============================================
module.exports = {
  submitRating,
  getTicketRating,
  getEngineerRatings,
  getRatingLeaderboard,
  getRatingAnalytics
};

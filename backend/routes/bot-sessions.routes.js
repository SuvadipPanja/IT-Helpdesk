// ============================================
// BOT SESSIONS API ROUTES
// Endpoints for session listing, viewing, downloading, stats
// Created: March 2026
// ============================================

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const botSessionService = require('../services/botSessionService');
const logger = require('../utils/logger');

// ============================================
// GET /api/v1/bot/sessions
// List all sessions with pagination and filters
// Requires: can_manage_system permission
// ============================================
router.get('/', authenticate, async (req, res) => {
  try {
    // Only admins can list all sessions
    if (!req.user?.permissions?.can_manage_system) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. System management permission required.'
      });
    }

    const { page, limit, userId, dateFrom, dateTo, isActive, search } = req.query;

    const result = await botSessionService.listSessions({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      userId: userId ? parseInt(userId) : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      isActive: isActive !== undefined ? isActive : undefined,
      search: search || undefined
    });

    res.json({
      success: true,
      data: result.sessions,
      pagination: result.pagination
    });
  } catch (error) {
    logger.error('Error listing bot sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list sessions'
    });
  }
});

// ============================================
// GET /api/v1/bot/sessions/stats/dashboard
// Get real-time dashboard statistics
// Requires: can_manage_system permission
// ============================================
router.get('/stats/dashboard', authenticate, async (req, res) => {
  try {
    if (!req.user?.permissions?.can_manage_system) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. System management permission required.'
      });
    }

    const stats = await botSessionService.getDashboardStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error getting dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get dashboard statistics'
    });
  }
});

// ============================================
// GET /api/v1/bot/sessions/stats/user/:userId
// Get session stats for a specific user
// ============================================
router.get('/stats/user/:userId', authenticate, async (req, res) => {
  try {
    const targetUserId = parseInt(req.params.userId);
    
    // Users can only see their own stats unless they have admin rights
    if (req.user.user_id !== targetUserId && !req.user?.permissions?.can_manage_system) {
      return res.status(403).json({
        success: false,
        message: 'Access denied.'
      });
    }

    const stats = await botSessionService.getUserSessionStats(targetUserId);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Error getting user session stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user statistics'
    });
  }
});

// ============================================
// GET /api/v1/bot/sessions/:sessionId
// Get full session detail with all messages
// Requires: can_manage_system OR own session
// ============================================
router.get('/:sessionId', authenticate, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const detail = await botSessionService.getSessionDetail(sessionId);

    if (!detail) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Check access: admin or session owner
    if (detail.session.user_id !== req.user.user_id && !req.user?.permissions?.can_manage_system) {
      return res.status(403).json({
        success: false,
        message: 'Access denied.'
      });
    }

    res.json({
      success: true,
      data: detail
    });
  } catch (error) {
    logger.error('Error getting session detail:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get session detail'
    });
  }
});

// ============================================
// GET /api/v1/bot/sessions/:sessionId/download
// Download session as JSON
// ============================================
router.get('/:sessionId/download', authenticate, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { format } = req.query; // 'json' or 'csv'

    // Check session exists & access
    const session = await botSessionService.getSessionById(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    if (session.user_id !== req.user.user_id && !req.user?.permissions?.can_manage_system) {
      return res.status(403).json({
        success: false,
        message: 'Access denied.'
      });
    }

    if (format === 'csv') {
      const csvData = await botSessionService.exportSessionCSV(sessionId);
      if (!csvData) {
        return res.status(404).json({ success: false, message: 'No data to export' });
      }
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="bot-session-${sessionId}.csv"`);
      return res.send(csvData);
    }

    // Default: JSON
    const exportData = await botSessionService.exportSession(sessionId);
    if (!exportData) {
      return res.status(404).json({ success: false, message: 'No data to export' });
    }
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="bot-session-${sessionId}.json"`);
    return res.json(exportData);
  } catch (error) {
    logger.error('Error downloading session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download session'
    });
  }
});

// ============================================
// PATCH /api/v1/bot/sessions/:sessionId/end
// End an active session
// ============================================
router.patch('/:sessionId/end', authenticate, async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Can end own session or admin can end any
    const session = await botSessionService.getSessionById(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    if (session.user_id !== req.user.user_id && !req.user?.permissions?.can_manage_system) {
      return res.status(403).json({
        success: false,
        message: 'Access denied.'
      });
    }

    const result = await botSessionService.endSession(sessionId, session.user_id);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error ending session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to end session'
    });
  }
});

// ============================================
// POST /api/v1/bot/sessions/cleanup
// Admin: Close inactive sessions and optionally purge old
// ============================================
router.post('/cleanup', authenticate, async (req, res) => {
  try {
    if (!req.user?.permissions?.can_manage_system) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. System management permission required.'
      });
    }

    const { hoursThreshold, purgeDays } = req.body;

    const closeResult = await botSessionService.closeInactiveSessions(hoursThreshold || 2);
    let purgeResult = null;
    
    if (purgeDays) {
      purgeResult = await botSessionService.purgeOldSessions(purgeDays);
    }

    res.json({
      success: true,
      data: {
        closedSessions: closeResult.closedCount,
        purgedSessions: purgeResult?.purgedCount || 0
      }
    });
  } catch (error) {
    logger.error('Error in session cleanup:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform cleanup'
    });
  }
});

module.exports = router;

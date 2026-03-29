const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const contextAwareness = require('../services/contextAwareness.service');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * POST /api/v1/bot/context/initialize
 * Initialize a new conversation context/session
 */
router.post('/initialize', authenticate, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const sessionId = uuidv4();

    const result = await contextAwareness.initializeConversation(userId, sessionId);

    logger.info(`Conversation initialized for user ${userId}, session ${sessionId}`);

    return res.json({
      success: true,
      message: 'Conversation context initialized',
      sessionId,
      expiresIn: '24 hours'
    });

  } catch (error) {
    logger.error('Error initializing context:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/bot/context/:sessionId
 * Get conversation context
 */
router.get('/:sessionId', authenticate, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.user_id;

    const context = await contextAwareness.getContext(sessionId);

    if (!context) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    // Verify session belongs to user
    if (context.user_id !== userId) {
      return res.status(403).json({ success: false, error: 'Unauthorized access to session' });
    }

    return res.json({
      success: true,
      sessionId,
      context
    });

  } catch (error) {
    logger.error('Error fetching context:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v1/bot/context/:sessionId
 * Update conversation context
 */
router.post('/:sessionId', authenticate, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { key, value } = req.body;
    const userId = req.user.user_id;

    if (!key) {
      return res.status(400).json({ success: false, error: 'Key is required' });
    }

    // Verify session belongs to user
    const context = await contextAwareness.getContext(sessionId);
    if (!context || context.user_id !== userId) {
      return res.status(403).json({ success: false, error: 'Unauthorized access to session' });
    }

    await contextAwareness.updateContext(sessionId, key, value);

    logger.info(`Context updated for session ${sessionId}, key: ${key}`);

    return res.json({
      success: true,
      message: 'Context updated',
      sessionId,
      key,
      value
    });

  } catch (error) {
    logger.error('Error updating context:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/bot/context/:sessionId/history
 * Get conversation history
 */
router.get('/:sessionId/history', authenticate, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { limit } = req.query;
    const userId = req.user.user_id;

    // Verify session belongs to user
    const context = await contextAwareness.getContext(sessionId);
    if (!context || context.user_id !== userId) {
      return res.status(403).json({ success: false, error: 'Unauthorized access to session' });
    }

    const history = await contextAwareness.getConversationHistory(sessionId, limit ? parseInt(limit) : 50);

    return res.json({
      success: true,
      sessionId,
      count: history ? history.length : 0,
      history: history || []
    });

  } catch (error) {
    logger.error('Error fetching conversation history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v1/bot/context/:sessionId/history
 * Add messages to conversation history (batch)
 */
router.post('/:sessionId/history', authenticate, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { messages } = req.body;
    const userId = req.user.user_id;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ success: false, error: 'Messages array is required' });
    }

    // Verify session belongs to user
    const context = await contextAwareness.getContext(sessionId);
    if (!context || context.user_id !== userId) {
      return res.status(403).json({ success: false, error: 'Unauthorized access to session' });
    }

    await contextAwareness.persistConversationHistory(userId, sessionId, messages);

    logger.info(`${messages.length} messages persisted for session ${sessionId}`);

    return res.json({
      success: true,
      message: 'Messages persisted',
      sessionId,
      count: messages.length
    });

  } catch (error) {
    logger.error('Error persisting conversation history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/v1/bot/context/:sessionId
 * Clear conversation context
 */
router.delete('/:sessionId', authenticate, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.user_id;

    // Verify session belongs to user
    const context = await contextAwareness.getContext(sessionId);
    if (!context || context.user_id !== userId) {
      return res.status(403).json({ success: false, error: 'Unauthorized access to session' });
    }

    await contextAwareness.clearSession(sessionId);

    logger.info(`Session ${sessionId} cleared by user ${userId}`);

    return res.json({
      success: true,
      message: 'Session cleared',
      sessionId
    });

  } catch (error) {
    logger.error('Error clearing session:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/bot/context/sessions/me
 * Get all active sessions for user
 */
router.get('/sessions/me', authenticate, async (req, res) => {
  try {
    const userId = req.user.user_id;

    const sessions = await contextAwareness.getActiveSessions(userId);

    return res.json({
      success: true,
      userId,
      count: sessions ? sessions.length : 0,
      sessions: sessions || []
    });

  } catch (error) {
    logger.error('Error fetching user sessions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/bot/context/:sessionId/stats
 * Get session statistics
 */
router.get('/:sessionId/stats', authenticate, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.user_id;

    // Verify session belongs to user
    const context = await contextAwareness.getContext(sessionId);
    if (!context || context.user_id !== userId) {
      return res.status(403).json({ success: false, error: 'Unauthorized access to session' });
    }

    const stats = await contextAwareness.getSessionStats(sessionId);

    return res.json({
      success: true,
      sessionId,
      stats
    });

  } catch (error) {
    logger.error('Error fetching session stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

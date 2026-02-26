// ============================================
// AI ASSISTANT ROUTES
// POST /api/ai/chat — Process a chat message
// GET  /api/ai/topics — List available topics
// ============================================

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { handleChat, KNOWLEDGE_BASE } = require('../services/ai-engine.service');
const logger = require('../utils/logger');

/**
 * POST /api/ai/chat
 * Body: { message: string, sessionId?: string }
 * Returns: { answer, confidence, category, followUp, entities, matchedTopic }
 */
router.post('/chat', authenticate, async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    if (message.length > 1000) {
      return res.status(400).json({
        success: false,
        message: 'Message too long (max 1000 characters)'
      });
    }

    // Use user ID as session identifier for context tracking
    const sid = sessionId || `user-${req.user?.id || 'anon'}`;

    const result = handleChat(sid, message.trim());

    logger.info('AI Chat processed', {
      userId: req.user?.id,
      query: message.substring(0, 100),
      matchedTopic: result.matchedTopic?.id || 'none',
      confidence: result.confidence
    });

    res.json({
      success: true,
      data: {
        answer: result.answer,
        confidence: result.confidence,
        category: result.category,
        followUp: result.followUp,
        entities: result.entities,
        matchedTopic: result.matchedTopic
      }
    });
  } catch (error) {
    logger.error('AI Chat error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to process your question. Please try again.'
    });
  }
});

/**
 * GET /api/ai/topics
 * Returns list of available help topics
 */
router.get('/topics', authenticate, (req, res) => {
  try {
    const topics = KNOWLEDGE_BASE.map(entry => ({
      id: entry.id,
      category: entry.category,
      sample: entry.patterns[0] // first example question
    }));

    res.json({
      success: true,
      data: topics
    });
  } catch (error) {
    logger.error('AI Topics error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to load topics'
    });
  }
});

module.exports = router;

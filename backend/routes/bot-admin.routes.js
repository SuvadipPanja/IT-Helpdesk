const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const botPhase2Service = require('../services/botPhase2.service');
const logger = require('../utils/logger');

router.use(authenticate);
router.use(authorize('can_manage_system'));

router.get('/custom-intents', async (req, res) => {
  try {
    const intents = await botPhase2Service.listCustomIntents();
    return res.json({ success: true, data: intents });
  } catch (error) {
    logger.error('Error listing custom intents', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/custom-intents', async (req, res) => {
  try {
    const { intent_name, trigger_patterns } = req.body;
    if (!intent_name || !Array.isArray(trigger_patterns) || trigger_patterns.length === 0) {
      return res.status(400).json({ success: false, message: 'intent_name and trigger_patterns[] are required' });
    }

    const intentId = await botPhase2Service.createCustomIntent(req.body, req.user.user_id);
    return res.status(201).json({ success: true, intent_id: intentId });
  } catch (error) {
    logger.error('Error creating custom intent', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/custom-intents/:id', async (req, res) => {
  try {
    const rows = await botPhase2Service.updateCustomIntent(Number(req.params.id), req.body);
    if (!rows) {
      return res.status(404).json({ success: false, message: 'Custom intent not found' });
    }
    return res.json({ success: true, updated: rows });
  } catch (error) {
    logger.error('Error updating custom intent', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/custom-intents/:id', async (req, res) => {
  try {
    const rows = await botPhase2Service.deleteCustomIntent(Number(req.params.id));
    if (!rows) {
      return res.status(404).json({ success: false, message: 'Custom intent not found' });
    }
    return res.json({ success: true, deleted: rows });
  } catch (error) {
    logger.error('Error deleting custom intent', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.patch('/custom-intents/:id/toggle', async (req, res) => {
  try {
    const rows = await botPhase2Service.toggleCustomIntent(Number(req.params.id), !!req.body.enabled);
    if (!rows) {
      return res.status(404).json({ success: false, message: 'Custom intent not found' });
    }
    return res.json({ success: true, updated: rows });
  } catch (error) {
    logger.error('Error toggling custom intent', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/custom-intents/test', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ success: false, message: 'message is required' });
    }
    const match = await botPhase2Service.matchCustomIntent(message);
    return res.json({ success: true, matched: !!match, data: match });
  } catch (error) {
    logger.error('Error testing custom intent', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/analytics/overview', async (req, res) => {
  try {
    const overview = await botPhase2Service.getAnalyticsOverview();
    return res.json({ success: true, data: overview });
  } catch (error) {
    logger.error('Error loading bot analytics overview', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/analytics/intents', async (req, res) => {
  try {
    const usage = await botPhase2Service.getIntentUsageReport();
    return res.json({ success: true, data: usage });
  } catch (error) {
    logger.error('Error loading intent usage report', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/notifications/email', async (req, res) => {
  try {
    const payload = req.body || {};
    return res.json({
      success: true,
      message: 'Email notification request accepted. Connect this endpoint to your queue processor.',
      data: payload,
    });
  } catch (error) {
    logger.error('Error handling email notification', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/workflows/execute', async (req, res) => {
  try {
    const { action_type, action_config, context } = req.body;
    const result = await botPhase2Service.executeWorkflowAction(action_type, action_config, context || {});
    return res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Error executing workflow action', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

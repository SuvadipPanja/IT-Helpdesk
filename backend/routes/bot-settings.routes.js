// ============================================
// BOT SETTINGS & API PROVIDERS ROUTES
// Admin endpoints for bot configuration and API management
// Date: March 4, 2026
// ============================================

const express = require('express');
const router = express.Router();
const { authenticate, authorizeAny } = require('../middleware/auth');
const botConfigService = require('../services/botConfigService');
const botApiProviderService = require('../services/botApiProviderService');
const botApiIntegrationService = require('../services/botApiIntegrationService');
const botTrainingService = require('../services/botTrainingService');
const logger = require('../utils/logger');

const BOT_SETTINGS_PERMS = ['can_manage_system', 'can_manage_settings_bot'];

/**
 * GET /api/v1/bot/config/settings
 * Get all bot configuration settings
 */
router.get('/config/settings', authenticate, authorizeAny(BOT_SETTINGS_PERMS), async (req, res) => {
  try {
    const config = await botConfigService.getBotConfig();
    res.json({
      success: true,
      data: {
        settings: config
      }
    });
  } catch (error) {
    logger.error('Error fetching bot config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bot configuration'
    });
  }
});

/**
 * PUT /api/v1/bot/config/settings
 * Update bot configuration
 */
router.put('/config/settings', authenticate, authorizeAny(BOT_SETTINGS_PERMS), async (req, res) => {
  try {
    const { configName, configValue } = req.body;
    
    if (!configName) {
      return res.status(400).json({
        success: false,
        message: 'Config name is required'
      });
    }
    
    const updated = await botConfigService.updateBotConfig(configName, configValue, req.user.user_id);
    
    res.json({
      success: true,
      data: { config: updated },
      message: 'Configuration updated successfully'
    });
  } catch (error) {
    logger.error('Error updating bot config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update bot configuration'
    });
  }
});

/**
 * GET /api/v1/bot/config/features
 * Get all advanced features
 */
router.get('/config/features', authenticate, authorizeAny(BOT_SETTINGS_PERMS), async (req, res) => {
  try {
    const features = await botConfigService.getAdvancedFeatures();
    res.json({
      success: true,
      data: { features }
    });
  } catch (error) {
    logger.error('Error fetching features:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bot features'
    });
  }
});

/**
 * PATCH /api/v1/bot/config/features/:featureName/toggle
 * Toggle feature on/off
 */
router.patch('/config/features/:featureName/toggle', authenticate, authorizeAny(BOT_SETTINGS_PERMS), async (req, res) => {
  try {
    const { featureName } = req.params;
    const { enabled } = req.body;
    
    const updated = await botConfigService.toggleFeature(featureName, enabled, req.user.user_id);
    
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Feature not found'
      });
    }
    
    res.json({
      success: true,
      data: { feature: updated },
      message: `Feature ${enabled ? 'enabled' : 'disabled'} successfully`
    });
  } catch (error) {
    logger.error('Error toggling feature:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle feature'
    });
  }
});

/**
 * PUT /api/v1/bot/config/features/:featureName/config
 * Update feature configuration
 */
router.put('/config/features/:featureName/config', authenticate, authorizeAny(BOT_SETTINGS_PERMS), async (req, res) => {
  try {
    const { featureName } = req.params;
    const { configuration } = req.body;
    
    const updated = await botConfigService.updateFeatureConfig(featureName, configuration, req.user.user_id);
    
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Feature not found'
      });
    }
    
    res.json({
      success: true,
      data: { feature: updated },
      message: 'Feature configuration updated'
    });
  } catch (error) {
    logger.error('Error updating feature config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update feature configuration'
    });
  }
});

/**
 * GET /api/v1/bot/config/stats
 * Get bot statistics and overview
 */
router.get('/config/stats', authenticate, authorizeAny(BOT_SETTINGS_PERMS), async (req, res) => {
  try {
    const stats = await botConfigService.getBotStats();
    res.json({
      success: true,
      data: { stats }
    });
  } catch (error) {
    logger.error('Error fetching bot stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bot statistics'
    });
  }
});

// ========================================
// API PROVIDER MANAGEMENT
// ========================================

/**
 * GET /api/v1/bot/api-providers
 * Get all API providers
 */
router.get('/api-providers', authenticate, authorizeAny(BOT_SETTINGS_PERMS), async (req, res) => {
  try {
    const providers = await botApiProviderService.getProviders();
    res.json({
      success: true,
      data: { providers }
    });
  } catch (error) {
    logger.error('Error fetching API providers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch API providers'
    });
  }
});

/**
 * GET /api/v1/bot/api-providers/enabled
 * Get only enabled providers
 */
router.get('/api-providers/enabled', authenticate, async (req, res) => {
  try {
    const providers = await botApiProviderService.getEnabledProviders();
    res.json({
      success: true,
      data: { providers }
    });
  } catch (error) {
    logger.error('Error fetching enabled providers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch enabled providers'
    });
  }
});

/**
 * GET /api/v1/bot/api-providers/:providerId
 * Get provider by ID
 */
router.get('/api-providers/:providerId', authenticate, authorizeAny(BOT_SETTINGS_PERMS), async (req, res) => {
  try {
    const { providerId } = req.params;
    const provider = await botApiProviderService.getProviderById(providerId);
    
    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider not found'
      });
    }
    
    res.json({
      success: true,
      data: { provider }
    });
  } catch (error) {
    logger.error('Error fetching provider:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch provider'
    });
  }
});

/**
 * POST /api/v1/bot/api-providers/:providerId/key
 * Set API key for provider
 */
router.post('/api-providers/:providerId/key', authenticate, authorizeAny(BOT_SETTINGS_PERMS), async (req, res) => {
  try {
    const { providerId } = req.params;
    const { api_key, model_name } = req.body;
    
    if (!api_key || !api_key.trim()) {
      return res.status(400).json({
        success: false,
        message: 'API key is required'
      });
    }
    
    // Check provider exists
    const provider = await botApiProviderService.getProviderById(providerId);
    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider not found'
      });
    }
    
    // Deactivate old keys first
    await botApiProviderService.deactivateOldKeys(providerId);
    
    // Set new key
    const key = await botApiProviderService.setApiKey(providerId, api_key, model_name, req.user.user_id);
    
    res.json({
      success: true,
      data: { key },
      message: 'API key configured successfully'
    });
  } catch (error) {
    logger.error('Error setting API key:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to configure API key'
    });
  }
});

/**
 * PATCH /api/v1/bot/api-providers/:providerId
 * Update provider configuration
 */
router.patch('/api-providers/:providerId', authenticate, authorizeAny(BOT_SETTINGS_PERMS), async (req, res) => {
  try {
    const { providerId } = req.params;
    const updateData = req.body;
    
    const updated = await botApiProviderService.updateProvider(providerId, updateData, req.user.user_id);
    
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Provider not found'
      });
    }
    
    res.json({
      success: true,
      data: { provider: updated },
      message: 'Provider updated successfully'
    });
  } catch (error) {
    logger.error('Error updating provider:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update provider'
    });
  }
});

/**
 * POST /api/v1/bot/api-providers/:providerId/test
 * Test API connection
 */
router.post('/api-providers/:providerId/test', authenticate, authorizeAny(BOT_SETTINGS_PERMS), async (req, res) => {
  try {
    const { providerId } = req.params;
    
    const testResult = await botApiProviderService.testApiConnection(providerId);
    
    res.json({
      success: testResult.success,
      data: { testResult },
      message: testResult.message
    });
  } catch (error) {
    logger.error('Error testing API connection:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test API connection'
    });
  }
});

/**
 * GET /api/v1/bot/api-providers/:providerId/stats
 * Get provider usage statistics
 */
router.get('/api-providers/:providerId/stats', authenticate, authorizeAny(BOT_SETTINGS_PERMS), async (req, res) => {
  try {
    const { providerId } = req.params;
    const { days } = req.query;
    
    const stats = await botApiProviderService.getProviderStats(providerId, parseInt(days) || 30);
    
    res.json({
      success: true,
      data: { stats }
    });
  } catch (error) {
    logger.error('Error fetching provider stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch provider statistics'
    });
  }
});

/**
 * GET /api/v1/bot/api-providers/stats/all
 * Get all providers statistics
 */
router.get('/api-providers/stats/all', authenticate, authorizeAny(BOT_SETTINGS_PERMS), async (req, res) => {
  try {
    const stats = await botApiProviderService.getAllProviderStats();
    
    res.json({
      success: true,
      data: { providers: stats }
    });
  } catch (error) {
    logger.error('Error fetching all provider stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch provider statistics'
    });
  }
});

/**
 * GET /api/v1/bot/api-usage/analytics
 * Get API usage analytics
 */
router.get('/api-usage/analytics', authenticate, authorizeAny(BOT_SETTINGS_PERMS), async (req, res) => {
  try {
    const { providerId, days } = req.query;
    
    const analytics = await botApiIntegrationService.getUsageAnalytics(
      providerId ? parseInt(providerId) : null,
      parseInt(days) || 30
    );
    
    res.json({
      success: true,
      data: { analytics }
    });
  } catch (error) {
    logger.error('Error fetching usage analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch usage analytics'
    });
  }
});

/**
 * GET /api/v1/bot/config/rules
 * Get bot response rules
 */
router.get('/config/rules', authenticate, authorizeAny(BOT_SETTINGS_PERMS), async (req, res) => {
  try {
    const { deptId } = req.query;
    
    const rules = await botConfigService.getResponseRules(deptId ? parseInt(deptId) : null);
    
    res.json({
      success: true,
      data: { rules }
    });
  } catch (error) {
    logger.error('Error fetching response rules:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch response rules'
    });
  }
});

/**
 * POST /api/v1/bot/config/rules
 * Create new response rule
 */
router.post('/config/rules', authenticate, authorizeAny(BOT_SETTINGS_PERMS), async (req, res) => {
  try {
    const ruleData = req.body;
    
    if (!ruleData.rule_name || !ruleData.rule_type) {
      return res.status(400).json({
        success: false,
        message: 'Rule name and type are required'
      });
    }
    
    const rule = await botConfigService.createResponseRule(ruleData, req.user.user_id);
    
    res.json({
      success: true,
      data: { rule },
      message: 'Rule created successfully'
    });
  } catch (error) {
    logger.error('Error creating rule:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create rule'
    });
  }
});

/**
 * PUT /api/v1/bot/config/rules/:ruleId
 * Update response rule
 */
router.put('/config/rules/:ruleId', authenticate, authorizeAny(BOT_SETTINGS_PERMS), async (req, res) => {
  try {
    const { ruleId } = req.params;
    const ruleData = req.body;
    
    const updated = await botConfigService.updateResponseRule(ruleId, ruleData, req.user.user_id);
    
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Rule not found'
      });
    }
    
    res.json({
      success: true,
      data: { rule: updated },
      message: 'Rule updated successfully'
    });
  } catch (error) {
    logger.error('Error updating rule:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update rule'
    });
  }
});

/**
 * DELETE /api/v1/bot/config/rules/:ruleId
 * Delete response rule
 */
router.delete('/config/rules/:ruleId', authenticate, authorizeAny(BOT_SETTINGS_PERMS), async (req, res) => {
  try {
    const { ruleId } = req.params;
    
    await botConfigService.deleteResponseRule(ruleId);
    
    res.json({
      success: true,
      message: 'Rule deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting rule:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete rule'
    });
  }
});

// ============================================
// OLLAMA AUTO-DETECTION & MANAGEMENT
// ============================================

/**
 * GET /api/v1/bot/settings/ollama/detect
 * Auto-detect Ollama installation and available models
 */
router.get('/ollama/detect', authenticate, authorizeAny(BOT_SETTINGS_PERMS), async (req, res) => {
  try {
    const detection = await botApiProviderService.detectOllama();
    
    res.json({
      success: true,
      data: detection
    });
  } catch (error) {
    logger.error('Error detecting Ollama:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to detect Ollama'
    });
  }
});

/**
 * POST /api/v1/bot/settings/ollama/setup
 * Quick-setup Ollama: auto-configure the local provider with detected model
 */
router.post('/ollama/setup', authenticate, authorizeAny(BOT_SETTINGS_PERMS), async (req, res) => {
  try {
    const { model_name, endpoint } = req.body;
    
    // Detect Ollama
    const detection = await botApiProviderService.detectOllama();
    if (!detection.running) {
      return res.status(400).json({
        success: false,
        message: 'Ollama is not running. Start it with: ollama serve'
      });
    }
    
    // Get local provider
    const provider = await botApiProviderService.getProviderByName('local');
    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Local LLM provider not found in database'
      });
    }
    
    const selectedModel = model_name || (detection.models[0]?.name) || 'llama3:8b';
    const ollamaEndpoint = endpoint || detection.baseUrl + '/api/generate';
    
    // Update provider endpoint
    await botApiProviderService.updateProvider(provider.provider_id, {
      api_endpoint: ollamaEndpoint,
      is_enabled: true
    }, req.user.user_id);
    
    // Deactivate old keys and set a placeholder key (Ollama doesn't need one but our system requires it)
    await botApiProviderService.deactivateOldKeys(provider.provider_id);
    await botApiProviderService.setApiKey(provider.provider_id, 'ollama-local-no-key-needed', selectedModel, req.user.user_id);
    
    res.json({
      success: true,
      data: {
        provider_id: provider.provider_id,
        model: selectedModel,
        endpoint: ollamaEndpoint,
        available_models: detection.models
      },
      message: `Ollama configured with model: ${selectedModel}`
    });
  } catch (error) {
    logger.error('Error setting up Ollama:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to setup Ollama'
    });
  }
});

// ============================================
// BOT CHAT WITH EXTERNAL API
// ============================================

/**
 * POST /api/v1/bot/settings/chat/external
 * Send a message to external API for AI-powered response
 */
router.post('/chat/external', authenticate, async (req, res) => {
  try {
    const { message, context, session_id, provider_id } = req.body;
    
    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message cannot be empty'
      });
    }
    
    // Build system prompt with IT helpdesk context
    const systemPrompt = `You are an expert IT helpdesk assistant named "NamoSathi AI". You help users with:
- IT support issues (hardware, software, network, email, VPN, printers)
- Troubleshooting steps for common problems
- Coding and technical questions
- System administration guidance
- Security best practices

Be concise, helpful, and professional. Use markdown formatting for clarity.
If you're unsure, say so rather than guessing. Always suggest creating a support ticket for complex issues.

Current user: ${req.user.full_name || req.user.username} (Role: ${req.user.role?.role_name || 'User'})`;

    // Build messages array
    const messages = [
      { role: 'system', content: systemPrompt }
    ];
    
    // Add conversation context if provided
    if (context && Array.isArray(context)) {
      context.forEach(c => {
        messages.push({ role: c.role || 'user', content: c.content });
      });
    }
    
    messages.push({ role: 'user', content: message });
    
    // Call external API with fallback
    const result = await botApiIntegrationService.callWithFallback(
      messages,
      session_id || null,
      req.user.user_id,
      { max_tokens: 2000, temperature: 0.7 }
    );
    
    if (result.success) {
      res.json({
        success: true,
        data: {
          response: result.content,
          provider: result.provider_label || result.provider,
          model: result.model,
          tokens: result.totalTokens || 0,
          latency_ms: result.latency_ms || 0
        }
      });
    } else {
      res.json({
        success: false,
        message: result.error || 'No AI providers available',
        data: { fallback: true }
      });
    }
  } catch (error) {
    logger.error('Error in external chat:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process AI request'
    });
  }
});

// ============================================
// AUTO-TRAINING ROUTES
// ============================================

/**
 * GET /api/v1/bot/settings/training/diagnostics
 * Run comprehensive diagnostics on bot training system
 */
router.get('/training/diagnostics', authenticate, authorizeAny(BOT_SETTINGS_PERMS), async (req, res) => {
  try {
    const result = await botTrainingService.runDiagnostics();
    res.json(result);
  } catch (error) {
    logger.error('Error running training diagnostics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to run training diagnostics',
      error: error.message
    });
  }
});

/**
 * POST /api/v1/bot/settings/training/scan
 * Trigger auto-training scan on resolved tickets
 */
router.post('/training/scan', authenticate, authorizeAny(BOT_SETTINGS_PERMS), async (req, res) => {
  try {
    const { limit, sinceDate, ticketId } = req.body;
    const result = await botTrainingService.scanAndTrain({
      limit: limit || 100,
      sinceDate,
      ticketId,
      triggeredBy: 'manual',
      force: true
    });

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Error running training scan:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Training scan failed'
    });
  }
});

/**
 * GET /api/v1/bot/settings/training/stats
 * Get auto-training statistics
 */
router.get('/training/stats', authenticate, authorizeAny(BOT_SETTINGS_PERMS), async (req, res) => {
  try {
    const stats = await botTrainingService.getTrainingStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('Error getting training stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get training stats'
    });
  }
});

/**
 * GET /api/v1/bot/settings/training/data
 * Get training data entries with pagination
 */
router.get('/training/data', authenticate, authorizeAny(BOT_SETTINGS_PERMS), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const filters = {
      category: req.query.category,
      isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
      search: req.query.search
    };

    const result = await botTrainingService.getTrainingData(page, pageSize, filters);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Error getting training data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get training data'
    });
  }
});

/**
 * PATCH /api/v1/bot/settings/training/data/:trainingId/toggle
 * Toggle training entry active/inactive
 */
router.patch('/training/data/:trainingId/toggle', authenticate, authorizeAny(BOT_SETTINGS_PERMS), async (req, res) => {
  try {
    const { trainingId } = req.params;
    const { isActive } = req.body;
    await botTrainingService.toggleTrainingEntry(trainingId, isActive);
    res.json({ success: true, message: `Training entry ${isActive ? 'activated' : 'deactivated'}` });
  } catch (error) {
    logger.error('Error toggling training entry:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle training entry'
    });
  }
});

/**
 * DELETE /api/v1/bot/settings/training/data/:trainingId
 * Delete a training entry
 */
router.delete('/training/data/:trainingId', authenticate, authorizeAny(BOT_SETTINGS_PERMS), async (req, res) => {
  try {
    const { trainingId } = req.params;
    await botTrainingService.deleteTrainingEntry(trainingId);
    res.json({ success: true, message: 'Training entry deleted' });
  } catch (error) {
    logger.error('Error deleting training entry:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete training entry'
    });
  }
});

module.exports = router;

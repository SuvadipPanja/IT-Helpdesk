// ============================================
// WhatsApp Controller — Admin + Webhook
// Phase 9: WhatsApp Integration
// ============================================

const whatsappService = require('../services/whatsappService');
const settingsService = require('../services/settings.service');
const waNotifService = require('../services/whatsappNotificationService'); // 📱 Phase 9
const logger = require('../utils/logger');
const { getPublicAppUrl } = require('../utils/publicUrl');

// ── Webhook ───────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/whatsapp/webhook
 * Meta webhook verification handshake
 */
const webhookVerify = async (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const result = await whatsappService.verifyWebhook(mode, token, challenge);
  if (result !== null) {
    return res.status(200).send(result);
  }
  return res.status(403).json({ error: 'Webhook verification failed' });
};

/**
 * POST /api/v1/whatsapp/webhook
 * Receive messages/status updates from Meta
 * Processed asynchronously — always respond 200 immediately to Meta
 */
const webhookReceive = async (req, res) => {
  // Respond immediately to Meta (within 5s SLA)
  res.status(200).send('EVENT_RECEIVED');

  try {
    const events = await whatsappService.parseIncomingWebhook(req.body);
    if (events.length === 0) return;

    const botEnabled = await settingsService.get('whatsapp_bot_enabled');

    // Message types handled by the bot bridge
    const BRIDGE_TYPES = new Set(['text', 'interactive', 'image', 'document', 'video', 'audio']);

    for (const event of events) {
      if (!BRIDGE_TYPES.has(event.messageType)) continue;

      // Log for debugging
      logger.info('WhatsApp inbound message', {
        phone: event.phone,
        type: event.messageType,
        userId: event.user?.user_id || null,
        text: (event.text || event.buttonTitle || event.listTitle || '').substring(0, 100),
        mediaId: event.mediaId || null,
      });

      // Route to bot bridge
      if (botEnabled) {
        try {
          const botBridge = require('../services/whatsappBotBridge');
          await botBridge.handleMessage(event);
        } catch (bridgeErr) {
          logger.warn('WhatsApp bot bridge error', { error: bridgeErr.message });
          if (!event.user) {
            await whatsappService.sendTextMessage(
              event.phone,
              'Welcome! To use the IT Helpdesk bot via WhatsApp, please link your account first at the helpdesk portal.',
              { ticketId: null }
            );
          }
        }
      }
    }
  } catch (err) {
    logger.error('WhatsApp webhook processing error', { error: err.message });
  }
};

/**
 * POST /api/v1/whatsapp/webhook/twilio
 * Receive messages from Twilio WhatsApp (form-encoded body)
 * Responds with empty 204 — Twilio does not require a specific body.
 */
const webhookReceiveTwilio = async (req, res) => {
  // Validate X-Twilio-Signature if auth is enabled
  try {
    const config = await whatsappService.getConfig();

    if (config.twilioWebhookAuthEnabled) {
      const twilioSig = req.headers['x-twilio-signature'] || '';
      const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
      const valid = whatsappService.validateTwilioSignature(
        config.twilioAuthToken,
        twilioSig,
        fullUrl,
        req.body || {}
      );
      if (!valid) {
        logger.warn('Twilio webhook signature validation failed', { sig: twilioSig });
        return res.status(403).send('Forbidden');
      }
    }
  } catch (sigErr) {
    logger.warn('Twilio signature check error (non-blocking)', { error: sigErr.message });
  }

  // Acknowledge immediately
  res.status(204).send();

  try {
    const events = await whatsappService.parseTwilioWebhook(req.body);
    if (events.length === 0) return;

    const botEnabled = await settingsService.get('whatsapp_bot_enabled');
    const BRIDGE_TYPES = new Set(['text', 'image', 'document', 'video', 'audio']);

    for (const event of events) {
      if (!BRIDGE_TYPES.has(event.messageType)) continue;

      logger.info('Twilio WhatsApp inbound message', {
        phone: event.phone,
        type: event.messageType,
        userId: event.user?.user_id || null,
        text: (event.text || '').substring(0, 100),
      });

      if (botEnabled) {
        try {
          const botBridge = require('../services/whatsappBotBridge');
          await botBridge.handleMessage(event);
        } catch (bridgeErr) {
          logger.warn('WhatsApp bot bridge error (Twilio)', { error: bridgeErr.message });
          if (!event.user) {
            await whatsappService.sendTextMessage(
              event.phone,
              'Welcome! To use the IT Helpdesk bot via WhatsApp, please link your account first at the helpdesk portal.',
              { ticketId: null }
            );
          }
        }
      }
    }
  } catch (err) {
    logger.error('Twilio webhook processing error', { error: err.message });
  }
};

// ── Admin Config ──────────────────────────────────────────────────────────────

/**
 * GET /api/v1/whatsapp/config
 * Get WhatsApp settings (redacts token)
 */
const getConfig = async (req, res) => {
  try {
    const config = await whatsappService.getConfig();

    // Redact the Meta API token for frontend display
    const safeToken = config.apiToken
      ? config.apiToken.substring(0, 6) + '...' + config.apiToken.slice(-4)
      : '';

    // Redact Twilio auth token
    const safeTwilioToken = config.twilioAuthToken
      ? '***' + config.twilioAuthToken.slice(-4)
      : '';

    return res.json({
      success: true,
      config: {
        // config.botEnabled / notifyEnabled / twilioWebhookAuthEnabled are already
        // JS booleans from the new direct-DB getConfig(); keep === true for safety.
        enabled: config.enabled === 'true' || config.enabled === true,
        hasApiToken: !!config.apiToken,
        apiTokenPreview: safeToken,
        phoneNumberId: config.phoneNumberId || '',
        businessAccountId: config.businessAccountId || '',
        webhookToken: config.webhookToken || '',
        botEnabled: config.botEnabled === true,
        notifyEnabled: config.notifyEnabled === true,
        // Twilio / provider
        provider: config.provider || 'meta',
        twilioAccountSid: config.twilioAccountSid || '',
        hasTwilioAuthToken: !!config.twilioAuthToken,
        twilioAuthTokenPreview: safeTwilioToken,
        twilioWhatsappFrom: config.twilioWhatsappFrom || '',
        twilioWebhookAuthEnabled: config.twilioWebhookAuthEnabled === true,
        // Resolved public base URL (env or General settings) — for webhook URL display
        appPublicUrl: getPublicAppUrl(),
      },
    });
  } catch (err) {
    logger.error('WhatsApp getConfig error', { error: err.message });
    return res.status(500).json({ success: false, error: 'Failed to load configuration' });
  }
};

/**
 * PUT /api/v1/whatsapp/config
 * Save WhatsApp settings
 * Body: { enabled, apiToken, phoneNumberId, businessAccountId, webhookToken, botEnabled, notifyEnabled }
 */
const saveConfig = async (req, res) => {
  try {
    await whatsappService.ensureWhatsAppSettings();

    const {
      enabled, apiToken, phoneNumberId, businessAccountId, webhookToken, botEnabled, notifyEnabled,
      // Twilio / provider
      provider, twilioAccountSid, twilioAuthToken, twilioWhatsappFrom, twilioWebhookAuthEnabled,
    } = req.body;

    const updates = {};
    if (typeof enabled === 'boolean') updates.whatsapp_enabled = String(enabled);
    if (apiToken !== undefined && apiToken !== null && !String(apiToken).includes('...')) {
      // Only update if not the redacted preview
      updates.whatsapp_api_token = String(apiToken).trim();
    }
    if (phoneNumberId !== undefined) updates.whatsapp_phone_number_id = String(phoneNumberId).trim();
    if (businessAccountId !== undefined) updates.whatsapp_business_account_id = String(businessAccountId).trim();
    if (webhookToken !== undefined) updates.whatsapp_webhook_verify_token = String(webhookToken).trim();
    if (typeof botEnabled === 'boolean') updates.whatsapp_bot_enabled = String(botEnabled);
    if (typeof notifyEnabled === 'boolean') updates.whatsapp_notify_enabled = String(notifyEnabled);

    // Twilio fields
    if (provider !== undefined && ['meta', 'twilio'].includes(provider)) {
      updates.whatsapp_provider = provider;
    }
    if (twilioAccountSid !== undefined) updates.twilio_account_sid = String(twilioAccountSid).trim();
    if (twilioAuthToken !== undefined && twilioAuthToken !== null && !String(twilioAuthToken).startsWith('***')) {
      // Only update when not the redacted preview
      updates.twilio_auth_token = String(twilioAuthToken).trim();
    }
    if (twilioWhatsappFrom !== undefined) updates.twilio_whatsapp_from = String(twilioWhatsappFrom).trim();
    if (typeof twilioWebhookAuthEnabled === 'boolean') updates.twilio_webhook_auth_enabled = String(twilioWebhookAuthEnabled);

    for (const [key, value] of Object.entries(updates)) {
      const ok = await settingsService.set(key, value);
      if (ok === false) {
        // set() only returns false on a hard UPDATE-with-0-rows; the new UPSERT shouldn't
        // hit this, but log just in case
        logger.warn('WhatsApp saveConfig: set() returned false', { key });
      }
    }

    return res.json({ success: true, message: 'WhatsApp configuration saved' });
  } catch (err) {
    logger.error('WhatsApp saveConfig error', { error: err.message });
    return res.status(500).json({ success: false, error: 'Failed to save configuration' });
  }
};

// ── Test / Admin Tools ────────────────────────────────────────────────────────

/**
 * POST /api/v1/whatsapp/verify-credentials
 * Verify that the saved provider credentials are valid (no message sent).
 * For Twilio: fetches Account Info from Twilio REST API.
 * For Meta: fetches Phone Number Info from Graph API.
 */
const verifyCredentials = async (req, res) => {
  try {
    const config = await whatsappService.getConfig();

    if (config.provider === 'twilio') {
      const { twilioAccountSid: sid, twilioAuthToken: auth } = config;
      if (!sid || !auth) {
        return res.json({ success: false, error: 'Twilio Account SID and Auth Token must be saved before verifying' });
      }

      const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}.json`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${sid}:${auth}`).toString('base64')}`,
        },
      });

      const data = await response.json();
      if (!response.ok) {
        const msg = data?.message || data?.error_message || `Twilio API error: ${response.status}`;
        const code = data?.code ? ` (code ${data.code})` : '';
        logger.warn('Twilio credential verification failed', { status: response.status, code: data?.code });
        return res.json({ success: false, error: `${msg}${code}` });
      }

      logger.info('Twilio credentials verified', { friendlyName: data.friendly_name });
      return res.json({
        success: true,
        provider: 'twilio',
        accountName: data.friendly_name,
        accountStatus: data.status,
      });
    }

    if (config.provider === 'meta' || !config.provider) {
      const { apiToken, phoneNumberId } = config;
      if (!apiToken || !phoneNumberId) {
        return res.json({ success: false, error: 'Meta API Token and Phone Number ID must be saved before verifying' });
      }

      const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(phoneNumberId)}`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${apiToken}` },
      });

      const data = await response.json();
      if (!response.ok || data.error) {
        const msg = data?.error?.message || `Meta API error: ${response.status}`;
        logger.warn('Meta credential verification failed', { status: response.status });
        return res.json({ success: false, error: msg });
      }

      logger.info('Meta credentials verified', { phone: data.display_phone_number });
      return res.json({
        success: true,
        provider: 'meta',
        displayPhoneNumber: data.display_phone_number || '',
        verifiedName: data.verified_name || '',
      });
    }

    return res.json({ success: false, error: 'Unknown provider' });
  } catch (err) {
    logger.error('WhatsApp verifyCredentials error', { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * POST /api/v1/whatsapp/send-test
 * Admin test: send a text message to a number
 * Body: { phone, message }
 */
const sendTest = async (req, res) => {
  try {
    const { phone, message } = req.body;
    if (!phone || !message) return res.status(400).json({ success: false, error: 'phone and message are required' });

    // Basic E.164 format check
    if (!/^\+\d{7,15}$/.test(phone.trim())) {
      return res.status(400).json({ success: false, error: 'Phone must be in E.164 format (+1234567890)' });
    }

    const result = await whatsappService.sendTextMessage(phone.trim(), message.substring(0, 1000));
    return res.json(result);
  } catch (err) {
    logger.error('WhatsApp sendTest error', { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * GET /api/v1/whatsapp/logs
 * Admin: paginated message log
 * Query: page, limit, direction (inbound/outbound), userId
 */
const getLogs = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const direction = ['inbound', 'outbound'].includes(req.query.direction) ? req.query.direction : null;
    const userId = req.query.userId ? parseInt(req.query.userId) : null;

    const data = await whatsappService.getMessageLogs({ page, limit, direction, userId });
    return res.json({ success: true, ...data });
  } catch (err) {
    logger.error('WhatsApp getLogs error', { error: err.message });
    return res.status(500).json({ success: false, error: 'Failed to fetch logs' });
  }
};

/**
 * GET /api/v1/whatsapp/stats
 * Admin dashboard statistics
 */
const getStats = async (req, res) => {
  try {
    const stats = await whatsappService.getStats();
    return res.json({ success: true, stats });
  } catch (err) {
    logger.error('WhatsApp getStats error', { error: err.message });
    return res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
};

// ── User Phone Linking ────────────────────────────────────────────────────────

/**
 * POST /api/v1/whatsapp/send-otp
 * Authenticated user requests OTP to link their phone
 * Body: { phone }
 */
const requestOTP = async (req, res) => {
  try {
    const { phone } = req.body;
    const userId = req.user?.userId || req.user?.user_id;

    if (!phone) return res.status(400).json({ success: false, error: 'phone is required' });
    if (!/^\+\d{7,15}$/.test(phone.trim())) {
      return res.status(400).json({ success: false, error: 'Phone must be in E.164 format (+1234567890)' });
    }

    await whatsappService.sendOTP(userId, phone.trim());
    return res.json({ success: true, message: 'OTP sent to your WhatsApp number' });
  } catch (err) {
    logger.error('WhatsApp requestOTP error', { error: err.message });
    return res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * POST /api/v1/whatsapp/verify-otp
 * Authenticated user verifies OTP to complete phone linking
 * Body: { phone, code }
 */
const verifyOTP = async (req, res) => {
  try {
    const { phone, code } = req.body;
    const userId = req.user?.userId || req.user?.user_id;

    if (!phone || !code) return res.status(400).json({ success: false, error: 'phone and code are required' });
    if (!/^\d{6}$/.test(String(code))) return res.status(400).json({ success: false, error: 'Code must be 6 digits' });

    const result = await whatsappService.verifyOTP(userId, phone.trim(), String(code));
    if (!result.success) return res.status(400).json({ success: false, error: result.error });
    return res.json({ success: true, message: 'WhatsApp linked successfully' });
  } catch (err) {
    logger.error('WhatsApp verifyOTP error', { error: err.message });
    return res.status(500).json({ success: false, error: 'Verification failed' });
  }
};

/**
 * DELETE /api/v1/whatsapp/unlink
 * Authenticated user unlinks their WhatsApp phone
 */
const unlinkPhone = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.user_id;
    await whatsappService.unlinkPhone(userId);
    return res.json({ success: true, message: 'WhatsApp unlinked' });
  } catch (err) {
    logger.error('WhatsApp unlinkPhone error', { error: err.message });
    return res.status(500).json({ success: false, error: 'Failed to unlink' });
  }
};

/**
 * GET /api/v1/whatsapp/status
 * Authenticated user: get their own WhatsApp linking status
 */
const getUserStatus = async (req, res) => {
  try {
    const { executeQuery } = require('../config/database');
    const userId = req.user?.userId || req.user?.user_id;

    const result = await executeQuery(
      `SELECT whatsapp_phone, whatsapp_opted_in, whatsapp_verified_at FROM users WHERE user_id = @userId`,
      { userId }
    );

    const user = result.recordset[0];
    return res.json({
      success: true,
      linked: !!(user?.whatsapp_opted_in),
      phone: user?.whatsapp_phone ? '***' + user.whatsapp_phone.slice(-4) : null,
      verifiedAt: user?.whatsapp_verified_at || null,
    });
  } catch (err) {
    logger.error('WhatsApp getUserStatus error', { error: err.message });
    return res.status(500).json({ success: false, error: 'Failed to fetch status' });
  }
};

// ── Notification Preferences ──────────────────────────────────────────────────

/**
 * GET /api/v1/whatsapp/preferences
 * Returns the current user's WhatsApp notification preferences
 */
const getPreferences = async (req, res) => {
  try {
    const userId = req.user?.user_id || req.user?.userId;
    const preferences = await waNotifService.getUserPreferences(userId);
    return res.json({ success: true, preferences });
  } catch (err) {
    logger.error('WhatsApp getPreferences error', { error: err.message });
    return res.status(500).json({ success: false, error: 'Failed to load preferences' });
  }
};

/**
 * PUT /api/v1/whatsapp/preferences
 * Saves the current user's WhatsApp notification preferences
 */
const savePreferences = async (req, res) => {
  try {
    const userId = req.user?.user_id || req.user?.userId;
    await waNotifService.setUserPreferences(userId, req.body);
    return res.json({ success: true, message: 'Preferences saved' });
  } catch (err) {
    logger.error('WhatsApp savePreferences error', { error: err.message });
    return res.status(500).json({ success: false, error: 'Failed to save preferences' });
  }
};

// ── Admin Broadcast ───────────────────────────────────────────────────────────

/**
 * POST /api/v1/whatsapp/broadcast
 * Send a WhatsApp message to all opted-in users (or a specified subset).
 * Body: { message, userIds? }
 */
const broadcast = async (req, res) => {
  try {
    const { message, userIds } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, error: 'message is required' });
    }
    const text = message.trim().substring(0, 4000);

    const { executeQuery } = require('../config/database');

    // Build recipient list
    let recipients;
    if (Array.isArray(userIds) && userIds.length > 0) {
      // Only send to the specified (opted-in) subset
      const placeholders = userIds.map((_, i) => `@uid${i}`).join(',');
      const params = Object.fromEntries(userIds.map((id, i) => [`uid${i}`, Number(id)]));
      const r = await executeQuery(
        `SELECT user_id, whatsapp_phone FROM users
         WHERE user_id IN (${placeholders})
           AND is_active = 1 AND whatsapp_opted_in = 1 AND whatsapp_phone IS NOT NULL`,
        params
      );
      recipients = r.recordset || [];
    } else {
      // All opted-in users
      const r = await executeQuery(
        `SELECT user_id, whatsapp_phone FROM users
         WHERE is_active = 1 AND whatsapp_opted_in = 1 AND whatsapp_phone IS NOT NULL`
      );
      recipients = r.recordset || [];
    }

    let sent = 0;
    let failed = 0;
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    for (const user of recipients) {
      try {
        await whatsappService.sendTextMessage(user.whatsapp_phone, text, { userId: user.user_id });
        sent++;
      } catch {
        failed++;
      }
      // Rate-limit: ~10 msg/s to stay within Meta's API limits
      await sleep(100);
    }

    logger.info('WhatsApp broadcast complete', { sent, failed, total: recipients.length, adminId: req.user?.user_id });
    return res.json({ success: true, sent, failed, total: recipients.length });
  } catch (err) {
    logger.error('WhatsApp broadcast error', { error: err.message });
    return res.status(500).json({ success: false, error: 'Broadcast failed' });
  }
};

/**
 * GET /api/v1/whatsapp/broadcast/history
 * Returns recent outbound broadcast messages from the log.
 * Query: page, limit
 */
const getBroadcastHistory = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const offset = (page - 1) * limit;

    const { executeQuery } = require('../config/database');
    const result = await executeQuery(`
      SELECT
        l.log_id, l.user_id, l.phone_number, l.message_content,
        l.direction, l.status, l.created_at,
        u.first_name, u.last_name, u.username
      FROM whatsapp_message_log l
      LEFT JOIN users u ON l.user_id = u.user_id
      WHERE l.direction = 'outbound'
        AND l.template_name = 'BROADCAST'
      ORDER BY l.created_at DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `, { offset, limit });

    const countResult = await executeQuery(`
      SELECT COUNT(*) AS total FROM whatsapp_message_log
      WHERE direction = 'outbound' AND template_name = 'BROADCAST'
    `);
    const total = countResult.recordset?.[0]?.total || 0;

    return res.json({
      success: true,
      logs: result.recordset || [],
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    logger.error('WhatsApp getBroadcastHistory error', { error: err.message });
    return res.status(500).json({ success: false, error: 'Failed to fetch broadcast history' });
  }
};

module.exports = {
  webhookVerify,
  webhookReceive,
  webhookReceiveTwilio,
  getConfig,
  saveConfig,
  verifyCredentials,
  sendTest,
  getLogs,
  getStats,
  requestOTP,
  verifyOTP,
  unlinkPhone,
  getUserStatus,
  getPreferences,
  savePreferences,
  broadcast,
  getBroadcastHistory,
};

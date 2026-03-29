// ============================================
// WhatsApp Service — Multi-Provider (Meta + Twilio)
// Handles send, receive, webhook, OTP, templates
// Phase 9: WhatsApp Integration
// ============================================

const { executeQuery } = require('../config/database');
const settingsService = require('./settings.service');
const logger = require('../utils/logger');
const crypto = require('crypto');

const META_API_VERSION = 'v19.0';
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

const WHATSAPP_SETTING_DEFINITIONS = [
  {
    key: 'whatsapp_enabled',
    value: 'false',
    category: 'whatsapp',
    type: 'boolean',
    description: 'Master switch for WhatsApp integration',
    isPublic: 0,
  },
  {
    key: 'whatsapp_api_token',
    value: '',
    category: 'whatsapp',
    type: 'string',
    description: 'Meta WhatsApp Business API access token',
    isPublic: 0,
  },
  {
    key: 'whatsapp_phone_number_id',
    value: '',
    category: 'whatsapp',
    type: 'string',
    description: 'Meta phone number ID',
    isPublic: 0,
  },
  {
    key: 'whatsapp_business_account_id',
    value: '',
    category: 'whatsapp',
    type: 'string',
    description: 'Meta business account ID',
    isPublic: 0,
  },
  {
    key: 'whatsapp_webhook_verify_token',
    value: '',
    category: 'whatsapp',
    type: 'string',
    description: 'Webhook verification token (set a secret)',
    isPublic: 0,
  },
  {
    key: 'whatsapp_bot_enabled',
    value: 'false',
    category: 'whatsapp',
    type: 'boolean',
    description: 'Enable bot chat via WhatsApp',
    isPublic: 0,
  },
  {
    key: 'whatsapp_notify_enabled',
    value: 'false',
    category: 'whatsapp',
    type: 'boolean',
    description: 'Enable notifications via WhatsApp',
    isPublic: 0,
  },
  {
    key: 'whatsapp_provider',
    value: 'meta',
    category: 'whatsapp',
    type: 'string',
    description: 'WhatsApp API provider: meta or twilio',
    isPublic: 0,
  },
  {
    key: 'twilio_account_sid',
    value: '',
    category: 'whatsapp',
    type: 'string',
    description: 'Twilio Account SID (ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx)',
    isPublic: 0,
  },
  {
    key: 'twilio_auth_token',
    value: '',
    category: 'whatsapp',
    type: 'string',
    description: 'Twilio Auth Token',
    isPublic: 0,
  },
  {
    key: 'twilio_whatsapp_from',
    value: '',
    category: 'whatsapp',
    type: 'string',
    description: 'Twilio WhatsApp sender number (e.g. +14155238886)',
    isPublic: 0,
  },
  {
    key: 'twilio_webhook_auth_enabled',
    value: 'false',
    category: 'whatsapp',
    type: 'boolean',
    description: 'Validate X-Twilio-Signature on Twilio webhook requests',
    isPublic: 0,
  },
];

// True singleton: resolved once per server lifetime, never reset.
// This prevents repeated cache-clearing on every getConfig() call.
let ensureSettingsPromise = null;

const ensureWhatsAppSettings = async () => {
  if (ensureSettingsPromise) return ensureSettingsPromise;

  ensureSettingsPromise = (async () => {
    for (const def of WHATSAPP_SETTING_DEFINITIONS) {
      await executeQuery(
        `
          MERGE system_settings AS target
          USING (
            SELECT
              @key AS setting_key,
              @value AS setting_value,
              @category AS setting_category,
              @type AS setting_type,
              @description AS setting_description,
              @isPublic AS is_public
          ) AS source
          ON target.setting_key = source.setting_key
          WHEN MATCHED THEN
            UPDATE SET
              setting_category = source.setting_category,
              setting_type = source.setting_type,
              setting_description = source.setting_description,
              is_public = source.is_public
          WHEN NOT MATCHED THEN
            INSERT (setting_key, setting_value, setting_category, setting_type, setting_description, is_public)
            VALUES (source.setting_key, source.setting_value, source.setting_category, source.setting_type, source.setting_description, source.is_public);
        `,
        {
          key: def.key,
          value: def.value,
          category: def.category,
          type: def.type,
          description: def.description,
          isPublic: def.isPublic,
        }
      );
    }
    // Reload cache once so types/categories are current.
    // Do NOT clear cache here — that would wipe any values saved
    // by saveConfig() that are already in cache (see settings.service.js set()).
    settingsService.clearCache();
    await settingsService.getAll(); // repopulate cache immediately
  })();

  // NOTE: We do NOT reset ensureSettingsPromise to null here.
  // Once it resolves successfully, all subsequent calls get the cached promise
  // (instant no-op). On error we DO reset so the next call can retry.
  try {
    await ensureSettingsPromise;
  } catch (err) {
    ensureSettingsPromise = null; // allow retry on failure only
    throw err;
  }
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Get active WhatsApp config from system_settings.
 * Always reads directly from DB so that the values returned here are
 * never stale due to cache-timing between saveConfig() and getConfig().
 */
const getConfig = async () => {
  await ensureWhatsAppSettings();

  // Force-refresh: bypass TTL and read all whatsapp/twilio rows straight from DB.
  const WHATSAPP_KEYS = [
    'whatsapp_enabled', 'whatsapp_api_token', 'whatsapp_phone_number_id',
    'whatsapp_business_account_id', 'whatsapp_webhook_verify_token',
    'whatsapp_bot_enabled', 'whatsapp_notify_enabled', 'whatsapp_provider',
    'twilio_account_sid', 'twilio_auth_token', 'twilio_whatsapp_from',
    'twilio_webhook_auth_enabled',
  ];

  const rows = await executeQuery(
    `SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN (${WHATSAPP_KEYS.map((_, i) => `@k${i}`).join(',')})`,
    Object.fromEntries(WHATSAPP_KEYS.map((k, i) => [`k${i}`, k]))
  );

  const raw = {};
  rows.recordset.forEach(r => { raw[r.setting_key] = r.setting_value; });

  const isTrueVal = v => v === 'true' || v === true || v === '1' || v === 1;

  return {
    enabled:                 raw.whatsapp_enabled,
    apiToken:                raw.whatsapp_api_token               || '',
    phoneNumberId:           raw.whatsapp_phone_number_id         || '',
    businessAccountId:       raw.whatsapp_business_account_id     || '',
    webhookToken:            raw.whatsapp_webhook_verify_token     || '',
    botEnabled:              isTrueVal(raw.whatsapp_bot_enabled),
    notifyEnabled:           isTrueVal(raw.whatsapp_notify_enabled),
    provider:                raw.whatsapp_provider                 || 'meta',
    twilioAccountSid:        raw.twilio_account_sid                || '',
    twilioAuthToken:         raw.twilio_auth_token                 || '',
    twilioWhatsappFrom:      raw.twilio_whatsapp_from              || '',
    twilioWebhookAuthEnabled: isTrueVal(raw.twilio_webhook_auth_enabled),
  };
};

/** Returns true only if the setting value is explicitly true/string 'true' */
const isTruthy = (val) => val === true || val === 'true';

/**
 * Call Meta Graph API
 */
const callMetaApi = async (method, path, body = null) => {
  const config = await getConfig();
  if (!config.apiToken) throw new Error('WhatsApp API token not configured');

  const url = `${META_BASE_URL}${path}`;
  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${config.apiToken}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    const msg = data?.error?.message || `Meta API error: ${response.status}`;
    logger.error('Meta WhatsApp API error', { status: response.status, error: msg, path });
    throw new Error(msg);
  }

  return data;
};

// ── Twilio Provider ───────────────────────────────────────────────────────────

/**
 * Send a text message via Twilio WhatsApp API (REST, no SDK)
 * @param {string} phone - E.164 format e.g. "+919876543210"
 * @param {string} text
 * @param {object} cfg - config object from getConfig()
 * @returns {{ sid: string }} Twilio message SID
 */
const callTwilioApi = async (phone, text, cfg) => {
  const { twilioAccountSid: sid, twilioAuthToken: auth, twilioWhatsappFrom: from } = cfg;
  if (!sid || !auth || !from) throw new Error('Twilio credentials not configured (Account SID, Auth Token, and From number are required)');

  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`;
  const to   = phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`;
  const from_ = from.startsWith('whatsapp:') ? from : `whatsapp:${from}`;
  const body = new URLSearchParams({ From: from_, To: to, Body: text.substring(0, 1600) });

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${sid}:${auth}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  const data = await response.json();
  if (!response.ok) {
    const msg = data?.message || data?.error_message || `Twilio API error: ${response.status}`;
    const code = data?.code ? ` (code ${data.code})` : '';
    logger.error('Twilio WhatsApp API error', { status: response.status, twilioCode: data?.code, error: msg, to, from: from_ });
    throw new Error(`${msg}${code}`);
  }

  return { sid: data.sid };
};

/**
 * Validate X-Twilio-Signature header to authenticate Twilio webhook requests.
 * See: https://www.twilio.com/docs/usage/webhooks/webhooks-security
 * @param {string} authToken - Twilio Auth Token
 * @param {string} twilioSignature - value of X-Twilio-Signature header
 * @param {string} url - full URL the webhook was sent to
 * @param {object} params - form-encoded POST body as key/value object
 * @returns {boolean}
 */
const validateTwilioSignature = (authToken, twilioSignature, url, params) => {
  // Build the signed string: URL + sorted param key/value pairs concatenated
  const sortedKeys = Object.keys(params).sort();
  const str = url + sortedKeys.map(k => `${k}${params[k]}`).join('');
  const expected = crypto.createHmac('sha1', authToken).update(str, 'utf8').digest('base64');
  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'base64'), Buffer.from(twilioSignature, 'base64'));
  } catch {
    return false;
  }
};

/**
 * Parse incoming webhook from Twilio (form-encoded POST body)
 * Normalises to the same event shape as parseIncomingWebhook (Meta)
 * @param {object} body - express req.body (already parsed by urlencoded middleware)
 * @returns {Array<NormalisedEvent>}
 */
const parseTwilioWebhook = async (body) => {
  const events = [];
  try {
    // Twilio sends: From=whatsapp:+1234, Body=..., MessageSid=..., NumMedia=N, MediaUrl0=...
    const rawFrom = body.From || '';
    const phone = rawFrom.replace(/^whatsapp:/, ''); // strip prefix, keep +
    const text = body.Body || null;
    const messageSid = body.MessageSid || body.SmsSid || null;
    const numMedia = parseInt(body.NumMedia || '0', 10);
    const mediaUrls = [];
    for (let i = 0; i < numMedia; i++) {
      if (body[`MediaUrl${i}`]) mediaUrls.push(body[`MediaUrl${i}`]);
    }

    if (!phone) return events;

    const normalizedPhone = phone.startsWith('+') ? phone : `+${phone}`;
    const rawPhone = normalizedPhone.replace(/^\+/, '');

    const userResult = await executeQuery(
      `SELECT user_id, first_name, last_name, username, role_id FROM users
       WHERE whatsapp_phone IN (@phone, @phoneWithPlus) AND whatsapp_opted_in = 1 AND is_active = 1`,
      { phone: rawPhone, phoneWithPlus: normalizedPhone }
    );
    const user = userResult.recordset[0] || null;

    const messageType = numMedia > 0 ? 'image' : 'text';
    const mediaId = mediaUrls[0] || null;

    await logMessage({
      userId: user?.user_id || null,
      direction: 'inbound',
      waMessageId: messageSid,
      fromPhone: normalizedPhone,
      type: messageType,
      content: text,
    });

    events.push({
      waMessageId: messageSid,
      phone: normalizedPhone,
      rawPhone,
      messageType,
      text,
      buttonId: null,
      buttonTitle: null,
      listId: null,
      listTitle: null,
      mediaId,
      mediaType: numMedia > 0 ? 'image' : null,
      mediaUrls,
      user,
      provider: 'twilio',
    });
  } catch (err) {
    logger.error('Twilio webhook parse error', { error: err.message });
  }
  return events;
};

/**
 * Log a message in whatsapp_message_log
 */
const logMessage = async ({ userId, direction, waMessageId, fromPhone, toPhone, type, content, templateName, status, errorMsg, botSessionId, ticketId }) => {
  try {
    await executeQuery(`
      INSERT INTO whatsapp_message_log
        (user_id, direction, wa_message_id, from_phone, to_phone, message_type, template_name, content, status, error_message, bot_session_id, related_ticket_id)
      VALUES
        (@userId, @direction, @waMessageId, @fromPhone, @toPhone, @type, @templateName, @content, @status, @errorMsg, @botSessionId, @ticketId)
    `, {
      userId: userId || null,
      direction,
      waMessageId: waMessageId || null,
      fromPhone: fromPhone || null,
      toPhone: toPhone || null,
      type: type || 'text',
      templateName: templateName || null,
      content: content ? content.substring(0, 4000) : null,
      status: status || 'sent',
      errorMsg: errorMsg ? errorMsg.substring(0, 500) : null,
      botSessionId: botSessionId || null,
      ticketId: ticketId || null,
    });
  } catch (err) {
    logger.warn('WhatsApp message log failed (non-blocking)', { error: err.message });
  }
};

// ── Core Send Methods ─────────────────────────────────────────────────────────

/**
 * Send a plain text message
 * @param {string} phone - E.164 format e.g. "+919876543210"
 * @param {string} text
 * @param {object} [meta] - optional { userId, botSessionId, ticketId }
 */
const sendTextMessage = async (phone, text, meta = {}) => {
  const config = await getConfig();
  if (!isTruthy(config.enabled)) {
    logger.info('WhatsApp disabled — skipping text message', { phone });
    return { success: false, reason: 'disabled' };
  }

  const cleanPhone = phone.replace(/\s+/g, '');

  try {
    let waId;
    if (config.provider === 'twilio') {
      const res = await callTwilioApi(cleanPhone, text, config);
      waId = res.sid;
      logger.info('Twilio WhatsApp text sent', { phone, sid: waId });
    } else {
      const result = await callMetaApi('POST', `/${config.phoneNumberId}/messages`, {
        messaging_product: 'whatsapp',
        to: cleanPhone,
        type: 'text',
        text: { preview_url: false, body: text.substring(0, 4096) },
      });
      waId = result?.messages?.[0]?.id;
      logger.info('WhatsApp text sent', { phone, waId });
    }

    await logMessage({ ...meta, direction: 'outbound', waMessageId: waId, toPhone: phone, type: 'text', content: text, status: 'sent' });
    return { success: true, waMessageId: waId };
  } catch (err) {
    await logMessage({ ...meta, direction: 'outbound', toPhone: phone, type: 'text', content: text, status: 'failed', errorMsg: err.message });
    return { success: false, error: err.message };
  }
};

/**
 * Send a pre-approved template message
 * @param {string} phone
 * @param {string} templateName - Meta-approved template name
 * @param {string} languageCode - e.g. 'en_US'
 * @param {Array<string>} params - Template parameter values {{1}}, {{2}}, ...
 * @param {object} [meta]
 */
const sendTemplateMessage = async (phone, templateName, languageCode = 'en_US', params = [], meta = {}) => {
  const config = await getConfig();
  if (!isTruthy(config.enabled) || !isTruthy(config.notifyEnabled)) {
    logger.info('WhatsApp notifications disabled — skipping template', { phone, templateName });
    return { success: false, reason: 'disabled' };
  }

  // Twilio does not support Meta-style named templates; fall back to plain text
  if (config.provider === 'twilio') {
    const textBody = `${templateName}: ${params.join(', ')}`;
    return sendTextMessage(phone, textBody, meta);
  }

  const components = params.length > 0
    ? [{
        type: 'body',
        parameters: params.map(p => ({ type: 'text', text: String(p).substring(0, 1024) })),
      }]
    : [];

  try {
    const result = await callMetaApi('POST', `/${config.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      to: phone.replace(/\s+/g, ''),
      type: 'template',
      template: { name: templateName, language: { code: languageCode }, components },
    });

    const waId = result?.messages?.[0]?.id;
    await logMessage({ ...meta, direction: 'outbound', waMessageId: waId, toPhone: phone, type: 'template', templateName, content: JSON.stringify(params), status: 'sent' });
    logger.info('WhatsApp template sent', { phone, templateName, waId });
    return { success: true, waMessageId: waId };
  } catch (err) {
    await logMessage({ ...meta, direction: 'outbound', toPhone: phone, type: 'template', templateName, status: 'failed', errorMsg: err.message });
    return { success: false, error: err.message };
  }
};

/**
 * Send an interactive message with reply buttons (max 3)
 * Twilio does not support native interactive buttons — falls back to numbered plain text.
 * @param {string} phone
 * @param {string} bodyText - Main message body
 * @param {Array<{id: string, title: string}>} buttons - Max 3 buttons
 * @param {object} [meta]
 */
const sendInteractiveButtons = async (phone, bodyText, buttons, meta = {}) => {
  const config = await getConfig();
  if (!isTruthy(config.enabled)) return { success: false, reason: 'disabled' };

  // Twilio fallback: render as numbered list
  if (config.provider === 'twilio') {
    const numbered = buttons.slice(0, 3).map((b, i) => `${i + 1}. ${b.title}`).join('\n');
    return sendTextMessage(phone, `${bodyText}\n\n${numbered}`, meta);
  }

  const safeButtons = buttons.slice(0, 3).map(b => ({
    type: 'reply',
    reply: { id: String(b.id).substring(0, 256), title: String(b.title).substring(0, 20) },
  }));

  try {
    const result = await callMetaApi('POST', `/${config.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      to: phone.replace(/\s+/g, ''),
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: bodyText.substring(0, 1024) },
        action: { buttons: safeButtons },
      },
    });

    const waId = result?.messages?.[0]?.id;
    await logMessage({ ...meta, direction: 'outbound', waMessageId: waId, toPhone: phone, type: 'interactive', content: bodyText, status: 'sent' });
    return { success: true, waMessageId: waId };
  } catch (err) {
    await logMessage({ ...meta, direction: 'outbound', toPhone: phone, type: 'interactive', content: bodyText, status: 'failed', errorMsg: err.message });
    return { success: false, error: err.message };
  }
};

/**
 * Send an interactive list menu (max 10 rows)
 * Twilio fallback: renders as numbered plain text.
 * @param {string} phone
 * @param {string} bodyText
 * @param {string} buttonLabel - The list trigger button label
 * @param {Array<{id: string, title: string, description?: string}>} rows
 * @param {object} [meta]
 */
const sendInteractiveList = async (phone, bodyText, buttonLabel, rows, meta = {}) => {
  const config = await getConfig();
  if (!isTruthy(config.enabled)) return { success: false, reason: 'disabled' };

  // Twilio fallback: render as numbered list
  if (config.provider === 'twilio') {
    const numbered = rows.slice(0, 10).map((r, i) => `${i + 1}. ${r.title}${r.description ? ` — ${r.description}` : ''}`).join('\n');
    return sendTextMessage(phone, `${bodyText}\n\n${numbered}`, meta);
  }

  const safeRows = rows.slice(0, 10).map(r => ({
    id: String(r.id).substring(0, 200),
    title: String(r.title).substring(0, 24),
    description: r.description ? String(r.description).substring(0, 72) : undefined,
  }));

  try {
    const result = await callMetaApi('POST', `/${config.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      to: phone.replace(/\s+/g, ''),
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: bodyText.substring(0, 1024) },
        action: {
          button: buttonLabel.substring(0, 20),
          sections: [{ title: 'Options', rows: safeRows }],
        },
      },
    });

    const waId = result?.messages?.[0]?.id;
    await logMessage({ ...meta, direction: 'outbound', waMessageId: waId, toPhone: phone, type: 'interactive', content: bodyText, status: 'sent' });
    return { success: true, waMessageId: waId };
  } catch (err) {
    await logMessage({ ...meta, direction: 'outbound', toPhone: phone, type: 'interactive', content: bodyText, status: 'failed', errorMsg: err.message });
    return { success: false, error: err.message };
  }
};

// ── OTP / Phone Verification ──────────────────────────────────────────────────

/**
 * Generate and send OTP to a phone number (for user linking)
 * @param {number} userId
 * @param {string} phone - E.164 format
 */
const sendOTP = async (userId, phone) => {
  const config = await getConfig();
  if (!isTruthy(config.enabled)) throw new Error('WhatsApp is not enabled');

  // Generate 6-digit OTP
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Invalidate existing OTPs for this user/phone
  await executeQuery(
    `UPDATE whatsapp_otp SET used_at = GETDATE() WHERE user_id = @userId AND phone = @phone AND used_at IS NULL`,
    { userId, phone }
  );

  // Store new OTP
  await executeQuery(
    `INSERT INTO whatsapp_otp (user_id, phone, otp_code, expires_at) VALUES (@userId, @phone, @otp, @expiresAt)`,
    { userId, phone, otp, expiresAt }
  );

  // Send via WhatsApp text
  const message = `Your IT Helpdesk verification code is: *${otp}*\n\nThis code expires in 10 minutes. Do not share it with anyone.`;
  const result = await sendTextMessage(phone, message, { userId });

  if (!result.success) throw new Error(result.error || 'Failed to send OTP');
  logger.info('WhatsApp OTP sent', { userId, phone: phone.slice(-4).padStart(phone.length, '*') });
  return { success: true };
};

/**
 * Verify OTP and link WhatsApp phone to user account
 * @param {number} userId
 * @param {string} phone
 * @param {string} code
 */
const verifyOTP = async (userId, phone, code) => {
  const result = await executeQuery(
    `SELECT otp_id FROM whatsapp_otp
     WHERE user_id = @userId AND phone = @phone AND otp_code = @code
       AND used_at IS NULL AND expires_at > GETDATE()`,
    { userId, phone, code }
  );

  if (!result.recordset.length) {
    return { success: false, error: 'Invalid or expired code' };
  }

  const otpId = result.recordset[0].otp_id;

  // Mark OTP used
  await executeQuery(`UPDATE whatsapp_otp SET used_at = GETDATE() WHERE otp_id = @otpId`, { otpId });

  // Link phone to user
  await executeQuery(
    `UPDATE users SET whatsapp_phone = @phone, whatsapp_opted_in = 1, whatsapp_verified_at = GETDATE() WHERE user_id = @userId`,
    { userId, phone }
  );

  logger.info('WhatsApp phone verified and linked', { userId });
  return { success: true };
};

/**
 * Unlink WhatsApp from user account
 */
const unlinkPhone = async (userId) => {
  await executeQuery(
    `UPDATE users SET whatsapp_phone = NULL, whatsapp_opted_in = 0, whatsapp_verified_at = NULL WHERE user_id = @userId`,
    { userId }
  );
  return { success: true };
};

// ── Webhook ───────────────────────────────────────────────────────────────────

/**
 * Verify Meta webhook handshake (GET request from Meta)
 * @param {string} mode
 * @param {string} token
 * @param {string} challenge
 * @returns {string|null} challenge if valid, null if invalid
 */
const verifyWebhook = async (mode, token, challenge) => {
  const config = await getConfig();
  if (mode === 'subscribe' && token === config.webhookToken) {
    logger.info('WhatsApp webhook verified');
    return challenge;
  }
  logger.warn('WhatsApp webhook verification failed — token mismatch');
  return null;
};

/**
 * Parse incoming webhook payload from Meta
 * Extracts message data and returns normalized event objects
 * @param {object} body - Raw webhook POST body
 * @returns {Array<{type, phone, waMessageId, messageType, text, buttonId, listId, mediaId, userId}>}
 */
const parseIncomingWebhook = async (body) => {
  const events = [];
  try {
    const entries = body?.entry || [];
    for (const entry of entries) {
      for (const change of (entry.changes || [])) {
        if (change.field !== 'messages') continue;
        const value = change.value;

        // Status updates (delivered, read, failed)
        for (const status of (value.statuses || [])) {
          await executeQuery(
            `UPDATE whatsapp_message_log SET status = @status WHERE wa_message_id = @waId`,
            { status: status.status, waId: status.id }
          ).catch(() => {});
        }

        // Incoming messages
        for (const msg of (value.messages || [])) {
          const phone = msg.from; // E.164 without +

          // Find user by phone (stored as E.164 with or without +)
          const userResult = await executeQuery(
            `SELECT user_id, first_name, last_name, username, role_id FROM users
             WHERE whatsapp_phone IN (@phone, @phoneWithPlus) AND whatsapp_opted_in = 1 AND is_active = 1`,
            { phone, phoneWithPlus: `+${phone}` }
          );
          const user = userResult.recordset[0] || null;

          // Log inbound message
          await logMessage({
            userId: user?.user_id || null,
            direction: 'inbound',
            waMessageId: msg.id,
            fromPhone: phone,
            type: msg.type,
            content: msg.text?.body || msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || null,
          });

          events.push({
            waMessageId: msg.id,
            phone: `+${phone}`,
            rawPhone: phone,
            messageType: msg.type,
            text: msg.text?.body || null,
            buttonId: msg.interactive?.button_reply?.id || null,
            buttonTitle: msg.interactive?.button_reply?.title || null,
            listId: msg.interactive?.list_reply?.id || null,
            listTitle: msg.interactive?.list_reply?.title || null,
            mediaId: msg.image?.id || msg.document?.id || msg.video?.id || null,
            mediaType: msg.type !== 'text' && msg.type !== 'interactive' ? msg.type : null,
            user,
          });
        }
      }
    }
  } catch (err) {
    logger.error('WhatsApp webhook parse error', { error: err.message });
  }
  return events;
};

// ── Format helpers for bot responses ─────────────────────────────────────────

/**
 * Convert Markdown response to WhatsApp formatting
 * - **bold** → *bold*
 * - Splits messages longer than 4096 chars
 */
const formatForWhatsApp = (text) => {
  return text
    .replace(/\*\*(.*?)\*\*/g, '*$1*')    // **bold** → *bold*
    .replace(/__(.*?)__/g, '_$1_')          // __italic__ → _italic_
    .replace(/```([\s\S]*?)```/g, '```$1```') // code blocks stay
    .substring(0, 4096);
};

/**
 * Split a long message into WhatsApp-sized chunks (≤4096 chars)
 */
const splitMessage = (text, maxLen = 4096) => {
  if (text.length <= maxLen) return [text];
  const chunks = [];
  let remaining = text;
  while (remaining.length > 0) {
    let cut = remaining.lastIndexOf('\n', maxLen);
    if (cut <= 0) cut = maxLen;
    chunks.push(remaining.substring(0, cut));
    remaining = remaining.substring(cut).trimStart();
  }
  return chunks;
};

// ── Admin helpers ─────────────────────────────────────────────────────────────

/**
 * Get WhatsApp message logs with pagination (for admin UI)
 */
const getMessageLogs = async ({ page = 1, limit = 50, userId = null, direction = null }) => {
  const offset = (page - 1) * limit;
  let where = '1=1';
  const params = { offset, limit };
  if (userId) { where += ' AND l.user_id = @userId'; params.userId = userId; }
  if (direction) { where += ' AND l.direction = @direction'; params.direction = direction; }

  const result = await executeQuery(`
    SELECT
      l.log_id, l.user_id, l.direction, l.message_type, l.template_name,
      l.content, l.status, l.error_message, l.created_at,
      l.from_phone, l.to_phone, l.wa_message_id,
      u.first_name, u.last_name, u.username
    FROM whatsapp_message_log l
    LEFT JOIN users u ON u.user_id = l.user_id
    WHERE ${where}
    ORDER BY l.created_at DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
  `, params);

  const countResult = await executeQuery(
    `SELECT COUNT(*) AS total FROM whatsapp_message_log l WHERE ${where}`,
    userId ? { userId } : direction ? { direction } : {}
  );

  return { logs: result.recordset, total: countResult.recordset[0].total, page, limit };
};

/**
 * Get WhatsApp statistics for admin dashboard
 */
const getStats = async () => {
  const result = await executeQuery(`
    SELECT
      COUNT(*) AS total_messages,
      SUM(CASE WHEN direction = 'inbound' THEN 1 ELSE 0 END) AS inbound,
      SUM(CASE WHEN direction = 'outbound' THEN 1 ELSE 0 END) AS outbound,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
      SUM(CASE WHEN message_type = 'template' THEN 1 ELSE 0 END) AS notifications,
      COUNT(DISTINCT user_id) AS unique_users,
      SUM(CASE WHEN created_at >= DATEADD(DAY, -1, GETDATE()) THEN 1 ELSE 0 END) AS last_24h
    FROM whatsapp_message_log
  `);
  const usersResult = await executeQuery(
    `SELECT COUNT(*) AS opted_in FROM users WHERE whatsapp_opted_in = 1`
  );
  return { ...result.recordset[0], opted_in_users: usersResult.recordset[0].opted_in };
};

module.exports = {
  getConfig,
  ensureWhatsAppSettings,
  sendTextMessage,
  sendTemplateMessage,
  sendInteractiveButtons,
  sendInteractiveList,
  sendOTP,
  verifyOTP,
  unlinkPhone,
  verifyWebhook,
  parseIncomingWebhook,
  parseTwilioWebhook,
  validateTwilioSignature,
  formatForWhatsApp,
  splitMessage,
  getMessageLogs,
  getStats,
};

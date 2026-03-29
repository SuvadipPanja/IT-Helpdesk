// ============================================
// WhatsApp Routes
// Phase 9: WhatsApp Integration
// ============================================

const express = require('express');
const router = express.Router();
const { authenticate, authorizeAny } = require('../middleware/auth');
const ctrl = require('../controllers/whatsapp.controller');

const WHATSAPP_ADMIN_PERMS = ['can_manage_system', 'can_manage_settings_bot'];

// ── Meta Webhook (public — Meta calls these) ──────────────────────────────────
// GET  /api/v1/whatsapp/webhook — Meta verification handshake
router.get('/webhook', ctrl.webhookVerify);

// POST /api/v1/whatsapp/webhook — Incoming messages and status updates
router.post('/webhook', ctrl.webhookReceive);

// ── Twilio Webhook (public — Twilio calls this, form-encoded body) ─────────────
// POST /api/v1/whatsapp/webhook/twilio — Incoming messages from Twilio WhatsApp
router.post('/webhook/twilio', express.urlencoded({ extended: false }), ctrl.webhookReceiveTwilio);

// ── Admin endpoints (require login + admin role) ──────────────────────────────
// GET  /api/v1/whatsapp/config
router.get('/config', authenticate, authorizeAny(WHATSAPP_ADMIN_PERMS), ctrl.getConfig);

// PUT  /api/v1/whatsapp/config
router.put('/config', authenticate, authorizeAny(WHATSAPP_ADMIN_PERMS), ctrl.saveConfig);

// POST /api/v1/whatsapp/verify-credentials
router.post('/verify-credentials', authenticate, authorizeAny(WHATSAPP_ADMIN_PERMS), ctrl.verifyCredentials);

// POST /api/v1/whatsapp/send-test
router.post('/send-test', authenticate, authorizeAny(WHATSAPP_ADMIN_PERMS), ctrl.sendTest);

// GET  /api/v1/whatsapp/logs
router.get('/logs', authenticate, authorizeAny(WHATSAPP_ADMIN_PERMS), ctrl.getLogs);

// GET  /api/v1/whatsapp/stats
router.get('/stats', authenticate, authorizeAny(WHATSAPP_ADMIN_PERMS), ctrl.getStats);

// ── Authenticated user endpoints ──────────────────────────────────────────────
// GET  /api/v1/whatsapp/status — current user linking status
router.get('/status', authenticate, ctrl.getUserStatus);

// POST /api/v1/whatsapp/send-otp — request OTP to link phone
router.post('/send-otp', authenticate, ctrl.requestOTP);

// POST /api/v1/whatsapp/verify-otp — verify OTP and link
router.post('/verify-otp', authenticate, ctrl.verifyOTP);

// DELETE /api/v1/whatsapp/unlink — unlink phone
router.delete('/unlink', authenticate, ctrl.unlinkPhone);

// GET  /api/v1/whatsapp/preferences — get current user's notification preferences
router.get('/preferences', authenticate, ctrl.getPreferences);

// PUT  /api/v1/whatsapp/preferences — save notification preferences
router.put('/preferences', authenticate, ctrl.savePreferences);

// ── Admin Broadcast ───────────────────────────────────────────────────────────
// POST /api/v1/whatsapp/broadcast — bulk send to all opted-in users
router.post('/broadcast', authenticate, authorizeAny(WHATSAPP_ADMIN_PERMS), ctrl.broadcast);

// GET  /api/v1/whatsapp/broadcast/history — outbound broadcast log
router.get('/broadcast/history', authenticate, authorizeAny(WHATSAPP_ADMIN_PERMS), ctrl.getBroadcastHistory);

module.exports = router;

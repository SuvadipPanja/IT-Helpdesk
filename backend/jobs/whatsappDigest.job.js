// ============================================
// WhatsApp Weekly Digest Job — Phase 9 Phase 4
// Sends each opted-in user a summary of their
// open tickets every Monday at 08:00.
// ============================================

const cron = require('node-cron');
const db = require('../config/database');
const settingsService = require('../services/settings.service');
const whatsappService = require('../services/whatsappService');
const logger = require('../utils/logger');

// ── Helpers ───────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Build the plain-text digest message for a single user.
 */
const buildDigestMessage = (user, summary) => {
  const firstName = user.first_name || user.username || 'there';
  const open     = Number(summary.open_tickets     || 0);
  const urgent   = Number(summary.urgent_tickets   || 0);
  const pending  = Number(summary.pending_tickets  || 0);

  const lines = [
    `📋 *Weekly Ticket Summary*`,
    `Hi ${firstName}! Here's your IT helpdesk summary for this week:`,
    '',
  ];

  if (open === 0) {
    lines.push(`✅ You have no open tickets this week — great job!`);
  } else {
    lines.push(`🎫 Open tickets:    ${open}`);
    if (urgent  > 0) lines.push(`🚨 Urgent/High:     ${urgent}`);
    if (pending > 0) lines.push(`⏳ Pending info:    ${pending}`);
  }

  lines.push('');
  lines.push(`Visit the helpdesk portal for details or to raise a new ticket.`);

  return lines.join('\n');
};

// ── Main run logic ────────────────────────────────────────────────────────────

const runDigest = async () => {
  logger.info('WhatsApp digest: starting weekly run');

  // 1. Check global WhatsApp + notify toggle
  const [waEnabled, notifyEnabled] = await Promise.all([
    settingsService.get('whatsapp_enabled'),
    settingsService.get('whatsapp_notify_enabled'),
  ]);

  if (waEnabled !== 'true' && waEnabled !== true) {
    logger.info('WhatsApp digest: skipped (WhatsApp disabled)');
    return;
  }
  if (notifyEnabled !== 'true' && notifyEnabled !== true) {
    logger.info('WhatsApp digest: skipped (notifications disabled)');
    return;
  }

  // 2. Fetch all opted-in, active users whose preferences allow digest
  //    Preference row may not exist (NULL) — treat as "enabled" by default
  let users;
  try {
    const result = await db.executeQuery(`
      SELECT DISTINCT
        u.user_id,
        u.first_name,
        u.username,
        u.whatsapp_phone
      FROM users u
      LEFT JOIN user_channel_preferences p
             ON p.user_id = u.user_id AND p.channel = 'whatsapp'
      WHERE u.is_active         = 1
        AND u.whatsapp_opted_in = 1
        AND u.whatsapp_phone   IS NOT NULL
        AND ISNULL(p.is_enabled, 1) = 1
        AND ISNULL(p.notify_update, 1) = 1
      ORDER BY u.user_id
    `);
    users = result.recordset || [];
  } catch (err) {
    logger.error('WhatsApp digest: failed to fetch users', { error: err.message });
    return;
  }

  logger.info(`WhatsApp digest: sending to ${users.length} user(s)`);

  let sent = 0;
  let failed = 0;

  for (const user of users) {
    try {
      // 3. Build per-user ticket summary
      const sumResult = await db.executeQuery(`
        SELECT
          SUM(CASE WHEN ts.is_final_status = 0 THEN 1 ELSE 0 END)                                    AS open_tickets,
          SUM(CASE WHEN UPPER(tp.priority_code) IN ('CRITICAL','HIGH')
                    AND ts.is_final_status = 0                        THEN 1 ELSE 0 END)              AS urgent_tickets,
          SUM(CASE WHEN UPPER(ts.status_code) = 'PENDING'
                    AND ts.is_final_status = 0                        THEN 1 ELSE 0 END)              AS pending_tickets
        FROM tickets t
        LEFT JOIN ticket_statuses   ts ON t.status_id   = ts.status_id
        LEFT JOIN ticket_priorities tp ON t.priority_id = tp.priority_id
        WHERE t.requester_id = @userId
      `, { userId: user.user_id });

      const summary = sumResult.recordset?.[0] || {};
      const message = buildDigestMessage(user, summary);

      // 4. Send via WhatsApp
      await whatsappService.sendTextMessage(
        user.whatsapp_phone,
        message,
        { userId: user.user_id },
      );

      sent++;
      logger.info('WhatsApp digest: sent', { userId: user.user_id });
    } catch (err) {
      failed++;
      logger.error('WhatsApp digest: failed for user', { userId: user.user_id, error: err.message });
    }

    // Rate-limit: max ~10 messages/second (Meta allows up to 80/sec, keep headroom)
    await sleep(100);
  }

  logger.info(`WhatsApp digest: complete — sent=${sent} failed=${failed}`);
};

// ── Job class ─────────────────────────────────────────────────────────────────

class WhatsAppDigestJob {
  constructor() {
    // Every Monday at 08:00 local server time
    this.cronExpression = '0 8 * * 1';
    this.job = null;
  }

  start() {
    this.job = cron.schedule(this.cronExpression, async () => {
      try {
        await runDigest();
      } catch (err) {
        logger.error('WhatsApp digest job unhandled error', { error: err.message });
      }
    });
    logger.info(`📱 WhatsApp Digest Job scheduled (${this.cronExpression})`);
  }

  stop() {
    if (this.job) {
      this.job.stop();
      this.job = null;
      logger.info('📱 WhatsApp Digest Job stopped');
    }
  }

  /** Trigger immediately (for manual testing) */
  async runNow() {
    return runDigest();
  }
}

module.exports = new WhatsAppDigestJob();

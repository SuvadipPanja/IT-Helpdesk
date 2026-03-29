// ============================================
// APPROVAL INBOUND MAIL JOB
// Polls IMAP for HD-APPROVE / HD-REJECT emails (mailto replies).
// Enable with APPROVAL_INBOUND_IMAP_* env vars — see docs/APPROVAL_INBOUND_EMAIL.md
// ============================================

const cron = require('node-cron');
const logger = require('../utils/logger');
const { processInboxOnce, getImapOptionsFromEnv } = require('../services/approvalInboundMail.service');

class ApprovalInboundMailJob {
  constructor() {
    this.cronExpression = process.env.APPROVAL_INBOUND_IMAP_CRON || '*/2 * * * *';
    this.job = null;
    this._isActive = false;
  }

  start() {
    if (!getImapOptionsFromEnv()) {
      logger.info('📭 Approval inbound IMAP job not started (set APPROVAL_INBOUND_IMAP_ENABLED=true and host/user/pass)');
      return;
    }

    try {
      if (this.job) {
        this.job.stop();
        this.job = null;
      }

      logger.info('📥 Starting Approval Inbound Mail job', { cron: this.cronExpression });

      this.job = cron.schedule(this.cronExpression, async () => {
        try {
          const r = await processInboxOnce();
          if (r.ran && (r.processed > 0 || r.errors > 0)) {
            logger.info('Approval inbound IMAP cycle', r);
          }
        } catch (e) {
          logger.error('Approval inbound IMAP cycle failed', e);
        }
      });

      this._isActive = true;
      logger.success('✅ Approval Inbound Mail job started');

      setTimeout(async () => {
        try {
          await processInboxOnce();
        } catch (e) {
          logger.error('Approval inbound IMAP initial run failed', e);
        }
      }, 8000);
    } catch (error) {
      logger.error('❌ Failed to start Approval Inbound Mail job', error);
    }
  }

  stop() {
    if (this.job) {
      this.job.stop();
      this.job = null;
    }
    this._isActive = false;
    logger.info('🛑 Approval Inbound Mail job stopped');
  }
}

module.exports = new ApprovalInboundMailJob();

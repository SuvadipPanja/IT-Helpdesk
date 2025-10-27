// ============================================
// EMAIL PROCESSOR JOB
// Processes pending emails in the queue
// Runs every 5 minutes via cron
// FILE: backend/jobs/emailProcessor.job.js
// ============================================

const cron = require('node-cron');
const emailQueueService = require('../services/emailQueue.service');
const logger = require('../utils/logger');

class EmailProcessorJob {
  constructor() {
    this.isRunning = false;
    this.cronExpression = '*/5 * * * *'; // Every 5 minutes
    this.job = null;
  }

  // ============================================
  // START THE CRON JOB
  // ============================================
  start() {
    try {
      logger.info('📧 Starting Email Processor Cron Job');
      logger.info(`⏰ Schedule: Every 5 minutes (${this.cronExpression})`);

      this.job = cron.schedule(this.cronExpression, async () => {
        await this.processEmails();
      });

      logger.success('✅ Email Processor Cron Job started successfully');
      
      // Run immediately on start
      setTimeout(() => this.processEmails(), 5000);
      
    } catch (error) {
      logger.error('❌ Failed to start Email Processor Cron Job', error);
    }
  }

  // ============================================
  // STOP THE CRON JOB
  // ============================================
  stop() {
    try {
      if (this.job) {
        this.job.stop();
        logger.info('🛑 Email Processor Cron Job stopped');
      }
    } catch (error) {
      logger.error('❌ Failed to stop Email Processor Cron Job', error);
    }
  }

  // ============================================
  // PROCESS PENDING EMAILS
  // ============================================
  async processEmails() {
    if (this.isRunning) {
      logger.warn('⚠️ Email processor already running, skipping this cycle');
      return;
    }

    this.isRunning = true;

    try {
      logger.separator('EMAIL PROCESSOR JOB');
      logger.info('🔄 Processing pending emails...');
      
      const startTime = Date.now();
      const processedCount = await emailQueueService.processPendingEmails(20);
      const duration = Date.now() - startTime;

      if (processedCount > 0) {
        logger.success(`✅ Processed ${processedCount} emails in ${duration}ms`);
      } else {
        logger.info('📭 No pending emails to process');
      }
      
      logger.separator();
      
    } catch (error) {
      logger.error('❌ Email processor job failed', error);
    } finally {
      this.isRunning = false;
    }
  }

  // ============================================
  // GET JOB STATUS
  // ============================================
  getStatus() {
    return {
      isRunning: this.isRunning,
      schedule: this.cronExpression,
      isActive: this.job ? true : false
    };
  }
}

// Export singleton instance
module.exports = new EmailProcessorJob();
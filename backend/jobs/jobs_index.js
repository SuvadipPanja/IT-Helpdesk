// ============================================
// JOB SCHEDULER
// Manages all background jobs
// Developer: Suvadip Panja
// Created: November 06, 2025
// FILE: backend/jobs/index.js
// ============================================

const passwordExpiryJob = require('./passwordExpiry.job');
const sessionCleanupJob = require('./sessionCleanup.job');
const autoUnlockJob = require('./autoUnlock.job');
const logger = require('../utils/logger');

/**
 * Job Scheduler
 * Starts and manages all background jobs
 */
class JobScheduler {
  constructor() {
    this.jobs = {
      passwordExpiry: passwordExpiryJob,
      sessionCleanup: sessionCleanupJob,
      autoUnlock: autoUnlockJob
    };
  }

  /**
   * Start all background jobs
   */
  startAll() {
    logger.separator('BACKGROUND JOBS');
    logger.info('🚀 Starting all background jobs...');

    try {
      // Start each job
      this.jobs.passwordExpiry.start();
      this.jobs.sessionCleanup.start();
      this.jobs.autoUnlock.start();

      logger.separator('BACKGROUND JOBS STARTED');
      logger.success('✅ All background jobs started successfully', {
        jobs: Object.keys(this.jobs).length
      });
      logger.separator();

    } catch (error) {
      logger.error('❌ Failed to start background jobs', error);
      throw error;
    }
  }

  /**
   * Stop all background jobs
   */
  stopAll() {
    logger.info('🛑 Stopping all background jobs...');

    try {
      this.jobs.passwordExpiry.stop();
      this.jobs.sessionCleanup.stop();
      this.jobs.autoUnlock.stop();

      logger.success('✅ All background jobs stopped');
    } catch (error) {
      logger.error('❌ Failed to stop background jobs', error);
    }
  }

  /**
   * Execute a specific job manually
   */
  async executeJob(jobName) {
    logger.info(`🔄 Manually executing job: ${jobName}`);

    if (!this.jobs[jobName]) {
      throw new Error(`Job not found: ${jobName}`);
    }

    try {
      await this.jobs[jobName].executeNow();
      logger.success(`✅ Job executed successfully: ${jobName}`);
    } catch (error) {
      logger.error(`❌ Job execution failed: ${jobName}`, error);
      throw error;
    }
  }

  /**
   * Get all jobs
   */
  getAllJobs() {
    return Object.keys(this.jobs).map(key => ({
      name: key,
      job: this.jobs[key]
    }));
  }
}

// Export singleton instance
const scheduler = new JobScheduler();

module.exports = scheduler;
// ============================================
// SESSION CLEANUP JOB
// Removes expired and inactive sessions
// Developer: Suvadip Panja
// Created: November 06, 2025
// FILE: backend/jobs/sessionCleanup.job.js
// ============================================

const cron = require('node-cron');
const { executeQuery } = require('../config/database');
const logger = require('../utils/logger');
const settingsService = require('../services/settings.service');

/**
 * Session Cleanup Job
 * Runs hourly to remove expired sessions
 */
class SessionCleanupJob {
  constructor() {
    this.jobName = 'Session Cleanup';
    this.isRunning = false;
  }

  /**
   * Start the job with cron schedule
   */
  start() {
    // Run every hour at minute 0
    const schedule = '0 * * * *'; // Every hour
    
    logger.info(`🕐 ${this.jobName} scheduled`, { schedule });

    cron.schedule(schedule, async () => {
      await this.execute();
    });

    logger.success(`✅ ${this.jobName} started successfully`);
  }

  /**
   * Execute the job manually (for testing)
   */
  async executeNow() {
    logger.info(`🔄 Manually executing ${this.jobName}`);
    await this.execute();
  }

  /**
   * Main job execution logic
   */
  async execute() {
    // Prevent concurrent execution
    if (this.isRunning) {
      logger.warn(`⚠️ ${this.jobName} is already running, skipping...`);
      return;
    }

    this.isRunning = true;

    try {
      logger.separator('SESSION CLEANUP JOB');
      logger.try(`Running ${this.jobName}`);

      const startTime = Date.now();
      let totalCleaned = 0;

      // Get settings
      const settings = await settingsService.getByCategory('security');
      const sessionTimeoutMinutes = parseInt(settings.session_timeout_minutes) || 480; // 8 hours default

      // Step 1: Mark inactive sessions as expired
      logger.try('Marking inactive sessions as expired');
      
      const markInactiveQuery = `
        UPDATE user_sessions
        SET is_active = 0
        WHERE is_active = 1
          AND DATEDIFF(MINUTE, last_activity, GETDATE()) >= @timeoutMinutes
      `;

      const inactiveResult = await executeQuery(markInactiveQuery, {
        timeoutMinutes: sessionTimeoutMinutes
      });

      const inactiveCleaned = inactiveResult.rowsAffected[0] || 0;
      totalCleaned += inactiveCleaned;

      if (inactiveCleaned > 0) {
        logger.success(`Marked ${inactiveCleaned} inactive sessions as expired`, {
          timeoutMinutes: sessionTimeoutMinutes
        });
      } else {
        logger.info('No inactive sessions found');
      }

      // Step 2: Mark sessions past expiry date as expired
      logger.try('Marking expired sessions');
      
      const markExpiredQuery = `
        UPDATE user_sessions
        SET is_active = 0
        WHERE is_active = 1
          AND expires_at < GETDATE()
      `;

      const expiredResult = await executeQuery(markExpiredQuery);
      const expiredCleaned = expiredResult.rowsAffected[0] || 0;
      totalCleaned += expiredCleaned;

      if (expiredCleaned > 0) {
        logger.success(`Marked ${expiredCleaned} expired sessions`);
      } else {
        logger.info('No expired sessions found');
      }

      // Step 3: Delete old inactive sessions (older than 30 days)
      logger.try('Deleting old inactive sessions');
      
      const deleteOldQuery = `
        DELETE FROM user_sessions
        WHERE is_active = 0
          AND DATEDIFF(DAY, created_at, GETDATE()) > 30
      `;

      const deleteResult = await executeQuery(deleteOldQuery);
      const deletedCount = deleteResult.rowsAffected[0] || 0;

      if (deletedCount > 0) {
        logger.success(`Deleted ${deletedCount} old inactive sessions (>30 days)`);
      } else {
        logger.info('No old sessions to delete');
      }

      // Step 4: Get session statistics
      logger.try('Getting session statistics');
      
      const statsQuery = `
        SELECT 
          COUNT(*) as total_sessions,
          SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_sessions,
          SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive_sessions,
          COUNT(DISTINCT user_id) as unique_users
        FROM user_sessions
      `;

      const statsResult = await executeQuery(statsQuery);
      const stats = statsResult.recordset[0];

      const duration = Date.now() - startTime;

      logger.separator('SESSION CLEANUP JOB COMPLETE');
      logger.success(`${this.jobName} completed successfully`, {
        sessionsCleaned: totalCleaned,
        oldSessionsDeleted: deletedCount,
        totalSessions: stats.total_sessions,
        activeSessions: stats.active_sessions,
        inactiveSessions: stats.inactive_sessions,
        uniqueUsers: stats.unique_users,
        duration: `${duration}ms`
      });
      logger.separator();

    } catch (error) {
      logger.error(`${this.jobName} failed`, error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get current session statistics
   */
  async getStats() {
    try {
      const statsQuery = `
        SELECT 
          COUNT(*) as total_sessions,
          SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_sessions,
          SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive_sessions,
          SUM(CASE WHEN expires_at < GETDATE() THEN 1 ELSE 0 END) as expired_sessions,
          COUNT(DISTINCT user_id) as unique_users,
          AVG(DATEDIFF(MINUTE, created_at, GETDATE())) as avg_age_minutes
        FROM user_sessions
      `;

      const result = await executeQuery(statsQuery);
      return result.recordset[0];
    } catch (error) {
      logger.error('Failed to get session statistics', error);
      return null;
    }
  }

  /**
   * Stop the job
   */
  stop() {
    logger.info(`🛑 Stopping ${this.jobName}`);
    // Cron jobs will stop when process exits
  }
}

// Export singleton instance
module.exports = new SessionCleanupJob();
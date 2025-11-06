// ============================================
// AUTO UNLOCK JOB
// Automatically unlocks accounts after lockout period expires
// Developer: Suvadip Panja
// Created: November 06, 2025
// FILE: backend/jobs/autoUnlock.job.js
// ============================================

const cron = require('node-cron');
const { executeQuery } = require('../config/database');
const logger = require('../utils/logger');
const securityService = require('../services/security.service');

/**
 * Auto Unlock Job
 * Runs every 15 minutes to unlock expired account locks
 */
class AutoUnlockJob {
  constructor() {
    this.jobName = 'Auto Unlock';
    this.isRunning = false;
  }

  /**
   * Start the job with cron schedule
   */
  start() {
    // Run every 15 minutes
    const schedule = '*/15 * * * *'; // Every 15 minutes
    
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
      logger.separator('AUTO UNLOCK JOB');
      logger.try(`Running ${this.jobName}`);

      const startTime = Date.now();

      // Find accounts with expired lockouts
      logger.try('Finding accounts with expired lockouts');
      
      const findLockedQuery = `
        SELECT 
          user_id,
          username,
          email,
          first_name,
          last_name,
          locked_until,
          DATEDIFF(MINUTE, locked_until, GETDATE()) as minutes_past_unlock
        FROM users
        WHERE is_locked = 1
          AND locked_until IS NOT NULL
          AND locked_until < GETDATE()
      `;

      const lockedResult = await executeQuery(findLockedQuery);

      if (lockedResult.recordset.length === 0) {
        logger.info('No accounts found with expired lockouts');
        this.isRunning = false;
        logger.separator();
        return;
      }

      const accountsToUnlock = lockedResult.recordset;
      logger.info(`Found ${accountsToUnlock.length} accounts to unlock`);

      let successCount = 0;
      let failureCount = 0;

      // Unlock each account
      for (const account of accountsToUnlock) {
        try {
          logger.try(`Unlocking account: ${account.username}`, {
            userId: account.user_id,
            lockedUntil: account.locked_until,
            minutesPastUnlock: account.minutes_past_unlock
          });

          // Use security service to unlock
          await securityService.unlockAccount(account.user_id);

          // Log security event
          await securityService.logSecurityEvent(
            account.user_id,
            'ACCOUNT_AUTO_UNLOCKED',
            `Account automatically unlocked after lockout period expired (${account.minutes_past_unlock} minutes past unlock time)`,
            null,
            null,
            true
          );

          successCount++;
          
          logger.success(`Account unlocked: ${account.username}`, {
            userId: account.user_id,
            minutesPastUnlock: account.minutes_past_unlock
          });

        } catch (error) {
          failureCount++;
          logger.error(`Failed to unlock account: ${account.username}`, error);
        }
      }

      // Get current lock statistics
      logger.try('Getting account lock statistics');
      
      const statsQuery = `
        SELECT 
          COUNT(*) as total_locked_accounts,
          SUM(CASE WHEN locked_until IS NULL THEN 1 ELSE 0 END) as permanent_locks,
          SUM(CASE WHEN locked_until IS NOT NULL AND locked_until > GETDATE() THEN 1 ELSE 0 END) as temporary_locks_active,
          AVG(CASE WHEN locked_until IS NOT NULL THEN DATEDIFF(MINUTE, GETDATE(), locked_until) ELSE NULL END) as avg_minutes_remaining
        FROM users
        WHERE is_locked = 1
      `;

      const statsResult = await executeQuery(statsQuery);
      const stats = statsResult.recordset[0];

      const duration = Date.now() - startTime;

      logger.separator('AUTO UNLOCK JOB COMPLETE');
      logger.success(`${this.jobName} completed successfully`, {
        accountsUnlocked: successCount,
        failures: failureCount,
        totalLockedAccounts: stats.total_locked_accounts || 0,
        permanentLocks: stats.permanent_locks || 0,
        temporaryLocksActive: stats.temporary_locks_active || 0,
        avgMinutesRemaining: Math.round(stats.avg_minutes_remaining || 0),
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
   * Get current account lock statistics
   */
  async getStats() {
    try {
      const statsQuery = `
        SELECT 
          COUNT(*) as total_locked_accounts,
          SUM(CASE WHEN locked_until IS NULL THEN 1 ELSE 0 END) as permanent_locks,
          SUM(CASE WHEN locked_until IS NOT NULL AND locked_until > GETDATE() THEN 1 ELSE 0 END) as temporary_locks_active,
          SUM(CASE WHEN locked_until IS NOT NULL AND locked_until < GETDATE() THEN 1 ELSE 0 END) as temporary_locks_expired,
          AVG(lockout_count) as avg_lockout_count,
          MAX(lockout_count) as max_lockout_count
        FROM users
        WHERE is_locked = 1
      `;

      const result = await executeQuery(statsQuery);
      return result.recordset[0];
    } catch (error) {
      logger.error('Failed to get account lock statistics', error);
      return null;
    }
  }

  /**
   * Manually unlock a specific account
   */
  async unlockAccount(userId) {
    try {
      logger.try(`Manually unlocking account`, { userId });
      
      await securityService.unlockAccount(userId);
      
      await securityService.logSecurityEvent(
        userId,
        'ACCOUNT_MANUALLY_UNLOCKED',
        'Account manually unlocked by administrator',
        null,
        null,
        true
      );

      logger.success(`Account manually unlocked`, { userId });
      return { success: true };
    } catch (error) {
      logger.error(`Failed to manually unlock account`, error);
      return { success: false, error: error.message };
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
module.exports = new AutoUnlockJob();
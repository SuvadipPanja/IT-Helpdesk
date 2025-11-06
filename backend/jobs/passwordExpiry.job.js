// ============================================
// PASSWORD EXPIRY NOTIFICATION JOB
// Sends email notifications before password expires
// Developer: Suvadip Panja
// Created: November 06, 2025
// FILE: backend/jobs/passwordExpiry.job.js
// ============================================

const cron = require('node-cron');
const { executeQuery } = require('../config/database');
const logger = require('../utils/logger');
const settingsService = require('../services/settings.service');
const emailService = require('../services/email.service');

/**
 * Password Expiry Notification Job
 * Runs daily to notify users about expiring passwords
 */
class PasswordExpiryJob {
  constructor() {
    this.jobName = 'Password Expiry Notification';
    this.isRunning = false;
  }

  /**
   * Start the job with cron schedule
   */
  start() {
    // Run daily at 9:00 AM
    const schedule = '0 9 * * *'; // Every day at 9 AM
    
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
      logger.separator('PASSWORD EXPIRY JOB');
      logger.try(`Running ${this.jobName}`);

      const startTime = Date.now();

      // Get settings
      const settings = await settingsService.getByCategory('security');
      const expiryDays = parseInt(settings.password_expiry_days) || 0;

      // If password expiry is disabled, skip
      if (expiryDays === 0) {
        logger.info('Password expiry is disabled, skipping job');
        this.isRunning = false;
        return;
      }

      // Find users with passwords expiring soon (7, 3, 1 days)
      const warningDays = [7, 3, 1]; // Days before expiry to send warnings
      let totalNotifications = 0;

      for (const days of warningDays) {
        logger.try(`Checking for passwords expiring in ${days} days`);

        const query = `
          SELECT 
            u.user_id,
            u.username,
            u.email,
            u.first_name,
            u.last_name,
            u.password_expires_at,
            DATEDIFF(DAY, GETDATE(), u.password_expires_at) as days_remaining
          FROM users u
          WHERE u.is_active = 1
            AND u.password_expires_at IS NOT NULL
            AND DATEDIFF(DAY, GETDATE(), u.password_expires_at) = @days
            AND (
              u.last_password_change_notification_at IS NULL 
              OR DATEDIFF(DAY, u.last_password_change_notification_at, GETDATE()) >= 1
            )
        `;

        const result = await executeQuery(query, { days });

        if (result.recordset.length > 0) {
          logger.info(`Found ${result.recordset.length} users with passwords expiring in ${days} days`);

          for (const user of result.recordset) {
            try {
              await this.sendExpiryNotification(user, days);
              totalNotifications++;

              // Update last notification timestamp
              await executeQuery(
                `UPDATE users SET last_password_change_notification_at = GETDATE() WHERE user_id = @userId`,
                { userId: user.user_id }
              );

              logger.success(`Notification sent to ${user.username}`, {
                userId: user.user_id,
                daysRemaining: days
              });
            } catch (error) {
              logger.error(`Failed to send notification to ${user.username}`, error);
            }
          }
        } else {
          logger.info(`No users found with passwords expiring in ${days} days`);
        }
      }

      // Check for already expired passwords
      logger.try('Checking for expired passwords');
      
      const expiredQuery = `
        SELECT 
          u.user_id,
          u.username,
          u.email,
          u.first_name,
          u.last_name,
          u.password_expires_at,
          DATEDIFF(DAY, u.password_expires_at, GETDATE()) as days_expired
        FROM users u
        WHERE u.is_active = 1
          AND u.password_expires_at IS NOT NULL
          AND u.password_expires_at < GETDATE()
          AND (
            u.last_password_change_notification_at IS NULL 
            OR DATEDIFF(DAY, u.last_password_change_notification_at, GETDATE()) >= 1
          )
      `;

      const expiredResult = await executeQuery(expiredQuery);

      if (expiredResult.recordset.length > 0) {
        logger.warn(`Found ${expiredResult.recordset.length} users with expired passwords`);

        for (const user of expiredResult.recordset) {
          try {
            await this.sendExpiredNotification(user);
            totalNotifications++;

            // Update last notification timestamp
            await executeQuery(
              `UPDATE users SET last_password_change_notification_at = GETDATE() WHERE user_id = @userId`,
              { userId: user.user_id }
            );

            logger.success(`Expired password notification sent to ${user.username}`, {
              userId: user.user_id,
              daysExpired: user.days_expired
            });
          } catch (error) {
            logger.error(`Failed to send expired notification to ${user.username}`, error);
          }
        }
      }

      const duration = Date.now() - startTime;

      logger.separator('PASSWORD EXPIRY JOB COMPLETE');
      logger.success(`${this.jobName} completed successfully`, {
        notificationsSent: totalNotifications,
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
   * Send password expiry warning notification
   */
  async sendExpiryNotification(user, daysRemaining) {
    const fullName = `${user.first_name} ${user.last_name}`.trim() || user.username;

    // Queue email
    await emailService.queueEmail({
      to: user.email,
      subject: `Password Expiring Soon - ${daysRemaining} Days Remaining`,
      templateName: 'password_expiry_warning',
      templateData: {
        user_name: fullName,
        days_remaining: daysRemaining,
        expiry_date: new Date(user.password_expires_at).toLocaleDateString('en-IN', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        change_password_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/profile/change-password`
      },
      priority: daysRemaining === 1 ? 'high' : 'normal',
      category: 'security'
    });

    logger.info(`Password expiry email queued for ${user.username}`, {
      userId: user.user_id,
      daysRemaining: daysRemaining
    });
  }

  /**
   * Send password expired notification
   */
  async sendExpiredNotification(user) {
    const fullName = `${user.first_name} ${user.last_name}`.trim() || user.username;

    // Queue email
    await emailService.queueEmail({
      to: user.email,
      subject: 'Password Expired - Action Required',
      templateName: 'password_expired',
      templateData: {
        user_name: fullName,
        days_expired: user.days_expired,
        expired_date: new Date(user.password_expires_at).toLocaleDateString('en-IN', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        support_email: process.env.SUPPORT_EMAIL || 'support@nexussupport.com'
      },
      priority: 'high',
      category: 'security'
    });

    logger.info(`Password expired email queued for ${user.username}`, {
      userId: user.user_id,
      daysExpired: user.days_expired
    });
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
module.exports = new PasswordExpiryJob();
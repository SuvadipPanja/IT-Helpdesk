/**
 * ============================================
 * CR APPROVAL REMINDER JOB
 * Sends reminders to approvers with pending approvals
 * older than the configured threshold (cr_approval_reminder_hours).
 * Runs every 4 hours.
 * FILE: backend/jobs/crApprovalReminder.job.js
 * ============================================
 */

const cron = require('node-cron');
const { executeQuery } = require('../config/database');
const crNotify = require('../services/crNotification.service');
const logger = require('../utils/logger');

class CRApprovalReminderJob {
  constructor() {
    this.isRunning = false;
    this.cronExpression = '0 */4 * * *'; // Every 4 hours
    this.job = null;
    this._isActive = false;
  }

  async start() {
    try {
      logger.info('🔔 Starting CR Approval Reminder Job');

      if (this.job) {
        this.job.stop();
        this.job = null;
      }

      this.job = cron.schedule(this.cronExpression, async () => {
        await this.doWork();
      });

      this._isActive = true;
      logger.success('✅ CR Approval Reminder Job started (every 4 hours)');
    } catch (error) {
      logger.error('❌ Failed to start CR Approval Reminder Job', error);
    }
  }

  stop() {
    try {
      if (this.job) {
        this.job.stop();
        this.job = null;
      }
      this._isActive = false;
      logger.info('🛑 CR Approval Reminder Job stopped');
    } catch (error) {
      logger.error('❌ Failed to stop CR Approval Reminder Job', error);
    }
  }

  async doWork() {
    if (this.isRunning) {
      logger.warn('CR Approval Reminder already running, skipping');
      return;
    }

    this.isRunning = true;
    try {
      // Load reminder threshold from system_settings
      let reminderHours = 24;
      try {
        const settingsRes = await executeQuery(
          `SELECT setting_value FROM system_settings WHERE setting_key = 'cr_approval_reminder_hours'`
        );
        if (settingsRes.recordset.length > 0) {
          reminderHours = parseInt(settingsRes.recordset[0].setting_value, 10) || 24;
        }
      } catch {
        // Use default
      }

      // Find pending approvals older than threshold
      const result = await executeQuery(
        `SELECT ca.approval_id, ca.cr_id, ca.approver_id, ca.approver_role,
                ca.requested_at, ca.reminder_count,
                cr.cr_number, cr.title,
                u.email AS approver_email,
                u.first_name + ' ' + u.last_name AS approver_name
         FROM cr_approvals ca
         INNER JOIN change_requests cr ON ca.cr_id = cr.cr_id
         INNER JOIN users u ON ca.approver_id = u.user_id
         WHERE ca.status = 'PENDING'
           AND DATEDIFF(HOUR, ca.requested_at, GETDATE()) >= @reminderHours
           AND ca.reminder_count < 5`,
        { reminderHours }
      );

      const pending = result.recordset || [];

      if (pending.length === 0) {
        logger.debug('CR Approval Reminder: no pending approvals need reminders');
        return;
      }

      logger.info(`CR Approval Reminder: ${pending.length} approvals need reminders`);

      let sent = 0;
      for (const row of pending) {
        try {
          await crNotify.sendApprovalReminder(
            { cr_id: row.cr_id, cr_number: row.cr_number, title: row.title },
            row.approver_email,
            row.approver_name,
            row.approver_id,
            row.requested_at ? new Date(row.requested_at).toISOString() : '',
            row.reminder_count + 1
          );

          // Increment reminder count
          await executeQuery(
            `UPDATE cr_approvals
             SET reminder_count = reminder_count + 1, reminder_sent = 1
             WHERE approval_id = @approvalId`,
            { approvalId: row.approval_id }
          );

          sent++;
        } catch (err) {
          logger.error(`CR Approval Reminder failed for approval ${row.approval_id}`, err);
        }
      }

      logger.success(`CR Approval Reminder: sent ${sent}/${pending.length} reminders`);
    } catch (error) {
      logger.error('CR Approval Reminder Job failed', error);
    } finally {
      this.isRunning = false;
    }
  }

  getStatus() {
    return {
      isActive: this._isActive,
      isRunning: this.isRunning,
      cronExpression: this.cronExpression,
    };
  }
}

module.exports = new CRApprovalReminderJob();

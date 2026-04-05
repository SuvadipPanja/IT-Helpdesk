/**
 * ============================================
 * CR SCHEDULE NOTIFY JOB
 * Sends reminders for CRs with scheduled_start
 * within the next 24 hours.
 * Runs every hour.
 * FILE: backend/jobs/crScheduleNotify.job.js
 * ============================================
 */

const cron = require('node-cron');
const { executeQuery } = require('../config/database');
const crNotify = require('../services/crNotification.service');
const logger = require('../utils/logger');

class CRScheduleNotifyJob {
  constructor() {
    this.isRunning = false;
    this.cronExpression = '0 * * * *'; // Every hour at :00
    this.job = null;
    this._isActive = false;
  }

  async start() {
    try {
      logger.info('📅 Starting CR Schedule Notify Job');

      if (this.job) {
        this.job.stop();
        this.job = null;
      }

      this.job = cron.schedule(this.cronExpression, async () => {
        await this.doWork();
      });

      this._isActive = true;
      logger.success('✅ CR Schedule Notify Job started (hourly)');
    } catch (error) {
      logger.error('❌ Failed to start CR Schedule Notify Job', error);
    }
  }

  stop() {
    try {
      if (this.job) {
        this.job.stop();
        this.job = null;
      }
      this._isActive = false;
      logger.info('🛑 CR Schedule Notify Job stopped');
    } catch (error) {
      logger.error('❌ Failed to stop CR Schedule Notify Job', error);
    }
  }

  async doWork() {
    if (this.isRunning) {
      logger.warn('CR Schedule Notify Job already running, skipping');
      return;
    }

    this.isRunning = true;
    try {
      // Find CRs scheduled to start within the next 24 hours that haven't been notified yet.
      // We use a flag approach: only CRs where scheduled_start is between NOW and NOW + 24h,
      // and the CR is in SCHEDULED status, and there's no CR_SCHEDULE_REMINDER activity logged.
      const result = await executeQuery(
        `SELECT cr.cr_id, cr.cr_number, cr.title,
                cr.scheduled_start, cr.scheduled_end,
                cr.requester_id, cr.assigned_to, cr.department_id,
                DATEDIFF(HOUR, GETDATE(), cr.scheduled_start) AS hours_until,
                ur.email AS requester_email,
                ur.first_name + ' ' + ur.last_name AS requester_name,
                ua.email AS assignee_email,
                ua.first_name + ' ' + ua.last_name AS assignee_name,
                ua.user_id AS assignee_id
         FROM change_requests cr
         INNER JOIN cr_statuses cs ON cr.cr_status_id = cs.status_id
         INNER JOIN users ur ON cr.requester_id = ur.user_id
         LEFT JOIN users ua ON cr.assigned_to = ua.user_id
         WHERE cs.status_code = 'SCHEDULED'
           AND cr.scheduled_start IS NOT NULL
           AND cr.scheduled_start > GETDATE()
           AND cr.scheduled_start <= DATEADD(HOUR, 24, GETDATE())
           AND NOT EXISTS (
             SELECT 1 FROM cr_activities ca
             WHERE ca.cr_id = cr.cr_id
               AND ca.activity_type = 'SCHEDULE_REMINDER_SENT'
           )`
      );

      const upcoming = result.recordset || [];

      if (upcoming.length === 0) {
        logger.debug('CR Schedule Notify: no upcoming CRs need reminders');
        return;
      }

      logger.info(`CR Schedule Notify: ${upcoming.length} CRs starting within 24 hours`);

      let notified = 0;
      for (const cr of upcoming) {
        try {
          const hoursUntil = cr.hours_until || 0;

          // Notify requester
          await crNotify.sendScheduleReminder(
            {
              cr_id: cr.cr_id,
              cr_number: cr.cr_number,
              title: cr.title,
              scheduled_start: cr.scheduled_start ? new Date(cr.scheduled_start).toISOString() : '',
              scheduled_end: cr.scheduled_end ? new Date(cr.scheduled_end).toISOString() : '',
            },
            cr.requester_email,
            cr.requester_name,
            cr.requester_id,
            hoursUntil
          );

          // Notify assignee if different from requester
          if (cr.assignee_id && cr.assignee_id !== cr.requester_id) {
            await crNotify.sendScheduleReminder(
              {
                cr_id: cr.cr_id,
                cr_number: cr.cr_number,
                title: cr.title,
                scheduled_start: cr.scheduled_start ? new Date(cr.scheduled_start).toISOString() : '',
                scheduled_end: cr.scheduled_end ? new Date(cr.scheduled_end).toISOString() : '',
              },
              cr.assignee_email,
              cr.assignee_name,
              cr.assignee_id,
              hoursUntil
            );
          }

          // Mark as notified via activity log (prevents duplicate reminders)
          await executeQuery(
            `INSERT INTO cr_activities (cr_id, activity_type, description, performed_by, performed_at)
             VALUES (@crId, 'SCHEDULE_REMINDER_SENT',
                     'Schedule reminder sent — CR starts in ' + CAST(@hoursUntil AS VARCHAR) + ' hours',
                     @requesterId, GETDATE())`,
            { crId: cr.cr_id, hoursUntil, requesterId: cr.requester_id }
          );

          notified++;
        } catch (err) {
          logger.error(`CR Schedule Notify failed for CR ${cr.cr_id}`, err);
        }
      }

      logger.success(`CR Schedule Notify: notified ${notified}/${upcoming.length} CRs`);
    } catch (error) {
      logger.error('CR Schedule Notify Job failed', error);
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

module.exports = new CRScheduleNotifyJob();

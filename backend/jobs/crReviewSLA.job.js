/**
 * ============================================
 * CR REVIEW SLA JOB
 * Monitors CRs where the review_due_date has passed
 * while still in SUBMITTED or UNDER_REVIEW status.
 * Marks review_sla_met = 0 and notifies managers.
 * Runs every 30 minutes.
 * FILE: backend/jobs/crReviewSLA.job.js
 * ============================================
 */

const cron = require('node-cron');
const { executeQuery } = require('../config/database');
const crNotify = require('../services/crNotification.service');
const logger = require('../utils/logger');

class CRReviewSLAJob {
  constructor() {
    this.isRunning = false;
    this.cronExpression = '*/30 * * * *'; // Every 30 minutes
    this.job = null;
    this._isActive = false;
  }

  async start() {
    try {
      logger.info('⏱️ Starting CR Review SLA Job');

      if (this.job) {
        this.job.stop();
        this.job = null;
      }

      this.job = cron.schedule(this.cronExpression, async () => {
        await this.doWork();
      });

      this._isActive = true;
      logger.success('✅ CR Review SLA Job started (every 30 min)');
    } catch (error) {
      logger.error('❌ Failed to start CR Review SLA Job', error);
    }
  }

  stop() {
    try {
      if (this.job) {
        this.job.stop();
        this.job = null;
      }
      this._isActive = false;
      logger.info('🛑 CR Review SLA Job stopped');
    } catch (error) {
      logger.error('❌ Failed to stop CR Review SLA Job', error);
    }
  }

  async doWork() {
    if (this.isRunning) {
      logger.warn('CR Review SLA Job already running, skipping');
      return;
    }

    this.isRunning = true;
    try {
      // Find CRs that have breached review SLA
      // review_due_date < NOW, still in SUBMITTED or UNDER_REVIEW, and review_sla_met IS NULL (not yet flagged)
      const result = await executeQuery(
        `SELECT cr.cr_id, cr.cr_number, cr.title, cr.review_due_date,
                cr.requester_id, cr.department_id,
                cs.status_code,
                ur.email AS requester_email,
                ur.first_name + ' ' + ur.last_name AS requester_name
         FROM change_requests cr
         INNER JOIN cr_statuses cs ON cr.cr_status_id = cs.status_id
         INNER JOIN users ur ON cr.requester_id = ur.user_id
         WHERE cr.review_due_date IS NOT NULL
           AND cr.review_due_date < GETDATE()
           AND cr.review_sla_met IS NULL
           AND cs.status_code IN ('SUBMITTED', 'UNDER_REVIEW')`
      );

      const breached = result.recordset || [];

      if (breached.length === 0) {
        logger.debug('CR Review SLA: no breaches detected');
        return;
      }

      logger.info(`CR Review SLA: ${breached.length} CRs have breached review SLA`);

      let flagged = 0;
      for (const cr of breached) {
        try {
          // Mark SLA as missed
          await executeQuery(
            `UPDATE change_requests SET review_sla_met = 0, updated_at = GETDATE()
             WHERE cr_id = @crId`,
            { crId: cr.cr_id }
          );

          // Log activity
          await executeQuery(
            `INSERT INTO cr_activities (cr_id, activity_type, description, performed_by, performed_at)
             VALUES (@crId, 'SLA_BREACHED', 'Review SLA breached — review_due_date has passed', @requesterId, GETDATE())`,
            { crId: cr.cr_id, requesterId: cr.requester_id }
          );

          // Notify requester about the breach
          await crNotify.createInAppNotification(
            cr.requester_id,
            'CR_SLA_BREACH',
            'CR Review SLA Breached',
            `${cr.cr_number} has exceeded its review SLA deadline.`
          );

          // Find and notify managers/admins
          const managers = await executeQuery(
            `SELECT u.user_id, u.email, u.first_name + ' ' + u.last_name AS full_name
             FROM users u
             INNER JOIN user_roles r ON u.role_id = r.role_id
             WHERE r.role_code IN ('ADMIN', 'MANAGER')
               AND u.is_active = 1`
          );

          for (const mgr of (managers.recordset || [])) {
            await crNotify.createInAppNotification(
              mgr.user_id,
              'CR_SLA_BREACH',
              'CR Review SLA Breached',
              `${cr.cr_number} "${cr.title}" has exceeded its review SLA.`
            );
          }

          flagged++;
        } catch (err) {
          logger.error(`CR Review SLA failed for CR ${cr.cr_id}`, err);
        }
      }

      logger.success(`CR Review SLA: flagged ${flagged}/${breached.length} CRs`);
    } catch (error) {
      logger.error('CR Review SLA Job failed', error);
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

module.exports = new CRReviewSLAJob();

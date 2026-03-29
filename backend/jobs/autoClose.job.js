// ============================================
// AUTO-CLOSE TICKETS JOB - FIXED VERSION
// Automatically close tickets that have been resolved for X days
// Runs on configurable schedule via cron
// FIXED: Corrected full_name to first_name + ' ' + last_name
// Developed by: Suvadip Panja
// FILE: backend/jobs/autoClose.job.js
// ============================================

const cron = require('node-cron');
const { executeQuery } = require('../config/database');
const emailQueueService = require('../services/emailQueue.service');
const settingsService = require('../services/settings.service');
const dateUtils = require('../utils/dateUtils');
const logger = require('../utils/logger');

class AutoCloseJob {
  constructor() {
    this.isRunning = false;
    this.cronExpression = '0 0 * * *'; // Default: Every day at midnight
    this.job = null;
    this.jobEnabled = false;
    this._isActive = false;
  }

  // ============================================
  // START THE CRON JOB
  // forceStart=true → called from Job Monitor (bypass settings check, enable setting)
  // forceStart=false → called at server boot (respect settings)
  // ============================================
  async start(forceStart = false) {
    try {
      logger.info('🔒 Starting Auto-Close Tickets Cron Job');
      
      // Check if job is enabled in settings
      const enabled = await settingsService.get('ticket_auto_close_enabled');
      this.jobEnabled = enabled === 'true' || enabled === true;

      if (!this.jobEnabled) {
        if (!forceStart) {
          logger.warn('⚠️  Auto-Close job is DISABLED in settings');
          return;
        }
        // Admin forced start from Job Monitor — enable the setting
        logger.info('🔄 Auto-Close: enabling via Job Monitor force-start');
        await settingsService.set('ticket_auto_close_enabled', 'true');
        this.jobEnabled = true;
      }

      logger.info(`📊 Status: ${this.jobEnabled ? 'Enabled' : 'Disabled'}`);

      if (this.job) {
        this.job.stop();
        this.job = null;
      }
      this.job = cron.schedule(this.cronExpression, async () => {
        await this.runAutoClose();
      });

      logger.success('✅ Auto-Close Cron Job started successfully');
      this._isActive = true;
      logger.info(`⏰ Schedule: ${this.cronExpression} (Daily at midnight)`);
      
    } catch (error) {
      logger.error('❌ Failed to start Auto-Close Cron Job', error);
    }
  }

  // ============================================
  // STOP THE CRON JOB
  // ============================================
  stop(updateSetting = true) {
    try {
      if (this.job) {
        this.job.stop();
        this.job = null;
      }
      this._isActive = false;
      this.jobEnabled = false;
      logger.info('🛑 Auto-Close Cron Job stopped');
      // Persist the disabled state so it stays stopped after restart
      if (updateSetting) {
        settingsService.set('ticket_auto_close_enabled', 'false').catch(() => {});
      }
    } catch (error) {
      logger.error('❌ Failed to stop Auto-Close Cron Job', error);
    }
  }

  // ============================================
  // MAIN AUTO-CLOSE LOGIC
  // ============================================
  async runAutoClose() {
    if (this.isRunning) {
      logger.warn('⚠️  Auto-Close job already running, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    
    logger.info('');
    logger.info('================================================');
    logger.info('🔒 AUTO-CLOSE JOB STARTED');
    logger.info(`⏰ Execution Time: ${dateUtils.getTimestamp()}`);
    logger.info('================================================');

    try {
      // Get settings
      const autoCloseDays = await settingsService.get('ticket_auto_close_days') || 30;
      const requireApproval = await settingsService.get('ticket_require_approval_close');
      
      logger.info(`📅 Auto-close threshold: ${autoCloseDays} days`);
      logger.info(`🔐 Approval required: ${requireApproval === 'true' ? 'Yes' : 'No'}`);

      // Find tickets to auto-close
      const tickets = await this.findTicketsToClose(autoCloseDays, requireApproval);
      
      logger.info(`🎫 Found ${tickets.length} tickets eligible for auto-close`);

      if (tickets.length === 0) {
        logger.info('✅ No tickets to auto-close');
        logger.info('================================================');
        return;
      }

      // Close each ticket
      let successCount = 0;
      let failCount = 0;

      for (const ticket of tickets) {
        try {
          await this.closeTicket(ticket, autoCloseDays);
          successCount++;
          logger.info(`✅ Closed ticket: ${ticket.ticket_number}`);
        } catch (error) {
          failCount++;
          logger.error(`❌ Failed to close ticket ${ticket.ticket_number}:`, error);
        }
      }

      // Log execution to database
      await this.logJobExecution(successCount, failCount, tickets.length);

      logger.info('');
      logger.info('================================================');
      logger.info('📊 AUTO-CLOSE JOB SUMMARY');
      logger.info(`✅ Successfully closed: ${successCount} tickets`);
      logger.info(`❌ Failed to close: ${failCount} tickets`);
      logger.info(`⏱️  Duration: ${Date.now() - startTime}ms`);
      logger.info('================================================');
      logger.info('');

    } catch (error) {
      logger.error('❌ Auto-Close job failed:', error);
      logger.info('================================================');
    } finally {
      this.isRunning = false;
    }
  }

  // ============================================
  // FIND TICKETS ELIGIBLE FOR AUTO-CLOSE
  // FIXED: Changed full_name to first_name + ' ' + last_name
  // ============================================
  async findTicketsToClose(autoCloseDays, requireApproval) {
    try {
      // Get the "Resolved" status ID (usually 6)
      const resolvedStatusQuery = `
        SELECT status_id 
        FROM ticket_statuses 
        WHERE status_code = 'RESOLVED'
      `;
      const resolvedStatus = await executeQuery(resolvedStatusQuery);
      
      if (resolvedStatus.recordset.length === 0) {
        logger.error('❌ Resolved status not found in database');
        return [];
      }

      const resolvedStatusId = resolvedStatus.recordset[0].status_id;

      // Build query based on approval requirement
      let query;
      
      if (requireApproval === 'true') {
        // Only close tickets that are resolved AND approved
        query = `
          SELECT 
            t.ticket_id,
            t.ticket_number,
            t.subject,
            t.status_id,
            t.updated_at,
            t.created_by,
            t.assigned_to,
            t.closure_approved_at,
            u.email as creator_email,
            u.first_name + ' ' + u.last_name as creator_name,
            a.email as assignee_email,
            a.first_name + ' ' + a.last_name as assignee_name
          FROM tickets t
          LEFT JOIN users u ON t.created_by = u.user_id
          LEFT JOIN users a ON t.assigned_to = a.user_id
          WHERE t.status_id = @resolvedStatusId
            AND t.auto_closed = 0
            AND t.closure_approved_at IS NOT NULL
            AND DATEDIFF(DAY, t.closure_approved_at, GETDATE()) >= @autoCloseDays
          ORDER BY t.updated_at ASC
        `;
      } else {
        // Close any resolved ticket after X days
        query = `
          SELECT 
            t.ticket_id,
            t.ticket_number,
            t.subject,
            t.status_id,
            t.updated_at,
            t.created_by,
            t.assigned_to,
            u.email as creator_email,
            u.first_name + ' ' + u.last_name as creator_name,
            a.email as assignee_email,
            a.first_name + ' ' + a.last_name as assignee_name
          FROM tickets t
          LEFT JOIN users u ON t.created_by = u.user_id
          LEFT JOIN users a ON t.assigned_to = a.user_id
          WHERE t.status_id = @resolvedStatusId
            AND t.auto_closed = 0
            AND DATEDIFF(DAY, t.updated_at, GETDATE()) >= @autoCloseDays
          ORDER BY t.updated_at ASC
        `;
      }

      const result = await executeQuery(query, {
        resolvedStatusId,
        autoCloseDays: parseInt(autoCloseDays)
      });

      return result.recordset;

    } catch (error) {
      logger.error('Failed to find tickets for auto-close:', error);
      return [];
    }
  }

  // ============================================
  // CLOSE A TICKET
  // ============================================
  async closeTicket(ticket, autoCloseDays = 30) {
    try {
      // Get the "Closed" status ID
      const closedStatusQuery = `
        SELECT status_id 
        FROM ticket_statuses 
        WHERE status_code = 'CLOSED'
      `;
      const closedStatus = await executeQuery(closedStatusQuery);
      
      if (closedStatus.recordset.length === 0) {
        throw new Error('Closed status not found in database');
      }

      const closedStatusId = closedStatus.recordset[0].status_id;

      // Update ticket to closed status
      const updateQuery = `
        UPDATE tickets
        SET 
          status_id = @closedStatusId,
          closed_at = GETDATE(),
          auto_closed = 1,
          updated_at = GETDATE()
        WHERE ticket_id = @ticketId
      `;

      await executeQuery(updateQuery, {
        closedStatusId,
        ticketId: ticket.ticket_id
      });

      // Log activity
      const activityQuery = `
        INSERT INTO ticket_activities (
          ticket_id,
          activity_type,
          description,
          performed_at
        )
        VALUES (
          @ticketId,
          'STATUS_CHANGE',
          @description,
          GETDATE()
        )
      `;

      await executeQuery(activityQuery, {
        ticketId: ticket.ticket_id,
        description: `Ticket automatically closed after being resolved for ${autoCloseDays} days`
      });

      // Send email notification
      await this.sendClosureEmail(ticket);

    } catch (error) {
      logger.error(`Error closing ticket ${ticket.ticket_number}:`, error);
      throw error;
    }
  }

  // ============================================
  // SEND CLOSURE EMAIL
  // ============================================
  async sendClosureEmail(ticket) {
    try {
      // Check if email notifications are enabled
      const emailEnabled = await settingsService.get('email_ticket_closed');
      if (emailEnabled !== 'true') {
        return;
      }

      // Send to ticket creator
      if (ticket.creator_email) {
        await emailQueueService.sendTemplatedEmail(
          'TICKET_CLOSED',
          ticket.creator_email,
          {
            ticket_number: ticket.ticket_number,
            subject: ticket.subject,
            is_auto_closed: true
          },
          {
            recipientName: ticket.creator_name,
            emailType: 'TICKET_CLOSED',
            relatedEntityType: 'TICKET',
            relatedEntityId: ticket.ticket_id,
            priority: 3
          }
        );
      }

      // Send to assignee if different from creator
      if (ticket.assignee_email && ticket.assignee_email !== ticket.creator_email) {
        await emailQueueService.sendTemplatedEmail(
          'TICKET_CLOSED',
          ticket.assignee_email,
          {
            ticket_number: ticket.ticket_number,
            subject: ticket.subject,
            is_auto_closed: true
          },
          {
            recipientName: ticket.assignee_name,
            emailType: 'TICKET_CLOSED',
            relatedEntityType: 'TICKET',
            relatedEntityId: ticket.ticket_id,
            priority: 3
          }
        );
      }

    } catch (error) {
      logger.error(`Failed to send closure email for ticket ${ticket.ticket_number}:`, error);
    }
  }

  // ============================================
  // LOG JOB EXECUTION TO DATABASE
  // ============================================
  async logJobExecution(successCount, failCount, totalFound) {
    try {
      // Note: This requires a job_executions table
      // If it doesn't exist, this will fail silently
      const logQuery = `
        IF OBJECT_ID('job_executions', 'U') IS NOT NULL
        BEGIN
          INSERT INTO job_executions (
            job_name,
            status,
            started_at,
            completed_at,
            duration_ms,
            records_processed,
            records_failed,
            execution_details
          )
          VALUES (
            'auto-close',
            @status,
            @startedAt,
            GETDATE(),
            @duration,
            @successCount,
            @failCount,
            @details
          )
        END
      `;

      await executeQuery(logQuery, {
        status: failCount === 0 ? 'success' : 'partial',
        startedAt: new Date(),
        duration: 0,
        successCount,
        failCount,
        details: JSON.stringify({
          totalFound,
          successCount,
          failCount,
          message: failCount === 0 ? 'All tickets closed successfully' : `${successCount} closed, ${failCount} failed`
        })
      });

    } catch (error) {
      // Silently fail if table doesn't exist
      logger.debug('Could not log job execution (table may not exist):', error.message);
    }
  }

  // ============================================
  // GET JOB STATUS
  // ============================================
  async getStatus() {
    try {
      // Get latest execution from database
      const query = `
        IF OBJECT_ID('job_executions', 'U') IS NOT NULL
        BEGIN
          SELECT TOP 1
            execution_id,
            status,
            started_at,
            completed_at,
            duration_ms,
            records_processed,
            records_failed
          FROM job_executions
          WHERE job_name = 'auto-close'
          ORDER BY started_at DESC
        END
      `;

      const result = await executeQuery(query);
      const lastExecution = result.recordset.length > 0 ? result.recordset[0] : null;
      
      return {
        jobName: 'auto-close',
        isRunning: this.isRunning,
        isEnabled: this.jobEnabled,
        schedule: this.cronExpression,
        isActive: this._isActive,
        lastExecution: lastExecution ? {
          executionId: lastExecution.execution_id,
          status: lastExecution.status,
          startedAt: lastExecution.started_at,
          completedAt: lastExecution.completed_at,
          durationMs: lastExecution.duration_ms,
          recordsProcessed: lastExecution.records_processed,
          recordsFailed: lastExecution.records_failed
        } : null
      };
    } catch (error) {
      logger.error('Failed to get job status', error);
      return {
        jobName: 'auto-close',
        isRunning: this.isRunning,
        isEnabled: this.jobEnabled,
        schedule: this.cronExpression,
        isActive: this._isActive,
        lastExecution: null,
        error: error.message
      };
    }
  }
}

// Export singleton instance
module.exports = new AutoCloseJob();
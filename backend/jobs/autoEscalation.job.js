// ============================================
// AUTO-ESCALATION JOB
// Automatically escalate unresolved tickets after threshold hours
// Runs on configurable schedule via cron (from database)
// FILE: backend/jobs/autoEscalation.job.js
// ============================================

const cron = require('node-cron');
const { executeQuery } = require('../config/database');
const emailQueueService = require('../services/emailQueue.service');
const settingsService = require('../services/settings.service');
const logger = require('../utils/logger');

class AutoEscalationJob {
  constructor() {
    this.isRunning = false;
    this.cronExpression = '0 */1 * * *'; // Default: Every hour
    this.job = null;
    this.jobEnabled = true;
  }

  // ============================================
  // START THE CRON JOB
  // ============================================
  async start() {
    try {
      logger.info('🚨 Starting Auto-Escalation Cron Job');
      
      // Load schedule from database
      await this.loadSchedule();
      
      logger.info(`⏰ Schedule: ${this.cronExpression}`);
      logger.info(`📊 Status: ${this.jobEnabled ? 'Enabled' : 'Disabled'}`);

      if (!this.jobEnabled) {
        logger.warn('⚠️  Auto-Escalation job is DISABLED in settings');
        return;
      }

      this.job = cron.schedule(this.cronExpression, async () => {
        await this.runEscalation();
      });

      logger.success('✅ Auto-Escalation Cron Job started successfully');
      
      // Run immediately on start after 10 seconds
      setTimeout(() => this.runEscalation(), 10000);
      
    } catch (error) {
      logger.error('❌ Failed to start Auto-Escalation Cron Job', error);
    }
  }

  // ============================================
  // STOP THE CRON JOB
  // ============================================
  stop() {
    try {
      if (this.job) {
        this.job.stop();
        logger.info('🛑 Auto-Escalation Cron Job stopped');
      }
    } catch (error) {
      logger.error('❌ Failed to stop Auto-Escalation Cron Job', error);
    }
  }

  // ============================================
  // LOAD SCHEDULE FROM DATABASE
  // ============================================
  async loadSchedule() {
    try {
      const scheduleQuery = `
        SELECT setting_value 
        FROM system_settings 
        WHERE setting_key = 'job_escalation_schedule'
      `;
      
      const result = await executeQuery(scheduleQuery);
      if (result.recordset.length > 0) {
        this.cronExpression = result.recordset[0].setting_value || '0 */1 * * *';
      }

      // Check if job is enabled
      const enabledQuery = `
        SELECT setting_value 
        FROM system_settings 
        WHERE setting_key = 'job_escalation_enabled'
      `;
      
      const enabledResult = await executeQuery(enabledQuery);
      if (enabledResult.recordset.length > 0) {
        const value = enabledResult.recordset[0].setting_value;
        this.jobEnabled = value === 'true' || value === true || value === '1';
      }

    } catch (error) {
      logger.error('Failed to load job schedule from database', error);
      // Use default schedule
      this.cronExpression = '0 */1 * * *';
    }
  }

  // ============================================
  // RUN AUTO-ESCALATION PROCESS
  // ============================================
  async runEscalation() {
    if (this.isRunning) {
      logger.warn('⚠️  Auto-escalation already running, skipping this cycle');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    let executionId = null;

    try {
      // ============================================
      // START EXECUTION LOGGING
      // ============================================
      const startLogQuery = `
        INSERT INTO job_executions (
          job_name, status, started_at, created_at
        )
        OUTPUT INSERTED.execution_id
        VALUES ('auto-escalation', 'running', GETDATE(), GETDATE())
      `;
      
      const logResult = await executeQuery(startLogQuery);
      executionId = logResult.recordset[0].execution_id;

      logger.separator('AUTO-ESCALATION JOB');
      logger.info(`🔄 Processing auto-escalation (Execution ID: ${executionId})`);
      
      // ============================================
      // STEP 1: CHECK IF AUTO-ESCALATION IS ENABLED
      // ============================================
      const settings = await settingsService.getByCategory('ticket');
      
      const isEnabled = settings.ticket_auto_escalate === 'true' || 
                       settings.ticket_auto_escalate === true;
      
      if (!isEnabled) {
        logger.info('⏸️  Auto-escalation is DISABLED in settings');
        
        // Log successful completion (no work needed)
        await this.completeExecution(executionId, 'success', 0, 0, startTime, {
          message: 'Auto-escalation disabled in settings'
        });
        
        logger.separator();
        return;
      }
      
      logger.success('✅ Auto-escalation is ENABLED');
      
      // Get threshold
      const thresholdHours = parseInt(settings.ticket_escalate_hours) || 24;
      logger.info(`⏰ Escalation threshold: ${thresholdHours} hours`);
      
      // ============================================
      // STEP 2: FIND TICKETS THAT NEED ESCALATION
      // ============================================
      logger.info('🔍 Finding tickets that need escalation');
      
      const escalationQuery = `
        SELECT 
          t.ticket_id,
          t.ticket_number,
          t.subject,
          t.created_at,
          t.requester_id,
          t.assigned_to,
          t.department_id,
          ts.status_name,
          tp.priority_name,
          u_requester.email as requester_email,
          u_requester.first_name + ' ' + u_requester.last_name as requester_name,
          u_assigned.email as assigned_email,
          u_assigned.first_name + ' ' + u_assigned.last_name as assigned_name,
          d.department_name,
          DATEDIFF(HOUR, t.created_at, GETDATE()) as hours_old
        FROM tickets t
        INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
        LEFT JOIN ticket_priorities tp ON t.priority_id = tp.priority_id
        LEFT JOIN users u_requester ON t.requester_id = u_requester.user_id
        LEFT JOIN users u_assigned ON t.assigned_to = u_assigned.user_id
        LEFT JOIN departments d ON t.department_id = d.department_id
        WHERE ts.status_name NOT IN ('Resolved', 'Closed', 'Cancelled', 'Escalated')
          AND DATEDIFF(HOUR, t.created_at, GETDATE()) >= @thresholdHours
        ORDER BY t.created_at ASC
      `;
      
      const ticketsResult = await executeQuery(escalationQuery, { thresholdHours });
      const tickets = ticketsResult.recordset;
      
      logger.info(`📋 Found ${tickets.length} ticket(s) for escalation`);
      
      if (tickets.length === 0) {
        logger.info('✨ No tickets need escalation at this time');
        
        // Log successful completion (no work needed)
        await this.completeExecution(executionId, 'success', 0, 0, startTime, {
          message: 'No tickets to escalate'
        });
        
        logger.separator();
        return;
      }
      
      // ============================================
      // STEP 3: GET ESCALATED STATUS ID
      // ============================================
      const statusQuery = `
        SELECT status_id 
        FROM ticket_statuses 
        WHERE status_name = 'Escalated'
      `;
      
      const statusResult = await executeQuery(statusQuery);
      
      if (statusResult.recordset.length === 0) {
        throw new Error('Escalated status not found in database');
      }
      
      const escalatedStatusId = statusResult.recordset[0].status_id;
      
      // ============================================
      // STEP 4: GET MANAGERS AND ADMINS
      // ============================================
      const managersQuery = `
        SELECT 
          u.user_id,
          u.email,
          u.first_name + ' ' + u.last_name as full_name,
          r.role_name
        FROM users u
        INNER JOIN user_roles r ON u.role_id = r.role_id
        WHERE u.is_active = 1
          AND r.role_code IN ('ADMIN', 'MANAGER')
          AND u.email IS NOT NULL
      `;
      
      const managersResult = await executeQuery(managersQuery);
      const managers = managersResult.recordset;
      
      logger.info(`👥 Found ${managers.length} manager(s)/admin(s) for notifications`);
      
      // ============================================
      // STEP 5: GET GENERAL SETTINGS
      // ============================================
      const generalSettings = await settingsService.getByCategory('general');
      const systemName = generalSettings.system_name || 'IT Helpdesk';
      const appUrl = process.env.APP_URL || 'http://localhost:5173';
      
      // ============================================
      // STEP 6: ESCALATE EACH TICKET
      // ============================================
      let escalatedCount = 0;
      let failedCount = 0;
      
      for (const ticket of tickets) {
        try {
          logger.info(`📤 Escalating ticket: ${ticket.ticket_number}`);
          
          // Update ticket status
          const updateQuery = `
            UPDATE tickets 
            SET status_id = @statusId,
                updated_at = GETDATE()
            WHERE ticket_id = @ticketId
          `;
          
          await executeQuery(updateQuery, {
            statusId: escalatedStatusId,
            ticketId: ticket.ticket_id
          });
          
          // Log activity
          const activityQuery = `
            INSERT INTO ticket_activities (
              ticket_id, activity_type, description, performed_by
            )
            VALUES (
              @ticketId, 'ESCALATED', 
              'Ticket automatically escalated after ' + CAST(@hoursOld AS VARCHAR) + ' hours',
              1
            )
          `;
          
          await executeQuery(activityQuery, {
            ticketId: ticket.ticket_id,
            hoursOld: ticket.hours_old
          });
          
          // Send emails to managers/admins
          for (const manager of managers) {
            try {
              await emailQueueService.sendTemplatedEmail(
                'TICKET_ESCALATED',
                manager.email,
                {
                  ticket_number: ticket.ticket_number,
                  subject: ticket.subject,
                  priority: ticket.priority_name || 'Medium',
                  status: 'Escalated',
                  hours_old: ticket.hours_old,
                  requester_name: ticket.requester_name || 'Unknown',
                  assigned_to: ticket.assigned_name || 'Unassigned',
                  department: ticket.department_name || 'No Department',
                  ticket_url: `${appUrl}/tickets/${ticket.ticket_id}`,
                  system_name: systemName
                },
                {
                  recipientName: manager.full_name,
                  recipientUserId: manager.user_id,
                  emailType: 'TICKET_ESCALATED',
                  relatedEntityType: 'TICKET',
                  relatedEntityId: ticket.ticket_id,
                  priority: 3
                }
              );
            } catch (emailError) {
              logger.error(`Failed to send escalation email to ${manager.email}`, emailError);
            }
          }
          
          // Send email to assigned engineer (if assigned)
          if (ticket.assigned_to && ticket.assigned_email) {
            try {
              await emailQueueService.sendTemplatedEmail(
                'TICKET_ESCALATED',
                ticket.assigned_email,
                {
                  ticket_number: ticket.ticket_number,
                  subject: ticket.subject,
                  priority: ticket.priority_name || 'Medium',
                  status: 'Escalated',
                  hours_old: ticket.hours_old,
                  requester_name: ticket.requester_name || 'Unknown',
                  assigned_to: ticket.assigned_name || 'Unassigned',
                  department: ticket.department_name || 'No Department',
                  ticket_url: `${appUrl}/tickets/${ticket.ticket_id}`,
                  system_name: systemName
                },
                {
                  recipientName: ticket.assigned_name,
                  recipientUserId: ticket.assigned_to,
                  emailType: 'TICKET_ESCALATED',
                  relatedEntityType: 'TICKET',
                  relatedEntityId: ticket.ticket_id,
                  priority: 3
                }
              );
            } catch (emailError) {
              logger.error(`Failed to send escalation email to ${ticket.assigned_email}`, emailError);
            }
          }
          
          escalatedCount++;
          logger.success(`✅ Ticket escalated: ${ticket.ticket_number}`);
          
        } catch (ticketError) {
          failedCount++;
          logger.error(`Failed to escalate ticket ${ticket.ticket_number}`, ticketError);
        }
      }
      
      // ============================================
      // COMPLETE EXECUTION LOGGING
      // ============================================
      const duration = Date.now() - startTime;
      
      await this.completeExecution(
        executionId, 
        'success', 
        escalatedCount, 
        failedCount, 
        startTime,
        {
          totalFound: tickets.length,
          escalated: escalatedCount,
          failed: failedCount,
          threshold: thresholdHours,
          managers: managers.length
        }
      );
      
      logger.success(`✅ Auto-escalation complete: ${escalatedCount} escalated, ${failedCount} failed (${duration}ms)`);
      logger.separator();
      
    } catch (error) {
      logger.error('❌ Auto-escalation job failed', error);
      
      // Log failed execution
      if (executionId) {
        const duration = Date.now() - startTime;
        await this.completeExecution(
          executionId, 
          'failed', 
          0, 
          0, 
          startTime,
          { error: error.message }
        );
      }
      
      logger.separator();
    } finally {
      this.isRunning = false;
    }
  }

  // ============================================
  // COMPLETE EXECUTION LOGGING
  // ============================================
  async completeExecution(executionId, status, processed, failed, startTime, details = {}) {
    try {
      const duration = Date.now() - startTime;
      
      const completeQuery = `
        UPDATE job_executions
        SET status = @status,
            completed_at = GETDATE(),
            duration_ms = @duration,
            records_processed = @processed,
            records_failed = @failed,
            execution_details = @details
        WHERE execution_id = @executionId
      `;
      
      await executeQuery(completeQuery, {
        executionId,
        status,
        duration,
        processed,
        failed,
        details: JSON.stringify(details)
      });
      
    } catch (error) {
      logger.error('Failed to complete execution logging', error);
    }
  }

  // ============================================
  // GET JOB STATUS
  // ============================================
  async getStatus() {
    try {
      // Reload schedule from database
      await this.loadSchedule();
      
      // Get last execution
      const lastExecQuery = `
        SELECT TOP 1
          execution_id,
          status,
          started_at,
          completed_at,
          duration_ms,
          records_processed,
          records_failed
        FROM job_executions
        WHERE job_name = 'auto-escalation'
        ORDER BY started_at DESC
      `;
      
      const result = await executeQuery(lastExecQuery);
      const lastExecution = result.recordset.length > 0 ? result.recordset[0] : null;
      
      return {
        jobName: 'auto-escalation',
        isRunning: this.isRunning,
        isEnabled: this.jobEnabled,
        schedule: this.cronExpression,
        isActive: this.job ? true : false,
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
        jobName: 'auto-escalation',
        isRunning: this.isRunning,
        isEnabled: this.jobEnabled,
        schedule: this.cronExpression,
        isActive: this.job ? true : false,
        lastExecution: null,
        error: error.message
      };
    }
  }
}

// Export singleton instance
module.exports = new AutoEscalationJob();
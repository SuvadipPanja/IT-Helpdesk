// ============================================
// BACKUP BACKGROUND JOB
// Scheduled automatic backup job
// Developer: Suvadip Panja
// Date: January 30, 2026
// FILE: backend/jobs/backup.job.js
// ============================================

const cron = require('node-cron');
const backupService = require('../services/backup.service');
const settingsService = require('../services/settings.service');
const emailQueueService = require('../services/emailQueue.service');
const { executeQuery } = require('../config/database');
const logger = require('../utils/logger');

// ============================================
// JOB STATE
// ============================================
let backupJob = null;
let currentSchedule = null;

// ============================================
// START BACKUP JOB
// ============================================
const startBackupJob = async () => {
  try {
    logger.separator('BACKUP JOB INITIALIZATION');
    logger.try('Starting backup job');

    // Load backup settings
    const settings = await settingsService.getByCategory('backup');

    const backupEnabled = settings.backup_enabled === 'true' || settings.backup_enabled === true;
    const backupFrequency = settings.backup_frequency || 'daily';
    const backupTime = settings.backup_time || '02:00';

    if (!backupEnabled) {
      logger.warn('Backup job is disabled in settings');
      logger.separator();
      return;
    }

    // Parse backup time (HH:MM format)
    const [hours, minutes] = backupTime.split(':').map(Number);

    if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      logger.error('Invalid backup time format', { backupTime });
      logger.separator();
      return;
    }

    // Generate cron expression based on frequency
    let cronExpression;

    switch (backupFrequency) {
      case 'daily':
        // Every day at specified time
        cronExpression = `${minutes} ${hours} * * *`;
        break;

      case 'weekly':
        // Every Sunday at specified time
        cronExpression = `${minutes} ${hours} * * 0`;
        break;

      case 'monthly':
        // 1st day of every month at specified time
        cronExpression = `${minutes} ${hours} 1 * *`;
        break;

      default:
        logger.error('Invalid backup frequency', { backupFrequency });
        logger.separator();
        return;
    }

    logger.info('Backup job configuration loaded', {
      enabled: backupEnabled,
      frequency: backupFrequency,
      time: backupTime,
      cronExpression
    });

    // Stop existing job if running
    if (backupJob) {
      backupJob.stop();
      logger.info('Stopped existing backup job');
    }

    // Create and start new job
    backupJob = cron.schedule(cronExpression, async () => {
      await runBackupJob();
    }, {
      timezone: 'Asia/Kolkata' // IST timezone
    });

    currentSchedule = cronExpression;

    logger.success('✅ Backup job started successfully', {
      schedule: cronExpression,
      frequency: backupFrequency,
      time: backupTime,
      timezone: 'Asia/Kolkata'
    });
    logger.separator();

    // Log next execution time
    const nextExecution = getNextExecutionTime(cronExpression);
    logger.info('Next backup scheduled for', { nextExecution });

  } catch (error) {
    logger.error('Failed to start backup job', error);
    logger.separator();
  }
};

// ============================================
// STOP BACKUP JOB
// ============================================
const stopBackupJob = () => {
  try {
    if (backupJob) {
      backupJob.stop();
      logger.info('Backup job stopped');
      backupJob = null;
      currentSchedule = null;
    } else {
      logger.warn('No backup job running to stop');
    }
  } catch (error) {
    logger.error('Failed to stop backup job', error);
  }
};

// ============================================
// RUN BACKUP JOB (MAIN EXECUTION)
// ============================================
const runBackupJob = async () => {
  const startTime = Date.now();

  try {
    logger.separator('AUTOMATIC BACKUP JOB');
    logger.info('Backup job triggered', {
      schedule: currentSchedule,
      time: new Date().toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
    });

    // Log job execution
    await logJobExecution('backup_job', 'STARTED');

    // ============================================
    // CHECK IF BACKUP IS ENABLED
    // ============================================
    logger.try('Checking backup settings');
    const settings = await settingsService.getByCategory('backup');

    const backupEnabled = settings.backup_enabled === 'true' || settings.backup_enabled === true;

    if (!backupEnabled) {
      logger.warn('Backup is disabled in settings - skipping execution');
      await logJobExecution('backup_job', 'SKIPPED', 'Backup is disabled');
      logger.separator();
      return;
    }

    logger.success('Backup is enabled - proceeding with backup');

    // ============================================
    // CREATE BACKUP
    // ============================================
    const result = await backupService.createBackup('AUTOMATIC', null);

    if (!result.success) {
      throw new Error(result.message);
    }

    const durationSeconds = Math.floor((Date.now() - startTime) / 1000);

    logger.success('✅ Automatic backup completed successfully', {
      backupId: result.data.backupId,
      backupName: result.data.backupName,
      totalSizeMB: result.data.totalSizeMB,
      durationSeconds
    });

    // Log successful execution
    await logJobExecution('backup_job', 'COMPLETED', null, durationSeconds);

    // ============================================
    // SEND SUCCESS EMAIL TO ADMINS
    // ============================================
    await sendBackupNotificationEmail(result.data, 'success');

    logger.separator();

  } catch (error) {
    const durationSeconds = Math.floor((Date.now() - startTime) / 1000);

    logger.error('Automatic backup failed', error);

    // Log failed execution
    await logJobExecution('backup_job', 'FAILED', error.message, durationSeconds);

    // Send failure email to admins
    await sendBackupNotificationEmail(null, 'failure', error.message);

    logger.separator();
  }
};

// ============================================
// RESTART BACKUP JOB
// (Called when settings are updated)
// ============================================
const restartBackupJob = async () => {
  try {
    logger.try('Restarting backup job with updated settings');
    stopBackupJob();
    await startBackupJob();
    logger.success('Backup job restarted successfully');
  } catch (error) {
    logger.error('Failed to restart backup job', error);
  }
};

// ============================================
// GET NEXT EXECUTION TIME
// ============================================
const getNextExecutionTime = (cronExpression) => {
  try {
    const cronParser = require('cron-parser');
    const interval = cronParser.parseExpression(cronExpression, {
      tz: 'Asia/Kolkata'
    });
    const next = interval.next().toDate();

    return next.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (error) {
    logger.error('Failed to calculate next execution time', error);
    return 'Unknown';
  }
};

// ============================================
// LOG JOB EXECUTION
// ============================================
const logJobExecution = async (jobName, status, errorMessage = null, durationSeconds = null) => {
  try {
    const query = `
      INSERT INTO job_executions (
        job_name,
        status,
        error_message,
        duration_seconds,
        executed_at
      )
      VALUES (
        @jobName,
        @status,
        @errorMessage,
        @durationSeconds,
        GETDATE()
      )
    `;

    await executeQuery(query, {
      jobName,
      status,
      errorMessage,
      durationSeconds
    });

    logger.info('Job execution logged', { jobName, status });

  } catch (error) {
    logger.error('Failed to log job execution', error);
    // Don't throw - logging failure shouldn't stop the job
  }
};

// ============================================
// SEND BACKUP NOTIFICATION EMAIL TO ADMINS
// ============================================
const sendBackupNotificationEmail = async (backupData, type, errorMessage = null) => {
  try {
    // Check if email notifications are enabled
    const emailSettings = await settingsService.getByCategory('email');
    const notificationSettings = await settingsService.getByCategory('notification');

    const emailEnabled = emailSettings.smtp_enabled === 'true' || emailSettings.smtp_enabled === true;
    const notifyBackup = notificationSettings.notify_on_backup === 'true' || notificationSettings.notify_on_backup === true;

    if (!emailEnabled || !notifyBackup) {
      logger.info('Email notifications disabled - skipping backup notification');
      return;
    }

    // Get all admin users
    const adminQuery = `
      SELECT 
        u.user_id,
        u.email,
        u.first_name,
        u.last_name
      FROM users u
      INNER JOIN user_roles r ON u.role_id = r.role_id
      WHERE r.can_manage_system = 1
        AND u.is_active = 1
        AND u.email IS NOT NULL
        AND u.email != ''
    `;

    const adminResult = await executeQuery(adminQuery);
    const admins = adminResult.recordset;

    if (admins.length === 0) {
      logger.warn('No admin users found to send backup notification');
      return;
    }

    logger.info(`Sending backup notification to ${admins.length} admin(s)`);

    // Send email to each admin
    for (const admin of admins) {
      try {
        if (type === 'success') {
          await emailQueueService.sendTemplatedEmail(
            'backup_success',
            admin.email,
            {
              user_name: `${admin.first_name} ${admin.last_name}`,
              backup_name: backupData.backupName,
              backup_size_mb: backupData.totalSizeMB.toFixed(2),
              duration_seconds: backupData.durationSeconds,
              files_count: backupData.filesCount,
              backup_date: new Date().toLocaleString('en-IN', {
                timeZone: 'Asia/Kolkata',
                day: '2-digit',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
              })
            },
            {
              recipientName: `${admin.first_name} ${admin.last_name}`,
              recipientUserId: admin.user_id,
              priority: 3,
              emailType: 'backup_success'
            }
          );
        } else {
          // Failure notification
          await emailQueueService.sendTemplatedEmail(
            'backup_failure',
            admin.email,
            {
              user_name: `${admin.first_name} ${admin.last_name}`,
              error_message: errorMessage || 'Unknown error occurred',
              backup_date: new Date().toLocaleString('en-IN', {
                timeZone: 'Asia/Kolkata',
                day: '2-digit',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
              })
            },
            {
              recipientName: `${admin.first_name} ${admin.last_name}`,
              recipientUserId: admin.user_id,
              priority: 1, // High priority for failures
              emailType: 'backup_failure'
            }
          );
        }

        logger.info('Backup notification email queued', {
          adminId: admin.user_id,
          email: admin.email,
          type
        });

      } catch (emailError) {
        logger.error('Failed to queue backup notification email', {
          adminId: admin.user_id,
          error: emailError.message
        });
        // Continue with other admins
      }
    }

    logger.success(`Backup notification emails queued for ${admins.length} admin(s)`);

  } catch (error) {
    logger.error('Failed to send backup notification emails', error);
    // Don't throw - email failure shouldn't stop the backup
  }
};

// ============================================
// GET JOB STATUS
// ============================================
const getJobStatus = () => {
  return {
    isRunning: backupJob !== null,
    currentSchedule,
    nextExecution: currentSchedule ? getNextExecutionTime(currentSchedule) : null
  };
};

// ============================================
// EXPORT JOB FUNCTIONS
// ============================================
module.exports = {
  startBackupJob,
  stopBackupJob,
  restartBackupJob,
  runBackupJob,
  getJobStatus
};
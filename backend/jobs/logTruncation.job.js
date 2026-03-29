// ============================================
// LOG TRUNCATION BACKGROUND JOB
// Periodically cleans old logs (audit, job_executions, bot history)
// Keeps DB lean for production performance
// Developer: Suvadip Panja
// Date: March 2026
// ============================================

const cron = require('node-cron');
const { executeProcedure, executeQuery } = require('../config/database');
const logger = require('../utils/logger');
const dateUtils = require('../utils/dateUtils');

let truncationJob = null;
const DEFAULT_SCHEDULE = '0 3 * * 0'; // Weekly: Sunday 3:00 AM

// ============================================
// Runtime state — tracks running + last run
// ============================================
let _isRunning = false;
let _isActive = false;
let _lastExecution = null; // { status, startedAt, durationMs, recordsProcessed, recordsFailed }

/**
 * Run log truncation (calls sp_TruncateOldLogs)
 * @param {boolean} dryRun - If true, only report counts without deleting
 */
const runTruncation = async (dryRun = false) => {
  if (_isRunning) {
    logger.warn('Log truncation already running, skipping this cycle');
    return { success: false, message: 'Already running' };
  }

  _isRunning = true;
  const startTime = Date.now();
  const startedAt = new Date().toISOString();

  try {
    logger.info('Log truncation job started', { dryRun });

    // Check if procedure exists
    const checkProc = await executeQuery(
      `SELECT 1 FROM sys.procedures WHERE name = 'sp_TruncateOldLogs'`
    );
    if (!checkProc.recordset?.length) {
      const msg = 'sp_TruncateOldLogs not found. Run PRODUCTION_Log_Truncation.sql migration first.';
      logger.warn(msg);
      _lastExecution = {
        status: 'failed',
        startedAt,
        durationMs: Date.now() - startTime,
        recordsProcessed: 0,
        recordsFailed: 0,
        error: msg,
      };
      return { success: false, message: 'Procedure not installed' };
    }

    const result = await executeProcedure('sp_TruncateOldLogs', {
      input: { dryRun: dryRun ? 1 : 0 }
    });

    const summary = result.recordset?.[0] || {};
    const durationMs = Date.now() - startTime;
    const durationSeconds = Math.floor(durationMs / 1000);

    const recordsProcessed =
      (summary.audit_logs_to_delete || 0) +
      (summary.job_executions_to_delete || 0) +
      (summary.bot_history_to_delete || 0) +
      (summary.bot_messages_to_delete || 0);

    logger.info('Log truncation completed', { ...summary, durationSeconds, dryRun });

    if (!dryRun && recordsProcessed > 0) {
      logger.success('Old logs truncated', summary);
    }

    _lastExecution = {
      status: 'success',
      startedAt,
      durationMs,
      recordsProcessed,
      recordsFailed: 0,
      summary,
      dryRun,
    };

    return { success: true, summary, durationSeconds };
  } catch (error) {
    logger.error('Log truncation job failed', error);
    _lastExecution = {
      status: 'failed',
      startedAt,
      durationMs: Date.now() - startTime,
      recordsProcessed: 0,
      recordsFailed: 1,
      error: error.message,
    };
    return { success: false, error: error.message };
  } finally {
    _isRunning = false;
  }
};

/**
 * Start the log truncation job (weekly by default)
 */
const startLogTruncationJob = () => {
  try {
    if (truncationJob) {
      truncationJob.stop();
    }

    truncationJob = cron.schedule(DEFAULT_SCHEDULE, async () => {
      await runTruncation(false);
    }, {
      timezone: dateUtils.getCachedTimezone?.() || 'UTC'
    });

    _isActive = true;
    logger.success('Log truncation job scheduled (Weekly, Sunday 3:00 AM)');
    return true;
  } catch (error) {
    logger.error('Failed to start log truncation job', error);
    return false;
  }
};

/**
 * Stop the log truncation job
 */
const stopLogTruncationJob = () => {
  if (truncationJob) {
    truncationJob.stop();
    truncationJob = null;
    _isActive = false;
    logger.info('Log truncation job stopped');
  }
};

/**
 * Get current job status (for Job Monitor UI)
 */
const getStatus = () => {
  return {
    isRunning: _isRunning,
    isActive: _isActive,
    isEnabled: _isActive,
    schedule: DEFAULT_SCHEDULE,
    scheduleLabel: 'Weekly (Sun 3:00 AM)',
    lastExecution: _lastExecution,
  };
};

module.exports = {
  startLogTruncationJob,
  stopLogTruncationJob,
  runTruncation,
  getStatus,
  // Expose for direct stop/start from controller
  get isRunning() { return _isRunning; },
  get isActive() { return _isActive; },
  start: startLogTruncationJob,
  stop: stopLogTruncationJob,
};

// ============================================
// JOBS MONITOR CONTROLLER
// Exposes real-time status of all background jobs
// and allows authorised admins to trigger manual runs and toggle start/stop
// Developer: Suvadip Panja
// Updated: March 2026 — added toggleJob, lastExecution, real-time data
// FILE: backend/controllers/jobs.controller.js
// ============================================

const logger = require('../utils/logger');

// ============================================
// IMPORT ALL JOB SINGLETONS
// ============================================
const emailProcessorJob = require('../jobs/emailProcessor.job');
const autoEscalationJob = require('../jobs/autoEscalation.job');
const autoCloseJob = require('../jobs/autoClose.job');
const slaBreachJob = require('../jobs/slaBreach.job');
const passwordExpiryJob = require('../jobs/passwordExpiry.job');
const sessionCleanupJob = require('../jobs/sessionCleanup.job');
const autoUnlockJob = require('../jobs/autoUnlock.job');
const backupJob = require('../jobs/backup.job');
const logTruncationJob = require('../jobs/logTruncation.job');

// ============================================
// JOB REGISTRY
// Maps a stable slug → { label, job, runNow, start, stop }
// ============================================
const JOB_REGISTRY = [
    {
        name: 'email-processor',
        label: 'Email Processor',
        description: 'Processes the outbound email queue',
        schedule: '*/5 * * * *',
        scheduleLabel: 'Every 5 minutes',
        icon: '📧',
        job: emailProcessorJob,
        getStatus: () => emailProcessorJob.getStatus(),
        runNow: () => emailProcessorJob.processEmails(),
        start: () => emailProcessorJob.start(),
        stop: () => emailProcessorJob.stop(),
    },
    {
        name: 'auto-escalation',
        label: 'Auto Escalation',
        description: 'Escalates unresolved tickets after threshold hours',
        icon: '🚨',
        job: autoEscalationJob,
        getStatus: () => autoEscalationJob.getStatus(),
        runNow: () => autoEscalationJob.runEscalation(),
        start: (force) => typeof autoEscalationJob.start === 'function' && autoEscalationJob.start(force),
        stop: (persist) => typeof autoEscalationJob.stop === 'function' && autoEscalationJob.stop(persist),
    },
    {
        name: 'auto-close',
        label: 'Auto Close',
        description: 'Automatically closes resolved tickets after X days',
        icon: '🔒',
        job: autoCloseJob,
        getStatus: () => autoCloseJob.getStatus(),
        runNow: () => autoCloseJob.runAutoClose(),
        start: (force) => typeof autoCloseJob.start === 'function' && autoCloseJob.start(force),
        stop: (persist) => typeof autoCloseJob.stop === 'function' && autoCloseJob.stop(persist),
    },
    {
        name: 'sla-breach',
        label: 'SLA Breach Detection',
        description: 'Monitors tickets for SLA violations and sends alerts',
        icon: '⚠️',
        job: slaBreachJob,
        getStatus: () => slaBreachJob.getStatus(),
        runNow: () => slaBreachJob.checkSlaBreaches(),
        start: () => slaBreachJob.start(),
        stop: () => slaBreachJob.stop(),
    },
    {
        name: 'password-expiry',
        label: 'Password Expiry Reminders',
        description: 'Sends warnings for expiring/expired passwords',
        schedule: '0 9 * * *',
        scheduleLabel: 'Daily at 9:00 AM',
        icon: '🔐',
        job: passwordExpiryJob,
        getStatus: () => ({
            isRunning: false,
            isActive: true,
            isEnabled: true,
            schedule: '0 9 * * *',
        }),
        runNow: () => {
            if (typeof passwordExpiryJob.runNow === 'function') {
                return passwordExpiryJob.runNow();
            }
        },
        start: null, // no explicit start/stop API for this job
        stop: null,
    },
    {
        name: 'session-cleanup',
        label: 'Session Cleanup',
        description: 'Purges expired and inactive user sessions',
        schedule: '0 * * * *',
        scheduleLabel: 'Every hour',
        icon: '🧹',
        job: sessionCleanupJob,
        getStatus: () => typeof sessionCleanupJob.getStatus === 'function'
            ? sessionCleanupJob.getStatus()
            : ({
                isRunning: sessionCleanupJob.isRunning ?? false,
                isActive: false,
                isEnabled: false,
                schedule: '0 * * * *',
            }),
        runNow: () => sessionCleanupJob.executeNow(),
        start: () => typeof sessionCleanupJob.start === 'function' && sessionCleanupJob.start(),
        stop: () => typeof sessionCleanupJob.stop === 'function' && sessionCleanupJob.stop(),
    },
    {
        name: 'auto-unlock',
        label: 'Auto Unlock Accounts',
        description: 'Automatically unlocks temporarily locked user accounts',
        icon: '🔓',
        job: autoUnlockJob,
        getStatus: () => {
            if (typeof autoUnlockJob.getStatus === 'function') return autoUnlockJob.getStatus();
            return { isRunning: autoUnlockJob.isRunning ?? false, isActive: false, isEnabled: false };
        },
        runNow: () => autoUnlockJob.executeNow(),
        start: () => typeof autoUnlockJob.start === 'function' && autoUnlockJob.start(),
        stop: () => typeof autoUnlockJob.stop === 'function' && autoUnlockJob.stop(),
    },
    {
        name: 'backup',
        label: 'Database Backup',
        description: 'Scheduled automatic database backup',
        icon: '💾',
        job: backupJob,
        getStatus: () => {
            const s = backupJob.getJobStatus();
            return {
                isRunning: s.isRunning,
                isActive: s.isRunning,
                isEnabled: true,
                schedule: s.currentSchedule,
                nextExecution: s.nextExecution,
            };
        },
        runNow: () => backupJob.runBackupJob(),
        start: null,
        stop: null,
    },
    {
        name: 'log-truncation',
        label: 'Log Truncation',
        description: 'Weekly purge of old audit and job logs',
        icon: '🗑️',
        job: logTruncationJob,
        getStatus: () => logTruncationJob.getStatus(),
        runNow: () => logTruncationJob.runTruncation(false),
        start: () => logTruncationJob.startLogTruncationJob(),
        stop: () => logTruncationJob.stopLogTruncationJob(),
    },
];

// ============================================
// GET ALL JOB STATUSES
// GET /api/v1/jobs
// ============================================
const getAllJobStatuses = async (req, res) => {
    try {
        logger.info('📊 Job Monitor: fetching all job statuses');

        const results = await Promise.all(
            JOB_REGISTRY.map(async (entry) => {
                try {
                    const status = await entry.getStatus();
                    return {
                        name: entry.name,
                        label: entry.label,
                        description: entry.description,
                        icon: entry.icon,
                        schedule: status.schedule || entry.schedule || entry.job?.cronExpression || 'N/A',
                        scheduleLabel: status.scheduleLabel || entry.scheduleLabel || null,
                        nextExecution: status.nextExecution || null,
                        isRunning: status.isRunning ?? false,
                        isActive: status.isActive ?? false,
                        isEnabled: status.isEnabled ?? true,
                        canToggle: !!(entry.start && entry.stop),
                        lastExecution: status.lastExecution || null,
                        error: status.error || null,
                    };
                } catch (err) {
                    logger.error(`Failed to get status for job: ${entry.name}`, err);
                    return {
                        name: entry.name,
                        label: entry.label,
                        description: entry.description,
                        icon: entry.icon,
                        schedule: entry.schedule || entry.job?.cronExpression || 'N/A',
                        scheduleLabel: entry.scheduleLabel || null,
                        nextExecution: null,
                        isRunning: false,
                        isActive: false,
                        isEnabled: false,
                        canToggle: !!(entry.start || entry.stop),
                        lastExecution: null,
                        error: err.message,
                    };
                }
            })
        );

        return res.json({
            success: true,
            data: results,
            fetchedAt: new Date().toISOString(),
        });
    } catch (error) {
        logger.error('Job Monitor: failed to fetch job statuses', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch job statuses',
            error: error.message,
        });
    }
};

// ============================================
// TRIGGER A JOB MANUALLY
// POST /api/v1/jobs/:name/run
// ============================================
const triggerJob = async (req, res) => {
    const { name } = req.params;
    const entry = JOB_REGISTRY.find((j) => j.name === name);

    if (!entry) {
        return res.status(404).json({ success: false, message: `Job "${name}" not found` });
    }

    try {
        logger.info(`🚀 Job Monitor: manually triggering job "${entry.label}" by user ${req.user?.username || 'unknown'}`);

        if (entry.job?.isRunning || entry.job?._isRunning) {
            return res.status(409).json({
                success: false,
                message: `Job "${entry.label}" is already running`,
            });
        }

        if (typeof entry.runNow !== 'function') {
            return res.status(400).json({
                success: false,
                message: `Job "${entry.label}" does not support manual triggering`,
            });
        }

        // Fire and forget — do NOT await so the HTTP response is instant
        entry.runNow().catch((err) => {
            logger.error(`Manual trigger of "${entry.label}" failed`, err);
        });

        return res.json({
            success: true,
            message: `Job "${entry.label}" triggered successfully`,
            triggeredAt: new Date().toISOString(),
        });
    } catch (error) {
        logger.error(`Job Monitor: failed to trigger job "${name}"`, error);
        return res.status(500).json({
            success: false,
            message: `Failed to trigger job "${entry.label}"`,
            error: error.message,
        });
    }
};

// ============================================
// TOGGLE JOB (START / STOP)
// PATCH /api/v1/jobs/:name/toggle
// Body: { action: 'start' | 'stop' }
// ============================================
const toggleJob = async (req, res) => {
    const { name } = req.params;
    const { action } = req.body; // 'start' or 'stop'

    if (!['start', 'stop'].includes(action)) {
        return res.status(400).json({
            success: false,
            message: 'action must be "start" or "stop"',
        });
    }

    const entry = JOB_REGISTRY.find((j) => j.name === name);

    if (!entry) {
        return res.status(404).json({ success: false, message: `Job "${name}" not found` });
    }

    if (action === 'start' && typeof entry.start !== 'function') {
        return res.status(400).json({
            success: false,
            message: `Job "${entry.label}" does not support start/stop control`,
        });
    }
    if (action === 'stop' && typeof entry.stop !== 'function') {
        return res.status(400).json({
            success: false,
            message: `Job "${entry.label}" does not support start/stop control`,
        });
    }

    try {
        const username = req.user?.username || 'unknown';
        logger.info(`🔄 Job Monitor: ${action === 'start' ? '▶️ Starting' : '⏹️ Stopping'} job "${entry.label}" by user ${username}`);

        if (action === 'start') {
            // Pass forceStart=true so jobs that check a settings flag still start
            await entry.start(true);
            logger.success(`✅ Job "${entry.label}" started`);
            return res.json({
                success: true,
                message: `Job "${entry.label}" started successfully`,
                action: 'start',
            });
        } else {
            // Pass updateSetting=true so the disabled state persists after restart
            await entry.stop(true);
            logger.info(`🛑 Job "${entry.label}" stopped`);
            return res.json({
                success: true,
                message: `Job "${entry.label}" stopped successfully`,
                action: 'stop',
            });
        }
    } catch (error) {
        logger.error(`Job Monitor: failed to ${action} job "${name}"`, error);
        return res.status(500).json({
            success: false,
            message: `Failed to ${action} job "${entry.label}"`,
            error: error.message,
        });
    }
};

module.exports = {
    getAllJobStatuses,
    triggerJob,
    toggleJob,
};

/**
 * ============================================
 * CR Notification Service
 * Handles email and in-app notifications for Change Requests.
 * Uses existing emailQueue.service (sendTemplatedEmail) and
 * notifications table for in-app alerts.
 * ============================================
 */

const { executeQuery } = require('../config/database');
const emailQueueService = require('./emailQueue.service');
const logger = require('../utils/logger');
const { getPublicAppUrl } = require('../utils/publicUrl');

/**
 * Build the public-facing URL for a CR detail page.
 */
function buildCRUrl(crId) {
  const base = getPublicAppUrl();
  return `${base}/cr/${crId}`;
}

/**
 * Create an in-app notification for a user.
 */
async function createInAppNotification(userId, type, title, message) {
  try {
    await executeQuery(
      `INSERT INTO notifications (user_id, notification_type, title, message, related_ticket_id)
       VALUES (@userId, @type, @title, @message, NULL)`,
      { userId, type, title, message }
    );
  } catch (err) {
    logger.error('CR in-app notification insert failed', err);
  }
}

/**
 * Send a templated CR email (queues it for the email processor job).
 * Silently skips if the template is not found.
 */
async function sendCREmail(templateKey, recipientEmail, variables, options = {}) {
  try {
    await emailQueueService.sendTemplatedEmail(templateKey, recipientEmail, variables, {
      relatedEntityType: 'change_request',
      ...options,
    });
  } catch (err) {
    logger.error(`CR email send failed (${templateKey})`, err);
  }
}

// ────────────────────────────────────────────
// PUBLIC API — one function per event
// ────────────────────────────────────────────

/**
 * Notify requester that their CR was created.
 */
async function notifyCRCreated(cr, requesterEmail, requesterName) {
  const crUrl = buildCRUrl(cr.cr_id);
  await sendCREmail('CR_CREATED', requesterEmail, {
    user_name: requesterName,
    cr_number: cr.cr_number,
    title: cr.title,
    type_name: cr.type_name || '',
    risk_level: cr.risk_level || 'MEDIUM',
    requester_name: requesterName,
    cr_url: crUrl,
  }, {
    recipientName: requesterName,
    relatedEntityId: cr.cr_id,
    emailType: 'CR_CREATED',
  });

  await createInAppNotification(
    cr.requester_id,
    'CR_CREATED',
    'Change Request Created',
    `Your change request ${cr.cr_number} has been created.`
  );
}

/**
 * Notify requester that CR was submitted for review.
 */
async function notifyCRSubmitted(cr, requesterEmail, requesterName) {
  const crUrl = buildCRUrl(cr.cr_id);
  await sendCREmail('CR_SUBMITTED', requesterEmail, {
    user_name: requesterName,
    cr_number: cr.cr_number,
    title: cr.title,
    type_name: cr.type_name || '',
    risk_level: cr.risk_level || 'MEDIUM',
    cr_url: crUrl,
  }, {
    recipientName: requesterName,
    relatedEntityId: cr.cr_id,
    emailType: 'CR_SUBMITTED',
  });

  await createInAppNotification(
    cr.requester_id,
    'CR_SUBMITTED',
    'CR Submitted for Review',
    `${cr.cr_number} has been submitted for review.`
  );
}

/**
 * Notify an approver that their approval is required.
 */
async function notifyApprovalRequest(cr, approverEmail, approverName, approverId, approverRole) {
  const crUrl = buildCRUrl(cr.cr_id);
  await sendCREmail('CR_APPROVAL_REQUEST', approverEmail, {
    user_name: approverName,
    cr_number: cr.cr_number,
    title: cr.title,
    type_name: cr.type_name || '',
    risk_level: cr.risk_level || 'MEDIUM',
    requester_name: cr.requester_name || '',
    approver_role: approverRole,
    cr_url: crUrl,
  }, {
    recipientName: approverName,
    recipientUserId: approverId,
    relatedEntityId: cr.cr_id,
    emailType: 'CR_APPROVAL_REQUEST',
    priority: 1,
  });

  await createInAppNotification(
    approverId,
    'CR_APPROVAL_REQUEST',
    'Approval Required',
    `Your approval is needed for ${cr.cr_number}.`
  );
}

/**
 * Notify requester that all approvals are complete.
 */
async function notifyCRApproved(cr, requesterEmail, requesterName) {
  const crUrl = buildCRUrl(cr.cr_id);
  await sendCREmail('CR_APPROVED', requesterEmail, {
    user_name: requesterName,
    cr_number: cr.cr_number,
    title: cr.title,
    cr_url: crUrl,
  }, {
    recipientName: requesterName,
    relatedEntityId: cr.cr_id,
    emailType: 'CR_APPROVED',
  });

  await createInAppNotification(
    cr.requester_id,
    'CR_APPROVED',
    'CR Approved',
    `${cr.cr_number} has been fully approved.`
  );
}

/**
 * Notify requester that CR was rejected.
 */
async function notifyCRRejected(cr, requesterEmail, requesterName, rejectorName, reason) {
  const crUrl = buildCRUrl(cr.cr_id);
  await sendCREmail('CR_REJECTED', requesterEmail, {
    user_name: requesterName,
    cr_number: cr.cr_number,
    rejector_name: rejectorName,
    reject_reason: reason || 'No reason provided',
    cr_url: crUrl,
  }, {
    recipientName: requesterName,
    relatedEntityId: cr.cr_id,
    emailType: 'CR_REJECTED',
    priority: 1,
  });

  await createInAppNotification(
    cr.requester_id,
    'CR_REJECTED',
    'CR Rejected',
    `${cr.cr_number} has been rejected by ${rejectorName}.`
  );
}

/**
 * Notify relevant parties that CR is scheduled.
 */
async function notifyCRScheduled(cr, recipientEmail, recipientName, recipientId) {
  const crUrl = buildCRUrl(cr.cr_id);
  await sendCREmail('CR_SCHEDULED', recipientEmail, {
    user_name: recipientName,
    cr_number: cr.cr_number,
    title: cr.title,
    scheduled_start: cr.scheduled_start || '',
    scheduled_end: cr.scheduled_end || '',
    estimated_downtime_mins: cr.estimated_downtime_mins || 0,
    cr_url: crUrl,
  }, {
    recipientName,
    recipientUserId: recipientId,
    relatedEntityId: cr.cr_id,
    emailType: 'CR_SCHEDULED',
  });

  await createInAppNotification(
    recipientId,
    'CR_SCHEDULED',
    'CR Scheduled',
    `${cr.cr_number} scheduled: ${cr.scheduled_start || 'TBD'}.`
  );
}

/**
 * Notify that implementation has started.
 */
async function notifyCRImplementationStarted(cr, recipientEmail, recipientName, recipientId, implementerName) {
  const crUrl = buildCRUrl(cr.cr_id);
  await sendCREmail('CR_IMPLEMENTATION_START', recipientEmail, {
    user_name: recipientName,
    cr_number: cr.cr_number,
    title: cr.title,
    implementer_name: implementerName,
    cr_url: crUrl,
  }, {
    recipientName,
    recipientUserId: recipientId,
    relatedEntityId: cr.cr_id,
    emailType: 'CR_IMPLEMENTATION_START',
  });

  await createInAppNotification(
    recipientId,
    'CR_IMPLEMENTATION_START',
    'CR Implementation Started',
    `${cr.cr_number} implementation has started.`
  );
}

/**
 * Notify that CR was completed.
 */
async function notifyCRCompleted(cr, recipientEmail, recipientName, recipientId) {
  const crUrl = buildCRUrl(cr.cr_id);
  await sendCREmail('CR_COMPLETED', recipientEmail, {
    user_name: recipientName,
    cr_number: cr.cr_number,
    title: cr.title,
    cr_url: crUrl,
  }, {
    recipientName,
    recipientUserId: recipientId,
    relatedEntityId: cr.cr_id,
    emailType: 'CR_COMPLETED',
  });

  await createInAppNotification(
    recipientId,
    'CR_COMPLETED',
    'CR Completed',
    `${cr.cr_number} has been completed successfully.`
  );
}

/**
 * Notify that CR was cancelled.
 */
async function notifyCRCancelled(cr, recipientEmail, recipientName, recipientId, cancelledByName, cancelReason) {
  const crUrl = buildCRUrl(cr.cr_id);
  await sendCREmail('CR_CANCELLED', recipientEmail, {
    user_name: recipientName,
    cr_number: cr.cr_number,
    cancelled_by_name: cancelledByName,
    cancel_reason: cancelReason || 'No reason provided',
    cr_url: crUrl,
  }, {
    recipientName,
    recipientUserId: recipientId,
    relatedEntityId: cr.cr_id,
    emailType: 'CR_CANCELLED',
  });

  await createInAppNotification(
    recipientId,
    'CR_CANCELLED',
    'CR Cancelled',
    `${cr.cr_number} has been cancelled.`
  );
}

/**
 * Notify that CR was rolled back.
 */
async function notifyCRRolledBack(cr, recipientEmail, recipientName, recipientId) {
  const crUrl = buildCRUrl(cr.cr_id);
  await sendCREmail('CR_ROLLED_BACK', recipientEmail, {
    user_name: recipientName,
    cr_number: cr.cr_number,
    title: cr.title,
    cr_url: crUrl,
  }, {
    recipientName,
    recipientUserId: recipientId,
    relatedEntityId: cr.cr_id,
    emailType: 'CR_ROLLED_BACK',
    priority: 1,
  });

  await createInAppNotification(
    recipientId,
    'CR_ROLLED_BACK',
    'CR Rolled Back',
    `${cr.cr_number} has been rolled back.`
  );
}

/**
 * Send approval reminder email to an approver.
 */
async function sendApprovalReminder(cr, approverEmail, approverName, approverId, requestedAt, reminderCount) {
  const crUrl = buildCRUrl(cr.cr_id);
  await sendCREmail('CR_APPROVAL_REMINDER', approverEmail, {
    user_name: approverName,
    cr_number: cr.cr_number,
    title: cr.title,
    requested_at: requestedAt,
    reminder_count: reminderCount,
    cr_url: crUrl,
  }, {
    recipientName: approverName,
    recipientUserId: approverId,
    relatedEntityId: cr.cr_id,
    emailType: 'CR_APPROVAL_REMINDER',
    priority: 2,
  });

  await createInAppNotification(
    approverId,
    'CR_APPROVAL_REMINDER',
    'Approval Reminder',
    `Reminder: ${cr.cr_number} is still awaiting your approval.`
  );
}

/**
 * Send schedule reminder (24h before scheduled start).
 */
async function sendScheduleReminder(cr, recipientEmail, recipientName, recipientId, hoursUntil) {
  const crUrl = buildCRUrl(cr.cr_id);
  await sendCREmail('CR_SCHEDULE_REMINDER', recipientEmail, {
    user_name: recipientName,
    cr_number: cr.cr_number,
    title: cr.title,
    scheduled_start: cr.scheduled_start || '',
    scheduled_end: cr.scheduled_end || '',
    hours_until: hoursUntil,
    cr_url: crUrl,
  }, {
    recipientName,
    recipientUserId: recipientId,
    relatedEntityId: cr.cr_id,
    emailType: 'CR_SCHEDULE_REMINDER',
    priority: 2,
  });

  await createInAppNotification(
    recipientId,
    'CR_SCHEDULE_REMINDER',
    'Upcoming CR',
    `${cr.cr_number} starts in ${hoursUntil} hours.`
  );
}

module.exports = {
  notifyCRCreated,
  notifyCRSubmitted,
  notifyApprovalRequest,
  notifyCRApproved,
  notifyCRRejected,
  notifyCRScheduled,
  notifyCRImplementationStarted,
  notifyCRCompleted,
  notifyCRCancelled,
  notifyCRRolledBack,
  sendApprovalReminder,
  sendScheduleReminder,
};

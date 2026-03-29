/**
 * Shared ticket approval decision pipeline (in-app + email link).
 */

const { executeQuery } = require('../config/database');
const logger = require('../utils/logger');
const settingsService = require('./settings.service');
const emailQueueService = require('./emailQueue.service');
const { getPublicAppUrl } = require('../utils/publicUrl');
const waNotify = require('./whatsappNotificationService'); // 📱 WhatsApp Notifications

/**
 * Apply APPROVED / REJECTED to a pending approval (notifications, SLA, emails).
 * @param {object} opts
 * @param {number} opts.approvalId
 * @param {'APPROVED'|'REJECTED'} opts.decision
 * @param {string} opts.decisionNote
 * @param {number} opts.actingUserId — user_id stored on ticket_activities.performed_by (approver or admin)
 * @returns {Promise<{ success: true, message: string, data: object }>}
 */
async function processApprovalDecision({ approvalId, decision, decisionNote, actingUserId }) {
  const cleanNote = String(decisionNote || '').trim();
  if (!cleanNote) {
    return { success: false, statusCode: 400, message: 'A decision note is required.' };
  }

  const approvalResult = await executeQuery(
    `
      SELECT
        ta.approval_id, ta.ticket_id, ta.approver_id, ta.requested_by,
        ta.approval_note, ta.status, ta.is_active,
        u_eng.first_name + ' ' + u_eng.last_name AS engineer_name,
        u_eng.email AS engineer_email,
        u_apr.first_name + ' ' + u_apr.last_name AS approver_name
      FROM ticket_approvals ta
      LEFT JOIN users u_eng ON ta.requested_by = u_eng.user_id
      LEFT JOIN users u_apr ON ta.approver_id = u_apr.user_id
      WHERE ta.approval_id = @approvalId
    `,
    { approvalId }
  );

  if (!approvalResult.recordset.length) {
    return { success: false, statusCode: 404, message: 'Approval request not found.' };
  }

  const approval = approvalResult.recordset[0];

  if (!approval.is_active || approval.status !== 'PENDING') {
    return { success: false, statusCode: 400, message: 'This approval request is no longer pending.' };
  }

  const ticketId = approval.ticket_id;

  const ticketResult = await executeQuery(
    `
      SELECT
        t.ticket_id, t.ticket_number, t.subject, t.requester_id,
        t.sla_paused, t.sla_paused_at, t.sla_pause_reason, t.due_date,
        u_req.first_name + ' ' + u_req.last_name AS requester_name,
        u_req.email AS requester_email
      FROM tickets t
      LEFT JOIN users u_req ON t.requester_id = u_req.user_id
      WHERE t.ticket_id = @ticketId
    `,
    { ticketId }
  );

  if (!ticketResult.recordset.length) {
    return { success: false, statusCode: 404, message: 'Ticket not found.' };
  }
  const ticket = ticketResult.recordset[0];

  await executeQuery(
    `
      UPDATE ticket_approvals SET
        status = @decision,
        decision_note = @cleanNote,
        decided_at = GETDATE(),
        is_active = 0
      WHERE approval_id = @approvalId
    `,
    { decision, cleanNote, approvalId }
  );

  const targetStatusCode = 'IN_PROGRESS';
  const statusResult = await executeQuery(`SELECT status_id FROM ticket_statuses WHERE status_code = @code`, {
    code: targetStatusCode,
  });
  const targetStatusId = statusResult.recordset?.[0]?.status_id;

  const pauseWasForApproval = ticket.sla_pause_reason === 'APPROVAL_PENDING';
  const ticketUpdateSetClauses = ['approval_pending = 0', 'updated_at = GETDATE()'];
  const ticketUpdateParams = { ticketId };

  if (targetStatusId) {
    ticketUpdateSetClauses.push('status_id = @targetStatusId');
    ticketUpdateParams.targetStatusId = targetStatusId;
  }

  if (ticket.sla_paused && pauseWasForApproval) {
    ticketUpdateSetClauses.push('sla_paused = 0', 'sla_paused_at = NULL', 'sla_pause_reason = NULL');
  }

  await executeQuery(`UPDATE tickets SET ${ticketUpdateSetClauses.join(', ')} WHERE ticket_id = @ticketId`, ticketUpdateParams);

  if (ticket.sla_paused && pauseWasForApproval && ticket.due_date && ticket.sla_paused_at) {
    const dueDate = new Date(ticket.due_date);
    const pausedAt = new Date(ticket.sla_paused_at);
    const now = new Date();
    const pausedMs = now - pausedAt;
    const newDueDate = new Date(dueDate.getTime() + pausedMs);
    await executeQuery(`UPDATE tickets SET due_date = @newDueDate WHERE ticket_id = @ticketId`, { newDueDate, ticketId });
  }

  const activityType = decision === 'APPROVED' ? 'APPROVAL_APPROVED' : 'APPROVAL_REJECTED';
  const decidedByName = approval.approver_name || 'Approver';
  await executeQuery(
    `
      INSERT INTO ticket_activities (
        ticket_id, activity_type, field_name, old_value, new_value, description, performed_by
      )
      VALUES (
        @ticketId, @activityType, 'approval_pending', '1', '0',
        @description, @userId
      )
    `,
    {
      ticketId,
      activityType,
      description:
        decision === 'APPROVED'
          ? `${decidedByName} approved the request. Note: ${cleanNote}. SLA resumed.`
          : `${decidedByName} rejected the request. Reason: ${cleanNote}. SLA resumed.`,
      userId: actingUserId,
    }
  );

  const appUrl = getPublicAppUrl();
  const generalSettings = await settingsService.getByCategory('general');
  const notificationSettings = await settingsService.getByCategory('notification');
  const emailEnabled =
    notificationSettings.notify_on_ticket_updated === 'true' || notificationSettings.notify_on_ticket_updated === true;
  const systemName = generalSettings.system_name || 'IT Helpdesk';
  const decidedAtStr = new Date().toLocaleString();
  const ticketUrl = `${appUrl}/tickets/${ticketId}`;

  const notifTitle = decision === 'APPROVED' ? 'Approval Granted' : 'Approval Rejected';
  const notifMsg =
    decision === 'APPROVED'
      ? `Your approval request for ticket #${ticket.ticket_number} was approved by ${decidedByName}.`
      : `Your approval request for ticket #${ticket.ticket_number} was rejected by ${decidedByName}. Reason: ${cleanNote}`;

  await executeQuery(
    `
      INSERT INTO notifications (user_id, notification_type, title, message, related_ticket_id)
      VALUES (@engineerId, @notifType, @title, @message, @ticketId)
    `,
    {
      engineerId: approval.requested_by,
      notifType: activityType,
      title: notifTitle,
      message: notifMsg,
      ticketId,
    }
  );

  const templateKey = decision === 'APPROVED' ? 'TICKET_APPROVAL_APPROVED' : 'TICKET_APPROVAL_REJECTED';

  if (emailEnabled && approval.engineer_email) {
    const engineerVars =
      decision === 'APPROVED'
        ? {
            ticket_number: ticket.ticket_number,
            subject: ticket.subject,
            recipient_name: approval.engineer_name,
            approver_name: decidedByName,
            decision_note: cleanNote,
            decided_at: decidedAtStr,
            ticket_url: ticketUrl,
            system_name: systemName,
          }
        : {
            ticket_number: ticket.ticket_number,
            subject: ticket.subject,
            engineer_name: approval.engineer_name,
            approver_name: decidedByName,
            decision_note: cleanNote,
            decided_at: decidedAtStr,
            ticket_url: ticketUrl,
            system_name: systemName,
          };
    await emailQueueService.sendTemplatedEmail(templateKey, approval.engineer_email, engineerVars, {
      recipientName: approval.engineer_name,
      recipientUserId: approval.requested_by,
      emailType: templateKey,
      relatedEntityType: 'TICKET',
      relatedEntityId: ticketId,
      priority: 2,
    });
  }

  if (decision === 'APPROVED' && ticket.requester_email && ticket.requester_email !== approval.engineer_email) {
    await executeQuery(
      `
        INSERT INTO notifications (user_id, notification_type, title, message, related_ticket_id)
        VALUES (@requesterId, 'APPROVAL_APPROVED', 'Ticket Approved',
          'The approval for ticket #' + @ticketNumber + ' has been granted.',
          @ticketId)
      `,
      { requesterId: ticket.requester_id, ticketNumber: ticket.ticket_number, ticketId }
    );

    if (emailEnabled) {
      await emailQueueService.sendTemplatedEmail(
        'TICKET_APPROVAL_APPROVED',
        ticket.requester_email,
        {
          ticket_number: ticket.ticket_number,
          subject: ticket.subject,
          recipient_name: ticket.requester_name,
          approver_name: decidedByName,
          decision_note: cleanNote,
          decided_at: decidedAtStr,
          ticket_url: ticketUrl,
          system_name: systemName,
        },
        {
          recipientName: ticket.requester_name,
          recipientUserId: ticket.requester_id,
          emailType: 'TICKET_APPROVAL_APPROVED',
          relatedEntityType: 'TICKET',
          relatedEntityId: ticketId,
          priority: 3,
        }
      );
    }
  }

  const successMsg =
    decision === 'APPROVED'
      ? 'Approval granted. Engineer and requester have been notified. SLA has been resumed.'
      : 'Approval rejected. Engineer has been notified. SLA has been resumed.';

  logger.success(`Approval ${decision}`, { approvalId, ticketId, decidedBy: actingUserId });

  // 📱 WhatsApp: notify engineer (and requester if approved) — fire-and-forget
  waNotify.notifyApprovalDecision(
    approval.requested_by,
    decision === 'APPROVED' ? ticket.requester_id : null,
    {
      ticketNumber: ticket.ticket_number,
      subject: ticket.subject,
      decision,
      decisionNote: cleanNote,
      approverName: decidedByName,
      ticketId,
    }
  ).catch(() => {});

  return {
    success: true,
    message: successMsg,
    data: {
      approval_id: parseInt(approvalId, 10),
      ticket_id: ticketId,
      decision,
    },
  };
}

module.exports = {
  processApprovalDecision,
};

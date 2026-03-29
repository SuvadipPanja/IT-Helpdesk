// ============================================
// TICKET APPROVALS CONTROLLER
// Handles the engineer-driven approval workflow:
//   1. Engineer raises approval request, selects approver, writes note
//   2. SLA is paused
//   3. Approver sees pending request, approves or rejects with note
//   4. SLA is resumed, ticket continues
//   5. Full timeline + email + notification chain
//
// Developer: Suvadip Panja
// Date: March 2026
// FILE: backend/controllers/ticketApprovals.controller.js
// ============================================

const { executeQuery } = require('../config/database');
const { createResponse } = require('../utils/helpers');
const logger = require('../utils/logger');
const settingsService = require('../services/settings.service');
const emailQueueService = require('../services/emailQueue.service');
const { getPublicAppUrl } = require('../utils/publicUrl');
const { processApprovalDecision } = require('../services/approvalWorkflow.service');
const approvalEmailToken = require('../services/approvalEmailToken.service');
const approvalApproversService = require('../services/approvalApprovers.service');
const waNotify = require('../services/whatsappNotificationService'); // 📱 WhatsApp Notifications

/** System admins (and SUB_ADMIN) may override approval decisions and see all approval rows. */
const isPlatformAdmin = (roleCode) => {
  const rc = (roleCode || '').toUpperCase();
  return rc === 'ADMIN' || rc === 'SUB_ADMIN';
};

// ============================================
// GET ELIGIBLE APPROVERS
// ADMIN: full list (managers + central mgmt + admins) for delegation / testing.
// Other roles: team managers for this ticket only — pass ?ticket_id=<id> (required).
// GET /api/v1/ticket-approvals/approvers?ticket_id=
// ============================================
const getApprovers = async (req, res, next) => {
  try {
    const roleCode = (req.user.role?.role_code || '').toUpperCase();
    const ticketId = req.query.ticket_id ? parseInt(req.query.ticket_id, 10) : null;

    if (isPlatformAdmin(roleCode)) {
      const result = await executeQuery(`
      SELECT
        u.user_id,
        u.first_name + ' ' + u.last_name AS full_name,
        u.email,
        r.role_name,
        r.role_code,
        d.department_name
      FROM users u
      INNER JOIN user_roles r ON u.role_id = r.role_id
      LEFT JOIN departments d ON u.department_id = d.department_id
      WHERE u.is_active = 1
        AND u.is_locked = 0
        AND r.role_code IN ('ADMIN', 'MANAGER', 'CENTRAL_MGMT')
      ORDER BY r.role_code, u.first_name, u.last_name
    `);

      return res.json(createResponse(true, 'Approvers retrieved', result.recordset));
    }

    if (!ticketId || Number.isNaN(ticketId)) {
      return res.status(400).json(
        createResponse(false, 'ticket_id query parameter is required to load approvers for your role.')
      );
    }

    const userId = req.user.user_id;
    const ignoreTeamMembership = roleCode === 'MANAGER' || roleCode === 'CENTRAL_MGMT';
    const ids = await approvalApproversService.getEligibleTeamManagerApproverIds(ticketId, userId, {
      ignoreTeamMembership,
    });
    const rows = await approvalApproversService.fetchApproverRowsByIds(ids);

    return res.json(
      createResponse(
        true,
        rows.length
          ? 'Team managers available for this ticket'
          : 'No team manager is configured for this ticket’s team. Ask an admin to set a team manager on the team, or route the ticket to a team.',
        rows
      )
    );
  } catch (error) {
    logger.error('getApprovers error', error);
    next(error);
  }
};

// ============================================
// GET APPROVALS (PENDING / APPROVED / REJECTED / ALL)
// Role-based:
//   - ADMIN/MANAGER/CENTRAL_MGMT: see all approvals across system
//   - Any other user: see only approvals where they are approver OR requester
// Supports ?status=PENDING|APPROVED|REJECTED|ALL
// GET /api/v1/ticket-approvals/pending
// ============================================
const getPendingApprovals = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const roleCode = req.user.role?.role_code || '';
    const isAdmin = isPlatformAdmin(roleCode);

    // Pagination / search / sort from query params
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const search = (req.query.search || '').trim();

    // Status filter: PENDING (default), APPROVED, REJECTED, ALL
    const VALID_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'ALL'];
    const rawStatus = (req.query.status || 'PENDING').toUpperCase();
    const statusFilter = VALID_STATUSES.includes(rawStatus) ? rawStatus : 'PENDING';

    // Whitelist sortable columns to prevent SQL injection
    const SORT_COLS = {
      requested_at: 'ta.requested_at',
      decided_at:   'ta.decided_at',
      ticket_number: 't.ticket_number',
      subject: 't.subject',
      engineer_name: 'u_eng.first_name',
      approver_name: 'u_apr.first_name',
      priority_name: 'tp.priority_name',
      department_name: 'd.department_name',
    };
    const sortCol = SORT_COLS[req.query.sortBy] || 'ta.requested_at';
    const sortDir = (req.query.sortOrder || '').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const params = {};
    let roleFilter = '';
    let searchFilter = '';
    let statusCondition = '';

    // Role-based row restriction
    if (!isAdmin) {
      // Regular users see only approvals where they are the approver OR the requester
      roleFilter = 'AND (ta.approver_id = @userId OR ta.requested_by = @userId)';
      params.userId = userId;
    }

    // Status condition
    if (statusFilter === 'ALL') {
      statusCondition = '';
    } else {
      statusCondition = `AND ta.status = '${statusFilter}'`;
    }
    // Only PENDING approvals enforce the is_active = 1 guard
    const isActiveGuard = statusFilter === 'PENDING' ? 'AND ta.is_active = 1' : '';

    if (search) {
      searchFilter = `AND (t.ticket_number LIKE @search OR t.subject LIKE @search OR (u_eng.first_name + ' ' + u_eng.last_name) LIKE @search)`;
      params.search = `%${search}%`;
    }

    const baseJoins = `
      FROM ticket_approvals ta
      INNER JOIN tickets t ON ta.ticket_id = t.ticket_id
      INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
      INNER JOIN ticket_priorities tp ON t.priority_id = tp.priority_id
      LEFT JOIN departments d ON t.department_id = d.department_id
      LEFT JOIN users u_req ON t.requester_id = u_req.user_id
      LEFT JOIN users u_eng ON ta.requested_by = u_eng.user_id
      LEFT JOIN users u_apr ON ta.approver_id = u_apr.user_id
    `;
    const baseWhere = `WHERE 1=1 ${statusCondition} ${isActiveGuard} ${roleFilter} ${searchFilter}`;

    // Count total matching rows
    const countResult = await executeQuery(
      `SELECT COUNT(*) AS total ${baseJoins} ${baseWhere}`,
      params
    );
    const total = countResult.recordset[0]?.total || 0;
    const totalPages = Math.ceil(total / limit) || 1;

    // Fetch paginated rows
    const dataParams = { ...params, limit, offset };
    const result = await executeQuery(`
      SELECT
        ta.approval_id,
        ta.ticket_id,
        ta.approver_id,
        ta.requested_by,
        ta.approval_note,
        ta.decision_note,
        ta.status,
        ta.requested_at,
        ta.decided_at,
        ta.is_active,
        t.ticket_number,
        t.subject,
        t.sla_paused,
        ts.status_name AS ticket_status,
        ts.color_code  AS status_color,
        tp.priority_name,
        tp.color_code  AS priority_color,
        d.department_name,
        u_req.first_name + ' ' + u_req.last_name AS requester_name,
        u_req.email AS requester_email,
        u_eng.first_name + ' ' + u_eng.last_name AS engineer_name,
        u_eng.email AS engineer_email,
        u_apr.first_name + ' ' + u_apr.last_name AS approver_name,
        u_apr.email AS approver_email
      ${baseJoins}
      ${baseWhere}
      ORDER BY ${sortCol} ${sortDir}
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `, dataParams);

    return res.json(createResponse(true, `${total} approval(s) found`, {
      approvals: result.recordset,
      total,
      totalPages,
      page,
      status: statusFilter,
    }));
  } catch (error) {
    logger.error('getPendingApprovals error', error);
    next(error);
  }
};

// ============================================
// GET APPROVALS FOR A TICKET
// GET /api/v1/ticket-approvals/ticket/:ticketId
// ============================================
const getTicketApprovals = async (req, res, next) => {
  try {
    const { ticketId } = req.params;

    const result = await executeQuery(`
      SELECT
        ta.approval_id,
        ta.ticket_id,
        ta.approval_note,
        ta.decision_note,
        ta.status,
        ta.requested_at,
        ta.decided_at,
        ta.is_active,
        u_eng.first_name + ' ' + u_eng.last_name AS engineer_name,
        u_eng.user_id AS engineer_id,
        u_apr.first_name + ' ' + u_apr.last_name AS approver_name,
        u_apr.user_id AS approver_id,
        u_apr.email AS approver_email,
        u_apr.role_id AS approver_role_id
      FROM ticket_approvals ta
      LEFT JOIN users u_eng ON ta.requested_by = u_eng.user_id
      LEFT JOIN users u_apr ON ta.approver_id = u_apr.user_id
      WHERE ta.ticket_id = @ticketId
      ORDER BY ta.requested_at DESC
    `, { ticketId });

    return res.json(createResponse(true, 'Ticket approvals retrieved', result.recordset));
  } catch (error) {
    logger.error('getTicketApprovals error', error);
    next(error);
  }
};

// ============================================
// RAISE APPROVAL REQUEST
// Engineer raises a flag → selects approver → writes note
// SLA is paused if not already paused
// POST /api/v1/ticket-approvals/:ticketId/request
// ============================================
const requestApproval = async (req, res, next) => {
  try {
    const { ticketId } = req.params;
    const { approver_id, approval_note } = req.body || {};
    const userId = req.user.user_id;
    const roleCode = req.user.role?.role_code || '';

    // Validate input
    if (!approver_id) {
      return res.status(400).json(createResponse(false, 'Please select an approver.'));
    }
    if (!approval_note || !String(approval_note).trim()) {
      return res.status(400).json(createResponse(false, 'Approval reason/note is required.'));
    }

    // Load ticket
    const ticketResult = await executeQuery(`
      SELECT
        t.ticket_id, t.ticket_number, t.subject, t.requester_id, t.assigned_to,
        t.sla_paused, t.sla_paused_at, t.sla_pause_reason, t.approval_pending, t.due_date,
        ts.is_final_status, ts.status_code AS current_status,
        tp.priority_name,
        d.department_name,
        u_req.first_name + ' ' + u_req.last_name AS requester_name,
        u_req.email AS requester_email,
        u_eng.first_name + ' ' + u_eng.last_name AS engineer_name,
        u_eng.email AS engineer_email
      FROM tickets t
      INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
      INNER JOIN ticket_priorities tp ON t.priority_id = tp.priority_id
      LEFT JOIN departments d ON t.department_id = d.department_id
      LEFT JOIN users u_req ON t.requester_id = u_req.user_id
      LEFT JOIN users u_eng ON t.assigned_to = u_eng.user_id
      WHERE t.ticket_id = @ticketId
    `, { ticketId });

    if (!ticketResult.recordset.length) {
      return res.status(404).json(createResponse(false, 'Ticket not found.'));
    }
    const ticket = ticketResult.recordset[0];

    if (ticket.is_final_status) {
      return res.status(400).json(createResponse(false, 'Cannot raise approval on a closed ticket.'));
    }

    if (ticket.approval_pending) {
      return res.status(400).json(createResponse(false, 'This ticket already has a pending approval request.'));
    }

    // Permission: assigned engineer OR admin/manager
    const isAdminOrManager = roleCode === 'ADMIN' || roleCode === 'MANAGER' || roleCode === 'CENTRAL_MGMT';
    const isAssigned = ticket.assigned_to === userId;
    if (!isAssigned && !isAdminOrManager) {
      return res.status(403).json(createResponse(false, 'Only the assigned engineer or admin can raise an approval request.'));
    }

    // Verify approver exists and is active
    const approverResult = await executeQuery(`
      SELECT
        u.user_id, u.first_name + ' ' + u.last_name AS full_name, u.email,
        r.role_code, r.role_name
      FROM users u
      INNER JOIN user_roles r ON u.role_id = r.role_id
      WHERE u.user_id = @approverId AND u.is_active = 1 AND u.is_locked = 0
    `, { approverId: approver_id });

    if (!approverResult.recordset.length) {
      return res.status(400).json(createResponse(false, 'Selected approver not found or inactive.'));
    }
    const approver = approverResult.recordset[0];

    // Enforce team-manager scope for non–platform-admin requesters
    if (!isPlatformAdmin(roleCode)) {
      const ignoreTeamMembership = roleCode === 'MANAGER' || roleCode === 'CENTRAL_MGMT';
      const allowedIds = await approvalApproversService.getEligibleTeamManagerApproverIds(
        parseInt(ticketId, 10),
        userId,
        { ignoreTeamMembership }
      );
      const aid = parseInt(approver_id, 10);
      const normalizedAllowed = allowedIds.map((x) => parseInt(x, 10));
      if (!normalizedAllowed.includes(aid)) {
        return res.status(403).json(
          createResponse(
            false,
            'You can only send approval requests to your ticket’s team manager (or configure a team manager for this team).'
          )
        );
      }
    } else {
      // ADMIN may delegate to any active staff approver role
      if (!['ADMIN', 'MANAGER', 'CENTRAL_MGMT'].includes(approver.role_code)) {
        return res.status(400).json(createResponse(false, 'Selected user cannot act as an approver.'));
      }
    }

    // Get APPROVAL_PENDING status ID
    const pendingStatusResult = await executeQuery(
      `SELECT status_id FROM ticket_statuses WHERE status_code = 'APPROVAL_PENDING'`
    );
    const approvalPendingStatusId = pendingStatusResult.recordset?.[0]?.status_id;
    if (!approvalPendingStatusId) {
      return res.status(500).json(createResponse(false, 'APPROVAL_PENDING status not configured. Please run migrations.'));
    }

    const cleanNote = String(approval_note).trim();

    // Insert approval record
    const insertResult = await executeQuery(`
      INSERT INTO ticket_approvals (ticket_id, requested_by, approver_id, approval_note)
      OUTPUT INSERTED.approval_id
      VALUES (@ticketId, @userId, @approverId, @approvalNote)
    `, { ticketId, userId, approverId: approver_id, approvalNote: cleanNote });
    const approvalId = insertResult.recordset[0].approval_id;

    // Update ticket: set approval_pending, pause SLA if not already paused
    const ticketUpdateParams = { ticketId, approvalPendingStatusId };
    let slaUpdate = '';
    if (!ticket.sla_paused) {
      // Only pause if not already paused (e.g. not in PENDING_INFO state)
      slaUpdate = `, sla_paused = 1, sla_paused_at = GETDATE(), sla_pause_reason = 'APPROVAL_PENDING'`;
    }
    await executeQuery(`
      UPDATE tickets SET
        approval_pending = 1,
        status_id = @approvalPendingStatusId,
        updated_at = GETDATE()
        ${slaUpdate}
      WHERE ticket_id = @ticketId
    `, ticketUpdateParams);

    // Log to ticket_activities
    const engineerLabel = ticket.engineer_name || req.user.full_name || 'Engineer';
    await executeQuery(`
      INSERT INTO ticket_activities (
        ticket_id, activity_type, field_name, old_value, new_value, description, performed_by
      )
      VALUES (
        @ticketId, 'APPROVAL_REQUESTED', 'approval_pending', '0', '1',
        @description, @userId
      )
    `, {
      ticketId,
      description: `${engineerLabel} raised an approval request. Approver: ${approver.full_name}. SLA paused until decision is made.`,
      userId,
    });

    // In-app notification for the approver
    await executeQuery(`
      INSERT INTO notifications (user_id, notification_type, title, message, related_ticket_id)
      VALUES (@approverId, 'APPROVAL_REQUESTED', 'Approval Required',
        'You have a pending approval request for ticket #' + @ticketNumber,
        @ticketId)
    `, { approverId: approver_id, ticketNumber: ticket.ticket_number, ticketId });

    // Email notification to approver
    const appUrl = getPublicAppUrl();
    const generalSettings = await settingsService.getByCategory('general');
    const notificationSettings = await settingsService.getByCategory('notification');
    const emailEnabled = notificationSettings.notify_on_ticket_updated === 'true' ||
                         notificationSettings.notify_on_ticket_updated === true;

    let approvalEmailUrlApprove = `${appUrl}/tickets/${ticketId}`;
    let approvalEmailUrlReject = `${appUrl}/tickets/${ticketId}`;
    let approvalReplyByEmailHtml = '';
    try {
      const { rawToken } = await approvalEmailToken.mintTokenForApproval(approvalId);
      const base = String(appUrl || '').replace(/\/$/, '');
      const enc = encodeURIComponent(rawToken);
      approvalEmailUrlApprove = `${base}/email-approval?t=${enc}&a=approve`;
      approvalEmailUrlReject = `${base}/email-approval?t=${enc}&a=reject`;

      const inboundTo = String(
        (await settingsService.get('approval_inbound_to')) ||
          process.env.APPROVAL_INBOUND_TO ||
          ''
      ).trim();
      if (inboundTo) {
        const encMail = encodeURIComponent;
        const bodyTxt = `Send this email without changing the subject line. (${generalSettings.system_name || 'IT Helpdesk'})`;
        const mailtoAp = `mailto:${encMail(inboundTo)}?subject=${encMail(`HD-APPROVE ${rawToken}`)}&body=${encMail(bodyTxt)}`;
        const mailtoRe = `mailto:${encMail(inboundTo)}?subject=${encMail(`HD-REJECT ${rawToken}`)}&body=${encMail(bodyTxt)}`;
        const safeInbound = inboundTo.replace(/</g, '').replace(/>/g, '');
        approvalReplyByEmailHtml = `<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:18px 20px;margin:24px 0">
  <p style="margin:0 0 10px;color:#14532d;font-size:14px;font-weight:600">Reply by email</p>
  <p style="margin:0 0 14px;color:#374151;font-size:14px">Opens your mail app with the correct subject. Press <strong>Send</strong> — the helpdesk reads this mailbox and applies your decision.</p>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto">
    <tr>
      <td style="padding:6px"><a href="${mailtoAp}" style="background:#059669;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;display:inline-block">Approve by email</a></td>
      <td style="padding:6px"><a href="${mailtoRe}" style="background:#dc2626;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px;display:inline-block">Reject by email</a></td>
    </tr>
  </table>
  <p style="margin:12px 0 0;color:#6b7280;font-size:12px">Send to: ${safeInbound}</p>
</div>`;
      }
    } catch (e) {
      logger.warn('mintTokenForApproval failed; email will omit one-click links', { error: e.message, approvalId });
    }

    if (emailEnabled && approver.email) {
      await emailQueueService.sendTemplatedEmail(
        'TICKET_APPROVAL_REQUESTED',
        approver.email,
        {
          ticket_number: ticket.ticket_number,
          subject: ticket.subject,
          priority: ticket.priority_name || 'Normal',
          department: ticket.department_name || '-',
          approver_name: approver.full_name,
          engineer_name: engineerLabel,
          approval_note: cleanNote,
          ticket_url: `${appUrl}/tickets/${ticketId}`,
          approval_email_url_approve: approvalEmailUrlApprove,
          approval_email_url_reject: approvalEmailUrlReject,
          approval_reply_by_email_html: approvalReplyByEmailHtml,
          system_name: generalSettings.system_name || 'IT Helpdesk',
        },
        {
          recipientName: approver.full_name,
          recipientUserId: approver_id,
          emailType: 'TICKET_APPROVAL_REQUESTED',
          relatedEntityType: 'TICKET',
          relatedEntityId: ticketId,
          priority: 2,
        }
      );
    }

    logger.success('Approval request raised', { ticketId, approvalId, approverId: approver_id });

    // 📱 WhatsApp: notify approver (fire-and-forget)
    waNotify.notifyApprovalRequest(approver_id, req.user.user_id, {
      ticketNumber: ticket.ticket_number,
      subject: ticket.subject,
      priority: ticket.priority_name || 'Normal',
      departmentName: ticket.department_name || '',
      approvalNote: cleanNote,
      approverName: approver.full_name,
      engineerName: engineerLabel,
      ticketId,
    }).catch(() => {});

    return res.status(200).json(createResponse(
      true,
      `Approval request sent to ${approver.full_name}. SLA is paused until a decision is made.`,
      { approval_id: approvalId, ticket_id: parseInt(ticketId) }
    ));
  } catch (error) {
    logger.error('requestApproval error', error);
    next(error);
  }
};

// ============================================
// DECIDE ON APPROVAL (Approve or Reject)
// Approver or Admin provides a decision note
// SLA is resumed
// POST /api/v1/ticket-approvals/:approvalId/decide
// Body: { decision: 'APPROVED' | 'REJECTED', decision_note: string }
// ============================================
const decideApproval = async (req, res, next) => {
  try {
    const { approvalId } = req.params;
    const { decision, decision_note } = req.body || {};
    const userId = req.user.user_id;
    const roleCode = req.user.role?.role_code || '';

    if (!decision || !['APPROVED', 'REJECTED'].includes(decision)) {
      return res.status(400).json(createResponse(false, "Decision must be 'APPROVED' or 'REJECTED'."));
    }
    if (!decision_note || !String(decision_note).trim()) {
      return res.status(400).json(createResponse(false, 'A decision note is required when approving or rejecting.'));
    }

    const cleanNote = String(decision_note).trim();

    const approvalResult = await executeQuery(
      `
      SELECT ta.approval_id, ta.approver_id, ta.status, ta.is_active
      FROM ticket_approvals ta
      WHERE ta.approval_id = @approvalId
    `,
      { approvalId }
    );

    if (!approvalResult.recordset.length) {
      return res.status(404).json(createResponse(false, 'Approval request not found.'));
    }

    const approval = approvalResult.recordset[0];

    if (!approval.is_active || approval.status !== 'PENDING') {
      return res.status(400).json(createResponse(false, 'This approval request is no longer pending.'));
    }

    const isApprover = approval.approver_id === userId;
    const canOverride = isPlatformAdmin(roleCode);
    if (!isApprover && !canOverride) {
      return res.status(403).json(
        createResponse(false, 'Only the designated approver or a system administrator can decide on this request.')
      );
    }

    const result = await processApprovalDecision({
      approvalId: parseInt(approvalId, 10),
      decision,
      decisionNote: cleanNote,
      actingUserId: userId,
    });

    if (!result.success) {
      return res.status(result.statusCode || 400).json(createResponse(false, result.message));
    }

    return res.status(200).json(createResponse(true, result.message, result.data));
  } catch (error) {
    logger.error('decideApproval error', error);
    next(error);
  }
};

// ============================================
// CANCEL APPROVAL REQUEST
// Engineer or admin can cancel a pending request (e.g., if no longer needed)
// SLA is resumed
// POST /api/v1/ticket-approvals/:approvalId/cancel
// ============================================
const cancelApproval = async (req, res, next) => {
  try {
    const { approvalId } = req.params;
    const userId = req.user.user_id;
    const roleCode = req.user.role?.role_code || '';

    const approvalResult = await executeQuery(`
      SELECT ta.approval_id, ta.ticket_id, ta.requested_by, ta.approver_id, ta.status, ta.is_active,
        u_apr.first_name + ' ' + u_apr.last_name AS approver_name
      FROM ticket_approvals ta
      LEFT JOIN users u_apr ON ta.approver_id = u_apr.user_id
      WHERE ta.approval_id = @approvalId
    `, { approvalId });

    if (!approvalResult.recordset.length) {
      return res.status(404).json(createResponse(false, 'Approval request not found.'));
    }
    const approval = approvalResult.recordset[0];

    if (!approval.is_active || approval.status !== 'PENDING') {
      return res.status(400).json(createResponse(false, 'This approval request is no longer pending.'));
    }

    const isRequester = approval.requested_by === userId;
    const canAdminCancel = isPlatformAdmin(roleCode);
    if (!isRequester && !canAdminCancel) {
      return res.status(403).json(createResponse(false, 'Only the engineer who raised the request or an administrator can cancel it.'));
    }

    const ticketId = approval.ticket_id;

    // Load ticket SLA info
    const ticketResult = await executeQuery(
      `SELECT sla_paused, sla_paused_at, sla_pause_reason, due_date FROM tickets WHERE ticket_id = @ticketId`,
      { ticketId }
    );
    const ticket = ticketResult.recordset[0];

    // Cancel approval
    await executeQuery(`
      UPDATE ticket_approvals SET status = 'CANCELLED', is_active = 0, decided_at = GETDATE()
      WHERE approval_id = @approvalId
    `, { approvalId });

    // Get IN_PROGRESS status
    const statusResult = await executeQuery(
      `SELECT status_id FROM ticket_statuses WHERE status_code = 'IN_PROGRESS'`
    );
    const inProgressId = statusResult.recordset?.[0]?.status_id;

    // Update ticket
    const setClauses = ['approval_pending = 0', 'updated_at = GETDATE()'];
    const updateParams = { ticketId };

    if (inProgressId) {
      setClauses.push('status_id = @inProgressId');
      updateParams.inProgressId = inProgressId;
    }

    const pauseWasForApproval = ticket?.sla_pause_reason === 'APPROVAL_PENDING';
    if (ticket?.sla_paused && pauseWasForApproval) {
      setClauses.push('sla_paused = 0', 'sla_paused_at = NULL', 'sla_pause_reason = NULL');
    }

    await executeQuery(`UPDATE tickets SET ${setClauses.join(', ')} WHERE ticket_id = @ticketId`, updateParams);

    // Extend due_date
    if (ticket?.sla_paused && pauseWasForApproval && ticket.due_date && ticket.sla_paused_at) {
      const dueDate = new Date(ticket.due_date);
      const pausedAt = new Date(ticket.sla_paused_at);
      const newDueDate = new Date(dueDate.getTime() + (Date.now() - pausedAt.getTime()));
      await executeQuery(`UPDATE tickets SET due_date = @newDueDate WHERE ticket_id = @ticketId`, { newDueDate, ticketId });
    }

    // Activity log
    await executeQuery(`
      INSERT INTO ticket_activities (ticket_id, activity_type, field_name, old_value, new_value, description, performed_by)
      VALUES (@ticketId, 'APPROVAL_CANCELLED', 'approval_pending', '1', '0',
        'Approval request was cancelled. SLA resumed.', @userId)
    `, { ticketId, userId });

    // Notify original approver
    await executeQuery(`
      INSERT INTO notifications (user_id, notification_type, title, message, related_ticket_id)
      VALUES (@approverId, 'APPROVAL_CANCELLED', 'Approval Request Cancelled',
        'The approval request you were assigned for ticket #' + @ticketNum + ' has been cancelled.',
        @ticketId)
    `, {
      approverId: approval.approver_id,
      ticketNum: (await executeQuery('SELECT ticket_number FROM tickets WHERE ticket_id = @ticketId', { ticketId })).recordset[0]?.ticket_number || '',
      ticketId
    });

    logger.success('Approval cancelled', { approvalId, ticketId });

    return res.status(200).json(createResponse(true, 'Approval request cancelled. SLA has been resumed.', {
      approval_id: parseInt(approvalId), ticket_id: ticketId
    }));
  } catch (error) {
    logger.error('cancelApproval error', error);
    next(error);
  }
};

// ============================================
// GET APPROVAL STATS (for dashboard widgets)
// GET /api/v1/ticket-approvals/stats
// ============================================
const getApprovalStats = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const roleCode = req.user.role?.role_code || '';
    const isAdmin = isPlatformAdmin(roleCode);
    const canReviewClosure =
      roleCode === 'ADMIN' || roleCode === 'MANAGER' || roleCode === 'CENTRAL_MGMT';

    const params = {};
    // Only platform admins see all rows; others see approvals they requested or must action
    let scopeFilter = isAdmin ? '' : 'AND (ta.approver_id = @userId OR ta.requested_by = @userId)';
    if (!isAdmin) params.userId = userId;

    const result = await executeQuery(`
      SELECT
        COUNT(CASE WHEN ta.status = 'PENDING' THEN 1 END)  AS pending_count,
        COUNT(CASE WHEN ta.status = 'APPROVED' THEN 1 END) AS approved_count,
        COUNT(CASE WHEN ta.status = 'REJECTED' THEN 1 END) AS rejected_count,
        COUNT(*)                                           AS all_count,
        COUNT(CASE WHEN ta.status = 'PENDING'
              AND ta.requested_at < DATEADD(HOUR, -48, GETDATE()) THEN 1 END) AS overdue_pending
      FROM ticket_approvals ta
      WHERE 1=1
        ${scopeFilter}
    `, params);

    const base = result.recordset[0] || {};

    const pendingClosureGlobal = await executeQuery(`
      SELECT COUNT(*) AS c
      FROM tickets t
      INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
      WHERE ts.status_name = N'Pending Closure'
        AND t.closure_requested_at IS NOT NULL
        AND t.closure_approved_at IS NULL
        AND t.closure_rejected_at IS NULL
    `);

    const myPendingClosure = await executeQuery(
      `
      SELECT COUNT(*) AS c
      FROM tickets t
      INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
      WHERE ts.status_name = N'Pending Closure'
        AND t.closure_requested_by = @userId
        AND t.closure_approved_at IS NULL
        AND t.closure_rejected_at IS NULL
    `,
      { userId }
    );

    return res.json(
      createResponse(true, 'Approval stats', {
        ...base,
        pending_closure_review_count: pendingClosureGlobal.recordset[0]?.c || 0,
        my_pending_closure_requests: myPendingClosure.recordset[0]?.c || 0,
        can_review_closure_requests: canReviewClosure,
      })
    );
  } catch (error) {
    logger.error('getApprovalStats error', error);
    next(error);
  }
};

module.exports = {
  getApprovers,
  getPendingApprovals,
  getTicketApprovals,
  requestApproval,
  decideApproval,
  cancelApproval,
  getApprovalStats,
};

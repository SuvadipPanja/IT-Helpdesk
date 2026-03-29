/**
 * Public (no login) endpoints for approval from email link.
 * Links open the SPA; user confirms; browser POSTs token + action (avoids GET side effects & link prefetch).
 */

const { createResponse } = require('../utils/helpers');
const logger = require('../utils/logger');
const { executeQuery } = require('../config/database');
const approvalEmailToken = require('../services/approvalEmailToken.service');
const { processApprovalDecision } = require('../services/approvalWorkflow.service');

/**
 * GET /api/v1/public/email-approval/context?token=
 */
const getEmailApprovalContext = async (req, res) => {
  try {
    const token = (req.query.token || req.query.t || '').trim();
    const approvalId = await approvalEmailToken.peekApprovalIdByRawToken(token);
    if (!approvalId) {
      return res.status(400).json(createResponse(false, 'Invalid or expired link. Open the latest approval email or sign in to the app.'));
    }

    const row = await executeQuery(
      `
      SELECT
        ta.approval_id,
        ta.ticket_id,
        ta.status,
        ta.is_active,
        t.ticket_number,
        t.subject,
        u_apr.first_name + ' ' + u_apr.last_name AS approver_name
      FROM ticket_approvals ta
      INNER JOIN tickets t ON ta.ticket_id = t.ticket_id
      LEFT JOIN users u_apr ON ta.approver_id = u_apr.user_id
      WHERE ta.approval_id = @approvalId
      `,
      { approvalId }
    );

    const a = row.recordset?.[0];
    if (!a || !a.is_active || a.status !== 'PENDING') {
      return res.status(400).json(createResponse(false, 'This approval request is no longer pending.'));
    }

    return res.json(
      createResponse(true, 'OK', {
        approval_id: a.approval_id,
        ticket_id: a.ticket_id,
        ticket_number: a.ticket_number,
        subject: a.subject,
        approver_name: a.approver_name || 'Approver',
      })
    );
  } catch (error) {
    logger.error('getEmailApprovalContext', error);
    return res.status(500).json(createResponse(false, 'Failed to load approval context.'));
  }
};

/**
 * POST /api/v1/public/email-approval/decision
 * Body: { token, action: 'approve' | 'reject', decision_note?: string }
 */
const postEmailApprovalDecision = async (req, res) => {
  try {
    const token = (req.body?.token || '').trim();
    const action = (req.body?.action || '').toLowerCase();
    let decision_note = req.body?.decision_note;

    if (!token) {
      return res.status(400).json(createResponse(false, 'Token is required.'));
    }
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json(createResponse(false, "action must be 'approve' or 'reject'."));
    }

    const approvalId = await approvalEmailToken.peekApprovalIdByRawToken(token);
    if (!approvalId) {
      return res.status(400).json(createResponse(false, 'Invalid or expired link.'));
    }

    const appr = await executeQuery(
      `SELECT approver_id, status, is_active FROM ticket_approvals WHERE approval_id = @approvalId`,
      { approvalId }
    );
    const approvalRow = appr.recordset?.[0];
    if (!approvalRow || !approvalRow.is_active || approvalRow.status !== 'PENDING') {
      return res.status(400).json(createResponse(false, 'This approval request is no longer pending.'));
    }

    const decision = action === 'approve' ? 'APPROVED' : 'REJECTED';
    if (!decision_note || !String(decision_note).trim()) {
      decision_note =
        decision === 'APPROVED' ? 'Approved via email link.' : 'Rejected via email link.';
    }

    const result = await processApprovalDecision({
      approvalId,
      decision,
      decisionNote: String(decision_note).trim(),
      actingUserId: approvalRow.approver_id,
    });

    if (!result.success) {
      return res.status(result.statusCode || 400).json(createResponse(false, result.message));
    }

    await approvalEmailToken.markTokenUsedByApprovalId(approvalId);

    return res.json(createResponse(true, result.message, result.data));
  } catch (error) {
    logger.error('postEmailApprovalDecision', error);
    return res.status(500).json(createResponse(false, 'Failed to record decision.'));
  }
};

module.exports = {
  getEmailApprovalContext,
  postEmailApprovalDecision,
};

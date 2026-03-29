// ============================================
// TICKET APPROVAL ROUTES
// Closure approval + mid-ticket approval workflow
// IMPORTANT: Register static paths (/approvers, /stats, …) BEFORE /:ticketId/*
// so paths like /approvers are not captured as ticketId.
// ============================================

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const ticketPermissionsService = require('../services/ticketPermissions.service');
const logger = require('../utils/logger');
const approvalsCtrl = require('../controllers/ticketApprovals.controller');

const isClosureReviewer = (req) => {
  const rc = (req.user?.role?.role_code || '').toUpperCase();
  return ['ADMIN', 'MANAGER', 'CENTRAL_MGMT'].includes(rc);
};

// ============================================
// WORKFLOW — static segments first
// ============================================
router.get('/approvers', authenticate, approvalsCtrl.getApprovers);
router.get('/stats', authenticate, approvalsCtrl.getApprovalStats);
router.get('/pending', authenticate, approvalsCtrl.getPendingApprovals);
router.get('/ticket/:ticketId', authenticate, approvalsCtrl.getTicketApprovals);

// ============================================
// PENDING CLOSURE LIST (managers)
// ============================================
router.get('/pending-closures', authenticate, async (req, res) => {
  try {
    if (!isClosureReviewer(req)) {
      return res.status(403).json({
        success: false,
        message: 'Only managers and admins can view pending closure requests',
      });
    }
    const tickets = await ticketPermissionsService.getPendingClosureRequests();
    res.json({
      success: true,
      data: { tickets },
      message: `Found ${tickets.length} pending closure requests`,
    });
  } catch (error) {
    logger.error('Error fetching pending closure requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending closure requests',
    });
  }
});

// ============================================
// REQUEST TICKET CLOSURE (engineer path when setting on)
// ============================================
router.post('/:ticketId/request-closure', authenticate, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const userId = req.user.user_id;

    const permission = await ticketPermissionsService.canUserCloseTicket(userId, ticketId);

    if (!permission.allowed) {
      return res.status(403).json({
        success: false,
        message: permission.reason,
      });
    }

    if (!permission.requiresApproval) {
      return res.status(400).json({
        success: false,
        message:
          'Closure approval is not required (see Settings). Close the ticket with resolution notes using the Close action.',
        code: 'CLOSURE_APPROVAL_NOT_REQUIRED',
      });
    }

    const result = await ticketPermissionsService.requestClosure(ticketId, userId);
    res.json(result);
  } catch (error) {
    logger.error('Error requesting ticket closure:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to request ticket closure',
    });
  }
});

// ============================================
// APPROVE CLOSURE REQUEST
// ============================================
router.post('/:ticketId/approve-closure', authenticate, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const userId = req.user.user_id;
    const { autoClose = true } = req.body;

    if (!isClosureReviewer(req)) {
      return res.status(403).json({
        success: false,
        message: 'Only managers and admins can approve closure requests',
      });
    }

    const approvalResult = await ticketPermissionsService.approveClosure(
      ticketId,
      userId,
      autoClose
    );
    res.json(approvalResult);
  } catch (error) {
    logger.error('Error approving ticket closure:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to approve ticket closure',
    });
  }
});

// ============================================
// REJECT CLOSURE REQUEST
// ============================================
router.post('/:ticketId/reject-closure', authenticate, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const userId = req.user.user_id;
    const { reason } = req.body;

    if (!reason || String(reason).trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required',
      });
    }

    if (!isClosureReviewer(req)) {
      return res.status(403).json({
        success: false,
        message: 'Only managers and admins can reject closure requests',
      });
    }

    const rejectionResult = await ticketPermissionsService.rejectClosure(
      ticketId,
      userId,
      String(reason).trim()
    );
    res.json(rejectionResult);
  } catch (error) {
    logger.error('Error rejecting ticket closure:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to reject ticket closure',
    });
  }
});

// ============================================
// CHECK CLOSURE PERMISSION
// GET /api/v1/ticket-approvals/:ticketId/can-close
// ============================================
router.get('/:ticketId/can-close', authenticate, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const userId = req.user.user_id;

    const permission = await ticketPermissionsService.canUserCloseTicket(userId, ticketId);
    const roleCode = (req.user.role?.role_code || '').toUpperCase();
    const canReview =
      ticketPermissionsService.canReviewPendingClosure(roleCode) &&
      permission.pending_closure;

    res.json({
      success: true,
      data: {
        ...permission,
        can_review_pending_closure: Boolean(canReview),
      },
    });
  } catch (error) {
    logger.error('Error checking closure permission:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check closure permission',
    });
  }
});

// ============================================
// LEGACY: POST close via permissions service (minimal — prefer PATCH /tickets/:id/close)
// ============================================
router.post('/:ticketId/close', authenticate, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const userId = req.user.user_id;

    const permission = await ticketPermissionsService.canUserCloseTicket(userId, ticketId);

    if (!permission.allowed) {
      return res.status(403).json({
        success: false,
        message: permission.reason,
      });
    }

    const roleCode = (req.user.role?.role_code || '').toUpperCase();
    const canBypass =
      ['ADMIN', 'MANAGER', 'CENTRAL_MGMT'].includes(roleCode);
    if (permission.requiresApproval && !canBypass) {
      return res.status(403).json({
        success: false,
        message: 'Use Request closure approval or PATCH /tickets/:id/close after approval.',
        code: 'CLOSURE_APPROVAL_REQUIRED',
      });
    }

    const result = await ticketPermissionsService.closeTicket(
      ticketId,
      userId,
      req.body?.resolution_notes || 'Ticket closed.'
    );
    res.json(result);
  } catch (error) {
    logger.error('Error closing ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to close ticket',
    });
  }
});

// ============================================
// MID-TICKET APPROVAL WORKFLOW
// ============================================
router.post('/:ticketId/request', authenticate, approvalsCtrl.requestApproval);
router.post('/:approvalId/decide', authenticate, approvalsCtrl.decideApproval);
router.post('/:approvalId/cancel', authenticate, approvalsCtrl.cancelApproval);

module.exports = router;

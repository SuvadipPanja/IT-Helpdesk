// ============================================
// TICKET APPROVAL ROUTES
// Handle ticket closure approval workflow
// Developed by: Suvadip Panja
// Date: October 29, 2025
// FILE: backend/routes/ticketApprovals.routes.js
// FIXED: Use correct authenticate middleware import
// ============================================

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth'); // FIXED: Was authenticateToken
const { executeQuery } = require('../config/database');
const ticketPermissionsService = require('../services/ticketPermissions.service');
const logger = require('../utils/logger');

// ============================================
// GET PENDING CLOSURE REQUESTS
// GET /api/v1/ticket-approvals/pending
// ============================================
router.get('/pending', authenticate, async (req, res) => {
  try {
    logger.info('Fetching pending closure requests', { userId: req.user.user_id });

    const tickets = await ticketPermissionsService.getPendingClosureRequests();

    res.json({
      success: true,
      data: { tickets },
      message: `Found ${tickets.length} pending closure requests`
    });

  } catch (error) {
    logger.error('Error fetching pending closure requests:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending closure requests'
    });
  }
});

// ============================================
// REQUEST TICKET CLOSURE
// POST /api/v1/ticket-approvals/:ticketId/request-closure
// ============================================
router.post('/:ticketId/request-closure', authenticate, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const userId = req.user.user_id;

    logger.info('Closure request received', { ticketId, userId });

    // Check permission
    const permission = await ticketPermissionsService.canUserCloseTicket(userId, ticketId);
    
    if (!permission.allowed) {
      logger.warn('Closure request denied', { ticketId, userId, reason: permission.reason });
      return res.status(403).json({
        success: false,
        message: permission.reason
      });
    }

    if (!permission.requiresApproval) {
      // No approval needed - close directly
      logger.info('No approval required, closing ticket directly', { ticketId });
      const result = await ticketPermissionsService.closeTicket(ticketId, userId);
      return res.json(result);
    }

    // Request approval
    logger.info('Approval required, requesting closure', { ticketId });
    const result = await ticketPermissionsService.requestClosure(ticketId, userId);
    
    res.json(result);

  } catch (error) {
    logger.error('Error requesting ticket closure:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to request ticket closure'
    });
  }
});

// ============================================
// APPROVE CLOSURE REQUEST
// POST /api/v1/ticket-approvals/:ticketId/approve-closure
// ============================================
router.post('/:ticketId/approve-closure', authenticate, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const userId = req.user.user_id;
    const { autoClose = true } = req.body;

    logger.info('Approval request received', { ticketId, userId, autoClose });

    // Verify user is manager/admin
    const userQuery = `
      SELECT r.role_name
      FROM users u
      INNER JOIN user_roles r ON u.role_id = r.role_id
      WHERE u.user_id = @userId
    `;
    
    const result = await executeQuery(userQuery, { userId });
    
    if (result.recordset.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'User not found'
      });
    }

    const roleName = result.recordset[0].role_name.toLowerCase();

    if (roleName !== 'admin' && roleName !== 'manager') {
      logger.warn('Approval denied - insufficient permissions', { ticketId, userId, role: roleName });
      return res.status(403).json({
        success: false,
        message: 'Only managers and admins can approve closure requests'
      });
    }

    logger.info('Approving closure', { ticketId, userId, role: roleName });
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
      message: 'Failed to approve ticket closure'
    });
  }
});

// ============================================
// REJECT CLOSURE REQUEST
// POST /api/v1/ticket-approvals/:ticketId/reject-closure
// ============================================
router.post('/:ticketId/reject-closure', authenticate, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const userId = req.user.user_id;
    const { reason } = req.body;

    logger.info('Rejection request received', { ticketId, userId });

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    // Verify user is manager/admin
    const userQuery = `
      SELECT r.role_name
      FROM users u
      INNER JOIN user_roles r ON u.role_id = r.role_id
      WHERE u.user_id = @userId
    `;
    
    const result = await executeQuery(userQuery, { userId });
    
    if (result.recordset.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'User not found'
      });
    }

    const roleName = result.recordset[0].role_name.toLowerCase();

    if (roleName !== 'admin' && roleName !== 'manager') {
      logger.warn('Rejection denied - insufficient permissions', { ticketId, userId, role: roleName });
      return res.status(403).json({
        success: false,
        message: 'Only managers and admins can reject closure requests'
      });
    }

    logger.info('Rejecting closure', { ticketId, userId, role: roleName, reason });
    const rejectionResult = await ticketPermissionsService.rejectClosure(
      ticketId, 
      userId, 
      reason
    );
    
    res.json(rejectionResult);

  } catch (error) {
    logger.error('Error rejecting ticket closure:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject ticket closure'
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
    
    res.json({
      success: true,
      data: permission
    });

  } catch (error) {
    logger.error('Error checking closure permission:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check closure permission'
    });
  }
});

// ============================================
// CLOSE TICKET DIRECTLY (for admins/managers)
// POST /api/v1/ticket-approvals/:ticketId/close
// ============================================
router.post('/:ticketId/close', authenticate, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const userId = req.user.user_id;

    logger.info('Direct closure request received', { ticketId, userId });

    // Check permission
    const permission = await ticketPermissionsService.canUserCloseTicket(userId, ticketId);
    
    if (!permission.allowed) {
      logger.warn('Direct closure denied', { ticketId, userId, reason: permission.reason });
      return res.status(403).json({
        success: false,
        message: permission.reason
      });
    }

    // Close ticket
    logger.info('Closing ticket directly', { ticketId, userId });
    const result = await ticketPermissionsService.closeTicket(ticketId, userId);
    
    res.json(result);

  } catch (error) {
    logger.error('Error closing ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to close ticket'
    });
  }
});

module.exports = router;
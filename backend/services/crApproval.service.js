// ============================================
// CR APPROVAL SERVICE
// Multi-level approval chain management
// ============================================

const { executeQuery } = require('../config/database');
const logger = require('../utils/logger');
const crService = require('./cr.service');

class CRApprovalService {

  /**
   * Create the approval chain for a CR based on its type
   * Called when CR moves to UNDER_REVIEW or PENDING_APPROVAL
   */
  async createApprovalChain(crId, crTypeId) {
    const crType = await crService.getTypeById(crTypeId);
    if (!crType) {
      logger.warn('CR type not found for approval chain', { crId, crTypeId });
      return [];
    }

    const approvers = [];
    let order = 1;

    // Manager approval (if required by type)
    if (crType.requires_manager_approval) {
      // Find managers with can_approve_cr permission
      const managers = await executeQuery(`
        SELECT TOP 3 u.user_id, u.first_name + ' ' + u.last_name AS full_name
        FROM users u
        INNER JOIN user_roles r ON u.role_id = r.role_id
        WHERE r.can_approve_cr = 1
          AND r.role_code = 'MANAGER'
          AND u.is_active = 1
        ORDER BY u.first_name
      `);

      for (const mgr of managers.recordset) {
        approvers.push({ userId: mgr.user_id, role: 'MANAGER', order: order++ });
      }
    }

    // CAB approval (if required by type)
    if (crType.requires_cab_approval) {
      // Find admins as CAB members
      const cabMembers = await executeQuery(`
        SELECT TOP 3 u.user_id, u.first_name + ' ' + u.last_name AS full_name
        FROM users u
        INNER JOIN user_roles r ON u.role_id = r.role_id
        WHERE r.can_approve_cr = 1
          AND r.role_code = 'ADMIN'
          AND u.is_active = 1
        ORDER BY u.first_name
      `);

      for (const cab of cabMembers.recordset) {
        approvers.push({ userId: cab.user_id, role: 'CAB', order: order++ });
      }
    }

    // Insert approval records (skip duplicates)
    const insertedApprovers = [];
    for (const approver of approvers) {
      const exists = await executeQuery(
        `SELECT approval_id FROM cr_approvals WHERE cr_id = @crId AND approver_id = @approverId`,
        { crId, approverId: approver.userId }
      );

      if (!exists.recordset.length) {
        await executeQuery(`
          INSERT INTO cr_approvals (cr_id, approver_id, approver_role, approval_order, status)
          VALUES (@crId, @approverId, @role, @order, 'PENDING')
        `, {
          crId,
          approverId: approver.userId,
          role: approver.role,
          order: approver.order,
        });
        insertedApprovers.push(approver);
      }
    }

    logger.info('Approval chain created', { crId, approverCount: insertedApprovers.length });
    return insertedApprovers;
  }

  /**
   * Process an individual approval decision
   */
  async processApproval(crId, approverId, decision, comments) {
    // Verify pending approval exists
    const approval = await executeQuery(`
      SELECT approval_id, approver_role, approval_order
      FROM cr_approvals
      WHERE cr_id = @crId AND approver_id = @approverId AND status = 'PENDING'
    `, { crId, approverId });

    if (!approval.recordset.length) {
      return { success: false, message: 'No pending approval found for this user' };
    }

    // Update the approval
    await executeQuery(`
      UPDATE cr_approvals 
      SET status = @decision, comments = @comments, decided_at = GETDATE()
      WHERE cr_id = @crId AND approver_id = @approverId AND status = 'PENDING'
    `, {
      crId,
      approverId,
      decision: decision.toUpperCase(),
      comments: comments || null,
    });

    // If rejected, the whole CR is rejected
    if (decision.toUpperCase() === 'REJECTED') {
      return { success: true, allApproved: false, rejected: true };
    }

    // Check if all approvals are now done
    const pending = await executeQuery(`
      SELECT COUNT(*) AS pending_count
      FROM cr_approvals
      WHERE cr_id = @crId AND status = 'PENDING'
    `, { crId });

    const allApproved = pending.recordset[0].pending_count === 0;
    return { success: true, allApproved, rejected: false };
  }

  /**
   * Get pending approvals for a user
   */
  async getPendingForUser(userId) {
    const result = await executeQuery(`
      SELECT 
        a.approval_id, a.cr_id, a.approver_role, a.approval_order, a.requested_at,
        cr.cr_number, cr.title, cr.risk_level,
        ct.type_name, ct.type_code,
        cs.status_name, cs.status_code, cs.color_code,
        req.first_name + ' ' + req.last_name AS requester_name
      FROM cr_approvals a
      INNER JOIN change_requests cr ON a.cr_id = cr.cr_id
      LEFT JOIN cr_types ct ON cr.cr_type_id = ct.type_id
      LEFT JOIN cr_statuses cs ON cr.cr_status_id = cs.status_id
      LEFT JOIN users req ON cr.requester_id = req.user_id
      WHERE a.approver_id = @userId AND a.status = 'PENDING'
      ORDER BY a.requested_at ASC
    `, { userId });

    return result.recordset;
  }

  /**
   * Get the full approval chain for a CR
   */
  async getApprovalChain(crId) {
    const result = await executeQuery(`
      SELECT 
        a.*,
        u.first_name + ' ' + u.last_name AS approver_name,
        u.email AS approver_email
      FROM cr_approvals a
      LEFT JOIN users u ON a.approver_id = u.user_id
      WHERE a.cr_id = @crId
      ORDER BY a.approval_order
    `, { crId });

    return result.recordset;
  }

  /**
   * Get approval statistics
   */
  async getApprovalStats(userId) {
    const [pending, recent] = await Promise.all([
      executeQuery(`
        SELECT COUNT(*) AS count FROM cr_approvals 
        WHERE approver_id = @userId AND status = 'PENDING'
      `, { userId }),
      executeQuery(`
        SELECT 
          status, COUNT(*) AS count
        FROM cr_approvals
        WHERE approver_id = @userId
        GROUP BY status
      `, { userId }),
    ]);

    return {
      pending_count: pending.recordset[0].count,
      by_status: recent.recordset,
    };
  }
}

module.exports = new CRApprovalService();

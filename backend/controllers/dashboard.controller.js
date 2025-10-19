// ============================================
// Dashboard Controller
// Handles dashboard statistics and metrics
// FIXED: All permission checks now use req.user.permissions
// ============================================

const { executeQuery } = require('../config/database');
const { createResponse } = require('../utils/helpers');
const logger = require('../utils/logger');

/**
 * Get Dashboard Statistics
 * @route GET /api/v1/dashboard/stats
 * @access Private
 */
const getDashboardStats = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    
    // ✅ FIXED: Use req.user.permissions
    const canViewAll = req.user.permissions?.can_view_all_tickets || false;

    logger.separator('DASHBOARD STATS REQUEST');
    logger.try('Fetching dashboard statistics', {
      userId,
      username: req.user.username,
      canViewAll,
    });

    // Base where clause for ticket filtering based on permissions
    const ticketFilter = canViewAll 
      ? '1=1' // Admin/Manager can see all tickets
      : `(t.requester_id = ${userId} OR t.assigned_to = ${userId})`; // User sees only their tickets

    // Query 1: Total Tickets Count
    logger.try('Calculating total tickets');
    const totalTicketsQuery = `
      SELECT COUNT(*) as total_count
      FROM tickets t
      WHERE ${ticketFilter}
    `;
    const totalTicketsResult = await executeQuery(totalTicketsQuery);
    const totalTickets = totalTicketsResult.recordset[0].total_count;

    logger.success('Total tickets calculated', { count: totalTickets });

    // Query 2: Tickets by Status
    logger.try('Calculating tickets by status');
    const statusQuery = `
      SELECT 
        ts.status_code,
        ts.status_name,
        COUNT(t.ticket_id) as count
      FROM ticket_statuses ts
      LEFT JOIN tickets t ON ts.status_id = t.status_id 
        AND ${ticketFilter}
      WHERE ts.is_active = 1
      GROUP BY ts.status_code, ts.status_name, ts.status_id
      ORDER BY ts.status_id
    `;
    const statusResult = await executeQuery(statusQuery);

    // Extract counts for each status
    const statusMap = {};
    statusResult.recordset.forEach(row => {
      statusMap[row.status_code] = row.count;
    });

    const openTickets = statusMap['OPEN'] || 0;
    const inProgressTickets = statusMap['IN_PROGRESS'] || 0;
    const pendingTickets = statusMap['PENDING'] || 0;
    const resolvedTickets = statusMap['RESOLVED'] || 0;
    const closedTickets = statusMap['CLOSED'] || 0;

    logger.success('Status counts calculated', {
      open: openTickets,
      inProgress: inProgressTickets,
      pending: pendingTickets,
      resolved: resolvedTickets,
      closed: closedTickets,
    });

    // Query 3: Total Active Users (only for users with view all permission)
    let totalUsers = 0;
    if (canViewAll) {
      logger.try('Calculating total active users');
      const usersQuery = `
        SELECT COUNT(*) as user_count
        FROM users
        WHERE is_active = 1
      `;
      const usersResult = await executeQuery(usersQuery);
      totalUsers = usersResult.recordset[0].user_count;
      logger.success('Total users calculated', { count: totalUsers });
    }

    // Query 4: Recent Tickets (last 5)
    logger.try('Fetching recent tickets');
    const recentTicketsQuery = `
      SELECT TOP 5
        t.ticket_id,
        t.ticket_number,
        t.subject as title,
        t.created_at,
        tc.category_name,
        tp.priority_name,
        tp.priority_code,
        ts.status_name,
        ts.status_code,
        u.first_name + ' ' + u.last_name as requester_name
      FROM tickets t
      LEFT JOIN ticket_categories tc ON t.category_id = tc.category_id
      LEFT JOIN ticket_priorities tp ON t.priority_id = tp.priority_id
      LEFT JOIN ticket_statuses ts ON t.status_id = ts.status_id
      LEFT JOIN users u ON t.requester_id = u.user_id
      WHERE ${ticketFilter}
      ORDER BY t.created_at DESC
    `;
    const recentTicketsResult = await executeQuery(recentTicketsQuery);

    logger.success('Recent tickets fetched', {
      count: recentTicketsResult.recordset.length,
    });

    // Query 5: Tickets by Priority
    logger.try('Calculating tickets by priority');
    const priorityQuery = `
      SELECT 
        tp.priority_code,
        tp.priority_name,
        COUNT(t.ticket_id) as count
      FROM ticket_priorities tp
      LEFT JOIN tickets t ON tp.priority_id = t.priority_id 
        AND ${ticketFilter}
      WHERE tp.is_active = 1
      GROUP BY tp.priority_code, tp.priority_name, tp.priority_level
      ORDER BY tp.priority_level DESC
    `;
    const priorityResult = await executeQuery(priorityQuery);

    logger.success('Priority counts calculated');

    // Query 6: My Assigned Tickets (for current user)
    logger.try('Calculating my assigned tickets');
    const myAssignedQuery = `
      SELECT COUNT(*) as count
      FROM tickets t
      WHERE t.assigned_to = ${userId}
        AND t.status_id NOT IN (
          SELECT status_id FROM ticket_statuses WHERE is_final_status = 1
        )
    `;
    const myAssignedResult = await executeQuery(myAssignedQuery);
    const myAssignedTickets = myAssignedResult.recordset[0].count;

    logger.success('My assigned tickets calculated', { count: myAssignedTickets });

    // Compile dashboard data
    const dashboardData = {
      summary: {
        totalTickets,
        openTickets,
        inProgressTickets,
        pendingTickets,
        resolvedTickets,
        closedTickets,
        totalUsers: canViewAll ? totalUsers : null, // Only show for admin/manager
        myAssignedTickets,
      },
      recentTickets: recentTicketsResult.recordset,
      ticketsByStatus: statusResult.recordset,
      ticketsByPriority: priorityResult.recordset,
      userPermissions: {
        canViewAll,
        canCreateTickets: req.user.permissions?.can_create_tickets || false,
        canManageUsers: req.user.permissions?.can_manage_users || false,
        canViewAnalytics: req.user.permissions?.can_view_analytics || false,
      },
    };

    logger.separator('DASHBOARD STATS SUCCESS');
    logger.success('Dashboard statistics compiled successfully', {
      userId,
      username: req.user.username,
      totalTickets,
    });
    logger.separator();

    return res.status(200).json(
      createResponse(true, 'Dashboard statistics fetched successfully', dashboardData)
    );

  } catch (error) {
    logger.error('Dashboard stats error', error);
    logger.separator();
    next(error);
  }
};

/**
 * Get User Activity Summary
 * @route GET /api/v1/dashboard/activity
 * @access Private
 */
const getUserActivity = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    
    // ✅ FIXED: Use req.user.permissions
    const canViewAll = req.user.permissions?.can_view_all_tickets || false;

    logger.try('Fetching user activity summary', { userId });

    const activityQuery = `
      SELECT TOP 10
        ta.activity_id,
        ta.activity_type,
        ta.description,
        ta.performed_at,
        ta.performed_by,
        u.first_name + ' ' + u.last_name as performed_by_name,
        t.ticket_number,
        t.subject as ticket_subject
      FROM ticket_activities ta
      INNER JOIN tickets t ON ta.ticket_id = t.ticket_id
      INNER JOIN users u ON ta.performed_by = u.user_id
      WHERE ${canViewAll ? '1=1' : `(t.requester_id = ${userId} OR t.assigned_to = ${userId})`}
      ORDER BY ta.performed_at DESC
    `;

    const result = await executeQuery(activityQuery);

    logger.success('User activity fetched', {
      count: result.recordset.length,
    });

    return res.status(200).json(
      createResponse(true, 'Activity summary fetched successfully', result.recordset)
    );

  } catch (error) {
    logger.error('User activity error', error);
    next(error);
  }
};

// ============================================
// EXPORT ALL FUNCTIONS
// ============================================
module.exports = {
  getDashboardStats,
  getUserActivity,
};
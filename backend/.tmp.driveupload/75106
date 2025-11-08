// ============================================
// PASSWORD EXPIRY SERVICE
// Handles all password expiry logic
// ============================================
// Developer: Suvadip Panja
// Created: November 08, 2025
// File: backend/services/passwordExpiry.service.js
// ============================================
// PURPOSE:
// - Check if user's password is expiring
// - Calculate days until expiry
// - Determine warning status
// - Get users with expiring passwords
// ============================================

const { executeQuery } = require('../config/database');
const logger = require('../utils/logger');

// ============================================
// CHECK PASSWORD EXPIRY STATUS FOR A USER
// ============================================
/**
 * Get password expiry status for a specific user
 * @param {number} userId - User ID to check
 * @returns {Promise<Object>} Expiry status
 */
const checkPasswordExpiry = async (userId) => {
  try {
    logger.try('Checking password expiry status', { userId });

    // Get settings from database
    const settingsQuery = `
      SELECT 
        setting_key,
        setting_value
      FROM system_settings
      WHERE setting_key IN ('password_expiry_days', 'password_expiry_warning_days')
    `;

    const settingsResult = await executeQuery(settingsQuery);
    
    // Convert to object
    const settings = {};
    settingsResult.recordset.forEach(row => {
      settings[row.setting_key] = parseInt(row.setting_value) || 0;
    });

    const expiryDays = settings.password_expiry_days || 90;
    const warningDays = settings.password_expiry_warning_days || 14;

    logger.info('Password expiry settings loaded', { 
      expiryDays, 
      warningDays,
      userId 
    });

    // Check if password expiry is disabled (0 = never expire)
    if (expiryDays === 0) {
      logger.info('Password expiry is disabled', { userId });
      return {
        expired: false,
        isWarning: false,
        daysRemaining: null,
        passwordLastChanged: null,
        passwordExpiresAt: null,
        expiryDisabled: true
      };
    }

    // Get user's password last changed date
    const userQuery = `
      SELECT 
        user_id,
        username,
        password_changed_at,
        created_at
      FROM users
      WHERE user_id = @userId
    `;

    const userResult = await executeQuery(userQuery, { userId });

    if (userResult.recordset.length === 0) {
      logger.warn('User not found', { userId });
      return {
        expired: false,
        isWarning: false,
        daysRemaining: null,
        passwordLastChanged: null,
        passwordExpiresAt: null,
        error: 'User not found'
      };
    }

    const user = userResult.recordset[0];

    // Use password_changed_at if available, otherwise use created_at
    const passwordLastChanged = user.password_changed_at || user.created_at;

    if (!passwordLastChanged) {
      logger.warn('No password change date found', { userId });
      return {
        expired: false,
        isWarning: false,
        daysRemaining: null,
        passwordLastChanged: null,
        passwordExpiresAt: null,
        error: 'No password change date found'
      };
    }

    // Calculate password age in days
    const now = new Date();
    const lastChanged = new Date(passwordLastChanged);
    const ageInDays = Math.floor((now - lastChanged) / (1000 * 60 * 60 * 24));

    // Calculate expiry date
    const expiresAt = new Date(lastChanged);
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    // Calculate days remaining
    const daysRemaining = Math.floor((expiresAt - now) / (1000 * 60 * 60 * 24));

    // Determine status
    const expired = daysRemaining < 0;
    const isWarning = !expired && daysRemaining <= warningDays;

    logger.info('Password expiry status calculated', {
      userId,
      username: user.username,
      ageInDays,
      daysRemaining,
      expired,
      isWarning,
      expiryDays,
      warningDays
    });

    return {
      expired,
      isWarning,
      daysRemaining: daysRemaining >= 0 ? daysRemaining : 0,
      passwordLastChanged: passwordLastChanged,
      passwordExpiresAt: expiresAt,
      expiryDisabled: false,
      warningThreshold: warningDays,
      expiryPolicy: expiryDays
    };

  } catch (error) {
    logger.error('Error checking password expiry', error);
    throw error;
  }
};

// ============================================
// GET ALL USERS WITH EXPIRING PASSWORDS
// ============================================
/**
 * Get list of users whose passwords are expiring or expired
 * Used by admins to monitor and send reminders
 * @param {Object} options - Filter options
 * @returns {Promise<Array>} List of users with expiry info
 */
const getUsersWithExpiringPasswords = async (options = {}) => {
  try {
    const {
      includeExpired = true,
      includeWarning = true,
      departmentId = null,
      limit = 100
    } = options;

    logger.try('Getting users with expiring passwords', options);

    // Get settings from database
    const settingsQuery = `
      SELECT 
        setting_key,
        setting_value
      FROM system_settings
      WHERE setting_key IN ('password_expiry_days', 'password_expiry_warning_days')
    `;

    const settingsResult = await executeQuery(settingsQuery);
    
    const settings = {};
    settingsResult.recordset.forEach(row => {
      settings[row.setting_key] = parseInt(row.setting_value) || 0;
    });

    const expiryDays = settings.password_expiry_days || 90;
    const warningDays = settings.password_expiry_warning_days || 14;

    // Check if password expiry is disabled
    if (expiryDays === 0) {
      logger.info('Password expiry is disabled - returning empty list');
      return [];
    }

    // Build query to get users
    let query = `
      SELECT 
        u.user_id,
        u.username,
        u.email,
        u.first_name,
        u.last_name,
        u.department_id,
        d.department_name,
        u.password_changed_at,
        u.created_at,
        COALESCE(u.password_changed_at, u.created_at) as last_password_change,
        DATEDIFF(day, COALESCE(u.password_changed_at, u.created_at), GETDATE()) as password_age_days,
        DATEADD(day, @expiryDays, COALESCE(u.password_changed_at, u.created_at)) as expires_at,
        DATEDIFF(day, GETDATE(), DATEADD(day, @expiryDays, COALESCE(u.password_changed_at, u.created_at))) as days_remaining
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.department_id
      WHERE u.is_active = 1
    `;

    // Add department filter if provided
    if (departmentId) {
      query += ` AND u.department_id = @departmentId`;
    }

    // Add expiry/warning filter
    query += `
      AND (
        -- Expired passwords
        DATEDIFF(day, GETDATE(), DATEADD(day, @expiryDays, COALESCE(u.password_changed_at, u.created_at))) < 0
        -- Expiring soon (within warning threshold)
        OR DATEDIFF(day, GETDATE(), DATEADD(day, @expiryDays, COALESCE(u.password_changed_at, u.created_at))) BETWEEN 0 AND @warningDays
      )
      ORDER BY days_remaining ASC
    `;

    const params = {
      expiryDays,
      warningDays,
    };

    if (departmentId) {
      params.departmentId = departmentId;
    }

    const result = await executeQuery(query, params);

    // Process results
    const users = result.recordset.map(user => {
      const daysRemaining = user.days_remaining || 0;
      const expired = daysRemaining < 0;
      const isWarning = !expired && daysRemaining <= warningDays;

      return {
        userId: user.user_id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        fullName: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username,
        departmentId: user.department_id,
        departmentName: user.department_name,
        passwordLastChanged: user.last_password_change,
        passwordExpiresAt: user.expires_at,
        passwordAgeDays: user.password_age_days,
        daysRemaining: daysRemaining >= 0 ? daysRemaining : 0,
        expired,
        isWarning,
        status: expired ? 'expired' : isWarning ? 'warning' : 'ok'
      };
    });

    // Filter by status if needed
    let filteredUsers = users;
    if (!includeExpired) {
      filteredUsers = filteredUsers.filter(u => !u.expired);
    }
    if (!includeWarning) {
      filteredUsers = filteredUsers.filter(u => u.expired || !u.isWarning);
    }

    // Apply limit
    filteredUsers = filteredUsers.slice(0, limit);

    logger.success('Users with expiring passwords retrieved', {
      totalCount: filteredUsers.length,
      expiredCount: filteredUsers.filter(u => u.expired).length,
      warningCount: filteredUsers.filter(u => u.isWarning).length
    });

    return filteredUsers;

  } catch (error) {
    logger.error('Error getting users with expiring passwords', error);
    throw error;
  }
};

// ============================================
// GET EXPIRY STATISTICS
// ============================================
/**
 * Get overall statistics about password expiry
 * Used for dashboard widgets
 * @returns {Promise<Object>} Statistics
 */
const getExpiryStatistics = async () => {
  try {
    logger.try('Getting password expiry statistics');

    // Get settings
    const settingsQuery = `
      SELECT 
        setting_key,
        setting_value
      FROM system_settings
      WHERE setting_key IN ('password_expiry_days', 'password_expiry_warning_days')
    `;

    const settingsResult = await executeQuery(settingsQuery);
    
    const settings = {};
    settingsResult.recordset.forEach(row => {
      settings[row.setting_key] = parseInt(row.setting_value) || 0;
    });

    const expiryDays = settings.password_expiry_days || 90;
    const warningDays = settings.password_expiry_warning_days || 14;

    // Check if disabled
    if (expiryDays === 0) {
      return {
        expiryDisabled: true,
        totalUsers: 0,
        expiredCount: 0,
        warningCount: 0,
        okCount: 0
      };
    }

    // Get counts
    const statsQuery = `
      SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN DATEDIFF(day, GETDATE(), DATEADD(day, @expiryDays, COALESCE(password_changed_at, created_at))) < 0 THEN 1 ELSE 0 END) as expired_count,
        SUM(CASE WHEN DATEDIFF(day, GETDATE(), DATEADD(day, @expiryDays, COALESCE(password_changed_at, created_at))) BETWEEN 0 AND @warningDays THEN 1 ELSE 0 END) as warning_count,
        SUM(CASE WHEN DATEDIFF(day, GETDATE(), DATEADD(day, @expiryDays, COALESCE(password_changed_at, created_at))) > @warningDays THEN 1 ELSE 0 END) as ok_count
      FROM users
      WHERE is_active = 1
    `;

    const statsResult = await executeQuery(statsQuery, { expiryDays, warningDays });
    const stats = statsResult.recordset[0];

    logger.success('Password expiry statistics retrieved', stats);

    return {
      expiryDisabled: false,
      totalUsers: stats.total_users || 0,
      expiredCount: stats.expired_count || 0,
      warningCount: stats.warning_count || 0,
      okCount: stats.ok_count || 0,
      expiryPolicy: expiryDays,
      warningThreshold: warningDays
    };

  } catch (error) {
    logger.error('Error getting expiry statistics', error);
    throw error;
  }
};

// ============================================
// EXPORTS
// ============================================
module.exports = {
  checkPasswordExpiry,
  getUsersWithExpiringPasswords,
  getExpiryStatistics
};


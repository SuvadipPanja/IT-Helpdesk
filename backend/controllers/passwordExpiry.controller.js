// ============================================
// PASSWORD EXPIRY CONTROLLER
// API endpoints for password expiry features
// ============================================
// Developer: Suvadip Panja
// Created: November 08, 2025
// File: backend/controllers/passwordExpiry.controller.js
// ============================================
// ENDPOINTS:
// GET /api/v1/password-expiry/status - Get current user's expiry status
// GET /api/v1/password-expiry/users-expiring - Get all users with expiring passwords (admin)
// GET /api/v1/password-expiry/statistics - Get expiry statistics (admin)
// ============================================

const passwordExpiryService = require('../services/passwordExpiry.service');
const { createResponse } = require('../utils/helpers');
const logger = require('../utils/logger');

// ============================================
// GET PASSWORD EXPIRY STATUS FOR CURRENT USER
// ============================================
/**
 * @route   GET /api/v1/password-expiry/status
 * @desc    Get password expiry status for logged-in user
 * @access  Private (any authenticated user)
 */
const getPasswordExpiryStatus = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const username = req.user.username;

    logger.try('Getting password expiry status', { userId, username });

    // Get expiry status from service
    const expiryStatus = await passwordExpiryService.checkPasswordExpiry(userId);

    logger.success('Password expiry status retrieved', {
      userId,
      username,
      expired: expiryStatus.expired,
      isWarning: expiryStatus.isWarning,
      daysRemaining: expiryStatus.daysRemaining
    });

    return res.status(200).json(
      createResponse(
        true,
        'Password expiry status retrieved successfully',
        expiryStatus
      )
    );

  } catch (error) {
    logger.error('Error getting password expiry status', error);
    next(error);
  }
};

// ============================================
// GET ALL USERS WITH EXPIRING PASSWORDS
// ============================================
/**
 * @route   GET /api/v1/password-expiry/users-expiring
 * @desc    Get list of users with expiring passwords
 * @access  Private (Admin only - requires can_manage_users)
 * @query   include_expired, include_warning, department_id, limit
 */
const getUsersWithExpiringPasswords = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const username = req.user.username;

    // Parse query parameters
    const {
      include_expired = 'true',
      include_warning = 'true',
      department_id = null,
      limit = '100'
    } = req.query;

    const options = {
      includeExpired: include_expired === 'true',
      includeWarning: include_warning === 'true',
      departmentId: department_id ? parseInt(department_id) : null,
      limit: parseInt(limit) || 100
    };

    logger.try('Getting users with expiring passwords', {
      requestedBy: username,
      userId,
      options
    });

    // Get users from service
    const users = await passwordExpiryService.getUsersWithExpiringPasswords(options);

    logger.success('Users with expiring passwords retrieved', {
      requestedBy: username,
      count: users.length,
      expiredCount: users.filter(u => u.expired).length,
      warningCount: users.filter(u => u.isWarning).length
    });

    return res.status(200).json(
      createResponse(
        true,
        `Found ${users.length} users with expiring passwords`,
        {
          users,
          count: users.length,
          filters: options
        }
      )
    );

  } catch (error) {
    logger.error('Error getting users with expiring passwords', error);
    next(error);
  }
};

// ============================================
// GET PASSWORD EXPIRY STATISTICS
// ============================================
/**
 * @route   GET /api/v1/password-expiry/statistics
 * @desc    Get overall password expiry statistics
 * @access  Private (Admin only - requires can_view_analytics)
 */
const getPasswordExpiryStatistics = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const username = req.user.username;

    logger.try('Getting password expiry statistics', {
      requestedBy: username,
      userId
    });

    // Get statistics from service
    const statistics = await passwordExpiryService.getExpiryStatistics();

    logger.success('Password expiry statistics retrieved', {
      requestedBy: username,
      statistics
    });

    return res.status(200).json(
      createResponse(
        true,
        'Password expiry statistics retrieved successfully',
        statistics
      )
    );

  } catch (error) {
    logger.error('Error getting password expiry statistics', error);
    next(error);
  }
};

// ============================================
// EXPORTS
// ============================================
module.exports = {
  getPasswordExpiryStatus,
  getUsersWithExpiringPasswords,
  getPasswordExpiryStatistics
};


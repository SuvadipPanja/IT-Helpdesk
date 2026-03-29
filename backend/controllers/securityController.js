// ============================================
// SECURITY CONTROLLER
// Fetches all security-related settings from database
// ============================================
// Developer: Suvadip Panja
// Created: November 08, 2025
// File: backend/controllers/securityController.js
// ============================================
// PURPOSE:
// - Fetch password policy settings
// - Fetch session management settings
// - Fetch account security settings
// - Return all security data in one endpoint
// ============================================

const { executeQuery } = require('../config/database'); // ⭐ FIXED: Use executeQuery
const logger = require('../utils/logger');
const { createResponse } = require('../utils/helpers');

/**
 * Get all security settings from database
 * Endpoint: GET /api/v1/security/settings
 */
const getSecuritySettings = async (req, res) => {
  try {
    logger.info('Fetching all security settings from database');

    // Query to fetch ALL security-related settings
    const query = `
      SELECT 
        setting_key,
        setting_value,
        setting_description
      FROM system_settings
      WHERE setting_key IN (
        -- Password Policy
        'password_min_length',
        'password_require_uppercase',
        'password_require_lowercase',
        'password_require_number',
        'password_require_special',
        'password_expiry_days',
        'password_expiry_warning_days',
        'password_history_count',
        
        -- Session Management
        'session_timeout_minutes',
        'session_auto_logout',
        'max_concurrent_sessions',
        
        -- Account Security
        'lockout_attempts',
        'lockout_duration_minutes',
        'two_factor_enabled',
        'ip_whitelist',
        
        -- OTP & Token Settings
        'otp_expiry_minutes',
        'password_reset_token_expiry_hours',
        'resend_otp_cooldown_seconds'
      )
      ORDER BY setting_key
    `;

    const result = await executeQuery(query);

    // Convert rows to key-value object
    const settings = {};
    result.recordset.forEach(row => {
      settings[row.setting_key] = row.setting_value;
    });

    logger.success('Security settings fetched', { count: Object.keys(settings).length });

    // Check if password_history_count exists
    if (!settings.password_history_count) {
      logger.warn('password_history_count is missing from database settings');
    }

    // Return response
    return res.status(200).json({
      success: true,
      message: 'Security settings fetched successfully',
      data: settings,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error fetching security settings', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch security settings'
    });
  }
};

/**
 * Get password policy settings only
 * Endpoint: GET /api/v1/security/password-policy
 */
const getPasswordPolicy = async (req, res) => {
  try {
    logger.info('Fetching password policy settings');

    const query = `
      SELECT 
        setting_key,
        setting_value
      FROM system_settings
      WHERE setting_key IN (
        'password_min_length',
        'password_require_uppercase',
        'password_require_lowercase',
        'password_require_number',
        'password_require_special',
        'password_expiry_days',
        'password_expiry_warning_days',
        'password_history_count',
        'lockout_attempts',
        'lockout_duration_minutes',
        'session_timeout_minutes',
        'otp_expiry_minutes',
        'password_reset_token_expiry_hours',
        'resend_otp_cooldown_seconds'
      )
    `;

    const result = await executeQuery(query);

    const policy = {};
    result.recordset.forEach(row => {
      policy[row.setting_key] = row.setting_value;
    });

    logger.success('Password policy fetched', { count: Object.keys(policy).length });

    return res.status(200).json({
      success: true,
      message: 'Password policy fetched successfully',
      data: policy,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error fetching password policy', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch password policy'
    });
  }
};

/**
 * Get session management settings only
 * Endpoint: GET /api/v1/security/session-settings
 */
const getSessionSettings = async (req, res) => {
  try {
    logger.info('Fetching session settings');

    const query = `
      SELECT 
        setting_key,
        setting_value
      FROM system_settings
      WHERE setting_key IN (
        'session_timeout_minutes',
        'session_auto_logout',
        'max_concurrent_sessions'
      )
    `;

    const result = await executeQuery(query);

    const settings = {};
    result.recordset.forEach(row => {
      settings[row.setting_key] = row.setting_value;
    });

    logger.success('Session settings fetched', { count: Object.keys(settings).length });

    return res.status(200).json({
      success: true,
      message: 'Session settings fetched successfully',
      data: settings,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error fetching session settings', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch session settings'
    });
  }
};

/**
 * Get account security settings only
 * Endpoint: GET /api/v1/security/account-settings
 */
const getAccountSecuritySettings = async (req, res) => {
  try {
    logger.info('Fetching account security settings');

    const query = `
      SELECT 
        setting_key,
        setting_value
      FROM system_settings
      WHERE setting_key IN (
        'lockout_attempts',
        'lockout_duration_minutes',
        'two_factor_enabled',
        'ip_whitelist'
      )
    `;

    const result = await executeQuery(query);

    const settings = {};
    result.recordset.forEach(row => {
      settings[row.setting_key] = row.setting_value;
    });

    logger.success('Account security settings fetched', { count: Object.keys(settings).length });

    return res.status(200).json({
      success: true,
      message: 'Account security settings fetched successfully',
      data: settings,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error fetching account security settings', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch account security settings'
    });
  }
};

module.exports = {
  getSecuritySettings,
  getPasswordPolicy,
  getSessionSettings,
  getAccountSecuritySettings
};


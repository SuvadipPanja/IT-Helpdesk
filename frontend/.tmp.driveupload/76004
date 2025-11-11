// ============================================
// TWO-FACTOR AUTHENTICATION SERVICE - FIXED
// Handles all 2FA-related API calls
// Developer: Suvadip Panja
// Date: November 10, 2025
// Updated: November 11, 2025 - Added password to disable
// FILE: frontend/src/services/twoFactor.service.js
// ============================================

import api from './api';

/**
 * Get 2FA settings for current user
 * @returns {Promise<Object>} 2FA settings
 */
const get2FASettings = async () => {
  try {
    const response = await api.get('/2fa/settings');
    return response.data.data;
  } catch (error) {
    console.error('Error getting 2FA settings:', error);
    throw error;
  }
};

/**
 * Setup email-based 2FA
 * @returns {Promise<Object>} Setup result
 */
const setupEmail2FA = async () => {
  try {
    const response = await api.post('/2fa/setup/email');
    return response.data;
  } catch (error) {
    console.error('Error setting up email 2FA:', error);
    throw error;
  }
};

/**
 * Send OTP code to user's email
 * @returns {Promise<Object>} Send result with expiry info
 */
const sendOTP = async () => {
  try {
    const response = await api.post('/2fa/send-otp');
    return response.data;
  } catch (error) {
    console.error('Error sending OTP:', error);
    throw error;
  }
};

/**
 * Verify OTP or backup code
 * @param {string} code - OTP code or backup code
 * @param {string} method - 'email' or 'backup_code'
 * @returns {Promise<Object>} Verification result
 */
const verifyOTP = async (code, method = 'email') => {
  try {
    const response = await api.post('/2fa/verify', {
      code,
      method
    });
    return response.data;
  } catch (error) {
    console.error('Error verifying OTP:', error);
    throw error;
  }
};

/**
 * Enable 2FA for user account
 * @returns {Promise<Object>} Enable result
 */
const enable2FA = async () => {
  try {
    const response = await api.post('/2fa/enable');
    return response.data;
  } catch (error) {
    console.error('Error enabling 2FA:', error);
    throw error;
  }
};

/**
 * Disable 2FA for user account
 * ⭐ FIXED: Now requires password for security
 * @param {string} password - User's password for confirmation
 * @returns {Promise<Object>} Disable result
 */
const disable2FA = async (password) => {
  try {
    const response = await api.post('/2fa/disable', {
      password  // ⭐ Send password to backend
    });
    return response.data;
  } catch (error) {
    console.error('Error disabling 2FA:', error);
    throw error;
  }
};

/**
 * Generate new backup codes
 * @returns {Promise<Object>} Backup codes array
 */
const generateBackupCodes = async () => {
  try {
    const response = await api.post('/2fa/backup-codes/generate');
    return response.data.data;
  } catch (error) {
    console.error('Error generating backup codes:', error);
    throw error;
  }
};

/**
 * Get backup codes statistics
 * @returns {Promise<Object>} Stats (total, used, unused)
 */
const getBackupCodesStats = async () => {
  try {
    const response = await api.get('/2fa/backup-codes/stats');
    return response.data.data;
  } catch (error) {
    console.error('Error getting backup codes stats:', error);
    throw error;
  }
};

// Export all functions
export default {
  get2FASettings,
  setupEmail2FA,
  sendOTP,
  verifyOTP,
  enable2FA,
  disable2FA,
  generateBackupCodes,
  getBackupCodesStats
};
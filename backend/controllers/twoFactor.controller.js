// ============================================
// TWO-FACTOR AUTHENTICATION CONTROLLER
// Handle all 2FA API requests
// Developer: Suvadip Panja
// Date: November 10, 2025
// FILE LOCATION: backend/controllers/twoFactor.controller.js
// ============================================

const twoFactorService = require('../services/twoFactor.service');
const backupCodesUtil = require('../utils/backupCodes.util');
const logger = require('../utils/logger');
const { createResponse } = require('../utils/helpers');

// ============================================
// GET USER'S 2FA SETTINGS
// @route   GET /api/v1/2fa/settings
// @access  Private
// ============================================
const get2FASettings = async (req, res, next) => {
  try {
    const userId = req.user.user_id;

    logger.separator('GET 2FA SETTINGS');
    logger.try('Fetching 2FA settings for user', { userId });

    const settings = await twoFactorService.get2FASettings(userId);

    logger.success('2FA settings retrieved', { userId });
    logger.separator();

    return res.status(200).json(
      createResponse(true, '2FA settings retrieved successfully', settings)
    );

  } catch (error) {
    logger.error('Get 2FA settings controller error', error);
    logger.separator();
    next(error);
  }
};

// ============================================
// SETUP EMAIL 2FA
// @route   POST /api/v1/2fa/setup/email
// @access  Private
// ============================================
const setupEmail2FA = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const userEmail = req.user.email;
    const userName = req.user.full_name || req.user.username;

    logger.separator('SETUP EMAIL 2FA');
    logger.try('Setting up email 2FA', { userId, userEmail });

    const result = await twoFactorService.setupEmail2FA(userId, userEmail, userName);

    logger.success('Email 2FA setup complete', { userId });
    logger.separator();

    return res.status(200).json(
      createResponse(true, result.message, result)
    );

  } catch (error) {
    logger.error('Setup email 2FA controller error', error);
    logger.separator();
    next(error);
  }
};

// ============================================
// SEND OTP TO EMAIL
// @route   POST /api/v1/2fa/send-otp
// @access  Private
// ============================================
const sendOTP = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const userEmail = req.user.email;
    const userName = req.user.full_name || req.user.username;

    logger.separator('SEND OTP');
    logger.try('Sending OTP to user email', { userId, userEmail });

    const result = await twoFactorService.sendOTPEmail(userId, userEmail, userName);

    logger.success('OTP sent successfully', { userId });
    logger.separator();

    return res.status(200).json(
      createResponse(true, result.message, {
        expiryMinutes: result.expiryMinutes
      })
    );

  } catch (error) {
    logger.error('Send OTP controller error', error);
    logger.separator();
    next(error);
  }
};

// ============================================
// VERIFY OTP CODE
// @route   POST /api/v1/2fa/verify
// @access  Private
// ============================================
const verifyOTP = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const { code, method } = req.body;

    logger.separator('VERIFY OTP');
    logger.try('Verifying OTP code', { userId, method });

    // Validation
    if (!code) {
      logger.warn('Verification code missing');
      logger.separator();
      return res.status(400).json(
        createResponse(false, 'Verification code is required')
      );
    }

    const result = await twoFactorService.verify2FA(userId, code, method || 'email');

    if (!result.success) {
      logger.warn('OTP verification failed', { userId });
      logger.separator();
      return res.status(400).json(
        createResponse(false, result.message)
      );
    }

    logger.success('OTP verified successfully', { userId });
    logger.separator();

    return res.status(200).json(
      createResponse(true, result.message)
    );

  } catch (error) {
    logger.error('Verify OTP controller error', error);
    logger.separator();
    next(error);
  }
};

// ============================================
// ENABLE 2FA
// @route   POST /api/v1/2fa/enable
// @access  Private
// ============================================
const enable2FA = async (req, res, next) => {
  try {
    const userId = req.user.user_id;

    logger.separator('ENABLE 2FA');
    logger.try('Enabling 2FA for user', { userId });

    const result = await twoFactorService.enable2FA(userId);

    logger.success('2FA enabled successfully', { userId });
    logger.separator();

    return res.status(200).json(
      createResponse(true, result.message)
    );

  } catch (error) {
    logger.error('Enable 2FA controller error', error);
    logger.separator();
    next(error);
  }
};

// ============================================
// DISABLE 2FA
// @route   POST /api/v1/2fa/disable
// @access  Private
// ============================================
const disable2FA = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const { password } = req.body;

    logger.separator('DISABLE 2FA');
    logger.try('Disabling 2FA for user', { userId });

    // TODO: Verify password before disabling (security measure)
    // For now, we'll allow it without password verification

    const result = await twoFactorService.disable2FA(userId);

    logger.success('2FA disabled successfully', { userId });
    logger.separator();

    return res.status(200).json(
      createResponse(true, result.message)
    );

  } catch (error) {
    logger.error('Disable 2FA controller error', error);
    logger.separator();
    next(error);
  }
};

// ============================================
// GENERATE BACKUP CODES
// @route   POST /api/v1/2fa/backup-codes/generate
// @access  Private
// ============================================
const generateBackupCodes = async (req, res, next) => {
  try {
    const userId = req.user.user_id;

    logger.separator('GENERATE BACKUP CODES');
    logger.try('Generating backup codes', { userId });

    const codes = await backupCodesUtil.generateBackupCodes(userId, 10);

    logger.success('Backup codes generated', { userId, count: codes.length });
    logger.separator();

    return res.status(200).json(
      createResponse(true, 'Backup codes generated successfully', {
        codes,
        count: codes.length,
        message: 'Save these codes in a secure place. Each code can only be used once.'
      })
    );

  } catch (error) {
    logger.error('Generate backup codes controller error', error);
    logger.separator();
    next(error);
  }
};

// ============================================
// GET BACKUP CODES STATS
// @route   GET /api/v1/2fa/backup-codes/stats
// @access  Private
// ============================================
const getBackupCodesStats = async (req, res, next) => {
  try {
    const userId = req.user.user_id;

    logger.try('Fetching backup codes stats', { userId });

    const stats = await backupCodesUtil.getBackupCodesStats(userId);

    logger.success('Backup codes stats retrieved', { userId });

    return res.status(200).json(
      createResponse(true, 'Backup codes stats retrieved', stats)
    );

  } catch (error) {
    logger.error('Get backup codes stats controller error', error);
    next(error);
  }
};

// ============================================
// EXPORTS
// ============================================
module.exports = {
  get2FASettings,
  setupEmail2FA,
  sendOTP,
  verifyOTP,
  enable2FA,
  disable2FA,
  generateBackupCodes,
  getBackupCodesStats
};
// ============================================
// TWO-FACTOR AUTHENTICATION SERVICE
// Complete 2FA business logic
// Developer: Suvadip Panja
// Date: November 10, 2025
// FILE LOCATION: backend/services/twoFactor.service.js
// ============================================

const { executeQuery } = require('../config/database');
const logger = require('../utils/logger');
const otpService = require('./otp.service');
const qrcodeUtil = require('../utils/qrcode.util');
const backupCodesUtil = require('../utils/backupCodes.util');
const { sendEmail } = require('./email.service');

// ============================================
// CHECK IF USER HAS 2FA ENABLED
// ============================================
const is2FAEnabled = async (userId) => {
  try {
    logger.try('Checking 2FA status', { userId });

    const query = `
      SELECT 
        setting_id,
        user_id,
        is_enabled,
        method,
        email_verified,
        authenticator_verified
      FROM user_2fa_settings
      WHERE user_id = @userId
    `;

    const result = await executeQuery(query, { userId });

    if (result.recordset.length === 0) {
      logger.info('No 2FA settings found for user', { userId });
      return false;
    }

    const settings = result.recordset[0];
    logger.success('2FA status checked', { 
      userId, 
      isEnabled: settings.is_enabled 
    });

    return settings.is_enabled;

  } catch (error) {
    logger.error('Failed to check 2FA status', error);
    throw error;
  }
};

// ============================================
// GET USER'S 2FA SETTINGS
// ============================================
const get2FASettings = async (userId) => {
  try {
    logger.try('Fetching 2FA settings', { userId });

    const query = `
      SELECT 
        s.setting_id,
        s.user_id,
        s.is_enabled,
        s.method,
        s.email_verified,
        s.authenticator_verified,
        s.backup_codes_generated,
        s.enabled_at,
        s.last_used_at,
        (SELECT COUNT(*) FROM user_2fa_backup_codes WHERE user_id = s.user_id AND is_used = 0) as remaining_backup_codes,
        (SELECT COUNT(*) FROM user_trusted_devices WHERE user_id = s.user_id AND is_active = 1 AND expires_at > GETDATE()) as trusted_devices_count
      FROM user_2fa_settings s
      WHERE s.user_id = @userId
    `;

    const result = await executeQuery(query, { userId });

    if (result.recordset.length === 0) {
      logger.info('No 2FA settings found, returning defaults', { userId });
      return {
        is_enabled: false,
        method: null,
        email_verified: false,
        authenticator_verified: false,
        backup_codes_generated: false,
        remaining_backup_codes: 0,
        trusted_devices_count: 0
      };
    }

    const settings = result.recordset[0];
    logger.success('2FA settings fetched', { userId });

    return settings;

  } catch (error) {
    logger.error('Failed to get 2FA settings', error);
    throw error;
  }
};

// ============================================
// SETUP EMAIL 2FA
// ============================================
const setupEmail2FA = async (userId, userEmail, userName) => {
  try {
    logger.try('Setting up email 2FA', { userId, userEmail });

    // Check if settings exist
    const existingSettings = await executeQuery(`
      SELECT setting_id FROM user_2fa_settings WHERE user_id = @userId
    `, { userId });

    if (existingSettings.recordset.length === 0) {
      // Create new settings
      await executeQuery(`
        INSERT INTO user_2fa_settings (
          user_id,
          is_enabled,
          method,
          email_verified,
          created_at,
          updated_at
        )
        VALUES (
          @userId,
          0,
          'email',
          1,
          GETDATE(),
          GETDATE()
        )
      `, { userId });
    } else {
      // Update existing settings
      await executeQuery(`
        UPDATE user_2fa_settings
        SET method = 'email',
            email_verified = 1,
            updated_at = GETDATE()
        WHERE user_id = @userId
      `, { userId });
    }

    logger.success('Email 2FA setup complete', { userId });

    return {
      success: true,
      message: 'Email 2FA configured successfully'
    };

  } catch (error) {
    logger.error('Failed to setup email 2FA', error);
    throw error;
  }
};

// ============================================
// SEND OTP VIA EMAIL
// ============================================
const sendOTPEmail = async (userId, userEmail, userName) => {
  try {
    logger.try('Sending OTP email', { userId, userEmail });

    // Invalidate any pending OTPs
    await otpService.invalidateUserOTPs(userId, 'login');

    // Create new OTP
    const { otpCode, expiryMinutes } = await otpService.createOTP(userId, 'login', 'email', 5);

    // Send email
    await sendEmail(
      userEmail,
      'two_factor_otp',
      {
        user_name: userName,
        otp_code: otpCode,
        expiry_minutes: expiryMinutes
      }
    );

    logger.success('OTP email sent', { userId, userEmail });

    return {
      success: true,
      message: 'Verification code sent to your email',
      expiryMinutes
    };

  } catch (error) {
    logger.error('Failed to send OTP email', error);
    throw error;
  }
};

// ============================================
// VERIFY 2FA (Email OTP or Backup Code)
// ============================================
const verify2FA = async (userId, code, method = 'email') => {
  try {
    logger.try('Verifying 2FA code', { userId, method });

    let result;

    if (method === 'email') {
      // Verify email OTP
      result = await otpService.verifyOTP(userId, code, 'login');
    } else if (method === 'backup_code') {
      // Verify backup code
      result = await backupCodesUtil.verifyBackupCode(userId, code);
    } else {
      return {
        success: false,
        message: 'Invalid verification method'
      };
    }

    // Log attempt
    await executeQuery(`
      INSERT INTO user_2fa_attempts (
        user_id,
        method,
        success,
        attempted_at
      )
      VALUES (
        @userId,
        @method,
        @success,
        GETDATE()
      )
    `, {
      userId,
      method,
      success: result.success ? 1 : 0
    });

    // Update last used
    if (result.success) {
      await executeQuery(`
        UPDATE user_2fa_settings
        SET last_used_at = GETDATE()
        WHERE user_id = @userId
      `, { userId });
    }

    logger.success('2FA verification complete', { 
      userId, 
      method, 
      success: result.success 
    });

    return result;

  } catch (error) {
    logger.error('Failed to verify 2FA', error);
    throw error;
  }
};

// ============================================
// ENABLE 2FA
// ============================================
const enable2FA = async (userId) => {
  try {
    logger.try('Enabling 2FA', { userId });

    await executeQuery(`
      UPDATE user_2fa_settings
      SET is_enabled = 1,
          enabled_at = GETDATE(),
          updated_at = GETDATE()
      WHERE user_id = @userId
    `, { userId });

    await executeQuery(`
      UPDATE users
      SET is_2fa_enabled = 1
      WHERE user_id = @userId
    `, { userId });

    logger.success('2FA enabled', { userId });

    return {
      success: true,
      message: '2FA enabled successfully'
    };

  } catch (error) {
    logger.error('Failed to enable 2FA', error);
    throw error;
  }
};

// ============================================
// DISABLE 2FA
// ============================================
const disable2FA = async (userId) => {
  try {
    logger.try('Disabling 2FA', { userId });

    await executeQuery(`
      UPDATE user_2fa_settings
      SET is_enabled = 0,
          disabled_at = GETDATE(),
          updated_at = GETDATE()
      WHERE user_id = @userId
    `, { userId });

    await executeQuery(`
      UPDATE users
      SET is_2fa_enabled = 0
      WHERE user_id = @userId
    `, { userId });

    // Revoke all backup codes
    await backupCodesUtil.revokeAllBackupCodes(userId);

    logger.success('2FA disabled', { userId });

    return {
      success: true,
      message: '2FA disabled successfully'
    };

  } catch (error) {
    logger.error('Failed to disable 2FA', error);
    throw error;
  }
};

// ============================================
// EXPORTS
// ============================================
module.exports = {
  is2FAEnabled,
  get2FASettings,
  setupEmail2FA,
  sendOTPEmail,
  verify2FA,
  enable2FA,
  disable2FA
};
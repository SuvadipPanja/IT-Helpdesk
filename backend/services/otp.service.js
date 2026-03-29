// ============================================
// OTP SERVICE (FIXED)
// Generate and verify OTP codes for 2FA
// FIXED: Timezone bug in expires_at calculation
// Developer: Suvadip Panja
// Date: November 10, 2025 (Fixed)
// FILE LOCATION: backend/services/otp.service.js
// ============================================

const crypto = require('crypto');
const { executeQuery } = require('../config/database');
const logger = require('../utils/logger');

// ============================================
// GENERATE 6-DIGIT OTP CODE
// ============================================
const generateOTP = () => {
  // Generate 6-digit random number
  return crypto.randomInt(100000, 999999).toString();
};

// ============================================
// CREATE AND STORE OTP IN DATABASE
// ============================================
const createOTP = async (userId, otpType = 'login', method = 'email', expiryMinutes = 5) => {
  try {
    logger.try('Creating OTP for user', { userId, otpType, method });

    // Generate OTP
    const otpCode = generateOTP();
    
    // Hash OTP for storage (security best practice)
    const otpHash = crypto.createHash('sha256').update(otpCode).digest('hex');

    // ✅ FIX: Let SQL Server calculate expires_at using DATEADD
    // This avoids timezone conversion issues between JavaScript and SQL Server
    const query = `
      INSERT INTO user_2fa_otp_codes (
        user_id,
        otp_code,
        otp_type,
        method,
        expires_at,
        created_at
      )
      OUTPUT INSERTED.otp_id, INSERTED.expires_at
      VALUES (
        @userId,
        @otpHash,
        @otpType,
        @method,
        DATEADD(MINUTE, @expiryMinutes, GETDATE()),
        GETDATE()
      )
    `;

    const result = await executeQuery(query, {
      userId,
      otpHash,
      otpType,
      method,
      expiryMinutes  // ✅ Pass as number, SQL Server handles the calculation
    });

    const otpId = result.recordset[0].otp_id;
    const expiresAt = result.recordset[0].expires_at; // ✅ Get actual expires_at from database

    logger.success('OTP created successfully', { 
      otpId, 
      userId, 
      expiresAt: expiresAt.toISOString() 
    });

    // Return plain OTP (only time it's visible)
    return {
      otpId,
      otpCode, // Plain code to send via email
      expiresAt,
      expiryMinutes
    };

  } catch (error) {
    logger.error('Failed to create OTP', error);
    throw error;
  }
};

// ============================================
// VERIFY OTP CODE
// ============================================
const verifyOTP = async (userId, otpCode, otpType = 'login') => {
  try {
    logger.try('Verifying OTP', { userId, otpType });

    // Hash the provided OTP
    const otpHash = crypto.createHash('sha256').update(otpCode).digest('hex');

    // Find matching OTP
    const query = `
      SELECT 
        otp_id,
        user_id,
        otp_code,
        is_used,
        is_expired,
        expires_at,
        created_at
      FROM user_2fa_otp_codes
      WHERE user_id = @userId
        AND otp_code = @otpHash
        AND otp_type = @otpType
        AND is_used = 0
        AND is_expired = 0
        AND expires_at > GETDATE()
      ORDER BY created_at DESC
    `;

    const result = await executeQuery(query, {
      userId,
      otpHash,
      otpType
    });

    if (result.recordset.length === 0) {
      logger.warn('OTP verification failed - invalid or expired', { userId });
      return {
        success: false,
        message: 'Invalid or expired OTP code'
      };
    }

    const otp = result.recordset[0];

    // Mark OTP as used
    const updateQuery = `
      UPDATE user_2fa_otp_codes
      SET is_used = 1,
          used_at = GETDATE()
      WHERE otp_id = @otpId
    `;

    await executeQuery(updateQuery, { otpId: otp.otp_id });

    logger.success('OTP verified successfully', { 
      userId, 
      otpId: otp.otp_id 
    });

    return {
      success: true,
      message: 'OTP verified successfully'
    };

  } catch (error) {
    logger.error('Failed to verify OTP', error);
    throw error;
  }
};

// ============================================
// INVALIDATE ALL PENDING OTPs FOR USER
// Used when user requests a new OTP
// ============================================
const invalidateUserOTPs = async (userId, otpType = 'login') => {
  try {
    logger.try('Invalidating pending OTPs', { userId, otpType });

    const query = `
      UPDATE user_2fa_otp_codes
      SET is_expired = 1
      WHERE user_id = @userId
        AND otp_type = @otpType
        AND is_used = 0
        AND is_expired = 0
    `;

    await executeQuery(query, { userId, otpType });

    logger.success('Pending OTPs invalidated', { userId, otpType });

  } catch (error) {
    logger.error('Failed to invalidate OTPs', error);
    throw error;
  }
};

// ============================================
// CLEANUP EXPIRED OTPs
// Run periodically via background job
// ============================================
const cleanupExpiredOTPs = async () => {
  try {
    logger.try('Cleaning up expired OTPs');

    const query = `
      UPDATE user_2fa_otp_codes
      SET is_expired = 1
      WHERE is_used = 0
        AND is_expired = 0
        AND expires_at < GETDATE()
    `;

    const result = await executeQuery(query);
    const rowsAffected = result.rowsAffected[0];

    logger.success('Expired OTPs cleaned up', { count: rowsAffected });

    return rowsAffected;

  } catch (error) {
    logger.error('Failed to cleanup expired OTPs', error);
    throw error;
  }
};

// ============================================
// GET OTP STATISTICS
// ============================================
const getOTPStats = async (userId) => {
  try {
    const query = `
      SELECT 
        COUNT(*) as total_otps,
        SUM(CASE WHEN is_used = 1 THEN 1 ELSE 0 END) as used_otps,
        SUM(CASE WHEN is_expired = 1 THEN 1 ELSE 0 END) as expired_otps,
        SUM(CASE WHEN is_used = 0 AND is_expired = 0 AND expires_at > GETDATE() THEN 1 ELSE 0 END) as pending_otps
      FROM user_2fa_otp_codes
      WHERE user_id = @userId
    `;

    const result = await executeQuery(query, { userId });
    return result.recordset[0];

  } catch (error) {
    logger.error('Failed to get OTP stats', error);
    throw error;
  }
};

// ============================================
// EXPORTS
// ============================================
module.exports = {
  generateOTP,
  createOTP,
  verifyOTP,
  invalidateUserOTPs,
  cleanupExpiredOTPs,
  getOTPStats
};
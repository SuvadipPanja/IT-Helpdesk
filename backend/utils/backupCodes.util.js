// ============================================
// BACKUP CODES UTILITY
// Generate and manage emergency backup codes
// Developer: Suvadip Panja
// Date: November 10, 2025
// FILE LOCATION: backend/utils/backupCodes.util.js
// ============================================

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { executeQuery } = require('../config/database');
const logger = require('../utils/logger');

// ============================================
// GENERATE BACKUP CODE
// Format: XXXX-XXXX (8 characters, hyphenated)
// ============================================
const generateBackupCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars (0, O, 1, I)
  let code = '';
  
  for (let i = 0; i < 8; i++) {
    if (i === 4) {
      code += '-'; // Add hyphen in middle
    }
    const randomIndex = crypto.randomInt(0, chars.length);
    code += chars[randomIndex];
  }
  
  return code;
};

// ============================================
// GENERATE SET OF BACKUP CODES
// Default: 10 codes
// ============================================
const generateBackupCodes = async (userId, count = 10) => {
  try {
    logger.try('Generating backup codes', { userId, count });

    // Delete existing unused backup codes
    await executeQuery(`
      DELETE FROM user_2fa_backup_codes
      WHERE user_id = @userId AND is_used = 0
    `, { userId });

    const codes = [];
    const hashedCodes = [];

    // Generate codes
    for (let i = 0; i < count; i++) {
      const code = generateBackupCode();
      const hashedCode = await bcrypt.hash(code, 10);
      
      codes.push(code);
      hashedCodes.push(hashedCode);
    }

    // Insert into database
    const query = `
      INSERT INTO user_2fa_backup_codes (
        user_id,
        code_hash,
        generated_at
      )
      VALUES
        ${hashedCodes.map((_, i) => `(@userId, @hash${i}, GETDATE())`).join(', ')}
    `;

    const params = { userId };
    hashedCodes.forEach((hash, i) => {
      params[`hash${i}`] = hash;
    });

    await executeQuery(query, params);

    // Update user's 2FA settings
    await executeQuery(`
      UPDATE user_2fa_settings
      SET backup_codes_generated = 1,
          updated_at = GETDATE()
      WHERE user_id = @userId
    `, { userId });

    logger.success('Backup codes generated', { userId, count });

    // Return plain codes (only time they're visible)
    return codes;

  } catch (error) {
    logger.error('Failed to generate backup codes', error);
    throw error;
  }
};

// ============================================
// VERIFY BACKUP CODE
// ============================================
const verifyBackupCode = async (userId, code) => {
  try {
    logger.try('Verifying backup code', { userId });

    // Get all unused backup codes for user
    const query = `
      SELECT 
        code_id,
        code_hash,
        generated_at
      FROM user_2fa_backup_codes
      WHERE user_id = @userId
        AND is_used = 0
      ORDER BY generated_at DESC
    `;

    const result = await executeQuery(query, { userId });

    if (result.recordset.length === 0) {
      logger.warn('No unused backup codes found', { userId });
      return {
        success: false,
        message: 'No valid backup codes available'
      };
    }

    // Check each code
    for (const backupCode of result.recordset) {
      const isMatch = await bcrypt.compare(code, backupCode.code_hash);
      
      if (isMatch) {
        // Mark code as used
        await executeQuery(`
          UPDATE user_2fa_backup_codes
          SET is_used = 1,
              used_at = GETDATE()
          WHERE code_id = @codeId
        `, { codeId: backupCode.code_id });

        logger.success('Backup code verified', { 
          userId, 
          codeId: backupCode.code_id 
        });

        return {
          success: true,
          message: 'Backup code verified successfully'
        };
      }
    }

    logger.warn('Backup code verification failed', { userId });

    return {
      success: false,
      message: 'Invalid backup code'
    };

  } catch (error) {
    logger.error('Failed to verify backup code', error);
    throw error;
  }
};

// ============================================
// GET REMAINING BACKUP CODES COUNT
// ============================================
const getRemainingCodesCount = async (userId) => {
  try {
    const query = `
      SELECT COUNT(*) as remaining_codes
      FROM user_2fa_backup_codes
      WHERE user_id = @userId
        AND is_used = 0
    `;

    const result = await executeQuery(query, { userId });
    return result.recordset[0].remaining_codes;

  } catch (error) {
    logger.error('Failed to get remaining codes count', error);
    throw error;
  }
};

// ============================================
// GET BACKUP CODES STATS
// ============================================
const getBackupCodesStats = async (userId) => {
  try {
    const query = `
      SELECT 
        COUNT(*) as total_codes,
        SUM(CASE WHEN is_used = 0 THEN 1 ELSE 0 END) as unused_codes,
        SUM(CASE WHEN is_used = 1 THEN 1 ELSE 0 END) as used_codes,
        MAX(generated_at) as last_generated
      FROM user_2fa_backup_codes
      WHERE user_id = @userId
    `;

    const result = await executeQuery(query, { userId });
    return result.recordset[0];

  } catch (error) {
    logger.error('Failed to get backup codes stats', error);
    throw error;
  }
};

// ============================================
// REVOKE ALL BACKUP CODES
// Used when user disables 2FA
// ============================================
const revokeAllBackupCodes = async (userId) => {
  try {
    logger.try('Revoking all backup codes', { userId });

    await executeQuery(`
      DELETE FROM user_2fa_backup_codes
      WHERE user_id = @userId
    `, { userId });

    await executeQuery(`
      UPDATE user_2fa_settings
      SET backup_codes_generated = 0,
          updated_at = GETDATE()
      WHERE user_id = @userId
    `, { userId });

    logger.success('All backup codes revoked', { userId });

  } catch (error) {
    logger.error('Failed to revoke backup codes', error);
    throw error;
  }
};

// ============================================
// EXPORTS
// ============================================
module.exports = {
  generateBackupCode,
  generateBackupCodes,
  verifyBackupCode,
  getRemainingCodesCount,
  getBackupCodesStats,
  revokeAllBackupCodes
};
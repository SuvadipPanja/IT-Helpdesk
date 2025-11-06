// ============================================
// SECURITY SERVICE
// Comprehensive security features implementation
// Developer: Suvadip Panja
// Created: November 06, 2025
// FILE: backend/services/security.service.js
// ============================================

const { executeQuery } = require('../config/database');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');
const settingsService = require('./settings.service');

class SecurityService {
  
  // ============================================
  // PASSWORD POLICY VALIDATION
  // Validates password against configured security policy
  // ============================================
  async validatePasswordPolicy(password) {
    try {
      logger.try('Validating password against security policy');
      
      const settings = await settingsService.getByCategory('security');
      const errors = [];

      // Check minimum length
      const minLength = parseInt(settings.password_min_length) || 8;
      if (password.length < minLength) {
        errors.push(`Password must be at least ${minLength} characters long`);
      }

      // Check uppercase requirement
      const requireUppercase = settings.password_require_uppercase === 'true' || settings.password_require_uppercase === true;
      if (requireUppercase && !/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
      }

      // Check lowercase requirement
      const requireLowercase = settings.password_require_lowercase === 'true' || settings.password_require_lowercase === true;
      if (requireLowercase && !/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
      }

      // Check number requirement
      const requireNumber = settings.password_require_number === 'true' || settings.password_require_number === true;
      if (requireNumber && !/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
      }

      // Check special character requirement
      const requireSpecial = settings.password_require_special === 'true' || settings.password_require_special === true;
      if (requireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        errors.push('Password must contain at least one special character');
      }

      const strength = this.calculatePasswordStrength(password);

      const result = {
        valid: errors.length === 0,
        errors: errors,
        strength: strength,
        requirements: {
          minLength: minLength,
          requireUppercase: requireUppercase,
          requireLowercase: requireLowercase,
          requireNumber: requireNumber,
          requireSpecial: requireSpecial
        }
      };

      if (result.valid) {
        logger.success('Password validation passed', { strength: strength.level });
      } else {
        logger.warn('Password validation failed', { errors: errors.length });
      }

      return result;
    } catch (error) {
      logger.error('Password policy validation error', error);
      throw error;
    }
  }

  // ============================================
  // PASSWORD STRENGTH CALCULATOR
  // Returns strength level: weak, medium, strong
  // ============================================
  calculatePasswordStrength(password) {
    let strength = 0;
    
    // Length scoring
    if (password.length >= 8) strength += 1;
    if (password.length >= 12) strength += 1;
    if (password.length >= 16) strength += 1;
    
    // Character diversity scoring
    if (/[a-z]/.test(password)) strength += 1;
    if (/[A-Z]/.test(password)) strength += 1;
    if (/[0-9]/.test(password)) strength += 1;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength += 1;
    
    // Strength levels: 0-3: Weak, 4-5: Medium, 6-7: Strong
    let level = 'weak';
    let score = strength;
    let percentage = Math.round((strength / 7) * 100);
    
    if (strength <= 3) {
      level = 'weak';
    } else if (strength <= 5) {
      level = 'medium';
    } else {
      level = 'strong';
    }
    
    return { level, score, maxScore: 7, percentage };
  }

  // ============================================
  // CHECK PASSWORD HISTORY
  // Prevents reuse of recent passwords
  // ============================================
  async checkPasswordHistory(userId, newPassword) {
    try {
      logger.try('Checking password history', { userId });
      
      const settings = await settingsService.getByCategory('security');
      const historyCount = parseInt(settings.password_history_count) || 5;

      const query = `
        SELECT TOP ${historyCount} password_hash
        FROM password_history
        WHERE user_id = @userId
        ORDER BY changed_at DESC
      `;

      const result = await executeQuery(query, { userId });

      // Check if new password matches any recent passwords
      for (const row of result.recordset) {
        const isMatch = await bcrypt.compare(newPassword, row.password_hash);
        if (isMatch) {
          logger.warn('Password reuse detected', { userId, historyCount });
          return {
            allowed: false,
            message: `Cannot reuse any of your last ${historyCount} passwords`
          };
        }
      }

      logger.success('Password history check passed', { userId });
      return { allowed: true };
    } catch (error) {
      logger.error('Password history check error', error);
      throw error;
    }
  }

  // ============================================
  // SAVE PASSWORD TO HISTORY
  // Records password change for history tracking
  // ============================================
  async savePasswordHistory(userId, passwordHash, changedBy = null, reason = 'MANUAL') {
    try {
      logger.try('Saving password to history', { userId, reason });
      
      const query = `
        INSERT INTO password_history (user_id, password_hash, changed_by, change_reason)
        VALUES (@userId, @passwordHash, @changedBy, @reason)
      `;

      await executeQuery(query, {
        userId,
        passwordHash,
        changedBy: changedBy || userId,
        reason
      });

      logger.success('Password saved to history', { userId, reason });
    } catch (error) {
      logger.error('Save password history error', error);
      throw error;
    }
  }

  // ============================================
  // CHECK PASSWORD EXPIRY
  // Returns expiry status and days remaining
  // ============================================
  async checkPasswordExpiry(userId) {
    try {
      const settings = await settingsService.getByCategory('security');
      const expiryDays = parseInt(settings.password_expiry_days) || 0;

      // If expiry is disabled (0 days), return not expired
      if (expiryDays === 0) {
        return { 
          expired: false, 
          daysRemaining: null,
          expiryEnabled: false
        };
      }

      const query = `
        SELECT 
          password_changed_at,
          password_expires_at,
          DATEDIFF(DAY, GETDATE(), password_expires_at) as days_remaining
        FROM users
        WHERE user_id = @userId
      `;

      const result = await executeQuery(query, { userId });
      
      if (result.recordset.length === 0) {
        return { 
          expired: false, 
          daysRemaining: null,
          expiryEnabled: true
        };
      }

      const row = result.recordset[0];
      const daysRemaining = row.days_remaining || 0;

      const status = {
        expired: daysRemaining <= 0,
        daysRemaining: Math.max(0, daysRemaining),
        expiryEnabled: true,
        passwordChangedAt: row.password_changed_at,
        passwordExpiresAt: row.password_expires_at,
        isWarning: daysRemaining > 0 && daysRemaining <= 7 // Warning within 7 days
      };

      if (status.expired) {
        logger.warn('Password has expired', { userId, daysRemaining });
      } else if (status.isWarning) {
        logger.info('Password expiring soon', { userId, daysRemaining });
      }

      return status;
    } catch (error) {
      logger.error('Check password expiry error', error);
      throw error;
    }
  }

  // ============================================
  // UPDATE PASSWORD EXPIRY DATE
  // Called after successful password change
  // ============================================
  async updatePasswordExpiryDate(userId) {
    try {
      const settings = await settingsService.getByCategory('security');
      const expiryDays = parseInt(settings.password_expiry_days) || 0;

      if (expiryDays === 0) {
        // Expiry disabled, set to NULL
        const query = `
          UPDATE users
          SET password_changed_at = GETDATE(),
              password_expires_at = NULL
          WHERE user_id = @userId
        `;
        await executeQuery(query, { userId });
      } else {
        // Calculate new expiry date
        const query = `
          UPDATE users
          SET password_changed_at = GETDATE(),
              password_expires_at = DATEADD(DAY, @expiryDays, GETDATE())
          WHERE user_id = @userId
        `;
        await executeQuery(query, { userId, expiryDays });
      }

      logger.success('Password expiry date updated', { userId, expiryDays });
    } catch (error) {
      logger.error('Update password expiry error', error);
      throw error;
    }
  }

  // ============================================
  // LOG LOGIN ATTEMPT
  // Records all login attempts (success and failure)
  // ============================================
  async logLoginAttempt(username, userId, ipAddress, userAgent, success, failureReason = null) {
    try {
      const query = `
        INSERT INTO login_attempts (
          username, user_id, ip_address, user_agent, 
          attempt_successful, failure_reason
        )
        VALUES (
          @username, @userId, @ipAddress, @userAgent, 
          @success, @failureReason
        )
      `;

      await executeQuery(query, {
        username,
        userId: userId || null,
        ipAddress,
        userAgent,
        success: success ? 1 : 0,
        failureReason
      });

      if (!success) {
        logger.warn('Failed login attempt logged', { username, ipAddress, failureReason });
      }
    } catch (error) {
      logger.error('Log login attempt error', error);
      // Don't throw - logging failure shouldn't break login flow
    }
  }

  // ============================================
  // CHECK ACCOUNT LOCKOUT
  // Returns lockout status with remaining time
  // ============================================
  async checkAccountLockout(userId) {
    try {
      const query = `
        SELECT 
          is_locked,
          locked_until,
          DATEDIFF(MINUTE, GETDATE(), locked_until) as minutes_remaining
        FROM users
        WHERE user_id = @userId
      `;

      const result = await executeQuery(query, { userId });
      
      if (result.recordset.length === 0) {
        return { locked: false };
      }

      const row = result.recordset[0];

      // If not locked, return immediately
      if (!row.is_locked) {
        return { locked: false };
      }

      // If locked but no expiry time (permanent lock), return locked
      if (!row.locked_until) {
        return { 
          locked: true, 
          permanent: true,
          lockedUntil: null,
          minutesRemaining: null
        };
      }

      const lockedUntil = new Date(row.locked_until);
      const now = new Date();
      const minutesRemaining = row.minutes_remaining;

      // If lockout period has passed, auto-unlock
      if (now >= lockedUntil || minutesRemaining <= 0) {
        await this.unlockAccount(userId);
        logger.info('Account auto-unlocked (lockout expired)', { userId });
        return { locked: false };
      }

      // Still locked
      return {
        locked: true,
        permanent: false,
        lockedUntil: lockedUntil,
        minutesRemaining: Math.max(0, minutesRemaining)
      };
    } catch (error) {
      logger.error('Check account lockout error', error);
      throw error;
    }
  }

  // ============================================
  // LOCK ACCOUNT WITH DURATION
  // Locks account for configured duration (30 mins default)
  // ============================================
  async lockAccount(userId, reason = 'MAX_FAILED_ATTEMPTS') {
    try {
      logger.try('Locking account', { userId, reason });
      
      const settings = await settingsService.getByCategory('security');
      const lockoutMinutes = parseInt(settings.lockout_duration_minutes) || 30;

      const query = `
        UPDATE users
        SET 
          is_locked = 1,
          locked_until = DATEADD(MINUTE, @lockoutMinutes, GETDATE()),
          lockout_count = lockout_count + 1,
          updated_at = GETDATE()
        WHERE user_id = @userId
      `;

      await executeQuery(query, { userId, lockoutMinutes });

      // Log security event
      await this.logSecurityEvent(
        userId, 
        'ACCOUNT_LOCKED', 
        `Account locked for ${lockoutMinutes} minutes. Reason: ${reason}`
      );

      logger.warn('Account locked successfully', { userId, lockoutMinutes, reason });
      
      return { lockoutMinutes };
    } catch (error) {
      logger.error('Lock account error', error);
      throw error;
    }
  }

  // ============================================
  // UNLOCK ACCOUNT
  // Removes lock and resets failed attempts
  // ============================================
  async unlockAccount(userId) {
    try {
      logger.try('Unlocking account', { userId });
      
      const query = `
        UPDATE users
        SET 
          is_locked = 0,
          locked_until = NULL,
          failed_login_attempts = 0,
          updated_at = GETDATE()
        WHERE user_id = @userId
      `;

      await executeQuery(query, { userId });

      // Log security event
      await this.logSecurityEvent(userId, 'ACCOUNT_UNLOCKED', 'Account unlocked');

      logger.success('Account unlocked successfully', { userId });
    } catch (error) {
      logger.error('Unlock account error', error);
      throw error;
    }
  }

  // ============================================
  // HANDLE FAILED LOGIN
  // Increments failed attempts and locks if threshold reached
  // ============================================
  async handleFailedLogin(userId, username, ipAddress) {
    try {
      const settings = await settingsService.getByCategory('security');
      const maxAttempts = parseInt(settings.lockout_attempts) || 5;

      // Get current failed attempts
      const getQuery = `
        SELECT failed_login_attempts
        FROM users
        WHERE user_id = @userId
      `;
      
      const result = await executeQuery(getQuery, { userId });
      const currentAttempts = result.recordset[0].failed_login_attempts || 0;
      const newAttempts = currentAttempts + 1;

      // Update failed attempts and last failed login info
      const updateQuery = `
        UPDATE users
        SET 
          failed_login_attempts = @newAttempts,
          last_failed_login_at = GETDATE(),
          last_failed_login_ip = @ipAddress,
          updated_at = GETDATE()
        WHERE user_id = @userId
      `;

      await executeQuery(updateQuery, { 
        userId, 
        newAttempts,
        ipAddress 
      });

      // Check if threshold reached
      if (newAttempts >= maxAttempts) {
        await this.lockAccount(userId, 'MAX_FAILED_ATTEMPTS');
        
        logger.warn('Account locked due to failed attempts', { 
          userId, 
          username,
          attempts: newAttempts 
        });

        return {
          locked: true,
          attempts: newAttempts,
          maxAttempts: maxAttempts
        };
      }

      logger.info('Failed login attempt recorded', { 
        userId, 
        username,
        attempts: newAttempts,
        remaining: maxAttempts - newAttempts
      });

      return {
        locked: false,
        attempts: newAttempts,
        remaining: maxAttempts - newAttempts,
        maxAttempts: maxAttempts
      };
    } catch (error) {
      logger.error('Handle failed login error', error);
      throw error;
    }
  }

  // ============================================
  // RESET FAILED LOGIN ATTEMPTS
  // Called after successful login
  // ============================================
  async resetFailedLoginAttempts(userId) {
    try {
      const query = `
        UPDATE users
        SET failed_login_attempts = 0
        WHERE user_id = @userId AND failed_login_attempts > 0
      `;

      await executeQuery(query, { userId });
      
      logger.info('Failed login attempts reset', { userId });
    } catch (error) {
      logger.error('Reset failed login attempts error', error);
      // Don't throw - this shouldn't break login flow
    }
  }

  // ============================================
  // CHECK CONCURRENT SESSIONS
  // Returns if user can create new session
  // ============================================
  async checkConcurrentSessions(userId) {
    try {
      const settings = await settingsService.getByCategory('security');
      const maxSessions = parseInt(settings.max_concurrent_sessions) || 1;

      const query = `
        SELECT COUNT(*) as session_count
        FROM user_sessions
        WHERE user_id = @userId 
          AND is_active = 1
          AND expires_at > GETDATE()
      `;

      const result = await executeQuery(query, { userId });
      const sessionCount = result.recordset[0].session_count;

      const status = {
        allowed: sessionCount < maxSessions,
        currentSessions: sessionCount,
        maxSessions: maxSessions,
        needsInvalidation: sessionCount >= maxSessions
      };

      if (!status.allowed) {
        logger.warn('Concurrent session limit reached', { userId, sessionCount, maxSessions });
      }

      return status;
    } catch (error) {
      logger.error('Check concurrent sessions error', error);
      throw error;
    }
  }

  // ============================================
  // INVALIDATE OLDEST SESSION
  // Removes oldest session when limit reached
  // ============================================
  async invalidateOldestSession(userId) {
    try {
      logger.try('Invalidating oldest session', { userId });
      
      const query = `
        UPDATE user_sessions
        SET is_active = 0
        WHERE session_id IN (
          SELECT TOP 1 session_id
          FROM user_sessions
          WHERE user_id = @userId AND is_active = 1
          ORDER BY created_at ASC
        )
      `;

      await executeQuery(query, { userId });
      
      logger.success('Oldest session invalidated', { userId });
    } catch (error) {
      logger.error('Invalidate oldest session error', error);
      throw error;
    }
  }

  // ============================================
  // CHECK IP WHITELIST
  // Returns if IP address is allowed
  // ============================================
  async checkIPWhitelist(userId, ipAddress) {
    try {
      // Skip whitelist check for localhost/development
      if (ipAddress === '::1' || ipAddress === '127.0.0.1' || ipAddress === 'localhost') {
        return { allowed: true, reason: 'localhost' };
      }

      const settings = await settingsService.getByCategory('security');
      const globalWhitelist = settings.ip_whitelist || '';

      // Check global IP whitelist
      if (globalWhitelist && globalWhitelist.trim() !== '') {
        const allowedIPs = globalWhitelist.split(',').map(ip => ip.trim());
        
        if (allowedIPs.length > 0 && !allowedIPs.includes(ipAddress)) {
          logger.warn('IP not in global whitelist', { ipAddress, allowedIPs });
          return {
            allowed: false,
            reason: 'IP not in global whitelist'
          };
        }
      }

      // Check user-specific IP whitelist
      if (userId) {
        const query = `
          SELECT allowed_ip_addresses
          FROM users
          WHERE user_id = @userId
        `;

        const result = await executeQuery(query, { userId });
        
        if (result.recordset.length > 0) {
          const userWhitelist = result.recordset[0].allowed_ip_addresses || '';
          
          if (userWhitelist && userWhitelist.trim() !== '') {
            const allowedIPs = userWhitelist.split(',').map(ip => ip.trim());
            
            if (!allowedIPs.includes(ipAddress)) {
              logger.warn('IP not in user whitelist', { userId, ipAddress, allowedIPs });
              return {
                allowed: false,
                reason: 'IP not in user whitelist'
              };
            }
          }
        }
      }

      return { allowed: true };
    } catch (error) {
      logger.error('Check IP whitelist error', error);
      // On error, allow access (fail open for availability)
      return { allowed: true, reason: 'whitelist check failed' };
    }
  }

  // ============================================
  // LOG SECURITY EVENT
  // Records security-related events for audit
  // ============================================
  async logSecurityEvent(userId, actionType, details, ipAddress = null, userAgent = null, success = true, errorMessage = null) {
    try {
      // Get username if userId provided
      let username = null;
      if (userId) {
        const userQuery = `SELECT username FROM users WHERE user_id = @userId`;
        const userResult = await executeQuery(userQuery, { userId });
        if (userResult.recordset.length > 0) {
          username = userResult.recordset[0].username;
        }
      }

      const query = `
        INSERT INTO security_audit_log (
          user_id, username, action_type, action_details, 
          ip_address, user_agent, success, error_message
        )
        VALUES (
          @userId, @username, @actionType, @details, 
          @ipAddress, @userAgent, @success, @errorMessage
        )
      `;

      await executeQuery(query, {
        userId: userId || null,
        username,
        actionType,
        details,
        ipAddress,
        userAgent,
        success: success ? 1 : 0,
        errorMessage
      });
    } catch (error) {
      logger.error('Log security event error', error);
      // Don't throw - logging failure shouldn't break main flow
    }
  }

  // ============================================
  // GET USER LOGIN HISTORY
  // Returns recent login attempts for user
  // ============================================
  async getUserLoginHistory(userId, limit = 10) {
    try {
      const query = `
        SELECT TOP (@limit)
          attempt_id,
          username,
          ip_address,
          user_agent,
          attempt_successful,
          failure_reason,
          attempted_at
        FROM login_attempts
        WHERE user_id = @userId
        ORDER BY attempted_at DESC
      `;

      const result = await executeQuery(query, { userId, limit });
      return result.recordset;
    } catch (error) {
      logger.error('Get user login history error', error);
      throw error;
    }
  }

  // ============================================
  // GET ACTIVE SESSIONS
  // Returns all active sessions for user
  // ============================================
  async getActiveSessions(userId) {
    try {
      const query = `
        SELECT 
          session_id,
          ip_address,
          user_agent,
          created_at,
          last_activity,
          expires_at
        FROM user_sessions
        WHERE user_id = @userId 
          AND is_active = 1
          AND expires_at > GETDATE()
        ORDER BY last_activity DESC
      `;

      const result = await executeQuery(query, { userId });
      return result.recordset;
    } catch (error) {
      logger.error('Get active sessions error', error);
      throw error;
    }
  }

  // ============================================
  // INVALIDATE SESSION BY ID
  // Logs out specific session
  // ============================================
  async invalidateSession(sessionId, userId) {
    try {
      const query = `
        UPDATE user_sessions
        SET is_active = 0
        WHERE session_id = @sessionId 
          AND user_id = @userId
      `;

      await executeQuery(query, { sessionId, userId });
      
      await this.logSecurityEvent(
        userId, 
        'SESSION_TERMINATED', 
        `Session ${sessionId} manually terminated`
      );

      logger.info('Session invalidated', { sessionId, userId });
    } catch (error) {
      logger.error('Invalidate session error', error);
      throw error;
    }
  }

  // ============================================
  // CHECK SESSION TIMEOUT
  // Validates if session is still within timeout period
  // ============================================
  async checkSessionTimeout(sessionId) {
    try {
      const settings = await settingsService.getByCategory('security');
      const timeoutMinutes = parseInt(settings.session_timeout_minutes) || 480; // 8 hours default

      const query = `
        SELECT 
          session_id,
          user_id,
          last_activity,
          DATEDIFF(MINUTE, last_activity, GETDATE()) as minutes_inactive
        FROM user_sessions
        WHERE session_id = @sessionId
          AND is_active = 1
      `;

      const result = await executeQuery(query, { sessionId });
      
      if (result.recordset.length === 0) {
        return { valid: false, reason: 'session_not_found' };
      }

      const session = result.recordset[0];
      const minutesInactive = session.minutes_inactive;

      if (minutesInactive >= timeoutMinutes) {
        // Session timed out
        await this.invalidateSession(sessionId, session.user_id);
        
        await this.logSecurityEvent(
          session.user_id,
          'SESSION_TIMEOUT',
          `Session timed out after ${minutesInactive} minutes of inactivity`
        );

        return { 
          valid: false, 
          reason: 'timeout',
          minutesInactive: minutesInactive,
          timeoutMinutes: timeoutMinutes
        };
      }

      return { valid: true };
    } catch (error) {
      logger.error('Check session timeout error', error);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new SecurityService();
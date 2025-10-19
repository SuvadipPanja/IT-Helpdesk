// ============================================
// Authentication Controller
// Handles user authentication and session management
// ============================================

const crypto = require('crypto');
const { executeQuery, executeProcedure } = require('../config/database');
const { 
  comparePassword, 
  generateToken, 
  createResponse,
  hashPassword,
} = require('../utils/helpers');
const logger = require('../utils/logger');
const config = require('../config/config');
const { createNotification } = require('./notifications.controller');

/**
 * User Login
 * @route POST /api/v1/auth/login
 * @access Public
 */
const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');

    logger.separator('USER LOGIN ATTEMPT');
    logger.try('User attempting to login', {
      username,
      ip,
      userAgent,
    });

    // Step 1: Check if user exists
    logger.try('Checking if user exists in database');
    
    const userQuery = `
      SELECT 
        u.user_id,
        u.username,
        u.email,
        u.password_hash,
        u.first_name,
        u.last_name,
        u.is_active,
        u.is_locked,
        u.failed_login_attempts,
        u.role_id,
        u.department_id,
        r.role_name,
        r.role_code,
        r.can_create_tickets,
        r.can_view_all_tickets,
        r.can_assign_tickets,
        r.can_close_tickets,
        r.can_delete_tickets,
        r.can_manage_users,
        r.can_manage_departments,
        r.can_manage_roles,
        r.can_view_analytics,
        r.can_manage_system,
        d.department_name
      FROM users u
      LEFT JOIN user_roles r ON u.role_id = r.role_id
      LEFT JOIN departments d ON u.department_id = d.department_id
      WHERE u.username = @username OR u.email = @username
    `;

    const userResult = await executeQuery(userQuery, { username });

    if (userResult.recordset.length === 0) {
      logger.warn('Login failed - User not found', { username, ip });
      logger.separator();
      return res.status(401).json(
        createResponse(false, 'Invalid username or password')
      );
    }

    const user = userResult.recordset[0];
    logger.success('User found in database', {
      userId: user.user_id,
      username: user.username,
    });

    // Step 2: Check if account is locked
    if (user.is_locked) {
      logger.warn('Login failed - Account is locked', {
        userId: user.user_id,
        username: user.username,
        ip,
      });
      logger.separator();
      return res.status(403).json(
        createResponse(false, 'Your account has been locked. Please contact administrator.')
      );
    }

    // Step 3: Check if account is active
    if (!user.is_active) {
      logger.warn('Login failed - Account is inactive', {
        userId: user.user_id,
        username: user.username,
        ip,
      });
      logger.separator();
      return res.status(403).json(
        createResponse(false, 'Your account has been deactivated. Please contact administrator.')
      );
    }

    // Step 4: Verify password
    logger.try('Verifying password');
    
    const isPasswordValid = await comparePassword(password, user.password_hash);

    if (!isPasswordValid) {
      // Increment failed login attempts
      const failedAttempts = user.failed_login_attempts + 1;
      const shouldLock = failedAttempts >= 5;

      logger.warn('Login failed - Invalid password', {
        userId: user.user_id,
        username: user.username,
        failedAttempts,
        willLock: shouldLock,
        ip,
      });

      const updateQuery = `
        UPDATE users
        SET 
          failed_login_attempts = @failedAttempts,
          is_locked = @isLocked,
          updated_at = GETDATE()
        WHERE user_id = @userId
      `;

      await executeQuery(updateQuery, {
        failedAttempts,
        isLocked: shouldLock ? 1 : 0,
        userId: user.user_id,
      });

      if (shouldLock) {
        logger.error('Account locked due to multiple failed attempts', {
          userId: user.user_id,
          username: user.username,
          failedAttempts,
        });
      }

      logger.separator();
      return res.status(401).json(
        createResponse(
          false,
          shouldLock
            ? 'Account locked due to multiple failed login attempts. Please contact administrator.'
            : 'Invalid username or password'
        )
      );
    }

    logger.success('Password verified successfully');

    // Step 5: Reset failed login attempts
    if (user.failed_login_attempts > 0) {
      logger.info('Resetting failed login attempts');
      
      await executeQuery(
        'UPDATE users SET failed_login_attempts = 0 WHERE user_id = @userId',
        { userId: user.user_id }
      );
    }

    // Step 6: Generate JWT token
    logger.try('Generating JWT token');
    
    const tokenPayload = {
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      role_code: user.role_code,
    };

    const token = generateToken(tokenPayload, config.jwt.expire);
    
    logger.success('JWT token generated successfully');

    // Step 7: Create session record
    logger.try('Creating user session record');
    
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 8); // 8 hours from now

    const sessionQuery = `
      INSERT INTO user_sessions (
        user_id, token_hash, ip_address, user_agent,
        expires_at, is_active
      )
      VALUES (
        @userId, @tokenHash, @ipAddress, @userAgent,
        @expiresAt, 1
      )
    `;

    await executeQuery(sessionQuery, {
      userId: user.user_id,
      tokenHash,
      ipAddress: ip,
      userAgent,
      expiresAt,
    });

    logger.success('Session record created');

    // Step 8: Update last login time
    logger.try('Updating last login timestamp');
    
    await executeQuery(
      'UPDATE users SET last_login = GETDATE() WHERE user_id = @userId',
      { userId: user.user_id }
    );

    logger.success('Last login timestamp updated');

    // Step 9: Create notification for login
    logger.try('Creating login notification');
    
    // Create login notification with username
    await createNotification(
      user.user_id,
      'LOGIN',
      'New Login',
      `User "${user.username}" (${user.full_name}) logged in successfully from ${req.ip || '::1'}`,
      null
    );
	
    logger.success('Login notification created');

    // Step 10: Prepare response data
    const userData = {
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      full_name: `${user.first_name} ${user.last_name}`,
      role: {
        role_id: user.role_id,
        role_name: user.role_name,
        role_code: user.role_code,
      },
      department: user.department_id ? {
        department_id: user.department_id,
        department_name: user.department_name,
      } : null,
      permissions: {
        can_create_tickets: user.can_create_tickets,
        can_view_all_tickets: user.can_view_all_tickets,
        can_assign_tickets: user.can_assign_tickets,
        can_close_tickets: user.can_close_tickets,
        can_delete_tickets: user.can_delete_tickets,
        can_manage_users: user.can_manage_users,
        can_manage_departments: user.can_manage_departments,
        can_manage_roles: user.can_manage_roles,
        can_view_analytics: user.can_view_analytics,
        can_manage_system: user.can_manage_system,
      },
    };

    logger.separator('LOGIN SUCCESSFUL');
    logger.success('User logged in successfully', {
      userId: user.user_id,
      username: user.username,
      role: user.role_name,
      ip,
    });
    logger.separator();

    return res.status(200).json(
      createResponse(true, 'Login successful', {
        token,
        user: userData,
      })
    );
  } catch (error) {
    logger.error('Login controller error', error);
    logger.separator();
    next(error);
  }
};

/**
 * User Logout
 * @route POST /api/v1/auth/logout
 * @access Private
 */
const logout = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const token = req.headers.authorization.substring(7);

    logger.separator('USER LOGOUT');
    logger.try('User attempting to logout', {
      userId,
      username: req.user.username,
    });

    // Invalidate session
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const logoutQuery = `
      UPDATE user_sessions
      SET is_active = 0
      WHERE user_id = @userId AND token_hash = @tokenHash
    `;

    await executeQuery(logoutQuery, {
      userId,
      tokenHash,
    });

    logger.success('User session invalidated', {
      userId,
      username: req.user.username,
    });
    logger.separator();

    return res.status(200).json(
      createResponse(true, 'Logout successful')
    );
  } catch (error) {
    logger.error('Logout controller error', error);
    logger.separator();
    next(error);
  }
};

/**
 * Get Current User Profile
 * @route GET /api/v1/auth/me
 * @access Private
 */
const getMe = async (req, res, next) => {
  try {
    logger.info('Fetching current user profile', {
      userId: req.user.user_id,
      username: req.user.username,
    });

    const userQuery = `
      SELECT 
        u.user_id,
        u.username,
        u.email,
        u.first_name,
        u.last_name,
        u.phone_number,
        u.profile_picture,
        u.last_login,
        u.created_at,
        r.role_id,
        r.role_name,
        r.role_code,
        r.can_create_tickets,
        r.can_view_all_tickets,
        r.can_assign_tickets,
        r.can_close_tickets,
        r.can_delete_tickets,
        r.can_manage_users,
        r.can_manage_departments,
        r.can_manage_roles,
        r.can_view_analytics,
        r.can_manage_system,
        d.department_id,
        d.department_name,
        d.department_code
      FROM users u
      LEFT JOIN user_roles r ON u.role_id = r.role_id
      LEFT JOIN departments d ON u.department_id = d.department_id
      WHERE u.user_id = @userId
    `;

    const result = await executeQuery(userQuery, {
      userId: req.user.user_id,
    });

    if (result.recordset.length === 0) {
      logger.warn('User not found', { userId: req.user.user_id });
      return res.status(404).json(
        createResponse(false, 'User not found')
      );
    }

    const user = result.recordset[0];

    const userData = {
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      full_name: `${user.first_name} ${user.last_name}`,
      phone_number: user.phone_number,
      profile_picture: user.profile_picture,
      last_login: user.last_login,
      created_at: user.created_at,
      role: {
        role_id: user.role_id,
        role_name: user.role_name,
        role_code: user.role_code,
      },
      department: user.department_id ? {
        department_id: user.department_id,
        department_name: user.department_name,
        department_code: user.department_code,
      } : null,
      permissions: {
        can_create_tickets: user.can_create_tickets,
        can_view_all_tickets: user.can_view_all_tickets,
        can_assign_tickets: user.can_assign_tickets,
        can_close_tickets: user.can_close_tickets,
        can_delete_tickets: user.can_delete_tickets,
        can_manage_users: user.can_manage_users,
        can_manage_departments: user.can_manage_departments,
        can_manage_roles: user.can_manage_roles,
        can_view_analytics: user.can_view_analytics,
        can_manage_system: user.can_manage_system,
      },
    };

    logger.success('User profile fetched successfully', {
      userId: user.user_id,
      username: user.username,
    });

    return res.status(200).json(
      createResponse(true, 'User profile fetched successfully', userData)
    );
  } catch (error) {
    logger.error('Get me controller error', error);
    next(error);
  }
};

/**
 * Change Password
 * @route PUT /api/v1/auth/change-password
 * @access Private
 */
const changePassword = async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    const userId = req.user.user_id;

    logger.separator('PASSWORD CHANGE');
    logger.try('User attempting to change password', {
      userId,
      username: req.user.username,
    });

    // Get current password hash
    const userQuery = `
      SELECT password_hash
      FROM users
      WHERE user_id = @userId
    `;

    const userResult = await executeQuery(userQuery, { userId });

    if (userResult.recordset.length === 0) {
      logger.warn('User not found', { userId });
      logger.separator();
      return res.status(404).json(
        createResponse(false, 'User not found')
      );
    }

    const user = userResult.recordset[0];

    // Verify current password
    logger.try('Verifying current password');
    
    const isCurrentPasswordValid = await comparePassword(
      current_password,
      user.password_hash
    );

    if (!isCurrentPasswordValid) {
      logger.warn('Password change failed - Current password incorrect', {
        userId,
        username: req.user.username,
      });
      logger.separator();
      return res.status(401).json(
        createResponse(false, 'Current password is incorrect')
      );
    }

    logger.success('Current password verified');

    // Hash new password
    logger.try('Hashing new password');
    
    const newPasswordHash = await hashPassword(new_password);
    
    logger.success('New password hashed');

    // Update password
    logger.try('Updating password in database');
    
    const updateQuery = `
      UPDATE users
      SET 
        password_hash = @passwordHash,
        updated_at = GETDATE(),
        updated_by = @userId
      WHERE user_id = @userId
    `;

    await executeQuery(updateQuery, {
      passwordHash: newPasswordHash,
      userId,
    });

    logger.success('Password updated successfully');

    // Invalidate all sessions except current
    logger.try('Invalidating other user sessions');
    
    const currentToken = req.headers.authorization.substring(7);
    const currentTokenHash = crypto.createHash('sha256').update(currentToken).digest('hex');

    const invalidateQuery = `
      UPDATE user_sessions
      SET is_active = 0
      WHERE user_id = @userId AND token_hash != @currentTokenHash
    `;

    await executeQuery(invalidateQuery, {
      userId,
      currentTokenHash,
    });

    logger.success('Other sessions invalidated');

    // Create notification
    await executeProcedure('sp_CreateNotification', {
      input: {
        user_id: userId,
        notification_type: 'PASSWORD_CHANGED',
        title: 'Password Changed',
        message: 'Your password has been changed successfully',
        related_ticket_id: null,
      },
    });

    logger.separator('PASSWORD CHANGE SUCCESSFUL');
    logger.success('Password changed successfully', {
      userId,
      username: req.user.username,
    });
    logger.separator();

    return res.status(200).json(
      createResponse(true, 'Password changed successfully')
    );
  } catch (error) {
    logger.error('Change password controller error', error);
    logger.separator();
    next(error);
  }
};

module.exports = {
  login,
  logout,
  getMe,
  changePassword,
}; 

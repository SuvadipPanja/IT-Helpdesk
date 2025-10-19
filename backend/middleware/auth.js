// ============================================
// Authentication Middleware (ENHANCED)
// Verifies JWT tokens and checks permissions
// FIXED: Better permission loading and debugging
// ============================================

const { verifyToken } = require('../utils/helpers');
const { createResponse } = require('../utils/helpers');
const logger = require('../utils/logger');
const { executeQuery } = require('../config/database');

/**
 * Verify JWT token from request headers
 */
const authenticate = async (req, res, next) => {
  try {
    logger.try('Authenticating request', {
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
    });

    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Authentication failed - No token provided', {
        url: req.originalUrl,
        ip: req.ip,
      });
      return res.status(401).json(
        createResponse(false, 'Access denied. No token provided.')
      );
    }

    // Extract token
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = verifyToken(token);

    // Check if session exists and is active
    logger.try('Checking user session validity', { userId: decoded.user_id });

    const sessionQuery = `
      SELECT 
        us.session_id,
        us.user_id,
        us.is_active,
        us.expires_at,
        u.is_active as user_is_active,
        u.is_locked as user_is_locked
      FROM user_sessions us
      INNER JOIN users u ON us.user_id = u.user_id
      WHERE us.user_id = @userId
        AND us.token_hash = @tokenHash
        AND us.is_active = 1
        AND us.expires_at > GETDATE()
    `;

    // Create a simple hash of the token for comparison
    const crypto = require('crypto');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const sessionResult = await executeQuery(sessionQuery, {
      userId: decoded.user_id,
      tokenHash: tokenHash,
    });

    if (sessionResult.recordset.length === 0) {
      logger.warn('Authentication failed - Invalid or expired session', {
        userId: decoded.user_id,
        ip: req.ip,
      });
      return res.status(401).json(
        createResponse(false, 'Invalid or expired session. Please login again.')
      );
    }

    const session = sessionResult.recordset[0];

    // Check if user account is active
    if (!session.user_is_active) {
      logger.warn('Authentication failed - User account is inactive', {
        userId: decoded.user_id,
        ip: req.ip,
      });
      return res.status(403).json(
        createResponse(false, 'Your account has been deactivated.')
      );
    }

    // Check if user account is locked
    if (session.user_is_locked) {
      logger.warn('Authentication failed - User account is locked', {
        userId: decoded.user_id,
        ip: req.ip,
      });
      return res.status(403).json(
        createResponse(false, 'Your account has been locked. Please contact administrator.')
      );
    }

    // Update last activity
    const updateActivityQuery = `
      UPDATE user_sessions
      SET last_activity = GETDATE()
      WHERE session_id = @sessionId
    `;

    await executeQuery(updateActivityQuery, {
      sessionId: session.session_id,
    });

    // Get user details with ALL role permissions dynamically
    logger.try('Fetching user details with permissions', {
      userId: decoded.user_id,
    });

    const userQuery = `
      SELECT 
        u.user_id,
        u.username,
        u.email,
        u.first_name,
        u.last_name,
        u.role_id,
        u.department_id,
        r.role_id as role_table_id,
        r.role_name,
        r.role_code,
        r.description as role_description,
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
        r.is_active as role_is_active,
        r.is_system_role
      FROM users u
      INNER JOIN user_roles r ON u.role_id = r.role_id
      WHERE u.user_id = @userId
    `;

    const userResult = await executeQuery(userQuery, {
      userId: decoded.user_id,
    });

    if (userResult.recordset.length === 0) {
      logger.error('Authentication failed - User not found', {
        userId: decoded.user_id,
        ip: req.ip,
      });
      return res.status(401).json(
        createResponse(false, 'User not found.')
      );
    }

    const userData = userResult.recordset[0];

    // Build permissions object dynamically from ALL columns that start with 'can_'
    const permissions = {};
    Object.keys(userData).forEach(key => {
      if (key.startsWith('can_')) {
        // Convert to boolean explicitly
        permissions[key] = userData[key] === 1 || userData[key] === true || userData[key] === '1';
      }
    });

    // Log permissions for debugging (IMPORTANT!)
    logger.info('🔐 User permissions loaded', {
      userId: userData.user_id,
      username: userData.username,
      role: userData.role_name,
      roleCode: userData.role_code,
      permissions: permissions,
      permissionCount: Object.keys(permissions).length
    });

    // Attach user to request
    req.user = {
      user_id: userData.user_id,
      username: userData.username,
      email: userData.email,
      first_name: userData.first_name,
      last_name: userData.last_name,
      full_name: `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || userData.username,
      role_id: userData.role_id,
      department_id: userData.department_id,
      
      role: {
        role_id: userData.role_id,
        role_name: userData.role_name,
        role_code: userData.role_code,
        description: userData.role_description,
        is_system_role: userData.is_system_role
      },
      
      permissions: permissions
    };
    
    req.session = session;

    logger.success('✅ User authenticated successfully', {
      userId: req.user.user_id,
      username: req.user.username,
      role: req.user.role.role_name,
      roleCode: req.user.role.role_code,
      permissionsCount: Object.keys(permissions).length,
      hasManageUsers: permissions.can_manage_users,
      url: req.originalUrl,
    });

    next();
  } catch (error) {
    logger.error('Authentication middleware error', error);
    return res.status(401).json(
      createResponse(false, 'Invalid token. Please login again.')
    );
  }
};

/**
 * Check if user has specific permission
 * @param {string} permission - Permission name (e.g., 'can_manage_users')
 */
const authorize = (permission) => {
  return (req, res, next) => {
    logger.try(`🔒 Checking authorization for permission: ${permission}`, {
      userId: req.user?.user_id,
      username: req.user?.username,
      role: req.user?.role?.role_name,
      roleCode: req.user?.role?.role_code,
    });

    if (!req.user) {
      logger.warn('❌ Authorization failed - User not authenticated', {
        permission,
        url: req.originalUrl,
      });
      return res.status(401).json(
        createResponse(false, 'Authentication required.')
      );
    }

    // Check in permissions object
    const hasPermission = req.user.permissions && req.user.permissions[permission];

    if (!hasPermission) {
      logger.warn('❌ Authorization failed - Insufficient permissions', {
        userId: req.user.user_id,
        username: req.user.username,
        role: req.user.role?.role_name,
        roleCode: req.user.role?.role_code,
        requiredPermission: permission,
        hasPermission: hasPermission,
        allPermissions: req.user.permissions,
        url: req.originalUrl,
      });
      return res.status(403).json(
        createResponse(false, 'You do not have permission to perform this action.')
      );
    }

    logger.success('✅ Authorization successful', {
      userId: req.user.user_id,
      username: req.user.username,
      role: req.user.role?.role_name,
      permission,
      hasPermission: hasPermission,
    });

    next();
  };
};

/**
 * Check if user has any of the specified roles
 * @param {Array<string>} roles - Array of role codes (e.g., ['ADMIN', 'MANAGER'])
 */
const authorizeRoles = (roles) => {
  return (req, res, next) => {
    logger.try(`🔒 Checking authorization for roles: ${roles.join(', ')}`, {
      userId: req.user?.user_id,
      username: req.user?.username,
      userRole: req.user?.role?.role_code,
    });

    if (!req.user) {
      logger.warn('❌ Authorization failed - User not authenticated', {
        requiredRoles: roles,
        url: req.originalUrl,
      });
      return res.status(401).json(
        createResponse(false, 'Authentication required.')
      );
    }

    if (!roles.includes(req.user.role?.role_code)) {
      logger.warn('❌ Authorization failed - Insufficient role', {
        userId: req.user.user_id,
        username: req.user.username,
        userRole: req.user.role?.role_code,
        requiredRoles: roles,
        url: req.originalUrl,
      });
      return res.status(403).json(
        createResponse(false, `Access restricted to: ${roles.join(', ')}`)
      );
    }

    logger.success('✅ Role authorization successful', {
      userId: req.user.user_id,
      username: req.user.username,
      userRole: req.user.role?.role_code,
    });

    next();
  };
};

/**
 * Optional authentication - Doesn't fail if no token
 * Used for endpoints that work with or without authentication
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyToken(token);

      const userQuery = `
        SELECT 
          u.user_id,
          u.username,
          u.email,
          u.first_name,
          u.last_name,
          u.role_id,
          r.role_name,
          r.role_code
        FROM users u
        INNER JOIN user_roles r ON u.role_id = r.role_id
        WHERE u.user_id = @userId AND u.is_active = 1
      `;

      const userResult = await executeQuery(userQuery, {
        userId: decoded.user_id,
      });

      if (userResult.recordset.length > 0) {
        const userData = userResult.recordset[0];
        req.user = {
          user_id: userData.user_id,
          username: userData.username,
          email: userData.email,
          first_name: userData.first_name,
          last_name: userData.last_name,
          role_id: userData.role_id,
          role: {
            role_name: userData.role_name,
            role_code: userData.role_code
          }
        };
        logger.info('Optional auth - User identified', {
          userId: req.user.user_id,
        });
      }
    }

    next();
  } catch (error) {
    // Continue without authentication
    logger.debug('Optional auth - Continuing without authentication');
    next();
  }
};

module.exports = {
  authenticate,
  authorize,
  authorizeRoles,
  optionalAuth,
};
// ============================================
// USERS CONTROLLER - COMPLETE WITH PROFILE PICTURES & PASSWORD EXPIRY
// Handles user management operations
// Developer: Suvadip Panja
// Updated: January 26, 2026
// ============================================

const { executeQuery } = require('../config/database');
const cacheService = require('../services/cache.service');
const config = require('../config/config');
const { createResponse, getPaginationMeta } = require('../utils/helpers');
const logger = require('../utils/logger');
const bcrypt = require('bcryptjs');
const securityService = require('../services/security.service');
const { whitelistUser } = require('../middleware/rateLimiter');
const licenseService = require('../services/license.service');
const { getClientIp } = require('../utils/clientIp');

const PROTECTED_ADMIN_USERNAME = 'admin';
const PROTECTED_ADMIN_ROLE_CODE = 'ADMIN';

const normalizeValue = (value) => String(value || '').trim().toLowerCase();
const isProtectedAdminUsername = (username) => normalizeValue(username) === PROTECTED_ADMIN_USERNAME;
const isProtectedAdminRoleCode = (roleCode) => String(roleCode || '').trim().toUpperCase() === PROTECTED_ADMIN_ROLE_CODE;

const getRoleRecordById = async (roleId) => {
  const result = await executeQuery(
    `SELECT role_id, role_name, role_code
     FROM user_roles
     WHERE role_id = @roleId`,
    { roleId }
  );

  return result.recordset[0] || null;
};

/**
 * Get all users with pagination and filters
 * @route GET /api/v1/users
 * @access Private (Admin only)
 */
const getUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const role_id = req.query.role_id || null;
    const department_id = req.query.department_id || null;
    const is_active = req.query.is_active || null;

    const offset = (page - 1) * limit;

    logger.try('Fetching users list', {
      page,
      limit,
      filters: { role_id, department_id, is_active },
      userId: req.user.user_id,
      hasPermission: req.user.permissions?.can_manage_users
    });

    // Check permission from permissions object
    if (!req.user.permissions || !req.user.permissions.can_manage_users) {
      logger.warn('Unauthorized access attempt to users list', {
        userId: req.user.user_id,
        username: req.user.username,
        hasPermissions: !!req.user.permissions,
        canManageUsers: req.user.permissions?.can_manage_users
      });
      return res.status(403).json(
        createResponse(false, 'You do not have permission to manage users')
      );
    }

    // Build WHERE clause
    let whereConditions = [];
    let params = {};

    if (search) {
      whereConditions.push(`(
        u.username LIKE '%' + @search + '%' OR 
        u.email LIKE '%' + @search + '%' OR 
        u.first_name LIKE '%' + @search + '%' OR 
        u.last_name LIKE '%' + @search + '%'
      )`);
      params.search = search;
    }

    if (role_id) {
      whereConditions.push('u.role_id = @roleId');
      params.roleId = role_id;
    }

    if (department_id) {
      whereConditions.push('u.department_id = @departmentId');
      params.departmentId = department_id;
    }

    if (is_active !== null) {
      whereConditions.push('u.is_active = @isActive');
      params.isActive = is_active === 'true' ? 1 : 0;
    }

    const whereClause = whereConditions.length > 0
      ? 'WHERE ' + whereConditions.join(' AND ')
      : '';

    // Get total count (filtered) + global stats (unfiltered)
    const countQuery = `
      SELECT COUNT(*) as total
      FROM users u
      ${whereClause}
    `;

    const globalStatsQuery = `
      SELECT
        COUNT(*) as total_count,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_count,
        SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive_count,
        SUM(CASE WHEN is_locked = 1 OR failed_login_attempts > 0 THEN 1 ELSE 0 END) as locked_count
      FROM users
    `;

    const [countResult, globalStatsResult] = await Promise.all([
      executeQuery(countQuery, params),
      executeQuery(globalStatsQuery),
    ]);
    const totalRecords = countResult.recordset[0].total;
    const globalStats = globalStatsResult.recordset[0] || {};

    // ⭐ FIXED: Added password_expires_at, profile_picture, AND lock status to SELECT
    const usersQuery = `
      SELECT 
        u.user_id,
        u.username,
        u.email,
        u.first_name,
        u.last_name,
        u.first_name + ' ' + u.last_name as full_name,
        u.phone_number,
        u.is_active,
        u.is_locked,
        u.locked_until,
        u.failed_login_attempts,
        u.created_at,
        u.last_login,
        u.password_expires_at,
        u.profile_picture,
        
        r.role_id,
        r.role_name,
        r.role_code,
        
        d.department_id,
        d.department_name,
        d.department_code,

        l.location_id,
        l.location_name,
        
        p.process_id,
        p.process_name,
        
        (SELECT COUNT(*) FROM tickets WHERE requester_id = u.user_id) as tickets_created,
        (SELECT COUNT(*) FROM tickets WHERE assigned_to = u.user_id) as tickets_assigned
        
      FROM users u
      LEFT JOIN user_roles r ON u.role_id = r.role_id
      LEFT JOIN departments d ON u.department_id = d.department_id
      LEFT JOIN locations l ON u.location_id = l.location_id
      LEFT JOIN processes p ON u.process_id = p.process_id
      ${whereClause}
      ORDER BY u.created_at DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `;

    const usersResult = await executeQuery(usersQuery, {
      ...params,
      offset,
      limit,
    });

    const paginationMeta = getPaginationMeta(totalRecords, page, limit);

    logger.success('Users list fetched successfully', {
      totalRecords,
      returnedRecords: usersResult.recordset.length,
      page,
    });

    return res.status(200).json({
      success: true,
      message: 'Users fetched successfully',
      data: {
        users: usersResult.recordset,
        pagination: paginationMeta,
        stats: {
          total: globalStats.total_count || 0,
          active: globalStats.active_count || 0,
          inactive: globalStats.inactive_count || 0,
          locked: globalStats.locked_count || 0,
        },
      },
    });
  } catch (error) {
    logger.error('Get users error', error);
    next(error);
  }
};

/**
 * Get single user by ID
 * @route GET /api/v1/users/:id
 * @access Private (Admin only)
 */
const getUserById = async (req, res, next) => {
  try {
    const userId = req.params.id;

    logger.try('Fetching user details', { userId });

    // Check permission
    if (!req.user.permissions?.can_manage_users && req.user.user_id !== parseInt(userId)) {
      logger.warn('Unauthorized access attempt', {
        requesterId: req.user.user_id,
        targetUserId: userId,
      });
      return res.status(403).json(
        createResponse(false, 'You do not have permission to view this user')
      );
    }

    const query = `
      SELECT 
        u.user_id,
        u.username,
        u.email,
        u.first_name,
        u.last_name,
        u.first_name + ' ' + u.last_name as full_name,
        u.phone_number,
        u.profile_picture,
        u.is_active,
        u.is_locked,
        u.created_at,
        u.last_login,
        u.password_expires_at,
        
        r.role_id,
        r.role_name,
        r.role_code,
        
        d.department_id,
        d.department_name,
        d.department_code,
        
        l.location_id,
        l.location_name,
        
        p.process_id,
        p.process_name,
        
        (SELECT COUNT(*) FROM tickets WHERE requester_id = u.user_id) as tickets_created,
        (SELECT COUNT(*) FROM tickets WHERE assigned_to = u.user_id) as tickets_assigned,
        (SELECT COUNT(*) FROM tickets WHERE requester_id = u.user_id AND status_id IN (SELECT status_id FROM ticket_statuses WHERE status_code = 'OPEN')) as open_tickets
        
      FROM users u
      LEFT JOIN user_roles r ON u.role_id = r.role_id
      LEFT JOIN departments d ON u.department_id = d.department_id
      LEFT JOIN locations l ON u.location_id = l.location_id
      LEFT JOIN processes p ON u.process_id = p.process_id
      WHERE u.user_id = @userId
    `;

    const result = await executeQuery(query, { userId });

    if (result.recordset.length === 0) {
      return res.status(404).json(
        createResponse(false, 'User not found')
      );
    }

    logger.success('User details fetched', { userId });

    return res.status(200).json(
      createResponse(true, 'User fetched successfully', result.recordset[0])
    );
  } catch (error) {
    logger.error('Get user by ID error', error);
    next(error);
  }
};

/**
 * Create new user
 * @route POST /api/v1/users
 * @access Private (Admin only)
 */
const createUser = async (req, res, next) => {
  try {
    const {
      username,
      email,
      password,
      first_name,
      last_name,
      phone_number,
      role_id,
      department_id,
      location_id,
      process_id,
    } = req.body;

    logger.separator('USER CREATION');
    logger.try('Creating new user', {
      username,
      email,
      createdBy: req.user.user_id,
    });

    // Check permission
    if (!req.user.permissions || !req.user.permissions.can_manage_users) {
      logger.warn('Unauthorized user creation attempt', {
        userId: req.user.user_id,
      });
      logger.separator();
      return res.status(403).json(
        createResponse(false, 'You do not have permission to create users')
      );
    }

    // Validate required fields
    if (!username || !email || !password || !first_name || !last_name || !role_id) {
      logger.warn('Missing required fields');
      logger.separator();
      return res.status(400).json(
        createResponse(false, 'Username, email, password, first name, last name, and role are required')
      );
    }

    // Validate location_id (mandatory)
    if (!location_id) {
      logger.warn('Missing location_id');
      logger.separator();
      return res.status(400).json(
        createResponse(false, 'Location is required')
      );
    }

    if (isProtectedAdminUsername(username)) {
      logger.warn('Reserved admin username rejected during user creation', { username });
      logger.separator();
      return res.status(403).json(
        createResponse(false, 'The admin username is reserved for the protected Administrator account')
      );
    }

    const requestedRole = await getRoleRecordById(role_id);
    if (!requestedRole) {
      logger.warn('Invalid role selected during user creation', { role_id });
      logger.separator();
      return res.status(400).json(
        createResponse(false, 'Selected role is invalid')
      );
    }

    if (isProtectedAdminRoleCode(requestedRole.role_code)) {
      logger.warn('Attempt to assign ADMIN role to a non-admin account during creation', {
        username,
        roleId: role_id,
      });
      logger.separator();
      return res.status(403).json(
        createResponse(false, 'Administrator role can only be assigned to the protected admin account')
      );
    }

    // Check if username already exists
    const usernameCheck = await executeQuery(
      'SELECT user_id FROM users WHERE username = @username',
      { username }
    );

    if (usernameCheck.recordset.length > 0) {
      logger.warn('Username already exists', { username });
      logger.separator();
      return res.status(400).json(
        createResponse(false, 'Username already exists')
      );
    }

    // Check if email already exists
    const emailCheck = await executeQuery(
      'SELECT user_id FROM users WHERE email = @email',
      { email }
    );

    if (emailCheck.recordset.length > 0) {
      logger.warn('Email already exists', { email });
      logger.separator();
      return res.status(400).json(
        createResponse(false, 'Email already exists')
      );
    }

    // Hash password
    const seatCheck = await licenseService.assertActiveUserSeatAvailable();
    if (!seatCheck.allowed) {
      logger.warn('User creation blocked by license active-user limit', {
        current: seatCheck.current,
        limit: seatCheck.limit,
      });
      logger.separator();
      return res.status(403).json(
        createResponse(false, seatCheck.message, {
          code: seatCheck.code,
          current: seatCheck.current,
          limit: seatCheck.limit,
        })
      );
    }

    // Hash password
    logger.try('Hashing password');
    const hashedPassword = await bcrypt.hash(password, config.security.bcryptRounds);
    logger.success('Password hashed');

    // Insert user
    logger.try('Inserting user into database');

    const insertQuery = `
      INSERT INTO users (
        username, email, password_hash,
        first_name, last_name, phone_number,
        role_id, department_id, is_active,
        location_id, process_id
      )
      OUTPUT INSERTED.user_id
      VALUES (
        @username, @email, @passwordHash,
        @firstName, @lastName, @phoneNumber,
        @roleId, @departmentId, 1,
        @locationId, @processId
      )
    `;

    const insertResult = await executeQuery(insertQuery, {
      username,
      email,
      passwordHash: hashedPassword,
      firstName: first_name,
      lastName: last_name,
      phoneNumber: phone_number || null,
      roleId: role_id,
      departmentId: department_id || null,
      locationId: location_id ? parseInt(location_id) : null,
      processId: process_id ? parseInt(process_id) : null,
    });

    const newUserId = insertResult.recordset[0].user_id;

    // ⭐ NEW: Set initial password_changed_at and password_expires_at
    // This ensures new users have password tracking from day one
    logger.try('Setting initial password expiry date for new user');
    await securityService.updatePasswordExpiryDate(newUserId);
    logger.success('Initial password expiry date set');

    // ⭐ NEW: Save initial password to history
    logger.try('Saving initial password to history');
    await securityService.savePasswordHistory(newUserId, hashedPassword, req.user.user_id, 'CREATED');
    logger.success('Initial password saved to history');

    // 📢 NEW: Set default outage access for new user
    try {
      const outageService = require('../services/outageNotificationService');
      const roleRecord = await getRoleRecordById(role_id);
      const roleCode = roleRecord ? roleRecord.role_code : '';
      await outageService.setUserAccess(
        newUserId,
        {
          can_view_wall: true,
          can_publish: ['ADMIN', 'CENTRAL_MGMT'].includes(roleCode),
          can_manage: roleCode === 'ADMIN',
        },
        req.user.user_id
      );
    } catch (oErr) {
      logger.warn('Could not set default outage access for new user', { userId: newUserId, error: oErr.message });
    }

    logger.success('User created successfully', {
      userId: newUserId,
      username,
    });
    logger.separator();

    return res.status(201).json(
      createResponse(true, 'User created successfully', {
        user_id: newUserId,
      })
    );
  } catch (error) {
    logger.error('Create user error', error);
    logger.separator();
    next(error);
  }
};

/**
 * Update user
 * @route PUT /api/v1/users/:id
 * @access Private (Admin only)
 */
const updateUser = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const {
      username,
      email,
      first_name,
      last_name,
      phone_number,
      role_id,
      department_id,
      is_active,
      password, // ⭐ ADD PASSWORD FIELD
      location_id,
      process_id,
    } = req.body;

    logger.separator('USER UPDATE');
    logger.try('Updating user', {
      userId,
      updatedBy: req.user.user_id,
      hasPassword: !!password, // Log if password is being updated
    });

    // Check permission
    if (!req.user.permissions || !req.user.permissions.can_manage_users) {
      logger.warn('Unauthorized user update attempt', {
        userId: req.user.user_id,
      });
      logger.separator();
      return res.status(403).json(
        createResponse(false, 'You do not have permission to update users')
      );
    }

    // Check if user exists
    const userCheck = await executeQuery(
      `SELECT u.user_id, u.is_active, u.username, u.role_id, r.role_code
       FROM users u
       LEFT JOIN user_roles r ON u.role_id = r.role_id
       WHERE u.user_id = @userId`,
      { userId }
    );

    if (userCheck.recordset.length === 0) {
      logger.warn('User not found', { userId });
      logger.separator();
      return res.status(404).json(
        createResponse(false, 'User not found')
      );
    }

    const existingUser = userCheck.recordset[0];
    const isProtectedAdminAccount = isProtectedAdminUsername(existingUser.username);

    if (username && isProtectedAdminUsername(username) && !isProtectedAdminAccount) {
      logger.warn('Reserved admin username rejected during user update', { userId, username });
      logger.separator();
      return res.status(403).json(
        createResponse(false, 'The admin username is reserved for the protected Administrator account')
      );
    }

    if (isProtectedAdminAccount && username && !isProtectedAdminUsername(username)) {
      logger.warn('Attempt to rename protected admin account', { userId, username });
      logger.separator();
      return res.status(403).json(
        createResponse(false, 'Protected admin account username cannot be changed')
      );
    }

    if (role_id) {
      const requestedRole = await getRoleRecordById(role_id);
      if (!requestedRole) {
        logger.warn('Invalid role selected during user update', { userId, role_id });
        logger.separator();
        return res.status(400).json(
          createResponse(false, 'Selected role is invalid')
        );
      }

      if (isProtectedAdminRoleCode(requestedRole.role_code) && !isProtectedAdminAccount) {
        logger.warn('Attempt to assign ADMIN role to non-admin account', { userId, roleId: role_id });
        logger.separator();
        return res.status(403).json(
          createResponse(false, 'Administrator role can only be assigned to the protected admin account')
        );
      }

      if (isProtectedAdminAccount && !isProtectedAdminRoleCode(requestedRole.role_code)) {
        logger.warn('Attempt to remove ADMIN role from protected admin account', { userId, roleId: role_id });
        logger.separator();
        return res.status(403).json(
          createResponse(false, 'Protected admin account must remain assigned to the Administrator role')
        );
      }
    }

    const requestedActive = is_active === true || is_active === 1 || is_active === 'true';
    if (isProtectedAdminAccount && is_active !== undefined && !requestedActive) {
      logger.warn('Attempt to deactivate protected admin account', { userId });
      logger.separator();
      return res.status(403).json(
        createResponse(false, 'Protected admin account cannot be deactivated')
      );
    }

    // Check if username is taken by another user
    if (username) {
      const usernameCheck = await executeQuery(
        'SELECT user_id FROM users WHERE username = @username AND user_id != @userId',
        { username, userId }
      );

      if (usernameCheck.recordset.length > 0) {
        logger.warn('Username already exists', { username });
        logger.separator();
        return res.status(400).json(
          createResponse(false, 'Username already exists')
        );
      }
    }

    // Check if email is taken by another user
    if (email) {
      const emailCheck = await executeQuery(
        'SELECT user_id FROM users WHERE email = @email AND user_id != @userId',
        { email, userId }
      );

      if (emailCheck.recordset.length > 0) {
        logger.warn('Email already exists', { email });
        logger.separator();
        return res.status(400).json(
          createResponse(false, 'Email already exists')
        );
      }
    }

    const currentlyActive = Number(existingUser?.is_active) === 1;
    const willActivateUser = !currentlyActive && requestedActive;
    if (willActivateUser) {
      const seatCheck = await licenseService.assertActiveUserSeatAvailable();
      if (!seatCheck.allowed) {
        logger.warn('User activation blocked by license active-user limit', {
          targetUserId: userId,
          current: seatCheck.current,
          limit: seatCheck.limit,
        });
        logger.separator();
        return res.status(403).json(
          createResponse(false, seatCheck.message, {
            code: seatCheck.code,
            current: seatCheck.current,
            limit: seatCheck.limit,
          })
        );
      }
    }

    // Build update query
    const updateFields = [];
    const params = { userId };

    if (username) {
      updateFields.push('username = @username');
      params.username = username;
    }
    if (email) {
      updateFields.push('email = @email');
      params.email = email;
    }
    if (first_name) {
      updateFields.push('first_name = @firstName');
      params.firstName = first_name;
    }
    if (last_name) {
      updateFields.push('last_name = @lastName');
      params.lastName = last_name;
    }
    if (phone_number !== undefined) {
      updateFields.push('phone_number = @phoneNumber');
      params.phoneNumber = phone_number || null;
    }
    if (role_id) {
      updateFields.push('role_id = @roleId');
      params.roleId = role_id;
    }
    if (department_id !== undefined) {
      updateFields.push('department_id = @departmentId');
      params.departmentId = department_id || null;
    }
    if (location_id !== undefined) {
      updateFields.push('location_id = @locationId');
      params.locationId = location_id ? parseInt(location_id) : null;
    }
    if (process_id !== undefined) {
      updateFields.push('process_id = @processId');
      params.processId = process_id ? parseInt(process_id) : null;
    }
    if (is_active !== undefined) {
      updateFields.push('is_active = @isActive');
      params.isActive = is_active ? 1 : 0;
    }

    // ⭐ ADD PASSWORD HANDLING
    // Developer: Suvadip Panja
    // Date: February 04, 2026
    if (password) {
      // Hash the new password (bcrypt is already imported at top of file)
      const hashedPassword = await bcrypt.hash(password, config.security.bcryptRounds);
      
      updateFields.push('password_hash = @passwordHash');
      params.passwordHash = hashedPassword;
      
      // Update password_changed_at timestamp
      updateFields.push('password_changed_at = GETDATE()');
      
      // ⭐ CRITICAL: Calculate and set password_expires_at based on policy
      // This was missing - causing password_expires_at to be NULL!
      logger.try('Fetching password expiry policy from system settings');
      
      const expirySettingsResult = await executeQuery(
        `SELECT setting_value 
         FROM system_settings 
         WHERE setting_key = 'password_expiry_days'`
      );
      
      const expiryDays = expirySettingsResult.recordset.length > 0 
        ? parseInt(expirySettingsResult.recordset[0].setting_value) 
        : 0; // Default to 0 (disabled) if not set
      
      logger.info('Password expiry policy', { expiryDays });
      
      if (expiryDays > 0) {
        // Set password_expires_at = today + expiry days
        updateFields.push('password_expires_at = DATEADD(DAY, @expiryDays, GETDATE())');
        params.expiryDays = expiryDays;
        logger.success('Password expiry date will be set', { expiryDays });
      } else {
        // If expiry is disabled (0 days), set to NULL
        updateFields.push('password_expires_at = NULL');
        logger.info('Password expiry disabled (0 days policy)');
      }
      
      // Store in password history for tracking (securityService already imported at top)
      try {
        await securityService.savePasswordHistory(
          userId, 
          hashedPassword, 
          req.user.user_id, 
          'ADMIN_UPDATE'
        );
        logger.info('Password history updated for user', { userId });
      } catch (historyError) {
        logger.warn('Failed to update password history', { userId, error: historyError.message });
        // Don't fail the update if history logging fails
      }
    }

    if (updateFields.length === 0) {
      logger.warn('No fields to update');
      logger.separator();
      return res.status(400).json(
        createResponse(false, 'No fields to update')
      );
    }

    updateFields.push('updated_at = GETDATE()');

    const updateQuery = `
      UPDATE users
      SET ${updateFields.join(', ')}
      WHERE user_id = @userId
    `;

    await executeQuery(updateQuery, params);

    cacheService.invalidateAuthMe(userId);

    logger.success('User updated successfully', { userId });
    logger.separator();

    return res.status(200).json(
      createResponse(true, 'User updated successfully')
    );
  } catch (error) {
    logger.error('Update user error', error);
    logger.separator();
    next(error);
  }
};

/**
 * Delete user (soft delete — sets is_active = 0)
 * @route DELETE /api/v1/users/:id
 * @access Private (Admin / can_manage_users)
 */
const deleteUser = async (req, res, next) => {
  try {
    const userId = req.params.id;

    logger.separator('USER DELETION');
    logger.try('Deleting user', {
      userId,
      deletedBy: req.user.user_id,
    });

    // Check permission
    if (!req.user.permissions || !req.user.permissions.can_manage_users) {
      logger.warn('Unauthorized user deletion attempt', {
        userId: req.user.user_id,
      });
      logger.separator();
      return res.status(403).json(
        createResponse(false, 'You do not have permission to delete users')
      );
    }

    // Prevent self-deletion
    if (req.user.user_id === parseInt(userId)) {
      logger.warn('Attempted self-deletion', { userId });
      logger.separator();
      return res.status(400).json(
        createResponse(false, 'You cannot delete your own account')
      );
    }

    // Check if user exists
    const userCheck = await executeQuery(
      `SELECT u.user_id, u.username, r.role_code
       FROM users u
       LEFT JOIN user_roles r ON u.role_id = r.role_id
       WHERE u.user_id = @userId`,
      { userId }
    );

    if (userCheck.recordset.length === 0) {
      logger.warn('User not found', { userId });
      logger.separator();
      return res.status(404).json(
        createResponse(false, 'User not found')
      );
    }

    if (isProtectedAdminUsername(userCheck.recordset[0].username)) {
      logger.warn('Attempted deletion of protected admin account', { userId });
      logger.separator();
      return res.status(403).json(
        createResponse(false, 'Protected admin account cannot be deleted or deactivated')
      );
    }

    // Soft delete
    const deleteQuery = `
      UPDATE users
      SET is_active = 0, updated_at = GETDATE()
      WHERE user_id = @userId
    `;

    await executeQuery(deleteQuery, { userId });

    logger.success('User deleted successfully', {
      userId,
      username: userCheck.recordset[0].username,
    });
    logger.separator();

    return res.status(200).json(
      createResponse(true, 'User deleted successfully')
    );
  } catch (error) {
    logger.error('Delete user error', error);
    logger.separator();
    next(error);
  }
};

// ============================================
// ⭐ NEW: EXTEND PASSWORD EXPIRY
// Adds 90 days to user's password expiry date
// @route PUT /api/v1/users/:id/extend-password-expiry
// @access Private (Admin only)
// ============================================
const extendPasswordExpiry = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const adminId = req.user.user_id;
    const adminUsername = req.user.username;
    
    logger.separator();
    logger.try('EXTEND PASSWORD EXPIRY', { userId, adminId, adminUsername });
    
    // Get current user details
    const userQuery = `
      SELECT 
        user_id, 
        username, 
        first_name + ' ' + last_name as full_name, 
        password_expires_at
      FROM users
      WHERE user_id = @userId
    `;
    
    const userResult = await executeQuery(userQuery, { userId });
    
    if (userResult.recordset.length === 0) {
      logger.warn('User not found', { userId });
      return res.status(404).json(
        createResponse(false, 'User not found')
      );
    }
    
    const user = userResult.recordset[0];
    logger.info('Current expiry date', { 
      userId, 
      username: user.username,
      currentExpiry: user.password_expires_at 
    });
    
    // Extend by 90 days from current expiry date (or today if already expired)
    const updateQuery = `
      UPDATE users
      SET 
        password_expires_at = DATEADD(DAY, 90, 
          CASE 
            WHEN password_expires_at > GETDATE() THEN password_expires_at
            ELSE GETDATE()
          END
        ),
        updated_at = GETDATE()
      WHERE user_id = @userId
    `;
    
    await executeQuery(updateQuery, { userId });
    
    // Get new expiry date
    const updatedUserResult = await executeQuery(userQuery, { userId });
    const newExpiry = updatedUserResult.recordset[0].password_expires_at;
    
    logger.success('Password expiry extended', {
      userId,
      username: user.username,
      oldExpiry: user.password_expires_at,
      newExpiry: newExpiry
    });
    
    // Log security event
    await securityService.logSecurityEvent(
      userId,
      'PASSWORD_EXPIRY_EXTENDED',
      `Password expiry extended by 90 days by admin ${adminUsername}`,
      getClientIp(req),
      req.get('user-agent'),
      true
    );
    
    // Log admin action
    await securityService.logSecurityEvent(
      adminId,
      'ADMIN_EXTEND_PASSWORD_EXPIRY',
      `Extended password expiry for user ${user.username} by 90 days`,
      getClientIp(req),
      req.get('user-agent'),
      true
    );
    
    logger.separator();
    
    return res.status(200).json(
      createResponse(
        true, 
        'Password expiry extended by 90 days successfully',
        {
          user_id: userId,
          username: user.username,
          new_expiry: newExpiry
        }
      )
    );
    
  } catch (error) {
    logger.error('Extend password expiry error', error);
    logger.separator();
    next(error);
  }
};

// ============================================
// ⭐ NEW: FORCE PASSWORD RESET
// Expires password immediately, forcing user to reset on next login
// @route PUT /api/v1/users/:id/force-password-reset
// @access Private (Admin only)
// ============================================
const forcePasswordReset = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const adminId = req.user.user_id;
    const adminUsername = req.user.username;
    
    logger.separator();
    logger.try('FORCE PASSWORD RESET', { userId, adminId, adminUsername });
    
    // Get current user details
    const userQuery = `
      SELECT 
        user_id, 
        username, 
        first_name + ' ' + last_name as full_name,
        email,
        password_expires_at
      FROM users
      WHERE user_id = @userId
    `;
    
    const userResult = await executeQuery(userQuery, { userId });
    
    if (userResult.recordset.length === 0) {
      logger.warn('User not found', { userId });
      return res.status(404).json(
        createResponse(false, 'User not found')
      );
    }
    
    const user = userResult.recordset[0];
    
    // Don't allow admin to force reset their own password through this endpoint
    if (parseInt(userId) === adminId) {
      logger.warn('Admin attempted to force reset own password', { adminId });
      return res.status(400).json(
        createResponse(false, 'Cannot force reset your own password. Use the change password feature instead.')
      );
    }
    
    logger.info('Current expiry date', { 
      userId, 
      username: user.username,
      currentExpiry: user.password_expires_at 
    });
    
    // Set password expiry to yesterday (forces immediate reset)
    const updateQuery = `
      UPDATE users
      SET 
        password_expires_at = DATEADD(DAY, -1, GETDATE()),
        updated_at = GETDATE()
      WHERE user_id = @userId
    `;
    
    await executeQuery(updateQuery, { userId });
    
    logger.success('Password reset forced', {
      userId,
      username: user.username,
      email: user.email
    });
    
    // Log security event for the user
    await securityService.logSecurityEvent(
      userId,
      'PASSWORD_RESET_FORCED',
      `Password reset forced by admin ${adminUsername}. User must reset password on next login.`,
      getClientIp(req),
      req.get('user-agent'),
      true
    );
    
    // Log admin action
    await securityService.logSecurityEvent(
      adminId,
      'ADMIN_FORCE_PASSWORD_RESET',
      `Forced password reset for user ${user.username}`,
      getClientIp(req),
      req.get('user-agent'),
      true
    );
    
    logger.separator();
    
    return res.status(200).json(
      createResponse(
        true, 
        'Password reset forced successfully. User must reset password on next login.',
        {
          user_id: userId,
          username: user.username,
          email: user.email
        }
      )
    );
    
  } catch (error) {
    logger.error('Force password reset error', error);
    logger.separator();
    next(error);
  }
};

// ============================================
// UNLOCK USER ACCOUNT (Admin Only)
// Manually unlocks a locked account
// ============================================
/**
 * Unlock a user account that was locked due to failed login attempts
 * @route PUT /api/v1/users/:id/unlock
 * @access Private (Admin only)
 */
const unlockUser = async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);
    const adminId = req.user.user_id;
    const adminUsername = req.user.username;

    logger.try('Admin manual account unlock', { userId, adminId });

    // Check permission
    if (!req.user.permissions || !req.user.permissions.can_manage_users) {
      logger.warn('Unauthorized unlock attempt', { userId, adminId });
      return res.status(403).json(
        createResponse(false, 'You do not have permission to manage users')
      );
    }

    // Prevent unlocking own account (shouldn't happen, but safety)
    if (userId === adminId) {
      return res.status(400).json(
        createResponse(false, 'You cannot unlock your own account from here')
      );
    }

    // Get current user status
    const userQuery = `
      SELECT user_id, username, email, is_locked, locked_until, failed_login_attempts
      FROM users
      WHERE user_id = @userId
    `;
    const userResult = await executeQuery(userQuery, { userId });

    if (userResult.recordset.length === 0) {
      return res.status(404).json(
        createResponse(false, 'User not found')
      );
    }

    const targetUser = userResult.recordset[0];

    if (!targetUser.is_locked && targetUser.failed_login_attempts === 0) {
      return res.status(400).json(
        createResponse(false, `Account "${targetUser.username}" is not locked and has no failed attempts`)
      );
    }

    // Unlock the account using security service (resets is_locked, locked_until, failed_login_attempts)
    await securityService.unlockAccount(userId);

    // Determine action type for logging
    const wasLocked = targetUser.is_locked;
    const actionType = wasLocked ? 'ACCOUNT_UNLOCKED_BY_ADMIN' : 'FAILED_ATTEMPTS_RESET_BY_ADMIN';
    const actionDesc = wasLocked
      ? `Account manually unlocked by admin ${adminUsername}`
      : `Failed login attempts (${targetUser.failed_login_attempts}) reset by admin ${adminUsername}`;

    // Log the admin action
    await securityService.logSecurityEvent(
      userId,
      actionType,
      actionDesc,
      getClientIp(req),
      req.get('user-agent'),
      true
    );

    await securityService.logSecurityEvent(
      adminId,
      'ADMIN_UNLOCK_ACCOUNT',
      `${wasLocked ? 'Unlocked' : 'Reset failed attempts for'} user ${targetUser.username} (ID: ${userId})`,
      getClientIp(req),
      req.get('user-agent'),
      true
    );

    // Whitelist user in rate limiter so they can log in immediately
    whitelistUser(targetUser.username, `Admin ${adminUsername} unlocked account`);

    logger.success('Account unlocked/reset by admin', {
      userId,
      username: targetUser.username,
      adminId,
      adminUsername,
      wasLocked,
      previousFailedAttempts: targetUser.failed_login_attempts
    });

    const message = wasLocked
      ? `Account "${targetUser.username}" has been unlocked successfully`
      : `Failed login attempts for "${targetUser.username}" have been reset`;

    return res.status(200).json(
      createResponse(
        true,
        message,
        {
          user_id: userId,
          username: targetUser.username,
          email: targetUser.email,
          was_locked: wasLocked,
          was_locked_until: targetUser.locked_until,
          previous_failed_attempts: targetUser.failed_login_attempts
        }
      )
    );
  } catch (error) {
    logger.error('Unlock user error', error);
    next(error);
  }
};

// ============================================
// HARD DELETE USER
// Permanently removes a user from the database.
// Only ADMIN role can perform this action.
// Cleans up: sessions, notifications, assigned tickets.
// Fails if the user still has ticket_approval records
// (to preserve audit trail — soft delete instead).
// @route DELETE /api/v1/users/:id/hard-delete
// @access ADMIN role only
// ============================================
const hardDeleteUser = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const callerRoleCode = req.user?.role?.role_code || '';

    logger.separator('HARD DELETE USER');
    logger.try('Hard deleting user', { userId, callerRoleCode, deletedBy: req.user.user_id });

    // Only ADMIN role can hard-delete
    if (callerRoleCode !== 'ADMIN') {
      logger.warn('Non-admin attempted hard delete', { callerId: req.user.user_id });
      logger.separator();
      return res.status(403).json(
        createResponse(false, 'Only administrators can permanently delete users')
      );
    }

    // Prevent self-deletion
    if (req.user.user_id === parseInt(userId)) {
      logger.separator();
      return res.status(400).json(createResponse(false, 'You cannot delete your own account'));
    }

    // Fetch target user
    const userCheck = await executeQuery(
      `SELECT u.user_id, u.username, r.role_code
       FROM users u
       LEFT JOIN user_roles r ON u.role_id = r.role_id
       WHERE u.user_id = @userId`,
      { userId }
    );

    if (!userCheck.recordset.length) {
      logger.separator();
      return res.status(404).json(createResponse(false, 'User not found'));
    }

    const targetUser = userCheck.recordset[0];

    if (isProtectedAdminUsername(targetUser.username)) {
      logger.separator();
      return res.status(403).json(
        createResponse(false, 'Protected admin account cannot be permanently deleted')
      );
    }

    // Check for ticket_approvals records — these have NOT NULL FK constraints.
    // Deleting would violate FK; the audit trail must be preserved.
    const approvalCheck = await executeQuery(
      `SELECT COUNT(*) AS cnt FROM ticket_approvals
       WHERE requested_by = @userId OR approver_id = @userId`,
      { userId }
    );
    if (approvalCheck.recordset[0].cnt > 0) {
      logger.warn('Hard delete blocked — user has approval records', { userId });
      logger.separator();
      return res.status(409).json(
        createResponse(
          false,
          `Cannot permanently delete this user: they have ${approvalCheck.recordset[0].cnt} approval record(s) ` +
          'linked to tickets (audit trail). Use soft delete (deactivate) to preserve history.'
        )
      );
    }

    // Check for created/requested tickets
    const ticketCheck = await executeQuery(
      `SELECT COUNT(*) AS cnt FROM tickets WHERE requester_id = @userId OR created_by = @userId`,
      { userId }
    );
    if (ticketCheck.recordset[0].cnt > 0) {
      logger.warn('Hard delete blocked — user has ticket records', { userId });
      logger.separator();
      return res.status(409).json(
        createResponse(
          false,
          `Cannot permanently delete this user: they have ${ticketCheck.recordset[0].cnt} ticket(s) ` +
          'they created. Use soft delete (deactivate) to preserve ticket history.'
        )
      );
    }

    // Safe to delete — clean up ancillary records first
    // 1. Unassign any tickets assigned to this user
    await executeQuery(
      `UPDATE tickets SET assigned_to = NULL, updated_at = GETDATE() WHERE assigned_to = @userId`,
      { userId }
    );

    // 2. Delete notifications for this user
    await executeQuery(
      `DELETE FROM notifications WHERE user_id = @userId`,
      { userId }
    );

    // 3. Invalidate any active sessions / refresh tokens (table may not exist — tolerated)
    try {
      await executeQuery(
        `DELETE FROM user_sessions WHERE user_id = @userId`,
        { userId }
      );
    } catch { /* table may not exist */ }

    // 4. Delete the user record
    await executeQuery(
      `DELETE FROM users WHERE user_id = @userId`,
      { userId }
    );

    logger.success('User permanently deleted', { userId, username: targetUser.username });
    logger.separator();

    return res.status(200).json(
      createResponse(true, `User "${targetUser.username}" has been permanently deleted`)
    );
  } catch (error) {
    logger.error('Hard delete user error', error);
    logger.separator();
    next(error);
  }
};

// ============================================
// EXPORT ALL FUNCTIONS
// ============================================
module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  hardDeleteUser,
  extendPasswordExpiry,
  forcePasswordReset,
  unlockUser,
};
// ============================================
// Users Controller
// Handles user management operations
// FIXED: Permission check now uses req.user.permissions
// ============================================

const { executeQuery } = require('../config/database');
const { createResponse, getPaginationMeta } = require('../utils/helpers');
const logger = require('../utils/logger');
const bcrypt = require('bcryptjs');

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

    // ============================================
    // FIXED: Check permission from permissions object
    // ============================================
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

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM users u
      ${whereClause}
    `;

    const countResult = await executeQuery(countQuery, params);
    const totalRecords = countResult.recordset[0].total;

    // Get paginated users
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
        u.created_at,
        u.last_login,
        
        r.role_id,
        r.role_name,
        r.role_code,
        
        d.department_id,
        d.department_name,
        d.department_code,
        
        (SELECT COUNT(*) FROM tickets WHERE requester_id = u.user_id) as tickets_created,
        (SELECT COUNT(*) FROM tickets WHERE assigned_to = u.user_id) as tickets_assigned
        
      FROM users u
      LEFT JOIN user_roles r ON u.role_id = r.role_id
      LEFT JOIN departments d ON u.department_id = d.department_id
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

    // ============================================
    // FIXED: Check permission from permissions object
    // ============================================
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
        
        r.role_id,
        r.role_name,
        r.role_code,
        
        d.department_id,
        d.department_name,
        d.department_code,
        
        (SELECT COUNT(*) FROM tickets WHERE requester_id = u.user_id) as tickets_created,
        (SELECT COUNT(*) FROM tickets WHERE assigned_to = u.user_id) as tickets_assigned,
        (SELECT COUNT(*) FROM tickets WHERE requester_id = u.user_id AND status_id IN (SELECT status_id FROM ticket_statuses WHERE status_code = 'OPEN')) as open_tickets
        
      FROM users u
      LEFT JOIN user_roles r ON u.role_id = r.role_id
      LEFT JOIN departments d ON u.department_id = d.department_id
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
    } = req.body;

    logger.separator('USER CREATION');
    logger.try('Creating new user', {
      username,
      email,
      createdBy: req.user.user_id,
    });

    // ============================================
    // FIXED: Check permission from permissions object
    // ============================================
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
    logger.try('Hashing password');
    const hashedPassword = await bcrypt.hash(password, 10);
    logger.success('Password hashed');

    // Insert user
    logger.try('Inserting user into database');

    const insertQuery = `
      INSERT INTO users (
        username, email, password_hash,
        first_name, last_name, phone_number,
        role_id, department_id, is_active
      )
      OUTPUT INSERTED.user_id
      VALUES (
        @username, @email, @passwordHash,
        @firstName, @lastName, @phoneNumber,
        @roleId, @departmentId, 1
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
    });

    const newUserId = insertResult.recordset[0].user_id;

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
    } = req.body;

    logger.separator('USER UPDATE');
    logger.try('Updating user', {
      userId,
      updatedBy: req.user.user_id,
    });

    // ============================================
    // FIXED: Check permission from permissions object
    // ============================================
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
      'SELECT user_id FROM users WHERE user_id = @userId',
      { userId }
    );

    if (userCheck.recordset.length === 0) {
      logger.warn('User not found', { userId });
      logger.separator();
      return res.status(404).json(
        createResponse(false, 'User not found')
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
    if (is_active !== undefined) {
      updateFields.push('is_active = @isActive');
      params.isActive = is_active ? 1 : 0;
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
 * Delete user (soft delete)
 * @route DELETE /api/v1/users/:id
 * @access Private (Admin only)
 */
const deleteUser = async (req, res, next) => {
  try {
    const userId = req.params.id;

    logger.separator('USER DELETION');
    logger.try('Deleting user', {
      userId,
      deletedBy: req.user.user_id,
    });

    // ============================================
    // FIXED: Check permission from permissions object
    // ============================================
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
      'SELECT user_id, username FROM users WHERE user_id = @userId',
      { userId }
    );

    if (userCheck.recordset.length === 0) {
      logger.warn('User not found', { userId });
      logger.separator();
      return res.status(404).json(
        createResponse(false, 'User not found')
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
// EXPORT ALL FUNCTIONS
// ============================================
module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
};
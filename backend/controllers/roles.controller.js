// ============================================
// Roles Controller
// Handles role CRUD operations and permissions
// FIXED: All permission checks now use req.user.permissions
// ============================================

const { executeQuery } = require('../config/database');
const { createResponse } = require('../utils/helpers');
const logger = require('../utils/logger');

/**
 * Get all roles
 * @route GET /api/v1/roles
 * @access Private (Admin only)
 */
const getRoles = async (req, res, next) => {
  try {
    logger.info('Fetching all roles', {
      userId: req.user.user_id,
    });

    const query = `
      SELECT 
        r.role_id,
        r.role_name,
        r.role_code,
        r.description,
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
        r.is_active,
        r.is_system_role,
        r.created_at,
        r.updated_at,
        (SELECT COUNT(*) FROM users WHERE role_id = r.role_id AND is_active = 1) as total_users
      FROM user_roles r
      WHERE r.is_active = 1
      ORDER BY 
        CASE 
          WHEN r.role_code = 'ADMIN' THEN 1
          WHEN r.role_code = 'MANAGER' THEN 2
          WHEN r.role_code = 'ENGINEER' THEN 3
          WHEN r.role_code = 'USER' THEN 4
          ELSE 5
        END,
        r.role_name
    `;

    const result = await executeQuery(query);

    const roles = result.recordset.map(role => ({
      role_id: role.role_id,
      role_name: role.role_name,
      role_code: role.role_code,
      description: role.description,
      permissions: {
        can_create_tickets: role.can_create_tickets || false,
        can_view_all_tickets: role.can_view_all_tickets || false,
        can_assign_tickets: role.can_assign_tickets || false,
        can_close_tickets: role.can_close_tickets || false,
        can_delete_tickets: role.can_delete_tickets || false,
        can_manage_users: role.can_manage_users || false,
        can_manage_departments: role.can_manage_departments || false,
        can_manage_roles: role.can_manage_roles || false,
        can_view_analytics: role.can_view_analytics || false,
        can_manage_system: role.can_manage_system || false
      },
      is_active: role.is_active,
      is_system_role: role.is_system_role,
      created_at: role.created_at,
      updated_at: role.updated_at,
      total_users: role.total_users
    }));

    logger.success('Roles fetched successfully', {
      count: roles.length,
    });

    return res.status(200).json(
      createResponse(true, 'Roles fetched successfully', roles)
    );
  } catch (error) {
    logger.error('Get roles error', error);
    next(error);
  }
};

/**
 * Get single role by ID
 * @route GET /api/v1/roles/:id
 * @access Private (Admin only)
 */
const getRoleById = async (req, res, next) => {
  try {
    const { id } = req.params;

    logger.info('Fetching role by ID', {
      userId: req.user.user_id,
      roleId: id,
    });

    const roleId = parseInt(id, 10);
    if (isNaN(roleId)) {
      return res.status(400).json(
        createResponse(false, 'Invalid role ID', null)
      );
    }

    const query = `
      SELECT 
        r.role_id,
        r.role_name,
        r.role_code,
        r.description,
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
        r.is_active,
        r.is_system_role,
        r.created_at,
        r.updated_at,
        (SELECT COUNT(*) FROM users WHERE role_id = r.role_id AND is_active = 1) as total_users
      FROM user_roles r
      WHERE r.role_id = ${roleId}
    `;

    const result = await executeQuery(query);

    if (result.recordset.length === 0) {
      return res.status(404).json(
        createResponse(false, 'Role not found', null)
      );
    }

    const roleData = result.recordset[0];
    const role = {
      role_id: roleData.role_id,
      role_name: roleData.role_name,
      role_code: roleData.role_code,
      description: roleData.description,
      permissions: {
        can_create_tickets: roleData.can_create_tickets || false,
        can_view_all_tickets: roleData.can_view_all_tickets || false,
        can_assign_tickets: roleData.can_assign_tickets || false,
        can_close_tickets: roleData.can_close_tickets || false,
        can_delete_tickets: roleData.can_delete_tickets || false,
        can_manage_users: roleData.can_manage_users || false,
        can_manage_departments: roleData.can_manage_departments || false,
        can_manage_roles: roleData.can_manage_roles || false,
        can_view_analytics: roleData.can_view_analytics || false,
        can_manage_system: roleData.can_manage_system || false
      },
      is_active: roleData.is_active,
      is_system_role: roleData.is_system_role,
      created_at: roleData.created_at,
      updated_at: roleData.updated_at,
      total_users: roleData.total_users
    };

    logger.success('Role fetched successfully', {
      roleId: id,
    });

    return res.status(200).json(
      createResponse(true, 'Role fetched successfully', role)
    );
  } catch (error) {
    logger.error('Get role by ID error', error);
    next(error);
  }
};

/**
 * Create new role
 * @route POST /api/v1/roles
 * @access Private (Admin only)
 */
const createRole = async (req, res, next) => {
  try {
    const { role_name, role_code, description, permissions } = req.body;

    logger.info('Creating new role', {
      userId: req.user.user_id,
      roleName: role_name,
      body: req.body,
    });

    if (!role_name || !role_code) {
      return res.status(400).json(
        createResponse(false, 'Role name and code are required', null)
      );
    }

    if (!/^[A-Z0-9_-]+$/.test(role_code)) {
      return res.status(400).json(
        createResponse(false, 'Role code must contain only uppercase letters, numbers, hyphens, and underscores', null)
      );
    }

    const cleanRoleName = role_name.trim().replace(/'/g, "''");
    const cleanRoleCode = role_code.trim().toUpperCase();
    const cleanDescription = description ? description.trim().replace(/'/g, "''") : null;

    const checkQuery = `
      SELECT role_id 
      FROM user_roles 
      WHERE role_code = '${cleanRoleCode}'
    `;

    const checkResult = await executeQuery(checkQuery);

    if (checkResult.recordset.length > 0) {
      return res.status(400).json(
        createResponse(false, 'Role code already exists', null)
      );
    }

    const defaultPermissions = {
      can_create_tickets: false,
      can_view_all_tickets: false,
      can_assign_tickets: false,
      can_close_tickets: false,
      can_delete_tickets: false,
      can_manage_users: false,
      can_manage_departments: false,
      can_manage_roles: false,
      can_view_analytics: false,
      can_manage_system: false
    };

    const rolePermissions = permissions ? { ...defaultPermissions, ...permissions } : defaultPermissions;

    const insertQuery = `
      INSERT INTO user_roles (
        role_name,
        role_code,
        description,
        can_create_tickets,
        can_view_all_tickets,
        can_assign_tickets,
        can_close_tickets,
        can_delete_tickets,
        can_manage_users,
        can_manage_departments,
        can_manage_roles,
        can_view_analytics,
        can_manage_system,
        is_active,
        is_system_role,
        created_at,
        updated_at
      )
      VALUES (
        N'${cleanRoleName}',
        '${cleanRoleCode}',
        ${cleanDescription ? `N'${cleanDescription}'` : 'NULL'},
        ${rolePermissions.can_create_tickets ? 1 : 0},
        ${rolePermissions.can_view_all_tickets ? 1 : 0},
        ${rolePermissions.can_assign_tickets ? 1 : 0},
        ${rolePermissions.can_close_tickets ? 1 : 0},
        ${rolePermissions.can_delete_tickets ? 1 : 0},
        ${rolePermissions.can_manage_users ? 1 : 0},
        ${rolePermissions.can_manage_departments ? 1 : 0},
        ${rolePermissions.can_manage_roles ? 1 : 0},
        ${rolePermissions.can_view_analytics ? 1 : 0},
        ${rolePermissions.can_manage_system ? 1 : 0},
        1,
        0,
        GETDATE(),
        GETDATE()
      );
      SELECT SCOPE_IDENTITY() AS role_id;
    `;

    logger.info('Executing insert query', { insertQuery });

    const result = await executeQuery(insertQuery);
    const newRoleId = result.recordset[0].role_id;

    logger.success('Role created successfully', {
      roleId: newRoleId,
      roleName: role_name,
    });

    return res.status(201).json(
      createResponse(true, 'Role created successfully', {
        role_id: newRoleId
      })
    );
  } catch (error) {
    logger.error('Create role error', error);
    next(error);
  }
};

/**
 * Update role
 * @route PUT /api/v1/roles/:id
 * @access Private (Admin only)
 */
const updateRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role_name, role_code, description, permissions, is_active } = req.body;

    logger.info('Updating role', {
      userId: req.user.user_id,
      roleId: id,
      body: req.body,
    });

    if (!role_name || !role_code) {
      return res.status(400).json(
        createResponse(false, 'Role name and code are required', null)
      );
    }

    const roleId = parseInt(id, 10);
    if (isNaN(roleId)) {
      return res.status(400).json(
        createResponse(false, 'Invalid role ID', null)
      );
    }

    if (!/^[A-Z0-9_-]+$/.test(role_code)) {
      return res.status(400).json(
        createResponse(false, 'Role code must contain only uppercase letters, numbers, hyphens, and underscores', null)
      );
    }

    const cleanRoleName = role_name.trim().replace(/'/g, "''");
    const cleanRoleCode = role_code.trim().toUpperCase();
    const cleanDescription = description ? description.trim().replace(/'/g, "''") : null;
    const activeStatus = is_active !== undefined ? (is_active ? 1 : 0) : 1;

    const checkQuery = `
      SELECT role_id, is_system_role, role_code
      FROM user_roles 
      WHERE role_id = ${roleId}
    `;

    const checkResult = await executeQuery(checkQuery);

    if (checkResult.recordset.length === 0) {
      return res.status(404).json(
        createResponse(false, 'Role not found', null)
      );
    }

    const existingRole = checkResult.recordset[0];

    if (existingRole.is_system_role && existingRole.role_code !== cleanRoleCode) {
      return res.status(400).json(
        createResponse(false, 'Cannot change role code of system roles', null)
      );
    }

    const codeCheckQuery = `
      SELECT role_id 
      FROM user_roles 
      WHERE role_code = '${cleanRoleCode}' 
        AND role_id != ${roleId}
    `;

    const codeCheckResult = await executeQuery(codeCheckQuery);

    if (codeCheckResult.recordset.length > 0) {
      return res.status(400).json(
        createResponse(false, 'Role code already exists', null)
      );
    }

    const updateQuery = `
      UPDATE user_roles
      SET 
        role_name = N'${cleanRoleName}',
        role_code = '${cleanRoleCode}',
        description = ${cleanDescription ? `N'${cleanDescription}'` : 'NULL'},
        can_create_tickets = ${permissions.can_create_tickets ? 1 : 0},
        can_view_all_tickets = ${permissions.can_view_all_tickets ? 1 : 0},
        can_assign_tickets = ${permissions.can_assign_tickets ? 1 : 0},
        can_close_tickets = ${permissions.can_close_tickets ? 1 : 0},
        can_delete_tickets = ${permissions.can_delete_tickets ? 1 : 0},
        can_manage_users = ${permissions.can_manage_users ? 1 : 0},
        can_manage_departments = ${permissions.can_manage_departments ? 1 : 0},
        can_manage_roles = ${permissions.can_manage_roles ? 1 : 0},
        can_view_analytics = ${permissions.can_view_analytics ? 1 : 0},
        can_manage_system = ${permissions.can_manage_system ? 1 : 0},
        is_active = ${activeStatus},
        updated_at = GETDATE()
      WHERE role_id = ${roleId}
    `;

    logger.info('Executing update query', { updateQuery });

    await executeQuery(updateQuery);

    logger.success('Role updated successfully', {
      roleId,
    });

    return res.status(200).json(
      createResponse(true, 'Role updated successfully', null)
    );
  } catch (error) {
    logger.error('Update role error', error);
    next(error);
  }
};

/**
 * Delete role (soft delete)
 * @route DELETE /api/v1/roles/:id
 * @access Private (Admin only)
 */
const deleteRole = async (req, res, next) => {
  try {
    const { id } = req.params;

    logger.info('Deleting role', {
      userId: req.user.user_id,
      roleId: id,
    });

    const roleId = parseInt(id, 10);
    if (isNaN(roleId)) {
      return res.status(400).json(
        createResponse(false, 'Invalid role ID', null)
      );
    }

    const checkQuery = `
      SELECT role_id, is_system_role, role_name
      FROM user_roles 
      WHERE role_id = ${roleId}
    `;

    const checkResult = await executeQuery(checkQuery);

    if (checkResult.recordset.length === 0) {
      return res.status(404).json(
        createResponse(false, 'Role not found', null)
      );
    }

    const role = checkResult.recordset[0];

    if (role.is_system_role) {
      return res.status(400).json(
        createResponse(false, 'Cannot delete system roles', null)
      );
    }

    const usersCheckQuery = `
      SELECT COUNT(*) as user_count
      FROM users
      WHERE role_id = ${roleId} AND is_active = 1
    `;

    const usersCheckResult = await executeQuery(usersCheckQuery);

    if (usersCheckResult.recordset[0].user_count > 0) {
      return res.status(400).json(
        createResponse(false, 'Cannot delete role with active users. Please reassign users first.', null)
      );
    }

    const deleteQuery = `
      UPDATE user_roles
      SET 
        is_active = 0,
        updated_at = GETDATE()
      WHERE role_id = ${roleId}
    `;

    logger.info('Executing delete query', { deleteQuery });

    await executeQuery(deleteQuery);

    logger.success('Role deleted successfully', {
      roleId,
    });

    return res.status(200).json(
      createResponse(true, 'Role deleted successfully', null)
    );
  } catch (error) {
    logger.error('Delete role error', error);
    next(error);
  }
};

/**
 * Get available permissions list
 * @route GET /api/v1/roles/permissions/available
 * @access Private (Admin only)
 */
const getAvailablePermissions = async (req, res, next) => {
  try {
    logger.info('Fetching available permissions', {
      userId: req.user.user_id,
    });

    const permissions = [
      {
        key: 'can_create_tickets',
        label: 'Create Tickets',
        description: 'Allow creating new support tickets',
        category: 'Tickets'
      },
      {
        key: 'can_view_all_tickets',
        label: 'View All Tickets',
        description: 'View tickets from all users and departments',
        category: 'Tickets'
      },
      {
        key: 'can_assign_tickets',
        label: 'Assign Tickets',
        description: 'Assign tickets to engineers',
        category: 'Tickets'
      },
      {
        key: 'can_close_tickets',
        label: 'Close Tickets',
        description: 'Close and resolve tickets',
        category: 'Tickets'
      },
      {
        key: 'can_delete_tickets',
        label: 'Delete Tickets',
        description: 'Permanently delete tickets',
        category: 'Tickets'
      },
      {
        key: 'can_manage_users',
        label: 'Manage Users',
        description: 'Create, edit, and delete users',
        category: 'Users'
      },
      {
        key: 'can_manage_departments',
        label: 'Manage Departments',
        description: 'Create, edit, and delete departments',
        category: 'Departments'
      },
      {
        key: 'can_manage_roles',
        label: 'Manage Roles',
        description: 'Create, edit, and delete roles',
        category: 'Roles'
      },
      {
        key: 'can_view_analytics',
        label: 'View Analytics',
        description: 'Access analytics and reports',
        category: 'Analytics'
      },
      {
        key: 'can_manage_system',
        label: 'Manage System',
        description: 'Access system settings and configuration',
        category: 'System'
      }
    ];

    logger.success('Available permissions fetched successfully', {
      count: permissions.length,
    });

    return res.status(200).json(
      createResponse(true, 'Permissions fetched successfully', permissions)
    );
  } catch (error) {
    logger.error('Get available permissions error', error);
    next(error);
  }
};

// ============================================
// EXPORT ALL FUNCTIONS
// ============================================
module.exports = {
  getRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  getAvailablePermissions,
};
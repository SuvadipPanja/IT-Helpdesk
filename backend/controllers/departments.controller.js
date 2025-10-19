// ============================================
// Department Controller
// Handles department CRUD operations
// ============================================

const { executeQuery } = require('../config/database');
const { createResponse } = require('../utils/helpers');
const logger = require('../utils/logger');

/**
 * Get all departments
 * @route GET /api/v1/departments
 * @access Private (Admin/Manager)
 */
const getDepartments = async (req, res, next) => {
  try {
    logger.info('Fetching all departments', {
      userId: req.user.user_id,
    });

    const query = `
      SELECT 
        d.department_id,
        d.department_name,
        d.department_code,
        d.description,
        d.manager_id,
        d.is_active,
        d.created_at,
        d.updated_at,
        -- Manager Info
        CASE 
          WHEN d.manager_id IS NOT NULL 
          THEN u.first_name + ' ' + u.last_name 
          ELSE NULL 
        END as manager_name,
        u.email as manager_email,
        -- Department Stats
        (SELECT COUNT(*) FROM users WHERE department_id = d.department_id AND is_active = 1) as total_users,
        (SELECT COUNT(*) FROM tickets t 
         INNER JOIN users u ON t.requester_id = u.user_id 
         WHERE u.department_id = d.department_id 
         AND t.status_id NOT IN (SELECT status_id FROM ticket_statuses WHERE is_final_status = 1)
        ) as active_tickets
      FROM departments d
      LEFT JOIN users u ON d.manager_id = u.user_id
      WHERE d.is_active = 1
      ORDER BY d.department_name
    `;

    const result = await executeQuery(query);

    logger.success('Departments fetched successfully', {
      count: result.recordset.length,
    });

    return res.status(200).json(
      createResponse(true, 'Departments fetched successfully', result.recordset)
    );
  } catch (error) {
    logger.error('Get departments error', error);
    next(error);
  }
};

/**
 * Get single department by ID
 * @route GET /api/v1/departments/:id
 * @access Private (Admin/Manager)
 */
const getDepartmentById = async (req, res, next) => {
  try {
    const { id } = req.params;

    logger.info('Fetching department by ID', {
      userId: req.user.user_id,
      departmentId: id,
    });

    // Parse and validate ID
    const departmentId = parseInt(id, 10);
    if (isNaN(departmentId)) {
      return res.status(400).json(
        createResponse(false, 'Invalid department ID', null)
      );
    }

    const query = `
      SELECT 
        d.department_id,
        d.department_name,
        d.department_code,
        d.description,
        d.manager_id,
        d.is_active,
        d.created_at,
        d.updated_at,
        -- Manager Info
        CASE 
          WHEN d.manager_id IS NOT NULL 
          THEN u.first_name + ' ' + u.last_name 
          ELSE NULL 
        END as manager_name,
        u.email as manager_email,
        -- Department Stats
        (SELECT COUNT(*) FROM users WHERE department_id = d.department_id AND is_active = 1) as total_users,
        (SELECT COUNT(*) FROM tickets t 
         INNER JOIN users u ON t.requester_id = u.user_id 
         WHERE u.department_id = d.department_id 
         AND t.status_id NOT IN (SELECT status_id FROM ticket_statuses WHERE is_final_status = 1)
        ) as active_tickets
      FROM departments d
      LEFT JOIN users u ON d.manager_id = u.user_id
      WHERE d.department_id = ${departmentId}
    `;

    const result = await executeQuery(query);

    if (result.recordset.length === 0) {
      return res.status(404).json(
        createResponse(false, 'Department not found', null)
      );
    }

    logger.success('Department fetched successfully', {
      departmentId: id,
    });

    return res.status(200).json(
      createResponse(true, 'Department fetched successfully', result.recordset[0])
    );
  } catch (error) {
    logger.error('Get department by ID error', error);
    next(error);
  }
};

/**
 * Create new department
 * @route POST /api/v1/departments
 * @access Private (Admin only)
 */
const createDepartment = async (req, res, next) => {
  try {
    const { department_name, department_code, description, manager_id } = req.body;

    logger.info('Creating new department - RAW DATA', {
      userId: req.user.user_id,
      body: req.body,
    });

    // Validate required fields
    if (!department_name || !department_code) {
      return res.status(400).json(
        createResponse(false, 'Department name and code are required', null)
      );
    }

    // Parse and validate manager_id
    let parsedManagerId = null;
    if (manager_id !== null && manager_id !== undefined && manager_id !== '' && manager_id !== 'null') {
      parsedManagerId = parseInt(manager_id, 10);
      if (isNaN(parsedManagerId)) {
        return res.status(400).json(
          createResponse(false, 'Invalid manager ID', null)
        );
      }
    }

    // Clean strings - escape single quotes for SQL
    const cleanDeptName = department_name.trim().replace(/'/g, "''");
    const cleanDeptCode = department_code.trim().toUpperCase();
    const cleanDescription = description ? description.trim().replace(/'/g, "''") : null;

    logger.info('Cleaned values', {
      cleanDeptName,
      cleanDeptCode,
      cleanDescription,
      parsedManagerId,
    });

    // Check if department code already exists
    const checkQuery = `
      SELECT department_id 
      FROM departments 
      WHERE department_code = '${cleanDeptCode}'
    `;

    const checkResult = await executeQuery(checkQuery);

    if (checkResult.recordset.length > 0) {
      return res.status(400).json(
        createResponse(false, 'Department code already exists', null)
      );
    }

    // Insert new department with inline parameters
    const insertQuery = `
      INSERT INTO departments (
        department_name,
        department_code,
        description,
        manager_id,
        is_active,
        created_at,
        updated_at
      )
      VALUES (
        N'${cleanDeptName}',
        '${cleanDeptCode}',
        ${cleanDescription ? `N'${cleanDescription}'` : 'NULL'},
        ${parsedManagerId || 'NULL'},
        1,
        GETDATE(),
        GETDATE()
      );
      SELECT SCOPE_IDENTITY() AS department_id;
    `;

    logger.info('Executing insert query', { insertQuery });

    const result = await executeQuery(insertQuery);
    const newDepartmentId = result.recordset[0].department_id;

    logger.success('Department created successfully', {
      departmentId: newDepartmentId,
      departmentName: department_name,
    });

    return res.status(201).json(
      createResponse(true, 'Department created successfully', {
        department_id: newDepartmentId
      })
    );
  } catch (error) {
    logger.error('Create department error', error);
    next(error);
  }
};

/**
 * Update department
 * @route PUT /api/v1/departments/:id
 * @access Private (Admin only)
 */
const updateDepartment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { department_name, department_code, description, manager_id, is_active } = req.body;

    logger.info('Updating department - RAW DATA', {
      userId: req.user.user_id,
      departmentId: id,
      body: req.body,
      manager_id_type: typeof manager_id,
      manager_id_value: manager_id,
    });

    // Validate required fields
    if (!department_name || !department_code) {
      return res.status(400).json(
        createResponse(false, 'Department name and code are required', null)
      );
    }

    // Parse department ID
    const departmentId = parseInt(id, 10);
    if (isNaN(departmentId)) {
      return res.status(400).json(
        createResponse(false, 'Invalid department ID', null)
      );
    }

    // Parse and validate manager_id
    let parsedManagerId = null;
    if (manager_id !== null && manager_id !== undefined && manager_id !== '' && manager_id !== 'null') {
      parsedManagerId = parseInt(manager_id, 10);
      if (isNaN(parsedManagerId)) {
        return res.status(400).json(
          createResponse(false, 'Invalid manager ID', null)
        );
      }
    }

    // Clean strings - escape single quotes for SQL
    const cleanDeptName = department_name.trim().replace(/'/g, "''");
    const cleanDeptCode = department_code.trim().toUpperCase();
    const cleanDescription = description ? description.trim().replace(/'/g, "''") : null;
    const activeStatus = is_active !== undefined ? (is_active ? 1 : 0) : 1;

    logger.info('Cleaned values', {
      departmentId,
      cleanDeptName,
      cleanDeptCode,
      cleanDescription,
      parsedManagerId,
      activeStatus,
    });

    // Check if department exists
    const checkQuery = `
      SELECT department_id 
      FROM departments 
      WHERE department_id = ${departmentId}
    `;

    const checkResult = await executeQuery(checkQuery);

    if (checkResult.recordset.length === 0) {
      return res.status(404).json(
        createResponse(false, 'Department not found', null)
      );
    }

    // Check if department code is used by another department
    const codeCheckQuery = `
      SELECT department_id 
      FROM departments 
      WHERE department_code = '${cleanDeptCode}' 
        AND department_id != ${departmentId}
    `;

    const codeCheckResult = await executeQuery(codeCheckQuery);

    if (codeCheckResult.recordset.length > 0) {
      return res.status(400).json(
        createResponse(false, 'Department code already exists', null)
      );
    }

    // Update department with inline parameters
    const updateQuery = `
      UPDATE departments
      SET 
        department_name = N'${cleanDeptName}',
        department_code = '${cleanDeptCode}',
        description = ${cleanDescription ? `N'${cleanDescription}'` : 'NULL'},
        manager_id = ${parsedManagerId || 'NULL'},
        is_active = ${activeStatus},
        updated_at = GETDATE()
      WHERE department_id = ${departmentId}
    `;

    logger.info('Executing update query', { updateQuery });

    await executeQuery(updateQuery);

    logger.success('Department updated successfully', {
      departmentId,
    });

    return res.status(200).json(
      createResponse(true, 'Department updated successfully', null)
    );
  } catch (error) {
    logger.error('Update department error', error);
    next(error);
  }
};

/**
 * Delete department (soft delete)
 * @route DELETE /api/v1/departments/:id
 * @access Private (Admin only)
 */
const deleteDepartment = async (req, res, next) => {
  try {
    const { id } = req.params;

    logger.info('Deleting department', {
      userId: req.user.user_id,
      departmentId: id,
    });

    // Parse department ID
    const departmentId = parseInt(id, 10);
    if (isNaN(departmentId)) {
      return res.status(400).json(
        createResponse(false, 'Invalid department ID', null)
      );
    }

    // Check if department exists
    const checkQuery = `
      SELECT department_id 
      FROM departments 
      WHERE department_id = ${departmentId}
    `;

    const checkResult = await executeQuery(checkQuery);

    if (checkResult.recordset.length === 0) {
      return res.status(404).json(
        createResponse(false, 'Department not found', null)
      );
    }

    // Check if department has users
    const usersCheckQuery = `
      SELECT COUNT(*) as user_count
      FROM users
      WHERE department_id = ${departmentId} AND is_active = 1
    `;

    const usersCheckResult = await executeQuery(usersCheckQuery);

    if (usersCheckResult.recordset[0].user_count > 0) {
      return res.status(400).json(
        createResponse(false, 'Cannot delete department with active users. Please reassign users first.', null)
      );
    }

    // Soft delete department
    const deleteQuery = `
      UPDATE departments
      SET 
        is_active = 0,
        updated_at = GETDATE()
      WHERE department_id = ${departmentId}
    `;

    logger.info('Executing delete query', { deleteQuery });

    await executeQuery(deleteQuery);

    logger.success('Department deleted successfully', {
      departmentId,
    });

    return res.status(200).json(
      createResponse(true, 'Department deleted successfully', null)
    );
  } catch (error) {
    logger.error('Delete department error', error);
    next(error);
  }
};

/**
 * Get potential managers (users who can be assigned as managers)
 * @route GET /api/v1/departments/managers/available
 * @access Private (Admin only)
 */
const getAvailableManagers = async (req, res, next) => {
  try {
    logger.info('Fetching available managers', {
      userId: req.user.user_id,
    });

    const query = `
      SELECT 
        u.user_id,
        u.first_name + ' ' + u.last_name as full_name,
        u.email,
        r.role_name,
        d.department_name
      FROM users u
      INNER JOIN user_roles r ON u.role_id = r.role_id
      LEFT JOIN departments d ON u.department_id = d.department_id
      WHERE u.is_active = 1 
        AND r.role_id IN (1, 2)
      ORDER BY u.first_name, u.last_name
    `;

    const result = await executeQuery(query);

    logger.success('Available managers fetched successfully', {
      count: result.recordset.length,
    });

    return res.status(200).json(
      createResponse(true, 'Available managers fetched successfully', result.recordset)
    );
  } catch (error) {
    logger.error('Get available managers error', error);
    next(error);
  }
};

module.exports = {
  getDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getAvailableManagers,
};
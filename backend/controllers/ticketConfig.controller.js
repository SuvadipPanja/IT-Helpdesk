// ============================================
// Ticket Configuration Controller
// Admin CRUD for Sub-Categories, Custom Fields,
// Locations, and Processes/Clients
// Developer: Suvadip Panja
// ============================================

const { executeQuery } = require('../config/database');
const { createResponse } = require('../utils/helpers');
const logger = require('../utils/logger');
const cacheService = require('../services/cache.service');

// ============================================
// SUB-CATEGORIES CRUD
// ============================================

/**
 * Get all sub-categories (with category info) - Admin view
 */
const getAllSubCategories = async (req, res, next) => {
  try {
    const { categoryId } = req.query;
    let whereClause = '';
    const params = {};

    if (categoryId) {
      whereClause = 'WHERE sc.category_id = @categoryId';
      params.categoryId = categoryId;
    }

    const query = `
      SELECT 
        sc.sub_category_id,
        sc.category_id,
        sc.sub_category_name,
        sc.description,
        sc.display_order,
        sc.is_active,
        sc.created_at,
        sc.updated_at,
        tc.category_name,
        tc.category_code,
        (SELECT COUNT(*) FROM ticket_sub_category_fields f WHERE f.sub_category_id = sc.sub_category_id AND f.is_active = 1) as field_count,
        (SELECT COUNT(*) FROM tickets t WHERE t.sub_category_id = sc.sub_category_id) as ticket_count
      FROM ticket_sub_categories sc
      LEFT JOIN ticket_categories tc ON sc.category_id = tc.category_id
      ${whereClause}
      ORDER BY tc.category_name, sc.display_order, sc.sub_category_name
    `;

    const result = await executeQuery(query, params);

    return res.status(200).json(
      createResponse(true, 'Sub-categories fetched successfully', result.recordset)
    );
  } catch (error) {
    logger.error('Get all sub-categories error', error);
    next(error);
  }
};

/**
 * Create a new sub-category
 */
const createSubCategory = async (req, res, next) => {
  try {
    const { category_id, sub_category_name, description, display_order } = req.body;

    if (!category_id || !sub_category_name) {
      return res.status(400).json(
        createResponse(false, 'Category and sub-category name are required')
      );
    }

    // Check duplicate
    const dupCheck = await executeQuery(
      `SELECT COUNT(*) as cnt FROM ticket_sub_categories WHERE category_id = @categoryId AND sub_category_name = @name`,
      { categoryId: category_id, name: sub_category_name }
    );

    if (dupCheck.recordset[0].cnt > 0) {
      return res.status(400).json(
        createResponse(false, 'A sub-category with this name already exists in this category')
      );
    }

    const query = `
      INSERT INTO ticket_sub_categories (category_id, sub_category_name, description, display_order)
      OUTPUT INSERTED.sub_category_id
      VALUES (@categoryId, @name, @description, @displayOrder)
    `;

    const result = await executeQuery(query, {
      categoryId: category_id,
      name: sub_category_name,
      description: description || null,
      displayOrder: display_order || 0,
    });

    logger.success('Sub-category created', { id: result.recordset[0].sub_category_id, name: sub_category_name });

    cacheService.invalidateSubCategories(category_id);

    return res.status(201).json(
      createResponse(true, 'Sub-category created successfully', { sub_category_id: result.recordset[0].sub_category_id })
    );
  } catch (error) {
    logger.error('Create sub-category error', error);
    next(error);
  }
};

/**
 * Update a sub-category
 */
const updateSubCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { sub_category_name, description, display_order, is_active } = req.body;

    const query = `
      UPDATE ticket_sub_categories 
      SET sub_category_name = COALESCE(@name, sub_category_name),
          description = COALESCE(@description, description),
          display_order = COALESCE(@displayOrder, display_order),
          is_active = COALESCE(@isActive, is_active),
          updated_at = GETDATE()
      WHERE sub_category_id = @id
    `;

    await executeQuery(query, {
      id,
      name: sub_category_name || null,
      description: description !== undefined ? description : null,
      displayOrder: display_order !== undefined ? display_order : null,
      isActive: is_active !== undefined ? (is_active ? 1 : 0) : null,
    });

    const catRes = await executeQuery('SELECT category_id FROM ticket_sub_categories WHERE sub_category_id = @id', { id });
    if (catRes.recordset[0]) cacheService.invalidateSubCategories(catRes.recordset[0].category_id);

    return res.status(200).json(
      createResponse(true, 'Sub-category updated successfully')
    );
  } catch (error) {
    logger.error('Update sub-category error', error);
    next(error);
  }
};

/**
 * Delete a sub-category (soft delete by deactivating)
 */
const deleteSubCategory = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if any tickets use this sub-category
    const inUse = await executeQuery(
      'SELECT COUNT(*) as cnt FROM tickets WHERE sub_category_id = @id',
      { id }
    );

    const catRes = await executeQuery('SELECT category_id FROM ticket_sub_categories WHERE sub_category_id = @id', { id });
    const categoryId = catRes.recordset[0]?.category_id;

    if (inUse.recordset[0].cnt > 0) {
      // Soft delete
      await executeQuery(
        'UPDATE ticket_sub_categories SET is_active = 0, updated_at = GETDATE() WHERE sub_category_id = @id',
        { id }
      );
      if (categoryId) cacheService.invalidateSubCategories(categoryId);
      return res.status(200).json(
        createResponse(true, 'Sub-category deactivated (in use by tickets)')
      );
    }

    // Hard delete if not in use
    await executeQuery('DELETE FROM ticket_sub_category_fields WHERE sub_category_id = @id', { id });
    await executeQuery('DELETE FROM ticket_sub_categories WHERE sub_category_id = @id', { id });
    if (categoryId) cacheService.invalidateSubCategories(categoryId);

    return res.status(200).json(
      createResponse(true, 'Sub-category deleted successfully')
    );
  } catch (error) {
    logger.error('Delete sub-category error', error);
    next(error);
  }
};

// ============================================
// SUB-CATEGORY CUSTOM FIELDS CRUD
// ============================================

/**
 * Get fields for a sub-category (admin view - includes inactive)
 */
const getFieldsBySubCategory = async (req, res, next) => {
  try {
    const { subCategoryId } = req.params;

    const query = `
      SELECT 
        field_id,
        sub_category_id,
        field_name,
        field_label,
        field_type,
        is_required,
        placeholder,
        options,
        display_order,
        is_active,
        created_at
      FROM ticket_sub_category_fields
      WHERE sub_category_id = @subCategoryId
      ORDER BY display_order
    `;

    const result = await executeQuery(query, { subCategoryId });

    const fields = result.recordset.map(f => ({
      ...f,
      options: f.options ? JSON.parse(f.options) : null,
    }));

    return res.status(200).json(
      createResponse(true, 'Fields fetched successfully', fields)
    );
  } catch (error) {
    logger.error('Get fields error', error);
    next(error);
  }
};

/**
 * Create a custom field for a sub-category
 */
const createField = async (req, res, next) => {
  try {
    const { sub_category_id, field_name, field_label, field_type, is_required, placeholder, options, display_order } = req.body;

    if (!sub_category_id || !field_name || !field_label) {
      return res.status(400).json(
        createResponse(false, 'Sub-category ID, field name, and field label are required')
      );
    }

    const validTypes = ['text', 'textarea', 'number', 'select', 'date', 'email', 'tel', 'url', 'checkbox'];
    if (field_type && !validTypes.includes(field_type)) {
      return res.status(400).json(
        createResponse(false, `Invalid field type. Allowed: ${validTypes.join(', ')}`)
      );
    }

    const query = `
      INSERT INTO ticket_sub_category_fields (sub_category_id, field_name, field_label, field_type, is_required, placeholder, options, display_order)
      OUTPUT INSERTED.field_id
      VALUES (@subCategoryId, @fieldName, @fieldLabel, @fieldType, @isRequired, @placeholder, @options, @displayOrder)
    `;

    const result = await executeQuery(query, {
      subCategoryId: sub_category_id,
      fieldName: field_name,
      fieldLabel: field_label,
      fieldType: field_type || 'text',
      isRequired: is_required ? 1 : 0,
      placeholder: placeholder || null,
      options: options ? JSON.stringify(options) : null,
      displayOrder: display_order || 0,
    });

    cacheService.invalidateLookup(cacheService.KEYS.SUBCAT_FIELDS(sub_category_id));

    return res.status(201).json(
      createResponse(true, 'Field created successfully', { field_id: result.recordset[0].field_id })
    );
  } catch (error) {
    logger.error('Create field error', error);
    next(error);
  }
};

/**
 * Update a custom field
 */
const updateField = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { field_label, field_type, is_required, placeholder, options, display_order, is_active } = req.body;

    const query = `
      UPDATE ticket_sub_category_fields 
      SET field_label = COALESCE(@fieldLabel, field_label),
          field_type = COALESCE(@fieldType, field_type),
          is_required = COALESCE(@isRequired, is_required),
          placeholder = COALESCE(@placeholder, placeholder),
          options = COALESCE(@options, options),
          display_order = COALESCE(@displayOrder, display_order),
          is_active = COALESCE(@isActive, is_active)
      WHERE field_id = @id
    `;

    const fieldRes = await executeQuery('SELECT sub_category_id FROM ticket_sub_category_fields WHERE field_id = @id', { id });
    const subCategoryId = fieldRes.recordset[0]?.sub_category_id;

    await executeQuery(query, {
      id,
      fieldLabel: field_label || null,
      fieldType: field_type || null,
      isRequired: is_required !== undefined ? (is_required ? 1 : 0) : null,
      placeholder: placeholder !== undefined ? placeholder : null,
      options: options !== undefined ? JSON.stringify(options) : null,
      displayOrder: display_order !== undefined ? display_order : null,
      isActive: is_active !== undefined ? (is_active ? 1 : 0) : null,
    });

    if (subCategoryId) cacheService.invalidateLookup(cacheService.KEYS.SUBCAT_FIELDS(subCategoryId));

    return res.status(200).json(
      createResponse(true, 'Field updated successfully')
    );
  } catch (error) {
    logger.error('Update field error', error);
    next(error);
  }
};

/**
 * Delete a custom field
 */
const deleteField = async (req, res, next) => {
  try {
    const { id } = req.params;

    const fieldRes = await executeQuery('SELECT sub_category_id FROM ticket_sub_category_fields WHERE field_id = @id', { id });
    const subCategoryId = fieldRes.recordset[0]?.sub_category_id;

    // Check if any values exist
    const inUse = await executeQuery(
      'SELECT COUNT(*) as cnt FROM ticket_custom_field_values WHERE field_id = @id',
      { id }
    );

    if (inUse.recordset[0].cnt > 0) {
      await executeQuery(
        'UPDATE ticket_sub_category_fields SET is_active = 0 WHERE field_id = @id',
        { id }
      );
      if (subCategoryId) cacheService.invalidateLookup(cacheService.KEYS.SUBCAT_FIELDS(subCategoryId));
      return res.status(200).json(
        createResponse(true, 'Field deactivated (has existing values)')
      );
    }

    await executeQuery('DELETE FROM ticket_sub_category_fields WHERE field_id = @id', { id });
    if (subCategoryId) cacheService.invalidateLookup(cacheService.KEYS.SUBCAT_FIELDS(subCategoryId));

    return res.status(200).json(
      createResponse(true, 'Field deleted successfully')
    );
  } catch (error) {
    logger.error('Delete field error', error);
    next(error);
  }
};

// ============================================
// LOCATIONS CRUD
// ============================================

/**
 * Get all locations (admin view - includes inactive)
 */
const getAllLocations = async (req, res, next) => {
  try {
    const query = `
      SELECT 
        l.location_id,
        l.location_name,
        l.location_code,
        l.address,
        l.is_active,
        l.display_order,
        l.created_at,
        l.updated_at,
        (SELECT COUNT(*) FROM tickets t WHERE t.location_id = l.location_id) as ticket_count
      FROM locations l
      ORDER BY l.display_order, l.location_name
    `;

    const result = await executeQuery(query);

    return res.status(200).json(
      createResponse(true, 'Locations fetched successfully', result.recordset)
    );
  } catch (error) {
    logger.error('Get all locations error', error);
    next(error);
  }
};

/**
 * Create a new location
 */
const createLocation = async (req, res, next) => {
  try {
    const { location_name, location_code, address, display_order } = req.body;

    if (!location_name) {
      return res.status(400).json(
        createResponse(false, 'Location name is required')
      );
    }

    const dupCheck = await executeQuery(
      'SELECT COUNT(*) as cnt FROM locations WHERE location_name = @name',
      { name: location_name }
    );

    if (dupCheck.recordset[0].cnt > 0) {
      return res.status(400).json(
        createResponse(false, 'A location with this name already exists')
      );
    }

    const query = `
      INSERT INTO locations (location_name, location_code, address, display_order)
      OUTPUT INSERTED.location_id
      VALUES (@name, @code, @address, @displayOrder)
    `;

    const result = await executeQuery(query, {
      name: location_name,
      code: location_code || null,
      address: address || null,
      displayOrder: display_order || 0,
    });

    cacheService.invalidateLookup(cacheService.KEYS.LOCATIONS);

    return res.status(201).json(
      createResponse(true, 'Location created successfully', { location_id: result.recordset[0].location_id })
    );
  } catch (error) {
    logger.error('Create location error', error);
    next(error);
  }
};

/**
 * Update a location
 */
const updateLocation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { location_name, location_code, address, display_order, is_active } = req.body;

    const query = `
      UPDATE locations 
      SET location_name = COALESCE(@name, location_name),
          location_code = COALESCE(@code, location_code),
          address = COALESCE(@address, address),
          display_order = COALESCE(@displayOrder, display_order),
          is_active = COALESCE(@isActive, is_active),
          updated_at = GETDATE()
      WHERE location_id = @id
    `;

    await executeQuery(query, {
      id,
      name: location_name || null,
      code: location_code !== undefined ? location_code : null,
      address: address !== undefined ? address : null,
      displayOrder: display_order !== undefined ? display_order : null,
      isActive: is_active !== undefined ? (is_active ? 1 : 0) : null,
    });

    cacheService.invalidateLookup(cacheService.KEYS.LOCATIONS);

    return res.status(200).json(
      createResponse(true, 'Location updated successfully')
    );
  } catch (error) {
    logger.error('Update location error', error);
    next(error);
  }
};

/**
 * Delete a location
 */
const deleteLocation = async (req, res, next) => {
  try {
    const { id } = req.params;

    const inUse = await executeQuery(
      'SELECT COUNT(*) as cnt FROM tickets WHERE location_id = @id',
      { id }
    );

    if (inUse.recordset[0].cnt > 0) {
      await executeQuery(
        'UPDATE locations SET is_active = 0, updated_at = GETDATE() WHERE location_id = @id',
        { id }
      );
      cacheService.invalidateLookup(cacheService.KEYS.LOCATIONS);
      return res.status(200).json(
        createResponse(true, 'Location deactivated (in use by tickets)')
      );
    }

    await executeQuery('DELETE FROM locations WHERE location_id = @id', { id });
    cacheService.invalidateLookup(cacheService.KEYS.LOCATIONS);

    return res.status(200).json(
      createResponse(true, 'Location deleted successfully')
    );
  } catch (error) {
    logger.error('Delete location error', error);
    next(error);
  }
};

// ============================================
// PROCESSES / CLIENTS CRUD
// ============================================

/**
 * Get all processes (admin view - includes inactive)
 */
const getAllProcesses = async (req, res, next) => {
  try {
    const query = `
      SELECT 
        p.process_id,
        p.process_name,
        p.process_code,
        p.description,
        p.is_active,
        p.display_order,
        p.created_at,
        p.updated_at,
        (SELECT COUNT(*) FROM tickets t WHERE t.process_id = p.process_id) as ticket_count
      FROM processes p
      ORDER BY p.display_order, p.process_name
    `;

    const result = await executeQuery(query);

    return res.status(200).json(
      createResponse(true, 'Processes fetched successfully', result.recordset)
    );
  } catch (error) {
    logger.error('Get all processes error', error);
    next(error);
  }
};

/**
 * Create a new process/client
 */
const createProcess = async (req, res, next) => {
  try {
    const { process_name, process_code, description, display_order } = req.body;

    if (!process_name) {
      return res.status(400).json(
        createResponse(false, 'Process name is required')
      );
    }

    const dupCheck = await executeQuery(
      'SELECT COUNT(*) as cnt FROM processes WHERE process_name = @name',
      { name: process_name }
    );

    if (dupCheck.recordset[0].cnt > 0) {
      return res.status(400).json(
        createResponse(false, 'A process with this name already exists')
      );
    }

    const query = `
      INSERT INTO processes (process_name, process_code, description, display_order)
      OUTPUT INSERTED.process_id
      VALUES (@name, @code, @description, @displayOrder)
    `;

    const result = await executeQuery(query, {
      name: process_name,
      code: process_code || null,
      description: description || null,
      displayOrder: display_order || 0,
    });

    cacheService.invalidateLookup(cacheService.KEYS.PROCESSES);

    return res.status(201).json(
      createResponse(true, 'Process created successfully', { process_id: result.recordset[0].process_id })
    );
  } catch (error) {
    logger.error('Create process error', error);
    next(error);
  }
};

/**
 * Update a process/client
 */
const updateProcess = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { process_name, process_code, description, display_order, is_active } = req.body;

    const query = `
      UPDATE processes 
      SET process_name = COALESCE(@name, process_name),
          process_code = COALESCE(@code, process_code),
          description = COALESCE(@description, description),
          display_order = COALESCE(@displayOrder, display_order),
          is_active = COALESCE(@isActive, is_active),
          updated_at = GETDATE()
      WHERE process_id = @id
    `;

    await executeQuery(query, {
      id,
      name: process_name || null,
      code: process_code !== undefined ? process_code : null,
      description: description !== undefined ? description : null,
      displayOrder: display_order !== undefined ? display_order : null,
      isActive: is_active !== undefined ? (is_active ? 1 : 0) : null,
    });

    cacheService.invalidateLookup(cacheService.KEYS.PROCESSES);

    return res.status(200).json(
      createResponse(true, 'Process updated successfully')
    );
  } catch (error) {
    logger.error('Update process error', error);
    next(error);
  }
};

/**
 * Delete a process/client
 */
const deleteProcess = async (req, res, next) => {
  try {
    const { id } = req.params;

    const inUse = await executeQuery(
      'SELECT COUNT(*) as cnt FROM tickets WHERE process_id = @id',
      { id }
    );

    if (inUse.recordset[0].cnt > 0) {
      await executeQuery(
        'UPDATE processes SET is_active = 0, updated_at = GETDATE() WHERE process_id = @id',
        { id }
      );
      cacheService.invalidateLookup(cacheService.KEYS.PROCESSES);
      return res.status(200).json(
        createResponse(true, 'Process deactivated (in use by tickets)')
      );
    }

    await executeQuery('DELETE FROM processes WHERE process_id = @id', { id });
    cacheService.invalidateLookup(cacheService.KEYS.PROCESSES);

    return res.status(200).json(
      createResponse(true, 'Process deleted successfully')
    );
  } catch (error) {
    logger.error('Delete process error', error);
    next(error);
  }
};

module.exports = {
  // Sub-categories
  getAllSubCategories,
  createSubCategory,
  updateSubCategory,
  deleteSubCategory,
  // Custom Fields
  getFieldsBySubCategory,
  createField,
  updateField,
  deleteField,
  // Locations
  getAllLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  // Processes
  getAllProcesses,
  createProcess,
  updateProcess,
  deleteProcess,
};

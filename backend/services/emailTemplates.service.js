// ============================================
// EMAIL TEMPLATES SERVICE
// Database operations for email templates
// FILE: backend/services/emailTemplates.service.js
// ============================================

const { executeQuery } = require('../config/database');
const logger = require('../utils/logger');

// ============================================
// GET ALL EMAIL TEMPLATES
// ============================================
const getAllTemplates = async (filters = {}) => {
  try {
    let query = `
      SELECT 
        t.*,
        CONCAT(u1.first_name, ' ', u1.last_name) as created_by_name,
        CONCAT(u2.first_name, ' ', u2.last_name) as last_modified_by_name
      FROM email_templates t
      LEFT JOIN users u1 ON t.created_by = u1.user_id
      LEFT JOIN users u2 ON t.last_modified_by = u2.user_id
      WHERE 1=1
    `;

    const params = {};

    // Filter by category
    if (filters.category) {
      query += ` AND t.category = @category`;
      params.category = filters.category;
    }

    // Filter by active status
    if (filters.is_active !== undefined && filters.is_active !== null && filters.is_active !== '') {
      query += ` AND t.is_active = @is_active`;
      params.is_active = filters.is_active === 'true' || filters.is_active === true || filters.is_active === 1 ? 1 : 0;
    }

    // Filter by search (template_key, template_name, or description)
    if (filters.search) {
      query += ` AND (
        t.template_key LIKE @search OR 
        t.template_name LIKE @search OR 
        t.description LIKE @search
      )`;
      params.search = `%${filters.search}%`;
    }

    query += ` ORDER BY t.category, t.template_name`;

    const result = await executeQuery(query, params);

    // Parse variables_used JSON if it exists
    const templates = result.recordset.map(template => {
      let parsedTemplate = { ...template };
      
      // Try to parse variables_used if it's a string
      if (template.variables_used && typeof template.variables_used === 'string') {
        try {
          parsedTemplate.variables_used = JSON.parse(template.variables_used);
        } catch (e) {
          parsedTemplate.variables_used = [];
        }
      } else {
        parsedTemplate.variables_used = template.variables_used || [];
      }
      
      // Also parse available_variables if it exists
      if (template.available_variables && typeof template.available_variables === 'string') {
        try {
          parsedTemplate.available_variables = JSON.parse(template.available_variables);
        } catch (e) {
          parsedTemplate.available_variables = [];
        }
      }
      
      return parsedTemplate;
    });

    logger.info('Retrieved email templates', { count: templates.length });

    return templates;

  } catch (error) {
    logger.error('Get all templates failed', error);
    throw error;
  }
};

// ============================================
// GET TEMPLATE BY ID
// ============================================
const getTemplateById = async (templateId) => {
  try {
    const query = `
      SELECT 
        t.*,
        CONCAT(u1.first_name, ' ', u1.last_name) as created_by_name,
        CONCAT(u2.first_name, ' ', u2.last_name) as last_modified_by_name
      FROM email_templates t
      LEFT JOIN users u1 ON t.created_by = u1.user_id
      LEFT JOIN users u2 ON t.last_modified_by = u2.user_id
      WHERE t.template_id = @templateId
    `;

    const result = await executeQuery(query, { templateId });

    if (result.recordset.length === 0) {
      return null;
    }

    const template = result.recordset[0];

    // Parse variables_used JSON if it exists
    if (template.variables_used && typeof template.variables_used === 'string') {
      try {
        template.variables_used = JSON.parse(template.variables_used);
      } catch (e) {
        template.variables_used = [];
      }
    } else {
      template.variables_used = template.variables_used || [];
    }
    
    // Parse available_variables if it exists
    if (template.available_variables && typeof template.available_variables === 'string') {
      try {
        template.available_variables = JSON.parse(template.available_variables);
      } catch (e) {
        template.available_variables = [];
      }
    }

    logger.info('Retrieved email template', { templateId });

    return template;

  } catch (error) {
    logger.error('Get template by ID failed', error);
    throw error;
  }
};

// ============================================
// GET TEMPLATE BY KEY
// ============================================
const getTemplateByKey = async (templateKey) => {
  try {
    const query = `
      SELECT *
      FROM email_templates
      WHERE template_key = @templateKey
        AND is_active = 1
    `;

    const result = await executeQuery(query, { templateKey });

    if (result.recordset.length === 0) {
      logger.warn('Template not found', { templateKey });
      return null;
    }

    const template = result.recordset[0];

    // Parse JSON fields
    if (template.variables_used && typeof template.variables_used === 'string') {
      try {
        template.variables_used = JSON.parse(template.variables_used);
      } catch (e) {
        template.variables_used = [];
      }
    }
    
    if (template.available_variables && typeof template.available_variables === 'string') {
      try {
        template.available_variables = JSON.parse(template.available_variables);
      } catch (e) {
        template.available_variables = [];
      }
    }

    return template;

  } catch (error) {
    logger.error('Get template by key failed', error);
    throw error;
  }
};

// ============================================
// CREATE TEMPLATE
// ============================================
const createTemplate = async (templateData) => {
  try {
    const query = `
      INSERT INTO email_templates (
        template_key,
        template_name,
        subject_template,
        body_template,
        category,
        is_active,
        variables_used,
        description,
        created_by,
        created_at,
        updated_at
      )
      OUTPUT INSERTED.*
      VALUES (
        @template_key,
        @template_name,
        @subject_template,
        @body_template,
        @category,
        @is_active,
        @variables_used,
        @description,
        @created_by,
        GETDATE(),
        GETDATE()
      )
    `;

    const result = await executeQuery(query, templateData);

    const newTemplate = result.recordset[0];

    // Parse JSON fields
    if (newTemplate.variables_used && typeof newTemplate.variables_used === 'string') {
      try {
        newTemplate.variables_used = JSON.parse(newTemplate.variables_used);
      } catch (e) {
        newTemplate.variables_used = [];
      }
    }

    logger.success('Email template created', {
      templateId: newTemplate.template_id,
      templateKey: newTemplate.template_key
    });

    return newTemplate;

  } catch (error) {
    logger.error('Create template failed', error);
    throw error;
  }
};

// ============================================
// UPDATE TEMPLATE
// ============================================
const updateTemplate = async (templateId, updateData) => {
  try {
    // Build dynamic update query
    const setClause = [];
    const params = { templateId };

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        setClause.push(`${key} = @${key}`);
        params[key] = updateData[key];
      }
    });

    // Always update updated_at
    setClause.push('updated_at = GETDATE()');

    const query = `
      UPDATE email_templates
      SET ${setClause.join(', ')}
      OUTPUT INSERTED.*
      WHERE template_id = @templateId
    `;

    const result = await executeQuery(query, params);

    if (result.recordset.length === 0) {
      throw new Error('Template not found');
    }

    const updatedTemplate = result.recordset[0];

    // Parse JSON fields
    if (updatedTemplate.variables_used && typeof updatedTemplate.variables_used === 'string') {
      try {
        updatedTemplate.variables_used = JSON.parse(updatedTemplate.variables_used);
      } catch (e) {
        updatedTemplate.variables_used = [];
      }
    }

    logger.success('Email template updated', { templateId });

    return updatedTemplate;

  } catch (error) {
    logger.error('Update template failed', error);
    throw error;
  }
};

// ============================================
// DELETE TEMPLATE
// ============================================
const deleteTemplate = async (templateId) => {
  try {
    const query = `
      DELETE FROM email_templates
      WHERE template_id = @templateId
    `;

    await executeQuery(query, { templateId });

    logger.success('Email template deleted', { templateId });

    return true;

  } catch (error) {
    logger.error('Delete template failed', error);
    throw error;
  }
};

// ============================================
// GET TEMPLATES BY CATEGORY
// ============================================
const getTemplatesByCategory = async (category) => {
  try {
    const query = `
      SELECT *
      FROM email_templates
      WHERE category = @category
        AND is_active = 1
      ORDER BY template_name
    `;

    const result = await executeQuery(query, { category });

    const templates = result.recordset.map(template => {
      let parsedTemplate = { ...template };
      
      if (template.variables_used && typeof template.variables_used === 'string') {
        try {
          parsedTemplate.variables_used = JSON.parse(template.variables_used);
        } catch (e) {
          parsedTemplate.variables_used = [];
        }
      }
      
      return parsedTemplate;
    });

    return templates;

  } catch (error) {
    logger.error('Get templates by category failed', error);
    throw error;
  }
};

// ============================================
// GET ACTIVE TEMPLATES COUNT
// ============================================
const getActiveTemplatesCount = async () => {
  try {
    const query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive
      FROM email_templates
    `;

    const result = await executeQuery(query);

    return result.recordset[0];

  } catch (error) {
    logger.error('Get active templates count failed', error);
    throw error;
  }
};

// ============================================
// CHECK IF TEMPLATE KEY EXISTS
// ============================================
const templateKeyExists = async (templateKey, excludeId = null) => {
  try {
    let query = `
      SELECT COUNT(*) as count
      FROM email_templates
      WHERE template_key = @templateKey
    `;

    const params = { templateKey };

    if (excludeId) {
      query += ` AND template_id != @excludeId`;
      params.excludeId = excludeId;
    }

    const result = await executeQuery(query, params);

    return result.recordset[0].count > 0;

  } catch (error) {
    logger.error('Check template key exists failed', error);
    throw error;
  }
};

// ============================================
// EXPORT SERVICE FUNCTIONS
// ============================================
module.exports = {
  getAllTemplates,
  getTemplateById,
  getTemplateByKey,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getTemplatesByCategory,
  getActiveTemplatesCount,
  templateKeyExists
};
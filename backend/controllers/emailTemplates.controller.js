// ============================================
// EMAIL TEMPLATES CONTROLLER
// Handles email template CRUD operations
// FILE: backend/controllers/emailTemplates.controller.js
// ============================================

const emailTemplatesService = require('../services/emailTemplates.service');
const logger = require('../utils/logger');

// ============================================
// GET ALL EMAIL TEMPLATES
// GET /api/v1/email-templates
// ============================================
const getAllTemplates = async (req, res) => {
  try {
    const { category, is_active, search } = req.query;

    logger.info('Fetching email templates', {
      userId: req.user.user_id,
      filters: { category, is_active, search }
    });

    const templates = await emailTemplatesService.getAllTemplates({
      category,
      is_active,
      search
    });

    return res.status(200).json({
      success: true,
      message: 'Email templates retrieved successfully',
      data: templates
    });

  } catch (error) {
    logger.error('Get all templates failed', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve email templates',
      error: error.message
    });
  }
};

// ============================================
// GET SINGLE EMAIL TEMPLATE
// GET /api/v1/email-templates/:id
// ============================================
const getTemplateById = async (req, res) => {
  try {
    const { id } = req.params;

    logger.info('Fetching email template', {
      userId: req.user.user_id,
      templateId: id
    });

    const template = await emailTemplatesService.getTemplateById(id);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Email template not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Email template retrieved successfully',
      data: template
    });

  } catch (error) {
    logger.error('Get template by ID failed', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve email template',
      error: error.message
    });
  }
};

// ============================================
// CREATE EMAIL TEMPLATE
// POST /api/v1/email-templates
// ============================================
const createTemplate = async (req, res) => {
  try {
    const {
      template_key,
      template_name,
      subject_template,
      body_template,
      category,
      is_active,
      variables_used,
      description
    } = req.body;

    // Validation
    if (!template_key || !template_name || !subject_template || !body_template) {
      return res.status(400).json({
        success: false,
        message: 'Template key, name, subject, and body are required'
      });
    }

    logger.info('Creating email template', {
      userId: req.user.user_id,
      templateKey: template_key
    });

    const templateData = {
      template_key,
      template_name,
      subject_template,
      body_template,
      category: category || 'general',
      is_active: is_active !== undefined ? is_active : true,
      variables_used: variables_used ? JSON.stringify(variables_used) : null,
      description: description || null,
      created_by: req.user.user_id
    };

    const newTemplate = await emailTemplatesService.createTemplate(templateData);

    logger.success('Email template created', {
      templateId: newTemplate.template_id,
      templateKey: template_key
    });

    return res.status(201).json({
      success: true,
      message: 'Email template created successfully',
      data: newTemplate
    });

  } catch (error) {
    logger.error('Create template failed', error);

    // Check for duplicate key error
    if (error.message.includes('duplicate') || error.message.includes('unique')) {
      return res.status(409).json({
        success: false,
        message: 'Template key already exists'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to create email template',
      error: error.message
    });
  }
};

// ============================================
// UPDATE EMAIL TEMPLATE
// PUT /api/v1/email-templates/:id
// ============================================
const updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      template_name,
      subject_template,
      body_template,
      category,
      is_active,
      variables_used,
      description
    } = req.body;

    logger.info('Updating email template', {
      userId: req.user.user_id,
      templateId: id
    });

    // Check if template exists
    const existingTemplate = await emailTemplatesService.getTemplateById(id);
    if (!existingTemplate) {
      return res.status(404).json({
        success: false,
        message: 'Email template not found'
      });
    }

    const updateData = {
      template_name,
      subject_template,
      body_template,
      category,
      is_active,
      variables_used: variables_used ? JSON.stringify(variables_used) : null,
      description,
      last_modified_by: req.user.user_id
    };

    // Remove undefined values
    Object.keys(updateData).forEach(key => 
      updateData[key] === undefined && delete updateData[key]
    );

    const updatedTemplate = await emailTemplatesService.updateTemplate(id, updateData);

    logger.success('Email template updated', {
      templateId: id
    });

    return res.status(200).json({
      success: true,
      message: 'Email template updated successfully',
      data: updatedTemplate
    });

  } catch (error) {
    logger.error('Update template failed', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update email template',
      error: error.message
    });
  }
};

// ============================================
// DELETE EMAIL TEMPLATE
// DELETE /api/v1/email-templates/:id
// ============================================
const deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;

    logger.info('Deleting email template', {
      userId: req.user.user_id,
      templateId: id
    });

    // Check if template exists
    const existingTemplate = await emailTemplatesService.getTemplateById(id);
    if (!existingTemplate) {
      return res.status(404).json({
        success: false,
        message: 'Email template not found'
      });
    }

    await emailTemplatesService.deleteTemplate(id);

    logger.success('Email template deleted', {
      templateId: id,
      templateKey: existingTemplate.template_key
    });

    return res.status(200).json({
      success: true,
      message: 'Email template deleted successfully'
    });

  } catch (error) {
    logger.error('Delete template failed', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete email template',
      error: error.message
    });
  }
};

// ============================================
// PREVIEW EMAIL TEMPLATE
// POST /api/v1/email-templates/:id/preview
// ============================================
const previewTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { sampleData } = req.body;

    logger.info('Previewing email template', {
      userId: req.user.user_id,
      templateId: id
    });

    const template = await emailTemplatesService.getTemplateById(id);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Email template not found'
      });
    }

    // Default sample data if not provided
    const defaultSampleData = {
      ticket_id: '123',
      ticket_number: 'TKT-2025-001',
      ticket_title: 'Cannot access email',
      ticket_description: 'I cannot log into my email account. Getting error message.',
      ticket_priority: 'High',
      ticket_status: 'Open',
      ticket_category: 'Email Issues',
      ticket_url: 'https://helpdesk.com/tickets/123',
      user_name: 'John Doe',
      user_email: 'john@example.com',
      assigned_to_name: 'Jane Smith',
      assigned_to_email: 'jane@company.com',
      created_by_name: 'Admin User',
      system_name: 'Nexus Support',
      system_url: 'https://helpdesk.com',
      company_name: 'Your Company',
      created_date: new Date().toLocaleString(),
      updated_date: new Date().toLocaleString(),
      current_date: new Date().toLocaleDateString()
    };

    const data = sampleData || defaultSampleData;

    // Render template with sample data
    let renderedSubject = template.subject_template;
    let renderedBody = template.body_template;

    // Replace all variables
    Object.keys(data).forEach(key => {
      const placeholder = `{{${key}}}`;
      const regex = new RegExp(placeholder, 'g');
      renderedSubject = renderedSubject.replace(regex, data[key]);
      renderedBody = renderedBody.replace(regex, data[key]);
    });

    return res.status(200).json({
      success: true,
      message: 'Template preview generated successfully',
      data: {
        template_id: template.template_id,
        template_key: template.template_key,
        template_name: template.template_name,
        subject: renderedSubject,
        body: renderedBody,
        sample_data: data
      }
    });

  } catch (error) {
    logger.error('Preview template failed', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to preview email template',
      error: error.message
    });
  }
};

// ============================================
// TOGGLE TEMPLATE STATUS
// PATCH /api/v1/email-templates/:id/toggle
// ============================================
const toggleTemplateStatus = async (req, res) => {
  try {
    const { id } = req.params;

    logger.info('Toggling email template status', {
      userId: req.user.user_id,
      templateId: id
    });

    const template = await emailTemplatesService.getTemplateById(id);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Email template not found'
      });
    }

    const newStatus = !template.is_active;

    await emailTemplatesService.updateTemplate(id, {
      is_active: newStatus,
      last_modified_by: req.user.user_id
    });

    logger.success('Email template status toggled', {
      templateId: id,
      newStatus
    });

    return res.status(200).json({
      success: true,
      message: `Template ${newStatus ? 'activated' : 'deactivated'} successfully`,
      data: { is_active: newStatus }
    });

  } catch (error) {
    logger.error('Toggle template status failed', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to toggle template status',
      error: error.message
    });
  }
};

// ============================================
// EXPORT CONTROLLER FUNCTIONS
// ============================================
module.exports = {
  getAllTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  previewTemplate,
  toggleTemplateStatus
};
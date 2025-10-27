// ============================================
// EMAIL TEMPLATES ROUTES
// API routes for email template management
// FILE: backend/routes/emailTemplates.routes.js
// ============================================

const express = require('express');
const router = express.Router();
const emailTemplatesController = require('../controllers/emailTemplates.controller');
const { authenticate } = require('../middleware/auth');

// ============================================
// ALL ROUTES REQUIRE AUTHENTICATION
// ============================================
router.use(authenticate);

// ============================================
// PERMISSION CHECK MIDDLEWARE
// ============================================
const requireSystemAdmin = (req, res, next) => {
  if (!req.user?.permissions?.can_manage_system) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. System admin permission required.'
    });
  }
  next();
};

// Apply permission check to all routes
router.use(requireSystemAdmin);

// ============================================
// GET ALL EMAIL TEMPLATES
// GET /api/v1/email-templates
// Query params: ?category=ticket&is_active=true&search=created
// ============================================
router.get(
  '/',
  emailTemplatesController.getAllTemplates
);

// ============================================
// GET SINGLE EMAIL TEMPLATE
// GET /api/v1/email-templates/:id
// ============================================
router.get(
  '/:id',
  emailTemplatesController.getTemplateById
);

// ============================================
// CREATE EMAIL TEMPLATE
// POST /api/v1/email-templates
// Body: { template_key, template_name, subject_template, body_template, category, ... }
// ============================================
router.post(
  '/',
  emailTemplatesController.createTemplate
);

// ============================================
// UPDATE EMAIL TEMPLATE
// PUT /api/v1/email-templates/:id
// Body: { template_name, subject_template, body_template, ... }
// ============================================
router.put(
  '/:id',
  emailTemplatesController.updateTemplate
);

// ============================================
// DELETE EMAIL TEMPLATE
// DELETE /api/v1/email-templates/:id
// ============================================
router.delete(
  '/:id',
  emailTemplatesController.deleteTemplate
);

// ============================================
// PREVIEW EMAIL TEMPLATE
// POST /api/v1/email-templates/:id/preview
// Body: { sampleData: { ticket_number: 'TKT-001', ... } }
// ============================================
router.post(
  '/:id/preview',
  emailTemplatesController.previewTemplate
);

// ============================================
// TOGGLE TEMPLATE STATUS (ACTIVE/INACTIVE)
// PATCH /api/v1/email-templates/:id/toggle
// ============================================
router.patch(
  '/:id/toggle',
  emailTemplatesController.toggleTemplateStatus
);

// ============================================
// EXPORT ROUTER
// ============================================
module.exports = router;
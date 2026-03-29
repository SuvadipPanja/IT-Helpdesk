// ============================================
// STATUS ROUTES
// Known incident banners / service status
// GET is public (end-users can see)
// POST/PUT/DELETE require admin or IT Staff role
// ============================================

const express = require('express');
const router = express.Router();
const {
  getActiveIncidents,
  getAllIncidents,
  createIncident,
  updateIncident,
  deleteIncident,
} = require('../controllers/status.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validateRequest');
const { body } = require('express-validator');

// ============================================
// PUBLIC: Active incidents (shown in banner)
// ============================================
router.get('/active', getActiveIncidents);

// ============================================
// PROTECTED: Manage incidents
// ============================================
router.use(authenticate);

const incidentValidator = [
  body('title')
    .trim().notEmpty().withMessage('Title is required')
    .isLength({ max: 255 }).withMessage('Title max 255 chars'),
  body('description')
    .trim().notEmpty().withMessage('Description is required')
    .isLength({ max: 2000 }).withMessage('Description max 2000 chars'),
  body('severity')
    .optional()
    .isIn(['info', 'low', 'medium', 'high', 'critical']).withMessage('Invalid severity'),
  body('affected_services')
    .optional()
    .isLength({ max: 500 }).withMessage('Affected services max 500 chars'),
];

router.get('/', authorize('can_manage_incidents'), getAllIncidents);
router.post('/', authorize('can_manage_incidents'), incidentValidator, validateRequest, createIncident);
router.put('/:id', authorize('can_manage_incidents'), updateIncident);
router.delete('/:id', authorize('can_manage_incidents'), deleteIncident);

module.exports = router;

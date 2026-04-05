// ============================================
// CR (Change Request) VALIDATORS
// express-validator chains for CR endpoints
// ============================================

const { body, query, param } = require('express-validator');

const VALID_RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const VALID_SYSTEM_TYPES = ['SERVER', 'APPLICATION', 'NETWORK', 'DATABASE', 'CLOUD', 'OTHER'];
const VALID_IMPACT_LEVELS = ['LOW', 'MEDIUM', 'HIGH'];
const OPTIONAL_VALUE = { nullable: true, checkFalsy: true };

const createCRValidator = [
  body('title')
    .trim()
    .notEmpty().withMessage('Title is required')
    .isLength({ min: 5, max: 200 }).withMessage('Title must be between 5 and 200 characters'),
  body('description')
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
  body('cr_type_id')
    .notEmpty().withMessage('Change type is required')
    .isInt({ min: 1 }).withMessage('Change type ID must be a positive integer'),
  body('risk_level')
    .optional(OPTIONAL_VALUE)
    .isIn(VALID_RISK_LEVELS).withMessage('Risk level must be LOW, MEDIUM, HIGH, or CRITICAL'),
  body('cr_category_id')
    .optional(OPTIONAL_VALUE)
    .isInt({ min: 1 }).withMessage('Category ID must be a positive integer'),
  body('cr_sub_category_id')
    .optional(OPTIONAL_VALUE)
    .isInt({ min: 1 }).withMessage('Sub-category ID must be a positive integer'),
  body('priority_id')
    .optional(OPTIONAL_VALUE)
    .isInt({ min: 1 }).withMessage('Priority ID must be a positive integer'),
  body('department_id')
    .optional(OPTIONAL_VALUE)
    .isInt({ min: 1 }).withMessage('Department ID must be a positive integer'),
  body('location_id')
    .optional(OPTIONAL_VALUE)
    .isInt({ min: 1 }).withMessage('Location ID must be a positive integer'),
  body('process_id')
    .optional(OPTIONAL_VALUE)
    .isInt({ min: 1 }).withMessage('Process ID must be a positive integer'),
  body('requested_for_id')
    .optional(OPTIONAL_VALUE)
    .isInt({ min: 1 }).withMessage('Requested for ID must be a positive integer'),
  body('related_ticket_id')
    .optional(OPTIONAL_VALUE)
    .isInt({ min: 1 }).withMessage('Related ticket ID must be a positive integer'),
  body('estimated_downtime_mins')
    .optional(OPTIONAL_VALUE)
    .isInt({ min: 0 }).withMessage('Estimated downtime must be a non-negative integer'),
  body('users_affected_count')
    .optional(OPTIONAL_VALUE)
    .isInt({ min: 0 }).withMessage('Users affected count must be a non-negative integer'),
  body('proposed_start')
    .optional(OPTIONAL_VALUE)
    .isISO8601().withMessage('Proposed start must be a valid date'),
  body('proposed_end')
    .optional(OPTIONAL_VALUE)
    .isISO8601().withMessage('Proposed end must be a valid date'),
];

const updateCRValidator = [
  param('id')
    .isInt({ min: 1 }).withMessage('CR ID must be a positive integer'),
  body('title')
    .optional(OPTIONAL_VALUE)
    .trim()
    .isLength({ min: 5, max: 200 }).withMessage('Title must be between 5 and 200 characters'),
  body('description')
    .optional(OPTIONAL_VALUE)
    .trim()
    .isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
  body('risk_level')
    .optional(OPTIONAL_VALUE)
    .isIn(VALID_RISK_LEVELS).withMessage('Risk level must be LOW, MEDIUM, HIGH, or CRITICAL'),
];

const crQueryValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 200 }).withMessage('Limit must be between 1 and 200'),
  query('risk_level')
    .optional()
    .isIn([...VALID_RISK_LEVELS, '']).withMessage('Invalid risk level'),
];

const addCRCommentValidator = [
  param('id')
    .isInt({ min: 1 }).withMessage('CR ID must be a positive integer'),
  body('comment_text')
    .trim()
    .notEmpty().withMessage('Comment text is required')
    .isLength({ min: 1, max: 5000 }).withMessage('Comment must be between 1 and 5000 characters'),
  body('is_internal')
    .optional()
    .isBoolean().withMessage('is_internal must be a boolean'),
];

const scheduleCRValidator = [
  param('id')
    .isInt({ min: 1 }).withMessage('CR ID must be a positive integer'),
  body('scheduled_start')
    .notEmpty().withMessage('Scheduled start is required')
    .isISO8601().withMessage('Scheduled start must be a valid date'),
  body('scheduled_end')
    .notEmpty().withMessage('Scheduled end is required')
    .isISO8601().withMessage('Scheduled end must be a valid date'),
];

const completeCRValidator = [
  param('id')
    .isInt({ min: 1 }).withMessage('CR ID must be a positive integer'),
  body('implementation_notes')
    .optional()
    .trim()
    .isLength({ max: 10000 }).withMessage('Implementation notes must be 10000 characters or fewer'),
  body('pir_notes')
    .optional()
    .trim()
    .isLength({ max: 10000 }).withMessage('PIR notes must be 10000 characters or fewer'),
  body('pir_outcome')
    .optional()
    .isIn(['Successful', 'Partially Successful', 'Failed', 'Rolled Back'])
    .withMessage('Invalid PIR outcome'),
];

module.exports = {
  createCRValidator,
  updateCRValidator,
  crQueryValidator,
  addCRCommentValidator,
  scheduleCRValidator,
  completeCRValidator,
};

// ============================================
// TICKET VALIDATORS
// express-validator chains for ticket endpoints
// ============================================

const { body, query, param } = require('express-validator');

const ALLOWED_PRIORITIES = ['low', 'medium', 'high', 'critical', '1', '2', '3', '4'];

const createTicketValidator = [
  body('subject')
    .trim()
    .notEmpty().withMessage('Subject is required')
    .isLength({ min: 5, max: 255 }).withMessage('Subject must be between 5 and 255 characters'),
  body('description')
    .trim()
    .notEmpty().withMessage('Description is required')
    .isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
  body('category_id')
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage('Category ID must be a positive integer'),
  body('priority_id')
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage('Priority ID must be a positive integer'),
  body('department_id')
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage('Department ID must be a positive integer'),
  body('guidance_payload')
    .optional({ nullable: true })
    .isObject().withMessage('Guidance payload must be an object'),
];

const updateTicketValidator = [
  param('id')
    .isInt({ min: 1 }).withMessage('Ticket ID must be a positive integer'),
  body('subject')
    .optional()
    .trim()
    .isLength({ min: 5, max: 255 }).withMessage('Subject must be between 5 and 255 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ min: 10 }).withMessage('Description must be at least 10 characters'),
];

const addCommentValidator = [
  param('id')
    .isInt({ min: 1 }).withMessage('Ticket ID must be a positive integer'),
  body('comment_text')
    .trim()
    .notEmpty().withMessage('Comment content is required')
    .isLength({ min: 1, max: 5000 }).withMessage('Comment must be between 1 and 5000 characters'),
];

const ticketQueryValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 200 }).withMessage('Limit must be between 1 and 200'),
  query('status')
    .optional()
    .isIn(['open', 'in-progress', 'pending', 'resolved', 'closed', 'all'])
    .withMessage('Invalid status value'),
];

module.exports = {
  createTicketValidator,
  updateTicketValidator,
  addCommentValidator,
  ticketQueryValidator,
};

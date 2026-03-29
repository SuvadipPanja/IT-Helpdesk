// ============================================
// USER VALIDATORS
// express-validator chains for user endpoints
// ============================================

const { body, param } = require('express-validator');

const createUserValidator = [
  body('username')
    .trim()
    .notEmpty().withMessage('Username is required')
    .isLength({ min: 3, max: 50 }).withMessage('Username must be between 3 and 50 characters')
    .matches(/^[a-zA-Z0-9_.-]+$/).withMessage('Username can only contain letters, numbers, underscores, dots, and hyphens'),
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Must be a valid email address')
    .normalizeEmail()
    .isLength({ max: 255 }).withMessage('Email must be 255 characters or fewer'),
  body('full_name')
    .optional()
    .trim()
    .isLength({ max: 255 }).withMessage('Full name must be 255 characters or fewer'),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number'),
  body('role_id')
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage('Role ID must be a positive integer'),
  body('department_id')
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage('Department ID must be a positive integer'),
];

const updateUserValidator = [
  param('id')
    .isInt({ min: 1 }).withMessage('User ID must be a positive integer'),
  body('email')
    .optional()
    .trim()
    .isEmail().withMessage('Must be a valid email address')
    .normalizeEmail(),
  body('full_name')
    .optional()
    .trim()
    .isLength({ max: 255 }).withMessage('Full name must be 255 characters or fewer'),
];

module.exports = {
  createUserValidator,
  updateUserValidator,
};

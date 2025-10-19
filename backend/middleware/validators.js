// ============================================
// Validation Middleware
// Common validation rules for API endpoints
// ============================================

const { body, param, query, validationResult } = require('express-validator');
const { createResponse } = require('../utils/helpers');
const logger = require('../utils/logger');

/**
 * Handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((err) => ({
      field: err.path,
      message: err.msg,
    }));

    logger.warn('Validation failed', {
      url: req.originalUrl,
      errors: errorMessages,
      userId: req.user?.user_id || 'Anonymous',
    });

    return res.status(400).json(
      createResponse(false, 'Validation failed', null, { errors: errorMessages })
    );
  }

  next();
};

/**
 * Login validation rules
 */
const validateLogin = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username is required')
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be between 3 and 50 characters'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  
  handleValidationErrors,
];

/**
 * User creation validation rules
 */
const validateUserCreation = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username is required')
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be between 3 and 50 characters')
    .matches(/^[a-zA-Z0-9._]+$/)  // CHANGED: Added dot (.)
    .withMessage('Username can only contain letters, numbers, dots, and underscores'),
  
  // ... rest remains the same
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number')
    .matches(/[!@#$%^&*(),.?":{}|<>]/)
    .withMessage('Password must contain at least one special character'),
  
  body('first_name')
    .trim()
    .notEmpty()
    .withMessage('First name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  
  body('last_name')
    .trim()
    .notEmpty()
    .withMessage('Last name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  
  body('role_id')
    .notEmpty()
    .withMessage('Role is required')
    .isInt({ min: 1 })
    .withMessage('Invalid role ID'),
  
  body('department_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Invalid department ID'),
  
  body('phone_number')
    .optional()
    .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/)
    .withMessage('Invalid phone number format'),
  
  handleValidationErrors,
];

/**
 * User update validation rules
 */
const validateUserUpdate = [
  body('email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail(),
  
  body('first_name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  
  body('last_name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  
  body('role_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Invalid role ID'),
  
  body('department_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Invalid department ID'),
  
  body('phone_number')
    .optional()
    .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/)
    .withMessage('Invalid phone number format'),
  
  handleValidationErrors,
];

/**
 * Ticket creation validation rules
 */
const validateTicketCreation = [
  body('subject')
    .trim()
    .notEmpty()
    .withMessage('Subject is required')
    .isLength({ min: 5, max: 200 })
    .withMessage('Subject must be between 5 and 200 characters'),
  
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Description is required')
    .isLength({ min: 10, max: 5000 })
    .withMessage('Description must be between 10 and 5000 characters'),
  
  body('category_id')
    .notEmpty()
    .withMessage('Category is required')
    .isInt({ min: 1 })
    .withMessage('Invalid category ID'),
  
  body('priority_id')
    .notEmpty()
    .withMessage('Priority is required')
    .isInt({ min: 1 })
    .withMessage('Invalid priority ID'),
  
  body('department_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Invalid department ID'),
  
  handleValidationErrors,
];

/**
 * Ticket update validation rules
 */
const validateTicketUpdate = [
  body('subject')
    .optional()
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Subject must be between 5 and 200 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ min: 10, max: 5000 })
    .withMessage('Description must be between 10 and 5000 characters'),
  
  body('category_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Invalid category ID'),
  
  body('priority_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Invalid priority ID'),
  
  body('status_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Invalid status ID'),
  
  body('assigned_to')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Invalid user ID'),
  
  handleValidationErrors,
];

/**
 * Department validation rules
 */
const validateDepartment = [
  body('department_name')
    .trim()
    .notEmpty()
    .withMessage('Department name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Department name must be between 2 and 100 characters'),
  
  body('department_code')
    .trim()
    .notEmpty()
    .withMessage('Department code is required')
    .isLength({ min: 2, max: 20 })
    .withMessage('Department code must be between 2 and 20 characters')
    .matches(/^[A-Z0-9_]+$/)
    .withMessage('Department code can only contain uppercase letters, numbers, and underscores'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  
  handleValidationErrors,
];

/**
 * Role validation rules
 */
const validateRole = [
  body('role_name')
    .trim()
    .notEmpty()
    .withMessage('Role name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Role name must be between 2 and 50 characters'),
  
  body('role_code')
    .trim()
    .notEmpty()
    .withMessage('Role code is required')
    .isLength({ min: 2, max: 20 })
    .withMessage('Role code must be between 2 and 20 characters')
    .matches(/^[A-Z0-9_]+$/)
    .withMessage('Role code can only contain uppercase letters, numbers, and underscores'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  
  handleValidationErrors,
];

/**
 * Comment validation rules
 */
const validateComment = [
  body('comment_text')
    .trim()
    .notEmpty()
    .withMessage('Comment text is required')
    .isLength({ min: 1, max: 2000 })
    .withMessage('Comment must be between 1 and 2000 characters'),
  
  body('is_internal')
    .optional()
    .isBoolean()
    .withMessage('is_internal must be a boolean'),
  
  handleValidationErrors,
];

/**
 * ID parameter validation
 */
const validateId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Invalid ID parameter'),
  
  handleValidationErrors,
];

/**
 * Pagination validation
 */
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  handleValidationErrors,
];

module.exports = {
  validateLogin,
  validateUserCreation,
  validateUserUpdate,
  validateTicketCreation,
  validateTicketUpdate,
  validateDepartment,
  validateRole,
  validateComment,
  validateId,
  validatePagination,
  handleValidationErrors,
}; 

// ============================================
// AUTH VALIDATORS
// express-validator chains for auth endpoints
// ============================================

const { body } = require('express-validator');

const loginValidator = [
  body('username')
    .trim()
    .notEmpty().withMessage('Username is required')
    .isLength({ max: 100 }).withMessage('Username must be 100 characters or fewer'),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ max: 200 }).withMessage('Password must be 200 characters or fewer'),
];

const changePasswordValidator = [
  body('currentPassword')
    .notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .notEmpty().withMessage('New password is required')
    .isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('New password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('New password must contain at least one lowercase letter')
    .matches(/[0-9]/).withMessage('New password must contain at least one number')
    .matches(/[@$!%*?&#^()_\-+=]/).withMessage('New password must contain at least one special character'),
];

const forgotPasswordValidator = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Must be a valid email address')
    .normalizeEmail(),
];

const resetPasswordValidator = [
  body('token')
    .trim()
    .notEmpty().withMessage('Reset token is required'),
  body('newPassword')
    .notEmpty().withMessage('New password is required')
    .isLength({ min: 8 }).withMessage('Must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Must contain at least one uppercase letter')
    .matches(/[0-9]/).withMessage('Must contain at least one number'),
];

const verifyTwoFactorValidator = [
  body('code')
    .trim()
    .notEmpty().withMessage('Verification code is required')
    .isLength({ min: 6, max: 8 }).withMessage('Code must be 6-8 characters'),
];

module.exports = {
  loginValidator,
  changePasswordValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  verifyTwoFactorValidator,
};

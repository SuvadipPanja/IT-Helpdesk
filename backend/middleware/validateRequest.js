// ============================================
// VALIDATE REQUEST MIDDLEWARE
// Wraps express-validator validationResult
// and returns a consistent 400 response on errors
// ============================================

const { validationResult } = require('express-validator');

/**
 * Call after express-validator chains.
 * Returns 400 with structured errors if validation fails.
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map((e) => ({
        field: e.path || e.param,
        message: e.msg,
      })),
    });
  }
  next();
};

module.exports = { validateRequest };

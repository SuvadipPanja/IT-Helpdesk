// ============================================
// Helper Utility Functions
// Common utility functions used across the application
// ============================================

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const logger = require('./logger');

/**
 * Hash password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
const hashPassword = async (password) => {
  try {
    logger.try('Hashing password');
    const salt = await bcrypt.genSalt(config.security.bcryptRounds);
    const hashedPassword = await bcrypt.hash(password, salt);
    logger.success('Password hashed successfully');
    return hashedPassword;
  } catch (error) {
    logger.error('Failed to hash password', error);
    throw new Error('Password hashing failed');
  }
};

/**
 * Compare password with hash
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>} Match result
 */
const comparePassword = async (password, hash) => {
  try {
    logger.try('Comparing password with hash');
    const isMatch = await bcrypt.compare(password, hash);
    
    if (isMatch) {
      logger.success('Password comparison successful - Match found');
    } else {
      logger.warn('Password comparison completed - No match');
    }
    
    return isMatch;
  } catch (error) {
    logger.error('Failed to compare password', error);
    throw new Error('Password comparison failed');
  }
};

/**
 * Generate JWT token
 * @param {Object} payload - Token payload
 * @param {string} expiresIn - Token expiration time
 * @returns {string} JWT token
 */
const generateToken = (payload, expiresIn = config.jwt.expire) => {
  try {
    logger.try('Generating JWT token', { userId: payload.user_id });
    
    const token = jwt.sign(payload, config.jwt.secret, {
      expiresIn,
      issuer: 'ITHelpdesk',
      audience: 'ITHelpdesk-Users',
    });
    
    logger.success('JWT token generated successfully', {
      userId: payload.user_id,
      expiresIn,
    });
    
    return token;
  } catch (error) {
    logger.error('Failed to generate JWT token', error);
    throw new Error('Token generation failed');
  }
};

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @returns {Object} Decoded token payload
 */
const verifyToken = (token) => {
  try {
    logger.try('Verifying JWT token');
    
    const decoded = jwt.verify(token, config.jwt.secret, {
      issuer: 'ITHelpdesk',
      audience: 'ITHelpdesk-Users',
    });
    
    logger.success('JWT token verified successfully', {
      userId: decoded.user_id,
    });
    
    return decoded;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      logger.warn('JWT token expired', { expiredAt: error.expiredAt });
      throw new Error('Token expired');
    } else if (error.name === 'JsonWebTokenError') {
      logger.warn('Invalid JWT token', { message: error.message });
      throw new Error('Invalid token');
    } else {
      logger.error('JWT token verification failed', error);
      throw new Error('Token verification failed');
    }
  }
};

/**
 * Generate random string
 * @param {number} length - String length
 * @returns {string} Random string
 */
const generateRandomString = (length = 32) => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  
  return result;
};

/**
 * Sanitize user input
 * @param {string} input - User input
 * @returns {string} Sanitized input
 */
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .substring(0, 1000); // Limit length
};

/**
 * Format file size
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Validate email format
 * @param {string} email - Email address
 * @returns {boolean} Validation result
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate password strength
 * @param {string} password - Password
 * @returns {Object} Validation result with details
 */
const validatePasswordStrength = (password) => {
  const minLength = config.security.passwordMinLength || 8;
  const errors = [];
  
  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`);
  }
  
  if (config.security.passwordRequireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (config.security.passwordRequireNumber && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (config.security.passwordRequireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Generate pagination metadata
 * @param {number} totalRecords - Total number of records
 * @param {number} page - Current page
 * @param {number} limit - Records per page
 * @returns {Object} Pagination metadata
 */
const getPaginationMeta = (totalRecords, page, limit) => {
  const totalPages = Math.ceil(totalRecords / limit);
  
  return {
    totalRecords,
    totalPages,
    currentPage: page,
    recordsPerPage: limit,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
};

/**
 * Calculate date difference in hours
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {number} Difference in hours
 */
const getHoursDifference = (startDate, endDate) => {
  const diffMs = endDate - startDate;
  return Math.floor(diffMs / (1000 * 60 * 60));
};

/**
 * Format date to IST string
 * @param {Date} date - Date object
 * @returns {string} Formatted date string in IST
 */
const formatDateIST = (date) => {
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(date.getTime() + istOffset);
  
  return istTime.toISOString().replace('T', ' ').substring(0, 19) + ' IST';
};

/**
 * Create API response object
 * @param {boolean} success - Success status
 * @param {string} message - Response message
 * @param {Object} data - Response data
 * @param {Object} meta - Additional metadata
 * @returns {Object} Formatted API response
 */
const createResponse = (success, message, data = null, meta = null) => {
  const response = {
    success,
    message,
    timestamp: new Date().toISOString(),
  };
  
  if (data !== null) {
    response.data = data;
  }
  
  if (meta !== null) {
    response.meta = meta;
  }
  
  return response;
};

/**
 * Handle async route errors
 * @param {Function} fn - Async function
 * @returns {Function} Wrapped function with error handling
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Sleep function for delays
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} Promise that resolves after delay
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = {
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  generateRandomString,
  sanitizeInput,
  formatFileSize,
  isValidEmail,
  validatePasswordStrength,
  getPaginationMeta,
  getHoursDifference,
  formatDateIST,
  createResponse,
  asyncHandler,
  sleep,
}; 

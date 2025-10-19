// ============================================
// Error Handler Middleware
// Centralized error handling for all routes
// ============================================

const logger = require('../utils/logger');
const { createResponse } = require('../utils/helpers');

/**
 * Error handler middleware
 * Catches all errors and sends formatted response
 */
const errorHandler = (err, req, res, next) => {
  // Log the error
  logger.error('Error Handler Caught Exception', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userId: req.user?.user_id || 'Anonymous',
  });

  // Default error
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // SQL errors
  if (err.number) {
    // SQL Server specific errors
    switch (err.number) {
      case 2627: // Unique constraint violation
        statusCode = 409;
        message = 'Duplicate entry found';
        break;
      case 547: // Foreign key violation
        statusCode = 400;
        message = 'Invalid reference';
        break;
      default:
        statusCode = 500;
        message = 'Database error';
    }
  }

  // Send error response
  res.status(statusCode).json(
    createResponse(false, message, null, {
      error: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    })
  );
};

/**
 * 404 Not Found handler
 */
const notFoundHandler = (req, res) => {
  logger.warn('404 Route Not Found', {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
  });

  res.status(404).json(
    createResponse(false, 'Route not found', null, {
      requestedUrl: req.originalUrl,
      method: req.method,
    })
  );
};

module.exports = {
  errorHandler,
  notFoundHandler,
}; 

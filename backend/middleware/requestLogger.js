// ============================================
// Request Logger Middleware
// Logs all incoming HTTP requests
// ============================================

const logger = require('../utils/logger');

/**
 * Log incoming HTTP requests
 */
const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  // Log request
  logger.info('📥 Incoming Request', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
    contentType: req.get('content-type'),
    contentLength: req.get('content-length'),
  });

  // Log request body for non-GET requests (exclude sensitive fields)
  if (req.method !== 'GET' && req.body && Object.keys(req.body).length > 0) {
    const sanitizedBody = { ...req.body };
    
    // Remove sensitive fields from logs
    const sensitiveFields = ['password', 'password_hash', 'token', 'secret'];
    sensitiveFields.forEach((field) => {
      if (sanitizedBody[field]) {
        sanitizedBody[field] = '***HIDDEN***';
      }
    });

    logger.debug('Request Body', sanitizedBody);
  }

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    // Determine log level based on status code
    let logLevel = 'info';
    if (statusCode >= 500) {
      logLevel = 'error';
    } else if (statusCode >= 400) {
      logLevel = 'warn';
    } else if (statusCode >= 300) {
      logLevel = 'info';
    } else {
      logLevel = 'success';
    }

    logger[logLevel]('📤 Response Sent', {
      method: req.method,
      url: req.originalUrl,
      statusCode: statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('content-length'),
      userId: req.user?.user_id || 'Anonymous',
    });
  });

  next();
};

module.exports = requestLogger;
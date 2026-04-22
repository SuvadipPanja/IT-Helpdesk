// ============================================
// Request Logger Middleware
// Logs all incoming HTTP requests
// ============================================

const logger = require('../utils/logger');
const { getClientIp } = require('../utils/clientIp');

const REDACTED_VALUE = '***HIDDEN***';
const SENSITIVE_KEY_FRAGMENTS = [
  'password',
  'secret',
  'token',
  'apikey',
  'authkey',
  'authorization',
  'cookie',
  'privatekey',
  'publickey',
  'recoverykey',
  'licensekey',
  'clientsecret',
  'sessionkey',
];

const isSensitiveKey = (key) => {
  const normalizedKey = String(key || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return SENSITIVE_KEY_FRAGMENTS.some((fragment) => normalizedKey.includes(fragment));
};

const sanitizeForLogging = (value) => {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeForLogging(entry));
  }

  if (Buffer.isBuffer(value)) {
    return `[Buffer ${value.length} bytes]`;
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.entries(value).reduce((sanitized, [key, entryValue]) => {
    sanitized[key] = isSensitiveKey(key)
      ? REDACTED_VALUE
      : sanitizeForLogging(entryValue);
    return sanitized;
  }, {});
};

/**
 * Log incoming HTTP requests
 */
const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  // Log request
  logger.info('📥 Incoming Request', {
    method: req.method,
    url: req.originalUrl,
    ip: getClientIp(req),
    userAgent: req.get('user-agent'),
    contentType: req.get('content-type'),
    contentLength: req.get('content-length'),
  });

  // Log request body for non-GET requests (exclude sensitive fields)
  if (req.method !== 'GET' && req.body && Object.keys(req.body).length > 0) {
    logger.debug('Request Body', sanitizeForLogging(req.body));
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
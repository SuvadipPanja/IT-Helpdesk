// ============================================
// Advanced Logger Utility
// Provides detailed logging with timestamps, colors, and file output
// ============================================

const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  
  // Foreground colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  // Background colors
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
};

// Log levels
const LOG_LEVELS = {
  ERROR: { name: 'ERROR', color: colors.red, priority: 0 },
  WARN: { name: 'WARN', color: colors.yellow, priority: 1 },
  INFO: { name: 'INFO', color: colors.cyan, priority: 2 },
  SUCCESS: { name: 'SUCCESS', color: colors.green, priority: 3 },
  DEBUG: { name: 'DEBUG', color: colors.magenta, priority: 4 },
  TRY: { name: 'TRY', color: colors.blue, priority: 5 },
  FAIL: { name: 'FAIL', color: colors.red, priority: 0 },
};

class Logger {
  constructor() {
    this.logsDir = path.join(__dirname, '../logs');
    this.currentLogLevel = process.env.LOG_LEVEL || 'DEBUG';
    this.enableFileLogging = process.env.ENABLE_FILE_LOGGING !== 'false';
    this.enableConsoleLogging = process.env.ENABLE_CONSOLE_LOGGING !== 'false';
    
    // Create logs directory if it doesn't exist
    if (this.enableFileLogging && !fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  /**
   * Get current IST timestamp
   * @returns {string} Formatted timestamp in IST
   */
  getISTTimestamp() {
    const now = new Date();
    
    // Convert to IST (UTC+5:30)
    const istOffset = 5.5 * 60 * 60 * 1000; // IST offset in milliseconds
    const istTime = new Date(now.getTime() + istOffset);
    
    const year = istTime.getUTCFullYear();
    const month = String(istTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(istTime.getUTCDate()).padStart(2, '0');
    const hours = String(istTime.getUTCHours()).padStart(2, '0');
    const minutes = String(istTime.getUTCMinutes()).padStart(2, '0');
    const seconds = String(istTime.getUTCSeconds()).padStart(2, '0');
    const milliseconds = String(istTime.getUTCMilliseconds()).padStart(3, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds} IST`;
  }

  /**
   * Get log filename for current date
   * @returns {string} Log filename
   */
  getLogFilename() {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(now.getTime() + istOffset);
    
    const year = istTime.getUTCFullYear();
    const month = String(istTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(istTime.getUTCDate()).padStart(2, '0');
    
    return `app-${year}-${month}-${day}.log`;
  }

  /**
   * Format log message
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} data - Additional data
   * @returns {Object} Formatted log object
   */
  formatMessage(level, message, data = {}) {
    return {
      timestamp: this.getISTTimestamp(),
      level: level,
      message: message,
      ...data,
    };
  }

  /**
   * Write log to file
   * @param {Object} logObject - Formatted log object
   */
  writeToFile(logObject) {
    if (!this.enableFileLogging) return;

    try {
      const logFilePath = path.join(this.logsDir, this.getLogFilename());
      const logLine = JSON.stringify(logObject) + '\n';
      
      fs.appendFileSync(logFilePath, logLine, 'utf8');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  /**
   * Write log to console
   * @param {string} level - Log level
   * @param {Object} logObject - Formatted log object
   */
  writeToConsole(level, logObject) {
    if (!this.enableConsoleLogging) return;

    const levelConfig = LOG_LEVELS[level];
    const color = levelConfig.color;
    const reset = colors.reset;
    
    // Format console output with colors
    const prefix = `${color}[${logObject.timestamp}] [${level}]${reset}`;
    const message = `${color}${logObject.message}${reset}`;
    
    console.log(prefix, message);
    
    // Print additional data if exists
    if (Object.keys(logObject).length > 3) {
      const additionalData = { ...logObject };
      delete additionalData.timestamp;
      delete additionalData.level;
      delete additionalData.message;
      
      console.log(`${color}Data:${reset}`, JSON.stringify(additionalData, null, 2));
    }
  }

  /**
   * Core logging method
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} data - Additional data
   */
  log(level, message, data = {}) {
    const logObject = this.formatMessage(level, message, data);
    
    // Write to console
    this.writeToConsole(level, logObject);
    
    // Write to file
    this.writeToFile(logObject);
  }

  // Convenience methods for different log levels
  
  /**
   * Log error message
   * @param {string} message - Error message
   * @param {Error|Object} error - Error object or additional data
   */
  error(message, error = {}) {
    const data = error instanceof Error 
      ? { 
          error: error.message, 
          stack: error.stack,
          code: error.code 
        }
      : error;
    
    this.log('ERROR', message, data);
  }

  /**
   * Log warning message
   * @param {string} message - Warning message
   * @param {Object} data - Additional data
   */
  warn(message, data = {}) {
    this.log('WARN', message, data);
  }

  /**
   * Log info message
   * @param {string} message - Info message
   * @param {Object} data - Additional data
   */
  info(message, data = {}) {
    this.log('INFO', message, data);
  }

  /**
   * Log success message
   * @param {string} message - Success message
   * @param {Object} data - Additional data
   */
  success(message, data = {}) {
    this.log('SUCCESS', message, data);
  }

  /**
   * Log debug message
   * @param {string} message - Debug message
   * @param {Object} data - Additional data
   */
  debug(message, data = {}) {
    this.log('DEBUG', message, data);
  }

  /**
   * Log try/attempt message
   * @param {string} message - Try message
   * @param {Object} data - Additional data
   */
  try(message, data = {}) {
    this.log('TRY', message, data);
  }

  /**
   * Log fail message
   * @param {string} message - Fail message
   * @param {Object} data - Additional data
   */
  fail(message, data = {}) {
    this.log('FAIL', message, data);
  }

  /**
   * Log API request
   * @param {Object} req - Express request object
   */
  logRequest(req) {
    this.info('Incoming API Request', {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
      userId: req.user?.user_id || 'Anonymous',
    });
  }

  /**
   * Log API response
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {number} duration - Request duration in ms
   */
  logResponse(req, res, duration) {
    const level = res.statusCode >= 400 ? 'ERROR' : 'SUCCESS';
    
    this.log(level, 'API Response Sent', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userId: req.user?.user_id || 'Anonymous',
    });
  }

  /**
   * Log database query
   * @param {string} query - SQL query
   * @param {Object} params - Query parameters
   * @param {number} duration - Query duration in ms
   */
  logQuery(query, params = {}, duration = 0) {
    this.debug('Database Query Executed', {
      query: query.substring(0, 200) + (query.length > 200 ? '...' : ''),
      paramCount: Object.keys(params).length,
      duration: `${duration}ms`,
    });
  }

  /**
   * Log authentication attempt
   * @param {string} username - Username
   * @param {boolean} success - Whether login succeeded
   * @param {string} ip - IP address
   */
  logAuth(username, success, ip) {
    if (success) {
      this.success('User Authentication Successful', {
        username,
        ip,
      });
    } else {
      this.warn('User Authentication Failed', {
        username,
        ip,
      });
    }
  }

  /**
   * Log file upload
   * @param {string} filename - Uploaded filename
   * @param {number} size - File size in bytes
   * @param {number} userId - User ID
   */
  logFileUpload(filename, size, userId) {
    this.info('File Uploaded', {
      filename,
      size: `${(size / 1024).toFixed(2)} KB`,
      userId,
    });
  }

  /**
   * Create separator line in logs
   * @param {string} title - Separator title
   */
  separator(title = '') {
    const line = '='.repeat(60);
    if (title) {
      this.info(`${line}\n${title}\n${line}`);
    } else {
      this.info(line);
    }
  }

  /**
   * Log application startup
   * @param {number} port - Server port
   * @param {string} env - Environment
   */
  logStartup(port, env) {
    this.separator('APPLICATION STARTED');
    this.success('Server is running', {
      port,
      environment: env,
      nodeVersion: process.version,
      platform: process.platform,
      pid: process.pid,
    });
    this.separator();
  }

  /**
   * Log application shutdown
   */
  logShutdown() {
    this.separator('APPLICATION SHUTDOWN');
    this.warn('Server is shutting down gracefully');
    this.separator();
  }
}

// Create singleton instance
const logger = new Logger();

module.exports = logger; 

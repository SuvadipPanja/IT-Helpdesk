// ============================================
// Configuration File (UPDATED)
// Loads and validates environment variables
// ============================================

require('dotenv').config();

const config = {
  // Server Configuration
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  apiPrefix: process.env.API_PREFIX || '/api/v1',

  // Database Configuration
  database: {
    server: process.env.DB_SERVER || 'localhost\\SQLEXPRESS',
    database: process.env.DB_NAME || 'ITHelpdesk',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT, 10) || 1433,
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
      enableArithAbort: true,
      connectionTimeout: 30000,
      requestTimeout: 30000,
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  },

  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'Suvadip',
    expire: process.env.JWT_EXPIRE || '8h',
    refreshExpire: process.env.JWT_REFRESH_EXPIRE || '7d',
  },

  // File Upload Configuration
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 10485760, // 10MB
    uploadPath: process.env.UPLOAD_PATH || './uploads',
    allowedFileTypes: process.env.ALLOWED_FILE_TYPES?.split(',') || [
      '.jpg', '.jpeg', '.png', '.pdf', '.doc', '.docx',
      '.xls', '.xlsx', '.txt', '.zip',
    ],
  },

  // Security Configuration
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 10,
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000,
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100,
    passwordMinLength: parseInt(process.env.PASSWORD_MIN_LENGTH, 10) || 8,
    passwordRequireSpecial: process.env.PASSWORD_REQUIRE_SPECIAL !== 'false',
    passwordRequireNumber: process.env.PASSWORD_REQUIRE_NUMBER !== 'false',
    passwordRequireUppercase: process.env.PASSWORD_REQUIRE_UPPERCASE !== 'false',
  },

  // CORS Configuration
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'DEBUG',
    enableFileLogging: process.env.ENABLE_FILE_LOGGING !== 'false',
    enableConsoleLogging: process.env.ENABLE_CONSOLE_LOGGING !== 'false',
  },
};

// Validate required environment variables
const requiredEnvVars = [
  'DB_PASSWORD',
  'JWT_SECRET',
];

const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingEnvVars.forEach((envVar) => console.error(`   - ${envVar}`));
  process.exit(1);
}

module.exports = config; 

// ============================================
// Configuration File (UPDATED)
// Loads and validates environment variables
// SECURITY ENHANCED: Strict JWT secret validation
// Developer: Suvadip Panja
// Last Updated: February 02, 2026
// ============================================

require('dotenv').config();

const writeFatalError = (message) => {
  process.stderr.write(`${message}\n`);
};

// ============================================
// SECURITY: JWT Secret Validation
// CRITICAL: JWT_SECRET must be strong and secure
// ============================================
const validateJWTSecret = (secret) => {
  if (!secret) {
    return {
      valid: false,
      error: 'JWT_SECRET is required but not set in environment variables',
    };
  }

  // Minimum length check
  if (secret.length < 32) {
    return {
      valid: false,
      error: `JWT_SECRET must be at least 32 characters (current: ${secret.length})`,
    };
  }

  // Check for weak/common secrets
  const weakSecrets = [
    'secret', 'test', 'password', 'admin', 'suvadip', 
    '12345', 'abc123', 'default', 'changeme', 'example'
  ];
  
  if (weakSecrets.some(weak => secret.toLowerCase().includes(weak))) {
    return {
      valid: false,
      error: 'JWT_SECRET contains weak/common patterns. Use a strong random string.',
    };
  }

  // Production-specific validation
  if (process.env.NODE_ENV === 'production') {
    // In production, require even stronger secrets (64+ chars)
    if (secret.length < 64) {
      return {
        valid: false,
        error: `JWT_SECRET in production must be at least 64 characters (current: ${secret.length})`,
      };
    }

    // Check for complexity in production
    const hasLowercase = /[a-z]/.test(secret);
    const hasUppercase = /[A-Z]/.test(secret);
    const hasNumbers = /[0-9]/.test(secret);
    const hasSpecial = /[^a-zA-Z0-9]/.test(secret);

    if (!(hasLowercase && hasUppercase && hasNumbers && hasSpecial)) {
      return {
        valid: false,
        error: 'JWT_SECRET in production must contain lowercase, uppercase, numbers, and special characters',
      };
    }
  }

  return { valid: true };
};

const normalizePublicUrl = (value) => (value ? value.replace(/\/+$/, '') : '');

// Validate JWT_SECRET before proceeding
const jwtValidation = validateJWTSecret(process.env.JWT_SECRET);
if (!jwtValidation.valid) {
  writeFatalError('');
  writeFatalError('CRITICAL SECURITY ERROR: Invalid JWT Configuration');
  writeFatalError(`  ${jwtValidation.error}`);
  writeFatalError('');
  writeFatalError('HOW TO FIX:');
  writeFatalError('  1. Generate a secure JWT_SECRET:');
  writeFatalError('     node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
  writeFatalError('');
  writeFatalError('  2. Add it to your .env file:');
  writeFatalError('     JWT_SECRET=<generated_secret>');
  writeFatalError('');
  writeFatalError('  3. Restart the application');
  writeFatalError('');
  process.exit(1);
}

const appPublicUrl = normalizePublicUrl(
  process.env.APP_PUBLIC_URL || process.env.FRONTEND_URL || process.env.APP_URL || ''
);

if (process.env.NODE_ENV === 'production' && !appPublicUrl) {
  writeFatalError('CRITICAL CONFIG ERROR: APP_PUBLIC_URL is required in production.');
  process.exit(1);
}

// ============================================
// APP_PUBLIC_URL VALIDATION
// Warn if the default Docker-internal hostname is used — it will not be
// resolvable by external email clients (e.g. password-reset links won't work).
// ============================================
const DOCKER_INTERNAL_HOSTS = ['helpdesk', 'frontend', 'backend', 'localhost', '127.0.0.1'];
if (appPublicUrl) {
  try {
    const parsed = new URL(appPublicUrl);
    if (DOCKER_INTERNAL_HOSTS.includes(parsed.hostname)) {
      process.stderr.write(
        `\n⚠️  WARNING: APP_PUBLIC_URL is set to "${appPublicUrl}".\n` +
        `   The hostname "${parsed.hostname}" is NOT externally accessible.\n` +
        `   Email links (password-reset, ticket notifications) will NOT work for external users.\n` +
        `   Set APP_PUBLIC_URL to your server's public IP or domain, e.g.:\n` +
        `     APP_PUBLIC_URL=http://192.168.1.100:8080\n` +
        `     APP_PUBLIC_URL=https://helpdesk.mycompany.com\n\n`
      );
    }
  } catch (_) { /* invalid URL — caught elsewhere */ }
}

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
      useUTC: false, // IMPORTANT: GETDATE() returns server local time; treat it as local, not UTC
      connectionTimeout: 30000,
      requestTimeout: 30000,
    },
    pool: {
      // Production: 30-50 max for better concurrency; Dev: 10
      max: parseInt(process.env.DB_POOL_MAX, 10) || (process.env.NODE_ENV === 'production' ? 30 : 10),
      min: parseInt(process.env.DB_POOL_MIN, 10) || (process.env.NODE_ENV === 'production' ? 5 : 0),
      idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT, 10) || 30000,
    },
  },

  // JWT Configuration
  // SECURITY: No default values - JWT_SECRET is strictly required and validated above
  jwt: {
    secret: process.env.JWT_SECRET, // ✅ FIXED: No weak default, validated above
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
  // NOTE: Only bcryptRounds stays in .env (infrastructure-level, NOT runtime-changeable)
  // All other security settings (password policy, rate limits, lockout, etc.) are DB-driven
  // and managed via Settings > Security Tab in the frontend
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 10,
  },

  // CORS Configuration
  cors: {
    origin: (() => {
      const origin = process.env.CORS_ORIGIN || appPublicUrl;
      if (process.env.NODE_ENV === 'production' && !origin) {
        writeFatalError('CRITICAL CONFIG ERROR: CORS_ORIGIN must be set in production.');
        process.exit(1);
      }
      return origin || 'http://localhost:5173';
    })(),
    credentials: true,
  },

  public: {
    appUrl: appPublicUrl || 'http://localhost:5173',
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
  writeFatalError('Missing required environment variables:');
  missingEnvVars.forEach((envVar) => writeFatalError(`  - ${envVar}`));
  process.exit(1);
}

module.exports = config;
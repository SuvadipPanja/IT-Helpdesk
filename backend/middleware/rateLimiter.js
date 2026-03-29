// ============================================
// DYNAMIC RATE LIMITER SERVICE
// Centralized, DB-configurable rate limiting
// for the entire application. Admin can adjust
// limits from the Settings page at runtime.
// Developer: Suvadip Panja
// Created: February 27, 2026
// ============================================

const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');
const { getClientIp } = require('../utils/clientIp');

// ============================================
// DEFAULT CONFIGURATION
// Used as fallback when DB settings unavailable
// ============================================
const DEFAULTS = {
  login:          { max: 10,  windowMinutes: 15 },
  api:            { max: 100, windowMinutes: 15 },
  twoFactor:      { max: 5,   windowMinutes: 15 },
  passwordReset:  { max: 5,   windowMinutes: 15 },
  licenseRecovery:{ max: 5,   windowMinutes: 15 },
};

// ============================================
// RUNTIME CONFIGURATION (loaded from DB)
// ============================================
let runtimeConfig = { ...DEFAULTS };
let configLoaded = false;

// ============================================
// UNLOCKED USERS WHITELIST
// When admin unlocks a user, the username is added
// here so the login rate limiter's `skip` function
// bypasses rate limiting for that user.
// ============================================
const unlockedWhitelist = new Map();
const WHITELIST_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Auto-cleanup every 60 seconds
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [username, entry] of unlockedWhitelist) {
    if (now >= entry.expiresAt) {
      unlockedWhitelist.delete(username);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    logger.debug(`Rate limiter whitelist cleanup: removed ${cleaned} expired entries`);
  }
}, 60 * 1000);
// Don't let cleanup keep process alive
if (cleanupInterval.unref) cleanupInterval.unref();

/**
 * Whitelist a username to bypass login rate limiter.
 * Called when admin unlocks an account.
 */
function whitelistUser(username, reason = 'Admin unlock', ttlMs = WHITELIST_TTL_MS) {
  if (!username) return;
  const key = username.toLowerCase().trim();
  unlockedWhitelist.set(key, {
    expiresAt: Date.now() + ttlMs,
    reason,
    createdAt: new Date().toISOString(),
  });
  logger.info('User whitelisted for rate limiter bypass', { username: key, reason, ttlMinutes: Math.round(ttlMs / 60000) });
}

/**
 * Check if a username is whitelisted.
 */
function isWhitelisted(username) {
  if (!username) return false;
  const key = username.toLowerCase().trim();
  const entry = unlockedWhitelist.get(key);
  if (!entry) return false;
  if (Date.now() >= entry.expiresAt) {
    unlockedWhitelist.delete(key);
    return false;
  }
  return true;
}

/**
 * Consume (remove) a whitelist entry after successful login.
 */
function consumeWhitelist(username) {
  if (!username) return;
  const key = username.toLowerCase().trim();
  if (unlockedWhitelist.has(key)) {
    unlockedWhitelist.delete(key);
    logger.debug('Whitelist entry consumed after successful login', { username: key });
  }
}

// ============================================
// DYNAMIC RATE LIMITER MIDDLEWARE FACTORY
// Creates a middleware that reads current config
// and dynamically applies rate limits.
// ============================================

/**
 * Create a dynamic rate limiter that reads max/window
 * from runtimeConfig on each request cycle.
 * 
 * Since express-rate-limit creates the store at init-time,
 * we use a wrapper middleware that checks the dynamic config
 * and conditionally applies the inner rate limiter, rebuilding
 * it when the config changes.
 * 
 * @param {string} type - 'login' | 'api' | 'twoFactor' | 'passwordReset'
 * @param {object} [opts] - Extra options (message, skip, keyGenerator)
 * @returns Express middleware
 */
function createDynamicLimiter(type, opts = {}) {
  let currentLimiter = null;
  let currentMax = null;
  let currentWindow = null;

  function buildLimiter(max, windowMs) {
    const limiterOpts = {
      windowMs,
      max,
      standardHeaders: true,
      legacyHeaders: false,
      validate: false, // suppress "created in request handler" warning for dynamic rebuilds
      message: opts.message || { success: false, message: 'Too many requests. Please try again later.' },
      ...opts.extra,
    };

    if (opts.skip) limiterOpts.skip = opts.skip;
    if (opts.keyGenerator) limiterOpts.keyGenerator = opts.keyGenerator;
    if (opts.handler) limiterOpts.handler = opts.handler;

    return rateLimit(limiterOpts);
  }

  function getOrRebuildLimiter() {
    const cfg = runtimeConfig[type] || DEFAULTS[type];
    const max = cfg.max;
    const windowMs = cfg.windowMinutes * 60 * 1000;

    // Rebuild only if config changed
    if (currentMax !== max || currentWindow !== windowMs) {
      currentMax = max;
      currentWindow = windowMs;
      currentLimiter = buildLimiter(max, windowMs);
      logger.debug(`Rate limiter [${type}] configured`, { max, windowMinutes: cfg.windowMinutes });
    }

    return currentLimiter;
  }

  // Create initial limiter at module load time (not lazily)
  const initCfg = DEFAULTS[type];
  currentMax = initCfg.max;
  currentWindow = initCfg.windowMinutes * 60 * 1000;
  currentLimiter = buildLimiter(currentMax, currentWindow);

  // Return middleware wrapper
  return (req, res, next) => {
    const limiter = getOrRebuildLimiter();
    return limiter(req, res, next);
  };
}

// ============================================
// PRE-BUILT LIMITERS (used in routes)
// ============================================

/** Login rate limiter — with admin-unlock bypass */
const loginLimiter = createDynamicLimiter('login', {
  message: { success: false, message: 'Too many login attempts. Please try again later.' },
  skip: (req) => {
    try {
      const username = req.body?.username;
      if (username && isWhitelisted(username)) {
        logger.info('Rate limiter bypassed for whitelisted user', { username: username.toLowerCase().trim(), ip: getClientIp(req) });
        return true;
      }
    } catch (err) {
      logger.error('Rate limiter skip check error', err);
    }
    return false;
  },
  keyGenerator: (req) => getClientIp(req) || 'unknown',
});

/** General API rate limiter */
const apiLimiter = createDynamicLimiter('api', {
  message: { success: false, message: 'Too many requests from this IP, please try again later.' },
  handler: (req, res) => {
    logger.warn('API rate limit exceeded', { ip: getClientIp(req), url: req.originalUrl });
    res.status(429).json({ success: false, message: 'Too many requests, please try again later.' });
  },
});

/** 2FA verification rate limiter */
const twoFactorLimiter = createDynamicLimiter('twoFactor', {
  message: { success: false, message: 'Too many verification attempts. Please try again later.' },
});

/** Password reset rate limiter */
const passwordResetLimiter = createDynamicLimiter('passwordReset', {
  message: { success: false, message: 'Too many password reset requests. Please try again later.' },
});

/** License recovery rate limiter */
const licenseRecoveryLimiter = createDynamicLimiter('licenseRecovery', {
  message: { success: false, message: 'Too many license recovery attempts. Please try again later.' },
});

// ============================================
// LOAD CONFIGURATION FROM DATABASE
// Called at server startup and when admin
// updates rate limit settings.
// ============================================
async function loadConfigFromDB() {
  try {
    const settingsService = require('../services/settings.service');
    const settings = await settingsService.getByCategory('rate_limiting', true);

    runtimeConfig = {
      login: {
        max: parseInt(settings.rate_limit_login_max) || DEFAULTS.login.max,
        windowMinutes: parseInt(settings.rate_limit_login_window_minutes) || DEFAULTS.login.windowMinutes,
      },
      api: {
        max: parseInt(settings.rate_limit_api_max) || DEFAULTS.api.max,
        windowMinutes: parseInt(settings.rate_limit_api_window_minutes) || DEFAULTS.api.windowMinutes,
      },
      twoFactor: {
        max: parseInt(settings.rate_limit_2fa_max) || DEFAULTS.twoFactor.max,
        windowMinutes: parseInt(settings.rate_limit_2fa_window_minutes) || DEFAULTS.twoFactor.windowMinutes,
      },
      passwordReset: {
        max: parseInt(settings.rate_limit_password_reset_max) || DEFAULTS.passwordReset.max,
        windowMinutes: parseInt(settings.rate_limit_password_reset_window_minutes) || DEFAULTS.passwordReset.windowMinutes,
      },
      licenseRecovery: {
        max: DEFAULTS.licenseRecovery.max,
        windowMinutes: DEFAULTS.licenseRecovery.windowMinutes,
      },
    };

    configLoaded = true;

    logger.success('Rate limiter config loaded from database', {
      login: `${runtimeConfig.login.max} req / ${runtimeConfig.login.windowMinutes} min`,
      api: `${runtimeConfig.api.max} req / ${runtimeConfig.api.windowMinutes} min`,
      twoFactor: `${runtimeConfig.twoFactor.max} req / ${runtimeConfig.twoFactor.windowMinutes} min`,
      passwordReset: `${runtimeConfig.passwordReset.max} req / ${runtimeConfig.passwordReset.windowMinutes} min`,
      licenseRecovery: `${runtimeConfig.licenseRecovery.max} req / ${runtimeConfig.licenseRecovery.windowMinutes} min`,
    });

    return runtimeConfig;
  } catch (error) {
    logger.warn('Failed to load rate limit config from DB, using defaults', { error: error.message });
    runtimeConfig = { ...DEFAULTS };
    return runtimeConfig;
  }
}

/**
 * Get the current runtime configuration (for admin UI).
 */
function getCurrentConfig() {
  return {
    ...runtimeConfig,
    configLoaded,
    whitelistSize: unlockedWhitelist.size,
  };
}

/**
 * Get whitelist size (for diagnostics).
 */
function getWhitelistSize() {
  return unlockedWhitelist.size;
}

// ============================================
// EXPORTS
// ============================================
module.exports = {
  // Middleware
  loginLimiter,
  apiLimiter,
  twoFactorLimiter,
  passwordResetLimiter,
  licenseRecoveryLimiter,

  // Whitelist (admin unlock)
  whitelistUser,
  consumeWhitelist,
  isWhitelisted,
  getWhitelistSize,

  // Config management
  loadConfigFromDB,
  getCurrentConfig,
};

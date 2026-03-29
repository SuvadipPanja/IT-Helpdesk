// ============================================
// PUBLIC APP URL — single source of truth for
// links in emails, password reset, notifications
//
// Resolution order:
//   1. system_settings.app_public_url (if set & valid)
//   2. config.public.appUrl (APP_PUBLIC_URL / FRONTEND_URL / APP_URL)
//   3. http://localhost:5173 (development fallback only)
// ============================================

const config = require('../config/config');
const settingsService = require('../services/settings.service');
const logger = require('./logger');
const {
  stripTrailingSlash,
  normalizePath,
  normalizePublicBaseUrl,
  validateAppPublicUrlInput,
} = require('./publicUrlCore');

/**
 * Environment / config fallback (never null — always a string).
 */
function getEnvFallbackPublicUrl() {
  const u =
    config.public?.appUrl ||
    process.env.APP_PUBLIC_URL ||
    process.env.FRONTEND_URL ||
    process.env.APP_URL ||
    '';
  const base = stripTrailingSlash(u || 'http://localhost:5173');
  return base;
}

const isProduction = () =>
  (process.env.NODE_ENV || config.env || 'development') === 'production';

let warnedLocalhostInProd = false;

/**
 * Resolved public base URL for building absolute links.
 */
function getPublicAppUrl() {
  const raw = settingsService.getSync('app_public_url');
  if (raw != null && String(raw).trim() !== '') {
    const n = normalizePublicBaseUrl(String(raw).trim());
    if (n) {
      if (isProduction() && !warnedLocalhostInProd) {
        try {
          const h = new URL(n).hostname.toLowerCase();
          if (h === 'localhost' || h === '127.0.0.1') {
            warnedLocalhostInProd = true;
            logger.warn(
              'app_public_url resolves to localhost in production — email links may be unusable externally',
              { resolved: n }
            );
          }
        } catch {
          /* ignore */
        }
      }
      return n;
    }
    logger.warn('app_public_url in database is invalid; falling back to APP_PUBLIC_URL', {
      raw: String(raw).slice(0, 80),
    });
  }

  const fallback = getEnvFallbackPublicUrl();
  return stripTrailingSlash(fallback);
}

function buildPublicAppUrl(pathname = '', search = '') {
  const baseUrl = getPublicAppUrl();
  const path = normalizePath(pathname);
  return `${baseUrl}${path}${search || ''}`;
}

module.exports = {
  getPublicAppUrl,
  buildPublicAppUrl,
  getEnvFallbackPublicUrl,
  normalizePublicBaseUrl,
  validateAppPublicUrlInput,
  stripTrailingSlash,
  normalizePath,
};

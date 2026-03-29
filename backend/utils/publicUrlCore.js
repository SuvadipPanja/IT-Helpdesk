// ============================================
// Pure URL helpers — no config / DB (testable)
// ============================================

const stripTrailingSlash = (value = '') => String(value).replace(/\/+$/, '');

const normalizePath = (value = '') => {
  if (!value) return '';
  return value.startsWith('/') ? value : `/${value}`;
};

/**
 * Parse admin input into canonical origin (scheme + host [+ port]), no path.
 * @param {string} input
 * @returns {string|null}
 */
function normalizePublicBaseUrl(input) {
  if (input == null) return null;
  const trimmed = String(input).trim();
  if (!trimmed) return null;

  let s = trimmed;
  if (!/^https?:\/\//i.test(s)) {
    s = `https://${s}`;
  }

  try {
    const u = new URL(s);
    if (!u.hostname) return null;
    return stripTrailingSlash(`${u.protocol}//${u.host}`);
  } catch {
    return null;
  }
}

const isProductionNodeEnv = () => (process.env.NODE_ENV || 'development') === 'production';

/**
 * Validate value before persisting to system_settings.
 * @param {*} raw
 * @returns {{ ok: boolean, normalized?: string, error?: string }}
 */
function validateAppPublicUrlInput(raw) {
  if (raw === undefined || raw === null) {
    return { ok: true, normalized: '' };
  }
  const trimmed = String(raw).trim();
  if (!trimmed) {
    return { ok: true, normalized: '' };
  }

  const normalized = normalizePublicBaseUrl(trimmed);
  if (!normalized) {
    return { ok: false, error: 'Invalid public URL. Use https://domain.com or domain.com' };
  }

  try {
    const u = new URL(normalized);
    if (isProductionNodeEnv()) {
      if (u.protocol !== 'https:') {
        return {
          ok: false,
          error: 'In production, the public site URL must use HTTPS',
        };
      }
      const h = u.hostname.toLowerCase();
      if (h === 'localhost' || h === '127.0.0.1' || h === '::1') {
        return {
          ok: false,
          error: 'In production, localhost cannot be used as the public site URL',
        };
      }
    }
  } catch {
    return { ok: false, error: 'Invalid public URL' };
  }

  return { ok: true, normalized };
}

module.exports = {
  stripTrailingSlash,
  normalizePath,
  normalizePublicBaseUrl,
  validateAppPublicUrlInput,
};

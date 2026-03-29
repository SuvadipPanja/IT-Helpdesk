/**
 * Reliable client IP for logging, sessions, and security (Express behind nginx/IIS).
 * Prefer X-Forwarded-For / X-Real-IP when trust proxy is enabled (see server.js).
 */

function normalizeIp(ip) {
  if (!ip || typeof ip !== 'string') return ip || '';
  const s = ip.trim();
  if (s.startsWith('::ffff:')) return s.slice(7);
  return s;
}

function getClientIp(req) {
  if (!req) return '';
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.trim()) {
    return normalizeIp(xf.split(',')[0].trim());
  }
  if (Array.isArray(xf) && xf[0]) {
    return normalizeIp(String(xf[0]).trim());
  }
  const xr = req.headers['x-real-ip'];
  if (typeof xr === 'string' && xr.trim()) {
    return normalizeIp(xr.trim());
  }
  if (req.ip) return normalizeIp(req.ip);
  const raw = req.socket?.remoteAddress || req.connection?.remoteAddress || '';
  return normalizeIp(raw);
}

module.exports = { getClientIp };

// ============================================
// DATE UTILITIES - Backend
// Centralized date formatting using settings timezone
// NOTE: Uses lazy require for settingsService to avoid circular dependency with logger
// ============================================

let _settingsService = null;
const getSettingsService = () => {
  if (!_settingsService) {
    _settingsService = require('../services/settings.service');
  }
  return _settingsService;
};

const DEFAULTS = {
  timezone: 'Asia/Kolkata',
  date_format: 'DD/MM/YYYY',
  time_format: '24'
};

// Module-level cache for synchronous access (logger etc.)
let cachedTimezone = DEFAULTS.timezone;
let cachedDateFormat = DEFAULTS.date_format;
let cachedTimeFormat = DEFAULTS.time_format;
let lastCacheUpdate = 0;
const SYNC_CACHE_TTL = 60 * 1000; // 1 minute

// ============================================
// LOAD SETTINGS (async - for controllers/jobs)
// ============================================
const getDateSettings = async () => {
  try {
    const settingsService = getSettingsService();
    const settings = await settingsService.getMany(['timezone', 'date_format', 'time_format']);
    const result = {
      timezone: settings.timezone || DEFAULTS.timezone,
      date_format: settings.date_format || DEFAULTS.date_format,
      time_format: settings.time_format || DEFAULTS.time_format
    };

    // Update sync cache
    cachedTimezone = result.timezone;
    cachedDateFormat = result.date_format;
    cachedTimeFormat = result.time_format;
    lastCacheUpdate = Date.now();

    return result;
  } catch {
    return { ...DEFAULTS };
  }
};

// ============================================
// GET CACHED SETTINGS (sync - for logger)
// ============================================
const getCachedTimezone = () => cachedTimezone;
const getCachedDateFormat = () => cachedDateFormat;
const getCachedTimeFormat = () => cachedTimeFormat;

// ============================================
// INITIALIZE CACHE (call on server startup)
// ============================================
const initDateSettings = async () => {
  try {
    const settings = await getDateSettings();
    cachedTimezone = settings.timezone;
    cachedDateFormat = settings.date_format;
    cachedTimeFormat = settings.time_format;
    lastCacheUpdate = Date.now();
    return settings;
  } catch {
    return { ...DEFAULTS };
  }
};

// ============================================
// REFRESH CACHE IF STALE (sync-safe, triggers async refresh)
// ============================================
const refreshCacheIfNeeded = () => {
  if (Date.now() - lastCacheUpdate > SYNC_CACHE_TTL) {
    // Fire-and-forget async refresh
    getDateSettings().catch(() => {});
  }
};

// ============================================
// GET DATE PARTS IN TIMEZONE (using Intl)
// ============================================
const getDateParts = (date, timezone) => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    const parts = {};
    formatter.formatToParts(d).forEach(({ type, value }) => {
      parts[type] = value;
    });
    return parts;
  } catch {
    return {
      year: String(d.getFullYear()),
      month: String(d.getMonth() + 1).padStart(2, '0'),
      day: String(d.getDate()).padStart(2, '0'),
      hour: String(d.getHours()).padStart(2, '0'),
      minute: String(d.getMinutes()).padStart(2, '0'),
      second: String(d.getSeconds()).padStart(2, '0')
    };
  }
};

// ============================================
// FORMAT DATE (async - reads settings)
// ============================================
const formatDate = async (dateStr) => {
  if (!dateStr) return 'N/A';
  const settings = await getDateSettings();
  const parts = getDateParts(dateStr, settings.timezone);
  if (!parts) return 'Invalid Date';

  const { day, month, year } = parts;
  switch (settings.date_format) {
    case 'MM/DD/YYYY': return `${month}/${day}/${year}`;
    case 'YYYY-MM-DD': return `${year}-${month}-${day}`;
    case 'DD/MM/YYYY':
    default: return `${day}/${month}/${year}`;
  }
};

// ============================================
// FORMAT TIME (async)
// ============================================
const formatTime = async (dateStr) => {
  if (!dateStr) return 'N/A';
  const settings = await getDateSettings();
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Invalid Time';

  try {
    return d.toLocaleTimeString('en-US', {
      timeZone: settings.timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: settings.time_format === '12'
    });
  } catch {
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: settings.time_format === '12'
    });
  }
};

// ============================================
// FORMAT DATE + TIME (async)
// ============================================
const formatDateTime = async (dateStr) => {
  if (!dateStr) return 'N/A';
  const [date, time] = await Promise.all([formatDate(dateStr), formatTime(dateStr)]);
  return `${date} ${time}`;
};

// ============================================
// FORMAT LONG DATE (async) - "January 25, 2026"
// ============================================
const formatLongDate = async (dateStr) => {
  if (!dateStr) return 'N/A';
  const settings = await getDateSettings();
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Invalid Date';

  try {
    return d.toLocaleDateString('en-US', {
      timeZone: settings.timezone,
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }
};

// ============================================
// SYNC VERSIONS (for logger - uses cached timezone)
// ============================================
const formatDateSync = (dateStr) => {
  if (!dateStr) return 'N/A';
  const parts = getDateParts(dateStr, cachedTimezone);
  if (!parts) return 'Invalid Date';

  const { day, month, year } = parts;
  switch (cachedDateFormat) {
    case 'MM/DD/YYYY': return `${month}/${day}/${year}`;
    case 'YYYY-MM-DD': return `${year}-${month}-${day}`;
    case 'DD/MM/YYYY':
    default: return `${day}/${month}/${year}`;
  }
};

const formatTimeSync = (dateStr) => {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Invalid Time';

  try {
    return d.toLocaleTimeString('en-US', {
      timeZone: cachedTimezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: cachedTimeFormat === '12'
    });
  } catch {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }
};

const formatDateTimeSync = (dateStr) => {
  if (!dateStr) return 'N/A';
  return `${formatDateSync(dateStr)} ${formatTimeSync(dateStr)}`;
};

// ============================================
// GET TIMESTAMP (sync - for logger)
// Returns: "2026-01-25 14:30:05.123" in configured timezone
// ============================================
const getTimestamp = () => {
  const now = new Date();

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: cachedTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
      hour12: false
    });

    const parts = {};
    formatter.formatToParts(now).forEach(({ type, value }) => {
      parts[type] = value;
    });

    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}.${parts.fractionalSecond || '000'}`;
  } catch {
    // Fallback
    return now.toISOString().replace('T', ' ').replace('Z', '');
  }
};

// ============================================
// GET LOG FILENAME DATE (sync - for logger)
// Returns: "2026-01-25" in configured timezone
// ============================================
const getLogDateString = () => {
  const now = new Date();

  try {
    const parts = getDateParts(now, cachedTimezone);
    if (parts) {
      return `${parts.year}-${parts.month}-${parts.day}`;
    }
  } catch { /* fallback */ }

  return now.toISOString().split('T')[0];
};

module.exports = {
  // Async functions (for controllers/jobs)
  getDateSettings,
  formatDate,
  formatTime,
  formatDateTime,
  formatLongDate,
  initDateSettings,

  // Sync functions (for logger)
  formatDateSync,
  formatTimeSync,
  formatDateTimeSync,
  getTimestamp,
  getLogDateString,
  getCachedTimezone,
  getCachedDateFormat,
  getCachedTimeFormat
};

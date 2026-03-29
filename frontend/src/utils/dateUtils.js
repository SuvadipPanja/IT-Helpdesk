// ============================================
// DATE UTILITIES - Centralized Date Formatting
// Uses timezone, date_format, time_format from Settings
// Reads from localStorage cache (SettingsService) or window.APP_SETTINGS
// ============================================

const DEFAULTS = {
  timezone: 'Asia/Kolkata',
  date_format: 'DD/MM/YYYY',
  time_format: '24'
};

const CACHE_KEY = 'app_settings_cache';

// ============================================
// GET DATE SETTINGS
// Priority: localStorage cache > window.APP_SETTINGS > defaults
// ============================================
export function getDateSettings() {
  // 1. Try localStorage (SettingsService cache — available after login)
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const data = JSON.parse(cached);
      if (data.general) {
        const tz = data.general.timezone?.value;
        const df = data.general.date_format?.value;
        const tf = data.general.time_format?.value;
        if (tz || df || tf) {
          return {
            timezone: tz || DEFAULTS.timezone,
            date_format: df || DEFAULTS.date_format,
            time_format: tf || DEFAULTS.time_format
          };
        }
      }
    }
  } catch { /* ignore parse errors */ }

  // 2. Try window.APP_SETTINGS (public settings — loaded before auth)
  if (window.APP_SETTINGS) {
    const s = window.APP_SETTINGS;
    if (s.timezone || s.date_format || s.time_format) {
      return {
        timezone: s.timezone || DEFAULTS.timezone,
        date_format: s.date_format || DEFAULTS.date_format,
        time_format: s.time_format || DEFAULTS.time_format
      };
    }
  }

  // 3. Defaults
  return { ...DEFAULTS };
}

// ============================================
// GET DATE PARTS IN SPECIFIED TIMEZONE
// Uses Intl.DateTimeFormat for accurate timezone conversion
// ============================================
function getDateParts(date, timezone) {
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
    // Fallback if timezone is invalid
    return {
      year: String(d.getFullYear()),
      month: String(d.getMonth() + 1).padStart(2, '0'),
      day: String(d.getDate()).padStart(2, '0'),
      hour: String(d.getHours()).padStart(2, '0'),
      minute: String(d.getMinutes()).padStart(2, '0'),
      second: String(d.getSeconds()).padStart(2, '0')
    };
  }
}

// ============================================
// FORMAT DATE ONLY (based on date_format setting)
// Returns: "25/01/2026" or "01/25/2026" or "2026-01-25"
// ============================================
export function formatDate(dateStr) {
  if (!dateStr) return 'N/A';

  const settings = getDateSettings();
  const parts = getDateParts(dateStr, settings.timezone);
  if (!parts) return 'Invalid Date';

  const { day, month, year } = parts;

  switch (settings.date_format) {
    case 'MM/DD/YYYY': return `${month}/${day}/${year}`;
    case 'YYYY-MM-DD': return `${year}-${month}-${day}`;
    case 'DD/MM/YYYY':
    default: return `${day}/${month}/${year}`;
  }
}

// ============================================
// FORMAT TIME ONLY (based on time_format setting)
// Returns: "14:30" or "02:30 PM"
// ============================================
export function formatTime(dateStr) {
  if (!dateStr) return 'N/A';

  const settings = getDateSettings();
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
}

// ============================================
// FORMAT DATE + TIME
// Returns: "25/01/2026 14:30" or "01/25/2026 02:30 PM"
// ============================================
export function formatDateTime(dateStr) {
  if (!dateStr) return 'N/A';
  return `${formatDate(dateStr)} ${formatTime(dateStr)}`;
}

// ============================================
// FORMAT SHORT DATE (for compact displays)
// Returns: "Jan 25" or "Jan 25, 2026" (if different year)
// ============================================
export function formatShortDate(dateStr) {
  if (!dateStr) return 'N/A';

  const settings = getDateSettings();
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Invalid Date';

  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();

  try {
    const options = {
      timeZone: settings.timezone,
      month: 'short',
      day: 'numeric',
      ...(sameYear ? {} : { year: 'numeric' })
    };
    return d.toLocaleDateString('en-US', options);
  } catch {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

// ============================================
// FORMAT SHORT DATE + TIME (for dashboard cards etc.)
// Returns: "Jan 25, 14:30" or "Jan 25, 02:30 PM"
// ============================================
export function formatShortDateTime(dateStr) {
  if (!dateStr) return 'N/A';
  return `${formatShortDate(dateStr)}, ${formatTime(dateStr)}`;
}

// ============================================
// RELATIVE TIME (timeAgo)
// Returns: "Just now", "5m ago", "2h ago", "3d ago", etc.
// Falls back to formatted date for older dates
// ============================================
export function timeAgo(dateStr) {
  if (!dateStr) return '';

  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';

  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);

  if (seconds < 0) return 'Just now'; // future date edge case
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 604800)}w ago`;

  // Older than 30 days → show formatted date
  return formatDate(dateStr);
}

// Alias
export const formatRelativeTime = timeAgo;

// ============================================
// FORMAT LONG DATE (for profile, details pages)
// Returns: "January 25, 2026"
// ============================================
export function formatLongDate(dateStr) {
  if (!dateStr) return 'N/A';

  const settings = getDateSettings();
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
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}

// ============================================
// FORMAT FOR DISPLAY WITH SEPARATOR
// Returns: "Jan 25, 2026 • 02:30 PM"
// ============================================
export function formatDateTimeDisplay(dateStr) {
  if (!dateStr) return 'N/A';
  return `${formatShortDate(dateStr)} • ${formatTime(dateStr)}`;
}

// ============================================
// FORMAT FOR REPORTS — fixed yyyy-mm-dd hh:mm:ss
// Used in ReportsHub, CSV, Excel, PDF exports
// ============================================
export function formatReportDateTime(v) {
  if (v == null || v === undefined) return null;
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}:${s}`;
}

/** Format a report cell value: dates as yyyy-mm-dd hh:mm:ss, else stringify. */
export function formatReportCell(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) {
    const s = formatReportDateTime(v);
    return s ?? '—';
  }
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v.trim())) {
    const s = formatReportDateTime(v);
    return s ?? v;
  }
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

// ============================================
// GET GREETING BASED ON TIMEZONE
// ============================================
export function getGreeting() {
  const settings = getDateSettings();
  try {
    const parts = {};
    new Intl.DateTimeFormat('en-US', {
      timeZone: settings.timezone,
      hour: 'numeric',
      hour12: false
    }).formatToParts(new Date()).forEach(({ type, value }) => {
      parts[type] = value;
    });
    const h = parseInt(parts.hour, 10);
    return h < 12 ? 'Good Morning' : h < 18 ? 'Good Afternoon' : 'Good Evening';
  } catch {
    const h = new Date().getHours();
    return h < 12 ? 'Good Morning' : h < 18 ? 'Good Afternoon' : 'Good Evening';
  }
}

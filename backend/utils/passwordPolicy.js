const PASSWORD_MIN_LENGTH_MIN = 6;
const PASSWORD_MIN_LENGTH_MAX = 20;
const PASSWORD_MIN_LENGTH_DEFAULT = 8;

function clampPasswordMinLength(value, fallback = PASSWORD_MIN_LENGTH_DEFAULT) {
  const parsedFallback = Number.parseInt(String(fallback ?? PASSWORD_MIN_LENGTH_DEFAULT), 10);
  const safeFallback = Number.isInteger(parsedFallback)
    ? Math.min(PASSWORD_MIN_LENGTH_MAX, Math.max(PASSWORD_MIN_LENGTH_MIN, parsedFallback))
    : PASSWORD_MIN_LENGTH_DEFAULT;

  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  if (!Number.isInteger(parsed)) {
    return safeFallback;
  }

  return Math.min(PASSWORD_MIN_LENGTH_MAX, Math.max(PASSWORD_MIN_LENGTH_MIN, parsed));
}

function validatePasswordMinLengthSetting(value) {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    return {
      valid: false,
      error: `Minimum Password Length is required and must be between ${PASSWORD_MIN_LENGTH_MIN} and ${PASSWORD_MIN_LENGTH_MAX}.`,
    };
  }

  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isInteger(parsed)) {
    return {
      valid: false,
      error: 'Minimum Password Length must be a whole number.',
    };
  }

  if (parsed < PASSWORD_MIN_LENGTH_MIN || parsed > PASSWORD_MIN_LENGTH_MAX) {
    return {
      valid: false,
      error: `Minimum Password Length must be between ${PASSWORD_MIN_LENGTH_MIN} and ${PASSWORD_MIN_LENGTH_MAX}.`,
    };
  }

  return {
    valid: true,
    value: String(parsed),
  };
}

function normalizePasswordPolicyValues(settings = {}) {
  const normalizedSettings = { ...settings };

  if (Object.prototype.hasOwnProperty.call(normalizedSettings, 'password_min_length')) {
    normalizedSettings.password_min_length = String(
      clampPasswordMinLength(normalizedSettings.password_min_length)
    );
  }

  return normalizedSettings;
}

function normalizePasswordPolicySettingEntry(key, setting) {
  if (key !== 'password_min_length' || !setting || typeof setting !== 'object') {
    return setting;
  }

  return {
    ...setting,
    value: String(clampPasswordMinLength(setting.value)),
  };
}

function normalizePasswordPolicySettingValue(key, value) {
  if (key !== 'password_min_length') {
    return value;
  }

  return String(clampPasswordMinLength(value));
}

module.exports = {
  PASSWORD_MIN_LENGTH_MIN,
  PASSWORD_MIN_LENGTH_MAX,
  PASSWORD_MIN_LENGTH_DEFAULT,
  clampPasswordMinLength,
  validatePasswordMinLengthSetting,
  normalizePasswordPolicyValues,
  normalizePasswordPolicySettingEntry,
  normalizePasswordPolicySettingValue,
};
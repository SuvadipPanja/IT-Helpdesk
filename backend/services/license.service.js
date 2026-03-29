// ============================================
// LICENSE SERVICE
// Offline signed license validation and runtime enforcement
// Uses Ed25519 signatures verified with a public key
// ============================================

const crypto = require('crypto');
const { executeQuery } = require('../config/database');
const logger = require('../utils/logger');
const licenseFingerprintService = require('./licenseFingerprint.service');

const CLOCK_ROLLBACK_TOLERANCE_MS = Math.max(
  parseInt(process.env.LICENSE_CLOCK_ROLLBACK_TOLERANCE_MS || '', 10) || (10 * 60 * 1000),
  60 * 1000
);

const LICENSE_STATUS = Object.freeze({
  VALID: 'VALID',
  WARNING: 'WARNING',
  EXPIRED: 'EXPIRED',
  INVALID: 'INVALID',
  MISSING: 'MISSING',
  CONFIG_ERROR: 'CONFIG_ERROR',
  SEAT_EXCEEDED: 'SEAT_EXCEEDED',
});

const PUBLIC_ALLOWED_PATHS_WHEN_BLOCKED = new Set([
  '/health',
  '/',
  '/api/v1/settings/public',
  '/api/v1/license/public-status',
  '/api/v1/license/recovery-context',
  '/api/v1/license/recovery/install',
  '/api/v1/auth/login',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/reset-password',
]);

const PUBLIC_ALLOWED_PREFIXES_WHEN_BLOCKED = [
  '/api/v1/auth/validate-reset-token/',
  '/api/v1/public/email-approval',
];

const stableStringify = (value) => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
};

const normalizePublicKey = () => {
  const raw = process.env.LICENSE_PUBLIC_KEY || process.env.LICENSE_PUBLIC_KEY_PEM || '';
  return raw ? raw.replace(/\\n/g, '\n').trim() : '';
};

const getPublicKey = () => {
  const publicKey = normalizePublicKey();
  if (!publicKey) {
    return null;
  }
  return publicKey;
};

const getRecoveryKey = () => {
  return (process.env.LICENSE_RECOVERY_KEY || '').trim();
};

const verifyRecoveryKey = (providedKey) => {
  const configuredKey = getRecoveryKey();
  if (!configuredKey || !providedKey) return false;

  const left = Buffer.from(configuredKey);
  const right = Buffer.from(String(providedKey));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
};

const normalizeRequestPath = (requestPath = '') => {
  const trimmedPath = String(requestPath || '').trim();
  if (!trimmedPath) return '';

  const withoutQuery = trimmedPath.split('?')[0].split('#')[0] || '';
  if (!withoutQuery) return '';

  if (withoutQuery.length > 1 && withoutQuery.endsWith('/')) {
    return withoutQuery.replace(/\/+$/, '');
  }

  return withoutQuery;
};

const isPathAllowedWhenExpired = (path = '') => {
  const normalizedPath = normalizeRequestPath(path);
  if (!normalizedPath) return false;
  if (PUBLIC_ALLOWED_PATHS_WHEN_BLOCKED.has(normalizedPath)) return true;
  if (PUBLIC_ALLOWED_PREFIXES_WHEN_BLOCKED.some((prefix) => normalizedPath.startsWith(prefix))) return true;
  if (normalizedPath.startsWith('/uploads/branding')) return true;
  if (normalizedPath.startsWith('/uploads/profiles')) return true;
  return false;
};

const ensureRuntimeStateRow = async () => {
  await executeQuery(`
    IF NOT EXISTS (SELECT 1 FROM license_runtime_state WHERE state_id = 1)
    BEGIN
      INSERT INTO license_runtime_state (
        state_id,
        current_status,
        status_message,
        active_license_id,
        expires_at,
        warning_days_remaining,
        last_checked_at,
        sessions_invalidated_at
      )
      VALUES (
        1,
        'MISSING',
        'No license installed',
        NULL,
        NULL,
        NULL,
        GETDATE(),
        NULL
      )
    END
  `);
};

const getActiveLicenseRecord = async () => {
  const result = await executeQuery(`
    SELECT TOP 1
      license_row_id,
      license_id,
      customer_name,
      product_name,
      edition,
      issued_at,
      expires_at,
      status,
      payload_json,
      signature,
      algorithm,
      installed_at,
      installed_by,
      server_fingerprint_hash
    FROM license_store
    WHERE is_active = 1
    ORDER BY installed_at DESC, license_row_id DESC
  `);

  if (!result.recordset.length) return null;

  const row = result.recordset[0];
  return {
    ...row,
    payload: row.payload_json ? JSON.parse(row.payload_json) : null,
  };
};

const getRuntimeState = async () => {
  await ensureRuntimeStateRow();
  const result = await executeQuery(`
    SELECT
      state_id,
      current_status,
      status_message,
      active_license_id,
      expires_at,
      warning_days_remaining,
      last_checked_at,
      sessions_invalidated_at,
      last_observed_at,
      max_observed_at,
      clock_tamper_detected_at
    FROM license_runtime_state
    WHERE state_id = 1
  `);
  return result.recordset[0] || null;
};

const recordLicenseEvent = async (eventType, details = null, userId = null) => {
  try {
    await executeQuery(`
      INSERT INTO license_events (event_type, details_json, created_by)
      VALUES (@eventType, @detailsJson, @createdBy)
    `, {
      eventType,
      detailsJson: details ? JSON.stringify(details) : null,
      createdBy: userId,
    });
  } catch (error) {
    logger.error('Failed to record license event', error);
  }
};

const verifyEnvelopeShape = (envelope) => {
  if (!envelope || typeof envelope !== 'object') {
    return { valid: false, message: 'License envelope is missing or invalid.' };
  }

  if (!envelope.payload || typeof envelope.payload !== 'object') {
    return { valid: false, message: 'License payload is missing.' };
  }

  if (!envelope.signature || typeof envelope.signature !== 'string') {
    return { valid: false, message: 'License signature is missing.' };
  }

  const algorithm = (envelope.algorithm || 'ed25519').toLowerCase();
  if (algorithm !== 'ed25519') {
    return { valid: false, message: 'Unsupported license signature algorithm.' };
  }

  return { valid: true };
};

const verifySignedEnvelope = (envelope) => {
  const publicKey = getPublicKey();
  if (!publicKey) {
    return {
      valid: false,
      status: LICENSE_STATUS.CONFIG_ERROR,
      message: 'LICENSE_PUBLIC_KEY is not configured on the server.',
    };
  }

  const shape = verifyEnvelopeShape(envelope);
  if (!shape.valid) {
    return {
      valid: false,
      status: LICENSE_STATUS.INVALID,
      message: shape.message,
    };
  }

  try {
    const payloadString = stableStringify(envelope.payload);
    const verified = crypto.verify(
      null,
      Buffer.from(payloadString),
      publicKey,
      Buffer.from(envelope.signature, 'base64')
    );

    if (!verified) {
      return {
        valid: false,
        status: LICENSE_STATUS.INVALID,
        message: 'License signature verification failed.',
      };
    }

    return {
      valid: true,
      status: LICENSE_STATUS.VALID,
      payload: envelope.payload,
      payloadString,
    };
  } catch (error) {
    return {
      valid: false,
      status: LICENSE_STATUS.INVALID,
      message: `License verification failed: ${error.message}`,
    };
  }
};

const validateInstanceBinding = (payload) => {
  const expectedFingerprint = payload?.instance_binding?.server_fingerprint_hash;
  const currentFingerprint = licenseFingerprintService.getFingerprintHash();

  if (!expectedFingerprint) {
    return {
      valid: true,
      message: 'License has no server fingerprint binding.',
      currentFingerprint,
    };
  }

  if (expectedFingerprint !== currentFingerprint) {
    return {
      valid: false,
      status: LICENSE_STATUS.INVALID,
      message: 'License is bound to a different server fingerprint.',
      currentFingerprint,
      expectedFingerprint,
    };
  }

  return {
    valid: true,
    currentFingerprint,
    expectedFingerprint,
    message: 'Server fingerprint binding matched.',
  };
};

const getLicenseEntitlements = (payload) => {
  const entitlements = payload?.entitlements && typeof payload.entitlements === 'object'
    ? payload.entitlements
    : {};

  const rawMaxUsers = entitlements.max_active_users ?? payload?.max_active_users ?? null;
  const parsedMaxUsers = rawMaxUsers === null || rawMaxUsers === undefined || rawMaxUsers === ''
    ? null
    : parseInt(rawMaxUsers, 10);

  const rawFeatures = entitlements.features ?? payload?.features ?? null;
  const features = {};

  if (Array.isArray(rawFeatures)) {
    rawFeatures.forEach((feature) => {
      const key = String(feature || '').trim().toLowerCase();
      if (key) features[key] = true;
    });
  } else if (rawFeatures && typeof rawFeatures === 'object') {
    Object.entries(rawFeatures).forEach(([key, value]) => {
      const normalizedKey = String(key || '').trim().toLowerCase();
      if (normalizedKey) features[normalizedKey] = value !== false;
    });
  }

  return {
    max_active_users: Number.isInteger(parsedMaxUsers) && parsedMaxUsers > 0 ? parsedMaxUsers : null,
    features,
  };
};

const isFeatureEnabled = (payload, featureKey) => {
  const normalizedFeatureKey = String(featureKey || '').trim().toLowerCase();
  if (!normalizedFeatureKey) return true;

  const entitlements = getLicenseEntitlements(payload);
  const configuredFeatures = Object.keys(entitlements.features);

  if (configuredFeatures.length === 0) {
    return true;
  }

  return entitlements.features[normalizedFeatureKey] === true;
};

const evaluatePayload = (payload) => {
  if (!payload?.license_id) {
    return {
      valid: false,
      status: LICENSE_STATUS.INVALID,
      message: 'License payload missing license_id.',
    };
  }

  if (!payload?.expires_at) {
    return {
      valid: false,
      status: LICENSE_STATUS.INVALID,
      message: 'License payload missing expires_at.',
    };
  }

  const expiresAt = new Date(payload.expires_at);
  if (Number.isNaN(expiresAt.getTime())) {
    return {
      valid: false,
      status: LICENSE_STATUS.INVALID,
      message: 'License payload contains invalid expires_at.',
    };
  }

  const now = new Date();
  const diffMs = expiresAt.getTime() - now.getTime();
  const warningDays = typeof payload.warning_days === 'number' ? payload.warning_days : 30;
  const daysRemaining = Math.ceil(diffMs / (24 * 60 * 60 * 1000));

  if (diffMs < 0) {
    return {
      valid: false,
      status: LICENSE_STATUS.EXPIRED,
      message: 'License expired. Please update your license and contact administrator.',
      expiresAt,
      daysRemaining,
    };
  }

  if (daysRemaining <= warningDays) {
    return {
      valid: true,
      status: LICENSE_STATUS.WARNING,
      message: `License expires in ${daysRemaining} day(s).`,
      expiresAt,
      daysRemaining,
    };
  }

  return {
    valid: true,
    status: LICENSE_STATUS.VALID,
    message: 'License is valid.',
    expiresAt,
    daysRemaining,
  };
};

const getActiveUserCount = async () => {
  const result = await executeQuery(`
    SELECT COUNT(*) AS active_users
    FROM users
    WHERE is_active = 1
  `);
  return result.recordset[0]?.active_users || 0;
};

const getUsageSummary = async (payload) => {
  const entitlements = getLicenseEntitlements(payload);
  const activeUsers = await getActiveUserCount();

  return {
    active_users: {
      current: activeUsers,
      limit: entitlements.max_active_users,
      remaining: entitlements.max_active_users === null ? null : Math.max(entitlements.max_active_users - activeUsers, 0),
    },
  };
};

const detectClockTampering = (runtimeState, observedAt = new Date()) => {
  const maxObservedAt = runtimeState?.max_observed_at ? new Date(runtimeState.max_observed_at) : null;
  if (!maxObservedAt || Number.isNaN(maxObservedAt.getTime())) {
    return {
      tampered: false,
      observedAt,
      maxObservedAt: null,
    };
  }

  if (observedAt.getTime() + CLOCK_ROLLBACK_TOLERANCE_MS < maxObservedAt.getTime()) {
    return {
      tampered: true,
      status: LICENSE_STATUS.INVALID,
      message: 'System clock rollback detected. Correct server time before using the application.',
      observedAt,
      maxObservedAt,
    };
  }

  return {
    tampered: false,
    observedAt,
    maxObservedAt,
  };
};

const updateRuntimeState = async ({
  status,
  message,
  activeLicenseId = null,
  expiresAt = null,
  warningDaysRemaining = null,
  sessionsInvalidatedAt = null,
  observedAt = new Date(),
  clockTamperDetectedAt = null,
}) => {
  await ensureRuntimeStateRow();
  await executeQuery(`
    UPDATE license_runtime_state
    SET
      current_status = @status,
      status_message = @message,
      active_license_id = @activeLicenseId,
      expires_at = @expiresAt,
      warning_days_remaining = @warningDaysRemaining,
      last_checked_at = GETDATE(),
      sessions_invalidated_at = COALESCE(@sessionsInvalidatedAt, sessions_invalidated_at),
      last_observed_at = @observedAt,
      max_observed_at = CASE
        WHEN max_observed_at IS NULL OR @observedAt > max_observed_at THEN @observedAt
        ELSE max_observed_at
      END,
      clock_tamper_detected_at = COALESCE(@clockTamperDetectedAt, clock_tamper_detected_at)
    WHERE state_id = 1
  `, {
    status,
    message,
    activeLicenseId,
    expiresAt,
    warningDaysRemaining,
    sessionsInvalidatedAt,
    observedAt,
    clockTamperDetectedAt,
  });
};

const invalidateActiveSessions = async (reason = 'LICENSE_EXPIRED') => {
  let rowsAffected = 0;
  try {
    const result = await executeQuery(`
      UPDATE user_sessions
      SET is_active = 0
      WHERE is_active = 1
    `, { reason });
    rowsAffected = result.rowsAffected?.[0] || 0;
  } catch (error) {
    logger.error('Failed to invalidate active sessions for license enforcement', error);
  }

  await updateRuntimeState({
    status: LICENSE_STATUS.EXPIRED,
    message: 'License expired. All active sessions have been revoked.',
    sessionsInvalidatedAt: new Date(),
  });

  return rowsAffected;
};

const syncRuntimeState = async () => {
  const runtimeBefore = await getRuntimeState();
  const activeLicense = await getActiveLicenseRecord();
  const currentFingerprint = licenseFingerprintService.getFingerprintHash();
  const observedAt = new Date();
  const clockCheck = detectClockTampering(runtimeBefore, observedAt);

  if (clockCheck.tampered) {
    await updateRuntimeState({
      status: clockCheck.status,
      message: clockCheck.message,
      activeLicenseId: activeLicense?.license_id || null,
      expiresAt: activeLicense?.expires_at || null,
      warningDaysRemaining: null,
      observedAt,
      clockTamperDetectedAt: runtimeBefore?.clock_tamper_detected_at ? null : observedAt,
    });

    if (!runtimeBefore?.clock_tamper_detected_at) {
      await recordLicenseEvent('CLOCK_TAMPER_DETECTED', {
        observedAt,
        maxObservedAt: clockCheck.maxObservedAt,
        toleranceMs: CLOCK_ROLLBACK_TOLERANCE_MS,
      });
    }

    return {
      valid: false,
      status: clockCheck.status,
      message: clockCheck.message,
      currentFingerprint,
      observedAt,
      maxObservedAt: clockCheck.maxObservedAt,
    };
  }

  if (!activeLicense) {
    await updateRuntimeState({
      status: LICENSE_STATUS.MISSING,
      message: 'No license installed.',
      activeLicenseId: null,
      expiresAt: null,
      warningDaysRemaining: null,
      observedAt,
    });

    const result = {
      valid: false,
      status: LICENSE_STATUS.MISSING,
      message: 'No license installed.',
      currentFingerprint,
    };
    if (runtimeBefore?.current_status !== result.status || runtimeBefore?.active_license_id !== null) {
      await recordLicenseEvent('LICENSE_RUNTIME_STATE_CHANGED', {
        previousStatus: runtimeBefore?.current_status || null,
        currentStatus: result.status,
        activeLicenseId: null,
      });
    }
    return result;
  }

  const verification = verifySignedEnvelope({
    payload: activeLicense.payload,
    signature: activeLicense.signature,
    algorithm: activeLicense.algorithm,
  });

  if (!verification.valid) {
    await updateRuntimeState({
      status: verification.status,
      message: verification.message,
      activeLicenseId: activeLicense.license_id,
      expiresAt: activeLicense.expires_at || null,
      warningDaysRemaining: null,
      observedAt,
    });

    const result = {
      ...verification,
      currentFingerprint,
    };
    if (runtimeBefore?.current_status !== result.status || runtimeBefore?.active_license_id !== activeLicense.license_id) {
      await recordLicenseEvent('LICENSE_RUNTIME_STATE_CHANGED', {
        previousStatus: runtimeBefore?.current_status || null,
        currentStatus: result.status,
        activeLicenseId: activeLicense.license_id,
      });
    }
    return result;
  }

  const binding = validateInstanceBinding(activeLicense.payload);
  if (!binding.valid) {
    await updateRuntimeState({
      status: binding.status,
      message: binding.message,
      activeLicenseId: activeLicense.license_id,
      expiresAt: activeLicense.expires_at || null,
      warningDaysRemaining: null,
      observedAt,
    });

    const result = {
      valid: false,
      status: binding.status,
      message: binding.message,
      currentFingerprint,
      expectedFingerprint: binding.expectedFingerprint,
    };
    if (runtimeBefore?.current_status !== result.status || runtimeBefore?.active_license_id !== activeLicense.license_id) {
      await recordLicenseEvent('LICENSE_RUNTIME_STATE_CHANGED', {
        previousStatus: runtimeBefore?.current_status || null,
        currentStatus: result.status,
        activeLicenseId: activeLicense.license_id,
        expectedFingerprint: binding.expectedFingerprint,
        currentFingerprint,
      });
    }
    return result;
  }

  const evaluation = evaluatePayload(activeLicense.payload);
  await updateRuntimeState({
    status: evaluation.status,
    message: evaluation.message,
    activeLicenseId: activeLicense.license_id,
    expiresAt: evaluation.expiresAt || null,
    warningDaysRemaining: evaluation.daysRemaining ?? null,
    observedAt,
  });

  const result = {
    ...evaluation,
    payload: activeLicense.payload,
    licenseId: activeLicense.license_id,
    currentFingerprint,
  };
  if (
    runtimeBefore?.current_status !== result.status ||
    runtimeBefore?.active_license_id !== activeLicense.license_id ||
    runtimeBefore?.warning_days_remaining !== (evaluation.daysRemaining ?? null)
  ) {
    await recordLicenseEvent('LICENSE_RUNTIME_STATE_CHANGED', {
      previousStatus: runtimeBefore?.current_status || null,
      currentStatus: result.status,
      activeLicenseId: activeLicense.license_id,
      expiresAt: evaluation.expiresAt || null,
      warningDaysRemaining: evaluation.daysRemaining ?? null,
    });
  }
  return result;
};

const getCurrentStatus = async () => {
  const synced = await syncRuntimeState();
  const runtime = await getRuntimeState();
  const entitlements = getLicenseEntitlements(synced.payload);
  const usage = await getUsageSummary(synced.payload);
  return {
    ...synced,
    runtime,
    entitlements,
    usage,
  };
};

const installLicense = async (envelope, installedBy = null) => {
  const verification = verifySignedEnvelope(envelope);
  if (!verification.valid) {
    throw new Error(verification.message);
  }

  const binding = validateInstanceBinding(verification.payload);
  if (!binding.valid) {
    throw new Error(binding.message);
  }

  const evaluation = evaluatePayload(verification.payload);
  const payload = verification.payload;

  await executeQuery(`UPDATE license_store SET is_active = 0 WHERE is_active = 1`);

  await executeQuery(`
    INSERT INTO license_store (
      license_id,
      customer_name,
      product_name,
      edition,
      issued_at,
      expires_at,
      status,
      is_active,
      payload_json,
      signature,
      algorithm,
      installed_by,
      installed_at,
      server_fingerprint_hash
    )
    VALUES (
      @licenseId,
      @customerName,
      @productName,
      @edition,
      @issuedAt,
      @expiresAt,
      @status,
      1,
      @payloadJson,
      @signature,
      @algorithm,
      @installedBy,
      GETDATE(),
      @serverFingerprintHash
    )
  `, {
    licenseId: payload.license_id,
    customerName: payload.customer_name || null,
    productName: payload.product || 'IT Helpdesk',
    edition: payload.edition || 'Standard',
    issuedAt: payload.issued_at ? new Date(payload.issued_at) : null,
    expiresAt: evaluation.expiresAt,
    status: evaluation.status,
    payloadJson: verification.payloadString,
    signature: envelope.signature,
    algorithm: (envelope.algorithm || 'ed25519').toLowerCase(),
    installedBy,
    serverFingerprintHash: payload.instance_binding?.server_fingerprint_hash || null,
  });

  await recordLicenseEvent('LICENSE_INSTALLED', {
    licenseId: payload.license_id,
    expiresAt: payload.expires_at,
    status: evaluation.status,
  }, installedBy);

  const syncResult = await syncRuntimeState();

  // Check if the newly installed license puts the system over the seat limit.
  // This can happen when a license with a lower seat count replaces a previous one,
  // or when a license is installed on a system that already has more active users
  // than the license allows.
  const entitlements = getLicenseEntitlements(payload);
  const activeUsers = await getActiveUserCount();
  const seatOverage = (entitlements.max_active_users !== null && activeUsers > entitlements.max_active_users)
    ? { overLimit: true, current: activeUsers, limit: entitlements.max_active_users, excess: activeUsers - entitlements.max_active_users }
    : null;

  if (seatOverage) {
    await recordLicenseEvent('LICENSE_SEAT_OVERAGE_ON_INSTALL', {
      licenseId: payload.license_id,
      current: seatOverage.current,
      limit: seatOverage.limit,
      excess: seatOverage.excess,
    }, installedBy);
    logger.warn('[LICENSE] Installed license has fewer seats than current active users', seatOverage);
  }

  return { ...syncResult, seatOverage };
};

const assertLoginAllowed = async () => {
  const state = await getCurrentStatus();

  if ([LICENSE_STATUS.MISSING, LICENSE_STATUS.INVALID, LICENSE_STATUS.CONFIG_ERROR].includes(state.status)) {
    return {
      allowed: false,
      status: state.status,
      message: 'License is not installed or is invalid. Please contact administrator.',
    };
  }

  if (state.status === LICENSE_STATUS.EXPIRED) {
    const runtime = await getRuntimeState();
    if (!runtime?.sessions_invalidated_at) {
      await invalidateActiveSessions('LICENSE_EXPIRED');
    }
    return {
      allowed: false,
      status: state.status,
      message: 'License expired. Please update it or contact administrator.',
    };
  }

  return {
    allowed: true,
    status: state.status,
    message: state.message,
  };
};

const assertRequestAllowed = async (requestPath) => {
  if (isPathAllowedWhenExpired(requestPath)) {
    return {
      allowed: true,
      status: LICENSE_STATUS.VALID,
      message: 'Allowed public path.',
    };
  }

  return assertLoginAllowed();
};

const assertFeatureAllowed = async (featureKey) => {
  const state = await getCurrentStatus();

  if ([LICENSE_STATUS.MISSING, LICENSE_STATUS.INVALID, LICENSE_STATUS.CONFIG_ERROR, LICENSE_STATUS.EXPIRED].includes(state.status)) {
    return {
      allowed: false,
      status: state.status,
      code: 'LICENSE_BLOCKED',
      message: state.runtime?.status_message || state.message,
    };
  }

  if (!isFeatureEnabled(state.payload, featureKey)) {
    await recordLicenseEvent('LICENSE_FEATURE_BLOCKED', {
      feature: featureKey,
      licenseId: state.licenseId || null,
    });

    return {
      allowed: false,
      status: state.status,
      code: 'LICENSE_FEATURE_DISABLED',
      message: `The "${featureKey}" feature is not enabled in the installed license.`,
    };
  }

  return {
    allowed: true,
    status: state.status,
    code: 'LICENSE_OK',
    message: state.message,
  };
};

const assertActiveUserSeatAvailable = async () => {
  const state = await getCurrentStatus();
  const limit = state.entitlements?.max_active_users ?? null;

  if (!limit) {
    return {
      allowed: true,
      current: state.usage?.active_users?.current ?? 0,
      limit: null,
    };
  }

  const current = state.usage?.active_users?.current ?? 0;
  if (current >= limit) {
    await recordLicenseEvent('LICENSE_ENTITLEMENT_BLOCKED', {
      entitlement: 'max_active_users',
      current,
      limit,
      licenseId: state.licenseId || null,
    });

    return {
      allowed: false,
      code: 'LICENSE_LIMIT_EXCEEDED',
      message: `Active user limit reached (${current}/${limit}). Deactivate another user or install a larger license.`,
      current,
      limit,
    };
  }

  return {
    allowed: true,
    current,
    limit,
  };
};

// ============================================
// SEAT ENFORCEMENT AT LOGIN
// Enforces per-user seat limits at login time using FIFO seat allocation.
// The oldest N active users (by created_at/user_id) hold licensed seats.
// Admin users (can_manage_system) always bypass the seat check so they
// can log in and correct any overage.
// ============================================
const assertLoginSeatAllowed = async (userId, isAdmin = false) => {
  try {
    const state = await getCurrentStatus();
    const limit = state.entitlements?.max_active_users ?? null;

    // No per-seat limit configured — all logins allowed
    if (!limit) {
      return { allowed: true };
    }

    const current = state.usage?.active_users?.current ?? 0;

    // Within licensed seat count — allowed
    if (current <= limit) {
      return { allowed: true, current, limit };
    }

    // Over limit: admin users always get through so they can fix the situation
    if (isAdmin) {
      logger.warn('[LICENSE] System admin bypassed seat limit overage', {
        userId, current, limit,
      });
      return { allowed: true, current, limit, overLimit: true };
    }

    // Over limit: check if this user holds one of the N oldest (licensed) seats
    const seatResult = await executeQuery(`
      SELECT TOP (@limit) user_id
      FROM users
      WHERE is_active = 1
      ORDER BY created_at ASC, user_id ASC
    `, { limit });

    const seatHolderIds = new Set(
      (seatResult.recordset || []).map((r) => Number(r.user_id))
    );

    if (seatHolderIds.has(Number(userId))) {
      return { allowed: true, current, limit };
    }

    // User is outside the licensed seat window — block login
    await recordLicenseEvent('LICENSE_LOGIN_SEAT_BLOCKED', {
      userId,
      current,
      limit,
    });

    logger.warn('[LICENSE] Login blocked — user outside licensed seat allocation', {
      userId, current, limit,
    });

    return {
      allowed: false,
      code: 'LICENSE_SEAT_LIMIT_EXCEEDED',
      message: `Your organization has ${current} active users but the license only permits ${limit}. Please contact your administrator to deactivate unused accounts.`,
      current,
      limit,
    };
  } catch (err) {
    // Fail-open on unexpected errors to avoid locking users out due to DB issues
    logger.error('[LICENSE] assertLoginSeatAllowed error — failing open', err);
    return { allowed: true };
  }
};

const getRecoveryContext = async () => {
  const status = await getCurrentStatus();
  return {
    current_status: status.status,
    message: status.runtime?.status_message || status.message,
    expires_at: status.runtime?.expires_at || status.expiresAt || null,
    current_fingerprint: licenseFingerprintService.getFingerprintHash(),
    clock_tamper_detected_at: status.runtime?.clock_tamper_detected_at || null,
    max_observed_at: status.runtime?.max_observed_at || null,
    recovery_enabled: !!getRecoveryKey(),
  };
};

const installLicenseWithRecoveryKey = async ({ recoveryKey, envelope }) => {
  if (!verifyRecoveryKey(recoveryKey)) {
    await recordLicenseEvent('LICENSE_RECOVERY_AUTH_FAILED', {
      reason: 'INVALID_RECOVERY_KEY',
    });
    throw new Error('Invalid recovery key.');
  }

  const result = await installLicense(envelope, null);
  await recordLicenseEvent('LICENSE_RECOVERY_INSTALL_SUCCEEDED', {
    status: result.status,
    licenseId: result.licenseId || result.payload?.license_id || null,
  });
  return result;
};

module.exports = {
  LICENSE_STATUS,
  getPublicKey,
  getRecoveryKey,
  verifyRecoveryKey,
  verifySignedEnvelope,
  validateInstanceBinding,
  getLicenseEntitlements,
  isFeatureEnabled,
  evaluatePayload,
  getActiveLicenseRecord,
  getActiveUserCount,
  getRuntimeState,
  getCurrentStatus,
  getRecoveryContext,
  installLicense,
  installLicenseWithRecoveryKey,
  syncRuntimeState,
  invalidateActiveSessions,
  assertLoginAllowed,
  assertRequestAllowed,
  assertFeatureAllowed,
  assertActiveUserSeatAvailable,
  assertLoginSeatAllowed,
  isPathAllowedWhenExpired,
};

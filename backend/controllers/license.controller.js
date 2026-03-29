// ============================================
// LICENSE CONTROLLER
// Admin APIs for offline signed license management
// ============================================

const licenseService = require('../services/license.service');
const { createResponse } = require('../utils/helpers');
const logger = require('../utils/logger');

const getPublicLicenseStatus = async (req, res) => {
  try {
    const status = await licenseService.getCurrentStatus();
    return res.status(200).json(
      createResponse(true, 'License status fetched successfully', {
        status: status.status,
        message: status.runtime?.status_message || status.message,
        expires_at: status.runtime?.expires_at || status.expiresAt || null,
        warning_days_remaining: status.runtime?.warning_days_remaining ?? status.daysRemaining ?? null,
        current_fingerprint: status.currentFingerprint || null,
        clock_tamper_detected_at: status.runtime?.clock_tamper_detected_at || null,
      })
    );
  } catch (error) {
    logger.error('Get public license status error', error);
    return res.status(500).json(
      createResponse(false, 'Failed to fetch license status')
    );
  }
};

const getLicenseStatus = async (req, res) => {
  try {
    const status = await licenseService.getCurrentStatus();
    const activeLicense = await licenseService.getActiveLicenseRecord();

    const entitlements = status.entitlements || {};
    const usage = status.usage || {};
    const activeUsersLimit = entitlements.max_active_users ?? null;
    const activeUsersCurrent = usage.active_users?.current ?? 0;
    const seatOverage = (activeUsersLimit !== null && activeUsersCurrent > activeUsersLimit)
      ? { overLimit: true, current: activeUsersCurrent, limit: activeUsersLimit, excess: activeUsersCurrent - activeUsersLimit }
      : null;

    return res.status(200).json(
      createResponse(true, 'License status fetched successfully', {
        current_status: status.status,
        message: status.runtime?.status_message || status.message,
        expires_at: status.runtime?.expires_at || status.expiresAt || null,
        warning_days_remaining: status.runtime?.warning_days_remaining ?? status.daysRemaining ?? null,
        current_fingerprint: status.currentFingerprint || null,
        clock_tamper_detected_at: status.runtime?.clock_tamper_detected_at || null,
        max_observed_at: status.runtime?.max_observed_at || null,
        entitlements: entitlements,
        usage: usage,
        seat_overage: seatOverage,
        active_license: activeLicense ? {
          license_id: activeLicense.license_id,
          customer_name: activeLicense.customer_name,
          product_name: activeLicense.product_name,
          edition: activeLicense.edition,
          issued_at: activeLicense.issued_at,
          expires_at: activeLicense.expires_at,
          installed_at: activeLicense.installed_at,
          server_fingerprint_hash: activeLicense.server_fingerprint_hash,
          payload: activeLicense.payload,
        } : null,
      })
    );
  } catch (error) {
    logger.error('Get license status error', error);
    return res.status(500).json(
      createResponse(false, 'Failed to fetch license status')
    );
  }
};

const getClientLicenseState = async (req, res) => {
  try {
    const status = await licenseService.getCurrentStatus();
    return res.status(200).json(
      createResponse(true, 'Client license state fetched successfully', {
        current_status: status.status,
        message: status.runtime?.status_message || status.message,
        entitlements: status.entitlements || {},
        usage: status.usage || {},
      })
    );
  } catch (error) {
    logger.error('Get client license state error', error);
    return res.status(500).json(
      createResponse(false, 'Failed to fetch client license state')
    );
  }
};

const getRecoveryContext = async (req, res) => {
  try {
    const context = await licenseService.getRecoveryContext();
    return res.status(200).json(
      createResponse(true, 'License recovery context fetched successfully', context)
    );
  } catch (error) {
    logger.error('Get license recovery context error', error);
    return res.status(500).json(
      createResponse(false, 'Failed to fetch license recovery context')
    );
  }
};

const installLicenseWithRecovery = async (req, res) => {
  try {
    const { payload, signature, algorithm = 'ed25519', recovery_key: recoveryKey } = req.body || {};
    if (!payload || !signature || !recoveryKey) {
      return res.status(400).json(
        createResponse(false, 'payload, signature and recovery_key are required')
      );
    }

    const result = await licenseService.installLicenseWithRecoveryKey({
      recoveryKey,
      envelope: { payload, signature, algorithm },
    });

    return res.status(200).json(
      createResponse(true, 'License installed successfully via recovery flow', {
        status: result.status,
        message: result.message,
        expires_at: result.expiresAt || null,
        warning_days_remaining: result.daysRemaining ?? null,
      })
    );
  } catch (error) {
    logger.error('Install license with recovery error', error);
    return res.status(400).json(
      createResponse(false, error.message || 'Failed to install license via recovery flow')
    );
  }
};

const installLicense = async (req, res) => {
  try {
    const { payload, signature, algorithm = 'ed25519' } = req.body || {};
    if (!payload || !signature) {
      return res.status(400).json(
        createResponse(false, 'payload and signature are required')
      );
    }

    const result = await licenseService.installLicense(
      { payload, signature, algorithm },
      req.user?.user_id || null
    );

    return res.status(200).json(
      createResponse(true, 'License installed successfully', {
        status: result.status,
        message: result.message,
        expires_at: result.expiresAt || null,
        warning_days_remaining: result.daysRemaining ?? null,
        seat_overage: result.seatOverage || null,
      })
    );
  } catch (error) {
    logger.error('Install license error', error);
    return res.status(400).json(
      createResponse(false, error.message || 'Failed to install license')
    );
  }
};

const refreshLicenseState = async (req, res) => {
  try {
    const result = await licenseService.syncRuntimeState();
    return res.status(200).json(
      createResponse(true, 'License runtime state refreshed successfully', {
        status: result.status,
        message: result.message,
        expires_at: result.expiresAt || null,
        warning_days_remaining: result.daysRemaining ?? null,
      })
    );
  } catch (error) {
    logger.error('Refresh license state error', error);
    return res.status(500).json(
      createResponse(false, 'Failed to refresh license runtime state')
    );
  }
};

module.exports = {
  getPublicLicenseStatus,
  getLicenseStatus,
  getClientLicenseState,
  getRecoveryContext,
  installLicense,
  installLicenseWithRecovery,
  refreshLicenseState,
};

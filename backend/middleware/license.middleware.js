// ============================================
// LICENSE MIDDLEWARE
// Central runtime gate for expired / missing licenses
// ============================================

const licenseService = require('../services/license.service');
const { createResponse } = require('../utils/helpers');
const logger = require('../utils/logger');

const enforceLicense = async (req, res, next) => {
  try {
    const result = await licenseService.assertRequestAllowed(req.originalUrl);
    if (result.allowed) {
      return next();
    }

    logger.warn('License enforcement blocked request', {
      path: req.originalUrl,
      method: req.method,
      status: result.status,
    });

    return res.status(403).json(
      createResponse(false, result.message, {
        code: 'LICENSE_BLOCKED',
        license_status: result.status,
      })
    );
  } catch (error) {
    logger.error('License middleware error', error);
    return res.status(500).json(
      createResponse(false, 'License validation failed unexpectedly')
    );
  }
};

const enforceLicensedFeature = (featureKey) => {
  return async (req, res, next) => {
    try {
      const result = await licenseService.assertFeatureAllowed(featureKey);
      if (result.allowed) {
        return next();
      }

      logger.warn('License feature enforcement blocked request', {
        path: req.originalUrl,
        method: req.method,
        feature: featureKey,
        status: result.status,
        code: result.code,
      });

      return res.status(403).json(
        createResponse(false, result.message, {
          code: result.code || 'LICENSE_FEATURE_DISABLED',
          license_status: result.status,
          feature: featureKey,
        })
      );
    } catch (error) {
      logger.error('License feature middleware error', error);
      return res.status(500).json(
        createResponse(false, 'Feature license validation failed unexpectedly')
      );
    }
  };
};

module.exports = {
  enforceLicense,
  enforceLicensedFeature,
};

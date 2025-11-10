// ============================================
// TWO-FACTOR AUTHENTICATION MIDDLEWARE
// Verify 2FA during login process
// Developer: Suvadip Panja
// Date: November 10, 2025
// FILE LOCATION: backend/middleware/verify2FA.middleware.js
// ============================================

const twoFactorService = require('../services/twoFactor.service');
const logger = require('../utils/logger');
const { createResponse } = require('../utils/helpers');

// ============================================
// CHECK IF 2FA IS REQUIRED FOR USER
// Used during login process
// ============================================
const check2FARequired = async (req, res, next) => {
  try {
    const userId = req.userId; // Set by login controller before calling this

    logger.try('Checking if 2FA is required', { userId });

    // Check if user has 2FA enabled
    const is2FAEnabled = await twoFactorService.is2FAEnabled(userId);

    if (!is2FAEnabled) {
      logger.info('2FA not enabled for user', { userId });
      req.requires2FA = false;
      return next();
    }

    logger.info('2FA is required for user', { userId });
    req.requires2FA = true;
    
    next();

  } catch (error) {
    logger.error('Check 2FA required middleware error', error);
    return res.status(500).json(
      createResponse(false, 'Failed to check 2FA status')
    );
  }
};

// ============================================
// VERIFY 2FA CODE DURING LOGIN
// Used when user submits 2FA code
// ============================================
const verify2FALogin = async (req, res, next) => {
  try {
    const { code, method } = req.body;
    const userId = req.userId; // Set by login controller

    logger.try('Verifying 2FA code during login', { userId, method });

    // Validation
    if (!code) {
      logger.warn('2FA code missing');
      return res.status(400).json(
        createResponse(false, 'Verification code is required')
      );
    }

    // Verify code
    const result = await twoFactorService.verify2FA(
      userId, 
      code, 
      method || 'email'
    );

    if (!result.success) {
      logger.warn('2FA verification failed during login', { userId });
      return res.status(401).json(
        createResponse(false, result.message)
      );
    }

    logger.success('2FA verified during login', { userId });
    req.is2FAVerified = true;
    
    next();

  } catch (error) {
    logger.error('Verify 2FA login middleware error', error);
    return res.status(500).json(
      createResponse(false, 'Failed to verify 2FA code')
    );
  }
};

// ============================================
// ENSURE USER HAS 2FA ENABLED
// Used for routes that require 2FA to be enabled
// ============================================
const require2FAEnabled = async (req, res, next) => {
  try {
    const userId = req.user.user_id;

    logger.try('Checking if user has 2FA enabled', { userId });

    const is2FAEnabled = await twoFactorService.is2FAEnabled(userId);

    if (!is2FAEnabled) {
      logger.warn('2FA not enabled for user', { userId });
      return res.status(403).json(
        createResponse(false, '2FA must be enabled to access this resource')
      );
    }

    logger.info('User has 2FA enabled', { userId });
    next();

  } catch (error) {
    logger.error('Require 2FA enabled middleware error', error);
    return res.status(500).json(
      createResponse(false, 'Failed to check 2FA status')
    );
  }
};

// ============================================
// EXPORTS
// ============================================
module.exports = {
  check2FARequired,
  verify2FALogin,
  require2FAEnabled
};
// ============================================
// QR CODE UTILITY
// Generate QR codes for authenticator apps
// Developer: Suvadip Panja
// Date: November 10, 2025
// FILE LOCATION: backend/utils/qrcode.util.js
// ============================================

const QRCode = require('qrcode');
const speakeasy = require('speakeasy');
const logger = require('../utils/logger');

// ============================================
// GENERATE SECRET FOR AUTHENTICATOR APP
// ============================================
const generateSecret = (username, issuer = 'Nexus Support') => {
  try {
    logger.try('Generating authenticator secret', { username, issuer });

    const secret = speakeasy.generateSecret({
      name: `${issuer} (${username})`,
      issuer: issuer,
      length: 32
    });

    logger.success('Secret generated successfully', { 
      username,
      secretLength: secret.base32.length 
    });

    return {
      secret: secret.base32, // Base32 encoded secret
      otpauth_url: secret.otpauth_url // URL for QR code
    };

  } catch (error) {
    logger.error('Failed to generate secret', error);
    throw error;
  }
};

// ============================================
// GENERATE QR CODE IMAGE (Base64)
// ============================================
const generateQRCode = async (otpauthUrl) => {
  try {
    logger.try('Generating QR code image');

    // Generate QR code as base64 data URL
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    logger.success('QR code generated successfully');

    return qrCodeDataUrl;

  } catch (error) {
    logger.error('Failed to generate QR code', error);
    throw error;
  }
};

// ============================================
// VERIFY TOTP TOKEN
// ============================================
const verifyToken = (token, secret) => {
  try {
    logger.try('Verifying TOTP token');

    const verified = speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
      window: 2 // Allow 2 time steps before/after (60 seconds tolerance)
    });

    if (verified) {
      logger.success('TOTP token verified successfully');
    } else {
      logger.warn('TOTP token verification failed');
    }

    return verified;

  } catch (error) {
    logger.error('Failed to verify TOTP token', error);
    return false;
  }
};

// ============================================
// GENERATE CURRENT TOTP TOKEN (for testing)
// ============================================
const generateToken = (secret) => {
  try {
    const token = speakeasy.totp({
      secret: secret,
      encoding: 'base32'
    });

    return token;

  } catch (error) {
    logger.error('Failed to generate TOTP token', error);
    throw error;
  }
};

// ============================================
// SETUP AUTHENTICATOR (Complete Flow)
// Generates secret + QR code in one call
// ============================================
const setupAuthenticator = async (username, issuer = 'Nexus Support') => {
  try {
    logger.try('Setting up authenticator', { username, issuer });

    // Generate secret
    const { secret, otpauth_url } = generateSecret(username, issuer);

    // Generate QR code
    const qrCodeDataUrl = await generateQRCode(otpauth_url);

    logger.success('Authenticator setup complete', { username });

    return {
      secret,
      qrCode: qrCodeDataUrl,
      otpauthUrl: otpauth_url
    };

  } catch (error) {
    logger.error('Failed to setup authenticator', error);
    throw error;
  }
};

// ============================================
// EXPORTS
// ============================================
module.exports = {
  generateSecret,
  generateQRCode,
  verifyToken,
  generateToken,
  setupAuthenticator
};
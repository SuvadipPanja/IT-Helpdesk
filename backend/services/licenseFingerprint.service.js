// ============================================
// LICENSE FINGERPRINT SERVICE
// Generates a stable server fingerprint for offline license binding
// ============================================

const crypto = require('crypto');
const os = require('os');
const config = require('../config/config');

const getFingerprintSource = () => {
  const explicitSeed = (process.env.LICENSE_FINGERPRINT_SEED || '').trim();
  if (explicitSeed) {
    return [
      'seed',
      explicitSeed,
      process.env.LICENSE_INSTANCE_SALT || '',
    ].join('|');
  }

  const parts = [
    os.hostname() || '',
    process.platform || '',
    process.arch || '',
    config.database?.server || '',
    config.database?.database || '',
    process.env.LICENSE_INSTANCE_SALT || '',
  ];

  return parts.join('|');
};

const getFingerprintHash = () => {
  return crypto
    .createHash('sha256')
    .update(getFingerprintSource())
    .digest('hex');
};

module.exports = {
  getFingerprintSource,
  getFingerprintHash,
};

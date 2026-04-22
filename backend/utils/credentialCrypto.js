'use strict';
/**
 * credentialCrypto.js
 * AES-256-GCM encrypt / decrypt for sensitive credential values stored
 * in Docker environment variables.
 *
 * Format  : "ENC:<base64(iv[12] + authTag[16] + ciphertext)>"
 * Key     : 32-byte value supplied as a 64-character hex string
 *           via the DB_CREDENTIAL_KEY environment variable.
 *
 * Usage
 * ─────
 * In application code:
 *   const { resolveCredential } = require('./credentialCrypto');
 *   const password = resolveCredential(process.env.DB_PASSWORD, process.env.DB_CREDENTIAL_KEY);
 *
 * To generate a new key + encrypted value (run once, store both in .env):
 *   node backend/utils/credentialCrypto.js encrypt "PlainPassword"
 */

const crypto = require('crypto');

const ENC_PREFIX = 'ENC:';

/**
 * Encrypt a plaintext string with AES-256-GCM.
 * @param {string} plaintext - The credential value to protect.
 * @param {string} hexKey    - 64-char hex string (32 bytes).
 * @returns {string}         - "ENC:<base64>" suitable for storing in .env
 */
function encryptCredential(plaintext, hexKey) {
  if (!hexKey || hexKey.length !== 64) {
    throw new Error('DB_CREDENTIAL_KEY must be a 64-character hex string (32 bytes)');
  }
  const key = Buffer.from(hexKey, 'hex');
  const iv  = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag   = cipher.getAuthTag();
  const combined  = Buffer.concat([iv, authTag, encrypted]);
  return `${ENC_PREFIX}${combined.toString('base64')}`;
}

/**
 * Decrypt a value produced by encryptCredential().
 * @param {string} encryptedValue - "ENC:<base64>" string from .env
 * @param {string} hexKey         - 64-char hex string (32 bytes).
 * @returns {string}              - Original plaintext.
 */
function decryptCredential(encryptedValue, hexKey) {
  if (!encryptedValue || !encryptedValue.startsWith(ENC_PREFIX)) {
    throw new Error(`Invalid encrypted credential: value must start with "${ENC_PREFIX}"`);
  }
  if (!hexKey || hexKey.length !== 64) {
    throw new Error('DB_CREDENTIAL_KEY must be a 64-character hex string (32 bytes)');
  }
  const key = Buffer.from(hexKey, 'hex');
  const raw = Buffer.from(encryptedValue.slice(ENC_PREFIX.length), 'base64');

  if (raw.length < 12 + 16 + 1) {
    throw new Error('Encrypted credential payload is too short — value may be corrupted');
  }

  const iv         = raw.slice(0, 12);
  const authTag    = raw.slice(12, 28);
  const ciphertext = raw.slice(28);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted  = decipher.update(ciphertext, undefined, 'utf8');
      decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Resolve a credential from the environment.
 * - If the value starts with "ENC:" it is decrypted using hexKey.
 * - Otherwise the value is returned as-is (allows plain-text in dev/test).
 *
 * @param {string}  value    - Raw value from process.env (encrypted or plain).
 * @param {string}  [hexKey] - DB_CREDENTIAL_KEY hex string (required when encrypted).
 * @returns {string}
 */
function resolveCredential(value, hexKey) {
  if (!value) return value;
  if (!value.startsWith(ENC_PREFIX)) return value;   // plain-text allowed in dev/test
  if (!hexKey) {
    throw new Error(
      'DB_PASSWORD is AES-encrypted but DB_CREDENTIAL_KEY is not set. ' +
      'Add DB_CREDENTIAL_KEY to your .env or Docker environment.'
    );
  }
  return decryptCredential(value, hexKey);
}

module.exports = { encryptCredential, decryptCredential, resolveCredential, ENC_PREFIX };

// ── CLI helper: node credentialCrypto.js encrypt "plaintext" ────────────
if (require.main === module) {
  const [,, cmd, text] = process.argv;
  if (cmd !== 'encrypt' || !text) {
    process.stderr.write('Usage: node credentialCrypto.js encrypt "<plaintext>"\n');
    process.exit(1);
  }
  const newKey = crypto.randomBytes(32).toString('hex');
  const enc    = encryptCredential(text, newKey);
  process.stdout.write(`DB_CREDENTIAL_KEY=${newKey}\nDB_PASSWORD=${enc}\n`);
}

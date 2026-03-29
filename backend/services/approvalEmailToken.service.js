/**
 * Single-use tokens for "approve / reject from email" links.
 * Raw token is only sent in email; DB stores SHA-256 hash.
 */

const crypto = require('crypto');
const { executeQuery } = require('../config/database');
const logger = require('../utils/logger');

const TOKEN_BYTES = 32;
const DEFAULT_EXPIRY_DAYS = 14;

function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

/**
 * Create or replace token row for an approval (one active token per approval).
 * @returns {Promise<{ rawToken: string, expiresAt: Date }>}
 */
async function mintTokenForApproval(approvalId) {
  const rawToken = crypto.randomBytes(TOKEN_BYTES).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + DEFAULT_EXPIRY_DAYS);

  await executeQuery(`DELETE FROM approval_email_action_tokens WHERE approval_id = @approvalId`, { approvalId });
  await executeQuery(
    `
    INSERT INTO approval_email_action_tokens (approval_id, token_hash, expires_at)
    VALUES (@approvalId, @tokenHash, @expiresAt)
    `,
    { approvalId, tokenHash, expiresAt }
  );

  return { rawToken, expiresAt };
}

/**
 * Resolve raw token to approval_id if valid (not expired, not used).
 */
async function peekApprovalIdByRawToken(rawToken) {
  if (!rawToken || typeof rawToken !== 'string' || rawToken.length < 16) {
    return null;
  }
  try {
    const tokenHash = hashToken(rawToken.trim());
    const result = await executeQuery(
      `
      SELECT approval_id, expires_at, used_at
      FROM approval_email_action_tokens
      WHERE token_hash = @tokenHash
      `,
      { tokenHash }
    );
    const row = result.recordset?.[0];
    if (!row) return null;
    if (row.used_at) return null;
    if (new Date(row.expires_at) < new Date()) return null;
    return row.approval_id;
  } catch (e) {
    logger.warn('peekApprovalIdByRawToken failed (invalid token or DB)', { error: e.message });
    return null;
  }
}

/**
 * Mark token used (after successful decision).
 */
async function markTokenUsedByApprovalId(approvalId) {
  await executeQuery(
    `
    UPDATE approval_email_action_tokens
    SET used_at = GETDATE()
    WHERE approval_id = @approvalId AND used_at IS NULL
    `,
    { approvalId }
  );
}

module.exports = {
  mintTokenForApproval,
  peekApprovalIdByRawToken,
  markTokenUsedByApprovalId,
  hashToken,
};

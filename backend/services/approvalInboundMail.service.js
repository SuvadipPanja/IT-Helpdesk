/**
 * Read approval replies from an IMAP mailbox (HD-APPROVE / HD-REJECT + token in subject).
 * Complements the web + mailto flow: user sends email from their client; this job applies the decision.
 */

const crypto = require('crypto');
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const { executeQuery } = require('../config/database');
const logger = require('../utils/logger');
const approvalEmailToken = require('./approvalEmailToken.service');
const { processApprovalDecision } = require('./approvalWorkflow.service');

const SUBJECT_PATTERN = /^(HD-APPROVE|HD-REJECT)\s+([a-f0-9]{64})$/i;

function stripReplyPrefixes(subject) {
  let s = String(subject || '').trim();
  for (let i = 0; i < 10; i += 1) {
    const next = s.replace(/^(re|fwd|fw|aw|sv|vs):\s*/i, '').trim();
    if (next === s) break;
    s = next;
  }
  return s;
}

function normalizeEmail(addr) {
  if (!addr) return '';
  return String(addr).trim().toLowerCase();
}

function hashMessageId(messageId) {
  const raw = messageId || `noid-${Date.now()}-${Math.random()}`;
  return crypto.createHash('sha256').update(String(raw), 'utf8').digest('hex');
}

function getImapOptionsFromEnv() {
  const enabled = ['true', '1', 'yes'].includes(String(process.env.APPROVAL_INBOUND_IMAP_ENABLED || '').toLowerCase());
  if (!enabled) return null;
  const host = (process.env.APPROVAL_INBOUND_IMAP_HOST || '').trim();
  const user = (process.env.APPROVAL_INBOUND_IMAP_USER || '').trim();
  const pass = process.env.APPROVAL_INBOUND_IMAP_PASSWORD || '';
  if (!host || !user || !pass) {
    logger.warn('Approval inbound IMAP: enabled but APPROVAL_INBOUND_IMAP_HOST / USER / PASS incomplete');
    return null;
  }
  const port = parseInt(process.env.APPROVAL_INBOUND_IMAP_PORT || '993', 10);
  const secure = !['false', '0'].includes(String(process.env.APPROVAL_INBOUND_IMAP_TLS || 'true').toLowerCase());
  return {
    host,
    port,
    secure,
    auth: { user, pass },
    logger: false,
  };
}

function parseDecisionFromSubject(subject) {
  const cleaned = stripReplyPrefixes(subject);
  const m = cleaned.match(SUBJECT_PATTERN);
  if (!m) return null;
  const action = m[1].toUpperCase();
  const token = m[2].toLowerCase();
  const decision = action === 'HD-APPROVE' ? 'APPROVED' : 'REJECTED';
  return { decision, token, actionKey: action };
}

async function rowExists(messageIdHash) {
  const r = await executeQuery(
    `SELECT 1 AS ok FROM approval_inbound_processed WHERE message_id_hash = @messageIdHash`,
    { messageIdHash }
  );
  return !!r.recordset?.length;
}

async function insertProcessedRow(messageIdHash, internetMessageId, approvalId, outcome, detail) {
  if (await rowExists(messageIdHash)) return false;
  await executeQuery(
    `
    INSERT INTO approval_inbound_processed (message_id_hash, internet_message_id, approval_id, outcome, detail)
    VALUES (@messageIdHash, @internetMessageId, @approvalId, @outcome, @detail)
    `,
    {
      messageIdHash,
      internetMessageId: internetMessageId || null,
      approvalId: approvalId ?? null,
      outcome,
      detail: detail ? String(detail).slice(0, 500) : null,
    }
  );
  return true;
}

async function updateProcessedOutcome(messageIdHash, outcome, detail) {
  await executeQuery(
    `UPDATE approval_inbound_processed SET outcome = @outcome, detail = @detail WHERE message_id_hash = @messageIdHash`,
    {
      messageIdHash,
      outcome,
      detail: detail ? String(detail).slice(0, 500) : null,
    }
  );
}

/**
 * Process one parsed mail (subject + from).
 */
async function handleParsedMail({ subject, fromAddress, messageId }) {
  const messageIdHash = hashMessageId(messageId || `${subject}-${fromAddress}`);

  if (await rowExists(messageIdHash)) {
    return { skipped: true, reason: 'duplicate_message' };
  }

  const parsedSubj = parseDecisionFromSubject(subject);
  if (!parsedSubj) {
    await insertProcessedRow(messageIdHash, messageId, null, 'SUBJECT_NO_MATCH', subject);
    return { skipped: true, reason: 'subject_no_match' };
  }

  const { decision, token } = parsedSubj;
  const approvalId = await approvalEmailToken.peekApprovalIdByRawToken(token);
  if (!approvalId) {
    await insertProcessedRow(messageIdHash, messageId, null, 'BAD_TOKEN', null);
    return { skipped: true, reason: 'bad_token' };
  }

  const appr = await executeQuery(
    `
    SELECT ta.approver_id, u.email AS approver_email
    FROM ticket_approvals ta
    INNER JOIN users u ON ta.approver_id = u.user_id
    WHERE ta.approval_id = @approvalId AND ta.is_active = 1 AND ta.status = 'PENDING'
    `,
    { approvalId }
  );
  const row = appr.recordset?.[0];
  if (!row) {
    await insertProcessedRow(messageIdHash, messageId, approvalId, 'NOT_PENDING', null);
    return { skipped: true, reason: 'not_pending' };
  }

  const expected = normalizeEmail(row.approver_email);
  const actual = normalizeEmail(fromAddress);
  if (!actual || actual !== expected) {
    await insertProcessedRow(
      messageIdHash,
      messageId,
      approvalId,
      'WRONG_SENDER',
      `expected ${expected}, got ${actual}`
    );
    logger.warn('Approval inbound: From does not match approver', {
      approvalId,
      expected,
      actual,
    });
    return { skipped: true, reason: 'wrong_sender' };
  }

  const reserved = await insertProcessedRow(messageIdHash, messageId, approvalId, 'PROCESSING', null);
  if (!reserved) {
    return { skipped: true, reason: 'duplicate_message' };
  }

  const decisionNote =
    decision === 'APPROVED' ? 'Approved via inbound email (subject line).' : 'Rejected via inbound email (subject line).';

  const result = await processApprovalDecision({
    approvalId,
    decision,
    decisionNote,
    actingUserId: row.approver_id,
  });

  if (!result.success) {
    await updateProcessedOutcome(messageIdHash, 'PROCESS_FAILED', result.message || 'process_failed');
    return { skipped: true, reason: 'process_failed', message: result.message };
  }

  await approvalEmailToken.markTokenUsedByApprovalId(approvalId);
  await updateProcessedOutcome(messageIdHash, 'SUCCESS', null);

  logger.success('Approval inbound: decision applied from email', { approvalId, decision });
  return { success: true, approvalId, decision };
}

/**
 * Poll IMAP INBOX for unseen messages and process approval subjects.
 */
async function processInboxOnce() {
  const imapOpts = getImapOptionsFromEnv();
  if (!imapOpts) {
    return { ran: false, reason: 'imap_disabled_or_incomplete' };
  }

  const client = new ImapFlow(imapOpts);
  await client.connect();

  let processed = 0;
  let errors = 0;

  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      const uids = await client.search({ seen: false }, { uid: true });
      const list = Array.isArray(uids) ? uids : uids ? [uids] : [];
      if (!list.length) {
        return { ran: true, processed: 0, unseen: 0 };
      }

      for await (const msg of client.fetch(list, { source: true, uid: true })) {
        try {
          const parsed = await simpleParser(msg.source);
          const fromAddr = parsed.from?.value?.[0]?.address || parsed.sender?.value?.[0]?.address || '';
          const subj = parsed.subject || '';
          const mid = parsed.messageId || '';

          const res = await handleParsedMail({
            subject: subj,
            fromAddress: fromAddr,
            messageId: mid,
          });

          await client.messageFlagsAdd({ uid: msg.uid }, ['\\Seen'], { uid: true });
          if (res.success) processed += 1;
        } catch (inner) {
          errors += 1;
          logger.error('Approval inbound: message processing error', inner);
          try {
            await client.messageFlagsAdd({ uid: msg.uid }, ['\\Seen'], { uid: true });
          } catch (_) {
            /* ignore */
          }
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }

  return { ran: true, processed, errors };
}

module.exports = {
  processInboxOnce,
  getImapOptionsFromEnv,
  stripReplyPrefixes,
  parseDecisionFromSubject,
  hashMessageId,
};

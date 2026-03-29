// ============================================
// WhatsApp Media Service — Phase 9 Phase 4
// Downloads media from Meta's API and attaches
// the file to the relevant helpdesk ticket.
// ============================================

const fs   = require('fs');
const path = require('path');
const https = require('https');
const http  = require('http');
const db = require('../config/database');
const settingsService  = require('./settings.service');
const logger           = require('../utils/logger');

// ── Constants ─────────────────────────────────────────────────────────────────

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'tickets');
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB — same as multer limit

// MIME → extension map for WhatsApp media types
const MIME_TO_EXT = {
  'image/jpeg':                  'jpg',
  'image/png':                   'png',
  'image/gif':                   'gif',
  'image/webp':                  'webp',
  'image/bmp':                   'bmp',
  'video/mp4':                   'mp4',
  'video/3gpp':                  '3gp',
  'audio/ogg':                   'ogg',
  'audio/mpeg':                  'mp3',
  'application/pdf':             'pdf',
  'application/msword':          'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel':    'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/plain':                  'txt',
  'application/zip':             'zip',
};

// Meta media types that are allowed for ticket attachment
const ALLOWED_MEDIA_TYPES = new Set(['image', 'document', 'video', 'audio']);

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Generates a safe, unique filename.
 * e.g. wa-image-1711000000000-4f2a.jpg
 */
const generateFileName = (mediaType, mimeType) => {
  const ext  = MIME_TO_EXT[mimeType] || mediaType || 'bin';
  const ts   = Date.now();
  const rand = Math.random().toString(36).substring(2, 6);
  return `wa-${mediaType}-${ts}-${rand}.${ext}`;
};

/**
 * Fetch a URL and pipe the body to `destPath`.
 * Respects MAX_SIZE_BYTES — rejects oversized files.
 * Returns { fileSizeBytes, mimeType }.
 */
const downloadUrl = (url, destPath) => new Promise((resolve, reject) => {
  const proto = url.startsWith('https') ? https : http;
  const file  = fs.createWriteStream(destPath);
  let received = 0;
  let mimeType = 'application/octet-stream';

  proto.get(url, (res) => {
    mimeType = res.headers['content-type']?.split(';')[0]?.trim() || mimeType;

    res.on('data', (chunk) => {
      received += chunk.length;
      if (received > MAX_SIZE_BYTES) {
        res.destroy();
        file.destroy();
        fs.unlink(destPath, () => {});
        reject(new Error(`Media file exceeds 10 MB limit (${Math.round(received / 1024 / 1024)} MB)`));
      }
    });

    res.pipe(file);
    file.on('finish', () => file.close(() => resolve({ fileSizeBytes: received, mimeType })));
    file.on('error', (err) => { fs.unlink(destPath, () => {}); reject(err); });
  }).on('error', (err) => { fs.unlink(destPath, () => {}); reject(err); });
});

// ── Meta API helpers ──────────────────────────────────────────────────────────

/**
 * Retrieve the temporary download URL from Meta's media endpoint.
 * Meta returns: { url, mime_type, sha256, file_size, id, messaging_product }
 */
const getMediaUrl = async (mediaId, apiToken) => {
  const url = `https://graph.facebook.com/v19.0/${mediaId}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiToken}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Meta media info failed (${res.status}): ${body}`);
  }
  return res.json(); // { url, mime_type, ... }
};

/**
 * Download the actual file bytes using the temporary URL returned by Meta.
 * Meta requires the Authorization header on this second request too.
 */
const downloadMetaMedia = (mediaUrl, apiToken, destPath) => new Promise((resolve, reject) => {
  const proto = mediaUrl.startsWith('https') ? https : http;
  const file  = fs.createWriteStream(destPath);
  let received = 0;
  let mimeType = 'application/octet-stream';

  const options = {
    headers: { Authorization: `Bearer ${apiToken}` },
  };

  proto.get(mediaUrl, options, (res) => {
    mimeType = res.headers['content-type']?.split(';')[0]?.trim() || mimeType;

    res.on('data', (chunk) => {
      received += chunk.length;
      if (received > MAX_SIZE_BYTES) {
        res.destroy();
        file.destroy();
        fs.unlink(destPath, () => {});
        reject(new Error(`Media exceeds 10 MB limit`));
      }
    });

    res.pipe(file);
    file.on('finish', () => file.close(() => resolve({ fileSizeBytes: received, mimeType })));
    file.on('error', (err) => { fs.unlink(destPath, () => {}); reject(err); });
  }).on('error', (err) => { fs.unlink(destPath, () => {}); reject(err); });
});

// ── Core public function ──────────────────────────────────────────────────────

/**
 * handleIncomingMedia(event, ticketId)
 *
 * Downloads the media attached to an incoming WhatsApp message and inserts a
 * record into ticket_attachments.
 *
 * @param {object} event       — parsed webhook event from whatsappService
 * @param {number} ticketId    — the ticket to attach the file to
 * @param {number} uploadedBy  — user_id of the person who sent the media
 *
 * @returns {object} { success, fileName, filePath, fileSizeKb, message }
 */
const handleIncomingMedia = async (event, ticketId, uploadedBy) => {
  const { mediaId, mediaType, phone } = event;

  if (!mediaId) {
    return { success: false, message: 'No media ID in event' };
  }

  if (!ALLOWED_MEDIA_TYPES.has(mediaType)) {
    return { success: false, message: `Unsupported media type: ${mediaType}` };
  }

  // 1. Get API token from settings
  const apiToken = await settingsService.get('whatsapp_api_token');
  if (!apiToken) {
    return { success: false, message: 'WhatsApp API token not configured' };
  }

  // 2. Get the media download URL from Meta
  let mediaInfo;
  try {
    mediaInfo = await getMediaUrl(mediaId, apiToken);
  } catch (err) {
    logger.error('WhatsApp media: failed to get URL from Meta', { mediaId, error: err.message });
    return { success: false, message: `Could not retrieve media URL: ${err.message}` };
  }

  // 3. Generate a local filename and path
  const mimeType = mediaInfo.mime_type || 'application/octet-stream';
  const fileName = generateFileName(mediaType, mimeType);
  const destPath = path.join(UPLOAD_DIR, fileName);

  // Ensure upload directory exists
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  // 4. Download the file
  let fileSizeBytes;
  try {
    ({ fileSizeBytes } = await downloadMetaMedia(mediaInfo.url, apiToken, destPath));
  } catch (err) {
    logger.error('WhatsApp media: download failed', { mediaId, error: err.message });
    return { success: false, message: `Download failed: ${err.message}` };
  }

  const fileSizeKb = Math.ceil(fileSizeBytes / 1024);

  // 5. Insert into ticket_attachments
  try {
    await db.executeQuery(`
      INSERT INTO ticket_attachments (ticket_id, file_name, file_path, file_size_kb, file_type, uploaded_by)
      VALUES (@ticketId, @fileName, @filePath, @fileSizeKb, @fileType, @uploadedBy)
    `, {
      ticketId:   Number(ticketId),
      fileName,
      filePath:   fileName,  // relative to uploads/tickets/
      fileSizeKb,
      fileType:   mimeType,
      uploadedBy: uploadedBy || null,
    });
  } catch (err) {
    // Clean up the downloaded file if DB insert fails
    fs.unlink(destPath, () => {});
    logger.error('WhatsApp media: DB insert failed', { ticketId, error: err.message });
    return { success: false, message: `Attachment record failed: ${err.message}` };
  }

  // 6. Log to ticket activity
  try {
    await db.executeQuery(`
      INSERT INTO ticket_activities (ticket_id, user_id, activity_type, description, created_at)
      VALUES (@ticketId, @userId, 'ATTACHMENT_ADDED', @desc, GETDATE())
    `, {
      ticketId: Number(ticketId),
      userId:   uploadedBy || null,
      desc:     `File attached via WhatsApp: ${fileName} (${fileSizeKb} KB)`,
    });
  } catch { /* non-blocking — don't fail the attachment if activity log fails */ }

  logger.success('WhatsApp media attached to ticket', { ticketId, fileName, fileSizeKb });

  return {
    success: true,
    fileName,
    filePath: destPath,
    fileSizeKb,
    message: `File attached: ${fileName}`,
  };
};

/**
 * getTicketForUser(userId)
 * Returns the user's most recent open ticket (for auto-attach).
 */
const getLatestOpenTicketForUser = async (userId) => {
  const result = await db.executeQuery(`
    SELECT TOP 1 t.ticket_id, t.ticket_number, t.subject
    FROM tickets t
    INNER JOIN ticket_statuses ts ON t.status_id = ts.status_id
    WHERE t.requester_id = @userId AND ts.is_final_status = 0
    ORDER BY t.created_at DESC, t.ticket_id DESC
  `, { userId });
  return result.recordset?.[0] || null;
};

module.exports = {
  handleIncomingMedia,
  getLatestOpenTicketForUser,
  ALLOWED_MEDIA_TYPES,
};

/**
 * ============================================
 * ATTACHMENTS CONTROLLER - FIXED VERSION
 * ============================================
 * Handles file upload operations for tickets
 * 
 * FIX APPLIED: Extended MIME type support + extension-based fallback
 * Issue: Excel/DOC files uploaded but not saved to DB
 * Cause: Browser sending 'application/octet-stream' for Office files
 * 
 * Developer: Suvadip Panja
 * Company: Digitide
 * Updated: February 2026
 * FILE: backend/controllers/attachmentsController.js
 * ============================================
 */

const { executeQuery } = require('../config/database');
const { createResponse } = require('../utils/helpers');
const logger = require('../utils/logger');
const { validateMagicBytes } = require('../utils/magic-bytes');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ============================================
// UPLOAD DIRECTORY SETUP
// ============================================
const uploadDir = path.join(__dirname, '../uploads/tickets');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  logger.info('Tickets upload directory created', { path: uploadDir });
}

// ============================================
// STORAGE CONFIGURATION
// ============================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: originalname-timestamp-random.extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    // Sanitize filename - remove special characters
    const safeName = nameWithoutExt.replace(/[^a-zA-Z0-9-_]/g, '_').substring(0, 50);
    cb(null, `${safeName}-${uniqueSuffix}${ext}`);
  }
});

// ============================================
// ALLOWED MIME TYPES - EXPANDED LIST
// ============================================
const ALLOWED_MIME_TYPES = [
  // PDF
  'application/pdf',
  
  // Word Documents (.doc, .docx)
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  
  // Excel Documents (.xls, .xlsx)
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  
  // PowerPoint (.ppt, .pptx)
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  
  // Images
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/svg+xml',
  
  // Text files
  'text/plain',
  'text/csv',
  
  // Archives
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  
  // ⭐ IMPORTANT: Generic binary type (browsers often use this for Office files)
  'application/octet-stream'
];

// ============================================
// ALLOWED FILE EXTENSIONS (Fallback check)
// ============================================
const ALLOWED_EXTENSIONS = [
  '.pdf',
  '.doc', '.docx',
  '.xls', '.xlsx',
  '.ppt', '.pptx',
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg',
  '.txt', '.csv',
  '.zip', '.rar', '.7z'
];

// ============================================
// FILE FILTER - WITH EXTENSION FALLBACK
// ============================================
const fileFilter = (req, file, cb) => {
  const mimeType = file.mimetype.toLowerCase();
  const ext = path.extname(file.originalname).toLowerCase();
  
  logger.info(`📎 File upload attempt: ${file.originalname}`);
  logger.info(`   MIME type: ${mimeType}`);
  logger.info(`   Extension: ${ext}`);

  // Check 1: MIME type in allowed list
  if (ALLOWED_MIME_TYPES.includes(mimeType)) {
    // If MIME is 'application/octet-stream', verify by extension
    if (mimeType === 'application/octet-stream') {
      if (ALLOWED_EXTENSIONS.includes(ext)) {
        logger.success(`✅ File accepted (octet-stream with valid extension): ${file.originalname}`);
        cb(null, true);
      } else {
        logger.warn(`❌ File rejected (octet-stream with invalid extension): ${file.originalname}`);
        cb(new Error(`File extension ${ext} is not allowed`), false);
      }
    } else {
      logger.success(`✅ File accepted (valid MIME): ${file.originalname}`);
      cb(null, true);
    }
    return;
  }

  // Check 2: Fallback to extension check
  if (ALLOWED_EXTENSIONS.includes(ext)) {
    logger.success(`✅ File accepted (valid extension): ${file.originalname}`);
    cb(null, true);
    return;
  }

  // Reject file
  logger.warn(`❌ File rejected: ${file.originalname} (MIME: ${mimeType}, Ext: ${ext})`);
  cb(new Error(`File type not allowed. Accepted: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, Images, TXT, CSV, ZIP, RAR`), false);
};

// ============================================
// MULTER CONFIGURATION
// ============================================
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
    files: 10 // Max 10 files per request
  }
});

// ============================================
// GET PROPER MIME TYPE FOR DISPLAY
// ============================================
const getDisplayMimeType = (originalMime, filename) => {
  // If browser sent generic type, determine from extension
  if (originalMime === 'application/octet-stream') {
    const ext = path.extname(filename).toLowerCase();
    const mimeMap = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.txt': 'text/plain',
      '.csv': 'text/csv',
      '.zip': 'application/zip',
      '.rar': 'application/x-rar-compressed'
    };
    return mimeMap[ext] || originalMime;
  }
  return originalMime;
};

/**
 * Upload attachments to ticket
 * @route POST /api/v1/tickets/:id/attachments
 * @access Private
 */
const uploadAttachments = async (req, res, next) => {
  try {
    const ticketId = req.params.id;
    const userId = req.user.user_id;
    const files = req.files;

    logger.separator('FILE UPLOAD');
    logger.try('Uploading attachments', {
      ticketId,
      userId,
      filesCount: files?.length || 0
    });

    // Check if ticket exists and get ownership info
    const ticketCheck = await executeQuery(
      'SELECT ticket_id, requester_id, assigned_to FROM tickets WHERE ticket_id = @ticketId',
      { ticketId }
    );

    if (ticketCheck.recordset.length === 0) {
      logger.warn('Ticket not found', { ticketId });
      return res.status(404).json(
        createResponse(false, 'Ticket not found')
      );
    }

    // Permission check: admin/manager, requester, or assigned engineer only
    const ticketData = ticketCheck.recordset[0];
    const roleCode = req.user.role?.role_code || '';
    const isAdminOrManager = roleCode === 'ADMIN' || roleCode === 'MANAGER';
    const isRequester = ticketData.requester_id === userId;
    const isAssigned = ticketData.assigned_to === userId;

    if (!isAdminOrManager && !isRequester && !(ticketData.assigned_to && isAssigned)) {
      logger.warn('Unauthorized upload attempt', { userId, ticketId });
      return res.status(403).json(
        createResponse(false, 'You do not have permission to upload attachments to this ticket')
      );
    }

    if (!files || files.length === 0) {
      logger.warn('No files provided');
      return res.status(400).json(
        createResponse(false, 'No files provided')
      );
    }

    logger.info(`Processing ${files.length} file(s)`);

    const uploadedFiles = [];
    const failedFiles = [];

    // Insert each file into database
    for (const file of files) {
      try {
        const fileSizeKB = Math.round(file.size / 1024);
        const displayMimeType = getDisplayMimeType(file.mimetype, file.originalname);
        const ext = path.extname(file.originalname).toLowerCase();
        const savedPath = path.join(uploadDir, file.filename);

        // Magic byte validation — verify file content matches claimed extension
        if (!validateMagicBytes(savedPath, ext)) {
          logger.warn(`❌ Magic byte mismatch: ${file.originalname} (ext: ${ext})`);
          try { fs.unlinkSync(savedPath); } catch { /* ignore cleanup errors */ }
          failedFiles.push({ file_name: file.originalname, error: 'File content does not match its extension' });
          continue;
        }
        
        logger.try(`Inserting file: ${file.originalname}`);
        logger.info(`  Size: ${fileSizeKB} KB`);
        logger.info(`  MIME: ${displayMimeType}`);
        logger.info(`  Stored as: ${file.filename}`);

        const insertQuery = `
          INSERT INTO ticket_attachments (
            ticket_id,
            file_name,
            file_path,
            file_size_kb,
            file_type,
            uploaded_by
          )
          OUTPUT INSERTED.attachment_id
          VALUES (
            @ticketId,
            @fileName,
            @filePath,
            @fileSizeKB,
            @fileType,
            @uploadedBy
          )
        `;

        const result = await executeQuery(insertQuery, {
          ticketId: parseInt(ticketId),
          fileName: file.originalname,
          filePath: file.filename,
          fileSizeKB: fileSizeKB,
          fileType: displayMimeType,
          uploadedBy: userId
        });

        if (result.recordset && result.recordset.length > 0) {
          const attachmentId = result.recordset[0].attachment_id;

          uploadedFiles.push({
            attachment_id: attachmentId,
            file_name: file.originalname,
            file_size_kb: fileSizeKB,
            file_type: displayMimeType
          });

          logger.success(`✅ File inserted: ${file.originalname} (ID: ${attachmentId})`);
        } else {
          throw new Error('No attachment_id returned from INSERT');
        }

      } catch (fileError) {
        logger.error(`❌ Failed to insert file: ${file.originalname}`, fileError);
        failedFiles.push({
          file_name: file.originalname,
          error: fileError.message
        });
        
        // Delete the uploaded file if DB insert failed
        try {
          const filePath = path.join(uploadDir, file.filename);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            logger.info(`Deleted orphaned file: ${file.filename}`);
          }
        } catch (deleteError) {
          logger.error('Failed to delete orphaned file', deleteError);
        }
      }
    }

    // Log activity if any files were uploaded
    if (uploadedFiles.length > 0) {
      try {
        await executeQuery(
          `INSERT INTO ticket_activities (
            ticket_id, activity_type, description, performed_by
          )
          VALUES (@ticketId, 'ATTACHMENT_ADDED', @description, @userId)`,
          {
            ticketId: parseInt(ticketId),
            description: `${uploadedFiles.length} file(s) attached: ${uploadedFiles.map(f => f.file_name).join(', ')}`,
            userId
          }
        );
      } catch (activityError) {
        logger.warn('Failed to log activity', activityError);
      }
    }

    logger.separator('UPLOAD COMPLETE');
    logger.success('Upload summary', {
      successful: uploadedFiles.length,
      failed: failedFiles.length
    });
    logger.separator();

    // Return response
    if (uploadedFiles.length === 0) {
      return res.status(400).json(
        createResponse(false, 'All file uploads failed', { 
          failed: failedFiles 
        })
      );
    }

    return res.status(201).json(
      createResponse(
        true,
        `${uploadedFiles.length} file(s) uploaded successfully${failedFiles.length > 0 ? `, ${failedFiles.length} failed` : ''}`,
        { 
          attachments: uploadedFiles,
          failed: failedFiles.length > 0 ? failedFiles : undefined
        }
      )
    );

  } catch (error) {
    logger.error('Upload attachments error', error);
    logger.separator();
    next(error);
  }
};

/**
 * Get attachments for a ticket
 * @route GET /api/v1/tickets/:id/attachments
 * @access Private
 */
const getAttachments = async (req, res, next) => {
  try {
    const ticketId = req.params.id;

    logger.try('Fetching attachments', { ticketId });

    const query = `
      SELECT 
        ta.attachment_id,
        ta.file_name,
        ta.file_path,
        ta.file_size_kb,
        ta.file_type,
        ta.uploaded_at,
        u.first_name + ' ' + u.last_name as uploaded_by_name,
        u.user_id as uploaded_by_id
      FROM ticket_attachments ta
      LEFT JOIN users u ON ta.uploaded_by = u.user_id
      WHERE ta.ticket_id = @ticketId
      ORDER BY ta.uploaded_at DESC
    `;

    const result = await executeQuery(query, { ticketId });

    logger.success('Attachments fetched', {
      count: result.recordset.length
    });

    return res.status(200).json(
      createResponse(
        true,
        'Attachments fetched successfully',
        result.recordset
      )
    );

  } catch (error) {
    logger.error('Get attachments error', error);
    next(error);
  }
};

/**
 * Download attachment
 * @route GET /api/v1/tickets/:id/attachments/:attachmentId/download
 * @access Private
 */
const downloadAttachment = async (req, res, next) => {
  try {
    const { id: ticketId, attachmentId } = req.params;

    logger.try('Downloading attachment', { ticketId, attachmentId });

    // Get attachment info + ticket ownership for permission check
    const query = `
      SELECT ta.file_name, ta.file_path, t.requester_id, t.assigned_to
      FROM ticket_attachments ta
      JOIN tickets t ON ta.ticket_id = t.ticket_id
      WHERE ta.attachment_id = @attachmentId AND ta.ticket_id = @ticketId
    `;

    const result = await executeQuery(query, { attachmentId, ticketId });

    if (result.recordset.length === 0) {
      logger.warn('Attachment not found');
      return res.status(404).json(
        createResponse(false, 'Attachment not found')
      );
    }

    const attachment = result.recordset[0];

    // Permission check: admin/manager, requester, or assigned engineer only
    const userId = req.user.user_id;
    const roleCode = req.user.role?.role_code || '';
    const isAdminOrManager = roleCode === 'ADMIN' || roleCode === 'MANAGER';
    const isRequester = attachment.requester_id === userId;
    const isAssigned = attachment.assigned_to === userId;

    if (!isAdminOrManager && !isRequester && !(attachment.assigned_to && isAssigned)) {
      logger.warn('Unauthorized download attempt', { userId, ticketId });
      return res.status(403).json(
        createResponse(false, 'You do not have permission to download this attachment')
      );
    }

    const filePath = path.join(uploadDir, path.basename(attachment.file_path));

    // Validate file stays within upload directory
    if (!filePath.startsWith(uploadDir)) {
      logger.error('Path traversal attempt blocked', { filePath });
      return res.status(400).json(
        createResponse(false, 'Invalid file path')
      );
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      logger.error('File not found on disk', { filePath });
      return res.status(404).json(
        createResponse(false, 'File not found on server')
      );
    }

    logger.success('Serving file download', { fileName: attachment.file_name });

    // Send file
    res.download(filePath, attachment.file_name, (err) => {
      if (err) {
        logger.error('Download error', err);
        if (!res.headersSent) {
          next(err);
        }
      }
    });

  } catch (error) {
    logger.error('Download attachment error', error);
    next(error);
  }
};

/**
 * Delete attachment
 * @route DELETE /api/v1/tickets/:id/attachments/:attachmentId
 * @access Private
 */
const deleteAttachment = async (req, res, next) => {
  try {
    const { id: ticketId, attachmentId } = req.params;
    const userId = req.user.user_id;

    logger.separator('DELETE ATTACHMENT');
    logger.try('Deleting attachment', { ticketId, attachmentId });

    // Get attachment info
    const query = `
      SELECT file_name, file_path, uploaded_by
      FROM ticket_attachments
      WHERE attachment_id = @attachmentId AND ticket_id = @ticketId
    `;

    const result = await executeQuery(query, { attachmentId, ticketId });

    if (result.recordset.length === 0) {
      logger.warn('Attachment not found');
      return res.status(404).json(
        createResponse(false, 'Attachment not found')
      );
    }

    const attachment = result.recordset[0];

    // Check permission (only uploader or admin can delete)
    const canDelete = attachment.uploaded_by === userId || 
                     req.user.permissions?.can_manage_system ||
                     req.user.permissions?.can_delete_tickets;

    if (!canDelete) {
      logger.warn('Unauthorized delete attempt');
      return res.status(403).json(
        createResponse(false, 'You do not have permission to delete this attachment')
      );
    }

    // Delete file from disk
    const filePath = path.join(uploadDir, path.basename(attachment.file_path));
    if (!filePath.startsWith(uploadDir)) {
      logger.error('Path traversal attempt blocked on delete', { filePath });
      return res.status(400).json(
        createResponse(false, 'Invalid file path')
      );
    }
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.success('File deleted from disk');
    } else {
      logger.warn('File not found on disk (already deleted?)');
    }

    // Delete from database
    await executeQuery(
      'DELETE FROM ticket_attachments WHERE attachment_id = @attachmentId',
      { attachmentId }
    );

    logger.success('Attachment deleted from database');

    // Log activity
    try {
      await executeQuery(
        `INSERT INTO ticket_activities (
          ticket_id, activity_type, description, performed_by
        )
        VALUES (@ticketId, 'ATTACHMENT_DELETED', @description, @userId)`,
        {
          ticketId: parseInt(ticketId),
          description: `Attachment deleted: ${attachment.file_name}`,
          userId
        }
      );
    } catch (activityError) {
      logger.warn('Failed to log activity', activityError);
    }

    logger.separator('DELETION SUCCESSFUL');
    logger.separator();

    return res.status(200).json(
      createResponse(true, 'Attachment deleted successfully')
    );

  } catch (error) {
    logger.error('Delete attachment error', error);
    logger.separator();
    next(error);
  }
};

// ============================================
// EXPORTS
// ============================================
module.exports = {
  upload,
  uploadAttachments,
  getAttachments,
  downloadAttachment,
  deleteAttachment
};
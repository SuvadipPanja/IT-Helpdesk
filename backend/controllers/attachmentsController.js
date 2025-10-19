// ============================================
// Attachments Controller
// Handles file upload operations
// ============================================

const { executeQuery } = require('../config/database');
const { createResponse } = require('../utils/helpers');
const logger = require('../utils/logger');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/tickets');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-random-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    cb(null, `${nameWithoutExt}-${uniqueSuffix}${ext}`);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'text/plain',
    'application/zip',
    'application/x-rar-compressed'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed`), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

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

    // Check if ticket exists
    const ticketCheck = await executeQuery(
      'SELECT ticket_id FROM tickets WHERE ticket_id = @ticketId',
      { ticketId }
    );

    if (ticketCheck.recordset.length === 0) {
      logger.warn('Ticket not found', { ticketId });
      return res.status(404).json(
        createResponse(false, 'Ticket not found')
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

    // Insert each file into database
    for (const file of files) {
      const fileSizeKB = Math.round(file.size / 1024);
      
      logger.try(`Inserting file: ${file.originalname}`);

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
        ticketId,
        fileName: file.originalname,
        filePath: file.filename, // Store the generated filename
        fileSizeKB: fileSizeKB,
        fileType: file.mimetype,
        uploadedBy: userId
      });

      const attachmentId = result.recordset[0].attachment_id;

      uploadedFiles.push({
        attachment_id: attachmentId,
        file_name: file.originalname,
        file_size_kb: fileSizeKB,
        file_type: file.mimetype
      });

      logger.success(`File inserted: ${file.originalname}`);
    }

    // Log activity
    await executeQuery(
      `INSERT INTO ticket_activities (
        ticket_id, activity_type, description, performed_by
      )
      VALUES (@ticketId, 'ATTACHMENT_ADDED', @description, @userId)`,
      {
        ticketId,
        description: `${files.length} file(s) attached`,
        userId
      }
    );

    logger.separator('UPLOAD SUCCESSFUL');
    logger.success('All files uploaded successfully', {
      count: uploadedFiles.length
    });
    logger.separator();

    return res.status(201).json(
      createResponse(
        true,
        `${uploadedFiles.length} file(s) uploaded successfully`,
        { attachments: uploadedFiles }
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

    // Get attachment info
    const query = `
      SELECT file_name, file_path
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
    const filePath = path.join(__dirname, '../uploads/tickets', attachment.file_path);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      logger.error('File not found on disk', { filePath });
      return res.status(404).json(
        createResponse(false, 'File not found on server')
      );
    }

    logger.success('Serving file download');

    // Send file
    res.download(filePath, attachment.file_name, (err) => {
      if (err) {
        logger.error('Download error', err);
        next(err);
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
    if (attachment.uploaded_by !== userId && !req.user.can_manage_system) {
      logger.warn('Unauthorized delete attempt');
      return res.status(403).json(
        createResponse(false, 'You do not have permission to delete this attachment')
      );
    }

    // Delete file from disk
    const filePath = path.join(__dirname, '../uploads/tickets', attachment.file_path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.success('File deleted from disk');
    }

    // Delete from database
    await executeQuery(
      'DELETE FROM ticket_attachments WHERE attachment_id = @attachmentId',
      { attachmentId }
    );

    // Log activity
    await executeQuery(
      `INSERT INTO ticket_activities (
        ticket_id, activity_type, description, performed_by
      )
      VALUES (@ticketId, 'ATTACHMENT_DELETED', @description, @userId)`,
      {
        ticketId,
        description: `Attachment deleted: ${attachment.file_name}`,
        userId
      }
    );

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

module.exports = {
  upload,
  uploadAttachments,
  getAttachments,
  downloadAttachment,
  deleteAttachment
};
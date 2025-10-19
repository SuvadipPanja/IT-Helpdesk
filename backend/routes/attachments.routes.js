// ============================================
// Attachments Routes
// ============================================

const express = require('express');
const router = express.Router();
const { 
  upload, 
  uploadAttachments,
  getAttachments,
  downloadAttachment,
  deleteAttachment
} = require('../controllers/attachmentsController');
const { authenticate } = require('../middleware/auth');  // ✅ FIXED

// All routes require authentication
router.use(authenticate);

// Upload attachments (max 5 files)
router.post(
  '/:id/attachments',
  upload.array('files', 5),
  uploadAttachments
);

// Get attachments
router.get('/:id/attachments', getAttachments);

// Download attachment
router.get('/:id/attachments/:attachmentId/download', downloadAttachment);

// Delete attachment
router.delete('/:id/attachments/:attachmentId', deleteAttachment);

module.exports = router;
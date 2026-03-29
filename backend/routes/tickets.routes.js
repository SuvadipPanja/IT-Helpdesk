// ============================================
// Tickets Routes - WITH STATS ENDPOINT
// ============================================
// Developer: Suvadip Panja
// Updated: February 2026 - Added /stats route for performance
// FILE: backend/routes/tickets.routes.js
// ============================================

const express = require('express');
const router = express.Router();
const {
  getTickets,
  getTicketStats,   // ⭐ NEW - Optimized stats endpoint
  reassignOpenTickets,
  getTicketById,
  createTicket,
  updateTicket,
  addComment,
  deleteTicket,
  assignTicket,
  closeTicket,
  reopenTicket,
  requestInfo,
  provideInfo
} = require('../controllers/tickets.controller');
const { bulkAction } = require('../controllers/tickets.bulk.controller');
const { authenticate, authorize, authorizeRoles } = require('../middleware/auth');
const { findSimilarTickets } = require('../services/duplicateDetection.service');

// ✅ Input validation
const { validateRequest } = require('../middleware/validateRequest');
const {
  createTicketValidator,
  updateTicketValidator,
  addCommentValidator,
  ticketQueryValidator,
} = require('../validators/tickets.validators');

// ============================================
// ⭐ ATTACHMENT HANDLING - Developer: Suvadip Panja
// Date: February 03, 2026
// ============================================
const {
  upload,
  uploadAttachments,
  getAttachments,
  downloadAttachment,
  deleteAttachment
} = require('../controllers/attachmentsController');

// All routes require authentication
router.use(authenticate);

// ============================================
// ⭐ STATS ROUTE - MUST BE BEFORE /:id
// ============================================
// This route MUST come before /:id otherwise Express
// will match "stats" as an :id parameter
// 
// Performance: Handles 1L+ tickets in < 150ms
// ============================================
router.get('/stats', getTicketStats);
router.post('/reassign-open', reassignOpenTickets);

// ⭐ BULK ACTIONS — Must be before /:id
router.post('/bulk', authorizeRoles(['ADMIN', 'IT_STAFF', 'ENGINEER', 'MANAGER']), bulkAction);

// ⭐ DUPLICATE CHECK — Must be before /:id
router.post('/check-duplicates', async (req, res) => {
  try {
    const { subject, description, category_id } = req.body;
    if (!subject?.trim()) {
      return res.status(400).json({ success: false, message: 'subject is required' });
    }
    const duplicates = await findSimilarTickets({
      subject,
      description: description || '',
      categoryId: category_id || null,
      requesterId: req.user?.user_id || null,
    });
    return res.status(200).json({ success: true, data: { duplicates } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Duplicate check failed' });
  }
});

// Ticket CRUD
router.get('/', ticketQueryValidator, validateRequest, getTickets);
router.get('/:id', getTicketById);
router.post('/', authorize('can_create_tickets'), createTicketValidator, validateRequest, createTicket);
router.put('/:id', updateTicketValidator, validateRequest, updateTicket);
router.delete('/:id', authorize('can_delete_tickets'), deleteTicket);

// ============================================
// ADD THIS NEW ROUTE - Assign ticket
// ============================================
router.patch('/:id/assign', authorize('can_assign_tickets'), assignTicket);

// Close ticket directly (assigned engineer / admin)
router.patch('/:id/close', authorize('can_close_tickets'), closeTicket);

// Reopen closed/resolved ticket (ticket creator or users with can_reopen_tickets)
router.patch('/:id/reopen', reopenTicket);

// Need More Details flag (engineer requests, requester provides)
router.post('/:id/request-info', requestInfo);
router.post('/:id/provide-info', provideInfo);

// Comments
router.post('/:id/comments', addCommentValidator, validateRequest, addComment);

// ============================================
// ⭐ ATTACHMENT ROUTES - Developer: Suvadip Panja
// Date: February 03, 2026
// ============================================
router.post('/:id/attachments', upload.array('files', 10), uploadAttachments); // Upload attachments (max 10 files)
router.get('/:id/attachments', getAttachments); // Get all attachments for a ticket
router.get('/:id/attachments/:attachmentId/download', downloadAttachment); // Download specific attachment
router.delete('/:id/attachments/:attachmentId', deleteAttachment); // Delete specific attachment

module.exports = router;
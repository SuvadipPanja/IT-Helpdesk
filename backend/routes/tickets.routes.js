// ============================================
// Tickets Routes
// ============================================

const express = require('express');
const router = express.Router();
const {
  getTickets,
  getTicketById,
  createTicket,
  updateTicket,
  addComment,
  deleteTicket,
  assignTicket  // ← ADD THIS
} = require('../controllers/tickets.controller');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Ticket CRUD
router.get('/', getTickets);
router.get('/:id', getTicketById);
router.post('/', createTicket);
router.put('/:id', updateTicket);
router.delete('/:id', deleteTicket);

// ============================================
// ADD THIS NEW ROUTE - Assign ticket
// ============================================
router.patch('/:id/assign', assignTicket);

// Comments
router.post('/:id/comments', addComment);

module.exports = router;
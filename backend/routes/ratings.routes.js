// ============================================
// Ratings Routes
// Developer: Suvadip Panja
// Created: March 2026
// FILE: backend/routes/ratings.routes.js
// ============================================

const express = require('express');
const router = express.Router();
const {
  submitRating,
  getTicketRating,
  getEngineerRatings,
  getRatingLeaderboard,
  getRatingAnalytics
} = require('../controllers/ratings.controller');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// ============================================
// ANALYTICS ROUTES (must be before :ticketId)
// ============================================
router.get('/analytics', getRatingAnalytics);       // Admin/Manager: Overall rating analytics
router.get('/leaderboard', getRatingLeaderboard);   // Admin/Manager: Engineer leaderboard

// ============================================
// ENGINEER RATINGS
// ============================================
router.get('/engineer/:engineerId', getEngineerRatings); // Engineer rating summary

// ============================================
// TICKET RATINGS
// ============================================
router.get('/:ticketId', getTicketRating);          // Get rating for a ticket
router.post('/:ticketId', submitRating);            // Submit rating for a ticket

module.exports = router;

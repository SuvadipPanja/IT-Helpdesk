// ============================================
// Auth Routes
// ============================================

const express = require('express');
const router = express.Router();
const {
  login,
  logout,
  getMe,
  changePassword
} = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');

// Public routes
router.post('/login', login);

// Protected routes
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);
router.put('/change-password', authenticate, changePassword);

module.exports = router;
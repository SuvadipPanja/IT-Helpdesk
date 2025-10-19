// ============================================
// PROFILE ROUTES
// All routes for user profile management
// ============================================

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const upload = require('../middleware/upload.middleware');
const {
  getProfile,
  updateProfile,
  uploadProfilePicture,
  deleteProfilePicture,
  changePassword,
  updatePreferences,
} = require('../controllers/profile.controller');

// ============================================
// ALL ROUTES REQUIRE AUTHENTICATION
// ============================================

// @route   GET /api/v1/profile
// @desc    Get current user's profile
// @access  Private
router.get('/', authenticate, getProfile);

// @route   PUT /api/v1/profile
// @desc    Update user profile information
// @access  Private
router.put('/', authenticate, updateProfile);

// @route   POST /api/v1/profile/picture
// @desc    Upload profile picture
// @access  Private
router.post('/picture', authenticate, upload.single('profile_picture'), uploadProfilePicture);

// @route   DELETE /api/v1/profile/picture
// @desc    Delete profile picture
// @access  Private
router.delete('/picture', authenticate, deleteProfilePicture);

// @route   PUT /api/v1/profile/password
// @desc    Change user password
// @access  Private
router.put('/password', authenticate, changePassword);

// @route   PUT /api/v1/profile/preferences
// @desc    Update user preferences
// @access  Private
router.put('/preferences', authenticate, updatePreferences);

// ============================================
// EXPORT ROUTER
// ============================================
module.exports = router;
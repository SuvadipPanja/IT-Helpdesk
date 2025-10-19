// ============================================
// PROFILE CONTROLLER
// Handles user profile operations
// FIXED: Added detailed logging and verification for password change
// ============================================

const bcrypt = require('bcryptjs');
const { executeQuery } = require('../config/database');
const { createResponse } = require('../utils/helpers');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');

// ============================================
// GET USER PROFILE
// Returns current user's profile information
// @route GET /api/v1/profile
// @access Private
// ============================================
const getProfile = async (req, res, next) => {
  try {
    const userId = req.user.user_id;

    logger.try('Fetching user profile', { userId });

    const query = `
      SELECT 
        u.user_id,
        u.username,
        u.email,
        u.first_name,
        u.last_name,
        u.phone_number,
        u.profile_picture,
        u.is_active,
        u.created_at,
        u.last_login,
        u.preferences,
        r.role_name,
        r.role_code,
        d.department_name
      FROM users u
      LEFT JOIN user_roles r ON u.role_id = r.role_id
      LEFT JOIN departments d ON u.department_id = d.department_id
      WHERE u.user_id = @userId
    `;

    const result = await executeQuery(query, { userId });

    if (result.recordset.length === 0) {
      return res.status(404).json(
        createResponse(false, 'User not found')
      );
    }

    const profile = result.recordset[0];

    // Parse preferences if exists
    if (profile.preferences) {
      try {
        profile.preferences = JSON.parse(profile.preferences);
      } catch (e) {
        profile.preferences = {};
      }
    } else {
      profile.preferences = {};
    }

    logger.success('Profile fetched successfully', { userId });

    return res.status(200).json(
      createResponse(true, 'Profile fetched successfully', profile)
    );
  } catch (error) {
    logger.error('Get profile error', error);
    next(error);
  }
};

// ============================================
// UPDATE USER PROFILE
// Update user's basic information
// @route PUT /api/v1/profile
// @access Private
// ============================================
const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const { first_name, last_name, email, phone_number } = req.body;

    logger.try('Updating user profile', { userId, email });

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !emailRegex.test(email)) {
      return res.status(400).json(
        createResponse(false, 'Invalid email format')
      );
    }

    // Check if email already exists (excluding current user)
    if (email) {
      const checkQuery = `
        SELECT user_id 
        FROM users 
        WHERE email = @email AND user_id != @userId
      `;
      const checkResult = await executeQuery(checkQuery, { email, userId });

      if (checkResult.recordset.length > 0) {
        return res.status(400).json(
          createResponse(false, 'Email already exists')
        );
      }
    }

    // Update profile
    const updateQuery = `
      UPDATE users
      SET 
        first_name = @first_name,
        last_name = @last_name,
        email = @email,
        phone_number = @phone_number,
        updated_at = GETDATE()
      WHERE user_id = @userId
    `;

    await executeQuery(updateQuery, {
      userId,
      first_name,
      last_name,
      email,
      phone_number,
    });

    logger.success('Profile updated successfully', { userId });

    return res.status(200).json(
      createResponse(true, 'Profile updated successfully')
    );
  } catch (error) {
    logger.error('Update profile error', error);
    next(error);
  }
};

// ============================================
// UPLOAD PROFILE PICTURE
// Upload and update user's profile picture
// @route POST /api/v1/profile/picture
// @access Private
// ============================================
const uploadProfilePicture = async (req, res, next) => {
  try {
    const userId = req.user.user_id;

    if (!req.file) {
      return res.status(400).json(
        createResponse(false, 'No file uploaded')
      );
    }

    logger.try('Uploading profile picture', { userId, filename: req.file.filename });
    console.log('📤 Uploading profile picture for user:', userId);
    console.log('📁 File details:', {
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    // Get old profile picture to delete it
    const getOldQuery = `
      SELECT profile_picture 
      FROM users 
      WHERE user_id = @userId
    `;
    const oldResult = await executeQuery(getOldQuery, { userId });
    const oldPicture = oldResult.recordset[0]?.profile_picture;

    // Delete old profile picture if exists
    if (oldPicture) {
      const oldPath = path.join(__dirname, '../uploads/profiles', path.basename(oldPicture));
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
        console.log('🗑️ Old profile picture deleted:', oldPicture);
        logger.info('Old profile picture deleted', { oldPicture });
      }
    }

    // Update database with new picture path
    const pictureUrl = `/uploads/profiles/${req.file.filename}`;
    const updateQuery = `
      UPDATE users
      SET profile_picture = @pictureUrl,
          updated_at = GETDATE()
      WHERE user_id = @userId
    `;

    await executeQuery(updateQuery, { userId, pictureUrl });

    console.log('✅ Profile picture saved to database:', pictureUrl);
    logger.success('Profile picture uploaded successfully', { userId, pictureUrl });

    return res.status(200).json(
      createResponse(true, 'Profile picture uploaded successfully', {
        profile_picture: pictureUrl,
      })
    );
  } catch (error) {
    console.error('❌ Upload profile picture error:', error);
    logger.error('Upload profile picture error', error);
    next(error);
  }
};

// ============================================
// DELETE PROFILE PICTURE
// Remove user's profile picture
// @route DELETE /api/v1/profile/picture
// @access Private
// ============================================
const deleteProfilePicture = async (req, res, next) => {
  try {
    const userId = req.user.user_id;

    logger.try('Deleting profile picture', { userId });

    // Get current profile picture
    const getQuery = `
      SELECT profile_picture 
      FROM users 
      WHERE user_id = @userId
    `;
    const result = await executeQuery(getQuery, { userId });
    const currentPicture = result.recordset[0]?.profile_picture;

    if (!currentPicture) {
      return res.status(404).json(
        createResponse(false, 'No profile picture to delete')
      );
    }

    // Delete file from filesystem
    const filePath = path.join(__dirname, '../uploads/profiles', path.basename(currentPicture));
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Update database
    const updateQuery = `
      UPDATE users
      SET profile_picture = NULL,
          updated_at = GETDATE()
      WHERE user_id = @userId
    `;

    await executeQuery(updateQuery, { userId });

    logger.success('Profile picture deleted successfully', { userId });

    return res.status(200).json(
      createResponse(true, 'Profile picture deleted successfully')
    );
  } catch (error) {
    logger.error('Delete profile picture error', error);
    next(error);
  }
};

// ============================================
// CHANGE PASSWORD
// Update user's password
// FIXED: Added detailed logging and verification
// @route PUT /api/v1/profile/password
// @access Private
// ============================================
const changePassword = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const { current_password, new_password, confirm_password } = req.body;

    logger.try('Changing password', { userId });
    console.log('🔐 Password change request for user:', userId);

    // Validation
    if (!current_password || !new_password || !confirm_password) {
      console.log('❌ Validation failed: Missing fields');
      return res.status(400).json(
        createResponse(false, 'All fields are required')
      );
    }

    if (new_password !== confirm_password) {
      console.log('❌ Validation failed: Passwords do not match');
      return res.status(400).json(
        createResponse(false, 'New passwords do not match')
      );
    }

    if (new_password.length < 6) {
      console.log('❌ Validation failed: Password too short');
      return res.status(400).json(
        createResponse(false, 'Password must be at least 6 characters long')
      );
    }

    // Get current password hash
    const getQuery = `
      SELECT password_hash 
      FROM users 
      WHERE user_id = @userId
    `;
    const result = await executeQuery(getQuery, { userId });
    
    if (result.recordset.length === 0) {
      console.log('❌ User not found');
      return res.status(404).json(
        createResponse(false, 'User not found')
      );
    }
    
    const currentHash = result.recordset[0].password_hash;
    console.log('📋 Current hash retrieved from database');

    // Verify current password
    console.log('🔍 Verifying current password...');
    const isMatch = await bcrypt.compare(current_password, currentHash);
    
    if (!isMatch) {
      console.log('❌ Current password is incorrect');
      return res.status(400).json(
        createResponse(false, 'Current password is incorrect')
      );
    }

    console.log('✅ Current password verified successfully');

    // Hash new password
    console.log('🔒 Hashing new password...');
    const newHash = await bcrypt.hash(new_password, 10);
    console.log('✅ New password hashed successfully');

    // Update password in database
    const updateQuery = `
      UPDATE users
      SET password_hash = @newHash,
          updated_at = GETDATE()
      WHERE user_id = @userId
    `;

    const updateResult = await executeQuery(updateQuery, { userId, newHash });

    // Verify the update was successful
    if (updateResult.rowsAffected[0] === 0) {
      console.log('❌ Password update failed - no rows affected');
      logger.error('Password update failed - no rows affected', { userId });
      return res.status(500).json(
        createResponse(false, 'Failed to update password')
      );
    }

    console.log('✅ Password hash updated in database');
    console.log('📊 Rows affected:', updateResult.rowsAffected[0]);

    // VERIFY: Read back the password hash to ensure it was saved
    console.log('🔍 Verifying password was saved correctly...');
    const verifyQuery = `
      SELECT password_hash 
      FROM users 
      WHERE user_id = @userId
    `;
    const verifyResult = await executeQuery(verifyQuery, { userId });
    const savedHash = verifyResult.recordset[0].password_hash;
    
    // Test if the new password works with the saved hash
    const newPasswordWorks = await bcrypt.compare(new_password, savedHash);
    console.log('🧪 Verification test - new password matches saved hash:', newPasswordWorks);

    if (!newPasswordWorks) {
      console.log('❌ CRITICAL: Password saved but verification failed!');
      logger.error('Password verification failed after update', { userId });
      return res.status(500).json(
        createResponse(false, 'Password update verification failed. Please try again.')
      );
    }

    console.log('✅ Password change completed successfully');
    logger.success('Password changed and verified successfully', { userId });

    return res.status(200).json(
      createResponse(true, 'Password changed successfully. Please login with your new password.')
    );
  } catch (error) {
    console.error('❌ Change password error:', error);
    logger.error('Change password error', error);
    next(error);
  }
};

// ============================================
// UPDATE PREFERENCES
// Update user's preferences (notifications, theme, etc.)
// @route PUT /api/v1/profile/preferences
// @access Private
// ============================================
const updatePreferences = async (req, res, next) => {
  try {
    const userId = req.user.user_id;
    const preferences = req.body;

    logger.try('Updating preferences', { userId });

    // Convert preferences object to JSON string
    const preferencesJson = JSON.stringify(preferences);

    const updateQuery = `
      UPDATE users
      SET preferences = @preferencesJson,
          updated_at = GETDATE()
      WHERE user_id = @userId
    `;

    await executeQuery(updateQuery, { userId, preferencesJson });

    logger.success('Preferences updated successfully', { userId });

    return res.status(200).json(
      createResponse(true, 'Preferences updated successfully', preferences)
    );
  } catch (error) {
    logger.error('Update preferences error', error);
    next(error);
  }
};

// ============================================
// EXPORT ALL FUNCTIONS
// ============================================
module.exports = {
  getProfile,
  updateProfile,
  uploadProfilePicture,
  deleteProfilePicture,
  changePassword,
  updatePreferences,
};

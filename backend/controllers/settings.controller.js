// ============================================
// SETTINGS CONTROLLER
// Handles all settings-related requests
// ============================================

const settingsService = require('../services/settings.service');
const logger = require('../utils/logger');

// ============================================
// GET PUBLIC SETTINGS
// Returns only public settings (no auth required)
// ============================================
const getPublicSettings = async (req, res) => {
  try {
    logger.try('Fetching public settings');

    const allSettings = await settingsService.getAll(true);
    
    const publicSettings = {};
    Object.keys(allSettings).forEach(key => {
      if (allSettings[key].is_public === 1 || allSettings[key].is_public === true) {
        publicSettings[key] = allSettings[key].value;
      }
    });

    logger.success('Public settings retrieved', { count: Object.keys(publicSettings).length });

    res.json({
      success: true,
      data: {
        settings: publicSettings
      }
    });
  } catch (error) {
    logger.error('Error fetching public settings', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch public settings',
      error: error.message
    });
  }
};

// ============================================
// GET ALL SETTINGS (GROUPED BY CATEGORY)
// Returns all settings organized by category
// ============================================
const getAllSettings = async (req, res) => {
  try {
    logger.try('Fetching all settings', { userId: req.user.user_id });

    // Check permission - USING can_manage_system
    if (!req.user.permissions?.can_manage_system) {
      logger.warn('Unauthorized settings access', { userId: req.user.user_id });
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view settings'
      });
    }

    const allSettings = await settingsService.getAll(true);
    
    // Group by category
    const groupedSettings = {};
    Object.keys(allSettings).forEach(key => {
      const setting = allSettings[key];
      const category = setting.category || 'general';
      
      if (!groupedSettings[category]) {
        groupedSettings[category] = {};
      }
      
      groupedSettings[category][key] = setting;
    });

    logger.success('All settings retrieved', { 
      totalSettings: Object.keys(allSettings).length,
      categories: Object.keys(groupedSettings).length,
      userId: req.user.user_id 
    });

    res.json({
      success: true,
      data: {
        settings: groupedSettings,
        totalSettings: Object.keys(allSettings).length
      }
    });
  } catch (error) {
    logger.error('Error fetching all settings', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch settings',
      error: error.message
    });
  }
};

// ============================================
// GET SETTINGS BY CATEGORY
// Returns all settings for specific category
// ============================================
const getSettingsByCategory = async (req, res) => {
  try {
    const { category } = req.params;

    logger.try('Fetching settings by category', { 
      category, 
      userId: req.user.user_id 
    });

    // Check permission - USING can_manage_system
    if (!req.user.permissions?.can_manage_system) {
      logger.warn('Unauthorized settings access', { userId: req.user.user_id });
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view settings'
      });
    }

    const categorySettings = await settingsService.getByCategory(category);

    logger.success('Category settings retrieved', { 
      category,
      count: Object.keys(categorySettings).length,
      userId: req.user.user_id 
    });

    res.json({
      success: true,
      data: {
        category,
        settings: categorySettings
      }
    });
  } catch (error) {
    logger.error('Error fetching category settings', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category settings',
      error: error.message
    });
  }
};

// ============================================
// GET SINGLE SETTING
// Returns one setting by key
// ============================================
const getSetting = async (req, res) => {
  try {
    const { key } = req.params;

    logger.try('Fetching single setting', { 
      key, 
      userId: req.user.user_id 
    });

    // Check permission - USING can_manage_system
    if (!req.user.permissions?.can_manage_system) {
      logger.warn('Unauthorized settings access', { userId: req.user.user_id });
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to view settings'
      });
    }

    const value = await settingsService.get(key);

    if (value === null) {
      return res.status(404).json({
        success: false,
        message: 'Setting not found'
      });
    }

    logger.success('Setting retrieved', { key, userId: req.user.user_id });

    res.json({
      success: true,
      data: {
        key,
        value
      }
    });
  } catch (error) {
    logger.error('Error fetching setting', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch setting',
      error: error.message
    });
  }
};

// ============================================
// UPDATE SINGLE SETTING
// Updates one setting value
// ============================================
const updateSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    logger.try('Updating setting', { 
      key, 
      value, 
      userId: req.user.user_id 
    });

    // Check permission - USING can_manage_system
    if (!req.user.permissions?.can_manage_system) {
      logger.warn('Unauthorized setting update', { userId: req.user.user_id });
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update settings'
      });
    }

    // Validate value provided
    if (value === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Value is required'
      });
    }

    await settingsService.set(key, value, req.user.user_id);

    logger.success('Setting updated', { key, userId: req.user.user_id });

    res.json({
      success: true,
      message: 'Setting updated successfully',
      data: {
        key,
        value
      }
    });
  } catch (error) {
    logger.error('Error updating setting', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update setting',
      error: error.message
    });
  }
};

// ============================================
// UPDATE MULTIPLE SETTINGS
// Bulk update settings
// ============================================
const updateMultipleSettings = async (req, res) => {
  try {
    const { settings } = req.body;

    logger.try('Updating multiple settings', { 
      count: settings ? Object.keys(settings).length : 0,
      userId: req.user.user_id 
    });

    // Check permission - USING can_manage_system
    if (!req.user.permissions?.can_manage_system) {
      logger.warn('Unauthorized bulk update', { userId: req.user.user_id });
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update settings'
      });
    }

    // Validate settings object
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Settings object is required'
      });
    }

    await settingsService.setMany(settings, req.user.user_id);

    logger.success('Multiple settings updated', { 
      count: Object.keys(settings).length,
      userId: req.user.user_id 
    });

    res.json({
      success: true,
      message: `${Object.keys(settings).length} settings updated successfully`,
      data: {
        updatedCount: Object.keys(settings).length
      }
    });
  } catch (error) {
    logger.error('Error updating multiple settings', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update settings',
      error: error.message
    });
  }
};

// ============================================
// TEST SMTP CONNECTION
// Tests SMTP server configuration
// ============================================
const testSmtpConnection = async (req, res) => {
  try {
    logger.try('Testing SMTP connection', { userId: req.user.user_id });

    // Check permission - USING can_manage_system
    if (!req.user.permissions?.can_manage_system) {
      logger.warn('Unauthorized SMTP test', { userId: req.user.user_id });
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to test SMTP settings'
      });
    }

    const emailService = require('../services/email.service');
    const result = await emailService.testConnection();

    logger.success('SMTP test completed', { 
      success: result.success,
      userId: req.user.user_id 
    });

    res.json(result);
  } catch (error) {
    logger.error('SMTP test error', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test SMTP connection',
      error: error.message
    });
  }
};

// ============================================
// SEND TEST EMAIL
// Sends test email to verify SMTP works
// ============================================
const sendTestEmail = async (req, res) => {
  try {
    const { email } = req.body;

    logger.try('Sending test email', { 
      email, 
      userId: req.user.user_id 
    });

    // Check permission - USING can_manage_system
    if (!req.user.permissions?.can_manage_system) {
      logger.warn('Unauthorized test email', { userId: req.user.user_id });
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to send test emails'
      });
    }

    // Validate email
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Valid email address is required'
      });
    }

    const emailService = require('../services/email.service');
    const result = await emailService.sendTestEmail(email);

    logger.success('Test email sent', { 
      success: result.success,
      email,
      userId: req.user.user_id 
    });

    res.json(result);
  } catch (error) {
    logger.error('Send test email error', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test email',
      error: error.message
    });
  }
};

// ============================================
// CLEAR SETTINGS CACHE
// Forces reload from database
// ============================================
const clearCache = async (req, res) => {
  try {
    logger.try('Clearing settings cache', { userId: req.user.user_id });

    // Check permission - USING can_manage_system
    if (!req.user.permissions?.can_manage_system) {
      logger.warn('Unauthorized cache clear', { userId: req.user.user_id });
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to clear cache'
      });
    }

    settingsService.clearCache();
    await settingsService.loadAllSettings();

    logger.success('Settings cache cleared', { userId: req.user.user_id });

    res.json({
      success: true,
      message: 'Settings cache cleared and reloaded successfully'
    });
  } catch (error) {
    logger.error('Clear cache error', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear cache',
      error: error.message
    });
  }
};

// ============================================
// EXPORT CONTROLLER FUNCTIONS
// ============================================
module.exports = {
  getPublicSettings,
  getAllSettings,
  getSettingsByCategory,
  getSetting,
  updateSetting,
  updateMultipleSettings,
  testSmtpConnection,
  sendTestEmail,
  clearCache
};
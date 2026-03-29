// ============================================
// SETTINGS CONTROLLER
// Handles all settings-related requests
// ============================================

const settingsService = require('../services/settings.service');
const logger = require('../utils/logger');
const { validateAppPublicUrlInput } = require('../utils/publicUrlCore');
const { executeQuery } = require('../config/database');
const { createBulkNotifications } = require('./notifications.controller');

const hasSettingPermission = (req, permission) =>
  Boolean(req.user?.permissions?.can_manage_system || req.user?.permissions?.[permission]);

// ============================================
// HELPER: Notify all active users about system events
// ============================================
const notifyAllUsers = async (type, title, message) => {
  try {
    const result = await executeQuery(
      'SELECT user_id FROM users WHERE is_active = 1'
    );
    const userIds = (result.recordset || []).map(r => r.user_id);
    if (userIds.length > 0) {
      await createBulkNotifications(userIds, type, title, message, null);
      logger.success('System notification sent to all users', { count: userIds.length, type });
    }
  } catch (err) {
    logger.error('Failed to send system notification to users', err);
  }
};

// ============================================
// GET PUBLIC SETTINGS
// Returns only public settings (no auth required)
// ============================================
const getPublicSettings = async (req, res) => {
  try {
    logger.try('Fetching public settings');

    const allSettings = await settingsService.getAll(true);
    
    // These keys are always included in public settings (needed for login branding, date/time, bot)
    const alwaysPublicKeys = ['timezone', 'date_format', 'time_format', 'bot_greeting', 'logo_url', 'system_name', 'system_title', 'company_name', 'app_public_url', 'maintenance_mode', 'maintenance_message'];
    
    const publicSettings = {};
    Object.keys(allSettings).forEach(key => {
      if (allSettings[key].is_public === 1 || allSettings[key].is_public === true || alwaysPublicKeys.includes(key)) {
        publicSettings[key] = allSettings[key].value;
      }
    });

    // Ensure timezone defaults exist even if not in DB
    if (!publicSettings.timezone) publicSettings.timezone = 'Asia/Kolkata';
    if (!publicSettings.date_format) publicSettings.date_format = 'DD/MM/YYYY';
    if (!publicSettings.time_format) publicSettings.time_format = '24';
    if (!publicSettings.bot_name) publicSettings.bot_name = 'NamoSathi AI';
    if (!Object.prototype.hasOwnProperty.call(publicSettings, 'bot_icon_url')) publicSettings.bot_icon_url = '';
    if (!publicSettings.bot_greeting) publicSettings.bot_greeting = 'Hello [UserName]! 👋 I\'m [BotName], your IT support assistant. How can I help you today?';

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

    const allSettings = await settingsService.getAll(true);

    // Exclude WhatsApp/Twilio settings — they are managed exclusively via the
    // dedicated /whatsapp/config API. Including them here caused the generic
    // "Save Changes" button to overwrite WhatsApp settings with stale values.
    const EXCLUDED_CATEGORIES = new Set(['whatsapp']);
    
    // Group by category
    const groupedSettings = {};
    Object.keys(allSettings).forEach(key => {
      const setting = allSettings[key];
      const category = setting.category || 'general';

      if (EXCLUDED_CATEGORIES.has(category)) return; // managed by dedicated API
      
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

    // Validate value provided
    if (value === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Value is required'
      });
    }

    let storedValue = value;
    if (key === 'app_public_url') {
      const v = validateAppPublicUrlInput(value);
      if (!v.ok) {
        return res.status(400).json({
          success: false,
          message: v.error || 'Invalid public site URL',
        });
      }
      storedValue = v.normalized;
      await settingsService.set(key, storedValue, req.user.user_id);
    } else {
      await settingsService.set(key, value, req.user.user_id);
    }

    // ============================================
    // TRIGGER NOTIFICATIONS FOR CRITICAL SETTINGS
    // ============================================
    if (key === 'announcement_enabled' && (value === 'true' || value === true)) {
      const announcementText = await settingsService.get('system_announcement');
      if (announcementText) {
        await notifyAllUsers('SYSTEM', 'ðŸ“¢ System Announcement', announcementText);
      }
    }
    
    if (key === 'maintenance_mode') {
      if (value === 'true' || value === true) {
        const maintMsg = await settingsService.get('maintenance_message') 
          || 'System is under maintenance. Please check back later.';
        await notifyAllUsers('SYSTEM', 'ðŸ”§ Maintenance Mode Activated', maintMsg);
      } else {
        await notifyAllUsers('SYSTEM', 'âœ… Maintenance Complete', 'System maintenance has ended. All services are now available.');
      }
    }

    logger.success('Setting updated', { key, userId: req.user.user_id });

    res.json({
      success: true,
      message: 'Setting updated successfully',
      data: {
        key,
        value: storedValue,
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

    // Validate settings object
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Settings object is required'
      });
    }

    if (Object.prototype.hasOwnProperty.call(settings, 'app_public_url')) {
      const v = validateAppPublicUrlInput(settings.app_public_url);
      if (!v.ok) {
        return res.status(400).json({
          success: false,
          message: v.error || 'Invalid public site URL',
        });
      }
      settings.app_public_url = v.normalized;
    }

    // Strip WhatsApp/Twilio keys — those are managed by the dedicated /whatsapp/config API.
    // This prevents the generic bulk-save from accidentally overwriting specialised settings.
    const PROTECTED_PREFIXES = ['whatsapp_', 'twilio_'];
    const safeSettings = {};
    Object.keys(settings).forEach(key => {
      if (PROTECTED_PREFIXES.some(prefix => key.startsWith(prefix))) return;
      safeSettings[key] = settings[key];
    });

    await settingsService.setMany(safeSettings, req.user.user_id);

    // ============================================
    // TRIGGER NOTIFICATIONS FOR CRITICAL BULK SETTINGS
    // ============================================
    if (settings.announcement_enabled === 'true' || settings.announcement_enabled === true) {
      const announcementText = settings.system_announcement 
        || await settingsService.get('system_announcement');
      if (announcementText) {
        await notifyAllUsers('SYSTEM', 'ðŸ“¢ System Announcement', announcementText);
      }
    }
    
    if (settings.maintenance_mode !== undefined) {
      const isOn = settings.maintenance_mode === 'true' || settings.maintenance_mode === true;
      if (isOn) {
        const maintMsg = settings.maintenance_message 
          || await settingsService.get('maintenance_message')
          || 'System is under maintenance. Please check back later.';
        await notifyAllUsers('SYSTEM', 'ðŸ”§ Maintenance Mode Activated', maintMsg);
      } else {
        await notifyAllUsers('SYSTEM', 'âœ… Maintenance Complete', 'System maintenance has ended. All services are now available.');
      }
    }

    logger.success('Multiple settings updated', { 
      count: Object.keys(safeSettings).length,
      userId: req.user.user_id 
    });

    res.json({
      success: true,
      message: `${Object.keys(safeSettings).length} settings updated successfully`,
      data: {
        updatedCount: Object.keys(safeSettings).length
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
// GET RATE LIMIT CONFIG
// Returns current runtime rate limit settings
// ============================================
const getRateLimitConfig = async (req, res) => {
  try {
    if (!hasSettingPermission(req, 'can_manage_settings_security')) {
      return res.status(403).json({ success: false, message: 'Permission denied' });
    }

    const { getCurrentConfig } = require('../middleware/rateLimiter');
    const config = getCurrentConfig();

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    logger.error('Error fetching rate limit config', error);
    res.status(500).json({ success: false, message: 'Failed to fetch rate limit config' });
  }
};

// ============================================
// UPLOAD LOGO
// Handles logo file upload and saves URL to settings
// ============================================
const uploadLogo = async (req, res) => {
  try {
    if (!hasSettingPermission(req, 'can_manage_settings_general')) {
      return res.status(403).json({ success: false, message: 'Permission denied' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Build the URL path for the uploaded logo
    const logoUrl = `/uploads/branding/${req.file.filename}`;

    // Upsert logo_url in system_settings
    const { executeQuery } = require('../config/database');
    await executeQuery(`
      MERGE system_settings AS target
      USING (SELECT 'logo_url' AS setting_key) AS source
      ON target.setting_key = source.setting_key
      WHEN MATCHED THEN
        UPDATE SET setting_value = @value, updated_by = @userId, updated_at = GETDATE()
      WHEN NOT MATCHED THEN
        INSERT (setting_key, setting_value, setting_category, setting_type, setting_description, is_public, updated_by, updated_at)
        VALUES ('logo_url', @value, 'appearance', 'string', 'System logo URL', 1, @userId, GETDATE());
    `, { value: logoUrl, userId: req.user.user_id });

    // Clear cache so new logo is available immediately
    settingsService.clearCache();

    logger.success('Logo uploaded successfully', {
      userId: req.user.user_id,
      filename: req.file.filename,
      logoUrl
    });

    res.json({
      success: true,
      message: 'Logo uploaded successfully',
      data: { logo_url: logoUrl }
    });
  } catch (error) {
    logger.error('Error uploading logo', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload logo',
      error: error.message
    });
  }
};

// ============================================
// DELETE LOGO (Reset to default)
// ============================================
const deleteLogo = async (req, res) => {
  try {
    if (!hasSettingPermission(req, 'can_manage_settings_general')) {
      return res.status(403).json({ success: false, message: 'Permission denied' });
    }

    const fs = require('fs');
    const path = require('path');

    // Get current logo URL from DB
    const { executeQuery } = require('../config/database');
    const result = await executeQuery(
      `SELECT setting_value FROM system_settings WHERE setting_key = 'logo_url'`
    );
    const currentLogo = result.recordset?.[0]?.setting_value;
    
    // Delete the file if it exists and is in branding folder
    if (currentLogo && currentLogo.includes('/uploads/branding/')) {
      const filePath = path.join(__dirname, '..', currentLogo);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.info('Logo file deleted', { filePath });
      }
    }

    // Reset setting to default
    await executeQuery(`
      MERGE system_settings AS target
      USING (SELECT 'logo_url' AS setting_key) AS source
      ON target.setting_key = source.setting_key
      WHEN MATCHED THEN
        UPDATE SET setting_value = '/logo.svg', updated_by = @userId, updated_at = GETDATE()
      WHEN NOT MATCHED THEN
        INSERT (setting_key, setting_value, setting_category, setting_type, setting_description, is_public, updated_by, updated_at)
        VALUES ('logo_url', '/logo.svg', 'appearance', 'string', 'System logo URL', 1, @userId, GETDATE());
    `, { userId: req.user.user_id });

    settingsService.clearCache();

    logger.success('Logo reset to default', { userId: req.user.user_id });

    res.json({
      success: true,
      message: 'Logo reset to default',
      data: { logo_url: '/logo.svg' }
    });
  } catch (error) {
    logger.error('Error deleting logo', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete logo',
      error: error.message
    });
  }
};

// ============================================
// RELOAD RATE LIMIT CONFIG
// Reloads rate limiter configuration from DB
// after admin changes settings
// ============================================
const reloadRateLimitConfig = async (req, res) => {
  try {
    if (!hasSettingPermission(req, 'can_manage_settings_security')) {
      return res.status(403).json({ success: false, message: 'Permission denied' });
    }

    const { loadConfigFromDB } = require('../middleware/rateLimiter');
    const newConfig = await loadConfigFromDB();

    logger.success('Rate limit config reloaded by admin', { 
      userId: req.user.user_id,
      username: req.user.username,
      config: newConfig
    });

    res.json({
      success: true,
      message: 'Rate limit configuration reloaded successfully',
      data: newConfig
    });
  } catch (error) {
    logger.error('Error reloading rate limit config', error);
    res.status(500).json({ success: false, message: 'Failed to reload rate limit config' });
  }
};

// ============================================
// GET BOT CONFIG
// ============================================
const getBotConfig = async (req, res) => {
  try {
    if (!hasSettingPermission(req, 'can_manage_settings_bot')) {
      return res.status(403).json({ success: false, message: 'Permission denied' });
    }

    const result = await executeQuery(`
      SELECT setting_key, setting_value
      FROM system_settings
      WHERE setting_key IN ('bot_name', 'bot_icon_url')
    `);

    const map = {};
    result.recordset.forEach((row) => {
      map[row.setting_key] = row.setting_value;
    });

    return res.json({
      success: true,
      data: {
        bot_name: map.bot_name || 'NamoSathi AI',
        bot_icon_url: map.bot_icon_url || ''
      }
    });
  } catch (error) {
    logger.error('Error fetching bot config', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch bot config', error: error.message });
  }
};

// ============================================
// UPDATE BOT CONFIG
// ============================================
const updateBotConfig = async (req, res) => {
  try {
    if (!hasSettingPermission(req, 'can_manage_settings_bot')) {
      return res.status(403).json({ success: false, message: 'Permission denied' });
    }

    const rawName = req.body?.bot_name;
    const botName = typeof rawName === 'string' ? rawName.trim() : '';

    if (!botName || botName.length < 2 || botName.length > 60) {
      return res.status(400).json({ success: false, message: 'Bot name must be between 2 and 60 characters' });
    }

    await executeQuery(`
      MERGE system_settings AS target
      USING (SELECT 'bot_name' AS setting_key) AS source
      ON target.setting_key = source.setting_key
      WHEN MATCHED THEN
        UPDATE SET setting_value = @value, updated_by = @userId, updated_at = GETDATE()
      WHEN NOT MATCHED THEN
        INSERT (setting_key, setting_value, setting_category, setting_type, setting_description, is_public, updated_by, updated_at)
        VALUES ('bot_name', @value, 'appearance', 'string', 'AI assistant display name', 1, @userId, GETDATE());
    `, { value: botName, userId: req.user.user_id });

    settingsService.clearCache();

    return res.json({
      success: true,
      message: 'Bot configuration updated successfully',
      data: { bot_name: botName }
    });
  } catch (error) {
    logger.error('Error updating bot config', error);
    return res.status(500).json({ success: false, message: 'Failed to update bot config', error: error.message });
  }
};

// ============================================
// UPLOAD BOT ICON
// ============================================
const uploadBotIcon = async (req, res) => {
  try {
    if (!hasSettingPermission(req, 'can_manage_settings_bot')) {
      return res.status(403).json({ success: false, message: 'Permission denied' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const iconUrl = `/uploads/branding/${req.file.filename}`;
    const current = await executeQuery(`SELECT setting_value FROM system_settings WHERE setting_key = 'bot_icon_url'`);
    const oldIcon = current.recordset?.[0]?.setting_value;

    await executeQuery(`
      MERGE system_settings AS target
      USING (SELECT 'bot_icon_url' AS setting_key) AS source
      ON target.setting_key = source.setting_key
      WHEN MATCHED THEN
        UPDATE SET setting_value = @value, updated_by = @userId, updated_at = GETDATE()
      WHEN NOT MATCHED THEN
        INSERT (setting_key, setting_value, setting_category, setting_type, setting_description, is_public, updated_by, updated_at)
        VALUES ('bot_icon_url', @value, 'appearance', 'string', 'AI assistant icon URL', 1, @userId, GETDATE());
    `, { value: iconUrl, userId: req.user.user_id });

    if (oldIcon && oldIcon.includes('/uploads/branding/') && oldIcon !== iconUrl) {
      try {
        const fs = require('fs');
        const path = require('path');
        const filePath = path.join(__dirname, '..', oldIcon);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (e) {
        logger.warn('Could not delete old bot icon file', { error: e.message });
      }
    }

    settingsService.clearCache();

    return res.json({
      success: true,
      message: 'Bot icon uploaded successfully',
      data: { bot_icon_url: iconUrl }
    });
  } catch (error) {
    logger.error('Error uploading bot icon', error);
    return res.status(500).json({ success: false, message: 'Failed to upload bot icon', error: error.message });
  }
};

// ============================================
// DELETE BOT ICON
// ============================================
const deleteBotIcon = async (req, res) => {
  try {
    if (!hasSettingPermission(req, 'can_manage_settings_bot')) {
      return res.status(403).json({ success: false, message: 'Permission denied' });
    }

    const result = await executeQuery(`SELECT setting_value FROM system_settings WHERE setting_key = 'bot_icon_url'`);
    const currentIcon = result.recordset?.[0]?.setting_value;

    if (currentIcon && currentIcon.includes('/uploads/branding/')) {
      try {
        const fs = require('fs');
        const path = require('path');
        const filePath = path.join(__dirname, '..', currentIcon);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (e) {
        logger.warn('Could not delete bot icon file', { error: e.message });
      }
    }

    await executeQuery(`
      MERGE system_settings AS target
      USING (SELECT 'bot_icon_url' AS setting_key) AS source
      ON target.setting_key = source.setting_key
      WHEN MATCHED THEN
        UPDATE SET setting_value = '', updated_by = @userId, updated_at = GETDATE()
      WHEN NOT MATCHED THEN
        INSERT (setting_key, setting_value, setting_category, setting_type, setting_description, is_public, updated_by, updated_at)
        VALUES ('bot_icon_url', '', 'appearance', 'string', 'AI assistant icon URL', 1, @userId, GETDATE());
    `, { userId: req.user.user_id });

    settingsService.clearCache();

    return res.json({
      success: true,
      message: 'Bot icon reset successfully',
      data: { bot_icon_url: '' }
    });
  } catch (error) {
    logger.error('Error deleting bot icon', error);
    return res.status(500).json({ success: false, message: 'Failed to delete bot icon', error: error.message });
  }
};

// ============================================
// GET FULL BOT CONFIGURATION
// Returns all bot settings for admin dashboard
// ============================================
const getFullBotConfig = async (req, res) => {
  try {
    if (!hasSettingPermission(req, 'can_manage_settings_bot')) {
      return res.status(403).json({ success: false, message: 'Permission denied' });
    }

    const result = await executeQuery(`
      SELECT setting_key, setting_value
      FROM system_settings
      WHERE setting_key IN (
        'bot_name', 'bot_icon_url', 'bot_greeting', 'bot_default_context',
        'bot_enable_intelligence', 'bot_personality_tone',
        'bot_empathy_enabled', 'bot_confidence_threshold', 'bot_ai_always_enhance'
      )
    `);

    const map = {};
    result.recordset.forEach((row) => {
      map[row.setting_key] = row.setting_value;
    });

    return res.json({
      success: true,
      data: {
        bot_name: map.bot_name || 'Nexus',
        bot_icon_url: map.bot_icon_url || '',
        bot_greeting: map.bot_greeting || 'Hello [UserName]! 👋 I\'m [BotName], your IT support assistant. How can I help you today?',
        bot_default_context: map.bot_default_context || 'I can work using your login context and fetch your own ticket updates from backend when needed.',
        bot_enable_intelligence: map.bot_enable_intelligence !== 'false' && map.bot_enable_intelligence !== '0',
        bot_personality_tone: map.bot_personality_tone || 'professional_friendly',
        bot_empathy_enabled: map.bot_empathy_enabled !== 'false' && map.bot_empathy_enabled !== '0',
        bot_confidence_threshold: parseFloat(map.bot_confidence_threshold) || 0.45,
        bot_ai_always_enhance: map.bot_ai_always_enhance === 'true' || map.bot_ai_always_enhance === '1'
      }
    });
  } catch (error) {
    logger.error('Error fetching full bot config', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch bot config', error: error.message });
  }
};

// ============================================
// UPDATE BOT GREETING MESSAGE
// Admin can customize greeting with placeholders
// ============================================
const updateBotGreeting = async (req, res) => {
  try {
    if (!hasSettingPermission(req, 'can_manage_settings_bot')) {
      return res.status(403).json({ success: false, message: 'Permission denied' });
    }

    const { greeting } = req.body;

    if (!greeting || greeting.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Greeting cannot be empty' });
    }

    if (greeting.length > 500) {
      return res.status(400).json({ success: false, message: 'Greeting must be less than 500 characters' });
    }

    await executeQuery(`
      MERGE system_settings AS target
      USING (SELECT 'bot_greeting' AS setting_key) AS source
      ON target.setting_key = source.setting_key
      WHEN MATCHED THEN
        UPDATE SET setting_value = @value, updated_by = @userId, updated_at = GETDATE()
      WHEN NOT MATCHED THEN
        INSERT (setting_key, setting_value, setting_category, setting_type, setting_description, is_public, updated_by, updated_at)
        VALUES ('bot_greeting', @value, 'bot', 'text', 'Bot greeting message with placeholders: [UserRole], [BotName], [UserName]', 1, @userId, GETDATE());
    `, { value: greeting, userId: req.user.user_id });

    settingsService.clearCache();

    logger.success('Bot greeting updated', { userId: req.user.user_id, length: greeting.length });

    return res.json({
      success: true,
      message: 'Bot greeting updated successfully',
      data: { bot_greeting: greeting }
    });
  } catch (error) {
    logger.error('Error updating bot greeting', error);
    return res.status(500).json({ success: false, message: 'Failed to update bot greeting', error: error.message });
  }
};

// ============================================
// UPDATE BOT DEFAULT CONTEXT
// Admin customizes what bot can do
// ============================================
const updateBotDefaultContext = async (req, res) => {
  try {
    if (!hasSettingPermission(req, 'can_manage_settings_bot')) {
      return res.status(403).json({ success: false, message: 'Permission denied' });
    }

    const { context } = req.body;

    if (!context || context.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Context cannot be empty' });
    }

    if (context.length > 1000) {
      return res.status(400).json({ success: false, message: 'Context must be less than 1000 characters' });
    }

    await executeQuery(`
      MERGE system_settings AS target
      USING (SELECT 'bot_default_context' AS setting_key) AS source
      ON target.setting_key = source.setting_key
      WHEN MATCHED THEN
        UPDATE SET setting_value = @value, updated_by = @userId, updated_at = GETDATE()
      WHEN NOT MATCHED THEN
        INSERT (setting_key, setting_value, setting_category, setting_type, setting_description, is_public, updated_by, updated_at)
        VALUES ('bot_default_context', @value, 'bot', 'text', 'Bot default context - what it can help with', 0, @userId, GETDATE());
    `, { value: context, userId: req.user.user_id });

    settingsService.clearCache();

    logger.success('Bot default context updated', { userId: req.user.user_id });

    return res.json({
      success: true,
      message: 'Bot context updated successfully',
      data: { bot_default_context: context }
    });
  } catch (error) {
    logger.error('Error updating bot context', error);
    return res.status(500).json({ success: false, message: 'Failed to update bot context', error: error.message });
  }
};

// ============================================
// UPDATE BOT INTELLIGENCE SETTINGS
// Admin enables/disables smart features
// ============================================
const updateBotIntelligence = async (req, res) => {
  try {
    if (!hasSettingPermission(req, 'can_manage_settings_bot')) {
      return res.status(403).json({ success: false, message: 'Permission denied' });
    }

    const { enable_intelligence, personality_tone, empathy_enabled, confidence_threshold, ai_always_enhance } = req.body;

    const validTones = ['professional_friendly', 'formal', 'casual', 'technical'];
    if (personality_tone && !validTones.includes(personality_tone)) {
      return res.status(400).json({
        success: false,
        message: `Personality tone must be one of: ${validTones.join(', ')}`
      });
    }

    if (confidence_threshold !== undefined) {
      const num = parseFloat(confidence_threshold);
      if (isNaN(num) || num < 0 || num > 1) {
        return res.status(400).json({ success: false, message: 'Confidence threshold must be between 0 and 1' });
      }
    }

    const updates = [];

    if (enable_intelligence !== undefined) {
      updates.push({
        key: 'bot_enable_intelligence',
        value: enable_intelligence ? 'true' : 'false'
      });
    }

    if (personality_tone) {
      updates.push({
        key: 'bot_personality_tone',
        value: personality_tone
      });
    }

    if (empathy_enabled !== undefined) {
      updates.push({
        key: 'bot_empathy_enabled',
        value: empathy_enabled ? 'true' : 'false'
      });
    }

    if (confidence_threshold !== undefined) {
      updates.push({
        key: 'bot_confidence_threshold',
        value: String(confidence_threshold)
      });
    }

    if (ai_always_enhance !== undefined) {
      updates.push({
        key: 'bot_ai_always_enhance',
        value: ai_always_enhance ? 'true' : 'false'
      });
    }

    for (const update of updates) {
      await executeQuery(`
        MERGE system_settings AS target
        USING (SELECT @key AS setting_key) AS source
        ON target.setting_key = source.setting_key
        WHEN MATCHED THEN
          UPDATE SET setting_value = @value, updated_by = @userId, updated_at = GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (setting_key, setting_value, setting_category, setting_type, setting_description, is_public, updated_by, updated_at)
          VALUES (@key, @value, 'bot', 'string', 'Bot intelligence settings', 0, @userId, GETDATE());
      `, { key: update.key, value: update.value, userId: req.user.user_id });
    }

    settingsService.clearCache();

    logger.success('Bot intelligence settings updated', { 
      userId: req.user.user_id,
      updatesCount: updates.length 
    });

    return res.json({
      success: true,
      message: 'Bot intelligence settings updated',
      data: {
        bot_enable_intelligence: enable_intelligence !== undefined ? enable_intelligence : null,
        bot_personality_tone: personality_tone || null
      }
    });
  } catch (error) {
    logger.error('Error updating bot intelligence', error);
    return res.status(500).json({ success: false, message: 'Failed to update bot intelligence', error: error.message });
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
  clearCache,
  getRateLimitConfig,
  reloadRateLimitConfig,
  uploadLogo,
  deleteLogo,
  getBotConfig,
  updateBotConfig,
  uploadBotIcon,
  deleteBotIcon,
  getFullBotConfig,
  updateBotGreeting,
  updateBotDefaultContext,
  updateBotIntelligence
};
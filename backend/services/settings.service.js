// ============================================
// SETTINGS SERVICE - CRITICAL FIX
// Centralized settings management with caching
// CRITICAL FIX: Boolean string 'false' handling
// ============================================

const { executeQuery } = require('../config/database');
const logger = require('../utils/logger');

// ============================================
// IN-MEMORY CACHE
// ============================================
let settingsCache = {};
let cacheLastUpdated = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ============================================
// CHECK IF CACHE IS STALE
// ============================================
const isCacheStale = () => {
  if (!cacheLastUpdated) return true;
  return (Date.now() - cacheLastUpdated) > CACHE_TTL;
};

// ============================================
// LOAD ALL SETTINGS FROM DATABASE
// ============================================
const loadAllSettings = async () => {
  try {
    logger.try('Loading all settings from database');

    const query = `
      SELECT 
        setting_key,
        setting_value,
        setting_category,
        setting_type,
        setting_description,
        is_public,
        updated_at
      FROM system_settings
      ORDER BY setting_category, setting_key
    `;

    const result = await executeQuery(query);
    const settings = result.recordset;

    settingsCache = {};

    settings.forEach((setting) => {
      const { setting_key, setting_value, setting_type, setting_category, setting_description, is_public } = setting;

      let convertedValue = setting_value;

      // Convert value based on type
      switch (setting_type) {
        case 'boolean':
          convertedValue = setting_value === 'true' || setting_value === '1' || setting_value === 1;
          break;
        case 'number':
          convertedValue = parseFloat(setting_value) || 0;
          break;
        case 'json':
          try {
            convertedValue = JSON.parse(setting_value);
          } catch (e) {
            logger.warn(`Failed to parse JSON for ${setting_key}`, { error: e.message });
            convertedValue = setting_value;
          }
          break;
        default:
          convertedValue = setting_value;
      }

      // Store in cache with metadata
      settingsCache[setting_key] = {
        value: convertedValue,
        type: setting_type,
        category: setting_category,
        description: setting_description,
        is_public: is_public
      };
    });

    cacheLastUpdated = Date.now();

    logger.success('Settings loaded into cache', {
      count: Object.keys(settingsCache).length,
      categories: [...new Set(settings.map(s => s.setting_category))].length
    });

    return settingsCache;
  } catch (error) {
    logger.error('Error loading settings', error);
    throw error;
  }
};

// ============================================
// GET SINGLE SETTING
// ============================================
const get = async (key, forceRefresh = false) => {
  try {
    if (forceRefresh || isCacheStale() || Object.keys(settingsCache).length === 0) {
      await loadAllSettings();
    }

    return settingsCache[key] ? settingsCache[key].value : null;
  } catch (error) {
    logger.error('Error getting setting', { key, error });
    return null;
  }
};

// ============================================
// GET MULTIPLE SETTINGS BY KEYS
// ============================================
const getMany = async (keys, forceRefresh = false) => {
  try {
    if (forceRefresh || isCacheStale() || Object.keys(settingsCache).length === 0) {
      await loadAllSettings();
    }

    const result = {};
    keys.forEach((key) => {
      if (settingsCache[key]) {
        result[key] = settingsCache[key].value;
      } else {
        result[key] = null;
      }
    });

    return result;
  } catch (error) {
    logger.error('Error getting multiple settings', { keys, error });
    return {};
  }
};

// ============================================
// GET ALL SETTINGS BY CATEGORY (VALUES ONLY)
// ============================================
const getByCategory = async (category, forceRefresh = false) => {
  try {
    if (forceRefresh || isCacheStale() || Object.keys(settingsCache).length === 0) {
      await loadAllSettings();
    }

    const result = {};
    Object.keys(settingsCache).forEach((key) => {
      if (settingsCache[key].category === category) {
        result[key] = settingsCache[key].value;
      }
    });

    return result;
  } catch (error) {
    logger.error('Error getting settings by category', { category, error });
    return {};
  }
};

// ============================================
// GET SETTINGS BY CATEGORY (WITH METADATA)
// Used by email service - returns just values
// ============================================
const getSettingsByCategory = async (category, forceRefresh = false) => {
  try {
    if (forceRefresh || isCacheStale() || Object.keys(settingsCache).length === 0) {
      await loadAllSettings();
    }

    const result = {};
    Object.keys(settingsCache).forEach((key) => {
      if (settingsCache[key].category === category) {
        // Return just the value for email service
        result[key] = settingsCache[key].value;
      }
    });

    return result;
  } catch (error) {
    logger.error('Error getting settings by category', { category, error });
    return {};
  }
};

// ============================================
// GET ALL SETTINGS
// ============================================
const getAll = async (includeMetadata = false, forceRefresh = false) => {
  try {
    if (forceRefresh || isCacheStale() || Object.keys(settingsCache).length === 0) {
      await loadAllSettings();
    }

    if (includeMetadata) {
      return settingsCache;
    }

    const result = {};
    Object.keys(settingsCache).forEach((key) => {
      result[key] = settingsCache[key].value;
    });

    return result;
  } catch (error) {
    logger.error('Error getting all settings', error);
    return {};
  }
};

// ============================================
// SET/UPDATE SINGLE SETTING
// ✅ CRITICAL FIX: Proper boolean string handling
// ============================================
const set = async (key, value, userId = null) => {
  try {
    logger.try('Updating setting', { 
      key, 
      value: typeof value === 'string' && value.length > 50 ? value.substring(0, 50) + '...' : value,
      valueType: typeof value,
      userId 
    });

    // Get setting type from cache or database
    let settingType = 'string';
    if (settingsCache[key]) {
      settingType = settingsCache[key].type;
    } else {
      const checkQuery = `
        SELECT setting_type FROM system_settings WHERE setting_key = @key
      `;
      const checkResult = await executeQuery(checkQuery, { key });
      if (checkResult.recordset.length > 0) {
        settingType = checkResult.recordset[0].setting_type;
      }
    }

    // ✅ CRITICAL FIX: Convert value to string for storage
    let storedValue = value;
    switch (settingType) {
      case 'boolean':
        // ✅ FIX: Explicitly check for falsy values first
        // This prevents string 'false' from being treated as truthy
        if (value === 'false' || value === false || value === 0 || value === '0' || value === null) {
          storedValue = 'false';
        } else if (value === 'true' || value === true || value === 1 || value === '1') {
          storedValue = 'true';
        } else {
          // Fallback for unexpected values
          storedValue = value ? 'true' : 'false';
        }
        logger.try('Boolean conversion', { 
          key, 
          inputValue: value, 
          inputType: typeof value, 
          storedValue 
        });
        break;
      case 'number':
        storedValue = String(value);
        break;
      case 'json':
        storedValue = JSON.stringify(value);
        break;
      default:
        storedValue = String(value);
    }

    // Update in database
    const updateQuery = `
      UPDATE system_settings
      SET 
        setting_value = @value,
        updated_by = @userId,
        updated_at = GETDATE()
      WHERE setting_key = @key
    `;

    const result = await executeQuery(updateQuery, {
      key,
      value: storedValue,
      userId,
    });

    if (result.rowsAffected[0] === 0) {
      logger.warn('Setting not found in database', { key });
      return false;
    }

    // Reload cache to ensure consistency
    await loadAllSettings();

    logger.success('Setting updated successfully', { 
      key, 
      storedValue,
      rowsAffected: result.rowsAffected[0]
    });

    return true;
  } catch (error) {
    logger.error('Error setting value', { key, error });
    throw error;
  }
};

// ============================================
// SET MULTIPLE SETTINGS AT ONCE
// ============================================
const setMany = async (settings, userId = null) => {
  try {
    logger.try('Updating multiple settings', {
      count: Object.keys(settings).length,
      settingKeys: Object.keys(settings),
      userId,
    });

    // Update each setting
    const updatePromises = Object.keys(settings).map((key) =>
      set(key, settings[key], userId)
    );

    const results = await Promise.all(updatePromises);
    
    const successCount = results.filter(r => r === true).length;

    logger.success('Multiple settings updated successfully', {
      total: Object.keys(settings).length,
      successful: successCount,
      failed: Object.keys(settings).length - successCount
    });

    return true;
  } catch (error) {
    logger.error('Error setting multiple values', error);
    throw error;
  }
};

// ============================================
// CLEAR CACHE
// ============================================
const clearCache = () => {
  settingsCache = {};
  cacheLastUpdated = null;
  logger.info('Settings cache cleared');
};

// ============================================
// GET CACHE STATUS
// ============================================
const getCacheStatus = () => {
  return {
    totalSettings: Object.keys(settingsCache).length,
    lastUpdated: cacheLastUpdated,
    isStale: isCacheStale(),
    ttl: CACHE_TTL,
  };
};

// ============================================
// INITIALIZE SETTINGS
// ============================================
const initialize = async () => {
  try {
    logger.info('Initializing settings service');
    await loadAllSettings();
    logger.success('Settings service initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize settings service', error);
  }
};

// ============================================
// EXPORT SERVICE METHODS
// ============================================
module.exports = {
  get,
  getMany,
  getByCategory,
  getAll,
  set,
  setMany,
  clearCache,
  getCacheStatus,
  initialize,
  loadAllSettings,
  getSettingsByCategory
};
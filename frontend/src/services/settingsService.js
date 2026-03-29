// ============================================
// SETTINGS SERVICE - PRODUCTION GRADE
// Handles all settings API calls and caching
// ============================================

import api from './api';

// Cache configuration
const CACHE_KEY = 'app_settings_cache';
const CACHE_TIMESTAMP_KEY = 'app_settings_cache_timestamp';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

class SettingsService {
  constructor() {
    this.cache = null;
    this.cacheTimestamp = null;
    this.fetchPromise = null;
    this.loadCacheFromStorage();
  }

  // ============================================
  // LOAD CACHE FROM LOCAL STORAGE
  // ============================================
  loadCacheFromStorage() {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
      
      if (cached && timestamp) {
        const age = Date.now() - parseInt(timestamp, 10);
        
        if (age < CACHE_DURATION) {
          this.cache = JSON.parse(cached);
          this.cacheTimestamp = parseInt(timestamp, 10);
          if (process.env.NODE_ENV === 'development') console.log('✅ Settings loaded from localStorage cache');
        } else {
          this.clearCache();
          if (process.env.NODE_ENV === 'development') console.log('⏰ Cache expired, cleared');
        }
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.error('❌ Failed to load cache from storage:', err);
      this.clearCache();
    }
  }

  // ============================================
  // SAVE CACHE TO LOCAL STORAGE
  // ============================================
  saveCacheToStorage(data) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
      this.cache = data;
      this.cacheTimestamp = Date.now();
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.error('❌ Failed to save cache to storage:', err);
    }
  }

  // ============================================
  // GET FROM CACHE
  // ============================================
  getFromCache() {
    const now = Date.now();
    
    if (this.cache && this.cacheTimestamp && (now - this.cacheTimestamp < CACHE_DURATION)) {
      return this.cache;
    }
    
    return null;
  }

  // ============================================
  // FETCH SETTINGS FROM API
  // ============================================
  async fetchSettings(forceRefresh = false) {
    // Return cache if valid
    if (!forceRefresh) {
      const cached = this.getFromCache();
      if (cached) {
        return cached;
      }
    }

    // Return existing fetch promise if already fetching
    if (this.fetchPromise && !forceRefresh) {
      return this.fetchPromise;
    }

    // Create new fetch promise
    this.fetchPromise = api.get('/settings')
      .then(response => {
        if (response.data.success) {
          const settings = response.data.data.settings;
          this.saveCacheToStorage(settings);
          return settings;
        }
        throw new Error('Failed to fetch settings');
      })
      .catch(error => {
        if (process.env.NODE_ENV === 'development') console.error('❌ Settings API error:', error);
        // Return cached data as fallback
        const cached = this.cache;
        if (cached) {
          if (process.env.NODE_ENV === 'development') console.log('⚠️ API failed, using cached settings');
          return cached;
        }
        throw error;
      })
      .finally(() => {
        this.fetchPromise = null;
      });

    return this.fetchPromise;
  }

  // ============================================
  // UPDATE SINGLE SETTING
  // ============================================
  async updateSetting(key, value) {
    try {
      const response = await api.put(`/settings/${key}`, { value });
      
      if (response.data.success) {
        // Update cache
        if (this.cache) {
          for (const category in this.cache) {
            if (this.cache[category][key]) {
              this.cache[category][key].value = value;
              this.saveCacheToStorage(this.cache);
              break;
            }
          }
        }
        
        return response.data;
      }
      
      throw new Error(response.data.message || 'Failed to update setting');
    } catch (error) {
      if (process.env.NODE_ENV === 'development') console.error('❌ Failed to update setting:', error);
      throw error;
    }
  }

  // ============================================
  // UPDATE MULTIPLE SETTINGS (BULK)
  // ============================================
  async updateBulkSettings(settings) {
    try {
      const response = await api.put('/settings/bulk', { settings });
      
      if (response.data.success) {
        // Clear cache to force refresh
        this.clearCache();
        return response.data;
      }
      
      throw new Error(response.data.message || 'Failed to update settings');
    } catch (error) {
      if (process.env.NODE_ENV === 'development') console.error('❌ Failed to bulk update settings:', error);
      throw error;
    }
  }

  // ============================================
  // CLEAR CACHE
  // ============================================
  clearCache() {
    this.cache = null;
    this.cacheTimestamp = null;
    this.fetchPromise = null;
    
    try {
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(CACHE_TIMESTAMP_KEY);
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.error('❌ Failed to clear cache from storage:', err);
    }
  }

  // ============================================
  // GET SETTING VALUE (STATIC METHOD)
  // ============================================
  getSettingValue(key, defaultValue = null) {
    if (!this.cache) return defaultValue;

    for (const category in this.cache) {
      if (this.cache[category] && this.cache[category][key]) {
        return this.cache[category][key].value;
      }
    }

    return defaultValue;
  }
}

// Export singleton instance
const settingsService = new SettingsService();
export default settingsService;
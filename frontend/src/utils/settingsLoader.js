// ============================================
// SETTINGS LOADER
// Loads public settings WITHOUT authentication
// ============================================

import api from '../services/api';

class SettingsLoader {
  constructor() {
    this.loaded = false;
    this.loading = false;
    this.loadPromise = null;
  }

  async loadSettings() {
    if (this.loaded && window.APP_SETTINGS) {
      console.log('✅ Settings already loaded');
      return window.APP_SETTINGS;
    }

    if (this.loading && this.loadPromise) {
      console.log('⏳ Settings loading in progress...');
      return this.loadPromise;
    }

    this.loading = true;
    console.log('🔄 Loading public settings...');

    this.loadPromise = api.get('/settings/public')
      .then(response => {
        if (response.data.success) {
          const settings = response.data.data.settings;
          window.APP_SETTINGS = settings;
          this.loaded = true;
          console.log('✅ Public settings loaded:', settings);
          return settings;
        }
        throw new Error('Failed to load settings');
      })
      .catch(error => {
        console.error('❌ Settings load failed:', error);
        window.APP_SETTINGS = {
          system_name: 'Nexus Support',
          system_title: 'IT Service Desk',
          company_name: 'Your Company',
          maintenance_mode: 'false',
          maintenance_message: 'System under maintenance'
        };
        console.log('⚠️ Using default settings');
        return window.APP_SETTINGS;
      })
      .finally(() => {
        this.loading = false;
        this.loadPromise = null;
      });

    return this.loadPromise;
  }

  getSetting(key, defaultValue = null) {
    return window.APP_SETTINGS?.[key] || defaultValue;
  }

  async refreshSettings() {
    this.loaded = false;
    return this.loadSettings();
  }

  clearSettings() {
    window.APP_SETTINGS = null;
    this.loaded = false;
    this.loading = false;
    this.loadPromise = null;
    console.log('🗑️ Settings cleared');
  }
}

const settingsLoader = new SettingsLoader();
export default settingsLoader;

export const getSetting = (key, defaultValue = null) => {
  return settingsLoader.getSetting(key, defaultValue);
};
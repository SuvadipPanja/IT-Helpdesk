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
      if (process.env.NODE_ENV === 'development') console.log('✅ Settings already loaded');
      return window.APP_SETTINGS;
    }

    if (this.loading && this.loadPromise) {
      if (process.env.NODE_ENV === 'development') console.log('⏳ Settings loading in progress...');
      return this.loadPromise;
    }

    this.loading = true;
    if (process.env.NODE_ENV === 'development') console.log('🔄 Loading public settings...');

    this.loadPromise = api.get('/settings/public')
      .then(response => {
        if (response.data?.success && response.data?.data?.settings) {
          const settings = response.data.data.settings;
          window.APP_SETTINGS = settings;
          this.loaded = true;
          if (process.env.NODE_ENV === 'development') console.log('✅ Public settings loaded:', settings);
          return settings;
        }
        throw new Error('Failed to load settings');
      })
      .catch(error => {
        if (process.env.NODE_ENV === 'development') console.error('❌ Settings load failed:', error);
        window.APP_SETTINGS = {
          system_name: 'Nexus Support',
          system_title: 'IT Service Desk',
          company_name: 'Your Company',
          favicon_url: '/vite.svg',
          logo_url: '/logo.svg',
          bot_name: 'NamoSathi AI',
          bot_icon_url: '',
          bot_greeting: '',
          theme_default_mode: 'dark',
          theme_primary_color: '#6366f1',
          maintenance_mode: 'false',
          maintenance_message: 'System under maintenance',
          timezone: 'Asia/Kolkata',
          date_format: 'DD/MM/YYYY',
          time_format: '24'
        };
        if (process.env.NODE_ENV === 'development') console.log('⚠️ Using default settings');
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
    const settings = await this.loadSettings();
    // Dispatch event so components (Sidebar logo, etc.) can re-render
    window.dispatchEvent(new CustomEvent('settings-updated', { detail: settings }));
    return settings;
  }

  clearSettings() {
    window.APP_SETTINGS = null;
    this.loaded = false;
    this.loading = false;
    this.loadPromise = null;
    if (process.env.NODE_ENV === 'development') console.log('🗑️ Settings cleared');
  }
}

const settingsLoader = new SettingsLoader();
export default settingsLoader;

export const getSetting = (key, defaultValue = null) => {
  const value = settingsLoader.getSetting(key, defaultValue);
  if (process.env.NODE_ENV === 'development' && !value) {
    if (process.env.NODE_ENV === 'development') console.warn(`⚠️ Setting '${key}' not found, using default: ${defaultValue}`);
  }
  return value;
};
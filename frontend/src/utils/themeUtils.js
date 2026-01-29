// ============================================
// THEME UTILITIES - COLOR MANIPULATION
// Utility functions for dynamic theme colors
// ============================================
// Developer: Suvadip Panja
// Company: Digitide
// Created: January 29, 2026
// File: frontend/src/utils/themeUtils.js
// ============================================

// ============================================
// HEX TO RGB CONVERSION
// Convert hex color to RGB object
// ============================================
export const hexToRgb = (hex) => {
  // Remove # if present
  const cleanHex = hex.replace('#', '');
  
  // Handle shorthand hex (e.g., #fff)
  const fullHex = cleanHex.length === 3
    ? cleanHex.split('').map(c => c + c).join('')
    : cleanHex;
  
  const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
  
  if (!result) {
    console.warn('Invalid hex color:', hex);
    return { r: 99, g: 102, b: 241 }; // Default to primary color
  }
  
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  };
};

// ============================================
// RGB TO HEX CONVERSION
// Convert RGB values to hex color
// ============================================
export const rgbToHex = (r, g, b) => {
  const toHex = (c) => {
    const hex = Math.max(0, Math.min(255, Math.round(c))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

// ============================================
// LIGHTEN COLOR
// Make a color lighter by percentage
// ============================================
export const lightenColor = (hex, percent) => {
  const { r, g, b } = hexToRgb(hex);
  
  const newR = r + (255 - r) * (percent / 100);
  const newG = g + (255 - g) * (percent / 100);
  const newB = b + (255 - b) * (percent / 100);
  
  return rgbToHex(newR, newG, newB);
};

// ============================================
// DARKEN COLOR
// Make a color darker by percentage
// ============================================
export const darkenColor = (hex, percent) => {
  const { r, g, b } = hexToRgb(hex);
  
  const newR = r * (1 - percent / 100);
  const newG = g * (1 - percent / 100);
  const newB = b * (1 - percent / 100);
  
  return rgbToHex(newR, newG, newB);
};

// ============================================
// GENERATE COLOR VARIATIONS
// Create all color variations from primary color
// ============================================
export const generateColorVariations = (primaryColor) => {
  const rgb = hexToRgb(primaryColor);
  
  return {
    primary: primaryColor,
    primaryRgb: `${rgb.r}, ${rgb.g}, ${rgb.b}`,
    primaryHover: darkenColor(primaryColor, 10),
    primaryLight: lightenColor(primaryColor, 85),
    primaryLighter: lightenColor(primaryColor, 92),
    primaryDark: darkenColor(primaryColor, 20),
    primaryDarker: darkenColor(primaryColor, 30),
    // For gradients
    primaryGradientStart: primaryColor,
    primaryGradientEnd: darkenColor(primaryColor, 15),
  };
};

// ============================================
// CHECK IF COLOR IS LIGHT OR DARK
// Used for determining text contrast
// ============================================
export const isLightColor = (hex) => {
  const { r, g, b } = hexToRgb(hex);
  
  // Calculate relative luminance
  // Formula: https://www.w3.org/TR/WCAG20/#relativeluminancedef
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  return luminance > 0.5;
};

// ============================================
// GET CONTRAST COLOR
// Return black or white based on background
// ============================================
export const getContrastColor = (hex) => {
  return isLightColor(hex) ? '#000000' : '#ffffff';
};

// ============================================
// SANITIZE CSS
// Remove potentially dangerous CSS patterns
// Security measure for custom CSS injection
// ============================================
export const sanitizeCss = (css) => {
  if (!css || typeof css !== 'string') return '';
  
  // Maximum allowed size (50KB)
  const MAX_SIZE = 50000;
  
  // Dangerous patterns to remove
  const dangerousPatterns = [
    /javascript\s*:/gi,
    /expression\s*\(/gi,
    /behavior\s*:/gi,
    /-moz-binding/gi,
    /@import/gi,
    /<script/gi,
    /<\/script/gi,
    /onclick/gi,
    /onerror/gi,
    /onload/gi,
    /onmouseover/gi,
    /onmouseout/gi,
    /onfocus/gi,
    /onblur/gi,
    /eval\s*\(/gi,
    /url\s*\(\s*["']?\s*data:/gi,
  ];
  
  let sanitized = css;
  
  // Remove dangerous patterns
  dangerousPatterns.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '/* [blocked] */');
  });
  
  // Limit size
  if (sanitized.length > MAX_SIZE) {
    sanitized = sanitized.substring(0, MAX_SIZE);
    console.warn('Custom CSS truncated to', MAX_SIZE, 'characters');
  }
  
  return sanitized;
};

// ============================================
// VALIDATE COLOR
// Check if a string is a valid hex color
// ============================================
export const isValidHexColor = (color) => {
  if (!color || typeof color !== 'string') return false;
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
};

// ============================================
// VALIDATE URL
// Check if a string is a valid URL
// ============================================
export const isValidUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// ============================================
// PRELOAD IMAGE
// Preload an image and check if it's valid
// ============================================
export const preloadImage = (url) => {
  return new Promise((resolve, reject) => {
    if (!isValidUrl(url)) {
      reject(new Error('Invalid URL'));
      return;
    }
    
    const img = new Image();
    img.onload = () => resolve(url);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = url;
  });
};

// ============================================
// GET THEME FROM SYSTEM PREFERENCE
// Detect OS dark mode preference
// ============================================
export const getSystemThemePreference = () => {
  if (typeof window === 'undefined') return 'light';
  
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  
  return 'light';
};

// ============================================
// LOCAL STORAGE HELPERS
// Safe localStorage operations with fallback
// ============================================
const STORAGE_PREFIX = 'nexus_';

export const storage = {
  // Get item from localStorage
  get: (key, defaultValue = null) => {
    try {
      const item = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
      if (item === null) return defaultValue;
      return JSON.parse(item);
    } catch (error) {
      console.warn('Failed to read from localStorage:', error);
      return defaultValue;
    }
  },
  
  // Set item in localStorage
  set: (key, value) => {
    try {
      localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn('Failed to write to localStorage:', error);
      return false;
    }
  },
  
  // Remove item from localStorage
  remove: (key) => {
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
      return true;
    } catch (error) {
      console.warn('Failed to remove from localStorage:', error);
      return false;
    }
  },
  
  // Clear all nexus items from localStorage
  clearAll: () => {
    try {
      Object.keys(localStorage)
        .filter(key => key.startsWith(STORAGE_PREFIX))
        .forEach(key => localStorage.removeItem(key));
      return true;
    } catch (error) {
      console.warn('Failed to clear localStorage:', error);
      return false;
    }
  }
};

// ============================================
// STORAGE KEYS
// Centralized storage key definitions
// ============================================
export const STORAGE_KEYS = {
  USER_THEME: 'user_theme',
  THEME_TIMESTAMP: 'theme_timestamp',
  SETTINGS_CACHE: 'settings_cache',
  SETTINGS_TIMESTAMP: 'settings_timestamp',
};

// ============================================
// DEFAULT THEME VALUES
// Fallback values if settings not loaded
// ============================================
export const DEFAULT_THEME = {
  primaryColor: '#6366f1',
  themeMode: 'light',
  logoUrl: '',
  faviconUrl: '',
  customCss: '',
};

// ============================================
// CSS VARIABLE NAMES
// Mapping of setting keys to CSS variable names
// ============================================
export const CSS_VARIABLES = {
  primary: '--primary-color',
  primaryRgb: '--primary-rgb',
  primaryHover: '--primary-hover',
  primaryLight: '--primary-light',
  primaryLighter: '--primary-lighter',
  primaryDark: '--primary-dark',
  primaryDarker: '--primary-darker',
};

// ============================================
// APPLY CSS VARIABLES TO DOCUMENT
// Update CSS variables on :root element
// ============================================
export const applyCssVariables = (variables) => {
  const root = document.documentElement;
  
  Object.entries(variables).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      root.style.setProperty(key, value);
    }
  });
};

// ============================================
// UPDATE FAVICON
// Dynamically change browser favicon
// ============================================
export const updateFavicon = (url) => {
  // Default favicon path
  const defaultFavicon = '/favicon.ico';
  const faviconUrl = url && isValidUrl(url) ? url : defaultFavicon;
  
  // Remove existing favicon links
  const existingLinks = document.querySelectorAll("link[rel*='icon']");
  existingLinks.forEach(link => link.remove());
  
  // Create new favicon link
  const link = document.createElement('link');
  link.rel = 'icon';
  link.type = faviconUrl.endsWith('.ico') ? 'image/x-icon' : 'image/png';
  link.href = faviconUrl;
  
  // Add error handler to fall back to default
  link.onerror = () => {
    if (faviconUrl !== defaultFavicon) {
      link.href = defaultFavicon;
    }
  };
  
  // Add to document head
  document.head.appendChild(link);
};

// ============================================
// INJECT CUSTOM CSS
// Add custom CSS to document
// ============================================
export const injectCustomCss = (css) => {
  const STYLE_ID = 'nexus-custom-css';
  
  // Get or create style element
  let styleEl = document.getElementById(STYLE_ID);
  
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.type = 'text/css';
    document.head.appendChild(styleEl);
  }
  
  // Sanitize and inject CSS
  const sanitizedCss = sanitizeCss(css);
  styleEl.textContent = sanitizedCss;
};

// ============================================
// REMOVE CUSTOM CSS
// Remove injected custom CSS from document
// ============================================
export const removeCustomCss = () => {
  const STYLE_ID = 'nexus-custom-css';
  const styleEl = document.getElementById(STYLE_ID);
  
  if (styleEl) {
    styleEl.remove();
  }
};

// ============================================
// EXPORT ALL UTILITIES
// ============================================
export default {
  hexToRgb,
  rgbToHex,
  lightenColor,
  darkenColor,
  generateColorVariations,
  isLightColor,
  getContrastColor,
  sanitizeCss,
  isValidHexColor,
  isValidUrl,
  preloadImage,
  getSystemThemePreference,
  storage,
  STORAGE_KEYS,
  DEFAULT_THEME,
  CSS_VARIABLES,
  applyCssVariables,
  updateFavicon,
  injectCustomCss,
  removeCustomCss,
};
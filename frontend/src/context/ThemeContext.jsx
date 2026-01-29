// ============================================
// THEME CONTEXT - GLOBAL THEME STATE MANAGEMENT
// Provides theme settings to entire application
// ============================================
// Developer: Suvadip Panja
// Company: Digitide
// Created: January 29, 2026
// File: frontend/src/context/ThemeContext.jsx
// ============================================

import React, { 
  createContext, 
  useContext, 
  useState, 
  useEffect, 
  useCallback,
  useMemo 
} from 'react';

// Import theme utilities
import {
  generateColorVariations,
  isValidHexColor,
  isValidUrl,
  getSystemThemePreference,
  storage,
  STORAGE_KEYS,
  DEFAULT_THEME,
  applyCssVariables,
  updateFavicon,
  injectCustomCss,
  removeCustomCss,
} from '../utils/themeUtils';

// Import settings service
import settingsService from '../services/settingsService';

// ============================================
// CREATE CONTEXT
// ============================================
const ThemeContext = createContext(null);

// ============================================
// THEME PROVIDER COMPONENT
// ============================================
export const ThemeProvider = ({ children }) => {
  // ============================================
  // STATE
  // ============================================
  
  // Theme mode (light/dark)
  const [theme, setThemeState] = useState(() => {
    // Priority: localStorage > system preference > default
    const savedTheme = storage.get(STORAGE_KEYS.USER_THEME);
    if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
      return savedTheme;
    }
    return getSystemThemePreference();
  });
  
  // Primary color
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_THEME.primaryColor);
  
  // Branding
  const [logoUrl, setLogoUrl] = useState(DEFAULT_THEME.logoUrl);
  const [faviconUrl, setFaviconUrl] = useState(DEFAULT_THEME.faviconUrl);
  
  // Custom CSS
  const [customCss, setCustomCss] = useState(DEFAULT_THEME.customCss);
  
  // System name (for branding)
  const [systemName, setSystemName] = useState('Nexus Support');
  
  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  
  // ============================================
  // COMPUTED VALUES
  // ============================================
  const colorVariations = useMemo(() => {
    return generateColorVariations(primaryColor);
  }, [primaryColor]);
  
  // ============================================
  // APPLY THEME TO DOCUMENT
  // ============================================
  const applyThemeToDocument = useCallback((themeMode) => {
    const html = document.documentElement;
    
    // Add transition class for smooth theme change
    html.classList.add('theme-transitioning');
    
    // Set data-theme attribute
    html.setAttribute('data-theme', themeMode);
    
    // Remove transition class after animation
    setTimeout(() => {
      html.classList.remove('theme-transitioning');
    }, 300);
  }, []);
  
  // ============================================
  // APPLY PRIMARY COLOR TO CSS VARIABLES
  // ============================================
  const applyPrimaryColor = useCallback((color) => {
    if (!isValidHexColor(color)) {
      console.warn('Invalid primary color:', color);
      return;
    }
    
    const variations = generateColorVariations(color);
    
    applyCssVariables({
      '--primary-color': variations.primary,
      '--primary-rgb': variations.primaryRgb,
      '--primary-hover': variations.primaryHover,
      '--primary-light': variations.primaryLight,
      '--primary-lighter': variations.primaryLighter,
      '--primary-dark': variations.primaryDark,
      '--primary-darker': variations.primaryDarker,
    });
  }, []);
  
  // ============================================
  // LOAD SETTINGS FROM BACKEND
  // ============================================
  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Fetch settings from service (uses cache if available)
      const settings = await settingsService.getAllSettings();
      
      if (settings && settings.appearance) {
        const appearance = settings.appearance;
        
        // Primary Color
        if (appearance.theme_primary_color?.value) {
          const color = appearance.theme_primary_color.value;
          if (isValidHexColor(color)) {
            setPrimaryColor(color);
            applyPrimaryColor(color);
          }
        }
        
        // Default Theme Mode (only apply if user hasn't set preference)
        const userTheme = storage.get(STORAGE_KEYS.USER_THEME);
        if (!userTheme && appearance.theme_default_mode?.value) {
          const defaultMode = appearance.theme_default_mode.value;
          if (defaultMode === 'light' || defaultMode === 'dark') {
            setThemeState(defaultMode);
            applyThemeToDocument(defaultMode);
          }
        }
        
        // Logo URL
        if (appearance.logo_url?.value) {
          const url = appearance.logo_url.value;
          if (isValidUrl(url)) {
            setLogoUrl(url);
          }
        }
        
        // Favicon URL
        if (appearance.favicon_url?.value) {
          const url = appearance.favicon_url.value;
          if (isValidUrl(url)) {
            setFaviconUrl(url);
            updateFavicon(url);
          }
        }
        
        // Custom CSS
        if (appearance.custom_css?.value) {
          setCustomCss(appearance.custom_css.value);
          injectCustomCss(appearance.custom_css.value);
        }
      }
      
      // Get system name from general settings
      if (settings && settings.general) {
        if (settings.general.system_name?.value) {
          setSystemName(settings.general.system_name.value);
        }
      }
      
      setIsInitialized(true);
    } catch (error) {
      console.error('Failed to load theme settings:', error);
      // Apply defaults on error
      applyPrimaryColor(DEFAULT_THEME.primaryColor);
    } finally {
      setIsLoading(false);
    }
  }, [applyPrimaryColor, applyThemeToDocument]);
  
  // ============================================
  // INITIALIZE THEME ON MOUNT
  // ============================================
  useEffect(() => {
    // Apply current theme to document immediately
    applyThemeToDocument(theme);
    applyPrimaryColor(primaryColor);
    
    // Load settings from backend
    loadSettings();
    
    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleSystemThemeChange = (e) => {
      const userTheme = storage.get(STORAGE_KEYS.USER_THEME);
      // Only react to system changes if user hasn't set preference
      if (!userTheme) {
        const newTheme = e.matches ? 'dark' : 'light';
        setThemeState(newTheme);
        applyThemeToDocument(newTheme);
      }
    };
    
    mediaQuery.addEventListener('change', handleSystemThemeChange);
    
    // Cleanup
    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  
  // ============================================
  // TOGGLE THEME (Light <-> Dark)
  // ============================================
  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const newTheme = prev === 'light' ? 'dark' : 'light';
      
      // Save to localStorage
      storage.set(STORAGE_KEYS.USER_THEME, newTheme);
      storage.set(STORAGE_KEYS.THEME_TIMESTAMP, new Date().toISOString());
      
      // Apply to document
      applyThemeToDocument(newTheme);
      
      return newTheme;
    });
  }, [applyThemeToDocument]);
  
  // ============================================
  // SET SPECIFIC THEME
  // ============================================
  const setTheme = useCallback((newTheme) => {
    if (newTheme !== 'light' && newTheme !== 'dark') {
      console.warn('Invalid theme:', newTheme);
      return;
    }
    
    setThemeState(newTheme);
    storage.set(STORAGE_KEYS.USER_THEME, newTheme);
    storage.set(STORAGE_KEYS.THEME_TIMESTAMP, new Date().toISOString());
    applyThemeToDocument(newTheme);
  }, [applyThemeToDocument]);
  
  // ============================================
  // RESET TO SYSTEM DEFAULT
  // ============================================
  const resetToDefault = useCallback(async () => {
    // Clear user preference
    storage.remove(STORAGE_KEYS.USER_THEME);
    storage.remove(STORAGE_KEYS.THEME_TIMESTAMP);
    
    // Get default from settings or system
    try {
      const settings = await settingsService.getAllSettings();
      const defaultMode = settings?.appearance?.theme_default_mode?.value || getSystemThemePreference();
      
      setThemeState(defaultMode);
      applyThemeToDocument(defaultMode);
    } catch (error) {
      // Fallback to system preference
      const systemPref = getSystemThemePreference();
      setThemeState(systemPref);
      applyThemeToDocument(systemPref);
    }
  }, [applyThemeToDocument]);
  
  // ============================================
  // REFRESH SETTINGS FROM BACKEND
  // Called after admin updates settings
  // ============================================
  const refreshSettings = useCallback(async () => {
    // Clear settings cache
    settingsService.clearCache();
    
    // Reload settings
    await loadSettings();
  }, [loadSettings]);
  
  // ============================================
  // UPDATE PRIMARY COLOR
  // For real-time preview in settings
  // ============================================
  const updatePrimaryColor = useCallback((color) => {
    if (!isValidHexColor(color)) return;
    
    setPrimaryColor(color);
    applyPrimaryColor(color);
  }, [applyPrimaryColor]);
  
  // ============================================
  // UPDATE LOGO
  // ============================================
  const updateLogo = useCallback((url) => {
    if (url && !isValidUrl(url)) return;
    setLogoUrl(url || '');
  }, []);
  
  // ============================================
  // UPDATE FAVICON
  // ============================================
  const updateFaviconUrl = useCallback((url) => {
    if (url && !isValidUrl(url)) return;
    setFaviconUrl(url || '');
    updateFavicon(url);
  }, []);
  
  // ============================================
  // UPDATE CUSTOM CSS
  // ============================================
  const updateCustomCss = useCallback((css) => {
    setCustomCss(css || '');
    if (css) {
      injectCustomCss(css);
    } else {
      removeCustomCss();
    }
  }, []);
  
  // ============================================
  // CONTEXT VALUE
  // ============================================
  const contextValue = useMemo(() => ({
    // Current state
    theme,
    primaryColor,
    colorVariations,
    logoUrl,
    faviconUrl,
    customCss,
    systemName,
    
    // Status
    isLoading,
    isInitialized,
    isDark: theme === 'dark',
    isLight: theme === 'light',
    
    // Theme actions
    toggleTheme,
    setTheme,
    resetToDefault,
    
    // Settings actions
    refreshSettings,
    updatePrimaryColor,
    updateLogo,
    updateFaviconUrl,
    updateCustomCss,
  }), [
    theme,
    primaryColor,
    colorVariations,
    logoUrl,
    faviconUrl,
    customCss,
    systemName,
    isLoading,
    isInitialized,
    toggleTheme,
    setTheme,
    resetToDefault,
    refreshSettings,
    updatePrimaryColor,
    updateLogo,
    updateFaviconUrl,
    updateCustomCss,
  ]);
  
  // ============================================
  // RENDER
  // ============================================
  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

// ============================================
// CUSTOM HOOK - useTheme
// ============================================
export const useTheme = () => {
  const context = useContext(ThemeContext);
  
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  
  return context;
};

// ============================================
// EXPORT
// ============================================
export default ThemeContext;
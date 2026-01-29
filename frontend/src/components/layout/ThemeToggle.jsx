// ============================================
// THEME TOGGLE COMPONENT
// Sun/Moon button for switching between light/dark themes
// ============================================
// Developer: Suvadip Panja
// Company: Digitide
// Created: January 29, 2026
// File: frontend/src/components/layout/ThemeToggle.jsx
// ============================================

import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import './ThemeToggle.css';

// ============================================
// SIMPLE ICON TOGGLE (Used in Header)
// ============================================
export const ThemeToggleSimple = ({ size = 20 }) => {
  const { theme, toggleTheme, isLoading } = useTheme();
  
  const isDark = theme === 'dark';
  
  return (
    <button
      className="theme-toggle-simple"
      onClick={toggleTheme}
      disabled={isLoading}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <div className="icon-wrapper">
        <Sun 
          size={size} 
          className={`theme-icon sun ${isDark ? 'hidden' : 'visible'}`} 
        />
        <Moon 
          size={size} 
          className={`theme-icon moon ${isDark ? 'visible' : 'hidden'}`} 
        />
      </div>
    </button>
  );
};

// ============================================
// MAIN TOGGLE BUTTON (Alternative with label)
// ============================================
const ThemeToggle = ({ size = 'medium', showLabel = false }) => {
  const { theme, toggleTheme, isLoading } = useTheme();
  
  const isDark = theme === 'dark';
  
  // Size configurations
  const sizes = {
    small: { icon: 16, button: 32 },
    medium: { icon: 20, button: 40 },
    large: { icon: 24, button: 48 },
  };
  
  const currentSize = sizes[size] || sizes.medium;
  
  return (
    <button
      className={`theme-toggle ${isDark ? 'dark' : 'light'} size-${size}`}
      onClick={toggleTheme}
      disabled={isLoading}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        width: showLabel ? 'auto' : currentSize.button,
        height: currentSize.button,
      }}
    >
      <div className="theme-toggle-track">
        <div className="theme-toggle-thumb">
          {isDark ? (
            <Moon size={currentSize.icon} className="theme-icon moon-icon" />
          ) : (
            <Sun size={currentSize.icon} className="theme-icon sun-icon" />
          )}
        </div>
      </div>
      
      {showLabel && (
        <span className="theme-toggle-label">
          {isDark ? 'Dark' : 'Light'}
        </span>
      )}
    </button>
  );
};

// ============================================
// EXPORT
// ============================================
export default ThemeToggle;
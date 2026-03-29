// ============================================
// AUTH SERVICE - FIXED
// Updated to properly handle and pass through login errors
// Developer: Suvadip Panja
// Updated: January 25, 2026
// ============================================

import api from './api';

export const authService = {
  // ============================================
  // LOGIN - UPDATED WITH PROPER ERROR HANDLING
  // ============================================
  login: async (username, password) => {
    try {
      const response = await api.post('/auth/login', { username, password });
      
      // ⭐ Successful login - store minimal user data only (token is in HttpOnly cookie)
      if (response.data.success) {
        if (response.data.data.token) {
          // Only store minimal user info in localStorage for UI state
          const { user_id, username: uname, first_name, last_name } = response.data.data.user;
          localStorage.setItem('user', JSON.stringify({ user_id, username: uname, first_name, last_name }));
        }
      }
      
      return response.data;
      
    } catch (error) {
      // ⭐ CRITICAL FIX: Pass through the full error response
      // This includes passwordExpired, daysExpired, etc.
      if (error.response && error.response.data) {
        // Return the error data in the same format as success
        // This allows Login.jsx to check for passwordExpired
        return {
          success: false,
          message: error.response.data.message || 'Login failed',
          data: error.response.data.data || null  // ⭐ Include the data object
        };
      }
      
      // Network or other errors
      throw error;
    }
  },

  // Logout
  logout: async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      localStorage.removeItem('user');
    }
  },

  // Get current user
  getCurrentUser: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  // Change password
  changePassword: async (currentPassword, newPassword) => {
    const response = await api.put('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
    return response.data;
  },

  // Get stored user
  getStoredUser: () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  // Token is now in HttpOnly cookie - check user presence for auth state
  getStoredToken: () => {
    return localStorage.getItem('user') ? 'cookie' : null;
  },

  // Check if authenticated (user data exists = session was established)
  isAuthenticated: () => {
    return !!localStorage.getItem('user');
  },
};
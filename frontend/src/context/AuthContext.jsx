// ============================================
// AUTH CONTEXT - FIXED
// Updated to properly pass through login errors
// Developer: Suvadip Panja
// Updated: January 25, 2026
// ============================================

import { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // P1 #47 FIX: On mount, fetch fresh user data from server instead of relying on localStorage
  // localStorage only stores minimal info (user_id, username, first_name, last_name)
  // Full user data (permissions, role, email) is fetched from /auth/me
  useEffect(() => {
    const initAuth = async () => {
      const token = authService.getStoredToken();
      if (token) {
        try {
          const response = await api.get('/auth/me');
          if (response.data.success) {
            setUser(response.data.data);
          } else {
            // Token invalid — clear stored data
            localStorage.removeItem('token');
            localStorage.removeItem('user');
          }
        } catch (error) {
          console.error('Auth init failed:', error);
          // Token expired or invalid — clear stored data
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  // ============================================
  // LOGIN - UPDATED WITH PROPER ERROR HANDLING
  // ============================================
  const login = async (username, password) => {
    try {
      const response = await authService.login(username, password);
      
      // ⭐ Success - set user and return full response
      if (response.success) {
        if (response.data && response.data.user) {
          setUser(response.data.user);
        }
        return { success: true, data: response.data };
      } 
      // ⭐ CRITICAL FIX: Failed login - pass through ALL error data
      else {
        return { 
          success: false, 
          message: response.message || 'Login failed',
          data: response.data || null  // ⭐ Include passwordExpired, daysExpired, etc.
        };
      }
    } catch (error) {
      console.error('Auth context login error:', error);
      
      // ⭐ Check if error has response data (like passwordExpired)
      if (error.response && error.response.data) {
        return {
          success: false,
          message: error.response.data.message || 'Login failed',
          data: error.response.data.data || null  // ⭐ Pass through error data
        };
      }
      
      // Network or other errors
      return {
        success: false,
        message: error.message || 'Login failed. Please try again.'
      };
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
    }
  };

  // ============================================
  // REFRESH USER DATA
  // Called after profile updates
  // ============================================
  const refreshUser = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const response = await api.get('/auth/me');
      if (response.data.success) {
        setUser(response.data.data);
        // P1 #47 FIX: Only store minimal info in localStorage
        const { user_id, username, first_name, last_name } = response.data.data;
        localStorage.setItem('user', JSON.stringify({ user_id, username, first_name, last_name }));
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      logout, 
      loading,
      refreshUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
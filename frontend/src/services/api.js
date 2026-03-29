// ============================================
// AXIOS API INSTANCE - FIXED
// Updated to NOT redirect on login page
// Developer: Suvadip Panja
// Updated: January 25, 2026
// ============================================

import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor - no longer adds token from localStorage
// Auth token is now sent automatically via HttpOnly cookie
api.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ============================================
// RESPONSE INTERCEPTOR - SMART AUTH HANDLING
// Handles: 401 (session expired) and 403 (password expired)
// ============================================
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const currentPath = window.location.pathname;
    const isLoginPage = currentPath === '/login' || currentPath === '/';
    const isChangePasswordPage = currentPath === '/profile/change-password';
    const isAuthenticated = !!localStorage.getItem('user');

    // ============================================
    // 503 + maintenanceMode = System under maintenance
    // Non-admin users are blocked; redirect to login
    // ============================================
    if (error.response?.status === 503 && error.response?.data?.data?.maintenanceMode) {
      if (!isLoginPage && isAuthenticated) {
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    // ============================================
    // 403 + passwordExpired = Password has expired
    // Redirect to change-password page (keep session alive)
    // ============================================
    if (error.response?.status === 403 && error.response?.data?.data?.passwordExpired) {
      if (!isChangePasswordPage && isAuthenticated) {
        window.location.href = '/profile/change-password';
      }
      return Promise.reject(error);
    }

    // ============================================
    // 403 + LICENSE_BLOCKED = License expired/invalid
    // Clear active session and return to login page
    // ============================================
    if (error.response?.status === 403 && error.response?.data?.data?.code === 'LICENSE_BLOCKED') {
      if (!isLoginPage && isAuthenticated) {
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    // ============================================
    // 401 = Session expired / invalid token
    // Redirect to login page (clear session)
    // ============================================
    if (error.response?.status === 401) {
      if (!isLoginPage && isAuthenticated) {
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;
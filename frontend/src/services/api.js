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
});

// Request interceptor - Add token to all requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
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
    const hasToken = localStorage.getItem('token');

    // ============================================
    // 503 + maintenanceMode = System under maintenance
    // Non-admin users are blocked; redirect to login
    // ============================================
    if (error.response?.status === 503 && error.response?.data?.data?.maintenanceMode) {
      if (!isLoginPage && hasToken) {
        localStorage.removeItem('token');
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
      if (!isChangePasswordPage && hasToken) {
        window.location.href = '/profile/change-password';
      }
      return Promise.reject(error);
    }

    // ============================================
    // 403 + LICENSE_BLOCKED = License expired/invalid
    // Clear active session and return to login page
    // ============================================
    if (error.response?.status === 403 && error.response?.data?.data?.code === 'LICENSE_BLOCKED') {
      if (!isLoginPage && hasToken) {
        localStorage.removeItem('token');
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
      // ⭐ ONLY redirect if:
      // 1. NOT on login page AND
      // 2. User has a token (meaning they were authenticated)
      // This prevents redirect on login failures but handles session expiry
      if (!isLoginPage && hasToken) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
      
      // ⭐ If we're on login page or no token exists, let the error propagate
      // so the Login component can handle it and display the error message
    }
    
    return Promise.reject(error);
  }
);

export default api;
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
  const [passwordExpired, setPasswordExpired] = useState(false);
  const [licenseState, setLicenseState] = useState({
    current_status: 'UNKNOWN',
    entitlements: {},
    usage: {},
    loaded: false,
  });

  const loadLicenseState = async () => {
    try {
      const response = await api.get('/license/client-state');
      if (response.data?.success) {
        setLicenseState({
          current_status: response.data.data.current_status || 'UNKNOWN',
          entitlements: response.data.data.entitlements || {},
          usage: response.data.data.usage || {},
          loaded: true,
        });
      }
    } catch (error) {
      setLicenseState({
        current_status: 'UNKNOWN',
        entitlements: {},
        usage: {},
        loaded: true,
      });
    }
  };

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
            await loadLicenseState();
            // Check password expiry status after auth
            try {
              const expiryResponse = await api.get('/password-expiry/status');
              if (expiryResponse.data.success && expiryResponse.data.data.expired) {
                setPasswordExpired(true);
              }
            } catch (expiryErr) {
              // If 403 with passwordExpired, set the flag
              if (expiryErr.response?.status === 403 && expiryErr.response?.data?.data?.passwordExpired) {
                setPasswordExpired(true);
              }
            }
          } else {
            // Token invalid — clear stored data
            localStorage.removeItem('token');
            localStorage.removeItem('user');
          }
        } catch (error) {
          // If password expired (403), keep token but mark expired
          if (error.response?.status === 403 && error.response?.data?.data?.passwordExpired) {
            setPasswordExpired(true);
            // Still try to get basic user info from localStorage
            const storedUser = localStorage.getItem('user');
            if (storedUser) {
              try { setUser(JSON.parse(storedUser)); } catch (e) { /* ignore */ }
            }
            await loadLicenseState();
          } else {
            // Token expired or invalid — clear stored data
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setLicenseState({ current_status: 'UNKNOWN', entitlements: {}, usage: {}, loaded: false });
          }
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
        await loadLicenseState();
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
    } finally {
      setUser(null);
      setLicenseState({ current_status: 'UNKNOWN', entitlements: {}, usage: {}, loaded: false });
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
        await loadLicenseState();
        // P1 #47 FIX: Only store minimal info in localStorage
        const { user_id, username, first_name, last_name } = response.data.data;
        localStorage.setItem('user', JSON.stringify({ user_id, username, first_name, last_name }));
      }
    } catch (error) {
    }
  };

  // ============================================
  // CLEAR PASSWORD EXPIRED FLAG
  // Called after successful password change
  // ============================================
  const clearPasswordExpired = () => {
    setPasswordExpired(false);
  };

  const hasLicensedFeature = (featureKey) => {
    const normalizedKey = String(featureKey || '').trim().toLowerCase();
    if (!normalizedKey) return true;

    const features = licenseState?.entitlements?.features || {};
    const configuredFeatures = Object.keys(features);

    if (configuredFeatures.length === 0) {
      return true;
    }

    return features[normalizedKey] === true;
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      logout, 
      loading,
      refreshUser,
      passwordExpired,
      clearPasswordExpired,
      licenseState,
      refreshLicenseState: loadLicenseState,
      hasLicensedFeature,
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
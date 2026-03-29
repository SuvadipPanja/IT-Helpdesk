// ============================================
// LOGIN PAGE - PRODUCTION READY
// Enterprise IT Helpdesk & Ticket Management System
// Developer: Suvadip Panja
// Company: Digitide
// Created: October 11, 2024
// Last Updated: January 26, 2026
// Version: 3.0.0 - Production Release
// Security: OWASP Compliant, JWT, 2FA, XSS Prevention
// ============================================
// CHANGELOG v3.0.0:
// - Fixed 2FA flow (property name: requiresTwoFactor)
// - Fixed OTP verification redirect issue
// - Removed all console.log for production
// - Added security hardening
// - Restored footer section
// ============================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  Shield, 
  Mail, 
  Clock, 
  RefreshCw, 
  ArrowLeft 
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getSetting } from '../../utils/settingsLoader';
import api from '../../services/api';
import '../../styles/Login.css';

// ============================================
// UI CONSTANTS (not security-configurable)
// ============================================
const UI_CONFIG = Object.freeze({
  MAX_USERNAME_LENGTH: 50,
  MAX_PASSWORD_LENGTH: 128,
  ERROR_DISPLAY_DURATION: 10000,
  OTP_LENGTH: 6,
});

// Default security values (overwritten by API fetch on mount)
const SECURITY_DEFAULTS = {
  MIN_PASSWORD_LENGTH: 6,
  OTP_EXPIRY_MINUTES: 5,
  RESEND_COOLDOWN_SECONDS: 60,
  SESSION_TIMEOUT_MINUTES: 30,
};

// ============================================
// SESSION STORAGE KEYS (Prefixed for security)
// ============================================
const STORAGE_KEYS = Object.freeze({
  TWO_FACTOR_STATE: 'nxs_2fa_state',
  OTP_TIMER: 'nxs_2fa_timer',
  USERNAME: 'nxs_2fa_usr',
  PASSWORD_HASH: 'nxs_2fa_pwd',
});

// ============================================
// INPUT SANITIZATION UTILITY
// Prevents XSS and injection attacks
// ============================================
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/data:/gi, '')
    .trim()
    .substring(0, UI_CONFIG.MAX_USERNAME_LENGTH);
};

// ============================================
// SECURE SESSION STORAGE HELPERS
// ============================================
const secureStorage = {
  set: (key, value) => {
    try {
      const encoded = btoa(JSON.stringify(value));
      sessionStorage.setItem(key, encoded);
    } catch {
      // Silent fail for security
    }
  },
  get: (key) => {
    try {
      const encoded = sessionStorage.getItem(key);
      if (!encoded) return null;
      return JSON.parse(atob(encoded));
    } catch {
      return null;
    }
  },
  remove: (key) => {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // Silent fail
    }
  },
  clear: () => {
    Object.values(STORAGE_KEYS).forEach(key => {
      try {
        sessionStorage.removeItem(key);
      } catch {
        // Silent fail
      }
    });
  }
};

// ============================================
// MAIN LOGIN COMPONENT
// ============================================
const Login = () => {
  // ============================================
  // STATE MANAGEMENT
  // ============================================
  const [formData, setFormData] = useState({ 
    username: '', 
    password: '' 
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [licenseState, setLicenseState] = useState({
    status: 'UNKNOWN',
    message: '',
    expiresAt: null,
  });
  
  // Password expiry state
  const [passwordExpired, setPasswordExpired] = useState(false);
  const [passwordExpiredData, setPasswordExpiredData] = useState(null);
  
  // Two-Factor Authentication state
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [twoFactorData, setTwoFactorData] = useState({
    userId: null,
    email: '',
    expiryMinutes: 5
  });
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendingOtp, setResendingOtp] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(300);

  // Dynamic security config (fetched from DB on mount)
  const [securityConfig, setSecurityConfig] = useState(SECURITY_DEFAULTS);

  // Refs for cleanup and state tracking
  const errorTimerRef = useRef(null);
  const otpErrorTimerRef = useRef(null);
  const otpTimerRef = useRef(null);
  const hasRestoredState = useRef(false);
  const isInitialMount = useRef(true);
  const isMounted = useRef(true);

  // ============================================
  // HOOKS
  // ============================================
  const { login, refreshUser } = useAuth();
  const navigate = useNavigate();

  // ============================================
  // DYNAMIC BRANDING (fetched on mount so logo from Settings reflects immediately)
  // ============================================
  const [branding, setBranding] = useState({
    systemName: getSetting('system_name', 'Nexus Support'),
    systemTitle: getSetting('system_title', 'IT Help-Desk Service'),
    companyName: getSetting('company_name', 'Digitide'),
    logoUrl: (() => {
      const raw = getSetting('logo_url', '/logo.svg');
      return raw?.startsWith('/uploads')
        ? `${import.meta.env.VITE_API_BASE_URL?.replace('/api/v1', '') || ''}${raw}`
        : (raw || '/logo.svg');
    })(),
    maintenanceMode: false,
    maintenanceMessage: 'System is under maintenance. Please check back later.',
  });

  // ============================================
  // CLEANUP ON UNMOUNT
  // ============================================
  useEffect(() => {
    isMounted.current = true;
    
    return () => {
      isMounted.current = false;
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      if (otpErrorTimerRef.current) clearTimeout(otpErrorTimerRef.current);
      if (otpTimerRef.current) clearInterval(otpTimerRef.current);
    };
  }, []);

  // ============================================
  // FETCH PUBLIC BRANDING (logo, system name) ON MOUNT
  // Ensures logo set in Settings > General reflects on login page
  // ============================================
  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const res = await api.get('/settings/public');
        if (res.data?.success && res.data?.data?.settings) {
          const s = res.data.data.settings;
          const rawLogo = s.logo_url || '/logo.svg';
          const logoUrl = rawLogo.startsWith('/uploads')
            ? `${import.meta.env.VITE_API_BASE_URL?.replace('/api/v1', '') || ''}${rawLogo}`
            : rawLogo;
          if (isMounted.current) {
            setBranding({
              systemName: s.system_name || 'Nexus Support',
              systemTitle: s.system_title || 'IT Help-Desk Service',
              companyName: s.company_name || 'Digitide',
              logoUrl: logoUrl || '/logo.svg',
              maintenanceMode: s.maintenance_mode === 'true' || s.maintenance_mode === true || s.maintenance_mode === 1,
              maintenanceMessage: s.maintenance_message || 'System is under maintenance. Please check back later.',
            });
          }
        }
      } catch {
        // Keep defaults on failure
      }
    };
    fetchBranding();
  }, []);

  // ============================================
  // FETCH SECURITY CONFIG FROM DB ON MOUNT
  // ============================================
  useEffect(() => {
    const fetchSecurityConfig = async () => {
      try {
        const res = await api.get('/security/password-policy');
        if (res.data?.success && res.data?.data) {
          const d = res.data.data;
          setSecurityConfig({
            MIN_PASSWORD_LENGTH: parseInt(d.password_min_length) || SECURITY_DEFAULTS.MIN_PASSWORD_LENGTH,
            OTP_EXPIRY_MINUTES: parseInt(d.otp_expiry_minutes) || SECURITY_DEFAULTS.OTP_EXPIRY_MINUTES,
            RESEND_COOLDOWN_SECONDS: parseInt(d.resend_otp_cooldown_seconds) || SECURITY_DEFAULTS.RESEND_COOLDOWN_SECONDS,
            SESSION_TIMEOUT_MINUTES: parseInt(d.session_timeout_minutes) || SECURITY_DEFAULTS.SESSION_TIMEOUT_MINUTES,
          });
        }
      } catch {
        // Use defaults silently on failure
      }
    };
    fetchSecurityConfig();
  }, []);

  // ============================================
  // FETCH PUBLIC LICENSE STATUS
  // ============================================
  useEffect(() => {
    const fetchLicenseStatus = async () => {
      try {
        const res = await api.get('/license/public-status');
        if (res.data?.success && res.data?.data) {
          setLicenseState({
            status: res.data.data.status || 'UNKNOWN',
            message: res.data.data.message || '',
            expiresAt: res.data.data.expires_at || null,
          });
        }
      } catch {
        // Keep the login page usable if the public license endpoint is unavailable.
      }
    };

    fetchLicenseStatus();
  }, []);

  // ============================================
  // RESTORE 2FA STATE ON PAGE LOAD
  // ============================================
  useEffect(() => {
    if (!isInitialMount.current) return;
    isInitialMount.current = false;

    const savedState = secureStorage.get(STORAGE_KEYS.TWO_FACTOR_STATE);
    
    if (savedState && !hasRestoredState.current && savedState.userId) {
      hasRestoredState.current = true;
      
      const savedTimer = secureStorage.get(STORAGE_KEYS.OTP_TIMER);
      const savedUsername = secureStorage.get(STORAGE_KEYS.USERNAME);
      
      const elapsed = Math.floor((Date.now() - savedState.timestamp) / 1000);
      const savedTimerInt = savedTimer || 300;
      const remainingTime = Math.max(0, savedTimerInt - elapsed);

      if (remainingTime > 0) {
        setTwoFactorData(savedState);
        setTimeRemaining(remainingTime);
        setShowTwoFactor(true);
        if (savedUsername) {
          setFormData({ 
            username: savedUsername,
            password: ''
          });
        }
      } else {
        secureStorage.clear();
      }
    }
  }, []);

  // ============================================
  // PERSIST 2FA STATE
  // ============================================
  useEffect(() => {
    if (showTwoFactor && twoFactorData.userId) {
      secureStorage.set(STORAGE_KEYS.TWO_FACTOR_STATE, twoFactorData);
      secureStorage.set(STORAGE_KEYS.OTP_TIMER, timeRemaining);
      if (formData.username) {
        secureStorage.set(STORAGE_KEYS.USERNAME, formData.username);
      }
      // Password NOT stored in sessionStorage for security
    }
  }, [showTwoFactor, twoFactorData, timeRemaining, formData.username, formData.password]);

  // ============================================
  // OTP COUNTDOWN TIMER
  // ============================================
  useEffect(() => {
    if (showTwoFactor && timeRemaining > 0) {
      otpTimerRef.current = setInterval(() => {
        if (isMounted.current) {
          setTimeRemaining(prev => {
            if (prev <= 1) {
              clearInterval(otpTimerRef.current);
              return 0;
            }
            return prev - 1;
          });
        }
      }, 1000);
    }

    return () => {
      if (otpTimerRef.current) clearInterval(otpTimerRef.current);
    };
  }, [showTwoFactor]);

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================
  const formatTime = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const setErrorWithTimer = useCallback((errorMsg) => {
    if (!isMounted.current) return;
    setError(errorMsg);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => {
      if (isMounted.current) {
        setError('');
      }
    }, UI_CONFIG.ERROR_DISPLAY_DURATION);
  }, []);

  const setOtpErrorWithTimer = useCallback((errorMsg) => {
    if (!isMounted.current) return;
    setOtpError(errorMsg);
    if (otpErrorTimerRef.current) clearTimeout(otpErrorTimerRef.current);
    otpErrorTimerRef.current = setTimeout(() => {
      if (isMounted.current) {
        setOtpError('');
      }
    }, UI_CONFIG.ERROR_DISPLAY_DURATION);
  }, []);

  // ============================================
  // FORM HANDLERS
  // ============================================
  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    const sanitizedValue = name === 'password' 
      ? value.substring(0, UI_CONFIG.MAX_PASSWORD_LENGTH)
      : sanitizeInput(value);
    
    setFormData(prev => ({ ...prev, [name]: sanitizedValue }));
    
    if (error) setError('');
    if (passwordExpired) {
      setPasswordExpired(false);
      setPasswordExpiredData(null);
    }
  }, [error, passwordExpired]);

  const handleOtpChange = useCallback((e) => {
    const value = e.target.value.replace(/\D/g, '').substring(0, UI_CONFIG.OTP_LENGTH);
    setOtpCode(value);
    if (otpError) setOtpError('');
  }, [otpError]);

  // ============================================
  // LOGIN SUBMIT HANDLER
  // ============================================
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const trimmedUsername = formData.username.trim();
    const trimmedPassword = formData.password.trim();
    
    if (!trimmedUsername || !trimmedPassword) {
      setErrorWithTimer('Please enter both username and password');
      return;
    }

    if (trimmedPassword.length < securityConfig.MIN_PASSWORD_LENGTH) {
      setErrorWithTimer(`Password must be at least ${securityConfig.MIN_PASSWORD_LENGTH} characters`);
      return;
    }

    if (['EXPIRED', 'INVALID', 'MISSING', 'CONFIG_ERROR'].includes(licenseState.status)) {
      setErrorWithTimer(licenseState.message || 'License expired. Please update it or contact administrator.');
      return;
    }

    setLoading(true);
    setError('');
    setPasswordExpired(false);
    setPasswordExpiredData(null);

    try {
      const result = await login(trimmedUsername, trimmedPassword);
      
      if (!isMounted.current) return;

      // ============================================
      // HANDLE PASSWORD EXPIRY - REDIRECT TO RESET PASSWORD
      // Developer: Suvadip Panja
      // Date: February 03, 2026
      // ============================================
      if (result.data?.passwordExpired) {
        setPasswordExpired(true);
        setPasswordExpiredData({
          daysExpired: result.data.daysExpired || 0,
          email: result.data.email || null
        });
        setErrorWithTimer(result.message || 'Your password has expired. A reset link has been sent to your email.');
        setLoading(false);
        return;
      }
      
      // Handle 2FA Required (Backend sends "requiresTwoFactor")
      if (result.data?.requiresTwoFactor) {
        hasRestoredState.current = true;
        
        setTwoFactorData({
          userId: result.data.userId,
          email: result.data.email,
          expiryMinutes: result.data.expiryMinutes || securityConfig.OTP_EXPIRY_MINUTES,
          timestamp: Date.now()
        });
        
        const expirySeconds = (result.data.expiryMinutes || securityConfig.OTP_EXPIRY_MINUTES) * 60;
        setTimeRemaining(expirySeconds);
        setShowTwoFactor(true);
        setOtpCode('');
        setLoading(false);
        return;
      }

      // Handle successful login (no 2FA)
      if (result.success && result.data?.token) {
        secureStorage.clear();
        // P1 #51 FIX: Use SPA navigation instead of full page reload
        navigate('/dashboard');
        return;
      }
      
      // Handle login failure
      setErrorWithTimer(result.message || 'Login failed. Please check your credentials.');

    } catch (err) {
      if (isMounted.current) {
        const errorMessage = err.response?.data?.message || 
                            err.message || 
                            'Login failed. Please try again.';
        setErrorWithTimer(errorMessage);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  // ============================================
  // OTP VERIFICATION HANDLER
  // ============================================
  const handleVerifyOtp = async (e) => {
    e.preventDefault();

    if (otpCode.length !== UI_CONFIG.OTP_LENGTH) {
      setOtpErrorWithTimer('Please enter a valid 6-digit code');
      return;
    }

    if (timeRemaining <= 0) {
      setOtpErrorWithTimer('Verification code has expired. Please resend.');
      return;
    }

    if (!twoFactorData.userId) {
      setOtpErrorWithTimer('Session expired. Please login again.');
      handleBackToLogin();
      return;
    }

    setVerifyingOtp(true);
    setOtpError('');

    try {
      const response = await api.post('/auth/verify-2fa-login', {
        userId: twoFactorData.userId,
        code: otpCode
      });

      if (!isMounted.current) return;

      if (response.data.success && response.data.data?.token) {
        // Store minimal user info (token is in HttpOnly cookie)
        const { user_id, username, first_name, last_name } = response.data.data.user;
        localStorage.setItem('user', JSON.stringify({ user_id, username, first_name, last_name }));
        
        // Clear 2FA session data
        secureStorage.clear();
        
        // P1 #51 FIX: Use SPA navigation instead of full page reload
        // refreshUser() hydrates AuthContext with full user data from /auth/me
        await refreshUser();
        navigate('/dashboard');
        return;
      }
      
      setOtpErrorWithTimer(response.data.message || 'Invalid verification code');
      
    } catch (err) {
      if (isMounted.current) {
        const errorMessage = err.response?.data?.message || 
                            err.message || 
                            'Verification failed. Please try again.';
        setOtpErrorWithTimer(errorMessage);
      }
    } finally {
      if (isMounted.current) {
        setVerifyingOtp(false);
      }
    }
  };

  // ============================================
  // RESEND OTP HANDLER
  // ============================================
  const handleResendOtp = async () => {
    // Resend allowed only after cooldown period elapses from start of timer
    const resendThreshold = (securityConfig.OTP_EXPIRY_MINUTES * 60) - securityConfig.RESEND_COOLDOWN_SECONDS;
    if (resendingOtp || timeRemaining > resendThreshold) return;

    setResendingOtp(true);
    setOtpError('');

    try {
      const result = await login(formData.username, formData.password);

      if (!isMounted.current) return;

      if (result.data?.requiresTwoFactor) {
        setTwoFactorData({
          userId: result.data.userId,
          email: result.data.email,
          expiryMinutes: result.data.expiryMinutes || securityConfig.OTP_EXPIRY_MINUTES,
          timestamp: Date.now()
        });
        const expirySeconds = (result.data.expiryMinutes || securityConfig.OTP_EXPIRY_MINUTES) * 60;
        setTimeRemaining(expirySeconds);
        setOtpCode('');
        setOtpErrorWithTimer('New verification code sent to your email');
      } else {
        setOtpErrorWithTimer('Failed to resend code. Please try again.');
      }
    } catch (err) {
      if (isMounted.current) {
        setOtpErrorWithTimer(err.message || 'Failed to resend code. Please try again.');
      }
    } finally {
      if (isMounted.current) {
        setResendingOtp(false);
      }
    }
  };

  // ============================================
  // BACK TO LOGIN HANDLER
  // ============================================
  const handleBackToLogin = useCallback(() => {
    setShowTwoFactor(false);
    setTwoFactorData({ userId: null, email: '', expiryMinutes: 5 });
    setOtpCode('');
    setOtpError('');
    setTimeRemaining(300);
    secureStorage.clear();
    if (otpTimerRef.current) {
      clearInterval(otpTimerRef.current);
    }
  }, []);

  // ============================================
  // RENDER: MAIN LOGIN PAGE
  // (Maintenance mode shows warning but still allows admin login)
  // ============================================
  return (
    <div className="login-page-container">
      <div className="login-card">

        {/* Maintenance Mode Warning Banner */}
        {branding.maintenanceMode && (
          <div className="login-maintenance-warning">
            <AlertCircle size={20} />
            <div>
              <strong>Maintenance Mode Active</strong>
              <p>{branding.maintenanceMessage}</p>
              <small style={{ opacity: 0.7, marginTop: '4px', display: 'block' }}>
                
              </small>
            </div>
          </div>
        )}

        {['EXPIRED', 'INVALID', 'MISSING', 'CONFIG_ERROR'].includes(licenseState.status) && (
          <div className="login-maintenance-warning login-license-warning">
            <AlertCircle size={20} />
            <div>
              <strong>License Access Blocked</strong>
              <p>{licenseState.message || 'License expired. Please update it or contact administrator.'}</p>
              <Link to="/license-recovery" className="forgot-password-link">
                Open license recovery
              </Link>
            </div>
          </div>
        )}
        
        {/* Logo Section */}
        <div className="login-logo-section">
          <div className="login-logo-icon">
            <img src={branding.logoUrl} alt={branding.systemName} width="48" height="48" onError={(e) => { e.target.src = '/logo.svg'; }} />
          </div>
          <h1 className="login-title">{branding.systemName}</h1>
          <p className="login-subtitle">{branding.systemTitle}</p>
        </div>

        {/* Error Message Display */}
        {error && !showTwoFactor && (
          <div className={`login-error-message ${passwordExpired ? 'login-error-password-expired' : ''}`}>
            <AlertCircle size={18} />
            <div className="login-error-content">
              {passwordExpired && passwordExpiredData ? (
                <>
                  <span className="login-error-text">Your password has expired</span>
                  {passwordExpiredData.daysExpired > 0 && (
                    <p className="login-expired-days">
                      Expired {passwordExpiredData.daysExpired} day{passwordExpiredData.daysExpired !== 1 ? 's' : ''} ago
                    </p>
                  )}
                  <p className="login-expired-help">
                    {passwordExpiredData.email 
                      ? `A password reset link has been sent to ${passwordExpiredData.email}.`
                      : 'Please use the "Forgot Password" link below to reset your password.'}
                  </p>
                </>
              ) : (
                <span className="login-error-text">{error}</span>
              )}
            </div>
          </div>
        )}

        {/* Login Form */}
        {!showTwoFactor && (
          <form onSubmit={handleSubmit} className="login-form" autoComplete="off">
            
            {/* Username Field */}
            <div className="login-form-group">
              <label htmlFor="username" className="login-label">Username</label>
              <div className="login-input-wrapper">
                <User size={18} className="login-input-icon" />
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder="Enter your username"
                  className="login-input"
                  required
                  maxLength={UI_CONFIG.MAX_USERNAME_LENGTH}
                  disabled={loading || ['EXPIRED', 'INVALID', 'MISSING', 'CONFIG_ERROR'].includes(licenseState.status)}
                  autoComplete="username"
                  spellCheck="false"
                  autoCapitalize="none"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="login-form-group">
              <label htmlFor="password" className="login-label">Password</label>
              <div className="login-input-wrapper">
                <Lock size={18} className="login-input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Enter your password"
                  className="login-input"
                  required
                  maxLength={UI_CONFIG.MAX_PASSWORD_LENGTH}
                  disabled={loading || ['EXPIRED', 'INVALID', 'MISSING', 'CONFIG_ERROR'].includes(licenseState.status)}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword(prev => !prev)}
                  disabled={loading || ['EXPIRED', 'INVALID', 'MISSING', 'CONFIG_ERROR'].includes(licenseState.status)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Forgot Password Link */}
            <div className="login-forgot-password">
              <Link to="/forgot-password" className="login-forgot-link" tabIndex={loading ? -1 : 0}>
                Forgot Password?
              </Link>
            </div>

            {/* Submit Button */}
            <button 
              type="submit" 
              className="login-button" 
              disabled={loading || ['EXPIRED', 'INVALID', 'MISSING', 'CONFIG_ERROR'].includes(licenseState.status)}
            >
              {loading ? (
                <>
                  <Lock size={18} />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <Lock size={18} />
                  <span>Sign In</span>
                </>
              )}
            </button>
            
          </form>
        )}

        {/* 2FA OTP Form */}
        {showTwoFactor && (
          <div className="login-otp-section">
            
            {/* OTP Header */}
            <div className="login-otp-heading">
              <Mail size={24} className="login-otp-icon" />
              <div>
                <h3 className="login-otp-title">Verify Your Identity</h3>
                <p className="login-otp-subtitle">
                  Code sent to {twoFactorData.email || 'your email'}
                </p>
              </div>
            </div>

            {/* OTP Error */}
            {otpError && (
              <div className="login-error-message">
                <AlertCircle size={16} />
                <span>{otpError}</span>
              </div>
            )}

            {/* OTP Form */}
            <form onSubmit={handleVerifyOtp} className="login-otp-form">
              
              {/* OTP Input */}
              <div className="login-form-group">
                <label htmlFor="otpCode" className="login-label">Verification Code</label>
                <input
                  type="text"
                  id="otpCode"
                  name="otpCode"
                  value={otpCode}
                  onChange={handleOtpChange}
                  placeholder="000000"
                  className="login-otp-input"
                  required
                  maxLength={UI_CONFIG.OTP_LENGTH}
                  disabled={verifyingOtp || timeRemaining <= 0}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoFocus
                />
              </div>

              {/* Timer Display */}
              <div className="login-otp-timer">
                <Clock size={14} />
                <span>
                  {timeRemaining > 0 ? (
                    <>Expires in <strong>{formatTime(timeRemaining)}</strong></>
                  ) : (
                    <span className="login-otp-expired">Code expired</span>
                  )}
                </span>
              </div>

              {/* Verify Button */}
              <button
                type="submit"
                className="login-button"
                disabled={verifyingOtp || timeRemaining <= 0 || otpCode.length !== UI_CONFIG.OTP_LENGTH}
              >
                {verifyingOtp ? (
                  <>
                    <Shield size={18} />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <Shield size={18} />
                    <span>Verify Code</span>
                  </>
                )}
              </button>

              {/* OTP Actions */}
              <div className="login-otp-actions">
                <button
                  type="button"
                  className="login-otp-link-button"
                  onClick={handleResendOtp}
                  disabled={resendingOtp || timeRemaining > ((securityConfig.OTP_EXPIRY_MINUTES * 60) - securityConfig.RESEND_COOLDOWN_SECONDS)}
                >
                  <RefreshCw size={14} />
                  <span>{resendingOtp ? 'Sending...' : 'Resend Code'}</span>
                </button>
                
                <button
                  type="button"
                  className="login-otp-link-button"
                  onClick={handleBackToLogin}
                  disabled={verifyingOtp}
                >
                  <ArrowLeft size={14} />
                  <span>Back to Login</span>
                </button>
              </div>
              
            </form>
          </div>
        )}

        {/* Footer */}
        <div className="login-footer">
          <p className="login-footer-text">
            © 2025-2026 <strong>{branding.companyName}</strong>. All Rights Reserved | Version 3.4.7
          </p>
          <p className="login-footer-text">
            Developed by <strong>Suvadip Panja</strong>
          </p>
        </div>
        
      </div>
    </div>
  );
};

export default Login;
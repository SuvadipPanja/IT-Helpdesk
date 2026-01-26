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
// SECURITY CONFIGURATION
// All values should match backend settings
// ============================================
const SECURITY_CONFIG = Object.freeze({
  MAX_USERNAME_LENGTH: 50,
  MAX_PASSWORD_LENGTH: 128,
  MIN_PASSWORD_LENGTH: 6,
  ERROR_DISPLAY_DURATION: 10000,
  OTP_LENGTH: 6,
  OTP_EXPIRY_MINUTES: 5,
  RESEND_COOLDOWN_SECONDS: 60,
  SESSION_TIMEOUT_WARNING: 240,
});

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
    .substring(0, SECURITY_CONFIG.MAX_USERNAME_LENGTH);
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
  const { login } = useAuth();
  const navigate = useNavigate();

  // ============================================
  // LOAD SYSTEM SETTINGS
  // ============================================
  const systemName = getSetting('system_name', 'Nexus Support');
  const systemTitle = getSetting('system_title', 'IT Help-Desk Service');
  const companyName = getSetting('company_name', 'Digitide');
  const maintenanceModeValue = getSetting('maintenance_mode', 'false');
  const maintenanceMode = maintenanceModeValue === 'true' || 
                          maintenanceModeValue === true || 
                          maintenanceModeValue === 1;
  const maintenanceMessage = getSetting(
    'maintenance_message', 
    'System is under maintenance. Please check back later.'
  );

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
      const savedPassword = secureStorage.get(STORAGE_KEYS.PASSWORD_HASH);
      
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
            password: savedPassword || ''
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
      if (formData.password) {
        secureStorage.set(STORAGE_KEYS.PASSWORD_HASH, formData.password);
      }
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
    }, SECURITY_CONFIG.ERROR_DISPLAY_DURATION);
  }, []);

  const setOtpErrorWithTimer = useCallback((errorMsg) => {
    if (!isMounted.current) return;
    setOtpError(errorMsg);
    if (otpErrorTimerRef.current) clearTimeout(otpErrorTimerRef.current);
    otpErrorTimerRef.current = setTimeout(() => {
      if (isMounted.current) {
        setOtpError('');
      }
    }, SECURITY_CONFIG.ERROR_DISPLAY_DURATION);
  }, []);

  // ============================================
  // FORM HANDLERS
  // ============================================
  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    const sanitizedValue = name === 'password' 
      ? value.substring(0, SECURITY_CONFIG.MAX_PASSWORD_LENGTH)
      : sanitizeInput(value);
    
    setFormData(prev => ({ ...prev, [name]: sanitizedValue }));
    
    if (error) setError('');
    if (passwordExpired) {
      setPasswordExpired(false);
      setPasswordExpiredData(null);
    }
  }, [error, passwordExpired]);

  const handleOtpChange = useCallback((e) => {
    const value = e.target.value.replace(/\D/g, '').substring(0, SECURITY_CONFIG.OTP_LENGTH);
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

    if (trimmedPassword.length < SECURITY_CONFIG.MIN_PASSWORD_LENGTH) {
      setErrorWithTimer(`Password must be at least ${SECURITY_CONFIG.MIN_PASSWORD_LENGTH} characters`);
      return;
    }

    setLoading(true);
    setError('');
    setPasswordExpired(false);
    setPasswordExpiredData(null);

    try {
      const result = await login(trimmedUsername, trimmedPassword);
      
      if (!isMounted.current) return;

      // Handle password expiry
      if (result.data?.passwordExpired) {
        setPasswordExpired(true);
        setPasswordExpiredData({
          daysExpired: result.data.daysExpired || 0
        });
        setErrorWithTimer(result.message || 'Your password has expired');
        setLoading(false);
        return;
      }
      
      // Handle 2FA Required (Backend sends "requiresTwoFactor")
      if (result.data?.requiresTwoFactor) {
        hasRestoredState.current = true;
        
        setTwoFactorData({
          userId: result.data.userId,
          email: result.data.email,
          expiryMinutes: result.data.expiryMinutes || SECURITY_CONFIG.OTP_EXPIRY_MINUTES,
          timestamp: Date.now()
        });
        
        const expirySeconds = (result.data.expiryMinutes || SECURITY_CONFIG.OTP_EXPIRY_MINUTES) * 60;
        setTimeRemaining(expirySeconds);
        setShowTwoFactor(true);
        setOtpCode('');
        setLoading(false);
        return;
      }

      // Handle successful login (no 2FA)
      if (result.success && result.data?.token) {
        secureStorage.clear();
        // Use window.location for full page reload to update AuthContext
        window.location.href = '/dashboard';
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

    if (otpCode.length !== SECURITY_CONFIG.OTP_LENGTH) {
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
        // Store authentication data
        localStorage.setItem('token', response.data.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.data.user));
        
        // Clear 2FA session data
        secureStorage.clear();
        
        // IMPORTANT: Use window.location for full page reload
        // This ensures AuthContext reads the new token from localStorage
        window.location.href = '/dashboard';
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
    if (resendingOtp || timeRemaining > SECURITY_CONFIG.SESSION_TIMEOUT_WARNING) return;

    setResendingOtp(true);
    setOtpError('');

    try {
      const result = await login(formData.username, formData.password);

      if (!isMounted.current) return;

      if (result.data?.requiresTwoFactor) {
        setTwoFactorData({
          userId: result.data.userId,
          email: result.data.email,
          expiryMinutes: result.data.expiryMinutes || SECURITY_CONFIG.OTP_EXPIRY_MINUTES,
          timestamp: Date.now()
        });
        const expirySeconds = (result.data.expiryMinutes || SECURITY_CONFIG.OTP_EXPIRY_MINUTES) * 60;
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
  // RENDER: MAINTENANCE MODE
  // ============================================
  if (maintenanceMode) {
    return (
      <div className="login-page-container">
        <div className="login-card">
          <div className="login-logo-section">
            <div className="login-logo-icon">
              <AlertCircle size={36} />
            </div>
            <h1 className="login-title">System Maintenance</h1>
            <p className="login-subtitle">{systemName}</p>
          </div>
          
          <div className="login-maintenance-warning">
            <AlertCircle size={20} />
            <div>
              <strong>Maintenance Mode</strong>
              <p>{maintenanceMessage}</p>
            </div>
          </div>

          <div className="login-footer">
            <p className="login-footer-text">
              © 2025-2026 <strong>{companyName}</strong>. All Rights Reserved
            </p>
            <p className="login-footer-text">
              Developed by <strong>Suvadip Panja</strong>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER: MAIN LOGIN PAGE
  // ============================================
  return (
    <div className="login-page-container">
      <div className="login-card">
        
        {/* Logo Section */}
        <div className="login-logo-section">
          <div className="login-logo-icon">
            <Shield size={36} />
          </div>
          <h1 className="login-title">{systemName}</h1>
          <p className="login-subtitle">{systemTitle}</p>
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
                    Please contact your administrator or use the "Forgot Password" link below.
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
                  maxLength={SECURITY_CONFIG.MAX_USERNAME_LENGTH}
                  disabled={loading}
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
                  maxLength={SECURITY_CONFIG.MAX_PASSWORD_LENGTH}
                  disabled={loading}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword(prev => !prev)}
                  disabled={loading}
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
              disabled={loading}
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
                  maxLength={SECURITY_CONFIG.OTP_LENGTH}
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
                disabled={verifyingOtp || timeRemaining <= 0 || otpCode.length !== SECURITY_CONFIG.OTP_LENGTH}
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
                  disabled={resendingOtp || timeRemaining > SECURITY_CONFIG.SESSION_TIMEOUT_WARNING}
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
            © 2025-2026 <strong>{companyName}</strong>. All Rights Reserved
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
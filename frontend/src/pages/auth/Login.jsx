// ============================================
// LOGIN PAGE - FIXED ERROR HANDLING
// Enterprise IT Helpdesk & Ticket Management System
// Developer: Suvadip Panja
// Company: Digitide
// Created: October 11, 2024
// Last Updated: January 26, 2026 - FIXED: Error messages not showing
// Previous Update: January 26, 2026 - Added Forgot Password link
// Previous Update: January 25, 2026 - Added password expiry error handling
// Previous Update: November 11, 2025 - Added 2FA support
// Version: 2.3.0
// Security: OWASP Compliant, JWT, 2FA
// ============================================
// BUG FIX: Login errors (wrong password, account locked, etc.) were not
// displaying on the frontend because there was no else block to handle
// the general failure case in handleSubmit function.
// ============================================

import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Lock, User, Eye, EyeOff, AlertCircle, Shield, Mail, Clock, RefreshCw, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getSetting } from '../../utils/settingsLoader';
import '../../styles/Login.css';

// ============================================
// SECURITY CONFIGURATION
// ============================================
const SECURITY_CONFIG = {
  MAX_USERNAME_LENGTH: 50,
  MAX_PASSWORD_LENGTH: 128,
  MIN_PASSWORD_LENGTH: 6,
  ERROR_DISPLAY_DURATION: 10000, // 10 seconds
  OTP_LENGTH: 6,
  OTP_EXPIRY_MINUTES: 5,
  RESEND_COOLDOWN: 60, // 60 seconds (1 minute)
};

// ============================================
// SESSION STORAGE KEYS
// ============================================
const STORAGE_KEYS = {
  TWO_FACTOR_STATE: 'nexus_2fa_state',
  OTP_TIMER: 'nexus_2fa_timer',
  USERNAME: 'nexus_2fa_username',
};

// ============================================
// INPUT SANITIZATION
// Prevents XSS attacks
// ============================================
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim()
    .substring(0, SECURITY_CONFIG.MAX_USERNAME_LENGTH);
};

// ============================================
// MAIN LOGIN COMPONENT
// ============================================
const Login = () => {
  // ============================================
  // STATE MANAGEMENT
  // ============================================
  
  // Login form state
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // ⭐ Password expiry state
  const [passwordExpired, setPasswordExpired] = useState(false);
  const [passwordExpiredData, setPasswordExpiredData] = useState(null);
  
  // Two-Factor Authentication state
  const [showTwoFactor, setShowTwoFactor] = useState(false);
  const [twoFactorData, setTwoFactorData] = useState(null);
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendingOtp, setResendingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(300);
  
  // System settings
  const [systemName, setSystemName] = useState('Nexus Support');
  const [systemTitle, setSystemTitle] = useState('IT Service Desk');
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  
  // Refs
  const navigate = useNavigate();
  const { login, user } = useAuth();
  const errorTimerRef = useRef(null);
  const otpErrorTimerRef = useRef(null);
  const otpTimerRef = useRef(null);
  const resendTimerRef = useRef(null);
  const hasRestoredState = useRef(false);

  // ============================================
  // REDIRECT IF ALREADY LOGGED IN
  // ============================================
  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // ============================================
  // LOAD SYSTEM SETTINGS
  // ============================================
  useEffect(() => {
    const name = getSetting('system_name', 'Nexus Support');
    const title = getSetting('system_title', 'IT Service Desk');
    const maintenance = getSetting('maintenance_mode', 'false');
    const maintMsg = getSetting('maintenance_message', '');
    
    setSystemName(name);
    setSystemTitle(title);
    setMaintenanceMode(maintenance === 'true' || maintenance === true);
    setMaintenanceMessage(maintMsg);
  }, []);

  // ============================================
  // RESTORE 2FA STATE FROM SESSION STORAGE
  // ============================================
  useEffect(() => {
    if (hasRestoredState.current) return;
    
    try {
      const savedState = sessionStorage.getItem(STORAGE_KEYS.TWO_FACTOR_STATE);
      const savedTimer = sessionStorage.getItem(STORAGE_KEYS.OTP_TIMER);
      const savedUsername = sessionStorage.getItem(STORAGE_KEYS.USERNAME);
      
      if (savedState && savedTimer) {
        const state = JSON.parse(savedState);
        const remaining = parseInt(savedTimer, 10);
        
        if (remaining > 0 && state.userId) {
          hasRestoredState.current = true;
          setTwoFactorData(state);
          setTimeRemaining(remaining);
          setShowTwoFactor(true);
          if (savedUsername) {
            setFormData(prev => ({ ...prev, username: savedUsername }));
          }
        } else {
          sessionStorage.removeItem(STORAGE_KEYS.TWO_FACTOR_STATE);
          sessionStorage.removeItem(STORAGE_KEYS.OTP_TIMER);
          sessionStorage.removeItem(STORAGE_KEYS.USERNAME);
        }
      }
    } catch (e) {
      console.error('Failed to restore 2FA state:', e);
      sessionStorage.removeItem(STORAGE_KEYS.TWO_FACTOR_STATE);
      sessionStorage.removeItem(STORAGE_KEYS.OTP_TIMER);
      sessionStorage.removeItem(STORAGE_KEYS.USERNAME);
    }
  }, []);

  // ============================================
  // PERSIST 2FA STATE TO SESSION STORAGE
  // ============================================
  useEffect(() => {
    if (showTwoFactor && twoFactorData) {
      sessionStorage.setItem(STORAGE_KEYS.TWO_FACTOR_STATE, JSON.stringify(twoFactorData));
      sessionStorage.setItem(STORAGE_KEYS.OTP_TIMER, timeRemaining.toString());
      if (formData.username) {
        sessionStorage.setItem(STORAGE_KEYS.USERNAME, formData.username);
      }
    }
  }, [showTwoFactor, twoFactorData, timeRemaining, formData.username]);

  // ============================================
  // OTP EXPIRY TIMER
  // ============================================
  useEffect(() => {
    if (showTwoFactor && timeRemaining > 0) {
      otpTimerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          const newValue = prev - 1;
          sessionStorage.setItem(STORAGE_KEYS.OTP_TIMER, newValue.toString());
          if (newValue <= 0) {
            clearInterval(otpTimerRef.current);
            setOtpError('Verification code has expired. Please resend.');
          }
          return newValue;
        });
      }, 1000);

      return () => {
        if (otpTimerRef.current) clearInterval(otpTimerRef.current);
      };
    }
  }, [showTwoFactor]);

  // ============================================
  // RESEND COOLDOWN TIMER
  // ============================================
  useEffect(() => {
    if (resendCooldown > 0) {
      resendTimerRef.current = setInterval(() => {
        setResendCooldown(prev => {
          if (prev <= 1) {
            clearInterval(resendTimerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (resendTimerRef.current) clearInterval(resendTimerRef.current);
      };
    }
  }, [resendCooldown]);

  // ============================================
  // CLEANUP ON UNMOUNT
  // ============================================
  useEffect(() => {
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      if (otpErrorTimerRef.current) clearTimeout(otpErrorTimerRef.current);
      if (otpTimerRef.current) clearInterval(otpTimerRef.current);
      if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    };
  }, []);

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================
  
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const setErrorWithTimer = (errorMsg) => {
    setError(errorMsg);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => {
      setError('');
      errorTimerRef.current = null;
    }, SECURITY_CONFIG.ERROR_DISPLAY_DURATION);
  };

  const setOtpErrorWithTimer = (errorMsg) => {
    setOtpError(errorMsg);
    if (otpErrorTimerRef.current) clearTimeout(otpErrorTimerRef.current);
    otpErrorTimerRef.current = setTimeout(() => {
      setOtpError('');
      otpErrorTimerRef.current = null;
    }, SECURITY_CONFIG.ERROR_DISPLAY_DURATION);
  };

  // ============================================
  // FORM HANDLERS
  // ============================================
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const sanitizedValue = sanitizeInput(value);
    setFormData(prev => ({ ...prev, [name]: sanitizedValue }));
    
    // Clear errors on input change
    if (error) setError('');
    if (passwordExpired) {
      setPasswordExpired(false);
      setPasswordExpiredData(null);
    }
  };

  const handleOtpChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').substring(0, SECURITY_CONFIG.OTP_LENGTH);
    setOtpCode(value);
    if (otpError) setOtpError('');
  };

  // ============================================
  // ⭐ SUBMIT HANDLER - FIXED ERROR HANDLING
  // ============================================
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Input validation
    if (!formData.username.trim() || !formData.password.trim()) {
      setErrorWithTimer('Please enter both username and password');
      return;
    }

    if (formData.password.length < SECURITY_CONFIG.MIN_PASSWORD_LENGTH) {
      setErrorWithTimer(`Password must be at least ${SECURITY_CONFIG.MIN_PASSWORD_LENGTH} characters`);
      return;
    }

    setLoading(true);
    setError('');
    setPasswordExpired(false);
    setPasswordExpiredData(null);

    try {
      console.log('🔐 Attempting login for:', formData.username);
      const result = await login(formData.username, formData.password);
      console.log('📋 Login result:', result);
      
      // ============================================
      // ⭐ FIX 1: Check for password expiry in result.data
      // Backend sends: { success: false, message: '...', data: { passwordExpired: true, daysExpired: 5 } }
      // ============================================
      if (result.data?.passwordExpired) {
        console.log('⚠️ Password expired detected');
        setPasswordExpired(true);
        setPasswordExpiredData({
          daysExpired: result.data.daysExpired || 0
        });
        setErrorWithTimer(result.message || 'Your password has expired');
        setLoading(false);
        return;
      }
      
      // ============================================
      // Handle 2FA required
      // ============================================
      if (result.data?.twoFactorRequired || result.twoFactorRequired) {
        console.log('🔐 2FA required');
        hasRestoredState.current = true;
        setTwoFactorData({
          userId: result.data?.userId || result.userId,
          email: result.data?.email || result.email,
          expiryMinutes: result.data?.expiryMinutes || result.expiryMinutes || 5,
          timestamp: Date.now()
        });
        setTimeRemaining(result.data?.expirySeconds || result.expirySeconds || 300);
        setShowTwoFactor(true);
        setOtpCode('');
        setLoading(false);
        return;
      }

      // ============================================
      // Success - redirect to dashboard
      // ============================================
      if (result.success) {
        console.log('✅ Login successful, redirecting to dashboard');
        sessionStorage.clear();
        navigate('/dashboard');
        return;
      }
      
      // ============================================
      // ⭐ FIX 2: Handle FAILED LOGIN (the missing else block!)
      // This is the key fix - previously no error was shown when
      // success: false but not passwordExpired and not twoFactorRequired
      // ============================================
      console.log('❌ Login failed:', result.message);
      setErrorWithTimer(result.message || 'Login failed. Please check your credentials.');

    } catch (err) {
      console.error('❌ Login error (exception):', err);
      
      // ⭐ FIX 3: Better error extraction from caught exceptions
      const errorMessage = 
        err.response?.data?.message || 
        err.message || 
        'Login failed. Please try again.';
      
      setErrorWithTimer(errorMessage);
    } finally {
      setLoading(false);
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

    setVerifyingOtp(true);
    setOtpError('');

    try {
      console.log('🔐 Verifying OTP for user:', twoFactorData?.userId);
      const result = await login(
        formData.username,
        formData.password,
        otpCode,
        twoFactorData.userId
      );

      if (result.success) {
        console.log('✅ OTP verification successful');
        sessionStorage.clear();
        navigate('/dashboard');
      } else {
        console.log('❌ OTP verification failed:', result.message);
        setOtpErrorWithTimer(result.message || 'Invalid verification code');
      }
    } catch (err) {
      console.error('❌ OTP verification error:', err);
      setOtpErrorWithTimer(err.message || 'Verification failed. Please try again.');
    } finally {
      setVerifyingOtp(false);
    }
  };

  // ============================================
  // RESEND OTP HANDLER
  // ============================================
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || resendingOtp) return;

    setResendingOtp(true);
    setOtpError('');

    try {
      console.log('🔄 Resending OTP...');
      const result = await login(formData.username, formData.password);

      if (result.data?.twoFactorRequired || result.twoFactorRequired) {
        console.log('✅ OTP resent successfully');
        setTimeRemaining(result.data?.expirySeconds || result.expirySeconds || 300);
        setResendCooldown(SECURITY_CONFIG.RESEND_COOLDOWN);
        setOtpCode('');
        setTwoFactorData(prev => ({
          ...prev,
          timestamp: Date.now()
        }));
      } else {
        setOtpErrorWithTimer('Failed to resend code. Please try again.');
      }
    } catch (err) {
      console.error('❌ Resend OTP error:', err);
      setOtpErrorWithTimer('Failed to resend code. Please try again.');
    } finally {
      setResendingOtp(false);
    }
  };

  // ============================================
  // BACK TO LOGIN HANDLER
  // ============================================
  const handleBackToLogin = () => {
    sessionStorage.clear();
    setShowTwoFactor(false);
    setTwoFactorData(null);
    setOtpCode('');
    setOtpError('');
    setTimeRemaining(300);
    setResendCooldown(0);
    setFormData({ username: '', password: '' });
    hasRestoredState.current = false;
  };

  // ============================================
  // RENDER COMPONENT
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

        {/* Maintenance Warning */}
        {maintenanceMode && (
          <div className="login-maintenance-warning">
            <AlertCircle size={20} />
            <div>
              <strong>Maintenance Mode</strong>
              <p>{maintenanceMessage || 'System is under maintenance. Some features may be unavailable.'}</p>
            </div>
          </div>
        )}

        {/* ============================================
            ⭐ ERROR MESSAGE DISPLAY - FIXED
            Now properly shows all types of errors
            ============================================ */}
        {error && (
          <div className={`login-error-message ${passwordExpired ? 'login-error-password-expired' : ''}`}>
            <AlertCircle size={18} />
            <div className="login-error-content">
              {/* Password Expiry Error - Special Display */}
              {passwordExpired && passwordExpiredData ? (
                <>
                  <span className="login-error-text">Your password has expired</span>
                  {passwordExpiredData.daysExpired > 0 && (
                    <p className="login-expired-days">
                      Expired {passwordExpiredData.daysExpired} day{passwordExpiredData.daysExpired !== 1 ? 's' : ''} ago
                    </p>
                  )}
                  <p className="login-expired-help">
                    Please contact your administrator to reset your password, or use the "Forgot Password" link below.
                  </p>
                </>
              ) : (
                /* ⭐ General Error Display - This now works properly */
                <span className="login-error-text">{error}</span>
              )}
            </div>
          </div>
        )}

        {/* ==================== NORMAL LOGIN FORM ==================== */}
        {!showTwoFactor && (
          <form onSubmit={handleSubmit} className="login-form">
            
            {/* Username Input */}
            <div className="login-form-group">
              <label className="login-label">Username</label>
              <div className="login-input-wrapper">
                <User size={18} className="login-input-icon" />
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder="Enter your username"
                  className="login-input"
                  required
                  maxLength={SECURITY_CONFIG.MAX_USERNAME_LENGTH}
                  disabled={loading}
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="login-form-group">
              <label className="login-label">Password</label>
              <div className="login-input-wrapper">
                <Lock size={18} className="login-input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
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
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Forgot Password Link */}
            <div className="login-forgot-password">
              <Link to="/forgot-password" className="login-forgot-link">
                Forgot Password?
              </Link>
            </div>

            {/* Submit Button */}
            <button type="submit" className="login-button" disabled={loading}>
              {loading ? (
                <>
                  <Lock size={18} />
                  Authenticating...
                </>
              ) : (
                <>
                  <Lock size={18} />
                  Sign In
                </>
              )}
            </button>
            
          </form>
        )}

        {/* ==================== 2FA OTP FORM ==================== */}
        {showTwoFactor && (
          <div className="login-otp-section">
            
            {/* OTP Heading */}
            <div className="login-otp-heading">
              <Mail size={24} className="login-otp-icon" />
              <div>
                <h3 className="login-otp-title">Verify Your Identity</h3>
                <p className="login-otp-subtitle">Code sent to {twoFactorData?.email || 'your email'}</p>
              </div>
            </div>

            {/* OTP Error Message */}
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
                <label className="login-label">Verification Code</label>
                <input
                  type="text"
                  name="otpCode"
                  value={otpCode}
                  onChange={handleOtpChange}
                  placeholder="000000"
                  className="login-otp-input"
                  required
                  maxLength={SECURITY_CONFIG.OTP_LENGTH}
                  disabled={verifyingOtp || timeRemaining <= 0}
                  autoComplete="off"
                  inputMode="numeric"
                  pattern="[0-9]*"
                />
              </div>

              {/* OTP Timer */}
              <div className="login-otp-timer">
                <Clock size={14} />
                <span>
                  {timeRemaining > 0 
                    ? `Code expires in ${formatTime(timeRemaining)}`
                    : 'Code has expired'}
                </span>
              </div>

              {/* Verify Button */}
              <button 
                type="submit" 
                className="login-button" 
                disabled={verifyingOtp || otpCode.length !== SECURITY_CONFIG.OTP_LENGTH || timeRemaining <= 0}
              >
                {verifyingOtp ? (
                  <>
                    <Shield size={18} />
                    Verifying...
                  </>
                ) : (
                  <>
                    <Shield size={18} />
                    Verify Code
                  </>
                )}
              </button>
            </form>

            {/* OTP Actions */}
            <div className="login-otp-actions">
              {/* Resend OTP */}
              <button
                type="button"
                className="login-otp-link-button"
                onClick={handleResendOtp}
                disabled={resendCooldown > 0 || resendingOtp}
              >
                <RefreshCw size={14} className={resendingOtp ? 'spinning' : ''} />
                {resendingOtp 
                  ? 'Sending...' 
                  : resendCooldown > 0 
                    ? `Resend in ${resendCooldown}s` 
                    : 'Resend Code'}
              </button>

              {/* Back to Login */}
              <button
                type="button"
                className="login-otp-link-button"
                onClick={handleBackToLogin}
              >
                <ArrowLeft size={14} />
                Back to Login
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Login;
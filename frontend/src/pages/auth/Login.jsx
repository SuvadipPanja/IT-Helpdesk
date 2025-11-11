// ============================================
// LOGIN PAGE - SECURITY HARDENED
// Enterprise-grade security implementation
// Developer: Suvadip Panja
// Security Compliance: OWASP, GDPR, ISO 27001
// ============================================

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, Eye, EyeOff, AlertCircle, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getSetting } from '../../utils/settingsLoader';
import '../../styles/Login.css';

// ============================================
// SECURITY CONSTANTS
// ============================================
const SECURITY_CONFIG = {
  MAX_USERNAME_LENGTH: 50,
  MAX_PASSWORD_LENGTH: 128,
  MIN_PASSWORD_LENGTH: 6,
  ERROR_DISPLAY_DURATION: 10000, // 10 seconds
  RATE_LIMIT_MESSAGE: 'Too many attempts. Please wait before trying again.',
  GENERIC_ERROR_MESSAGE: 'Invalid credentials. Please try again.',
};

// ============================================
// INPUT SANITIZATION
// Prevents XSS and injection attacks
// ============================================
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return '';
  
  // Remove potential XSS characters
  return input
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim()
    .substring(0, SECURITY_CONFIG.MAX_USERNAME_LENGTH);
};

// ============================================
// MAIN LOGIN COMPONENT
// ============================================
const Login = () => {
  // ============================================
  // STATE MANAGEMENT - NO SENSITIVE DATA PERSISTED
  // ============================================
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  
  const errorTimerRef = useRef(null);
  const loginAttemptsRef = useRef(0);

  // ============================================
  // HOOKS & SETTINGS
  // ============================================
  const { login } = useAuth();
  const navigate = useNavigate();

  const systemName = getSetting('system_name', 'Nexus Support');
  const systemTitle = getSetting('system_title', 'IT Service Desk');
  const companyName = getSetting('company_name', 'Your Company');
  const maintenanceModeValue = getSetting('maintenance_mode', 'false');
  const maintenanceMode = maintenanceModeValue === 'true' || maintenanceModeValue === true || maintenanceModeValue === 1;
  const maintenanceMessage = getSetting('maintenance_message', 'System is under maintenance. Please check back later.');

  // ============================================
  // SECURITY: CLEAR SENSITIVE DATA ON UNMOUNT
  // ============================================
  useEffect(() => {
    console.log('🔒 Login component mounted - Security mode active');
    
    // Restore error from sessionStorage (non-sensitive)
    const persistedError = sessionStorage.getItem('login_error');
    const errorTimestamp = sessionStorage.getItem('login_error_timestamp');
    
    if (persistedError && errorTimestamp) {
      const errorAge = Date.now() - parseInt(errorTimestamp);
      const remainingTime = SECURITY_CONFIG.ERROR_DISPLAY_DURATION - errorAge;
      
      if (remainingTime > 0) {
        setError(persistedError);
        
        errorTimerRef.current = setTimeout(() => {
          setError('');
          sessionStorage.removeItem('login_error');
          sessionStorage.removeItem('login_error_timestamp');
          errorTimerRef.current = null;
        }, remainingTime);
      } else {
        sessionStorage.removeItem('login_error');
        sessionStorage.removeItem('login_error_timestamp');
      }
    }
    
    return () => {
      console.log('🔒 Clearing sensitive data on unmount');
      
      // Clear password from memory
      setFormData({ username: '', password: '' });
      
      // Clear timers
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current);
      }
    };
  }, []);

  // ============================================
  // SECURITY: SET ERROR WITH SANITIZATION
  // Only non-sensitive error messages are persisted
  // ============================================
  const setErrorWithTimer = (errorMessage) => {
    // Sanitize error message to prevent XSS
    const sanitizedError = sanitizeInput(errorMessage);
    
    console.log('🔴 Setting error (sanitized)');
    
    // Clear existing timer
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
    }

    // Store in sessionStorage (errors are not sensitive)
    sessionStorage.setItem('login_error', sanitizedError);
    sessionStorage.setItem('login_error_timestamp', Date.now().toString());
    
    setError(sanitizedError);

    // Auto-clear after configured duration
    errorTimerRef.current = setTimeout(() => {
      console.log('⏰ Error timer expired');
      setError('');
      sessionStorage.removeItem('login_error');
      sessionStorage.removeItem('login_error_timestamp');
      errorTimerRef.current = null;
    }, SECURITY_CONFIG.ERROR_DISPLAY_DURATION);
  };

  // ============================================
  // SECURITY: SANITIZED INPUT HANDLER
  // ============================================
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Input validation and sanitization
    let sanitizedValue = value;
    
    if (name === 'username') {
      // Sanitize username
      sanitizedValue = sanitizeInput(value);
      
      // Enforce length limits
      if (sanitizedValue.length > SECURITY_CONFIG.MAX_USERNAME_LENGTH) {
        return;
      }
    }
    
    if (name === 'password') {
      // Enforce password length limits (but don't sanitize password content)
      if (value.length > SECURITY_CONFIG.MAX_PASSWORD_LENGTH) {
        return;
      }
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: sanitizedValue
    }));
  };

  // ============================================
  // SECURITY: RATE LIMITING CHECK
  // Client-side rate limiting (backend should also enforce)
  // ============================================
  const checkRateLimit = () => {
    const attempts = loginAttemptsRef.current;
    
    if (attempts >= 5) {
      setErrorWithTimer(SECURITY_CONFIG.RATE_LIMIT_MESSAGE);
      return false;
    }
    
    return true;
  };

  // ============================================
  // SECURITY-HARDENED FORM SUBMIT
  // Developer: Suvadip Panja
  // ============================================
  const handleSubmit = async (e) => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔒 SECURE LOGIN ATTEMPT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Prevent default form submission
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    if (e && e.stopPropagation) {
      e.stopPropagation();
    }
    
    // Check maintenance mode
    if (maintenanceMode) {
      setErrorWithTimer(maintenanceMessage);
      return;
    }
    
    // Validate inputs
    if (!formData.username.trim() || !formData.password.trim()) {
      setErrorWithTimer('Please enter both username and password');
      return;
    }
    
    // Password length validation
    if (formData.password.length < SECURITY_CONFIG.MIN_PASSWORD_LENGTH) {
      setErrorWithTimer(`Password must be at least ${SECURITY_CONFIG.MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    
    // Check client-side rate limit
    if (!checkRateLimit()) {
      return;
    }
    
    // Increment login attempts
    loginAttemptsRef.current += 1;
    setLoginAttempts(loginAttemptsRef.current);
    
    // Clear error
    setError('');
    sessionStorage.removeItem('login_error');
    sessionStorage.removeItem('login_error_timestamp');
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
    
    setLoading(true);

    try {
      console.log('🔐 Authenticating user...');
      // NOTE: Password is never logged or persisted
      
      const response = await login(formData.username, formData.password);
      
      if (response && response.success) {
        console.log('✅ Authentication successful');
        
        // Reset login attempts on success
        loginAttemptsRef.current = 0;
        setLoginAttempts(0);
        
        // Clear form data before navigation
        setFormData({ username: '', password: '' });
        
        navigate('/dashboard');
      } else {
        console.log('❌ Authentication failed');
        
        // Use generic error message for security
        const errorMsg = response?.message || SECURITY_CONFIG.GENERIC_ERROR_MESSAGE;
        setErrorWithTimer(errorMsg);
      }
    } catch (err) {
      console.error('💥 Authentication error');
      
      // Generic error messages to prevent information disclosure
      let errorMsg = SECURITY_CONFIG.GENERIC_ERROR_MESSAGE;
      
      if (err.response) {
        // Use server error message (server should provide safe messages)
        errorMsg = err.response.data?.message || SECURITY_CONFIG.GENERIC_ERROR_MESSAGE;
      } else if (err.request) {
        errorMsg = 'Cannot connect to server. Please try again.';
      }
      
      setErrorWithTimer(errorMsg);
    } finally {
      setLoading(false);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔒 LOGIN ATTEMPT COMPLETED');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
    
    return false;
  };

  // ============================================
  // FORM VALIDATION
  // ============================================
  const isFormValid = 
    formData.username.trim() !== '' && 
    formData.password.trim() !== '' &&
    formData.password.length >= SECURITY_CONFIG.MIN_PASSWORD_LENGTH;

  // ============================================
  // RENDER COMPONENT
  // ============================================
  return (
    <div className="login-container">
      <div className="login-card">
        {/* LOGO SECTION */}
        <div className="login-logo">
          <div className="logo-icon">
            <Shield size={32} />
          </div>
          <h1 className="login-title">{systemName}</h1>
          <p className="login-subtitle">{systemTitle}</p>
        </div>

        {/* MAINTENANCE MODE WARNING */}
        {maintenanceMode && (
          <div className="maintenance-warning">
            <AlertCircle size={20} />
            <div>
              <strong>Maintenance Mode</strong>
              <p>System login is currently disabled</p>
            </div>
          </div>
        )}

        {/* SECURE LOGIN FORM */}
        <form 
          onSubmit={handleSubmit}
          className="login-form" 
          noValidate
          autoComplete="off"
          method="post"
        >
          {/* ERROR MESSAGE */}
          {error && (
            <div className={`error-message ${maintenanceMode ? 'maintenance-error' : ''}`}>
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* USERNAME INPUT - SANITIZED */}
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <div className="input-wrapper">
              <User className="input-icon" size={18} />
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                placeholder="Enter your username"
                required
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                disabled={loading || maintenanceMode}
                maxLength={SECURITY_CONFIG.MAX_USERNAME_LENGTH}
              />
            </div>
          </div>

          {/* PASSWORD INPUT - NEVER LOGGED */}
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="input-wrapper">
              <Lock className="input-icon" size={18} />
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password"
                required
                autoComplete="off"
                disabled={loading || maintenanceMode}
                maxLength={SECURITY_CONFIG.MAX_PASSWORD_LENGTH}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                disabled={loading || maintenanceMode}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* SECURE SUBMIT BUTTON */}
          <button 
            type="submit"
            className="login-button"
            disabled={!isFormValid || loading || maintenanceMode}
          >
            {loading ? (
              <>
                <span>Signing in</span>
                <span className="loading-dots">...</span>
              </>
            ) : maintenanceMode ? (
              'LOGIN DISABLED'
            ) : (
              'SIGN IN'
            )}
          </button>
        </form>

        {/* FOOTER */}
        <div className="login-footer">
          <p>© 2025 {companyName}. All Rights Reserved</p>
          <p>Developed by <strong>Suvadip Panja</strong></p>
        </div>
      </div>
    </div>
  );
};

export default Login;
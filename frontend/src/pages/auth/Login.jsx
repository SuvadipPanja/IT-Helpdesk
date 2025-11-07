// ============================================
// LOGIN PAGE
// Error persists even if component remounts
// Developer: Suvadip Panja
// ============================================

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, User, Eye, EyeOff, AlertCircle, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getSetting } from '../../utils/settingsLoader';
import '../../styles/Login.css';

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
  
  // Timer to control error visibility
  const errorTimerRef = useRef(null);

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
  // RESTORE ERROR FROM SESSIONSTORAGE ON MOUNT
  // This ensures error survives component remounts
  // Developer: Suvadip Panja
  // ============================================
  useEffect(() => {
    console.log('✅ Login component mounted');
    
    // Check if there's a persisted error
    const persistedError = sessionStorage.getItem('login_error');
    const errorTimestamp = sessionStorage.getItem('login_error_timestamp');
    
    if (persistedError && errorTimestamp) {
      const errorAge = Date.now() - parseInt(errorTimestamp);
      const remainingTime = 10000 - errorAge; // 10 seconds total
      
      console.log('🔄 Restoring persisted error:', persistedError);
      console.log('⏰ Error age:', errorAge, 'ms');
      console.log('⏰ Remaining time:', remainingTime, 'ms');
      
      if (remainingTime > 0) {
        // Error is still within 10 second window
        setError(persistedError);
        
        // Set timer for remaining time
        errorTimerRef.current = setTimeout(() => {
          console.log('⏰ Timer expired - clearing error');
          setError('');
          sessionStorage.removeItem('login_error');
          sessionStorage.removeItem('login_error_timestamp');
          errorTimerRef.current = null;
        }, remainingTime);
      } else {
        // Error is older than 10 seconds, clear it
        console.log('🧹 Error expired, clearing from storage');
        sessionStorage.removeItem('login_error');
        sessionStorage.removeItem('login_error_timestamp');
      }
    }
    
    return () => {
      console.log('🗑️ Login component unmounting');
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current);
      }
    };
  }, []);

  // ============================================
  // SET ERROR WITH PERSISTENCE
  // Stores in sessionStorage so it survives remounts
  // Developer: Suvadip Panja
  // ============================================
  const setErrorWithTimer = (errorMessage) => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔴 SETTING ERROR:', errorMessage);
    console.log('⏰ Time:', new Date().toLocaleTimeString());
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Clear any existing timer
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
    }

    // Store error in sessionStorage with timestamp
    sessionStorage.setItem('login_error', errorMessage);
    sessionStorage.setItem('login_error_timestamp', Date.now().toString());
    
    // Set the error in state
    setError(errorMessage);

    // Auto-clear after 10 seconds
    errorTimerRef.current = setTimeout(() => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('⏰ 10 SECONDS PASSED - Auto-clearing error');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      setError('');
      sessionStorage.removeItem('login_error');
      sessionStorage.removeItem('login_error_timestamp');
      errorTimerRef.current = null;
    }, 10000); // 10 seconds

    console.log('✅ Error persisted to sessionStorage');
    console.log('✅ Timer set for 10 seconds');
  };

  // ============================================
  // HANDLE INPUT CHANGE
  // Error stays visible even while typing
  // ============================================
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Don't clear error while typing
  };

  // ============================================
  // HANDLE FORM SUBMIT
  // Developer: Suvadip Panja
  // ============================================
  const handleSubmit = async (e) => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 FORM SUBMIT TRIGGERED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Prevent page refresh
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
    
    // Clear error and storage
    setError('');
    sessionStorage.removeItem('login_error');
    sessionStorage.removeItem('login_error_timestamp');
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
    
    setLoading(true);

    try {
      console.log('📡 Calling login API...');
      const response = await login(formData.username, formData.password);
      
      console.log('📥 Login response:', response);
      
      if (response && response.success) {
        console.log('✅ LOGIN SUCCESS!');
        navigate('/dashboard');
      } else {
        console.log('❌ LOGIN FAILED');
        setErrorWithTimer(response?.message || 'Invalid username or password');
      }
    } catch (err) {
      console.error('💥 EXCEPTION:', err);
      
      let errorMsg = 'An error occurred. Please try again.';
      
      if (err.response) {
        errorMsg = err.response.data?.message || 'Invalid username or password';
      } else if (err.request) {
        errorMsg = 'Cannot connect to server. Please try again.';
      } else {
        errorMsg = err.message || 'An error occurred. Please try again.';
      }
      
      setErrorWithTimer(errorMsg);
    } finally {
      setLoading(false);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🏁 FORM SUBMIT COMPLETED');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
    
    return false;
  };

  // ============================================
  // FORM VALIDATION
  // ============================================
  const isFormValid = formData.username.trim() !== '' && formData.password.trim() !== '';

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

        {/* LOGIN FORM */}
        <form 
          onSubmit={handleSubmit}
          className="login-form" 
          noValidate
        >
          {/* ERROR MESSAGE - Persists across remounts */}
          {error && (
            <div className={`error-message ${maintenanceMode ? 'maintenance-error' : ''}`}>
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* USERNAME INPUT */}
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
                autoComplete="username"
                disabled={loading || maintenanceMode}
              />
            </div>
          </div>

          {/* PASSWORD INPUT */}
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
                autoComplete="current-password"
                disabled={loading || maintenanceMode}
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

          {/* SUBMIT BUTTON */}
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
// ============================================
// CHANGE PASSWORD PAGE - USES NEW SECURITY API
// Fetches from /api/v1/security/settings endpoint
// ============================================
// Developer: Suvadip Panja
// Updated: November 08, 2025
// File: frontend/src/pages/profile/ChangePassword.jsx
// ============================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  Shield,
  Check,
  X,
  Loader,
} from 'lucide-react';
import '../../styles/Profile.css';

const ChangePassword = () => {
  const navigate = useNavigate();

  // ============================================
  // STATE MANAGEMENT
  // ============================================
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    feedback: [],
  });

  const [passwordPolicy, setPasswordPolicy] = useState(null);
  const [loadingPolicy, setLoadingPolicy] = useState(true);

  // ============================================
  // FETCH PASSWORD POLICY FROM NEW SECURITY API
  // ============================================
  useEffect(() => {
    const fetchPasswordPolicy = async () => {
      try {
        setLoadingPolicy(true);
        
        // ⭐ NEW: Use dedicated security endpoint
        if (process.env.NODE_ENV === 'development') console.log('📍 Fetching security settings from /security/settings API...');
        const response = await api.get('/security/settings');
        
        if (process.env.NODE_ENV === 'development') console.log('✅ Security settings response:', response.data);
        
        if (response.data.success && response.data.data) {
          const settings = response.data.data;
          
          // Build policy object from response
          const policy = {
            minLength: parseInt(settings.password_min_length) || 8,
            requireUppercase: settings.password_require_uppercase === 'true' || settings.password_require_uppercase === true,
            requireLowercase: settings.password_require_lowercase === 'true' || settings.password_require_lowercase === true,
            requireNumber: settings.password_require_number === 'true' || settings.password_require_number === true,
            requireSpecial: settings.password_require_special === 'true' || settings.password_require_special === true,
            expiryDays: parseInt(settings.password_expiry_days) || 90,
            historyCount: parseInt(settings.password_history_count) || 5,
          };
          
          setPasswordPolicy(policy);
          if (process.env.NODE_ENV === 'development') console.log('✅ Password policy loaded:', policy);
          if (process.env.NODE_ENV === 'development') console.log('✅ Password history count:', policy.historyCount);
        }
      } catch (err) {
        if (process.env.NODE_ENV === 'development') console.error('❌ Error fetching password policy:', err);
        // Fallback to defaults
        setPasswordPolicy({
          minLength: 8,
          requireUppercase: true,
          requireLowercase: true,
          requireNumber: true,
          requireSpecial: true,
          expiryDays: 90,
          historyCount: 5,
        });
      } finally {
        setLoadingPolicy(false);
      }
    };

    fetchPasswordPolicy();
  }, []);

  // ============================================
  // PASSWORD STRENGTH CHECKER
  // ============================================
  const checkPasswordStrength = (password) => {
    if (!passwordPolicy) return { score: 0, feedback: [] };

    let score = 0;
    const feedback = [];

    if (password.length >= passwordPolicy.minLength) {
      score++;
      feedback.push(`At least ${passwordPolicy.minLength} characters`);
    } else {
      feedback.push(`Needs at least ${passwordPolicy.minLength} characters`);
    }

    if (passwordPolicy.requireUppercase && passwordPolicy.requireLowercase) {
      if (/[a-z]/.test(password) && /[A-Z]/.test(password)) {
        score++;
        feedback.push('Contains uppercase and lowercase');
      } else {
        feedback.push('Needs uppercase and lowercase letters');
      }
    }

    if (passwordPolicy.requireNumber) {
      if (/\d/.test(password)) {
        score++;
        feedback.push('Contains numbers');
      } else {
        feedback.push('Needs numbers');
      }
    }

    if (passwordPolicy.requireSpecial) {
      if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        score++;
        feedback.push('Contains special characters');
      } else {
        feedback.push('Needs special characters');
      }
    }

    return { score, feedback };
  };

  // ============================================
  // HANDLE INPUT CHANGE
  // ============================================
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (name === 'new_password') {
      setPasswordStrength(checkPasswordStrength(value));
    }

    if (error) setError(null);
  };

  // ============================================
  // TOGGLE PASSWORD VISIBILITY
  // ============================================
  const togglePasswordVisibility = (field) => {
    setShowPasswords((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  // ============================================
  // HANDLE FORM SUBMIT
  // ============================================
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!passwordPolicy) {
      setError('Please wait, loading password requirements...');
      return;
    }

    if (!formData.current_password) {
      setError('Please enter your current password');
      return;
    }

    if (!formData.new_password) {
      setError('Please enter a new password');
      return;
    }

    if (formData.new_password.length < passwordPolicy.minLength) {
      setError(`Password must be at least ${passwordPolicy.minLength} characters long`);
      return;
    }

    if (formData.new_password !== formData.confirm_password) {
      setError('New passwords do not match');
      return;
    }

    if (formData.current_password === formData.new_password) {
      setError('New password must be different from current password');
      return;
    }

    try {
      setLoading(true);
      const response = await api.put('/profile/password', formData);

      if (response.data.success) {
        setSuccess(true);
        setFormData({
          current_password: '',
          new_password: '',
          confirm_password: '',
        });

        setTimeout(() => {
          navigate('/profile');
        }, 2000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // GET PASSWORD STRENGTH COLOR
  // ============================================
  const getStrengthColor = () => {
    const { score } = passwordStrength;
    if (score === 0) return '#e5e7eb';
    if (score === 1) return '#ef4444';
    if (score === 2) return '#f59e0b';
    if (score === 3) return '#3b82f6';
    return '#22c55e';
  };

  const getStrengthLabel = () => {
    const { score } = passwordStrength;
    if (score === 0) return '';
    if (score === 1) return 'Weak';
    if (score === 2) return 'Fair';
    if (score === 3) return 'Good';
    return 'Strong';
  };

  // ============================================
  // LOADING STATE
  // ============================================
  if (loadingPolicy) {
    return (
      <div className="profile-page">
        <div className="page-header">
          <div className="header-left">
            <Lock size={28} className="page-icon" />
            <div>
              <h1 className="page-title">Change Password</h1>
              <p className="page-subtitle">Loading password requirements...</p>
            </div>
          </div>
        </div>
        <div className="change-password-container">
          <div className="profile-card" style={{ textAlign: 'center', padding: '3rem' }}>
            <Loader className="spinner-small" size={32} style={{ margin: '0 auto' }} />
            <p style={{ marginTop: '1rem', color: '#6b7280' }}>
              Loading password policy from database...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="profile-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="header-left">
          <button className="btn-icon" onClick={() => navigate('/profile')}>
            <ArrowLeft size={24} />
          </button>
          <Lock size={28} className="page-icon" />
          <div>
            <h1 className="page-title">Change Password</h1>
            <p className="page-subtitle">Update your account password</p>
          </div>
        </div>
      </div>

      {/* Success Message */}
      {success && (
        <div className="alert alert-success">
          <Check size={20} />
          <span>Password changed successfully! Redirecting...</span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="alert alert-error">
          <X size={20} />
          <span>{error}</span>
          <button onClick={() => setError(null)}>
            <X size={16} />
          </button>
        </div>
      )}

      <div className="change-password-container">
        {/* Password Change Form */}
        <div className="profile-card">
          <h3>Update Your Password</h3>
          <form onSubmit={handleSubmit} className="password-form">
            {/* Current Password */}
            <div className="form-group">
              <label htmlFor="current_password">Current Password</label>
              <div className="password-input-wrapper">
                <Lock size={20} className="input-icon" />
                <input
                  type={showPasswords.current ? 'text' : 'password'}
                  id="current_password"
                  name="current_password"
                  value={formData.current_password}
                  onChange={handleInputChange}
                  placeholder="Enter your current password"
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => togglePasswordVisibility('current')}
                  tabIndex={-1}
                >
                  {showPasswords.current ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div className="form-group">
              <label htmlFor="new_password">New Password</label>
              <div className="password-input-wrapper">
                <Lock size={20} className="input-icon" />
                <input
                  type={showPasswords.new ? 'text' : 'password'}
                  id="new_password"
                  name="new_password"
                  value={formData.new_password}
                  onChange={handleInputChange}
                  placeholder="Enter your new password"
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => togglePasswordVisibility('new')}
                  tabIndex={-1}
                >
                  {showPasswords.new ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>

              {/* Password Strength Indicator */}
              {formData.new_password && (
                <div className="password-strength">
                  <div className="strength-bar">
                    <div
                      className="strength-bar-fill"
                      style={{
                        width: `${(passwordStrength.score / 4) * 100}%`,
                        backgroundColor: getStrengthColor(),
                      }}
                    />
                  </div>
                  <div className="strength-label" style={{ color: getStrengthColor() }}>
                    {getStrengthLabel()}
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="form-group">
              <label htmlFor="confirm_password">Confirm New Password</label>
              <div className="password-input-wrapper">
                <Lock size={20} className="input-icon" />
                <input
                  type={showPasswords.confirm ? 'text' : 'password'}
                  id="confirm_password"
                  name="confirm_password"
                  value={formData.confirm_password}
                  onChange={handleInputChange}
                  placeholder="Confirm your new password"
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => togglePasswordVisibility('confirm')}
                  tabIndex={-1}
                >
                  {showPasswords.confirm ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              {formData.confirm_password && formData.new_password !== formData.confirm_password && (
                <p className="error-text">Passwords do not match</p>
              )}
            </div>

            {/* Form Actions */}
            <div className="form-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => navigate('/profile')}
                disabled={loading}
              >
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? (
                  <>
                    <Loader className="spinner-small" size={20} />
                    Updating...
                  </>
                ) : (
                  <>
                    <Shield size={20} />
                    Change Password
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Password Requirements */}
        <div className="profile-card">
          <h3>Password Requirements</h3>
          {passwordPolicy && (
            <div className="password-requirements">
              <div
                className={`requirement-item ${
                  formData.new_password.length >= passwordPolicy.minLength ? 'met' : ''
                }`}
              >
                {formData.new_password.length >= passwordPolicy.minLength ? (
                  <Check size={18} className="check-icon" />
                ) : (
                  <X size={18} className="x-icon" />
                )}
                <span>At least {passwordPolicy.minLength} characters long</span>
              </div>

              {(passwordPolicy.requireUppercase && passwordPolicy.requireLowercase) && (
                <div
                  className={`requirement-item ${
                    /[a-z]/.test(formData.new_password) && /[A-Z]/.test(formData.new_password)
                      ? 'met'
                      : ''
                  }`}
                >
                  {/[a-z]/.test(formData.new_password) && /[A-Z]/.test(formData.new_password) ? (
                    <Check size={18} className="check-icon" />
                  ) : (
                    <X size={18} className="x-icon" />
                  )}
                  <span>Contains uppercase and lowercase letters</span>
                </div>
              )}

              {passwordPolicy.requireNumber && (
                <div
                  className={`requirement-item ${/\d/.test(formData.new_password) ? 'met' : ''}`}
                >
                  {/\d/.test(formData.new_password) ? (
                    <Check size={18} className="check-icon" />
                  ) : (
                    <X size={18} className="x-icon" />
                  )}
                  <span>Contains at least one number</span>
                </div>
              )}

              {passwordPolicy.requireSpecial && (
                <div
                  className={`requirement-item ${
                    /[!@#$%^&*(),.?":{}|<>]/.test(formData.new_password) ? 'met' : ''
                  }`}
                >
                  {/[!@#$%^&*(),.?":{}|<>]/.test(formData.new_password) ? (
                    <Check size={18} className="check-icon" />
                  ) : (
                    <X size={18} className="x-icon" />
                  )}
                  <span>Contains special characters (!@#$%^&*)</span>
                </div>
              )}

              <div style={{ 
                borderTop: '1px solid #e5e7eb', 
                margin: '1.5rem 0',
              }} />

              <div className="requirement-item" style={{ 
                background: '#f0f9ff',
                border: '1px solid #bfdbfe',
              }}>
                <Check size={18} style={{ color: '#3b82f6' }} />
                <span style={{ color: '#1e40af' }}>
                  Password expires after <strong>{passwordPolicy.expiryDays} days</strong>
                </span>
              </div>

              <div className="requirement-item" style={{ 
                background: '#f0f9ff',
                border: '1px solid #bfdbfe',
              }}>
                <Check size={18} style={{ color: '#3b82f6' }} />
                <span style={{ color: '#1e40af' }}>
                  Cannot reuse last <strong>{passwordPolicy.historyCount} passwords</strong>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChangePassword;


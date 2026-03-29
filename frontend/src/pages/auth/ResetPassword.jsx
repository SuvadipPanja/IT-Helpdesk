// ============================================
// RESET PASSWORD PAGE - MODERN REDESIGN
// Dark glass design consistent with Login & ForgotPassword
// Security: Strong validation, strength meter, honeypot
// File: frontend/src/pages/auth/ResetPassword.jsx
// ============================================

import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Lock, Eye, EyeOff, Check, X, AlertCircle, Loader, Shield, ArrowLeft, Clock } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api';
import '../../styles/ResetPassword.css';

const PASSWORD_RULES = [
  { id: 'len',   label: 'At least 8 characters',          test: (p) => p.length >= 8 },
  { id: 'upper', label: 'One uppercase letter',            test: (p) => /[A-Z]/.test(p) },
  { id: 'lower', label: 'One lowercase letter',            test: (p) => /[a-z]/.test(p) },
  { id: 'num',   label: 'One number',                      test: (p) => /\d/.test(p) },
  { id: 'spec',  label: 'One special character (!@#$...)',  test: (p) => /[^a-zA-Z0-9]/.test(p) },
];

const getStrength = (pw) => {
  if (!pw) return { score: 0, label: '', cls: '' };
  const passed = PASSWORD_RULES.filter((r) => r.test(pw)).length;
  const map = [
    { score: 0, label: '',            cls: '' },
    { score: 1, label: 'Very Weak',   cls: 'rp-str-1' },
    { score: 2, label: 'Weak',        cls: 'rp-str-2' },
    { score: 3, label: 'Fair',        cls: 'rp-str-3' },
    { score: 4, label: 'Strong',      cls: 'rp-str-4' },
    { score: 5, label: 'Very Strong', cls: 'rp-str-5' },
  ];
  return map[passed];
};

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const isExpiredPassword = searchParams.get('expired') === 'true';
  const honeypotRef = useRef('');

  const toast = useToast();

  const [formData, setFormData] = useState({ newPassword: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [validatingToken, setValidatingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState('');
  const [userInfo, setUserInfo] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Validate token on mount
  useEffect(() => {
    (async () => {
      if (!token) {
        setTokenError('Invalid reset link. Please request a new one.');
        toast.error('Invalid reset link. Please request a new one.');
        setValidatingToken(false);
        return;
      }
      try {
        const res = await api.get(`/auth/validate-reset-token/${token}`);
        if (res.data.success && res.data.data?.isValid) {
          setTokenValid(true);
          setUserInfo(res.data.data);
        } else {
          const msg = res.data.message || 'Invalid or expired reset link';
          setTokenError(msg);
          toast.error(msg);
        }
      } catch (err) {
        const msg = err.response?.data?.message || 'Invalid or expired reset link. Please request a new one.';
        setTokenError(msg);
        toast.error(msg);
      } finally {
        setValidatingToken(false);
      }
    })();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const strength = getStrength(formData.newPassword);
  const allRulesMet = PASSWORD_RULES.every((r) => r.test(formData.newPassword));
  const passwordsMatch = formData.newPassword && formData.confirmPassword && formData.newPassword === formData.confirmPassword;
  const canSubmit = allRulesMet && passwordsMatch && !loading;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (honeypotRef.current) return;

    if (!passwordsMatch) {
      setError('Passwords do not match');
      toast.error('Passwords do not match');
      return;
    }
    if (!allRulesMet) {
      setError('Please meet all password requirements');
      toast.error('Please meet all password requirements');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/reset-password', {
        token,
        newPassword: formData.newPassword,
        confirmPassword: formData.confirmPassword,
      });
      if (res.data.success) {
        setSuccess(true);
        toast.success('Password reset successful! Redirecting to login...');
        setTimeout(() => {
          navigate('/login', { state: { message: 'Password reset successful! Please login with your new password.' } });
        }, 3000);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to reset password. Please try again.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // ── Loading state ──
  if (validatingToken) {
    return (
      <div className="rp-page">
        <div className="rp-card rp-card-center">
          <Loader className="rp-spin" size={36} />
          <p className="rp-loading-text">Validating reset link...</p>
        </div>
      </div>
    );
  }

  // ── Invalid token ──
  if (!tokenValid) {
    return (
      <div className="rp-page">
        <div className="rp-card rp-card-center">
          <div className="rp-icon-ring rp-icon-ring-error">
            <AlertCircle size={36} />
          </div>
          <h2 className="rp-title">Invalid Reset Link</h2>
          <p className="rp-desc">{tokenError}</p>
          <div className="rp-action-row">
            <Link to="/forgot-password" className="rp-btn rp-btn-primary">
              Request New Link
            </Link>
            <Link to="/login" className="rp-btn rp-btn-ghost">
              <ArrowLeft size={16} /> Back to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Success state ──
  if (success) {
    return (
      <div className="rp-page">
        <div className="rp-card rp-card-center">
          <div className="rp-icon-ring rp-icon-ring-success">
            <Check size={36} strokeWidth={3} />
          </div>
          <h2 className="rp-title">Password Reset Successful!</h2>
          <p className="rp-desc">
            Your password has been updated. Redirecting to login...
          </p>
          <Link to="/login" className="rp-btn rp-btn-primary">
            Login Now
          </Link>
        </div>
      </div>
    );
  }

  // ── Reset form ──
  return (
    <div className="rp-page">
      <div className="rp-card">
        {/* Header */}
        <div className="rp-header">
          <div className="rp-logo-icon">
            <Lock size={28} />
          </div>
          <h1 className="rp-title">Reset Password</h1>
          {userInfo && (
            <p className="rp-user-email">
              Resetting for <strong>{userInfo.email}</strong>
            </p>
          )}
        </div>

        {/* Expired password banner */}
        {isExpiredPassword && (
          <div className="rp-expired-banner">
            <Clock size={16} />
            <div>
              <strong>Your password has expired</strong>
              <span>Please create a new password to continue.</span>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="rp-form" noValidate>
          {error && (
            <div className="rp-error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Honeypot */}
          <input
            type="text"
            name="company_url"
            tabIndex={-1}
            autoComplete="off"
            style={{ position: 'absolute', left: '-9999px', opacity: 0 }}
            onChange={(e) => { honeypotRef.current = e.target.value; }}
          />

          {/* New Password */}
          <div className="rp-field">
            <label className="rp-label" htmlFor="rp-newPassword">New Password</label>
            <div className="rp-input-wrap">
              <Lock size={18} className="rp-input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                id="rp-newPassword"
                name="newPassword"
                value={formData.newPassword}
                onChange={handleChange}
                placeholder="Create a strong password"
                required
                disabled={loading}
                autoFocus
                autoComplete="new-password"
              />
              <button
                type="button"
                className="rp-toggle-vis"
                onClick={() => setShowPassword((p) => !p)}
                tabIndex={-1}
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Strength bar */}
            {formData.newPassword && (
              <div className="rp-strength">
                <div className="rp-strength-track">
                  <div className={`rp-strength-fill ${strength.cls}`} style={{ width: `${(strength.score / 5) * 100}%` }} />
                </div>
                <span className={`rp-strength-label ${strength.cls}`}>{strength.label}</span>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div className="rp-field">
            <label className="rp-label" htmlFor="rp-confirmPassword">Confirm Password</label>
            <div className={`rp-input-wrap ${formData.confirmPassword ? (passwordsMatch ? 'rp-input-valid' : 'rp-input-invalid') : ''}`}>
              <Lock size={18} className="rp-input-icon" />
              <input
                type={showConfirm ? 'text' : 'password'}
                id="rp-confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Re-enter your password"
                required
                disabled={loading}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="rp-toggle-vis"
                onClick={() => setShowConfirm((p) => !p)}
                tabIndex={-1}
                aria-label="Toggle confirm password visibility"
              >
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {formData.confirmPassword && (
              <span className={`rp-match ${passwordsMatch ? 'rp-match-ok' : 'rp-match-no'}`}>
                {passwordsMatch ? <><Check size={13} /> Passwords match</> : <><X size={13} /> Passwords do not match</>}
              </span>
            )}
          </div>

          {/* Requirements checklist */}
          <div className="rp-requirements">
            <p className="rp-req-title">
              <Shield size={14} /> Password requirements
            </p>
            <ul className="rp-req-list">
              {PASSWORD_RULES.map((r) => (
                <li key={r.id} className={r.test(formData.newPassword) ? 'rp-req-met' : ''}>
                  {r.test(formData.newPassword) ? <Check size={13} /> : <X size={13} />}
                  {r.label}
                </li>
              ))}
            </ul>
          </div>

          <button
            type="submit"
            className="rp-btn rp-btn-submit"
            disabled={!canSubmit}
          >
            {loading ? (
              <>
                <span className="rp-spinner" />
                Resetting...
              </>
            ) : (
              <>
                <Lock size={18} />
                Reset Password
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="rp-footer">
          <Link to="/login" className="rp-link-back">
            <ArrowLeft size={16} /> Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
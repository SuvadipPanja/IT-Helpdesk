// ============================================
// FORGOT PASSWORD PAGE - MODERN REDESIGN
// Consistent dark glass design matching Login page
// Security: Rate-limit awareness, honeypot, validation
// File: frontend/src/pages/auth/ForgotPassword.jsx
// ============================================

import { useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Send, Check, Shield, Clock, AlertCircle } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api';
import '../../styles/ForgotPassword.css';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const honeypotRef = useRef('');
  const cooldownRef = useRef(null);

  const toast = useToast();

  // Email validation
  const isValidEmail = (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);

  // Cooldown timer
  const startCooldown = useCallback((seconds) => {
    setCooldown(seconds);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) { clearInterval(cooldownRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Honeypot check (bot prevention)
    if (honeypotRef.current) return;

    // Client-side email validation
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    // Rate limit check
    if (cooldown > 0) {
      setError(`Please wait ${cooldown}s before trying again.`);
      return;
    }

    setLoading(true);

    try {
      const response = await api.post('/auth/forgot-password', { email });

      if (response.data.success) {
        setSuccess(true);
        setEmail('');
        toast.success('Password reset link sent! Check your email.');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to send reset email. Please try again.';
      setError(errorMessage);
      toast.error(errorMessage);

      // Progressive cooldown after repeated attempts
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      if (newAttempts >= 3) {
        const wait = Math.min(newAttempts * 10, 60);
        startCooldown(wait);
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="fp-page">
        <div className="fp-card fp-card-success">
          <div className="fp-success-icon">
            <div className="fp-icon-ring"><Check size={36} strokeWidth={3} /></div>
          </div>
          <h2 className="fp-title">Check Your Email</h2>
          <p className="fp-desc">
            If an account exists with that email address, we've sent a password
            reset link. Please check your inbox and spam folder.
          </p>
          <div className="fp-info-banner">
            <Clock size={16} />
            <span>The reset link expires in <strong>1 hour</strong> for security.</span>
          </div>
          <div className="fp-security-tips">
            <Shield size={14} />
            <span>Don't share your reset link with anyone.</span>
          </div>
          <Link to="/login" className="fp-btn fp-btn-primary">
            <ArrowLeft size={18} />
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fp-page">
      <div className="fp-card">
        {/* Header */}
        <div className="fp-header">
          <div className="fp-logo-icon">
            <Mail size={28} />
          </div>
          <h1 className="fp-title">Forgot Password?</h1>
          <p className="fp-desc">
            Enter your registered email address and we'll send you a secure link to reset your password.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="fp-form" noValidate>
          {error && (
            <div className="fp-error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Honeypot - hidden from users, catches bots */}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            style={{ position: 'absolute', left: '-9999px', opacity: 0 }}
            onChange={(e) => { honeypotRef.current = e.target.value; }}
          />

          <div className="fp-field">
            <label htmlFor="fp-email" className="fp-label">Email Address</label>
            <div className={`fp-input-wrap ${email && !isValidEmail(email) ? 'fp-input-invalid' : ''} ${email && isValidEmail(email) ? 'fp-input-valid' : ''}`}>
              <Mail size={18} className="fp-input-icon" />
              <input
                type="email"
                id="fp-email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                placeholder="name@company.com"
                required
                disabled={loading || cooldown > 0}
                autoFocus
                autoComplete="email"
              />
            </div>
            {email && !isValidEmail(email) && (
              <span className="fp-field-hint fp-field-hint-error">Please enter a valid email address</span>
            )}
          </div>

          <button
            type="submit"
            className="fp-btn fp-btn-submit"
            disabled={loading || !email || !isValidEmail(email) || cooldown > 0}
          >
            {loading ? (
              <>
                <span className="fp-spinner" />
                Sending...
              </>
            ) : cooldown > 0 ? (
              <>
                <Clock size={18} />
                Wait {cooldown}s
              </>
            ) : (
              <>
                <Send size={18} />
                Send Reset Link
              </>
            )}
          </button>
        </form>

        {/* Security note */}
        <div className="fp-security-note">
          <Shield size={14} />
          <span>We'll never ask for your password via email.</span>
        </div>

        {/* Footer */}
        <div className="fp-footer">
          <Link to="/login" className="fp-link-back">
            <ArrowLeft size={16} />
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
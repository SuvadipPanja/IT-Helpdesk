// ============================================
// FORGOT PASSWORD PAGE
// Users enter email to receive password reset link
// Developer: Suvadip Panja
// Date: January 26, 2026
// ============================================

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Send, Check } from 'lucide-react';
import api from '../../services/api';
import '../../styles/ForgotPassword.css';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/auth/forgot-password', { email });

      if (response.data.success) {
        setSuccess(true);
        setEmail(''); // Clear form
      }
    } catch (err) {
      console.error('Forgot password error:', err);
      setError(
        err.response?.data?.message || 
        'Failed to send reset email. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="forgot-password-page">
        <div className="forgot-password-container">
          <div className="success-message-box">
            <div className="success-icon">
              <Check size={48} />
            </div>
            <h2>Check Your Email!</h2>
            <p>
              If an account exists with that email address, we've sent a password 
              reset link. Please check your inbox and follow the instructions.
            </p>
            <div className="info-note">
              <strong>Note:</strong> The reset link will expire in 1 hour for security reasons.
            </div>
            <div className="success-actions">
              <Link to="/login" className="btn-back-to-login">
                <ArrowLeft size={18} />
                Back to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="forgot-password-page">
      <div className="forgot-password-container">
        {/* Header */}
        <div className="forgot-password-header">
          <div className="icon-circle">
            <Mail size={32} />
          </div>
          <h1>Forgot Password?</h1>
          <p>
            No worries! Enter your email address and we'll send you a link to 
            reset your password.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="forgot-password-form">
          {error && (
            <div className="error-box">
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <div className="input-with-icon">
              <Mail size={18} className="input-icon" />
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                required
                disabled={loading}
                autoFocus
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="btn-submit"
            disabled={loading || !email}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Sending...
              </>
            ) : (
              <>
                <Send size={18} />
                Send Reset Link
              </>
            )}
          </button>
        </form>

        {/* Back to Login */}
        <div className="forgot-password-footer">
          <Link to="/login" className="link-back">
            <ArrowLeft size={16} />
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
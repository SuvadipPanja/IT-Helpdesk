// ============================================
// TWO-FACTOR SETUP WIZARD
// 3-step modal wizard to enable 2FA
// Developer: Suvadip Panja
// Date: November 10, 2025
// FILE: frontend/src/components/security/TwoFactorSetup.jsx
// ============================================

import React, { useState } from 'react';
import { X, Mail, Shield, CheckCircle, Loader, AlertCircle } from 'lucide-react';
import OTPInput from './OTPInput';
import twoFactorService from '../../services/twoFactor.service';

const TwoFactorSetup = ({ onClose, onComplete }) => {
  // Step tracking (1: Setup, 2: Verify, 3: Complete)
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [otpCode, setOtpCode] = useState('');

  // ============================================
  // STEP 1: Setup Email 2FA
  // ============================================
  const handleSetupEmail = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Setup email 2FA
      await twoFactorService.setupEmail2FA();
      
      // Send OTP code
      await twoFactorService.sendOTP();
      
      // Move to verification step
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to setup 2FA. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // STEP 2: Verify OTP
  // ============================================
  const handleVerifyOTP = async () => {
    if (otpCode.length !== 6) {
      setError('Please enter a 6-digit code');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      // Verify OTP
      await twoFactorService.verifyOTP(otpCode, 'email');
      
      // Enable 2FA
      await twoFactorService.enable2FA();
      
      // Move to completion step
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid verification code. Please try again.');
      setOtpCode(''); // Clear input on error
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // Resend OTP
  // ============================================
  const handleResendOTP = async () => {
    try {
      setLoading(true);
      setError('');
      setOtpCode('');
      
      await twoFactorService.sendOTP();
      
      // Clear error on successful resend
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // Close modal on overlay click
  // ============================================
  const handleOverlayClick = (e) => {
    if (e.target.className === 'security-settings-modal-overlay') {
      onClose();
    }
  };

  return (
    <div className="security-settings-modal-overlay" onClick={handleOverlayClick}>
      <div className="security-settings-modal-container security-settings-setup-modal">
        {/* Header */}
        <div className="security-settings-modal-header">
          <div className="security-settings-modal-title">
            <Shield size={24} />
            <h2>Enable Two-Factor Authentication</h2>
          </div>
          <button 
            className="security-settings-btn-close" 
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Progress Indicator */}
        <div className="security-settings-setup-progress">
          <div className={`security-settings-progress-step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
            <div className="security-settings-step-circle">
              {step > 1 ? <CheckCircle size={20} /> : '1'}
            </div>
            <span className="security-settings-step-label">Setup</span>
          </div>
          
          <div className={`security-settings-progress-line ${step > 1 ? 'completed' : ''}`}></div>
          
          <div className={`security-settings-progress-step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
            <div className="security-settings-step-circle">
              {step > 2 ? <CheckCircle size={20} /> : '2'}
            </div>
            <span className="security-settings-step-label">Verify</span>
          </div>
          
          <div className={`security-settings-progress-line ${step > 2 ? 'completed' : ''}`}></div>
          
          <div className={`security-settings-progress-step ${step >= 3 ? 'active' : ''}`}>
            <div className="security-settings-step-circle">3</div>
            <span className="security-settings-step-label">Complete</span>
          </div>
        </div>

        {/* Content */}
        <div className="security-settings-modal-body">
          {/* Error Alert */}
          {error && (
            <div className="security-settings-alert security-settings-alert-error">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: Choose Method */}
          {step === 1 && (
            <div className="security-settings-setup-step">
              <div className="security-settings-step-header">
                <h3>Choose Authentication Method</h3>
                <p>Select how you want to receive verification codes</p>
              </div>

              <div className="security-settings-method-options">
                <div className="security-settings-method-card security-settings-method-active">
                  <div className="security-settings-method-icon">
                    <Mail size={40} />
                  </div>
                  <div className="security-settings-method-content">
                    <h4>Email Verification</h4>
                    <p>Receive codes via email</p>
                    <ul className="security-settings-method-features">
                      <li>✓ Easy and convenient</li>
                      <li>✓ No additional app required</li>
                      <li>✓ Instant code delivery</li>
                    </ul>
                  </div>
                  <div className="security-settings-method-radio">
                    <div className="security-settings-radio-dot"></div>
                  </div>
                </div>
              </div>

              <div className="security-settings-step-actions">
                <button
                  className="security-settings-btn security-settings-btn-primary security-settings-btn-block"
                  onClick={handleSetupEmail}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader className="security-settings-spinner" size={18} />
                      <span>Setting up...</span>
                    </>
                  ) : (
                    <>
                      <Mail size={18} />
                      <span>Continue with Email</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Verify OTP */}
          {step === 2 && (
            <div className="security-settings-setup-step security-settings-verify-step">
              <div className="security-settings-step-icon-large">
                <Mail size={56} />
              </div>
              
              <div className="security-settings-step-header">
                <h3>Verify Your Email</h3>
                <p>Enter the 6-digit code sent to your email address</p>
              </div>

              <div className="security-settings-otp-container">
                <OTPInput
                  length={6}
                  value={otpCode}
                  onChange={setOtpCode}
                  disabled={loading}
                  autoFocus
                />
              </div>

              <div className="security-settings-step-actions">
                <button
                  className="security-settings-btn security-settings-btn-primary security-settings-btn-block"
                  onClick={handleVerifyOTP}
                  disabled={loading || otpCode.length !== 6}
                >
                  {loading ? (
                    <>
                      <Loader className="security-settings-spinner" size={18} />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle size={18} />
                      <span>Verify Code</span>
                    </>
                  )}
                </button>

                <button
                  className="security-settings-btn security-settings-btn-link"
                  onClick={handleResendOTP}
                  disabled={loading}
                >
                  Didn't receive the code? Resend
                </button>
              </div>

              <div className="security-settings-help-notes">
                <p>• Code expires in 5 minutes</p>
                <p>• Check your spam/junk folder</p>
                <p>• Make sure your email is correct</p>
              </div>
            </div>
          )}

          {/* STEP 3: Complete */}
          {step === 3 && (
            <div className="security-settings-setup-step security-settings-complete-step">
              <div className="security-settings-success-animation">
                <CheckCircle size={72} className="security-settings-success-icon" />
              </div>
              
              <div className="security-settings-step-header">
                <h3>2FA Enabled Successfully!</h3>
                <p>Your account is now secured with two-factor authentication</p>
              </div>

              <div className="security-settings-completion-cards">
                <div className="security-settings-info-card security-settings-info-card-success">
                  <h4>✓ What's Active</h4>
                  <ul>
                    <li>Email verification required at login</li>
                    <li>Backup codes generated</li>
                    <li>Enhanced account security</li>
                  </ul>
                </div>

                <div className="security-settings-info-card security-settings-info-card-warning">
                  <h4>⚠ Important Next Steps</h4>
                  <ul>
                    <li>Save your backup codes securely</li>
                    <li>Store codes in a safe place</li>
                    <li>Each code works only once</li>
                  </ul>
                </div>
              </div>

              <div className="security-settings-step-actions">
                <button
                  className="security-settings-btn security-settings-btn-primary security-settings-btn-block"
                  onClick={onComplete}
                >
                  <Shield size={18} />
                  <span>View Backup Codes</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TwoFactorSetup;
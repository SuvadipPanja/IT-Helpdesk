// ============================================
// SECURITY SETTINGS PAGE
// Main page for managing 2FA and security settings
// Developer: Suvadip Panja
// Date: November 10, 2025
// FILE: frontend/src/pages/security/SecuritySettings.jsx
// ============================================

import React, { useState, useEffect } from 'react';
import { Shield, Lock, Key, AlertCircle, CheckCircle, Info, Smartphone, Mail } from 'lucide-react';
import TwoFactorSetup from '../../components/security/TwoFactorSetup';
import BackupCodesModal from '../../components/security/BackupCodesModal';
import twoFactorService from '../../services/twoFactor.service';
import '../../styles/SecuritySettings.css';

const SecuritySettings = () => {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [showSetup, setShowSetup] = useState(false);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ============================================
  // Load settings on mount
  // ============================================
  useEffect(() => {
    loadSettings();
  }, []);

  // ============================================
  // Load 2FA Settings
  // ============================================
  const loadSettings = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await twoFactorService.get2FASettings();
      setSettings(data);
    } catch (err) {
      setError('Failed to load security settings');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // Toggle 2FA (Enable/Disable)
  // ============================================
  const handle2FAToggle = async () => {
    if (settings?.is_enabled) {
      // Disable 2FA
      if (!window.confirm('Are you sure you want to disable Two-Factor Authentication? This will make your account less secure.')) {
        return;
      }

      try {
        setLoading(true);
        setError('');
        await twoFactorService.disable2FA();
        setSuccess('Two-Factor Authentication disabled successfully');
        await loadSettings();
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to disable 2FA');
      } finally {
        setLoading(false);
      }
    } else {
      // Enable 2FA - show setup wizard
      setShowSetup(true);
    }
  };

  // ============================================
  // Setup Complete Handler
  // ============================================
  const handleSetupComplete = async () => {
    setShowSetup(false);
    setSuccess('Two-Factor Authentication enabled successfully! Please save your backup codes.');
    await loadSettings();
    // Auto-show backup codes after enabling
    setTimeout(() => {
      setShowBackupCodes(true);
    }, 500);
  };

  // ============================================
  // Format Date
  // ============================================
  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // ============================================
  // Loading State
  // ============================================
  if (loading && !settings) {
    return (
      <div className="security-settings-loading">
        <div className="security-settings-spinner-large"></div>
        <p>Loading security settings...</p>
      </div>
    );
  }

  return (
    <div className="security-settings-page">
      {/* Header */}
      <div className="security-settings-header">
        <div className="security-settings-header-content">
          <Shield className="security-settings-header-icon" size={40} />
          <div className="security-settings-header-text">
            <h1>Security Settings</h1>
            <p>Manage your account security and two-factor authentication</p>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="security-settings-alert security-settings-alert-error">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button className="security-settings-alert-close" onClick={() => setError('')}>×</button>
        </div>
      )}

      {success && (
        <div className="security-settings-alert security-settings-alert-success">
          <CheckCircle size={20} />
          <span>{success}</span>
          <button className="security-settings-alert-close" onClick={() => setSuccess('')}>×</button>
        </div>
      )}

      {/* Main Content */}
      <div className="security-settings-content">
        {/* Two-Factor Authentication Card */}
        <div className="security-settings-card">
          <div className="security-settings-card-header">
            <div className="security-settings-card-title-group">
              <Lock className="security-settings-card-icon" size={24} />
              <div>
                <h2>Two-Factor Authentication (2FA)</h2>
                <p className="security-settings-card-subtitle">Add an extra layer of security to your account</p>
              </div>
            </div>
            <div className={`security-settings-status-badge ${settings?.is_enabled ? 'security-settings-status-enabled' : 'security-settings-status-disabled'}`}>
              {settings?.is_enabled ? (
                <>
                  <CheckCircle size={16} />
                  <span>Enabled</span>
                </>
              ) : (
                <>
                  <AlertCircle size={16} />
                  <span>Disabled</span>
                </>
              )}
            </div>
          </div>

          <div className="security-settings-card-body">
            <div className="security-settings-card-description">
              <p>
                Two-factor authentication adds an additional layer of security by requiring a verification code
                from your email in addition to your password when signing in.
              </p>
            </div>

            {settings?.is_enabled ? (
              // 2FA Enabled State
              <div className="security-settings-details">
                <div className="security-settings-detail-grid">
                  <div className="security-settings-detail-item">
                    <div className="security-settings-detail-icon">
                      <Mail size={20} />
                    </div>
                    <div className="security-settings-detail-content">
                      <span className="security-settings-detail-label">Method</span>
                      <span className="security-settings-detail-value">Email Verification</span>
                    </div>
                  </div>

                  <div className="security-settings-detail-item">
                    <div className="security-settings-detail-icon">
                      <CheckCircle size={20} />
                    </div>
                    <div className="security-settings-detail-content">
                      <span className="security-settings-detail-label">Email Status</span>
                      <span className="security-settings-detail-value">
                        {settings.email_verified ? 'Verified ✓' : 'Not Verified'}
                      </span>
                    </div>
                  </div>

                  <div className="security-settings-detail-item">
                    <div className="security-settings-detail-icon">
                      <Key size={20} />
                    </div>
                    <div className="security-settings-detail-content">
                      <span className="security-settings-detail-label">Backup Codes</span>
                      <span className="security-settings-detail-value">
                        {settings.remaining_backup_codes || 0} remaining
                      </span>
                    </div>
                  </div>

                  <div className="security-settings-detail-item">
                    <div className="security-settings-detail-icon">
                      <Smartphone size={20} />
                    </div>
                    <div className="security-settings-detail-content">
                      <span className="security-settings-detail-label">Trusted Devices</span>
                      <span className="security-settings-detail-value">
                        {settings.trusted_devices_count || 0} devices
                      </span>
                    </div>
                  </div>
                </div>

                {settings.enabled_at && (
                  <div className="security-settings-info-text">
                    <Info size={16} />
                    <span>Enabled on {formatDate(settings.enabled_at)}</span>
                  </div>
                )}

                {settings.last_used_at && (
                  <div className="security-settings-info-text">
                    <Info size={16} />
                    <span>Last used {formatDate(settings.last_used_at)}</span>
                  </div>
                )}
              </div>
            ) : (
              // 2FA Disabled State
              <div className="security-settings-prompt">
                <div className="security-settings-prompt-icon">
                  <Shield size={48} />
                </div>
                <h3>Protect Your Account</h3>
                <p>
                  Enable two-factor authentication to significantly improve your account security.
                  You'll need both your password and a verification code to sign in.
                </p>
                <ul className="security-settings-benefit-list">
                  <li>✓ Protects against password theft</li>
                  <li>✓ Prevents unauthorized access</li>
                  <li>✓ Email-based verification</li>
                  <li>✓ Backup codes for emergencies</li>
                </ul>
              </div>
            )}

            <div className="security-settings-card-actions">
              <button
                className={`security-settings-btn ${settings?.is_enabled ? 'security-settings-btn-danger' : 'security-settings-btn-primary'}`}
                onClick={handle2FAToggle}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="security-settings-btn-spinner"></div>
                    <span>Loading...</span>
                  </>
                ) : settings?.is_enabled ? (
                  <>
                    <Lock size={18} />
                    <span>Disable 2FA</span>
                  </>
                ) : (
                  <>
                    <Shield size={18} />
                    <span>Enable 2FA</span>
                  </>
                )}
              </button>

              {settings?.is_enabled && (
                <button
                  className="security-settings-btn security-settings-btn-secondary"
                  onClick={() => setShowBackupCodes(true)}
                >
                  <Key size={18} />
                  <span>View Backup Codes</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Security Activity Card */}
        <div className="security-settings-card">
          <div className="security-settings-card-header">
            <div className="security-settings-card-title-group">
              <AlertCircle className="security-settings-card-icon" size={24} />
              <div>
                <h2>Security Activity</h2>
                <p className="security-settings-card-subtitle">Recent security events</p>
              </div>
            </div>
          </div>

          <div className="security-settings-card-body">
            <div className="security-settings-activity-list">
              <div className="security-settings-activity-item">
                <div className="security-settings-activity-icon security-settings-activity-success">
                  <CheckCircle size={20} />
                </div>
                <div className="security-settings-activity-content">
                  <span className="security-settings-activity-title">Successful login</span>
                  <span className="security-settings-activity-time">2 hours ago</span>
                </div>
              </div>

              <div className="security-settings-activity-item">
                <div className="security-settings-activity-icon security-settings-activity-info">
                  <Info size={20} />
                </div>
                <div className="security-settings-activity-content">
                  <span className="security-settings-activity-title">Password changed</span>
                  <span className="security-settings-activity-time">3 days ago</span>
                </div>
              </div>

              {settings?.is_enabled && (
                <div className="security-settings-activity-item">
                  <div className="security-settings-activity-icon security-settings-activity-success">
                    <CheckCircle size={20} />
                  </div>
                  <div className="security-settings-activity-content">
                    <span className="security-settings-activity-title">2FA verification successful</span>
                    <span className="security-settings-activity-time">1 week ago</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showSetup && (
        <TwoFactorSetup
          onClose={() => setShowSetup(false)}
          onComplete={handleSetupComplete}
        />
      )}

      {showBackupCodes && (
        <BackupCodesModal
          onClose={() => setShowBackupCodes(false)}
          onRegenerate={loadSettings}
        />
      )}
    </div>
  );
};

export default SecuritySettings;
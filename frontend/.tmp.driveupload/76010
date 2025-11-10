// ============================================
// BACKUP CODES MODAL
// Display and manage 2FA backup codes
// Developer: Suvadip Panja
// Date: November 10, 2025
// FILE: frontend/src/components/security/BackupCodesModal.jsx
// ============================================

import React, { useState, useEffect } from 'react';
import { X, Download, Copy, RefreshCw, AlertTriangle, CheckCircle, Key } from 'lucide-react';
import twoFactorService from '../../services/twoFactor.service';

const BackupCodesModal = ({ onClose, onRegenerate }) => {
  const [codes, setCodes] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  // ============================================
  // Load backup codes on mount
  // ============================================
  useEffect(() => {
    loadBackupCodes();
  }, []);

  // ============================================
  // Load Backup Codes
  // ============================================
  const loadBackupCodes = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Generate new codes
      const response = await twoFactorService.generateBackupCodes();
      setCodes(response.codes || []);
      
      // Get stats
      const statsData = await twoFactorService.getBackupCodesStats();
      setStats(statsData);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load backup codes');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // Copy to Clipboard
  // ============================================
  const handleCopy = () => {
    const codesText = codes.join('\n');
    navigator.clipboard.writeText(codesText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ============================================
  // Download as Text File
  // ============================================
  const handleDownload = () => {
    const codesText = `NEXUS SUPPORT - 2FA BACKUP CODES
Generated: ${new Date().toLocaleString()}

IMPORTANT: Keep these codes in a secure location!
Each code can only be used once.

${codes.map((code, i) => `${i + 1}. ${code}`).join('\n')}

If you lose access to your email, you can use these codes to log in.
Generate new codes if you run out.
`;

    const blob = new Blob([codesText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexus-2fa-backup-codes-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ============================================
  // Regenerate Codes
  // ============================================
  const handleRegenerate = async () => {
    if (!window.confirm('Are you sure? This will invalidate all existing backup codes.')) {
      return;
    }

    await loadBackupCodes();
    if (onRegenerate) {
      onRegenerate();
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
      <div className="security-settings-modal-container security-settings-backup-modal">
        {/* Header */}
        <div className="security-settings-modal-header">
          <div className="security-settings-modal-title">
            <Key size={24} />
            <h2>Backup Codes</h2>
          </div>
          <button 
            className="security-settings-btn-close" 
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="security-settings-modal-body">
          {/* Error Alert */}
          {error && (
            <div className="security-settings-alert security-settings-alert-error">
              <AlertTriangle size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* Warning Box */}
          <div className="security-settings-alert security-settings-alert-warning">
            <AlertTriangle size={20} />
            <div>
              <strong>Important: Save these codes now!</strong>
              <p>
                Each code can only be used once. If you lose access to your email,
                these codes are your only way to access your account.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="security-settings-loading-state">
              <div className="security-settings-spinner-large"></div>
              <p>Generating backup codes...</p>
            </div>
          ) : (
            <>
              {/* Codes Grid */}
              <div className="security-settings-backup-codes-grid">
                {codes.map((code, index) => (
                  <div key={index} className="security-settings-backup-code-item">
                    <span className="security-settings-code-number">{index + 1}</span>
                    <span className="security-settings-code-value">{code}</span>
                  </div>
                ))}
              </div>

              {/* Stats */}
              {stats && (
                <div className="security-settings-backup-stats">
                  <div className="security-settings-stat-item">
                    <span className="security-settings-stat-label">Total Codes:</span>
                    <span className="security-settings-stat-value">{stats.total_codes}</span>
                  </div>
                  <div className="security-settings-stat-item">
                    <span className="security-settings-stat-label">Remaining:</span>
                    <span className="security-settings-stat-value">{stats.unused_codes}</span>
                  </div>
                  <div className="security-settings-stat-item">
                    <span className="security-settings-stat-label">Used:</span>
                    <span className="security-settings-stat-value">{stats.used_codes}</span>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="security-settings-backup-actions">
                <button
                  className="security-settings-btn security-settings-btn-primary"
                  onClick={handleDownload}
                >
                  <Download size={18} />
                  <span>Download Codes</span>
                </button>

                <button
                  className="security-settings-btn security-settings-btn-secondary"
                  onClick={handleCopy}
                  disabled={copied}
                >
                  {copied ? (
                    <>
                      <CheckCircle size={18} />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={18} />
                      <span>Copy All</span>
                    </>
                  )}
                </button>

                <button
                  className="security-settings-btn security-settings-btn-outline"
                  onClick={handleRegenerate}
                >
                  <RefreshCw size={18} />
                  <span>Regenerate</span>
                </button>
              </div>

              {/* Instructions */}
              <div className="security-settings-backup-instructions">
                <h4>How to use backup codes:</h4>
                <ol>
                  <li>Save these codes in a secure location (password manager, safe place)</li>
                  <li>When logging in, click "Use backup code" if you can't access your email</li>
                  <li>Enter one of these codes to verify your identity</li>
                  <li>Each code works only once - generate new codes when running low</li>
                </ol>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="security-settings-modal-footer">
          <button 
            className="security-settings-btn security-settings-btn-secondary" 
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default BackupCodesModal;
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  FileSignature,
  KeyRound,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

import RefreshButton from '../shared/RefreshButton';

const blockedStates = new Set(['EXPIRED', 'INVALID', 'MISSING', 'CONFIG_ERROR']);

const formatDate = (value) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

const statusTone = (status) => {
  if (status === 'VALID') return 'valid';
  if (status === 'WARNING') return 'warning';
  return 'expired';
};

export default function LicenseSettingsTab({ onNotify }) {
  const { refreshLicenseState } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [statusData, setStatusData] = useState(null);
  const [envelopeText, setEnvelopeText] = useState('');

  const activeLicense = statusData?.active_license || null;
  const currentStatus = statusData?.current_status || 'UNKNOWN';
  const canInstall = envelopeText.trim().length > 0 && !installing;

  const summaryItems = useMemo(() => ([
    { label: 'Status', value: currentStatus },
    { label: 'License ID', value: activeLicense?.license_id || '—' },
    { label: 'Customer', value: activeLicense?.customer_name || '—' },
    { label: 'Edition', value: activeLicense?.edition || '—' },
    { label: 'Expires At', value: formatDate(statusData?.expires_at) },
    { label: 'Installed At', value: formatDate(activeLicense?.installed_at) },
    { label: 'Current Fingerprint', value: statusData?.current_fingerprint || '—' },
    { label: 'Clock Tamper Detected', value: formatDate(statusData?.clock_tamper_detected_at) },
    {
      label: 'Active Users',
      value: statusData?.usage?.active_users?.limit
        ? `${statusData?.usage?.active_users?.current || 0} / ${statusData?.usage?.active_users?.limit}`
        : `${statusData?.usage?.active_users?.current || 0} / Unlimited`,
    },
    {
      label: 'Licensed Features',
      value: Object.entries(statusData?.entitlements?.features || {})
        .filter(([, enabled]) => enabled)
        .map(([key]) => key)
        .join(', ') || 'All default features',
    },
  ]), [activeLicense, currentStatus, statusData]);

  const fetchStatus = async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const response = await api.get('/license/status');
      if (response.data?.success) {
        setStatusData(response.data.data);
        await refreshLicenseState?.();
      }
    } catch (error) {
      onNotify?.({
        type: 'error',
        text: error.response?.data?.message || 'Failed to load license status',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      setEnvelopeText(text);
      onNotify?.({ type: 'success', text: `Loaded license file: ${file.name}` });
    } catch {
      onNotify?.({ type: 'error', text: 'Failed to read license file' });
    } finally {
      event.target.value = '';
    }
  };

  const handleInstall = async () => {
    setInstalling(true);
    try {
      const parsed = JSON.parse(envelopeText);
      const response = await api.post('/license/install', parsed);
      await refreshLicenseState?.();
      const overage = response.data?.data?.seat_overage;
      if (overage?.overLimit) {
        onNotify?.({
          type: 'warning',
          text: `License installed. WARNING: You have ${overage.current} active users but this license only permits ${overage.limit}. Please deactivate ${overage.excess} user(s) to be in compliance.`,
        });
      } else {
        onNotify?.({ type: 'success', text: 'License installed successfully' });
      }
      setEnvelopeText('');
      await fetchStatus(true);
    } catch (error) {
      onNotify?.({
        type: 'error',
        text: error.response?.data?.message || error.message || 'Failed to install license',
      });
    } finally {
      setInstalling(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await api.post('/license/refresh-state');
      await refreshLicenseState?.();
      await fetchStatus(true);
      onNotify?.({ type: 'success', text: 'License state refreshed successfully' });
    } catch (error) {
      onNotify?.({
        type: 'error',
        text: error.response?.data?.message || 'Failed to refresh license state',
      });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="settings-form">
      <div className="settings-section">
        <div className="settings-section-header">
          <KeyRound />
          <div>
            <h3>License Status</h3>
            <p>Offline signed license state enforced by the backend runtime.</p>
          </div>
        </div>
        <div className="settings-section-content">
          {loading ? (
            <div className="license-empty-state">Loading license status…</div>
          ) : (
            <>
              <div className={`license-status-banner license-status-banner--${statusTone(currentStatus)}`}>
                {blockedStates.has(currentStatus) ? <ShieldAlert size={18} /> : <ShieldCheck size={18} />}
                <div>
                  <strong>{currentStatus}</strong>
                  <p>{statusData?.message || 'No status message available.'}</p>
                </div>
              </div>

              {statusData?.seat_overage?.overLimit && (
                <div className="license-seat-overage-banner">
                  <AlertTriangle size={18} />
                  <div>
                    <strong>Seat Limit Exceeded</strong>
                    <p>
                      This system has <strong>{statusData.seat_overage.current}</strong> active users
                      but the license only permits <strong>{statusData.seat_overage.limit}</strong>.
                      Please deactivate at least <strong>{statusData.seat_overage.excess}</strong> user
                      {statusData.seat_overage.excess !== 1 ? 's' : ''} to restore compliance.
                      Until resolved, users outside the licensed seat allocation will be blocked at login.
                    </p>
                  </div>
                </div>
              )}

              <div className="license-summary-grid">
                {summaryItems.map((item) => (
                  <div key={item.label} className="license-summary-card">
                    <span className="license-summary-label">{item.label}</span>
                    <span className="license-summary-value">{item.value || '—'}</span>
                  </div>
                ))}
              </div>

              <div className="license-actions-row">
                <RefreshButton
                  onClick={handleRefresh}
                  loading={refreshing}
                  label={refreshing ? 'Refreshing…' : 'Refresh License State'}
                />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-header">
          <FileSignature />
          <div>
            <h3>Install or Renew License</h3>
            <p>Paste or upload the signed license envelope generated from your private licensing system.</p>
          </div>
        </div>
        <div className="settings-section-content">
          <div className="form-group full-width">
            <label className="form-label">Signed License Envelope</label>
            <textarea
              className="form-textarea license-envelope-textarea"
              rows={14}
              value={envelopeText}
              onChange={(e) => setEnvelopeText(e.target.value)}
              placeholder={`{\n  "payload": { ... },\n  "signature": "base64-signature",\n  "algorithm": "ed25519"\n}`}
            />
            <small className="form-help">
              Expected format: JSON object containing `payload`, `signature`, and optional `algorithm`.
            </small>
          </div>

          <div className="license-actions-row">
            <label className="btn-secondary license-upload-button">
              <Upload size={16} />
              Load JSON File
              <input type="file" accept=".json,application/json" onChange={handleFileChange} hidden />
            </label>

            <button className="btn-primary" onClick={handleInstall} disabled={!canInstall}>
              {installing ? <RefreshCw size={16} className="spin" /> : <CheckCircle size={16} />}
              {installing ? 'Installing…' : 'Install License'}
            </button>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-header">
          <AlertTriangle />
          <div>
            <h3>Enforcement Notes</h3>
            <p>What this runtime currently enforces and what comes next.</p>
          </div>
        </div>
        <div className="settings-section-content">
          <ul className="license-notes-list">
            <li>Login is blocked when the license is missing, invalid, or expired.</li>
            <li>Protected API requests are blocked with `LICENSE_BLOCKED` when runtime access is not allowed.</li>
            <li>Background jobs are stopped when the license monitor detects an invalid or expired state.</li>
            <li>Expired or blocked deployments can use the public recovery screen with a recovery key to install a renewed signed license.</li>
            <li>Licenses can be bound to a specific deployment fingerprint using `instance_binding.server_fingerprint_hash`.</li>
            <li>Clock rollback is monitored using persisted runtime timestamps, and suspicious backward time movement locks the runtime.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

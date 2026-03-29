import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, FileText, KeyRound, Upload, Shield } from 'lucide-react';
import api from '../../services/api';
import '../../styles/Login.css';

const BLOCKED_STATUSES = ['EXPIRED', 'INVALID', 'MISSING', 'CONFIG_ERROR'];

const LicenseRecovery = () => {
  const navigate = useNavigate();
  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [message, setMessage] = useState(null);
  const [recoveryKey, setRecoveryKey] = useState('');
  const [envelopeText, setEnvelopeText] = useState('');

  const isBlocked = useMemo(() => BLOCKED_STATUSES.includes(context?.current_status), [context]);

  useEffect(() => {
    const loadContext = async () => {
      try {
        const res = await api.get('/license/recovery-context');
        if (res.data?.success) {
          setContext(res.data.data);
        }
      } catch (error) {
        setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to load recovery details.' });
      } finally {
        setLoading(false);
      }
    };

    loadContext();
  }, []);

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    setEnvelopeText(text);
    setMessage(null);
  };

  const handleInstall = async (event) => {
    event.preventDefault();
    setMessage(null);

    let parsedEnvelope;
    try {
      parsedEnvelope = JSON.parse(envelopeText);
    } catch {
      setMessage({ type: 'error', text: 'License JSON is invalid.' });
      return;
    }

    setInstalling(true);
    try {
      const res = await api.post('/license/recovery/install', {
        recovery_key: recoveryKey,
        payload: parsedEnvelope.payload,
        signature: parsedEnvelope.signature,
        algorithm: parsedEnvelope.algorithm || 'ed25519',
      });

      setMessage({ type: 'success', text: res.data?.message || 'License installed successfully.' });
      setTimeout(() => navigate('/login'), 1200);
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to install license.' });
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="login-page-container">
      <div>
        <div className="login-card">
          <div className="login-logo-section">
            <div className="login-logo-icon">
              <Shield size={28} />
            </div>
            <h1 className="login-title">License Recovery</h1>
            <p className="login-subtitle">Renew an offline signed license when normal login is unavailable.</p>
          </div>

          {loading ? (
            <div className="login-maintenance-warning" style={{ animation: 'none' }}>
              <p>Loading recovery details...</p>
            </div>
          ) : (
            <>
              <div className={`login-maintenance-warning ${isBlocked ? 'login-license-warning' : ''}`}>
                <AlertCircle size={20} />
                <div>
                  <strong>Current Status: {context?.current_status || 'UNKNOWN'}</strong>
                  <p>{context?.message || 'License runtime state unavailable.'}</p>
                </div>
              </div>

              {message && (
                <div
                  className={message.type === 'error' ? 'login-error-message' : 'login-maintenance-warning'}
                  style={message.type === 'success' ? { animation: 'none', background: 'linear-gradient(135deg, rgba(5, 150, 105, 0.96) 0%, rgba(16, 185, 129, 0.96) 100%)', boxShadow: '0 6px 18px rgba(5, 150, 105, 0.35)' } : undefined}
                >
                  {message.type === 'error' ? <AlertCircle size={18} /> : <Shield size={18} />}
                  <span>{message.text}</span>
                </div>
              )}

              <div className="login-maintenance-warning" style={{ animation: 'none', background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.16)', boxShadow: 'none' }}>
                <p><strong>Server fingerprint</strong></p>
                <p style={{ wordBreak: 'break-all' }}>{context?.current_fingerprint || 'Unavailable'}</p>
                <p style={{ marginTop: '0.75rem' }}>
                  Use this fingerprint in the signed license payload so the license is bound to this deployment.
                </p>
              </div>

              <form onSubmit={handleInstall} className="login-form">
                <div className="login-form-group">
                  <label className="login-label">Recovery key</label>
                  <div className="login-input-wrapper">
                    <KeyRound size={20} className="login-input-icon" />
                    <input
                      type="password"
                      className="login-input"
                      value={recoveryKey}
                      onChange={(e) => setRecoveryKey(e.target.value)}
                      placeholder="Enter license recovery key"
                      autoComplete="off"
                      disabled={installing || !context?.recovery_enabled}
                      required
                    />
                  </div>
                </div>

                <div className="login-form-group">
                  <label className="login-label">Signed license envelope</label>
                  <div className="login-input-wrapper" style={{ alignItems: 'flex-start' }}>
                    <FileText size={20} className="login-input-icon" style={{ marginTop: '0.9rem' }} />
                    <textarea
                      className="login-input"
                      style={{ minHeight: '220px', resize: 'vertical', paddingTop: '0.9rem' }}
                      value={envelopeText}
                      onChange={(e) => setEnvelopeText(e.target.value)}
                      placeholder='Paste the full signed license JSON: {"payload":{...},"signature":"...","algorithm":"ed25519"}'
                      disabled={installing || !context?.recovery_enabled}
                      required
                    />
                  </div>
                </div>

                <label className="login-button" style={{ display: 'flex', justifyContent: 'center', cursor: 'pointer', marginBottom: '1rem', textDecoration: 'none' }}>
                  <Upload size={16} />
                  Upload license file
                  <input type="file" accept=".json,application/json" onChange={handleFileUpload} style={{ display: 'none' }} />
                </label>

                {!context?.recovery_enabled && (
                  <div className="login-error-message">
                    <AlertCircle size={18} />
                    Recovery is disabled because `LICENSE_RECOVERY_KEY` is not configured on the server.
                  </div>
                )}

                <button
                  type="submit"
                  className="login-button"
                  disabled={installing || !context?.recovery_enabled}
                >
                  {installing ? 'Installing License...' : 'Install Renewed License'}
                </button>
              </form>
            </>
          )}

          <div className="login-footer" style={{ marginTop: '1rem' }}>
            <Link to="/login" style={{ color: 'rgba(255,255,255,0.85)' }}>
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LicenseRecovery;

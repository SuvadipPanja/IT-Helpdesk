// ============================================
// WhatsApp Settings Tab
// Admin configuration panel for WhatsApp Business integration
// Phase 9: WhatsApp Integration
// ============================================

import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Save,
  Loader,
  CheckCircle,
  AlertCircle,
  Send,
  RefreshCw,
  Eye,
  EyeOff,
  Info,
  BarChart2,
  Megaphone,
  Copy,
  Check,
  Key,
  Webhook,
  Bot,
  Bell,
  Users,
  Zap,
} from 'lucide-react';
import api from '../../services/api';
import '../../styles/WhatsAppSettings.css';

const WhatsAppSettingsTab = ({ externalSaveTrigger = 0 }) => {
  const [config, setConfig] = useState({
    enabled: false,
    apiToken: '',
    phoneNumberId: '',
    businessAccountId: '',
    webhookToken: '',
    botEnabled: false,
    notifyEnabled: false,
    // Twilio / provider
    provider: 'meta',
    twilioAccountSid: '',
    twilioAuthToken: '',
    twilioWhatsappFrom: '',
    twilioWebhookAuthEnabled: false,
  });
  const [hasApiToken, setHasApiToken] = useState(false);
  const [apiTokenPreview, setApiTokenPreview] = useState('');
  const [showToken, setShowToken] = useState(false);

  const [hasTwilioAuthToken, setHasTwilioAuthToken] = useState(false);
  const [twilioAuthTokenPreview, setTwilioAuthTokenPreview] = useState('');
  const [showTwilioToken, setShowTwilioToken] = useState(false);
  const [twilioWebhookCopied, setTwilioWebhookCopied] = useState(false);

  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null); // { ok: bool, msg: string }

  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [testPhone, setTestPhone] = useState('');
  const [testMsg, setTestMsg] = useState('Hello from IT Helpdesk! This is a test message.');
  const [sending, setSending] = useState(false);

  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastBusy, setBroadcastBusy] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState(null);
  const [broadcastConfirm, setBroadcastConfirm] = useState(false);

  const [webhookCopied, setWebhookCopied] = useState(false);

  const showMsg = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  // Load config + stats — retries once automatically if the first attempt fails.
  useEffect(() => {
    const applyConfig = (c) => {
      setConfig({
        enabled: c.enabled === true,
        apiToken: '',          // never pre-fill token
        phoneNumberId: c.phoneNumberId,
        businessAccountId: c.businessAccountId,
        webhookToken: c.webhookToken,
        botEnabled: c.botEnabled === true,
        notifyEnabled: c.notifyEnabled === true,
        // Twilio / provider
        provider: c.provider || 'meta',
        twilioAccountSid: c.twilioAccountSid || '',
        twilioAuthToken: '',   // never pre-fill token
        twilioWhatsappFrom: c.twilioWhatsappFrom || '',
        twilioWebhookAuthEnabled: c.twilioWebhookAuthEnabled === true,
        appPublicUrl: c.appPublicUrl || '',
      });
      setHasApiToken(c.hasApiToken);
      setApiTokenPreview(c.apiTokenPreview);
      setHasTwilioAuthToken(c.hasTwilioAuthToken);
      setTwilioAuthTokenPreview(c.twilioAuthTokenPreview || '');
    };

    const loadData = async (attempt = 1) => {
      setLoading(true);
      try {
        const [cfgRes, statsRes] = await Promise.all([
          api.get('/whatsapp/config'),
          api.get('/whatsapp/stats').catch(() => null),
        ]);

        if (cfgRes.data.success) {
          applyConfig(cfgRes.data.config);
        } else if (attempt === 1) {
          // Non-success response — wait 1 s then retry once
          await new Promise(r => setTimeout(r, 1000));
          return loadData(2);
        } else {
          showMsg('error', 'Failed to load WhatsApp configuration. Refresh the page to try again.');
        }

        if (statsRes?.data?.success) {
          setStats(statsRes.data.stats);
        }
      } catch (err) {
        if (attempt === 1) {
          // Auto-retry once after 1 second (covers transient network/auth hiccups)
          await new Promise(r => setTimeout(r, 1000));
          return loadData(2);
        }
        showMsg('error', 'Failed to load WhatsApp configuration. Refresh the page to try again.');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);



  const loadLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await api.get('/whatsapp/logs?limit=20');
      if (res.data.success) setLogs(res.data.logs);
    } catch {
      // non-blocking
    } finally {
      setLogsLoading(false);
    }
  };

  const reloadConfig = async () => {
    try {
      const cfgRes = await api.get('/whatsapp/config');
      if (cfgRes.data.success) {
        const c = cfgRes.data.config;
        setConfig(prev => ({
          ...prev,
          enabled: c.enabled === true,
          phoneNumberId: c.phoneNumberId,
          businessAccountId: c.businessAccountId,
          webhookToken: c.webhookToken,
          botEnabled: c.botEnabled === true,
          notifyEnabled: c.notifyEnabled === true,
          provider: c.provider || 'meta',
          twilioAccountSid: c.twilioAccountSid || '',
          twilioAuthToken: '',
          twilioWhatsappFrom: c.twilioWhatsappFrom || '',
          twilioWebhookAuthEnabled: c.twilioWebhookAuthEnabled === true,
          appPublicUrl: c.appPublicUrl || '',
        }));
        setHasApiToken(c.hasApiToken);
        setApiTokenPreview(c.apiTokenPreview || '');
        setHasTwilioAuthToken(c.hasTwilioAuthToken);
        setTwilioAuthTokenPreview(c.twilioAuthTokenPreview || '');
        setShowTwilioToken(false);
      }
    } catch {}
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage({ type: '', text: '' });
    setVerifyResult(null);
    try {
      const payload = { ...config };
      if (!payload.apiToken) delete payload.apiToken;
      if (!payload.twilioAuthToken) delete payload.twilioAuthToken;
      const res = await api.put('/whatsapp/config', payload);
      if (res.data.success) {
        showMsg('success', 'Configuration saved');
        await reloadConfig();
      } else {
        showMsg('error', res.data.error || 'Save failed');
      }
    } catch (e) {
      showMsg('error', e.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Respond to the global "Save Changes" button in Settings.jsx when this tab is active.
  // Must be placed after handleSave is defined so the closure captures the current function.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (externalSaveTrigger > 0) handleSave(); }, [externalSaveTrigger]);

  const handleVerify = async () => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await api.post('/whatsapp/verify-credentials');
      if (res.data.success) {
        const detail = res.data.provider === 'twilio'
          ? `${res.data.accountName} — ${res.data.accountStatus}`
          : (res.data.verifiedName || res.data.displayPhoneNumber || 'OK');
        setVerifyResult({ ok: true, msg: `Connected ✔ ${detail}` });
      } else {
        setVerifyResult({ ok: false, msg: res.data.error || 'Verification failed' });
      }
    } catch (e) {
      setVerifyResult({ ok: false, msg: e.response?.data?.error || 'Could not reach server' });
    } finally {
      setVerifying(false);
    }
  };

  const handleSendTest = async () => {
    if (!testPhone.trim()) return;
    setSending(true);
    try {
      const res = await api.post('/whatsapp/send-test', { phone: testPhone.trim(), message: testMsg });
      if (res.data.success) showMsg('success', `Message sent! ID: ${res.data.waMessageId || 'N/A'}`);
      else showMsg('error', res.data.error || 'Failed to send');
    } catch (e) {
      showMsg('error', e.response?.data?.error || 'Send failed');
    } finally {
      setSending(false);
    }
  };

  const handleBroadcast = async () => {
    if (!broadcastMsg.trim()) return;
    setBroadcastBusy(true);
    setBroadcastResult(null);
    setBroadcastConfirm(false);
    try {
      const res = await api.post('/whatsapp/broadcast', { message: broadcastMsg.trim() });
      if (res.data.success) {
        setBroadcastResult({ type: 'success', sent: res.data.sent, failed: res.data.failed, total: res.data.total });
        setBroadcastMsg('');
      } else {
        setBroadcastResult({ type: 'error', message: res.data.error || 'Broadcast failed' });
      }
    } catch (e) {
      setBroadcastResult({ type: 'error', message: e.response?.data?.error || 'Broadcast failed' });
    } finally {
      setBroadcastBusy(false);
    }
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl).catch(() => {});
    setWebhookCopied(true);
    setTimeout(() => setWebhookCopied(false), 2000);
  };

  const copyTwilioWebhookUrl = () => {
    navigator.clipboard.writeText(twilioWebhookUrl).catch(() => {});
    setTwilioWebhookCopied(true);
    setTimeout(() => setTwilioWebhookCopied(false), 2000);
  };

  const statusBadgeClass = (status) => {
    switch ((status || '').toLowerCase()) {
      case 'read':       return 'wa-badge wa-badge-read';
      case 'delivered':  return 'wa-badge wa-badge-delivered';
      case 'sent':       return 'wa-badge wa-badge-sent';
      case 'failed':     return 'wa-badge wa-badge-failed';
      case 'pending':    return 'wa-badge wa-badge-pending';
      default:           return 'wa-badge wa-badge-muted';
    }
  };

  const typeBadgeClass = (type) => {
    switch ((type || '').toLowerCase()) {
      case 'text':        return 'wa-badge wa-badge-type-text';
      case 'interactive': return 'wa-badge wa-badge-type-interactive';
      case 'image':       return 'wa-badge wa-badge-type-media';
      case 'document':    return 'wa-badge wa-badge-type-media';
      case 'video':       return 'wa-badge wa-badge-type-media';
      case 'audio':       return 'wa-badge wa-badge-type-media';
      default:            return 'wa-badge wa-badge-muted';
    }
  };

  const _baseUrl = config.appPublicUrl || window.location.origin;
  const webhookUrl = `${_baseUrl}/api/v1/whatsapp/webhook`;
  const twilioWebhookUrl = `${_baseUrl}/api/v1/whatsapp/webhook/twilio`;

  if (loading) {
    return (
      <div className="wa-settings-container" style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
        <Loader size={28} className="wa-spin" style={{ color: '#25D366' }} />
      </div>
    );
  }

  return (
    <div className="wa-settings-container">

      {/* Alert */}
      {message.text && (
        <div className={`wa-alert ${message.type}`}>
          {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {message.text}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="wa-stats-grid">
          <div className="wa-stat-card">
            <div className="wa-stat-value wa-stat-value--messages">{stats.total_messages ?? 0}</div>
            <div className="wa-stat-label">Total Messages</div>
          </div>
          <div className="wa-stat-card">
            <div className="wa-stat-value wa-stat-value--users">{stats.opted_in_users ?? 0}</div>
            <div className="wa-stat-label">Opted-in Users</div>
          </div>
          <div className="wa-stat-card">
            <div className="wa-stat-value wa-stat-value--notif">{stats.notifications ?? 0}</div>
            <div className="wa-stat-label">Notifications Sent</div>
          </div>
          <div className="wa-stat-card">
            <div className="wa-stat-value wa-stat-value--24h">{stats.last_24h ?? 0}</div>
            <div className="wa-stat-label">Last 24 h</div>
          </div>
        </div>
      )}

      {/* Enable Toggles */}
      <div className="wa-section">
        <div className="wa-section-header">
          <MessageSquare size={16} className="wa-icon-green" />
          <h3>WhatsApp Integration</h3>
          <span className={`wa-status-pill ${config.enabled ? 'wa-status-pill--on' : 'wa-status-pill--off'}`}>
            {config.enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
        <div className="wa-section-content">
          <div className="wa-toggle-row">
            <div className="wa-toggle-label">
              <div className="wa-toggle-label-title"><MessageSquare size={13} className="wa-icon-green" /><strong>Enable WhatsApp</strong></div>
              <span>Allow the system to send and receive messages via WhatsApp Business</span>
            </div>
            <label className="wa-toggle">
              <input type="checkbox" checked={config.enabled} onChange={e => setConfig(p => ({ ...p, enabled: e.target.checked }))} />
              <span className="wa-toggle-slider" />
            </label>
          </div>
          <div className="wa-toggle-row">
            <div className="wa-toggle-label">
              <div className="wa-toggle-label-title"><Bot size={13} className="wa-icon-blue" /><strong>Bot on WhatsApp</strong></div>
              <span>Route incoming WhatsApp messages to the AI helpdesk bot</span>
            </div>
            <label className="wa-toggle">
              <input type="checkbox" checked={config.botEnabled} onChange={e => setConfig(p => ({ ...p, botEnabled: e.target.checked }))} />
              <span className="wa-toggle-slider" />
            </label>
          </div>
          <div className="wa-toggle-row">
            <div className="wa-toggle-label">
              <div className="wa-toggle-label-title"><Bell size={13} className="wa-icon-amber" /><strong>Ticket Notifications</strong></div>
              <span>Alert users via WhatsApp when tickets are created or updated</span>
            </div>
            <label className="wa-toggle">
              <input type="checkbox" checked={config.notifyEnabled} onChange={e => setConfig(p => ({ ...p, notifyEnabled: e.target.checked }))} />
              <span className="wa-toggle-slider" />
            </label>
          </div>

          {/* Provider selector */}
          <div className="wa-toggle-row">
            <div className="wa-toggle-label">
              <div className="wa-toggle-label-title"><Zap size={13} className="wa-icon-purple" /><strong>API Provider</strong></div>
              <span>Choose which WhatsApp Business API service to use</span>
            </div>
            <div className="wa-provider-tabs">
              <button
                className={`wa-provider-tab${config.provider !== 'twilio' ? ' active' : ''}`}
                onClick={() => setConfig(p => ({ ...p, provider: 'meta' }))}
              >
                Meta
              </button>
              <button
                className={`wa-provider-tab${config.provider === 'twilio' ? ' active' : ''}`}
                onClick={() => setConfig(p => ({ ...p, provider: 'twilio' }))}
              >
                Twilio
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* API Credentials */}
      <div className="wa-section">
        <div className="wa-section-header">
          <Key size={16} className="wa-icon-amber" />
          <h3>{config.provider === 'twilio' ? 'Twilio' : 'Meta'} API Credentials</h3>
        </div>
        <div className="wa-section-content">

          {/* ── Meta credentials ── */}
          {config.provider !== 'twilio' && (
          <div className="form-grid">
            {/* API Token */}
            <div className="form-group full-width">
              <label className="form-label">API Token (Bearer)</label>
              {hasApiToken && !showToken ? (
                <div className="wa-token-field">
                  <input className="form-input" value={apiTokenPreview} readOnly style={{ color: 'var(--text-muted)' }} />
                  <button className="wa-btn wa-btn-secondary" onClick={() => setShowToken(true)}>
                    <Eye size={14} /> Change
                  </button>
                </div>
              ) : (
                <div className="wa-token-field">
                  <input
                    type="password"
                    className="form-input"
                    value={config.apiToken}
                    onChange={e => setConfig(p => ({ ...p, apiToken: e.target.value }))}
                    placeholder="EAAxxxxxxxxxxxxxxxxx..."
                    autoComplete="off"
                  />
                  {hasApiToken && (
                    <button className="wa-btn wa-btn-secondary" onClick={() => { setShowToken(false); setConfig(p => ({ ...p, apiToken: '' })); }}>
                      <EyeOff size={14} /> Cancel
                    </button>
                  )}
                </div>
              )}
              <small className="form-help">From Meta for Developers → Your App → WhatsApp → API Setup → Temporary or Permanent Token</small>
            </div>

            {/* Phone Number ID */}
            <div className="form-group">
              <label className="form-label">Phone Number ID</label>
              <input
                className="form-input"
                value={config.phoneNumberId}
                onChange={e => setConfig(p => ({ ...p, phoneNumberId: e.target.value }))}
                placeholder="123456789012345"
              />
              <small className="form-help">Found in Meta for Developers → WhatsApp → Phone Numbers</small>
            </div>

            {/* Business Account ID */}
            <div className="form-group">
              <label className="form-label">Business Account ID</label>
              <input
                className="form-input"
                value={config.businessAccountId}
                onChange={e => setConfig(p => ({ ...p, businessAccountId: e.target.value }))}
                placeholder="987654321098765"
              />
              <small className="form-help">WhatsApp Business Account (WABA) ID from Meta Business Manager</small>
            </div>

            {/* Webhook Token */}
            <div className="form-group full-width">
              <label className="form-label">Webhook Verify Token</label>
              <input
                className="form-input"
                value={config.webhookToken}
                onChange={e => setConfig(p => ({ ...p, webhookToken: e.target.value }))}
                placeholder="a-random-secret-you-choose"
              />
              <small className="form-help">
                Create any secret string. Enter it here AND in Meta for Developers → Webhooks → Verify Token field.
              </small>
            </div>

            {/* Verify credentials */}
            <div className="form-group full-width">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <button className="wa-btn wa-btn-secondary" onClick={handleVerify} disabled={verifying}>
                  {verifying ? <><Loader size={13} className="wa-spin" /> Verifying…</> : <><CheckCircle size={13} /> Verify Connection</>}
                </button>
                {verifyResult && (
                  <span style={{ fontSize: 13, color: verifyResult.ok ? 'var(--success-color, #16a34a)' : 'var(--danger-color, #dc2626)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {verifyResult.ok ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                    {verifyResult.msg}
                  </span>
                )}
              </div>
              <small className="form-help">Checks your credentials against the Meta API without sending a message.</small>
            </div>

            {/* Webhook URL (readonly + copy) */}
            <div className="form-group full-width">
              <label className="form-label"><Webhook size={12} /> Your Webhook URL</label>
              <div className="wa-token-field">
                <input
                  className="form-input"
                  value={webhookUrl}
                  readOnly
                  style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 12 }}
                />
                <button className={`wa-btn ${webhookCopied ? 'wa-btn-copied' : 'wa-btn-secondary'}`} onClick={copyWebhookUrl} title="Copy to clipboard">
                  {webhookCopied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy</>}
                </button>
              </div>
              <small className="form-help">
                Paste this URL in Meta for Developers → WhatsApp → Configuration → Webhook → Callback URL.
                Subscribe to the <strong>messages</strong> webhook field.
              </small>
            </div>
          </div>
          )} {/* end Meta credentials */}

          {/* ── Twilio credentials ── */}
          {config.provider === 'twilio' && (
          <div className="form-grid">
            {/* Account SID */}
            <div className="form-group">
              <label className="form-label">Account SID</label>
              <input
                className="form-input"
                value={config.twilioAccountSid}
                onChange={e => setConfig(p => ({ ...p, twilioAccountSid: e.target.value }))}
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                autoComplete="off"
              />
              <small className="form-help">From the Twilio Console → Account Info</small>
            </div>

            {/* Auth Token */}
            <div className="form-group">
              <label className="form-label">Auth Token</label>
              {hasTwilioAuthToken && !showTwilioToken ? (
                <div className="wa-token-field">
                  <input className="form-input" value={twilioAuthTokenPreview} readOnly style={{ color: 'var(--text-muted)' }} />
                  <button className="wa-btn wa-btn-secondary" onClick={() => setShowTwilioToken(true)}>
                    <Eye size={14} /> Change
                  </button>
                </div>
              ) : (
                <div className="wa-token-field">
                  <input
                    type="password"
                    className="form-input"
                    value={config.twilioAuthToken}
                    onChange={e => setConfig(p => ({ ...p, twilioAuthToken: e.target.value }))}
                    placeholder="Your Twilio Auth Token"
                    autoComplete="off"
                  />
                  {hasTwilioAuthToken && (
                    <button className="wa-btn wa-btn-secondary" onClick={() => { setShowTwilioToken(false); setConfig(p => ({ ...p, twilioAuthToken: '' })); }}>
                      <EyeOff size={14} /> Cancel
                    </button>
                  )}
                </div>
              )}
              <small className="form-help">From the Twilio Console → Account Info (keep secret)</small>
            </div>

            {/* From number */}
            <div className="form-group full-width">
              <label className="form-label">WhatsApp Sender Number</label>
              <input
                className="form-input"
                value={config.twilioWhatsappFrom}
                onChange={e => setConfig(p => ({ ...p, twilioWhatsappFrom: e.target.value }))}
                placeholder="+14155238886"
              />
              <small className="form-help">
                Your Twilio WhatsApp-enabled number in E.164 format, e.g. <code>+14155238886</code>.
                For the Twilio Sandbox use <code>+14155238886</code>.
                You can also enter the full <code>whatsapp:+14155238886</code> format — both are accepted.
              </small>
            </div>

            {/* Verify credentials */}
            <div className="form-group full-width">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <button className="wa-btn wa-btn-secondary" onClick={handleVerify} disabled={verifying}>
                  {verifying ? <><Loader size={13} className="wa-spin" /> Verifying…</> : <><CheckCircle size={13} /> Verify Connection</>}
                </button>
                {verifyResult && (
                  <span style={{ fontSize: 13, color: verifyResult.ok ? 'var(--success-color, #16a34a)' : 'var(--danger-color, #dc2626)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {verifyResult.ok ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                    {verifyResult.msg}
                  </span>
                )}
              </div>
              <small className="form-help">Checks your Twilio Account SID and Auth Token without sending a message.</small>
            </div>

            {/* Twilio Webhook URL (readonly + copy) */}
            <div className="form-group full-width">
              <label className="form-label"><Webhook size={12} /> Twilio Webhook URL</label>
              <div className="wa-token-field">
                <input
                  className="form-input"
                  value={twilioWebhookUrl}
                  readOnly
                  style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: 12 }}
                />
                <button className={`wa-btn ${twilioWebhookCopied ? 'wa-btn-copied' : 'wa-btn-secondary'}`} onClick={copyTwilioWebhookUrl} title="Copy to clipboard">
                  {twilioWebhookCopied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy</>}
                </button>
              </div>
              <small className="form-help">
                In the Twilio Console → Messaging → Senders → WhatsApp → your number → Sandbox or Number settings,
                set this URL as the <strong>When a message comes in</strong> webhook (HTTP POST).
              </small>
            </div>

            {/* Signature validation toggle */}
            <div className="form-group full-width">
              <label className="wa-toggle-label-title" style={{ marginBottom: 6 }}>
                <input
                  type="checkbox"
                  checked={config.twilioWebhookAuthEnabled}
                  onChange={e => setConfig(p => ({ ...p, twilioWebhookAuthEnabled: e.target.checked }))}
                  style={{ marginRight: 6 }}
                />
                <strong>Validate X-Twilio-Signature</strong>
              </label>
              <small className="form-help">Verify that webhook requests are genuinely from Twilio (recommended for production).</small>
            </div>
          </div>
          )} {/* end Twilio credentials */}

          <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
            <button className="wa-btn wa-btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <><Loader size={14} className="wa-spin" /> Saving...</> : <><Save size={14} /> Save Configuration</>}
            </button>
          </div>
        </div>
      </div>

      {/* Test Message */}
      <div className="wa-section">
        <div className="wa-section-header">
          <Send size={16} className="wa-icon-blue" />
          <h3>Send Test Message</h3>
        </div>
        <div className="wa-section-content">
          {!config.enabled && (
            <div className="wa-alert warning">
              <AlertCircle size={14} />
              WhatsApp is currently <strong>disabled</strong>. Enable it above and save before sending.
            </div>
          )}
          {config.enabled && (
            <div className="wa-alert info">
              <Info size={14} />
              Recipient must have WhatsApp installed. Use E.164 format, e.g. <code>+919876543210</code>.
            </div>
          )}
          <div className="wa-test-bar">
            <div className="form-group" style={{ minWidth: 200 }}>
              <label className="form-label">Phone Number (E.164)</label>
              <input
                className="form-input"
                value={testPhone}
                onChange={e => setTestPhone(e.target.value)}
                placeholder="+919876543210"
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Message</label>
              <input
                className="form-input"
                value={testMsg}
                onChange={e => setTestMsg(e.target.value)}
                placeholder="Test message text"
              />
            </div>
            <button className="wa-btn wa-btn-primary" onClick={handleSendTest} disabled={sending || !testPhone || !config.enabled}>
              {sending ? <><Loader size={14} className="wa-spin" /> Sending...</> : <><Send size={14} /> Send</>}
            </button>
          </div>
        </div>
      </div>

      {/* Broadcast */}
      <div className="wa-section">
        <div className="wa-section-header">
          <Megaphone size={16} className="wa-icon-purple" />
          <h3>Broadcast Message</h3>
          <span className="wa-section-header-hint"><Users size={12} /> All opted-in users</span>
        </div>
        <div className="wa-section-content">
          {!config.enabled && (
            <div className="wa-alert warning">
              <AlertCircle size={14} />
              WhatsApp is currently <strong>disabled</strong>. Enable it above and save to use broadcast.
            </div>
          )}

          {broadcastResult && (
            <div className={`wa-alert ${broadcastResult.type}`}>
              {broadcastResult.type === 'success'
                ? <><CheckCircle size={14} /> Sent to {broadcastResult.sent} of {broadcastResult.total} user{broadcastResult.total !== 1 ? 's' : ''}{broadcastResult.failed > 0 ? ` — ${broadcastResult.failed} failed` : ' — all delivered.'}</>
                : <><AlertCircle size={14} /> {broadcastResult.message}</>}
            </div>
          )}

          <div className="form-group" style={{ marginTop: broadcastResult || !config.enabled ? 14 : 0 }}>
            <label className="form-label">Message</label>
            <textarea
              className="form-input"
              rows={4}
              style={{ resize: 'vertical', fontFamily: 'inherit' }}
              placeholder="Type your broadcast message here… (max 4000 characters)"
              value={broadcastMsg}
              onChange={e => { setBroadcastMsg(e.target.value); setBroadcastConfirm(false); }}
              maxLength={4000}
              disabled={broadcastBusy}
            />
            <div style={{ textAlign: 'right', fontSize: 11, color: broadcastMsg.length > 3800 ? '#dc2626' : 'var(--text-muted)', marginTop: 2 }}>
              {broadcastMsg.length} / 4000
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
            {broadcastConfirm ? (
              <>
                <span className="wa-confirm-text">Send to all opted-in users?</span>
                <button className="wa-btn wa-btn-secondary" onClick={() => setBroadcastConfirm(false)} disabled={broadcastBusy}>
                  Cancel
                </button>
                <button
                  className="wa-btn wa-btn-danger-solid"
                  onClick={handleBroadcast}
                  disabled={broadcastBusy}
                >
                  {broadcastBusy
                    ? <><Loader size={14} className="wa-spin" /> Sending…</>
                    : <><Megaphone size={14} /> Yes, Send Now</>}
                </button>
              </>
            ) : (
              <button
                className="wa-btn wa-btn-primary"
                onClick={() => setBroadcastConfirm(true)}
                disabled={!broadcastMsg.trim() || !config.enabled}
              >
                <Megaphone size={14} /> Send Broadcast
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Message Log */}
      <div className="wa-section">
        <div className="wa-section-header">
          <BarChart2 size={16} className="wa-icon-blue" />
          <h3>Recent Message Log</h3>
          <button className="wa-btn wa-btn-secondary" style={{ marginLeft: 'auto', padding: '4px 10px' }} onClick={loadLogs} disabled={logsLoading}>
            {logsLoading ? <Loader size={12} className="wa-spin" /> : <RefreshCw size={12} />}
            {' '}Refresh
          </button>
        </div>
        <div className="wa-section-content" style={{ overflowX: 'auto' }}>
          {logs.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0', fontSize: 13 }}>
              {logsLoading ? 'Loading…' : 'No messages yet. Click Refresh to load.'}
            </div>
          ) : (
            <table className="wa-logs-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Direction</th>
                  <th>Type</th>
                  <th>From / To</th>
                  <th>Content</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.log_id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(log.created_at).toLocaleString()}</td>
                    <td>
                      <span className={`wa-badge ${log.direction === 'inbound' ? 'wa-badge-in' : 'wa-badge-out'}`}>
                        {log.direction}
                      </span>
                    </td>
                    <td><span className={typeBadgeClass(log.message_type)}>{log.message_type || '—'}</span></td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11 }}>
                      {log.direction === 'inbound' ? log.from_phone : log.to_phone}
                    </td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.template_name ? `[${log.template_name}]` : (log.content || '—')}
                    </td>
                    <td>
                      <span className={statusBadgeClass(log.status)}>{log.status || '—'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  );
};

export default WhatsAppSettingsTab;

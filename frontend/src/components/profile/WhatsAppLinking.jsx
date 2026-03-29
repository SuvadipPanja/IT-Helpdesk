// ============================================
// WhatsApp Phone Linking Component
// Allows users to link / unlink their WhatsApp
// Phase 9: WhatsApp Integration
// ============================================

import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, CheckCircle, AlertCircle, Loader, Link, Unlink, Send, Bell } from 'lucide-react';
import api from '../../services/api';

const WhatsAppLinking = () => {
  const [status, setStatus] = useState(null);   // { linked, phone, verifiedAt }
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState('idle');     // idle | enter_phone | enter_otp | linked
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [prefs, setPrefs] = useState(null);
  const otpRef = useRef(null);

  const showMsg = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg({ type: '', text: '' }), 5000);
  };

  const loadStatus = async () => {
    setLoading(true);
    try {
      const res = await api.get('/whatsapp/status');
      if (res.data.success) {
        setStatus(res.data);
        setStep(res.data.linked ? 'linked' : 'idle');
      }
    } catch {
      // WhatsApp may not be enabled — silently skip
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStatus(); }, []);

  const loadPreferences = async () => {
    try {
      const res = await api.get('/whatsapp/preferences');
      if (res.data.success) setPrefs(res.data.preferences);
    } catch { /* WhatsApp may not be enabled — silent */ }
  };

  useEffect(() => {
    if (step === 'linked') loadPreferences();
  }, [step]);

  const handleTogglePref = async (key) => {
    const prev = prefs;
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    try {
      await api.put('/whatsapp/preferences', updated);
    } catch {
      setPrefs(prev);
      showMsg('error', 'Failed to save preference');
    }
  };

  const handleRequestOTP = async () => {
    const trimmed = phone.trim();
    if (!/^\+\d{7,15}$/.test(trimmed)) {
      showMsg('error', 'Enter a valid phone in E.164 format, e.g. +919876543210');
      return;
    }
    setBusy(true);
    try {
      const res = await api.post('/whatsapp/send-otp', { phone: trimmed });
      if (res.data.success) {
        setStep('enter_otp');
        showMsg('success', 'OTP sent to your WhatsApp! It expires in 10 minutes.');
        setTimeout(() => otpRef.current?.focus(), 100);
      } else {
        showMsg('error', res.data.error || 'Failed to send OTP');
      }
    } catch (e) {
      showMsg('error', e.response?.data?.error || 'Unable to send OTP');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!/^\d{6}$/.test(otp.trim())) {
      showMsg('error', 'Please enter the 6-digit code');
      return;
    }
    setBusy(true);
    try {
      const res = await api.post('/whatsapp/verify-otp', { phone: phone.trim(), code: otp.trim() });
      if (res.data.success) {
        showMsg('success', 'WhatsApp linked successfully!');
        await loadStatus();
        setOtp('');
      } else {
        showMsg('error', res.data.error || 'Invalid or expired code');
      }
    } catch (e) {
      showMsg('error', e.response?.data?.error || 'Verification failed');
    } finally {
      setBusy(false);
    }
  };

  const handleUnlink = async () => {
    if (!window.confirm('Unlink your WhatsApp number? You will stop receiving WhatsApp notifications.')) return;
    setBusy(true);
    try {
      const res = await api.delete('/whatsapp/unlink');
      if (res.data.success) {
        showMsg('success', 'WhatsApp unlinked');
        setPhone('');
        await loadStatus();
      }
    } catch (e) {
      showMsg('error', e.response?.data?.error || 'Failed to unlink');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="wa-linking-card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 16 }}>
        <Loader size={16} style={{ animation: 'spin 0.7s linear infinite' }} />
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading WhatsApp status…</span>
      </div>
    );
  }

  // If the status endpoint returned nothing, WhatsApp might be disabled
  if (!status) return null;

  return (
    <div className="profile-card wa-linking-card" style={{ marginTop: 0 }}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <MessageSquare size={20} style={{ color: '#25D366' }} />
        WhatsApp Notifications
      </h3>

      {/* Alert */}
      {msg.text && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
          borderRadius: 6, fontSize: 13, marginBottom: 12,
          background: msg.type === 'success' ? '#dcfce7' : '#fee2e2',
          color: msg.type === 'success' ? '#166534' : '#991b1b',
          border: `1px solid ${msg.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
        }}>
          {msg.type === 'success' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
          {msg.text}
        </div>
      )}

      {/* State: already linked */}
      {step === 'linked' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 13 }}>
            <CheckCircle size={16} style={{ color: '#25D366' }} />
            <span>Linked to <strong>{status.phone}</strong></span>
            {status.verifiedAt && (
              <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>
                · verified {new Date(status.verifiedAt).toLocaleDateString()}
              </span>
            )}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
            You will receive ticket updates and notifications via WhatsApp.
          </p>
          <button
            onClick={handleUnlink}
            disabled={busy}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 6, fontSize: 13,
              background: '#fee2e2', color: '#dc2626', border: 'none', cursor: 'pointer',
              opacity: busy ? 0.5 : 1,
            }}
          >
            {busy ? <Loader size={13} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Unlink size={13} />}
            Unlink WhatsApp
          </button>

          {/* Notification preferences */}
          {prefs && (
            <div style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <Bell size={14} style={{ color: 'var(--text-secondary)' }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Notification Preferences
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { key: 'is_enabled',        label: 'Enable WhatsApp notifications', bold: true },
                  { key: 'notify_new_ticket', label: 'New ticket confirmation' },
                  { key: 'notify_assigned',   label: 'Ticket assigned to me' },
                  { key: 'notify_update',     label: 'Status updates' },
                  { key: 'notify_resolved',   label: 'Ticket resolved / closed' },
                  { key: 'notify_comment',    label: 'New comments' },
                  { key: 'notify_sla_breach', label: 'SLA warning & breach' },
                  { key: 'notify_approval',   label: 'Approval requests' },
                ].map(({ key, label, bold }) => (
                  <label key={key} style={{
                    display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                    fontSize: 13, fontWeight: bold ? 600 : 400, color: 'var(--text-primary)',
                    opacity: key !== 'is_enabled' && !prefs.is_enabled ? 0.45 : 1,
                    pointerEvents: key !== 'is_enabled' && !prefs.is_enabled ? 'none' : 'auto',
                  }}>
                    <input
                      type="checkbox"
                      checked={!!prefs[key]}
                      onChange={() => handleTogglePref(key)}
                      style={{ accentColor: '#25D366', width: 16, height: 16, cursor: 'pointer' }}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* State: idle — enter phone */}
      {(step === 'idle' || step === 'enter_phone') && (
        <div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
            Link your WhatsApp number to receive ticket notifications and chat with the IT bot.
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                WhatsApp Phone Number (E.164)
              </label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+919876543210"
                style={{
                  padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)', color: 'var(--text-primary)',
                  fontSize: 13, width: '100%', boxSizing: 'border-box',
                }}
                onKeyDown={e => e.key === 'Enter' && handleRequestOTP()}
              />
            </div>
            <button
              onClick={handleRequestOTP}
              disabled={busy || !phone}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 6, fontSize: 13,
                background: '#25D366', color: 'white', border: 'none', cursor: 'pointer',
                flexShrink: 0, opacity: (busy || !phone) ? 0.5 : 1,
              }}
            >
              {busy ? <Loader size={13} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Send size={13} />}
              Send OTP
            </button>
          </div>
        </div>
      )}

      {/* State: enter OTP */}
      {step === 'enter_otp' && (
        <div>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
            A 6-digit code was sent to <strong>{phone}</strong> via WhatsApp.
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
                Verification Code
              </label>
              <input
                ref={otpRef}
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                style={{
                  padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)', color: 'var(--text-primary)',
                  fontSize: 16, fontFamily: 'monospace', letterSpacing: 4,
                  width: '100%', boxSizing: 'border-box', textAlign: 'center',
                }}
                onKeyDown={e => e.key === 'Enter' && handleVerifyOTP()}
              />
            </div>
            <button
              onClick={handleVerifyOTP}
              disabled={busy || otp.length !== 6}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 6, fontSize: 13,
                background: '#25D366', color: 'white', border: 'none', cursor: 'pointer',
                flexShrink: 0, opacity: (busy || otp.length !== 6) ? 0.5 : 1,
              }}
            >
              {busy ? <Loader size={13} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Link size={13} />}
              Verify
            </button>
          </div>
          <button
            onClick={() => { setStep('enter_phone'); setOtp(''); }}
            style={{ marginTop: 8, background: 'none', border: 'none', fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
          >
            ← Use a different number
          </button>
        </div>
      )}
    </div>
  );
};

export default WhatsAppLinking;

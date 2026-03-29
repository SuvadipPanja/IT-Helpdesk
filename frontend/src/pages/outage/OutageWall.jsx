/**
 * ============================================
 * OUTAGE WALL PAGE — Enhanced v2
 * End-user-facing wall with rich field rendering,
 * animations, and visually striking design
 * matching real-world maintenance notification format.
 * ============================================
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  AlertTriangle, CheckCircle, Clock, RefreshCw, Eye,
  ChevronDown, Shield, Activity,
  Wifi, WifiOff, Server, Globe, Radio
} from 'lucide-react';
import api from '../../services/api';
import '../../styles/OutageWall.css';

const SEVERITY_CONFIG = {
  critical: { label: 'CRITICAL', className: 'outage-severity-critical', pulse: true, icon: WifiOff },
  high:     { label: 'HIGH',     className: 'outage-severity-high',     pulse: false, icon: AlertTriangle },
  medium:   { label: 'MEDIUM',   className: 'outage-severity-medium',   pulse: false, icon: Activity },
  low:      { label: 'LOW',      className: 'outage-severity-low',      pulse: false, icon: Server },
  info:     { label: 'INFO',     className: 'outage-severity-info',     pulse: false, icon: Globe },
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h ago`;
}

function formatDateTime(v) {
  if (!v) return '—';
  try {
    const d = new Date(v);
    if (isNaN(d)) return v;
    return d.toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
  } catch { return v; }
}

/** Smart field value renderer based on field type */
function FieldValue({ field }) {
  const { field_label, field_value, field_type, field_key } = field;
  const val = field_value || '—';

  if (field_type === 'boolean') {
    const isYes = /^(yes|true|1)$/i.test(val);
    const isNo = /^(no|false|0)$/i.test(val);
    return (
      <div className="outage-field">
        <div className="outage-field-label">{field_label}</div>
        <div className={`outage-field-value outage-field-boolean ${isYes ? 'outage-bool-yes' : isNo ? 'outage-bool-no' : ''}`}>
          {isYes ? '✓ Yes' : isNo ? '✗ No' : val}
        </div>
      </div>
    );
  }

  if (field_type === 'ip_list' && val !== '—') {
    const ips = val.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
    return (
      <div className="outage-field outage-field-full">
        <div className="outage-field-label">{field_label}</div>
        <div className="outage-field-value outage-ip-list">
          {ips.map((ip, i) => (
            <span key={i} className="outage-ip-tag">
              <Server size={11} /> {ip}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (field_type === 'datetime' || /time|date|_at$/i.test(field_key || '')) {
    return (
      <div className="outage-field">
        <div className="outage-field-label">{field_label}</div>
        <div className="outage-field-value outage-field-datetime">
          <Clock size={13} /> {formatDateTime(val)}
        </div>
      </div>
    );
  }

  if (field_type === 'duration') {
    return (
      <div className="outage-field">
        <div className="outage-field-label">{field_label}</div>
        <div className="outage-field-value outage-field-duration">
          <Clock size={13} /> {val}
        </div>
      </div>
    );
  }

  if (field_type === 'textarea' || val.length > 80) {
    return (
      <div className="outage-field outage-field-full">
        <div className="outage-field-label">{field_label}</div>
        <div className="outage-field-value">{val}</div>
      </div>
    );
  }

  return (
    <div className="outage-field">
      <div className="outage-field-label">{field_label}</div>
      <div className="outage-field-value">{val}</div>
    </div>
  );
}

export default function OutageWall() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const viewedRef = useRef(new Set());

  const fetchWall = useCallback(async () => {
    try {
      const res = await api.get('/outage/wall');
      setNotifications(res.data?.data || []);
      setLastRefresh(new Date());
    } catch {
      // Silently fail — wall is informational
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchWall(); }, [fetchWall]);

  useEffect(() => {
    const timer = setInterval(fetchWall, 60000);
    return () => clearInterval(timer);
  }, [fetchWall]);

  const toggleExpand = async (id) => {
    const isExpanding = expandedId !== id;
    setExpandedId(prev => prev === id ? null : id);
    if (isExpanding && !viewedRef.current.has(id)) {
      viewedRef.current.add(id);
      try { await api.post(`/outage/wall/${id}/view`); } catch {}
    }
  };

  const activeNotifications = notifications.filter(n => n.status === 'active');
  const resolvedNotifications = notifications.filter(n => n.status === 'resolved');

  return (
    <div className="outage-wall-container">
      {/* Header */}
      <div className="outage-wall-header">
        <div className="outage-wall-header-left">
          <div className="outage-wall-logo">
            <Radio size={22} className="outage-wall-logo-icon" />
          </div>
          <div>
            <h1 className="outage-wall-title">Service Status</h1>
            <p className="outage-wall-subtitle">
              Live system health · Last checked {lastRefresh.toLocaleTimeString()}
            </p>
          </div>
        </div>
        <div className="outage-wall-header-right">
          <div className="outage-wall-live-dot" />
          <span className="outage-wall-live-text">LIVE</span>
          <button className="outage-wall-refresh" onClick={() => { setLoading(true); fetchWall(); }}>
            <RefreshCw size={15} className={loading ? 'spinning' : ''} />
          </button>
        </div>
      </div>

      {/* Status Summary */}
      {!loading && (
        <div className="outage-wall-summary">
          {activeNotifications.length === 0 ? (
            <div className="outage-wall-all-clear">
              <div className="outage-wall-all-clear-icon">
                <CheckCircle size={28} />
              </div>
              <div>
                <div className="outage-wall-all-clear-title">All Systems Operational</div>
                <div className="outage-wall-all-clear-sub">No active outages at this time</div>
              </div>
              <Wifi size={20} className="outage-wall-all-clear-wifi" />
            </div>
          ) : (
            <div className="outage-wall-active-banner">
              <div className="outage-wall-banner-pulse-ring" />
              <AlertTriangle size={20} />
              <span>{activeNotifications.length} active outage{activeNotifications.length > 1 ? 's' : ''} detected</span>
              <div className="outage-wall-banner-count">{activeNotifications.length}</div>
            </div>
          )}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="outage-wall-loading">
          <div className="outage-wall-loading-ring">
            <RefreshCw size={28} className="spinning" />
          </div>
          <p>Checking system status...</p>
        </div>
      )}

      {/* Active Outages */}
      {activeNotifications.length > 0 && (
        <div className="outage-wall-section">
          <h2 className="outage-wall-section-title">
            <AlertTriangle size={18} /> Active Outages
            <span className="outage-wall-section-count">{activeNotifications.length}</span>
          </h2>
          {activeNotifications.map((n, idx) => {
            const sevCfg = SEVERITY_CONFIG[n.severity] || SEVERITY_CONFIG.medium;
            const SevIcon = sevCfg.icon;
            const isExpanded = expandedId === n.notification_id;
            return (
              <div key={n.notification_id}
                className={`outage-card outage-card-active ${sevCfg.pulse ? 'outage-card-pulse' : ''}`}
                style={{ '--card-color': n.header_color || '#ef4444', '--card-delay': `${idx * 0.08}s` }}>

                {/* Color banner top */}
                <div className="outage-card-banner" style={{ background: n.header_color || '#ef4444' }}>
                  <SevIcon size={15} />
                  <span className="outage-card-banner-text">{n.template_name}</span>
                  <div className="outage-card-banner-right">
                    <span className={`outage-badge ${sevCfg.className}`}>{sevCfg.label}</span>
                  </div>
                </div>

                <div className="outage-card-header" onClick={() => toggleExpand(n.notification_id)}>
                  <div className="outage-card-main">
                    <h3 className="outage-card-title">{n.title}</h3>
                    <div className="outage-card-meta">
                      <span className="outage-card-meta-item">
                        <Clock size={12} /> {timeAgo(n.published_at)}
                      </span>
                      <span className="outage-card-meta-sep">·</span>
                      <span className="outage-card-meta-item">
                        Published by {n.published_by_name || n.created_by_name}
                      </span>
                      <span className="outage-card-meta-sep">·</span>
                      <span className="outage-card-meta-item">
                        <Eye size={12} /> {n.view_count || 0}
                      </span>
                    </div>
                  </div>
                  <button className={`outage-card-expand ${isExpanded ? 'outage-card-expand-open' : ''}`}>
                    <ChevronDown size={20} />
                  </button>
                </div>

                {isExpanded && (
                  <div className="outage-card-body">
                    <div className="outage-card-fields">
                      {(n.field_values || []).map((fv, i) => (
                        <FieldValue key={i} field={fv} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Recently Resolved */}
      {resolvedNotifications.length > 0 && (
        <div className="outage-wall-section">
          <h2 className="outage-wall-section-title outage-wall-section-resolved">
            <CheckCircle size={18} /> Recently Resolved
            <span className="outage-wall-section-count outage-wall-section-count-resolved">{resolvedNotifications.length}</span>
          </h2>
          {resolvedNotifications.map((n, idx) => {
            const isExpanded = expandedId === n.notification_id;
            return (
              <div key={n.notification_id}
                className="outage-card outage-card-resolved"
                style={{ '--card-color': '#22c55e', '--card-delay': `${idx * 0.08}s` }}>

                <div className="outage-card-banner outage-card-banner-resolved">
                  <CheckCircle size={15} />
                  <span className="outage-card-banner-text">{n.template_name}</span>
                  <div className="outage-card-banner-right">
                    <span className="outage-badge outage-badge-resolved">RESOLVED</span>
                  </div>
                </div>

                <div className="outage-card-header" onClick={() => toggleExpand(n.notification_id)}>
                  <div className="outage-card-main">
                    <h3 className="outage-card-title">{n.title}</h3>
                    <div className="outage-card-meta">
                      <span className="outage-card-meta-item">
                        <Clock size={12} /> Resolved {timeAgo(n.resolved_at)}
                      </span>
                      <span className="outage-card-meta-sep">·</span>
                      <span className="outage-card-meta-item">
                        by {n.resolved_by_name || '—'}
                      </span>
                    </div>
                  </div>
                  <button className={`outage-card-expand ${isExpanded ? 'outage-card-expand-open' : ''}`}>
                    <ChevronDown size={20} />
                  </button>
                </div>

                {isExpanded && (
                  <div className="outage-card-body">
                    <div className="outage-card-fields">
                      {(n.field_values || []).map((fv, i) => (
                        <FieldValue key={i} field={fv} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* No notifications at all */}
      {!loading && notifications.length === 0 && (
        <div className="outage-wall-empty">
          <div className="outage-wall-empty-icon">
            <Shield size={48} />
          </div>
          <h3>No Service Alerts</h3>
          <p>There are no active or recent outage notifications for your account.</p>
        </div>
      )}
    </div>
  );
}

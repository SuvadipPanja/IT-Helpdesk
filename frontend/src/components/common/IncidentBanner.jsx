// ============================================
// INCIDENT BANNER COMPONENT
// Shows active/known service incidents at the top of the app
// Polls every 2 minutes. Dismissable per-incident per-session.
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, AlertCircle, Info, X, RefreshCw, ExternalLink } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../../utils/constants';

// Severity → visual config
const SEVERITY_CONFIG = {
  critical: {
    bg: '#fef2f2',
    border: '#fca5a5',
    text: '#991b1b',
    accent: '#ef4444',
    Icon: AlertTriangle,
    label: 'CRITICAL',
  },
  high: {
    bg: '#fff7ed',
    border: '#fdba74',
    text: '#9a3412',
    accent: '#f97316',
    Icon: AlertTriangle,
    label: 'HIGH',
  },
  medium: {
    bg: '#fffbeb',
    border: '#fcd34d',
    text: '#92400e',
    accent: '#f59e0b',
    Icon: AlertCircle,
    label: 'MEDIUM',
  },
  low: {
    bg: '#eff6ff',
    border: '#93c5fd',
    text: '#1e40af',
    accent: '#3b82f6',
    Icon: Info,
    label: 'LOW',
  },
  info: {
    bg: '#f0fdf4',
    border: '#86efac',
    text: '#166534',
    accent: '#22c55e',
    Icon: Info,
    label: 'INFO',
  },
};

const STATUS_LABELS = {
  active: 'Ongoing',
  monitoring: 'Monitoring',
  resolved: 'Resolved',
};

const POLL_INTERVAL = 2 * 60 * 1000; // 2 minutes
const STORAGE_KEY = 'dismissed_incidents';

function getDismissed() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function dismiss(id) {
  const list = getDismissed();
  if (!list.includes(id)) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...list, id]));
  }
}

// ============================================
// SINGLE INCIDENT BANNER CARD
// ============================================
function IncidentCard({ incident, onDismiss }) {
  const cfg = SEVERITY_CONFIG[incident.severity] || SEVERITY_CONFIG.medium;
  const { Icon } = cfg;
  const now = new Date();
  const created = new Date(incident.created_at);
  const minutesAgo = Math.floor((now - created) / 60000);
  const timeLabel =
    minutesAgo < 1   ? 'just now'
    : minutesAgo < 60 ? `${minutesAgo}m ago`
    : minutesAgo < 1440 ? `${Math.floor(minutesAgo / 60)}h ago`
    : `${Math.floor(minutesAgo / 1440)}d ago`;

  return (
    <div
      style={{
        background: cfg.bg,
        borderLeft: `4px solid ${cfg.accent}`,
        border: `1px solid ${cfg.border}`,
        borderLeftWidth: '4px',
        borderRadius: '8px',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        position: 'relative',
      }}
    >
      {/* Icon */}
      <Icon size={20} color={cfg.accent} style={{ flexShrink: 0, marginTop: 2 }} />

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              color: cfg.accent,
              background: `${cfg.accent}20`,
              padding: '2px 6px',
              borderRadius: '4px',
              letterSpacing: '0.5px',
            }}
          >
            {cfg.label}
          </span>
          <span
            style={{
              fontSize: '11px',
              color: cfg.text,
              opacity: 0.7,
              background: `${cfg.border}60`,
              padding: '2px 6px',
              borderRadius: '4px',
            }}
          >
            {STATUS_LABELS[incident.status] || incident.status}
          </span>
          <span style={{ fontSize: '11px', color: cfg.text, opacity: 0.6 }}>
            {timeLabel}
          </span>
        </div>
        <p style={{ margin: '4px 0 2px', fontWeight: 600, color: cfg.text, fontSize: '14px' }}>
          {incident.title}
        </p>
        <p style={{ margin: 0, color: cfg.text, fontSize: '13px', opacity: 0.85, lineHeight: 1.5 }}>
          {incident.description}
        </p>
        {incident.affected_services && (
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: cfg.text, opacity: 0.7 }}>
            <strong>Affected:</strong> {incident.affected_services}
          </p>
        )}
      </div>

      {/* Dismiss */}
      <button
        onClick={() => onDismiss(incident.id)}
        title="Dismiss this incident"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px',
          color: cfg.text,
          opacity: 0.5,
          flexShrink: 0,
          borderRadius: '4px',
          transition: 'opacity 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.5')}
        aria-label="Dismiss incident"
      >
        <X size={16} />
      </button>
    </div>
  );
}

// ============================================
// MAIN INCIDENT BANNER CONTAINER
// ============================================
export default function IncidentBanner() {
  const [incidents, setIncidents] = useState([]);
  const [dismissed, setDismissed] = useState(getDismissed());
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchIncidents = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/status/active`);
      const data = res.data?.data?.incidents || [];
      setIncidents(data);
      setLastRefresh(new Date());
    } catch {
      // Silently ignore — banner is non-critical
    }
  }, []);

  useEffect(() => {
    fetchIncidents();
    const timer = setInterval(fetchIncidents, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [fetchIncidents]);

  const handleDismiss = useCallback((id) => {
    dismiss(id);
    setDismissed((prev) => [...prev, id]);
  }, []);

  const visible = incidents.filter((i) => !dismissed.includes(i.id));

  if (visible.length === 0) return null;

  return (
    <div
      role="alert"
      aria-label="Service incident notifications"
      style={{
        padding: '8px 16px',
        background: '#fff8f0',
        borderBottom: '1px solid #fed7aa',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#9a3412', letterSpacing: '0.5px' }}>
          SERVICE INCIDENTS ({visible.length})
        </span>
        <button
          onClick={fetchIncidents}
          title="Refresh incidents"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#9a3412',
            opacity: 0.6,
            padding: '2px 4px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '11px',
          }}
        >
          <RefreshCw size={12} />
          Refresh
        </button>
      </div>

      {/* Incident cards */}
      {visible.map((incident) => (
        <IncidentCard key={incident.id} incident={incident} onDismiss={handleDismiss} />
      ))}
    </div>
  );
}

// ============================================
// INCIDENT BANNER COMPONENT
// Shows active/known service incidents at the top of the app
// Polls every 2 minutes. Dismissable per-incident per-session.
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, AlertCircle, Info, X, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../../utils/constants';
import '../../styles/IncidentBanner.css';

// Severity → label/icon config
const SEVERITY_CONFIG = {
  critical: {
    Icon: AlertTriangle,
    label: 'CRITICAL',
  },
  high: {
    Icon: AlertTriangle,
    label: 'HIGH',
  },
  medium: {
    Icon: AlertCircle,
    label: 'MEDIUM',
  },
  low: {
    Icon: Info,
    label: 'LOW',
  },
  info: {
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
  const severityClass = `incident-card--${incident.severity || 'medium'}`;
  const now = new Date();
  const created = new Date(incident.created_at);
  const minutesAgo = Math.floor((now - created) / 60000);
  const timeLabel =
    minutesAgo < 1   ? 'just now'
    : minutesAgo < 60 ? `${minutesAgo}m ago`
    : minutesAgo < 1440 ? `${Math.floor(minutesAgo / 60)}h ago`
    : `${Math.floor(minutesAgo / 1440)}d ago`;

  return (
    <div className={`incident-card ${severityClass}`}>
      {/* Icon */}
      <Icon size={20} className="incident-card__icon" />

      {/* Content */}
      <div className="incident-card__content">
        <div className="incident-card__meta">
          <span className="incident-card__badge">{cfg.label}</span>
          <span className="incident-card__status">{STATUS_LABELS[incident.status] || incident.status}</span>
          <span className="incident-card__time">{timeLabel}</span>
        </div>
        <p className="incident-card__title">{incident.title}</p>
        <p className="incident-card__description">{incident.description}</p>
        {incident.affected_services && (
          <p className="incident-card__services">
            <strong>Affected:</strong> {incident.affected_services}
          </p>
        )}
      </div>

      {/* Dismiss */}
      <button
        type="button"
        onClick={() => onDismiss(incident.id)}
        title="Dismiss this incident"
        className="incident-card__dismiss"
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
    let timer = null;

    const stopPolling = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    const startPolling = () => {
      if (timer || document.hidden) {
        return;
      }

      timer = setInterval(fetchIncidents, POLL_INTERVAL);
    };

    if (!document.hidden) {
      fetchIncidents();
    }
    startPolling();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
        return;
      }

      fetchIncidents();
      startPolling();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
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
      className="incident-banner"
    >
      {/* Header row */}
      <div className="incident-banner__header">
        <span className="incident-banner__title">
          SERVICE INCIDENTS ({visible.length})
        </span>
        <button
          type="button"
          onClick={fetchIncidents}
          title="Refresh incidents"
          className="incident-banner__refresh"
          aria-label="Refresh service incidents"
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

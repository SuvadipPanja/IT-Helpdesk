// ============================================================
// AnnouncementBanner — System-wide status/maintenance notices
// Fetches active announcements from backend and shows colored
// dismissible banners at the top of the page.
// ============================================================
import { useState, useEffect } from 'react';
import { X, AlertTriangle, Info, AlertCircle, Settings } from 'lucide-react';
import { kbService } from '../../services/kbService';

const TYPE_CONFIG = {
  info:        { bg: '#eff6ff', border: '#93c5fd', text: '#1e40af', Icon: Info,          label: 'Notice' },
  warning:     { bg: '#fffbeb', border: '#fcd34d', text: '#92400e', Icon: AlertTriangle,  label: 'Warning' },
  critical:    { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b', Icon: AlertCircle,    label: 'Outage' },
  maintenance: { bg: '#f5f3ff', border: '#c4b5fd', text: '#4c1d95', Icon: Settings,       label: 'Maintenance' },
};

export default function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState([]);
  const [dismissed, setDismissed] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('kb_dismissed') || '[]'); }
    catch { return []; }
  });

  useEffect(() => {
    kbService.getAnnouncements()
      .then(r => setAnnouncements(r.data?.data || []))
      .catch(() => {});
  }, []);

  const visible = announcements.filter(a => !dismissed.includes(a.announcement_id));
  if (!visible.length) return null;

  const dismiss = (id) => {
    const next = [...dismissed, id];
    setDismissed(next);
    sessionStorage.setItem('kb_dismissed', JSON.stringify(next));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {visible.map(ann => {
        const cfg = TYPE_CONFIG[ann.type] || TYPE_CONFIG.info;
        const { Icon } = cfg;
        return (
          <div
            key={ann.announcement_id}
            style={{
              background: cfg.bg,
              borderLeft: `4px solid ${cfg.border}`,
              color: cfg.text,
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              fontSize: '14px',
              lineHeight: '1.4',
            }}
          >
            <Icon size={16} style={{ marginTop: '2px', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <strong>{ann.title}</strong>
              {ann.body && <span style={{ marginLeft: '8px' }}>{ann.body}</span>}
            </div>
            <button
              onClick={() => dismiss(ann.announcement_id)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: cfg.text, padding: '2px', flexShrink: 0
              }}
              title="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

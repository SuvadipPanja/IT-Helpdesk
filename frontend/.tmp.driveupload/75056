// ============================================
// SCROLLING ANNOUNCEMENT TICKER
// Marquee-style announcement in header
// Developer: Suvadip Panja
// ============================================

import { useState, useEffect } from 'react';
import { getSetting } from '../../utils/settingsLoader';
import { X, Bell } from 'lucide-react';
import '../../styles/AnnouncementTicker.css';

const AnnouncementTicker = () => {
  const [dismissed, setDismissed] = useState(false);

  // Get settings
  const announcementEnabledRaw = getSetting('announcement_enabled', 'false');
  const announcementText = getSetting('system_announcement', '');

  // Parse enabled value
  const isEnabled = 
    announcementEnabledRaw === 'true' || 
    announcementEnabledRaw === true || 
    announcementEnabledRaw === 1 ||
    announcementEnabledRaw === '1';

  // Don't show if disabled, dismissed, or no text
  if (!isEnabled || dismissed || !announcementText || !announcementText.trim()) {
    return null;
  }

  return (
    <div className="announcement-ticker">
      <div className="ticker-icon">
        <Bell size={16} />
      </div>
      <div className="ticker-content">
        <div className="ticker-text">
          <span>{announcementText}</span>
          <span>{announcementText}</span> {/* Duplicate for seamless loop */}
          <span>{announcementText}</span>
        </div>
      </div>
      <button 
        className="ticker-close"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss announcement"
        title="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
};

export default AnnouncementTicker;
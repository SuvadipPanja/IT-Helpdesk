// ============================================
// SYSTEM ANNOUNCEMENT BANNER
// Global notification banner from settings
// ============================================

import { useState } from 'react';
import { getSetting } from '../../utils/settingsLoader';
import { X, AlertCircle } from 'lucide-react';
import '../../styles/AnnouncementBanner.css';

const AnnouncementBanner = () => {
  const [dismissed, setDismissed] = useState(false);

  // Get announcement settings
  const announcementEnabled = getSetting('announcement_enabled', 'false') === 'true';
  const announcementText = getSetting('system_announcement', '');

  // Don't show if disabled, dismissed, or no text
  if (!announcementEnabled || dismissed || !announcementText.trim()) {
    return null;
  }

  return (
    <div className="announcement-banner">
      <div className="announcement-content">
        <AlertCircle size={18} className="announcement-icon" />
        <p className="announcement-text">{announcementText}</p>
      </div>
      <button 
        className="announcement-close"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss announcement"
      >
        <X size={18} />
      </button>
    </div>
  );
};

export default AnnouncementBanner;
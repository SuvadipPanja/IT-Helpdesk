// ============================================
// EMAIL QUEUE STATISTICS COMPONENT
// Displays email queue statistics cards
// FILE: frontend/src/components/email/EmailQueueStats.jsx
// ============================================

import React from 'react';
import { 
  Mail, 
  CheckCircle, 
  XCircle, 
  Clock
} from 'lucide-react';

const EmailQueueStats = ({ stats, loading }) => {
  
  // Loading skeleton
  if (loading) {
    return (
      <div className="stats-grid">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="stat-card skeleton">
            <div className="skeleton-line skeleton-line--label"></div>
            <div className="skeleton-line skeleton-line--value"></div>
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: 'Total Emails',
      value: stats?.total_emails || 0,
      icon: Mail,
      tone: 'info',
    },
    {
      title: 'Sent',
      value: stats?.sent_count || 0,
      icon: CheckCircle,
      tone: 'success',
    },
    {
      title: 'Failed',
      value: stats?.failed_count || 0,
      icon: XCircle,
      tone: 'danger',
    },
    {
      title: 'Pending',
      value: stats?.pending_count || 0,
      icon: Clock,
      tone: 'warning',
    },
  ];

  return (
    <div className="stats-grid">
      {cards.map((card, index) => (
        <div key={index} className="stat-card">
          <div className="stat-card-content">
            <div className="stat-info">
              <p className="stat-label">{card.title}</p>
              <p className="stat-value">{card.value.toLocaleString()}</p>
            </div>
            <div className={`stat-icon tone-${card.tone}`}>
              <card.icon style={{ width: '2rem', height: '2rem' }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default EmailQueueStats;
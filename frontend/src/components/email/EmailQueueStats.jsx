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
            <div style={{ height: '1rem', background: '#e5e7eb', borderRadius: '0.25rem', width: '50%', marginBottom: '0.75rem' }}></div>
            <div style={{ height: '2rem', background: '#e5e7eb', borderRadius: '0.25rem', width: '75%' }}></div>
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
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Sent',
      value: stats?.sent_count || 0,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: 'Failed',
      value: stats?.failed_count || 0,
      icon: XCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-100',
    },
    {
      title: 'Pending',
      value: stats?.pending_count || 0,
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100',
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
            <div className={`stat-icon ${card.bgColor} ${card.color}`}>
              <card.icon style={{ width: '2rem', height: '2rem' }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default EmailQueueStats;
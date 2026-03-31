// ============================================
// EMAIL DETAIL MODAL COMPONENT
// Shows detailed information about an email
// FILE: frontend/src/components/email/EmailDetailModal.jsx
// ============================================

import React from 'react';
import { X, Mail, User, Calendar, AlertCircle, Package, RotateCw } from 'lucide-react';
import { formatDateTime } from '../../utils/dateUtils';

const EmailDetailModal = ({ email, isOpen, onClose }) => {
  if (!isOpen || !email) return null;

  const getStatusBadgeClass = (status) => {
    const classes = {
      SENT: 'status-badge sent',
      PENDING: 'status-badge pending',
      FAILED: 'status-badge failed',
    };
    return classes[status] || 'status-badge';
  };

  const infoItems = [
    { icon: Mail, label: 'Recipient Email', value: email.recipient_email },
    { icon: User, label: 'Recipient Name', value: email.recipient_name || 'N/A' },
    { icon: Package, label: 'Email Type', value: email.email_type },
    { icon: Package, label: 'Template Used', value: email.template_used || 'N/A' },
    { icon: Calendar, label: 'Created At', value: formatDateTime(email.created_at) },
    { icon: Calendar, label: 'Sent At', value: email.sent_at ? formatDateTime(email.sent_at) : 'Not sent yet' },
    { icon: RotateCw, label: 'Retry Count', value: `${email.retry_count} / ${email.max_retries}` },
    { icon: AlertCircle, label: 'Priority', value: `Level ${email.priority}` },
  ];

  return (
    <div className="email-detail-modal-overlay" onClick={onClose}>
      <div className="email-detail-modal" onClick={(event) => event.stopPropagation()}>
        <div className="email-detail-modal__header">
          <div className="email-detail-modal__title-group">
            <div className="email-detail-modal__title-icon">
              <Mail style={{ width: '1.25rem', height: '1.25rem' }} />
            </div>
            <div className="email-detail-modal__title-copy">
              <h2>Email details</h2>
              <p>Review recipient metadata, delivery status, and the rendered email body.</p>
            </div>
          </div>

          <button type="button" className="email-detail-modal__close" onClick={onClose}>
            <X style={{ width: '1.25rem', height: '1.25rem' }} />
          </button>
        </div>

        <div className="email-detail-modal__body">
          <div className="email-detail-modal__status">
            <span className={getStatusBadgeClass(email.status)}>{email.status}</span>
          </div>

          <div className="email-detail-modal__grid">
            {infoItems.map((item) => (
              <div key={item.label} className="email-detail-modal__field">
                <label className="email-detail-modal__field-label">
                  <item.icon style={{ width: '0.95rem', height: '0.95rem' }} />
                  {item.label}
                </label>
                <p className="email-detail-modal__field-value">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="email-detail-modal__section">
            <label className="email-detail-modal__section-label">Subject</label>
            <div className="email-detail-modal__panel">{email.subject}</div>
          </div>

          {email.error_message && (
            <div className="email-detail-modal__section">
              <label className="email-detail-modal__section-label email-detail-modal__section-label--danger">
                <AlertCircle style={{ width: '0.95rem', height: '0.95rem' }} />
                Error Message
              </label>
              <div className="email-detail-modal__panel email-detail-modal__panel--danger">
                {email.error_message}
              </div>
            </div>
          )}

          <div className="email-detail-modal__section">
            <label className="email-detail-modal__section-label">Email Body Preview</label>
            <div className="email-detail-modal__panel email-detail-modal__iframe-wrap">
              <iframe
                srcDoc={email.body}
                className="email-detail-modal__iframe"
                title="Email Preview"
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        </div>

        <div className="email-detail-modal__footer">
          <button type="button" onClick={onClose} className="nx-btn nx-btn--secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailDetailModal;
// ============================================
// EMAIL DETAIL MODAL COMPONENT
// Shows detailed information about an email
// FILE: frontend/src/components/email/EmailDetailModal.jsx
// ============================================

import React from 'react';
import { X, Mail, User, Calendar, AlertCircle, Package } from 'lucide-react';

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

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '0.5rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
          maxWidth: '56rem',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1.5rem',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: '#111827',
            margin: 0
          }}>
            Email Details
          </h2>
          <button
            onClick={onClose}
            style={{
              color: '#6b7280',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '0.25rem',
              display: 'flex',
              alignItems: 'center',
              transition: 'color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.color = '#374151'}
            onMouseOut={(e) => e.currentTarget.style.color = '#6b7280'}
          >
            <X style={{ width: '1.5rem', height: '1.5rem' }} />
          </button>
        </div>

        {/* Content */}
        <div style={{
          padding: '1.5rem',
          overflowY: 'auto',
          flex: 1
        }}>
          {/* Status Badge */}
          <div style={{ marginBottom: '1.5rem' }}>
            <span style={{
              display: 'inline-block',
              padding: '0.5rem 1rem',
              borderRadius: '9999px',
              fontSize: '0.875rem',
              fontWeight: '600',
              backgroundColor: email.status === 'SENT' ? '#d1fae5' : 
                              email.status === 'PENDING' ? '#fef3c7' : '#fee2e2',
              color: email.status === 'SENT' ? '#065f46' : 
                     email.status === 'PENDING' ? '#92400e' : '#991b1b'
            }}>
              {email.status}
            </span>
          </div>

          {/* Email Info Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '1.5rem',
            marginBottom: '1.5rem'
          }}>
            <div>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '0.5rem'
              }}>
                <Mail style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }} />
                Recipient Email
              </label>
              <p style={{
                color: '#111827',
                fontWeight: '500',
                margin: 0
              }}>
                {email.recipient_email}
              </p>
            </div>

            <div>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '0.5rem'
              }}>
                <User style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }} />
                Recipient Name
              </label>
              <p style={{
                color: '#111827',
                fontWeight: '500',
                margin: 0
              }}>
                {email.recipient_name || 'N/A'}
              </p>
            </div>

            <div>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '0.5rem'
              }}>
                <Package style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }} />
                Email Type
              </label>
              <p style={{
                color: '#111827',
                fontWeight: '500',
                margin: 0
              }}>
                {email.email_type}
              </p>
            </div>

            <div>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '0.5rem'
              }}>
                <Package style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }} />
                Template Used
              </label>
              <p style={{
                color: '#111827',
                fontWeight: '500',
                margin: 0
              }}>
                {email.template_used || 'N/A'}
              </p>
            </div>

            <div>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '0.5rem'
              }}>
                <Calendar style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }} />
                Created At
              </label>
              <p style={{
                color: '#111827',
                fontWeight: '500',
                margin: 0
              }}>
                {new Date(email.created_at).toLocaleString()}
              </p>
            </div>

            <div>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '0.5rem'
              }}>
                <Calendar style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }} />
                Sent At
              </label>
              <p style={{
                color: '#111827',
                fontWeight: '500',
                margin: 0
              }}>
                {email.sent_at ? new Date(email.sent_at).toLocaleString() : 'Not sent yet'}
              </p>
            </div>

            <div>
              <label style={{
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '0.5rem',
                display: 'block'
              }}>
                Retry Count
              </label>
              <p style={{
                color: '#111827',
                fontWeight: '500',
                margin: 0
              }}>
                {email.retry_count} / {email.max_retries}
              </p>
            </div>

            <div>
              <label style={{
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#374151',
                marginBottom: '0.5rem',
                display: 'block'
              }}>
                Priority
              </label>
              <p style={{
                color: '#111827',
                fontWeight: '500',
                margin: 0
              }}>
                Level {email.priority}
              </p>
            </div>
          </div>

          {/* Subject */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '0.5rem',
              display: 'block'
            }}>
              Subject
            </label>
            <p style={{
              color: '#111827',
              fontWeight: '500',
              backgroundColor: '#f9fafb',
              padding: '1rem',
              borderRadius: '0.5rem',
              border: '1px solid #e5e7eb',
              margin: 0
            }}>
              {email.subject}
            </p>
          </div>

          {/* Error Message */}
          {email.error_message && (
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                fontSize: '0.875rem',
                fontWeight: '500',
                color: '#b91c1c',
                marginBottom: '0.5rem'
              }}>
                <AlertCircle style={{ width: '1rem', height: '1rem', marginRight: '0.5rem' }} />
                Error Message
              </label>
              <p style={{
                color: '#7f1d1d',
                backgroundColor: '#fee2e2',
                padding: '1rem',
                borderRadius: '0.5rem',
                border: '1px solid #fecaca',
                margin: 0
              }}>
                {email.error_message}
              </p>
            </div>
          )}

          {/* Email Body Preview */}
          <div>
            <label style={{
              fontSize: '0.875rem',
              fontWeight: '500',
              color: '#374151',
              marginBottom: '0.5rem',
              display: 'block'
            }}>
              Email Body Preview
            </label>
            <div style={{
              backgroundColor: '#f9fafb',
              padding: '1rem',
              borderRadius: '0.5rem',
              border: '1px solid #e5e7eb'
            }}>
              <iframe
                srcDoc={email.body}
                style={{
                  width: '100%',
                  height: '24rem',
                  border: 'none',
                  borderRadius: '0.25rem',
                  backgroundColor: '#ffffff'
                }}
                title="Email Preview"
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '0.75rem',
          padding: '1.5rem',
          borderTop: '1px solid #e5e7eb'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.5rem 1.5rem',
              color: '#374151',
              backgroundColor: '#f3f4f6',
              border: 'none',
              borderRadius: '0.5rem',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailDetailModal;
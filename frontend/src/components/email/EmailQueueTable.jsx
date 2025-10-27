// ============================================
// EMAIL QUEUE TABLE COMPONENT
// Displays emails in a table with actions
// FILE: frontend/src/components/email/EmailQueueTable.jsx
// ============================================

import React, { useState } from 'react';
import { Eye, RotateCw, Trash2, Mail } from 'lucide-react';

const EmailQueueTable = ({ 
  emails, 
  loading, 
  pagination,
  onPageChange,
  onViewEmail,
  onRetryEmail,
  onDeleteEmail 
}) => {

  const [processingId, setProcessingId] = useState(null);

  // Get status badge class
  const getStatusBadgeClass = (status) => {
    const classes = {
      SENT: 'status-badge sent',
      PENDING: 'status-badge pending',
      FAILED: 'status-badge failed',
    };
    return classes[status] || 'status-badge';
  };

  // Format date to relative time
  const formatDate = (date) => {
    const now = new Date();
    const emailDate = new Date(date);
    const diffInSeconds = Math.floor((now - emailDate) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    
    return emailDate.toLocaleDateString();
  };

  // Handle retry with loading state
  const handleRetry = async (emailId) => {
    setProcessingId(emailId);
    try {
      await onRetryEmail(emailId);
    } finally {
      setProcessingId(null);
    }
  };

  // Handle delete with loading state
  const handleDelete = async (emailId) => {
    if (window.confirm('Are you sure you want to delete this email?')) {
      setProcessingId(emailId);
      try {
        await onDeleteEmail(emailId);
      } finally {
        setProcessingId(null);
      }
    }
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="table-wrapper">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>RECIPIENT</th>
                <th>SUBJECT</th>
                <th>TYPE</th>
                <th>STATUS</th>
                <th>DATE</th>
                <th style={{ textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {[...Array(5)].map((_, i) => (
                <tr key={i}>
                  <td>
                    <div style={{ height: '1rem', background: '#e5e7eb', borderRadius: '0.25rem', width: '75%' }}></div>
                  </td>
                  <td>
                    <div style={{ height: '1rem', background: '#e5e7eb', borderRadius: '0.25rem', width: '100%' }}></div>
                  </td>
                  <td>
                    <div style={{ height: '1rem', background: '#e5e7eb', borderRadius: '0.25rem', width: '80%' }}></div>
                  </td>
                  <td>
                    <div style={{ height: '1.5rem', background: '#e5e7eb', borderRadius: '9999px', width: '5rem' }}></div>
                  </td>
                  <td>
                    <div style={{ height: '1rem', background: '#e5e7eb', borderRadius: '0.25rem', width: '50%' }}></div>
                  </td>
                  <td>
                    <div className="actions-cell">
                      <div style={{ height: '2rem', width: '2rem', background: '#e5e7eb', borderRadius: '0.25rem' }}></div>
                      <div style={{ height: '2rem', width: '2rem', background: '#e5e7eb', borderRadius: '0.25rem' }}></div>
                      <div style={{ height: '2rem', width: '2rem', background: '#e5e7eb', borderRadius: '0.25rem' }}></div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Empty state
  if (!emails || emails.length === 0) {
    return (
      <div className="empty-state">
        <Mail className="empty-icon" />
        <h3 className="empty-title">No emails found</h3>
        <p className="empty-description">
          There are no emails in the queue matching your filters.
        </p>
      </div>
    );
  }

  return (
    <div className="table-wrapper">
      {/* Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>RECIPIENT</th>
              <th>SUBJECT</th>
              <th>TYPE</th>
              <th>STATUS</th>
              <th>DATE</th>
              <th style={{ textAlign: 'right' }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {emails.map((email) => (
              <tr key={email.email_id}>
                <td>
                  <div className="recipient-cell">
                    <span className="recipient-email">{email.recipient_email}</span>
                    {email.recipient_name && (
                      <span className="recipient-name">{email.recipient_name}</span>
                    )}
                  </div>
                </td>
                <td>
                  <div className="subject-cell" title={email.subject}>
                    {email.subject}
                  </div>
                </td>
                <td>{email.email_type}</td>
                <td>
                  <span className={getStatusBadgeClass(email.status)}>
                    {email.status}
                  </span>
                  {email.retry_count > 0 && (
                    <span className="retry-info">({email.retry_count} retries)</span>
                  )}
                </td>
                <td>{formatDate(email.created_at)}</td>
                <td>
                  <div className="actions-cell">
                    {/* View Button */}
                    <button
                      onClick={() => onViewEmail(email)}
                      className="action-btn view"
                      title="View Details"
                      disabled={processingId === email.email_id}
                    >
                      <Eye style={{ width: '1.25rem', height: '1.25rem' }} />
                    </button>

                    {/* Retry Button */}
                    {email.status === 'FAILED' && (
                      <button
                        onClick={() => handleRetry(email.email_id)}
                        className="action-btn retry"
                        title="Retry"
                        disabled={processingId === email.email_id}
                      >
                        <RotateCw 
                          style={{ 
                            width: '1.25rem', 
                            height: '1.25rem',
                            animation: processingId === email.email_id ? 'spin 1s linear infinite' : 'none'
                          }} 
                        />
                      </button>
                    )}

                    {/* Delete Button */}
                    <button
                      onClick={() => handleDelete(email.email_id)}
                      className="action-btn delete"
                      title="Delete"
                      disabled={processingId === email.email_id}
                    >
                      <Trash2 style={{ width: '1.25rem', height: '1.25rem' }} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="pagination-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="pagination-info">
            Showing{' '}
            <span style={{ fontWeight: '500' }}>
              {(pagination.currentPage - 1) * pagination.limit + 1}
            </span>{' '}
            to{' '}
            <span style={{ fontWeight: '500' }}>
              {Math.min(pagination.currentPage * pagination.limit, pagination.totalRecords)}
            </span>{' '}
            of{' '}
            <span style={{ fontWeight: '500' }}>{pagination.totalRecords}</span>{' '}
            results
          </div>
          <div className="pagination-controls">
            <button
              onClick={() => onPageChange(pagination.currentPage - 1)}
              disabled={pagination.currentPage === 1}
              className="pagination-btn"
            >
              Previous
            </button>
            
            {[...Array(pagination.totalPages)].map((_, index) => {
              const pageNum = index + 1;
              if (
                pageNum === 1 ||
                pageNum === pagination.totalPages ||
                (pageNum >= pagination.currentPage - 1 && pageNum <= pagination.currentPage + 1)
              ) {
                return (
                  <button
                    key={pageNum}
                    onClick={() => onPageChange(pageNum)}
                    className={`pagination-btn ${pageNum === pagination.currentPage ? 'active' : ''}`}
                  >
                    {pageNum}
                  </button>
                );
              } else if (pageNum === pagination.currentPage - 2 || pageNum === pagination.currentPage + 2) {
                return (
                  <span key={pageNum} className="pagination-btn" style={{ cursor: 'default' }}>
                    ...
                  </span>
                );
              }
              return null;
            })}

            <button
              onClick={() => onPageChange(pagination.currentPage + 1)}
              disabled={pagination.currentPage === pagination.totalPages}
              className="pagination-btn"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailQueueTable;
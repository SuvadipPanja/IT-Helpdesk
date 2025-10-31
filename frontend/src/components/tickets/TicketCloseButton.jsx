// ============================================
// TICKET CLOSE BUTTON COMPONENT
// Permission-based close button with approval workflow
// Created by: Suvadip Panja
// Date: October 29, 2025
// ============================================

import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { 
  X, 
  CheckCircle, 
  AlertCircle, 
  Lock,
  User,
  Clock,
  MessageSquare,
  XCircle
} from 'lucide-react';
import api from '../../../services/api';
import '../../../styles/TicketCloseButton.css';

const TicketCloseButton = ({ ticket, onTicketUpdated }) => {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [canClose, setCanClose] = useState(false);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [closureReason, setClosureReason] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Check if user can close this ticket
  useEffect(() => {
    if (ticket?.ticket_id) {
      checkClosePermission();
    }
  }, [ticket?.ticket_id, user?.user_id]);

  const checkClosePermission = async () => {
    try {
      setChecking(true);
      const response = await api.get(`/ticket-approvals/can-close/${ticket.ticket_id}`);
      
      if (response.data.success) {
        setCanClose(response.data.data.canClose);
        setRequiresApproval(response.data.data.requiresApproval);
      }
    } catch (error) {
      console.error('Error checking close permission:', error);
      setCanClose(false);
    } finally {
      setChecking(false);
    }
  };

  const handleCloseTicket = async () => {
    if (!closureReason.trim() && requiresApproval) {
      setError('Please provide a reason for closure');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const endpoint = requiresApproval 
        ? `/ticket-approvals/request-closure/${ticket.ticket_id}`
        : `/ticket-approvals/close/${ticket.ticket_id}`;

      const response = await api.post(endpoint, {
        closure_reason: closureReason.trim() || 'Ticket resolved and closed',
        closed_by: user?.user_id
      });

      if (response.data.success) {
        setMessage(
          requiresApproval 
            ? 'Closure request submitted successfully. Waiting for manager approval.'
            : 'Ticket closed successfully!'
        );
        
        setTimeout(() => {
          setShowModal(false);
          setClosureReason('');
          if (onTicketUpdated) {
            onTicketUpdated();
          }
        }, 2000);
      }
    } catch (error) {
      console.error('Error closing ticket:', error);
      setError(
        error.response?.data?.message || 
        'Failed to process closure request. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setShowModal(false);
    setClosureReason('');
    setError('');
    setMessage('');
  };

  // Don't show button if user can't close or ticket is already closed
  if (checking) {
    return null;
  }

  if (!canClose || ticket?.status_name === 'Closed') {
    return null;
  }

  return (
    <>
      {/* Close Button */}
      <button 
        className="btn-close-ticket"
        onClick={() => setShowModal(true)}
        title={requiresApproval ? 'Request ticket closure' : 'Close ticket'}
      >
        <CheckCircle size={18} />
        <span>{requiresApproval ? 'Request Closure' : 'Close Ticket'}</span>
      </button>

      {/* Close Ticket Modal */}
      {showModal && (
        <div className="close-ticket-modal-overlay" onClick={handleCancel}>
          <div 
            className="close-ticket-modal-content" 
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="close-ticket-modal-header">
              <div className="modal-header-content">
                {requiresApproval ? (
                  <>
                    <Lock size={24} className="header-icon approval-icon" />
                    <div>
                      <h3>Request Ticket Closure</h3>
                      <p className="modal-subtitle">Requires manager approval</p>
                    </div>
                  </>
                ) : (
                  <>
                    <CheckCircle size={24} className="header-icon close-icon" />
                    <div>
                      <h3>Close Ticket</h3>
                      <p className="modal-subtitle">Mark this ticket as closed</p>
                    </div>
                  </>
                )}
              </div>
              <button className="modal-close-btn" onClick={handleCancel}>
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="close-ticket-modal-body">
              {/* Ticket Info */}
              <div className="ticket-info-box">
                <div className="ticket-info-row">
                  <span className="info-label">
                    <User size={16} />
                    Ticket:
                  </span>
                  <span className="info-value">
                    {ticket?.ticket_number} - {ticket?.subject}
                  </span>
                </div>
                <div className="ticket-info-row">
                  <span className="info-label">
                    <Clock size={16} />
                    Status:
                  </span>
                  <span className="info-value">{ticket?.status_name}</span>
                </div>
              </div>

              {/* Approval Notice */}
              {requiresApproval && (
                <div className="approval-notice">
                  <AlertCircle size={18} />
                  <div>
                    <strong>Manager Approval Required</strong>
                    <p>This ticket requires manager approval before closure. Your request will be reviewed.</p>
                  </div>
                </div>
              )}

              {/* Closure Reason */}
              <div className="form-group">
                <label className="form-label">
                  <MessageSquare size={16} />
                  {requiresApproval ? 'Closure Reason (Required)' : 'Closure Reason (Optional)'}
                </label>
                <textarea
                  className="form-textarea"
                  value={closureReason}
                  onChange={(e) => setClosureReason(e.target.value)}
                  placeholder={
                    requiresApproval 
                      ? 'Explain why this ticket should be closed...'
                      : 'Add any final notes about the closure...'
                  }
                  rows="4"
                  maxLength="500"
                />
                <span className="char-count">{closureReason.length}/500</span>
              </div>

              {/* Error Message */}
              {error && (
                <div className="message-box error-message">
                  <XCircle size={18} />
                  <span>{error}</span>
                </div>
              )}

              {/* Success Message */}
              {message && (
                <div className="message-box success-message">
                  <CheckCircle size={18} />
                  <span>{message}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="close-ticket-modal-footer">
              <button 
                className="btn-cancel"
                onClick={handleCancel}
                disabled={loading}
              >
                Cancel
              </button>
              <button 
                className="btn-confirm"
                onClick={handleCloseTicket}
                disabled={loading || (requiresApproval && !closureReason.trim())}
              >
                {loading ? (
                  <span className="loading-spinner" />
                ) : (
                  <>
                    <CheckCircle size={18} />
                    <span>
                      {requiresApproval ? 'Submit Request' : 'Close Ticket'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TicketCloseButton;
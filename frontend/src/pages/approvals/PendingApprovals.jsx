// ============================================
// PENDING CLOSURE APPROVALS - MANAGER DASHBOARD
// Page for managers to approve/reject ticket closure requests
// Created by: Suvadip Panja
// Date: October 29, 2025
// ============================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Calendar,
  MessageSquare,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  Eye,
  AlertTriangle
} from 'lucide-react';
import api from '../../services/api';
import '../../styles/PendingApprovals.css';

const PendingApprovals = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // State
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPriority, setFilterPriority] = useState('all');
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [modalType, setModalType] = useState(''); // 'approve' or 'reject'
  const [rejectionReason, setRejectionReason] = useState('');
  const [modalError, setModalError] = useState('');

  // Fetch pending approvals on mount
  useEffect(() => {
    fetchPendingApprovals();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchPendingApprovals(true); // Silent refresh
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Check if user is manager/admin
  useEffect(() => {
    const isManager = user?.role?.role_name === 'Manager' || user?.role?.role_name === 'Admin';
    if (!isManager) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // Fetch pending approvals
  const fetchPendingApprovals = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
        setError('');
      }

      const response = await api.get('/ticket-approvals/pending');

      if (response.data.success) {
        setApprovals(response.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching pending approvals:', error);
      if (!silent) {
        setError(error.response?.data?.message || 'Failed to load pending approvals');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  // Open approve modal
  const handleApproveClick = (approval) => {
    setSelectedApproval(approval);
    setModalType('approve');
    setShowModal(true);
    setModalError('');
  };

  // Open reject modal
  const handleRejectClick = (approval) => {
    setSelectedApproval(approval);
    setModalType('reject');
    setRejectionReason('');
    setShowModal(true);
    setModalError('');
  };

  // Approve closure request
  const handleApprove = async () => {
    if (!selectedApproval) return;

    setProcessing(selectedApproval.ticket_id);
    setModalError('');

    try {
      const response = await api.post(
        `/ticket-approvals/approve/${selectedApproval.ticket_id}`,
        {
          approved_by: user?.user_id
        }
      );

      if (response.data.success) {
        // Remove from list
        setApprovals(prev => prev.filter(a => a.ticket_id !== selectedApproval.ticket_id));
        setShowModal(false);
        setSelectedApproval(null);
      }
    } catch (error) {
      console.error('Error approving closure:', error);
      setModalError(error.response?.data?.message || 'Failed to approve closure request');
    } finally {
      setProcessing(null);
    }
  };

  // Reject closure request
  const handleReject = async () => {
    if (!selectedApproval || !rejectionReason.trim()) {
      setModalError('Please provide a reason for rejection');
      return;
    }

    setProcessing(selectedApproval.ticket_id);
    setModalError('');

    try {
      const response = await api.post(
        `/ticket-approvals/reject/${selectedApproval.ticket_id}`,
        {
          rejected_by: user?.user_id,
          rejection_reason: rejectionReason.trim()
        }
      );

      if (response.data.success) {
        // Remove from list
        setApprovals(prev => prev.filter(a => a.ticket_id !== selectedApproval.ticket_id));
        setShowModal(false);
        setSelectedApproval(null);
        setRejectionReason('');
      }
    } catch (error) {
      console.error('Error rejecting closure:', error);
      setModalError(error.response?.data?.message || 'Failed to reject closure request');
    } finally {
      setProcessing(null);
    }
  };

  // Close modal
  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedApproval(null);
    setRejectionReason('');
    setModalError('');
  };

  // View ticket details
  const handleViewTicket = (ticketId) => {
    navigate(`/tickets/${ticketId}`);
  };

  // Filter approvals
  const filteredApprovals = approvals.filter(approval => {
    const matchesSearch = 
      approval.ticket_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      approval.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      approval.requester_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesPriority = 
      filterPriority === 'all' || 
      approval.priority_name?.toLowerCase() === filterPriority.toLowerCase();

    return matchesSearch && matchesPriority;
  });

  // Get priority badge class
  const getPriorityClass = (priority) => {
    switch (priority?.toLowerCase()) {
      case 'critical': return 'priority-critical';
      case 'high': return 'priority-high';
      case 'medium': return 'priority-medium';
      case 'low': return 'priority-low';
      default: return 'priority-medium';
    }
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000); // seconds

    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;

    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="pending-approvals-page">
        <div className="loading-container">
          <div className="loading-spinner-large"></div>
          <p>Loading pending approvals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pending-approvals-page">
      {/* Header */}
      <div className="page-header">
        <div className="header-left">
          <button className="btn-back" onClick={() => navigate('/dashboard')}>
            <ArrowLeft size={20} />
          </button>
          <div className="header-title">
            <h1>Pending Closure Approvals</h1>
            <p>Review and approve ticket closure requests</p>
          </div>
        </div>
        <div className="header-actions">
          <button 
            className="btn-refresh" 
            onClick={() => fetchPendingApprovals()}
            title="Refresh"
          >
            <RefreshCw size={18} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search by ticket number, subject, or requester..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <Filter size={18} />
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
          >
            <option value="all">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-section">
        <div className="stat-card">
          <div className="stat-icon pending">
            <Clock size={24} />
          </div>
          <div className="stat-content">
            <span className="stat-label">Pending Approvals</span>
            <span className="stat-value">{filteredApprovals.length}</span>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="error-banner">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button onClick={() => fetchPendingApprovals()}>Retry</button>
        </div>
      )}

      {/* Approvals List */}
      {filteredApprovals.length === 0 ? (
        <div className="empty-state">
          <CheckCircle size={64} className="empty-icon" />
          <h3>No Pending Approvals</h3>
          <p>All closure requests have been processed!</p>
        </div>
      ) : (
        <div className="approvals-grid">
          {filteredApprovals.map((approval) => (
            <div key={approval.ticket_id} className="approval-card">
              {/* Card Header */}
              <div className="card-header">
                <div className="ticket-info">
                  <span className="ticket-number">{approval.ticket_number}</span>
                  <span className={`priority-badge ${getPriorityClass(approval.priority_name)}`}>
                    <AlertTriangle size={14} />
                    {approval.priority_name}
                  </span>
                </div>
                <button 
                  className="btn-view"
                  onClick={() => handleViewTicket(approval.ticket_id)}
                  title="View Ticket"
                >
                  <Eye size={18} />
                </button>
              </div>

              {/* Card Body */}
              <div className="card-body">
                <h3 className="ticket-subject">{approval.subject}</h3>

                <div className="info-grid">
                  <div className="info-item">
                    <User size={16} />
                    <div>
                      <span className="info-label">Requested by</span>
                      <span className="info-value">{approval.requester_name}</span>
                    </div>
                  </div>

                  <div className="info-item">
                    <Clock size={16} />
                    <div>
                      <span className="info-label">Requested</span>
                      <span className="info-value">{formatDate(approval.closure_requested_at)}</span>
                    </div>
                  </div>
                </div>

                {approval.closure_reason && (
                  <div className="closure-reason">
                    <MessageSquare size={16} />
                    <div>
                      <span className="reason-label">Closure Reason:</span>
                      <p className="reason-text">{approval.closure_reason}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Card Footer */}
              <div className="card-footer">
                <button
                  className="btn-reject"
                  onClick={() => handleRejectClick(approval)}
                  disabled={processing === approval.ticket_id}
                >
                  <XCircle size={18} />
                  <span>Reject</span>
                </button>
                <button
                  className="btn-approve"
                  onClick={() => handleApproveClick(approval)}
                  disabled={processing === approval.ticket_id}
                >
                  <CheckCircle size={18} />
                  <span>Approve</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Approval/Rejection Modal */}
      {showModal && selectedApproval && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className={`modal-header ${modalType}`}>
              {modalType === 'approve' ? (
                <>
                  <CheckCircle size={24} />
                  <h3>Approve Closure Request</h3>
                </>
              ) : (
                <>
                  <XCircle size={24} />
                  <h3>Reject Closure Request</h3>
                </>
              )}
            </div>

            {/* Modal Body */}
            <div className="modal-body">
              <div className="ticket-summary">
                <p><strong>Ticket:</strong> {selectedApproval.ticket_number}</p>
                <p><strong>Subject:</strong> {selectedApproval.subject}</p>
                <p><strong>Requested by:</strong> {selectedApproval.requester_name}</p>
              </div>

              {modalType === 'approve' ? (
                <p className="confirmation-text">
                  Are you sure you want to approve this closure request? The ticket will be closed immediately.
                </p>
              ) : (
                <div className="rejection-form">
                  <label>
                    <span className="required">Rejection Reason *</span>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Explain why this closure request is being rejected..."
                      rows="4"
                      maxLength="500"
                    />
                    <span className="char-count">{rejectionReason.length}/500</span>
                  </label>
                </div>
              )}

              {modalError && (
                <div className="modal-error">
                  <AlertCircle size={18} />
                  <span>{modalError}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="modal-footer">
              <button 
                className="btn-cancel"
                onClick={handleCloseModal}
                disabled={processing}
              >
                Cancel
              </button>
              <button
                className={modalType === 'approve' ? 'btn-approve' : 'btn-reject'}
                onClick={modalType === 'approve' ? handleApprove : handleReject}
                disabled={processing || (modalType === 'reject' && !rejectionReason.trim())}
              >
                {processing ? (
                  <span className="loading-spinner" />
                ) : (
                  <>
                    {modalType === 'approve' ? <CheckCircle size={18} /> : <XCircle size={18} />}
                    <span>{modalType === 'approve' ? 'Approve' : 'Reject'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PendingApprovals;
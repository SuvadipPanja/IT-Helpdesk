import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Download,
  Send,
  Paperclip,
  User,
  Clock,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
  Calendar,
  Tag,
  MessageSquare,
  Activity,
  Upload,
  FileText,
  Image as ImageIcon,
  File,
  X,
  Eye,
  EyeOff,
  MoreVertical,
  RefreshCw,
  UserCheck,
  TrendingUp,  // ← ADDED FOR SLA
  XCircle      // ← ADDED FOR SLA
} from 'lucide-react';
import api from '../../services/api';
import '../../styles/TicketDetail.css';

const TicketDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  // State management
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Comments state
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [commentLoading, setCommentLoading] = useState(false);

  // Activities state
  const [activities, setActivities] = useState([]);

  // Attachments state
  const [attachments, setAttachments] = useState([]);

  // Assignment state
  const [engineers, setEngineers] = useState([]);
  const [selectedEngineer, setSelectedEngineer] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);

  // UI state
  const [activeTab, setActiveTab] = useState('comments');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Fetch engineers on mount
  useEffect(() => {
    fetchEngineers();
  }, []);

  // Fetch ticket details on mount
  useEffect(() => {
    if (id) {
      fetchTicketDetails();
    }
  }, [id]);

  // Fetch engineers list
  const fetchEngineers = async () => {
    try {
      const response = await api.get('/system/engineers');
      if (response.data.success) {
        setEngineers(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching engineers:', err);
    }
  };

  // Fetch ticket details
  const fetchTicketDetails = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await api.get(`/tickets/${id}`);

      if (response.data.success) {
        const ticketData = response.data.data;
        setTicket(ticketData);
        setComments(ticketData.comments || []);
        setActivities(ticketData.activities || []);
        setAttachments(ticketData.attachments || []);
        
        // Set currently assigned engineer in dropdown
        if (ticketData.assigned_to_id) {
          setSelectedEngineer(ticketData.assigned_to_id.toString());
        }
      } else {
        setError('Ticket not found');
      }
    } catch (err) {
      console.error('Error fetching ticket:', err);
      setError(err.response?.data?.message || 'Failed to load ticket details');
    } finally {
      setLoading(false);
    }
  };

  // Add comment
  const handleAddComment = async () => {
    if (!newComment.trim()) {
      return;
    }

    try {
      setCommentLoading(true);

      const response = await api.post(`/tickets/${id}/comments`, {
        comment_text: newComment,
        is_internal: isInternalNote
      });

      if (response.data.success) {
        // Clear form
        setNewComment('');
        setIsInternalNote(false);

        // Refresh ticket to get updated data
        fetchTicketDetails();
      }
    } catch (err) {
      console.error('Error adding comment:', err);
      alert(err.response?.data?.message || 'Failed to add comment');
    } finally {
      setCommentLoading(false);
    }
  };

  // Assign engineer
  const handleAssignEngineer = async () => {
    if (!selectedEngineer) {
      alert('Please select an engineer to assign');
      return;
    }

    try {
      setAssignLoading(true);

      const response = await api.patch(`/tickets/${id}/assign`, {
        assigned_to: parseInt(selectedEngineer)
      });

      if (response.data.success) {
        alert('Ticket assigned successfully!');
        // Refresh ticket details
        fetchTicketDetails();
      }
    } catch (err) {
      console.error('Error assigning ticket:', err);
      alert(err.response?.data?.message || 'Failed to assign ticket');
    } finally {
      setAssignLoading(false);
    }
  };

  // Delete ticket
  const handleDeleteTicket = async () => {
    try {
      const response = await api.delete(`/tickets/${id}`);
      
      if (response.data.success) {
        alert('Ticket deleted successfully!');
        navigate('/tickets');
      }
    } catch (err) {
      console.error('Error deleting ticket:', err);
      alert(err.response?.data?.message || 'Failed to delete ticket');
      setShowDeleteConfirm(false);
    }
  };

  // Navigate to edit
  const handleEditTicket = () => {
    navigate(`/tickets/edit/${id}`);
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Format relative time
  const formatRelativeTime = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateString);
  };

  // Get status color
  const getStatusColor = (status) => {
    const colors = {
      'OPEN': 'status-open',
      'IN_PROGRESS': 'status-progress',
      'PENDING': 'status-pending',
      'ON_HOLD': 'status-hold',
      'RESOLVED': 'status-resolved',
      'CLOSED': 'status-closed',
      'CANCELLED': 'status-cancelled'
    };
    return colors[status] || 'status-default';
  };

  // Get priority color
  const getPriorityColor = (priority) => {
    const colors = {
      'CRITICAL': 'priority-critical',
      'HIGH': 'priority-high',
      'MEDIUM': 'priority-medium',
      'LOW': 'priority-low',
      'PLANNING': 'priority-planning'
    };
    return colors[priority] || 'priority-default';
  };

  // Get status icon
  const getStatusIcon = (status) => {
    const icons = {
      'OPEN': AlertCircle,
      'IN_PROGRESS': Clock,
      'PENDING': Clock,
      'ON_HOLD': Clock,
      'RESOLVED': CheckCircle,
      'CLOSED': CheckCircle,
      'CANCELLED': X
    };
    const Icon = icons[status] || AlertCircle;
    return <Icon size={20} />;
  };

  // ============================================
  // SLA HELPER FUNCTIONS - NEW
  // ============================================
  
  // Calculate SLA percentage and status
  const calculateSlaStatus = (ticket) => {
    if (!ticket.due_date || !ticket.created_at) {
      return { status: 'none', percentage: 0, color: '#94a3b8', label: 'No SLA' };
    }

    const now = new Date();
    const created = new Date(ticket.created_at);
    const due = new Date(ticket.due_date);
    
    const totalTime = due - created;
    const elapsed = now - created;
    const percentage = Math.min((elapsed / totalTime) * 100, 100);

    // Check if breached
    if (ticket.sla_breach_notified_at || now > due) {
      return { status: 'breached', percentage: 100, color: '#ef4444', label: 'Breached' };
    }

    // Check if in warning zone (80% default)
    const warningThreshold = 80;
    if (percentage >= warningThreshold) {
      return { status: 'warning', percentage, color: '#f59e0b', label: 'At Risk' };
    }

    // All good
    return { status: 'ok', percentage, color: '#10b981', label: 'On Track' };
  };

  // Format time remaining
  const formatTimeRemaining = (ticket) => {
    if (!ticket.due_date) return 'No SLA';

    const now = new Date();
    const due = new Date(ticket.due_date);
    const diff = due - now;

    if (diff < 0) {
      const hours = Math.abs(Math.floor(diff / (1000 * 60 * 60)));
      const days = Math.floor(hours / 24);
      if (days > 0) {
        return `Overdue by ${days}d ${hours % 24}h`;
      }
      return `Overdue by ${hours}h`;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days}d ${hours}h remaining`;
    if (hours > 0) return `${hours}h ${mins}m remaining`;
    return `${mins}m remaining`;
  };

  // Format total SLA time
  const formatTotalSlaTime = (ticket) => {
    if (!ticket.due_date || !ticket.created_at) return 'N/A';

    const created = new Date(ticket.created_at);
    const due = new Date(ticket.due_date);
    const diff = due - created;

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  };

  // ============================================
  // END SLA HELPER FUNCTIONS
  // ============================================

  // Get file icon
  const getFileIcon = (fileName) => {
    const ext = fileName.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(ext)) {
      return <ImageIcon size={20} />;
    }
    if (['pdf'].includes(ext)) {
      return <FileText size={20} />;
    }
    return <File size={20} />;
  };

  // Format file size
  const formatFileSize = (sizeInKB) => {
    if (sizeInKB < 1024) {
      return `${sizeInKB.toFixed(1)} KB`;
    }
    return `${(sizeInKB / 1024).toFixed(1)} MB`;
  };

  // Download attachment
  const handleDownloadAttachment = (attachmentId, fileName) => {
    window.open(`/api/v1/tickets/${id}/attachments/${attachmentId}/download`, '_blank');
  };

  // Check if user can edit
  const canEdit = () => {
    if (!user || !ticket) return false;
    if (user.permissions?.can_assign_tickets) return true;
    if (ticket.requester_id === user.user_id) return true;
    if (ticket.assigned_to_id === user.user_id) return true;
    return false;
  };

  // Check if user can delete
  const canDelete = () => {
    return user?.permissions?.can_delete_tickets;
  };

  // Check if user can assign
  const canAssign = () => {
    return user?.permissions?.can_assign_tickets;
  };

  if (loading) {
    return (
      <div className="ticket-detail-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading ticket details...</p>
        </div>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="ticket-detail-page">
        <div className="error-container">
          <AlertCircle size={64} className="error-icon" />
          <h2>Ticket Not Found</h2>
          <p>{error || 'The ticket you are looking for does not exist or you do not have permission to view it.'}</p>
          <button className="btn-primary" onClick={() => navigate('/tickets')}>
            <ArrowLeft size={18} />
            Back to Tickets
          </button>
        </div>
      </div>
    );
  }

  // Calculate SLA for display
  const slaData = calculateSlaStatus(ticket);

  return (
    <div className="ticket-detail-page">
      {/* Header */}
      <div className="ticket-detail-header">
        <div className="header-left">
          <button className="btn-back" onClick={() => navigate('/tickets')}>
            <ArrowLeft size={20} />
            <span>Back to Tickets</span>
          </button>
          <div className="ticket-number-badge">
            <span className="ticket-hash">#</span>
            <span className="ticket-number">{ticket.ticket_number}</span>
          </div>
          {ticket.is_escalated && (
            <span className="escalated-badge-large">
              <AlertTriangle size={16} />
              <span>Escalated</span>
            </span>
          )}
        </div>
        <div className="header-right">
          <button className="btn-icon-action" onClick={fetchTicketDetails} title="Refresh">
            <RefreshCw size={18} />
          </button>
          {canEdit() && (
            <button className="btn-secondary" onClick={handleEditTicket}>
              <Edit size={18} />
              <span>Edit</span>
            </button>
          )}
          {canDelete() && (
            <button className="btn-danger" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 size={18} />
              <span>Delete</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="ticket-detail-content">
        {/* Left Column - Ticket Info */}
        <div className="ticket-info-section">
          {/* Status, Priority, and SLA Badges */}
          <div className="ticket-badges">
            <div className={`status-badge-large ${getStatusColor(ticket.status_code)}`}>
              {getStatusIcon(ticket.status_code)}
              <span>{ticket.status_name}</span>
            </div>
            <div className={`priority-badge-large ${getPriorityColor(ticket.priority_code)}`}>
              {ticket.priority_code === 'CRITICAL' || ticket.priority_code === 'HIGH' ? (
                <AlertTriangle size={18} />
              ) : null}
              <span>{ticket.priority_name}</span>
            </div>
            {/* SLA Badge - NEW */}
            <div 
              className={`sla-badge-large sla-${slaData.status}`}
              style={{ borderColor: slaData.color, color: slaData.color }}
            >
              {slaData.status === 'breached' && <XCircle size={18} />}
              {slaData.status === 'warning' && <AlertTriangle size={18} />}
              {slaData.status === 'ok' && <CheckCircle size={18} />}
              {slaData.status === 'none' && <Clock size={18} />}
              <span>{slaData.label}</span>
            </div>
          </div>

          {/* SLA Detail Card - NEW */}
          {slaData.status !== 'none' && (
            <div className="detail-card sla-card">
              <h2 className="detail-card-title">
                <TrendingUp size={18} />
                SLA Information
              </h2>
              
              <div className="sla-progress-section">
                <div className="sla-progress-header">
                  <span className="sla-progress-label">Time Elapsed</span>
                  <span className="sla-progress-percentage" style={{ color: slaData.color }}>
                    {Math.round(slaData.percentage)}%
                  </span>
                </div>
                <div className="sla-progress-bar-large">
                  <div 
                    className="sla-progress-fill-large"
                    style={{ 
                      width: `${Math.min(slaData.percentage, 100)}%`,
                      backgroundColor: slaData.color 
                    }}
                  />
                </div>
                <div className="sla-time-remaining-large" style={{ color: slaData.color }}>
                  {formatTimeRemaining(ticket)}
                </div>
              </div>

              <div className="sla-details-grid">
                <div className="sla-detail-item">
                  <label>Total SLA Time</label>
                  <p>{formatTotalSlaTime(ticket)}</p>
                </div>
                <div className="sla-detail-item">
                  <label>Started At</label>
                  <p>{formatDate(ticket.created_at)}</p>
                </div>
                <div className="sla-detail-item">
                  <label>Due By</label>
                  <p className={slaData.status === 'breached' ? 'text-danger' : ''}>
                    {formatDate(ticket.due_date)}
                  </p>
                </div>
                {ticket.sla_breach_notified_at && (
                  <div className="sla-detail-item">
                    <label>Breached At</label>
                    <p className="text-danger">{formatDate(ticket.sla_breach_notified_at)}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Ticket Details Card */}
          <div className="detail-card">
            <h2 className="detail-card-title">Ticket Information</h2>
            
            <div className="detail-item">
              <label>Subject</label>
              <p className="ticket-subject">
                {ticket.subject || ticket.title || 'No Subject'}
              </p>
            </div>

            <div className="detail-item">
              <label>Description</label>
              <p className="ticket-description">
                {ticket.description || 'No description provided'}
              </p>
            </div>

            <div className="detail-grid">
              <div className="detail-item">
                <label>
                  <Tag size={14} />
                  Category
                </label>
                <p>{ticket.category_name || 'N/A'}</p>
              </div>

              <div className="detail-item">
                <label>
                  <Calendar size={14} />
                  Created
                </label>
                <p title={formatDate(ticket.created_at)}>
                  {formatRelativeTime(ticket.created_at)}
                </p>
              </div>

              <div className="detail-item">
                <label>
                  <Clock size={14} />
                  Due Date
                </label>
                <p className={new Date(ticket.due_date) < new Date() ? 'text-danger' : ''}>
                  {formatDate(ticket.due_date)}
                </p>
              </div>

              <div className="detail-item">
                <label>
                  <User size={14} />
                  Requester
                </label>
                <p>{ticket.requester_name || 'Unknown'}</p>
              </div>

              <div className="detail-item">
                <label>
                  <User size={14} />
                  Assigned To
                </label>
                <p>{ticket.assigned_to_name || 'Unassigned'}</p>
              </div>

              {ticket.department_name && (
                <div className="detail-item">
                  <label>Department</label>
                  <p>{ticket.department_name}</p>
                </div>
              )}

              {ticket.resolved_at && (
                <div className="detail-item">
                  <label>
                    <CheckCircle size={14} />
                    Resolved At
                  </label>
                  <p>{formatDate(ticket.resolved_at)}</p>
                </div>
              )}

              {ticket.resolution_notes && (
                <div className="detail-item full-width">
                  <label>Resolution Notes</label>
                  <p className="resolution-notes">{ticket.resolution_notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Assign Engineer Section */}
          {canAssign() && (
            <div className="detail-card assign-card">
              <h2 className="detail-card-title">
                <UserCheck size={18} />
                Assign Engineer
              </h2>
              <div className="assign-form">
                <select
                  value={selectedEngineer}
                  onChange={(e) => setSelectedEngineer(e.target.value)}
                  className="assign-select"
                  disabled={assignLoading}
                >
                  <option value="">Select Engineer</option>
                  {engineers.map((engineer) => (
                    <option key={engineer.user_id} value={engineer.user_id}>
                      {engineer.full_name || engineer.username}
                      {engineer.user_id === ticket.assigned_to_id && ' (Current)'}
                    </option>
                  ))}
                </select>
                <button
                  className="btn-assign"
                  onClick={handleAssignEngineer}
                  disabled={assignLoading || !selectedEngineer}
                >
                  <UserCheck size={18} />
                  <span>{assignLoading ? 'Assigning...' : 'Assign'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Tabs */}
        <div className="ticket-tabs-section">
          {/* Tab Navigation */}
          <div className="tabs-nav">
            <button
              className={`tab-btn ${activeTab === 'comments' ? 'active' : ''}`}
              onClick={() => setActiveTab('comments')}
            >
              <MessageSquare size={18} />
              <span>Comments</span>
              <span className="tab-badge">{comments.length}</span>
            </button>
            <button
              className={`tab-btn ${activeTab === 'activity' ? 'active' : ''}`}
              onClick={() => setActiveTab('activity')}
            >
              <Activity size={18} />
              <span>Activity</span>
              <span className="tab-badge">{activities.length}</span>
            </button>
            <button
              className={`tab-btn ${activeTab === 'attachments' ? 'active' : ''}`}
              onClick={() => setActiveTab('attachments')}
            >
              <Paperclip size={18} />
              <span>Attachments</span>
              <span className="tab-badge">{attachments.length}</span>
            </button>
          </div>

          {/* Tab Content */}
          <div className="tabs-content">
            {/* Comments Tab */}
            {activeTab === 'comments' && (
              <div className="comments-container">
                {/* Add Comment Form */}
                <div className="add-comment-form">
                  <div className="comment-input-wrapper">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Write a comment..."
                      className="comment-textarea"
                      rows={4}
                    />
                  </div>
                  <div className="comment-actions">
                    <label className="internal-note-checkbox">
                      <input
                        type="checkbox"
                        checked={isInternalNote}
                        onChange={(e) => setIsInternalNote(e.target.checked)}
                      />
                      {isInternalNote ? <EyeOff size={16} /> : <Eye size={16} />}
                      <span>Internal Note (Staff Only)</span>
                    </label>
                    <button
                      className="btn-primary"
                      onClick={handleAddComment}
                      disabled={commentLoading || !newComment.trim()}
                    >
                      <Send size={16} />
                      <span>{commentLoading ? 'Posting...' : 'Post Comment'}</span>
                    </button>
                  </div>
                </div>

                {/* Comments List */}
                <div className="comments-list">
                  {comments.length === 0 ? (
                    <div className="empty-state-small">
                      <MessageSquare size={48} className="empty-icon" />
                      <p>No comments yet</p>
                      <small>Be the first to comment on this ticket</small>
                    </div>
                  ) : (
                    comments.map((comment) => (
                      <div
                        key={comment.comment_id}
                        className={`comment-item ${comment.is_internal ? 'internal' : ''}`}
                      >
                        <div className="comment-header">
                          <div className="comment-author">
                            <div className="author-avatar">
                              <User size={16} />
                            </div>
                            <div className="author-info">
                              <span className="author-name">{comment.commenter_name}</span>
                              <span className="author-role">{comment.commenter_role}</span>
                            </div>
                          </div>
                          <div className="comment-meta">
                            {comment.is_internal && (
                              <span className="internal-badge">
                                <EyeOff size={12} />
                                Internal
                              </span>
                            )}
                            <span className="comment-time" title={formatDate(comment.commented_at)}>
                              {formatRelativeTime(comment.commented_at)}
                            </span>
                          </div>
                        </div>
                        <div className="comment-body">
                          <p>{comment.comment_text}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Activity Tab */}
            {activeTab === 'activity' && (
              <div className="activity-container">
                {activities.length === 0 ? (
                  <div className="empty-state-small">
                    <Activity size={48} className="empty-icon" />
                    <p>No activity yet</p>
                  </div>
                ) : (
                  <div className="activity-timeline">
                    {activities.map((activity) => (
                      <div key={activity.activity_id} className="activity-item">
                        <div className="activity-icon">
                          <Activity size={16} />
                        </div>
                        <div className="activity-content">
                          <div className="activity-header">
                            <span className="activity-type">{activity.activity_type}</span>
                            <span className="activity-time" title={formatDate(activity.performed_at)}>
                              {formatRelativeTime(activity.performed_at)}
                            </span>
                          </div>
                          <p className="activity-description">{activity.description}</p>
                          {activity.performed_by_name && (
                            <span className="activity-user">by {activity.performed_by_name}</span>
                          )}
                          {(activity.field_name || activity.old_value || activity.new_value) && (
                            <div className="activity-changes">
                              {activity.field_name && <span className="field-name">{activity.field_name}</span>}
                              {activity.old_value && <span className="old-value">{activity.old_value}</span>}
                              {activity.old_value && activity.new_value && <span className="arrow">→</span>}
                              {activity.new_value && <span className="new-value">{activity.new_value}</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Attachments Tab */}
            {activeTab === 'attachments' && (
              <div className="attachments-container">
                {attachments.length === 0 ? (
                  <div className="empty-state-small">
                    <Paperclip size={48} className="empty-icon" />
                    <p>No attachments</p>
                    <small>Upload files to attach them to this ticket</small>
                  </div>
                ) : (
                  <div className="attachments-list">
                    {attachments.map((attachment) => (
                      <div key={attachment.attachment_id} className="attachment-item">
                        <div className="attachment-icon">
                          {getFileIcon(attachment.file_name)}
                        </div>
                        <div className="attachment-info">
                          <p className="attachment-name">{attachment.file_name}</p>
                          <div className="attachment-meta">
                            <span className="attachment-size">
                              {formatFileSize(attachment.file_size_kb)}
                            </span>
                            <span>•</span>
                            <span className="attachment-time">
                              {formatRelativeTime(attachment.uploaded_at)}
                            </span>
                            {attachment.uploaded_by_name && (
                              <>
                                <span>•</span>
                                <span>by {attachment.uploaded_by_name}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <button
                          className="btn-icon-action"
                          onClick={() => handleDownloadAttachment(attachment.attachment_id, attachment.file_name)}
                          title="Download"
                        >
                          <Download size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete Ticket</h3>
              <button className="modal-close" onClick={() => setShowDeleteConfirm(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete ticket <strong>#{ticket.ticket_number}</strong>?</p>
              <p className="warning-text">This action cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </button>
              <button className="btn-danger" onClick={handleDeleteTicket}>
                <Trash2 size={16} />
                Delete Ticket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketDetail;
// ============================================
// TICKET DETAIL — Enhanced v2
// Production-ready, dark-mode, accessible, polished
// ============================================

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  ArrowLeft, Edit, Trash2, Download, Send, Paperclip, User,
  Clock, AlertCircle, CheckCircle, AlertTriangle, Calendar,
  Tag, MessageSquare, Activity, FileText, Image as ImageIcon,
  File, Eye, EyeOff, RefreshCw, UserCheck, TrendingUp, XCircle,
  Copy, ChevronRight, Shield, Building, Hash, Plus, Minus,
  ArrowUp, ExternalLink, FileSpreadsheet, FileArchive, FileCode,
} from 'lucide-react';
import api from '../../services/api';
import '../../styles/TicketDetail.css';

const TicketDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const commentRef = useRef(null);

  // Core state
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Comments
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [commentLoading, setCommentLoading] = useState(false);

  // Activities & Attachments
  const [activities, setActivities] = useState([]);
  const [attachments, setAttachments] = useState([]);

  // Assignment
  const [engineers, setEngineers] = useState([]);
  const [selectedEngineer, setSelectedEngineer] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);

  // UI
  const [activeTab, setActiveTab] = useState('comments');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // ── Permissions (memoized) ──
  const canEdit = useMemo(() => {
    if (!user || !ticket) return false;
    return user.permissions?.can_assign_tickets ||
      ticket.requester_id === user.user_id ||
      ticket.assigned_to_id === user.user_id;
  }, [user, ticket]);

  const canDelete = useMemo(() => user?.permissions?.can_delete_tickets, [user]);
  const canAssign = useMemo(() => user?.permissions?.can_assign_tickets, [user]);

  // ── Fetch engineers (only if can assign) ──
  useEffect(() => {
    if (canAssign) {
      api.get('/system/engineers')
        .then(res => { if (res.data.success) setEngineers(res.data.data); })
        .catch(() => {});
    }
  }, [canAssign]);

  // ── Fetch ticket ──
  const fetchTicketDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get(`/tickets/${id}`);
      if (res.data.success) {
        const d = res.data.data;
        setTicket(d);
        setComments(d.comments || []);
        setActivities(d.activities || []);
        setAttachments(d.attachments || []);
        if (d.assigned_to_id) setSelectedEngineer(d.assigned_to_id.toString());
      } else {
        setError('Ticket not found');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load ticket details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { if (id) fetchTicketDetails(); }, [id, fetchTicketDetails]);

  // ── Add comment ──
  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    try {
      setCommentLoading(true);
      const res = await api.post(`/tickets/${id}/comments`, {
        comment_text: newComment,
        is_internal: isInternalNote,
      });
      if (res.data.success) {
        setNewComment('');
        setIsInternalNote(false);
        toast.success(isInternalNote ? 'Internal note added' : 'Comment posted');
        fetchTicketDetails();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add comment');
    } finally {
      setCommentLoading(false);
    }
  };

  // ── Assign engineer ──
  const handleAssignEngineer = async () => {
    if (!selectedEngineer) { toast.warning('Select an engineer'); return; }
    try {
      setAssignLoading(true);
      const res = await api.patch(`/tickets/${id}/assign`, { assigned_to: parseInt(selectedEngineer) });
      if (res.data.success) {
        const name = engineers.find(e => e.user_id === parseInt(selectedEngineer))?.full_name || 'Engineer';
        toast.success(`Assigned to ${name}`);
        fetchTicketDetails();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign');
    } finally {
      setAssignLoading(false);
    }
  };

  // ── Delete ticket ──
  const handleDeleteTicket = async () => {
    try {
      setDeleteLoading(true);
      const res = await api.delete(`/tickets/${id}`);
      if (res.data.success) {
        toast.success('Ticket deleted');
        navigate('/tickets');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
      setShowDeleteConfirm(false);
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Copy ticket number ──
  const handleCopyTicketNumber = () => {
    if (!ticket) return;
    navigator.clipboard.writeText(ticket.ticket_number).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── Download attachment ──
  const handleDownloadAttachment = async (attachmentId, fileName) => {
    try {
      const res = await api.get(`/tickets/${id}/attachments/${attachmentId}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download attachment');
    }
  };

  // ── Keyboard: Enter to post comment ──
  const handleCommentKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && newComment.trim()) {
      handleAddComment();
    }
  };

  // ─────────────────────────────────────
  // FORMATTING HELPERS
  // ─────────────────────────────────────
  const formatDate = (d) => {
    if (!d) return 'N/A';
    try {
      const dt = new Date(d);
      return dt.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) +
        ' ' + dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch { return 'Invalid Date'; }
  };

  const timeAgo = (d) => {
    if (!d) return '';
    const s = Math.floor((Date.now() - new Date(d)) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  };

  const statusColorCls = (code) => ({
    OPEN: 'td-s-open', IN_PROGRESS: 'td-s-progress', PENDING: 'td-s-pending',
    ON_HOLD: 'td-s-hold', RESOLVED: 'td-s-closed', CLOSED: 'td-s-closed',
    CANCELLED: 'td-s-cancelled',
  }[code] || 'td-s-default');

  const priorityColorCls = (code) => ({
    CRITICAL: 'td-p-critical', HIGH: 'td-p-high', MEDIUM: 'td-p-medium',
    LOW: 'td-p-low', PLANNING: 'td-p-planning',
  }[code] || 'td-p-default');

  const statusIcon = (code) => {
    const icons = { OPEN: AlertCircle, IN_PROGRESS: Clock, PENDING: Clock, ON_HOLD: Clock, RESOLVED: CheckCircle, CLOSED: CheckCircle, CANCELLED: XCircle };
    const Icon = icons[code] || AlertCircle;
    return <Icon size={16} />;
  };

  // ── Activity icon by type ──
  const activityTypeIcon = (desc) => {
    const d = (desc || '').toLowerCase();
    if (d.includes('creat')) return <Plus size={14} />;
    if (d.includes('assign')) return <UserCheck size={14} />;
    if (d.includes('status') || d.includes('updat')) return <RefreshCw size={14} />;
    if (d.includes('escal')) return <ArrowUp size={14} />;
    if (d.includes('close') || d.includes('resolv')) return <CheckCircle size={14} />;
    if (d.includes('comment') || d.includes('note')) return <MessageSquare size={14} />;
    if (d.includes('priority')) return <AlertTriangle size={14} />;
    return <Activity size={14} />;
  };

  // ── File icon by extension ──
  const getFileIcon = (name) => {
    const ext = (name || '').split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp'].includes(ext)) return <ImageIcon size={20} />;
    if (['pdf'].includes(ext)) return <FileText size={20} className="td-file-pdf" />;
    if (['doc', 'docx'].includes(ext)) return <FileText size={20} className="td-file-doc" />;
    if (['xls', 'xlsx', 'csv'].includes(ext)) return <FileSpreadsheet size={20} className="td-file-xls" />;
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return <FileArchive size={20} className="td-file-zip" />;
    if (['js', 'ts', 'py', 'java', 'cpp', 'html', 'css', 'json', 'xml'].includes(ext)) return <FileCode size={20} className="td-file-code" />;
    return <File size={20} />;
  };

  const formatFileSize = (kb) => {
    if (!kb) return '';
    return kb < 1024 ? `${kb.toFixed(1)} KB` : `${(kb / 1024).toFixed(1)} MB`;
  };

  // ─────────────────────────────────────
  // SLA CALCULATIONS (memoized)
  // ─────────────────────────────────────
  const slaData = useMemo(() => {
    if (!ticket?.due_date || !ticket?.created_at) {
      return { status: 'none', percentage: 0, label: 'No SLA', isClosed: false };
    }
    const now = new Date();
    const created = new Date(ticket.created_at);
    const due = new Date(ticket.due_date);
    const resolved = ticket.resolved_at ? new Date(ticket.resolved_at) : null;
    const isClosed = ticket.is_final_status || ticket.status_code === 'RESOLVED' || ticket.status_code === 'CLOSED';

    if (isClosed) {
      const resolvedAt = resolved || now;
      return resolvedAt <= due
        ? { status: 'met', percentage: 100, label: 'SLA Met', isClosed: true, resolvedAt, dueDate: due }
        : { status: 'breached', percentage: 100, label: 'SLA Breached', isClosed: true, resolvedAt, dueDate: due };
    }

    const totalTime = due - created;
    const elapsed = now - created;
    const pct = Math.min((elapsed / totalTime) * 100, 100);

    if (now > due) return { status: 'breached', percentage: 100, label: 'Breached', isClosed: false };
    if (pct >= 80) return { status: 'warning', percentage: pct, label: 'At Risk', isClosed: false };
    return { status: 'ok', percentage: pct, label: 'On Track', isClosed: false };
  }, [ticket]);

  const slaTimeText = useMemo(() => {
    if (!ticket?.due_date) return 'No SLA set';
    const now = new Date();
    const due = new Date(ticket.due_date);
    const resolved = ticket.resolved_at ? new Date(ticket.resolved_at) : null;
    const isClosed = ticket.is_final_status || ticket.status_code === 'RESOLVED' || ticket.status_code === 'CLOSED';

    if (isClosed) {
      const at = resolved || now;
      const diff = Math.abs(at - due);
      const h = Math.floor(diff / 3600000);
      const d = Math.floor(h / 24);
      const label = at <= due ? 'before deadline' : 'after deadline';
      return d > 0 ? `Resolved ${d}d ${h % 24}h ${label}` : h > 0 ? `Resolved ${h}h ${label}` : `Resolved on time`;
    }

    const diff = due - now;
    if (diff < 0) {
      const h = Math.abs(Math.floor(diff / 3600000));
      const d = Math.floor(h / 24);
      return d > 0 ? `Overdue by ${d}d ${h % 24}h` : `Overdue by ${h}h`;
    }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (d > 0) return `${d}d ${h}h remaining`;
    if (h > 0) return `${h}h ${m}m remaining`;
    return `${m}m remaining`;
  }, [ticket]);

  const slaTotalTime = useMemo(() => {
    if (!ticket?.due_date || !ticket?.created_at) return 'N/A';
    const diff = new Date(ticket.due_date) - new Date(ticket.created_at);
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    return d > 0 ? `${d}d ${h}h` : `${h}h`;
  }, [ticket]);

  // ─────────────────────────────────────
  // LOADING STATE
  // ─────────────────────────────────────
  if (loading) {
    return (
      <div className="td-page">
        <div className="td-loading">
          <div className="td-spinner" />
          <p>Loading ticket details...</p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────
  // ERROR STATE
  // ─────────────────────────────────────
  if (error || !ticket) {
    return (
      <div className="td-page">
        <div className="td-error">
          <AlertCircle size={48} />
          <h3>Ticket Not Found</h3>
          <p>{error || 'The ticket does not exist or you lack permission to view it.'}</p>
          <button className="td-btn td-btn-primary" onClick={() => navigate('/tickets')}>
            <ArrowLeft size={16} /> Back to Tickets
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="td-page">
      <div className="td-content">

        {/* ═══ BREADCRUMB & ACTIONS ═══ */}
        <div className="td-topbar">
          <div className="td-breadcrumb">
            <button className="td-back-btn" onClick={() => navigate('/tickets')}>
              <ArrowLeft size={18} />
            </button>
            <span className="td-crumb" onClick={() => navigate('/tickets')}>Tickets</span>
            <ChevronRight size={14} className="td-crumb-sep" />
            <span className="td-crumb-current">{ticket.ticket_number}</span>
          </div>
          <div className="td-actions">
            <button className="td-action-btn" onClick={fetchTicketDetails} title="Refresh">
              <RefreshCw size={16} />
            </button>
            <button
              className={`td-action-btn ${copied ? 'td-copied' : ''}`}
              onClick={handleCopyTicketNumber}
              title="Copy ticket number"
            >
              {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
            </button>
            {canEdit && (
              <button className="td-btn td-btn-secondary" onClick={() => navigate(`/tickets/edit/${id}`)}>
                <Edit size={15} />
                <span>Edit</span>
              </button>
            )}
            {canDelete && (
              <button className="td-btn td-btn-danger" onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 size={15} />
                <span>Delete</span>
              </button>
            )}
          </div>
        </div>

        {/* ═══ TICKET HEADER CARD ═══ */}
        <div className="td-header-card">
          <div className="td-header-top">
            <div className="td-ticket-id">
              <Hash size={16} />
              <span>{ticket.ticket_number}</span>
            </div>
            <div className="td-badges">
              <span className={`td-badge ${statusColorCls(ticket.status_code)}`}>
                {statusIcon(ticket.status_code)}
                {ticket.status_name}
              </span>
              <span className={`td-badge ${priorityColorCls(ticket.priority_code)}`}>
                {ticket.priority_name}
              </span>
              {ticket.is_escalated && (
                <span className="td-badge td-badge-escalated">
                  <AlertTriangle size={13} />
                  Escalated
                </span>
              )}
              <span className={`td-badge td-sla-badge td-sla-${slaData.status}`}>
                {slaData.status === 'breached' && <XCircle size={13} />}
                {slaData.status === 'met' && <CheckCircle size={13} />}
                {slaData.status === 'warning' && <AlertTriangle size={13} />}
                {slaData.status === 'ok' && <Shield size={13} />}
                {slaData.status === 'none' && <Clock size={13} />}
                {slaData.label}
              </span>
            </div>
          </div>
          <h1 className="td-subject">{ticket.subject || ticket.title || 'No Subject'}</h1>
          <div className="td-header-meta">
            <span className="td-meta-item">
              <User size={14} />
              {ticket.requester_name || 'Unknown'}
            </span>
            <span className="td-meta-sep">·</span>
            <span className="td-meta-item">
              <Calendar size={14} />
              {formatDate(ticket.created_at)}
            </span>
            {ticket.assigned_to_name && (
              <>
                <span className="td-meta-sep">·</span>
                <span className="td-meta-item">
                  <UserCheck size={14} />
                  {ticket.assigned_to_name}
                </span>
              </>
            )}
            {ticket.department_name && (
              <>
                <span className="td-meta-sep">·</span>
                <span className="td-meta-item">
                  <Building size={14} />
                  {ticket.department_name}
                </span>
              </>
            )}
          </div>
        </div>

        {/* ═══ 2-COLUMN LAYOUT ═══ */}
        <div className="td-grid">

          {/* ── LEFT COLUMN ── */}
          <div className="td-left">

            {/* SLA Card */}
            {slaData.status !== 'none' && (
              <div className={`td-card td-sla-card td-sla-card-${slaData.status}`}>
                <div className="td-card-header">
                  <div className="td-card-title">
                    <TrendingUp size={16} />
                    <h3>SLA Information</h3>
                  </div>
                  <span className={`td-sla-pill td-sla-${slaData.status}`}>{slaData.label}</span>
                </div>
                <div className="td-card-body">
                  {slaData.isClosed ? (
                    <div className="td-sla-closed">
                      <div className={`td-sla-result td-sla-result-${slaData.status}`}>
                        {slaData.status === 'met' ? <CheckCircle size={22} /> : <XCircle size={22} />}
                        <div>
                          <span className="td-sla-result-label">{slaData.label}</span>
                          <span className="td-sla-result-desc">{slaTimeText}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="td-sla-progress">
                      <div className="td-sla-progress-header">
                        <span>Time Elapsed</span>
                        <span className={`td-sla-pct td-sla-${slaData.status}`}>{Math.round(slaData.percentage)}%</span>
                      </div>
                      <div className="td-sla-bar">
                        <div className={`td-sla-bar-fill td-sla-fill-${slaData.status}`} style={{ width: `${Math.min(slaData.percentage, 100)}%` }} />
                      </div>
                      <span className={`td-sla-remaining td-sla-${slaData.status}`}>{slaTimeText}</span>
                    </div>
                  )}
                  <div className="td-sla-details">
                    <div className="td-sla-detail">
                      <label>Total SLA Time</label>
                      <span>{slaTotalTime}</span>
                    </div>
                    <div className="td-sla-detail">
                      <label>Started At</label>
                      <span>{formatDate(ticket.created_at)}</span>
                    </div>
                    <div className="td-sla-detail">
                      <label>Due By</label>
                      <span className={slaData.status === 'breached' ? 'td-text-danger' : ''}>{formatDate(ticket.due_date)}</span>
                    </div>
                    {slaData.isClosed && (
                      <div className="td-sla-detail">
                        <label>Resolved At</label>
                        <span className={slaData.status === 'breached' ? 'td-text-danger' : 'td-text-success'}>
                          {formatDate(ticket.resolved_at || ticket.updated_at)}
                        </span>
                      </div>
                    )}
                    {!slaData.isClosed && (
                      <div className="td-sla-detail">
                        <label>Remaining</label>
                        <span className={`td-sla-${slaData.status}`} style={{ fontWeight: 600 }}>{slaTimeText}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Ticket Information */}
            <div className="td-card">
              <div className="td-card-header">
                <div className="td-card-title">
                  <Tag size={16} />
                  <h3>Ticket Information</h3>
                </div>
              </div>
              <div className="td-card-body">
                <div className="td-field">
                  <label>Description</label>
                  <div className="td-description">
                    {ticket.description || 'No description provided'}
                  </div>
                </div>

                <div className="td-info-grid">
                  <div className="td-field">
                    <label><Tag size={13} /> Category</label>
                    <span>{ticket.category_name || 'N/A'}</span>
                  </div>
                  <div className="td-field">
                    <label><User size={13} /> Requester</label>
                    <span>{ticket.requester_name || 'Unknown'}</span>
                  </div>
                  <div className="td-field">
                    <label><UserCheck size={13} /> Assigned To</label>
                    <span>{ticket.assigned_to_name || 'Unassigned'}</span>
                  </div>
                  <div className="td-field">
                    <label><Calendar size={13} /> Created</label>
                    <span>{formatDate(ticket.created_at)}</span>
                  </div>
                  {ticket.department_name && (
                    <div className="td-field">
                      <label><Building size={13} /> Department</label>
                      <span>{ticket.department_name}</span>
                    </div>
                  )}
                  {ticket.resolved_at && (
                    <div className="td-field">
                      <label><CheckCircle size={13} /> Resolved At</label>
                      <span>{formatDate(ticket.resolved_at)}</span>
                    </div>
                  )}
                </div>

                {ticket.resolution_notes && (
                  <div className="td-field td-field-full">
                    <label>Resolution Notes</label>
                    <div className="td-resolution-notes">{ticket.resolution_notes}</div>
                  </div>
                )}

                {ticket.is_escalated && ticket.escalation_reason && (
                  <div className="td-field td-field-full">
                    <label><AlertTriangle size={13} /> Escalation Reason</label>
                    <div className="td-escalation-reason">{ticket.escalation_reason}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Assignment Card */}
            {canAssign && (
              <div className="td-card">
                <div className="td-card-header">
                  <div className="td-card-title">
                    <UserCheck size={16} />
                    <h3>Assign Engineer</h3>
                  </div>
                </div>
                <div className="td-card-body">
                  <div className="td-assign-form">
                    <select
                      className="td-select"
                      value={selectedEngineer}
                      onChange={e => setSelectedEngineer(e.target.value)}
                    >
                      <option value="">Select Engineer...</option>
                      {engineers.map(eng => (
                        <option key={eng.user_id} value={eng.user_id}>
                          {eng.full_name || eng.username}
                          {eng.user_id === ticket.assigned_to_id && ' (Current)'}
                        </option>
                      ))}
                    </select>
                    <button
                      className="td-btn td-btn-primary"
                      onClick={handleAssignEngineer}
                      disabled={assignLoading || !selectedEngineer}
                    >
                      <UserCheck size={15} />
                      <span>{assignLoading ? 'Assigning...' : 'Assign'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT COLUMN — TABS ── */}
          <div className="td-right">
            {/* Tab Navigation */}
            <div className="td-tabs" role="tablist">
              {[
                { key: 'comments', icon: MessageSquare, label: 'Comments', count: comments.length },
                { key: 'activity', icon: Activity, label: 'Activity', count: activities.length },
                { key: 'attachments', icon: Paperclip, label: 'Attachments', count: attachments.length },
              ].map(tab => (
                <button
                  key={tab.key}
                  role="tab"
                  aria-selected={activeTab === tab.key}
                  className={`td-tab ${activeTab === tab.key ? 'td-tab-active' : ''}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  <tab.icon size={16} />
                  <span>{tab.label}</span>
                  <span className="td-tab-count">{tab.count}</span>
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="td-tab-panel" role="tabpanel">
              {/* COMMENTS */}
              {activeTab === 'comments' && (
                <div className="td-comments">
                  {/* Comment Form */}
                  <div className="td-comment-form">
                    <textarea
                      ref={commentRef}
                      className="td-textarea"
                      value={newComment}
                      onChange={e => setNewComment(e.target.value)}
                      onKeyDown={handleCommentKeyDown}
                      placeholder="Write a comment... (Ctrl+Enter to post)"
                      rows={3}
                    />
                    <div className="td-comment-toolbar">
                      <label className="td-internal-toggle">
                        <input
                          type="checkbox"
                          checked={isInternalNote}
                          onChange={e => setIsInternalNote(e.target.checked)}
                        />
                        {isInternalNote ? <EyeOff size={14} /> : <Eye size={14} />}
                        <span>Internal Note</span>
                      </label>
                      <button
                        className="td-btn td-btn-primary td-btn-sm"
                        onClick={handleAddComment}
                        disabled={commentLoading || !newComment.trim()}
                      >
                        <Send size={14} />
                        <span>{commentLoading ? 'Posting...' : 'Post'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Comments List */}
                  {comments.length === 0 ? (
                    <div className="td-empty">
                      <MessageSquare size={36} />
                      <p>No comments yet</p>
                      <small>Be the first to comment on this ticket</small>
                    </div>
                  ) : (
                    <div className="td-comment-list">
                      {comments.map(c => (
                        <div key={c.comment_id} className={`td-comment ${c.is_internal ? 'td-comment-internal' : ''}`}>
                          <div className="td-comment-avatar">
                            <User size={16} />
                          </div>
                          <div className="td-comment-body">
                            <div className="td-comment-header">
                              <div className="td-comment-author">
                                <strong>{c.commenter_name || 'Unknown'}</strong>
                                {c.commenter_role && <span className="td-comment-role">{c.commenter_role}</span>}
                              </div>
                              <div className="td-comment-meta">
                                {c.is_internal && (
                                  <span className="td-internal-badge">
                                    <EyeOff size={11} /> Internal
                                  </span>
                                )}
                                <span className="td-comment-time" title={formatDate(c.commented_at)}>
                                  {timeAgo(c.commented_at)}
                                </span>
                              </div>
                            </div>
                            <div className="td-comment-text">{c.comment_text}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ACTIVITY */}
              {activeTab === 'activity' && (
                <div className="td-activity">
                  {activities.length === 0 ? (
                    <div className="td-empty">
                      <Activity size={36} />
                      <p>No activity yet</p>
                      <small>Changes will appear here as they happen</small>
                    </div>
                  ) : (
                    <div className="td-timeline">
                      {activities.map((a, i) => (
                        <div key={a.activity_id || i} className="td-timeline-item">
                          <div className="td-timeline-line" />
                          <div className="td-timeline-dot">
                            {activityTypeIcon(a.description || a.activity_type)}
                          </div>
                          <div className="td-timeline-content">
                            <p className="td-timeline-text">{a.description}</p>
                            <span className="td-timeline-meta">
                              {a.performed_by_name || 'System'} · {timeAgo(a.performed_at)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ATTACHMENTS */}
              {activeTab === 'attachments' && (
                <div className="td-attachments">
                  {attachments.length === 0 ? (
                    <div className="td-empty">
                      <Paperclip size={36} />
                      <p>No attachments</p>
                      <small>Files will appear here when attached</small>
                    </div>
                  ) : (
                    <div className="td-attachment-list">
                      {attachments.map(a => (
                        <div key={a.attachment_id} className="td-att-item">
                          <div className="td-att-icon">{getFileIcon(a.file_name)}</div>
                          <div className="td-att-info">
                            <span className="td-att-name">{a.file_name}</span>
                            <span className="td-att-meta">
                              {formatFileSize(a.file_size_kb)} · {timeAgo(a.uploaded_at)} · {a.uploaded_by_name || 'Unknown'}
                            </span>
                          </div>
                          <button
                            className="td-action-btn"
                            onClick={() => handleDownloadAttachment(a.attachment_id, a.file_name)}
                            title="Download"
                          >
                            <Download size={16} />
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
      </div>

      {/* ═══ DELETE CONFIRMATION MODAL ═══ */}
      {showDeleteConfirm && (
        <div className="td-modal-overlay" onClick={() => !deleteLoading && setShowDeleteConfirm(false)} role="dialog" aria-modal="true">
          <div className="td-modal" onClick={e => e.stopPropagation()}>
            <div className="td-modal-icon">
              <AlertTriangle size={28} />
            </div>
            <h3>Delete Ticket?</h3>
            <p>This action cannot be undone. The ticket <strong>{ticket.ticket_number}</strong> and all its data will be permanently removed.</p>
            <div className="td-modal-actions">
              <button className="td-btn td-btn-secondary" onClick={() => setShowDeleteConfirm(false)} disabled={deleteLoading}>
                Cancel
              </button>
              <button className="td-btn td-btn-danger" onClick={handleDeleteTicket} disabled={deleteLoading}>
                {deleteLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketDetail;

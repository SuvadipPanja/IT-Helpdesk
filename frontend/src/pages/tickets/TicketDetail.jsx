// ============================================
// TICKET DETAIL v3 — Modern Compact Redesign
// Main + Sidebar layout, rich activity cards,
// fits on one page, dark-mode, accessible
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
  Copy, ChevronRight, Shield, Building, Hash, Plus,
  ArrowUp, FileSpreadsheet, FileArchive, FileCode,
} from 'lucide-react';
import api from '../../services/api';
import '../../styles/TicketDetail.css';

const TicketDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const commentRef = useRef(null);

  /* ── State ── */
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [commentLoading, setCommentLoading] = useState(false);
  const [activities, setActivities] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [selectedEngineer, setSelectedEngineer] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('comments');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  /* ── Permissions ── */
  const canEdit = useMemo(() => {
    if (!user || !ticket) return false;
    return user.permissions?.can_assign_tickets ||
      ticket.requester_id === user.user_id ||
      ticket.assigned_to_id === user.user_id;
  }, [user, ticket]);
  const canDelete = useMemo(() => user?.permissions?.can_delete_tickets, [user]);
  const canAssign = useMemo(() => user?.permissions?.can_assign_tickets, [user]);

  /* ── Fetch engineers ── */
  useEffect(() => {
    if (canAssign) {
      api.get('/system/engineers')
        .then(res => { if (res.data.success) setEngineers(res.data.data); })
        .catch(() => {});
    }
  }, [canAssign]);

  /* ── Fetch ticket ── */
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

  /* ── Handlers ── */
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

  const handleCopyTicketNumber = () => {
    if (!ticket) return;
    navigator.clipboard.writeText(ticket.ticket_number).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

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

  const handleCommentKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && newComment.trim()) handleAddComment();
  };

  /* ── Formatters ── */
  const formatDate = (d) => {
    if (!d) return 'N/A';
    try {
      const dt = new Date(d);
      return dt.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }) +
        ' ' + dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch { return 'Invalid'; }
  };

  const formatShortDate = (d) => {
    if (!d) return 'N/A';
    try {
      return new Date(d).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return 'Invalid'; }
  };

  const timeAgo = (d) => {
    if (!d) return '';
    const s = Math.floor((Date.now() - new Date(d)) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  };

  const formatFileSize = (kb) => {
    if (!kb) return '';
    return kb < 1024 ? `${kb.toFixed(1)} KB` : `${(kb / 1024).toFixed(1)} MB`;
  };

  /* ── Tag helpers ── */
  const statusTagCls = (code) => ({
    OPEN: 'td-tag-open', IN_PROGRESS: 'td-tag-progress', PENDING: 'td-tag-pending',
    ON_HOLD: 'td-tag-hold', RESOLVED: 'td-tag-closed', CLOSED: 'td-tag-closed',
    CANCELLED: 'td-tag-cancelled',
  }[code] || 'td-tag-default');

  const priorityTagCls = (code) => ({
    CRITICAL: 'td-tag-critical', HIGH: 'td-tag-high', MEDIUM: 'td-tag-medium',
    LOW: 'td-tag-low', PLANNING: 'td-tag-planning',
  }[code] || 'td-tag-default');

  const statusIcon = (code) => {
    const icons = { OPEN: AlertCircle, IN_PROGRESS: Clock, PENDING: Clock, ON_HOLD: Clock, RESOLVED: CheckCircle, CLOSED: CheckCircle, CANCELLED: XCircle };
    const Icon = icons[code] || AlertCircle;
    return <Icon size={13} />;
  };

  /* ── Dot colors for sidebar ── */
  const statusDotColor = (code) => ({
    OPEN: '#3b82f6', IN_PROGRESS: '#f59e0b', PENDING: '#f97316',
    ON_HOLD: '#94a3b8', RESOLVED: '#10b981', CLOSED: '#10b981', CANCELLED: '#6b7280',
  }[code] || '#94a3b8');

  const priorityDotColor = (code) => ({
    CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#f59e0b', LOW: '#10b981', PLANNING: '#3b82f6',
  }[code] || '#94a3b8');

  /* ── Activity parser (rich type info) ── */
  const parseActivityInfo = (activity) => {
    const d = (activity.description || activity.activity_type || '').toLowerCase();
    if (d.includes('creat')) return { type: 'Created', color: 'green', icon: Plus };
    if (d.includes('assign')) return { type: 'Assigned', color: 'blue', icon: UserCheck };
    if (d.includes('status') || d.includes('updat')) return { type: 'Updated', color: 'amber', icon: RefreshCw };
    if (d.includes('escal')) return { type: 'Escalated', color: 'red', icon: ArrowUp };
    if (d.includes('close') || d.includes('resolv')) return { type: 'Resolved', color: 'green', icon: CheckCircle };
    if (d.includes('comment') || d.includes('note')) return { type: 'Comment', color: 'purple', icon: MessageSquare };
    if (d.includes('attach') || d.includes('file')) return { type: 'Attachment', color: 'indigo', icon: Paperclip };
    if (d.includes('priority')) return { type: 'Priority', color: 'amber', icon: AlertTriangle };
    return { type: 'Activity', color: 'gray', icon: Activity };
  };

  /* ── File icon ── */
  const getFileIcon = (name) => {
    const ext = (name || '').split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp'].includes(ext)) return <ImageIcon size={18} />;
    if (['pdf'].includes(ext)) return <FileText size={18} className="td-file-pdf" />;
    if (['doc', 'docx'].includes(ext)) return <FileText size={18} className="td-file-doc" />;
    if (['xls', 'xlsx', 'csv'].includes(ext)) return <FileSpreadsheet size={18} className="td-file-xls" />;
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return <FileArchive size={18} className="td-file-zip" />;
    if (['js', 'ts', 'py', 'java', 'cpp', 'html', 'css', 'json', 'xml'].includes(ext)) return <FileCode size={18} className="td-file-code" />;
    return <File size={18} />;
  };

  /* ── SLA Calculations ── */
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
        ? { status: 'met', percentage: 100, label: 'SLA Met', isClosed: true }
        : { status: 'breached', percentage: 100, label: 'SLA Breached', isClosed: true };
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

  /* ═══════════════════════════════════════════
     LOADING STATE
     ═══════════════════════════════════════════ */
  if (loading) {
    return (
      <div className="td-page">
        <div className="td-loading">
          <div className="td-spinner" />
          <p>Loading ticket...</p>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════
     ERROR STATE
     ═══════════════════════════════════════════ */
  if (error || !ticket) {
    return (
      <div className="td-page">
        <div className="td-error-state">
          <AlertCircle size={48} />
          <h3>Ticket Not Found</h3>
          <p>{error || 'The ticket does not exist or you lack permission.'}</p>
          <button className="td-btn td-btn-primary" onClick={() => navigate('/tickets')}>
            <ArrowLeft size={16} /> Back to Tickets
          </button>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════
     MAIN RENDER
     ═══════════════════════════════════════════ */
  return (
    <div className="td-page">
      <div className="td-wrapper">

        {/* ═══ TOPBAR ═══ */}
        <div className="td-topbar">
          <nav className="td-breadcrumb">
            <button className="td-icon-btn" onClick={() => navigate('/tickets')} title="Back">
              <ArrowLeft size={18} />
            </button>
            <span className="td-crumb" onClick={() => navigate('/tickets')}>Tickets</span>
            <ChevronRight size={14} className="td-crumb-sep" />
            <span className="td-crumb-current">{ticket.ticket_number}</span>
          </nav>
          <div className="td-actions">
            <button className="td-icon-btn" onClick={fetchTicketDetails} title="Refresh">
              <RefreshCw size={15} />
            </button>
            <button className={`td-icon-btn ${copied ? 'td-copied' : ''}`} onClick={handleCopyTicketNumber} title="Copy ticket number">
              {copied ? <CheckCircle size={15} /> : <Copy size={15} />}
            </button>
            {canEdit && (
              <button className="td-btn td-btn-ghost" onClick={() => navigate(`/tickets/edit/${id}`)}>
                <Edit size={14} /> Edit
              </button>
            )}
            {canDelete && (
              <button className="td-icon-btn td-icon-danger" onClick={() => setShowDeleteConfirm(true)} title="Delete">
                <Trash2 size={15} />
              </button>
            )}
          </div>
        </div>

        {/* ═══ HERO ═══ */}
        <div className="td-hero">
          <h1 className="td-hero-title">{ticket.subject || ticket.title || 'No Subject'}</h1>
          <div className="td-hero-tags">
            <span className="td-tag td-tag-id"><Hash size={12} /> {ticket.ticket_number}</span>
            <span className={`td-tag ${statusTagCls(ticket.status_code)}`}>{statusIcon(ticket.status_code)} {ticket.status_name}</span>
            <span className={`td-tag ${priorityTagCls(ticket.priority_code)}`}>{ticket.priority_name}</span>
            {slaData.status !== 'none' && (
              <span className={`td-tag td-tag-sla-${slaData.status}`}>
                {slaData.status === 'breached' && <XCircle size={12} />}
                {slaData.status === 'met' && <CheckCircle size={12} />}
                {slaData.status === 'warning' && <AlertTriangle size={12} />}
                {slaData.status === 'ok' && <Shield size={12} />}
                {slaData.label}
              </span>
            )}
            {ticket.is_escalated && (
              <span className="td-tag td-tag-escalated"><AlertTriangle size={12} /> Escalated</span>
            )}
          </div>
          <div className="td-hero-meta">
            <span className="td-meta"><User size={13} /> {ticket.requester_name || 'Unknown'}</span>
            <span className="td-meta-dot">·</span>
            <span className="td-meta"><Calendar size={13} /> {formatDate(ticket.created_at)}</span>
            {ticket.assigned_to_name && (
              <><span className="td-meta-dot">·</span><span className="td-meta"><UserCheck size={13} /> {ticket.assigned_to_name}</span></>
            )}
            {ticket.department_name && (
              <><span className="td-meta-dot">·</span><span className="td-meta"><Building size={13} /> {ticket.department_name}</span></>
            )}
          </div>
        </div>

        {/* ═══ LAYOUT ═══ */}
        <div className="td-layout">

          {/* ── MAIN CONTENT ── */}
          <div className="td-main">

            {/* Description */}
            <section className="td-desc-section">
              <div className="td-section-label"><FileText size={14} /> Description</div>
              <div className="td-desc-text">{ticket.description || 'No description provided'}</div>
            </section>

            {/* Resolution Notes */}
            {ticket.resolution_notes && (
              <div className="td-info-box td-info-success">
                <div className="td-info-box-label"><CheckCircle size={14} /> Resolution Notes</div>
                <p>{ticket.resolution_notes}</p>
              </div>
            )}

            {/* Escalation Reason */}
            {ticket.is_escalated && ticket.escalation_reason && (
              <div className="td-info-box td-info-danger">
                <div className="td-info-box-label"><AlertTriangle size={14} /> Escalation Reason</div>
                <p>{ticket.escalation_reason}</p>
              </div>
            )}

            {/* Tabs */}
            <div className="td-tabs" role="tablist">
              {[
                { key: 'comments', icon: MessageSquare, label: 'Comments', count: comments.length },
                { key: 'activity', icon: Activity, label: 'Activity', count: activities.length },
                { key: 'attachments', icon: Paperclip, label: 'Files', count: attachments.length },
              ].map(tab => (
                <button
                  key={tab.key}
                  role="tab"
                  aria-selected={activeTab === tab.key}
                  className={`td-tab ${activeTab === tab.key ? 'td-tab-active' : ''}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  <tab.icon size={14} />
                  <span className="td-tab-label">{tab.label}</span>
                  <span className="td-tab-count">{tab.count}</span>
                </button>
              ))}
            </div>

            {/* Tab Panel */}
            <div className="td-panel" role="tabpanel">

              {/* ── COMMENTS ── */}
              {activeTab === 'comments' && (
                <>
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
                    <div className="td-comment-actions">
                      <label className="td-internal-toggle">
                        <input type="checkbox" checked={isInternalNote} onChange={e => setIsInternalNote(e.target.checked)} />
                        {isInternalNote ? <EyeOff size={13} /> : <Eye size={13} />}
                        Internal Note
                      </label>
                      <button className="td-btn td-btn-primary td-btn-sm" onClick={handleAddComment} disabled={commentLoading || !newComment.trim()}>
                        <Send size={13} /> {commentLoading ? 'Posting...' : 'Post'}
                      </button>
                    </div>
                  </div>
                  {comments.length === 0 ? (
                    <div className="td-empty-state">
                      <MessageSquare size={28} strokeWidth={1.5} />
                      <p>No comments yet</p>
                      <small>Be the first to comment on this ticket</small>
                    </div>
                  ) : (
                    <div className="td-comments-list">
                      {comments.map(c => (
                        <div key={c.comment_id} className={`td-comment-item ${c.is_internal ? 'td-comment-internal' : ''}`}>
                          <div className="td-comment-avatar"><User size={14} /></div>
                          <div className="td-comment-body">
                            <div className="td-comment-header">
                              <div className="td-comment-who">
                                <strong>{c.commenter_name || 'Unknown'}</strong>
                                {c.commenter_role && <span className="td-comment-role">{c.commenter_role}</span>}
                                {c.is_internal && <span className="td-internal-mark"><EyeOff size={10} /> Internal</span>}
                              </div>
                              <span className="td-comment-time" title={formatDate(c.commented_at)}>{timeAgo(c.commented_at)}</span>
                            </div>
                            <p className="td-comment-text">{c.comment_text}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* ── ACTIVITY (Redesigned — Card-based) ── */}
              {activeTab === 'activity' && (
                <>
                  {activities.length === 0 ? (
                    <div className="td-empty-state">
                      <Activity size={28} strokeWidth={1.5} />
                      <p>No activity recorded</p>
                      <small>Changes will appear here as they happen</small>
                    </div>
                  ) : (
                    <div className="td-activity-list">
                      {activities.map((a, i) => {
                        const info = parseActivityInfo(a);
                        const ActIcon = info.icon;
                        return (
                          <div key={a.activity_id || i} className={`td-act-card td-act-${info.color}`}>
                            <div className="td-act-header">
                              <span className={`td-act-badge td-act-badge-${info.color}`}>
                                <ActIcon size={11} />
                                {info.type}
                              </span>
                              <span className="td-act-time" title={formatDate(a.performed_at)}>
                                <Clock size={11} /> {timeAgo(a.performed_at)}
                              </span>
                            </div>
                            <p className="td-act-desc">{a.description}</p>
                            <div className="td-act-footer">
                              <span className="td-act-user">
                                <User size={11} />
                                {a.performed_by_name || 'System'}
                              </span>
                              <span className="td-act-date">{formatShortDate(a.performed_at)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {/* ── ATTACHMENTS ── */}
              {activeTab === 'attachments' && (
                <>
                  {attachments.length === 0 ? (
                    <div className="td-empty-state">
                      <Paperclip size={28} strokeWidth={1.5} />
                      <p>No attachments</p>
                      <small>Files will appear here when attached</small>
                    </div>
                  ) : (
                    <div className="td-att-list">
                      {attachments.map(a => (
                        <div key={a.attachment_id} className="td-att-card">
                          <div className="td-att-icon">{getFileIcon(a.file_name)}</div>
                          <div className="td-att-details">
                            <span className="td-att-name">{a.file_name}</span>
                            <span className="td-att-meta">
                              {formatFileSize(a.file_size_kb)} · {timeAgo(a.uploaded_at)} · {a.uploaded_by_name || 'Unknown'}
                            </span>
                          </div>
                          <button className="td-icon-btn" onClick={() => handleDownloadAttachment(a.attachment_id, a.file_name)} title="Download">
                            <Download size={15} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ── SIDEBAR ── */}
          <aside className="td-sidebar">

            {/* Details */}
            <div className="td-side-section">
              <h4 className="td-side-title">Details</h4>
              <div className="td-detail-row">
                <span className="td-detail-label">Status</span>
                <span className="td-detail-val">
                  <span className="td-dot" style={{ background: statusDotColor(ticket.status_code) }} />
                  {ticket.status_name}
                </span>
              </div>
              <div className="td-detail-row">
                <span className="td-detail-label">Priority</span>
                <span className="td-detail-val">
                  <span className="td-dot" style={{ background: priorityDotColor(ticket.priority_code) }} />
                  {ticket.priority_name}
                </span>
              </div>
              <div className="td-detail-row">
                <span className="td-detail-label">Category</span>
                <span className="td-detail-val">{ticket.category_name || 'N/A'}</span>
              </div>
              {ticket.department_name && (
                <div className="td-detail-row">
                  <span className="td-detail-label">Department</span>
                  <span className="td-detail-val">{ticket.department_name}</span>
                </div>
              )}
              <div className="td-detail-row">
                <span className="td-detail-label">Requester</span>
                <span className="td-detail-val">{ticket.requester_name || 'Unknown'}</span>
              </div>
              <div className="td-detail-row">
                <span className="td-detail-label">Assigned</span>
                <span className="td-detail-val">{ticket.assigned_to_name || 'Unassigned'}</span>
              </div>
              <div className="td-detail-row">
                <span className="td-detail-label">Created</span>
                <span className="td-detail-val">{formatShortDate(ticket.created_at)}</span>
              </div>
              {ticket.updated_at && (
                <div className="td-detail-row">
                  <span className="td-detail-label">Updated</span>
                  <span className="td-detail-val">{formatShortDate(ticket.updated_at)}</span>
                </div>
              )}
              {ticket.resolved_at && (
                <div className="td-detail-row">
                  <span className="td-detail-label">Resolved</span>
                  <span className="td-detail-val">{formatShortDate(ticket.resolved_at)}</span>
                </div>
              )}
            </div>

            {/* SLA */}
            {slaData.status !== 'none' && (
              <div className="td-side-section">
                <h4 className="td-side-title">SLA</h4>
                <div className={`td-sla-widget td-sla-w-${slaData.status}`}>
                  <div className="td-sla-status-row">
                    {slaData.status === 'met' && <CheckCircle size={15} />}
                    {slaData.status === 'breached' && <XCircle size={15} />}
                    {slaData.status === 'ok' && <Shield size={15} />}
                    {slaData.status === 'warning' && <AlertTriangle size={15} />}
                    <span className="td-sla-lbl">{slaData.label}</span>
                  </div>
                  {!slaData.isClosed && (
                    <div className="td-sla-bar-wrap">
                      <div className="td-sla-bar">
                        <div className={`td-sla-bar-fill td-sla-fill-${slaData.status}`} style={{ width: `${Math.min(slaData.percentage, 100)}%` }} />
                      </div>
                      <span className="td-sla-pct">{Math.round(slaData.percentage)}%</span>
                    </div>
                  )}
                  <span className="td-sla-time-text">{slaTimeText}</span>
                  <div className="td-sla-dates">
                    <div className="td-sla-date-row">
                      <span>Total</span><span>{slaTotalTime}</span>
                    </div>
                    <div className="td-sla-date-row">
                      <span>Due</span>
                      <span className={slaData.status === 'breached' ? 'td-text-danger' : ''}>{formatShortDate(ticket.due_date)}</span>
                    </div>
                    {slaData.isClosed && ticket.resolved_at && (
                      <div className="td-sla-date-row">
                        <span>Resolved</span>
                        <span className={slaData.status === 'met' ? 'td-text-success' : 'td-text-danger'}>{formatShortDate(ticket.resolved_at)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Assignment */}
            {canAssign && (
              <div className="td-side-section">
                <h4 className="td-side-title">Assignment</h4>
                <select className="td-select" value={selectedEngineer} onChange={e => setSelectedEngineer(e.target.value)}>
                  <option value="">Select Engineer...</option>
                  {engineers.map(eng => (
                    <option key={eng.user_id} value={eng.user_id}>
                      {eng.full_name || eng.username}{eng.user_id === ticket.assigned_to_id ? ' (Current)' : ''}
                    </option>
                  ))}
                </select>
                <button className="td-btn td-btn-primary td-btn-full" onClick={handleAssignEngineer} disabled={assignLoading || !selectedEngineer}>
                  <UserCheck size={14} /> {assignLoading ? 'Assigning...' : 'Assign'}
                </button>
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* ═══ DELETE MODAL ═══ */}
      {showDeleteConfirm && (
        <div className="td-modal-overlay" onClick={() => !deleteLoading && setShowDeleteConfirm(false)} role="dialog" aria-modal="true">
          <div className="td-modal" onClick={e => e.stopPropagation()}>
            <div className="td-modal-icon"><AlertTriangle size={26} /></div>
            <h3>Delete Ticket?</h3>
            <p>This action cannot be undone. <strong>{ticket.ticket_number}</strong> will be permanently removed.</p>
            <div className="td-modal-actions">
              <button className="td-btn td-btn-ghost" onClick={() => setShowDeleteConfirm(false)} disabled={deleteLoading}>Cancel</button>
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

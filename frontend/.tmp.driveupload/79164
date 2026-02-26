// ============================================
// TICKET DETAIL PAGE — Polished v3
// Journey-first layout, deduplication, rich descriptions
// ============================================

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  ArrowLeft, Edit, Trash2, Download, Send, Paperclip, User,
  Clock, AlertCircle, CheckCircle, AlertTriangle, Calendar,
  Tag, MessageSquare, Activity, FileText, Image as ImageIcon,
  File, X, Eye, EyeOff, RefreshCw, UserCheck, TrendingUp,
  XCircle, PlusCircle, Zap, Archive, ChevronDown, ChevronUp,
  Building, ArrowRight, Shield, Hash, Star
} from 'lucide-react';
import api from '../../services/api';
import '../../styles/TicketDetail.css';

// ============================================
// Journey Event Configuration
// ============================================
const EVT = {
  created:     { icon: PlusCircle,    gradient: 'linear-gradient(135deg, #3b82f6, #2563eb)', glow: 'rgba(59,130,246,0.25)' },
  assigned:    { icon: UserCheck,     gradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', glow: 'rgba(139,92,246,0.25)' },
  status:      { icon: RefreshCw,     gradient: 'linear-gradient(135deg, #f59e0b, #d97706)', glow: 'rgba(245,158,11,0.25)' },
  comment:     { icon: MessageSquare, gradient: 'linear-gradient(135deg, #10b981, #059669)', glow: 'rgba(16,185,129,0.25)' },
  'internal':  { icon: EyeOff,       gradient: 'linear-gradient(135deg, #f97316, #ea580c)', glow: 'rgba(249,115,22,0.25)' },
  attachment:  { icon: Paperclip,     gradient: 'linear-gradient(135deg, #6366f1, #4f46e5)', glow: 'rgba(99,102,241,0.25)' },
  escalated:   { icon: AlertTriangle, gradient: 'linear-gradient(135deg, #ef4444, #dc2626)', glow: 'rgba(239,68,68,0.25)' },
  firstResp:   { icon: Zap,          gradient: 'linear-gradient(135deg, #06b6d4, #0891b2)', glow: 'rgba(6,182,212,0.25)' },
  resolved:    { icon: CheckCircle,   gradient: 'linear-gradient(135deg, #10b981, #047857)', glow: 'rgba(16,185,129,0.25)' },
  closed:      { icon: Archive,       gradient: 'linear-gradient(135deg, #6b7280, #4b5563)', glow: 'rgba(107,114,128,0.25)' },
  priority:    { icon: AlertCircle,   gradient: 'linear-gradient(135deg, #ec4899, #db2777)', glow: 'rgba(236,72,153,0.25)' },
  update:      { icon: Edit,          gradient: 'linear-gradient(135deg, #94a3b8, #64748b)', glow: 'rgba(148,163,184,0.15)' },
};

// ============================================
// Utilities
// ============================================
const fmtDate = (s) => {
  if (!s) return 'N/A';
  try {
    const d = new Date(s);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    let h = d.getHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${months[d.getMonth()]} ${String(d.getDate()).padStart(2,'0')}, ${d.getFullYear()} • ${String(h).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')} ${ampm}`;
  } catch { return 'Invalid Date'; }
};

const fmtRelative = (s) => {
  if (!s) return '';
  const sec = Math.floor((Date.now() - new Date(s)) / 1000);
  if (sec < 60) return 'Just now';
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
};

const fmtFileSize = (kb) => {
  if (!kb) return '0 KB';
  return kb < 1024 ? `${kb.toFixed(1)} KB` : `${(kb / 1024).toFixed(1)} MB`;
};

const getFileIcon = (name) => {
  const ext = (name || '').split('.').pop().toLowerCase();
  if (['jpg','jpeg','png','gif','svg','webp'].includes(ext)) return ImageIcon;
  if (ext === 'pdf') return FileText;
  return File;
};

// ============================================
// Component
// ============================================
const TicketDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const timerRef = useRef(null);

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [comments, setComments] = useState([]);
  const [activities, setActivities] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [selectedEngineer, setSelectedEngineer] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [commentLoading, setCommentLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [hoveredEvent, setHoveredEvent] = useState(null);

  // Fetch engineers
  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/system/engineers');
        if (r.data.success) setEngineers(r.data.data);
      } catch(e) { console.error('Engineers error:', e); }
    })();
  }, []);

  // Fetch ticket
  const fetchTicket = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      setError('');
      const r = await api.get(`/tickets/${id}`);
      if (r.data.success) {
        const d = r.data.data;
        setTicket(d);
        setComments(d.comments || []);
        setActivities(d.activities || []);
        setAttachments(d.attachments || []);
        if (d.assigned_to_id) setSelectedEngineer(d.assigned_to_id.toString());
        setLastRefresh(new Date());
      } else setError('Ticket not found');
    } catch(e) {
      if (!silent) setError(e.response?.data?.message || 'Failed to load ticket');
    } finally { setLoading(false); setRefreshing(false); }
  }, [id]);

  useEffect(() => { if (id) fetchTicket(); }, [id, fetchTicket]);
  useEffect(() => {
    timerRef.current = setInterval(() => fetchTicket(true), 30000);
    return () => clearInterval(timerRef.current);
  }, [fetchTicket]);

  // Handlers
  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    try {
      setCommentLoading(true);
      const r = await api.post(`/tickets/${id}/comments`, { comment_text: newComment, is_internal: isInternalNote });
      if (r.data.success) {
        setNewComment(''); setIsInternalNote(false);
        toast.success(isInternalNote ? 'Internal note added!' : 'Comment added!');
        fetchTicket(true);
      }
    } catch(e) { toast.error(e.response?.data?.message || 'Failed to add comment'); }
    finally { setCommentLoading(false); }
  };

  const handleAssign = async () => {
    if (!selectedEngineer) { toast.warning('Select an engineer first'); return; }
    try {
      setAssignLoading(true);
      const r = await api.patch(`/tickets/${id}/assign`, { assigned_to: parseInt(selectedEngineer) });
      if (r.data.success) {
        const name = engineers.find(e => e.user_id === parseInt(selectedEngineer))?.full_name || 'Engineer';
        toast.success(`Assigned to ${name}!`);
        fetchTicket(true);
      }
    } catch(e) { toast.error(e.response?.data?.message || 'Failed to assign'); }
    finally { setAssignLoading(false); }
  };

  const handleDelete = async () => {
    try {
      const r = await api.delete(`/tickets/${id}`);
      if (r.data.success) { toast.success('Ticket deleted!'); navigate('/tickets'); }
    } catch(e) { toast.error(e.response?.data?.message || 'Failed to delete'); setShowDeleteConfirm(false); }
  };

  const handleDownload = async (attId, fileName) => {
    try {
      const r = await api.get(`/tickets/${id}/attachments/${attId}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement('a');
      a.href = url; a.setAttribute('download', fileName);
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); window.URL.revokeObjectURL(url);
      toast.success(`Downloading ${fileName}...`);
    } catch { toast.error('Download failed.'); }
  };

  // SLA
  const sla = useMemo(() => {
    if (!ticket?.due_date || !ticket?.created_at) return { status: 'none', pct: 0, color: '#94a3b8', label: 'No SLA', closed: false };
    const now = new Date(), created = new Date(ticket.created_at), due = new Date(ticket.due_date);
    const resolved = ticket.resolved_at ? new Date(ticket.resolved_at) : null;
    const isClosed = ticket.is_final_status || ticket.status_code === 'RESOLVED' || ticket.status_code === 'CLOSED';
    if (isClosed) {
      const end = resolved || now, met = end <= due;
      return { status: met ? 'met' : 'breached', pct: 100, color: met ? '#10b981' : '#ef4444', label: met ? 'SLA Met' : 'SLA Breached', closed: true };
    }
    const pct = Math.min(((now - created) / (due - created)) * 100, 100);
    if (now > due) return { status: 'breached', pct: 100, color: '#ef4444', label: 'Breached', closed: false };
    if (pct >= 80) return { status: 'warning', pct, color: '#f59e0b', label: 'At Risk', closed: false };
    return { status: 'ok', pct, color: '#10b981', label: 'On Track', closed: false };
  }, [ticket]);

  const slaTimeText = useMemo(() => {
    if (!ticket?.due_date) return 'No SLA set';
    const now = new Date(), due = new Date(ticket.due_date);
    const resolved = ticket.resolved_at ? new Date(ticket.resolved_at) : null;
    const isClosed = ticket.is_final_status || ticket.status_code === 'RESOLVED' || ticket.status_code === 'CLOSED';
    if (isClosed) {
      const end = resolved || now, met = end <= due, diff = Math.abs(met ? due - end : end - due);
      const h = Math.floor(diff / 3600000), d = Math.floor(h / 24);
      const t = d > 0 ? `${d}d ${h%24}h` : h > 0 ? `${h}h` : 'on time';
      return met ? `Resolved ${t} before deadline` : `Resolved ${t} after deadline`;
    }
    const diff = due - now;
    if (diff < 0) { const h = Math.abs(Math.floor(diff / 3600000)), d = Math.floor(h / 24); return d > 0 ? `Overdue by ${d}d ${h%24}h` : `Overdue by ${h}h`; }
    const d = Math.floor(diff / 86400000), h = Math.floor((diff % 86400000) / 3600000), m = Math.floor((diff % 3600000) / 60000);
    if (d > 0) return `${d}d ${h}h remaining`;
    if (h > 0) return `${h}h ${m}m remaining`;
    return `${m}m remaining`;
  }, [ticket]);

  const ticketAge = useMemo(() => {
    if (!ticket?.created_at) return 'N/A';
    const end = ticket.resolved_at ? new Date(ticket.resolved_at) : new Date();
    const diff = end - new Date(ticket.created_at);
    const d = Math.floor(diff / 86400000), h = Math.floor((diff % 86400000) / 3600000);
    return d > 0 ? `${d}d ${h}h` : `${h}h`;
  }, [ticket]);

  // Helpers
  const statusClass = (c) => ({ OPEN:'open', IN_PROGRESS:'progress', PENDING:'pending', ON_HOLD:'hold', RESOLVED:'closed', CLOSED:'closed', CANCELLED:'cancelled' }[c] || 'default');
  const priorityClass = (c) => ({ CRITICAL:'critical', HIGH:'high', MEDIUM:'medium', LOW:'low', PLANNING:'planning' }[c] || 'default');
  const StatusIcon = (c) => { const I = { OPEN:AlertCircle, IN_PROGRESS:Clock, PENDING:Clock, ON_HOLD:Clock, RESOLVED:CheckCircle, CLOSED:CheckCircle, CANCELLED:X }[c] || AlertCircle; return <I size={14}/>; };
  const canEdit = () => user && ticket && (user.permissions?.can_assign_tickets || ticket.requester_id === user.user_id || ticket.assigned_to_id === user.user_id);
  const canDelete = () => user?.permissions?.can_delete_tickets;
  const canAssign = () => user?.permissions?.can_assign_tickets;

  // ============================================
  // BUILD JOURNEY — Smart deduplication
  // ============================================
  const journeyEvents = useMemo(() => {
    if (!ticket) return [];
    const events = [];
    const seen = new Set(); // track dedup keys

    // Helper: generate a dedup key from timestamp (rounded to second)
    const tsKey = (ts) => ts ? new Date(ts).toISOString().substring(0, 19) : '';

    // 1. Ticket Created — always first
    const creatorName = ticket.created_by_name || ticket.requester_name || 'Unknown User';
    events.push({
      id: 'created', type: 'created',
      title: `${creatorName} created ticket`,
      desc: ticket.subject,
      hoverText: `Ticket #${ticket.ticket_number} • ${ticket.category_name || 'General'} • ${ticket.priority_name || 'Normal'} priority • Dept: ${ticket.department_name || 'N/A'}`,
      user: creatorName,
      timestamp: ticket.created_at,
    });
    seen.add(`created-${tsKey(ticket.created_at)}`);

    // 2. Process activities — filter duplicates & "created" echoes
    activities.forEach(a => {
      const fld = (a.field_name || '').toLowerCase();
      const atype = (a.activity_type || '').toLowerCase();
      const desc = (a.description || '').toLowerCase();

      // Skip activity if it's a duplicate of the "created" event
      // (same timestamp as created, or description says "created" with no meaningful change)
      const actTs = tsKey(a.performed_at);
      if (actTs === tsKey(ticket.created_at) && (desc.includes('created') || desc.includes('ticket was created'))) return;

      // Skip if old_value === new_value (no real change)
      if (a.old_value && a.new_value && a.old_value === a.new_value) return;

      // Determine event type
      let type = 'update';
      if (fld.includes('assign') || atype.includes('assign')) type = 'assigned';
      else if (fld.includes('status') || atype.includes('status')) type = 'status';
      else if (fld.includes('priority') || atype.includes('priority')) type = 'priority';
      else if (atype.includes('escalat') || fld.includes('escalat')) type = 'escalated';

      // Build rich human-readable title
      let title = a.description || 'Ticket updated';
      const performer = a.performed_by_name || 'System';

      if (type === 'assigned' && a.new_value) {
        title = `${performer} assigned ticket to ${a.new_value}`;
      } else if (type === 'status' && a.new_value) {
        title = `${performer} changed status to ${a.new_value}`;
      } else if (type === 'priority' && a.new_value) {
        title = `${performer} changed priority to ${a.new_value}`;
      }

      // Build hover text
      let hoverText = `Action: ${a.activity_type || type}`;
      if (a.field_name) hoverText += ` • Field: ${a.field_name}`;
      if (a.old_value) hoverText += ` • From: ${a.old_value}`;
      if (a.new_value) hoverText += ` • To: ${a.new_value}`;
      hoverText += ` • By: ${performer} • ${fmtDate(a.performed_at)}`;

      // Dedup key
      const dk = `${type}-${actTs}-${fld}`;
      if (seen.has(dk)) return;
      seen.add(dk);

      events.push({
        id: `act-${a.activity_id}`, type, title, hoverText,
        user: performer, timestamp: a.performed_at,
        oldVal: a.old_value, newVal: a.new_value, field: a.field_name,
      });
    });

    // 3. Comments — no duplicates possible (unique IDs)
    comments.forEach(c => {
      const commenter = c.commenter_name || 'Unknown';
      const isInternal = c.is_internal;
      events.push({
        id: `cmt-${c.comment_id}`,
        type: isInternal ? 'internal' : 'comment',
        title: isInternal
          ? `${commenter} added an internal note`
          : `${commenter} commented`,
        desc: c.comment_text,
        hoverText: `${isInternal ? 'Internal Note' : 'Comment'} by ${commenter} (${c.commenter_role || 'User'}) • ${fmtDate(c.commented_at)}`,
        user: commenter, userRole: c.commenter_role,
        timestamp: c.commented_at, isInternal,
      });
    });

    // 4. Attachments — dedup against activity entries mentioning same file
    attachments.forEach(att => {
      // Check if an activity already describes this attachment upload
      const attName = (att.file_name || '').toLowerCase();
      const hasDupActivity = activities.some(a => {
        const d = (a.description || '').toLowerCase();
        return d.includes(attName) || (d.includes('attachment') && tsKey(a.performed_at) === tsKey(att.uploaded_at));
      });
      if (hasDupActivity) return; // skip — already shown via activity

      const uploader = att.uploaded_by_name || 'Unknown';
      events.push({
        id: `att-${att.attachment_id}`, type: 'attachment',
        title: `${uploader} attached a file`,
        desc: att.file_name,
        hoverText: `File: ${att.file_name} • Size: ${fmtFileSize(att.file_size_kb)} • Type: ${att.file_type || 'Unknown'} • Uploaded by: ${uploader} • ${fmtDate(att.uploaded_at)}`,
        user: uploader, timestamp: att.uploaded_at,
        attachment: att,
      });
    });

    // 5. Milestones — only if not already present from activities
    if (ticket.first_response_at) {
      const exists = events.some(e => e.type === 'firstResp' || ((e.type === 'update' || e.type === 'status') && (e.title||'').toLowerCase().includes('first response')));
      if (!exists) {
        const agent = ticket.assigned_to_name || 'Agent';
        events.push({
          id: 'first-resp', type: 'firstResp',
          title: `${agent} sent first response`,
          desc: ticket.first_response_sla_met ? 'Response within SLA target ✓' : 'SLA response target exceeded ✗',
          hoverText: `First response by ${agent} • ${fmtDate(ticket.first_response_at)} • SLA ${ticket.first_response_sla_met ? 'Met' : 'Missed'}`,
          user: agent, timestamp: ticket.first_response_at,
        });
      }
    }

    if (ticket.is_escalated && ticket.escalated_at) {
      const exists = events.some(e => e.type === 'escalated');
      if (!exists) {
        events.push({
          id: 'escalated', type: 'escalated',
          title: `Ticket escalated${ticket.escalated_to_name ? ` to ${ticket.escalated_to_name}` : ''}`,
          desc: ticket.escalation_reason || 'Escalated due to SLA breach or manual action',
          hoverText: `Escalated to: ${ticket.escalated_to_name || 'Manager'} • Reason: ${ticket.escalation_reason || 'N/A'} • ${fmtDate(ticket.escalated_at)}`,
          user: 'System', timestamp: ticket.escalated_at,
        });
      }
    }

    if (ticket.resolved_at) {
      const exists = events.some(e => e.type === 'resolved' || (e.type === 'status' && (e.newVal||'').toLowerCase().includes('resolved')));
      if (!exists) {
        const agent = ticket.assigned_to_name || 'Agent';
        events.push({
          id: 'resolved', type: 'resolved',
          title: `${agent} resolved the ticket`,
          desc: ticket.resolution_notes || 'Ticket marked as resolved',
          hoverText: `Resolved by ${agent} • ${fmtDate(ticket.resolved_at)}${ticket.resolution_notes ? ` • Notes: ${ticket.resolution_notes}` : ''}`,
          user: agent, timestamp: ticket.resolved_at,
        });
      }
    }

    if (ticket.closed_at && ticket.closed_at !== ticket.resolved_at) {
      const exists = events.some(e => e.type === 'closed' || (e.type === 'status' && (e.newVal||'').toLowerCase().includes('closed')));
      if (!exists) {
        events.push({
          id: 'closed', type: 'closed',
          title: 'Ticket was closed',
          desc: ticket.auto_closed ? 'Automatically closed after inactivity period' : 'Ticket manually closed',
          hoverText: `Closed at ${fmtDate(ticket.closed_at)} • ${ticket.auto_closed ? 'Auto-closed' : 'Manual close'}`,
          user: 'System', timestamp: ticket.closed_at,
        });
      }
    }

    events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    return events;
  }, [ticket, comments, activities, attachments]);

  // ============================================
  // RENDER
  // ============================================
  if (loading) {
    return (
      <div className="td-page">
        <div className="td-loading"><div className="td-spinner" /><p>Loading ticket details...</p></div>
      </div>
    );
  }
  if (error || !ticket) {
    return (
      <div className="td-page">
        <div className="td-error">
          <AlertCircle size={56} />
          <h2>Ticket Not Found</h2>
          <p>{error || 'The ticket does not exist or you don\'t have permission.'}</p>
          <button className="td-btn td-btn-primary" onClick={() => navigate('/tickets')}><ArrowLeft size={18} /> Back to Tickets</button>
        </div>
      </div>
    );
  }

  return (
    <div className="td-page">
      {/* ==================== HEADER ==================== */}
      <header className="td-header">
        <div className="td-header-left">
          <button className="td-btn-back" onClick={() => navigate('/tickets')}>
            <ArrowLeft size={16} /><span>Back</span>
          </button>
          <div className="td-ticket-id">
            <Hash size={13} /><span>{ticket.ticket_number}</span>
          </div>
          <div className={`td-pill td-st-${statusClass(ticket.status_code)}`}>
            {StatusIcon(ticket.status_code)}<span>{ticket.status_name}</span>
          </div>
          <div className={`td-pill td-pr-${priorityClass(ticket.priority_code)}`}>
            {(ticket.priority_code === 'CRITICAL' || ticket.priority_code === 'HIGH') && <AlertTriangle size={12} />}
            <span>{ticket.priority_name}</span>
          </div>
          {sla.status !== 'none' && (
            <div className={`td-pill td-sla-${sla.status}`}>
              {(sla.status === 'ok' || sla.status === 'met') ? <CheckCircle size={12}/> : sla.status === 'warning' ? <AlertTriangle size={12}/> : <XCircle size={12}/>}
              <span>{sla.label}</span>
            </div>
          )}
          {ticket.is_escalated && (
            <div className="td-pill td-esc-pill"><AlertTriangle size={12}/><span>Escalated</span></div>
          )}
        </div>
        <div className="td-header-right">
          <span className="td-refresh-ts">Updated {fmtRelative(lastRefresh)}</span>
          <button className={`td-icon-btn ${refreshing ? 'spin' : ''}`} onClick={() => fetchTicket(true)} title="Refresh"><RefreshCw size={15}/></button>
          {canEdit() && <button className="td-btn td-btn-outline" onClick={() => navigate(`/tickets/edit/${id}`)}><Edit size={14}/><span>Edit</span></button>}
          {canDelete() && <button className="td-btn td-btn-danger" onClick={() => setShowDeleteConfirm(true)}><Trash2 size={14}/><span>Delete</span></button>}
        </div>
      </header>

      {/* ==================== SUBJECT BAR ==================== */}
      <div className="td-subject-bar">
        <h1 className="td-subject">{ticket.subject || ticket.title || 'No Subject'}</h1>
        <div className="td-subject-meta">
          <span>Created by <strong>{ticket.created_by_name || ticket.requester_name}</strong></span>
          <span className="td-dot">•</span>
          <span>{fmtDate(ticket.created_at)}</span>
          <span className="td-dot">•</span>
          <span>Age: <strong>{ticketAge}</strong></span>
        </div>
      </div>

      {/* ==================== JOURNEY (TOP — FULL WIDTH) ==================== */}
      <section className="td-journey">
        <div className="td-journey-head">
          <div className="td-journey-title">
            <div className="td-journey-icon-wrap"><Activity size={18} /></div>
            <h2>Ticket Journey</h2>
          </div>
          <div className="td-journey-stats">
            <span className="td-jstat"><MessageSquare size={12}/> {comments.length}</span>
            <span className="td-jstat"><Paperclip size={12}/> {attachments.length}</span>
            <span className="td-jstat"><Activity size={12}/> {journeyEvents.length} events</span>
          </div>
        </div>

        <div className="td-tl">
          {journeyEvents.map((evt, idx) => {
            const cfg = EVT[evt.type] || EVT.update;
            const Icon = cfg.icon;
            const isFirst = idx === 0;
            const isLast = idx === journeyEvents.length - 1;
            const isHovered = hoveredEvent === evt.id;

            return (
              <div
                key={evt.id}
                className={`td-tl-item ${isFirst ? 'first' : ''} ${isLast ? 'last' : ''} ${evt.isInternal ? 'internal' : ''} ${isHovered ? 'hovered' : ''}`}
                onMouseEnter={() => setHoveredEvent(evt.id)}
                onMouseLeave={() => setHoveredEvent(null)}
              >
                {/* Node */}
                <div className="td-tl-node" style={{ background: cfg.gradient, boxShadow: `0 0 0 4px ${cfg.glow}` }}>
                  <Icon size={isFirst || isLast ? 16 : 13} color="#fff" />
                </div>

                {/* Content */}
                <div className={`td-tl-card ${isFirst ? 'card-first' : ''} ${isLast ? 'card-last' : ''}`}>
                  {/* Hover tooltip */}
                  {isHovered && evt.hoverText && (
                    <div className="td-tl-tooltip">{evt.hoverText}</div>
                  )}

                  <div className="td-tl-row1">
                    <h4 className="td-tl-title">{evt.title}</h4>
                    <time className="td-tl-time" title={fmtDate(evt.timestamp)}>{fmtRelative(evt.timestamp)}</time>
                  </div>

                  {/* Status/Priority/Assignment change: old → new */}
                  {(evt.type === 'status' || evt.type === 'priority' || evt.type === 'assigned') && evt.oldVal && evt.newVal && (
                    <div className="td-tl-change">
                      <span className="td-val-old">{evt.oldVal}</span>
                      <ArrowRight size={12} className="td-arrow" />
                      <span className="td-val-new">{evt.newVal}</span>
                    </div>
                  )}

                  {/* Description / comment body */}
                  {evt.desc && (
                    <p className={`td-tl-desc ${evt.type === 'comment' || evt.type === 'internal' ? 'td-quote' : ''}`}>
                      {evt.desc.length > 200 ? evt.desc.substring(0, 200) + '...' : evt.desc}
                    </p>
                  )}

                  {/* Attachment download */}
                  {evt.type === 'attachment' && evt.attachment && (
                    <button className="td-tl-dl" onClick={() => handleDownload(evt.attachment.attachment_id, evt.attachment.file_name)}>
                      <Download size={12}/> Download ({fmtFileSize(evt.attachment.file_size_kb)})
                    </button>
                  )}

                  <div className="td-tl-foot">
                    <div className="td-tl-user">
                      <div className="td-avatar" style={{ background: cfg.gradient }}>{(evt.user || '?')[0].toUpperCase()}</div>
                      <span className="td-uname">{evt.user}</span>
                      {evt.userRole && <span className="td-urole">({evt.userRole})</span>}
                    </div>
                    <span className="td-tl-date">{fmtDate(evt.timestamp)}</span>
                  </div>
                </div>
              </div>
            );
          })}
          {journeyEvents.length === 0 && (
            <div className="td-empty-journey"><Activity size={36}/><p>No journey events yet</p></div>
          )}
        </div>
      </section>

      {/* ==================== BOTTOM GRID ==================== */}
      <div className="td-bottom">
        {/* ---- Details Column ---- */}
        <div className="td-details-col">
          {/* Description */}
          <div className="td-card">
            <div className="td-card-head"><FileText size={16}/><h3>Description</h3></div>
            <div className="td-desc-box">
              <p className="td-desc-text">
                {ticket.description
                  ? (ticket.description.length > 300 && !descExpanded ? ticket.description.substring(0, 300) + '...' : ticket.description)
                  : 'No description provided.'}
              </p>
              {ticket.description?.length > 300 && (
                <button className="td-desc-toggle" onClick={() => setDescExpanded(!descExpanded)}>
                  {descExpanded ? <><ChevronUp size={13}/> Less</> : <><ChevronDown size={13}/> More</>}
                </button>
              )}
            </div>
            {ticket.resolution_notes && (
              <div className="td-resolution">
                <CheckCircle size={14}/>
                <div><strong>Resolution</strong><p>{ticket.resolution_notes}</p></div>
              </div>
            )}
          </div>

          {/* Meta info */}
          <div className="td-card">
            <div className="td-card-head"><Shield size={16}/><h3>Ticket Information</h3></div>
            <div className="td-info-grid">
              <div className="td-info-cell"><Tag size={13}/><label>Category</label><span>{ticket.category_name || 'N/A'}</span></div>
              <div className="td-info-cell"><Building size={13}/><label>Department</label><span>{ticket.department_name || 'N/A'}</span></div>
              <div className="td-info-cell"><User size={13}/><label>Requester</label><span>{ticket.requester_name || 'Unknown'}</span></div>
              <div className="td-info-cell"><UserCheck size={13}/><label>Assigned To</label><span>{ticket.assigned_to_name || 'Unassigned'}</span></div>
              <div className="td-info-cell"><Calendar size={13}/><label>Created</label><span>{fmtDate(ticket.created_at)}</span></div>
              <div className="td-info-cell"><Clock size={13}/><label>Due Date</label><span className={sla.status === 'breached' ? 'td-text-danger' : ''}>{ticket.due_date ? fmtDate(ticket.due_date) : 'No SLA'}</span></div>
              <div className="td-info-cell"><Zap size={13}/><label>First Response</label><span>{ticket.first_response_at ? fmtRelative(ticket.first_response_at) : 'Pending'}</span></div>
              <div className="td-info-cell"><Activity size={13}/><label>Ticket Age</label><span>{ticketAge}</span></div>
              {ticket.requester_email && <div className="td-info-cell"><span className="td-email-icon">@</span><label>Email</label><span className="td-info-email">{ticket.requester_email}</span></div>}
              {ticket.escalated_to_name && <div className="td-info-cell"><AlertTriangle size={13}/><label>Escalated To</label><span className="td-text-danger">{ticket.escalated_to_name}</span></div>}
              {ticket.rating && <div className="td-info-cell"><Star size={13}/><label>Rating</label><span className="td-stars">{'★'.repeat(ticket.rating)}{'☆'.repeat(5-ticket.rating)}</span></div>}
              {ticket.feedback && <div className="td-info-cell full-w"><MessageSquare size={13}/><label>Feedback</label><span>{ticket.feedback}</span></div>}
            </div>
          </div>
        </div>

        {/* ---- Actions Column ---- */}
        <div className="td-actions-col">
          {/* SLA */}
          {sla.status !== 'none' && (
            <div className="td-card td-card-sla">
              <div className="td-card-head"><TrendingUp size={16}/><h3>SLA</h3></div>
              <div className={`td-sla-badge td-sla-${sla.status}`}>
                {(sla.status === 'ok' || sla.status === 'met') ? <CheckCircle size={18}/> : sla.status === 'warning' ? <AlertTriangle size={18}/> : <XCircle size={18}/>}
                <div><strong>{sla.label}</strong><span>{slaTimeText}</span></div>
              </div>
              {!sla.closed && (
                <div className="td-sla-bar-wrap">
                  <div className="td-sla-track"><div className="td-sla-fill" style={{ width: `${Math.min(sla.pct,100)}%`, background: sla.color }}/></div>
                  <span className="td-sla-pct" style={{ color: sla.color }}>{Math.round(sla.pct)}%</span>
                </div>
              )}
            </div>
          )}

          {/* Assign */}
          {canAssign() && (
            <div className="td-card">
              <div className="td-card-head"><UserCheck size={16}/><h3>Assign</h3></div>
              <div className="td-assign">
                <select className="td-select" value={selectedEngineer} onChange={e => setSelectedEngineer(e.target.value)}>
                  <option value="">Select Engineer...</option>
                  {engineers.map(eng => (
                    <option key={eng.user_id} value={eng.user_id}>
                      {eng.full_name || eng.username}{eng.user_id === ticket.assigned_to_id ? ' (Current)' : ''}
                    </option>
                  ))}
                </select>
                <button className="td-btn td-btn-green" onClick={handleAssign} disabled={assignLoading || !selectedEngineer}>
                  <UserCheck size={14}/>{assignLoading ? 'Assigning...' : 'Assign'}
                </button>
              </div>
            </div>
          )}

          {/* Comment */}
          <div className="td-card">
            <div className="td-card-head"><MessageSquare size={16}/><h3>Comment</h3></div>
            <textarea className="td-textarea" value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Write a comment..." rows={3}/>
            <div className="td-cmt-actions">
              <label className="td-toggle-int">
                <input type="checkbox" checked={isInternalNote} onChange={e => setIsInternalNote(e.target.checked)}/>
                {isInternalNote ? <EyeOff size={13}/> : <Eye size={13}/>}
                <span>Internal</span>
              </label>
              <button className="td-btn td-btn-primary" onClick={handleAddComment} disabled={commentLoading || !newComment.trim()}>
                <Send size={13}/>{commentLoading ? 'Posting...' : 'Post'}
              </button>
            </div>
          </div>

          {/* Attachments */}
          <div className="td-card">
            <div className="td-card-head"><Paperclip size={16}/><h3>Attachments</h3><span className="td-badge">{attachments.length}</span></div>
            {attachments.length === 0 ? (
              <div className="td-empty-sm"><Paperclip size={24}/><p>No attachments</p></div>
            ) : (
              <div className="td-att-list">
                {attachments.map(att => {
                  const FI = getFileIcon(att.file_name);
                  return (
                    <div key={att.attachment_id} className="td-att-row">
                      <div className="td-att-ic"><FI size={16}/></div>
                      <div className="td-att-info">
                        <span className="td-att-name">{att.file_name}</span>
                        <span className="td-att-sub">{fmtFileSize(att.file_size_kb)} • {att.uploaded_by_name || 'Unknown'}</span>
                      </div>
                      <button className="td-icon-btn" onClick={() => handleDownload(att.attachment_id, att.file_name)} title="Download"><Download size={14}/></button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ==================== DELETE MODAL ==================== */}
      {showDeleteConfirm && (
        <div className="td-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="td-modal" onClick={e => e.stopPropagation()}>
            <div className="td-modal-ic"><AlertTriangle size={28}/></div>
            <h3>Delete Ticket?</h3>
            <p>Permanently delete <strong>#{ticket.ticket_number}</strong>. This cannot be undone.</p>
            <div className="td-modal-btns">
              <button className="td-btn td-btn-outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button className="td-btn td-btn-danger" onClick={() => { handleDelete(); setShowDeleteConfirm(false); }}><Trash2 size={14}/> Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketDetail;

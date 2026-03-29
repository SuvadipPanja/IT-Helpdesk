// ============================================
// TICKET DETAIL PAGE — Modern Redesign
// Features: Ticket Journey Timeline, Real-time updates,
// Comprehensive details, Dark mode support
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
  Building, ArrowRight, Mail, Phone, Shield, Hash, Flag, Trophy, Repeat2, RotateCcw,
  Users, GitMerge, BadgeCheck, ThumbsDown, ClipboardList
} from 'lucide-react';
import api from '../../services/api';
import RatingModal from '../../components/tickets/RatingModal';
import RatingDisplay from '../../components/tickets/RatingDisplay';
import AttachmentPreviewModal from '../../components/tickets/AttachmentPreviewModal';
import AIAssistPanel from '../../components/tickets/AIAssistPanel';
import { formatDateTimeDisplay, timeAgo as formatRelativeTime } from '../../utils/dateUtils';
import '../../styles/TicketDetail.css';

// ============================================
// Journey Event Type Configuration
// ============================================
const EVENT_CONFIG = {
  created: { icon: PlusCircle, color: '#3b82f6', bg: '#eff6ff', label: 'Ticket Created' },
  assigned: { icon: UserCheck, color: '#8b5cf6', bg: '#f5f3ff', label: 'Assigned' },
  reassigned: { icon: Repeat2, color: '#d946ef', bg: '#fdf4ff', label: 'Reassigned' },
  status: { icon: RefreshCw, color: '#f59e0b', bg: '#fffbeb', label: 'Status Changed' },
  comment: { icon: MessageSquare, color: '#10b981', bg: '#f0fdf4', label: 'Comment' },
  'internal-note': { icon: EyeOff, color: '#f97316', bg: '#fff7ed', label: 'Internal Note' },
  attachment: { icon: Paperclip, color: '#6366f1', bg: '#eef2ff', label: 'File Attached' },
  escalated: { icon: AlertTriangle, color: '#ef4444', bg: '#fef2f2', label: 'Escalated' },
  'first-response': { icon: Zap, color: '#06b6d4', bg: '#ecfeff', label: 'First Response' },
  resolved: { icon: CheckCircle, color: '#059669', bg: '#f0fdf4', label: 'Resolved' },
  closed: { icon: Archive, color: '#6b7280', bg: '#f9fafb', label: 'Closed' },
  reopened: { icon: RotateCcw, color: '#f97316', bg: '#fff7ed', label: 'Reopened' },
  priority: { icon: AlertCircle, color: '#ec4899', bg: '#fdf2f8', label: 'Priority Changed' },
  rated: { icon: Trophy, color: '#f59e0b', bg: '#fffbeb', label: 'Rated' },
  update: { icon: Edit, color: '#64748b', bg: '#f8fafc', label: 'Updated' },
  'info-requested': { icon: Flag, color: '#8b5cf6', bg: '#f5f3ff', label: 'More Details Requested' },
  'info-provided': { icon: CheckCircle, color: '#059669', bg: '#ecfdf5', label: 'Details Provided' },
  'team-routed': { icon: GitMerge, color: '#0ea5e9', bg: '#f0f9ff', label: 'Routed to Team' },
  'self-assigned': { icon: UserCheck, color: '#7c3aed', bg: '#f5f3ff', label: 'Self-Assigned' },
  'approval-requested': { icon: ClipboardList, color: '#f59e0b', bg: '#fffbeb', label: 'Approval Requested' },
  'approval-approved': { icon: BadgeCheck, color: '#059669', bg: '#ecfdf5', label: 'Approval Granted' },
  'approval-rejected': { icon: ThumbsDown, color: '#dc2626', bg: '#fef2f2', label: 'Approval Rejected' },
  'approval-cancelled': { icon: X, color: '#6b7280', bg: '#f9fafb', label: 'Approval Cancelled' },
};

// ============================================
// Get actor sub-label for journey nodes
// ============================================
const getActorLabel = (event) => {
  if (!event) return '';
  switch (event.type) {
    case 'created':
      return `by ${event.user || 'Unknown'}`;
    case 'assigned': {
      const isAuto = (event.description || '').toLowerCase().includes('auto');
      if (isAuto) return `Auto → ${event.newValue || 'Engineer'}`;
      return `by ${event.user || 'System'}`;
    }
    case 'reassigned':
      return event.newValue ? `→ ${event.newValue}` : `by ${event.user || 'System'}`;
    case 'comment':
    case 'internal-note':
      return `by ${event.user || 'Unknown'}`;
    case 'status':
      return event.newValue ? `→ ${event.newValue}` : `by ${event.user || 'System'}`;
    case 'priority':
      return event.newValue ? `→ ${event.newValue}` : `by ${event.user || 'System'}`;
    case 'first-response':
      return `by ${event.user || 'Agent'}`;
    case 'escalated':
      return `by ${event.user || 'System'}`;
    case 'resolved':
    case 'closed':
    case 'reopened':
      return `by ${event.user || 'System'}`;
    case 'attachment':
      return `by ${event.user || 'Unknown'}`;
    case 'team-routed':
      return event.newValue ? `→ ${event.newValue}` : `by ${event.user || 'System'}`;
    case 'self-assigned':
      return `by ${event.user || 'Engineer'}`;
    default:
      return event.user ? `by ${event.user}` : '';
  }
};

// ============================================
// Utility Functions (using centralized dateUtils)
// ============================================
const formatDate = (dateString) => formatDateTimeDisplay(dateString);

const formatFileSize = (kb) => {
  if (!kb) return '0 KB';
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
};

const getFileIcon = (fileName) => {
  const ext = (fileName || '').split('.').pop().toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) return ImageIcon;
  if (['pdf'].includes(ext)) return FileText;
  return File;
};

const formatGuidanceVariableLabel = (value) => String(value || '')
  .replace(/_/g, ' ')
  .replace(/\b\w/g, (char) => char.toUpperCase());

// ============================================
// Main Component
// ============================================
const TicketDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const refreshTimer = useRef(null);

  // ---- State ----
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
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeNote, setCloseNote] = useState('');
  const [closeLoading, setCloseLoading] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [reopenLoading, setReopenLoading] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingData, setRatingData] = useState(null);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [showRequestInfoModal, setShowRequestInfoModal] = useState(false);
  const [requestInfoNote, setRequestInfoNote] = useState('');
  const [requestInfoLoading, setRequestInfoLoading] = useState(false);
  const [showProvideInfoModal, setShowProvideInfoModal] = useState(false);
  const [provideInfoNote, setProvideInfoNote] = useState('');
  const [provideInfoDescription, setProvideInfoDescription] = useState('');
  const [provideInfoLoading, setProvideInfoLoading] = useState(false);
  // Approval workflow state
  const [showApprovalRequestModal, setShowApprovalRequestModal] = useState(false);
  const [approvalNote, setApprovalNote] = useState('');
  const [approvalApproverId, setApprovalApproverId] = useState('');
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [approvers, setApprovers] = useState([]);
  const [showApprovalDecideModal, setShowApprovalDecideModal] = useState(false);
  const [approvalDecision, setApprovalDecision] = useState('APPROVED'); // 'APPROVED' | 'REJECTED'
  const [approvalDecisionNote, setApprovalDecisionNote] = useState('');
  const [approvalDecideLoading, setApprovalDecideLoading] = useState(false);
  // Closure-approval (manager sign-off before close) — from GET /ticket-approvals/:id/can-close
  const [closePerm, setClosePerm] = useState(null);
  const [closureActionLoading, setClosureActionLoading] = useState(false);
  const [showRequestClosureModal, setShowRequestClosureModal] = useState(false);
  const [showRejectClosureModal, setShowRejectClosureModal] = useState(false);
  const [rejectClosureReason, setRejectClosureReason] = useState('');
  const [descExpanded, setDescExpanded] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [previewAtt, setPreviewAtt] = useState(null); // attachment being previewed
  const journeyScrollRef = useRef(null);

  // API base URL (without /api/v1 suffix) for blob fetching in preview modal
  const apiBase = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace('/api/v1', '');

  // ---- Fetch Engineers ----
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/system/engineers');
        if (res.data.success) setEngineers(res.data.data);
      } catch {
        // Error handled silently
      }
    })();
  }, []);

  // ---- Fetch Approvers (team managers for this ticket; admins get full list) ----
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await api.get(`/ticket-approvals/approvers?ticket_id=${encodeURIComponent(id)}`);
        if (res.data.success) setApprovers(res.data.data || []);
      } catch {
        setApprovers([]);
      }
    })();
  }, [id]);

  // ---- Fetch Ticket Details ----
  const fetchTicketDetails = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      setError('');
      const res = await api.get(`/tickets/${id}`);
      if (res.data.success) {
        const d = res.data.data;
        setTicket(d);
        setComments(d.comments || []);
        setActivities(d.activities || []);
        setAttachments(d.attachments || []);
        if (d.assigned_to_id) setSelectedEngineer(d.assigned_to_id.toString());
        setLastRefresh(new Date());
      } else {
        setError('Ticket not found');
      }
    } catch (e) {
      // Error handled silently
      if (!silent) setError(e.response?.data?.message || 'Failed to load ticket details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { if (id) fetchTicketDetails(); }, [id, fetchTicketDetails]);

  const fetchClosePermission = useCallback(async () => {
    if (!id) return;
    try {
      const res = await api.get(`/ticket-approvals/${id}/can-close`);
      const d = res.data?.data ?? res.data;
      setClosePerm(d && typeof d === 'object' ? d : null);
    } catch {
      setClosePerm(null);
    }
  }, [id]);

  useEffect(() => {
    if (id) fetchClosePermission();
  }, [id, fetchClosePermission, ticket?.status_name, ticket?.updated_at, ticket?.ticket_id]);

  // Auto-refresh every 30s
  useEffect(() => {
    refreshTimer.current = setInterval(() => fetchTicketDetails(true), 30000);
    return () => clearInterval(refreshTimer.current);
  }, [fetchTicketDetails]);

  // ---- Handlers ----
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
        toast.success(isInternalNote ? 'Internal note added!' : 'Comment added!');
        fetchTicketDetails(true);
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to add comment');
    } finally { setCommentLoading(false); }
  };

  const handleAssignEngineer = async () => {
    if (!selectedEngineer) { toast.warning('Please select an engineer'); return; }
    try {
      setAssignLoading(true);
      const res = await api.patch(`/tickets/${id}/assign`, { assigned_to: parseInt(selectedEngineer) });
      if (res.data.success) {
        const name = engineers.find(e => e.user_id === parseInt(selectedEngineer))?.full_name || 'Engineer';
        toast.success(isReassignMode() ? `Reassigned to ${name}!` : `Assigned to ${name}!`);
        fetchTicketDetails(true);
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to assign ticket');
    } finally { setAssignLoading(false); }
  };

  const handleDeleteTicket = async () => {
    try {
      const res = await api.delete(`/tickets/${id}`);
      if (res.data.success) {
        toast.success('Ticket deleted!');
        navigate('/tickets');
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to delete ticket');
      setShowDeleteConfirm(false);
    }
  };

  const handleCloseTicket = async () => {
    if (!closeNote.trim()) { toast.warning('Please enter close notes'); return; }
    try {
      setCloseLoading(true);
      const res = await api.patch(`/tickets/${id}/close`, { close_notes: closeNote.trim() });
      if (res.data.success) {
        toast.success('Ticket closed successfully!');
        setShowCloseModal(false);
        setCloseNote('');
        fetchTicketDetails(true);
      }
    } catch (e) {
      const msg = e.response?.data?.message || 'Failed to close ticket';
      const code = e.response?.data?.data?.code || e.response?.data?.code;
      if (code === 'CLOSURE_APPROVAL_REQUIRED' || msg.includes('manager approval')) {
        toast.error(msg + ' Use "Request closure approval" if you are the assignee.');
      } else {
        toast.error(msg);
      }
    } finally { setCloseLoading(false); }
  };

  const handleRequestClosureApproval = async () => {
    try {
      setClosureActionLoading(true);
      const res = await api.post(`/ticket-approvals/${id}/request-closure`);
      if (res.data.success !== false) {
        toast.success(res.data.message || 'Closure request sent to managers for approval.');
        setShowRequestClosureModal(false);
        await fetchTicketDetails(true);
        await fetchClosePermission();
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to submit closure request');
    } finally {
      setClosureActionLoading(false);
    }
  };

  const handleApproveClosure = async () => {
    try {
      setClosureActionLoading(true);
      const res = await api.post(`/ticket-approvals/${id}/approve-closure`, { autoClose: true });
      if (res.data.success !== false) {
        toast.success(res.data.message || 'Closure approved and ticket closed.');
        await fetchTicketDetails(true);
        await fetchClosePermission();
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to approve closure');
    } finally {
      setClosureActionLoading(false);
    }
  };

  const handleRejectClosure = async () => {
    if (!rejectClosureReason.trim()) {
      toast.warning('Please enter a rejection reason');
      return;
    }
    try {
      setClosureActionLoading(true);
      const res = await api.post(`/ticket-approvals/${id}/reject-closure`, {
        reason: rejectClosureReason.trim(),
      });
      if (res.data.success !== false) {
        toast.success(res.data.message || 'Closure request rejected.');
        setShowRejectClosureModal(false);
        setRejectClosureReason('');
        await fetchTicketDetails(true);
        await fetchClosePermission();
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to reject closure');
    } finally {
      setClosureActionLoading(false);
    }
  };

  const handleRequestInfo = async () => {
    if (!requestInfoNote.trim()) { toast.warning('Please specify what details or files you need'); return; }
    try {
      setRequestInfoLoading(true);
      const res = await api.post(`/tickets/${id}/request-info`, { request_note: requestInfoNote.trim() });
      if (res.data.success) {
        toast.success(res.data.message || 'Need More Details flag raised!');
        setShowRequestInfoModal(false);
        setRequestInfoNote('');
        fetchTicketDetails(true);
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to raise flag');
    } finally { setRequestInfoLoading(false); }
  };

  const handleProvideInfo = async () => {
    try {
      setProvideInfoLoading(true);
      const res = await api.post(`/tickets/${id}/provide-info`, {
        provider_note: provideInfoNote.trim() || undefined,
        description: provideInfoDescription.trim() || undefined,
      });
      if (res.data.success) {
        toast.success(res.data.message || 'Details submitted!');
        setShowProvideInfoModal(false);
        setProvideInfoNote('');
        setProvideInfoDescription('');
        fetchTicketDetails(true);
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to submit details');
    } finally { setProvideInfoLoading(false); }
  };

  const handleReopenTicket = async () => {
    if (!reopenReason.trim()) { toast.warning('Please enter a reason for reopening'); return; }
    try {
      setReopenLoading(true);
      const res = await api.patch(`/tickets/${id}/reopen`, { reopen_reason: reopenReason.trim() });
      if (res.data.success) {
        toast.success('Ticket reopened successfully!');
        setShowReopenModal(false);
        setReopenReason('');
        fetchTicketDetails(true);
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to reopen ticket');
    } finally { setReopenLoading(false); }
  };

  // ---- Approval Handlers ----
  const handleRaiseApproval = async () => {
    if (!approvalApproverId) { toast.warning('Please select an approver'); return; }
    if (!approvalNote.trim()) { toast.warning('Please provide a reason for the approval request'); return; }
    try {
      setApprovalLoading(true);
      const res = await api.post(`/ticket-approvals/${id}/request`, {
        approver_id: parseInt(approvalApproverId),
        approval_note: approvalNote.trim(),
      });
      if (res.data.success) {
        toast.success(res.data.message || 'Approval request sent!');
        setShowApprovalRequestModal(false);
        setApprovalNote('');
        setApprovalApproverId('');
        fetchTicketDetails(true);
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to raise approval request');
    } finally { setApprovalLoading(false); }
  };

  const handleDecideApproval = async () => {
    if (!approvalDecisionNote.trim()) { toast.warning('Please provide a decision note'); return; }
    const approvalId = ticket?.active_approval?.approval_id;
    if (!approvalId) { toast.error('No active approval found'); return; }
    try {
      setApprovalDecideLoading(true);
      const res = await api.post(`/ticket-approvals/${approvalId}/decide`, {
        decision: approvalDecision,
        decision_note: approvalDecisionNote.trim(),
      });
      if (res.data.success) {
        toast.success(res.data.message || `Approval ${approvalDecision.toLowerCase()}!`);
        setShowApprovalDecideModal(false);
        setApprovalDecisionNote('');
        fetchTicketDetails(true);
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to submit decision');
    } finally { setApprovalDecideLoading(false); }
  };

  const handleCancelApproval = async () => {
    const approvalId = ticket?.active_approval?.approval_id;
    if (!approvalId) return;
    try {
      const res = await api.post(`/ticket-approvals/${approvalId}/cancel`);
      if (res.data.success) {
        toast.success('Approval request cancelled');
        fetchTicketDetails(true);
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to cancel approval');
    }
  };

  // ---- Fetch Rating ----
  const fetchRating = useCallback(async () => {
    try {
      const res = await api.get(`/ratings/${id}`);
      if (res.data.success && res.data.data) {
        setRatingData(res.data.data);
      }
    } catch { /* no rating yet */ }
  }, [id]);

  useEffect(() => {
    if (ticket?.is_final_status) fetchRating();
  }, [ticket?.is_final_status, fetchRating]);

  const handleSubmitRating = async (ratingPayload) => {
    try {
      setRatingLoading(true);
      const res = await api.post(`/ratings/${id}`, ratingPayload);
      if (res.data.success) {
        toast.success('Thank you for your rating!');
        setShowRatingModal(false);
        await fetchRating();
        fetchTicketDetails(true);
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to submit rating');
    } finally { setRatingLoading(false); }
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
      toast.success(`Downloading ${fileName}...`);
    } catch {
      toast.error('Failed to download. Please try again.');
    }
  };

  // ---- SLA Calculation (uses server-side sla_status for business-hours-aware accuracy) ----
  const calculateSla = useCallback(() => {
    if (!ticket?.due_date || !ticket?.created_at) {
      return { status: 'none', pct: 0, color: '#94a3b8', label: 'No SLA', closed: false };
    }

    // Use server-computed sla_status (business-hours-aware) if available
    const serverStatus = ticket.sla_status; // 'none' | 'met' | 'breached' | 'warning' | 'ok'
    const now = new Date();
    const created = new Date(ticket.created_at);
    const due = new Date(ticket.due_date);
    const resolved = ticket.resolved_at ? new Date(ticket.resolved_at) : null;
    const isClosed = ticket.is_final_status || ticket.status_code === 'RESOLVED' || ticket.status_code === 'CLOSED';

    // Compute visual progress percentage (wall-clock approximation for progress bar)
    const total = due - created;
    const elapsed = (isClosed && resolved ? resolved : now) - created;
    const pct = total > 0 ? Math.min((elapsed / total) * 100, 100) : 0;

    // Map status to display properties
    const statusMap = {
      met: { color: '#10b981', label: 'SLA Met', closed: true },
      breached: { color: '#ef4444', label: isClosed ? 'SLA Breached' : 'Breached', closed: isClosed },
      warning: { color: '#f59e0b', label: 'At Risk', closed: false },
      ok: { color: '#10b981', label: 'On Track', closed: false },
      none: { color: '#94a3b8', label: 'No SLA', closed: false },
      paused: { color: '#8b5cf6', label: 'SLA Paused', closed: false },
    };

    const status = serverStatus && statusMap[serverStatus] ? serverStatus : 'none';
    const info = statusMap[status];

    return {
      status,
      pct: status === 'met' || (status === 'breached' && isClosed) ? 100 : pct,
      color: info.color,
      label: info.label,
      closed: info.closed,
      resolvedAt: resolved,
      dueDate: due,
    };
  }, [ticket]);

  const formatTimeRemaining = useCallback(() => {
    if (!ticket?.due_date) return 'No SLA set';
    const now = new Date();
    const due = new Date(ticket.due_date);
    const resolved = ticket.resolved_at ? new Date(ticket.resolved_at) : null;
    const isClosed = ticket.is_final_status || ticket.status_code === 'RESOLVED' || ticket.status_code === 'CLOSED';

    if (isClosed) {
      const end = resolved || now;
      const met = end <= due;
      const diff = Math.abs(met ? due - end : end - due);
      const h = Math.floor(diff / 3600000);
      const d = Math.floor(h / 24);
      const timeStr = d > 0 ? `${d}d ${h % 24}h` : h > 0 ? `${h}h` : 'on time';
      return met ? `Resolved ${timeStr} before deadline` : `Resolved ${timeStr} after deadline`;
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

  // ---- Ticket Age ----
  const getTicketAge = useCallback(() => {
    if (!ticket?.created_at) return 'N/A';
    const end = ticket.resolved_at ? new Date(ticket.resolved_at) : new Date();
    const start = new Date(ticket.created_at);
    const diff = end - start;
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    if (d > 0) return `${d}d ${h}h`;
    return `${h}h`;
  }, [ticket]);

  // ---- Status / Priority Helpers ----
  const getStatusClass = (code) => {
    const map = { OPEN: 'open', IN_PROGRESS: 'progress', PENDING: 'pending', ON_HOLD: 'hold', RESOLVED: 'closed', CLOSED: 'closed', CANCELLED: 'cancelled', REOPENED: 'reopened' };
    return map[code] || 'default';
  };
  const getPriorityClass = (code) => {
    const map = { CRITICAL: 'critical', HIGH: 'high', MEDIUM: 'medium', LOW: 'low', PLANNING: 'planning' };
    return map[code] || 'default';
  };
  const getStatusIcon = (code) => {
    const map = { OPEN: AlertCircle, IN_PROGRESS: Clock, PENDING: Clock, ON_HOLD: Clock, RESOLVED: CheckCircle, CLOSED: CheckCircle, CANCELLED: X, REOPENED: RefreshCw };
    const Icon = map[code] || AlertCircle;
    return <Icon size={16} />;
  };

  // ---- Permissions ----
  const isAdminOrManager = () => {
    if (!user) return false;
    const rc = user.role?.role_code;
    return rc === 'ADMIN' || rc === 'MANAGER' || rc === 'CENTRAL_MGMT';
  };
  /** Mid-ticket approval: designated approver or ADMIN / SUB_ADMIN may decide / cancel (others) */
  const isPlatformAdmin = () => ['ADMIN', 'SUB_ADMIN'].includes(user?.role?.role_code);

  const isPendingClosureStatus = () =>
    ticket &&
    (ticket.status_name === 'Pending Closure' || ticket.status_code === 'PENDING_CLOSURE');

  const canCloseTicketBase = () => {
    if (!user || !ticket || ticket.is_final_status) return false;
    return ticket.assigned_to_id === user.user_id || isAdminOrManager();
  };
  const canCloseTicket = () => canCloseTicketBase();

  /** Direct Close (PATCH) — hidden when engineer must request manager closure first */
  const showDirectCloseButton = () => {
    if (!canCloseTicketBase() || !closePerm) return false;
    if (closePerm.pending_closure) return false;
    if (closePerm.requiresApproval && !isAdminOrManager()) return false;
    return true;
  };

  const showRequestClosureApprovalButton = () => {
    if (!canCloseTicketBase() || !closePerm) return false;
    if (closePerm.pending_closure) return false;
    if (!closePerm.requiresApproval) return false;
    if (isAdminOrManager()) return false;
    return closePerm.allowed !== false;
  };

  const showClosureReviewActions = () => {
    if (!ticket || ticket.is_final_status) return false;
    if (!isPendingClosureStatus()) return false;
    if (!isAdminOrManager()) return false;
    return true;
  };
  const canEdit = () => {
    if (!user || !ticket) return false;
    // For closed/resolved tickets, only creator or admin/manager can edit
    if (ticket.is_final_status) {
      return ticket.requester_id === user.user_id || isAdminOrManager();
    }
    return isAdminOrManager() || ticket.requester_id === user.user_id || ticket.assigned_to_id === user.user_id;
  };
  const canDelete = () => user?.permissions?.can_delete_tickets;
  // Admin/Manager can always assign; assigned engineer can reassign only
  const canAssign = () => {
    if (!user || !ticket) return false;
    if (isAdminOrManager()) return true;
    // Assigned engineer can reassign (ticket must be assigned to them and not closed)
    if (ticket.assigned_to_id === user.user_id && !ticket.is_final_status) return true;
    return false;
  };
  const isReassignMode = () => {
    // True if user is the assigned engineer (not admin/manager) doing a reassign
    if (!user || !ticket) return false;
    return ticket.assigned_to_id === user.user_id && !isAdminOrManager();
  };
  // Only ticket creator or admin/manager can reopen closed/resolved tickets
  const canReopenTicket = () => {
    if (!user || !ticket || !ticket.is_final_status) return false;
    return ticket.requester_id === user.user_id || isAdminOrManager();
  };
  const canRateTicket = () => {
    if (!user || !ticket) return false;
    if (!ticket.is_final_status) return false;
    if (ticket.requester_id !== user.user_id) return false;
    if (ratingData) return false; // already rated
    return true;
  };
  // Only admin/manager, requester, or assigned engineer can comment
  const canComment = () => {
    if (!user || !ticket) return false;
    if (isAdminOrManager() || ticket.requester_id === user.user_id) return true;
    if (ticket.assigned_to_id && ticket.assigned_to_id === user.user_id) return true;
    return false;
  };
  // Engineer can raise "Need More Details" when assigned, ticket open, and not already paused
  const canRequestInfo = () => {
    if (!user || !ticket || ticket.is_final_status) return false;
    if (ticket.sla_paused || ticket.pending_info_request) return false;
    return ticket.assigned_to_id === user.user_id || isAdminOrManager();
  };
  // Requester can provide details when ticket has pending info request
  const canProvideInfo = () => {
    if (!user || !ticket || ticket.is_final_status) return false;
    if (!ticket.sla_paused || !ticket.pending_info_request) return false;
    return ticket.requester_id === user.user_id || isAdminOrManager();
  };
  // Engineer (assigned) or admin can raise an approval request
  const canRaiseApproval = () => {
    if (!user || !ticket || ticket.is_final_status) return false;
    if (ticket.approval_pending) return false; // already pending
    if (ticket.sla_paused) return false; // paused for other reason
    return ticket.assigned_to_id === user.user_id || isAdminOrManager();
  };
  // Designated approver or platform admin can decide on an active approval request
  const canDecideApproval = () => {
    if (!user || !ticket || !ticket.active_approval) return false;
    if (ticket.active_approval.status !== 'PENDING') return false;
    return ticket.active_approval.approver_id === user.user_id || isPlatformAdmin();
  };
  // Engineer who raised it OR platform admin can cancel
  const canCancelApproval = () => {
    if (!user || !ticket || !ticket.active_approval) return false;
    if (ticket.active_approval.status !== 'PENDING') return false;
    return ticket.active_approval.engineer_id === user.user_id || isPlatformAdmin();
  };
  // Only admin/manager, requester, or assigned engineer can download
  const canDownload = () => {
    if (!user || !ticket) return false;
    if (isAdminOrManager() || ticket.requester_id === user.user_id) return true;
    if (ticket.assigned_to_id && ticket.assigned_to_id === user.user_id) return true;
    return false;
  };

  // ============================================
  // BUILD JOURNEY EVENTS
  // ============================================
  const journeyEvents = useMemo(() => {
    if (!ticket) return [];
    const events = [];

    // Activity types that are already represented by separate data sources
    // (comments → ticket_comments, attachments → ticket_attachments)
    const SKIP_ACTIVITY_TYPES = ['COMMENT_ADDED', 'ATTACHMENT_ADDED', 'ATTACHMENT_DELETED'];

    // 1. Created event
    events.push({
      id: 'created', type: 'created',
      description: `Ticket #${ticket.ticket_number} was created`,
      detail: ticket.subject,
      user: ticket.created_by_name || ticket.requester_name || 'System',
      timestamp: ticket.created_at,
    });

    // 2. Activities — map to proper journey types, skip duplicates
    activities.forEach(a => {
      const atype = (a.activity_type || '').toUpperCase();

      // Skip activities that duplicate data from comments/attachments tables
      if (SKIP_ACTIVITY_TYPES.includes(atype)) return;

      // Skip generic "CREATED" from activities — we already have the created event above
      if (atype === 'CREATED') return;

      // Map activity_type → journey event type
      let type = 'update';
      if (atype === 'INFO_REQUESTED') {
        type = 'info-requested';
      } else if (atype === 'INFO_PROVIDED') {
        type = 'info-provided';
      } else if (atype === 'APPROVAL_REQUESTED') {
        type = 'approval-requested';
      } else if (atype === 'APPROVAL_APPROVED') {
        type = 'approval-approved';
      } else if (atype === 'APPROVAL_REJECTED') {
        type = 'approval-rejected';
      } else if (atype === 'APPROVAL_CANCELLED') {
        type = 'approval-cancelled';
      } else if (atype === 'REASSIGNED') {
        type = 'reassigned';
      } else if (atype === 'REOPENED') {
        type = 'reopened';
      } else if (atype === 'TEAM_ROUTED' || atype === 'ROUTED') {
        type = 'team-routed';
      } else if (atype === 'SELF_ASSIGNED') {
        type = 'self-assigned';
      } else if (atype === 'ASSIGNED' || (a.field_name || '').toLowerCase().includes('assign')) {
        type = 'assigned';
      } else if (atype === 'STATUS_CHANGED' || (a.field_name || '').toLowerCase().includes('status')) {
        type = 'status';
      } else if (atype === 'PRIORITY_CHANGED' || (a.field_name || '').toLowerCase().includes('priority')) {
        type = 'priority';
      } else if (atype.includes('ESCALAT') || (a.field_name || '').toLowerCase().includes('escalat')) {
        type = 'escalated';
      } else if (atype === 'RATED') {
        type = 'rated';
      }

      events.push({
        id: `act-${a.activity_id}`, type,
        description: a.description,
        user: a.performed_by_name || 'System',
        timestamp: a.performed_at,
        oldValue: a.old_value, newValue: a.new_value, fieldName: a.field_name,
      });
    });

    // 3. Comments — from ticket_comments table (source of truth)
    comments.forEach(c => {
      events.push({
        id: `cmt-${c.comment_id}`,
        type: c.is_internal ? 'internal-note' : 'comment',
        description: c.comment_text,
        user: c.commenter_name || 'Unknown',
        userRole: c.commenter_role,
        timestamp: c.commented_at,
        isInternal: c.is_internal,
      });
    });

    // 4. Attachments — from ticket_attachments table (source of truth)
    // Group attachments uploaded within 5s of ticket creation into the "created" event
    const createdTime = new Date(ticket.created_at).getTime();
    attachments.forEach(att => {
      const attTime = new Date(att.uploaded_at).getTime();
      const isCreationAttachment = Math.abs(attTime - createdTime) < 5000; // within 5 seconds

      if (isCreationAttachment) {
        // Merge into the created event detail
        const createdEvent = events.find(e => e.id === 'created');
        if (createdEvent) {
          createdEvent.detail = (createdEvent.detail || '') + ` • 📎 ${att.file_name}`;
        }
      } else {
        events.push({
          id: `att-${att.attachment_id}`, type: 'attachment',
          description: att.file_name,
          detail: formatFileSize(att.file_size_kb),
          user: att.uploaded_by_name || 'Unknown',
          timestamp: att.uploaded_at,
          attachment: att,
        });
      }
    });

    // 5. Milestone: First Response — skipped from journey
    // (The first comment by the engineer already shows in the timeline.
    //  SLA info is visible in the ticket details section.)

    // 6. Milestone: Escalation (only if not already in activities)
    if (ticket.is_escalated && ticket.escalated_at) {
      const exists = activities.some(a => (a.activity_type || '').toUpperCase().includes('ESCALAT'));
      if (!exists) {
        events.push({
          id: 'escalated', type: 'escalated',
          description: ticket.escalation_reason || `Escalated to ${ticket.escalated_to_name || 'manager'}`,
          user: 'System', timestamp: ticket.escalated_at,
        });
      }
    }

    // 7. Milestone: Resolved (only if not already tracked via STATUS_CHANGED activity)
    if (ticket.resolved_at) {
      const exists = activities.some(a =>
        ((a.new_value || '').toLowerCase().includes('resolved') && (a.field_name || '').toLowerCase().includes('status')) ||
        ((a.activity_type || '').toUpperCase() === 'STATUS_CHANGED' && (a.new_value || '').toLowerCase().includes('resolved'))
      );
      if (!exists) {
        events.push({
          id: 'resolved', type: 'resolved',
          description: ticket.resolution_notes || 'Ticket was resolved',
          user: ticket.assigned_to_name || 'Agent',
          timestamp: ticket.resolved_at,
        });
      }
    }

    // 8. Milestone: Closed (only if not already tracked via STATUS_CHANGED activity)
    if (ticket.closed_at && ticket.closed_at !== ticket.resolved_at) {
      const exists = activities.some(a =>
        ((a.new_value || '').toLowerCase().includes('closed') && (a.field_name || '').toLowerCase().includes('status')) ||
        ((a.activity_type || '').toUpperCase() === 'STATUS_CHANGED' && (a.new_value || '').toLowerCase().includes('closed'))
      );
      if (!exists) {
        events.push({
          id: 'closed', type: 'closed',
          description: 'Ticket was closed',
          user: 'System', timestamp: ticket.closed_at,
        });
      }
    }

    events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Filter out 'update' events that happen within 5s of a status/resolved/closed event
    // (These are noise from the same edit form submission)
    const finalEvents = events.filter((ev, idx) => {
      if (ev.type !== 'update') return true;
      const evTime = new Date(ev.timestamp).getTime();
      return !events.some(other =>
        other !== ev &&
        ['status', 'resolved', 'closed'].includes(other.type) &&
        Math.abs(new Date(other.timestamp).getTime() - evTime) < 5000
      );
    });

    return finalEvents;
  }, [ticket, comments, activities, attachments]);

  // ============================================
  // RENDER — Loading / Error
  // ============================================
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

  if (error || !ticket) {
    return (
      <div className="td-page">
        <div className="td-error">
          <AlertCircle size={56} />
          <h2>Ticket Not Found</h2>
          <p>{error || 'The ticket does not exist or you lack permission to view it.'}</p>
          <button className="td-btn td-btn-primary" onClick={() => navigate('/tickets')}>
            <ArrowLeft size={18} /> Back to Tickets
          </button>
        </div>
      </div>
    );
  }

  const sla = calculateSla();

  // ============================================
  // RENDER — Main Page
  // ============================================
  return (
    <div className="td-page">
      {/* ========== HEADER ========== */}
      <div className="td-header">
        <div className="td-header-left">
          <button className="td-btn-back" onClick={() => navigate('/tickets')}>
            <ArrowLeft size={18} />
            <span>Back</span>
          </button>
          <div className="td-ticket-badge">
            <Hash size={14} />
            <span>{ticket.ticket_number}</span>
          </div>
          <div className={`td-status-pill td-status-${getStatusClass(ticket.status_code)}`}>
            {getStatusIcon(ticket.status_code)}
            <span>{ticket.status_name}</span>
          </div>
          <div className={`td-priority-pill td-priority-${getPriorityClass(ticket.priority_code)}`}>
            {(ticket.priority_code === 'CRITICAL' || ticket.priority_code === 'HIGH') && <AlertTriangle size={14} />}
            <span>{ticket.priority_name}</span>
          </div>
          {(sla.status !== 'none' || ticket.sla_paused) && (
            <div className={`td-sla-pill td-sla-${sla.status}`}>
              {sla.status === 'ok' && <CheckCircle size={14} />}
              {sla.status === 'warning' && <AlertTriangle size={14} />}
              {sla.status === 'breached' && <XCircle size={14} />}
              {sla.status === 'met' && <CheckCircle size={14} />}
              {sla.status === 'paused' && <Flag size={14} />}
              <span>{sla.label}</span>
            </div>
          )}
          {ticket.is_escalated && (
            <div className="td-escalated-pill">
              <AlertTriangle size={14} />
              <span>Escalated</span>
            </div>
          )}
          {ticket.sla_paused && ticket.pending_info_request && (
            <div className="td-pending-info-pill">
              <Flag size={14} />
              <span>Needs More Details</span>
            </div>
          )}
          {ticket.approval_pending && (
            <div className="td-approval-pending-pill">
              <ClipboardList size={14} />
              <span>Approval Pending</span>
            </div>
          )}
        </div>
        <div className="td-header-right">
          <div className="td-refresh-info">
            <span className="td-refresh-time">Updated {formatRelativeTime(lastRefresh)}</span>
            <button
              className={`td-btn-icon ${refreshing ? 'spinning' : ''}`}
              onClick={() => fetchTicketDetails(true)}
              title="Refresh"
            >
              <RefreshCw size={16} />
            </button>
          </div>
          {canEdit() && (
            <button className="td-btn td-btn-secondary" onClick={() => navigate(`/tickets/edit/${id}`)}>
              <Edit size={16} /> <span>Edit</span>
            </button>
          )}
          {canRequestInfo() && (
            <button className="td-btn td-btn-request-info" onClick={() => setShowRequestInfoModal(true)}>
              <Flag size={16} /> <span>Need More Details</span>
            </button>
          )}
          {canProvideInfo() && (
            <button className="td-btn td-btn-provide-info" onClick={() => setShowProvideInfoModal(true)}>
              <Paperclip size={16} /> <span>Provide Details</span>
            </button>
          )}
          {canRaiseApproval() && (
            <button className="td-btn td-btn-approval-request" onClick={() => setShowApprovalRequestModal(true)}>
              <ClipboardList size={16} /> <span>Request Approval</span>
            </button>
          )}
          {canDecideApproval() && (
            <button className="td-btn td-btn-approval-decide" onClick={() => { setApprovalDecision('APPROVED'); setShowApprovalDecideModal(true); }}>
              <BadgeCheck size={16} /> <span>Review Approval</span>
            </button>
          )}
          {showRequestClosureApprovalButton() && (
            <button
              className="td-btn td-btn-approval-request"
              onClick={() => setShowRequestClosureModal(true)}
              title="Requires manager approval before close (see Settings)"
            >
              <Send size={16} /> <span>Request closure approval</span>
            </button>
          )}
          {showClosureReviewActions() && (
            <>
              <button
                className="td-btn td-btn-approval-approve"
                disabled={closureActionLoading}
                onClick={() => handleApproveClosure()}
              >
                <BadgeCheck size={16} /> <span>Approve closure</span>
              </button>
              <button
                className="td-btn td-btn-approval-reject"
                disabled={closureActionLoading}
                onClick={() => setShowRejectClosureModal(true)}
              >
                <ThumbsDown size={16} /> <span>Reject closure</span>
              </button>
            </>
          )}
          {showDirectCloseButton() && (
            <button className="td-btn td-btn-close" onClick={() => setShowCloseModal(true)}>
              <XCircle size={16} /> <span>Close</span>
            </button>
          )}
          {canReopenTicket() && (
            <button className="td-btn td-btn-reopen" onClick={() => setShowReopenModal(true)}>
              <RotateCcw size={16} /> <span>Reopen</span>
            </button>
          )}
          {canDelete() && (
            <button className="td-btn td-btn-danger" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 size={16} /> <span>Delete</span>
            </button>
          )}
          {canRateTicket() && (
            <button className="td-btn td-btn-rate" onClick={() => setShowRatingModal(true)}>
              <Trophy size={16} /> <span>Rate</span>
            </button>
          )}
        </div>
      </div>

      {/* ========== TICKET JOURNEY (Full Width — Top) ========== */}
      <div className="td-journey-section td-journey-fullwidth">
        <div className="td-section-header">
          <div className="td-section-title">
            <Activity size={20} />
            <h2>Ticket Journey</h2>
          </div>
          <div className="td-journey-header-right">
            <span className="td-event-count">{journeyEvents.length} events</span>
          </div>
        </div>

        {/* Horizontal Timeline Track */}
        <div className="td-hj-wrapper">
          <div className="td-hj-track" ref={journeyScrollRef} style={{ '--td-hj-count': journeyEvents.length }}>
            {/* Connecting lines span from first node center to last node center */}
            {journeyEvents.length > 1 && (
              <>
                <div className="td-hj-line td-hj-line-bg" />
                <div className="td-hj-line td-hj-line-fill" />
              </>
            )}

            {journeyEvents.map((event, idx) => {
              const config = EVENT_CONFIG[event.type] || EVENT_CONFIG.update;
              const EventIcon = config.icon;
              const isFirst = idx === 0;
              const isLast = idx === journeyEvents.length - 1;
              const isActive = selectedEventId === event.id;
              const isMilestone = ['created', 'first-response', 'resolved', 'closed', 'escalated'].includes(event.type);
              const isClosed = ticket && ['CLOSED', 'RESOLVED', 'CANCELLED'].includes(ticket.status_code);

              return (
                <div
                  key={event.id}
                  className={`td-hj-node ${isFirst ? 'first' : ''} ${isLast ? 'last' : ''} ${isActive ? 'active' : ''} ${isMilestone ? 'milestone' : ''}`}
                  style={{ animationDelay: `${idx * 0.1}s` }}
                  onClick={() => setSelectedEventId(isActive ? null : event.id)}
                >
                  {/* START badge on first node */}
                  {isFirst && (
                    <div className="td-hj-badge td-hj-badge-start">
                      <Flag size={9} /> START
                    </div>
                  )}
                  {/* FINISH badge on last node — when ticket closed */}
                  {isLast && isClosed && (
                    <div className="td-hj-badge td-hj-badge-finish">
                      <Trophy size={9} /> FINISH
                    </div>
                  )}

                  <div
                    className={`td-hj-dot ${isFirst ? 'td-hj-dot-start' : ''} ${isLast && isClosed ? 'td-hj-dot-finish' : ''}`}
                    style={{
                      background: isLast && isClosed ? 'linear-gradient(135deg, #059669, #10b981)' : config.color,
                      boxShadow: isActive
                        ? `0 0 0 4px ${config.bg}, 0 0 16px ${config.color}55`
                        : isFirst
                          ? `0 0 0 4px ${config.bg}, 0 0 10px ${config.color}44`
                          : `0 0 0 3px ${config.bg}`
                    }}
                  >
                    <EventIcon size={isMilestone || isFirst ? 15 : 12} color="#fff" />
                  </div>
                  <div className="td-hj-label">
                    <span className="td-hj-type" style={{ color: config.color }}>{config.label}</span>
                    <span className="td-hj-actor">{getActorLabel(event)}</span>
                    <span className="td-hj-time">{formatRelativeTime(event.timestamp)}</span>
                  </div>
                  {isActive && <div className="td-hj-pointer" style={{ borderBottomColor: config.color }} />}
                </div>
              );
            })}
          </div>

          {journeyEvents.length === 0 && (
            <div className="td-empty-journey">
              <Activity size={40} />
              <p>No journey events yet</p>
            </div>
          )}
        </div>

        {/* Detail panel for selected event */}
        {selectedEventId && (() => {
          const event = journeyEvents.find(e => e.id === selectedEventId);
          if (!event) return null;
          const config = EVENT_CONFIG[event.type] || EVENT_CONFIG.update;
          const EventIcon = config.icon;
          return (
            <div className="td-hj-detail" style={{ borderTopColor: config.color }}>
              <div className="td-hj-detail-head">
                <div className="td-hj-detail-icon" style={{ background: config.color }}>
                  <EventIcon size={18} color="#fff" />
                </div>
                <div className="td-hj-detail-title">
                  <span className="td-hj-detail-type" style={{ color: config.color }}>{config.label}</span>
                  <span className="td-hj-detail-date">{formatDate(event.timestamp)}</span>
                </div>
                <button className="td-hj-detail-close" onClick={() => setSelectedEventId(null)}><X size={16} /></button>
              </div>

              <div className="td-hj-detail-body">
                {(event.type === 'status' || event.type === 'priority' || event.type === 'assigned') && event.oldValue && event.newValue && (
                  <div className="td-change-display">
                    <span className="td-change-field">{event.fieldName || event.type}:</span>
                    <span className="td-old-val">{event.oldValue}</span>
                    <ArrowRight size={14} className="td-change-arrow" />
                    <span className="td-new-val">{event.newValue}</span>
                  </div>
                )}
                {event.description && (
                  <p className={`td-event-desc ${event.type === 'comment' || event.type === 'internal-note' ? 'td-comment-text' : ''}`}>
                    {event.description}
                  </p>
                )}
                {event.detail && <span className="td-event-detail">{event.detail}</span>}
                {event.type === 'attachment' && event.attachment && canDownload() && (
                  <button className="td-att-download" onClick={() => handleDownloadAttachment(event.attachment.attachment_id, event.attachment.file_name)}>
                    <Download size={14} /> Download
                  </button>
                )}
              </div>

              <div className="td-hj-detail-foot">
                <div className="td-event-user">
                  <div className="td-user-avatar" style={{ background: config.color }}>
                    {(event.user || '?')[0].toUpperCase()}
                  </div>
                  <span>{event.user}</span>
                  {event.userRole && <span className="td-user-role">({event.userRole})</span>}
                </div>
                <span className="td-hj-relative">{formatRelativeTime(event.timestamp)}</span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ========== NEED MORE DETAILS BANNER (when engineer raised flag) ========== */}
      {ticket.sla_paused && ticket.pending_info_request && (
        <div className="td-pending-info-banner">
          <div className="td-pending-info-content">
            <Flag size={24} />
            <div>
              <strong>More Details Needed</strong>
              <p>{ticket.pending_info_request.request_note}</p>
              <span className="td-pending-info-meta">
                Requested by {ticket.pending_info_request.requested_by_name} • {formatRelativeTime(ticket.pending_info_request.requested_at)}
              </span>
            </div>
          </div>
          {canProvideInfo() && (
            <button className="td-btn td-btn-primary" onClick={() => setShowProvideInfoModal(true)}>
              <Paperclip size={16} /> Provide Details
            </button>
          )}
        </div>
      )}

      {/* ========== APPROVAL PENDING BANNER ========== */}
      {ticket.approval_pending && ticket.active_approval && (
        <div className="td-approval-banner">
          <div className="td-approval-banner-content">
            <ClipboardList size={24} />
            <div>
              <strong>Approval Pending</strong>
              <p>{ticket.active_approval.approval_note}</p>
              <span className="td-approval-banner-meta">
                Requested by {ticket.active_approval.engineer_name} → Approver: <strong>{ticket.active_approval.approver_name}</strong>
                {' • '}{formatRelativeTime(ticket.active_approval.requested_at)}
              </span>
            </div>
          </div>
          <div className="td-approval-banner-actions">
            {canDecideApproval() && (
              <>
                <button className="td-btn td-btn-approval-approve" onClick={() => { setApprovalDecision('APPROVED'); setShowApprovalDecideModal(true); }}>
                  <BadgeCheck size={16} /> Approve
                </button>
                <button className="td-btn td-btn-approval-reject" onClick={() => { setApprovalDecision('REJECTED'); setShowApprovalDecideModal(true); }}>
                  <ThumbsDown size={16} /> Reject
                </button>
              </>
            )}
            {canCancelApproval() && (
              <button className="td-btn td-btn-secondary" onClick={handleCancelApproval}>
                <X size={16} /> Cancel Request
              </button>
            )}
          </div>
        </div>
      )}

      {/* ========== APPROVAL REJECTED BANNER ========== */}
      {!ticket.approval_pending && ticket.active_approval?.status === 'REJECTED' && (
        <div className="td-approval-rejection-banner">
          <div className="td-approval-rejection-content">
            <ThumbsDown size={22} />
            <div>
              <strong>Approval Request Was Rejected</strong>
              {ticket.active_approval.decision_note && (
                <p>{ticket.active_approval.decision_note}</p>
              )}
              <span className="td-approval-rejection-meta">
                Rejected by <strong>{ticket.active_approval.approver_name}</strong>
                {ticket.active_approval.decided_at && (' • ' + formatRelativeTime(ticket.active_approval.decided_at))}
              </span>
            </div>
          </div>
          {canRaiseApproval() && (
            <button
              className="td-btn td-btn-approval-request"
              onClick={() => setShowApprovalRequestModal(true)}
            >
              <ClipboardList size={16} /> Raise New Approval
            </button>
          )}
        </div>
      )}

      {/* ========== OVERVIEW CARD ========== */}
      <div className="td-overview">
        <div className="td-overview-main">
          <h1 className="td-subject">{ticket.subject || ticket.title || 'No Subject'}</h1>
          <div className="td-description-wrap">
            <p className="td-description">
              {ticket.description
                ? (ticket.description.length > 250 && !descExpanded
                  ? ticket.description.substring(0, 250) + '...'
                  : ticket.description)
                : 'No description provided'}
            </p>
            {ticket.description?.length > 250 && (
              <button className="td-desc-toggle" onClick={() => setDescExpanded(!descExpanded)}>
                {descExpanded ? <><ChevronUp size={14} /> Show less</> : <><ChevronDown size={14} /> Show more</>}
              </button>
            )}
          </div>
        </div>
        <div className="td-meta-grid">
          <div className="td-meta-item">
            <Tag size={14} className="td-meta-icon" />
            <span className="td-meta-label">Category</span>
            <span className="td-meta-value">{ticket.category_name || 'N/A'}</span>
          </div>
          <div className="td-meta-item">
            <Building size={14} className="td-meta-icon" />
            <span className="td-meta-label">Department</span>
            <span className="td-meta-value">{ticket.department_name || 'N/A'}</span>
          </div>
          {ticket.sub_category_name && (
            <div className="td-meta-item">
              <Tag size={14} className="td-meta-icon" />
              <span className="td-meta-label">Sub-Category</span>
              <span className="td-meta-value">{ticket.sub_category_name}</span>
            </div>
          )}
          {ticket.other_category_text && (
            <div className="td-meta-item">
              <Tag size={14} className="td-meta-icon" />
              <span className="td-meta-label">Issue Specified</span>
              <span className="td-meta-value">{ticket.other_category_text}</span>
            </div>
          )}
          {ticket.location_name && (
            <div className="td-meta-item">
              <Building size={14} className="td-meta-icon" />
              <span className="td-meta-label">Location</span>
              <span className="td-meta-value">{ticket.location_name}</span>
            </div>
          )}
          {ticket.process_name && (
            <div className="td-meta-item">
              <Tag size={14} className="td-meta-icon" />
              <span className="td-meta-label">Process / Client</span>
              <span className="td-meta-value">{ticket.process_name}</span>
            </div>
          )}
          <div className="td-meta-item">
            <User size={14} className="td-meta-icon" />
            <span className="td-meta-label">Requester</span>
            <span className="td-meta-value">{ticket.requester_name || 'Unknown'}</span>
            {ticket.requester_email && <span className="td-meta-sub">{ticket.requester_email}</span>}
          </div>
          <div className="td-meta-item">
            <UserCheck size={14} className="td-meta-icon" />
            <span className="td-meta-label">Assigned To</span>
            <span className="td-meta-value">{ticket.assigned_to_name || 'Unassigned'}</span>
          </div>
          {ticket.team_name && (
            <div className="td-meta-item">
              <Users size={14} className="td-meta-icon" />
              <span className="td-meta-label">Team Bucket</span>
              <span className="td-meta-value">
                {ticket.team_name}
                {ticket.team_is_central ? ' ★' : ''}
              </span>
            </div>
          )}
          <div className="td-meta-item">
            <Calendar size={14} className="td-meta-icon" />
            <span className="td-meta-label">Created</span>
            <span className="td-meta-value">{formatDate(ticket.created_at)}</span>
          </div>
          <div className="td-meta-item">
            <Clock size={14} className="td-meta-icon" />
            <span className="td-meta-label">Due Date</span>
            <span className={`td-meta-value ${sla.status === 'breached' ? 'td-text-danger' : ''}`}>
              {ticket.due_date ? formatDate(ticket.due_date) : 'No SLA'}
            </span>
          </div>
          <div className="td-meta-item">
            <Zap size={14} className="td-meta-icon" />
            <span className="td-meta-label">First Response</span>
            <span className="td-meta-value">
              {ticket.first_response_at ? formatRelativeTime(ticket.first_response_at) : 'Pending'}
            </span>
          </div>
          <div className="td-meta-item">
            <Activity size={14} className="td-meta-icon" />
            <span className="td-meta-label">Ticket Age</span>
            <span className="td-meta-value">{getTicketAge()}</span>
          </div>
        </div>
        {ticket.resolution_notes && (
          <div className="td-resolution-box">
            <CheckCircle size={16} />
            <div>
              <strong>Resolution Notes</strong>
              <p>{ticket.resolution_notes}</p>
            </div>
          </div>
        )}
        {ticket.custom_fields && ticket.custom_fields.length > 0 && (
          <div className="td-custom-fields-box">
            <div className="td-custom-fields-title">
              <Tag size={14} />
              <strong>Additional Information</strong>
            </div>
            <div className="td-custom-fields-grid">
              {ticket.custom_fields.map(cf => (
                <div key={cf.value_id} className="td-custom-field-item">
                  <span className="td-cf-label">{cf.field_label}</span>
                  <span className="td-cf-value">{cf.field_value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {ticket.guidance && (
          <div className="td-custom-fields-box">
            <div className="td-custom-fields-title">
              <CheckCircle size={14} />
              <strong>Guided Intake</strong>
            </div>
            {ticket.guidance.selected_template?.resolved_text && (
              <div className="td-custom-field-item" style={{ marginBottom: '12px' }}>
                <span className="td-cf-label">Quick subject template</span>
                <span className="td-cf-value">{ticket.guidance.selected_template.resolved_text}</span>
              </div>
            )}
            {ticket.guidance.resolved_variables && Object.keys(ticket.guidance.resolved_variables).length > 0 && (
              <div className="td-custom-fields-grid" style={{ marginBottom: '12px' }}>
                {Object.entries(ticket.guidance.resolved_variables).map(([key, value]) => (
                  <div key={key} className="td-custom-field-item">
                    <span className="td-cf-label">{formatGuidanceVariableLabel(key)}</span>
                    <span className="td-cf-value">{value}</span>
                  </div>
                ))}
              </div>
            )}
            {ticket.guidance.checklist?.length > 0 && (
              <div>
                <div className="td-custom-fields-title" style={{ marginBottom: '8px' }}>
                  <strong>Submitted checklist</strong>
                </div>
                <div className="td-custom-fields-grid">
                  {ticket.guidance.checklist.map((item) => (
                    <div key={item.id} className="td-custom-field-item">
                      <span className="td-cf-label">{item.text}</span>
                      <span className="td-cf-value">{item.checked ? 'Yes' : 'No'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========== DETAILS GRID — SLA + Actions + Info ========== */}
      <div className="td-details-grid">
        {/* ---- Column 1: SLA + Ticket Details ---- */}
        <div className="td-details-col">
          {/* SLA Card */}
          {sla.status !== 'none' && (
            <div className="td-card td-sla-card">
              <div className="td-card-header">
                <TrendingUp size={18} />
                <h3>SLA Status</h3>
              </div>
              <div className="td-sla-content">
                <div className="td-sla-badge-row">
                  <div className={`td-sla-indicator td-sla-${sla.status}`} style={{ borderColor: sla.color }}>
                    {sla.status === 'met' || sla.status === 'ok' ? <CheckCircle size={20} /> : sla.status === 'warning' ? <AlertTriangle size={20} /> : <XCircle size={20} />}
                    <div>
                      <strong>{sla.label}</strong>
                      <span>{formatTimeRemaining()}</span>
                    </div>
                  </div>
                </div>
                {!sla.closed && (
                  <div className="td-sla-progress">
                    <div className="td-sla-bar-track">
                      <div className="td-sla-bar-fill" style={{ width: `${Math.min(sla.pct, 100)}%`, backgroundColor: sla.color }} />
                    </div>
                    <div className="td-sla-pct" style={{ color: sla.color }}>{Math.round(sla.pct)}% elapsed</div>
                  </div>
                )}
                <div className="td-sla-details">
                  <div className="td-sla-row">
                    <span>Created</span>
                    <span>{formatDate(ticket.created_at)}</span>
                  </div>
                  <div className="td-sla-row">
                    <span>Due By</span>
                    <span className={sla.status === 'breached' ? 'td-text-danger' : ''}>{formatDate(ticket.due_date)}</span>
                  </div>
                  {ticket.resolved_at && (
                    <div className="td-sla-row">
                      <span>Resolved</span>
                      <span>{formatDate(ticket.resolved_at)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Ticket Info Card */}
          <div className="td-card">
            <div className="td-card-header">
              <Shield size={18} />
              <h3>Ticket Details</h3>
            </div>
            <div className="td-info-list">
              <div className="td-info-row">
                <span className="td-info-label">Ticket ID</span>
                <span className="td-info-value">#{ticket.ticket_id}</span>
              </div>
              <div className="td-info-row">
                <span className="td-info-label">Created By</span>
                <span className="td-info-value">{ticket.created_by_name || ticket.requester_name || 'N/A'}</span>
              </div>
              {ticket.requester_email && (
                <div className="td-info-row">
                  <span className="td-info-label">Email</span>
                  <span className="td-info-value td-info-email">{ticket.requester_email}</span>
                </div>
              )}
              {ticket.requester_phone && (
                <div className="td-info-row">
                  <span className="td-info-label">Phone</span>
                  <span className="td-info-value">{ticket.requester_phone}</span>
                </div>
              )}
              {ticket.escalated_to_name && (
                <div className="td-info-row">
                  <span className="td-info-label">Escalated To</span>
                  <span className="td-info-value td-text-danger">{ticket.escalated_to_name}</span>
                </div>
              )}
              {ticket.escalation_reason && (
                <div className="td-info-row">
                  <span className="td-info-label">Escalation Reason</span>
                  <span className="td-info-value">{ticket.escalation_reason}</span>
                </div>
              )}
              <div className="td-info-row">
                <span className="td-info-label">Last Updated</span>
                <span className="td-info-value">{formatDate(ticket.updated_at)}</span>
              </div>

            </div>
          </div>

          {/* Rating Display Card (inside detail column) */}
          {ratingData && (
            <RatingDisplay rating={ratingData} />
          )}
        </div>

        {/* ---- Column 2: Assign + Comment ---- */}
        <div className="td-details-col">
          {/* Assignment Card */}
          {canAssign() && (
            <div className="td-card">
              <div className="td-card-header">
                <UserCheck size={18} />
                <h3>{isReassignMode() ? 'Reassign Engineer' : 'Assign Engineer'}</h3>
              </div>
              <div className="td-assign-form">
                <select
                  className="td-select"
                  value={selectedEngineer}
                  onChange={(e) => setSelectedEngineer(e.target.value)}
                >
                  <option value="">Select Engineer...</option>
                  {engineers
                    .filter(eng => !isReassignMode() || eng.user_id !== ticket.assigned_to_id)
                    .map(eng => (
                      <option key={eng.user_id} value={eng.user_id}>
                        {eng.full_name || eng.username}
                        {eng.user_id === ticket.assigned_to_id ? ' (Current)' : ''}
                      </option>
                    ))}
                </select>
                <button
                  className="td-btn td-btn-assign"
                  onClick={handleAssignEngineer}
                  disabled={assignLoading || !selectedEngineer}
                >
                  <UserCheck size={16} />
                  {assignLoading ? (isReassignMode() ? 'Reassigning...' : 'Assigning...') : (isReassignMode() ? 'Reassign' : 'Assign')}
                </button>
              </div>
            </div>
          )}

          {/* Add Comment Card */}
          {canComment() && <div className="td-card">
            <div className="td-card-header">
              <MessageSquare size={18} />
              <h3>Add Comment</h3>
            </div>
            <div className="td-comment-form">
              <textarea
                className="td-textarea"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                rows={4}
              />
              <div className="td-comment-actions">
                <label className="td-internal-toggle">
                  <input
                    type="checkbox"
                    checked={isInternalNote}
                    onChange={(e) => setIsInternalNote(e.target.checked)}
                  />
                  {isInternalNote ? <EyeOff size={14} /> : <Eye size={14} />}
                  <span>Internal Note</span>
                </label>
                <button
                  className="td-btn td-btn-primary"
                  onClick={handleAddComment}
                  disabled={commentLoading || !newComment.trim()}
                >
                  <Send size={14} />
                  {commentLoading ? 'Posting...' : 'Post'}
                </button>
              </div>
            </div>
          </div>}

          {/* AI Assist Panel — visible to internal IT staff / engineers only */}
          {ticket && user && ['ADMIN', 'MANAGER', 'CENTRAL_MGMT', 'IT_STAFF', 'ENGINEER', 'SUB_ADMIN'].includes(user.role?.role_code) && (
            <AIAssistPanel
              ticketId={ticket.ticket_id}
              onUseDraft={(draft) => setNewComment(draft)}
            />
          )}

          {/* Attachments Card */}
          <div className="td-card">
            <div className="td-card-header">
              <Paperclip size={18} />
              <h3>Attachments</h3>
              <span className="td-count-badge">{attachments.length}</span>
            </div>
            {attachments.length === 0 ? (
              <div className="td-empty-small">
                <Paperclip size={28} />
                <p>No attachments</p>
              </div>
            ) : (
              <div className="td-att-list">
                {attachments.map(att => {
                  const FileIcon = getFileIcon(att.file_name);
                  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(
                    (att.file_name || '').split('.').pop().toLowerCase()
                  );
                  return (
                    <div key={att.attachment_id} className="td-att-item">
                      {/* Clickable thumbnail/icon area */}
                      <div
                        className={`td-att-icon td-att-icon-clickable ${isImage ? 'td-att-icon-img' : ''}`}
                        onClick={() => setPreviewAtt({ ...att, ticket_id: id })}
                        title="Click to preview"
                      >
                        <FileIcon size={18} />
                        <div className="td-att-hover-overlay">
                          <Eye size={14} />
                        </div>
                      </div>
                      <div className="td-att-info">
                        <span
                          className="td-att-name td-att-name-clickable"
                          onClick={() => setPreviewAtt({ ...att, ticket_id: id })}
                          title={att.file_name}
                        >
                          {att.file_name}
                        </span>
                        <span className="td-att-meta">
                          {formatFileSize(att.file_size_kb)} • {att.uploaded_by_name || 'Unknown'}
                        </span>
                      </div>
                      <div className="td-att-actions">
                        <button
                          className="td-btn-icon td-att-preview-btn"
                          onClick={() => setPreviewAtt({ ...att, ticket_id: id })}
                          title="Preview"
                        >
                          <Eye size={15} />
                        </button>
                        {canDownload() && <button
                          className="td-btn-icon"
                          onClick={() => handleDownloadAttachment(att.attachment_id, att.file_name)}
                          title="Download"
                        >
                          <Download size={16} />
                        </button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========== ATTACHMENT PREVIEW MODAL ========== */}
      {previewAtt && (
        <AttachmentPreviewModal
          file={previewAtt}
          onClose={() => setPreviewAtt(null)}
          onDownload={canDownload() ? handleDownloadAttachment : undefined}
        />
      )}

      {/* ========== CLOSE MODAL ========== */}
      {showCloseModal && (
        <div className="td-modal-overlay" onClick={() => { if (!closeLoading) { setShowCloseModal(false); setCloseNote(''); } }}>
          <div className="td-modal td-modal-close" onClick={(e) => e.stopPropagation()}>
            <div className="td-modal-icon td-modal-icon-close">
              <XCircle size={32} />
            </div>
            <h3>Close Ticket?</h3>
            <p>You are about to close ticket <strong>#{ticket.ticket_number}</strong>. Please provide close notes.</p>
            <textarea
              className="td-modal-textarea"
              value={closeNote}
              onChange={(e) => setCloseNote(e.target.value)}
              placeholder="Enter close notes (reason for closing, resolution summary)..."
              rows={4}
              disabled={closeLoading}
            />
            <div className="td-modal-actions">
              <button className="td-btn td-btn-secondary" onClick={() => { setShowCloseModal(false); setCloseNote(''); }} disabled={closeLoading}>
                Cancel
              </button>
              <button className="td-btn td-btn-close" onClick={handleCloseTicket} disabled={closeLoading || !closeNote.trim()}>
                <XCircle size={16} /> {closeLoading ? 'Closing...' : 'Close Ticket'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== REQUEST CLOSURE APPROVAL (manager must approve before close) ========== */}
      {showRequestClosureModal && (
        <div
          className="td-modal-overlay"
          onClick={() => {
            if (!closureActionLoading) setShowRequestClosureModal(false);
          }}
        >
          <div className="td-modal td-modal-approval-request" onClick={(e) => e.stopPropagation()}>
            <div className="td-modal-icon td-modal-icon-approval">
              <Send size={32} />
            </div>
            <h3>Request closure approval?</h3>
            <p>
              Your organization requires a <strong>manager or admin</strong> to approve before this ticket can be
              closed. Managers will be notified to approve or reject.
            </p>
            <div className="td-modal-actions">
              <button
                className="td-btn td-btn-secondary"
                onClick={() => setShowRequestClosureModal(false)}
                disabled={closureActionLoading}
              >
                Cancel
              </button>
              <button
                className="td-btn td-btn-approval-request"
                onClick={handleRequestClosureApproval}
                disabled={closureActionLoading}
              >
                {closureActionLoading ? 'Submitting...' : 'Submit request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== REJECT CLOSURE MODAL ========== */}
      {showRejectClosureModal && (
        <div
          className="td-modal-overlay"
          onClick={() => {
            if (!closureActionLoading) {
              setShowRejectClosureModal(false);
              setRejectClosureReason('');
            }
          }}
        >
          <div className="td-modal td-modal-approval-decide" onClick={(e) => e.stopPropagation()}>
            <div className="td-modal-icon td-modal-icon-reject">
              <ThumbsDown size={32} />
            </div>
            <h3>Reject closure request</h3>
            <p>
              Ticket <strong>#{ticket.ticket_number}</strong> will return to <strong>In Progress</strong> so the
              assignee can continue work.
            </p>
            <textarea
              className="td-modal-textarea"
              value={rejectClosureReason}
              onChange={(e) => setRejectClosureReason(e.target.value)}
              placeholder="Reason for rejecting closure (required)..."
              rows={4}
              disabled={closureActionLoading}
            />
            <div className="td-modal-actions">
              <button
                className="td-btn td-btn-secondary"
                onClick={() => {
                  setShowRejectClosureModal(false);
                  setRejectClosureReason('');
                }}
                disabled={closureActionLoading}
              >
                Cancel
              </button>
              <button
                className="td-btn td-btn-approval-reject"
                onClick={handleRejectClosure}
                disabled={closureActionLoading || !rejectClosureReason.trim()}
              >
                Reject closure
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== DELETE MODAL ========== */}
      {showDeleteConfirm && (
        <div className="td-modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="td-modal" onClick={(e) => e.stopPropagation()}>
            <div className="td-modal-icon">
              <AlertTriangle size={32} />
            </div>
            <h3>Delete Ticket?</h3>
            <p>This will permanently delete ticket <strong>#{ticket.ticket_number}</strong>. This action cannot be undone.</p>
            <div className="td-modal-actions">
              <button className="td-btn td-btn-secondary" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </button>
              <button className="td-btn td-btn-danger" onClick={() => { handleDeleteTicket(); setShowDeleteConfirm(false); }}>
                <Trash2 size={16} /> Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== RATING MODAL ========== */}
      {showRatingModal && (
        <RatingModal
          ticket={ticket}
          onSubmit={handleSubmitRating}
          onClose={() => setShowRatingModal(false)}
          loading={ratingLoading}
        />
      )}

      {/* ========== REOPEN MODAL ========== */}
      {showReopenModal && (
        <div className="td-modal-overlay" onClick={() => { if (!reopenLoading) { setShowReopenModal(false); setReopenReason(''); } }}>
          <div className="td-modal td-modal-reopen" onClick={(e) => e.stopPropagation()}>
            <div className="td-modal-icon td-modal-icon-reopen">
              <RotateCcw size={32} />
            </div>
            <h3>Reopen Ticket?</h3>
            <p>You are about to reopen ticket <strong>#{ticket.ticket_number}</strong>. Please provide a reason for reopening.</p>
            <textarea
              className="td-modal-textarea"
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              placeholder="Enter reason for reopening this ticket..."
              rows={4}
              disabled={reopenLoading}
            />
            <div className="td-modal-actions">
              <button className="td-btn td-btn-secondary" onClick={() => { setShowReopenModal(false); setReopenReason(''); }} disabled={reopenLoading}>
                Cancel
              </button>
              <button className="td-btn td-btn-reopen" onClick={handleReopenTicket} disabled={reopenLoading || !reopenReason.trim()}>
                <RotateCcw size={16} /> {reopenLoading ? 'Reopening...' : 'Reopen Ticket'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== REQUEST INFO (Need More Details) MODAL ========== */}
      {showRequestInfoModal && (
        <div className="td-modal-overlay" onClick={() => { if (!requestInfoLoading) { setShowRequestInfoModal(false); setRequestInfoNote(''); } }}>
          <div className="td-modal td-modal-request-info" onClick={(e) => e.stopPropagation()}>
            <div className="td-modal-icon td-modal-icon-request-info">
              <Flag size={32} />
            </div>
            <h3>Request More Details</h3>
            <p>Specify what additional information or files you need from the ticket creator. SLA will be paused until they respond.</p>
            <textarea
              className="td-modal-textarea"
              value={requestInfoNote}
              onChange={(e) => setRequestInfoNote(e.target.value)}
              placeholder="e.g. Please provide the error log file, or specify the exact steps to reproduce the issue..."
              rows={5}
              disabled={requestInfoLoading}
            />
            <div className="td-modal-actions">
              <button className="td-btn td-btn-secondary" onClick={() => { setShowRequestInfoModal(false); setRequestInfoNote(''); }} disabled={requestInfoLoading}>
                Cancel
              </button>
              <button className="td-btn td-btn-request-info" onClick={handleRequestInfo} disabled={requestInfoLoading || !requestInfoNote.trim()}>
                <Flag size={16} /> {requestInfoLoading ? 'Submitting...' : 'Raise Flag'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== PROVIDE INFO MODAL ========== */}
      {showProvideInfoModal && (
        <div className="td-modal-overlay" onClick={() => { if (!provideInfoLoading) { setShowProvideInfoModal(false); setProvideInfoNote(''); setProvideInfoDescription(''); } }}>
          <div className="td-modal td-modal-provide-info" onClick={(e) => e.stopPropagation()}>
            <div className="td-modal-icon td-modal-icon-provide-info">
              <Paperclip size={32} />
            </div>
            <h3>Provide Requested Details</h3>
            {ticket.pending_info_request && (
              <div className="td-provide-info-requested">
                <strong>Engineer requested:</strong>
                <p>{ticket.pending_info_request.request_note}</p>
              </div>
            )}
            <p>You can add a message, update the description, and/or upload attachments below. After saving, the engineer will be notified.</p>
            <label>Your message (optional)</label>
            <textarea
              className="td-modal-textarea"
              value={provideInfoNote}
              onChange={(e) => setProvideInfoNote(e.target.value)}
              placeholder="Add any message or details for the engineer..."
              rows={3}
              disabled={provideInfoLoading}
            />
            <label>Update description (optional)</label>
            <textarea
              className="td-modal-textarea"
              value={provideInfoDescription}
              onChange={(e) => setProvideInfoDescription(e.target.value)}
              placeholder="Or paste additional details here. Leave empty to keep current description."
              rows={3}
              disabled={provideInfoLoading}
            />
            <p className="td-provide-info-hint">You can also add attachments via the Attachments section before or after submitting.</p>
            <div className="td-modal-actions">
              <button className="td-btn td-btn-secondary" onClick={() => { setShowProvideInfoModal(false); setProvideInfoNote(''); setProvideInfoDescription(''); }} disabled={provideInfoLoading}>
                Cancel
              </button>
              <button className="td-btn td-btn-provide-info" onClick={handleProvideInfo} disabled={provideInfoLoading}>
                <Paperclip size={16} /> {provideInfoLoading ? 'Submitting...' : 'Submit Details'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ========== REQUEST APPROVAL MODAL ========== */}
      {showApprovalRequestModal && (
        <div className="td-modal-overlay" onClick={() => { if (!approvalLoading) { setShowApprovalRequestModal(false); setApprovalNote(''); setApprovalApproverId(''); } }}>
          <div className="td-modal td-modal-approval-request" onClick={(e) => e.stopPropagation()}>
            <div className="td-modal-icon td-modal-icon-approval">
              <ClipboardList size={32} />
            </div>
            <h3>Request Approval</h3>
            <p>Select your <strong>team manager</strong> (or an approver chosen by an administrator) and describe what needs to be approved.<br />SLA will be paused until a decision is made.</p>
            {approvers.length === 0 && (
              <p className="td-modal-hint" style={{ color: '#b45309', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                No approver is available for this ticket. Ensure the ticket is routed to a team with a <strong>team manager</strong> set in Teams, or ask an administrator to raise the approval.
              </p>
            )}

            <div className="td-modal-form-group">
              <label>Select Approver <span style={{color:'#dc2626'}}>*</span></label>
              <select
                className="td-modal-select"
                value={approvalApproverId}
                onChange={(e) => setApprovalApproverId(e.target.value)}
                disabled={approvalLoading}
              >
                <option value="">— Choose approver —</option>
                {approvers.map(a => (
                  <option key={a.user_id} value={a.user_id}>
                    {a.full_name}
                    {a.team_name ? ` — ${a.team_name}` : ''}
                    {a.role_name ? ` (${a.role_name})` : ''}
                    {a.department_name ? ` — ${a.department_name}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="td-modal-form-group">
              <label>Reason / What needs approval <span style={{color:'#dc2626'}}>*</span></label>
              <textarea
                className="td-modal-textarea"
                value={approvalNote}
                onChange={(e) => setApprovalNote(e.target.value)}
                placeholder="e.g. This ticket requires manager approval to proceed with the hardware replacement worth ₹15,000..."
                rows={5}
                disabled={approvalLoading}
              />
            </div>

            <div className="td-modal-actions">
              <button className="td-btn td-btn-secondary" onClick={() => { setShowApprovalRequestModal(false); setApprovalNote(''); setApprovalApproverId(''); }} disabled={approvalLoading}>
                Cancel
              </button>
              <button className="td-btn td-btn-approval-request" onClick={handleRaiseApproval} disabled={approvalLoading || !approvalApproverId || !approvalNote.trim()}>
                <ClipboardList size={16} /> {approvalLoading ? 'Sending...' : 'Send for Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== DECIDE APPROVAL MODAL (Approve / Reject) ========== */}
      {showApprovalDecideModal && (
        <div className="td-modal-overlay" onClick={() => { if (!approvalDecideLoading) { setShowApprovalDecideModal(false); setApprovalDecisionNote(''); } }}>
          <div className="td-modal td-modal-approval-decide" onClick={(e) => e.stopPropagation()}>
            <div className={`td-modal-icon ${approvalDecision === 'APPROVED' ? 'td-modal-icon-approve' : 'td-modal-icon-reject'}`}>
              {approvalDecision === 'APPROVED' ? <BadgeCheck size={32} /> : <ThumbsDown size={32} />}
            </div>
            <h3>{approvalDecision === 'APPROVED' ? 'Approve Request' : 'Reject Request'}</h3>
            {ticket?.active_approval && (
              <div className="td-approval-decide-context">
                <strong>Request from {ticket.active_approval.engineer_name}:</strong>
                <p>{ticket.active_approval.approval_note}</p>
              </div>
            )}
            <div className="td-approval-decide-toggle">
              <button
                className={`td-decide-btn ${approvalDecision === 'APPROVED' ? 'active-approve' : ''}`}
                onClick={() => setApprovalDecision('APPROVED')}
                disabled={approvalDecideLoading}
              >
                <BadgeCheck size={16} /> Approve
              </button>
              <button
                className={`td-decide-btn ${approvalDecision === 'REJECTED' ? 'active-reject' : ''}`}
                onClick={() => setApprovalDecision('REJECTED')}
                disabled={approvalDecideLoading}
              >
                <ThumbsDown size={16} /> Reject
              </button>
            </div>
            <div className="td-modal-form-group">
              <label>Decision Note <span style={{color:'#dc2626'}}>*</span></label>
              <textarea
                className="td-modal-textarea"
                value={approvalDecisionNote}
                onChange={(e) => setApprovalDecisionNote(e.target.value)}
                placeholder={approvalDecision === 'APPROVED'
                  ? 'e.g. Approved. Please proceed with the replacement.'
                  : 'e.g. Rejected. Please explore a lower-cost alternative first.'}
                rows={4}
                disabled={approvalDecideLoading}
              />
            </div>
            <div className="td-modal-actions">
              <button className="td-btn td-btn-secondary" onClick={() => { setShowApprovalDecideModal(false); setApprovalDecisionNote(''); }} disabled={approvalDecideLoading}>
                Cancel
              </button>
              <button
                className={`td-btn ${approvalDecision === 'APPROVED' ? 'td-btn-approval-approve' : 'td-btn-approval-reject'}`}
                onClick={handleDecideApproval}
                disabled={approvalDecideLoading || !approvalDecisionNote.trim()}
              >
                {approvalDecision === 'APPROVED' ? <BadgeCheck size={16} /> : <ThumbsDown size={16} />}
                {approvalDecideLoading ? 'Processing...' : (approvalDecision === 'APPROVED' ? 'Confirm Approval' : 'Confirm Rejection')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketDetail;

/**
 * ============================================
 * CR DETAIL PAGE — Change Request Detail View
 * ============================================
 * Full detail view with workflow actions, activity
 * timeline, approval chain, checklist, comments,
 * affected systems, and implementation steps.
 * ============================================
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  ArrowLeft, Edit, Send, User, Clock, AlertCircle, CheckCircle,
  AlertTriangle, Calendar, MessageSquare, FileText, X, RefreshCw,
  UserCheck, Shield, ChevronDown, ChevronUp, Eye, Loader,
  Play, Pause, RotateCcw, XCircle, Check, Server, ListChecks,
  Info, ArrowRight, Flag, PlusCircle, Zap, Archive, Trophy,
  Repeat2, GitMerge, BadgeCheck, ThumbsDown, ClipboardList, Activity, Paperclip, Trash2
} from 'lucide-react';
import crService from '../../services/crService';
import { formatDateTimeDisplay, timeAgo as formatRelativeTime } from '../../utils/dateUtils';
import '../../styles/CRDetail.css';

// ============================================
// Status & Risk Style Maps
// ============================================
const STATUS_STYLES = {
  DRAFT: { bg: '#f1f5f9', text: '#64748b', icon: FileText },
  SUBMITTED: { bg: '#dbeafe', text: '#2563eb', icon: Send },
  UNDER_REVIEW: { bg: '#fef3c7', text: '#d97706', icon: Eye },
  PENDING_APPROVAL: { bg: '#fef9c3', text: '#ca8a04', icon: Clock },
  PENDING_INFO: { bg: '#ffe4e6', text: '#e11d48', icon: Info },
  APPROVED: { bg: '#d1fae5', text: '#059669', icon: CheckCircle },
  REJECTED: { bg: '#fecdd3', text: '#dc2626', icon: XCircle },
  SCHEDULED: { bg: '#e0e7ff', text: '#4f46e5', icon: Calendar },
  IN_PROGRESS: { bg: '#ddd6fe', text: '#7c3aed', icon: Play },
  IMPLEMENTED: { bg: '#ccfbf1', text: '#0d9488', icon: Check },
  CLOSED: { bg: '#e2e8f0', text: '#475569', icon: CheckCircle },
  CANCELLED: { bg: '#f3f4f6', text: '#9ca3af', icon: X },
  ROLLED_BACK: { bg: '#fef2f2', text: '#b91c1c', icon: RotateCcw },
};

const RISK_STYLES = {
  LOW: { bg: '#d1fae5', text: '#059669' },
  MEDIUM: { bg: '#fef3c7', text: '#d97706' },
  HIGH: { bg: '#fee2e2', text: '#dc2626' },
  CRITICAL: { bg: '#fecdd3', text: '#991b1b' },
};

const getStatusStyle = (code) => STATUS_STYLES[code] || STATUS_STYLES.DRAFT;
const getRiskStyle = (level) => RISK_STYLES[level] || RISK_STYLES.MEDIUM;
const formatDate = (d) => d ? formatDateTimeDisplay(d) : '—';

const toDatetimeLocal = (dateStr) => {
  if (!dateStr) return '';
  try { return new Date(dateStr).toISOString().slice(0, 16); } catch { return ''; }
};

// ============================================
// Journey Event Type Configuration (mirrors ticket)
// ============================================
const CR_EVENT_CONFIG = {
  CREATED:          { icon: PlusCircle,    color: '#3b82f6', bg: '#eff6ff',  label: 'Created' },
  SUBMITTED:        { icon: Send,          color: '#2563eb', bg: '#dbeafe',  label: 'Submitted' },
  ASSIGNED:         { icon: UserCheck,     color: '#8b5cf6', bg: '#f5f3ff',  label: 'Assigned' },
  REASSIGNED:       { icon: Repeat2,       color: '#d946ef', bg: '#fdf4ff',  label: 'Reassigned' },
  STATUS_CHANGE:    { icon: RefreshCw,     color: '#f59e0b', bg: '#fffbeb',  label: 'Status Changed' },
  APPROVAL_SENT:    { icon: ClipboardList, color: '#f59e0b', bg: '#fffbeb',  label: 'Approval Requested' },
  APPROVED:         { icon: BadgeCheck,    color: '#059669', bg: '#ecfdf5',  label: 'Approved' },
  REJECTED:         { icon: ThumbsDown,    color: '#dc2626', bg: '#fef2f2',  label: 'Rejected' },
  SCHEDULED:        { icon: Calendar,      color: '#4f46e5', bg: '#e0e7ff',  label: 'Scheduled' },
  IN_PROGRESS:      { icon: Play,          color: '#7c3aed', bg: '#ddd6fe',  label: 'In Progress' },
  IMPLEMENTED:      { icon: Check,         color: '#0d9488', bg: '#ccfbf1',  label: 'Implemented' },
  CLOSED:           { icon: Archive,       color: '#6b7280', bg: '#f9fafb',  label: 'Closed' },
  CANCELLED:        { icon: X,             color: '#9ca3af', bg: '#f3f4f6',  label: 'Cancelled' },
  ROLLED_BACK:      { icon: RotateCcw,     color: '#b91c1c', bg: '#fef2f2',  label: 'Rolled Back' },
  COMMENT:          { icon: MessageSquare, color: '#10b981', bg: '#f0fdf4',  label: 'Comment' },
  INFO_REQUESTED:   { icon: Flag,          color: '#8b5cf6', bg: '#f5f3ff',  label: 'Info Requested' },
  INFO_PROVIDED:    { icon: CheckCircle,   color: '#059669', bg: '#ecfdf5',  label: 'Info Provided' },
  TEAM_ROUTED:      { icon: GitMerge,      color: '#0ea5e9', bg: '#f0f9ff',  label: 'Routed to Team' },
  REVIEW:           { icon: Eye,           color: '#d97706', bg: '#fef3c7',  label: 'Under Review' },
};
const getCREventConfig = (type) => CR_EVENT_CONFIG[type] || CR_EVENT_CONFIG.STATUS_CHANGE;

// Smart actor label — mirrors ticket's getActorLabel
const getCRActorLabel = (step) => {
  if (!step) return '';
  switch (step.step_type) {
    case 'CREATED':
      return step.performed_by_name ? `by ${step.performed_by_name}` : '';
    case 'SUBMITTED':
      return step.performed_by_name ? `by ${step.performed_by_name}` : '';
    case 'TEAM_ROUTED': {
      // summary is "Routed to {Team Name}"
      const match = (step.summary || '').match(/Routed to (.+)/i);
      const teamName = match ? match[1] : '';
      return teamName ? `→ ${teamName}` : (step.performed_by_name ? `by ${step.performed_by_name}` : '');
    }
    case 'ASSIGNED': {
      const isAuto = (step.summary || '').toLowerCase().includes('auto') ||
                     (step.details || '').toLowerCase().includes('auto');
      if (step.to_user_name) return isAuto ? `Auto → ${step.to_user_name}` : `→ ${step.to_user_name}`;
      return step.performed_by_name ? `by ${step.performed_by_name}` : '';
    }
    case 'REASSIGNED':
      return step.to_user_name ? `→ ${step.to_user_name}` : (step.performed_by_name ? `by ${step.performed_by_name}` : '');
    case 'STATUS_CHANGE':
      return step.to_status ? `→ ${step.to_status}` : (step.performed_by_name ? `by ${step.performed_by_name}` : '');
    case 'REVIEW':
      return step.performed_by_name ? `by ${step.performed_by_name}` : '';
    case 'APPROVED':
    case 'REJECTED':
    case 'CLOSED':
    case 'CANCELLED':
    case 'IMPLEMENTED':
    case 'ROLLED_BACK':
    case 'SCHEDULED':
    case 'IN_PROGRESS':
      return step.performed_by_name ? `by ${step.performed_by_name}` : '';
    default:
      return step.performed_by_name ? `by ${step.performed_by_name}` : '';
  }
};

// ============================================
// Main Component
// ============================================
const CRDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  // Core state
  const [cr, setCR] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Comment
  const [newComment, setNewComment] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [isInternalNote, setIsInternalNote] = useState(false);

  // Action modals
  const [activeModal, setActiveModal] = useState(null); // 'cancel'|'reject'|'schedule'|'complete'|'rollback'|'requestInfo'|'provideInfo'|'close'|'approve'
  const [modalNote, setModalNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Journey
  const [selectedJourneyId, setSelectedJourneyId] = useState(null);
  const journeyScrollRef = useRef(null);

  // Schedule fields 
  const [scheduleStart, setScheduleStart] = useState('');
  const [scheduleEnd, setScheduleEnd] = useState('');
  const [maintenanceWindow, setMaintenanceWindow] = useState(false);

  // Completion fields
  const [completionNotes, setCompletionNotes] = useState('');
  const [postImplNotes, setPostImplNotes] = useState('');
  const [pirOutcome, setPirOutcome] = useState('Successful');

  // Close fields
  const [closePirNotes, setClosePirNotes] = useState('');
  const [closePirOutcome, setClosePirOutcome] = useState('Successful');

  // Direct start field
  const [plannedEndDate, setPlannedEndDate] = useState('');

  // Raise issue
  const [raiseIssueDesc, setRaiseIssueDesc] = useState('');

  // Expanded sections
  const [expandedSections, setExpandedSections] = useState({
    details: true, implementation: false, systems: false,
    approvals: true, checklist: false, timeline: true, comments: true,
    journey: true,
  });

  const toggleSection = (key) => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

  // ---- Fetch CR ----
  const fetchCR = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      setError('');
      const res = await crService.getById(id);
      if (res.data?.success) {
        setCR(res.data.data);
      } else {
        setError('Change request not found');
      }
    } catch (e) {
      if (!silent) setError(e.response?.data?.message || 'Failed to load change request');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { if (id) fetchCR(); }, [id, fetchCR]);

  // ---- Permissions ----
  const isOwner = cr?.requester_id === user?.user_id;
  const isAssignee = cr?.assigned_to === user?.user_id;
  const isAdmin = user?.permissions?.can_manage_cr_settings;
  const canApprove = user?.permissions?.can_approve_cr;
  const canImplement = user?.permissions?.can_implement_cr;
  const statusCode = cr?.status_code;

  // ---- Workflow Actions ----
  const handleAction = async (action, data = {}) => {
    setActionLoading(true);
    try {
      let res;
      switch (action) {
        case 'submit': res = await crService.submit(id); break;
        case 'startReview': res = await crService.startReview(id); break;
        case 'requestInfo': res = await crService.requestInfo(id, data); break;
        case 'provideInfo': res = await crService.provideInfo(id, data); break;
        case 'approve': res = await crService.approve(id, data); break;
        case 'reject': res = await crService.reject(id, data); break;
        case 'schedule': res = await crService.schedule(id, data); break;
        case 'reschedule': res = await crService.reschedule(id, data); break;
        case 'sendToApproval': res = await crService.sendToApproval(id); break;
        case 'start': res = await crService.start(id); break;
      case 'startDirect': res = await crService.start(id, { planned_end_date: plannedEndDate || undefined }); break;
      case 'raiseIssue': res = await crService.raiseIssue(id, { issue_description: raiseIssueDesc }); break;
        case 'complete': res = await crService.complete(id, data); break;
        case 'rollback': res = await crService.rollback(id, data); break;
        case 'cancel': res = await crService.cancel(id, data); break;
        case 'resubmit': res = await crService.resubmit(id); break;
        case 'close': res = await crService.close(id, data); break;
        default: return;
      }
      if (res.data?.success) {
        toast.success(res.data.message || 'Action completed');
        setActiveModal(null);
        setModalNote('');
        fetchCR(true);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to ${action}`);
    } finally {
      setActionLoading(false);
    }
  };

  // ---- Add Comment ----
  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setCommentLoading(true);
    try {
      const res = await crService.addComment(id, {
        comment_text: newComment,
        is_internal: isInternalNote,
      });
      if (res.data?.success) {
        toast.success('Comment added');
        setNewComment('');
        setIsInternalNote(false);
        fetchCR(true);
      }
    } catch (err) {
      toast.error('Failed to add comment');
    } finally {
      setCommentLoading(false);
    }
  };

  // ---- Delete CR (admin only) ----
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      const res = await crService.delete(id);
      if (res.data?.success) {
        toast.success('Change request deleted');
        navigate(-1);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete change request');
    } finally {
      setDeleteLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  // ---- Modal Actions ----
  const handleModalSubmit = () => {
    switch (activeModal) {
      case 'cancel': return handleAction('cancel', { reason: modalNote });
      case 'reject': return handleAction('reject', { reason: modalNote });
      case 'approve': return handleAction('approve', { comments: modalNote });
      case 'requestInfo': return handleAction('requestInfo', { comment_text: modalNote });
      case 'provideInfo': return handleAction('provideInfo', { comment_text: modalNote });
      case 'rollback': return handleAction('rollback', { reason: modalNote });
      case 'close': return handleAction('close', { pir_notes: closePirNotes, pir_outcome: closePirOutcome });
      case 'schedule': return handleAction('schedule', {
        scheduled_start: scheduleStart,
        scheduled_end: scheduleEnd,
        maintenance_window: maintenanceWindow,
      });
      case 'startDirect': return handleAction('startDirect');
      case 'raiseIssue': return handleAction('raiseIssue');
      case 'notBelongsToMe': return handleAction('notBelongsToMe');
      case 'reschedule': return handleAction('reschedule', {
        scheduled_start: scheduleStart,
        scheduled_end: scheduleEnd,
        maintenance_window: maintenanceWindow,
        reschedule_reason: modalNote,
      });
      case 'complete': return handleAction('complete', {
        implementation_notes: completionNotes,
        pir_notes: postImplNotes,
        pir_outcome: pirOutcome,
      });
      default: return;
    }
  };

  // ---- Build activity timeline ----
  const timelineEvents = useMemo(() => {
    if (!cr) return [];
    return (cr.activities || []).map(a => ({
      id: a.activity_id,
      type: a.activity_type,
      description: a.description,
      user: a.performer_name,
      date: a.performed_at,
      oldValue: a.old_value,
      newValue: a.new_value,
    })).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [cr]);

  // ---- Loading / Error States ----
  if (loading) {
    return (
      <div className="crd-page">
        <div className="crd-loading"><Loader size={24} className="spinner" /> Loading change request...</div>
      </div>
    );
  }

  if (error || !cr) {
    return (
      <div className="crd-page">
        <div className="crd-error">
          <AlertCircle size={48} />
          <h3>{error || 'Change request not found'}</h3>
          <button className="crd-btn crd-btn-secondary" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} /> Go Back
          </button>
        </div>
      </div>
    );
  }

  const statusStyle = getStatusStyle(statusCode);
  const riskStyle = getRiskStyle(cr.risk_level);
  const StatusIcon = statusStyle.icon;

  return (
    <div className="crd-page">
      {/* ======== HEADER ======== */}
      <div className="crd-header">
        <div className="crd-header-left">
          <button className="crd-btn-back" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} /> Back
          </button>
          <span className="crd-cr-badge">
            <Shield size={14} /> {cr.cr_number}
          </span>
          <span className="crd-status-pill" style={{ background: statusStyle.bg, color: statusStyle.text }}>
            <StatusIcon size={12} /> {cr.status_name}
          </span>
          {cr.risk_level && (
            <span className="crd-risk-pill" style={{ background: riskStyle.bg, color: riskStyle.text }}>
              {cr.risk_level} RISK
            </span>
          )}
        </div>
        <div className="crd-header-right">
          <button className="crd-btn crd-btn-icon" onClick={() => fetchCR(true)} title="Refresh" disabled={refreshing}>
            <RefreshCw size={16} className={refreshing ? 'spinner' : ''} />
          </button>
          {/* Workflow action buttons based on status */}
          {statusCode === 'DRAFT' && isOwner && (
            <>
              <button className="crd-btn crd-btn-primary" onClick={() => handleAction('submit')}>
                <Send size={14} /> Submit
              </button>
              <button className="crd-btn crd-btn-secondary" onClick={() => navigate(`/cr/${id}/edit`)}>
                <Edit size={14} /> Edit
              </button>
            </>
          )}
          {statusCode === 'SUBMITTED' && (canApprove || isAdmin || canImplement || isAssignee) && (
            <button className="crd-btn crd-btn-primary" onClick={() => handleAction('startReview')}>
              <Eye size={14} /> Start Review
            </button>
          )}
          {statusCode === 'UNDER_REVIEW' && (canApprove || isAdmin) && (
            <>
              <button className="crd-btn crd-btn-success" onClick={() => { setActiveModal('approve'); setModalNote(''); }}>
                <CheckCircle size={14} /> Approve
              </button>
              <button className="crd-btn crd-btn-danger" onClick={() => { setActiveModal('reject'); setModalNote(''); }}>
                <XCircle size={14} /> Reject
              </button>
              <button className="crd-btn crd-btn-warning" onClick={() => { setActiveModal('requestInfo'); setModalNote(''); }}>
                <Info size={14} /> Request Info
              </button>
            </>
          )}
          {statusCode === 'UNDER_REVIEW' && (isAssignee || canImplement) && !canApprove && !isAdmin && (
            <button className="crd-btn crd-btn-primary" onClick={() => handleAction('sendToApproval')} disabled={actionLoading}>
              {actionLoading ? <Loader size={14} className="spinner" /> : <ArrowRight size={14} />} Send to Approval
            </button>
          )}
          {statusCode === 'PENDING_INFO' && isOwner && (
            <button className="crd-btn crd-btn-primary" onClick={() => { setActiveModal('provideInfo'); setModalNote(''); }}>
              <ArrowRight size={14} /> Provide Info
            </button>
          )}
          {statusCode === 'PENDING_APPROVAL' && canApprove && (
            <>
              <button className="crd-btn crd-btn-success" onClick={() => { setActiveModal('approve'); setModalNote(''); }}>
                <CheckCircle size={14} /> Approve
              </button>
              <button className="crd-btn crd-btn-danger" onClick={() => { setActiveModal('reject'); setModalNote(''); }}>
                <XCircle size={14} /> Reject
              </button>
              <button className="crd-btn crd-btn-warning" onClick={() => { setActiveModal('requestInfo'); setModalNote(''); }}>
                <Info size={14} /> Need Info
              </button>
              <button className="crd-btn crd-btn-secondary" onClick={() => { setActiveModal('notBelongsToMe'); setModalNote(''); }}>
                <ThumbsDown size={14} /> Not Mine
              </button>
            </>
          )}
          {statusCode === 'APPROVED' && (canImplement || isAdmin || isAssignee) && (
            <>
              <button className="crd-btn crd-btn-primary" onClick={() => { setActiveModal('startDirect'); setPlannedEndDate(''); }}>
                <Play size={14} /> Start Implementation
              </button>
              <button className="crd-btn crd-btn-secondary" onClick={() => { setActiveModal('schedule'); setScheduleStart(''); setScheduleEnd(''); setMaintenanceWindow(false); }}>
                <Calendar size={14} /> Schedule for Later
              </button>
            </>
          )}
          {statusCode === 'REJECTED' && isOwner && (
            <button className="crd-btn crd-btn-primary" onClick={() => handleAction('resubmit')}>
              <RotateCcw size={14} /> Resubmit
            </button>
          )}
          {statusCode === 'SCHEDULED' && (canImplement || isAssignee || isAdmin) && (
            <button className="crd-btn crd-btn-primary" onClick={() => handleAction('start')}>
              <Play size={14} /> Start Implementation
            </button>
          )}
          {statusCode === 'SCHEDULED' && (canImplement || isAssignee || isAdmin) && (
            <button className="crd-btn crd-btn-secondary" onClick={() => {
              setActiveModal('reschedule');
              setScheduleStart(toDatetimeLocal(cr.scheduled_start));
              setScheduleEnd(toDatetimeLocal(cr.scheduled_end));
              setMaintenanceWindow(cr.maintenance_window || false);
              setModalNote('');
            }}>
              <Calendar size={14} /> Reschedule
            </button>
          )}
          {statusCode === 'IN_PROGRESS' && (canImplement || isAssignee || isAdmin) && (
            <>
              <button className="crd-btn crd-btn-success" onClick={() => { setActiveModal('complete'); setCompletionNotes(''); setPostImplNotes(''); setPirOutcome('Successful'); }}>
                <Check size={14} /> Complete
              </button>
              <button className="crd-btn crd-btn-danger" onClick={() => { setActiveModal('rollback'); setModalNote(''); }}>
                <RotateCcw size={14} /> Rollback
              </button>
            </>
          )}
          {statusCode === 'IMPLEMENTED' && (isAdmin || canApprove || isAssignee) && (
            <button className="crd-btn crd-btn-primary" onClick={() => { setActiveModal('close'); setClosePirNotes(''); setClosePirOutcome('Successful'); }}>
              <CheckCircle size={14} /> Close
            </button>
          )}
          {statusCode === 'IMPLEMENTED' && (() => {
            const completedAt = cr?.completed_at || cr?.actual_end;
            const withinWindow = completedAt && ((Date.now() - new Date(completedAt).getTime()) < 24 * 60 * 60 * 1000);
            return withinWindow ? (
              <button className="crd-btn crd-btn-danger" onClick={() => { setActiveModal('raiseIssue'); setRaiseIssueDesc(''); }}>
                <AlertTriangle size={14} /> Raise Issue
              </button>
            ) : null;
          })()}
          {/* Cancel — available in many states */}
          {['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'SCHEDULED', 'IN_PROGRESS'].includes(statusCode) && (isOwner || isAdmin) && (
            <button className="crd-btn crd-btn-outline-danger" onClick={() => { setActiveModal('cancel'); setModalNote(''); }}>
              <X size={14} /> Cancel
            </button>
          )}
          {/* Delete — admin only */}
          {isAdmin && (
            <button className="crd-btn crd-btn-danger" onClick={() => setShowDeleteConfirm(true)} title="Delete CR (admin only)">
              <Trash2 size={14} /> Delete
            </button>
          )}
        </div>
      </div>

      {/* ======== BANNERS ======== */}
      {statusCode === 'PENDING_INFO' && (
        <div className="crd-banner crd-banner-warning">
          <AlertTriangle size={16} />
          <span>Additional information has been requested. {isOwner ? 'Please provide the requested details.' : 'Waiting for requester response.'}</span>
        </div>
      )}
      {statusCode === 'PENDING_APPROVAL' && (
        <div className="crd-banner crd-banner-info">
          <Clock size={16} />
          <span>This change request is awaiting approval.</span>
        </div>
      )}
      {statusCode === 'REJECTED' && (
        <div className="crd-banner crd-banner-danger">
          <XCircle size={16} />
          <span>This change request has been rejected. {isOwner ? 'You may resubmit after making corrections.' : ''}</span>
        </div>
      )}

      {/* ======== CR JOURNEY (Full Width) ======== */}
      <div className="crd-journey-section">
        <div className="crd-journey-section-header">
          <div className="crd-journey-section-title">
            <Activity size={20} />
            <h2>CR Journey</h2>
          </div>
          <span className="crd-journey-event-count">{(cr.journey || []).length} events</span>
        </div>

        <div className="crd-hj-wrapper">
          <div className="crd-hj-track" ref={journeyScrollRef} style={{ '--crd-hj-count': Math.max((cr.journey || []).length, 1) }}>
            {(cr.journey || []).length > 1 && (
              <>
                <div className="crd-hj-line crd-hj-line-bg" />
                <div className="crd-hj-line crd-hj-line-fill" />
              </>
            )}

            {(cr.journey || []).map((step, idx) => {
              const config = getCREventConfig(step.step_type);
              const EventIcon = config.icon;
              const isFirst = idx === 0;
              const isLast = idx === (cr.journey || []).length - 1;
              const isActive = selectedJourneyId === (step.journey_id || idx);
              const isMilestone = ['CREATED', 'APPROVED', 'REJECTED', 'IMPLEMENTED', 'CLOSED', 'ROLLED_BACK'].includes(step.step_type);
              const isClosed = cr && ['CLOSED', 'CANCELLED', 'IMPLEMENTED'].includes(cr.status_code);
              const actorLabel = getCRActorLabel(step);

              return (
                <div
                  key={step.journey_id || idx}
                  className={`crd-hj-node ${isFirst ? 'first' : ''} ${isLast ? 'last' : ''} ${isActive ? 'active' : ''} ${isMilestone ? 'milestone' : ''}`}
                  style={{ animationDelay: `${idx * 0.1}s` }}
                  onClick={() => setSelectedJourneyId(isActive ? null : (step.journey_id || idx))}
                >
                  {isFirst && (
                    <div className="crd-hj-badge crd-hj-badge-start">
                      <Flag size={9} /> START
                    </div>
                  )}
                  {isLast && isClosed && (
                    <div className="crd-hj-badge crd-hj-badge-finish">
                      <Trophy size={9} /> FINISH
                    </div>
                  )}
                  <div
                    className={`crd-hj-dot ${isFirst ? 'crd-hj-dot-start' : ''} ${isLast && isClosed ? 'crd-hj-dot-finish' : ''}`}
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
                  <div className="crd-hj-label">
                    <span className="crd-hj-type" style={{ color: config.color }}>{config.label}</span>
                    {actorLabel && <span className="crd-hj-actor">{actorLabel}</span>}
                    <span className="crd-hj-time">{formatRelativeTime(step.performed_at)}</span>
                  </div>
                  {isActive && <div className="crd-hj-pointer" style={{ borderBottomColor: config.color }} />}
                </div>
              );
            })}
          </div>

          {(!cr.journey || cr.journey.length === 0) && (
            <div className="crd-empty-journey">
              <Activity size={40} />
              <p>No journey events yet</p>
            </div>
          )}
        </div>

        {selectedJourneyId != null && (() => {
          const step = (cr.journey || []).find(s => (s.journey_id || 0) === selectedJourneyId) ||
                       (cr.journey || [])[selectedJourneyId];
          if (!step) return null;
          const config = getCREventConfig(step.step_type);
          const EventIcon = config.icon;
          return (
            <div className="crd-hj-detail" style={{ borderTopColor: config.color }}>
              <div className="crd-hj-detail-head">
                <div className="crd-hj-detail-icon" style={{ background: config.color }}>
                  <EventIcon size={18} color="#fff" />
                </div>
                <div className="crd-hj-detail-title">
                  <span className="crd-hj-detail-type" style={{ color: config.color }}>{config.label}</span>
                  <span className="crd-hj-detail-date">{formatDate(step.performed_at)}</span>
                </div>
                <button className="crd-hj-detail-close" onClick={() => setSelectedJourneyId(null)}>
                  <X size={14} />
                </button>
              </div>
              <div className="crd-hj-detail-body">
                {step.summary && <p className="crd-hj-detail-desc">{step.summary}</p>}
                {step.from_status && step.to_status && (
                  <div className="crd-hj-change-display">
                    <span className="crd-hj-change-field">Status</span>
                    <span className="crd-hj-old-val">{step.from_status}</span>
                    <ArrowRight size={12} className="crd-hj-change-arrow" />
                    <span className="crd-hj-new-val">{step.to_status}</span>
                  </div>
                )}
                {step.to_user_name && (
                  <div className="crd-hj-change-display">
                    <span className="crd-hj-change-field">Assigned to</span>
                    <span className="crd-hj-new-val">{step.to_user_name}</span>
                  </div>
                )}
                {step.details && <p className="crd-hj-detail-desc" style={{ marginTop: 8 }}>{step.details}</p>}
              </div>
              <div className="crd-hj-detail-foot">
                <div className="crd-hj-detail-user">
                  {step.performed_by_name && (
                    <>
                      <div className="crd-hj-detail-avatar" style={{ background: config.color }}>
                        {step.performed_by_name[0].toUpperCase()}
                      </div>
                      <span>{step.performed_by_name}</span>
                    </>
                  )}
                </div>
                <span className="crd-hj-relative">{formatRelativeTime(step.performed_at)}</span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ======== MAIN GRID ======== */}
      <div className="crd-grid">
        {/* ---- LEFT COLUMN ---- */}
        <div className="crd-main">

          {/* Title & Description */}
          <div className="crd-card">
            <h2 className="crd-title">{cr.title}</h2>
            <div className="crd-meta-row">
              <span className="crd-meta-item"><User size={13} /> {cr.requester_name}</span>
              <span className="crd-meta-item"><Calendar size={13} /> {formatDate(cr.created_at)}</span>
              {cr.type_name && <span className="crd-meta-item"><Shield size={13} /> {cr.type_name}</span>}
              {cr.category_name && <span className="crd-meta-item"><Flag size={13} /> {cr.category_name}</span>}
            </div>

            <div className="crd-section-toggle" onClick={() => toggleSection('details')}>
              <h3>Change Details</h3>
              {expandedSections.details ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
            {expandedSections.details && (
              <div className="crd-details-grid">
                {cr.description && (
                  <div className="crd-detail-block">
                    <label>Description</label>
                    <p>{cr.description}</p>
                  </div>
                )}
                {cr.reason && (
                  <div className="crd-detail-block">
                    <label>Reason / Business Justification</label>
                    <p>{cr.reason}</p>
                  </div>
                )}
                {cr.expected_benefits && (
                  <div className="crd-detail-block">
                    <label>Expected Benefits</label>
                    <p>{cr.expected_benefits}</p>
                  </div>
                )}
                {cr.impact_description && (
                  <div className="crd-detail-block">
                    <label>Impact Description</label>
                    <p>{cr.impact_description}</p>
                  </div>
                )}
                {cr.risk_assessment_notes && (
                  <div className="crd-detail-block">
                    <label>Risk Assessment</label>
                    <p>{cr.risk_assessment_notes}</p>
                  </div>
                )}

                <div className="crd-info-grid">
                  {cr.priority_name && <div className="crd-info-item"><span>Priority</span><strong>{cr.priority_name}</strong></div>}
                  {cr.department_name && <div className="crd-info-item"><span>Department</span><strong>{cr.department_name}</strong></div>}
                  {cr.location_name && <div className="crd-info-item"><span>Location</span><strong>{cr.location_name}</strong></div>}
                  {cr.process_name && <div className="crd-info-item"><span>Process</span><strong>{cr.process_name}</strong></div>}
                  {cr.sub_category_name && <div className="crd-info-item"><span>Sub-Category</span><strong>{cr.sub_category_name}</strong></div>}
                  {cr.requested_for_name && <div className="crd-info-item"><span>Requested For</span><strong>{cr.requested_for_name}</strong></div>}
                  {cr.assigned_to_name && <div className="crd-info-item"><span>Assigned To</span><strong>{cr.assigned_to_name}</strong></div>}
                  <div className="crd-info-item"><span>Estimated Downtime</span><strong>{cr.estimated_downtime_mins ? `${cr.estimated_downtime_mins} min` : '—'}</strong></div>
                  <div className="crd-info-item"><span>Users Affected</span><strong>{cr.users_affected_count || '—'}</strong></div>
                  {cr.related_ticket_number && (
                    <div className="crd-info-item crd-link-item" onClick={() => navigate(`/tickets/${cr.related_ticket_id}`)}>
                      <span>Related Ticket</span><strong>{cr.related_ticket_number}</strong>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Implementation Plan */}
          <div className="crd-card">
            <div className="crd-section-toggle" onClick={() => toggleSection('implementation')}>
              <h3><ListChecks size={16} /> Implementation Plan</h3>
              {expandedSections.implementation ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
            {expandedSections.implementation && (
              <div className="crd-details-grid">
                {cr.implementation_plan && <div className="crd-detail-block"><label>Implementation Steps</label><pre className="crd-pre">{cr.implementation_plan}</pre></div>}
                {cr.test_plan && <div className="crd-detail-block"><label>Test Plan</label><pre className="crd-pre">{cr.test_plan}</pre></div>}
                {cr.rollback_plan && <div className="crd-detail-block"><label>Rollback Plan</label><pre className="crd-pre">{cr.rollback_plan}</pre></div>}
                {cr.communication_plan && <div className="crd-detail-block"><label>Communication Plan</label><pre className="crd-pre">{cr.communication_plan}</pre></div>}
                {!cr.implementation_plan && !cr.test_plan && !cr.rollback_plan && !cr.communication_plan && (
                  <p className="crd-empty-text">No implementation plan documented yet.</p>
                )}
              </div>
            )}
          </div>

          {/* Schedule & Completion */}
          {(cr.scheduled_start || cr.actual_start || cr.completion_notes || cr.post_implementation_notes) && (
            <div className="crd-card">
              <h3 className="crd-card-title">Schedule & Completion</h3>
              <div className="crd-info-grid">
                {cr.scheduled_start && <div className="crd-info-item"><span>Scheduled Start</span><strong>{formatDate(cr.scheduled_start)}</strong></div>}
                {cr.scheduled_end && <div className="crd-info-item"><span>Scheduled End</span><strong>{formatDate(cr.scheduled_end)}</strong></div>}
                {cr.actual_start && <div className="crd-info-item"><span>Actual Start</span><strong>{formatDate(cr.actual_start)}</strong></div>}
                {cr.actual_end && <div className="crd-info-item"><span>Actual End</span><strong>{formatDate(cr.actual_end)}</strong></div>}
                <div className="crd-info-item"><span>Maintenance Window</span><strong>{cr.maintenance_window ? 'Yes' : 'No'}</strong></div>
              </div>
              {cr.completion_notes && <div className="crd-detail-block"><label>Completion Notes</label><p>{cr.completion_notes}</p></div>}
              {cr.post_implementation_notes && <div className="crd-detail-block"><label>Post-Implementation Notes</label><p>{cr.post_implementation_notes}</p></div>}
            </div>
          )}

          {/* Affected Systems */}
          {cr.affected_systems?.length > 0 && (
            <div className="crd-card">
              <div className="crd-section-toggle" onClick={() => toggleSection('systems')}>
                <h3><Server size={16} /> Affected Systems ({cr.affected_systems.length})</h3>
                {expandedSections.systems ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
              {expandedSections.systems && (
                <div className="crd-systems-list">
                  {cr.affected_systems.map((sys, i) => (
                    <div key={i} className="crd-system-row">
                      <span className="crd-system-name">{sys.system_name}</span>
                      <span className="crd-system-type">{sys.system_type}</span>
                      <span className={`crd-system-impact crd-impact-${(sys.impact_level || '').toLowerCase()}`}>{sys.impact_level}</span>
                      {sys.expected_downtime_mins > 0 && <span className="crd-system-downtime">{sys.expected_downtime_mins}m downtime</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Comments */}
          <div className="crd-card">
            <div className="crd-section-toggle" onClick={() => toggleSection('comments')}>
              <h3><MessageSquare size={16} /> Comments ({cr.comments?.length || 0})</h3>
              {expandedSections.comments ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
            {expandedSections.comments && (
              <>
                <div className="crd-comment-list">
                  {(cr.comments || []).length === 0 && <p className="crd-empty-text">No comments yet.</p>}
                  {(cr.comments || []).map(c => (
                    <div key={c.comment_id} className={`crd-comment ${c.is_internal ? 'crd-comment-internal' : ''}`}>
                      <div className="crd-comment-header">
                        <span className="crd-comment-author">
                          <User size={12} /> {c.commenter_name}
                          {c.is_internal && <span className="crd-internal-badge">Internal</span>}
                        </span>
                        <span className="crd-comment-date">{formatRelativeTime(c.commented_at)}</span>
                      </div>
                      <p className="crd-comment-text">{c.comment_text}</p>
                    </div>
                  ))}
                </div>
                {/* Add comment */}
                <div className="crd-comment-form">
                  <textarea
                    className="crd-comment-input"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    rows={3}
                  />
                  <div className="crd-comment-actions">
                    <label className="crd-internal-toggle">
                      <input type="checkbox" checked={isInternalNote} onChange={(e) => setIsInternalNote(e.target.checked)} />
                      <span>Internal Note</span>
                    </label>
                    <button className="crd-btn crd-btn-primary" onClick={handleAddComment} disabled={commentLoading || !newComment.trim()}>
                      {commentLoading ? <Loader size={14} className="spinner" /> : <Send size={14} />}
                      <span>Post</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ---- RIGHT SIDEBAR ---- */}
        <div className="crd-sidebar">

          {/* Approval Chain */}
          <div className="crd-card">
            <div className="crd-section-toggle" onClick={() => toggleSection('approvals')}>
              <h3><UserCheck size={16} /> Approval Chain ({cr.approvals?.length || 0})</h3>
              {expandedSections.approvals ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
            {expandedSections.approvals && (
              <div className="crd-approval-chain">
                {(cr.approvals || []).length === 0 && <p className="crd-empty-text">No approvals required yet.</p>}
                {(cr.approvals || []).map((a, i) => (
                  <div key={i} className={`crd-approval-item crd-approval-${(a.status || 'PENDING').toLowerCase()}`}>
                    <div className="crd-approval-icon">
                      {a.status === 'APPROVED' && <CheckCircle size={16} className="crd-icon-approved" />}
                      {a.status === 'REJECTED' && <XCircle size={16} className="crd-icon-rejected" />}
                      {(a.status === 'PENDING' || !a.status) && <Clock size={16} className="crd-icon-pending" />}
                    </div>
                    <div className="crd-approval-info">
                      <span className="crd-approval-name">{a.approver_name}</span>
                      <span className="crd-approval-level">Level {a.approval_order} • {a.approval_type}</span>
                      {a.comments && <span className="crd-approval-comment">{a.comments}</span>}
                      {a.decided_at && <span className="crd-approval-date">{formatRelativeTime(a.decided_at)}</span>}
                    </div>
                    <span className={`crd-approval-status crd-approval-status-${(a.status || 'pending').toLowerCase()}`}>
                      {a.status || 'PENDING'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Checklist */}
          {cr.checklist?.length > 0 && (
            <div className="crd-card">
              <div className="crd-section-toggle" onClick={() => toggleSection('checklist')}>
                <h3><ListChecks size={16} /> Checklist ({cr.checklist.filter(c => c.is_completed).length}/{cr.checklist.length})</h3>
                {expandedSections.checklist ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
              {expandedSections.checklist && (
                <div className="crd-checklist">
                  {cr.checklist.map((item, i) => (
                    <div key={i} className={`crd-checklist-item ${item.is_completed ? 'completed' : ''}`}>
                      <span className="crd-checklist-check">
                        {item.is_completed ? <CheckCircle size={14} /> : <div className="crd-checklist-empty" />}
                      </span>
                      <span className="crd-checklist-text">{item.item_text}</span>
                      {item.completed_by_name && <span className="crd-checklist-meta">{item.completed_by_name}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Implementation Steps */}
          {cr.implementation_steps?.length > 0 && (
            <div className="crd-card">
              <h3 className="crd-card-title">Implementation Steps</h3>
              <div className="crd-impl-steps">
                {cr.implementation_steps.map((step, i) => (
                  <div key={i} className={`crd-impl-step crd-impl-${(step.status || 'pending').toLowerCase()}`}>
                    <span className="crd-impl-number">{step.step_number}</span>
                    <div className="crd-impl-content">
                      <span className="crd-impl-desc">{step.description}</span>
                      {step.performer_name && <span className="crd-impl-performer">{step.performer_name}</span>}
                      {step.completed_at && <span className="crd-impl-date">{formatRelativeTime(step.completed_at)}</span>}
                    </div>
                    <span className={`crd-impl-status crd-impl-status-${(step.status || 'pending').toLowerCase()}`}>
                      {step.status || 'Pending'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activity Timeline */}
          <div className="crd-card">
            <div className="crd-section-toggle" onClick={() => toggleSection('timeline')}>
              <h3><Clock size={16} /> Activity ({timelineEvents.length})</h3>
              {expandedSections.timeline ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>
            {expandedSections.timeline && (
              <div className="crd-timeline">
                {timelineEvents.length === 0 && <p className="crd-empty-text">No activity yet.</p>}
                {timelineEvents.map((ev, i) => (
                  <div key={ev.id || i} className="crd-timeline-item">
                    <div className="crd-timeline-dot" />
                    <div className="crd-timeline-content">
                      <span className="crd-timeline-desc">{ev.description || ev.type}</span>
                      <span className="crd-timeline-meta">
                        {ev.user && <>{ev.user} • </>}
                        {formatRelativeTime(ev.date)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ======== MODALS ======== */}
      {/* ======== DELETE CONFIRMATION MODAL ======== */}
      {showDeleteConfirm && (
        <div className="crd-modal-overlay" onClick={() => !deleteLoading && setShowDeleteConfirm(false)}>
          <div className="crd-modal" onClick={(e) => e.stopPropagation()}>
            <div className="crd-modal-header">
              <h3>Delete Change Request</h3>
              <button className="crd-modal-close" onClick={() => setShowDeleteConfirm(false)} disabled={deleteLoading}>
                <X size={16} />
              </button>
            </div>
            <div className="crd-modal-body">
              <div className="crd-modal-warning">
                <AlertTriangle size={20} />
                <p>
                  You are about to permanently delete <strong>{cr.cr_number}</strong> and all associated data
                  (comments, approvals, attachments, activity history). <strong>This cannot be undone.</strong>
                </p>
              </div>
            </div>
            <div className="crd-modal-footer">
              <button className="crd-btn crd-btn-secondary" onClick={() => setShowDeleteConfirm(false)} disabled={deleteLoading}>
                Cancel
              </button>
              <button className="crd-btn crd-btn-danger" onClick={handleDelete} disabled={deleteLoading}>
                {deleteLoading ? <Loader size={14} className="spinner" /> : <Trash2 size={14} />}
                {deleteLoading ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeModal && (
        <div className="crd-modal-overlay" onClick={() => !actionLoading && setActiveModal(null)}>
          <div className="crd-modal" onClick={(e) => e.stopPropagation()}>
            <div className="crd-modal-header">
              <h3>
                {activeModal === 'cancel' && 'Cancel Change Request'}
                {activeModal === 'reject' && (statusCode === 'PENDING_APPROVAL' ? 'Reject & Cancel Change Request' : 'Reject Change Request')}
                {activeModal === 'approve' && 'Approve Change Request'}
                {activeModal === 'requestInfo' && 'Request Additional Information'}
                {activeModal === 'provideInfo' && 'Provide Requested Information'}
                {activeModal === 'rollback' && 'Rollback Change'}
                {activeModal === 'close' && 'Close Change Request'}
                {activeModal === 'schedule' && 'Schedule Implementation'}
                {activeModal === 'reschedule' && 'Reschedule Implementation'}
                {activeModal === 'startDirect' && 'Start Implementation'}
                {activeModal === 'raiseIssue' && 'Raise Post-Implementation Issue'}
                {activeModal === 'notBelongsToMe' && 'Not Belongs to Me'}
                {activeModal === 'complete' && 'Mark as Completed'}
              </h3>
              <button className="crd-modal-close" onClick={() => setActiveModal(null)} disabled={actionLoading}>
                <X size={16} />
              </button>
            </div>
            <div className="crd-modal-body">
              {activeModal === 'schedule' ? (
                <>
                  <div className="crd-modal-field">
                    <label>Scheduled Start *</label>
                    <input type="datetime-local" className="crd-modal-input" value={scheduleStart} onChange={(e) => setScheduleStart(e.target.value)} />
                  </div>
                  <div className="crd-modal-field">
                    <label>Scheduled End *</label>
                    <input type="datetime-local" className="crd-modal-input" value={scheduleEnd} onChange={(e) => setScheduleEnd(e.target.value)} />
                  </div>
                  <label className="crd-modal-checkbox">
                    <input type="checkbox" checked={maintenanceWindow} onChange={(e) => setMaintenanceWindow(e.target.checked)} />
                    <span>Maintenance Window Required</span>
                  </label>
                </>
              ) : activeModal === 'reschedule' ? (
                <>
                  <div className="crd-modal-field">
                    <label>New Scheduled Start *</label>
                    <input type="datetime-local" className="crd-modal-input" value={scheduleStart} onChange={(e) => setScheduleStart(e.target.value)} />
                  </div>
                  <div className="crd-modal-field">
                    <label>New Scheduled End *</label>
                    <input type="datetime-local" className="crd-modal-input" value={scheduleEnd} onChange={(e) => setScheduleEnd(e.target.value)} />
                  </div>
                  <label className="crd-modal-checkbox">
                    <input type="checkbox" checked={maintenanceWindow} onChange={(e) => setMaintenanceWindow(e.target.checked)} />
                    <span>Maintenance Window Required</span>
                  </label>
                  <div className="crd-modal-field" style={{ marginTop: '12px' }}>
                    <label>Reason for Reschedule</label>
                    <textarea className="crd-modal-textarea" value={modalNote} onChange={(e) => setModalNote(e.target.value)} rows={2} placeholder="Explain why the schedule is changing (optional)..." />
                  </div>
                </>
              ) : activeModal === 'startDirect' ? (
                <>
                  <p style={{ marginBottom: '12px', color: 'var(--text-secondary, #6b7280)', fontSize: '13px' }}>
                    You are starting implementation immediately. Optionally set a planned completion date as your timeline commitment.
                  </p>
                  <div className="crd-modal-field">
                    <label>Planned Completion Date (optional)</label>
                    <input
                      type="datetime-local"
                      className="crd-modal-input"
                      value={plannedEndDate}
                      onChange={(e) => setPlannedEndDate(e.target.value)}
                    />
                  </div>
                </>
              ) : activeModal === 'notBelongsToMe' ? (
                <>
                  <p style={{ marginBottom: '12px', color: 'var(--text-secondary, #6b7280)', fontSize: '13px' }}>
                    This CR will be returned to the requester with your message. They will need to select the correct approver and resubmit.
                  </p>
                  <div className="crd-modal-field">
                    <label>Message to Requester (optional)</label>
                    <textarea
                      className="crd-modal-textarea"
                      value={modalNote}
                      onChange={(e) => setModalNote(e.target.value)}
                      rows={3}
                      placeholder="Explain why this CR doesn't belong to you and who to contact..."
                    />
                  </div>
                </>
              ) : activeModal === 'raiseIssue' ? (
                <>
                  <p style={{ marginBottom: '12px', color: 'var(--text-secondary, #6b7280)', fontSize: '13px' }}>
                    This will reopen the CR as In Progress. You can raise a post-implementation issue within 24 hours of completion.
                  </p>
                  <div className="crd-modal-field">
                    <label>Issue Description *</label>
                    <textarea
                      className="crd-modal-textarea"
                      value={raiseIssueDesc}
                      onChange={(e) => setRaiseIssueDesc(e.target.value)}
                      rows={4}
                      placeholder="Describe the post-implementation issue..."
                    />
                  </div>
                </>
              ) : activeModal === 'close' ? (
                <>
                  <div className="crd-modal-field">
                    <label>PIR Outcome</label>
                    <select className="crd-modal-input" value={closePirOutcome} onChange={(e) => setClosePirOutcome(e.target.value)}>
                      <option value="Successful">Success</option>
                      <option value="Partially Successful">Partial Success</option>
                      <option value="Failed">Failed</option>
                    </select>
                  </div>
                  <div className="crd-modal-field">
                    <label>PIR Notes (optional)</label>
                    <textarea className="crd-modal-textarea" value={closePirNotes} onChange={(e) => setClosePirNotes(e.target.value)} rows={3} placeholder="Post-implementation review notes..." />
                  </div>
                </>
              ) : activeModal === 'complete' ? (
                <>
                  <div className="crd-modal-field">
                    <label>Implementation Notes *</label>
                    <textarea className="crd-modal-textarea" value={completionNotes} onChange={(e) => setCompletionNotes(e.target.value)} rows={3} placeholder="Describe what was done..." />
                  </div>
                  <div className="crd-modal-field">
                    <label>PIR Outcome</label>
                    <select className="crd-modal-input" value={pirOutcome} onChange={(e) => setPirOutcome(e.target.value)}>
                      <option value="Successful">Success</option>
                      <option value="Partially Successful">Partial Success</option>
                      <option value="Failed">Failed</option>
                    </select>
                  </div>
                  <div className="crd-modal-field">
                    <label>Post-Implementation Review Notes</label>
                    <textarea className="crd-modal-textarea" value={postImplNotes} onChange={(e) => setPostImplNotes(e.target.value)} rows={3} placeholder="Any post-implementation observations..." />
                  </div>
                </>
              ) : (
                <div className="crd-modal-field">
                  <label>
                    {activeModal === 'cancel' && 'Reason for cancellation'}
                    {activeModal === 'reject' && (statusCode === 'PENDING_APPROVAL'
                      ? 'Rejection reason (CR will be automatically cancelled)'
                      : 'Rejection reason')}
                    {activeModal === 'approve' && 'Approval comments (optional)'}
                    {activeModal === 'requestInfo' && 'What information is needed?'}
                    {activeModal === 'provideInfo' && 'Provide the requested information'}
                    {activeModal === 'rollback' && 'Rollback notes'}
                  </label>
                  <textarea
                    className="crd-modal-textarea"
                    value={modalNote}
                    onChange={(e) => setModalNote(e.target.value)}
                    rows={4}
                    placeholder="Enter details..."
                  />
                </div>
              )}
            </div>
            <div className="crd-modal-footer">
              <button className="crd-btn crd-btn-secondary" onClick={() => setActiveModal(null)} disabled={actionLoading}>
                Cancel
              </button>
              <button
                className={`crd-btn ${['reject', 'cancel', 'rollback'].includes(activeModal) ? 'crd-btn-danger' : 'crd-btn-primary'}`}
                onClick={handleModalSubmit}
                disabled={actionLoading || (activeModal === 'schedule' && (!scheduleStart || !scheduleEnd)) || (activeModal === 'complete' && !completionNotes.trim()) || (activeModal === 'raiseIssue' && !raiseIssueDesc.trim())}
              >
                {actionLoading ? <Loader size={14} className="spinner" /> : null}
                <span>
                  {activeModal === 'cancel' && 'Cancel CR'}
                  {activeModal === 'reject' && 'Reject'}
                  {activeModal === 'approve' && 'Approve'}
                  {activeModal === 'requestInfo' && 'Send Request'}
                  {activeModal === 'provideInfo' && 'Submit Info'}
                  {activeModal === 'rollback' && 'Confirm Rollback'}
                  {activeModal === 'close' && 'Close CR'}
                  {activeModal === 'schedule' && 'Confirm Schedule'}
                  {activeModal === 'reschedule' && 'Confirm Reschedule'}
                  {activeModal === 'startDirect' && 'Start Implementation'}
                  {activeModal === 'complete' && 'Mark Complete'}
                  {activeModal === 'notBelongsToMe' && 'Confirm — Not Mine'}
                  {activeModal === 'raiseIssue' && 'Raise Issue'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CRDetail;

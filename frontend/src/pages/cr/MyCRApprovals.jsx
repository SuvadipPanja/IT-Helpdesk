/**
 * ============================================
 * MY CR APPROVALS PAGE
 * ============================================
 * Lists all Change Requests pending approval decision
 * by the currently logged-in user.
 *
 * Shown only to users with can_approve_cr permission.
 * Admins see all PENDING_APPROVAL CRs.
 *
 * Actions available inline: Approve / Reject / Need Info / Not Mine
 * ============================================
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  BadgeCheck,
  Search,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Info,
  Loader,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  ArrowUpDown,
  X,
  CheckCircle2,
  XCircle,
  ListFilter,
  UserX
} from 'lucide-react';
import RefreshButton from '../../components/shared/RefreshButton';
import crService from '../../services/crService';
import { formatDate as formatDateUtil } from '../../utils/dateUtils';
import '../../styles/MyCRApprovals.css';

// ── Helpers ────────────────────────────────────────────────────
const formatDate = (d) => (d ? formatDateUtil(d) : '—');

const timeAgo = (dateStr) => {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const getRiskClass = (risk) => {
  switch ((risk || '').toUpperCase()) {
    case 'CRITICAL': return 'mcra-risk-critical';
    case 'HIGH':     return 'mcra-risk-high';
    case 'MEDIUM':   return 'mcra-risk-medium';
    case 'LOW':      return 'mcra-risk-low';
    default:         return 'mcra-risk-medium';
  }
};

const PAGE_LIMIT = 20;

// ── Component ──────────────────────────────────────────────────
const MyCRApprovals = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const isAdmin = ['ADMIN', 'SUB_ADMIN'].includes(user?.role?.role_code);

  // ── List state ──
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [activeStatus, setActiveStatus] = useState('PENDING_APPROVAL');
  const debounceTimer = useRef(null);

  // ── Stats ──
  const [stats, setStats] = useState({ pending_count: 0, approved_count: 0, rejected_count: 0 });

  // ── Action modal state ──
  const [actionModal, setActionModal] = useState(null); // { cr, type: 'approve'|'reject'|'needInfo'|'notMine' }
  const [actionNote, setActionNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Debounce search
  useEffect(() => {
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 350);
    return () => clearTimeout(debounceTimer.current);
  }, [search]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: currentPage,
        limit: PAGE_LIMIT,
        status: activeStatus,
        ...(debouncedSearch ? { search: debouncedSearch } : {})
      });
      const res = await crService.getMyCRApprovals(params.toString());
      const data = res.data?.data || {};
      setRows(data.rows || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
      if (data.stats) setStats(data.stats);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load CR approvals');
    } finally {
      setLoading(false);
    }
  }, [currentPage, debouncedSearch, activeStatus]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Action handlers ──
  const openModal = (cr, type) => {
    setActionModal({ cr, type });
    setActionNote('');
  };
  const closeModal = () => { setActionModal(null); setActionNote(''); };

  const submitAction = async () => {
    if (!actionModal) return;
    const { cr, type } = actionModal;
    if ((type === 'reject' || type === 'needInfo' || type === 'notMine') && !actionNote.trim()) {
      toast.error('Please provide a note/reason.');
      return;
    }
    setActionLoading(true);
    try {
      if (type === 'approve') {
        await crService.approve(cr.cr_id, { notes: actionNote.trim() });
        toast.success(`CR ${cr.cr_number} approved!`);
      } else if (type === 'reject') {
        await crService.reject(cr.cr_id, { notes: actionNote.trim() });
        toast.success(`CR ${cr.cr_number} rejected and cancelled.`);
      } else if (type === 'needInfo') {
        await crService.requestInfo(cr.cr_id, { notes: actionNote.trim() });
        toast.success('Requested more information from the submitter.');
      } else if (type === 'notMine') {
        await crService.notBelongsToMe(cr.cr_id, { notes: actionNote.trim() });
        toast.success('CR returned to the submitter for re-routing.');
      }
      closeModal();
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Pagination ──
  const goToPage = (p) => { if (p >= 1 && p <= totalPages) setCurrentPage(p); };

  const Th = ({ col, label }) => (
    <th className="mcra-th">{label}</th>
  );

  // ── Modal label helpers ──
  const modalTitle = {
    approve:  'Approve Change Request',
    reject:   'Reject & Cancel CR',
    needInfo: 'Request More Information',
    notMine:  'Not Assigned to Me'
  };
  const modalColor = {
    approve:  '#059669',
    reject:   '#dc2626',
    needInfo: '#d97706',
    notMine:  '#6366f1'
  };
  const modalHint = {
    approve:  'The CR will move to the Central Ticketing Team for implementation.',
    reject:   'The CR will be automatically cancelled. The submitter will be notified.',
    needInfo: 'The submitter will be asked to provide more details before re-submitting for approval.',
    notMine:  'The CR will be returned to the submitter to select a different approver.'
  };

  return (
    <div className="mcra-page">
      {/* ── Header ── */}
      <div className="mcra-header">
        <div className="mcra-header-left">
          <div className="mcra-title-row">
            <BadgeCheck size={28} className="mcra-title-icon" />
            <div>
              <h1 className="mcra-title">My CR Approvals</h1>
              <p className="mcra-subtitle">
                {isAdmin
                  ? 'All change requests awaiting approval (admin view)'
                  : 'Change requests assigned to you for approval'}
              </p>
            </div>
          </div>
        </div>
        <RefreshButton onClick={fetchData} variant="ghost" />
      </div>

      {/* ── Status Tabs ── */}
      <div className="mcra-tabs">
        <button
          className={`mcra-tab ${activeStatus === 'PENDING_APPROVAL' ? 'mcra-tab--active mcra-tab--pending' : ''}`}
          onClick={() => { setActiveStatus('PENDING_APPROVAL'); setCurrentPage(1); }}
        >
          <Clock size={15} />
          <span>Pending My Decision</span>
          {(stats.pending_count ?? 0) > 0 && (
            <span className="mcra-tab-count">{stats.pending_count}</span>
          )}
        </button>
        <button
          className={`mcra-tab ${activeStatus === 'ALL' ? 'mcra-tab--active mcra-tab--all' : ''}`}
          onClick={() => { setActiveStatus('ALL'); setCurrentPage(1); }}
        >
          <ListFilter size={15} />
          <span>History</span>
        </button>
      </div>

      {/* ── Stats bar (clickable filters) ── */}
      <div className="mcra-stats-bar">
        <button
          type="button"
          className={`mcra-stat mcra-stat--pending ${activeStatus === 'PENDING_APPROVAL' ? 'mcra-stat--active' : ''}`}
          onClick={() => { setActiveStatus('PENDING_APPROVAL'); setCurrentPage(1); }}
          title="Show CRs awaiting your decision"
        >
          <span className="mcra-stat-value">{stats.pending_count ?? 0}</span>
          <span className="mcra-stat-label">Awaiting Decision</span>
        </button>
        <button
          type="button"
          className={`mcra-stat mcra-stat--approved ${activeStatus === 'APPROVED' ? 'mcra-stat--active' : ''}`}
          onClick={() => { setActiveStatus('APPROVED'); setCurrentPage(1); }}
          title="Show approved CRs"
        >
          <span className="mcra-stat-value">{stats.approved_count ?? 0}</span>
          <span className="mcra-stat-label">Approved</span>
        </button>
        <button
          type="button"
          className={`mcra-stat mcra-stat--rejected ${activeStatus === 'REJECTED' ? 'mcra-stat--active' : ''}`}
          onClick={() => { setActiveStatus('REJECTED'); setCurrentPage(1); }}
          title="Show rejected or cancelled CRs"
        >
          <span className="mcra-stat-value">{stats.rejected_count ?? 0}</span>
          <span className="mcra-stat-label">Rejected / Cancelled</span>
        </button>
      </div>

      {/* ── Toolbar ── */}
      <div className="mcra-toolbar">
        <div className="mcra-search-wrap">
          <Search size={16} className="mcra-search-icon" />
          <input
            className="mcra-search"
            placeholder="Search CR #, title or submitter…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="mcra-search-clear" onClick={() => setSearch('')}>
              <X size={14} />
            </button>
          )}
        </div>
        <span className="mcra-total-label">{total} CR{total !== 1 ? 's' : ''}</span>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="mcra-loading">
          <Loader size={32} className="mcra-spin" />
          <p>Loading…</p>
        </div>
      ) : error ? (
        <div className="mcra-error">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button className="mcra-btn-ghost" onClick={fetchData}>Retry</button>
        </div>
      ) : rows.length === 0 ? (
        <div className="mcra-empty">
          <CheckCircle2 size={48} className="mcra-empty-icon" />
          <h3>
            {activeStatus === 'PENDING_APPROVAL' ? 'No CRs awaiting your decision'
              : activeStatus === 'APPROVED'      ? 'No approved CRs'
              : activeStatus === 'REJECTED'      ? 'No rejected or cancelled CRs'
              : 'No approval history'}
          </h3>
          <p>{search ? 'Nothing matches your search.' : 'Change requests assigned to you for approval will appear here.'}</p>
        </div>
      ) : (
        <>
          <div className="mcra-table-wrap">
            <table className="mcra-table">
              <thead>
                <tr>
                  <Th col="cr_number" label="CR #" />
                  <Th col="title" label="Title" />
                  <th className="mcra-th">Risk</th>
                  <th className="mcra-th">Type</th>
                  <Th col="requester_name" label="Submitted By" />
                  <Th col="updated_at" label="Last Updated" />
                  <th className="mcra-th">Status</th>
                  {activeStatus === 'PENDING_APPROVAL' && (
                    <th className="mcra-th mcra-th-center">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((cr) => (
                  <tr key={cr.cr_id} className="mcra-row">
                    <td className="mcra-td">
                      <button
                        className="mcra-cr-link"
                        onClick={() => navigate(`/cr/${cr.cr_id}`)}
                        title="Open CR"
                      >
                        {cr.cr_number || `CR-${cr.cr_id}`}
                      </button>
                    </td>
                    <td className="mcra-td mcra-td-title" title={cr.title}>
                      {cr.title}
                    </td>
                    <td className="mcra-td">
                      {cr.risk_level && (
                        <span className={`mcra-risk-badge ${getRiskClass(cr.risk_level)}`}>
                          {cr.risk_level}
                        </span>
                      )}
                    </td>
                    <td className="mcra-td mcra-td-muted">{cr.type_name || '—'}</td>
                    <td className="mcra-td">{cr.requester_name || '—'}</td>
                    <td className="mcra-td mcra-td-time" title={formatDate(cr.updated_at)}>
                      <Clock size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                      {timeAgo(cr.updated_at)}
                    </td>
                    <td className="mcra-td">
                      <span
                        className="mcra-status-badge"
                        style={{ background: cr.color_code ? cr.color_code + '22' : undefined, color: cr.color_code || undefined, borderColor: cr.color_code || undefined }}
                      >
                        {cr.status_name || cr.status_code}
                      </span>
                    </td>

                    {activeStatus === 'PENDING_APPROVAL' && (
                      <td className="mcra-td mcra-td-actions">
                        <button className="mcra-action-btn mcra-action-btn--view"   title="View CR"        onClick={() => navigate(`/cr/${cr.cr_id}`)}>
                          <Eye size={14} />
                        </button>
                        <button className="mcra-action-btn mcra-action-btn--approve" title="Approve"       onClick={() => openModal(cr, 'approve')}>
                          <ThumbsUp size={14} />
                        </button>
                        <button className="mcra-action-btn mcra-action-btn--reject"  title="Reject & Cancel" onClick={() => openModal(cr, 'reject')}>
                          <ThumbsDown size={14} />
                        </button>
                        <button className="mcra-action-btn mcra-action-btn--info"    title="Need More Info" onClick={() => openModal(cr, 'needInfo')}>
                          <Info size={14} />
                        </button>
                        <button className="mcra-action-btn mcra-action-btn--notmine" title="Not Mine"      onClick={() => openModal(cr, 'notMine')}>
                          <UserX size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <div className="mcra-pagination">
              <button className="mcra-page-btn" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}>
                <ChevronLeft size={16} />
              </button>
              <span className="mcra-page-info">Page {currentPage} of {totalPages}</span>
              <button className="mcra-page-btn" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}>
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Action Modal ── */}
      {actionModal && (
        <div className="mcra-modal-overlay" onClick={closeModal}>
          <div className="mcra-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mcra-modal-header" style={{ borderColor: modalColor[actionModal.type] }}>
              <h3 style={{ color: modalColor[actionModal.type] }}>{modalTitle[actionModal.type]}</h3>
              <button className="mcra-modal-close" onClick={closeModal}><X size={18} /></button>
            </div>
            <div className="mcra-modal-body">
              <p className="mcra-modal-cr-ref">
                <strong>{actionModal.cr.cr_number}</strong> — {actionModal.cr.title}
              </p>
              <p className="mcra-modal-hint">{modalHint[actionModal.type]}</p>
              <label className="mcra-modal-label">
                {actionModal.type === 'approve' ? 'Notes (optional)' : 'Reason / Message *'}
              </label>
              <textarea
                className="mcra-modal-textarea"
                rows={4}
                placeholder={
                  actionModal.type === 'approve'    ? 'Optional approval notes…' :
                  actionModal.type === 'reject'     ? 'Why is this CR being rejected?' :
                  actionModal.type === 'needInfo'   ? 'What additional information is needed?' :
                  'Message to the submitter explaining why it is being returned…'
                }
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                autoFocus
              />
            </div>
            <div className="mcra-modal-footer">
              <button className="mcra-btn-ghost" onClick={closeModal} disabled={actionLoading}>Cancel</button>
              <button
                className="mcra-btn-action"
                style={{ background: modalColor[actionModal.type] }}
                onClick={submitAction}
                disabled={actionLoading || ((actionModal.type !== 'approve') && !actionNote.trim())}
              >
                {actionLoading ? <Loader size={14} className="mcra-spin" /> : null}
                {modalTitle[actionModal.type]}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyCRApprovals;

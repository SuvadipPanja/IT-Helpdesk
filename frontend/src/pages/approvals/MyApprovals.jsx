/**
 * ============================================
 * MY APPROVALS PAGE
 * ============================================
 * Lists all approval requests for the current user:
 *  - As APPROVER: pending requests awaiting their decision
 *  - As ADMIN: all pending approvals globally (override)
 *
 * Allows inline approve / reject via a slide-in panel.
 *
 * Developer: Suvadip Panja
 * Company: Digitide
 * Created: 2026
 * FILE: frontend/src/pages/approvals/MyApprovals.jsx
 * ============================================
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  ClipboardList,
  Search,
  Eye,
  BadgeCheck,
  ThumbsDown,
  Loader,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  ArrowUpDown,
  X,
  CheckCircle2,
  XCircle,
  ListFilter
} from 'lucide-react';
import RefreshButton from '../../components/shared/RefreshButton';
import api from '../../services/api';
import { formatDate as formatDateUtil } from '../../utils/dateUtils';
import '../../styles/MyApprovals.css';

// ── Helpers ────────────────────────────────────────────────────

const getPriorityClass = (code) => {
  switch ((code || '').toUpperCase()) {
    case 'CRITICAL': return 'ma-priority-critical';
    case 'HIGH':     return 'ma-priority-high';
    case 'MEDIUM':   return 'ma-priority-medium';
    case 'LOW':      return 'ma-priority-low';
    default:         return 'ma-priority-medium';
  }
};

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

const PAGE_LIMIT = 20;

// ── Component ──────────────────────────────────────────────────

const MyApprovals = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  /** ADMIN / SUB_ADMIN see all rows and can decide any pending approval */
  const isPlatformAdmin = ['ADMIN', 'SUB_ADMIN'].includes(user?.role?.role_code);

  // ── List state ──
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState('requested_at');
  const [sortOrder, setSortOrder] = useState('DESC');
  const [activeStatus, setActiveStatus] = useState('PENDING'); // PENDING | APPROVED | REJECTED | ALL
  const debounceTimer = useRef(null);

  // ── Decision panel state ──
  const [selected, setSelected] = useState(null);     // approval row being decided
  const [decision, setDecision] = useState('APPROVED');
  const [decisionNote, setDecisionNote] = useState('');
  const [decideLoading, setDecideLoading] = useState(false);

  // ── Stats ──
  const [stats, setStats] = useState({ pending_count: 0, approved_today: 0, rejected_today: 0, overdue_pending: 0 });

  // Debounce search
  useEffect(() => {
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 350);
    return () => clearTimeout(debounceTimer.current);
  }, [search]);

  const fetchApprovals = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: currentPage,
        limit: PAGE_LIMIT,
        status: activeStatus,
        sortBy,
        sortOrder,
        ...(debouncedSearch ? { search: debouncedSearch } : {})
      });
      const res = await api.get(`/ticket-approvals/pending?${params}`);
      const data = res.data?.data || res.data || {};
      setApprovals(data.approvals || data.rows || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || Math.ceil((data.total || 0) / PAGE_LIMIT) || 1);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load approvals');
    } finally {
      setLoading(false);
    }
  }, [currentPage, sortBy, sortOrder, debouncedSearch, activeStatus]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/ticket-approvals/stats');
      setStats(res.data?.data || res.data || {});
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    fetchApprovals();
    fetchStats();
  }, [fetchApprovals, fetchStats]);

  const handleSort = (col) => {
    if (sortBy === col) {
      setSortOrder((o) => (o === 'ASC' ? 'DESC' : 'ASC'));
    } else {
      setSortBy(col);
      setSortOrder('DESC');
    }
    setCurrentPage(1);
  };

  const handleDecide = async () => {
    if (!selected || !decisionNote.trim()) return;
    setDecideLoading(true);
    try {
      await api.post(`/ticket-approvals/${selected.approval_id}/decide`, {
        decision,
        decision_note: decisionNote.trim()
      });
      toast.success(decision === 'APPROVED' ? 'Approval granted!' : 'Request rejected.');
      setSelected(null);
      setDecisionNote('');
      setDecision('APPROVED');
      fetchApprovals();
      fetchStats();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit decision');
    } finally {
      setDecideLoading(false);
    }
  };

  const Th = ({ col, label }) => (
    <th className="ma-th ma-th-sort" onClick={() => handleSort(col)} title={`Sort by ${label}`}>
      {label}
      <ArrowUpDown size={12} className="ma-sort-icon" />
      {sortBy === col && <span className="ma-sort-dir">{sortOrder === 'ASC' ? '↑' : '↓'}</span>}
    </th>
  );

  return (
    <div className="ma-page">
      {/* ── Header ── */}
      <div className="ma-header">
        <div className="ma-header-left">
          <div className="ma-title-row">
            <ClipboardList size={28} className="ma-title-icon" />
            <div>
              <h1 className="ma-title">My Approvals</h1>
              <p className="ma-subtitle">
                {isPlatformAdmin
                  ? 'Manage all approval requests across the system (admin override)'
                  : 'Approvals you must decide as designated approver, or requests you raised'}
              </p>
            </div>
          </div>
        </div>
        <div className="ma-header-right">
          <RefreshButton
            onClick={() => { fetchApprovals(); fetchStats(); }}
            variant="ghost"
          />
        </div>
      </div>

      {/* ── Status Tabs (clickable) ── */}
      <div className="ma-status-tabs">
        <button
          className={`ma-status-tab ${activeStatus === 'PENDING' ? 'ma-status-tab--active ma-status-tab--pending' : ''}`}
          onClick={() => { setActiveStatus('PENDING'); setCurrentPage(1); }}
        >
          <Clock size={15} />
          <span>Pending</span>
          <span className="ma-tab-count">{stats.pending_count ?? 0}</span>
        </button>
        <button
          className={`ma-status-tab ${activeStatus === 'APPROVED' ? 'ma-status-tab--active ma-status-tab--approved' : ''}`}
          onClick={() => { setActiveStatus('APPROVED'); setCurrentPage(1); }}
        >
          <CheckCircle2 size={15} />
          <span>Approved</span>
          <span className="ma-tab-count">{stats.approved_count ?? 0}</span>
        </button>
        <button
          className={`ma-status-tab ${activeStatus === 'REJECTED' ? 'ma-status-tab--active ma-status-tab--rejected' : ''}`}
          onClick={() => { setActiveStatus('REJECTED'); setCurrentPage(1); }}
        >
          <XCircle size={15} />
          <span>Rejected</span>
          <span className="ma-tab-count">{stats.rejected_count ?? 0}</span>
        </button>
        <button
          className={`ma-status-tab ${activeStatus === 'ALL' ? 'ma-status-tab--active ma-status-tab--all' : ''}`}
          onClick={() => { setActiveStatus('ALL'); setCurrentPage(1); setSortBy('requested_at'); }}
        >
          <ListFilter size={15} />
          <span>All</span>
          {(stats.all_count ?? 0) > 0 && (
            <span className="ma-tab-count">{stats.all_count}</span>
          )}
        </button>
      </div>

      {/* ── Overdue callout (pending view only) ── */}
      {activeStatus === 'PENDING' && (stats.overdue_pending ?? 0) > 0 && (
        <div className="ma-overdue-callout">
          <AlertCircle size={14} />
          <span>{stats.overdue_pending} overdue (&gt;48h) pending approval{stats.overdue_pending !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="ma-toolbar">
        <div className="ma-search-wrap">
          <Search size={16} className="ma-search-icon" />
          <input
            className="ma-search"
            placeholder="Search ticket #, subject or engineer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="ma-search-clear" onClick={() => setSearch('')}>
              <X size={14} />
            </button>
          )}
        </div>
        <span className="ma-total-label">{total} request{total !== 1 ? 's' : ''}</span>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="ma-loading">
          <Loader size={32} className="ma-spin" />
          <p>Loading approvals…</p>
        </div>
      ) : error ? (
        <div className="ma-error">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button className="ma-btn ma-btn-ghost" onClick={fetchApprovals}>Retry</button>
        </div>
      ) : approvals.length === 0 ? (
        <div className="ma-empty">
          <BadgeCheck size={48} className="ma-empty-icon" />
          <h3>No {activeStatus === 'ALL' ? '' : activeStatus.toLowerCase()} approvals</h3>
          <p>
            {search
              ? 'Nothing matches your search.'
              : activeStatus === 'PENDING'
              ? isPlatformAdmin
                ? 'No pending approvals in the system right now.'
                : 'No pending approvals assigned to you or awaiting decision on your tickets.'
              : activeStatus === 'APPROVED'
              ? 'No approved requests yet.'
              : activeStatus === 'REJECTED'
              ? 'No rejected requests yet.'
              : 'No approval records found.'}
          </p>
        </div>
      ) : (
        <>
          <div className="ma-table-wrap">
            <table className="ma-table">
              <thead>
                <tr>
                  <Th col="ticket_number" label="Ticket #" />
                  <Th col="subject"       label="Subject" />
                  <th className="ma-th">Priority</th>
                  <Th col="engineer_name" label="Raised By" />
                  {!isPlatformAdmin && <th className="ma-th">My Role</th>}
                  {(activeStatus === 'APPROVED' || activeStatus === 'REJECTED') ? (
                    <>
                      <Th col="approver_name" label="Decided By" />
                      <Th col="decided_at"    label="Decided At" />
                    </>
                  ) : (
                    <>
                      <Th col="requested_at" label="Requested" />
                      <th className="ma-th">SLA Deadline</th>
                    </>
                  )}
                  <th className="ma-th ma-th-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {approvals.map((a) => {
                  // Only the designated approver may decide; platform admins may override
                  const canDecide = activeStatus === 'PENDING' &&
                    (isPlatformAdmin || a.approver_id === user?.user_id);

                  return (
                  <tr key={a.approval_id} className={`ma-row ma-row--${a.status?.toLowerCase()}`}>
                    <td className="ma-td">
                      <button
                        className="ma-ticket-link"
                        onClick={() => navigate(`/tickets/${a.ticket_id}`)}
                        title="Open ticket"
                      >
                        #{a.ticket_number || a.ticket_id}
                      </button>
                    </td>
                    <td className="ma-td ma-td-subject" title={a.subject}>
                      {a.subject || '—'}
                    </td>
                    <td className="ma-td">
                      {a.priority_name && (
                        <span className={`ma-priority-badge ${getPriorityClass(a.priority_name)}`}>
                          {a.priority_name}
                        </span>
                      )}
                    </td>
                    <td className="ma-td">{a.engineer_name || '—'}</td>

                    {/* My Role indicator — only for non-admins */}
                    {!isPlatformAdmin && (
                      <td className="ma-td">
                        {a.approver_id === user?.user_id
                          ? <span className="ma-role-badge ma-role-badge--approver">Approver</span>
                          : <span className="ma-role-badge ma-role-badge--requester">My Request</span>}
                      </td>
                    )}

                    {/* Columns differ by active tab */}
                    {(activeStatus === 'APPROVED' || activeStatus === 'REJECTED') ? (
                      <>
                        <td className="ma-td">{a.approver_name || '—'}</td>
                        <td className="ma-td ma-td-time" title={formatDate(a.decided_at)}>
                          {a.decided_at ? (
                            <><Clock size={12} />{timeAgo(a.decided_at)}</>
                          ) : '—'}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="ma-td ma-td-time" title={formatDate(a.requested_at)}>
                          <Clock size={12} />
                          {timeAgo(a.requested_at)}
                        </td>
                        <td className="ma-td">
                          {a.due_date ? (
                            <span
                              className={
                                new Date(a.due_date) < new Date()
                                  ? 'ma-due-breached'
                                  : 'ma-due-ok'
                              }
                            >
                              {formatDate(a.due_date)}
                            </span>
                          ) : (
                            <span className="ma-due-paused">⏸ Paused</span>
                          )}
                        </td>
                      </>
                    )}

                    <td className="ma-td ma-td-actions">
                      <button
                        className="ma-btn ma-btn-view"
                        onClick={() => navigate(`/tickets/${a.ticket_id}`)}
                        title="View ticket"
                      >
                        <Eye size={14} />
                      </button>
                      {canDecide && (
                        <>
                          <button
                            className="ma-btn ma-btn-approve"
                            onClick={() => { setSelected(a); setDecision('APPROVED'); setDecisionNote(''); }}
                            title="Approve"
                          >
                            <BadgeCheck size={14} />
                          </button>
                          <button
                            className="ma-btn ma-btn-reject"
                            onClick={() => { setSelected(a); setDecision('REJECTED'); setDecisionNote(''); }}
                            title="Reject"
                          >
                            <ThumbsDown size={14} />
                          </button>
                        </>
                      )}
                      {/* Show decision note badge for resolved approvals */}
                      {(activeStatus === 'APPROVED' || activeStatus === 'REJECTED' || activeStatus === 'ALL') && a.decision_note && (
                        <span
                          className={`ma-decision-badge ma-decision-badge--${a.status?.toLowerCase()}`}
                          title={a.decision_note}
                        >
                          {a.status === 'APPROVED' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                        </span>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <div className="ma-pagination">
              <button
                className="ma-pag-btn"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => p - 1)}
              >
                <ChevronLeft size={16} />
              </button>
              <span className="ma-pag-info">
                Page {currentPage} of {totalPages}
              </span>
              <button
                className="ma-pag-btn"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Decision modal ── */}
      {selected && (
        <div className="ma-modal-overlay" onClick={() => { if (!decideLoading) { setSelected(null); setDecisionNote(''); } }}>
          <div className="ma-modal" onClick={(e) => e.stopPropagation()}>
            <div className={`ma-modal-icon ${decision === 'APPROVED' ? 'ma-modal-icon-approve' : 'ma-modal-icon-reject'}`}>
              {decision === 'APPROVED' ? <BadgeCheck size={32} /> : <ThumbsDown size={32} />}
            </div>
            <h3>{decision === 'APPROVED' ? 'Approve Request' : 'Reject Request'}</h3>

            {/* Context */}
            <div className="ma-modal-context">
              <div className="ma-modal-context-row">
                <span className="ma-modal-context-label">Ticket</span>
                <span>#{selected.ticket_number || selected.ticket_id} — {selected.subject}</span>
              </div>
              <div className="ma-modal-context-row">
                <span className="ma-modal-context-label">Raised by</span>
                <span>{selected.engineer_name}</span>
              </div>
              <div className="ma-modal-context-row">
                <span className="ma-modal-context-label">Reason</span>
                <p className="ma-modal-reason">{selected.approval_note}</p>
              </div>
            </div>

            {/* Toggle */}
            <div className="ma-modal-toggle">
              <button
                className={`ma-decide-btn ${decision === 'APPROVED' ? 'active-approve' : ''}`}
                onClick={() => setDecision('APPROVED')}
                disabled={decideLoading}
              >
                <BadgeCheck size={16} /> Approve
              </button>
              <button
                className={`ma-decide-btn ${decision === 'REJECTED' ? 'active-reject' : ''}`}
                onClick={() => setDecision('REJECTED')}
                disabled={decideLoading}
              >
                <ThumbsDown size={16} /> Reject
              </button>
            </div>

            <label className="ma-modal-label">
              Decision Note <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <textarea
              className="ma-modal-textarea"
              rows={4}
              value={decisionNote}
              onChange={(e) => setDecisionNote(e.target.value)}
              placeholder={
                decision === 'APPROVED'
                  ? 'e.g. Approved. Budget has been allocated.'
                  : 'e.g. Rejected. Please explore an alternative solution.'
              }
              disabled={decideLoading}
            />

            <div className="ma-modal-actions">
              <button
                className="ma-btn ma-btn-ghost"
                onClick={() => { setSelected(null); setDecisionNote(''); }}
                disabled={decideLoading}
              >
                Cancel
              </button>
              <button
                className={`ma-btn ${decision === 'APPROVED' ? 'ma-btn-approve' : 'ma-btn-reject'}`}
                onClick={handleDecide}
                disabled={decideLoading || !decisionNote.trim()}
              >
                {decision === 'APPROVED' ? <BadgeCheck size={16} /> : <ThumbsDown size={16} />}
                {decideLoading ? 'Processing…' : decision === 'APPROVED' ? 'Confirm Approval' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyApprovals;

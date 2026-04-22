/**
 * ============================================
 * CR QUEUE PAGE - REVIEW / IMPLEMENTATION QUEUE
 * ============================================
 * Shows CRs assigned to the user for review,
 * approval, or implementation. Mirrors MyQueue.
 * ============================================
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  Search,
  RefreshCw,
  Eye,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Loader,
  Shield,
  X,
  CheckCircle,
  AlertTriangle,
  XCircle,
  MessageSquare,
  User,
} from 'lucide-react';
import crService from '../../services/crService';
import { formatDate as formatDateUtil, timeAgo } from '../../utils/dateUtils';
import { API_BASE_URL } from '../../utils/constants';
import '../../styles/TicketsList.css';
import '../../styles/CRList.css';
import '../../styles/CRQueue.css';

// Status color map
const STATUS_COLORS = {
  DRAFT: { bg: '#f1f5f9', text: '#64748b' },
  SUBMITTED: { bg: '#dbeafe', text: '#2563eb' },
  UNDER_REVIEW: { bg: '#fef3c7', text: '#d97706' },
  PENDING_APPROVAL: { bg: '#fef9c3', text: '#ca8a04' },
  PENDING_INFO: { bg: '#ffe4e6', text: '#e11d48' },
  APPROVED: { bg: '#d1fae5', text: '#059669' },
  REJECTED: { bg: '#fecdd3', text: '#dc2626' },
  SCHEDULED: { bg: '#e0e7ff', text: '#4f46e5' },
  IN_PROGRESS: { bg: '#ddd6fe', text: '#7c3aed' },
  IMPLEMENTED: { bg: '#ccfbf1', text: '#0d9488' },
  CLOSED: { bg: '#e2e8f0', text: '#475569' },
  CANCELLED: { bg: '#f3f4f6', text: '#9ca3af' },
  ROLLED_BACK: { bg: '#fef2f2', text: '#b91c1c' },
};

const getStatusStyle = (code) => STATUS_COLORS[code] || STATUS_COLORS.DRAFT;

const RISK_CLASS = { LOW: 'cr-risk-low', MEDIUM: 'cr-risk-medium', HIGH: 'cr-risk-high', CRITICAL: 'cr-risk-critical' };

const RiskBadge = ({ level }) => level
  ? <span className={`cr-risk-badge ${RISK_CLASS[level] || 'cr-risk-medium'}`}>{level}</span>
  : null;

const PAGE_LIMIT = 15;

const QUEUE_TABS = [
  { key: 'all', label: 'All Assigned' },
  { key: 'review', label: 'Needs Review' },
  { key: 'approval', label: 'Needs Approval' },
  { key: 'implement', label: 'To Implement' },
];

const CRQueue = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [crs, setCRs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('DESC');

  // Pending approvals
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [approvalStats, setApprovalStats] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [approvalActions, setApprovalActions] = useState({}); // { [crId]: { loading, comment, showComment } }
  const [expandApprovals, setExpandApprovals] = useState(false);

  // Debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchQueue();
  }, [currentPage, sortBy, sortOrder, debouncedSearch, activeTab]);

  useEffect(() => {
    fetchApprovalData();
  }, []);

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const params = {
        page: currentPage,
        limit: PAGE_LIMIT,
        sort: sortBy,
        order: sortOrder,
        queue_mode: 'reviewer',
      };
      if (debouncedSearch) params.search = debouncedSearch;

      // Filter by tab
      if (activeTab === 'review') params.status = 'SUBMITTED,UNDER_REVIEW,PENDING_INFO';
      else if (activeTab === 'approval') params.status = 'PENDING_APPROVAL';
      else if (activeTab === 'implement') params.status = 'APPROVED,SCHEDULED,IN_PROGRESS';

      const res = await crService.list(params);
      if (res.data?.success) {
        setCRs(res.data.data.change_requests || res.data.data || []);
        const meta = res.data.meta;
        if (meta) {
          setTotalPages(meta.totalPages || 1);
          setTotalRecords(meta.totalRecords || 0);
        }
      }
    } catch (err) {
      toast.error('Failed to load CR queue');
    } finally {
      setLoading(false);
    }
  };

  const fetchApprovalData = async () => {
    try {
      const [pendingRes, statsRes] = await Promise.all([
        crService.getPendingApprovals().catch(() => ({ data: { data: [] } })),
        crService.getApprovalStats().catch(() => ({ data: { data: {} } })),
      ]);
      if (pendingRes.data?.data) setPendingApprovals(pendingRes.data.data);
      if (statsRes.data?.data) setApprovalStats(statsRes.data.data);
    } catch (err) {
      console.error('Failed to load approval data:', err);
    }
  };

  const handleSort = (col) => {
    if (sortBy === col) {
      setSortOrder(prev => prev === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(col);
      setSortOrder('ASC');
    }
    setCurrentPage(1);
  };

  const handleApprovalDecision = async (crId, decision) => {
    const comment = approvalActions[crId]?.comment || '';
    setApprovalActions(prev => ({ ...prev, [crId]: { ...prev[crId], loading: true } }));
    try {
      const res = await crService.decideApproval(crId, { decision, comments: comment });
      if (res.data?.success) {
        toast.success(res.data.message || `${decision} successfully`);
        fetchApprovalData();
        fetchQueue();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to ${decision.toLowerCase()}`);
    } finally {
      setApprovalActions(prev => ({ ...prev, [crId]: { loading: false, comment: '', showComment: false } }));
    }
  };

  const getProfilePictureUrl = (pic) => {
    if (!pic) return null;
    if (pic.startsWith('http://') || pic.startsWith('https://')) return pic;
    const base = API_BASE_URL.replace('/api/v1', '');
    const clean = pic.startsWith('/') ? pic : `/${pic}`;
    return `${base}${clean}`;
  };

  const formatDate = (d) => formatDateUtil ? formatDateUtil(d) : (d ? new Date(d).toLocaleDateString() : 'â€”');

  return (
    <div className="tickets-page">

      {/* â”€â”€ PAGE HEADER â”€â”€ */}
      <div className="page-header">
        <div className="header-left">
          <div className="page-title-wrapper">
            <div className="page-icon-wrapper" style={{ background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)' }}>
              <Shield size={28} />
            </div>
            <div>
              <h1 className="page-title">CR Queue</h1>
              <p className="page-subtitle">
                {totalRecords} assigned • {approvalStats.pending || 0} pending approval{approvalStats.pending !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
        <div className="header-right">
          <button
            className="btn-icon-action"
            onClick={() => { fetchQueue(); fetchApprovalData(); toast.info('Refreshing…'); }}
            disabled={loading}
            title="Refresh"
          >
            <RefreshCw size={18} className={loading ? 'spinning' : ''} />
          </button>
        </div>
      </div>

      {/* â”€â”€ QUEUE TABS â”€â”€ */}
      <div className="crq-tabs">
        {QUEUE_TABS.map(tab => (
          <button
            key={tab.key}
            className={`crq-tab${activeTab === tab.key ? ' crq-tab--active' : ''}`}
            onClick={() => { setActiveTab(tab.key); setCurrentPage(1); }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* â”€â”€ SEARCH BAR â”€â”€ */}
      <div className="filter-section">
        <div className="search-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="search-input-large"
            placeholder="Search by CR number, title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="search-clear-btn" onClick={() => setSearch('')}>
              <X size={16} />
            </button>
          )}
        </div>
        <span className="crq-result-count">
          {totalRecords} CR{totalRecords !== 1 ? 's' : ''}
        </span>
      </div>

      {/* â”€â”€ PENDING APPROVALS BANNER â”€â”€ */}
      {pendingApprovals.length > 0 && (
        <div className="crq-approval-section">
          <div
            className="crq-approval-banner"
            onClick={() => setExpandApprovals(prev => !prev)}
          >
            <AlertTriangle size={15} />
            <span>You have <strong>{pendingApprovals.length}</strong> change request(s) awaiting your approval decision.</span>
            <span className="crq-approval-toggle">
              {expandApprovals ? '▲ Collapse' : '▼ Expand'}
            </span>
          </div>

          {expandApprovals && (
            <div className="crq-approval-list">
              {pendingApprovals.map(pa => {
                const statusStyle = getStatusStyle(pa.status_code);
                const action = approvalActions[pa.cr_id] || {};
                return (
                  <div key={pa.approval_id} className="crq-approval-card">
                    <div className="crq-approval-card-top">
                      <span
                        className="ticket-number"
                        style={{ cursor: 'pointer' }}
                        onClick={() => navigate(`/cr/${pa.cr_id}`)}
                      >
                        {pa.cr_number}
                      </span>
                      <span className="crq-approval-title">{pa.title}</span>
                      <span
                        className="status-badge"
                        style={{ background: statusStyle.bg, color: statusStyle.text }}
                      >
                        {pa.status_name}
                      </span>
                      <RiskBadge level={pa.risk_level} />
                    </div>
                    <div className="crq-approval-meta">
                      <span>By: {pa.requester_name}</span>
                      <span>•</span>
                      <span>Type: {pa.type_name}</span>
                      <span>•</span>
                      <span>Role: {pa.approver_role}</span>
                    </div>
                    {action.showComment && (
                      <div className="crq-approval-comment">
                        <textarea
                          className="crq-approval-textarea"
                          value={action.comment || ''}
                          onChange={(e) => setApprovalActions(prev => ({ ...prev, [pa.cr_id]: { ...prev[pa.cr_id], comment: e.target.value } }))}
                          placeholder="Add a comment (optional)…"
                          rows={2}
                        />
                      </div>
                    )}
                    <div className="crq-approval-actions">
                      <button
                        className="btn-action-table crq-btn-approve"
                        onClick={() => handleApprovalDecision(pa.cr_id, 'APPROVED')}
                        disabled={action.loading}
                      >
                        {action.loading ? <Loader size={12} className="spinning" /> : <CheckCircle size={12} />}
                        Approve
                      </button>
                      <button
                        className="btn-action-table crq-btn-reject"
                        onClick={() => handleApprovalDecision(pa.cr_id, 'REJECTED')}
                        disabled={action.loading}
                      >
                        {action.loading ? <Loader size={12} className="spinning" /> : <XCircle size={12} />}
                        Reject
                      </button>
                      <button
                        className="btn-action-table crq-btn-comment"
                        onClick={() => setApprovalActions(prev => ({ ...prev, [pa.cr_id]: { ...prev[pa.cr_id], showComment: !prev[pa.cr_id]?.showComment } }))}
                      >
                        <MessageSquare size={12} /> Comment
                      </button>
                      <button
                        className="btn-action-table view"
                        onClick={() => navigate(`/cr/${pa.cr_id}`)}
                        title="View details"
                      >
                        <Eye size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* â”€â”€ TABLE â”€â”€ */}
      <div className="table-container">
        {loading ? (
          <div className="table-wrapper">
            <table className="tickets-table">
              <tbody>
                {Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j}><div className="cr-skeleton-cell" /></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : crs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon-wrapper">
              <Shield size={64} className="empty-icon" />
            </div>
            <h3>Queue is empty</h3>
            <p className="empty-description">No change requests assigned to you in this category</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="tickets-table">
              <thead>
                <tr>
                  <th className="sortable cr-th-number" onClick={() => handleSort('cr_number')}>
                    <div className="th-content">
                      <span>CR #</span>
                      {sortBy === 'cr_number' && <span className="sort-indicator">{sortOrder === 'ASC' ? <ChevronUp size={12} /> : <ChevronDown size={12} />}</span>}
                    </div>
                  </th>
                  <th className="sortable cr-th-title" onClick={() => handleSort('title')}>
                    <div className="th-content">
                      <span>Title</span>
                      {sortBy === 'title' && <span className="sort-indicator">{sortOrder === 'ASC' ? <ChevronUp size={12} /> : <ChevronDown size={12} />}</span>}
                    </div>
                  </th>
                  <th className="cr-th-type">Type</th>
                  <th className="cr-th-status">Status</th>
                  <th className="cr-th-risk">Risk</th>
                  <th className="sortable th-created" onClick={() => handleSort('created_at')}>
                    <div className="th-content">
                      <span>Created</span>
                      {sortBy === 'created_at' && <span className="sort-indicator">{sortOrder === 'ASC' ? <ChevronUp size={12} /> : <ChevronDown size={12} />}</span>}
                    </div>
                  </th>
                  <th className="th-requester">
                    <div className="th-content"><User size={12} /><span>Requester</span></div>
                  </th>
                  <th className="th-actions" />
                </tr>
              </thead>
              <tbody>
                {crs.map(cr => {
                  const statusStyle = getStatusStyle(cr.status_code);
                  return (
                    <tr
                      key={cr.cr_id}
                      className="ticket-row"
                      onClick={() => navigate(`/cr/${cr.cr_id}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <span className="ticket-number">{cr.cr_number}</span>
                      </td>
                      <td>
                        <div className="ticket-title-content">
                          <span className="ticket-title-link">{cr.title}</span>
                        </div>
                      </td>
                      <td>
                        <span className="category-badge">{cr.type_name || 'â€”'}</span>
                      </td>
                      <td>
                        <span
                          className="status-badge"
                          style={{ background: statusStyle.bg, color: statusStyle.text }}
                        >
                          {cr.status_name || cr.status_code}
                        </span>
                      </td>
                      <td><RiskBadge level={cr.risk_level} /></td>
                      <td>
                        <div className="date-info">
                          <span className="date-relative">{timeAgo(cr.created_at)}</span>
                          <span className="date-full">{formatDate(cr.created_at)}</span>
                        </div>
                      </td>
                      <td>
                        <div className="user-info" title={cr.requester_name}>
                          <div className="user-avatar">
                            {cr.requester_profile_picture ? (
                              <img
                                src={getProfilePictureUrl(cr.requester_profile_picture)}
                                alt={cr.requester_name}
                                className="avatar-image"
                                onError={(e) => { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'flex'; }}
                              />
                            ) : null}
                            <User size={14} style={{ display: cr.requester_profile_picture ? 'none' : 'flex' }} />
                          </div>
                          <span className="user-name">{cr.requester_name || 'â€”'}</span>
                        </div>
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <div className="action-buttons">
                          <button
                            className="btn-action-table view"
                            onClick={() => navigate(`/cr/${cr.cr_id}`)}
                            title="View CR"
                          >
                            <Eye size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* â”€â”€ PAGINATION â”€â”€ */}
      {!loading && totalPages > 1 && (
        <div className="pagination-container">
          <div className="pagination-info">
            Showing {((currentPage - 1) * PAGE_LIMIT) + 1}â€“{Math.min(currentPage * PAGE_LIMIT, totalRecords)} of {totalRecords}
          </div>
          <div className="pagination-buttons">
            <button
              className="btn-pagination"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              let page;
              if (totalPages <= 7) page = i + 1;
              else if (currentPage <= 4) page = i + 1;
              else if (currentPage >= totalPages - 3) page = totalPages - 6 + i;
              else page = currentPage - 3 + i;
              return (
                <button
                  key={page}
                  className={`btn-pagination${currentPage === page ? ' active' : ''}`}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </button>
              );
            })}
            <button
              className="btn-pagination"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CRQueue;

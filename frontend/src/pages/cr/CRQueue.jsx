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
  Loader,
  ArrowUpDown,
  Shield,
  X,
  CheckCircle,
  Clock,
  AlertTriangle,
  XCircle,
  MessageSquare,
} from 'lucide-react';
import crService from '../../services/crService';
import { formatDate as formatDateUtil, timeAgo } from '../../utils/dateUtils';
import '../../styles/CRList.css';

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

const RISK_COLORS = {
  LOW: { bg: '#d1fae5', text: '#059669' },
  MEDIUM: { bg: '#fef3c7', text: '#d97706' },
  HIGH: { bg: '#fee2e2', text: '#dc2626' },
  CRITICAL: { bg: '#fecdd3', text: '#991b1b' },
};
const getRiskStyle = (level) => RISK_COLORS[level] || RISK_COLORS.MEDIUM;

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

  return (
    <div className="cr-list-page">
      {/* Header */}
      <div className="cr-list-header">
        <div className="cr-list-header-left">
          <Shield size={24} className="cr-list-icon" />
          <div>
            <h1 className="cr-list-title">CR Queue</h1>
            <p className="cr-list-subtitle">
              {totalRecords} assigned • {approvalStats.pending || 0} pending approvals
            </p>
          </div>
        </div>
        <div className="cr-list-header-actions">
          <button className="btn-cr-action" onClick={() => { fetchQueue(); fetchApprovalData(); }} title="Refresh">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Queue Tabs */}
      <div className="cr-stat-tabs">
        {QUEUE_TABS.map(tab => (
          <button
            key={tab.key}
            className={`cr-stat-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => { setActiveTab(tab.key); setCurrentPage(1); }}
          >
            <span className="cr-stat-tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="cr-list-toolbar">
        <div className="cr-search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search by CR number, title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="cr-search-clear" onClick={() => setSearch('')}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Pending Approvals Section */}
      {pendingApprovals.length > 0 && (
        <div className="cr-approval-section">
          <div className="cr-approval-banner" onClick={() => setExpandApprovals(prev => !prev)} style={{ cursor: 'pointer' }}>
            <AlertTriangle size={16} />
            <span>You have <strong>{pendingApprovals.length}</strong> change request(s) awaiting your approval decision.</span>
            <span style={{ marginLeft: 'auto', fontSize: '12px' }}>{expandApprovals ? '▲ Collapse' : '▼ Expand'}</span>
          </div>
          {expandApprovals && (
            <div className="cr-approval-list" style={{ padding: '0 16px 16px' }}>
              {pendingApprovals.map(pa => {
                const statusStyle = getStatusStyle(pa.status_code);
                const riskStyle = getRiskStyle(pa.risk_level);
                const action = approvalActions[pa.cr_id] || {};
                return (
                  <div key={pa.approval_id} className="cr-approval-card" style={{
                    border: '1px solid var(--nx-border, #e2e8f0)',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    marginBottom: '8px',
                    background: 'var(--nx-bg-card, #fff)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      <span className="cr-number" style={{ cursor: 'pointer', fontWeight: 600 }} onClick={() => navigate(`/cr/${pa.cr_id}`)}>
                        {pa.cr_number}
                      </span>
                      <span style={{ flex: 1, fontWeight: 500 }}>{pa.title}</span>
                      <span className="cr-status-badge" style={{ background: statusStyle.bg, color: statusStyle.text }}>
                        {pa.status_name}
                      </span>
                      {pa.risk_level && (
                        <span className="cr-risk-badge" style={{ background: riskStyle.bg, color: riskStyle.text }}>
                          {pa.risk_level}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--nx-text-secondary, #64748b)' }}>
                      <span>By: {pa.requester_name}</span>
                      <span>•</span>
                      <span>Type: {pa.type_name}</span>
                      <span>•</span>
                      <span>Role: {pa.approver_role}</span>
                    </div>
                    {action.showComment && (
                      <div style={{ marginTop: '8px' }}>
                        <textarea
                          className="crd-modal-textarea"
                          style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--nx-border, #e2e8f0)', fontSize: '13px', resize: 'vertical', minHeight: '60px' }}
                          value={action.comment || ''}
                          onChange={(e) => setApprovalActions(prev => ({ ...prev, [pa.cr_id]: { ...prev[pa.cr_id], comment: e.target.value } }))}
                          placeholder="Add a comment (optional)..."
                          rows={2}
                        />
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                      <button
                        className="btn-cr-action"
                        style={{ background: '#059669', color: '#fff', padding: '6px 14px', borderRadius: '6px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}
                        onClick={() => handleApprovalDecision(pa.cr_id, 'APPROVED')}
                        disabled={action.loading}
                      >
                        {action.loading ? <Loader size={12} className="spinner" /> : <CheckCircle size={12} />} Approve
                      </button>
                      <button
                        className="btn-cr-action"
                        style={{ background: '#dc2626', color: '#fff', padding: '6px 14px', borderRadius: '6px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}
                        onClick={() => handleApprovalDecision(pa.cr_id, 'REJECTED')}
                        disabled={action.loading}
                      >
                        {action.loading ? <Loader size={12} className="spinner" /> : <XCircle size={12} />} Reject
                      </button>
                      <button
                        className="btn-cr-action"
                        style={{ background: 'transparent', color: 'var(--nx-text-secondary, #64748b)', padding: '6px 14px', borderRadius: '6px', fontSize: '13px', border: '1px solid var(--nx-border, #e2e8f0)', display: 'flex', alignItems: 'center', gap: '4px' }}
                        onClick={() => setApprovalActions(prev => ({ ...prev, [pa.cr_id]: { ...prev[pa.cr_id], showComment: !prev[pa.cr_id]?.showComment } }))}
                      >
                        <MessageSquare size={12} /> Comment
                      </button>
                      <button
                        className="btn-cr-action"
                        style={{ background: 'transparent', color: 'var(--nx-text-secondary, #64748b)', padding: '6px 14px', borderRadius: '6px', fontSize: '13px', border: '1px solid var(--nx-border, #e2e8f0)', display: 'flex', alignItems: 'center', gap: '4px' }}
                        onClick={() => navigate(`/cr/${pa.cr_id}`)}
                      >
                        <Eye size={12} /> View Details
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="cr-table-container">
        {loading ? (
          <div className="cr-loading">
            <Loader size={24} className="spinner" />
            <span>Loading queue...</span>
          </div>
        ) : crs.length === 0 ? (
          <div className="cr-empty">
            <CheckCircle size={48} />
            <h3>Queue is empty</h3>
            <p>No change requests assigned to you in this category</p>
          </div>
        ) : (
          <table className="cr-table">
            <thead>
              <tr>
                <th className="sortable" onClick={() => handleSort('cr_number')}>
                  CR # <ArrowUpDown size={12} />
                </th>
                <th className="sortable" onClick={() => handleSort('title')}>
                  Title <ArrowUpDown size={12} />
                </th>
                <th>Type</th>
                <th className="sortable" onClick={() => handleSort('status_code')}>
                  Status <ArrowUpDown size={12} />
                </th>
                <th>Risk</th>
                <th className="sortable" onClick={() => handleSort('created_at')}>
                  Created <ArrowUpDown size={12} />
                </th>
                <th>Requester</th>
                <th className="th-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {crs.map(cr => {
                const statusStyle = getStatusStyle(cr.status_code);
                const riskStyle = getRiskStyle(cr.risk_level);
                return (
                  <tr key={cr.cr_id} onClick={() => navigate(`/cr/${cr.cr_id}`)} className="cr-row-clickable">
                    <td className="cr-number-cell">
                      <span className="cr-number">{cr.cr_number}</span>
                    </td>
                    <td className="cr-title-cell">
                      <span className="cr-title-text">{cr.title}</span>
                    </td>
                    <td>
                      <span className="cr-type-badge">{cr.type_name || '—'}</span>
                    </td>
                    <td>
                      <span className="cr-status-badge" style={{ background: statusStyle.bg, color: statusStyle.text }}>
                        {cr.status_name || cr.status_code}
                      </span>
                    </td>
                    <td>
                      {cr.risk_level && (
                        <span className="cr-risk-badge" style={{ background: riskStyle.bg, color: riskStyle.text }}>
                          {cr.risk_level}
                        </span>
                      )}
                    </td>
                    <td className="cr-date-cell">
                      <span title={formatDateUtil(cr.created_at)}>{timeAgo(cr.created_at)}</span>
                    </td>
                    <td className="cr-requester-cell">
                      {cr.requester_name || '—'}
                    </td>
                    <td className="cr-actions-cell" onClick={(e) => e.stopPropagation()}>
                      <button className="btn-cr-view" onClick={() => navigate(`/cr/${cr.cr_id}`)} title="View">
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="cr-pagination">
          <span className="cr-pagination-info">
            Page {currentPage} of {totalPages} ({totalRecords} records)
          </span>
          <div className="cr-pagination-controls">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let page;
              if (totalPages <= 5) {
                page = i + 1;
              } else if (currentPage <= 3) {
                page = i + 1;
              } else if (currentPage >= totalPages - 2) {
                page = totalPages - 4 + i;
              } else {
                page = currentPage - 2 + i;
              }
              return (
                <button
                  key={page}
                  className={currentPage === page ? 'active' : ''}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </button>
              );
            })}
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CRQueue;

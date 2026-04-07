/**
 * ============================================
 * CHANGE REQUESTS LIST PAGE
 * ============================================
 * Unified CR list page — mirrors TicketsList.jsx pattern.
 *
 * FEATURES:
 * - "Created by Me" and "Assigned to Me" bucket buttons for IT Staff
 * - Role-based view: IT Staff sees all CRs; Normal Users see their own
 * - Search, filter (status, risk, type), sort, pagination
 * - Export to CSV
 * - Create CR button
 * ============================================
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  GitPullRequest,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Download,
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle,
  Eye,
  User,
  Tag,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react';
import crService from '../../services/crService';
import { formatDate as formatDateUtil, timeAgo } from '../../utils/dateUtils';
import { useToast } from '../../context/ToastContext';
import '../../styles/TicketsList.css';
import '../../styles/CRList.css';

const ChangeRequests = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const roleCode = user?.role?.role_code || '';

  // Is IT Staff (can see all CRs / bucket buttons)
  const isITStaff =
    user?.permissions?.can_view_all_cr ||
    user?.permissions?.can_approve_cr ||
    user?.permissions?.can_implement_cr ||
    user?.permissions?.can_manage_cr_settings ||
    ['ADMIN', 'MANAGER', 'CENTRAL_MGMT'].includes(roleCode);

  // Normal user: can create CR but not IT staff
  const isNormalUser = !isITStaff;

  // ==========================================
  // BUCKET STATE
  // ==========================================
  const [activeBucket, setActiveBucket] = useState(null);
  const [bucketStats, setBucketStats] = useState({ created: 0, assigned: 0 });
  const [bucketLoading, setBucketLoading] = useState(false);
  const bucketStatsCache = useRef({ data: null, timestamp: 0 });
  const CACHE_DURATION = 30000;

  // ==========================================
  // LIST STATE
  // ==========================================
  const [crs, setCRs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [limit] = useState(15);

  // Filters
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    risk_level: '',
    type: '',
  });
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Lookup data
  const [crStatuses, setCRStatuses] = useState([]);
  const [crTypes, setCRTypes] = useState([]);

  // Sorting
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('DESC');

  // ==========================================
  // DEBOUNCE SEARCH
  // ==========================================
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search), 300);
    return () => clearTimeout(timer);
  }, [filters.search]);

  // ==========================================
  // INITIAL LOAD
  // ==========================================
  useEffect(() => {
    fetchLookups();
    if (isITStaff) fetchBucketStats();
  }, []);

  useEffect(() => {
    fetchCRs();
  }, [currentPage, sortBy, sortOrder, debouncedSearch, activeBucket,
    filters.status, filters.risk_level, filters.type]);

  // ==========================================
  // FETCH LOOKUPS
  // ==========================================
  const fetchLookups = async () => {
    try {
      const res = await crService.getLookups();
      if (res.data?.success) {
        const d = res.data.data;
        setCRStatuses(d.statuses || []);
        setCRTypes(d.types || []);
      }
    } catch { /* silent */ }
  };

  // ==========================================
  // FETCH BUCKET STATS
  // ==========================================
  const fetchBucketStats = useCallback(async (forceRefresh = false) => {
    const now = Date.now();
    if (!forceRefresh && bucketStatsCache.current.data &&
      (now - bucketStatsCache.current.timestamp) < CACHE_DURATION) {
      setBucketStats(bucketStatsCache.current.data);
      return;
    }
    setBucketLoading(true);
    try {
      const res = await crService.getStats();
      if (res.data?.success) {
        const s = res.data.data.summary || {};
        const newStats = { created: s.my_created || 0, assigned: s.my_assigned || 0 };
        bucketStatsCache.current = { data: newStats, timestamp: now };
        setBucketStats(newStats);
      }
    } catch { /* silent */ }
    finally { setBucketLoading(false); }
  }, []);

  // ==========================================
  // FETCH CRs
  // ==========================================
  const fetchCRs = async () => {
    try {
      setLoading(true);
      setError('');

      const params = {
        page: currentPage,
        limit,
        sort: sortBy,
        order: sortOrder,
      };

      if (debouncedSearch) params.search = debouncedSearch;
      if (filters.status) params.status = filters.status;
      if (filters.risk_level) params.risk_level = filters.risk_level;
      if (filters.type) params.type = filters.type;

      // Bucket filtering
      if (activeBucket === 'created') {
        params.requester_id = user?.user_id;
      } else if (activeBucket === 'assigned') {
        params.assigned_to = user?.user_id;
      } else if (isNormalUser) {
        // Normal user: show only their CRs (backend also enforces this)
        params.requester_id = user?.user_id;
      }

      const res = await crService.list(params);
      if (res.data?.success) {
        const items = Array.isArray(res.data.data) ? res.data.data : (res.data.data?.change_requests || []);
        const meta = res.data.meta || {};
        setCRs(items);
        setTotalRecords(meta.totalRecords || items.length);
        setTotalPages(meta.totalPages || 1);
      }
    } catch (err) {
      setError('Failed to load change requests');
      toast.error('Failed to load change requests');
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // HANDLERS
  // ==========================================
  const handleBucketChange = (bucket) => {
    setActiveBucket(activeBucket === bucket ? null : bucket);
    setCurrentPage(1);
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({ search: '', status: '', risk_level: '', type: '' });
    setCurrentPage(1);
  };

  const handleSort = (field) => {
    if (sortBy === field) setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    else { setSortBy(field); setSortOrder('DESC'); }
  };

  const getActiveFilterCount = () => Object.values(filters).filter(v => v !== '').length;

  // ==========================================
  // EXPORT CSV
  // ==========================================
  const exportCSV = () => {
    if (!crs.length) { toast.warning('No data to export'); return; }
    const headers = ['CR Number', 'Title', 'Status', 'Risk', 'Type', 'Requester', 'Assigned To', 'Created At'];
    const rows = crs.map(cr => [
      cr.cr_number || '',
      (cr.title || '').replace(/"/g, '""'),
      cr.status_code || '',
      cr.risk_level || '',
      cr.type_name || '',
      cr.requester_name || '',
      cr.assigned_to_name || 'Unassigned',
      formatDate(cr.created_at),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `change-requests-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${crs.length} change requests`);
  };

  // ==========================================
  // HELPERS
  // ==========================================
  const formatDate = (d) => formatDateUtil ? formatDateUtil(d) : (d ? new Date(d).toLocaleDateString() : '—');

  const getStatusStyle = (code) => {
    const map = {
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
    };
    return map[code] || { bg: '#f3f4f6', text: '#6b7280' };
  };

  const getRiskClass = (level) => ({
    LOW: 'cr-risk-low', MEDIUM: 'cr-risk-medium', HIGH: 'cr-risk-high', CRITICAL: 'cr-risk-critical',
  }[level] || 'cr-risk-medium');

  const getPageTitle = () => {
    if (activeBucket === 'created') return 'My Created CRs';
    if (activeBucket === 'assigned') return 'Assigned to Me';
    return 'Change Requests';
  };

  // ==========================================
  // RENDER
  // ==========================================
  return (
    <div className="tickets-page">

      {/* ── PAGE HEADER ── */}
      <div className="page-header">
        <div className="header-left">
          <div className="page-title-wrapper">
            <div className="page-icon-wrapper">
              <GitPullRequest size={28} />
            </div>
            <div>
              <h1 className="page-title">{getPageTitle()}</h1>
              <p className="page-subtitle">
                {totalRecords > 0
                  ? `${totalRecords} change request${totalRecords !== 1 ? 's' : ''} found`
                  : 'No change requests available'}
              </p>
            </div>
          </div>
        </div>

        {/* ── ANIMATED BUCKET BUTTONS (IT Staff only) ── */}
        {isITStaff && (
          <div className="tl-mini-buckets">
            {/* Created by Me */}
            <div
              className={`tl-mini-bucket tl-mini-created ${activeBucket === 'created' ? 'active' : ''}`}
              onClick={() => handleBucketChange('created')}
              title="Created by Me"
            >
              <div className="tl-mini-bucket-body">
                <div
                  className="tl-mini-bucket-fill"
                  style={{ height: `${Math.min((bucketStats.created / 30) * 100, 100)}%` }}
                />
                <div className="tl-mini-bucket-shine" />
              </div>
              <div className="tl-mini-bucket-info">
                <span className="tl-mini-count">{bucketLoading ? '...' : bucketStats.created}</span>
                <span className="tl-mini-label">Created by Me</span>
              </div>
              {activeBucket === 'created' && (
                <div className="tl-mini-check"><CheckCircle size={14} /></div>
              )}
            </div>

            {/* Assigned to Me */}
            <div
              className={`tl-mini-bucket tl-mini-assigned ${activeBucket === 'assigned' ? 'active' : ''}`}
              onClick={() => handleBucketChange('assigned')}
              title="Assigned to Me"
            >
              <div className="tl-mini-bucket-body">
                <div
                  className="tl-mini-bucket-fill"
                  style={{ height: `${Math.min((bucketStats.assigned / 20) * 100, 100)}%` }}
                />
                <div className="tl-mini-bucket-shine" />
              </div>
              <div className="tl-mini-bucket-info">
                <span className="tl-mini-count">{bucketLoading ? '...' : bucketStats.assigned}</span>
                <span className="tl-mini-label">Assigned to Me</span>
              </div>
              {activeBucket === 'assigned' && (
                <div className="tl-mini-check"><CheckCircle size={14} /></div>
              )}
            </div>
          </div>
        )}

        {/* ── HEADER ACTIONS ── */}
        <div className="header-right">
          <button
            className="btn-icon-action"
            onClick={() => { fetchCRs(); if (isITStaff) fetchBucketStats(true); toast.info('Refreshing...'); }}
            disabled={loading}
            title="Refresh"
          >
            <RefreshCw size={18} className={loading ? 'spinning' : ''} />
          </button>
          <button
            className="btn-icon-action"
            onClick={exportCSV}
            disabled={loading || !crs.length}
            title="Export CSV"
          >
            <Download size={18} />
          </button>
          {user?.permissions?.can_create_cr && (
            <button className="btn-primary-action" onClick={() => navigate('/cr/create')}>
              <Plus size={20} />
              <span>New CR</span>
            </button>
          )}
        </div>
      </div>

      {/* ── SEARCH & FILTER BAR ── */}
      <div className="filter-section">
        <div className="search-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search by CR number, title..."
            className="search-input-large"
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
          />
          {filters.search && (
            <button className="search-clear-btn" onClick={() => handleFilterChange('search', '')}>
              <X size={16} />
            </button>
          )}
        </div>

        <div className="filter-actions">
          <button
            className={`btn-filter ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={18} />
            <span>Filters</span>
            {getActiveFilterCount() > 0 && (
              <span className="filter-count">{getActiveFilterCount()}</span>
            )}
          </button>
          {getActiveFilterCount() > 0 && (
            <button className="btn-clear-filters" onClick={clearFilters}>
              <X size={16} />
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* ── FILTERS PANEL ── */}
      {showFilters && (
        <div className="filters-panel">
          <div className="filters-grid">
            <div className="filter-item">
              <label className="filter-label"><Tag size={14} /> Status</label>
              <select
                className="filter-select"
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
              >
                <option value="">All Statuses</option>
                {crStatuses.map(s => (
                  <option key={s.status_id} value={s.status_code}>{s.status_name}</option>
                ))}
              </select>
            </div>
            <div className="filter-item">
              <label className="filter-label"><AlertTriangle size={14} /> Risk Level</label>
              <select
                className="filter-select"
                value={filters.risk_level}
                onChange={(e) => handleFilterChange('risk_level', e.target.value)}
              >
                <option value="">All Risk Levels</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
            <div className="filter-item">
              <label className="filter-label"><GitPullRequest size={14} /> CR Type</label>
              <select
                className="filter-select"
                value={filters.type}
                onChange={(e) => handleFilterChange('type', e.target.value)}
              >
                <option value="">All Types</option>
                {crTypes.map(t => (
                  <option key={t.type_id} value={t.type_code}>{t.type_name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ── ERROR BANNER ── */}
      {error && (
        <div className="alert alert-error">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button className="alert-close" onClick={() => setError('')}><X size={16} /></button>
        </div>
      )}

      {/* ── TABLE ── */}
      <div className="table-container">
        {loading ? (
          <div className="table-wrapper">
            <table className="tickets-table">
              <tbody>
                {Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: isITStaff ? 9 : 8 }).map((_, j) => (
                      <td key={j}>
                        <div className="cr-skeleton-cell" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : crs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon-wrapper">
              <GitPullRequest size={64} className="empty-icon" />
            </div>
            <h3>No change requests found</h3>
            <p className="empty-description">
              {getActiveFilterCount() > 0
                ? 'No CRs match your current filters.'
                : activeBucket
                ? 'No CRs in this view.'
                : 'Create your first change request.'}
            </p>
            {user?.permissions?.can_create_cr && !activeBucket && (
              <button className="btn-primary-action" onClick={() => navigate('/cr/create')}>
                <Plus size={20} /><span>New CR</span>
              </button>
            )}
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="tickets-table">
              <thead>
                <tr>
                  <th className="sortable cr-th-number" onClick={() => handleSort('cr_number')}>
                    <div className="th-content">
                      <span>CR #</span>
                      {sortBy === 'cr_number' && <span className="sort-indicator">{sortOrder === 'ASC' ? '↑' : '↓'}</span>}
                    </div>
                  </th>
                  <th className="sortable cr-th-title" onClick={() => handleSort('title')}>
                    <div className="th-content">
                      <span>Title</span>
                      {sortBy === 'title' && <span className="sort-indicator">{sortOrder === 'ASC' ? '↑' : '↓'}</span>}
                    </div>
                  </th>
                  <th className="cr-th-status">Status</th>
                  <th className="cr-th-risk">Risk</th>
                  <th className="cr-th-type">Type</th>
                  <th className="th-requester">
                    <div className="th-content"><User size={12} /><span>Requester</span></div>
                  </th>
                  {isITStaff && (
                    <th className="th-assigned">
                      <div className="th-content"><User size={12} /><span>Assigned To</span></div>
                    </th>
                  )}
                  <th className="sortable th-created" onClick={() => handleSort('created_at')}>
                    <div className="th-content">
                      <span>Created</span>
                      {sortBy === 'created_at' && <span className="sort-indicator">{sortOrder === 'ASC' ? '↑' : '↓'}</span>}
                    </div>
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
                      onClick={() => navigate(`/cr/${cr.cr_id}`)}
                    >
                      {/* CR Number */}
                      <td>
                        <span className="ticket-number">{cr.cr_number}</span>
                      </td>

                      {/* Title */}
                      <td className="title-cell">
                        <div className="ticket-title-content">
                          <span className="ticket-title-link">{cr.title || '—'}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td>
                        <span
                          className="status-badge"
                          style={{ background: statusStyle.bg, color: statusStyle.text }}
                        >
                          {cr.status_name || cr.status_code}
                        </span>
                      </td>

                      {/* Risk */}
                      <td>
                        {cr.risk_level ? (
                          <span className={`cr-risk-badge ${getRiskClass(cr.risk_level)}`}>
                            {cr.risk_level}
                          </span>
                        ) : <span className="text-muted">—</span>}
                      </td>

                      {/* Type */}
                      <td>
                        <span className="category-badge">{cr.type_name || '—'}</span>
                      </td>

                      {/* Requester */}
                      <td>
                        <div className="user-info">
                          <div className="user-avatar"><User size={14} /></div>
                          <span className="user-name">{cr.requester_name || '—'}</span>
                        </div>
                      </td>

                      {/* Assigned To (IT Staff only) */}
                      {isITStaff && (
                        <td>
                          {cr.assigned_to_name ? (
                            <div className="user-info">
                              <div className="user-avatar assigned"><User size={14} /></div>
                              <span className="user-name">{cr.assigned_to_name}</span>
                            </div>
                          ) : (
                            <span className="text-muted">Unassigned</span>
                          )}
                        </td>
                      )}

                      {/* Created */}
                      <td>
                        <div className="date-info">
                          <span className="date-relative">{timeAgo(cr.created_at)}</span>
                          <span className="date-full">{formatDate(cr.created_at)}</span>
                        </div>
                      </td>

                      {/* View Action */}
                      <td className="actions-cell" onClick={(e) => { e.stopPropagation(); navigate(`/cr/${cr.cr_id}`); }}>
                        <div className="action-buttons">
                          <button className="btn-action-table view" title="View CR">
                            <Eye size={15} />
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

        {/* ── PAGINATION ── */}
        {!loading && totalPages > 1 && (
          <div className="pagination-container">
            <p className="pagination-info">
              Showing{' '}
              <strong>{(currentPage - 1) * limit + 1}–{Math.min(currentPage * limit, totalRecords)}</strong>{' '}
              of <strong>{totalRecords}</strong> change requests
            </p>
            <div className="pagination-controls">
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
                  if (totalPages <= 7) {
                    page = i + 1;
                  } else if (currentPage <= 4) {
                    page = i + 1;
                  } else if (currentPage >= totalPages - 3) {
                    page = totalPages - 6 + i;
                  } else {
                    page = currentPage - 3 + i;
                  }
                  return (
                    <button
                      key={page}
                      className={`btn-pagination ${currentPage === page ? 'active' : ''}`}
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
          </div>
        )}
      </div>
    </div>
  );
};

export default ChangeRequests;

/**
 * ============================================
 * CR LIST PAGE - ALL CHANGE REQUESTS
 * ============================================
 * Full table view with filters, sorting, pagination.
 * Mirrors TicketsList pattern.
 * ============================================
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  Plus,
  Search,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Clock,
  CheckCircle,
  Eye,
  Calendar,
  X,
  ArrowUpDown,
  Shield,
  Loader,
} from 'lucide-react';
import crService from '../../services/crService';
import { formatDate as formatDateUtil, timeAgo } from '../../utils/dateUtils';
import '../../styles/CRList.css';

// ============================================
// HELPERS
// ============================================
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

const RISK_COLORS = {
  LOW: { bg: '#d1fae5', text: '#059669' },
  MEDIUM: { bg: '#fef3c7', text: '#d97706' },
  HIGH: { bg: '#fee2e2', text: '#dc2626' },
  CRITICAL: { bg: '#fecdd3', text: '#991b1b' },
};

const getStatusStyle = (code) => STATUS_COLORS[code] || STATUS_COLORS.DRAFT;
const getRiskStyle = (level) => RISK_COLORS[level] || RISK_COLORS.MEDIUM;

const PAGE_LIMIT = 15;

// ============================================
// MAIN COMPONENT
// ============================================
const CRList = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();

  // State
  const [crs, setCRs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Filters
  const [filters, setFilters] = useState({
    search: '',
    status: searchParams.get('status') || '',
    cr_type_id: searchParams.get('type') || '',
    risk_level: searchParams.get('risk') || '',
    priority_id: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Sorting
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('DESC');

  // Lookups
  const [lookups, setLookups] = useState({ types: [], categories: [], statuses: [] });

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search), 300);
    return () => clearTimeout(timer);
  }, [filters.search]);

  // Fetch lookups on mount
  useEffect(() => {
    fetchLookups();
  }, []);

  // Fetch CRs when params change
  useEffect(() => {
    fetchCRs();
  }, [currentPage, sortBy, sortOrder, debouncedSearch, filters.status, filters.cr_type_id, filters.risk_level, filters.priority_id]);

  const fetchLookups = async () => {
    try {
      const res = await crService.getLookups();
      if (res.data?.success) setLookups(res.data.data);
    } catch (err) {
      console.error('Failed to load CR lookups:', err);
    }
  };

  const fetchCRs = async () => {
    try {
      setLoading(true);
      const params = {
        page: currentPage,
        limit: PAGE_LIMIT,
        sort_by: sortBy,
        sort_order: sortOrder,
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (filters.status) params.status = filters.status;
      if (filters.cr_type_id) params.cr_type_id = filters.cr_type_id;
      if (filters.risk_level) params.risk_level = filters.risk_level;
      if (filters.priority_id) params.priority_id = filters.priority_id;

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
      toast.error('Failed to load change requests');
    } finally {
      setLoading(false);
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

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({ search: '', status: '', cr_type_id: '', risk_level: '', priority_id: '' });
    setCurrentPage(1);
  };

  const hasActiveFilters = filters.status || filters.cr_type_id || filters.risk_level || filters.priority_id;

  return (
    <div className="cr-list-page">
      {/* Header */}
      <div className="cr-list-header">
        <div className="cr-list-header-left">
          <Shield size={24} className="cr-list-icon" />
          <div>
            <h1 className="cr-list-title">Change Requests</h1>
            <p className="cr-list-subtitle">{totalRecords} total change requests</p>
          </div>
        </div>
        <div className="cr-list-header-actions">
          <button className="btn-cr-action" onClick={fetchCRs} title="Refresh">
            <RefreshCw size={16} />
          </button>
          {user?.permissions?.can_create_cr && (
            <button className="btn-cr-primary" onClick={() => navigate('/cr/create')}>
              <Plus size={16} />
              <span>New CR</span>
            </button>
          )}
        </div>
      </div>

      {/* Search & Filters */}
      <div className="cr-list-toolbar">
        <div className="cr-search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search by CR number, title..."
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
          />
          {filters.search && (
            <button className="cr-search-clear" onClick={() => handleFilterChange('search', '')}>
              <X size={14} />
            </button>
          )}
        </div>
        <button className={`btn-cr-filter ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(!showFilters)}>
          <Filter size={16} />
          <span>Filters</span>
          {hasActiveFilters && <span className="filter-badge" />}
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="cr-filter-panel">
          <div className="cr-filter-row">
            <div className="cr-filter-group">
              <label>Status</label>
              <select value={filters.status} onChange={(e) => handleFilterChange('status', e.target.value)}>
                <option value="">All Statuses</option>
                {lookups.statuses.map(s => (
                  <option key={s.status_id} value={s.status_code}>{s.status_name}</option>
                ))}
              </select>
            </div>
            <div className="cr-filter-group">
              <label>Type</label>
              <select value={filters.cr_type_id} onChange={(e) => handleFilterChange('cr_type_id', e.target.value)}>
                <option value="">All Types</option>
                {lookups.types.map(t => (
                  <option key={t.type_id} value={t.type_id}>{t.type_name}</option>
                ))}
              </select>
            </div>
            <div className="cr-filter-group">
              <label>Risk Level</label>
              <select value={filters.risk_level} onChange={(e) => handleFilterChange('risk_level', e.target.value)}>
                <option value="">All Risks</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
            {hasActiveFilters && (
              <button className="btn-cr-clear-filters" onClick={clearFilters}>
                <X size={14} /> Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="cr-table-container">
        {loading ? (
          <div className="cr-loading">
            <Loader size={24} className="spinner" />
            <span>Loading change requests...</span>
          </div>
        ) : crs.length === 0 ? (
          <div className="cr-empty">
            <Shield size={48} />
            <h3>No change requests found</h3>
            <p>Try adjusting your filters or create a new CR</p>
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

export default CRList;

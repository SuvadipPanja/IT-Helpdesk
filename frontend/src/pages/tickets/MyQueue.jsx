/**
 * ============================================
 * MY QUEUE PAGE - ENGINEER'S ACTIVE WORK LIST
 * ============================================
 * Shows all non-final tickets assigned to the
 * currently logged-in engineer.
 *
 * FEATURES:
 * - Fetches assigned open tickets (exclude_final=1)
 * - Search by ticket# / subject
 * - Sort by multiple columns
 * - Pagination
 * - SLA indicators (Overdue / At Risk)
 * - Navigate to ticket detail
 *
 * Developer: Suvadip Panja
 * Company: Digitide
 * Created: 2026
 * ============================================
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  ListChecks,
  Search,
  RefreshCw,
  Eye,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Tag,
  X,
  Loader,
  ArrowUpDown,
  Circle,
  ArrowLeft
} from 'lucide-react';
import api from '../../services/api';
import { API_BASE_URL } from '../../utils/constants';
import { formatDate as formatDateUtil } from '../../utils/dateUtils';
import '../../styles/TicketBucket.css';

// ============================================
// CONSTANTS
// ============================================
const PAGE_LIMIT = 15;

// ============================================
// HELPERS
// ============================================
const getPriorityBadgeClass = (priorityCode) => {
  switch ((priorityCode || '').toUpperCase()) {
    case 'CRITICAL': return 'tb-priority-critical';
    case 'HIGH':     return 'tb-priority-high';
    case 'MEDIUM':   return 'tb-priority-medium';
    case 'LOW':      return 'tb-priority-low';
    default:         return 'tb-priority-medium';
  }
};

const getProfilePictureUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const base = API_BASE_URL?.replace('/api/v1', '') || '';
  return `${base}${path}`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  return formatDateUtil(dateStr);
};

// ============================================
// MAIN COMPONENT
// ============================================
const MyQueue = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  // ---- State ----
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState('due_date');
  const [sortOrder, setSortOrder] = useState('ASC');
  const debounceTimer = useRef(null);

  // ---- Debounce search ----
  useEffect(() => {
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(debounceTimer.current);
  }, [search]);

  // ---- Fetch ----
  const fetchQueue = useCallback(async () => {
    if (!user?.user_id) return;
    setLoading(true);
    setError('');
    try {
      const params = {
        assigned_to: user.user_id,
        exclude_final: '1',
        page: currentPage,
        limit: PAGE_LIMIT,
        sortBy,
        sortOrder
      };
      if (debouncedSearch) params.search = debouncedSearch;

      const res = await api.get('/tickets', { params });
      const data = res.data?.data;
      setTickets(data?.tickets || []);
      setTotal(data?.pagination?.totalRecords || 0);
      setTotalPages(data?.pagination?.totalPages || 1);
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to load queue';
      setError(msg);
      if (process.env.NODE_ENV === 'development') console.error('MyQueue fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.user_id, currentPage, debouncedSearch, sortBy, sortOrder]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // ---- Sort handler ----
  const handleSort = (col) => {
    if (sortBy === col) {
      setSortOrder(prev => prev === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(col);
      setSortOrder('ASC');
    }
    setCurrentPage(1);
  };

  // ---- SortIcon ----
  const SortIcon = ({ col }) =>
    sortBy === col ? <ArrowUpDown size={14} style={{ color: '#6366f1' }} /> : <ArrowUpDown size={14} style={{ opacity: 0.3 }} />;

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="tb-page">
      {/* Header */}
      <div className="tb-header">
        <div className="tb-header-left">
          <button
            className="tb-btn-icon"
            onClick={() => navigate('/tickets')}
            title="Back to Tickets"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="tb-header-icon">
            <ListChecks size={22} />
          </div>
          <div>
            <h1 className="tb-title">My Queue</h1>
            <p className="tb-subtitle">
              {loading ? 'Loading...' : `${total} open ticket${total !== 1 ? 's' : ''} assigned to you`}
            </p>
          </div>
        </div>
        <div className="tb-header-right">
          <button
            className="tb-btn-icon"
            onClick={() => { fetchQueue(); toast.info('Refreshing queue...'); }}
            disabled={loading}
            title="Refresh"
          >
            <RefreshCw size={18} className={loading ? 'tb-spinning' : ''} />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="tb-filter-bar">
        <div className="tb-search-wrapper">
          <Search size={18} className="tb-search-icon" />
          <input
            type="text"
            placeholder="Search by ticket #, subject..."
            className="tb-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="tb-search-clear" onClick={() => setSearch('')}>
              <X size={16} />
            </button>
          )}
        </div>
        <div className="tb-result-count">
          <span>{total} ticket{total !== 1 ? 's' : ''} in your queue</span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="tb-error">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={fetchQueue}>Retry</button>
        </div>
      )}

      {/* Loading */}
      {loading && !error && (
        <div className="tb-loading">
          <Loader size={32} className="tb-spinning" />
          <span>Loading your queue...</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && tickets.length === 0 && (
        <div className="tb-empty">
          <CheckCircle size={48} style={{ color: '#22c55e' }} />
          <h3>Queue Clear!</h3>
          <p>You have no open tickets assigned to you.</p>
          <button onClick={() => navigate('/ticket-bucket')} className="tb-btn-secondary">
            Browse Open Bucket
          </button>
        </div>
      )}

      {/* Table */}
      {!loading && !error && tickets.length > 0 && (
        <div className="tb-table-container">
          <table className="tb-table">
            <thead>
              <tr>
                <th className="tb-col-ticket" onClick={() => handleSort('ticket_number')} style={{ cursor: 'pointer' }}>
                  <span>Ticket #</span> <SortIcon col="ticket_number" />
                </th>
                <th className="tb-col-subject" onClick={() => handleSort('subject')} style={{ cursor: 'pointer' }}>
                  <span>Subject</span> <SortIcon col="subject" />
                </th>
                <th className="tb-col-status">Status</th>
                <th className="tb-col-priority" onClick={() => handleSort('priority_id')} style={{ cursor: 'pointer' }}>
                  <span>Priority</span> <SortIcon col="priority_id" />
                </th>
                <th className="tb-col-requester">Requester</th>
                <th className="tb-col-date" onClick={() => handleSort('due_date')} style={{ cursor: 'pointer' }}>
                  <span>Due / SLA</span> <SortIcon col="due_date" />
                </th>
                <th className="tb-col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map(ticket => (
                <tr key={ticket.ticket_id} className="tb-row">
                  {/* Ticket # */}
                  <td className="tb-col-ticket">
                    <span className="tb-ticket-number">{ticket.ticket_number}</span>
                  </td>

                  {/* Subject */}
                  <td className="tb-col-subject">
                    <div className="tb-subject-cell">
                      <span className="tb-subject-text" title={ticket.subject}>{ticket.subject}</span>
                      {ticket.category_name && (
                        <span className="tb-category-tag">
                          <Tag size={11} />{ticket.category_name}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="tb-col-status">
                    <span
                      className="tb-status-badge"
                      style={
                        ticket.status_color
                          ? {
                              background: ticket.status_color + '22',
                              color: ticket.status_color,
                              border: `1px solid ${ticket.status_color}44`
                            }
                          : {}
                      }
                    >
                      <Circle size={7} fill="currentColor" />
                      {ticket.status_name || ticket.status_code || '—'}
                    </span>
                  </td>

                  {/* Priority */}
                  <td className="tb-col-priority">
                    <span className={`tb-priority-badge ${getPriorityBadgeClass(ticket.priority_code)}`}>
                      {ticket.priority_name || 'Normal'}
                    </span>
                  </td>

                  {/* Requester */}
                  <td className="tb-col-requester">
                    <div className="tb-requester-cell">
                      {ticket.requester_profile_picture ? (
                        <img
                          src={getProfilePictureUrl(ticket.requester_profile_picture)}
                          alt=""
                          className="tb-requester-avatar"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        <div className="tb-requester-avatar-placeholder">
                          {(ticket.requester_name || 'U')[0]}
                        </div>
                      )}
                      <span className="tb-requester-name">{ticket.requester_name || 'Unknown'}</span>
                    </div>
                  </td>

                  {/* Due / SLA */}
                  <td className="tb-col-date">
                    <div className="tb-date-cell">
                      {ticket.due_date ? (
                        <>
                          <span className={`tb-date-text ${ticket.sla_status === 'breached' ? 'tb-overdue' : ''}`}>
                            {formatDate(ticket.due_date)}
                          </span>
                          {ticket.sla_status === 'breached' && (
                            <span className="tb-sla-badge tb-sla-breached">Overdue</span>
                          )}
                          {ticket.sla_status === 'warning' && (
                            <span className="tb-sla-badge tb-sla-warning">At Risk</span>
                          )}
                        </>
                      ) : (
                        <span className="tb-date-text">—</span>
                      )}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="tb-col-actions">
                    <button
                      className="tb-btn-view"
                      onClick={() => navigate(`/tickets/${ticket.ticket_id}`)}
                      title="View Ticket"
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="tb-pagination">
          <div className="tb-pagination-info">
            Showing {((currentPage - 1) * PAGE_LIMIT) + 1} to {Math.min(currentPage * PAGE_LIMIT, total)} of {total} tickets
          </div>
          <div className="tb-pagination-controls">
            <button
              className="tb-page-btn"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft size={18} />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let p;
              if (totalPages <= 5) p = i + 1;
              else if (currentPage <= 3) p = i + 1;
              else if (currentPage >= totalPages - 2) p = totalPages - 4 + i;
              else p = currentPage - 2 + i;
              return (
                <button
                  key={p}
                  className={`tb-page-btn ${currentPage === p ? 'active' : ''}`}
                  onClick={() => setCurrentPage(p)}
                >
                  {p}
                </button>
              );
            })}
            <button
              className="tb-page-btn"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyQueue;

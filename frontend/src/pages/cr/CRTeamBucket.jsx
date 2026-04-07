/**
 * ============================================
 * CR TEAM BUCKET PAGE
 * ============================================
 * Team-scoped CR queue â€” mirrors TeamBucket.jsx.
 *
 * CENTRAL TEAM (TCC) view:
 *   - Sees CRs routed to central team
 *   - Can route CRs to specialist teams
 *
 * SPECIALIST TEAM view:
 *   - Sees CRs routed to their team
 *   - Engineers can self-assign
 *
 * ADMIN / MANAGER:
 *   - See any team bucket (team selector)
 *   - Can route CRs
 * ============================================
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  FolderKanban,
  Search,
  RefreshCw,
  Eye,
  UserPlus,
  ArrowRight,
  X,
  Loader,
  AlertCircle,
  CheckCircle,
  Crown,
  ChevronLeft,
  ChevronRight,
  Building2,
  Info,
  GitPullRequest,
  AlertTriangle,
  Calendar,
  User,
} from 'lucide-react';
import api from '../../services/api';
import { formatDate as formatDateUtil, timeAgo } from '../../utils/dateUtils';
import { API_BASE_URL } from '../../utils/constants';
import '../../styles/TicketsList.css';
import '../../styles/CRList.css';
import '../../styles/CRTeamBucket.css';

// =============================================
// ROUTE CR MODAL
// =============================================
const RouteCRModal = ({ cr, teams, onClose, onRoute }) => {
  const [targetTeamId, setTargetTeamId] = useState('');
  const [routing, setRouting] = useState(false);
  const [error, setError] = useState('');

  const otherTeams = teams.filter(t => t.team_id !== cr?.team_id);

  const handleRoute = async () => {
    if (!targetTeamId) return;
    setRouting(true);
    setError('');
    try {
      await onRoute(cr.cr_id, parseInt(targetTeamId));
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to route CR');
    } finally {
      setRouting(false);
    }
  };

  return (
    <div className="tbk-modal-overlay" onClick={onClose}>
      <div className="tbk-modal" onClick={e => e.stopPropagation()}>
        <div className="tbk-modal__header">
          <h2><ArrowRight size={16} /> Route CR to Team</h2>
          <button className="tbk-modal__close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="tbk-modal__body">
          <div className="tbk-modal__ticket-info">
            <strong>{cr?.cr_number}</strong> â€” {cr?.title}
          </div>
          {error && (
            <div className="tbk-alert tbk-alert--error"><AlertCircle size={14} /> {error}</div>
          )}
          <div className="tbk-field">
            <label>Route to Team *</label>
            <select value={targetTeamId} onChange={e => setTargetTeamId(e.target.value)}>
              <option value="">-- Select destination team --</option>
              {otherTeams.map(t => (
                <option key={t.team_id} value={t.team_id}>
                  {t.team_name} {t.is_central ? '(Central)' : ''} â€” {t.unassigned_count || 0} in queue
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="tbk-modal__footer">
          <button className="tbk-btn tbk-btn--ghost" onClick={onClose}>Cancel</button>
          <button className="tbk-btn tbk-btn--primary" onClick={handleRoute} disabled={!targetTeamId || routing}>
            {routing ? <Loader size={14} className="spin" /> : <ArrowRight size={14} />}
            Route CR
          </button>
        </div>
      </div>
    </div>
  );
};

// =============================================
// RISK BADGE
// =============================================
const RiskBadge = ({ level }) => {
  const cls = { LOW: 'cr-risk-low', MEDIUM: 'cr-risk-medium', HIGH: 'cr-risk-high', CRITICAL: 'cr-risk-critical' };
  return level ? (
    <span className={`cr-risk-badge ${cls[level] || 'cr-risk-medium'}`}>{level}</span>
  ) : null;
};

// =============================================
// MAIN COMPONENT
// =============================================
const CRTeamBucket = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const roleCode = user?.role?.role_code || '';
  const isAdmin = roleCode === 'ADMIN' || roleCode === 'MANAGER' || roleCode === 'CENTRAL_MGMT';
  const isEngineer = roleCode === 'ENGINEER';

  // State
  const [crs, setCRs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [limit] = useState(15);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('DESC');

  const [bucketStats, setBucketStats] = useState({ all_teams: [], my_teams: [] });
  const [statsLoading, setStatsLoading] = useState(true);
  const statsCache = useRef({ data: null, timestamp: 0 });
  const CACHE_DURATION = 30000;

  // Team selector (admin only)
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [currentTeam, setCurrentTeam] = useState(null);

  // My team membership (central?)
  const [isCentralTeamMember, setIsCentralTeamMember] = useState(false);

  // Route modal
  const [routeTarget, setRouteTarget] = useState(null);

  // Self-assign
  const [assigningId, setAssigningId] = useState(null);

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchCRs();
  }, [currentPage, sortBy, sortOrder, debouncedSearch, selectedTeamId]);

  // Determine if user is in a central team (after stats load)
  useEffect(() => {
    if (bucketStats.my_teams.length) {
      setIsCentralTeamMember(bucketStats.my_teams.some(t => t.is_central));
    }
  }, [bucketStats.my_teams]);

  const canRoute = isAdmin || isCentralTeamMember;

  // ==========================================
  const fetchStats = useCallback(async (forceRefresh = false) => {
    const now = Date.now();
    if (!forceRefresh && statsCache.current.data && (now - statsCache.current.timestamp) < CACHE_DURATION) {
      setBucketStats(statsCache.current.data);
      return;
    }
    setStatsLoading(true);
    try {
      const res = await api.get('/cr-team-bucket/stats');
      if (res.data.success) {
        statsCache.current = { data: res.data.data, timestamp: now };
        setBucketStats(res.data.data);
      }
    } catch { /* silent */ }
    finally { setStatsLoading(false); }
  }, []);

  const fetchCRs = async () => {
    try {
      setLoading(true);
      setError('');
      const params = { page: currentPage, limit, sortBy, sortOrder };
      if (debouncedSearch) params.search = debouncedSearch;
      if (selectedTeamId) params.team_id = selectedTeamId;

      const res = await api.get('/cr-team-bucket', { params });
      if (res.data.success) {
        const d = res.data.data;
        setCRs(d.change_requests || []);
        setTotalRecords(d.pagination?.totalRecords || 0);
        setTotalPages(d.pagination?.totalPages || 1);
        setCurrentTeam(d.team || null);
      }
    } catch (err) {
      if (err.response?.status === 403) {
        setError('You do not have permission to view the CR team bucket.');
      } else {
        setError('Failed to load CR team bucket.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelfAssign = async (crId) => {
    setAssigningId(crId);
    try {
      const res = await api.post(`/cr-team-bucket/${crId}/self-assign`);
      if (res.data.success) {
        toast.success(res.data.message || 'CR picked up successfully!');
        fetchCRs();
        fetchStats(true);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to pick up CR';
      if (err.response?.status === 409) { toast.warning(msg); fetchCRs(); }
      else toast.error(msg);
    } finally {
      setAssigningId(null);
    }
  };

  const handleRoute = async (crId, teamId) => {
    const res = await api.post(`/cr-team-bucket/${crId}/route`, { target_team_id: teamId });
    if (res.data.success) {
      toast.success(res.data.message || 'CR routed successfully!');
      fetchCRs();
      fetchStats(true);
    }
  };

  const handleSort = (field) => {
    if (sortBy === field) setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    else { setSortBy(field); setSortOrder('DESC'); }
    setCurrentPage(1);
  };

  const formatDate = (d) => formatDateUtil ? formatDateUtil(d) : (d ? new Date(d).toLocaleDateString() : 'â€”');

  const getProfilePictureUrl = (pic) => {
    if (!pic) return null;
    if (pic.startsWith('http://') || pic.startsWith('https://')) return pic;
    const base = API_BASE_URL.replace('/api/v1', '');
    const clean = pic.startsWith('/') ? pic : `/${pic}`;
    return `${base}${clean}`;
  };

  const getStatusStyle = (code) => {
    const map = {
      DRAFT: { bg: '#f1f5f9', text: '#64748b' },
      SUBMITTED: { bg: '#dbeafe', text: '#2563eb' },
      UNDER_REVIEW: { bg: '#fef3c7', text: '#d97706' },
      APPROVED: { bg: '#d1fae5', text: '#059669' },
      REJECTED: { bg: '#fecdd3', text: '#dc2626' },
      SCHEDULED: { bg: '#e0e7ff', text: '#4f46e5' },
      IN_PROGRESS: { bg: '#ddd6fe', text: '#7c3aed' },
      IMPLEMENTED: { bg: '#ccfbf1', text: '#0d9488' },
      CLOSED: { bg: '#e2e8f0', text: '#475569' },
    };
    return map[code] || { bg: '#f3f4f6', text: '#6b7280' };
  };

  // ==========================================
  // RENDER
  // ==========================================
  return (
    <div className="tickets-page">

      {/* â”€â”€ PAGE HEADER â”€â”€ */}
      <div className="page-header">
        <div className="header-left">
          <div className="page-title-wrapper">
            <div className="page-icon-wrapper" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}>
              <FolderKanban size={28} />
            </div>
            <div>
              <h1 className="page-title">
                CR Team Bucket
                {currentTeam && (
                  <span className="ctb-current-team">
                    {currentTeam.is_central && <Crown size={13} />}
                    {currentTeam.team_name}
                  </span>
                )}
              </h1>
              <p className="page-subtitle">
                {isEngineer ? 'Pick up CRs assigned to your team' : ''}
                {canRoute && !isEngineer ? 'Route CRs to specialist teams' : ''}
                {isAdmin ? ' â€” View any team bucket' : ''}
              </p>
            </div>
          </div>
        </div>

        <div className="header-right">
          <button
            className="btn-icon-action"
            onClick={() => { fetchCRs(); fetchStats(true); toast.info('Refreshingâ€¦'); }}
            disabled={loading}
            title="Refresh"
          >
            <RefreshCw size={18} className={loading ? 'spinning' : ''} />
          </button>
        </div>
      </div>

      {/* â”€â”€ TEAM STAT CARDS â”€â”€ */}
      <div className="ctb-stats-row">
        {statsLoading ? (
          <div className="ctb-stat-card">
            <Loader size={16} className="spinning" />
            <span>Loadingâ€¦</span>
          </div>
        ) : (
          (isAdmin ? bucketStats.all_teams : bucketStats.my_teams).map(team => (
            <div
              key={team.team_id}
              className={`ctb-stat-card${selectedTeamId === team.team_id ? ' ctb-stat-card--active' : ''}${team.is_central ? ' ctb-stat-card--central' : ''}`}
              onClick={() => { setSelectedTeamId(team.team_id); setCurrentPage(1); }}
            >
              <div className="ctb-stat-icon" style={{ background: team.is_central ? '#fef3c7' : '#eff6ff' }}>
                {team.is_central
                  ? <Crown size={18} color="#d97706" />
                  : <Building2 size={18} color="#3b82f6" />}
              </div>
              <div className="ctb-stat-info">
                <span className="ctb-stat-count">{team.unassigned_count || 0}</span>
                <span className="ctb-stat-label">{team.team_name}</span>
              </div>
              {selectedTeamId === team.team_id && (
                <CheckCircle size={14} className="ctb-stat-check" />
              )}
            </div>
          ))
        )}
        {isAdmin && (
          <div
            className={`ctb-stat-card ctb-stat-card--all${!selectedTeamId ? ' ctb-stat-card--active' : ''}`}
            onClick={() => { setSelectedTeamId(null); setCurrentPage(1); }}
          >
            <div className="ctb-stat-icon" style={{ background: '#f0fdf4' }}>
              <FolderKanban size={18} color="#16a34a" />
            </div>
            <div className="ctb-stat-info">
              <span className="ctb-stat-count">
                {(bucketStats.all_teams || []).reduce((s, t) => s + (t.unassigned_count || 0), 0)}
              </span>
              <span className="ctb-stat-label">All Teams</span>
            </div>
            {!selectedTeamId && <CheckCircle size={14} className="ctb-stat-check" />}
          </div>
        )}
      </div>

      {/* â”€â”€ INFO BANNERS â”€â”€ */}
      {isEngineer && (
        <div className="ctb-info-banner">
          <Info size={15} />
          <span>You can pick up CRs from this bucket to assign them to yourself.</span>
        </div>
      )}
      {canRoute && (
        <div className="ctb-info-banner ctb-info-route">
          <ArrowRight size={15} />
          <span>You can route CRs to specialist teams using the Route button.</span>
        </div>
      )}

      {/* â”€â”€ SEARCH BAR â”€â”€ */}
      <div className="filter-section">
        <div className="search-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="search-input-large"
            placeholder="Search by CR #, titleâ€¦"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="search-clear-btn" onClick={() => setSearchQuery('')}>
              <X size={16} />
            </button>
          )}
        </div>
        <span className="ctb-result-count">
          {totalRecords} CR{totalRecords !== 1 ? 's' : ''}
        </span>
      </div>

      {/* â”€â”€ ERROR â”€â”€ */}
      {error && (
        <div className="alert alert-error">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button className="alert-close" onClick={fetchCRs}>Retry</button>
        </div>
      )}

      {/* â”€â”€ TABLE â”€â”€ */}
      <div className="table-container">
        {loading ? (
          <div className="table-wrapper">
            <table className="tickets-table">
              <tbody>
                {Array.from({ length: 6 }).map((_, i) => (
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
              <GitPullRequest size={64} className="empty-icon" />
            </div>
            <h3>No CRs in this team bucket</h3>
            <p className="empty-description">All CRs have been assigned or there are no pending CRs for this team.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="tickets-table">
              <thead>
                <tr>
                  <th className="sortable cr-th-number" onClick={() => handleSort('cr_number')}>
                    <div className="th-content">
                      <span>CR #</span>
                      {sortBy === 'cr_number' && <span className="sort-indicator">{sortOrder === 'ASC' ? 'â†‘' : 'â†“'}</span>}
                    </div>
                  </th>
                  <th className="sortable cr-th-title" onClick={() => handleSort('title')}>
                    <div className="th-content">
                      <span>Title</span>
                      {sortBy === 'title' && <span className="sort-indicator">{sortOrder === 'ASC' ? 'â†‘' : 'â†“'}</span>}
                    </div>
                  </th>
                  <th className="cr-th-status">Status</th>
                  <th className="cr-th-risk">Risk</th>
                  <th className="th-requester">
                    <div className="th-content"><User size={12} /><span>Requester</span></div>
                  </th>
                  <th className="ctb-th-team">Team</th>
                  <th className="sortable th-created" onClick={() => handleSort('created_at')}>
                    <div className="th-content">
                      <span>Created</span>
                      {sortBy === 'created_at' && <span className="sort-indicator">{sortOrder === 'ASC' ? 'â†‘' : 'â†“'}</span>}
                    </div>
                  </th>
                  <th className="th-actions" />
                </tr>
              </thead>
              <tbody>
                {crs.map(cr => {
                  const statusStyle = getStatusStyle(cr.status_code);
                  const isAssigning = assigningId === cr.cr_id;
                  return (
                    <tr
                      key={cr.cr_id}
                      className="ticket-row"
                      onClick={() => navigate(`/cr/${cr.cr_id}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* CR Number */}
                      <td>
                        <span className="ticket-number">{cr.cr_number}</span>
                      </td>

                      {/* Title */}
                      <td>
                        <div className="ticket-title-content">
                          <span className="ticket-title-link">{cr.title}</span>
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
                      <td><RiskBadge level={cr.risk_level} /></td>

                      {/* Requester with avatar */}
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

                      {/* Team */}
                      <td>
                        <div className="ctb-team-cell">
                          {cr.is_central && <Crown size={11} className="ctb-crown" />}
                          <span>{cr.team_name || 'â€”'}</span>
                        </div>
                      </td>

                      {/* Created */}
                      <td>
                        <div className="date-info">
                          <span className="date-relative">{timeAgo(cr.created_at)}</span>
                          <span className="date-full">{formatDate(cr.created_at)}</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td onClick={e => e.stopPropagation()}>
                        <div className="action-buttons">
                          {isEngineer && (
                            <button
                              className="btn-action-table pickup"
                              onClick={() => handleSelfAssign(cr.cr_id)}
                              disabled={isAssigning}
                              title="Pick up this CR"
                            >
                              {isAssigning ? <Loader size={13} className="spinning" /> : <UserPlus size={13} />}
                              Pick Up
                            </button>
                          )}
                          {canRoute && (
                            <button
                              className="btn-action-table route"
                              onClick={() => setRouteTarget(cr)}
                              title="Route to another team"
                            >
                              <ArrowRight size={13} /> Route
                            </button>
                          )}
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
            Showing {((currentPage - 1) * limit) + 1}â€“{Math.min(currentPage * limit, totalRecords)} of {totalRecords}
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

      {/* â”€â”€ ROUTE MODAL â”€â”€ */}
      {routeTarget && (
        <RouteCRModal
          cr={routeTarget}
          teams={bucketStats.all_teams || []}
          onClose={() => setRouteTarget(null)}
          onRoute={handleRoute}
        />
      )}
    </div>
  );
};

export default CRTeamBucket;

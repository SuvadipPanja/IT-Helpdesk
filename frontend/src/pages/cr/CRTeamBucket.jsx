/**
 * ============================================
 * CR TEAM BUCKET PAGE
 * ============================================
 * Team-scoped CR queue — mirrors TeamBucket.jsx.
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
} from 'lucide-react';
import api from '../../services/api';
import { formatDate as formatDateUtil, timeAgo } from '../../utils/dateUtils';
import '../../styles/TeamBucket.css';

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
            <strong>{cr?.cr_number}</strong> — {cr?.title}
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
                  {t.team_name} {t.is_central ? '(Central)' : ''} — {t.unassigned_count || 0} in queue
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
  const map = {
    LOW: { bg: '#d1fae5', text: '#059669' },
    MEDIUM: { bg: '#fef3c7', text: '#d97706' },
    HIGH: { bg: '#fee2e2', text: '#dc2626' },
    CRITICAL: { bg: '#fecdd3', text: '#991b1b' },
  };
  const s = map[level] || map.MEDIUM;
  return level ? (
    <span style={{ background: s.bg, color: s.text, padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600 }}>
      {level}
    </span>
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

  const formatDate = (d) => formatDateUtil ? formatDateUtil(d) : (d ? new Date(d).toLocaleDateString() : '—');

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
    <div className="tbk-page">
      {/* Header */}
      <div className="tbk-header">
        <div className="tbk-header-left">
          <div className="tbk-title-wrapper">
            <div className="tbk-icon-wrapper" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              <FolderKanban size={22} color="#fff" />
            </div>
            <div>
              <h1 className="tbk-title">
                CR Team Bucket
                {currentTeam && (
                  <span className="tbk-current-team">
                    {currentTeam.is_central && <Crown size={13} />}
                    {currentTeam.team_name}
                  </span>
                )}
              </h1>
              <p className="tbk-subtitle">
                {isEngineer ? 'Pick up CRs assigned to your team' : ''}
                {canRoute && !isEngineer ? 'Route CRs to specialist teams' : ''}
                {isAdmin ? ' — View any team bucket' : ''}
              </p>
            </div>
          </div>
        </div>

        <div className="tbk-header-right">
          <button
            className="tbk-btn tbk-btn--icon"
            onClick={() => { fetchCRs(); fetchStats(true); toast.info('Refreshing…'); }}
            disabled={loading}
            title="Refresh"
          >
            <RefreshCw size={18} className={loading ? 'tbk-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Team Stats Row */}
      <div className="tbk-stats-row">
        {statsLoading ? (
          <div className="tbk-stat-card"><Loader size={18} className="spin" /> Loading stats…</div>
        ) : (
          (isAdmin ? bucketStats.all_teams : bucketStats.my_teams).map(team => (
            <div
              key={team.team_id}
              className={`tbk-stat-card${selectedTeamId === team.team_id ? ' tbk-stat-card--active' : ''}${team.is_central ? ' tbk-stat-card--central' : ''}`}
              style={{ cursor: 'pointer' }}
              onClick={() => {
                setSelectedTeamId(team.team_id);
                setCurrentPage(1);
              }}
            >
              <div className="tbk-stat-card__icon" style={{ background: team.is_central ? '#fef3c7' : '#eff6ff' }}>
                {team.is_central ? <Crown size={18} color="#d97706" /> : <Building2 size={18} color="#3b82f6" />}
              </div>
              <div className="tbk-stat-card__info">
                <span className="tbk-stat-card__count">{team.unassigned_count || 0}</span>
                <span className="tbk-stat-card__label">{team.team_name}</span>
              </div>
              {selectedTeamId === team.team_id && <CheckCircle size={14} style={{ color: '#3b82f6', marginLeft: 'auto', flexShrink: 0 }} />}
            </div>
          ))
        )}
        {isAdmin && (
          <div
            className={`tbk-stat-card${!selectedTeamId ? ' tbk-stat-card--active' : ''}`}
            style={{ cursor: 'pointer' }}
            onClick={() => { setSelectedTeamId(null); setCurrentPage(1); }}
          >
            <div className="tbk-stat-card__icon" style={{ background: '#f0fdf4' }}>
              <FolderKanban size={18} color="#16a34a" />
            </div>
            <div className="tbk-stat-card__info">
              <span className="tbk-stat-card__count">
                {(bucketStats.all_teams || []).reduce((s, t) => s + (t.unassigned_count || 0), 0)}
              </span>
              <span className="tbk-stat-card__label">All Teams</span>
            </div>
            {!selectedTeamId && <CheckCircle size={14} style={{ color: '#3b82f6', marginLeft: 'auto', flexShrink: 0 }} />}
          </div>
        )}
      </div>

      {/* Info Banners */}
      {isEngineer && (
        <div className="tbk-info-banner">
          <Info size={15} />
          <span>You can pick up CRs from this bucket to assign them to yourself.</span>
        </div>
      )}
      {canRoute && (
        <div className="tbk-info-banner tbk-info-route">
          <ArrowRight size={15} />
          <span>You can route CRs to specialist teams using the Route button.</span>
        </div>
      )}

      {/* Search */}
      <div className="tbk-toolbar">
        <div className="tbk-search-wrapper">
          <Search size={16} className="tbk-search-icon" />
          <input
            type="text"
            className="tbk-search-input"
            placeholder="Search by CR #, title…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="tbk-search-clear" onClick={() => setSearchQuery('')}><X size={14} /></button>
          )}
        </div>
        <span className="tbk-result-count">{totalRecords} CR{totalRecords !== 1 ? 's' : ''}</span>
      </div>

      {/* Error */}
      {error && (
        <div className="tbk-error">
          <AlertCircle size={18} /> {error}
          <button onClick={fetchCRs}>Retry</button>
        </div>
      )}

      {/* Table */}
      <div className="tbk-table-wrapper">
        <table className="tbk-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('cr_number')} className="tbk-th-sort">
                CR # {sortBy === 'cr_number' && <span>{sortOrder === 'ASC' ? '↑' : '↓'}</span>}
              </th>
              <th onClick={() => handleSort('title')} className="tbk-th-sort">
                Title {sortBy === 'title' && <span>{sortOrder === 'ASC' ? '↑' : '↓'}</span>}
              </th>
              <th>Status</th>
              <th>Risk</th>
              <th>Requester</th>
              <th>Team</th>
              <th onClick={() => handleSort('created_at')} className="tbk-th-sort">
                <Calendar size={12} /> Created
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="tbk-skeleton-row">
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j}><div style={{ height: 16, background: '#f1f5f9', borderRadius: 4 }} /></td>
                  ))}
                </tr>
              ))
            ) : crs.length === 0 ? (
              <tr>
                <td colSpan={8}>
                  <div className="tbk-empty">
                    <GitPullRequest size={40} />
                    <h3>No CRs in this team bucket</h3>
                    <p>All CRs have been assigned or there are no pending CRs for this team.</p>
                  </div>
                </td>
              </tr>
            ) : (
              crs.map(cr => {
                const statusStyle = getStatusStyle(cr.status_code);
                const isAssigning = assigningId === cr.cr_id;
                return (
                  <tr key={cr.cr_id} className="tbk-ticket-row" onClick={() => navigate(`/cr/${cr.cr_id}`)}>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#6366f1' }}>
                        {cr.cr_number}
                      </span>
                    </td>
                    <td className="tbk-subject-cell">
                      <span className="tbk-subject">{cr.title}</span>
                    </td>
                    <td>
                      <span
                        style={{
                          background: statusStyle.bg,
                          color: statusStyle.text,
                          padding: '2px 8px',
                          borderRadius: 12,
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        {cr.status_name || cr.status_code}
                      </span>
                    </td>
                    <td><RiskBadge level={cr.risk_level} /></td>
                    <td className="tbk-requester-cell">{cr.requester_name || '—'}</td>
                    <td>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#64748b' }}>
                        {cr.is_central && <Crown size={11} style={{ color: '#f59e0b' }} />}
                        {cr.team_name || '—'}
                      </span>
                    </td>
                    <td className="tbk-date-cell">
                      <span title={formatDate(cr.created_at)}>{timeAgo(cr.created_at)}</span>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {isEngineer && (
                          <button
                            className="tbk-btn tbk-btn--assign"
                            onClick={() => handleSelfAssign(cr.cr_id)}
                            disabled={isAssigning}
                            title="Pick up this CR"
                          >
                            {isAssigning ? <Loader size={13} className="spin" /> : <UserPlus size={13} />}
                            Pick Up
                          </button>
                        )}
                        {canRoute && (
                          <button
                            className="tbk-btn tbk-btn--route"
                            onClick={() => setRouteTarget(cr)}
                            title="Route to another team"
                          >
                            <ArrowRight size={13} /> Route
                          </button>
                        )}
                        <button
                          className="tbk-btn tbk-btn--view"
                          onClick={() => navigate(`/cr/${cr.cr_id}`)}
                          title="View CR"
                        >
                          <Eye size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="tbk-pagination">
          <button
            className="tbk-page-btn"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft size={16} />
          </button>
          <span className="tbk-page-info">
            Page {currentPage} of {totalPages} — {totalRecords} total
          </span>
          <button
            className="tbk-page-btn"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Route Modal */}
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

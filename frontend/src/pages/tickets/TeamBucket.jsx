/**
 * ============================================
 * TEAM BUCKET PAGE
 * ============================================
 * Team-scoped ticket queue.
 *
 * CENTRAL TEAM view:
 *   - Sees ALL tickets routed to the central team
 *   - Can validate priority, reset priority (SLA recalc)
 *   - Can forward (route) tickets to specialist teams
 *
 * SPECIALIST TEAM view:
 *   - Sees only tickets routed to their specific team
 *   - Engineers can self-assign from the queue
 *
 * ADMIN / MANAGER view:
 *   - Team selector: pick any team to view its bucket
 *   - Can route and reset priority on any team's tickets
 *
 * Developer: Suvadip Panja
 * Company: Digitide
 * Created: April 2026
 * ============================================
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  AlertTriangle,
  Clock,
  CheckCircle,
  Tag,
  Crown,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Building2,
  Calendar,
  Filter,
  Users,
  UsersRound,
  Info,
  Zap
} from 'lucide-react';
import api from '../../services/api';
import { formatDate as formatDateUtil, timeAgo } from '../../utils/dateUtils';
import '../../styles/TeamBucket.css';

/** Normalize per-team queue count from API (SQL driver may vary casing). */
const pickUnassignedCount = (row) => {
  if (!row || typeof row !== 'object') return 0;
  const raw = row.unassigned_count ?? row.Unassigned_Count;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
};

// =============================================
// PRIORITY BADGE
// =============================================
const PriorityBadge = ({ priority_code, priority_name, priority_color }) => (
  <span
    className="tbk-priority-badge"
    data-priority={priority_code?.toLowerCase()}
    style={{ background: priority_color ? `${priority_color}22` : undefined, color: priority_color || '#64748b', borderColor: priority_color ? `${priority_color}44` : '#e2e8f0' }}
  >
    {priority_name}
  </span>
);

// =============================================
// ROUTE TICKET MODAL
// =============================================
const RouteModal = ({ ticket, teams, onClose, onRoute }) => {
  const [targetTeamId, setTargetTeamId] = useState('');
  const [routing, setRouting] = useState(false);
  const [error, setError] = useState('');

  const nonCentralTeams = teams.filter(t => !t.is_central && t.team_id !== ticket?.team_id);

  const handleRoute = async () => {
    if (!targetTeamId) return;
    setRouting(true);
    setError('');
    try {
      await onRoute(ticket.ticket_id, parseInt(targetTeamId));
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to route ticket');
    } finally {
      setRouting(false);
    }
  };

  return (
    <div className="tbk-modal-overlay" onClick={onClose}>
      <div className="tbk-modal" onClick={e => e.stopPropagation()}>
        <div className="tbk-modal__header">
          <h2><ArrowRight size={16} /> Route Ticket</h2>
          <button className="tbk-modal__close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="tbk-modal__body">
          <div className="tbk-modal__ticket-info">
            <strong>#{ticket?.ticket_number}</strong> — {ticket?.subject}
          </div>
          {error && (
            <div className="tbk-alert tbk-alert--error">
              <AlertCircle size={14} /> {error}
            </div>
          )}
          <div className="tbk-field">
            <label>Route to Team *</label>
            <select value={targetTeamId} onChange={e => setTargetTeamId(e.target.value)}>
              <option value="">-- Select destination team --</option>
              {nonCentralTeams.map(t => (
                <option key={t.team_id} value={t.team_id}>
                  {t.team_name} ({pickUnassignedCount(t)} in queue)
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="tbk-modal__footer">
          <button className="tbk-btn tbk-btn--ghost" onClick={onClose}>Cancel</button>
          <button
            className="tbk-btn tbk-btn--primary"
            onClick={handleRoute}
            disabled={!targetTeamId || routing}
          >
            {routing ? <Loader size={14} className="spin" /> : <ArrowRight size={14} />}
            Route Ticket
          </button>
        </div>
      </div>
    </div>
  );
};

// =============================================
// PRIORITY RESET MODAL
// =============================================
const PriorityModal = ({ ticket, priorities, onClose, onReset }) => {
  const [priorityId, setPriorityId] = useState(ticket?.priority_id?.toString() || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!priorityId) return;
    setSaving(true);
    setError('');
    try {
      await onReset(ticket.ticket_id, parseInt(priorityId));
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update priority');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="tbk-modal-overlay" onClick={onClose}>
      <div className="tbk-modal" onClick={e => e.stopPropagation()}>
        <div className="tbk-modal__header">
          <h2><Zap size={16} /> Reset Priority & SLA</h2>
          <button className="tbk-modal__close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="tbk-modal__body">
          <div className="tbk-modal__ticket-info">
            <strong>#{ticket?.ticket_number}</strong> — {ticket?.subject}
          </div>
          {error && (
            <div className="tbk-alert tbk-alert--error">
              <AlertCircle size={14} /> {error}
            </div>
          )}
          <div className="tbk-alert tbk-alert--info">
            <Info size={13} />
            Changing priority will recalculate the SLA due date based on the new priority policy.
          </div>
          <div className="tbk-field">
            <label>New Priority *</label>
            <select value={priorityId} onChange={e => setPriorityId(e.target.value)}>
              <option value="">-- Select priority --</option>
              {priorities.map(p => (
                <option key={p.priority_id} value={p.priority_id}>{p.priority_name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="tbk-modal__footer">
          <button className="tbk-btn tbk-btn--ghost" onClick={onClose}>Cancel</button>
          <button
            className="tbk-btn tbk-btn--primary"
            onClick={handleSave}
            disabled={!priorityId || saving}
          >
            {saving ? <Loader size={14} className="spin" /> : <CheckCircle size={14} />}
            Update Priority
          </button>
        </div>
      </div>
    </div>
  );
};

// =============================================
// MAIN COMPONENT
// =============================================
const TeamBucket = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const roleCode     = user?.role?.role_code || '';
  const isEngineer   = roleCode === 'ENGINEER';
  const isAdminMgr   = roleCode === 'ADMIN' || roleCode === 'MANAGER' || roleCode === 'CENTRAL_MGMT';

  // ------------------------------------------
  // State
  // ------------------------------------------
  const [tickets, setTickets]         = useState([]);
  const [teamInfo, setTeamInfo]       = useState(null);
  const [stats, setStats]             = useState(null);
  const [allTeams, setAllTeams]       = useState([]);
  const [priorities, setPriorities]   = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');

  // Selected team (admin/manager can switch)
  const [selectedTeamId, setSelectedTeamId] = useState(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages]   = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [limit] = useState(15);

  // Filters
  const [search, setSearch]               = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterPriority, setFilterPriority]   = useState('');
  const [filterCategory, setFilterCategory]   = useState('');

  // Sort
  const [sortBy, setSortBy]       = useState('created_at');
  const [sortOrder, setSortOrder] = useState('DESC');

  // Modals
  const [routeModal, setRouteModal]     = useState(null); // ticket object
  const [priorityModal, setPriorityModal] = useState(null); // ticket object
  const [assigningId, setAssigningId]   = useState(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // ------------------------------------------
  // Fetch supporting data  
  // ------------------------------------------
  const fetchSupportingData = useCallback(async () => {
    try {
      const [teamStatsRes, prioritiesRes] = await Promise.all([
        api.get('/team-bucket/stats').catch(() => ({ data: { data: {} } })),
        api.get('/system/priorities').catch(() => ({ data: { data: [] } })),
      ]);
      const statsData = teamStatsRes.data?.data || {};
      setStats(statsData);

      const myTeams = statsData.my_teams || [];
      const allTeamsData = statsData.all_teams || [];
      setAllTeams(allTeamsData);

      // Auto-select: engineer → their team, admin → first team
      if (!selectedTeamId) {
        if (myTeams.length > 0) {
          setSelectedTeamId(myTeams[0].team_id);
        } else if (isAdminMgr && allTeamsData.length > 0) {
          setSelectedTeamId(allTeamsData[0].team_id);
        }
      }
      setPriorities(prioritiesRes.data?.data || []);
    } catch (err) {
      if (process.env.NODE_ENV === 'development') console.error('Failed to load team bucket supporting data', err);
    }
  }, [selectedTeamId, isAdminMgr]);

  // ------------------------------------------
  // Fetch Tickets
  // ------------------------------------------
  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: currentPage,
        limit,
        sortBy,
        sortOrder,
      });
      if (selectedTeamId) params.append('team_id', selectedTeamId);
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (filterPriority) params.append('priority_id', filterPriority);
      if (filterCategory) params.append('category_id', filterCategory);

      const res = await api.get(`/team-bucket?${params.toString()}`);
      const data = res.data?.data || {};
      const pag = data.pagination || {};
      // Backend getPaginationMeta uses totalRecords / totalPages (not total / total_pages)
      setTickets(data.tickets || []);
      setTeamInfo(data.team || null);
      setTotalRecords(pag.totalRecords ?? pag.total ?? 0);
      setTotalPages(pag.totalPages ?? pag.total_pages ?? 1);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load team bucket');
    } finally {
      setLoading(false);
    }
  }, [currentPage, limit, sortBy, sortOrder, selectedTeamId, debouncedSearch, filterPriority, filterCategory]);

  // ------------------------------------------
  // Initial load + re-fetch on deps
  // ------------------------------------------
  useEffect(() => {
    fetchSupportingData();
  }, []);

  useEffect(() => {
    if (selectedTeamId !== null) {
      fetchTickets();
    }
  }, [fetchTickets, selectedTeamId]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filterPriority, filterCategory, selectedTeamId]);

  // ------------------------------------------
  // Self-Assign
  // ------------------------------------------
  const handleSelfAssign = useCallback(async (ticketId) => {
    setAssigningId(ticketId);
    try {
      await api.post(`/team-bucket/${ticketId}/self-assign`);
      toast.success('Ticket assigned to you!');
      fetchTickets();
      fetchSupportingData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to self-assign');
    } finally {
      setAssigningId(null);
    }
  }, [fetchTickets, fetchSupportingData]);

  // ------------------------------------------
  // Route to Team
  // ------------------------------------------
  const handleRoute = useCallback(async (ticketId, targetTeamId) => {
    await api.post(`/team-bucket/${ticketId}/route`, { team_id: targetTeamId });
    toast.success('Ticket routed successfully');
    fetchTickets();
    fetchSupportingData();
  }, [fetchTickets, fetchSupportingData]);

  // ------------------------------------------
  // Reset Priority
  // ------------------------------------------
  const handleResetPriority = useCallback(async (ticketId, newPriorityId) => {
    await api.put(`/team-bucket/${ticketId}/priority`, { priority_id: newPriorityId });
    toast.success('Priority updated and SLA recalculated');
    fetchTickets();
  }, [fetchTickets]);

  // ------------------------------------------
  // Derived
  // ------------------------------------------
  const isCentralTeamView = teamInfo?.is_central || false;
  const canRoute = isAdminMgr || isCentralTeamView;
  // Central team members can also reset priority (backend enforces this too)
  const canResetPriority = isAdminMgr || isCentralTeamView;

  const myTeams = stats?.my_teams || [];

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="tbk-page">
      {/* HEADER */}
      <div className="tbk-header">
        <div className="tbk-header__left">
          <div className="tbk-header__icon" style={{
            background: isCentralTeamView
              ? 'linear-gradient(135deg, #f59e0b, #d97706)'
              : 'linear-gradient(135deg, #6366f1, #818cf8)'
          }}>
            {isCentralTeamView ? <Crown size={22} /> : <FolderKanban size={22} />}
          </div>
          <div>
            <h1 className="tbk-title">
              {teamInfo ? `${teamInfo.team_name} Bucket` : 'Team Bucket'}
              {isCentralTeamView && <span className="tbk-central-badge">Central</span>}
            </h1>
            <p className="tbk-subtitle">
              {isCentralTeamView
                ? 'All new tickets land here first. Validate and route to specialist teams.'
                : 'Pick up tickets from your team queue or route them to specialists.'}
            </p>
          </div>
        </div>
        <div className="tbk-header__right">
          <button className="tbk-btn tbk-btn--ghost" onClick={() => { fetchTickets(); fetchSupportingData(); }}>
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* TEAM SELECTOR (admin/manager + multi-team members) */}
      {(isAdminMgr || myTeams.length > 1) && allTeams.length > 0 && (
        <div className="tbk-team-selector">
          <UsersRound size={15} />
          <span>Team:</span>
          <select
            value={selectedTeamId || ''}
            onChange={e => { setSelectedTeamId(parseInt(e.target.value)); setCurrentPage(1); }}
          >
            {isAdminMgr && <option value="">-- All teams --</option>}
            {allTeams.map(t => (
              <option key={t.team_id} value={t.team_id}>
                {t.team_name}{t.is_central ? ' ★ Central' : ''} ({pickUnassignedCount(t)})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* STATS ROW — use all_teams (includes unassigned_count). my_teams is membership-only and has no counts. */}
      {stats && (stats.all_teams || []).length > 0 && (
        <div className="tbk-stats-row">
          {(stats.all_teams || []).map(t => (
            <div
              key={t.team_id}
              className={`tbk-stat-card ${selectedTeamId === t.team_id ? 'tbk-stat-card--active' : ''} ${t.is_central ? 'tbk-stat-card--central' : ''}`}
              onClick={() => { setSelectedTeamId(t.team_id); setCurrentPage(1); }}
            >
              <div className="tbk-stat-card__icon">
                {t.is_central ? <Crown size={16} /> : <FolderKanban size={16} />}
              </div>
              <div className="tbk-stat-card__info">
                <span className="tbk-stat-card__count">{pickUnassignedCount(t)}</span>
                <span className="tbk-stat-card__label">{t.team_name}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FILTERS */}
      <div className="tbk-filters-bar">
        <div className="tbk-search-wrapper">
          <Search size={15} />
          <input
            type="text"
            placeholder="Search tickets..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button onClick={() => setSearch('')}><X size={13} /></button>}
        </div>
        <div className="tbk-filters-right">
          <select
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value)}
            className="tbk-filter-select"
          >
            <option value="">All Priorities</option>
            {priorities.map(p => (
              <option key={p.priority_id} value={p.priority_id}>{p.priority_name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* TICKET TABLE */}
      {loading ? (
        <div className="tbk-loading"><Loader size={22} className="spin" /> Loading tickets...</div>
      ) : error ? (
        <div className="tbk-error"><AlertCircle size={18} /> {error}</div>
      ) : tickets.length === 0 ? (
        <div className="tbk-empty">
          <FolderKanban size={44} />
          <h3>Queue is empty</h3>
          <p>{selectedTeamId ? 'No unassigned tickets in this team queue' : 'Select a team to view its queue'}</p>
        </div>
      ) : (
        <>
          <div className="tbk-table-wrapper">
            <table className="tbk-table">
              <thead>
                <tr>
                  <th>Ticket #</th>
                  <th>Subject</th>
                  <th>Category</th>
                  <th>Priority</th>
                  {isCentralTeamView && <th>Suggested Team</th>}
                  <th>Requester</th>
                  <th>
                    <button className="tbk-sort-btn" onClick={() => {
                      if (sortBy === 'created_at') setSortOrder(o => o === 'ASC' ? 'DESC' : 'ASC');
                      else { setSortBy('created_at'); setSortOrder('DESC'); }
                    }}>
                      Created <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th>Due Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map(ticket => {
                  const isOverdue = ticket.due_date && new Date(ticket.due_date) < new Date();
                  return (
                    <tr key={ticket.ticket_id} className={isOverdue ? 'tbk-tr--overdue' : ''}>
                      <td>
                        <button
                          className="tbk-ticket-num"
                          onClick={() => navigate(`/tickets/${ticket.ticket_id}`)}
                        >
                          #{ticket.ticket_number}
                        </button>
                      </td>
                      <td className="tbk-td-subject">{ticket.subject}</td>
                      <td>
                        {ticket.category_name && (
                          <span className="tbk-category-tag"><Tag size={11} />{ticket.category_name}</span>
                        )}
                      </td>
                      <td>
                        <PriorityBadge
                          priority_code={ticket.priority_code}
                          priority_name={ticket.priority_name}
                          priority_color={ticket.priority_color}
                        />
                      </td>
                      {isCentralTeamView && (
                        <td>
                          {/* Show suggested destination team based on routing rules */}
                          {allTeams
                            .filter(t => !t.is_central)
                            .map(t => t.team_name)
                            .slice(0, 1)
                            .map((n, i) => <span key={i} className="tbk-suggested-team">{n}</span>)
                          }
                        </td>
                      )}
                      <td>
                        <div className="tbk-requester">
                          <div className="tbk-requester__avatar">
                            {ticket.requester_name?.charAt(0)?.toUpperCase()}
                          </div>
                          <span>{ticket.requester_name}</span>
                        </div>
                      </td>
                      <td className="tbk-td-date">{timeAgo(ticket.created_at)}</td>
                      <td className={`tbk-td-date ${isOverdue ? 'tbk-td-date--overdue' : ''}`}>
                        {ticket.due_date ? formatDateUtil(ticket.due_date) : '—'}
                        {isOverdue && <AlertTriangle size={12} className="tbk-overdue-icon" />}
                      </td>
                      <td>
                        <div className="tbk-actions">
                          <button
                            className="tbk-action-btn"
                            title="View ticket"
                            onClick={() => navigate(`/tickets/${ticket.ticket_id}`)}
                          >
                            <Eye size={14} />
                          </button>
                          {isEngineer && (
                            <button
                              className="tbk-action-btn tbk-action-btn--assign"
                              title="Assign to me"
                              onClick={() => handleSelfAssign(ticket.ticket_id)}
                              disabled={assigningId === ticket.ticket_id}
                            >
                              {assigningId === ticket.ticket_id
                                ? <Loader size={14} className="spin" />
                                : <UserPlus size={14} />}
                            </button>
                          )}
                          {canRoute && (
                            <button
                              className="tbk-action-btn tbk-action-btn--route"
                              title="Route to team"
                              onClick={() => setRouteModal(ticket)}
                            >
                              <ArrowRight size={14} />
                            </button>
                          )}
                          {canResetPriority && (
                            <button
                              className="tbk-action-btn tbk-action-btn--priority"
                              title="Reset priority / SLA"
                              onClick={() => setPriorityModal(ticket)}
                            >
                              <Zap size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* PAGINATION */}
          <div className="tbk-pagination">
            <span className="tbk-pagination__info">
              {totalRecords} tickets total
            </span>
            <div className="tbk-pagination__controls">
              <button
                className="tbk-page-btn"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(p => p - 1)}
              >
                <ChevronLeft size={15} />
              </button>
              <span className="tbk-pagination__pages">
                Page {currentPage} of {totalPages}
              </span>
              <button
                className="tbk-page-btn"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
              >
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </>
      )}

      {/* MODALS */}
      {routeModal && (
        <RouteModal
          ticket={routeModal}
          teams={allTeams}
          onClose={() => setRouteModal(null)}
          onRoute={handleRoute}
        />
      )}
      {priorityModal && (
        <PriorityModal
          ticket={priorityModal}
          priorities={priorities}
          onClose={() => setPriorityModal(null)}
          onReset={handleResetPriority}
        />
      )}
    </div>
  );
};

export default TeamBucket;

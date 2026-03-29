/**
 * ============================================
 * TEAMS PAGE
 * ============================================
 * Admin interface for managing support teams,
 * team members, and category → team routing rules.
 *
 * FEATURES:
 * - View all teams (members count, category mappings)
 * - Create / edit / deactivate teams
 * - Mark a team as the "Central Ticketing Team"
 * - Add/remove users from a team
 * - Map ticket categories to destination teams
 * - One-click view of team details in a side panel
 *
 * Developer: Suvadip Panja
 * Company: Digitide
 * Created: April 2026
 * ============================================
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  UsersRound,
  Plus,
  Edit,
  Trash2,
  Users,
  Shield,
  RefreshCw,
  Search,
  X,
  Tag,
  UserPlus,
  UserMinus,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  Loader,
  ChevronDown,
  Crown,
  Star,
  Building,
  Link,
  Unlink,
  FolderKanban,
  Settings,
  Eye
} from 'lucide-react';
import api from '../../services/api';
import '../../styles/TeamsPage.css';

// =============================================
// TEAM CARD COMPONENT
// =============================================
const TeamCard = ({ team, onEdit, onDelete, onView, isSelected }) => (
  <div
    className={`teams-card ${team.is_central ? 'teams-card--central' : ''} ${isSelected ? 'teams-card--selected' : ''}`}
    onClick={() => onView(team)}
  >
    <div className="teams-card__header">
      <div className="teams-card__icon-wrapper" style={{
        background: team.is_central
          ? 'linear-gradient(135deg, #f59e0b, #d97706)'
          : 'linear-gradient(135deg, #6366f1, #818cf8)'
      }}>
        {team.is_central ? <Crown size={20} /> : <UsersRound size={20} />}
      </div>
      <div className="teams-card__info">
        <h3 className="teams-card__name">
          {team.team_name}
          {team.is_central && <span className="teams-card__central-badge">Central</span>}
        </h3>
        <span className="teams-card__code">{team.team_code}</span>
      </div>
      <div className="teams-card__actions" onClick={e => e.stopPropagation()}>
        <button className="teams-card__action-btn" title="Edit" onClick={() => onEdit(team)}>
          <Edit size={14} />
        </button>
        {!team.is_central && (
          <button className="teams-card__action-btn teams-card__action-btn--danger" title="Deactivate" onClick={() => onDelete(team)}>
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>

    {team.description && (
      <p className="teams-card__description">{team.description}</p>
    )}

    <div className="teams-card__stats">
      <div className="teams-card__stat">
        <Users size={13} />
        <span>{team.member_count} member{team.member_count !== 1 ? 's' : ''}</span>
      </div>
      <div className="teams-card__stat">
        <FolderKanban size={13} />
        <span>{team.unassigned_ticket_count} in queue</span>
      </div>
      {team.team_manager_name && (
        <div className="teams-card__stat">
          <Shield size={13} />
          <span>{team.team_manager_name}</span>
        </div>
      )}
    </div>
  </div>
);

// =============================================
// TEAM FORM MODAL
// =============================================
const TeamFormModal = ({ team, users, onClose, onSave }) => {
  const [form, setForm] = useState({
    team_name: team?.team_name || '',
    team_code: team?.team_code || '',
    description: team?.description || '',
    is_central: team?.is_central || false,
    team_manager_id: team?.team_manager_id || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onSave(form, team?.team_id);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save team');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="teams-modal-overlay" onClick={onClose}>
      <div className="teams-modal" onClick={e => e.stopPropagation()}>
        <div className="teams-modal__header">
          <h2>{team ? 'Edit Team' : 'Create New Team'}</h2>
          <button className="teams-modal__close" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="teams-modal__body">
          {error && (
            <div className="teams-alert teams-alert--error">
              <AlertCircle size={15} /> {error}
            </div>
          )}

          <div className="teams-field">
            <label>Team Name *</label>
            <input
              type="text" required maxLength={100}
              value={form.team_name}
              onChange={e => setForm(f => ({ ...f, team_name: e.target.value }))}
              placeholder="e.g. Network Team"
            />
          </div>

          <div className="teams-field">
            <label>Team Code *</label>
            <input
              type="text" required maxLength={30}
              value={form.team_code}
              onChange={e => setForm(f => ({ ...f, team_code: e.target.value.toUpperCase() }))}
              placeholder="e.g. NETWORK"
            />
            <span className="teams-field__hint">Unique identifier, uppercase letters and numbers only</span>
          </div>

          <div className="teams-field">
            <label>Description</label>
            <textarea
              rows={3} maxLength={500}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Optional team description..."
            />
          </div>

          <div className="teams-field">
            <label>Team Manager (optional)</label>
            <select
              value={form.team_manager_id}
              onChange={e => setForm(f => ({ ...f, team_manager_id: e.target.value }))}
            >
              <option value="">-- None --</option>
              {users.map(u => (
                <option key={u.user_id} value={u.user_id}>
                  {u.full_name} ({u.role_code})
                </option>
              ))}
            </select>
          </div>

          {!team?.is_central && (
            <div className="teams-field teams-field--checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={form.is_central}
                  onChange={e => setForm(f => ({ ...f, is_central: e.target.checked }))}
                />
                <span>Mark as Central Ticketing Team</span>
              </label>
              {form.is_central && (
                <div className="teams-alert teams-alert--warning">
                  <AlertCircle size={13} />
                  All new tickets will be routed to this team first, before forwarding to specialist teams.
                </div>
              )}
            </div>
          )}

          <div className="teams-modal__footer">
            <button type="button" className="teams-btn teams-btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="teams-btn teams-btn--primary" disabled={saving}>
              {saving ? <Loader size={15} className="spin" /> : <CheckCircle size={15} />}
              {team ? 'Save Changes' : 'Create Team'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =============================================
// MAIN PAGE COMPONENT
// =============================================
const TeamsPage = () => {
  const { user } = useAuth();
  const toast = useToast();

  // ------------------------------------------
  // State
  // ------------------------------------------
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamDetail, setTeamDetail] = useState(null);  // full detail with members + routing
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Lookup data
  const [allUsers, setAllUsers] = useState([]);
  const [allCategories, setAllCategories] = useState([]);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [deletingTeam, setDeletingTeam] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Team member management
  const [memberSearch, setMemberSearch] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [removingMemberId, setRemovingMemberId] = useState(null);

  // Category routing management
  const [addingRouting, setAddingRouting] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [removingRoutingId, setRemovingRoutingId] = useState(null);

  // All routing rules for the routing tab
  const [allRoutings, setAllRoutings] = useState([]);
  const [activeTab, setActiveTab] = useState('teams'); // 'teams' | 'routing'

  // ------------------------------------------
  // Fetch Teams
  // ------------------------------------------
  const fetchTeams = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/teams?include_inactive=false');
      setTeams(res.data?.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load teams');
    } finally {
      setLoading(false);
    }
  }, []);

  // ------------------------------------------
  // Fetch Lookup Data (users + categories)
  // ------------------------------------------
  const fetchLookups = useCallback(async () => {
    try {
      const fallback = { data: { data: [] } };
      const [usersRes, catRes] = await Promise.all([
        api.get('/users?role_code=ADMIN,MANAGER,ENGINEER,CENTRAL_MGMT&limit=500').catch(() => fallback),
        api.get('/system/categories').catch(() => fallback),
      ]);
      const users = (usersRes.data?.data?.users || usersRes.data?.data || []).map(u => ({
        user_id: u.user_id,
        full_name: `${u.first_name} ${u.last_name}`.trim(),
        email: u.email,
        role_code: u.role?.role_code || u.role_code || '',
      }));
      setAllUsers(users);
      setAllCategories(catRes.data?.data || []);
    } catch (_) { /* non-critical */ }
  }, []);

  // ------------------------------------------
  // Fetch All Routing Rules
  // ------------------------------------------
  const fetchRoutings = useCallback(async () => {
    try {
      const res = await api.get('/teams/routing');
      setAllRoutings(res.data?.data || []);
    } catch (_) { /* non-critical */ }
  }, []);

  // ------------------------------------------
  // Initial Load
  // ------------------------------------------
  useEffect(() => {
    fetchTeams();
    fetchLookups();
    fetchRoutings();
  }, [fetchTeams, fetchLookups, fetchRoutings]);

  // ------------------------------------------
  // View Team Detail
  // ------------------------------------------
  const handleViewTeam = useCallback(async (team) => {
    setSelectedTeam(team);
    setDetailLoading(true);
    try {
      const res = await api.get(`/teams/${team.team_id}`);
      setTeamDetail(res.data?.data || null);
    } catch (err) {
      toast.error('Failed to load team details');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // ------------------------------------------
  // Save Team (create or update)
  // ------------------------------------------
  const handleSaveTeam = useCallback(async (formData, teamId) => {
    if (teamId) {
      await api.put(`/teams/${teamId}`, formData);
      toast.success('Team updated successfully');
    } else {
      await api.post('/teams', formData);
      toast.success('Team created successfully');
    }
    await fetchTeams();
    await fetchRoutings();
    if (teamId != null && selectedTeam?.team_id === teamId) {
      const res = await api.get(`/teams/${teamId}`);
      setTeamDetail(res.data?.data || null);
    }
  }, [fetchTeams, fetchRoutings, selectedTeam]);

  // ------------------------------------------
  // Delete / Deactivate Team
  // ------------------------------------------
  const handleDeleteTeam = useCallback(async () => {
    if (!deletingTeam) return;
    setDeleting(true);
    try {
      await api.delete(`/teams/${deletingTeam.team_id}`);
      toast.success(`Team "${deletingTeam.team_name}" deactivated`);
      setDeletingTeam(null);
      if (selectedTeam?.team_id === deletingTeam.team_id) {
        setSelectedTeam(null);
        setTeamDetail(null);
      }
      await fetchTeams();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to deactivate team');
    } finally {
      setDeleting(false);
    }
  }, [deletingTeam, selectedTeam, fetchTeams]);

  // ------------------------------------------
  // Add Member
  // ------------------------------------------
  const handleAddMember = useCallback(async () => {
    if (!selectedTeam || !selectedUserId) return;
    setAddingMember(true);
    try {
      await api.post(`/teams/${selectedTeam.team_id}/members`, { user_id: selectedUserId });
      toast.success('Member added successfully');
      setSelectedUserId('');
      const res = await api.get(`/teams/${selectedTeam.team_id}`);
      setTeamDetail(res.data?.data || null);
      await fetchTeams();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add member');
    } finally {
      setAddingMember(false);
    }
  }, [selectedTeam, selectedUserId, fetchTeams]);

  // ------------------------------------------
  // Remove Member
  // ------------------------------------------
  const handleRemoveMember = useCallback(async (userId) => {
    if (!selectedTeam) return;
    setRemovingMemberId(userId);
    try {
      await api.delete(`/teams/${selectedTeam.team_id}/members/${userId}`);
      toast.success('Member removed');
      const res = await api.get(`/teams/${selectedTeam.team_id}`);
      setTeamDetail(res.data?.data || null);
      await fetchTeams();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove member');
    } finally {
      setRemovingMemberId(null);
    }
  }, [selectedTeam, fetchTeams]);

  // ------------------------------------------
  // Add Category Routing
  // ------------------------------------------
  const handleAddRouting = useCallback(async () => {
    if (!selectedTeam || !selectedCategoryId) return;
    setAddingRouting(true);
    try {
      await api.post('/teams/routing', { team_id: selectedTeam.team_id, category_id: selectedCategoryId });
      toast.success('Category routing added');
      setSelectedCategoryId('');
      const res = await api.get(`/teams/${selectedTeam.team_id}`);
      setTeamDetail(res.data?.data || null);
      await fetchRoutings();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add routing');
    } finally {
      setAddingRouting(false);
    }
  }, [selectedTeam, selectedCategoryId, fetchRoutings]);

  // ------------------------------------------
  // Remove Routing
  // ------------------------------------------
  const handleRemoveRouting = useCallback(async (routingId) => {
    setRemovingRoutingId(routingId);
    try {
      await api.delete(`/teams/routing/${routingId}`);
      toast.success('Routing rule removed');
      if (selectedTeam) {
        const res = await api.get(`/teams/${selectedTeam.team_id}`);
        setTeamDetail(res.data?.data || null);
      }
      await fetchRoutings();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove routing rule');
    } finally {
      setRemovingRoutingId(null);
    }
  }, [selectedTeam, fetchRoutings]);

  // ------------------------------------------
  // Derived Data
  // ------------------------------------------
  const filteredTeams = useMemo(() => {
    const q = search.toLowerCase();
    return teams.filter(t =>
      !q || t.team_name.toLowerCase().includes(q) || t.team_code.toLowerCase().includes(q)
    );
  }, [teams, search]);

  const membersInTeam = useMemo(() => (teamDetail?.members || []).map(m => m.user_id), [teamDetail]);

  const availableUsers = useMemo(() =>
    allUsers.filter(u => !membersInTeam.includes(u.user_id)),
    [allUsers, membersInTeam]
  );

  const usedCategoryIds = useMemo(() =>
    (teamDetail?.category_routing || []).map(r => r.category_id),
    [teamDetail]
  );

  // Categories already routed to OTHER teams (global rules)
  const globallyRoutedCategoryIds = useMemo(() =>
    allRoutings
      .filter(r => r.team_id !== selectedTeam?.team_id)
      .map(r => r.category_id),
    [allRoutings, selectedTeam]
  );

  const availableCategories = useMemo(() =>
    allCategories.filter(c =>
      !usedCategoryIds.includes(c.category_id) &&
      !globallyRoutedCategoryIds.includes(c.category_id)
    ),
    [allCategories, usedCategoryIds, globallyRoutedCategoryIds]
  );

  // Stats
  const totalMembers  = useMemo(() => teams.reduce((s, t) => s + (t.member_count || 0), 0), [teams]);
  const totalInQueue  = useMemo(() => teams.reduce((s, t) => s + (t.unassigned_ticket_count || 0), 0), [teams]);
  const centralTeam   = useMemo(() => teams.find(t => t.is_central), [teams]);

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="teams-page">
      {/* PAGE HEADER */}
      <div className="teams-header">
        <div className="teams-header__left">
          <div className="teams-header__icon">
            <UsersRound size={22} />
          </div>
          <div>
            <h1 className="teams-header__title">Team Management</h1>
            <p className="teams-header__subtitle">
              Manage support teams, members, and ticket routing rules
            </p>
          </div>
        </div>
        <div className="teams-header__right">
          <button className="teams-btn teams-btn--ghost" onClick={() => { fetchTeams(); fetchRoutings(); }}>
            <RefreshCw size={15} />
          </button>
          <button className="teams-btn teams-btn--primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={15} /> New Team
          </button>
        </div>
      </div>

      {/* STATS ROW */}
      <div className="teams-stats-row">
        <div className="teams-stat-card">
          <UsersRound size={20} className="teams-stat-card__icon teams-stat-card__icon--purple" />
          <div className="teams-stat-card__info">
            <span className="teams-stat-card__value">{teams.length}</span>
            <span className="teams-stat-card__label">Active Teams</span>
          </div>
        </div>
        <div className="teams-stat-card">
          <Users size={20} className="teams-stat-card__icon teams-stat-card__icon--blue" />
          <div className="teams-stat-card__info">
            <span className="teams-stat-card__value">{totalMembers}</span>
            <span className="teams-stat-card__label">Total Members</span>
          </div>
        </div>
        <div className="teams-stat-card">
          <FolderKanban size={20} className="teams-stat-card__icon teams-stat-card__icon--amber" />
          <div className="teams-stat-card__info">
            <span className="teams-stat-card__value">{totalInQueue}</span>
            <span className="teams-stat-card__label">In Queues</span>
          </div>
        </div>
        {centralTeam && (
          <div className="teams-stat-card teams-stat-card--central">
            <Crown size={20} className="teams-stat-card__icon teams-stat-card__icon--gold" />
            <div className="teams-stat-card__info">
              <span className="teams-stat-card__value">{centralTeam.team_name}</span>
              <span className="teams-stat-card__label">Central Team</span>
            </div>
          </div>
        )}
      </div>

      {/* TABS */}
      <div className="teams-tabs">
        <button
          className={`teams-tab ${activeTab === 'teams' ? 'teams-tab--active' : ''}`}
          onClick={() => setActiveTab('teams')}
        >
          <UsersRound size={15} /> Teams
        </button>
        <button
          className={`teams-tab ${activeTab === 'routing' ? 'teams-tab--active' : ''}`}
          onClick={() => setActiveTab('routing')}
        >
          <Link size={15} /> Routing Rules
          <span className="teams-tab__badge">{allRoutings.length}</span>
        </button>
      </div>

      {/* TEAMS TAB */}
      {activeTab === 'teams' && (
        <div className="teams-layout">
          {/* LEFT — Team list */}
          <div className="teams-list-panel">
            <div className="teams-search-bar">
              <Search size={15} />
              <input
                type="text"
                placeholder="Search teams..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && <button onClick={() => setSearch('')}><X size={14} /></button>}
            </div>

            {loading ? (
              <div className="teams-loading"><Loader size={22} className="spin" /> Loading teams...</div>
            ) : filteredTeams.length === 0 ? (
              <div className="teams-empty">
                <UsersRound size={36} />
                <p>No teams found</p>
                <button className="teams-btn teams-btn--primary" onClick={() => setShowCreateModal(true)}>
                  <Plus size={14} /> Create First Team
                </button>
              </div>
            ) : (
              <div className="teams-cards-grid">
                {filteredTeams.map(team => (
                  <TeamCard
                    key={team.team_id}
                    team={team}
                    isSelected={selectedTeam?.team_id === team.team_id}
                    onView={handleViewTeam}
                    onEdit={t => setEditingTeam(t)}
                    onDelete={t => setDeletingTeam(t)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* RIGHT — Team detail panel */}
          {selectedTeam && (
            <div className="teams-detail-panel">
              <div className="teams-detail__header">
                <div className="teams-detail__title-row">
                  <div className="teams-detail__icon" style={{
                    background: selectedTeam.is_central
                      ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                      : 'linear-gradient(135deg, #6366f1, #818cf8)'
                  }}>
                    {selectedTeam.is_central ? <Crown size={18} /> : <UsersRound size={18} />}
                  </div>
                  <div>
                    <h2 className="teams-detail__name">
                      {selectedTeam.team_name}
                      {selectedTeam.is_central && <span className="teams-card__central-badge">Central</span>}
                    </h2>
                    <span className="teams-detail__code">{selectedTeam.team_code}</span>
                  </div>
                </div>
                <button className="teams-detail__close" onClick={() => { setSelectedTeam(null); setTeamDetail(null); }}>
                  <X size={16} />
                </button>
              </div>

              {detailLoading ? (
                <div className="teams-loading"><Loader size={20} className="spin" /></div>
              ) : teamDetail ? (
                <>
                  {/* Members Section */}
                  <div className="teams-detail__section">
                    <div className="teams-detail__section-title">
                      <Users size={15} /> Members ({teamDetail.members?.length || 0})
                    </div>

                    {/* Add Member */}
                    <div className="teams-detail__add-row">
                      <select
                        value={selectedUserId}
                        onChange={e => setSelectedUserId(e.target.value)}
                        className="teams-select"
                      >
                        <option value="">-- Add user to team --</option>
                        {availableUsers.map(u => (
                          <option key={u.user_id} value={u.user_id}>
                            {u.full_name} — {u.role_code}
                          </option>
                        ))}
                      </select>
                      <button
                        className="teams-btn teams-btn--primary teams-btn--sm"
                        onClick={handleAddMember}
                        disabled={!selectedUserId || addingMember}
                      >
                        {addingMember ? <Loader size={13} className="spin" /> : <UserPlus size={13} />}
                      </button>
                    </div>

                    <div className="teams-members-list">
                      {(!teamDetail.members || teamDetail.members.length === 0) ? (
                        <div className="teams-detail__empty-hint">No members yet</div>
                      ) : teamDetail.members.map(m => (
                        <div key={m.member_id} className="teams-member-row">
                          <div className="teams-member-avatar">
                            {m.full_name?.charAt(0)?.toUpperCase()}
                          </div>
                          <div className="teams-member-info">
                            <span className="teams-member-name">{m.full_name}</span>
                            <span className="teams-member-role">{m.role_code}</span>
                          </div>
                          <button
                            className="teams-btn teams-btn--ghost teams-btn--sm"
                            title="Remove from team"
                            onClick={() => handleRemoveMember(m.user_id)}
                            disabled={removingMemberId === m.user_id}
                          >
                            {removingMemberId === m.user_id
                              ? <Loader size={13} className="spin" />
                              : <UserMinus size={13} />}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Category Routing Section — not shown for central team */}
                  {!selectedTeam.is_central && (
                    <div className="teams-detail__section">
                      <div className="teams-detail__section-title">
                        <Tag size={15} /> Category Routing ({teamDetail.category_routing?.length || 0})
                      </div>
                      <p className="teams-detail__section-hint">
                        Tickets with these categories are routed to this team after central validation.
                      </p>

                      <div className="teams-detail__add-row">
                        <select
                          value={selectedCategoryId}
                          onChange={e => setSelectedCategoryId(e.target.value)}
                          className="teams-select"
                        >
                          <option value="">-- Map a category --</option>
                          {availableCategories.map(c => (
                            <option key={c.category_id} value={c.category_id}>{c.category_name}</option>
                          ))}
                        </select>
                        <button
                          className="teams-btn teams-btn--primary teams-btn--sm"
                          onClick={handleAddRouting}
                          disabled={!selectedCategoryId || addingRouting}
                        >
                          {addingRouting ? <Loader size={13} className="spin" /> : <Link size={13} />}
                        </button>
                      </div>

                      <div className="teams-routing-list">
                        {(!teamDetail.category_routing || teamDetail.category_routing.length === 0) ? (
                          <div className="teams-detail__empty-hint">No category mappings yet</div>
                        ) : teamDetail.category_routing.map(r => (
                          <div key={r.routing_id} className="teams-routing-row">
                            <Tag size={13} className="teams-routing-row__icon" />
                            <span>{r.category_name}</span>
                            <span className="teams-routing-row__code">{r.category_code}</span>
                            <button
                              className="teams-btn teams-btn--ghost teams-btn--sm"
                              onClick={() => handleRemoveRouting(r.routing_id)}
                              disabled={removingRoutingId === r.routing_id}
                            >
                              {removingRoutingId === r.routing_id
                                ? <Loader size={13} className="spin" />
                                : <Unlink size={13} />}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedTeam.is_central && (
                    <div className="teams-detail__section">
                      <div className="teams-alert teams-alert--info">
                        <AlertCircle size={14} />
                        This is the Central Ticketing Team. All new tickets are routed here first. Add staff who manage the central inbox as members.
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* ROUTING TAB — All category→team rules in a table */}
      {activeTab === 'routing' && (
        <div className="teams-routing-table-wrapper">
          <table className="teams-routing-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Category Code</th>
                <th>Routed To Team</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {allRoutings.length === 0 ? (
                <tr>
                  <td colSpan={4} className="teams-routing-table__empty">
                    No routing rules configured. Open a team and map categories to it.
                  </td>
                </tr>
              ) : allRoutings.map(r => (
                <tr key={r.routing_id}>
                  <td>{r.category_name}</td>
                  <td><code>{r.category_code}</code></td>
                  <td>
                    <span className="teams-routing-table__team-badge">
                      <UsersRound size={12} /> {r.team_name}
                    </span>
                  </td>
                  <td>
                    <button
                      className="teams-btn teams-btn--ghost teams-btn--sm"
                      onClick={() => handleRemoveRouting(r.routing_id)}
                      disabled={removingRoutingId === r.routing_id}
                    >
                      {removingRoutingId === r.routing_id ? <Loader size={13} className="spin" /> : <Unlink size={13} />}
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ========== MODALS ========== */}

      {/* Create Modal */}
      {showCreateModal && (
        <TeamFormModal
          users={allUsers}
          onClose={() => setShowCreateModal(false)}
          onSave={handleSaveTeam}
        />
      )}

      {/* Edit Modal */}
      {editingTeam && (
        <TeamFormModal
          team={editingTeam}
          users={allUsers}
          onClose={() => setEditingTeam(null)}
          onSave={handleSaveTeam}
        />
      )}

      {/* Delete Confirmation */}
      {deletingTeam && (
        <div className="teams-modal-overlay" onClick={() => setDeletingTeam(null)}>
          <div className="teams-modal teams-modal--sm" onClick={e => e.stopPropagation()}>
            <div className="teams-modal__header">
              <h2>Deactivate Team</h2>
              <button className="teams-modal__close" onClick={() => setDeletingTeam(null)}><X size={18} /></button>
            </div>
            <div className="teams-modal__body">
              <div className="teams-alert teams-alert--warning">
                <AlertCircle size={15} />
                Are you sure you want to deactivate <strong>{deletingTeam.team_name}</strong>?
                The team will be hidden from the system. Active tickets in its queue must be reassigned first.
              </div>
            </div>
            <div className="teams-modal__footer">
              <button className="teams-btn teams-btn--ghost" onClick={() => setDeletingTeam(null)}>Cancel</button>
              <button className="teams-btn teams-btn--danger" onClick={handleDeleteTeam} disabled={deleting}>
                {deleting ? <Loader size={15} className="spin" /> : <Trash2 size={15} />}
                Deactivate Team
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamsPage;

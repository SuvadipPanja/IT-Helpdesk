/**
 * ============================================
 * USERS LIST PAGE - MODERNIZED
 * ============================================
 * Production-Ready User Management Interface
 * 
 * FEATURES:
 * - Modern glassmorphism UI design
 * - Toast notifications for all actions
 * - Memoized components for performance
 * - Accessibility compliant (ARIA)
 * - Responsive design
 * - Profile picture support
 * - Password expiry management
 * - Search & Filter
 * - Dark theme support
 * 
 * Developer: Suvadip Panja
 * Company: Digitide
 * Version: 2.0.0
 * Updated: February 2026
 * FILE: frontend/src/pages/users/UsersList.jsx
 * ============================================
 */

import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  User,
  Users as UsersIcon,
  Mail,
  Phone,
  Shield,
  Building,
  CheckCircle,
  XCircle,
  Loader,
  AlertCircle,
  Clock,
  AlertTriangle,
  KeyRound,
  CalendarClock,
  ShieldCheck,
  Filter,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  UserX,
  ShieldAlert,
  Download,
  MoreVertical,
  Eye,
  Lock,
  Unlock,
  Skull
} from 'lucide-react';
import api from '../../services/api';
import { API_BASE_URL } from '../../utils/constants';
import SkeletonTable from '../../components/common/SkeletonLoader';
import CreateUserModal from '../../components/users/CreateUserModal';
import EditUserModal from '../../components/users/EditUserModal';
import { formatShortDate, formatTime } from '../../utils/dateUtils';
import RefreshButton from '../../components/shared/RefreshButton';
import '../../styles/UsersList.css';

// ============================================
// CONSTANTS
// ============================================
const ITEMS_PER_PAGE = 20;

// ============================================
// STATS CARD COMPONENT (Memoized)
// ============================================
const StatsCard = memo(({ icon: Icon, label, value, color, bgColor, trend, onClick, isActive }) => (
  <button
    type="button"
    className={`user-stats-card ${isActive ? 'active' : ''}`}
    onClick={onClick}
    style={{ '--card-color': color, '--card-bg': bgColor }}
  >
    <div className="user-stats-icon">
      <Icon size={22} />
    </div>
    <div className="user-stats-info">
      <span className="user-stats-value">{value}</span>
      <span className="user-stats-label">{label}</span>
    </div>
    {trend && (
      <span className={`user-stats-trend ${trend > 0 ? 'positive' : 'negative'}`}>
        {trend > 0 ? '+' : ''}{trend}%
      </span>
    )}
  </button>
));

StatsCard.displayName = 'StatsCard';

// ============================================
// USER ROW COMPONENT (Memoized)
// ============================================
const UserRow = memo(({ 
  userItem, 
  onEdit, 
  onDelete,
  onHardDelete,
  canHardDelete,
  onExtendPassword, 
  onForceReset,
  onUnlock,
  extendingPasswordFor,
  forcingResetFor,
  unlockingFor,
  getProfilePictureUrl,
  getPasswordExpiryStatus,
  formatDate
}) => {
  const isProtectedAdminAccount = String(userItem.username || '').trim().toLowerCase() === 'admin';
  const passwordStatus = getPasswordExpiryStatus(userItem.password_expires_at);
  const StatusIcon = passwordStatus.icon;
  const profilePicUrl = getProfilePictureUrl(userItem);

  return (
    <tr className="user-row">
      {/* User Info */}
      <td className="td-user">
        <div className="user-info">
          <div className="user-avatar">
            {profilePicUrl ? (
              <img 
                src={profilePicUrl} 
                alt={userItem.username}
                className="avatar-image"
                onError={(e) => {
                  e.target.style.display = 'none';
                  const iconElement = e.target.parentElement.querySelector('.avatar-icon');
                  if (iconElement) iconElement.style.display = 'flex';
                }}
              />
            ) : null}
            <div 
              className="avatar-icon" 
              style={{ display: profilePicUrl ? 'none' : 'flex' }}
            >
              <User size={18} />
            </div>
          </div>
          <div className="user-details">
            <div className="user-name">{userItem.full_name}</div>
            <div className="user-username">@{userItem.username}</div>
          </div>
        </div>
      </td>

      {/* Contact */}
      <td className="td-contact">
        <div className="contact-info">
          <div className="contact-item">
            <Mail size={13} />
            <span>{userItem.email}</span>
          </div>
          {userItem.phone_number && (
            <div className="contact-item">
              <Phone size={13} />
              <span>{userItem.phone_number}</span>
            </div>
          )}
        </div>
      </td>

      {/* Role & Department */}
      <td className="td-role">
        <div className="role-dept-stack">
          <span className="role-badge-small">
            <Shield size={12} />
            {userItem.role_name}
          </span>
          {isProtectedAdminAccount && (
            <span className="status-badge-small status-locked">
              <Lock size={12} />
              Protected
            </span>
          )}
          {userItem.department_name && (
            <span className="dept-badge-small">
              <Building size={12} />
              {userItem.department_name}
            </span>
          )}
        </div>
      </td>

      {/* Password Status */}
      <td className="td-password">
        <div className="password-compact">
          <div className={`pwd-badge pwd-${passwordStatus.color}`}>
            <StatusIcon size={12} />
            <span>{passwordStatus.text}</span>
            {passwordStatus.detail && (
              <span className="pwd-detail">{passwordStatus.detail}</span>
            )}
          </div>
          
          {passwordStatus.status !== 'valid' && (
            <div className="pwd-actions">
              <button
                type="button"
                className="pwd-btn pwd-btn-extend"
                onClick={() => onExtendPassword(userItem.user_id, userItem.username)}
                disabled={extendingPasswordFor === userItem.user_id}
                title="Extend 90 days"
                aria-label="Extend password expiry"
              >
                {extendingPasswordFor === userItem.user_id ? (
                  <Loader size={12} className="spinner-icon" />
                ) : (
                  <CalendarClock size={12} />
                )}
              </button>
              <button
                type="button"
                className="pwd-btn pwd-btn-reset"
                onClick={() => onForceReset(userItem.user_id, userItem.username)}
                disabled={forcingResetFor === userItem.user_id}
                title="Force Reset"
                aria-label="Force password reset"
              >
                {forcingResetFor === userItem.user_id ? (
                  <Loader size={12} className="spinner-icon" />
                ) : (
                  <KeyRound size={12} />
                )}
              </button>
            </div>
          )}
        </div>
      </td>

      {/* Status */}
      <td className="td-status">
        <div className="status-login-stack">
          {userItem.is_locked ? (
            <span className="status-badge-small status-locked">
              <Lock size={12} />
              Locked
            </span>
          ) : userItem.is_active ? (
            <span className="status-badge-small status-active">
              <CheckCircle size={12} />
              Active
            </span>
          ) : (
            <span className="status-badge-small status-inactive">
              <XCircle size={12} />
              Inactive
            </span>
          )}
          {userItem.is_locked && userItem.locked_until && (
            <span className="locked-until-small">
              <Clock size={10} />
              Until {formatTime(userItem.locked_until)}
            </span>
          )}
          {!userItem.is_locked && userItem.failed_login_attempts > 0 && (
            <span className="failed-attempts-small">
              <AlertTriangle size={10} />
              {userItem.failed_login_attempts} failed attempt{userItem.failed_login_attempts !== 1 ? 's' : ''}
            </span>
          )}
          {!userItem.is_locked && userItem.failed_login_attempts === 0 && (
            <span className="last-login-small">
              <Clock size={10} />
              {formatDate(userItem.last_login)}
            </span>
          )}
        </div>
      </td>

      {/* Actions */}
      <td className="td-actions">
        <div className="action-buttons-compact">
          {(userItem.is_locked || userItem.failed_login_attempts > 0) && (
            <button
              type="button"
              className={`btn-icon-small ${userItem.is_locked ? 'btn-unlock' : 'btn-reset-attempts'}`}
              onClick={() => onUnlock(userItem.user_id, userItem.username)}
              disabled={unlockingFor === userItem.user_id}
              title={userItem.is_locked ? 'Unlock Account' : 'Reset Failed Attempts'}
              aria-label={userItem.is_locked ? 'Unlock user account' : 'Reset failed login attempts'}
            >
              {unlockingFor === userItem.user_id ? (
                <Loader size={14} className="spinner-icon" />
              ) : (
                <Unlock size={14} />
              )}
            </button>
          )}
          <button
            type="button"
            className="btn-icon-small btn-edit"
            onClick={() => onEdit(userItem)}
            title="Edit User"
            aria-label="Edit user"
          >
            <Edit size={14} />
          </button>
          {!isProtectedAdminAccount && (
            <button
              type="button"
              className="btn-icon-small btn-delete"
              onClick={() => onDelete(userItem.user_id, userItem.username)}
              title="Deactivate User"
              aria-label="Deactivate user"
            >
              <Trash2 size={14} />
            </button>
          )}
          {canHardDelete && !isProtectedAdminAccount && (
            <button
              type="button"
              className="btn-icon-small btn-hard-delete"
              onClick={() => onHardDelete(userItem.user_id, userItem.username)}
              title="Permanently Delete User (irreversible)"
              aria-label="Permanently delete user"
            >
              <Skull size={14} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
});

UserRow.displayName = 'UserRow';

// ============================================
// EMPTY STATE COMPONENT (Memoized)
// ============================================
const EmptyState = memo(({ hasFilters }) => (
  <tr>
    <td colSpan="6" className="empty-state">
      <div className="empty-state-content">
        <div className="empty-state-icon">
          <UsersIcon size={48} />
        </div>
        <h3>No users found</h3>
        <p>
          {hasFilters 
            ? 'Try adjusting your filters or search query'
            : 'Start by creating your first user'
          }
        </p>
      </div>
    </td>
  </tr>
));

EmptyState.displayName = 'EmptyState';

// ============================================
// LOADING STATE COMPONENT (Memoized)
// ============================================
const LoadingState = memo(() => (
  <div className="user-loading-state">
    <SkeletonTable rows={ITEMS_PER_PAGE} columns={7} />
  </div>
));

LoadingState.displayName = 'LoadingState';

// ============================================
// ACCESS DENIED COMPONENT (Memoized)
// ============================================
const AccessDenied = memo(() => (
  <div className="user-access-denied">
    <div className="access-denied-icon">
      <ShieldAlert size={64} />
    </div>
    <h2>Access Denied</h2>
    <p>You do not have permission to manage users</p>
  </div>
));

AccessDenied.displayName = 'AccessDenied';

// ============================================
// MAIN COMPONENT
// ============================================
const UsersList = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  // ============================================
  // STATE
  // ============================================
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Global stats (unfiltered, from API)
  const [globalStats, setGlobalStats] = useState({ total: 0, active: 0, inactive: 0, locked: 0 });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedPasswordStatus, setSelectedPasswordStatus] = useState('');

  // Dropdown data
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [processes, setProcesses] = useState([]);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Password action loading states
  const [extendingPasswordFor, setExtendingPasswordFor] = useState(null);
  const [forcingResetFor, setForcingResetFor] = useState(null);
  const [unlockingFor, setUnlockingFor] = useState(null);

  // ============================================
  // PERMISSION CHECK
  // ============================================
  const canManageUsers = useMemo(() => 
    user?.permissions?.can_manage_users === true,
    [user]
  );

  // Hard delete is ADMIN role only (not just can_manage_users)
  const isCurrentUserAdmin = useMemo(() =>
    user?.role?.role_code === 'ADMIN',
    [user]
  );

  // ============================================
  // FETCH USERS
  // ============================================
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const params = {
        page: currentPage,
        limit: ITEMS_PER_PAGE,
      };

      if (debouncedSearch) params.search = debouncedSearch;
      if (selectedRole) params.role_id = selectedRole;
      if (selectedDepartment) params.department_id = selectedDepartment;
      if (selectedStatus) params.is_active = selectedStatus;

      const response = await api.get('/users', { params });

      if (response.data.success) {
        setUsers(response.data.data.users);
        setTotalPages(response.data.data.pagination.totalPages);
        setTotalRecords(response.data.data.pagination.totalRecords);
        if (response.data.data.stats) {
          setGlobalStats(response.data.data.stats);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load users');
      showToast('Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  }, [currentPage, debouncedSearch, selectedRole, selectedDepartment, selectedStatus, showToast]);

  // ============================================
  // FETCH DROPDOWN DATA
  // ============================================
  const fetchRoles = useCallback(async () => {
    try {
      const response = await api.get('/system/roles');
      if (response.data.success) {
        setRoles(response.data.data || []);
      }
    } catch (err) {
    }
  }, []);

  const fetchDepartments = useCallback(async () => {
    try {
      const response = await api.get('/system/departments');
      if (response.data.success) {
        setDepartments(response.data.data || []);
      }
    } catch (err) {
    }
  }, []);

  const fetchLocations = useCallback(async () => {
    try {
      const response = await api.get('/system/locations');
      if (response.data.success) {
        setLocations(response.data.data || []);
      }
    } catch (err) {
    }
  }, []);

  const fetchProcesses = useCallback(async () => {
    try {
      const response = await api.get('/system/processes');
      if (response.data.success) {
        setProcesses(response.data.data || []);
      }
    } catch (err) {
    }
  }, []);

  // ============================================
  // EFFECTS
  // ============================================
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    if (canManageUsers) {
      fetchUsers();
    }
  }, [canManageUsers, fetchUsers]);

  useEffect(() => {
    if (canManageUsers) {
      fetchRoles();
      fetchDepartments();
      fetchLocations();
      fetchProcesses();
    }
  }, [canManageUsers, fetchRoles, fetchDepartments, fetchLocations, fetchProcesses]);

  // ============================================
  // PASSWORD EXPIRY STATUS
  // ============================================
  const getPasswordExpiryStatus = useCallback((passwordExpiresAt) => {
    if (!passwordExpiresAt) {
      return { 
        status: 'valid', 
        daysRemaining: 999, 
        text: 'Valid', 
        color: 'success',
        icon: ShieldCheck
      };
    }

    const expiryDate = new Date(passwordExpiresAt);
    const now = new Date();
    const diffTime = expiryDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { 
        status: 'expired', 
        daysRemaining: Math.abs(diffDays), 
        text: 'Expired', 
        color: 'danger',
        icon: AlertTriangle,
        detail: `${Math.abs(diffDays)}d ago`
      };
    } else if (diffDays <= 7) {
      return { 
        status: 'expiring', 
        daysRemaining: diffDays, 
        text: 'Expiring', 
        color: 'warning',
        icon: Clock,
        detail: `${diffDays}d`
      };
    } else {
      return { 
        status: 'valid', 
        daysRemaining: diffDays, 
        text: 'Valid', 
        color: 'success',
        icon: ShieldCheck,
        detail: `${diffDays}d`
      };
    }
  }, []);

  // ============================================
  // GET PROFILE PICTURE URL
  // ============================================
  const getProfilePictureUrl = useCallback((userItem) => {
    const profilePicture = userItem?.profile_picture;
    
    if (!profilePicture) return null;
    
    if (profilePicture.startsWith('http://') || profilePicture.startsWith('https://')) {
      return profilePicture;
    }
    
    // P1 #51 FIX: Use centralized constant instead of window.location
    const baseURL = API_BASE_URL.replace('/api/v1', '');
    const cleanPath = profilePicture.startsWith('/') ? profilePicture : `/${profilePicture}`;
    
    return `${baseURL}${cleanPath}`;
  }, []);

  // ============================================
  // HANDLERS
  // ============================================
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchUsers();
    showToast('Users list refreshed', 'success');
    setTimeout(() => setIsRefreshing(false), 500);
  }, [fetchUsers, showToast]);

  const handleSearch = useCallback((e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedRole('');
    setSelectedDepartment('');
    setSelectedStatus('');
    setSelectedPasswordStatus('');
    setCurrentPage(1);
    showToast('Filters cleared', 'info');
  }, [showToast]);

  const handleEditUser = useCallback((userItem) => {
    setSelectedUser(userItem);
    setShowEditModal(true);
    showToast(`Editing ${userItem.full_name}`, 'info');
  }, [showToast]);

  const handleDeleteUser = useCallback(async (userId, username) => {
    try {
      const response = await api.delete(`/users/${userId}`);
      if (response.data.success) {
        showToast(`User "${username}" deactivated successfully`, 'success');
        fetchUsers();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to deactivate user', 'error');
    }
  }, [fetchUsers, showToast]);

  const handleHardDeleteUser = useCallback(async (userId, username) => {
    const confirmed = window.confirm(
      `⚠️ PERMANENT DELETE\n\nThis will PERMANENTLY remove "${username}" from the database.\n\nThis action CANNOT be undone. All their assigned tickets will be unassigned.\n\nAre you absolutely sure?`
    );
    if (!confirmed) return;
    try {
      const response = await api.delete(`/users/${userId}/hard-delete`);
      if (response.data.success) {
        showToast(`User "${username}" permanently deleted`, 'success');
        fetchUsers();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to permanently delete user', 'error');
    }
  }, [fetchUsers, showToast]);

  const handleExtendPasswordExpiry = useCallback(async (userId, username) => {
    try {
      setExtendingPasswordFor(userId);
      const response = await api.put(`/users/${userId}/extend-password-expiry`);

      if (response.data.success) {
        showToast(`Password expiry extended for "${username}"`, 'success');
        fetchUsers();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to extend password expiry', 'error');
    } finally {
      setExtendingPasswordFor(null);
    }
  }, [fetchUsers, showToast]);

  const handleForcePasswordReset = useCallback(async (userId, username) => {
    try {
      setForcingResetFor(userId);
      const response = await api.put(`/users/${userId}/force-password-reset`);

      if (response.data.success) {
        showToast(`Password reset forced for "${username}"`, 'success');
        fetchUsers();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to force password reset', 'error');
    } finally {
      setForcingResetFor(null);
    }
  }, [fetchUsers, showToast]);

  const handleUnlockUser = useCallback(async (userId, username) => {
    try {
      setUnlockingFor(userId);
      const response = await api.put(`/users/${userId}/unlock`);

      if (response.data.success) {
        showToast(response.data.message || `Account "${username}" unlocked successfully`, 'success');
        fetchUsers();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to unlock account', 'error');
    } finally {
      setUnlockingFor(null);
    }
  }, [fetchUsers, showToast]);

  const handleCreateSuccess = useCallback(() => {
    setShowCreateModal(false);
    showToast('User created successfully', 'success');
    fetchUsers();
  }, [fetchUsers, showToast]);

  const handleEditSuccess = useCallback(() => {
    setShowEditModal(false);
    setSelectedUser(null);
    showToast('User updated successfully', 'success');
    fetchUsers();
  }, [fetchUsers, showToast]);

  const formatDate = useCallback((dateString) => {
    if (!dateString) return 'Never';
    return formatShortDate(dateString);
  }, []);

  // ============================================
  // COMPUTED VALUES
  // ============================================
  const passwordStats = useMemo(() => ({
    expired: users.filter(u => getPasswordExpiryStatus(u.password_expires_at).status === 'expired').length,
    expiring: users.filter(u => getPasswordExpiryStatus(u.password_expires_at).status === 'expiring').length,
  }), [users, getPasswordExpiryStatus]);

  // Use server-side global stats for accurate counts across all pages
  const activeUsers = globalStats.active;
  const inactiveUsers = globalStats.inactive;
  const lockedUsers = globalStats.locked;

  const filteredUsers = useMemo(() => 
    selectedPasswordStatus
      ? users.filter(u => getPasswordExpiryStatus(u.password_expires_at).status === selectedPasswordStatus)
      : users,
    [users, selectedPasswordStatus, getPasswordExpiryStatus]
  );

  const hasFilters = useMemo(() => 
    debouncedSearch || selectedRole || selectedDepartment || selectedStatus || selectedPasswordStatus,
    [debouncedSearch, selectedRole, selectedDepartment, selectedStatus, selectedPasswordStatus]
  );

  // ============================================
  // RENDER GUARDS
  // ============================================
  if (!user) {
    return (
      <div className="users-page">
        <LoadingState />
      </div>
    );
  }

  if (!canManageUsers) {
    return (
      <div className="users-page">
        <AccessDenied />
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="users-page">
      {/* Page Header */}
      <header className="users-header">
        <div className="users-header-content">
          <div className="users-header-icon">
            <UsersIcon size={28} />
          </div>
          <div className="users-header-text">
            <h1 className="users-title">Users Management</h1>
            <p className="users-subtitle">
              Manage {totalRecords} system user{totalRecords !== 1 ? 's' : ''} and permissions
            </p>
          </div>
        </div>

        <div className="users-header-actions">
          <RefreshButton
            onClick={handleRefresh}
            loading={isRefreshing}
            label="Refresh"
          />
          
          <button
            type="button"
            className="users-btn primary"
            onClick={() => {
              setShowCreateModal(true);
              showToast('Opening create user form', 'info');
            }}
            aria-label="Create new user"
          >
            <Plus size={18} />
            <span>Create User</span>
          </button>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="users-stats-grid">
        <StatsCard
          icon={UsersIcon}
          label="Total Users"
          value={totalRecords}
          color="#6366f1"
          bgColor="rgba(99, 102, 241, 0.1)"
          onClick={() => {
            setSelectedStatus('');
            setSelectedPasswordStatus('');
          }}
          isActive={!selectedStatus && !selectedPasswordStatus}
        />
        <StatsCard
          icon={UserCheck}
          label="Active"
          value={activeUsers}
          color="#22c55e"
          bgColor="rgba(34, 197, 94, 0.1)"
          onClick={() => {
            setSelectedStatus('true');
            setSelectedPasswordStatus('');
            showToast('Showing active users', 'info');
          }}
          isActive={selectedStatus === 'true'}
        />
        <StatsCard
          icon={UserX}
          label="Inactive"
          value={inactiveUsers}
          color="#64748b"
          bgColor="rgba(100, 116, 139, 0.1)"
          onClick={() => {
            setSelectedStatus('false');
            setSelectedPasswordStatus('');
            showToast('Showing inactive users', 'info');
          }}
          isActive={selectedStatus === 'false'}
        />
        <StatsCard
          icon={Lock}
          label="Locked"
          value={lockedUsers}
          color="#dc2626"
          bgColor="rgba(220, 38, 38, 0.1)"
          onClick={() => {
            showToast(lockedUsers > 0 ? `${lockedUsers} locked account(s)` : 'No locked accounts', lockedUsers > 0 ? 'warning' : 'info');
          }}
        />
        <StatsCard
          icon={AlertTriangle}
          label="Pwd Expired"
          value={passwordStats.expired}
          color="#ef4444"
          bgColor="rgba(239, 68, 68, 0.1)"
          onClick={() => {
            setSelectedPasswordStatus('expired');
            showToast('Showing users with expired passwords', 'info');
          }}
          isActive={selectedPasswordStatus === 'expired'}
        />
        <StatsCard
          icon={Clock}
          label="Pwd Expiring"
          value={passwordStats.expiring}
          color="#f59e0b"
          bgColor="rgba(245, 158, 11, 0.1)"
          onClick={() => {
            setSelectedPasswordStatus('expiring');
            showToast('Showing users with expiring passwords', 'info');
          }}
          isActive={selectedPasswordStatus === 'expiring'}
        />
      </div>

      {/* Toolbar */}
      <div className="users-toolbar">
        <div className="users-toolbar-left">
          {/* Search */}
          <div className="users-search">
            <Search size={18} className="users-search-icon" />
            <input
              type="text"
              placeholder="Search by name, email, username..."
              value={searchQuery}
              onChange={handleSearch}
              className="users-search-input"
              aria-label="Search users"
            />
            {searchQuery && (
              <button
                type="button"
                className="users-search-clear"
                onClick={() => {
                  setSearchQuery('');
                  showToast('Search cleared', 'info');
                }}
                aria-label="Clear search"
              >
                <XCircle size={16} />
              </button>
            )}
          </div>

          {/* Filter Dropdowns */}
          <select
            className="users-filter-select"
            value={selectedRole}
            onChange={(e) => {
              setSelectedRole(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Filter by role"
          >
            <option value="">All Roles</option>
            {roles.map(role => (
              <option key={role.role_id} value={role.role_id}>
                {role.role_name}
              </option>
            ))}
          </select>

          <select
            className="users-filter-select"
            value={selectedDepartment}
            onChange={(e) => {
              setSelectedDepartment(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Filter by department"
          >
            <option value="">All Departments</option>
            {departments.map(dept => (
              <option key={dept.department_id} value={dept.department_id}>
                {dept.department_name}
              </option>
            ))}
          </select>
        </div>

        <div className="users-toolbar-right">
          {hasFilters && (
            <button
              type="button"
              className="users-btn-clear"
              onClick={clearFilters}
            >
              <XCircle size={16} />
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="users-error-alert" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button 
            type="button"
            onClick={() => setError('')}
            aria-label="Dismiss error"
          >
            <XCircle size={16} />
          </button>
        </div>
      )}

      {/* Users Table */}
      <div className="users-table-container">
        {loading && users.length === 0 ? (
          <LoadingState />
        ) : (
          <table className="users-table" role="grid">
            <thead>
              <tr>
                <th className="th-user">User</th>
                <th className="th-contact">Contact</th>
                <th className="th-role">Role / Department</th>
                <th className="th-password">Password</th>
                <th className="th-status">Status</th>
                <th className="th-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <EmptyState hasFilters={hasFilters} />
              ) : (
                filteredUsers.map((userItem) => (
                  <UserRow
                    key={userItem.user_id}
                    userItem={userItem}
                    onEdit={handleEditUser}
                    onDelete={handleDeleteUser}
                    onHardDelete={handleHardDeleteUser}
                    canHardDelete={isCurrentUserAdmin}
                    onUnlock={handleUnlockUser}
                    onExtendPassword={handleExtendPasswordExpiry}
                    onForceReset={handleForcePasswordReset}
                    extendingPasswordFor={extendingPasswordFor}
                    forcingResetFor={forcingResetFor}
                    unlockingFor={unlockingFor}
                    getProfilePictureUrl={getProfilePictureUrl}
                    getPasswordExpiryStatus={getPasswordExpiryStatus}
                    formatDate={formatDate}
                  />
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="users-pagination">
          <button
            type="button"
            className="users-page-btn"
            disabled={currentPage === 1}
            onClick={() => {
              setCurrentPage(prev => Math.max(1, prev - 1));
              showToast(`Page ${currentPage - 1}`, 'info');
            }}
            aria-label="Previous page"
          >
            <ChevronLeft size={18} />
            <span>Previous</span>
          </button>

          <div className="users-page-info">
            <span className="users-page-current">{currentPage}</span>
            <span className="users-page-separator">of</span>
            <span className="users-page-total">{totalPages}</span>
          </div>

          <button
            type="button"
            className="users-page-btn"
            disabled={currentPage === totalPages}
            onClick={() => {
              setCurrentPage(prev => Math.min(totalPages, prev + 1));
              showToast(`Page ${currentPage + 1}`, 'info');
            }}
            aria-label="Next page"
          >
            <span>Next</span>
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* Modals */}
      {showCreateModal && (
        <CreateUserModal
          onClose={() => {
            setShowCreateModal(false);
            showToast('Create user cancelled', 'info');
          }}
          onSuccess={handleCreateSuccess}
          roles={roles}
          departments={departments}
          locations={locations}
          processes={processes}
        />
      )}

      {showEditModal && selectedUser && (
        <EditUserModal
          user={selectedUser}
          onClose={() => {
            setShowEditModal(false);
            setSelectedUser(null);
            showToast('Edit cancelled', 'info');
          }}
          onSuccess={handleEditSuccess}
          roles={roles}
          departments={departments}
          locations={locations}
          processes={processes}
        />
      )}
    </div>
  );
};

// ============================================
// EXPORT
// ============================================
export default UsersList;
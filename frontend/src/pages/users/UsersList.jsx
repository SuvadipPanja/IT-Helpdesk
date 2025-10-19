import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
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
  Eye,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import api from '../../services/api';
import CreateUserModal from '../../components/users/CreateUserModal';
import EditUserModal from '../../components/users/EditUserModal';
import '../../styles/UsersList.css';

const UsersList = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // State management
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Dropdown data
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // ============================================
  // PERMISSION CHECK - ENHANCED
  // ============================================
  const canManageUsers = user?.permissions?.can_manage_users === true;

  // Debug log permissions
  useEffect(() => {
    console.log('👤 Current User:', user);
    console.log('🔐 User Permissions:', user?.permissions);
    console.log('✅ Can Manage Users:', canManageUsers);
    console.log('📊 Permission Value:', user?.permissions?.can_manage_users);
    console.log('📋 Permission Type:', typeof user?.permissions?.can_manage_users);
  }, [user]);

  // Fetch data on mount and filter changes
  useEffect(() => {
    if (canManageUsers) {
      fetchUsers();
    }
  }, [currentPage, searchQuery, selectedRole, selectedDepartment, selectedStatus, canManageUsers]);

  // Fetch dropdown data on mount
  useEffect(() => {
    if (canManageUsers) {
      fetchRoles();
      fetchDepartments();
    }
  }, [canManageUsers]);

  // Fetch users
  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');

      const params = {
        page: currentPage,
        limit: 20,
      };

      if (searchQuery) params.search = searchQuery;
      if (selectedRole) params.role_id = selectedRole;
      if (selectedDepartment) params.department_id = selectedDepartment;
      if (selectedStatus) params.is_active = selectedStatus;

      console.log('📡 Fetching users with params:', params);
      const response = await api.get('/users', { params });

      if (response.data.success) {
        setUsers(response.data.data.users);
        setTotalPages(response.data.data.pagination.totalPages);
        setTotalRecords(response.data.data.pagination.totalRecords);
        console.log('✅ Users loaded:', response.data.data.users.length);
      }
    } catch (err) {
      console.error('❌ Error fetching users:', err);
      console.error('Error response:', err.response);
      setError(err.response?.data?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  // Fetch roles
  const fetchRoles = async () => {
    try {
      const response = await api.get('/system/roles');
      if (response.data.success) {
        console.log('✅ Roles loaded:', response.data.data);
        setRoles(response.data.data || []);
      }
    } catch (err) {
      console.error('❌ Error fetching roles:', err);
    }
  };

  // Fetch departments
  const fetchDepartments = async () => {
    try {
      const response = await api.get('/system/departments');
      if (response.data.success) {
        console.log('✅ Departments loaded:', response.data.data);
        setDepartments(response.data.data || []);
      }
    } catch (err) {
      console.error('❌ Error fetching departments:', err);
    }
  };

  // Handle search
  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  // Clear filters
  const clearFilters = () => {
    setSearchQuery('');
    setSelectedRole('');
    setSelectedDepartment('');
    setSelectedStatus('');
    setCurrentPage(1);
  };

  // Handle edit user
  const handleEditUser = (user) => {
    setSelectedUser(user);
    setShowEditModal(true);
  };

  // Handle delete user
  const handleDeleteUser = async (userId, username) => {
    if (!window.confirm(`Are you sure you want to deactivate user "${username}"?`)) {
      return;
    }

    try {
      const response = await api.delete(`/users/${userId}`);
      
      if (response.data.success) {
        alert('User deactivated successfully!');
        fetchUsers();
      }
    } catch (err) {
      console.error('Error deleting user:', err);
      alert(err.response?.data?.message || 'Failed to delete user');
    }
  };

  // Handle view user details
  const handleViewUser = (userId) => {
    alert(`View details for user ID: ${userId}\n\nUser detail page coming soon!`);
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // ============================================
  // PERMISSION CHECK - NO ACCESS
  // ============================================
  if (!user) {
    return (
      <div className="users-list-page">
        <div className="error-container">
          <Loader className="spinner" size={64} />
          <h2>Loading...</h2>
          <p>Please wait while we load your profile</p>
        </div>
      </div>
    );
  }

  if (!canManageUsers) {
    return (
      <div className="users-list-page">
        <div className="error-container">
          <Shield size={64} className="error-icon" />
          <h2>Access Denied</h2>
          <p>You do not have permission to manage users</p>
          <div style={{ marginTop: '20px', padding: '15px', background: '#fee2e2', borderRadius: '8px', fontSize: '13px' }}>
            <p style={{ margin: '5px 0', color: '#991b1b' }}>
              <strong>Debug Info:</strong>
            </p>
            <p style={{ margin: '5px 0', color: '#991b1b' }}>
              User: {user?.username || 'Unknown'}
            </p>
            <p style={{ margin: '5px 0', color: '#991b1b' }}>
              Role: {user?.role?.role_name || 'Unknown'}
            </p>
            <p style={{ margin: '5px 0', color: '#991b1b' }}>
              Permission Value: {String(user?.permissions?.can_manage_users)}
            </p>
            <p style={{ margin: '5px 0', color: '#991b1b' }}>
              Permission Type: {typeof user?.permissions?.can_manage_users}
            </p>
          </div>
          <button className="btn-primary" onClick={() => navigate('/dashboard')} style={{ marginTop: '20px' }}>
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ============================================
  // LOADING STATE
  // ============================================
  if (loading && users.length === 0) {
    return (
      <div className="users-list-page">
        <div className="loading-container">
          <Loader className="spinner" size={48} />
          <p>Loading users...</p>
        </div>
      </div>
    );
  }

  // ============================================
  // MAIN RENDER
  // ============================================
  return (
    <div className="users-list-page">
      {/* Header */}
      <div className="page-header">
        <div className="header-left">
          <div className="page-title-section">
            <UsersIcon size={32} className="page-icon" />
            <div>
              <h1 className="page-title">User Management</h1>
              <p className="page-subtitle">
                Manage system users and their permissions
              </p>
            </div>
          </div>
        </div>
        <div className="header-right">
          <button className="btn-icon" onClick={fetchUsers} title="Refresh">
            <RefreshCw size={18} />
          </button>
          <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={18} />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="alert alert-error">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Filters Bar */}
      <div className="filters-bar">
        {/* Search */}
        <div className="search-input-wrapper">
          <Search size={20} className="search-icon" />
          <input
            type="text"
            placeholder="Search by name, email, or username..."
            value={searchQuery}
            onChange={handleSearch}
            className="search-input"
          />
          {searchQuery && (
            <button className="clear-search" onClick={() => setSearchQuery('')}>
              ×
            </button>
          )}
        </div>

        {/* Role Filter */}
        <select
          value={selectedRole}
          onChange={(e) => {
            console.log('Role selected:', e.target.value);
            setSelectedRole(e.target.value);
            setCurrentPage(1);
          }}
          className="filter-select"
        >
          <option value="">All Roles</option>
          {roles.map((role) => (
            <option key={role.role_id} value={role.role_id}>
              {role.role_name}
            </option>
          ))}
        </select>

        {/* Department Filter */}
        <select
          value={selectedDepartment}
          onChange={(e) => {
            console.log('Department selected:', e.target.value);
            setSelectedDepartment(e.target.value);
            setCurrentPage(1);
          }}
          className="filter-select"
        >
          <option value="">All Departments</option>
          {departments.map((dept) => (
            <option key={dept.department_id} value={dept.department_id}>
              {dept.department_name}
            </option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={selectedStatus}
          onChange={(e) => {
            console.log('Status selected:', e.target.value);
            setSelectedStatus(e.target.value);
            setCurrentPage(1);
          }}
          className="filter-select"
        >
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>

        {/* Clear Filters */}
        {(searchQuery || selectedRole || selectedDepartment || selectedStatus) && (
          <button className="btn-secondary" onClick={clearFilters}>
            Clear Filters
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-item">
          <span className="stat-label">Total Users</span>
          <span className="stat-value">{totalRecords}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Active</span>
          <span className="stat-value text-success">
            {users.filter(u => u.is_active).length}
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Inactive</span>
          <span className="stat-value text-danger">
            {users.filter(u => !u.is_active).length}
          </span>
        </div>
      </div>

      {/* Users Table */}
      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Contact</th>
              <th>Role</th>
              <th>Department</th>
              <th>Tickets</th>
              <th>Status</th>
              <th>Last Login</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan="8" className="empty-state">
                  <UsersIcon size={48} className="empty-icon" />
                  <p>No users found</p>
                </td>
              </tr>
            ) : (
              users.map((userItem) => (
                <tr key={userItem.user_id}>
                  {/* User Info */}
                  <td>
                    <div className="user-info">
                      <div className="user-avatar">
                        <User size={20} />
                      </div>
                      <div className="user-details">
                        <div className="user-name">{userItem.full_name}</div>
                        <div className="user-username">@{userItem.username}</div>
                      </div>
                    </div>
                  </td>

                  {/* Contact */}
                  <td>
                    <div className="contact-info">
                      <div className="contact-item">
                        <Mail size={14} />
                        {userItem.email}
                      </div>
                      {userItem.phone_number && (
                        <div className="contact-item">
                          <Phone size={14} />
                          {userItem.phone_number}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Role */}
                  <td>
                    <span className="role-badge">
                      <Shield size={14} />
                      {userItem.role_name}
                    </span>
                  </td>

                  {/* Department */}
                  <td>
                    {userItem.department_name ? (
                      <span className="department-badge">
                        <Building size={14} />
                        {userItem.department_name}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>

                  {/* Tickets */}
                  <td>
                    <div className="tickets-info">
                      <span className="ticket-count" title="Created">
                        {userItem.tickets_created} created
                      </span>
                      <span className="ticket-count" title="Assigned">
                        {userItem.tickets_assigned} assigned
                      </span>
                    </div>
                  </td>

                  {/* Status */}
                  <td>
                    {userItem.is_active ? (
                      <span className="status-badge status-active">
                        <CheckCircle size={14} />
                        Active
                      </span>
                    ) : (
                      <span className="status-badge status-inactive">
                        <XCircle size={14} />
                        Inactive
                      </span>
                    )}
                  </td>

                  {/* Last Login */}
                  <td>
                    <span className="text-muted">
                      {formatDate(userItem.last_login)}
                    </span>
                  </td>

                  {/* Actions */}
                  <td>
                    <div className="actions-cell">
                      <button
                        className="btn-icon-action"
                        onClick={() => handleViewUser(userItem.user_id)}
                        title="View Details"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        className="btn-icon-action"
                        onClick={() => handleEditUser(userItem)}
                        title="Edit User"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        className="btn-icon-action text-danger"
                        onClick={() => handleDeleteUser(userItem.user_id, userItem.username)}
                        title="Deactivate User"
                        disabled={userItem.user_id === user.user_id}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="pagination-btn"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </button>
          
          <div className="pagination-info">
            Page {currentPage} of {totalPages} ({totalRecords} total)
          </div>
          
          <button
            className="pagination-btn"
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </div>
      )}

      {/* Modals */}
      {showCreateModal && (
        <CreateUserModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchUsers();
          }}
          roles={roles}
          departments={departments}
        />
      )}

      {showEditModal && selectedUser && (
        <EditUserModal
          user={selectedUser}
          onClose={() => {
            setShowEditModal(false);
            setSelectedUser(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setSelectedUser(null);
            fetchUsers();
          }}
          roles={roles}
          departments={departments}
        />
      )}
    </div>
  );
};

export default UsersList;
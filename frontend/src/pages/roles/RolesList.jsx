import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Shield, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Users, 
  CheckCircle, 
  XCircle,
  Loader,
  AlertTriangle,
  Crown,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import CreateRoleModal from '../../components/roles/CreateRoleModal';
import EditRoleModal from '../../components/roles/EditRoleModal';
import DeleteRoleModal from '../../components/roles/DeleteRoleModal';
import '../../styles/RolesList.css';

const RolesList = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [roles, setRoles] = useState([]);
  const [filteredRoles, setFilteredRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);

  // Fetch roles
  const fetchRoles = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/roles');
      
      if (response.data.success) {
        setRoles(response.data.data);
        setFilteredRoles(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching roles:', err);
      setError(err.response?.data?.message || 'Failed to fetch roles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  // Search functionality
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredRoles(roles);
    } else {
      const filtered = roles.filter(role =>
        role.role_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        role.role_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (role.description && role.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredRoles(filtered);
    }
  }, [searchTerm, roles]);

  // Calculate stats
  const stats = {
    total: roles.length,
    system: roles.filter(r => r.is_system_role).length,
    custom: roles.filter(r => !r.is_system_role).length,
    totalUsers: roles.reduce((sum, r) => sum + (r.total_users || 0), 0)
  };

  // Count enabled permissions
  const countEnabledPermissions = (permissions) => {
    if (!permissions) return 0;
    return Object.values(permissions).filter(val => val === true).length;
  };

  // Handle create role
  const handleCreateRole = () => {
    setShowCreateModal(true);
  };

  // Handle edit role
  const handleEditRole = (role) => {
    setSelectedRole(role);
    setShowEditModal(true);
  };

  // Handle delete role
  const handleDeleteRole = (role) => {
    setSelectedRole(role);
    setShowDeleteModal(true);
  };

  // Handle modal close and refresh
  const handleModalClose = () => {
    setShowCreateModal(false);
    setShowEditModal(false);
    setShowDeleteModal(false);
    setSelectedRole(null);
  };

  const handleModalSuccess = () => {
    handleModalClose();
    fetchRoles();
  };

  // Clear search
  const handleClearSearch = () => {
    setSearchTerm('');
  };

  // Get role icon
  const getRoleIcon = (roleCode) => {
    switch (roleCode) {
      case 'ADMIN':
        return <Crown size={24} />;
      case 'MANAGER':
        return <UserCheck size={24} />;
      case 'ENGINEER':
        return <Users size={24} />;
      default:
        return <Shield size={24} />;
    }
  };

  // Get role color
  const getRoleColor = (roleCode) => {
    switch (roleCode) {
      case 'ADMIN':
        return '#dc2626';
      case 'MANAGER':
        return '#2563eb';
      case 'ENGINEER':
        return '#059669';
      case 'USER':
        return '#7c3aed';
      default:
        return '#6366f1';
    }
  };

  if (loading) {
    return (
      <div className="roles-list-page">
        <div className="loading-container">
          <Loader className="spinner" size={48} />
          <p>Loading roles...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="roles-list-page">
        <div className="error-container">
          <AlertTriangle className="error-icon" size={48} />
          <h2>Error Loading Roles</h2>
          <p>{error}</p>
          <button className="btn-primary" onClick={fetchRoles}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="roles-list-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="header-left">
          <div className="page-title-section">
            <Shield className="page-icon" size={32} />
            <div>
              <h1 className="page-title">Role Management</h1>
              <p className="page-subtitle">Manage user roles and permissions</p>
            </div>
          </div>
        </div>
        <div className="header-right">
          <button className="btn-primary" onClick={handleCreateRole}>
            <Plus size={20} />
            Create Role
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="search-bar">
        <div className="search-input-wrapper">
          <Search className="search-icon" size={20} />
          <input
            type="text"
            className="search-input"
            placeholder="Search roles by name, code, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button className="clear-search" onClick={handleClearSearch}>
              ×
            </button>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div className="stats-row">
        <div className="stat-item">
          <span className="stat-label">Total Roles</span>
          <span className="stat-value">{stats.total}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">System Roles</span>
          <span className="stat-value text-primary">{stats.system}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Custom Roles</span>
          <span className="stat-value text-success">{stats.custom}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Total Users</span>
          <span className="stat-value text-info">{stats.totalUsers}</span>
        </div>
      </div>

      {/* Roles Grid */}
      {filteredRoles.length === 0 ? (
        <div className="empty-state">
          <Shield className="empty-icon" size={64} />
          <p>No roles found</p>
          {searchTerm && <small>Try adjusting your search</small>}
        </div>
      ) : (
        <div className="roles-grid">
          {filteredRoles.map((role) => (
            <div key={role.role_id} className="role-card">
              {/* Card Header */}
              <div className="role-card-header">
                <div 
                  className="role-icon"
                  style={{ background: `linear-gradient(135deg, ${getRoleColor(role.role_code)} 0%, ${getRoleColor(role.role_code)}dd 100%)` }}
                >
                  {getRoleIcon(role.role_code)}
                </div>
                <div className="role-actions">
                  {!role.is_system_role && (
                    <>
                      <button 
                        className="btn-icon-action"
                        onClick={() => handleEditRole(role)}
                        title="Edit Role"
                      >
                        <Edit size={18} />
                      </button>
                      <button 
                        className="btn-icon-action text-danger"
                        onClick={() => handleDeleteRole(role)}
                        title="Delete Role"
                      >
                        <Trash2 size={18} />
                      </button>
                    </>
                  )}
                  {role.is_system_role && (
                    <button 
                      className="btn-icon-action"
                      onClick={() => handleEditRole(role)}
                      title="View Permissions"
                    >
                      <Edit size={18} />
                    </button>
                  )}
                </div>
              </div>

              {/* Card Body */}
              <div className="role-card-body">
                <h3 className="role-name">{role.role_name}</h3>
                <div className="role-meta">
                  <span className="role-code">{role.role_code}</span>
                  {role.is_system_role && (
                    <span className="role-badge system">System Role</span>
                  )}
                </div>
                {role.description && (
                  <p className="role-description">{role.description}</p>
                )}
              </div>

              {/* Permissions Preview */}
              <div className="role-permissions">
                <div className="permissions-header">
                  <CheckCircle size={16} />
                  <span>Permissions</span>
                </div>
                <div className="permissions-count">
                  <span className="count-number">
                    {countEnabledPermissions(role.permissions)}
                  </span>
                  <span className="count-label">enabled</span>
                </div>
              </div>

              {/* Card Footer */}
              <div className="role-card-footer">
                <div className="footer-stat">
                  <Users size={18} className="stat-icon" />
                  <div>
                    <span className="stat-number">{role.total_users || 0}</span>
                    <small>Users</small>
                  </div>
                </div>
                <div className="footer-stat">
                  {role.is_active ? (
                    <>
                      <CheckCircle size={18} className="stat-icon text-success" />
                      <div>
                        <span className="stat-number text-success">Active</span>
                        <small>Status</small>
                      </div>
                    </>
                  ) : (
                    <>
                      <XCircle size={18} className="stat-icon text-danger" />
                      <div>
                        <span className="stat-number text-danger">Inactive</span>
                        <small>Status</small>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {showCreateModal && (
        <CreateRoleModal
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
        />
      )}

      {showEditModal && selectedRole && (
        <EditRoleModal
          role={selectedRole}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
        />
      )}

      {showDeleteModal && selectedRole && (
        <DeleteRoleModal
          role={selectedRole}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
        />
      )}
    </div>
  );
};

export default RolesList;
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Building,
  User,
  Users,
  Ticket,
  RefreshCw,
  AlertCircle,
  Loader
} from 'lucide-react';
import api from '../../services/api';
import CreateDepartmentModal from '../../components/departments/CreateDepartmentModal';
import EditDepartmentModal from '../../components/departments/EditDepartmentModal';
import DeleteDepartmentModal from '../../components/departments/DeleteDepartmentModal';
import '../../styles/DepartmentsList.css';

const DepartmentsList = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // State management
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState(null);

  // Managers list for dropdown
  const [managers, setManagers] = useState([]);

  // Check permission
  const canManageDepartments = user?.permissions?.can_manage_departments;

  // Fetch departments on mount
  useEffect(() => {
    if (canManageDepartments) {
      fetchDepartments();
      fetchManagers();
    }
  }, [canManageDepartments]);

  // Fetch all departments
  const fetchDepartments = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await api.get('/departments');

      if (response.data.success) {
        setDepartments(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching departments:', err);
      setError(err.response?.data?.message || 'Failed to load departments');
    } finally {
      setLoading(false);
    }
  };

  // Fetch available managers
  const fetchManagers = async () => {
    try {
      const response = await api.get('/departments/managers/available');
      if (response.data.success) {
        setManagers(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching managers:', err);
    }
  };

  // Handle search
  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
  };

  // Filter departments based on search
  const filteredDepartments = departments.filter((dept) =>
    dept.department_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    dept.department_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (dept.manager_name && dept.manager_name.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Handle edit department
  const handleEditDepartment = (department) => {
    setSelectedDepartment(department);
    setShowEditModal(true);
  };

  // Handle delete department
  const handleDeleteDepartment = (department) => {
    setSelectedDepartment(department);
    setShowDeleteModal(true);
  };

  // Check permission
  if (!canManageDepartments) {
    return (
      <div className="departments-list-page">
        <div className="error-container">
          <AlertCircle size={64} className="error-icon" />
          <h2>Access Denied</h2>
          <p>You do not have permission to manage departments</p>
          <button className="btn-primary" onClick={() => navigate('/dashboard')}>
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="departments-list-page">
        <div className="loading-container">
          <Loader className="spinner" size={48} />
          <p>Loading departments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="departments-list-page">
      {/* Header */}
      <div className="page-header">
        <div className="header-left">
          <div className="page-title-section">
            <Building size={32} className="page-icon" />
            <div>
              <h1 className="page-title">Department Management</h1>
              <p className="page-subtitle">
                Manage organizational departments and their managers
              </p>
            </div>
          </div>
        </div>
        <div className="header-right">
          <button className="btn-icon" onClick={fetchDepartments} title="Refresh">
            <RefreshCw size={18} />
          </button>
          <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
            <Plus size={18} />
            <span>Add Department</span>
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

      {/* Search Bar */}
      <div className="search-bar">
        <div className="search-input-wrapper">
          <Search size={20} className="search-icon" />
          <input
            type="text"
            placeholder="Search departments by name, code, or manager..."
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
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-item">
          <span className="stat-label">Total Departments</span>
          <span className="stat-value">{departments.length}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Total Users</span>
          <span className="stat-value text-success">
            {departments.reduce((sum, dept) => sum + (dept.total_users || 0), 0)}
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Active Tickets</span>
          <span className="stat-value text-primary">
            {departments.reduce((sum, dept) => sum + (dept.active_tickets || 0), 0)}
          </span>
        </div>
      </div>

      {/* Departments Grid */}
      <div className="departments-grid">
        {filteredDepartments.length === 0 ? (
          <div className="empty-state">
            <Building size={48} className="empty-icon" />
            <p>No departments found</p>
            {searchQuery && <small>Try adjusting your search</small>}
          </div>
        ) : (
          filteredDepartments.map((department) => (
            <div key={department.department_id} className="department-card">
              {/* Card Header */}
              <div className="department-card-header">
                <div className="department-icon">
                  <Building size={24} />
                </div>
                <div className="department-actions">
                  <button
                    className="btn-icon-action"
                    onClick={() => handleEditDepartment(department)}
                    title="Edit Department"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    className="btn-icon-action text-danger"
                    onClick={() => handleDeleteDepartment(department)}
                    title="Delete Department"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Card Body */}
              <div className="department-card-body">
                <h3 className="department-name">{department.department_name}</h3>
                <span className="department-code">{department.department_code}</span>

                {department.description && (
                  <p className="department-description">{department.description}</p>
                )}

                {/* Manager Info */}
                <div className="manager-info">
                  <User size={14} />
                  <span>
                    {department.manager_name || 'No Manager Assigned'}
                  </span>
                </div>
              </div>

              {/* Card Footer - Stats */}
              <div className="department-card-footer">
                <div className="stat-item-small">
                  <Users size={16} className="stat-icon-small" />
                  <span>{department.total_users || 0}</span>
                  <small>Users</small>
                </div>
                <div className="stat-item-small">
                  <Ticket size={16} className="stat-icon-small" />
                  <span>{department.active_tickets || 0}</span>
                  <small>Tickets</small>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateDepartmentModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchDepartments();
          }}
          managers={managers}
        />
      )}

      {showEditModal && selectedDepartment && (
        <EditDepartmentModal
          department={selectedDepartment}
          onClose={() => {
            setShowEditModal(false);
            setSelectedDepartment(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setSelectedDepartment(null);
            fetchDepartments();
          }}
          managers={managers}
        />
      )}

      {showDeleteModal && selectedDepartment && (
        <DeleteDepartmentModal
          department={selectedDepartment}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedDepartment(null);
          }}
          onSuccess={() => {
            setShowDeleteModal(false);
            setSelectedDepartment(null);
            fetchDepartments();
          }}
        />
      )}
    </div>
  );
};

export default DepartmentsList;
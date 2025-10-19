import { useState, useEffect } from 'react';
import { X, Shield, Code, FileText, Save, Loader } from 'lucide-react';
import api from '../../services/api';
import '../../styles/RoleModals.css';

const CreateRoleModal = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    role_name: '',
    role_code: '',
    description: '',
    permissions: {}
  });

  const [availablePermissions, setAvailablePermissions] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch available permissions
  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const response = await api.get('/roles/permissions/available');
        if (response.data.success) {
          setAvailablePermissions(response.data.data);
          
          // Initialize all permissions to false
          const initialPermissions = {};
          response.data.data.forEach(perm => {
            initialPermissions[perm.key] = false;
          });
          setFormData(prev => ({
            ...prev,
            permissions: initialPermissions
          }));
        }
      } catch (err) {
        console.error('Error fetching permissions:', err);
      }
    };

    fetchPermissions();
  }, []);

  // Handle input change
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Auto-generate role code from role name
    if (name === 'role_name') {
      const autoCode = value
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9\s]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 20);
      
      setFormData(prev => ({
        ...prev,
        role_name: value,
        role_code: autoCode
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  // Handle permission toggle
  const handlePermissionToggle = (permissionKey) => {
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [permissionKey]: !prev.permissions[permissionKey]
      }
    }));
  };

  // Select all permissions in a category
  const handleSelectAllCategory = (category) => {
    const categoryPerms = availablePermissions.filter(p => p.category === category);
    const allEnabled = categoryPerms.every(p => formData.permissions[p.key]);
    
    const updatedPermissions = { ...formData.permissions };
    categoryPerms.forEach(perm => {
      updatedPermissions[perm.key] = !allEnabled;
    });
    
    setFormData(prev => ({
      ...prev,
      permissions: updatedPermissions
    }));
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    if (!formData.role_name.trim()) {
      newErrors.role_name = 'Role name is required';
    } else if (formData.role_name.length < 2) {
      newErrors.role_name = 'Role name must be at least 2 characters';
    }

    if (!formData.role_code.trim()) {
      newErrors.role_code = 'Role code is required';
    } else if (formData.role_code.length < 2) {
      newErrors.role_code = 'Role code must be at least 2 characters';
    } else if (!/^[A-Z0-9_-]+$/.test(formData.role_code)) {
      newErrors.role_code = 'Role code must contain only uppercase letters, numbers, hyphens, and underscores';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      setError('');

      const payload = {
        role_name: formData.role_name.trim(),
        role_code: formData.role_code.trim().toUpperCase(),
        description: formData.description.trim() || null,
        permissions: formData.permissions
      };

      const response = await api.post('/roles', payload);

      if (response.data.success) {
        alert('Role created successfully!');
        onSuccess();
      }
    } catch (err) {
      console.error('Error creating role:', err);
      setError(err.response?.data?.message || 'Failed to create role');
    } finally {
      setLoading(false);
    }
  };

  // Group permissions by category
  const permissionsByCategory = availablePermissions.reduce((acc, perm) => {
    if (!acc[perm.category]) {
      acc[perm.category] = [];
    }
    acc[perm.category].push(perm);
    return acc;
  }, {});

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-section">
            <Shield size={24} className="modal-icon" />
            <h2 className="modal-title">Create New Role</h2>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {error && (
            <div className="alert alert-error">
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="role-form">
            {/* Role Name */}
            <div className="form-group">
              <label htmlFor="role_name" className="form-label required">
                <Shield size={16} />
                Role Name
              </label>
              <input
                type="text"
                id="role_name"
                name="role_name"
                value={formData.role_name}
                onChange={handleChange}
                className={`form-input ${errors.role_name ? 'error' : ''}`}
                placeholder="e.g., Support Agent"
              />
              {errors.role_name && (
                <span className="error-message">{errors.role_name}</span>
              )}
            </div>

            {/* Role Code */}
            <div className="form-group">
              <label htmlFor="role_code" className="form-label required">
                <Code size={16} />
                Role Code
              </label>
              <input
                type="text"
                id="role_code"
                name="role_code"
                value={formData.role_code}
                onChange={handleChange}
                className={`form-input ${errors.role_code ? 'error' : ''}`}
                placeholder="e.g., SUPPORT"
                maxLength={20}
              />
              {errors.role_code && (
                <span className="error-message">{errors.role_code}</span>
              )}
              <small className="form-help">
                Uppercase letters, numbers, hyphens, and underscores only
              </small>
            </div>

            {/* Description */}
            <div className="form-group">
              <label htmlFor="description" className="form-label">
                <FileText size={16} />
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                className="form-textarea"
                placeholder="Brief description of the role..."
                rows={3}
              />
            </div>

            {/* Permissions */}
            <div className="permissions-section">
              <h3 className="section-title">
                <Shield size={20} />
                Permissions
              </h3>
              <p className="section-subtitle">
                Select the permissions this role should have
              </p>

              {Object.entries(permissionsByCategory).map(([category, perms]) => (
                <div key={category} className="permission-category">
                  <div className="category-header">
                    <h4 className="category-title">{category}</h4>
                    <button
                      type="button"
                      className="btn-text"
                      onClick={() => handleSelectAllCategory(category)}
                    >
                      {perms.every(p => formData.permissions[p.key]) ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  <div className="permissions-grid">
                    {perms.map((perm) => (
                      <label key={perm.key} className="permission-item">
                        <input
                          type="checkbox"
                          checked={formData.permissions[perm.key] || false}
                          onChange={() => handlePermissionToggle(perm.key)}
                        />
                        <div className="permission-info">
                          <span className="permission-label">{perm.label}</span>
                          <span className="permission-description">{perm.description}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </form>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader className="spinner" size={18} />
                Creating...
              </>
            ) : (
              <>
                <Save size={18} />
                Create Role
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateRoleModal;
import { useState } from 'react';
import { X, Building, Code, FileText, User, Save, Loader } from 'lucide-react';
import api from '../../services/api';
import '../../styles/DepartmentModals.css';

const CreateDepartmentModal = ({ onClose, onSuccess, managers }) => {
  const [formData, setFormData] = useState({
    department_name: '',
    department_code: '',
    description: '',
    manager_id: ''
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Handle input change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    if (!formData.department_name.trim()) {
      newErrors.department_name = 'Department name is required';
    } else if (formData.department_name.length < 2) {
      newErrors.department_name = 'Department name must be at least 2 characters';
    }

    if (!formData.department_code.trim()) {
      newErrors.department_code = 'Department code is required';
    } else if (formData.department_code.length < 2) {
      newErrors.department_code = 'Department code must be at least 2 characters';
    } else if (!/^[A-Z0-9_-]+$/.test(formData.department_code)) {
      newErrors.department_code = 'Department code must contain only uppercase letters, numbers, hyphens, and underscores';
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
        department_name: formData.department_name.trim(),
        department_code: formData.department_code.trim().toUpperCase(),
        description: formData.description.trim() || null,
        manager_id: formData.manager_id ? parseInt(formData.manager_id) : null
      };

      const response = await api.post('/departments', payload);

      if (response.data.success) {
        alert('Department created successfully!');
        onSuccess();
      }
    } catch (err) {
      console.error('Error creating department:', err);
      setError(err.response?.data?.message || 'Failed to create department');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-section">
            <Building size={24} className="modal-icon" />
            <h2 className="modal-title">Create New Department</h2>
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

          <form onSubmit={handleSubmit} className="department-form">
            {/* Department Name */}
            <div className="form-group">
              <label htmlFor="department_name" className="form-label required">
                <Building size={16} />
                Department Name
              </label>
              <input
                type="text"
                id="department_name"
                name="department_name"
                value={formData.department_name}
                onChange={handleChange}
                className={`form-input ${errors.department_name ? 'error' : ''}`}
                placeholder="e.g., Information Technology"
              />
              {errors.department_name && (
                <span className="error-message">{errors.department_name}</span>
              )}
            </div>

            {/* Department Code */}
            <div className="form-group">
              <label htmlFor="department_code" className="form-label required">
                <Code size={16} />
                Department Code
              </label>
              <input
                type="text"
                id="department_code"
                name="department_code"
                value={formData.department_code}
                onChange={(e) => {
                  const value = e.target.value.toUpperCase();
                  handleChange({ target: { name: 'department_code', value } });
                }}
                className={`form-input ${errors.department_code ? 'error' : ''}`}
                placeholder="e.g., IT"
                maxLength={20}
              />
              {errors.department_code && (
                <span className="error-message">{errors.department_code}</span>
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
                placeholder="Brief description of the department..."
                rows={3}
              />
            </div>

            {/* Manager */}
            <div className="form-group">
              <label htmlFor="manager_id" className="form-label">
                <User size={16} />
                Department Manager
              </label>
              <select
                id="manager_id"
                name="manager_id"
                value={formData.manager_id}
                onChange={handleChange}
                className="form-select"
              >
                <option value="">No Manager (Optional)</option>
                {managers.map((manager) => (
                  <option key={manager.user_id} value={manager.user_id}>
                    {manager.full_name} ({manager.role_name})
                  </option>
                ))}
              </select>
              <small className="form-help">
                Assign a manager to oversee this department
              </small>
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
                Create Department
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateDepartmentModal;
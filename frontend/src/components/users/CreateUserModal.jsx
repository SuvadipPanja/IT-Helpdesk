import { useState } from 'react';
import { X, User, Mail, Lock, Phone, Shield, Building, Save, Loader } from 'lucide-react';
import api from '../../services/api';
import '../../styles/UserModals.css';

const CreateUserModal = ({ onClose, onSuccess, roles, departments }) => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirm_password: '',
    first_name: '',
    last_name: '',
    phone_number: '',
    role_id: '',
    department_id: ''
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

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (!formData.confirm_password) {
      newErrors.confirm_password = 'Please confirm password';
    } else if (formData.password !== formData.confirm_password) {
      newErrors.confirm_password = 'Passwords do not match';
    }

    if (!formData.first_name.trim()) {
      newErrors.first_name = 'First name is required';
    }

    if (!formData.last_name.trim()) {
      newErrors.last_name = 'Last name is required';
    }

    if (!formData.role_id) {
      newErrors.role_id = 'Role is required';
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
        username: formData.username,
        email: formData.email,
        password: formData.password,
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone_number: formData.phone_number || null,
        role_id: parseInt(formData.role_id),
        department_id: formData.department_id ? parseInt(formData.department_id) : null
      };

      const response = await api.post('/users', payload);

      if (response.data.success) {
        alert('User created successfully!');
        onSuccess();
      }
    } catch (err) {
      console.error('Error creating user:', err);
      setError(err.response?.data?.message || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-section">
            <User size={24} className="modal-icon" />
            <h2 className="modal-title">Create New User</h2>
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

          <form onSubmit={handleSubmit} className="user-form">
            <div className="form-grid">
              {/* Left Column */}
              <div className="form-column">
                <h3 className="form-section-title">Account Information</h3>

                {/* Username */}
                <div className="form-group">
                  <label htmlFor="username" className="form-label required">
                    <User size={16} />
                    Username
                  </label>
                  <input
                    type="text"
                    id="username"
                    name="username"
                    value={formData.username}
                    onChange={handleChange}
                    className={`form-input ${errors.username ? 'error' : ''}`}
                    placeholder="Enter username"
                  />
                  {errors.username && (
                    <span className="error-message">{errors.username}</span>
                  )}
                </div>

                {/* Email */}
                <div className="form-group">
                  <label htmlFor="email" className="form-label required">
                    <Mail size={16} />
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={`form-input ${errors.email ? 'error' : ''}`}
                    placeholder="Enter email address"
                  />
                  {errors.email && (
                    <span className="error-message">{errors.email}</span>
                  )}
                </div>

                {/* Password */}
                <div className="form-group">
                  <label htmlFor="password" className="form-label required">
                    <Lock size={16} />
                    Password
                  </label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className={`form-input ${errors.password ? 'error' : ''}`}
                    placeholder="Enter password"
                  />
                  {errors.password && (
                    <span className="error-message">{errors.password}</span>
                  )}
                  <small className="form-help">Minimum 6 characters</small>
                </div>

                {/* Confirm Password */}
                <div className="form-group">
                  <label htmlFor="confirm_password" className="form-label required">
                    <Lock size={16} />
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    id="confirm_password"
                    name="confirm_password"
                    value={formData.confirm_password}
                    onChange={handleChange}
                    className={`form-input ${errors.confirm_password ? 'error' : ''}`}
                    placeholder="Re-enter password"
                  />
                  {errors.confirm_password && (
                    <span className="error-message">{errors.confirm_password}</span>
                  )}
                </div>
              </div>

              {/* Right Column */}
              <div className="form-column">
                <h3 className="form-section-title">Personal Information</h3>

                {/* First Name */}
                <div className="form-group">
                  <label htmlFor="first_name" className="form-label required">
                    First Name
                  </label>
                  <input
                    type="text"
                    id="first_name"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleChange}
                    className={`form-input ${errors.first_name ? 'error' : ''}`}
                    placeholder="Enter first name"
                  />
                  {errors.first_name && (
                    <span className="error-message">{errors.first_name}</span>
                  )}
                </div>

                {/* Last Name */}
                <div className="form-group">
                  <label htmlFor="last_name" className="form-label required">
                    Last Name
                  </label>
                  <input
                    type="text"
                    id="last_name"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleChange}
                    className={`form-input ${errors.last_name ? 'error' : ''}`}
                    placeholder="Enter last name"
                  />
                  {errors.last_name && (
                    <span className="error-message">{errors.last_name}</span>
                  )}
                </div>

                {/* Phone Number */}
                <div className="form-group">
                  <label htmlFor="phone_number" className="form-label">
                    <Phone size={16} />
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    id="phone_number"
                    name="phone_number"
                    value={formData.phone_number}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="Enter phone number"
                  />
                </div>

                {/* Role */}
                <div className="form-group">
                  <label htmlFor="role_id" className="form-label required">
                    <Shield size={16} />
                    Role
                  </label>
                  <select
                    id="role_id"
                    name="role_id"
                    value={formData.role_id}
                    onChange={handleChange}
                    className={`form-select ${errors.role_id ? 'error' : ''}`}
                  >
                    <option value="">Select Role</option>
                    {roles.map((role) => (
                      <option key={role.role_id} value={role.role_id}>
                        {role.role_name}
                      </option>
                    ))}
                  </select>
                  {errors.role_id && (
                    <span className="error-message">{errors.role_id}</span>
                  )}
                </div>

                {/* Department */}
                <div className="form-group">
                  <label htmlFor="department_id" className="form-label">
                    <Building size={16} />
                    Department
                  </label>
                  <select
                    id="department_id"
                    name="department_id"
                    value={formData.department_id}
                    onChange={handleChange}
                    className="form-select"
                  >
                    <option value="">Select Department</option>
                    {departments.map((dept) => (
                      <option key={dept.department_id} value={dept.department_id}>
                        {dept.department_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
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
                Create User
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateUserModal;
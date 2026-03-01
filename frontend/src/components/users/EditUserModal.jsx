// ============================================
// EDIT USER MODAL - WITH PASSWORD VALIDATION
// Developer: Suvadip Panja
// Updated: February 04, 2026 - Added Toast Notifications
// ============================================

import { useState } from 'react';
import { X, User, Mail, Lock, Phone, Shield, Building, Save, Loader } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';
import usePasswordPolicy from '../../hooks/usePasswordPolicy';
import '../../styles/UserModals.css';

const EditUserModal = ({ user, onClose, onSuccess, roles, departments }) => {
  const toast = useToast(); // Add toast notifications
  
  const [formData, setFormData] = useState({
    username: user.username || '',
    email: user.email || '',
    first_name: user.first_name || '',
    last_name: user.last_name || '',
    phone_number: user.phone_number || '',
    role_id: user.role_id || '',
    department_id: user.department_id || '',
    is_active: user.is_active ? true : false,
    password: '',
    confirm_password: ''
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ⭐ Password policy from database
  const {
    passwordPolicy,
    loadingPolicy,
    passwordStrength,
    setPasswordStrength,
    checkPasswordStrength,
    getStrengthColor,
    getStrengthLabel,
  } = usePasswordPolicy();

  // Handle input change
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Check password strength in real-time
    if (name === 'password' && passwordPolicy && value) {
      setPasswordStrength(checkPasswordStrength(value));
    }
    
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

    if (!formData.first_name.trim()) {
      newErrors.first_name = 'First name is required';
    }

    if (!formData.last_name.trim()) {
      newErrors.last_name = 'Last name is required';
    }

    if (!formData.role_id) {
      newErrors.role_id = 'Role is required';
    }

    // ⭐ UPDATED: Validate password only if provided, against database policy
    if (formData.password) {
      if (passwordPolicy) {
        if (formData.password.length < passwordPolicy.minLength) {
          newErrors.password = `Password must be at least ${passwordPolicy.minLength} characters`;
        }
        if (passwordPolicy.requireUppercase && !/[A-Z]/.test(formData.password)) {
          newErrors.password = 'Password must contain uppercase letters';
        }
        if (passwordPolicy.requireLowercase && !/[a-z]/.test(formData.password)) {
          newErrors.password = 'Password must contain lowercase letters';
        }
        if (passwordPolicy.requireNumber && !/\d/.test(formData.password)) {
          newErrors.password = 'Password must contain numbers';
        }
        if (passwordPolicy.requireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(formData.password)) {
          newErrors.password = 'Password must contain special characters';
        }
      }
      
      if (!formData.confirm_password) {
        newErrors.confirm_password = 'Please confirm password';
      } else if (formData.password !== formData.confirm_password) {
        newErrors.confirm_password = 'Passwords do not match';
      }
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
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone_number: formData.phone_number || null,
        role_id: parseInt(formData.role_id),
        department_id: formData.department_id ? parseInt(formData.department_id) : null,
        is_active: formData.is_active
      };

      // Track what changed for specific message
      const changes = [];
      
      if (formData.username !== user.username) changes.push('username');
      if (formData.email !== user.email) changes.push('email');
      if (formData.first_name !== user.first_name) changes.push('first name');
      if (formData.last_name !== user.last_name) changes.push('last name');
      if (formData.phone_number !== user.phone_number) changes.push('phone number');
      if (formData.role_id !== user.role_id) changes.push('role');
      if (formData.department_id !== user.department_id) changes.push('department');
      if (formData.is_active !== user.is_active) changes.push('status');

      // Only include password if provided
      if (formData.password) {
        payload.password = formData.password;
        changes.push('password');
      }

      const response = await api.put(`/users/${user.user_id}`, payload);

      if (response.data.success) {
        // Generate specific success message
        let successMessage = '';
        
        if (changes.length === 0) {
          successMessage = 'No changes were made';
          toast.info(successMessage);
        } else if (changes.length === 1) {
          successMessage = `User ${changes[0]} updated successfully!`;
          toast.success(successMessage);
        } else if (changes.length === 2) {
          successMessage = `User ${changes[0]} and ${changes[1]} updated successfully!`;
          toast.success(successMessage);
        } else {
          successMessage = `User ${user.username} updated successfully! Changed: ${changes.join(', ')}`;
          toast.success(successMessage);
        }

        // Clear password fields for security
        setFormData(prev => ({
          ...prev,
          password: '',
          confirm_password: ''
        }));

        // Close modal and refresh parent
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 500); // Small delay to show toast
      }
    } catch (err) {
      console.error('Error updating user:', err);
      const errorMsg = err.response?.data?.message || 'Failed to update user. Please try again.';
      setError(errorMsg);
      toast.error(errorMsg);
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
            <h2 className="modal-title">Edit User</h2>
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
                  <label htmlFor="password" className="form-label">
                    <Lock size={16} />
                    New Password
                  </label>
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className={`form-input ${errors.password ? 'error' : ''}`}
                    placeholder="Leave blank to keep current password"
                    disabled={loadingPolicy}
                  />
                  {errors.password && (
                    <span className="error-message">{errors.password}</span>
                  )}
                  <small className="form-help">Leave blank to keep current password</small>

                  {/* ⭐ NEW: Password Strength Indicator (only when typing) */}
                  {formData.password && passwordPolicy && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <div style={{
                        height: '4px',
                        background: '#e5e7eb',
                        borderRadius: '2px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${(passwordStrength.score / 4) * 100}%`,
                          height: '100%',
                          background: getStrengthColor(),
                          transition: 'all 0.3s ease'
                        }} />
                      </div>
                      <small style={{ 
                        color: getStrengthColor(),
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        marginTop: '0.25rem',
                        display: 'block'
                      }}>
                        {getStrengthLabel()}
                      </small>
                    </div>
                  )}

                  {/* ⭐ NEW: Password Requirements (only when typing) */}
                  {formData.password && passwordPolicy && (
                    <div style={{ 
                      marginTop: '0.75rem',
                      padding: '0.75rem',
                      background: '#f9fafb',
                      borderRadius: '6px',
                      fontSize: '0.75rem'
                    }}>
                      <div style={{ fontWeight: '600', marginBottom: '0.5rem', color: '#374151' }}>
                        Password Requirements:
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ 
                          color: formData.password.length >= passwordPolicy.minLength ? '#22c55e' : '#ef4444' 
                        }}>
                          {formData.password.length >= passwordPolicy.minLength ? '✓' : '✗'} At least {passwordPolicy.minLength} characters
                        </div>
                        {(passwordPolicy.requireUppercase && passwordPolicy.requireLowercase) && (
                          <div style={{ 
                            color: (/[a-z]/.test(formData.password) && /[A-Z]/.test(formData.password)) ? '#22c55e' : '#ef4444' 
                          }}>
                            {(/[a-z]/.test(formData.password) && /[A-Z]/.test(formData.password)) ? '✓' : '✗'} Uppercase and lowercase letters
                          </div>
                        )}
                        {passwordPolicy.requireNumber && (
                          <div style={{ 
                            color: /\d/.test(formData.password) ? '#22c55e' : '#ef4444' 
                          }}>
                            {/\d/.test(formData.password) ? '✓' : '✗'} At least one number
                          </div>
                        )}
                        {passwordPolicy.requireSpecial && (
                          <div style={{ 
                            color: /[!@#$%^&*(),.?":{}|<>]/.test(formData.password) ? '#22c55e' : '#ef4444' 
                          }}>
                            {/[!@#$%^&*(),.?":{}|<>]/.test(formData.password) ? '✓' : '✗'} Special characters (!@#$%^&*)
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm Password (only show when new password is entered) */}
                {formData.password && (
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
                      placeholder="Re-enter new password"
                    />
                    {errors.confirm_password && (
                      <span className="error-message">{errors.confirm_password}</span>
                    )}
                  </div>
                )}

                {/* Active Status */}
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="is_active"
                      checked={formData.is_active}
                      onChange={handleChange}
                    />
                    <span>Active User</span>
                  </label>
                  <small className="form-help">Uncheck to deactivate this user</small>
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
            disabled={loading || loadingPolicy}
          >
            {loading ? (
              <>
                <Loader className="spinner" size={18} />
                Updating...
              </>
            ) : (
              <>
                <Save size={18} />
                Update User
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditUserModal;
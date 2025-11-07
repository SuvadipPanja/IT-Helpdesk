// ============================================
// CHANGE PASSWORD FORM COMPONENT
// Enhanced password change with strength meter
// ============================================
// Developer: Suvadip Panja
// Created: November 06, 2025
// File: frontend/src/components/security/ChangePasswordForm.jsx
// ============================================
// SECURITY FEATURES:
// - Current password verification
// - New password validation
// - Password confirmation matching
// - Strength meter integration
// - Error handling
// - Success feedback
// ============================================

import React, { useState } from 'react';
import { 
  Lock, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  CheckCircle,
  Loader2
} from 'lucide-react';
import PasswordStrengthMeter from './PasswordStrengthMeter';
import api from '../../utils/api';

/**
 * Change Password Form Component
 * Allows users to change their password with validation
 * 
 * @param {Object} props
 * @param {Function} props.onSuccess - Callback on successful password change
 * @param {Function} props.onCancel - Callback when user cancels
 */
const ChangePasswordForm = ({ onSuccess, onCancel }) => {
  // ============================================
  // STATE MANAGEMENT
  // ============================================
  
  // Form data
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Password visibility toggles
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  // Password strength from meter
  const [passwordStrength, setPasswordStrength] = useState({
    isValid: false,
    score: 0,
  });

  // Form state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  // ============================================
  // INPUT HANDLERS
  // ============================================

  /**
   * Handle input field changes
   * Clears errors when user types
   * 
   * @param {Event} e - Input change event
   */
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));

    // Clear errors when user starts typing
    if (error) setError('');
    if (validationErrors[name]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  /**
   * Toggle password visibility
   * 
   * @param {string} field - Password field to toggle
   */
  const togglePasswordVisibility = (field) => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  /**
   * Handle password strength change from meter
   * 
   * @param {Object} strength - Strength metrics from meter
   */
  const handleStrengthChange = (strength) => {
    setPasswordStrength(strength);
  };

  // ============================================
  // VALIDATION
  // ============================================

  /**
   * Validate form inputs before submission
   * 
   * @returns {boolean} True if valid, false otherwise
   */
  const validateForm = () => {
    const errors = {};

    // Check current password
    if (!formData.currentPassword) {
      errors.currentPassword = 'Current password is required';
    }

    // Check new password
    if (!formData.newPassword) {
      errors.newPassword = 'New password is required';
    } else if (!passwordStrength.isValid) {
      errors.newPassword = 'Password does not meet security requirements';
    }

    // Check password confirmation
    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your new password';
    } else if (formData.newPassword !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    // Check if new password is same as current
    if (formData.currentPassword && formData.newPassword && 
        formData.currentPassword === formData.newPassword) {
      errors.newPassword = 'New password must be different from current password';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ============================================
  // FORM SUBMISSION
  // ============================================

  /**
   * Handle form submission
   * Validates and sends password change request to API
   * 
   * @param {Event} e - Form submit event
   */
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate form
    if (!validateForm()) {
      return;
    }

    // Set loading state
    setLoading(true);
    setError('');

    try {
      // Call API to change password
      const response = await api.put('/auth/change-password', {
        current_password: formData.currentPassword,
        new_password: formData.newPassword,
      });

      // Success!
      setSuccess(true);
      
      // Clear form
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });

      // Show success message for 2 seconds, then call onSuccess
      setTimeout(() => {
        if (onSuccess) {
          onSuccess(response.data);
        }
      }, 2000);

    } catch (err) {
      // Handle errors
      console.error('Password change error:', err);
      
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err.response?.status === 401) {
        setError('Current password is incorrect');
      } else if (err.response?.status === 400) {
        setError('Password does not meet security requirements');
        
        // Show detailed errors if available
        if (err.response?.data?.errors) {
          setValidationErrors({
            newPassword: err.response.data.errors.join(', ')
          });
        }
      } else {
        setError('Failed to change password. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle form cancel
   */
  const handleCancel = () => {
    // Clear form
    setFormData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    setError('');
    setValidationErrors({});
    
    // Call parent cancel handler
    if (onCancel) {
      onCancel();
    }
  };

  // ============================================
  // RENDER
  // ============================================

  // Show success state
  if (success) {
    return (
      <div className="space-y-6">
        {/* Success Card */}
        <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-lg p-6">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <CheckCircle className="w-12 h-12 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-1">
                Password Changed Successfully!
              </h3>
              <p className="text-sm text-green-700 dark:text-green-300">
                Your password has been updated. All other sessions have been logged out for security.
              </p>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={handleCancel}
          className="w-full px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 rounded-lg transition-colors"
        >
          Done
        </button>
      </div>
    );
  }

  // Show form
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Form Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-gray-200 dark:border-gray-700">
        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
          <Lock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Change Password
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Update your password to keep your account secure
          </p>
        </div>
      </div>

      {/* Global Error */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                {error}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Current Password Field */}
      <div className="space-y-2">
        <label 
          htmlFor="currentPassword" 
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Current Password <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            type={showPasswords.current ? 'text' : 'password'}
            id="currentPassword"
            name="currentPassword"
            value={formData.currentPassword}
            onChange={handleChange}
            className={`w-full px-4 py-2 pr-10 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
              validationErrors.currentPassword 
                ? 'border-red-300 dark:border-red-700' 
                : 'border-gray-300 dark:border-gray-600'
            }`}
            placeholder="Enter your current password"
            disabled={loading}
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => togglePasswordVisibility('current')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            tabIndex={-1}
          >
            {showPasswords.current ? (
              <EyeOff className="w-5 h-5" />
            ) : (
              <Eye className="w-5 h-5" />
            )}
          </button>
        </div>
        {validationErrors.currentPassword && (
          <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {validationErrors.currentPassword}
          </p>
        )}
      </div>

      {/* New Password Field */}
      <div className="space-y-2">
        <label 
          htmlFor="newPassword" 
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          New Password <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            type={showPasswords.new ? 'text' : 'password'}
            id="newPassword"
            name="newPassword"
            value={formData.newPassword}
            onChange={handleChange}
            className={`w-full px-4 py-2 pr-10 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
              validationErrors.newPassword 
                ? 'border-red-300 dark:border-red-700' 
                : 'border-gray-300 dark:border-gray-600'
            }`}
            placeholder="Enter your new password"
            disabled={loading}
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => togglePasswordVisibility('new')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            tabIndex={-1}
          >
            {showPasswords.new ? (
              <EyeOff className="w-5 h-5" />
            ) : (
              <Eye className="w-5 h-5" />
            )}
          </button>
        </div>
        {validationErrors.newPassword && (
          <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {validationErrors.newPassword}
          </p>
        )}
      </div>

      {/* Password Strength Meter */}
      {formData.newPassword && (
        <PasswordStrengthMeter
          password={formData.newPassword}
          onStrengthChange={handleStrengthChange}
        />
      )}

      {/* Confirm Password Field */}
      <div className="space-y-2">
        <label 
          htmlFor="confirmPassword" 
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Confirm New Password <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            type={showPasswords.confirm ? 'text' : 'password'}
            id="confirmPassword"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            className={`w-full px-4 py-2 pr-10 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
              validationErrors.confirmPassword 
                ? 'border-red-300 dark:border-red-700' 
                : 'border-gray-300 dark:border-gray-600'
            }`}
            placeholder="Confirm your new password"
            disabled={loading}
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => togglePasswordVisibility('confirm')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            tabIndex={-1}
          >
            {showPasswords.confirm ? (
              <EyeOff className="w-5 h-5" />
            ) : (
              <Eye className="w-5 h-5" />
            )}
          </button>
        </div>
        {validationErrors.confirmPassword && (
          <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            {validationErrors.confirmPassword}
          </p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={loading || !passwordStrength.isValid}
          className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Changing Password...
            </>
          ) : (
            <>
              <Lock className="w-4 h-4" />
              Change Password
            </>
          )}
        </button>
        
        <button
          type="button"
          onClick={handleCancel}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

// ============================================
// EXPORTS
// ============================================

export default ChangePasswordForm;


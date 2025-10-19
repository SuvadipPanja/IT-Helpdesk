// ============================================
// GENERAL SETTINGS TAB COMPONENT
// System-wide configuration settings
// ============================================

import { useState, useEffect } from 'react';
import {
  Save,
  RefreshCw,
  Globe,
  Building,
  Clock,
  Calendar,
  MessageSquare,
  Power,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';

// ============================================
// TIMEZONE OPTIONS
// ============================================
const TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST)' },
  { value: 'America/New_York', label: 'America/New_York (EST)' },
  { value: 'America/Chicago', label: 'America/Chicago (CST)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PST)' },
  { value: 'Europe/London', label: 'Europe/London (GMT)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai (CST)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST)' },
  { value: 'UTC', label: 'UTC' },
];

// ============================================
// DATE FORMAT OPTIONS
// ============================================
const DATE_FORMATS = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (31/12/2025)' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (12/31/2025)' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2025-12-31)' },
];

// ============================================
// TIME FORMAT OPTIONS
// ============================================
const TIME_FORMATS = [
  { value: '12', label: '12-hour (01:30 PM)' },
  { value: '24', label: '24-hour (13:30)' },
];

// ============================================
// GENERAL SETTINGS COMPONENT
// ============================================
const GeneralSettings = ({ settings, onUpdate, onBulkUpdate, loading }) => {
  // Local state for form fields
  const [formData, setFormData] = useState({
    system_name: '',
    system_title: '',
    company_name: '',
    timezone: 'Asia/Kolkata',
    date_format: 'DD/MM/YYYY',
    time_format: '24',
    maintenance_mode: false,
    maintenance_message: '',
    system_announcement: '',
    announcement_enabled: false,
  });

  const [hasChanges, setHasChanges] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  // ============================================
  // LOAD SETTINGS INTO FORM
  // ============================================
  useEffect(() => {
    if (settings && Object.keys(settings).length > 0) {
      const newFormData = {};

      // Map settings to form fields
      Object.keys(formData).forEach((key) => {
        if (settings[key]) {
          newFormData[key] = settings[key].value;
        }
      });

      setFormData((prev) => ({ ...prev, ...newFormData }));
      console.log('✅ General settings loaded into form:', newFormData);
    }
  }, [settings]);

  // ============================================
  // HANDLE FIELD CHANGE
  // ============================================
  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    setHasChanges(true);

    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors((prev) => ({
        ...prev,
        [field]: null,
      }));
    }
  };

  // ============================================
  // VALIDATE FORM
  // ============================================
  const validateForm = () => {
    const errors = {};

    if (!formData.system_name || formData.system_name.trim().length === 0) {
      errors.system_name = 'System name is required';
    }

    if (!formData.company_name || formData.company_name.trim().length === 0) {
      errors.company_name = 'Company name is required';
    }

    if (formData.maintenance_mode && !formData.maintenance_message.trim()) {
      errors.maintenance_message = 'Maintenance message is required when maintenance mode is enabled';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ============================================
  // HANDLE SAVE
  // ============================================
  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    // Prepare settings object for bulk update
    const settingsToUpdate = {};
    Object.keys(formData).forEach((key) => {
      settingsToUpdate[key] = formData[key];
    });

    await onBulkUpdate(settingsToUpdate);
    setHasChanges(false);
  };

  // ============================================
  // HANDLE RESET
  // ============================================
  const handleReset = () => {
    // Reload from settings prop
    const newFormData = {};
    Object.keys(formData).forEach((key) => {
      if (settings[key]) {
        newFormData[key] = settings[key].value;
      }
    });
    setFormData((prev) => ({ ...prev, ...newFormData }));
    setHasChanges(false);
    setValidationErrors({});
  };

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="settings-tab-content">
      {/* Tab Header */}
      <div className="settings-tab-header">
        <div>
          <h2>General Settings</h2>
          <p>Configure basic system information and preferences</p>
        </div>
        <div className="settings-tab-actions">
          <button
            className="btn-secondary"
            onClick={handleReset}
            disabled={!hasChanges || loading}
          >
            <RefreshCw size={18} />
            <span>Reset</span>
          </button>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={!hasChanges || loading}
          >
            <Save size={18} />
            <span>Save Changes</span>
          </button>
        </div>
      </div>

      {/* Settings Form */}
      <div className="settings-form">
        {/* System Information Section */}
        <div className="settings-section">
          <div className="settings-section-header">
            <Globe size={20} />
            <h3>System Information</h3>
          </div>
          <div className="settings-section-content">
            {/* System Name */}
            <div className="form-group">
              <label className="form-label">
                System Name <span className="required">*</span>
              </label>
              <input
                type="text"
                className={`form-input ${validationErrors.system_name ? 'error' : ''}`}
                value={formData.system_name}
                onChange={(e) => handleChange('system_name', e.target.value)}
                placeholder="Enter system name"
              />
              {validationErrors.system_name && (
                <span className="error-message">
                  <AlertCircle size={14} />
                  {validationErrors.system_name}
                </span>
              )}
              <span className="form-hint">
                This name appears in the header and throughout the application
              </span>
            </div>

            {/* System Title */}
            <div className="form-group">
              <label className="form-label">System Title</label>
              <input
                type="text"
                className="form-input"
                value={formData.system_title}
                onChange={(e) => handleChange('system_title', e.target.value)}
                placeholder="Enter system subtitle"
              />
              <span className="form-hint">
                Subtitle displayed below the system name
              </span>
            </div>

            {/* Company Name */}
            <div className="form-group">
              <label className="form-label">
                Company Name <span className="required">*</span>
              </label>
              <input
                type="text"
                className={`form-input ${validationErrors.company_name ? 'error' : ''}`}
                value={formData.company_name}
                onChange={(e) => handleChange('company_name', e.target.value)}
                placeholder="Enter company name"
              />
              {validationErrors.company_name && (
                <span className="error-message">
                  <AlertCircle size={14} />
                  {validationErrors.company_name}
                </span>
              )}
              <span className="form-hint">Your organization's name</span>
            </div>
          </div>
        </div>

        {/* Regional Settings Section */}
        <div className="settings-section">
          <div className="settings-section-header">
            <Clock size={20} />
            <h3>Regional Settings</h3>
          </div>
          <div className="settings-section-content">
            {/* Timezone */}
            <div className="form-group">
              <label className="form-label">Timezone</label>
              <select
                className="form-select"
                value={formData.timezone}
                onChange={(e) => handleChange('timezone', e.target.value)}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
              <span className="form-hint">
                Default timezone for the entire system
              </span>
            </div>

            {/* Date Format */}
            <div className="form-group">
              <label className="form-label">Date Format</label>
              <div className="radio-group">
                {DATE_FORMATS.map((format) => (
                  <label key={format.value} className="radio-label">
                    <input
                      type="radio"
                      name="date_format"
                      value={format.value}
                      checked={formData.date_format === format.value}
                      onChange={(e) => handleChange('date_format', e.target.value)}
                    />
                    <span>{format.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Time Format */}
            <div className="form-group">
              <label className="form-label">Time Format</label>
              <div className="radio-group">
                {TIME_FORMATS.map((format) => (
                  <label key={format.value} className="radio-label">
                    <input
                      type="radio"
                      name="time_format"
                      value={format.value}
                      checked={formData.time_format === format.value}
                      onChange={(e) => handleChange('time_format', e.target.value)}
                    />
                    <span>{format.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* System Announcement Section */}
        <div className="settings-section">
          <div className="settings-section-header">
            <MessageSquare size={20} />
            <h3>System Announcement</h3>
          </div>
          <div className="settings-section-content">
            {/* Enable Announcement */}
            <div className="form-group">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  className="toggle-input"
                  checked={formData.announcement_enabled}
                  onChange={(e) =>
                    handleChange('announcement_enabled', e.target.checked)
                  }
                />
                <span className="toggle-switch"></span>
                <span className="toggle-text">Show Announcement Banner</span>
              </label>
              <span className="form-hint">
                Display a banner message at the top of all pages
              </span>
            </div>

            {/* Announcement Message */}
            {formData.announcement_enabled && (
              <div className="form-group">
                <label className="form-label">Announcement Message</label>
                <textarea
                  className="form-textarea"
                  rows="3"
                  value={formData.system_announcement}
                  onChange={(e) =>
                    handleChange('system_announcement', e.target.value)
                  }
                  placeholder="Enter announcement message"
                />
                <span className="form-hint">
                  This message will be displayed to all users
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Maintenance Mode Section */}
        <div className="settings-section">
          <div className="settings-section-header">
            <Power size={20} />
            <h3>Maintenance Mode</h3>
          </div>
          <div className="settings-section-content">
            {/* Enable Maintenance Mode */}
            <div className="form-group">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  className="toggle-input"
                  checked={formData.maintenance_mode}
                  onChange={(e) =>
                    handleChange('maintenance_mode', e.target.checked)
                  }
                />
                <span className="toggle-switch"></span>
                <span className="toggle-text">Enable Maintenance Mode</span>
              </label>
              <span className="form-hint warning">
                <AlertCircle size={14} />
                Users will not be able to access the system when maintenance
                mode is enabled
              </span>
            </div>

            {/* Maintenance Message */}
            {formData.maintenance_mode && (
              <div className="form-group">
                <label className="form-label">
                  Maintenance Message <span className="required">*</span>
                </label>
                <textarea
                  className={`form-textarea ${
                    validationErrors.maintenance_message ? 'error' : ''
                  }`}
                  rows="3"
                  value={formData.maintenance_message}
                  onChange={(e) =>
                    handleChange('maintenance_message', e.target.value)
                  }
                  placeholder="Enter maintenance message"
                />
                {validationErrors.maintenance_message && (
                  <span className="error-message">
                    <AlertCircle size={14} />
                    {validationErrors.maintenance_message}
                  </span>
                )}
                <span className="form-hint">
                  This message will be shown to users during maintenance
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save Footer (sticky) */}
      {hasChanges && (
        <div className="settings-save-footer">
          <div className="save-footer-content">
            <div className="save-footer-message">
              <AlertCircle size={18} />
              <span>You have unsaved changes</span>
            </div>
            <div className="save-footer-actions">
              <button className="btn-secondary" onClick={handleReset}>
                Discard
              </button>
              <button className="btn-primary" onClick={handleSave}>
                <Save size={18} />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GeneralSettings;
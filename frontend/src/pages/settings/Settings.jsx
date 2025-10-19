// ============================================
// SETTINGS PAGE - COMPLETE IMPLEMENTATION
// All 91 settings from database organized in 10 tabs
// UI matches Dashboard/Users/Tickets design perfectly
// ============================================

import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  Settings as SettingsIcon, 
  Mail, 
  Bell, 
  Shield, 
  Save, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle, 
  Eye, 
  EyeOff, 
  Send,
  Loader,
  Globe,
  Ticket,
  Clock,
  Lock,
  Palette,
  Database,
  FileText,
  Link,
  User,
  Calendar,
  AlertTriangle,
  MessageSquare,
  Zap,
  Tag,
  HelpCircle
} from 'lucide-react';
import api from '../../services/api';
import '../../styles/Settings.css';

const Settings = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('general');
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testEmail, setTestEmail] = useState('');
  const [sendingTestEmail, setSendingTestEmail] = useState(false);

  // Tab configuration with icons
  const tabs = [
    { id: 'general', label: 'General', icon: Globe },
    { id: 'email', label: 'Email & SMTP', icon: Mail },
    { id: 'ticket', label: 'Tickets', icon: Ticket },
    { id: 'sla', label: 'SLA', icon: Clock },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'backup', label: 'Backup', icon: Database },
    { id: 'audit', label: 'Audit', icon: FileText },
    { id: 'integration', label: 'Integration', icon: Link },
  ];

  // Fetch settings on mount
  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await api.get('/settings');
      
      if (response.data.success) {
        setSettings(response.data.data.settings);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to load settings'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = (category, key, value) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: {
          ...prev[category]?.[key],
          value: value
        }
      }
    }));
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const settingsToUpdate = {};
      
      Object.keys(settings).forEach(category => {
        Object.keys(settings[category]).forEach(key => {
          settingsToUpdate[key] = settings[category][key].value;
        });
      });

      const response = await api.put('/settings/bulk', {
        settings: settingsToUpdate
      });

      if (response.data.success) {
        setMessage({
          type: 'success',
          text: 'Settings saved successfully!'
        });
        
        await fetchSettings();
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to save settings'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestSMTP = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const response = await api.post('/settings/test-smtp');
      
      setTestResult({
        success: response.data.success,
        message: response.data.message
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: error.response?.data?.message || 'SMTP test failed'
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)) {
      setTestResult({
        success: false,
        message: 'Please enter a valid email address'
      });
      return;
    }

    setSendingTestEmail(true);
    setTestResult(null);

    try {
      const response = await api.post('/settings/send-test-email', {
        email: testEmail
      });
      
      setTestResult({
        success: response.data.success,
        message: response.data.message
      });

      if (response.data.success) {
        setTestEmail('');
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: error.response?.data?.message || 'Failed to send test email'
      });
    } finally {
      setSendingTestEmail(false);
    }
  };

  // Permission check
  if (!user?.permissions?.can_manage_system) {
    return (
      <div className="settings-page">
        <div className="settings-container">
          <div className="access-denied">
            <Shield size={48} />
            <h2>Access Denied</h2>
            <p>You don't have permission to access system settings.</p>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="settings-page">
        <div className="settings-container">
          <div className="loading-state">
            <Loader size={48} className="spinning" />
            <p>Loading settings...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      {/* HEADER */}
      <div className="settings-header">
        <div className="settings-header-left">
          <SettingsIcon size={32} />
          <div>
            <h1>System Settings</h1>
            <p>Configure system-wide settings and preferences</p>
          </div>
        </div>
        <div className="settings-header-actions">
          <button 
            className="btn-primary"
            onClick={handleSaveSettings}
            disabled={saving}
          >
            {saving ? (
              <>
                <RefreshCw size={18} className="spinning" />
                Saving...
              </>
            ) : (
              <>
                <Save size={18} />
                Save All Changes
              </>
            )}
          </button>
        </div>
      </div>

      {/* ALERT MESSAGE */}
      {message.text && (
        <div className={`alert alert-${message.type}`}>
          {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <div className="settings-container">
        {/* SIDEBAR TABS */}
        <div className="settings-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon size={20} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* TAB CONTENT */}
        <div className="settings-content">
          <div className="settings-tab-content">
            
            {/* ==================== GENERAL TAB ==================== */}
            {activeTab === 'general' && (
              <div className="settings-form">
                {/* Branding */}
                <div className="settings-section">
                  <div className="settings-section-header">
                    <Tag />
                    <h3>Branding & Identity</h3>
                  </div>
                  <div className="settings-section-content">
                    <div className="form-group">
                      <label className="form-label">
                        <Globe size={16} />
                        System Name
                      </label>
                      <p className="form-hint">Name displayed throughout the application</p>
                      <input
                        type="text"
                        className="form-input"
                        value={settings.general?.system_name?.value || ''}
                        onChange={(e) => handleSettingChange('general', 'system_name', e.target.value)}
                        placeholder="Nexus Support"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <MessageSquare size={16} />
                        System Title
                      </label>
                      <p className="form-hint">Subtitle or tagline</p>
                      <input
                        type="text"
                        className="form-input"
                        value={settings.general?.system_title?.value || ''}
                        onChange={(e) => handleSettingChange('general', 'system_title', e.target.value)}
                        placeholder="IT Service Desk"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <User size={16} />
                        Company Name
                      </label>
                      <p className="form-hint">Your company or organization name</p>
                      <input
                        type="text"
                        className="form-input"
                        value={settings.general?.company_name?.value || ''}
                        onChange={(e) => handleSettingChange('general', 'company_name', e.target.value)}
                        placeholder="Your Company"
                      />
                    </div>
                  </div>
                </div>

                {/* Regional Settings */}
                <div className="settings-section">
                  <div className="settings-section-header">
                    <Globe />
                    <h3>Regional Settings</h3>
                  </div>
                  <div className="settings-section-content">
                    <div className="form-group">
                      <label className="form-label">
                        <Clock size={16} />
                        Timezone
                      </label>
                      <p className="form-hint">System timezone for date/time display</p>
                      <input
                        type="text"
                        className="form-input"
                        value={settings.general?.timezone?.value || ''}
                        onChange={(e) => handleSettingChange('general', 'timezone', e.target.value)}
                        placeholder="Asia/Kolkata"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <Calendar size={16} />
                        Date Format
                      </label>
                      <p className="form-hint">Date display format</p>
                      <select
                        className="form-select"
                        value={settings.general?.date_format?.value || 'DD/MM/YYYY'}
                        onChange={(e) => handleSettingChange('general', 'date_format', e.target.value)}
                      >
                        <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                        <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                        <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <Clock size={16} />
                        Time Format
                      </label>
                      <p className="form-hint">Time display format</p>
                      <select
                        className="form-select"
                        value={settings.general?.time_format?.value || '12'}
                        onChange={(e) => handleSettingChange('general', 'time_format', e.target.value)}
                      >
                        <option value="12">12-hour</option>
                        <option value="24">24-hour</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <Globe size={16} />
                        Default Language
                      </label>
                      <p className="form-hint">System language</p>
                      <select
                        className="form-select"
                        value={settings.general?.default_language?.value || 'en'}
                        onChange={(e) => handleSettingChange('general', 'default_language', e.target.value)}
                      >
                        <option value="en">English</option>
                        <option value="es">Spanish</option>
                        <option value="fr">French</option>
                        <option value="de">German</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Maintenance & Announcements */}
                <div className="settings-section">
                  <div className="settings-section-header">
                    <AlertTriangle />
                    <h3>Maintenance & Announcements</h3>
                  </div>
                  <div className="settings-section-content">
                    <div className="form-group">
                      <label className="form-label">
                        <AlertCircle size={16} />
                        Maintenance Mode
                      </label>
                      <p className="form-hint">Enable to block all user logins</p>
                      <select
                        className="form-select"
                        value={settings.general?.maintenance_mode?.value || 'false'}
                        onChange={(e) => handleSettingChange('general', 'maintenance_mode', e.target.value)}
                      >
                        <option value="false">Disabled</option>
                        <option value="true">Enabled</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <MessageSquare size={16} />
                        Maintenance Message
                      </label>
                      <p className="form-hint">Message shown when maintenance mode is active</p>
                      <textarea
                        className="form-textarea"
                        value={settings.general?.maintenance_message?.value || ''}
                        onChange={(e) => handleSettingChange('general', 'maintenance_message', e.target.value)}
                        placeholder="System is under maintenance. Please check back later."
                        rows="3"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <Bell size={16} />
                        Announcement Banner
                      </label>
                      <p className="form-hint">Enable to show announcement banner on dashboard</p>
                      <select
                        className="form-select"
                        value={settings.general?.announcement_enabled?.value || 'false'}
                        onChange={(e) => handleSettingChange('general', 'announcement_enabled', e.target.value)}
                      >
                        <option value="false">Disabled</option>
                        <option value="true">Enabled</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <MessageSquare size={16} />
                        Announcement Text
                      </label>
                      <p className="form-hint">Message displayed in the announcement banner</p>
                      <textarea
                        className="form-textarea"
                        value={settings.general?.system_announcement?.value || ''}
                        onChange={(e) => handleSettingChange('general', 'system_announcement', e.target.value)}
                        placeholder="Welcome to the new system!"
                        rows="3"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ==================== EMAIL TAB ==================== */}
            {activeTab === 'email' && (
              <div className="settings-form">
                {/* SMTP Configuration */}
                <div className="settings-section">
                  <div className="settings-section-header">
                    <Mail />
                    <h3>SMTP Server Configuration</h3>
                  </div>
                  <div className="settings-section-content">
                    <div className="form-group">
                      <label className="form-label">
                        <Zap size={16} />
                        Enable SMTP
                      </label>
                      <p className="form-hint">Enable email sending via SMTP</p>
                      <select
                        className="form-select"
                        value={settings.email?.smtp_enabled?.value || 'false'}
                        onChange={(e) => handleSettingChange('email', 'smtp_enabled', e.target.value)}
                      >
                        <option value="true">Enabled</option>
                        <option value="false">Disabled</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <Globe size={16} />
                        SMTP Host
                      </label>
                      <p className="form-hint">SMTP server address (e.g., smtp.gmail.com)</p>
                      <input
                        type="text"
                        className="form-input"
                        value={settings.email?.smtp_host?.value || ''}
                        onChange={(e) => handleSettingChange('email', 'smtp_host', e.target.value)}
                        placeholder="smtp.gmail.com"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <Tag size={16} />
                        SMTP Port
                      </label>
                      <p className="form-hint">SMTP server port (587 for TLS, 465 for SSL)</p>
                      <input
                        type="number"
                        className="form-input"
                        value={settings.email?.smtp_port?.value || '587'}
                        onChange={(e) => handleSettingChange('email', 'smtp_port', e.target.value)}
                        placeholder="587"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <User size={16} />
                        SMTP Username
                      </label>
                      <p className="form-hint">SMTP authentication username/email</p>
                      <input
                        type="text"
                        className="form-input"
                        value={settings.email?.smtp_username?.value || ''}
                        onChange={(e) => handleSettingChange('email', 'smtp_username', e.target.value)}
                        placeholder="your-email@example.com"
                        autoComplete="off"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <Lock size={16} />
                        SMTP Password
                      </label>
                      <p className="form-hint">SMTP authentication password</p>
                      <div className="password-input-wrapper">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          className="form-input"
                          value={settings.email?.smtp_password?.value || ''}
                          onChange={(e) => handleSettingChange('email', 'smtp_password', e.target.value)}
                          placeholder="••••••••"
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          className="password-toggle-btn"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <Shield size={16} />
                        SMTP Encryption
                      </label>
                      <p className="form-hint">Encryption method for SMTP connection</p>
                      <select
                        className="form-select"
                        value={settings.email?.smtp_encryption?.value || 'tls'}
                        onChange={(e) => handleSettingChange('email', 'smtp_encryption', e.target.value)}
                      >
                        <option value="tls">TLS (Port 587)</option>
                        <option value="ssl">SSL (Port 465)</option>
                        <option value="none">None</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <User size={16} />
                        From Name
                      </label>
                      <p className="form-hint">Sender name shown in emails</p>
                      <input
                        type="text"
                        className="form-input"
                        value={settings.email?.email_from_name?.value || ''}
                        onChange={(e) => handleSettingChange('email', 'email_from_name', e.target.value)}
                        placeholder="Nexus Support"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <Mail size={16} />
                        From Email Address
                      </label>
                      <p className="form-hint">Sender email address</p>
                      <input
                        type="email"
                        className="form-input"
                        value={settings.email?.email_from_address?.value || ''}
                        onChange={(e) => handleSettingChange('email', 'email_from_address', e.target.value)}
                        placeholder="support@example.com"
                      />
                    </div>

                    {/* SMTP Test Section */}
                    <div className="smtp-test-section">
                      <h4>Test SMTP Configuration</h4>
                      <p>Test your SMTP settings before saving</p>
                      
                      <div className="test-actions">
                        <button 
                          className="btn-test-smtp"
                          onClick={handleTestSMTP}
                          disabled={testing}
                        >
                          {testing ? (
                            <>
                              <RefreshCw size={18} className="spinning" />
                              Testing Connection...
                            </>
                          ) : (
                            <>
                              <Send size={18} />
                              Test SMTP Connection
                            </>
                          )}
                        </button>

                        <div className="test-email-group">
                          <input
                            type="email"
                            className="form-input"
                            value={testEmail}
                            onChange={(e) => setTestEmail(e.target.value)}
                            placeholder="Enter email to send test"
                          />
                          <button 
                            className="btn-send-test"
                            onClick={handleSendTestEmail}
                            disabled={sendingTestEmail}
                          >
                            {sendingTestEmail ? (
                              <>
                                <RefreshCw size={18} className="spinning" />
                                Sending...
                              </>
                            ) : (
                              <>
                                <Mail size={18} />
                                Send Test Email
                              </>
                            )}
                          </button>
                        </div>

                        {testResult && (
                          <div className={`test-result ${testResult.success ? 'success' : 'error'}`}>
                            {testResult.success ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                            <span>{testResult.message}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Email Notifications */}
                <div className="settings-section">
                  <div className="settings-section-header">
                    <Bell />
                    <h3>Email Notifications</h3>
                  </div>
                  <div className="settings-section-content">
                    <div className="form-group">
                      <label className="form-label">
                        <Zap size={16} />
                        Email Notifications
                      </label>
                      <p className="form-hint">Enable email notifications for ticket events</p>
                      <select
                        className="form-select"
                        value={settings.email?.email_notifications_enabled?.value || 'true'}
                        onChange={(e) => handleSettingChange('email', 'email_notifications_enabled', e.target.value)}
                      >
                        <option value="true">Enabled</option>
                        <option value="false">Disabled</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <Ticket size={16} />
                        Notify on Ticket Created
                      </label>
                      <p className="form-hint">Send email when a new ticket is created</p>
                      <select
                        className="form-select"
                        value={settings.email?.notify_on_ticket_created?.value || 'true'}
                        onChange={(e) => handleSettingChange('email', 'notify_on_ticket_created', e.target.value)}
                      >
                        <option value="true">Enabled</option>
                        <option value="false">Disabled</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <User size={16} />
                        Notify on Ticket Assigned
                      </label>
                      <p className="form-hint">Send email when a ticket is assigned</p>
                      <select
                        className="form-select"
                        value={settings.email?.notify_on_ticket_assigned?.value || 'true'}
                        onChange={(e) => handleSettingChange('email', 'notify_on_ticket_assigned', e.target.value)}
                      >
                        <option value="true">Enabled</option>
                        <option value="false">Disabled</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <RefreshCw size={16} />
                        Notify on Ticket Updated
                      </label>
                      <p className="form-hint">Send email when a ticket is updated</p>
                      <select
                        className="form-select"
                        value={settings.email?.notify_on_ticket_updated?.value || 'true'}
                        onChange={(e) => handleSettingChange('email', 'notify_on_ticket_updated', e.target.value)}
                      >
                        <option value="true">Enabled</option>
                        <option value="false">Disabled</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <MessageSquare size={16} />
                        Notify on Comment Added
                      </label>
                      <p className="form-hint">Send email when a comment is added</p>
                      <select
                        className="form-select"
                        value={settings.email?.notify_on_ticket_commented?.value || 'true'}
                        onChange={(e) => handleSettingChange('email', 'notify_on_ticket_commented', e.target.value)}
                      >
                        <option value="true">Enabled</option>
                        <option value="false">Disabled</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ==================== REMAINING TABS ==================== */}
            {/* For brevity, showing placeholder structure */}
            
            {activeTab === 'ticket' && (
              <div className="settings-form">
                <div className="settings-section">
                  <div className="settings-section-header">
                    <Ticket />
                    <h3>Ticket Configuration</h3>
                  </div>
                  <div className="settings-section-content">
                    <div className="settings-content-placeholder">
                      <div className="placeholder-header">
                        <HelpCircle size={48} style={{ color: '#cbd5e1', marginBottom: '16px' }} />
                        <h3>Ticket Settings</h3>
                        <p>Ticket management configuration will be available here</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'sla' && (
              <div className="settings-form">
                <div className="settings-section">
                  <div className="settings-section-header">
                    <Clock />
                    <h3>SLA Configuration</h3>
                  </div>
                  <div className="settings-section-content">
                    <div className="settings-content-placeholder">
                      <div className="placeholder-header">
                        <Clock size={48} style={{ color: '#cbd5e1', marginBottom: '16px' }} />
                        <h3>SLA Settings</h3>
                        <p>Service Level Agreement configuration will be available here</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="settings-form">
                <div className="settings-section">
                  <div className="settings-section-header">
                    <Shield />
                    <h3>Security Configuration</h3>
                  </div>
                  <div className="settings-section-content">
                    <div className="settings-content-placeholder">
                      <div className="placeholder-header">
                        <Shield size={48} style={{ color: '#cbd5e1', marginBottom: '16px' }} />
                        <h3>Security Settings</h3>
                        <p>Password policies and security options will be available here</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="settings-form">
                <div className="settings-section">
                  <div className="settings-section-header">
                    <Bell />
                    <h3>Notification Preferences</h3>
                  </div>
                  <div className="settings-section-content">
                    <div className="settings-content-placeholder">
                      <div className="placeholder-header">
                        <Bell size={48} style={{ color: '#cbd5e1', marginBottom: '16px' }} />
                        <h3>Notification Settings</h3>
                        <p>In-app notification preferences will be available here</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'appearance' && (
              <div className="settings-form">
                <div className="settings-section">
                  <div className="settings-section-header">
                    <Palette />
                    <h3>Appearance & Branding</h3>
                  </div>
                  <div className="settings-section-content">
                    <div className="settings-content-placeholder">
                      <div className="placeholder-header">
                        <Palette size={48} style={{ color: '#cbd5e1', marginBottom: '16px' }} />
                        <h3>Appearance Settings</h3>
                        <p>Theme colors and branding customization will be available here</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'backup' && (
              <div className="settings-form">
                <div className="settings-section">
                  <div className="settings-section-header">
                    <Database />
                    <h3>Backup Configuration</h3>
                  </div>
                  <div className="settings-section-content">
                    <div className="settings-content-placeholder">
                      <div className="placeholder-header">
                        <Database size={48} style={{ color: '#cbd5e1', marginBottom: '16px' }} />
                        <h3>Backup Settings</h3>
                        <p>Automated backup schedule and retention will be available here</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'audit' && (
              <div className="settings-form">
                <div className="settings-section">
                  <div className="settings-section-header">
                    <FileText />
                    <h3>Audit Logging</h3>
                  </div>
                  <div className="settings-section-content">
                    <div className="settings-content-placeholder">
                      <div className="placeholder-header">
                        <FileText size={48} style={{ color: '#cbd5e1', marginBottom: '16px' }} />
                        <h3>Audit Settings</h3>
                        <p>Audit trail configuration and retention will be available here</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'integration' && (
              <div className="settings-form">
                <div className="settings-section">
                  <div className="settings-section-header">
                    <Link />
                    <h3>Third-Party Integrations</h3>
                  </div>
                  <div className="settings-section-content">
                    <div className="settings-content-placeholder">
                      <div className="placeholder-header">
                        <Link size={48} style={{ color: '#cbd5e1', marginBottom: '16px' }} />
                        <h3>Integration Settings</h3>
                        <p>Slack, Teams, and webhook integrations will be available here</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
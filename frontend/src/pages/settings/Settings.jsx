// ============================================
// SETTINGS PAGE - COMPLETE IMPLEMENTATION
// ALL 95 SETTINGS FROM DATABASE - FULLY FUNCTIONAL
// Every tab populated with real settings
// UPDATED: Added Backup Functionality with Manual Backup, History, Download/Delete
// Developed by: Suvadip Panja
// Date: January 30, 2026
// ============================================

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { SubCategoriesTab, LocationsTab, ProcessesTab } from '../../components/settings/TicketConfigTabs';
import BotSettingsTab from '../../components/settings/BotSettingsTab';
import LicenseSettingsTab from '../../components/settings/LicenseSettingsTab';
import WhatsAppSettingsTab from '../../components/settings/WhatsAppSettingsTab';
import RefreshButton from '../../components/shared/RefreshButton';
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
  HelpCircle,
  ListOrdered,
  Power,
  Download,
  Trash2,
  Upload,
  Image,
  X,
  Layers,
  MapPin,
  Briefcase,
  RotateCcw,
  Users,
  GitBranch,
  Archive
} from 'lucide-react';
import api from '../../services/api';
import settingsLoader from '../../utils/settingsLoader';
import { formatDateTime } from '../../utils/dateUtils';
import '../../styles/Settings.css';

const Settings = () => {
  const { user, hasLicensedFeature } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('general');
  const [settings, setSettings] = useState({});
  // WhatsApp tab has its own save — this counter delegates the global button to it
  const [waSaveTrigger, setWaSaveTrigger] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testEmail, setTestEmail] = useState('');
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [priorities, setPriorities] = useState([]);
  const [categories, setCategories] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loadingLookups, setLoadingLookups] = useState(false);
  // SLA Policies Matrix state
  const [slaMatrix, setSlaMatrix] = useState({});
  const [slaMatrixMeta, setSlaMatrixMeta] = useState({ categories: [], priorities: [] });
  const [loadingSlaMatrix, setLoadingSlaMatrix] = useState(false);
  const [savingSlaMatrix, setSavingSlaMatrix] = useState(false);
  const [slaMatrixMsg, setSlaMatrixMsg] = useState({ type: '', text: '' });
  const [recalculating, setRecalculating] = useState(false);
  // Backup functionality state
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [backupHistory, setBackupHistory] = useState([]);
  const [backupStats, setBackupStats] = useState(null);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [backupPage, setBackupPage] = useState(1);
  const [backupPagination, setBackupPagination] = useState(null);
  // Restore state
  const [restorePhase, setRestorePhase] = useState(null); // null | 'confirming' | 'restoring' | 'done'
  const [restoreToken, setRestoreToken] = useState('');
  const [restoreCode, setRestoreCode] = useState('');
  const [restoreUserCode, setRestoreUserCode] = useState('');
  const [restoreBackupInfo, setRestoreBackupInfo] = useState(null);
  const [restoreError, setRestoreError] = useState('');
  const [restoreUploadFile, setRestoreUploadFile] = useState(null);
  const [preparingRestore, setPreparingRestore] = useState(false);
  const restoreFileRef = useRef(null);
  // Logo upload state
  const [logoPreview, setLogoPreview] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [currentLogoUrl, setCurrentLogoUrl] = useState('/logo.svg');
  const logoInputRef = useRef(null);



  // Tab configuration with icons and descriptions
  const hasSettingsPerm = (permission) => Boolean(user?.permissions?.can_manage_system || user?.permissions?.[permission]);

  const tabs = [
    { id: 'general',       label: 'General',        icon: Globe,      desc: 'System info & branding',   show: hasSettingsPerm('can_manage_settings_general') },
    { id: 'email',         label: 'Email & SMTP',   icon: Mail,       desc: 'Mail server config',       show: hasSettingsPerm('can_manage_settings_email') },
    { id: 'ticket',        label: 'Tickets',        icon: Ticket,     desc: 'Ticket workflow rules',    show: hasSettingsPerm('can_manage_settings_tickets') },
    { id: 'subcategories', label: 'Sub-Categories', icon: Layers,     desc: 'Category breakdown',       show: hasSettingsPerm('can_manage_settings_tickets') },
    { id: 'locations',     label: 'Locations',      icon: MapPin,     desc: 'Office locations',         show: hasSettingsPerm('can_manage_settings_general') },
    { id: 'processes',     label: 'Processes',      icon: Briefcase,  desc: 'Clients & projects',       show: hasSettingsPerm('can_manage_settings_tickets') },
    { id: 'sla',           label: 'SLA',            icon: Clock,      desc: 'Service level tracking',   show: hasSettingsPerm('can_manage_settings_sla') },
    { id: 'security',      label: 'Security',       icon: Shield,     desc: 'Auth & protection',        show: hasSettingsPerm('can_manage_settings_security') },
    { id: 'notifications', label: 'Notifications',  icon: Bell,       desc: 'Alert preferences',        show: hasSettingsPerm('can_manage_settings_general') },
    { id: 'bot',           label: 'Bot Settings',   icon: Zap,           desc: 'AI bot configuration',    show: hasSettingsPerm('can_manage_settings_bot') },
    { id: 'whatsapp',      label: 'WhatsApp',       icon: MessageSquare, desc: 'WhatsApp Business API',    show: hasSettingsPerm('can_manage_settings_bot') },
    { id: 'license',       label: 'License',        icon: FileText,      desc: 'Offline signed licensing', show: hasSettingsPerm('can_manage_settings_license') },
    { id: 'backup',        label: 'Backup',         icon: Database,   desc: 'Data backup & restore',    show: hasSettingsPerm('can_manage_settings_backup') && hasLicensedFeature('backup') },
  ].filter((tab) => tab.show);

  // Fetch settings on mount
  useEffect(() => {
    fetchSettings();
    fetchLookups();
  }, []);

  // Load backups when backup tab is opened
  useEffect(() => {
    if (activeTab === 'backup') {
      fetchBackupHistory(1);
      fetchBackupStats();
    }
  }, [activeTab]);

  // Load SLA matrix when SLA tab is opened
  useEffect(() => {
    if (activeTab === 'sla') {
      loadSlaMatrix();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'backup' && !hasLicensedFeature('backup')) {
      setActiveTab('license');
    }
    // If current tab is no longer accessible, switch to first available tab
    const allowed = tabs.map(t => t.id);
    if (allowed.length > 0 && !allowed.includes(activeTab)) {
      setActiveTab(allowed[0]);
    }
  }, [activeTab, hasLicensedFeature]);


  // ============================================
  // FETCH SETTINGS FROM API
  // ============================================
  const fetchSettings = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await api.get('/settings');
      
      if (response.data.success) {
        setSettings(response.data.data.settings);
        // Update current logo URL from settings (logo_url is in 'appearance' category)
        const logoVal = response.data.data.settings?.appearance?.logo_url?.value;
        if (logoVal) setCurrentLogoUrl(logoVal);
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to load settings'
      });
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // FETCH LOOKUPS (PRIORITIES & CATEGORIES)
  // ============================================
  const fetchLookups = async () => {
    setLoadingLookups(true);
    try {
      const response = await api.get('/system/lookups/settings');
      if (response.data.success) {
        setPriorities(response.data.data.priorities);
        setCategories(response.data.data.categories);
        setTeams(response.data.data.teams || []);
      }
    } catch (error) {
    } finally {
      setLoadingLookups(false);
    }
  };

  // ============================================
  // LOAD SLA POLICY MATRIX
  // ============================================
  const loadSlaMatrix = async () => {
    setLoadingSlaMatrix(true);
    setSlaMatrixMsg({ type: '', text: '' });
    try {
      const resp = await api.get('/sla/policies');
      if (resp.data.success) {
        const { policies, categories, priorities } = resp.data.data;
        setSlaMatrixMeta({ categories, priorities });
        // Build initial matrix using legacy priority hours as baseline
        const matrix = {};
        priorities.forEach(pr => {
          matrix[pr.priority_id] = {
            default: { response_time_hours: pr.response_time_hours || 4, resolution_time_hours: pr.resolution_time_hours || 24 }
          };
          categories.forEach(cat => {
            matrix[pr.priority_id][cat.category_id] = {
              response_time_hours: pr.response_time_hours || 4,
              resolution_time_hours: pr.resolution_time_hours || 24
            };
          });
        });
        // Overwrite with saved policies from DB
        policies.forEach(p => {
          const key = p.category_id === null || p.category_id === undefined ? 'default' : p.category_id;
          if (!matrix[p.priority_id]) matrix[p.priority_id] = {};
          matrix[p.priority_id][key] = {
            response_time_hours: p.response_time_hours,
            resolution_time_hours: p.resolution_time_hours
          };
        });
        setSlaMatrix(matrix);
      }
    } catch (err) {
      setSlaMatrixMsg({ type: 'error', text: 'Failed to load SLA threshold matrix' });
    } finally {
      setLoadingSlaMatrix(false);
    }
  };

  // ============================================
  // SAVE SLA POLICY MATRIX
  // ============================================
  const saveSlaMatrix = async () => {
    setSavingSlaMatrix(true);
    setSlaMatrixMsg({ type: '', text: '' });
    try {
      const policies = [];
      Object.keys(slaMatrix).forEach(priorityId => {
        Object.keys(slaMatrix[priorityId]).forEach(colKey => {
          const cell = slaMatrix[priorityId][colKey];
          policies.push({
            category_id: colKey === 'default' ? null : parseInt(colKey, 10),
            priority_id: parseInt(priorityId, 10),
            response_time_hours: parseFloat(cell.response_time_hours) || 4,
            resolution_time_hours: parseFloat(cell.resolution_time_hours) || 24
          });
        });
      });
      const resp = await api.put('/sla/policies', { policies });
      if (resp.data.success) {
        setSlaMatrixMsg({ type: 'success', text: `\u2705 ${resp.data.upsertedCount} SLA policies saved successfully!` });
      }
    } catch (err) {
      setSlaMatrixMsg({ type: 'error', text: err.response?.data?.message || 'Failed to save SLA policies' });
    } finally {
      setSavingSlaMatrix(false);
    }
  };

  // ============================================
  // RECALCULATE OPEN TICKET DUE DATES
  // ============================================
  const recalculateSlaTickets = async () => {
    setRecalculating(true);
    setSlaMatrixMsg({ type: '', text: '' });
    try {
      const resp = await api.post('/sla/recalculate');
      if (resp.data.success) {
        setSlaMatrixMsg({
          type: 'success',
          text: `\u2705 Recalculation done: ${resp.data.updatedCount} tickets updated, ${resp.data.skippedCount} skipped`
        });
      }
    } catch (err) {
      setSlaMatrixMsg({ type: 'error', text: err.response?.data?.message || 'Recalculation failed' });
    } finally {
      setRecalculating(false);
    }
  };

  // ============================================
  // HANDLE SETTING CHANGE
  // ============================================
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

  // ============================================
  // SAVE SETTINGS
  // ============================================
  const handleSaveSettings = async () => {
    // WhatsApp tab manages its own settings via a dedicated API — delegate
    // the global "Save Changes" button to it so either button works.
    if (activeTab === 'whatsapp') {
      setWaSaveTrigger(n => n + 1);
      return;
    }

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
        
        // Reload rate limit configuration if rate_limiting settings exist
        try {
          await api.post('/settings/rate-limits/reload');
        } catch (rlError) {
        }

        await fetchSettings();

        // Refresh public settings so browser title, sidebar, timezone etc. update
        await settingsLoader.refreshSettings();
        
        // Clear settings service cache so all components pick up new timezone/date format
        try {
          const settingsServiceModule = await import('../../services/settingsService');
          settingsServiceModule.default.clearCache();
        } catch (e) { /* ok */ }
        
        const newName = settingsToUpdate.system_name || window.APP_SETTINGS?.system_name;
        if (newName) {
          document.title = newName;
        }
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to save settings'
      });
    } finally {
      setSaving(false);
    }
  };

  // ============================================
  // UPDATE BROWSER FAVICON
  // ============================================
  const updateFavicon = (logoUrl) => {
    const faviconLink = document.querySelector("link[rel='icon']");
    if (faviconLink) {
      if (logoUrl && logoUrl.startsWith('/uploads')) {
        const base = import.meta.env.VITE_API_BASE_URL?.replace('/api/v1', '') || '';
        faviconLink.href = `${base}${logoUrl}`;
      } else {
        faviconLink.href = logoUrl || '/favicon.svg';
      }
    }
  };

  // ============================================
  // LOGO UPLOAD HANDLERS
  // ============================================
  const handleLogoSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      setMessage({ type: 'error', text: 'Only image files are allowed (JPEG, PNG, SVG, WebP, GIF)' });
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Logo file must be smaller than 5MB' });
      return;
    }

    // Preview
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleLogoUpload = async () => {
    const file = logoInputRef.current?.files[0];
    if (!file) return;

    setUploadingLogo(true);
    setMessage({ type: '', text: '' });

    try {
      const formData = new FormData();
      formData.append('logo', file);

      const response = await api.post('/settings/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success) {
        const newLogoUrl = response.data.data.logo_url;
        setCurrentLogoUrl(newLogoUrl);
        setLogoPreview(null);
        if (logoInputRef.current) logoInputRef.current.value = '';
        setMessage({ type: 'success', text: 'Logo uploaded successfully!' });

        // Update browser favicon
        updateFavicon(newLogoUrl);

        // Refresh public settings so sidebar/login update
        await settingsLoader.refreshSettings();
        await fetchSettings();
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to upload logo' });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleLogoReset = async () => {
    setUploadingLogo(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await api.delete('/settings/logo');

      if (response.data.success) {
        setCurrentLogoUrl('/logo.svg');
        setLogoPreview(null);
        if (logoInputRef.current) logoInputRef.current.value = '';
        setMessage({ type: 'success', text: 'Logo reset to default' });

        // Reset browser favicon to default
        updateFavicon('/favicon.svg');

        await settingsLoader.refreshSettings();
        await fetchSettings();
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to reset logo' });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleCancelLogoPreview = () => {
    setLogoPreview(null);
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  // ============================================
  // TEST SMTP CONNECTION
  // ============================================
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

  // ============================================
  // SEND TEST EMAIL
  // ============================================
  const handleSendTestEmail = async () => {
    if (!testEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)) {
      setMessage({
        type: 'error',
        text: 'Please enter a valid email address'
      });
      return;
    }

    setSendingTestEmail(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await api.post('/settings/send-test-email', {
        email: testEmail
      });

      if (response.data.success) {
        setMessage({
          type: 'success',
          text: 'Test email sent successfully! Check your inbox.'
        });
        setTestEmail('');
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to send test email'
      });
    } finally {
      setSendingTestEmail(false);
    }
  };

  // Navigate to Email Queue
  const handleViewEmailQueue = () => {
    navigate('/email-queue');
  };

  // Navigate to Email Templates
  const handleViewEmailTemplates = () => {
    navigate('/email-templates');
  };

  // ============================================
  // BACKUP FUNCTIONALITY
  // ============================================
  
  const fetchBackupHistory = async (page = 1) => {
    setLoadingBackups(true);
    try {
      const response = await api.get(`/backup/history?page=${page}&limit=10`);
      if (response.data.success) {
        setBackupHistory(response.data.data.backups);
        setBackupPagination(response.data.data.pagination);
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Failed to load backup history'
      });
    } finally {
      setLoadingBackups(false);
    }
  };

  const fetchBackupStats = async () => {
    try {
      const response = await api.get('/backup/stats');
      if (response.data.success) {
        setBackupStats(response.data.data);
      }
    } catch (error) {
    }
  };

  const handleCreateManualBackup = async () => {
    if (!window.confirm('Create a backup now? This may take several minutes depending on data size.')) {
      return;
    }

    setCreatingBackup(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await api.post('/backup/create');
      
      if (response.data.success) {
        setMessage({
          type: 'success',
          text: `Backup created successfully! Total size: ${response.data.data.totalSizeMB.toFixed(2)} MB`
        });
        
        await fetchBackupHistory(backupPage);
        await fetchBackupStats();
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to create backup'
      });
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleDeleteBackup = async (backupId, backupName) => {
    if (!window.confirm(`Delete backup "${backupName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await api.delete(`/backup/${backupId}`);
      
      if (response.data.success) {
        setMessage({
          type: 'success',
          text: 'Backup deleted successfully'
        });
        
        await fetchBackupHistory(backupPage);
        await fetchBackupStats();
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to delete backup'
      });
    }
  };

  const handleDownloadBackup = async (backupId, backupName) => {
    try {
      setMessage({
        type: 'info',
        text: 'Preparing backup download...'
      });

      const response = await api.get(`/backup/${backupId}/download`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${backupName}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setMessage({
        type: 'success',
        text: 'Backup download started'
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to download backup'
      });
    }
  };

  // ============================================
  // RESTORE HANDLERS
  // ============================================

  // Prepare restore from a server-side backup (by ID)
  const handlePrepareRestore = async (backupId, backupName) => {
    if (!window.confirm(
      `You are about to initiate a RESTORE from backup "${backupName}".\n\n` +
      `This will COMPLETELY REPLACE the current database and all uploaded files.\n\n` +
      `A confirmation code will be shown. You must type it exactly to proceed.\n\n` +
      `Continue?`
    )) return;

    setRestoreError('');
    setRestoreUserCode('');
    setPreparingRestore(true);
    try {
      const response = await api.post('/backup/restore/prepare', { backupId });
      const data = response.data.data;
      setRestoreToken(data.token);
      setRestoreCode(data.confirmationCode);
      setRestoreBackupInfo(data.backupInfo);
      setRestorePhase('confirming');
    } catch (err) {
      setRestoreError(err.response?.data?.message || 'Failed to prepare restore session');
    } finally {
      setPreparingRestore(false);
    }
  };

  // Prepare restore from an uploaded ZIP file
  const handlePrepareRestoreFromZip = async () => {
    if (!restoreUploadFile) return;
    setRestoreError('');
    setRestoreUserCode('');
    setPreparingRestore(true);
    try {
      const formData = new FormData();
      formData.append('backupFile', restoreUploadFile);
      const response = await api.post('/backup/restore/prepare', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const data = response.data.data;
      setRestoreToken(data.token);
      setRestoreCode(data.confirmationCode);
      setRestoreBackupInfo(data.backupInfo);
      setRestoreUploadFile(null);
      if (restoreFileRef.current) restoreFileRef.current.value = '';
      setRestorePhase('confirming');
    } catch (err) {
      setRestoreError(err.response?.data?.message || 'Failed to process backup file');
    } finally {
      setPreparingRestore(false);
    }
  };

  // Execute restore after confirmation code entry
  const handleExecuteRestore = async () => {
    if (!restoreUserCode.trim()) {
      setRestoreError('Please enter the confirmation code');
      return;
    }
    setRestoreError('');
    setRestorePhase('restoring');
    try {
      await api.post('/backup/restore/execute', {
        token: restoreToken,
        confirmationCode: restoreUserCode.trim()
      });
      setRestorePhase('done');
    } catch (err) {
      setRestoreError(err.response?.data?.message || 'Restore failed. Please try again.');
      setRestorePhase('confirming');
    }
  };

  const handleCancelRestore = () => {
    setRestorePhase(null);
    setRestoreToken('');
    setRestoreCode('');
    setRestoreUserCode('');
    setRestoreBackupInfo(null);
    setRestoreError('');
    setRestoreUploadFile(null);
    if (restoreFileRef.current) restoreFileRef.current.value = '';
  };


  // Check permission — allow access if user has any settings permission
  const hasAnySettingsAccess = user?.permissions && (
    user.permissions.can_manage_system ||
    user.permissions.can_manage_settings_general ||
    user.permissions.can_manage_settings_email ||
    user.permissions.can_manage_settings_tickets ||
    user.permissions.can_manage_settings_sla ||
    user.permissions.can_manage_settings_security ||
    user.permissions.can_manage_settings_bot ||
    user.permissions.can_manage_settings_license ||
    user.permissions.can_manage_settings_backup
  );

  if (!hasAnySettingsAccess) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <Shield size={48} style={{ color: '#ef4444', marginBottom: '16px' }} />
        <h2 style={{ color: '#1e293b', marginBottom: '8px' }}>Access Denied</h2>
        <p style={{ color: '#64748b' }}>
          You don't have permission to access system settings.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="settings-loading">
        <Loader className="spinner" size={36} />
        <span>Loading settings...</span>
      </div>
    );
  }

  return (
    <div className="settings-page">
      {/* Header */}
      <div className="settings-header">
        <div className="settings-header-left">
          <SettingsIcon size={32} />
          <div>
            <h1>System Settings</h1>
            <p>Configure and manage your helpdesk system</p>
          </div>
        </div>
        <div className="settings-header-actions">
          <button 
            className="btn-secondary" 
            onClick={fetchSettings}
            disabled={loading}
          >
            <RefreshCw size={18} />
            Refresh
          </button>
          <button 
            className="btn-primary" 
            onClick={handleSaveSettings}
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader size={18} className="spinner" />
                Saving...
              </>
            ) : (
              <>
                <Save size={18} />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      {/* Success/Error Message */}
      {message.text && (
        <div className={`alert alert-${message.type}`}>
          {message.type === 'success' ? (
            <CheckCircle size={20} />
          ) : (
            <AlertCircle size={20} />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Main Content */}
      <div className="settings-container">
        {/* Sidebar Tabs */}
        <div className="settings-tabs">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={18} />
                <div>
                  <span>{tab.label}</span>
                  {tab.desc && <div className="settings-tab-desc">{tab.desc}</div>}
                </div>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="settings-content">
          {/* GENERAL TAB */}
          {activeTab === 'general' && (
            <div className="settings-form">
              <div className="settings-section">
                <div className="settings-section-header">
                  <Globe />
                  <h3>System Information</h3>
                </div>
                <div className="settings-section-content">
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">
                        <Tag size={16} />
                        System Name
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        value={settings.general?.system_name?.value || ''}
                        onChange={(e) => handleSettingChange('general', 'system_name', e.target.value)}
                        placeholder="Nexus Support"
                      />
                      <small className="form-help">Display name for your helpdesk system</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <FileText size={16} />
                        System Title
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        value={settings.general?.system_title?.value || ''}
                        onChange={(e) => handleSettingChange('general', 'system_title', e.target.value)}
                        placeholder="IT Helpdesk"
                      />
                      <small className="form-help">Browser tab title</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <User size={16} />
                        Company Name
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        value={settings.general?.company_name?.value || ''}
                        onChange={(e) => handleSettingChange('general', 'company_name', e.target.value)}
                        placeholder="Your Company"
                      />
                      <small className="form-help">Your organization name</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <Link size={16} />
                        Public site URL
                      </label>
                      <input
                        type="url"
                        className="form-input"
                        value={settings.general?.app_public_url?.value || ''}
                        onChange={(e) => handleSettingChange('general', 'app_public_url', e.target.value)}
                        placeholder="https://helpdesk.yourcompany.com"
                        autoComplete="off"
                      />
                      <small className="form-help">
                        Base URL used in emails (password reset, ticket links). Leave empty to use{' '}
                        <code>APP_PUBLIC_URL</code> from the server environment. In production, use HTTPS and a
                        public hostname (not localhost).
                      </small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <Globe size={16} />
                        Timezone
                      </label>
                      <select
                        className="form-select"
                        value={settings.general?.timezone?.value || 'Asia/Kolkata'}
                        onChange={(e) => handleSettingChange('general', 'timezone', e.target.value)}
                      >
                        <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                        <option value="America/New_York">America/New_York (EST)</option>
                        <option value="Europe/London">Europe/London (GMT)</option>
                        <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                      </select>
                      <small className="form-help">System timezone</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <Calendar size={16} />
                        Date Format
                      </label>
                      <select
                        className="form-select"
                        value={settings.general?.date_format?.value || 'DD/MM/YYYY'}
                        onChange={(e) => handleSettingChange('general', 'date_format', e.target.value)}
                      >
                        <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                        <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                        <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                      </select>
                      <small className="form-help">Date display format</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <Clock size={16} />
                        Time Format
                      </label>
                      <select
                        className="form-select"
                        value={settings.general?.time_format?.value || '24'}
                        onChange={(e) => handleSettingChange('general', 'time_format', e.target.value)}
                      >
                        <option value="12">12 Hour</option>
                        <option value="24">24 Hour</option>
                      </select>
                      <small className="form-help">Time display format</small>
                    </div>
                  </div>
                </div>
              </div>

              {/* Maintenance Mode Section */}
              <div className="settings-section">
                <div className="settings-section-header">
                  <AlertTriangle />
                  <h3>Maintenance Mode</h3>
                </div>
                <div className="settings-section-content">
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">
                        <Power size={16} />
                        Enable Maintenance Mode
                      </label>
                      <select
                        className="form-select"
                        value={String(settings.general?.maintenance_mode?.value || 'false')}
                        onChange={(e) => handleSettingChange('general', 'maintenance_mode', e.target.value)}
                      >
                        <option value="true">Enabled</option>
                        <option value="false">Disabled</option>
                      </select>
                      <small className="form-help">Put system in maintenance mode</small>
                    </div>

                    <div className="form-group full-width">
                      <label className="form-label">
                        <MessageSquare size={16} />
                        Maintenance Message
                      </label>
                      <textarea
                        className="form-textarea"
                        value={settings.general?.maintenance_message?.value || ''}
                        onChange={(e) => handleSettingChange('general', 'maintenance_message', e.target.value)}
                        placeholder="System is under maintenance..."
                        rows="3"
                        disabled={String(settings.general?.maintenance_mode?.value) !== 'true'}
                      />
                      <small className="form-help">Message shown during maintenance</small>
                    </div>
                  </div>
                </div>
              </div>

              {/* Announcement Section */}
              <div className="settings-section">
                <div className="settings-section-header">
                  <Bell />
                  <h3>System Announcement</h3>
                </div>
                <div className="settings-section-content">
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">
                        <Bell size={16} />
                        Enable Announcement
                      </label>
                      <select
                        className="form-select"
                        value={String(settings.general?.announcement_enabled?.value || 'false')}
                        onChange={(e) => handleSettingChange('general', 'announcement_enabled', e.target.value)}
                      >
                        <option value="true">Enabled</option>
                        <option value="false">Disabled</option>
                      </select>
                      <small className="form-help">Show announcement banner on dashboard</small>
                    </div>

                    <div className="form-group full-width">
                      <label className="form-label">
                        <MessageSquare size={16} />
                        Announcement Text
                      </label>
                      <textarea
                        className="form-textarea"
                        value={settings.general?.system_announcement?.value || ''}
                        onChange={(e) => handleSettingChange('general', 'system_announcement', e.target.value)}
                        placeholder="Enter announcement message..."
                        rows="3"
                        disabled={String(settings.general?.announcement_enabled?.value) !== 'true'}
                      />
                      <small className="form-help">Message to display on the dashboard</small>
                    </div>
                  </div>
                </div>
              </div>

              {/* Branding / Logo Section */}
              <div className="settings-section">
                <div className="settings-section-header">
                  <Image />
                  <h3>System Logo</h3>
                </div>
                <div className="settings-section-content">
                  <div className="logo-upload-area">
                    <div className="logo-current-preview">
                      <div className="logo-preview-box">
                        <img 
                          src={logoPreview || (currentLogoUrl?.startsWith('/uploads') 
                            ? `${import.meta.env.VITE_API_BASE_URL?.replace('/api/v1', '')}${currentLogoUrl}` 
                            : currentLogoUrl || '/logo.svg')} 
                          alt="Current Logo"
                          onError={(e) => { e.target.src = '/logo.svg'; }}
                        />
                      </div>
                      <div className="logo-preview-info">
                        <h4>Current Logo</h4>
                        <p>Displayed on login page, sidebar, and browser tab.</p>
                        <p className="logo-hint">Recommended: Square image, at least 128×128px. Supports PNG, SVG, JPG, WebP.</p>
                      </div>
                    </div>

                    <div className="logo-upload-controls">
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif"
                        onChange={handleLogoSelect}
                        style={{ display: 'none' }}
                        id="logo-file-input"
                      />
                      <button
                        type="button"
                        className="btn-logo-upload"
                        onClick={() => logoInputRef.current?.click()}
                        disabled={uploadingLogo}
                      >
                        <Upload size={16} />
                        Choose Logo
                      </button>

                      {logoPreview && (
                        <>
                          <button
                            type="button"
                            className="btn-logo-save"
                            onClick={handleLogoUpload}
                            disabled={uploadingLogo}
                          >
                            {uploadingLogo ? <Loader size={16} className="spin" /> : <CheckCircle size={16} />}
                            {uploadingLogo ? 'Uploading...' : 'Save Logo'}
                          </button>
                          <button
                            type="button"
                            className="btn-logo-cancel"
                            onClick={handleCancelLogoPreview}
                            disabled={uploadingLogo}
                          >
                            <X size={16} />
                            Cancel
                          </button>
                        </>
                      )}

                      {!logoPreview && currentLogoUrl !== '/logo.svg' && (
                        <button
                          type="button"
                          className="btn-logo-reset"
                          onClick={handleLogoReset}
                          disabled={uploadingLogo}
                        >
                          <RefreshCw size={16} />
                          Reset to Default
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>


            </div>
          )}

          {/* EMAIL & SMTP TAB */}
          {activeTab === 'email' && (
            <div className="settings-form">
              <div className="settings-section">
                <div className="settings-section-header">
                  <Mail />
                  <h3>SMTP Configuration</h3>
                </div>
                <div className="settings-section-content">
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">
                        <Power size={16} />
                        Enable SMTP
                      </label>
                      <select
                        className="form-select"
                        value={String(settings.email?.smtp_enabled?.value || 'false')}
                        onChange={(e) => handleSettingChange('email', 'smtp_enabled', e.target.value)}
                      >
                        <option value="true">Enabled</option>
                        <option value="false">Disabled</option>
                      </select>
                      <small className="form-help">Enable email sending functionality</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <Mail size={16} />
                        SMTP Host
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        value={settings.email?.smtp_host?.value || ''}
                        onChange={(e) => handleSettingChange('email', 'smtp_host', e.target.value)}
                        placeholder="smtp.gmail.com"
                      />
                      <small className="form-help">Your SMTP server address</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <Tag size={16} />
                        SMTP Port
                      </label>
                      <input
                        type="number"
                        className="form-input"
                        value={settings.email?.smtp_port?.value || ''}
                        onChange={(e) => handleSettingChange('email', 'smtp_port', e.target.value)}
                        placeholder="587"
                      />
                      <small className="form-help">SMTP port (usually 587 or 465)</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <Shield size={16} />
                        SMTP Encryption
                      </label>
                      <select
                        className="form-select"
                        value={settings.email?.smtp_encryption?.value || 'tls'}
                        onChange={(e) => handleSettingChange('email', 'smtp_encryption', e.target.value)}
                      >
                        <option value="tls">TLS</option>
                        <option value="ssl">SSL</option>
                        <option value="none">None</option>
                      </select>
                      <small className="form-help">Encryption type</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <User size={16} />
                        SMTP Username
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        value={settings.email?.smtp_username?.value || ''}
                        onChange={(e) => handleSettingChange('email', 'smtp_username', e.target.value)}
                        placeholder="your-email@gmail.com"
                      />
                      <small className="form-help">SMTP authentication username</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <Lock size={16} />
                        SMTP Password
                      </label>
                      <div className="password-input-wrapper">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          className="form-input"
                          value={settings.email?.smtp_password?.value || ''}
                          onChange={(e) => handleSettingChange('email', 'smtp_password', e.target.value)}
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          className="password-toggle"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                      <small className="form-help">SMTP authentication password</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <Mail size={16} />
                        From Email Address
                      </label>
                      <input
                        type="email"
                        className="form-input"
                        value={settings.email?.email_from_address?.value || ''}
                        onChange={(e) => handleSettingChange('email', 'email_from_address', e.target.value)}
                        placeholder="noreply@yourcompany.com"
                      />
                      <small className="form-help">Email address shown in "From" field</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <User size={16} />
                        From Name
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        value={settings.email?.email_from_name?.value || ''}
                        onChange={(e) => handleSettingChange('email', 'email_from_name', e.target.value)}
                        placeholder="IT Helpdesk"
                      />
                      <small className="form-help">Name shown in "From" field</small>
                    </div>
                  </div>

                  {/* Test Connection Button */}
                  <div className="settings-divider" />
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                      className="btn-test-smtp"
                      onClick={handleTestSMTP}
                      disabled={testing || String(settings.email?.smtp_enabled?.value) !== 'true'}
                    >
                      {testing ? (
                        <>
                          <Loader size={18} className="spinner" />
                          Testing...
                        </>
                      ) : (
                        <>
                          <Send size={18} />
                          Test Connection
                        </>
                      )}
                    </button>

                    {testResult && (
                      <div className={`smtp-test-result ${testResult.success ? 'success' : 'error'}`}>
                        {testResult.success ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                        <div className="result-content">
                          <strong>{testResult.success ? 'Connection Successful' : 'Connection Failed'}</strong>
                          <span>{testResult.message}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Email Notifications Section */}
              <div className="settings-section">
                <div className="settings-section-header">
                  <Bell />
                  <h3>Email Notifications</h3>
                </div>
                <div className="settings-section-content">
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">
                        <Power size={16} />
                        Enable Email Notifications
                      </label>
                      <select
                        className="form-select"
                        value={String(settings.notification?.email_notifications_enabled?.value || 'false')}
                        onChange={(e) => handleSettingChange('notification', 'email_notifications_enabled', e.target.value)}
                      >
                        <option value="true">Enabled</option>
                        <option value="false">Disabled</option>
                      </select>
                      <small className="form-help">Master switch for all email notifications</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <Ticket size={16} />
                        Ticket Created
                      </label>
                      <select
                        className="form-select"
                        value={String(settings.notification?.notify_on_ticket_created?.value || 'false')}
                        onChange={(e) => handleSettingChange('notification', 'notify_on_ticket_created', e.target.value)}
                        disabled={String(settings.notification?.email_notifications_enabled?.value) !== 'true'}
                      >
                        <option value="true">Enabled</option>
                        <option value="false">Disabled</option>
                      </select>
                      <small className="form-help">Notify admins when new ticket is created</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <User size={16} />
                        Ticket Assigned
                      </label>
                      <select
                        className="form-select"
                        value={String(settings.notification?.notify_on_ticket_assigned?.value || 'false')}
                        onChange={(e) => handleSettingChange('notification', 'notify_on_ticket_assigned', e.target.value)}
                        disabled={String(settings.notification?.email_notifications_enabled?.value) !== 'true'}
                      >
                        <option value="true">Enabled</option>
                        <option value="false">Disabled</option>
                      </select>
                      <small className="form-help">Notify engineer when ticket is assigned</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <RefreshCw size={16} />
                        Ticket Updated
                      </label>
                      <select
                        className="form-select"
                        value={String(settings.notification?.notify_on_ticket_updated?.value || 'false')}
                        onChange={(e) => handleSettingChange('notification', 'notify_on_ticket_updated', e.target.value)}
                        disabled={String(settings.notification?.email_notifications_enabled?.value) !== 'true'}
                      >
                        <option value="true">Enabled</option>
                        <option value="false">Disabled</option>
                      </select>
                      <small className="form-help">Notify when ticket status changes</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <MessageSquare size={16} />
                        Comment Added
                      </label>
                      <select
                        className="form-select"
                        value={String(settings.notification?.notify_on_ticket_commented?.value || 'false')}
                        onChange={(e) => handleSettingChange('notification', 'notify_on_ticket_commented', e.target.value)}
                        disabled={String(settings.notification?.email_notifications_enabled?.value) !== 'true'}
                      >
                        <option value="true">Enabled</option>
                        <option value="false">Disabled</option>
                      </select>
                      <small className="form-help">Notify when comment is added</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <Archive size={16} />
                        Closure request (managers)
                      </label>
                      <select
                        className="form-select"
                        value={String(settings.notification?.notify_on_closure_request?.value ?? 'true')}
                        onChange={(e) => handleSettingChange('notification', 'notify_on_closure_request', e.target.value)}
                        disabled={String(settings.notification?.email_notifications_enabled?.value) !== 'true'}
                      >
                        <option value="true">Enabled</option>
                        <option value="false">Disabled</option>
                      </select>
                      <small className="form-help">Email managers when an engineer requests ticket closure</small>
                    </div>
                  </div>
                </div>
              </div>

              {/* Send Test Email Section */}
              <div className="settings-section">
                <div className="settings-section-header">
                  <Send />
                  <h3>Send Test Email</h3>
                </div>
                <div className="test-email-section">
                  <div className="form-group">
                    <label className="form-label">
                      <Mail size={16} />
                      Test Email Address
                    </label>
                    <input
                      type="email"
                      className="form-input"
                      value={testEmail}
                      onChange={(e) => setTestEmail(e.target.value)}
                      placeholder="your-email@example.com"
                    />
                    <small className="form-help">Enter email address to receive test email</small>
                  </div>
                  <button
                    className="btn-send-test"
                    onClick={handleSendTestEmail}
                    disabled={sendingTestEmail || !testEmail || String(settings.email?.smtp_enabled?.value) !== 'true'}
                  >
                    {sendingTestEmail ? (
                      <>
                        <Loader size={18} className="spinner" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send size={18} />
                        Send Test Email
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Email Management Section */}
              <div className="settings-section">
                <div className="settings-section-header">
                  <ListOrdered />
                  <h3>Email Management</h3>
                </div>
                <div className="settings-section-content">
                  <div className="settings-link-grid">
                    <div className="settings-link-card" onClick={handleViewEmailQueue}>
                      <ListOrdered size={22} />
                      <div className="link-card-text">
                        <div className="link-card-title">Email Queue</div>
                        <div className="link-card-desc">View and manage outgoing emails</div>
                      </div>
                    </div>
                    <div className="settings-link-card" onClick={handleViewEmailTemplates}>
                      <Mail size={22} />
                      <div className="link-card-text">
                        <div className="link-card-title">Email Templates</div>
                        <div className="link-card-desc">Customize notification templates</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TICKETS TAB */}
          {activeTab === 'ticket' && (
            <div className="settings-form">
              {/* Ticket Numbering Section */}
              <div className="settings-section">
                <div className="settings-section-header">
                  <Tag />
                  <h3>Ticket Numbering</h3>
                </div>
                <div className="settings-section-content">
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">
                        <Tag size={16} />
                        Ticket Number Prefix
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        value={settings.ticket?.ticket_number_prefix?.value || ''}
                        onChange={(e) => handleSettingChange('ticket', 'ticket_number_prefix', e.target.value)}
                        placeholder="TKT"
                        maxLength="10"
                      />
                      <small className="form-help">Prefix for ticket numbers (e.g., TKT-001)</small>
                    </div>
                  </div>
                </div>
              </div>

              {/* Default Values Section */}
              <div className="settings-section">
                <div className="settings-section-header">
                  <Ticket />
                  <h3>Default Values</h3>
                </div>
                <div className="settings-section-content">
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">
                        <AlertTriangle size={16} />
                        Default Priority
                      </label>
                      <select
                        className="form-select"
                        value={settings.ticket?.ticket_default_priority?.value || '3'}
                        onChange={(e) => handleSettingChange('ticket', 'ticket_default_priority', e.target.value)}
                        disabled={loadingLookups}
                      >
                        {priorities.map(priority => (
                          <option key={priority.priority_id} value={priority.priority_id}>
                            {priority.priority_name}
                          </option>
                        ))}
                      </select>
                      <small className="form-help">Default priority for new tickets</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <Tag size={16} />
                        Default Category
                      </label>
                      <select
                        className="form-select"
                        value={settings.ticket?.ticket_default_category?.value || '9'}
                        onChange={(e) => handleSettingChange('ticket', 'ticket_default_category', e.target.value)}
                        disabled={loadingLookups}
                      >
                        {categories.map(category => (
                          <option key={category.category_id} value={category.category_id}>
                            {category.category_name}
                          </option>
                        ))}
                      </select>
                      <small className="form-help">Default category for new tickets</small>
                    </div>
                  </div>
                </div>
              </div>

              {/* Auto-Assignment Section */}
              <div className="settings-section">
                <div className="settings-section-header">
                  <User />
                  <h3>Auto-Assignment</h3>
                </div>
                <div className="settings-section-content">
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">
                        <Power size={16} />
                        Enable Auto-Assignment
                      </label>
                      <select
                        className="form-select"
                        value={String(settings.ticket?.ticket_auto_assignment?.value || 'false')}
                        onChange={(e) => handleSettingChange('ticket', 'ticket_auto_assignment', e.target.value)}
                      >
                        <option value="true">Enabled</option>
                        <option value="false">Disabled</option>
                      </select>
                      <small className="form-help">Automatically assign new tickets to engineers only (Users and HR roles are excluded)</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <Zap size={16} />
                        Assignment Method
                      </label>
                      <select
                        className="form-select"
                        value={settings.ticket?.ticket_assignment_method?.value || 'round_robin'}
                        onChange={(e) => handleSettingChange('ticket', 'ticket_assignment_method', e.target.value)}
                        disabled={String(settings.ticket?.ticket_auto_assignment?.value) !== 'true'}
                      >
                        <option value="round_robin">Round Robin</option>
                        <option value="load_balanced">Load Balanced</option>
                        <option value="department">Department Based</option>
                        <option value="location_wise">Location Wise</option>
                      </select>
                      <small className="form-help">
                        {(() => {
                          const method = settings.ticket?.ticket_assignment_method?.value || 'round_robin';
                          if (method === 'round_robin') return 'Assigns to engineers in rotation based on who was last assigned';
                          if (method === 'load_balanced') return 'Assigns to the engineer with the fewest open tickets';
                          if (method === 'department') return 'Assigns only to engineers within the same department (no cross-department fallback)';
                          if (method === 'location_wise') return 'Assigns to the engineer at the same location with fewest open tickets';
                          return 'How tickets are distributed to engineers';
                        })()}
                      </small>
                    </div>

                    {/* Assignment Scope — only relevant when central team routing is enabled */}
                    {String(settings.ticket?.ticket_central_team_enabled?.value) === 'true' && (
                      <div className="form-group">
                        <label className="form-label">
                          <GitBranch size={16} />
                          Assignment Scope
                        </label>
                        <select
                          className="form-select"
                          value={settings.ticket?.ticket_auto_assignment_scope?.value || 'direct'}
                          onChange={(e) => handleSettingChange('ticket', 'ticket_auto_assignment_scope', e.target.value)}
                          disabled={String(settings.ticket?.ticket_auto_assignment?.value) !== 'true'}
                        >
                          <option value="direct">Assign directly to engineer</option>
                          <option value="team_first">Route to team bucket first (engineer self-assigns)</option>
                        </select>
                        <small className="form-help">
                          <strong>Direct:</strong> auto-assignment picks an engineer immediately. &nbsp;
                          <strong>Team first:</strong> ticket goes to team bucket; engineers pick tickets from their team queue.
                        </small>
                      </div>
                    )}
                  </div>

                  {String(settings.ticket?.ticket_auto_assignment?.value) === 'true' && (
                    <div className="settings-info-box" style={{ 
                      marginTop: '12px', padding: '12px 16px', 
                      background: 'var(--bg-secondary)', borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.6'
                    }}>
                      <strong style={{ color: 'var(--text-primary)' }}>Assignment Rules:</strong>
                      <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                        <li>Only <strong>Engineer</strong> role users are eligible for auto-assignment</li>
                        <li>Only <strong>active</strong> users are considered</li>
                        <li>For Round Robin &amp; Load Balanced: tries same department first, then falls back to any department</li>
                        <li>For Department Based: strictly assigns within the ticket's department only</li>
                        <li>For Location Wise: assigns to the engineer at the same location with fewest open tickets, falls back to load balanced if none found</li>
                        <li>Manual assignment supports Engineer, Manager, and Admin roles</li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* Auto-Escalation Section */}
              <div className="settings-section">
                <div className="settings-section-header">
                  <AlertTriangle />
                  <h3>Auto-Escalation</h3>
                </div>
                <div className="settings-section-content">
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">
                        <Power size={16} />
                        Enable Auto-Escalation
                      </label>
                      <select
                        className="form-select"
                        value={String(settings.ticket?.ticket_auto_escalate?.value || 'false')}
                        onChange={(e) => handleSettingChange('ticket', 'ticket_auto_escalate', e.target.value)}
                      >
                        <option value="true">Enabled</option>
                        <option value="false">Disabled</option>
                      </select>
                      <small className="form-help">Automatically escalate unresolved tickets</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <Clock size={16} />
                        Escalation Threshold (Hours)
                      </label>
                      <input
                        type="number"
                        className="form-input"
                        value={settings.ticket?.ticket_escalate_hours?.value || '24'}
                        onChange={(e) => handleSettingChange('ticket', 'ticket_escalate_hours', e.target.value)}
                        min="1"
                        max="168"
                        disabled={String(settings.ticket?.ticket_auto_escalate?.value) !== 'true'}
                      />
                      <small className="form-help">Hours before escalating unresolved tickets</small>
                    </div>
                  </div>
                </div>
              </div>

              {/* Central Team Routing Section */}
              <div className="settings-section">
                <div className="settings-section-header">
                  <Users />
                  <h3>Central Team Routing</h3>
                </div>
                <div className="settings-section-content">
                  <div className="form-grid">
                    {/* Enable Central Team Routing */}
                    <div className="form-group">
                      <label className="form-label">
                        <Power size={16} />
                        Enable Central Team Routing
                      </label>
                      <select
                        className="form-select"
                        value={String(settings.ticket?.ticket_central_team_enabled?.value || 'false')}
                        onChange={(e) => handleSettingChange('ticket', 'ticket_central_team_enabled', e.target.value)}
                      >
                        <option value="true">Enabled</option>
                        <option value="false">Disabled</option>
                      </select>
                      <small className="form-help">Route all new tickets to a central team inbox before specialist assignment</small>
                    </div>

                    {/* Central Team Selector */}
                    <div className="form-group">
                      <label className="form-label">
                        <Users size={16} />
                        Central Team
                      </label>
                      <select
                        className="form-select"
                        value={String(settings.ticket?.ticket_central_team_id?.value || '0')}
                        onChange={(e) => handleSettingChange('ticket', 'ticket_central_team_id', e.target.value)}
                        disabled={String(settings.ticket?.ticket_central_team_enabled?.value) !== 'true'}
                      >
                        <option value="0">— Select a team —</option>
                        {teams.map((t) => (
                          <option key={t.team_id} value={String(t.team_id)}>
                            {t.team_name}{t.is_central ? ' ★' : ''}
                          </option>
                        ))}
                      </select>
                      <small className="form-help">Team that receives all new tickets as the first inbox (★ = current central team)</small>
                    </div>

                    {/* Routing Mode */}
                    <div className="form-group">
                      <label className="form-label">
                        <GitBranch size={16} />
                        Routing Mode
                      </label>
                      <select
                        className="form-select"
                        value={settings.ticket?.ticket_central_team_mode?.value || 'always'}
                        onChange={(e) => handleSettingChange('ticket', 'ticket_central_team_mode', e.target.value)}
                        disabled={String(settings.ticket?.ticket_central_team_enabled?.value) !== 'true'}
                      >
                        <option value="always">Always route to central team first</option>
                        <option value="category_fallback">Only if no direct category rule applies</option>
                      </select>
                      <small className="form-help">
                        <strong>Always:</strong> every new ticket lands in the central inbox first. &nbsp;
                        <strong>Category fallback:</strong> direct category→team rules take priority; central team used only when no rule matches.
                      </small>
                    </div>
                  </div>
                </div>
              </div>

              {/* Auto-Close & Permissions Section */}
              <div className="settings-section">
                <div className="settings-section-header">
                  <Lock />
                  <h3>Ticket Lifecycle & Permissions</h3>
                </div>
                <div className="settings-section-content">
                  <div className="form-grid">
                    {/* ✅ Enable Auto-Close Toggle */}
                    <div className="form-group">
                      <label className="form-label">
                        <Power size={16} />
                        Enable Auto-Close
                      </label>
                      <select
                        className="form-select"
                        value={String(settings.ticket?.ticket_auto_close_enabled?.value || 'false')}
                        onChange={(e) => handleSettingChange('ticket', 'ticket_auto_close_enabled', e.target.value)}
                      >
                        <option value="true">Enabled</option>
                        <option value="false">Disabled</option>
                      </select>
                      <small className="form-help">Automatically close resolved tickets after specified days</small>
                    </div>

                    {/* Auto-Close Days */}
                    <div className="form-group">
                      <label className="form-label">
                        <Calendar size={16} />
                        Auto-Close After (Days)
                      </label>
                      <input
                        type="number"
                        className="form-input"
                        value={settings.ticket?.ticket_auto_close_days?.value || '30'}
                        onChange={(e) => handleSettingChange('ticket', 'ticket_auto_close_days', e.target.value)}
                        min="1"
                        max="365"
                        disabled={String(settings.ticket?.ticket_auto_close_enabled?.value) !== 'true'}
                      />
                      <small className="form-help">Days to wait before auto-closing resolved tickets</small>
                    </div>

                    {/* Allow User Close */}
                    <div className="form-group">
                      <label className="form-label">
                        <User size={16} />
                        Allow Users to Close Tickets
                      </label>
                      <select
                        className="form-select"
                        value={String(settings.ticket?.ticket_allow_user_close?.value || 'false')}
                        onChange={(e) => handleSettingChange('ticket', 'ticket_allow_user_close', e.target.value)}
                      >
                        <option value="true">Allowed</option>
                        <option value="false">Not Allowed</option>
                      </select>
                      <small className="form-help">Let users close their own tickets</small>
                    </div>

                    {/* Require Approval to Close */}
                    <div className="form-group">
                      <label className="form-label">
                        <Shield size={16} />
                        Require Manager Approval to Close
                      </label>
                      <select
                        className="form-select"
                        value={String(settings.ticket?.ticket_require_approval_close?.value || 'false')}
                        onChange={(e) => handleSettingChange('ticket', 'ticket_require_approval_close', e.target.value)}
                      >
                        <option value="true">Required</option>
                        <option value="false">Not Required</option>
                      </select>
                      <small className="form-help">Require manager approval before closing tickets</small>
                    </div>
                  </div>

                  {/* Info Box */}
                  <div className="settings-info-box info" style={{ marginTop: '20px' }}>
                    <HelpCircle size={18} />
                    <p>
                      <strong>Quick Tip:</strong> Enable auto-close above to activate the background job. 
                      The auto-close job runs daily at midnight and closes resolved tickets that have exceeded 
                      the specified threshold days.
                    </p>
                  </div>
                </div>
              </div>

              {/* Job Status Section */}
              <div className="settings-section">
                <div className="settings-section-header">
                  <Zap />
                  <h3>Background Jobs Status</h3>
                </div>
                <div className="settings-section-content">
                  <div className="jobs-status-grid">
                    {/* Auto-Escalation Job Status */}
                    <div className="job-status-card">
                      <div className={`job-status-dot ${String(settings.ticket?.ticket_auto_escalate?.value) === 'true' ? 'active' : 'inactive'}`} />
                      <div className="job-status-info">
                        <div className="job-status-name">Auto-Escalation Job</div>
                        <div className="job-status-state">
                          {String(settings.ticket?.ticket_auto_escalate?.value) === 'true' ? 'Active • Running hourly' : 'Inactive'}
                        </div>
                      </div>
                    </div>

                    {/* Auto-Close Job Status */}
                    <div className="job-status-card">
                      <div className={`job-status-dot ${String(settings.ticket?.ticket_auto_close_enabled?.value) === 'true' ? 'active' : 'inactive'}`} />
                      <div className="job-status-info">
                        <div className="job-status-name">Auto-Close Job</div>
                        <div className="job-status-state">
                          {String(settings.ticket?.ticket_auto_close_enabled?.value) === 'true' ? 'Active • Running daily' : 'Inactive'}
                        </div>
                      </div>
                    </div>

                    {/* Email Processor Job Status */}
                    <div className="job-status-card">
                      <div className={`job-status-dot ${String(settings.email?.smtp_enabled?.value) === 'true' ? 'active' : 'inactive'}`} />
                      <div className="job-status-info">
                        <div className="job-status-name">Email Processor</div>
                        <div className="job-status-state">
                          {String(settings.email?.smtp_enabled?.value) === 'true' ? 'Active • Every 5 minutes' : 'Inactive'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Info Box */}
                  <div className="settings-info-box info" style={{ marginTop: '20px' }}>
                    <HelpCircle size={18} />
                    <p>
                      <strong>Quick Tip:</strong> Changes to background job settings apply immediately without requiring a server restart. Jobs check settings before each execution.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SUB-CATEGORIES TAB */}
          {activeTab === 'subcategories' && (
            <div className="settings-form">
              <SubCategoriesTab />
            </div>
          )}

          {/* LOCATIONS TAB */}
          {activeTab === 'locations' && (
            <div className="settings-form">
              <LocationsTab />
            </div>
          )}

          {/* PROCESSES TAB */}
          {activeTab === 'processes' && (
            <div className="settings-form">
              <ProcessesTab />
            </div>
          )}

          {/* SLA TAB - PHASE 2 FIX: ALL 10 SLA SETTINGS */}
          {activeTab === 'sla' && (
            <div className="settings-form">
              
              {/* SLA Monitoring Job Control - Top Warning Box */}
              <div className="settings-section">
                <div className="settings-section-header">
                  <Power />
                  <h3>SLA Background Monitoring Job</h3>
                </div>
                <div className="settings-section-content">
                  <div className="form-group">
                    <label className="form-label">
                      <Power size={16} />
                      Enable SLA Monitoring Job
                    </label>
                    <select
                      className="form-select"
                      value={String(settings.sla?.sla_monitoring_enabled?.value || 'false')}
                      onChange={(e) => handleSettingChange('sla', 'sla_monitoring_enabled', e.target.value)}
                    >
                      <option value="true">Enabled</option>
                      <option value="false">Disabled</option>
                    </select>
                    <small className="form-help">
                      Controls the background cron job that monitors SLA breaches every 15 minutes
                    </small>
                  </div>
                  
                  {/* Warning Alert Box */}
                  <div className={`settings-info-box ${String(settings.sla?.sla_monitoring_enabled?.value) === 'true' ? 'success' : 'danger'}`} style={{ marginTop: '16px' }}>
                    <AlertTriangle size={18} />
                    <p>
                      <strong>Important:</strong> This controls the background SLA breach detection job. 
                      When enabled, the system monitors all open tickets every 15 minutes for SLA violations. 
                      Changes take effect within 15 minutes.
                    </p>
                  </div>
                </div>
              </div>

              {/* Main SLA Configuration */}
              <div className="settings-section">
                <div className="settings-section-header">
                  <Clock />
                  <h3>SLA Tracking Configuration</h3>
                </div>
                <div className="settings-section-content">
                  <div className="form-grid">
                    
                    {/* ⭐ FIELD 1: Enable SLA Tracking */}
                    <div className="form-group">
                      <label className="form-label">
                        <Power size={16} />
                        Enable SLA Tracking
                      </label>
                      <select
                        className="form-select"
                        value={String(settings.sla?.sla_enabled?.value || 'false')}
                        onChange={(e) => handleSettingChange('sla', 'sla_enabled', e.target.value)}
                      >
                        <option value="true">Enabled</option>
                        <option value="false">Disabled</option>
                      </select>
                      <small className="form-help">
                        Enable Service Level Agreement tracking with business hours calculation
                      </small>
                    </div>

                    {/* ⭐ FIELD 2: Business Hours Start */}
                    <div className="form-group">
                      <label className="form-label">
                        <Clock size={16} />
                        Business Hours Start
                      </label>
                      <input
                        type="time"
                        className="form-input"
                        value={settings.sla?.sla_business_hours_start?.value || '09:00'}
                        onChange={(e) => handleSettingChange('sla', 'sla_business_hours_start', e.target.value)}
                        disabled={String(settings.sla?.sla_enabled?.value) !== 'true'}
                      />
                      <small className="form-help">Start of business hours (24-hour format)</small>
                    </div>

                    {/* ⭐ FIELD 3: Business Hours End */}
                    <div className="form-group">
                      <label className="form-label">
                        <Clock size={16} />
                        Business Hours End
                      </label>
                      <input
                        type="time"
                        className="form-input"
                        value={settings.sla?.sla_business_hours_end?.value || '17:00'}
                        onChange={(e) => handleSettingChange('sla', 'sla_business_hours_end', e.target.value)}
                        disabled={String(settings.sla?.sla_enabled?.value) !== 'true'}
                      />
                      <small className="form-help">End of business hours (24-hour format)</small>
                    </div>

                    {/* ⭐ FIELD 4: Working Days */}
                    <div className="form-group">
                      <label className="form-label">
                        <Calendar size={16} />
                        Working Days
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        value={settings.sla?.sla_working_days?.value || 'mon,tue,wed,thu,fri,sat'}
                        onChange={(e) => handleSettingChange('sla', 'sla_working_days', e.target.value)}
                        placeholder="mon,tue,wed,thu,fri,sat"
                        disabled={String(settings.sla?.sla_enabled?.value) !== 'true'}
                      />
                      <small className="form-help">
                        Comma-separated working days (sun,mon,tue,wed,thu,fri,sat)
                      </small>
                    </div>

                    {/* ⭐ FIELD 5: SLA Warning Threshold */}
                    <div className="form-group">
                      <label className="form-label">
                        <AlertTriangle size={16} />
                        SLA Warning Threshold (%)
                      </label>
                      <input
                        type="number"
                        className="form-input"
                        value={settings.sla?.sla_warning_threshold?.value || '90'}
                        onChange={(e) => handleSettingChange('sla', 'sla_warning_threshold', e.target.value)}
                        min="1"
                        max="100"
                        disabled={String(settings.sla?.sla_enabled?.value) !== 'true'}
                      />
                      <small className="form-help">
                        Show warning when ticket reaches X% of SLA time (default: 90%)
                      </small>
                    </div>

                    {/* ⭐ FIELD 6: Notify Manager on Breach */}
                    <div className="form-group">
                      <label className="form-label">
                        <Bell size={16} />
                        Notify Manager on Breach
                      </label>
                      <select
                        className="form-select"
                        value={String(settings.sla?.sla_breach_notify_manager?.value || 'false')}
                        onChange={(e) => handleSettingChange('sla', 'sla_breach_notify_manager', e.target.value)}
                        disabled={String(settings.sla?.sla_enabled?.value) !== 'true'}
                      >
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                      <small className="form-help">
                        Send notification to managers when SLA is breached
                      </small>
                    </div>

                    {/* ⭐ FIELD 7: Auto-Escalate on Breach */}
                    <div className="form-group">
                      <label className="form-label">
                        <Zap size={16} />
                        Auto-Escalate on Breach
                      </label>
                      <select
                        className="form-select"
                        value={String(settings.sla?.sla_breach_auto_escalate?.value || 'false')}
                        onChange={(e) => handleSettingChange('sla', 'sla_breach_auto_escalate', e.target.value)}
                        disabled={String(settings.sla?.sla_enabled?.value) !== 'true'}
                      >
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                      <small className="form-help">
                        Automatically escalate tickets when SLA is breached
                      </small>
                    </div>

                    {/* ⭐ FIELD 8: Notify on SLA Warning */}
                    <div className="form-group">
                      <label className="form-label">
                        <MessageSquare size={16} />
                        Notify on SLA Warning
                      </label>
                      <select
                        className="form-select"
                        value={String(settings.notification?.notify_on_sla_warning?.value || settings.sla?.notify_on_sla_warning?.value || 'true')}
                        onChange={(e) => handleSettingChange('notification', 'notify_on_sla_warning', e.target.value)}
                        disabled={String(settings.sla?.sla_enabled?.value) !== 'true'}
                      >
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                      <small className="form-help">
                        Send notification when ticket reaches SLA warning threshold
                      </small>
                    </div>

                    {/* ⭐ FIELD 9: Notify on SLA Breach */}
                    <div className="form-group">
                      <label className="form-label">
                        <MessageSquare size={16} />
                        Notify on SLA Breach
                      </label>
                      <select
                        className="form-select"
                        value={String(settings.notification?.notify_on_sla_breach?.value || settings.sla?.notify_on_sla_breach?.value || 'true')}
                        onChange={(e) => handleSettingChange('notification', 'notify_on_sla_breach', e.target.value)}
                        disabled={String(settings.sla?.sla_enabled?.value) !== 'true'}
                      >
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                      <small className="form-help">
                        Send notification when ticket breaches SLA deadline
                      </small>
                    </div>

                  </div>

                  {/* Information Box */}
                  <div className="settings-info-box info" style={{ marginTop: '24px' }}>
                    <HelpCircle size={18} />
                    <p>
                      <strong>How SLA Works:</strong> When SLA tracking is enabled, due dates are calculated 
                      based on business hours and working days. When disabled, due dates use simple time addition 
                      (24/7 calculation). The monitoring job runs every 15 minutes to check for violations.
                    </p>
                  </div>
                </div>
              </div>

              {/* ====================================================
                  SLA THRESHOLD MATRIX
                  Category × Priority grid — admins set individual
                  response / resolution hours per combination.
                  ==================================================== */}
              <div className="settings-section">
                <div className="settings-section-header">
                  <Tag />
                  <h3>SLA Threshold Matrix (Category × Priority)</h3>
                </div>
                <div className="settings-section-content">

                  <div className="settings-info-box info" style={{ marginBottom: '16px' }}>
                    <HelpCircle size={18} />
                    <p>
                      <strong>Per-Category SLA Thresholds:</strong> Set custom response and resolution
                      time targets for each priority level × category combination. The <em>Default</em>
                      column applies when no specific category rule is set. Values are in <strong>hours</strong>.
                      After saving, optionally click <em>Apply to Open Tickets</em> to recalculate
                      due dates for all currently open tickets.
                    </p>
                  </div>

                  {loadingSlaMatrix ? (
                    <div style={{ textAlign: 'center', padding: '32px' }}>
                      <Loader size={24} className="spin" />
                      <p style={{ marginTop: '8px', color: '#64748b' }}>Loading threshold matrix…</p>
                    </div>
                  ) : (
                    <>
                      {/* Scrollable matrix table */}
                      <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
                        <table style={{ borderCollapse: 'collapse', minWidth: '100%', fontSize: '13px' }}>
                          <thead>
                            <tr style={{ background: '#f1f5f9' }}>
                              <th style={{ padding: '10px 14px', textAlign: 'left', whiteSpace: 'nowrap', border: '1px solid #e2e8f0', minWidth: '110px' }}>
                                Priority
                              </th>
                              <th style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap', border: '1px solid #e2e8f0', background: '#e0f2fe', minWidth: '130px' }}>
                                Default<br />
                                <small style={{ fontWeight: 400, color: '#64748b' }}>(All Categories)</small>
                              </th>
                              {slaMatrixMeta.categories.map(cat => (
                                <th key={cat.category_id} style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap', border: '1px solid #e2e8f0', minWidth: '130px' }}>
                                  {cat.category_name}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {slaMatrixMeta.priorities.map(pr => (
                              <tr key={pr.priority_id}>
                                <td style={{ padding: '10px 14px', fontWeight: 600, border: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                                  <span style={{
                                    display: 'inline-block', padding: '2px 8px', borderRadius: '9999px',
                                    fontSize: '11px', fontWeight: 700,
                                    background: pr.priority_code === 'CRITICAL' ? '#fee2e2' : pr.priority_code === 'HIGH' ? '#ffedd5' : pr.priority_code === 'MEDIUM' ? '#fef9c3' : '#f0fdf4',
                                    color: pr.priority_code === 'CRITICAL' ? '#dc2626' : pr.priority_code === 'HIGH' ? '#ea580c' : pr.priority_code === 'MEDIUM' ? '#ca8a04' : '#16a34a',
                                  }}>
                                    {pr.priority_name}
                                  </span>
                                </td>
                                {/* Default column */}
                                {['default', ...slaMatrixMeta.categories.map(c => c.category_id)].map(colKey => (
                                  <td key={colKey} style={{ padding: '8px 10px', border: '1px solid #e2e8f0', background: colKey === 'default' ? '#f0f9ff' : 'transparent' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        <span style={{ fontSize: '11px', color: '#64748b', width: '44px', flexShrink: 0 }}>Resp:</span>
                                        <input
                                          type="number"
                                          min="0.5"
                                          step="0.5"
                                          style={{ width: '64px', padding: '3px 6px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px' }}
                                          value={slaMatrix[pr.priority_id]?.[colKey]?.response_time_hours ?? ''}
                                          onChange={e => setSlaMatrix(prev => ({
                                            ...prev,
                                            [pr.priority_id]: {
                                              ...prev[pr.priority_id],
                                              [colKey]: {
                                                ...prev[pr.priority_id]?.[colKey],
                                                response_time_hours: e.target.value
                                              }
                                            }
                                          }))}
                                        />
                                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>h</span>
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                        <span style={{ fontSize: '11px', color: '#64748b', width: '44px', flexShrink: 0 }}>Resol:</span>
                                        <input
                                          type="number"
                                          min="0.5"
                                          step="0.5"
                                          style={{ width: '64px', padding: '3px 6px', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '12px' }}
                                          value={slaMatrix[pr.priority_id]?.[colKey]?.resolution_time_hours ?? ''}
                                          onChange={e => setSlaMatrix(prev => ({
                                            ...prev,
                                            [pr.priority_id]: {
                                              ...prev[pr.priority_id],
                                              [colKey]: {
                                                ...prev[pr.priority_id]?.[colKey],
                                                resolution_time_hours: e.target.value
                                              }
                                            }
                                          }))}
                                        />
                                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>h</span>
                                      </div>
                                    </div>
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Status message */}
                      {slaMatrixMsg.text && (
                        <div className={`settings-info-box ${slaMatrixMsg.type === 'success' ? 'success' : 'danger'}`} style={{ marginBottom: '12px' }}>
                          {slaMatrixMsg.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                          <p>{slaMatrixMsg.text}</p>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <button
                          className="btn btn-primary"
                          onClick={saveSlaMatrix}
                          disabled={savingSlaMatrix || recalculating}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          {savingSlaMatrix ? <Loader size={15} className="spin" /> : <Save size={15} />}
                          {savingSlaMatrix ? 'Saving…' : 'Save Threshold Matrix'}
                        </button>

                        <button
                          className="btn btn-secondary"
                          onClick={recalculateSlaTickets}
                          disabled={savingSlaMatrix || recalculating}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                          title="Recalculates due_date for all currently open tickets using the latest SLA policies"
                        >
                          {recalculating ? <Loader size={15} className="spin" /> : <RotateCcw size={15} />}
                          {recalculating ? 'Applying…' : 'Apply to Open Tickets'}
                        </button>

                        <button
                          className="btn btn-secondary"
                          onClick={loadSlaMatrix}
                          disabled={loadingSlaMatrix || savingSlaMatrix || recalculating}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <RefreshCw size={15} />
                          Refresh
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

            </div>
          )}
          {/* SECURITY TAB */}
          {activeTab === 'security' && (
            <div className="settings-form">
              {/* Password Policy Section */}
              <div className="settings-section">
                <div className="settings-section-header">
                  <Lock />
                  <h3>Password Policy</h3>
                </div>
                <div className="settings-section-content">
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">
                        <Lock size={16} />
                        Minimum Password Length
                      </label>
                      <input
                        type="number"
                        className="form-input"
                        value={settings.security?.password_min_length?.value || '8'}
                        onChange={(e) => handleSettingChange('security', 'password_min_length', e.target.value)}
                        min="6"
                        max="20"
                      />
                      <small className="form-help">Minimum characters required</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <Shield size={16} />
                        Require Uppercase Letter
                      </label>
                      <select
                        className="form-select"
                        value={String(settings.security?.password_require_uppercase?.value || 'false')}
                        onChange={(e) => handleSettingChange('security', 'password_require_uppercase', e.target.value)}
                      >
                        <option value="true">Required</option>
                        <option value="false">Optional</option>
                      </select>
                      <small className="form-help">Require at least one uppercase letter</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <Shield size={16} />
                        Require Lowercase Letter
                      </label>
                      <select
                        className="form-select"
                        value={String(settings.security?.password_require_lowercase?.value || 'false')}
                        onChange={(e) => handleSettingChange('security', 'password_require_lowercase', e.target.value)}
                      >
                        <option value="true">Required</option>
                        <option value="false">Optional</option>
                      </select>
                      <small className="form-help">Require at least one lowercase letter</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <Shield size={16} />
                        Require Number
                      </label>
                      <select
                        className="form-select"
                        value={String(settings.security?.password_require_number?.value || 'false')}
                        onChange={(e) => handleSettingChange('security', 'password_require_number', e.target.value)}
                      >
                        <option value="true">Required</option>
                        <option value="false">Optional</option>
                      </select>
                      <small className="form-help">Require at least one number</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <Shield size={16} />
                        Require Special Character
                      </label>
                      <select
                        className="form-select"
                        value={String(settings.security?.password_require_special?.value || 'false')}
                        onChange={(e) => handleSettingChange('security', 'password_require_special', e.target.value)}
                      >
                        <option value="true">Required</option>
                        <option value="false">Optional</option>
                      </select>
                      <small className="form-help">Require at least one special character</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <Clock size={16} />
                        Password Expiry (Days)
                      </label>
                      <input
                        type="number"
                        className="form-input"
                        value={settings.security?.password_expiry_days?.value || '90'}
                        onChange={(e) => handleSettingChange('security', 'password_expiry_days', e.target.value)}
                        min="0"
                      />
                      <small className="form-help">Days before password expires (0 = never)</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <AlertTriangle size={16} />
                        Password Expiry Warning (Days)
                      </label>
                      <input
                        type="number"
                        className="form-input"
                        value={settings.security?.password_expiry_warning_days?.value || '14'}
                        onChange={(e) => handleSettingChange('security', 'password_expiry_warning_days', e.target.value)}
                        min="1"
                        max="60"
                      />
                      <small className="form-help">Show warning banner X days before expiry</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <ListOrdered size={16} />
                        Password History Count
                      </label>
                      <input
                        type="number"
                        className="form-input"
                        value={settings.security?.password_history_count?.value || '5'}
                        onChange={(e) => handleSettingChange('security', 'password_history_count', e.target.value)}
                        min="0"
                        max="10"
                      />
                      <small className="form-help">Prevent reuse of last X passwords</small>
                    </div>
                  </div>
                </div>
              </div>

              {/* Session Management Section */}
              <div className="settings-section">
                <div className="settings-section-header">
                  <User />
                  <h3>Session Management</h3>
                </div>
                <div className="settings-section-content">
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">
                        <Clock size={16} />
                        Session Timeout (Minutes)
                      </label>
                      <input
                        type="number"
                        className="form-input"
                        value={settings.security?.session_timeout_minutes?.value || '480'}
                        onChange={(e) => handleSettingChange('security', 'session_timeout_minutes', e.target.value)}
                        min="30"
                      />
                      <small className="form-help">Inactivity timeout in minutes</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <Power size={16} />
                        Auto Logout on Inactivity
                      </label>
                      <select
                        className="form-select"
                        value={String(settings.security?.session_auto_logout?.value || 'false')}
                        onChange={(e) => handleSettingChange('security', 'session_auto_logout', e.target.value)}
                      >
                        <option value="true">Enabled</option>
                        <option value="false">Disabled</option>
                      </select>
                      <small className="form-help">Automatically logout inactive users</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <User size={16} />
                        Max Concurrent Sessions
                      </label>
                      <input
                        type="number"
                        className="form-input"
                        value={settings.security?.max_concurrent_sessions?.value || '3'}
                        onChange={(e) => handleSettingChange('security', 'max_concurrent_sessions', e.target.value)}
                        min="1"
                        max="10"
                      />
                      <small className="form-help">Maximum sessions per user</small>
                    </div>
                  </div>
                </div>
              </div>

              {/* Account Security Section */}
              <div className="settings-section">
                <div className="settings-section-header">
                  <Shield />
                  <h3>Account Security</h3>
                </div>
                <div className="settings-section-content">
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">
                        <AlertTriangle size={16} />
                        Lockout After Failed Attempts
                      </label>
                      <input
                        type="number"
                        className="form-input"
                        value={settings.security?.lockout_attempts?.value || '5'}
                        onChange={(e) => handleSettingChange('security', 'lockout_attempts', e.target.value)}
                        min="3"
                        max="10"
                      />
                      <small className="form-help">Account locks after X failed login attempts</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <Clock size={16} />
                        Lockout Duration (Minutes)
                      </label>
                      <input
                        type="number"
                        className="form-input"
                        value={settings.security?.lockout_duration_minutes?.value || '30'}
                        onChange={(e) => handleSettingChange('security', 'lockout_duration_minutes', e.target.value)}
                        min="5"
                      />
                      <small className="form-help">Account locked for X minutes</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <Clock size={16} />
                        OTP Expiry (Minutes)
                      </label>
                      <input
                        type="number"
                        className="form-input"
                        value={settings.security?.otp_expiry_minutes?.value || '5'}
                        onChange={(e) => handleSettingChange('security', 'otp_expiry_minutes', e.target.value)}
                        min="1"
                        max="30"
                      />
                      <small className="form-help">OTP verification code expires after X minutes</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <Clock size={16} />
                        Resend OTP Cooldown (Seconds)
                      </label>
                      <input
                        type="number"
                        className="form-input"
                        value={settings.security?.resend_otp_cooldown_seconds?.value || '60'}
                        onChange={(e) => handleSettingChange('security', 'resend_otp_cooldown_seconds', e.target.value)}
                        min="15"
                        max="300"
                      />
                      <small className="form-help">Wait time before OTP can be resent</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <Clock size={16} />
                        Password Reset Token Expiry (Hours)
                      </label>
                      <input
                        type="number"
                        className="form-input"
                        value={settings.security?.password_reset_token_expiry_hours?.value || '1'}
                        onChange={(e) => handleSettingChange('security', 'password_reset_token_expiry_hours', e.target.value)}
                        min="1"
                        max="48"
                      />
                      <small className="form-help">Password reset link expires after X hours</small>
                    </div>

                    <div className="form-group full-width">
                      <label className="form-label">
                        <Shield size={16} />
                        Two-Factor Authentication
                      </label>
                      <div className="settings-toggle-card">
                        <div className="toggle-info">
                          <div className="toggle-title">
                            {String(settings.security?.two_factor_enabled?.value) === 'true' ? 'Enabled' : 'Disabled'}
                          </div>
                          <div className="toggle-desc">
                            Manage your two-factor authentication settings
                          </div>
                        </div>
                        <button
                          type="button"
                          className="toggle-action"
                          onClick={() => navigate('/security')}
                        >
                          <Shield size={16} />
                          Manage 2FA
                        </button>
                      </div>
                      <small className="form-help">Configure two-factor authentication for your account</small>
                    </div>

                    <div className="form-group full-width">
                      <label className="form-label">
                        <Globe size={16} />
                        IP Whitelist
                      </label>
                      <textarea
                        className="form-textarea"
                        value={settings.security?.ip_whitelist?.value || ''}
                        onChange={(e) => handleSettingChange('security', 'ip_whitelist', e.target.value)}
                        placeholder="192.168.1.1, 10.0.0.1"
                        rows="3"
                      />
                      <small className="form-help">Comma-separated IP addresses (leave empty to allow all)</small>
                    </div>
                  </div>
                </div>
              </div>

              {/* Rate Limiting Section */}
              <div className="settings-section">
                <div className="settings-section-header">
                  <Zap />
                  <h3>Rate Limiting</h3>
                  <p>Changes apply immediately after saving</p>
                </div>
                <div className="settings-section-content">
                  <div className="form-grid">
                    {/* Login Rate Limit */}
                    <div className="form-group">
                      <label className="form-label">
                        <Lock size={16} />
                        Login - Max Attempts
                      </label>
                      <input
                        type="number"
                        className="form-input"
                        value={settings.rate_limiting?.rate_limit_login_max?.value || '10'}
                        onChange={(e) => handleSettingChange('rate_limiting', 'rate_limit_login_max', e.target.value)}
                        min="3"
                        max="100"
                      />
                      <small className="form-help">Max login attempts per window</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <Clock size={16} />
                        Login - Window (Minutes)
                      </label>
                      <input
                        type="number"
                        className="form-input"
                        value={settings.rate_limiting?.rate_limit_login_window_minutes?.value || '15'}
                        onChange={(e) => handleSettingChange('rate_limiting', 'rate_limit_login_window_minutes', e.target.value)}
                        min="1"
                        max="1440"
                      />
                      <small className="form-help">Time window in minutes</small>
                    </div>

                    {/* API Rate Limit */}
                    <div className="form-group">
                      <label className="form-label">
                        <Globe size={16} />
                        API - Max Requests
                      </label>
                      <input
                        type="number"
                        className="form-input"
                        value={settings.rate_limiting?.rate_limit_api_max?.value || '100'}
                        onChange={(e) => handleSettingChange('rate_limiting', 'rate_limit_api_max', e.target.value)}
                        min="10"
                        max="10000"
                      />
                      <small className="form-help">Max API requests per window</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <Clock size={16} />
                        API - Window (Minutes)
                      </label>
                      <input
                        type="number"
                        className="form-input"
                        value={settings.rate_limiting?.rate_limit_api_window_minutes?.value || '15'}
                        onChange={(e) => handleSettingChange('rate_limiting', 'rate_limit_api_window_minutes', e.target.value)}
                        min="1"
                        max="1440"
                      />
                      <small className="form-help">Time window in minutes</small>
                    </div>

                    {/* 2FA Rate Limit */}
                    <div className="form-group">
                      <label className="form-label">
                        <Shield size={16} />
                        2FA - Max Attempts
                      </label>
                      <input
                        type="number"
                        className="form-input"
                        value={settings.rate_limiting?.rate_limit_2fa_max?.value || '5'}
                        onChange={(e) => handleSettingChange('rate_limiting', 'rate_limit_2fa_max', e.target.value)}
                        min="3"
                        max="50"
                      />
                      <small className="form-help">Max 2FA verification attempts per window</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <Clock size={16} />
                        2FA - Window (Minutes)
                      </label>
                      <input
                        type="number"
                        className="form-input"
                        value={settings.rate_limiting?.rate_limit_2fa_window_minutes?.value || '15'}
                        onChange={(e) => handleSettingChange('rate_limiting', 'rate_limit_2fa_window_minutes', e.target.value)}
                        min="1"
                        max="1440"
                      />
                      <small className="form-help">Time window in minutes</small>
                    </div>

                    {/* Password Reset Rate Limit */}
                    <div className="form-group">
                      <label className="form-label">
                        <AlertTriangle size={16} />
                        Password Reset - Max Attempts
                      </label>
                      <input
                        type="number"
                        className="form-input"
                        value={settings.rate_limiting?.rate_limit_password_reset_max?.value || '5'}
                        onChange={(e) => handleSettingChange('rate_limiting', 'rate_limit_password_reset_max', e.target.value)}
                        min="1"
                        max="50"
                      />
                      <small className="form-help">Max password reset requests per window</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <Clock size={16} />
                        Password Reset - Window (Minutes)
                      </label>
                      <input
                        type="number"
                        className="form-input"
                        value={settings.rate_limiting?.rate_limit_password_reset_window_minutes?.value || '15'}
                        onChange={(e) => handleSettingChange('rate_limiting', 'rate_limit_password_reset_window_minutes', e.target.value)}
                        min="1"
                        max="1440"
                      />
                      <small className="form-help">Time window in minutes</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* NOTIFICATIONS TAB */}
          {activeTab === 'notifications' && (
            <div className="settings-form">
              <div className="settings-section">
                <div className="settings-section-header">
                  <Bell />
                  <h3>In-App Notifications</h3>
                </div>
                <div className="settings-section-content">
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">
                        <Power size={16} />
                        Enable Notifications
                      </label>
                      <select
                        className="form-select"
                        value={String(settings.notification?.notification_enabled?.value || 'false')}
                        onChange={(e) => handleSettingChange('notification', 'notification_enabled', e.target.value)}
                      >
                        <option value="true">Enabled</option>
                        <option value="false">Disabled</option>
                      </select>
                      <small className="form-help">Enable in-app notifications</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <Bell size={16} />
                        Notification Sound
                      </label>
                      <select
                        className="form-select"
                        value={String(settings.notification?.notification_sound?.value || 'false')}
                        onChange={(e) => handleSettingChange('notification', 'notification_sound', e.target.value)}
                        disabled={String(settings.notification?.notification_enabled?.value) !== 'true'}
                      >
                        <option value="true">Enabled</option>
                        <option value="false">Disabled</option>
                      </select>
                      <small className="form-help">Play sound for notifications</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <Globe size={16} />
                        Desktop Notifications
                      </label>
                      <select
                        className="form-select"
                        value={String(settings.notification?.notification_desktop?.value || 'false')}
                        onChange={(e) => handleSettingChange('notification', 'notification_desktop', e.target.value)}
                        disabled={String(settings.notification?.notification_enabled?.value) !== 'true'}
                      >
                        <option value="true">Enabled</option>
                        <option value="false">Disabled</option>
                      </select>
                      <small className="form-help">Enable desktop/browser notifications</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <Ticket size={16} />
                        Notify on Ticket Created
                      </label>
                      <select
                        className="form-select"
                        value={String(settings.notification?.notification_ticket_created?.value || 'false')}
                        onChange={(e) => handleSettingChange('notification', 'notification_ticket_created', e.target.value)}
                        disabled={String(settings.notification?.notification_enabled?.value) !== 'true'}
                      >
                        <option value="true">Enabled</option>
                        <option value="false">Disabled</option>
                      </select>
                      <small className="form-help">Notify when new ticket is created</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <User size={16} />
                        Notify on Ticket Assigned
                      </label>
                      <select
                        className="form-select"
                        value={String(settings.notification?.notification_ticket_assigned?.value || 'false')}
                        onChange={(e) => handleSettingChange('notification', 'notification_ticket_assigned', e.target.value)}
                        disabled={String(settings.notification?.notification_enabled?.value) !== 'true'}
                      >
                        <option value="true">Enabled</option>
                        <option value="false">Disabled</option>
                      </select>
                      <small className="form-help">Notify when ticket is assigned</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <MessageSquare size={16} />
                        Notify on Comment Added
                      </label>
                      <select
                        className="form-select"
                        value={String(settings.notification?.notification_ticket_commented?.value || 'false')}
                        onChange={(e) => handleSettingChange('notification', 'notification_ticket_commented', e.target.value)}
                        disabled={String(settings.notification?.notification_enabled?.value) !== 'true'}
                      >
                        <option value="true">Enabled</option>
                        <option value="false">Disabled</option>
                      </select>
                      <small className="form-help">Notify when comment is added</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <RefreshCw size={16} />
                        Notify on Status Change
                      </label>
                      <select
                        className="form-select"
                        value={String(settings.notification?.notification_ticket_status_changed?.value || 'false')}
                        onChange={(e) => handleSettingChange('notification', 'notification_ticket_status_changed', e.target.value)}
                        disabled={String(settings.notification?.notification_enabled?.value) !== 'true'}
                      >
                        <option value="true">Enabled</option>
                        <option value="false">Disabled</option>
                      </select>
                      <small className="form-help">Notify when ticket status changes</small>
                    </div>
                  </div>
                </div>
              
              {/* SLA EMAIL NOTIFICATIONS */}
              <div className="settings-section">
                <div className="settings-section-header">
                  <AlertTriangle />
                  <h3>SLA Email Notifications</h3>
                </div>
                <div className="settings-section-content">
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">
                        <Bell size={16} />
                        Send SLA Warning Emails
                      </label>
                      <select
                        className="form-select"
                        value={String(settings.notification?.notify_on_sla_warning?.value || 'false')}
                        onChange={(e) => handleSettingChange('notification', 'notify_on_sla_warning', e.target.value)}
                      >
                        <option value="true">Enabled</option>
                        <option value="false">Disabled</option>
                      </select>
                      <small className="form-help">Email assigned engineer at warning threshold</small>
                    </div>
                    <div className="form-group">
                      <label className="form-label">
                        <AlertTriangle size={16} />
                        Send SLA Breach Emails
                      </label>
                      <select
                        className="form-select"
                        value={String(settings.notification?.notify_on_sla_breach?.value || 'false')}
                        onChange={(e) => handleSettingChange('notification', 'notify_on_sla_breach', e.target.value)}
                      >
                        <option value="true">Enabled</option>
                        <option value="false">Disabled</option>
                      </select>
                      <small className="form-help">Email all stakeholders on breach</small>
                    </div>
                  </div>
                  <div className="settings-info-box info" style={{ marginTop: '16px' }}>
                    <HelpCircle size={18} />
                    <p><strong>Note:</strong> Only applies when SLA Monitoring Job is enabled in SLA tab.</p>
                  </div>
                </div>
              </div>
              </div>
            </div>
          )}

          {/* BOT SETTINGS TAB */}
          {activeTab === 'bot' && (
            <BotSettingsTab />
          )}

          {/* WHATSAPP TAB */}
          {activeTab === 'whatsapp' && (
            <WhatsAppSettingsTab externalSaveTrigger={waSaveTrigger} />
          )}

          {/* LICENSE TAB */}
          {activeTab === 'license' && (
            <LicenseSettingsTab onNotify={setMessage} />
          )}

          {/* BACKUP TAB */}
          {activeTab === 'backup' && (
            <div className="settings-form">
              {/* Backup Statistics */}
              {backupStats && backupStats.total_backups !== undefined && (
                <div className="settings-section">
                  <div className="settings-section-header">
                    <Database />
                    <h3>Backup Overview</h3>
                  </div>
                  <div className="settings-section-content">
                    <div className="backup-stats-grid">
                      <div className="backup-stat-card">
                        <div className="backup-stat-icon">
                          <Database size={24} />
                        </div>
                        <div className="backup-stat-content">
                          <div className="backup-stat-value">{backupStats.total_backups || 0}</div>
                          <div className="backup-stat-label">Total Backups</div>
                        </div>
                      </div>
                      
                      <div className="backup-stat-card success">
                        <div className="backup-stat-icon">
                          <CheckCircle size={24} />
                        </div>
                        <div className="backup-stat-content">
                          <div className="backup-stat-value">{backupStats.completed_backups || 0}</div>
                          <div className="backup-stat-label">Completed</div>
                        </div>
                      </div>
                      
                      <div className="backup-stat-card error">
                        <div className="backup-stat-icon">
                          <AlertCircle size={24} />
                        </div>
                        <div className="backup-stat-content">
                          <div className="backup-stat-value">{backupStats.failed_backups || 0}</div>
                          <div className="backup-stat-label">Failed</div>
                        </div>
                      </div>
                      
                      <div className="backup-stat-card">
                        <div className="backup-stat-icon">
                          <Database size={24} />
                        </div>
                        <div className="backup-stat-content">
                          <div className="backup-stat-value">
                            {backupStats.total_size_mb ? (backupStats.total_size_mb / 1024).toFixed(2) : '0.00'} GB
                          </div>
                          <div className="backup-stat-label">Total Size</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Backup Configuration */}
              <div className="settings-section">
                <div className="settings-section-header">
                  <Database />
                  <h3>Backup Configuration</h3>
                </div>
                <div className="settings-section-content">
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">
                        <Power size={16} />
                        Enable Automatic Backups
                      </label>
                      <select
                        className="form-select"
                        value={String(settings.backup?.backup_enabled?.value || 'false')}
                        onChange={(e) => handleSettingChange('backup', 'backup_enabled', e.target.value)}
                      >
                        <option value="true">Enabled</option>
                        <option value="false">Disabled</option>
                      </select>
                      <small className="form-help">Enable scheduled automatic backups</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <Clock size={16} />
                        Backup Frequency
                      </label>
                      <select
                        className="form-select"
                        value={settings.backup?.backup_frequency?.value || 'daily'}
                        onChange={(e) => handleSettingChange('backup', 'backup_frequency', e.target.value)}
                        disabled={String(settings.backup?.backup_enabled?.value) !== 'true'}
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                      </select>
                      <small className="form-help">How often to create backups</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <Clock size={16} />
                        Backup Time
                      </label>
                      <input
                        type="time"
                        className="form-input"
                        value={settings.backup?.backup_time?.value || '02:00'}
                        onChange={(e) => handleSettingChange('backup', 'backup_time', e.target.value)}
                        disabled={String(settings.backup?.backup_enabled?.value) !== 'true'}
                      />
                      <small className="form-help">Time to run backup (24-hour format)</small>
                    </div>

                    <div className="form-group">
                      <label className="form-label">
                        <Calendar size={16} />
                        Retention Period (Days)
                      </label>
                      <input
                        type="number"
                        className="form-input"
                        value={settings.backup?.backup_retention_days?.value || '30'}
                        onChange={(e) => handleSettingChange('backup', 'backup_retention_days', e.target.value)}
                        min="7"
                        disabled={String(settings.backup?.backup_enabled?.value) !== 'true'}
                      />
                      <small className="form-help">Days to keep backups before deletion</small>
                    </div>
                  </div>

                  {/* Manual Backup Button */}
                  <div className="manual-backup-section">
                    <button
                      className="btn-primary"
                      onClick={handleCreateManualBackup}
                      disabled={creatingBackup}
                    >
                      {creatingBackup ? (
                        <>
                          <Loader size={18} className="spin" />
                          <span>Creating Backup...</span>
                        </>
                      ) : (
                        <>
                          <Database size={18} />
                          <span>Create Backup Now</span>
                        </>
                      )}
                    </button>
                    <small className="form-help">
                      Create an immediate backup of database and files
                    </small>
                  </div>
                </div>
              </div>

              {/* Backup History */}
              <div className="settings-section">
                <div className="settings-section-header settings-section-header--split">
                  <div className="settings-section-header-group">
                    <FileText />
                    <div>
                      <h3>Backup History</h3>
                      <p>Track backup health, storage usage, and recovery readiness.</p>
                    </div>
                  </div>
                  <RefreshButton
                    onClick={() => fetchBackupHistory(backupPage)}
                    loading={loadingBackups}
                    label={loadingBackups ? 'Refreshing…' : 'Refresh List'}
                    title="Refresh backup history"
                  />
                </div>
                <div className="settings-section-content">
                  {loadingBackups ? (
                    <div className="settings-loading">
                      <Loader size={32} className="spin" />
                      <span>Loading backups...</span>
                    </div>
                  ) : !backupHistory || backupHistory.length === 0 ? (
                    <div className="settings-empty-state">
                      <Database size={48} />
                      <p>No backups found</p>
                      <p className="empty-subtitle">
                        Create your first backup using the button above
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="table-container backup-history-table-wrap">
                        <table className="data-table backup-history-table">
                          <thead>
                            <tr>
                              <th>Backup Name</th>
                              <th>Type</th>
                              <th>Status</th>
                              <th>Size</th>
                              <th>Duration</th>
                              <th>Created By</th>
                              <th>Created At</th>
                              <th className="backup-col-actions">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {backupHistory.map((backup) => (
                              <tr key={backup.backup_id}>
                                <td>
                                  <div className="backup-name-cell">
                                    <div className="backup-name-icon">
                                      <Database size={16} />
                                    </div>
                                    <div className="backup-name-content">
                                      <span className="backup-name-title">{backup.backup_name || 'N/A'}</span>
                                      <span className="backup-name-subtitle">
                                        {backup.backup_id ? `ID ${backup.backup_id}` : 'Server snapshot'}
                                      </span>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <span className={`badge ${backup.backup_trigger === 'AUTOMATIC' ? 'badge-info' : 'badge-warning'}`}>
                                    {backup.backup_trigger || 'N/A'}
                                  </span>
                                </td>
                                <td>
                                  <span className={`badge ${
                                    backup.status === 'COMPLETED' ? 'badge-success' :
                                    backup.status === 'FAILED' ? 'badge-danger' :
                                    'badge-warning'
                                  }`}>
                                    {backup.status || 'N/A'}
                                  </span>
                                </td>
                                <td>{backup.total_size_mb ? `${backup.total_size_mb.toFixed(2)} MB` : 'N/A'}</td>
                                <td>{backup.duration_seconds ? `${backup.duration_seconds}s` : 'N/A'}</td>
                                <td>{backup.created_by_name || 'System'}</td>
                                <td>{backup.created_at ? formatDateTime(backup.created_at) : 'N/A'}</td>
                                <td className="backup-col-actions">
                                  <div className="backup-actions">
                                    {backup.status === 'COMPLETED' && (
                                      <button
                                        className="btn-icon backup-action-btn"
                                        onClick={() => handleDownloadBackup(backup.backup_id, backup.backup_name)}
                                        title="Download Backup"
                                        aria-label="Download backup"
                                      >
                                        <Download size={16} />
                                        <span>Download</span>
                                      </button>
                                    )}
                                    {backup.status === 'COMPLETED' && (
                                      <button
                                        className="btn-icon backup-action-btn backup-action-btn--warning"
                                        onClick={() => handlePrepareRestore(backup.backup_id, backup.backup_name)}
                                        disabled={preparingRestore}
                                        title="Restore from this Backup"
                                        aria-label="Restore backup"
                                      >
                                        <RotateCcw size={16} />
                                        <span>Restore</span>
                                      </button>
                                    )}
                                    <button
                                      className="btn-icon btn-icon-danger backup-action-btn"
                                      onClick={() => handleDeleteBackup(backup.backup_id, backup.backup_name)}
                                      title="Delete Backup"
                                      aria-label="Delete backup"
                                    >
                                      <Trash2 size={16} />
                                      <span>Delete</span>
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination */}
                      {backupPagination && backupPagination.totalPages > 1 && (
                        <div className="pagination">
                          <button
                            className="btn-secondary"
                            onClick={() => {
                              setBackupPage(backupPage - 1);
                              fetchBackupHistory(backupPage - 1);
                            }}
                            disabled={backupPage === 1}
                          >
                            Previous
                          </button>
                          <span>
                            Page {backupPage} of {backupPagination.totalPages}
                          </span>
                          <button
                            className="btn-secondary"
                            onClick={() => {
                              setBackupPage(backupPage + 1);
                              fetchBackupHistory(backupPage + 1);
                            }}
                            disabled={backupPage === backupPagination.totalPages}
                          >
                            Next
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Restore from Uploaded File */}
              <div className="settings-section">
                <div className="settings-section-header">
                  <Upload />
                  <h3>Restore from Backup File</h3>
                  <p>Upload a previously downloaded backup ZIP to restore</p>
                </div>
                <div className="settings-section-content">
                  <div className="settings-info-box warning restore-warning-box">
                    <AlertTriangle size={18} />
                    <p>
                      <strong>Warning:</strong> Restoring will <strong>completely replace</strong> the current
                      database and all uploaded files (profiles, attachments, branding).
                      This action cannot be undone. A confirmation code is required.
                    </p>
                  </div>
                  <div className="restore-upload-row">
                    <div className="form-group restore-upload-field">
                      <label className="form-label">
                        <Upload size={16} />
                        Select Backup ZIP File
                      </label>
                      <input
                        ref={restoreFileRef}
                        type="file"
                        accept=".zip"
                        className="form-input"
                        onChange={(e) => setRestoreUploadFile(e.target.files[0] || null)}
                      />
                      <small className="form-help">Select a .zip file downloaded from Backup History</small>
                    </div>
                    <button
                      className="btn-primary btn-primary-warning restore-upload-action"
                      onClick={handlePrepareRestoreFromZip}
                      disabled={!restoreUploadFile || preparingRestore}
                    >
                      {preparingRestore ? (
                        <>
                          <Loader size={18} className="spin" />
                          <span>Processing...</span>
                        </>
                      ) : (
                        <>
                          <RotateCcw size={18} />
                          <span>Upload &amp; Prepare Restore</span>
                        </>
                      )}
                    </button>
                  </div>
                  {restoreError && !restorePhase && (
                    <div className="alert alert-error" style={{ marginTop: '12px' }}>
                      <AlertCircle size={18} />
                      <span>{restoreError}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* RESTORE CONFIRMATION MODAL */}
          {restorePhase && (
            <div style={{
              position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)',
              zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '20px'
            }}>
              <div style={{
                background: '#fff', borderRadius: '12px', padding: '32px',
                maxWidth: '500px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.35)'
              }}>
                {restorePhase === 'done' ? (
                  <>
                    <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                      <CheckCircle size={52} style={{ color: '#22c55e', marginBottom: '12px' }} />
                      <h2 style={{ color: '#1e293b', margin: 0 }}>Restore Complete</h2>
                    </div>
                    <p style={{ color: '#475569', marginBottom: '24px', textAlign: 'center' }}>
                      The system has been restored successfully.<br />
                      <strong>All users must log in again.</strong>
                    </p>
                    <button
                      className="btn-primary"
                      style={{ width: '100%' }}
                      onClick={() => { window.location.href = '/login'; }}
                    >
                      Log Out Now
                    </button>
                  </>
                ) : restorePhase === 'restoring' ? (
                  <div style={{ textAlign: 'center', padding: '16px 0' }}>
                    <Loader size={52} className="spin" style={{ color: 'var(--s-primary)', marginBottom: '16px' }} />
                    <h2 style={{ color: '#1e293b', margin: '0 0 8px' }}>Restoring System…</h2>
                    <p style={{ color: '#64748b' }}>
                      Please wait. Do not close this window.<br />
                      This may take several minutes for large databases.
                    </p>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <RotateCcw size={24} style={{ color: '#f59e0b' }} />
                        <h2 style={{ color: '#1e293b', margin: 0, fontSize: '18px' }}>Confirm System Restore</h2>
                      </div>
                      <button onClick={handleCancelRestore} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                        <X size={22} />
                      </button>
                    </div>

                    <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '8px', padding: '14px', marginBottom: '20px' }}>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <AlertTriangle size={18} style={{ color: '#d97706', flexShrink: 0, marginTop: '1px' }} />
                        <div style={{ fontSize: '13px', color: '#92400e' }}>
                          <strong>This will permanently replace:</strong>
                          <ul style={{ margin: '6px 0 0 0', paddingLeft: '16px' }}>
                            <li>The entire database (tickets, users, settings, history)</li>
                            <li>All uploaded files (attachments, profiles, icons)</li>
                          </ul>
                          <p style={{ margin: '6px 0 0 0' }}>All active sessions will be terminated.</p>
                        </div>
                      </div>
                    </div>

                    {restoreBackupInfo && (
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', marginBottom: '20px', fontSize: '13px', color: '#475569' }}>
                        <div style={{ fontWeight: '600', marginBottom: '6px', color: '#1e293b' }}>Backup being restored:</div>
                        <div><strong>Name:</strong> {restoreBackupInfo.backupName}</div>
                        {restoreBackupInfo.backupDate && (
                          <div><strong>Date:</strong> {new Date(restoreBackupInfo.backupDate).toLocaleString()}</div>
                        )}
                        {restoreBackupInfo.totalSizeMB != null && (
                          <div><strong>Size:</strong> {Number(restoreBackupInfo.totalSizeMB).toFixed(2)} MB</div>
                        )}
                        {restoreBackupInfo.filesCount != null && (
                          <div><strong>Files:</strong> {restoreBackupInfo.filesCount}</div>
                        )}
                      </div>
                    )}

                    <div style={{ marginBottom: '20px' }}>
                      <p style={{ color: '#475569', fontSize: '14px', marginBottom: '10px' }}>
                        Type the confirmation code below to authorise this restore:
                      </p>
                      <div style={{
                        background: '#1e293b', color: '#fbbf24', fontFamily: 'monospace',
                        fontSize: '28px', fontWeight: '700', letterSpacing: '6px',
                        textAlign: 'center', padding: '14px', borderRadius: '8px',
                        marginBottom: '12px', userSelect: 'all'
                      }}>
                        {restoreCode}
                      </div>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Type the code above"
                        value={restoreUserCode}
                        onChange={(e) => setRestoreUserCode(e.target.value.toUpperCase())}
                        maxLength={8}
                        autoFocus
                        style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: '18px', letterSpacing: '4px', textTransform: 'uppercase' }}
                      />
                      {restoreError && (
                        <div className="alert alert-error" style={{ marginTop: '10px' }}>
                          <AlertCircle size={16} />
                          <span>{restoreError}</span>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button className="btn-secondary" style={{ flex: 1 }} onClick={handleCancelRestore}>
                        Cancel
                      </button>
                      <button
                        className="btn-primary"
                        style={{ flex: 1, background: '#dc2626', borderColor: '#dc2626' }}
                        onClick={handleExecuteRestore}
                        disabled={restoreUserCode.length !== 8}
                      >
                        <RotateCcw size={16} />
                        Confirm Restore
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
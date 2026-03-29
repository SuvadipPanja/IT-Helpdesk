// ============================================
// BOT SETTINGS TAB COMPONENT
// Advanced bot configuration, API providers, features
// Date: March 4, 2026
// ============================================

import React, { useState, useEffect, useRef } from 'react';
import {
  Zap, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Eye, 
  EyeOff,
  Plus,
  Trash2,
  Edit2,
  Loader,
  Save,
  X,
  Settings,
  Code2,
  Database,
  Shield,
  TrendingUp,
  Key,
  Globe,
  ToggleRight,
  ToggleLeft,
  Tag,
  Upload,
  MessageSquare,
  Image
} from 'lucide-react';
import api from '../../services/api';
import '../../styles/BotSettings.css';

const BotSettingsTab = () => {
  // State management
  const [apiProviders, setApiProviders] = useState([]);
  const [advancedFeatures, setAdvancedFeatures] = useState([]);
  const [botStats, setBotStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  // API Key management
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [modelInput, setModelInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [savingApiKey, setSavingApiKey] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionTest, setConnectionTest] = useState(null);

  // Auto-Training state
  const [trainingStats, setTrainingStats] = useState(null);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingResult, setTrainingResult] = useState(null);

  // Usage analytics
  const [providerStats, setProviderStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);

  // Ollama state
  const [ollamaDetecting, setOllamaDetecting] = useState(false);
  const [ollamaDetection, setOllamaDetection] = useState(null);
  const [ollamaSetupLoading, setOllamaSetupLoading] = useState(false);

  // Bot branding config
  const [botConfig, setBotConfig] = useState({ bot_name: 'NamoSathi AI', bot_icon_url: '' });
  const [savingBotConfig, setSavingBotConfig] = useState(false);
  const [uploadingBotIcon, setUploadingBotIcon] = useState(false);
  const [botIconPreview, setBotIconPreview] = useState(null);
  const botIconInputRef = useRef(null);

  // Bot behavior config
  const [greetingMessage, setGreetingMessage] = useState('');
  const [botCapabilities, setBotCapabilities] = useState('');
  const [personalityTone, setPersonalityTone] = useState('professional_friendly');
  const [smartFeaturesEnabled, setSmartFeaturesEnabled] = useState('true');
  const [empathyEnabled, setEmpathyEnabled] = useState('true');
  const [confidenceThreshold, setConfidenceThreshold] = useState('0.45');
  const [aiAlwaysEnhance, setAiAlwaysEnhance] = useState('false');
  const [savingBehavior, setSavingBehavior] = useState(false);

  // Fetch data on mount
  useEffect(() => {
    fetchBotData();
    fetchBotConfig();
    fetchTrainingStats();
  }, []);

  const fetchBotConfig = async () => {
    try {
      const [configRes, fullRes] = await Promise.all([
        api.get('/settings/bot-config').catch(() => ({ data: null })),
        api.get('/settings/bot/full-config').catch(() => ({ data: null }))
      ]);
      if (configRes.data?.success) {
        setBotConfig({
          bot_name: configRes.data.data.bot_name || 'IT Support Assistant',
          bot_icon_url: configRes.data.data.bot_icon_url || ''
        });
      }
      if (fullRes?.data?.success) {
        const d = fullRes.data.data;
        setGreetingMessage(d.bot_greeting || '');
        setBotCapabilities(d.bot_default_context || '');
        setPersonalityTone(d.bot_personality_tone || 'professional_friendly');
        setSmartFeaturesEnabled(d.bot_enable_intelligence !== false ? 'true' : 'false');
        setEmpathyEnabled(d.bot_empathy_enabled !== false ? 'true' : 'false');
        setConfidenceThreshold(String(d.bot_confidence_threshold ?? 0.45));
        setAiAlwaysEnhance(d.bot_ai_always_enhance ? 'true' : 'false');
      }
    } catch (error) {
      // silently fail - defaults are set
    }
  };

  const fetchBotData = async () => {
    try {
      setLoading(true);
      const fallback = { data: { success: false } };
      const [providersRes, featuresRes, statsRes] = await Promise.all([
        api.get('/bot/settings/api-providers').catch(() => fallback),
        api.get('/bot/settings/config/features').catch(() => fallback),
        api.get('/bot/settings/config/stats').catch(() => fallback)
      ]);

      if (providersRes.data?.success) {
        setApiProviders(providersRes.data.data.providers || []);
      }
      if (featuresRes.data?.success) {
        setAdvancedFeatures(featuresRes.data.data.features || []);
      }
      if (statsRes.data?.success) {
        setBotStats(statsRes.data.data.stats || {});
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Failed to load bot settings'
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Toggle feature on/off
   */
  const handleToggleFeature = async (featureName, currentState) => {
    try {
      setSaving(true);
      const response = await api.patch(`/bot/settings/config/features/${featureName}/toggle`, {
        enabled: !currentState
      });

      if (response.data?.success) {
        setAdvancedFeatures(prev =>
          (prev || []).map(f =>
            f.feature_name === featureName
              ? { ...f, is_enabled: !currentState }
              : f
          )
        );
        setMessage({
          type: 'success',
          text: `Feature ${!currentState ? 'enabled' : 'disabled'} successfully`
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to toggle feature'
      });
    } finally {
      setSaving(false);
    }
  };

  /**
   * Fetch auto-training statistics
   */
  const fetchTrainingStats = async () => {
    try {
      const response = await api.get('/bot/settings/training/stats');
      if (response.data?.success) {
        setTrainingStats(response.data.data);
      }
    } catch (error) {
      // silently fail - training may not be set up yet
    }
  };

  /**
   * Trigger manual training scan
   */
  const handleTrainNow = async () => {
    try {
      setIsTraining(true);
      setTrainingResult(null);
      const response = await api.post('/bot/settings/training/scan', { limit: 100 });
      if (response.data?.success) {
        setTrainingResult(response.data.data);
        
        // Build a detailed message with diagnostics
        const data = response.data.data;
        let message = `Training complete: ${data.newPatternsLearned || 0} new patterns learned from ${data.ticketsScanned || 0} tickets`;
        
        if (data.diagnostics) {
          message += `\n\nDiagnostics:\n`;
          message += `• Total resolved tickets: ${data.diagnostics.resolved_tickets_total || 0}\n`;
          message += `• With resolution notes: ${data.diagnostics.with_resolution_notes || 0}\n`;
          message += `• With sufficient notes (≥20 chars): ${data.diagnostics.with_sufficient_notes || 0}\n`;
          message += `• Already trained: ${data.diagnostics.already_trained || 0}\n`;
          message += `• Eligible for training: ${data.diagnostics.eligible_tickets_found || 0}`;
        }
        
        setMessage({
          type: data.ticketsScanned > 0 ? 'success' : 'info',
          text: message
        });
        fetchTrainingStats();
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Training scan failed'
      });
    } finally {
      setIsTraining(false);
    }
  };

  /**
   * Open API key modal â€” for local provider, auto-detect Ollama
   */
  const handleSetApiKey = (provider) => {
    setSelectedProvider(provider);
    setApiKeyInput(provider.provider_name === 'local' ? 'ollama-local' : '');
    setModelInput(
      provider.provider_name === 'openai' ? 'gpt-4' :
      provider.provider_name === 'claude' ? 'claude-3-opus-20240229' :
      provider.provider_name === 'google' ? 'gemini-2.0-flash' :
      provider.provider_name === 'grok' ? 'grok-3-mini' :
      provider.provider_name === 'groq' ? 'llama-3.3-70b-versatile' :
      provider.provider_name === 'local' ? 'mistral' : ''
    );
    setConnectionTest(null);
    setShowApiKeyModal(true);
    if (provider.provider_name === 'local') {
      handleDetectOllama();
    }
  };

  /**
   * Save API key
   */
  const handleSaveApiKey = async () => {
    if (!selectedProvider) return;
    if (!apiKeyInput.trim()) {
      setMessage({ type: 'error', text: 'API key is required' });
      return;
    }

    try {
      setSavingApiKey(true);
      const response = await api.post(
        `/bot/settings/api-providers/${selectedProvider.provider_id}/key`,
        {
          api_key: apiKeyInput.trim(),
          model_name: modelInput || null
        }
      );

      if (response.data?.success) {
        setMessage({
          type: 'success',
          text: 'API key saved successfully'
        });
        setShowApiKeyModal(false);
        await fetchBotData();
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to save API key'
      });
    } finally {
      setSavingApiKey(false);
    }
  };

  /**
   * Test API connection
   */
  const handleTestConnection = async () => {
    if (selectedProvider.provider_name !== 'local' && !apiKeyInput.trim()) {
      setMessage({ type: 'error', text: 'Enter API key first' });
      return;
    }

    try {
      setTestingConnection(true);
      const response = await api.post(
        `/bot/settings/api-providers/${selectedProvider.provider_id}/test`
      );

      setConnectionTest({
        success: response.data?.success,
        message: response.data?.message || 'Test completed'
      });
    } catch (error) {
      setConnectionTest({
        success: false,
        message: error.response?.data?.message || 'Connection test failed'
      });
    } finally {
      setTestingConnection(false);
    }
  };

  /**
   * Toggle provider enabled status
   */
  const handleToggleProvider = async (provider) => {
    try {
      setSaving(true);
      const response = await api.patch(`/bot/settings/api-providers/${provider.provider_id}`, {
        is_enabled: !provider.is_enabled
      });

      if (response.data?.success) {
        setApiProviders(prev =>
          (prev || []).map(p =>
            p.provider_id === provider.provider_id
              ? { ...p, is_enabled: !provider.is_enabled }
              : p
          )
        );
        setMessage({
          type: 'success',
          text: `Provider ${!provider.is_enabled ? 'enabled' : 'disabled'}`
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Failed to update provider'
      });
    } finally {
      setSaving(false);
    }
  };

  /**
   * Fetch provider stats
   */
  const handleFetchStats = async (providerId) => {
    try {
      setLoadingStats(true);
      const response = await api.get(`/bot/settings/api-providers/${providerId}/stats`);

      if (response.data?.success) {
        setProviderStats(response.data.data.stats);
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: 'Failed to fetch provider stats'
      });
    } finally {
      setLoadingStats(false);
    }
  };

  /**
   * Detect Ollama installation
   */
  const handleDetectOllama = async () => {
    try {
      setOllamaDetecting(true);
      setOllamaDetection(null);
      const response = await api.get('/bot/settings/ollama/detect');
      if (response.data?.success) {
        setOllamaDetection(response.data.data);
        if (response.data.data.running) {
          setMessage({ type: 'success', text: `Ollama detected! ${response.data.data.models?.length || 0} model(s) available.` });
        } else {
          setMessage({ type: 'error', text: 'Ollama not detected. Make sure it is running: ollama serve' });
        }
      }
    } catch (error) {
      setOllamaDetection({ running: false, models: [] });
      setMessage({ type: 'error', text: 'Failed to detect Ollama' });
    } finally {
      setOllamaDetecting(false);
    }
  };

  /**
   * Quick-setup Ollama with selected model
   */
  const handleOllamaSetup = async (modelName) => {
    try {
      setOllamaSetupLoading(true);
      const response = await api.post('/bot/settings/ollama/setup', {
        model_name: modelName || undefined
      });
      if (response.data?.success) {
        setMessage({ type: 'success', text: response.data.message || 'Ollama configured successfully!' });
        setShowApiKeyModal(false);
        await fetchBotData();
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to setup Ollama' });
    } finally {
      setOllamaSetupLoading(false);
    }
  };

  // ============================================
  // BOT CONFIG HANDLERS (moved from General tab)
  // ============================================
  const handleBotNameSave = async () => {
    const nextName = (botConfig.bot_name || '').trim();
    if (nextName.length < 2) {
      setMessage({ type: 'error', text: 'Bot name must be at least 2 characters' });
      return;
    }

    setSavingBotConfig(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await api.put('/settings/bot-config', { bot_name: nextName });
      if (response.data?.success) {
        setMessage({ type: 'success', text: 'Bot name updated successfully' });
        await fetchBotConfig();
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to update bot name' });
    } finally {
      setSavingBotConfig(false);
    }
  };

  const handleBotIconSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/svg+xml', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) {
      setMessage({ type: 'error', text: 'Only image files are allowed (JPEG, PNG, SVG, WebP, GIF)' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'Bot icon file must be smaller than 5MB' });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => setBotIconPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleBotIconUpload = async () => {
    const file = botIconInputRef.current?.files?.[0];
    if (!file) return;

    setUploadingBotIcon(true);
    setMessage({ type: '', text: '' });
    try {
      const formData = new FormData();
      formData.append('bot_icon', file);

      const response = await api.post('/settings/bot-icon', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data?.success) {
        setMessage({ type: 'success', text: 'Bot icon uploaded successfully' });
        setBotIconPreview(null);
        if (botIconInputRef.current) botIconInputRef.current.value = '';
        await fetchBotConfig();
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to upload bot icon' });
    } finally {
      setUploadingBotIcon(false);
    }
  };

  const handleBotIconReset = async () => {
    setUploadingBotIcon(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await api.delete('/settings/bot-icon');
      if (response.data?.success) {
        setMessage({ type: 'success', text: 'Bot icon reset successfully' });
        setBotIconPreview(null);
        if (botIconInputRef.current) botIconInputRef.current.value = '';
        await fetchBotConfig();
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to reset bot icon' });
    } finally {
      setUploadingBotIcon(false);
    }
  };

  const handleCancelBotIconPreview = () => {
    setBotIconPreview(null);
    if (botIconInputRef.current) botIconInputRef.current.value = '';
  };

  /**
   * Save bot behavior settings (greeting, context, personality, empathy, etc.)
   */
  const handleSaveBehavior = async () => {
    setSavingBehavior(true);
    setMessage({ type: '', text: '' });
    try {
      const promises = [];

      if (greetingMessage.trim().length > 0) {
        promises.push(api.post('/settings/bot/greeting', { greeting: greetingMessage.trim() }));
      }
      if (botCapabilities.trim().length > 0) {
        promises.push(api.post('/settings/bot/context', { context: botCapabilities.trim() }));
      }

      promises.push(api.post('/settings/bot/intelligence', {
        enable_intelligence: smartFeaturesEnabled === 'true',
        personality_tone: personalityTone,
        empathy_enabled: empathyEnabled === 'true',
        confidence_threshold: parseFloat(confidenceThreshold) || 0.45,
        ai_always_enhance: aiAlwaysEnhance === 'true'
      }));

      await Promise.all(promises);
      setMessage({ type: 'success', text: 'Bot behavior settings saved successfully' });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Failed to save behavior settings'
      });
    } finally {
      setSavingBehavior(false);
    }
  };

  if (loading) {
    return (
      <div className="settings-loading">
        <Loader size={32} className="spin" />
        <span>Loading bot settings...</span>
      </div>
    );
  }

  return (
    <div className="bot-settings-container">
      {/* Message Alert */}
      {message.text && (
        <div className={`settings-alert ${message.type}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {message.type === 'success' ? (
              <CheckCircle size={20} />
            ) : (
              <AlertCircle size={20} />
            )}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage({ type: '', text: '' })}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Bot Branding & Configuration Section */}
      <div className="settings-section">
        <div className="settings-section-header">
          <Zap />
          <h3>Bot Identity & Branding</h3>
        </div>
        <div className="settings-section-content">

          {/* Bot Name */}
          <div className="form-grid">
            <div className="form-group full-width">
              <label className="form-label">
                <Tag size={16} />
                Bot Display Name
              </label>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  type="text"
                  className="form-input"
                  value={botConfig.bot_name || ''}
                  onChange={(e) => setBotConfig(prev => ({ ...prev, bot_name: e.target.value }))}
                  placeholder="e.g., Nexus, NamoSathi AI, HelpBot"
                  maxLength={60}
                />
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleBotNameSave}
                  disabled={savingBotConfig}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {savingBotConfig ? <Loader size={16} className="spin" /> : <Save size={16} />}
                  {savingBotConfig ? 'Saving...' : 'Save'}
                </button>
              </div>
              <small className="form-help">
                This name appears in the bot header, greeting messages, and all interactions. Changes apply in real-time.
              </small>
            </div>
          </div>

          {/* Bot Icon Upload */}
          <div className="logo-upload-area" style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid var(--border-color)' }}>
            <h4 style={{ marginBottom: '12px', fontSize: '14px', fontWeight: 600 }}>Bot Icon</h4>
            <div className="logo-current-preview">
              <div className="logo-preview-box">
                {botIconPreview || botConfig.bot_icon_url ? (
                  <img
                    src={botIconPreview || (botConfig.bot_icon_url?.startsWith('/uploads')
                      ? `${import.meta.env.VITE_API_BASE_URL?.replace('/api/v1', '')}${botConfig.bot_icon_url}`
                      : botConfig.bot_icon_url)}
                    alt="Bot Icon"
                  />
                ) : (
                  <div style={{ color: '#6366f1', fontWeight: 700, fontSize: '13px' }}>Default Icon</div>
                )}
              </div>
              <div className="logo-preview-info">
                <h4>Current Bot Icon</h4>
                <p>Displayed in the floating FAB button, chat header, and message avatars.</p>
                <p className="logo-hint">Recommended: 128Ã—128px or larger, transparent PNG or SVG for best quality.</p>
              </div>
            </div>

            <div className="logo-upload-controls">
              <input
                ref={botIconInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif"
                onChange={handleBotIconSelect}
                style={{ display: 'none' }}
                id="bot-icon-file-input"
              />
              <button
                type="button"
                className="btn-logo-upload"
                onClick={() => botIconInputRef.current?.click()}
                disabled={uploadingBotIcon}
              >
                <Upload size={16} />
                Choose Bot Icon
              </button>

              {botIconPreview && (
                <>
                  <button
                    type="button"
                    className="btn-logo-save"
                    onClick={handleBotIconUpload}
                    disabled={uploadingBotIcon}
                  >
                    {uploadingBotIcon ? <Loader size={16} className="spin" /> : <CheckCircle size={16} />}
                    {uploadingBotIcon ? 'Uploading...' : 'Save Bot Icon'}
                  </button>
                  <button
                    type="button"
                    className="btn-logo-cancel"
                    onClick={handleCancelBotIconPreview}
                    disabled={uploadingBotIcon}
                  >
                    <X size={16} />
                    Cancel
                  </button>
                </>
              )}

              {!botIconPreview && botConfig.bot_icon_url && (
                <button
                  type="button"
                  className="btn-logo-reset"
                  onClick={handleBotIconReset}
                  disabled={uploadingBotIcon}
                >
                  <RefreshCw size={16} />
                  Reset to Default Icon
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bot Behavior & Personality */}
      <div className="settings-section">
        <div className="settings-section-header">
          <MessageSquare />
          <h3>Bot Behavior & Personality</h3>
        </div>
        <div className="settings-section-content">
          <div className="form-grid">
            <div className="form-group full-width">
              <label className="form-label">
                <MessageSquare size={16} />
                Custom Greeting Message
              </label>
              <textarea
                className="form-textarea"
                value={greetingMessage}
                onChange={(e) => setGreetingMessage(e.target.value)}
                placeholder="e.g., Namaskar [UserRole]! I'm [BotName] â€” your role-aware IT support companion."
                rows="3"
                maxLength={500}
                style={{ fontFamily: 'monospace', fontSize: '13px' }}
              />
              <small className="form-help">
                Customize the bot's greeting. Use placeholders: [UserRole], [BotName], [UserName]. Leave empty for default.
              </small>
            </div>

            <div className="form-group full-width">
              <label className="form-label">
                <Zap size={16} />
                Bot Capabilities (Default Context)
              </label>
              <textarea
                className="form-textarea"
                value={botCapabilities}
                onChange={(e) => setBotCapabilities(e.target.value)}
                placeholder="e.g., I can work using your login context and fetch your own ticket updates from backend when needed."
                rows="3"
                maxLength={1000}
                style={{ fontFamily: 'monospace', fontSize: '13px' }}
              />
              <small className="form-help">
                Describe what the bot can do. This appears in help messages and initial greeting.
              </small>
            </div>

            <div className="form-group">
              <label className="form-label">
                <MessageSquare size={16} />
                Personality Tone
              </label>
              <select 
                className="form-select"
                value={personalityTone}
                onChange={(e) => setPersonalityTone(e.target.value)}
              >
                <option value="professional_friendly">Professional & Friendly (Default)</option>
                <option value="formal">Formal & Official</option>
                <option value="casual">Casual & Conversational</option>
                <option value="technical">Technical & Precise</option>
              </select>
              <small className="form-help">How the bot communicates with users</small>
            </div>

            <div className="form-group">
              <label className="form-label">
                <Zap size={16} />
                Enable Smart Features
              </label>
              <select 
                className="form-select"
                value={smartFeaturesEnabled}
                onChange={(e) => setSmartFeaturesEnabled(e.target.value)}
              >
                <option value="true">Enabled (Recommended)</option>
                <option value="false">Disabled</option>
              </select>
              <small className="form-help">
                Smart intent matching, role-aware responses, and backend data queries
              </small>
            </div>

            <div className="form-group">
              <label className="form-label">
                <MessageSquare size={16} />
                Empathy Mode
              </label>
              <select 
                className="form-select"
                value={empathyEnabled}
                onChange={(e) => setEmpathyEnabled(e.target.value)}
              >
                <option value="true">Enabled (Recommended)</option>
                <option value="false">Disabled</option>
              </select>
              <small className="form-help">
                When users seem frustrated or urgent, the bot acknowledges their feelings first
              </small>
            </div>

            <div className="form-group">
              <label className="form-label">
                <TrendingUp size={16} />
                AI Enhancement Threshold (0–1)
              </label>
              <input
                type="number"
                className="form-input"
                min="0"
                max="1"
                step="0.05"
                value={confidenceThreshold}
                onChange={(e) => setConfidenceThreshold(e.target.value)}
              />
              <small className="form-help">
                Below this confidence, external AI is used. Lower = more AI usage.
              </small>
            </div>

            <div className="form-group">
              <label className="form-label">
                <Zap size={16} />
                Always Use External AI
              </label>
              <select 
                className="form-select"
                value={aiAlwaysEnhance}
                onChange={(e) => setAiAlwaysEnhance(e.target.value)}
              >
                <option value="false">No (Use when confidence is low)</option>
                <option value="true">Yes (More powerful, higher API cost)</option>
              </select>
              <small className="form-help">
                When enabled, complex queries always use external AI for better answers
              </small>
            </div>
          </div>

          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn-primary"
              onClick={handleSaveBehavior}
              disabled={savingBehavior}
            >
              {savingBehavior ? <Loader size={16} className="spin" /> : <Save size={16} />}
              {savingBehavior ? 'Saving...' : 'Save Behavior Settings'}
            </button>
          </div>

          <div className="settings-info-box success" style={{ marginTop: '16px' }}>
            <CheckCircle size={18} />
            <p>
              <strong>Smart Features Include:</strong> Real-time ticket queries, role-aware suggestions, credential-based workflows, 
              team statistics (for admins), password policy validation, and contextual help.
            </p>
          </div>
        </div>
      </div>

      {/* Bot Statistics Overview - REAL DATA */}
      <div className="settings-section">
        <div className="settings-section-header">
          <TrendingUp />
          <h3>Bot Statistics & Usage</h3>
          <a 
            href="/analytics" 
            style={{ marginLeft: 'auto', fontSize: '13px', color: '#3b82f6', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
            onClick={(e) => { e.preventDefault(); window.location.href = '/analytics'; }}
          >
            View All Sessions â†’
          </a>
        </div>
        <div className="settings-section-content">
          {botStats && (
            <>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: '#10b981' }}>
                    <Zap size={24} />
                  </div>
                  <div className="stat-content">
                    <div className="stat-value">{botStats.active_sessions || 0}</div>
                    <div className="stat-label">Active Sessions</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon" style={{ background: '#6366f1' }}>
                    <Database size={24} />
                  </div>
                  <div className="stat-content">
                    <div className="stat-value">{botStats.total_messages || 0}</div>
                    <div className="stat-label">Total Messages</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon" style={{ background: '#8b5cf6' }}>
                    <TrendingUp size={24} />
                  </div>
                  <div className="stat-content">
                    <div className="stat-value">{botStats.total_sessions || 0}</div>
                    <div className="stat-label">Total Sessions</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon" style={{ background: '#f59e0b' }}>
                    <Code2 size={24} />
                  </div>
                  <div className="stat-content">
                    <div className="stat-value">{botStats.active_custom_intents || 0}</div>
                    <div className="stat-label">Custom Intents</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon" style={{ background: '#3b82f6' }}>
                    <Globe size={24} />
                  </div>
                  <div className="stat-content">
                    <div className="stat-value">{botStats.api_calls_30d || 0}</div>
                    <div className="stat-label">API Calls (30d)</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon" style={{ background: '#ef4444' }}>
                    <TrendingUp size={24} />
                  </div>
                  <div className="stat-content">
                    <div className="stat-value">${(botStats.api_cost_30d || 0).toFixed(2)}</div>
                    <div className="stat-label">API Cost (30d)</div>
                  </div>
                </div>
              </div>

              {/* Additional Stats Row */}
              <div className="stats-grid" style={{ marginTop: '12px' }}>
                <div className="stat-card">
                  <div className="stat-icon" style={{ background: '#14b8a6' }}>
                    <Database size={24} />
                  </div>
                  <div className="stat-content">
                    <div className="stat-value">{botStats.sessions_today || 0}</div>
                    <div className="stat-label">Sessions Today</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon" style={{ background: '#a855f7' }}>
                    <Zap size={24} />
                  </div>
                  <div className="stat-content">
                    <div className="stat-value">{botStats.messages_today || 0}</div>
                    <div className="stat-label">Messages Today</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon" style={{ background: '#06b6d4' }}>
                    <Shield size={24} />
                  </div>
                  <div className="stat-content">
                    <div className="stat-value">{botStats.unique_users || 0}</div>
                    <div className="stat-label">Unique Users</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon" style={{ background: '#f97316' }}>
                    <Zap size={24} />
                  </div>
                  <div className="stat-content">
                    <div className="stat-value">{botStats.ai_enhanced_responses || 0}</div>
                    <div className="stat-label">AI Enhanced</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon" style={{ background: '#84cc16' }}>
                    <Zap size={24} />
                  </div>
                  <div className="stat-content">
                    <div className="stat-value">{(botStats.tokens_used_30d || 0).toLocaleString()}</div>
                    <div className="stat-label">Tokens Used (30d)</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon" style={{ background: '#ec4899' }}>
                    <TrendingUp size={24} />
                  </div>
                  <div className="stat-content">
                    <div className="stat-value">{botStats.total_intents_matched || 0}</div>
                    <div className="stat-label">Intents Matched</div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Advanced Features */}
      <div className="settings-section">
        <div className="settings-section-header">
          <Zap />
          <h3>Advanced Features</h3>
        </div>
        <div className="settings-section-content">
          <div className="features-list">
            {advancedFeatures.map(feature => (
              <div key={feature.feature_id} className="feature-item">
                <div className="feature-info">
                  <h4>{feature.feature_label}</h4>
                  <p>{feature.description}</p>
                </div>
                <button
                  className={`feature-toggle ${feature.is_enabled ? 'enabled' : 'disabled'}`}
                  onClick={() => handleToggleFeature(feature.feature_name, feature.is_enabled)}
                  disabled={saving}
                >
                  {feature.is_enabled ? (
                    <ToggleRight size={20} />
                  ) : (
                    <ToggleLeft size={20} />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Auto-Training Panel */}
      {advancedFeatures.some(f => f.feature_name === 'auto_training') && (
        <div className="settings-section">
          <div className="settings-section-header">
            <Database />
            <h3>Auto-Training</h3>
          </div>
          <div className="settings-section-content">
            <p className="section-description">
              Scans resolved tickets and learns from resolution patterns to improve bot responses.
              The bot uses this learned knowledge to answer similar questions in the future.
            </p>

            <div className="training-actions">
              <button
                className="btn-primary"
                onClick={handleTrainNow}
                disabled={isTraining}
              >
                {isTraining ? <Loader size={16} className="spin" /> : <RefreshCw size={16} />}
                {isTraining ? 'Training...' : 'Train Now'}
              </button>

              {trainingResult && (
                <span className="training-result-text">
                  {trainingResult.newPatternsLearned} new patterns from {trainingResult.ticketsScanned} tickets ({trainingResult.durationMs}ms)
                </span>
              )}
            </div>

            {trainingStats?.stats && (
              <div className="training-stats-grid">
                <div className="stat-card">
                  <div className="stat-value">{trainingStats.stats.total_patterns || 0}</div>
                  <div className="stat-label">Total Patterns</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{trainingStats.stats.active_patterns || 0}</div>
                  <div className="stat-label">Active Patterns</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{trainingStats.stats.total_usage || 0}</div>
                  <div className="stat-label">Times Used</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{trainingStats.stats.categories_covered || 0}</div>
                  <div className="stat-label">Categories</div>
                </div>
              </div>
            )}

            {trainingStats?.categories?.length > 0 && (
              <div className="training-categories">
                <h4>Patterns by Category</h4>
                <div className="training-categories-list">
                  {trainingStats.categories.map(cat => (
                    <span key={cat.category} className="training-category-badge">
                      {cat.category}: {cat.count}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* API Providers Configuration */}
      <div className="settings-section">
        <div className="settings-section-header">
          <Globe />
          <h3>External API Providers</h3>
        </div>
        <div className="settings-section-content">
          <p className="section-description">
            Configure external AI APIs (OpenAI, Claude, Google Gemini, xAI Grok, or local LLM) to enhance bot capabilities.
            The bot will use these APIs to provide expert-level assistance on complex technical issues, coding help, and advanced problem-solving.
          </p>

          <div className="providers-grid">
            {apiProviders.map(provider => (
              <div key={provider.provider_id} className={`provider-card ${provider.is_enabled ? 'enabled' : 'disabled'}`}>
                <div className="provider-header">
                  <div>
                    <h4>{provider.provider_label}</h4>
                    <p className="provider-name">{provider.provider_name}</p>
                  </div>
                  <button
                    className={`provider-toggle ${provider.is_enabled ? 'on' : 'off'}`}
                    onClick={() => handleToggleProvider(provider)}
                    title={provider.is_enabled ? 'Disable provider' : 'Enable provider'}
                    disabled={saving || !provider.is_configured}
                  >
                    {provider.is_enabled ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                  </button>
                </div>

                <div className="provider-details">
                  <div className="detail-row">
                    <span className="label">Status:</span>
                    <span className={`badge ${provider.is_configured ? 'configured' : 'unconfigured'}`}>
                      {provider.is_configured ? 'Configured' : 'Not Configured'}
                    </span>
                  </div>

                  <div className="detail-row">
                    <span className="label">Rate Limit:</span>
                    <span>{provider.rate_limit_rpm} req/min, {provider.rate_limit_tpm} tokens/min</span>
                  </div>

                  <div className="detail-row">
                    <span className="label">Timeout:</span>
                    <span>{provider.timeout_seconds}s</span>
                  </div>

                  {provider.capabilities && provider.capabilities.length > 0 && (
                    <div className="detail-row">
                      <span className="label">Capabilities:</span>
                      <div className="capabilities-list">
                        {provider.capabilities.map((cap, idx) => (
                          <span key={idx} className="capability-badge">{cap}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="provider-actions">
                  <button
                    className="btn-secondary"
                    onClick={() => handleSetApiKey(provider)}
                    title={provider.provider_name === 'local' ? 'Configure Ollama' : 'Configure API key'}
                  >
                    <Key size={16} />
                    {provider.provider_name === 'local' 
                      ? (provider.is_configured ? 'Configure' : 'Setup Ollama')
                      : (provider.is_configured ? 'Update Key' : 'Set Key')}
                  </button>
                  {provider.provider_name === 'local' && (
                    <button
                      className="btn-secondary"
                      onClick={handleDetectOllama}
                      disabled={ollamaDetecting}
                      title="Auto-detect Ollama"
                    >
                      {ollamaDetecting ? <Loader size={16} className="spin" /> : <RefreshCw size={16} />}
                      Detect
                    </button>
                  )}
                  <button
                    className="btn-secondary"
                    onClick={() => handleFetchStats(provider.provider_id)}
                    disabled={loadingStats || !provider.is_configured}
                  >
                    <TrendingUp size={16} />
                    Stats
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Provider Stats */}
          {providerStats && (
            <div className="provider-stats-panel">
              <h4>Usage Statistics (Last 30 Days)</h4>
              <div className="stats-rows">
                <div className="stat-row">
                  <span>API Calls:</span>
                  <strong>{providerStats.total_calls || 0}</strong>
                </div>
                <div className="stat-row">
                  <span>Total Tokens:</span>
                  <strong>{(providerStats.total_tokens_used || 0).toLocaleString()}</strong>
                </div>
                <div className="stat-row">
                  <span>Estimated Cost:</span>
                  <strong>${(providerStats.total_cost || 0).toFixed(4)}</strong>
                </div>
                <div className="stat-row">
                  <span>Avg Response Time:</span>
                  <strong>{(providerStats.avg_latency_ms || 0).toFixed(0)}ms</strong>
                </div>
                <div className="stat-row">
                  <span>Errors:</span>
                  <strong>{providerStats.error_count || 0}</strong>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* API Key Modal */}
      {showApiKeyModal && selectedProvider && (
        <div className="modal-overlay" onClick={() => setShowApiKeyModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {selectedProvider.provider_name === 'local' 
                  ? 'Configure Ollama / Local LLM'
                  : `Configure API Key - ${selectedProvider.provider_label}`}
              </h3>
              <button
                className="modal-close"
                onClick={() => setShowApiKeyModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {/* Ollama-specific: Auto-detect section */}
              {selectedProvider.provider_name === 'local' && (
                <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--bg-secondary, #f8fafc)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <strong style={{ fontSize: '13px' }}>🤖 Ollama Auto-Detection</strong>
                    <button
                      className="btn-secondary"
                      onClick={handleDetectOllama}
                      disabled={ollamaDetecting}
                      style={{ padding: '4px 10px', fontSize: '12px' }}
                    >
                      {ollamaDetecting ? <><Loader size={12} className="spin" /> Scanning...</> : <><RefreshCw size={12} /> Detect</>}
                    </button>
                  </div>

                  {ollamaDetection && (
                    <div>
                      {ollamaDetection.running ? (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontSize: '12px', marginBottom: '8px' }}>
                            <CheckCircle size={14} /> Ollama is running
                          </div>
                          {ollamaDetection.models && ollamaDetection.models.length > 0 ? (
                            <>
                              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 8px' }}>
                                Available models ({ollamaDetection.models.length}):
                              </p>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {ollamaDetection.models.map((m, i) => (
                                  <button
                                    key={i}
                                    onClick={() => handleOllamaSetup(m.name)}
                                    disabled={ollamaSetupLoading}
                                    style={{
                                      padding: '4px 10px', fontSize: '11px', borderRadius: '6px',
                                      border: '1px solid var(--primary-color)', background: 'var(--primary-bg, rgba(99,102,241,0.06))',
                                      color: 'var(--primary-color)', cursor: 'pointer', fontWeight: 500
                                    }}
                                    title={`Quick setup with ${m.name} (${m.size})`}
                                  >
                                    {ollamaSetupLoading ? <Loader size={10} className="spin" /> : null}
                                    {m.name} ({m.size})
                                  </button>
                                ))}
                              </div>
                              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                                Click a model to auto-configure. No API key needed for Ollama.
                              </p>
                            </>
                          ) : (
                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                              No models installed. Run: <code style={{ background: 'var(--bg-tertiary)', padding: '2px 4px', borderRadius: '3px' }}>ollama pull mistral</code>
                            </p>
                          )}
                        </>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444', fontSize: '12px' }}>
                          <AlertCircle size={14} /> Ollama not running. Start it with: <code>ollama serve</code>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* API Key input â€” optional for local */}
              {selectedProvider.provider_name !== 'local' && (
                <div className="form-group">
                  <label className="form-label">API Key</label>
                  <div className="password-input-wrapper">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      className="form-input"
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      placeholder={
                        selectedProvider.provider_name === 'openai' ? 'sk-...' :
                        selectedProvider.provider_name === 'claude' ? 'sk-ant-...' :
                        selectedProvider.provider_name === 'google' ? 'AIza...' :
                        selectedProvider.provider_name === 'grok' ? 'xai-...' :
                        'Enter your API key'
                      }
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <small className="form-help">
                    Your API key is encrypted with AES-256-CBC and stored securely.
                  </small>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Model Name</label>
                {selectedProvider.provider_name === 'local' && ollamaDetection?.models?.length > 0 ? (
                  <select
                    className="form-select"
                    value={modelInput}
                    onChange={(e) => setModelInput(e.target.value)}
                  >
                    {ollamaDetection.models.map((m, i) => (
                      <option key={i} value={m.name}>{m.name} ({m.size})</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    className="form-input"
                    value={modelInput}
                    onChange={(e) => setModelInput(e.target.value)}
                    placeholder={
                      selectedProvider.provider_name === 'openai' ? 'gpt-4, gpt-3.5-turbo' :
                      selectedProvider.provider_name === 'claude' ? 'claude-3-opus-20240229, claude-3-sonnet' :
                      selectedProvider.provider_name === 'google' ? 'gemini-2.0-flash, gemini-1.5-pro' :
                      selectedProvider.provider_name === 'grok' ? 'grok-3-mini, grok-3' :
                      'mistral, llama3, codellama'
                    }
                  />
                )}
                <small className="form-help">
                  {selectedProvider.provider_name === 'local'
                    ? 'Select from detected models above, or type the model name manually'
                    : 'Specify which model to use for API calls'}
                </small>
              </div>

              {connectionTest && (
                <div className={`alert ${connectionTest.success ? 'success' : 'error'}`}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {connectionTest.success ? (
                      <CheckCircle size={18} />
                    ) : (
                      <AlertCircle size={18} />
                    )}
                    <span>{connectionTest.message}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => handleTestConnection()}
                disabled={testingConnection || (selectedProvider.provider_name !== 'local' && !apiKeyInput.trim())}
              >
                {testingConnection ? (
                  <>
                    <Loader size={16} className="spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <RefreshCw size={16} />
                    Test Connection
                  </>
                )}
              </button>
              {selectedProvider.provider_name !== 'local' && (
                <button
                  className="btn-primary"
                  onClick={handleSaveApiKey}
                  disabled={savingApiKey || !apiKeyInput.trim()}
                >
                  {savingApiKey ? (
                    <>
                      <Loader size={16} className="spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Save API Key
                    </>
                  )}
                </button>
              )}
              <button
                className="btn-secondary"
                onClick={() => setShowApiKeyModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BotSettingsTab;

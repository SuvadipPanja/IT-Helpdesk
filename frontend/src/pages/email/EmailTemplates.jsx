// ============================================
// EMAIL TEMPLATES PAGE
// Main page for email template management
// FILE: frontend/src/pages/email/EmailTemplates.jsx
// ============================================

import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Search, 
  Eye, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Mail,
  Filter
} from 'lucide-react';
import emailTemplatesService from '../../services/emailTemplates.service';
import TemplateEditor, { TemplateEditorWithRef } from '../../components/email/TemplateEditor';
import TemplateVariables from '../../components/email/TemplateVariables';
import TemplatePreview from '../../components/email/TemplatePreview';
import '../../styles/EmailTemplates.css';

const EmailTemplates = () => {
  // State
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // Filters
  const [filters, setFilters] = useState({
    category: '',
    is_active: '',
    search: ''
  });
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' or 'edit'
  const [editingTemplate, setEditingTemplate] = useState(null);
  
  // Preview state
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    template_key: '',
    template_name: '',
    subject_template: '',
    body_template: '',
    category: 'ticket',
    is_active: true,
    description: ''
  });
  
  const [saving, setSaving] = useState(false);
  const editorRef = useRef(null);

  // Categories
  const categories = [
    { value: 'ticket', label: 'Ticket Events' },
    { value: 'user', label: 'User Events' },
    { value: 'system', label: 'System Notifications' },
    { value: 'general', label: 'General' }
  ];

  // ============================================
  // FETCH TEMPLATES
  // ============================================
  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const params = {
        ...filters
      };
      
      // Remove empty filters
      Object.keys(params).forEach(key => {
        if (params[key] === '') delete params[key];
      });

      const response = await emailTemplatesService.getAllTemplates(params);
      
      if (response.success) {
        setTemplates(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error);
      showMessage('error', 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // INITIAL LOAD
  // ============================================
  useEffect(() => {
    fetchTemplates();
  }, [filters]);

  // ============================================
  // SHOW MESSAGE
  // ============================================
  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  // ============================================
  // HANDLE FILTER CHANGE
  // ============================================
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  // ============================================
  // OPEN CREATE MODAL
  // ============================================
  const handleCreateNew = () => {
    setModalMode('create');
    setEditingTemplate(null);
    setFormData({
      template_key: '',
      template_name: '',
      subject_template: '',
      body_template: '',
      category: 'ticket',
      is_active: true,
      description: ''
    });
    setIsModalOpen(true);
  };

  // ============================================
  // OPEN EDIT MODAL
  // ============================================
  const handleEdit = async (template) => {
    setModalMode('edit');
    setEditingTemplate(template);
    setFormData({
      template_key: template.template_key,
      template_name: template.template_name,
      subject_template: template.subject_template,
      body_template: template.body_template,
      category: template.category,
      is_active: template.is_active,
      description: template.description || ''
    });
    setIsModalOpen(true);
  };

  // ============================================
  // HANDLE FORM CHANGE
  // ============================================
  const handleFormChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // ============================================
  // SAVE TEMPLATE (CREATE OR UPDATE)
  // ============================================
  const handleSave = async () => {
    try {
      // Validation
      if (!formData.template_key || !formData.template_name || 
          !formData.subject_template || !formData.body_template) {
        showMessage('error', 'Please fill in all required fields');
        return;
      }

      setSaving(true);

      let response;
      if (modalMode === 'create') {
        response = await emailTemplatesService.createTemplate(formData);
        showMessage('success', 'Template created successfully');
      } else {
        response = await emailTemplatesService.updateTemplate(
          editingTemplate.template_id, 
          formData
        );
        showMessage('success', 'Template updated successfully');
      }

      if (response.success) {
        setIsModalOpen(false);
        fetchTemplates();
      }
    } catch (error) {
      console.error('Save template failed:', error);
      showMessage('error', error.response?.data?.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  // ============================================
  // DELETE TEMPLATE
  // ============================================
  const handleDelete = async (template) => {
    if (!window.confirm(`Are you sure you want to delete template "${template.template_name}"?`)) {
      return;
    }

    try {
      const response = await emailTemplatesService.deleteTemplate(template.template_id);
      
      if (response.success) {
        showMessage('success', 'Template deleted successfully');
        fetchTemplates();
      }
    } catch (error) {
      console.error('Delete template failed:', error);
      showMessage('error', 'Failed to delete template');
    }
  };

  // ============================================
  // PREVIEW TEMPLATE
  // ============================================
  const handlePreview = async (template) => {
    try {
      const response = await emailTemplatesService.previewTemplate(template.template_id);
      
      if (response.success) {
        setPreviewData(response.data);
        setIsPreviewOpen(true);
      }
    } catch (error) {
      console.error('Preview template failed:', error);
      showMessage('error', 'Failed to preview template');
    }
  };

  // ============================================
  // TOGGLE TEMPLATE STATUS
  // ============================================
  const handleToggleStatus = async (template) => {
    try {
      const response = await emailTemplatesService.toggleTemplateStatus(template.template_id);
      
      if (response.success) {
        showMessage('success', `Template ${response.data.is_active ? 'activated' : 'deactivated'}`);
        fetchTemplates();
      }
    } catch (error) {
      console.error('Toggle status failed:', error);
      showMessage('error', 'Failed to toggle template status');
    }
  };

  // ============================================
  // INSERT VARIABLE INTO EDITOR
  // ============================================
  const handleInsertVariable = (variable) => {
    if (editorRef.current) {
      editorRef.current.insertVariable(variable);
    }
  };
  
  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="email-templates-page">
      <div className="page-container">
        {/* HEADER */}
        <div className="page-header">
          <div>
            <h1 className="page-title">
              <Mail style={{ width: '2rem', height: '2rem', marginRight: '0.75rem' }} />
              Email Templates Management
            </h1>
            <p className="page-description">
              Create and manage email notification templates
            </p>
          </div>
          <button 
            className="btn-create"
            onClick={handleCreateNew}
          >
            <Plus style={{ width: '1.25rem', height: '1.25rem' }} />
            Create Template
          </button>
        </div>

        {/* MESSAGE ALERT */}
        {message.text && (
          <div className={`alert alert-${message.type}`}>
            {message.type === 'success' ? (
              <CheckCircle style={{ width: '1.25rem', height: '1.25rem' }} />
            ) : (
              <AlertCircle style={{ width: '1.25rem', height: '1.25rem' }} />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* FILTERS */}
        <div className="filters-section">
          <div className="filters-row">
            {/* Search */}
            <div className="search-wrapper">
              <Search className="search-icon" />
              <input
                type="text"
                placeholder="Search templates..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="search-input"
              />
            </div>

            {/* Category Filter */}
            <select
              value={filters.category}
              onChange={(e) => handleFilterChange('category', e.target.value)}
              className="filter-select"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={filters.is_active}
              onChange={(e) => handleFilterChange('is_active', e.target.value)}
              className="filter-select"
            >
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>

            {/* Refresh Button */}
            <button
              onClick={fetchTemplates}
              disabled={loading}
              className="btn-refresh"
            >
              <RefreshCw 
                style={{ 
                  width: '1.25rem', 
                  height: '1.25rem',
                  animation: loading ? 'spin 1s linear infinite' : 'none'
                }} 
              />
              Refresh
            </button>
          </div>
        </div>

        {/* TEMPLATES TABLE */}
        {loading ? (
          <div className="loading-state">
            <RefreshCw style={{ width: '3rem', height: '3rem', animation: 'spin 1s linear infinite' }} />
            <p>Loading templates...</p>
          </div>
        ) : templates.length === 0 ? (
          <div className="empty-state">
            <Mail style={{ width: '4rem', height: '4rem', color: '#cbd5e1' }} />
            <h3>No Templates Found</h3>
            <p>Create your first email template to get started</p>
            <button className="btn-create" onClick={handleCreateNew}>
              <Plus style={{ width: '1.25rem', height: '1.25rem' }} />
              Create Template
            </button>
          </div>
        ) : (
          <div className="templates-table">
            <table>
              <thead>
                <tr>
                  <th>Template Key</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Last Modified</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <tr key={template.template_id}>
                    <td>
                      <code className="template-key">{template.template_key}</code>
                    </td>
                    <td>
                      <div className="template-name-cell">
                        <div className="template-name">{template.template_name}</div>
                        <div className="template-subject">{template.subject_template}</div>
                      </div>
                    </td>
                    <td>
                      <span className="category-badge">
                        {categories.find(c => c.value === template.category)?.label || template.category}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => handleToggleStatus(template)}
                        className={`status-toggle ${template.is_active ? 'active' : 'inactive'}`}
                      >
                        {template.is_active ? '✓ Active' : '✗ Inactive'}
                      </button>
                    </td>
                    <td className="date-cell">
                      {new Date(template.updated_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div className="actions-cell">
                        <button
                          onClick={() => handlePreview(template)}
                          className="action-btn preview"
                          title="Preview"
                        >
                          <Eye style={{ width: '1.125rem', height: '1.125rem' }} />
                        </button>
                        <button
                          onClick={() => handleEdit(template)}
                          className="action-btn edit"
                          title="Edit"
                        >
                          <Edit style={{ width: '1.125rem', height: '1.125rem' }} />
                        </button>
                        <button
                          onClick={() => handleDelete(template)}
                          className="action-btn delete"
                          title="Delete"
                        >
                          <Trash2 style={{ width: '1.125rem', height: '1.125rem' }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* CREATE/EDIT MODAL */}
        {isModalOpen && (
          <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              {/* Modal Header */}
              <div className="modal-header">
                <h2>{modalMode === 'create' ? 'Create New Template' : 'Edit Template'}</h2>
                <button onClick={() => setIsModalOpen(false)} className="modal-close">
                  <X style={{ width: '1.5rem', height: '1.5rem' }} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="modal-body">
                <div className="form-grid">
                  {/* Template Key */}
                  <div className="form-group">
                    <label className="form-label">
                      Template Key <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.template_key}
                      onChange={(e) => handleFormChange('template_key', e.target.value.toUpperCase())}
                      placeholder="TICKET_CREATED"
                      disabled={modalMode === 'edit'}
                    />
                    <p className="form-hint">Unique identifier (uppercase, underscores only)</p>
                  </div>

                  {/* Template Name */}
                  <div className="form-group">
                    <label className="form-label">
                      Template Name <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.template_name}
                      onChange={(e) => handleFormChange('template_name', e.target.value)}
                      placeholder="New Ticket Created"
                    />
                  </div>

                  {/* Category */}
                  <div className="form-group">
                    <label className="form-label">
                      Category <span className="required">*</span>
                    </label>
                    <select
                      className="form-select"
                      value={formData.category}
                      onChange={(e) => handleFormChange('category', e.target.value)}
                    >
                      {categories.map(cat => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Status */}
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <div className="checkbox-wrapper">
                      <input
                        type="checkbox"
                        id="is_active"
                        checked={formData.is_active}
                        onChange={(e) => handleFormChange('is_active', e.target.checked)}
                      />
                      <label htmlFor="is_active">Active</label>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-textarea"
                    value={formData.description}
                    onChange={(e) => handleFormChange('description', e.target.value)}
                    placeholder="Brief description of when this template is used..."
                    rows="2"
                  />
                </div>

                {/* Subject Template */}
                <div className="form-group">
                  <label className="form-label">
                    Subject Template <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.subject_template}
                    onChange={(e) => handleFormChange('subject_template', e.target.value)}
                    placeholder="New Ticket: {{ticket_number}}"
                  />
                  <p className="form-hint">Use {'{{variable}}'} for dynamic content</p>
                </div>

                {/* Body Template */}
                <div className="form-group">
                  <label className="form-label">
                    Email Body Template <span className="required">*</span>
                  </label>
                  <TemplateEditorWithRef
                    ref={editorRef}
                    value={formData.body_template}
                    onChange={(value) => handleFormChange('body_template', value)}
                    placeholder="Enter email body with HTML formatting..."
                  />
                </div>

                {/* Template Variables Helper */}
                <TemplateVariables onInsert={handleInsertVariable} />
              </div>

              {/* Modal Footer */}
              <div className="modal-footer">
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="btn-cancel"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="btn-save"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <RefreshCw style={{ width: '1.125rem', height: '1.125rem', animation: 'spin 1s linear infinite' }} />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save style={{ width: '1.125rem', height: '1.125rem' }} />
                      Save Template
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PREVIEW MODAL */}
        <TemplatePreview
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          template={previewData}
          previewData={previewData}
        />
      </div>
    </div>
  );
};

export default EmailTemplates;
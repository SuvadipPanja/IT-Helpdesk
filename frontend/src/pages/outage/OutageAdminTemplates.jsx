/**
 * ============================================
 * OUTAGE ADMIN TEMPLATES PAGE
 * Admin CRUD for outage notification templates.
 * ============================================
 */

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';
import {
  AlertTriangle, Plus, Edit, Trash2, Save, X,
  RefreshCw, ChevronDown, ChevronUp, GripVertical,
  CheckCircle, Wrench, CheckCircle2, Eye, EyeOff,
  Settings, Users, Shield
} from 'lucide-react';
import api from '../../services/api';
import '../../styles/OutageAdmin.css';

const FIELD_TYPES = ['text', 'textarea', 'datetime', 'select', 'boolean', 'ip_list', 'duration'];

const ICON_MAP = {
  AlertTriangle, Wrench, CheckCircle, CheckCircle2,
};

const emptyField = {
  field_key: '', field_label: '', field_type: 'text',
  is_required: true, placeholder: '', default_value: '', field_options: '',
};

const emptyTemplate = {
  template_code: '', template_name: '',
  header_color: '#dc2626', icon_name: 'AlertTriangle', sort_order: 0,
  fields: [],
};

export default function OutageAdminTemplates() {
  const toast = useToast();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...emptyTemplate });
  const [submitting, setSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [accessList, setAccessList] = useState([]);
  const [accessLoading, setAccessLoading] = useState(false);
  const [showAccess, setShowAccess] = useState(false);
  const [accessSearch, setAccessSearch] = useState('');

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/outage/templates');
      setTemplates(res.data?.data || []);
    } catch {
      toast?.error?.('Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const openCreate = () => {
    setForm({ ...emptyTemplate, fields: [{ ...emptyField }] });
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = async (tpl) => {
    try {
      const res = await api.get(`/outage/templates/${tpl.template_id}`);
      const data = res.data?.data;
      setForm({
        template_code: data.template_code,
        template_name: data.template_name,
        header_color: data.header_color,
        icon_name: data.icon_name,
        sort_order: data.sort_order,
        fields: (data.fields || []).map(f => ({
          field_key: f.field_key,
          field_label: f.field_label,
          field_type: f.field_type,
          is_required: !!f.is_required,
          placeholder: f.placeholder || '',
          default_value: f.default_value || '',
          field_options: f.field_options || '',
          sort_order: f.sort_order,
        })),
      });
      setEditingId(data.template_id);
      setShowForm(true);
    } catch {
      toast?.error?.('Failed to load template');
    }
  };

  const closeForm = () => { setShowForm(false); setEditingId(null); setForm({ ...emptyTemplate }); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.template_name.trim()) {
      toast?.error?.('Template name is required');
      return;
    }
    if (!editingId && !form.template_code.trim()) {
      toast?.error?.('Template code is required');
      return;
    }
    setSubmitting(true);
    try {
      if (editingId) {
        await api.put(`/outage/templates/${editingId}`, form);
        toast?.success?.('Template updated');
      } else {
        await api.post('/outage/templates', form);
        toast?.success?.('Template created');
      }
      closeForm();
      fetchTemplates();
    } catch (err) {
      toast?.error?.(err.response?.data?.message || 'Save failed');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (tpl) => {
    try {
      await api.put(`/outage/templates/${tpl.template_id}`, { is_active: !tpl.is_active });
      toast?.success?.(tpl.is_active ? 'Template disabled' : 'Template enabled');
      fetchTemplates();
    } catch {
      toast?.error?.('Failed to update template');
    }
  };

  // Fields management
  const addField = () => {
    setForm(prev => ({
      ...prev,
      fields: [...prev.fields, { ...emptyField, sort_order: prev.fields.length + 1 }],
    }));
  };

  const removeField = (idx) => {
    setForm(prev => ({
      ...prev,
      fields: prev.fields.filter((_, i) => i !== idx),
    }));
  };

  const updateField = (idx, key, value) => {
    setForm(prev => ({
      ...prev,
      fields: prev.fields.map((f, i) => i === idx ? { ...f, [key]: value } : f),
    }));
  };

  // Access control
  const fetchAccess = useCallback(async (search = '') => {
    setAccessLoading(true);
    try {
      const res = await api.get('/outage/access', { params: { pageSize: 100, search: search || undefined } });
      setAccessList(res.data?.data?.users || []);
    } catch {
      toast?.error?.('Failed to load access list');
    } finally {
      setAccessLoading(false);
    }
  }, []);

  const openAccessPanel = () => {
    setShowAccess(true);
    fetchAccess();
  };

  const updateAccess = async (userId, field, value) => {
    const user = accessList.find(u => u.user_id === userId);
    if (!user) return;
    try {
      await api.put(`/outage/access/${userId}`, {
        can_view_wall: field === 'can_view_wall' ? value : !!user.can_view_wall,
        can_publish: field === 'can_publish' ? value : !!user.can_publish,
        can_manage: field === 'can_manage' ? value : !!user.can_manage,
      });
      setAccessList(prev => prev.map(u =>
        u.user_id === userId ? { ...u, [field]: value } : u
      ));
      toast?.success?.('Access updated');
    } catch {
      toast?.error?.('Failed to update access');
    }
  };

  // Styles
  const btnDanger = { padding: '8px 16px', background: 'var(--nx-danger)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: '500' };

  return (
    <div className="outage-admin-page">
      {/* Header */}
      <div className="outage-admin-header">
        <h1 className="outage-admin-title">
          <Settings size={24} />
          Outage Templates
        </h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="outage-btn-secondary" onClick={openAccessPanel}>
            <Shield size={16} /> Access Control
          </button>
          <button className="outage-btn-primary" onClick={openCreate}>
            <Plus size={16} /> New Template
          </button>
        </div>
      </div>

      {/* Template List */}
      {loading ? (
        <div className="outage-loading">
          <RefreshCw size={24} className="outage-spinning" />
          <p>Loading templates...</p>
        </div>
      ) : templates.length === 0 ? (
        <div className="outage-admin-card outage-empty">
          <AlertTriangle size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
          <p>No templates found. Create your first template to get started.</p>
        </div>
      ) : (
        templates.map(tpl => (
          <div key={tpl.template_id} className="outage-admin-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '10px',
                  background: tpl.header_color + '22', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  {(() => {
                    const Icon = ICON_MAP[tpl.icon_name] || AlertTriangle;
                    return <Icon size={20} style={{ color: tpl.header_color }} />;
                  })()}
                </div>
                <div>
                  <div style={{ fontWeight: '600', color: 'var(--nx-text)', fontSize: '15px' }}>
                    {tpl.template_name}
                    {tpl.is_system ? (
                      <span style={{ fontSize: '11px', background: '#1e40af', color: '#93c5fd', padding: '2px 6px', borderRadius: '4px', marginLeft: '8px' }}>System</span>
                    ) : null}
                  </div>
                  <div className="outage-text-muted" style={{ fontSize: '12px' }}>
                    Code: {tpl.template_code} · {tpl.field_count} fields
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <button className="outage-btn-small" onClick={() => toggleActive(tpl)} title={tpl.is_active ? 'Disable' : 'Enable'}>
                  {tpl.is_active ? <Eye size={14} /> : <EyeOff size={14} />}
                  {tpl.is_active ? 'Active' : 'Inactive'}
                </button>
                <button className="outage-btn-small" onClick={() => setExpandedId(expandedId === tpl.template_id ? null : tpl.template_id)}>
                  {expandedId === tpl.template_id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  Details
                </button>
                <button className="outage-btn-small" onClick={() => openEdit(tpl)}>
                  <Edit size={14} /> Edit
                </button>
              </div>
            </div>
            {expandedId === tpl.template_id && (
              <TemplateDetailPanel templateId={tpl.template_id} />
            )}
          </div>
        ))
      )}

      {/* Template Form Modal */}
      {showForm && (
        <div className="outage-modal-overlay" onClick={(e) => e.target === e.currentTarget && closeForm()}>
          <div className="outage-modal-content">
            <div className="outage-modal-header">
              <h2 className="outage-modal-title">
                {editingId ? 'Edit Template' : 'Create Template'}
              </h2>
              <button onClick={closeForm} className="outage-modal-close">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="outage-grid-2col">
                {!editingId && (
                  <div>
                    <label className="outage-label">Template Code *</label>
                    <input className="outage-input" value={form.template_code}
                      onChange={e => setForm(p => ({ ...p, template_code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') }))}
                      placeholder="e.g. NETWORK_OUTAGE" required />
                  </div>
                )}
                <div style={editingId ? { gridColumn: '1 / -1' } : {}}>
                  <label className="outage-label">Template Name *</label>
                  <input className="outage-input" value={form.template_name}
                    onChange={e => setForm(p => ({ ...p, template_name: e.target.value }))}
                    placeholder="Display name" required />
                </div>
                <div>
                  <label className="outage-label">Header Color</label>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input type="color" value={form.header_color}
                      onChange={e => setForm(p => ({ ...p, header_color: e.target.value }))}
                      style={{ width: '40px', height: '36px', border: 'none', background: 'none', cursor: 'pointer' }} />
                    <input className="outage-input" value={form.header_color}
                      onChange={e => setForm(p => ({ ...p, header_color: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <label className="outage-label">Sort Order</label>
                  <input type="number" className="outage-input" value={form.sort_order}
                    onChange={e => setForm(p => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))} />
                </div>
              </div>

              {/* Fields */}
              <div style={{ marginTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', color: 'var(--nx-text-secondary)' }}>Template Fields</h3>
                  <button type="button" className="outage-btn-small" onClick={addField}>
                    <Plus size={14} /> Add Field
                  </button>
                </div>
                {form.fields.map((field, idx) => (
                  <div key={idx} className="outage-admin-card outage-admin-card-dark" style={{ display: 'flex', gap: '8px', alignItems: 'start' }}>
                    <GripVertical size={16} style={{ color: 'var(--nx-border-strong)', marginTop: '10px', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: '8px', marginBottom: '8px' }}>
                        <div>
                          <label className="outage-label">Key</label>
                          <input className="outage-input" value={field.field_key} placeholder="field_key"
                            onChange={e => updateField(idx, 'field_key', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} />
                        </div>
                        <div>
                          <label className="outage-label">Label</label>
                          <input className="outage-input" value={field.field_label} placeholder="Display Label"
                            onChange={e => updateField(idx, 'field_label', e.target.value)} />
                        </div>
                        <div>
                          <label className="outage-label">Type</label>
                          <select className="outage-select" value={field.field_type}
                            onChange={e => updateField(idx, 'field_type', e.target.value)}>
                            {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                      </div>
                      {field.field_type === 'select' && (
                        <div style={{ marginBottom: '8px' }}>
                          <label className="outage-label">Options (comma-separated)</label>
                          <input className="outage-input" value={field.field_options}
                            placeholder='e.g. Option A,Option B,Option C'
                            onChange={e => updateField(idx, 'field_options', e.target.value)} />
                        </div>
                      )}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px', alignItems: 'end' }}>
                        <div>
                          <label className="outage-label">Placeholder</label>
                          <input className="outage-input" value={field.placeholder}
                            onChange={e => updateField(idx, 'placeholder', e.target.value)} />
                        </div>
                        <div>
                          <label className="outage-label">Default Value</label>
                          <input className="outage-input" value={field.default_value}
                            onChange={e => updateField(idx, 'default_value', e.target.value)} />
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--nx-muted)', fontSize: '12px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={field.is_required}
                              onChange={e => updateField(idx, 'is_required', e.target.checked)} />
                            Required
                          </label>
                          <button type="button" onClick={() => removeField(idx)}
                            style={{ background: 'none', border: 'none', color: 'var(--nx-danger)', cursor: 'pointer', padding: '4px' }}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
                <button type="button" className="outage-btn-secondary" onClick={closeForm}>Cancel</button>
                <button type="submit" className="outage-btn-primary" disabled={submitting}>
                  <Save size={16} /> {submitting ? 'Saving...' : editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Access Control Panel */}
      {showAccess && (
        <div className="outage-modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowAccess(false)}>
          <div className="outage-modal-content outage-modal-wide">
            <div className="outage-modal-header">
              <h2 className="outage-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Shield size={20} /> Access Control
              </h2>
              <button onClick={() => setShowAccess(false)} className="outage-modal-close">
                <X size={20} />
              </button>
            </div>
            <input className="outage-input" style={{ marginBottom: '16px' }} placeholder="Search users..."
              value={accessSearch} onChange={e => { setAccessSearch(e.target.value); fetchAccess(e.target.value); }} />
            {accessLoading ? (
              <div className="outage-loading">Loading...</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="outage-table">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--nx-border)' }}>
                      <th>User</th>
                      <th>Role</th>
                      <th style={{ textAlign: 'center' }}>View Wall</th>
                      <th style={{ textAlign: 'center' }}>Publish</th>
                      <th style={{ textAlign: 'center' }}>Manage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accessList.map(u => (
                      <tr key={u.user_id}>
                        <td>
                          <div style={{ color: 'var(--nx-text-secondary)' }}>{u.name}</div>
                          <div className="outage-text-muted" style={{ fontSize: '12px' }}>{u.email}</div>
                        </td>
                        <td>{u.role_name}</td>
                        <td style={{ textAlign: 'center' }}>
                          <input type="checkbox" checked={!!u.can_view_wall}
                            onChange={e => updateAccess(u.user_id, 'can_view_wall', e.target.checked)} />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input type="checkbox" checked={!!u.can_publish}
                            onChange={e => updateAccess(u.user_id, 'can_publish', e.target.checked)} />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input type="checkbox" checked={!!u.can_manage}
                            onChange={e => updateAccess(u.user_id, 'can_manage', e.target.checked)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Expandable detail panel for a template */
function TemplateDetailPanel({ templateId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/outage/templates/${templateId}`)
      .then(res => setData(res.data?.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [templateId]);

  if (loading) return <div style={{ padding: '12px', color: '#94a3b8' }}>Loading...</div>;
  if (!data) return <div style={{ padding: '12px', color: '#ef4444' }}>Failed to load</div>;

  return (
    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--nx-border)' }}>
      <table className="outage-table">
        <thead>
          <tr>
            <th style={{ textTransform: 'uppercase', fontSize: '11px' }}>Key</th>
            <th style={{ textTransform: 'uppercase', fontSize: '11px' }}>Label</th>
            <th style={{ textTransform: 'uppercase', fontSize: '11px' }}>Type</th>
            <th style={{ textTransform: 'uppercase', fontSize: '11px' }}>Options</th>
            <th style={{ textAlign: 'center', textTransform: 'uppercase', fontSize: '11px' }}>Required</th>
          </tr>
        </thead>
        <tbody>
          {(data.fields || []).map(f => (
            <tr key={f.field_id || f.field_key}>
              <td style={{ fontFamily: 'monospace' }}>{f.field_key}</td>
              <td style={{ color: 'var(--nx-text-secondary)' }}>{f.field_label}</td>
              <td><span style={{ padding: '2px 6px', borderRadius: '4px', fontSize: '11px', background: 'var(--nx-bg)', color: 'var(--nx-info)' }}>{f.field_type}</span></td>
              <td style={{ fontSize: '12px', color: 'var(--nx-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.field_options || '—'}</td>
              <td style={{ textAlign: 'center' }}>
                {f.is_required ? <CheckCircle size={14} style={{ color: 'var(--nx-success)' }} /> : <span style={{ color: 'var(--nx-border-strong)' }}>—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * ============================================
 * OUTAGE PUBLISH PAGE
 * Central team / admin: create & publish outage notifications.
 * Fill template fields, set audience, publish, resolve, cancel.
 * ============================================
 */

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../context/ToastContext';
import {
  Send, Plus, Edit, Eye, X, RefreshCw,
  AlertTriangle, CheckCircle, XCircle, Clock,
  Users, Building2, MapPin, UsersRound, User,
  ChevronDown, ChevronUp, Filter, Search
} from 'lucide-react';
import api from '../../services/api';
import '../../styles/OutageAdmin.css';

const SEVERITY_OPTIONS = [
  { value: 'critical', label: 'Critical', color: '#ef4444' },
  { value: 'high', label: 'High', color: '#f97316' },
  { value: 'medium', label: 'Medium', color: '#f59e0b' },
  { value: 'low', label: 'Low', color: '#3b82f6' },
  { value: 'info', label: 'Info', color: '#22c55e' },
];

const AUDIENCE_OPTIONS = [
  { value: 'all', label: 'All Users', icon: Users },
  { value: 'department', label: 'Department', icon: Building2 },
  { value: 'location', label: 'Location', icon: MapPin },
  { value: 'team', label: 'Team', icon: UsersRound },
  { value: 'role', label: 'Role', icon: User },
];

const STATUS_COLORS = {
  draft: '#6366f1',
  active: '#ef4444',
  resolved: '#22c55e',
  cancelled: '#6b7280',
};

const STATUS_ICONS = { draft: Clock, active: AlertTriangle, resolved: CheckCircle, cancelled: XCircle };

export default function OutagePublish() {
  const toast = useToast();
  const [notifications, setNotifications] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [viewingId, setViewingId] = useState(null);
  const [viewData, setViewData] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [stats, setStats] = useState(null);

  // Create form state
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [form, setForm] = useState({ title: '', severity: 'high', audience_type: 'all', audience_data: [] });
  const [fieldValues, setFieldValues] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Audience selection
  const [audienceOptions, setAudienceOptions] = useState([]);
  const [audiencePreview, setAudiencePreview] = useState(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const [nRes, sRes] = await Promise.all([
        api.get('/outage/notifications', { params: { status: filterStatus || undefined, pageSize: 50 } }),
        api.get('/outage/stats'),
      ]);
      setNotifications(nRes.data?.data?.notifications || []);
      setStats(sRes.data?.data || null);
    } catch {
      toast?.error?.('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await api.get('/outage/templates', { params: { active_only: 'true' } });
      setTemplates(res.data?.data || []);
    } catch {}
  }, []);

  useEffect(() => { fetchNotifications(); fetchTemplates(); }, [fetchNotifications, fetchTemplates]);

  // Load audience options when audience type changes
  useEffect(() => {
    if (form.audience_type === 'all') {
      setAudienceOptions([]);
      return;
    }
    const loadOptions = async () => {
      try {
        const res = await api.get('/outage/filter-options');
        const data = res.data?.data || {};
        switch (form.audience_type) {
          case 'department':
            setAudienceOptions((data.departments || []).map(d => ({ id: d.department_id, name: d.department_name })));
            break;
          case 'location':
            setAudienceOptions((data.locations || []).map(l => ({ id: l.location_id, name: l.location_name })));
            break;
          case 'team':
            setAudienceOptions((data.teams || []).map(t => ({ id: t.team_id, name: t.team_name })));
            break;
          default:
            setAudienceOptions([]);
        }
      } catch {}
    };
    loadOptions();
  }, [form.audience_type]);

  const toggleAudienceItem = (id) => {
    setForm(prev => {
      const current = new Set(prev.audience_data);
      if (current.has(id)) current.delete(id);
      else current.add(id);
      return { ...prev, audience_data: [...current] };
    });
  };

  const previewAudienceCount = async () => {
    try {
      const res = await api.post('/outage/audience-preview', {
        audience_type: form.audience_type,
        audience_data: form.audience_data,
      });
      setAudiencePreview(res.data?.data || null);
    } catch {}
  };

  const selectTemplate = async (tpl) => {
    try {
      const res = await api.get(`/outage/templates/${tpl.template_id}`);
      const full = res.data?.data;
      setSelectedTemplate(full);
      setForm(prev => ({ ...prev, title: full.template_name }));
      // Init field values with defaults
      const fv = {};
      (full.fields || []).forEach(f => {
        fv[f.field_id] = f.default_value || '';
      });
      setFieldValues(fv);
    } catch {
      toast?.error?.('Failed to load template');
    }
  };

  const handleCreate = async (publishImmediately) => {
    if (!selectedTemplate) {
      toast?.error?.('Select a template first');
      return;
    }
    if (!form.title.trim()) {
      toast?.error?.('Title is required');
      return;
    }
    // Validate required fields
    const missing = (selectedTemplate.fields || []).filter(f => f.is_required && !fieldValues[f.field_id]?.trim());
    if (missing.length > 0) {
      toast?.error?.(`Required: ${missing.map(f => f.field_label).join(', ')}`);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        template_id: selectedTemplate.template_id,
        title: form.title,
        severity: form.severity,
        audience_type: form.audience_type,
        audience_data: form.audience_type === 'all' ? [] : form.audience_data,
        field_values: Object.entries(fieldValues).map(([field_id, field_value]) => ({
          field_id: parseInt(field_id),
          field_value,
        })),
      };

      const createRes = await api.post('/outage/notifications', payload);
      const newId = createRes.data?.data?.notification_id;

      if (publishImmediately && newId) {
        await api.post(`/outage/notifications/${newId}/publish`);
        toast?.success?.('Notification published!');
      } else {
        toast?.success?.('Draft saved');
      }

      setShowCreate(false);
      setSelectedTemplate(null);
      setFieldValues({});
      setForm({ title: '', severity: 'high', audience_type: 'all', audience_data: [] });
      fetchNotifications();
    } catch (err) {
      toast?.error?.(err.response?.data?.message || 'Failed to create notification');
    } finally {
      setSubmitting(false);
    }
  };

  const publishDraft = async (id) => {
    try {
      await api.post(`/outage/notifications/${id}/publish`);
      toast?.success?.('Notification published');
      fetchNotifications();
    } catch (err) {
      toast?.error?.(err.response?.data?.message || 'Publish failed');
    }
  };

  const resolveActive = async (id) => {
    try {
      await api.post(`/outage/notifications/${id}/resolve`);
      toast?.success?.('Notification resolved');
      fetchNotifications();
    } catch (err) {
      toast?.error?.(err.response?.data?.message || 'Resolve failed');
    }
  };

  const cancelNotification = async (id) => {
    try {
      await api.post(`/outage/notifications/${id}/cancel`);
      toast?.success?.('Notification cancelled');
      fetchNotifications();
    } catch (err) {
      toast?.error?.(err.response?.data?.message || 'Cancel failed');
    }
  };

  const viewDetails = async (id) => {
    try {
      const res = await api.get(`/outage/notifications/${id}`);
      setViewData(res.data?.data);
      setViewingId(id);
    } catch {
      toast?.error?.('Failed to load details');
    }
  };

  // Styles — minimal remaining inline styles for dynamic status colors
  const statBox = 'outage-stat-box';

  return (
    <div className="outage-admin-page">
      {/* Stats Bar */}
      {stats && (
        <div className="outage-grid-4col" style={{ marginBottom: '24px' }}>
          {[
            { label: 'Active', value: stats.active_count, color: 'var(--nx-danger)' },
            { label: 'Drafts', value: stats.draft_count, color: 'var(--nx-primary)' },
            { label: 'Resolved', value: stats.resolved_count, color: 'var(--nx-success)' },
            { label: 'Templates', value: stats.template_count, color: 'var(--nx-info)' },
          ].map(s => (
            <div key={s.label} className={statBox}>
              <div className="outage-stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="outage-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Header */}
      <div className="outage-admin-header">
        <h1 className="outage-admin-title">
          <Send size={24} />
          Outage Publisher
        </h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select className="outage-select" style={{ width: '150px' }} value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}>
            <option value="">All Status</option>
            <option value="draft">Drafts</option>
            <option value="active">Active</option>
            <option value="resolved">Resolved</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button className="outage-btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> New Notification
          </button>
        </div>
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="outage-loading">
          <RefreshCw size={24} className="outage-spinning" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="outage-admin-card outage-empty">
          <AlertTriangle size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
          <p>No outage notifications found</p>
        </div>
      ) : (
        notifications.map(n => {
          const StatusIcon = STATUS_ICONS[n.status] || Clock;
          return (
            <div key={n.notification_id} className="outage-admin-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                  <div style={{
                    width: '8px', height: '40px', borderRadius: '4px',
                    background: n.header_color || STATUS_COLORS[n.status],
                  }} />
                  <div>
                    <div style={{ fontWeight: '600', color: 'var(--nx-text)', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {n.title}
                      <span style={{
                        fontSize: '11px', padding: '2px 8px', borderRadius: '4px',
                        background: STATUS_COLORS[n.status] + '22', color: STATUS_COLORS[n.status],
                        display: 'flex', alignItems: 'center', gap: '4px',
                      }}>
                        <StatusIcon size={12} /> {n.status}
                      </span>
                      <span style={{
                        fontSize: '11px', padding: '2px 6px', borderRadius: '4px',
                        background: 'var(--nx-info-light)', color: '#60a5fa',
                      }}>
                        {n.severity}
                      </span>
                    </div>
                    <div className="outage-text-muted" style={{ fontSize: '12px', marginTop: '2px' }}>
                      {n.template_name} · by {n.created_by_name} · {n.audience_type === 'all' ? 'All users' : n.audience_type}
                      {n.published_at && ` · Published: ${new Date(n.published_at).toLocaleString()}`}
                      {' · '}{n.view_count || 0} views
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button className="outage-btn-small" onClick={() => viewDetails(n.notification_id)}>
                    <Eye size={14} /> View
                  </button>
                  {n.status === 'draft' && (
                    <button className="outage-btn-small" style={{ borderColor: 'var(--nx-success)', color: 'var(--nx-success)' }} onClick={() => publishDraft(n.notification_id)}>
                      <Send size={14} /> Publish
                    </button>
                  )}
                  {n.status === 'active' && (
                    <button className="outage-btn-small" style={{ borderColor: 'var(--nx-success)', color: 'var(--nx-success)' }} onClick={() => resolveActive(n.notification_id)}>
                      <CheckCircle size={14} /> Resolve
                    </button>
                  )}
                  {(n.status === 'draft' || n.status === 'active') && (
                    <button className="outage-btn-small" style={{ borderColor: 'var(--nx-danger)', color: 'var(--nx-danger)' }} onClick={() => cancelNotification(n.notification_id)}>
                      <XCircle size={14} /> Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}

      {/* Create Notification Modal */}
      {showCreate && (
        <div className="outage-modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="outage-modal-content" style={{ maxWidth: '750px' }}>
            <div className="outage-modal-header">
              <h2 className="outage-modal-title">
                {selectedTemplate ? `New: ${selectedTemplate.template_name}` : 'Select Template'}
              </h2>
              <button onClick={() => { setShowCreate(false); setSelectedTemplate(null); }}
                className="outage-modal-close">
                <X size={20} />
              </button>
            </div>

            {!selectedTemplate ? (
              /* Template Picker */
              <div className="outage-grid-2col">
                {templates.map(tpl => (
                  <div key={tpl.template_id} onClick={() => selectTemplate(tpl)}
                    className="outage-admin-card"
                    style={{ cursor: 'pointer', transition: 'border-color 0.2s', borderColor: 'var(--nx-border-strong)' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = tpl.header_color}
                    onMouseLeave={e => e.currentTarget.style.borderColor = ''}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '8px',
                        background: tpl.header_color + '22', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <AlertTriangle size={18} style={{ color: tpl.header_color }} />
                      </div>
                      <div>
                        <div style={{ fontWeight: '600', color: 'var(--nx-text)', fontSize: '14px' }}>{tpl.template_name}</div>
                        <div className="outage-text-muted" style={{ fontSize: '12px' }}>{tpl.field_count} fields</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Notification Form */
              <div>
                {/* Header with color indicator */}
                <div style={{
                  padding: '12px 16px', borderRadius: '8px', marginBottom: '16px',
                  background: selectedTemplate.header_color + '18',
                  borderLeft: `4px solid ${selectedTemplate.header_color}`,
                }}>
                  <div style={{ fontSize: '14px', color: 'var(--nx-text-secondary)', fontWeight: '500' }}>
                    {selectedTemplate.template_name}
                  </div>
                </div>

                {/* Title and Severity */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <label className="outage-label">Notification Title *</label>
                    <input className="outage-input" value={form.title}
                      onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                      placeholder="e.g. Email Service Outage" />
                  </div>
                  <div>
                    <label className="outage-label">Severity</label>
                    <select className="outage-select" value={form.severity}
                      onChange={e => setForm(p => ({ ...p, severity: e.target.value }))}>
                      {SEVERITY_OPTIONS.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Template Fields */}
                <div style={{ marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--nx-text-secondary)', marginBottom: '12px' }}>
                    Notification Details
                  </h3>
                  {(selectedTemplate.fields || []).map(f => {
                    const val = fieldValues[f.field_id] || '';
                    const setVal = (v) => setFieldValues(p => ({ ...p, [f.field_id]: v }));
                    let fieldOptions = [];
                    if (f.field_options) {
                      try { fieldOptions = JSON.parse(f.field_options); } catch {}
                    }

                    return (
                      <div key={f.field_id} style={{ marginBottom: '12px' }}>
                        <label className="outage-label">
                          {f.field_label} {f.is_required ? '*' : ''}
                        </label>

                        {f.field_type === 'textarea' ? (
                          <textarea className="outage-textarea" value={val}
                            placeholder={f.placeholder || ''}
                            onChange={e => setVal(e.target.value)} />

                        ) : f.field_type === 'datetime' ? (
                          <input type="datetime-local" className="outage-input" value={val}
                            onChange={e => setVal(e.target.value)} />

                        ) : f.field_type === 'boolean' ? (
                          <div className="outage-boolean-toggle">
                            <button type="button"
                              className={`outage-bool-btn ${val === 'Yes' ? 'outage-bool-btn-yes' : ''}`}
                              onClick={() => setVal('Yes')}>
                              Yes
                            </button>
                            <button type="button"
                              className={`outage-bool-btn ${val === 'No' ? 'outage-bool-btn-no' : ''}`}
                              onClick={() => setVal('No')}>
                              No
                            </button>
                          </div>

                        ) : f.field_type === 'ip_list' ? (
                          <textarea className="outage-textarea outage-ip-textarea" value={val}
                            placeholder={f.placeholder || 'Enter one IP/subnet per line\ne.g. 192.168.1.1\n10.0.0.0/24'}
                            onChange={e => setVal(e.target.value)}
                            rows={4} />

                        ) : f.field_type === 'select' && fieldOptions.length > 0 ? (
                          <select className="outage-select" value={val}
                            onChange={e => setVal(e.target.value)}>
                            <option value="">— Select —</option>
                            {fieldOptions.map((opt, i) => (
                              <option key={i} value={opt}>{opt}</option>
                            ))}
                          </select>

                        ) : f.field_type === 'duration' ? (
                          <input className="outage-input" value={val}
                            placeholder={f.placeholder || 'e.g. 70 Minutes'}
                            onChange={e => setVal(e.target.value)} />

                        ) : (
                          <input className="outage-input" value={val}
                            placeholder={f.placeholder || ''}
                            onChange={e => setVal(e.target.value)} />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Audience Targeting */}
                <div style={{ marginBottom: '16px', padding: '16px', background: 'var(--nx-bg)', borderRadius: '10px', border: '1px solid var(--nx-surface)' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--nx-text-secondary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Users size={16} /> Audience Targeting
                  </h3>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                    {AUDIENCE_OPTIONS.map(opt => {
                      const Icon = opt.icon;
                      const isSelected = form.audience_type === opt.value;
                      return (
                        <button key={opt.value} type="button"
                          onClick={() => setForm(p => ({ ...p, audience_type: opt.value, audience_data: [] }))}
                          style={{
                            padding: '6px 12px', borderRadius: '8px', cursor: 'pointer',
                            border: isSelected ? '2px solid var(--nx-info)' : '1px solid var(--nx-border-strong)',
                            background: isSelected ? 'rgba(59,130,246,0.15)' : 'transparent',
                            color: isSelected ? '#93c5fd' : 'var(--nx-muted)',
                            display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px',
                          }}>
                          <Icon size={14} /> {opt.label}
                        </button>
                      );
                    })}
                  </div>

                  {form.audience_type !== 'all' && audienceOptions.length > 0 && (
                    <div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                        {audienceOptions.map(opt => (
                          <label key={opt.id} style={{
                            display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer',
                            padding: '4px 8px', borderRadius: '6px', fontSize: '13px',
                            background: form.audience_data.includes(opt.id) ? 'rgba(59,130,246,0.15)' : 'var(--nx-surface)',
                            color: form.audience_data.includes(opt.id) ? '#93c5fd' : 'var(--nx-muted)',
                            border: `1px solid ${form.audience_data.includes(opt.id) ? 'var(--nx-info)' : 'var(--nx-border)'}`,
                          }}>
                            <input type="checkbox" checked={form.audience_data.includes(opt.id)}
                              onChange={() => toggleAudienceItem(opt.id)}
                              style={{ display: 'none' }} />
                            {opt.name}
                          </label>
                        ))}
                      </div>
                      <button type="button" className="outage-btn-small" onClick={previewAudienceCount}>
                        <Eye size={14} /> Preview Audience
                      </button>
                      {audiencePreview && (
                        <div className="outage-text-success" style={{ marginTop: '8px', fontSize: '13px' }}>
                          Will reach {audiencePreview.count} user(s)
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
                  <button type="button" className="outage-btn-secondary"
                    onClick={() => { setSelectedTemplate(null); setFieldValues({}); }}>
                    Back
                  </button>
                  <button type="button" className="outage-btn-primary" disabled={submitting}
                    onClick={() => handleCreate(false)}>
                    <Clock size={16} /> Save Draft
                  </button>
                  <button type="button" className="outage-btn-success" disabled={submitting}
                    onClick={() => handleCreate(true)}>
                    <Send size={16} /> {submitting ? 'Publishing...' : 'Publish Now'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* View Detail Modal */}
      {viewingId && viewData && (
        <div className="outage-modal-overlay" onClick={(e) => e.target === e.currentTarget && setViewingId(null)}>
          <div className="outage-modal-content" style={{ maxWidth: '750px' }}>
            <div className="outage-modal-header">
              <h2 className="outage-modal-title">Notification Details</h2>
              <button onClick={() => setViewingId(null)} className="outage-modal-close">
                <X size={20} />
              </button>
            </div>
            <div style={{
              padding: '16px', borderRadius: '10px', marginBottom: '16px',
              background: viewData.header_color + '18',
              borderLeft: `4px solid ${viewData.header_color}`,
            }}>
              <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--nx-text)', marginBottom: '4px' }}>{viewData.title}</div>
              <div className="outage-text-muted" style={{ fontSize: '13px' }}>
                {viewData.template_name} · {viewData.severity} · {viewData.status} · {viewData.view_count} views
              </div>
            </div>

            {/* Field Values */}
            <div style={{ marginBottom: '16px' }}>
              {(viewData.field_values || []).map((fv, idx) => (
                <div key={idx} style={{ padding: '8px 0', borderBottom: '1px solid var(--nx-surface)' }}>
                  <div className="outage-text-muted" style={{ fontSize: '12px', fontWeight: '500', marginBottom: '2px' }}>{fv.field_label}</div>
                  <div style={{ fontSize: '14px', color: 'var(--nx-text-secondary)', whiteSpace: 'pre-wrap' }}>{fv.field_value || '—'}</div>
                </div>
              ))}
            </div>

            {/* Timeline */}
            <div className="outage-text-muted" style={{ fontSize: '13px' }}>
              <div>Created: {new Date(viewData.created_at).toLocaleString()} by {viewData.created_by_name}</div>
              {viewData.published_at && <div>Published: {new Date(viewData.published_at).toLocaleString()} by {viewData.published_by_name}</div>}
              {viewData.resolved_at && <div>Resolved: {new Date(viewData.resolved_at).toLocaleString()} by {viewData.resolved_by_name}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

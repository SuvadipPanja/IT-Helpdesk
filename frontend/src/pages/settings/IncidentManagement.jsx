// ============================================
// INCIDENT MANAGEMENT PAGE
// Admin/IT Staff: create, update, resolve incident banners
// ============================================

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  AlertTriangle, Plus, Edit, Trash2, CheckCircle,
  RefreshCw, X, AlertCircle, Info, Clock
} from 'lucide-react';
import api from '../../services/api';
import '../../styles/IncidentManagement.css';

const SEVERITY_OPTIONS = ['info', 'low', 'medium', 'high', 'critical'];
const STATUS_OPTIONS = ['active', 'monitoring', 'resolved'];

const SEVERITY_COLORS = {
  critical: '#ef4444', high: '#f97316', medium: '#f59e0b',
  low: '#3b82f6', info: '#22c55e',
};

const STATUS_LABELS = { active: 'Active', monitoring: 'Monitoring', resolved: 'Resolved' };

const SEVERITY_CLASSNAMES = {
  critical: 'incident-pill--critical',
  high: 'incident-pill--high',
  medium: 'incident-pill--medium',
  low: 'incident-pill--low',
  info: 'incident-pill--info',
};

const STATUS_CLASSNAMES = {
  active: 'incident-pill--active',
  monitoring: 'incident-pill--monitoring',
  resolved: 'incident-pill--resolved',
};

const emptyForm = {
  title: '', description: '', severity: 'medium',
  affected_services: '', status: 'active',
};

export default function IncidentManagement() {
  const { user } = useAuth();
  const toast = useToast();
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/status');
      setIncidents(res.data?.data?.incidents || []);
    } catch (err) {
      toast?.error?.('Failed to load incidents');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchIncidents(); }, [fetchIncidents]);

  const openCreate = () => { setForm(emptyForm); setEditingId(null); setShowForm(true); };

  const openEdit = (inc) => {
    setForm({
      title: inc.title,
      description: inc.description,
      severity: inc.severity,
      affected_services: inc.affected_services || '',
      status: inc.status,
    });
    setEditingId(inc.id);
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(emptyForm); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) {
      toast?.error?.('Title and description are required');
      return;
    }
    setSubmitting(true);
    try {
      if (editingId) {
        await api.put(`/status/${editingId}`, form);
        toast?.success?.('Incident updated');
      } else {
        await api.post('/status', form);
        toast?.success?.('Incident created — banner is now visible to all users');
      }
      closeForm();
      fetchIncidents();
    } catch (err) {
      toast?.error?.(err.response?.data?.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResolve = async (id) => {
    try {
      await api.put(`/status/${id}`, { status: 'resolved' });
      toast?.success?.('Incident marked as resolved');
      fetchIncidents();
    } catch {
      toast?.error?.('Failed to resolve incident');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this incident permanently?')) return;
    try {
      await api.delete(`/status/${id}`);
      toast?.success?.('Incident deleted');
      fetchIncidents();
    } catch {
      toast?.error?.('Failed to delete');
    }
  };

  return (
    <div className="incident-page">
      {/* Header */}
      <div className="incident-header">
        <div className="incident-header-copy">
          <h1 className="incident-title">
            <span className="incident-title-icon">
              <AlertTriangle size={24} />
            </span>
            Incident Management
          </h1>
          <p className="incident-subtitle">
            Create and manage service incident banners visible to all users
          </p>
        </div>
        <div className="incident-header-actions">
          <button
            onClick={fetchIncidents}
            className="incident-btn incident-btn--secondary"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            onClick={openCreate}
            className="incident-btn incident-btn--primary"
          >
            <Plus size={16} /> New Incident
          </button>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="incident-modal-backdrop">
          <div className="incident-modal">
            <div className="incident-modal-header">
              <h2 className="incident-modal-title">
                {editingId ? 'Update Incident' : 'Create Incident Banner'}
              </h2>
              <button onClick={closeForm} className="incident-modal-close"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="incident-form">
              <div className="incident-form-group">
                <label className="incident-label">Title *</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g., Email service experiencing delays"
                  maxLength={255}
                  required
                  className="incident-input"
                />
              </div>
              <div className="incident-form-group">
                <label className="incident-label">Description *</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Describe the issue and expected resolution time..."
                  maxLength={2000}
                  required
                  rows={4}
                  className="incident-input incident-textarea"
                />
              </div>
              <div className="incident-form-grid">
                <div>
                  <label className="incident-label">Severity</label>
                  <select
                    value={form.severity}
                    onChange={(e) => setForm((p) => ({ ...p, severity: e.target.value }))}
                    className="incident-input"
                  >
                    {SEVERITY_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                  </select>
                </div>
                {editingId && (
                  <div>
                    <label className="incident-label">Status</label>
                    <select
                      value={form.status}
                      onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                      className="incident-input"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="incident-form-group incident-form-group--compact">
                <label className="incident-label">Affected Services (optional)</label>
                <input
                  value={form.affected_services}
                  onChange={(e) => setForm((p) => ({ ...p, affected_services: e.target.value }))}
                  placeholder="e.g., Email, Ticketing, VPN"
                  maxLength={500}
                  className="incident-input"
                />
              </div>
              <div className="incident-modal-actions">
                <button type="button" onClick={closeForm} className="incident-btn incident-btn--secondary">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`incident-btn ${editingId ? 'incident-btn--accent' : 'incident-btn--primary'}`}
                >
                  {submitting ? 'Saving...' : editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Incidents Table */}
      {loading ? (
        <div className="incident-empty-state incident-empty-state--loading">Loading incidents...</div>
      ) : incidents.length === 0 ? (
        <div className="incident-empty-state incident-empty-state--success">
          <CheckCircle size={40} className="incident-empty-icon" />
          <p className="incident-empty-title">No incidents</p>
          <p className="incident-empty-copy">All systems are operating normally.</p>
        </div>
      ) : (
        <div className="incident-list">
          {incidents.map((inc) => (
            <div key={inc.id} className="incident-card">
              <div className={`incident-accent ${SEVERITY_CLASSNAMES[inc.severity] || ''}`} />
              <div className="incident-card-main">
                <div className="incident-card-header-row">
                  <span className="incident-card-title">{inc.title}</span>
                  <span className={`incident-pill ${SEVERITY_CLASSNAMES[inc.severity] || ''}`}>
                    {inc.severity?.toUpperCase()}
                  </span>
                  <span className={`incident-pill ${STATUS_CLASSNAMES[inc.status] || ''}`}>
                    {STATUS_LABELS[inc.status]}
                  </span>
                </div>
                <p className="incident-card-description">{inc.description}</p>
                {inc.affected_services && (
                  <p className="incident-card-services">
                    <strong>Affected:</strong> {inc.affected_services}
                  </p>
                )}
                <div className="incident-card-meta">
                  <Clock size={12} />
                  {new Date(inc.created_at).toLocaleString()}
                  {inc.created_by_name && ` · by ${inc.created_by_name}`}
                </div>
              </div>
              <div className="incident-card-actions">
                {inc.status !== 'resolved' && (
                  <button
                    onClick={() => handleResolve(inc.id)}
                    title="Mark resolved"
                    className="incident-btn incident-btn--resolve"
                  >
                    Resolve
                  </button>
                )}
                <button
                  onClick={() => openEdit(inc)}
                  title="Edit"
                  className="incident-icon-btn incident-icon-btn--edit"
                >
                  <Edit size={14} />
                </button>
                <button
                  onClick={() => handleDelete(inc.id)}
                  title="Delete"
                  className="incident-icon-btn incident-icon-btn--delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

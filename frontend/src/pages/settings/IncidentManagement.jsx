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

const SEVERITY_OPTIONS = ['info', 'low', 'medium', 'high', 'critical'];
const STATUS_OPTIONS = ['active', 'monitoring', 'resolved'];

const SEVERITY_COLORS = {
  critical: '#ef4444', high: '#f97316', medium: '#f59e0b',
  low: '#3b82f6', info: '#22c55e',
};

const STATUS_LABELS = { active: 'Active', monitoring: 'Monitoring', resolved: 'Resolved' };

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
    <div style={{ padding: '24px', maxWidth: '900px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={24} color="#f97316" />
            Incident Management
          </h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '14px' }}>
            Create and manage service incident banners visible to all users
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={fetchIncidents}
            style={{ padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#374151' }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            onClick={openCreate}
            style={{ padding: '8px 16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '14px' }}
          >
            <Plus size={16} /> New Incident
          </button>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'white', borderRadius: '12px', width: '100%', maxWidth: '560px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
                {editingId ? 'Update Incident' : 'Create Incident Banner'}
              </h2>
              <button onClick={closeForm} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Title *</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g., Email service experiencing delays"
                  maxLength={255}
                  required
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Description *</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Describe the issue and expected resolution time..."
                  maxLength={2000}
                  required
                  rows={4}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Severity</label>
                  <select
                    value={form.severity}
                    onChange={(e) => setForm((p) => ({ ...p, severity: e.target.value }))}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }}
                  >
                    {SEVERITY_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                  </select>
                </div>
                {editingId && (
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Status</label>
                    <select
                      value={form.status}
                      onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px' }}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Affected Services (optional)</label>
                <input
                  value={form.affected_services}
                  onChange={(e) => setForm((p) => ({ ...p, affected_services: e.target.value }))}
                  placeholder="e.g., Email, Ticketing, VPN"
                  maxLength={500}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={closeForm} style={{ padding: '10px 20px', border: '1px solid #e5e7eb', borderRadius: '8px', background: 'white', cursor: 'pointer', fontSize: '14px' }}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ padding: '10px 24px', background: editingId ? '#3b82f6' : '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: submitting ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '14px', opacity: submitting ? 0.7 : 1 }}
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
        <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af' }}>Loading incidents...</div>
      ) : incidents.length === 0 ? (
        <div style={{ padding: '60px', textAlign: 'center', background: '#f9fafb', borderRadius: '12px', color: '#6b7280' }}>
          <CheckCircle size={40} color="#22c55e" style={{ marginBottom: '12px' }} />
          <p style={{ margin: 0, fontWeight: 600 }}>No incidents</p>
          <p style={{ margin: '4px 0 0', fontSize: '13px' }}>All systems are operating normally.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {incidents.map((inc) => (
            <div key={inc.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '16px', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: SEVERITY_COLORS[inc.severity], marginTop: 5, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, fontSize: '15px' }}>{inc.title}</span>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: SEVERITY_COLORS[inc.severity], background: `${SEVERITY_COLORS[inc.severity]}15`, padding: '2px 8px', borderRadius: '20px' }}>
                    {inc.severity?.toUpperCase()}
                  </span>
                  <span style={{ fontSize: '11px', color: inc.status === 'resolved' ? '#059669' : '#f97316', background: inc.status === 'resolved' ? '#f0fdf4' : '#fff7ed', padding: '2px 8px', borderRadius: '20px', fontWeight: 600 }}>
                    {STATUS_LABELS[inc.status]}
                  </span>
                </div>
                <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#4b5563' }}>{inc.description}</p>
                {inc.affected_services && (
                  <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#9ca3af' }}>
                    <strong>Affected:</strong> {inc.affected_services}
                  </p>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#9ca3af' }}>
                  <Clock size={12} />
                  {new Date(inc.created_at).toLocaleString()}
                  {inc.created_by_name && ` · by ${inc.created_by_name}`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                {inc.status !== 'resolved' && (
                  <button
                    onClick={() => handleResolve(inc.id)}
                    title="Mark resolved"
                    style={{ padding: '6px 12px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', color: '#059669', fontWeight: 600 }}
                  >
                    Resolve
                  </button>
                )}
                <button
                  onClick={() => openEdit(inc)}
                  title="Edit"
                  style={{ padding: '6px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', cursor: 'pointer', color: '#3b82f6' }}
                >
                  <Edit size={14} />
                </button>
                <button
                  onClick={() => handleDelete(inc.id)}
                  title="Delete"
                  style={{ padding: '6px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', cursor: 'pointer', color: '#ef4444' }}
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

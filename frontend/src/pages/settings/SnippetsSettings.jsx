// ============================================================
// SNIPPETS SETTINGS PAGE
// IT engineers manage their response snippet templates here.
// ============================================================

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, Copy, Check, X, BookOpen } from 'lucide-react';
import api from '../../services/api';

const CATEGORIES = ['General', 'Hardware', 'Software', 'Network', 'Access', 'Email', 'Security', 'Performance', 'Training', 'Other'];

const emptyForm = { title: '', body: '', category: 'General', shortcut: '', is_shared: true };

export default function SnippetsSettings() {
  const [snippets, setSnippets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(null);
  const [success, setSuccess] = useState('');

  useEffect(() => { fetchSnippets(); }, []);

  const fetchSnippets = async () => {
    try {
      setLoading(true);
      const res = await api.get('/snippets');
      if (res.data.success) setSnippets(res.data.data.snippets || []);
    } catch {
      // handled silently
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => { setForm(emptyForm); setEditingId(null); setError(''); setShowModal(true); };
  const openEdit = (s) => {
    setForm({ title: s.title, body: s.body, category: s.category, shortcut: s.shortcut || '', is_shared: !!s.is_shared });
    setEditingId(s.snippet_id);
    setError('');
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) { setError('Title and body are required'); return; }
    setSaving(true);
    setError('');
    try {
      if (editingId) {
        await api.put(`/snippets/${editingId}`, form);
        setSuccess('Snippet updated');
      } else {
        await api.post('/snippets', form);
        setSuccess('Snippet created');
      }
      setShowModal(false);
      fetchSnippets();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this snippet?')) return;
    try {
      await api.delete(`/snippets/${id}`);
      setSnippets((prev) => prev.filter((s) => s.snippet_id !== id));
      setSuccess('Snippet deleted');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed');
    }
  };

  const handleCopy = (body, id) => {
    navigator.clipboard.writeText(body).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  // Filter snippets
  const filtered = snippets.filter((s) => {
    const q = search.toLowerCase();
    const matchSearch = !q || s.title.toLowerCase().includes(q) || s.body.toLowerCase().includes(q) || (s.shortcut || '').toLowerCase().includes(q);
    const matchCat = !filterCategory || s.category === filterCategory;
    return matchSearch && matchCat;
  });

  // Group by category
  const grouped = filtered.reduce((acc, s) => {
    (acc[s.category] = acc[s.category] || []).push(s);
    return acc;
  }, {});

  return (
    <div style={{ padding: '24px', maxWidth: '960px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={22} /> Response Snippets
          </h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '14px' }}>
            Save and reuse common IT support responses. Shared snippets are visible to the whole team.
          </p>
        </div>
        <button
          onClick={openCreate}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 16px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
        >
          <Plus size={16} /> New Snippet
        </button>
      </div>

      {/* Success banner */}
      {success && (
        <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: '8px', padding: '10px 16px', marginBottom: '16px', color: '#166534', fontSize: '14px' }}>
          {success}
        </div>
      )}

      {/* Search / filter bar */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
          <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input
            type="text"
            placeholder="Search snippets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', paddingLeft: '34px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '8px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', background: '#fff' }}
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Snippet list */}
      {loading ? (
        <div style={{ textAlign: 'center', color: '#6b7280', padding: '48px' }}>Loading snippets...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#6b7280', padding: '48px' }}>
          {snippets.length === 0 ? 'No snippets yet. Create your first one!' : 'No snippets match your search.'}
        </div>
      ) : (
        Object.entries(grouped).map(([cat, items]) => (
          <div key={cat} style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>{cat}</h3>
            {items.map((s) => (
              <div key={s.snippet_id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '14px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 600, color: '#111827', fontSize: '14px' }}>{s.title}</span>
                      {s.shortcut && (
                        <span style={{ background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '4px', padding: '1px 6px', fontSize: '11px', color: '#374151', fontFamily: 'monospace' }}>
                          {s.shortcut}
                        </span>
                      )}
                      {s.is_shared ? (
                        <span style={{ background: '#dbeafe', color: '#1d4ed8', fontSize: '11px', padding: '1px 6px', borderRadius: '4px' }}>Shared</span>
                      ) : (
                        <span style={{ background: '#f3f4f6', color: '#6b7280', fontSize: '11px', padding: '1px 6px', borderRadius: '4px' }}>Private</span>
                      )}
                    </div>
                    <p style={{ margin: 0, color: '#4b5563', fontSize: '13px', lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: '80px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.body}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    <button
                      onClick={() => handleCopy(s.body, s.snippet_id)}
                      title="Copy to clipboard"
                      style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', color: copied === s.snippet_id ? '#059669' : '#6b7280' }}
                    >
                      {copied === s.snippet_id ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                    <button
                      onClick={() => openEdit(s)}
                      title="Edit snippet"
                      style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', color: '#6b7280' }}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(s.snippet_id)}
                      title="Delete snippet"
                      style={{ background: 'none', border: '1px solid #d1d5db', borderRadius: '6px', padding: '5px 8px', cursor: 'pointer', color: '#dc2626' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {s.created_by_name && (
                  <p style={{ margin: '8px 0 0', fontSize: '11px', color: '#9ca3af' }}>By {s.created_by_name}</p>
                )}
              </div>
            ))}
          </div>
        ))
      )}

      {/* Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>{editingId ? 'Edit Snippet' : 'New Snippet'}</h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
                <X size={20} />
              </button>
            </div>

            {error && <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '8px 12px', marginBottom: '16px', color: '#991b1b', fontSize: '13px' }}>{error}</div>}

            <form onSubmit={handleSave}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Title *</label>
                <input type="text" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} maxLength={200} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} required />
              </div>

              <div style={{ marginBottom: '16px', display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Category</label>
                  <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', background: '#fff' }}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Shortcut (optional)</label>
                  <input type="text" value={form.shortcut} onChange={(e) => setForm((p) => ({ ...p, shortcut: e.target.value }))} placeholder="/greet" maxLength={50} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }} />
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>Response Body *</label>
                <textarea value={form.body} onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))} rows={8} style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', resize: 'vertical', minHeight: '120px' }} required />
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#9ca3af' }}>{form.body.length} characters</p>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: '#374151' }}>
                  <input type="checkbox" checked={form.is_shared} onChange={(e) => setForm((p) => ({ ...p, is_shared: e.target.checked }))} style={{ accentColor: '#3b82f6' }} />
                  Share with the whole IT team
                </label>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowModal(false)} style={{ padding: '9px 18px', border: '1px solid #d1d5db', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontSize: '14px' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ padding: '9px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>
                  {saving ? 'Saving...' : (editingId ? 'Update' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// SNIPPETS SETTINGS PAGE
// IT engineers manage their response snippet templates here.
// ============================================================

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, Copy, Check, X, BookOpen } from 'lucide-react';
import api from '../../services/api';
import '../../styles/SnippetsSettings.css';

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
    <div className="snippets-page">
      {/* Header */}
      <div className="snippets-header">
        <div className="snippets-header-copy">
          <h1 className="snippets-title">
            <BookOpen size={22} /> Response Snippets
          </h1>
          <p className="snippets-subtitle">
            Save and reuse common IT support responses. Shared snippets are visible to the whole team.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="snippets-btn snippets-btn--primary"
        >
          <Plus size={16} /> New Snippet
        </button>
      </div>

      {/* Success banner */}
      {success && (
        <div className="snippets-banner snippets-banner--success">
          {success}
        </div>
      )}

      {/* Search / filter bar */}
      <div className="snippets-toolbar">
        <div className="snippets-search-wrap">
          <Search size={15} className="snippets-search-icon" />
          <input
            type="text"
            placeholder="Search snippets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="snippets-input snippets-search-input"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="snippets-input snippets-select"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Snippet list */}
      {loading ? (
        <div className="snippets-empty-state snippets-empty-state--loading">Loading snippets...</div>
      ) : filtered.length === 0 ? (
        <div className="snippets-empty-state">
          {snippets.length === 0 ? 'No snippets yet. Create your first one!' : 'No snippets match your search.'}
        </div>
      ) : (
        Object.entries(grouped).map(([cat, items]) => (
          <div key={cat} className="snippets-group">
            <h3 className="snippets-group-title">{cat}</h3>
            {items.map((s) => (
              <div key={s.snippet_id} className="snippet-card">
                <div className="snippet-card-head">
                  <div className="snippet-card-copy">
                    <div className="snippet-card-meta-row">
                      <span className="snippet-card-title">{s.title}</span>
                      {s.shortcut && (
                        <span className="snippet-pill snippet-pill--shortcut">
                          {s.shortcut}
                        </span>
                      )}
                      {s.is_shared ? (
                        <span className="snippet-pill snippet-pill--shared">Shared</span>
                      ) : (
                        <span className="snippet-pill snippet-pill--private">Private</span>
                      )}
                    </div>
                    <p className="snippet-card-body">
                      {s.body}
                    </p>
                  </div>
                  <div className="snippet-card-actions">
                    <button
                      onClick={() => handleCopy(s.body, s.snippet_id)}
                      title="Copy to clipboard"
                      className={`snippet-icon-btn ${copied === s.snippet_id ? 'snippet-icon-btn--copied' : ''}`}
                    >
                      {copied === s.snippet_id ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                    <button
                      onClick={() => openEdit(s)}
                      title="Edit snippet"
                      className="snippet-icon-btn"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(s.snippet_id)}
                      title="Delete snippet"
                      className="snippet-icon-btn snippet-icon-btn--danger"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                {s.created_by_name && (
                  <p className="snippet-card-author">By {s.created_by_name}</p>
                )}
              </div>
            ))}
          </div>
        ))
      )}

      {/* Modal */}
      {showModal && (
        <div className="snippets-modal-backdrop">
          <div className="snippets-modal">
            <div className="snippets-modal-header">
              <h3 className="snippets-modal-title">{editingId ? 'Edit Snippet' : 'New Snippet'}</h3>
              <button onClick={() => setShowModal(false)} className="snippets-modal-close">
                <X size={20} />
              </button>
            </div>

            {error && <div className="snippets-banner snippets-banner--error">{error}</div>}

            <form onSubmit={handleSave} className="snippets-form">
              <div className="snippets-form-group">
                <label className="snippets-label">Title *</label>
                <input type="text" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} maxLength={200} className="snippets-input" required />
              </div>

              <div className="snippets-form-grid">
                <div className="snippets-form-group">
                  <label className="snippets-label">Category</label>
                  <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} className="snippets-input snippets-select">
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="snippets-form-group">
                  <label className="snippets-label">Shortcut (optional)</label>
                  <input type="text" value={form.shortcut} onChange={(e) => setForm((p) => ({ ...p, shortcut: e.target.value }))} placeholder="/greet" maxLength={50} className="snippets-input" />
                </div>
              </div>

              <div className="snippets-form-group">
                <label className="snippets-label">Response Body *</label>
                <textarea value={form.body} onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))} rows={8} className="snippets-input snippets-textarea" required />
                <p className="snippets-character-count">{form.body.length} characters</p>
              </div>

              <div className="snippets-form-group snippets-form-group--compact">
                <label className="snippets-checkbox-row">
                  <input type="checkbox" checked={form.is_shared} onChange={(e) => setForm((p) => ({ ...p, is_shared: e.target.checked }))} className="snippets-checkbox" />
                  Share with the whole IT team
                </label>
              </div>

              <div className="snippets-modal-actions">
                <button type="button" onClick={() => setShowModal(false)} className="snippets-btn snippets-btn--secondary">Cancel</button>
                <button type="submit" disabled={saving} className="snippets-btn snippets-btn--primary">
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

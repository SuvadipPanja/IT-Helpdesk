// ============================================================
// KB MANAGER — Admin management for Knowledge Base
// Tabs: Articles | FAQs | Categories | Analytics
// ============================================================
import { useState, useEffect, useRef } from 'react';
import {
  BookOpen, FileText, HelpCircle, BarChart2,
  Plus, Edit2, Trash2, Eye, EyeOff, CheckCircle, Archive,
  X, Save, Loader, Search, TrendingUp, Clock, AlertCircle
} from 'lucide-react';
import { kbService } from '../../services/kbService';
import '../../styles/HelpCenter.css';

// ── Emoji list for icon picker ───────────────────────────────
const KB_EMOJIS = [
  // Documents & Articles
  '📄','📝','📋','📑','🗒️','📃','📰','🗞️','📊','📈','📉',
  // Folders & Files
  '📁','📂','🗂️','📎','🔗','📌','📍','🗃️','📦','📫',
  // Tech & Hardware
  '💻','🖥️','🖨️','⌨️','🖱️','📱','📡','🔌','💾','💿','📀',
  // Network & Security
  '🌐','📶','🔒','🔓','🔐','🔑','🛡️','🔏',
  // Tools & Settings
  '⚙️','🔧','🔨','🛠️','🔩','🧰','🔮','🧪',
  // Users & Accounts
  '👤','👥','🧑‍💻','👨‍💼','👩‍💼','🧑‍🔧',
  // Communication
  '📧','📬','💬','📞','📢','📣','🔔','💌',
  // Status & Alerts
  '✅','❌','⚠️','❓','ℹ️','🆘','🔴','🟡','🟢','🔵','⭕',
  // Time
  '⏰','🕒','📅','📆','⏱️',
  // Ideas & Analytics
  '💡','🎯','🚀','⭐','🏆','🎓','🧠','🔍','🔎','👁️',
  // General
  '🏷️','📤','📥','🔄','🆕','🆙','❗','🎉','🧩','📸',
];

// ── Emoji Picker Field ───────────────────────────────────────
function EmojiPickerField({ value, onChange, label = 'Icon' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="kbm-form-group kbm-emoji-field" ref={ref}>
      <label>{label}</label>
      <button type="button" className="kbm-emoji-trigger" onClick={() => setOpen(o => !o)}>
        <span className="kbm-emoji-preview">{value || '📄'}</span>
        <span className="kbm-emoji-change">Change ▾</span>
      </button>
      {open && (
        <div className="kbm-emoji-popup">
          {KB_EMOJIS.map(e => (
            <button
              type="button" key={e}
              className={`kbm-emoji-btn${value === e ? ' active' : ''}`}
              onClick={() => { onChange(e); setOpen(false); }}
              title={e}
            >{e}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tabs ────────────────────────────────────────────────────
const TABS = [
  { id: 'articles',      label: 'Articles',      Icon: FileText   },
  { id: 'faqs',          label: 'FAQs',           Icon: HelpCircle },
  { id: 'categories',    label: 'Categories',     Icon: BookOpen   },
  { id: 'analytics',     label: 'Analytics',      Icon: BarChart2  },
];

// ── Severity badge helper ────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    published: 'kbm-badge-green',
    draft:     'kbm-badge-yellow',
    archived:  'kbm-badge-gray',
  };
  return <span className={`kbm-badge ${map[status] || 'kbm-badge-gray'}`}>{status}</span>;
};

// ────────────────────────────────────────────────────────────
export default function KBManager() {
  const [tab, setTab] = useState('articles');

  return (
    <div className="kbm-page">
      <div className="kbm-header">
        <h1><BookOpen size={28} /> Knowledge Base Manager</h1>
        <p>Manage articles, FAQs, categories, announcements and view analytics</p>
      </div>

      <div className="kbm-tabs">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} className={`kbm-tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      <div className="kbm-body">
        {tab === 'articles'   && <ArticlesTab />}
        {tab === 'faqs'       && <FaqsTab />}
        {tab === 'categories' && <CategoriesTab />}
        {tab === 'analytics'  && <AnalyticsTab />}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  ARTICLES TAB
// ════════════════════════════════════════════════════════════
function ArticlesTab() {
  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [apiError, setApiError] = useState('');
  const [search, setSearch]     = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]     = useState(null);
  const [form, setForm]         = useState(emptyArticle());
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    fetchArticles();
    kbService.getCategories().then(r => setCategories(r.data?.data || [])).catch(() => {});
  }, []);

  const fetchArticles = async () => {
    setLoading(true);
    setApiError('');
    try {
      const r = await kbService.getAdminArticles({ limit: 100 });
      setArticles(r.data?.data || []);
    } catch (e) {
      setApiError(e.response?.data?.message || 'Failed to load articles. Check backend connection.');
    } finally { setLoading(false); }
  };

  const openCreate = () => { setForm({ ...emptyArticle(), category_id: categories[0]?.category_id ? String(categories[0].category_id) : '' }); setEditId(null); setError(''); setShowForm(true); };
  const openEdit   = (a) => {
    setForm({
      title: a.title || '', description: a.description || '', content: a.content || '',
      icon: a.icon || '📄', category_id: String(a.category_id || ''),
      difficulty: a.difficulty || 'Beginner', read_time: a.read_time || '5 min read',
      tags: Array.isArray(a.tags) ? a.tags.join(', ') : (a.tags || ''),
    });
    setEditId(a.article_id);
    setError('');
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setError('Title is required'); return; }
    setSaving(true);
    try {
      const payload = { ...form, tags: form.tags.split(',').map(t => t.trim()).filter(Boolean) };
      if (editId) await kbService.updateArticle(editId, payload);
      else        await kbService.createArticle(payload);
      setShowForm(false);
      fetchArticles();
    } catch (e) { setError(e.response?.data?.message || 'Save failed'); } finally { setSaving(false); }
  };

  const handlePublish = async (id) => {
    try { await kbService.publishArticle(id); fetchArticles(); } catch { /* toast */ }
  };
  const handleArchive = async (id) => {
    if (!window.confirm('Archive this article?')) return;
    try { await kbService.archiveArticle(id); fetchArticles(); } catch { /* toast */ }
  };

  const filtered = articles.filter(a => {
    const matchSearch = !search || a.title?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || a.status === filterStatus;
    return matchSearch && matchStatus;
  });

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      {apiError && (
        <div className="kbm-error" style={{ marginBottom: '1rem' }}><AlertCircle size={16} /> {apiError}</div>
      )}
      <div className="kbm-toolbar">
        <div className="kbm-search-wrap">
          <Search size={16} />
          <input placeholder="Search articles…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="kbm-select">
          <option value="all">All Status</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
        <button className="kbm-btn-primary" onClick={openCreate}><Plus size={16} /> New Article</button>
      </div>

      <div className="kbm-count">{articles.length} article{articles.length !== 1 ? 's' : ''}{search || filterStatus !== 'all' ? ` (${filtered.length} shown)` : ''}</div>

      <table className="kbm-table">
        <thead><tr>
          <th>Icon</th><th>Title</th><th>Category</th><th>Difficulty</th>
          <th>Views</th><th>Helpful</th><th>Status</th><th>Actions</th>
        </tr></thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr><td colSpan={8} className="kbm-empty">
              {articles.length === 0 && !search && filterStatus === 'all'
                ? <><FileText size={32} style={{opacity:0.3,display:'block',margin:'0 auto 0.5rem'}}/> No articles yet — click <strong>+ New Article</strong> to create your first article.</>
                : 'No articles match your search / filter.'}
            </td></tr>
          ) : filtered.map(a => (
            <tr key={a.article_id}>
              <td><span style={{ fontSize: '1.4rem' }}>{a.icon}</span></td>
              <td className="kbm-title-cell">
                <strong>{a.title}</strong>
                <small>{a.description?.substring(0, 80)}{a.description?.length > 80 ? '…' : ''}</small>
              </td>
              <td>{a.category_name}</td>
              <td><span className="kbm-diff" data-level={a.difficulty?.toLowerCase()}>{a.difficulty}</span></td>
              <td>{a.views || 0}</td>
              <td>{a.helpful_yes || 0} / {(a.helpful_yes || 0) + (a.helpful_no || 0)}</td>
              <td><StatusBadge status={a.status} /></td>
              <td>
                <div className="kbm-actions">
                  <button title="Edit" onClick={() => openEdit(a)}><Edit2 size={14} /></button>
                  {a.status !== 'published' && (
                    <button title="Publish" className="kbm-action-green" onClick={() => handlePublish(a.article_id)}><CheckCircle size={14} /></button>
                  )}
                  {a.status !== 'archived' && (
                    <button title="Archive" className="kbm-action-red" onClick={() => handleArchive(a.article_id)}><Archive size={14} /></button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showForm && (
        <ArticleFormModal
          form={form} setForm={setForm} onSave={handleSave}
          onClose={() => setShowForm(false)} saving={saving} error={error} isEdit={!!editId}
          categories={categories}
        />
      )}
    </div>
  );
}

function ArticleFormModal({ form, setForm, onSave, onClose, saving, error, isEdit, categories = [] }) {
  const f = (key, val) => setForm(p => ({ ...p, [key]: val }));
  return (
    <div className="kbm-modal-backdrop" onClick={onClose}>
      <div className="kbm-modal kbm-modal-lg" onClick={e => e.stopPropagation()}>
        <div className="kbm-modal-header">
          <h3>{isEdit ? 'Edit Article' : 'New Article'}</h3>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <form className="kbm-form" onSubmit={onSave}>
          {error && <div className="kbm-error"><AlertCircle size={16} /> {error}</div>}
          <div className="kbm-form-row">
            <EmojiPickerField value={form.icon} onChange={val => f('icon', val)} />
            <div className="kbm-form-group kbm-flex-1">
              <label>Title *</label>
              <input value={form.title} onChange={e => f('title', e.target.value)} placeholder="Article title" required />
            </div>
          </div>
          <div className="kbm-form-group">
            <label>Short Description</label>
            <input value={form.description} onChange={e => f('description', e.target.value)} placeholder="One-line summary" />
          </div>
          <div className="kbm-form-row">
            <div className="kbm-form-group">
              <label>Category *</label>
              <select value={form.category_id} onChange={e => f('category_id', e.target.value)} required>
                <option value="">— Select category —</option>
                {categories.map(c => <option key={c.category_id} value={String(c.category_id)}>{c.icon} {c.name}</option>)}
              </select>
            </div>
            <div className="kbm-form-group">
              <label>Difficulty</label>
              <select value={form.difficulty} onChange={e => f('difficulty', e.target.value)}>
                <option>Beginner</option><option>Intermediate</option><option>Advanced</option>
              </select>
            </div>
            <div className="kbm-form-group">
              <label>Read Time</label>
              <input value={form.read_time} onChange={e => f('read_time', e.target.value)} placeholder="5 min read" />
            </div>
          </div>
          <div className="kbm-form-group">
            <label>Tags (comma-separated)</label>
            <input value={form.tags} onChange={e => f('tags', e.target.value)} placeholder="vpn, password, network" />
          </div>
          <div className="kbm-form-group">
            <label>Content (Markdown)</label>
            <textarea value={form.content} onChange={e => f('content', e.target.value)} rows={12} placeholder="# Heading&#10;&#10;Article content in Markdown…" />
          </div>
          <div className="kbm-modal-footer">
            <button type="button" className="kbm-btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="kbm-btn-primary" disabled={saving}>
              {saving ? <><Loader size={14} className="kbm-spin" /> Saving…</> : <><Save size={14} /> Save</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function emptyArticle() {
  return { title: '', description: '', content: '', icon: '📄', category_id: '', difficulty: 'Beginner', read_time: '5 min read', tags: '' };
}

// ════════════════════════════════════════════════════════════
//  FAQs TAB
// ════════════════════════════════════════════════════════════
function FaqsTab() {
  const [faqs, setFaqs]         = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]     = useState(null);
  const [form, setForm]         = useState(emptyFaq());
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => {
    fetchFaqs();
    kbService.getCategories().then(r => setCategories(r.data?.data || [])).catch(() => {});
  }, []);

  const fetchFaqs = async () => {
    setLoading(true);
    try { const r = await kbService.getFaqs(); setFaqs(r.data?.data || []); }
    catch { /* silent */ } finally { setLoading(false); }
  };

  const openCreate = () => { setForm(emptyFaq()); setEditId(null); setError(''); setShowForm(true); };
  const openEdit = (f) => {
    setForm({ question: f.question, answer: f.answer, category_id: String(f.category_id || ''), sort_order: f.sort_order || 0, is_active: f.is_active !== false });
    setEditId(f.faq_id);
    setError('');
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.question.trim() || !form.answer.trim()) { setError('Question and answer required'); return; }
    setSaving(true);
    try {
      if (editId) await kbService.updateFaq(editId, form);
      else        await kbService.createFaq(form);
      setShowForm(false); fetchFaqs();
    } catch (e) { setError(e.response?.data?.message || 'Save failed'); } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this FAQ?')) return;
    try { await kbService.deleteFaq(id); fetchFaqs(); } catch { /* silent */ }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="kbm-toolbar">
        <span className="kbm-count">{faqs.length} FAQ{faqs.length !== 1 ? 's' : ''}</span>
        <button className="kbm-btn-primary" onClick={openCreate}><Plus size={16} /> New FAQ</button>
      </div>
      <table className="kbm-table">
        <thead><tr><th>#</th><th>Question</th><th>Views</th><th>Active</th><th>Actions</th></tr></thead>
        <tbody>
          {faqs.length === 0 ? (
            <tr><td colSpan={5} className="kbm-empty"><HelpCircle size={32} style={{opacity:0.3,display:'block',margin:'0 auto 0.5rem'}}/> No FAQs yet — click <strong>+ New FAQ</strong> to add one.</td></tr>
          ) : faqs.map((f, i) => (
            <tr key={f.faq_id}>
              <td className="kbm-num">{i + 1}</td>
              <td>
                <strong>{f.question}</strong>
                <small>{f.answer?.substring(0, 100)}…</small>
              </td>
              <td>{f.views || 0}</td>
              <td>{f.is_active ? <span className="kbm-badge kbm-badge-green">Active</span> : <span className="kbm-badge kbm-badge-gray">Inactive</span>}</td>
              <td>
                <div className="kbm-actions">
                  <button title="Edit" onClick={() => openEdit(f)}><Edit2 size={14} /></button>
                  <button title="Delete" className="kbm-action-red" onClick={() => handleDelete(f.faq_id)}><Trash2 size={14} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showForm && (
        <div className="kbm-modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="kbm-modal" onClick={e => e.stopPropagation()}>
            <div className="kbm-modal-header">
              <h3>{editId ? 'Edit FAQ' : 'New FAQ'}</h3>
              <button onClick={() => setShowForm(false)}><X size={18} /></button>
            </div>
            <form className="kbm-form" onSubmit={handleSave}>
              {error && <div className="kbm-error"><AlertCircle size={16} /> {error}</div>}
              <div className="kbm-form-group">
                <label>Question *</label>
                <input value={form.question} onChange={e => setForm(p => ({ ...p, question: e.target.value }))} required />
              </div>
              <div className="kbm-form-group">
                <label>Answer *</label>
                <textarea value={form.answer} onChange={e => setForm(p => ({ ...p, answer: e.target.value }))} rows={5} required />
              </div>
              <div className="kbm-form-group">
                <label>Category</label>
                <select value={form.category_id} onChange={e => setForm(p => ({ ...p, category_id: e.target.value }))}>
                  <option value="">— All / Uncategorised —</option>
                  {categories.map(c => <option key={c.category_id} value={String(c.category_id)}>{c.icon} {c.name}</option>)}
                </select>
              </div>
              <div className="kbm-form-row">
                <div className="kbm-form-group">
                  <label>Sort Order</label>
                  <input type="number" value={form.sort_order} onChange={e => setForm(p => ({ ...p, sort_order: Number(e.target.value) }))} min={0} />
                </div>
                <div className="kbm-form-group">
                  <label>Active</label>
                  <select value={form.is_active ? '1' : '0'} onChange={e => setForm(p => ({ ...p, is_active: e.target.value === '1' }))}>
                    <option value="1">Active</option><option value="0">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="kbm-modal-footer">
                <button type="button" className="kbm-btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="kbm-btn-primary" disabled={saving}>
                  {saving ? <><Loader size={14} className="kbm-spin" /> Saving…</> : <><Save size={14} /> Save</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function emptyFaq() {
  return { question: '', answer: '', category_id: '', sort_order: 0, is_active: true };
}

// ════════════════════════════════════════════════════════════
//  CATEGORIES TAB
// ════════════════════════════════════════════════════════════
function CategoriesTab() {
  const [cats, setCats]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]   = useState(null);
  const [form, setForm]       = useState(emptyCat());
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => { fetchCats(); }, []);

  const fetchCats = async () => {
    setLoading(true);
    try { const r = await kbService.getCategories(); setCats(r.data?.data || []); }
    catch { /* silent */ } finally { setLoading(false); }
  };

  const openCreate = () => { setForm(emptyCat()); setEditId(null); setError(''); setShowForm(true); };
  const openEdit   = (c) => {
    setForm({ name: c.name, description: c.description || '', icon: c.icon || '', color: c.color || '#6366f1', sort_order: c.sort_order || 0 });
    setEditId(c.category_id);
    setError('');
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setError('Name required'); return; }
    setSaving(true);
    try {
      if (editId) await kbService.updateCategory(editId, form);
      else        await kbService.createCategory(form);
      setShowForm(false); fetchCats();
    } catch (e) { setError(e.response?.data?.message || 'Save failed'); } finally { setSaving(false); }
  };

  const f = (key, val) => setForm(p => ({ ...p, [key]: val }));

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="kbm-toolbar">
        <span className="kbm-count">{cats.length} categor{cats.length !== 1 ? 'ies' : 'y'}</span>
        <button className="kbm-btn-primary" onClick={openCreate}><Plus size={16} /> New Category</button>
      </div>
      <div className="kbm-cat-grid">
        {cats.length === 0 && (
          <div className="kbm-empty" style={{ gridColumn: '1/-1', padding: '2rem', textAlign: 'center' }}>
            <BookOpen size={32} style={{ opacity: 0.3, display: 'block', margin: '0 auto 0.5rem' }} />
            No categories yet — click <strong>+ New Category</strong> to create one.
          </div>
        )}
        {cats.map(c => (
          <div key={c.category_id} className="kbm-cat-card" style={{ borderLeftColor: c.color }}>
            <div className="kbm-cat-info">
              <span style={{ fontSize: '1.5rem' }}>{c.icon}</span>
              <div>
                <strong>{c.name}</strong>
                <small>{c.description}</small>
              </div>
            </div>
            <div className="kbm-cat-meta">
              <span>{c.article_count || 0} articles</span>
              <button onClick={() => openEdit(c)}><Edit2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="kbm-modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="kbm-modal" onClick={e => e.stopPropagation()}>
            <div className="kbm-modal-header">
              <h3>{editId ? 'Edit Category' : 'New Category'}</h3>
              <button onClick={() => setShowForm(false)}><X size={18} /></button>
            </div>
            <form className="kbm-form" onSubmit={handleSave}>
              {error && <div className="kbm-error"><AlertCircle size={16} /> {error}</div>}
              <div className="kbm-form-row">
                <EmojiPickerField value={form.icon} onChange={val => f('icon', val)} />
                <div className="kbm-form-group kbm-flex-1">
                  <label>Name *</label>
                  <input value={form.name} onChange={e => f('name', e.target.value)} required />
                </div>
              </div>
              <div className="kbm-form-group">
                <label>Description</label>
                <input value={form.description} onChange={e => f('description', e.target.value)} />
              </div>
              <div className="kbm-form-row">
                <div className="kbm-form-group">
                  <label>Color</label>
                  <input type="color" value={form.color} onChange={e => f('color', e.target.value)} className="kbm-color-pick" />
                </div>
                <div className="kbm-form-group">
                  <label>Sort Order</label>
                  <input type="number" value={form.sort_order} onChange={e => f('sort_order', Number(e.target.value))} min={0} />
                </div>
              </div>
              <div className="kbm-modal-footer">
                <button type="button" className="kbm-btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="kbm-btn-primary" disabled={saving}>
                  {saving ? <><Loader size={14} className="kbm-spin" /> Saving…</> : <><Save size={14} /> Save</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function emptyCat() {
  return { name: '', description: '', icon: '📂', color: '#6366f1', sort_order: 0 };
}

// ════════════════════════════════════════════════════════════
//  ANALYTICS TAB
// ════════════════════════════════════════════════════════════
function AnalyticsTab() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    kbService.getAnalytics()
      .then(r => setData(r.data?.data || null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;
  if (!data)   return <div className="kbm-empty-box">Analytics unavailable.</div>;

  const s = data.summary || {};

  return (
    <div className="kbm-analytics">
      <div className="kbm-stat-grid">
        {[
          { label: 'Published Articles', value: s.published_articles ?? '—', Icon: FileText,    color: '#10b981' },
          { label: 'Draft Articles',     value: s.draft_articles     ?? '—', Icon: Edit2,        color: '#f59e0b' },
          { label: 'Total Views',        value: s.total_views        ?? '—', Icon: Eye,          color: '#8b5cf6' },
          { label: 'Searches (30d)',     value: s.searches_30d       ?? '—', Icon: Search,       color: '#6366f1' },
          { label: 'No-Result Searches', value: s.no_result_30d      ?? '—', Icon: AlertCircle,  color: '#ef4444' },
        ].map(({ label, value, Icon, color }) => (
          <div key={label} className="kbm-stat-card" style={{ borderTopColor: color }}>
            <div className="kbm-stat-icon" style={{ color }}><Icon size={22} /></div>
            <div className="kbm-stat-val">{typeof value === 'number' ? value.toLocaleString() : value}</div>
            <div className="kbm-stat-label">{label}</div>
          </div>
        ))}
      </div>

      {(data.top_articles || []).length > 0 && (
        <div className="kbm-top-articles">
          <h3><TrendingUp size={18} /> Top Articles by Views</h3>
          <table className="kbm-table">
            <thead><tr><th>#</th><th>Title</th><th>Views</th><th>Helpful %</th></tr></thead>
            <tbody>
              {data.top_articles.map((a, i) => (
                <tr key={a.slug}>
                  <td className="kbm-num">{i + 1}</td>
                  <td><strong>{a.title}</strong></td>
                  <td>{a.views || 0}</td>
                  <td>{a.helpful_pct != null ? `${a.helpful_pct}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(data.no_result_searches || []).length > 0 && (
        <div className="kbm-top-searches">
          <h3><Search size={18} /> Searches with No Results (last 30 days)</h3>
          <div className="kbm-search-tags">
            {data.no_result_searches.map((s, i) => (
              <span key={i} className="kbm-search-tag">
                {s.query} <em>({s.cnt}×)</em>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared loading spinner ───────────────────────────────────
function LoadingSpinner() {
  return (
    <div className="kbm-loading">
      <Loader size={28} className="kbm-spin" style={{ color: '#6366f1' }} />
      <span>Loading…</span>
    </div>
  );
}

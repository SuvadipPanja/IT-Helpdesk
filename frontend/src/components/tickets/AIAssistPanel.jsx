import { useState, useCallback } from 'react';
import { SparklesIcon, ChevronDownIcon, ChevronUpIcon, ClipboardIcon, CheckIcon, InfoIcon } from 'lucide-react';
import api from '../../services/api';

function apiErrorMessage(err) {
  const d = err.response?.data;
  if (typeof d?.message === 'string') return d.message;
  if (d?.data && typeof d.data === 'object' && d.data.message) return d.data.message;
  return err.message || 'Request failed';
}

// Priority badge colours
const PRIORITY_COLORS = {
  critical: '#dc2626',
  high:     '#ea580c',
  medium:   '#ca8a04',
  low:      '#2563eb',
  info:     '#6b7280',
};

// ─────────────────────────────────────────────────
// Small reusable: "Copy to clipboard" button
// ─────────────────────────────────────────────────
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handleCopy}
      title="Copy to clipboard"
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        padding: '2px 6px', borderRadius: 4,
        color: copied ? '#16a34a' : '#6b7280',
        display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12,
      }}
    >
      {copied ? <CheckIcon size={13} /> : <ClipboardIcon size={13} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

// ─────────────────────────────────────────────────
// Tab: AI Summary
// ─────────────────────────────────────────────────
function SummaryTab({ ticketId }) {
  const [loading, setLoading] = useState(false);
  const [summary,  setSummary]  = useState('');
  const [error,    setError]    = useState('');
  const [fetched,  setFetched]  = useState(false);
  const [meta,     setMeta]     = useState({ source: '', provider: '', model: '', hint: '' });

  const load = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/ai/engineer/summarize', { ticket_id: ticketId });
      const d = res.data?.data || {};
      setSummary(d.summary || '');
      setMeta({
        source: d.source || '',
        provider: d.provider_label || '',
        model: d.model || '',
        hint: d.hint || '',
      });
      setFetched(true);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [ticketId, loading]);

  if (!fetched && !loading) {
    return (
      <div style={{ padding: '12px 0' }}>
        <button className="ai-assist-btn" onClick={load}>
          <SparklesIcon size={14} /> Generate Summary
        </button>
        <p style={{ color: '#9ca3af', fontSize: 12, marginTop: 8 }}>
          Uses your configured AI provider when available; otherwise a rich structured brief from ticket data, comments, and activity.
        </p>
      </div>
    );
  }

  if (loading) return <p style={{ color: '#6b7280', fontStyle: 'italic', fontSize: 13 }}>Generating summary…</p>;
  if (error)   return <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>Review before sharing externally</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {meta.source === 'llm' && (
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', background: '#ede9fe', color: '#5b21b6', padding: '2px 8px', borderRadius: 999 }}>
                AI · {meta.provider || 'LLM'}{meta.model ? ` · ${meta.model}` : ''}
              </span>
            )}
            {meta.source === 'template' && (
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', background: '#f3f4f6', color: '#4b5563', padding: '2px 8px', borderRadius: 999 }}>
                Structured brief (offline)
              </span>
            )}
            {meta.hint && (
              <span style={{ fontSize: 11, color: '#6b7280', display: 'inline-flex', alignItems: 'center', gap: 4, maxWidth: '100%' }}>
                <InfoIcon size={12} /> {meta.hint}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <CopyButton text={summary} />
          <button className="ai-assist-btn-secondary" onClick={() => { setSummary(''); setFetched(false); setMeta({ source: '', provider: '', model: '', hint: '' }); }}>
            Refresh
          </button>
        </div>
      </div>
      <pre style={{
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        fontSize: 13, lineHeight: 1.7, color: '#374151',
        background: '#f9fafb', borderRadius: 6, padding: '10px 12px',
        border: '1px solid #e5e7eb', margin: 0,
      }}>{summary}</pre>
    </div>
  );
}

// ─────────────────────────────────────────────────
// Tab: Draft Reply
// ─────────────────────────────────────────────────
function DraftReplyTab({ ticketId, onUseDraft }) {
  const [loading,  setLoading]  = useState(false);
  const [draft,    setDraft]    = useState('');
  const [alternatives, setAlternatives] = useState([]);
  const [snippets, setSnippets] = useState([]);
  const [tone,     setTone]     = useState('professional');
  const [error,    setError]    = useState('');
  const [fetched,  setFetched]  = useState(false);
  const [used,     setUsed]     = useState(false);
  const [meta,     setMeta]     = useState({ source: '', hint: '', provider: '', model: '' });

  const load = useCallback(async (selectedTone) => {
    if (loading) return;
    setLoading(true);
    setError('');
    setUsed(false);
    try {
      const res = await api.post('/ai/engineer/draft_reply', { ticket_id: ticketId, tone: selectedTone || tone });
      const d = res.data?.data || {};
      setDraft(d.draft || '');
      setAlternatives(Array.isArray(d.alternatives) ? d.alternatives : []);
      setSnippets(d.snippets_used || []);
      setMeta({
        source: d.source || '',
        hint: d.hint || '',
        provider: d.provider_label || '',
        model: d.model || '',
      });
      setFetched(true);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [ticketId, tone, loading]);

  const handleUseDraft = () => {
    if (onUseDraft) onUseDraft(draft);
    setUsed(true);
    setTimeout(() => setUsed(false), 2000);
  };

  if (!fetched && !loading) {
    return (
      <div style={{ padding: '12px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <label style={{ fontSize: 12, color: '#374151' }}>Tone:</label>
          <select
            value={tone}
            onChange={e => setTone(e.target.value)}
            style={{ fontSize: 12, borderRadius: 4, border: '1px solid #d1d5db', padding: '2px 6px', cursor: 'pointer' }}
          >
            <option value="professional">Professional</option>
            <option value="friendly">Friendly</option>
            <option value="brief">Brief</option>
          </select>
        </div>
        <button className="ai-assist-btn" onClick={() => load(tone)}>
          <SparklesIcon size={14} /> Generate Draft Reply
        </button>
        <p style={{ color: '#9ca3af', fontSize: 12, marginTop: 8 }}>
          AI generates several variants from the full thread when a provider is configured; otherwise snippets + smart templates.
        </p>
      </div>
    );
  }

  if (loading) return <p style={{ color: '#6b7280', fontStyle: 'italic', fontSize: 13 }}>Drafting reply…</p>;
  if (error)   return <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>
            {meta.source === 'llm' ? (
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', background: '#ede9fe', color: '#5b21b6', padding: '2px 8px', borderRadius: 999 }}>
                AI drafts · {meta.provider || 'LLM'}{meta.model ? ` · ${meta.model}` : ''}
              </span>
            ) : snippets.length > 0 ? (
              `Snippets: ${snippets.map(s => s.title).join(', ')}`
            ) : (
              'Template + ticket-aware wording'
            )}
          </span>
          {meta.hint && (
            <span style={{ fontSize: 11, color: '#6b7280', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <InfoIcon size={12} /> {meta.hint}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <CopyButton text={draft} />
          <button className="ai-assist-btn-secondary" onClick={() => { setDraft(''); setAlternatives([]); setFetched(false); setMeta({ source: '', hint: '', provider: '', model: '' }); }}>
            Regenerate
          </button>
        </div>
      </div>
      {alternatives.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', margin: '0 0 6px' }}>Other variants (click to load)</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {alternatives.map((alt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setDraft(alt)}
                className="ai-assist-btn-secondary"
                style={{ textAlign: 'left', whiteSpace: 'pre-wrap', fontSize: 12, maxHeight: 72, overflow: 'hidden' }}
              >
                Variant {idx + 2}: {alt.slice(0, 120)}{alt.length > 120 ? '…' : ''}
              </button>
            ))}
          </div>
        </div>
      )}
      <textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        style={{
          width: '100%', minHeight: 140, fontSize: 13, lineHeight: 1.6,
          color: '#374151', background: '#f9fafb', borderRadius: 6,
          padding: '10px 12px', border: '1px solid #e5e7eb',
          resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box',
        }}
      />
      {snippets.length > 0 && meta.source !== 'llm' && (
        <p style={{ fontSize: 11, color: '#9ca3af', margin: '4px 0 8px' }}>
          Snippets used: {snippets.map(s => s.title).join(', ')}
        </p>
      )}
      <button
        className={`ai-assist-btn${used ? ' ai-assist-btn--success' : ''}`}
        onClick={handleUseDraft}
        style={{ marginTop: 4 }}
      >
        {used ? <CheckIcon size={14} /> : null}
        {used ? 'Inserted into comment box' : 'Use this draft'}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────
// Tab: Next Best Actions
// ─────────────────────────────────────────────────
function ActionsTab({ ticketId }) {
  const [loading, setLoading] = useState(false);
  const [actions, setActions] = useState([]);
  const [error,   setError]   = useState('');
  const [fetched, setFetched] = useState(false);

  const load = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/ai/engineer/next_best_action', { ticket_id: ticketId });
      setActions(res.data?.data?.actions || []);
      setFetched(true);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [ticketId, loading]);

  if (!fetched && !loading) {
    return (
      <div style={{ padding: '12px 0' }}>
        <button className="ai-assist-btn" onClick={load}>
          <SparklesIcon size={14} /> Analyse & Recommend
        </button>
        <p style={{ color: '#9ca3af', fontSize: 12, marginTop: 8 }}>
          Rule-based recommendations: SLA, assignment, escalation, follow-up.
        </p>
      </div>
    );
  }

  if (loading) return <p style={{ color: '#6b7280', fontStyle: 'italic', fontSize: 13 }}>Analysing ticket…</p>;
  if (error)   return <p style={{ color: '#dc2626', fontSize: 13 }}>{error}</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: '#6b7280' }}>{actions.length} recommendation{actions.length !== 1 ? 's' : ''}</span>
        <button className="ai-assist-btn-secondary" onClick={() => { setActions([]); setFetched(false); }}>
          Refresh
        </button>
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {actions.map((a, i) => (
          <li key={i} style={{
            background: '#f9fafb', border: `1px solid #e5e7eb`,
            borderLeft: `4px solid ${PRIORITY_COLORS[a.priority] || '#9ca3af'}`,
            borderRadius: 6, padding: '8px 12px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{a.label}</span>
              <span style={{
                fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                color: PRIORITY_COLORS[a.priority] || '#9ca3af',
                background: `${PRIORITY_COLORS[a.priority]}1a`,
                padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap',
              }}>{a.priority}</span>
            </div>
            <p style={{ fontSize: 12, color: '#6b7280', margin: '3px 0 0' }}>{a.reason}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─────────────────────────────────────────────────
// Main Component: AIAssistPanel
// ─────────────────────────────────────────────────
const TABS = [
  { id: 'summary', label: 'Summary' },
  { id: 'draft',   label: 'Draft Reply' },
  { id: 'actions', label: 'Next Actions' },
];

export default function AIAssistPanel({ ticketId, onUseDraft }) {
  const [open, setOpen]         = useState(false);
  const [activeTab, setActiveTab] = useState('summary');

  return (
    <div className="td-card ai-assist-panel">
      {/* ── HEADER ── */}
      <button
        className="ai-assist-header"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SparklesIcon size={16} style={{ color: '#7c3aed' }} />
          <span style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>AI Assist</span>
          <span style={{
            fontSize: 10, background: '#ede9fe', color: '#7c3aed',
            padding: '1px 6px', borderRadius: 10, fontWeight: 600,
          }}>Engineer</span>
        </div>
        {open
          ? <ChevronUpIcon   size={16} style={{ color: '#9ca3af' }} />
          : <ChevronDownIcon size={16} style={{ color: '#9ca3af' }} />}
      </button>

      {/* ── BODY ── */}
      {open && (
        <div style={{ padding: '0 16px 16px' }}>
          {/* Tab bar */}
          <div style={{
            display: 'flex', borderBottom: '2px solid #f3f4f6', marginBottom: 12,
          }}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '6px 12px', fontSize: 13, fontWeight: activeTab === tab.id ? 600 : 400,
                  color: activeTab === tab.id ? '#7c3aed' : '#6b7280',
                  borderBottom: activeTab === tab.id ? '2px solid #7c3aed' : '2px solid transparent',
                  background: 'none', border: 'none', cursor: 'pointer', marginBottom: -2,
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab body */}
          {activeTab === 'summary' && <SummaryTab ticketId={ticketId} />}
          {activeTab === 'draft'   && <DraftReplyTab ticketId={ticketId} onUseDraft={onUseDraft} />}
          {activeTab === 'actions' && <ActionsTab ticketId={ticketId} />}
        </div>
      )}

      <style>{`
        .ai-assist-header {
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: none;
          border: none;
          cursor: pointer;
          border-radius: inherit;
        }
        .ai-assist-header:hover { background: #faf5ff; }

        .ai-assist-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          background: linear-gradient(135deg, #7c3aed, #6d28d9);
          color: #fff;
          font-size: 13px;
          font-weight: 500;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: opacity 0.15s;
        }
        .ai-assist-btn:hover { opacity: 0.9; }
        .ai-assist-btn--success {
          background: linear-gradient(135deg, #16a34a, #15803d) !important;
        }

        .ai-assist-btn-secondary {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          background: #f3f4f6;
          color: #374151;
          font-size: 12px;
          border: 1px solid #e5e7eb;
          border-radius: 5px;
          cursor: pointer;
        }
        .ai-assist-btn-secondary:hover { background: #e5e7eb; }
      `}</style>
    </div>
  );
}

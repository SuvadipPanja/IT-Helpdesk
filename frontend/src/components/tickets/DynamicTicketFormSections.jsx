// ============================================================
// DYNAMIC TICKET FORM SECTIONS
// Shows category-specific guidance, hints, subject templates,
// and AI-powered quick solutions when subject + category exist.
// ============================================================

import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Lightbulb, ChevronDown, ChevronUp, Zap, CheckSquare, Sparkles, Loader, AlertCircle } from 'lucide-react';
import { getCategorySchema, resolveGuidanceTemplate } from '../../data/ticketFormSchemas';
import api from '../../services/api';

// ============================================================
// STYLES (inline — no extra CSS file needed)
// ============================================================
const styles = {
  container: {
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    overflow: 'hidden',
    marginBottom: '16px',
    background: '#fff',
  },
  urgentContainer: {
    border: '1px solid #fca5a5',
    borderRadius: '8px',
    overflow: 'hidden',
    marginBottom: '16px',
    background: '#fff5f5',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    background: '#f8fafc',
    borderBottom: '1px solid #e5e7eb',
    cursor: 'pointer',
    userSelect: 'none',
  },
  urgentHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    background: '#fee2e2',
    borderBottom: '1px solid #fca5a5',
    cursor: 'pointer',
    userSelect: 'none',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    fontWeight: 600,
    color: '#374151',
  },
  urgentHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    fontWeight: 600,
    color: '#dc2626',
  },
  body: {
    padding: '14px',
  },
  section: {
    marginBottom: '14px',
  },
  sectionTitle: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  hintList: {
    margin: 0,
    paddingLeft: '18px',
  },
  hintItem: {
    fontSize: '13px',
    color: '#4b5563',
    marginBottom: '4px',
    lineHeight: 1.5,
  },
  templatesGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  templateBtn: {
    background: 'none',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    padding: '6px 10px',
    fontSize: '12px',
    color: '#374151',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.15s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  checklistGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  checklistItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: '#4b5563',
  },
  checkbox: {
    width: '16px',
    height: '16px',
    cursor: 'pointer',
    accentColor: '#3b82f6',
  },
  urgentBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    background: '#dc2626',
    color: '#fff',
    fontSize: '11px',
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  // AI Suggestions
  aiSection: {
    marginBottom: '14px',
    padding: '12px',
    background: 'linear-gradient(135deg, #f0f9ff 0%, #ede9fe 100%)',
    borderRadius: '8px',
    border: '1px solid #c7d2fe',
  },
  aiHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#4338ca',
    marginBottom: '10px',
  },
  aiBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
    background: '#6366f1',
    color: '#fff',
    fontSize: '10px',
    fontWeight: 700,
    padding: '1px 6px',
    borderRadius: '10px',
    letterSpacing: '0.03em',
  },
  aiCard: {
    background: '#fff',
    border: '1px solid #e0e7ff',
    borderRadius: '6px',
    padding: '10px 12px',
    marginBottom: '6px',
    transition: 'border-color 0.15s',
  },
  aiCardTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#1e1b4b',
    marginBottom: '4px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  aiCardSteps: {
    fontSize: '12px',
    color: '#4b5563',
    lineHeight: 1.5,
    margin: 0,
  },
  aiLoading: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    color: '#6366f1',
    padding: '4px 0',
  },
  aiSpinner: {
    animation: 'spin 1s linear infinite',
  },
  aiFallbackNote: {
    fontSize: '11px',
    color: '#6b7280',
    marginTop: '6px',
    fontStyle: 'italic',
  },
  showAllBtn: {
    background: 'none',
    border: 'none',
    padding: '4px 0',
    marginTop: '4px',
    fontSize: '11px',
    color: '#6366f1',
    cursor: 'pointer',
    fontWeight: 500,
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
  },
};

// ============================================================
// AI SUGGESTIONS HOOK
// ============================================================
const AI_DEBOUNCE_MS = 800;
const FALLBACK_TIMEOUT_MS = 10000;

function useAiSuggestions(subject, categoryName) {
  const [suggestions, setSuggestions] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSource, setAiSource] = useState(null); // 'ai' | 'fallback' | null
  const timerRef = useRef(null);
  const abortRef = useRef(null);
  const lastKeyRef = useRef('');

  const fetchSuggestions = useCallback(() => {
    const subj = (subject || '').trim();
    const cat = (categoryName || '').trim();
    const key = `${subj}||${cat}`;

    if (subj.length < 5 || !cat) {
      setSuggestions([]);
      setAiSource(null);
      setAiLoading(false);
      return;
    }

    if (key === lastKeyRef.current) return;

    // Cancel any in-flight request
    if (abortRef.current) abortRef.current.abort();

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      lastKeyRef.current = key;
      setAiLoading(true);
      setAiSource(null);

      const controller = new AbortController();
      abortRef.current = controller;

      // Client-side timeout as safety net
      const clientTimeout = setTimeout(() => controller.abort(), FALLBACK_TIMEOUT_MS);

      try {
        const res = await api.post('/ai/ticket-suggestions', {
          subject: subj,
          category: cat,
        }, { signal: controller.signal });

        clearTimeout(clientTimeout);

        if (res.data?.success && res.data.data?.suggestions?.length > 0) {
          setSuggestions(res.data.data.suggestions);
          setAiSource(res.data.source || 'ai');
        } else {
          setSuggestions([]);
          setAiSource('fallback');
        }
      } catch (err) {
        clearTimeout(clientTimeout);
        if (err.name !== 'AbortError' && err.code !== 'ERR_CANCELED') {
          setSuggestions([]);
          setAiSource('fallback');
        }
      } finally {
        setAiLoading(false);
      }
    }, AI_DEBOUNCE_MS);
  }, [subject, categoryName]);

  useEffect(() => {
    fetchSuggestions();
    return () => {
      clearTimeout(timerRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchSuggestions]);

  return { suggestions, aiLoading, aiSource };
}

// ============================================================
// TEMPLATE RELEVANCE SCORING
// Scores a template against the user's typed subject text.
// Returns 0 (no match) to 100 (exact match).
// ============================================================
function scoreTemplate(template, subjectText) {
  if (!subjectText || subjectText.length < 2) return 50; // no input → neutral score, show all
  const input = subjectText.toLowerCase().trim();
  const label = (template.label || '').toLowerCase();
  const resolved = (template.resolvedText || '').toLowerCase();

  // Exact match with resolved text → already selected
  if (input === resolved) return 100;
  // Starts with same text
  if (resolved.startsWith(input) || label.startsWith(input)) return 90;

  // Extract meaningful keywords (3+ chars, skip noise words)
  const noise = new Set(['the', 'for', 'and', 'not', 'can', 'has', 'was', 'are', 'but', 'its', 'with', 'this', 'that', 'from']);
  const inputWords = input.split(/[\s\-/,.:;]+/).filter(w => w.length >= 2 && !noise.has(w));
  if (inputWords.length === 0) return 50;

  const target = `${label} ${resolved}`;
  let matched = 0;
  for (const word of inputWords) {
    if (target.includes(word)) matched++;
  }

  const ratio = matched / inputWords.length;
  if (ratio >= 0.8) return 85;
  if (ratio >= 0.5) return 70;
  if (ratio >= 0.25) return 55;
  if (matched >= 1) return 40;
  return 0;
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function DynamicTicketFormSections({ categoryCode, categoryName, subject, onSubjectTemplate, templateContext = {}, value = {}, onChange }) {
  const [open, setOpen] = useState(true);
  const [hoveredTemplate, setHoveredTemplate] = useState(null);
  const [showAllTemplates, setShowAllTemplates] = useState(false);

  // Reset "show all" when category changes
  useEffect(() => { setShowAllTemplates(false); }, [categoryCode]);

  const { suggestions, aiLoading, aiSource } = useAiSuggestions(subject, categoryName);

  if (!categoryCode) return null;

  const schema = getCategorySchema(categoryCode);
  const isUrgent = schema.urgent === true;
  const containerStyle = isUrgent ? styles.urgentContainer : styles.container;
  const headerStyle = isUrgent ? styles.urgentHeader : styles.header;
  const headerLeftStyle = isUrgent ? styles.urgentHeaderLeft : styles.headerLeft;
  const checkedItems = value.checklist || {};
  const selectedTemplateId = value.selectedTemplateId || '';

  const templates = useMemo(
    () => (schema.subjectTemplates || []).map((template) => ({
      ...template,
      resolvedText: resolveGuidanceTemplate(template.template, templateContext),
    })),
    [schema.subjectTemplates, templateContext]
  );

  // Score and sort templates by relevance to the typed subject
  const subjectTrimmed = (subject || '').trim();
  const hasSubjectInput = subjectTrimmed.length >= 2;
  const isSubjectFromTemplate = value.subjectAutoFilled === true;

  const scoredTemplates = useMemo(() => {
    const scored = templates.map(t => ({
      ...t,
      score: scoreTemplate(t, subjectTrimmed),
    }));
    // Sort: selected first, then by score descending
    scored.sort((a, b) => {
      if (a.id === selectedTemplateId) return -1;
      if (b.id === selectedTemplateId) return 1;
      return b.score - a.score;
    });
    return scored;
  }, [templates, subjectTrimmed, selectedTemplateId]);

  const relevantTemplates = useMemo(() => {
    if (!hasSubjectInput || showAllTemplates) return scoredTemplates;
    // Show templates with score >= 40 (at least one keyword matched)
    const filtered = scoredTemplates.filter(t => t.score >= 40 || t.id === selectedTemplateId);
    // If nothing matched, show top 3 as suggestions
    return filtered.length > 0 ? filtered : scoredTemplates.slice(0, 3);
  }, [scoredTemplates, hasSubjectInput, showAllTemplates, selectedTemplateId]);

  const hiddenCount = scoredTemplates.length - relevantTemplates.length;

  const toggleCheck = (idx) => {
    if (!onChange) return;
    onChange({
      ...value,
      checklist: {
        ...checkedItems,
        [idx]: !checkedItems[idx],
      },
    });
  };

  const handleTemplateClick = (template) => {
    if (onSubjectTemplate) {
      onSubjectTemplate(template);
    }
    setShowAllTemplates(false);
    onChange?.({
      ...value,
      selectedTemplateId: template.id,
      selectedTemplateLabel: template.label,
      selectedTemplateText: template.resolvedText,
      subjectAutoFilled: true,
    });
  };

  return (
    <div style={containerStyle} role="region" aria-label="Category guidance">
      {/* Header */}
      <div
        style={headerStyle}
        onClick={() => setOpen((o) => !o)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setOpen((o) => !o); }}
        aria-expanded={open}
      >
        <span style={headerLeftStyle}>
          <Lightbulb size={15} />
          <span>{schema.icon} Guidance for this category</span>
          {isUrgent && (
            <span style={styles.urgentBadge}>
              <Zap size={10} /> URGENT
            </span>
          )}
        </span>
        {open ? <ChevronUp size={15} color="#9ca3af" /> : <ChevronDown size={15} color="#9ca3af" />}
      </div>

      {/* Body */}
      {open && (
        <div style={styles.body}>
          {/* AI-Powered Quick Solutions */}
          {subject && subject.trim().length >= 5 && (
            <div style={styles.aiSection}>
              <div style={styles.aiHeader}>
                <Sparkles size={14} />
                <span>Quick solutions — try these before submitting</span>
                <span style={styles.aiBadge}>
                  <Sparkles size={9} /> AI
                </span>
              </div>

              {aiLoading && (
                <div style={styles.aiLoading}>
                  <Loader size={14} style={styles.aiSpinner} />
                  <span>Analyzing your issue…</span>
                </div>
              )}

              {!aiLoading && suggestions.length > 0 && suggestions.map((s, i) => (
                <div key={i} style={styles.aiCard}>
                  <div style={styles.aiCardTitle}>
                    <span>{['💡', '🔧', '⚡', '🛠️'][i] || '💡'}</span>
                    {s.title}
                  </div>
                  <p style={styles.aiCardSteps}>{s.steps}</p>
                </div>
              ))}

              {!aiLoading && aiSource === 'fallback' && (
                <div style={{ ...styles.aiCard, background: '#fefce8', borderColor: '#fde68a' }}>
                  <div style={styles.aiCardTitle}>
                    <AlertCircle size={14} color="#d97706" />
                    <span style={{ color: '#92400e' }}>General tips for this category</span>
                  </div>
                  <p style={styles.aiCardSteps}>
                    {schema.hints?.[0] || 'Please provide as much detail as possible in the description to help our team resolve your issue quickly.'}
                  </p>
                </div>
              )}

              {!aiLoading && suggestions.length > 0 && (
                <div style={styles.aiFallbackNote}>
                  If none of these help, go ahead and submit the ticket below.
                </div>
              )}
            </div>
          )}

          {/* Hints */}
          {schema.hints?.length > 0 && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>
                <Lightbulb size={12} /> Tips
              </div>
              <ul style={styles.hintList}>
                {schema.hints.map((h, i) => (
                  <li key={i} style={styles.hintItem}>{h}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Subject Templates */}
          {onSubjectTemplate && schema.subjectTemplates?.length > 0 && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>
                <Zap size={12} />
                {hasSubjectInput && !showAllTemplates
                  ? `Matching templates${hiddenCount > 0 ? ` (${relevantTemplates.length} of ${scoredTemplates.length})` : ''}`
                  : 'Quick subject templates — click to use'}
              </div>
              <div style={styles.templatesGrid}>
                {relevantTemplates.map((t, i) => {
                  const isSelected = selectedTemplateId === t.id;
                  const isHovered = hoveredTemplate === (t.id || i);
                  const isLowRelevance = hasSubjectInput && t.score < 40 && !isSelected;
                  return (
                    <button
                      key={t.id || i}
                      type="button"
                      style={{
                        ...styles.templateBtn,
                        background: isSelected ? '#dbeafe' : isHovered ? '#f0f9ff' : 'none',
                        borderColor: isSelected ? '#2563eb' : isHovered ? '#3b82f6' : '#d1d5db',
                        color: isSelected ? '#1d4ed8' : isHovered ? '#1d4ed8' : isLowRelevance ? '#9ca3af' : '#374151',
                        opacity: isLowRelevance ? 0.6 : 1,
                      }}
                      onClick={() => handleTemplateClick(t)}
                      onMouseEnter={() => setHoveredTemplate(t.id || i)}
                      onMouseLeave={() => setHoveredTemplate(null)}
                      aria-label={`Use subject template: ${t.resolvedText}`}
                    >
                      {isSelected ? <CheckSquare size={11} color="#2563eb" /> : <Zap size={11} />}
                      {t.resolvedText}
                      {isSelected && (
                        <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#2563eb', fontWeight: 600 }}>Selected</span>
                      )}
                    </button>
                  );
                })}
              </div>
              {hasSubjectInput && hiddenCount > 0 && !showAllTemplates && (
                <button
                  type="button"
                  onClick={() => setShowAllTemplates(true)}
                  style={styles.showAllBtn}
                >
                  Show all {scoredTemplates.length} templates
                </button>
              )}
              {showAllTemplates && hasSubjectInput && (
                <button
                  type="button"
                  onClick={() => setShowAllTemplates(false)}
                  style={styles.showAllBtn}
                >
                  Show only matching
                </button>
              )}
            </div>
          )}

          {/* Pre-submission checklist */}
          {schema.checklist?.length > 0 && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>
                <CheckSquare size={12} /> Before you submit — check these first
              </div>
              <div style={styles.checklistGrid}>
                {schema.checklist.map((item, i) => {
                  const checklistId = `check_${i + 1}`;
                  return (
                  <label key={i} style={styles.checklistItem}>
                    <input
                      type="checkbox"
                      style={styles.checkbox}
                      checked={!!checkedItems[checklistId]}
                      onChange={() => toggleCheck(checklistId)}
                      aria-label={item}
                    />
                    <span style={{ textDecoration: checkedItems[checklistId] ? 'line-through' : 'none', color: checkedItems[checklistId] ? '#9ca3af' : '#4b5563' }}>
                      {item}
                    </span>
                  </label>
                );})}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

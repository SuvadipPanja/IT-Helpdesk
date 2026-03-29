// ============================================================
// DYNAMIC TICKET FORM SECTIONS
// Shows category-specific guidance, hints, and subject templates
// when a category is selected in the ticket creation form.
// ============================================================

import { useMemo, useState } from 'react';
import { Lightbulb, ChevronDown, ChevronUp, Zap, CheckSquare } from 'lucide-react';
import { getCategorySchema, resolveGuidanceTemplate } from '../../data/ticketFormSchemas';

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
};

// ============================================================
// MAIN COMPONENT
// ============================================================
export default function DynamicTicketFormSections({ categoryCode, onSubjectTemplate, templateContext = {}, value = {}, onChange }) {
  const [open, setOpen] = useState(true);
  const [hoveredTemplate, setHoveredTemplate] = useState(null);

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
                <Zap size={12} /> Quick subject templates — click to use
              </div>
              <div style={styles.templatesGrid}>
                {templates.map((t, i) => (
                  <button
                    key={t.id || i}
                    type="button"
                    style={{
                      ...styles.templateBtn,
                      background: selectedTemplateId === t.id ? '#dbeafe' : hoveredTemplate === i ? '#f0f9ff' : 'none',
                      borderColor: selectedTemplateId === t.id ? '#2563eb' : hoveredTemplate === i ? '#3b82f6' : '#d1d5db',
                      color: selectedTemplateId === t.id ? '#1d4ed8' : hoveredTemplate === i ? '#1d4ed8' : '#374151',
                    }}
                    onClick={() => handleTemplateClick(t)}
                    onMouseEnter={() => setHoveredTemplate(i)}
                    onMouseLeave={() => setHoveredTemplate(null)}
                    aria-label={`Use subject template: ${t.resolvedText}`}
                  >
                    <Zap size={11} />
                    {t.resolvedText}
                  </button>
                ))}
              </div>
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

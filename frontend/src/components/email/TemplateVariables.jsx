// ============================================
// TEMPLATE VARIABLES — Merge tags + snippets
// Loads catalog from API when possible; supports search & quick HTML blocks.
// ============================================

import React, { useState, useEffect, useMemo } from 'react';
import { Copy, Check, ChevronDown, ChevronUp, Search, Sparkles, LayoutTemplate } from 'lucide-react';
import emailTemplatesService from '../../services/emailTemplates.service';

const FALLBACK_CATEGORIES = {
  brand: {
    label: 'Brand & system (from Settings)',
    color: '#059669',
    hint: 'Values come from Settings → Appearance / General and server config.',
    variables: [
      { key: 'system_name', label: 'App / product name', example: 'Nexus Support' },
      { key: 'company_name', label: 'Company name', example: 'Acme Corp' },
      { key: 'system_title', label: 'Long title', example: 'Nexus Support Desk' },
      { key: 'logo_url', label: 'Logo URL', example: '/uploads/logo.png' },
      { key: 'system_url', label: 'Public site URL', example: 'https://helpdesk.example.com' },
      { key: 'app_url', label: 'Same as system_url', example: 'https://...' },
      { key: 'support_email', label: 'Support email', example: 'support@company.com' },
      { key: 'email_footer_disclaimer', label: 'Pre-built footer sentence', example: 'This email was sent by…' },
      { key: 'current_year', label: 'Year', example: '2026' },
      { key: 'current_date', label: 'Today (ISO)', example: '2026-03-12' },
    ],
  },
  ticket: {
    label: 'Ticket',
    color: '#3b82f6',
    variables: [
      { key: 'ticket_id', label: 'Ticket ID', example: '123' },
      { key: 'ticket_number', label: 'Ticket #', example: 'TKT-2025-001' },
      { key: 'subject', label: 'Subject', example: 'Cannot access email' },
      { key: 'ticket_title', label: 'Title (alias)', example: 'Cannot access email' },
      { key: 'ticket_description', label: 'Description', example: '...' },
      { key: 'ticket_priority', label: 'Priority', example: 'High' },
      { key: 'ticket_status', label: 'Status', example: 'Open' },
      { key: 'ticket_category', label: 'Category', example: 'Email' },
      { key: 'category_name', label: 'Category (alias)', example: 'Hardware' },
      { key: 'priority_name', label: 'Priority (alias)', example: 'High' },
      { key: 'status_name', label: 'Status name', example: 'Open' },
      { key: 'ticket_url', label: 'Ticket URL', example: 'https://.../tickets/123' },
    ],
  },
  people: {
    label: 'People',
    color: '#8b5cf6',
    variables: [
      { key: 'user_name', label: 'User name', example: 'John Doe' },
      { key: 'user_email', label: 'User email', example: 'john@x.com' },
      { key: 'assigned_to_name', label: 'Assigned to', example: 'Jane' },
      { key: 'assigned_to_email', label: 'Assignee email', example: 'jane@x.com' },
      { key: 'created_by_name', label: 'Created by', example: 'Admin' },
    ],
  },
  dates: {
    label: 'Dates',
    color: '#f59e0b',
    variables: [
      { key: 'created_date', label: 'Created', example: '2026-03-12 10:00' },
      { key: 'updated_date', label: 'Updated', example: '2026-03-12 11:00' },
      { key: 'current_date', label: 'Current date', example: '2026-03-12' },
      { key: 'due_date', label: 'SLA due', example: '2026-03-15' },
    ],
  },
  approvals: {
    label: 'Ticket approvals',
    color: '#ea580c',
    hint: 'Approval request / granted / rejected emails.',
    variables: [
      { key: 'approver_name', label: 'Approver name', example: 'Manager' },
      { key: 'engineer_name', label: 'Engineer (requester)', example: 'Jane' },
      { key: 'approval_note', label: 'Reason for approval', example: '…' },
      { key: 'decision_note', label: 'Approver comment', example: '…' },
      { key: 'decided_at', label: 'Decision time', example: '2026-03-12 15:00' },
      { key: 'recipient_name', label: 'Greeting name', example: 'John' },
      { key: 'priority', label: 'Priority', example: 'High' },
      { key: 'department', label: 'Department', example: 'IT' },
    ],
  },
  email_safe: {
    label: 'Email-safe symbols (HTML)',
    color: '#64748b',
    hint: 'Inserts small HTML snippets—renders in Outlook/Gmail. Prefer these over emoji in professional mail.',
    variables: [
      { key: '<span style="color:#f59e0b;font-weight:700">&#9888;</span> ', label: 'Warning (orange)', isRaw: true },
      { key: '<span style="color:#059669;font-weight:700">&#10003;</span> ', label: 'Check mark (green)', isRaw: true },
      { key: '<span style="color:#dc2626;font-weight:700">&#10007;</span> ', label: 'Cross mark (red)', isRaw: true },
      { key: '<span style="color:#eab308">&#9733;</span> ', label: 'Star', isRaw: true },
      { key: '&mdash; ', label: 'Em dash', isRaw: true },
      { key: '&bull; ', label: 'Bullet', isRaw: true },
    ],
  },
};

/** Reusable HTML blocks — pasted as HTML so the rich editor shows layout, not raw code */
const QUICK_BLOCKS = [
  {
    id: 'header_logo',
    label: 'Header + logo',
    html: `<p style="text-align:center;margin:0 0 16px;"><img src="{{logo_url}}" alt="{{company_name}}" style="max-height:48px;" /></p>\n<h2 style="color:#111827;text-align:center;margin:0;">{{system_name}}</h2>\n`,
  },
  {
    id: 'footer_brand',
    label: 'Footer (brand)',
    html: `<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />\n<p style="color:#6b7280;font-size:12px;text-align:center;margin:0;">{{email_footer_disclaimer}}</p>\n<p style="color:#9ca3af;font-size:11px;text-align:center;margin:8px 0 0;">© {{current_year}} {{company_name}} · <a href="{{system_url}}" style="color:#6b7280;">{{system_url}}</a></p>\n`,
  },
  {
    id: 'button_primary',
    label: 'Button (uses ticket_url)',
    html: `<p style="text-align:center;margin:24px 0;"><a href="{{ticket_url}}" style="background:#4f46e5;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">View ticket</a></p>\n`,
  },
  {
    id: 'button_system',
    label: 'Button (portal)',
    html: `<p style="text-align:center;margin:24px 0;"><a href="{{system_url}}" style="background:#0f766e;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">Open portal</a></p>\n`,
  },
  {
    id: 'callout_info',
    label: 'Info callout',
    html: `<div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:14px 18px;margin:16px 0;border-radius:0 8px 8px 0;"><p style="margin:0;color:#1e3a8a;font-size:14px;"><strong>Note:</strong> Replace this text. Merge tags work here: {{ticket_number}}</p></div>\n`,
  },
  {
    id: 'callout_warn',
    label: 'Warning callout',
    html: `<div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:14px 18px;margin:16px 0;border-radius:0 8px 8px 0;"><p style="margin:0;color:#92400e;font-size:14px;"><strong>Important:</strong> Your message here.</p></div>\n`,
  },
  {
    id: 'ticket_summary_table',
    label: 'Ticket summary (table)',
    html: `<table style="width:100%;border-collapse:collapse;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin:16px 0;"><tr><td style="padding:8px 12px;color:#6b7280;font-size:13px;width:38%;">Ticket</td><td style="padding:8px 12px;font-weight:600;">#{{ticket_number}}</td></tr><tr><td style="padding:8px 12px;color:#6b7280;font-size:13px;">Subject</td><td style="padding:8px 12px;">{{subject}}</td></tr><tr><td style="padding:8px 12px;color:#6b7280;font-size:13px;">Priority</td><td style="padding:8px 12px;">{{ticket_priority}}</td></tr></table>\n`,
  },
  {
    id: 'divider',
    label: 'Divider',
    html: `<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />\n`,
  },
];

const TemplateVariables = ({ onInsert }) => {
  const [copiedVariable, setCopiedVariable] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState([
    'brand', 'ticket', 'people', 'dates', 'approvals', 'email_safe',
  ]);
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState(FALLBACK_CATEGORIES);
  const [catalogNote, setCatalogNote] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await emailTemplatesService.getMergeTagCatalog();
        if (!res?.success || !res?.data?.categories || cancelled) return;
        const mapped = {};
        const colorFor = (id) => {
          if (id === 'brand') return '#059669';
          if (id === 'ticket') return '#3b82f6';
          if (id === 'approvals') return '#ea580c';
          if (id === 'people') return '#8b5cf6';
          return '#8b5cf6';
        };
        for (const cat of res.data.categories) {
          mapped[cat.id] = {
            label: cat.label,
            color: colorFor(cat.id),
            hint: cat.source === 'database' ? 'Live values in Preview' : 'Provided per email event',
            variables: (cat.variables || []).map((v) => ({
              key: v.key,
              label: v.label,
              example: v.example || '',
            })),
          };
        }
        if (Object.keys(mapped).length) {
          mapped.email_safe = FALLBACK_CATEGORIES.email_safe;
          setCategories({ ...mapped, email_safe: FALLBACK_CATEGORIES.email_safe });
          setCatalogNote(res.data.description);
        }
      } catch {
        /* use fallback */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const toggleCategory = (category) => {
    setExpandedCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  };

  const handleVariableClick = (variableKey, isRaw) => {
    const variableText = isRaw ? variableKey : `{{${variableKey}}}`;
    navigator.clipboard.writeText(variableText).then(() => {
      setCopiedVariable(variableText);
      setTimeout(() => setCopiedVariable(null), 2000);
    }).catch(() => setCopiedVariable(null));

    if (onInsert) onInsert(variableText);
  };

  const handleBlockClick = (html) => {
    if (onInsert) onInsert(html);
  };

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    const out = {};
    Object.entries(categories).forEach(([key, cat]) => {
      if (!q) {
        out[key] = cat;
        return;
      }
      const vars = (cat.variables || []).filter(
        (v) =>
          v.key.toLowerCase().includes(q) ||
          (v.label && v.label.toLowerCase().includes(q))
      );
      if (vars.length) out[key] = { ...cat, variables: vars };
    });
    return out;
  }, [categories, search]);

  return (
    <div className="template-variables-panel" style={{
      backgroundColor: '#f9fafb',
      border: '1px solid #e5e7eb',
      borderRadius: '0.5rem',
      padding: '1rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <Sparkles style={{ width: '1rem', height: '1rem', color: '#6366f1' }} />
        <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#374151', margin: 0 }}>
          Merge tags & snippets
        </h4>
      </div>
      <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.75rem', marginTop: 0 }}>
        Use <code style={{ background: '#eef2ff', padding: '0 4px', borderRadius: 4 }}>{'{{name}}'}</code> for dynamic fields.
        Brand fields are filled from <strong>Settings</strong> (system name, company, logo) and <strong>APP_PUBLIC_URL</strong>.
        {catalogNote && (
          <span style={{ display: 'block', marginTop: 6 }}>{catalogNote}</span>
        )}
      </p>

      <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
        <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: '#9ca3af' }} />
        <input
          type="search"
          placeholder="Search variables..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px 8px 36px',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            fontSize: 13,
          }}
        />
      </div>

      {/* Quick layout blocks */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <LayoutTemplate style={{ width: 14, height: 14, color: '#64748b' }} />
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>Quick layout blocks</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {QUICK_BLOCKS.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => handleBlockClick(b.html)}
              style={{
                fontSize: '0.75rem',
                padding: '6px 10px',
                background: '#fff',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                cursor: 'pointer',
                color: '#334155',
              }}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {Object.entries(filteredEntries).map(([categoryKey, category]) => (
        <div key={categoryKey} style={{ marginBottom: '0.75rem' }}>
          <button
            type="button"
            onClick={() => toggleCategory(categoryKey)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.5rem 0.75rem',
              backgroundColor: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '0.375rem',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div
                style={{
                  width: '0.75rem',
                  height: '0.75rem',
                  backgroundColor: category.color || '#64748b',
                  borderRadius: '50%',
                }}
              />
              <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#111827' }}>
                {category.label}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#6b7280', background: '#f3f4f6', padding: '2px 8px', borderRadius: 999 }}>
                {category.variables?.length || 0}
              </span>
            </div>
            {expandedCategories.includes(categoryKey) ? (
              <ChevronUp style={{ width: '1rem', height: '1rem', color: '#6b7280' }} />
            ) : (
              <ChevronDown style={{ width: '1rem', height: '1rem', color: '#6b7280' }} />
            )}
          </button>

          {category.hint && expandedCategories.includes(categoryKey) && (
            <p style={{ fontSize: '0.65rem', color: '#94a3b8', margin: '6px 0 0 8px' }}>{category.hint}</p>
          )}

          {expandedCategories.includes(categoryKey) && category.variables && (
            <div
              style={{
                marginTop: '0.5rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '0.5rem',
              }}
            >
              {category.variables.map((variable) => {
                const raw = variable.isRaw;
                const displayKey = raw ? variable.key : variable.key;
                const copyKey = raw ? variable.key : variable.key;
                return (
                  <button
                    key={`${categoryKey}-${displayKey}`}
                    type="button"
                    onClick={() => handleVariableClick(copyKey, raw)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.5rem',
                      backgroundColor: '#ffffff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                    title={variable.example ? `e.g. ${variable.example}` : undefined}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 500, color: '#111827', marginBottom: '0.125rem' }}>
                        {variable.label}
                      </div>
                      <div
                        style={{
                          fontSize: '0.625rem',
                          color: '#6b7280',
                          fontFamily: 'monospace',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {raw ? displayKey : `{{${variable.key}}}`}
                      </div>
                    </div>
                    {copiedVariable === (raw ? variable.key : `{{${variable.key}}}`) ? (
                      <Check style={{ width: '1rem', height: '1rem', color: '#10b981', flexShrink: 0 }} />
                    ) : (
                      <Copy style={{ width: '1rem', height: '1rem', color: '#9ca3af', flexShrink: 0 }} />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}

      {Object.keys(filteredEntries).length === 0 && (
        <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>No variables match “{search}”.</p>
      )}
    </div>
  );
};

export default TemplateVariables;

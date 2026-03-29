import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileSpreadsheet,
  Calendar,
  Filter,
  Play,
  Download,
  Table2,
  Route,
  Building2,
  MapPin,
  Users,
  Layers,
  Loader,
  Sparkles,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Shield,
  KeyRound,
  Bot,
  Search,
  LayoutGrid,
  ScrollText,
  FileText,
  Tag,
  AlertCircle,
  BookOpen,
  TrendingUp,
  AlertTriangle,
  Megaphone,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import api from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { downloadCsv } from '../../utils/reportsCsv';
import { formatReportCell } from '../../utils/dateUtils';
import '../../styles/ReportsHub.css';

const GROUPS = [
  { id: 'tickets', label: 'Tickets & volumes', blurb: 'Master lists, full journey, breakdowns' },
  { id: 'access', label: 'Access & security', blurb: 'Sessions, logins, audit trail' },
  { id: 'bot', label: 'Bot & AI', blurb: 'Assistant sessions and messages' },
  { id: 'knowledge', label: 'Knowledge base', blurb: 'Article views, search activity' },
  { id: 'outage', label: 'Outage notifications', blurb: 'Service outages, audit, overview' },
];

const REPORT_TYPES = [
  {
    id: 'ticket_master',
    group: 'tickets',
    title: 'Ticket master',
    desc: 'Full ticket row: status, priority, dept, location, team, assignee, SLA.',
    icon: Table2,
    color: '#4f46e5',
  },
  {
    id: 'ticket_journey',
    group: 'tickets',
    title: 'Ticket journey',
    desc: 'Default: one row per ticket with a readable timeline. Optional: every event on its own row.',
    icon: Route,
    color: '#059669',
  },
  {
    id: 'summary_department',
    group: 'tickets',
    title: 'Volume by department',
    desc: 'Open / closed counts per department.',
    icon: Building2,
    color: '#d97706',
  },
  {
    id: 'summary_location',
    group: 'tickets',
    title: 'Volume by location',
    desc: 'Ticket counts per site or office.',
    icon: MapPin,
    color: '#db2777',
  },
  {
    id: 'summary_team',
    group: 'tickets',
    title: 'Volume by team',
    desc: 'Team bucket snapshot.',
    icon: Users,
    color: '#7c3aed',
  },
  {
    id: 'summary_priority',
    group: 'tickets',
    title: 'Volume by priority',
    desc: 'Distribution across priorities.',
    icon: Layers,
    color: '#dc2626',
  },
  {
    id: 'user_sessions',
    group: 'access',
    title: 'User sessions',
    desc: 'Login time, IP, user-agent, last activity, session state.',
    icon: LayoutGrid,
    color: '#0d9488',
  },
  {
    id: 'login_attempts',
    group: 'access',
    title: 'Login attempts',
    desc: 'Success/fail logins with IP and reason.',
    icon: KeyRound,
    color: '#ea580c',
  },
  {
    id: 'security_audit',
    group: 'access',
    title: 'Security audit log',
    desc: 'LOGIN_SUCCESS, LOGOUT, and other audited actions with IP.',
    icon: Shield,
    color: '#7c2d12',
  },
  {
    id: 'bot_sessions',
    group: 'bot',
    title: 'Bot sessions',
    desc: 'Chat sessions: messages, intents, tickets created, IP.',
    icon: Bot,
    color: '#2563eb',
  },
  {
    id: 'bot_messages',
    group: 'bot',
    title: 'Bot messages',
    desc: 'Every user/bot message with intent and actions.',
    icon: ScrollText,
    color: '#4f46e5',
  },
  {
    id: 'summary_category',
    group: 'tickets',
    title: 'Volume by category',
    desc: 'Ticket counts per issue category with open/closed/escalation breakdown.',
    icon: Tag,
    color: '#0891b2',
  },
  {
    id: 'sla_breach_detail',
    group: 'tickets',
    title: 'SLA breach detail',
    desc: 'Tickets that missed first-response or resolution SLA targets with breach details.',
    icon: AlertCircle,
    color: '#dc2626',
  },
  {
    id: 'kb_usage',
    group: 'knowledge',
    title: 'KB article views',
    desc: 'Published articles ranked by views in the date range, with helpful ratings.',
    icon: BookOpen,
    color: '#0891b2',
  },
  {
    id: 'outage_master',
    group: 'outage',
    title: 'Outage master',
    desc: 'All outage notifications: status, severity, audience, views, resolution time.',
    icon: AlertTriangle,
    color: '#ef4444',
  },
  {
    id: 'outage_audit',
    group: 'outage',
    title: 'Outage audit log',
    desc: 'Every action on outage notifications with actor and timestamp.',
    icon: Shield,
    color: '#7c2d12',
  },
  {
    id: 'outage_overview',
    group: 'outage',
    title: 'Outage overview',
    desc: 'Summary by template, status, and severity with averages.',
    icon: Megaphone,
    color: '#f59e0b',
  },
];

const STATUS_OPTIONS = [
  { value: 'all', label: 'All tickets' },
  { value: 'open', label: 'Open only' },
  { value: 'closed', label: 'Closed only' },
];

const JOURNEY_DATE_OPTIONS = [
  { value: 'event', label: 'Events in date range' },
  { value: 'ticket_created', label: 'Tickets created in range (all their events)' },
];

const JOURNEY_MODE_OPTIONS = [
  { value: 'summary', label: 'One row per ticket (recommended)' },
  { value: 'timeline', label: 'One row per event (audit detail)' },
];

function defaultRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30);
  const f = (d) => d.toISOString().slice(0, 10);
  return { start: f(start), end: f(end) };
}

function parseUserIdsFromText(text) {
  if (!text || !String(text).trim()) return [];
  return String(text)
    .split(/[,;\s]+/)
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !Number.isNaN(n) && n > 0);
}

function MultiSelect({ label, options, selected, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const toggle = (id) => {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    onChange([...s]);
  };
  return (
    <div className="rep-ms">
      <button type="button" className="rep-ms-trigger" onClick={() => setOpen(!open)} aria-expanded={open}>
        <Filter size={14} />
        <span>{label}</span>
        <span className="rep-ms-count">{selected.length ? `${selected.length} selected` : placeholder}</span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && (
        <div className="rep-ms-panel">
          {options.map((o) => (
            <label key={o.id} className="rep-ms-item">
              <input type="checkbox" checked={selected.includes(o.id)} onChange={() => toggle(o.id)} />
              <span>{o.name}</span>
            </label>
          ))}
          {options.length === 0 && <div className="rep-ms-empty">No options</div>}
        </div>
      )}
    </div>
  );
}

export default function ReportsHub() {
  const toast = useToast();
  const { start: ds, end: de } = defaultRange();
  const [startDate, setStartDate] = useState(ds);
  const [endDate, setEndDate] = useState(de);
  const [reportGroup, setReportGroup] = useState('tickets');
  const [reportType, setReportType] = useState('ticket_master');
  const [statusScope, setStatusScope] = useState('all');
  const [departmentIds, setDepartmentIds] = useState([]);
  const [locationIds, setLocationIds] = useState([]);
  const [teamIds, setTeamIds] = useState([]);
  const [priorityIds, setPriorityIds] = useState([]);
  const [ticketId, setTicketId] = useState('');
  const [ticketNumber, setTicketNumber] = useState('');
  const [journeyDateScope, setJourneyDateScope] = useState('event');
  const [journeyMode, setJourneyMode] = useState('summary');
  const [pageSize, setPageSize] = useState(200);
  const [userIdsText, setUserIdsText] = useState('');
  const [auditActionsText, setAuditActionsText] = useState('LOGIN_SUCCESS,LOGOUT');
  const [onlyFailures, setOnlyFailures] = useState(false);
  const [tableSearch, setTableSearch] = useState('');

  const [filters, setFilters] = useState({
    departments: [],
    locations: [],
    teams: [],
    priorities: [],
  });
  const [loading, setLoading] = useState(false);
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [rows, setRows] = useState([]);
  const [columns, setColumns] = useState([]);
  const [meta, setMeta] = useState(null);
  const [exportBusy, setExportBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get('/reports/filter-options');
        if (res.data?.success && res.data.data) {
          setFilters({
            departments: (res.data.data.departments || []).map((d) => ({
              id: d.department_id,
              name: d.department_name,
            })),
            locations: (res.data.data.locations || []).map((l) => ({
              id: l.location_id,
              name: l.location_name,
            })),
            teams: (res.data.data.teams || []).map((t) => ({
              id: t.team_id,
              name: t.team_name + (t.team_code ? ` (${t.team_code})` : ''),
            })),
            priorities: (res.data.data.priorities || []).map((p) => ({
              id: p.priority_id,
              name: p.priority_name,
            })),
          });
        }
      } catch {
        toast.error('Could not load filter lists');
      } finally {
        setLoadingFilters(false);
      }
    })();
  }, [toast]);

  const setDatePreset = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    const f = (d) => d.toISOString().slice(0, 10);
    setStartDate(f(start));
    setEndDate(f(end));
  };

  const handleGroupChange = (gid) => {
    setReportGroup(gid);
    const first = REPORT_TYPES.find((r) => r.group === gid);
    if (first) setReportType(first.id);
  };

  const runReport = useCallback(async () => {
    setLoading(true);
    setRows([]);
    setColumns([]);
    setMeta(null);
    setTableSearch('');
    const userIds = parseUserIdsFromText(userIdsText);
    const auditActionTypes = auditActionsText
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const body = {
        reportType,
        startDate,
        endDate,
        statusScope,
        departmentIds,
        locationIds,
        teamIds,
        priorityIds,
        page: 1,
        pageSize,
      };

      if (reportType === 'ticket_journey') {
        if (ticketId.trim()) body.ticketId = parseInt(ticketId, 10);
        if (ticketNumber.trim()) body.ticketNumber = ticketNumber.trim();
        body.journeyDateScope = journeyDateScope;
        body.journeyMode = journeyMode;
      }

      if (['user_sessions', 'login_attempts', 'security_audit', 'bot_sessions', 'bot_messages'].includes(reportType)) {
        if (userIds.length) body.userIds = userIds;
      }
      if (reportType === 'login_attempts') body.onlyFailures = onlyFailures;
      if (reportType === 'security_audit' && auditActionTypes.length) body.auditActionTypes = auditActionTypes;

      const res = await api.post('/reports/run', body);
      if (!res.data?.success) {
        throw new Error(res.data?.message || 'Report failed');
      }
      const payload = res.data.data;
      setRows(payload.rows || []);
      setColumns(payload.columns || []);
      setMeta(payload.meta || {});
      toast.success('Report ready');
    } catch (e) {
      const base = e.response?.data?.message || e.message || 'Failed to run report';
      const sqlHint = e.response?.data?.meta?.sqlMessage;
      const msg = sqlHint ? `${base} — ${sqlHint}` : base;
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [
    reportType,
    startDate,
    endDate,
    statusScope,
    departmentIds,
    locationIds,
    teamIds,
    priorityIds,
    ticketId,
    ticketNumber,
    journeyDateScope,
    journeyMode,
    pageSize,
    userIdsText,
    auditActionsText,
    onlyFailures,
    toast,
  ]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        runReport();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [runReport]);

  const displayRows = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      columns.some((c) => {
        const v = row[c];
        if (v == null) return false;
        return String(v).toLowerCase().includes(q);
      })
    );
  }, [rows, columns, tableSearch]);

  const metaLines = useMemo(() => {
    const lines = [
      `Period: ${startDate} → ${endDate}`,
      `Status: ${STATUS_OPTIONS.find((s) => s.value === statusScope)?.label || statusScope}`,
    ];
    if (departmentIds.length) lines.push(`Departments: ${departmentIds.length} selected`);
    if (locationIds.length) lines.push(`Locations: ${locationIds.length} selected`);
    if (teamIds.length) lines.push(`Teams: ${teamIds.length} selected`);
    if (priorityIds.length) lines.push(`Priorities: ${priorityIds.length} selected`);
    if (meta?.total != null) lines.push(`Rows loaded: ${rows.length} (total ${meta.total})`);
    return lines;
  }, [startDate, endDate, statusScope, departmentIds, locationIds, teamIds, priorityIds, meta, rows.length]);

  const handleExportExcel = async () => {
    if (!rows.length) {
      toast.warning('Run a report first');
      return;
    }
    setExportBusy(true);
    try {
      const { downloadStyledExcel } = await import('../../utils/reportsExportExcel');
      const title = REPORT_TYPES.find((r) => r.id === reportType)?.title || 'Report';
      await downloadStyledExcel({
        reportTitle: `${title} — IT Helpdesk`,
        metaLines,
        columns,
        rows,
        filenameBase: `helpdesk-${reportType}-${startDate}_${endDate}`,
      });
      toast.success('Excel file downloaded');
    } catch (e) {
      toast.error(e.message || 'Export failed');
    } finally {
      setExportBusy(false);
    }
  };

  const handleExportPdf = async () => {
    if (!rows.length) {
      toast.warning('Run a report first');
      return;
    }
    setExportBusy(true);
    try {
      const { downloadReportPdf } = await import('../../utils/reportsExportPdf');
      const title = REPORT_TYPES.find((r) => r.id === reportType)?.title || 'Report';
      await downloadReportPdf({
        reportTitle: `${title} — IT Helpdesk`,
        metaLines,
        columns,
        rows,
        filenameBase: `helpdesk-${reportType}-${startDate}_${endDate}`,
      });
      toast.success('PDF downloaded');
    } catch (e) {
      toast.error(e.message || 'PDF export failed');
    } finally {
      setExportBusy(false);
    }
  };

  const handleExportCsv = () => {
    if (!rows.length) {
      toast.warning('Run a report first');
      return;
    }
    downloadCsv(columns, rows, `helpdesk-${reportType}-${startDate}_${endDate}`);
    toast.success('CSV downloaded');
  };

  const activeReport = REPORT_TYPES.find((r) => r.id === reportType);
  const ticketFiltersVisible = [
    'ticket_master',
    'ticket_journey',
    'summary_department',
    'summary_location',
    'summary_team',
    'summary_priority',
    'summary_category',
    'sla_breach_detail',
  ].includes(reportType);
  const priorityFilterVisible = ticketFiltersVisible;
  const statusVisible = ticketFiltersVisible;
  const journeyExtras = reportType === 'ticket_journey';
  const accessExtras = ['user_sessions', 'login_attempts', 'security_audit'].includes(reportType);
  const botUserFilter = ['bot_sessions', 'bot_messages'].includes(reportType);
  const pagedReports = [
    'ticket_master',
    'ticket_journey',
    'sla_breach_detail',
    'kb_usage',
    'user_sessions',
    'login_attempts',
    'security_audit',
    'bot_sessions',
    'bot_messages',
  ].includes(reportType);

  // Chart colors for summary visualizations
  const CHART_COLORS = ['#4f46e5', '#059669', '#d97706', '#db2777', '#0891b2', '#7c3aed', '#dc2626', '#0d9488'];

  // Whether the current report type renders a summary bar chart visualization
  const isSummaryChart = ['summary_department', 'summary_location', 'summary_team', 'summary_priority', 'summary_category'].includes(reportType);

  return (
    <div className="rep-page">
      <div className="rep-hero">
        <div className="rep-hero-glow" aria-hidden />
        <div className="rep-hero-inner">
          <div className="rep-hero-icon">
            <FileSpreadsheet size={32} />
          </div>
          <div>
            <p className="rep-eyebrow">
              <Sparkles size={14} /> Reports center
            </p>
            <h1>Operational intelligence</h1>
          </div>
        </div>
      </div>

      <div className="rep-tabs" role="tablist" aria-label="Report category">
        {GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            role="tab"
            aria-selected={reportGroup === g.id}
            className={`rep-tab ${reportGroup === g.id ? 'rep-tab--active' : ''}`}
            onClick={() => handleGroupChange(g.id)}
          >
            <span className="rep-tab-label">{g.label}</span>
            <span className="rep-tab-blurb">{g.blurb}</span>
          </button>
        ))}
      </div>

      <section className="rep-section rep-section--types">
        <h2 className="rep-h2">1. Choose report</h2>
        <div className="rep-type-grid">
          {REPORT_TYPES.filter((r) => r.group === reportGroup).map((r, idx) => {
            const Icon = r.icon;
            const active = reportType === r.id;
            return (
              <button
                key={r.id}
                type="button"
                className={`rep-type-card ${active ? 'rep-type-card--active' : ''}`}
                style={{ '--rep-accent': r.color, '--rep-delay': `${idx * 0.04}s` }}
                onClick={() => setReportType(r.id)}
              >
                <div className="rep-type-icon">
                  <Icon size={22} />
                </div>
                <div className="rep-type-text">
                  <strong>{r.title}</strong>
                  <span>{r.desc}</span>
                </div>
                {active && <CheckSquare className="rep-type-check" size={18} />}
              </button>
            );
          })}
        </div>
      </section>

      <section className="rep-section rep-panel">
        <h2 className="rep-h2">2. Filters &amp; run</h2>
        <div className="rep-filters">
          <div className="rep-row rep-row--presets">
            <span className="rep-muted">Quick range:</span>
            <button type="button" className="rep-chip" onClick={() => setDatePreset(7)}>
              Last 7 days
            </button>
            <button type="button" className="rep-chip" onClick={() => setDatePreset(30)}>
              Last 30 days
            </button>
            <button type="button" className="rep-chip" onClick={() => setDatePreset(90)}>
              Last 90 days
            </button>
          </div>
          <div className="rep-row">
            <label className="rep-field">
              <Calendar size={14} />
              From
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </label>
            <label className="rep-field">
              <Calendar size={14} />
              To
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </label>
            {statusVisible && (
              <label className="rep-field">
                Status scope
                <select value={statusScope} onChange={(e) => setStatusScope(e.target.value)}>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {pagedReports && (
              <label className="rep-field">
                Page size
                <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
                  {[50, 100, 200, 500].map((n) => (
                    <option key={n} value={n}>
                      {n} rows
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {journeyExtras && (
            <div className="rep-row">
              <label className="rep-field rep-field--grow">
                How to show the journey
                <select value={journeyMode} onChange={(e) => setJourneyMode(e.target.value)}>
                  {JOURNEY_MODE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="rep-field rep-field--grow">
                Journey date mode
                <select value={journeyDateScope} onChange={(e) => setJourneyDateScope(e.target.value)}>
                  {JOURNEY_DATE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="rep-field rep-field--grow">
                Optional ticket ID
                <input
                  type="number"
                  min={1}
                  placeholder="Numeric id"
                  value={ticketId}
                  onChange={(e) => setTicketId(e.target.value)}
                />
              </label>
              <label className="rep-field rep-field--grow">
                Optional ticket number
                <input
                  type="text"
                  placeholder="e.g. INC-2025-0042"
                  value={ticketNumber}
                  onChange={(e) => setTicketNumber(e.target.value)}
                />
              </label>
            </div>
          )}

          {(accessExtras || botUserFilter) && (
            <div className="rep-row">
              <label className="rep-field rep-field--grow">
                Filter by user IDs (comma-separated)
                <input
                  type="text"
                  placeholder="e.g. 12, 34"
                  value={userIdsText}
                  onChange={(e) => setUserIdsText(e.target.value)}
                />
              </label>
              {reportType === 'login_attempts' && (
                <label className="rep-field rep-field--checkbox">
                  <input
                    type="checkbox"
                    checked={onlyFailures}
                    onChange={(e) => setOnlyFailures(e.target.checked)}
                  />
                  Failed attempts only
                </label>
              )}
              {reportType === 'security_audit' && (
                <label className="rep-field rep-field--grow">
                  Action types (optional)
                  <input
                    type="text"
                    placeholder="LOGIN_SUCCESS, LOGOUT, PASSWORD_CHANGED…"
                    value={auditActionsText}
                    onChange={(e) => setAuditActionsText(e.target.value)}
                  />
                </label>
              )}
            </div>
          )}

          {ticketFiltersVisible && (
            <div className="rep-row rep-row--filters">
              {loadingFilters ? (
                <span className="rep-muted">Loading filter lists…</span>
              ) : (
                <>
                  <MultiSelect
                    label="Departments"
                    options={filters.departments}
                    selected={departmentIds}
                    onChange={setDepartmentIds}
                    placeholder="All departments"
                  />
                  <MultiSelect
                    label="Locations"
                    options={filters.locations}
                    selected={locationIds}
                    onChange={setLocationIds}
                    placeholder="All locations"
                  />
                  <MultiSelect
                    label="Teams"
                    options={filters.teams}
                    selected={teamIds}
                    onChange={setTeamIds}
                    placeholder="All teams"
                  />
                  {priorityFilterVisible && (
                    <MultiSelect
                      label="Priorities"
                      options={filters.priorities}
                      selected={priorityIds}
                      onChange={setPriorityIds}
                      placeholder="All priorities"
                    />
                  )}
                </>
              )}
            </div>
          )}

          <div className="rep-actions">
            <button type="button" className="rep-btn rep-btn--primary" onClick={runReport} disabled={loading}>
              {loading ? <Loader className="rep-spin" size={18} /> : <Play size={18} />}
              {loading ? 'Running…' : 'Run report'}
            </button>
            <span className="rep-hint">
              Ticket reports use live joins; access reports read sessions, login_attempts, and security_audit_log; bot
              reports need Phase 4 bot tables.
            </span>
          </div>
        </div>
      </section>

      <section className="rep-section rep-results">
        <div className="rep-results-head">
          <h2 className="rep-h2">3. Preview &amp; export</h2>
          <div className="rep-results-tools">
            {rows.length > 0 && (
              <label className="rep-search">
                <Search size={16} />
                <input
                  type="search"
                  placeholder="Filter preview…"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  aria-label="Filter table preview"
                />
              </label>
            )}
            {activeReport && (
              <div className="rep-export-btns">
                <button
                  type="button"
                  className="rep-btn rep-btn--excel"
                  onClick={handleExportExcel}
                  disabled={!rows.length || exportBusy}
                >
                  <span className="rep-badge-xlsx" aria-hidden>
                    XLSX
                  </span>
                  {exportBusy ? 'Building…' : 'Download Excel'}
                </button>
                <button
                  type="button"
                  className="rep-btn rep-btn--pdf"
                  onClick={handleExportPdf}
                  disabled={!rows.length || exportBusy}
                >
                  <FileText size={16} aria-hidden />
                  {exportBusy ? 'Building…' : 'Download PDF'}
                </button>
                <button type="button" className="rep-btn rep-btn--csv" onClick={handleExportCsv} disabled={!rows.length || exportBusy}>
                  <span className="rep-badge-csv" aria-hidden>
                    CSV
                  </span>
                  Download CSV
                </button>
              </div>
            )}
          </div>
        </div>

        {!rows.length && !loading && (
          <div className="rep-empty">
            <Table2 size={40} />
            <p>No data yet — pick a report, set the date range, and run.</p>
          </div>
        )}

        {loading && (
          <div className="rep-loading">
            <Loader className="rep-spin" size={36} />
            <p>Querying database…</p>
          </div>
        )}

        {rows.length > 0 && !loading && (
          <>
            <p className="rep-meta-line">{metaLines.join(' · ')}</p>

            {/* Summary chart — shown for all summary_* report types */}
            {isSummaryChart && rows.length > 0 && (
              <div className="rep-summary-chart">
                <div className="rep-summary-stats">
                  <div className="rep-summary-stat">
                    <span className="rep-summary-stat-value">
                      {rows.reduce((s, r) => s + (Number(r.ticket_count) || 0), 0).toLocaleString()}
                    </span>
                    <span className="rep-summary-stat-label">Total Tickets</span>
                  </div>
                  {'closed_count' in (rows[0] || {}) && (
                    <div className="rep-summary-stat rep-summary-stat--green">
                      <span className="rep-summary-stat-value">
                        {rows.reduce((s, r) => s + (Number(r.closed_count) || 0), 0).toLocaleString()}
                      </span>
                      <span className="rep-summary-stat-label">Closed</span>
                    </div>
                  )}
                  {'open_count' in (rows[0] || {}) && (
                    <div className="rep-summary-stat rep-summary-stat--amber">
                      <span className="rep-summary-stat-value">
                        {rows.reduce((s, r) => s + (Number(r.open_count) || 0), 0).toLocaleString()}
                      </span>
                      <span className="rep-summary-stat-label">Open</span>
                    </div>
                  )}
                  {'escalated_count' in (rows[0] || {}) && (
                    <div className="rep-summary-stat rep-summary-stat--red">
                      <span className="rep-summary-stat-value">
                        {rows.reduce((s, r) => s + (Number(r.escalated_count) || 0), 0).toLocaleString()}
                      </span>
                      <span className="rep-summary-stat-label">Escalated</span>
                    </div>
                  )}
                  <div className="rep-summary-stat">
                    <span className="rep-summary-stat-value">{rows.length}</span>
                    <span className="rep-summary-stat-label">Groups</span>
                  </div>
                </div>

                <div className="rep-chart-area">
                  <div className="rep-chart-title">
                    <TrendingUp size={16} />
                    Ticket volume breakdown
                  </div>
                  <ResponsiveContainer width="100%" height={Math.max(200, rows.length * 36)}>
                    <BarChart
                      data={rows.slice(0, 20).map((r) => ({ name: r.dimension_name || '(None)', value: r.ticket_count || 0 }))}
                      layout="vertical"
                      margin={{ top: 4, right: 40, left: 8, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 12 }} />
                      <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(v) => [v.toLocaleString(), 'Tickets']}
                        contentStyle={{ fontSize: 13, borderRadius: 8 }}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {rows.slice(0, 20).map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  {rows.length > 20 && (
                    <p className="rep-chart-footnote">Showing top 20 of {rows.length} groups. See table below for full data.</p>
                  )}
                </div>
              </div>
            )}

            <div className="rep-table-wrap">
              <table className="rep-table">
                <thead>
                  <tr>
                    {columns.map((c) => (
                      <th key={c}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayRows.map((row, i) => (
                    <tr key={i} style={{ animationDelay: `${Math.min(i, 24) * 0.02}s` }}>
                      {columns.map((c) => (
                        <td key={c} className={c === 'journey_timeline' ? 'rep-td-pre' : undefined}>
                          {cellStr(row[c])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {tableSearch && displayRows.length === 0 && (
              <p className="rep-muted">No rows match your preview filter.</p>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function cellStr(v) {
  if (v === null || v === undefined) return '—';
  return formatReportCell(v);
}

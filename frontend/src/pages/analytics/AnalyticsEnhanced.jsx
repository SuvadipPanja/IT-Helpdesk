import { useState, useEffect, useCallback, useRef } from 'react';
import {
  TrendingUp, Clock, CheckCircle, AlertTriangle, Users,
  BarChart3, Activity, Calendar, Download, RefreshCw,
  Loader, ThumbsUp, ArrowUpCircle, Target, GitCompare
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import '../../styles/AnalyticsEnhanced.css';

import OverviewDashboard from '../../components/analytics/OverviewDashboard';
import SLAMetrics from '../../components/analytics/SLAMetrics';
import CSATMetrics from '../../components/analytics/CSATMetrics';
import EscalationMetrics from '../../components/analytics/EscalationMetrics';
import AgingAnalysis from '../../components/analytics/AgingAnalysis';
import TimePatterns from '../../components/analytics/TimePatterns';
import AgentPerformance from '../../components/analytics/AgentPerformance';

const TABS = [
  { id: 'overview',    label: 'Overview',        icon: BarChart3 },
  { id: 'sla',         label: 'SLA Performance', icon: Target },
  { id: 'csat',        label: 'Satisfaction',    icon: ThumbsUp },
  { id: 'escalations', label: 'Escalations',     icon: ArrowUpCircle },
  { id: 'aging',       label: 'Ticket Aging',    icon: Clock },
  { id: 'patterns',    label: 'Time Patterns',   icon: Activity },
  { id: 'agents',      label: 'Agents',          icon: Users },
];

const RANGE_OPTIONS = [
  { value: '7',  label: '7D' },
  { value: '14', label: '14D' },
  { value: '30', label: '30D' },
  { value: '60', label: '60D' },
  { value: '90', label: '90D' },
];

const REFRESH_OPTIONS = [
  { value: 1,  label: '1 min' },
  { value: 5,  label: '5 min' },
  { value: 10, label: '10 min' },
  { value: 15, label: '15 min' },
];

/* ─── helpers ─── */
const fmtDate = (d) => d.toISOString().slice(0, 10);

const rangeDates = (preset, custom) => {
  if (custom.start && custom.end) return { start: custom.start, end: custom.end };
  const days = Number(preset);
  if (Number.isNaN(days) || days <= 0) return null;
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);
  return { start: fmtDate(start), end: fmtDate(end) };
};

const previousRange = (range) => {
  if (!range) return null;
  const s = new Date(`${range.start}T00:00:00`);
  const e = new Date(`${range.end}T00:00:00`);
  const ms = 864e5;
  const span = Math.max(1, Math.round((e - s) / ms)) + 1;
  const prevEnd   = new Date(s.getTime() - ms);
  const prevStart = new Date(prevEnd.getTime() - (span - 1) * ms);
  return { start: fmtDate(prevStart), end: fmtDate(prevEnd) };
};

const qs = (r) => (r ? `start_date=${r.start}&end_date=${r.end}` : '');

const fmtCountdown = (s) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
};

/* ─── CSV ─── */
const buildCsv = (rows) => {
  if (!rows?.length) return '';
  const heads = [...new Set(rows.flatMap(Object.keys))];
  const esc = (v) => { if (v == null) return ''; const s = String(v).replace(/"/g, '""'); return /[",\n]/.test(s) ? `"${s}"` : s; };
  return [heads.join(','), ...rows.map(r => heads.map(h => esc(r[h])).join(','))].join('\n');
};

const downloadCsv = (name, rows) => {
  const csv = buildCsv(rows);
  if (!csv) return;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
};

/* ═══════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════ */
const AnalyticsEnhanced = () => {
  useAuth(); // ensure user is authed

  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [error, setError]             = useState('');
  const [activeTab, setActiveTab]     = useState('overview');
  const [dateRange, setDateRange]     = useState('30');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [exporting, setExporting]     = useState(false);

  const [compareOn, setCompareOn]     = useState(false);
  const [compareData, setCompareData] = useState({});

  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshMin, setRefreshMin]   = useState(5);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [countdown, setCountdown]     = useState(0);

  const [dashboardData, setDashboardData]   = useState(null);
  const [slaData, setSlaData]               = useState(null);
  const [csatData, setCsatData]             = useState(null);
  const [escalationData, setEscalationData] = useState(null);
  const [agingData, setAgingData]           = useState(null);
  const [patternsData, setPatternsData]     = useState(null);
  const [agentData, setAgentData]           = useState(null);

  const fetchRef = useRef(null);

  /* ── fetch ── */
  const fetchAnalytics = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true); else setRefreshing(true);
      setError('');

      const range = rangeDates(dateRange, customRange);
      const dp = qs(range);
      const dq = dp ? `?${dp}` : '';
      const cRange = compareOn ? previousRange(range) : null;
      const cp = qs(cRange);
      const cq = cp ? `?${cp}` : '';

      switch (activeTab) {
        case 'overview': {
          const r = await api.get(`/analytics/dashboard${dq}`);
          if (r.data.success) setDashboardData(r.data.data);
          if (cq) { const c = await api.get(`/analytics/dashboard${cq}`); if (c.data.success) setCompareData(p => ({ ...p, overview: c.data.data })); }
          break;
        }
        case 'sla': {
          const r = await api.get(`/analytics/sla-performance${dq}`);
          if (r.data.success) setSlaData(r.data.data);
          if (cq) { const c = await api.get(`/analytics/sla-performance${cq}`); if (c.data.success) setCompareData(p => ({ ...p, sla: c.data.data })); }
          break;
        }
        case 'csat': {
          const r = await api.get(`/analytics/csat${dq}`);
          if (r.data.success) setCsatData(r.data.data);
          if (cq) { const c = await api.get(`/analytics/csat${cq}`); if (c.data.success) setCompareData(p => ({ ...p, csat: c.data.data })); }
          break;
        }
        case 'escalations': {
          const r = await api.get(`/analytics/escalations${dq}`);
          if (r.data.success) setEscalationData(r.data.data);
          if (cq) { const c = await api.get(`/analytics/escalations${cq}`); if (c.data.success) setCompareData(p => ({ ...p, escalations: c.data.data })); }
          break;
        }
        case 'aging': {
          const r = await api.get(`/analytics/aging${dq}`);
          if (r.data.success) setAgingData(r.data.data);
          break;
        }
        case 'patterns': {
          const r = await api.get(`/analytics/time-patterns?days=${dateRange}`);
          if (r.data.success) setPatternsData(r.data.data);
          break;
        }
        case 'agents': {
          const q2 = dp ? `?${dp}&limit=20` : '?limit=20';
          const r = await api.get(`/analytics/agent-performance${q2}`);
          if (r.data.success) setAgentData(r.data.data);
          if (cq) { const cq2 = cp ? `?${cp}&limit=20` : '?limit=20'; const c = await api.get(`/analytics/agent-performance${cq2}`); if (c.data.success) setCompareData(p => ({ ...p, agents: c.data.data })); }
          break;
        }
        default: break;
      }
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Analytics fetch error:', err);
      setError(err.response?.data?.message || 'Failed to fetch analytics data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, dateRange, customRange, compareOn]);

  useEffect(() => { fetchRef.current = fetchAnalytics; }, [fetchAnalytics]);
  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);
  useEffect(() => { if (!compareOn) setCompareData({}); }, [compareOn]);

  /* ── auto-refresh with countdown ── */
  useEffect(() => {
    if (!autoRefresh) { setCountdown(0); return; }
    const totalSec = Math.max(1, refreshMin) * 60;
    setCountdown(totalSec);
    const id = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { fetchRef.current?.(true); return totalSec; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [autoRefresh, refreshMin]);

  /* ── export ── */
  const handleExport = () => {
    setExporting(true);
    let rows = [], name = `${activeTab}.csv`;
    switch (activeTab) {
      case 'overview': if (dashboardData) { rows = Object.entries(dashboardData).map(([m, v]) => ({ metric: m, value: v })); name = 'overview.csv'; } break;
      case 'sla': rows = slaData || []; name = 'sla-performance.csv'; break;
      case 'csat':
        if (csatData) {
          rows = [
            ...(csatData.overall ? [{ section: 'overall', metric: 'avg_rating', value: csatData.overall.avg_rating }, { section: 'overall', metric: 'total_ratings', value: csatData.overall.total_ratings }, { section: 'overall', metric: 'satisfaction_score', value: csatData.overall.satisfaction_score }] : []),
            ...(csatData.distribution || []).map(i => ({ section: 'distribution', rating: i.rating, count: i.count })),
            ...(csatData.by_department || []).map(i => ({ section: 'by_dept', dept: i.department_name, rating: i.avg_rating, count: i.rating_count })),
            ...(csatData.by_category || []).map(i => ({ section: 'by_cat', cat: i.category_name, rating: i.avg_rating, count: i.rating_count })),
          ]; name = 'csat.csv';
        } break;
      case 'escalations':
        if (escalationData) {
          rows = [
            ...(escalationData.overview ? [{ section: 'overview', metric: 'total', value: escalationData.overview.total_escalations }, { section: 'overview', metric: 'open', value: escalationData.overview.open_escalations }] : []),
            ...(escalationData.by_priority || []).map(i => ({ section: 'by_priority', priority: i.priority_name, count: i.escalation_count })),
            ...(escalationData.by_department || []).map(i => ({ section: 'by_dept', dept: i.department_name, count: i.escalation_count })),
            ...(escalationData.reasons || []).map(i => ({ section: 'reasons', reason: i.reason, count: i.count })),
          ]; name = 'escalations.csv';
        } break;
      case 'aging':
        if (agingData) {
          rows = [
            ...(agingData.age_distribution || []).map(i => ({ section: 'distribution', bucket: i.age_bucket, count: i.count })),
            ...(agingData.oldest_tickets || []).map(i => ({ section: 'oldest', ticket: i.ticket_number, subject: i.subject, age_days: i.age_days })),
            ...(agingData.avg_by_priority || []).map(i => ({ section: 'avg_age', priority: i.priority_name, hours: i.avg_age_hours, count: i.ticket_count })),
          ]; name = 'aging.csv';
        } break;
      case 'patterns':
        if (patternsData) {
          rows = [
            ...(patternsData.hourly_distribution || []).map(i => ({ section: 'hourly', hour: i.hour, count: i.ticket_count })),
            ...(patternsData.daily_distribution || []).map(i => ({ section: 'daily', day: i.day_name, count: i.ticket_count })),
          ]; name = 'time-patterns.csv';
        } break;
      case 'agents': rows = agentData || []; name = 'agents.csv'; break;
      default: break;
    }
    downloadCsv(name, rows);
    setExporting(false);
  };

  /* ── render content ── */
  const renderContent = () => {
    switch (activeTab) {
      case 'overview':    return <OverviewDashboard data={dashboardData} compareData={compareData.overview} />;
      case 'sla':         return <SLAMetrics data={slaData} compareData={compareData.sla} />;
      case 'csat':        return <CSATMetrics data={csatData} compareData={compareData.csat} />;
      case 'escalations': return <EscalationMetrics data={escalationData} compareData={compareData.escalations} />;
      case 'aging':       return <AgingAnalysis data={agingData} compareData={compareData.aging} />;
      case 'patterns':    return <TimePatterns data={patternsData} />;
      case 'agents':      return <AgentPerformance data={agentData} compareData={compareData.agents} />;
      default:            return null;
    }
  };

  /* ═══ RENDER ═══ */
  if (loading && !dashboardData && !slaData) {
    return (
      <div className="ae-page">
        <div className="ae-loader"><Loader className="ae-spin" size={36} /><p>Loading analytics…</p></div>
      </div>
    );
  }

  if (error && !dashboardData && !slaData) {
    return (
      <div className="ae-page">
        <div className="ae-error">
          <AlertTriangle size={36} />
          <h2>Something went wrong</h2>
          <p>{error}</p>
          <button className="ae-btn ae-btn-primary" onClick={() => fetchAnalytics()}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="ae-page">

      {/* header */}
      <header className="ae-header">
        <div className="ae-header-left">
          <div className="ae-header-icon"><TrendingUp size={22} /></div>
          <div>
            <h1>Analytics &amp; Insights</h1>
            <p>Performance metrics &bull; SLA &bull; CSAT &bull; Trends</p>
          </div>
        </div>
        <div className="ae-header-actions">
          {lastRefresh && (
            <span className="ae-meta">Updated {lastRefresh.toLocaleTimeString()}</span>
          )}
          <button className="ae-btn ae-btn-ghost" onClick={() => fetchAnalytics(true)} disabled={refreshing} title="Refresh">
            <RefreshCw size={16} className={refreshing ? 'ae-spin' : ''} />
          </button>
          <button className="ae-btn ae-btn-primary" onClick={handleExport} disabled={exporting}>
            <Download size={16} />{exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </header>

      {/* toolbar */}
      <div className="ae-toolbar">
        <div className="ae-tool-left">
          <Calendar size={14} className="ae-tool-ico" />
          {RANGE_OPTIONS.map(o => (
            <button
              key={o.value}
              className={`ae-pill ${dateRange === o.value && !customRange.start ? 'active' : ''}`}
              onClick={() => { setDateRange(o.value); setCustomRange({ start: '', end: '' }); }}
            >{o.label}</button>
          ))}
          <span className="ae-sep" />
          <input type="date" className="ae-date" value={customRange.start} onChange={e => setCustomRange(p => ({ ...p, start: e.target.value }))} />
          <span className="ae-to">→</span>
          <input type="date" className="ae-date" value={customRange.end} onChange={e => setCustomRange(p => ({ ...p, end: e.target.value }))} />
          {(customRange.start || customRange.end) && (
            <button className="ae-pill" onClick={() => setCustomRange({ start: '', end: '' })}>Clear</button>
          )}
        </div>

        <div className="ae-tool-right">
          <button className={`ae-toggle ${compareOn ? 'on' : ''}`} onClick={() => setCompareOn(p => !p)} title="Compare with previous period">
            <GitCompare size={14} /><span>Compare</span>
          </button>
          <span className="ae-sep" />
          <button className={`ae-toggle ${autoRefresh ? 'on' : ''}`} onClick={() => setAutoRefresh(p => !p)} title="Auto-refresh">
            <RefreshCw size={14} /><span>Auto</span>
          </button>
          {autoRefresh && (
            <>
              <select className="ae-mini-select" value={refreshMin} onChange={e => setRefreshMin(Number(e.target.value))}>
                {REFRESH_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <span className="ae-countdown">{fmtCountdown(countdown)}</span>
            </>
          )}
        </div>
      </div>

      {/* tabs */}
      <nav className="ae-tabs" role="tablist">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} role="tab" aria-selected={activeTab === t.id}
              className={`ae-tab ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              <Icon size={16} /><span>{t.label}</span>
            </button>
          );
        })}
        {refreshing && <span className="ae-tab-badge"><Loader size={12} className="ae-spin" /> Syncing…</span>}
      </nav>

      {/* content */}
      <section className="ae-content">
        {renderContent()}
      </section>
    </div>
  );
};

export default AnalyticsEnhanced;

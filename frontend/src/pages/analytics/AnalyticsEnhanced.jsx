import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  TrendingUp, Clock, CheckCircle, AlertTriangle, Users,
  BarChart3, Activity, Calendar, Download, RefreshCw,
  Loader, ThumbsUp, ArrowUpCircle, Target, GitCompare, MessageSquare,
  Sparkles, Zap
} from 'lucide-react';
import RefreshButton from '../../components/shared/RefreshButton';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api';
import { formatTime } from '../../utils/dateUtils';
import '../../styles/AnalyticsEnhanced.css';

import OverviewDashboard from '../../components/analytics/OverviewDashboard';
import SLAMetrics from '../../components/analytics/SLAMetrics';
import CSATMetrics from '../../components/analytics/CSATMetrics';
import EscalationMetrics from '../../components/analytics/EscalationMetrics';
import AgingAnalysis from '../../components/analytics/AgingAnalysis';
import TimePatterns from '../../components/analytics/TimePatterns';
import AgentPerformance from '../../components/analytics/AgentPerformance';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function BotAnalyticsSummary({ data }) {
  if (!data) return <div className="no-data">No bot data available for the selected period.</div>;
  const { overview, daily, top_intents } = data;
  const kpis = [
    { label: 'Total Sessions', value: overview.total_sessions },
    { label: 'Total Messages', value: overview.total_messages },
    { label: 'Tickets Created', value: overview.tickets_created },
    { label: 'Intents Matched', value: overview.intents_matched },
    { label: 'Avg Msgs / Session', value: overview.avg_msgs_per_session },
    { label: 'Active Sessions', value: overview.active_sessions },
  ];
  return (
    <div className="bot-analytics">
      <div className="bot-kpis">
        {kpis.map((k) => (
          <div key={k.label} className="bot-kpi-card">
            <div className="bot-kpi-value">{k.value}</div>
            <div className="bot-kpi-label">{k.label}</div>
          </div>
        ))}
      </div>
      <div className="bot-charts">
        {daily && daily.length > 0 && (
          <div className="chart-card">
            <h3>Daily Session Volume</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="session_date" tick={{ fontSize: 11 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="session_count" fill="#3b82f6" name="Sessions" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {top_intents && top_intents.length > 0 && (
          <div className="chart-card">
            <h3>Top Intents Matched</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={top_intents} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="intent_name" width={160} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="match_count" fill="#8b5cf6" name="Matches" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

const TABS = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'sla', label: 'SLA Performance', icon: Target },
  { id: 'csat', label: 'Satisfaction', icon: ThumbsUp },
  { id: 'escalations', label: 'Escalations', icon: ArrowUpCircle },
  { id: 'aging', label: 'Ticket Aging', icon: Clock },
  { id: 'patterns', label: 'Time Patterns', icon: Activity },
  { id: 'agents', label: 'Agents', icon: Users },
  { id: 'bot-sessions', label: 'Bot Sessions', icon: MessageSquare },
];

const RANGE_OPTIONS = [
  { value: '7', label: '7D' },
  { value: '14', label: '14D' },
  { value: '30', label: '30D' },
  { value: '60', label: '60D' },
  { value: '90', label: '90D' },
];

const REFRESH_OPTIONS = [
  { value: 1, label: '1 min' },
  { value: 5, label: '5 min' },
  { value: 10, label: '10 min' },
  { value: 15, label: '15 min' },
];

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
  const prevEnd = new Date(s.getTime() - ms);
  const prevStart = new Date(prevEnd.getTime() - (span - 1) * ms);
  return { start: fmtDate(prevStart), end: fmtDate(prevEnd) };
};

const qs = (r) => (r ? `start_date=${r.start}&end_date=${r.end}` : '');

const fmtCountdown = (s) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
};

/** Human-readable period for hero + a11y */
const formatPeriodLabel = (dateRange, customRange) => {
  const r = rangeDates(dateRange, customRange);
  if (!r) return 'Select a date range';
  if (customRange?.start && customRange?.end) {
    return `${r.start} → ${r.end}`;
  }
  return `Last ${dateRange} days · ${r.start} → ${r.end}`;
};

const buildCsv = (rows) => {
  if (!rows?.length) return '';
  const heads = [...new Set(rows.flatMap(Object.keys))];
  const esc = (v) => {
    if (v == null) return '';
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  return [heads.join(','), ...rows.map((r) => heads.map((h) => esc(r[h])).join(','))].join('\n');
};

const downloadCsv = (name, rows) => {
  const csv = buildCsv(rows);
  if (!csv) return false;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
  return true;
};

/* ── Loading skeleton (industrial dashboard pattern) ── */
function AnalyticsContentSkeleton() {
  return (
    <div className="ae-skeleton" aria-busy="true" aria-label="Loading analytics">
      <div className="ae-sk-grid">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="ae-sk-kpi">
            <div className="ae-sk-shimmer ae-sk-line ae-sk-line--short" />
            <div className="ae-sk-shimmer ae-sk-line ae-sk-line--title" />
            <div className="ae-sk-shimmer ae-sk-line ae-sk-line--muted" />
          </div>
        ))}
      </div>
      <div className="ae-sk-shimmer ae-sk-chart" />
      <div className="ae-sk-split">
        <div className="ae-sk-shimmer ae-sk-chart ae-sk-chart--half" />
        <div className="ae-sk-shimmer ae-sk-chart ae-sk-chart--half" />
      </div>
    </div>
  );
}

const AnalyticsEnhanced = () => {
  useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState('30');
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [exporting, setExporting] = useState(false);

  const [compareOn, setCompareOn] = useState(false);
  const [compareData, setCompareData] = useState({});

  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshMin, setRefreshMin] = useState(5);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [countdown, setCountdown] = useState(0);

  const [dashboardData, setDashboardData] = useState(null);
  const [slaData, setSlaData] = useState(null);
  const [csatData, setCsatData] = useState(null);
  const [escalationData, setEscalationData] = useState(null);
  const [agingData, setAgingData] = useState(null);
  const [patternsData, setPatternsData] = useState(null);
  const [agentData, setAgentData] = useState(null);
  const [botData, setBotData] = useState(null);

  const [categoryData, setCategoryData] = useState(null);
  const [departmentData, setDepartmentData] = useState(null);
  const [priorityData, setPriorityData] = useState(null);
  const [statusData, setStatusData] = useState(null);
  const [trendsData, setTrendsData] = useState(null);
  const [engineersData, setEngineersData] = useState(null);
  const [locationData, setLocationData] = useState(null);
  const [processData, setProcessData] = useState(null);

  const fetchRef = useRef(null);

  const periodLabel = useMemo(
    () => formatPeriodLabel(dateRange, customRange),
    [dateRange, customRange]
  );

  const comparePeriodLabel = useMemo(() => {
    if (!compareOn) return null;
    const r = rangeDates(dateRange, customRange);
    const prev = previousRange(r);
    if (!prev) return null;
    return `${prev.start} → ${prev.end}`;
  }, [compareOn, dateRange, customRange]);

  const hasLoadedCurrentTab = useMemo(() => {
    switch (activeTab) {
      case 'overview':
        return dashboardData != null;
      case 'sla':
        return slaData != null;
      case 'csat':
        return csatData != null;
      case 'escalations':
        return escalationData != null;
      case 'aging':
        return agingData != null;
      case 'patterns':
        return patternsData != null;
      case 'agents':
        return agentData != null;
      case 'bot-sessions':
        return true;
      default:
        return false;
    }
  }, [
    activeTab,
    dashboardData,
    slaData,
    csatData,
    escalationData,
    agingData,
    patternsData,
    agentData,
  ]);

  const showSkeleton = loading && !hasLoadedCurrentTab && activeTab !== 'bot-sessions';

  const fetchAnalytics = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      setError('');

      const range = rangeDates(dateRange, customRange);
      const dp = qs(range);
      const dq = dp ? `?${dp}` : '';
      const cRange = compareOn ? previousRange(range) : null;
      const cp = qs(cRange);
      const cq = cp ? `?${cp}` : '';

      switch (activeTab) {
        case 'overview': {
          const fallback = { data: { success: false } };
          const [r, catR, deptR, prioR, statR, trendR, engR, locR, procR] = await Promise.all([
            api.get(`/analytics/dashboard${dq}`).catch(() => fallback),
            api.get(`/analytics/by-category${dq}`).catch(() => fallback),
            api.get(`/analytics/by-department${dq}`).catch(() => fallback),
            api.get(`/analytics/by-priority${dq}`).catch(() => fallback),
            api.get(`/analytics/status-distribution${dq}`).catch(() => fallback),
            api.get(`/analytics/trends?days=${dateRange}`).catch(() => fallback),
            api.get(`/analytics/top-engineers${dq}`).catch(() => fallback),
            api.get(`/analytics/by-location${dq}`).catch(() => fallback),
            api.get(`/analytics/by-process${dq}`).catch(() => fallback),
          ]);
          if (r.data.success) setDashboardData(r.data.data);
          if (catR.data.success) setCategoryData(catR.data.data);
          if (deptR.data.success) setDepartmentData(deptR.data.data);
          if (prioR.data.success) setPriorityData(prioR.data.data);
          if (statR.data.success) setStatusData(statR.data.data);
          if (trendR.data.success) setTrendsData(trendR.data.data);
          if (engR.data.success) setEngineersData(engR.data.data);
          if (locR.data.success) setLocationData(locR.data.data);
          if (procR.data.success) setProcessData(procR.data.data);
          if (cq) {
            const c = await api.get(`/analytics/dashboard${cq}`);
            if (c.data.success) setCompareData((p) => ({ ...p, overview: c.data.data }));
          }
          break;
        }
        case 'sla': {
          const r = await api.get(`/analytics/sla-performance${dq}`);
          if (r.data.success) {
            const resData = r.data.data;
            setSlaData(Array.isArray(resData) ? { priorities: resData, slaTarget: 90 } : resData);
          }
          if (cq) {
            const c = await api.get(`/analytics/sla-performance${cq}`);
            if (c.data.success) {
              const cd = c.data.data;
              setCompareData((p) => ({
                ...p,
                sla: Array.isArray(cd) ? { priorities: cd, slaTarget: 90 } : cd,
              }));
            }
          }
          break;
        }
        case 'csat': {
          const r = await api.get(`/analytics/csat${dq}`);
          if (r.data.success) setCsatData(r.data.data);
          if (cq) {
            const c = await api.get(`/analytics/csat${cq}`);
            if (c.data.success) setCompareData((p) => ({ ...p, csat: c.data.data }));
          }
          break;
        }
        case 'escalations': {
          const r = await api.get(`/analytics/escalations${dq}`);
          if (r.data.success) setEscalationData(r.data.data);
          if (cq) {
            const c = await api.get(`/analytics/escalations${cq}`);
            if (c.data.success) setCompareData((p) => ({ ...p, escalations: c.data.data }));
          }
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
          if (cq) {
            const cq2 = cp ? `?${cp}&limit=20` : '?limit=20';
            const c = await api.get(`/analytics/agent-performance${cq2}`);
            if (c.data.success) setCompareData((p) => ({ ...p, agents: c.data.data }));
          }
          break;
        }
        case 'bot-sessions': {
          const r = await api.get(`/analytics/bot${dq}`);
          if (r.data.success) setBotData(r.data.data);
          break;
        }
        default:
          break;
      }
      setLastRefresh(new Date());
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch analytics data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, dateRange, customRange, compareOn]);

  useEffect(() => {
    fetchRef.current = fetchAnalytics;
  }, [fetchAnalytics]);
  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);
  useEffect(() => {
    if (!compareOn) setCompareData({});
  }, [compareOn]);

  useEffect(() => {
    if (!autoRefresh) {
      setCountdown(0);
      return undefined;
    }
    const totalSec = Math.max(1, refreshMin) * 60;
    setCountdown(totalSec);
    const id = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchRef.current?.(true);
          return totalSec;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [autoRefresh, refreshMin]);

  const handleExport = () => {
    setExporting(true);
    let rows = [];
    let name = `${activeTab}.csv`;
    switch (activeTab) {
      case 'overview':
        if (dashboardData) {
          rows = Object.entries(dashboardData).map(([m, v]) => ({ metric: m, value: v }));
          name = 'overview.csv';
        }
        break;
      case 'sla':
        rows = slaData?.priorities || slaData || [];
        name = 'sla-performance.csv';
        break;
      case 'csat':
        if (csatData) {
          rows = [
            ...(csatData.overall
              ? [
                  { section: 'overall', metric: 'avg_rating', value: csatData.overall.avg_rating },
                  { section: 'overall', metric: 'total_ratings', value: csatData.overall.total_ratings },
                  { section: 'overall', metric: 'satisfaction_score', value: csatData.overall.satisfaction_score },
                ]
              : []),
            ...(csatData.distribution || []).map((i) => ({ section: 'distribution', rating: i.rating, count: i.count })),
            ...(csatData.by_department || []).map((i) => ({
              section: 'by_dept',
              dept: i.department_name,
              rating: i.avg_rating,
              count: i.rating_count,
            })),
            ...(csatData.by_category || []).map((i) => ({
              section: 'by_cat',
              cat: i.category_name,
              rating: i.avg_rating,
              count: i.rating_count,
            })),
          ];
          name = 'csat.csv';
        }
        break;
      case 'escalations':
        if (escalationData) {
          rows = [
            ...(escalationData.overview
              ? [
                  { section: 'overview', metric: 'total', value: escalationData.overview.total_escalations },
                  { section: 'overview', metric: 'open', value: escalationData.overview.open_escalations },
                ]
              : []),
            ...(escalationData.by_priority || []).map((i) => ({
              section: 'by_priority',
              priority: i.priority_name,
              count: i.escalation_count,
            })),
            ...(escalationData.by_department || []).map((i) => ({
              section: 'by_dept',
              dept: i.department_name,
              count: i.escalation_count,
            })),
            ...(escalationData.reasons || []).map((i) => ({ section: 'reasons', reason: i.reason, count: i.count })),
          ];
          name = 'escalations.csv';
        }
        break;
      case 'aging':
        if (agingData) {
          rows = [
            ...(agingData.age_distribution || []).map((i) => ({ section: 'distribution', bucket: i.age_bucket, count: i.count })),
            ...(agingData.oldest_tickets || []).map((i) => ({
              section: 'oldest',
              ticket: i.ticket_number,
              subject: i.subject,
              age_days: i.age_days,
            })),
            ...(agingData.avg_by_priority || []).map((i) => ({
              section: 'avg_age',
              priority: i.priority_name,
              hours: i.avg_age_hours,
              count: i.ticket_count,
            })),
          ];
          name = 'aging.csv';
        }
        break;
      case 'patterns':
        if (patternsData) {
          rows = [
            ...(patternsData.hourly_distribution || []).map((i) => ({ section: 'hourly', hour: i.hour, count: i.ticket_count })),
            ...(patternsData.daily_distribution || []).map((i) => ({ section: 'daily', day: i.day_name, count: i.ticket_count })),
          ];
          name = 'time-patterns.csv';
        }
        break;
      case 'agents':
        rows = agentData || [];
        name = 'agents.csv';
        break;
      default:
        break;
    }
    const ok = downloadCsv(name, rows);
    setExporting(false);
    if (activeTab === 'bot-sessions') {
      toast.info('Export CSV applies to data tabs. Use Bot Sessions filters to copy data if needed.');
    } else if (ok) {
      toast.success(`Exported ${name}`);
    } else {
      toast.warning('Nothing to export for this view yet.');
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <OverviewDashboard
            data={dashboardData}
            compareData={compareData.overview}
            categoryData={categoryData}
            departmentData={departmentData}
            priorityData={priorityData}
            statusData={statusData}
            trendsData={trendsData}
            engineersData={engineersData}
            locationData={locationData}
            processData={processData}
          />
        );
      case 'sla':
        return (
          <SLAMetrics
            data={slaData?.priorities || slaData}
            compareData={compareData.sla?.priorities || compareData.sla}
            slaTarget={slaData?.slaTarget || 90}
          />
        );
      case 'csat':
        return <CSATMetrics data={csatData} compareData={compareData.csat} />;
      case 'escalations':
        return <EscalationMetrics data={escalationData} compareData={compareData.escalations} />;
      case 'aging':
        return <AgingAnalysis data={agingData} compareData={compareData.aging} />;
      case 'patterns':
        return <TimePatterns data={patternsData} />;
      case 'agents':
        return <AgentPerformance data={agentData} compareData={compareData.agents} />;
      case 'bot-sessions':
        return <BotAnalyticsSummary data={botData} />;
      default:
        return null;
    }
  };

  /** Full-page error only when Overview fails to load (primary entry) */
  const fatalError = Boolean(error && !loading && activeTab === 'overview' && !dashboardData);

  if (fatalError) {
    return (
      <div className="ae-page ae-page--centered">
        <div className="ae-error ae-error--card">
          <AlertTriangle size={40} aria-hidden />
          <h2>Unable to load analytics</h2>
          <p>{error}</p>
          <button type="button" className="ae-btn ae-btn-primary" onClick={() => fetchAnalytics()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const activeTabMeta = TABS.find((t) => t.id === activeTab);

  return (
    <div className="ae-page">
      <a href="#ae-main-panel" className="ae-skip">
        Skip to report content
      </a>

      {/* Hero — command center */}
      <header className="ae-hero" role="banner">
        <div className="ae-hero-bg" aria-hidden />
        <div className="ae-hero-inner">
          <div className="ae-hero-top">
            <div className="ae-hero-brand">
              <div className="ae-hero-icon-wrap">
                <TrendingUp size={26} aria-hidden />
              </div>
              <div>
                <p className="ae-hero-eyebrow">Operations intelligence</p>
                <h1>Analytics &amp; Insights</h1>
                <p className="ae-hero-sub">
                  Ticket volume, SLA health, satisfaction, escalations, and team performance — unified for decisions.
                </p>
              </div>
            </div>
            <div className="ae-hero-actions">
              {lastRefresh && (
                <span className="ae-meta ae-meta--pill">
                  <Zap size={12} aria-hidden />
                  Updated {formatTime(lastRefresh)}
                </span>
              )}
              <RefreshButton
                onClick={() => fetchAnalytics(true)}
                loading={refreshing}
                label="Refresh"
                variant="ghost"
              />
              <button type="button" className="ae-btn ae-btn-primary" onClick={handleExport} disabled={exporting}>
                <Download size={16} />
                {exporting ? 'Exporting…' : 'Export CSV'}
              </button>
            </div>
          </div>

          <div className="ae-hero-chips" role="status" aria-live="polite">
            <span className="ae-chip ae-chip--period">
              <Calendar size={14} aria-hidden />
              {periodLabel}
            </span>
            {compareOn && comparePeriodLabel && (
              <span className="ae-chip ae-chip--compare">
                <GitCompare size={14} aria-hidden />
                vs {comparePeriodLabel}
              </span>
            )}
            <span className="ae-chip ae-chip--live">
              <Sparkles size={14} aria-hidden />
              {activeTabMeta?.label || 'Overview'}
            </span>
          </div>
        </div>
      </header>

      {/* Filters toolbar */}
      <div className="ae-toolbar">
        <div className="ae-tool-left">
          <span className="ae-tool-label">Range</span>
          <Calendar size={14} className="ae-tool-ico" aria-hidden />
          {RANGE_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`ae-pill ${dateRange === o.value && !customRange.start ? 'active' : ''}`}
              onClick={() => {
                setDateRange(o.value);
                setCustomRange({ start: '', end: '' });
              }}
            >
              {o.label}
            </button>
          ))}
          <span className="ae-sep" />
          <label className="ae-sr-only" htmlFor="ae-date-start">
            Start date
          </label>
          <input
            id="ae-date-start"
            type="date"
            className="ae-date"
            value={customRange.start}
            onChange={(e) => setCustomRange((p) => ({ ...p, start: e.target.value }))}
          />
          <span className="ae-to" aria-hidden>
            →
          </span>
          <label className="ae-sr-only" htmlFor="ae-date-end">
            End date
          </label>
          <input
            id="ae-date-end"
            type="date"
            className="ae-date"
            value={customRange.end}
            onChange={(e) => setCustomRange((p) => ({ ...p, end: e.target.value }))}
          />
          {(customRange.start || customRange.end) && (
            <button type="button" className="ae-pill" onClick={() => setCustomRange({ start: '', end: '' })}>
              Clear custom
            </button>
          )}
        </div>

        <div className="ae-tool-right">
          <button
            type="button"
            className={`ae-toggle ${compareOn ? 'on' : ''}`}
            onClick={() => setCompareOn((p) => !p)}
            title="Compare with previous period"
            aria-pressed={compareOn}
          >
            <GitCompare size={14} />
            <span>Compare</span>
          </button>
          <span className="ae-sep" />
          <button
            type="button"
            className={`ae-toggle ${autoRefresh ? 'on' : ''}`}
            onClick={() => setAutoRefresh((p) => !p)}
            title="Auto-refresh"
            aria-pressed={autoRefresh}
          >
            <RefreshCw size={14} />
            <span>Auto</span>
          </button>
          {autoRefresh && (
            <>
              <label className="ae-sr-only" htmlFor="ae-refresh-interval">
                Auto-refresh interval
              </label>
              <select
                id="ae-refresh-interval"
                className="ae-mini-select"
                value={refreshMin}
                onChange={(e) => setRefreshMin(Number(e.target.value))}
              >
                {REFRESH_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <span className="ae-countdown" title="Next refresh">
                {fmtCountdown(countdown)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Tabs — scrollable on small screens */}
      <div className="ae-tabs-wrap">
        <nav className="ae-tabs" role="tablist" aria-label="Analytics sections">
          {TABS.map((t) => {
            const Icon = t.icon;
            const selected = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`ae-tab-${t.id}`}
                aria-selected={selected}
                aria-controls="ae-main-panel"
                className={`ae-tab ${selected ? 'active' : ''}`}
                onClick={() => setActiveTab(t.id)}
              >
                <Icon size={16} aria-hidden />
                <span>{t.label}</span>
              </button>
            );
          })}
          {refreshing && (
            <span className="ae-tab-badge">
              <Loader size={12} className="ae-spin" aria-hidden />
              Syncing…
            </span>
          )}
        </nav>
      </div>

      <section
        id="ae-main-panel"
        role="tabpanel"
        aria-labelledby={`ae-tab-${activeTab}`}
        className="ae-content"
      >
        {error && !showSkeleton && (
          <div className="ae-inline-alert" role="alert">
            <AlertTriangle size={18} aria-hidden />
            <span>{error}</span>
            <button type="button" className="ae-inline-retry" onClick={() => fetchAnalytics()}>
              Retry
            </button>
          </div>
        )}
        {showSkeleton ? <AnalyticsContentSkeleton /> : renderContent()}
      </section>
    </div>
  );
};

export default AnalyticsEnhanced;

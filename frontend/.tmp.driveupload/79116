// ============================================
// DASHBOARD — Enhanced v2
// Production-ready with charts, activity feed,
// trend indicators, auto-refresh, dark mode
// ============================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getSetting } from '../../utils/settingsLoader';
import { useToast } from '../../context/ToastContext';
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Ticket, Users, CheckCircle, AlertCircle,
  TrendingUp, TrendingDown, Minus, Activity, Plus,
  AlertTriangle, XCircle, Ban, PauseCircle,
  ArrowUp, RefreshCw, Zap, Clock, Eye,
  Shield, Award, Layers, ChevronRight,
  BarChart3, Calendar, UserCheck,
} from 'lucide-react';
import api from '../../services/api';
import '../../styles/Dashboard.css';

// ── Chart color palette ──
const COLORS = {
  primary: '#6366f1',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',
  purple: '#8b5cf6',
  orange: '#f97316',
  slate: '#64748b',
  teal: '#14b8a6',
};

const PIE_COLORS = ['#6366f1', '#f59e0b', '#f97316', '#10b981', '#8b5cf6', '#64748b', '#ef4444'];

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const refreshTimerRef = useRef(null);

  const systemName = getSetting('system_name', 'Nexus Support');

  const [stats, setStats] = useState(null);
  const [trend, setTrend] = useState([]);
  const [statusChart, setStatusChart] = useState([]);
  const [priorityChart, setPriorityChart] = useState([]);
  const [departmentLoad, setDepartmentLoad] = useState([]);
  const [topPerformers, setTopPerformers] = useState([]);
  const [recentTickets, setRecentTickets] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  // ── Fetch all dashboard data ──
  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const [statsRes, activityRes] = await Promise.all([
        api.get('/dashboard/stats'),
        api.get('/dashboard/activity?limit=10').catch(() => ({ data: { data: [] } })),
      ]);

      if (statsRes.data.success) {
        const d = statsRes.data.data;
        setStats(d.summary);
        setRecentTickets(d.recentTickets || []);
        setTrend(d.trend || []);
        setStatusChart((d.ticketsByStatus || []).filter(s => s.value > 0));
        setPriorityChart((d.ticketsByPriority || []).filter(p => p.value > 0));
        setDepartmentLoad(d.departmentLoad || []);
        setTopPerformers(d.topPerformers || []);
        setLastUpdated(new Date());
      }

      if (activityRes.data?.data) {
        setActivity(activityRes.data.data);
      }

      if (isRefresh) showToast('Dashboard refreshed', 'success');
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError('Failed to load dashboard data');
      if (!isRefresh) showToast('Failed to load dashboard', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showToast]);

  // ── Auto-refresh every 60s ──
  useEffect(() => {
    fetchData();
    refreshTimerRef.current = setInterval(() => fetchData(true), 60000);
    return () => clearInterval(refreshTimerRef.current);
  }, [fetchData]);

  // ── Helpers ──
  const getGreeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Good Morning' : h < 18 ? 'Good Afternoon' : 'Good Evening';
  };

  const formatDate = (d) => {
    if (!d) return 'N/A';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const timeAgo = (d) => {
    if (!d) return '';
    const s = Math.floor((Date.now() - new Date(d)) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  };

  const statusColor = (code) => ({
    OPEN: 'status-open', IN_PROGRESS: 'status-progress', PENDING: 'status-pending',
    CLOSED: 'status-closed', ON_HOLD: 'status-hold', CANCELLED: 'status-cancelled',
    ESCALATED: 'status-escalated',
  }[code] || 'status-default');

  const priorityColor = (code) => ({
    CRITICAL: 'priority-critical', HIGH: 'priority-high', MEDIUM: 'priority-medium',
    LOW: 'priority-low', PLANNING: 'priority-planning',
  }[code] || 'priority-default');

  // ── Activity icon ──
  const activityIcon = (type) => {
    const t = (type || '').toLowerCase();
    if (t.includes('creat')) return <Plus size={14} />;
    if (t.includes('assign')) return <UserCheck size={14} />;
    if (t.includes('close') || t.includes('resolv')) return <CheckCircle size={14} />;
    if (t.includes('escalat')) return <ArrowUp size={14} />;
    if (t.includes('comment') || t.includes('note')) return <Activity size={14} />;
    return <Clock size={14} />;
  };

  // ── Chart tooltip ──
  const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="db-chart-tooltip">
        <p className="db-chart-tooltip-label">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }}>
            {p.name}: <strong>{p.value}</strong>
          </p>
        ))}
      </div>
    );
  };

  // ── Loading state ──
  if (loading) {
    return (
      <div className="db-page">
        <div className="db-loading">
          <div className="db-loading-spinner" />
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (error && !stats) {
    return (
      <div className="db-page">
        <div className="db-error">
          <AlertCircle size={48} />
          <h3>Failed to load dashboard</h3>
          <p>{error}</p>
          <button className="db-retry-btn" onClick={() => fetchData()}>
            <RefreshCw size={16} /> Retry
          </button>
        </div>
      </div>
    );
  }

  const s = stats || {};

  return (
    <div className="db-page">
      <div className="db-content">

        {/* ═══ WELCOME BANNER ═══ */}
        <div className="db-welcome">
          <div className="db-welcome-left">
            <h1 className="db-greeting">
              {getGreeting()}, {user?.full_name || user?.username}!
              <span className="db-wave">👋</span>
            </h1>
            <p className="db-subtitle">
              Welcome to <strong>{systemName}</strong> — here's your overview for today
            </p>
            {lastUpdated && (
              <span className="db-last-updated">
                <Clock size={12} /> Updated {timeAgo(lastUpdated)}
              </span>
            )}
          </div>
          <div className="db-welcome-right">
            <button
              className={`db-refresh-btn ${refreshing ? 'spinning' : ''}`}
              onClick={() => fetchData(true)}
              disabled={refreshing}
              title="Refresh"
            >
              <RefreshCw size={18} />
            </button>
            <button className="db-create-btn" onClick={() => navigate('/tickets/create')}>
              <Plus size={18} />
              <span>New Ticket</span>
            </button>
          </div>
        </div>

        {/* ═══ PRIMARY STATS ROW ═══ */}
        <div className="db-stats-row">
          <StatCard
            icon={<Ticket size={22} />} label="Total Tickets" value={s.totalTickets}
            className="db-stat-total" onClick={() => navigate('/tickets')}
            trend={s.trendDirection} trendPct={s.trendPercent}
            sub={`${s.todayCreated || 0} today`}
          />
          <StatCard
            icon={<AlertCircle size={22} />} label="Open" value={s.openTickets}
            className="db-stat-open" onClick={() => navigate('/tickets?status=OPEN')}
          />
          <StatCard
            icon={<Activity size={22} />} label="In Progress" value={s.inProgressTickets}
            className="db-stat-progress" onClick={() => navigate('/tickets?status=IN_PROGRESS')}
          />
          <StatCard
            icon={<CheckCircle size={22} />} label="Closed" value={s.closedTickets}
            className="db-stat-closed" onClick={() => navigate('/tickets?status=CLOSED')}
          />
          <StatCard
            icon={<ArrowUp size={22} />} label="Escalated" value={s.escalatedTickets}
            className="db-stat-escalated" onClick={() => navigate('/tickets?escalated=true')}
          />
        </div>

        {/* ═══ SECONDARY STATS ═══ */}
        <div className="db-stats-row db-stats-secondary">
          <StatCard
            icon={<AlertTriangle size={20} />} label="Pending" value={s.pendingTickets}
            className="db-stat-pending" onClick={() => navigate('/tickets?status=PENDING')}
            compact
          />
          <StatCard
            icon={<PauseCircle size={20} />} label="On Hold" value={s.onHoldTickets}
            className="db-stat-onhold" onClick={() => navigate('/tickets?status=ON_HOLD')}
            compact
          />
          <StatCard
            icon={<Ban size={20} />} label="Cancelled" value={s.cancelledTickets}
            className="db-stat-cancelled" onClick={() => navigate('/tickets?status=CANCELLED')}
            compact
          />
          <StatCard
            icon={<Ticket size={20} />} label="My Assigned" value={s.myAssignedTickets}
            className="db-stat-assigned" onClick={() => navigate('/my-tickets')}
            compact
          />
          {s.totalUsers !== null && (
            <StatCard
              icon={<Users size={20} />} label="Users" value={s.totalUsers}
              className="db-stat-users" onClick={() => navigate('/users')}
              compact
            />
          )}
        </div>

        {/* ═══ SLA & TREND ROW ═══ */}
        <div className="db-row-2col">
          {/* SLA Performance */}
          <div className="db-card">
            <div className="db-card-header">
              <div className="db-card-title">
                <Shield size={18} />
                <h3>SLA Performance</h3>
              </div>
              <span className="db-card-badge db-badge-compliance">
                {s.slaStats?.complianceRate || 0}% Compliance
              </span>
            </div>
            <div className="db-card-body db-sla-body">
              <div className="db-sla-grid">
                <div className="db-sla-item db-sla-ontrack" onClick={() => navigate('/tickets?sla_status=ok')}>
                  <CheckCircle size={20} />
                  <div>
                    <span className="db-sla-value">{s.slaStats?.onTrack || 0}</span>
                    <span className="db-sla-label">On Track</span>
                  </div>
                </div>
                <div className="db-sla-item db-sla-atrisk" onClick={() => navigate('/tickets?sla_status=warning')}>
                  <AlertTriangle size={20} />
                  <div>
                    <span className="db-sla-value">{s.slaStats?.atRisk || 0}</span>
                    <span className="db-sla-label">At Risk</span>
                  </div>
                </div>
                <div className="db-sla-item db-sla-breached" onClick={() => navigate('/tickets?sla_status=breached')}>
                  <XCircle size={20} />
                  <div>
                    <span className="db-sla-value">{s.slaStats?.breached || 0}</span>
                    <span className="db-sla-label">Breached</span>
                  </div>
                </div>
              </div>
              {/* SLA Progress Bar */}
              <div className="db-sla-bar-wrap">
                <div className="db-sla-bar">
                  <div className="db-sla-bar-ok" style={{ width: `${((s.slaStats?.onTrack || 0) / Math.max(s.slaStats?.total || 1, 1)) * 100}%` }} />
                  <div className="db-sla-bar-warn" style={{ width: `${((s.slaStats?.atRisk || 0) / Math.max(s.slaStats?.total || 1, 1)) * 100}%` }} />
                  <div className="db-sla-bar-bad" style={{ width: `${((s.slaStats?.breached || 0) / Math.max(s.slaStats?.total || 1, 1)) * 100}%` }} />
                </div>
                <div className="db-sla-bar-labels">
                  <span className="db-sla-bar-label-ok">On Track</span>
                  <span className="db-sla-bar-label-warn">At Risk</span>
                  <span className="db-sla-bar-label-bad">Breached</span>
                </div>
              </div>
            </div>
          </div>

          {/* 7-Day Trend Chart */}
          <div className="db-card">
            <div className="db-card-header">
              <div className="db-card-title">
                <BarChart3 size={18} />
                <h3>7-Day Ticket Trend</h3>
              </div>
              <div className="db-trend-indicator">
                {s.trendDirection === 'up' && <TrendingUp size={16} className="db-trend-up" />}
                {s.trendDirection === 'down' && <TrendingDown size={16} className="db-trend-down" />}
                {s.trendDirection === 'flat' && <Minus size={16} className="db-trend-flat" />}
                {s.trendPercent > 0 && <span className={`db-trend-pct db-trend-${s.trendDirection}`}>{s.trendPercent}%</span>}
              </div>
            </div>
            <div className="db-card-body db-chart-body">
              {trend.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={trend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradCreated" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradClosed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.success} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={COLORS.success} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--db-grid, #e2e8f0)" />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--db-muted, #94a3b8)' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--db-muted, #94a3b8)' }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="created" name="Created" stroke={COLORS.primary} fill="url(#gradCreated)" strokeWidth={2} dot={{ r: 3 }} />
                    <Area type="monotone" dataKey="closed" name="Closed" stroke={COLORS.success} fill="url(#gradClosed)" strokeWidth={2} dot={{ r: 3 }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="db-chart-empty">
                  <Calendar size={32} />
                  <p>No trend data available</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ═══ CHARTS ROW ═══ */}
        <div className="db-row-3col">
          {/* Status Distribution Pie */}
          <div className="db-card">
            <div className="db-card-header">
              <div className="db-card-title">
                <Layers size={18} />
                <h3>By Status</h3>
              </div>
            </div>
            <div className="db-card-body db-chart-body db-chart-center">
              {statusChart.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={statusChart} dataKey="value" nameKey="label"
                      cx="50%" cy="50%" innerRadius={45} outerRadius={80}
                      paddingAngle={3} strokeWidth={0}
                    >
                      {statusChart.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v, n) => [`${v} tickets`, n]} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="db-chart-empty"><Layers size={32} /><p>No data</p></div>
              )}
            </div>
          </div>

          {/* Priority Distribution Bar */}
          <div className="db-card">
            <div className="db-card-header">
              <div className="db-card-title">
                <AlertTriangle size={18} />
                <h3>By Priority</h3>
              </div>
            </div>
            <div className="db-card-body db-chart-body">
              {priorityChart.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={priorityChart} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--db-grid, #e2e8f0)" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--db-muted, #94a3b8)' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--db-muted, #94a3b8)' }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="value" name="Tickets" radius={[6, 6, 0, 0]} maxBarSize={40}>
                      {priorityChart.map((entry, i) => {
                        const c = { CRITICAL: COLORS.danger, HIGH: COLORS.orange, MEDIUM: COLORS.warning, LOW: COLORS.success, PLANNING: COLORS.info };
                        return <Cell key={i} fill={c[entry.code] || COLORS.slate} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="db-chart-empty"><AlertTriangle size={32} /><p>No data</p></div>
              )}
            </div>
          </div>

          {/* Department Load */}
          <div className="db-card">
            <div className="db-card-header">
              <div className="db-card-title">
                <Users size={18} />
                <h3>Department Load</h3>
              </div>
            </div>
            <div className="db-card-body db-dept-body">
              {departmentLoad.length > 0 ? (
                <div className="db-dept-list">
                  {departmentLoad.map((dept, i) => {
                    const max = Math.max(...departmentLoad.map(d => d.count), 1);
                    return (
                      <div key={i} className="db-dept-item">
                        <div className="db-dept-info">
                          <span className="db-dept-name">{dept.name}</span>
                          <span className="db-dept-count">{dept.count}</span>
                        </div>
                        <div className="db-dept-bar-bg">
                          <div className="db-dept-bar-fill" style={{ width: `${(dept.count / max) * 100}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="db-chart-empty"><Users size={32} /><p>No active tickets</p></div>
              )}
            </div>
          </div>
        </div>

        {/* ═══ BOTTOM ROW: Tickets + Activity + Performers ═══ */}
        <div className="db-row-bottom">
          {/* Recent Tickets */}
          <div className="db-card db-card-tickets">
            <div className="db-card-header">
              <div className="db-card-title">
                <Activity size={18} />
                <h3>Recent Tickets</h3>
              </div>
              <button className="db-card-link" onClick={() => navigate('/tickets')}>
                View All <ChevronRight size={14} />
              </button>
            </div>
            <div className="db-card-body">
              {recentTickets.length === 0 ? (
                <div className="db-empty">
                  <Ticket size={40} />
                  <p>No tickets yet</p>
                  <button className="db-empty-btn" onClick={() => navigate('/tickets/create')}>
                    <Plus size={16} /> Create First Ticket
                  </button>
                </div>
              ) : (
                <div className="db-ticket-list">
                  {recentTickets.map(t => (
                    <div
                      key={t.ticket_id}
                      className="db-ticket-item"
                      onClick={() => navigate(`/tickets/${t.ticket_id}`)}
                    >
                      <div className="db-ticket-main">
                        <div className="db-ticket-top">
                          <span className="db-ticket-number">{t.ticket_number}</span>
                          <span className={`db-badge ${statusColor(t.status_code)}`}>{t.status_name}</span>
                          <span className={`db-badge ${priorityColor(t.priority_code)}`}>{t.priority_name}</span>
                        </div>
                        <span className="db-ticket-title">{t.subject}</span>
                        <div className="db-ticket-bottom">
                          <span className="db-ticket-meta">{t.requester_name}</span>
                          <span className="db-ticket-date">{formatDate(t.created_at)}</span>
                        </div>
                      </div>
                      <ChevronRight size={16} className="db-ticket-arrow" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Activity + Performers + Quick Actions */}
          <div className="db-right-col">
            {/* Activity Feed */}
            <div className="db-card">
              <div className="db-card-header">
                <div className="db-card-title">
                  <Clock size={18} />
                  <h3>Activity Feed</h3>
                </div>
              </div>
              <div className="db-card-body db-activity-body">
                {activity.length > 0 ? (
                  <div className="db-activity-list">
                    {activity.map((a, i) => (
                      <div key={a.activity_id || i} className="db-activity-item">
                        <div className="db-activity-icon">{activityIcon(a.activity_type)}</div>
                        <div className="db-activity-content">
                          <p className="db-activity-text">
                            <strong>{a.performed_by_name}</strong> {a.description?.toLowerCase() || a.activity_type}
                          </p>
                          <span className="db-activity-meta">
                            {a.ticket_number} · {timeAgo(a.performed_at)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="db-chart-empty"><Clock size={28} /><p>No recent activity</p></div>
                )}
              </div>
            </div>

            {/* Top Performers */}
            {topPerformers.length > 0 && (
              <div className="db-card">
                <div className="db-card-header">
                  <div className="db-card-title">
                    <Award size={18} />
                    <h3>Top Performers</h3>
                  </div>
                  <span className="db-card-subtitle">Last 30 days</span>
                </div>
                <div className="db-card-body db-performers-body">
                  {topPerformers.map((p, i) => (
                    <div key={i} className="db-performer-item">
                      <div className={`db-performer-rank rank-${i + 1}`}>{i + 1}</div>
                      <div className="db-performer-info">
                        <span className="db-performer-name">{p.name}</span>
                        <span className="db-performer-stat">{p.resolved} resolved · avg {p.avgHours}h</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="db-card">
              <div className="db-card-header">
                <div className="db-card-title">
                  <Zap size={18} />
                  <h3>Quick Actions</h3>
                </div>
              </div>
              <div className="db-card-body db-qa-body">
                <div className="db-qa-grid">
                  <button className="db-qa-btn db-qa-new" onClick={() => navigate('/tickets/create')}>
                    <Plus size={18} />
                    <span>New Ticket</span>
                  </button>
                  <button className="db-qa-btn db-qa-mine" onClick={() => navigate('/my-tickets')}>
                    <Eye size={18} />
                    <span>My Tickets</span>
                  </button>
                  {user?.permissions?.can_manage_users && (
                    <button className="db-qa-btn db-qa-users" onClick={() => navigate('/users')}>
                      <Users size={18} />
                      <span>Users</span>
                    </button>
                  )}
                  {user?.permissions?.can_view_analytics && (
                    <button className="db-qa-btn db-qa-analytics" onClick={() => navigate('/analytics')}>
                      <TrendingUp size={18} />
                      <span>Analytics</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

/* ══════════════════════════════════════
   STAT CARD COMPONENT
   ══════════════════════════════════════ */
const StatCard = ({ icon, label, value, className, onClick, trend, trendPct, sub, compact }) => (
  <div className={`db-stat-card ${className} ${compact ? 'db-stat-compact' : ''}`} onClick={onClick}>
    <div className="db-stat-icon">{icon}</div>
    <div className="db-stat-info">
      <span className="db-stat-label">{label}</span>
      <div className="db-stat-value-row">
        <span className="db-stat-value">{value ?? 0}</span>
        {trend && trendPct > 0 && (
          <span className={`db-stat-trend db-trend-${trend}`}>
            {trend === 'up' ? <TrendingUp size={12} /> : trend === 'down' ? <TrendingDown size={12} /> : <Minus size={12} />}
            {trendPct}%
          </span>
        )}
      </div>
      {sub && <span className="db-stat-sub">{sub}</span>}
    </div>
  </div>
);

export default Dashboard;

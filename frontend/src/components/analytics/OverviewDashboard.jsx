/**
 * ============================================
 * OVERVIEW DASHBOARD - IMMERSIVE ANALYTICS
 * ============================================
 * Full-featured analytics overview with interactive charts
 * 
 * CHARTS:
 * - KPI Cards Grid (8 cards with drill-down)
 * - Ticket Trends (Area chart - created vs closed over time)
 * - Category Distribution (Donut chart)
 * - Department Breakdown (Horizontal bar chart)
 * - Priority Distribution (Pie chart)
 * - Status Distribution (Donut chart)
 * - Top Engineers (Horizontal bar with resolution rate)
 * 
 * Uses: Recharts library (already in project)
 * ============================================
 */

import { useState, useMemo } from 'react';
import {
  TrendingUp, Clock, CheckCircle, Users, Target, ThumbsUp,
  ArrowUpCircle, Activity, X, Tag, Building2, AlertTriangle as Shield,
  Layers, Award, BarChart3, MapPin, Briefcase
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, RadialBarChart, RadialBar
} from 'recharts';

/*  Color Palette  */
const COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4'];
const PRIORITY_COLORS = { Critical: '#ef4444', High: '#f59e0b', Medium: '#3b82f6', Low: '#10b981' };

/*  Custom Tooltip  */
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="ae-chart-tooltip">
      {label && <div className="ae-chart-tooltip-label">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="ae-chart-tooltip-row">
          <span className="ae-chart-tooltip-name">
            <span className="ae-chart-tooltip-swatch" style={{ background: p.color }} />
            {p.name || p.dataKey}
          </span>
          <strong className="ae-chart-tooltip-val">
            {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
          </strong>
        </div>
      ))}
    </div>
  );
};

/*  Pie Label  */
const renderPieLabel = ({ name, percent }) => percent > 0.04 ? `${name} (${(percent * 100).toFixed(0)}%)` : '';

/*  Section Wrapper  */
const ChartSection = ({ icon: Icon, title, subtitle, children, span = 1 }) => (
  <div className={`ae-chart-section${span === 2 ? ' span-2' : ''}`}>
    <div className="ae-chart-header">
      <div className="ae-chart-icon"><Icon size={18} /></div>
      <div>
        <h3>{title}</h3>
        {subtitle && <p>{subtitle}</p>}
      </div>
    </div>
    <div className="ae-chart-body">{children}</div>
  </div>
);

/* 
   MAIN COMPONENT
    */
const OverviewDashboard = ({
  data,
  compareData,
  categoryData,
  departmentData,
  priorityData,
  statusData,
  trendsData,
  engineersData,
  locationData,
  processData,
}) => {
  if (!data) return <div className="no-data">No data available</div>;

  const [selectedKpi, setSelectedKpi] = useState(null);

  const getDelta = (current, previous) => {
    if (previous === null || previous === undefined) return null;
    return current - previous;
  };

  /*  KPI Cards  */
  const kpiCards = [
    {
      title: 'Total Tickets', value: data.total_tickets, rawValue: data.total_tickets,
      compareValue: compareData?.total_tickets,
      subtitle: `${data.open_tickets} open, ${data.closed_tickets} closed`,
      icon: Activity, color: '#6366f1',
      details: [
        { label: 'Open', value: data.open_tickets },
        { label: 'Closed', value: data.closed_tickets },
        { label: 'Auto-closed', value: data.auto_closed_count },
      ],
    },
    {
      title: 'Closure Rate', value: `${data.closure_rate}%`, rawValue: data.closure_rate,
      compareValue: compareData?.closure_rate,
      subtitle: `${data.closed_tickets} of ${data.total_tickets} resolved`,
      icon: CheckCircle, color: '#10b981',
      trend: data.closure_rate >= 80 ? 'up' : 'down',
      details: [
        { label: 'Closed', value: data.closed_tickets },
        { label: 'Open', value: data.open_tickets },
      ],
    },
    {
      title: 'Avg Resolution', value: `${data.avg_resolution_hours}h`, rawValue: data.avg_resolution_hours,
      compareValue: compareData?.avg_resolution_hours,
      subtitle: data.avg_resolution_hours <= 24 ? 'Meeting target' : 'Above target',
      icon: Clock, color: data.avg_resolution_hours <= 24 ? '#10b981' : '#f59e0b',
      trend: data.avg_resolution_hours <= 24 ? 'up' : 'down',
      details: [
        { label: 'Target', value: '24h' },
        { label: 'SLA met', value: `${data.resolution_sla_percent}%` },
      ],
    },
    {
      title: 'First Response', value: `${data.avg_first_response_minutes}m`, rawValue: data.avg_first_response_minutes,
      compareValue: compareData?.avg_first_response_minutes,
      subtitle: 'Average response time',
      icon: TrendingUp, color: '#8b5cf6',
      details: [
        { label: 'Response SLA', value: `${data.first_response_sla_percent}%` },
      ],
    },
    {
      title: 'SLA Compliance', value: `${data.resolution_sla_percent}%`, rawValue: data.resolution_sla_percent,
      compareValue: compareData?.resolution_sla_percent,
      subtitle: `${data.first_response_sla_percent}% first response`,
      icon: Target, color: data.resolution_sla_percent >= 90 ? '#10b981' : '#ef4444',
      trend: data.resolution_sla_percent >= 90 ? 'up' : 'down',
      details: [
        { label: 'First response', value: `${data.first_response_sla_percent}%` },
        { label: 'Resolution', value: `${data.resolution_sla_percent}%` },
      ],
    },
    {
      title: 'Satisfaction', value: data.avg_csat_rating > 0 ? `${data.avg_csat_rating}/5` : 'N/A',
      rawValue: data.avg_csat_rating, compareValue: compareData?.avg_csat_rating,
      subtitle: `${data.csat_response_rate}% response rate`,
      icon: ThumbsUp, color: '#ec4899',
      trend: data.avg_csat_rating >= 4 ? 'up' : data.avg_csat_rating >= 3 ? 'neutral' : 'down',
      details: [
        { label: 'Response rate', value: `${data.csat_response_rate}%` },
        { label: 'Rated', value: data.total_rated_tickets },
      ],
    },
    {
      title: 'Escalation Rate', value: `${data.escalation_rate}%`, rawValue: data.escalation_rate,
      compareValue: compareData?.escalation_rate,
      subtitle: `${data.escalated_tickets} escalated`,
      icon: ArrowUpCircle, color: data.escalation_rate < 5 ? '#10b981' : '#f59e0b',
      trend: data.escalation_rate < 5 ? 'down' : 'up',
      details: [
        { label: 'Escalated', value: data.escalated_tickets },
        { label: 'Open', value: data.open_tickets },
      ],
    },
    {
      title: 'Active Agents', value: data.active_agents, rawValue: data.active_agents,
      compareValue: compareData?.active_agents,
      subtitle: `${data.tickets_per_agent} tickets/agent`,
      icon: Users, color: '#3b82f6',
      details: [
        { label: 'Per agent', value: data.tickets_per_agent },
        { label: 'Departments', value: data.active_departments },
      ],
    },
  ];

  /*  Prepared chart data  */
  const categoryChartData = useMemo(() =>
    (categoryData || []).filter(c => c.count > 0).map((c, i) => ({
      name: c.category_name, value: c.count, fill: COLORS[i % COLORS.length]
    })), [categoryData]);

  const departmentChartData = useMemo(() =>
    (departmentData || []).map(d => ({
      name: d.department_name,
      open: d.open_tickets,
      closed: d.closed_tickets,
      total: d.total_tickets,
    })), [departmentData]);

  const priorityChartData = useMemo(() =>
    (priorityData || []).filter(p => p.count > 0).map(p => ({
      name: p.priority_name, value: p.count,
      fill: PRIORITY_COLORS[p.priority_name] || p.color_code || '#6366f1',
    })), [priorityData]);

  const statusChartData = useMemo(() =>
    (statusData || []).filter(s => s.count > 0).map((s, i) => ({
      name: s.status_name, value: s.count,
      fill: s.color_code || COLORS[i % COLORS.length],
    })), [statusData]);

  const trendsChartData = useMemo(() =>
    (trendsData || []).map(t => ({
      date: t.date?.slice(5) || t.date,
      Created: t.tickets_created,
      Closed: t.tickets_closed,
    })), [trendsData]);

  const engineersChartData = useMemo(() =>
    (engineersData || []).slice(0, 8).map(e => ({
      name: e.engineer_name?.split(' ')[0] || 'Agent',
      resolved: e.tickets_resolved,
      assigned: e.total_assigned,
      rate: e.resolution_rate,
      avgHours: e.avg_resolution_hours,
    })), [engineersData]);

  const locationChartData = useMemo(() =>
    (locationData || []).filter(l => l.total_tickets > 0).map((l, i) => ({
      name: l.location_name,
      open: l.open_tickets,
      closed: l.closed_tickets,
      total: l.total_tickets,
      fill: COLORS[i % COLORS.length],
    })), [locationData]);

  const processChartData = useMemo(() =>
    (processData || []).filter(p => p.total_tickets > 0).map((p, i) => ({
      name: p.process_name,
      open: p.open_tickets,
      closed: p.closed_tickets,
      total: p.total_tickets,
      fill: COLORS[(i + 3) % COLORS.length],
    })), [processData]);

  /*  Open/Closed radial data  */
  const openClosedRadial = useMemo(() => [
    { name: 'Closed', value: data.closure_rate, fill: '#10b981' },
  ], [data.closure_rate]);

  return (
    <div className="overview-dashboard">
      {/*  KPI CARDS GRID  */}
      <div className="kpi-grid">
        {kpiCards.map((card, index) => {
          const Icon = card.icon;
          const delta = getDelta(card.rawValue, card.compareValue);
          return (
            <button key={index} className="kpi-card interactive" style={{ borderTopColor: card.color }}
              onClick={() => setSelectedKpi(card)} type="button"
            >
              <div className="kpi-header">
                <div className="kpi-icon" style={{ backgroundColor: `${card.color}15`, color: card.color }}>
                  <Icon size={24} />
                </div>
                {card.trend && (
                  <span className={`kpi-trend trend-${card.trend}`}>
                    {card.trend === 'up' && '\u2197'}{card.trend === 'down' && '\u2198'}{card.trend === 'neutral' && '\u2192'}
                  </span>
                )}
              </div>
              <div className="kpi-body">
                <div className="kpi-value">{card.value}</div>
                <div className="kpi-title">{card.title}</div>
                <div className="kpi-subtitle">{card.subtitle}</div>
                {delta !== null && !Number.isNaN(delta) && (
                  <div className={`kpi-delta ${delta >= 0 ? 'positive' : 'negative'}`}>
                    {delta >= 0 ? '+' : ''}{Math.round(delta * 10) / 10} vs prev
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* KPI Detail Drawer */}
      {selectedKpi && (
        <div className="kpi-drawer-backdrop" onClick={() => setSelectedKpi(null)}>
          <div className="kpi-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div><h3>{selectedKpi.title}</h3><p>{selectedKpi.subtitle}</p></div>
              <button className="drawer-close" onClick={() => setSelectedKpi(null)} type="button"><X size={18} /></button>
            </div>
            <div className="drawer-metric">
              <span className="drawer-label">Current</span>
              <span className="drawer-value">{selectedKpi.value}</span>
            </div>
            {selectedKpi.compareValue != null && (
              <div className="drawer-metric">
                <span className="drawer-label">Previous Period</span>
                <span className="drawer-value">{selectedKpi.compareValue}</span>
              </div>
            )}
            <div className="drawer-grid">
              {selectedKpi.details.map((item, i) => (
                <div key={i} className="drawer-item"><span>{item.label}</span><strong>{item.value}</strong></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/*  QUICK STATS BAR  */}
      <div className="quick-stats">
        <div className="stat-item"><span className="stat-label">Today:</span><span className="stat-value">{data.tickets_today} tickets</span></div>
        <div className="stat-divider">|</div>
        <div className="stat-item"><span className="stat-label">This Week:</span><span className="stat-value">{data.tickets_this_week} tickets</span></div>
        <div className="stat-divider">|</div>
        <div className="stat-item"><span className="stat-label">This Month:</span><span className="stat-value">{data.tickets_this_month} tickets</span></div>
        <div className="stat-divider">|</div>
        <div className="stat-item"><span className="stat-label">Auto-Closed:</span><span className="stat-value">{data.auto_closed_count} tickets</span></div>
      </div>

      {/*  CHARTS 2-COLUMN GRID  */}
      <div className="ae-charts-grid">

        {/*  1. TICKET TRENDS (Full Width)  */}
        {trendsChartData.length > 0 && (
          <ChartSection icon={TrendingUp} title="Ticket Trends" subtitle="Created vs Closed over time" span={2}>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={trendsChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gCreated" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gClosed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.08)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="Created" stroke="#6366f1" fill="url(#gCreated)" strokeWidth={2.5} dot={false} activeDot={{ r: 5, stroke: '#6366f1', strokeWidth: 2, fill: '#fff' }} />
                <Area type="monotone" dataKey="Closed" stroke="#10b981" fill="url(#gClosed)" strokeWidth={2.5} dot={false} activeDot={{ r: 5, stroke: '#10b981', strokeWidth: 2, fill: '#fff' }} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartSection>
        )}

        {/*  2. CATEGORY DISTRIBUTION  */}
        {categoryChartData.length > 0 && (
          <ChartSection icon={Tag} title="Category Distribution" subtitle="Tickets by category">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryChartData} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" innerRadius={60} outerRadius={110}
                  paddingAngle={3} label={renderPieLabel}
                  style={{ fontSize: 11 }}
                >
                  {categoryChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} stroke="none" />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="ae-chart-legend">
              {categoryChartData.map((c, i) => (
                <div key={i} className="ae-legend-item">
                  <span className="ae-legend-dot" style={{ background: c.fill }} />
                  <span className="ae-legend-label">{c.name}</span>
                  <span className="ae-legend-value">{c.value}</span>
                </div>
              ))}
            </div>
          </ChartSection>
        )}

        {/*  3. PRIORITY DISTRIBUTION  */}
        {priorityChartData.length > 0 && (
          <ChartSection icon={Shield} title="Priority Distribution" subtitle="Tickets by priority level">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={priorityChartData} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" outerRadius={110}
                  paddingAngle={2} label={renderPieLabel}
                  style={{ fontSize: 11 }}
                >
                  {priorityChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} stroke="none" />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="ae-chart-legend">
              {priorityChartData.map((p, i) => (
                <div key={i} className="ae-legend-item">
                  <span className="ae-legend-dot" style={{ background: p.fill }} />
                  <span className="ae-legend-label">{p.name}</span>
                  <span className="ae-legend-value">{p.value}</span>
                </div>
              ))}
            </div>
          </ChartSection>
        )}

        {/*  4. DEPARTMENT BREAKDOWN (Full Width)  */}
        {departmentChartData.length > 0 && (
          <ChartSection icon={Building2} title="Department Breakdown" subtitle="Open vs Closed tickets per department" span={2}>
            <ResponsiveContainer width="100%" height={Math.max(250, departmentChartData.length * 48)}>
              <BarChart data={departmentChartData} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.08)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="open" name="Open" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={16} />
                <Bar dataKey="closed" name="Closed" fill="#10b981" radius={[0, 4, 4, 0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </ChartSection>
        )}

        {/*  5. STATUS DISTRIBUTION  */}
        {statusChartData.length > 0 && (
          <ChartSection icon={Layers} title="Status Distribution" subtitle="Current ticket status breakdown">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusChartData} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" innerRadius={55} outerRadius={110}
                  paddingAngle={3} label={renderPieLabel}
                  style={{ fontSize: 11 }}
                >
                  {statusChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} stroke="none" />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="ae-chart-legend">
              {statusChartData.map((s, i) => (
                <div key={i} className="ae-legend-item">
                  <span className="ae-legend-dot" style={{ background: s.fill }} />
                  <span className="ae-legend-label">{s.name}</span>
                  <span className="ae-legend-value">{s.value}</span>
                </div>
              ))}
            </div>
          </ChartSection>
        )}

        {/*  6. TOP ENGINEERS  */}
        {engineersChartData.length > 0 && (
          <ChartSection icon={Award} title="Top Engineers" subtitle="Resolved tickets & resolution rate">
            <ResponsiveContainer width="100%" height={Math.max(250, engineersChartData.length * 40)}>
              <BarChart data={engineersChartData} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.08)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="resolved" name="Resolved" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={14} />
                <Bar dataKey="assigned" name="Assigned" fill="#a5b4fc" radius={[0, 4, 4, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
            <div className="ae-chart-legend">
              {engineersChartData.map((e, i) => (
                <div key={i} className="ae-legend-item">
                  <span className="ae-legend-dot" style={{ background: '#6366f1' }} />
                  <span className="ae-legend-label">{e.name}</span>
                  <span className="ae-legend-value">{e.rate}% rate ({e.avgHours}h avg)</span>
                </div>
              ))}
            </div>
          </ChartSection>
        )}

        {/*  7. LOCATION DISTRIBUTION (Full Width)  */}
        {locationChartData.length > 0 && (
          <ChartSection icon={MapPin} title="Location Distribution" subtitle="Tickets by location" span={2}>
            <ResponsiveContainer width="100%" height={Math.max(220, locationChartData.length * 50)}>
              <BarChart data={locationChartData} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.08)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="open" name="Open" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={16} stackId="loc" />
                <Bar dataKey="closed" name="Closed" fill="#10b981" radius={[0, 4, 4, 0]} barSize={16} stackId="loc" />
              </BarChart>
            </ResponsiveContainer>
            <div className="ae-chart-legend">
              {locationChartData.map((l, i) => (
                <div key={i} className="ae-legend-item">
                  <span className="ae-legend-dot" style={{ background: l.fill }} />
                  <span className="ae-legend-label">{l.name}</span>
                  <span className="ae-legend-value">{l.total} tickets</span>
                </div>
              ))}
            </div>
          </ChartSection>
        )}

        {/*  8. PROCESS DISTRIBUTION (Full Width)  */}
        {processChartData.length > 0 && (
          <ChartSection icon={Briefcase} title="Process Distribution" subtitle="Tickets by process" span={2}>
            <ResponsiveContainer width="100%" height={Math.max(220, processChartData.length * 50)}>
              <BarChart data={processChartData} layout="vertical" margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.08)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: '#6b7280' }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="open" name="Open" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={16} stackId="proc" />
                <Bar dataKey="closed" name="Closed" fill="#14b8a6" radius={[0, 4, 4, 0]} barSize={16} stackId="proc" />
              </BarChart>
            </ResponsiveContainer>
            <div className="ae-chart-legend">
              {processChartData.map((p, i) => (
                <div key={i} className="ae-legend-item">
                  <span className="ae-legend-dot" style={{ background: p.fill }} />
                  <span className="ae-legend-label">{p.name}</span>
                  <span className="ae-legend-value">{p.total} tickets</span>
                </div>
              ))}
            </div>
          </ChartSection>
        )}

        {/*  9. CLOSURE RATE RADIAL  */}
        <ChartSection icon={BarChart3} title="Closure Rate" subtitle={`${data.closure_rate}% of tickets resolved`}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <ResponsiveContainer width="100%" height={250}>
              <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="90%" startAngle={90} endAngle={-270} data={openClosedRadial} barSize={18}>
                <RadialBar background clockWise dataKey="value" cornerRadius={12} fill="#10b981" />
              </RadialBarChart>
            </ResponsiveContainer>
            <div style={{ position: 'absolute', textAlign: 'center' }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: '#10b981', lineHeight: 1 }}>{data.closure_rate}%</div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Resolved</div>
            </div>
          </div>
        </ChartSection>
      </div>

      {/*  INSIGHTS  */}
      <div className="dashboard-insights">
        <div className="insight-card">
          <h3>Performance Summary</h3>
          <ul className="insight-list">
            <li className={data.closure_rate >= 80 ? 'positive' : 'negative'}>
              {data.closure_rate >= 80 ? '\u2713' : '\u26A0'} Closure rate: {data.closure_rate}%
              {data.closure_rate >= 80 ? ' (Excellent)' : ' (Needs Improvement)'}
            </li>
            <li className={data.resolution_sla_percent >= 90 ? 'positive' : 'negative'}>
              {data.resolution_sla_percent >= 90 ? '\u2713' : '\u26A0'} SLA Compliance: {data.resolution_sla_percent}%
              {data.resolution_sla_percent >= 90 ? ' (Meeting Target)' : ' (Below Target)'}
            </li>
            <li className={data.avg_csat_rating >= 4 ? 'positive' : data.avg_csat_rating >= 3 ? 'neutral' : 'negative'}>
              {data.avg_csat_rating >= 4 ? '\u2713' : data.avg_csat_rating >= 3 ? '\u2192' : '\u26A0'}
              {' '}Satisfaction: {data.avg_csat_rating}/5
              {data.avg_csat_rating >= 4 ? ' (Excellent)' : data.avg_csat_rating >= 3 ? ' (Good)' : ' (Poor)'}
            </li>
            <li className={data.escalation_rate < 5 ? 'positive' : 'neutral'}>
              {data.escalation_rate < 5 ? '\u2713' : '\u2192'} Escalation Rate: {data.escalation_rate}%
              {data.escalation_rate < 5 ? ' (Low)' : ' (Moderate)'}
            </li>
          </ul>
        </div>

        <div className="insight-card">
          <h3>Key Recommendations</h3>
          <ul className="insight-list">
            {data.open_tickets > data.closed_tickets && (
              <li className="warning">{'\u2192'} High open ticket backlog ({data.open_tickets}). Consider reallocating resources.</li>
            )}
            {data.avg_resolution_hours > 24 && (
              <li className="warning">{'\u2192'} Average resolution time ({data.avg_resolution_hours}h) exceeds 24h target.</li>
            )}
            {data.resolution_sla_percent < 90 && (
              <li className="warning">{'\u2192'} SLA compliance below 90%. Focus on meeting deadlines.</li>
            )}
            {data.avg_csat_rating < 3 && data.total_rated_tickets > 0 && (
              <li className="warning">{'\u2192'} Customer satisfaction is low. Review service quality.</li>
            )}
            {data.closure_rate >= 80 && data.resolution_sla_percent >= 90 && data.avg_csat_rating >= 4 && (
              <li className="positive">{'\u2713'} All key metrics performing well. Maintain current standards!</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default OverviewDashboard;

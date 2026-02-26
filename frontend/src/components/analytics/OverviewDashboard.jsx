import { useState } from 'react';
import { TrendingUp, Clock, CheckCircle, Users, Target, ThumbsUp, ArrowUpCircle, Activity, X } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const OverviewDashboard = ({ data, compareData }) => {
  if (!data) return <div className="no-data">No data available</div>;

  const [selectedKpi, setSelectedKpi] = useState(null);

  const getDelta = (current, previous) => {
    if (previous === null || previous === undefined) return null;
    return current - previous;
  };

  // KPI Cards Configuration
  const kpiCards = [
    {
      title: 'Total Tickets',
      value: data.total_tickets,
      rawValue: data.total_tickets,
      compareValue: compareData?.total_tickets,
      subtitle: `${data.open_tickets} open, ${data.closed_tickets} closed`,
      icon: Activity,
      color: '#6366f1',
      trend: null,
      details: [
        { label: 'Open tickets', value: data.open_tickets },
        { label: 'Closed tickets', value: data.closed_tickets },
        { label: 'Auto-closed', value: data.auto_closed_count },
      ],
    },
    {
      title: 'Closure Rate',
      value: `${data.closure_rate}%`,
      rawValue: data.closure_rate,
      compareValue: compareData?.closure_rate,
      subtitle: `${data.closed_tickets} of ${data.total_tickets} resolved`,
      icon: CheckCircle,
      color: '#10b981',
      trend: data.closure_rate >= 80 ? 'up' : 'down',
      details: [
        { label: 'Closed tickets', value: data.closed_tickets },
        { label: 'Open tickets', value: data.open_tickets },
      ],
    },
    {
      title: 'Avg Resolution Time',
      value: `${data.avg_resolution_hours}h`,
      rawValue: data.avg_resolution_hours,
      compareValue: compareData?.avg_resolution_hours,
      subtitle: data.avg_resolution_hours <= 24 ? 'Meeting target' : 'Above target',
      icon: Clock,
      color: data.avg_resolution_hours <= 24 ? '#10b981' : '#f59e0b',
      trend: data.avg_resolution_hours <= 24 ? 'up' : 'down',
      details: [
        { label: 'Target', value: '24h' },
        { label: 'SLA met', value: `${data.resolution_sla_percent}%` },
      ],
    },
    {
      title: 'First Response Time',
      value: `${data.avg_first_response_minutes} min`,
      rawValue: data.avg_first_response_minutes,
      compareValue: compareData?.avg_first_response_minutes,
      subtitle: 'Average response time',
      icon: TrendingUp,
      color: '#8b5cf6',
      trend: null,
      details: [
        { label: 'First-response SLA', value: `${data.first_response_sla_percent}%` },
      ],
    },
    {
      title: 'SLA Compliance',
      value: `${data.resolution_sla_percent}%`,
      rawValue: data.resolution_sla_percent,
      compareValue: compareData?.resolution_sla_percent,
      subtitle: `${data.first_response_sla_percent}% first response`,
      icon: Target,
      color: data.resolution_sla_percent >= 90 ? '#10b981' : '#ef4444',
      trend: data.resolution_sla_percent >= 90 ? 'up' : 'down',
      details: [
        { label: 'First response', value: `${data.first_response_sla_percent}%` },
        { label: 'Resolution SLA', value: `${data.resolution_sla_percent}%` },
      ],
    },
    {
      title: 'Customer Satisfaction',
      value: data.avg_csat_rating > 0 ? `${data.avg_csat_rating}/5` : 'N/A',
      rawValue: data.avg_csat_rating,
      compareValue: compareData?.avg_csat_rating,
      subtitle: `${data.csat_response_rate}% response rate`,
      icon: ThumbsUp,
      color: '#ec4899',
      trend: data.avg_csat_rating >= 4 ? 'up' : data.avg_csat_rating >= 3 ? 'neutral' : 'down',
      details: [
        { label: 'Response rate', value: `${data.csat_response_rate}%` },
        { label: 'Rated tickets', value: data.total_rated_tickets },
      ],
    },
    {
      title: 'Escalation Rate',
      value: `${data.escalation_rate}%`,
      rawValue: data.escalation_rate,
      compareValue: compareData?.escalation_rate,
      subtitle: `${data.escalated_tickets} escalated`,
      icon: ArrowUpCircle,
      color: data.escalation_rate < 5 ? '#10b981' : '#f59e0b',
      trend: data.escalation_rate < 5 ? 'down' : 'up',
      details: [
        { label: 'Escalated tickets', value: data.escalated_tickets },
        { label: 'Open tickets', value: data.open_tickets },
      ],
    },
    {
      title: 'Active Agents',
      value: data.active_agents,
      rawValue: data.active_agents,
      compareValue: compareData?.active_agents,
      subtitle: `${data.tickets_per_agent} tickets per agent`,
      icon: Users,
      color: '#3b82f6',
      trend: null,
      details: [
        { label: 'Tickets per agent', value: data.tickets_per_agent },
        { label: 'Active departments', value: data.active_departments },
      ],
    },
  ];

  return (
    <div className="overview-dashboard">
      {/* KPI Grid */}
      <div className="kpi-grid">
        {kpiCards.map((card, index) => {
          const Icon = card.icon;
          const delta = getDelta(card.rawValue, card.compareValue);
          return (
            <button
              key={index}
              className="kpi-card interactive"
              style={{ borderTopColor: card.color }}
              onClick={() => setSelectedKpi(card)}
              type="button"
            >
              <div className="kpi-header">
                <div className="kpi-icon" style={{ backgroundColor: `${card.color}15`, color: card.color }}>
                  <Icon size={24} />
                </div>
                {card.trend && (
                  <span className={`kpi-trend trend-${card.trend}`}>
                    {card.trend === 'up' && '↗'}
                    {card.trend === 'down' && '↘'}
                    {card.trend === 'neutral' && '→'}
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

      {selectedKpi && (
        <div className="kpi-drawer-backdrop" onClick={() => setSelectedKpi(null)}>
          <div className="kpi-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <h3>{selectedKpi.title}</h3>
                <p>{selectedKpi.subtitle}</p>
              </div>
              <button className="drawer-close" onClick={() => setSelectedKpi(null)} type="button">
                <X size={18} />
              </button>
            </div>
            <div className="drawer-metric">
              <span className="drawer-label">Current</span>
              <span className="drawer-value">{selectedKpi.value}</span>
            </div>
            {selectedKpi.compareValue !== undefined && selectedKpi.compareValue !== null && (
              <div className="drawer-metric">
                <span className="drawer-label">Previous period</span>
                <span className="drawer-value">{selectedKpi.compareValue}</span>
              </div>
            )}
            <div className="drawer-grid">
              {selectedKpi.details.map((item, index) => (
                <div key={index} className="drawer-item">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats Bar */}
      <div className="quick-stats">
        <div className="stat-item">
          <span className="stat-label">Today:</span>
          <span className="stat-value">{data.tickets_today} tickets</span>
        </div>
        <div className="stat-divider">|</div>
        <div className="stat-item">
          <span className="stat-label">This Week:</span>
          <span className="stat-value">{data.tickets_this_week} tickets</span>
        </div>
        <div className="stat-divider">|</div>
        <div className="stat-item">
          <span className="stat-label">This Month:</span>
          <span className="stat-value">{data.tickets_this_month} tickets</span>
        </div>
        <div className="stat-divider">|</div>
        <div className="stat-item">
          <span className="stat-label">Auto-Closed:</span>
          <span className="stat-value">{data.auto_closed_count} tickets</span>
        </div>
      </div>

      {/* Dashboard Insights */}
      <div className="dashboard-insights">
        <div className="insight-card">
          <h3>Performance Summary</h3>
          <ul className="insight-list">
            <li className={data.closure_rate >= 80 ? 'positive' : 'negative'}>
              {data.closure_rate >= 80 ? '✓' : '⚠'} Closure rate: {data.closure_rate}% 
              {data.closure_rate >= 80 ? ' (Excellent)' : ' (Needs Improvement)'}
            </li>
            <li className={data.resolution_sla_percent >= 90 ? 'positive' : 'negative'}>
              {data.resolution_sla_percent >= 90 ? '✓' : '⚠'} SLA Compliance: {data.resolution_sla_percent}%
              {data.resolution_sla_percent >= 90 ? ' (Meeting Target)' : ' (Below Target)'}
            </li>
            <li className={data.avg_csat_rating >= 4 ? 'positive' : data.avg_csat_rating >= 3 ? 'neutral' : 'negative'}>
              {data.avg_csat_rating >= 4 ? '✓' : data.avg_csat_rating >= 3 ? '→' : '⚠'} 
              Customer Satisfaction: {data.avg_csat_rating}/5
              {data.avg_csat_rating >= 4 ? ' (Excellent)' : data.avg_csat_rating >= 3 ? ' (Good)' : ' (Poor)'}
            </li>
            <li className={data.escalation_rate < 5 ? 'positive' : 'neutral'}>
              {data.escalation_rate < 5 ? '✓' : '→'} Escalation Rate: {data.escalation_rate}%
              {data.escalation_rate < 5 ? ' (Low)' : ' (Moderate)'}
            </li>
          </ul>
        </div>

        <div className="insight-card">
          <h3>Key Recommendations</h3>
          <ul className="insight-list">
            {data.open_tickets > data.closed_tickets && (
              <li className="warning">
                → High open ticket backlog ({data.open_tickets}). Consider reallocating resources.
              </li>
            )}
            {data.avg_resolution_hours > 24 && (
              <li className="warning">
                → Average resolution time ({data.avg_resolution_hours}h) exceeds 24h target. Review workflow efficiency.
              </li>
            )}
            {data.resolution_sla_percent < 90 && (
              <li className="warning">
                → SLA compliance below 90%. Focus on meeting response and resolution deadlines.
              </li>
            )}
            {data.avg_csat_rating < 3 && data.total_rated_tickets > 0 && (
              <li className="warning">
                → Customer satisfaction is low. Review service quality and communication.
              </li>
            )}
            {data.closure_rate >= 80 && data.resolution_sla_percent >= 90 && data.avg_csat_rating >= 4 && (
              <li className="positive">
                ✓ All key metrics are performing well. Maintain current standards!
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default OverviewDashboard;

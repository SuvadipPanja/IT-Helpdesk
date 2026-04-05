import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  GitPullRequest, CheckCircle, XCircle, Clock, AlertTriangle,
  Users, RotateCcw, Shield, TrendingUp, Activity,
} from 'lucide-react';

const COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#06b6d4'];
const RISK_COLORS = { LOW: '#10b981', MEDIUM: '#f59e0b', HIGH: '#f97316', CRITICAL: '#ef4444' };
const TYPE_COLORS = { STANDARD: '#3b82f6', NORMAL: '#f59e0b', EMERGENCY: '#ef4444' };

const fmt = (v) => (v != null ? v : '—');
const pct = (v) => (v != null ? `${v}%` : '—');

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="ae-chart-tooltip">
      <p style={{ fontWeight: 600, marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="ae-chart-tooltip-row" style={{ color: p.color }}>
          <span>{p.name}:</span> <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
};

const CRAnalytics = ({ data }) => {
  if (!data) return <div className="no-data">No CR analytics data available for the selected period.</div>;

  const { kpis, by_status, by_type, by_risk, by_category, trend, monthly, top_implementers, approval_performance } = data;
  const k = kpis || {};

  const kpiCards = [
    { label: 'Total CRs', value: k.total_crs, icon: GitPullRequest, color: '#f97316' },
    { label: 'Active CRs', value: k.active_crs, icon: Activity, color: '#6366f1' },
    { label: 'Completed', value: k.completed_crs, icon: CheckCircle, color: '#10b981' },
    { label: 'Success Rate', value: pct(k.success_rate), icon: Shield, color: '#10b981', raw: k.success_rate },
    { label: 'Approval Rate', value: pct(k.approval_rate), icon: TrendingUp, color: '#3b82f6', raw: k.approval_rate },
    { label: 'Rollback Rate', value: pct(k.rollback_rate), icon: RotateCcw, color: '#ef4444', raw: k.rollback_rate },
    { label: 'Avg Approval Time', value: k.avg_approval_hours != null ? `${k.avg_approval_hours}h` : '—', icon: Clock, color: '#f59e0b' },
    { label: 'Pending Approvals', value: k.pending_approvals, icon: AlertTriangle, color: '#f59e0b' },
  ];

  const statusData = (by_status || []).filter(s => s.value > 0);
  const typeData = (by_type || []).filter(t => t.value > 0);
  const riskData = (by_risk || []).filter(r => r.value > 0);
  const catData = (by_category || []).filter(c => c.value > 0);

  return (
    <div className="cr-analytics">
      {/* KPI Cards */}
      <div className="kpi-grid">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="kpi-card">
              <div className="kpi-header">
                <div className="kpi-icon" style={{ background: `${kpi.color}18`, color: kpi.color }}>
                  <Icon size={20} />
                </div>
              </div>
              <div className="kpi-body">
                <div className="kpi-value">{kpi.value ?? 0}</div>
                <div className="kpi-title">{kpi.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Trend Chart (Volume over time) */}
      {trend && trend.length > 0 && (
        <div className="ae-chart-section span-2">
          <div className="ae-chart-header">
            <Activity size={16} className="ae-chart-icon" />
            <h3>CR Volume Trend</h3>
          </div>
          <div className="ae-chart-body">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={trend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradCrCreated" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradCrCompleted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color, #e2e8f0)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="created" name="Created" stroke="#f97316" fill="url(#gradCrCreated)" strokeWidth={2} dot={{ r: 3 }} />
                <Area type="monotone" dataKey="completed" name="Completed" stroke="#10b981" fill="url(#gradCrCompleted)" strokeWidth={2} dot={{ r: 3 }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Charts Grid */}
      <div className="ae-chart-grid">
        {/* Status Distribution */}
        <div className="ae-chart-section">
          <div className="ae-chart-header">
            <GitPullRequest size={16} className="ae-chart-icon" />
            <h3>By Status</h3>
          </div>
          <div className="ae-chart-body">
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={40} outerRadius={75} paddingAngle={3} strokeWidth={0}>
                    {statusData.map((entry, i) => (
                      <Cell key={i} fill={entry.color || COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [`${v} CRs`, n]} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="ae-chart-empty">No status data</div>}
          </div>
        </div>

        {/* Type Distribution */}
        <div className="ae-chart-section">
          <div className="ae-chart-header">
            <Shield size={16} className="ae-chart-icon" />
            <h3>By Type</h3>
          </div>
          <div className="ae-chart-body">
            {typeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={typeData} dataKey="value" nameKey="label" cx="50%" cy="50%" innerRadius={40} outerRadius={75} paddingAngle={3} strokeWidth={0}>
                    {typeData.map((entry, i) => (
                      <Cell key={i} fill={TYPE_COLORS[entry.code] || COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [`${v} CRs`, n]} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="ae-chart-empty">No type data</div>}
          </div>
        </div>

        {/* Risk Distribution */}
        <div className="ae-chart-section">
          <div className="ae-chart-header">
            <AlertTriangle size={16} className="ae-chart-icon" />
            <h3>By Risk Level</h3>
          </div>
          <div className="ae-chart-body">
            {riskData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={riskData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color, #e2e8f0)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="value" name="CRs" radius={[6, 6, 0, 0]} maxBarSize={40}>
                    {riskData.map((entry, i) => (
                      <Cell key={i} fill={RISK_COLORS[entry.label] || COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="ae-chart-empty">No risk data</div>}
          </div>
        </div>

        {/* Category Distribution */}
        <div className="ae-chart-section">
          <div className="ae-chart-header">
            <Activity size={16} className="ae-chart-icon" />
            <h3>By Category</h3>
          </div>
          <div className="ae-chart-body">
            {catData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={catData} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color, #e2e8f0)" />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis dataKey="label" type="category" width={110} tick={{ fontSize: 10 }} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="value" name="CRs" fill="#8b5cf6" radius={[0, 6, 6, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="ae-chart-empty">No category data</div>}
          </div>
        </div>
      </div>

      {/* Monthly Success vs Rollback */}
      {monthly && monthly.length > 0 && (
        <div className="ae-chart-section span-2">
          <div className="ae-chart-header">
            <CheckCircle size={16} className="ae-chart-icon" />
            <h3>Monthly Success vs Rollback</h3>
          </div>
          <div className="ae-chart-body">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={monthly} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color, #e2e8f0)" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="completed" name="Completed" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} maxBarSize={32} />
                <Bar dataKey="rolled_back" name="Rolled Back" stackId="a" fill="#ef4444" radius={[6, 6, 0, 0]} maxBarSize={32} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Bottom Row: Top Implementers + Approval Performance */}
      <div className="ae-chart-grid ae-chart-grid--2col">
        {/* Top Implementers */}
        {top_implementers && top_implementers.length > 0 && (
          <div className="ae-chart-section">
            <div className="ae-chart-header">
              <Users size={16} className="ae-chart-icon" />
              <h3>Top Implementers</h3>
            </div>
            <div className="ae-chart-body">
              <div className="cr-table-wrap">
                <table className="cr-analytics-table">
                  <thead>
                    <tr>
                      <th>Implementer</th>
                      <th>Total</th>
                      <th>Done</th>
                      <th>Rollback</th>
                      <th>Avg Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top_implementers.map((r, i) => (
                      <tr key={i}>
                        <td className="cr-table-name">{r.name}</td>
                        <td>{r.total}</td>
                        <td className="cr-table-success">{r.completed}</td>
                        <td className="cr-table-danger">{r.rolled_back}</td>
                        <td>{fmt(r.avg_impl_hours)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Approval Performance */}
        {approval_performance && approval_performance.length > 0 && (
          <div className="ae-chart-section">
            <div className="ae-chart-header">
              <Clock size={16} className="ae-chart-icon" />
              <h3>Approval Performance</h3>
            </div>
            <div className="ae-chart-body">
              <div className="cr-table-wrap">
                <table className="cr-analytics-table">
                  <thead>
                    <tr>
                      <th>Approver</th>
                      <th>Reviews</th>
                      <th>Approved</th>
                      <th>Rejected</th>
                      <th>Avg Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {approval_performance.map((r, i) => (
                      <tr key={i}>
                        <td className="cr-table-name">{r.name}</td>
                        <td>{r.total_reviews}</td>
                        <td className="cr-table-success">{r.approved}</td>
                        <td className="cr-table-danger">{r.rejected}</td>
                        <td>{fmt(r.avg_review_hours)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CRAnalytics;

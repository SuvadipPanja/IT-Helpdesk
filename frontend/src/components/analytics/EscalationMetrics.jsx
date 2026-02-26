import { ArrowUpCircle, AlertTriangle } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const EscalationMetrics = ({ data }) => {
  if (!data || !data.overview) return <div className="no-data">No escalation data available</div>;

  const { overview, by_priority, by_department, reasons } = data;

  // Handle zero escalations state
  if (overview.total_escalations === 0) {
    return (
      <div className="escalation-metrics">
        <div className="escalation-summary">
          <div className="esc-card">
            <div className="esc-icon">
              <ArrowUpCircle size={40} color="#10b981" />
            </div>
            <div className="esc-details">
              <div className="esc-value" style={{ color: '#10b981' }}>0</div>
              <div className="esc-label">Escalations</div>
              <div className="esc-subtitle" style={{ color: '#10b981' }}>No tickets have been escalated — great job!</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const COLORS = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6'];

  return (
    <div className="escalation-metrics">
      {/* Escalation Overview */}
      <div className="escalation-summary">
        <div className="esc-card">
          <div className="esc-icon">
            <ArrowUpCircle size={40} color="#ef4444" />
          </div>
          <div className="esc-details">
            <div className="esc-value">{overview.total_escalations}</div>
            <div className="esc-label">Total Escalations</div>
            <div className="esc-subtitle">
              {overview.open_escalations} open, {overview.closed_escalations} resolved
            </div>
          </div>
        </div>

        <div className="esc-card">
          <div className="esc-icon">
            <AlertTriangle size={40} color="#f59e0b" />
          </div>
          <div className="esc-details">
            <div className="esc-value">{overview.avg_time_to_escalation_hours}h</div>
            <div className="esc-label">Avg Time to Escalation</div>
            <div className="esc-subtitle">From ticket creation</div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="escalation-charts">
        <div className="chart-card">
          <h3>Escalations by Priority</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={by_priority}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ priority_name, percentage }) => `${priority_name}: ${percentage.toFixed(1)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="escalation_count"
              >
                {by_priority.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Escalations by Department</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={by_department}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="department_name" angle={-45} textAnchor="end" height={100} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="escalation_count" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Escalation Reasons */}
      <div className="escalation-reasons">
        <h3>Top Escalation Reasons</h3>
        <table className="reasons-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Reason</th>
              <th>Count</th>
              <th>Percentage</th>
            </tr>
          </thead>
          <tbody>
            {reasons.map((reason, index) => {
              const percentage = overview.total_escalations > 0 
                ? ((reason.count / overview.total_escalations) * 100).toFixed(1) 
                : 0;
              return (
                <tr key={index}>
                  <td className="rank-cell">{index + 1}</td>
                  <td className="reason-cell">{reason.reason}</td>
                  <td>{reason.count}</td>
                  <td>
                    <div className="percentage-bar">
                      <div className="bar-fill" style={{ width: `${percentage}%` }}></div>
                      <span className="bar-label">{percentage}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EscalationMetrics;

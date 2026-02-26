import { Target, CheckCircle, XCircle, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const SLAMetrics = ({ data, compareData }) => {
  if (!data || data.length === 0) {
    return <div className="no-data">No SLA data available for the selected range</div>;
  }

  // Calculate overall SLA
  const totalTickets = data.reduce((sum, item) => sum + item.total_tickets, 0);
  const totalFirstResponseMet = data.reduce((sum, item) => sum + item.first_response_met, 0);
  const totalResolutionMet = data.reduce((sum, item) => sum + item.resolution_met, 0);
  
  const overallFirstResponseSLA = totalTickets > 0 ? Math.round((totalFirstResponseMet / totalTickets) * 100) : 0;
  const overallResolutionSLA = totalTickets > 0 ? Math.round((totalResolutionMet / totalTickets) * 100) : 0;

  const compareTotals = (compareData || []).reduce((acc, item) => {
    acc.totalTickets += item.total_tickets || 0;
    acc.firstMet += item.first_response_met || 0;
    acc.resolutionMet += item.resolution_met || 0;
    return acc;
  }, { totalTickets: 0, firstMet: 0, resolutionMet: 0 });

  const compareFirst = compareTotals.totalTickets > 0
    ? Math.round((compareTotals.firstMet / compareTotals.totalTickets) * 100)
    : null;
  const compareResolution = compareTotals.totalTickets > 0
    ? Math.round((compareTotals.resolutionMet / compareTotals.totalTickets) * 100)
    : null;

  // Prepare chart data
  const chartData = data.map(item => ({
    name: item.priority_name,
    'First Response SLA': item.first_response_sla_percent,
    'Resolution SLA': item.resolution_sla_percent,
    target: 90,
  }));

  return (
    <div className="sla-metrics">
      {/* Overall SLA Cards */}
      <div className="sla-summary">
        <div className="sla-card">
          <div className="sla-icon-wrapper" style={{ backgroundColor: '#10b98115' }}>
            <CheckCircle size={32} color="#10b981" />
          </div>
          <div className="sla-details">
            <div className="sla-value">{overallFirstResponseSLA}%</div>
            <div className="sla-label">First Response SLA</div>
            <div className="sla-subtitle">{totalFirstResponseMet} of {totalTickets} tickets</div>
            {compareFirst !== null && (
              <div className={`sla-delta ${overallFirstResponseSLA - compareFirst >= 0 ? 'positive' : 'negative'}`}>
                {overallFirstResponseSLA - compareFirst >= 0 ? '+' : ''}{overallFirstResponseSLA - compareFirst}% vs prev
              </div>
            )}
          </div>
          <div className={`sla-status ${overallFirstResponseSLA >= 90 ? 'success' : 'warning'}`}>
            {overallFirstResponseSLA >= 90 ? 'Meeting Target' : 'Below Target'}
          </div>
        </div>

        <div className="sla-card">
          <div className="sla-icon-wrapper" style={{ backgroundColor: '#6366f115' }}>
            <Target size={32} color="#6366f1" />
          </div>
          <div className="sla-details">
            <div className="sla-value">{overallResolutionSLA}%</div>
            <div className="sla-label">Resolution SLA</div>
            <div className="sla-subtitle">{totalResolutionMet} of {totalTickets} tickets</div>
            {compareResolution !== null && (
              <div className={`sla-delta ${overallResolutionSLA - compareResolution >= 0 ? 'positive' : 'negative'}`}>
                {overallResolutionSLA - compareResolution >= 0 ? '+' : ''}{overallResolutionSLA - compareResolution}% vs prev
              </div>
            )}
          </div>
          <div className={`sla-status ${overallResolutionSLA >= 90 ? 'success' : 'warning'}`}>
            {overallResolutionSLA >= 90 ? 'Meeting Target' : 'Below Target'}
          </div>
        </div>
      </div>

      {/* SLA by Priority Chart */}
      <div className="chart-container">
        <h3>SLA Compliance by Priority</h3>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis domain={[0, 100]} />
            <Tooltip />
            <Legend />
            <Bar dataKey="First Response SLA" fill="#10b981" />
            <Bar dataKey="Resolution SLA" fill="#6366f1" />
            <Bar dataKey="target" fill="#f59e0b" fillOpacity={0.3} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detailed SLA Table */}
      <div className="sla-table-container">
        <h3>Detailed SLA Performance</h3>
        <table className="sla-table">
          <thead>
            <tr>
              <th>Priority</th>
              <th>Target Response</th>
              <th>Target Resolution</th>
              <th>Total Tickets</th>
              <th>First Response SLA</th>
              <th>Met / Missed</th>
              <th>Resolution SLA</th>
              <th>Met / Missed</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr key={index}>
                <td className="priority-cell">
                  <strong>{row.priority_name}</strong>
                </td>
                <td>{row.response_time_hours}h</td>
                <td>{row.resolution_time_hours}h</td>
                <td>{row.total_tickets}</td>
                <td className={row.first_response_sla_percent >= 90 ? 'text-success' : 'text-warning'}>
                  <strong>{row.first_response_sla_percent}%</strong>
                </td>
                <td>
                  <span className="badge badge-success">{row.first_response_met}</span>
                  {' / '}
                  <span className="badge badge-danger">{row.first_response_missed}</span>
                </td>
                <td className={row.resolution_sla_percent >= 90 ? 'text-success' : 'text-warning'}>
                  <strong>{row.resolution_sla_percent}%</strong>
                </td>
                <td>
                  <span className="badge badge-success">{row.resolution_met}</span>
                  {' / '}
                  <span className="badge badge-danger">{row.resolution_missed}</span>
                </td>
                <td>
                  {row.first_response_sla_percent >= 90 && row.resolution_sla_percent >= 90 ? (
                    <span className="status-badge success">✓ Excellent</span>
                  ) : row.first_response_sla_percent >= 80 && row.resolution_sla_percent >= 80 ? (
                    <span className="status-badge warning">⚠ Fair</span>
                  ) : (
                    <span className="status-badge danger">✗ Poor</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SLAMetrics;

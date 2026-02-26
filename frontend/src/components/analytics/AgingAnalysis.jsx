import { Clock, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const AgingAnalysis = ({ data }) => {
  if (!data || !data.age_distribution) return <div className="no-data">No aging data available</div>;

  const { age_distribution, oldest_tickets, avg_by_priority } = data;

  return (
    <div className="aging-analysis">
      {/* Age Distribution Chart */}
      <div className="chart-card">
        <h3>Open Tickets by Age</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={age_distribution}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="age_bucket" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="count" fill="#6366f1" name="Tickets" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Average Age by Priority */}
      <div className="chart-card">
        <h3>Average Age by Priority</h3>
        <table className="aging-table">
          <thead>
            <tr>
              <th>Priority</th>
              <th>Avg Age (Hours)</th>
              <th>Ticket Count</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {avg_by_priority.map((item, index) => (
              <tr key={index}>
                <td><strong>{item.priority_name}</strong></td>
                <td className={item.avg_age_hours > 48 ? 'text-danger' : 'text-success'}>
                  {item.avg_age_hours}h ({Math.round(item.avg_age_hours / 24)} days)
                </td>
                <td>{item.ticket_count}</td>
                <td>
                  {item.avg_age_hours <= 24 ? (
                    <span className="status-badge success">✓ Fresh</span>
                  ) : item.avg_age_hours <= 48 ? (
                    <span className="status-badge warning">⚠ Aging</span>
                  ) : (
                    <span className="status-badge danger">✗ Stale</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Oldest Open Tickets */}
      <div className="oldest-tickets">
        <h3>Oldest Open Tickets (Requires Attention)</h3>
        <table className="tickets-table">
          <thead>
            <tr>
              <th>Ticket</th>
              <th>Subject</th>
              <th>Priority</th>
              <th>Department</th>
              <th>Created</th>
              <th>Age</th>
              <th>Alert</th>
            </tr>
          </thead>
          <tbody>
            {oldest_tickets.map((ticket, index) => (
              <tr key={index}>
                <td className="ticket-number">{ticket.ticket_number}</td>
                <td className="ticket-subject">{ticket.subject}</td>
                <td>{ticket.priority_name}</td>
                <td>{ticket.department_name}</td>
                <td>{new Date(ticket.created_at).toLocaleDateString()}</td>
                <td className={ticket.age_days > 7 ? 'text-danger' : 'text-warning'}>
                  <strong>{ticket.age_days} days</strong>
                </td>
                <td>
                  {ticket.age_days > 30 ? (
                    <span className="alert-badge critical">🔴 Critical</span>
                  ) : ticket.age_days > 7 ? (
                    <span className="alert-badge warning">⚠️ High</span>
                  ) : (
                    <span className="alert-badge normal">→ Normal</span>
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

export default AgingAnalysis;

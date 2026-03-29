import { Clock, Calendar } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const TimePatterns = ({ data }) => {
  if (!data || !data.hourly_distribution) return <div className="no-data">No time pattern data available</div>;

  const { hourly_distribution, daily_distribution, peak_hour } = data;

  // Format hourly data
  const hourlyData = hourly_distribution.map(h => ({
    hour: `${h.hour}:00`,
    tickets: h.ticket_count,
  }));

  // Format daily data
  const dailyData = daily_distribution.map(d => ({
    day: d.day_name.substring(0, 3), // Shorten to 3 letters
    tickets: d.ticket_count,
  }));

  return (
    <div className="time-patterns">
      {/* Peak Hour Card */}
      {peak_hour && (
        <div className="peak-hour-card">
          <Clock size={40} color="#6366f1" />
          <div className="peak-details">
            <div className="peak-label">Peak Hour</div>
            <div className="peak-value">{peak_hour.formatted_time}</div>
            <div className="peak-subtitle">{peak_hour.ticket_count} tickets</div>
          </div>
        </div>
      )}

      {/* Hourly Distribution */}
      <div className="chart-card">
        <h3>Hourly Ticket Volume (24h)</h3>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={hourlyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="hour" angle={-45} textAnchor="end" height={80} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="tickets" fill="#6366f1" name="Tickets Created" />
          </BarChart>
        </ResponsiveContainer>
        <div className="chart-insights">
          <p>💡 <strong>Insight:</strong> Most tickets are created during {peak_hour?.formatted_time}. Consider staffing adjustments for peak hours.</p>
        </div>
      </div>

      {/* Daily Distribution */}
      <div className="chart-card">
        <h3>Tickets by Day of Week</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={dailyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="tickets" stroke="#10b981" strokeWidth={3} name="Tickets" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Insights */}
      <div className="pattern-insights">
        <h3>Key Patterns</h3>
        <ul className="insights-list">
          <li>→ Peak activity occurs at <strong>{peak_hour?.formatted_time}</strong> with <strong>{peak_hour?.ticket_count}</strong> tickets.</li>
          <li>→ Use this data to optimize agent scheduling and resource allocation.</li>
          <li>→ Consider implementing automation during low-traffic hours.</li>
        </ul>
      </div>
    </div>
  );
};

export default TimePatterns;

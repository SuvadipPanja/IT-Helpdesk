import { ThumbsUp, Star, TrendingUp, TrendingDown } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const CSATMetrics = ({ data }) => {
  if (!data || !data.overall) return <div className="no-data">No CSAT data available</div>;

  const { overall, distribution, by_department, by_category } = data;

  // Chart colors
  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];
  
  // Prepare rating distribution for pie chart
  const ratingChartData = distribution.map(d => ({
    name: `${d.rating} Star${d.rating > 1 ? 's' : ''}`,
    value: d.count,
  }));

  // Render star rating
  const renderStars = (rating) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Star 
          key={i}
          size={16}
          fill={i <= rating ? '#f59e0b' : 'none'}
          stroke={i <= rating ? '#f59e0b' : '#d1d5db'}
        />
      );
    }
    return stars;
  };

  return (
    <div className="csat-metrics">
      {/* Overall CSAT Summary */}
      <div className="csat-summary">
        <div className="csat-main-card">
          <div className="csat-score">
            <div className="score-value">{overall.avg_rating}</div>
            <div className="score-label">Average Rating</div>
            <div className="score-stars">{renderStars(Math.round(overall.avg_rating))}</div>
          </div>
          <div className="csat-breakdown">
            <div className="breakdown-item positive">
              <div className="breakdown-value">{overall.positive_ratings}</div>
              <div className="breakdown-label">Positive (4-5★)</div>
            </div>
            <div className="breakdown-item neutral">
              <div className="breakdown-value">{overall.neutral_ratings}</div>
              <div className="breakdown-label">Neutral (3★)</div>
            </div>
            <div className="breakdown-item negative">
              <div className="breakdown-value">{overall.negative_ratings}</div>
              <div className="breakdown-label">Negative (1-2★)</div>
            </div>
          </div>
          <div className="satisfaction-score">
            <div className="satisfaction-percentage">{overall.satisfaction_score}%</div>
            <div className="satisfaction-label">Satisfaction Score</div>
            <div className="satisfaction-subtitle">Based on {overall.total_ratings} responses</div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="csat-charts">
        {/* Rating Distribution */}
        <div className="chart-card">
          <h3>Rating Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={ratingChartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {ratingChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* CSAT by Department */}
        <div className="chart-card">
          <h3>CSAT by Department</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={by_department}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="department_name" angle={-45} textAnchor="end" height={100} />
              <YAxis domain={[0, 5]} />
              <Tooltip />
              <Bar dataKey="avg_rating" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category Table */}
      <div className="csat-table-container">
        <h3>CSAT by Category</h3>
        <table className="csat-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Average Rating</th>
              <th>Rating Visualization</th>
              <th>Total Ratings</th>
              <th>Performance</th>
            </tr>
          </thead>
          <tbody>
            {by_category.map((cat, index) => (
              <tr key={index}>
                <td><strong>{cat.category_name}</strong></td>
                <td className="rating-value">{cat.avg_rating}</td>
                <td className="rating-stars">{renderStars(Math.round(cat.avg_rating))}</td>
                <td>{cat.rating_count}</td>
                <td>
                  {cat.avg_rating >= 4.5 ? (
                    <span className="status-badge success">★ Excellent</span>
                  ) : cat.avg_rating >= 4 ? (
                    <span className="status-badge success">✓ Good</span>
                  ) : cat.avg_rating >= 3 ? (
                    <span className="status-badge warning">→ Average</span>
                  ) : (
                    <span className="status-badge danger">✗ Poor</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Insights */}
      <div className="csat-insights">
        <h3>Key Insights</h3>
        <ul className="insights-list">
          {overall.avg_rating >= 4.5 && (
            <li className="positive">✓ Exceptional customer satisfaction! Maintain current service standards.</li>
          )}
          {overall.avg_rating < 3 && (
            <li className="negative">⚠ Low satisfaction scores. Immediate action required to improve service quality.</li>
          )}
          {overall.negative_ratings > overall.positive_ratings && (
            <li className="negative">⚠ More negative than positive ratings. Review common complaints and address issues.</li>
          )}
          {by_category.length > 0 && (
            <li className="info">
              → Best performing category: <strong>{by_category[0].category_name}</strong> ({by_category[0].avg_rating}★)
            </li>
          )}
          {by_department.length > 0 && (
            <li className="info">
              → Top department: <strong>{by_department[0].department_name}</strong> ({by_department[0].avg_rating}★)
            </li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default CSATMetrics;

import { Users, Award, TrendingUp } from 'lucide-react';

const AgentPerformance = ({ data }) => {
  if (!data || data.length === 0) return <div className="no-data">No agent performance data available</div>;

  const rankedAgents = data.map((agent, index) => ({
    ...agent,
    overall_score: Math.round(
      (agent.resolution_rate * 0.4) + (agent.resolution_sla_percent * 0.3) + (agent.avg_csat * 20 * 0.3)
    ),
    rank: index + 1,
  }));

  const scoreLabel = (s) => {
    if (s >= 80) return <span className="status-badge success">★ Excellent</span>;
    if (s >= 60) return <span className="status-badge success">✓ Good</span>;
    if (s >= 40) return <span className="status-badge warning">→ Average</span>;
    return <span className="status-badge danger">⚠ Needs Improvement</span>;
  };

  return (
    <div className="agent-performance">
      {/* Top 3 Performers */}
      <div className="top-agents">
        <h3>🏆 Top Performers</h3>
        <div className="podium">
          {rankedAgents.slice(0, 3).map((agent, index) => (
            <div key={agent.user_id} className={`podium-card rank-${index + 1}`}>
              <div className="rank-badge">
                {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
              </div>
              <div className="agent-name">{agent.agent_name}</div>
              <div className="agent-role">{agent.role_name}</div>
              <div className="agent-stats">
                <div className="stat">
                  <span className="stat-label">Resolved</span>
                  <span className="stat-value">{agent.tickets_resolved}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Rate</span>
                  <span className="stat-value">{agent.resolution_rate}%</span>
                </div>
                <div className="stat">
                  <span className="stat-label">CSAT</span>
                  <span className="stat-value">{agent.avg_csat > 0 ? `${agent.avg_csat}★` : 'N/A'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Simplified Agent Table — key columns only */}
      <div className="agent-table-container">
        <h3>All Agents — Performance Summary</h3>
        <table className="agent-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Agent</th>
              <th>Department</th>
              <th>Assigned / Resolved</th>
              <th>Resolution Rate</th>
              <th>Avg Resolution</th>
              <th>SLA %</th>
              <th>CSAT</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {rankedAgents.map((agent) => (
              <tr key={agent.user_id}>
                <td className="rank-cell">
                  {agent.rank <= 3 ? (
                    <span className="rank-medal">{agent.rank === 1 ? '🥇' : agent.rank === 2 ? '🥈' : '🥉'}</span>
                  ) : (
                    <span className="rank-number">#{agent.rank}</span>
                  )}
                </td>
                <td className="agent-name-cell">
                  <strong>{agent.agent_name}</strong>
                  <span className="agent-role-inline">{agent.role_name}</span>
                </td>
                <td>{agent.department_name || '—'}</td>
                <td>
                  <span className="text-muted">{agent.total_assigned}</span>
                  {' / '}
                  <strong className="text-success">{agent.tickets_resolved}</strong>
                </td>
                <td>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${agent.resolution_rate}%`,
                        backgroundColor: agent.resolution_rate >= 80 ? '#10b981' : '#f59e0b',
                      }}
                    />
                    <span className="progress-label">{agent.resolution_rate}%</span>
                  </div>
                </td>
                <td>{agent.avg_resolution_hours > 0 ? `${agent.avg_resolution_hours}h` : '—'}</td>
                <td className={agent.resolution_sla_percent >= 90 ? 'text-success' : 'text-warning'}>
                  {agent.resolution_sla_percent}%
                </td>
                <td>
                  <span className="csat-value">{agent.avg_csat > 0 ? `${agent.avg_csat}★` : 'N/A'}</span>
                </td>
                <td>{scoreLabel(agent.overall_score)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AgentPerformance;

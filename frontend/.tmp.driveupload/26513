// ============================================
// DASHBOARD PAGE - UPDATED
// ============================================
// RESOLVED status merged into CLOSED
// Developer: Suvadip Panja
// Updated: February 2026
// FILE: frontend/src/pages/dashboard/Dashboard.jsx
// ============================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getSetting } from '../../utils/settingsLoader';
import { 
  Ticket, 
  Users, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  TrendingUp,
  Activity,
  Plus,
  Search,
  Filter,
  X,
  AlertTriangle,
  XCircle,
  Ban,
  PauseCircle,
  ArrowUp
} from 'lucide-react';
import api from '../../services/api';
import '../../styles/Dashboard.css';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const systemName = getSetting('system_name', 'Nexus Support');

  // ============================================
  // STATE - RESOLVED REMOVED, MERGED INTO CLOSED
  // ============================================
  const [stats, setStats] = useState({
    totalTickets: 0,
    openTickets: 0,
    inProgressTickets: 0,
    // resolvedTickets removed - merged into closedTickets
    pendingTickets: 0,
    onHoldTickets: 0,
    closedTickets: 0,      // Now includes all final status tickets (old Resolved + Closed)
    cancelledTickets: 0,
    escalatedTickets: 0,
    totalUsers: 0,
    myAssignedTickets: 0,
  });

  const [slaStats, setSlaStats] = useState({
    onTrack: 0,
    atRisk: 0,
    breached: 0,
    noSla: 0,
    total: 0,
    complianceRate: 0
  });

  const [recentTickets, setRecentTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // ============================================
  // FETCH DASHBOARD DATA - UPDATED
  // ============================================
  const fetchDashboardData = async () => {
    setLoading(true);
    setError('');
    
    try {
      const statsResponse = await api.get('/dashboard/stats');
      
      if (statsResponse.data.success) {
        const data = statsResponse.data.data;
        
        // UPDATED: No more resolvedTickets - closedTickets includes all final status
        setStats({
          totalTickets: data.summary.totalTickets || 0,
          openTickets: data.summary.openTickets || 0,
          inProgressTickets: data.summary.inProgressTickets || 0,
          pendingTickets: data.summary.pendingTickets || 0,
          onHoldTickets: data.summary.onHoldTickets || 0,
          closedTickets: data.summary.closedTickets || 0,  // Includes old resolved tickets
          cancelledTickets: data.summary.cancelledTickets || 0,
          escalatedTickets: data.summary.escalatedTickets || 0,
          totalUsers: data.summary.totalUsers || 0,
          myAssignedTickets: data.summary.myAssignedTickets || 0,
        });

        // Set SLA Stats
        if (data.summary.slaStats) {
          setSlaStats({
            onTrack: data.summary.slaStats.onTrack || 0,
            atRisk: data.summary.slaStats.atRisk || 0,
            breached: data.summary.slaStats.breached || 0,
            noSla: data.summary.slaStats.noSla || 0,
            total: data.summary.slaStats.total || 0,
            complianceRate: data.summary.slaStats.complianceRate || 0
          });
        } else {
          // Fallback: Calculate from tickets if backend doesn't provide
          const tickets = data.recentTickets || [];
          const calculated = calculateSlaStats(tickets);
          setSlaStats(calculated);
        }
        
        setRecentTickets(data.recentTickets || []);
      }

    } catch (err) {
      console.error('Dashboard data fetch error:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // CALCULATE SLA STATS (FALLBACK)
  // ============================================
  const calculateSlaStats = (tickets) => {
    let onTrack = 0;
    let atRisk = 0;
    let breached = 0;
    let noSla = 0;

    tickets.forEach(ticket => {
      if (!ticket.due_date || !ticket.created_at) {
        noSla++;
        return;
      }

      const now = new Date();
      const created = new Date(ticket.created_at);
      const due = new Date(ticket.due_date);
      const totalTime = due - created;
      const elapsed = now - created;
      const percentage = (elapsed / totalTime) * 100;

      if (ticket.sla_breach_notified_at || now > due) {
        breached++;
      } else if (percentage >= 80) {
        atRisk++;
      } else {
        onTrack++;
      }
    });

    const total = tickets.length;
    const compliant = onTrack + atRisk;
    const complianceRate = total > 0 ? ((compliant / total) * 100).toFixed(1) : 0;

    return { onTrack, atRisk, breached, noSla, total, complianceRate: parseFloat(complianceRate) };
  };

  // ============================================
  // HELPER FUNCTIONS
  // ============================================
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // UPDATED: Removed RESOLVED from status colors
  const getStatusColor = (status) => {
    const colors = {
      'OPEN': 'status-open',
      'IN_PROGRESS': 'status-progress',
      'PENDING': 'status-pending',
      'CLOSED': 'status-closed',      // CLOSED is now the only final status
      'ON_HOLD': 'status-hold',
      'CANCELLED': 'status-cancelled',
      'ESCALATED': 'status-escalated'
    };
    return colors[status] || 'status-default';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      'CRITICAL': 'priority-critical',
      'HIGH': 'priority-high',
      'MEDIUM': 'priority-medium',
      'LOW': 'priority-low',
      'PLANNING': 'priority-planning'
    };
    return colors[priority] || 'priority-default';
  };

  // ============================================
  // NAVIGATION HANDLERS
  // ============================================
  const handleCreateTicket = () => {
    navigate('/tickets/create');
  };

  const handleViewTicket = (ticketId) => {
    navigate(`/tickets/${ticketId}`);
  };

  const handleViewAllTickets = () => {
    navigate('/tickets');
  };

  const handleViewMyTickets = () => {
    navigate('/my-tickets');
  };

  const handleManageUsers = () => {
    navigate('/users');
  };

  const handleViewAnalytics = () => {
    navigate('/analytics');
  };

  // Status-specific navigation handlers
  const handleViewOpenTickets = () => {
    navigate('/tickets?status=OPEN');
  };

  const handleViewInProgressTickets = () => {
    navigate('/tickets?status=IN_PROGRESS');
  };

  const handleViewPendingTickets = () => {
    navigate('/tickets?status=PENDING');
  };

  const handleViewOnHoldTickets = () => {
    navigate('/tickets?status=ON_HOLD');
  };

  // UPDATED: CLOSED now replaces RESOLVED
  const handleViewClosedTickets = () => {
    navigate('/tickets?status=CLOSED');
  };

  const handleViewCancelledTickets = () => {
    navigate('/tickets?status=CANCELLED');
  };

  const handleViewEscalatedTickets = () => {
    navigate('/tickets?escalated=true');
  };

  // SLA-specific navigation handlers
  const handleViewOnTrackTickets = () => {
    navigate('/tickets?sla_status=ok');
  };

  const handleViewAtRiskTickets = () => {
    navigate('/tickets?sla_status=warning');
  };

  const handleViewBreachedTickets = () => {
    navigate('/tickets?sla_status=breached');
  };

  // ============================================
  // LOADING STATE
  // ============================================
  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p style={{ marginTop: '16px', color: '#64748b' }}>Loading dashboard...</p>
      </div>
    );
  }

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="dashboard-content">

      {/* Welcome Section */}
      <div className="welcome-section">
        <div className="welcome-text">
          <h1>{getGreeting()}, {user?.full_name || user?.username} .! 👋</h1>
          <p>Welcome to <strong>{systemName}</strong> - Your IT Service Management Platform</p>
          <div className="welcome-badges">
            <span className="badge badge-role">{user?.role_name || 'User'}</span>
            <span className="badge badge-department">{user?.department_name || 'General'}</span>
          </div>
        </div>
        <div className="welcome-actions">
          <button className="btn btn-primary" onClick={handleCreateTicket}>
            <Plus size={18} />
            Create New Ticket
          </button>
        </div>
      </div>

      {/* Stats Grid - Row 1 */}
      <div className="stats-grid">
        {/* Total Tickets */}
        <div 
          className="stat-card clickable" 
          onClick={handleViewAllTickets}
          title="Click to view all tickets"
        >
          <div className="stat-icon blue">
            <Ticket size={24} />
          </div>
          <div className="stat-info">
            <p className="stat-label">TOTAL TICKETS</p>
            <h3 className="stat-value">{stats.totalTickets}</h3>
          </div>
        </div>

        {/* Open Tickets */}
        <div 
          className="stat-card clickable" 
          onClick={handleViewOpenTickets}
          title="Click to view open tickets"
        >
          <div className="stat-icon yellow">
            <AlertCircle size={24} />
          </div>
          <div className="stat-info">
            <p className="stat-label">OPEN</p>
            <h3 className="stat-value">{stats.openTickets}</h3>
          </div>
        </div>

        {/* In Progress */}
        <div 
          className="stat-card clickable" 
          onClick={handleViewInProgressTickets}
          title="Click to view in-progress tickets"
        >
          <div className="stat-icon orange">
            <Activity size={24} />
          </div>
          <div className="stat-info">
            <p className="stat-label">IN PROGRESS</p>
            <h3 className="stat-value">{stats.inProgressTickets}</h3>
          </div>
        </div>

        {/* CLOSED - Now the only final status (replaced RESOLVED) */}
        <div 
          className="stat-card clickable" 
          onClick={handleViewClosedTickets}
          title="Click to view closed tickets"
        >
          <div className="stat-icon green">
            <CheckCircle size={24} />
          </div>
          <div className="stat-info">
            <p className="stat-label">CLOSED</p>
            <h3 className="stat-value">{stats.closedTickets}</h3>
          </div>
        </div>
      </div>

      {/* Stats Grid - Row 2 */}
      <div className="stats-grid">
        {/* Pending */}
        <div 
          className="stat-card clickable" 
          onClick={handleViewPendingTickets}
          title="Click to view pending tickets"
        >
          <div className="stat-icon purple">
            <AlertTriangle size={24} />
          </div>
          <div className="stat-info">
            <p className="stat-label">PENDING</p>
            <h3 className="stat-value">{stats.pendingTickets}</h3>
          </div>
        </div>

        {/* On Hold */}
        <div 
          className="stat-card clickable" 
          onClick={handleViewOnHoldTickets}
          title="Click to view on-hold tickets"
        >
          <div className="stat-icon brown">
            <PauseCircle size={24} />
          </div>
          <div className="stat-info">
            <p className="stat-label">ON HOLD</p>
            <h3 className="stat-value">{stats.onHoldTickets}</h3>
          </div>
        </div>

        {/* Cancelled */}
        <div 
          className="stat-card clickable" 
          onClick={handleViewCancelledTickets}
          title="Click to view cancelled tickets"
        >
          <div className="stat-icon red">
            <Ban size={24} />
          </div>
          <div className="stat-info">
            <p className="stat-label">CANCELLED</p>
            <h3 className="stat-value">{stats.cancelledTickets}</h3>
          </div>
        </div>

        {/* Escalated */}
        <div 
          className="stat-card clickable" 
          onClick={handleViewEscalatedTickets}
          title="Click to view escalated tickets"
        >
          <div className="stat-icon red">
            <ArrowUp size={24} />
          </div>
          <div className="stat-info">
            <p className="stat-label">ESCALATED</p>
            <h3 className="stat-value">{stats.escalatedTickets}</h3>
          </div>
        </div>

        {/* Total Users - Admin/Manager only */}
        {(user?.permissions?.can_manage_users || user?.permissions?.can_view_analytics) && (
          <div 
            className="stat-card clickable" 
            onClick={handleManageUsers}
            title="Click to manage users"
          >
            <div className="stat-icon teal">
              <Users size={24} />
            </div>
            <div className="stat-info">
              <p className="stat-label">TOTAL USERS</p>
              <h3 className="stat-value">{stats.totalUsers}</h3>
            </div>
          </div>
        )}
      </div>

      {/* SLA Performance Summary */}
      <div className="sla-summary-section">
        <h3 className="section-title">
          <TrendingUp size={20} />
          SLA Performance Summary
          <span className="view-all-link" onClick={handleViewAllTickets}>View All →</span>
        </h3>
        <div className="sla-cards">
          {/* On Track */}
          <div 
            className="sla-card sla-on-track clickable" 
            onClick={handleViewOnTrackTickets}
            title="Click to view on-track tickets"
          >
            <div className="sla-icon">
              <CheckCircle size={24} />
            </div>
            <div className="sla-info">
              <h4>{slaStats.onTrack}</h4>
              <p>On Track</p>
            </div>
          </div>

          {/* At Risk */}
          <div 
            className="sla-card sla-at-risk clickable" 
            onClick={handleViewAtRiskTickets}
            title="Click to view at-risk tickets"
          >
            <div className="sla-icon">
              <AlertTriangle size={24} />
            </div>
            <div className="sla-info">
              <h4>{slaStats.atRisk}</h4>
              <p>At Risk</p>
            </div>
          </div>

          {/* Breached */}
          <div 
            className="sla-card sla-breached clickable" 
            onClick={handleViewBreachedTickets}
            title="Click to view breached tickets"
          >
            <div className="sla-icon">
              <XCircle size={24} />
            </div>
            <div className="sla-info">
              <h4>{slaStats.breached}</h4>
              <p>Breached</p>
            </div>
          </div>

          {/* Compliance Rate */}
          <div className="sla-card sla-compliance">
            <div className="sla-icon">
              <TrendingUp size={24} />
            </div>
            <div className="sla-info">
              <h4>{slaStats.complianceRate}%</h4>
              <p>Compliance</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Section */}
      <div className="content-grid">
        {/* Recent Tickets */}
        <div className="content-card">
          <div className="card-header">
            <div className="card-title">
              <Activity size={20} />
              <h3>Recent Tickets</h3>
            </div>
            <div className="card-actions">
              <button 
                className="btn-icon" 
                title="View all"
                onClick={handleViewAllTickets}
              >
                <Search size={18} />
              </button>
            </div>
          </div>
          <div className="card-body">
            {recentTickets.length === 0 ? (
              <div className="empty-state">
                <Ticket size={48} />
                <p>No recent tickets</p>
                <button className="btn btn-primary" onClick={handleCreateTicket}>
                  Create your first ticket
                </button>
              </div>
            ) : (
              <div className="ticket-list">
                {recentTickets.map(ticket => (
                  <div 
                    key={ticket.ticket_id} 
                    className="ticket-item clickable"
                    onClick={() => handleViewTicket(ticket.ticket_id)}
                  >
                    <div className="ticket-main">
                      <span className="ticket-number">{ticket.ticket_number}</span>
                      <span className="ticket-title">{ticket.subject || ticket.title}</span>
                    </div>
                    <div className="ticket-meta">
                      <span className={`status-badge ${getStatusColor(ticket.status_code)}`}>
                        {ticket.status_name}
                      </span>
                      <span className={`priority-badge ${getPriorityColor(ticket.priority_code)}`}>
                        {ticket.priority_name}
                      </span>
                      <span className="ticket-date">{formatDate(ticket.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="content-card">
          <div className="card-header">
            <div className="card-title">
              <TrendingUp size={20} />
              <h3>Quick Actions</h3>
            </div>
          </div>
          <div className="card-body">
            <div className="quick-actions">
              <button 
                className="quick-action-btn"
                onClick={handleCreateTicket}
              >
                <div className="action-icon blue">
                  <Plus size={20} />
                </div>
                <div className="action-text">
                  <h4>New Ticket</h4>
                  <p>Create a support request</p>
                </div>
              </button>

              <button 
                className="quick-action-btn"
                onClick={handleViewMyTickets}
              >
                <div className="action-icon orange">
                  <Ticket size={20} />
                </div>
                <div className="action-text">
                  <h4>My Tickets</h4>
                  <p>View your tickets</p>
                </div>
              </button>

              {user?.permissions?.can_manage_users && (
                <button 
                  className="quick-action-btn"
                  onClick={handleManageUsers}
                >
                  <div className="action-icon green">
                    <Users size={20} />
                  </div>
                  <div className="action-text">
                    <h4>Manage Users</h4>
                    <p>Add or edit users</p>
                  </div>
                </button>
              )}

              {user?.permissions?.can_view_analytics && (
                <button 
                  className="quick-action-btn"
                  onClick={handleViewAnalytics}
                >
                  <div className="action-icon purple">
                    <TrendingUp size={20} />
                  </div>
                  <div className="action-text">
                    <h4>Analytics</h4>
                    <p>View reports</p>
                  </div>
                </button>
              )}

              <button 
                className="quick-action-btn"
                onClick={handleViewAllTickets}
              >
                <div className="action-icon yellow">
                  <Search size={20} />
                </div>
                <div className="action-text">
                  <h4>Search</h4>
                  <p>Find tickets</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Dashboard;
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
  X
} from 'lucide-react';
import api from '../../services/api';
import '../../styles/Dashboard.css';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const systemName = getSetting('system_name', 'Nexus Support');
  const announcementEnabledValue = getSetting('announcement_enabled', 'false');
  const announcementEnabled = announcementEnabledValue === 'true' || announcementEnabledValue === true || announcementEnabledValue === 1;
  const announcementText = getSetting('system_announcement', '');
  
  console.log('📢 Announcement Check:', { raw: announcementEnabledValue, parsed: announcementEnabled, text: announcementText });
  
  const [stats, setStats] = useState({
    totalTickets: 0,
    openTickets: 0,
    inProgressTickets: 0,
    resolvedTickets: 0,
    totalUsers: 0,
    pendingTickets: 0
  });
  const [recentTickets, setRecentTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError('');
    
    try {
      const statsResponse = await api.get('/dashboard/stats');
      
      if (statsResponse.data.success) {
        const data = statsResponse.data.data;
        
        setStats({
          totalTickets: data.summary.totalTickets || 0,
          openTickets: data.summary.openTickets || 0,
          inProgressTickets: data.summary.inProgressTickets || 0,
          pendingTickets: data.summary.pendingTickets || 0,
          resolvedTickets: data.summary.resolvedTickets || 0,
          totalUsers: data.summary.totalUsers || 0,
          myAssignedTickets: data.summary.myAssignedTickets || 0,
        });
        
        setRecentTickets(data.recentTickets || []);
      }

    } catch (err) {
      console.error('Dashboard data fetch error:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

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

  const getStatusColor = (status) => {
    const colors = {
      'OPEN': 'status-open',
      'IN_PROGRESS': 'status-progress',
      'PENDING': 'status-pending',
      'RESOLVED': 'status-resolved',
      'CLOSED': 'status-closed',
      'ON_HOLD': 'status-hold'
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

  const handleCreateTicket = () => navigate('/tickets/create');
  const handleViewTicket = (ticketId) => navigate(`/tickets/${ticketId}`);
  const handleViewAllTickets = () => navigate('/tickets');
  const handleViewOpenTickets = () => navigate('/tickets?status=OPEN');
  const handleViewInProgressTickets = () => navigate('/tickets?status=IN_PROGRESS');
  const handleViewResolvedTickets = () => navigate('/tickets?status=RESOLVED');
  const handleViewPendingTickets = () => navigate('/tickets?status=PENDING');
  const handleViewMyTickets = () => navigate('/my-tickets');
  const handleManageUsers = () => navigate('/users');
  const handleViewAnalytics = () => navigate('/analytics');

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p style={{ marginTop: '16px', color: '#64748b' }}>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-content">
      {announcementEnabled && announcementText.trim() && !announcementDismissed && (
        <div className="announcement-banner">
          <div className="announcement-content">
            <AlertCircle size={18} className="announcement-icon" />
            <p className="announcement-text">{announcementText}</p>
          </div>
          <button 
            className="announcement-close"
            onClick={() => setAnnouncementDismissed(true)}
            aria-label="Dismiss announcement"
          >
            <X size={18} />
          </button>
        </div>
      )}

      <div className="welcome-section">
        <div className="welcome-text">
          <h1>{getGreeting()}, {user?.full_name || user?.username}! 👋</h1>
          <p>Welcome to <span className="brand-name">{systemName}</span> - Your IT Service Management Platform</p>
          <div className="user-badge">
            <span className={`role-badge role-${user?.role?.role_name?.toLowerCase() || 'user'}`}>
              {user?.role?.role_name || 'User'}
            </span>
            <span className="department-badge">
              {user?.department?.department_name || 'No Department'}
            </span>
          </div>
        </div>
        
        {user?.permissions?.can_create_tickets && (
          <button className="btn-primary-action" onClick={handleCreateTicket}>
            <Plus size={20} />
            <span>Create New Ticket</span>
          </button>
        )}
      </div>

      {error && (
        <div className="alert alert-error">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card clickable" onClick={handleViewAllTickets} title="Click to view all tickets">
          <div className="stat-header">
            <div className="stat-icon blue"><Ticket size={24} /></div>
            <TrendingUp className="stat-trend" size={16} />
          </div>
          <div className="stat-body">
            <p className="stat-label">Total Tickets</p>
            <h2 className="stat-value">{stats.totalTickets || 0}</h2>
            <p className="stat-description">All time tickets</p>
          </div>
        </div>

        <div className="stat-card clickable" onClick={handleViewOpenTickets} title="Click to view open tickets">
          <div className="stat-header">
            <div className="stat-icon orange"><AlertCircle size={24} /></div>
          </div>
          <div className="stat-body">
            <p className="stat-label">Open Tickets</p>
            <h2 className="stat-value">{stats.openTickets || 0}</h2>
            <p className="stat-description">Awaiting action</p>
          </div>
        </div>

        <div className="stat-card clickable" onClick={handleViewInProgressTickets} title="Click to view in-progress tickets">
          <div className="stat-header">
            <div className="stat-icon yellow"><Clock size={24} /></div>
          </div>
          <div className="stat-body">
            <p className="stat-label">In Progress</p>
            <h2 className="stat-value">{stats.inProgressTickets || 0}</h2>
            <p className="stat-description">Being worked on</p>
          </div>
        </div>

        <div className="stat-card clickable" onClick={handleViewResolvedTickets} title="Click to view resolved tickets">
          <div className="stat-header">
            <div className="stat-icon green"><CheckCircle size={24} /></div>
          </div>
          <div className="stat-body">
            <p className="stat-label">Resolved</p>
            <h2 className="stat-value">{stats.resolvedTickets || 0}</h2>
            <p className="stat-description">Successfully closed</p>
          </div>
        </div>

        {(user?.permissions?.can_manage_users || user?.permissions?.can_view_analytics) && (
          <div className="stat-card clickable" onClick={handleManageUsers} title="Click to manage users">
            <div className="stat-header">
              <div className="stat-icon purple"><Users size={24} /></div>
            </div>
            <div className="stat-body">
              <p className="stat-label">Total Users</p>
              <h2 className="stat-value">{stats.totalUsers || 0}</h2>
              <p className="stat-description">Active users</p>
            </div>
          </div>
        )}

        <div className="stat-card clickable" onClick={handleViewPendingTickets} title="Click to view pending tickets">
          <div className="stat-header">
            <div className="stat-icon red"><Activity size={24} /></div>
          </div>
          <div className="stat-body">
            <p className="stat-label">Pending</p>
            <h2 className="stat-value">{stats.pendingTickets || 0}</h2>
            <p className="stat-description">Needs attention</p>
          </div>
        </div>
      </div>

      <div className="content-grid">
        <div className="content-card">
          <div className="card-header">
            <div className="card-title">
              <Activity size={20} />
              <h3>Recent Tickets</h3>
            </div>
            <div className="card-actions">
              <button className="btn-icon" title="Search" onClick={handleViewAllTickets}>
                <Search size={18} />
              </button>
              <button className="btn-icon" title="Filter" onClick={handleViewAllTickets}>
                <Filter size={18} />
              </button>
            </div>
          </div>
          <div className="card-body">
            {recentTickets.length === 0 ? (
              <div className="empty-state">
                <Ticket size={48} className="empty-icon" />
                <p>No tickets found</p>
                <small>Create your first ticket to get started</small>
                {user?.permissions?.can_create_tickets && (
                  <button className="btn-primary-action" onClick={handleCreateTicket} style={{ marginTop: '16px' }}>
                    <Plus size={18} />
                    <span>Create Ticket</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="ticket-list">
                {recentTickets.map((ticket) => (
                  <div 
                    key={ticket.ticket_id} 
                    className="ticket-item clickable"
                    onClick={() => handleViewTicket(ticket.ticket_id)}
                    title="Click to view ticket details"
                  >
                    <div className="ticket-info">
                      <div className="ticket-header">
                        <span className="ticket-number">#{ticket.ticket_number}</span>
                        <span className={`ticket-priority ${getPriorityColor(ticket.priority_code)}`}>
                          {ticket.priority_name}
                        </span>
                      </div>
                      <h4 className="ticket-title">
                        {ticket.title || ticket.subject || 'No Title'}
                      </h4>
                      <p className="ticket-meta">
                        <span>{ticket.category_name}</span>
                        <span>•</span>
                        <span>{ticket.requester_name}</span>
                        <span>•</span>
                        <span>{formatDate(ticket.created_at)}</span>
                      </p>
                    </div>
                    <div className="ticket-status">
                      <span className={`status-badge ${getStatusColor(ticket.status_code)}`}>
                        {ticket.status_name}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="card-footer">
            <button className="btn-text" onClick={handleViewAllTickets}>
              View All Tickets →
            </button>
          </div>
        </div>

        <div className="content-card quick-actions-card">
          <div className="card-header">
            <div className="card-title">
              <Activity size={20} />
              <h3>Quick Actions</h3>
            </div>
          </div>
          <div className="card-body">
            <div className="quick-actions">
              {user?.permissions?.can_create_tickets && (
                <button className="quick-action-btn" onClick={handleCreateTicket}>
                  <div className="action-icon blue"><Plus size={20} /></div>
                  <div className="action-text">
                    <h4>New Ticket</h4>
                    <p>Create support ticket</p>
                  </div>
                </button>
              )}

              <button className="quick-action-btn" onClick={handleViewMyTickets}>
                <div className="action-icon orange"><Ticket size={20} /></div>
                <div className="action-text">
                  <h4>My Tickets</h4>
                  <p>View your tickets</p>
                </div>
              </button>

              {user?.permissions?.can_manage_users && (
                <button className="quick-action-btn" onClick={handleManageUsers}>
                  <div className="action-icon green"><Users size={20} /></div>
                  <div className="action-text">
                    <h4>Manage Users</h4>
                    <p>Add or edit users</p>
                  </div>
                </button>
              )}

              {user?.permissions?.can_view_analytics && (
                <button className="quick-action-btn" onClick={handleViewAnalytics}>
                  <div className="action-icon purple"><TrendingUp size={20} /></div>
                  <div className="action-text">
                    <h4>Analytics</h4>
                    <p>View reports</p>
                  </div>
                </button>
              )}

              <button className="quick-action-btn" onClick={handleViewAllTickets}>
                <div className="action-icon yellow"><Search size={20} /></div>
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
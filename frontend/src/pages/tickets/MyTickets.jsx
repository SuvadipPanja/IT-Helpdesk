import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Search,
  Filter,
  User,
  Clock,
  AlertCircle,
  CheckCircle,
  Loader,
  Plus,
  Ticket,
  Calendar,
  Tag,
  AlertTriangle,
  MessageSquare,
  Paperclip,
  ArrowRight
} from 'lucide-react';
import api from '../../services/api';
import '../../styles/MyTickets.css';

const MyTickets = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // State management
  const [tickets, setTickets] = useState([]);
  const [filteredTickets, setFilteredTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter state
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('created'); // 'created' or 'assigned'

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    in_progress: 0,
    resolved: 0,
    assigned_to_me: 0,
    created_by_me: 0
  });

  // Fetch tickets on mount
  useEffect(() => {
    fetchMyTickets();
  }, [viewMode]);

  // Filter tickets when tab or search changes
  useEffect(() => {
    filterTickets();
  }, [activeTab, searchQuery, tickets]);

  // Fetch my tickets
  const fetchMyTickets = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch all tickets - backend will filter based on permissions
      const params = {
        limit: 100, // Get more tickets for local filtering
      };

      // Add filter based on view mode
      if (viewMode === 'created') {
        params.requester_id = user.user_id;
      } else if (viewMode === 'assigned') {
        params.assigned_to = user.user_id;
      }

      const response = await api.get('/tickets', { params });

      if (response.data.success) {
        const ticketData = response.data.data.tickets || [];
        setTickets(ticketData);
        calculateStats(ticketData);
      }
    } catch (err) {
      console.error('Error fetching tickets:', err);
      setError(err.response?.data?.message || 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  // Calculate statistics
  const calculateStats = (ticketData) => {
    const stats = {
      total: ticketData.length,
      open: ticketData.filter(t => t.status_code === 'OPEN').length,
      in_progress: ticketData.filter(t => t.status_code === 'IN_PROGRESS').length,
      resolved: ticketData.filter(t => t.status_code === 'RESOLVED' || t.status_code === 'CLOSED').length,
      assigned_to_me: ticketData.filter(t => t.assigned_to === user.user_id).length,
      created_by_me: ticketData.filter(t => t.requester_id === user.user_id).length,
    };
    setStats(stats);
  };

  // Filter tickets based on tab and search
  const filterTickets = () => {
    let filtered = [...tickets];

    // Filter by tab
    if (activeTab === 'open') {
      filtered = filtered.filter(t => t.status_code === 'OPEN');
    } else if (activeTab === 'in_progress') {
      filtered = filtered.filter(t => t.status_code === 'IN_PROGRESS');
    } else if (activeTab === 'resolved') {
      filtered = filtered.filter(t => 
        t.status_code === 'RESOLVED' || t.status_code === 'CLOSED'
      );
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(ticket =>
        ticket.ticket_number?.toLowerCase().includes(query) ||
        ticket.title?.toLowerCase().includes(query) ||
        ticket.description?.toLowerCase().includes(query) ||
        ticket.category_name?.toLowerCase().includes(query)
      );
    }

    setFilteredTickets(filtered);
  };

  // Handle view mode change
  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    setActiveTab('all');
    setSearchQuery('');
  };

  // Navigate to ticket detail
  const handleTicketClick = (ticketId) => {
    navigate(`/tickets/${ticketId}`);
  };

  // Navigate to create ticket
  const handleCreateTicket = () => {
    navigate('/tickets/create');
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Format relative time
  const formatRelativeTime = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateString);
  };

  // Get status color
  const getStatusColor = (statusCode) => {
    const colors = {
      'OPEN': 'status-open',
      'IN_PROGRESS': 'status-progress',
      'PENDING': 'status-pending',
      'ON_HOLD': 'status-hold',
      'RESOLVED': 'status-resolved',
      'CLOSED': 'status-closed',
      'CANCELLED': 'status-cancelled'
    };
    return colors[statusCode] || 'status-default';
  };

  // Get priority color
  const getPriorityColor = (priorityCode) => {
    const colors = {
      'CRITICAL': 'priority-critical',
      'HIGH': 'priority-high',
      'MEDIUM': 'priority-medium',
      'LOW': 'priority-low',
      'PLANNING': 'priority-planning'
    };
    return colors[priorityCode] || 'priority-default';
  };

  // Get status icon
  const getStatusIcon = (statusCode) => {
    const icons = {
      'OPEN': AlertCircle,
      'IN_PROGRESS': Clock,
      'PENDING': Clock,
      'ON_HOLD': Clock,
      'RESOLVED': CheckCircle,
      'CLOSED': CheckCircle,
      'CANCELLED': AlertCircle
    };
    const Icon = icons[statusCode] || AlertCircle;
    return Icon;
  };

  if (loading) {
    return (
      <div className="my-tickets-page">
        <div className="loading-container">
          <Loader className="spinner" size={48} />
          <p>Loading your tickets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="my-tickets-page">
      {/* Header */}
      <div className="page-header">
        <div className="header-left">
          <div className="page-title-section">
            <Ticket size={32} className="page-icon" />
            <div>
              <h1 className="page-title">My Tickets</h1>
              <p className="page-subtitle">
                View and manage your support tickets
              </p>
            </div>
          </div>
        </div>
        <div className="header-right">
          <button className="btn-primary" onClick={handleCreateTicket}>
            <Plus size={18} />
            <span>New Ticket</span>
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="alert alert-error">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* View Mode Toggle */}
      <div className="view-mode-toggle">
        <button
          className={`toggle-btn ${viewMode === 'created' ? 'active' : ''}`}
          onClick={() => handleViewModeChange('created')}
        >
          <User size={18} />
          <span>Created by Me</span>
          <span className="badge">{stats.created_by_me}</span>
        </button>
        <button
          className={`toggle-btn ${viewMode === 'assigned' ? 'active' : ''}`}
          onClick={() => handleViewModeChange('assigned')}
        >
          <CheckCircle size={18} />
          <span>Assigned to Me</span>
          <span className="badge">{stats.assigned_to_me}</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div 
          className={`stat-card ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          <div className="stat-icon all">
            <Ticket size={24} />
          </div>
          <div className="stat-content">
            <p className="stat-label">All Tickets</p>
            <h3 className="stat-value">{stats.total}</h3>
          </div>
        </div>

        <div 
          className={`stat-card ${activeTab === 'open' ? 'active' : ''}`}
          onClick={() => setActiveTab('open')}
        >
          <div className="stat-icon open">
            <AlertCircle size={24} />
          </div>
          <div className="stat-content">
            <p className="stat-label">Open</p>
            <h3 className="stat-value">{stats.open}</h3>
          </div>
        </div>

        <div 
          className={`stat-card ${activeTab === 'in_progress' ? 'active' : ''}`}
          onClick={() => setActiveTab('in_progress')}
        >
          <div className="stat-icon progress">
            <Clock size={24} />
          </div>
          <div className="stat-content">
            <p className="stat-label">In Progress</p>
            <h3 className="stat-value">{stats.in_progress}</h3>
          </div>
        </div>

        <div 
          className={`stat-card ${activeTab === 'resolved' ? 'active' : ''}`}
          onClick={() => setActiveTab('resolved')}
        >
          <div className="stat-icon resolved">
            <CheckCircle size={24} />
          </div>
          <div className="stat-content">
            <p className="stat-label">Resolved</p>
            <h3 className="stat-value">{stats.resolved}</h3>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="search-bar">
        <div className="search-input-wrapper">
          <Search size={20} className="search-icon" />
          <input
            type="text"
            placeholder="Search tickets by number, title, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          {searchQuery && (
            <button 
              className="clear-search"
              onClick={() => setSearchQuery('')}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Tickets List */}
      <div className="tickets-section">
        <div className="section-header">
          <h2 className="section-title">
            {activeTab === 'all' && 'All Tickets'}
            {activeTab === 'open' && 'Open Tickets'}
            {activeTab === 'in_progress' && 'In Progress'}
            {activeTab === 'resolved' && 'Resolved Tickets'}
          </h2>
          <span className="section-count">
            {filteredTickets.length} {filteredTickets.length === 1 ? 'ticket' : 'tickets'}
          </span>
        </div>

        {filteredTickets.length === 0 ? (
          <div className="empty-state">
            <Ticket size={64} className="empty-icon" />
            <h3>No tickets found</h3>
            <p>
              {searchQuery
                ? 'Try adjusting your search terms'
                : activeTab === 'all'
                ? viewMode === 'created'
                  ? "You haven't created any tickets yet"
                  : "No tickets assigned to you"
                : `No ${activeTab.replace('_', ' ')} tickets`}
            </p>
            {!searchQuery && activeTab === 'all' && viewMode === 'created' && (
              <button className="btn-primary" onClick={handleCreateTicket}>
                <Plus size={18} />
                Create Your First Ticket
              </button>
            )}
          </div>
        ) : (
          <div className="tickets-grid">
            {filteredTickets.map((ticket) => {
              const StatusIcon = getStatusIcon(ticket.status_code);
              
              return (
                <div
                  key={ticket.ticket_id}
                  className="ticket-card"
                  onClick={() => handleTicketClick(ticket.ticket_id)}
                >
                  {/* Card Header */}
                  <div className="ticket-card-header">
                    <div className="ticket-number">
                      <span className="ticket-hash">#</span>
                      {ticket.ticket_number}
                    </div>
                    <div className="ticket-badges">
                      <span className={`status-badge ${getStatusColor(ticket.status_code)}`}>
                        <StatusIcon size={14} />
                        {ticket.status_name}
                      </span>
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="ticket-card-content">
                    <h3 className="ticket-title">
                      {ticket.title || ticket.subject || 'No Title'}
                    </h3>
                    <p className="ticket-description">
                      {ticket.description?.substring(0, 120)}
                      {ticket.description?.length > 120 ? '...' : ''}
                    </p>
                  </div>

                  {/* Card Meta */}
                  <div className="ticket-card-meta">
                    <div className="meta-row">
                      <span className={`priority-badge ${getPriorityColor(ticket.priority_code)}`}>
                        {ticket.priority_code === 'CRITICAL' || ticket.priority_code === 'HIGH' ? (
                          <AlertTriangle size={14} />
                        ) : null}
                        {ticket.priority_name}
                      </span>
                      {ticket.category_name && (
                        <span className="category-badge">
                          <Tag size={14} />
                          {ticket.category_name}
                        </span>
                      )}
                    </div>
                    
                    <div className="meta-row">
                      <span className="meta-item">
                        <Calendar size={14} />
                        {formatRelativeTime(ticket.created_at)}
                      </span>
                      
                      {viewMode === 'created' && ticket.assigned_to_name && (
                        <span className="meta-item">
                          <User size={14} />
                          {ticket.assigned_to_name}
                        </span>
                      )}
                    </div>

                    {(ticket.comments_count > 0 || ticket.attachments_count > 0) && (
                      <div className="meta-row">
                        {ticket.comments_count > 0 && (
                          <span className="meta-item">
                            <MessageSquare size={14} />
                            {ticket.comments_count}
                          </span>
                        )}
                        {ticket.attachments_count > 0 && (
                          <span className="meta-item">
                            <Paperclip size={14} />
                            {ticket.attachments_count}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Card Footer */}
                  <div className="ticket-card-footer">
                    <button className="view-details-btn">
                      <span>View Details</span>
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyTickets;
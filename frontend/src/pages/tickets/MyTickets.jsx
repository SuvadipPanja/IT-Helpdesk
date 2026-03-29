/**
 * ============================================
 * MY TICKETS PAGE - UPDATED
 * ============================================
 * RESOLVED status merged into CLOSED
 * UI shows "Closed" instead of "Resolved"
 * Backward compatible - still handles old RESOLVED tickets
 * Developer: Suvadip Panja
 * Company: Digitide
 * Updated: February 2026
 * FILE: frontend/src/pages/tickets/MyTickets.jsx
 * ============================================
 */

import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
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
  ArrowRight,
  RefreshCw,
  Flag
} from 'lucide-react';
import api from '../../services/api';
import { formatDate as formatDateUtil, timeAgo } from '../../utils/dateUtils';
import '../../styles/MyTickets.css';

const MyTickets = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  // State management
  const [tickets, setTickets] = useState([]);
  const [filteredTickets, setFilteredTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter state
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('created'); // 'created' or 'assigned'

  // Stats - UPDATED: renamed 'resolved' to 'closed'
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    in_progress: 0,
    closed: 0,  // UPDATED: was 'resolved', now 'closed'
    need_more_details: 0,  // Tickets where requester needs to provide details
    assigned_to_me: 0,
    created_by_me: 0
  });

  // Fetch tickets on mount
  useEffect(() => {
    fetchMyTickets();
  }, [viewMode]);

  // Auto-select tab from navigation state (e.g. from Dashboard "Needs My Details" click)
  useEffect(() => {
    if (location.state?.tab === 'need_details') {
      setActiveTab('need_details');
      setViewMode('created');
    }
  }, [location.state?.tab]);

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
      setError(err.response?.data?.message || 'Failed to load tickets');
      toast.error('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  // Calculate statistics - UPDATED: uses 'closed' instead of 'resolved'
  const calculateStats = (ticketData) => {
    const stats = {
      total: ticketData.length,
      open: ticketData.filter(t => t.status_code === 'OPEN').length,
      in_progress: ticketData.filter(t => t.status_code === 'IN_PROGRESS').length,
      // UPDATED: Still count both RESOLVED and CLOSED for backward compatibility
      closed: ticketData.filter(t => t.status_code === 'RESOLVED' || t.status_code === 'CLOSED').length,
      need_more_details: ticketData.filter(t => t.sla_paused && t.requester_id === user.user_id).length,
      assigned_to_me: ticketData.filter(t => (t.assigned_to_id ?? t.assigned_to) === user.user_id).length,
      created_by_me: ticketData.filter(t => t.requester_id === user.user_id).length,
    };
    setStats(stats);
  };

  // Filter tickets based on tab and search - UPDATED: 'closed' tab instead of 'resolved'
  const filterTickets = () => {
    let filtered = [...tickets];

    // Filter by tab
    if (activeTab === 'open') {
      filtered = filtered.filter(t => t.status_code === 'OPEN');
    } else if (activeTab === 'in_progress') {
      filtered = filtered.filter(t => t.status_code === 'IN_PROGRESS');
    } else if (activeTab === 'closed') {  // UPDATED: was 'resolved', now 'closed'
      // Still filter both RESOLVED and CLOSED for backward compatibility
      filtered = filtered.filter(t => 
        t.status_code === 'RESOLVED' || t.status_code === 'CLOSED'
      );
    } else if (activeTab === 'need_details') {
      filtered = filtered.filter(t => t.sla_paused && t.requester_id === user.user_id);
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
    toast.info(`Viewing tickets ${mode === 'created' ? 'created by you' : 'assigned to you'}`);
  };

  // Navigate to ticket detail
  const handleTicketClick = (ticketId, ticketNumber) => {
    toast.info(`Opening ticket ${ticketNumber || ''}`);
    navigate(`/tickets/${ticketId}`);
  };

  // Navigate to create ticket
  const handleCreateTicket = () => {
    toast.info('Opening ticket form...');
    navigate('/tickets/create');
  };

  // Refresh tickets
  const handleRefresh = () => {
    toast.info('Refreshing tickets...');
    fetchMyTickets();
  };

  // Format date using centralized utility
  const formatDate = (dateString) => formatDateUtil(dateString);
  const formatRelativeTime = (dateString) => timeAgo(dateString) || 'N/A';

  // Get status color - Keep RESOLVED for backward compatibility
  const getStatusColor = (statusCode) => {
    const colors = {
      'OPEN': 'status-open',
      'IN_PROGRESS': 'status-progress',
      'PENDING': 'status-pending',
      'PENDING_INFO': 'status-hold',
      'ON_HOLD': 'status-hold',
      'RESOLVED': 'status-closed',  // UPDATED: Map RESOLVED to closed styling
      'CLOSED': 'status-closed',
      'CANCELLED': 'status-cancelled',
      'REOPENED': 'status-reopened'
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

  // Get status icon - Keep RESOLVED for backward compatibility
  const getStatusIcon = (statusCode) => {
    const icons = {
      'OPEN': AlertCircle,
      'IN_PROGRESS': Clock,
      'PENDING': Clock,
      'PENDING_INFO': Flag,
      'ON_HOLD': Clock,
      'RESOLVED': CheckCircle,  // Keep for backward compatibility
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
                {viewMode === 'created' 
                  ? 'Tickets you have created' 
                  : 'Tickets assigned to you'}
              </p>
            </div>
          </div>
        </div>
        <div className="header-right">
          <button 
            className="btn-icon-action" 
            onClick={handleRefresh}
            title="Refresh"
          >
            <RefreshCw size={18} />
          </button>
          <button className="btn-primary" onClick={handleCreateTicket}>
            <Plus size={18} />
            <span>New Ticket</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
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

      {/* Stats Cards - UPDATED: "Closed" instead of "Resolved" */}
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

        {stats.need_more_details > 0 && (
          <div 
            className={`stat-card need-details ${activeTab === 'need_details' ? 'active' : ''}`}
            onClick={() => setActiveTab('need_details')}
          >
            <div className="stat-icon need-details">
              <Flag size={24} />
            </div>
            <div className="stat-content">
              <p className="stat-label">Needs More Details</p>
              <h3 className="stat-value">{stats.need_more_details}</h3>
            </div>
          </div>
        )}

        {/* UPDATED: "Closed" instead of "Resolved" */}
        <div 
          className={`stat-card ${activeTab === 'closed' ? 'active' : ''}`}
          onClick={() => setActiveTab('closed')}
        >
          <div className="stat-icon closed">
            <CheckCircle size={24} />
          </div>
          <div className="stat-content">
            <p className="stat-label">Closed</p>
            <h3 className="stat-value">{stats.closed}</h3>
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

      {/* Tickets List - UPDATED: "Closed" instead of "Resolved" */}
      <div className="tickets-section">
        <div className="section-header">
          <h2 className="section-title">
            {activeTab === 'all' && 'All Tickets'}
            {activeTab === 'open' && 'Open Tickets'}
            {activeTab === 'in_progress' && 'In Progress'}
            {activeTab === 'need_details' && 'Needs More Details'}
            {activeTab === 'closed' && 'Closed Tickets'}
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
                : activeTab === 'need_details'
                ? "No tickets need your details"
                : `No ${activeTab === 'closed' ? 'closed' : activeTab.replace('_', ' ')} tickets`}
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
                  onClick={() => handleTicketClick(ticket.ticket_id, ticket.ticket_number)}
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
                      {ticket.sla_paused && (
                        <span className="status-badge need-details-badge">
                          <Flag size={14} />
                          Needs More Details
                        </span>
                      )}
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
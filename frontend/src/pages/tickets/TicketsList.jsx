import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom'; // ← ADDED useSearchParams
import { useAuth } from '../../context/AuthContext';
import {
  Ticket,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Download,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  Edit,
  Trash2,
  MoreVertical,
  MessageSquare,
  Paperclip,
  User,
  Calendar,
  Tag,
  AlertTriangle,
  X
} from 'lucide-react';
import api from '../../services/api';
import '../../styles/TicketsList.css';

const TicketsList = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams(); // ← ADDED THIS LINE

  // Read status from URL parameter
  const statusFromUrl = searchParams.get('status'); // ← ADDED THIS LINE

  // State management
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [limit, setLimit] = useState(10);

  // Filter state
  const [filters, setFilters] = useState({
    search: '',
    status_id: '',
    priority_id: '',
    category_id: '',
    assigned_to: '',
    requester_id: ''
  });

  // Dropdown options state
  const [statuses, setStatuses] = useState([]);
  const [priorities, setPriorities] = useState([]);
  const [categories, setCategories] = useState([]);
  const [engineers, setEngineers] = useState([]);

  // Sorting state
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('DESC');

  // UI state
  const [showFilters, setShowFilters] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);

  // Fetch dropdown data on mount
  useEffect(() => {
    fetchDropdownData();
  }, []);

  // ============================================
  // NEW: Apply filter from URL parameter when page loads
  // ============================================
  useEffect(() => {
    if (statusFromUrl && statuses.length > 0) {
      const matchingStatus = statuses.find(s => s.status_code === statusFromUrl);
      if (matchingStatus) {
        setFilters(prev => ({
          ...prev,
          status_id: matchingStatus.status_id.toString()
        }));
        // Auto-open filters panel if coming from dashboard
        setShowFilters(true);
      }
    }
  }, [statusFromUrl, statuses]);
  // ============================================
  // END OF NEW CODE
  // ============================================

  // Fetch tickets when filters change
  useEffect(() => {
    fetchTickets();
  }, [currentPage, limit, sortBy, sortOrder, filters]);

  // Fetch dropdown options
  const fetchDropdownData = async () => {
    try {
      const [statusesRes, prioritiesRes, categoriesRes, engineersRes] = await Promise.all([
        api.get('/system/statuses'),
        api.get('/system/priorities'),
        api.get('/system/categories'),
        api.get('/system/engineers')
      ]);

      if (statusesRes.data.success) setStatuses(statusesRes.data.data);
      if (prioritiesRes.data.success) setPriorities(prioritiesRes.data.data);
      if (categoriesRes.data.success) setCategories(categoriesRes.data.data);
      if (engineersRes.data.success) setEngineers(engineersRes.data.data);
    } catch (err) {
      console.error('Error fetching dropdown data:', err);
    }
  };

  // Fetch tickets with filters and role-based access
  const fetchTickets = async () => {
    try {
      setLoading(true);
      setError('');

      // Build query parameters
      const params = {
        page: currentPage,
        limit: limit,
        sortBy: sortBy,
        sortOrder: sortOrder,
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== '')
        )
      };

      // Apply role-based filtering
      if (user?.role_name === 'User' && !user?.permissions?.can_view_all_tickets) {
        params.requester_id = user.user_id;
      }
      
      if (user?.role_name === 'Engineer' && !user?.permissions?.can_view_all_tickets) {
        params.assigned_to_or_created_by = user.user_id;
      }

      console.log('📤 Fetching tickets with params:', params);

      const response = await api.get('/tickets', { params });

      console.log('📥 Full API Response:', response.data);

      if (response.data.success) {
        const responseData = response.data.data;
        const ticketsData = responseData?.tickets || responseData || [];
        const paginationData = responseData?.pagination || {};
        
        console.log('🎫 Tickets data:', ticketsData);
        
        const ticketsArray = Array.isArray(ticketsData) ? ticketsData : [];
        
        setTickets(ticketsArray);
        setTotalPages(paginationData.totalPages || 1);
        setTotalRecords(paginationData.totalRecords || ticketsArray.length);

        console.log('✅ State updated - tickets count:', ticketsArray.length);
      } else {
        console.warn('⚠️ API returned success: false', response.data);
        setError(response.data.message || 'Failed to load tickets');
        setTickets([]);
      }
    } catch (err) {
      console.error('❌ Error fetching tickets:', err);
      setError(err.response?.data?.message || 'Failed to load tickets');
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle filter change
  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
    setCurrentPage(1);
  };

  // Handle search with debounce
  const handleSearch = (e) => {
    const value = e.target.value;
    handleFilterChange('search', value);
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      search: '',
      status_id: '',
      priority_id: '',
      category_id: '',
      assigned_to: '',
      requester_id: ''
    });
    setCurrentPage(1);
  };

  // Handle sort
  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(field);
      setSortOrder('DESC');
    }
  };

  // Navigate to ticket detail
  const viewTicket = (ticketId) => {
    navigate(`/tickets/${ticketId}`);
  };

  // Navigate to edit ticket
  const editTicket = (ticketId) => {
    navigate(`/tickets/edit/${ticketId}`);
  };

  // Delete ticket
  const deleteTicket = async (ticketId) => {
    if (!window.confirm('Are you sure you want to delete this ticket?')) {
      return;
    }

    try {
      await api.delete(`/tickets/${ticketId}`);
      fetchTickets();
    } catch (err) {
      console.error('Error deleting ticket:', err);
      alert(err.response?.data?.message || 'Failed to delete ticket');
    }
  };

  // Toggle dropdown menu
  const toggleDropdown = (ticketId) => {
    setActiveDropdown(activeDropdown === ticketId ? null : ticketId);
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
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
  const getStatusColor = (status) => {
    const colors = {
      'OPEN': 'status-open',
      'IN_PROGRESS': 'status-progress',
      'PENDING': 'status-pending',
      'ON_HOLD': 'status-hold',
      'RESOLVED': 'status-resolved',
      'CLOSED': 'status-closed',
      'CANCELLED': 'status-cancelled'
    };
    return colors[status] || 'status-default';
  };

  // Get priority color
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

  // Get status icon
  const getStatusIcon = (status) => {
    const icons = {
      'OPEN': AlertCircle,
      'IN_PROGRESS': Clock,
      'PENDING': Clock,
      'ON_HOLD': Clock,
      'RESOLVED': CheckCircle,
      'CLOSED': CheckCircle,
      'CANCELLED': XCircle
    };
    const Icon = icons[status] || AlertCircle;
    return <Icon size={14} />;
  };

  // Get priority icon
  const getPriorityIcon = (priority) => {
    if (priority === 'CRITICAL' || priority === 'HIGH') {
      return <AlertTriangle size={14} />;
    }
    return null;
  };

  // Check if user can edit ticket
  const canEditTicket = (ticket) => {
    if (user?.permissions?.can_assign_tickets) return true;
    if (ticket.requester_id === user?.user_id) return true;
    if (ticket.assigned_to === user?.user_id) return true;
    return false;
  };

  // Get active filter count
  const getActiveFilterCount = () => {
    return Object.values(filters).filter(v => v !== '').length;
  };

  return (
    <div className="tickets-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="header-left">
          <div className="page-title-wrapper">
            <div className="page-icon-wrapper">
              <Ticket size={28} className="page-icon" />
            </div>
            <div>
              <h1 className="page-title">Support Tickets</h1>
              <p className="page-subtitle">
                {totalRecords > 0 ? `${totalRecords} ticket${totalRecords !== 1 ? 's' : ''} found` : 'No tickets available'}
              </p>
            </div>
          </div>
        </div>
        <div className="header-right">
          <button 
            className="btn-icon-action" 
            onClick={fetchTickets} 
            title="Refresh"
            disabled={loading}
          >
            <RefreshCw size={18} className={loading ? 'spinning' : ''} />
          </button>
          <button className="btn-icon-action" title="Export to CSV">
            <Download size={18} />
          </button>
          {user?.permissions?.can_create_tickets && (
            <button 
              className="btn-primary-action"
              onClick={() => navigate('/tickets/create')}
            >
              <Plus size={20} />
              <span>Create Ticket</span>
            </button>
          )}
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="filter-section">
        <div className="search-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search by ticket #, title, or requester..."
            className="search-input-large"
            value={filters.search}
            onChange={handleSearch}
          />
          {filters.search && (
            <button 
              className="search-clear-btn"
              onClick={() => handleFilterChange('search', '')}
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="filter-actions">
          <button 
            className={`btn-filter ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={18} />
            <span>Filters</span>
            {getActiveFilterCount() > 0 && (
              <span className="filter-count">
                {getActiveFilterCount()}
              </span>
            )}
          </button>

          {getActiveFilterCount() > 0 && (
            <button className="btn-clear-filters" onClick={clearFilters}>
              <X size={16} />
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <div className="filters-panel">
          <div className="filters-grid">
            {/* Status Filter */}
            <div className="filter-item">
              <label className="filter-label">
                <Tag size={14} />
                Status
              </label>
              <select
                value={filters.status_id}
                onChange={(e) => handleFilterChange('status_id', e.target.value)}
                className="filter-select"
              >
                <option value="">All Statuses</option>
                {statuses.map((status) => (
                  <option key={status.status_id} value={status.status_id}>
                    {status.status_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority Filter */}
            <div className="filter-item">
              <label className="filter-label">
                <AlertTriangle size={14} />
                Priority
              </label>
              <select
                value={filters.priority_id}
                onChange={(e) => handleFilterChange('priority_id', e.target.value)}
                className="filter-select"
              >
                <option value="">All Priorities</option>
                {priorities.map((priority) => (
                  <option key={priority.priority_id} value={priority.priority_id}>
                    {priority.priority_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            <div className="filter-item">
              <label className="filter-label">
                <Ticket size={14} />
                Category
              </label>
              <select
                value={filters.category_id}
                onChange={(e) => handleFilterChange('category_id', e.target.value)}
                className="filter-select"
              >
                <option value="">All Categories</option>
                {categories.map((category) => (
                  <option key={category.category_id} value={category.category_id}>
                    {category.category_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Assigned To Filter - Only for managers/admins */}
            {(user?.permissions?.can_assign_tickets || user?.permissions?.can_view_all_tickets) && (
              <div className="filter-item">
                <label className="filter-label">
                  <User size={14} />
                  Assigned To
                </label>
                <select
                  value={filters.assigned_to}
                  onChange={(e) => handleFilterChange('assigned_to', e.target.value)}
                  className="filter-select"
                >
                  <option value="">All Engineers</option>
                  <option value="unassigned">Unassigned</option>
                  {engineers.map((engineer) => (
                    <option key={engineer.user_id} value={engineer.user_id}>
                      {engineer.full_name || engineer.username}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Active Filters Display */}
          {getActiveFilterCount() > 0 && (
            <div className="active-filters">
              <span className="active-filters-label">Active Filters:</span>
              <div className="filter-chips">
                {filters.status_id && (
                  <div className="filter-chip">
                    <span>Status: {statuses.find(s => s.status_id === parseInt(filters.status_id))?.status_name}</span>
                    <button onClick={() => handleFilterChange('status_id', '')}>
                      <X size={12} />
                    </button>
                  </div>
                )}
                {filters.priority_id && (
                  <div className="filter-chip">
                    <span>Priority: {priorities.find(p => p.priority_id === parseInt(filters.priority_id))?.priority_name}</span>
                    <button onClick={() => handleFilterChange('priority_id', '')}>
                      <X size={12} />
                    </button>
                  </div>
                )}
                {filters.category_id && (
                  <div className="filter-chip">
                    <span>Category: {categories.find(c => c.category_id === parseInt(filters.category_id))?.category_name}</span>
                    <button onClick={() => handleFilterChange('category_id', '')}>
                      <X size={12} />
                    </button>
                  </div>
                )}
                {filters.assigned_to && (
                  <div className="filter-chip">
                    <span>
                      Assigned: {filters.assigned_to === 'unassigned' 
                        ? 'Unassigned' 
                        : engineers.find(e => e.user_id === parseInt(filters.assigned_to))?.full_name || 'Unknown'}
                    </span>
                    <button onClick={() => handleFilterChange('assigned_to', '')}>
                      <X size={12} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="alert alert-error">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={() => setError('')} className="alert-close">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Tickets Table */}
      <div className="table-container">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading tickets...</p>
          </div>
        ) : tickets.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon-wrapper">
              <Ticket size={64} className="empty-icon" />
            </div>
            <h3>No tickets found</h3>
            <p className="empty-description">
              {getActiveFilterCount() > 0
                ? 'No tickets match your current filters. Try adjusting or clearing them.'
                : user?.role_name === 'User'
                ? 'You haven\'t created any tickets yet. Create your first ticket to get started.'
                : 'No tickets are available in the system yet.'}
            </p>
            {user?.permissions?.can_create_tickets && (
              <button
                className="btn-primary-action"
                onClick={() => navigate('/tickets/create')}
              >
                <Plus size={20} />
                <span>Create First Ticket</span>
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="table-wrapper">
              <table className="tickets-table">
                <thead>
                  <tr>
                    <th 
                      onClick={() => handleSort('ticket_number')} 
                      className="sortable th-ticket-number"
                    >
                      <div className="th-content">
                        <span>Ticket #</span>
                        {sortBy === 'ticket_number' && (
                          <span className="sort-indicator">
                            {sortOrder === 'ASC' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('subject')} 
                      className="sortable th-title"
                    >
                      <div className="th-content">
                        <span>Title & Details</span>
                        {sortBy === 'subject' && (
                          <span className="sort-indicator">
                            {sortOrder === 'ASC' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th className="th-category">Category</th>
                    <th 
                      onClick={() => handleSort('priority_level')} 
                      className="sortable th-priority"
                    >
                      <div className="th-content">
                        <span>Priority</span>
                        {sortBy === 'priority_level' && (
                          <span className="sort-indicator">
                            {sortOrder === 'ASC' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th 
                      onClick={() => handleSort('status_code')} 
                      className="sortable th-status"
                    >
                      <div className="th-content">
                        <span>Status</span>
                        {sortBy === 'status_code' && (
                          <span className="sort-indicator">
                            {sortOrder === 'ASC' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th className="th-requester">Requester</th>
                    <th className="th-assigned">Assigned To</th>
                    <th 
                      onClick={() => handleSort('created_at')} 
                      className="sortable th-created"
                    >
                      <div className="th-content">
                        <span>Created</span>
                        {sortBy === 'created_at' && (
                          <span className="sort-indicator">
                            {sortOrder === 'ASC' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th className="th-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr 
                      key={ticket.ticket_id} 
                      className={`ticket-row ${ticket.is_escalated ? 'escalated' : ''}`}
                      onClick={() => viewTicket(ticket.ticket_id)}
                    >
                      <td className="ticket-number-cell">
                        <div className="ticket-number-wrapper">
                          <span className="ticket-number" title={ticket.ticket_number}>
                            #{ticket.ticket_number}
                          </span>
                          {ticket.is_escalated && (
                            <span className="escalated-badge" title="Escalated">
                              <AlertTriangle size={12} />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="ticket-title-cell">
                        <div className="ticket-title-content">
                          <button
                            className="ticket-title-link"
                            onClick={(e) => {
                              e.stopPropagation();
                              viewTicket(ticket.ticket_id);
                            }}
                            title={ticket.title || ticket.subject}
                          >
                            {ticket.title || ticket.subject || 'No Title'}
                          </button>
                          <div className="ticket-meta">
                            {ticket.comments_count > 0 && (
                              <span className="meta-item" title={`${ticket.comments_count} comment${ticket.comments_count !== 1 ? 's' : ''}`}>
                                <MessageSquare size={12} />
                                <span>{ticket.comments_count}</span>
                              </span>
                            )}
                            {ticket.attachments_count > 0 && (
                              <span className="meta-item" title={`${ticket.attachments_count} attachment${ticket.attachments_count !== 1 ? 's' : ''}`}>
                                <Paperclip size={12} />
                                <span>{ticket.attachments_count}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="category-cell">
                        <span className="category-badge" title={ticket.category_name}>
                          {ticket.category_name || 'N/A'}
                        </span>
                      </td>
                      <td className="priority-cell">
                        <span 
                          className={`priority-badge ${getPriorityColor(ticket.priority_code)}`}
                          title={ticket.priority_name}
                        >
                          {getPriorityIcon(ticket.priority_code)}
                          <span>{ticket.priority_name || 'N/A'}</span>
                        </span>
                      </td>
                      <td className="status-cell">
                        <span 
                          className={`status-badge ${getStatusColor(ticket.status_code)}`}
                          title={ticket.status_name}
                        >
                          {getStatusIcon(ticket.status_code)}
                          <span>{ticket.status_name || 'N/A'}</span>
                        </span>
                      </td>
                      <td className="requester-cell">
                        <div className="user-info" title={ticket.requester_name}>
                          <div className="user-avatar">
                            <User size={14} />
                          </div>
                          <span className="user-name">
                            {ticket.requester_name || 'Unknown'}
                          </span>
                        </div>
                      </td>
                      <td className="assigned-cell">
                        {ticket.assigned_to_name ? (
                          <div className="user-info" title={ticket.assigned_to_name}>
                            <div className="user-avatar assigned">
                              <User size={14} />
                            </div>
                            <span className="user-name">
                              {ticket.assigned_to_name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted">Unassigned</span>
                        )}
                      </td>
                      <td className="date-cell">
                        <div className="date-info">
                          <span className="date-relative" title={formatDate(ticket.created_at)}>
                            {formatRelativeTime(ticket.created_at)}
                          </span>
                          <span className="date-full">
                            {formatDate(ticket.created_at)}
                          </span>
                        </div>
                      </td>
                      <td className="actions-cell" onClick={(e) => e.stopPropagation()}>
                        <div className="action-buttons">
                          <button
                            className="btn-action-table view"
                            onClick={(e) => {
                              e.stopPropagation();
                              viewTicket(ticket.ticket_id);
                            }}
                            title="View Details"
                          >
                            <Eye size={16} />
                          </button>
                          {canEditTicket(ticket) && (
                            <button
                              className="btn-action-table edit"
                              onClick={(e) => {
                                e.stopPropagation();
                                editTicket(ticket.ticket_id);
                              }}
                              title="Edit Ticket"
                            >
                              <Edit size={16} />
                            </button>
                          )}
                          <div className="dropdown-wrapper">
                            <button
                              className="btn-action-table more"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleDropdown(ticket.ticket_id);
                              }}
                              title="More Actions"
                            >
                              <MoreVertical size={16} />
                            </button>
                            {activeDropdown === ticket.ticket_id && (
                              <div className="dropdown-menu">
                                <button 
                                  className="dropdown-item"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    viewTicket(ticket.ticket_id);
                                    setActiveDropdown(null);
                                  }}
                                >
                                  <Eye size={14} />
                                  <span>View Details</span>
                                </button>
                                {canEditTicket(ticket) && (
                                  <button 
                                    className="dropdown-item"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      editTicket(ticket.ticket_id);
                                      setActiveDropdown(null);
                                    }}
                                  >
                                    <Edit size={14} />
                                    <span>Edit Ticket</span>
                                  </button>
                                )}
                                {user?.permissions?.can_delete_tickets && (
                                  <>
                                    <div className="dropdown-divider"></div>
                                    <button 
                                      className="dropdown-item danger"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteTicket(ticket.ticket_id);
                                        setActiveDropdown(null);
                                      }}
                                    >
                                      <Trash2 size={14} />
                                      <span>Delete Ticket</span>
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="pagination-container">
              <div className="pagination-info">
                Showing <strong>{((currentPage - 1) * limit) + 1}</strong> to{' '}
                <strong>{Math.min(currentPage * limit, totalRecords)}</strong> of{' '}
                <strong>{totalRecords}</strong> ticket{totalRecords !== 1 ? 's' : ''}
              </div>

              <div className="pagination-controls">
                <div className="page-size-selector">
                  <label>Rows per page:</label>
                  <select
                    value={limit}
                    onChange={(e) => {
                      setLimit(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="page-size-select"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>

                <div className="pagination-buttons">
                  <button
                    className="btn-pagination"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    title="Previous Page"
                  >
                    <ChevronLeft size={18} />
                  </button>

                  {[...Array(Math.min(5, totalPages))].map((_, idx) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = idx + 1;
                    } else if (currentPage <= 3) {
                      pageNum = idx + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + idx;
                    } else {
                      pageNum = currentPage - 2 + idx;
                    }

                    return (
                      <button
                        key={pageNum}
                        className={`btn-pagination ${currentPage === pageNum ? 'active' : ''}`}
                        onClick={() => setCurrentPage(pageNum)}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    className="btn-pagination"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    title="Next Page"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Click outside to close dropdown */}
      {activeDropdown && (
        <div 
          className="dropdown-overlay" 
          onClick={() => setActiveDropdown(null)}
        />
      )}
    </div>
  );
};

export default TicketsList;
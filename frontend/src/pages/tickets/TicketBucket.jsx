/**
 * ============================================
 * TICKET BUCKET PAGE - OPEN TICKET POOL
 * ============================================
 * Engineers can browse and pick up unassigned tickets
 * filtered by location zone.
 * 
 * FEATURES:
 * - Location-based filtering (own location pre-selected)
 * - Unassigned ticket table with key details
 * - Self-assign (pick up) with confirmation
 * - Stats showing count per location
 * - Search, pagination, sorting
 * - Real-time refresh after pick-up
 * - Responsive enterprise design
 * 
 * SECURITY:
 * - Only ENGINEER role can self-assign
 * - ADMIN/MANAGER can view but not self-assign
 * - Backend enforces all security checks
 * 
 * Developer: Suvadip Panja
 * Company: Digitide
 * Created: March 2026
 * ============================================
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  Inbox,
  Search,
  RefreshCw,
  MapPin,
  Eye,
  UserPlus,
  Filter,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Clock,
  CheckCircle,
  Tag,
  X,
  Loader,
  AlertTriangle,
  Calendar,
  Building2,
  ArrowUpDown,
  Info
} from 'lucide-react';
import api from '../../services/api';
import { API_BASE_URL } from '../../utils/constants';
import { formatDate as formatDateUtil, timeAgo } from '../../utils/dateUtils';
import '../../styles/TicketBucket.css';

// ============================================
// CONSTANTS
// ============================================
const CACHE_DURATION = 30000; // 30 seconds

// ============================================
// MAIN COMPONENT
// ============================================
const TicketBucket = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  // Role checks
  const roleCode = user?.role?.role_code || '';
  const isEngineer = roleCode === 'ENGINEER';
  const isAdminOrManager = roleCode === 'ADMIN' || roleCode === 'MANAGER';
  const userLocationId = user?.location_id || null;

  // ============================================
  // STATE
  // ============================================
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [limit] = useState(15);

  // Filters
  const [selectedLocation, setSelectedLocation] = useState('my-location');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Sorting
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('DESC');

  // Stats
  const [bucketStats, setBucketStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Lookup data
  const [locations, setLocations] = useState([]);

  // Self-assign state
  const [assigningTicketId, setAssigningTicketId] = useState(null);
  const [confirmPickup, setConfirmPickup] = useState(null);

  // Cache
  const statsCache = useRef({ data: null, timestamp: 0 });

  // ============================================
  // DEBOUNCE SEARCH
  // ============================================
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ============================================
  // EFFECTS
  // ============================================
  useEffect(() => {
    fetchLocations();
    fetchBucketStats();
  }, []);

  useEffect(() => {
    fetchBucketTickets();
  }, [currentPage, sortBy, sortOrder, debouncedSearch, selectedLocation]);

  // ============================================
  // FETCH LOCATIONS
  // ============================================
  const fetchLocations = async () => {
    try {
      const response = await api.get('/system/locations');
      if (response.data.success) {
        setLocations(response.data.data || []);
      }
    } catch (err) {
      // Silently handle
    }
  };

  // ============================================
  // FETCH BUCKET STATS
  // ============================================
  const fetchBucketStats = useCallback(async (forceRefresh = false) => {
    const now = Date.now();
    if (!forceRefresh && statsCache.current.data &&
        (now - statsCache.current.timestamp) < CACHE_DURATION) {
      setBucketStats(statsCache.current.data);
      return;
    }

    setStatsLoading(true);
    try {
      const response = await api.get('/ticket-bucket/stats');
      if (response.data.success) {
        const data = response.data.data;
        statsCache.current = { data, timestamp: now };
        setBucketStats(data);
      }
    } catch (err) {
      // Silently handle
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // ============================================
  // FETCH BUCKET TICKETS
  // ============================================
  const fetchBucketTickets = async () => {
    try {
      setLoading(true);
      setError('');

      const params = {
        page: currentPage,
        limit,
        sortBy,
        sortOrder,
      };

      // Location filter
      if (selectedLocation === 'my-location' && userLocationId) {
        params.location_id = userLocationId;
      } else if (selectedLocation !== 'all' && selectedLocation !== 'my-location') {
        params.location_id = selectedLocation;
      }
      // 'all' = no location_id param

      // Search
      if (debouncedSearch) {
        params.search = debouncedSearch;
      }

      const response = await api.get('/ticket-bucket', { params });

      if (response.data.success) {
        const responseData = response.data.data;
        const ticketsData = responseData?.tickets || [];
        const paginationData = responseData?.pagination || {};

        setTickets(Array.isArray(ticketsData) ? ticketsData : []);
        setTotalRecords(paginationData.totalRecords || 0);
        setTotalPages(paginationData.totalPages || 1);
      }
    } catch (err) {
      if (err.response?.status === 403) {
        setError('You do not have permission to access the ticket bucket.');
      } else {
        setError('Failed to load bucket tickets. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // SELF-ASSIGN (PICK UP) TICKET
  // ============================================
  const handlePickUp = async (ticketId) => {
    if (!isEngineer) {
      toast.error('Only engineers can pick up tickets from the bucket');
      return;
    }

    setAssigningTicketId(ticketId);
    try {
      const response = await api.post(`/ticket-bucket/${ticketId}/self-assign`);
      
      if (response.data.success) {
        toast.success(response.data.message || 'Ticket picked up successfully!');
        setConfirmPickup(null);

        // Refresh data
        fetchBucketTickets();
        fetchBucketStats(true);
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to pick up ticket';
      if (err.response?.status === 409) {
        toast.warning(message);
        // Refresh to show updated data
        fetchBucketTickets();
        fetchBucketStats(true);
      } else {
        toast.error(message);
      }
    } finally {
      setAssigningTicketId(null);
    }
  };

  // ============================================
  // SORT HANDLER
  // ============================================
  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(field);
      setSortOrder('DESC');
    }
    setCurrentPage(1);
  };

  // ============================================
  // LOCATION CHANGE
  // ============================================
  const handleLocationChange = (value) => {
    setSelectedLocation(value);
    setCurrentPage(1);
  };

  // ============================================
  // FORMAT DATE
  // ============================================
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return formatDateUtil ? formatDateUtil(dateStr) : new Date(dateStr).toLocaleDateString();
    } catch {
      return '—';
    }
  };

  // ============================================
  // PROFILE PICTURE URL
  // ============================================
  const getProfilePictureUrl = (profilePicture) => {
    if (!profilePicture) return null;
    if (profilePicture.startsWith('http://') || profilePicture.startsWith('https://')) {
      return profilePicture;
    }
    const urlWithoutApi = API_BASE_URL.replace('/api/v1', '');
    const cleanPath = profilePicture.startsWith('/') ? profilePicture : `/${profilePicture}`;
    return `${urlWithoutApi}${cleanPath}`;
  };

  // ============================================
  // PRIORITY BADGE
  // ============================================
  const getPriorityBadgeClass = (code) => {
    const map = {
      'CRITICAL': 'tb-priority-critical',
      'HIGH': 'tb-priority-high',
      'MEDIUM': 'tb-priority-medium',
      'LOW': 'tb-priority-low',
      'PLANNING': 'tb-priority-planning',
    };
    return map[code] || 'tb-priority-medium';
  };

  // ============================================
  // GET LOCATION DISPLAY
  // ============================================
  const getSelectedLocationName = () => {
    if (selectedLocation === 'all') return 'All Locations';
    if (selectedLocation === 'my-location') {
      if (!userLocationId) return 'All Locations';
      const loc = locations.find(l => l.location_id === userLocationId);
      return loc ? `My Location (${loc.location_name})` : 'My Location';
    }
    const loc = locations.find(l => String(l.location_id) === String(selectedLocation));
    return loc ? loc.location_name : 'Unknown';
  };

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="tb-page">
      {/* Page Header */}
      <div className="tb-header">
        <div className="tb-header-left">
          <div className="tb-title-wrapper">
            <div className="tb-icon-wrapper">
              <Inbox size={24} />
            </div>
            <div>
              <h1 className="tb-title">Open Ticket Bucket</h1>
              <p className="tb-subtitle">
                Browse and pick up unassigned tickets
                {isAdminOrManager && ' (View Only — Admin/Manager)'}
              </p>
            </div>
          </div>
        </div>

        <div className="tb-header-right">
          <button
            className="tb-btn-icon"
            onClick={() => {
              fetchBucketTickets();
              fetchBucketStats(true);
              toast.info('Refreshing bucket...');
            }}
            disabled={loading}
            title="Refresh"
          >
            <RefreshCw size={18} className={loading ? 'tb-spinning' : ''} />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="tb-stats-row">
        {/* Total Unassigned */}
        <div 
          className={`tb-stat-card tb-stat-total ${selectedLocation === 'all' ? 'active' : ''}`}
          onClick={() => handleLocationChange('all')}
        >
          <div className="tb-stat-icon">
            <Inbox size={20} />
          </div>
          <div className="tb-stat-info">
            <span className="tb-stat-count">
              {statsLoading ? '...' : (bucketStats?.total_unassigned || 0)}
            </span>
            <span className="tb-stat-label">All Unassigned</span>
          </div>
          {selectedLocation === 'all' && <div className="tb-stat-check"><CheckCircle size={14} /></div>}
        </div>

        {/* My Location */}
        {userLocationId && (
          <div 
            className={`tb-stat-card tb-stat-my-loc ${selectedLocation === 'my-location' ? 'active' : ''}`}
            onClick={() => handleLocationChange('my-location')}
          >
            <div className="tb-stat-icon">
              <MapPin size={20} />
            </div>
            <div className="tb-stat-info">
              <span className="tb-stat-count">
                {statsLoading ? '...' : (
                  bucketStats?.locations?.find(l => l.location_id === userLocationId)?.ticket_count || 0
                )}
              </span>
              <span className="tb-stat-label">
                {locations.find(l => l.location_id === userLocationId)?.location_name || 'My Location'}
              </span>
            </div>
            {selectedLocation === 'my-location' && <div className="tb-stat-check"><CheckCircle size={14} /></div>}
          </div>
        )}

        {/* Other locations */}
        {bucketStats?.locations?.filter(l => l.location_id !== userLocationId).map(loc => (
          <div
            key={loc.location_id}
            className={`tb-stat-card ${String(selectedLocation) === String(loc.location_id) ? 'active' : ''}`}
            onClick={() => handleLocationChange(String(loc.location_id))}
          >
            <div className="tb-stat-icon">
              <Building2 size={20} />
            </div>
            <div className="tb-stat-info">
              <span className="tb-stat-count">{loc.ticket_count || 0}</span>
              <span className="tb-stat-label">{loc.location_name}</span>
            </div>
            {String(selectedLocation) === String(loc.location_id) && (
              <div className="tb-stat-check"><CheckCircle size={14} /></div>
            )}
          </div>
        ))}
      </div>

      {/* Info Banner */}
      {isEngineer && (
        <div className="tb-info-banner">
          <Info size={16} />
          <span>
            You can pick up tickets from this bucket to assign them to yourself.
            Only unassigned tickets with active status are shown here.
          </span>
        </div>
      )}

      {isAdminOrManager && (
        <div className="tb-info-banner tb-info-warning">
          <AlertTriangle size={16} />
          <span>
            You are viewing the bucket as {roleCode}. Only engineers can pick up tickets. 
            Use the regular ticket assignment to assign tickets.
          </span>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="tb-filter-bar">
        <div className="tb-search-wrapper">
          <Search size={18} className="tb-search-icon" />
          <input
            type="text"
            placeholder="Search by ticket #, subject, or description..."
            className="tb-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="tb-search-clear" onClick={() => setSearchQuery('')}>
              <X size={16} />
            </button>
          )}
        </div>

        <div className="tb-filter-location">
          <MapPin size={16} />
          <select
            value={selectedLocation}
            onChange={(e) => handleLocationChange(e.target.value)}
            className="tb-location-select"
          >
            <option value="all">All Locations</option>
            {userLocationId && (
              <option value="my-location">
                My Location ({locations.find(l => l.location_id === userLocationId)?.location_name || '...'})
              </option>
            )}
            {locations.map(loc => (
              <option key={loc.location_id} value={String(loc.location_id)}>
                {loc.location_name}
              </option>
            ))}
          </select>
        </div>

        <div className="tb-result-count">
          <span>{totalRecords} ticket{totalRecords !== 1 ? 's' : ''} found</span>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="tb-error">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={fetchBucketTickets}>Retry</button>
        </div>
      )}

      {/* Loading State */}
      {loading && !error && (
        <div className="tb-loading">
          <Loader size={32} className="tb-spinning" />
          <span>Loading bucket tickets...</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && tickets.length === 0 && (
        <div className="tb-empty">
          <Inbox size={48} />
          <h3>No Unassigned Tickets</h3>
          <p>
            {selectedLocation === 'all'
              ? 'There are no unassigned tickets in the system right now.'
              : `No unassigned tickets found for ${getSelectedLocationName()}.`}
          </p>
          <button onClick={() => handleLocationChange('all')} className="tb-btn-secondary">
            View All Locations
          </button>
        </div>
      )}

      {/* Tickets Table */}
      {!loading && !error && tickets.length > 0 && (
        <div className="tb-table-container">
          <table className="tb-table">
            <thead>
              <tr>
                <th className="tb-col-ticket" onClick={() => handleSort('ticket_number')}>
                  <span>Ticket #</span>
                  {sortBy === 'ticket_number' && (
                    <ArrowUpDown size={14} className={sortOrder === 'ASC' ? 'tb-sort-asc' : 'tb-sort-desc'} />
                  )}
                </th>
                <th className="tb-col-subject" onClick={() => handleSort('subject')}>
                  <span>Subject</span>
                  {sortBy === 'subject' && (
                    <ArrowUpDown size={14} className={sortOrder === 'ASC' ? 'tb-sort-asc' : 'tb-sort-desc'} />
                  )}
                </th>
                <th className="tb-col-priority" onClick={() => handleSort('priority_id')}>
                  <span>Priority</span>
                  {sortBy === 'priority_id' && (
                    <ArrowUpDown size={14} className={sortOrder === 'ASC' ? 'tb-sort-asc' : 'tb-sort-desc'} />
                  )}
                </th>
                <th className="tb-col-location">Location</th>
                <th className="tb-col-department">Department</th>
                <th className="tb-col-requester">Requester</th>
                <th className="tb-col-date" onClick={() => handleSort('created_at')}>
                  <span>Created</span>
                  {sortBy === 'created_at' && (
                    <ArrowUpDown size={14} className={sortOrder === 'ASC' ? 'tb-sort-asc' : 'tb-sort-desc'} />
                  )}
                </th>
                <th className="tb-col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map(ticket => (
                <tr key={ticket.ticket_id} className="tb-row">
                  <td className="tb-col-ticket">
                    <span className="tb-ticket-number">{ticket.ticket_number}</span>
                  </td>
                  <td className="tb-col-subject">
                    <div className="tb-subject-cell">
                      <span className="tb-subject-text" title={ticket.subject}>
                        {ticket.subject}
                      </span>
                      {ticket.category_name && (
                        <span className="tb-category-tag">
                          <Tag size={11} />
                          {ticket.category_name}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="tb-col-priority">
                    <span 
                      className={`tb-priority-badge ${getPriorityBadgeClass(ticket.priority_code)}`}
                      style={ticket.priority_color ? { '--priority-color': ticket.priority_color } : {}}
                    >
                      {ticket.priority_name || 'Normal'}
                    </span>
                  </td>
                  <td className="tb-col-location">
                    <span className="tb-location-text">
                      {ticket.ticket_location_name || '—'}
                    </span>
                  </td>
                  <td className="tb-col-department">
                    <span className="tb-department-text">
                      {ticket.department_name || '—'}
                    </span>
                  </td>
                  <td className="tb-col-requester">
                    <div className="tb-requester-cell">
                      {ticket.requester_profile_picture ? (
                        <img
                          src={getProfilePictureUrl(ticket.requester_profile_picture)}
                          alt=""
                          className="tb-requester-avatar"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        <div className="tb-requester-avatar-placeholder">
                          {(ticket.requester_name || 'U')[0]}
                        </div>
                      )}
                      <span className="tb-requester-name">{ticket.requester_name || 'Unknown'}</span>
                    </div>
                  </td>
                  <td className="tb-col-date">
                    <div className="tb-date-cell">
                      <span className="tb-date-text">{formatDate(ticket.created_at)}</span>
                      <span className="tb-date-ago">{timeAgo ? timeAgo(ticket.created_at) : ''}</span>
                    </div>
                  </td>
                  <td className="tb-col-actions">
                    <div className="tb-actions">
                      <button
                        className="tb-btn-view"
                        onClick={() => navigate(`/tickets/${ticket.ticket_id}`)}
                        title="View Details"
                      >
                        <Eye size={16} />
                      </button>

                      {isEngineer && (
                        <>
                          {confirmPickup === ticket.ticket_id ? (
                            <div className="tb-confirm-pickup">
                              <button
                                className="tb-btn-confirm-yes"
                                onClick={() => handlePickUp(ticket.ticket_id)}
                                disabled={assigningTicketId === ticket.ticket_id}
                                title="Confirm Pick Up"
                              >
                                {assigningTicketId === ticket.ticket_id ? (
                                  <Loader size={14} className="tb-spinning" />
                                ) : (
                                  <CheckCircle size={14} />
                                )}
                              </button>
                              <button
                                className="tb-btn-confirm-no"
                                onClick={() => setConfirmPickup(null)}
                                title="Cancel"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <button
                              className="tb-btn-pickup"
                              onClick={() => setConfirmPickup(ticket.ticket_id)}
                              disabled={assigningTicketId !== null}
                              title="Pick Up This Ticket"
                            >
                              <UserPlus size={16} />
                              <span>Pick Up</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="tb-pagination">
          <div className="tb-pagination-info">
            Showing {((currentPage - 1) * limit) + 1} to {Math.min(currentPage * limit, totalRecords)} of {totalRecords} tickets
          </div>
          <div className="tb-pagination-controls">
            <button
              className="tb-page-btn"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft size={18} />
            </button>
            
            {/* Page numbers */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  className={`tb-page-btn ${currentPage === pageNum ? 'active' : ''}`}
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              className="tb-page-btn"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Pick-Up Confirmation Modal */}
      {/* (Handled inline in table for faster interaction) */}
    </div>
  );
};

export default TicketBucket;

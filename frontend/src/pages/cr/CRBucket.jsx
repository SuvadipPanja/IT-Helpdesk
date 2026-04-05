/**
 * CR BUCKET PAGE - OPEN CR POOL
 * Engineers can browse and pick up unassigned CRs
 * filtered by location zone.
 * Mirrors TicketBucket.jsx exactly with CR naming.
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
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Clock,
  CheckCircle,
  Tag,
  X,
  Loader,
  AlertTriangle,
  Building2,
  ArrowUpDown,
  Info,
  Shield,
} from 'lucide-react';
import api from '../../services/api';
import { API_BASE_URL } from '../../utils/constants';
import { formatDate as formatDateUtil, timeAgo } from '../../utils/dateUtils';
import '../../styles/CRBucket.css';

const CACHE_DURATION = 30000;

const CRBucket = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const roleCode = user?.role?.role_code || '';
  const isEngineer = roleCode === 'ENGINEER';
  const isAdminOrManager = roleCode === 'ADMIN' || roleCode === 'MANAGER';
  const userLocationId = user?.location_id || null;

  // State
  const [crs, setCrs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [limit] = useState(15);

  const [selectedLocation, setSelectedLocation] = useState('my-location');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('DESC');

  const [bucketStats, setBucketStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [locations, setLocations] = useState([]);

  const [assigningCrId, setAssigningCrId] = useState(null);
  const [confirmPickup, setConfirmPickup] = useState(null);

  const statsCache = useRef({ data: null, timestamp: 0 });

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    fetchLocations();
    fetchBucketStats();
  }, []);

  useEffect(() => {
    fetchBucketCRs();
  }, [currentPage, sortBy, sortOrder, debouncedSearch, selectedLocation]);

  const fetchLocations = async () => {
    try {
      const response = await api.get('/system/locations');
      if (response.data.success) setLocations(response.data.data || []);
    } catch (err) { /* silent */ }
  };

  const fetchBucketStats = useCallback(async (forceRefresh = false) => {
    const now = Date.now();
    if (!forceRefresh && statsCache.current.data && (now - statsCache.current.timestamp) < CACHE_DURATION) {
      setBucketStats(statsCache.current.data);
      return;
    }
    setStatsLoading(true);
    try {
      const response = await api.get('/cr-bucket/stats');
      if (response.data.success) {
        const data = response.data.data;
        statsCache.current = { data, timestamp: now };
        setBucketStats(data);
      }
    } catch (err) { /* silent */ }
    finally { setStatsLoading(false); }
  }, []);

  const fetchBucketCRs = async () => {
    try {
      setLoading(true);
      setError('');
      const params = { page: currentPage, limit, sortBy, sortOrder };

      if (selectedLocation === 'my-location' && userLocationId) {
        params.location_id = userLocationId;
      } else if (selectedLocation !== 'all' && selectedLocation !== 'my-location') {
        params.location_id = selectedLocation;
      }

      if (debouncedSearch) params.search = debouncedSearch;

      const response = await api.get('/cr-bucket', { params });
      if (response.data.success) {
        const responseData = response.data.data;
        setCrs(Array.isArray(responseData?.change_requests) ? responseData.change_requests : []);
        setTotalRecords(responseData?.pagination?.totalRecords || 0);
        setTotalPages(responseData?.pagination?.totalPages || 1);
      }
    } catch (err) {
      if (err.response?.status === 403) {
        setError('You do not have permission to access the CR bucket.');
      } else {
        setError('Failed to load bucket CRs. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePickUp = async (crId) => {
    if (!isEngineer) {
      toast.error('Only engineers can pick up CRs from the bucket');
      return;
    }
    setAssigningCrId(crId);
    try {
      const response = await api.post(`/cr-bucket/${crId}/self-assign`);
      if (response.data.success) {
        toast.success(response.data.message || 'CR picked up successfully!');
        setConfirmPickup(null);
        fetchBucketCRs();
        fetchBucketStats(true);
      }
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to pick up CR';
      if (err.response?.status === 409) {
        toast.warning(message);
        fetchBucketCRs();
        fetchBucketStats(true);
      } else {
        toast.error(message);
      }
    } finally {
      setAssigningCrId(null);
    }
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(field);
      setSortOrder('DESC');
    }
    setCurrentPage(1);
  };

  const handleLocationChange = (value) => {
    setSelectedLocation(value);
    setCurrentPage(1);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try { return formatDateUtil ? formatDateUtil(dateStr) : new Date(dateStr).toLocaleDateString(); }
    catch { return '—'; }
  };

  const getProfilePictureUrl = (profilePicture) => {
    if (!profilePicture) return null;
    if (profilePicture.startsWith('http://') || profilePicture.startsWith('https://')) return profilePicture;
    const urlWithoutApi = API_BASE_URL.replace('/api/v1', '');
    const cleanPath = profilePicture.startsWith('/') ? profilePicture : `/${profilePicture}`;
    return `${urlWithoutApi}${cleanPath}`;
  };

  const getPriorityBadgeClass = (code) => {
    const map = {
      'CRITICAL': 'crb-priority-critical',
      'HIGH': 'crb-priority-high',
      'MEDIUM': 'crb-priority-medium',
      'LOW': 'crb-priority-low',
      'PLANNING': 'crb-priority-planning',
    };
    return map[code] || 'crb-priority-medium';
  };

  const getRiskBadgeClass = (level) => {
    const map = {
      'CRITICAL': 'crb-risk-critical',
      'HIGH': 'crb-risk-high',
      'MEDIUM': 'crb-risk-medium',
      'LOW': 'crb-risk-low',
    };
    return map[level] || 'crb-risk-medium';
  };

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

  return (
    <div className="crb-page">
      {/* Page Header */}
      <div className="crb-header">
        <div className="crb-header-left">
          <div className="crb-title-wrapper">
            <div className="crb-icon-wrapper">
              <Inbox size={24} />
            </div>
            <div>
              <h1 className="crb-title">Open CR Bucket</h1>
              <p className="crb-subtitle">
                Browse and pick up unassigned change requests
                {isAdminOrManager && ' (View Only — Admin/Manager)'}
              </p>
            </div>
          </div>
        </div>

        <div className="crb-header-right">
          <button
            className="crb-btn-icon"
            onClick={() => {
              fetchBucketCRs();
              fetchBucketStats(true);
              toast.info('Refreshing bucket...');
            }}
            disabled={loading}
            title="Refresh"
          >
            <RefreshCw size={18} className={loading ? 'crb-spinning' : ''} />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="crb-stats-row">
        <div
          className={`crb-stat-card crb-stat-total ${selectedLocation === 'all' ? 'active' : ''}`}
          onClick={() => handleLocationChange('all')}
        >
          <div className="crb-stat-icon"><Inbox size={20} /></div>
          <div className="crb-stat-info">
            <span className="crb-stat-count">
              {statsLoading ? '...' : (bucketStats?.total_unassigned || 0)}
            </span>
            <span className="crb-stat-label">All Unassigned</span>
          </div>
          {selectedLocation === 'all' && <div className="crb-stat-check"><CheckCircle size={14} /></div>}
        </div>

        {userLocationId && (
          <div
            className={`crb-stat-card crb-stat-my-loc ${selectedLocation === 'my-location' ? 'active' : ''}`}
            onClick={() => handleLocationChange('my-location')}
          >
            <div className="crb-stat-icon"><MapPin size={20} /></div>
            <div className="crb-stat-info">
              <span className="crb-stat-count">
                {statsLoading ? '...' : (
                  bucketStats?.locations?.find(l => l.location_id === userLocationId)?.cr_count || 0
                )}
              </span>
              <span className="crb-stat-label">
                {locations.find(l => l.location_id === userLocationId)?.location_name || 'My Location'}
              </span>
            </div>
            {selectedLocation === 'my-location' && <div className="crb-stat-check"><CheckCircle size={14} /></div>}
          </div>
        )}

        {bucketStats?.locations?.filter(l => l.location_id !== userLocationId).map(loc => (
          <div
            key={loc.location_id}
            className={`crb-stat-card ${String(selectedLocation) === String(loc.location_id) ? 'active' : ''}`}
            onClick={() => handleLocationChange(String(loc.location_id))}
          >
            <div className="crb-stat-icon"><Building2 size={20} /></div>
            <div className="crb-stat-info">
              <span className="crb-stat-count">{loc.cr_count || 0}</span>
              <span className="crb-stat-label">{loc.location_name}</span>
            </div>
            {String(selectedLocation) === String(loc.location_id) && (
              <div className="crb-stat-check"><CheckCircle size={14} /></div>
            )}
          </div>
        ))}
      </div>

      {/* Info Banner */}
      {isEngineer && (
        <div className="crb-info-banner">
          <Info size={16} />
          <span>
            You can pick up change requests from this bucket to assign them to yourself.
            Only unassigned CRs with active status are shown here.
          </span>
        </div>
      )}

      {isAdminOrManager && (
        <div className="crb-info-banner crb-info-warning">
          <AlertTriangle size={16} />
          <span>
            You are viewing the bucket as {roleCode}. Only engineers can pick up CRs.
            Use the regular CR assignment to assign change requests.
          </span>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="crb-filter-bar">
        <div className="crb-search-wrapper">
          <Search size={18} className="crb-search-icon" />
          <input
            type="text"
            placeholder="Search by CR #, title, or description..."
            className="crb-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="crb-search-clear" onClick={() => setSearchQuery('')}>
              <X size={16} />
            </button>
          )}
        </div>

        <div className="crb-filter-location">
          <MapPin size={16} />
          <select
            value={selectedLocation}
            onChange={(e) => handleLocationChange(e.target.value)}
            className="crb-location-select"
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

        <div className="crb-result-count">
          <span>{totalRecords} CR{totalRecords !== 1 ? 's' : ''} found</span>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="crb-error">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={fetchBucketCRs}>Retry</button>
        </div>
      )}

      {/* Loading State */}
      {loading && !error && (
        <div className="crb-loading">
          <Loader size={32} className="crb-spinning" />
          <span>Loading bucket CRs...</span>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && crs.length === 0 && (
        <div className="crb-empty">
          <Inbox size={48} />
          <h3>No Unassigned Change Requests</h3>
          <p>
            {selectedLocation === 'all'
              ? 'There are no unassigned CRs in the system right now.'
              : `No unassigned CRs found for ${getSelectedLocationName()}.`}
          </p>
          <button onClick={() => handleLocationChange('all')} className="crb-btn-secondary">
            View All Locations
          </button>
        </div>
      )}

      {/* CRs Table */}
      {!loading && !error && crs.length > 0 && (
        <div className="crb-table-container">
          <table className="crb-table">
            <thead>
              <tr>
                <th className="crb-col-cr" onClick={() => handleSort('cr_number')}>
                  <span>CR #</span>
                  {sortBy === 'cr_number' && (
                    <ArrowUpDown size={14} className={sortOrder === 'ASC' ? 'crb-sort-asc' : 'crb-sort-desc'} />
                  )}
                </th>
                <th className="crb-col-title" onClick={() => handleSort('title')}>
                  <span>Title</span>
                  {sortBy === 'title' && (
                    <ArrowUpDown size={14} className={sortOrder === 'ASC' ? 'crb-sort-asc' : 'crb-sort-desc'} />
                  )}
                </th>
                <th className="crb-col-risk">Risk</th>
                <th className="crb-col-priority" onClick={() => handleSort('priority_id')}>
                  <span>Priority</span>
                  {sortBy === 'priority_id' && (
                    <ArrowUpDown size={14} className={sortOrder === 'ASC' ? 'crb-sort-asc' : 'crb-sort-desc'} />
                  )}
                </th>
                <th className="crb-col-type">Type</th>
                <th className="crb-col-location">Location</th>
                <th className="crb-col-requester">Requester</th>
                <th className="crb-col-date" onClick={() => handleSort('created_at')}>
                  <span>Created</span>
                  {sortBy === 'created_at' && (
                    <ArrowUpDown size={14} className={sortOrder === 'ASC' ? 'crb-sort-asc' : 'crb-sort-desc'} />
                  )}
                </th>
                <th className="crb-col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {crs.map(cr => (
                <tr key={cr.cr_id} className="crb-row">
                  <td className="crb-col-cr">
                    <span className="crb-cr-number">{cr.cr_number}</span>
                  </td>
                  <td className="crb-col-title">
                    <div className="crb-title-cell">
                      <span className="crb-title-text" title={cr.title}>{cr.title}</span>
                      {cr.category_name && (
                        <span className="crb-category-tag">
                          <Tag size={11} />
                          {cr.category_name}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="crb-col-risk">
                    <span className={`crb-risk-badge ${getRiskBadgeClass(cr.risk_level)}`}>
                      {cr.risk_level || 'MEDIUM'}
                    </span>
                  </td>
                  <td className="crb-col-priority">
                    <span
                      className={`crb-priority-badge ${getPriorityBadgeClass(cr.priority_code)}`}
                      style={cr.priority_color ? { '--priority-color': cr.priority_color } : {}}
                    >
                      {cr.priority_name || 'Normal'}
                    </span>
                  </td>
                  <td className="crb-col-type">
                    <span className="crb-type-text">{cr.cr_type_name || '—'}</span>
                  </td>
                  <td className="crb-col-location">
                    <span className="crb-location-text">{cr.cr_location_name || '—'}</span>
                  </td>
                  <td className="crb-col-requester">
                    <div className="crb-requester-cell">
                      {cr.requester_profile_picture ? (
                        <img
                          src={getProfilePictureUrl(cr.requester_profile_picture)}
                          alt=""
                          className="crb-requester-avatar"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        <div className="crb-requester-avatar-placeholder">
                          {(cr.requester_name || 'U')[0]}
                        </div>
                      )}
                      <span className="crb-requester-name">{cr.requester_name || 'Unknown'}</span>
                    </div>
                  </td>
                  <td className="crb-col-date">
                    <div className="crb-date-cell">
                      <span className="crb-date-text">{formatDate(cr.created_at)}</span>
                      <span className="crb-date-ago">{timeAgo ? timeAgo(cr.created_at) : ''}</span>
                    </div>
                  </td>
                  <td className="crb-col-actions">
                    <div className="crb-actions">
                      <button
                        className="crb-btn-view"
                        onClick={() => navigate(`/cr/${cr.cr_id}`)}
                        title="View Details"
                      >
                        <Eye size={16} />
                      </button>

                      {isEngineer && (
                        <>
                          {confirmPickup === cr.cr_id ? (
                            <div className="crb-confirm-pickup">
                              <button
                                className="crb-btn-confirm-yes"
                                onClick={() => handlePickUp(cr.cr_id)}
                                disabled={assigningCrId === cr.cr_id}
                                title="Confirm Pick Up"
                              >
                                {assigningCrId === cr.cr_id ? (
                                  <Loader size={14} className="crb-spinning" />
                                ) : (
                                  <CheckCircle size={14} />
                                )}
                              </button>
                              <button
                                className="crb-btn-confirm-no"
                                onClick={() => setConfirmPickup(null)}
                                title="Cancel"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <button
                              className="crb-btn-pickup"
                              onClick={() => setConfirmPickup(cr.cr_id)}
                              disabled={assigningCrId !== null}
                              title="Pick Up This CR"
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
        <div className="crb-pagination">
          <div className="crb-pagination-info">
            Showing {((currentPage - 1) * limit) + 1} to {Math.min(currentPage * limit, totalRecords)} of {totalRecords} CRs
          </div>
          <div className="crb-pagination-controls">
            <button
              className="crb-page-btn"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft size={18} />
            </button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum;
              if (totalPages <= 5) pageNum = i + 1;
              else if (currentPage <= 3) pageNum = i + 1;
              else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
              else pageNum = currentPage - 2 + i;
              return (
                <button
                  key={pageNum}
                  className={`crb-page-btn ${currentPage === pageNum ? 'active' : ''}`}
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              className="crb-page-btn"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CRBucket;

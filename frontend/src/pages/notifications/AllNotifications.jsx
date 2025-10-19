// ============================================
// ALL NOTIFICATIONS PAGE
// View all notifications with filtering and pagination
// ============================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/notifications/NotificationContext';
import {
  Bell,
  CheckCheck,
  Trash2,
  Eye,
  Filter,
  RefreshCw,
  Search,
  Calendar,
  Ticket,
  AlertCircle,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import '../../styles/AllNotifications.css';

// ============================================
// ALL NOTIFICATIONS COMPONENT
// ============================================
const AllNotifications = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // ============================================
  // NOTIFICATION CONTEXT
  // ============================================
  const {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearReadNotifications,
  } = useNotification();

  // ============================================
  // LOCAL STATE
  // ============================================
  const [filter, setFilter] = useState('all'); // all, unread, read
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [selectedNotifications, setSelectedNotifications] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const ITEMS_PER_PAGE = 20;

  // ============================================
  // FETCH NOTIFICATIONS ON MOUNT AND FILTER CHANGE
  // ============================================
  useEffect(() => {
    loadNotifications();
  }, [currentPage, filter]);

  // ============================================
  // LOAD NOTIFICATIONS
  // ============================================
  const loadNotifications = async () => {
    const unreadOnly = filter === 'unread';
    const result = await fetchNotifications(currentPage, ITEMS_PER_PAGE, unreadOnly);
    
    if (result && result.pagination) {
      setTotalPages(result.pagination.total_pages);
      setTotalRecords(result.pagination.total_records);
    }
  };

  // ============================================
  // REFRESH NOTIFICATIONS
  // ============================================
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadNotifications();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // ============================================
  // FILTER NOTIFICATIONS LOCALLY
  // Filter by search query after loading
  // ============================================
  const filteredNotifications = notifications.filter((notif) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesTitle = notif.title?.toLowerCase().includes(query);
      const matchesMessage = notif.message?.toLowerCase().includes(query);
      const matchesTicket = notif.ticket_number?.toLowerCase().includes(query);
      
      if (!matchesTitle && !matchesMessage && !matchesTicket) {
        return false;
      }
    }

    // Read/Unread filter
    if (filter === 'read' && !notif.is_read) return false;
    // Note: 'unread' filter is handled by API call

    return true;
  });

  // ============================================
  // HANDLE NOTIFICATION CLICK
  // ============================================
  const handleNotificationClick = async (notification) => {
    // Mark as read if unread
    if (!notification.is_read) {
      await markAsRead(notification.notification_id);
    }

    // Navigate to related ticket if exists
    if (notification.related_ticket_id) {
      navigate(`/tickets/${notification.related_ticket_id}`);
    }
  };

  // ============================================
  // HANDLE DELETE NOTIFICATION
  // ============================================
  const handleDelete = async (e, notificationId) => {
    e.stopPropagation();
    
    if (window.confirm('Are you sure you want to delete this notification?')) {
      await deleteNotification(notificationId);
      
      // Reload if no notifications left on current page
      if (filteredNotifications.length === 1 && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      } else {
        await loadNotifications();
      }
    }
  };

  // ============================================
  // HANDLE MARK AS READ
  // ============================================
  const handleMarkAsRead = async (e, notificationId) => {
    e.stopPropagation();
    await markAsRead(notificationId);
  };

  // ============================================
  // HANDLE MARK ALL AS READ
  // ============================================
  const handleMarkAllAsRead = async () => {
    if (window.confirm('Mark all notifications as read?')) {
      await markAllAsRead();
      await loadNotifications();
    }
  };

  // ============================================
  // HANDLE CLEAR READ NOTIFICATIONS
  // ============================================
  const handleClearRead = async () => {
    if (window.confirm('Delete all read notifications? This cannot be undone.')) {
      await clearReadNotifications();
      setCurrentPage(1);
      await loadNotifications();
    }
  };

  // ============================================
  // HANDLE SELECT NOTIFICATION
  // ============================================
  const handleSelectNotification = (notificationId) => {
    setSelectedNotifications((prev) => {
      if (prev.includes(notificationId)) {
        return prev.filter((id) => id !== notificationId);
      }
      return [...prev, notificationId];
    });
  };

  // ============================================
  // HANDLE SELECT ALL
  // ============================================
  const handleSelectAll = () => {
    if (selectedNotifications.length === filteredNotifications.length) {
      setSelectedNotifications([]);
    } else {
      setSelectedNotifications(filteredNotifications.map((n) => n.notification_id));
    }
  };

  // ============================================
  // BULK DELETE SELECTED
  // ============================================
  const handleBulkDelete = async () => {
    if (selectedNotifications.length === 0) return;
    
    if (window.confirm(`Delete ${selectedNotifications.length} selected notifications?`)) {
      for (const id of selectedNotifications) {
        await deleteNotification(id);
      }
      setSelectedNotifications([]);
      await loadNotifications();
    }
  };

  // ============================================
  // FORMAT TIME AGO
  // ============================================
  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  // ============================================
  // GET NOTIFICATION ICON
  // ============================================
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'TICKET_CREATED':
        return { icon: '🎫', color: '#3b82f6' };
      case 'TICKET_ASSIGNED':
        return { icon: '👤', color: '#8b5cf6' };
      case 'TICKET_UPDATED':
        return { icon: '🔄', color: '#f59e0b' };
      case 'TICKET_COMMENTED':
        return { icon: '💬', color: '#10b981' };
      case 'TICKET_RESOLVED':
        return { icon: '✅', color: '#22c55e' };
      case 'TICKET_CLOSED':
        return { icon: '🔒', color: '#6b7280' };
      case 'PASSWORD_CHANGED':
        return { icon: '🔐', color: '#ef4444' };
      default:
        return { icon: '📢', color: '#667eea' };
    }
  };

  // ============================================
  // RENDER COMPONENT
  // ============================================
  return (
    <div className="all-notifications-page">
      {/* Page Header */}
      <div className="page-header">
        <div className="header-left">
          <Bell size={28} className="page-icon" />
          <div>
            <h1 className="page-title">All Notifications</h1>
            <p className="page-subtitle">
              {totalRecords} total notifications
              {unreadCount > 0 && ` • ${unreadCount} unread`}
            </p>
          </div>
        </div>

        <div className="header-actions">
          <button
            className="btn-secondary"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw size={16} className={isRefreshing ? 'spinning' : ''} />
            Refresh
          </button>
          
          {unreadCount > 0 && (
            <button
              className="btn-primary"
              onClick={handleMarkAllAsRead}
            >
              <CheckCheck size={16} />
              Mark All Read
            </button>
          )}
        </div>
      </div>

      {/* Filters and Search */}
      <div className="notifications-toolbar">
        <div className="toolbar-left">
          {/* Search */}
          <div className="search-box">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>

          {/* Filter Tabs */}
          <div className="filter-tabs">
            <button
              className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
              onClick={() => {
                setFilter('all');
                setCurrentPage(1);
              }}
            >
              All ({totalRecords})
            </button>
            <button
              className={`filter-tab ${filter === 'unread' ? 'active' : ''}`}
              onClick={() => {
                setFilter('unread');
                setCurrentPage(1);
              }}
            >
              Unread ({unreadCount})
            </button>
            <button
              className={`filter-tab ${filter === 'read' ? 'active' : ''}`}
              onClick={() => {
                setFilter('read');
                setCurrentPage(1);
              }}
            >
              Read ({totalRecords - unreadCount})
            </button>
          </div>
        </div>

        <div className="toolbar-right">
          {/* Only show delete buttons for Administrator */}
          {user?.role_code === 'Administrator' && (
            <>
              {selectedNotifications.length > 0 && (
                <button
                  className="btn-danger-outline"
                  onClick={handleBulkDelete}
                >
                  <Trash2 size={16} />
                  Delete Selected ({selectedNotifications.length})
                </button>
              )}
              
              <button
                className="btn-secondary-outline"
                onClick={handleClearRead}
              >
                <Trash2 size={16} />
                Clear Read
              </button>
            </>
          )}
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {filteredNotifications.length > 0 && (
        <div className="bulk-actions">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={selectedNotifications.length === filteredNotifications.length}
              onChange={handleSelectAll}
            />
            <span>Select All ({filteredNotifications.length})</span>
          </label>
        </div>
      )}

      {/* Notifications List */}
      <div className="notifications-container">
        {loading && filteredNotifications.length === 0 ? (
          // Loading State
          <div className="loading-state">
            <RefreshCw size={48} className="spinning" />
            <p>Loading notifications...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          // Empty State
          <div className="empty-state">
            <Bell size={64} className="empty-icon" />
            <h3>No notifications found</h3>
            <p>
              {searchQuery
                ? 'Try adjusting your search query'
                : "You're all caught up! No notifications to show."}
            </p>
          </div>
        ) : (
          // Notifications List
          <div className="notifications-list">
            {filteredNotifications.map((notification) => {
              const iconData = getNotificationIcon(notification.notification_type);
              return (
                <div
                  key={notification.notification_id}
                  className={`notification-card ${!notification.is_read ? 'unread' : ''}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  {/* Checkbox */}
                  <div className="notification-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedNotifications.includes(notification.notification_id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleSelectNotification(notification.notification_id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>

                  {/* Icon */}
                  <div
                    className="notification-icon-large"
                    style={{ background: iconData.color }}
                  >
                    {iconData.icon}
                  </div>

                  {/* Content */}
                  <div className="notification-content-full">
                    <div className="notification-header-row">
                      <h4 className="notification-title">{notification.title}</h4>
                      <span className="notification-time">
                        <Calendar size={12} />
                        {formatTimeAgo(notification.created_at)}
                      </span>
                    </div>

                    <p className="notification-message">{notification.message}</p>

                    {notification.ticket_number && (
                      <div className="notification-ticket-badge">
                        <Ticket size={12} />
                        {notification.ticket_number}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="notification-actions-column">
                    {!notification.is_read && (
                      <button
                        className="btn-icon-action"
                        onClick={(e) => handleMarkAsRead(e, notification.notification_id)}
                        title="Mark as read"
                      >
                        <Eye size={16} />
                      </button>
                    )}
                    {/* Only Administrator can delete */}
                    {user?.role_code === 'Administrator' && (
                      <button
                        className="btn-icon-action btn-danger-action"
                        onClick={(e) => handleDelete(e, notification.notification_id)}
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  {/* Unread Indicator */}
                  {!notification.is_read && (
                    <div className="unread-indicator"></div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="btn-pagination"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
          >
            Previous
          </button>

          <div className="pagination-info">
            Page {currentPage} of {totalPages}
          </div>

          <button
            className="btn-pagination"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

// ============================================
// EXPORT COMPONENT
// ============================================
export default AllNotifications;
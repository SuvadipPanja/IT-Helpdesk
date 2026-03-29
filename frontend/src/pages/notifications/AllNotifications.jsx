/**
 * ============================================
 * ALL NOTIFICATIONS PAGE - INDUSTRIAL-GRADE REDESIGN
 * ============================================
 * Production-Ready Notifications Center
 * 
 * FEATURES:
 * - Industrial-grade gradient header with badge
 * - Animated stat cards with filter
 * - Enhanced notification items with type badges
 * - Bulk operations & search
 * - Dark mode, responsive, accessible
 * - Memoized components for performance
 * 
 * Developer: Suvadip Panja
 * Company: Digitide
 * Version: 3.0.0
 * FILE: frontend/src/pages/notifications/AllNotifications.jsx
 * ============================================
 */

import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/notifications/NotificationContext';
import { useToast } from '../../context/ToastContext';
import {
  Bell,
  BellOff,
  CheckCheck,
  Trash2,
  Eye,
  RefreshCw,
  Search,
  Ticket,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  MessageSquare,
  UserPlus,
  AlertTriangle,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Inbox,
  MailOpen,
  Mail,
  X
} from 'lucide-react';
import RefreshButton from '../../components/shared/RefreshButton';
import '../../styles/AllNotifications.css';
import { timeAgo } from '../../utils/dateUtils';

// ============================================
// NOTIFICATION TYPE CONFIGURATION
// ============================================
const NOTIFICATION_TYPES = {
  TICKET_CREATED: {
    icon: Ticket,
    color: '#3b82f6',
    bgColor: 'rgba(59, 130, 246, 0.1)',
    label: 'New Ticket'
  },
  TICKET_ASSIGNED: {
    icon: UserPlus,
    color: '#8b5cf6',
    bgColor: 'rgba(139, 92, 246, 0.1)',
    label: 'Assigned'
  },
  TICKET_UPDATED: {
    icon: RefreshCw,
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.1)',
    label: 'Updated'
  },
  TICKET_COMMENTED: {
    icon: MessageSquare,
    color: '#10b981',
    bgColor: 'rgba(16, 185, 129, 0.1)',
    label: 'Comment'
  },
  TICKET_RESOLVED: {
    icon: CheckCircle,
    color: '#22c55e',
    bgColor: 'rgba(34, 197, 94, 0.1)',
    label: 'Resolved'
  },
  TICKET_CLOSED: {
    icon: XCircle,
    color: '#64748b',
    bgColor: 'rgba(100, 116, 139, 0.1)',
    label: 'Closed'
  },
  TICKET_ESCALATED: {
    icon: ArrowUp,
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.1)',
    label: 'Escalated'
  },
  SLA_WARNING: {
    icon: AlertTriangle,
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.1)',
    label: 'SLA Warning'
  },
  SLA_BREACH: {
    icon: AlertCircle,
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.1)',
    label: 'SLA Breach'
  },
  DEFAULT: {
    icon: Bell,
    color: '#6366f1',
    bgColor: 'rgba(99, 102, 241, 0.1)',
    label: 'Notification'
  }
};

// ============================================
// STATS CARD (Memoized)
// ============================================
const StatsCard = memo(({ icon: Icon, label, value, color, bgColor, onClick, isActive }) => (
  <button
    type="button"
    className={`np-stat-card ${isActive ? 'active' : ''}`}
    onClick={onClick}
    style={{ '--_card-color': color, '--_card-bg': bgColor, '--_card-glow': `${color}20` }}
  >
    <div className="np-stat-icon">
      <Icon size={20} />
    </div>
    <div className="np-stat-info">
      <span className="np-stat-value">{value}</span>
      <span className="np-stat-label">{label}</span>
    </div>
  </button>
));

StatsCard.displayName = 'StatsCard';

// ============================================
// NOTIFICATION ITEM (Memoized)
// ============================================
const NotificationItem = memo(({
  notification,
  isSelected,
  onSelect,
  onClick,
  onMarkRead,
  onDelete,
  canDelete,
  formatTime
}) => {
  const typeConfig = NOTIFICATION_TYPES[notification.notification_type] || NOTIFICATION_TYPES.DEFAULT;
  const Icon = typeConfig.icon;

  return (
    <div
      className={`np-item ${!notification.is_read ? 'unread' : ''} ${isSelected ? 'selected' : ''}`}
      onClick={() => onClick(notification)}
      role="button"
      tabIndex={0}
      aria-label={`${notification.title} - ${notification.is_read ? 'Read' : 'Unread'}`}
      onKeyDown={(e) => e.key === 'Enter' && onClick(notification)}
    >
      {/* Checkbox */}
      <div className="np-item-check">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation();
            onSelect(notification.notification_id);
          }}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select notification: ${notification.title}`}
        />
      </div>

      {/* Icon */}
      <div
        className="np-item-icon"
        style={{
          backgroundColor: typeConfig.bgColor,
          color: typeConfig.color
        }}
      >
        <Icon size={20} />
      </div>

      {/* Content */}
      <div className="np-item-body">
        <div className="np-item-top">
          <h4 className="np-item-title">{notification.title}</h4>
          <div className="np-item-meta">
            <span
              className="np-type-badge"
              style={{
                backgroundColor: typeConfig.bgColor,
                color: typeConfig.color
              }}
            >
              {typeConfig.label}
            </span>
            <span className="np-item-time">
              <Clock size={12} />
              {formatTime(notification.created_at)}
            </span>
          </div>
        </div>

        <p className="np-item-msg">{notification.message}</p>

        {notification.ticket_number && (
          <div className="np-item-ticket">
            <Ticket size={14} />
            <span>{notification.ticket_number}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="np-item-actions">
        {!notification.is_read && (
          <button
            type="button"
            className="np-action-btn mark-read"
            onClick={(e) => {
              e.stopPropagation();
              onMarkRead(notification.notification_id);
            }}
            title="Mark as read"
            aria-label="Mark as read"
          >
            <Eye size={16} />
          </button>
        )}
        {canDelete && (
          <button
            type="button"
            className="np-action-btn delete"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(notification.notification_id);
            }}
            title="Delete notification"
            aria-label="Delete notification"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {/* Unread Indicator */}
      {!notification.is_read && (
        <div className="np-unread-dot" aria-hidden="true" />
      )}
    </div>
  );
});

NotificationItem.displayName = 'NotificationItem';

// ============================================
// EMPTY STATE (Memoized)
// ============================================
const EmptyState = memo(({ filter, searchQuery }) => (
  <div className="np-empty">
    <div className="np-empty-icon">
      {filter === 'unread' ? <MailOpen size={40} /> : <Inbox size={40} />}
    </div>
    <h3>
      {searchQuery
        ? 'No matching notifications'
        : filter === 'unread'
          ? 'All caught up!'
          : 'No notifications yet'
      }
    </h3>
    <p>
      {searchQuery
        ? 'Try adjusting your search terms'
        : filter === 'unread'
          ? 'You have no unread notifications'
          : 'Notifications will appear here when you receive them'
      }
    </p>
  </div>
));

EmptyState.displayName = 'EmptyState';

// ============================================
// LOADING STATE (Memoized)
// ============================================
const LoadingState = memo(() => (
  <div className="np-loading">
    <div className="np-loading-ring" />
    <p>Loading notifications...</p>
  </div>
));

LoadingState.displayName = 'LoadingState';

// ============================================
// MAIN COMPONENT
// ============================================
const AllNotifications = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

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
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [selectedNotifications, setSelectedNotifications] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const ITEMS_PER_PAGE = 20;

  // ============================================
  // PERMISSION CHECK
  // ============================================
  const canDelete = useMemo(() =>
    user?.role_name === 'Admin' ||
    user?.permissions?.can_manage_system,
    [user]
  );

  // ============================================
  // LOAD NOTIFICATIONS
  // ============================================
  const loadNotifications = useCallback(async () => {
    try {
      const unreadOnly = filter === 'unread';
      const result = await fetchNotifications(currentPage, ITEMS_PER_PAGE, unreadOnly);

      if (result && result.pagination) {
        setTotalPages(result.pagination.total_pages || 1);
        setTotalRecords(result.pagination.total_records || 0);
      }
    } catch (error) {
      showToast('Failed to load notifications', 'error');
    }
  }, [currentPage, filter, fetchNotifications, showToast]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // ============================================
  // ACTION HANDLERS
  // ============================================
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadNotifications();
    showToast('Notifications refreshed', 'success');
    setTimeout(() => setIsRefreshing(false), 500);
  }, [loadNotifications, showToast]);

  const handleFilterChange = useCallback((newFilter) => {
    setFilter(newFilter);
    setCurrentPage(1);
    setSelectedNotifications([]);
    showToast(`Showing ${newFilter} notifications`, 'info');
  }, [showToast]);

  // ============================================
  // FILTERED NOTIFICATIONS (Memoized)
  // ============================================
  const filteredNotifications = useMemo(() => {
    return notifications.filter((notif) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = notif.title?.toLowerCase().includes(query);
        const matchesMessage = notif.message?.toLowerCase().includes(query);
        const matchesTicket = notif.ticket_number?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesMessage && !matchesTicket) return false;
      }
      if (filter === 'read' && !notif.is_read) return false;
      return true;
    });
  }, [notifications, searchQuery, filter]);

  // ============================================
  // NOTIFICATION ACTIONS
  // ============================================
  const handleNotificationClick = useCallback(async (notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.notification_id);
    }
    if (notification.related_ticket_id) {
      showToast('Opening ticket...', 'info');
      navigate(`/tickets/${notification.related_ticket_id}`);
    }
  }, [markAsRead, navigate, showToast]);

  const handleMarkAsRead = useCallback(async (notificationId) => {
    try {
      await markAsRead(notificationId);
      showToast('Marked as read', 'success');
    } catch (error) {
      showToast('Failed to mark as read', 'error');
    }
  }, [markAsRead, showToast]);

  const handleDelete = useCallback(async (notificationId) => {
    try {
      await deleteNotification(notificationId);
      showToast('Notification deleted', 'success');
      if (filteredNotifications.length === 1 && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      } else {
        await loadNotifications();
      }
    } catch (error) {
      showToast('Failed to delete notification', 'error');
    }
  }, [deleteNotification, filteredNotifications.length, currentPage, loadNotifications, showToast]);

  const handleMarkAllAsRead = useCallback(async () => {
    try {
      await markAllAsRead();
      showToast(`${unreadCount} notifications marked as read`, 'success');
      await loadNotifications();
    } catch (error) {
      showToast('Failed to mark all as read', 'error');
    }
  }, [markAllAsRead, unreadCount, loadNotifications, showToast]);

  const handleClearRead = useCallback(async () => {
    try {
      await clearReadNotifications();
      showToast('Read notifications cleared', 'success');
      setCurrentPage(1);
      await loadNotifications();
    } catch (error) {
      showToast('Failed to clear notifications', 'error');
    }
  }, [clearReadNotifications, loadNotifications, showToast]);

  // ============================================
  // SELECTION HANDLERS
  // ============================================
  const handleSelectNotification = useCallback((notificationId) => {
    setSelectedNotifications((prev) => {
      if (prev.includes(notificationId)) {
        return prev.filter((id) => id !== notificationId);
      }
      return [...prev, notificationId];
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedNotifications.length === filteredNotifications.length) {
      setSelectedNotifications([]);
    } else {
      setSelectedNotifications(filteredNotifications.map((n) => n.notification_id));
    }
  }, [selectedNotifications.length, filteredNotifications]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedNotifications.length === 0) return;
    try {
      for (const id of selectedNotifications) {
        await deleteNotification(id);
      }
      showToast(`${selectedNotifications.length} notifications deleted`, 'success');
      setSelectedNotifications([]);
      await loadNotifications();
    } catch (error) {
      showToast('Failed to delete notifications', 'error');
    }
  }, [selectedNotifications, deleteNotification, loadNotifications, showToast]);

  const handleBulkMarkRead = useCallback(async () => {
    if (selectedNotifications.length === 0) return;
    try {
      for (const id of selectedNotifications) {
        await markAsRead(id);
      }
      showToast(`${selectedNotifications.length} notifications marked as read`, 'success');
      setSelectedNotifications([]);
    } catch (error) {
      showToast('Failed to mark notifications as read', 'error');
    }
  }, [selectedNotifications, markAsRead, showToast]);

  // ============================================
  // FORMAT TIME AGO (using centralized dateUtils)
  // ============================================
  const formatTimeAgo = useCallback((dateString) => {
    return timeAgo(dateString);
  }, []);

  // ============================================
  // PAGINATION
  // ============================================
  const handlePrevPage = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
      setSelectedNotifications([]);
    }
  }, [currentPage]);

  const handleNextPage = useCallback(() => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
      setSelectedNotifications([]);
    }
  }, [currentPage, totalPages]);

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="notif-page">
      {/* ===== GRADIENT HEADER ===== */}
      <header className="np-header">
        <div className="np-header-inner">
          <div className="np-header-left">
            <div className="np-header-icon">
              <Bell size={26} />
              {unreadCount > 0 && (
                <span className="np-header-badge">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
            <div className="np-header-text">
              <h1>Notification Center</h1>
              <p className="np-header-subtitle">
                {unreadCount > 0
                  ? `You have ${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
                  : 'All notifications are read'}
              </p>
            </div>
          </div>

          <div className="np-header-right">
            <RefreshButton
              onClick={handleRefresh}
              loading={isRefreshing}
              label="Refresh"
            />

            {unreadCount > 0 && (
              <button
                type="button"
                className="np-header-btn accent"
                onClick={handleMarkAllAsRead}
                aria-label="Mark all as read"
              >
                <CheckCheck size={16} />
                <span>Mark All Read</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ===== CONTENT ===== */}
      <div className="np-content">
        {/* Stats Cards */}
        <div className="np-stats-row">
          <StatsCard
            icon={Inbox}
            label="All"
            value={totalRecords}
            color="#6366f1"
            bgColor="rgba(99, 102, 241, 0.1)"
            onClick={() => handleFilterChange('all')}
            isActive={filter === 'all'}
          />
          <StatsCard
            icon={Mail}
            label="Unread"
            value={unreadCount}
            color="#3b82f6"
            bgColor="rgba(59, 130, 246, 0.1)"
            onClick={() => handleFilterChange('unread')}
            isActive={filter === 'unread'}
          />
          <StatsCard
            icon={MailOpen}
            label="Read"
            value={totalRecords - unreadCount}
            color="#22c55e"
            bgColor="rgba(34, 197, 94, 0.1)"
            onClick={() => handleFilterChange('read')}
            isActive={filter === 'read'}
          />
        </div>

        {/* Toolbar */}
        <div className="np-toolbar">
          <div className="np-toolbar-left">
            {/* Search */}
            <div className="np-search">
              <Search size={16} className="np-search-icon" />
              <input
                type="text"
                placeholder="Search notifications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="np-search-input"
                aria-label="Search notifications"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="np-search-clear"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Bulk Actions */}
            {selectedNotifications.length > 0 && (
              <div className="np-bulk-bar">
                <span className="np-bulk-count">
                  {selectedNotifications.length} selected
                </span>
                <button
                  type="button"
                  className="np-bulk-btn read"
                  onClick={handleBulkMarkRead}
                  title="Mark selected as read"
                >
                  <Eye size={16} />
                </button>
                {canDelete && (
                  <button
                    type="button"
                    className="np-bulk-btn del"
                    onClick={handleBulkDelete}
                    title="Delete selected"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="np-toolbar-right">
            {canDelete && (
              <button
                type="button"
                className="np-btn-outline-danger"
                onClick={handleClearRead}
                disabled={totalRecords - unreadCount === 0}
              >
                <BellOff size={16} />
                <span>Clear Read</span>
              </button>
            )}
          </div>
        </div>

        {/* Select All */}
        {filteredNotifications.length > 0 && (
          <div className="np-select-all">
            <label>
              <input
                type="checkbox"
                checked={selectedNotifications.length === filteredNotifications.length && filteredNotifications.length > 0}
                onChange={handleSelectAll}
              />
              <span>
                Select all {filteredNotifications.length} notification{filteredNotifications.length !== 1 ? 's' : ''}
              </span>
            </label>
          </div>
        )}

        {/* Notifications List */}
        <div className="np-list-container">
          {loading && filteredNotifications.length === 0 ? (
            <LoadingState />
          ) : filteredNotifications.length === 0 ? (
            <EmptyState filter={filter} searchQuery={searchQuery} />
          ) : (
            filteredNotifications.map((notification) => (
              <NotificationItem
                key={notification.notification_id}
                notification={notification}
                isSelected={selectedNotifications.includes(notification.notification_id)}
                onSelect={handleSelectNotification}
                onClick={handleNotificationClick}
                onMarkRead={handleMarkAsRead}
                onDelete={handleDelete}
                canDelete={canDelete}
                formatTime={formatTimeAgo}
              />
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="np-pagination">
            <button
              type="button"
              className="np-page-btn"
              disabled={currentPage === 1}
              onClick={handlePrevPage}
              aria-label="Previous page"
            >
              <ChevronLeft size={16} />
              <span>Previous</span>
            </button>

            <div className="np-page-info">
              <span className="np-page-current">{currentPage}</span>
              <span className="np-page-sep">of</span>
              <span className="np-page-total">{totalPages}</span>
            </div>

            <button
              type="button"
              className="np-page-btn"
              disabled={currentPage === totalPages}
              onClick={handleNextPage}
              aria-label="Next page"
            >
              <span>Next</span>
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AllNotifications;

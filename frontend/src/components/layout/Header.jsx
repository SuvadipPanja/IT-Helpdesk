// ============================================
// HEADER COMPONENT
// Top navigation bar with notifications and user menu
// Now connected to real Notification API
// UPDATED: Removed search bar, added logo, reordered layout
// ============================================

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/notifications/NotificationContext';
import '../../styles/Header.css';
import {
  Menu,
  Bell,
  User,
  Settings,
  LogOut,
  ChevronDown,
  HelpCircle,
  Shield,
  Trash2,
  Eye,
  CheckCheck,
} from 'lucide-react';

// ============================================
// HEADER COMPONENT
// ============================================
const Header = ({ toggleSidebar }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  // Debug: Log user info when component mounts
  useEffect(() => {
    console.log('🔍 Header - Current user:', user);
    console.log('🔍 Header - User role:', user?.role_code);
    console.log('🔍 Header - User role name:', user?.role_name);
  }, [user]);
  
  // ============================================
  // NOTIFICATION CONTEXT
  // Access real notification data and functions
  // ============================================
  const {
    notifications,
    unreadCount,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotification();

  // ============================================
  // LOCAL STATE
  // ============================================
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const userMenuRef = useRef(null);
  const notificationsRef = useRef(null);

  // ============================================
  // CLOSE DROPDOWNS WHEN CLICKING OUTSIDE
  // ============================================
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ============================================
  // LOGOUT HANDLER
  // ============================================
  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // ============================================
  // TOGGLE USER MENU
  // ============================================
  const toggleUserMenu = () => {
    setShowUserMenu(!showUserMenu);
    setShowNotifications(false);
  };

  // ============================================
  // TOGGLE NOTIFICATIONS DROPDOWN
  // Fetches notifications when opened
  // FIXED: Always fetch when opening, not just when empty
  // ============================================
  const toggleNotifications = async () => {
    const newState = !showNotifications;
    setShowNotifications(newState);
    setShowUserMenu(false);

    // ALWAYS fetch fresh notifications when opening dropdown
    if (newState) {
      setLoadingNotifications(true);
      try {
        await fetchNotifications(1, 20); // Get first 20 notifications
        console.log('✅ Notifications fetched successfully');
      } catch (error) {
        console.error('❌ Error fetching notifications:', error);
      } finally {
        setLoadingNotifications(false);
      }
    }
  };

  // ============================================
  // HANDLE NOTIFICATION CLICK
  // Mark as read and navigate to related ticket
  // ============================================
  const handleNotificationClick = async (notification) => {
    // Mark as read if unread
    if (!notification.is_read) {
      await markAsRead(notification.notification_id);
    }

    // Navigate to related ticket if exists
    if (notification.related_ticket_id) {
      navigate(`/tickets/${notification.related_ticket_id}`);
      setShowNotifications(false);
    }
  };

  // ============================================
  // HANDLE DELETE NOTIFICATION
  // ============================================
  const handleDeleteNotification = async (e, notificationId) => {
    e.stopPropagation(); // Prevent notification click
    await deleteNotification(notificationId);
  };

  // ============================================
  // HANDLE MARK ALL AS READ
  // ============================================
  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
  };

  // ============================================
  // FORMAT TIME AGO
  // Helper function to display relative time
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
  // Returns appropriate icon based on notification type
  // ============================================
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'TICKET_CREATED':
        return '🎫';
      case 'TICKET_ASSIGNED':
        return '👤';
      case 'TICKET_UPDATED':
        return '🔄';
      case 'TICKET_COMMENTED':
        return '💬';
      case 'TICKET_RESOLVED':
        return '✅';
      case 'TICKET_CLOSED':
        return '🔒';
      case 'LOGIN':
        return '🔐';
      case 'PASSWORD_CHANGED':
        return '🔑';
      default:
        return '📢';
    }
  };

  // ============================================
  // RENDER COMPONENT
  // ============================================
  return (
    <header className="header">
      {/* Left Section - Hamburger Menu Only */}
      <div className="header-left">
        <button 
          className="btn-icon-header hamburger-btn"
          onClick={toggleSidebar}
          aria-label="Toggle Sidebar"
        >
          <Menu size={20} />
        </button>
      </div>
	  
      {/* Right Section - Notifications & User Menu */}
      <div className="header-right">
        
        {/* ============================================
            NOTIFICATIONS DROPDOWN
            Connected to real API via NotificationContext
            ============================================ */}
        <div className="header-dropdown" ref={notificationsRef}>
          <button 
            className="btn-icon-header"
            onClick={toggleNotifications}
            aria-label="Notifications"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="notification-badge">{unreadCount}</span>
            )}
          </button>

          {showNotifications && (
            <div className="dropdown-menu notifications-menu">
              {/* Dropdown Header */}
              <div className="dropdown-header">
                <h3>Notifications</h3>
                {notifications.length > 0 && unreadCount > 0 && (
                  <button 
                    className="btn-text-small"
                    onClick={handleMarkAllAsRead}
                    title="Mark all as read"
                  >
                    <CheckCheck size={14} />
                    Mark all read
                  </button>
                )}
              </div>

              {/* Dropdown Body */}
              <div className="dropdown-body">
                {loadingNotifications ? (
                  // Loading State
                  <div className="empty-notifications">
                    <Bell size={32} className="empty-icon" />
                    <p>Loading notifications...</p>
                  </div>
                ) : notifications.length === 0 ? (
                  // Empty State
                  <div className="empty-notifications">
                    <Bell size={32} className="empty-icon" />
                    <p>No notifications</p>
                    <small>You're all caught up!</small>
                  </div>
                ) : (
                  // Notifications List
                  notifications.map((notification) => (
                    <div 
                      key={notification.notification_id} 
                      className={`notification-item ${!notification.is_read ? 'unread' : ''}`}
                      onClick={() => handleNotificationClick(notification)}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Notification Icon */}
                      <div className="notification-icon">
                        {getNotificationIcon(notification.notification_type)}
                      </div>

                      {/* Notification Content */}
                      <div className="notification-content">
                        <h4>{notification.title}</h4>
                        <p>{notification.message}</p>
                        <div className="notification-meta">
                          <span className="notification-time">
                            {formatTimeAgo(notification.created_at)}
                          </span>
                          {notification.ticket_number && (
                            <span className="notification-ticket">
                              #{notification.ticket_number}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="notification-actions">
                        {!notification.is_read && (
                          <button
                            className="btn-icon-tiny"
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(notification.notification_id);
                            }}
                            title="Mark as read"
                          >
                            <Eye size={14} />
                          </button>
                        )}
                        {/* Only Administrator can delete - WITH DEBUG */}
                        {(() => {
                          const isAdministrator = user?.role_code === 'Administrator';
                          console.log(`🗑️ Delete button check - User: ${user?.username}, Role: ${user?.role_code}, Is Administrator: ${isAdministrator}`);
                          return isAdministrator;
                        })() && (
                          <button
                            className="btn-icon-tiny btn-danger-tiny"
                            onClick={(e) => handleDeleteNotification(e, notification.notification_id)}
                            title="Delete notification"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
					  
                      {/* Unread Indicator Dot */}
                      {!notification.is_read && <div className="notification-dot"></div>}
                    </div>
                  ))
                )}
              </div>

              {/* Dropdown Footer */}
              {notifications.length > 0 && (
                <div className="dropdown-footer">
                  <button 
                    className="btn-text-dropdown"
                    onClick={() => {
                      navigate('/notifications');
                      setShowNotifications(false);
                    }}
                  >
                    View all notifications
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ============================================
            USER MENU DROPDOWN
            ============================================ */}
        <div className="header-dropdown" ref={userMenuRef}>
          <button 
            className="user-menu-trigger"
            onClick={toggleUserMenu}
          >
            <div className="user-avatar-header">
              {user?.first_name?.charAt(0) || user?.username?.charAt(0) || 'U'}
            </div>
            <div className="user-info-header">
              <span className="user-name">{user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : user?.username}</span>
              <span className="user-role">{user?.role_name}</span>
            </div>
            <ChevronDown size={16} className={`chevron-icon ${showUserMenu ? 'rotated' : ''}`} />
          </button>

          {showUserMenu && (
            <div className="dropdown-menu user-dropdown-menu">
              {/* User Info Header */}
              <div className="dropdown-header-user">
                <div className="user-avatar-large">
                  {user?.first_name?.charAt(0) || user?.username?.charAt(0) || 'U'}
                </div>
                <div className="user-info-dropdown">
                  <h4>{user?.first_name && user?.last_name ? `${user.first_name} ${user.last_name}` : user?.username}</h4>
                  <p>{user?.email}</p>
                  <span className={`role-badge-small role-${user?.role_code?.toLowerCase()}`}>
                    {user?.role_name}
                  </span>
                </div>
              </div>

              {/* Menu Items */}
              <div className="dropdown-body-menu">
                <button 
                  className="dropdown-item"
                  onClick={() => {
                    navigate('/profile');
                    setShowUserMenu(false);
                  }}
                >
                  <User size={18} />
                  <span>My Profile</span>
                </button>

                <button 
                  className="dropdown-item"
                  onClick={() => {
                    navigate('/settings');
                    setShowUserMenu(false);
                  }}
                >
                  <Settings size={18} />
                  <span>Settings</span>
                </button>

                <button 
                  className="dropdown-item"
                  onClick={() => {
                    navigate('/help');
                    setShowUserMenu(false);
                  }}
                >
                  <HelpCircle size={18} />
                  <span>Help Center</span>
                </button>

                {user?.role_code === 'Administrator' && (
                  <button 
                    className="dropdown-item"
                    onClick={() => {
                      navigate('/roles');
                      setShowUserMenu(false);
                    }}
                  >
                    <Shield size={18} />
                    <span>Role Management</span>
                  </button>
                )}

                <div className="dropdown-divider"></div>

                <button 
                  className="dropdown-item logout-item"
                  onClick={handleLogout}
                >
                  <LogOut size={18} />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

// ============================================
// EXPORT COMPONENT
// ============================================
export default Header;
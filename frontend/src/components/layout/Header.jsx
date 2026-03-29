// ============================================
// HEADER COMPONENT - FIXED WITH NOTIFICATION SETTINGS
// Fetches profile picture on mount
// Developer: Suvadip Panja
// Updated: November 11, 2025 - Added notification disabled support
// ============================================

import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/notifications/NotificationContext';
import { getSetting } from '../../utils/settingsLoader';
import settingsLoader from '../../utils/settingsLoader';
import api from '../../services/api';
import { timeAgo as formatTimeAgo } from '../../utils/dateUtils';
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
  Megaphone,
  X
} from 'lucide-react';

// ============================================
// HEADER COMPONENT
// ============================================
const Header = ({ toggleSidebar }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  // ============================================
  // LOCAL STATE FOR PROFILE PICTURE
  // ============================================
  const [profilePicture, setProfilePicture] = useState(null);
  
  // ============================================
  // FETCH PROFILE PICTURE ON MOUNT + LISTEN FOR UPDATES
  // ============================================
  useEffect(() => {
    const fetchProfilePicture = async () => {
      try {
        const response = await api.get('/auth/me');
        if (response.data.success && response.data.data.profile_picture) {
          setProfilePicture(response.data.data.profile_picture);
        }
      } catch (error) {
        // Error handled silently
      }
    };

    fetchProfilePicture();

    // Listen for profile picture updates from Profile page
    const handler = (e) => {
      if (e.detail?.profile_picture !== undefined) {
        setProfilePicture(e.detail.profile_picture);
      }
    };
    window.addEventListener('profile-picture-updated', handler);
    return () => window.removeEventListener('profile-picture-updated', handler);
  }, []);
  
  // ============================================
  // ANNOUNCEMENT SETTINGS — REAL-TIME POLLING
  // Polls every 30 seconds so announcements appear
  // without requiring a page refresh.
  // ============================================
  const [announcementEnabled, setAnnouncementEnabled] = useState(() => {
    const raw = getSetting('announcement_enabled', 'false');
    return raw === 'true' || raw === true || raw === 1 || raw === '1';
  });
  const [announcementText, setAnnouncementText] = useState(() => getSetting('system_announcement', ''));
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);
  const announcementPollRef = useRef(null);

  const refreshAnnouncement = useCallback(async () => {
    try {
      const settings = await settingsLoader.refreshSettings();
      const rawEnabled = settings?.announcement_enabled || 'false';
      const enabled = rawEnabled === 'true' || rawEnabled === true || rawEnabled === 1 || rawEnabled === '1';
      const text = settings?.system_announcement || '';
      
      setAnnouncementEnabled(prev => {
        // If a NEW announcement appears (was off, now on), un-dismiss it
        if (!prev && enabled) setAnnouncementDismissed(false);
        return enabled;
      });
      setAnnouncementText(prev => {
        // If the announcement text changed, un-dismiss it
        if (prev !== text && text) setAnnouncementDismissed(false);
        return text;
      });
    } catch (err) {
      // Silent fail — keep existing state
    }
  }, []);

  useEffect(() => {
    // Initial fetch after 2 seconds, then every 30 seconds
    const initialTimer = setTimeout(refreshAnnouncement, 2000);
    announcementPollRef.current = setInterval(refreshAnnouncement, 30000);
    
    return () => {
      clearTimeout(initialTimer);
      if (announcementPollRef.current) clearInterval(announcementPollRef.current);
    };
  }, [refreshAnnouncement]);
  
  const showAnnouncement = announcementEnabled && announcementText && !announcementDismissed;
  
  const getUserInitial = () => {
    return user?.first_name?.charAt(0) || user?.username?.charAt(0) || 'U';
  };
  
  // ============================================
  // NOTIFICATION CONTEXT
  // ⭐ UPDATED: Added notificationsEnabled
  // ============================================
  const {
    notifications,
    unreadCount,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    notificationsEnabled, // ⭐ NEW: Get notifications enabled status
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
      // Error handled silently
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
  // ============================================
  const toggleNotifications = async () => {
    const newState = !showNotifications;
    setShowNotifications(newState);
    setShowUserMenu(false);

    if (newState) {
      setLoadingNotifications(true);
      try {
        await fetchNotifications(1, 20);
      } catch (error) {
        // Error handled silently
      } finally {
        setLoadingNotifications(false);
      }
    }
  };

  // ============================================
  // HANDLE NOTIFICATION CLICK
  // ============================================
  const handleNotificationClick = async (notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.notification_id);
    }

    if (notification.related_ticket_id) {
      navigate(`/tickets/${notification.related_ticket_id}`);
      setShowNotifications(false);
    }
  };

  // ============================================
  // HANDLE DELETE NOTIFICATION
  // ============================================
  const handleDeleteNotification = async (e, notificationId) => {
    e.stopPropagation();
    await deleteNotification(notificationId);
  };

  // ============================================
  // HANDLE MARK ALL AS READ
  // ============================================
  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
  };

  // ============================================
  // GET NOTIFICATION ICON
  // ============================================
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'TICKET_CREATED': return '🎫';
      case 'TICKET_ASSIGNED': return '👤';
      case 'TICKET_UPDATED': return '🔄';
      case 'TICKET_COMMENTED': return '💬';
      case 'TICKET_RESOLVED': return '✅';
      case 'TICKET_CLOSED': return '🔒';
      case 'LOGIN': return '🔐';
      case 'PASSWORD_CHANGED': return '🔑';
      default: return '📢';
    }
  };

  // ============================================
  // RENDER COMPONENT
  // ============================================
  return (
    <header className="header">
      {/* LEFT SECTION */}
      <div className="header-left">
        <button 
          className="btn-icon-header hamburger-btn"
          onClick={toggleSidebar}
          aria-label="Toggle Sidebar"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* CENTER SECTION - Announcement Banner */}
      {showAnnouncement ? (
        <div className="header-center">
          <div className="announcement-banner">
            <div className="announcement-banner-icon">
              <Megaphone size={16} />
            </div>
            <div className="announcement-banner-text">
              <span>{announcementText}</span>
            </div>
            <button 
              className="announcement-banner-close"
              onClick={() => setAnnouncementDismissed(true)}
              aria-label="Dismiss announcement"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ) : (
        <div className="header-center"></div>
      )}

      {/* RIGHT SECTION */}
      <div className="header-right">
        
        {/* NOTIFICATIONS DROPDOWN */}
        <div className="header-dropdown" ref={notificationsRef}>
          {/* ⭐ UPDATED: Added style and conditional badge */}
          <button 
            className="btn-icon-header"
            onClick={toggleNotifications}
            aria-label="Notifications"
            style={{ opacity: notificationsEnabled ? 1 : 0.5 }}
            title={notificationsEnabled ? 'Notifications' : 'Notifications disabled'}
          >
            <Bell size={20} />
            {notificationsEnabled && unreadCount > 0 && (
              <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
            )}
          </button>

          {showNotifications && (
            <div className="dropdown-menu notifications-menu">
              <div className="dropdown-header">
                <h3>Notifications</h3>
                {notifications.length > 0 && unreadCount > 0 && notificationsEnabled && (
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

              {/* ⭐ UPDATED: Added notifications disabled message */}
              <div className="dropdown-body">
                {!notificationsEnabled ? (
                  <div className="empty-notifications">
                    <Bell size={32} className="empty-icon" style={{ opacity: 0.4 }} />
                    <p style={{ fontWeight: 600, color: '#64748b' }}>Notifications Disabled</p>
                    <small style={{ color: '#94a3b8', textAlign: 'center', display: 'block', padding: '0 20px' }}>
                      Notifications are currently disabled by system administrator.
                      <br />
                      Check Settings → Notifications to enable.
                    </small>
                  </div>
                ) : loadingNotifications ? (
                  <div className="empty-notifications">
                    <Bell size={32} className="empty-icon" />
                    <p>Loading notifications...</p>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="empty-notifications">
                    <Bell size={32} className="empty-icon" />
                    <p>No notifications</p>
                    <small>You're all caught up!</small>
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <div 
                      key={notification.notification_id} 
                      className={`notification-item ${!notification.is_read ? 'unread' : ''}`}
                      onClick={() => handleNotificationClick(notification)}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="notification-icon">
                        {getNotificationIcon(notification.notification_type)}
                      </div>

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
                        {user?.role_code === 'Administrator' && (
                          <button
                            className="btn-icon-tiny btn-danger-tiny"
                            onClick={(e) => handleDeleteNotification(e, notification.notification_id)}
                            title="Delete notification"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
					  
                      {!notification.is_read && <div className="notification-dot"></div>}
                    </div>
                  ))
                )}
              </div>

              {/* ⭐ UPDATED: Only show footer when notifications enabled */}
              {notificationsEnabled && notifications.length > 0 && (
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

        {/* USER MENU DROPDOWN */}
        <div className="header-dropdown" ref={userMenuRef}>
          <button 
            className="user-menu-trigger"
            onClick={toggleUserMenu}
          >
            {/* SMALL AVATAR */}
            <div className="user-avatar-header">
              {profilePicture ? (
                <img
                  src={profilePicture}
                  alt="Profile"
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    objectFit: 'cover',
                    display: 'block',
                    background: 'white'
                  }}
                />
              ) : (
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #667eea, #764ba2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: '700'
                }}>
                  {getUserInitial()}
                </div>
              )}
            </div>

            <div className="user-info-header">
              <span className="user-name">
                {user?.first_name && user?.last_name 
                  ? `${user.first_name} ${user.last_name}` 
                  : user?.username}
              </span>
              <span className="user-role">{user?.role_name}</span>
            </div>
            <ChevronDown size={16} className={`chevron-icon ${showUserMenu ? 'rotated' : ''}`} />
          </button>

          {showUserMenu && (
            <div className="dropdown-menu user-dropdown-menu">
              <div className="dropdown-header-user">
                {/* LARGE AVATAR */}
                <div style={{ marginBottom: '12px' }}>
                  {profilePicture ? (
                    <img
                      src={profilePicture}
                      alt="Profile"
                      style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '12px',
                        objectFit: 'cover',
                        display: 'block',
                        background: 'white',
                        border: '2px solid rgba(255, 255, 255, 0.3)'
                      }}
                    />
                  ) : (
                    <div style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '12px',
                      background: 'rgba(255, 255, 255, 0.2)',
                      backdropFilter: 'blur(10px)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '24px',
                      fontWeight: '700',
                      border: '2px solid rgba(255, 255, 255, 0.3)'
                    }}>
                      {getUserInitial()}
                    </div>
                  )}
                </div>

                <div className="user-info-dropdown">
                  <h4>
                    {user?.first_name && user?.last_name 
                      ? `${user.first_name} ${user.last_name}` 
                      : user?.username}
                  </h4>
                  <p>{user?.email}</p>
                  <span className={`role-badge-small role-${user?.role_code?.toLowerCase()}`}>
                    {user?.role_name}
                  </span>
                </div>
              </div>

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

export default Header;
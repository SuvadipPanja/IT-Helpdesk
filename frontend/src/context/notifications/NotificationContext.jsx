// ============================================
// NOTIFICATION CONTEXT - FIXED INFINITE LOOP
// Global state management for notifications
// Implements HTTP Polling for real-time updates
// Developer: Suvadip Panja
// FIX: Removed infinite re-render loop
// ============================================

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api from '../../services/api';

// ============================================
// CREATE CONTEXT
// ============================================
const NotificationContext = createContext();

// ============================================
// CUSTOM HOOK: useNotification
// ============================================
export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
};

// ============================================
// NOTIFICATION PROVIDER COMPONENT
// ============================================
export const NotificationProvider = ({ children }) => {
  // ============================================
  // STATE MANAGEMENT
  // ============================================
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ============================================
  // POLLING CONFIGURATION
  // ============================================
  const POLL_INTERVAL = 20000; // 20 seconds
  const lastPollTimeRef = useRef(0);
  const pollingIntervalRef = useRef(null);
  const isPollingRef = useRef(false); // ← Use REF instead of state to avoid re-renders

  // ============================================
  // FETCH UNREAD COUNT
  // ============================================
  const fetchUnreadCount = useCallback(async () => {
    try {
      const now = Date.now();
      const timeSinceLastPoll = now - lastPollTimeRef.current;
      
      // Prevent rapid requests (minimum 5 seconds between calls)
      if (timeSinceLastPoll < 5000) {
        console.log('⏳ Skipping poll - too soon since last request');
        return;
      }

      lastPollTimeRef.current = now;
      
      const response = await api.get('/notifications/unread-count');
      if (response.data.success) {
        const count = response.data.data.unread_count;
        setUnreadCount(count);
      }
    } catch (err) {
      console.error('❌ Error fetching unread count:', err);
      // Don't show error to user for background polling
    }
  }, []);

  // ============================================
  // FETCH NOTIFICATIONS
  // ============================================
  const fetchNotifications = useCallback(async (page = 1, limit = 20, unreadOnly = false) => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        page,
        limit,
        unread_only: unreadOnly,
      };

      const response = await api.get('/notifications', { params });

      if (response.data.success) {
        setNotifications(response.data.data.notifications);
        return response.data.data;
      }
    } catch (err) {
      console.error('❌ Error fetching notifications:', err);
      setError(err.response?.data?.message || 'Failed to fetch notifications');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // ============================================
  // MARK SINGLE NOTIFICATION AS READ
  // ============================================
  const markAsRead = useCallback(async (notificationId) => {
    try {
      const response = await api.patch(`/notifications/${notificationId}/read`);

      if (response.data.success) {
        // Update local state immediately (optimistic update)
        setNotifications((prev) =>
          prev.map((notif) =>
            notif.notification_id === notificationId
              ? { ...notif, is_read: true }
              : notif
          )
        );

        // Update unread count
        setUnreadCount((prev) => Math.max(0, prev - 1));
        
        return true;
      }
      return false;
    } catch (err) {
      console.error('❌ Error marking notification as read:', err);
      return false;
    }
  }, []);

  // ============================================
  // MARK ALL NOTIFICATIONS AS READ
  // ============================================
  const markAllAsRead = useCallback(async () => {
    try {
      const response = await api.patch('/notifications/mark-all-read');

      if (response.data.success) {
        // Update local state
        setNotifications((prev) =>
          prev.map((notif) => ({ ...notif, is_read: true }))
        );
        setUnreadCount(0);
        
        return true;
      }
      return false;
    } catch (err) {
      console.error('❌ Error marking all as read:', err);
      return false;
    }
  }, []);

  // ============================================
  // DELETE NOTIFICATION
  // ============================================
  const deleteNotification = useCallback(async (notificationId) => {
    try {
      const response = await api.delete(`/notifications/${notificationId}`);

      if (response.data.success) {
        // Remove from local state
        setNotifications((prev) =>
          prev.filter((notif) => notif.notification_id !== notificationId)
        );

        // Update unread count if it was unread
        const notif = notifications.find((n) => n.notification_id === notificationId);
        if (notif && !notif.is_read) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
        
        return true;
      }
      return false;
    } catch (err) {
      console.error('❌ Error deleting notification:', err);
      return false;
    }
  }, [notifications]);

  // ============================================
  // CLEAR READ NOTIFICATIONS
  // ============================================
  const clearReadNotifications = useCallback(async () => {
    try {
      const response = await api.delete('/notifications/clear-read');

      if (response.data.success) {
        // Remove read notifications from local state
        setNotifications((prev) => prev.filter((notif) => !notif.is_read));
        
        return true;
      }
      return false;
    } catch (err) {
      console.error('❌ Error clearing read notifications:', err);
      return false;
    }
  }, []);

  // ============================================
  // REFRESH NOTIFICATIONS
  // ============================================
  const refreshNotifications = useCallback(async () => {
    await Promise.all([
      fetchUnreadCount(),
      fetchNotifications(),
    ]);
  }, [fetchUnreadCount, fetchNotifications]);

  // ============================================
  // POLLING LOGIC - FIXED INFINITE LOOP
  // ============================================
  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem('token');
    
    // Only start polling if token exists and not already polling
    if (token && !isPollingRef.current) {
      isPollingRef.current = true;
      console.log(`✅ Notification polling started (every ${POLL_INTERVAL/1000}s)`);

      // Initial fetch after 2 seconds
      const initialTimeout = setTimeout(() => {
        fetchUnreadCount();
      }, 2000);

      // Start polling interval
      pollingIntervalRef.current = setInterval(() => {
        fetchUnreadCount();
      }, POLL_INTERVAL);

      // Cleanup function
      return () => {
        console.log('❌ Notification polling stopped');
        clearTimeout(initialTimeout);
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        isPollingRef.current = false;
      };
    }
    
    // If no token, ensure polling is stopped
    if (!token && pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      isPollingRef.current = false;
      console.log('❌ Notification polling stopped (no token)');
    }
  }, [fetchUnreadCount]); // ← REMOVED isPolling from dependencies!

  // ============================================
  // VISIBILITY CHANGE HANDLER
  // ============================================
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        const timeSinceLastPoll = now - lastPollTimeRef.current;
        
        // Only fetch if it's been more than 5 seconds
        if (timeSinceLastPoll > 5000) {
          fetchUnreadCount();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchUnreadCount]);

  // ============================================
  // CONTEXT VALUE
  // ============================================
  const value = {
    // State
    notifications,
    unreadCount,
    loading,
    error,
    isPolling: isPollingRef.current,

    // Functions
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearReadNotifications,
    refreshNotifications,
  };

  // ============================================
  // RENDER PROVIDER
  // ============================================
  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

// ============================================
// EXPORT
// ============================================
export default NotificationContext;
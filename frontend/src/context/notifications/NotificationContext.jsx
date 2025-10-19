// ============================================
// NOTIFICATION CONTEXT
// Global state management for notifications
// Implements HTTP Polling for real-time updates
// UPDATED: Fixed polling frequency and added throttling
// ============================================

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api from '../../services/api';

// ============================================
// CREATE CONTEXT
// ============================================
const NotificationContext = createContext();

// ============================================
// CUSTOM HOOK: useNotification
// Easy access to notification context
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
// Wraps the entire app to provide notification state
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
  // POLLING CONFIGURATION - UPDATED
  // SECURITY: Increased interval to prevent backend overload
  // ============================================
  const [isPolling, setIsPolling] = useState(false);
  const POLL_INTERVAL = 20000; // 20 seconds - optimal for real-time feel
  const lastPollTimeRef = useRef(0);
  const pollingIntervalRef = useRef(null);

  // ============================================
  // FETCH UNREAD COUNT
  // Used for badge in header
  // Called every 60 seconds via polling
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

      console.log('🔔 Fetching unread count...');
      lastPollTimeRef.current = now;
      
      const response = await api.get('/notifications/unread-count');
      if (response.data.success) {
        const count = response.data.data.unread_count;
        setUnreadCount(count);
        console.log(`✅ Unread count: ${count}`);
      }
    } catch (err) {
      console.error('❌ Error fetching unread count:', err);
      // Don't show error to user for background polling
    }
  }, []);

  // ============================================
  // FETCH NOTIFICATIONS
  // Get all notifications with pagination
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

      console.log('📋 Fetching notifications...', params);
      const response = await api.get('/notifications', { params });

      if (response.data.success) {
        setNotifications(response.data.data.notifications);
        console.log(`✅ Fetched ${response.data.data.notifications.length} notifications`);
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
  // Called when user clicks on a notification
  // ============================================
  const markAsRead = useCallback(async (notificationId) => {
    try {
      const response = await api.patch(`/notifications/${notificationId}/read`);

      if (response.data.success) {
        // Update local state immediately (optimistic update)
        setNotifications((prev) =>
          prev.map((notif) =>
            notif.notification_id === notificationId
              ? { ...notif, is_read: true, read_at: new Date().toISOString() }
              : notif
          )
        );

        // Decrease unread count
        setUnreadCount((prev) => Math.max(0, prev - 1));

        console.log(`✅ Notification ${notificationId} marked as read`);
        return true;
      }
    } catch (err) {
      console.error('❌ Error marking notification as read:', err);
      setError(err.response?.data?.message || 'Failed to mark notification as read');
      return false;
    }
  }, []);

  // ============================================
  // MARK ALL NOTIFICATIONS AS READ
  // Called from "Mark all as read" button
  // ============================================
  const markAllAsRead = useCallback(async () => {
    try {
      const response = await api.patch('/notifications/read-all');

      if (response.data.success) {
        // Update all notifications to read (optimistic update)
        setNotifications((prev) =>
          prev.map((notif) => ({
            ...notif,
            is_read: true,
            read_at: new Date().toISOString(),
          }))
        );

        // Reset unread count
        setUnreadCount(0);

        console.log('✅ All notifications marked as read');
        return true;
      }
    } catch (err) {
      console.error('❌ Error marking all as read:', err);
      setError(err.response?.data?.message || 'Failed to mark all as read');
      return false;
    }
  }, []);

  // ============================================
  // DELETE SINGLE NOTIFICATION
  // Called when user dismisses a notification
  // ============================================
  const deleteNotification = useCallback(async (notificationId) => {
    try {
      const response = await api.delete(`/notifications/${notificationId}`);

      if (response.data.success) {
        // Find notification to check if it was unread
        const notification = notifications.find(
          (n) => n.notification_id === notificationId
        );

        // Remove from local state (optimistic update)
        setNotifications((prev) =>
          prev.filter((notif) => notif.notification_id !== notificationId)
        );

        // Decrease unread count if notification was unread
        if (notification && !notification.is_read) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }

        console.log(`✅ Notification ${notificationId} deleted`);
        return true;
      }
    } catch (err) {
      console.error('❌ Error deleting notification:', err);
      setError(err.response?.data?.message || 'Failed to delete notification');
      return false;
    }
  }, [notifications]);

  // ============================================
  // CLEAR ALL READ NOTIFICATIONS
  // Cleanup function - removes all read notifications
  // ============================================
  const clearReadNotifications = useCallback(async () => {
    try {
      const response = await api.delete('/notifications/clear-read');

      if (response.data.success) {
        // Remove all read notifications from local state
        setNotifications((prev) => prev.filter((notif) => !notif.is_read));

        console.log('✅ Read notifications cleared');
        return true;
      }
    } catch (err) {
      console.error('❌ Error clearing read notifications:', err);
      setError(err.response?.data?.message || 'Failed to clear read notifications');
      return false;
    }
  }, []);

  // ============================================
  // REFRESH NOTIFICATIONS
  // Force refresh - useful after user actions
  // ============================================
  const refreshNotifications = useCallback(async () => {
    await Promise.all([
      fetchUnreadCount(),
      fetchNotifications(),
    ]);
  }, [fetchUnreadCount, fetchNotifications]);

  // ============================================
  // POLLING LOGIC - UPDATED WITH BETTER THROTTLING
  // HTTP Polling: Fetch unread count every 60 seconds
  // Only polls when user is logged in
  // SECURITY: Prevents rapid polling that causes backend overload
  // ============================================
  useEffect(() => {
    // Check if user is authenticated (has token)
    const token = localStorage.getItem('token');
    
    if (token && !isPolling) {
      setIsPolling(true);

      // Initial fetch after 2 seconds
      const initialTimeout = setTimeout(() => {
        fetchUnreadCount();
      }, 2000);

      // Start polling
      pollingIntervalRef.current = setInterval(() => {
        fetchUnreadCount();
      }, POLL_INTERVAL);

      console.log(`✅ Notification polling started (every ${POLL_INTERVAL/1000}s)`);

      // Cleanup function
      return () => {
        clearTimeout(initialTimeout);
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        setIsPolling(false);
        console.log('❌ Notification polling stopped');
      };
    }
  }, [fetchUnreadCount, isPolling]);

  // ============================================
  // VISIBILITY CHANGE HANDLER
  // Refresh notifications when user returns to tab
  // Improves perceived real-time updates
  // ============================================
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        const timeSinceLastPoll = now - lastPollTimeRef.current;
        
        // Only fetch if it's been more than 5 seconds
        if (timeSinceLastPoll > 5000) {
          fetchUnreadCount();
          console.log('👁️ Tab became visible - refreshing notifications');
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
  // All functions and state available to children
  // ============================================
  const value = {
    // State
    notifications,
    unreadCount,
    loading,
    error,
    isPolling,

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
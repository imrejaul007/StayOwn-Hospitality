import { useState, useEffect, useCallback, useRef } from 'react';
import { dashboardUpdatesService } from '../services/dashboardUpdatesService';
import { useAuth } from '../context/AuthContext';

interface DashboardUpdate {
  notifications: Record<string, unknown>[];
  activities: Record<string, unknown>[];
  summary: Record<string, unknown>;
  isLoading: boolean;
  error: string | null;
  lastUpdated?: string;
}

interface UseDashboardUpdatesOptions {
  pollingInterval?: number; // in milliseconds
  autoStart?: boolean;
  maxRetries?: number;
}

export function useDashboardUpdates(options: UseDashboardUpdatesOptions = {}) {
  const {
    pollingInterval = 30000, // 30 seconds default
    autoStart = true,
    maxRetries = 3
  } = options;

  const { user } = useAuth();
  const [state, setState] = useState<DashboardUpdate>({
    notifications: [],
    activities: [],
    summary: {},
    isLoading: false,
    error: null
  });

  const isPollingRef = useRef(false);
  const retryCountRef = useRef(0);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  /**
   * Fetch initial data
   */
  const fetchInitialData = useCallback(async () => {
    if (!user || user.role === 'guest') return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const data = await dashboardUpdatesService.getLatestUpdates();
      setState(prev => ({
        ...prev,
        notifications: data.notifications,
        activities: data.activities,
        summary: data.summary,
        isLoading: false,
        lastUpdated: new Date().toISOString()
      }));
      retryCountRef.current = 0;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: 'Failed to load dashboard updates',
        isLoading: false
      }));
    }
  }, [user]);

  /**
   * Start real-time updates
   */
  const startUpdates = useCallback(() => {
    if (!user || user.role === 'guest' || isPollingRef.current) return;

    isPollingRef.current = true;

    // Subscribe to updates
    unsubscribeRef.current = dashboardUpdatesService.subscribe((update) => {
      setState(prev => {
        const newState = { ...prev };

        if (update.type === 'notifications') {
          // Merge new notifications, avoiding duplicates
          const existingIds = new Set(prev.notifications.map(n => n._id));
          const newNotifications = update.data.notifications.filter(n => !existingIds.has(n._id));
          newState.notifications = [...newNotifications, ...prev.notifications].slice(0, 50);
        }

        if (update.type === 'activities') {
          // Merge new activities, avoiding duplicates
          const existingIds = new Set(prev.activities.map(a => a.id));
          const newActivities = update.data.activities.filter(a => !existingIds.has(a.id));
          newState.activities = [...newActivities, ...prev.activities].slice(0, 50);
        }

        newState.lastUpdated = new Date().toISOString();
        return newState;
      });
    });

    // Start polling
    dashboardUpdatesService.startPolling(pollingInterval);

  }, [user, pollingInterval]);

  /**
   * Stop real-time updates
   */
  const stopUpdates = useCallback(() => {
    isPollingRef.current = false;
    
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    dashboardUpdatesService.stopPolling();
  }, []);

  /**
   * Manually refresh data
   */
  const refresh = useCallback(async () => {
    await fetchInitialData();
  }, [fetchInitialData]);

  /**
   * Mark notifications as read
   */
  const markNotificationsRead = useCallback(async (notificationIds?: string[], markAllRead: boolean = false) => {
    try {
      await dashboardUpdatesService.markNotificationsRead(notificationIds, markAllRead);
      
      // Update local state
      setState(prev => ({
        ...prev,
        notifications: markAllRead 
          ? prev.notifications.map(n => ({ ...n, status: 'read' }))
          : prev.notifications.map(n => 
              notificationIds?.includes(n._id) ? { ...n, status: 'read' } : n
            )
      }));
    } catch {
      // Error handled silently
    }
  }, []);

  /**
   * Get unread notifications count
   */
  const getUnreadCount = useCallback(() => {
    return state.notifications.filter(n => n.status !== 'read').length;
  }, [state.notifications]);

  /**
   * Get critical alerts count
   */
  const getCriticalAlertsCount = useCallback(() => {
    return state.notifications.filter(n => n.priority === 'high' && n.status !== 'read').length;
  }, [state.notifications]);

  // Auto-start on mount for admin/staff users
  useEffect(() => {
    if (user && user.role !== 'guest' && autoStart) {
      fetchInitialData().then(() => {
        if (autoStart) {
          startUpdates();
        }
      });
    }

    // Cleanup on unmount
    return () => {
      stopUpdates();
    };
  }, [user, autoStart, fetchInitialData, startUpdates, stopUpdates]);

  // Retry logic on error
  useEffect(() => {
    if (state.error && retryCountRef.current < maxRetries) {
      const timeout = setTimeout(() => {
        retryCountRef.current++;
        fetchInitialData();
      }, 5000 * Math.pow(2, retryCountRef.current)); // Exponential backoff

      return () => clearTimeout(timeout);
    }
  }, [state.error, maxRetries, fetchInitialData]);

  return {
    // Data
    notifications: state.notifications,
    activities: state.activities,
    summary: state.summary,
    
    // State
    isLoading: state.isLoading,
    error: state.error,
    lastUpdated: state.lastUpdated,
    isPolling: isPollingRef.current,
    
    // Actions
    startUpdates,
    stopUpdates,
    refresh,
    markNotificationsRead,
    
    // Computed values
    unreadCount: getUnreadCount(),
    criticalAlertsCount: getCriticalAlertsCount(),
    
    // Utils
    hasNewNotifications: state.notifications.some(n => n.status !== 'read'),
    hasCriticalAlerts: getCriticalAlertsCount() > 0
  };
}
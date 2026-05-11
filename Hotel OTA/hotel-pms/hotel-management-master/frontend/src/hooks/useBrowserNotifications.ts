import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

export interface BrowserNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
  requireInteraction?: boolean;
  silent?: boolean;
  vibrate?: number[];
}

export interface BrowserNotificationState {
  permission: NotificationPermission;
  supported: boolean;
  enabled: boolean;
}

export function useBrowserNotifications() {
  const { user } = useAuth();
  const [state, setState] = useState<BrowserNotificationState>({
    permission: 'default',
    supported: false,
    enabled: false
  });
  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduledTimersRef = useRef<Set<number>>(new Set());

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
      scheduledTimersRef.current.forEach(id => clearTimeout(id));
      scheduledTimersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    // Check if browser supports notifications
    const supported = 'Notification' in window && 'serviceWorker' in navigator;
    const permission = supported ? Notification.permission : 'denied';
    const enabled = permission === 'granted';

    setState({
      permission,
      supported,
      enabled
    });
  }, []);

  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!state.supported) {
      throw new Error('Browser notifications are not supported');
    }

    if (state.permission === 'granted') {
      return 'granted';
    }

    try {
      const permission = await Notification.requestPermission();
      setState(prev => ({ ...prev, permission, enabled: permission === 'granted' }));
      return permission;
    } catch (error) {
      return 'denied';
    }
  }, [state.supported, state.permission]);

  const sendNotification = useCallback(async (options: BrowserNotificationOptions): Promise<Notification | null> => {
    if (!state.supported) {
      return null;
    }

    if (state.permission !== 'granted') {
      return null;
    }

    try {
      // Check if page is visible - don't show browser notifications if user is active
      if (document.visibilityState === 'visible' && document.hasFocus()) {
        return null;
      }

      const {
        title,
        body,
        icon = '/favicon.ico',
        badge = '/badge-icon.png',
        tag = `pentouz-${Date.now()}`,
        data = {},
        requireInteraction = false,
        silent = false,
        vibrate = [200, 100, 200]
      } = options;

      const notification = new Notification(title, {
        body,
        icon,
        badge,
        tag,
        data: {
          ...data,
          userId: user?._id,
          timestamp: Date.now()
        },
        requireInteraction,
        silent,
        vibrate: navigator.vibrate ? vibrate : undefined
      });

      // Auto-close after 8 seconds if not requiring interaction
      if (!requireInteraction) {
        if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
        autoCloseTimerRef.current = setTimeout(() => {
          notification.close();
        }, 8000);
      }

      // Handle notification clicks
      notification.onclick = (event) => {
        event.preventDefault();
        window.focus();

        // Handle navigation based on notification data
        if (data.url) {
          window.location.href = data.url;
        } else if (data.route) {
          // If using React Router, you'd dispatch a navigation event here
          window.postMessage({
            type: 'NOTIFICATION_CLICKED',
            route: data.route,
            data: data
          }, window.location.origin);
        }

        notification.close();
      };

      // Handle notification close
      notification.onclose = () => {
        // Track notification engagement
      };

      // Handle notification error
      notification.onerror = (error) => {
      };

      return notification;
    } catch (error) {
      return null;
    }
  }, [state.supported, state.permission, user?._id]);

  const sendHotelNotification = useCallback(async (
    type: 'booking' | 'service' | 'alert' | 'system',
    title: string,
    message: string,
    additionalData?: Record<string, unknown>
  ) => {
    const iconMap = {
      booking: '/icons/booking-notification.png',
      service: '/icons/service-notification.png',
      alert: '/icons/alert-notification.png',
      system: '/icons/system-notification.png'
    };

    const requireInteractionMap = {
      booking: true,
      service: true,
      alert: true,
      system: false
    };

    return await sendNotification({
      title: `THE PENTOUZ - ${title}`,
      body: message,
      icon: iconMap[type] || '/favicon.ico',
      tag: `pentouz-${type}-${Date.now()}`,
      requireInteraction: requireInteractionMap[type],
      data: {
        type,
        ...additionalData
      }
    });
  }, [sendNotification]);

  const clearAll = useCallback(() => {
    // Clear all THE PENTOUZ notifications
    // This requires service worker support for full functionality
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        registration.getNotifications().then(notifications => {
          notifications.forEach(notification => {
            if (notification.tag && notification.tag.startsWith('pentouz')) {
              notification.close();
            }
          });
        });
      });
    }
  }, []);

  const scheduleNotification = useCallback(async (
    options: BrowserNotificationOptions,
    delay: number
  ): Promise<number> => {
    const id = window.setTimeout(() => {
      scheduledTimersRef.current.delete(id);
      sendNotification(options);
    }, delay);
    scheduledTimersRef.current.add(id);
    return id;
  }, [sendNotification]);

  const cancelScheduledNotification = useCallback((timeoutId: number) => {
    clearTimeout(timeoutId);
    scheduledTimersRef.current.delete(timeoutId);
  }, []);

  // Listen for page visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Clear notifications when user returns to the page
        clearAll();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [clearAll]);

  // Listen for notification clicks from other contexts
  useEffect(() => {
    const handleNotificationMessage = (event: MessageEvent) => {
      if (event.data.type === 'NOTIFICATION_CLICKED') {
        // Handle navigation or other actions
      }
    };

    window.addEventListener('message', handleNotificationMessage);
    return () => {
      window.removeEventListener('message', handleNotificationMessage);
    };
  }, []);

  return {
    state,
    requestPermission,
    sendNotification,
    sendHotelNotification,
    clearAll,
    scheduleNotification,
    cancelScheduledNotification,

    // Convenience methods
    isSupported: state.supported,
    isEnabled: state.enabled,
    hasPermission: state.permission === 'granted',
    needsPermission: state.permission === 'default',
    isDenied: state.permission === 'denied'
  };
}
// Service Worker for handling notifications
// This enables background notifications and advanced features

const CACHE_NAME = 'pentouz-notifications-v1';
const API_BASE = '/api/v1';

// Install service worker
self.addEventListener('install', (event) => {
  console.log('Notification service worker installed');
  self.skipWaiting();
});

// Activate service worker
self.addEventListener('activate', (event) => {
  console.log('Notification service worker activated');
  event.waitUntil(self.clients.claim());
});

// Handle push notifications (for future web push implementation)
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);

  if (!event.data) {
    return;
  }

  try {
    const data = event.data.json();
    const {
      title = 'THE PENTOUZ Hotel',
      body = 'You have a new notification',
      icon = '/favicon.ico',
      badge = '/badge-icon.png',
      tag = 'pentouz-push',
      url = '/',
      requireInteraction = false,
      actions = [],
      ...otherOptions
    } = data;

    const notificationOptions = {
      body,
      icon,
      badge,
      tag,
      data: { url, ...otherOptions },
      requireInteraction,
      actions: actions.map(action => ({
        action: action.action,
        title: action.title,
        icon: action.icon || '/icons/action-icon.png'
      })),
      vibrate: [200, 100, 200],
      timestamp: Date.now()
    };

    event.waitUntil(
      self.registration.showNotification(title, notificationOptions)
    );
  } catch (error) {
    console.error('Error handling push notification:', error);
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);

  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};

  notification.close();

  // Handle different actions
  if (action) {
    handleNotificationAction(action, data, event);
  } else {
    // Default click behavior - open/focus the app
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          const targetUrl = data.url || '/';

          // Check if app is already open
          for (const client of clientList) {
            if (client.url.includes(self.location.origin)) {
              // Focus existing window and navigate
              return client.focus().then(() => {
                return client.postMessage({
                  type: 'NOTIFICATION_CLICKED',
                  url: targetUrl,
                  data: data
                });
              });
            }
          }

          // Open new window if app is not open
          return clients.openWindow(targetUrl);
        })
    );
  }

  // Track notification engagement
  trackNotificationEvent('click', {
    tag: notification.tag,
    action: action || 'default',
    ...data
  });
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event.notification);

  // Track notification dismissal
  trackNotificationEvent('close', {
    tag: event.notification.tag,
    data: event.notification.data
  });
});

// Handle different notification actions
function handleNotificationAction(action, data, event) {
  switch (action) {
    case 'view_booking':
      event.waitUntil(
        clients.openWindow(`/bookings/${data.bookingId}`)
      );
      break;

    case 'accept_request':
      event.waitUntil(
        handleServiceAction('accept', data)
      );
      break;

    case 'decline_request':
      event.waitUntil(
        handleServiceAction('decline', data)
      );
      break;

    case 'mark_complete':
      event.waitUntil(
        handleServiceAction('complete', data)
      );
      break;

    case 'snooze':
      // Reschedule notification
      scheduleNotification(data, 10 * 60 * 1000); // 10 minutes
      break;

    default:
      console.log('Unknown notification action:', action);
  }
}

// Handle service-related actions
async function handleServiceAction(action, data) {
  try {
    const response = await fetch(`${API_BASE}/service-requests/${data.requestId}/${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.token}`
      },
      body: JSON.stringify({ action, data })
    });

    if (response.ok) {
      // Show success notification
      self.registration.showNotification('Action Completed', {
        body: `Service request ${action}ed successfully`,
        icon: '/icons/success-icon.png',
        tag: 'pentouz-action-success',
        requireInteraction: false
      });
    } else {
      throw new Error('Failed to complete action');
    }
  } catch (error) {
    console.error('Error handling service action:', error);

    // Show error notification
    self.registration.showNotification('Action Failed', {
      body: 'Failed to complete the requested action. Please try again.',
      icon: '/icons/error-icon.png',
      tag: 'pentouz-action-error',
      requireInteraction: true
    });
  }
}

// Schedule notification for later
function scheduleNotification(data, delay) {
  setTimeout(() => {
    self.registration.showNotification(data.title || 'Reminder', {
      body: data.body || 'This is your scheduled reminder',
      icon: data.icon || '/favicon.ico',
      tag: `pentouz-scheduled-${Date.now()}`,
      data: data,
      requireInteraction: false
    });
  }, delay);
}

// Track notification events for analytics
function trackNotificationEvent(eventType, data) {
  try {
    // Send analytics data to backend
    fetch(`${API_BASE}/analytics/notification-events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        event: eventType,
        timestamp: Date.now(),
        data: data
      })
    }).catch(error => {
      console.error('Failed to track notification event:', error);
    });
  } catch (error) {
    console.error('Error tracking notification event:', error);
  }
}

// Handle background sync (for offline capabilities)
self.addEventListener('sync', (event) => {
  if (event.tag === 'pentouz-notifications-sync') {
    event.waitUntil(syncNotifications());
  }
});

// Sync notifications when back online
async function syncNotifications() {
  try {
    // Fetch missed notifications while offline
    const response = await fetch(`${API_BASE}/notifications/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        lastSync: localStorage.getItem('lastNotificationSync') || 0
      })
    });

    if (response.ok) {
      const { notifications } = await response.json();

      // Show missed notifications
      for (const notification of notifications) {
        await self.registration.showNotification(notification.title, {
          body: notification.message,
          icon: notification.icon || '/favicon.ico',
          tag: `pentouz-sync-${notification.id}`,
          data: notification.data,
          requireInteraction: notification.priority === 'high'
        });
      }

      // Update last sync time
      localStorage.setItem('lastNotificationSync', Date.now().toString());
    }
  } catch (error) {
    console.error('Error syncing notifications:', error);
  }
}

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'pentouz-notifications-periodic') {
    event.waitUntil(syncNotifications());
  }
});

// Clean up old notifications
setInterval(() => {
  self.registration.getNotifications().then(notifications => {
    const now = Date.now();
    notifications.forEach(notification => {
      const age = now - (notification.timestamp || now);
      // Close notifications older than 1 hour
      if (age > 60 * 60 * 1000) {
        notification.close();
      }
    });
  });
}, 5 * 60 * 1000); // Run every 5 minutes
// Push Notification Service for Web Browsers
export class PushNotificationService {
  private registration: ServiceWorkerRegistration | null = null;

  // Initialize push notifications
  async initialize(): Promise<boolean> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return false;
    }

    try {
      // Register service worker
      this.registration = await navigator.serviceWorker.register('/sw.js');
      return true;
    } catch (error) {
      return false;
    }
  }

  // Request permission and subscribe
  async subscribe(): Promise<string | null> {
    if (!this.registration) {
      await this.initialize();
    }

    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Notification permission denied');
      }

      // Check if push notifications are supported
      if (!('pushManager' in this.registration!)) {
        return null;
      }

      // Check for existing subscription first
      const existingSubscription = await this.registration!.pushManager.getSubscription();
      if (existingSubscription) {
        return JSON.stringify(existingSubscription);
      }

      // Try to subscribe with VAPID key
      try {
        // Note: For development, you might need to generate proper VAPID keys
        // You can generate them using: npx web-push generate-vapid-keys
        const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

        const subscription = await this.registration!.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: this.urlBase64ToUint8Array(vapidKey)
        });

        return JSON.stringify(subscription);
      } catch (subscriptionError: unknown) {
        // If VAPID key fails, try without it (for local testing)

        if (subscriptionError.name === 'AbortError') {
          // This usually means the VAPID key is invalid or the push service is unavailable

          // For local development, we can still use notifications without push
          // Just return a mock subscription for testing
          if ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && import.meta.env.DEV) {
            return JSON.stringify({
              endpoint: 'mock://localhost/push',
              keys: {
                p256dh: 'mock-key',
                auth: 'mock-auth'
              }
            });
          }
        }

        throw subscriptionError;
      }
    } catch (error) {
      return null;
    }
  }

  // Check if user is subscribed
  async isSubscribed(): Promise<boolean> {
    if (!this.registration) return false;
    
    const subscription = await this.registration.pushManager.getSubscription();
    return !!subscription;
  }

  // Unsubscribe from push notifications
  async unsubscribe(): Promise<boolean> {
    if (!this.registration) return false;

    const subscription = await this.registration.pushManager.getSubscription();
    if (subscription) {
      return await subscription.unsubscribe();
    }
    return false;
  }

  // Helper function to convert VAPID key
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  // Show local notification (for testing)
  showLocalNotification(title: string, options?: NotificationOptions) {
    if (Notification.permission === 'granted') {
      return new Notification(title, {
        icon: '/icon-192x192.png',
        badge: '/badge-72x72.png',
        ...options
      });
    }
  }
}

export const pushNotificationService = new PushNotificationService();
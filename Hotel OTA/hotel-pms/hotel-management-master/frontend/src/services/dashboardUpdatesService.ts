import { api } from './api';

interface DashboardNotification {
  _id: string;
  type: string;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  metadata?: {
    guestId?: { name: string; email: string };
    bookingId?: { bookingNumber: string };
    amount?: number;
    currency?: string;
    category?: string;
  };
}

interface ActivityFeedItem {
  id: string;
  type: string;
  title: string;
  message: string;
  timestamp: string;
  priority: string;
  user?: {
    name: string;
    email: string;
    avatar?: string;
  };
  booking?: {
    number: string;
  };
  amount?: number;
  currency?: string;
}

interface DashboardSummary {
  todayActivities: number;
  last24HoursActivities: number;
  unreadNotifications: number;
  criticalAlerts: number;
  breakdown: Record<string, number>;
  lastUpdated: string;
}

class DashboardUpdatesService {
  private pollingInterval?: NodeJS.Timeout;
  private lastNotificationCheck?: string;
  private listeners: Array<(data: unknown) => void> = [];

  /**
   * Get real-time notifications for admin dashboard
   */
  async getNotifications(since?: string, types?: string[], limit: number = 50): Promise<{
    notifications: DashboardNotification[];
    counts: {
      total: number;
      byCategory: Record<string, number>;
    };
    timestamp: string;
  }> {
    try {
      const params = new URLSearchParams();
      if (since) params.append('since', since);
      if (types?.length) params.append('types', types.join(','));
      params.append('limit', limit.toString());

      const response = await api.get(`/dashboard-updates/notifications?${params.toString()}`);
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get activity feed for dashboard
   */
  async getActivityFeed(since?: string, limit: number = 20): Promise<{
    activities: ActivityFeedItem[];
    count: number;
    timestamp: string;
  }> {
    try {
      const params = new URLSearchParams();
      if (since) params.append('since', since);
      params.append('limit', limit.toString());

      const response = await api.get(`/dashboard-updates/activity-feed?${params.toString()}`);
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get dashboard summary
   */
  async getSummary(): Promise<{
    summary: DashboardSummary;
    breakdown: Record<string, number>;
    lastUpdated: string;
  }> {
    try {
      const response = await api.get('/dashboard-updates/summary');
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Mark notifications as read
   */
  async markNotificationsRead(notificationIds?: string[], markAllRead: boolean = false): Promise<{
    markedCount: number;
    timestamp: string;
  }> {
    try {
      const response = await api.patch('/dashboard-updates/mark-read', {
        notificationIds,
        markAllRead
      });
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Start polling for updates
   */
  startPolling(intervalMs: number = 30000): void {
    if (this.pollingInterval) {
      this.stopPolling();
    }

    this.pollingInterval = setInterval(async () => {
      try {
        const since = this.lastNotificationCheck || new Date(Date.now() - intervalMs).toISOString();
        
        // Get new notifications since last check
        const notifications = await this.getNotifications(since);
        
        if (notifications.notifications.length > 0) {
          // Notify all listeners of new data
          this.listeners.forEach(listener => {
            listener({
              type: 'notifications',
              data: notifications
            });
          });
          
          this.lastNotificationCheck = notifications.timestamp;
        }

        // Get activity feed updates
        const activities = await this.getActivityFeed(since);
        
        if (activities.activities.length > 0) {
          this.listeners.forEach(listener => {
            listener({
              type: 'activities',
              data: activities
            });
          });
        }

      } catch {
        // Error handled silently
      }
    }, intervalMs);

  }

  /**
   * Stop polling for updates
   */
  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }
  }

  /**
   * Subscribe to real-time updates
   */
  subscribe(callback: (data: unknown) => void): () => void {
    this.listeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Get latest notifications without polling
   */
  async getLatestUpdates(): Promise<{
    notifications: DashboardNotification[];
    activities: ActivityFeedItem[];
    summary: DashboardSummary;
  }> {
    const [notificationsData, activitiesData, summaryData] = await Promise.all([
      this.getNotifications(undefined, undefined, 10),
      this.getActivityFeed(undefined, 10),
      this.getSummary()
    ]);

    return {
      notifications: notificationsData.notifications,
      activities: activitiesData.activities,
      summary: summaryData.summary
    };
  }

  /**
   * Check if there are unread notifications
   */
  async hasUnreadNotifications(): Promise<boolean> {
    const summary = await this.getSummary();
    return summary.summary.unreadNotifications > 0;
  }

  /**
   * Get critical alerts count
   */
  async getCriticalAlertsCount(): Promise<number> {
    const summary = await this.getSummary();
    return summary.summary.criticalAlerts;
  }
}

export const dashboardUpdatesService = new DashboardUpdatesService();
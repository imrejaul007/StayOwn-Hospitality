import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest, api } from '../services/api';

export interface NotificationMetrics {
  totalSent: number;
  totalDelivered: number;
  totalRead: number;
  totalClicked: number;
  totalFailed: number;
  avgResponseTime: number;
}

export interface DeliveryStats {
  _id: {
    channel: string;
    date: string;
  };
  events: Array<{
    type: string;
    count: number;
  }>;
}

export interface UserEngagement {
  _id: string;
  totalNotifications: number;
  readNotifications: number;
  clickedNotifications: number;
  readRate: number;
  clickRate: number;
  avgResponseTime: number;
}

export interface CategoryPerformance {
  _id: string;
  sent: number;
  delivered: number;
  read: number;
  clicked: number;
  failed: number;
  deliveryRate: number;
  readRate: number;
  clickRate: number;
  failureRate: number;
  avgResponseTime: number;
}

export interface ChannelPerformance {
  _id: string;
  sent: number;
  delivered: number;
  read: number;
  clicked: number;
  failed: number;
  deliveryRate: number;
  readRate: number;
  clickRate: number;
  failureRate: number;
  avgResponseTime: number;
}

export interface NotificationAnalyticsDashboard {
  deliveryStats: DeliveryStats[];
  userEngagement: UserEngagement[];
  categoryPerformance: CategoryPerformance[];
  channelPerformance: ChannelPerformance[];
  realTimeMetrics: NotificationMetrics;
  timeRange: number;
}

export interface AnalyticsFilters {
  timeRange?: number;
  channel?: string;
  category?: string;
  limit?: number;
  format?: 'json' | 'csv';
}

export function useNotificationAnalytics() {
  const queryClient = useQueryClient();

  // Track notification event
  const trackEventMutation = useMutation({
    mutationFn: async (eventData: {
      event: string;
      notificationId?: string;
      channel?: string;
      metadata?: Record<string, unknown>;
      deviceInfo?: Record<string, unknown>;
    }) => {
      const response = await apiRequest('/api/v1/analytics/notification-events', {
        method: 'POST',
        body: JSON.stringify(eventData)
      });
      return response;
    },
    onSuccess: () => {
      // Invalidate real-time metrics to refresh dashboard
      queryClient.invalidateQueries({ queryKey: ['notification-analytics', 'real-time'] });
    }
  });

  // Get notification analytics dashboard
  const useDashboard = (filters: AnalyticsFilters = {}) => {
    return useQuery<NotificationAnalyticsDashboard>({
      queryKey: ['notification-analytics', 'dashboard', filters],
      queryFn: async () => {
        const params = new URLSearchParams();
        if (filters.timeRange) params.append('timeRange', filters.timeRange.toString());

        const response = await apiRequest(`/api/v1/analytics/notifications/dashboard?${params.toString()}`);
        return response.data;
      },
      refetchInterval: 30000, // Refresh every 30 seconds
      staleTime: 15000 // Consider data stale after 15 seconds
    });
  };

  // Get delivery statistics
  const useDeliveryStats = (filters: AnalyticsFilters = {}) => {
    return useQuery<{ stats: DeliveryStats[]; filters: AnalyticsFilters }>({
      queryKey: ['notification-analytics', 'delivery-stats', filters],
      queryFn: async () => {
        const params = new URLSearchParams();
        if (filters.timeRange) params.append('timeRange', filters.timeRange.toString());
        if (filters.channel) params.append('channel', filters.channel);
        if (filters.category) params.append('category', filters.category);

        const response = await apiRequest(`/api/v1/analytics/notifications/delivery-stats?${params.toString()}`);
        return response.data;
      },
      staleTime: 60000 // Consider data stale after 1 minute
    });
  };

  // Get user engagement metrics
  const useUserEngagement = (filters: AnalyticsFilters = {}) => {
    return useQuery<{ engagement: UserEngagement[]; totalUsers: number; filters: AnalyticsFilters }>({
      queryKey: ['notification-analytics', 'user-engagement', filters],
      queryFn: async () => {
        const params = new URLSearchParams();
        if (filters.timeRange) params.append('timeRange', filters.timeRange.toString());
        if (filters.limit) params.append('limit', filters.limit.toString());

        const response = await apiRequest(`/api/v1/analytics/notifications/user-engagement?${params.toString()}`);
        return response.data;
      },
      staleTime: 120000 // Consider data stale after 2 minutes
    });
  };

  // Get category performance
  const useCategoryPerformance = (filters: AnalyticsFilters = {}) => {
    return useQuery<{ performance: CategoryPerformance[]; filters: AnalyticsFilters }>({
      queryKey: ['notification-analytics', 'category-performance', filters],
      queryFn: async () => {
        const params = new URLSearchParams();
        if (filters.timeRange) params.append('timeRange', filters.timeRange.toString());

        const response = await apiRequest(`/api/v1/analytics/notifications/category-performance?${params.toString()}`);
        return response.data;
      },
      staleTime: 120000
    });
  };

  // Get channel performance
  const useChannelPerformance = (filters: AnalyticsFilters = {}) => {
    return useQuery<{ performance: ChannelPerformance[]; filters: AnalyticsFilters }>({
      queryKey: ['notification-analytics', 'channel-performance', filters],
      queryFn: async () => {
        const params = new URLSearchParams();
        if (filters.timeRange) params.append('timeRange', filters.timeRange.toString());

        const response = await apiRequest(`/api/v1/analytics/notifications/channel-performance?${params.toString()}`);
        return response.data;
      },
      staleTime: 120000
    });
  };

  // Get real-time metrics
  const useRealTimeMetrics = () => {
    return useQuery<{ metrics: NotificationMetrics }>({
      queryKey: ['notification-analytics', 'real-time'],
      queryFn: async () => {
        const response = await apiRequest('/api/v1/analytics/notifications/real-time');
        return response.data;
      },
      refetchInterval: 10000, // Refresh every 10 seconds
      staleTime: 5000 // Consider data stale after 5 seconds
    });
  };

  // Export analytics data
  const exportDataMutation = useMutation({
    mutationFn: async (filters: AnalyticsFilters & { format: 'json' | 'csv' }) => {
      const params = new URLSearchParams();
      if (filters.timeRange) params.append('timeRange', filters.timeRange.toString());
      params.append('format', filters.format);

      if (filters.format === 'csv') {
        const response = await api.get(`/analytics/notifications/export?${params.toString()}`, {
          responseType: 'blob'
        });

        const blob = response.data;
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `notification-analytics-${Date.now()}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        return { success: true };
      } else {
        const { data } = await api.get(`/analytics/notifications/export?${params.toString()}`);
        return data;
      }
    }
  });

  // Utility function to track notification events
  const trackEvent = (
    eventType: 'sent' | 'delivered' | 'read' | 'clicked' | 'dismissed' | 'failed',
    notificationId?: string,
    options: {
      channel?: string;
      category?: string;
      responseTime?: number;
      actionTaken?: string;
      metadata?: Record<string, unknown>;
    } = {}
  ) => {
    trackEventMutation.mutate({
      event: eventType,
      notificationId,
      channel: options.channel || 'in_app',
      metadata: {
        category: options.category || 'general',
        responseTime: options.responseTime,
        actionTaken: options.actionTaken,
        ...options.metadata
      }
    });
  };

  // Utility function to calculate rates
  const calculateRates = (performance: CategoryPerformance | ChannelPerformance) => {
    return {
      deliveryRate: performance.sent > 0 ? (performance.delivered / performance.sent * 100).toFixed(1) : '0.0',
      readRate: performance.delivered > 0 ? (performance.read / performance.delivered * 100).toFixed(1) : '0.0',
      clickRate: performance.read > 0 ? (performance.clicked / performance.read * 100).toFixed(1) : '0.0',
      failureRate: performance.sent > 0 ? (performance.failed / performance.sent * 100).toFixed(1) : '0.0'
    };
  };

  return {
    // Queries
    useDashboard,
    useDeliveryStats,
    useUserEngagement,
    useCategoryPerformance,
    useChannelPerformance,
    useRealTimeMetrics,

    // Mutations
    trackEvent,
    exportData: exportDataMutation.mutateAsync,
    isExporting: exportDataMutation.isPending,

    // Utilities
    calculateRates
  };
}
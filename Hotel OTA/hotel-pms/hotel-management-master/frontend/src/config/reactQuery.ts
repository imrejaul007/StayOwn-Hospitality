import { QueryClient } from '@tanstack/react-query';

/**
 * React Query Configuration
 *
 * Optimized configuration for React Query to improve:
 * - Data caching efficiency
 * - Background refetching behavior
 * - Error handling
 * - Performance
 */

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale time: how long data is considered fresh (5 minutes)
      // Data won't refetch if it's still "fresh"
      staleTime: 5 * 60 * 1000, // 5 minutes

      // Cache time: how long inactive data stays in cache (10 minutes)
      // After this time, unused data is garbage collected
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)

      // Retry failed requests
      retry: (failureCount, error: unknown) => {
        // Don't retry on 4xx errors (client errors)
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          return false;
        }
        // Retry up to 2 times for 5xx errors
        return failureCount < 2;
      },
      retryDelay: 1000, // 1 second between retries

      // Refetch on window focus (disabled by default for better performance)
      // Enable for specific queries that need fresh data
      refetchOnWindowFocus: false,

      // Refetch on reconnect (useful when internet connection is restored)
      refetchOnReconnect: 'always',

      // Refetch on mount (only if data is stale)
      refetchOnMount: true,

      // Keep previous data while fetching new data
      // Prevents UI flickering during refetches
      placeholderData: (previousData) => previousData,

      // Suspense mode (useful with React Suspense boundaries)
      suspense: false,

      // Network mode
      networkMode: 'online',

      // Structure sharing (enabled by default for memory efficiency)
      structuralSharing: true
    },
    mutations: {
      // Retry failed mutations
      retry: 0, // Don't retry mutations by default (they often have side effects)

      // Network mode
      networkMode: 'online',

      // Garbage collection time for mutation results
      gcTime: 0 // Don't cache mutation results
    }
  }
});

/**
 * Query keys factory for consistent cache management
 * Centralized place to manage all query keys
 */
export const queryKeys = {
  // ========================================
  // Multi-Property System
  // ========================================

  // Property Portfolio
  portfolio: {
    all: ['portfolio'] as const,
    list: () => [...queryKeys.portfolio.all, 'list'] as const,
    detail: (portfolioId: string) =>
      [...queryKeys.portfolio.all, 'detail', portfolioId] as const
  },

  // Properties
  properties: {
    all: ['properties'] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.properties.all, 'list', filters] as const,
    detail: (propertyId: string) =>
      [...queryKeys.properties.all, 'detail', propertyId] as const,
    byGroup: (groupId: string) =>
      [...queryKeys.properties.all, 'group', groupId] as const
  },

  // Property Groups
  propertyGroups: {
    all: ['property-groups'] as const,
    list: () => [...queryKeys.propertyGroups.all, 'list'] as const,
    detail: (groupId: string) =>
      [...queryKeys.propertyGroups.all, 'detail', groupId] as const
  },

  // Settings Inheritance
  inheritance: {
    all: ['inheritance'] as const,
    status: (propertyId: string) =>
      [...queryKeys.inheritance.all, 'status', propertyId] as const,
    affectedCount: (scope: string, propertyId: string) =>
      [...queryKeys.inheritance.all, 'affected-count', scope, propertyId] as const,
    groupSummary: (groupId: string) =>
      [...queryKeys.inheritance.all, 'group-summary', groupId] as const
  },

  // Settings
  settings: {
    all: ['settings'] as const,
    byType: (propertyId: string, settingType: string) =>
      [...queryKeys.settings.all, propertyId, settingType] as const,
    preview: (scope: string, propertyId: string, settingType: string) =>
      [...queryKeys.settings.all, 'preview', scope, propertyId, settingType] as const
  },

  // Audit Logs
  auditLogs: {
    all: ['audit-logs'] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.auditLogs.all, 'list', filters] as const,
    stats: (dateRange?: Record<string, unknown>) =>
      [...queryKeys.auditLogs.all, 'stats', dateRange] as const,
    analytics: (dateRange?: Record<string, unknown>) =>
      [...queryKeys.auditLogs.all, 'analytics', dateRange] as const
  },

  // Scheduled Updates
  scheduledUpdates: {
    all: ['scheduled-updates'] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.scheduledUpdates.all, 'list', filters] as const,
    detail: (updateId: string) =>
      [...queryKeys.scheduledUpdates.all, 'detail', updateId] as const
  },

  // Change History
  changeHistory: {
    all: ['change-history'] as const,
    byProperty: (propertyId: string, settingType: string) =>
      [...queryKeys.changeHistory.all, propertyId, settingType] as const
  },

  // Analytics
  analytics: {
    all: ['analytics'] as const,
    multiProperty: (dateRange?: Record<string, unknown>) =>
      [...queryKeys.analytics.all, 'multi-property', dateRange] as const,
    heatmap: (dateRange?: Record<string, unknown>) =>
      [...queryKeys.analytics.all, 'heatmap', dateRange] as const,
    timeSavings: (dateRange?: Record<string, unknown>) =>
      [...queryKeys.analytics.all, 'time-savings', dateRange] as const
  },

  // ========================================
  // Original System
  // ========================================

  // Hotels
  hotels: {
    all: ['hotels'] as const,
    list: () => [...queryKeys.hotels.all, 'list'] as const,
    detail: (hotelId: string) => [...queryKeys.hotels.all, 'detail', hotelId] as const
  },

  // Bookings
  bookings: {
    all: ['bookings'] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.bookings.all, 'list', filters] as const,
    detail: (bookingId: string) =>
      [...queryKeys.bookings.all, 'detail', bookingId] as const,
    upcoming: () => [...queryKeys.bookings.all, 'upcoming'] as const
  },

  // Rooms
  rooms: {
    all: ['rooms'] as const,
    list: (hotelId?: string) => [...queryKeys.rooms.all, 'list', hotelId] as const,
    detail: (roomId: string) => [...queryKeys.rooms.all, 'detail', roomId] as const,
    types: (hotelId: string) => [...queryKeys.rooms.all, 'types', hotelId] as const
  },

  // Guests
  guests: {
    all: ['guests'] as const,
    list: (filters?: Record<string, unknown>) => [...queryKeys.guests.all, 'list', filters] as const,
    detail: (guestId: string) => [...queryKeys.guests.all, 'detail', guestId] as const,
    search: (query: string) => [...queryKeys.guests.all, 'search', query] as const
  },

  // Users
  users: {
    all: ['users'] as const,
    list: () => [...queryKeys.users.all, 'list'] as const,
    detail: (userId: string) => [...queryKeys.users.all, 'detail', userId] as const,
    current: () => [...queryKeys.users.all, 'current'] as const
  },

  // Dashboard
  dashboard: {
    all: ['dashboard'] as const,
    stats: (propertyId?: string) =>
      [...queryKeys.dashboard.all, 'stats', propertyId] as const,
    occupancy: (propertyId?: string) =>
      [...queryKeys.dashboard.all, 'occupancy', propertyId] as const,
    revenue: (propertyId?: string, dateRange?: Record<string, unknown>) =>
      [...queryKeys.dashboard.all, 'revenue', propertyId, dateRange] as const
  }
};

/**
 * Helper functions for cache invalidation
 */
export const invalidateQueries = {
  // Invalidate all property-related queries
  property: (propertyId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.properties.detail(propertyId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.settings.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.inheritance.all });
  },

  // Invalidate all group-related queries
  group: (groupId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.propertyGroups.detail(groupId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.properties.byGroup(groupId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.inheritance.groupSummary(groupId) });
  },

  // Invalidate all settings queries
  settings: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.settings.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.inheritance.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.auditLogs.all });
  },

  // Invalidate all queries (use sparingly)
  all: () => {
    queryClient.invalidateQueries();
  }
};

/**
 * Prefetch helpers for common data access patterns
 */
export const prefetchQueries = {
  // Prefetch property details
  property: async (propertyId: string, fetchFn: () => Promise<any>) => {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.properties.detail(propertyId),
      queryFn: fetchFn,
      staleTime: 5 * 60 * 1000 // 5 minutes
    });
  },

  // Prefetch inheritance status
  inheritanceStatus: async (propertyId: string, fetchFn: () => Promise<any>) => {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.inheritance.status(propertyId),
      queryFn: fetchFn,
      staleTime: 3 * 60 * 1000 // 3 minutes
    });
  }
};

export default queryClient;

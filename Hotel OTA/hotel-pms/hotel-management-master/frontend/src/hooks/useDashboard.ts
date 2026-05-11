import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dashboardService } from '../services/dashboardService';

// Query keys
export const dashboardKeys = {
  all: ['dashboard'] as const,
  realTime: (hotelId?: string) => [...dashboardKeys.all, 'real-time', hotelId] as const,
  kpis: (hotelId?: string, period?: string) => [...dashboardKeys.all, 'kpis', hotelId, period] as const,
  occupancy: (hotelId: string, floor?: string, roomType?: string) => 
    [...dashboardKeys.all, 'occupancy', hotelId, floor, roomType] as const,
  revenue: (hotelId: string, period?: string, startDate?: string, endDate?: string, groupBy?: string) =>
    [...dashboardKeys.all, 'revenue', hotelId, period, startDate, endDate, groupBy] as const,
  staffPerformance: (hotelId: string, period?: string, department?: string, staffId?: string) =>
    [...dashboardKeys.all, 'staff-performance', hotelId, period, department, staffId] as const,
  guestSatisfaction: (hotelId: string, period?: string, rating?: number) => 
    [...dashboardKeys.all, 'guest-satisfaction', hotelId, period, rating] as const,
  operations: (hotelId: string, category?: string) => 
    [...dashboardKeys.all, 'operations', hotelId, category] as const,
  marketing: (hotelId: string, campaignType?: string, period?: string) => 
    [...dashboardKeys.all, 'marketing', hotelId, campaignType, period] as const,
  alerts: (hotelId: string, severity?: string, category?: string, status?: string, limit?: number) => 
    [...dashboardKeys.all, 'alerts', hotelId, severity, category, status, limit] as const,
  systemHealth: (hotelId: string, component?: string) => 
    [...dashboardKeys.all, 'system-health', hotelId, component] as const,
  reports: (hotelId: string, reportType: string, options?: Record<string, unknown>) =>
    [...dashboardKeys.all, 'reports', hotelId, reportType, options] as const,
  summary: (hotelId?: string) => [...dashboardKeys.all, 'summary', hotelId] as const,
  hotels: () => [...dashboardKeys.all, 'hotels'] as const,
  preferences: () => [...dashboardKeys.all, 'preferences'] as const,
} as const;

// Real-time dashboard data hook
export const useRealTimeData = (hotelId?: string, options?: { 
  refetchInterval?: number;
  enabled?: boolean;
}) => {
  return useQuery({
    queryKey: dashboardKeys.realTime(hotelId),
    queryFn: () => dashboardService.getRealTimeData(hotelId),
    refetchInterval: options?.refetchInterval || 30000, // Refresh every 30 seconds
    enabled: options?.enabled ?? true,
    staleTime: 10000, // Consider data stale after 10 seconds
  });
};

// KPIs hook
export const useKPIs = (hotelId?: string, period?: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: dashboardKeys.kpis(hotelId, period),
    queryFn: () => dashboardService.getKPIs(hotelId, period),
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Occupancy data hook
export const useOccupancyData = (
  hotelId: string, 
  floor?: string, 
  roomType?: string,
  options?: { enabled?: boolean }
) => {
  return useQuery({
    queryKey: dashboardKeys.occupancy(hotelId, floor, roomType),
    queryFn: () => dashboardService.getOccupancyData(hotelId, floor, roomType),
    enabled: (options?.enabled ?? true) && !!hotelId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    retry: (failureCount, error: unknown) => {
      const err = error as { response?: { status?: number } };
      // Don't retry on 429 errors to avoid making the rate limiting worse
      if (err?.response?.status === 429) return false;
      return failureCount < 3;
    },
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};

// Revenue data hook
export const useRevenueData = (
  hotelId: string,
  period?: string,
  startDate?: string,
  endDate?: string,
  groupBy?: string,
  options?: { enabled?: boolean }
) => {
  return useQuery({
    queryKey: dashboardKeys.revenue(hotelId, period, startDate, endDate, groupBy),
    queryFn: () => dashboardService.getRevenueData(hotelId, period, startDate, endDate, groupBy),
    enabled: (options?.enabled ?? true) && !!hotelId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: (failureCount, error: unknown) => {
      const err = error as { response?: { status?: number } };
      // Don't retry on 429 errors to avoid making the rate limiting worse
      if (err?.response?.status === 429) return false;
      return failureCount < 3;
    },
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};

// Staff performance hook
export const useStaffPerformance = (
  hotelId: string,
  period?: string,
  department?: string,
  staffId?: string,
  options?: { enabled?: boolean }
) => {
  return useQuery({
    queryKey: dashboardKeys.staffPerformance(hotelId, period, department, staffId),
    queryFn: () => dashboardService.getStaffPerformance(hotelId, period, department, staffId),
    enabled: (options?.enabled ?? true) && !!hotelId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Guest satisfaction hook
export const useGuestSatisfaction = (
  hotelId: string,
  period?: string,
  rating?: number,
  options?: { enabled?: boolean }
) => {
  return useQuery({
    queryKey: dashboardKeys.guestSatisfaction(hotelId, period, rating),
    queryFn: () => dashboardService.getGuestSatisfaction(hotelId, period, rating),
    enabled: (options?.enabled ?? true) && !!hotelId,
    staleTime: 15 * 60 * 1000, // 15 minutes
  });
};

// Operations data hook
export const useOperationsData = (
  hotelId: string,
  category?: string,
  options?: { enabled?: boolean }
) => {
  return useQuery({
    queryKey: dashboardKeys.operations(hotelId, category),
    queryFn: () => dashboardService.getOperationsData(hotelId, category),
    enabled: (options?.enabled ?? true) && !!hotelId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Marketing data hook
export const useMarketingData = (
  hotelId: string,
  campaignType?: string,
  period?: string,
  options?: { enabled?: boolean }
) => {
  return useQuery({
    queryKey: dashboardKeys.marketing(hotelId, campaignType, period),
    queryFn: () => dashboardService.getMarketingData(hotelId, campaignType, period),
    enabled: (options?.enabled ?? true) && !!hotelId,
    staleTime: 15 * 60 * 1000, // 15 minutes
  });
};

// Alerts hook
export const useAlerts = (
  hotelId: string,
  severity?: string,
  category?: string,
  status?: string,
  limit?: number,
  options?: { refetchInterval?: number; enabled?: boolean }
) => {
  return useQuery({
    queryKey: dashboardKeys.alerts(hotelId, severity, category, status, limit),
    queryFn: () => dashboardService.getAlerts(hotelId, severity, category, status, limit),
    refetchInterval: options?.refetchInterval || 60000, // Refresh every minute
    enabled: (options?.enabled ?? true) && !!hotelId,
    staleTime: 30000, // 30 seconds
  });
};

// System health hook
export const useSystemHealth = (
  hotelId: string,
  component?: string,
  options?: { refetchInterval?: number; enabled?: boolean }
) => {
  return useQuery({
    queryKey: dashboardKeys.systemHealth(hotelId, component),
    queryFn: () => dashboardService.getSystemHealth(hotelId, component),
    refetchInterval: options?.refetchInterval || 30000, // Refresh every 30 seconds
    enabled: (options?.enabled ?? true) && !!hotelId,
    staleTime: 15000, // 15 seconds
  });
};

// Reports hook
export const useReports = (
  hotelId: string,
  reportType: 'financial' | 'operational' | 'guest_analytics' | 'staff_performance' | 'marketing' | 'comprehensive',
  options?: {
    startDate?: string;
    endDate?: string;
    groupBy?: 'day' | 'week' | 'month';
    format?: 'json' | 'csv' | 'excel' | 'pdf';
    includeCharts?: boolean;
    filters?: Record<string, unknown>;
  },
  queryOptions?: { enabled?: boolean }
) => {
  return useQuery({
    queryKey: dashboardKeys.reports(hotelId, reportType, options),
    queryFn: () => dashboardService.getReports(hotelId, reportType, options),
    enabled: queryOptions?.enabled ?? true,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Dashboard summary hook
export const useDashboardSummary = (hotelId?: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: dashboardKeys.summary(hotelId),
    queryFn: () => dashboardService.getDashboardSummary(hotelId),
    enabled: options?.enabled ?? true,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

// Available hotels hook
export const useAvailableHotels = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: dashboardKeys.hotels(),
    queryFn: () => dashboardService.getAvailableHotels(),
    enabled: options?.enabled ?? true,
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
};

// Dashboard preferences hook
export const useDashboardPreferences = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: dashboardKeys.preferences(),
    queryFn: () => dashboardService.getDashboardPreferences(),
    enabled: options?.enabled ?? true,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Mutations
export const useRefreshAllData = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (hotelId?: string) => dashboardService.refreshAllData(hotelId),
    onSuccess: () => {
      // Invalidate all dashboard queries to trigger refetch
      queryClient.invalidateQueries({ queryKey: dashboardKeys.all });
    },
  });
};

export const useUpdateDashboardPreferences = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (preferences: {
      defaultHotelId?: string;
      refreshInterval?: number;
      defaultDateRange?: string;
      preferredCharts?: string[];
      theme?: 'light' | 'dark';
    }) => dashboardService.updateDashboardPreferences(preferences),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dashboardKeys.preferences() });
    },
  });
};

export const useExportData = () => {
  return useMutation({
    mutationFn: ({
      endpoint,
      format,
      params,
    }: {
      endpoint: string;
      format: 'csv' | 'excel' | 'pdf';
      params?: Record<string, string>;
    }) => dashboardService.exportData(endpoint, format, params),
  });
};

// Utility hook for combined dashboard data
export const useDashboardOverview = (hotelId?: string) => {
  // Only enable queries when hotelId is available to avoid 400 errors
  const hasHotelId = !!hotelId;
  const realTimeData = useRealTimeData(hotelId, { refetchInterval: 30000, enabled: hasHotelId });
  const kpis = useKPIs(hotelId, 'today', { enabled: hasHotelId });
  const alerts = useAlerts(hotelId, undefined, undefined, undefined, 10, { enabled: hasHotelId });
  const systemHealth = useSystemHealth(hotelId, undefined, { enabled: hasHotelId });

  return {
    realTimeData,
    kpis,
    alerts,
    systemHealth,
    isLoading: realTimeData.isLoading || kpis.isLoading || alerts.isLoading || systemHealth.isLoading,
    error: realTimeData.error || kpis.error || alerts.error || systemHealth.error,
  };
};
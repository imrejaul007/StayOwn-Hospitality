import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  reportsService, 
  ReportFilters, 
  RevenueReportData, 
  OccupancyReportData, 
  BookingsReportData, 
  BookingStatsData,
  CheckoutInventoryData
} from '../services/reportsService';

// Query keys
export const reportsKeys = {
  all: ['reports'] as const,
  revenue: (filters: ReportFilters) => [...reportsKeys.all, 'revenue', filters] as const,
  occupancy: (filters: ReportFilters) => [...reportsKeys.all, 'occupancy', filters] as const,
  bookings: (filters: ReportFilters) => [...reportsKeys.all, 'bookings', filters] as const,
  bookingStats: (filters: ReportFilters) => [...reportsKeys.all, 'booking-stats', filters] as const,
  checkoutInventory: (filters: ReportFilters) => [...reportsKeys.all, 'checkout-inventory', filters] as const,
  comprehensive: (reportType: string, filters: ReportFilters) => 
    [...reportsKeys.all, 'comprehensive', reportType, filters] as const,
} as const;

// Hooks for specific report types
export const useRevenueReport = (filters: ReportFilters, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: reportsKeys.revenue(filters),
    queryFn: () => reportsService.getRevenueReport(filters),
    enabled: options?.enabled && !!(filters.startDate && filters.endDate),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useOccupancyReport = (filters: ReportFilters, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: reportsKeys.occupancy(filters),
    queryFn: () => reportsService.getOccupancyReport(filters),
    enabled: options?.enabled && !!(filters.startDate && filters.endDate),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useBookingsReport = (filters: ReportFilters, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: reportsKeys.bookings(filters),
    queryFn: () => reportsService.getBookingsReport(filters),
    enabled: options?.enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useBookingStats = (filters: ReportFilters, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: reportsKeys.bookingStats(filters),
    queryFn: () => reportsService.getBookingStats(filters),
    enabled: options?.enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

export const useCheckoutInventoryReport = (filters: ReportFilters, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: reportsKeys.checkoutInventory(filters),
    queryFn: () => reportsService.getCheckoutInventoryReport(filters),
    enabled: options?.enabled && !!(filters.startDate && filters.endDate),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

// Comprehensive report hook (used by ReportBuilder)
export const useComprehensiveReport = (
  reportType: 'financial' | 'operational' | 'guest_analytics' | 'staff_performance' | 'marketing' | 'comprehensive',
  filters: ReportFilters,
  options?: { enabled?: boolean }
) => {
  return useQuery({
    queryKey: reportsKeys.comprehensive(reportType, filters),
    queryFn: () => reportsService.getComprehensiveReport(reportType, filters),
    enabled: options?.enabled && !!(filters.startDate && filters.endDate),
    staleTime: 10 * 60 * 1000, // 10 minutes for comprehensive reports
  });
};

// Export mutation
export const useExportReport = () => {
  return useMutation({
    mutationFn: ({ 
      reportType, 
      filters, 
      format 
    }: { 
      reportType: string; 
      filters: ReportFilters; 
      format: 'csv' | 'excel' | 'pdf' 
    }) => reportsService.exportReport(reportType, filters, format),
    onSuccess: (blob, variables) => {
      // Auto-download the exported file
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const extension = variables.format === 'excel' ? 'xlsx' : variables.format;
      const filename = `${variables.reportType}-report-${new Date().toISOString().split('T')[0]}.${extension}`;
      
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    },
  });
};

// Combined reports hook for dashboard overview
export const useDashboardReports = (
  hotelId: string,
  dateRange: { startDate: string; endDate: string },
  options?: { enabled?: boolean }
) => {
  const filters: ReportFilters = {
    hotelId,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    groupBy: 'day',
  };

  const revenueQuery = useRevenueReport(filters, { enabled: options?.enabled });
  const occupancyQuery = useOccupancyReport(filters, { enabled: options?.enabled });
  const bookingsQuery = useBookingsReport(filters, { enabled: options?.enabled });
  const statsQuery = useBookingStats(filters, { enabled: options?.enabled });
  const checkoutInventoryQuery = useCheckoutInventoryReport(filters, { enabled: options?.enabled });

  return {
    revenue: revenueQuery,
    occupancy: occupancyQuery,
    bookings: bookingsQuery,
    stats: statsQuery,
    checkoutInventory: checkoutInventoryQuery,
    isLoading: revenueQuery.isLoading || occupancyQuery.isLoading || bookingsQuery.isLoading || statsQuery.isLoading || checkoutInventoryQuery.isLoading,
    error: revenueQuery.error || occupancyQuery.error || bookingsQuery.error || statsQuery.error || checkoutInventoryQuery.error,
    refetchAll: () => {
      revenueQuery.refetch();
      occupancyQuery.refetch();
      bookingsQuery.refetch();
      statsQuery.refetch();
      checkoutInventoryQuery.refetch();
    },
  };
};

// Helper hook to get available date ranges
export const useReportDateRanges = () => {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  const getDateRange = (days: number) => {
    const start = new Date(now);
    start.setDate(now.getDate() - days);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: today,
    };
  };

  return {
    today: { startDate: today, endDate: today },
    last7days: getDateRange(7),
    last30days: getDateRange(30),
    last90days: getDateRange(90),
    thisMonth: {
      startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0],
      endDate: today,
    },
    lastMonth: (() => {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        startDate: lastMonth.toISOString().split('T')[0],
        endDate: lastMonthEnd.toISOString().split('T')[0],
      };
    })(),
    thisYear: {
      startDate: '2020-01-01', // Much wider range to capture any existing data
      endDate: today,
    },
  };
};
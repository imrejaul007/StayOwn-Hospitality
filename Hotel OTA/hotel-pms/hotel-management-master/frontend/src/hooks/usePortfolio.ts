import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

// Query keys for portfolio data
export const portfolioKeys = {
  all: ['portfolio'] as const,
  metrics: () => [...portfolioKeys.all, 'metrics'] as const,
  dashboard: (period?: string) => [...portfolioKeys.all, 'dashboard', period] as const,
  revenue: (startDate?: string, endDate?: string) => [...portfolioKeys.all, 'revenue', startDate, endDate] as const,
  bookings: (page?: number, limit?: number, status?: string) => [...portfolioKeys.all, 'bookings', page, limit, status] as const,
  occupancy: (period?: string) => [...portfolioKeys.all, 'occupancy', period] as const,
} as const;

// Portfolio metrics hook - aggregated KPIs across all properties
export const usePortfolioMetrics = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: portfolioKeys.metrics(),
    queryFn: async () => {
      const response = await api.get('/portfolio/metrics');
      return response.data;
    },
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Portfolio dashboard hook - consolidated dashboard with trends
export const usePortfolioDashboard = (period: string = '30d', options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: portfolioKeys.dashboard(period),
    queryFn: async () => {
      const response = await api.get('/portfolio/dashboard', { params: { period } });
      return response.data;
    },
    enabled: options?.enabled ?? true,
    staleTime: 3 * 60 * 1000, // 3 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Portfolio revenue hook - revenue breakdown by property
export const usePortfolioRevenue = (startDate?: string, endDate?: string, options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: portfolioKeys.revenue(startDate, endDate),
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;

      const response = await api.get('/portfolio/revenue', { params });
      return response.data;
    },
    enabled: options?.enabled ?? true,
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
  });
};

// Portfolio bookings hook - all bookings across properties
export const usePortfolioBookings = (
  page: number = 1,
  limit: number = 20,
  status?: string,
  options?: { enabled?: boolean }
) => {
  return useQuery({
    queryKey: portfolioKeys.bookings(page, limit, status),
    queryFn: async () => {
      const params: Record<string, string | number> = { page, limit };
      if (status) params.status = status;

      const response = await api.get('/portfolio/bookings', { params });
      return response.data;
    },
    enabled: options?.enabled ?? true,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    keepPreviousData: true, // Keep previous page data while loading new page
  });
};

// Portfolio occupancy hook - aggregated occupancy data
export const usePortfolioOccupancy = (period: string = '30d', options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: portfolioKeys.occupancy(period),
    queryFn: async () => {
      const response = await api.get('/portfolio/occupancy', { params: { period } });
      return response.data;
    },
    enabled: options?.enabled ?? true,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Utility hook for complete portfolio overview
export const usePortfolioOverview = (period: string = '30d') => {
  const metrics = usePortfolioMetrics();
  const dashboard = usePortfolioDashboard(period);
  const revenue = usePortfolioRevenue();
  const occupancy = usePortfolioOccupancy(period);

  return {
    metrics,
    dashboard,
    revenue,
    occupancy,
    isLoading: metrics.isLoading || dashboard.isLoading || revenue.isLoading || occupancy.isLoading,
    error: metrics.error || dashboard.error || revenue.error || occupancy.error,
  };
};

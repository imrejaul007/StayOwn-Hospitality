import { api } from './api';
import { withRateLimit } from '../utils/requestThrottle';
import { 
  ApiResponse,
  RealTimeDashboard,
  KPIData,
  OccupancyData,
  RevenueData,
  StaffPerformanceData,
  GuestSatisfactionData,
  OperationsData,
  MarketingData,
  AlertsData,
  SystemHealthData,
  ReportData,
  DashboardFilters
} from '../types/dashboard';

class DashboardService {
  private baseUrl = '/admin-dashboard';

  /**
   * Get available hotels (for hotel selection)
   */
  async getHotels(): Promise<unknown> {
    try {
      const response = await api.get('/admin/hotels');
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get real-time dashboard overview data
   */
  async getRealTimeData(hotelId?: string): Promise<ApiResponse<RealTimeDashboard>> {
    try {
      const params = new URLSearchParams();
      if (hotelId) params.append('hotelId', hotelId);

      const response = await api.get(`${this.baseUrl}/real-time?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get key performance indicators
   */
  async getKPIs(hotelId?: string, period?: string): Promise<ApiResponse<KPIData>> {
    try {
      const params = new URLSearchParams();
      if (hotelId) params.append('hotelId', hotelId);
      if (period) params.append('period', period);

      const response = await api.get(`${this.baseUrl}/kpis?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get detailed occupancy data with room status
   */
  async getOccupancyData(
    hotelId: string, 
    floor?: string, 
    roomType?: string
  ): Promise<ApiResponse<OccupancyData>> {
    try {
      const params = new URLSearchParams();
      params.append('hotelId', hotelId);
      if (floor) params.append('floor', floor);
      if (roomType) params.append('roomType', roomType);

      const endpoint = `${this.baseUrl}/occupancy`;
      return withRateLimit(endpoint, async () => {
        const response = await api.get(`${endpoint}?${params.toString()}`);
        return response.data;
      });
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get revenue analytics and financial data
   */
  async getRevenueData(
    hotelId: string,
    period?: string,
    startDate?: string,
    endDate?: string,
    groupBy?: string
  ): Promise<ApiResponse<RevenueData>> {
    try {
      const params = new URLSearchParams();
      params.append('hotelId', hotelId);
      if (period) params.append('period', period);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (groupBy) params.append('groupBy', groupBy);

      const endpoint = `${this.baseUrl}/revenue`;
      return withRateLimit(endpoint, async () => {
        const response = await api.get(`${endpoint}?${params.toString()}`);
        const raw = response.data?.data;

        /** Safely coerce to a finite number (NaN, null, undefined, Infinity → 0) */
        const n = (v: unknown): number => {
          const num = Number(v);
          return Number.isFinite(num) ? num : 0;
        };

        // Transform backend response shape to match RevenueData type
        const totalRoomTypeRevenue = (raw?.charts?.revenueByRoomType || [])
          .reduce((sum: number, t: { revenue?: number }) => sum + n(t.revenue), 0);

        const transformed: RevenueData = {
          summary: {
            totalRevenue: n(raw?.overview?.totalRevenue),
            totalBookings: n(raw?.overview?.totalBookings),
            averageBookingValue: n(raw?.overview?.averageBookingValue),
            revenueGrowth: n(raw?.overview?.revenueGrowth),
            bookingGrowth: n(raw?.overview?.bookingGrowth),
          },
          timeSeries: (raw?.charts?.dailyRevenue || []).map(
            (d: { date: string; revenue: number; bookings: number; averageValue: number }) => ({
              date: d.date,
              revenue: n(d.revenue),
              bookings: n(d.bookings),
              averageRate: n(d.averageValue),
            })
          ),
          bySource: (raw?.charts?.bySource || []).map(
            (s: { source: string; amount: number; percentage: number; bookings: number }) => ({
              source: s.source || 'Unknown',
              amount: n(s.amount),
              percentage: n(s.percentage),
              bookings: n(s.bookings),
            })
          ),
          byRoomType: (raw?.charts?.revenueByRoomType || []).map(
            (t: { roomType: string; revenue: number; bookings: number; averageRate: number }) => ({
              roomType: t.roomType || 'Unknown',
              revenue: n(t.revenue),
              percentage: totalRoomTypeRevenue > 0
                ? Math.round((n(t.revenue) / totalRoomTypeRevenue) * 100)
                : 0,
              bookings: n(t.bookings),
              averageRate: n(t.averageRate),
            })
          ),
          byPaymentStatus: (raw?.charts?.paymentMethods || []).map(
            (m: { method: string; revenue: number; count: number; percentage: number }) => ({
              status: m.method || 'Not Specified',
              count: n(m.count),
              amount: n(m.revenue),
              percentage: n(m.percentage),
            })
          ),
          periodComparison: {
            current: n(raw?.insights?.revenueComparison?.current),
            previous: n(raw?.insights?.revenueComparison?.previous),
            change: n(raw?.insights?.revenueComparison?.difference),
            changePercentage: n(raw?.insights?.revenueComparison?.growth),
          },
          forecast: (raw?.charts?.forecast || []).map(
            (f: { month: string; expectedRevenue: number }) => ({
              date: f.month,
              projectedRevenue: n(f.expectedRevenue),
            })
          ),
        };

        return {
          status: response.data?.status || 'success',
          data: transformed,
        };
      });
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get staff performance metrics
   */
  async getStaffPerformance(
    hotelId: string,
    period?: string,
    department?: string,
    staffId?: string
  ): Promise<ApiResponse<StaffPerformanceData>> {
    try {
      const params = new URLSearchParams();
      params.append('hotelId', hotelId);
      if (period) params.append('period', period);
      if (department) params.append('department', department);
      if (staffId) params.append('staffId', staffId);

      const response = await api.get(`${this.baseUrl}/staff-performance?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get guest satisfaction and review analytics
   */
  async getGuestSatisfaction(
    hotelId: string,
    period?: string,
    rating?: number
  ): Promise<ApiResponse<GuestSatisfactionData>> {
    try {
      const params = new URLSearchParams();
      params.append('hotelId', hotelId);
      if (period) params.append('period', period);
      if (rating) params.append('rating', rating.toString());

      const response = await api.get(`${this.baseUrl}/guest-satisfaction?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get operations data (housekeeping, maintenance, incidents)
   */
  async getOperationsData(
    hotelId: string,
    category?: string
  ): Promise<ApiResponse<OperationsData>> {
    try {
      const params = new URLSearchParams();
      params.append('hotelId', hotelId);
      if (category) params.append('category', category);

      const response = await api.get(`${this.baseUrl}/operations?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get marketing campaign analytics
   */
  async getMarketingData(
    hotelId: string,
    campaignType?: string,
    period?: string
  ): Promise<ApiResponse<MarketingData>> {
    try {
      const params = new URLSearchParams();
      params.append('hotelId', hotelId);
      if (campaignType) params.append('campaignType', campaignType);
      if (period) params.append('period', period);

      const response = await api.get(`${this.baseUrl}/marketing?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get system alerts and notifications
   */
  async getAlerts(
    hotelId: string,
    severity?: string,
    category?: string,
    status?: string,
    limit?: number
  ): Promise<ApiResponse<AlertsData>> {
    try {
      const params = new URLSearchParams();
      params.append('hotelId', hotelId);
      if (severity) params.append('severity', severity);
      if (category) params.append('category', category);
      if (status) params.append('status', status);
      if (limit) params.append('limit', limit.toString());

      const response = await api.get(`${this.baseUrl}/alerts?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get system health monitoring data
   */
  async getSystemHealth(
    hotelId: string,
    component?: string
  ): Promise<ApiResponse<SystemHealthData>> {
    try {
      const params = new URLSearchParams();
      params.append('hotelId', hotelId);
      if (component) params.append('component', component);

      const response = await api.get(`${this.baseUrl}/system-health?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Generate and get advanced reports
   */
  async getReports(
    hotelId: string,
    reportType: 'financial' | 'operational' | 'guest_analytics' | 'staff_performance' | 'marketing' | 'comprehensive',
    options?: {
      startDate?: string;
      endDate?: string;
      groupBy?: 'day' | 'week' | 'month';
      format?: 'json' | 'csv' | 'excel' | 'pdf';
      includeCharts?: boolean;
      filters?: Record<string, unknown>;
    }
  ): Promise<ApiResponse<ReportData>> {
    try {
      const params = new URLSearchParams();
      params.append('hotelId', hotelId);
      params.append('reportType', reportType);

      // Backend /reports endpoint requires startDate and endDate - provide defaults
      const defaultEnd = new Date().toISOString().split('T')[0];
      const defaultStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      params.append('startDate', options?.startDate || defaultStart);
      params.append('endDate', options?.endDate || defaultEnd);

      if (options) {
        if (options.groupBy) params.append('groupBy', options.groupBy);
        if (options.format) params.append('format', options.format);
        if (typeof options.includeCharts === 'boolean') params.append('includeCharts', String(options.includeCharts));
      }

      // Route to the admin dashboard reporting engine.
      const response = await api.get(`${this.baseUrl}/reports?${params.toString()}`);
      const payload = response.data;

      const reportData: ReportData = {
        reportType,
        generatedAt: payload?.metadata?.generatedAt || new Date().toISOString(),
        parameters: {
          hotelId,
          startDate: options?.startDate || '',
          endDate: options?.endDate || '',
          groupBy: options?.groupBy || 'day',
          filters: options?.filters || {},
        },
        summary: {
          totalRecords: 1,
          dateRange: {
            start: options?.startDate || '',
            end: options?.endDate || '',
          },
          keyMetrics: payload?.data?.[reportType]?.summary || {},
        },
        data: payload?.data || {},
        charts: [],
      };

      return { status: payload?.status || 'success', data: reportData };
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Refresh all dashboard data
   */
  async refreshAllData(hotelId?: string): Promise<void> {
    // This could trigger a backend refresh or clear local cache
    // For now, we'll just return a promise that resolves immediately
    return Promise.resolve();
  }

  /**
   * Get dashboard summary for quick overview
   */
  async getDashboardSummary(hotelId?: string): Promise<ApiResponse<{
    kpis: KPIData;
    alerts: { count: number; critical: number };
    occupancy: { rate: number; available: number };
    revenue: { today: number; month: number };
    lastUpdated: string;
  }>> {
    try {
      // This could be a lightweight endpoint for header/summary info
      const params = new URLSearchParams();
      if (hotelId) params.append('hotelId', hotelId);

      const response = await api.get(`${this.baseUrl}/summary?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Export data to various formats
   */
  async exportData(
    endpoint: string,
    format: 'csv' | 'excel' | 'pdf',
    params: Record<string, string> = {}
  ): Promise<Blob> {
    try {
      const searchParams = new URLSearchParams(params);
      searchParams.append('format', format);
      const toBlob = (data: unknown, mime: string) =>
        data instanceof Blob ? data : new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 2)], { type: mime });

      if (endpoint === 'revenue') {
        const response = await api.get(`${this.baseUrl}/revenue/export?${searchParams.toString()}`, {
          responseType: 'blob'
        });
        return toBlob(response.data, format === 'csv' ? 'text/csv' : 'application/json');
      }

      const reportTypeMap: Record<string, string> = {
        occupancy: 'operational',
        'guest-satisfaction': 'guest_analytics',
        'staff-performance': 'staff_performance',
        reports: (params.reportType as string) || 'comprehensive'
      };

      const reportType = reportTypeMap[endpoint] || 'comprehensive';
      searchParams.set('reportType', reportType);

      const response = await api.get(`${this.baseUrl}/reports?${searchParams.toString()}`);
      const content =
        format === 'csv'
          ? `reportType,generatedAt\n${reportType},${response.data?.metadata?.generatedAt || new Date().toISOString()}\n`
          : response.data;

      return toBlob(content, format === 'csv' ? 'text/csv' : 'application/json');
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get available hotels for admin user
   */
  async getAvailableHotels(): Promise<ApiResponse<{
    _id: string;
    name: string;
    address: {
      city: string;
      country: string;
    };
  }[]>> {
    try {
      const response = await api.get('/admin/hotels');
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Update dashboard preferences
   */
  async updateDashboardPreferences(preferences: {
    defaultHotelId?: string;
    refreshInterval?: number;
    defaultDateRange?: string;
    preferredCharts?: string[];
    theme?: 'light' | 'dark';
  }): Promise<ApiResponse<unknown>> {
    try {
      const response = await api.put('/user-preferences/display', preferences);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get dashboard preferences
   */
  async getDashboardPreferences(): Promise<ApiResponse<{
    defaultHotelId?: string;
    refreshInterval?: number;
    defaultDateRange?: string;
    preferredCharts?: string[];
    theme?: 'light' | 'dark';
  }>> {
    try {
      const response = await api.get('/user-preferences/display');
      return {
        status: response.data?.status || 'success',
        data: response.data?.data?.display || {}
      };
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // New simplified dashboard counts for sidebar
  async getDashboardCounts(): Promise<{
    frontDesk: {
      total: number;
      checkIn: number;
      checkOut: number;
    };
    reservations: {
      total: number;
      confirmed: number;
      pending: number;
      checkedIn: number;
    };
    housekeeping: {
      total: number;
      dirty: number;
      maintenance: number;
      outOfOrder: number;
    };
    guestServices: {
      total: number;
      pending: number;
      inProgress: number;
      vipGuests: number;
      corporate: number;
    };
  }> {
    try {
      const response = await api.get('/dashboard/counts');
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }
}

export const dashboardService = new DashboardService();
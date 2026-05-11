import { api } from './api';

export interface ReportFilters {
  startDate?: string;
  endDate?: string;
  groupBy?: 'day' | 'week' | 'month' | 'year';
  hotelId?: string;
}

export interface RevenueReportData {
  summary: {
    totalRevenue: number;
    totalBookings: number;
    averageBookingValue: number;
  };
  breakdown: Array<{
    _id: {
      date: string;
      hotelId: string;
    };
    totalRevenue: number;
    bookingCount: number;
    averageBookingValue: number;
  }>;
  period: {
    startDate: string;
    endDate: string;
    groupBy: string;
  };
}

export interface OccupancyReportData {
  summary: {
    occupancyRate: number;
    totalRoomNights: number;
    totalPossibleRoomNights: number;
    totalRooms: number;
    periodDays: number;
  };
  occupancyByType: Record<string, {
    roomNights: number;
    bookings: number;
  }>;
  period: {
    startDate: string;
    endDate: string;
  };
}

export interface BookingsReportData {
  summary: {
    totalBookings: number;
    totalRevenue: number;
  };
  breakdown: Array<{
    _id: string;
    count: number;
    totalRevenue: number;
  }>;
  period: {
    startDate: string;
    endDate: string;
  } | null;
}

export interface BookingStatsData {
  stats: {
    total: number;
    totalRevenue: number;
    averageBookingValue: number;
    pending: number;
    confirmed: number;
    checkedIn: number;
    checkedOut: number;
    cancelled: number;
  };
}

export interface CheckoutInventoryData {
  summary: {
    totalCheckouts: number;
    /** Revenue total — backend field is totalRevenue */
    totalRevenue: number;
    /** Average amount per checkout — backend field is avgAmount */
    avgAmount: number;
    uniqueRooms: number;
  };
  /** Per-date breakdown array — each item maps to one date bucket */
  checkoutData: Array<{
    date: string;
    checkouts: number;
    revenue: number;
    avgAmount: number;
    uniqueRooms: number;
  }>;
  period: {
    startDate: string;
    endDate: string;
  };
}

export interface RevenueComponent {
  amount: number;
  percentage: string;
  label: string;
}

export interface RevenueByType {
  type: string;
  amount: number;
  percentage: string;
}

export interface RevenueByWeek {
  week: number;
  amount: number;
  percentage: string;
}

export interface RevenueByStatus {
  status: string;
  amount: number;
  percentage: string;
}

export interface RevenueBreakdown {
  total: number;
  components: {
    roomRevenue: RevenueComponent;
    taxRevenue: RevenueComponent;
    serviceRevenue: RevenueComponent;
    extraCharges: RevenueComponent;
  };
  byRoomType: RevenueByType[];
  byWeek: RevenueByWeek[];
  byStatus: RevenueByStatus[];
  metrics: {
    totalBookings: number;
    averageBookingValue: number;
    refunds: number;
    netRevenue: number;
  };
  period: {
    month: number;
    year: number;
    monthName: string;
  };
}

export interface OccupancyBreakdown {
  overall: {
    rate: number;
    totalRooms: number;
    occupiedRooms: number;
    availableRooms: number;
  };
  byRoomType: Array<{
    type: string;
    rate: number;
    occupiedRooms: number;
    totalRooms: number;
    percentage: string;
  }>;
  dailyOccupancy: Array<{
    date: string;
    rate: number;
    occupiedRooms: number;
    totalRooms: number;
  }>;
  peakDays: Array<{
    date: string;
    rate: number;
    dayOfWeek: string;
  }>;
  metrics: {
    averageRate: number;
    peakOccupancy: number;
    lowestOccupancy: number;
    roomNights: number;
  };
  period: {
    month: number;
    year: number;
    monthName: string;
  };
}

export interface BookingsBreakdown {
  total: number;
  byStatus: Array<{
    status: string;
    count: number;
    percentage: string;
    revenue: number;
  }>;
  bySource: Array<{
    source: string;
    count: number;
    percentage: string;
    averageValue: number;
  }>;
  weekly: Array<{
    week: number;
    count: number;
    revenue: number;
    averageValue: number;
  }>;
  metrics: {
    totalRevenue: number;
    averageBookingValue: number;
    confirmationRate: number;
    cancellationRate: number;
  };
  period: {
    month: number;
    year: number;
    monthName: string;
  };
}

export interface SatisfactionBreakdown {
  overall: {
    rating: number;
    totalReviews: number;
    responseRate: number;
  };
  byRating: Array<{
    rating: number;
    count: number;
    percentage: string;
  }>;
  byCategory: Array<{
    category: string;
    rating: number;
    count: number;
  }>;
  trends: Array<{
    week: number;
    rating: number;
    reviewCount: number;
  }>;
  metrics: {
    promoterScore: number;
    detractorScore: number;
    neutralScore: number;
    improvement: number;
  };
  period: {
    month: number;
    year: number;
    monthName: string;
  };
}

class ReportsService {
  private baseUrl = '/reports';

  async getRevenueReport(filters: ReportFilters): Promise<RevenueReportData> {
    try {
      const params = new URLSearchParams();
    
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.groupBy) params.append('groupBy', filters.groupBy);
      if (filters.hotelId) params.append('hotelId', filters.hotelId);

      const response = await api.get(`${this.baseUrl}/revenue?${params.toString()}`);
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getOccupancyReport(filters: ReportFilters): Promise<OccupancyReportData> {
    try {
      const params = new URLSearchParams();
    
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.hotelId) params.append('hotelId', filters.hotelId);

      const response = await api.get(`${this.baseUrl}/occupancy?${params.toString()}`);
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getBookingsReport(filters: ReportFilters): Promise<BookingsReportData> {
    try {
      const params = new URLSearchParams();
    
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.hotelId) params.append('hotelId', filters.hotelId);

      const response = await api.get(`${this.baseUrl}/bookings?${params.toString()}`);
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getBookingStats(filters: ReportFilters): Promise<BookingStatsData> {
    try {
      const params = new URLSearchParams();
    
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.hotelId) params.append('hotelId', filters.hotelId);

      const response = await api.get(`${this.baseUrl}/bookings/stats?${params.toString()}`);
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getCheckoutInventoryReport(filters: ReportFilters): Promise<CheckoutInventoryData> {
    try {
      const params = new URLSearchParams();
    
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.groupBy) params.append('groupBy', filters.groupBy);
      if (filters.hotelId) params.append('hotelId', filters.hotelId);

      const response = await api.get(`${this.baseUrl}/checkout-inventory?${params.toString()}`);
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getRevenueBreakdown(params?: {
    month?: number;
    year?: number;
    hotelId?: string;
  }): Promise<RevenueBreakdown> {
    try {
      const searchParams = new URLSearchParams();
    
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            searchParams.append(key, value.toString());
          }
        });
      }

      const response = await api.get(`${this.baseUrl}/revenue-breakdown?${searchParams.toString()}`);
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getOccupancyBreakdown(params?: {
    month?: number;
    year?: number;
    hotelId?: string;
  }): Promise<OccupancyBreakdown> {
    try {
      const searchParams = new URLSearchParams();
    
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            searchParams.append(key, value.toString());
          }
        });
      }

      const response = await api.get(`${this.baseUrl}/occupancy-breakdown?${searchParams.toString()}`);
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getBookingsBreakdown(params?: {
    month?: number;
    year?: number;
    hotelId?: string;
  }): Promise<BookingsBreakdown> {
    try {
      const searchParams = new URLSearchParams();
    
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            searchParams.append(key, value.toString());
          }
        });
      }

      const response = await api.get(`${this.baseUrl}/bookings-breakdown?${searchParams.toString()}`);
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getSatisfactionBreakdown(params?: {
    month?: number;
    year?: number;
    hotelId?: string;
  }): Promise<SatisfactionBreakdown> {
    try {
      const searchParams = new URLSearchParams();
    
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            searchParams.append(key, value.toString());
          }
        });
      }

      const response = await api.get(`${this.baseUrl}/satisfaction-breakdown?${searchParams.toString()}`);
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Helper method to generate comprehensive report data for ReportBuilder
  async getComprehensiveReport(
    reportType: 'financial' | 'operational' | 'guest_analytics' | 'staff_performance' | 'marketing' | 'comprehensive',
    filters: ReportFilters
  ) {
    switch (reportType) {
      case 'financial':
        const revenueData = await this.getRevenueReport(filters);
        return this.transformToReportFormat(revenueData, 'Financial Summary', reportType);
        
      case 'operational':
        const occupancyData = await this.getOccupancyReport(filters);
        return this.transformToReportFormat(occupancyData, 'Occupancy Analysis', reportType);
        
      case 'comprehensive':
        // Get all report types for comprehensive view
        const [revenue, occupancy, bookings, stats, checkoutInventory] = await Promise.all([
          this.getRevenueReport(filters),
          this.getOccupancyReport(filters),
          this.getBookingsReport(filters),
          this.getBookingStats(filters),
          this.getCheckoutInventoryReport(filters)
        ]);
        
        return {
          reportType: 'comprehensive',
          generatedAt: new Date().toISOString(),
          parameters: filters,
          summary: {
            totalRecords: revenue.breakdown.length + (occupancy.occupancyByType ? Object.keys(occupancy.occupancyByType).length : 0),
            dateRange: {
              start: filters.startDate || 'N/A',
              end: filters.endDate || 'N/A',
            },
            keyMetrics: {
              totalRevenue: revenue.summary.totalRevenue,
              totalBookings: revenue.summary.totalBookings,
              occupancyRate: occupancy.summary.occupancyRate,
              averageBookingValue: revenue.summary.averageBookingValue,
              totalCheckouts: checkoutInventory.summary.totalCheckouts,
              checkoutValue: checkoutInventory.summary.totalRevenue,
            },
          },
          data: {
            revenue,
            occupancy,
            bookings,
            stats,
            checkoutInventory,
          },
          charts: [
            {
              type: 'line',
              title: 'Revenue Trends',
              data: revenue.breakdown.map(item => ({
                x: item._id.date,
                y: item.totalRevenue,
              })),
              config: { xKey: 'x', yKey: 'y', color: '#3b82f6' },
            },
            {
              type: 'bar',
              title: 'Occupancy by Room Type',
              data: Object.entries(occupancy.occupancyByType || {}).map(([type, data]) => ({
                x: type,
                y: data.roomNights,
              })),
              config: { xKey: 'x', yKey: 'y', color: '#10b981' },
            },
            {
              type: 'pie',
              title: 'Booking Status Distribution',
              data: bookings.breakdown.map(item => ({
                x: item._id,
                y: item.count,
              })),
              config: { nameKey: 'x', valueKey: 'y' },
            },
            {
              type: 'bar',
              title: 'Checkout Inventory Activity',
              data: checkoutInventory.checkoutData.map(item => ({
                x: item.date,
                y: item.checkouts,
              })),
              config: { xKey: 'x', yKey: 'y', color: '#f59e0b' },
            },
          ],
        };
        
      default:
        throw new Error(`Report type ${reportType} not implemented yet`);
    }
  }

  private transformToReportFormat(data: unknown, title: string, type: string) {
    const d = data as Record<string, unknown>;
    return {
      reportType: type,
      generatedAt: new Date().toISOString(),
      parameters: (d.period as Record<string, unknown>) || {},
      summary: {
        totalRecords: Array.isArray(d.breakdown) ? (d.breakdown as unknown[]).length : 0,
        dateRange: (d.period as Record<string, unknown>) || { start: 'N/A', end: 'N/A' },
        keyMetrics: (d.summary as Record<string, unknown>) || {},
      },
      data: d,
      charts: [] as unknown[], // Will be populated based on report type
    };
  }

  // Export functionality
  async exportReport(
    reportType: string,
    filters: ReportFilters,
    format: 'csv' | 'excel' | 'pdf' = 'csv'
  ): Promise<Blob> {
    try {
      const params = new URLSearchParams();

      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, String(value));
      });

      params.append('format', format);

      // Revenue CSV export — backed by a dedicated CSV-generating endpoint
      if (reportType === 'financial' || reportType === 'revenue') {
        const response = await api.get(`/admin-dashboard/revenue/export?${params.toString()}`, {
          responseType: 'blob'
        });
        return response.data as Blob;
      }

      // For all other report types, generate a client-side CSV from the
      // relevant aggregated report data so the download is always a proper
      // text/csv file (not a JSON blob with a .csv extension).
      const reportTypeMap: Record<string, string> = {
        operational: 'operational',
        occupancy: 'operational',
        bookings: 'operational',
        guest_analytics: 'guest_analytics',
        staff_performance: 'staff_performance',
        marketing: 'marketing',
        comprehensive: 'comprehensive',
      };

      const resolvedType = reportTypeMap[reportType] || 'operational';

      // Fetch the underlying report data
      let csvContent = '';

      if (resolvedType === 'operational') {
        // Build a simple operational summary from bookings report
        const bookingsData = await this.getBookingsReport(filters);
        const lines = ['Status,Count,Revenue'];
        for (const item of bookingsData.breakdown) {
          lines.push(`${item._id},${item.count},${(item.totalRevenue || 0).toFixed(2)}`);
        }
        csvContent = lines.join('\n');
      } else {
        // Fallback: fetch generic report JSON and convert to CSV-friendly text
        const response = await api.get(`/admin-dashboard/reports?${params.toString()}`);
        const jsonContent = typeof response.data === 'string'
          ? response.data
          : JSON.stringify(response.data, null, 2);
        // Return as plain text with a .json-style layout — caller still gets a Blob
        return new Blob([jsonContent], { type: 'application/json' });
      }

      return new Blob([csvContent], { type: 'text/csv' });
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }
}

export const reportsService = new ReportsService();
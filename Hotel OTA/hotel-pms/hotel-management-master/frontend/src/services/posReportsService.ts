import { api } from './api';

// Type Definitions for POS Reports
export interface POSReportDateRange {
  startDate: string;
  endDate: string;
  groupBy?: 'day' | 'week' | 'month';
}

export interface PaymentBreakdownItem {
  method: string;
  amount: number;
  count: number;
}

export interface SalesSummaryItem {
  date: string;
  totalSales: number;
  transactionCount: number;
  averageTransactionValue: number;
  totalTax: number;
  totalDiscount: number;
  paymentBreakdown: PaymentBreakdownItem[];
}

export interface SalesSummaryResponse {
  status: string;
  data: {
    summary: {
      totalSales: number;
      totalTransactions: number;
      totalTax: number;
      totalDiscount: number;
      averageTransactionValue: number;
    };
    breakdown: SalesSummaryItem[];
    period: POSReportDateRange;
  };
}

export interface OutletPerformanceItem {
  outlet: string;
  outletType: string;
  location: string;
  outletId: string;
  totalRevenue: number;
  totalItems: number;
  transactionCount: number;
  averageItemPrice: number;
  totalTax: number;
  averageTransactionValue: number;
  revenuePercentage: string;
}

export interface OutletPerformanceResponse {
  status: string;
  data: {
    outlets: OutletPerformanceItem[];
    summary: {
      totalRevenue: number;
      totalOutlets: number;
      topPerformer: string | null;
    };
    period: POSReportDateRange;
  };
}

export interface TransactionItem {
  sessionId: string;
  guestName: string;
  roomNumber: string;
  items: Array<{
    itemId: string;
    name: string;
    category: string;
    price: number;
    outlet: string;
    quantity: number;
    tax: number;
  }>;
  subtotal: number;
  totalTax: number;
  totalDiscount: number;
  grandTotal: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
  paidAt: string;
  notes?: string;
  staffName: string;
}

export interface TransactionHistoryResponse {
  status: string;
  data: {
    transactions: TransactionItem[];
    pagination: {
      current: number;
      pages: number;
      total: number;
      limit: number;
    };
    filters: {
      startDate?: string;
      endDate?: string;
      status?: string;
      paymentMethod?: string;
      outlet?: string;
    };
  };
}

export interface PaymentMethodItem {
  method: string;
  totalAmount: number;
  transactionCount: number;
  averageTransactionValue: number;
  totalTax: number;
  revenuePercentage: string;
  transactionPercentage: string;
}

export interface PaymentMethodsResponse {
  status: string;
  data: {
    paymentMethods: PaymentMethodItem[];
    summary: {
      totalRevenue: number;
      totalTransactions: number;
      averageTransactionValue: number;
    };
    period: POSReportDateRange;
  };
}

export interface TopItemsItem {
  name: string;
  category: string;
  outlet: string;
  totalQuantity: number;
  totalRevenue: number;
  averagePrice: number;
  totalTax: number;
  orderCount: number;
  rank: number;
  revenuePercentage: string;
}

export interface TopItemsResponse {
  status: string;
  data: {
    items: TopItemsItem[];
    summary: {
      totalUniqueItems: number;
      totalRevenue: number;
    };
    period: POSReportDateRange;
  };
}

export interface StaffPerformanceItem {
  _id: string;
  staffName: string;
  staffEmail: string;
  transactionCount: number;
  totalRevenue: number;
  averageTransactionValue: number;
  totalItemsSold: number;
  rank: number;
  revenuePercentage: string;
  transactionPercentage: string;
}

export interface StaffPerformanceResponse {
  status: string;
  data: {
    staff: StaffPerformanceItem[];
    summary: {
      totalStaff: number;
      totalRevenue: number;
      totalTransactions: number;
      averageRevenuePerStaff: number;
    };
    period: POSReportDateRange;
  };
}

export interface GuestAnalyticsItem {
  guestName: string;
  roomNumber: string;
  totalSpent: number;
  transactionCount: number;
  averageTransactionValue: number;
  totalItemsPurchased: number;
  paymentMethods: string[];
  lastTransaction: string;
  roomCharges: number;
  roomChargePercentage: number;
  rank: number;
  spendingPercentage: string;
}

export interface GuestAnalyticsResponse {
  status: string;
  data: {
    guests: GuestAnalyticsItem[];
    summary: {
      totalGuests: number;
      totalRevenue: number;
      averageSpendPerGuest: number;
      totalRoomCharges: number;
    };
    period: POSReportDateRange;
  };
}

export interface HourlyAnalysis {
  hour: number;
  hourFormatted: string;
  transactionCount: number;
  totalRevenue: number;
  averageTransactionValue: number;
}

export interface DailyAnalysis {
  dayOfWeek: number;
  dayName: string;
  transactionCount: number;
  totalRevenue: number;
}

export interface PeakHoursInsight {
  hour: number;
  hourFormatted: string;
  transactions: number;
}

export interface PeakDayInsight {
  dayOfWeek: number;
  dayName: string;
  transactions: number;
}

export interface PeakHoursResponse {
  status: string;
  data: {
    hourlyAnalysis: HourlyAnalysis[];
    dailyAnalysis: DailyAnalysis[];
    insights: {
      peakHour: PeakHoursInsight;
      peakDay: PeakDayInsight;
    };
    period: POSReportDateRange;
  };
}

// Service class for POS Reports
class POSReportsService {
  private baseUrl = '/pos/reports';

  // Get sales summary report
  async getSalesSummary(params: {
    startDate: string;
    endDate: string;
    groupBy?: 'day' | 'week' | 'month';
    hotelId?: string;
  }): Promise<SalesSummaryResponse> {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('startDate', params.startDate);
      queryParams.append('endDate', params.endDate);
      if (params.groupBy) queryParams.append('groupBy', params.groupBy);
      if (params.hotelId) queryParams.append('hotelId', params.hotelId);

      const response = await api.get(`${this.baseUrl}/sales-summary?${queryParams.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Get outlet performance report
  async getOutletPerformance(params: {
    startDate: string;
    endDate: string;
    hotelId?: string;
  }): Promise<OutletPerformanceResponse> {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('startDate', params.startDate);
      queryParams.append('endDate', params.endDate);
      if (params.hotelId) queryParams.append('hotelId', params.hotelId);

      const response = await api.get(`${this.baseUrl}/outlet-performance?${queryParams.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Get transaction history report
  async getTransactionHistory(params: {
    startDate?: string;
    endDate?: string;
    status?: string;
    paymentMethod?: string;
    outlet?: string;
    page?: number;
    limit?: number;
    hotelId?: string;
  }): Promise<TransactionHistoryResponse> {
    try {
      const queryParams = new URLSearchParams();
      if (params.startDate) queryParams.append('startDate', params.startDate);
      if (params.endDate) queryParams.append('endDate', params.endDate);
      if (params.status) queryParams.append('status', params.status);
      if (params.paymentMethod) queryParams.append('paymentMethod', params.paymentMethod);
      if (params.outlet) queryParams.append('outlet', params.outlet);
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.limit) queryParams.append('limit', params.limit.toString());
      if (params.hotelId) queryParams.append('hotelId', params.hotelId);

      const response = await api.get(`${this.baseUrl}/transaction-history?${queryParams.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Get payment methods analysis
  async getPaymentMethods(params: {
    startDate: string;
    endDate: string;
    hotelId?: string;
  }): Promise<PaymentMethodsResponse> {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('startDate', params.startDate);
      queryParams.append('endDate', params.endDate);
      if (params.hotelId) queryParams.append('hotelId', params.hotelId);

      const response = await api.get(`${this.baseUrl}/payment-methods?${queryParams.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Get top items report
  async getTopItems(params: {
    startDate: string;
    endDate: string;
    limit?: number;
    hotelId?: string;
  }): Promise<TopItemsResponse> {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('startDate', params.startDate);
      queryParams.append('endDate', params.endDate);
      if (params.limit) queryParams.append('limit', params.limit.toString());
      if (params.hotelId) queryParams.append('hotelId', params.hotelId);

      const response = await api.get(`${this.baseUrl}/top-items?${queryParams.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Get staff performance report
  async getStaffPerformance(params: {
    startDate: string;
    endDate: string;
    hotelId?: string;
  }): Promise<StaffPerformanceResponse> {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('startDate', params.startDate);
      queryParams.append('endDate', params.endDate);
      if (params.hotelId) queryParams.append('hotelId', params.hotelId);

      const response = await api.get(`${this.baseUrl}/staff-performance?${queryParams.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Get guest analytics report
  async getGuestAnalytics(params: {
    startDate: string;
    endDate: string;
    limit?: number;
    hotelId?: string;
  }): Promise<GuestAnalyticsResponse> {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('startDate', params.startDate);
      queryParams.append('endDate', params.endDate);
      if (params.limit) queryParams.append('limit', params.limit.toString());
      if (params.hotelId) queryParams.append('hotelId', params.hotelId);

      const response = await api.get(`${this.baseUrl}/guest-analytics?${queryParams.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Get peak hours analysis
  async getPeakHours(params: {
    startDate: string;
    endDate: string;
    hotelId?: string;
  }): Promise<PeakHoursResponse> {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('startDate', params.startDate);
      queryParams.append('endDate', params.endDate);
      if (params.hotelId) queryParams.append('hotelId', params.hotelId);

      const response = await api.get(`${this.baseUrl}/peak-hours?${queryParams.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Utility function to get date ranges
  getDateRanges() {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const last7Days = new Date(today);
    last7Days.setDate(last7Days.getDate() - 7);
    
    const last30Days = new Date(today);
    last30Days.setDate(last30Days.getDate() - 30);
    
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

    const formatDate = (date: Date) => date.toISOString().split('T')[0];

    return {
      today: {
        startDate: formatDate(today),
        endDate: formatDate(today)
      },
      yesterday: {
        startDate: formatDate(yesterday),
        endDate: formatDate(yesterday)
      },
      last7Days: {
        startDate: formatDate(last7Days),
        endDate: formatDate(today)
      },
      last30Days: {
        startDate: formatDate(last30Days),
        endDate: formatDate(today)
      },
      thisMonth: {
        startDate: formatDate(thisMonth),
        endDate: formatDate(today)
      },
      lastMonth: {
        startDate: formatDate(lastMonth),
        endDate: formatDate(lastMonthEnd)
      }
    };
  }

  // Format currency utility
  formatCurrency(amount: number | undefined | null): string {
    const num = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(num);
  }

  // Format percentage utility
  formatPercentage(value: number): string {
    return `${parseFloat(value.toFixed(1))}%`;
  }
}

export const posReportsService = new POSReportsService();
export default posReportsService;
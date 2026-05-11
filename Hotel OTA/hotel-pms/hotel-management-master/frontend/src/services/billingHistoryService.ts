import { api } from './api';

export interface BillingHistoryItem {
  id: string;
  type: 'invoice' | 'payment' | 'refund' | 'booking' | 'checkout_charges';
  subType: string;
  date: string;
  amount: number;
  status: string;
  description: string;
  bookingId?: string;
  bookingNumber?: string;
  guestName?: string;
  guestEmail?: string;
  hotelName?: string;
  invoiceNumber?: string;
  paymentMethod?: string;
  currency?: string;
  transactionId?: string;
  refundReason?: string;
  refundId?: string;
  originalTransactionId?: string;
  amountPaid?: number;
  amountRemaining?: number;
  itemCount?: number;
  // New booking-specific fields
  checkIn?: string;
  checkOut?: string;
  nights?: number;
  paymentStatus?: string;
  roomCount?: number;
}

export interface BillingHistorySummary {
  totalTransactions: number;
  totalAmount: number;
  invoiceCount: number;
  paymentCount: number;
  refundCount: number;
  bookingCount: number;
  checkoutChargeCount: number;
  totalInvoiceAmount: number;
  totalPaymentAmount: number;
  totalRefundAmount: number;
  totalBookingAmount: number;
  totalCheckoutChargeAmount: number;
  /** Present when summary is computed from a capped result set (subQueryLimit hit) */
  note?: string;
}

export interface BillingHistoryResponse {
  status: string;
  data: {
    history: BillingHistoryItem[];
    summary: BillingHistorySummary;
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
}

export interface BillingHistoryFilters {
  page?: number;
  limit?: number;
  type?: 'all' | 'invoice' | 'payment' | 'refund' | 'booking' | 'checkout_charges';
  status?: string;
  startDate?: string;
  endDate?: string;
  guestId?: string;
  hotelId?: string;
  search?: string;
}

export interface BillingStats {
  period: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  invoices: Array<{
    _id: { status: string; type: string };
    count: number;
    totalAmount: number;
    averageAmount: number;
  }>;
  payments: Array<{
    _id: { status: string; method: string };
    count: number;
    totalAmount: number;
    averageAmount: number;
  }>;
  refunds: {
    totalRefunds: number;
    totalRefundAmount: number;
    averageRefundAmount: number;
  };
  revenueTrend: Array<{
    _id: { date: string };
    revenue: number;
    transactionCount: number;
  }>;
}

export interface BillingStatsResponse {
  status: string;
  data: BillingStats;
}

export interface ExportData {
  format: string;
  totalRecords: number;
  exportData: Array<{
    type: string;
    date: string;
    [key: string]: unknown;
  }>;
  generatedAt: string;
}

export interface ExportResponse {
  status: string;
  data: ExportData;
}

class BillingHistoryService {
  /**
   * Get comprehensive billing history (invoices, transactions, refunds)
   */
  async getBillingHistory(filters: BillingHistoryFilters = {}): Promise<BillingHistoryResponse> {
    try {
      const params = new URLSearchParams();
    
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, value.toString());
        }
      });

      const response = await api.get(`/billing-history?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get billing history statistics and analytics
   */
  async getBillingStats(period: 'week' | 'month' | 'quarter' | 'year' = 'month', hotelId?: string): Promise<BillingStatsResponse> {
    try {
      const params = new URLSearchParams({ period });
      if (hotelId) {
        params.append('hotelId', hotelId);
      }

      const response = await api.get(`/billing-history/stats?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Export billing history data
   */
  async exportBillingHistory(
    format: 'csv' | 'excel' | 'pdf' = 'csv',
    filters: {
      startDate?: string;
      endDate?: string;
      type?: 'all' | 'invoice' | 'payment' | 'refund' | 'booking' | 'checkout_charges';
      hotelId?: string;
    } = {}
  ): Promise<ExportResponse> {
    try {
      const params = new URLSearchParams({ format });
    
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, value.toString());
        }
      });

      const response = await api.get(`/billing-history/export?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get invoice details by ID
   */
  async getInvoiceDetails(invoiceId: string) {
    try {
      const response = await api.get(`/invoices/${invoiceId}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Add payment to invoice
   */
  async addInvoicePayment(invoiceId: string, paymentData: {
    amount: number;
    method: string;
    transactionId?: string;
    notes?: string;
  }) {
    try {
      const response = await api.post(`/invoices/${invoiceId}/payments`, paymentData);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Add discount to invoice
   */
  async addInvoiceDiscount(invoiceId: string, discountData: {
    description: string;
    type: 'percentage' | 'fixed_amount' | 'loyalty_points';
    value: number;
  }) {
    try {
      const response = await api.post(`/invoices/${invoiceId}/discounts`, discountData);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Create refund for a payment
   */
  async createRefund(refundData: {
    paymentIntentId: string;
    amount?: number;
    reason?: string;
  }) {
    try {
      const response = await api.post('/payments/refund', refundData);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  /**
   * Get payment details by payment intent ID
   */
  async getPaymentByIntentId(paymentIntentId: string) {
    try {
      const response = await api.get(`/payments/intent/${encodeURIComponent(paymentIntentId)}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Failed to look up payment by intent ID');
    }
  }

  /**
   * Get recent billing activity for dashboard
   */
  async getRecentActivity(limit: number = 10, hotelId?: string): Promise<BillingHistoryResponse> {
    return this.getBillingHistory({
      limit,
      hotelId,
      page: 1
    });
  }

  /**
   * Get billing history for a specific guest
   */
  async getGuestBillingHistory(guestId?: string, filters: BillingHistoryFilters = {}): Promise<BillingHistoryResponse> {
    return this.getBillingHistory({
      ...filters,
      guestId
    });
  }

  /**
   * Search billing history
   */
  async searchBillingHistory(query: string, filters: BillingHistoryFilters = {}): Promise<BillingHistoryResponse> {
    return this.getBillingHistory({
      ...filters,
      search: query
    });
  }

  /**
   * Download export file (for CSV/Excel formats)
   */
  downloadExportFile(exportData: ExportData, filename?: string) {
    const csvContent = this.convertToCSV(exportData.exportData);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename || `billing-history-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  /**
   * Convert data to CSV format
   */
  private convertToCSV(data: unknown[]): string {
    if (!data || data.length === 0 || !data[0]) return '';

    const headers = Object.keys(data[0] as Record<string, unknown>);
    const csvHeaders = headers.join(',');

    const csvRows = data.map(row => {
      const record = row as Record<string, unknown>;
      return headers.map(header => {
        const value = record[header];
        if (value === null || value === undefined) return '';
        const strValue = String(value);
        // Handle values that might contain commas, quotes, or newlines
        if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
          return `"${strValue.replace(/"/g, '""')}"`;
        }
        return strValue;
      }).join(',');
    });

    return [csvHeaders, ...csvRows].join('\n');
  }

  /**
   * Format currency amount
   */
  formatCurrency(amount: number, currency: string = 'INR'): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount);
  }

  /**
   * Format date for display
   */
  formatDate(date: string | Date, includeTime: boolean = true): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (includeTime) {
      return dateObj.toLocaleString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    
    return dateObj.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  /**
   * Get status badge variant for UI (maps to Badge component variants:
   * 'default' | 'success' | 'warning' | 'error' | 'info' | 'secondary' | 'outline' | 'destructive')
   */
  getStatusColor(status: string, type: string): 'success' | 'warning' | 'error' | 'info' | 'secondary' | 'default' {
    switch (type) {
      case 'invoice':
        switch (status) {
          case 'paid': return 'success';
          case 'issued': return 'info';
          case 'partially_paid': return 'warning';
          case 'overdue': return 'error';
          case 'draft': return 'secondary';
          case 'cancelled': return 'error';
          default: return 'default';
        }
      case 'payment':
        switch (status) {
          case 'succeeded': return 'success';
          case 'pending': return 'warning';
          case 'failed': return 'error';
          case 'canceled': return 'secondary';
          case 'refunded': return 'info';
          case 'partially_refunded': return 'warning';
          default: return 'default';
        }
      case 'refund':
        return 'info';
      case 'booking':
        switch (status) {
          case 'confirmed': return 'success';
          case 'checked_in': return 'info';
          case 'checked_out': return 'secondary';
          case 'cancelled': return 'error';
          case 'pending': return 'warning';
          case 'no_show': return 'error';
          default: return 'default';
        }
      case 'checkout_charges':
        switch (status) {
          case 'paid': return 'success';
          case 'pending': return 'warning';
          case 'failed': return 'error';
          default: return 'default';
        }
      default:
        return 'default';
    }
  }

  /**
   * Get type icon for UI
   */
  getTypeIcon(type: string): string {
    switch (type) {
      case 'invoice': return '📄';
      case 'payment': return '💳';
      case 'refund': return '↩️';
      case 'booking': return '🏨';
      case 'checkout_charges': return '🧾';
      default: return '📋';
    }
  }
}

export const billingHistoryService = new BillingHistoryService();
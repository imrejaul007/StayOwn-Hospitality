import { api } from './api';

interface ApiResponse<T> {
  status: string;
  data: T;
  results?: number;
  pagination?: {
    current: number;
    pages: number;
    total: number;
  };
}

export interface CorporateCompany {
  _id: string;
  name: string;
  email: string;
  phone: string;
  address: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    country: string;
  };
  gstNumber: string;
  creditLimit: number;
  availableCredit: number;
  paymentTerms: number;
  isActive: boolean;
  hrContacts: Array<{
    name: string;
    email: string;
    phone?: string;
    designation?: string;
    isPrimary: boolean;
  }>;
  metadata: {
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
    lastModifiedBy?: string;
  };
}

export interface CorporateCredit {
  _id: string;
  corporateCompanyId: string;
  transactionType: 'credit' | 'debit' | 'booking' | 'adjustment';
  amount: number;
  balance: number;
  description: string;
  status: 'pending' | 'processed' | 'failed';
  dueDate?: Date;
  bookingId?: string;
  metadata: {
    createdAt: Date;
    createdBy: string;
    source: string;
  };
}

export interface CorporateDashboardMetrics {
  overview: {
    totalCompanies: number;
    totalCreditLimit: number;
    totalUsedCredit: number;
    totalAvailableCredit: number;
    companiesWithActiveCredit: number;
    averageUtilization: number;
    lowCreditAlerts: number;
    recentTransactions: number;
  };
  monthlyUsage: Array<{
    _id: {
      year: number;
      month: number;
    };
    totalAmount: number;
    transactionCount: number;
  }>;
  companyPerformance: Array<{
    _id: string;
    name: string;
    creditLimit: number;
    availableCredit: number;
    usedCredit: number;
    utilizationRate: number;
  }>;
  utilizationDistribution: Array<{
    _id: string;
    count: number;
    totalCreditLimit: number;
    totalUsedCredit: number;
  }>;
  lastUpdated: Date;
}

class CorporateService {
  // Dashboard Metrics
  async getDashboardMetrics(): Promise<ApiResponse<CorporateDashboardMetrics>> {
    try {
      const response = await api.get('/corporate/dashboard/metrics');
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Corporate Companies
  async getAllCompanies(filters: Record<string, unknown> = {}): Promise<ApiResponse<{ companies: CorporateCompany[] }>> {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });

      const response = await api.get(`/corporate/companies?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getCompany(id: string): Promise<ApiResponse<{ company: CorporateCompany }>> {
    try {
      const response = await api.get(`/corporate/companies/${id}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async createCompany(companyData: Partial<CorporateCompany>): Promise<ApiResponse<{ company: CorporateCompany }>> {
    try {
      const response = await api.post('/corporate/companies', companyData);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async updateCompany(id: string, updates: Partial<CorporateCompany>): Promise<ApiResponse<{ company: CorporateCompany }>> {
    try {
      const response = await api.patch(`/corporate/companies/${id}`, updates);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async deleteCompany(id: string): Promise<ApiResponse<null>> {
    try {
      const response = await api.delete(`/corporate/companies/${id}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getLowCreditCompanies(threshold?: number): Promise<ApiResponse<{ companies: CorporateCompany[]; threshold: number }>> {
    try {
      const params = new URLSearchParams();
      if (threshold) {
        params.append('threshold', threshold.toString());
      }

      const response = await api.get(`/corporate/companies/low-credit?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async updateCompanyCredit(id: string, amount: number, description?: string): Promise<ApiResponse<{ company: unknown }>> {
    try {
      const response = await api.patch(`/corporate/companies/${id}/update-credit`, {
        amount,
        description
      });
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getCompanyCreditSummary(id: string): Promise<ApiResponse<{ company: unknown; creditSummary: unknown }>> {
    try {
      const response = await api.get(`/corporate/companies/${id}/credit-summary`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getCompanyBookings(id: string, filters: Record<string, unknown> = {}): Promise<ApiResponse<{ bookings: unknown[] }>> {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });

      const response = await api.get(`/corporate/companies/${id}/bookings?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Credit Transactions
  async getAllCreditTransactions(filters: Record<string, unknown> = {}): Promise<ApiResponse<{ transactions: CorporateCredit[] }>> {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });

      const response = await api.get(`/corporate/credit/transactions?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getCreditTransaction(id: string): Promise<ApiResponse<{ transaction: CorporateCredit }>> {
    try {
      const response = await api.get(`/corporate/credit/transactions/${id}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async createCreditTransaction(transactionData: Partial<CorporateCredit>): Promise<ApiResponse<{ transaction: CorporateCredit }>> {
    try {
      const response = await api.post('/corporate/credit/transactions', transactionData);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async approveCreditTransaction(id: string): Promise<ApiResponse<{ transaction: CorporateCredit }>> {
    try {
      const response = await api.patch(`/corporate/credit/transactions/${id}/approve`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async rejectCreditTransaction(id: string, reason?: string): Promise<ApiResponse<{ transaction: CorporateCredit }>> {
    try {
      const response = await api.patch(`/corporate/credit/transactions/${id}/reject`, { reason });
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getOverdueTransactions(filters: Record<string, unknown> = {}): Promise<ApiResponse<{ transactions: CorporateCredit[] }>> {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });

      const response = await api.get(`/corporate/credit/overdue?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getMonthlyCreditReport(filters: Record<string, unknown> = {}): Promise<ApiResponse<unknown>> {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });

      const response = await api.get(`/corporate/credit/monthly-report?${params.toString()}`);
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async bulkApproveCreditTransactions(transactionIds: string[]): Promise<ApiResponse<{ approved: string[]; failed: string[] }>> {
    try {
      const response = await api.patch('/corporate/credit/bulk-approve', { transactionIds });
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  async getCreditAnalysis(): Promise<ApiResponse<unknown>> {
    try {
      const response = await api.get('/corporate/admin/credit-analysis');
      return response.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }
}

export const corporateService = new CorporateService();
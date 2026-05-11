import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { corporateService } from './corporateService';
import { api } from './api';

// Mock the api module
vi.mock('./api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockApi = api as any;

describe('CorporateService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Dashboard Metrics', () => {
    test('getDashboardMetrics calls correct endpoint', async () => {
      const mockResponse = {
        data: {
          status: 'success',
          data: {
            overview: {
              totalCompanies: 5,
              totalCreditLimit: 100000,
              totalUsedCredit: 25000,
              totalAvailableCredit: 75000,
              companiesWithActiveCredit: 3,
              averageUtilization: 25,
              lowCreditAlerts: 1,
              recentTransactions: 10,
            },
          },
        },
      };

      mockApi.get.mockResolvedValue(mockResponse);

      const result = await corporateService.getDashboardMetrics();

      expect(mockApi.get).toHaveBeenCalledWith('/corporate/dashboard/metrics');
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('Corporate Companies', () => {
    test('getAllCompanies without filters', async () => {
      const mockResponse = {
        data: {
          status: 'success',
          data: {
            companies: [
              {
                _id: 'comp1',
                name: 'Test Company',
                email: 'test@company.com',
                creditLimit: 50000,
                availableCredit: 45000,
              },
            ],
          },
        },
      };

      mockApi.get.mockResolvedValue(mockResponse);

      const result = await corporateService.getAllCompanies();

      expect(mockApi.get).toHaveBeenCalledWith('/corporate/companies?');
      expect(result).toEqual(mockResponse.data);
    });

    test('getAllCompanies with filters', async () => {
      const filters = { isActive: true, creditLimit: 10000 };
      const mockResponse = { data: { status: 'success', data: { companies: [] } } };

      mockApi.get.mockResolvedValue(mockResponse);

      await corporateService.getAllCompanies(filters);

      expect(mockApi.get).toHaveBeenCalledWith('/corporate/companies?isActive=true&creditLimit=10000');
    });

    test('getCompany by ID', async () => {
      const companyId = 'comp1';
      const mockResponse = {
        data: {
          status: 'success',
          data: {
            company: {
              _id: companyId,
              name: 'Test Company',
            },
          },
        },
      };

      mockApi.get.mockResolvedValue(mockResponse);

      const result = await corporateService.getCompany(companyId);

      expect(mockApi.get).toHaveBeenCalledWith(`/corporate/companies/${companyId}`);
      expect(result).toEqual(mockResponse.data);
    });

    test('createCompany', async () => {
      const companyData = {
        name: 'New Company',
        email: 'new@company.com',
        creditLimit: 30000,
      };
      const mockResponse = {
        data: {
          status: 'success',
          data: { company: { _id: 'new-comp', ...companyData } },
        },
      };

      mockApi.post.mockResolvedValue(mockResponse);

      const result = await corporateService.createCompany(companyData);

      expect(mockApi.post).toHaveBeenCalledWith('/corporate/companies', companyData);
      expect(result).toEqual(mockResponse.data);
    });

    test('updateCompany', async () => {
      const companyId = 'comp1';
      const updates = { creditLimit: 60000 };
      const mockResponse = {
        data: {
          status: 'success',
          data: { company: { _id: companyId, ...updates } },
        },
      };

      mockApi.patch.mockResolvedValue(mockResponse);

      const result = await corporateService.updateCompany(companyId, updates);

      expect(mockApi.patch).toHaveBeenCalledWith(`/corporate/companies/${companyId}`, updates);
      expect(result).toEqual(mockResponse.data);
    });

    test('deleteCompany', async () => {
      const companyId = 'comp1';
      const mockResponse = { data: { status: 'success', data: null } };

      mockApi.delete.mockResolvedValue(mockResponse);

      const result = await corporateService.deleteCompany(companyId);

      expect(mockApi.delete).toHaveBeenCalledWith(`/corporate/companies/${companyId}`);
      expect(result).toEqual(mockResponse.data);
    });

    test('getLowCreditCompanies with threshold', async () => {
      const threshold = 5000;
      const mockResponse = {
        data: {
          status: 'success',
          data: { companies: [], threshold },
        },
      };

      mockApi.get.mockResolvedValue(mockResponse);

      const result = await corporateService.getLowCreditCompanies(threshold);

      expect(mockApi.get).toHaveBeenCalledWith(`/corporate/companies/low-credit?threshold=${threshold}`);
      expect(result).toEqual(mockResponse.data);
    });

    test('updateCompanyCredit', async () => {
      const companyId = 'comp1';
      const amount = 5000;
      const description = 'Credit increase';
      const mockResponse = {
        data: {
          status: 'success',
          data: { company: { _id: companyId } },
        },
      };

      mockApi.patch.mockResolvedValue(mockResponse);

      const result = await corporateService.updateCompanyCredit(companyId, amount, description);

      expect(mockApi.patch).toHaveBeenCalledWith(`/corporate/companies/${companyId}/update-credit`, {
        amount,
        description,
      });
      expect(result).toEqual(mockResponse.data);
    });

    test('getCompanyCreditSummary', async () => {
      const companyId = 'comp1';
      const mockResponse = {
        data: {
          status: 'success',
          data: { company: {}, creditSummary: {} },
        },
      };

      mockApi.get.mockResolvedValue(mockResponse);

      const result = await corporateService.getCompanyCreditSummary(companyId);

      expect(mockApi.get).toHaveBeenCalledWith(`/corporate/companies/${companyId}/credit-summary`);
      expect(result).toEqual(mockResponse.data);
    });

    test('getCompanyBookings', async () => {
      const companyId = 'comp1';
      const filters = { status: 'confirmed' };
      const mockResponse = {
        data: {
          status: 'success',
          data: { bookings: [] },
        },
      };

      mockApi.get.mockResolvedValue(mockResponse);

      const result = await corporateService.getCompanyBookings(companyId, filters);

      expect(mockApi.get).toHaveBeenCalledWith(`/corporate/companies/${companyId}/bookings?status=confirmed`);
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('Credit Transactions', () => {
    test('getAllCreditTransactions without filters', async () => {
      const mockResponse = {
        data: {
          status: 'success',
          data: { transactions: [] },
        },
      };

      mockApi.get.mockResolvedValue(mockResponse);

      const result = await corporateService.getAllCreditTransactions();

      expect(mockApi.get).toHaveBeenCalledWith('/corporate/credit/transactions?');
      expect(result).toEqual(mockResponse.data);
    });

    test('getAllCreditTransactions with filters', async () => {
      const filters = { status: 'pending', transactionType: 'debit' };
      const mockResponse = { data: { status: 'success', data: { transactions: [] } } };

      mockApi.get.mockResolvedValue(mockResponse);

      await corporateService.getAllCreditTransactions(filters);

      expect(mockApi.get).toHaveBeenCalledWith('/corporate/credit/transactions?status=pending&transactionType=debit');
    });

    test('getCreditTransaction by ID', async () => {
      const transactionId = 'trans1';
      const mockResponse = {
        data: {
          status: 'success',
          data: { transaction: { _id: transactionId } },
        },
      };

      mockApi.get.mockResolvedValue(mockResponse);

      const result = await corporateService.getCreditTransaction(transactionId);

      expect(mockApi.get).toHaveBeenCalledWith(`/corporate/credit/transactions/${transactionId}`);
      expect(result).toEqual(mockResponse.data);
    });

    test('createCreditTransaction', async () => {
      const transactionData = {
        corporateCompanyId: 'comp1',
        amount: 5000,
        transactionType: 'debit',
        description: 'Test transaction',
      };
      const mockResponse = {
        data: {
          status: 'success',
          data: { transaction: { _id: 'trans1', ...transactionData } },
        },
      };

      mockApi.post.mockResolvedValue(mockResponse);

      const result = await corporateService.createCreditTransaction(transactionData);

      expect(mockApi.post).toHaveBeenCalledWith('/corporate/credit/transactions', transactionData);
      expect(result).toEqual(mockResponse.data);
    });

    test('approveCreditTransaction', async () => {
      const transactionId = 'trans1';
      const mockResponse = {
        data: {
          status: 'success',
          data: { transaction: { _id: transactionId, status: 'approved' } },
        },
      };

      mockApi.patch.mockResolvedValue(mockResponse);

      const result = await corporateService.approveCreditTransaction(transactionId);

      expect(mockApi.patch).toHaveBeenCalledWith(`/corporate/credit/transactions/${transactionId}/approve`);
      expect(result).toEqual(mockResponse.data);
    });

    test('rejectCreditTransaction', async () => {
      const transactionId = 'trans1';
      const reason = 'Insufficient documentation';
      const mockResponse = {
        data: {
          status: 'success',
          data: { transaction: { _id: transactionId, status: 'rejected' } },
        },
      };

      mockApi.patch.mockResolvedValue(mockResponse);

      const result = await corporateService.rejectCreditTransaction(transactionId, reason);

      expect(mockApi.patch).toHaveBeenCalledWith(`/corporate/credit/transactions/${transactionId}/reject`, { reason });
      expect(result).toEqual(mockResponse.data);
    });

    test('bulkApproveCreditTransactions', async () => {
      const transactionIds = ['trans1', 'trans2', 'trans3'];
      const mockResponse = {
        data: {
          status: 'success',
          data: { approved: ['trans1', 'trans2'], failed: ['trans3'] },
        },
      };

      mockApi.patch.mockResolvedValue(mockResponse);

      const result = await corporateService.bulkApproveCreditTransactions(transactionIds);

      expect(mockApi.patch).toHaveBeenCalledWith('/corporate/credit/bulk-approve', { transactionIds });
      expect(result).toEqual(mockResponse.data);
    });

    test('getOverdueTransactions', async () => {
      const filters = { daysOverdue: 30 };
      const mockResponse = {
        data: {
          status: 'success',
          data: { transactions: [] },
        },
      };

      mockApi.get.mockResolvedValue(mockResponse);

      const result = await corporateService.getOverdueTransactions(filters);

      expect(mockApi.get).toHaveBeenCalledWith('/corporate/credit/overdue?daysOverdue=30');
      expect(result).toEqual(mockResponse.data);
    });

    test('getMonthlyCreditReport', async () => {
      const filters = { year: 2025, month: 1 };
      const mockResponse = {
        data: {
          status: 'success',
          data: { period: { year: 2025, month: 1 }, summary: {}, companyBreakdown: [] },
        },
      };

      mockApi.get.mockResolvedValue(mockResponse);

      const result = await corporateService.getMonthlyCreditReport(filters);

      expect(mockApi.get).toHaveBeenCalledWith('/corporate/credit/monthly-report?year=2025&month=1');
      expect(result).toEqual(mockResponse.data);
    });

    test('getCreditAnalysis', async () => {
      const mockResponse = {
        data: {
          status: 'success',
          data: {
            creditUtilization: [],
            overdueAnalysis: [],
            paymentTrends: [],
            summary: {},
          },
        },
      };

      mockApi.get.mockResolvedValue(mockResponse);

      const result = await corporateService.getCreditAnalysis();

      expect(mockApi.get).toHaveBeenCalledWith('/corporate/admin/credit-analysis');
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('Error Handling', () => {
    test('handles API errors properly', async () => {
      const mockError = new Error('Network error');
      mockApi.get.mockRejectedValue(mockError);

      await expect(corporateService.getDashboardMetrics()).rejects.toThrow('Network error');
    });

    test('handles invalid filter values', async () => {
      const filters = { status: null, type: undefined };
      const mockResponse = { data: { status: 'success', data: { transactions: [] } } };

      mockApi.get.mockResolvedValue(mockResponse);

      await corporateService.getAllCreditTransactions(filters);

      // Should filter out null and undefined values
      expect(mockApi.get).toHaveBeenCalledWith('/corporate/credit/transactions?');
    });
  });

  describe('URL Parameter Building', () => {
    test('builds URL parameters correctly with multiple filters', async () => {
      const filters = {
        status: 'pending',
        transactionType: 'debit',
        companyId: 'comp1',
        amount: 5000,
        startDate: '2025-01-01',
      };
      const mockResponse = { data: { status: 'success', data: { transactions: [] } } };

      mockApi.get.mockResolvedValue(mockResponse);

      await corporateService.getAllCreditTransactions(filters);

      expect(mockApi.get).toHaveBeenCalledWith(
        '/corporate/credit/transactions?status=pending&transactionType=debit&companyId=comp1&amount=5000&startDate=2025-01-01'
      );
    });

    test('handles empty filters object', async () => {
      const mockResponse = { data: { status: 'success', data: { transactions: [] } } };

      mockApi.get.mockResolvedValue(mockResponse);

      await corporateService.getAllCreditTransactions({});

      expect(mockApi.get).toHaveBeenCalledWith('/corporate/credit/transactions?');
    });
  });
});
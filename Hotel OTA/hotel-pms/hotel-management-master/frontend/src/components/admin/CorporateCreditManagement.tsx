import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { LoadingSpinner } from '../LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '../dashboard/DataTable';
import { MetricCard } from '../dashboard/MetricCard';
import { LineChart } from '../dashboard/charts/LineChart';
import { BarChart } from '../dashboard/charts/BarChart';
import { DonutChart } from '../dashboard/charts/PieChart';
import { formatCurrency, formatDate, formatPercent } from '../../utils/formatters';
import { corporateService } from '../../services/corporateService';
import { withErrorBoundary } from '../ErrorBoundary';

interface CreditTransaction {
  _id: string;
  corporateCompanyId: {
    _id: string;
    name: string;
    email: string;
  };
  amount: number;
  transactionType: 'debit' | 'credit' | 'adjustment' | 'refund' | 'payment';
  status: 'pending' | 'approved' | 'rejected' | 'processed';
  description: string;
  dueDate?: string;
  balance: number;
  processedBy?: string;
  processedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface CorporateCompany {
  _id: string;
  name: string;
  email: string;
  phone: string;
  creditLimit: number;
  availableCredit: number;
  creditUtilizationPercentage?: number;
  outstandingBalance?: number;
}

interface CreditAnalysis {
  creditUtilization: CorporateCompany[];
  overdueAnalysis: unknown[];
  paymentTrends: unknown[];
  creditLimitDistribution: unknown[];
  summary: {
    totalCompaniesWithCredit: number;
    totalOverdueAmount: number;
    averageCreditUtilization: number;
  };
}

const CorporateCreditManagement: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState('overview');
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<CorporateCompany | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<CreditTransaction | null>(null);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<string[]>([]);
  const [filters, setFilters] = useState({
    status: 'all',
    transactionType: 'all',
    companyId: 'all'
  });

  const queryClient = useQueryClient();

  // Fetch credit transactions
  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ['creditTransactions', filters],
    queryFn: async () => {
      const filtersForApi = Object.fromEntries(
        Object.entries(filters).filter(([key, value]) => value !== 'all')
      );
      const response = await corporateService.getAllCreditTransactions(filtersForApi);
      return response.data;
    }
  });

  // Fetch companies with credit info
  const { data: companies, isLoading: companiesLoading } = useQuery({
    queryKey: ['corporateCompanies'],
    queryFn: async () => {
      const response = await corporateService.getAllCompanies();
      return response.data;
    }
  });

  // Fetch credit analysis
  const { data: creditAnalysis, isLoading: analysisLoading } = useQuery<CreditAnalysis>({
    queryKey: ['creditAnalysis'],
    queryFn: async () => {
      const response = await corporateService.getCreditAnalysis();
      return response.data;
    }
  });

  // Fetch low credit companies
  const { data: lowCreditCompanies } = useQuery({
    queryKey: ['lowCreditCompanies'],
    queryFn: async () => {
      const response = await corporateService.getLowCreditCompanies(10000);
      return response.data;
    }
  });

  // Fetch monthly credit report
  const { data: monthlyReport } = useQuery({
    queryKey: ['monthlyReport'],
    queryFn: async () => {
      const response = await corporateService.getMonthlyCreditReport();
      return response.data;
    }
  });

  // Fetch dashboard metrics
  const { data: dashboardMetrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['dashboardMetrics'],
    queryFn: async () => {
      const response = await corporateService.getDashboardMetrics();
      return response.data;
    }
  });

  // Update credit mutation
  const updateCreditMutation = useMutation({
    mutationFn: async ({ companyId, amount, description }: { companyId: string; amount: number; description: string }) => {
      const response = await corporateService.updateCompanyCredit(companyId, amount, description);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['corporateCompanies'] });
      queryClient.invalidateQueries({ queryKey: ['creditTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['creditAnalysis'] });
      toast.success('Credit updated successfully');
      setShowCreditModal(false);
      setSelectedCompany(null);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to update credit');
    }
  });

  // Approve transaction mutation
  const approveTransactionMutation = useMutation({
    mutationFn: async (transactionId: string) => {
      const response = await corporateService.approveCreditTransaction(transactionId);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creditTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['creditAnalysis'] });
      toast.success('Transaction approved successfully');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to approve transaction');
    }
  });

  // Reject transaction mutation
  const rejectTransactionMutation = useMutation({
    mutationFn: async ({ transactionId, reason }: { transactionId: string; reason: string }) => {
      const response = await corporateService.rejectCreditTransaction(transactionId, reason);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creditTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['creditAnalysis'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardMetrics'] });
      toast.success('Transaction rejected successfully');
      setShowRejectModal(false);
      setSelectedTransaction(null);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to reject transaction');
    }
  });

  // Bulk approve mutation
  const bulkApproveMutation = useMutation({
    mutationFn: async (transactionIds: string[]) => {
      const response = await corporateService.bulkApproveCreditTransactions(transactionIds);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creditTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['creditAnalysis'] });
      toast.success('Transactions approved successfully');
      setSelectedTransactionIds([]);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to bulk approve transactions');
    }
  });

  // Create credit transaction mutation
  const createTransactionMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const response = await corporateService.createCreditTransaction(data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creditTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['creditAnalysis'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardMetrics'] });
      toast.success('Transaction created successfully');
      setShowTransactionModal(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Failed to create transaction');
    }
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'processed': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case 'credit': return 'bg-green-100 text-green-800';
      case 'debit': return 'bg-red-100 text-red-800';
      case 'payment': return 'bg-blue-100 text-blue-800';
      case 'adjustment': return 'bg-orange-100 text-orange-800';
      case 'refund': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (transactionsLoading || companiesLoading || analysisLoading || metricsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }


  const transactionColumns = [
    {
      key: 'corporateCompanyId',
      header: 'Company',
      render: (value: unknown, transaction: CreditTransaction) => (
        <div className="font-medium text-gray-900">
          {transaction.corporateCompanyId?.name || 'N/A'}
        </div>
      )
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (value: number, transaction: CreditTransaction) => (
        <div className="font-semibold text-right">
          <span className={transaction.transactionType === 'debit' ? 'text-red-600' : 'text-green-600'}>
            {transaction.transactionType === 'debit' ? '-' : '+'}{formatCurrency(Math.abs(transaction.amount))}
          </span>
        </div>
      )
    },
    {
      key: 'transactionType',
      header: 'Type',
      render: (value: string, transaction: CreditTransaction) => (
        <Badge className={`${getTransactionTypeColor(transaction.transactionType)} font-medium`}>
          {transaction.transactionType.charAt(0).toUpperCase() + transaction.transactionType.slice(1)}
        </Badge>
      )
    },
    {
      key: 'status',
      header: 'Status',
      render: (value: string, transaction: CreditTransaction) => (
        <Badge className={`${getStatusColor(transaction.status)} font-medium`}>
          {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
        </Badge>
      )
    },
    {
      key: 'description',
      header: 'Description',
      render: (value: string, transaction: CreditTransaction) => (
        <div className="max-w-xs">
          <span className="text-gray-700 truncate block" title={transaction.description}>
            {transaction.description || 'N/A'}
          </span>
        </div>
      )
    },
    {
      key: 'balance',
      header: 'Balance',
      render: (value: number, transaction: CreditTransaction) => (
        <div className="font-medium text-right text-gray-900">
          {formatCurrency(transaction.balance)}
        </div>
      )
    },
    {
      key: 'createdAt',
      header: 'Date',
      render: (value: string, transaction: CreditTransaction) => (
        <div className="text-sm text-gray-600">
          {formatDate(transaction.createdAt)}
        </div>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (value: unknown, transaction: CreditTransaction) => (
        <div className="flex space-x-2">
          {transaction.status === 'pending' && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => approveTransactionMutation.mutate(transaction._id)}
                disabled={approveTransactionMutation.isPending}
                className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100 hover:border-green-300"
              >
                ✓ Approve
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedTransaction(transaction);
                  setShowRejectModal(true);
                }}
                disabled={rejectTransactionMutation.isPending}
                className="bg-red-50 border-red-200 text-red-700 hover:bg-red-100 hover:border-red-300"
              >
                ✕ Reject
              </Button>
            </>
          )}
          {transaction.status === 'processed' && (
            <span className="text-xs text-gray-500 italic">Completed</span>
          )}
          {transaction.status === 'approved' && (
            <span className="text-xs text-green-600 italic">Approved</span>
          )}
          {transaction.status === 'rejected' && (
            <span className="text-xs text-red-600 italic">Rejected</span>
          )}
        </div>
      )
    }
  ];

  const companyColumns = [
    {
      key: 'name',
      header: 'Company',
      render: (value: string, company: CorporateCompany) => company.name
    },
    {
      key: 'creditLimit',
      header: 'Credit Limit',
      render: (value: number, company: CorporateCompany) => formatCurrency(company.creditLimit)
    },
    {
      key: 'availableCredit',
      header: 'Available Credit',
      render: (value: number, company: CorporateCompany) => formatCurrency(company.availableCredit)
    },
    {
      key: 'utilization',
      header: 'Utilization',
      render: (value: unknown, company: CorporateCompany) => {
        const utilization = ((company.creditLimit - company.availableCredit) / company.creditLimit) * 100;
        return formatPercent(utilization / 100);
      }
    },
    {
      key: 'outstandingBalance',
      header: 'Outstanding',
      render: (value: number, company: CorporateCompany) => formatCurrency(company.outstandingBalance || 0)
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (value: unknown, company: CorporateCompany) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSelectedCompany(company);
            setShowCreditModal(true);
          }}
        >
          Adjust Credit
        </Button>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Corporate Credit Management</h1>
        <div className="flex space-x-3">
          {selectedTransactionIds.length > 0 && (
            <Button
              onClick={() => bulkApproveMutation.mutate(selectedTransactionIds)}
              disabled={bulkApproveMutation.isPending}
            >
              Bulk Approve ({selectedTransactionIds.length})
            </Button>
          )}
          <Button onClick={() => setShowTransactionModal(true)}>
            New Transaction
          </Button>
        </div>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="companies">Companies</TabsTrigger>
          <TabsTrigger value="analysis">Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              title="Total Credit Exposure"
              value={dashboardMetrics?.overview?.totalUsedCredit || 0}
              type="currency"
              icon="💳"
              trend={{
                value: 5.2,
                direction: "down",
                label: "vs last month"
              }}
            />
            <MetricCard
              title="Companies with Credit"
              value={dashboardMetrics?.overview?.companiesWithActiveCredit || 0}
              icon="🏢"
              trend={{
                value: 3,
                isPositive: true,
                label: "new this month"
              }}
            />
            <MetricCard
              title="Avg Utilization"
              value={dashboardMetrics?.overview?.averageUtilization || 0}
              type="percentage"
              icon="📊"
              trend={{
                value: 2.1,
                direction: "down",
                label: "vs last month"
              }}
            />
            <MetricCard
              title="Low Credit Alerts"
              value={dashboardMetrics?.overview?.lowCreditAlerts || 0}
              icon="⚠️"
              trend={{
                value: 1,
                isPositive: false,
                label: "needs attention"
              }}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Credit Utilization Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <DonutChart
                  data={creditAnalysis?.creditLimitDistribution?.map((item: Record<string, unknown>) => ({
                    name: `${item._id}`,
                    value: item.count,
                    percentage: (item.count / creditAnalysis.summary.totalCompaniesWithCredit) * 100
                  })) || []}
                  height={300}
                  centerContent={
                    <div className="text-center">
                      <div className="text-2xl font-bold">{creditAnalysis?.summary?.totalCompaniesWithCredit}</div>
                      <div className="text-sm text-gray-600">Total Companies</div>
                    </div>
                  }
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <LineChart
                  data={dashboardMetrics?.monthlyUsage?.map((item: Record<string, unknown>) => ({
                    date: `${item._id.year}-${item._id.month.toString().padStart(2, '0')}`,
                    amount: item.totalAmount || 0,
                    count: item.transactionCount || 0
                  })) || []}
                  xDataKey="date"
                  lines={[
                    {
                      dataKey: "amount",
                      name: "Payment Amount",
                      color: "#3B82F6"
                    },
                    {
                      dataKey: "count",
                      name: "Transaction Count",
                      color: "#10B981"
                    }
                  ]}
                  height={300}
                />
              </CardContent>
            </Card>
          </div>

          {lowCreditCompanies?.data?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>⚠️ Companies with Low Credit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {lowCreditCompanies.data.slice(0, 5).map((company: CorporateCompany) => (
                    <div key={company._id} className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
                      <div>
                        <div className="font-medium">{company.name}</div>
                        <div className="text-sm text-gray-600">{company.email}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-red-600">
                          {formatCurrency(company.availableCredit)}
                        </div>
                        <div className="text-sm text-gray-600">
                          of {formatCurrency(company.creditLimit)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="transactions" className="space-y-6">
          {/* Enhanced Filter Section */}
          <div className="bg-white rounded-lg border shadow-sm p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex flex-col space-y-2">
                  <label className="text-sm font-medium text-gray-700">Filter by Status</label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                    className="min-w-[140px] px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="processed">Processed</option>
                  </select>
                </div>
                <div className="flex flex-col space-y-2">
                  <label className="text-sm font-medium text-gray-700">Filter by Type</label>
                  <select
                    value={filters.transactionType}
                    onChange={(e) => setFilters(prev => ({ ...prev, transactionType: e.target.value }))}
                    className="min-w-[140px] px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                  >
                    <option value="all">All Types</option>
                    <option value="credit">Credit</option>
                    <option value="debit">Debit</option>
                    <option value="payment">Payment</option>
                    <option value="adjustment">Adjustment</option>
                    <option value="refund">Refund</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex flex-col items-end">
                  <span className="text-sm text-gray-600">
                    {transactions?.transactions?.length || 0} transactions
                  </span>
                  {(filters.status !== 'all' || filters.transactionType !== 'all') && (
                    <div className="flex gap-2 mt-1">
                      {filters.status !== 'all' && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          Status: {filters.status}
                        </span>
                      )}
                      {filters.transactionType !== 'all' && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          Type: {filters.transactionType}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {selectedTransactionIds.length > 0 && (
                  <Button
                    onClick={() => bulkApproveMutation.mutate(selectedTransactionIds)}
                    disabled={bulkApproveMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Approve Selected ({selectedTransactionIds.length})
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Enhanced Table Section */}
          <Card className="shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-hidden">
                <DataTable
                  columns={transactionColumns}
                  data={transactions?.transactions || []}
                  searchPlaceholder="Search by company, description, or reference..."
                  searchable={true}
                  className="border-0"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="companies" className="space-y-6">
          {/* Companies Header */}
          <div className="bg-white rounded-lg border shadow-sm p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Corporate Companies</h3>
                <p className="text-sm text-gray-600 mt-1">Manage corporate credit accounts and limits</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">
                  {companies?.data?.length || 0} companies
                </span>
              </div>
            </div>
          </div>

          {/* Enhanced Companies Table */}
          <Card className="shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-hidden">
                <DataTable
                  columns={companyColumns}
                  data={companies?.data || []}
                  searchPlaceholder="Search by company name, email, or GST number..."
                  searchable={true}
                  className="border-0"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis" className="space-y-6">
          {/* Analysis Header */}
          <div className="bg-white rounded-lg border shadow-sm p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Credit Analysis & Reports</h3>
                <p className="text-sm text-gray-600 mt-1">Comprehensive credit utilization and performance analytics</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">
                  Last updated: {new Date().toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Top Credit Utilizers</CardTitle>
              </CardHeader>
              <CardContent>
                <BarChart
                  data={creditAnalysis?.creditUtilization?.slice(0, 10).map((company: Record<string, unknown>) => ({
                    name: company.name.substring(0, 15),
                    utilization: company.creditUtilizationPercentage || 0,
                    available: company.availableCredit || 0
                  })) || []}
                  xDataKey="name"
                  bars={[
                    {
                      dataKey: "utilization",
                      name: "Utilization %",
                      color: "#EF4444"
                    }
                  ]}
                  height={300}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Monthly Credit Report</CardTitle>
              </CardHeader>
              <CardContent>
                <LineChart
                  data={monthlyReport?.data?.map((item: Record<string, unknown>) => ({
                    month: `${item._id.year}-${item._id.month.toString().padStart(2, '0')}`,
                    totalCredits: item.totalCredits || 0,
                    totalDebits: Math.abs(item.totalDebits || 0),
                    netFlow: (item.totalCredits || 0) + (item.totalDebits || 0)
                  })) || []}
                  xDataKey="month"
                  lines={[
                    {
                      dataKey: "totalCredits",
                      name: "Credits",
                      color: "#10B981"
                    },
                    {
                      dataKey: "totalDebits",
                      name: "Debits",
                      color: "#EF4444"
                    },
                    {
                      dataKey: "netFlow",
                      name: "Net Flow",
                      color: "#3B82F6"
                    }
                  ]}
                  height={300}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Credit Adjustment Modal */}
      <CreditAdjustmentModal
        isOpen={showCreditModal}
        onClose={() => {
          setShowCreditModal(false);
          setSelectedCompany(null);
        }}
        company={selectedCompany}
        onSubmit={(data) => updateCreditMutation.mutate(data)}
        isLoading={updateCreditMutation.isPending}
      />

      {/* New Transaction Modal */}
      <TransactionModal
        isOpen={showTransactionModal}
        onClose={() => setShowTransactionModal(false)}
        companies={companies?.data || []}
        onSubmit={(data) => createTransactionMutation.mutate(data)}
        isLoading={createTransactionMutation.isPending}
      />

      {/* Reject Transaction Modal */}
      <RejectTransactionModal
        isOpen={showRejectModal}
        onClose={() => {
          setShowRejectModal(false);
          setSelectedTransaction(null);
        }}
        transaction={selectedTransaction}
        onSubmit={(reason) => rejectTransactionMutation.mutate({
          transactionId: selectedTransaction!._id,
          reason
        })}
        isLoading={rejectTransactionMutation.isPending}
      />
    </div>
  );
};

// Credit Adjustment Modal Component
const CreditAdjustmentModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  company: CorporateCompany | null;
  onSubmit: (data: { companyId: string; amount: number; description: string }) => void;
  isLoading: boolean;
}> = ({ isOpen, onClose, company, onSubmit, isLoading }) => {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !amount || !description) return;

    onSubmit({
      companyId: company._id,
      amount: parseFloat(amount),
      description
    });
  };

  if (!company) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Adjust Credit Limit">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Company</label>
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="font-medium">{company.name}</div>
            <div className="text-sm text-gray-600">
              Current: {formatCurrency(company.availableCredit)} / {formatCurrency(company.creditLimit)}
            </div>
          </div>
        </div>

        <Input
          type="number"
          step="0.01"
          placeholder="Adjustment amount (positive to add, negative to subtract)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />

        <Input
          placeholder="Description of adjustment"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />

        <div className="flex justify-end space-x-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Updating...' : 'Update Credit'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

// Transaction Modal Component
const TransactionModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  companies: CorporateCompany[];
  onSubmit: (data: Record<string, unknown>) => void;
  isLoading: boolean;
}> = ({ isOpen, onClose, companies, onSubmit, isLoading }) => {
  const [formData, setFormData] = useState({
    companyId: '',
    amount: '',
    transactionType: 'debit',
    description: '',
    dueDate: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.companyId || !formData.amount || !formData.description) return;

    onSubmit({
      ...formData,
      amount: parseFloat(formData.amount),
      dueDate: formData.dueDate || undefined
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Credit Transaction">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          value={formData.companyId}
          onValueChange={(value) => setFormData(prev => ({ ...prev, companyId: value }))}
          required
        >
          <option value="">Select Company</option>
          {companies.map((company) => (
            <option key={company._id} value={company._id}>
              {company.name}
            </option>
          ))}
        </Select>

        <Input
          type="number"
          step="0.01"
          placeholder="Amount"
          value={formData.amount}
          onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
          required
        />

        <Select
          value={formData.transactionType}
          onValueChange={(value) => setFormData(prev => ({ ...prev, transactionType: value }))}
        >
          <option value="debit">Debit</option>
          <option value="credit">Credit</option>
          <option value="payment">Payment</option>
          <option value="adjustment">Adjustment</option>
          <option value="refund">Refund</option>
        </Select>

        <Input
          placeholder="Description"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          required
        />

        <Input
          type="date"
          placeholder="Due Date (optional)"
          value={formData.dueDate}
          onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
        />

        <div className="flex justify-end space-x-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create Transaction'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

// Reject Transaction Modal Component
const RejectTransactionModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  transaction: CreditTransaction | null;
  onSubmit: (reason: string) => void;
  isLoading: boolean;
}> = ({ isOpen, onClose, transaction, onSubmit, isLoading }) => {
  const [reason, setReason] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    onSubmit(reason);
    setReason('');
  };

  if (!transaction) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reject Transaction">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Transaction Details</label>
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="font-medium">{transaction.companyId?.name}</div>
            <div className="text-sm text-gray-600">
              {formatCurrency(Math.abs(transaction.amount))} - {transaction.transactionType}
            </div>
            <div className="text-sm text-gray-600">{transaction.description}</div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Rejection Reason *</label>
          <textarea
            className="w-full p-3 border rounded-lg resize-none"
            rows={4}
            placeholder="Please provide a reason for rejecting this transaction..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
          />
        </div>

        <div className="flex justify-end space-x-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading || !reason.trim()}>
            {isLoading ? 'Rejecting...' : 'Reject Transaction'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default withErrorBoundary(CorporateCreditManagement, { level: 'component' });
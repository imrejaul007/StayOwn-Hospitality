import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, IndianRupee, Receipt, CreditCard, PieChart, BarChart3, LineChart } from 'lucide-react';
import financialService from '@/services/financialService';
import { formatCurrency } from '@/utils/currencyUtils';

interface DashboardData {
  summary: {
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
    profitMargin: number;
    totalAssets: number;
    totalLiabilities: number;
    cashFlow: number;
    accountsReceivable: number;
    accountsPayable: number;
  };
  revenueBreakdown: {
    roomRevenue: number;
    foodBeverage: number;
    otherRevenue: number;
  };
  expenseBreakdown: {
    operatingExpenses: number;
    payroll: number;
    utilities: number;
    marketing: number;
    other: number;
  };
  trends: {
    labels: string[];
    revenue: number[];
    expenses: number[];
    profit: number[];
  };
  topAccounts: {
    accountName: string;
    balance: number;
    change: number;
  }[];
  cashFlowData: {
    operating: number;
    investing: number;
    financing: number;
    netCashFlow: number;
  };
}

const FinancialDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, [period]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const data = await financialService.getFinancialDashboard(period);
      setDashboardData(data);
      setError(null);
    } catch (err: unknown) {
      setError(err.message || 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const formatPercentage = (value: number) => {
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  const getTrendIcon = (value: number) => {
    return value > 0 ? (
      <TrendingUp className="w-4 h-4 text-green-500" />
    ) : (
      <TrendingDown className="w-4 h-4 text-red-500" />
    );
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-red-600 mb-4">{error}</p>
              <Button onClick={fetchDashboardData}>Retry</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!dashboardData) return null;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Financial Dashboard</h1>
          <p className="text-gray-600">Monitor your hotel's financial performance</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">Week</SelectItem>
            <SelectItem value="month">Month</SelectItem>
            <SelectItem value="quarter">Quarter</SelectItem>
            <SelectItem value="year">Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <IndianRupee className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(dashboardData.summary.totalRevenue)}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              {getTrendIcon(12.5)}
              <span className="ml-1">+12.5% from last {period}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(dashboardData.summary.netProfit)}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              <Badge variant={dashboardData.summary.profitMargin > 0 ? "default" : "destructive"}>
                {formatPercentage(dashboardData.summary.profitMargin)} margin
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cash Flow</CardTitle>
            <LineChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(dashboardData.summary.cashFlow)}</div>
            <div className="flex items-center text-xs text-muted-foreground">
              {getTrendIcon(dashboardData.summary.cashFlow)}
              <span className="ml-1">Operating activities</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">A/R Balance</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(dashboardData.summary.accountsReceivable)}</div>
            <div className="text-xs text-muted-foreground">
              Outstanding invoices
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <PieChart className="w-5 h-5 mr-2" />
              Revenue Breakdown
            </CardTitle>
            <CardDescription>Revenue by source for current {period}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Room Revenue</span>
                <div className="flex items-center">
                  <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full" 
                      style={{ 
                        width: `${(dashboardData.revenueBreakdown.roomRevenue / dashboardData.summary.totalRevenue) * 100}%` 
                      }}
                    ></div>
                  </div>
                  <span className="font-medium">{formatCurrency(dashboardData.revenueBreakdown.roomRevenue)}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span>F&B Revenue</span>
                <div className="flex items-center">
                  <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full" 
                      style={{ 
                        width: `${(dashboardData.revenueBreakdown.foodBeverage / dashboardData.summary.totalRevenue) * 100}%` 
                      }}
                    ></div>
                  </div>
                  <span className="font-medium">{formatCurrency(dashboardData.revenueBreakdown.foodBeverage)}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span>Other Revenue</span>
                <div className="flex items-center">
                  <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                    <div 
                      className="bg-purple-500 h-2 rounded-full" 
                      style={{ 
                        width: `${(dashboardData.revenueBreakdown.otherRevenue / dashboardData.summary.totalRevenue) * 100}%` 
                      }}
                    ></div>
                  </div>
                  <span className="font-medium">{formatCurrency(dashboardData.revenueBreakdown.otherRevenue)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cash Flow Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="w-5 h-5 mr-2" />
              Cash Flow Overview
            </CardTitle>
            <CardDescription>Cash flow by activity for current {period}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Operating Activities</span>
                <div className="flex items-center">
                  {getTrendIcon(dashboardData.cashFlowData.operating)}
                  <span className="font-medium ml-1">{formatCurrency(dashboardData.cashFlowData.operating)}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span>Investing Activities</span>
                <div className="flex items-center">
                  {getTrendIcon(dashboardData.cashFlowData.investing)}
                  <span className="font-medium ml-1">{formatCurrency(dashboardData.cashFlowData.investing)}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span>Financing Activities</span>
                <div className="flex items-center">
                  {getTrendIcon(dashboardData.cashFlowData.financing)}
                  <span className="font-medium ml-1">{formatCurrency(dashboardData.cashFlowData.financing)}</span>
                </div>
              </div>
              <div className="flex items-center justify-between border-t pt-2">
                <span className="font-medium">Net Cash Flow</span>
                <div className="flex items-center">
                  {getTrendIcon(dashboardData.cashFlowData.netCashFlow)}
                  <span className="font-bold ml-1">{formatCurrency(dashboardData.cashFlowData.netCashFlow)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Accounts & Balance Sheet Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Top Accounts by Balance</CardTitle>
            <CardDescription>Accounts with highest balances</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dashboardData.topAccounts.map((account, index) => (
                <div key={`dashboardData-topAccounts-${index}`} className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">{account.accountName}</span>
                    <div className="flex items-center text-sm text-muted-foreground">
                      {getTrendIcon(account.change)}
                      <span className="ml-1">{formatPercentage(account.change)} change</span>
                    </div>
                  </div>
                  <span className="font-bold">{formatCurrency(account.balance)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Balance Sheet Summary</CardTitle>
            <CardDescription>Financial position overview</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Total Assets</span>
                <span className="font-bold text-green-600">{formatCurrency(dashboardData.summary.totalAssets)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Total Liabilities</span>
                <span className="font-bold text-red-600">{formatCurrency(dashboardData.summary.totalLiabilities)}</span>
              </div>
              <div className="flex items-center justify-between border-t pt-2">
                <span className="font-medium">Net Worth</span>
                <span className="font-bold">
                  {formatCurrency(dashboardData.summary.totalAssets - dashboardData.summary.totalLiabilities)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Debt-to-Asset Ratio</span>
                <span>
                  {((dashboardData.summary.totalLiabilities / dashboardData.summary.totalAssets) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FinancialDashboard;
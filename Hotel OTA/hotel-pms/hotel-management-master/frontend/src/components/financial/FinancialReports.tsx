import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Download,
  TrendingUp,
  TrendingDown,
  Calendar,
  Filter,
  BarChart3,
  Calculator,
  Building,
  CreditCard,
  Users,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Minus
} from 'lucide-react';
import financialService from '@/services/financialService';
import { formatCurrency } from '@/utils/currencyUtils';
import { toast } from 'sonner';
import { format, startOfYear, endOfYear, startOfMonth, endOfMonth } from 'date-fns';

interface FinancialStatement {
  incomeStatement: {
    revenue: {
      roomRevenue: number;
      fbRevenue: number;
      otherRevenue: number;
      totalRevenue: number;
    };
    expenses: {
      operatingExpenses: number;
      staffExpenses: number;
      marketingExpenses: number;
      adminExpenses: number;
      totalExpenses: number;
    };
    netIncome: number;
    grossProfit: number;
    operatingIncome: number;
  };
  balanceSheet: {
    assets: {
      currentAssets: number;
      fixedAssets: number;
      totalAssets: number;
    };
    liabilities: {
      currentLiabilities: number;
      longTermLiabilities: number;
      totalLiabilities: number;
    };
    equity: {
      retainedEarnings: number;
      totalEquity: number;
    };
  };
  cashFlow: {
    operatingActivities: number;
    investingActivities: number;
    financingActivities: number;
    netCashFlow: number;
    beginningCash: number;
    endingCash: number;
  };
  ratios: {
    currentRatio: number;
    debtToEquity: number;
    debtToEquityRatio?: number;
    returnOnAssets: number;
    returnOnEquity: number;
    profitMargin: number;
    grossMargin: number;
    assetTurnover?: number;
    equityMultiplier?: number;
  };
}

interface ReportFilter {
  period: 'monthly' | 'quarterly' | 'yearly' | 'custom';
  startDate: Date;
  endDate: Date;
}

interface FinancialReportsProps {
  readOnly?: boolean;
}

const FinancialReports: React.FC<FinancialReportsProps> = ({ readOnly: _readOnly = false }) => {
  const [loading, setLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState('income-statement');
  const [financialData, setFinancialData] = useState<FinancialStatement | null>(null);
  const [filter, setFilter] = useState<ReportFilter>({
    period: 'monthly',
    startDate: startOfMonth(new Date()),
    endDate: endOfMonth(new Date())
  });

  useEffect(() => {
    fetchFinancialData();
  }, [filter]);

  const fetchFinancialData = async () => {
    try {
      setLoading(true);

      // Use the comprehensive financial statement endpoint with backend calculations
      const response = await financialService.getComprehensiveFinancialStatement({
        startDate: format(filter.startDate, 'yyyy-MM-dd'),
        endDate: format(filter.endDate, 'yyyy-MM-dd')
      });

      setFinancialData(response.data);

    } catch (error: unknown) {
      toast.error('Failed to fetch financial data');
      setFinancialData(null);
    } finally {
      setLoading(false);
    }
  };

  // Note: processFinancialData, getAccountBalance, and getAccountBalanceByType functions
  // have been removed as calculations are now performed on the backend via the
  // comprehensive financial statement endpoint for better consistency and performance.

  const generateCsvContent = (): string => {
    if (!financialData) return '';

    const lines: string[] = [];
    const dateRange = `${format(filter.startDate, 'yyyy-MM-dd')} to ${format(filter.endDate, 'yyyy-MM-dd')}`;

    // Income Statement
    lines.push('INCOME STATEMENT');
    lines.push(`Period: ${dateRange}`);
    lines.push('');
    lines.push('Revenue');
    lines.push(`Room Revenue,${financialData.incomeStatement.revenue.roomRevenue || 0}`);
    lines.push(`F&B Revenue,${financialData.incomeStatement.revenue.fbRevenue || 0}`);
    lines.push(`Other Revenue,${financialData.incomeStatement.revenue.otherRevenue || 0}`);
    lines.push(`Total Revenue,${financialData.incomeStatement.revenue.totalRevenue || 0}`);
    lines.push('');
    lines.push('Expenses');
    lines.push(`Operating Expenses,${financialData.incomeStatement.expenses.operatingExpenses || 0}`);
    lines.push(`Staff Expenses,${financialData.incomeStatement.expenses.staffExpenses || 0}`);
    lines.push(`Marketing Expenses,${financialData.incomeStatement.expenses.marketingExpenses || 0}`);
    lines.push(`Administrative Expenses,${financialData.incomeStatement.expenses.adminExpenses || 0}`);
    lines.push(`Total Expenses,${financialData.incomeStatement.expenses.totalExpenses || 0}`);
    lines.push('');
    lines.push('Profitability');
    lines.push(`Gross Profit,${financialData.incomeStatement.grossProfit || 0}`);
    lines.push(`Operating Income,${financialData.incomeStatement.operatingIncome || 0}`);
    lines.push(`Net Income,${financialData.incomeStatement.netIncome || 0}`);
    lines.push('');

    // Balance Sheet
    lines.push('BALANCE SHEET');
    lines.push('');
    lines.push('Assets');
    lines.push(`Current Assets,${financialData.balanceSheet?.assets?.currentAssets || 0}`);
    lines.push(`Fixed Assets,${financialData.balanceSheet?.assets?.fixedAssets || 0}`);
    lines.push(`Total Assets,${financialData.balanceSheet?.assets?.totalAssets || 0}`);
    lines.push('');
    lines.push('Liabilities');
    lines.push(`Current Liabilities,${financialData.balanceSheet?.liabilities?.currentLiabilities || 0}`);
    lines.push(`Long-term Liabilities,${financialData.balanceSheet?.liabilities?.longTermLiabilities || 0}`);
    lines.push(`Total Liabilities,${financialData.balanceSheet?.liabilities?.totalLiabilities || 0}`);
    lines.push('');
    lines.push('Equity');
    lines.push(`Retained Earnings,${financialData.balanceSheet?.equity?.retainedEarnings || 0}`);
    lines.push(`Total Equity,${financialData.balanceSheet?.equity?.totalEquity || 0}`);
    lines.push('');

    // Cash Flow
    lines.push('CASH FLOW STATEMENT');
    lines.push('');
    lines.push(`Operating Activities,${financialData.cashFlow?.operatingActivities || 0}`);
    lines.push(`Investing Activities,${financialData.cashFlow?.investingActivities || 0}`);
    lines.push(`Financing Activities,${financialData.cashFlow?.financingActivities || 0}`);
    lines.push(`Net Cash Flow,${financialData.cashFlow?.netCashFlow || 0}`);
    lines.push(`Beginning Cash,${financialData.cashFlow?.beginningCash || 0}`);
    lines.push(`Ending Cash,${financialData.cashFlow?.endingCash || 0}`);
    lines.push('');

    // Ratios
    lines.push('FINANCIAL RATIOS');
    lines.push('');
    lines.push(`Current Ratio,${financialData.ratios?.currentRatio?.toFixed(2) || 'N/A'}`);
    lines.push(`Debt to Equity Ratio,${(financialData.ratios?.debtToEquityRatio ?? financialData.ratios?.debtToEquity)?.toFixed(2) || 'N/A'}`);
    lines.push(`Return on Assets,${financialData.ratios?.returnOnAssets?.toFixed(2) || 'N/A'}`);
    lines.push(`Return on Equity,${financialData.ratios?.returnOnEquity?.toFixed(2) || 'N/A'}`);
    lines.push(`Profit Margin,${financialData.ratios?.profitMargin?.toFixed(2) || 'N/A'}`);
    lines.push(`Gross Margin,${financialData.ratios?.grossMargin?.toFixed(2) || 'N/A'}`);

    return lines.join('\n');
  };

  const handleExportReport = (reportType: string) => {
    if (!financialData) {
      toast.error('No financial data available to export');
      return;
    }

    if (reportType === 'PDF') {
      toast.info('PDF export coming soon. Use Excel/CSV export for now.');
      return;
    }

    try {
      const csvContent = generateCsvContent();
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `financial-report-${selectedTab}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('CSV report downloaded successfully');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Failed to export report: ' + message);
    }
  };

  const formatPercentage = (value: number) => {
    if (!isFinite(value) || isNaN(value)) return '0.0%';
    return `${value.toFixed(1)}%`;
  };

  const safeDivide = (numerator: number, denominator: number): number => {
    if (!denominator || denominator === 0) return 0;
    return (numerator / denominator) * 100;
  };

  const renderIncomeStatement = () => (
    <div className="space-y-6">
      {/* Revenue Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-green-600" />
            Revenue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Room Revenue</TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(financialData?.incomeStatement.revenue.roomRevenue || 0)}
                </TableCell>
                <TableCell className="text-right text-sm text-gray-500">
                  {safeDivide(financialData?.incomeStatement.revenue.roomRevenue || 0, financialData?.incomeStatement.revenue.totalRevenue || 0).toFixed(1)}%
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">F&B Revenue</TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(financialData?.incomeStatement.revenue.fbRevenue || 0)}
                </TableCell>
                <TableCell className="text-right text-sm text-gray-500">
                  {safeDivide(financialData?.incomeStatement.revenue.fbRevenue || 0, financialData?.incomeStatement.revenue.totalRevenue || 0).toFixed(1)}%
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Other Revenue</TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(financialData?.incomeStatement.revenue.otherRevenue || 0)}
                </TableCell>
                <TableCell className="text-right text-sm text-gray-500">
                  {safeDivide(financialData?.incomeStatement.revenue.otherRevenue || 0, financialData?.incomeStatement.revenue.totalRevenue || 0).toFixed(1)}%
                </TableCell>
              </TableRow>
              <TableRow className="border-t-2">
                <TableCell className="font-bold">Total Revenue</TableCell>
                <TableCell className="text-right font-bold font-mono">
                  {formatCurrency(financialData?.incomeStatement.revenue.totalRevenue || 0)}
                </TableCell>
                <TableCell className="text-right font-bold text-sm">
                  {(financialData?.incomeStatement.revenue.totalRevenue || 0) > 0 ? '100.0%' : '0.0%'}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Expenses Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <TrendingDown className="w-5 h-5 mr-2 text-red-600" />
            Expenses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Operating Expenses</TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(financialData?.incomeStatement.expenses.operatingExpenses || 0)}
                </TableCell>
                <TableCell className="text-right text-sm text-gray-500">
                  {safeDivide(financialData?.incomeStatement.expenses.operatingExpenses || 0, financialData?.incomeStatement.expenses.totalExpenses || 0).toFixed(1)}%
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Staff Expenses</TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(financialData?.incomeStatement.expenses.staffExpenses || 0)}
                </TableCell>
                <TableCell className="text-right text-sm text-gray-500">
                  {safeDivide(financialData?.incomeStatement.expenses.staffExpenses || 0, financialData?.incomeStatement.expenses.totalExpenses || 0).toFixed(1)}%
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Marketing Expenses</TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(financialData?.incomeStatement.expenses.marketingExpenses || 0)}
                </TableCell>
                <TableCell className="text-right text-sm text-gray-500">
                  {safeDivide(financialData?.incomeStatement.expenses.marketingExpenses || 0, financialData?.incomeStatement.expenses.totalExpenses || 0).toFixed(1)}%
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Administrative Expenses</TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(financialData?.incomeStatement.expenses.adminExpenses || 0)}
                </TableCell>
                <TableCell className="text-right text-sm text-gray-500">
                  {safeDivide(financialData?.incomeStatement.expenses.adminExpenses || 0, financialData?.incomeStatement.expenses.totalExpenses || 0).toFixed(1)}%
                </TableCell>
              </TableRow>
              <TableRow className="border-t-2">
                <TableCell className="font-bold">Total Expenses</TableCell>
                <TableCell className="text-right font-bold font-mono text-red-600">
                  {formatCurrency(financialData?.incomeStatement.expenses.totalExpenses || 0)}
                </TableCell>
                <TableCell className="text-right font-bold text-sm">
                  {(financialData?.incomeStatement.expenses.totalExpenses || 0) > 0 ? '100.0%' : '0.0%'}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Profitability */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calculator className="w-5 h-5 mr-2 text-blue-600" />
            Profitability
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Gross Profit</TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(financialData?.incomeStatement.grossProfit || 0)}
                </TableCell>
                <TableCell className="text-right text-sm text-gray-500">
                  {formatPercentage(safeDivide(financialData?.incomeStatement.grossProfit || 0, financialData?.incomeStatement.revenue.totalRevenue || 0))}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Operating Income</TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(financialData?.incomeStatement.operatingIncome || 0)}
                </TableCell>
                <TableCell className="text-right text-sm text-gray-500">
                  {formatPercentage(((financialData?.incomeStatement.operatingIncome || 0) / (financialData?.incomeStatement.revenue.totalRevenue || 1)) * 100)}
                </TableCell>
              </TableRow>
              <TableRow className="border-t-2">
                <TableCell className="font-bold text-green-700">Net Income</TableCell>
                <TableCell className="text-right font-bold font-mono text-green-700">
                  {formatCurrency(financialData?.incomeStatement.netIncome || 0)}
                </TableCell>
                <TableCell className="text-right font-bold text-sm text-green-700">
                  {formatPercentage(((financialData?.incomeStatement.netIncome || 0) / (financialData?.incomeStatement.revenue.totalRevenue || 1)) * 100)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-64"></div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-0 sm:justify-between sm:items-center">
        <div>
          <h1 className="text-3xl font-bold">Financial Reports</h1>
          <p className="text-gray-600">Comprehensive financial analysis and reporting</p>
        </div>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <Button variant="outline" onClick={() => handleExportReport('PDF')}>
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
          <Button variant="outline" onClick={() => handleExportReport('Excel')}>
            <Download className="w-4 h-4 mr-2" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="w-5 h-5 mr-2" />
            Report Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Period</Label>
              <Select value={filter.period} onValueChange={(value: string) => setFilter({...filter, period: value as ReportFilter['period']})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={format(filter.startDate, 'yyyy-MM-dd')}
                onChange={(e) => setFilter({...filter, startDate: new Date(e.target.value)})}
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={format(filter.endDate, 'yyyy-MM-dd')}
                onChange={(e) => setFilter({...filter, endDate: new Date(e.target.value)})}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={fetchFinancialData}>
                <Calendar className="w-4 h-4 mr-2" />
                Update Report
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Empty State */}
      {!financialData && !loading && (
        <Card>
          <CardContent className="text-center py-12">
            <BarChart3 className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium text-lg">No financial data available</p>
            <p className="text-gray-400 text-sm mt-1">Adjust the date range or click "Update Report" to generate reports.</p>
          </CardContent>
        </Card>
      )}

      {/* Report Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="income-statement" className="flex items-center">
            <TrendingUp className="w-4 h-4 mr-2" />
            Income Statement
          </TabsTrigger>
          <TabsTrigger value="balance-sheet" className="flex items-center">
            <BarChart3 className="w-4 h-4 mr-2" />
            Balance Sheet  
          </TabsTrigger>
          <TabsTrigger value="cash-flow" className="flex items-center">
            <Activity className="w-4 h-4 mr-2" />
            Cash Flow
          </TabsTrigger>
          <TabsTrigger value="ratios" className="flex items-center">
            <Calculator className="w-4 h-4 mr-2" />
            Financial Ratios
          </TabsTrigger>
        </TabsList>

        <TabsContent value="income-statement">
          {renderIncomeStatement()}
        </TabsContent>

        <TabsContent value="balance-sheet">
          <div className="space-y-6">
            {/* Assets Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Building className="w-5 h-5 mr-2 text-blue-600" />
                  Assets
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Current Assets</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(financialData?.balanceSheet?.assets?.currentAssets || 0)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Fixed Assets</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(financialData?.balanceSheet?.assets?.fixedAssets || 0)}
                      </TableCell>
                    </TableRow>
                    <TableRow className="border-t-2">
                      <TableCell className="font-bold">Total Assets</TableCell>
                      <TableCell className="text-right font-bold font-mono">
                        {formatCurrency(financialData?.balanceSheet?.assets?.totalAssets || 0)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Liabilities Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CreditCard className="w-5 h-5 mr-2 text-red-600" />
                  Liabilities
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Current Liabilities</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(financialData?.balanceSheet?.liabilities?.currentLiabilities || 0)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Long-term Liabilities</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(financialData?.balanceSheet?.liabilities?.longTermLiabilities || 0)}
                      </TableCell>
                    </TableRow>
                    <TableRow className="border-t-2">
                      <TableCell className="font-bold">Total Liabilities</TableCell>
                      <TableCell className="text-right font-bold font-mono text-red-600">
                        {formatCurrency(financialData?.balanceSheet?.liabilities?.totalLiabilities || 0)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Equity Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="w-5 h-5 mr-2 text-green-600" />
                  Equity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Retained Earnings</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(financialData?.balanceSheet?.equity?.retainedEarnings || 0)}
                      </TableCell>
                    </TableRow>
                    <TableRow className="border-t-2">
                      <TableCell className="font-bold text-green-700">Total Equity</TableCell>
                      <TableCell className="text-right font-bold font-mono text-green-700">
                        {formatCurrency(financialData?.balanceSheet?.equity?.totalEquity || 0)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="cash-flow">
          <div className="space-y-6">
            {/* Cash Flow Activities */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Activity className="w-5 h-5 mr-2 text-blue-600" />
                  Cash Flow Statement
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Operating Activities</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(financialData?.cashFlow?.operatingActivities || 0)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Investing Activities</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(financialData?.cashFlow?.investingActivities || 0)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Financing Activities</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(financialData?.cashFlow?.financingActivities || 0)}
                      </TableCell>
                    </TableRow>
                    <TableRow className="border-t-2">
                      <TableCell className="font-bold">Net Cash Flow</TableCell>
                      <TableCell className="text-right font-bold font-mono">
                        {formatCurrency(financialData?.cashFlow?.netCashFlow || 0)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Cash Position */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="w-5 h-5 mr-2 text-green-600" />
                  Cash Position
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Beginning Cash</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(financialData?.cashFlow?.beginningCash || 0)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Net Cash Flow</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(financialData?.cashFlow?.netCashFlow || 0)}
                      </TableCell>
                    </TableRow>
                    <TableRow className="border-t-2">
                      <TableCell className="font-bold text-green-700">Ending Cash</TableCell>
                      <TableCell className="text-right font-bold font-mono text-green-700">
                        {formatCurrency(financialData?.cashFlow?.endingCash || 0)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="ratios">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Current Ratio */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Current Ratio</CardTitle>
                <CardDescription>Ability to pay short-term obligations</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold font-mono">
                  {(financialData?.ratios?.currentRatio ?? 0).toFixed(2)}
                </p>
              </CardContent>
            </Card>

            {/* Debt to Equity Ratio */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Debt to Equity Ratio</CardTitle>
                <CardDescription>Proportion of debt used to finance assets relative to equity</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold font-mono">
                  {((financialData?.ratios?.debtToEquityRatio ?? financialData?.ratios?.debtToEquity) ?? 0).toFixed(2)}
                </p>
              </CardContent>
            </Card>

            {/* Return on Assets */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Return on Assets (ROA)</CardTitle>
                <CardDescription>How efficiently assets generate profit</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold font-mono">
                  {((financialData?.ratios?.returnOnAssets ?? 0) * 100).toFixed(2)}%
                </p>
              </CardContent>
            </Card>

            {/* Return on Equity */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Return on Equity (ROE)</CardTitle>
                <CardDescription>How efficiently equity generates profit</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold font-mono">
                  {((financialData?.ratios?.returnOnEquity ?? 0) * 100).toFixed(2)}%
                </p>
              </CardContent>
            </Card>

            {/* Profit Margin */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Profit Margin</CardTitle>
                <CardDescription>Percentage of revenue retained as profit</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold font-mono">
                  {((financialData?.ratios?.profitMargin ?? 0) * 100).toFixed(2)}%
                </p>
              </CardContent>
            </Card>

            {/* Gross Margin */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Gross Margin</CardTitle>
                <CardDescription>Revenue remaining after cost of goods sold</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold font-mono">
                  {((financialData?.ratios?.grossMargin ?? 0) * 100).toFixed(2)}%
                </p>
              </CardContent>
            </Card>

            {/* Asset Turnover */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Asset Turnover</CardTitle>
                <CardDescription>Revenue generated per dollar of assets</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold font-mono">
                  {(financialData?.ratios?.assetTurnover ?? 0).toFixed(2)}
                </p>
              </CardContent>
            </Card>

            {/* Equity Multiplier */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Equity Multiplier</CardTitle>
                <CardDescription>Total assets per dollar of equity (leverage measure)</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold font-mono">
                  {(financialData?.ratios?.equityMultiplier ?? 0).toFixed(2)}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FinancialReports;
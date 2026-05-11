import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  BarChart3,
  PieChart,
  Download,
  RefreshCw,
  Target,
  Clock,
  CheckCircle,
  XCircle,
  Minus,
  Building,
  Package,
  Activity,
  FileText
} from 'lucide-react';
import { bypassFinancialService } from '../../services/bypassFinancialService';
import LoadingSpinner from '../ui/LoadingSpinner';
import { withErrorBoundary } from '../ErrorBoundary';

interface FinancialSummary {
  totalImpacts: number;
  totalDirectCosts: number;
  totalIndirectCosts: number;
  totalRevenueImpact: number;
  averageImpactPerBypass: number;
  totalRecoveredAmount: number;
  byCategory: Array<{
    category: boolean;
    cost: number;
  }>;
}

interface CostTrend {
  _id: {
    year: number;
    month: number;
  };
  totalCost: number;
  bypassCount: number;
  averageCost: number;
}

interface CostDriver {
  _id: string;
  totalCost: number;
  frequency: number;
  averageCost: number;
}

interface BudgetImpact {
  _id: string;
  totalImpact: number;
  totalBudget: number;
  bypassCount: number;
  averageImpact: number;
  overBudgetCount: number;
}

interface RecoveryData {
  totalImpacts: number;
  totalOutstanding: number;
  totalRecovered: number;
  totalImpactAmount: number;
  overallRecoveryPercentage: number;
  totalRecoveryActions: number;
  completedActions: number;
  actionCompletionRate: number;
}

interface ExecutiveReport {
  summary: {
    totalFinancialImpact: number;
    totalBypasses: number;
    averageImpactPerBypass: number;
    recoveryRate: number;
  };
  keyMetrics: {
    directCosts: number;
    indirectCosts: number;
    revenueImpact: number;
    recoveredAmount: number;
  };
  trends: {
    costTrend: string;
    monthlyData: CostTrend[];
  };
  topCostDrivers: CostDriver[];
  budgetImpact: BudgetImpact[];
  recommendations: Array<{
    category: string;
    priority: string;
    title: string;
    description: string;
    action: string;
  }>;
}

const BypassFinancialDashboard: React.FC = () => {
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [trends, setTrends] = useState<CostTrend[]>([]);
  const [costDrivers, setCostDrivers] = useState<CostDriver[]>([]);
  const [budgetImpact, setBudgetImpact] = useState<BudgetImpact[]>([]);
  const [recovery, setRecovery] = useState<RecoveryData | null>(null);
  const [executiveReport, setExecutiveReport] = useState<ExecutiveReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<number>(30);
  const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'budget' | 'recovery' | 'report'>('overview');

  useEffect(() => {
    fetchFinancialData();
  }, [timeRange]);

  const fetchFinancialData = async () => {
    try {
      setLoading(true);
      setError(null);

      let summaryData;
      try {
        summaryData = await bypassFinancialService.getFinancialSummary(timeRange);
      } catch (summaryError) {
        // Set empty summary data to continue
        summaryData = { data: { totalImpacts: 0, totalDirectCosts: 0, totalIndirectCosts: 0, totalRevenueImpact: 0, averageImpactPerBypass: 0, totalRecoveredAmount: 0, byCategory: [] } };
      }

      const [trendsData, costDriversData, budgetData, recoveryData, reportData] = await Promise.all([
        bypassFinancialService.getCostTrends(Math.ceil(timeRange / 30)).catch(() => ({ data: [] as CostTrend[] })),
        bypassFinancialService.getTopCostDrivers(10).catch(() => ({ data: [] as CostDriver[] })),
        bypassFinancialService.getBudgetImpact().catch(() => ({ data: [] as BudgetImpact[] })),
        bypassFinancialService.getRecoveryData(timeRange).catch(() => ({ data: null })),
        bypassFinancialService.getExecutiveReport(timeRange).catch(() => ({ data: null })),
      ]);

      setSummary(summaryData.data);
      setTrends(trendsData.data || []);
      setCostDrivers(costDriversData.data || []);
      setBudgetImpact(budgetData.data || []);
      setRecovery(recoveryData.data as RecoveryData | null);
      setExecutiveReport(reportData.data as ExecutiveReport | null);
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Failed to fetch financial data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchFinancialData();
    setRefreshing(false);
  };

  const handleExportReport = async () => {
    try {
      const report = await bypassFinancialService.getExecutiveReport(timeRange);
      const jsonStr = JSON.stringify(report.data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `financial_report_${timeRange}d.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (exportErr) {
      setError('Failed to export report. Please try again.');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return <TrendingUp className="h-4 w-4 text-red-500" />;
      case 'decreasing':
        return <TrendingDown className="h-4 w-4 text-green-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <LoadingSpinner />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <BarChart3 className="h-6 w-6 mr-2 text-blue-600" />
            Financial Analytics Dashboard
          </h1>
          <p className="text-gray-600 mt-1">Comprehensive financial impact analysis and cost optimization</p>
        </div>

        <div className="flex items-center space-x-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value={7}>Last 7 Days</option>
            <option value={30}>Last 30 Days</option>
            <option value={90}>Last 90 Days</option>
            <option value={365}>Last Year</option>
          </select>

          <Button onClick={handleRefresh} disabled={refreshing} size="sm" variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button onClick={handleExportReport} size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'overview', label: 'Overview', icon: Activity },
            { key: 'trends', label: 'Trends', icon: TrendingUp },
            { key: 'budget', label: 'Budget Impact', icon: Target },
            { key: 'recovery', label: 'Recovery', icon: CheckCircle },
            { key: 'report', label: 'Executive Report', icon: FileText }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4 mr-2" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {!summary ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No financial data available</p>
            </div>
          ) : (
            <>
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600">Total Financial Impact</p>
                    <p className="text-2xl font-bold text-red-600">
                      {formatCurrency(summary.totalDirectCosts + summary.totalIndirectCosts + Math.abs(summary.totalRevenueImpact))}
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-red-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600">Total Bypasses</p>
                    <p className="text-2xl font-bold text-gray-900">{summary.totalImpacts}</p>
                  </div>
                  <Activity className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600">Average Cost per Bypass</p>
                    <p className="text-2xl font-bold text-orange-600">
                      {formatCurrency(summary.averageImpactPerBypass)}
                    </p>
                  </div>
                  <BarChart3 className="h-8 w-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600">Recovery Rate</p>
                    <p className="text-2xl font-bold text-green-600">
                      {recovery ? formatPercentage(recovery.overallRecoveryPercentage) : '0%'}
                    </p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Cost Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <PieChart className="h-5 w-5 mr-2" />
                  Cost Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-red-500 rounded-full mr-3"></div>
                      <span className="text-sm font-medium">Direct Costs</span>
                    </div>
                    <span className="text-sm font-bold">{formatCurrency(summary.totalDirectCosts)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-orange-500 rounded-full mr-3"></div>
                      <span className="text-sm font-medium">Indirect Costs</span>
                    </div>
                    <span className="text-sm font-bold">{formatCurrency(summary.totalIndirectCosts)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-blue-500 rounded-full mr-3"></div>
                      <span className="text-sm font-medium">Revenue Impact</span>
                    </div>
                    <span className="text-sm font-bold">{formatCurrency(Math.abs(summary.totalRevenueImpact))}</span>
                  </div>
                  <div className="flex items-center justify-between border-t pt-2">
                    <div className="flex items-center">
                      <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                      <span className="text-sm font-medium">Recovered</span>
                    </div>
                    <span className="text-sm font-bold text-green-600">{formatCurrency(summary.totalRecoveredAmount)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Package className="h-5 w-5 mr-2" />
                  Top Cost Drivers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {costDrivers.slice(0, 5).map((driver, index) => (
                    <div key={driver._id} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white mr-3 ${
                          index === 0 ? 'bg-red-500' :
                          index === 1 ? 'bg-orange-500' :
                          index === 2 ? 'bg-yellow-500' :
                          'bg-gray-500'
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{driver._id}</p>
                          <p className="text-xs text-gray-500">{driver.frequency} occurrences</p>
                        </div>
                      </div>
                      <span className="text-sm font-bold">{formatCurrency(driver.totalCost)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            </div>
            </>
          )}
        </div>
      )}

      {/* Trends Tab */}
      {activeTab === 'trends' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="h-5 w-5 mr-2" />
                Cost Trends Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              {trends.length > 0 ? (
                <div className="space-y-4">
                  {/* Trend Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">Trend Direction</p>
                      <div className="flex items-center justify-center mt-1">
                        {getTrendIcon(executiveReport?.trends.costTrend || 'stable')}
                        <span className="ml-2 font-medium capitalize">
                          {executiveReport?.trends.costTrend || 'stable'}
                        </span>
                      </div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">Peak Month</p>
                      <p className="text-lg font-bold mt-1">
                        {trends.reduce((max, trend) => trend.totalCost > max.totalCost ? trend : max)._id.month}/
                        {trends.reduce((max, trend) => trend.totalCost > max.totalCost ? trend : max)._id.year}
                      </p>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">Peak Cost</p>
                      <p className="text-lg font-bold mt-1">
                        {formatCurrency(Math.max(...trends.map(t => t.totalCost)))}
                      </p>
                    </div>
                  </div>

                  {/* Monthly Trend Data */}
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Month
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Bypass Count
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Total Cost
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Average Cost
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {trends.map((trend, index) => (
                          <tr key={`${trend._id.year}-${trend._id.month}`}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {trend._id.month}/{trend._id.year}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {trend.bypassCount}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatCurrency(trend.totalCost)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatCurrency(trend.averageCost)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <TrendingUp className="mx-auto h-12 w-12 mb-3 text-gray-400" />
                  <p>No trend data available for the selected time range</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Budget Impact Tab */}
      {activeTab === 'budget' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Target className="h-5 w-5 mr-2" />
                Budget Impact Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              {budgetImpact.length > 0 ? (
                <div className="space-y-4">
                  {budgetImpact.map((dept, index) => (
                    <div key={dept._id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                          <Building className="h-5 w-5 mr-2 text-blue-600" />
                          <h3 className="font-semibold capitalize">{dept._id}</h3>
                          {dept.overBudgetCount > 0 && (
                            <Badge className="ml-2 bg-red-100 text-red-800 border-red-200">
                              Over Budget
                            </Badge>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">{formatCurrency(dept.totalImpact)}</p>
                          <p className="text-sm text-gray-500">{dept.bypassCount} bypasses</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">Budget Utilization</p>
                          <div className="flex items-center mt-1">
                            <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                              <div 
                                className={`h-2 rounded-full ${
                                  (dept.totalBudget > 0 ? dept.totalImpact / dept.totalBudget : 0) > 1 ? 'bg-red-500' : 'bg-blue-500'
                                }`}
                                style={{ width: `${dept.totalBudget > 0 ? Math.min((dept.totalImpact / dept.totalBudget) * 100, 100) : 0}%` }}
                              ></div>
                            </div>
                            <span className="text-xs font-medium">
                              {formatPercentage(dept.totalBudget > 0 ? (dept.totalImpact / dept.totalBudget) * 100 : 0)}
                            </span>
                          </div>
                        </div>
                        
                        <div>
                          <p className="text-gray-600">Average Impact</p>
                          <p className="font-medium">{formatCurrency(dept.averageImpact)}</p>
                        </div>
                        
                        <div>
                          <p className="text-gray-600">Budget Status</p>
                          <div className="flex items-center">
                            {dept.overBudgetCount > 0 ? (
                              <>
                                <XCircle className="h-4 w-4 text-red-500 mr-1" />
                                <span className="text-red-600 font-medium">Over Budget</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                                <span className="text-green-600 font-medium">Within Budget</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Target className="mx-auto h-12 w-12 mb-3 text-gray-400" />
                  <p>No budget impact data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recovery Tab */}
      {activeTab === 'recovery' && !recovery && (
        <div className="text-center py-8 text-gray-500">
          <CheckCircle className="mx-auto h-12 w-12 mb-3 text-gray-400" />
          <p>No recovery data available</p>
        </div>
      )}
      {activeTab === 'recovery' && recovery && (
        <div className="space-y-6">
          {/* Recovery Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600">Recovery Rate</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatPercentage(recovery.overallRecoveryPercentage)}
                    </p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600">Amount Recovered</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(recovery.totalRecovered)}
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600">Outstanding Amount</p>
                    <p className="text-2xl font-bold text-orange-600">
                      {formatCurrency(recovery.totalOutstanding)}
                    </p>
                  </div>
                  <Clock className="h-8 w-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600">Action Completion</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {formatPercentage(recovery.actionCompletionRate)}
                    </p>
                  </div>
                  <Activity className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recovery Progress */}
          <Card>
            <CardHeader>
              <CardTitle>Recovery Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Overall Recovery Progress</span>
                    <span>{formatPercentage(recovery.overallRecoveryPercentage)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-green-500 h-3 rounded-full"
                      style={{ width: `${recovery.overallRecoveryPercentage}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Recovery Actions Completion</span>
                    <span>{recovery.completedActions} / {recovery.totalRecoveryActions}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-blue-500 h-3 rounded-full"
                      style={{ width: `${recovery.actionCompletionRate}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Executive Report Tab */}
      {activeTab === 'report' && !executiveReport && (
        <div className="text-center py-8 text-gray-500">
          <FileText className="mx-auto h-12 w-12 mb-3 text-gray-400" />
          <p>No executive report data available</p>
        </div>
      )}
      {activeTab === 'report' && executiveReport && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <FileText className="h-5 w-5 mr-2" />
                  Executive Summary
                </div>
                <Button onClick={handleExportReport} size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export PDF
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <p className="text-sm text-gray-600">Total Impact</p>
                  <p className="text-xl font-bold text-red-600">
                    {formatCurrency(executiveReport.summary.totalFinancialImpact)}
                  </p>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600">Total Bypasses</p>
                  <p className="text-xl font-bold text-blue-600">
                    {executiveReport.summary.totalBypasses}
                  </p>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <p className="text-sm text-gray-600">Avg per Bypass</p>
                  <p className="text-xl font-bold text-orange-600">
                    {formatCurrency(executiveReport.summary.averageImpactPerBypass)}
                  </p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-600">Recovery Rate</p>
                  <p className="text-xl font-bold text-green-600">
                    {formatPercentage(executiveReport.summary.recoveryRate)}
                  </p>
                </div>
              </div>

              {/* Recommendations */}
              {executiveReport.recommendations.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <AlertTriangle className="h-5 w-5 mr-2 text-yellow-600" />
                    Key Recommendations
                  </h3>
                  <div className="space-y-3">
                    {executiveReport.recommendations.map((rec, index) => (
                      <Alert key={`executiveReport-recommendations-${index}-${rec.title}`} className="border-l-4 border-l-yellow-500">
                        <div className="flex items-start">
                          <Badge className={`mr-3 ${getPriorityColor(rec.priority)}`}>
                            {rec.priority.toUpperCase()}
                          </Badge>
                          <div className="flex-1">
                            <h4 className="font-medium">{rec.title}</h4>
                            <p className="text-sm text-gray-600 mt-1">{rec.description}</p>
                            <p className="text-sm font-medium text-blue-600 mt-2">
                              Action: {rec.action}
                            </p>
                          </div>
                        </div>
                      </Alert>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default withErrorBoundary(BypassFinancialDashboard, { level: 'component' });

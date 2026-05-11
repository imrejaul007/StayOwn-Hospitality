import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FaChartBar,
  FaTrendingUp,
  FaTrendingDown,
  FaArrowUp,
  FaArrowDown,
  FaExchangeAlt,
  FaCalendarAlt,
  FaDollarSign,
  FaBox,
  FaUsers,
  FaFilter,
  FaDownload,
  FaRefresh,
  FaInfoCircle
} from 'react-icons/fa';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { stockMovementsService, TransactionSummaryResponse } from '../../services/stockMovementsService';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

interface AnalyticsFilters {
  startDate: string;
  endDate: string;
  category: string;
  period: 'week' | 'month' | 'quarter' | 'year';
}

interface AlertInfo {
  type: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  count?: number;
}

const TransactionAnalytics: React.FC = () => {
  const [analytics, setAnalytics] = useState<TransactionSummaryResponse['data'] | null>(null);
  const [reorderSuggestions, setReorderSuggestions] = useState<unknown>(null);
  const [lowStockAlerts, setLowStockAlerts] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [filters, setFilters] = useState<AnalyticsFilters>({
    startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    category: '',
    period: 'month'
  });

  // Fetch analytics data
  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      const [analyticsResponse, reorderResponse, alertsResponse] = await Promise.all([
        stockMovementsService.getTransactionSummary({
          startDate: filters.startDate,
          endDate: filters.endDate,
          category: filters.category || undefined
        }),
        stockMovementsService.getReorderSuggestions(),
        stockMovementsService.getLowStockAlerts()
      ]);

      if (analyticsResponse.success) {
        setAnalytics(analyticsResponse.data);
      }

      if (reorderResponse.success) {
        setReorderSuggestions(reorderResponse.data);
      }

      if (alertsResponse.success) {
        setLowStockAlerts(alertsResponse.data);
      }
    } catch (err: unknown) {
      setError(err.message || 'Failed to fetch analytics data');
    } finally {
      setLoading(false);
    }
  };

  // Refresh data
  const refreshData = async () => {
    setRefreshing(true);
    await fetchAnalytics();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchAnalytics();
  }, [filters]);

  // Update filters
  const updateFilter = (key: keyof AnalyticsFilters, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Set predefined periods
  const setPeriod = (period: 'week' | 'month' | 'quarter' | 'year') => {
    const endDate = new Date();
    let startDate: Date;

    switch (period) {
      case 'week':
        startDate = subDays(endDate, 7);
        break;
      case 'month':
        startDate = subDays(endDate, 30);
        break;
      case 'quarter':
        startDate = subDays(endDate, 90);
        break;
      case 'year':
        startDate = subDays(endDate, 365);
        break;
      default:
        startDate = subDays(endDate, 30);
    }

    setFilters(prev => ({
      ...prev,
      period,
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd')
    }));
  };

  // Export analytics data
  const exportAnalytics = () => {
    if (!analytics) return;

    const exportData = {
      period: {
        startDate: filters.startDate,
        endDate: filters.endDate,
        category: filters.category || 'All'
      },
      summary: analytics.summary,
      categoryBreakdown: analytics.categoryBreakdown,
      topActiveItems: analytics.topActiveItems,
      dailyTrends: analytics.dailyTrends,
      reorderSuggestions: reorderSuggestions?.suggestions || [],
      lowStockAlerts: lowStockAlerts?.alerts || [],
      generatedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transaction_analytics_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // Calculate summary metrics
  const summaryMetrics = useMemo(() => {
    if (!analytics) return null;

    const totalTransactions = analytics.summary.reduce((sum, item) => sum + item.count, 0);
    const totalValue = analytics.summary.reduce((sum, item) => sum + item.totalValue, 0);
    const totalQuantity = analytics.summary.reduce((sum, item) => sum + Math.abs(item.totalQuantity), 0);

    const inTransactions = analytics.summary.filter(item => ['IN', 'REORDER'].includes(item._id));
    const outTransactions = analytics.summary.filter(item => ['OUT', 'CONSUMPTION'].includes(item._id));

    const totalIn = inTransactions.reduce((sum, item) => sum + item.totalQuantity, 0);
    const totalOut = outTransactions.reduce((sum, item) => sum + Math.abs(item.totalQuantity), 0);

    const netFlow = totalIn - totalOut;

    return {
      totalTransactions,
      totalValue,
      totalQuantity,
      totalIn,
      totalOut,
      netFlow
    };
  }, [analytics]);

  // Prepare chart data
  const prepareTrendData = () => {
    if (!analytics) return [];

    return analytics.dailyTrends.map(trend => ({
      date: format(new Date(trend._id.date), 'MMM dd'),
      fullDate: trend._id.date,
      transactions: trend.transactionCount,
      value: trend.totalValue,
      inTransactions: trend.inTransactions,
      outTransactions: trend.outTransactions
    }));
  };

  const prepareCategoryData = () => {
    if (!analytics) return [];

    return analytics.categoryBreakdown.map(category => ({
      category: category._id,
      transactions: category.transactionCount,
      value: category.totalValue,
      inQuantity: category.inQuantity,
      outQuantity: category.outQuantity
    }));
  };

  const prepareTransactionTypeData = () => {
    if (!analytics) return [];

    return analytics.summary.map(item => ({
      type: item._id,
      count: item.count,
      value: item.totalValue,
      quantity: Math.abs(item.totalQuantity)
    }));
  };

  // Get alerts
  const alerts = useMemo((): AlertInfo[] => {
    const alertList: AlertInfo[] = [];

    if (reorderSuggestions) {
      const urgentReorders = reorderSuggestions.urgentItems || 0;
      if (urgentReorders > 0) {
        alertList.push({
          type: 'critical',
          title: 'Urgent Reorder Required',
          message: `${urgentReorders} items require immediate reordering`,
          count: urgentReorders
        });
      }

      const totalSuggestions = reorderSuggestions.totalSuggestions || 0;
      if (totalSuggestions > 0) {
        alertList.push({
          type: 'warning',
          title: 'Reorder Suggestions',
          message: `${totalSuggestions} items suggested for reordering`,
          count: totalSuggestions
        });
      }
    }

    if (lowStockAlerts) {
      const criticalAlerts = lowStockAlerts.criticalAlerts || 0;
      if (criticalAlerts > 0) {
        alertList.push({
          type: 'critical',
          title: 'Critical Stock Levels',
          message: `${criticalAlerts} items at critical stock levels`,
          count: criticalAlerts
        });
      }

      const warningAlerts = lowStockAlerts.warningAlerts || 0;
      if (warningAlerts > 0) {
        alertList.push({
          type: 'warning',
          title: 'Low Stock Warnings',
          message: `${warningAlerts} items below recommended levels`,
          count: warningAlerts
        });
      }
    }

    if (summaryMetrics && summaryMetrics.netFlow < 0) {
      alertList.push({
        type: 'info',
        title: 'Negative Net Flow',
        message: 'More stock is going out than coming in'
      });
    }

    return alertList;
  }, [reorderSuggestions, lowStockAlerts, summaryMetrics]);

  const COLORS = ['#10B981', '#EF4444', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <FaChartBar className="h-6 w-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">Transaction Analytics</h2>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={refreshData}
            disabled={refreshing}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <FaRefresh className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            onClick={exportAnalytics}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <FaDownload className="h-4 w-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <FaInfoCircle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {alerts.map((alert, index) => (
            <div
              key={`alerts-${index}-${alert.type}`}
              className={`p-4 rounded-md border ${
                alert.type === 'critical'
                  ? 'bg-red-50 border-red-200'
                  : alert.type === 'warning'
                  ? 'bg-yellow-50 border-yellow-200'
                  : 'bg-blue-50 border-blue-200'
              }`}
            >
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <FaInfoCircle
                    className={`h-5 w-5 ${
                      alert.type === 'critical'
                        ? 'text-red-400'
                        : alert.type === 'warning'
                        ? 'text-yellow-400'
                        : 'text-blue-400'
                    }`}
                  />
                </div>
                <div className="ml-3">
                  <h3
                    className={`text-sm font-medium ${
                      alert.type === 'critical'
                        ? 'text-red-800'
                        : alert.type === 'warning'
                        ? 'text-yellow-800'
                        : 'text-blue-800'
                    }`}
                  >
                    {alert.title}
                  </h3>
                  <p
                    className={`text-sm ${
                      alert.type === 'critical'
                        ? 'text-red-700'
                        : alert.type === 'warning'
                        ? 'text-yellow-700'
                        : 'text-blue-700'
                    }`}
                  >
                    {alert.message}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex space-x-2">
            {(['week', 'month', 'quarter', 'year'] as const).map(period => (
              <button aria-label="Filter"
                key={period}
                onClick={() => setPeriod(period)}
                className={`px-3 py-2 text-sm font-medium rounded-md ${
                  filters.period === period
                    ? 'bg-blue-100 text-blue-700 border border-blue-300'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </button>
            ))}
          </div>

          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => updateFilter('startDate', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />

          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => updateFilter('endDate', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />

          <input
            type="text"
            placeholder="Filter by category"
            value={filters.category}
            onChange={(e) => updateFilter('category', e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Summary Cards */}
      {summaryMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <FaBox className="h-6 w-6 text-blue-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Total Transactions
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {summaryMetrics.totalTransactions.toLocaleString()}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <FaDollarSign className="h-6 w-6 text-green-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Total Value
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      ${summaryMetrics.totalValue.toFixed(2)}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  {summaryMetrics.netFlow >= 0 ? (
                    <FaTrendingUp className="h-6 w-6 text-green-400" />
                  ) : (
                    <FaTrendingDown className="h-6 w-6 text-red-400" />
                  )}
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Net Flow
                    </dt>
                    <dd className={`text-lg font-medium ${
                      summaryMetrics.netFlow >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {summaryMetrics.netFlow >= 0 ? '+' : ''}{summaryMetrics.netFlow.toFixed(0)}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <FaExchangeAlt className="h-6 w-6 text-purple-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Avg Daily Transactions
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {analytics && analytics.dailyTrends.length > 0
                        ? Math.round(summaryMetrics.totalTransactions / analytics.dailyTrends.length)
                        : 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Transaction Trends */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Transaction Trends</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={prepareTrendData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip labelFormatter={(value) => `Date: ${value}`} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="transactions"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  name="Transactions"
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#10B981"
                  strokeWidth={2}
                  name="Value ($)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Transaction Types */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Transaction Types</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={prepareTransactionTypeData()}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ type, count }) => `${type}: ${count}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {prepareTransactionTypeData().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Category Breakdown</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={prepareCategoryData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="transactions" fill="#3B82F6" name="Transactions" />
                <Bar dataKey="value" fill="#10B981" name="Value ($)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* In vs Out Flow */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Stock Flow</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={prepareTrendData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="inTransactions"
                  stackId="1"
                  stroke="#10B981"
                  fill="#10B981"
                  name="Stock In"
                />
                <Area
                  type="monotone"
                  dataKey="outTransactions"
                  stackId="1"
                  stroke="#EF4444"
                  fill="#EF4444"
                  name="Stock Out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top Active Items */}
      {analytics && analytics.topActiveItems.length > 0 && (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Most Active Items
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Item
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Transactions
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Quantity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Value
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {analytics.topActiveItems.map((item, index) => (
                    <tr key={`analytics-topActiveItems-${index}-${item.category}`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {item.itemName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.category}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.transactionCount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.totalQuantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${item.totalValue.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Period Summary */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Period Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{summaryMetrics?.totalIn || 0}</div>
            <div className="text-sm text-gray-500">Total Stock In</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{summaryMetrics?.totalOut || 0}</div>
            <div className="text-sm text-gray-500">Total Stock Out</div>
          </div>
          <div className="text-center">
            <div className={`text-2xl font-bold ${
              (summaryMetrics?.netFlow || 0) >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {summaryMetrics?.netFlow || 0}
            </div>
            <div className="text-sm text-gray-500">Net Flow</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransactionAnalytics;
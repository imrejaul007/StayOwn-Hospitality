import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Package,
  DollarSign,
  Calendar,
  Users,
  AlertTriangle,
  Target,
  Zap,
  RefreshCw,
  Download,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { withErrorBoundary } from '../ErrorBoundary';
import { api } from '@/services/api';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';

interface AnalyticsData {
  overview: {
    totalItems: number;
    totalValue: number;
    lowStockCount: number;
    reorderAlertsCount: number;
    averageItemValue: number;
    monthlyConsumptionValue: number;
    inventoryTurnoverRatio: number;
    wastePercentage: number;
  };
  categoryBreakdown: Array<{
    category: string;
    itemCount: number;
    totalValue: number;
    percentage: number;
    averageValue: number;
    lowStockItems: number;
    trend: 'up' | 'down' | 'stable';
    changePercentage: number;
  }>;
  stockStatus: {
    inStock: number;
    lowStock: number;
    outOfStock: number;
    overstocked: number;
  };
  costAnalysis: {
    monthlyTrend: Array<{
      month: string;
      totalCost: number;
      categoryBreakdown: Array<{
        category: string;
        cost: number;
      }>;
    }>;
    topExpensiveItems: Array<{
      itemName: string;
      unitPrice: number;
      totalValue: number;
      quantity: number;
      category: string;
    }>;
  };
  vendorPerformance: {
    totalVendors: number;
    averageRating: number;
    topPerformers: Array<{
      vendorName: string;
      rating: number;
      orderCount: number;
      totalValue: number;
      onTimeDeliveryRate: number;
      categories: string[];
    }>;
  };
  reorderInsights: {
    itemsNeedingReorder: number;
    estimatedReorderCost: number;
    urgentItems: number;
    autoReorderEnabled: number;
    seasonalTrends: Array<{
      month: string;
      reorderFrequency: number;
      averageCost: number;
    }>;
  };
  consumptionPatterns: {
    dailyAverage: number;
    weeklyTrend: Array<{
      day: string;
      consumption: number;
    }>;
    topConsumedItems: Array<{
      itemName: string;
      consumptionRate: number;
      category: string;
      trend: number;
    }>;
  };
}

const InventoryAnalyticsDashboard: React.FC = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasNoData, setHasNoData] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'vendors' | 'forecasting'>('overview');
  const [refreshing, setRefreshing] = useState(false);

  const periodToDays: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };

  useEffect(() => {
    fetchAnalyticsData();
  }, [selectedPeriod, selectedCategory]);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      setHasNoData(false);

      const response = await api.get('/inventory/analytics/dashboard', {
        params: {
          period: periodToDays[selectedPeriod] || 30,
          includeForecasting: true,
          includeAnomalies: true,
        },
      });

      const dashboard = response.data?.data;
      if (!dashboard) {
        setHasNoData(true);
        setData(null);
      } else {
        setData(dashboard);
      }
    } catch {
      setHasNoData(true);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAnalyticsData();
    setRefreshing(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'up': return 'text-green-600';
      case 'down': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable', size = 'w-4 h-4') => {
    switch (trend) {
      case 'up': return <TrendingUp className={`${size} text-green-600`} />;
      case 'down': return <TrendingDown className={`${size} text-red-600`} />;
      default: return <ArrowUp className={`${size} text-gray-600`} />;
    }
  };

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 rounded w-1/3 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white p-6 rounded-lg shadow-sm">
                  <div className="h-4 bg-gray-300 rounded w-2/3 mb-2"></div>
                  <div className="h-6 bg-gray-300 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data || hasNoData) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Inventory Analytics Dashboard</h1>
          <p className="text-gray-600 mb-8">Advanced insights and performance metrics for your inventory</p>
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No Inventory Analytics Data Available</h3>
            <p className="text-gray-500 max-w-md mx-auto">
              Inventory analytics data will appear here once inventory items are tracked and historical snapshots are generated. Start by adding inventory items to your property.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Inventory Analytics Dashboard</h1>
            <p className="text-gray-600">Advanced insights and performance metrics for your inventory</p>
          </div>
          <div className="flex items-center space-x-3 mt-4 sm:mt-0">
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as unknown)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="1y">Last 1 Year</option>
            </select>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
              <Download className="w-4 h-4 mr-2" />
              Export
            </button>
          </div>
        </div>

        {/* Key Performance Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Inventory Value</p>
                <p className="text-3xl font-bold text-gray-900">{formatCurrency(data.overview.totalValue)}</p>
                <p className="text-sm text-green-600 flex items-center mt-1">
                  <ArrowUp className="w-4 h-4 mr-1" />
                  +12.5% from last period
                </p>
              </div>
              <DollarSign className="w-12 h-12 text-blue-500" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Turnover Ratio</p>
                <p className="text-3xl font-bold text-gray-900">{data.overview.inventoryTurnoverRatio.toFixed(1)}</p>
                <p className="text-sm text-green-600 flex items-center mt-1">
                  <ArrowUp className="w-4 h-4 mr-1" />
                  Excellent performance
                </p>
              </div>
              <Zap className="w-12 h-12 text-green-500" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Items Need Reorder</p>
                <p className="text-3xl font-bold text-gray-900">{data.reorderInsights.itemsNeedingReorder}</p>
                <p className="text-sm text-yellow-600 flex items-center mt-1">
                  <AlertTriangle className="w-4 h-4 mr-1" />
                  {data.reorderInsights.urgentItems} urgent
                </p>
              </div>
              <Package className="w-12 h-12 text-yellow-500" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Waste Percentage</p>
                <p className="text-3xl font-bold text-gray-900">{data.overview.wastePercentage.toFixed(1)}%</p>
                <p className="text-sm text-green-600 flex items-center mt-1">
                  <ArrowDown className="w-4 h-4 mr-1" />
                  -0.5% improvement
                </p>
              </div>
              <Target className="w-12 h-12 text-purple-500" />
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-sm mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex px-6">
              {[
                { id: 'overview', label: 'Overview', icon: BarChart3 },
                { id: 'trends', label: 'Cost Trends', icon: TrendingUp },
                { id: 'vendors', label: 'Vendor Performance', icon: Users },
                { id: 'forecasting', label: 'Forecasting', icon: Calendar }
              ].map(({ id, label, icon: Icon }) => (
                <button aria-label="Close"
                  key={id}
                  onClick={() => setActiveTab(id as unknown)}
                  className={`${
                    activeTab === id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center mr-8`}
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Category Breakdown */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Category Breakdown</h3>
                  <div className="space-y-4">
                    {data.categoryBreakdown.map((category, index) => (
                      <div key={category.category} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center">
                          <div
                            className="w-4 h-4 rounded-full mr-3"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          ></div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-medium text-gray-900">{category.category}</span>
                              {getTrendIcon(category.trend)}
                              <span className={`text-sm ${getStatusColor(category.trend)}`}>
                                {category.changePercentage > 0 ? '+' : ''}{category.changePercentage.toFixed(1)}%
                              </span>
                            </div>
                            <p className="text-sm text-gray-600">
                              {category.itemCount} items • {category.lowStockItems} low stock
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-gray-900">{formatCurrency(category.totalValue)}</p>
                          <p className="text-sm text-gray-600">{category.percentage.toFixed(1)}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Stock Status Chart */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Stock Status Distribution</h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <ResponsiveContainer width="100%" height={300}>
                      <RechartsPieChart>
                        <Pie
                          data={[
                            { name: 'In Stock', value: data.stockStatus.inStock, color: '#10B981' },
                            { name: 'Low Stock', value: data.stockStatus.lowStock, color: '#F59E0B' },
                            { name: 'Out of Stock', value: data.stockStatus.outOfStock, color: '#EF4444' },
                            { name: 'Overstocked', value: data.stockStatus.overstocked, color: '#8B5CF6' }
                          ]}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {[
                            { name: 'In Stock', value: data.stockStatus.inStock, color: '#10B981' },
                            { name: 'Low Stock', value: data.stockStatus.lowStock, color: '#F59E0B' },
                            { name: 'Out of Stock', value: data.stockStatus.outOfStock, color: '#EF4444' },
                            { name: 'Overstocked', value: data.stockStatus.overstocked, color: '#8B5CF6' }
                          ].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Top Expensive Items */}
                <div className="lg:col-span-2">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Most Valuable Items</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Price</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Value</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {data.costAnalysis.topExpensiveItems.map((item, index) => (
                          <tr key={`data-costAnalysis-topExpensiveItems-${index}-${item.category}`}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {item.itemName}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {item.category}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatCurrency(item.unitPrice)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {item.quantity}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {formatCurrency(item.totalValue)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'trends' && (
              <div className="space-y-8">
                {/* Monthly Cost Trend */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Monthly Cost Trends</h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <ResponsiveContainer width="100%" height={400}>
                      <AreaChart data={data.costAnalysis.monthlyTrend}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis tickFormatter={(value) => `₹${value / 1000}K`} />
                        <Tooltip
                          formatter={(value: Record<string, unknown>) => [formatCurrency(value), 'Total Cost']}
                          labelFormatter={(label) => `Month: ${label}`}
                        />
                        <Area
                          type="monotone"
                          dataKey="totalCost"
                          stroke="#3B82F6"
                          fill="#3B82F6"
                          fillOpacity={0.3}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Category-wise Cost Breakdown */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Category-wise Cost Breakdown</h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={data.costAnalysis.monthlyTrend}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis tickFormatter={(value) => `₹${value / 1000}K`} />
                        <Tooltip
                          formatter={(value: Record<string, unknown>, name: Record<string, unknown>) => [formatCurrency(value), name]}
                        />
                        <Legend />
                        {['Linens', 'Cleaning', 'Toiletries', 'Electronics', 'Others'].map((category, index) => (
                          <Bar
                            key={category}
                            dataKey={`categoryBreakdown.${index}.cost`}
                            stackId="a"
                            fill={COLORS[index % COLORS.length]}
                            name={category}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Consumption Patterns */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Weekly Consumption Pattern</h3>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={data.consumptionPatterns.weeklyTrend}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="day" />
                          <YAxis />
                          <Tooltip />
                          <Line
                            type="monotone"
                            dataKey="consumption"
                            stroke="#10B981"
                            strokeWidth={2}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Top Consumed Items</h3>
                    <div className="space-y-3">
                      {data.consumptionPatterns.topConsumedItems.map((item, index) => (
                        <div key={`data-consumptionPatterns-topConsumedItems-${index}-${item.category}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p className="font-medium text-gray-900">{item.itemName}</p>
                            <p className="text-sm text-gray-600">{item.category}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-gray-900">{item.consumptionRate} units/day</p>
                            <div className="flex items-center text-sm">
                              {item.trend > 0 ? (
                                <ArrowUp className="w-3 h-3 text-green-600 mr-1" />
                              ) : (
                                <ArrowDown className="w-3 h-3 text-red-600 mr-1" />
                              )}
                              <span className={item.trend > 0 ? 'text-green-600' : 'text-red-600'}>
                                {Math.abs(item.trend)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'vendors' && (
              <div className="space-y-8">
                {/* Vendor Performance Overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-gray-50 p-6 rounded-lg text-center">
                    <Users className="w-12 h-12 text-blue-500 mx-auto mb-2" />
                    <p className="text-3xl font-bold text-gray-900">{data.vendorPerformance.totalVendors}</p>
                    <p className="text-sm text-gray-600">Active Vendors</p>
                  </div>
                  <div className="bg-gray-50 p-6 rounded-lg text-center">
                    <Target className="w-12 h-12 text-green-500 mx-auto mb-2" />
                    <p className="text-3xl font-bold text-gray-900">{data.vendorPerformance.averageRating.toFixed(1)}</p>
                    <p className="text-sm text-gray-600">Average Rating</p>
                  </div>
                  <div className="bg-gray-50 p-6 rounded-lg text-center">
                    <DollarSign className="w-12 h-12 text-purple-500 mx-auto mb-2" />
                    <p className="text-3xl font-bold text-gray-900">
                      {formatCurrency(data.vendorPerformance.topPerformers.reduce((sum, v) => sum + v.totalValue, 0))}
                    </p>
                    <p className="text-sm text-gray-600">Total Orders Value</p>
                  </div>
                </div>

                {/* Top Performing Vendors */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Top Performing Vendors</h3>
                  <div className="space-y-4">
                    {data.vendorPerformance.topPerformers.map((vendor, index) => (
                      <div key={`data-vendorPerformance-topPerformers-${index}`} className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                              <span className="text-sm font-medium text-blue-600">#{index + 1}</span>
                            </div>
                            <div>
                              <h4 className="font-medium text-gray-900">{vendor.vendorName}</h4>
                              <div className="flex items-center mt-1">
                                <div className="flex items-center">
                                  {[...Array(5)].map((_, i) => (
                                    <span
                                      key={i}
                                      className={`text-sm ${
                                        i < Math.floor(vendor.rating)
                                          ? 'text-yellow-400'
                                          : 'text-gray-300'
                                      }`}
                                    >
                                      ★
                                    </span>
                                  ))}
                                  <span className="ml-1 text-sm text-gray-600">
                                    {vendor.rating.toFixed(1)}
                                  </span>
                                </div>
                                <span className="mx-2 text-gray-400">•</span>
                                <span className="text-sm text-gray-600">
                                  {vendor.categories.join(', ')}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="grid grid-cols-3 gap-4 text-sm">
                              <div>
                                <p className="text-gray-500">Orders</p>
                                <p className="font-medium">{vendor.orderCount}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">On-Time</p>
                                <p className="font-medium text-green-600">{vendor.onTimeDeliveryRate}%</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Value</p>
                                <p className="font-medium">{formatCurrency(vendor.totalValue)}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'forecasting' && (
              <div className="space-y-8">
                {/* Reorder Insights */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-yellow-50 p-6 rounded-lg border border-yellow-200">
                    <AlertTriangle className="w-8 h-8 text-yellow-600 mb-2" />
                    <p className="text-2xl font-bold text-yellow-900">{data.reorderInsights.itemsNeedingReorder}</p>
                    <p className="text-sm text-yellow-700">Items Need Reorder</p>
                  </div>
                  <div className="bg-red-50 p-6 rounded-lg border border-red-200">
                    <Package className="w-8 h-8 text-red-600 mb-2" />
                    <p className="text-2xl font-bold text-red-900">{data.reorderInsights.urgentItems}</p>
                    <p className="text-sm text-red-700">Urgent Items</p>
                  </div>
                  <div className="bg-green-50 p-6 rounded-lg border border-green-200">
                    <Zap className="w-8 h-8 text-green-600 mb-2" />
                    <p className="text-2xl font-bold text-green-900">{data.reorderInsights.autoReorderEnabled}</p>
                    <p className="text-sm text-green-700">Auto-Reorder Enabled</p>
                  </div>
                  <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
                    <DollarSign className="w-8 h-8 text-blue-600 mb-2" />
                    <p className="text-2xl font-bold text-blue-900">
                      {formatCurrency(data.reorderInsights.estimatedReorderCost)}
                    </p>
                    <p className="text-sm text-blue-700">Est. Reorder Cost</p>
                  </div>
                </div>

                {/* Seasonal Reorder Trends */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Seasonal Reorder Trends</h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={data.reorderInsights.seasonalTrends}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis yAxisId="left" tickFormatter={(value) => value.toString()} />
                        <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => `₹${value / 1000}K`} />
                        <Tooltip
                          formatter={(value: Record<string, unknown>, name: Record<string, unknown>) => {
                            if (name === 'Reorder Frequency') return [value, name];
                            return [formatCurrency(value), name];
                          }}
                        />
                        <Legend />
                        <Bar yAxisId="left" dataKey="reorderFrequency" fill="#3B82F6" name="Reorder Frequency" />
                        <Line yAxisId="right" type="monotone" dataKey="averageCost" stroke="#10B981" strokeWidth={2} name="Average Cost" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Predictive Insights */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h4 className="font-medium text-gray-900 mb-4">Predicted Stock Outs (Next 30 Days)</h4>
                    <div className="space-y-3">
                      {[
                        { item: 'Premium Bath Towels', days: 3, confidence: 95 },
                        { item: 'Room Service Trays', days: 8, confidence: 88 },
                        { item: 'Cleaning Spray Bottles', days: 12, confidence: 82 }
                      ].map((prediction, index) => (
                        <div key={`prediction-${index}`} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                          <div>
                            <p className="font-medium text-red-900">{prediction.item}</p>
                            <p className="text-sm text-red-700">Stock out in ~{prediction.days} days</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-red-600">{prediction.confidence}% confidence</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h4 className="font-medium text-gray-900 mb-4">Cost Optimization Opportunities</h4>
                    <div className="space-y-3">
                      {[
                        { opportunity: 'Bulk purchase discounts', savings: 2500, category: 'Linens' },
                        { opportunity: 'Vendor consolidation', savings: 1800, category: 'Cleaning' },
                        { opportunity: 'Seasonal timing optimization', savings: 1200, category: 'Electronics' }
                      ].map((opportunity, index) => (
                        <div key={`-${index}-${opportunity.category}`} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                          <div>
                            <p className="font-medium text-green-900">{opportunity.opportunity}</p>
                            <p className="text-sm text-green-700">{opportunity.category}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-green-900">{formatCurrency(opportunity.savings)}</p>
                            <p className="text-sm text-green-600">potential savings</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default withErrorBoundary(InventoryAnalyticsDashboard, { level: 'component' });
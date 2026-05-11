import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ScatterChart,
  Scatter
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Calendar,
  Filter,
  Download,
  RefreshCw,
  AlertTriangle,
  BarChart3,
  Zap,
  Target,
  Eye
} from 'lucide-react';
import { api } from '../../services/api';

interface TrendDataPoint {
  period: {
    year: number;
    month?: number;
    week?: number;
    day?: number;
  };
  avgStockLevel: number;
  avgConsumptionRate: number;
  avgTotalValue: number;
  minStock: number;
  maxStock: number;
  dataPoints: number;
}

interface TrendItem {
  itemId: string;
  name: string;
  category: string;
  periods: TrendDataPoint[];
  overallTrend: 'increasing' | 'decreasing' | 'stable' | 'volatile';
  volatility: number;
  seasonality: number | null;
}

interface AnomalyData {
  itemId: string;
  name: string;
  category: string;
  currentConsumption: number;
  averageConsumption: number;
  standardDeviation: number;
  zScore: number;
  anomalyType: 'spike' | 'drop';
  severity: 'low' | 'medium' | 'high' | 'critical';
  dataPoints: number;
}

interface SeasonalPattern {
  month: number;
  quarter: number;
  avgConsumption: number;
  avgStock: number;
  dataPoints: number;
  seasonalIndex: number;
}

const COLORS = {
  primary: '#3B82F6',
  secondary: '#8B5CF6',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  gray: '#6B7280'
};

const CHART_COLORS = [
  '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B',
  '#EF4444', '#06B6D4', '#84CC16', '#F97316'
];

const InventoryTrendAnalysis: React.FC = () => {
  const [trendData, setTrendData] = useState<TrendItem[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyData[]>([]);
  const [seasonalPatterns, setSeasonalPatterns] = useState<Record<string, SeasonalPattern[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState('30');
  const [selectedGranularity, setSelectedGranularity] = useState('daily');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'trends' | 'anomalies' | 'seasonal'>('trends');

  const categories = [
    'bedding', 'toiletries', 'minibar', 'electronics', 'amenities', 'cleaning', 'furniture'
  ];

  useEffect(() => {
    fetchTrendData();
    fetchAnomalies();
    fetchSeasonalPatterns();
  }, [selectedTimeRange, selectedGranularity, selectedCategories]);

  const fetchTrendData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        granularity: selectedGranularity,
        startDate: new Date(Date.now() - parseInt(selectedTimeRange) * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString()
      });

      if (selectedCategories.length > 0) {
        params.append('categories', selectedCategories.join(','));
      }

      if (selectedItems.length > 0) {
        params.append('itemIds', selectedItems.join(','));
      }

      const { data } = await api.get(`/inventory/analytics/historical-trends?${params}`);
      setTrendData(data.data.trends);
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  const fetchAnomalies = async () => {
    try {
      const params = new URLSearchParams({
        threshold: '2',
        lookbackDays: selectedTimeRange
      });

      if (selectedItems.length > 0) {
        params.append('itemIds', selectedItems.join(','));
      }

      const { data } = await api.get(`/inventory/analytics/anomalies?${params}`);
      setAnomalies(data.data.anomalies);
    } catch {
      // Error handled silently
    }
  };

  const fetchSeasonalPatterns = async () => {
    try {
      const { data: data } = await api.get('/inventory/analytics/seasonal-patterns');
      setSeasonalPatterns(data.data.patterns);
    } catch {
      // Error handled silently
    }
  };

  const prepareChartData = (item: TrendItem) => {
    return item.periods.map(period => ({
      period: `${period.period.year}-${period.period.month || period.period.week || period.period.day}`,
      stockLevel: period.avgStockLevel,
      consumption: period.avgConsumptionRate,
      value: period.avgTotalValue,
      minStock: period.minStock,
      maxStock: period.maxStock
    }));
  };

  const prepareSeasonalChartData = (patterns: SeasonalPattern[]) => {
    return patterns.map(pattern => ({
      month: `Month ${pattern.month}`,
      consumption: pattern.avgConsumption,
      stock: pattern.avgStock,
      seasonalIndex: pattern.seasonalIndex,
      quarter: `Q${pattern.quarter}`
    }));
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'increasing':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'decreasing':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      case 'volatile':
        return <Activity className="w-4 h-4 text-orange-500" />;
      default:
        return <Target className="w-4 h-4 text-blue-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600 bg-red-100';
      case 'high':
        return 'text-orange-600 bg-orange-100';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-blue-600 bg-blue-100';
    }
  };

  const exportData = () => {
    // Implement data export functionality
    const dataToExport = {
      trends: trendData,
      anomalies,
      seasonalPatterns,
      exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-trend-analysis-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
          <span className="ml-2 text-gray-600">Loading trend analysis...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Inventory Trend Analysis</h2>
            <p className="text-gray-600 mt-1">
              Analyze consumption patterns, detect anomalies, and identify seasonal trends
            </p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={fetchTrendData}
              className="flex items-center px-4 py-2 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </button>
            <button
              onClick={exportData}
              className="flex items-center px-4 py-2 text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Time Range
            </label>
            <select
              value={selectedTimeRange}
              onChange={(e) => setSelectedTimeRange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="180">Last 6 months</option>
              <option value="365">Last year</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Granularity
            </label>
            <select
              value={selectedGranularity}
              onChange={(e) => setSelectedGranularity(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Categories
            </label>
            <select
              multiple
              value={selectedCategories}
              onChange={(e) => setSelectedCategories(Array.from(e.target.selectedOptions, option => option.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {categories.map(category => (
                <option key={category} value={category}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              View Type
            </label>
            <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
              {['trends', 'anomalies', 'seasonal'].map((tab) => (
                <button aria-label="Close"
                  key={tab}
                  onClick={() => setActiveTab(tab as typeof activeTab)}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === tab
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Trends Tab */}
      {activeTab === 'trends' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Items Analyzed</p>
                  <p className="text-2xl font-bold text-gray-900">{trendData.length}</p>
                </div>
                <BarChart3 className="w-8 h-8 text-blue-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Increasing Trends</p>
                  <p className="text-2xl font-bold text-green-600">
                    {trendData.filter(item => item.overallTrend === 'increasing').length}
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Volatile Items</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {trendData.filter(item => item.overallTrend === 'volatile').length}
                  </p>
                </div>
                <Activity className="w-8 h-8 text-orange-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Seasonal Items</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {trendData.filter(item => item.seasonality !== null).length}
                  </p>
                </div>
                <Calendar className="w-8 h-8 text-purple-500" />
              </div>
            </div>
          </div>

          {/* Trend Charts */}
          {trendData.slice(0, 6).map((item, index) => (
            <div key={item.itemId} className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{item.name}</h3>
                  <div className="flex items-center space-x-4 mt-1">
                    <span className="text-sm text-gray-600">Category: {item.category}</span>
                    <div className="flex items-center">
                      {getTrendIcon(item.overallTrend)}
                      <span className="ml-1 text-sm text-gray-600 capitalize">
                        {item.overallTrend}
                      </span>
                    </div>
                    <span className="text-sm text-gray-600">
                      Volatility: {(item.volatility * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={prepareChartData(item)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="stockLevel"
                      stroke={CHART_COLORS[index % CHART_COLORS.length]}
                      name="Stock Level"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="consumption"
                      stroke={CHART_COLORS[(index + 1) % CHART_COLORS.length]}
                      name="Consumption Rate"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Anomalies Tab */}
      {activeTab === 'anomalies' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Consumption Anomalies</h3>

            {anomalies.length === 0 ? (
              <div className="text-center py-8">
                <Eye className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">No anomalies detected in the selected period</p>
              </div>
            ) : (
              <div className="space-y-4">
                {anomalies.map((anomaly) => (
                  <div
                    key={anomaly.itemId}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h4 className="font-medium text-gray-900">{anomaly.name}</h4>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(anomaly.severity)}`}>
                            {anomaly.severity.toUpperCase()}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            anomaly.anomalyType === 'spike' ? 'text-red-600 bg-red-100' : 'text-blue-600 bg-blue-100'
                          }`}>
                            {anomaly.anomalyType.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">Category: {anomaly.category}</p>
                        <div className="grid grid-cols-3 gap-4 mt-2 text-sm">
                          <div>
                            <span className="text-gray-600">Current: </span>
                            <span className="font-medium">{anomaly.currentConsumption.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Average: </span>
                            <span className="font-medium">{anomaly.averageConsumption.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Z-Score: </span>
                            <span className="font-medium">{anomaly.zScore.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                      <AlertTriangle className={`w-6 h-6 ${
                        anomaly.severity === 'critical' ? 'text-red-500' :
                        anomaly.severity === 'high' ? 'text-orange-500' :
                        anomaly.severity === 'medium' ? 'text-yellow-500' : 'text-blue-500'
                      }`} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Seasonal Tab */}
      {activeTab === 'seasonal' && (
        <div className="space-y-6">
          {Object.entries(seasonalPatterns).map(([itemId, patterns]) => (
            <div key={itemId} className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Seasonal Patterns - {patterns[0]?.name || itemId}
              </h3>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={prepareSeasonalChartData(patterns)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Legend />
                    <Bar
                      yAxisId="left"
                      dataKey="consumption"
                      fill={COLORS.primary}
                      name="Avg Consumption"
                    />
                    <Bar
                      yAxisId="right"
                      dataKey="seasonalIndex"
                      fill={COLORS.secondary}
                      name="Seasonal Index"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ))}

          {Object.keys(seasonalPatterns).length === 0 && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">No seasonal patterns available</p>
                <p className="text-sm text-gray-500 mt-1">
                  Seasonal analysis requires at least 12 months of data
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default InventoryTrendAnalysis;
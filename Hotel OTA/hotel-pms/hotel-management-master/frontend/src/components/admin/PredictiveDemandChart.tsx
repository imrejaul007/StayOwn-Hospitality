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
  ComposedChart,
  ReferenceLine,
  Brush
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Target,
  AlertTriangle,
  Clock,
  Package,
  Calendar,
  Zap,
  RefreshCw,
  Download,
  Filter,
  Eye,
  BarChart3,
  Activity
} from 'lucide-react';
import { api } from '../../services/api';

interface ForecastData {
  itemId: string;
  name: string;
  category: string;
  currentStock: number;
  projectedStock: number;
  projectedConsumption: number;
  avgDailyConsumption: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendedAction: string;
  estimatedStockoutDate: string | null;
  seasonalMultiplier: number;
  adjustedAvgDailyConsumption: number;
  adjustedProjectedConsumption: number;
  adjustedProjectedStock: number;
  confidence: {
    level: number;
    lowerBound: number;
    upperBound: number;
    marginOfError: number;
  };
  forecastAccuracy: number;
}

interface ChartDataPoint {
  date: string;
  actual: number;
  forecast: number;
  lowerBound: number;
  upperBound: number;
  consumption: number;
  stockLevel: number;
}

const COLORS = {
  primary: '#3B82F6',
  secondary: '#8B5CF6',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  gray: '#6B7280'
};

const PredictiveDemandChart: React.FC = () => {
  const [forecastData, setForecastData] = useState<ForecastData[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<string>('');
  const [forecastDays, setForecastDays] = useState('30');
  const [confidenceLevel, setConfidenceLevel] = useState('0.95');
  const [includeSeasonality, setIncludeSeasonality] = useState(true);
  const [selectedRiskLevel, setSelectedRiskLevel] = useState<string>('all');

  useEffect(() => {
    fetchPredictiveData();
  }, [forecastDays, confidenceLevel, includeSeasonality]);

  useEffect(() => {
    if (selectedItem && forecastData.length > 0) {
      generateChartData(selectedItem);
    }
  }, [selectedItem, forecastData]);

  const fetchPredictiveData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        forecastDays,
        includeSeasonality: includeSeasonality.toString(),
        confidenceLevel
      });

      const { data } = await api.get(`/inventory/analytics/predictive-demand?${params}`);
      setForecastData(data.data.forecast);

      // Auto-select first item for chart
      if (data.data.forecast.length > 0) {
        setSelectedItem(data.data.forecast[0].itemId);
      }
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  const generateChartData = async (itemId: string) => {
    try {
      // Get historical data for the selected item
      const { data } = await api.get(`/inventory/analytics/historical-trends?itemIds=${itemId}&granularity=daily`);
      const item = forecastData.find(f => f.itemId === itemId);

      if (data.data.trends.length > 0 && item) {
        const historicalData = data.data.trends[0];
        const chartPoints: ChartDataPoint[] = [];

        // Add historical data points
        historicalData.periods.forEach((period: Record<string, unknown>, index: number) => {
          const date = new Date();
          date.setDate(date.getDate() - (historicalData.periods.length - index));

          chartPoints.push({
            date: date.toISOString().split('T')[0],
            actual: period.avgStockLevel,
            forecast: period.avgStockLevel, // Historical actual = forecast for past
            lowerBound: period.minStock,
            upperBound: period.maxStock,
            consumption: period.avgConsumptionRate,
            stockLevel: period.avgStockLevel
          });
        });

        // Add forecast data points
        const forecastDaysNum = parseInt(forecastDays);
        for (let i = 1; i <= forecastDaysNum; i++) {
          const date = new Date();
          date.setDate(date.getDate() + i);

          const dayConsumption = item.adjustedAvgDailyConsumption;
          const projectedStock = Math.max(0, item.currentStock - (dayConsumption * i));

          chartPoints.push({
            date: date.toISOString().split('T')[0],
            actual: 0, // No actual data for future
            forecast: projectedStock,
            lowerBound: Math.max(0, projectedStock - item.confidence.marginOfError),
            upperBound: projectedStock + item.confidence.marginOfError,
            consumption: dayConsumption,
            stockLevel: projectedStock
          });
        }

        setChartData(chartPoints);
      }
    } catch {
      // Error handled silently
    }
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'critical':
        return 'text-red-600 bg-red-100';
      case 'high':
        return 'text-orange-600 bg-orange-100';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-green-600 bg-green-100';
    }
  };

  const getRiskIcon = (riskLevel: string) => {
    switch (riskLevel) {
      case 'critical':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'high':
        return <TrendingDown className="w-4 h-4 text-orange-500" />;
      case 'medium':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <Target className="w-4 h-4 text-green-500" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const exportData = () => {
    const dataToExport = {
      forecastData,
      chartData,
      parameters: {
        forecastDays: parseInt(forecastDays),
        confidenceLevel: parseFloat(confidenceLevel),
        includeSeasonality
      },
      exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `predictive-demand-forecast-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredForecastData = forecastData.filter(item =>
    selectedRiskLevel === 'all' || item.riskLevel === selectedRiskLevel
  );

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
          <span className="ml-2 text-gray-600">Loading predictive demand analysis...</span>
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
            <h2 className="text-2xl font-bold text-gray-900">Predictive Demand Forecasting</h2>
            <p className="text-gray-600 mt-1">
              AI-powered demand forecasting with confidence intervals and seasonal adjustments
            </p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={fetchPredictiveData}
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

        {/* Configuration */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Forecast Period
            </label>
            <select
              value={forecastDays}
              onChange={(e) => setForecastDays(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
              <option value="60">60 days</option>
              <option value="90">90 days</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confidence Level
            </label>
            <select
              value={confidenceLevel}
              onChange={(e) => setConfidenceLevel(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="0.80">80%</option>
              <option value="0.90">90%</option>
              <option value="0.95">95%</option>
              <option value="0.99">99%</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Risk Filter
            </label>
            <select
              value={selectedRiskLevel}
              onChange={(e) => setSelectedRiskLevel(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Risk Levels</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Item for Chart
            </label>
            <select
              value={selectedItem}
              onChange={(e) => setSelectedItem(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {forecastData.map((item) => (
                <option key={item.itemId} value={item.itemId}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={includeSeasonality}
                onChange={(e) => setIncludeSeasonality(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Include Seasonality</span>
            </label>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Critical Risk Items</p>
              <p className="text-2xl font-bold text-red-600">
                {forecastData.filter(item => item.riskLevel === 'critical').length}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Require immediate action
              </p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">High Risk Items</p>
              <p className="text-2xl font-bold text-orange-600">
                {forecastData.filter(item => item.riskLevel === 'high').length}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Needs attention
              </p>
            </div>
            <TrendingDown className="w-8 h-8 text-orange-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Average Accuracy</p>
              <p className="text-2xl font-bold text-blue-600">
                {forecastData.length > 0 ?
                  Math.round(forecastData.reduce((sum, item) => sum + item.forecastAccuracy, 0) / forecastData.length) : 0
                }%
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Forecast reliability
              </p>
            </div>
            <Target className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Seasonal Items</p>
              <p className="text-2xl font-bold text-purple-600">
                {forecastData.filter(item => item.seasonalMultiplier !== 1).length}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                With seasonal patterns
              </p>
            </div>
            <Calendar className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Forecast Chart */}
      {selectedItem && chartData.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Demand Forecast: {forecastData.find(f => f.itemId === selectedItem)?.name}
            </h3>
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-blue-500 rounded"></div>
                <span>Forecast</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span>Historical</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-gray-300 rounded"></div>
                <span>Confidence Interval</span>
              </div>
            </div>
          </div>

          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                />
                <YAxis yAxisId="stock" orientation="left" />
                <YAxis yAxisId="consumption" orientation="right" />
                <Tooltip
                  labelFormatter={formatDate}
                  formatter={(value: Record<string, unknown>, name: string) => [
                    typeof value === 'number' ? value.toFixed(2) : value,
                    name
                  ]}
                />
                <Legend />

                {/* Confidence interval area */}
                <Area
                  yAxisId="stock"
                  type="monotone"
                  dataKey="upperBound"
                  stackId="1"
                  stroke="none"
                  fill="#E5E7EB"
                  fillOpacity={0.3}
                />
                <Area
                  yAxisId="stock"
                  type="monotone"
                  dataKey="lowerBound"
                  stackId="1"
                  stroke="none"
                  fill="#FFFFFF"
                  fillOpacity={1}
                />

                {/* Stock level lines */}
                <Line
                  yAxisId="stock"
                  type="monotone"
                  dataKey="actual"
                  stroke={COLORS.success}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  connectNulls={false}
                  name="Historical Stock"
                />
                <Line
                  yAxisId="stock"
                  type="monotone"
                  dataKey="forecast"
                  stroke={COLORS.primary}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 3 }}
                  name="Forecast Stock"
                />

                {/* Consumption bars */}
                <Bar
                  yAxisId="consumption"
                  dataKey="consumption"
                  fill={COLORS.warning}
                  fillOpacity={0.6}
                  name="Daily Consumption"
                />

                {/* Reference line for current date */}
                <ReferenceLine x={new Date().toISOString().split('T')[0]} stroke="red" strokeDasharray="2 2" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Chart Controls */}
          <div className="mt-4">
            <Brush
              dataKey="date"
              height={30}
              stroke={COLORS.primary}
            />
          </div>
        </div>
      )}

      {/* Forecast Table */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Demand Forecast Summary</h3>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Item
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Current Stock
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Projected Stock
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Daily Consumption
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Risk Level
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stockout Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Accuracy
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredForecastData.map((item) => (
                <tr key={item.itemId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{item.name}</div>
                      <div className="text-sm text-gray-500">{item.category}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.currentStock}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{item.adjustedProjectedStock}</div>
                    <div className="text-xs text-gray-500">
                      ±{item.confidence.marginOfError.toFixed(1)} ({(item.confidence.level * 100).toFixed(0)}% CI)
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{item.adjustedAvgDailyConsumption.toFixed(2)}</div>
                    {item.seasonalMultiplier !== 1 && (
                      <div className="text-xs text-purple-600">
                        ×{item.seasonalMultiplier.toFixed(2)} seasonal
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      {getRiskIcon(item.riskLevel)}
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRiskColor(item.riskLevel)}`}>
                        {item.riskLevel.toUpperCase()}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.estimatedStockoutDate ?
                      formatDate(item.estimatedStockoutDate) :
                      <span className="text-green-600">No stockout</span>
                    }
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="text-sm text-gray-900">{item.forecastAccuracy}%</div>
                      <div className={`ml-2 w-2 h-2 rounded-full ${
                        item.forecastAccuracy >= 90 ? 'bg-green-500' :
                        item.forecastAccuracy >= 75 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}></div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredForecastData.length === 0 && (
            <div className="text-center py-8">
              <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No forecast data available</p>
              <p className="text-sm text-gray-500 mt-1">
                {selectedRiskLevel !== 'all' ?
                  `No items found with ${selectedRiskLevel} risk level` :
                  'Try adjusting the forecast parameters'
                }
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Recommendations */}
      {filteredForecastData.filter(item => item.riskLevel === 'critical' || item.riskLevel === 'high').length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Urgent Recommendations</h3>

          <div className="space-y-3">
            {filteredForecastData
              .filter(item => item.riskLevel === 'critical' || item.riskLevel === 'high')
              .slice(0, 5)
              .map((item) => (
                <div key={item.itemId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    {getRiskIcon(item.riskLevel)}
                    <div>
                      <h4 className="font-medium text-gray-900">{item.name}</h4>
                      <p className="text-sm text-gray-600">{item.recommendedAction}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRiskColor(item.riskLevel)}`}>
                    {item.riskLevel.toUpperCase()}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PredictiveDemandChart;
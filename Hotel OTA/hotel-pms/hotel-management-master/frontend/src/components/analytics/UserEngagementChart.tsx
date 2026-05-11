import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import {
  X,
  LineChart,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Users,
  Activity,
  Target,
  Clock,
  Download,
  RefreshCw,
  Filter,
  Calendar
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface UserEngagementChartProps {
  analytics: unknown;
  onClose: () => void;
}

interface EngagementTrends {
  _id: { year: number; month: number; day: number };
  averageEngagement: number;
  uniqueUserCount: number;
  highEngagementCount: number;
  atRiskCount: number;
}

const UserEngagementChart: React.FC<UserEngagementChartProps> = ({
  analytics,
  onClose
}) => {
  const [trends, setTrends] = useState<EngagementTrends[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  const [timeRange, setTimeRange] = useState('30');
  const [selectedMetric, setSelectedMetric] = useState<'engagement' | 'users' | 'risk'>('engagement');

  useEffect(() => {
    fetchTrends();
  }, [timeRange]);

  const fetchTrends = async () => {
    try {
      setLoading(true);
      
      const queryParams = new URLSearchParams();
      if (timeRange) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(timeRange));
        queryParams.append('dateRange', JSON.stringify({
          start: startDate.toISOString().split('T')[0],
          end: endDate.toISOString().split('T')[0]
        }));
      }

      const { data } = await api.get(`/user-analytics/trends/engagement?${queryParams}`);
      setTrends(data.data);
    } catch (error) {
      toast.error('Failed to fetch engagement trends');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateObj: { year: number; month: number; day: number }) => {
    return `${dateObj.month}/${dateObj.day}`;
  };

  const getMaxValue = () => {
    if (trends.length === 0) return 100;
    
    switch (selectedMetric) {
      case 'engagement':
        return Math.max(...trends.map(t => t.averageEngagement));
      case 'users':
        return Math.max(...trends.map(t => t.uniqueUserCount));
      case 'risk':
        return Math.max(...trends.map(t => t.atRiskCount));
      default:
        return 100;
    }
  };

  const getValue = (trend: EngagementTrends) => {
    switch (selectedMetric) {
      case 'engagement':
        return trend.averageEngagement;
      case 'users':
        return trend.uniqueUserCount;
      case 'risk':
        return trend.atRiskCount;
      default:
        return trend.averageEngagement;
    }
  };

  const getMetricLabel = () => {
    switch (selectedMetric) {
      case 'engagement':
        return 'Average Engagement Score';
      case 'users':
        return 'Unique Users';
      case 'risk':
        return 'At Risk Users';
      default:
        return 'Average Engagement Score';
    }
  };

  const getMetricColor = () => {
    switch (selectedMetric) {
      case 'engagement':
        return 'text-blue-600';
      case 'users':
        return 'text-green-600';
      case 'risk':
        return 'text-red-600';
      default:
        return 'text-blue-600';
    }
  };

  const getTrendDirection = () => {
    if (trends.length < 2) return 'stable';
    
    const first = getValue(trends[0]);
    const last = getValue(trends[trends.length - 1]);
    
    if (last > first * 1.05) return 'up';
    if (last < first * 0.95) return 'down';
    return 'stable';
  };

  const getTrendIcon = () => {
    const direction = getTrendDirection();
    switch (direction) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-red-600" />;
      default:
        return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };

  const getTrendText = () => {
    const direction = getTrendDirection();
    switch (direction) {
      case 'up':
        return 'Increasing';
      case 'down':
        return 'Decreasing';
      default:
        return 'Stable';
    }
  };

  const getTrendColor = () => {
    const direction = getTrendDirection();
    switch (direction) {
      case 'up':
        return 'text-green-600';
      case 'down':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
        <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-4/5 lg:w-3/4 shadow-lg rounded-md bg-white">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Loading engagement trends...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-10 mx-auto p-5 border w-11/12 md:w-4/5 lg:w-3/4 shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            <LineChart className="w-6 h-6 text-blue-600 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">User Engagement Trends</h3>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={fetchTrends}
              disabled={loading}
              className="flex items-center px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button aria-label="Close"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Time Range
              </label>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="7">Last 7 Days</option>
                <option value="30">Last 30 Days</option>
                <option value="90">Last 90 Days</option>
                <option value="365">Last Year</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Chart Type
              </label>
              <select
                value={chartType}
                onChange={(e) => setChartType(e.target.value as 'line' | 'bar')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="line">Line Chart</option>
                <option value="bar">Bar Chart</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Metric
              </label>
              <select
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value as 'engagement' | 'users' | 'risk')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="engagement">Engagement Score</option>
                <option value="users">Unique Users</option>
                <option value="risk">At Risk Users</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => {
                  setTimeRange('30');
                  setChartType('line');
                  setSelectedMetric('engagement');
                }}
                className="w-full flex items-center justify-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
              >
                <Filter className="w-4 h-4 mr-2" />
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <TrendingUp className="w-8 h-8 text-blue-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Current Trend</p>
                <div className="flex items-center">
                  {getTrendIcon()}
                  <span className={`ml-1 text-sm font-medium ${getTrendColor()}`}>
                    {getTrendText()}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <Target className="w-8 h-8 text-green-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Current Value</p>
                <p className={`text-2xl font-bold ${getMetricColor()}`}>
                  {trends.length > 0 ? getValue(trends[trends.length - 1]).toFixed(1) : '0'}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <Activity className="w-8 h-8 text-purple-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Average</p>
                <p className="text-2xl font-bold text-gray-900">
                  {trends.length > 0 ? (trends.reduce((sum, t) => sum + getValue(t), 0) / trends.length).toFixed(1) : '0'}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <Users className="w-8 h-8 text-orange-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Data Points</p>
                <p className="text-2xl font-bold text-gray-900">{trends.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="bg-white shadow-sm rounded-lg border p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-lg font-medium text-gray-900">{getMetricLabel()}</h4>
            <div className="flex items-center space-x-2">
              {chartType === 'line' ? <LineChart className="w-5 h-5 text-blue-600" /> : <BarChart3 className="w-5 h-5 text-blue-600" />}
              <span className="text-sm text-gray-500 capitalize">{chartType} Chart</span>
            </div>
          </div>
          
          {trends.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No engagement trend data available</p>
            </div>
          ) : (
            <div className="h-80">
              {chartType === 'line' ? (
                <div className="relative h-full">
                  <svg className="w-full h-full" viewBox="0 0 800 300">
                    {/* Grid lines */}
                    <defs>
                      <pattern id="grid" width="40" height="30" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 30" fill="none" stroke="#e5e7eb" strokeWidth="1"/>
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                    
                    {/* Y-axis labels */}
                    {[0, 25, 50, 75, 100].map((value, index) => (
                      <text
                        key={value}
                        x="20"
                        y={280 - (index * 60)}
                        className="text-xs fill-gray-500"
                        textAnchor="end"
                      >
                        {Math.round((value / 100) * getMaxValue())}
                      </text>
                    ))}
                    
                    {/* Line chart */}
                    <polyline
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="3"
                      points={trends.map((trend, index) => {
                        const x = 60 + (index * (700 / (trends.length - 1)));
                        const y = 280 - ((getValue(trend) / getMaxValue()) * 240);
                        return `${x},${y}`;
                      }).join(' ')}
                    />
                    
                    {/* Data points */}
                    {trends.map((trend, index) => {
                      const x = 60 + (index * (700 / (trends.length - 1)));
                      const y = 280 - ((getValue(trend) / getMaxValue()) * 240);
                      return (
                        <circle
                          key={trend._id}
                          cx={x}
                          cy={y}
                          r="4"
                          fill="#3b82f6"
                          className="hover:r-6 transition-all"
                        />
                      );
                    })}
                    
                    {/* X-axis labels */}
                    {trends.map((trend, index) => {
                      const x = 60 + (index * (700 / (trends.length - 1)));
                      return (
                        <text
                          key={trend._id}
                          x={x}
                          y="295"
                          className="text-xs fill-gray-500"
                          textAnchor="middle"
                        >
                          {formatDate(trend._id)}
                        </text>
                      );
                    })}
                  </svg>
                </div>
              ) : (
                <div className="relative h-full">
                  <svg className="w-full h-full" viewBox="0 0 800 300">
                    {/* Grid lines */}
                    <defs>
                      <pattern id="grid" width="40" height="30" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 30" fill="none" stroke="#e5e7eb" strokeWidth="1"/>
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                    
                    {/* Y-axis labels */}
                    {[0, 25, 50, 75, 100].map((value, index) => (
                      <text
                        key={value}
                        x="20"
                        y={280 - (index * 60)}
                        className="text-xs fill-gray-500"
                        textAnchor="end"
                      >
                        {Math.round((value / 100) * getMaxValue())}
                      </text>
                    ))}
                    
                    {/* Bar chart */}
                    {trends.map((trend, index) => {
                      const x = 60 + (index * (700 / trends.length));
                      const width = (700 / trends.length) - 10;
                      const height = (getValue(trend) / getMaxValue()) * 240;
                      const y = 280 - height;
                      
                      return (
                        <rect
                          key={trend._id}
                          x={x}
                          y={y}
                          width={width}
                          height={height}
                          fill="#3b82f6"
                          className="hover:fill-blue-700 transition-colors"
                        />
                      );
                    })}
                    
                    {/* X-axis labels */}
                    {trends.map((trend, index) => {
                      const x = 60 + (index * (700 / trends.length)) + (700 / trends.length) / 2;
                      return (
                        <text
                          key={trend._id}
                          x={x}
                          y="295"
                          className="text-xs fill-gray-500"
                          textAnchor="middle"
                        >
                          {formatDate(trend._id)}
                        </text>
                      );
                    })}
                  </svg>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Data Table */}
        <div className="bg-white shadow-sm rounded-lg border">
          <div className="px-6 py-4 border-b border-gray-200">
            <h4 className="text-lg font-medium text-gray-900">Trend Data</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Engagement Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unique Users
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    High Engagement
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    At Risk
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {trends.map((trend, index) => (
                  <tr key={trend._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatDate(trend._id)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {trend.averageEngagement.toFixed(1)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {trend.uniqueUserCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {trend.highEngagementCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {trend.atRiskCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserEngagementChart;

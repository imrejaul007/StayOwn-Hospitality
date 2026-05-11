import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart
} from 'recharts';
import {
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Star,
  Filter,
  Download,
  BarChart3,
  PieChart as PieChartIcon,
  Activity
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { serviceTypeService } from '../../services/serviceTypeService';
import { useAuth } from '../../context/AuthContext';
import { api } from '@/services/api';

interface ServiceAnalyticsData {
  totalRequests: number;
  completedRequests: number;
  pendingRequests: number;
  averageResponseTime: number;
  averageCompletionTime: number;
  averageRating: number;
  completionRate: number;
  serviceTypeBreakdown: Array<{
    type: string;
    name: string;
    requests: number;
    completionRate: number;
    avgRating: number;
    revenue: number;
  }>;
  dailyTrends: Array<{
    date: string;
    requests: number;
    completed: number;
    revenue: number;
  }>;
  responseTimeDistribution: Array<{
    timeRange: string;
    count: number;
  }>;
  ratingDistribution: Array<{
    rating: number;
    count: number;
  }>;
}

interface TimeFilter {
  label: string;
  value: string;
  days: number;
}

interface ServiceAnalyticsProps {
  hotelId?: string;
}

const ServiceAnalytics: React.FC<ServiceAnalyticsProps> = ({ hotelId: propHotelId }) => {
  const { user } = useAuth();
  const [analyticsData, setAnalyticsData] = useState<ServiceAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTimeFilter, setSelectedTimeFilter] = useState<TimeFilter>({
    label: 'Last 30 Days',
    value: '30d',
    days: 30
  });

  const timeFilters: TimeFilter[] = [
    { label: 'Last 7 Days', value: '7d', days: 7 },
    { label: 'Last 30 Days', value: '30d', days: 30 },
    { label: 'Last 90 Days', value: '90d', days: 90 },
    { label: 'Last Year', value: '1y', days: 365 }
  ];

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316'];

  // Use prop hotelId (from property context) or fall back to user's hotelId
  const resolvedHotelId = (() => {
    if (propHotelId) return propHotelId;
    const raw = user?.hotelId;
    if (!raw) return undefined;
    if (typeof raw === 'string') return raw;
    if (typeof raw === 'object' && raw !== null && '_id' in raw) return String((raw as { _id: string })._id);
    return String(raw);
  })();

  useEffect(() => {
    if (resolvedHotelId) {
      fetchAnalyticsData();
    }
  }, [resolvedHotelId, selectedTimeFilter]);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);

      // Get service type statistics from real API
      const stats = await serviceTypeService.getServiceTypeStats(resolvedHotelId);

      // Also fetch real stats from guest-services endpoint
      const statsResponse = await api.get('/guest-services/stats', {
        params: { hotelId: resolvedHotelId }
      }).catch(() => null);
      const overall = statsResponse?.data?.data?.overall || {};

      const totalRequests = overall.totalRequests || stats.totalRequests || 0;
      const completedRequests = overall.completedCount || stats.totalCompletedRequests || 0;

      const analyticsData: ServiceAnalyticsData = {
        totalRequests,
        completedRequests,
        pendingRequests: (overall.pendingCount || 0) || Math.max(0, totalRequests - completedRequests),
        averageResponseTime: stats.averageResponseTime || 0,
        averageCompletionTime: stats.averageCompletionTime || 0,
        averageRating: overall.avgRating || stats.averageRating || 0,
        completionRate: totalRequests > 0 ? Math.round((completedRequests / totalRequests) * 100) : 0,
        serviceTypeBreakdown: (stats.serviceTypeBreakdown || []).map((item: Record<string, unknown>) => ({
          type: item.type as string,
          name: item.name as string,
          requests: (item.totalRequests as number) || 0,
          completionRate: (item.completionRate as number) || 0,
          avgRating: (item.averageRating as number) || 0,
          revenue: ((item.basePrice as number) || 0) * ((item.completedRequests as number) || 0)
        })),
        // Daily trends: empty until a real analytics endpoint provides time-series data
        dailyTrends: [],
        // Response time distribution: empty until backend aggregates this data
        responseTimeDistribution: [],
        // Rating distribution: empty until backend aggregates this data
        ratingDistribution: []
      };

      setAnalyticsData(analyticsData);
    } catch (error) {
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const exportAnalytics = async () => {
    try {
      // In a real implementation, this would call an API endpoint
      const csvData = generateCSVData();
      const blob = new Blob([csvData], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `service-analytics-${selectedTimeFilter.value}-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('Analytics data exported successfully');
    } catch (error) {
      toast.error('Failed to export analytics data');
    }
  };

  const generateCSVData = (): string => {
    if (!analyticsData) return '';

    const headers = ['Service Type', 'Total Requests', 'Completion Rate', 'Average Rating', 'Revenue'];
    const rows = analyticsData.serviceTypeBreakdown.map(item => [
      item.name,
      item.requests.toString(),
      `${item.completionRate}%`,
      item.avgRating.toFixed(1),
      `₹${item.revenue.toLocaleString()}`
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500">No analytics data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Service Analytics</h2>
          <p className="text-gray-600">Comprehensive insights into guest service performance</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={selectedTimeFilter.value}
              onChange={(e) => {
                const filter = timeFilters.find(f => f.value === e.target.value);
                if (filter) setSelectedTimeFilter(filter);
              }}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {timeFilters.map(filter => (
                <option key={filter.value} value={filter.value}>
                  {filter.label}
                </option>
              ))}
            </select>
          </div>

          <Button onClick={exportAnalytics} className="bg-green-600 hover:bg-green-700">
            <Download className="w-4 h-4 mr-2" />
            Export Data
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.totalRequests}</div>
            <p className="text-xs text-muted-foreground">
              {analyticsData.pendingRequests} pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.completionRate}%</div>
            <p className="text-xs text-muted-foreground">
              {analyticsData.completedRequests} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.averageResponseTime > 0 ? `${analyticsData.averageResponseTime}m` : 'N/A'}</div>
            <p className="text-xs text-muted-foreground">
              minutes to first response
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Rating</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.averageRating > 0 ? analyticsData.averageRating.toFixed(1) : 'N/A'}</div>
            <p className="text-xs text-muted-foreground">
              from guest feedback
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Service Type Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="w-5 h-5" />
              Service Type Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analyticsData.serviceTypeBreakdown.length === 0 || analyticsData.serviceTypeBreakdown.every(s => s.requests === 0) ? (
              <div className="flex items-center justify-center h-[300px] text-gray-400 text-sm">
                No service request data available yet
              </div>
            ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analyticsData.serviceTypeBreakdown}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="requests"
                >
                  {analyticsData.serviceTypeBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Response Time Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Response Time Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analyticsData.responseTimeDistribution.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-gray-400 text-sm">
                No response time data available yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analyticsData.responseTimeDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timeRange" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Daily Trends */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Daily Request Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          {analyticsData.dailyTrends.length === 0 ? (
            <div className="flex items-center justify-center h-[400px] text-gray-400 text-sm">
              No daily trend data available yet. Trends will appear as service requests are created.
            </div>
          ) : (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={analyticsData.dailyTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => new Date(value).toLocaleDateString()}
              />
              <YAxis />
              <Tooltip
                labelFormatter={(value) => new Date(value).toLocaleDateString()}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="requests"
                stackId="1"
                stroke="#3B82F6"
                fill="#3B82F6"
                fillOpacity={0.6}
                name="Total Requests"
              />
              <Area
                type="monotone"
                dataKey="completed"
                stackId="2"
                stroke="#10B981"
                fill="#10B981"
                fillOpacity={0.6}
                name="Completed"
              />
            </AreaChart>
          </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Detailed Service Type Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Service Type Performance Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4">Service Type</th>
                  <th className="text-left py-3 px-4">Total Requests</th>
                  <th className="text-left py-3 px-4">Completion Rate</th>
                  <th className="text-left py-3 px-4">Avg Rating</th>
                  <th className="text-left py-3 px-4">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {analyticsData.serviceTypeBreakdown.map((service) => (
                  <tr key={service.type} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4 font-medium">{service.name}</td>
                    <td className="py-3 px-4">{service.requests}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-12 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-green-600 h-2 rounded-full"
                            style={{ width: `${service.completionRate}%` }}
                          ></div>
                        </div>
                        <span>{service.completionRate}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-400 fill-current" />
                        <span>{service.avgRating.toFixed(1)}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium">₹{service.revenue.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ServiceAnalytics;
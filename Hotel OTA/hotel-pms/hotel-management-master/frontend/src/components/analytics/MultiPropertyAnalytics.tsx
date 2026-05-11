import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, subWeeks, subMonths } from 'date-fns';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { api } from '../../services/api';
import {
  TrendingUp,
  Users,
  Settings,
  Building2,
  Clock,
  Download,
  RefreshCw,
  Calendar,
  Activity,
  DollarSign
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface MultiPropertyAnalyticsProps {
  startDate?: string;
  endDate?: string;
  className?: string;
}

interface UsageStatistics {
  totalChanges: number;
  propertiesAffected: number;
  topUsers: Array<{
    userId: string;
    userName: string;
    changeCount: number;
  }>;
  topSettings: Array<{
    settingType: string;
    changeCount: number;
  }>;
  changesByScope: {
    single: number;
    group: number;
    all: number;
  };
  successRate: number;
}

interface TimeSeriesData {
  date: string;
  changes: number;
  successful: number;
  failed: number;
}

interface HeatmapData {
  date: string;
  activityLevel: number;
  changes: number;
}

interface TimeSavings {
  estimatedMinutesSaved: number;
  estimatedHoursSaved: number;
  estimatedDaysSaved: number;
  bulkOperationsCount: number;
  averagePropertiesPerOperation: number;
  roiPercentage: number;
}

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

export default function MultiPropertyAnalytics({
  startDate,
  endDate,
  className = ''
}: MultiPropertyAnalyticsProps) {
  const [dateRange, setDateRange] = useState({
    start: startDate || format(subMonths(new Date(), 1), 'yyyy-MM-dd'),
    end: endDate || format(new Date(), 'yyyy-MM-dd')
  });
  const [groupBy, setGroupBy] = useState<'hour' | 'day' | 'week' | 'month'>('day');

  // Fetch statistics
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['audit-statistics', dateRange],
    queryFn: async () => {
      const response = await api.get('/audit-log/statistics', {
        params: {
          startDate: dateRange.start,
          endDate: dateRange.end,
          groupBy
        }
      });
      return response.data.data as UsageStatistics;
    }
  });

  // Fetch heatmap data
  const { data: heatmapData, isLoading: heatmapLoading } = useQuery({
    queryKey: ['audit-heatmap', dateRange],
    queryFn: async () => {
      const response = await api.get('/audit-log/heatmap', {
        params: {
          startDate: dateRange.start,
          endDate: dateRange.end
        }
      });
      return response.data.data as HeatmapData[];
    }
  });

  // Fetch time savings
  const { data: timeSavingsData, isLoading: timeSavingsLoading } = useQuery({
    queryKey: ['audit-time-savings', dateRange],
    queryFn: async () => {
      const response = await api.get('/audit-log/time-savings', {
        params: {
          startDate: dateRange.start,
          endDate: dateRange.end
        }
      });
      return response.data.data as TimeSavings;
    }
  });

  // Time series data requires channel manager integration to provide real rate sync analytics
  const timeSeriesData: TimeSeriesData[] = [];

  // Prepare scope distribution data for pie chart
  const scopeData = statsData ? [
    { name: 'Single Property', value: statsData.changesByScope.single, color: COLORS[0] },
    { name: 'Property Group', value: statsData.changesByScope.group, color: COLORS[1] },
    { name: 'All Properties', value: statsData.changesByScope.all, color: COLORS[2] }
  ].filter(item => item.value > 0) : [];

  // Quick date range presets
  const setQuickRange = (preset: 'week' | 'month' | 'quarter' | 'year') => {
    const end = new Date();
    let start: Date;

    switch (preset) {
      case 'week':
        start = subWeeks(end, 1);
        break;
      case 'month':
        start = subMonths(end, 1);
        break;
      case 'quarter':
        start = subMonths(end, 3);
        break;
      case 'year':
        start = subMonths(end, 12);
        break;
    }

    setDateRange({
      start: format(start, 'yyyy-MM-dd'),
      end: format(end, 'yyyy-MM-dd')
    });
  };

  const isLoading = statsLoading || heatmapLoading || timeSavingsLoading;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with Date Range Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Multi-Property Analytics</h2>
          <p className="text-sm text-gray-600 mt-1">
            Usage statistics and insights for settings management
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setQuickRange('week')}
          >
            Last Week
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setQuickRange('month')}
          >
            Last Month
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setQuickRange('quarter')}
          >
            Last Quarter
          </Button>
        </div>
      </div>

      {/* Statistics Cards Row 1 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Changes Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Changes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-gray-900">
                  {isLoading ? '-' : statsData?.totalChanges.toLocaleString() || '0'}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  This period
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Activity className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Properties Affected */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Properties Affected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-gray-900">
                  {isLoading ? '-' : statsData?.propertiesAffected || '0'}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Unique properties
                </p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <Building2 className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Success Rate */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-gray-900">
                  {isLoading ? '-' : `${statsData?.successRate.toFixed(1) || '0'}%`}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Successful updates
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Time Saved */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Time Saved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-3xl font-bold text-gray-900">
                  {isLoading ? '-' : `${timeSavingsData?.estimatedHoursSaved.toFixed(1) || '0'}h`}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  From bulk operations
                </p>
              </div>
              <div className="p-3 bg-orange-100 rounded-lg">
                <Clock className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Time Series Chart */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Changes Over Time</CardTitle>
                <CardDescription>Daily change activity</CardDescription>
              </div>
              <select
                className="border border-gray-300 rounded-md px-3 py-1 text-sm"
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as unknown)}
              >
                <option value="hour">Hourly</option>
                <option value="day">Daily</option>
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
              </select>
            </div>
          </CardHeader>
          <CardContent>
            {timeSeriesData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="changes"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name="Total Changes"
                  />
                  <Line
                    type="monotone"
                    dataKey="successful"
                    stroke="#10b981"
                    strokeWidth={2}
                    name="Successful"
                  />
                  <Line
                    type="monotone"
                    dataKey="failed"
                    stroke="#ef4444"
                    strokeWidth={2}
                    name="Failed"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-sm text-muted-foreground">
                Rate sync analytics require channel manager integration.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Scope Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Changes by Scope</CardTitle>
            <CardDescription>Distribution of update scopes</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={scopeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {scopeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Users and Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Active Users */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Most Active Users
            </CardTitle>
            <CardDescription>Top 5 users by change count</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {isLoading ? (
                <div className="text-center py-8 text-gray-500">Loading...</div>
              ) : statsData?.topUsers && statsData.topUsers.length > 0 ? (
                statsData.topUsers.slice(0, 5).map((user, index) => (
                  <div
                    key={user.userId}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-sm font-medium text-blue-700">
                          {index + 1}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{user.userName}</div>
                        <div className="text-xs text-gray-500">{user.changeCount} changes</div>
                      </div>
                    </div>
                    <Badge variant="secondary">{user.changeCount}</Badge>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">No data available</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Most Changed Settings
            </CardTitle>
            <CardDescription>Top 5 settings by change frequency</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {isLoading ? (
                <div className="text-center py-8 text-gray-500">Loading...</div>
              ) : statsData?.topSettings && statsData.topSettings.length > 0 ? (
                statsData.topSettings.slice(0, 5).map((setting, index) => (
                  <div
                    key={setting.settingType}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                        <span className="text-sm font-medium text-purple-700">
                          {index + 1}
                        </span>
                      </div>
                      <div>
                        <div className="font-medium text-gray-900 capitalize">
                          {setting.settingType.replace(/_/g, ' ')}
                        </div>
                        <div className="text-xs text-gray-500">{setting.changeCount} changes</div>
                      </div>
                    </div>
                    <Badge variant="secondary">{setting.changeCount}</Badge>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">No data available</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Time Savings Calculator */}
      <Card className="border-2 border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-900">
            <DollarSign className="h-5 w-5" />
            Time Savings & ROI
          </CardTitle>
          <CardDescription className="text-green-700">
            Estimated efficiency gains from multi-property updates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Hours Saved</div>
              <div className="text-2xl font-bold text-green-700">
                {isLoading ? '-' : timeSavingsData?.estimatedHoursSaved.toFixed(1) || '0'}
              </div>
            </div>
            <div className="bg-white rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Bulk Operations</div>
              <div className="text-2xl font-bold text-green-700">
                {isLoading ? '-' : timeSavingsData?.bulkOperationsCount || '0'}
              </div>
            </div>
            <div className="bg-white rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">Avg. Properties/Op</div>
              <div className="text-2xl font-bold text-green-700">
                {isLoading ? '-' : timeSavingsData?.averagePropertiesPerOperation.toFixed(1) || '0'}
              </div>
            </div>
            <div className="bg-white rounded-lg p-4">
              <div className="text-sm text-gray-600 mb-1">ROI</div>
              <div className="text-2xl font-bold text-green-700">
                {isLoading ? '-' : `${timeSavingsData?.roiPercentage.toFixed(0) || '0'}%`}
              </div>
            </div>
          </div>
          <div className="mt-4 p-4 bg-white rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>Calculation:</strong> Each property update is estimated to take 2 minutes manually.
              Bulk updates save time by applying changes to multiple properties simultaneously.
              {timeSavingsData && (
                <span className="block mt-2">
                  You've saved approximately <strong className="text-green-700">
                    {timeSavingsData.estimatedDaysSaved.toFixed(1)} working days
                  </strong> using multi-property updates.
                </span>
              )}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Activity Heatmap */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Activity Heatmap
              </CardTitle>
              <CardDescription>Daily activity levels</CardDescription>
            </div>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export Chart
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={heatmapData || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => format(new Date(value), 'MM/dd')}
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                labelFormatter={(value) => format(new Date(value), 'MMM dd, yyyy')}
              />
              <Bar dataKey="changes" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

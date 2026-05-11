import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/Select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../ui/tabs';
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
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  IndianRupee,
  Users,
  Calendar,
  AlertTriangle,
  Download,
  RefreshCw,
  Target,
  Activity,
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import allotmentService from '../../services/allotmentService';

interface AllotmentAnalyticsProps {
  allotment: unknown;
  onBack: () => void;
}

const CHANNEL_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'
];

export default function AllotmentAnalytics({ allotment, onBack }: AllotmentAnalyticsProps) {
  const [analyticsData, setAnalyticsData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30');
  const [selectedMetric, setSelectedMetric] = useState('occupancy');

  useEffect(() => {
    loadAnalytics();
  }, [allotment._id, timeRange]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const endDate = new Date();
      const startDate = subDays(endDate, parseInt(timeRange));
      
      const response = await allotmentService.getAnalytics(allotment._id, {
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
      });
      
      if (response?.success) {
        setAnalyticsData(response.data);
      } else {
        throw new Error('Failed to load analytics data');
      }
    } catch {
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    if (!isFinite(value)) return '₹0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    if (!isFinite(value)) return '0.0%';
    return `${value.toFixed(1)}%`;
  };

  const getMetricColor = (value: number, type: 'occupancy' | 'revenue') => {
    if (type === 'occupancy') {
      if (value >= 85) return 'text-green-600';
      if (value >= 70) return 'text-yellow-600';
      return 'text-red-600';
    }
    return 'text-blue-600';
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 0) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (trend < 0) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Activity className="h-4 w-4 text-gray-600" />;
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="p-6">
        <Button variant="outline" onClick={onBack} className="mb-6">
          ← Back to Overview
        </Button>
        <div className="text-center py-12">
          <AlertTriangle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Analytics Data</h3>
          <p className="text-gray-600">Unable to load analytics data for this allotment.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Button variant="outline" onClick={onBack} className="w-fit">
            ← Back
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
              {allotment.name} - Analytics
            </h1>
            <p className="text-sm sm:text-base text-gray-600">Performance insights and channel analytics</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-full sm:w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadAnalytics} className="flex-1 sm:flex-none">
              <RefreshCw className="h-4 w-4 sm:mr-2" />
              <span className="sm:hidden">Refresh</span>
            </Button>
            
            <Button variant="outline" size="sm" className="flex-1 sm:flex-none">
              <Download className="h-4 w-4 sm:mr-2" />
              <span className="sm:hidden">Export</span>
              <span className="hidden sm:inline">Export</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Occupancy</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getMetricColor(analyticsData.summary?.averageOccupancy || 0, 'occupancy')}`}>
              {formatPercentage(analyticsData.summary?.averageOccupancy || 0)}
            </div>
            <div className="flex items-center text-xs text-muted-foreground">
              {getTrendIcon(analyticsData.summary?.occupancyTrend || 0)}
              <span className="ml-1">
                {(analyticsData.summary?.occupancyTrend || 0) > 0 ? '+' : ''}
                {formatPercentage(analyticsData.summary?.occupancyTrend || 0)} from last period
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <span className="text-lg font-bold text-muted-foreground">₹</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(analyticsData.summary?.totalRevenue || 0)}
            </div>
            <div className="flex items-center text-xs text-muted-foreground">
              {getTrendIcon(analyticsData.summary?.revenueTrend || 0)}
              <span className="ml-1">
                {(analyticsData.summary?.revenueTrend || 0) > 0 ? '+' : ''}
                {formatPercentage(analyticsData.summary?.revenueTrend || 0)} from last period
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(analyticsData.summary?.totalBookings || 0).toLocaleString()}
            </div>
            <div className="flex items-center text-xs text-muted-foreground">
              {getTrendIcon(analyticsData.summary?.bookingsTrend || 0)}
              <span className="ml-1">
                {(analyticsData.summary?.bookingsTrend || 0) > 0 ? '+' : ''}
                {(analyticsData.summary?.bookingsTrend || 0).toFixed(1)} from last period
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Best Channel</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {analyticsData.summary?.topChannel?.name || 'N/A'}
            </div>
            <div className="flex items-center text-xs text-muted-foreground">
              <Badge variant="secondary" className="text-xs">
                {formatPercentage(analyticsData.summary?.topChannel?.occupancy || 0)} occupancy
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Tabs */}
      <Tabs defaultValue="performance" className="space-y-4 sm:space-y-6">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="performance" className="text-xs sm:text-sm">Performance</TabsTrigger>
          <TabsTrigger value="channels" className="text-xs sm:text-sm">Channels</TabsTrigger>
          <TabsTrigger value="trends" className="text-xs sm:text-sm">Trends</TabsTrigger>
          <TabsTrigger value="optimization" className="text-xs sm:text-sm">Optimization</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4 sm:space-y-6">
          {/* Daily Performance Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">Daily Performance</CardTitle>
              <CardDescription className="text-sm">
                Occupancy rates and revenue across the selected time period
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 sm:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analyticsData.dailyPerformance || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(value) => format(new Date(value), 'MMM d')}
                      fontSize={12}
                    />
                    <YAxis yAxisId="left" fontSize={12} />
                    <YAxis yAxisId="right" orientation="right" fontSize={12} />
                    <Tooltip 
                      labelFormatter={(value) => format(new Date(value), 'MMM d, yyyy')}
                      formatter={(value: number, name: string) => [
                        name === 'revenue' ? formatCurrency(value) : formatPercentage(value),
                        name === 'revenue' ? 'Revenue' : 'Occupancy'
                      ]}
                    />
                    <Legend />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="occupancy"
                      stackId="1"
                      stroke="#3b82f6"
                      fill="#3b82f6"
                      fillOpacity={0.3}
                      name="Occupancy (%)"
                    />
                    <Area
                      yAxisId="right"
                      type="monotone"
                      dataKey="revenue"
                      stackId="2"
                      stroke="#10b981"
                      fill="#10b981"
                      fillOpacity={0.3}
                      name="Revenue (₹)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Room Utilization */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Room Utilization</CardTitle>
                <CardDescription>Average utilization by day of week</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsData.utilizationByDay || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis />
                      <Tooltip formatter={(value: number) => [formatPercentage(value), 'Utilization']} />
                      <Bar dataKey="utilization" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Booking Lead Time</CardTitle>
                <CardDescription>Distribution of booking lead times</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analyticsData.leadTimeDistribution || []}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="count"
                      >
                        {(analyticsData.leadTimeDistribution || []).map((entry: Record<string, unknown>, index: number) => (
                          <Cell key={`cell-${index}`} fill={CHANNEL_COLORS[index % CHANNEL_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="channels" className="space-y-6">
          {/* Channel Performance Comparison */}
          <Card>
            <CardHeader>
              <CardTitle>Channel Performance Comparison</CardTitle>
              <CardDescription>
                Revenue and occupancy rates by distribution channel
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analyticsData.channelPerformance || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="channelName" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip 
                      formatter={(value: number, name: string) => [
                        name === 'revenue' ? formatCurrency(value) : formatPercentage(value),
                        name === 'revenue' ? 'Revenue' : 'Occupancy'
                      ]}
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="occupancy" fill="#3b82f6" name="Occupancy (%)" />
                    <Bar yAxisId="right" dataKey="revenue" fill="#10b981" name="Revenue (₹)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Channel Details Table */}
          <Card>
            <CardHeader>
              <CardTitle>Channel Details</CardTitle>
              <CardDescription>Detailed performance metrics by channel</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Channel</th>
                      <th className="text-right p-2">Bookings</th>
                      <th className="text-right p-2">Revenue</th>
                      <th className="text-right p-2">Occupancy</th>
                      <th className="text-right p-2">ADR</th>
                      <th className="text-right p-2">Commission</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(analyticsData.channelPerformance || []).map((channel: Record<string, unknown>, index: number) => (
                      <tr key={`channel-${channel.channelName || index}`} className="border-b hover:bg-gray-50">
                        <td className="p-2">
                          <div className="flex items-center space-x-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: CHANNEL_COLORS[index % CHANNEL_COLORS.length] }}
                            />
                            <span className="font-medium">{String(channel.channelName || 'Unknown')}</span>
                          </div>
                        </td>
                        <td className="text-right p-2">{(channel.bookings as number) || 0}</td>
                        <td className="text-right p-2">{formatCurrency((channel.revenue as number) || 0)}</td>
                        <td className="text-right p-2">
                          <span className={getMetricColor((channel.occupancy as number) || 0, 'occupancy')}>
                            {formatPercentage((channel.occupancy as number) || 0)}
                          </span>
                        </td>
                        <td className="text-right p-2">{formatCurrency((channel.adr as number) || 0)}</td>
                        <td className="text-right p-2">{formatPercentage((channel.commission as number) || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          {/* Revenue Trends */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue Trends</CardTitle>
              <CardDescription>Revenue performance over time by channel</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analyticsData.dailyPerformance || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(value) => format(new Date(value), 'MMM d')}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => format(new Date(value), 'MMM d, yyyy')}
                      formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      name="Total Revenue"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Seasonal Patterns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Seasonal Patterns</CardTitle>
                <CardDescription>Average occupancy by month</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsData.seasonalPatterns || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value: number) => [formatPercentage(value), 'Occupancy']} />
                      <Bar dataKey="occupancy" fill="#10b981" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Booking Patterns</CardTitle>
                <CardDescription>Bookings by day of week</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsData.bookingPatterns || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="bookings" fill="#f59e0b" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="optimization" className="space-y-6">
          {/* Optimization Recommendations */}
          {analyticsData.recommendations?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Optimization Recommendations</CardTitle>
                <CardDescription>AI-powered suggestions to improve performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(analyticsData.recommendations || []).map((rec: Record<string, unknown>, index: number) => (
                    <div key={`rec-${index}-${rec.priority}`} className="flex items-start justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <Badge variant={rec.priority === 'high' ? 'destructive' : rec.priority === 'medium' ? 'default' : 'secondary'}>
                            {String(rec.priority || 'low')} priority
                          </Badge>
                          <span className="text-sm text-gray-500">
                            Confidence: {rec.confidence || 0}%
                          </span>
                        </div>
                        <h4 className="font-medium capitalize mb-1">
                          {String(rec.type || '').replace('_', ' ')}
                        </h4>
                        <p className="text-sm text-gray-600 mb-2">{String(rec.impact || '')}</p>
                        <p className="text-xs text-gray-500">
                          Expected impact: {String(rec.expectedImpact || 'N/A')}
                        </p>
                      </div>
                      <Button size="sm" variant="outline">
                        Apply
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Performance Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Channel Efficiency</CardTitle>
                <CardDescription>Revenue per booking by channel</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsData.channelEfficiency || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="channelName" />
                      <YAxis />
                      <Tooltip formatter={(value: number) => [formatCurrency(value), 'Revenue per Booking']} />
                      <Bar dataKey="revenuePerBooking" fill="#8b5cf6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Allocation Efficiency</CardTitle>
                <CardDescription>Utilization rates by allocation method</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(analyticsData.allocationEfficiency || []).map((method: Record<string, unknown>, index: number) => (
                    <div key={`method-${method.method || index}`} className="flex items-center justify-between">
                      <span className="text-sm font-medium capitalize">
                        {String(method.method || '').replace('_', ' ')}
                      </span>
                      <div className="flex items-center space-x-2">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${(method.efficiency as number) || 0}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-600 w-12">
                          {formatPercentage((method.efficiency as number) || 0)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
import React, { useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  Activity, TrendingUp, Users, MessageSquare, Send,
  Eye, MousePointer, AlertTriangle, Download, RefreshCw,
  Filter, Calendar, Smartphone, Mail, Bell
} from 'lucide-react';
import { useNotificationAnalytics } from '../../hooks/useNotificationAnalytics';

const COLORS = {
  primary: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  purple: '#8b5cf6',
  indigo: '#6366f1',
  pink: '#ec4899',
  teal: '#14b8a6'
};

interface TimeRangeOption {
  label: string;
  value: number;
}

const TIME_RANGES: TimeRangeOption[] = [
  { label: 'Last 7 days', value: 7 },
  { label: 'Last 30 days', value: 30 },
  { label: 'Last 90 days', value: 90 },
  { label: 'Last 6 months', value: 180 },
  { label: 'Last year', value: 365 }
];

const CHANNEL_ICONS = {
  in_app: Bell,
  browser: Activity,
  email: Mail,
  sms: MessageSquare,
  push: Smartphone
};

const MetricCard: React.FC<{
  title: string;
  value: string | number;
  change?: string;
  icon: React.ElementType;
  color: string;
  trend?: 'up' | 'down' | 'neutral';
}> = ({ title, value, change, icon: Icon, color, trend = 'neutral' }) => (
  <div className="bg-white rounded-lg shadow-md p-6 border-l-4" style={{ borderLeftColor: color }}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {change && (
          <div className={`flex items-center mt-1 text-sm ${
            trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-600'
          }`}>
            <TrendingUp className="w-4 h-4 mr-1" />
            {change}
          </div>
        )}
      </div>
      <div className="p-3 rounded-full" style={{ backgroundColor: `${color}20` }}>
        <Icon className="w-8 h-8" style={{ color }} />
      </div>
    </div>
  </div>
);

export const NotificationAnalyticsDashboard: React.FC = () => {
  const [timeRange, setTimeRange] = useState<number>(7);
  const [selectedChannel, setSelectedChannel] = useState<string>('');

  const {
    useDashboard,
    useRealTimeMetrics,
    exportData,
    isExporting,
    calculateRates
  } = useNotificationAnalytics();

  const { data: dashboardData, isLoading, refetch } = useDashboard({ timeRange });
  const { data: realTimeData } = useRealTimeMetrics();

  const metrics = realTimeData?.metrics || {
    totalSent: 0,
    totalDelivered: 0,
    totalRead: 0,
    totalClicked: 0,
    totalFailed: 0,
    avgResponseTime: 0
  };

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      await exportData({ timeRange, format });
    } catch {
      // Error handled silently
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Prepare chart data
  const channelData = dashboardData?.channelPerformance.map(channel => ({
    name: channel._id,
    sent: channel.sent,
    delivered: channel.delivered,
    read: channel.read,
    clicked: channel.clicked,
    failed: channel.failed,
    deliveryRate: channel.deliveryRate * 100,
    readRate: channel.readRate * 100,
    clickRate: channel.clickRate * 100
  })) || [];

  const categoryData = dashboardData?.categoryPerformance.map(category => ({
    name: category._id,
    sent: category.sent,
    delivered: category.delivered,
    read: category.read,
    clicked: category.clicked,
    deliveryRate: category.deliveryRate * 100,
    readRate: category.readRate * 100
  })) || [];

  const deliveryTrendData = dashboardData?.deliveryStats.map(stat => {
    const events = stat.events.reduce((acc, event) => {
      acc[event.type] = event.count;
      return acc;
    }, {} as Record<string, number>);

    return {
      date: new Date(stat._id.date).toLocaleDateString(),
      channel: stat._id.channel,
      sent: events.sent || 0,
      delivered: events.delivered || 0,
      read: events.read || 0,
      clicked: events.clicked || 0,
      failed: events.failed || 0
    };
  }) || [];

  // Calculate performance metrics
  const deliveryRate = metrics.totalSent > 0 ? (metrics.totalDelivered / metrics.totalSent * 100).toFixed(1) : '0.0';
  const readRate = metrics.totalDelivered > 0 ? (metrics.totalRead / metrics.totalDelivered * 100).toFixed(1) : '0.0';
  const clickRate = metrics.totalRead > 0 ? (metrics.totalClicked / metrics.totalRead * 100).toFixed(1) : '0.0';
  const failureRate = metrics.totalSent > 0 ? (metrics.totalFailed / metrics.totalSent * 100).toFixed(1) : '0.0';

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Notification Analytics</h1>
              <p className="text-gray-600 mt-2">Monitor notification delivery, engagement, and performance metrics</p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => refetch()}
                disabled={isLoading}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExport('csv')}
                  disabled={isExporting}
                  className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </button>
                <button
                  onClick={() => handleExport('json')}
                  disabled={isExporting}
                  className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export JSON
                </button>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {TIME_RANGES.map(range => (
                  <option key={range.value} value={range.value}>
                    {range.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={selectedChannel}
                onChange={(e) => setSelectedChannel(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Channels</option>
                <option value="in_app">In-App</option>
                <option value="browser">Browser</option>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="push">Push</option>
              </select>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Total Sent"
            value={metrics.totalSent.toLocaleString()}
            icon={Send}
            color={COLORS.primary}
          />
          <MetricCard
            title="Delivery Rate"
            value={`${deliveryRate}%`}
            icon={Activity}
            color={COLORS.success}
          />
          <MetricCard
            title="Read Rate"
            value={`${readRate}%`}
            icon={Eye}
            color={COLORS.warning}
          />
          <MetricCard
            title="Click Rate"
            value={`${clickRate}%`}
            icon={MousePointer}
            color={COLORS.purple}
          />
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <MetricCard
            title="Total Delivered"
            value={metrics.totalDelivered.toLocaleString()}
            icon={Activity}
            color={COLORS.success}
          />
          <MetricCard
            title="Total Failed"
            value={metrics.totalFailed.toLocaleString()}
            icon={AlertTriangle}
            color={COLORS.danger}
          />
          <MetricCard
            title="Avg Response Time"
            value={`${(metrics.avgResponseTime / 1000).toFixed(1)}s`}
            icon={Activity}
            color={COLORS.indigo}
          />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Channel Performance Chart */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Channel Performance</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={channelData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="sent" fill={COLORS.primary} name="Sent" />
                <Bar dataKey="delivered" fill={COLORS.success} name="Delivered" />
                <Bar dataKey="read" fill={COLORS.warning} name="Read" />
                <Bar dataKey="clicked" fill={COLORS.purple} name="Clicked" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Category Performance Chart */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Category Performance</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="deliveryRate" fill={COLORS.success} name="Delivery Rate %" />
                <Bar dataKey="readRate" fill={COLORS.warning} name="Read Rate %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Delivery Trend Chart */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Delivery Trends</h3>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={deliveryTrendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="sent" stroke={COLORS.primary} name="Sent" />
              <Line type="monotone" dataKey="delivered" stroke={COLORS.success} name="Delivered" />
              <Line type="monotone" dataKey="read" stroke={COLORS.warning} name="Read" />
              <Line type="monotone" dataKey="clicked" stroke={COLORS.purple} name="Clicked" />
              <Line type="monotone" dataKey="failed" stroke={COLORS.danger} name="Failed" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Performance Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Channel Performance Table */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Channel Details</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Channel</th>
                    <th className="text-right py-2">Sent</th>
                    <th className="text-right py-2">Delivery %</th>
                    <th className="text-right py-2">Read %</th>
                    <th className="text-right py-2">Click %</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardData?.channelPerformance.map((channel) => {
                    const rates = calculateRates(channel);
                    const IconComponent = CHANNEL_ICONS[channel._id as keyof typeof CHANNEL_ICONS] || Bell;

                    return (
                      <tr key={channel._id} className="border-b hover:bg-gray-50">
                        <td className="py-2">
                          <div className="flex items-center gap-2">
                            <IconComponent className="w-4 h-4 text-gray-500" />
                            {channel._id}
                          </div>
                        </td>
                        <td className="text-right py-2">{channel.sent.toLocaleString()}</td>
                        <td className="text-right py-2">{rates.deliveryRate}%</td>
                        <td className="text-right py-2">{rates.readRate}%</td>
                        <td className="text-right py-2">{rates.clickRate}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Category Performance Table */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Category Details</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Category</th>
                    <th className="text-right py-2">Sent</th>
                    <th className="text-right py-2">Delivery %</th>
                    <th className="text-right py-2">Read %</th>
                    <th className="text-right py-2">Failure %</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboardData?.categoryPerformance.map((category) => {
                    const rates = calculateRates(category);

                    return (
                      <tr key={category._id} className="border-b hover:bg-gray-50">
                        <td className="py-2 capitalize">{category._id}</td>
                        <td className="text-right py-2">{category.sent.toLocaleString()}</td>
                        <td className="text-right py-2">{rates.deliveryRate}%</td>
                        <td className="text-right py-2">{rates.readRate}%</td>
                        <td className="text-right py-2 text-red-600">{rates.failureRate}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
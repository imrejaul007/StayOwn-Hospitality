import React, { useState } from 'react';
import { Bell, TrendingUp, TrendingDown, Users, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';

interface NotificationTrend {
  date: string;
  sent: number;
  read: number;
  urgent: number;
}

interface NotificationOverview {
  totalSent: number;
  totalRead: number;
  totalUnread: number;
  urgentCount: number;
  todayStats: {
    sent: number;
    read: number;
    readRate: number;
  };
  weeklyTrend: NotificationTrend[];
  topCategories: Array<{
    category: string;
    count: number;
    readRate: number;
  }>;
  averageResponseTime: number; // in minutes
}

interface NotificationOverviewWidgetProps {
  className?: string;
  timeRange?: number;
  showChart?: boolean;
  role?: 'admin' | 'staff' | 'guest';
}

export const NotificationOverviewWidget: React.FC<NotificationOverviewWidgetProps> = ({
  className = '',
  timeRange = 7,
  showChart = true,
  role
}) => {
  const { user } = useAuth();
  const [selectedMetric, setSelectedMetric] = useState<'sent' | 'read' | 'urgent'>('sent');

  // For admin/staff roles, show system-wide stats; for guests, show personal stats
  const isPersonalView = role === 'guest' || (!role && user?.role === 'guest');

  const { data: overview, isLoading } = useQuery<NotificationOverview>({
    queryKey: ['notification-overview', timeRange, isPersonalView ? 'personal' : 'system'],
    queryFn: async () => {
      const endpoint = isPersonalView
        ? '/api/v1/notifications/personal-overview'
        : '/api/v1/notifications/system-overview';

      const response = await apiRequest(`${endpoint}?timeRange=${timeRange}`);
      return response.data;
    },
    refetchInterval: 60000 // Refresh every minute
  });

  if (isLoading) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-gray-200 rounded"></div>
                <div className="h-8 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
          <div className="h-48 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!overview) {
    return null;
  }

  const readRate = overview.totalSent > 0 ? (overview.totalRead / overview.totalSent * 100) : 0;
  const urgentRate = overview.totalSent > 0 ? (overview.urgentCount / overview.totalSent * 100) : 0;

  const metrics = [
    {
      key: 'sent' as const,
      label: 'Total Sent',
      value: overview.totalSent.toLocaleString(),
      change: overview.todayStats.sent > 0 ? '+' + overview.todayStats.sent : '0',
      icon: Bell,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      key: 'read' as const,
      label: 'Read Rate',
      value: `${readRate.toFixed(1)}%`,
      change: `${overview.todayStats.readRate.toFixed(1)}% today`,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      key: 'urgent' as const,
      label: 'Urgent Alerts',
      value: overview.urgentCount.toLocaleString(),
      change: urgentRate > 10 ? 'High' : urgentRate > 5 ? 'Medium' : 'Low',
      icon: AlertTriangle,
      color: overview.urgentCount > 0 ? 'text-red-600' : 'text-gray-600',
      bgColor: overview.urgentCount > 0 ? 'bg-red-50' : 'bg-gray-50'
    },
    {
      key: 'response' as const,
      label: 'Avg Response',
      value: `${overview.averageResponseTime.toFixed(0)}min`,
      change: overview.averageResponseTime < 30 ? 'Fast' : overview.averageResponseTime < 60 ? 'Good' : 'Slow',
      icon: Clock,
      color: overview.averageResponseTime < 30 ? 'text-green-600' : overview.averageResponseTime < 60 ? 'text-orange-600' : 'text-red-600',
      bgColor: overview.averageResponseTime < 30 ? 'bg-green-50' : overview.averageResponseTime < 60 ? 'bg-orange-50' : 'bg-red-50'
    }
  ];

  // Prepare chart data
  const chartData = overview.weeklyTrend?.map(day => ({
    date: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    sent: day.sent,
    read: day.read,
    urgent: day.urgent
  })) || [];

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {isPersonalView ? 'My Notifications' : 'Notification Overview'}
            </h3>
            <p className="text-sm text-gray-600">Last {timeRange} days</p>
          </div>
          <div className="flex items-center gap-2">
            <Users className={`w-5 h-5 ${isPersonalView ? 'text-blue-500' : 'text-purple-500'}`} />
            <span className="text-sm font-medium text-gray-700">
              {isPersonalView ? 'Personal' : 'System-wide'}
            </span>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <div role="button" tabIndex={0}
                key={metric.key}
                className={`${metric.bgColor} rounded-lg p-4 cursor-pointer transition-all ${
                  selectedMetric === metric.key ? 'ring-2 ring-blue-500' : ''
                }`}
                onClick={() => showChart && setSelectedMetric(metric.key)}
               onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const clickHandler = () => showChart && setSelectedMetric(metric.key); if (typeof clickHandler === 'function') { clickHandler(e as any); } } }}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-white ${metric.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 font-medium">{metric.label}</p>
                    <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
                    <p className="text-xs text-gray-500">{metric.change}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Chart */}
        {showChart && chartData.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-gray-900">Trend Analysis</h4>
              <div className="flex items-center gap-4">
                {(['sent', 'read', 'urgent'] as const).map((metric) => (
                  <button aria-label="Close"
                    key={metric}
                    onClick={() => setSelectedMetric(metric)}
                    className={`text-sm px-3 py-1 rounded-full transition-colors ${
                      selectedMetric === metric
                        ? 'bg-blue-100 text-blue-700 font-medium'
                        : 'text-gray-600 hover:text-gray-800'
                    }`}
                  >
                    {metric.charAt(0).toUpperCase() + metric.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <XAxis
                    dataKey="date"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                  />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey={selectedMetric}
                    stroke={
                      selectedMetric === 'urgent' ? '#ef4444' :
                      selectedMetric === 'read' ? '#10b981' : '#3b82f6'
                    }
                    strokeWidth={3}
                    dot={{ r: 4, fill: 'white', strokeWidth: 2 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Top Categories */}
        {overview.topCategories.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Top Categories</h4>
            <div className="space-y-2">
              {overview.topCategories.slice(0, 5).map((category, index) => (
                <div key={category.category} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <span className="text-sm font-medium text-gray-900 capitalize">
                      {category.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-600">{category.count}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-600">{category.readRate.toFixed(1)}%</span>
                      {category.readRate > 80 ? (
                        <TrendingUp className="w-4 h-4 text-green-500" />
                      ) : category.readRate < 50 ? (
                        <TrendingDown className="w-4 h-4 text-red-500" />
                      ) : (
                        <div className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationOverviewWidget;
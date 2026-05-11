import React, { useState } from 'react';
import { TrendingUp, TrendingDown, Activity, Eye, Send, MousePointer } from 'lucide-react';
import { useNotificationAnalytics } from '../../hooks/useNotificationAnalytics';

interface MetricItemProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  trend?: {
    value: string;
    direction: 'up' | 'down' | 'neutral';
  };
}

const MetricItem: React.FC<MetricItemProps> = ({ label, value, icon: Icon, color, trend }) => (
  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
    <div className="flex items-center gap-2">
      <div className="p-2 rounded-full" style={{ backgroundColor: `${color}20` }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-900">{value}</p>
        <p className="text-xs text-gray-600">{label}</p>
      </div>
    </div>
    {trend && (
      <div className={`flex items-center text-xs ${
        trend.direction === 'up' ? 'text-green-600' :
        trend.direction === 'down' ? 'text-red-600' : 'text-gray-600'
      }`}>
        {trend.direction === 'up' && <TrendingUp className="w-3 h-3 mr-1" />}
        {trend.direction === 'down' && <TrendingDown className="w-3 h-3 mr-1" />}
        {trend.value}
      </div>
    )}
  </div>
);

interface NotificationMetricsWidgetProps {
  className?: string;
  showTitle?: boolean;
}

export const NotificationMetricsWidget: React.FC<NotificationMetricsWidgetProps> = ({
  className = '',
  showTitle = true
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { useRealTimeMetrics } = useNotificationAnalytics();
  const { data: realTimeData, isLoading } = useRealTimeMetrics();

  if (isLoading) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border p-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-3"></div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-3/4"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  const metrics = realTimeData?.metrics || {
    totalSent: 0,
    totalDelivered: 0,
    totalRead: 0,
    totalClicked: 0,
    totalFailed: 0,
    avgResponseTime: 0
  };

  // Calculate rates
  const deliveryRate = metrics.totalSent > 0 ?
    ((metrics.totalDelivered / metrics.totalSent) * 100).toFixed(1) : '0.0';
  const readRate = metrics.totalDelivered > 0 ?
    ((metrics.totalRead / metrics.totalDelivered) * 100).toFixed(1) : '0.0';
  const clickRate = metrics.totalRead > 0 ?
    ((metrics.totalClicked / metrics.totalRead) * 100).toFixed(1) : '0.0';

  const compactMetrics = [
    {
      label: 'Sent Today',
      value: metrics.totalSent.toLocaleString(),
      icon: Send,
      color: '#3b82f6'
    },
    {
      label: 'Delivery Rate',
      value: `${deliveryRate}%`,
      icon: Activity,
      color: '#10b981'
    }
  ];

  const expandedMetrics = [
    ...compactMetrics,
    {
      label: 'Read Rate',
      value: `${readRate}%`,
      icon: Eye,
      color: '#f59e0b'
    },
    {
      label: 'Click Rate',
      value: `${clickRate}%`,
      icon: MousePointer,
      color: '#8b5cf6'
    }
  ];

  const displayMetrics = isExpanded ? expandedMetrics : compactMetrics;

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      {showTitle && (
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Notification Metrics</h3>
            <button aria-label="Expand"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              {isExpanded ? 'Less' : 'More'}
            </button>
          </div>
        </div>
      )}
      <div className="p-4">
        <div className="space-y-3">
          {displayMetrics.map((metric, index) => (
            <MetricItem key={`displayMetrics-${index}`} {...metric} />
          ))}
        </div>
        {metrics.totalSent === 0 && (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500">No notifications sent today</p>
          </div>
        )}
      </div>
      {isExpanded && (
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">
              Avg Response: {(metrics.avgResponseTime / 1000).toFixed(1)}s
            </span>
            <span className="text-gray-600">
              Failed: {metrics.totalFailed}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationMetricsWidget;
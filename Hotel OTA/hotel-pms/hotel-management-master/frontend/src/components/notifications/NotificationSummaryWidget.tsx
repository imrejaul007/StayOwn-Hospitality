import React, { useState } from 'react';
import { Bell, AlertTriangle, CheckCircle, Clock, Users, Settings } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../services/api';
import { useNavigate } from 'react-router-dom';

interface NotificationSummary {
  unreadCount: number;
  priorityCounts: {
    urgent: number;
    high: number;
    medium: number;
    low: number;
  };
  categoryCounts: {
    booking: number;
    payment: number;
    service: number;
    system: number;
    maintenance?: number;
    inventory?: number;
  };
  recentActivity: {
    lastNotification?: string;
    todayCount: number;
    weekCount: number;
  };
}

interface NotificationSummaryWidgetProps {
  className?: string;
  variant?: 'compact' | 'full' | 'minimal';
  showSettings?: boolean;
}

export const NotificationSummaryWidget: React.FC<NotificationSummaryWidgetProps> = ({
  className = '',
  variant = 'compact',
  showSettings = true
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);

  // Fetch notification summary
  const { data: summary, isLoading, error } = useQuery<NotificationSummary>({
    queryKey: ['notification-summary', user?._id],
    queryFn: async () => {
      const response = await apiRequest('/api/v1/notifications/summary');
      return response.data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 15000
  });

  const handleNavigateToNotifications = () => {
    const basePath = user?.role === 'admin' ? '/admin' :
                    user?.role === 'staff' ? '/staff' : '/guest';
    navigate(`${basePath}/notifications`);
  };

  const handleNavigateToSettings = () => {
    const basePath = user?.role === 'admin' ? '/admin' :
                    user?.role === 'staff' ? '/staff' : '/guest';
    navigate(`${basePath}/settings`);
  };

  if (isLoading) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border p-4 ${className}`}>
        <div className="animate-pulse space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            <div className="h-6 w-6 bg-gray-200 rounded-full"></div>
          </div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded w-full"></div>
            <div className="h-3 bg-gray-200 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border p-4 ${className}`}>
        <div className="text-center text-red-500 text-sm">
          Failed to load notifications
        </div>
      </div>
    );
  }

  const totalUnread = summary?.unreadCount || 0;
  const hasUrgent = (summary?.priorityCounts.urgent || 0) > 0;
  const hasHigh = (summary?.priorityCounts.high || 0) > 0;

  // Minimal variant - just show count and icon
  if (variant === 'minimal') {
    return (
      <button
        onClick={handleNavigateToNotifications}
        className={`relative p-2 rounded-lg hover:bg-gray-100 transition-colors ${className}`}
      >
        <Bell className={`w-5 h-5 ${hasUrgent ? 'text-red-500' : hasHigh ? 'text-orange-500' : 'text-gray-600'}`} />
        {totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </button>
    );
  }

  // Get priority indicator
  const getPriorityIndicator = () => {
    if (hasUrgent) return { color: 'text-red-500', bg: 'bg-red-50', label: 'Urgent' };
    if (hasHigh) return { color: 'text-orange-500', bg: 'bg-orange-50', label: 'High Priority' };
    if (totalUnread > 0) return { color: 'text-blue-500', bg: 'bg-blue-50', label: 'New Messages' };
    return { color: 'text-green-500', bg: 'bg-green-50', label: 'All Clear' };
  };

  const priorityIndicator = getPriorityIndicator();

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className={`w-5 h-5 ${priorityIndicator.color}`} />
            <h3 className="font-semibold text-gray-900">Notifications</h3>
            {totalUnread > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                {totalUnread}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {variant === 'full' && (
              <button aria-label="Expand"
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                {isExpanded ? 'Less' : 'More'}
              </button>
            )}
            {showSettings && (
              <button aria-label="Settings"
                onClick={handleNavigateToSettings}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title="Notification Settings"
              >
                <Settings className="w-4 h-4 text-gray-500" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Status Indicator */}
        <div className={`${priorityIndicator.bg} rounded-lg p-3 mb-4`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {totalUnread === 0 ? (
                <CheckCircle className={`w-5 h-5 ${priorityIndicator.color}`} />
              ) : hasUrgent ? (
                <AlertTriangle className={`w-5 h-5 ${priorityIndicator.color}`} />
              ) : (
                <Bell className={`w-5 h-5 ${priorityIndicator.color}`} />
              )}
              <span className={`text-sm font-medium ${priorityIndicator.color}`}>
                {priorityIndicator.label}
              </span>
            </div>
            {totalUnread > 0 && (
              <button
                onClick={handleNavigateToNotifications}
                className="text-xs text-gray-600 hover:text-gray-800 underline"
              >
                View All
              </button>
            )}
          </div>
        </div>

        {/* Priority Breakdown */}
        {totalUnread > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            {summary?.priorityCounts.urgent > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Urgent</span>
                <span className="font-semibold text-red-600">{summary.priorityCounts.urgent}</span>
              </div>
            )}
            {summary?.priorityCounts.high > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">High</span>
                <span className="font-semibold text-orange-600">{summary.priorityCounts.high}</span>
              </div>
            )}
            {summary?.priorityCounts.medium > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Medium</span>
                <span className="font-semibold text-blue-600">{summary.priorityCounts.medium}</span>
              </div>
            )}
            {summary?.priorityCounts.low > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Low</span>
                <span className="font-semibold text-gray-600">{summary.priorityCounts.low}</span>
              </div>
            )}
          </div>
        )}

        {/* Category Breakdown (Full variant or expanded) */}
        {(variant === 'full' || isExpanded) && summary && (
          <div className="space-y-3">
            {/* Categories */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Categories
              </h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(summary.categoryCounts).map(([category, count]) => (
                  count > 0 && (
                    <div key={category} className="flex items-center justify-between py-1">
                      <span className="text-gray-600 capitalize">{category}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                  )
                ))}
              </div>
            </div>

            {/* Recent Activity */}
            {summary.recentActivity && (
              <div className="border-t pt-3">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Activity
                </h4>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Today</span>
                    <span className="font-medium">{summary.recentActivity.todayCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">This Week</span>
                    <span className="font-medium">{summary.recentActivity.weekCount}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-4 flex gap-2">
          <button
            onClick={handleNavigateToNotifications}
            className="flex-1 bg-blue-600 text-white text-sm py-2 px-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            View All
          </button>
          {totalUnread > 0 && (
            <button
              onClick={() => {
                // This would call mark all as read API
              }}
              className="text-sm text-gray-600 hover:text-gray-800 px-3 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              Mark Read
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationSummaryWidget;
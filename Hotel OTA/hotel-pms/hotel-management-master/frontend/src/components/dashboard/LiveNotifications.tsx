import React from 'react';
import { Bell, User, CreditCard, Calendar, AlertTriangle, CheckCircle } from 'lucide-react';
import { useDashboardUpdates } from '../../hooks/useDashboardUpdates';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface LiveNotificationsProps {
  className?: string;
}

export function LiveNotifications({ className = '' }: LiveNotificationsProps) {
  const {
    notifications,
    activities,
    unreadCount,
    criticalAlertsCount,
    isLoading,
    error,
    lastUpdated,
    markNotificationsRead,
    refresh
  } = useDashboardUpdates();

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'booking_created':
        return <Calendar className="w-4 h-4 text-blue-500" />;
      case 'payment_update':
        return <CreditCard className="w-4 h-4 text-green-500" />;
      case 'booking_cancelled':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'user_registration':
        return <User className="w-4 h-4 text-purple-500" />;
      default:
        return <Bell className="w-4 h-4 text-gray-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  return (
    <Card className={`p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Bell className="w-5 h-5 text-gray-700" />
          <h3 className="font-semibold text-gray-900">Live Notifications</h3>
          {unreadCount > 0 && (
            <Badge variant="primary" className="ml-2">
              {unreadCount}
            </Badge>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {lastUpdated && (
            <span className="text-xs text-gray-500">
              Updated {formatTimeAgo(lastUpdated)}
            </span>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={refresh}
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Critical Alerts Banner */}
      {criticalAlertsCount > 0 && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <AlertTriangle className="w-4 h-4 text-red-600 mr-2" />
            <span className="text-sm font-medium text-red-800">
              {criticalAlertsCount} critical alert{criticalAlertsCount !== 1 ? 's' : ''} require{criticalAlertsCount === 1 ? 's' : ''} attention
            </span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Notifications List */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p className="text-gray-500">No new notifications</p>
            <p className="text-xs text-gray-400">All caught up!</p>
          </div>
        ) : (
          notifications.slice(0, 10).map((notification) => (
            <div
              key={notification._id}
              className={`p-3 border rounded-lg transition-colors ${
                notification.status === 'read' 
                  ? 'bg-gray-50 border-gray-200' 
                  : 'bg-white border-blue-200 shadow-sm'
              }`}
            >
              <div className="flex items-start space-x-3">
                {/* Icon */}
                <div className="flex-shrink-0 mt-1">
                  {getNotificationIcon(notification.type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-gray-900 truncate">
                      {notification.title}
                    </h4>
                    <div className="flex items-center space-x-2 ml-2">
                      <Badge 
                        variant="secondary" 
                        className={`text-xs ${getPriorityColor(notification.priority)}`}
                      >
                        {notification.priority}
                      </Badge>
                      <span className="text-xs text-gray-500 whitespace-nowrap">
                        {formatTimeAgo(notification.createdAt)}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                    {notification.message}
                  </p>

                  {/* Metadata */}
                  {notification.metadata && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {notification.metadata.guestId && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                          <User className="w-3 h-3 mr-1" />
                          {notification.metadata.guestId.name}
                        </span>
                      )}
                      {notification.metadata.bookingId && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                          <Calendar className="w-3 h-3 mr-1" />
                          {notification.metadata.bookingId.bookingNumber}
                        </span>
                      )}
                      {notification.metadata.amount && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800">
                          <CreditCard className="w-3 h-3 mr-1" />
                          ₹{notification.metadata.amount}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Actions */}
      {notifications.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-200 flex justify-between">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => markNotificationsRead(undefined, true)}
            disabled={unreadCount === 0}
          >
            Mark All Read
          </Button>
          {notifications.length > 10 && (
            <span className="text-xs text-gray-500 self-center">
              Showing 10 of {notifications.length} notifications
            </span>
          )}
        </div>
      )}
    </Card>
  );
}
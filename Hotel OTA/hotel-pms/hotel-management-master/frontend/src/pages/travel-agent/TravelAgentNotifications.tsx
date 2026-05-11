import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Search,
  Check,
  Trash2,
  Settings,
  Eye,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Calendar,
  CreditCard,
  Circle,
  AlertTriangle,
  Mail,
  MessageCircle,
  Smartphone,
} from 'lucide-react';
import { notificationService, Notification, NotificationType, NotificationChannel, NotificationPreference } from '../../services/notificationService';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { PushNotificationSetup } from '../../components/notifications/PushNotificationSetup';
import { useRealTime } from '../../services/realTimeService';
import toast from 'react-hot-toast';
import { withErrorBoundary } from '../../components/ErrorBoundary';

function TravelAgentNotifications() {
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({
    status: '',
    type: '',
    priority: '',
    search: ''
  });
  const [selectedNotifications, setSelectedNotifications] = useState<string[]>([]);
  const [showPreferences, setShowPreferences] = useState(false);
  const [expandedNotification, setExpandedNotification] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { connectionState, connect, disconnect, on, off } = useRealTime();

  // Real-time connection setup - FIXED: Don't disconnect singleton service
  useEffect(() => {
    connect().catch(error => {
    });
    return () => {
      // Don't disconnect on unmount as other components may be using the same connection
    };
  }, [connect]);

  // Real-time event listeners
  useEffect(() => {
    if (connectionState !== 'connected') return;

    const handleNewNotification = (data: Record<string, unknown>) => {
      queryClient.invalidateQueries({ queryKey: ['travel-agent-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] });

      toast.success('New booking update', {
        duration: 3000,
        icon: '✈️'
      });
    };

    const handleNotificationRead = (data: Record<string, unknown>) => {
      queryClient.invalidateQueries({ queryKey: ['travel-agent-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
    };

    on('notification:new', handleNewNotification);
    on('notification:read', handleNotificationRead);

    return () => {
      off('notification:new', handleNewNotification);
      off('notification:read', handleNotificationRead);
    };
  }, [connectionState, on, off, queryClient]);

  // Fetch notifications with filters
  const {
    data: notificationsData,
    isLoading,
    error
  } = useQuery({
    queryKey: ['travel-agent-notifications', currentPage, filters],
    queryFn: () => notificationService.getNotifications({
      page: currentPage,
      limit: 20,
      ...filters,
      unreadOnly: filters.status === 'unread',
      readOnly: filters.status === 'read'
    }),
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch unread count
  const { data: unreadCount } = useQuery({
    queryKey: ['unreadCount'],
    queryFn: notificationService.getUnreadCount,
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  // Fetch notification preferences
  const { data: preferences } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: notificationService.getPreferences,
    enabled: showPreferences
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: notificationService.markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['travel-agent-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
      toast.success('Notification marked as read');
    }
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: notificationService.markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['travel-agent-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
      toast.success('All notifications marked as read');
    }
  });

  // Delete notification mutation
  const deleteNotificationMutation = useMutation({
    mutationFn: notificationService.deleteNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['travel-agent-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
      toast.success('Notification deleted');
    }
  });

  // Update preferences mutation
  const updatePreferencesMutation = useMutation({
    mutationFn: notificationService.updatePreferences,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
      toast.success('Notification preferences updated');
    }
  });

  const handleMarkAsRead = (notificationId: string) => {
    markAsReadMutation.mutate(notificationId);
  };

  const handleMarkAllAsRead = () => {
    markAllAsReadMutation.mutate();
  };

  const handleDeleteNotification = (notificationId: string) => {
    if (window.confirm('Are you sure you want to delete this notification?')) {
      deleteNotificationMutation.mutate(notificationId);
    }
  };

  const handleBulkAction = (action: 'read' | 'delete') => {
    if (selectedNotifications.length === 0) {
      toast.error('Please select notifications first');
      return;
    }

    if (action === 'delete' && !window.confirm('Are you sure you want to delete selected notifications?')) {
      return;
    }

    selectedNotifications.forEach(id => {
      if (action === 'read') {
        markAsReadMutation.mutate(id);
      } else {
        deleteNotificationMutation.mutate(id);
      }
    });

    setSelectedNotifications([]);
  };

  const toggleNotificationSelection = (notificationId: string) => {
    setSelectedNotifications(prev =>
      prev.includes(notificationId)
        ? prev.filter(id => id !== notificationId)
        : [...prev, notificationId]
    );
  };

  const selectAllNotifications = () => {
    const allIds = notificationsData?.notifications.map(n => n._id) || [];
    setSelectedNotifications(
      selectedNotifications.length === allIds.length ? [] : allIds
    );
  };

  const getNotificationIcon = (notification: Notification) => {
    const typeInfo = notificationService.getNotificationTypeInfo(notification.type as NotificationType);
    const isUnread = notificationService.isUnread(notification);

    return (
      <div className={`p-2 rounded-full flex-shrink-0 ${typeInfo.color}`}>
        {React.createElement(typeInfo.icon, {
          className: `h-4 w-4 ${isUnread ? 'fill-current' : ''}`
        })}
      </div>
    );
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getChannelIcon = (channel: NotificationChannel) => {
    switch (channel) {
      case 'email': return Mail;
      case 'sms': return Smartphone;
      case 'in_app': return Bell;
      case 'push': return MessageCircle;
      default: return Bell;
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Notifications</h2>
          <p className="text-gray-600 mb-4">Failed to load notifications. Please try again later.</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Bell className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Travel Agent Notifications</h1>
                <p className="text-gray-600">Stay updated with booking confirmations and travel updates</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
                connectionState === 'connected' ? 'bg-green-100 text-green-800' :
                connectionState === 'connecting' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  connectionState === 'connected' ? 'bg-green-500' :
                  connectionState === 'connecting' ? 'bg-yellow-500' :
                  'bg-red-500'
                }`} />
                <span className="capitalize">{connectionState}</span>
              </div>
              <Button
                onClick={() => setShowPreferences(!showPreferences)}
                variant="outline"
              >
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Notifications</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {notificationsData?.totalCount || 0}
                  </p>
                </div>
                <Bell className="h-8 w-8 text-blue-500" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Unread Updates</p>
                  <p className="text-2xl font-bold text-red-600">
                    {unreadCount || 0}
                  </p>
                </div>
                <Circle className="h-8 w-8 text-red-500 fill-current" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Booking Updates</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {notificationsData?.bookingCount || 0}
                  </p>
                </div>
                <Calendar className="h-8 w-8 text-blue-500" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Commission Updates</p>
                  <p className="text-2xl font-bold text-green-600">
                    {notificationsData?.commissionCount || 0}
                  </p>
                </div>
                <CreditCard className="h-8 w-8 text-green-500" />
              </div>
            </Card>
          </div>
        </div>

        {/* Push Notification Setup */}
        <PushNotificationSetup />

        {/* Filters and Actions */}
        <Card className="mb-6">
          <div className="p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
              <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    type="text"
                    placeholder="Search notifications..."
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    className="pl-10 w-64"
                  />
                </div>

                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Status</option>
                  <option value="unread">Unread</option>
                  <option value="read">Read</option>
                </select>

                <select
                  value={filters.type}
                  onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Types</option>
                  <option value="booking_confirmed">Booking Confirmed</option>
                  <option value="booking_cancelled">Booking Cancelled</option>
                  <option value="payment_received">Payment Received</option>
                  <option value="commission_update">Commission Update</option>
                  <option value="rate_change">Rate Change</option>
                  <option value="promotion">Promotion</option>
                </select>

                <select
                  value={filters.priority}
                  onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Priorities</option>
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              <div className="flex space-x-2">
                {unreadCount > 0 && (
                  <Button
                    onClick={handleMarkAllAsRead}
                    disabled={markAllAsReadMutation.isPending}
                    variant="outline"
                    size="sm"
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Mark All Read
                  </Button>
                )}

                {selectedNotifications.length > 0 && (
                  <div className="flex space-x-2">
                    <Button
                      onClick={() => handleBulkAction('read')}
                      variant="outline"
                      size="sm"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Mark Read ({selectedNotifications.length})
                    </Button>
                    <Button
                      onClick={() => handleBulkAction('delete')}
                      variant="outline"
                      size="sm"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete ({selectedNotifications.length})
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Notifications List */}
        <Card>
          <div className="p-6">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner />
              </div>
            ) : notificationsData?.notifications.length === 0 ? (
              <div className="text-center py-12">
                <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No notifications found</h3>
                <p className="text-gray-500">
                  {Object.values(filters).some(f => f)
                    ? 'Try adjusting your filters to see more results.'
                    : 'You\'re all caught up! No new booking updates.'
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Select All */}
                <div className="flex items-center space-x-3 pb-4 border-b">
                  <input
                    type="checkbox"
                    checked={selectedNotifications.length === notificationsData?.notifications.length}
                    onChange={selectAllNotifications}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-600">
                    Select All ({notificationsData?.notifications.length})
                  </span>
                </div>

                {/* Notifications */}
                {notificationsData?.notifications.map((notification) => (
                  <div
                    key={notification._id}
                    className={`p-4 rounded-lg border transition-all ${
                      notificationService.isUnread(notification)
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start space-x-4">
                      <input
                        type="checkbox"
                        checked={selectedNotifications.includes(notification._id)}
                        onChange={() => toggleNotificationSelection(notification._id)}
                        className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />

                      {getNotificationIcon(notification)}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-1">
                              <h3 className={`text-sm font-medium ${
                                notificationService.isUnread(notification)
                                  ? 'text-gray-900'
                                  : 'text-gray-700'
                              }`}>
                                {notification.title}
                              </h3>

                              {notification.priority && (
                                <span className={`px-2 py-1 text-xs font-medium rounded-full border ${
                                  getPriorityColor(notification.priority)
                                }`}>
                                  {notification.priority.toUpperCase()}
                                </span>
                              )}

                              {notification.channel && (
                                <div className="flex items-center space-x-1 text-gray-500">
                                  {React.createElement(getChannelIcon(notification.channel), {
                                    className: 'h-3 w-3'
                                  })}
                                  <span className="text-xs">{notification.channel.replace('_', ' ')}</span>
                                </div>
                              )}
                            </div>

                            <p className={`text-sm ${
                              notificationService.isUnread(notification)
                                ? 'text-gray-800'
                                : 'text-gray-600'
                            } ${expandedNotification === notification._id ? '' : 'line-clamp-2'}`}>
                              {notification.message}
                            </p>

                            {notification.data && Object.keys(notification.data).length > 0 && (
                              <div className="mt-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setExpandedNotification(
                                    expandedNotification === notification._id ? null : notification._id
                                  )}
                                  className="text-xs"
                                >
                                  {expandedNotification === notification._id ? (
                                    <>
                                      <ChevronUp className="h-3 w-3 mr-1" />
                                      Show Less
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown className="h-3 w-3 mr-1" />
                                      Show Details
                                    </>
                                  )}
                                </Button>

                                {expandedNotification === notification._id && (
                                  <div className="mt-2 p-3 bg-gray-50 rounded-md">
                                    <pre className="text-xs text-gray-600 whitespace-pre-wrap">
                                      {JSON.stringify(notification.data, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="flex items-center justify-between mt-3">
                              <span className="text-xs text-gray-500">
                                {formatTimeAgo(notification.createdAt)}
                              </span>

                              <div className="flex items-center space-x-2">
                                {notificationService.isUnread(notification) && (
                                  <Button
                                    onClick={() => handleMarkAsRead(notification._id)}
                                    disabled={markAsReadMutation.isPending}
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs"
                                  >
                                    <Eye className="h-3 w-3 mr-1" />
                                    Mark Read
                                  </Button>
                                )}

                                <Button
                                  onClick={() => handleDeleteNotification(notification._id)}
                                  disabled={deleteNotificationMutation.isPending}
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          {notificationsData && notificationsData.totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-700">
                  Showing {((currentPage - 1) * 20) + 1} to{' '}
                  {Math.min(currentPage * 20, notificationsData.totalCount)} of{' '}
                  {notificationsData.totalCount} notifications
                </p>

                <div className="flex space-x-2">
                  <Button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    variant="outline"
                    size="sm"
                  >
                    Previous
                  </Button>

                  <span className="flex items-center px-3 py-1 text-sm text-gray-700">
                    Page {currentPage} of {notificationsData.totalPages}
                  </span>

                  <Button
                    onClick={() => setCurrentPage(Math.min(notificationsData.totalPages, currentPage + 1))}
                    disabled={currentPage === notificationsData.totalPages}
                    variant="outline"
                    size="sm"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export default withErrorBoundary(TravelAgentNotifications, { level: 'page' });
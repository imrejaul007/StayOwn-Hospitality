import React, { useState, useEffect, useCallback } from 'react';
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
  Circle,
  AlertTriangle,
  Mail,
  MessageCircle,
  Smartphone,
  CheckCircle,
  Clock,
  CreditCard,
  Star,
  Gift,
  Heart,
  LogIn,
  LogOut,
  MessageSquare,
  Tag,
  HelpCircle,
  type LucideProps,
} from 'lucide-react';
import { notificationService } from '../../services/notificationService';
import type { Notification, NotificationChannelValue } from '../../services/notificationService';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { PushNotificationSetup } from '../../components/notifications/PushNotificationSetup';
import { useRealTime } from '../../services/realTimeService';
import toast from 'react-hot-toast';
import { withErrorBoundary } from '../../components/ErrorBoundary';

// Map from icon-name string (returned by notificationService.getNotificationTypeInfo) to
// actual Lucide component so React.createElement works correctly.
type LucideComponent = React.FC<LucideProps>;
const ICON_MAP: Record<string, LucideComponent> = {
  'check-circle': CheckCircle,
  'clock': Clock,
  'x-circle': AlertCircle,
  'credit-card': CreditCard,
  'alert-circle': AlertCircle,
  'star': Star,
  'calendar': Calendar,
  'bell': Bell,
  'gift': Gift,
  'alert-triangle': AlertTriangle,
  'heart': Heart,
  'log-in': LogIn,
  'log-out': LogOut,
  'message-square': MessageSquare,
  'tag': Tag,
  'help-circle': HelpCircle,
};

function StaffNotifications() {
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
  const { connectionState, connect, on, off } = useRealTime();

  // Real-time connection setup - Don't disconnect on unmount as other components may share the singleton.
  useEffect(() => {
    connect().catch((error: unknown) => {
      console.warn('StaffNotifications: real-time connection failed', error);
    });
  }, [connect]);

  // Invalidate both notification list and unread badge in one call.
  const invalidateNotificationQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['staff-notifications'] });
    queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
  }, [queryClient]);

  // Real-time event listeners
  useEffect(() => {
    if (connectionState !== 'connected') return;

    const handleNewNotification = (_data: Record<string, unknown>) => {
      invalidateNotificationQueries();
      toast.success('New notification received', {
        duration: 3000,
        icon: '🔔'
      });
    };

    const handleNotificationRead = (_data: Record<string, unknown>) => {
      invalidateNotificationQueries();
    };

    // Also refresh when a notification is deleted from another session/tab
    const handleNotificationDeleted = (_data: Record<string, unknown>) => {
      invalidateNotificationQueries();
    };

    // Bulk updates (mark-all-read, bulk delete)
    const handleBulkUpdate = (_data: Record<string, unknown>) => {
      invalidateNotificationQueries();
    };

    on('notification:new', handleNewNotification);
    on('notification:read', handleNotificationRead);
    on('notification:deleted', handleNotificationDeleted);
    on('notifications:bulk-update', handleBulkUpdate);

    return () => {
      off('notification:new', handleNewNotification);
      off('notification:read', handleNotificationRead);
      off('notification:deleted', handleNotificationDeleted);
      off('notifications:bulk-update', handleBulkUpdate);
    };
  }, [connectionState, on, off, invalidateNotificationQueries]);

  // Fetch notifications with filters
  const {
    data: notificationsData,
    isLoading,
    error
  } = useQuery({
    queryKey: ['staff-notifications', currentPage, filters],
    queryFn: () => notificationService.getNotifications({
      page: currentPage,
      limit: 20,
      ...filters,
      // Do not pass status directly when using unreadOnly/readOnly — the backend handles both
      status: filters.status !== 'unread' && filters.status !== 'read' ? filters.status : undefined,
      unreadOnly: filters.status === 'unread',
      readOnly: filters.status === 'read'
    }),
    refetchInterval: 30000, // Fallback polling every 30 seconds
    keepPreviousData: true, // Smooth page transitions
  });

  // Fetch unread count
  const { data: unreadCount } = useQuery({
    queryKey: ['unreadCount'],
    queryFn: notificationService.getUnreadCount,
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  // Fetch notification preferences (pre-load when user opens settings panel)
  useQuery({
    queryKey: ['notification-preferences'],
    queryFn: notificationService.getPreferences,
    enabled: showPreferences
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: notificationService.markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
      toast.success('Notification marked as read');
    }
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: notificationService.markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
      toast.success('All notifications marked as read');
    }
  });

  // Delete notification mutation
  const deleteNotificationMutation = useMutation({
    mutationFn: notificationService.deleteNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
      toast.success('Notification deleted');
    }
  });

  // Bulk mark-as-read mutation — uses the efficient batch endpoint
  const bulkMarkAsReadMutation = useMutation({
    mutationFn: notificationService.markMultipleAsRead,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['staff-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
      toast.success(`${result.modifiedCount} notification${result.modifiedCount !== 1 ? 's' : ''} marked as read`);
    },
    onError: () => {
      toast.error('Failed to mark notifications as read');
    }
  });

  // Preferences are managed by the PushNotificationSetup component when showPreferences is true

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

    const ids = [...selectedNotifications];

    if (action === 'read') {
      // Use the efficient batch endpoint instead of firing N individual mutations
      bulkMarkAsReadMutation.mutate(ids, {
        onSuccess: () => setSelectedNotifications([]),
        onError: () => {
          // Keep selection so the user can retry
        }
      });
    } else {
      // Delete each one; clear selection only after all settle
      const promises = ids.map(id =>
        notificationService.deleteNotification(id).catch(() => null)
      );
      Promise.allSettled(promises).then((results) => {
        // A delete resolves to `undefined` (void) on success or `null` (our catch fallback) on failure
        const successCount = results.filter(r => r.status === 'fulfilled' && r.value !== null).length;
        const failCount = ids.length - successCount;
        queryClient.invalidateQueries({ queryKey: ['staff-notifications'] });
        queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
        if (successCount > 0) {
          toast.success(`${successCount} notification${successCount !== 1 ? 's' : ''} deleted`);
          setSelectedNotifications([]);
        }
        if (failCount > 0) {
          toast.error(`${failCount} notification${failCount !== 1 ? 's' : ''} could not be deleted`);
        }
      });
    }
  };

  // Update a single filter key and reset pagination to page 1
  const updateFilter = useCallback((key: keyof typeof filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  }, []);

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
    const typeInfo = notificationService.getNotificationTypeInfo(notification.type);
    const isUnread = notificationService.isUnread(notification);
    // typeInfo.icon is a string key (e.g. 'check-circle') — resolve to Lucide component
    const IconComponent: LucideComponent = ICON_MAP[typeInfo.icon] ?? Bell;

    return (
      <div className={`p-2 rounded-full flex-shrink-0 ${typeInfo.color}`}>
        <IconComponent className={`h-4 w-4 ${isUnread ? 'fill-current' : ''}`} />
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

  const getChannelIcon = (channel: NotificationChannelValue | string) => {
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
                <h1 className="text-2xl font-bold text-gray-900">Staff Notifications</h1>
                <p className="text-gray-600">Stay updated with your tasks and work assignments</p>
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
                  <p className="text-sm text-gray-600">Unread Tasks</p>
                  <p className="text-2xl font-bold text-red-600">
                    {unreadCount ?? 0}
                  </p>
                </div>
                <Circle className="h-8 w-8 text-red-500 fill-current" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Today's Tasks</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {notificationsData?.todayCount || 0}
                  </p>
                </div>
                <Calendar className="h-8 w-8 text-blue-500" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Urgent Tasks</p>
                  <p className="text-2xl font-bold text-red-600">
                    {notificationsData?.urgentCount || 0}
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
            </Card>
          </div>
        </div>

        {/* Push Notification Setup — shown only when the Settings panel is open */}
        {showPreferences && <PushNotificationSetup />}

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
                    onChange={(e) => updateFilter('search', e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>

                <select
                  value={filters.status}
                  onChange={(e) => updateFilter('status', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Status</option>
                  <option value="unread">Unread</option>
                  <option value="read">Read</option>
                </select>

                <select
                  value={filters.type}
                  onChange={(e) => updateFilter('type', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Types</option>
                  <option value="task_assignment">Task Assignment</option>
                  <option value="guest_service_created">Guest Request</option>
                  <option value="housekeeping_assigned">Housekeeping</option>
                  <option value="maintenance_assigned">Maintenance</option>
                  <option value="inventory_low_stock">Inventory Alert</option>
                  <option value="room_needs_cleaning">Room Cleaning</option>
                  <option value="system_alert">System Alert</option>
                </select>

                <select
                  value={filters.priority}
                  onChange={(e) => updateFilter('priority', e.target.value)}
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
                {(unreadCount ?? 0) > 0 && (
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
                      disabled={bulkMarkAsReadMutation.isPending}
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
                    : 'Great! You\'re all caught up with your tasks.'
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

                              {notification.channels && notification.channels.length > 0 && (
                                <div className="flex items-center space-x-1 text-gray-500">
                                  {(() => {
                                    // Show the first delivery channel as the primary channel indicator
                                    const primaryChannel = notification.channels[0] as NotificationChannelValue;
                                    const ChannelIcon = getChannelIcon(primaryChannel);
                                    return (
                                      <>
                                        <ChannelIcon className="h-3 w-3" />
                                        <span className="text-xs">{primaryChannel.replace('_', ' ')}</span>
                                      </>
                                    );
                                  })()}
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

                            {notification.metadata && Object.keys(notification.metadata).length > 0 && (
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
                                      {JSON.stringify(notification.metadata, null, 2)}
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

export default withErrorBoundary(StaffNotifications, { level: 'page' });
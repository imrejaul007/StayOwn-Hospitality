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
  Circle,
  AlertTriangle,
  Mail,
  MessageCircle,
  Smartphone,
  CheckCircle,
  Clock,
  XCircle,
  CreditCard,
  Star,
  Gift,
  Heart,
  LogIn,
  LogOut,
  MessageSquare,
  Tag,
  HelpCircle,
  Minus,
  AlertOctagon,
  Send,
  X,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { notificationService, Notification, NotificationType, NotificationChannel, NotificationChannelValue, NotificationPreference } from '../../services/notificationService';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { PushNotificationSetup } from '../../components/notifications/PushNotificationSetup';
import { useRealTime } from '../../services/realTimeService';
import toast from 'react-hot-toast';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import { withErrorBoundary } from '../../components/ErrorBoundary';
import { api } from '../../services/api';

// Map string icon names from notificationService.getNotificationTypeInfo to Lucide components
const iconNameToComponent: Record<string, LucideIcon> = {
  'check-circle': CheckCircle,
  'clock': Clock,
  'x-circle': XCircle,
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
  'minus': Minus,
  'circle': Circle,
  'alert-octagon': AlertOctagon,
};

/** Simple debounce hook for search input */
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function AdminNotifications() {
  const { selectedPropertyId, selectedProperty, viewMode } = useProperty();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const [filters, setFilters] = useState({
    status: '',
    type: '',
    priority: '',
    search: ''
  });

  // Sync debounced search into filters and reset page
  useEffect(() => {
    setFilters(prev => ({ ...prev, search: debouncedSearch }));
    setCurrentPage(1);
  }, [debouncedSearch]);

  const [selectedNotifications, setSelectedNotifications] = useState<string[]>([]);
  const [showPreferences, setShowPreferences] = useState(false);
  const [expandedNotification, setExpandedNotification] = useState<string | null>(null);
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [composeData, setComposeData] = useState({ title: '', message: '', priority: 'medium' });
  const [selectedRecipients, setSelectedRecipients] = useState<Array<{ _id: string; name: string; email: string }>>([]);
  const [guestSearchQuery, setGuestSearchQuery] = useState('');
  const [guestSearchResults, setGuestSearchResults] = useState<Array<{ _id: string; name: string; email: string }>>([]);
  const [isSearchingGuests, setIsSearchingGuests] = useState(false);
  const [isSendingNotification, setIsSendingNotification] = useState(false);

  const queryClient = useQueryClient();
  const { connectionState, connect, disconnect, on, off } = useRealTime();
  const getNotificationId = (notification: Partial<Notification> & { id?: string }) =>
    String(notification._id || notification.id || '');

  // Real-time connection setup with singleton pattern
  useEffect(() => {
    connect().catch(error => {
    });
    return () => {
      // Don't disconnect on unmount as other components may be using the same connection
    };
  }, [connect, disconnect]);

  // Real-time event listeners
  useEffect(() => {
    if (connectionState !== 'connected') return;

    const handleNewNotification = (data: Record<string, unknown>) => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] });

      toast.success('New notification received', {
        duration: 3000,
        icon: '🔔'
      });
    };

    const handleNotificationRead = (data: Record<string, unknown>) => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
    };

    const handleNotificationDeleted = (data: Record<string, unknown>) => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
    };

    on('notification:new', handleNewNotification);
    on('notification:read', handleNotificationRead);
    on('notification:deleted', handleNotificationDeleted);

    return () => {
      off('notification:new', handleNewNotification);
      off('notification:read', handleNotificationRead);
      off('notification:deleted', handleNotificationDeleted);
    };
  }, [connectionState, on, off, queryClient]);

  // Fetch notifications with filters
  const {
    data: notificationsData,
    isLoading,
    error
  } = useQuery({
    queryKey: ['admin-notifications', currentPage, filters, selectedPropertyId],
    queryFn: () => notificationService.getNotifications({
      page: currentPage,
      limit: 20,
      ...filters,
      unreadOnly: filters.status === 'unread',
      readOnly: filters.status === 'read',
      propertyId: selectedPropertyId || undefined
    }),
    refetchInterval: 30000, // Refetch every 30 seconds
    enabled: !!(selectedPropertyId || viewMode === 'all')
  });

  // Fetch unread count
  const { data: unreadCount } = useQuery({
    queryKey: ['unreadCount', selectedPropertyId],
    queryFn: () => notificationService.getUnreadCount(selectedPropertyId || undefined),
    refetchInterval: 10000, // Refetch every 10 seconds
    enabled: !!(selectedPropertyId || viewMode === 'all')
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
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
      // Force immediate refetch
      queryClient.refetchQueries({ queryKey: ['admin-notifications'] });
      queryClient.refetchQueries({ queryKey: ['unreadCount'] });
      toast.success('Notification marked as read');
    }
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: notificationService.markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
      // Force immediate refetch
      queryClient.refetchQueries({ queryKey: ['admin-notifications'] });
      queryClient.refetchQueries({ queryKey: ['unreadCount'] });
      toast.success('All notifications marked as read');
    }
  });

  // Delete notification mutation
  const deleteNotificationMutation = useMutation({
    mutationFn: notificationService.deleteNotification,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
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

  const handleBulkAction = async (action: 'read' | 'delete') => {
    if (selectedNotifications.length === 0) {
      toast.error('Please select notifications first');
      return;
    }

    if (action === 'delete' && !window.confirm('Are you sure you want to delete selected notifications?')) {
      return;
    }

    try {
      if (action === 'read') {
        // Use batch endpoint instead of firing individual mutations per notification
        await notificationService.markMultipleAsRead(selectedNotifications);
        queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
        queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
        toast.success(`${selectedNotifications.length} notification(s) marked as read`);
      } else {
        // Delete must still be sequential since there is no batch-delete endpoint
        await Promise.all(
          selectedNotifications.map(id => notificationService.deleteNotification(id))
        );
        queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
        queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
        toast.success(`${selectedNotifications.length} notification(s) deleted`);
      }
    } catch {
      toast.error(`Failed to ${action === 'read' ? 'mark as read' : 'delete'} notifications`);
    }

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
    const allIds = notificationsData?.notifications.map(n => getNotificationId(n)).filter(Boolean) || [];
    setSelectedNotifications(
      selectedNotifications.length === allIds.length ? [] : allIds
    );
  };

  const getNotificationIcon = (notification: Notification) => {
    const typeInfo = notificationService.getNotificationTypeInfo(notification.type as NotificationType);
    const isUnread = notificationService.isUnread(notification);
    const IconComponent = iconNameToComponent[typeInfo.icon] || Bell;

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
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getChannelIcon = (channel: NotificationChannelValue) => {
    switch (channel) {
      case 'email': return Mail;
      case 'sms': return Smartphone;
      case 'in_app': return Bell;
      case 'push': return MessageCircle;
      default: return Bell;
    }
  };

  // Guest search for compose modal
  const handleGuestSearch = async (query: string) => {
    setGuestSearchQuery(query);
    if (query.length < 2) {
      setGuestSearchResults([]);
      return;
    }
    setIsSearchingGuests(true);
    try {
      const { data } = await api.get('/users', {
        params: { search: query, role: 'guest', limit: 10, page: 1 }
      });
      const users = data?.data?.users || data?.users || data?.data || [];
      setGuestSearchResults(
        (Array.isArray(users) ? users : []).map((u: Record<string, unknown>) => ({
          _id: String(u._id || u.id),
          name: String(u.name || u.firstName || u.email || 'Unknown'),
          email: String(u.email || '')
        }))
      );
    } catch {
      setGuestSearchResults([]);
    } finally {
      setIsSearchingGuests(false);
    }
  };

  const addRecipient = (guest: { _id: string; name: string; email: string }) => {
    if (!selectedRecipients.find(r => r._id === guest._id)) {
      setSelectedRecipients(prev => [...prev, guest]);
    }
    setGuestSearchQuery('');
    setGuestSearchResults([]);
  };

  const removeRecipient = (id: string) => {
    setSelectedRecipients(prev => prev.filter(r => r._id !== id));
  };

  const handleSendNotification = async () => {
    if (selectedRecipients.length === 0) {
      toast.error('Please select at least one recipient');
      return;
    }
    if (!composeData.title.trim() || !composeData.message.trim()) {
      toast.error('Title and message are required');
      return;
    }
    setIsSendingNotification(true);
    try {
      await api.post('/notifications/send', {
        recipientIds: selectedRecipients.map(r => r._id),
        title: composeData.title,
        message: composeData.message,
        priority: composeData.priority
      });
      toast.success('Notification sent successfully');
      setShowComposeModal(false);
      setComposeData({ title: '', message: '', priority: 'medium' });
      setSelectedRecipients([]);
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
    } catch {
      toast.error('Failed to send notification');
    } finally {
      setIsSendingNotification(false);
    }
  };

  if (!selectedPropertyId && viewMode === 'single') {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <PropertyBreadcrumb items={['Integration', 'Notifications']} />
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-gray-600 text-lg">Please select a property to view notifications</p>
          </div>
        </div>
      </div>
    );
  }

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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PropertyBreadcrumb items={['Integration', 'Notifications']} />

        {/* Header */}
        <div className="mb-8 mt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Bell className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Admin Notifications</h1>
                <p className="text-gray-600">
                  Manage and track all system notifications
                  {selectedProperty && ` - ${selectedProperty.name}`}
                </p>
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
                onClick={() => setShowComposeModal(true)}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                <Send className="h-4 w-4 mr-2" />
                Send Notification
              </Button>
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
                  <p className="text-sm text-gray-600">Unread</p>
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
                  <p className="text-sm text-gray-600">This Week</p>
                  <p className="text-2xl font-bold text-green-600">
                    {notificationsData?.weeklyCount || 0}
                  </p>
                </div>
                <Calendar className="h-8 w-8 text-green-500" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">High Priority</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {notificationsData?.highPriorityCount || 0}
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-orange-500" />
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
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>

                <select
                  value={filters.status}
                  onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setCurrentPage(1); }}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Status</option>
                  <option value="unread">Unread</option>
                  <option value="read">Read</option>
                </select>

                <select
                  value={filters.type}
                  onChange={(e) => { setFilters({ ...filters, type: e.target.value }); setCurrentPage(1); }}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Types</option>
                  <option value="booking">Booking</option>
                  <option value="payment">Payment</option>
                  <option value="system">System</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="guest_service">Guest Service</option>
                  <option value="marketing">Marketing</option>
                </select>

                <select
                  value={filters.priority}
                  onChange={(e) => { setFilters({ ...filters, priority: e.target.value }); setCurrentPage(1); }}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Priorities</option>
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
                    : 'You\'re all caught up! No notifications to display.'
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
                {notificationsData?.notifications.map((notification) => {
                  const notificationId = getNotificationId(notification);
                  return (
                  <div
                    key={notificationId}
                    className={`p-4 rounded-lg border transition-all ${
                      notificationService.isUnread(notification)
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start space-x-4">
                      <input
                        type="checkbox"
                        checked={selectedNotifications.includes(notificationId)}
                        onChange={() => toggleNotificationSelection(notificationId)}
                        className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />

                      {getNotificationIcon(notification)}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-1">
                              {/* Read/Unread Indicator */}
                              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                notificationService.isUnread(notification)
                                  ? 'bg-blue-500'
                                  : 'bg-gray-300'
                              }`} title={notificationService.isUnread(notification) ? 'Unread' : 'Read'} />

                              <h3 className={`text-sm font-medium ${
                                notificationService.isUnread(notification)
                                  ? 'text-gray-900'
                                  : 'text-gray-700'
                              }`}>
                                {notification.title}
                              </h3>

                              {notification.priority && (
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                  getPriorityColor(notification.priority)
                                }`}>
                                  {notification.priority.toUpperCase()}
                                </span>
                              )}

                              {notification.channels && notification.channels.length > 0 && (
                                <div className="flex items-center space-x-1 text-gray-500">
                                  {React.createElement(getChannelIcon(notification.channels[0]), {
                                    className: 'h-3 w-3'
                                  })}
                                  <span className="text-xs">{notification.channels[0].replace('_', ' ')}</span>
                                </div>
                              )}
                            </div>

                            <p className={`text-sm ${
                              notificationService.isUnread(notification)
                                ? 'text-gray-800'
                                : 'text-gray-600'
                            } ${expandedNotification === notificationId ? '' : 'line-clamp-2'}`}>
                              {notification.message}
                            </p>

                            {notification.metadata && Object.keys(notification.metadata).length > 0 && (
                              <div className="mt-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setExpandedNotification(
                                    expandedNotification === notificationId ? null : notificationId
                                  )}
                                  className="text-xs"
                                >
                                  {expandedNotification === notificationId ? (
                                    <>
                                      <ChevronUp className="h-3 w-3 mr-1" />
                                      Show Less
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown className="h-3 w-3 mr-1" />
                                      Show More
                                    </>
                                  )}
                                </Button>

                                {expandedNotification === notificationId && (
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
                                    onClick={() => handleMarkAsRead(notificationId)}
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
                                  onClick={() => handleDeleteNotification(notificationId)}
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
                );
                })}
              </div>
            )}
          </div>

          {/* Pagination */}
          {notificationsData && notificationsData.pagination.totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-700">
                  Showing {((notificationsData.pagination.currentPage - 1) * notificationsData.pagination.itemsPerPage) + 1} to{' '}
                  {Math.min(
                    notificationsData.pagination.currentPage * notificationsData.pagination.itemsPerPage,
                    notificationsData.pagination.totalItems
                  )} of{' '}
                  {notificationsData.pagination.totalItems} notifications
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
                    Page {notificationsData.pagination.currentPage} of {notificationsData.pagination.totalPages}
                  </span>

                  <Button
                    onClick={() => setCurrentPage(Math.min(notificationsData.pagination.totalPages, currentPage + 1))}
                    disabled={currentPage === notificationsData.pagination.totalPages}
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

        {/* Compose Notification Modal */}
        {showComposeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Send className="h-5 w-5 text-blue-600" />
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900">Send Notification</h2>
                </div>
                <button
                  onClick={() => {
                    setShowComposeModal(false);
                    setComposeData({ title: '', message: '', priority: 'medium' });
                    setSelectedRecipients([]);
                    setGuestSearchQuery('');
                    setGuestSearchResults([]);
                  }}
                  className="p-1 rounded-md hover:bg-gray-100 text-gray-500"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                {/* Recipient Search */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Recipients</label>

                  {/* Selected recipients */}
                  {selectedRecipients.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {selectedRecipients.map(r => (
                        <span
                          key={r._id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 text-sm rounded-full border border-blue-200"
                        >
                          <Users className="h-3 w-3" />
                          {r.name}
                          <button
                            onClick={() => removeRecipient(r._id)}
                            className="ml-0.5 hover:text-blue-900"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Search input */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      type="text"
                      placeholder="Search guests by name or email..."
                      value={guestSearchQuery}
                      onChange={(e) => handleGuestSearch(e.target.value)}
                      className="pl-10"
                    />
                    {isSearchingGuests && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <LoadingSpinner />
                      </div>
                    )}
                  </div>

                  {/* Search results dropdown */}
                  {guestSearchResults.length > 0 && (
                    <div className="mt-1 border border-gray-200 rounded-md shadow-sm bg-white max-h-40 overflow-y-auto">
                      {guestSearchResults.map(guest => (
                        <button
                          key={guest._id}
                          onClick={() => addRecipient(guest)}
                          className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm flex items-center justify-between"
                          disabled={selectedRecipients.some(r => r._id === guest._id)}
                        >
                          <div>
                            <span className="font-medium text-gray-900">{guest.name}</span>
                            <span className="text-gray-500 ml-2">{guest.email}</span>
                          </div>
                          {selectedRecipients.some(r => r._id === guest._id) && (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {guestSearchQuery.length >= 2 && guestSearchResults.length === 0 && !isSearchingGuests && (
                    <p className="mt-1 text-sm text-gray-500">No guests found matching "{guestSearchQuery}"</p>
                  )}
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <Input
                    type="text"
                    placeholder="Notification title..."
                    value={composeData.title}
                    onChange={(e) => setComposeData(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>

                {/* Message */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                  <textarea
                    placeholder="Write your message..."
                    value={composeData.message}
                    onChange={(e) => setComposeData(prev => ({ ...prev, message: e.target.value }))}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
                  />
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select
                    value={composeData.priority}
                    onChange={(e) => setComposeData(prev => ({ ...prev, priority: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between p-6 border-t bg-gray-50 rounded-b-xl">
                <p className="text-sm text-gray-500">
                  {selectedRecipients.length} recipient{selectedRecipients.length !== 1 ? 's' : ''} selected
                </p>
                <div className="flex space-x-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowComposeModal(false);
                      setComposeData({ title: '', message: '', priority: 'medium' });
                      setSelectedRecipients([]);
                      setGuestSearchQuery('');
                      setGuestSearchResults([]);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSendNotification}
                    disabled={isSendingNotification || selectedRecipients.length === 0 || !composeData.title.trim() || !composeData.message.trim()}
                    className="bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isSendingNotification ? (
                      <>Sending...</>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Send Notification
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default withErrorBoundary(AdminNotifications, { level: 'page' });
import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Check,
  Eye,
  MoreHorizontal,
  Settings,
  X,
  ChevronRight,
  Circle
} from 'lucide-react';
import { notificationService, Notification } from '../../services/notificationService';
import { useRealTime } from '../../services/realTimeService';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { LoadingSpinner } from '../LoadingSpinner';
import toast from 'react-hot-toast';

interface NotificationDropdownProps {
  isOpen: boolean;
  onToggle: () => void;
}

export default function NotificationDropdown({ isOpen, onToggle }: NotificationDropdownProps) {
  const [showAll, setShowAll] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { connectionState, connect, disconnect, on, off } = useRealTime();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  // Real-time connection setup - FIXED: Don't disconnect singleton service
  useEffect(() => {
    if (isOpen) {
      // Only connect if not already connected - singleton handles this
      connect().catch(error => {
      });
    }
    // CRITICAL FIX: Never disconnect singleton service from dropdown component
    // Other components may be using the same connection
  }, [isOpen, connect]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onToggle();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onToggle]);

  // Real-time event listeners
  useEffect(() => {
    if (connectionState !== 'connected') return;

    const handleNewNotification = (data: Record<string, unknown>) => {
      
      // Update unread count immediately
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
      queryClient.invalidateQueries({ queryKey: ['recent-notifications'] });
      
      // Show brief toast
      toast.success('New notification', {
        duration: 2000,
        icon: '🔔'
      });
    };

    const handleNotificationRead = (data: Record<string, unknown>) => {
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
      queryClient.invalidateQueries({ queryKey: ['recent-notifications'] });
    };

    on('notification:new', handleNewNotification);
    on('notification:read', handleNotificationRead);

    return () => {
      off('notification:new', handleNewNotification);
      off('notification:read', handleNotificationRead);
    };
  }, [connectionState, on, off, queryClient]);

  // Fetch unread count only once session is established (avoids 401 noise / refresh races)
  const { data: unreadCount } = useQuery({
    queryKey: ['unreadCount'],
    queryFn: () => notificationService.getUnreadCount(),
    refetchInterval: isAuthenticated ? 30000 : false,
    enabled: isAuthenticated && !authLoading,
    retry: false,
  });

  // Fetch recent notifications when dropdown is open
  const {
    data: recentNotifications,
    isLoading: isLoadingNotifications,
  } = useQuery({
    queryKey: ['recent-notifications', showAll],
    queryFn: () => notificationService.getNotifications({
      page: 1,
      limit: showAll ? 10 : 5,
      unreadOnly: !showAll
    }),
    enabled: isOpen && isAuthenticated && !authLoading,
    refetchInterval: isOpen && isAuthenticated ? 30000 : false,
    retry: false,
  });

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: notificationService.markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
      queryClient.invalidateQueries({ queryKey: ['recent-notifications'] });
    }
  });

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: notificationService.markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
      queryClient.invalidateQueries({ queryKey: ['recent-notifications'] });
      toast.success('All notifications marked as read');
    }
  });

  const handleMarkAsRead = (notificationId: string) => {
    markAsReadMutation.mutate(notificationId);
  };

  const handleMarkAllAsRead = () => {
    markAllAsReadMutation.mutate();
  };

  const handleViewAll = () => {
    let notificationRoute = '/app/notifications'; // Default fallback for guests

    if (user) {
      switch (user.role) {
        case 'admin':
          notificationRoute = '/admin/notifications';
          break;
        case 'staff':
          notificationRoute = '/staff/notifications';
          break;
        case 'travel_agent':
          notificationRoute = '/travel-agent/notifications';
          break;
        case 'guest':
        default:
          notificationRoute = '/app/notifications';
          break;
      }
    }

    window.location.href = notificationRoute;
    onToggle();
  };

  const getNotificationIcon = (notification: Notification) => {
    const typeInfo = notificationService.getNotificationTypeInfo(notification.type as unknown);
    const isUnread = notificationService.isUnread(notification);
    
    return (
      <div className={`p-2 rounded-full flex-shrink-0 ${typeInfo.color}`}>
        <Circle className={`h-3 w-3 ${isUnread ? 'fill-current' : ''}`} />
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

  return (
    <div className="relative">
      {/* Notification Bell Trigger */}
      <button
        onClick={onToggle}
        className="p-2 rounded-md text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 relative"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center min-w-[20px]">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute right-0 top-2 z-50 w-80 sm:w-96 bg-white rounded-lg shadow-xl border border-gray-200 max-h-96 overflow-hidden"
        >
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Bell className="h-5 w-5 text-gray-600" />
            <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              connectionState === 'connected' ? 'bg-green-500' : 
              connectionState === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
            }`} />
            <Button variant="ghost" size="sm" onClick={onToggle}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Actions */}
        {unreadCount > 0 && (
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleMarkAllAsRead}
              disabled={markAllAsReadMutation.isLoading}
              className="text-xs"
            >
              <Check className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          </div>
        )}

        {/* Notifications List */}
        <div className="max-h-64 overflow-y-auto">
          {isLoadingNotifications ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : recentNotifications?.notifications.length === 0 ? (
            <div className="text-center py-8 px-4">
              <Bell className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">No notifications</p>
              <p className="text-xs text-gray-500">You're all caught up!</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentNotifications?.notifications.slice(0, showAll ? 10 : 5).map((notification) => (
                <div
                  key={notification._id}
                  className={`px-4 py-3 hover:bg-gray-50 transition-colors ${
                    notificationService.isUnread(notification) ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    {getNotificationIcon(notification)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 line-clamp-1">
                        {notification.title}
                      </p>
                      <p className="text-xs text-gray-600 line-clamp-2 mt-1">
                        {notification.message}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-500">
                          {formatTimeAgo(notification.createdAt)}
                        </span>
                        <div className="flex items-center space-x-1">
                          {notificationService.isUnread(notification) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleMarkAsRead(notification._id)}
                              className="text-xs px-2 py-1 h-6"
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowAll(!showAll)}
            className="text-xs"
          >
            {showAll ? 'Show Recent' : 'Show All'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleViewAll}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            View All
            <ChevronRight className="h-3 w-3 ml-1" />
          </Button>
        </div>
        </div>
      )}
    </div>
  );
}
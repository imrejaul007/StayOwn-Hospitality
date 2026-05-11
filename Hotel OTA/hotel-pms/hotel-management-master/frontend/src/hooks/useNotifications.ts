import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { useRealTime } from '../services/realTimeService';
import { notificationService } from '../services/notificationService';
import toast from 'react-hot-toast';

export function useNotifications() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const { connectionState, connect, disconnect, on, off } = useRealTime();

  // Real-time connection is managed externally - no auto-connect

  // Real-time event listeners
  useEffect(() => {
    if (connectionState !== 'connected') return;

    const handleNewNotification = (data: { notification: Record<string, unknown> & { title: string; type: string } }) => {
      const newNotification = data.notification;
      
      // Update all relevant queries
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['recent-notifications'] });
      
      // Show toast notification
      const typeInfo = notificationService.getNotificationTypeInfo(newNotification.type);
      toast.success(newNotification.title, {
        duration: 5000,
        icon: getEmojiForNotificationType(newNotification.type),
      });
    };

    const handleNotificationRead = (data: Record<string, unknown>) => {
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['recent-notifications'] });
    };

    const handleNotificationDelivered = (data: Record<string, unknown>) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['recent-notifications'] });
    };

    const handleBulkNotificationUpdate = (data: Record<string, unknown>) => {
      queryClient.invalidateQueries({ queryKey: ['unreadCount'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['recent-notifications'] });
    };

    // Set up event listeners
    on('notification:new', handleNewNotification);
    on('notification:read', handleNotificationRead);
    on('notification:delivered', handleNotificationDelivered);
    on('notifications:bulk-update', handleBulkNotificationUpdate);

    return () => {
      off('notification:new', handleNewNotification);
      off('notification:read', handleNotificationRead);
      off('notification:delivered', handleNotificationDelivered);
      off('notifications:bulk-update', handleBulkNotificationUpdate);
    };
  }, [connectionState, on, off, queryClient]);

  // Get unread count with real-time updates
  const { data: unreadCount, isLoading: isLoadingUnreadCount } = useQuery({
    queryKey: ['unreadCount'],
    queryFn: () => notificationService.getUnreadCount(),
    enabled: isAuthenticated && !authLoading,
    refetchInterval: isAuthenticated ? 30000 : false,
    staleTime: 5000,
    retry: false,
  });

  return {
    unreadCount: unreadCount || 0,
    isLoadingUnreadCount,
    connectionState
  };
}

function getEmojiForNotificationType(type: string): string {
  const emojiMap: Record<string, string> = {
    booking_confirmation: '✅',
    booking_reminder: '⏰',
    booking_cancellation: '❌',
    payment_success: '💳',
    payment_failed: '⚠️',
    loyalty_points: '⭐',
    service_booking: '📅',
    service_reminder: '🔔',
    promotional: '🎁',
    system_alert: '🚨',
    welcome: '👋',
    check_in: '🏨',
    check_out: '👋',
    review_request: '📝',
    special_offer: '🏷️',
    meetup_invite: '🤝',
    meetup_accepted: '✅',
    meetup_declined: '📤',
    meetup_cancelled: '🚫',
    meetup_completed: '🎉'
  };
  
  return emojiMap[type] || '📢';
}

export function useNotificationStream() {
  const { connect, disconnect, connectionState } = useRealTime();

  useEffect(() => {
    // Auto-connect to notification stream when component mounts
    if (connectionState === 'disconnected') {
      connect();
    }

    // Cleanup on unmount
    return () => {
      // Don't auto-disconnect as other components might be using the connection
    };
  }, [connect, connectionState]);

  return {
    connectionState
  };
}
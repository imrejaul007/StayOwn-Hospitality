import { api } from './api';
import { API_CONFIG } from '../config/api';

// Interfaces
export interface Notification {
  _id: string;
  id?: string;
  userId: string;
  hotelId: string;
  type: NotificationTypeValue;
  title: string;
  message: string;
  /** Array of delivery channel identifiers as stored in the database (string enum values). */
  channels: NotificationChannelValue[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'read';
  readAt?: string;
  scheduledFor?: string;
  sentAt?: string;
  deliveredAt?: string;
  metadata?: {
    bookingId?: {
      _id: string;
      bookingNumber: string;
      checkIn: string;
      checkOut: string;
      roomNumber?: string;
    };
    serviceBookingId?: {
      _id: string;
      bookingDate: string;
      numberOfPeople: number;
      serviceId?: string;
    };
    paymentId?: {
      _id: string;
      amount: number;
      currency: string;
      status: string;
    };
    loyaltyTransactionId?: {
      _id: string;
      points: number;
      type: string;
      description: string;
    };
    actionUrl?: string;
    actionText?: string;
    imageUrl?: string;
    category?: string;
    tags?: string[];
  };
  deliveryAttempts: DeliveryAttempt[];
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  isExpired?: boolean;
  isScheduled?: boolean;
  canBeSent?: boolean;
}

export interface NotificationType {
  type: string;
  label: string;
  description: string;
  category: string;
  defaultEnabled: boolean;
}

export interface NotificationChannel {
  id: string;
  name: string;
  description: string;
  icon: string;
  defaultEnabled: boolean;
  supportsQuietHours: boolean;
  supportsFrequency: boolean;
}

export type NotificationTypeValue =
  // Guest / booking types
  | 'booking_confirmation' | 'booking_reminder' | 'booking_cancellation'
  | 'payment_success' | 'payment_failed' | 'loyalty_points'
  | 'service_booking' | 'service_reminder' | 'promotional'
  | 'system_alert' | 'welcome' | 'check_in' | 'check_out'
  | 'review_request' | 'special_offer'
  // Admin dashboard types
  | 'booking_created' | 'payment_update' | 'booking_cancelled' | 'user_registration'
  | 'service_request' | 'review_created' | 'user_activity' | 'data_refresh'
  // Inventory types
  | 'inventory_damage' | 'inventory_missing' | 'inventory_replacement_needed'
  | 'inventory_guest_charged' | 'inventory_low_stock' | 'checkout_inspection_failed'
  | 'inventory_theft' | 'inventory_audit_alert' | 'inventory_weekly_report'
  | 'inventory_reorder' | 'inventory_impact_summary' | 'inventory_integration_errors'
  // Daily operations
  | 'daily_check_assigned' | 'daily_check_started' | 'daily_check_overdue'
  | 'daily_check_completed' | 'daily_check_issues' | 'daily_check_quality_low'
  // Maintenance
  | 'maintenance_request_created' | 'maintenance_urgent' | 'maintenance_assigned'
  | 'maintenance_started' | 'maintenance_completed' | 'maintenance_overdue' | 'maintenance_high_cost'
  // Housekeeping & room status
  | 'room_needs_cleaning' | 'housekeeping_assigned' | 'cleaning_started'
  | 'cleaning_completed' | 'deep_cleaning_due' | 'cleaning_quality_issue'
  | 'room_out_of_order' | 'room_back_in_service' | 'room_occupied'
  | 'room_checkout_dirty' | 'room_ready'
  // Guest service workflow
  | 'guest_service_created' | 'guest_service_urgent' | 'guest_service_assigned'
  | 'guest_service_started' | 'guest_service_completed' | 'guest_service_overdue' | 'guest_service_vip'
  // Inventory management
  | 'inventory_out_of_stock' | 'inventory_damaged' | 'inventory_high_value_used' | 'inventory_theft_suspected'
  // Operational intelligence
  | 'daily_operations_summary' | 'staff_performance_alert' | 'revenue_impact_alert'
  | 'guest_satisfaction_low' | 'equipment_failure_pattern'
  // Staff management
  | 'task_assignment' | 'task_overdue' | 'shift_reminder' | 'performance_review_due'
  // Emergency & security
  | 'emergency_alert' | 'security_incident' | 'evacuation_notice' | 'safety_inspection_required'
  // Service management
  | 'service_assignment' | 'service_escalation' | 'service_feedback'
  | 'service_update' | 'service_cancellation' | 'service_overdue' | 'daily_summary'
  // Misc
  | 'overbooking_resolved'
  | 'meetup_invite' | 'meetup_accepted' | 'meetup_declined' | 'meetup_cancelled' | 'meetup_completed';

export type NotificationChannelValue = 'email' | 'sms' | 'push' | 'in_app';

export interface DeliveryAttempt {
  channel: NotificationChannelValue;
  attemptedAt: string;
  status: 'success' | 'failed';
  errorMessage?: string;
  responseData?: unknown;
}

export interface NotificationPreference {
  _id: string;
  userId: string;
  hotelId: string;
  email: {
    enabled: boolean;
    address: string;
    types: Record<NotificationTypeValue, boolean>;
    frequency: 'immediate' | 'hourly' | 'daily' | 'weekly';
    quietHours: {
      enabled: boolean;
      start: string;
      end: string;
    };
  };
  sms: {
    enabled: boolean;
    number: string;
    types: Record<NotificationTypeValue, boolean>;
    frequency: 'immediate' | 'hourly' | 'daily';
    quietHours: {
      enabled: boolean;
      start: string;
      end: string;
    };
  };
  push: {
    enabled: boolean;
    token: string;
    deviceInfo?: {
      platform: 'web' | 'ios' | 'android';
      version?: string;
      model?: string;
    };
    types: Record<NotificationTypeValue, boolean>;
    frequency: 'immediate' | 'hourly' | 'daily';
    quietHours: {
      enabled: boolean;
      start: string;
      end: string;
    };
  };
  inApp: {
    enabled: boolean;
    types: Record<NotificationTypeValue, boolean>;
    sound: boolean;
    vibration: boolean;
    showBadge: boolean;
  };
  global: {
    enabled: boolean;
    language: 'en' | 'es' | 'fr' | 'de' | 'hi' | 'zh';
    timezone: string;
    digest: {
      enabled: boolean;
      frequency: 'daily' | 'weekly';
      time: string;
    };
  };
  hasEnabledChannels?: boolean;
  enabledChannels?: NotificationChannelValue[];
  createdAt: string;
  updatedAt: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
  unreadCount: number;
  totalCount: number;
  totalPages: number;
  todayCount?: number;
  urgentCount?: number;
  weeklyCount?: number;
  highPriorityCount?: number;
  bookingCount?: number;
  commissionCount?: number;
}

export interface UnreadCountResponse {
  unreadCount: number;
}

export interface MarkReadRequest {
  notificationIds: string[];
}

export interface UpdatePreferencesRequest {
  channel: 'email' | 'sms' | 'push' | 'inApp';
  settings: {
    enabled?: boolean;
    address?: string;
    number?: string;
    token?: string;
    frequency?: 'immediate' | 'hourly' | 'daily' | 'weekly';
    quietHours?: {
      enabled: boolean;
      start: string;
      end: string;
    };
    sound?: boolean;
    vibration?: boolean;
    showBadge?: boolean;
  };
}

export interface UpdateTypeRequest {
  enabled: boolean;
}

export interface TestNotificationRequest {
  channel: NotificationChannelValue;
  type?: NotificationTypeValue;
}

class NotificationService {
  private eventSource: EventSource | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private listeners: Map<string, Set<(notification: Notification) => void>> = new Map();
  private browserNotificationEnabled = false;
  private serviceWorkerRegistration: ServiceWorkerRegistration | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private scheduledTimers: Set<ReturnType<typeof setTimeout>> = new Set();

  private normalizeNotification(notification: Partial<Notification>): Notification {
    const normalizedId = String(notification._id || notification.id || '');
    return {
      ...(notification as Notification),
      _id: normalizedId,
      id: notification.id ? String(notification.id) : normalizedId
    };
  }

  // Get notifications with pagination and filters
  async getNotifications(params?: {
    page?: number;
    limit?: number;
    status?: string;
    type?: string;
    priority?: string;
    search?: string;
    unreadOnly?: boolean;
    readOnly?: boolean;
    propertyId?: string;
  }): Promise<NotificationsResponse> {
    try {
      const searchParams = new URLSearchParams();

      if (params?.page) searchParams.append('page', params.page.toString());
      if (params?.limit) searchParams.append('limit', params.limit.toString());
      if (params?.status) searchParams.append('status', params.status);
      if (params?.type) searchParams.append('type', params.type);
      if (params?.priority) searchParams.append('priority', params.priority);
      if (params?.search) searchParams.append('search', params.search);
      if (params?.unreadOnly) searchParams.append('unreadOnly', params.unreadOnly.toString());
      if (params?.readOnly) searchParams.append('readOnly', params.readOnly.toString());
      if (params?.propertyId) searchParams.append('propertyId', params.propertyId);

      const response = await api.get(`/notifications?${searchParams.toString()}`);
      const payload = response.data.data || {};
      const notifications = Array.isArray(payload.notifications)
        ? payload.notifications.map((notification: Partial<Notification>) => this.normalizeNotification(notification))
        : [];
      const pagination = payload.pagination || {
        currentPage: params?.page || 1,
        totalPages: 1,
        totalItems: notifications.length,
        itemsPerPage: params?.limit || 20
      };

      return {
        ...payload,
        notifications,
        pagination,
        totalPages: payload.totalPages ?? pagination.totalPages ?? 1
      };
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Get unread notification count
  async getUnreadCount(propertyId?: string | { signal?: AbortSignal; queryKey?: unknown }): Promise<number> {
    try {
      // TanStack Query passes QueryFunctionContext as the first arg when used as `queryFn: this.getUnreadCount`
      const pid = typeof propertyId === 'string' && propertyId.trim() !== '' ? propertyId.trim() : undefined;
      const params = pid ? `?propertyId=${encodeURIComponent(pid)}` : '';
      const response = await api.get(`/notifications/unread-count${params}`);
      return response.data.data.unreadCount;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Get specific notification
  async getNotification(id: string): Promise<Notification> {
    try {
      const response = await api.get(`/notifications/${id}`);
      return response.data.data.notification;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Mark notification as read
  async markAsRead(id: string): Promise<void> {
    try {
      await api.patch(`/notifications/${id}/read`);
      // Track read event
      await this.trackNotificationEvent('read', {
        notificationId: id,
        channel: 'in_app',
        metadata: { action: 'mark_as_read' }
      });
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Mark multiple notifications as read
  async markMultipleAsRead(notificationIds: string[]): Promise<{ modifiedCount: number }> {
    try {
      const response = await api.post('/notifications/mark-read', { notificationIds });
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Mark all notifications as read
  async markAllAsRead(): Promise<{ modifiedCount: number }> {
    try {
      const response = await api.post('/notifications/mark-all-read');
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Delete notification
  async deleteNotification(id: string): Promise<void> {
    try {
      await api.delete(`/notifications/${id}`);
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Get notification preferences
  async getPreferences(): Promise<NotificationPreference> {
    try {
      const response = await api.get('/notifications/preferences');
      return response.data.data.preferences;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Update notification preferences
  async updatePreferences(request: UpdatePreferencesRequest): Promise<NotificationPreference> {
    try {
      const response = await api.patch('/notifications/preferences', request);
      return response.data.data.preferences;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Update specific notification type setting
  async updateTypeSetting(
    channel: string,
    type: string,
    enabled: boolean
  ): Promise<NotificationPreference> {
    try {
      const response = await api.patch(`/notifications/preferences/${channel}/${type}`, { enabled });
      return response.data.data.preferences;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Get available notification types
  async getNotificationTypes(): Promise<NotificationType[]> {
    try {
      const response = await api.get('/notifications/types');
      return response.data.data.notificationTypes;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Get available notification channels
  async getNotificationChannels(): Promise<NotificationChannel[]> {
    try {
      const response = await api.get('/notifications/channels');
      return response.data.data.channels;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Send test notification
  async sendTestNotification(request: TestNotificationRequest): Promise<Notification> {
    try {
      const response = await api.post('/notifications/test', request);
      return response.data.data.notification;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Utility functions
  getNotificationTypeInfo(type: NotificationTypeValue): {
    label: string;
    color: string;
    icon: string;
    description: string;
  } {
    const typeInfo: Record<NotificationTypeValue, {
      label: string;
      color: string;
      icon: string;
      description: string;
    }> = {
      booking_confirmation: {
        label: 'Booking Confirmation',
        color: 'bg-green-100 text-green-800',
        icon: 'check-circle',
        description: 'Your booking has been confirmed'
      },
      booking_reminder: {
        label: 'Booking Reminder',
        color: 'bg-blue-100 text-blue-800',
        icon: 'clock',
        description: 'Reminder about your upcoming booking'
      },
      booking_cancellation: {
        label: 'Booking Cancellation',
        color: 'bg-red-100 text-red-800',
        icon: 'x-circle',
        description: 'Your booking has been cancelled'
      },
      payment_success: {
        label: 'Payment Success',
        color: 'bg-green-100 text-green-800',
        icon: 'credit-card',
        description: 'Payment processed successfully'
      },
      payment_failed: {
        label: 'Payment Failed',
        color: 'bg-red-100 text-red-800',
        icon: 'alert-circle',
        description: 'Payment processing failed'
      },
      loyalty_points: {
        label: 'Loyalty Points',
        color: 'bg-purple-100 text-purple-800',
        icon: 'star',
        description: 'Loyalty points update'
      },
      service_booking: {
        label: 'Service Booking',
        color: 'bg-indigo-100 text-indigo-800',
        icon: 'calendar',
        description: 'Hotel service booking confirmation'
      },
      service_reminder: {
        label: 'Service Reminder',
        color: 'bg-blue-100 text-blue-800',
        icon: 'bell',
        description: 'Reminder about scheduled service'
      },
      promotional: {
        label: 'Promotional',
        color: 'bg-yellow-100 text-yellow-800',
        icon: 'gift',
        description: 'Special offers and promotions'
      },
      system_alert: {
        label: 'System Alert',
        color: 'bg-orange-100 text-orange-800',
        icon: 'alert-triangle',
        description: 'Important system notification'
      },
      welcome: {
        label: 'Welcome',
        color: 'bg-green-100 text-green-800',
        icon: 'heart',
        description: 'Welcome message'
      },
      check_in: {
        label: 'Check-in',
        color: 'bg-blue-100 text-blue-800',
        icon: 'log-in',
        description: 'Check-in related notification'
      },
      check_out: {
        label: 'Check-out',
        color: 'bg-gray-100 text-gray-800',
        icon: 'log-out',
        description: 'Check-out related notification'
      },
      review_request: {
        label: 'Review Request',
        color: 'bg-purple-100 text-purple-800',
        icon: 'message-square',
        description: 'Request to review your stay'
      },
      special_offer: {
        label: 'Special Offer',
        color: 'bg-pink-100 text-pink-800',
        icon: 'tag',
        description: 'Exclusive offer for you'
      },
      // Admin dashboard types
      booking_created: { label: 'Booking Created', color: 'bg-green-100 text-green-800', icon: 'check-circle', description: 'New booking created' },
      payment_update: { label: 'Payment Update', color: 'bg-blue-100 text-blue-800', icon: 'credit-card', description: 'Payment status update' },
      booking_cancelled: { label: 'Booking Cancelled', color: 'bg-red-100 text-red-800', icon: 'x-circle', description: 'Booking cancelled' },
      user_registration: { label: 'New User', color: 'bg-green-100 text-green-800', icon: 'heart', description: 'New user registered' },
      service_request: { label: 'Service Request', color: 'bg-blue-100 text-blue-800', icon: 'bell', description: 'Guest service request' },
      review_created: { label: 'New Review', color: 'bg-purple-100 text-purple-800', icon: 'message-square', description: 'New review submitted' },
      user_activity: { label: 'User Activity', color: 'bg-gray-100 text-gray-800', icon: 'help-circle', description: 'User activity event' },
      data_refresh: { label: 'Data Refresh', color: 'bg-gray-100 text-gray-800', icon: 'help-circle', description: 'Data refreshed' },
      // Inventory types
      inventory_damage: { label: 'Inventory Damage', color: 'bg-red-100 text-red-800', icon: 'alert-triangle', description: 'Inventory damaged' },
      inventory_missing: { label: 'Inventory Missing', color: 'bg-red-100 text-red-800', icon: 'alert-circle', description: 'Inventory missing' },
      inventory_replacement_needed: { label: 'Replacement Needed', color: 'bg-orange-100 text-orange-800', icon: 'alert-triangle', description: 'Item needs replacement' },
      inventory_guest_charged: { label: 'Guest Charged', color: 'bg-yellow-100 text-yellow-800', icon: 'credit-card', description: 'Guest charged for inventory' },
      inventory_low_stock: { label: 'Low Stock', color: 'bg-yellow-100 text-yellow-800', icon: 'alert-triangle', description: 'Inventory running low' },
      checkout_inspection_failed: { label: 'Inspection Failed', color: 'bg-red-100 text-red-800', icon: 'alert-circle', description: 'Checkout inspection failed' },
      inventory_theft: { label: 'Theft Alert', color: 'bg-red-100 text-red-800', icon: 'alert-triangle', description: 'Possible theft detected' },
      inventory_audit_alert: { label: 'Audit Alert', color: 'bg-orange-100 text-orange-800', icon: 'alert-circle', description: 'Inventory audit required' },
      inventory_weekly_report: { label: 'Weekly Report', color: 'bg-blue-100 text-blue-800', icon: 'calendar', description: 'Inventory weekly report' },
      inventory_reorder: { label: 'Reorder Required', color: 'bg-yellow-100 text-yellow-800', icon: 'alert-triangle', description: 'Items need reorder' },
      inventory_impact_summary: { label: 'Impact Summary', color: 'bg-blue-100 text-blue-800', icon: 'bell', description: 'Inventory impact summary' },
      inventory_integration_errors: { label: 'Integration Error', color: 'bg-red-100 text-red-800', icon: 'alert-circle', description: 'Inventory integration error' },
      // Daily operations
      daily_check_assigned: { label: 'Daily Check Assigned', color: 'bg-blue-100 text-blue-800', icon: 'calendar', description: 'Daily room check assigned' },
      daily_check_started: { label: 'Daily Check Started', color: 'bg-blue-100 text-blue-800', icon: 'clock', description: 'Daily check in progress' },
      daily_check_overdue: { label: 'Daily Check Overdue', color: 'bg-red-100 text-red-800', icon: 'alert-triangle', description: 'Daily check overdue' },
      daily_check_completed: { label: 'Daily Check Completed', color: 'bg-green-100 text-green-800', icon: 'check-circle', description: 'Daily check complete' },
      daily_check_issues: { label: 'Check Issues Found', color: 'bg-orange-100 text-orange-800', icon: 'alert-circle', description: 'Issues found during daily check' },
      daily_check_quality_low: { label: 'Low Quality Score', color: 'bg-orange-100 text-orange-800', icon: 'alert-triangle', description: 'Quality score below threshold' },
      // Maintenance
      maintenance_request_created: { label: 'Maintenance Request', color: 'bg-orange-100 text-orange-800', icon: 'alert-triangle', description: 'New maintenance request' },
      maintenance_urgent: { label: 'Urgent Maintenance', color: 'bg-red-100 text-red-800', icon: 'alert-circle', description: 'Urgent maintenance needed' },
      maintenance_assigned: { label: 'Maintenance Assigned', color: 'bg-blue-100 text-blue-800', icon: 'calendar', description: 'Maintenance task assigned to you' },
      maintenance_started: { label: 'Maintenance Started', color: 'bg-blue-100 text-blue-800', icon: 'clock', description: 'Maintenance in progress' },
      maintenance_completed: { label: 'Maintenance Done', color: 'bg-green-100 text-green-800', icon: 'check-circle', description: 'Maintenance completed' },
      maintenance_overdue: { label: 'Maintenance Overdue', color: 'bg-red-100 text-red-800', icon: 'alert-triangle', description: 'Maintenance task overdue' },
      maintenance_high_cost: { label: 'High-Cost Maintenance', color: 'bg-orange-100 text-orange-800', icon: 'alert-triangle', description: 'High-cost maintenance alert' },
      // Housekeeping & room status
      room_needs_cleaning: { label: 'Cleaning Needed', color: 'bg-yellow-100 text-yellow-800', icon: 'bell', description: 'Room requires cleaning' },
      housekeeping_assigned: { label: 'Housekeeping Assigned', color: 'bg-blue-100 text-blue-800', icon: 'calendar', description: 'Housekeeping task assigned' },
      cleaning_started: { label: 'Cleaning Started', color: 'bg-blue-100 text-blue-800', icon: 'clock', description: 'Cleaning in progress' },
      cleaning_completed: { label: 'Cleaning Done', color: 'bg-green-100 text-green-800', icon: 'check-circle', description: 'Room cleaned' },
      deep_cleaning_due: { label: 'Deep Clean Due', color: 'bg-orange-100 text-orange-800', icon: 'alert-triangle', description: 'Deep cleaning required' },
      cleaning_quality_issue: { label: 'Quality Issue', color: 'bg-red-100 text-red-800', icon: 'alert-circle', description: 'Cleaning quality issue' },
      room_out_of_order: { label: 'Room OOO', color: 'bg-red-100 text-red-800', icon: 'alert-circle', description: 'Room is out of order' },
      room_back_in_service: { label: 'Room Back In Service', color: 'bg-green-100 text-green-800', icon: 'check-circle', description: 'Room is available again' },
      room_occupied: { label: 'Room Occupied', color: 'bg-blue-100 text-blue-800', icon: 'log-in', description: 'Room now occupied' },
      room_checkout_dirty: { label: 'Checkout - Needs Cleaning', color: 'bg-yellow-100 text-yellow-800', icon: 'bell', description: 'Guest checked out, cleaning needed' },
      room_ready: { label: 'Room Ready', color: 'bg-green-100 text-green-800', icon: 'check-circle', description: 'Room ready for guest' },
      // Guest service workflow
      guest_service_created: { label: 'Guest Request', color: 'bg-blue-100 text-blue-800', icon: 'bell', description: 'New guest service request' },
      guest_service_urgent: { label: 'Urgent Guest Request', color: 'bg-red-100 text-red-800', icon: 'alert-triangle', description: 'Urgent guest request' },
      guest_service_assigned: { label: 'Request Assigned', color: 'bg-blue-100 text-blue-800', icon: 'calendar', description: 'Guest request assigned to you' },
      guest_service_started: { label: 'Request In Progress', color: 'bg-blue-100 text-blue-800', icon: 'clock', description: 'Service request in progress' },
      guest_service_completed: { label: 'Request Completed', color: 'bg-green-100 text-green-800', icon: 'check-circle', description: 'Guest request fulfilled' },
      guest_service_overdue: { label: 'Request Overdue', color: 'bg-red-100 text-red-800', icon: 'alert-triangle', description: 'Guest request is overdue' },
      guest_service_vip: { label: 'VIP Guest Request', color: 'bg-purple-100 text-purple-800', icon: 'star', description: 'VIP guest service request' },
      // More inventory
      inventory_out_of_stock: { label: 'Out of Stock', color: 'bg-red-100 text-red-800', icon: 'alert-circle', description: 'Item out of stock' },
      inventory_damaged: { label: 'Inventory Damaged', color: 'bg-red-100 text-red-800', icon: 'alert-triangle', description: 'Inventory item damaged' },
      inventory_high_value_used: { label: 'High-Value Item Used', color: 'bg-orange-100 text-orange-800', icon: 'alert-triangle', description: 'High-value inventory consumed' },
      inventory_theft_suspected: { label: 'Theft Suspected', color: 'bg-red-100 text-red-800', icon: 'alert-circle', description: 'Possible inventory theft' },
      // Operational intelligence
      daily_operations_summary: { label: 'Daily Summary', color: 'bg-blue-100 text-blue-800', icon: 'calendar', description: 'Daily operations summary' },
      staff_performance_alert: { label: 'Performance Alert', color: 'bg-orange-100 text-orange-800', icon: 'alert-triangle', description: 'Staff performance alert' },
      revenue_impact_alert: { label: 'Revenue Alert', color: 'bg-red-100 text-red-800', icon: 'alert-circle', description: 'Revenue impact alert' },
      guest_satisfaction_low: { label: 'Low Satisfaction', color: 'bg-orange-100 text-orange-800', icon: 'alert-triangle', description: 'Guest satisfaction below threshold' },
      equipment_failure_pattern: { label: 'Equipment Pattern', color: 'bg-red-100 text-red-800', icon: 'alert-circle', description: 'Equipment failure pattern detected' },
      // Staff management
      task_assignment: { label: 'Task Assigned', color: 'bg-blue-100 text-blue-800', icon: 'calendar', description: 'New task assigned to you' },
      task_overdue: { label: 'Task Overdue', color: 'bg-red-100 text-red-800', icon: 'alert-triangle', description: 'Task is overdue' },
      shift_reminder: { label: 'Shift Reminder', color: 'bg-blue-100 text-blue-800', icon: 'clock', description: 'Upcoming shift reminder' },
      performance_review_due: { label: 'Performance Review', color: 'bg-purple-100 text-purple-800', icon: 'calendar', description: 'Performance review due' },
      // Emergency & security
      emergency_alert: { label: 'Emergency Alert', color: 'bg-red-100 text-red-800', icon: 'alert-circle', description: 'Emergency situation' },
      security_incident: { label: 'Security Incident', color: 'bg-red-100 text-red-800', icon: 'alert-triangle', description: 'Security incident reported' },
      evacuation_notice: { label: 'Evacuation Notice', color: 'bg-red-100 text-red-800', icon: 'alert-circle', description: 'Evacuation required' },
      safety_inspection_required: { label: 'Safety Inspection', color: 'bg-orange-100 text-orange-800', icon: 'alert-triangle', description: 'Safety inspection required' },
      // Service management
      service_assignment: { label: 'Service Assigned', color: 'bg-blue-100 text-blue-800', icon: 'calendar', description: 'Service task assigned' },
      service_escalation: { label: 'Service Escalated', color: 'bg-red-100 text-red-800', icon: 'alert-triangle', description: 'Service escalated' },
      service_feedback: { label: 'Service Feedback', color: 'bg-purple-100 text-purple-800', icon: 'message-square', description: 'Service feedback received' },
      service_update: { label: 'Service Update', color: 'bg-blue-100 text-blue-800', icon: 'bell', description: 'Service status updated' },
      service_cancellation: { label: 'Service Cancelled', color: 'bg-red-100 text-red-800', icon: 'x-circle', description: 'Service cancelled' },
      service_overdue: { label: 'Service Overdue', color: 'bg-red-100 text-red-800', icon: 'alert-triangle', description: 'Service is overdue' },
      daily_summary: { label: 'Daily Summary', color: 'bg-blue-100 text-blue-800', icon: 'calendar', description: 'Daily operations summary' },
      // Misc
      overbooking_resolved: { label: 'Overbooking Resolved', color: 'bg-green-100 text-green-800', icon: 'check-circle', description: 'Overbooking situation resolved' },
      meetup_invite: { label: 'Meetup Invite', color: 'bg-purple-100 text-purple-800', icon: 'heart', description: 'Guest meetup invitation' },
      meetup_accepted: { label: 'Meetup Accepted', color: 'bg-green-100 text-green-800', icon: 'check-circle', description: 'Meetup invitation accepted' },
      meetup_declined: { label: 'Meetup Declined', color: 'bg-gray-100 text-gray-800', icon: 'x-circle', description: 'Meetup invitation declined' },
      meetup_cancelled: { label: 'Meetup Cancelled', color: 'bg-red-100 text-red-800', icon: 'x-circle', description: 'Meetup cancelled' },
      meetup_completed: { label: 'Meetup Completed', color: 'bg-green-100 text-green-800', icon: 'check-circle', description: 'Meetup completed' }
    };

    return typeInfo[type] ?? {
      label: 'Notification',
      color: 'bg-gray-100 text-gray-800',
      icon: 'help-circle',
      description: 'Hotel notification'
    };
  }

  getPriorityInfo(priority: string): {
    label: string;
    color: string;
    icon: string;
  } {
    const priorityInfo: Record<string, { label: string; color: string; icon: string }> = {
      low: {
        label: 'Low',
        color: 'bg-gray-100 text-gray-800',
        icon: 'minus'
      },
      medium: {
        label: 'Medium',
        color: 'bg-blue-100 text-blue-800',
        icon: 'circle'
      },
      high: {
        label: 'High',
        color: 'bg-orange-100 text-orange-800',
        icon: 'alert-triangle'
      },
      urgent: {
        label: 'Urgent',
        color: 'bg-red-100 text-red-800',
        icon: 'alert-octagon'
      }
    };

    return priorityInfo[priority] || priorityInfo.medium;
  }

  getStatusInfo(status: string): {
    label: string;
    color: string;
    description: string;
  } {
    const statusInfo: Record<string, { label: string; color: string; description: string }> = {
      pending: {
        label: 'Pending',
        color: 'bg-yellow-100 text-yellow-800',
        description: 'Notification is waiting to be sent'
      },
      sent: {
        label: 'Sent',
        color: 'bg-blue-100 text-blue-800',
        description: 'Notification has been sent'
      },
      delivered: {
        label: 'Delivered',
        color: 'bg-green-100 text-green-800',
        description: 'Notification has been delivered'
      },
      failed: {
        label: 'Failed',
        color: 'bg-red-100 text-red-800',
        description: 'Notification delivery failed'
      },
      read: {
        label: 'Read',
        color: 'bg-gray-100 text-gray-800',
        description: 'Notification has been read'
      }
    };

    return statusInfo[status] || statusInfo.pending;
  }

  formatTimeAgo(dateString: string): string {
    const now = new Date();
    const then = new Date(dateString);
    const diffMs = now.getTime() - then.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;

    // Use actual month/year calculation instead of approximate division
    const months = (now.getFullYear() - then.getFullYear()) * 12 + (now.getMonth() - then.getMonth());
    if (months < 12) return `${months}mo ago`;
    const years = Math.floor(months / 12);
    return `${years}y ago`;
  }

  isUnread(notification: Notification): boolean {
    // A notification is unread if it doesn't have a readAt timestamp
    return !notification.readAt;
  }

  canMarkAsRead(notification: Notification): boolean {
    return this.isUnread(notification);
  }

  canDelete(notification: Notification): boolean {
    return true; // Users can delete any notification
  }

  // Connect to SSE stream for real-time notifications
  connectToStream(token?: string) {
    if (this.eventSource) {
      this.eventSource.close();
    }

    const baseUrl = API_CONFIG.BASE_URL;
    const url = `${baseUrl}/notifications/stream`;

    this.eventSource = new EventSource(url, {
      withCredentials: true
    });

    this.eventSource.onopen = () => {
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
    };

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'notification') {
          this.handleNewNotification(data.data);
        } else if (data.type === 'connection') {
        }
      } catch {
        // Error handled silently
      }
    };

    this.eventSource.onerror = (error) => {
      this.eventSource?.close();

      // Reconnect with exponential backoff
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = null;
          this.reconnectAttempts++;
          this.reconnectDelay *= 2;
          this.connectToStream(token);
        }, this.reconnectDelay);
      }
    };
  }

  // Disconnect from SSE stream
  disconnectStream() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.listeners.clear();
  }

  // Handle new notification
  private handleNewNotification(notification: Notification) {
    // Notify all listeners
    this.listeners.forEach(callbacks => {
      callbacks.forEach(callback => callback(notification));
    });

    // Request browser notification permission if urgent
    if (notification.priority === 'urgent' && 'Notification' in window) {
      this.showBrowserNotification(notification);
    }
  }

  // Show browser notification
  private async showBrowserNotification(notification: Notification) {
    if (Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/logo.png',
        badge: '/badge.png',
        tag: notification._id,
        requireInteraction: notification.priority === 'urgent'
      });
    } else if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        this.showBrowserNotification(notification);
      }
    }
  }

  // Subscribe to notifications
  subscribe(key: string, callback: (notification: Notification) => void) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(key);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.listeners.delete(key);
        }
      }
    };
  }

  // Request browser notification permission
  async requestPermission(): Promise<NotificationPermission> {
    if ('Notification' in window) {
      return await Notification.requestPermission();
    }
    return 'denied';
  }

  // Get notification summary
  async getSummary() {
    try {
      const response = await api.get('/notifications/summary');
      return response.data.data;
    } catch (error: unknown) {
      throw error instanceof Error ? error : new Error('Request failed');
    }
  }

  // Initialize browser notifications
  async initializeBrowserNotifications(): Promise<boolean> {
    try {
      // Check if browser supports notifications
      if (!('Notification' in window)) {
        return false;
      }

      // Register service worker for advanced notification features
      if ('serviceWorker' in navigator) {
        this.serviceWorkerRegistration = await navigator.serviceWorker.register('/sw-notifications.js', {
          scope: '/'
        });
      }

      // Request permission if not already granted
      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        this.browserNotificationEnabled = permission === 'granted';
      } else {
        this.browserNotificationEnabled = Notification.permission === 'granted';
      }

      return this.browserNotificationEnabled;
    } catch (error) {
      return false;
    }
  }

  // Send browser notification
  async sendBrowserNotification(notification: Notification): Promise<void> {
    if (!this.browserNotificationEnabled) {
      return;
    }

    // Don't show browser notification if page is visible and focused
    if (document.visibilityState === 'visible' && document.hasFocus()) {
      return;
    }

    try {
      const typeInfo = this.getNotificationTypeInfo(notification.type);
      const priorityInfo = this.getPriorityInfo(notification.priority);

      const options: NotificationOptions = {
        body: notification.message,
        icon: this.getNotificationIcon(notification.type),
        badge: '/badge-icon.png',
        tag: `pentouz-${notification._id}`,
        data: {
          id: notification._id,
          type: notification.type,
          url: this.getNotificationUrl(notification),
          timestamp: Date.now()
        },
        requireInteraction: notification.priority === 'urgent',
        silent: false,
        vibrate: [200, 100, 200]
      };

      // Add action buttons for certain notification types
      if (notification.type === 'service_request' || notification.type === 'guest_request') {
        options.actions = [
          {
            action: 'accept',
            title: 'Accept'
          },
          {
            action: 'view',
            title: 'View Details'
          }
        ];
      }

      const browserNotification = new Notification(
        `THE PENTOUZ - ${notification.title}`,
        options
      );

      // Auto-close non-urgent notifications after 8 seconds
      if (notification.priority !== 'urgent') {
        const autoCloseTimer = setTimeout(() => {
          this.scheduledTimers.delete(autoCloseTimer);
          browserNotification.close();
        }, 8000);
        this.scheduledTimers.add(autoCloseTimer);
      }

      // Handle notification click
      browserNotification.onclick = () => {
        window.focus();
        const url = this.getNotificationUrl(notification);
        if (url) {
          window.location.href = url;
        }
        browserNotification.close();
      };

      // Track notification display
      await this.trackNotificationEvent('delivered', {
        notificationId: notification._id,
        channel: 'browser',
        metadata: {
          category: notification.metadata?.category || 'general',
          priority: notification.priority,
          type: notification.type
        }
      });

    } catch {
      // Error handled silently
    }
  }

  // Get notification icon based on type
  private getNotificationIcon(type: string): string {
    const iconMap: Record<string, string> = {
      booking_confirmation: '/icons/booking.png',
      booking_reminder: '/icons/reminder.png',
      payment_success: '/icons/payment.png',
      payment_failed: '/icons/alert.png',
      service_request: '/icons/service.png',
      guest_request: '/icons/guest.png',
      maintenance_alert: '/icons/maintenance.png',
      inventory_alert: '/icons/inventory.png',
      system_alert: '/icons/system.png',
      check_in: '/icons/checkin.png',
      check_out: '/icons/checkout.png',
      promotional: '/icons/offer.png',
      special_offer: '/icons/special.png'
    };

    return iconMap[type] || '/favicon.ico';
  }

  // Get notification URL for navigation
  private getNotificationUrl(notification: Notification): string {
    const bookingId = notification.metadata?.bookingId?._id;
    const paymentId = notification.metadata?.paymentId?._id;
    const serviceBookingId = notification.metadata?.serviceBookingId?._id;
    const urlMap: Record<string, string> = {
      booking_confirmation: bookingId ? `/app/bookings/${bookingId}` : '/app/bookings',
      booking_reminder: bookingId ? `/app/bookings/${bookingId}` : '/app/bookings',
      payment_success: paymentId ? `/app/billing?paymentId=${paymentId}` : '/app/billing',
      payment_failed: paymentId ? `/app/billing?paymentId=${paymentId}` : '/app/billing',
      service_request: serviceBookingId ? `/app/services/bookings/confirmation/${serviceBookingId}` : '/app/services/bookings',
      guest_request: '/app/requests',
      maintenance_alert: notification.metadata?.actionUrl || '/admin/maintenance',
      inventory_alert: notification.metadata?.actionUrl || '/admin/inventory',
      system_alert: notification.metadata?.actionUrl || '/admin/notifications',
      check_in: bookingId ? `/app/bookings/${bookingId}` : '/app/bookings',
      check_out: bookingId ? `/app/bookings/${bookingId}` : '/app/bookings',
      promotional: `/app/loyalty/offers`,
      special_offer: `/app/loyalty/offers`
    };

    return urlMap[notification.type] || '/app/notifications';
  }

  // Track notification events for analytics
  async trackNotificationEvent(
    event: 'sent' | 'delivered' | 'read' | 'clicked' | 'dismissed' | 'failed',
    options: {
      notificationId?: string;
      channel?: 'in_app' | 'browser' | 'email' | 'sms' | 'push';
      metadata?: Record<string, unknown>;
      deviceInfo?: Record<string, unknown>;
    } = {}
  ): Promise<void> {
    try {
      await api.post('/analytics/notification-events', {
        event,
        notificationId: options.notificationId,
        channel: options.channel || 'in_app',
        metadata: {
          category: 'general',
          priority: 'normal',
          source: 'system',
          ...options.metadata,
          userAgent: navigator.userAgent,
          url: window.location.href,
          timestamp: Date.now()
        },
        deviceInfo: {
          platform: navigator.platform,
          isMobile: /mobile/i.test(navigator.userAgent),
          browser: this.getBrowserInfo(),
          ...options.deviceInfo
        }
      });
    } catch {
      // Error handled silently
    }
  }

  // Get browser information
  private getBrowserInfo(): string {
    const ua = navigator.userAgent;
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Edge')) return 'Edge';
    return 'Unknown';
  }

  // Get notification preferences from user settings
  async getNotificationPreferences(): Promise<unknown> {
    try {
      const response = await api.get('/notifications/preferences');
      return response.data.data;
    } catch (error) {
      return {
        preferences: {
          inApp: { enabled: true, sound: true, vibration: true, types: {} },
          email: { enabled: true, address: '', quietHours: { enabled: false, start: '22:00', end: '08:00' }, types: {} },
          sms: { enabled: false, number: '', quietHours: { enabled: false, start: '22:00', end: '08:00' }, types: {} },
          push: { enabled: true, quietHours: { enabled: false, start: '22:00', end: '08:00' }, types: {} }
        }
      };
    }
  }

  // Update notification preferences
  async updateNotificationPreferences(channel: string, settings: Record<string, unknown>): Promise<void> {
    try {
      await api.patch('/notifications/preferences', {
        channel,
        settings
      });

      // Update browser notification enabled state
      if (channel === 'push' && typeof settings.enabled === 'boolean') {
        this.browserNotificationEnabled = settings.enabled;
      }
    } catch {
      // Error handled silently
    }
  }

  // Clear all browser notifications
  clearAllBrowserNotifications(): void {
    if (this.serviceWorkerRegistration) {
      this.serviceWorkerRegistration.getNotifications().then(notifications => {
        notifications.forEach(notification => {
          if (notification.tag?.startsWith('pentouz-')) {
            notification.close();
          }
        });
      });
    }
  }

  // Schedule a browser notification for later
  async scheduleNotification(notification: Notification, delay: number): Promise<void> {
    if (!this.browserNotificationEnabled) {
      return;
    }

    const timer = setTimeout(() => {
      this.scheduledTimers.delete(timer);
      this.sendBrowserNotification(notification);
    }, delay);
    this.scheduledTimers.add(timer);
  }

  // Cleanup all timers
  destroy() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.scheduledTimers.forEach(timer => clearTimeout(timer));
    this.scheduledTimers.clear();
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}

export const notificationService = new NotificationService();

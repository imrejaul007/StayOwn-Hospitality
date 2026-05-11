// -----------------------------------------------------------------------------
// Notification types - mirrors backend/src/models/Notification.js
// -----------------------------------------------------------------------------

export type NotificationType =
  // Original types
  | 'booking_confirmation'
  | 'booking_reminder'
  | 'booking_cancellation'
  | 'payment_success'
  | 'payment_failed'
  | 'loyalty_points'
  | 'service_booking'
  | 'service_reminder'
  | 'promotional'
  | 'system_alert'
  | 'welcome'
  | 'check_in'
  | 'check_out'
  | 'review_request'
  | 'special_offer'
  // Admin dashboard types
  | 'booking_created'
  | 'payment_update'
  | 'booking_cancelled'
  | 'user_registration'
  | 'service_request'
  | 'review_created'
  | 'user_activity'
  | 'data_refresh'
  // Inventory types
  | 'inventory_damage'
  | 'inventory_missing'
  | 'inventory_replacement_needed'
  | 'inventory_guest_charged'
  | 'inventory_low_stock'
  | 'checkout_inspection_failed'
  | 'inventory_theft'
  // Daily Operations
  | 'daily_check_assigned'
  | 'daily_check_started'
  | 'daily_check_overdue'
  | 'daily_check_completed'
  | 'daily_check_issues'
  | 'daily_check_quality_low'
  // Maintenance Workflow
  | 'maintenance_request_created'
  | 'maintenance_urgent'
  | 'maintenance_assigned'
  | 'maintenance_started'
  | 'maintenance_completed'
  | 'maintenance_overdue'
  | 'maintenance_high_cost'
  // Housekeeping & Room Status
  | 'room_needs_cleaning'
  | 'housekeeping_assigned'
  | 'cleaning_started'
  | 'cleaning_completed'
  | 'deep_cleaning_due'
  | 'cleaning_quality_issue'
  | 'room_out_of_order'
  | 'room_back_in_service'
  | 'room_occupied'
  | 'room_checkout_dirty'
  | 'room_ready'
  // Guest Service Workflow
  | 'guest_service_created'
  | 'guest_service_urgent'
  | 'guest_service_assigned'
  | 'guest_service_started'
  | 'guest_service_completed'
  | 'guest_service_overdue'
  | 'guest_service_vip'
  // Inventory Management
  | 'inventory_out_of_stock'
  | 'inventory_damaged'
  | 'inventory_high_value_used'
  | 'inventory_theft_suspected'
  // Operational Intelligence
  | 'daily_operations_summary'
  | 'staff_performance_alert'
  | 'revenue_impact_alert'
  | 'guest_satisfaction_low'
  | 'equipment_failure_pattern'
  // Staff Management
  | 'task_assignment'
  | 'task_overdue'
  | 'shift_reminder'
  | 'performance_review_due'
  // Emergency & Security
  | 'emergency_alert'
  | 'security_incident'
  | 'evacuation_notice'
  | 'safety_inspection_required'
  | 'meetup_invite'
  | 'meetup_accepted'
  | 'meetup_declined'
  | 'meetup_cancelled'
  | 'meetup_completed';

export type NotificationChannel = 'in_app' | 'email' | 'sms' | 'push' | 'websocket';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'read';

export type NotificationMetadataCategory =
  | 'booking'
  | 'payment'
  | 'loyalty'
  | 'service'
  | 'promotional'
  | 'system'
  | 'guest_social';

export interface NotificationMetadata {
  bookingId?: string;
  serviceBookingId?: string;
  paymentId?: string;
  loyaltyTransactionId?: string;
  meetUpRequestId?: string;
  actionUrl?: string;
  actionText?: string;
  imageUrl?: string;
  category?: NotificationMetadataCategory;
  tags?: string[];
}

export interface DeliveryAttempt {
  channel: NotificationChannel;
  attemptedAt: string;
  status: 'success' | 'failed';
  errorMessage?: string;
  responseData?: unknown;
}

export interface Notification {
  _id: string;
  id?: string;
  userId: string;
  hotelId: string;
  type: NotificationType;
  title: string;
  message: string;
  channels: NotificationChannel[];
  priority: NotificationPriority;
  status: NotificationStatus;
  readAt?: string;
  scheduledFor?: string;
  sentAt?: string;
  deliveredAt?: string;
  metadata?: NotificationMetadata;
  deliveryAttempts?: DeliveryAttempt[];
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

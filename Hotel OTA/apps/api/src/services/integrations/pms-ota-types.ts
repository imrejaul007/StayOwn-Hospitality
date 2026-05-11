/**
 * PMS ↔ OTA Integration - Shared Types
 *
 * These types define the contract between the Hotel PMS and Hotel OTA systems.
 * Used for webhook payloads, API requests, and shared data structures.
 */

// ============================================================================
// Event Types
// ============================================================================

export enum PMSWebhookEventType {
  BOOKING_CONFIRMED = 'booking_confirmed',
  CHECK_IN = 'check_in',
  CHECK_OUT = 'check_out',
  ROOM_STATUS_CHANGE = 'room_status_change',
  GUEST_DATA_UPDATED = 'guest_data_updated',
  PRICING_CHANGED = 'pricing_changed',
  HOUSEKEEPING_STATUS = 'housekeeping_status',
  INVENTORY_UPDATED = 'inventory_updated',
  RESERVATION_CANCELLED = 'reservation_cancelled',
}

export enum OTAWebhookEventType {
  BOOKING_CREATED = 'booking_created',
  BOOKING_CANCELLED = 'booking_cancelled',
  INVENTORY_SYNC_REQUEST = 'inventory_sync_request',
  PRICING_SYNC_REQUEST = 'pricing_sync_request',
  GUEST_LOYALTY_QUERY = 'guest_loyalty_query',
}

// ============================================================================
// PMS → OTA Webhook Payloads
// ============================================================================

export interface PMSWebhookPayload {
  eventId: string;
  eventType: PMSWebhookEventType;
  timestamp: string;
  hotelId: string;
  otaHotelId?: string;
  source: 'pms';
  data: PMSWebhookData;
  metadata?: Record<string, unknown>;
}

export type PMSWebhookData =
  | BookingConfirmedData
  | CheckInData
  | CheckOutData
  | RoomStatusChangeData
  | GuestDataUpdatedData
  | PricingChangedData
  | HousekeepingStatusData
  | InventoryUpdatedData
  | ReservationCancelledData;

export interface BookingConfirmedData {
  eventType: PMSWebhookEventType.BOOKING_CONFIRMED;
  reservationId: string;
  otaBookingId?: string;
  guestId: string;
  guestEmail: string;
  guestPhone?: string;
  guestName?: string;
  checkInDate: string;
  checkOutDate: string;
  roomNumber?: string;
  roomTypeId: string;
  roomTypeName: string;
  totalPrice: number;
  currency: string;
  status: 'confirmed' | 'pending';
  numberOfGuests: number;
  numberOfNights: number;
  paymentStatus: 'paid' | 'pending' | 'failed';
  otaUserId?: string;
  otaCoinBurnedPaise?: number;
  rezCoinBurnedPaise?: number;
  hotelBrandCoinBurnedPaise?: number;
}

export interface CheckInData {
  eventType: PMSWebhookEventType.CHECK_IN;
  reservationId: string;
  guestId: string;
  guestEmail: string;
  guestPhone?: string;
  checkInDate: string;
  checkOutDate: string;
  roomNumber: string;
  roomTypeId: string;
  roomTypeName: string;
  actualCheckInTime: string;
  earlyCheckIn?: boolean;
  lateCheckIn?: boolean;
}

export interface CheckOutData {
  eventType: PMSWebhookEventType.CHECK_OUT;
  reservationId: string;
  guestId: string;
  guestEmail: string;
  guestPhone?: string;
  checkInDate: string;
  checkOutDate: string;
  roomNumber: string;
  roomTypeId: string;
  roomTypeName: string;
  actualCheckOutTime: string;
  lateCheckOut?: boolean;
  earlyCheckOut?: boolean;
  bookingValuePaise: number;
  otaUserId?: string;
  coinsEarned?: number;
}

export interface RoomStatusChangeData {
  eventType: PMSWebhookEventType.ROOM_STATUS_CHANGE;
  roomId: string;
  roomNumber: string;
  roomTypeId: string;
  roomTypeName: string;
  previousStatus: RoomStatus;
  newStatus: RoomStatus;
  changedAt: string;
  changedBy?: string;
  notes?: string;
}

export type RoomStatus =
  | 'vacant_clean'
  | 'vacant_dirty'
  | 'occupied_clean'
  | 'occupied_dirty'
  | 'out_of_order'
  | 'out_of_service'
  | 'do_not_disturb'
  | 'blocked';

export interface GuestDataUpdatedData {
  eventType: PMSWebhookEventType.GUEST_DATA_UPDATED;
  guestId: string;
  otaUserId?: string;
  guestEmail?: string;
  guestPhone?: string;
  guestName?: string;
  loyaltyTier?: string;
  loyaltyPoints?: number;
  preferences?: GuestPreferences;
  updatedFields: string[];
}

export interface GuestPreferences {
  smokingPreference?: boolean;
  floorPreference?: string;
  bedPreference?: string;
  earlyCheckInRequested?: boolean;
  lateCheckOutRequested?: boolean;
  specialRequests?: string;
}

export interface PricingChangedData {
  eventType: PMSWebhookEventType.PRICING_CHANGED;
  roomTypeId: string;
  roomTypeName: string;
  date: string;
  previousRate: number;
  newRate: number;
  currency: string;
  previousAvailability: number;
  newAvailability: number;
  reason?: string;
  effectiveFrom: string;
}

export interface HousekeepingStatusData {
  eventType: PMSWebhookEventType.HOUSEKEEPING_STATUS;
  roomId: string;
  roomNumber: string;
  roomTypeId: string;
  roomTypeName: string;
  previousStatus: string;
  newStatus: HousekeepingStatus;
  scheduledTime?: string;
  completedTime?: string;
  assignedTo?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  notes?: string;
}

export type HousekeepingStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'declined'
  | 'inspected'
  | 'needs_attention';

export interface InventoryUpdatedData {
  eventType: PMSWebhookEventType.INVENTORY_UPDATED;
  roomTypeId: string;
  roomTypeName: string;
  date: string;
  previousAvailableRooms: number;
  newAvailableRooms: number;
  totalRooms: number;
  ratePaise?: number;
  isBlocked?: boolean;
}

export interface ReservationCancelledData {
  eventType: PMSWebhookEventType.RESERVATION_CANCELLED;
  reservationId: string;
  otaBookingId?: string;
  guestId: string;
  guestEmail: string;
  guestPhone?: string;
  originalCheckInDate: string;
  originalCheckOutDate: string;
  cancellationReason?: string;
  cancelledAt: string;
  cancelledBy?: string;
  refundAmount?: number;
  refundStatus?: 'pending' | 'processed' | 'none';
}

// ============================================================================
// OTA → PMS Webhook Payloads
// ============================================================================

export interface OTAWebhookPayload {
  eventId: string;
  eventType: OTAWebhookEventType;
  timestamp: string;
  hotelId: string;
  pmsHotelId?: string;
  source: 'ota';
  data: OTAWebhookData;
  metadata?: Record<string, unknown>;
}

export type OTAWebhookData =
  | BookingCreatedData
  | BookingCancelledData
  | InventorySyncRequestData
  | PricingSyncRequestData
  | GuestLoyaltyQueryData;

export interface BookingCreatedData {
  eventType: OTAWebhookEventType.BOOKING_CREATED;
  bookingId: string;
  bookingRef: string;
  userId: string;
  checkInDate: string;
  checkOutDate: string;
  numRooms: number;
  numGuests: number;
  guestName: string;
  guestPhone: string;
  guestEmail?: string;
  totalValuePaise: number;
  pgAmountPaise: number;
  otaCoinBurnedPaise?: number;
  rezCoinBurnedPaise?: number;
  hotelBrandCoinBurnedPaise?: number;
  specialRequests?: string;
}

export interface BookingCancelledData {
  eventType: OTAWebhookEventType.BOOKING_CANCELLED;
  bookingId: string;
  bookingRef: string;
  reason?: string;
  cancelledAt: string;
  refundAmount?: number;
}

export interface InventorySyncRequestData {
  eventType: OTAWebhookEventType.INVENTORY_SYNC_REQUEST;
  roomTypeId: string;
  roomTypeName?: string;
  date: string;
  availableRooms: number;
  isBlocked?: boolean;
}

export interface PricingSyncRequestData {
  eventType: OTAWebhookEventType.PRICING_SYNC_REQUEST;
  roomTypeId: string;
  roomTypeName?: string;
  date: string;
  ratePaise: number;
  currency?: string;
}

export interface GuestLoyaltyQueryData {
  eventType: OTAWebhookEventType.GUEST_LOYALTY_QUERY;
  guestEmail?: string;
  guestPhone?: string;
  otaUserId?: string;
}

// ============================================================================
// Response Types
// ============================================================================

export interface WebhookResponse {
  success: boolean;
  message?: string;
  data?: Record<string, unknown>;
  error?: string;
  timestamp: string;
}

export interface WebhookDeliveryResult {
  eventId: string;
  deliveredAt: string;
  success: boolean;
  attempts: number;
  error?: string;
  responseCode?: number;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface WebhookEndpointConfig {
  url: string;
  secret: string;
  enabled: boolean;
  retryPolicy?: RetryPolicy;
  events?: PMSWebhookEventType[];
}

export interface RetryPolicy {
  enabled: boolean;
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryOn: string[];
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  enabled: true,
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 60000,
  backoffMultiplier: 2,
  retryOn: ['timeout', 'connection_error', '5xx'],
};

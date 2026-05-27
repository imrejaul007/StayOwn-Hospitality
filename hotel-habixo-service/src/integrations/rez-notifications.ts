/**
 * ReZ Notifications Hub Integration
 *
 * Sends notifications via the unified ReZ Notifications Hub service.
 * Supports multi-channel delivery: push, email, sms, whatsapp
 */

import { httpRequest, getServiceUrl } from './external-services';
import { logger } from '../utils/logger';

const notificationLogger = logger.child({ service: 'ReZ-Notifications' });

// ─── Types ─────────────────────────────────────────────────────────────────────

export type NotificationChannel = 'push' | 'email' | 'sms' | 'whatsapp';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface NotificationRecipient {
  userId?: string;
  email?: string;
  phone?: string;
  deviceToken?: string;
  channels: NotificationChannel[];
}

export interface NotificationPayload {
  templateId: string;
  recipient: NotificationRecipient;
  variables: Record<string, string>;
  priority?: NotificationPriority;
  scheduledAt?: string;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
}

export interface NotificationResult {
  success: boolean;
  notificationId?: string;
  error?: string;
  statusCode?: number;
}

// ─── Notification Templates ─────────────────────────────────────────────────────

export const NotificationTemplates = {
  // Booking templates
  BOOKING_CONFIRMED: 'habixo-booking-confirmed',
  BOOKING_CANCELLED: 'habixo-booking-cancelled',
  BOOKING_REMINDER: 'habixo-booking-reminder',
  BOOKING_COMPLETED: 'habixo-booking-completed',

  // Match templates
  MATCH_FOUND: 'habixo-match-found',
  MATCH_REQUEST: 'habixo-match-request',
  MATCH_ACCEPTED: 'habixo-match-accepted',

  // Price alert templates
  PRICE_DROP: 'habixo-price-drop',
  PRICE_INCREASE: 'habixo-price-increase',

  // Message templates
  NEW_MESSAGE: 'habixo-new-message',

  // Review templates
  REVIEW_REQUEST: 'habixo-review-request',
  REVIEW_RECEIVED: 'habixo-review-received',

  // General templates
  WISHLIST_AVAILABLE: 'habixo-wishlist-available',
  PROMOTIONAL: 'habixo-promotional',
} as const;

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * Send notification via ReZ Notifications Hub
 * Uses template-based rendering with Handlebars
 *
 * @param payload - Notification payload with template ID and variables
 * @returns Notification result with success status and notification ID
 */
export async function sendNotification(
  payload: NotificationPayload
): Promise<NotificationResult> {
  const url = `${getServiceUrl('notifications')}/v1/notifications/send`;

  const result = await httpRequest<{
    success: boolean;
    data?: { notificationId: string };
    error?: { code: string; message: string };
  }>(url, {
    method: 'POST',
    body: payload,
    timeout: 15000,
    serviceName: 'notifications',
  });

  if (result.success && result.data) {
    notificationLogger.info(
      {
        templateId: payload.templateId,
        userId: payload.recipient.userId,
        channels: payload.recipient.channels,
        notificationId: result.data.notificationId,
      },
      'Notification sent successfully'
    );
    return {
      success: true,
      notificationId: result.data.notificationId,
      statusCode: result.statusCode,
    };
  }

  notificationLogger.warn(
    {
      templateId: payload.templateId,
      userId: payload.recipient.userId,
      error: result.error || result.data?.error?.message,
    },
    'Failed to send notification'
  );

  return {
    success: false,
    error: result.error || result.data?.error?.message,
    statusCode: result.statusCode,
  };
}

/**
 * Send notification to all specified channels
 *
 * @param payload - Base notification payload
 * @returns Array of notification results per channel
 */
export async function sendNotificationToAllChannels(
  payload: NotificationPayload
): Promise<NotificationResult[]> {
  const results: NotificationResult[] = [];

  for (const channel of payload.recipient.channels) {
    const channelPayload: NotificationPayload = {
      ...payload,
      recipient: {
        ...payload.recipient,
        channels: [channel],
      },
    };

    const result = await sendNotification(channelPayload);
    results.push(result);
  }

  return results;
}

/**
 * Send batch notifications
 *
 * @param notifications - Array of notification payloads
 * @param options - Batch options (parallel, stopOnError)
 * @returns Batch result summary
 */
export async function sendBatchNotifications(
  notifications: NotificationPayload[],
  options: { parallel?: boolean; stopOnError?: boolean } = {}
): Promise<{
  total: number;
  successful: number;
  failed: number;
  results: NotificationResult[];
}> {
  const results: NotificationResult[] = [];
  let successful = 0;
  let failed = 0;

  if (options.parallel !== false) {
    // Process in parallel
    const promises = notifications.map(async (payload) => {
      const result = await sendNotification(payload);
      results.push(result);
      if (result.success) successful++;
      else failed++;
      return result;
    });

    await Promise.all(promises);
  } else {
    // Process sequentially
    for (const payload of notifications) {
      const result = await sendNotification(payload);
      results.push(result);
      if (result.success) successful++;
      else failed++;

      if (options.stopOnError && !result.success) {
        break;
      }
    }
  }

  return { total: notifications.length, successful, failed, results };
}

// ─── Convenience Functions ────────────────────────────────────────────────────

/**
 * Send booking confirmation notification
 */
export async function notifyBookingConfirmed(
  userId: string,
  bookingDetails: {
    bookingId: string;
    propertyTitle: string;
    propertyImage?: string;
    checkIn: string;
    checkOut: string;
    totalNights: number;
    totalAmount: number;
    currency?: string;
  }
): Promise<NotificationResult> {
  const checkInDate = new Date(bookingDetails.checkIn).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const checkOutDate = new Date(bookingDetails.checkOut).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return sendNotification({
    templateId: NotificationTemplates.BOOKING_CONFIRMED,
    recipient: {
      userId,
      channels: ['push'],
    },
    variables: {
      bookingId: bookingDetails.bookingId,
      propertyTitle: bookingDetails.propertyTitle,
      checkInDate,
      checkOutDate,
      totalNights: String(bookingDetails.totalNights),
      totalAmount: `${bookingDetails.currency || 'INR'} ${bookingDetails.totalAmount.toLocaleString('en-IN')}`,
      propertyImage: bookingDetails.propertyImage || '',
    },
    priority: 'high',
    metadata: {
      bookingId: bookingDetails.bookingId,
      category: 'booking',
    },
    idempotencyKey: `booking-confirmed-${bookingDetails.bookingId}`,
  });
}

/**
 * Send booking reminder notification
 */
export async function notifyBookingReminder(
  userId: string,
  bookingDetails: {
    bookingId: string;
    propertyTitle: string;
    checkIn: string;
    checkOut: string;
  },
  daysBefore: number
): Promise<NotificationResult> {
  const checkInDate = new Date(bookingDetails.checkIn).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  let reminderText: string;
  if (daysBefore === 1) {
    reminderText = 'tomorrow';
  } else if (daysBefore === 0) {
    reminderText = 'today';
  } else {
    reminderText = `in ${daysBefore} days`;
  }

  return sendNotification({
    templateId: NotificationTemplates.BOOKING_REMINDER,
    recipient: {
      userId,
      channels: ['push'],
    },
    variables: {
      bookingId: bookingDetails.bookingId,
      propertyTitle: bookingDetails.propertyTitle,
      checkInDate,
      reminderText,
    },
    priority: daysBefore <= 1 ? 'high' : 'normal',
    metadata: {
      bookingId: bookingDetails.bookingId,
      category: 'booking',
      daysBefore,
    },
    idempotencyKey: `booking-reminder-${bookingDetails.bookingId}-${daysBefore}d`,
  });
}

/**
 * Send price drop notification
 */
export async function notifyPriceDrop(
  userId: string,
  propertyDetails: {
    propertyId: string;
    propertyTitle: string;
    propertyImage?: string;
    city?: string;
    oldPrice: number;
    newPrice: number;
    currency?: string;
    discount?: number;
  }
): Promise<NotificationResult> {
  const currency = propertyDetails.currency || 'INR';
  const savings = propertyDetails.oldPrice - propertyDetails.newPrice;
  const discountPercent = Math.round((savings / propertyDetails.oldPrice) * 100);

  return sendNotification({
    templateId: NotificationTemplates.PRICE_DROP,
    recipient: {
      userId,
      channels: ['push'],
    },
    variables: {
      propertyId: propertyDetails.propertyId,
      propertyTitle: propertyDetails.propertyTitle,
      oldPrice: `${currency} ${propertyDetails.oldPrice.toLocaleString('en-IN')}`,
      newPrice: `${currency} ${propertyDetails.newPrice.toLocaleString('en-IN')}`,
      savings: `${currency} ${savings.toLocaleString('en-IN')}`,
      discountPercent: String(discountPercent),
      propertyImage: propertyDetails.propertyImage || '',
      city: propertyDetails.city || '',
    },
    priority: 'normal',
    metadata: {
      propertyId: propertyDetails.propertyId,
      category: 'price_alert',
    },
    idempotencyKey: `price-drop-${propertyDetails.propertyId}-${propertyDetails.newPrice}`,
  });
}

/**
 * Send match found notification
 */
export async function notifyMatchFound(
  userId: string,
  matchDetails: {
    matchProfileId: string;
    matchName: string;
    matchAvatar?: string;
    compatibilityScore: number;
    sharedInterests: string[];
    city?: string;
  }
): Promise<NotificationResult> {
  return sendNotification({
    templateId: NotificationTemplates.MATCH_FOUND,
    recipient: {
      userId,
      channels: ['push'],
    },
    variables: {
      matchProfileId: matchDetails.matchProfileId,
      matchName: matchDetails.matchName,
      matchAvatar: matchDetails.matchAvatar || '',
      compatibilityScore: String(matchDetails.compatibilityScore),
      sharedInterests: matchDetails.sharedInterests.join(', '),
      city: matchDetails.city || '',
    },
    priority: 'normal',
    metadata: {
      matchProfileId: matchDetails.matchProfileId,
      category: 'matching',
    },
    idempotencyKey: `match-found-${matchDetails.matchProfileId}`,
  });
}

/**
 * Send new message notification
 */
export async function notifyNewMessage(
  userId: string,
  messageDetails: {
    bookingId: string;
    conversationId: string;
    senderName: string;
    senderAvatar?: string;
    messagePreview: string;
    messageType?: 'text' | 'image' | 'offer';
  }
): Promise<NotificationResult> {
  return sendNotification({
    templateId: NotificationTemplates.NEW_MESSAGE,
    recipient: {
      userId,
      channels: ['push'],
    },
    variables: {
      bookingId: messageDetails.bookingId,
      conversationId: messageDetails.conversationId,
      senderName: messageDetails.senderName,
      senderAvatar: messageDetails.senderAvatar || '',
      messagePreview:
        messageDetails.messagePreview.length > 100
          ? messageDetails.messagePreview.substring(0, 100) + '...'
          : messageDetails.messagePreview,
      messageType: messageDetails.messageType || 'text',
    },
    priority: 'normal',
    metadata: {
      bookingId: messageDetails.bookingId,
      conversationId: messageDetails.conversationId,
      category: 'messaging',
    },
    idempotencyKey: `new-message-${messageDetails.conversationId}`,
  });
}

/**
 * Send review request notification
 */
export async function notifyReviewRequest(
  userId: string,
  reviewDetails: {
    bookingId: string;
    propertyId: string;
    propertyTitle: string;
    propertyImage?: string;
    hostName?: string;
    checkInDate: string;
    checkOutDate: string;
  }
): Promise<NotificationResult> {
  return sendNotification({
    templateId: NotificationTemplates.REVIEW_REQUEST,
    recipient: {
      userId,
      channels: ['push'],
    },
    variables: {
      bookingId: reviewDetails.bookingId,
      propertyId: reviewDetails.propertyId,
      propertyTitle: reviewDetails.propertyTitle,
      propertyImage: reviewDetails.propertyImage || '',
      hostName: reviewDetails.hostName || 'your host',
      checkInDate: reviewDetails.checkInDate,
      checkOutDate: reviewDetails.checkOutDate,
    },
    priority: 'low',
    metadata: {
      bookingId: reviewDetails.bookingId,
      category: 'review',
    },
    idempotencyKey: `review-request-${reviewDetails.bookingId}`,
  });
}

/**
 * Send booking cancellation notification
 */
export async function notifyBookingCancelled(
  userId: string,
  bookingDetails: {
    bookingId: string;
    propertyTitle: string;
    checkIn: string;
    checkOut: string;
    refundAmount?: number;
    currency?: string;
    cancelledBy: 'guest' | 'host';
    cancellationReason?: string;
  }
): Promise<NotificationResult> {
  return sendNotification({
    templateId: NotificationTemplates.BOOKING_CANCELLED,
    recipient: {
      userId,
      channels: ['push'],
    },
    variables: {
      bookingId: bookingDetails.bookingId,
      propertyTitle: bookingDetails.propertyTitle,
      checkIn: bookingDetails.checkIn,
      checkOut: bookingDetails.checkOut,
      refundAmount: bookingDetails.refundAmount
        ? `${bookingDetails.currency || 'INR'} ${bookingDetails.refundAmount.toLocaleString('en-IN')}`
        : 'N/A',
      cancelledBy: bookingDetails.cancelledBy,
      cancellationReason: bookingDetails.cancellationReason || '',
    },
    priority: 'high',
    metadata: {
      bookingId: bookingDetails.bookingId,
      category: 'booking',
    },
    idempotencyKey: `booking-cancelled-${bookingDetails.bookingId}`,
  });
}

/**
 * Register or update FCM push token for user
 */
export async function registerPushToken(
  userId: string,
  tokenData: {
    fcmToken: string;
    platform: 'ios' | 'android' | 'web';
    deviceId?: string;
    appVersion?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const result = await httpRequest<{ success: boolean }>(
    `${getServiceUrl('notifications')}/v1/push-tokens/register`,
    {
      method: 'POST',
      body: {
        userId,
        fcmToken: tokenData.fcmToken,
        platform: tokenData.platform,
        deviceId: tokenData.deviceId,
        appVersion: tokenData.appVersion,
      },
    }
  );

  if (result.success) {
    notificationLogger.info(
      { userId, platform: tokenData.platform },
      'Push token registered'
    );
    return { success: true };
  }

  notificationLogger.warn(
    { userId, error: result.error },
    'Failed to register push token'
  );
  return { success: false, error: result.error };
}

/**
 * Remove FCM push token for user
 */
export async function removePushToken(
  userId: string,
  fcmToken: string
): Promise<{ success: boolean; error?: string }> {
  const result = await httpRequest<{ success: boolean }>(
    `${getServiceUrl('notifications')}/v1/push-tokens/remove`,
    {
      method: 'POST',
      body: { userId, fcmToken },
    }
  );

  if (result.success) {
    notificationLogger.info({ userId }, 'Push token removed');
    return { success: true };
  }

  return { success: false, error: result.error };
}

/**
 * Get user's notification preferences
 */
export async function getNotificationPreferences(
  userId: string
): Promise<{
  success: boolean;
  preferences?: {
    push: { enabled: boolean };
    email: { enabled: boolean };
    sms: { enabled: boolean };
    marketingEnabled: boolean;
  };
  error?: string;
}> {
  const result = await httpRequest<{
    success: boolean;
    data?: {
      push: { enabled: boolean };
      email: { enabled: boolean };
      sms: { enabled: boolean };
      marketingEnabled: boolean;
    };
  }>(`${getServiceUrl('notifications')}/v1/preferences/${userId}`);

  if (result.success && result.data) {
    return { success: true, preferences: result.data.data };
  }

  return { success: false, error: result.error };
}

/**
 * Update user's notification preferences
 */
export async function updateNotificationPreferences(
  userId: string,
  preferences: {
    push?: { enabled?: boolean; quietHoursStart?: string; quietHoursEnd?: string };
    email?: { enabled?: boolean; quietHoursStart?: string; quietHoursEnd?: string };
    sms?: { enabled?: boolean };
    marketingEnabled?: boolean;
  }
): Promise<{ success: boolean; error?: string }> {
  const result = await httpRequest<{ success: boolean }>(
    `${getServiceUrl('notifications')}/v1/preferences/${userId}`,
    {
      method: 'PATCH',
      body: preferences,
    }
  );

  if (result.success) {
    notificationLogger.info({ userId }, 'Notification preferences updated');
    return { success: true };
  }

  return { success: false, error: result.error };
}

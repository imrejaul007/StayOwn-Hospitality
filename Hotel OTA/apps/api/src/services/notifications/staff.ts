/**
 * Staff Notifications Service
 * Handles push notifications, SMS, and WhatsApp notifications for staff
 */

import { logger } from '../../config/logger';

// Types
export type NotificationChannel = 'push' | 'sms' | 'whatsapp' | 'email';

export interface StaffNotification {
  id: string;
  staffId: string;
  title: string;
  message: string;
  type: 'request' | 'message' | 'checkout' | 'alert' | 'sla';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  channels: NotificationChannel[];
  metadata?: Record<string, any>;
  createdAt: Date;
  readAt?: Date;
}

export interface NotificationPreferences {
  staffId: string;
  pushEnabled: boolean;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  emailEnabled: boolean;
  quietHoursStart?: string; // HH:mm format
  quietHoursEnd?: string;
  typesEnabled: {
    request: boolean;
    message: boolean;
    checkout: boolean;
    alert: boolean;
    sla: boolean;
  };
}

// Notification templates
const NOTIFICATION_TEMPLATES = {
  request_assigned: {
    title: 'New Request Assigned',
    message: 'You have been assigned a new {serviceType} request for Room {roomNumber}',
  },
  request_urgent: {
    title: 'Urgent Request',
    message: 'URGENT: {serviceType} request for Room {roomNumber} - {description}',
  },
  sla_warning: {
    title: 'SLA Warning',
    message: 'Request for Room {roomNumber} is approaching SLA limit ({remainingMinutes}m remaining)',
  },
  sla_breach: {
    title: 'SLA Breach Alert',
    message: 'ALERT: Request for Room {roomNumber} has breached SLA by {overMinutes} minutes',
  },
  new_message: {
    title: 'New Guest Message',
    message: 'Guest in Room {roomNumber} sent a message: {preview}',
  },
  checkout_reminder: {
    title: 'Checkout Reminder',
    message: 'Guest in Room {roomNumber} has checkout scheduled at {checkoutTime}',
  },
  checkout_requested: {
    title: 'Checkout Requested',
    message: 'Guest in Room {roomNumber} has requested checkout',
  },
  room_alert: {
    title: 'Room Alert',
    message: '{alertType} in Room {roomNumber}: {details}',
  },
};

// Push notification configuration
const PUSH_CONFIG = {
  // Firebase Cloud Messaging (FCM) settings would go here
  // For now, this is a placeholder
  enabled: process.env.FCM_ENABLED === 'true',
  serverKey: process.env.FCM_SERVER_KEY,
};

// SMS configuration (Twilio)
const SMS_CONFIG = {
  enabled: process.env.SMS_ENABLED === 'true',
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  fromNumber: process.env.TWILIO_FROM_NUMBER,
};

// WhatsApp configuration (Twilio WhatsApp)
const WHATSAPP_CONFIG = {
  enabled: process.env.WHATSAPP_ENABLED === 'true',
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  fromNumber: process.env.TWILIO_WHATSAPP_FROM,
};

/**
 * Send notification to staff through specified channels
 */
export async function sendNotification(
  staffId: string,
  notification: Omit<StaffNotification, 'id' | 'createdAt'>,
  notificationId?: string
): Promise<{ success: boolean; channels: Record<NotificationChannel, boolean> }> {
  const results: Record<NotificationChannel, boolean> = {
    push: false,
    sms: false,
    whatsapp: false,
    email: false,
  };

  try {
    // Check preferences before sending
    const preferences = await getStaffPreferences(staffId);
    if (!preferences) {
      logger.warn('Staff preferences not found, using defaults', { staffId });
    }

    const shouldSend = (channel: NotificationChannel) => {
      if (!notification.channels.includes(channel)) return false;
      if (!preferences) return true;

      switch (channel) {
        case 'push': return preferences.pushEnabled;
        case 'sms': return preferences.smsEnabled;
        case 'whatsapp': return preferences.whatsappEnabled;
        case 'email': return preferences.emailEnabled;
        default: return false;
      }
    };

    // Check if within quiet hours
    if (preferences?.quietHoursStart && preferences?.quietHoursEnd) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      if (isWithinQuietHours(currentTime, preferences.quietHoursStart, preferences.quietHoursEnd)) {
        // Only send urgent notifications during quiet hours
        if (notification.priority !== 'urgent') {
          logger.info('Notification skipped due to quiet hours', { staffId, notificationId });
          return { success: false, channels: results };
        }
      }
    }

    // Send through each channel in parallel
    const promises: Promise<void>[] = [];

    if (shouldSend('push') && PUSH_CONFIG.enabled) {
      promises.push(sendPushNotification(staffId, notification).then(() => { results.push = true; }));
    }

    if (shouldSend('sms') && SMS_CONFIG.enabled) {
      promises.push(sendSMS(staffId, notification).then(() => { results.sms = true; }));
    }

    if (shouldSend('whatsapp') && WHATSAPP_CONFIG.enabled) {
      promises.push(sendWhatsApp(staffId, notification).then(() => { results.whatsapp = true; }));
    }

    if (shouldSend('email')) {
      // Email sending would be implemented here
      results.email = false; // Placeholder
    }

    await Promise.allSettled(promises);

    const success = Object.values(results).some((r) => r);
    logger.info('Notification sent', { staffId, notificationId, results });

    return { success, channels: results };
  } catch (error) {
    logger.error('Failed to send notification', { staffId, error });
    return { success: false, channels: results };
  }
}

/**
 * Send push notification via FCM
 */
async function sendPushNotification(staffId: string, notification: Omit<StaffNotification, 'id' | 'createdAt'>): Promise<void> {
  // Get staff device tokens
  const deviceTokens = await getDeviceTokens(staffId);

  if (deviceTokens.length === 0) {
    logger.warn('No device tokens found for staff', { staffId });
    return;
  }

  const payload = {
    notification: {
      title: notification.title,
      body: notification.message,
    },
    data: {
      type: notification.type,
      priority: notification.priority,
      ...notification.metadata,
    },
    tokens: deviceTokens,
  };

  // In production, this would use Firebase Admin SDK
  // const messaging = admin.messaging();
  // await messaging.sendEachForMulticast(payload);

  logger.info('Push notification prepared', { staffId, title: notification.title });
}

/**
 * Send SMS via Twilio
 */
async function sendSMS(staffId: string, notification: Omit<StaffNotification, 'id' | 'createdAt'>): Promise<void> {
  // Get staff phone number
  const phoneNumber = await getStaffPhoneNumber(staffId);

  if (!phoneNumber) {
    logger.warn('No phone number found for staff', { staffId });
    return;
  }

  const message = `${notification.title}: ${notification.message}`;

  // In production, this would use Twilio client
  // const client = twilio(SMS_CONFIG.accountSid, SMS_CONFIG.authToken);
  // await client.messages.create({
  //   body: message,
  //   from: SMS_CONFIG.fromNumber,
  //   to: phoneNumber,
  // });

  logger.info('SMS prepared', { staffId, phoneNumber: phoneNumber.replace(/\d(?=\d{4})/g, '*') });
}

/**
 * Send WhatsApp message via Twilio
 */
async function sendWhatsApp(staffId: string, notification: Omit<StaffNotification, 'id' | 'createdAt'>): Promise<void> {
  const phoneNumber = await getStaffPhoneNumber(staffId);

  if (!phoneNumber) {
    logger.warn('No phone number found for staff', { staffId });
    return;
  }

  const message = `*${notification.title}*\n\n${notification.message}`;

  // In production, this would use Twilio WhatsApp
  // const client = twilio(WHATSAPP_CONFIG.accountSid, WHATSAPP_CONFIG.authToken);
  // await client.messages.create({
  //   body: message,
  //   from: `whatsapp:${WHATSAPP_CONFIG.fromNumber}`,
  //   to: `whatsapp:${phoneNumber}`,
  // });

  logger.info('WhatsApp message prepared', { staffId, phoneNumber: phoneNumber.replace(/\d(?=\d{4})/g, '*') });
}

/**
 * Notify staff of new request assignment
 */
export async function notifyRequestAssigned(
  staffId: string,
  request: {
    requestId: string;
    roomNumber: string;
    serviceType: string;
    description?: string;
    priority: string;
  }
): Promise<void> {
  const template = NOTIFICATION_TEMPLATES[request.priority === 'urgent' ? 'request_urgent' : 'request_assigned'];
  const message = interpolateTemplate(template.message, {
    roomNumber: request.roomNumber,
    serviceType: request.serviceType,
    description: request.description,
  });

  await sendNotification(staffId, {
    staffId,
    title: template.title,
    message,
    type: 'request',
    priority: request.priority === 'urgent' ? 'urgent' : 'normal',
    channels: ['push'],
    metadata: { requestId: request.requestId, roomNumber: request.roomNumber },
  });
}

/**
 * Notify staff of SLA warning
 */
export async function notifySLAWarning(
  staffId: string,
  request: {
    requestId: string;
    roomNumber: string;
    serviceType: string;
    remainingMinutes: number;
  }
): Promise<void> {
  const message = interpolateTemplate(NOTIFICATION_TEMPLATES.sla_warning.message, {
    roomNumber: request.roomNumber,
    serviceType: request.serviceType,
    remainingMinutes: request.remainingMinutes,
  });

  await sendNotification(staffId, {
    staffId,
    title: NOTIFICATION_TEMPLATES.sla_warning.title,
    message,
    type: 'sla',
    priority: 'high',
    channels: ['push'],
    metadata: request,
  });
}

/**
 * Notify staff of SLA breach
 */
export async function notifySLABreach(
  staffId: string,
  request: {
    requestId: string;
    roomNumber: string;
    serviceType: string;
    overMinutes: number;
  }
): Promise<void> {
  const message = interpolateTemplate(NOTIFICATION_TEMPLATES.sla_breach.message, {
    roomNumber: request.roomNumber,
    serviceType: request.serviceType,
    overMinutes: request.overMinutes,
  });

  await sendNotification(staffId, {
    staffId,
    title: NOTIFICATION_TEMPLATES.sla_breach.title,
    message,
    type: 'sla',
    priority: 'urgent',
    channels: ['push', 'sms'],
    metadata: request,
  });
}

/**
 * Notify staff of new guest message
 */
export async function notifyNewMessage(
  staffId: string,
  conversation: {
    conversationId: string;
    roomNumber: string;
    preview: string;
  }
): Promise<void> {
  const message = interpolateTemplate(NOTIFICATION_TEMPLATES.new_message.message, {
    roomNumber: conversation.roomNumber,
    preview: conversation.preview.length > 50
      ? conversation.preview.substring(0, 50) + '...'
      : conversation.preview,
  });

  await sendNotification(staffId, {
    staffId,
    title: NOTIFICATION_TEMPLATES.new_message.title,
    message,
    type: 'message',
    priority: 'normal',
    channels: ['push'],
    metadata: conversation,
  });
}

/**
 * Notify staff of checkout reminder
 */
export async function notifyCheckoutReminder(
  staffId: string,
  checkout: {
    bookingId: string;
    roomNumber: string;
    checkoutTime: string;
  }
): Promise<void> {
  const message = interpolateTemplate(NOTIFICATION_TEMPLATES.checkout_reminder.message, {
    roomNumber: checkout.roomNumber,
    checkoutTime: checkout.checkoutTime,
  });

  await sendNotification(staffId, {
    staffId,
    title: NOTIFICATION_TEMPLATES.checkout_reminder.title,
    message,
    type: 'checkout',
    priority: 'normal',
    channels: ['push'],
    metadata: checkout,
  });
}

/**
 * Get staff notification preferences
 */
async function getStaffPreferences(staffId: string): Promise<NotificationPreferences | null> {
  // Mock implementation - would query database
  return {
    staffId,
    pushEnabled: true,
    smsEnabled: false,
    whatsappEnabled: false,
    emailEnabled: true,
    typesEnabled: {
      request: true,
      message: true,
      checkout: true,
      alert: true,
      sla: true,
    },
  };
}

/**
 * Get staff device tokens for push notifications
 */
async function getDeviceTokens(staffId: string): Promise<string[]> {
  // Mock implementation - would query database
  return [`token-${staffId}-device-1`];
}

/**
 * Get staff phone number
 */
async function getStaffPhoneNumber(staffId: string): Promise<string | null> {
  // Mock implementation - would query database
  return '+919876543210';
}

/**
 * Check if current time is within quiet hours
 */
function isWithinQuietHours(current: string, start: string, end: string): boolean {
  return current >= start && current <= end;
}

/**
 * Interpolate template with variables
 */
function interpolateTemplate(template: string, variables: Record<string, string | number>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }
  return result;
}

/**
 * Broadcast notification to all staff in a hotel
 */
export async function broadcastToHotel(
  hotelId: string,
  notification: Omit<StaffNotification, 'staffId' | 'id' | 'createdAt'>
): Promise<void> {
  // Get all active staff for the hotel
  const activeStaff = await getActiveStaffForHotel(hotelId);

  const promises = activeStaff.map((staffId) =>
    sendNotification(staffId, { ...notification, staffId })
  );

  await Promise.allSettled(promises);
}

/**
 * Get active staff IDs for a hotel
 */
async function getActiveStaffForHotel(hotelId: string): Promise<string[]> {
  // Mock implementation - would query database
  return ['staff-1', 'staff-2', 'staff-3'];
}

export default {
  sendNotification,
  notifyRequestAssigned,
  notifySLAWarning,
  notifySLABreach,
  notifyNewMessage,
  notifyCheckoutReminder,
  broadcastToHotel,
};

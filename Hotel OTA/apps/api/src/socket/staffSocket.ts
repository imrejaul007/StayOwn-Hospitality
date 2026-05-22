import { Server, Socket } from 'socket.io';
import { logger } from '../config/logger';

// Staff Dashboard Socket Events
export const STAFF_SOCKET_EVENTS = {
  // Connection events
  STAFF_CONNECT: 'staff:connect',
  STAFF_DISCONNECT: 'staff:disconnect',

  // Request events
  NEW_REQUEST: 'staff:new_request',
  REQUEST_UPDATED: 'staff:request_updated',
  REQUEST_ASSIGNED: 'staff:request_assigned',
  REQUEST_COMPLETED: 'staff:request_completed',

  // Room events
  ROOM_STATUS_CHANGED: 'staff:room_status_changed',

  // Message events
  NEW_GUEST_MESSAGE: 'staff:new_guest_message',
  MESSAGE_READ: 'staff:message_read',

  // Notification events
  NEW_NOTIFICATION: 'staff:new_notification',
  NOTIFICATION_READ: 'staff:notification_read',

  // Checkout events
  CHECKOUT_REMINDER: 'staff:checkout_reminder',
  CHECKOUT_COMPLETED: 'staff:checkout_completed',

  // Room events
  ROOM_REQUEST_ALERT: 'staff:room_request_alert',
  LOW_INVENTORY_ALERT: 'staff:low_inventory_alert',

  // SLA events
  SLA_WARNING: 'staff:sla_warning',
  SLA_BREACH: 'staff:sla_breach',
} as const;

interface StaffSocket extends Socket {
  staffId?: string;
  hotelId?: string;
  department?: string;
  isOnline?: boolean;
}

interface StaffJoinData {
  hotelId: string;
  staffId: string;
  department?: string;
}

interface RoomServiceAlertData {
  hotelId: string;
  requestId: string;
  roomNumber: string;
  serviceType: string;
  priority: string;
  guestName: string;
  description?: string;
}

interface GuestMessageData {
  hotelId: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string;
  roomNumber: string;
}

interface NotificationData {
  hotelId: string;
  notificationId: string;
  type: 'request' | 'message' | 'checkout' | 'alert' | 'system';
  title: string;
  message: string;
  metadata?: Record<string, any>;
}

interface CheckoutReminderData {
  hotelId: string;
  bookingId: string;
  guestName: string;
  roomNumber: string;
  checkoutTime: string;
  pendingRequests: number;
}

let staffIO: Server | null = null;
let staffNamespace: any = null;

export function initializeStaffSocket(httpServer: any): Server {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || process.env.OTA_WEB_URL || 'https://rez.money').split(',');
  staffIO = new Server(httpServer, {
    path: '/socket.io/staff',
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  staffNamespace = staffIO.of('/staff');

  staffNamespace.on('connection', (socket: StaffSocket) => {
    logger.info('[StaffSocket] Client connected', {
      socketId: socket.id,
    });

    // ── Staff Join ─────────────────────────────────────────────────────────
    socket.on('staff:join', async (data: StaffJoinData) => {
      try {
        const { hotelId, staffId, department } = data;

        socket.staffId = staffId;
        socket.hotelId = hotelId;
        socket.department = department;
        socket.isOnline = true;

        // Join hotel room
        socket.join(`hotel:${hotelId}`);

        // Join department room if specified
        if (department) {
          socket.join(`department:${hotelId}:${department}`);
        }

        logger.info('[StaffSocket] Staff joined', { hotelId, staffId, department });

        // Broadcast staff online status
        staffNamespace.to(`hotel:${hotelId}`).emit(STAFF_SOCKET_EVENTS.STAFF_CONNECT, {
          hotelId,
          staffId,
          department,
        });
      } catch (error: any) {
        logger.error('[StaffSocket] Staff join error', { error: error.message });
        socket.emit('error', { message: 'Failed to join staff dashboard' });
      }
    });

    // ── Staff Leave ─────────────────────────────────────────────────────────
    socket.on('staff:leave', () => {
      if (socket.hotelId && socket.staffId) {
        staffNamespace.to(`hotel:${socket.hotelId}`).emit(STAFF_SOCKET_EVENTS.STAFF_DISCONNECT, {
          hotelId: socket.hotelId,
          staffId: socket.staffId,
        });
      }
    });

    // ── Disconnect ─────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      if (socket.hotelId && socket.staffId) {
        staffNamespace.to(`hotel:${socket.hotelId}`).emit(STAFF_SOCKET_EVENTS.STAFF_DISCONNECT, {
          hotelId: socket.hotelId,
          staffId: socket.staffId,
        });
      }
      logger.info('[StaffSocket] Client disconnected', { socketId: socket.id });
    });
  });

  logger.info('[StaffSocket] Initialized on /staff namespace');
  return staffIO;
}

/**
 * Emit a new service request alert to all staff in a hotel
 */
export function emitNewRequestAlert(data: RoomServiceAlertData) {
  if (!staffIO) return;

  staffNamespace.to(`hotel:${data.hotelId}`).emit(STAFF_SOCKET_EVENTS.NEW_REQUEST, {
    requestId: data.requestId,
    roomNumber: data.roomNumber,
    serviceType: data.serviceType,
    priority: data.priority,
    guestName: data.guestName,
    description: data.description,
    timestamp: new Date().toISOString(),
  });

  // Also emit notification
  emitNotification({
    hotelId: data.hotelId,
    notificationId: `notif-${data.requestId}`,
    type: 'request',
    title: `New ${data.serviceType.replace('_', ' ')} Request`,
    message: `Room ${data.roomNumber}: ${data.guestName}${data.description ? ` - ${data.description}` : ''}`,
    metadata: {
      room_number: data.roomNumber,
      service_type: data.serviceType,
      priority: data.priority,
      action_url: `/staff/requests/${data.requestId}`,
    },
  });

  logger.info('[StaffSocket] New request alert emitted', { hotelId: data.hotelId, requestId: data.requestId });
}

/**
 * Emit request status update to relevant staff
 */
export function emitRequestUpdated(hotelId: string, requestId: string, status: string, updatedBy?: string) {
  if (!staffIO) return;

  staffNamespace.to(`hotel:${hotelId}`).emit(STAFF_SOCKET_EVENTS.REQUEST_UPDATED, {
    requestId,
    status,
    updatedBy,
    timestamp: new Date().toISOString(),
  });

  logger.info('[StaffSocket] Request updated', { hotelId, requestId, status });
}

/**
 * Emit request assignment notification
 */
export function emitRequestAssigned(hotelId: string, requestId: string, assignedTo: string, assignedToName: string) {
  if (!staffIO) return;

  staffNamespace.to(`hotel:${hotelId}`).emit(STAFF_SOCKET_EVENTS.REQUEST_ASSIGNED, {
    requestId,
    assignedTo,
    assignedToName,
    timestamp: new Date().toISOString(),
  });

  logger.info('[StaffSocket] Request assigned', { hotelId, requestId, assignedTo });
}

/**
 * Emit request completion notification
 */
export function emitRequestCompleted(hotelId: string, requestId: string, roomNumber: string) {
  if (!staffIO) return;

  staffNamespace.to(`hotel:${hotelId}`).emit(STAFF_SOCKET_EVENTS.REQUEST_COMPLETED, {
    requestId,
    roomNumber,
    timestamp: new Date().toISOString(),
  });

  logger.info('[StaffSocket] Request completed', { hotelId, requestId });
}

/**
 * Emit new guest message notification
 */
export function emitGuestMessage(data: GuestMessageData) {
  if (!staffIO) return;

  staffNamespace.to(`hotel:${data.hotelId}`).emit(STAFF_SOCKET_EVENTS.NEW_GUEST_MESSAGE, {
    conversationId: data.conversationId,
    senderId: data.senderId,
    senderName: data.senderName,
    content: data.content,
    roomNumber: data.roomNumber,
    timestamp: new Date().toISOString(),
  });

  // Also emit notification
  emitNotification({
    hotelId: data.hotelId,
    notificationId: `notif-msg-${Date.now()}`,
    type: 'message',
    title: 'New Guest Message',
    message: `${data.senderName} in Room ${data.roomNumber}: ${data.content.slice(0, 50)}${data.content.length > 50 ? '...' : ''}`,
    metadata: {
      room_number: data.roomNumber,
      conversation_id: data.conversationId,
      action_url: `/staff/messages/${data.conversationId}`,
    },
  });

  logger.info('[StaffSocket] Guest message emitted', { hotelId: data.hotelId, conversationId: data.conversationId });
}

/**
 * Emit message read notification
 */
export function emitMessageRead(hotelId: string, conversationId: string, messageId: string, readBy: string) {
  if (!staffIO) return;

  staffNamespace.to(`hotel:${hotelId}`).emit(STAFF_SOCKET_EVENTS.MESSAGE_READ, {
    conversationId,
    messageId,
    readBy,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Emit generic notification to staff
 */
export function emitNotification(data: NotificationData) {
  if (!staffIO) return;

  staffNamespace.to(`hotel:${data.hotelId}`).emit(STAFF_SOCKET_EVENTS.NEW_NOTIFICATION, {
    notificationId: data.notificationId,
    type: data.type,
    title: data.title,
    message: data.message,
    metadata: data.metadata,
    timestamp: new Date().toISOString(),
  });

  logger.info('[StaffSocket] Notification emitted', { hotelId: data.hotelId, type: data.type });
}

/**
 * Emit checkout reminder
 */
export function emitCheckoutReminder(data: CheckoutReminderData) {
  if (!staffIO) return;

  staffNamespace.to(`hotel:${data.hotelId}`).emit(STAFF_SOCKET_EVENTS.CHECKOUT_REMINDER, {
    bookingId: data.bookingId,
    guestName: data.guestName,
    roomNumber: data.roomNumber,
    checkoutTime: data.checkoutTime,
    pendingRequests: data.pendingRequests,
    timestamp: new Date().toISOString(),
  });

  // Also emit notification
  emitNotification({
    hotelId: data.hotelId,
    notificationId: `notif-checkout-${data.bookingId}`,
    type: 'checkout',
    title: 'Checkout Reminder',
    message: `${data.guestName} in Room ${data.roomNumber} has checkout at ${new Date(data.checkoutTime).toLocaleTimeString()}`,
    metadata: {
      room_number: data.roomNumber,
      booking_id: data.bookingId,
      action_url: `/staff/checkout/${data.bookingId}`,
    },
  });

  logger.info('[StaffSocket] Checkout reminder emitted', { hotelId: data.hotelId, bookingId: data.bookingId });
}

/**
 * Emit checkout completed notification
 */
export function emitCheckoutCompleted(hotelId: string, bookingId: string, roomNumber: string) {
  if (!staffIO) return;

  staffNamespace.to(`hotel:${hotelId}`).emit(STAFF_SOCKET_EVENTS.CHECKOUT_COMPLETED, {
    bookingId,
    roomNumber,
    timestamp: new Date().toISOString(),
  });

  logger.info('[StaffSocket] Checkout completed', { hotelId, bookingId });
}

/**
 * Emit room request alert (high priority requests)
 */
export function emitRoomRequestAlert(data: RoomServiceAlertData) {
  if (!staffIO) return;

  // Emit to all hotel staff with high priority flag
  staffNamespace.to(`hotel:${data.hotelId}`).emit(STAFF_SOCKET_EVENTS.ROOM_REQUEST_ALERT, {
    requestId: data.requestId,
    roomNumber: data.roomNumber,
    serviceType: data.serviceType,
    priority: data.priority,
    guestName: data.guestName,
    description: data.description,
    urgent: data.priority === 'now' || data.priority === 'high',
    timestamp: new Date().toISOString(),
  });

  // If priority is 'now', also emit as notification
  if (data.priority === 'now') {
    emitNotification({
      hotelId: data.hotelId,
      notificationId: `notif-urgent-${data.requestId}`,
      type: 'alert',
      title: 'URGENT: Service Request',
      message: `Room ${data.roomNumber} needs immediate attention: ${data.serviceType.replace('_', ' ')}`,
      metadata: {
        room_number: data.roomNumber,
        service_type: data.serviceType,
        priority: data.priority,
        action_url: `/staff/requests/${data.requestId}`,
      },
    });
  }

  logger.info('[StaffSocket] Room request alert emitted', { hotelId: data.hotelId, requestId: data.requestId, urgent: data.priority === 'now' });
}

/**
 * Emit low inventory alert
 */
export function emitLowInventoryAlert(hotelId: string, item: string, currentStock: number, threshold: number) {
  if (!staffIO) return;

  staffNamespace.to(`hotel:${hotelId}`).emit(STAFF_SOCKET_EVENTS.LOW_INVENTORY_ALERT, {
    item,
    currentStock,
    threshold,
    timestamp: new Date().toISOString(),
  });

  emitNotification({
    hotelId,
    notificationId: `notif-inventory-${Date.now()}`,
    type: 'alert',
    title: 'Low Inventory Alert',
    message: `${item} stock is running low (${currentStock} remaining, threshold: ${threshold})`,
  });

  logger.info('[StaffSocket] Low inventory alert emitted', { hotelId, item, currentStock });
}

/**
 * Emit room status change notification
 */
export function emitRoomStatusChanged(hotelId: string, roomNumber: string, oldStatus: string, newStatus: string, changedBy?: string) {
  if (!staffIO) return;

  staffNamespace.to(`hotel:${hotelId}`).emit(STAFF_SOCKET_EVENTS.ROOM_STATUS_CHANGED, {
    roomNumber,
    oldStatus,
    newStatus,
    changedBy,
    timestamp: new Date().toISOString(),
  });

  logger.info('[StaffSocket] Room status changed', { hotelId, roomNumber, oldStatus, newStatus });
}

/**
 * SLA tracking interfaces
 */
interface SLAWarningData {
  hotelId: string;
  requestId: string;
  roomNumber: string;
  serviceType: string;
  priority: string;
  elapsedMinutes: number;
  targetMinutes: number;
  remainingMinutes: number;
  percentUsed: number;
}

interface SLABreachData {
  hotelId: string;
  requestId: string;
  roomNumber: string;
  serviceType: string;
  priority: string;
  elapsedMinutes: number;
  targetMinutes: number;
  overMinutes: number;
}

/**
 * Emit SLA warning notification
 */
export function emitSLAWarning(data: SLAWarningData) {
  if (!staffIO) return;

  staffNamespace.to(`hotel:${data.hotelId}`).emit(STAFF_SOCKET_EVENTS.SLA_WARNING, {
    requestId: data.requestId,
    roomNumber: data.roomNumber,
    serviceType: data.serviceType,
    priority: data.priority,
    elapsedMinutes: data.elapsedMinutes,
    targetMinutes: data.targetMinutes,
    remainingMinutes: data.remainingMinutes,
    percentUsed: data.percentUsed,
    timestamp: new Date().toISOString(),
  });

  // Also emit as notification
  emitNotification({
    hotelId: data.hotelId,
    notificationId: `sla-warning-${data.requestId}`,
    type: 'alert',
    title: 'SLA Warning',
    message: `Room ${data.roomNumber} (${data.serviceType.replace('_', ' ')}) has ${data.remainingMinutes} minutes remaining`,
    metadata: {
      request_id: data.requestId,
      room_number: data.roomNumber,
      service_type: data.serviceType,
      priority: data.priority,
      percent_used: data.percentUsed,
      action_url: `/staff/requests/${data.requestId}`,
    },
  });

  logger.info('[StaffSocket] SLA warning emitted', { hotelId: data.hotelId, requestId: data.requestId });
}

/**
 * Emit SLA breach notification
 */
export function emitSLABreach(data: SLABreachData) {
  if (!staffIO) return;

  staffNamespace.to(`hotel:${data.hotelId}`).emit(STAFF_SOCKET_EVENTS.SLA_BREACH, {
    requestId: data.requestId,
    roomNumber: data.roomNumber,
    serviceType: data.serviceType,
    priority: data.priority,
    elapsedMinutes: data.elapsedMinutes,
    targetMinutes: data.targetMinutes,
    overMinutes: data.overMinutes,
    timestamp: new Date().toISOString(),
  });

  // Emit urgent notification
  emitNotification({
    hotelId: data.hotelId,
    notificationId: `sla-breach-${data.requestId}`,
    type: 'alert',
    title: 'SLA Breach Alert',
    message: `Room ${data.roomNumber} (${data.serviceType.replace('_', ' ')}) has breached SLA by ${data.overMinutes} minutes`,
    metadata: {
      request_id: data.requestId,
      room_number: data.roomNumber,
      service_type: data.serviceType,
      priority: data.priority,
      over_minutes: data.overMinutes,
      action_url: `/staff/requests/${data.requestId}`,
    },
  });

  logger.info('[StaffSocket] SLA breach emitted', { hotelId: data.hotelId, requestId: data.requestId });
}

export { staffIO };

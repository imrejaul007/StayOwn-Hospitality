import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { redis } from '../config/redis';
import { logger } from '../config/logger';
import { prisma } from '../config/database';

// Hotel Chat Socket Events
const HOTEL_CHAT_EVENTS = {
  // Guest events
  GUEST_JOIN: 'hotel:guest_join',
  GUEST_MESSAGE: 'hotel:guest_message',
  GUEST_TYPING: 'hotel:guest_typing',
  GUEST_READ: 'hotel:guest_read',
  GUEST_OFFLINE: 'hotel:guest_offline',
  GUEST_ONLINE: 'hotel:guest_online',
  // Staff events
  STAFF_JOIN: 'hotel:staff_join',
  STAFF_MESSAGE: 'hotel:staff_message',
  STAFF_TYPING: 'hotel:staff_typing',
  STAFF_READ: 'hotel:staff_read',
  STAFF_OFFLINE: 'hotel:staff_offline',
  STAFF_ONLINE: 'hotel:staff_online',
  // Queue and status
  QUEUE_POSITION: 'hotel:queue_position',
  STAFF_ASSIGNED: 'hotel:staff_assigned',
  STAFF_AVAILABLE: 'hotel:staff_available',
  // Conversation events
  NEW_MESSAGE: 'conversation:new_message',
  MESSAGE_ACK: 'conversation:message_ack',
  MESSAGES_READ: 'conversation:messages_read',
  CONVERSATION_ASSIGNED: 'conversation:assigned',
  CONVERSATION_RESOLVED: 'conversation:resolved',
  CONVERSATION_TRANSFERRED: 'conversation:transferred',
  CONVERSATION_CREATED: 'conversation:created',
} as const;

// ── Types ──────────────────────────────────────────────────────────────────────

interface HotelGuestSocket extends Socket {
  userId?: string;
  hotelId?: string;
  bookingId?: string;
  isGuest?: boolean;
  staffId?: string;
  department?: string;
  isStaff?: boolean;
}

interface HotelStaffSocket extends Socket {
  userId?: string;
  hotelId?: string;
  staffId?: string;
  department?: string;
  isStaff?: boolean;
  bookingId?: string;
  isGuest?: boolean;
}

interface GuestJoinData {
  hotelId: string;
  bookingId?: string;
  userId: string;
  guestName?: string;
}

interface StaffJoinData {
  hotelId: string;
  userId: string;
  staffId: string;
  department?: string;
}

interface GuestMessageData {
  hotelId: string;
  bookingId?: string;
  userId: string;
  guestName?: string;
  content: string;
  messageType?: 'text' | 'image' | 'file';
  tempId?: string;
}

interface StaffMessageData {
  hotelId: string;
  conversationId: string;
  staffId: string;
  staffName: string;
  content: string;
  messageType?: 'text' | 'image' | 'file';
}

// ── Hotel Namespace ────────────────────────────────────────────────────────────

let hotelIO: Server | null = null;

export function initializeHotelSocket(httpServer: HttpServer): Server {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || process.env.HOTEL_PANEL_URL || 'https://rez.money').split(',');
  hotelIO = new Server(httpServer, {
    path: '/socket.io',
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // HOTEL-OTA-ARCH-001: Enable horizontal scaling via Redis adapter
  // Each Socket.IO instance needs its own pub/sub clients
  const pubClient = redis.duplicate();
  const subClient = redis.duplicate();

  hotelIO.adapter(createAdapter(pubClient, subClient));

  logger.info('[HotelSocket] Redis adapter configured for Socket.IO', {
    hasPubClient: !!pubClient,
    hasSubClient: !!subClient,
  });

  const hotelNamespace = hotelIO.of('/hotel');

  hotelNamespace.on('connection', (socket: HotelGuestSocket | HotelStaffSocket) => {
    logger.info('[HotelSocket] Client connected', {
      socketId: socket.id,
    });

    // ── Guest Join ──────────────────────────────────────────────────────────
    socket.on('guest:join', async (data: GuestJoinData) => {
      try {
        const { hotelId, bookingId, userId, guestName } = data;

        // Store metadata on socket
        socket.userId = userId;
        socket.hotelId = hotelId;
        socket.bookingId = bookingId;
        socket.isGuest = true;

        // Join hotel room
        socket.join(`hotel:${hotelId}`);

        // Join booking/conversation room
        if (bookingId) {
          socket.join(`booking:${bookingId}`);
        }

        logger.info('[HotelSocket] Guest joined', { hotelId, bookingId, userId });

        // Get queue position
        const queuePosition = await getQueuePosition(hotelId, userId);
        socket.emit(HOTEL_CHAT_EVENTS.QUEUE_POSITION, { position: queuePosition });

        // Notify staff dashboard of new guest
        hotelNamespace.to(`hotel:${hotelId}`).emit(HOTEL_CHAT_EVENTS.GUEST_ONLINE, {
          hotelId,
          bookingId,
          userId,
          guestName,
          queuePosition,
        });
      } catch (error: any) {
        logger.error('[HotelSocket] Guest join error', { error: error.message });
        socket.emit('error', { message: 'Failed to join chat' });
      }
    });

    // ── Staff Join ─────────────────────────────────────────────────────────
    socket.on('staff:join', async (data: StaffJoinData) => {
      try {
        const { hotelId, userId, staffId, department } = data;

        socket.userId = userId;
        socket.hotelId = hotelId;
        socket.staffId = staffId;
        socket.department = department;
        socket.isStaff = true;

        // Join hotel room
        socket.join(`hotel:${hotelId}`);

        // Join department room if specified
        if (department) {
          socket.join(`department:${hotelId}:${department}`);
        }

        // Update staff status in database
        await prisma.hotelChatStaff.upsert({
          where: { staffId },
          update: { isOnline: true },
          create: {
            hotelId,
            staffId,
            name: 'Staff',
            department: department || 'front_desk',
            isOnline: true,
            isOnDuty: true,
            activeChats: 0
          }
        });

        logger.info('[HotelSocket] Staff joined', { hotelId, staffId, department });

        // Notify guests of staff availability
        hotelNamespace.to(`hotel:${hotelId}`).emit(HOTEL_CHAT_EVENTS.STAFF_AVAILABLE, {
          hotelId,
          department,
          isOnline: true,
        });
      } catch (error: any) {
        logger.error('[HotelSocket] Staff join error', { error: error.message });
      }
    });

    // ── Guest Message ──────────────────────────────────────────────────────
    socket.on('guest:message', async (data: GuestMessageData) => {
      try {
        const { hotelId, bookingId, userId, guestName, content, messageType = 'text', tempId } = data;

        // Find or create conversation
        let conversation = await prisma.hotelChatConversation.findFirst({
          where: {
            hotelId,
            guestUserId: userId,
            status: 'active'
          },
          orderBy: { createdAt: 'desc' }
        });

        if (!conversation) {
          conversation = await prisma.hotelChatConversation.create({
            data: {
              hotelId,
              bookingId: bookingId || null,
              guestUserId: userId,
              guestName: guestName || 'Guest',
              status: 'active',
              priority: 'normal',
              department: 'front_desk',
              type: 'general'
            }
          });

          // Notify staff of new conversation
          hotelNamespace.to(`hotel:${hotelId}`).emit(HOTEL_CHAT_EVENTS.CONVERSATION_CREATED, {
            conversationId: conversation.id,
            hotelId,
            bookingId,
          });
        }

        // Create message in database
        const message = await prisma.hotelChatMessage.create({
          data: {
            conversationId: conversation.id,
            senderId: userId,
            senderType: 'guest',
            senderName: guestName || 'Guest',
            content,
            messageType,
          },
        });

        // Update conversation
        await prisma.hotelChatConversation.update({
          where: { id: conversation.id },
          data: {
            status: 'active',
            lastMessageAt: new Date(),
            lastMessage: content.substring(0, 100),
            unreadStaffCount: { increment: 1 }
          },
        });

        logger.info('[HotelSocket] Guest message sent', {
          conversationId: conversation.id,
          messageId: message.id,
        });

        // Broadcast to hotel staff room
        hotelNamespace.to(`hotel:${hotelId}`).emit(HOTEL_CHAT_EVENTS.NEW_MESSAGE, {
          conversationId: conversation.id,
          message: {
            id: message.id,
            content: message.content,
            senderType: 'guest',
            senderName: message.senderName,
            messageType: message.messageType,
            createdAt: message.createdAt,
          },
        });

        // Send ack to sender
        socket.emit(HOTEL_CHAT_EVENTS.MESSAGE_ACK, {
          messageId: message.id,
          tempId: tempId,
          conversationId: conversation.id,
        });
      } catch (error: any) {
        logger.error('[HotelSocket] Guest message error', { error: error.message });
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // ── Staff Message ──────────────────────────────────────────────────────
    socket.on('staff:message', async (data: StaffMessageData) => {
      try {
        const { hotelId, conversationId, staffId, staffName, content, messageType = 'text' } = data;

        // Create message
        const message = await prisma.hotelChatMessage.create({
          data: {
            conversationId,
            senderId: staffId,
            senderType: 'staff',
            senderName: staffName,
            content,
            messageType,
          },
        });

        // Get conversation for bookingId
        const conversation = await prisma.hotelChatConversation.findUnique({
          where: { id: conversationId }
        });

        if (!conversation) {
          throw new Error('Conversation not found');
        }

        // Update conversation
        await prisma.hotelChatConversation.update({
          where: { id: conversationId },
          data: {
            lastMessageAt: new Date(),
            lastMessage: content.substring(0, 100),
            unreadGuestCount: { increment: 1 }
          },
        });

        logger.info('[HotelSocket] Staff message sent', {
          conversationId,
          messageId: message.id,
        });

        // Broadcast to hotel staff room
        hotelNamespace.to(`hotel:${hotelId}`).emit(HOTEL_CHAT_EVENTS.NEW_MESSAGE, {
          conversationId,
          message: {
            id: message.id,
            content: message.content,
            senderType: 'staff',
            senderName: message.senderName,
            staffId,
            messageType: message.messageType,
            createdAt: message.createdAt,
          },
        });

        // Emit to guest's room
        if (conversation.bookingId) {
          hotelNamespace.to(`booking:${conversation.bookingId}`).emit(HOTEL_CHAT_EVENTS.NEW_MESSAGE, {
            conversationId,
            message: {
              id: message.id,
              content: message.content,
              senderType: 'staff',
              senderName: message.senderName,
              messageType: message.messageType,
              createdAt: message.createdAt,
            },
          });
        }
      } catch (error: any) {
        logger.error('[HotelSocket] Staff message error', { error: error.message });
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // ── Typing Indicator ──────────────────────────────────────────────────
    socket.on('typing', (data: {
      hotelId: string;
      conversationId: string;
      userId: string;
      isTyping: boolean;
      senderType: 'guest' | 'staff';
    }) => {
      const { hotelId, conversationId, isTyping, senderType } = data;

      if (senderType === 'guest') {
        hotelNamespace.to(`hotel:${hotelId}`).emit(HOTEL_CHAT_EVENTS.STAFF_TYPING, {
          conversationId,
          isTyping,
        });
      } else {
        hotelNamespace.to(`hotel:${hotelId}`).emit(HOTEL_CHAT_EVENTS.GUEST_TYPING, {
          conversationId,
          isTyping,
        });
      }
    });

    // ── Read Receipts ─────────────────────────────────────────────────────
    socket.on('read', async (data: {
      conversationId: string;
      userId: string;
      senderType: 'guest' | 'staff';
    }) => {
      const { conversationId, userId, senderType } = data;

      try {
        // Mark messages as read in DB
        await prisma.hotelChatMessage.updateMany({
          where: {
            conversationId,
            senderId: { not: userId },
            readAt: null
          },
          data: { readAt: new Date() }
        });

        // Reset unread count
        if (senderType === 'staff') {
          await prisma.hotelChatConversation.update({
            where: { id: conversationId },
            data: { unreadStaffCount: 0 }
          });
        } else {
          await prisma.hotelChatConversation.update({
            where: { id: conversationId },
            data: { unreadGuestCount: 0 }
          });
        }

        // Broadcast read status
        const socketStaff = socket as HotelStaffSocket;
        if (socketStaff.hotelId) {
          hotelNamespace.to(`hotel:${socketStaff.hotelId}`).emit(
            HOTEL_CHAT_EVENTS.MESSAGES_READ,
            { conversationId, userId }
          );
        }
      } catch (error: any) {
        logger.error('[HotelSocket] Read receipt error', { error: error.message });
      }
    });

    // ── Assign Conversation ────────────────────────────────────────────────
    socket.on('assign', async (data: {
      conversationId: string;
      staffId: string;
      staffName: string;
      department?: string;
    }) => {
      try {
        const { conversationId, staffId, staffName, department } = data;

        const conversation = await prisma.hotelChatConversation.update({
          where: { id: conversationId },
          data: {
            staffId,
            staffName,
            department: department || undefined,
            status: 'active',
          },
        });

        logger.info('[HotelSocket] Conversation assigned', { conversationId, staffId });

        // Notify all staff
        hotelNamespace.to(`hotel:${conversation.hotelId}`).emit(
          HOTEL_CHAT_EVENTS.CONVERSATION_ASSIGNED,
          {
            conversationId,
            staffId,
            staffName,
            department,
          }
        );

        // Notify specific guest
        if (conversation.bookingId) {
          hotelNamespace.to(`booking:${conversation.bookingId}`).emit(
            HOTEL_CHAT_EVENTS.STAFF_ASSIGNED,
            {
              staffId,
              staffName,
              department,
            }
          );
        }
      } catch (error: any) {
        logger.error('[HotelSocket] Assign error', { error: error.message });
        socket.emit('error', { message: 'Failed to assign conversation' });
      }
    });

    // ── Transfer Conversation ──────────────────────────────────────────────
    socket.on('transfer', async (data: {
      conversationId: string;
      toDepartment: string;
      staffId: string;
      hotelId: string;
    }) => {
      try {
        const { conversationId, toDepartment, staffId, hotelId } = data;

        await prisma.hotelChatConversation.update({
          where: { id: conversationId },
          data: {
            department: toDepartment,
            staffId: null,
            staffName: null,
          },
        });

        logger.info('[HotelSocket] Conversation transferred', { conversationId, toDepartment });

        // Notify hotel staff
        hotelNamespace.to(`hotel:${hotelId}`).emit(HOTEL_CHAT_EVENTS.CONVERSATION_TRANSFERRED, {
          conversationId,
          toDepartment,
          byStaffId: staffId,
        });
      } catch (error: any) {
        logger.error('[HotelSocket] Transfer error', { error: error.message });
      }
    });

    // ── Resolve Conversation ──────────────────────────────────────────────
    socket.on('resolve', async (data: {
      conversationId: string;
      hotelId: string;
      bookingId?: string;
    }) => {
      try {
        const { conversationId, hotelId, bookingId } = data;

        await prisma.hotelChatConversation.update({
          where: { id: conversationId },
          data: { status: 'resolved' },
        });

        logger.info('[HotelSocket] Conversation resolved', { conversationId });

        // Notify all parties
        hotelNamespace.to(`hotel:${hotelId}`).emit(HOTEL_CHAT_EVENTS.CONVERSATION_RESOLVED, {
          conversationId,
        });
        if (bookingId) {
          hotelNamespace.to(`booking:${bookingId}`).emit(HOTEL_CHAT_EVENTS.CONVERSATION_RESOLVED, {
            conversationId,
          });
        }
      } catch (error: any) {
        logger.error('[HotelSocket] Resolve error', { error: error.message });
      }
    });

    // ── Quick Replies ──────────────────────────────────────────────────────
    socket.on('quick-reply:set', async (data: {
      hotelId: string;
      department: string;
      replies: Array<{ id: string; text: string }>;
    }) => {
      // Store quick replies in Redis or DB (for simplicity, broadcast to staff)
      hotelNamespace.to(`hotel:${data.hotelId}`).emit('quick-replies:updated', {
        department: data.department,
        replies: data.replies,
      });
    });

    // ── Room Service: Staff Join ───────────────────────────────────────────
    socket.on('room-service:staff-join', (data: { hotelId: string; staffId: string; department?: string }) => {
      socket.userId = data.staffId;
      socket.hotelId = data.hotelId;
      socket.staffId = data.staffId;
      socket.isStaff = true;
      socket.department = data.department;

      socket.join(`hotel:${data.hotelId}`);
      if (data.department) {
        socket.join(`room-service:${data.hotelId}:${data.department}`);
      }
      logger.info('[HotelSocket] Staff joined room-service', { hotelId: data.hotelId, staffId: data.staffId });
    });

    // ── Room Service: Staff Updates Request ───────────────────────────────
    socket.on('room-service:update', async (data: {
      hotelId: string;
      requestId: string;
      status: string;
      staffId: string;
      assignedTo?: string;
    }) => {
      const { hotelId, requestId, status, assignedTo } = data;

      try {
        const updateData: any = { status };
        if (assignedTo) updateData.assignedTo = assignedTo;
        if (status === 'completed') updateData.completedAt = new Date();

        const updated = await prisma.roomServiceRequest.update({
          where: { id: requestId },
          data: updateData,
        });

        // Broadcast to all hotel staff
        hotelNamespace.to(`hotel:${hotelId}`).emit('room-service:updated', {
          requestId,
          status: updated.status,
          assignedTo: updated.assignedTo,
          completedAt: updated.completedAt,
          updatedBy: data.staffId,
        });

        // Broadcast to guest via booking room
        if (updated.bookingId) {
          hotelNamespace.to(`booking:${updated.bookingId}`).emit('room-service:updated', {
            requestId,
            status: updated.status,
            serviceType: updated.serviceType,
            completedAt: updated.completedAt,
          });
        }

        logger.info('[HotelSocket] Room service updated', { requestId, status, hotelId });
      } catch (error: any) {
        logger.error('[HotelSocket] Room service update error', { error: error.message });
        socket.emit('error', { message: 'Failed to update room service request' });
      }
    });

    // ── Room Service: Guest Joins ──────────────────────────────────────────
    socket.on('room-service:guest-join', (data: { hotelId: string; bookingId: string; userId: string }) => {
      socket.userId = data.userId;
      socket.hotelId = data.hotelId;
      socket.bookingId = data.bookingId;
      socket.isGuest = true;

      // Join booking room to receive updates
      socket.join(`booking:${data.bookingId}`);
      logger.info('[HotelSocket] Guest joined room-service', { hotelId: data.hotelId, bookingId: data.bookingId });
    });

    // ── Disconnect ────────────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      logger.info('[HotelSocket] Client disconnected', { socketId: socket.id });

      if (socket.isStaff && socket.staffId) {
        // Mark staff as offline
        await prisma.hotelChatStaff.updateMany({
          where: { staffId: socket.staffId },
          data: { isOnline: false },
        }).catch(() => {}); // Ignore errors

        // Notify guests
        if (socket.hotelId) {
          hotelNamespace.to(`hotel:${socket.hotelId}`).emit(HOTEL_CHAT_EVENTS.STAFF_OFFLINE, {
            hotelId: socket.hotelId,
            department: socket.department,
          });
        }
      } else if (socket.isGuest && socket.userId && socket.hotelId) {
        // Notify staff guest went offline
        hotelNamespace.to(`hotel:${socket.hotelId}`).emit(HOTEL_CHAT_EVENTS.GUEST_OFFLINE, {
          hotelId: socket.hotelId,
          userId: socket.userId,
        });
      }
    });
  });

  return hotelIO;
}

export function getHotelIO(): Server | null {
  return hotelIO;
}

// ── Helper Functions ───────────────────────────────────────────────────────────

async function getQueuePosition(hotelId: string, userId: string): Promise<number> {
  const conversations = await prisma.hotelChatConversation.findMany({
    where: {
      hotelId,
      status: 'pending',
      unreadStaffCount: { gt: 0 }
    },
    orderBy: { createdAt: 'asc' },
    select: { guestUserId: true },
  });

  const index = conversations.findIndex((c) => c.guestUserId === userId);
  return index === -1 ? 0 : index + 1;
}

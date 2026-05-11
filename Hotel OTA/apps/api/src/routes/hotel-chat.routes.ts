import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { authMiddleware, optionalAuth } from '../middleware/auth';
import { logger } from '../config/logger';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Apply optional auth by default (guests can access some endpoints)
router.use(optionalAuth);

// ── Types ──────────────────────────────────────────────────────────────────────

type HotelConversationType =
  | 'room_service'
  | 'concierge'
  | 'housekeeping'
  | 'maintenance'
  | 'spa'
  | 'transport'
  | 'general'
  | 'checkout';

type HotelDepartment =
  | 'front_desk'
  | 'concierge'
  | 'housekeeping'
  | 'room_service'
  | 'maintenance'
  | 'spa'
  | 'transport'
  | 'manager';

type MessageSender = 'guest' | 'staff' | 'system';

// ── Conversations Endpoints ────────────────────────────────────────────────────

/**
 * Create or get a hotel chat conversation
 * POST /api/hotel-chat/conversations
 */
router.post('/conversations', async (req: Request, res: Response) => {
  try {
    const {
      bookingId,
      roomNumber,
      type = 'general',
      department = 'front_desk',
      guestUserId,
      guestName,
      initialMessage
    } = req.body;

    const hotelId = req.user?.hotelId || req.body.hotelId;

    if (!hotelId) {
      return res.status(401).json({ success: false, message: 'Hotel ID required' });
    }

    if (!guestUserId) {
      return res.status(400).json({
        success: false,
        message: 'guestUserId is required'
      });
    }

    // Check for existing active conversation with same guest and department
    const existingConv = await prisma.hotelChatConversation.findFirst({
      where: {
        hotelId,
        guestUserId,
        type: type as string,
        department: department as string,
        status: 'active'
      }
    });

    if (existingConv) {
      return res.json({
        success: true,
        data: { conversation: existingConv }
      });
    }

    // Create new conversation in database
    const conversation = await prisma.hotelChatConversation.create({
      data: {
        hotelId,
        bookingId: bookingId || null,
        roomNumber: roomNumber || null,
        type: type as string,
        department: department as string,
        guestUserId,
        guestName: guestName || 'Guest',
        status: 'active',
        priority: 'normal',
        unreadGuestCount: 0,
        unreadStaffCount: 0
      }
    });

    // If there's an initial message, add it
    if (initialMessage) {
      await prisma.hotelChatMessage.create({
        data: {
          conversationId: conversation.id,
          senderId: guestUserId,
          senderType: 'guest',
          senderName: guestName || 'Guest',
          content: initialMessage,
          messageType: 'text'
        }
      });

      // Update conversation
      await prisma.hotelChatConversation.update({
        where: { id: conversation.id },
        data: {
          lastMessage: initialMessage.substring(0, 100),
          lastMessageAt: new Date(),
          unreadStaffCount: 1
        }
      });
    }

    logger.info(`[HotelChat] Created conversation ${conversation.id} for guest ${guestUserId}`);

    res.status(201).json({
      success: true,
      data: { conversation }
    });
  } catch (error: any) {
    logger.error('[HotelChat] Error creating conversation:', { error: String(error) });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * Get conversations for a hotel (staff view)
 * GET /api/hotel-chat/conversations
 */
router.get('/conversations', async (req: Request, res: Response) => {
  try {
    const hotelId = req.user?.hotelId;
    const { status = 'active', department, guestId, limit = '50', offset = '0' } = req.query;

    if (!hotelId) {
      return res.status(401).json({ success: false, message: 'Hotel ID required' });
    }

    const where: any = {
      hotelId,
      status: status as string
    };

    if (department) {
      where.department = department;
    }

    if (guestId) {
      where.guestUserId = guestId;
    }

    const [conversations, total] = await Promise.all([
      prisma.hotelChatConversation.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: Number(offset),
        take: Number(limit)
      }),
      prisma.hotelChatConversation.count({ where })
    ]);

    res.json({
      success: true,
      data: { conversations, total }
    });
  } catch (error) {
    logger.error('[HotelChat] Error fetching conversations:', { error: String(error) });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * Get a specific conversation
 * GET /api/hotel-chat/conversations/:id
 */
router.get('/conversations/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const conversation = await prisma.hotelChatConversation.findUnique({
      where: { id }
    });

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    res.json({ success: true, data: { conversation } });
  } catch (error) {
    logger.error('[HotelChat] Error fetching conversation:', { error: String(error) });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * Assign staff to a conversation
 * POST /api/hotel-chat/conversations/:id/assign
 */
router.post('/conversations/:id/assign', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { staffId, staffName, department } = req.body;

    const conversation = await prisma.hotelChatConversation.update({
      where: { id },
      data: {
        staffId: staffId || null,
        staffName: staffName || null,
        department: department || undefined
      }
    });

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    logger.info(`[HotelChat] Assigned ${staffName} to conversation ${id}`);

    res.json({ success: true, data: { conversation } });
  } catch (error) {
    logger.error('[HotelChat] Error assigning staff:', { error: String(error) });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * Transfer conversation to another department
 * POST /api/hotel-chat/conversations/:id/transfer
 */
router.post('/conversations/:id/transfer', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { department, staffId } = req.body;

    const conversation = await prisma.hotelChatConversation.update({
      where: { id },
      data: {
        department,
        staffId: null,
        staffName: null
      }
    });

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    logger.info(`[HotelChat] Transferred conversation ${id} to ${department}`);

    res.json({ success: true, data: { conversation } });
  } catch (error) {
    logger.error('[HotelChat] Error transferring conversation:', { error: String(error) });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * Resolve a conversation
 * POST /api/hotel-chat/conversations/:id/resolve
 */
router.post('/conversations/:id/resolve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const conversation = await prisma.hotelChatConversation.update({
      where: { id },
      data: { status: 'resolved' }
    });

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    logger.info(`[HotelChat] Resolved conversation ${id}`);

    res.json({ success: true });
  } catch (error) {
    logger.error('[HotelChat] Error resolving conversation:', { error: String(error) });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── Messages Endpoints ─────────────────────────────────────────────────────────

/**
 * Get messages for a conversation
 * GET /api/hotel-chat/messages
 */
router.get('/messages', async (req: Request, res: Response) => {
  try {
    const { conversationId, before, limit = '50' } = req.query;

    if (!conversationId) {
      return res.status(400).json({ success: false, message: 'conversationId is required' });
    }

    const where: any = { conversationId: conversationId as string };

    if (before) {
      where.createdAt = { lt: new Date(before as string) };
    }

    const [messages, total] = await Promise.all([
      prisma.hotelChatMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Number(limit)
      }),
      prisma.hotelChatMessage.count({ where: { conversationId: conversationId as string } })
    ]);

    // Reverse to get chronological order
    const sortedMessages = messages.reverse();

    res.json({
      success: true,
      data: {
        messages: sortedMessages,
        totalCount: total,
        hasMore: messages.length >= Number(limit)
      }
    });
  } catch (error) {
    logger.error('[HotelChat] Error fetching messages:', { error: String(error) });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * Send a message
 * POST /api/hotel-chat/messages
 */
router.post('/messages', async (req: Request, res: Response) => {
  try {
    const { conversationId, content, type = 'text', metadata, senderId, senderName, senderType } = req.body;

    const sender = req.user?.role === 'staff' ? 'staff' : 'guest';
    const senderIdFinal = req.user?.id || senderId || 'guest';
    const senderNameFinal = req.user?.name || senderName || 'Guest';
    const senderTypeFinal = senderType || sender;

    if (!conversationId || !content) {
      return res.status(400).json({
        success: false,
        message: 'conversationId and content are required'
      });
    }

    // Verify conversation exists
    const conversation = await prisma.hotelChatConversation.findUnique({
      where: { id: conversationId }
    });

    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    // Create message in database
    const message = await prisma.hotelChatMessage.create({
      data: {
        conversationId,
        senderId: senderIdFinal,
        senderType: senderTypeFinal,
        senderName: senderNameFinal,
        content,
        messageType: type as string,
        metadata: metadata || null
      }
    });

    // Update conversation
    await prisma.hotelChatConversation.update({
      where: { id: conversationId },
      data: {
        lastMessage: content.substring(0, 100),
        lastMessageAt: new Date(),
        unreadGuestCount: senderTypeFinal === 'staff' ? { increment: 1 } : 0,
        unreadStaffCount: senderTypeFinal === 'guest' ? { increment: 1 } : 0
      }
    });

    logger.info(`[HotelChat] ${senderTypeFinal} sent message in conversation ${conversationId}`);

    res.status(201).json({ success: true, data: { message } });
  } catch (error) {
    logger.error('[HotelChat] Error sending message:', { error: String(error) });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * Mark messages as read
 * POST /api/hotel-chat/read
 */
router.post('/read', async (req: Request, res: Response) => {
  try {
    const { conversationId, messageIds } = req.body;
    const userId = req.user?.id;
    const isStaff = req.user?.role === 'staff';

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        message: 'conversationId is required'
      });
    }

    // If messageIds provided, mark specific messages
    if (messageIds?.length) {
      await prisma.hotelChatMessage.updateMany({
        where: {
          conversationId,
          id: { in: messageIds },
          senderId: { not: userId }
        },
        data: { readAt: new Date() }
      });
    } else {
      // Mark all messages from other sender as read
      await prisma.hotelChatMessage.updateMany({
        where: {
          conversationId,
          senderId: { not: userId },
          readAt: null
        },
        data: { readAt: new Date() }
      });
    }

    // Reset unread count for this user type
    if (isStaff) {
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

    res.json({ success: true });
  } catch (error) {
    logger.error('[HotelChat] Error marking messages read:', { error: String(error) });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── Staff Availability ────────────────────────────────────────────────────────

/**
 * Get staff availability for hotel
 * GET /api/hotel-chat/staff/availability
 */
router.get('/staff/availability', async (req: Request, res: Response) => {
  try {
    const hotelId = req.user?.hotelId;

    if (!hotelId) {
      return res.status(401).json({ success: false, message: 'Hotel ID required' });
    }

    const staff = await prisma.hotelChatStaff.findMany({
      where: { hotelId },
      orderBy: { name: 'asc' }
    });

    res.json({ success: true, data: { availability: staff } });
  } catch (error) {
    logger.error('[HotelChat] Error fetching staff availability:', { error: String(error) });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * Register staff for hotel chat
 * POST /api/hotel-chat/staff/register
 */
router.post('/staff/register', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { department } = req.body;
    const staffId = req.user!.id;
    const hotelId = req.user!.hotelId;
    const name = req.user!.name || 'Staff';

    if (!staffId || !hotelId) {
      return res.status(401).json({ success: false, message: 'Staff ID and Hotel ID required' });
    }

    const staff = await prisma.hotelChatStaff.upsert({
      where: { staffId },
      update: { name, department, isOnline: true },
      create: {
        hotelId,
        staffId,
        name,
        department: department || 'front_desk',
        isOnline: true,
        isOnDuty: true,
        activeChats: 0
      }
    });

    res.json({ success: true, data: { staff } });
  } catch (error) {
    logger.error('[HotelChat] Error registering staff:', { error: String(error) });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * Update staff online status
 * POST /api/hotel-chat/staff/status
 */
router.post('/staff/status', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { isOnline, isOnDuty } = req.body;
    const staffId = req.user!.id;

    const staff = await prisma.hotelChatStaff.update({
      where: { staffId },
      data: {
        isOnline: isOnline ?? undefined,
        isOnDuty: isOnDuty ?? undefined
      }
    });

    res.json({ success: true, data: { staff } });
  } catch (error) {
    logger.error('[HotelChat] Error updating staff status:', { error: String(error) });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── Hotel Config ──────────────────────────────────────────────────────────────

/**
 * Get hotel chat configuration
 * GET /api/hotel-chat/config
 */
router.get('/config', async (req: Request, res: Response) => {
  try {
    const { hotelId } = req.query;

    const config = {
      enabled: true,
      departments: ['front_desk', 'concierge', 'housekeeping', 'room_service', 'maintenance', 'spa', 'transport'] as string[],
      quickReplies: {
        front_desk: [
          { id: 'qr_1', text: 'Check-out time', action: 'send_message', payload: 'What is the check-out time?' },
          { id: 'qr_2', text: 'Wake-up call', action: 'send_message', payload: 'I need a wake-up call' },
          { id: 'qr_3', text: 'Taxi service', action: 'send_message', payload: 'I need a taxi' },
        ],
        room_service: [
          { id: 'qr_4', text: 'Menu', action: 'send_message', payload: 'Can I see the room service menu?' },
          { id: 'qr_5', text: 'Order status', action: 'send_message', payload: 'Where is my order?' },
        ],
        housekeeping: [
          { id: 'qr_6', text: 'Extra towels', action: 'send_message', payload: 'I need extra towels' },
          { id: 'qr_7', text: 'Room cleaning', action: 'send_message', payload: 'I would like my room cleaned' },
        ],
        concierge: [
          { id: 'qr_8', text: 'Restaurant recommendations', action: 'send_message', payload: 'Can you recommend a restaurant?' },
          { id: 'qr_9', text: 'Book a tour', action: 'send_message', payload: 'I would like to book a tour' },
        ],
        spa: [
          { id: 'qr_10', text: 'Book massage', action: 'send_message', payload: 'I would like to book a massage' },
          { id: 'qr_11', text: 'Spa menu', action: 'send_message', payload: 'Can I see the spa services?' },
        ],
        transport: [
          { id: 'qr_12', text: 'Airport pickup', action: 'send_message', payload: 'I need an airport pickup' },
          { id: 'qr_13', text: 'Rent a car', action: 'send_message', payload: 'I would like to rent a car' },
        ],
        maintenance: [
          { id: 'qr_14', text: 'AC not working', action: 'send_message', payload: 'The AC is not working properly' },
          { id: 'qr_15', text: 'Plumbing issue', action: 'send_message', payload: 'There is a plumbing issue' },
        ],
      },
      businessHours: {
        front_desk: { start: '00:00', end: '23:59' },
        concierge: { start: '07:00', end: '23:00' },
        room_service: { start: '06:00', end: '23:00' },
      },
    };

    res.json({ success: true, data: { config } });
  } catch (error) {
    logger.error('[HotelChat] Error fetching config:', { error: String(error) });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;

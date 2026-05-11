import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { logger } from '../config/logger';

const router = Router();

// Apply auth middleware
router.use(authMiddleware);

/**
 * Create or get existing chat thread for a room
 * POST /api/room-chat/threads
 */
router.post('/threads', async (req: Request, res: Response) => {
  try {
    const { bookingId, roomId, message } = req.body;
    const userId = req.user?.id;

    if (!bookingId || !roomId) {
      return res.status(400).json({
        success: false,
        message: 'bookingId and roomId are required'
      });
    }

    // Find or create thread
    let thread = await prisma.roomChatThread.findFirst({
      where: {
        bookingId,
        roomId,
        status: 'active'
      }
    });

    if (!thread) {
      // Get booking details
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { user: { select: { id: true, fullName: true } } }
      });

      thread = await prisma.roomChatThread.create({
        data: {
          bookingId,
          roomId,
          hotelId: booking?.hotelId || '',
          guestUserId: booking?.userId || userId || '',
          status: 'active'
        }
      });
    }

    // If initial message provided, create it
    if (message) {
      await prisma.roomChatMessage.create({
        data: {
          threadId: thread.id,
          senderId: userId || '',
          senderType: 'guest',
          senderName: req.user?.name || 'Guest',
          messageType: 'text',
          content: message
        }
      });
    }

    res.status(201).json({
      success: true,
      data: { threadId: thread.id }
    });
  } catch (error: any) {
    logger.error('Failed to create chat thread', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to create chat thread'
    });
  }
});

/**
 * Get chat thread with messages
 * GET /api/room-chat/threads/:threadId
 */
router.get('/threads/:threadId', async (req: Request, res: Response) => {
  try {
    const { threadId } = req.params;
    const { page = '1', limit = '50' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const skip = (pageNum - 1) * limitNum;

    const thread = await prisma.roomChatThread.findUnique({
      where: { id: threadId }
    });

    if (!thread) {
      return res.status(404).json({
        success: false,
        message: 'Thread not found'
      });
    }

    const [messages, total] = await Promise.all([
      prisma.roomChatMessage.findMany({
        where: { threadId },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limitNum
      }),
      prisma.roomChatMessage.count({ where: { threadId } })
    ]);

    res.json({
      success: true,
      data: {
        thread,
        messages,
        page: pageNum,
        limit: limitNum,
        totalCount: total
      }
    });
  } catch (error: any) {
    logger.error('Failed to get chat thread', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get chat thread'
    });
  }
});

/**
 * List user's chat threads
 * GET /api/room-chat/threads
 */
router.get('/threads', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { page = '1', limit = '20' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 50);
    const skip = (pageNum - 1) * limitNum;

    const [threads, total] = await Promise.all([
      prisma.roomChatThread.findMany({
        where: { guestUserId: userId },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limitNum,
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      }),
      prisma.roomChatThread.count({ where: { guestUserId: userId } })
    ]);

    res.json({
      success: true,
      data: {
        threads,
        page: pageNum,
        limit: limitNum,
        totalCount: total
      }
    });
  } catch (error: any) {
    logger.error('Failed to list chat threads', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to list threads'
    });
  }
});

/**
 * Send message to thread
 * POST /api/room-chat/threads/:threadId/messages
 */
router.post('/threads/:threadId/messages', async (req: Request, res: Response) => {
  try {
    const { threadId } = req.params;
    const { content, messageType = 'text' } = req.body;
    const userId = req.user?.id;
    const userRole = req.user?.role || 'guest';

    if (!content) {
      return res.status(400).json({
        success: false,
        message: 'Message content is required'
      });
    }

    const thread = await prisma.roomChatThread.findUnique({
      where: { id: threadId }
    });

    if (!thread) {
      return res.status(404).json({
        success: false,
        message: 'Thread not found'
      });
    }

    const senderType = ['staff', 'manager', 'admin'].includes(userRole) ? 'staff' : 'guest';

    const message = await prisma.roomChatMessage.create({
      data: {
        threadId,
        senderId: userId || '',
        senderType,
        senderName: req.user?.name || 'Guest',
        messageType,
        content
      }
    });

    // Update thread's updatedAt
    await prisma.roomChatThread.update({
      where: { id: threadId },
      data: { updatedAt: new Date() }
    });

    logger.info('Chat message sent', {
      threadId,
      senderType,
      messageType
    });

    // TODO: Emit WebSocket event to other participants

    res.status(201).json({
      success: true,
      data: message
    });
  } catch (error: any) {
    logger.error('Failed to send message', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to send message'
    });
  }
});

/**
 * Mark messages as read
 * PATCH /api/room-chat/threads/:threadId/read
 */
router.patch('/threads/:threadId/read', async (req: Request, res: Response) => {
  try {
    const { threadId } = req.params;
    const userId = req.user?.id;

    // Mark all messages not from this user as read
    await prisma.roomChatMessage.updateMany({
      where: {
        threadId,
        senderId: { not: userId },
        readAt: null
      },
      data: { readAt: new Date() }
    });

    res.json({
      success: true,
      message: 'Messages marked as read'
    });
  } catch (error: any) {
    logger.error('Failed to mark messages as read', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to mark messages as read'
    });
  }
});

/**
 * Close chat thread
 * PATCH /api/room-chat/threads/:threadId/close
 */
router.patch('/threads/:threadId/close', async (req: Request, res: Response) => {
  try {
    const { threadId } = req.params;

    const thread = await prisma.roomChatThread.findUnique({
      where: { id: threadId }
    });

    if (!thread) {
      return res.status(404).json({
        success: false,
        message: 'Thread not found'
      });
    }

    await prisma.roomChatThread.update({
      where: { id: threadId },
      data: { status: 'closed' }
    });

    // Add system message
    await prisma.roomChatMessage.create({
      data: {
        threadId,
        senderId: 'system',
        senderType: 'system',
        senderName: 'System',
        messageType: 'system',
        content: 'This conversation has been closed.'
      }
    });

    res.json({
      success: true,
      message: 'Thread closed'
    });
  } catch (error: any) {
    logger.error('Failed to close thread', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to close thread'
    });
  }
});

export default router;

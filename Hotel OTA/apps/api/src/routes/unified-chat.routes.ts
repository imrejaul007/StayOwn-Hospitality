// ── Unified Chat Routes ─────────────────────────────────────────────────────────
// REST API for cross-platform chat (support, restaurant, retail, general)

import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { logger } from '../config/logger';

const router = Router();

// ── Types ──────────────────────────────────────────────────────────────────────

type AppType = 'hotel' | 'restaurant' | 'retail' | 'support' | 'general';
type SenderType = 'user' | 'staff' | 'system' | 'ai';
type ConversationStatus = 'active' | 'pending_staff' | 'resolved' | 'closed';
type MessageType = 'text' | 'image' | 'file' | 'quick_reply' | 'system';

// ── Conversation Routes ─────────────────────────────────────────────────────────

/**
 * Get or create a conversation for a user
 * POST /api/unified-chat/conversations
 */
router.post('/conversations', async (req: Request, res: Response) => {
  try {
    const { userId, userName, appType, merchantId, type = 'support', customerContext } = req.body;

    if (!userId || !appType) {
      return res.status(400).json({
        success: false,
        message: 'userId and appType are required'
      });
    }

    // Find existing active conversation
    let conversation = await prisma.unifiedChatConversation.findFirst({
      where: {
        userId,
        appType,
        status: { in: ['active', 'pending_staff'] }
      },
      orderBy: { updatedAt: 'desc' }
    });

    if (conversation) {
      return res.json({
        success: true,
        data: { conversation },
        isNew: false
      });
    }

    // Create new conversation
    conversation = await prisma.unifiedChatConversation.create({
      data: {
        userId,
        userName: userName || 'User',
        appType,
        merchantId: merchantId || null,
        type: type as string,
        status: 'active',
        customerContext: customerContext || null,
      }
    });

    logger.info(`[UnifiedChat] Created conversation ${conversation.id} for user ${userId}`);

    res.status(201).json({
      success: true,
      data: { conversation },
      isNew: true
    });
  } catch (error: any) {
    logger.error('[UnifiedChat] Error creating conversation:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * Get user's conversations
 * GET /api/unified-chat/conversations
 */
router.get('/conversations', async (req: Request, res: Response) => {
  try {
    const { userId, appType, status = 'active', limit = '50', offset = '0' } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }

    const where: any = {
      userId: userId as string,
    };

    if (appType) {
      where.appType = appType as string;
    }

    if (status !== 'all') {
      where.status = status as string;
    }

    const [conversations, total] = await Promise.all([
      prisma.unifiedChatConversation.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: Number(offset),
        take: Number(limit)
      }),
      prisma.unifiedChatConversation.count({ where })
    ]);

    res.json({
      success: true,
      data: { conversations, total }
    });
  } catch (error: any) {
    logger.error('[UnifiedChat] Error fetching conversations:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * Get a specific conversation
 * GET /api/unified-chat/conversations/:id
 */
router.get('/conversations/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const conversation = await prisma.unifiedChatConversation.findUnique({
      where: { id }
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    res.json({ success: true, data: { conversation } });
  } catch (error: any) {
    logger.error('[UnifiedChat] Error fetching conversation:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * Update conversation status
 * PATCH /api/unified-chat/conversations/:id
 */
router.patch('/conversations/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, assignedStaffId, assignedStaffName, department } = req.body;

    const updateData: any = {};
    if (status) updateData.status = status;
    if (assignedStaffId !== undefined) updateData.assignedStaffId = assignedStaffId;
    if (assignedStaffName !== undefined) updateData.assignedStaffName = assignedStaffName;
    if (department !== undefined) updateData.department = department;
    if (status === 'resolved' || status === 'closed') updateData.resolvedAt = new Date();

    const conversation = await prisma.unifiedChatConversation.update({
      where: { id },
      data: updateData
    });

    logger.info(`[UnifiedChat] Updated conversation ${id}`);

    res.json({ success: true, data: { conversation } });
  } catch (error: any) {
    logger.error('[UnifiedChat] Error updating conversation:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── Message Routes ──────────────────────────────────────────────────────────────

/**
 * Get messages for a conversation
 * GET /api/unified-chat/messages
 */
router.get('/messages', async (req: Request, res: Response) => {
  try {
    const { conversationId, before, limit = '50' } = req.query;

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        message: 'conversationId is required'
      });
    }

    const where: any = { conversationId: conversationId as string };

    if (before) {
      where.createdAt = { lt: new Date(before as string) };
    }

    const [messages, total] = await Promise.all([
      prisma.unifiedChatMessage.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: Number(limit)
      }),
      prisma.unifiedChatMessage.count({
        where: { conversationId: conversationId as string }
      })
    ]);

    // Reverse to chronological order
    const sortedMessages = messages.reverse();

    res.json({
      success: true,
      data: {
        messages: sortedMessages,
        totalCount: total,
        hasMore: messages.length >= Number(limit)
      }
    });
  } catch (error: any) {
    logger.error('[UnifiedChat] Error fetching messages:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * Send a message
 * POST /api/unified-chat/messages
 */
router.post('/messages', async (req: Request, res: Response) => {
  try {
    const { conversationId, content, messageType = 'text', metadata, senderId, senderName, senderType } = req.body;

    if (!conversationId || !content) {
      return res.status(400).json({
        success: false,
        message: 'conversationId and content are required'
      });
    }

    // Verify conversation exists
    const conversation = await prisma.unifiedChatConversation.findUnique({
      where: { id: conversationId }
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    // Determine sender info
    const finalSenderType = senderType || 'user';
    const finalSenderId = senderId || 'user';
    const finalSenderName = senderName || 'User';

    // Create message
    const message = await prisma.unifiedChatMessage.create({
      data: {
        conversationId,
        senderId: finalSenderId,
        senderType: finalSenderType,
        senderName: finalSenderName,
        content,
        messageType: messageType as string,
        metadata: metadata || null,
        aiConfidence: finalSenderType === 'ai' ? (metadata?.confidence as number) || null : null,
      }
    });

    // Update conversation
    const isStaff = finalSenderType === 'staff';
    await prisma.unifiedChatConversation.update({
      where: { id: conversationId },
      data: {
        lastMessage: content.substring(0, 255),
        lastMessageAt: new Date(),
        messageCount: { increment: 1 },
        unreadUserCount: isStaff ? { increment: 1 } : 0,
        unreadStaffCount: !isStaff ? { increment: 1 } : 0,
        status: 'active',
      }
    });

    logger.info(`[UnifiedChat] ${finalSenderType} sent message in ${conversationId}`);

    res.status(201).json({
      success: true,
      data: { message }
    });
  } catch (error: any) {
    logger.error('[UnifiedChat] Error sending message:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * Mark messages as read
 * POST /api/unified-chat/read
 */
router.post('/read', async (req: Request, res: Response) => {
  try {
    const { conversationId, userId } = req.body;

    if (!conversationId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'conversationId and userId are required'
      });
    }

    // Mark all messages from other sender as read
    await prisma.unifiedChatMessage.updateMany({
      where: {
        conversationId,
        senderId: { not: userId },
        readAt: null
      },
      data: {
        readAt: new Date(),
        readBy: userId
      }
    });

    // Reset unread count for user
    await prisma.unifiedChatConversation.update({
      where: { id: conversationId },
      data: { unreadUserCount: 0 }
    });

    logger.info(`[UnifiedChat] Marked messages as read in ${conversationId}`);

    res.json({ success: true });
  } catch (error: any) {
    logger.error('[UnifiedChat] Error marking as read:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// ── Staff Routes ────────────────────────────────────────────────────────────────

/**
 * Get all active conversations (for staff dashboard)
 * GET /api/unified-chat/staff/conversations
 */
router.get('/staff/conversations', async (req: Request, res: Response) => {
  try {
    const { appType, department, status = 'active', limit = '50', offset = '0' } = req.query;

    const where: any = {
      status: { in: ['active', 'pending_staff'] }
    };

    if (appType) {
      where.appType = appType as string;
    }

    if (department) {
      where.department = department as string;
    }

    const [conversations, total] = await Promise.all([
      prisma.unifiedChatConversation.findMany({
        where,
        orderBy: [
          { priority: 'desc' },
          { updatedAt: 'desc' }
        ],
        skip: Number(offset),
        take: Number(limit)
      }),
      prisma.unifiedChatConversation.count({ where })
    ]);

    res.json({
      success: true,
      data: { conversations, total }
    });
  } catch (error: any) {
    logger.error('[UnifiedChat] Error fetching staff conversations:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

/**
 * Assign staff to a conversation
 * POST /api/unified-chat/staff/assign
 */
router.post('/staff/assign', async (req: Request, res: Response) => {
  try {
    const { conversationId, staffId, staffName, department } = req.body;

    if (!conversationId || !staffId) {
      return res.status(400).json({
        success: false,
        message: 'conversationId and staffId are required'
      });
    }

    const conversation = await prisma.unifiedChatConversation.update({
      where: { id: conversationId },
      data: {
        assignedStaffId: staffId,
        assignedStaffName: staffName || 'Staff',
        department: department || 'support',
        status: 'active',
      }
    });

    logger.info(`[UnifiedChat] Assigned ${staffName} to conversation ${conversationId}`);

    res.json({ success: true, data: { conversation } });
  } catch (error: any) {
    logger.error('[UnifiedChat] Error assigning staff:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

export default router;

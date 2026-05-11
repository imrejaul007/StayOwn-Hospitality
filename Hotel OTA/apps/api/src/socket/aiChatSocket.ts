// ── AI Chat Socket Handler ────────────────────────────────────────────────────────
// Real-time AI chat integration with Socket.IO

import { Server as SocketIOServer, Socket } from 'socket.io';
import { logger } from '../config/logger';
import { prisma } from '../config/database';
import {
  createAIChatService,
  AIChatService,
  CustomerContext,
  AIChatMessage,
  AppType,
  sanitizeCustomerContext,
} from '../lib/chatAiStub';

// ── AI Socket Events ─────────────────────────────────────────────────────────────

const AI_SOCKET_EVENTS = {
  // Client → Server
  AI_JOIN: 'ai:join',
  AI_MESSAGE: 'ai:message',
  AI_SUGGESTION: 'ai:suggestion',
  AI_TRANSFER_TO_STAFF: 'ai:transfer-to-staff',
  AI_END: 'ai:end',

  // Server → Client
  AI_JOINED: 'ai:joined',
  AI_TYPING: 'ai:typing',
  AI_MESSAGE_SENT: 'ai:message',
  AI_ACTION_RESULT: 'ai:action-result',
  AI_ENDED: 'ai:ended',
  ERROR: 'error',
} as const;

// ── Hotel Events (for cross-namespace communication) ────────────────────────────

const HOTEL_SOCKET_EVENTS = {
  CONVERSATION_CREATED: 'conversation:created',
  NEW_MESSAGE: 'hotel:new_message',
  MESSAGE_ACK: 'hotel:message_ack',
  STAFF_ASSIGNED: 'hotel:staff_assigned',
} as const;

// ── Types ──────────────────────────────────────────────────────────────────────

interface AISocketData {
  userId?: string;
  hotelId?: string;
  conversationId?: string;
  isAI?: boolean;
}

interface AIChatSocket extends Socket {
  data: AISocketData;
}

// ── AI Chat Socket Handler ─────────────────────────────────────────────────────

export class AIChatSocketHandler {
  private io: SocketIOServer;
  private hotelIO: SocketIOServer;
  private chatServices: Map<string, AIChatService> = new Map();
  private enableAI: boolean;

  constructor(
    io: SocketIOServer,
    hotelIO: SocketIOServer,
    options?: { enableAI?: boolean }
  ) {
    this.io = io;
    this.hotelIO = hotelIO;
    this.enableAI = options?.enableAI ?? true;
    this.setupAIHandlers();
  }

  private setupAIHandlers(): void {
    const aiNamespace = this.io.of('/ai-chat');

    aiNamespace.on('connection', (socket: AIChatSocket) => {
      logger.info('[AIChatSocket] Client connected', { socketId: socket.id });

      // ── Guest AI Chat Join ────────────────────────────────────────────────
      socket.on(AI_SOCKET_EVENTS.AI_JOIN, async (data: {
        hotelId: string;
        conversationId: string;
        userId: string;
        customerContext?: CustomerContext;
      }) => {
        try {
          const { hotelId, conversationId, userId, customerContext } = data;

          socket.data = {
            userId,
            hotelId,
            conversationId,
            isAI: true,
          };

          // Join conversation room
          socket.join(`ai:${conversationId}`);

          logger.info('[AIChatSocket] Guest joined AI chat', { hotelId, conversationId, userId });

          // Send welcome message if new conversation
          const existingMessages = await this.getConversationMessages(conversationId);
          if (existingMessages.length === 0) {
            const welcomeMsg = this.getWelcomeMessage(customerContext);
            socket.emit(AI_SOCKET_EVENTS.AI_MESSAGE_SENT, {
              id: `ai_welcome_${Date.now()}`,
              content: welcomeMsg,
              sender: 'ai',
              timestamp: new Date().toISOString(),
            });
          }

          // Acknowledge join
          socket.emit(AI_SOCKET_EVENTS.AI_JOINED, { conversationId, status: 'connected' });
        } catch (error: any) {
          logger.error('[AIChatSocket] AI join error', { error: error.message });
          socket.emit('error', { message: 'Failed to join AI chat' });
        }
      });

      // ── Guest Message to AI ──────────────────────────────────────────────
      socket.on(AI_SOCKET_EVENTS.AI_MESSAGE, async (data: {
        conversationId: string;
        userId: string;
        content: string;
        customerContext?: CustomerContext;
        hotelId?: string;
        merchantId?: string;
      }) => {
        try {
          const { conversationId, userId, content, customerContext, hotelId } = data;

          logger.info('[AIChatSocket] AI message received', { conversationId, userId });

          // Show typing indicator
          socket.emit(AI_SOCKET_EVENTS.AI_TYPING, { isTyping: true });

          // Get or create chat service for this hotel
          const serviceKey = hotelId || 'default';
          let service = this.chatServices.get(serviceKey);

          if (!service) {
            service = createAIChatService({
              appType: 'hotel' as AppType,
              merchantId: hotelId,
              enableAutoReply: true,
              enableSuggestions: true,
              maxSuggestions: 3,
              apiKey: process.env.ANTHROPIC_API_KEY,
            });
            this.chatServices.set(serviceKey, service);
          }

          // Get conversation history
          const history = await this.getAIConversationHistory(conversationId);

          // Process message through AI
          const response = await service.processMessage({
            conversationId,
            message: content,
            userId,
            appType: 'hotel' as AppType,
            merchantId: hotelId,
            customerContext,
            chatHistory: history,
          });

          // Stop typing indicator
          socket.emit(AI_SOCKET_EVENTS.AI_TYPING, { isTyping: false });

          // Send AI response
          socket.emit(AI_SOCKET_EVENTS.AI_MESSAGE_SENT, {
            id: `ai_${Date.now()}`,
            content: response.message,
            sender: 'ai',
            timestamp: new Date().toISOString(),
            metadata: {
              confidence: response.confidence,
              suggestions: response.suggestions,
              actions: response.actions,
              knowledgeUsed: response.knowledgeUsed,
            },
          });

          // Log for analytics (without sensitive data)
          logger.info('[AIChatSocket] AI response sent', {
            conversationId,
            confidence: response.confidence,
            hasActions: !!response.actions?.length,
          });

          // Handle actions (bookings, escalations, etc.)
          if (response.actions && response.actions.length > 0) {
            await this.handleAIActions(response.actions, {
              conversationId,
              userId,
              hotelId: hotelId || '',
              customerContext,
              socket,
            });
          }
        } catch (error: any) {
          logger.error('[AIChatSocket] AI message error', { error: error.message });
          socket.emit(AI_SOCKET_EVENTS.AI_TYPING, { isTyping: false });
          socket.emit(AI_SOCKET_EVENTS.AI_MESSAGE_SENT, {
            id: `ai_error_${Date.now()}`,
            content: "I'm having trouble processing your message. A staff member will be with you shortly.",
            sender: 'ai',
            timestamp: new Date().toISOString(),
          });
        }
      });

      // ── AI Suggestion Click ───────────────────────────────────────────────
      socket.on(AI_SOCKET_EVENTS.AI_SUGGESTION, async (data: {
        conversationId: string;
        suggestion: string;
        customerContext?: CustomerContext;
      }) => {
        try {
          const { conversationId, suggestion } = data;

          logger.info('[AIChatSocket] Suggestion clicked', { conversationId, suggestion });

          // Simulate suggestion selection by sending a follow-up query
          const service = this.chatServices.get('default');
          if (service) {
            socket.emit(AI_SOCKET_EVENTS.AI_TYPING, { isTyping: true });

            const response = await service.processMessage({
              conversationId,
              message: `User selected: ${suggestion}`,
              userId: socket.data.userId || '',
              appType: 'hotel' as AppType,
              customerContext: data.customerContext,
            });

            socket.emit(AI_SOCKET_EVENTS.AI_TYPING, { isTyping: false });
            socket.emit(AI_SOCKET_EVENTS.AI_MESSAGE_SENT, {
              id: `ai_${Date.now()}`,
              content: response.message,
              sender: 'ai',
              timestamp: new Date().toISOString(),
              metadata: { suggestions: response.suggestions },
            });
          }
        } catch (error: any) {
          logger.error('[AIChatSocket] Suggestion error', { error: error.message });
        }
      });

      // ── Transfer to Staff ─────────────────────────────────────────────────
      socket.on(AI_SOCKET_EVENTS.AI_TRANSFER_TO_STAFF, async (data: {
        conversationId: string;
        hotelId: string;
        reason?: string;
        department?: string;
      }) => {
        try {
          const { conversationId, hotelId, reason, department } = data;

          // Update conversation status
          await prisma.hotelChatConversation.update({
            where: { id: conversationId },
            data: {
              status: 'pending',
              department: department || 'front_desk',
            },
          });

          // Notify hotel staff
          this.hotelIO.of('/hotel').to(`hotel:${hotelId}`).emit(HOTEL_SOCKET_EVENTS.CONVERSATION_CREATED, {
            conversationId,
            hotelId,
            fromAI: true,
            reason,
          });

          // Notify guest
          socket.emit(AI_SOCKET_EVENTS.AI_MESSAGE_SENT, {
            id: `ai_transfer_${Date.now()}`,
            content: 'I\'m connecting you with a staff member who can better assist you. Please hold.',
            sender: 'ai',
            timestamp: new Date().toISOString(),
          });

          logger.info('[AIChatSocket] Escalated to staff', { conversationId, hotelId, department });
        } catch (error: any) {
          logger.error('[AIChatSocket] Transfer error', { error: error.message });
        }
      });

      // ── End AI Chat ───────────────────────────────────────────────────────
      socket.on(AI_SOCKET_EVENTS.AI_END, async (data: { conversationId: string; rating?: number }) => {
        try {
          const { conversationId, rating } = data;

          logger.info('[AIChatSocket] AI chat ended', { conversationId, rating });

          // Optionally save rating/feedback
          if (rating) {
            // Could save to analytics table
            logger.info('[AIChatSocket] Chat rating', { conversationId, rating });
          }

          socket.emit(AI_SOCKET_EVENTS.AI_ENDED, { conversationId });
        } catch (error: any) {
          logger.error('[AIChatSocket] End chat error', { error: error.message });
        }
      });

      // ── Disconnect ───────────────────────────────────────────────────────
      socket.on('disconnect', () => {
        logger.info('[AIChatSocket] Client disconnected', { socketId: socket.id });
      });
    });
  }

  // ── Action Handlers ──────────────────────────────────────────────────────────

  private async handleAIActions(
    actions: Array<{ type: string; data: Record<string, unknown>; reason: string }>,
    context: {
      conversationId: string;
      userId: string;
      hotelId: string;
      customerContext?: CustomerContext;
      socket: AIChatSocket;
    }
  ): Promise<void> {
    for (const action of actions) {
      switch (action.type) {
        case 'escalate':
          await this.handleEscalation(action, context);
          break;
        case 'create_booking':
          await this.handleBookingAction(action, context);
          break;
        case 'place_order':
          await this.handleOrderAction(action, context);
          break;
        default:
          logger.info('[AIChatSocket] Unhandled action type', { actionType: action.type });
      }
    }
  }

  private async handleEscalation(
    action: { data: Record<string, unknown> },
    context: {
      conversationId: string;
      hotelId: string;
      socket: AIChatSocket;
    }
  ): Promise<void> {
    const department = action.data.department as string || 'front_desk';

    // Notify hotel staff of escalation
    this.hotelIO.of('/hotel').to(`hotel:${context.hotelId}`).emit(HOTEL_SOCKET_EVENTS.CONVERSATION_CREATED, {
      conversationId: context.conversationId,
      hotelId: context.hotelId,
      fromAI: true,
      escalated: true,
      department,
    });
  }

  private async handleBookingAction(
    action: { data: Record<string, unknown> },
    context: {
      conversationId: string;
      hotelId: string;
      customerContext?: CustomerContext;
      socket: AIChatSocket;
    }
  ): Promise<void> {
    // Create booking request in database
    try {
      // This would integrate with your booking system
      // For now, log the intent
      logger.info('[AIChatSocket] Booking action triggered', {
        conversationId: context.conversationId,
        bookingType: action.data.bookingType,
      });

      // Send confirmation to guest
      context.socket.emit(AI_SOCKET_EVENTS.AI_ACTION_RESULT, {
        actionType: 'create_booking',
        status: 'pending',
        message: 'Your booking request has been submitted and is being processed.',
      });
    } catch (error) {
      logger.error('[AIChatSocket] Booking action error', { error });
    }
  }

  private async handleOrderAction(
    action: { data: Record<string, unknown> },
    context: {
      conversationId: string;
      hotelId: string;
      socket: AIChatSocket;
    }
  ): Promise<void> {
    // Similar to booking action
    logger.info('[AIChatSocket] Order action triggered', {
      conversationId: context.conversationId,
    });
  }

  // ── Database Helpers ─────────────────────────────────────────────────────────

  private async getConversationMessages(conversationId: string): Promise<Array<{
    id: string;
    content: string;
    sender: 'user' | 'ai' | 'staff';
    timestamp: Date;
  }>> {
    try {
      const messages = await prisma.hotelChatMessage.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          content: true,
          senderType: true,
          senderName: true,
          createdAt: true,
        },
      });

      return messages.map(m => ({
        id: m.id,
        content: m.content,
        sender: m.senderType as 'user' | 'ai' | 'staff',
        timestamp: m.createdAt,
      }));
    } catch {
      return [];
    }
  }

  private async getAIConversationHistory(conversationId: string): Promise<AIChatMessage[]> {
    const messages = await this.getConversationMessages(conversationId);
    return messages.map(m => ({
      id: m.id,
      conversationId,
      sender: m.sender === 'staff' ? 'staff' as const : m.sender === 'ai' ? 'ai' as const : 'user' as const,
      content: m.content,
      timestamp: m.timestamp,
    }));
  }

  // ── Welcome Message ────────────────────────────────────────────────────────

  private getWelcomeMessage(context?: CustomerContext): string {
    const name = context?.name ? ` ${context.name}` : '';
    const tier = context?.tier ? `, ${context.tier} member` : '';

    return `Hello${name}! 👋

I'm your AI assistant here at the hotel. I can help you with:

• Check-in and check-out information
• Room service orders
• Housekeeping requests
• Restaurant reservations
• Concierge services
• Local recommendations

What can I help you with today?${tier}`;
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────

  cleanup(): void {
    this.chatServices.clear();
    logger.info('[AIChatSocket] Handler cleaned up');
  }
}

// ── Factory Function ─────────────────────────────────────────────────────────────

export function createAIChatSocketHandler(
  io: SocketIOServer,
  hotelIO: SocketIOServer,
  options?: { enableAI?: boolean }
): AIChatSocketHandler {
  return new AIChatSocketHandler(io, hotelIO, options);
}

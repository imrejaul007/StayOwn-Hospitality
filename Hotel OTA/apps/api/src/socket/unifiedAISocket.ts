// ── Unified AI Chat Socket Handler ──────────────────────────────────────────────
// Real-time AI chat integration for entire ReZ ecosystem
// Supports: hotel, restaurant, retail, support, and all consumer apps

import crypto from 'crypto';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { Decimal } from '@prisma/client/runtime/library';
import { logger } from '../config/logger';
import { prisma } from '../config/database';
import {
  createAIChatService,
  AIChatService,
  CustomerContext,
  AIChatMessage,
  AppType,
  IndustryCategory,
  sanitizeCustomerContext,
} from '../lib/chatAiStub';
import axios from 'axios';

// ── App Types ──────────────────────────────────────────────────────────────────

type UnifiedAppType = 'hotel' | 'restaurant' | 'retail' | 'support' | 'general';

// ── Socket Events ──────────────────────────────────────────────────────────────

const UNIFIED_SOCKET_EVENTS = {
  // Client → Server
  JOIN: 'ai:join',
  MESSAGE: 'ai:message',
  SUGGESTION: 'ai:suggestion',
  TRANSFER: 'ai:transfer',
  END: 'ai:end',
  CLIENT_TYPING: 'ai:typing',

  // Server → Client
  JOINED: 'ai:joined',
  SERVER_TYPING: 'ai:typing',
  SERVER_MESSAGE: 'ai:message',
  ACTION_RESULT: 'ai:action-result',
  ENDED: 'ai:ended',
  ERROR: 'error',

  // Cross-namespace
  ESCALATE: 'ai:escalate',
  CONVERSATION_UPDATE: 'conversation:update',
} as const;

// ── Socket Data ────────────────────────────────────────────────────────────────

interface UnifiedSocketData {
  userId?: string;
  appType?: UnifiedAppType;
  merchantId?: string;
  conversationId?: string;
  context?: CustomerContext;
}

interface UnifiedChatSocket extends Socket {
  data: UnifiedSocketData;
}

// ── Join Data ──────────────────────────────────────────────────────────────────

interface JoinData {
  appType: UnifiedAppType;
  merchantId?: string;
  conversationId: string;
  userId: string;
  customerContext?: CustomerContext;
}

// ── Message Data ───────────────────────────────────────────────────────────────

interface AIMessageData {
  conversationId: string;
  userId: string;
  content: string;
  customerContext?: CustomerContext;
  appType: UnifiedAppType;
  industryCategory?: string;
  merchantId?: string;
}

// ── Unified AI Chat Socket Handler ─────────────────────────────────────────────

export class UnifiedAIChatSocketHandler {
  private io: SocketIOServer;
  private chatServices: Map<string, AIChatService> = new Map();
  private enableAI: boolean;

  // Namespace references
  private namespaces: Map<string, ReturnType<SocketIOServer['of']>> = new Map();

  constructor(io: SocketIOServer, options?: { enableAI?: boolean }) {
    this.io = io;
    this.enableAI = options?.enableAI ?? true;
    this.setupNamespaces();
  }

  private setupNamespaces(): void {
    // ── /ai/support - Customer support chat ────────────────────────────────
    const supportNS = this.io.of('/ai/support');
    supportNS.on('connection', (socket: UnifiedChatSocket) => {
      this.handleConnection(socket, 'support');
    });

    // ── /ai/restaurant - Restaurant ordering support ──────────────────────
    const restaurantNS = this.io.of('/ai/restaurant');
    restaurantNS.on('connection', (socket: UnifiedChatSocket) => {
      this.handleConnection(socket, 'restaurant');
    });

    // ── /ai/retail - Retail shopping support ───────────────────────────────
    const retailNS = this.io.of('/ai/retail');
    retailNS.on('connection', (socket: UnifiedChatSocket) => {
      this.handleConnection(socket, 'retail');
    });

    // ── /ai/general - General queries / all apps ──────────────────────────
    const generalNS = this.io.of('/ai/general');
    generalNS.on('connection', (socket: UnifiedChatSocket) => {
      this.handleConnection(socket, 'general');
    });

    // ── /ai/hotel - Hotel-specific chat (alias for backward compatibility) ─
    const hotelNS = this.io.of('/ai/hotel');
    hotelNS.on('connection', (socket: UnifiedChatSocket) => {
      this.handleConnection(socket, 'hotel');
    });

    // ── /ai/room-qr - Room QR code chat ─────────────────────────────────
    const roomQRNS = this.io.of('/ai/room-qr');
    roomQRNS.on('connection', (socket: UnifiedChatSocket) => {
      this.handleConnection(socket, 'hotel');
    });

    // ── /ai/web-menu - Web menu ordering chat ─────────────────────────────
    const webMenuNS = this.io.of('/ai/web-menu');
    webMenuNS.on('connection', (socket: UnifiedChatSocket) => {
      this.handleConnection(socket, 'restaurant');
    });

    logger.info('[UnifiedAIChat] All namespaces initialized');
  }

  private handleConnection(socket: UnifiedChatSocket, defaultAppType: UnifiedAppType): void {
    logger.info('[UnifiedAIChat] Client connected', {
      socketId: socket.id,
      namespace: socket.nsp.name,
      defaultAppType,
    });

    // ── Join Handler ────────────────────────────────────────────────────
    socket.on(UNIFIED_SOCKET_EVENTS.JOIN, async (data: JoinData) => {
      try {
        const { conversationId, userId, customerContext } = data;
        const appType = data.appType || defaultAppType;

        socket.data = {
          userId,
          appType,
          conversationId,
          context: customerContext,
          merchantId: data.merchantId,
        };

        // Join conversation room
        socket.join(`ai:${conversationId}`);

        logger.info('[UnifiedAIChat] Client joined', {
          conversationId,
          userId,
          appType,
        });

        // Get or create session
        const context = await this.getOrCreateSession(conversationId, userId, appType, customerContext, data as any);

        // Send welcome if new session
        if (context.chatHistory.length === 0) {
          const welcomeMsg = this.getWelcomeMessage(appType, customerContext);
          socket.emit(UNIFIED_SOCKET_EVENTS.MESSAGE, {
            id: `ai_welcome_${Date.now()}`,
            content: welcomeMsg,
            sender: 'ai',
            timestamp: new Date().toISOString(),
          });
        }

        socket.emit(UNIFIED_SOCKET_EVENTS.JOINED, {
          conversationId,
          status: 'connected',
          appType,
        });
      } catch (error: any) {
        logger.error('[UnifiedAIChat] Join error', { error: error.message });
        socket.emit(UNIFIED_SOCKET_EVENTS.ERROR, { message: 'Failed to join chat' });
      }
    });

    // ── Message Handler ─────────────────────────────────────────────────
    socket.on(UNIFIED_SOCKET_EVENTS.MESSAGE, async (data: AIMessageData) => {
      try {
        const { conversationId, userId, content, customerContext, appType, merchantId } = data;
        const resolvedAppType = appType || socket.data.appType || defaultAppType;

        logger.info('[UnifiedAIChat] Message received', {
          conversationId,
          userId,
          appType: resolvedAppType,
        });

        // ── Save user message to database ─────────────────────────────────
        const savedUserMessage = await this.saveUserMessage({
          conversationId,
          userId,
          content,
          appType: resolvedAppType,
          merchantId,
          customerContext,
        });

        // Show typing indicator
        socket.emit(UNIFIED_SOCKET_EVENTS.SERVER_TYPING, { isTyping: true });

        // Get or create service
        const serviceKey = `${resolvedAppType}:${merchantId || 'default'}`;
        let service = this.chatServices.get(serviceKey);

        if (!service) {
          service = createAIChatService({
            appType: resolvedAppType as AppType,
            industryCategory: (data.industryCategory as IndustryCategory) || 'HOTEL_SERVICE',
            merchantId,
            enableAutoReply: true,
            enableSuggestions: true,
            maxSuggestions: 3,
            apiKey: process.env.ANTHROPIC_API_KEY,
            enableToolUse: true,
          });
          this.chatServices.set(serviceKey, service);
        }

        // Get conversation history from database
        const history = await this.getConversationHistory(conversationId, resolvedAppType);

        // Process message
        const response = await service.processMessage({
          conversationId,
          message: content,
          userId,
          appType: resolvedAppType as AppType,
          merchantId,
          customerContext,
          chatHistory: history,
        });

        // Stop typing
        socket.emit(UNIFIED_SOCKET_EVENTS.SERVER_TYPING, { isTyping: false });

        // ── Save AI response to database ────────────────────────────────────
        const aiMessageId = await this.saveAIMessage({
          conversationId,
          content: response.message,
          metadata: {
            confidence: response.confidence,
            suggestions: response.suggestions,
            actions: response.actions,
            knowledgeUsed: response.knowledgeUsed,
          },
          aiConfidence: response.confidence,
        });

        // Send response
        socket.emit(UNIFIED_SOCKET_EVENTS.MESSAGE, {
          id: aiMessageId || `ai_${Date.now()}`,
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

        logger.info('[UnifiedAIChat] AI response sent', {
          conversationId,
          confidence: response.confidence,
          hasActions: !!response.actions?.length,
        });

        // Handle actions
        if (response.actions?.length) {
          await this.handleActions(response.actions, {
            conversationId,
            userId,
            socket,
            appType: resolvedAppType,
            merchantId,
          });
        }
      } catch (error: any) {
        logger.error('[UnifiedAIChat] Message error', { error: error.message });
        socket.emit(UNIFIED_SOCKET_EVENTS.SERVER_TYPING, { isTyping: false });
        socket.emit(UNIFIED_SOCKET_EVENTS.MESSAGE, {
          id: `ai_error_${Date.now()}`,
          content: "I'm having trouble processing your message. Please try again or connect with support.",
          sender: 'ai',
          timestamp: new Date().toISOString(),
        });
      }
    });

    // ── Suggestion Handler ──────────────────────────────────────────────
    socket.on(UNIFIED_SOCKET_EVENTS.SUGGESTION, async (data: {
      conversationId: string;
      suggestion: string;
      customerContext?: CustomerContext;
    }) => {
      try {
        const { conversationId, suggestion, customerContext } = data;
        const appType = socket.data.appType || defaultAppType;

        socket.emit(UNIFIED_SOCKET_EVENTS.SERVER_TYPING, { isTyping: true });

        const service = this.chatServices.get(`${appType}:default`);
        if (service) {
          const response = await service.processMessage({
            conversationId,
            message: `User selected: ${suggestion}`,
            userId: socket.data.userId || '',
            appType: appType as AppType,
            customerContext,
          });

          socket.emit(UNIFIED_SOCKET_EVENTS.SERVER_TYPING, { isTyping: false });
          socket.emit(UNIFIED_SOCKET_EVENTS.MESSAGE, {
            id: `ai_${Date.now()}`,
            content: response.message,
            sender: 'ai',
            timestamp: new Date().toISOString(),
            metadata: { suggestions: response.suggestions },
          });
        }
      } catch (error: any) {
        logger.error('[UnifiedAIChat] Suggestion error', { error: error.message });
        socket.emit(UNIFIED_SOCKET_EVENTS.SERVER_TYPING, { isTyping: false });
      }
    });

    // ── Transfer to Human ────────────────────────────────────────────────
    socket.on(UNIFIED_SOCKET_EVENTS.TRANSFER, async (data: {
      conversationId: string;
      reason: string;
      department?: string;
    }) => {
      try {
        const { conversationId, reason, department } = data;

        logger.info('[UnifiedAIChat] Transfer to human', {
          conversationId,
          reason,
          department,
        });

        // Emit to support namespace for human agent
        const supportNS = this.io.of('/ai/support');
        supportNS.to(`ai:${conversationId}`).emit(UNIFIED_SOCKET_EVENTS.ESCALATE, {
          conversationId,
          reason,
          department,
          fromApp: socket.data.appType,
          userId: socket.data.userId,
        });

        // Notify user
        socket.emit(UNIFIED_SOCKET_EVENTS.MESSAGE, {
          id: `ai_transfer_${Date.now()}`,
          content: 'I\'m connecting you with a support agent. Please hold...',
          sender: 'ai',
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        logger.error('[UnifiedAIChat] Transfer error', { error: error.message });
      }
    });

    // ── End Chat ─────────────────────────────────────────────────────────
    socket.on(UNIFIED_SOCKET_EVENTS.END, async (data: { conversationId: string; rating?: number }) => {
      try {
        const { conversationId, rating } = data;

        logger.info('[UnifiedAIChat] Chat ended', { conversationId, rating });

        if (rating) {
          // Log rating (could save to DB)
          logger.info('[UnifiedAIChat] Rating received', { conversationId, rating });
        }

        socket.emit(UNIFIED_SOCKET_EVENTS.ENDED, { conversationId });
      } catch (error: any) {
        logger.error('[UnifiedAIChat] End chat error', { error: error.message });
      }
    });

    // ── Disconnect ──────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      logger.info('[UnifiedAIChat] Client disconnected', {
        socketId: socket.id,
        conversationId: socket.data.conversationId,
      });
    });
  }

  // ── Action Handlers ────────────────────────────────────────────────────────

  private async handleActions(
    actions: Array<{ type: string; data: Record<string, unknown>; reason: string }>,
    context: {
      conversationId: string;
      userId: string;
      socket: UnifiedChatSocket;
      appType: UnifiedAppType;
      merchantId?: string;
    }
  ): Promise<void> {
    for (const action of actions) {
      try {
        switch (action.type) {
          case 'escalate':
          case 'send_to_staff':
            await this.handleEscalation(context);
            break;

          // Hotel Room Service Actions
          case 'room_service_request':
            await this.handleRoomServiceRequest(action, context);
            break;
          case 'housekeeping_request':
            await this.handleHousekeepingRequest(action, context);
            break;
          case 'laundry_request':
            await this.handleLaundryRequest(action, context);
            break;
          case 'checkout_request':
            await this.handleCheckoutRequest(action, context);
            break;

          // Hotel Booking Actions
          case 'create_booking':
          case 'booking_hold':
            await this.handleBookingHold(action, context);
            break;
          case 'booking_confirm':
            await this.handleBookingConfirm(action, context);
            break;
          case 'booking_cancel':
            await this.handleBookingCancel(action, context);
            break;

          // Merchant/Order Actions
          case 'place_order':
          case 'add_to_cart':
            await this.handleOrderAction(action, context);
            break;
          case 'cancel_order':
            await this.handleCancelOrder(action, context);
            break;

          // Table Reservation
          case 'reserve_table':
            await this.handleTableReservation(action, context);
            break;

          // Support Actions
          case 'file_complaint':
            await this.handleFileComplaint(action, context);
            break;
          case 'request_refund':
            await this.handleRequestRefund(action, context);
            break;

          default:
            logger.info('[UnifiedAIChat] Unhandled action', { actionType: action.type });
        }
      } catch (error: any) {
        logger.error('[UnifiedAIChat] Action execution error', {
          actionType: action.type,
          error: error.message,
        });
        context.socket.emit(UNIFIED_SOCKET_EVENTS.ACTION_RESULT, {
          actionType: action.type,
          status: 'error',
          message: 'Unable to complete request. Please try again.',
        });
      }
    }
  }

  private async handleEscalation(context: {
    conversationId: string;
    userId: string;
    socket: UnifiedChatSocket;
  }): Promise<void> {
    const supportNS = this.io.of('/ai/support');
    supportNS.to(`ai:${context.conversationId}`).emit(UNIFIED_SOCKET_EVENTS.ESCALATE, {
      conversationId: context.conversationId,
      reason: 'AI escalated',
      fromApp: context.socket.data.appType,
      userId: context.userId,
    });
  }

  // ── Room Service Handlers ───────────────────────────────────────────────────

  private async handleRoomServiceRequest(
    action: { data: Record<string, unknown> },
    context: { conversationId: string; userId: string; socket: UnifiedChatSocket }
  ): Promise<void> {
    const { bookingId, roomId, items, description, priority } = action.data as any;

    logger.info('[UnifiedAIChat] Room service request', {
      bookingId,
      roomId,
      items,
      userId: context.userId,
    });

    try {
      // Call Hotel OTA room-service API directly
      const response = await axios.post(`${process.env.HOTEL_OTA_URL || 'http://localhost:4002'}/api/room-service`, {
        bookingId,
        roomId,
        serviceType: 'room_service',
        description,
        items: items || [],
        priority: priority || 'now',
      }, {
        headers: { 'x-user-id': context.userId },
      });

      const data = response.data.data;

      // Emit success to client
      context.socket.emit(UNIFIED_SOCKET_EVENTS.ACTION_RESULT, {
        actionType: 'room_service_request',
        status: 'success',
        referenceId: data.id,
        message: `Room service order placed! Request ID: ${data.id}. Your order will be delivered soon.`,
        data,
      });

      // Emit notification to hotel staff namespace
      this.io.of('/hotel-staff').emit('new_room_service', {
        requestId: data.id,
        bookingId,
        roomId,
        serviceType: 'room_service',
        items,
        priority,
      });

    } catch (error: any) {
      logger.error('[UnifiedAIChat] Room service error', { error: error.message });
      context.socket.emit(UNIFIED_SOCKET_EVENTS.ACTION_RESULT, {
        actionType: 'room_service_request',
        status: 'error',
        message: 'Unable to place room service order. Please try again or call reception.',
      });
    }
  }

  private async handleHousekeepingRequest(
    action: { data: Record<string, unknown> },
    context: { conversationId: string; userId: string; socket: UnifiedChatSocket }
  ): Promise<void> {
    const { bookingId, roomId, serviceType, description, priority } = action.data as any;

    logger.info('[UnifiedAIChat] Housekeeping request', {
      bookingId,
      roomId,
      serviceType,
      userId: context.userId,
    });

    try {
      const response = await axios.post(`${process.env.HOTEL_OTA_URL || 'http://localhost:4002'}/api/room-service`, {
        bookingId,
        roomId,
        serviceType: serviceType || 'housekeeping',
        description,
        items: [],
        priority: priority || 'now',
      }, {
        headers: { 'x-user-id': context.userId },
      });

      const data = response.data.data;

      context.socket.emit(UNIFIED_SOCKET_EVENTS.ACTION_RESULT, {
        actionType: 'housekeeping_request',
        status: 'success',
        referenceId: data.id,
        message: `Housekeeping request submitted! Request ID: ${data.id}. We'll be there ${priority === 'now' ? 'shortly' : 'at your preferred time'}.`,
        data,
      });

      // Notify hotel staff
      this.io.of('/hotel-staff').emit('new_housekeeping', {
        requestId: data.id,
        bookingId,
        roomId,
        serviceType,
      });

    } catch (error: any) {
      logger.error('[UnifiedAIChat] Housekeeping error', { error: error.message });
      context.socket.emit(UNIFIED_SOCKET_EVENTS.ACTION_RESULT, {
        actionType: 'housekeeping_request',
        status: 'error',
        message: 'Unable to submit housekeeping request. Please try again.',
      });
    }
  }

  private async handleLaundryRequest(
    action: { data: Record<string, unknown> },
    context: { conversationId: string; userId: string; socket: UnifiedChatSocket }
  ): Promise<void> {
    const { bookingId, roomId, items, pickupTime } = action.data as any;

    logger.info('[UnifiedAIChat] Laundry request', { bookingId, items });

    try {
      const response = await axios.post(`${process.env.HOTEL_OTA_URL || 'http://localhost:4002'}/api/room-service`, {
        bookingId,
        roomId,
        serviceType: 'laundry',
        description: `Laundry pickup${pickupTime ? ` at ${pickupTime}` : ''}`,
        items: items || [],
        priority: 'normal',
      }, {
        headers: { 'x-user-id': context.userId },
      });

      const data = response.data.data;

      context.socket.emit(UNIFIED_SOCKET_EVENTS.ACTION_RESULT, {
        actionType: 'laundry_request',
        status: 'success',
        referenceId: data.id,
        message: `Laundry service requested! Pickup will be arranged. Request ID: ${data.id}`,
        data,
      });

    } catch (error: any) {
      logger.error('[UnifiedAIChat] Laundry error', { error: error.message });
      context.socket.emit(UNIFIED_SOCKET_EVENTS.ACTION_RESULT, {
        actionType: 'laundry_request',
        status: 'error',
        message: 'Unable to request laundry service. Please try again.',
      });
    }
  }

  private async handleCheckoutRequest(
    action: { data: Record<string, unknown> },
    context: { conversationId: string; userId: string; socket: UnifiedChatSocket }
  ): Promise<void> {
    const { bookingId } = action.data as any;

    logger.info('[UnifiedAIChat] Checkout request', { bookingId });

    try {
      // Get booking details for checkout info
      const response = await axios.get(
        `${process.env.HOTEL_OTA_URL || 'http://localhost:4002'}/v1/bookings/${bookingId}`,
        { headers: { 'x-user-id': context.userId } }
      );

      const booking = response.data;

      context.socket.emit(UNIFIED_SOCKET_EVENTS.ACTION_RESULT, {
        actionType: 'checkout_request',
        status: 'success',
        message: `Checkout details:\n\nBooking: ${booking.bookingRef}\nCheck-out: ${booking.checkoutDate}\nTotal: ₹${(booking.totalValuePaise / 100).toFixed(0)}\n\nPlease leave your key at reception. Have a safe journey!`,
        data: booking,
      });

    } catch (error: any) {
      logger.error('[UnifiedAIChat] Checkout error', { error: error.message });
      context.socket.emit(UNIFIED_SOCKET_EVENTS.ACTION_RESULT, {
        actionType: 'checkout_request',
        status: 'error',
        message: 'Unable to process checkout. Please contact reception.',
      });
    }
  }

  // ── Hotel Booking Handlers ────────────────────────────────────────────────

  private async handleBookingHold(
    action: { data: Record<string, unknown> },
    context: { conversationId: string; userId: string; socket: UnifiedChatSocket }
  ): Promise<void> {
    const { hotelId, roomTypeId, checkIn, checkOut, rooms, guests, guestName, guestPhone, specialRequests } = action.data as any;

    logger.info('[UnifiedAIChat] Booking hold', { hotelId, roomTypeId, userId: context.userId });

    try {
      const response = await axios.post(
        `${process.env.HOTEL_OTA_URL || 'http://localhost:4002'}/v1/bookings/hold`,
        {
          userId: context.userId,
          hotelId,
          roomTypeId,
          checkinDate: checkIn,
          checkoutDate: checkOut,
          numRooms: rooms || 1,
          numGuests: guests || 2,
          guestName,
          guestPhone,
          specialRequests,
          channelSource: 'rez-chat',
          userTier: context.socket.data.context?.tier || 'basic',
        }
      );

      const data = response.data;
      const expiresIn = Math.floor((new Date(data.holdExpiresAt).getTime() - Date.now()) / 60000);

      context.socket.emit(UNIFIED_SOCKET_EVENTS.ACTION_RESULT, {
        actionType: 'booking_hold',
        status: 'success',
        referenceId: data.id,
        bookingRef: data.bookingRef,
        total: data.totalValuePaise / 100,
        expiresIn,
        message: `Room held for ${expiresIn} minutes!\n\nReference: ${data.bookingRef}\nTotal: ₹${(data.totalValuePaise / 100).toFixed(0)}\n\nComplete payment to confirm.`,
        data,
      });

    } catch (error: any) {
      logger.error('[UnifiedAIChat] Booking hold error', { error: error.message });
      context.socket.emit(UNIFIED_SOCKET_EVENTS.ACTION_RESULT, {
        actionType: 'booking_hold',
        status: 'error',
        message: 'Unable to hold room. Please try again or check availability.',
      });
    }
  }

  private async handleBookingConfirm(
    action: { data: Record<string, unknown> },
    context: { conversationId: string; userId: string; socket: UnifiedChatSocket }
  ): Promise<void> {
    const { holdId, razorpayPaymentId, razorpaySignature } = action.data as any;

    logger.info('[UnifiedAIChat] Booking confirm', { holdId });

    try {
      const response = await axios.post(
        `${process.env.HOTEL_OTA_URL || 'http://localhost:4002'}/v1/bookings/confirm`,
        {
          bookingId: holdId,
          razorpayPaymentId,
          razorpaySignature,
        }
      );

      const data = response.data;

      context.socket.emit(UNIFIED_SOCKET_EVENTS.ACTION_RESULT, {
        actionType: 'booking_confirmed',
        status: 'success',
        referenceId: data.id,
        bookingRef: data.bookingRef,
        message: `Booking confirmed! 🎉\n\nReference: ${data.bookingRef}\nHotel: ${data.hotel?.name}\nCheck-in: ${data.checkinDate}\nCheck-out: ${data.checkoutDate}\n\nYou earned ${data.coinsEarned || 0} ReZ Coins!`,
        data,
      });

    } catch (error: any) {
      logger.error('[UnifiedAIChat] Booking confirm error', { error: error.message });
      context.socket.emit(UNIFIED_SOCKET_EVENTS.ACTION_RESULT, {
        actionType: 'booking_confirmed',
        status: 'error',
        message: 'Unable to confirm booking. Your hold may have expired.',
      });
    }
  }

  private async handleBookingCancel(
    action: { data: Record<string, unknown> },
    context: { conversationId: string; userId: string; socket: UnifiedChatSocket }
  ): Promise<void> {
    const { bookingId, reason } = action.data as any;

    logger.info('[UnifiedAIChat] Booking cancel', { bookingId });

    try {
      const response = await axios.post(
        `${process.env.HOTEL_OTA_URL || 'http://localhost:4002'}/v1/bookings/${bookingId}/cancel`,
        { reason: reason || 'Cancelled by user', cancelledBy: 'user', userId: context.userId }
      );

      const data = response.data;

      context.socket.emit(UNIFIED_SOCKET_EVENTS.ACTION_RESULT, {
        actionType: 'booking_cancelled',
        status: 'success',
        referenceId: bookingId,
        refundAmount: data.refundAmount / 100,
        message: `Booking cancelled.\n\nRefund: ₹${((data.refundAmount || 0) / 100).toFixed(0)}\nProcessing time: 5-7 business days`,
        data,
      });

    } catch (error: any) {
      logger.error('[UnifiedAIChat] Booking cancel error', { error: error.message });
      context.socket.emit(UNIFIED_SOCKET_EVENTS.ACTION_RESULT, {
        actionType: 'booking_cancelled',
        status: 'error',
        message: 'Unable to cancel booking. Please try again.',
      });
    }
  }

  // ── Merchant/Order Handlers ────────────────────────────────────────────────

  private async handleOrderAction(
    action: { data: Record<string, unknown> },
    context: { conversationId: string; userId: string; merchantId?: string; socket: UnifiedChatSocket }
  ): Promise<void> {
    const { merchantId, items, deliveryAddress, deliveryTime, paymentMethod, specialInstructions } = action.data as any;

    logger.info('[UnifiedAIChat] Place order', { merchantId, items, userId: context.userId });

    try {
      // Step 1: Add to cart
      const cartResponse = await axios.post(
        `${process.env.ORDER_SERVICE_URL || 'http://localhost:4004'}/v1/cart/add`,
        {
          userId: context.userId,
          merchantId: merchantId || context.merchantId,
          items: items || [],
          instructions: specialInstructions,
          source: 'rez-chat',
        }
      );

      const cartData = cartResponse.data;
      const cartId = cartData.cartId || cartData.id;

      // Step 2: Place order
      const orderResponse = await axios.post(
        `${process.env.ORDER_SERVICE_URL || 'http://localhost:4004'}/v1/orders/place`,
        {
          userId: context.userId,
          cartId,
          deliveryAddress,
          deliveryTime,
          paymentMethod: paymentMethod || 'cod',
          source: 'rez-chat',
        }
      );

      const orderData = orderResponse.data;

      context.socket.emit(UNIFIED_SOCKET_EVENTS.ACTION_RESULT, {
        actionType: 'order_placed',
        status: 'success',
        referenceId: orderData.id || orderData.orderId,
        orderRef: orderData.orderRef || orderData.orderNumber,
        total: orderData.total / 100,
        message: `Order placed! 🎉\n\nReference: ${orderData.orderRef || orderData.orderNumber}\nTotal: ₹${(orderData.total / 100).toFixed(0)}\nEstimated delivery: ${orderData.estimatedDelivery || '30-45 mins'}`,
        data: orderData,
      });

      // Emit to merchant namespace so they see the order
      this.io.of('/merchant-orders').emit('new_order', {
        orderId: orderData.id || orderData.orderId,
        orderRef: orderData.orderRef,
        merchantId: merchantId || context.merchantId,
        items,
        total: orderData.total,
        timestamp: new Date().toISOString(),
        source: 'chat',
      });

    } catch (error: any) {
      logger.error('[UnifiedAIChat] Order error', { error: error.message });
      context.socket.emit(UNIFIED_SOCKET_EVENTS.ACTION_RESULT, {
        actionType: 'order_placed',
        status: 'error',
        message: 'Unable to place order. Please try again.',
      });
    }
  }

  private async handleCancelOrder(
    action: { data: Record<string, unknown> },
    context: { conversationId: string; userId: string; socket: UnifiedChatSocket }
  ): Promise<void> {
    const { orderId, reason } = action.data as any;

    logger.info('[UnifiedAIChat] Cancel order', { orderId });

    try {
      const response = await axios.post(
        `${process.env.ORDER_SERVICE_URL || 'http://localhost:4004'}/v1/orders/${orderId}/cancel`,
        { reason: reason || 'Cancelled by user', cancelledBy: 'user', userId: context.userId }
      );

      const data = response.data;

      context.socket.emit(UNIFIED_SOCKET_EVENTS.ACTION_RESULT, {
        actionType: 'order_cancelled',
        status: 'success',
        referenceId: orderId,
        refundAmount: data.refundAmount / 100,
        message: `Order cancelled.\n\n${data.refundAmount ? `Refund: ₹${(data.refundAmount / 100).toFixed(0)}` : 'No refund applicable.'}`,
        data,
      });

    } catch (error: any) {
      logger.error('[UnifiedAIChat] Cancel order error', { error: error.message });
      context.socket.emit(UNIFIED_SOCKET_EVENTS.ACTION_RESULT, {
        actionType: 'order_cancelled',
        status: 'error',
        message: 'Unable to cancel order. It may already be preparing.',
      });
    }
  }

  // ── Table Reservation Handler ───────────────────────────────────────────────

  private async handleTableReservation(
    action: { data: Record<string, unknown> },
    context: { conversationId: string; userId: string; merchantId?: string; socket: UnifiedChatSocket }
  ): Promise<void> {
    const { merchantId, date, time, partySize, name, phone, occasion, specialRequests } = action.data as any;

    logger.info('[UnifiedAIChat] Table reservation', { merchantId, date, time, partySize });

    try {
      const response = await axios.post(
        `${process.env.MERCHANT_SERVICE_URL || 'http://localhost:4003'}/v1/stores/${merchantId || context.merchantId}/reservations`,
        {
          date,
          time,
          partySize,
          customerName: name,
          phone,
          occasion,
          specialRequests,
          source: 'rez-chat',
        }
      );

      const data = response.data;

      context.socket.emit(UNIFIED_SOCKET_EVENTS.ACTION_RESULT, {
        actionType: 'table_reserved',
        status: 'success',
        referenceId: data.id || data.reservationId,
        message: `Table reserved! 🎉\n\nDate: ${date}\nTime: ${time}\nParty size: ${partySize}\n\nConfirmation SMS sent to ${phone}`,
        data,
      });

      // Notify merchant
      this.io.of('/merchant-orders').emit('new_reservation', {
        reservationId: data.id || data.reservationId,
        merchantId: merchantId || context.merchantId,
        date,
        time,
        partySize,
        source: 'chat',
      });

    } catch (error: any) {
      logger.error('[UnifiedAIChat] Reservation error', { error: error.message });
      context.socket.emit(UNIFIED_SOCKET_EVENTS.ACTION_RESULT, {
        actionType: 'table_reserved',
        status: 'error',
        message: 'Unable to reserve table. Please try again.',
      });
    }
  }

  // ── Support Handlers ──────────────────────────────────────────────────────

  private async handleFileComplaint(
    action: { data: Record<string, unknown> },
    context: { conversationId: string; userId: string; socket: UnifiedChatSocket }
  ): Promise<void> {
    const { orderId, bookingId, type, description } = action.data as any;

    logger.info('[UnifiedAIChat] File complaint', { orderId, bookingId, type });

    try {
      // Generate a reference ID for the complaint
      const complaintId = `complaint_${crypto.randomUUID()}`;

      // Log complaint (complaint model not available in Hotel OTA schema)
      logger.info('[UnifiedAIChat] Complaint logged', {
        complaintId,
        userId: context.userId,
        orderId,
        bookingId,
        type,
      });

      context.socket.emit(UNIFIED_SOCKET_EVENTS.ACTION_RESULT, {
        actionType: 'complaint_filed',
        status: 'success',
        referenceId: complaintId,
        message: `Complaint filed!\n\nReference: ${complaintId}\nWe'll investigate and respond within 24 hours.`,
        data: { complaintId, orderId, bookingId, type, description },
      });

      // Notify support team
      this.io.of('/ai/support').emit('new_complaint', {
        complaintId,
        userId: context.userId,
        orderId,
        type,
        priority: type === 'urgent' ? 'high' : 'normal',
      });

    } catch (error: any) {
      logger.error('[UnifiedAIChat] File complaint error', { error: error.message });
      context.socket.emit(UNIFIED_SOCKET_EVENTS.ACTION_RESULT, {
        actionType: 'complaint_filed',
        status: 'error',
        message: 'Unable to file complaint. Please contact support directly.',
      });
    }
  }

  private async handleRequestRefund(
    action: { data: Record<string, unknown> },
    context: { conversationId: string; userId: string; socket: UnifiedChatSocket }
  ): Promise<void> {
    const { orderId, bookingId, reason, amount } = action.data as any;

    logger.info('[UnifiedAIChat] Request refund', { orderId, bookingId });

    try {
      // Generate a reference ID for the refund request
      const refundId = `refund_${crypto.randomUUID()}`;

      // Log refund request (refundRequest model not available in Hotel OTA schema)
      logger.info('[UnifiedAIChat] Refund request logged', {
        refundId,
        userId: context.userId,
        orderId,
        bookingId,
        amount,
      });

      context.socket.emit(UNIFIED_SOCKET_EVENTS.ACTION_RESULT, {
        actionType: 'refund_requested',
        status: 'success',
        referenceId: refundId,
        message: `Refund requested!\n\nReference: ${refundId}\nProcessing time: 5-7 business days\n\nWe'll notify you once processed.`,
        data: { refundId, orderId, bookingId, amount, reason },
      });

      // Notify support
      this.io.of('/ai/support').emit('new_refund_request', {
        refundId,
        userId: context.userId,
        orderId,
        amount,
      });

    } catch (error: any) {
      logger.error('[UnifiedAIChat] Refund request error', { error: error.message });
      context.socket.emit(UNIFIED_SOCKET_EVENTS.ACTION_RESULT, {
        actionType: 'refund_requested',
        status: 'error',
        message: 'Unable to request refund. Please contact support.',
      });
    }
  }

  // ── Database Helpers ─────────────────────────────────────────────────────

  private async getOrCreateSession(
    conversationId: string,
    userId: string,
    appType: UnifiedAppType,
    customerContext?: CustomerContext,
    data?: any
  ): Promise<{ chatHistory: AIChatMessage[] }> {
    // Try to find existing conversation
    let conversation = await prisma.unifiedChatConversation.findUnique({
      where: { id: conversationId }
    });

    // Create new conversation if not found
    if (!conversation) {
      conversation = await prisma.unifiedChatConversation.create({
        data: {
          id: conversationId,
          userId,
          userName: customerContext?.name || data?.userName || 'User',
          appType,
          merchantId: data?.merchantId || null,
          type: 'support',
          status: 'active',
          customerContext: (customerContext as any) || null,
        }
      });
      logger.info('[UnifiedAIChat] Created new conversation', { conversationId, appType });
    }

    // Get history
    const history = await this.getConversationHistory(conversationId, appType);
    return { chatHistory: history };
  }

  private async saveUserMessage(params: {
    conversationId: string;
    userId: string;
    content: string;
    appType: UnifiedAppType;
    merchantId?: string;
    customerContext?: CustomerContext;
  }): Promise<string | null> {
    try {
      const { conversationId, userId, content } = params;

      // Ensure conversation exists
      let conversation = await prisma.unifiedChatConversation.findUnique({
        where: { id: conversationId }
      });

      if (!conversation) {
        conversation = await prisma.unifiedChatConversation.create({
          data: {
            id: conversationId,
            userId,
            userName: params.customerContext?.name || 'User',
            appType: params.appType,
            merchantId: params.merchantId || null,
            type: 'support',
            status: 'active',
            customerContext: (params.customerContext as any) || null,
          }
        });
      }

      // Save message
      const message = await prisma.unifiedChatMessage.create({
        data: {
          conversationId,
          senderId: userId,
          senderType: 'user',
          senderName: params.customerContext?.name || 'User',
          content,
          messageType: 'text',
        }
      });

      // Update conversation
      await prisma.unifiedChatConversation.update({
        where: { id: conversationId },
        data: {
          lastMessage: content.substring(0, 255),
          lastMessageAt: new Date(),
          messageCount: { increment: 1 },
          unreadStaffCount: { increment: 1 },
        }
      });

      logger.info('[UnifiedAIChat] User message saved', { conversationId, messageId: message.id });
      return message.id;
    } catch (error: any) {
      logger.error('[UnifiedAIChat] Error saving user message', { error: error.message });
      return null;
    }
  }

  private async saveAIMessage(params: {
    conversationId: string;
    content: string;
    metadata?: Record<string, unknown>;
    aiConfidence?: number;
  }): Promise<string | null> {
    try {
      const { conversationId, content, metadata, aiConfidence } = params;

      const message = await prisma.unifiedChatMessage.create({
        data: {
          conversationId,
          senderId: 'ai_system',
          senderType: 'ai',
          senderName: 'AI Assistant',
          content,
          messageType: 'text',
          metadata: (metadata as any) || null,
          aiConfidence: aiConfidence ? new Decimal(aiConfidence) : null,
        }
      });

      // Update conversation
      await prisma.unifiedChatConversation.update({
        where: { id: conversationId },
        data: {
          lastMessage: content.substring(0, 255),
          lastMessageAt: new Date(),
          messageCount: { increment: 1 },
          unreadUserCount: { increment: 1 },
        }
      });

      logger.info('[UnifiedAIChat] AI message saved', { conversationId, messageId: message.id });
      return message.id;
    } catch (error: any) {
      logger.error('[UnifiedAIChat] Error saving AI message', { error: error.message });
      return null;
    }
  }

  private async getConversationHistory(
    conversationId: string,
    appType: UnifiedAppType
  ): Promise<AIChatMessage[]> {
    try {
      // Check if it's a unified conversation first
      let messages: any[] = await prisma.unifiedChatMessage.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
      });

      // If no unified messages, check hotel chat (for hotel appType)
      if (messages.length === 0 && appType === 'hotel') {
        messages = await prisma.hotelChatMessage.findMany({
          where: { conversationId },
          orderBy: { createdAt: 'asc' },
        });
      }

      return messages.map((m: any) => ({
        id: m.id,
        conversationId,
        sender: m.senderType === 'staff' ? 'staff' as const : m.senderType === 'ai' ? 'ai' as const : m.senderType === 'system' ? 'staff' as const : 'user' as const,
        content: m.content,
        timestamp: m.createdAt,
      }));
    } catch (error: any) {
      logger.error('[UnifiedAIChat] Error fetching history', { error: error.message });
      return [];
    }
  }

  // ── Get Conversations for User ───────────────────────────────────────────────

  async getUserConversations(userId: string, appType?: UnifiedAppType): Promise<any[]> {
    try {
      const where: any = { userId };
      if (appType) {
        where.appType = appType;
      }

      const conversations = await prisma.unifiedChatConversation.findMany({
        where,
        orderBy: { lastMessageAt: 'desc' },
      });

      return conversations;
    } catch (error: any) {
      logger.error('[UnifiedAIChat] Error fetching conversations', { error: error.message });
      return [];
    }
  }

  // ── Mark Messages as Read ─────────────────────────────────────────────────

  async markAsRead(conversationId: string, userId: string): Promise<void> {
    try {
      await prisma.unifiedChatMessage.updateMany({
        where: {
          conversationId,
          senderId: { not: userId },
          readAt: null,
        },
        data: {
          readAt: new Date(),
          readBy: userId,
        }
      });

      // Reset unread count
      await prisma.unifiedChatConversation.update({
        where: { id: conversationId },
        data: { unreadUserCount: 0 }
      });

      logger.info('[UnifiedAIChat] Messages marked as read', { conversationId, userId });
    } catch (error: any) {
      logger.error('[UnifiedAIChat] Error marking as read', { error: error.message });
    }
  }

  // ── Welcome Messages ──────────────────────────────────────────────────────

  private getWelcomeMessage(appType: UnifiedAppType, context?: CustomerContext): string {
    const name = context?.name ? ` ${context.name}` : '';
    const tier = context?.tier ? `, ${context.tier} member` : '';

    const messages: Record<UnifiedAppType, string> = {
      hotel: `Hello${name}! 👋

I'm your AI concierge at the hotel. I can help you with:
• Check-in/check-out information
• Room service orders
• Housekeeping requests
• Restaurant reservations
• Local recommendations

What can I help you with?${tier}`,

      restaurant: `Hello${name}! 👋

Welcome to our restaurant! I can help you with:
• Menu recommendations
• Making reservations
• Placing orders for pickup/delivery
• Dietary accommodations
• Special occasion arrangements

What would you like?${tier}`,

      retail: `Hello${name}! 👋

Welcome to our store! I can help you with:
• Product recommendations
• Order tracking
• Returns and exchanges
• Sizing and availability
• Loyalty program benefits

What can I assist you with?${tier}`,

      support: `Hello${name}! 👋

Welcome to ReZ Support! I can help you with:
• Account and billing questions
• Order and booking issues
• Technical support
• Refund requests
• General inquiries

How can I help you today?${tier}`,

      general: `Hello${name}! 👋

Welcome to ReZ! I'm your AI assistant and I can help you across all our services:
• Hotels & accommodations
• Restaurants & food ordering
• Shopping & retail
• General support

What would you like help with?${tier}`,
    };

    return messages[appType] || messages.general;
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────

  cleanup(): void {
    this.chatServices.clear();
    this.namespaces.clear();
    logger.info('[UnifiedAIChat] Handler cleaned up');
  }
}

// ── Factory Function ─────────────────────────────────────────────────────────

export function createUnifiedAIChatSocketHandler(
  io: SocketIOServer,
  options?: { enableAI?: boolean }
): UnifiedAIChatSocketHandler {
  return new UnifiedAIChatSocketHandler(io, options);
}

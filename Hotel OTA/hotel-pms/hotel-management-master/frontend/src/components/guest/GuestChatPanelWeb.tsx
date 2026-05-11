// Guest Chat Panel Web Component
// Real-time chat interface for hotel guests (web version)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Send, User, Clock, CheckCircle } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

type HotelDepartment = 'front_desk' | 'concierge' | 'housekeeping' | 'room_service' | 'maintenance' | 'spa' | 'transport';
type HotelConversationType = 'room_service' | 'concierge' | 'housekeeping' | 'maintenance' | 'spa' | 'transport' | 'general';

interface HotelMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderType: 'guest' | 'staff' | 'system';
  senderName: string;
  content: string;
  messageType: 'text' | 'image' | 'file' | 'quick_reply';
  createdAt: string | Date;
  readAt?: string | Date | null;
}

interface HotelConversation {
  id: string;
  hotelId: string;
  bookingId?: string;
  roomNumber?: string;
  type: string;
  department: HotelDepartment;
  guestUserId: string;
  guestName: string;
  staffId?: string;
  staffName?: string;
  status: 'active' | 'resolved';
  unreadGuestCount: number;
  unreadStaffCount: number;
  lastMessage?: string;
  lastMessageAt?: string | Date;
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface QuickReply {
  id: string;
  text: string;
  action: 'send_message' | 'open_url' | 'create_request';
  payload?: string;
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface GuestChatPanelWebProps {
  guestId: string;
  guestName: string;
  roomNumber?: string;
  bookingId?: string;
  hotelId?: string;
  apiBaseUrl: string;
  socketUrl?: string;
  onClose?: () => void;
}

// ── Department Config ─────────────────────────────────────────────────────────

const DEPARTMENT_LABELS: Record<HotelDepartment, string> = {
  front_desk: 'Front Desk',
  concierge: 'Concierge',
  housekeeping: 'Housekeeping',
  room_service: 'Room Service',
  maintenance: 'Maintenance',
  spa: 'Spa',
  transport: 'Transportation',
};

const DEPARTMENT_COLORS: Record<HotelDepartment, string> = {
  front_desk: 'bg-blue-100 text-blue-800',
  concierge: 'bg-purple-100 text-purple-800',
  housekeeping: 'bg-green-100 text-green-800',
  room_service: 'bg-orange-100 text-orange-800',
  maintenance: 'bg-gray-100 text-gray-800',
  spa: 'bg-pink-100 text-pink-800',
  transport: 'bg-yellow-100 text-yellow-800',
};

const QUICK_REPLIES: Record<HotelDepartment, QuickReply[]> = {
  front_desk: [
    { id: 'qr_1', text: 'Check-out time', action: 'send_message', payload: 'What is the check-out time?' },
    { id: 'qr_2', text: 'Wake-up call', action: 'send_message', payload: 'I need a wake-up call please' },
    { id: 'qr_3', text: 'Taxi service', action: 'send_message', payload: 'I need a taxi, please' },
  ],
  concierge: [
    { id: 'qr_4', text: 'Restaurant recommendations', action: 'send_message', payload: 'Can you recommend a restaurant nearby?' },
    { id: 'qr_5', text: 'Book a tour', action: 'send_message', payload: 'I would like to book a tour' },
  ],
  housekeeping: [
    { id: 'qr_6', text: 'Extra towels', action: 'send_message', payload: 'I need extra towels, please' },
    { id: 'qr_7', text: 'Room cleaning', action: 'send_message', payload: 'I would like my room cleaned' },
    { id: 'qr_8', text: 'Late checkout', action: 'send_message', payload: 'Can I have a late checkout?' },
  ],
  room_service: [
    { id: 'qr_9', text: 'View menu', action: 'send_message', payload: 'Can I see the room service menu?' },
    { id: 'qr_10', text: 'Order status', action: 'send_message', payload: 'Where is my order?' },
  ],
  maintenance: [
    { id: 'qr_11', text: 'AC not working', action: 'send_message', payload: 'The AC is not working properly' },
    { id: 'qr_12', text: 'Plumbing issue', action: 'send_message', payload: 'There is a plumbing issue in my room' },
  ],
  spa: [
    { id: 'qr_13', text: 'Book massage', action: 'send_message', payload: 'I would like to book a massage' },
    { id: 'qr_14', text: 'Spa menu', action: 'send_message', payload: 'Can I see the spa services menu?' },
  ],
  transport: [
    { id: 'qr_15', text: 'Airport pickup', action: 'send_message', payload: 'I need an airport pickup' },
    { id: 'qr_16', text: 'Rent a car', action: 'send_message', payload: 'I would like to rent a car' },
  ],
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function GuestChatPanelWeb({
  guestId,
  guestName,
  roomNumber,
  bookingId,
  hotelId,
  apiBaseUrl,
  socketUrl,
  onClose,
}: GuestChatPanelWebProps) {
  // State
  const [conversations, setConversations] = useState<HotelConversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<HotelConversation | null>(null);
  const [messages, setMessages] = useState<HotelMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [connected, setConnected] = useState(false);
  const [staffTyping, setStaffTyping] = useState(false);
  const [showDepartmentList, setShowDepartmentList] = useState(true);

  // Refs
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // ── Socket Connection ─────────────────────────────────────────────────────

  useEffect(() => {
    const baseUrl = socketUrl || apiBaseUrl;
    if (!baseUrl) return;

    const socket = io(`${baseUrl}/hotel`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      auth: { guestId, guestName, bookingId },
    });

    socket.on('connect', () => {
      setConnected(true);
      // Join as guest
      socket.emit('guest:join', {
        hotelId,
        bookingId,
        userId: guestId,
        guestName,
      });
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    // Handle new messages from staff
    socket.on('new_message', (data: { conversationId: string; message: any }) => {
      if (data.conversationId === currentConversation?.id) {
        const normalizedMessage: HotelMessage = {
          ...data.message,
          senderType: data.message.senderType,
        };
        setMessages((prev) => [...prev, normalizedMessage]);
      }
      // Refresh conversations
      loadConversations();
    });

    // Handle staff typing
    socket.on('staff_typing', (data: { conversationId: string; isTyping: boolean }) => {
      if (data.conversationId === currentConversation?.id) {
        setStaffTyping(data.isTyping);
        if (data.isTyping) {
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setStaffTyping(false), 5000);
        }
      }
    });

    // Handle staff assigned notification
    socket.on('staff_assigned', (data: { conversationId: string; staffId: string; staffName: string }) => {
      if (data.conversationId === currentConversation?.id) {
        setCurrentConversation((prev) =>
          prev ? { ...prev, staffId: data.staffId, staffName: data.staffName } : prev
        );
      }
    });

    // Handle conversation resolved
    socket.on('conversation_resolved', (data: { conversationId: string }) => {
      if (data.conversationId === currentConversation?.id) {
        setCurrentConversation((prev) =>
          prev ? { ...prev, status: 'resolved' } : prev
        );
      }
    });

    // Handle ack
    socket.on('message_ack', (data: { messageId: string; tempId: string; conversationId: string }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === data.tempId ? { ...m, id: data.messageId } : m))
      );
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [socketUrl, apiBaseUrl, guestId, guestName, bookingId, hotelId, currentConversation?.id]);

  // ── Load Conversations ────────────────────────────────────────────────────

  const loadConversations = useCallback(async () => {
    try {
      const response = await fetch(
        `${apiBaseUrl}/v1/hotel-chat/conversations?guestId=${guestId}`,
        { credentials: 'include' }
      );
      const data = await response.json();
      if (data.success && data.data?.conversations) {
        setConversations(data.data.conversations);
      }
    } catch (error) {
      console.error('[GuestChat] Error loading conversations:', error);
    }
  }, [apiBaseUrl, guestId]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // ── Load Messages ────────────────────────────────────────────────────────

  const loadMessages = useCallback(async (conversationId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `${apiBaseUrl}/v1/hotel-chat/messages?conversationId=${conversationId}`,
        { credentials: 'include' }
      );
      const data = await response.json();
      if (data.success && data.data?.messages) {
        // Normalize messages to have consistent field names
        const normalizedMessages: HotelMessage[] = data.data.messages.map((msg: any) => ({
          ...msg,
          createdAt: msg.createdAt,
        }));
        setMessages(normalizedMessages);
      }
    } catch (error) {
      console.error('[GuestChat] Error loading messages:', error);
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl]);

  // ── Start Conversation ──────────────────────────────────────────────────

  const startConversation = useCallback(async (department: HotelDepartment) => {
    setIsLoading(true);
    setShowDepartmentList(false);
    try {
      const response = await fetch(`${apiBaseUrl}/v1/hotel-chat/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          bookingId,
          roomNumber,
          department,
          guestUserId: guestId,
          guestName,
        }),
      });
      const data = await response.json();
      if (data.success && data.data?.conversation) {
        const conv = data.data.conversation;
        setConversations((prev) => [conv, ...prev]);
        setCurrentConversation(conv);
        setMessages([]);
      }
    } catch (error) {
      console.error('[GuestChat] Error starting conversation:', error);
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl, bookingId, roomNumber, guestId, guestName]);

  // ── Send Message ────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    // If no conversation, create one first
    if (!currentConversation) {
      await startConversation('front_desk');
      return;
    }

    setIsSending(true);
    const trimmedContent = content.trim();
    setInputText('');

    // Optimistic update
    const tempId = `temp_${Date.now()}`;
    const optimisticMessage: HotelMessage = {
      id: tempId,
      conversationId: currentConversation.id,
      senderId: guestId,
      senderType: 'guest',
      senderName: guestName,
      content: trimmedContent,
      messageType: 'text',
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMessage]);

    // Emit via socket
    if (socketRef.current?.connected) {
      socketRef.current.emit('guest:message', {
        hotelId,
        bookingId,
        userId: guestId,
        guestName,
        content: trimmedContent,
        tempId,
      });
    }

    // Also send via REST as fallback
    try {
      const response = await fetch(`${apiBaseUrl}/v1/hotel-chat/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          conversationId: currentConversation.id,
          content: trimmedContent,
          senderId: guestId,
          senderName: guestName,
          senderType: 'guest',
        }),
      });
      const data = await response.json();
      if (data.success && data.data?.message) {
        // Replace optimistic with real
        setMessages((prev) =>
          prev.map((m) => (m.id === tempId ? data.data.message : m))
        );
      }
    } catch (error) {
      console.error('[GuestChat] Error sending message:', error);
      // Remove optimistic on error
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInputText(trimmedContent);
    } finally {
      setIsSending(false);
    }
  }, [currentConversation, guestId, guestName, bookingId, hotelId, apiBaseUrl, startConversation]);

  // ── Quick Reply Handler ────────────────────────────────────────────────

  const handleQuickReply = useCallback((reply: QuickReply) => {
    if (reply.action === 'send_message' && reply.payload) {
      sendMessage(reply.payload);
    }
  }, [sendMessage]);

  // ── Scroll to Bottom ──────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Handle Conversation Select ────────────────────────────────────────

  const handleSelectConversation = useCallback(async (conv: HotelConversation) => {
    setCurrentConversation(conv);
    setShowDepartmentList(false);
    await loadMessages(conv.id);
  }, [loadMessages]);

  // ── Render ────────────────────────────────────────────────────────────

  const currentDept = currentConversation?.department || 'front_desk';
  const currentQuickReplies = QUICK_REPLIES[currentDept] || [];

  return (
    <div className="flex flex-col h-full bg-white rounded-lg">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50 rounded-t-lg">
        <div>
          <h3 className="font-semibold text-lg">
            {showDepartmentList ? 'Chat with Us' : DEPARTMENT_LABELS[currentDept]}
          </h3>
          <p className="text-sm text-gray-500">
            {showDepartmentList
              ? 'Select a department to start chatting'
              : currentConversation?.staffName
              ? `Connected with ${currentConversation.staffName}`
              : connected
              ? 'Connecting to staff...'
              : 'Offline'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {connected && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-1" />
              Online
            </Badge>
          )}
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Department List View */}
      {showDepartmentList ? (
        <div className="flex-1 overflow-y-auto p-4">
          {/* Active Conversations */}
          {conversations.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-500 mb-2">Your Conversations</h4>
              <div className="space-y-2">
                {conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv)}
                    className="w-full text-left p-3 rounded-lg border hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <Badge className={DEPARTMENT_COLORS[conv.department]}>
                        {DEPARTMENT_LABELS[conv.department]}
                      </Badge>
                      <span className="text-xs text-gray-400">
                        {new Date(conv.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    {conv.staffName && (
                      <p className="text-sm text-gray-600 mt-1">with {conv.staffName}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Department Selection */}
          <h4 className="text-sm font-medium text-gray-500 mb-2">Start a New Chat</h4>
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(DEPARTMENT_LABELS) as [HotelDepartment, string][]).map(
              ([dept, label]) => (
                <button
                  key={dept}
                  onClick={() => startConversation(dept)}
                  disabled={isLoading}
                  className="p-4 rounded-lg border text-left hover:bg-gray-50 hover:border-blue-300 transition-all"
                >
                  <Badge className={`mb-2 ${DEPARTMENT_COLORS[dept]}`}>{label}</Badge>
                  <p className="text-xs text-gray-500 mt-1">
                    Get help with {label.toLowerCase()}
                  </p>
                </button>
              )
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Back Button */}
          <button
            onClick={() => {
              setShowDepartmentList(true);
              setCurrentConversation(null);
            }}
            className="flex items-center gap-1 px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 border-b"
          >
            <span className="text-xl">←</span> Back to departments
          </button>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {isLoading ? (
                <div className="text-center py-8 text-gray-400">Loading messages...</div>
              ) : messages.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  No messages yet. Start the conversation!
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.senderType === 'guest' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 ${
                        msg.senderType === 'guest'
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      {msg.senderType !== 'guest' && (
                        <p className="text-xs font-medium mb-1 opacity-70">{msg.senderName}</p>
                      )}
                      <p className="text-sm">{msg.content}</p>
                      <div
                        className={`flex items-center gap-1 mt-1 text-xs ${
                          msg.senderType === 'guest' ? 'text-blue-100' : 'text-gray-400'
                        }`}
                      >
                        <Clock className="w-3 h-3" />
                        {new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {msg.senderType === 'guest' && msg.readAt && (
                          <CheckCircle className="w-3 h-3 ml-1" />
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}

              {/* Staff typing indicator */}
              {staffTyping && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-lg px-4 py-2">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.1s]" />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Quick Replies */}
          {messages.length < 3 && currentQuickReplies.length > 0 && (
            <div className="flex gap-2 p-3 border-t overflow-x-auto">
              {currentQuickReplies.map((reply) => (
                <button
                  key={reply.id}
                  onClick={() => handleQuickReply(reply)}
                  className="flex-shrink-0 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-blue-600 transition-colors"
                >
                  {reply.text}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t bg-gray-50 rounded-b-lg">
            <div className="flex gap-2">
              <Input
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type your message..."
                className="flex-1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(inputText);
                  }
                }}
                disabled={isSending || currentConversation?.status === 'resolved'}
              />
              <Button
                onClick={() => sendMessage(inputText)}
                disabled={!inputText.trim() || isSending || currentConversation?.status === 'resolved'}
                size="icon"
              >
                {isSending ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
            {currentConversation?.status === 'resolved' && (
              <p className="text-xs text-center text-gray-400 mt-2">
                This conversation has been resolved
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

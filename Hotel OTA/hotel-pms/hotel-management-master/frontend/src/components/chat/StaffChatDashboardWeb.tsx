// Staff Chat Dashboard Web Component
// For hotel staff to manage guest conversations (web version)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Send, Phone, Mail, MapPin, Clock, MoreVertical, UserPlus, CheckCircle, ArrowRightLeft, X } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

type HotelDepartment = 'front_desk' | 'concierge' | 'housekeeping' | 'room_service' | 'maintenance' | 'spa' | 'transport';

interface HotelMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderType: 'guest' | 'staff' | 'system';
  senderName: string;
  content: string;
  messageType: 'text' | 'image' | 'file' | 'quick_reply';
  metadata?: Record<string, any>;
  readAt?: string | Date | null;
  createdAt: string | Date;
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
  status: 'active' | 'archived' | 'resolved';
  unreadGuestCount: number;
  unreadStaffCount: number;
  lastMessage?: string;
  lastMessageAt?: string | Date;
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface Staff {
  id: string;
  staffId: string;
  name: string;
  department: HotelDepartment;
  isOnline: boolean;
  isOnDuty: boolean;
  activeChats: number;
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface StaffChatDashboardWebProps {
  staffId: string;
  staffName: string;
  department: HotelDepartment;
  hotelId?: string;
  apiBaseUrl: string;
  socketUrl?: string;
  onNotification?: (title: string, body: string) => void;
}

// ── Department Config ─────────────────────────────────────────────────────────

const DEPARTMENT_COLORS: Record<HotelDepartment, string> = {
  front_desk: 'bg-blue-500',
  concierge: 'bg-orange-500',
  housekeeping: 'bg-green-500',
  room_service: 'bg-red-500',
  maintenance: 'bg-purple-500',
  spa: 'bg-pink-500',
  transport: 'bg-indigo-500',
};

const DEPARTMENT_LABELS: Record<HotelDepartment, string> = {
  front_desk: 'Front Desk',
  concierge: 'Concierge',
  housekeeping: 'Housekeeping',
  room_service: 'Room Service',
  maintenance: 'Maintenance',
  spa: 'Spa',
  transport: 'Transport',
};

const DEPARTMENTS: HotelDepartment[] = ['front_desk', 'concierge', 'housekeeping', 'room_service', 'maintenance', 'spa', 'transport'];

// ── Component ──────────────────────────────────────────────────────────────────

export default function StaffChatDashboardWeb({
  staffId,
  staffName,
  department,
  hotelId,
  apiBaseUrl,
  socketUrl,
  onNotification,
}: StaffChatDashboardWebProps) {
  // State
  const [conversations, setConversations] = useState<HotelConversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<HotelConversation | null>(null);
  const [messages, setMessages] = useState<HotelMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [connected, setConnected] = useState(false);
  const [guestTyping, setGuestTyping] = useState(false);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [filterDepartment, setFilterDepartment] = useState<HotelDepartment | 'all'>('all');
  const [showTransferModal, setShowTransferModal] = useState(false);

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
      auth: { staffId, staffName, department },
    });

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('staff:join', {
        hotelId,
        userId: staffId,
        staffId,
        department,
      });
    });

    socket.on('disconnect', () => setConnected(false));

    // New guest message
    socket.on('new_message', (data: { conversationId: string; message: any }) => {
      const normalizedMessage: HotelMessage = {
        ...data.message,
        senderType: data.message.senderType,
      };
      if (selectedConversation?.id === data.conversationId) {
        setMessages((prev) => [...prev, normalizedMessage]);
        // Mark as read
        markAsRead([data.message.id]);
      }
      // Update conversation list
      loadConversations();
      // Show notification
      if (data.message.senderType === 'guest') {
        onNotification?.('New Message', `${data.message.senderName}: ${data.message.content.substring(0, 50)}`);
      }
    });

    // Guest typing
    socket.on('guest_typing', (data: { conversationId: string; isTyping: boolean }) => {
      if (selectedConversation?.id === data.conversationId) {
        setGuestTyping(data.isTyping);
        if (data.isTyping) {
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setGuestTyping(false), 5000);
        }
      }
    });

    // Conversation created (new ticket)
    socket.on('conversation_created', (data: { conversationId: string; hotelId: string; bookingId: string }) => {
      loadConversations();
      onNotification?.('New Conversation', `New chat request`);
    });

    // Conversation assigned
    socket.on('conversation_assigned', (data: { conversationId: string; staffId: string; staffName: string }) => {
      loadConversations();
    });

    // Staff available/offline
    socket.on('staff_available', (data: { hotelId: string; department: string; isOnline: boolean }) => {
      loadStaff();
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [socketUrl, apiBaseUrl, staffId, staffName, department, selectedConversation?.id, hotelId]);

  // ── Load Data ──────────────────────────────────────────────────────────

  const loadConversations = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.append('status', 'active');
      if (filterDepartment !== 'all') params.append('department', filterDepartment);
      const response = await fetch(`${apiBaseUrl}/v1/hotel-chat/conversations?${params}`, {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success && data.data?.conversations) {
        setConversations(data.data.conversations);
      }
    } catch (error) {
      console.error('[StaffChat] Error loading conversations:', error);
    }
  }, [apiBaseUrl, filterDepartment]);

  const loadMessages = useCallback(async (conversationId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `${apiBaseUrl}/v1/hotel-chat/messages?conversationId=${conversationId}`,
        { credentials: 'include' }
      );
      const data = await response.json();
      if (data.success && data.data?.messages) {
        setMessages(data.data.messages);
      }
    } catch (error) {
      console.error('[StaffChat] Error loading messages:', error);
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl]);

  const loadStaff = useCallback(async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/v1/hotel-chat/staff/availability`, {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success && data.data?.availability) {
        setStaffList(data.data.availability);
      }
    } catch (error) {
      console.error('[StaffChat] Error loading staff:', error);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    loadConversations();
    loadStaff();
    // Poll for new conversations every 15 seconds
    const interval = setInterval(loadConversations, 15000);
    return () => clearInterval(interval);
  }, [loadConversations, loadStaff]);

  // ── Conversation Selection ──────────────────────────────────────────────

  const selectConversation = useCallback(async (conv: HotelConversation) => {
    setSelectedConversation(conv);
    await loadMessages(conv.id);

    // Auto-assign if not assigned
    if (!conv.staffId) {
      try {
        await fetch(`${apiBaseUrl}/v1/hotel-chat/conversations/${conv.id}/assign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ staffId, staffName, department }),
        });
        // Emit via socket
        socketRef.current?.emit('assign', {
          conversationId: conv.id,
          staffId,
          staffName,
          department,
        });
        loadConversations();
      } catch (error) {
        console.error('[StaffChat] Error assigning conversation:', error);
      }
    }
  }, [loadMessages, apiBaseUrl, staffId, staffName, department, loadConversations]);

  // ── Send Message ───────────────────────────────────────────────────────

  const sendMessage = useCallback(async () => {
    if (!selectedConversation || !inputText.trim()) return;

    setIsSending(true);
    const content = inputText.trim();
    setInputText('');

    // Optimistic update
    const tempId = `temp_${Date.now()}`;
    const optimisticMessage: HotelMessage = {
      id: tempId,
      conversationId: selectedConversation.id,
      senderType: 'staff',
      senderId: staffId,
      senderName: staffName,
      content,
      messageType: 'text',
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      // Emit via socket
      socketRef.current?.emit('staff:message', {
        hotelId,
        conversationId: selectedConversation.id,
        staffId,
        staffName,
        content,
      });

      // Also send via REST
      const response = await fetch(`${apiBaseUrl}/v1/hotel-chat/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          conversationId: selectedConversation.id,
          content,
          senderId: staffId,
          senderName: staffName,
          senderType: 'staff',
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
      console.error('[StaffChat] Error sending message:', error);
      // Remove optimistic on error
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInputText(content);
    } finally {
      setIsSending(false);
    }
  }, [selectedConversation, inputText, apiBaseUrl, staffId, staffName, hotelId]);

  const markAsRead = useCallback(async (messageIds: string[]) => {
    if (!selectedConversation || messageIds.length === 0) return;
    try {
      await fetch(`${apiBaseUrl}/v1/hotel-chat/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          conversationId: selectedConversation.id,
          messageIds,
        }),
      });
      // Emit via socket
      socketRef.current?.emit('read', {
        conversationId: selectedConversation.id,
        userId: staffId,
        senderType: 'staff',
      });
    } catch (error) {
      console.error('[StaffChat] Error marking as read:', error);
    }
  }, [selectedConversation, apiBaseUrl, staffId]);

  // ── Typing Indicator ───────────────────────────────────────────────────

  const handleTyping = useCallback((text: string) => {
    setInputText(text);
    if (selectedConversation) {
      socketRef.current?.emit('typing', {
        hotelId,
        conversationId: selectedConversation.id,
        userId: staffId,
        isTyping: text.length > 0,
        senderType: 'staff',
      });
    }
  }, [selectedConversation, staffId, hotelId]);

  // ── Transfer Conversation ──────────────────────────────────────────────

  const transferConversation = useCallback(async (toDepartment: HotelDepartment) => {
    if (!selectedConversation) return;
    setShowTransferModal(false);

    try {
      await fetch(`${apiBaseUrl}/v1/hotel-chat/conversations/${selectedConversation.id}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ department: toDepartment, staffId }),
      });
      // Emit via socket
      socketRef.current?.emit('transfer', {
        conversationId: selectedConversation.id,
        toDepartment,
        staffId,
        hotelId,
      });
      setSelectedConversation(null);
      loadConversations();
    } catch (error) {
      console.error('[StaffChat] Error transferring conversation:', error);
    }
  }, [selectedConversation, apiBaseUrl, staffId, hotelId, loadConversations]);

  // ── Resolve Conversation ──────────────────────────────────────────────

  const resolveConversation = useCallback(async () => {
    if (!selectedConversation) return;

    try {
      await fetch(`${apiBaseUrl}/v1/hotel-chat/conversations/${selectedConversation.id}/resolve`, {
        method: 'POST',
        credentials: 'include',
      });
      // Emit via socket
      socketRef.current?.emit('resolve', {
        conversationId: selectedConversation.id,
        hotelId,
        bookingId: selectedConversation.bookingId,
      });
      setSelectedConversation(null);
      loadConversations();
    } catch (error) {
      console.error('[StaffChat] Error resolving conversation:', error);
    }
  }, [selectedConversation, apiBaseUrl, hotelId, loadConversations]);

  // ── Scroll to Bottom ──────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Filtered Conversations ──────────────────────────────────────────────

  const filteredConversations = conversations.filter(
    (c) => filterDepartment === 'all' || c.department === filterDepartment
  );

  // ── Render ───────────────────────────────────────────────────────────

  const totalUnread = conversations.reduce((acc, c) => acc + c.unreadGuestCount, 0);

  return (
    <div className="flex h-full bg-gray-50">
      {/* Sidebar - Conversation List */}
      <div className="w-80 bg-white border-r flex flex-col">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-lg">Guest Chat</h2>
            <Badge variant={connected ? 'default' : 'secondary'} className={connected ? 'bg-green-500' : ''}>
              {connected ? 'Online' : 'Offline'}
            </Badge>
          </div>
          <div className="flex items-center text-sm text-gray-500">
            <span className="font-medium text-gray-700">{staffName}</span>
            <span className="mx-2">•</span>
            <Badge variant="outline">{DEPARTMENT_LABELS[department]}</Badge>
          </div>
        </div>

        {/* Department Filters */}
        <div className="p-2 border-b overflow-x-auto">
          <div className="flex gap-1">
            <button
              onClick={() => setFilterDepartment('all')}
              className={`px-3 py-1.5 text-sm rounded-full whitespace-nowrap transition-colors ${
                filterDepartment === 'all'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
            >
              All ({conversations.length})
            </button>
            {DEPARTMENTS.map((dept) => (
              <button
                key={dept}
                onClick={() => setFilterDepartment(dept)}
                className={`px-3 py-1.5 text-sm rounded-full whitespace-nowrap transition-colors ${
                  filterDepartment === dept
                    ? `${DEPARTMENT_COLORS[dept]} text-white`
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                {DEPARTMENT_LABELS[dept]}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation List */}
        <ScrollArea className="flex-1">
          <div className="divide-y">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <p>No active conversations</p>
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => selectConversation(conv)}
                  className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                    selectedConversation?.id === conv.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-full ${DEPARTMENT_COLORS[conv.department]} flex items-center justify-center text-white font-medium`}>
                      {conv.roomNumber || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900 truncate">{conv.guestName}</span>
                        <span className="text-xs text-gray-400">
                          {new Date(conv.updatedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-sm text-gray-500 truncate">
                          {conv.lastMessage || 'No messages yet'}
                        </p>
                        {conv.unreadGuestCount > 0 && (
                          <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-xs font-medium text-white">
                            {conv.unreadGuestCount}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {DEPARTMENT_LABELS[conv.department]}
                        </Badge>
                        {conv.staffName && (
                          <span className="text-xs text-gray-400">• {conv.staffName}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Stats Footer */}
        <div className="p-3 border-t bg-gray-50">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Active: {conversations.length}</span>
            <span className="text-gray-500">Unread: {totalUnread}</span>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 bg-white border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full ${DEPARTMENT_COLORS[selectedConversation.department]} flex items-center justify-center text-white font-medium`}>
                  {selectedConversation.roomNumber || '?'}
                </div>
                <div>
                  <h3 className="font-semibold">{selectedConversation.guestName}</h3>
                  <p className="text-sm text-gray-500">
                    Room {selectedConversation.roomNumber} • {DEPARTMENT_LABELS[selectedConversation.department]}
                    {selectedConversation.staffName && ` • Assigned to ${selectedConversation.staffName}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowTransferModal(true)}>
                  <ArrowRightLeft className="w-4 h-4 mr-1" />
                  Transfer
                </Button>
                <Button variant="default" size="sm" onClick={resolveConversation}>
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Resolve
                </Button>
              </div>
            </div>

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
                      className={`flex ${msg.senderType === 'staff' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg p-3 ${
                          msg.senderType === 'staff'
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-900'
                        }`}
                      >
                        {msg.senderType !== 'staff' && (
                          <p className={`text-xs font-medium mb-1 ${
                            msg.senderType === 'system' ? 'text-gray-500' : 'text-blue-600'
                          }`}>
                            {msg.senderName}
                          </p>
                        )}
                        <p className="text-sm">{msg.content}</p>
                        <p className={`text-xs mt-1 ${
                          msg.senderType === 'staff' ? 'text-blue-100' : 'text-gray-400'
                        }`}>
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  ))
                )}

                {/* Guest typing indicator */}
                {guestTyping && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 rounded-lg px-4 py-3">
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

            {/* Input */}
            <div className="p-4 bg-white border-t">
              <div className="flex gap-2">
                <Input
                  value={inputText}
                  onChange={(e) => handleTyping(e.target.value)}
                  placeholder="Type your reply..."
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  disabled={isSending}
                />
                <Button onClick={sendMessage} disabled={!inputText.trim() || isSending}>
                  {isSending ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900">No conversation selected</h3>
              <p className="text-gray-500 mt-1">Select a conversation from the list to start chatting</p>
            </div>
          </div>
        )}
      </div>

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold text-lg">Transfer Conversation</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowTransferModal(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-500 mb-4">
                Select a department to transfer this conversation to:
              </p>
              <div className="grid grid-cols-2 gap-2">
                {DEPARTMENTS.map((dept) => (
                  <button
                    key={dept}
                    onClick={() => transferConversation(dept)}
                    className={`p-3 rounded-lg border text-left hover:bg-gray-50 transition-colors ${
                      dept === selectedConversation?.department ? 'border-gray-300' : ''
                    }`}
                    disabled={dept === selectedConversation?.department}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${DEPARTMENT_COLORS[dept]}`} />
                      <span className="font-medium">{DEPARTMENT_LABELS[dept]}</span>
                    </div>
                    {dept === selectedConversation?.department && (
                      <p className="text-xs text-gray-400 mt-1">Current department</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Guest Chat Panel Component
// Real-time chat interface for hotel guests

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { io, Socket } from 'socket.io-client';

// ── Types ──────────────────────────────────────────────────────────────────────

type HotelDepartment = 'front_desk' | 'concierge' | 'housekeeping' | 'room_service' | 'maintenance' | 'spa' | 'transport';

interface HotelMessage {
  id: string;
  conversationId: string;
  sender: 'guest' | 'staff' | 'system';
  senderId: string;
  senderName: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'quick_reply';
  timestamp: string;
  read?: boolean;
}

interface HotelConversation {
  id: string;
  type: HotelConversationType;
  department: HotelDepartment;
  status: 'active' | 'resolved';
  staffName?: string;
  createdAt: string;
}

type HotelConversationType = 'room_service' | 'concierge' | 'housekeeping' | 'maintenance' | 'spa' | 'transport' | 'general';

interface QuickReply {
  id: string;
  text: string;
  action: 'send_message' | 'open_url' | 'create_request';
  payload?: string;
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface GuestChatPanelProps {
  guestId: string;
  guestName: string;
  roomNumber?: string;
  bookingId?: string;
  apiBaseUrl: string;
  socketUrl?: string;
  onClose?: () => void;
}

// ── Department Labels ─────────────────────────────────────────────────────────

const DEPARTMENT_LABELS: Record<HotelDepartment, string> = {
  front_desk: 'Front Desk',
  concierge: 'Concierge',
  housekeeping: 'Housekeeping',
  room_service: 'Room Service',
  maintenance: 'Maintenance',
  spa: 'Spa',
  transport: 'Transportation',
};

const DEPARTMENT_ICONS: Record<HotelDepartment, string> = {
  front_desk: '🏛️',
  concierge: '🛎️',
  housekeeping: '🧹',
  room_service: '🍽️',
  maintenance: '🔧',
  spa: '💆',
  transport: '🚗',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function GuestChatPanel({
  guestId,
  guestName,
  roomNumber,
  bookingId,
  apiBaseUrl,
  socketUrl,
  onClose,
}: GuestChatPanelProps) {
  // State
  const [conversations, setConversations] = useState<HotelConversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<HotelConversation | null>(null);
  const [messages, setMessages] = useState<HotelMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [connected, setConnected] = useState(false);
  const [staffTyping, setStaffTyping] = useState(false);
  const [quickReplies, setQuickReplies] = useState<Record<HotelDepartment, QuickReply[]>>({
    front_desk: [
      { id: 'qr_1', text: 'Check-out time', action: 'send_message', payload: 'What is the check-out time?' },
      { id: 'qr_2', text: 'Wake-up call', action: 'send_message', payload: 'I need a wake-up call' },
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
  });

  // Refs
  const socketRef = useRef<Socket | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // ── Socket Connection ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!socketUrl) return;

    const socket = io(`${socketUrl}/hotel`, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      setConnected(true);
      // Register guest
      socket.emit('hotel:guest_join', {
        guestId,
        guestName,
        roomNumber,
        bookingId,
      });
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    // Handle new messages
    socket.on('hotel:new_guest_message', (data: { conversationId: string; message: HotelMessage }) => {
      if (data.conversationId === currentConversation?.id) {
        setMessages((prev) => [...prev, data.message]);
      }
      // Update conversation list
      loadConversations();
    });

    // Handle staff typing
    socket.on('hotel:staff_typing', (data: { conversationId: string; isTyping: boolean }) => {
      if (data.conversationId === currentConversation?.id) {
        setStaffTyping(data.isTyping);
        if (data.isTyping) {
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setStaffTyping(false), 5000);
        }
      }
    });

    // Handle staff assigned
    socket.on('hotel:staff_assigned', (data: { conversationId: string; staff: { name: string } }) => {
      if (data.conversationId === currentConversation?.id) {
        setCurrentConversation((prev) =>
          prev ? { ...prev, staffName: data.staff.name } : prev
        );
      }
    });

    socketRef.current = socket;

    return () => {
      socket.emit('hotel:guest_left', { guestId });
      socket.disconnect();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [socketUrl, guestId, guestName, roomNumber, bookingId, currentConversation?.id]);

  // ── Load Conversations ────────────────────────────────────────────────────

  const loadConversations = useCallback(async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/hotel-chat/conversations?guestId=${guestId}`);
      const data = await response.json();
      if (data.conversations) {
        setConversations(data.conversations);
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
        `${apiBaseUrl}/api/hotel-chat/messages?conversationId=${conversationId}`
      );
      const data = await response.json();
      if (data.messages) {
        setMessages(data.messages);
      }
    } catch (error) {
      console.error('[GuestChat] Error loading messages:', error);
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl]);

  // ── Start Conversation ──────────────────────────────────────────────────

  const startConversation = useCallback(async (type: HotelConversationType, department: HotelDepartment) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/hotel-chat/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          roomNumber,
          type,
          department,
          guestId,
          guestName,
        }),
      });
      const data = await response.json();
      if (data.conversation) {
        setConversations((prev) => [data.conversation, ...prev]);
        setCurrentConversation(data.conversation);
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
    if (!currentConversation || !content.trim()) return;

    setIsSending(true);
    setInputText('');

    // Optimistic update
    const optimisticMessage: HotelMessage = {
      id: `temp_${Date.now()}`,
      conversationId: currentConversation.id,
      sender: 'guest',
      senderId: guestId,
      senderName: guestName,
      content: content.trim(),
      type: 'text',
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      const response = await fetch(`${apiBaseUrl}/api/hotel-chat/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: currentConversation.id,
          content: content.trim(),
          senderId: guestId,
          senderName: guestName,
        }),
      });
      const data = await response.json();
      if (data.message) {
        // Replace optimistic with real
        setMessages((prev) =>
          prev.map((m) => (m.id === optimisticMessage.id ? data.message : m))
        );
      }
    } catch (error) {
      console.error('[GuestChat] Error sending message:', error);
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMessage.id));
      setInputText(content);
    } finally {
      setIsSending(false);
    }
  }, [currentConversation, guestId, guestName, apiBaseUrl]);

  // ── Quick Reply Handler ────────────────────────────────────────────────

  const handleQuickReply = useCallback((reply: QuickReply) => {
    if (reply.action === 'send_message' && reply.payload) {
      sendMessage(reply.payload);
    } else if (reply.action === 'create_request' && reply.payload) {
      // Map payload to department
      const dept = reply.payload as HotelDepartment;
      const type = reply.payload as HotelConversationType;
      startConversation(type, dept);
    }
  }, [sendMessage, startConversation]);

  // ── Scroll to Bottom ──────────────────────────────────────────────────

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  // ── Render ────────────────────────────────────────────────────────────

  if (!currentConversation) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Chat with Us</Text>
          <Text style={styles.headerSubtitle}>Select a department to start chatting</Text>
        </View>

        <ScrollView style={styles.departmentList}>
          {Object.entries(DEPARTMENT_LABELS).map(([dept, label]) => (
            <TouchableOpacity
              key={dept}
              style={styles.departmentItem}
              onPress={() => startConversation(dept as HotelConversationType, dept as HotelDepartment)}
              disabled={isLoading}
            >
              <Text style={styles.departmentIcon}>{DEPARTMENT_ICONS[dept as HotelDepartment]}</Text>
              <View style={styles.departmentInfo}>
                <Text style={styles.departmentLabel}>{label}</Text>
                <Text style={styles.departmentDesc}>
                  Get help with {label.toLowerCase()} services
                </Text>
              </View>
              <Text style={styles.departmentArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#007AFF" />
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.chatHeader}>
        <TouchableOpacity onPress={() => setCurrentConversation(null)} style={styles.backButton}>
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.chatHeaderInfo}>
          <Text style={styles.chatHeaderTitle}>
            {DEPARTMENT_LABELS[currentConversation.department] || 'Hotel Staff'}
          </Text>
          <Text style={styles.chatHeaderSubtitle}>
            {currentConversation.staffName
              ? `Connected with ${currentConversation.staffName}`
              : connected
              ? 'Connecting to staff...'
              : 'Disconnected'}
          </Text>
        </View>
        {connected && <View style={styles.onlineIndicator} />}
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesListContent}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#007AFF" style={{ marginTop: 20 }} />
        ) : (
          messages.map((msg) => (
            <View
              key={msg.id}
              style={[
                styles.messageBubble,
                msg.sender === 'guest' ? styles.messageBubbleGuest : styles.messageBubbleStaff,
              ]}
            >
              {msg.sender !== 'guest' && (
                <Text style={styles.messageSender}>{msg.senderName}</Text>
              )}
              <Text style={styles.messageText}>{msg.content}</Text>
              <Text style={styles.messageTime}>
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          ))
        )}

        {staffTyping && (
          <View style={[styles.messageBubble, styles.messageBubbleStaff]}>
            <Text style={styles.messageText}>...</Text>
          </View>
        )}
      </ScrollView>

      {/* Quick Replies */}
      {messages.length < 3 && quickReplies[currentConversation.department] && (
        <ScrollView
          horizontal
          style={styles.quickRepliesContainer}
          showsHorizontalScrollIndicator={false}
        >
          {quickReplies[currentConversation.department].map((reply) => (
            <TouchableOpacity
              key={reply.id}
              style={styles.quickReplyButton}
              onPress={() => handleQuickReply(reply)}
            >
              <Text style={styles.quickReplyText}>{reply.text}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type a message..."
          placeholderTextColor="#999"
          multiline
          maxLength={500}
          onSubmitEditing={() => sendMessage(inputText)}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!inputText.trim() || isSending) && styles.sendButtonDisabled]}
          onPress={() => sendMessage(inputText)}
          disabled={!inputText.trim() || isSending}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.sendButtonText}>Send</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  departmentList: {
    flex: 1,
  },
  departmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  departmentIcon: {
    fontSize: 28,
    marginRight: 16,
  },
  departmentInfo: {
    flex: 1,
  },
  departmentLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  departmentDesc: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  departmentArrow: {
    fontSize: 24,
    color: '#ccc',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#f8f8f8',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  backButtonText: {
    fontSize: 32,
    color: '#007AFF',
    fontWeight: '300',
  },
  chatHeaderInfo: {
    flex: 1,
  },
  chatHeaderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  chatHeaderSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  onlineIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#34C759',
  },
  messagesList: {
    flex: 1,
  },
  messagesListContent: {
    padding: 16,
    paddingBottom: 8,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  messageBubbleGuest: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  messageBubbleStaff: {
    alignSelf: 'flex-start',
    backgroundColor: '#f1f1f1',
    borderBottomLeftRadius: 4,
  },
  messageSender: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
    fontWeight: '500',
  },
  messageText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 20,
  },
  messageTime: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  quickRepliesContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    maxHeight: 50,
  },
  quickReplyButton: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
  },
  quickReplyText: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#333',
  },
  sendButton: {
    marginLeft: 8,
    backgroundColor: '#007AFF',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 60,
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});

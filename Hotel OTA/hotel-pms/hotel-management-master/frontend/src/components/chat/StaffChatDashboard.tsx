// Staff Chat Dashboard Component
// For hotel staff to manage guest conversations

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Modal, FlatList } from 'react-native';
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
  hotelId: string;
  bookingId: string;
  roomNumber: string;
  type: string;
  department: HotelDepartment;
  guestId: string;
  guestName: string;
  staffId?: string;
  staffName?: string;
  status: 'active' | 'archived' | 'resolved';
  unreadGuestCount: number;
  unreadStaffCount: number;
  lastMessage?: HotelMessage;
  createdAt: string;
  updatedAt: string;
}

interface Staff {
  id: string;
  name: string;
  department: HotelDepartment;
  isOnDuty: boolean;
  activeChats: number;
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface StaffChatDashboardProps {
  staffId: string;
  staffName: string;
  department: HotelDepartment;
  apiBaseUrl: string;
  socketUrl?: string;
  onNotification?: (title: string, body: string) => void;
}

// ── Department Config ─────────────────────────────────────────────────────────

const DEPARTMENT_COLORS: Record<HotelDepartment, string> = {
  front_desk: '#007AFF',
  concierge: '#FF9500',
  housekeeping: '#34C759',
  room_service: '#FF3B30',
  maintenance: '#AF52DE',
  spa: '#FF2D55',
  transport: '#5856D6',
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

// ── Component ──────────────────────────────────────────────────────────────────

export default function StaffChatDashboard({
  staffId,
  staffName,
  department,
  apiBaseUrl,
  socketUrl,
  onNotification,
}: StaffChatDashboardProps) {
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
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [filterDepartment, setFilterDepartment] = useState<HotelDepartment | 'all'>('all');

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
    });

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('hotel:staff_join', { staffId, staffName, department });
    });

    socket.on('disconnect', () => setConnected(false));

    // New guest message
    socket.on('hotel:new_guest_message', (data: { conversationId: string; message: HotelMessage }) => {
      if (selectedConversation?.id === data.conversationId) {
        setMessages((prev) => [...prev, data.message]);
        // Mark as read
        markAsRead([data.message.id]);
      }
      // Update conversation list
      loadConversations();
      // Show notification
      onNotification?.('New Message', `Guest sent a message`);
    });

    // Guest typing
    socket.on('hotel:guest_typing', (data: { conversationId: string; isTyping: boolean }) => {
      if (selectedConversation?.id === data.conversationId) {
        setGuestTyping(data.isTyping);
        if (data.isTyping) {
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setGuestTyping(false), 5000);
        }
      }
    });

    // Conversation created (new ticket)
    socket.on('conversation:created', (data: { conversation: HotelConversation }) => {
      loadConversations();
      onNotification?.('New Conversation', `New ${DEPARTMENT_LABELS[data.conversation.department]} request`);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [socketUrl, staffId, staffName, department, selectedConversation?.id]);

  // ── Load Data ──────────────────────────────────────────────────────────

  const loadConversations = useCallback(async () => {
    try {
      const params = new URLSearchParams({ status: 'active' });
      if (filterDepartment !== 'all') params.append('department', filterDepartment);
      const response = await fetch(`${apiBaseUrl}/api/hotel-chat/conversations?${params}`);
      const data = await response.json();
      if (data.conversations) {
        setConversations(data.conversations);
      }
    } catch (error) {
      console.error('[StaffChat] Error loading conversations:', error);
    }
  }, [apiBaseUrl, filterDepartment]);

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
      console.error('[StaffChat] Error loading messages:', error);
    } finally {
      setIsLoading(false);
    }
  }, [apiBaseUrl]);

  const loadStaff = useCallback(async () => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/hotel-chat/staff/availability`);
      const data = await response.json();
      if (data.availability) {
        setStaffList(data.availability);
      }
    } catch (error) {
      console.error('[StaffChat] Error loading staff:', error);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    loadConversations();
    loadStaff();
    // Poll for new conversations every 10 seconds
    const interval = setInterval(loadConversations, 10000);
    return () => clearInterval(interval);
  }, [loadConversations, loadStaff]);

  // ── Conversation Selection ──────────────────────────────────────────────

  const selectConversation = useCallback(async (conv: HotelConversation) => {
    setSelectedConversation(conv);
    await loadMessages(conv.id);

    // Auto-assign if not assigned
    if (!conv.staffId) {
      await fetch(`${apiBaseUrl}/api/hotel-chat/conversations/${conv.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId, staffName }),
      });
    }
  }, [loadMessages, apiBaseUrl, staffId, staffName]);

  // ── Send Message ───────────────────────────────────────────────────────

  const sendMessage = useCallback(async () => {
    if (!selectedConversation || !inputText.trim()) return;

    setIsSending(true);
    const content = inputText.trim();
    setInputText('');

    // Stop typing
    socketRef.current?.emit('hotel:staff_typing', {
      conversationId: selectedConversation.id,
      isTyping: false,
    });

    try {
      const response = await fetch(`${apiBaseUrl}/api/hotel-chat/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedConversation.id,
          content,
          type: 'text',
        }),
      });
      const data = await response.json();
      if (data.message) {
        setMessages((prev) => [...prev, data.message]);
      }
    } catch (error) {
      console.error('[StaffChat] Error sending message:', error);
      setInputText(content);
    } finally {
      setIsSending(false);
    }
  }, [selectedConversation, inputText, apiBaseUrl]);

  const markAsRead = useCallback(async (messageIds: string[]) => {
    if (!selectedConversation || messageIds.length === 0) return;
    await fetch(`${apiBaseUrl}/api/hotel-chat/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: selectedConversation.id,
        messageIds,
      }),
    });
  }, [selectedConversation, apiBaseUrl]);

  // ── Typing Indicator ───────────────────────────────────────────────────

  const handleTyping = useCallback((text: string) => {
    setInputText(text);
    if (selectedConversation) {
      socketRef.current?.emit('hotel:staff_typing', {
        conversationId: selectedConversation.id,
        isTyping: text.length > 0,
      });
    }
  }, [selectedConversation]);

  // ── Transfer Conversation ──────────────────────────────────────────────

  const transferConversation = useCallback(async (toDepartment: HotelDepartment) => {
    if (!selectedConversation) return;
    setShowTransferModal(false);

    await fetch(`${apiBaseUrl}/api/hotel-chat/conversations/${selectedConversation.id}/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ department: toDepartment }),
    });

    setSelectedConversation(null);
    loadConversations();
  }, [selectedConversation, apiBaseUrl, loadConversations]);

  // ── Resolve Conversation ──────────────────────────────────────────────

  const resolveConversation = useCallback(async () => {
    if (!selectedConversation) return;

    await fetch(`${apiBaseUrl}/api/hotel-chat/conversations/${selectedConversation.id}/resolve`, {
      method: 'POST',
    });

    setSelectedConversation(null);
    loadConversations();
  }, [selectedConversation, apiBaseUrl, loadConversations]);

  // ── Render ───────────────────────────────────────────────────────────

  const filteredConversations = conversations.filter(
    (c) => filterDepartment === 'all' || c.department === filterDepartment
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Guest Chat</Text>
          <View style={[styles.connectionBadge, connected && styles.connectionBadgeOnline]}>
            <Text style={styles.connectionText}>{connected ? 'Online' : 'Offline'}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.staffName}>{staffName}</Text>
          <Text style={styles.departmentLabel}>{DEPARTMENT_LABELS[department]}</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <ScrollView horizontal style={styles.filterTabs} showsHorizontalScrollIndicator={false}>
        <TouchableOpacity
          style={[styles.filterTab, filterDepartment === 'all' && styles.filterTabActive]}
          onPress={() => setFilterDepartment('all')}
        >
          <Text style={[styles.filterTabText, filterDepartment === 'all' && styles.filterTabTextActive]}>
            All ({conversations.length})
          </Text>
        </TouchableOpacity>
        {Object.entries(DEPARTMENT_LABELS).map(([dept, label]) => (
          <TouchableOpacity
            key={dept}
            style={[styles.filterTab, filterDepartment === dept && styles.filterTabActive]}
            onPress={() => setFilterDepartment(dept as HotelDepartment)}
          >
            <Text style={[styles.filterTabText, filterDepartment === dept && styles.filterTabTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.mainContent}>
        {/* Conversation List */}
        <View style={styles.conversationList}>
          <FlatList
            data={filteredConversations}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.conversationItem,
                  selectedConversation?.id === item.id && styles.conversationItemSelected,
                ]}
                onPress={() => selectConversation(item)}
              >
                <View style={[styles.departmentBadge, { backgroundColor: DEPARTMENT_COLORS[item.department] }]}>
                  <Text style={styles.departmentBadgeText}>
                    {item.roomNumber || '?'}
                  </Text>
                </View>
                <View style={styles.conversationInfo}>
                  <Text style={styles.guestName}>{item.guestName}</Text>
                  <Text style={styles.lastMessage} numberOfLines={1}>
                    {item.lastMessage?.content || 'No messages yet'}
                  </Text>
                </View>
                <View style={styles.conversationMeta}>
                  {item.unreadGuestCount > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadBadgeText}>{item.unreadGuestCount}</Text>
                    </View>
                  )}
                  <Text style={styles.conversationTime}>
                    {new Date(item.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={styles.emptyList}>
                <Text style={styles.emptyListText}>No active conversations</Text>
              </View>
            }
          />
        </View>

        {/* Chat Panel */}
        {selectedConversation ? (
          <View style={styles.chatPanel}>
            {/* Chat Header */}
            <View style={styles.chatHeader}>
              <View>
                <Text style={styles.chatHeaderTitle}>{selectedConversation.guestName}</Text>
                <Text style={styles.chatHeaderSubtitle}>
                  Room {selectedConversation.roomNumber} • {DEPARTMENT_LABELS[selectedConversation.department]}
                </Text>
              </View>
              <View style={styles.chatActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => setShowTransferModal(true)}
                >
                  <Text style={styles.actionButtonText}>Transfer</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.resolveButton]}
                  onPress={resolveConversation}
                >
                  <Text style={styles.resolveButtonText}>Resolve</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Messages */}
            <ScrollView ref={scrollViewRef} style={styles.messagesList}>
              {isLoading ? (
                <ActivityIndicator size="small" color="#007AFF" style={{ marginTop: 20 }} />
              ) : (
                messages.map((msg) => (
                  <View
                    key={msg.id}
                    style={[
                      styles.messageBubble,
                      msg.sender === 'staff' ? styles.messageBubbleStaff : styles.messageBubbleGuest,
                    ]}
                  >
                    {msg.sender !== 'staff' && (
                      <Text style={styles.messageSender}>{msg.senderName}</Text>
                    )}
                    <Text style={styles.messageText}>{msg.content}</Text>
                    <Text style={styles.messageTime}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                ))
              )}
              {guestTyping && (
                <View style={[styles.messageBubble, styles.messageBubbleGuest]}>
                  <Text style={styles.messageText}>Guest is typing...</Text>
                </View>
              )}
            </ScrollView>

            {/* Input */}
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                value={inputText}
                onChangeText={handleTyping}
                placeholder="Type a reply..."
                placeholderTextColor="#999"
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
                onPress={sendMessage}
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
        ) : (
          <View style={styles.noChatSelected}>
            <Text style={styles.noChatText}>Select a conversation to start chatting</Text>
          </View>
        )}
      </View>

      {/* Transfer Modal */}
      <Modal visible={showTransferModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Transfer to Department</Text>
            {Object.entries(DEPARTMENT_LABELS).map(([dept, label]) => (
              <TouchableOpacity
                key={dept}
                style={styles.modalItem}
                onPress={() => transferConversation(dept as HotelDepartment)}
              >
                <Text style={[styles.modalItemText, { color: DEPARTMENT_COLORS[dept as HotelDepartment] }]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setShowTransferModal(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  connectionBadge: {
    marginLeft: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#ccc',
  },
  connectionBadgeOnline: {
    backgroundColor: '#34C759',
  },
  connectionText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  staffName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  departmentLabel: {
    fontSize: 12,
    color: '#666',
  },
  filterTabs: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    maxHeight: 50,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 4,
  },
  filterTabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  filterTabText: {
    fontSize: 13,
    color: '#666',
  },
  filterTabTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  mainContent: {
    flex: 1,
    flexDirection: 'row',
  },
  conversationList: {
    width: 280,
    backgroundColor: '#fff',
    borderRightWidth: 1,
    borderRightColor: '#eee',
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  conversationItemSelected: {
    backgroundColor: '#e8f4ff',
  },
  departmentBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  departmentBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  conversationInfo: {
    flex: 1,
  },
  guestName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  lastMessage: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  conversationMeta: {
    alignItems: 'flex-end',
  },
  unreadBadge: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  conversationTime: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },
  emptyList: {
    padding: 20,
    alignItems: 'center',
  },
  emptyListText: {
    fontSize: 14,
    color: '#999',
  },
  chatPanel: {
    flex: 1,
    backgroundColor: '#fff',
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f8f8',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  chatHeaderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  chatHeaderSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  chatActions: {
    flexDirection: 'row',
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#eee',
    marginLeft: 8,
  },
  actionButtonText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500',
  },
  resolveButton: {
    backgroundColor: '#34C759',
  },
  resolveButtonText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  messagesList: {
    flex: 1,
    padding: 16,
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  messageBubbleStaff: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  messageBubbleGuest: {
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
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
    paddingHorizontal: 20,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  noChatSelected: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  noChatText: {
    fontSize: 14,
    color: '#999',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalItemText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalCancel: {
    paddingVertical: 16,
    marginTop: 8,
  },
  modalCancelText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
  },
});

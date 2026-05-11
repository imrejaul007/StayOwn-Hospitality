/**
 * Staff Mobile App
 * Mobile interface for hotel staff to manage requests, receive notifications, and communicate with guests
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

// Types
interface Request {
  id: string;
  room_number: string;
  guest_name: string;
  service_type: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'assigned' | 'in_progress' | 'completed';
  created_at: string;
  sla_deadline?: string;
}

interface Message {
  id: string;
  sender_type: 'guest' | 'staff';
  content: string;
  created_at: string;
}

interface Conversation {
  id: string;
  room_number: string;
  guest_name: string;
  last_message: string;
  unread_count: number;
}

// Constants
const SERVICE_ICONS: Record<string, string> = {
  housekeeping: '🧹',
  room_service: '🍽️',
  spa: '💆',
  laundry: '👕',
  maintenance: '🔧',
  concierge: '🛎️',
  transport: '🚗',
};

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  low: { bg: '#E5E7EB', text: '#374151' },
  medium: { bg: '#DBEAFE', text: '#1D4ED8' },
  high: { bg: '#FEF3C7', text: '#D97706' },
  urgent: { bg: '#FEE2E2', text: '#DC2626' },
};

// API Configuration
const API_BASE_URL = 'https://api.example.com/v1';

export default function StaffApp() {
  const navigation = useNavigation<any>();
  const [activeTab, setActiveTab] = useState<'requests' | 'messages' | 'profile'>('requests');
  const [requests, setRequests] = useState<Request[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [staffStatus, setStaffStatus] = useState<'online' | 'busy' | 'break'>('online');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [requestsRes, messagesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/staff/requests?assignedTo=me`),
        fetch(`${API_BASE_URL}/staff/messages`),
      ]);

      if (requestsRes.ok) {
        const data = await requestsRes.json();
        setRequests(data.requests || []);
      }

      if (messagesRes.ok) {
        const data = await messagesRes.json();
        setConversations(data.conversations || []);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, []);

  const updateRequestStatus = async (requestId: string, status: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/staff/requests/${requestId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        setRequests((prev) =>
          prev.map((r) => (r.id === requestId ? { ...r, status: status as Request['status'] } : r))
        );
        Alert.alert('Success', 'Request status updated');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update request status');
    }
  };

  const myRequests = requests.filter((r) => r.status !== 'completed');
  const completedToday = requests.filter(
    (r) =>
      r.status === 'completed' &&
      new Date(r.created_at).toDateString() === new Date().toDateString()
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Staff Panel</Text>
          <Text style={styles.headerSubtitle}>
            {myRequests.length} active requests
          </Text>
        </View>
        <StatusBadge status={staffStatus} onPress={() => updateStaffStatus()} />
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'requests' && styles.tabActive]}
          onPress={() => setActiveTab('requests')}
        >
          <Text style={[styles.tabText, activeTab === 'requests' && styles.tabTextActive]}>
            📋 Requests
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'messages' && styles.tabActive]}
          onPress={() => setActiveTab('messages')}
        >
          <Text style={[styles.tabText, activeTab === 'messages' && styles.tabTextActive]}>
            💬 Messages
            {conversations.reduce((sum, c) => sum + c.unread_count, 0) > 0 && (
              <Text style={styles.badge}>
                {conversations.reduce((sum, c) => sum + c.unread_count, 0)}
              </Text>
            )}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'profile' && styles.tabActive]}
          onPress={() => setActiveTab('profile')}
        >
          <Text style={[styles.tabText, activeTab === 'profile' && styles.tabTextActive]}>
            👤 Profile
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {activeTab === 'requests' && (
          <RequestsTab
            requests={myRequests}
            completedToday={completedToday.length}
            onStatusChange={updateRequestStatus}
          />
        )}
        {activeTab === 'messages' && (
          <MessagesTab
            conversations={conversations}
            onSelectConversation={(conv) => navigation.navigate('Chat', { conversation: conv })}
          />
        )}
        {activeTab === 'profile' && (
          <ProfileTab
            status={staffStatus}
            onStatusChange={setStaffStatus}
            onLogout={() => Alert.alert('Logout', 'Logged out successfully')}
          />
        )}
      </ScrollView>
    </View>
  );
}

// Status Badge Component
function StatusBadge({
  status,
  onPress,
}: {
  status: 'online' | 'busy' | 'break';
  onPress: () => void;
}) {
  const statusColors = {
    online: { bg: '#10B981', text: '#FFFFFF' },
    busy: { bg: '#EF4444', text: '#FFFFFF' },
    break: { bg: '#F59E0B', text: '#FFFFFF' },
  };

  return (
    <TouchableOpacity
      style={[styles.statusBadge, { backgroundColor: statusColors[status].bg }]}
      onPress={onPress}
    >
      <Text style={[styles.statusBadgeText, { color: statusColors[status].text }]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Text>
    </TouchableOpacity>
  );
}

// Requests Tab Component
function RequestsTab({
  requests,
  completedToday,
  onStatusChange,
}: {
  requests: Request[];
  completedToday: number;
  onStatusChange: (id: string, status: string) => void;
}) {
  const sortedRequests = [...requests].sort((a, b) => {
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  return (
    <View style={styles.tabContent}>
      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{completedToday}</Text>
          <Text style={styles.statLabel}>Completed Today</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{requests.length}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
      </View>

      {/* Request List */}
      <Text style={styles.sectionTitle}>My Requests</Text>
      {sortedRequests.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>✅</Text>
          <Text style={styles.emptyText}>No active requests</Text>
          <Text style={styles.emptySubtext}>You're all caught up!</Text>
        </View>
      ) : (
        sortedRequests.map((request) => (
          <RequestCard
            key={request.id}
            request={request}
            onStatusChange={(status) => onStatusChange(request.id, status)}
          />
        ))
      )}
    </View>
  );
}

// Request Card Component
function RequestCard({
  request,
  onStatusChange,
}: {
  request: Request;
  onStatusChange: (status: string) => void;
}) {
  const priorityStyle = PRIORITY_COLORS[request.priority];
  const serviceIcon = SERVICE_ICONS[request.service_type] || '📋';

  const getTimeRemaining = () => {
    if (!request.sla_deadline) return null;
    const deadline = new Date(request.sla_deadline);
    const now = new Date();
    const diffMs = deadline.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 0) return { text: 'OVERDUE', color: '#DC2626' };
    if (diffMins < 10) return { text: `${diffMins}m`, color: '#DC2626' };
    if (diffMins < 30) return { text: `${diffMins}m`, color: '#D97706' };
    return { text: `${diffMins}m`, color: '#10B981' };
  };

  const timeRemaining = getTimeRemaining();

  return (
    <TouchableOpacity style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <View style={styles.requestRoom}>
          <Text style={styles.requestIcon}>{serviceIcon}</Text>
          <View>
            <Text style={styles.requestRoomNumber}>Room {request.room_number}</Text>
            <Text style={styles.requestGuest}>{request.guest_name}</Text>
          </View>
        </View>
        <View style={[styles.priorityBadge, { backgroundColor: priorityStyle.bg }]}>
          <Text style={[styles.priorityText, { color: priorityStyle.text }]}>
            {request.priority.toUpperCase()}
          </Text>
        </View>
      </View>

      <Text style={styles.requestDescription}>{request.description}</Text>

      <View style={styles.requestMeta}>
        <Text style={styles.requestTime}>
          {new Date(request.created_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
        {timeRemaining && (
          <View style={[styles.slaBadge, { backgroundColor: timeRemaining.color + '20' }]}>
            <Text style={[styles.slaText, { color: timeRemaining.color }]}>
              ⏱️ {timeRemaining.text}
            </Text>
          </View>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.requestActions}>
        {request.status === 'assigned' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.startButton]}
            onPress={() => onStatusChange('in_progress')}
          >
            <Text style={styles.actionButtonText}>Start Work</Text>
          </TouchableOpacity>
        )}
        {request.status === 'in_progress' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.completeButton]}
            onPress={() => onStatusChange('completed')}
          >
            <Text style={styles.actionButtonText}>Complete</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

// Messages Tab Component
function MessagesTab({
  conversations,
  onSelectConversation,
}: {
  conversations: Conversation[];
  onSelectConversation: (conv: Conversation) => void;
}) {
  return (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Guest Messages</Text>
      {conversations.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>💬</Text>
          <Text style={styles.emptyText}>No messages</Text>
        </View>
      ) : (
        conversations.map((conv) => (
          <TouchableOpacity
            key={conv.id}
            style={styles.conversationCard}
            onPress={() => onSelectConversation(conv)}
          >
            <View style={styles.conversationAvatar}>
              <Text style={styles.conversationInitial}>{conv.guest_name[0]}</Text>
            </View>
            <View style={styles.conversationContent}>
              <View style={styles.conversationHeader}>
                <Text style={styles.conversationName}>{conv.guest_name}</Text>
                {conv.unread_count > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>{conv.unread_count}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.conversationRoom}>Room {conv.room_number}</Text>
              <Text style={styles.conversationPreview} numberOfLines={1}>
                {conv.last_message}
              </Text>
            </View>
          </TouchableOpacity>
        ))
      )}
    </View>
  );
}

// Profile Tab Component
function ProfileTab({
  status,
  onStatusChange,
  onLogout,
}: {
  status: string;
  onStatusChange: (status: string) => void;
  onLogout: () => void;
}) {
  return (
    <View style={styles.tabContent}>
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <View style={styles.profileAvatar}>
          <Text style={styles.profileInitial}>S</Text>
        </View>
        <Text style={styles.profileName}>Staff Member</Text>
        <Text style={styles.profileRole}>Housekeeping</Text>
      </View>

      {/* Status Selection */}
      <Text style={styles.sectionTitle}>My Status</Text>
      <View style={styles.statusOptions}>
        {(['online', 'busy', 'break'] as const).map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.statusOption, status === s && styles.statusOptionActive]}
            onPress={() => onStatusChange(s)}
          >
            <View
              style={[
                styles.statusDot,
                { backgroundColor: s === 'online' ? '#10B981' : s === 'busy' ? '#EF4444' : '#F59E0B' },
              ]}
            />
            <Text style={[styles.statusOptionText, status === s && styles.statusOptionTextActive]}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Stats */}
      <Text style={styles.sectionTitle}>Today's Stats</Text>
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>12</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>18m</Text>
          <Text style={styles.statLabel}>Avg Time</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>95%</Text>
          <Text style={styles.statLabel}>SLA</Text>
        </View>
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
        <Text style={styles.logoutButtonText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#3B82F6',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#3B82F6',
  },
  badge: {
    backgroundColor: '#EF4444',
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 4,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  requestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  requestRoom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  requestIcon: {
    fontSize: 24,
  },
  requestRoomNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  requestGuest: {
    fontSize: 12,
    color: '#6B7280',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '600',
  },
  requestDescription: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 12,
  },
  requestMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  requestTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  slaBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  slaText: {
    fontSize: 12,
    fontWeight: '600',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: '#3B82F6',
  },
  completeButton: {
    backgroundColor: '#10B981',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  conversationCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  conversationAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  conversationInitial: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  conversationContent: {
    flex: 1,
    marginLeft: 12,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  conversationName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  unreadBadge: {
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  conversationRoom: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  conversationPreview: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 4,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  profileInitial: {
    fontSize: 32,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  profileRole: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  statusOptions: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 8,
    marginBottom: 20,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
  },
  statusOptionActive: {
    backgroundColor: '#EFF6FF',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  statusOptionText: {
    fontSize: 14,
    color: '#374151',
  },
  statusOptionTextActive: {
    fontWeight: '600',
    color: '#3B82F6',
  },
  logoutButton: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#DC2626',
  },
});

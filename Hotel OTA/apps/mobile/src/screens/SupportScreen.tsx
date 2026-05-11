import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
  Modal,
} from 'react-native';
import { AIChatWidget } from '../components/AIChatWidget';

const QUICK_ACTIONS = [
  { icon: '🔍', label: 'Track Booking',   action: 'track' },
  { icon: '✕',  label: 'Cancel Booking',  action: 'cancel' },
  { icon: '🪙', label: 'Coin Issue',       action: 'coin' },
];

// Demo IDs - replace with actual hotel/user IDs from auth context
const DEMO_HOTEL_ID = 'demo-hotel-001';
const DEMO_USER_ID = 'demo-user-001';

const FAQ_ITEMS = [
  {
    question: 'How do I earn OTA Travel Coins?',
    answer:
      'You earn 6% of your booking value as OTA Travel Coins on every hotel booking made through StayOwn. You also earn 2% for QR payments at the hotel and ₹200 for registering competitor stays.',
  },
  {
    question: 'When do my coins expire?',
    answer:
      'OTA Travel Coins expire 12 months from the date of earning. You will receive a notification 30 days before expiry. ReZ Coins have no expiry date.',
  },
  {
    question: 'How long does the refund take after cancellation?',
    answer:
      'Refunds are processed within 5–7 business days to your original payment method. Coins used during booking are reinstated immediately after cancellation.',
  },
  {
    question: 'Can I modify my booking dates?',
    answer:
      'Date modifications are subject to hotel policy and availability. Please contact the hotel directly or reach our support team and we will assist you.',
  },
  {
    question: 'What is the difference between OTA Coins and ReZ Coins?',
    answer:
      'OTA Travel Coins are earned on every StayOwn booking and can be redeemed for discounts on future bookings. ReZ Coins are loyalty rewards tied to your membership tier and have special redemption benefits.',
  },
];

export default function SupportScreen({ navigation }: any) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [showChat, setShowChat] = useState(false);

  function toggleFaq(index: number) {
    setOpenFaq(openFaq === index ? null : index);
  }

  function handleQuickAction(action: string) {
    if (action === 'track') {
      navigation.navigate('Trips');
    } else if (action === 'cancel') {
      navigation.navigate('Trips');
    } else if (action === 'coin') {
      Linking.openURL('mailto:support@stayown.in?subject=Coin%20Issue').catch(() =>
        Alert.alert('Error', 'Could not open email client.')
      );
    }
  }

  function handleChat() {
    setShowChat(true);
  }

  function handleEscalate() {
    Alert.alert(
      'Connecting to Agent',
      'A human agent will be with you shortly. They can help with complex issues, refunds, and special requests.',
      [
        { text: 'Continue with AI', style: 'cancel' },
        {
          text: 'Wait for Agent',
          onPress: () => {
            // In production, this would connect to a live agent via socket
          },
        },
      ]
    );
  }

  function handleCall() {
    Linking.openURL('tel:+918001234567').catch(() =>
      Alert.alert('Error', 'Could not initiate call.')
    );
  }

  function handleEmail() {
    Linking.openURL('mailto:support@stayown.in?subject=Help%20Request').catch(() =>
      Alert.alert('Error', 'Could not open email client.')
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.screenTitle}>Help & Support</Text>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.quickRow}>
        {QUICK_ACTIONS.map((item) => (
          <TouchableOpacity
            key={item.action}
            style={styles.quickCard}
            onPress={() => handleQuickAction(item.action)}
          >
            <Text style={styles.quickIcon}>{item.icon}</Text>
            <Text style={styles.quickLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* FAQ */}
      <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
      <View style={styles.faqContainer}>
        {FAQ_ITEMS.map((faq, index) => (
          <View
            key={index}
            style={[
              styles.faqItem,
              index < FAQ_ITEMS.length - 1 && styles.faqItemBorder,
            ]}
          >
            <TouchableOpacity
              style={styles.faqHeader}
              onPress={() => toggleFaq(index)}
            >
              <Text style={styles.faqQuestion}>{faq.question}</Text>
              <Text style={styles.faqChevron}>
                {openFaq === index ? '−' : '+'}
              </Text>
            </TouchableOpacity>
            {openFaq === index && (
              <Text style={styles.faqAnswer}>{faq.answer}</Text>
            )}
          </View>
        ))}
      </View>

      {/* Contact Us */}
      <Text style={styles.sectionTitle}>Contact Us</Text>
      <View style={styles.contactCard}>
        <TouchableOpacity style={styles.contactRow} onPress={handleChat}>
          <View style={[styles.contactIcon, { backgroundColor: '#dbeafe' }]}>
            <Text style={styles.contactIconText}>💬</Text>
          </View>
          <View style={styles.contactText}>
            <Text style={styles.contactLabel}>Live Chat</Text>
            <Text style={styles.contactDesc}>Typically replies in 2 minutes</Text>
          </View>
          <Text style={styles.contactArrow}>›</Text>
        </TouchableOpacity>

        <View style={styles.contactDivider} />

        <TouchableOpacity style={styles.contactRow} onPress={handleCall}>
          <View style={[styles.contactIcon, { backgroundColor: '#dcfce7' }]}>
            <Text style={styles.contactIconText}>📞</Text>
          </View>
          <View style={styles.contactText}>
            <Text style={styles.contactLabel}>Call Support</Text>
            <Text style={styles.contactDesc}>+91 800 123 4567 · Mon–Sat 9am–7pm</Text>
          </View>
          <Text style={styles.contactArrow}>›</Text>
        </TouchableOpacity>

        <View style={styles.contactDivider} />

        <TouchableOpacity style={styles.contactRow} onPress={handleEmail}>
          <View style={[styles.contactIcon, { backgroundColor: '#fef9c3' }]}>
            <Text style={styles.contactIconText}>✉</Text>
          </View>
          <View style={styles.contactText}>
            <Text style={styles.contactLabel}>Email Us</Text>
            <Text style={styles.contactDesc}>support@stayown.in</Text>
          </View>
          <Text style={styles.contactArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* AI Chat Modal */}
      <Modal
        visible={showChat}
        animationType="slide"
        onRequestClose={() => setShowChat(false)}
      >
        <View style={styles.chatModalContainer}>
          <View style={styles.chatHeader}>
            <TouchableOpacity onPress={() => setShowChat(false)}>
              <Text style={styles.chatCloseButton}>Close</Text>
            </TouchableOpacity>
          </View>
          <AIChatWidget
            hotelId={DEMO_HOTEL_ID}
            userId={DEMO_USER_ID}
            onEscalate={handleEscalate}
          />
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 40 },
  screenTitle: { fontSize: 24, fontWeight: 'bold', color: '#1e293b', marginBottom: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b', marginBottom: 12 },

  // Quick Actions
  quickRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  quickCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  quickIcon: { fontSize: 22, marginBottom: 6 },
  quickLabel: { fontSize: 11, fontWeight: '600', color: '#475569', textAlign: 'center' },

  // FAQ
  faqContainer: {
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  faqItem: { paddingHorizontal: 16, paddingVertical: 4 },
  faqItemBorder: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  faqHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  faqQuestion: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1e293b', lineHeight: 20 },
  faqChevron: { fontSize: 20, color: '#2563eb', fontWeight: '300', marginLeft: 8, lineHeight: 24 },
  faqAnswer: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 20,
    paddingBottom: 14,
  },

  // Contact
  contactCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  contactRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  contactIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  contactIconText: { fontSize: 20 },
  contactText: { flex: 1 },
  contactLabel: { fontSize: 15, fontWeight: '600', color: '#1e293b' },
  contactDesc: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  contactArrow: { fontSize: 22, color: '#cbd5e1' },
  contactDivider: { height: 1, backgroundColor: '#f1f5f9', marginHorizontal: 16 },
  chatModalContainer: { flex: 1, backgroundColor: '#f8fafc' },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  chatCloseButton: { color: '#2563eb', fontSize: 16, fontWeight: '600' },
});

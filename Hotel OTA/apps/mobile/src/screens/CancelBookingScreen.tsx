import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { bookingsApi, formatINR } from '../lib/api';

const REASONS = [
  'Change of plans',
  'Found a better option',
  'Emergency',
  'Other',
];

export default function CancelBookingScreen({ route, navigation }: any) {
  const { bookingId, hotelName, totalPaidPaise, otaCoinUsed, rezCoinUsed } = route.params;
  const [selectedReason, setSelectedReason] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleConfirmCancel() {
    if (!selectedReason) {
      Alert.alert('Select a Reason', 'Please choose a cancellation reason to continue.');
      return;
    }
    setLoading(true);
    try {
      await bookingsApi.cancel(bookingId, selectedReason);
      Alert.alert(
        'Booking Cancelled',
        'Your booking has been cancelled. Refund will be processed within 5–7 business days.',
        [{ text: 'OK', onPress: () => navigation.navigate('Trips') }]
      );
    } catch (err: any) {
      Alert.alert('Cancellation Failed', err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Warning Card */}
      <View style={styles.warningCard}>
        <Text style={styles.warningIcon}>⚠️</Text>
        <Text style={styles.warningTitle}>Cancel Booking?</Text>
        <Text style={styles.warningHotel}>{hotelName}</Text>
        <Text style={styles.warningNote}>
          This action cannot be undone. Please review the refund details below before proceeding.
        </Text>
      </View>

      {/* Refund Info */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Refund Summary</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Cancellation Policy</Text>
          <Text style={[styles.infoValue, styles.greenText]}>Free Cancellation</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Amount Paid</Text>
          <Text style={styles.infoValue}>{formatINR(totalPaidPaise)}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Refund Amount</Text>
          <Text style={[styles.infoValue, styles.greenText]}>{formatINR(totalPaidPaise)}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Refund Timeline</Text>
          <Text style={styles.infoValue}>5–7 business days</Text>
        </View>
      </View>

      {/* Coins Return */}
      {(otaCoinUsed > 0 || rezCoinUsed > 0) && (
        <View style={styles.coinsCard}>
          <Text style={styles.coinsTitle}>Coins Will Be Returned</Text>
          {otaCoinUsed > 0 && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>OTA Coins</Text>
              <Text style={[styles.infoValue, styles.greenText]}>+{formatINR(otaCoinUsed)}</Text>
            </View>
          )}
          {rezCoinUsed > 0 && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>ReZ Coins</Text>
              <Text style={[styles.infoValue, styles.greenText]}>+{formatINR(rezCoinUsed)}</Text>
            </View>
          )}
          <Text style={styles.coinsNote}>
            Coins will be reinstated to your wallet immediately upon cancellation.
          </Text>
        </View>
      )}

      {/* Reason Selector */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Reason for Cancellation</Text>
        {REASONS.map((reason) => (
          <TouchableOpacity
            key={reason}
            style={styles.radioRow}
            onPress={() => setSelectedReason(reason)}
          >
            <View style={[styles.radioOuter, selectedReason === reason && styles.radioOuterSelected]}>
              {selectedReason === reason && <View style={styles.radioInner} />}
            </View>
            <Text style={styles.radioLabel}>{reason}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Action Buttons */}
      <TouchableOpacity
        style={[styles.cancelButton, loading && styles.disabledButton]}
        onPress={handleConfirmCancel}
        disabled={loading}
      >
        <Text style={styles.cancelButtonText}>
          {loading ? 'Cancelling...' : 'Yes, Cancel Booking'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.keepButton}
        onPress={() => navigation.goBack()}
        disabled={loading}
      >
        <Text style={styles.keepButtonText}>Keep My Booking</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 40 },

  warningCard: {
    backgroundColor: '#fff7ed',
    borderRadius: 14,
    padding: 20,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  warningIcon: { fontSize: 32, marginBottom: 8 },
  warningTitle: { fontSize: 20, fontWeight: '800', color: '#c2410c' },
  warningHotel: { fontSize: 15, fontWeight: '600', color: '#ea580c', marginTop: 4 },
  warningNote: { fontSize: 13, color: '#9a3412', textAlign: 'center', marginTop: 8, lineHeight: 18 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  infoLabel: { fontSize: 13, color: '#64748b' },
  infoValue: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
  greenText: { color: '#16a34a' },

  coinsCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  coinsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#15803d',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  coinsNote: { fontSize: 12, color: '#4ade80', marginTop: 6 },

  radioRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  radioOuterSelected: { borderColor: '#2563eb' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#2563eb' },
  radioLabel: { fontSize: 14, color: '#1e293b' },

  cancelButton: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  cancelButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  disabledButton: { opacity: 0.6 },

  keepButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  keepButtonText: { color: '#475569', fontSize: 16, fontWeight: '600' },
});

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Share,
  Alert,
} from 'react-native';
import { formatINR } from '../lib/api';

export default function VoucherScreen({ route }: any) {
  const {
    bookingId,
    bookingRef,
    hotelName,
    address,
    phone,
    checkin,
    checkout,
    room,
    guest,
    amountPaid,
  } = route.params;

  async function handleShare() {
    try {
      await Share.share({
        title: 'StayOwn Booking Voucher',
        message:
          `StayOwn BOOKING VOUCHER\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `Booking Ref: ${bookingRef}\n` +
          `Hotel: ${hotelName}\n` +
          `Address: ${address}\n` +
          `Guest: ${guest}\n` +
          `Room: ${room}\n` +
          `Check-in:  ${checkin}\n` +
          `Check-out: ${checkout}\n` +
          `PAID IN FULL: ${formatINR(amountPaid)}\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `Please show this voucher at check-in.`,
      });
    } catch (err: any) {
      Alert.alert('Share Failed', err.message);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.brandName}>StayOwn</Text>
        <Text style={styles.voucherLabel}>BOOKING VOUCHER</Text>
      </View>

      {/* Main Card */}
      <View style={styles.voucherCard}>
        {/* QR Placeholder */}
        <View style={styles.qrBlock}>
          <View style={styles.qrPlaceholder}>
            <Text style={styles.qrRef}>{bookingRef}</Text>
          </View>
          <Text style={styles.qrHint}>Show this at check-in</Text>
        </View>

        {/* Tear line */}
        <View style={styles.tearLine}>
          {Array.from({ length: 28 }).map((_, i) => (
            <View key={i} style={styles.tearDot} />
          ))}
        </View>

        {/* Hotel Details */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>HOTEL</Text>
          <Text style={styles.hotelName}>{hotelName}</Text>
          <Text style={styles.hotelAddress}>{address}</Text>
          {phone ? <Text style={styles.hotelPhone}>{phone}</Text> : null}
        </View>

        <View style={styles.divider} />

        {/* Guest & Room */}
        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Text style={styles.sectionLabel}>GUEST</Text>
            <Text style={styles.colValue}>{guest}</Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.sectionLabel}>ROOM TYPE</Text>
            <Text style={styles.colValue}>{room}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Dates */}
        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Text style={styles.sectionLabel}>CHECK-IN</Text>
            <Text style={styles.colValue}>{checkin}</Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.sectionLabel}>CHECK-OUT</Text>
            <Text style={styles.colValue}>{checkout}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Paid Banner */}
        <View style={styles.paidBanner}>
          <Text style={styles.paidLabel}>PAID IN FULL</Text>
          <Text style={styles.paidAmount}>{formatINR(amountPaid)}</Text>
        </View>

        {/* Footer */}
        <Text style={styles.footerNote}>
          Powered by StayOwn · Booking ID: {bookingId}
        </Text>
      </View>

      {/* Share Button */}
      <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
        <Text style={styles.shareButtonText}>Share Voucher</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  content: { padding: 20, paddingBottom: 40 },

  header: { alignItems: 'center', marginBottom: 20 },
  brandName: { fontSize: 28, fontWeight: '800', color: '#2563eb', letterSpacing: -0.5 },
  voucherLabel: { fontSize: 11, fontWeight: '700', color: '#94a3b8', letterSpacing: 3, marginTop: 2 },

  voucherCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
    marginBottom: 20,
  },

  qrBlock: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 20, backgroundColor: '#fff' },
  qrPlaceholder: {
    width: 180,
    height: 180,
    borderWidth: 2,
    borderColor: '#1e293b',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  qrRef: { fontSize: 14, fontWeight: '700', color: '#1e293b', fontFamily: 'monospace', textAlign: 'center', padding: 8 },
  qrHint: { fontSize: 12, color: '#94a3b8', marginTop: 10 },

  tearLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginVertical: 0,
    backgroundColor: '#f1f5f9',
    paddingVertical: 6,
  },
  tearDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#cbd5e1' },

  section: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 4 },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  hotelName: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  hotelAddress: { fontSize: 13, color: '#64748b', marginTop: 2, lineHeight: 18 },
  hotelPhone: { fontSize: 13, color: '#2563eb', marginTop: 2 },

  divider: { height: 1, backgroundColor: '#f1f5f9', marginHorizontal: 20, marginVertical: 14 },

  twoCol: { flexDirection: 'row', paddingHorizontal: 20 },
  col: { flex: 1 },
  colValue: { fontSize: 15, fontWeight: '600', color: '#1e293b' },

  paidBanner: {
    backgroundColor: '#f0fdf4',
    marginHorizontal: 20,
    marginTop: 14,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  paidLabel: { fontSize: 11, fontWeight: '700', color: '#16a34a', letterSpacing: 2 },
  paidAmount: { fontSize: 26, fontWeight: '800', color: '#15803d', marginTop: 4 },

  footerNote: {
    fontSize: 10,
    color: '#cbd5e1',
    textAlign: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },

  shareButton: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  shareButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

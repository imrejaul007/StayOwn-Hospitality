import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { bookingsApi, formatINR } from '../lib/api';

export default function PaymentScreen({ route, navigation }: any) {
  const {
    hotel,
    roomType,
    checkin,
    checkout,
    nights,
    guestName,
    guestPhone,
    rateTotal,
    gst,
    subtotal,
    otaCoinApplied,
    rezCoinApplied,
    totalPayable,
  } = route.params as {
    hotel: any;
    roomType: any;
    checkin: string;
    checkout: string;
    nights: number;
    guestName: string;
    guestPhone: string;
    rateTotal: number;
    gst: number;
    subtotal: number;
    otaCoinApplied: number;
    rezCoinApplied: number;
    totalPayable: number;
  };

  const [processing, setProcessing] = useState(false);

  async function handlePay() {
    if (!__DEV__) {
      Alert.alert(
        'Payment Not Available',
        'Payment processing is not yet configured for production. Please contact support.',
      );
      return;
    }

    setProcessing(true);
    try {
      const holdRes = await bookingsApi.hold({
        hotel_id: hotel.hotelId,
        room_type_id: roomType.roomTypeId,
        checkin_date: checkin,
        checkout_date: checkout,
        num_rooms: 1,
        num_guests: 2,
        guest_name: guestName,
        guest_phone: guestPhone,
        channel_source: 'ota_app',
        ota_coin_burn_paise: otaCoinApplied,
        rez_coin_burn_paise: rezCoinApplied,
      });

      // Dev mode only — production path returns early above
      const confirmRes = await bookingsApi.confirm({
        hold_id: holdRes.hold_id,
        razorpay_payment_id: `pay_dev_${Date.now()}`,
        razorpay_signature: 'dev_signature',
      });

      navigation.reset({
        index: 0,
        routes: [
          {
            name: 'BookingConfirmed',
            params: {
              bookingRef: confirmRes.booking_ref || holdRes.booking_ref,
              hotelName: hotel.name,
              checkin,
              checkout,
              totalPayable,
              otaCoinEarned: confirmRes.ota_coin_earned_paise ?? 0,
              rezCoinEarned: confirmRes.rez_coin_earned_paise ?? 0,
            },
          },
        ],
      });
    } catch (err: any) {
      Alert.alert('Payment Failed', err.message);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <View style={styles.container}>
      {/* Compact Booking Summary */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Booking Summary</Text>
        <Text style={styles.hotelName}>{hotel.name}</Text>
        <Text style={styles.meta}>{roomType.name}</Text>
        <Text style={styles.meta}>
          {checkin} → {checkout} · {nights} night{nights !== 1 ? 's' : ''}
        </Text>

        <View style={styles.divider} />

        <View style={styles.row}>
          <Text style={styles.priceLabel}>Room charges</Text>
          <Text style={styles.priceValue}>{formatINR(rateTotal)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.priceLabel}>GST (12%)</Text>
          <Text style={styles.priceValue}>{formatINR(gst)}</Text>
        </View>
        {(otaCoinApplied + rezCoinApplied) > 0 && (
          <View style={styles.row}>
            <Text style={[styles.priceLabel, { color: '#16a34a' }]}>Coins Applied</Text>
            <Text style={[styles.priceValue, { color: '#16a34a' }]}>
              −{formatINR(otaCoinApplied + rezCoinApplied)}
            </Text>
          </View>
        )}
        <View style={[styles.row, styles.totalRow]}>
          <Text style={styles.totalLabel}>Amount to Pay</Text>
          <Text style={styles.totalValue}>{formatINR(totalPayable)}</Text>
        </View>
      </View>

      <View style={{ flex: 1 }} />

      <TouchableOpacity
        style={[styles.payButton, processing && styles.payButtonDisabled]}
        onPress={handlePay}
        disabled={processing}
      >
        <Text style={styles.payText}>Pay {formatINR(totalPayable)}</Text>
      </TouchableOpacity>

      {/* Loading Overlay */}
      {processing && (
        <View style={styles.overlay}>
          <View style={styles.overlayBox}>
            <ActivityIndicator color="#2563eb" size="large" />
            <Text style={styles.overlayText}>Processing payment...</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 12 },
  hotelName: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  meta: { fontSize: 13, color: '#64748b', marginTop: 4 },
  divider: { borderBottomWidth: 1, borderBottomColor: '#e2e8f0', marginVertical: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  priceLabel: { fontSize: 14, color: '#64748b' },
  priceValue: { fontSize: 14, color: '#1e293b', fontWeight: '500' },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 10,
    marginTop: 4,
    marginBottom: 0,
  },
  totalLabel: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  totalValue: { fontSize: 20, fontWeight: '700', color: '#2563eb' },
  payButton: {
    backgroundColor: '#16a34a',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    marginBottom: 8,
  },
  payButtonDisabled: { opacity: 0.6 },
  payText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    gap: 16,
  },
  overlayText: { fontSize: 15, color: '#1e293b', fontWeight: '500', marginTop: 12 },
});

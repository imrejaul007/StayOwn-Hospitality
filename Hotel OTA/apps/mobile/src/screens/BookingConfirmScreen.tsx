import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { bookingsApi, formatINR } from '../lib/api';

export default function BookingConfirmScreen({ route, navigation }: any) {
  const { holdId, bookingRef, totalValuePaise, pgAmountPaise, razorpayOrderId, hotelName, checkin, checkout } = route.params;
  const [loading, setLoading] = useState(false);

  async function handlePayment() {
    if (!__DEV__) {
      Alert.alert(
        'Payment Not Available',
        'Payment processing is not yet configured for production. Please contact support.',
      );
      return;
    }

    setLoading(true);
    try {
      // Dev mode only — production path returns early above
      const result = await bookingsApi.confirm({
        hold_id: holdId,
        razorpay_payment_id: `pay_dev_${Date.now()}`,
        razorpay_signature: 'dev_signature',
      });

      Alert.alert(
        'Booking Confirmed!',
        `Ref: ${result.booking_ref}\nEarned: ${formatINR(result.ota_coin_earned_paise)} OTA Coins`,
        [{ text: 'OK', onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Main' }] }) }]
      );
    } catch (err: any) {
      Alert.alert('Payment Failed', err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Confirm Booking</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Hotel</Text>
          <Text style={styles.value}>{hotelName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Booking Ref</Text>
          <Text style={styles.valueMono}>{bookingRef}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Dates</Text>
          <Text style={styles.value}>{checkin} → {checkout}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <Text style={styles.label}>Total Value</Text>
          <Text style={styles.value}>{formatINR(totalValuePaise)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={[styles.label, { fontWeight: '700' }]}>Amount to Pay</Text>
          <Text style={[styles.value, styles.priceHighlight]}>{formatINR(pgAmountPaise)}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.payButton} onPress={handlePayment} disabled={loading}>
        <Text style={styles.payButtonText}>{loading ? 'Processing...' : `Pay ${formatINR(pgAmountPaise)}`}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16, justifyContent: 'space-between' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1e293b', marginBottom: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  label: { fontSize: 14, color: '#64748b' },
  value: { fontSize: 14, color: '#1e293b', fontWeight: '500' },
  valueMono: { fontSize: 14, color: '#1e293b', fontFamily: 'monospace' },
  priceHighlight: { fontSize: 20, fontWeight: '700', color: '#2563eb' },
  divider: { borderBottomWidth: 1, borderBottomColor: '#e2e8f0', marginVertical: 12 },
  payButton: { backgroundColor: '#16a34a', borderRadius: 14, padding: 18, alignItems: 'center' },
  payButtonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});

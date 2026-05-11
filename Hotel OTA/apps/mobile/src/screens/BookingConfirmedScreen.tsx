import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { formatINR } from '../lib/api';

export default function BookingConfirmedScreen({ route, navigation }: any) {
  const { bookingRef, hotelName, checkin, checkout, totalPayable, otaCoinEarned, rezCoinEarned } =
    route.params as {
      bookingRef: string;
      hotelName: string;
      checkin: string;
      checkout: string;
      totalPayable: number;
      otaCoinEarned: number;
      rezCoinEarned: number;
    };

  const scale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 4,
      tension: 60,
      useNativeDriver: true,
    }).start();
  }, [scale]);

  function handleViewBooking() {
    navigation.reset({ index: 0, routes: [{ name: 'Main', params: { screen: 'Trips' } }] });
  }

  function handleHome() {
    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  }

  return (
    <View style={styles.container}>
      {/* Animated Checkmark */}
      <Animated.View style={[styles.checkCircle, { transform: [{ scale }] }]}>
        <Text style={styles.checkIcon}>✓</Text>
      </Animated.View>

      <Text style={styles.confirmedTitle}>Booking Confirmed!</Text>
      <Text style={styles.refText}>{bookingRef}</Text>

      {/* Coins Earned */}
      {(otaCoinEarned > 0 || rezCoinEarned > 0) ? (
        <View style={styles.coinsCard}>
          <Text style={styles.coinsTitle}>You Earned</Text>
          {otaCoinEarned > 0 && (
            <Text style={styles.coinLine}>🪙 {formatINR(otaCoinEarned)} OTA Coins</Text>
          )}
          {rezCoinEarned > 0 && (
            <Text style={styles.coinLine}>💎 {formatINR(rezCoinEarned)} ReZ Coins</Text>
          )}
        </View>
      ) : null}

      {/* Booking Summary */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Hotel</Text>
          <Text style={styles.summaryValue}>{hotelName}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Dates</Text>
          <Text style={styles.summaryValue}>{checkin} → {checkout}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Amount Paid</Text>
          <Text style={styles.summaryValue}>{formatINR(totalPayable)}</Text>
        </View>
      </View>

      {/* Buttons */}
      <View style={styles.buttonsRow}>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleViewBooking}>
          <Text style={styles.secondaryText}>View Booking</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryButton} onPress={handleHome}>
          <Text style={styles.primaryText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#16a34a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  checkIcon: { color: '#fff', fontSize: 40, fontWeight: '700', lineHeight: 48 },
  confirmedTitle: { fontSize: 26, fontWeight: 'bold', color: '#1e293b', marginBottom: 6 },
  refText: { fontSize: 13, color: '#94a3b8', fontFamily: 'monospace', marginBottom: 24 },
  coinsCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 14,
    padding: 16,
    width: '100%',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  coinsTitle: { fontSize: 14, fontWeight: '700', color: '#15803d', marginBottom: 6 },
  coinLine: { fontSize: 15, color: '#16a34a', fontWeight: '600', marginBottom: 4 },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    width: '100%',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: { fontSize: 14, color: '#64748b' },
  summaryValue: { fontSize: 14, color: '#1e293b', fontWeight: '500', flex: 1, textAlign: 'right' },
  buttonsRow: { flexDirection: 'row', gap: 12, width: '100%' },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#2563eb',
  },
  secondaryText: { color: '#2563eb', fontWeight: '700', fontSize: 14 },
  primaryButton: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

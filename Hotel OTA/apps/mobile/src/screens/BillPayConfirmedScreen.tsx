import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ScrollView,
} from 'react-native';
import { formatINR } from '../lib/api';

export default function BillPayConfirmedScreen({ route, navigation }: any) {
  const {
    hotelName,
    billAmountPaise,
    amountPaidPaise,
    otaCoinEarnedPaise,
    rezCoinEarnedPaise,
    paymentRef,
  } = route.params as {
    hotelName: string;
    billAmountPaise: number;
    amountPaidPaise: number;
    otaCoinEarnedPaise: number;
    rezCoinEarnedPaise: number;
    paymentRef: string;
  };

  const scale = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scale, {
        toValue: 1,
        friction: 4,
        tension: 60,
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scale, fade]);

  function handleSearchHotels() {
    navigation.reset({ index: 0, routes: [{ name: 'Main', params: { screen: 'Search' } }] });
  }

  function handleHome() {
    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Animated checkmark */}
      <Animated.View style={[styles.checkCircle, { transform: [{ scale }] }]}>
        <Text style={styles.checkIcon}>✓</Text>
      </Animated.View>

      <Text style={styles.title}>Payment Successful!</Text>
      <Text style={styles.ref}>{paymentRef}</Text>

      {/* Main summary */}
      <Animated.View style={[styles.summaryCard, { opacity: fade }]}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Hotel</Text>
          <Text style={styles.rowValue} numberOfLines={2}>{hotelName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Bill Settled</Text>
          <Text style={styles.rowValue}>{formatINR(billAmountPaise)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Amount Paid</Text>
          <Text style={[styles.rowValue, styles.boldValue]}>{formatINR(amountPaidPaise)}</Text>
        </View>
      </Animated.View>

      {/* Coins earned */}
      {(otaCoinEarnedPaise > 0 || rezCoinEarnedPaise > 0) && (
        <Animated.View style={[styles.coinsCard, { opacity: fade }]}>
          <Text style={styles.coinsTitle}>Coins Earned</Text>
          {otaCoinEarnedPaise > 0 && (
            <View style={styles.coinLine}>
              <Text style={styles.coinEmoji}>OTA</Text>
              <Text style={styles.coinAmount}>+ {formatINR(otaCoinEarnedPaise)}</Text>
              <Text style={styles.coinType}>OTA Coins</Text>
            </View>
          )}
          {rezCoinEarnedPaise > 0 && (
            <View style={styles.coinLine}>
              <Text style={styles.coinEmoji}>ReZ</Text>
              <Text style={styles.coinAmount}>+ {formatINR(rezCoinEarnedPaise)}</Text>
              <Text style={styles.coinType}>ReZ Coins</Text>
            </View>
          )}
        </Animated.View>
      )}

      {/* Upsell nudge */}
      <Animated.View style={[styles.nudgeCard, { opacity: fade }]}>
        <Text style={styles.nudgeTitle}>Earn even more next time!</Text>
        <Text style={styles.nudgeText}>
          Book directly through OTA to earn up to 3× more coins on your stay.
        </Text>
      </Animated.View>

      {/* CTA buttons */}
      <Animated.View style={[styles.buttonsCol, { opacity: fade }]}>
        <TouchableOpacity style={styles.primaryButton} onPress={handleSearchHotels}>
          <Text style={styles.primaryButtonText}>Search Hotels</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleHome}>
          <Text style={styles.secondaryButtonText}>Back to Home</Text>
        </TouchableOpacity>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: {
    padding: 24,
    paddingBottom: 48,
    alignItems: 'center',
  },

  checkCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#16a34a',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 32,
    shadowColor: '#16a34a',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  checkIcon: { color: '#fff', fontSize: 44, fontWeight: '800', lineHeight: 52 },

  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 6,
    textAlign: 'center',
  },
  ref: {
    fontSize: 12,
    color: '#94a3b8',
    fontFamily: 'monospace',
    marginBottom: 28,
    letterSpacing: 1,
  },

  summaryCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  rowLabel: { fontSize: 14, color: '#64748b', flex: 1 },
  rowValue: { fontSize: 14, color: '#1e293b', fontWeight: '500', flex: 1, textAlign: 'right' },
  boldValue: { fontWeight: '800', fontSize: 16, color: '#2563eb' },

  coinsCard: {
    width: '100%',
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  coinsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#15803d',
    marginBottom: 10,
  },
  coinLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  coinEmoji: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
    backgroundColor: '#16a34a',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
    overflow: 'hidden',
  },
  coinAmount: { fontSize: 16, fontWeight: '800', color: '#16a34a', marginRight: 6 },
  coinType: { fontSize: 13, color: '#15803d' },

  nudgeCard: {
    width: '100%',
    backgroundColor: '#eff6ff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  nudgeTitle: { fontSize: 14, fontWeight: '700', color: '#1d4ed8', marginBottom: 4 },
  nudgeText: { fontSize: 13, color: '#3b82f6', lineHeight: 18 },

  buttonsCol: { width: '100%', gap: 10 },
  primaryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondaryButton: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  secondaryButtonText: { color: '#64748b', fontWeight: '600', fontSize: 14 },
});

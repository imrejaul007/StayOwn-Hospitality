import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { walletApi, formatINR } from '../lib/api';

// Maximum percentage of total that coins can cover
const MAX_COIN_PCT = 0.5;

export default function CoinApplyScreen({ route, navigation }: any) {
  const { subtotal, otaCoinApplied: initOta = 0, rezCoinApplied: initRez = 0 } =
    route.params as { subtotal: number; otaCoinApplied: number; rezCoinApplied: number };

  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [otaInput, setOtaInput] = useState(String(initOta / 100));
  const [rezInput, setRezInput] = useState(String(initRez / 100));

  useEffect(() => {
    walletApi
      .getBalance()
      .then(setWallet)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const maxUsablePaise = Math.floor(subtotal * MAX_COIN_PCT);
  const otaBalance = wallet?.ota_coin_balance_paise ?? 0;
  const rezBalance = wallet?.rez_coin_balance_paise ?? 0;

  const otaMaxPaise = Math.min(otaBalance, maxUsablePaise);
  const rezMaxPaise = Math.min(rezBalance, maxUsablePaise);

  const otaPaise = Math.min(Math.max(Math.round(parseFloat(otaInput || '0') * 100), 0), otaMaxPaise);
  const rezPaise = Math.min(Math.max(Math.round(parseFloat(rezInput || '0') * 100), 0), rezMaxPaise);

  const youPay = Math.max(subtotal - otaPaise - rezPaise, 0);

  function handleConfirm() {
    // Navigate back to BookingReview with coin amounts via route params merge
    navigation.navigate('BookingReview', {
      otaCoinApplied: otaPaise,
      rezCoinApplied: rezPaise,
    });
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.pageTitle}>Apply Rewards</Text>

      {/* OTA Coins */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.coinTitle}>🪙 OTA Coins</Text>
          <Text style={styles.balance}>Balance: {formatINR(otaBalance)}</Text>
        </View>
        <Text style={styles.maxNote}>Max usable: {formatINR(otaMaxPaise)}</Text>
        <View style={styles.inputRow}>
          <Text style={styles.rupee}>₹</Text>
          <TextInput
            style={styles.input}
            value={otaInput}
            onChangeText={setOtaInput}
            keyboardType="decimal-pad"
            placeholder="0"
          />
          <TouchableOpacity
            style={styles.maxButton}
            onPress={() => setOtaInput(String(otaMaxPaise / 100))}
          >
            <Text style={styles.maxButtonText}>MAX</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ReZ Coins */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.coinTitle}>💎 ReZ Coins</Text>
          <Text style={styles.balance}>Balance: {formatINR(rezBalance)}</Text>
        </View>
        <Text style={styles.maxNote}>Max usable: {formatINR(rezMaxPaise)}</Text>
        <View style={styles.inputRow}>
          <Text style={styles.rupee}>₹</Text>
          <TextInput
            style={styles.input}
            value={rezInput}
            onChangeText={setRezInput}
            keyboardType="decimal-pad"
            placeholder="0"
          />
          <TouchableOpacity
            style={styles.maxButton}
            onPress={() => setRezInput(String(rezMaxPaise / 100))}
          >
            <Text style={styles.maxButtonText}>MAX</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Summary */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Booking Total</Text>
          <Text style={styles.summaryValue}>{formatINR(subtotal)}</Text>
        </View>
        {otaPaise > 0 && (
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: '#16a34a' }]}>OTA Coins</Text>
            <Text style={[styles.summaryValue, { color: '#16a34a' }]}>−{formatINR(otaPaise)}</Text>
          </View>
        )}
        {rezPaise > 0 && (
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: '#16a34a' }]}>ReZ Coins</Text>
            <Text style={[styles.summaryValue, { color: '#16a34a' }]}>−{formatINR(rezPaise)}</Text>
          </View>
        )}
        <View style={[styles.summaryRow, styles.summaryTotal]}>
          <Text style={styles.summaryTotalLabel}>You Pay</Text>
          <Text style={styles.summaryTotalValue}>{formatINR(youPay)}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
        <Text style={styles.confirmText}>Confirm & Continue</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pageTitle: { fontSize: 22, fontWeight: 'bold', color: '#1e293b', marginBottom: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  coinTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  balance: { fontSize: 13, color: '#64748b' },
  maxNote: { fontSize: 12, color: '#94a3b8', marginTop: 4, marginBottom: 10 },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  rupee: { fontSize: 18, color: '#64748b', marginRight: 6 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    marginRight: 8,
  },
  maxButton: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  maxButtonText: { color: '#2563eb', fontWeight: '700', fontSize: 12 },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontSize: 14, color: '#64748b' },
  summaryValue: { fontSize: 14, color: '#1e293b', fontWeight: '500' },
  summaryTotal: {
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 10,
    marginTop: 4,
  },
  summaryTotalLabel: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  summaryTotalValue: { fontSize: 20, fontWeight: '700', color: '#2563eb' },
  confirmButton: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
  },
  confirmText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

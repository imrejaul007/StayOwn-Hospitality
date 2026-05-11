import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { walletApi, formatINR } from '../lib/api';
import { useFocusEffect } from '@react-navigation/native';

interface Transaction {
  id: string;
  coinType: string;
  type: string;
  amountPaise: number;
  direction: string;
  description: string;
  bookingRef: string | null;
  createdAt: string;
}

export default function WalletScreen() {
  const [wallet, setWallet] = useState<any>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      Promise.all([walletApi.get(), walletApi.transactions()])
        .then(([w, t]) => { setWallet(w); setTransactions(t.transactions); })
        .catch(console.error)
        .finally(() => setLoading(false));
    }, [])
  );

  if (loading) return <View style={styles.center}><Text>Loading...</Text></View>;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Travel Savings</Text>

      <View style={styles.balanceCard}>
        <View style={styles.balanceRow}>
          <View style={styles.balanceItem}>
            <Text style={styles.balanceLabel}>OTA Coins</Text>
            <Text style={styles.balanceValue}>{formatINR(wallet?.ota_coin_balance_paise || 0)}</Text>
          </View>
          <View style={styles.balanceDivider} />
          <View style={styles.balanceItem}>
            <Text style={styles.balanceLabel}>ReZ Coins</Text>
            <Text style={styles.balanceValue}>{formatINR(wallet?.rez_coin_balance_paise || 0)}</Text>
          </View>
        </View>
        {wallet?.ota_coin_expiring_soon_paise > 0 && (
          <Text style={styles.expiryWarning}>
            {formatINR(wallet.ota_coin_expiring_soon_paise)} expiring soon
          </Text>
        )}
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Lifetime Earned</Text>
          <Text style={styles.statValue}>{formatINR(wallet?.lifetime_ota_earned_paise || 0)}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Lifetime Used</Text>
          <Text style={styles.statValue}>{formatINR(wallet?.lifetime_ota_burned_paise || 0)}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Transaction History</Text>
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.txRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.txDesc}>{item.description}</Text>
              <Text style={styles.txMeta}>{item.coinType.toUpperCase()} · {new Date(item.createdAt).toLocaleDateString()}</Text>
            </View>
            <Text style={[styles.txAmount, { color: item.direction === 'credit' ? '#16a34a' : '#ef4444' }]}>
              {item.direction === 'credit' ? '+' : '-'}{formatINR(item.amountPaise)}
            </Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No transactions yet</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1e293b', marginBottom: 16 },
  balanceCard: { backgroundColor: '#2563eb', borderRadius: 16, padding: 24, marginBottom: 16 },
  balanceRow: { flexDirection: 'row' },
  balanceItem: { flex: 1, alignItems: 'center' },
  balanceLabel: { color: '#bfdbfe', fontSize: 13 },
  balanceValue: { color: '#fff', fontSize: 24, fontWeight: '700', marginTop: 4 },
  balanceDivider: { width: 1, backgroundColor: '#3b82f6', marginHorizontal: 16 },
  expiryWarning: { color: '#fbbf24', fontSize: 12, textAlign: 'center', marginTop: 12 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statBox: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  statLabel: { fontSize: 12, color: '#64748b' },
  statValue: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginTop: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 12 },
  txRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8 },
  txDesc: { fontSize: 14, color: '#1e293b', fontWeight: '500' },
  txMeta: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  txAmount: { fontSize: 16, fontWeight: '700' },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40 },
});

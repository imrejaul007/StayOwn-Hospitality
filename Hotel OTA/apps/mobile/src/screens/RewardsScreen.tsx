import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { walletApi, formatINR } from '../lib/api';
import { useFocusEffect } from '@react-navigation/native';

const TIER_CONFIG: Record<string, { color: string; bg: string; next: string; threshold: number }> = {
  Basic:  { color: '#64748b', bg: '#f1f5f9', next: 'Silver', threshold: 50000 },
  Silver: { color: '#64748b', bg: '#f0f9ff', next: 'Gold',   threshold: 200000 },
  Gold:   { color: '#f59e0b', bg: '#fef9c3', next: '',       threshold: 0 },
};

const EARN_CARDS = [
  { icon: '🏨', title: 'Book a Hotel',      desc: 'Earn 6% of booking value',  value: '+6%' },
  { icon: '📷', title: 'QR Pay at Hotel',   desc: 'Scan & pay on property',    value: '+2%' },
  { icon: '✅', title: 'Register a Stay',   desc: 'Competitor booking verified', value: '+₹200' },
];

export default function RewardsScreen({ navigation }: any) {
  const [wallet, setWallet] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  async function load() {
    setLoading(true);
    try {
      const [w, t] = await Promise.all([walletApi.get(), walletApi.transactions()]);
      setWallet(w);
      setTransactions((t.transactions || []).slice(0, 5));
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Loading rewards...</Text>
      </View>
    );
  }

  const otaBal = wallet?.ota_coin_balance_paise || 0;
  const rezBal = wallet?.rez_coin_balance_paise || 0;
  const totalValue = otaBal + rezBal;
  const tier = wallet?.tier || 'Basic';
  const tierCfg = TIER_CONFIG[tier] || TIER_CONFIG.Basic;
  const lifetimeEarned = wallet?.lifetime_ota_earned_paise || 0;
  const progressPct = tierCfg.threshold > 0
    ? Math.min((lifetimeEarned / tierCfg.threshold) * 100, 100)
    : 100;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.screenTitle}>Rewards</Text>

      {/* Hero Gradient Card */}
      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>Total Wallet Value</Text>
        <Text style={styles.heroValue}>{formatINR(totalValue)}</Text>
        <View style={styles.heroCoins}>
          <View style={styles.heroCoinItem}>
            <Text style={styles.heroCoinLabel}>OTA Coins</Text>
            <Text style={styles.heroCoinValue}>{formatINR(otaBal)}</Text>
          </View>
          <View style={styles.heroCoinDivider} />
          <View style={styles.heroCoinItem}>
            <Text style={styles.heroCoinLabel}>ReZ Coins</Text>
            <Text style={styles.heroCoinValue}>{formatINR(rezBal)}</Text>
          </View>
        </View>
        {(wallet?.ota_coin_expiring_soon_paise || 0) > 0 && (
          <View style={styles.expiryBadge}>
            <Text style={styles.expiryText}>
              ⚠  {formatINR(wallet.ota_coin_expiring_soon_paise)} expiring soon
            </Text>
          </View>
        )}
      </View>

      {/* Tier Card */}
      <View style={[styles.tierCard, { borderColor: tierCfg.bg }]}>
        <View style={styles.tierRow}>
          <View style={[styles.tierBadge, { backgroundColor: tierCfg.bg }]}>
            <Text style={[styles.tierBadgeText, { color: tierCfg.color }]}>{tier}</Text>
          </View>
          <View style={styles.tierInfo}>
            <Text style={styles.tierTitle}>{tier} Member</Text>
            {tierCfg.next ? (
              <Text style={styles.tierSubtitle}>
                {formatINR(tierCfg.threshold - lifetimeEarned)} to {tierCfg.next}
              </Text>
            ) : (
              <Text style={styles.tierSubtitle}>Top tier achieved!</Text>
            )}
          </View>
        </View>
        {tierCfg.threshold > 0 && (
          <>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progressPct}%` as any }]} />
            </View>
            <View style={styles.progressLabels}>
              <Text style={styles.progressLabelLeft}>{tier}</Text>
              <Text style={styles.progressLabelRight}>{tierCfg.next}</Text>
            </View>
          </>
        )}
      </View>

      {/* How to Earn */}
      <Text style={styles.sectionTitle}>How to Earn</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.earnRow}
      >
        {EARN_CARDS.map((card) => (
          <View key={card.title} style={styles.earnCard}>
            <Text style={styles.earnIcon}>{card.icon}</Text>
            <Text style={styles.earnValue}>{card.value}</Text>
            <Text style={styles.earnTitle}>{card.title}</Text>
            <Text style={styles.earnDesc}>{card.desc}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Recent Transactions */}
      <View style={styles.txHeader}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <TouchableOpacity onPress={() => navigation.navigate('CoinHistory')}>
          <Text style={styles.viewAll}>View Full History →</Text>
        </TouchableOpacity>
      </View>

      {transactions.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>No transactions yet</Text>
        </View>
      ) : (
        transactions.map((tx) => (
          <View key={tx.id} style={styles.txRow}>
            <View style={styles.txIconWrap}>
              <Text style={styles.txIcon}>
                {tx.direction === 'credit' ? '⬆' : '⬇'}
              </Text>
            </View>
            <View style={styles.txBody}>
              <Text style={styles.txDesc}>{tx.description}</Text>
              <Text style={styles.txMeta}>
                {tx.coinType?.toUpperCase()} · {new Date(tx.createdAt).toLocaleDateString('en-IN')}
              </Text>
            </View>
            <Text style={[styles.txAmount, { color: tx.direction === 'credit' ? '#16a34a' : '#ef4444' }]}>
              {tx.direction === 'credit' ? '+' : '-'}{formatINR(tx.amountPaise)}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  loadingText: { fontSize: 15, color: '#64748b' },

  screenTitle: { fontSize: 24, fontWeight: 'bold', color: '#1e293b', marginBottom: 16 },

  heroCard: {
    backgroundColor: '#1d4ed8',
    borderRadius: 20,
    padding: 24,
    marginBottom: 14,
    shadowColor: '#2563eb',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
  },
  heroLabel: { fontSize: 12, color: '#bfdbfe', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  heroValue: { fontSize: 36, fontWeight: '800', color: '#fff', marginTop: 4 },
  heroCoins: { flexDirection: 'row', marginTop: 20, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 14 },
  heroCoinItem: { flex: 1, alignItems: 'center' },
  heroCoinLabel: { fontSize: 11, color: '#93c5fd' },
  heroCoinValue: { fontSize: 17, fontWeight: '700', color: '#fff', marginTop: 2 },
  heroCoinDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginHorizontal: 12 },
  expiryBadge: {
    backgroundColor: 'rgba(251,191,36,0.15)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  expiryText: { fontSize: 12, color: '#fbbf24', fontWeight: '600' },

  tierCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  tierRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  tierBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginRight: 12 },
  tierBadgeText: { fontSize: 14, fontWeight: '700' },
  tierInfo: { flex: 1 },
  tierTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  tierSubtitle: { fontSize: 12, color: '#64748b', marginTop: 2 },
  progressTrack: { height: 8, backgroundColor: '#e2e8f0', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: '#2563eb', borderRadius: 4 },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  progressLabelLeft: { fontSize: 10, color: '#94a3b8' },
  progressLabelRight: { fontSize: 10, color: '#94a3b8' },

  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 12 },

  earnRow: { gap: 12, paddingRight: 4, marginBottom: 20 },
  earnCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    width: 140,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  earnIcon: { fontSize: 24, marginBottom: 6 },
  earnValue: { fontSize: 18, fontWeight: '800', color: '#2563eb' },
  earnTitle: { fontSize: 13, fontWeight: '600', color: '#1e293b', marginTop: 4 },
  earnDesc: { fontSize: 11, color: '#64748b', marginTop: 2, lineHeight: 15 },

  txHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  viewAll: { fontSize: 13, color: '#2563eb', fontWeight: '600' },

  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  txIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  txIcon: { fontSize: 14 },
  txBody: { flex: 1 },
  txDesc: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
  txMeta: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: '700' },

  emptyBox: { alignItems: 'center', paddingVertical: 30 },
  emptyText: { fontSize: 14, color: '#94a3b8' },
});

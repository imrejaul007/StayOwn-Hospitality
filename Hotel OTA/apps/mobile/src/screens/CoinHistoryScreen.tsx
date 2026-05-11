import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { walletApi, formatINR } from '../lib/api';
import { useFocusEffect } from '@react-navigation/native';

type CoinTab = 'ota' | 'rez';
type FilterType = 'all' | 'credit' | 'debit' | 'expired';

const FILTER_LABELS: { key: FilterType; label: string }[] = [
  { key: 'all',     label: 'All' },
  { key: 'credit',  label: 'Earned' },
  { key: 'debit',   label: 'Used' },
  { key: 'expired', label: 'Expired' },
];

interface Transaction {
  id: string;
  coinType: string;
  type: string;
  direction: string;
  amountPaise: number;
  description: string;
  bookingRef: string | null;
  createdAt: string;
  expiresAt?: string | null;
}

export default function CoinHistoryScreen() {
  const [activeTab, setActiveTab] = useState<CoinTab>('ota');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [expirySchedule, setExpirySchedule] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 20;

  useFocusEffect(
    useCallback(() => {
      setPage(1);
      setTransactions([]);
      loadTransactions(1, true);
    }, [activeTab, activeFilter])
  );

  async function loadTransactions(pageNum: number, replace = false) {
    setLoading(true);
    try {
      const coinType = activeTab;
      const data = await walletApi.transactions(coinType);
      let txs: Transaction[] = data.transactions || [];

      if (activeFilter === 'credit')  txs = txs.filter((t) => t.direction === 'credit');
      if (activeFilter === 'debit')   txs = txs.filter((t) => t.direction === 'debit');
      if (activeFilter === 'expired') txs = txs.filter((t) => t.type === 'expired');

      const start = (pageNum - 1) * PAGE_SIZE;
      const pageTxs = txs.slice(start, start + PAGE_SIZE);

      setTransactions(replace ? pageTxs : (prev) => [...prev, ...pageTxs]);
      setHasMore(start + PAGE_SIZE < txs.length);

      if (activeTab === 'ota' && data.expirySchedule) {
        setExpirySchedule(data.expirySchedule);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  function loadMore() {
    if (!hasMore || loading) return;
    const next = page + 1;
    setPage(next);
    loadTransactions(next, false);
  }

  function txIcon(tx: Transaction) {
    if (tx.type === 'expired') return '⏱';
    if (tx.direction === 'credit') return '⬆';
    return '⬇';
  }

  function txColor(tx: Transaction) {
    if (tx.type === 'expired') return '#94a3b8';
    return tx.direction === 'credit' ? '#16a34a' : '#ef4444';
  }

  function renderTransaction({ item }: { item: Transaction }) {
    return (
      <View style={styles.txRow}>
        <View style={[styles.txIconWrap, { backgroundColor: txColor(item) + '18' }]}>
          <Text style={styles.txIcon}>{txIcon(item)}</Text>
        </View>
        <View style={styles.txBody}>
          <Text style={styles.txDesc}>{item.description}</Text>
          <Text style={styles.txMeta}>
            {new Date(item.createdAt).toLocaleDateString('en-IN', {
              day: 'numeric', month: 'short', year: 'numeric',
            })}
            {item.bookingRef ? ` · ${item.bookingRef}` : ''}
          </Text>
        </View>
        <Text style={[styles.txAmount, { color: txColor(item) }]}>
          {item.direction === 'credit' ? '+' : '-'}{formatINR(item.amountPaise)}
        </Text>
      </View>
    );
  }

  function renderFooter() {
    if (activeTab !== 'ota' || expirySchedule.length === 0) return null;
    return (
      <View style={styles.expirySection}>
        <Text style={styles.expirySectionTitle}>Upcoming Expiry</Text>
        {expirySchedule.map((item, idx) => (
          <View key={idx} style={styles.expiryRow}>
            <Text style={styles.expiryDate}>{item.expiresAt}</Text>
            <Text style={styles.expiryAmount}>{formatINR(item.amountPaise)} expiring</Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'ota' && styles.tabActive]}
          onPress={() => { setActiveTab('ota'); setActiveFilter('all'); }}
        >
          <Text style={[styles.tabText, activeTab === 'ota' && styles.tabTextActive]}>
            Travel Coins
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'rez' && styles.tabActive]}
          onPress={() => { setActiveTab('rez'); setActiveFilter('all'); }}
        >
          <Text style={[styles.tabText, activeTab === 'rez' && styles.tabTextActive]}>
            ReZ Coins
          </Text>
        </TouchableOpacity>
      </View>

      {/* Filter Chips */}
      <View style={styles.filterRow}>
        {FILTER_LABELS.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[styles.chip, activeFilter === key && styles.chipActive]}
            onPress={() => setActiveFilter(key)}
          >
            <Text style={[styles.chipText, activeFilter === key && styles.chipTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Transaction List */}
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={renderTransaction}
        contentContainerStyle={styles.listContent}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              {loading ? 'Loading...' : 'No transactions yet'}
            </Text>
          </View>
        }
        ListFooterComponent={renderFooter}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#2563eb' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#94a3b8' },
  tabTextActive: { color: '#2563eb' },

  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  chipText: { fontSize: 13, fontWeight: '500', color: '#64748b' },
  chipTextActive: { color: '#fff' },

  listContent: { padding: 16, paddingBottom: 30 },

  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  txIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  txIcon: { fontSize: 15 },
  txBody: { flex: 1 },
  txDesc: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
  txMeta: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  txAmount: { fontSize: 14, fontWeight: '700' },

  emptyBox: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 14, color: '#94a3b8' },

  expirySection: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  expirySectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ea580c',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  expiryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#fef3c7',
  },
  expiryDate: { fontSize: 13, color: '#64748b' },
  expiryAmount: { fontSize: 13, fontWeight: '600', color: '#ea580c' },
});

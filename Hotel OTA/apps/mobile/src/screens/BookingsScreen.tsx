import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { bookingsApi, formatINR } from '../lib/api';
import { useFocusEffect } from '@react-navigation/native';

interface BookingItem {
  bookingId: string;
  bookingRef: string;
  status: string;
  hotelName: string;
  checkinDate: string;
  checkoutDate: string;
  totalValuePaise: number;
}

export default function BookingsScreen({ navigation }: any) {
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [filter, setFilter] = useState('upcoming');
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => { load(); }, [filter])
  );

  async function load() {
    setLoading(true);
    try {
      const data = await bookingsApi.list(filter);
      setBookings(data.bookings);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  const statusColors: Record<string, string> = {
    hold: '#f59e0b', confirmed: '#2563eb', checked_in: '#16a34a',
    stayed: '#6b7280', cancelled: '#ef4444',
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Bookings</Text>

      <View style={styles.filters}>
        {['upcoming', 'past', 'cancelled'].map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterButton, filter === f && styles.filterActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={bookings}
        keyExtractor={(item) => item.bookingId}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.hotelName}>{item.hotelName}</Text>
              <View style={[styles.statusBadge, { backgroundColor: (statusColors[item.status] || '#6b7280') + '20' }]}>
                <Text style={[styles.statusText, { color: statusColors[item.status] || '#6b7280' }]}>
                  {item.status.replace('_', ' ')}
                </Text>
              </View>
            </View>
            <Text style={styles.dates}>{item.checkinDate} → {item.checkoutDate}</Text>
            <Text style={styles.ref}>{item.bookingRef}</Text>
            <Text style={styles.amount}>{formatINR(item.totalValuePaise)}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>{loading ? 'Loading...' : 'No bookings found'}</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1e293b', marginBottom: 16 },
  filters: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  filterButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  filterActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  filterText: { fontSize: 13, fontWeight: '500', color: '#64748b' },
  filterTextActive: { color: '#fff' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hotelName: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  dates: { fontSize: 13, color: '#64748b', marginTop: 4 },
  ref: { fontSize: 12, color: '#94a3b8', marginTop: 2, fontFamily: 'monospace' },
  amount: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginTop: 8 },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40 },
});

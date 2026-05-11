import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { hotelsApi, bookingsApi, walletApi, formatINR } from '../lib/api';
import SearchModal from '../components/SearchModal';
import HotelCard, { Hotel } from '../components/HotelCard';
import { SkeletonCard } from '../components/SkeletonLoader';
import EmptyState from '../components/EmptyState';

const CATEGORIES = ['All', 'Budget', 'Midscale', 'Upscale', 'Boutique'];

function getTomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function getDayAfterStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  return d.toISOString().slice(0, 10);
}

export default function HomeScreen({ navigation }: any) {
  const [upcomingTrip, setUpcomingTrip] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [category, setCategory] = useState('All');
  const [hotelsLoading, setHotelsLoading] = useState(true);
  const [searchVisible, setSearchVisible] = useState(false);

  const tomorrow = getTomorrowStr();
  const dayAfter = getDayAfterStr();

  useEffect(() => {
    bookingsApi
      .list('upcoming')
      .then((data) => setUpcomingTrip(data.bookings?.[0] ?? null))
      .catch(() => {});

    walletApi
      .getBalance()
      .then(setWallet)
      .catch(() => {});

    hotelsApi
      .search(`city=Bangalore&checkin=${tomorrow}&checkout=${dayAfter}`)
      .then((data) => setHotels(data.results || []))
      .catch(() => {})
      .finally(() => setHotelsLoading(false));
  }, []);

  const filteredHotels =
    category === 'All'
      ? hotels
      : hotels.filter(
          (h) => h.category?.toLowerCase() === category.toLowerCase()
        );

  function handleSearch(params: {
    city: string;
    checkin: string;
    checkout: string;
    rooms: number;
    guests: number;
  }) {
    navigation.navigate('Search', params);
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLocation}>📍 Bangalore</Text>
          <Text style={styles.headerGreeting}>Good day!</Text>
        </View>
        <TouchableOpacity
          style={styles.bellButton}
          onPress={() => navigation.navigate('Notifications')}
        >
          <Text style={styles.bellIcon}>🔔</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar — opens SearchModal */}
      <TouchableOpacity
        style={styles.searchCard}
        onPress={() => setSearchVisible(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.searchIcon}>🔍</Text>
        <Text style={styles.searchPlaceholder}>Where are you going?</Text>
      </TouchableOpacity>

      <SearchModal
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
        onSearch={handleSearch}
      />

      {/* Upcoming Trip */}
      {upcomingTrip ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming Trip</Text>
          <TouchableOpacity
            style={styles.tripCard}
            onPress={() =>
              navigation.navigate('BookingDetail', { bookingId: upcomingTrip.bookingId })
            }
          >
            <View style={styles.tripCardHeader}>
              <Text style={styles.tripHotel}>{upcomingTrip.hotelName}</Text>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>{upcomingTrip.status}</Text>
              </View>
            </View>
            <Text style={styles.tripDates}>
              {upcomingTrip.checkinDate} → {upcomingTrip.checkoutDate}
            </Text>
            <Text style={styles.tripRef}>{upcomingTrip.bookingRef}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 }}
            onPress={() => navigation.navigate('HotelBillPay')}
          >
            <Text style={{ fontSize: 28 }}>💳</Text>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#1e293b', marginTop: 6 }}>Pay Hotel Bill</Text>
            <Text style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>Earn coins on any stay</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 16, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 }}
            onPress={() => navigation.navigate('StayRegistration')}
          >
            <Text style={{ fontSize: 28 }}>🏷️</Text>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#1e293b', marginTop: 6 }}>Register Stay</Text>
            <Text style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>Earn ₹200 coins</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Rewards Teaser */}
      {wallet ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Rewards</Text>
          <View style={styles.rewardsCard}>
            <View style={styles.rewardItem}>
              <Text style={styles.rewardLabel}>🪙 OTA Coins</Text>
              <Text style={styles.rewardValue}>
                {formatINR(wallet.ota_coin_balance_paise || 0)}
              </Text>
            </View>
            <View style={styles.rewardDivider} />
            <View style={styles.rewardItem}>
              <Text style={styles.rewardLabel}>💎 ReZ Coins</Text>
              <Text style={styles.rewardValue}>
                {formatINR(wallet.rez_coin_balance_paise || 0)}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      {/* Featured Hotels */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Featured Hotels</Text>

        {/* Category Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsRow}
          contentContainerStyle={styles.chipsContent}
        >
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.chip, category === cat && styles.chipActive]}
              onPress={() => setCategory(cat)}
            >
              <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {hotelsLoading ? (
          // Skeleton loading state
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 16 }}
          >
            {[1, 2, 3].map((i) => (
              <SkeletonCard
                key={i}
                style={{ width: 160, marginRight: 12, height: 200 }}
              />
            ))}
          </ScrollView>
        ) : filteredHotels.length === 0 ? (
          <EmptyState
            icon="🏨"
            title="No Hotels Found"
            message="No hotels match your filters. Try a different category."
            actionLabel="Clear Filter"
            onAction={() => setCategory('All')}
          />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.featuredScroll}
          >
            {filteredHotels.map((hotel) => (
              <HotelCard
                key={hotel.hotelId}
                hotel={hotel}
                variant="small"
                onPress={() =>
                  navigation.navigate('HotelDetail', {
                    hotelId: hotel.hotelId,
                    checkin: tomorrow,
                    checkout: dayAfter,
                  })
                }
              />
            ))}
          </ScrollView>
        )}
      </View>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerLocation: { fontSize: 14, color: '#64748b', fontWeight: '500' },
  headerGreeting: { fontSize: 22, fontWeight: 'bold', color: '#1e293b', marginTop: 2 },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  bellIcon: { fontSize: 18 },
  searchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 8,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  searchIcon: { fontSize: 18, marginRight: 10 },
  searchPlaceholder: { fontSize: 15, color: '#94a3b8' },
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginBottom: 12 },
  tripCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  tripCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tripHotel: { fontSize: 16, fontWeight: '600', color: '#1e293b', flex: 1 },
  statusBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: { fontSize: 11, fontWeight: '600', color: '#2563eb', textTransform: 'capitalize' },
  tripDates: { fontSize: 13, color: '#64748b', marginTop: 6 },
  tripRef: { fontSize: 11, color: '#94a3b8', marginTop: 4, fontFamily: 'monospace' },
  rewardsCard: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    padding: 20,
    flexDirection: 'row',
  },
  rewardItem: { flex: 1, alignItems: 'center' },
  rewardLabel: { color: '#bfdbfe', fontSize: 13 },
  rewardValue: { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 4 },
  rewardDivider: { width: 1, backgroundColor: '#3b82f6', marginHorizontal: 16 },
  chipsRow: { marginBottom: 12 },
  chipsContent: { gap: 8, paddingRight: 16 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  chipText: { fontSize: 13, fontWeight: '500', color: '#64748b' },
  chipTextActive: { color: '#fff' },
  featuredScroll: { paddingRight: 16, paddingBottom: 4 },
});

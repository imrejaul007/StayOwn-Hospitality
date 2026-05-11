import React, { useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { hotelsApi } from '../lib/api';
import HotelCard, { Hotel } from '../components/HotelCard';
import FiltersModal, { FilterState } from '../components/FiltersModal';
import { SkeletonCard } from '../components/SkeletonLoader';
import EmptyState from '../components/EmptyState';

const SORT_OPTIONS = [
  { label: 'Recommended', value: 'recommended' },
  { label: 'Price ↑', value: 'price_asc' },
  { label: 'Price ↓', value: 'price_desc' },
  { label: 'Rating', value: 'rating' },
];

function applySort(hotels: Hotel[], sort: string): Hotel[] {
  const copy = [...hotels];
  if (sort === 'price_asc') {
    copy.sort((a, b) => {
      const ra = a.availableRoomTypes?.length ? Math.min(...a.availableRoomTypes.map((r) => r.ratePerNightPaise)) : Infinity;
      const rb = b.availableRoomTypes?.length ? Math.min(...b.availableRoomTypes.map((r) => r.ratePerNightPaise)) : Infinity;
      return ra - rb;
    });
  } else if (sort === 'price_desc') {
    copy.sort((a, b) => {
      const ra = a.availableRoomTypes?.length ? Math.min(...a.availableRoomTypes.map((r) => r.ratePerNightPaise)) : 0;
      const rb = b.availableRoomTypes?.length ? Math.min(...b.availableRoomTypes.map((r) => r.ratePerNightPaise)) : 0;
      return rb - ra;
    });
  } else if (sort === 'rating') {
    copy.sort((a, b) => (b.starRating || 0) - (a.starRating || 0));
  }
  return copy;
}

function applyFilters(hotels: Hotel[], filters: FilterState): Hotel[] {
  return hotels.filter((h) => {
    const rate = h.availableRoomTypes?.length
      ? Math.min(...h.availableRoomTypes.map((r) => r.ratePerNightPaise))
      : 0;
    const minPaise = (parseFloat(filters.minPrice) || 0) * 100;
    const maxPaise = (parseFloat(filters.maxPrice) || Infinity) * 100;
    if (rate > 0 && (rate < minPaise || rate > maxPaise)) return false;
    if (filters.starRatings.length > 0 && !filters.starRatings.includes(h.starRating || 0)) return false;
    if (filters.categories.length > 0 && !filters.categories.some((c) => c.toLowerCase() === h.category?.toLowerCase())) return false;
    if (filters.amenities.length > 0 && !filters.amenities.every((a) => h.amenities?.includes(a))) return false;
    return true;
  });
}

export default function SearchScreen({ navigation, route }: any) {
  const routeParams = route?.params || {};
  const [city] = useState(routeParams.city || 'Bangalore');
  const [checkin, setCheckin] = useState(routeParams.checkin || '2026-04-01');
  const [checkout, setCheckout] = useState(routeParams.checkout || '2026-04-03');
  const [results, setResults] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    minPrice: '500',
    maxPrice: '15000',
    starRatings: [],
    categories: [],
    amenities: [],
    sort: 'recommended',
  });
  const [activeSort, setActiveSort] = useState('recommended');

  async function handleSearch() {
    setLoading(true);
    try {
      const data = await hotelsApi.search(
        `city=${city}&checkin=${checkin}&checkout=${checkout}`
      );
      setResults(data.results || []);
      setSearched(true);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function handleApplyFilters(newFilters: FilterState) {
    setFilters(newFilters);
    setActiveSort(newFilters.sort);
  }

  const activeFilterCount =
    filters.starRatings.length +
    filters.categories.length +
    filters.amenities.length +
    (filters.minPrice !== '500' || filters.maxPrice !== '15000' ? 1 : 0);

  const displayedResults = applySort(applyFilters(results, filters), activeSort);

  function renderHotel({ item }: { item: Hotel }) {
    return (
      <HotelCard
        hotel={item}
        variant="large"
        checkin={checkin}
        checkout={checkout}
        onPress={() =>
          navigation.navigate('HotelDetail', {
            hotelId: item.hotelId,
            checkin,
            checkout,
          })
        }
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Find Hotels</Text>

        <View style={styles.headerActions}>
          {/* Filter button */}
          <TouchableOpacity
            style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]}
            onPress={() => setFiltersVisible(true)}
          >
            <Text style={[styles.filterBtnText, activeFilterCount > 0 && styles.filterBtnTextActive]}>
              {activeFilterCount > 0 ? `Filters (${activeFilterCount})` : 'Filters'}
            </Text>
            <Text style={styles.filterIcon}>⚙</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Sort strip */}
      {searched && (
        <View style={styles.sortStrip}>
          {SORT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              style={[styles.sortChip, activeSort === opt.value && styles.sortChipActive]}
              onPress={() => setActiveSort(opt.value)}
            >
              <Text style={[styles.sortChipText, activeSort === opt.value && styles.sortChipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Date row + Search button */}
      <View style={styles.searchBox}>
        <View style={styles.dateRow}>
          <View style={styles.dateCol}>
            <Text style={styles.dateLabel}>Check-in</Text>
            <Text style={styles.dateValue}>{checkin}</Text>
          </View>
          <Text style={styles.dateSep}>→</Text>
          <View style={styles.dateCol}>
            <Text style={styles.dateLabel}>Check-out</Text>
            <Text style={styles.dateValue}>{checkout}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.searchButton}
          onPress={handleSearch}
          disabled={loading}
        >
          <Text style={styles.searchButtonText}>
            {loading ? 'Searching...' : 'Search Hotels'}
          </Text>
        </TouchableOpacity>
      </View>

      {searched && !loading && (
        <Text style={styles.resultCount}>
          {displayedResults.length} hotel{displayedResults.length !== 1 ? 's' : ''} found in {city}
        </Text>
      )}

      {/* Results */}
      {loading ? (
        <FlatList
          data={[1, 2, 3]}
          keyExtractor={(i) => String(i)}
          renderItem={() => <SkeletonCard />}
          contentContainerStyle={styles.listContent}
        />
      ) : searched && displayedResults.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="No Results"
          message="No hotels match your search. Try adjusting your filters or dates."
          actionLabel="Clear Filters"
          onAction={() =>
            setFilters({
              minPrice: '500',
              maxPrice: '15000',
              starRatings: [],
              categories: [],
              amenities: [],
              sort: 'recommended',
            })
          }
        />
      ) : (
        <FlatList
          data={displayedResults}
          keyExtractor={(item) => item.hotelId}
          renderItem={renderHotel}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <FiltersModal
        visible={filtersVisible}
        onClose={() => setFiltersVisible(false)}
        onApply={handleApplyFilters}
        initialFilters={filters}
      />
    </View>
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
  title: { fontSize: 22, fontWeight: 'bold', color: '#1e293b' },
  headerActions: { flexDirection: 'row', gap: 8 },

  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  filterBtnActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  filterBtnText: { fontSize: 13, fontWeight: '500', color: '#475569' },
  filterBtnTextActive: { color: '#fff' },
  filterIcon: { fontSize: 13, color: '#64748b' },

  sortStrip: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 6,
  },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sortChipActive: { backgroundColor: '#dbeafe', borderColor: '#2563eb' },
  sortChipText: { fontSize: 12, fontWeight: '500', color: '#64748b' },
  sortChipTextActive: { color: '#2563eb', fontWeight: '700' },

  searchBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  dateCol: { flex: 1 },
  dateLabel: { fontSize: 11, fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase' },
  dateValue: { fontSize: 14, fontWeight: '700', color: '#1e293b', marginTop: 2 },
  dateSep: { fontSize: 18, color: '#94a3b8', paddingHorizontal: 8 },
  searchButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    padding: 13,
    alignItems: 'center',
  },
  searchButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  resultCount: { fontSize: 13, color: '#64748b', marginHorizontal: 16, marginBottom: 8 },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
});

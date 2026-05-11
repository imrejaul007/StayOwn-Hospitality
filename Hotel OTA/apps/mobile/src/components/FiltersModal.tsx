import React, { useState } from 'react';
import {
  Dimensions,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import BottomSheet from './BottomSheet';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface FilterState {
  minPrice: string;
  maxPrice: string;
  starRatings: number[];
  categories: string[];
  amenities: string[];
  sort: string;
}

interface FiltersModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: FilterState) => void;
  initialFilters?: Partial<FilterState>;
}

const STAR_OPTIONS = [1, 2, 3, 4, 5];
const CATEGORY_OPTIONS = ['Budget', 'Midscale', 'Upscale', 'Boutique'];
const AMENITY_OPTIONS = ['WiFi', 'Pool', 'Parking', 'Breakfast', 'Gym', 'AC'];
const SORT_OPTIONS = [
  { label: 'Recommended', value: 'recommended' },
  { label: 'Price: Low to High', value: 'price_asc' },
  { label: 'Price: High to Low', value: 'price_desc' },
  { label: 'Rating', value: 'rating' },
];

const DEFAULT_FILTERS: FilterState = {
  minPrice: '500',
  maxPrice: '15000',
  starRatings: [],
  categories: [],
  amenities: [],
  sort: 'recommended',
};

function mergeFilters(initial?: Partial<FilterState>): FilterState {
  return { ...DEFAULT_FILTERS, ...initial };
}

export default function FiltersModal({
  visible,
  onClose,
  onApply,
  initialFilters,
}: FiltersModalProps) {
  const [filters, setFilters] = useState<FilterState>(mergeFilters(initialFilters));

  function toggleStar(star: number) {
    setFilters((prev) => ({
      ...prev,
      starRatings: prev.starRatings.includes(star)
        ? prev.starRatings.filter((s) => s !== star)
        : [...prev.starRatings, star],
    }));
  }

  function toggleCategory(cat: string) {
    setFilters((prev) => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter((c) => c !== cat)
        : [...prev.categories, cat],
    }));
  }

  function toggleAmenity(am: string) {
    setFilters((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(am)
        ? prev.amenities.filter((a) => a !== am)
        : [...prev.amenities, am],
    }));
  }

  function handleReset() {
    setFilters(DEFAULT_FILTERS);
  }

  function handleApply() {
    onApply(filters);
    onClose();
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} height={SCREEN_HEIGHT * 0.85}>
      <Text style={styles.title}>Filters</Text>

      {/* Price Range */}
      <Text style={styles.sectionLabel}>Price Range (per night)</Text>
      <View style={styles.priceRow}>
        <View style={styles.priceInputWrap}>
          <Text style={styles.pricePrefix}>₹</Text>
          <TextInput
            style={styles.priceInput}
            value={filters.minPrice}
            onChangeText={(v) => setFilters((p) => ({ ...p, minPrice: v }))}
            keyboardType="numeric"
            placeholder="500"
            placeholderTextColor="#94a3b8"
          />
        </View>
        <Text style={styles.priceDash}>—</Text>
        <View style={styles.priceInputWrap}>
          <Text style={styles.pricePrefix}>₹</Text>
          <TextInput
            style={styles.priceInput}
            value={filters.maxPrice}
            onChangeText={(v) => setFilters((p) => ({ ...p, maxPrice: v }))}
            keyboardType="numeric"
            placeholder="15000"
            placeholderTextColor="#94a3b8"
          />
        </View>
      </View>

      {/* Star Rating */}
      <Text style={styles.sectionLabel}>Star Rating</Text>
      <View style={styles.chipsRow}>
        {STAR_OPTIONS.map((star) => {
          const active = filters.starRatings.includes(star);
          return (
            <TouchableOpacity
              key={star}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => toggleStar(star)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {star}★
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Category */}
      <Text style={styles.sectionLabel}>Category</Text>
      <View style={styles.chipsRow}>
        {CATEGORY_OPTIONS.map((cat) => {
          const active = filters.categories.includes(cat);
          return (
            <TouchableOpacity
              key={cat}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => toggleCategory(cat)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{cat}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Amenities */}
      <Text style={styles.sectionLabel}>Amenities</Text>
      <View style={styles.chipsRow}>
        {AMENITY_OPTIONS.map((am) => {
          const active = filters.amenities.includes(am);
          return (
            <TouchableOpacity
              key={am}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => toggleAmenity(am)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{am}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Sort */}
      <Text style={styles.sectionLabel}>Sort By</Text>
      <View style={styles.sortList}>
        {SORT_OPTIONS.map((opt) => {
          const active = filters.sort === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[styles.sortOption, active && styles.sortOptionActive]}
              onPress={() => setFilters((p) => ({ ...p, sort: opt.value }))}
            >
              <View style={[styles.sortRadio, active && styles.sortRadioActive]}>
                {active && <View style={styles.sortRadioDot} />}
              </View>
              <Text style={[styles.sortLabel, active && styles.sortLabelActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.resetBtn} onPress={handleReset}>
          <Text style={styles.resetBtnText}>Reset</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.applyBtn} onPress={handleApply}>
          <Text style={styles.applyBtnText}>Apply Filters</Text>
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 20,
    marginTop: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
    marginTop: 16,
  },

  // Price
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  priceInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#f8fafc',
  },
  pricePrefix: { fontSize: 15, color: '#64748b', marginRight: 4 },
  priceInput: { flex: 1, fontSize: 15, color: '#1e293b', fontWeight: '600' },
  priceDash: { fontSize: 18, color: '#94a3b8' },

  // Chips
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  chipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  chipText: { fontSize: 13, fontWeight: '500', color: '#475569' },
  chipTextActive: { color: '#fff', fontWeight: '600' },

  // Sort
  sortList: { gap: 2 },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 10,
  },
  sortOptionActive: { backgroundColor: '#eff6ff' },
  sortRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortRadioActive: { borderColor: '#2563eb' },
  sortRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#2563eb' },
  sortLabel: { fontSize: 14, color: '#475569', fontWeight: '500' },
  sortLabelActive: { color: '#2563eb', fontWeight: '600' },

  // Actions
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  resetBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  resetBtnText: { fontSize: 15, fontWeight: '600', color: '#64748b' },
  applyBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#2563eb',
    alignItems: 'center',
  },
  applyBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

/**
 * Booking Review / Checkout Screen — Upgraded
 * REZ consumer app-style savings display with 3-coin waterfall:
 *   OTA coins → REZ coins → Hotel Brand coins (up to 40% off)
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, Platform, Pressable,
} from 'react-native';
import { formatINR } from '../lib/api';

const GST_RATE = 0.12;

// ─── Savings Hero ─────────────────────────────────────────────────────────────
function SavingsHero({
  original, payable, otaOff, rezOff, brandOff, brandCoinName,
}: {
  original: number;
  payable: number;
  otaOff: number;
  rezOff: number;
  brandOff: number;
  brandCoinName?: string;
}) {
  const totalOff = otaOff + rezOff + brandOff;
  if (totalOff <= 0) return null;
  const savingsPct = Math.round((totalOff / original) * 100);

  return (
    <View style={heroStyles.root}>
      {/* Big badge */}
      <View style={heroStyles.badge}>
        <Text style={heroStyles.badgePct}>{savingsPct}%</Text>
        <Text style={heroStyles.badgeOff}>off</Text>
      </View>

      <View style={heroStyles.right}>
        <Text style={heroStyles.savingsLine}>You save {formatINR(totalOff)}</Text>
        <Text style={heroStyles.originalLine}>
          Was {formatINR(original)} → Pay <Text style={heroStyles.payableAmt}>{formatINR(payable)}</Text>
        </Text>

        {/* Per-coin breakdown */}
        <View style={heroStyles.chips}>
          {otaOff > 0 && (
            <View style={[heroStyles.chip, { backgroundColor: '#DBEAFE' }]}>
              <Text style={[heroStyles.chipTxt, { color: '#1D4ED8' }]}>🟦 OTA {formatINR(otaOff)}</Text>
            </View>
          )}
          {rezOff > 0 && (
            <View style={[heroStyles.chip, { backgroundColor: '#DCFCE7' }]}>
              <Text style={[heroStyles.chipTxt, { color: '#16A34A' }]}>🟩 REZ {formatINR(rezOff)}</Text>
            </View>
          )}
          {brandOff > 0 && (
            <View style={[heroStyles.chip, { backgroundColor: '#F3E8FF' }]}>
              <Text style={[heroStyles.chipTxt, { color: '#7C3AED' }]}>🟣 {brandCoinName ?? 'Brand'} {formatINR(brandOff)}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const heroStyles = StyleSheet.create({
  root: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#064E3B', borderRadius: 16, padding: 16,
    marginBottom: 12,
  },
  badge: {
    width: 70, height: 70, borderRadius: 35,
    backgroundColor: '#34D399', justifyContent: 'center', alignItems: 'center',
    marginRight: 14,
  },
  badgePct: { fontSize: 24, fontWeight: '800', color: '#064E3B', lineHeight: 28 },
  badgeOff: { fontSize: 11, fontWeight: '700', color: '#064E3B', marginTop: -4 },
  right: { flex: 1 },
  savingsLine: { fontSize: 16, fontWeight: '800', color: '#D1FAE5' },
  originalLine: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 3 },
  payableAmt: { fontWeight: '800', color: '#ECFDF5' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  chipTxt: { fontSize: 11, fontWeight: '700' },
});

// ─── Coin toggle row ──────────────────────────────────────────────────────────
function CoinToggleRow({
  label, available, applied, color, onToggle,
}: {
  label: string;
  available: number;
  applied: number;
  color: string;
  onToggle: () => void;
}) {
  if (available <= 0) return null;
  const isOn = applied > 0;

  return (
    <TouchableOpacity style={coinStyles.row} onPress={onToggle} activeOpacity={0.75}>
      <View style={[coinStyles.dot, { backgroundColor: color }]} />
      <View style={{ flex: 1 }}>
        <Text style={coinStyles.label}>{label}</Text>
        <Text style={coinStyles.avail}>Available: {formatINR(available)}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        {isOn && (
          <Text style={[coinStyles.savings, { color }]}>−{formatINR(applied)}</Text>
        )}
        <View style={[coinStyles.toggle, isOn && { backgroundColor: color }]}>
          <Text style={[coinStyles.toggleText, isOn && { color: '#fff' }]}>
            {isOn ? 'Applied' : 'Apply'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const coinStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  label: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  avail: { fontSize: 12, color: '#64748B', marginTop: 2 },
  savings: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  toggle: {
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 6,
    backgroundColor: '#F1F5F9',
  },
  toggleText: { fontSize: 13, fontWeight: '700', color: '#64748B' },
});

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function BookingReviewScreen({ route, navigation }: any) {
  const { hotel, roomType, checkin, checkout, nights, burnResult } = route.params as {
    hotel: any;
    roomType: any;
    checkin: string;
    checkout: string;
    nights: number;
    burnResult?: {
      ota_coin_applicable_paise: number;
      rez_coin_applicable_paise: number;
      hotel_brand_coin_applicable_paise: number;
      effective_amount_paise: number;
    };
  };

  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [agreedPolicy, setAgreedPolicy] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);

  // Coin toggles — default apply all available
  const [otaCoinApplied, setOtaCoinApplied] = useState(burnResult?.ota_coin_applicable_paise ?? 0);
  const [rezCoinApplied, setRezCoinApplied] = useState(burnResult?.rez_coin_applicable_paise ?? 0);
  const [brandCoinApplied, setBrandCoinApplied] = useState(burnResult?.hotel_brand_coin_applicable_paise ?? 0);

  const brandCoinName = hotel?.brandCoinName ?? 'Brand Coins';

  const rateTotal = roomType.baseRatePaise * nights;
  const gst = Math.round(rateTotal * GST_RATE);
  const subtotal = rateTotal + gst;
  const totalCoinsOff = otaCoinApplied + rezCoinApplied + brandCoinApplied;
  const totalPayable = Math.max(subtotal - totalCoinsOff, 0);

  const canProceed = guestName.trim().length >= 2 && guestPhone.length === 10 && agreedPolicy && agreedTerms;

  function handleProceed() {
    if (!canProceed) return;
    navigation.navigate('Payment', {
      hotel, roomType, checkin, checkout, nights,
      guestName, guestPhone,
      rateTotal, gst, subtotal,
      otaCoinApplied, rezCoinApplied, brandCoinApplied,
      totalPayable,
    });
  }

  return (
    <View style={styles.wrapper}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

        {/* ── Savings Hero ──────────────────────────────────────────────────── */}
        <SavingsHero
          original={subtotal}
          payable={totalPayable}
          otaOff={otaCoinApplied}
          rezOff={rezCoinApplied}
          brandOff={brandCoinApplied}
          brandCoinName={brandCoinName}
        />

        {/* ── Booking Summary ───────────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Booking Summary</Text>
          <Text style={styles.hotelName}>{hotel.name}</Text>
          <Text style={styles.meta}>
            {roomType.name}{roomType.bedType ? ` · ${roomType.bedType}` : ''}
          </Text>
          <Text style={styles.meta}>
            {checkin} → {checkout} · {nights} night{nights !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* ── Guest Details ─────────────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Guest Details</Text>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            value={guestName}
            onChangeText={setGuestName}
            placeholder="Rahul Sharma"
            autoCapitalize="words"
          />
          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            value={guestPhone}
            onChangeText={setGuestPhone}
            placeholder="9876543210"
            keyboardType="phone-pad"
            maxLength={10}
          />
        </View>

        {/* ── Coins & Rewards ───────────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Apply Rewards</Text>
          <CoinToggleRow
            label="OTA Coins"
            available={burnResult?.ota_coin_applicable_paise ?? 0}
            applied={otaCoinApplied}
            color="#2563EB"
            onToggle={() => setOtaCoinApplied(otaCoinApplied > 0 ? 0 : (burnResult?.ota_coin_applicable_paise ?? 0))}
          />
          <CoinToggleRow
            label="REZ Coins"
            available={burnResult?.rez_coin_applicable_paise ?? 0}
            applied={rezCoinApplied}
            color="#16A34A"
            onToggle={() => setRezCoinApplied(rezCoinApplied > 0 ? 0 : (burnResult?.rez_coin_applicable_paise ?? 0))}
          />
          <CoinToggleRow
            label={brandCoinName}
            available={burnResult?.hotel_brand_coin_applicable_paise ?? 0}
            applied={brandCoinApplied}
            color="#7C3AED"
            onToggle={() => setBrandCoinApplied(brandCoinApplied > 0 ? 0 : (burnResult?.hotel_brand_coin_applicable_paise ?? 0))}
          />
          {(burnResult?.ota_coin_applicable_paise ?? 0) === 0 &&
           (burnResult?.rez_coin_applicable_paise ?? 0) === 0 &&
           (burnResult?.hotel_brand_coin_applicable_paise ?? 0) === 0 && (
            <Text style={styles.noCoins}>No coins available for this booking</Text>
          )}
        </View>

        {/* ── Price Breakdown ───────────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Price Breakdown</Text>
          <View style={styles.row}>
            <Text style={styles.priceLabel}>{formatINR(roomType.baseRatePaise)} × {nights} night{nights !== 1 ? 's' : ''}</Text>
            <Text style={styles.priceValue}>{formatINR(rateTotal)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.priceLabel}>GST (12%)</Text>
            <Text style={styles.priceValue}>{formatINR(gst)}</Text>
          </View>

          {otaCoinApplied > 0 && (
            <View style={styles.row}>
              <Text style={[styles.priceLabel, { color: '#2563EB' }]}>🟦 OTA Coins</Text>
              <Text style={[styles.priceValue, { color: '#2563EB', fontWeight: '700' }]}>−{formatINR(otaCoinApplied)}</Text>
            </View>
          )}
          {rezCoinApplied > 0 && (
            <View style={styles.row}>
              <Text style={[styles.priceLabel, { color: '#16A34A' }]}>🟩 REZ Coins</Text>
              <Text style={[styles.priceValue, { color: '#16A34A', fontWeight: '700' }]}>−{formatINR(rezCoinApplied)}</Text>
            </View>
          )}
          {brandCoinApplied > 0 && (
            <View style={styles.row}>
              <Text style={[styles.priceLabel, { color: '#7C3AED' }]}>🟣 {brandCoinName}</Text>
              <Text style={[styles.priceValue, { color: '#7C3AED', fontWeight: '700' }]}>−{formatINR(brandCoinApplied)}</Text>
            </View>
          )}

          <View style={[styles.row, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total Payable</Text>
            <Text style={styles.totalValue}>{formatINR(totalPayable)}</Text>
          </View>

          {totalCoinsOff > 0 && (
            <View style={styles.savingsSummaryRow}>
              <Text style={styles.savingsSummaryText}>🎉 You're saving {formatINR(totalCoinsOff)} on this booking</Text>
            </View>
          )}
        </View>

        {/* ── Cancellation Policy ───────────────────────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Cancellation Policy</Text>
          <Text style={styles.policyText}>
            {hotel.policies?.cancellationPolicy || 'Free cancellation before 24 hours of check-in.'}
          </Text>
        </View>

        {/* ── Agreements ───────────────────────────────────────────────────── */}
        <View style={styles.card}>
          <TouchableOpacity style={styles.checkRow} onPress={() => setAgreedPolicy(!agreedPolicy)}>
            <View style={[styles.checkbox, agreedPolicy && styles.checkboxChecked]}>
              {agreedPolicy && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkLabel}>I agree to the cancellation policy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.checkRow} onPress={() => setAgreedTerms(!agreedTerms)}>
            <View style={[styles.checkbox, agreedTerms && styles.checkboxChecked]}>
              {agreedTerms && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkLabel}>I accept the Terms &amp; Conditions</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* ── Sticky Bottom ────────────────────────────────────────────────────── */}
      <View style={styles.stickyBottom}>
        <View>
          {totalCoinsOff > 0 && (
            <Text style={styles.stickysavings}>Save {formatINR(totalCoinsOff)}</Text>
          )}
          <Text style={styles.stickyLabel}>Pay {formatINR(totalPayable)}</Text>
        </View>
        <TouchableOpacity
          style={[styles.proceedButton, !canProceed && styles.proceedDisabled]}
          onPress={handleProceed}
          disabled={!canProceed}
        >
          <Text style={styles.proceedText}>Proceed to Pay</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { flex: 1, padding: 16 },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 2 },
    }),
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1E293B', marginBottom: 12 },
  hotelName: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  meta: { fontSize: 13, color: '#64748B', marginTop: 4 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 4 },
  input: { borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 12, padding: 13, fontSize: 15, marginBottom: 8, color: '#0F172A' },
  noCoins: { fontSize: 13, color: '#94A3B8', textAlign: 'center', paddingVertical: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  priceLabel: { fontSize: 14, color: '#64748B' },
  priceValue: { fontSize: 14, color: '#1E293B', fontWeight: '500' },
  totalRow: { borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingTop: 12, marginTop: 4, marginBottom: 0 },
  totalLabel: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  totalValue: { fontSize: 20, fontWeight: '800', color: '#1D4ED8' },
  savingsSummaryRow: { backgroundColor: '#F0FDF4', borderRadius: 10, padding: 10, marginTop: 10 },
  savingsSummaryText: { fontSize: 13, fontWeight: '600', color: '#16A34A', textAlign: 'center' },
  policyText: { fontSize: 13, color: '#64748B', lineHeight: 20 },
  checkRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: '#D1D5DB', marginRight: 12, justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: '#06B6D4', borderColor: '#06B6D4' },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  checkLabel: { fontSize: 13, color: '#374151', flex: 1 },
  stickyBottom: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 14,
    paddingBottom: Platform.OS === 'ios' ? 28 : 14,
    borderTopWidth: 1, borderTopColor: '#E2E8F0',
    ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: -3 } }, android: { elevation: 8 } }),
  },
  stickyLabel: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  stickysavings: { fontSize: 12, fontWeight: '600', color: '#16A34A', marginBottom: 2 },
  proceedButton: { backgroundColor: '#06B6D4', borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14 },
  proceedDisabled: { backgroundColor: '#CBD5E1' },
  proceedText: { fontSize: 16, fontWeight: '800', color: '#fff' },
});

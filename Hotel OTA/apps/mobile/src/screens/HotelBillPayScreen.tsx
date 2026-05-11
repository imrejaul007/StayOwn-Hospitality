import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { hotelsApi, walletApi, billPayApi, formatINR } from '../lib/api';

type Step = 'search' | 'amount' | 'coins' | 'pay';

interface HotelResult {
  id: string;
  name: string;
  city: string;
}

const OTA_CAP_PCT = 10;
const REZ_CAP_PCT = 5;
const OTA_EARN_PCT = 2;
const REZ_EARN_PCT = 4;
const TX_FEE_PCT = 1;

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export default function HotelBillPayScreen({ navigation }: any) {
  // Step state
  const [step, setStep] = useState<Step>('search');

  // Step 1: Hotel search
  const [query, setQuery] = useState('');
  const [hotels, setHotels] = useState<HotelResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedHotel, setSelectedHotel] = useState<HotelResult | null>(null);

  // Step 2: Bill amount + stay date
  const [billInput, setBillInput] = useState('');
  const [stayDate, setStayDate] = useState(formatDate(new Date()));

  // Step 3: Coins
  const [wallet, setWallet] = useState<any>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [otaInput, setOtaInput] = useState('0');
  const [rezInput, setRezInput] = useState('0');

  // Step 4: Pay
  const [paying, setPaying] = useState(false);

  // ── Hotel search ─────────────────────────────────────────────────────────

  const searchHotels = useCallback(async (q: string) => {
    if (!q.trim()) { setHotels([]); return; }
    setSearchLoading(true);
    try {
      const res = await hotelsApi.search(`q=${encodeURIComponent(q)}&limit=10`);
      setHotels(res.hotels || res.results || []);
    } catch {
      setHotels([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchHotels(query), 350);
    return () => clearTimeout(t);
  }, [query, searchHotels]);

  function selectHotel(hotel: HotelResult) {
    setSelectedHotel(hotel);
    setQuery(hotel.name);
    setHotels([]);
    setStep('amount');
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const billPaise = Math.max(0, Math.round(parseFloat(billInput || '0') * 100));

  const maxOtaPaise = Math.floor(billPaise * (OTA_CAP_PCT / 100));
  const maxRezPaise = Math.floor(billPaise * (REZ_CAP_PCT / 100));

  const walletOta = wallet?.ota_coin_balance_paise ?? 0;
  const walletRez = wallet?.rez_coin_balance_paise ?? 0;

  const otaPaise = Math.min(
    Math.max(Math.round(parseFloat(otaInput || '0') * 100), 0),
    Math.min(maxOtaPaise, walletOta)
  );
  const rezPaise = Math.min(
    Math.max(Math.round(parseFloat(rezInput || '0') * 100), 0),
    Math.min(maxRezPaise, walletRez)
  );

  const pgAmountPaise = Math.max(0, billPaise - otaPaise - rezPaise);
  const txFeePaise = Math.floor(billPaise * (TX_FEE_PCT / 100));
  const otaEarnPaise = Math.floor(billPaise * (OTA_EARN_PCT / 100));
  const rezEarnPaise = Math.floor(billPaise * (REZ_EARN_PCT / 100));

  // ── Proceed from amount step ──────────────────────────────────────────────

  function goToCoins() {
    if (!billInput || billPaise < 100) {
      Alert.alert('Invalid Amount', 'Please enter a bill amount of at least ₹1.');
      return;
    }
    if (!stayDate || !/^\d{4}-\d{2}-\d{2}$/.test(stayDate)) {
      Alert.alert('Invalid Date', 'Please enter the stay date as YYYY-MM-DD.');
      return;
    }
    setWalletLoading(true);
    walletApi
      .getBalance()
      .then((w) => { setWallet(w); setStep('coins'); })
      .catch(() => { setWallet(null); setStep('coins'); })
      .finally(() => setWalletLoading(false));
  }

  // ── Pay ───────────────────────────────────────────────────────────────────

  async function handlePay() {
    if (!selectedHotel) return;

    if (!__DEV__) {
      Alert.alert(
        'Payment Not Available',
        'Payment processing is not yet configured for production. Please contact support.',
      );
      return;
    }

    setPaying(true);
    try {
      // Initiate payment
      const initRes = await billPayApi.initiate({
        hotel_id: selectedHotel.id,
        bill_amount_paise: billPaise,
        ota_coin_burn_paise: otaPaise,
        rez_coin_burn_paise: rezPaise,
        stay_date: stayDate,
      });

      // Dev mode only — production path returns early above
      const confirmRes = await billPayApi.confirm({
        payment_id: initRes.payment_id,
        razorpay_payment_id: `pay_dev_${Date.now()}`,
        razorpay_signature: 'dev_signature',
      });

      navigation.navigate('BillPayConfirmed', {
        hotelName: selectedHotel.name,
        billAmountPaise: billPaise,
        amountPaidPaise: pgAmountPaise,
        otaCoinEarnedPaise: confirmRes.coins_earned?.ota_coin_paise ?? otaEarnPaise,
        rezCoinEarnedPaise: confirmRes.coins_earned?.rez_coin_paise ?? rezEarnPaise,
        paymentRef: confirmRes.payment_ref,
      });
    } catch (err: any) {
      Alert.alert('Payment Failed', err.message || 'Something went wrong. Please try again.');
    } finally {
      setPaying(false);
    }
  }

  // ── Stay date helpers ─────────────────────────────────────────────────────

  function setToday() { setStayDate(formatDate(new Date())); }
  function setYesterday() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    setStayDate(formatDate(d));
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Hotel Bill Pay</Text>
          <Text style={styles.headerSub}>Earn coins on every hotel stay</Text>
        </View>

        {/* Step indicator */}
        <View style={styles.stepRow}>
          {(['search', 'amount', 'coins', 'pay'] as Step[]).map((s, i) => (
            <View key={s} style={styles.stepItem}>
              <View style={[styles.stepDot, step === s && styles.stepDotActive,
                (['search', 'amount', 'coins', 'pay'] as Step[]).indexOf(step) > i && styles.stepDotDone]}>
                <Text style={[styles.stepNum, (step === s || (['search', 'amount', 'coins', 'pay'] as Step[]).indexOf(step) > i) && styles.stepNumActive]}>
                  {i + 1}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── STEP 1: Search Hotel ── */}
        {(step === 'search' || selectedHotel) && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>1. Select Hotel</Text>
            <TextInput
              style={styles.input}
              placeholder="Search hotel by name..."
              value={query}
              onChangeText={(t) => { setQuery(t); if (step !== 'search') { setSelectedHotel(null); setStep('search'); } }}
              autoCapitalize="words"
            />
            {searchLoading && <ActivityIndicator size="small" color="#2563eb" style={{ marginVertical: 8 }} />}
            {hotels.length > 0 && step === 'search' && (
              <View style={styles.dropdownBox}>
                <FlatList
                  data={hotels}
                  keyExtractor={(h) => h.id}
                  scrollEnabled={false}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={styles.dropdownItem} onPress={() => selectHotel(item)}>
                      <Text style={styles.dropdownName}>{item.name}</Text>
                      <Text style={styles.dropdownCity}>{item.city}</Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}
            {selectedHotel && (
              <View style={styles.selectedBadge}>
                <Text style={styles.selectedText}>{selectedHotel.name} — {selectedHotel.city}</Text>
              </View>
            )}
          </View>
        )}

        {/* ── STEP 2: Bill Amount + Stay Date ── */}
        {(step === 'amount' || step === 'coins' || step === 'pay') && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>2. Bill Details</Text>

            <Text style={styles.label}>Bill Amount (₹)</Text>
            <TextInput
              style={styles.bigInput}
              placeholder="0.00"
              keyboardType="decimal-pad"
              value={billInput}
              onChangeText={setBillInput}
              editable={step === 'amount'}
            />

            <Text style={styles.label}>Stay Date</Text>
            <View style={styles.dateRow}>
              <TouchableOpacity
                style={[styles.dateChip, stayDate === formatDate(new Date()) && styles.dateChipActive]}
                onPress={setToday}
              >
                <Text style={[styles.dateChipText, stayDate === formatDate(new Date()) && styles.dateChipTextActive]}>
                  Today
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dateChip, stayDate === formatDate(new Date(Date.now() - 86400000)) && styles.dateChipActive]}
                onPress={setYesterday}
              >
                <Text style={[styles.dateChipText, stayDate === formatDate(new Date(Date.now() - 86400000)) && styles.dateChipTextActive]}>
                  Yesterday
                </Text>
              </TouchableOpacity>
              <TextInput
                style={[styles.input, styles.dateInput]}
                placeholder="YYYY-MM-DD"
                value={stayDate}
                onChangeText={setStayDate}
                editable={step === 'amount'}
              />
            </View>

            {billPaise > 0 && (
              <View style={styles.earnPreview}>
                <Text style={styles.earnTitle}>Coin Earn Preview</Text>
                <Text style={styles.earnLine}>OTA Coins: {formatINR(Math.floor(billPaise * (OTA_EARN_PCT / 100)))}</Text>
                <Text style={styles.earnLine}>ReZ Coins: {formatINR(Math.floor(billPaise * (REZ_EARN_PCT / 100)))}</Text>
              </View>
            )}

            {step === 'amount' && (
              <TouchableOpacity
                style={[styles.primaryButton, walletLoading && styles.buttonDisabled]}
                onPress={goToCoins}
                disabled={walletLoading}
              >
                {walletLoading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.primaryButtonText}>Apply Coins →</Text>}
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── STEP 3: Apply Coins ── */}
        {(step === 'coins' || step === 'pay') && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>3. Apply Coins (Optional)</Text>

            {/* OTA Coins */}
            <View style={styles.coinRow}>
              <View style={styles.coinLabelRow}>
                <Text style={styles.coinLabel}>OTA Coins</Text>
                <Text style={styles.coinBalance}>Balance: {formatINR(walletOta)}</Text>
              </View>
              <Text style={styles.capNote}>Max {OTA_CAP_PCT}% of bill = {formatINR(maxOtaPaise)}</Text>
              <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                placeholder="0.00"
                value={otaInput}
                onChangeText={setOtaInput}
                editable={step === 'coins'}
              />
            </View>

            {/* ReZ Coins */}
            <View style={styles.coinRow}>
              <View style={styles.coinLabelRow}>
                <Text style={styles.coinLabel}>ReZ Coins</Text>
                <Text style={styles.coinBalance}>Balance: {formatINR(walletRez)}</Text>
              </View>
              <Text style={styles.capNote}>Max {REZ_CAP_PCT}% of bill = {formatINR(maxRezPaise)}</Text>
              <TextInput
                style={styles.input}
                keyboardType="decimal-pad"
                placeholder="0.00"
                value={rezInput}
                onChangeText={setRezInput}
                editable={step === 'coins'}
              />
            </View>

            {/* Summary */}
            <View style={styles.summaryBox}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Bill Amount</Text>
                <Text style={styles.summaryValue}>{formatINR(billPaise)}</Text>
              </View>
              {otaPaise > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>OTA Coins Applied</Text>
                  <Text style={[styles.summaryValue, styles.discount]}>− {formatINR(otaPaise)}</Text>
                </View>
              )}
              {rezPaise > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>ReZ Coins Applied</Text>
                  <Text style={[styles.summaryValue, styles.discount]}>− {formatINR(rezPaise)}</Text>
                </View>
              )}
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Transaction Fee (1%)</Text>
                <Text style={styles.summaryValue}>{formatINR(txFeePaise)}</Text>
              </View>
              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>You Pay</Text>
                <Text style={styles.totalValue}>{formatINR(pgAmountPaise)}</Text>
              </View>
            </View>

            {step === 'coins' && (
              <TouchableOpacity style={styles.primaryButton} onPress={() => setStep('pay')}>
                <Text style={styles.primaryButtonText}>Review & Pay →</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── STEP 4: Pay ── */}
        {step === 'pay' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>4. Confirm Payment</Text>

            <View style={styles.confirmBox}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Hotel</Text>
                <Text style={styles.summaryValue}>{selectedHotel?.name}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Stay Date</Text>
                <Text style={styles.summaryValue}>{stayDate}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Bill Total</Text>
                <Text style={styles.summaryValue}>{formatINR(billPaise)}</Text>
              </View>
              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Pay Now</Text>
                <Text style={styles.totalValue}>{formatINR(pgAmountPaise)}</Text>
              </View>
            </View>

            <View style={styles.earnSummary}>
              <Text style={styles.earnTitle}>You'll Earn</Text>
              <Text style={styles.earnLine}>+ {formatINR(otaEarnPaise)} OTA Coins</Text>
              <Text style={styles.earnLine}>+ {formatINR(rezEarnPaise)} ReZ Coins</Text>
            </View>

            <TouchableOpacity
              style={[styles.payButton, paying && styles.buttonDisabled]}
              onPress={handlePay}
              disabled={paying}
            >
              {paying
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.payButtonText}>Pay {formatINR(pgAmountPaise)}</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.backLink} onPress={() => setStep('coins')}>
              <Text style={styles.backLinkText}>← Edit Coins</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 40 },

  header: { marginBottom: 20 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#1e293b' },
  headerSub: { fontSize: 14, color: '#64748b', marginTop: 2 },

  stepRow: { flexDirection: 'row', marginBottom: 20, gap: 8 },
  stepItem: { flex: 1, alignItems: 'center' },
  stepDot: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center',
  },
  stepDotActive: { backgroundColor: '#2563eb' },
  stepDotDone: { backgroundColor: '#16a34a' },
  stepNum: { fontSize: 14, fontWeight: '700', color: '#94a3b8' },
  stepNumActive: { color: '#fff' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1e293b', marginBottom: 12 },

  label: { fontSize: 13, fontWeight: '600', color: '#64748b', marginBottom: 6 },

  input: {
    borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 15, color: '#1e293b', backgroundColor: '#fff',
  },
  bigInput: {
    borderWidth: 2, borderColor: '#2563eb', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 28, fontWeight: '700', color: '#1e293b',
    marginBottom: 14, textAlign: 'center',
  },
  dateInput: { flex: 1 },

  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  dateChip: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 8, borderWidth: 1.5, borderColor: '#e2e8f0',
  },
  dateChipActive: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  dateChipText: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  dateChipTextActive: { color: '#2563eb' },

  dropdownBox: {
    borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10,
    marginTop: 6, backgroundColor: '#fff',
    maxHeight: 200, overflow: 'hidden',
  },
  dropdownItem: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  dropdownName: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  dropdownCity: { fontSize: 12, color: '#94a3b8', marginTop: 2 },

  selectedBadge: {
    marginTop: 8, backgroundColor: '#eff6ff',
    borderRadius: 8, padding: 10,
    borderWidth: 1, borderColor: '#bfdbfe',
  },
  selectedText: { fontSize: 13, color: '#1d4ed8', fontWeight: '600' },

  earnPreview: {
    backgroundColor: '#f0fdf4', borderRadius: 10, padding: 12,
    marginTop: 12, marginBottom: 8,
    borderWidth: 1, borderColor: '#bbf7d0',
  },
  earnTitle: { fontSize: 13, fontWeight: '700', color: '#15803d', marginBottom: 4 },
  earnLine: { fontSize: 13, color: '#16a34a', fontWeight: '600', marginTop: 2 },

  coinRow: { marginBottom: 14 },
  coinLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  coinLabel: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  coinBalance: { fontSize: 12, color: '#64748b' },
  capNote: { fontSize: 11, color: '#94a3b8', marginBottom: 6 },

  summaryBox: {
    backgroundColor: '#f8fafc', borderRadius: 10, padding: 12,
    marginVertical: 12, borderWidth: 1, borderColor: '#e2e8f0',
  },
  confirmBox: {
    backgroundColor: '#f8fafc', borderRadius: 10, padding: 12,
    marginBottom: 14, borderWidth: 1, borderColor: '#e2e8f0',
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontSize: 13, color: '#64748b' },
  summaryValue: { fontSize: 13, color: '#1e293b', fontWeight: '500' },
  discount: { color: '#16a34a', fontWeight: '700' },
  totalRow: { borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 8, marginTop: 4 },
  totalLabel: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  totalValue: { fontSize: 16, fontWeight: '800', color: '#2563eb' },

  earnSummary: {
    backgroundColor: '#f0fdf4', borderRadius: 10, padding: 12,
    marginBottom: 14, borderWidth: 1, borderColor: '#bbf7d0',
  },

  primaryButton: {
    backgroundColor: '#2563eb', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 8,
  },
  primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  payButton: {
    backgroundColor: '#16a34a', borderRadius: 12,
    paddingVertical: 16, alignItems: 'center',
  },
  payButtonText: { color: '#fff', fontWeight: '800', fontSize: 16 },

  buttonDisabled: { opacity: 0.6 },

  backLink: { alignItems: 'center', marginTop: 12 },
  backLinkText: { fontSize: 13, color: '#64748b', fontWeight: '600' },
});

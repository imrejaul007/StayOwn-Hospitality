import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { stayApi } from '../lib/api';

export default function StayRegistrationScreen() {
  const [hotel, setHotel] = useState('');
  const [stayDate, setStayDate] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [referenceId, setReferenceId] = useState('');

  async function handleSubmit() {
    if (!hotel.trim()) {
      Alert.alert('Missing Info', 'Please enter the hotel name.');
      return;
    }
    if (!stayDate.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(stayDate)) {
      Alert.alert('Invalid Date', 'Please enter the stay date in YYYY-MM-DD format.');
      return;
    }
    if (!receiptUrl.trim()) {
      Alert.alert('Missing Info', 'Please provide the receipt image URL.');
      return;
    }

    setLoading(true);
    try {
      const res = await stayApi.register({
        hotel_name: hotel.trim(),
        stay_date: stayDate.trim(),
        receipt_url: receiptUrl.trim(),
      });
      setReferenceId(res.registration_id || res.id || 'REG-UNKNOWN');
      setSubmitted(true);
    } catch (err: any) {
      Alert.alert('Submission Failed', err.message);
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <View style={styles.successContainer}>
        <View style={styles.successIcon}>
          <Text style={styles.successCheck}>✓</Text>
        </View>
        <Text style={styles.successTitle}>Registration Submitted!</Text>
        <Text style={styles.successRef}>Reference ID</Text>
        <Text style={styles.successRefId}>{referenceId}</Text>
        <View style={styles.successInfoCard}>
          <Text style={styles.successInfoText}>
            Your stay is under review. Travel Coins will be credited to your wallet within 24 hours after verification.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.screenTitle}>Register a Stay</Text>

      {/* Explainer Card */}
      <View style={styles.explainerCard}>
        <Text style={styles.explainerIcon}>🏨</Text>
        <Text style={styles.explainerTitle}>Earn ₹200 for Stays Elsewhere</Text>
        <Text style={styles.explainerDesc}>
          Booked through a competitor? That's okay! Register your stay with a receipt and earn
          {' '}₹200 worth of OTA Travel Coins. Our team will verify your stay within 24 hours.
        </Text>
        <View style={styles.explainerSteps}>
          <View style={styles.explainerStep}>
            <View style={styles.stepNum}><Text style={styles.stepNumText}>1</Text></View>
            <Text style={styles.stepText}>Enter hotel & date</Text>
          </View>
          <View style={styles.explainerStep}>
            <View style={styles.stepNum}><Text style={styles.stepNumText}>2</Text></View>
            <Text style={styles.stepText}>Provide receipt URL</Text>
          </View>
          <View style={styles.explainerStep}>
            <View style={styles.stepNum}><Text style={styles.stepNumText}>3</Text></View>
            <Text style={styles.stepText}>Earn coins in 24h</Text>
          </View>
        </View>
      </View>

      {/* Form */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Stay Details</Text>

        <Text style={styles.label}>Hotel Name</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. The Oberoi, Bangalore"
          placeholderTextColor="#94a3b8"
          value={hotel}
          onChangeText={setHotel}
          autoCapitalize="words"
        />

        <Text style={styles.label}>Stay Date</Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#94a3b8"
          value={stayDate}
          onChangeText={setStayDate}
          keyboardType="numbers-and-punctuation"
          maxLength={10}
        />

        <Text style={styles.label}>Receipt Image URL</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          placeholder="https://drive.google.com/..."
          placeholderTextColor="#94a3b8"
          value={receiptUrl}
          onChangeText={setReceiptUrl}
          autoCapitalize="none"
          keyboardType="url"
          multiline
          numberOfLines={2}
        />
        <Text style={styles.inputHint}>
          Upload your receipt to Google Drive or any cloud link and paste the URL here.
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.submitButton, loading && styles.disabledButton]}
        onPress={handleSubmit}
        disabled={loading}
      >
        <Text style={styles.submitButtonText}>
          {loading ? 'Submitting...' : 'Submit Registration'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 40 },
  screenTitle: { fontSize: 24, fontWeight: 'bold', color: '#1e293b', marginBottom: 16 },

  explainerCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  explainerIcon: { fontSize: 32, marginBottom: 8 },
  explainerTitle: { fontSize: 18, fontWeight: '700', color: '#1d4ed8' },
  explainerDesc: { fontSize: 13, color: '#3b82f6', marginTop: 6, lineHeight: 19 },
  explainerSteps: { flexDirection: 'row', marginTop: 16, gap: 8 },
  explainerStep: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center' },
  stepNumText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  stepText: { fontSize: 11, color: '#1d4ed8', fontWeight: '500', flex: 1 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 14,
  },
  label: { fontSize: 12, fontWeight: '600', color: '#64748b', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#1e293b',
    marginBottom: 14,
    backgroundColor: '#fafafa',
  },
  inputMultiline: { minHeight: 60, textAlignVertical: 'top' },
  inputHint: { fontSize: 11, color: '#94a3b8', marginTop: -10, marginBottom: 4 },

  submitButton: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  disabledButton: { opacity: 0.6 },

  // Success State
  successContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#dcfce7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  successCheck: { fontSize: 40, color: '#16a34a' },
  successTitle: { fontSize: 22, fontWeight: '800', color: '#1e293b', marginBottom: 16 },
  successRef: { fontSize: 12, fontWeight: '600', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1 },
  successRefId: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2563eb',
    fontFamily: 'monospace',
    marginTop: 4,
    marginBottom: 20,
  },
  successInfoCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  successInfoText: { fontSize: 13, color: '#15803d', textAlign: 'center', lineHeight: 20 },
});

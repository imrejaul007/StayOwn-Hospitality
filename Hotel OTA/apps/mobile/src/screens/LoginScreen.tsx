import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { authApi, setTokens } from '../lib/api';

export default function LoginScreen({ navigation }: any) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpRef, setOtpRef] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);

  async function handleSendOtp() {
    if (phone.length !== 10) return;
    setLoading(true);
    try {
      const res = await authApi.sendOtp(phone);
      setOtpRef(res.otp_ref);
      setStep('otp');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    setLoading(true);
    try {
      const res = await authApi.verifyOtp(phone, otp, otpRef);
      setTokens(res.access_token, res.refresh_token);
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hotel OTA</Text>
      <Text style={styles.subtitle}>Book hotels. Earn rewards.</Text>

      {step === 'phone' ? (
        <View style={styles.form}>
          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="9876543210"
            keyboardType="phone-pad"
            maxLength={10}
          />
          <TouchableOpacity
            style={[styles.button, phone.length !== 10 && styles.buttonDisabled]}
            onPress={handleSendOtp}
            disabled={loading || phone.length !== 10}
          >
            <Text style={styles.buttonText}>{loading ? 'Sending...' : 'Send OTP'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.form}>
          <Text style={styles.otpInfo}>OTP sent to +91 {phone}</Text>
          <Text style={styles.label}>Enter OTP</Text>
          <TextInput
            style={[styles.input, styles.otpInput]}
            value={otp}
            onChangeText={setOtp}
            placeholder="000000"
            keyboardType="number-pad"
            maxLength={6}
          />
          <TouchableOpacity
            style={[styles.button, otp.length !== 6 && styles.buttonDisabled]}
            onPress={handleVerifyOtp}
            disabled={loading || otp.length !== 6}
          >
            <Text style={styles.buttonText}>{loading ? 'Verifying...' : 'Verify & Login'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setStep('phone'); setOtp(''); }}>
            <Text style={styles.changePhone}>Change phone number</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#f8fafc' },
  title: { fontSize: 32, fontWeight: 'bold', textAlign: 'center', color: '#1e293b' },
  subtitle: { fontSize: 16, textAlign: 'center', color: '#64748b', marginBottom: 40 },
  form: { backgroundColor: '#fff', borderRadius: 16, padding: 24, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 12, padding: 16, fontSize: 18, marginBottom: 16 },
  otpInput: { textAlign: 'center', letterSpacing: 8 },
  otpInfo: { color: '#64748b', marginBottom: 16 },
  button: { backgroundColor: '#2563eb', borderRadius: 12, padding: 16, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  changePhone: { color: '#2563eb', textAlign: 'center', marginTop: 16 },
});

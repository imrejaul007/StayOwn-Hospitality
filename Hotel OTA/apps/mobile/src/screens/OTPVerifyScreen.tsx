import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { authApi, setTokens, storeUser } from '../lib/api';

const OTP_LENGTH = 6;
const RESEND_SECONDS = 45;

export default function OTPVerifyScreen({ route, navigation }: any) {
  const { phone, otpRef, devOtp } = route.params as {
    phone: string;
    otpRef: string;
    devOtp?: string;
  };

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const inputRefs = useRef<(TextInput | null)[]>(Array(OTP_LENGTH).fill(null));
  const submitted = useRef(false);

  useEffect(() => {
    if (countdown <= 0) return;
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  const last4 = phone.slice(-4);

  async function verify(code: string) {
    if (submitted.current) return;
    submitted.current = true;
    setLoading(true);
    try {
      const res = await authApi.verifyOtp(phone, code, otpRef);
      await setTokens(res.access_token, res.refresh_token);
      await storeUser(res.user);
      const isNew = res.is_new_user ?? false;
      if (isNew) {
        navigation.reset({ index: 0, routes: [{ name: 'ProfileSetup' }] });
      } else {
        navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
      }
    } catch (err: any) {
      submitted.current = false;
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleDigit(text: string, index: number) {
    const char = text.replace(/[^0-9]/g, '').slice(-1);
    const next = [...digits];
    next[index] = char;
    setDigits(next);

    if (char && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    if (char && index === OTP_LENGTH - 1) {
      const code = [...next].join('');
      if (code.length === OTP_LENGTH) {
        verify(code);
      }
    }
  }

  function handleKeyPress(key: string, index: number) {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  async function handleResend() {
    if (countdown > 0) return;
    try {
      await authApi.sendOtp(phone);
      setCountdown(RESEND_SECONDS);
      setDigits(Array(OTP_LENGTH).fill(''));
      submitted.current = false;
      inputRefs.current[0]?.focus();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  }

  const code = digits.join('');

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verify Phone</Text>
      <Text style={styles.subtitle}>Code sent to +91 XXXX{last4}</Text>
      {devOtp ? <Text style={styles.devHint}>Dev OTP: {devOtp}</Text> : null}

      <View style={styles.boxRow}>
        {digits.map((d, i) => (
          <TextInput
            key={i}
            ref={(el) => { inputRefs.current[i] = el; }}
            style={[styles.box, d ? styles.boxFilled : null]}
            value={d}
            onChangeText={(t) => handleDigit(t, i)}
            onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
            keyboardType="number-pad"
            maxLength={1}
            selectTextOnFocus
          />
        ))}
      </View>

      <TouchableOpacity
        style={[styles.button, (code.length !== OTP_LENGTH || loading) && styles.buttonDisabled]}
        onPress={() => verify(code)}
        disabled={code.length !== OTP_LENGTH || loading}
      >
        <Text style={styles.buttonText}>{loading ? 'Verifying...' : 'Verify & Continue'}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={handleResend} disabled={countdown > 0}>
        <Text style={[styles.resendText, countdown > 0 && styles.resendDisabled]}>
          {countdown > 0
            ? `Resend in 0:${String(countdown).padStart(2, '0')}`
            : 'Resend OTP'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#f8fafc' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1e293b', textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#64748b', textAlign: 'center', marginTop: 8, marginBottom: 4 },
  devHint: { fontSize: 12, color: '#94a3b8', textAlign: 'center', marginBottom: 8, fontFamily: 'monospace' },
  boxRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginVertical: 32 },
  box: {
    width: 48,
    height: 56,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: '#1e293b',
    backgroundColor: '#fff',
  },
  boxFilled: { borderColor: '#2563eb' },
  button: { backgroundColor: '#2563eb', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 16 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  resendText: { color: '#2563eb', textAlign: 'center', fontSize: 14, fontWeight: '600' },
  resendDisabled: { color: '#94a3b8' },
});

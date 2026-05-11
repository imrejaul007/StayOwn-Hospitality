import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { loadStoredTokens } from '../lib/api';

export default function SplashScreen({ navigation }: any) {
  useEffect(() => {
    async function init() {
      const hasToken = await loadStoredTokens();
      setTimeout(() => {
        if (hasToken) {
          navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
        } else {
          navigation.reset({ index: 0, routes: [{ name: 'PhoneInput' }] });
        }
      }, 1500);
    }
    init();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>StayOwn</Text>
      <Text style={styles.tagline}>Travel more. Own more.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center' },
  brand: { fontSize: 36, fontWeight: 'bold', color: '#fff' },
  tagline: { fontSize: 16, color: '#bfdbfe', marginTop: 12 },
});

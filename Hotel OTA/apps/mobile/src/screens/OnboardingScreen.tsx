import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
} from 'react-native';

const { width } = Dimensions.get('window');

const slides = [
  {
    id: '1',
    icon: '🏨',
    title: 'Book hotels at better prices',
    subtitle: 'Direct from hotels. 5% vs 18%.',
  },
  {
    id: '2',
    icon: '🪙',
    title: 'Earn rewards every stay',
    subtitle: 'Travel Coins + ReZ Coins on every booking.',
  },
  {
    id: '3',
    icon: '🤝',
    title: 'Hotels own the platform',
    subtitle: 'Co-owners = better service.',
  },
];

function setOnboardingSeen() {
  // Onboarding flag is intentionally ephemeral — it only persists within the current
  // session. The actual onboarding completion state lives on the server (user profile
  // isOnboarded field). On next app restart the server response drives the flow.
  // A global module-level flag is sufficient here since the flag's purpose is only
  // to suppress the banner during the current tab/session.
  (global as any).__onboarding_seen = true;
}

export default function OnboardingScreen({ navigation }: any) {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  function handleSkip() {
    setOnboardingSeen();
    navigation.reset({ index: 0, routes: [{ name: 'PhoneInput' }] });
  }

  function handleNext() {
    if (activeIndex < slides.length - 1) {
      const next = activeIndex + 1;
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
      setActiveIndex(next);
    } else {
      setOnboardingSeen();
      navigation.reset({ index: 0, routes: [{ name: 'PhoneInput' }] });
    }
  }

  function onViewableItemsChanged({ viewableItems }: any) {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index ?? 0);
    }
  }

  const viewabilityConfig = { viewAreaCoveragePercentThreshold: 50 };
  const viewabilityConfigCallbackPairs = useRef([
    { viewabilityConfig, onViewableItemsChanged },
  ]);

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <FlatList
        ref={flatListRef}
        data={slides}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs.current}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <Text style={styles.icon}>{item.icon}</Text>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>{item.subtitle}</Text>
          </View>
        )}
      />

      <View style={styles.footer}>
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === activeIndex && styles.dotActive]}
            />
          ))}
        </View>

        <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
          <Text style={styles.nextText}>
            {activeIndex === slides.length - 1 ? 'Get Started' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  skipButton: { position: 'absolute', top: Platform.OS === 'ios' ? 56 : 20, right: 24, zIndex: 10 },
  skipText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  slide: { width, flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, paddingTop: 80 },
  icon: { fontSize: 72, marginBottom: 32 },
  title: { fontSize: 26, fontWeight: 'bold', color: '#1e293b', textAlign: 'center', marginBottom: 16 },
  subtitle: { fontSize: 16, color: '#64748b', textAlign: 'center', lineHeight: 24 },
  footer: { paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 48 : 32, paddingTop: 16 },
  dots: { flexDirection: 'row', justifyContent: 'center', marginBottom: 24, gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#cbd5e1' },
  dotActive: { backgroundColor: '#2563eb', width: 24 },
  nextButton: { backgroundColor: '#2563eb', borderRadius: 14, padding: 18, alignItems: 'center' },
  nextText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

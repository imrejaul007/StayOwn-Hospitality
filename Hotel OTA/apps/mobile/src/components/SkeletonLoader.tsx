import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export default function SkeletonLoader({
  width = '100%',
  height = 16,
  borderRadius = 8,
  style,
}: SkeletonLoaderProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.base,
        { width: width as any, height, borderRadius, opacity },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: '#cbd5e1' },
});

// ---------- Pre-built variants ----------

export function SkeletonCard({ style }: { style?: ViewStyle }) {
  return (
    <View style={[skeletonCardStyles.card, style]}>
      <SkeletonLoader height={140} borderRadius={10} style={skeletonCardStyles.image} />
      <View style={skeletonCardStyles.body}>
        <SkeletonLoader height={16} width="70%" borderRadius={6} />
        <SkeletonLoader height={12} width="50%" borderRadius={6} style={skeletonCardStyles.gap} />
        <SkeletonLoader height={14} width="40%" borderRadius={6} style={skeletonCardStyles.gap} />
      </View>
    </View>
  );
}

const skeletonCardStyles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  image: { width: '100%' },
  body: { padding: 14 },
  gap: { marginTop: 8 },
});

export function SkeletonText({
  lines = 3,
  style,
}: {
  lines?: number;
  style?: ViewStyle;
}) {
  return (
    <View style={style}>
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonLoader
          key={i}
          height={14}
          width={i === lines - 1 ? '60%' : '100%'}
          borderRadius={6}
          style={i > 0 ? { marginTop: 8 } : undefined}
        />
      ))}
    </View>
  );
}

export function SkeletonAvatar({
  size = 48,
  style,
}: {
  size?: number;
  style?: ViewStyle;
}) {
  return (
    <SkeletonLoader
      width={size}
      height={size}
      borderRadius={size / 2}
      style={style}
    />
  );
}

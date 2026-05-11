import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface StarRatingProps {
  rating: number;
  maxStars?: number;
  size?: number;
  interactive?: boolean;
  onRate?: (rating: number) => void;
}

export default function StarRating({
  rating,
  maxStars = 5,
  size = 20,
  interactive = false,
  onRate,
}: StarRatingProps) {
  function getStarType(index: number): 'full' | 'half' | 'empty' {
    const val = rating - index;
    if (val >= 1) return 'full';
    if (val >= 0.5) return 'half';
    return 'empty';
  }

  function renderStar(index: number) {
    const type = getStarType(index);
    const color = type === 'empty' ? '#e2e8f0' : '#f59e0b';
    const char = type === 'half' ? '⯨' : '★';

    const star = (
      <Text style={[styles.star, { fontSize: size, color }]} key={index}>
        {char}
      </Text>
    );

    if (interactive) {
      return (
        <TouchableOpacity
          key={index}
          onPress={() => onRate?.(index + 1)}
          activeOpacity={0.7}
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
        >
          {star}
        </TouchableOpacity>
      );
    }
    return star;
  }

  return (
    <View style={styles.row}>
      {Array.from({ length: maxStars }, (_, i) => renderStar(i))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  star: { lineHeight: undefined },
});

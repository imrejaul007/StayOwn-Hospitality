import React, { useState } from 'react';
import {
  Alert,
  Dimensions,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import BottomSheet from './BottomSheet';
import StarRating from './StarRating';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/v1';

interface RatingModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit?: () => void;
  bookingId: string;
}

const CATEGORY_RATINGS = [
  { key: 'cleanliness', label: 'Cleanliness' },
  { key: 'location', label: 'Location' },
  { key: 'value', label: 'Value' },
  { key: 'service', label: 'Service' },
];

export default function RatingModal({
  visible,
  onClose,
  onSubmit,
  bookingId,
}: RatingModalProps) {
  const [overall, setOverall] = useState(0);
  const [categoryRatings, setCategoryRatings] = useState<Record<string, number>>({
    cleanliness: 0,
    location: 0,
    value: 0,
    service: 0,
  });
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function setCategoryRating(key: string, val: number) {
    setCategoryRatings((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSubmit() {
    if (overall === 0) {
      Alert.alert('Rating Required', 'Please provide an overall rating before submitting.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          overallRating: overall,
          categoryRatings,
          comment,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to submit review');
      }
      Alert.alert('Thank you!', 'Your review has been submitted.');
      onSubmit?.();
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} height={SCREEN_HEIGHT * 0.78}>
      <Text style={styles.title}>Rate Your Stay</Text>

      {/* Overall Rating */}
      <View style={styles.overallBox}>
        <Text style={styles.overallLabel}>Overall Rating</Text>
        <StarRating
          rating={overall}
          maxStars={5}
          size={36}
          interactive
          onRate={setOverall}
        />
        {overall > 0 && (
          <Text style={styles.overallValue}>{overall} / 5</Text>
        )}
      </View>

      {/* Category Ratings */}
      <View style={styles.categoriesBox}>
        {CATEGORY_RATINGS.map(({ key, label }) => (
          <View key={key} style={styles.categoryRow}>
            <Text style={styles.categoryLabel}>{label}</Text>
            <StarRating
              rating={categoryRatings[key]}
              maxStars={5}
              size={22}
              interactive
              onRate={(val) => setCategoryRating(key, val)}
            />
          </View>
        ))}
      </View>

      {/* Comment */}
      <Text style={styles.commentLabel}>Your Comments</Text>
      <TextInput
        style={styles.commentInput}
        value={comment}
        onChangeText={setComment}
        placeholder="Tell us about your experience..."
        placeholderTextColor="#94a3b8"
        multiline
        numberOfLines={4}
        textAlignVertical="top"
      />

      <TouchableOpacity
        style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        <Text style={styles.submitBtnText}>
          {submitting ? 'Submitting...' : 'Submit Review'}
        </Text>
      </TouchableOpacity>
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

  overallBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  overallLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  overallValue: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#f59e0b',
  },

  categoriesBox: {
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
  },

  commentLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: '#1e293b',
    backgroundColor: '#f8fafc',
    minHeight: 96,
    marginBottom: 20,
  },

  submitBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

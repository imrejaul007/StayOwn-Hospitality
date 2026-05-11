import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { formatINR } from '../lib/api';
import StarRating from './StarRating';

export interface Hotel {
  hotelId: string;
  name: string;
  starRating?: number;
  category?: string;
  address?: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  availableRoomTypes?: { ratePerNightPaise: number; availableCount: number }[];
  otaCoinEarnPreviewPaise?: number;
  amenities?: string[];
}

interface HotelCardProps {
  hotel: Hotel;
  onPress: () => void;
  variant?: 'small' | 'large';
  checkin?: string;
  checkout?: string;
}

function getLowestRate(hotel: Hotel): number {
  if (!hotel.availableRoomTypes?.length) return 0;
  return Math.min(...hotel.availableRoomTypes.map((r) => r.ratePerNightPaise));
}

function getTotalAvailability(hotel: Hotel): number {
  if (!hotel.availableRoomTypes?.length) return 0;
  return hotel.availableRoomTypes.reduce((sum, r) => sum + (r.availableCount || 0), 0);
}

// ---- Small Card (160px wide, for horizontal scroll) ----
function HotelCardSmall({ hotel, onPress }: { hotel: Hotel; onPress: () => void }) {
  const lowestRate = getLowestRate(hotel);
  const earn = hotel.otaCoinEarnPreviewPaise || 0;

  return (
    <TouchableOpacity style={styles.smallCard} onPress={onPress} activeOpacity={0.85}>
      {/* Thumbnail */}
      {hotel.thumbnailUrl || hotel.imageUrl ? (
        <Image
          source={{ uri: hotel.thumbnailUrl || hotel.imageUrl }}
          style={styles.smallImage}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.smallImage, styles.imagePlaceholder]}>
          <Text style={styles.imagePlaceholderText}>🏨</Text>
        </View>
      )}

      <View style={styles.smallBody}>
        <Text style={styles.smallName} numberOfLines={2}>{hotel.name}</Text>
        <View style={styles.smallStarsRow}>
          <StarRating rating={hotel.starRating || 0} size={11} />
        </View>
        {lowestRate > 0 && (
          <Text style={styles.smallPrice}>From {formatINR(lowestRate)}</Text>
        )}
        {earn > 0 && (
          <View style={styles.earnBadge}>
            <Text style={styles.earnBadgeText}>+{formatINR(earn)} coins</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ---- Large Card (full width, for vertical list) ----
function HotelCardLarge({ hotel, onPress }: { hotel: Hotel; onPress: () => void }) {
  const lowestRate = getLowestRate(hotel);
  const totalAvail = getTotalAvailability(hotel);
  const earn = hotel.otaCoinEarnPreviewPaise || 0;
  const lowAvailability = totalAvail > 0 && totalAvail <= 3;

  return (
    <TouchableOpacity style={styles.largeCard} onPress={onPress} activeOpacity={0.85}>
      {/* Image */}
      {hotel.imageUrl || hotel.thumbnailUrl ? (
        <Image
          source={{ uri: hotel.imageUrl || hotel.thumbnailUrl }}
          style={styles.largeImage}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.largeImage, styles.imagePlaceholder]}>
          <Text style={styles.imagePlaceholderTextLarge}>🏨</Text>
        </View>
      )}

      {lowAvailability && (
        <View style={styles.availWarning}>
          <Text style={styles.availWarningText}>Only {totalAvail} room(s) left!</Text>
        </View>
      )}

      <View style={styles.largeBody}>
        <View style={styles.largeHeader}>
          <Text style={styles.largeName} numberOfLines={2}>{hotel.name}</Text>
          {(hotel.starRating || 0) > 0 && (
            <StarRating rating={hotel.starRating!} size={14} />
          )}
        </View>

        {hotel.address ? (
          <Text style={styles.largeAddress} numberOfLines={2}>
            {hotel.address}
          </Text>
        ) : null}

        <View style={styles.largeFooter}>
          <View>
            {lowestRate > 0 ? (
              <Text style={styles.largePrice}>
                From <Text style={styles.largePriceValue}>{formatINR(lowestRate)}</Text>/night
              </Text>
            ) : (
              <Text style={styles.largePrice}>Price unavailable</Text>
            )}
            {earn > 0 && (
              <Text style={styles.largeEarn}>Earn {formatINR(earn)} coins</Text>
            )}
          </View>
          <View style={styles.largeArrow}>
            <Text style={styles.largeArrowText}>›</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ---- Exported unified component ----
export default function HotelCard({
  hotel,
  onPress,
  variant = 'large',
}: HotelCardProps) {
  if (variant === 'small') {
    return <HotelCardSmall hotel={hotel} onPress={onPress} />;
  }
  return <HotelCardLarge hotel={hotel} onPress={onPress} />;
}

const styles = StyleSheet.create({
  // Shared
  imagePlaceholder: {
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderText: { fontSize: 28 },
  imagePlaceholderTextLarge: { fontSize: 40 },

  // Small card
  smallCard: {
    width: 160,
    backgroundColor: '#fff',
    borderRadius: 14,
    marginRight: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  smallImage: { width: '100%', height: 100 },
  smallBody: { padding: 10 },
  smallName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
    lineHeight: 18,
  },
  smallStarsRow: { marginTop: 4 },
  smallPrice: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 6,
  },
  earnBadge: {
    backgroundColor: '#f0fdf4',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginTop: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  earnBadgeText: { fontSize: 10, fontWeight: '600', color: '#16a34a' },

  // Large card
  largeCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  largeImage: { width: '100%', height: 180 },
  availWarning: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  availWarningText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  largeBody: { padding: 14 },
  largeHeader: { gap: 4 },
  largeName: { fontSize: 17, fontWeight: '700', color: '#1e293b', lineHeight: 22 },
  largeAddress: { fontSize: 12, color: '#64748b', marginTop: 4, lineHeight: 16 },
  largeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  largePrice: { fontSize: 13, color: '#64748b' },
  largePriceValue: { fontSize: 16, fontWeight: '800', color: '#1e293b' },
  largeEarn: { fontSize: 12, fontWeight: '600', color: '#16a34a', marginTop: 2 },
  largeArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  largeArrowText: { fontSize: 20, color: '#64748b', lineHeight: 24 },
});

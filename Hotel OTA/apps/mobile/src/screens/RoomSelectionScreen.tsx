import React from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { formatINR } from '../lib/api';

function nightsBetween(checkin: string, checkout: string): number {
  const a = new Date(checkin).getTime();
  const b = new Date(checkout).getTime();
  const diff = Math.round((b - a) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 1;
}

export default function RoomSelectionScreen({ route, navigation }: any) {
  const { hotel, checkin, checkout } = route.params as {
    hotel: any;
    checkin: string;
    checkout: string;
  };

  const nights = nightsBetween(checkin, checkout);
  const roomTypes: any[] = hotel.roomTypes || [];

  function handleSelect(roomType: any) {
    navigation.navigate('BookingReview', {
      hotel,
      roomType,
      checkin,
      checkout,
      nights,
    });
  }

  return (
    <View style={styles.container}>
      <Text style={styles.hotelName}>{hotel.name}</Text>
      <Text style={styles.dateRow}>
        {checkin} → {checkout} · {nights} night{nights !== 1 ? 's' : ''}
      </Text>

      <FlatList
        data={roomTypes}
        keyExtractor={(item) => item.roomTypeId}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => {
          const total = item.baseRatePaise * nights;
          return (
            <View style={styles.roomCard}>
              <View style={styles.roomHeader}>
                <Text style={styles.roomName}>{item.name}</Text>
                <Text style={styles.occupancy}>Up to {item.maxOccupancy} guests</Text>
              </View>

              {(item.bedType || item.sizeSqft) ? (
                <Text style={styles.roomMeta}>
                  {[item.bedType && `${item.bedType} bed`, item.sizeSqft && `${item.sizeSqft} sqft`]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              ) : null}

              {item.amenities?.length ? (
                <View style={styles.amenitiesRow}>
                  {item.amenities.slice(0, 4).map((a: string) => (
                    <Text key={a} style={styles.amenityTag}>{a}</Text>
                  ))}
                </View>
              ) : null}

              <View style={styles.roomFooter}>
                <View>
                  <Text style={styles.ratePerNight}>
                    {formatINR(item.baseRatePaise)}/night
                  </Text>
                  <Text style={styles.totalRate}>
                    {formatINR(total)} total
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.selectButton}
                  onPress={() => handleSelect(item)}
                >
                  <Text style={styles.selectButtonText}>
                    Select · {formatINR(total)}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>No rooms available</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  hotelName: { fontSize: 22, fontWeight: 'bold', color: '#1e293b' },
  dateRow: { fontSize: 13, color: '#64748b', marginTop: 4, marginBottom: 16 },
  roomCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  roomHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  roomName: { fontSize: 16, fontWeight: '700', color: '#1e293b', flex: 1 },
  occupancy: { fontSize: 12, color: '#64748b' },
  roomMeta: { fontSize: 13, color: '#64748b', marginTop: 6 },
  amenitiesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  amenityTag: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    fontSize: 11,
    color: '#475569',
  },
  roomFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
  },
  ratePerNight: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  totalRate: { fontSize: 12, color: '#64748b', marginTop: 2 },
  selectButton: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  selectButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 40 },
});

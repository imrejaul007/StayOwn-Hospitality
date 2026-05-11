import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { hotelsApi, bookingsApi, formatINR } from '../lib/api';

export default function HotelDetailScreen({ route, navigation }: any) {
  const { hotelId, checkin, checkout } = route.params;
  const [hotel, setHotel] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    hotelsApi.getById(hotelId).then(setHotel).catch(console.error).finally(() => setLoading(false));
  }, [hotelId]);

  async function handleBook(roomType: any) {
    try {
      const holdRes = await bookingsApi.hold({
        hotel_id: hotelId,
        room_type_id: roomType.roomTypeId,
        checkin_date: checkin,
        checkout_date: checkout,
        num_rooms: 1,
        num_guests: 2,
        guest_name: 'Guest',
        guest_phone: '9876543210',
        channel_source: 'ota_app',
        ota_coin_burn_paise: 0,
        rez_coin_burn_paise: 0,
      });

      navigation.navigate('BookingConfirm', {
        holdId: holdRes.hold_id,
        bookingRef: holdRes.booking_ref,
        totalValuePaise: holdRes.total_value_paise,
        pgAmountPaise: holdRes.pg_amount_paise,
        razorpayOrderId: holdRes.razorpay_order_id,
        hotelName: hotel.name,
        checkin,
        checkout,
      });
    } catch (err: any) {
      Alert.alert('Booking Failed', err.message);
    }
  }

  if (loading) return <View style={styles.center}><Text>Loading...</Text></View>;
  if (!hotel) return <View style={styles.center}><Text>Hotel not found</Text></View>;

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.name}>{hotel.name}</Text>
      <Text style={styles.stars}>{'★'.repeat(hotel.starRating || 0)} {hotel.category}</Text>
      <Text style={styles.address}>{hotel.address}</Text>

      {hotel.description && <Text style={styles.description}>{hotel.description}</Text>}

      <View style={styles.policies}>
        <Text style={styles.sectionTitle}>Policies</Text>
        <Text style={styles.policyText}>Check-in: {hotel.policies.checkinTime}</Text>
        <Text style={styles.policyText}>Check-out: {hotel.policies.checkoutTime}</Text>
        <Text style={styles.policyText}>{hotel.policies.cancellationPolicy}</Text>
      </View>

      <Text style={styles.sectionTitle}>Available Rooms</Text>
      {hotel.roomTypes.map((rt: any) => (
        <View key={rt.roomTypeId} style={styles.roomCard}>
          <View style={styles.roomHeader}>
            <Text style={styles.roomName}>{rt.name}</Text>
            <Text style={styles.roomOccupancy}>Up to {rt.maxOccupancy} guests</Text>
          </View>
          {rt.bedType && <Text style={styles.roomDetail}>{rt.bedType} bed{rt.sizeSqft ? ` · ${rt.sizeSqft} sqft` : ''}</Text>}
          <View style={styles.roomFooter}>
            <Text style={styles.roomRate}>{formatINR(rt.baseRatePaise)}/night</Text>
            <TouchableOpacity style={styles.bookButton} onPress={() => handleBook(rt)}>
              <Text style={styles.bookButtonText}>Book Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  name: { fontSize: 24, fontWeight: 'bold', color: '#1e293b' },
  stars: { fontSize: 14, color: '#f59e0b', marginTop: 4, textTransform: 'capitalize' },
  address: { fontSize: 14, color: '#64748b', marginTop: 4 },
  description: { fontSize: 14, color: '#475569', marginTop: 12, lineHeight: 20 },
  policies: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginTop: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginTop: 20, marginBottom: 12 },
  policyText: { fontSize: 13, color: '#64748b', marginBottom: 4 },
  roomCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12 },
  roomHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  roomName: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
  roomOccupancy: { fontSize: 12, color: '#64748b' },
  roomDetail: { fontSize: 13, color: '#64748b', marginTop: 4 },
  roomFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  roomRate: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  bookButton: { backgroundColor: '#2563eb', borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  bookButtonText: { color: '#fff', fontWeight: '600' },
});

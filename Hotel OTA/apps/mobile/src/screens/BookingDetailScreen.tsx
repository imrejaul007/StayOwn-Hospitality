import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
} from 'react-native';
import { bookingsApi, formatINR } from '../lib/api';
import RatingModal from '../components/RatingModal';

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  confirmed:   { color: '#16a34a', bg: '#dcfce7', label: 'Confirmed' },
  checked_in:  { color: '#2563eb', bg: '#dbeafe', label: 'Checked In' },
  stayed:      { color: '#6b7280', bg: '#f3f4f6', label: 'Stayed' },
  cancelled:   { color: '#ef4444', bg: '#fee2e2', label: 'Cancelled' },
  hold:        { color: '#f59e0b', bg: '#fef9c3', label: 'On Hold' },
};

export default function BookingDetailScreen({ route, navigation }: any) {
  const { bookingId } = route.params;
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [ratingVisible, setRatingVisible] = useState(false);

  useEffect(() => {
    bookingsApi
      .getById(bookingId)
      .then(setBooking)
      .catch((err: any) => Alert.alert('Error', err.message))
      .finally(() => setLoading(false));
  }, [bookingId]);

  async function handleCancel() {
    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel this booking?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: () =>
            navigation.navigate('CancelBooking', {
              bookingId: booking.bookingId,
              hotelName: booking.hotelName,
              totalPaidPaise: booking.amountPaidPaise,
              otaCoinUsed: booking.otaCoinBurnPaise || 0,
              rezCoinUsed: booking.rezCoinBurnPaise || 0,
            }),
        },
      ]
    );
  }

  function handleCallHotel() {
    if (booking?.hotelPhone) {
      Linking.openURL(`tel:${booking.hotelPhone}`);
    } else {
      Alert.alert('Unavailable', 'Hotel phone number not available.');
    }
  }

  function handleGetDirections() {
    const address = encodeURIComponent(booking?.hotelAddress || '');
    Linking.openURL(`https://maps.google.com/?q=${address}`);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Loading booking...</Text>
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Booking not found.</Text>
      </View>
    );
  }

  const statusCfg = STATUS_CONFIG[booking.status] || STATUS_CONFIG.hold;
  const isCancellable = ['confirmed', 'hold'].includes(booking.status);
  const isCompleted = booking.status === 'stayed';

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Status Banner */}
        <View style={[styles.statusBanner, { backgroundColor: statusCfg.bg }]}>
          <View style={[styles.statusDot, { backgroundColor: statusCfg.color }]} />
          <Text style={[styles.statusLabel, { color: statusCfg.color }]}>
            {statusCfg.label}
          </Text>
          <Text style={styles.bookingRef}>{booking.bookingRef}</Text>
        </View>

        {/* Hotel Info */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Hotel</Text>
          <Text style={styles.hotelName}>{booking.hotelName}</Text>
          <Text style={styles.address}>{booking.hotelAddress}</Text>
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.actionButton} onPress={handleCallHotel}>
              <Text style={styles.actionButtonText}>📞  Call Hotel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonOutline]}
              onPress={handleGetDirections}
            >
              <Text style={[styles.actionButtonText, styles.actionButtonTextOutline]}>
                🗺  Get Directions
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stay Details */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Stay Details</Text>
          <View style={styles.detailRow}>
            <View style={styles.detailCol}>
              <Text style={styles.detailLabel}>Check-in</Text>
              <Text style={styles.detailValue}>{booking.checkinDate}</Text>
              <Text style={styles.detailSub}>{booking.hotelCheckinTime || '12:00 PM'}</Text>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailCol}>
              <Text style={styles.detailLabel}>Check-out</Text>
              <Text style={styles.detailValue}>{booking.checkoutDate}</Text>
              <Text style={styles.detailSub}>{booking.hotelCheckoutTime || '11:00 AM'}</Text>
            </View>
          </View>
          <View style={styles.separator} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Room Type</Text>
            <Text style={styles.infoValue}>{booking.roomTypeName || 'Standard Room'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Guests</Text>
            <Text style={styles.infoValue}>{booking.numGuests || 1} guest(s)</Text>
          </View>
          {booking.specialRequests ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Special Requests</Text>
              <Text style={[styles.infoValue, styles.infoValueWrap]}>
                {booking.specialRequests}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Payment Summary */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Payment Summary</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Room Rate</Text>
            <Text style={styles.infoValue}>{formatINR(booking.roomRatePaise || 0)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>GST (12%)</Text>
            <Text style={styles.infoValue}>{formatINR(booking.gstPaise || 0)}</Text>
          </View>
          {(booking.otaCoinBurnPaise || 0) > 0 && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>OTA Coins Used</Text>
              <Text style={[styles.infoValue, styles.discountText]}>
                -{formatINR(booking.otaCoinBurnPaise)}
              </Text>
            </View>
          )}
          {(booking.rezCoinBurnPaise || 0) > 0 && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>ReZ Coins Used</Text>
              <Text style={[styles.infoValue, styles.discountText]}>
                -{formatINR(booking.rezCoinBurnPaise)}
              </Text>
            </View>
          )}
          <View style={styles.separator} />
          <View style={styles.infoRow}>
            <Text style={styles.totalLabel}>Amount Paid</Text>
            <Text style={styles.totalValue}>{formatINR(booking.amountPaidPaise || 0)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Payment Method</Text>
            <Text style={styles.infoValue}>{booking.paymentMethod || 'Online'}</Text>
          </View>
        </View>

        {/* Coins Earned */}
        {isCompleted && (booking.otaCoinEarnedPaise || 0) > 0 && (
          <View style={styles.coinsCard}>
            <Text style={styles.coinsTitle}>Coins Earned</Text>
            <Text style={styles.coinsAmount}>+{formatINR(booking.otaCoinEarnedPaise)}</Text>
            <Text style={styles.coinsSub}>OTA Travel Coins added to your wallet</Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsBlock}>
          {isCompleted && (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => setRatingVisible(true)}
            >
              <Text style={styles.primaryButtonText}>Rate Your Stay</Text>
            </TouchableOpacity>
          )}
          {isCancellable && (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancel}
              disabled={cancelling}
            >
              <Text style={styles.cancelButtonText}>
                {cancelling ? 'Cancelling...' : 'Cancel Booking'}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.voucherButton}
            onPress={() =>
              navigation.navigate('Voucher', {
                bookingId: booking.bookingId,
                bookingRef: booking.bookingRef,
                hotelName: booking.hotelName,
                address: booking.hotelAddress,
                phone: booking.hotelPhone || '',
                checkin: booking.checkinDate,
                checkout: booking.checkoutDate,
                room: booking.roomTypeName || 'Standard Room',
                guest: booking.guestName || 'Guest',
                amountPaid: booking.amountPaidPaise || 0,
              })
            }
          >
            <Text style={styles.voucherButtonText}>View Voucher</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Rating Modal */}
      <RatingModal
        visible={ratingVisible}
        onClose={() => setRatingVisible(false)}
        onSubmit={() => setRatingVisible(false)}
        bookingId={bookingId}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  loadingText: { fontSize: 15, color: '#64748b' },
  errorText: { fontSize: 15, color: '#ef4444' },

  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 8,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusLabel: { fontSize: 15, fontWeight: '700', flex: 1 },
  bookingRef: { fontSize: 12, color: '#64748b', fontFamily: 'monospace' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  hotelName: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  address: { fontSize: 13, color: '#64748b', marginTop: 4, lineHeight: 18 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  actionButton: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  actionButtonOutline: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  actionButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  actionButtonTextOutline: { color: '#1e293b' },

  detailRow: { flexDirection: 'row', alignItems: 'center' },
  detailCol: { flex: 1, alignItems: 'center' },
  detailLabel: { fontSize: 12, color: '#94a3b8', fontWeight: '500' },
  detailValue: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginTop: 4 },
  detailSub: { fontSize: 11, color: '#64748b', marginTop: 2 },
  detailDivider: { width: 1, height: 50, backgroundColor: '#e2e8f0' },

  separator: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 12 },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  infoLabel: { fontSize: 13, color: '#64748b', flex: 1 },
  infoValue: { fontSize: 13, fontWeight: '600', color: '#1e293b', textAlign: 'right', flex: 1 },
  infoValueWrap: { flexShrink: 1, textAlign: 'right' },
  discountText: { color: '#16a34a' },
  totalLabel: { fontSize: 15, fontWeight: '700', color: '#1e293b', flex: 1 },
  totalValue: { fontSize: 18, fontWeight: '800', color: '#2563eb' },

  coinsCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  coinsTitle: { fontSize: 13, fontWeight: '600', color: '#16a34a', textTransform: 'uppercase', letterSpacing: 0.5 },
  coinsAmount: { fontSize: 28, fontWeight: '800', color: '#15803d', marginTop: 4 },
  coinsSub: { fontSize: 12, color: '#4ade80', marginTop: 4 },

  actionsBlock: { gap: 10, marginTop: 4 },
  primaryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancelButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#fca5a5',
  },
  cancelButtonText: { color: '#ef4444', fontSize: 16, fontWeight: '600' },
  voucherButton: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  voucherButtonText: { color: '#475569', fontSize: 15, fontWeight: '600' },
});

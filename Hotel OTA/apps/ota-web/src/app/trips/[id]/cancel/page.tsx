'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { bookingsApi, formatINR, formatDate } from '@/lib/api';

const CANCEL_REASONS = [
  { value: 'change_of_plans', label: 'Change of plans' },
  { value: 'found_better_deal', label: 'Found a better deal' },
  { value: 'emergency', label: 'Personal emergency' },
  { value: 'duplicate_booking', label: 'Duplicate booking' },
  { value: 'other', label: 'Other' },
];

export default function CancelBookingPage() {
  const params = useParams();
  const router = useRouter();
  const bookingId = params.id as string;

  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    bookingsApi
      .getById(bookingId)
      .then((data) => setBooking(data.booking || data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [bookingId]);

  async function handleCancel() {
    if (!reason) return;
    setCancelling(true);
    setError('');
    try {
      await bookingsApi.cancel(bookingId, reason);
      router.push('/trips');
    } catch (err: any) {
      setError(err.message || 'Cancellation failed. Please try again.');
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-lg mx-auto min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Loading booking details...</p>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="max-w-lg mx-auto min-h-screen bg-gray-50 flex items-center justify-center px-5">
        <div className="text-center">
          <p className="text-gray-500 text-lg">Booking not found</p>
          <button onClick={() => router.push('/trips')} className="mt-4 text-blue-600 text-sm hover:underline">
            Back to Trips
          </button>
        </div>
      </div>
    );
  }

  const nights =
    booking.checkinDate && booking.checkoutDate
      ? Math.max(
          1,
          Math.round(
            (new Date(booking.checkoutDate).getTime() - new Date(booking.checkinDate).getTime()) /
              86400000
          )
        )
      : 1;

  const totalPaid = booking.pgAmountPaise || booking.totalValuePaise || 0;
  const coinsReturned =
    (booking.otaCoinBurnPaise || 0) + (booking.rezCoinBurnPaise || 0);

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <div className="bg-white px-5 pt-12 pb-4 flex items-center gap-3 border-b border-gray-100 sticky top-0 z-30">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700 text-lg">
          ←
        </button>
        <h1 className="text-lg font-bold text-gray-900">Cancel Booking</h1>
      </div>

      {/* Warning Banner */}
      <div className="mx-4 mt-4 bg-red-50 border border-red-100 rounded-2xl px-5 py-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-red-500 text-lg">⚠️</span>
          <p className="font-bold text-red-700 text-sm">You are about to cancel this booking</p>
        </div>
        <p className="text-xs text-red-600">This action cannot be undone once confirmed.</p>
      </div>

      {/* Booking Info */}
      <div className="mx-4 mt-4 bg-white rounded-2xl border border-gray-100 p-5">
        <h2 className="text-lg font-bold text-gray-900">{booking.hotelName}</h2>
        {booking.city && <p className="text-sm text-gray-400 mt-0.5">{booking.city}</p>}
        <div className="mt-4 space-y-2.5 text-sm">
          {booking.checkinDate && (
            <div className="flex justify-between">
              <span className="text-gray-500">Check-in</span>
              <span className="font-medium text-gray-900">{formatDate(booking.checkinDate)}</span>
            </div>
          )}
          {booking.checkoutDate && (
            <div className="flex justify-between">
              <span className="text-gray-500">Check-out</span>
              <span className="font-medium text-gray-900">{formatDate(booking.checkoutDate)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-500">Duration</span>
            <span className="font-medium text-gray-900">
              {nights} Night{nights > 1 ? 's' : ''}
            </span>
          </div>
          <div className="border-t border-gray-100 pt-2.5 flex justify-between">
            <span className="text-gray-500">Amount Paid</span>
            <span className="font-bold text-gray-900">{formatINR(totalPaid)}</span>
          </div>
        </div>
      </div>

      {/* Refund Info */}
      <div className="mx-4 mt-4 bg-green-50 border border-green-100 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-green-600 text-lg">✓</span>
          <h3 className="font-bold text-green-800">Free Cancellation</h3>
        </div>
        <p className="text-sm text-green-700 mb-3">
          Full refund of {formatINR(totalPaid)} will be credited to your original payment method within 5–7 business days.
        </p>
        <div className="text-xs text-green-600 space-y-1">
          <p>• No cancellation charges apply</p>
          <p>• Refund timeline: 5–7 business days</p>
        </div>
      </div>

      {/* Coin Return Notice */}
      {coinsReturned > 0 && (
        <div className="mx-4 mt-4 bg-blue-50 border border-blue-100 rounded-2xl p-4">
          <div className="flex items-center gap-2">
            <span className="text-blue-500 text-lg">🪙</span>
            <div>
              <p className="text-sm font-bold text-blue-800">Coins Will Be Returned</p>
              <p className="text-xs text-blue-600 mt-0.5">
                {formatINR(coinsReturned)} in coins used for this booking will be credited back to your wallet.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Reason Selector */}
      <div className="mx-4 mt-4 bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="font-bold text-gray-900 mb-3">Reason for Cancellation</h3>
        <div className="space-y-2">
          {CANCEL_REASONS.map(({ value, label }) => (
            <label
              key={value}
              className={`flex items-center gap-3 cursor-pointer rounded-xl px-4 py-3 border transition ${
                reason === value
                  ? 'border-red-400 bg-red-50'
                  : 'border-gray-100 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="reason"
                value={value}
                checked={reason === value}
                onChange={(e) => setReason(e.target.value)}
                className="accent-red-600 w-4 h-4"
              />
              <span className="text-sm text-gray-700">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Action Buttons */}
      <div className="mx-4 mt-6 space-y-3">
        <button
          onClick={handleCancel}
          disabled={!reason || cancelling}
          className="w-full bg-red-600 text-white py-4 rounded-2xl font-bold text-base hover:bg-red-700 disabled:opacity-50 transition shadow-md"
        >
          {cancelling ? 'Cancelling...' : 'Yes, Cancel Booking'}
        </button>
        <button
          onClick={() => router.back()}
          className="w-full border border-gray-200 text-gray-700 py-3.5 rounded-2xl font-semibold hover:bg-gray-50 transition text-sm"
        >
          Keep Booking
        </button>
      </div>
    </div>
  );
}

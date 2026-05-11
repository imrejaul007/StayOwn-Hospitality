'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { bookingsApi, reviewsApi, formatINR, formatDate } from '@/lib/api';

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  hold: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', label: 'Pending Confirmation' },
  confirmed: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', label: 'Confirmed' },
  checked_in: { bg: 'bg-green-50 border-green-200', text: 'text-green-700', label: 'Checked In' },
  stayed: { bg: 'bg-gray-50 border-gray-200', text: 'text-gray-600', label: 'Completed' },
  cancelled: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', label: 'Cancelled' },
};

export default function TripDetailPage() {
  const params = useParams();
  const router = useRouter();
  const bookingId = params.id as string;

  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [categoryRatings, setCategoryRatings] = useState<Record<string, number>>({});
  const [review, setReview] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  useEffect(() => {
    bookingsApi
      .getById(bookingId)
      .then((data) => setBooking(data.booking || data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [bookingId]);

  async function handleCancel() {
    if (!cancelReason.trim()) return;
    setCancelling(true);
    try {
      await bookingsApi.cancel(bookingId, cancelReason);
      setBooking((prev: any) => ({ ...prev, status: 'cancelled' }));
      setCancelOpen(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-lg mx-auto min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Loading trip details...</p>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="max-w-lg mx-auto min-h-screen bg-gray-50 flex items-center justify-center px-5">
        <div className="text-center">
          <p className="text-gray-500 text-lg">Trip not found</p>
          <button onClick={() => router.push('/trips')} className="mt-4 text-blue-600 text-sm hover:underline">
            Back to Trips
          </button>
        </div>
      </div>
    );
  }

  async function handleSubmitReview() {
    if (rating === 0) return;
    setSubmittingReview(true);
    try {
      await reviewsApi.submit({
        booking_id: bookingId,
        rating,
        comment: review,
        category_ratings: categoryRatings,
      });
      setReviewSubmitted(true);
      setRatingOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to submit review. Please try again.');
    } finally {
      setSubmittingReview(false);
    }
  }

  const status = statusConfig[booking.status] || statusConfig.hold;
  const isUpcoming = ['hold', 'confirmed', 'checked_in'].includes(booking.status);
  const isCompleted = ['stayed'].includes(booking.status);

  const nights = booking.checkinDate && booking.checkoutDate
    ? Math.max(1, Math.round((new Date(booking.checkoutDate).getTime() - new Date(booking.checkinDate).getTime()) / 86400000))
    : 1;

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-gray-50 pb-10">
      {/* Top Bar */}
      <div className="bg-white px-5 pt-12 pb-4 flex items-center gap-3 border-b border-gray-100 sticky top-0 z-30">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700 text-lg font-medium">
          ←
        </button>
        <h1 className="text-lg font-bold text-gray-900">Trip Details</h1>
      </div>

      {/* Status Banner */}
      <div className={`mx-4 mt-4 rounded-2xl border px-5 py-4 ${status.bg}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-xs font-semibold uppercase tracking-wide ${status.text}`}>Status</p>
            <p className={`text-lg font-bold mt-0.5 ${status.text}`}>{status.label}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-gray-400 font-mono">Booking Ref</p>
            <p className="font-mono text-sm font-bold text-gray-700 mt-0.5">{booking.bookingRef}</p>
          </div>
        </div>
      </div>

      {/* Hotel Info */}
      <div className="mx-4 mt-4 bg-white rounded-2xl border border-gray-100 p-5">
        <h2 className="text-xl font-bold text-gray-900">{booking.hotelName}</h2>
        {booking.city && <p className="text-sm text-gray-400 mt-0.5">{booking.city}</p>}
        {booking.address && <p className="text-sm text-gray-500 mt-1">{booking.address}</p>}

        {/* Call / Directions */}
        <div className="flex gap-3 mt-4">
          {booking.phone && (
            <a
              href={`tel:${booking.phone}`}
              className="flex-1 flex items-center justify-center gap-2 border border-gray-200 rounded-xl py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
            >
              <span>📞</span> Call Hotel
            </a>
          )}
          {booking.address && (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(booking.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 border border-gray-200 rounded-xl py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
            >
              <span>📍</span> Directions
            </a>
          )}
          {!booking.phone && !booking.address && (
            <div className="flex-1 flex items-center gap-2 text-sm text-gray-400">
              <span>📍</span>
              <span>{booking.city || 'Hotel location'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Stay Details */}
      <div className="mx-4 mt-4 bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="font-bold text-gray-900 mb-4">Stay Details</h3>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Check-in</span>
            <span className="font-semibold text-gray-900">{formatDate(booking.checkinDate)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Check-out</span>
            <span className="font-semibold text-gray-900">{formatDate(booking.checkoutDate)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Duration</span>
            <span className="font-semibold text-gray-900">{nights} Night{nights > 1 ? 's' : ''}</span>
          </div>
          {booking.roomTypeName && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Room Type</span>
              <span className="font-semibold text-gray-900">{booking.roomTypeName}</span>
            </div>
          )}
          {booking.numRooms && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Rooms</span>
              <span className="font-semibold text-gray-900">{booking.numRooms}</span>
            </div>
          )}
          {booking.numGuests && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Guests</span>
              <span className="font-semibold text-gray-900">{booking.numGuests}</span>
            </div>
          )}
        </div>
      </div>

      {/* Payment Summary */}
      <div className="mx-4 mt-4 bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="font-bold text-gray-900 mb-4">Payment Summary</h3>
        <div className="space-y-3">
          {booking.baseRatePaise !== undefined && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Room Rate ({nights} night{nights > 1 ? 's' : ''})</span>
              <span className="text-gray-900">{formatINR(booking.baseRatePaise * nights)}</span>
            </div>
          )}
          {booking.taxAmountPaise !== undefined && booking.taxAmountPaise > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">GST & Taxes</span>
              <span className="text-gray-900">{formatINR(booking.taxAmountPaise)}</span>
            </div>
          )}
          {booking.otaCoinBurnPaise !== undefined && booking.otaCoinBurnPaise > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">OTA Coins Used</span>
              <span className="text-green-600">−{formatINR(booking.otaCoinBurnPaise)}</span>
            </div>
          )}
          {booking.rezCoinBurnPaise !== undefined && booking.rezCoinBurnPaise > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">ReZ Coins Used</span>
              <span className="text-purple-600">−{formatINR(booking.rezCoinBurnPaise)}</span>
            </div>
          )}
          <div className="border-t border-gray-100 pt-3">
            <div className="flex justify-between">
              <span className="font-bold text-gray-900">Total Paid</span>
              <span className="text-xl font-bold text-blue-600">{formatINR(booking.pgAmountPaise || booking.totalValuePaise)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Coins Earned */}
      {(booking.otaCoinEarnedPaise > 0 || booking.rezCoinEarnedPaise > 0) && (
        <div className="mx-4 mt-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl border border-green-100 p-5">
          <h3 className="font-bold text-gray-900 mb-3">Rewards Earned</h3>
          <div className="flex gap-4">
            {booking.otaCoinEarnedPaise > 0 && (
              <div className="flex-1 text-center">
                <p className="text-2xl font-bold text-green-600">{formatINR(booking.otaCoinEarnedPaise)}</p>
                <p className="text-xs text-gray-500 mt-0.5">OTA Coins</p>
              </div>
            )}
            {booking.rezCoinEarnedPaise > 0 && (
              <div className="flex-1 text-center">
                <p className="text-2xl font-bold text-purple-600">{formatINR(booking.rezCoinEarnedPaise)}</p>
                <p className="text-xs text-gray-500 mt-0.5">ReZ Coins</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mx-4 mt-4 space-y-3">
        {isUpcoming && booking.status !== 'cancelled' && (
          <button
            onClick={() => setCancelOpen(true)}
            className="w-full border border-red-200 text-red-600 py-3.5 rounded-2xl font-semibold hover:bg-red-50 transition text-sm"
          >
            Cancel Booking
          </button>
        )}
        {isCompleted && !reviewSubmitted && (
          <button
            onClick={() => setRatingOpen(true)}
            className="w-full bg-blue-600 text-white py-3.5 rounded-2xl font-semibold hover:bg-blue-700 transition text-sm"
          >
            Rate Your Stay
          </button>
        )}
        {reviewSubmitted && (
          <div className="bg-green-50 border border-green-100 rounded-2xl px-5 py-4 text-center">
            <p className="text-sm font-bold text-green-700">Thank you for your review!</p>
            <p className="text-xs text-green-600 mt-0.5">Your feedback helps other travellers.</p>
          </div>
        )}
        <button
          onClick={() => router.push('/trips')}
          className="w-full border border-gray-200 text-gray-600 py-3.5 rounded-2xl font-semibold hover:bg-gray-50 transition text-sm"
        >
          Back to Trips
        </button>
      </div>

      {/* Cancel Confirmation Modal */}
      {cancelOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full max-w-lg mx-auto rounded-t-3xl p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Cancel Booking</h3>
            <p className="text-sm text-gray-500 mb-4">
              Are you sure you want to cancel this booking? This action cannot be undone.
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-2">Reason for cancellation</label>
            <select
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-400 focus:outline-none mb-4"
            >
              <option value="">Select a reason</option>
              <option value="change_of_plans">Change of plans</option>
              <option value="found_better_deal">Found a better deal</option>
              <option value="emergency">Personal emergency</option>
              <option value="duplicate_booking">Duplicate booking</option>
              <option value="other">Other</option>
            </select>
            <div className="flex gap-3">
              <button
                onClick={() => setCancelOpen(false)}
                className="flex-1 border border-gray-200 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-50 transition text-sm"
              >
                Keep Booking
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling || !cancelReason}
                className="flex-1 bg-red-600 text-white py-3 rounded-xl font-semibold hover:bg-red-700 disabled:opacity-50 transition text-sm"
              >
                {cancelling ? 'Cancelling...' : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rating Modal */}
      {ratingOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end overflow-y-auto">
          <div className="bg-white w-full max-w-lg mx-auto rounded-t-3xl p-6 pb-8">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Rate Your Stay</h3>
            <p className="text-sm text-gray-500 mb-4">How was your experience at {booking.hotelName}?</p>

            {/* Overall star rating */}
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Overall Rating</p>
            <div className="flex gap-2 justify-center mb-5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className={`text-4xl transition ${star <= rating ? 'text-amber-400' : 'text-gray-200'}`}
                >
                  ★
                </button>
              ))}
            </div>

            {/* Category ratings */}
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Rate by Category</p>
            <div className="space-y-3 mb-4">
              {['Cleanliness', 'Location', 'Value', 'Service'].map((cat) => (
                <div key={cat} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700 w-24">{cat}</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        onClick={() => setCategoryRatings((prev) => ({ ...prev, [cat.toLowerCase()]: s }))}
                        className={`text-lg transition ${s <= (categoryRatings[cat.toLowerCase()] || 0) ? 'text-amber-400' : 'text-gray-200'}`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <textarea
              value={review}
              onChange={(e) => setReview(e.target.value)}
              placeholder="Share your experience (optional)..."
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none mb-4 resize-none"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setRatingOpen(false)}
                className="flex-1 border border-gray-200 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-50 transition text-sm"
              >
                Skip
              </button>
              <button
                onClick={handleSubmitReview}
                disabled={rating === 0 || submittingReview}
                className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition text-sm"
              >
                {submittingReview ? 'Submitting...' : 'Submit Review'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

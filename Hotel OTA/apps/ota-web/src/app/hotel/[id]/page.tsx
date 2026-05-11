'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import { hotelsApi, bookingsApi, reviewsApi, wishlistApi, formatINR } from '@/lib/api';

const RATING_CATEGORIES = ['Cleanliness', 'Location', 'Value', 'Service'];

function StarRow({ label, value }: { label: string; value: number }) {
  const pct = Math.round((value / 5) * 100);
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-20 shrink-0">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
        <div className="bg-amber-400 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold text-gray-700 w-6 text-right">{value.toFixed(1)}</span>
    </div>
  );
}

function HotelDetailContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const hotelId = params.id as string;
  const checkin = searchParams.get('checkin') || '';
  const checkout = searchParams.get('checkout') || '';

  const [hotel, setHotel] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);

  // Guest details before booking
  const [selectedRoomType, setSelectedRoomType] = useState<any>(null);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');

  // Wishlist
  const [wishlisted, setWishlisted] = useState(false);
  const [wishlistLoading, setWishlistLoading] = useState(false);

  // Reviews
  const [reviews, setReviews] = useState<any[]>([]);
  const [allReviews, setAllReviews] = useState<any[]>([]);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [overallRating, setOverallRating] = useState(0);
  const [categoryRatings, setCategoryRatings] = useState<Record<string, number>>({});

  useEffect(() => {
    hotelsApi.getById(hotelId).then(setHotel).catch(console.error).finally(() => setLoading(false));

    // Check if already wishlisted
    wishlistApi.list().then((data) => {
      const list: any[] = data.wishlists || data || [];
      setWishlisted(list.some((h: any) => (h.hotelId || h.hotel_id) === hotelId));
    }).catch(() => {});

    // Fetch reviews
    setReviewsLoading(true);
    reviewsApi.getForHotel(hotelId).then((data) => {
      const list: any[] = data.reviews || data || [];
      setAllReviews(list);
      setReviews(list.slice(0, 3));
      if (list.length > 0) {
        const avg = list.reduce((s: number, r: any) => s + (r.rating || 0), 0) / list.length;
        setOverallRating(Math.round(avg * 10) / 10);
        const cats: Record<string, number[]> = {};
        list.forEach((r: any) => {
          if (r.category_ratings) {
            Object.entries(r.category_ratings).forEach(([k, v]) => {
              if (!cats[k]) cats[k] = [];
              cats[k].push(v as number);
            });
          }
        });
        const avgCats: Record<string, number> = {};
        Object.entries(cats).forEach(([k, vals]) => {
          avgCats[k] = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
        });
        setCategoryRatings(avgCats);
      }
    }).catch(() => {}).finally(() => setReviewsLoading(false));
  }, [hotelId]);

  async function toggleWishlist() {
    setWishlistLoading(true);
    try {
      if (wishlisted) {
        await wishlistApi.remove(hotelId);
        setWishlisted(false);
      } else {
        await wishlistApi.add(hotelId);
        setWishlisted(true);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update wishlist');
    } finally {
      setWishlistLoading(false);
    }
  }

  function handleBook(rt: any) {
    // Show guest details form before calling hold
    setSelectedRoomType(rt);
  }

  async function confirmBooking() {
    if (!guestName.trim() || !guestPhone.trim()) {
      alert('Please enter your name and phone number');
      return;
    }
    setBooking(true);
    try {
      const res = await bookingsApi.hold({
        hotel_id: hotelId,
        room_type_id: selectedRoomType.roomTypeId,
        checkin_date: checkin,
        checkout_date: checkout,
        num_rooms: 1,
        num_guests: 2,
        guest_name: guestName.trim(),
        guest_phone: guestPhone.trim(),
        channel_source: 'ota_app',
        ota_coin_burn_paise: 0,
        rez_coin_burn_paise: 0,
      });
      setSelectedRoomType(null);
      const params = new URLSearchParams({
        holdId: res.hold_id,
        ref: res.booking_ref,
        bookingValue: String(res.total_value_paise),
        pg: String(res.pg_amount_paise),
        razorpayOrderId: res.razorpay_order_id || '',
        hotel: hotel.name,
        checkin,
        checkout,
        otaBalance: String(res.ota_coin_new_balance_paise || 0),
      });
      router.push(`/checkout/coins?${params.toString()}`);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBooking(false);
    }
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen text-gray-400">Loading...</div>;
  if (!hotel) return <div className="flex items-center justify-center min-h-screen text-red-500">Hotel not found</div>;

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-gray-50 pb-20">
      {/* Header Image placeholder */}
      <div className="bg-gradient-to-br from-blue-500 to-indigo-600 h-48 flex items-end px-5 pb-5 relative">
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">{hotel.name}</h1>
          <p className="text-blue-200 text-sm">{'★'.repeat(hotel.starRating || 0)} · {hotel.category}</p>
        </div>
        {/* Wishlist heart button */}
        <button
          onClick={toggleWishlist}
          disabled={wishlistLoading}
          className="absolute top-4 right-4 w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/30 transition disabled:opacity-50"
          title={wishlisted ? 'Remove from saved' : 'Save hotel'}
        >
          <span className={`text-xl transition ${wishlisted ? 'text-red-400' : 'text-white'}`}>
            {wishlisted ? '❤️' : '🤍'}
          </span>
        </button>
      </div>

      <div className="px-5 py-4">
        <p className="text-sm text-gray-500">{hotel.address}</p>
        {hotel.description && <p className="text-sm text-gray-600 mt-3 leading-relaxed">{hotel.description}</p>}

        {/* Amenities */}
        <div className="flex flex-wrap gap-2 mt-4">
          {(hotel.amenities || []).map((a: string) => (
            <span key={a} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium capitalize">{a}</span>
          ))}
        </div>

        {/* Policies */}
        <div className="mt-5 bg-white rounded-xl p-4 border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-2">Policies</h3>
          <p className="text-xs text-gray-500">Check-in: {hotel.policies?.checkinTime ?? 'Flexible'} · Check-out: {hotel.policies?.checkoutTime ?? 'Flexible'}</p>
          <p className="text-xs text-gray-500 mt-1">{hotel.policies?.cancellationPolicy ?? 'Contact hotel for cancellation policy'}</p>
        </div>

        {/* Room Types */}
        <h3 className="font-bold text-gray-900 mt-6 mb-3">Available Rooms</h3>
        <div className="space-y-3">
          {(hotel.roomTypes ?? []).map((rt: any) => (
            <div key={rt.roomTypeId} className="bg-white rounded-xl p-4 border border-gray-100">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-semibold text-gray-900">{rt.name}</h4>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {rt.bedType} · Up to {rt.maxOccupancy} guests{rt.sizeSqft ? ` · ${rt.sizeSqft} sqft` : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-gray-900">{formatINR(rt.baseRatePaise)}</p>
                  <p className="text-[10px] text-gray-400">per night</p>
                </div>
              </div>
              <button onClick={() => handleBook(rt)} disabled={booking}
                className="w-full mt-3 bg-blue-600 text-white py-2.5 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition text-sm">
                {booking ? 'Reserving...' : 'Book Now'}
              </button>
            </div>
          ))}
        </div>

        {/* Reviews Section */}
        <div className="mt-6">
          <h3 className="font-bold text-gray-900 mb-3">Guest Reviews</h3>

          {reviewsLoading ? (
            <div className="bg-white rounded-2xl p-5 border border-gray-100 animate-pulse">
              <div className="h-10 bg-gray-200 rounded w-1/3 mb-4" />
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => <div key={i} className="h-3 bg-gray-200 rounded" />)}
              </div>
            </div>
          ) : reviews.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 border border-gray-100 text-center">
              <span className="text-3xl">⭐</span>
              <p className="text-sm text-gray-400 mt-2">No reviews yet. Be the first to rate your stay!</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              {/* Overall rating */}
              <div className="flex items-center gap-4 mb-5">
                <div className="text-center">
                  <p className="text-5xl font-black text-gray-900">{overallRating}</p>
                  <div className="flex justify-center mt-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <span key={s} className={`text-sm ${s <= Math.round(overallRating) ? 'text-amber-400' : 'text-gray-200'}`}>★</span>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">{reviews.length} review{reviews.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex-1 space-y-2">
                  {RATING_CATEGORIES.map((cat) => (
                    <StarRow key={cat} label={cat} value={categoryRatings[cat.toLowerCase()] || categoryRatings[cat] || overallRating} />
                  ))}
                </div>
              </div>

              {/* Individual reviews */}
              <div className="space-y-4 border-t border-gray-50 pt-4">
                {(showAllReviews ? allReviews : reviews).map((review: any, idx: number) => (
                  <div key={review.id || idx} className="pb-4 border-b border-gray-50 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-semibold text-gray-900">{review.guestName || review.guest_name || 'Guest'}</p>
                      <p className="text-[10px] text-gray-400">
                        {review.createdAt || review.created_at
                          ? new Date(review.createdAt || review.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                          : ''}
                      </p>
                    </div>
                    <div className="flex gap-0.5 mb-1.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <span key={s} className={`text-xs ${s <= (review.rating || 0) ? 'text-amber-400' : 'text-gray-200'}`}>★</span>
                      ))}
                    </div>
                    {review.comment && <p className="text-xs text-gray-600 leading-relaxed">{review.comment}</p>}
                  </div>
                ))}
              </div>

              {allReviews.length > 3 && (
                <button
                  onClick={() => setShowAllReviews((v) => !v)}
                  className="mt-4 w-full text-center text-sm text-blue-600 font-semibold hover:underline"
                >
                  {showAllReviews ? 'Show fewer reviews ↑' : `Read all ${allReviews.length} reviews →`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <BottomNav />

      {/* Guest Details Modal — shown when user taps Book Now */}
      {selectedRoomType && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
          <div className="bg-white w-full max-w-lg rounded-t-2xl p-6 pb-10">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Guest Details</h2>
            <p className="text-sm text-gray-400 mb-5">{selectedRoomType.name} · {hotel.name}</p>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Full Name *"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="tel"
                placeholder="Phone Number *"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setSelectedRoomType(null)}
                className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-xl font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={confirmBooking}
                disabled={booking}
                className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50"
              >
                {booking ? 'Reserving...' : 'Continue →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function HotelDetailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>}>
      <HotelDetailContent />
    </Suspense>
  );
}

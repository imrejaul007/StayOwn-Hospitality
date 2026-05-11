'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { bookingsApi, formatINR, formatDate } from '@/lib/api';

export default function BookingConfirmedPage() {
  const params = useParams();
  const router = useRouter();
  const bookingId = params.id as string;

  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    // Trigger animation shortly after mount
    const t = setTimeout(() => setAnimate(true), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    bookingsApi
      .getById(bookingId)
      .then((data) => setBooking(data.booking || data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [bookingId]);

  const bookingRef = booking?.bookingRef ?? booking?.booking_ref ?? bookingId;

  const copyRef = useCallback(() => {
    if (!bookingRef) return;
    navigator.clipboard.writeText(bookingRef).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [bookingRef]);

  if (loading) {
    return (
      <div className="max-w-lg mx-auto min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400">Loading confirmation...</p>
      </div>
    );
  }

  const nights =
    booking?.checkinDate && booking?.checkoutDate
      ? Math.max(
          1,
          Math.round(
            (new Date(booking.checkoutDate).getTime() -
              new Date(booking.checkinDate).getTime()) /
              86400000
          )
        )
      : 1;

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-gray-50 pb-10">
      {/* Top success banner */}
      <div className="bg-gradient-to-b from-green-500 to-green-600 px-5 pt-14 pb-8 text-center rounded-b-3xl">
        {/* Animated checkmark */}
        <div
          className="transition-transform duration-500 ease-out"
          style={{ transform: animate ? 'scale(1)' : 'scale(0)' }}
        >
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto shadow-lg">
            <svg
              className="w-10 h-10 text-green-500"
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
        <h1 className="text-2xl font-black text-white mt-4">Booking Confirmed!</h1>
        <p className="text-green-100 text-sm mt-1">
          {booking?.hotelName || 'Your hotel stay is booked'}
        </p>
      </div>

      {/* Booking Ref */}
      <div className="mx-4 mt-5 bg-white rounded-2xl border border-gray-100 p-4">
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">Booking Reference</p>
        <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
          <span className="font-mono text-base font-bold text-gray-800 tracking-wider">
            {bookingRef}
          </span>
          <button
            onClick={copyRef}
            className="text-blue-600 text-xs font-semibold hover:text-blue-700 transition ml-3"
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Coins Saved */}
      {((booking?.otaCoinBurnedPaise ?? 0) + (booking?.rezCoinBurnedPaise ?? 0) + (booking?.hotelBrandCoinBurnedPaise ?? 0)) > 0 && (
        <div className="mx-4 mt-4 bg-gradient-to-r from-amber-50 to-yellow-50 rounded-2xl border border-amber-100 p-5">
          <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-3">You Saved with Coins 🪙</p>
          <div className="flex gap-4 flex-wrap">
            {booking.otaCoinBurnedPaise > 0 && (
              <div className="flex-1 min-w-[80px] text-center bg-white rounded-xl py-3 px-2 border border-amber-100">
                <p className="text-xl font-bold text-green-600">− {formatINR(booking.otaCoinBurnedPaise)}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">OTA Coins</p>
              </div>
            )}
            {booking.rezCoinBurnedPaise > 0 && (
              <div className="flex-1 min-w-[80px] text-center bg-white rounded-xl py-3 px-2 border border-amber-100">
                <p className="text-xl font-bold text-purple-600">− {formatINR(booking.rezCoinBurnedPaise)}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">ReZ Coins</p>
              </div>
            )}
            {booking.hotelBrandCoinBurnedPaise > 0 && (
              <div className="flex-1 min-w-[80px] text-center bg-white rounded-xl py-3 px-2 border border-amber-100">
                <p className="text-xl font-bold text-indigo-600">− {formatINR(booking.hotelBrandCoinBurnedPaise)}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">Hotel Coins</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Coins Earned */}
      {(booking?.otaCoinEarnedPaise > 0 || booking?.rezCoinEarnedPaise > 0 || booking?.hotelBrandCoinEarnedPaise > 0) && (
        <div className="mx-4 mt-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl border border-green-100 p-5">
          <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-3">Rewards Earned this Stay 🎉</p>
          <div className="flex gap-4">
            {booking.otaCoinEarnedPaise > 0 && (
              <div className="flex-1 text-center">
                <p className="text-2xl font-bold text-green-600">+ {formatINR(booking.otaCoinEarnedPaise)}</p>
                <p className="text-xs text-gray-500 mt-0.5">OTA Coins</p>
              </div>
            )}
            {booking.rezCoinEarnedPaise > 0 && (
              <div className="flex-1 text-center">
                <p className="text-2xl font-bold text-purple-600">+ {formatINR(booking.rezCoinEarnedPaise)}</p>
                <p className="text-xs text-gray-500 mt-0.5">ReZ Coins</p>
              </div>
            )}
            {booking.hotelBrandCoinEarnedPaise > 0 && (
              <div className="flex-1 text-center">
                <p className="text-2xl font-bold text-amber-600">+ {formatINR(booking.hotelBrandCoinEarnedPaise)}</p>
                <p className="text-xs text-gray-500 mt-0.5">Hotel Coins</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Booking Summary */}
      <div className="mx-4 mt-4 bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="font-bold text-gray-900 mb-4">Booking Summary</h3>
        <div className="space-y-3 text-sm">
          {booking?.hotelName && (
            <div className="flex justify-between">
              <span className="text-gray-500">Hotel</span>
              <span className="font-semibold text-gray-900 text-right max-w-[60%] truncate">
                {booking.hotelName}
              </span>
            </div>
          )}
          {booking?.checkinDate && (
            <div className="flex justify-between">
              <span className="text-gray-500">Check-in</span>
              <span className="font-medium text-gray-900">{formatDate(booking.checkinDate)}</span>
            </div>
          )}
          {booking?.checkoutDate && (
            <div className="flex justify-between">
              <span className="text-gray-500">Check-out</span>
              <span className="font-medium text-gray-900">{formatDate(booking.checkoutDate)}</span>
            </div>
          )}
          {nights > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">Duration</span>
              <span className="font-medium text-gray-900">
                {nights} Night{nights > 1 ? 's' : ''}
              </span>
            </div>
          )}
          {booking?.roomTypeName && (
            <div className="flex justify-between">
              <span className="text-gray-500">Room Type</span>
              <span className="font-medium text-gray-900">{booking.roomTypeName}</span>
            </div>
          )}
          {booking?.numGuests && (
            <div className="flex justify-between">
              <span className="text-gray-500">Guests</span>
              <span className="font-medium text-gray-900">{booking.numGuests}</span>
            </div>
          )}
          <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
            <span className="font-bold text-gray-900">Total Paid</span>
            <span className="text-xl font-bold text-blue-600">
              {formatINR(booking?.pgAmountPaise || booking?.totalValuePaise || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mx-4 mt-6 space-y-3">
        <Link
          href={`/trips/${bookingId}`}
          className="block w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-center text-base hover:bg-blue-700 transition shadow-md"
        >
          View Details
        </Link>
        <Link
          href="/home"
          className="block w-full border border-gray-200 text-gray-700 py-3.5 rounded-2xl font-semibold text-center hover:bg-gray-50 transition"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}

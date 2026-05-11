'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { bookingsApi, formatINR, formatDate } from '@/lib/api';

export default function VoucherPage() {
  const params = useParams();
  const router = useRouter();
  const bookingId = params.id as string;

  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    bookingsApi
      .getById(bookingId)
      .then((data) => setBooking(data.booking || data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [bookingId]);

  if (loading) {
    return (
      <div className="max-w-lg mx-auto min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Loading voucher...</p>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="max-w-lg mx-auto min-h-screen flex items-center justify-center px-5">
        <div className="text-center">
          <p className="text-gray-500 text-lg">Voucher not found</p>
          <button onClick={() => router.back()} className="mt-4 text-blue-600 text-sm hover:underline">
            Go back
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

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print-page { max-width: 100% !important; padding: 0 !important; }
        }
      `}</style>

      <div className="max-w-lg mx-auto min-h-screen bg-white print-page">
        {/* Top Bar — hidden on print */}
        <div className="no-print bg-white px-5 pt-12 pb-4 flex items-center gap-3 border-b border-gray-100 sticky top-0 z-30">
          <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700 text-lg">
            ←
          </button>
          <h1 className="text-lg font-bold text-gray-900">Booking Voucher</h1>
          <button
            onClick={() => window.print()}
            className="ml-auto bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-blue-700 transition"
          >
            🖨 Print
          </button>
        </div>

        {/* Voucher Content */}
        <div className="px-6 py-6">
          {/* Header */}
          <div className="border-b-2 border-gray-900 pb-5 mb-5">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-black text-gray-900">StayOwn</h1>
                <p className="text-xs text-gray-500 mt-0.5">Official Booking Voucher</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Status</p>
                <p className="text-sm font-bold text-green-600 uppercase mt-0.5">
                  {booking.status === 'confirmed' || booking.status === 'checked_in'
                    ? 'Confirmed'
                    : booking.status}
                </p>
              </div>
            </div>
          </div>

          {/* Hotel Info */}
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900">{booking.hotelName}</h2>
            {booking.address && (
              <p className="text-sm text-gray-600 mt-1">{booking.address}</p>
            )}
            {booking.city && !booking.address && (
              <p className="text-sm text-gray-600 mt-1">{booking.city}</p>
            )}
            {booking.phone && (
              <p className="text-sm text-gray-600 mt-0.5">Tel: {booking.phone}</p>
            )}
          </div>

          {/* QR Code Placeholder (booking ref in bordered box) */}
          <div className="mb-6 flex items-center gap-4">
            <div className="border-2 border-gray-900 w-24 h-24 flex items-center justify-center rounded-lg shrink-0 bg-gray-50">
              <span
                className="text-[7px] font-mono font-bold text-gray-800 text-center leading-tight break-all px-1"
                aria-label="Booking reference QR code placeholder"
              >
                {booking.bookingRef}
              </span>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Booking Reference</p>
              <p className="text-lg font-mono font-bold text-gray-900 mt-0.5">{booking.bookingRef}</p>
              <p className="text-xs text-gray-400 mt-1">Show this at hotel reception</p>
            </div>
          </div>

          {/* Guest & Stay Details */}
          <div className="bg-gray-50 rounded-2xl p-4 mb-5 space-y-2.5 text-sm">
            {booking.guestName && (
              <div className="flex justify-between">
                <span className="text-gray-500 font-medium">Guest Name</span>
                <span className="font-semibold text-gray-900">{booking.guestName}</span>
              </div>
            )}
            {booking.checkinDate && (
              <div className="flex justify-between">
                <span className="text-gray-500 font-medium">Check-in</span>
                <span className="font-semibold text-gray-900">{formatDate(booking.checkinDate)}</span>
              </div>
            )}
            {booking.checkoutDate && (
              <div className="flex justify-between">
                <span className="text-gray-500 font-medium">Check-out</span>
                <span className="font-semibold text-gray-900">{formatDate(booking.checkoutDate)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500 font-medium">Duration</span>
              <span className="font-semibold text-gray-900">
                {nights} Night{nights > 1 ? 's' : ''}
              </span>
            </div>
            {booking.roomTypeName && (
              <div className="flex justify-between">
                <span className="text-gray-500 font-medium">Room Type</span>
                <span className="font-semibold text-gray-900">{booking.roomTypeName}</span>
              </div>
            )}
            {booking.numRooms && (
              <div className="flex justify-between">
                <span className="text-gray-500 font-medium">Rooms</span>
                <span className="font-semibold text-gray-900">{booking.numRooms}</span>
              </div>
            )}
            {booking.numGuests && (
              <div className="flex justify-between">
                <span className="text-gray-500 font-medium">Guests</span>
                <span className="font-semibold text-gray-900">{booking.numGuests}</span>
              </div>
            )}
          </div>

          {/* Paid in Full Banner */}
          <div className="border-2 border-gray-900 rounded-xl px-5 py-4 text-center mb-5">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Payment</p>
            <p className="text-xl font-black text-gray-900 tracking-wide">
              PAID IN FULL: {formatINR(booking.pgAmountPaise || booking.totalValuePaise || 0)}
            </p>
          </div>

          {/* Fine Print */}
          <div className="text-[10px] text-gray-400 space-y-1 border-t border-gray-100 pt-4">
            <p>This voucher is valid as proof of booking. Present it at hotel reception at check-in.</p>
            <p>StayOwn · support@stayown.in · Part of the REZ ecosystem</p>
          </div>
        </div>

        {/* Print Button (bottom, hidden on print) */}
        <div className="no-print px-6 pb-8 space-y-3">
          <button
            onClick={() => window.print()}
            className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold text-base hover:bg-gray-800 transition"
          >
            🖨 Print Voucher
          </button>
          <button
            onClick={() => router.back()}
            className="w-full border border-gray-200 text-gray-600 py-3.5 rounded-2xl font-semibold hover:bg-gray-50 transition text-sm"
          >
            Back to Trip Details
          </button>
        </div>
      </div>
    </>
  );
}

'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { bookingsApi, formatINR, formatDate } from '@/lib/api';

declare global {
  interface Window {
    Razorpay: any;
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function PayContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const holdId = searchParams.get('holdId') || '';
  const razorpayOrderId = searchParams.get('razorpayOrderId') || ''; // must be a real Razorpay order ID (starts with 'order_')
  const bookingRef = searchParams.get('bookingRef') || searchParams.get('ref') || '';
  const totalPaise = parseInt(searchParams.get('totalPaise') || searchParams.get('total') || '0');
  const pgAmountPaise = parseInt(searchParams.get('pgAmountPaise') || searchParams.get('pg') || String(totalPaise));
  const hotelName = searchParams.get('hotelName') || searchParams.get('hotel') || '';
  const checkin = searchParams.get('checkin') || '';
  const checkout = searchParams.get('checkout') || '';
  const otaBurn = parseInt(searchParams.get('otaBurn') || '0');
  const rezBurn = parseInt(searchParams.get('rezBurn') || '0');

  const [loading, setLoading] = useState(false);

  const nights =
    checkin && checkout
      ? Math.max(1, Math.round((new Date(checkout).getTime() - new Date(checkin).getTime()) / 86400000))
      : 1;

  async function handlePay() {
    setLoading(true);
    try {
      const isDev =
        process.env.NEXT_PUBLIC_DEV_MODE === 'true' ||
        process.env.NODE_ENV === 'development';

      if (isDev) {
        // Dev mode: simulate payment directly
        const result = await bookingsApi.confirm({
          hold_id: holdId,
          razorpay_payment_id: `pay_dev_${Date.now()}`,
          razorpay_signature: 'dev_signature',
        });
        const bookingId =
          result.booking_id || result.bookingId || result.id || holdId;
        router.push(`/booking/confirmed/${bookingId}`);
        return;
      }

      // Coin-only booking — no PG payment needed
      if (pgAmountPaise < 100) {
        const result = await bookingsApi.confirm({
          hold_id: holdId,
          razorpay_payment_id: 'coins_only',
          razorpay_signature: 'coins_only',
        });
        const bookingId = result.booking_id || result.bookingId || result.id || holdId;
        router.push(`/booking/confirmed/${bookingId}`);
        return;
      }

      // Validate we have a real Razorpay order ID before opening the modal
      if (!razorpayOrderId || !razorpayOrderId.startsWith('order_')) {
        alert('Payment session expired or invalid. Please go back and try again.');
        setLoading(false);
        return;
      }

      // Production: load Razorpay and open modal
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        alert('Failed to load payment gateway. Please try again.');
        setLoading(false);
        return;
      }

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '',
        amount: pgAmountPaise,
        currency: 'INR',
        name: 'StayOwn',
        description: `Stay at ${hotelName}`,
        order_id: razorpayOrderId, // must be Razorpay order ID, not internal hold UUID
        prefill: {},
        theme: { color: '#2563eb' },
        handler: async (response: any) => {
          try {
            const result = await bookingsApi.confirm({
              hold_id: holdId,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
            });
            const bookingId =
              result.booking_id || result.bookingId || result.id || holdId;
            router.push(`/booking/confirmed/${bookingId}`);
          } catch (err: any) {
            alert(err.message || 'Payment confirmation failed.');
            setLoading(false);
          }
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err: any) {
      alert(err.message || 'Something went wrong.');
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <div className="bg-white px-5 pt-12 pb-4 flex items-center gap-3 border-b border-gray-100 sticky top-0 z-30">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700 text-lg">
          ←
        </button>
        <h1 className="text-lg font-bold text-gray-900">Complete Payment</h1>
      </div>

      {/* Booking Summary Card */}
      <div className="mx-4 mt-5 bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{hotelName || 'Hotel Stay'}</h2>
            <p className="text-xs text-gray-400 font-mono mt-0.5">{bookingRef}</p>
          </div>
          <span className="bg-blue-50 text-blue-700 text-xs font-bold px-3 py-1 rounded-full">
            {nights} Night{nights > 1 ? 's' : ''}
          </span>
        </div>

        <div className="space-y-3 text-sm">
          {checkin && (
            <div className="flex justify-between">
              <span className="text-gray-500">Check-in</span>
              <span className="font-medium text-gray-900">{formatDate(checkin)}</span>
            </div>
          )}
          {checkout && (
            <div className="flex justify-between">
              <span className="text-gray-500">Check-out</span>
              <span className="font-medium text-gray-900">{formatDate(checkout)}</span>
            </div>
          )}

          <div className="border-t border-gray-100 my-1" />

          {totalPaise > 0 && totalPaise !== pgAmountPaise && (
            <div className="flex justify-between">
              <span className="text-gray-500">Booking Value</span>
              <span className="text-gray-900">{formatINR(totalPaise)}</span>
            </div>
          )}
          {otaBurn > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">OTA Coins</span>
              <span className="text-green-600 font-medium">− {formatINR(otaBurn)}</span>
            </div>
          )}
          {rezBurn > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">ReZ Coins</span>
              <span className="text-purple-600 font-medium">− {formatINR(rezBurn)}</span>
            </div>
          )}

          <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
            <span className="font-bold text-gray-900 text-base">Amount to Pay</span>
            <span className="text-2xl font-bold text-blue-600">{formatINR(pgAmountPaise)}</span>
          </div>
        </div>
      </div>

      {/* Security Badge */}
      <div className="mx-4 mt-3 flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl px-4 py-2.5">
        <span className="text-green-600 text-base">🔒</span>
        <p className="text-xs text-green-700 font-medium">Secured by Razorpay · 256-bit SSL encryption</p>
      </div>

      {/* Pay Button */}
      <div className="mx-4 mt-6">
        <button
          onClick={handlePay}
          disabled={loading}
          className="w-full bg-green-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-green-700 disabled:opacity-50 transition shadow-lg flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Processing...
            </>
          ) : (
            <>Pay {formatINR(pgAmountPaise)}</>
          )}
        </button>
        <p className="text-xs text-gray-400 text-center mt-3">
          {process.env.NODE_ENV === 'development'
            ? 'Dev mode: payment will be simulated'
            : 'You will be redirected to Razorpay secure checkout'}
        </p>
      </div>
    </div>
  );
}

export default function PayPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <PayContent />
    </Suspense>
  );
}

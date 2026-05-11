'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { walletApi, formatINR } from '@/lib/api';

// OTA Coins: max 20% of booking value usable
const OTA_MAX_BURN_RATIO = 0.2;
// ReZ Coins: max 10% of booking value usable
const REZ_MAX_BURN_RATIO = 0.1;

function ApplyCoinsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const holdId = searchParams.get('holdId') || '';
  const razorpayOrderId = searchParams.get('razorpayOrderId') || '';
  const bookingValue = parseInt(searchParams.get('bookingValue') || '0');
  const bookingRef = searchParams.get('ref') || '';
  const hotelName = searchParams.get('hotel') || '';
  const checkin = searchParams.get('checkin') || '';
  const checkout = searchParams.get('checkout') || '';
  const pgAmountPaise = parseInt(searchParams.get('pg') || String(bookingValue));

  const otaBalanceParam = parseInt(searchParams.get('otaBalance') || '0');
  const rezBalanceParam = parseInt(searchParams.get('rezBalance') || '0');

  const [otaBalance, setOtaBalance] = useState(otaBalanceParam);
  const [rezBalance, setRezBalance] = useState(rezBalanceParam);
  const [otaBurn, setOtaBurn] = useState(0);
  const [rezBurn, setRezBurn] = useState(0);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState('');
  const [walletLoaded, setWalletLoaded] = useState(false);

  const otaMax = Math.min(otaBalance, Math.floor(bookingValue * OTA_MAX_BURN_RATIO));
  const rezMax = Math.min(rezBalance, Math.floor(bookingValue * REZ_MAX_BURN_RATIO));
  const youPay = Math.max(0, pgAmountPaise - otaBurn - rezBurn);

  // Always fetch wallet so both balances are accurate (URL params may be partial)
  useEffect(() => {
    if (!walletLoaded) {
      walletApi.get().then((w) => {
        setOtaBalance(w.ota_coin_balance_paise || 0);
        setRezBalance(w.rez_coin_balance_paise || 0);
        setWalletLoaded(true);
      }).catch(console.error);
    }
  }, []);

  async function handleConfirm() {
    setValidating(true);
    setError('');
    // Client-side guard: don't burn more than the booking amount
    if (otaBurn + rezBurn > pgAmountPaise) {
      setError('Coin amount exceeds booking value. Please adjust.');
      setValidating(false);
      return;
    }
    try {
      await walletApi.checkBurn({
        hold_id: holdId,
        ota_coin_burn_paise: otaBurn,
        rez_coin_burn_paise: rezBurn,
      });

      const params = new URLSearchParams({
        holdId,
        razorpayOrderId,
        bookingRef,
        totalPaise: String(bookingValue),
        pgAmountPaise: String(youPay),
        hotelName,
        checkin,
        checkout,
        otaBurn: String(otaBurn),
        rezBurn: String(rezBurn),
      });
      router.push(`/checkout/pay?${params.toString()}`);
    } catch (err: any) {
      setError(err.message || 'Validation failed. Please try again.');
    } finally {
      setValidating(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-gray-50 pb-10">
      {/* Header */}
      <div className="bg-white px-5 pt-12 pb-4 flex items-center gap-3 border-b border-gray-100 sticky top-0 z-30">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700 text-lg">
          ←
        </button>
        <h1 className="text-lg font-bold text-gray-900">Apply Coins</h1>
      </div>

      {/* Booking Value */}
      <div className="mx-4 mt-4 bg-white rounded-2xl border border-gray-100 p-4">
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Booking Total</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">{formatINR(bookingValue)}</p>
        {hotelName && <p className="text-sm text-gray-500 mt-0.5">{hotelName}</p>}
      </div>

      {error && (
        <div className="mx-4 mt-3 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* OTA Coins Slider */}
      <div className="mx-4 mt-4 bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-lg">🟢</span>
            <h3 className="font-bold text-gray-900">OTA Coins</h3>
          </div>
          <span className="text-xs text-gray-400">Balance: {formatINR(otaBalance)}</span>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          Use up to {formatINR(otaMax)} (max {Math.round(OTA_MAX_BURN_RATIO * 100)}% of booking)
        </p>

        {otaMax > 0 ? (
          <>
            <input
              type="range"
              min={0}
              max={otaMax}
              step={100}
              value={otaBurn}
              onChange={(e) => { setOtaBurn(parseInt(e.target.value)); setError(''); }}
              className="w-full accent-green-500"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>₹0</span>
              <span>{formatINR(otaMax)}</span>
            </div>
            <div className="mt-3 flex items-center justify-between bg-green-50 rounded-xl px-4 py-2">
              <span className="text-sm text-gray-600">Applying</span>
              <span className="font-bold text-green-600 text-base">{formatINR(otaBurn)}</span>
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-400 bg-gray-50 rounded-xl px-4 py-3">
            {otaBalance === 0 ? 'No OTA coins in wallet.' : 'Coins not applicable for this booking.'}
          </p>
        )}
      </div>

      {/* ReZ Coins Slider */}
      <div className="mx-4 mt-4 bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-lg">🟣</span>
            <h3 className="font-bold text-gray-900">ReZ Coins</h3>
          </div>
          <span className="text-xs text-gray-400">Balance: {formatINR(rezBalance)}</span>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          Use up to {formatINR(rezMax)} (max {Math.round(REZ_MAX_BURN_RATIO * 100)}% of booking)
        </p>

        {rezMax > 0 ? (
          <>
            <input
              type="range"
              min={0}
              max={rezMax}
              step={100}
              value={rezBurn}
              onChange={(e) => { setRezBurn(parseInt(e.target.value)); setError(''); }}
              className="w-full accent-purple-500"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>₹0</span>
              <span>{formatINR(rezMax)}</span>
            </div>
            <div className="mt-3 flex items-center justify-between bg-purple-50 rounded-xl px-4 py-2">
              <span className="text-sm text-gray-600">Applying</span>
              <span className="font-bold text-purple-600 text-base">{formatINR(rezBurn)}</span>
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-400 bg-gray-50 rounded-xl px-4 py-3">
            {rezBalance === 0 ? 'No ReZ coins in wallet.' : 'ReZ coins not applicable for this booking.'}
          </p>
        )}
      </div>

      {/* Live Summary */}
      <div className="mx-4 mt-4 bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="font-bold text-gray-900 mb-4">Payment Summary</h3>
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Booking Total</span>
            <span className="font-medium text-gray-900">{formatINR(pgAmountPaise)}</span>
          </div>
          {otaBurn > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">OTA Coins</span>
              <span className="font-medium text-green-600">− {formatINR(otaBurn)}</span>
            </div>
          )}
          {rezBurn > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">ReZ Coins</span>
              <span className="font-medium text-purple-600">− {formatINR(rezBurn)}</span>
            </div>
          )}
          <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
            <span className="font-bold text-gray-900">You Pay</span>
            <span className="text-2xl font-bold text-blue-600">{formatINR(youPay)}</span>
          </div>
        </div>
      </div>

      {/* Confirm Button */}
      <div className="mx-4 mt-6">
        <button
          onClick={handleConfirm}
          disabled={validating || !!error}
          className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-base hover:bg-blue-700 disabled:opacity-50 transition shadow-lg"
        >
          {validating ? 'Validating...' : `Confirm & Pay ${formatINR(youPay)}`}
        </button>
        <button
          onClick={() => router.back()}
          className="w-full mt-3 border border-gray-200 text-gray-600 py-3.5 rounded-2xl font-semibold hover:bg-gray-50 transition text-sm"
        >
          Skip — Pay Full Amount
        </button>
      </div>
    </div>
  );
}

export default function ApplyCoinsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <ApplyCoinsContent />
    </Suspense>
  );
}

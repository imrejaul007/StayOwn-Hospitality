'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatINR } from '@/lib/api';

function BillPayConfirmedContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const hotelName = searchParams.get('hotel') || '';
  const bill = parseInt(searchParams.get('bill') || '0');
  const paid = parseInt(searchParams.get('paid') || '0');
  const otaEarned = parseInt(searchParams.get('otaEarned') || '0');
  const rezEarned = parseInt(searchParams.get('rezEarned') || '0');
  const ref = searchParams.get('ref') || '';

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 text-center w-full">
        {/* Success animation */}
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5 animate-bounce">
          <span className="text-4xl">✅</span>
        </div>

        <h1 className="text-2xl font-bold text-gray-900">Payment Successful!</h1>
        <p className="text-gray-500 mt-1">{hotelName}</p>
        {ref && <p className="text-xs text-gray-400 font-mono mt-1">{ref}</p>}

        {/* Amount summary */}
        <div className="bg-gray-50 rounded-xl p-4 mt-5 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Hotel bill</span><span className="font-medium">{formatINR(bill)}</span></div>
          <div className="flex justify-between mt-1"><span className="text-gray-500">You paid</span><span className="font-bold text-gray-900">{formatINR(paid)}</span></div>
        </div>

        {/* Coins earned */}
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-5 mt-4 border border-emerald-200">
          <p className="text-emerald-700 font-bold text-sm">🎉 You earned:</p>
          <div className="flex justify-center gap-6 mt-2">
            <div className="text-center">
              <p className="text-xl font-bold text-emerald-700">{formatINR(otaEarned)}</p>
              <p className="text-[10px] text-emerald-600">🟡 Travel Coins</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-teal-700">{formatINR(rezEarned)}</p>
              <p className="text-[10px] text-teal-600">🔵 ReZ Coins</p>
            </div>
          </div>
        </div>

        {/* Upsell */}
        <div className="bg-blue-50 rounded-xl p-4 mt-4 border border-blue-200">
          <p className="text-sm text-blue-700 font-medium">💡 Book directly with StayOwn next time</p>
          <p className="text-xs text-blue-600 mt-1">Earn <strong>3× more coins</strong> when you book through us!</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <Link href="/search" className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold text-center hover:bg-blue-700 transition text-sm">
            Search Hotels
          </Link>
          <Link href="/home" className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-xl font-semibold text-center hover:bg-gray-50 transition text-sm">
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function BillPayConfirmedPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <BillPayConfirmedContent />
    </Suspense>
  );
}

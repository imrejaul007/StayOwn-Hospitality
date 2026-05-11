'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import { referralApi } from '@/lib/api';

export default function ReferralPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    referralApi
      .getCode()
      .then((data) => setCode(data.referral_code || data.code || ''))
      .catch(() => setError('Could not load referral code. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  }

  async function handleShare() {
    const text = `Book hotels with OTA and earn coins! Use my referral code: ${code}. Download the app now.`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Join OTA Hotels', text });
      } catch {}
    } else {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white px-5 pt-12 pb-4 flex items-center gap-3 border-b border-gray-100 sticky top-0 z-30">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700 text-lg font-medium">
          ←
        </button>
        <h1 className="text-lg font-bold text-gray-900">Refer & Earn</h1>
      </div>

      <div className="px-4 py-5 space-y-4">
        {/* Hero */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white text-center">
          <span className="text-4xl">👥</span>
          <h2 className="text-xl font-bold mt-3">Invite Friends, Earn Together</h2>
          <p className="text-blue-200 text-sm mt-2 leading-relaxed">
            Share your code and both of you get rewarded on your friend's first booking.
          </p>
        </div>

        {/* Rewards breakdown */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-bold text-gray-900 mb-4">How It Works</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 rounded-xl p-4 text-center border border-green-100">
              <p className="text-2xl font-black text-green-600">₹200</p>
              <p className="text-xs text-gray-500 mt-1 font-semibold">You get</p>
              <p className="text-[10px] text-gray-400 mt-0.5">OTA Coins added to your wallet</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-4 text-center border border-blue-100">
              <p className="text-2xl font-black text-blue-600">₹100</p>
              <p className="text-xs text-gray-500 mt-1 font-semibold">Friend gets</p>
              <p className="text-[10px] text-gray-400 mt-0.5">On their first completed booking</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {[
              'Friend signs up using your referral code',
              'Friend completes their first hotel booking',
              'Both of you receive coins automatically',
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <p className="text-xs text-gray-600">{step}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Referral code box */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Your Referral Code</p>
          {loading ? (
            <div className="h-14 bg-gray-100 rounded-xl animate-pulse" />
          ) : error ? (
            <p className="text-sm text-red-500 text-center py-3">{error}</p>
          ) : (
            <>
              <button
                onClick={handleCopy}
                className="w-full bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl py-4 flex items-center justify-center gap-3 hover:bg-gray-100 transition group"
              >
                <span className="text-2xl font-black text-blue-600 tracking-widest font-mono">{code}</span>
                <span className="text-gray-400 group-hover:text-blue-600 transition text-lg">
                  {copied ? '✓' : '📋'}
                </span>
              </button>
              <p className="text-center text-xs text-gray-400 mt-2">
                {copied ? 'Copied to clipboard!' : 'Tap to copy'}
              </p>
            </>
          )}
        </div>

        {/* Share button */}
        {!loading && !error && (
          <button
            onClick={handleShare}
            className="w-full bg-blue-600 text-white py-3.5 rounded-2xl font-semibold hover:bg-blue-700 transition text-sm flex items-center justify-center gap-2"
          >
            <span>🔗</span> Share My Code
          </button>
        )}

        {/* Terms */}
        <p className="text-center text-xs text-gray-400 px-2">
          Coins are credited after the referred friend completes their first booking.
          One referral reward per unique phone number. Coins expire in 12 months.
        </p>
      </div>

      <BottomNav />
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import BottomNav from '@/components/BottomNav';
import { walletApi, wishlistApi, formatINR } from '@/lib/api';

const tierConfig: Record<string, { color: string; bg: string; next: string; progress: number; perks: string[] }> = {
  basic: {
    color: 'text-gray-700',
    bg: 'from-gray-400 to-gray-500',
    next: 'Silver',
    progress: 15,
    perks: ['2% OTA Coins on every booking', 'Access to member deals'],
  },
  silver: {
    color: 'text-gray-500',
    bg: 'from-gray-400 to-gray-600',
    next: 'Gold',
    progress: 45,
    perks: ['3% OTA Coins on bookings', 'Early check-in requests', 'Priority support'],
  },
  gold: {
    color: 'text-amber-600',
    bg: 'from-amber-400 to-amber-600',
    next: 'Platinum',
    progress: 72,
    perks: ['5% OTA Coins on bookings', 'Free room upgrades', 'Dedicated concierge'],
  },
  platinum: {
    color: 'text-purple-600',
    bg: 'from-purple-500 to-purple-700',
    next: null as any,
    progress: 100,
    perks: ['8% OTA Coins on bookings', 'Free airport transfers', 'Suite upgrades', 'Personal travel manager'],
  },
};

const earnMethods = [
  { icon: '🏨', title: 'Book Hotels', desc: 'Earn 2–8% back on every booking' },
  { icon: '⭐', title: 'Write Reviews', desc: 'Get 50 coins per verified review' },
  { icon: '👥', title: 'Refer Friends', desc: 'Earn 500 coins per successful referral' },
  { icon: '🏷️', title: 'Register Walk-in Stay', desc: 'Upload receipt and earn ReZ coins' },
];

export default function RewardsPage() {
  const [wallet, setWallet] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [wishlistCount, setWishlistCount] = useState(0);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const u = localStorage.getItem('ota_user');
      if (u) setUser(JSON.parse(u));
    }
    Promise.all([walletApi.get(), walletApi.transactions(1)])
      .then(([w, t]) => {
        setWallet(w);
        setTransactions((t.transactions || []).slice(0, 5));
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    wishlistApi.list()
      .then((data) => setWishlistCount((data.wishlists || data || []).length))
      .catch(() => {});
  }, []);

  const tier = user?.tier || 'basic';
  const tierInfo = tierConfig[tier] || tierConfig.basic;

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="px-5 pt-12 pb-4">
        <h1 className="text-2xl font-bold text-gray-900">Rewards</h1>
        <p className="text-sm text-gray-400 mt-0.5">Your coins, tier &amp; earning history</p>
      </div>

      {loading ? (
        <div className="px-4 space-y-4">
          <div className="h-36 bg-gray-200 rounded-2xl animate-pulse" />
          <div className="h-24 bg-gray-200 rounded-2xl animate-pulse" />
        </div>
      ) : (
        <>
          {/* Balance Card */}
          <div className="mx-4 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-2xl p-6 text-white shadow-lg">
            <p className="text-blue-200 text-xs font-semibold uppercase tracking-wide mb-4">Your Coins</p>
            <div className="flex">
              <div className="flex-1 text-center">
                <p className="text-blue-200 text-xs">OTA Coins</p>
                <p className="text-3xl font-bold mt-1">{formatINR(wallet?.ota_coin_balance_paise || 0)}</p>
                <p className="text-blue-300 text-[10px] mt-0.5">Travel Coins</p>
              </div>
              <div className="w-px bg-blue-400/30 mx-4" />
              <div className="flex-1 text-center">
                <p className="text-blue-200 text-xs">ReZ Coins</p>
                <p className="text-3xl font-bold mt-1">{formatINR(wallet?.rez_coin_balance_paise || 0)}</p>
                <p className="text-blue-300 text-[10px] mt-0.5">Loyalty Coins</p>
              </div>
            </div>
            {wallet?.ota_coin_expiring_soon_paise > 0 && (
              <div className="mt-4 bg-amber-400/20 rounded-xl px-4 py-2 flex items-center gap-2">
                <span className="text-amber-300 text-sm">⚠️</span>
                <p className="text-amber-200 text-xs">
                  {formatINR(wallet.ota_coin_expiring_soon_paise)} expiring soon —{' '}
                  <Link href="/trips" className="underline font-semibold">use now</Link>
                </p>
              </div>
            )}
          </div>

          {/* Tier Card */}
          <div className="mx-4 mt-4 bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Your Tier</p>
                <p className={`text-2xl font-black capitalize mt-0.5 ${tierInfo.color}`}>{tier}</p>
              </div>
              <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${tierInfo.bg} flex items-center justify-center shadow`}>
                <span className="text-white text-xl">🏅</span>
              </div>
            </div>

            {tierInfo.next && (
              <>
                <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                  <span className="capitalize font-medium">{tier}</span>
                  <span className="capitalize font-medium">{tierInfo.next}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full bg-gradient-to-r ${tierInfo.bg} transition-all duration-500`}
                    style={{ width: `${tierInfo.progress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1.5">
                  Keep booking to reach {tierInfo.next} tier
                </p>
              </>
            )}
            {!tierInfo.next && (
              <p className="text-sm text-purple-600 font-semibold">You are at the highest tier! 🎉</p>
            )}

            <div className="mt-4 space-y-1.5">
              {tierInfo.perks.map((perk) => (
                <p key={perk} className="text-xs text-gray-600 flex items-center gap-2">
                  <span className="text-green-500">✓</span> {perk}
                </p>
              ))}
            </div>
          </div>

          {/* Lifetime Stats */}
          <div className="mx-4 mt-4 grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <p className="text-[10px] text-gray-400 uppercase font-semibold">Lifetime Earned</p>
              <p className="text-lg font-bold text-gray-900 mt-1">{formatINR(wallet?.lifetime_ota_earned_paise || 0)}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <p className="text-[10px] text-gray-400 uppercase font-semibold">Lifetime Used</p>
              <p className="text-lg font-bold text-gray-900 mt-1">{formatINR(wallet?.lifetime_ota_burned_paise || 0)}</p>
            </div>
          </div>

          {/* How to Earn */}
          <div className="mx-4 mt-4 bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-bold text-gray-900 mb-4">How to Earn</h3>
            <div className="space-y-3">
              {earnMethods.map((m) => (
                <div key={m.title} className="flex items-start gap-3">
                  <span className="text-2xl shrink-0">{m.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{m.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{m.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <Link
              href="/rewards/register-stay"
              className="mt-4 w-full flex items-center justify-center gap-2 bg-blue-50 text-blue-700 py-3 rounded-xl font-semibold text-sm hover:bg-blue-100 transition"
            >
              <span>🏷️</span> Register a Walk-in Stay
            </Link>
            <Link
              href="/saved"
              className="mt-3 w-full flex items-center justify-between gap-2 border border-gray-100 bg-white text-gray-700 py-3 px-4 rounded-xl font-semibold text-sm hover:bg-gray-50 transition"
            >
              <div className="flex items-center gap-2">
                <span>❤️</span>
                <span>Saved Hotels</span>
              </div>
              <div className="flex items-center gap-1.5">
                {wishlistCount > 0 && (
                  <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">
                    {wishlistCount}
                  </span>
                )}
                <span className="text-gray-400 text-xs">→</span>
              </div>
            </Link>
          </div>

          {/* Recent Transactions */}
          <div className="mx-4 mt-4 bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Recent Transactions</h3>
              <Link href="/rewards/history" className="text-xs text-blue-600 font-semibold hover:underline">
                View All
              </Link>
            </div>

            {transactions.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-gray-400 text-sm">No transactions yet</p>
                <p className="text-xs text-gray-300 mt-1">Book a hotel to start earning!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.map((tx: any, idx: number) => (
                  <div key={tx.id || idx} className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{tx.description}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {(tx.coinType || tx.coin_type || 'OTA').toUpperCase()} ·{' '}
                        {new Date(tx.createdAt || tx.created_at).toLocaleDateString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                      </p>
                    </div>
                    <p
                      className={`font-bold ml-3 shrink-0 ${
                        (tx.direction || tx.type) === 'credit' ? 'text-green-600' : 'text-red-500'
                      }`}
                    >
                      {(tx.direction || tx.type) === 'credit' ? '+' : '−'}
                      {formatINR(tx.amountPaise || tx.amount_paise)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <Link
              href="/rewards/history"
              className="mt-4 w-full flex items-center justify-center border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition"
            >
              View Full History
            </Link>
          </div>
        </>
      )}

      <BottomNav />
    </div>
  );
}

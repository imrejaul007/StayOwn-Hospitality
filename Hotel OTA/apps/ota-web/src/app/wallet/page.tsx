'use client';

import { useEffect, useState } from 'react';
import BottomNav from '@/components/BottomNav';
import { walletApi, formatINR } from '@/lib/api';

export default function WalletPage() {
  const [wallet, setWallet] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCoin, setFilterCoin] = useState('');

  useEffect(() => {
    Promise.all([walletApi.get(), walletApi.transactions()])
      .then(([w, t]) => { setWallet(w); setTransactions(t.transactions ?? []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-gray-50 pb-20">
      <div className="px-5 pt-12 pb-4">
        <h1 className="text-2xl font-bold text-gray-900">Travel Savings</h1>
      </div>

      {loading ? (
        <p className="text-center text-gray-400 py-10">Loading...</p>
      ) : (
        <>
          {/* Balance Card */}
          <div className="mx-4 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg">
            <div className="flex">
              <div className="flex-1 text-center">
                <p className="text-blue-200 text-xs">OTA Coins</p>
                <p className="text-2xl font-bold mt-1">{formatINR(wallet?.ota_coin_balance_paise || 0)}</p>
              </div>
              <div className="w-px bg-blue-400/30 mx-4" />
              <div className="flex-1 text-center">
                <p className="text-blue-200 text-xs">ReZ Coins</p>
                <p className="text-2xl font-bold mt-1">{formatINR(wallet?.rez_coin_balance_paise || 0)}</p>
              </div>
            </div>
            {wallet?.ota_coin_expiring_soon_paise > 0 && (
              <p className="text-amber-300 text-xs text-center mt-4">
                ⚠ {formatINR(wallet.ota_coin_expiring_soon_paise)} expiring soon
              </p>
            )}
          </div>

          {/* Stats */}
          <div className="mx-4 grid grid-cols-2 gap-3 mt-4">
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <p className="text-[10px] text-gray-400 uppercase font-semibold">Lifetime Earned</p>
              <p className="text-lg font-bold text-gray-900 mt-1">{formatINR(wallet?.lifetime_ota_earned_paise || 0)}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <p className="text-[10px] text-gray-400 uppercase font-semibold">Lifetime Used</p>
              <p className="text-lg font-bold text-gray-900 mt-1">{formatINR(wallet?.lifetime_ota_burned_paise || 0)}</p>
            </div>
          </div>

          {/* Hotel Brand Coins */}
          {(wallet?.hotel_brand_coins ?? []).filter((hc: any) => hc.balancePaise > 0).length > 0 && (
            <div className="mx-4 mt-4">
              <h2 className="font-bold text-gray-900 mb-3">Hotel Loyalty Coins</h2>
              <div className="space-y-2">
                {(wallet.hotel_brand_coins as any[])
                  .filter((hc) => hc.balancePaise > 0)
                  .map((hc: any) => (
                    <div
                      key={hc.hotelId}
                      className="bg-white rounded-2xl border border-purple-100 p-4 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-lg">🏨</div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{hc.hotelName}</p>
                          <p className="text-xs text-purple-600 mt-0.5">{hc.coinName ?? hc.coinSymbol ?? 'Hotel Points'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-base font-bold text-purple-700">{formatINR(hc.balancePaise)}</p>
                        <p className="text-[10px] text-gray-400">available</p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Transactions */}
          <div className="px-5 mt-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-gray-900">Transaction History</h2>
              <select
                value={filterCoin}
                onChange={(e) => setFilterCoin(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600 focus:outline-none"
              >
                <option value="">All coins</option>
                <option value="ota">OTA</option>
                <option value="rez">ReZ</option>
                <option value="hotel_brand">Hotel Brand</option>
              </select>
            </div>
            <div className="space-y-2">
              {transactions.filter((tx) => !filterCoin || tx.coinType === filterCoin).length === 0 ? (
                <p className="text-center text-gray-400 py-6">No transactions yet. Book a hotel to start earning!</p>
              ) : transactions
                  .filter((tx: any) => !filterCoin || tx.coinType === filterCoin)
                  .map((tx: any) => (
                <div key={tx.id} className="bg-white rounded-xl p-3.5 border border-gray-100 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{tx.description}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {(tx.coinType ?? '').toUpperCase() || 'COIN'} · {new Date(tx.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <p className={`font-bold ${tx.direction === 'credit' ? 'text-green-600' : 'text-red-500'}`}>
                    {tx.direction === 'credit' ? '+' : '-'}{formatINR(tx.amountPaise)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <BottomNav />
    </div>
  );
}

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { walletApi, formatINR } from '@/lib/api';

type CoinTab = 'ota' | 'rez';
type FilterChip = 'all' | 'credit' | 'debit' | 'expired';

const filterLabels: Record<FilterChip, string> = {
  all: 'All',
  credit: 'Earned',
  debit: 'Used',
  expired: 'Expired',
};

export default function RewardsHistoryPage() {
  const router = useRouter();
  const [coinTab, setCoinTab] = useState<CoinTab>('ota');
  const [filter, setFilter] = useState<FilterChip>('all');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [wallet, setWallet] = useState<any>(null);

  const loadTransactions = useCallback(
    async (p: number, tab: CoinTab, reset = false) => {
      setLoading(true);
      try {
        const data = await walletApi.transactions(p, tab);
        const items: any[] = data.transactions || [];
        if (reset) {
          setTransactions(items);
        } else {
          setTransactions((prev) => [...prev, ...items]);
        }
        setHasMore(items.length >= 20);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    walletApi.get().then(setWallet).catch(console.error);
  }, []);

  useEffect(() => {
    setPage(1);
    setTransactions([]);
    loadTransactions(1, coinTab, true);
  }, [coinTab, loadTransactions]);

  function loadMore() {
    const next = page + 1;
    setPage(next);
    loadTransactions(next, coinTab, false);
  }

  const filtered = transactions.filter((tx) => {
    if (filter === 'all') return true;
    if (filter === 'credit') return (tx.direction || tx.type) === 'credit';
    if (filter === 'debit') return (tx.direction || tx.type) === 'debit';
    if (filter === 'expired') return tx.expired === true || tx.status === 'expired';
    return true;
  });

  // Compute expiry schedule from transactions
  const expiryItems = transactions
    .filter((tx) => tx.expiresAt && (tx.direction || tx.type) === 'credit' && !tx.expired)
    .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime())
    .slice(0, 5);

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-gray-50 pb-10">
      {/* Top Bar */}
      <div className="bg-white px-5 pt-12 pb-0 border-b border-gray-100 sticky top-0 z-30">
        <div className="flex items-center gap-3 pb-3">
          <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700 text-lg font-medium">
            ←
          </button>
          <h1 className="text-lg font-bold text-gray-900">Coin History</h1>
        </div>

        {/* Coin Tabs */}
        <div className="flex">
          {(['ota', 'rez'] as CoinTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setCoinTab(tab)}
              className={`flex-1 py-3 text-sm font-semibold border-b-2 transition ${
                coinTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {tab === 'ota' ? 'Travel Coins' : 'ReZ Coins'}
            </button>
          ))}
        </div>
      </div>

      {/* Balance Summary */}
      {wallet && (
        <div className="mx-4 mt-4 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl px-5 py-4 text-white">
          <p className="text-blue-200 text-xs">{coinTab === 'ota' ? 'OTA Coin Balance' : 'ReZ Coin Balance'}</p>
          <p className="text-2xl font-bold mt-0.5">
            {formatINR(coinTab === 'ota' ? wallet.ota_coin_balance_paise || 0 : wallet.rez_coin_balance_paise || 0)}
          </p>
        </div>
      )}

      {/* Filter Chips */}
      <div className="px-4 mt-4 flex gap-2 overflow-x-auto pb-1">
        {(Object.keys(filterLabels) as FilterChip[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
              filter === f ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 border border-gray-200'
            }`}
          >
            {filterLabels[f]}
          </button>
        ))}
      </div>

      {/* Transaction List */}
      <div className="px-4 mt-3 space-y-2">
        {loading && transactions.length === 0 ? (
          <div className="space-y-2 mt-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-white rounded-xl p-4 animate-pulse border border-gray-100">
                <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <span className="text-4xl">🪙</span>
            <p className="text-gray-500 font-semibold mt-3">No transactions found</p>
            <p className="text-sm text-gray-400 mt-1">
              {filter === 'all' ? 'Book a hotel to start earning coins' : `No ${filterLabels[filter].toLowerCase()} transactions yet`}
            </p>
          </div>
        ) : (
          filtered.map((tx: any, idx: number) => {
            const isCredit = (tx.direction || tx.type) === 'credit';
            const isExpired = tx.expired === true || tx.status === 'expired';
            return (
              <div key={tx.id || idx} className="bg-white rounded-xl border border-gray-100 p-4 flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                      isExpired ? 'bg-gray-100' : isCredit ? 'bg-green-50' : 'bg-red-50'
                    }`}
                  >
                    <span className="text-sm">{isExpired ? '⏰' : isCredit ? '↓' : '↑'}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{tx.description}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {(tx.coinType || tx.coin_type || coinTab.toUpperCase()).toUpperCase()} ·{' '}
                      {new Date(tx.createdAt || tx.created_at).toLocaleDateString('en-IN', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })}
                    </p>
                    {tx.expiresAt && !isExpired && (
                      <p className="text-[10px] text-amber-500 mt-0.5">
                        Expires{' '}
                        {new Date(tx.expiresAt).toLocaleDateString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric',
                        })}
                      </p>
                    )}
                  </div>
                </div>
                <p
                  className={`font-bold ml-2 shrink-0 ${
                    isExpired ? 'text-gray-400 line-through' : isCredit ? 'text-green-600' : 'text-red-500'
                  }`}
                >
                  {isCredit ? '+' : '−'}
                  {formatINR(tx.amountPaise || tx.amount_paise)}
                </p>
              </div>
            );
          })
        )}

        {/* Load More */}
        {hasMore && filtered.length > 0 && !loading && (
          <button
            onClick={loadMore}
            className="w-full py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition mt-2"
          >
            Load More
          </button>
        )}
        {loading && transactions.length > 0 && (
          <p className="text-center text-gray-400 text-sm py-3">Loading...</p>
        )}
      </div>

      {/* Expiry Schedule */}
      {expiryItems.length > 0 && (
        <div className="mx-4 mt-6 bg-amber-50 rounded-2xl border border-amber-100 p-5">
          <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
            <span>⏰</span> Upcoming Expiry
          </h3>
          <div className="space-y-2">
            {expiryItems.map((tx: any, idx: number) => (
              <div key={idx} className="flex justify-between text-sm">
                <span className="text-gray-600 truncate flex-1 mr-2">{tx.description}</span>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-amber-700">{formatINR(tx.amountPaise || tx.amount_paise)}</p>
                  <p className="text-[10px] text-amber-500">
                    {new Date(tx.expiresAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

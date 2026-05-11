'use client';

import { useEffect, useState } from 'react';
import { coinLiabilityApi, formatINR } from '@/lib/api';

interface LiabilityData {
  total_ota_coin_liability_paise: number;
  total_rez_coin_liability_paise?: number;
  total_hotel_brand_coin_liability_paise?: number;
  total_liability_paise?: number;
  active_users_with_coins?: number;
  avg_balance_paise?: number;
  top_holders?: {
    user_name: string;
    balance_paise: number;
    tier: string;
  }[];
}

export default function CoinLiabilityPage() {
  const [data, setData] = useState<LiabilityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await coinLiabilityApi.get();
      setData(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-400 text-sm">Loading coin liability data...</div>;
  }

  if (error || !data) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 text-sm">{error || 'Failed to load data'}</p>
        <button onClick={load} className="mt-3 text-indigo-600 text-sm hover:underline">Retry</button>
      </div>
    );
  }

  const otaLiability = data.total_ota_coin_liability_paise ?? 0;
  const rezLiability = data.total_rez_coin_liability_paise ?? 0;
  const hotelBrandLiability = data.total_hotel_brand_coin_liability_paise ?? 0;
  const totalLiability = data.total_liability_paise ?? otaLiability + rezLiability + hotelBrandLiability;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Coin Liability</h1>
        <button
          onClick={load}
          className="px-3 py-2 text-sm bg-white border rounded-lg hover:bg-gray-50 text-gray-600"
        >
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Liability</p>
          <p className="text-3xl font-bold text-red-600 mt-2">{formatINR(totalLiability)}</p>
          <p className="text-xs text-gray-400 mt-2">Combined OTA + ReZ coin outstanding</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">OTA Coin Liability</p>
          <p className="text-2xl font-bold text-orange-600 mt-2">{formatINR(otaLiability)}</p>
          <p className="text-xs text-gray-400 mt-2">OTA platform coins outstanding</p>
        </div>

        {rezLiability > 0 && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">ReZ Coin Liability</p>
            <p className="text-2xl font-bold text-blue-600 mt-2">{formatINR(rezLiability)}</p>
            <p className="text-xs text-gray-400 mt-2">ReZ platform coins outstanding</p>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Hotel Brand Coin Liability</p>
          <p className="text-2xl font-bold text-purple-600 mt-2">{formatINR(hotelBrandLiability)}</p>
          <p className="text-xs text-gray-400 mt-2">Hotel loyalty coins across all programs</p>
        </div>

        {data.active_users_with_coins !== undefined && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Users with Coins</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">
              {data.active_users_with_coins.toLocaleString()}
            </p>
          </div>
        )}

        {data.avg_balance_paise !== undefined && (
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Avg Balance / User</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">{formatINR(data.avg_balance_paise)}</p>
          </div>
        )}
      </div>

      {/* Info note */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-sm text-amber-800 font-medium">About Coin Liability</p>
        <p className="text-sm text-amber-700 mt-1">
          Coin liability represents the total coin balance held by users across all programs. OTA and ReZ
          coins are platform-financed (cash cost when burned). Hotel brand coins are hotel-financed —
          each hotel bears its own loyalty program cost. Monitor total liability alongside GMV to
          ensure healthy unit economics.
        </p>
      </div>

      {/* Top Holders */}
      {data.top_holders && data.top_holders.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="px-5 py-4 border-b">
            <h2 className="font-semibold text-gray-800">Top Coin Holders</h2>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-4 py-3 text-left font-medium text-gray-600">#</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">User</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Tier</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Coin Balance</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {data.top_holders.map((h, i) => (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                  <td className="px-4 py-3 font-medium">{h.user_name}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-0.5 rounded-full text-xs capitalize bg-gray-100 text-gray-700">
                      {h.tier}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{formatINR(h.balance_paise)}</td>
                  <td className="px-4 py-3 text-right text-gray-500">
                    {totalLiability > 0 ? ((h.balance_paise / totalLiability) * 100).toFixed(2) : 0}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

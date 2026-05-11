'use client';

import { useEffect, useState } from 'react';
import { settlementApi } from '@/lib/api';
import { formatINR, formatDate } from '@/lib/format';

interface SettlementEntry {
  id: string;
  bookingRef: string;
  checkinDate: string;
  grossAmountPaise: number;
  commissionPaise: number;
  netPayablePaise: number;
  status: string;
  createdAt: string;
}

interface Wallet {
  availableBalancePaise: number;
  pendingBalancePaise: number;
  lifetimeEarnedPaise: number;
  lifetimeSettledPaise: number;
}

export default function SettlementPage() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [entries, setEntries] = useState<SettlementEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    settlementApi.get()
      .then((data) => {
        setWallet(data.wallet);
        setEntries(data.entries);
        setTotal(data.total);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-500">Loading settlement data...</div>;

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-blue-100 text-blue-800',
    paid: 'bg-green-100 text-green-800',
    disputed: 'bg-red-100 text-red-800',
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settlement</h1>

      {wallet && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <p className="text-sm text-gray-500">Available Balance</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{formatINR(wallet.availableBalancePaise)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <p className="text-sm text-gray-500">Pending</p>
            <p className="text-2xl font-bold text-yellow-600 mt-1">{formatINR(wallet.pendingBalancePaise)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <p className="text-sm text-gray-500">Lifetime Earned</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{formatINR(wallet.lifetimeEarnedPaise)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <p className="text-sm text-gray-500">Lifetime Settled</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{formatINR(wallet.lifetimeSettledPaise)}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="font-semibold text-gray-800">Settlement Entries ({total})</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left font-medium text-gray-600">Booking</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Check-in</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Gross</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Commission</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Net Payable</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs">{e.bookingRef}</td>
                <td className="px-4 py-3">{formatDate(e.checkinDate)}</td>
                <td className="px-4 py-3 text-right">{formatINR(e.grossAmountPaise)}</td>
                <td className="px-4 py-3 text-right text-red-600">-{formatINR(e.commissionPaise)}</td>
                <td className="px-4 py-3 text-right font-medium">{formatINR(e.netPayablePaise)}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[e.status] || 'bg-gray-100'}`}>
                    {e.status}
                  </span>
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">No settlement entries yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

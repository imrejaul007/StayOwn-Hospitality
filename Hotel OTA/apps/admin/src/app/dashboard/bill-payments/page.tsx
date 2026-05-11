'use client';

import { useEffect, useState } from 'react';
import { billPaymentsApi } from '@/lib/api';

interface BillPayment {
  id: string;
  payment_ref: string;
  date: string;
  stay_date: string | null;
  hotel: { id: string; name: string; city: string };
  user: { id: string; name: string; phone: string | null };
  bill_amount_paise: number;
  amount_paid_paise: number;
  ota_coin_burned_paise: number;
  rez_coin_burned_paise: number;
  ota_coin_earned_paise: number;
  rez_coin_earned_paise: number;
  transaction_fee_paise: number;
  status: string;
}

function formatINR(paise: number): string {
  return '₹' + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const statusStyle: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

export default function BillPaymentsPage() {
  const [payments, setPayments] = useState<BillPayment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await billPaymentsApi.list(page);
      setPayments(data.payments ?? []);
      setTotal(data.pagination?.total ?? 0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bill Payments</h1>
          <p className="text-sm text-gray-500 mt-0.5">Hotel QR bill payments from OTA users</p>
        </div>
        <span className="text-sm text-gray-500">{total} total</span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">User</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Hotel</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Bill Amount</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Amount Paid</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Coins Earned</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Fee Earned</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                      No bill payments found.
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        <div>{formatDate(p.date)}</div>
                        {p.stay_date && (
                          <div className="text-xs text-gray-400">Stay: {formatDate(p.stay_date)}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{p.user.name || 'Guest'}</div>
                        <div className="text-xs text-gray-400 font-mono">{p.user.phone}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{p.hotel.name}</div>
                        <div className="text-xs text-gray-400">{p.hotel.city}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-800">
                        {formatINR(p.bill_amount_paise)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {formatINR(p.amount_paid_paise)}
                        {(p.ota_coin_burned_paise > 0 || p.rez_coin_burned_paise > 0) && (
                          <div className="text-xs text-amber-600">
                            {p.ota_coin_burned_paise > 0 && `OTA −${formatINR(p.ota_coin_burned_paise)}`}
                            {p.rez_coin_burned_paise > 0 && ` ReZ −${formatINR(p.rez_coin_burned_paise)}`}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-green-700 font-medium">
                        {(p.ota_coin_earned_paise > 0 || p.rez_coin_earned_paise > 0) ? (
                          <>
                            {p.ota_coin_earned_paise > 0 && (
                              <div className="text-xs">OTA +{formatINR(p.ota_coin_earned_paise)}</div>
                            )}
                            {p.rez_coin_earned_paise > 0 && (
                              <div className="text-xs">ReZ +{formatINR(p.rez_coin_earned_paise)}</div>
                            )}
                          </>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-indigo-700 font-medium">
                        {p.transaction_fee_paise > 0 ? formatINR(p.transaction_fee_paise) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${statusStyle[p.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-sm text-gray-500">
                Page {page} of {totalPages} ({total} records)
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

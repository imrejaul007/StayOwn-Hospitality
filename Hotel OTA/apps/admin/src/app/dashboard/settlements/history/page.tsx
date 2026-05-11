'use client';

import { useEffect, useState } from 'react';
import { settlementsApi, formatINR } from '@/lib/api';

interface Settlement {
  id: string;
  batchRef: string;
  hotel_name: string;
  amount_paise: number;
  commission_paise: number;
  net_paise: number;
  status: string;
  paid_at: string;
  utr_number?: string;
}

export default function SettlementHistoryPage() {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    load();
  }, [page]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await settlementsApi.history(page);
      setSettlements(data.settlements ?? data.batches ?? []);
      setTotal(data.total ?? 0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const pageCount = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Settlement History ({total.toLocaleString()})</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading settlement history...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-4 py-3 text-left font-medium text-gray-600">Batch Ref</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Hotel</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Gross Amount</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Commission</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Net Paid</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">UTR</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Paid At</th>
              </tr>
            </thead>
            <tbody>
              {settlements.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                    No settlement history
                  </td>
                </tr>
              ) : (
                settlements.map((s) => (
                  <tr key={s.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{s.batchRef}</td>
                    <td className="px-4 py-3 text-gray-700">{s.hotel_name ?? '—'}</td>
                    <td className="px-4 py-3 text-right">{formatINR(s.amount_paise ?? 0)}</td>
                    <td className="px-4 py-3 text-right text-red-600">
                      -{formatINR(s.commission_paise ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-green-700">
                      {formatINR(s.net_paise ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 capitalize">
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{s.utr_number ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {s.paid_at ? new Date(s.paid_at).toLocaleString('en-IN') : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {pageCount > 1 && (
            <div className="px-4 py-3 border-t flex items-center justify-between bg-gray-50">
              <p className="text-xs text-gray-500">
                Page {page} of {pageCount}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border rounded text-xs hover:bg-gray-100 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  disabled={page === pageCount}
                  className="px-3 py-1 border rounded text-xs hover:bg-gray-100 disabled:opacity-40"
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

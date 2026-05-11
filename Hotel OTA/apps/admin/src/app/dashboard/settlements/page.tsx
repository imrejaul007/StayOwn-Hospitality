'use client';

import { useEffect, useState } from 'react';
import { settlementsApi, formatINR } from '@/lib/api';

interface Batch {
  id: string;
  batchRef: string;
  totalHotels: number;
  totalAmountPaise: number;
  status: string;
  initiatedAt: string;
}

export default function SettlementsPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await settlementsApi.list(1, 'pending');
      setBatches(data.batches ?? []);
      setTotal(data.total ?? 0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(batchId: string) {
    if (!window.confirm('Approve this settlement batch? This will initiate payouts to hotels.')) return;
    setApproving(batchId);
    try {
      await settlementsApi.approveBatch(batchId);
      load();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setApproving(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Pending Settlements ({total})
        </h1>
        <button
          onClick={load}
          className="px-3 py-2 text-sm bg-white border rounded-lg hover:bg-gray-50 text-gray-600"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading settlements...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-4 py-3 text-left font-medium text-gray-600">Batch Ref</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Hotels</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Total Amount</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Initiated At</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{b.batchRef}</td>
                  <td className="px-4 py-3 text-center">{b.totalHotels}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatINR(b.totalAmountPaise)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 capitalize">
                      {b.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(b.initiatedAt).toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => handleApprove(b.id)}
                      disabled={approving === b.id}
                      className="px-3 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 disabled:opacity-50"
                    >
                      {approving === b.id ? 'Approving...' : 'Approve'}
                    </button>
                  </td>
                </tr>
              ))}
              {batches.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                    No pending settlement batches
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

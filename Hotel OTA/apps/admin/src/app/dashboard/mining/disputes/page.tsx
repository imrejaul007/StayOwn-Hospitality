'use client';

import { useEffect, useState } from 'react';
import { miningApi, formatINR } from '@/lib/api';

interface Dispute {
  id: string;
  user_name: string;
  user_id: string;
  hotel_name: string;
  period: string;
  original_score: number;
  original_coins_paise: number;
  dispute_reason: string;
  filed_at: string;
  status: 'open' | 'resolved' | 'rejected';
  resolution_note?: string;
  adjusted_score?: number;
  adjusted_coins_paise?: number;
}

const statusStyle: Record<string, string> = {
  open: 'bg-yellow-100 text-yellow-800',
  resolved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

export default function MiningDisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Dispute | null>(null);
  const [resolution, setResolution] = useState({
    action: 'resolve',
    adjusted_score: '',
    adjusted_coins_paise: '',
    note: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await miningApi.disputes();
      setDisputes(data.disputes ?? []);
      setTotal(data.total ?? 0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function openReview(dispute: Dispute) {
    setSelected(dispute);
    setResolution({
      action: 'resolve',
      adjusted_score: String(dispute.original_score),
      adjusted_coins_paise: String(dispute.original_coins_paise),
      note: '',
    });
    setError('');
  }

  async function handleResolve() {
    if (!selected) return;
    setSaving(true);
    setError('');
    try {
      await miningApi.resolveDispute(selected.id, {
        action: resolution.action,
        adjusted_score: resolution.adjusted_score ? parseFloat(resolution.adjusted_score) : undefined,
        adjusted_coins_paise: resolution.adjusted_coins_paise ? parseInt(resolution.adjusted_coins_paise) : undefined,
        note: resolution.note,
      });
      setSelected(null);
      load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Mining Disputes ({total})</h1>
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

      {/* Resolution Panel */}
      {selected && (
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Reviewing Dispute</h2>
            <button
              onClick={() => setSelected(null)}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
            <div>
              <p className="text-gray-500">User</p>
              <p className="font-medium">{selected.user_name}</p>
            </div>
            <div>
              <p className="text-gray-500">Hotel</p>
              <p className="font-medium">{selected.hotel_name}</p>
            </div>
            <div>
              <p className="text-gray-500">Period</p>
              <p className="font-medium">{selected.period}</p>
            </div>
            <div>
              <p className="text-gray-500">Original Score</p>
              <p className="font-medium font-mono">{selected.original_score.toFixed(4)}</p>
            </div>
            <div>
              <p className="text-gray-500">Original Coins</p>
              <p className="font-medium">{formatINR(selected.original_coins_paise)}</p>
            </div>
            <div>
              <p className="text-gray-500">Filed</p>
              <p className="font-medium">{new Date(selected.filed_at).toLocaleDateString('en-IN')}</p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
            <p className="text-sm font-medium text-amber-800">Dispute Reason</p>
            <p className="text-sm text-amber-700 mt-1">{selected.dispute_reason}</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
              <select
                value={resolution.action}
                onChange={(e) => setResolution({ ...resolution, action: e.target.value })}
                className="px-3 py-2 border rounded-lg text-sm w-48 focus:ring-2 focus:ring-indigo-400 outline-none"
              >
                <option value="resolve">Resolve (adjust score)</option>
                <option value="reject">Reject dispute</option>
              </select>
            </div>

            {resolution.action === 'resolve' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Adjusted Score
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={resolution.adjusted_score}
                    onChange={(e) => setResolution({ ...resolution, adjusted_score: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Adjusted Coins (paise)
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={resolution.adjusted_coins_paise}
                    onChange={(e) => setResolution({ ...resolution, adjusted_coins_paise: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Resolution Note</label>
              <textarea
                value={resolution.note}
                onChange={(e) => setResolution({ ...resolution, note: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none resize-none"
                placeholder="Explain the resolution..."
                required
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleResolve}
                disabled={saving || !resolution.note.trim()}
                className={`px-5 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-50 ${
                  resolution.action === 'reject'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {saving ? 'Submitting...' : resolution.action === 'reject' ? 'Reject Dispute' : 'Resolve Dispute'}
              </button>
              <button
                onClick={() => setSelected(null)}
                className="px-5 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading disputes...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-4 py-3 text-left font-medium text-gray-600">User</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Hotel</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Period</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Orig. Score</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Orig. Coins</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Reason</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {disputes.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                    No disputes filed
                  </td>
                </tr>
              ) : (
                disputes.map((d) => (
                  <tr key={d.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{d.user_name}</td>
                    <td className="px-4 py-3 text-gray-600">{d.hotel_name}</td>
                    <td className="px-4 py-3 text-center font-mono text-xs">{d.period}</td>
                    <td className="px-4 py-3 text-center font-mono text-xs">
                      {d.original_score.toFixed(4)}
                    </td>
                    <td className="px-4 py-3 text-right">{formatINR(d.original_coins_paise)}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs">
                      <p className="truncate text-xs">{d.dispute_reason}</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          statusStyle[d.status]
                        }`}
                      >
                        {d.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {d.status === 'open' && (
                        <button
                          onClick={() => openReview(d)}
                          className="text-xs text-indigo-600 hover:underline font-medium"
                        >
                          Review
                        </button>
                      )}
                      {d.status !== 'open' && d.resolution_note && (
                        <span className="text-xs text-gray-400 italic">
                          {d.status === 'resolved' ? 'Resolved' : 'Rejected'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

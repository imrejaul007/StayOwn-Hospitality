'use client';

import { useEffect, useState } from 'react';
import { stayRegistrationsApi } from '@/lib/api';

interface Registration {
  id: string;
  user_name: string;
  user_phone: string;
  hotel_name: string;
  stay_date: string;
  receipt_image_url: string;
  status: 'pending' | 'approved' | 'rejected';
  coins_awarded_paise?: number;
  rejection_reason?: string;
  created_at: string;
}

const statusStyle: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

export default function StayRegistrationsPage() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    load();
  }, [statusFilter]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await stayRegistrationsApi.list(1, statusFilter);
      setRegistrations(data.registrations ?? []);
      setTotal(data.total ?? 0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(r: Registration) {
    const input = window.prompt(
      `Approve stay registration for ${r.user_name} at ${r.hotel_name}\nCoins to award (in paise, e.g. 10000 = ₹100):`
    );
    if (input === null) return;
    const coins = parseInt(input);
    if (isNaN(coins) || coins < 0) return alert('Invalid amount');

    setActionLoading(r.id);
    try {
      await stayRegistrationsApi.approve(r.id, coins);
      load();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(r: Registration) {
    const reason = window.prompt(`Rejection reason for ${r.user_name}:`);
    if (reason === null) return;

    setActionLoading(r.id);
    try {
      await stayRegistrationsApi.reject(r.id, reason);
      load();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Stay Registrations ({total.toLocaleString()})
        </h1>
        <div className="flex gap-2">
          {['pending', 'approved', 'rejected'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize ${
                statusFilter === s
                  ? 'bg-gray-900 text-white'
                  : 'bg-white border text-gray-600 hover:bg-gray-50'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading registrations...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-4 py-3 text-left font-medium text-gray-600">User</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Hotel</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Stay Date</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Receipt</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Status</th>
                {statusFilter === 'approved' && (
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Coins Awarded</th>
                )}
                {statusFilter === 'rejected' && (
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Rejection Reason</th>
                )}
                {statusFilter === 'pending' && (
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {registrations.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-gray-400"
                  >
                    No {statusFilter} registrations
                  </td>
                </tr>
              ) : (
                registrations.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium">{r.user_name}</p>
                      <p className="text-xs text-gray-400">{r.user_phone}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{r.hotel_name}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(r.stay_date).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <a
                        href={r.receipt_image_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        View Receipt
                      </a>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                          statusStyle[r.status]
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    {statusFilter === 'approved' && (
                      <td className="px-4 py-3 text-right font-medium text-green-700">
                        {r.coins_awarded_paise !== undefined
                          ? `+₹${(r.coins_awarded_paise / 100).toLocaleString('en-IN')}`
                          : '—'}
                      </td>
                    )}
                    {statusFilter === 'rejected' && (
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {r.rejection_reason ?? '—'}
                      </td>
                    )}
                    {statusFilter === 'pending' && (
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleApprove(r)}
                            disabled={actionLoading === r.id}
                            className="px-3 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 disabled:opacity-40"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(r)}
                            disabled={actionLoading === r.id}
                            className="px-3 py-1 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 disabled:opacity-40"
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    )}
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

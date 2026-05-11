'use client';

import { useEffect, useState } from 'react';
import { hotelsApi } from '@/lib/api';

interface Hotel {
  id: string;
  name: string;
  city: string;
  category: string;
  owner_name: string;
  suspended_at: string;
  suspension_reason: string;
  onboardingStatus: string;
}

export default function SuspendedHotelsPage() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await hotelsApi.list(1, 'suspended');
      setHotels(data.hotels ?? []);
      setTotal(data.total ?? 0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleReactivate(hotel: Hotel) {
    if (!window.confirm(`Reactivate "${hotel.name}"?`)) return;
    setActionLoading(hotel.id);
    try {
      await hotelsApi.updateStatus(hotel.id, 'active');
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
        <h1 className="text-2xl font-bold text-gray-900">Suspended Hotels ({total})</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">City</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Owner</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Suspension Reason</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Suspended At</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {hotels.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                    No suspended hotels
                  </td>
                </tr>
              ) : (
                hotels.map((h) => (
                  <tr key={h.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{h.name}</td>
                    <td className="px-4 py-3 text-gray-600">{h.city}</td>
                    <td className="px-4 py-3 text-gray-600">{h.owner_name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs">
                      <p className="truncate text-xs">{h.suspension_reason ?? 'No reason given'}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {h.suspended_at ? new Date(h.suspended_at).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleReactivate(h)}
                        disabled={actionLoading === h.id}
                        className="text-xs text-green-600 hover:underline font-medium disabled:opacity-40"
                      >
                        Reactivate
                      </button>
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

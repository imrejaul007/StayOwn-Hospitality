'use client';

import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/v1';

async function apiFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (res.status === 401) {
    if (typeof window !== 'undefined') window.location.href = '/';
    throw new Error('Session expired. Please log in again.');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `API error ${res.status}`);
  return data;
}

interface Registration {
  id: string;
  user_name: string;
  hotel_name: string;
  stay_date: string;
  receipt_image_url: string;
  created_at: string;
}

export default function StayReviewsPage() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setLoadError('');
    try {
      const data = await apiFetch('/admin/stay-registrations/pending');
      setRegistrations(data.registrations || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      setLoadError(err.message || 'Failed to load registrations');
    } finally { setLoading(false); }
  }

  async function handleApprove(id: string) {
    const coins = prompt('Coins to award (in paise, e.g. 10000 for ₹100):');
    if (coins === null) return;
    await apiFetch(`/admin/stay-registrations/${id}/approve`, {
      method: 'PUT',
      body: JSON.stringify({ coins_to_award_paise: parseInt(coins) || 0 }),
    });
    load();
  }

  async function handleReject(id: string) {
    const reason = prompt('Rejection reason:');
    if (reason === null) return;
    await apiFetch(`/admin/stay-registrations/${id}/reject`, {
      method: 'PUT',
      body: JSON.stringify({ reason }),
    });
    load();
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Stay Registration Reviews ({total})</h1>

      {loadError && <p className="text-sm text-red-600 mb-4">{loadError}</p>}
      {loading ? <p>Loading...</p> : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-4 py-3 text-left font-medium text-gray-600">User</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Hotel</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Stay Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Receipt</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {registrations.map((r) => (
                <tr key={r.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">{r.user_name}</td>
                  <td className="px-4 py-3">{r.hotel_name}</td>
                  <td className="px-4 py-3">{new Date(r.stay_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <a href={r.receipt_image_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">View Receipt</a>
                  </td>
                  <td className="px-4 py-3 text-center space-x-2">
                    <button onClick={() => handleApprove(r.id)}
                      className="px-3 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700">
                      Approve
                    </button>
                    <button onClick={() => handleReject(r.id)}
                      className="px-3 py-1 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700">
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
              {registrations.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No pending reviews</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

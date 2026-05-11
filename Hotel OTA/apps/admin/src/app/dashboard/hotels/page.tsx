'use client';

import { useEffect, useState } from 'react';
import { hotelsApi } from '@/lib/api';

interface Hotel {
  id: string;
  name: string;
  city: string;
  category: string;
  onboardingStatus: string;
  miningEligible: boolean;
}

export default function HotelsPage() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadHotels(); }, []);

  async function loadHotels() {
    setLoading(true);
    try {
      const data = await hotelsApi.list();
      setHotels(data.hotels);
      setTotal(data.total);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function updateStatus(id: string, status: string) {
    await hotelsApi.updateStatus(id, status);
    loadHotels();
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    active: 'bg-green-100 text-green-800',
    suspended: 'bg-red-100 text-red-800',
    churned: 'bg-gray-100 text-gray-800',
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Hotels ({total})</h1>
      {loading ? <p>Loading...</p> : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">City</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Category</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {hotels.map((h) => (
                <tr key={h.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{h.name}</td>
                  <td className="px-4 py-3">{h.city}</td>
                  <td className="px-4 py-3 capitalize">{h.category}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[h.onboardingStatus]}`}>
                      {h.onboardingStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center space-x-2">
                    {h.onboardingStatus === 'pending' && (
                      <button onClick={() => updateStatus(h.id, 'active')} className="text-xs text-green-600 hover:underline font-medium">Activate</button>
                    )}
                    {h.onboardingStatus === 'active' && (
                      <button onClick={() => updateStatus(h.id, 'suspended')} className="text-xs text-red-600 hover:underline font-medium">Suspend</button>
                    )}
                    {h.onboardingStatus === 'suspended' && (
                      <button onClick={() => updateStatus(h.id, 'active')} className="text-xs text-green-600 hover:underline font-medium">Reactivate</button>
                    )}
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

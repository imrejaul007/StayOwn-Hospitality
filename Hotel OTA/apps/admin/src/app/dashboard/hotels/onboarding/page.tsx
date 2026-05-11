'use client';

import { useEffect, useState } from 'react';
import { hotelsApi } from '@/lib/api';

interface OnboardingHotel {
  id: string;
  name: string;
  city: string;
  category: string;
  owner_name: string;
  owner_email: string;
  owner_phone: string;
  submitted_at: string;
  checklist: {
    gst_uploaded: boolean;
    pan_verified: boolean;
    bank_details_added: boolean;
    photos_uploaded: boolean;
    room_inventory_set: boolean;
    pricing_set: boolean;
  };
}

const checklistLabels: Record<string, string> = {
  gst_uploaded: 'GST Certificate Uploaded',
  pan_verified: 'PAN Verified',
  bank_details_added: 'Bank Details Added',
  photos_uploaded: 'Hotel Photos Uploaded',
  room_inventory_set: 'Room Inventory Set',
  pricing_set: 'Pricing Configured',
};

export default function HotelOnboardingPage() {
  const [hotels, setHotels] = useState<OnboardingHotel[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<OnboardingHotel | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await hotelsApi.onboarding();
      setHotels(data.hotels ?? []);
      setTotal(data.total ?? 0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(hotel: OnboardingHotel) {
    if (!window.confirm(`Approve onboarding for "${hotel.name}"? This will activate the hotel.`)) return;
    setActionLoading(true);
    try {
      await hotelsApi.approveOnboarding(hotel.id);
      setSelected(null);
      load();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject(hotel: OnboardingHotel) {
    const reason = window.prompt(`Rejection reason for "${hotel.name}":`);
    if (reason === null) return;
    setActionLoading(true);
    try {
      await hotelsApi.rejectOnboarding(hotel.id, reason);
      setSelected(null);
      load();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  function checklistComplete(checklist: OnboardingHotel['checklist']) {
    return Object.values(checklist).every(Boolean);
  }

  function checklistScore(checklist: OnboardingHotel['checklist']) {
    const vals = Object.values(checklist);
    return `${vals.filter(Boolean).length}/${vals.length}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Hotel Onboarding Queue ({total})
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
        <div className="text-center py-12 text-gray-400 text-sm">Loading onboarding queue...</div>
      ) : hotels.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border">
          <p className="text-gray-400 text-sm">No hotels pending onboarding review</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {hotels.map((hotel) => {
            const complete = checklistComplete(hotel.checklist);
            return (
              <div
                key={hotel.id}
                className="bg-white rounded-xl shadow-sm border p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-gray-900 text-base">{hotel.name}</h3>
                      <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600 capitalize">
                        {hotel.category}
                      </span>
                      <span className="px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700">
                        {hotel.city}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      Owner: {hotel.owner_name} &middot; {hotel.owner_phone} &middot; {hotel.owner_email}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Submitted: {new Date(hotel.submitted_at).toLocaleString('en-IN')}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-full ${
                        complete
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {checklistScore(hotel.checklist)} complete
                    </span>
                    <button
                      onClick={() => setSelected(selected?.id === hotel.id ? null : hotel)}
                      className="text-xs text-indigo-600 hover:underline font-medium"
                    >
                      {selected?.id === hotel.id ? 'Hide' : 'Review'}
                    </button>
                  </div>
                </div>

                {selected?.id === hotel.id && (
                  <div className="mt-4 border-t pt-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Onboarding Checklist</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-5">
                      {Object.entries(hotel.checklist).map(([key, val]) => (
                        <div
                          key={key}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                            val ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'
                          }`}
                        >
                          <span className="text-base">{val ? '✓' : '✗'}</span>
                          <span>{checklistLabels[key] ?? key}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => handleApprove(hotel)}
                        disabled={actionLoading || !complete}
                        title={!complete ? 'All checklist items must be complete before approval' : ''}
                        className="px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {actionLoading ? 'Processing...' : 'Approve & Activate'}
                      </button>
                      <button
                        onClick={() => handleReject(hotel)}
                        disabled={actionLoading}
                        className="px-5 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                      >
                        Reject
                      </button>
                      {!complete && (
                        <p className="text-xs text-amber-600 self-center">
                          Complete all checklist items to enable approval
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

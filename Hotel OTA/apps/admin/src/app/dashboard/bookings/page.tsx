'use client';

import { useEffect, useState } from 'react';
import { bookingsApi, formatINR } from '@/lib/api';

interface Booking {
  booking_id: string;
  booking_ref: string;
  hotel_name: string;
  guest_name: string;
  status: string;
  channel_source: string;
  total_value_paise: number;
  checkin_date: string;
  created_at: string;
}

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [filter]);

  async function load() {
    setLoading(true);
    try {
      const data = await bookingsApi.list(1, filter);
      setBookings(data.bookings);
      setTotal(data.total);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">All Bookings ({total})</h1>
        <div className="flex gap-2">
          {['', 'confirmed', 'checked_in', 'stayed', 'cancelled'].map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filter === s ? 'bg-gray-900 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>
      {loading ? <p>Loading...</p> : (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-4 py-3 text-left font-medium text-gray-600">Ref</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Hotel</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Guest</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Channel</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Value</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.booking_id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{b.booking_ref}</td>
                  <td className="px-4 py-3">{b.hotel_name}</td>
                  <td className="px-4 py-3">{b.guest_name}</td>
                  <td className="px-4 py-3 text-center text-xs">{b.channel_source}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatINR(b.total_value_paise)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100">{b.status}</span>
                  </td>
                </tr>
              ))}
              {bookings.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No bookings</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

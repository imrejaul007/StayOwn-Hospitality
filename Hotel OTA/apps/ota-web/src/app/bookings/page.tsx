'use client';

import { useEffect, useState } from 'react';
import BottomNav from '@/components/BottomNav';
import { bookingsApi, formatINR, formatDate } from '@/lib/api';

interface Booking {
  bookingId: string;
  bookingRef: string;
  status: string;
  hotelName: string;
  city: string;
  checkinDate: string;
  checkoutDate: string;
  totalValuePaise: number;
}

const statusStyle: Record<string, string> = {
  hold: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-blue-100 text-blue-700',
  checked_in: 'bg-green-100 text-green-700',
  stayed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-700',
};

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filter, setFilter] = useState('upcoming');
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [filter]);

  async function load() {
    setLoading(true);
    try {
      const data = await bookingsApi.list(filter);
      setBookings(data.bookings ?? []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-gray-50 pb-20">
      <div className="px-5 pt-12 pb-4">
        <h1 className="text-2xl font-bold text-gray-900">My Bookings</h1>
      </div>

      <div className="px-5 flex gap-2 mb-4">
        {['upcoming', 'past', 'cancelled'].map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-xs font-semibold transition ${
              filter === f ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="px-4 space-y-3">
        {loading ? (
          <p className="text-center text-gray-400 py-10">Loading...</p>
        ) : bookings.length === 0 ? (
          <p className="text-center text-gray-400 py-10">No bookings found</p>
        ) : bookings.map((b) => (
          <div key={b.bookingId} className="bg-white rounded-2xl p-4 border border-gray-100">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-gray-900">{b.hotelName}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{b.city}</p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${statusStyle[b.status] || 'bg-gray-100 text-gray-600'}`}>
                {b.status.replace('_', ' ').toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between items-end mt-3">
              <div>
                <p className="text-xs text-gray-500">{formatDate(b.checkinDate)} → {formatDate(b.checkoutDate)}</p>
                <p className="text-[10px] text-gray-300 font-mono mt-0.5">{b.bookingRef}</p>
              </div>
              <p className="text-lg font-bold text-gray-900">{formatINR(b.totalValuePaise)}</p>
            </div>
          </div>
        ))}
      </div>

      <BottomNav />
    </div>
  );
}

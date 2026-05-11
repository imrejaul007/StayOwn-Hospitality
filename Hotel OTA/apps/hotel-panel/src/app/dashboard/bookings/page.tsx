'use client';

import { useEffect, useState } from 'react';
import { bookingsApi } from '@/lib/api';
import { formatINR, formatDate } from '@/lib/format';

interface Booking {
  booking_id: string;
  booking_ref: string;
  guest_name: string;
  guest_phone: string;
  status: string;
  checkin_date: string;
  checkout_date: string;
  num_rooms: number;
  total_value_paise: number;
}

const statusColors: Record<string, string> = {
  hold: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  checked_in: 'bg-green-100 text-green-800',
  stayed: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
  no_show: 'bg-red-100 text-red-800',
};

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBookings();
  }, [filter]);

  async function loadBookings() {
    setLoading(true);
    try {
      const params = filter ? `status=${filter}` : '';
      const data = await bookingsApi.list(params);
      setBookings(data.bookings);
      setTotal(data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckin(bookingId: string) {
    try {
      await bookingsApi.checkin(bookingId);
      loadBookings();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleCheckout(bookingId: string) {
    try {
      await bookingsApi.checkout(bookingId);
      loadBookings();
    } catch (err: any) {
      alert(err.message);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Bookings ({total})</h1>
        <div className="flex gap-2">
          {['', 'confirmed', 'checked_in', 'stayed', 'cancelled'].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filter === s ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-gray-500">Loading bookings...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left font-medium text-gray-600">Ref</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Guest</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Dates</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Rooms</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Amount</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.booking_id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{b.booking_ref}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{b.guest_name}</div>
                    <div className="text-gray-500 text-xs">{b.guest_phone}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {formatDate(b.checkin_date)} — {formatDate(b.checkout_date)}
                  </td>
                  <td className="px-4 py-3 text-center">{b.num_rooms}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatINR(b.total_value_paise)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[b.status] || 'bg-gray-100'}`}>
                      {b.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center space-x-2">
                    {b.status === 'confirmed' && (
                      <button
                        onClick={() => handleCheckin(b.booking_id)}
                        className="px-3 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700"
                      >
                        Check In
                      </button>
                    )}
                    {b.status === 'checked_in' && (
                      <button
                        onClick={() => handleCheckout(b.booking_id)}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700"
                      >
                        Check Out
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {bookings.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">No bookings found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

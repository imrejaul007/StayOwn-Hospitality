'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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
  roomTypeName: string;
  totalValuePaise: number;
}

const statusStyle: Record<string, string> = {
  hold: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-blue-100 text-blue-700',
  checked_in: 'bg-green-100 text-green-700',
  stayed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-700',
};

const tabs = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const emptyMessages: Record<string, { icon: string; title: string; subtitle: string }> = {
  upcoming: {
    icon: '🏨',
    title: 'No upcoming trips',
    subtitle: 'Book a hotel and your trips will appear here',
  },
  completed: {
    icon: '✅',
    title: 'No completed trips',
    subtitle: 'Trips you have checked out from will appear here',
  },
  cancelled: {
    icon: '🚫',
    title: 'No cancelled trips',
    subtitle: 'You have no cancelled bookings',
  },
};

export default function TripsPage() {
  const [activeTab, setActiveTab] = useState('upcoming');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load(activeTab);
  }, [activeTab]);

  async function load(tab: string) {
    setLoading(true);
    try {
      const data = await bookingsApi.list(tab);
      setBookings(data.bookings || []);
    } catch (err) {
      console.error(err);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }

  const empty = emptyMessages[activeTab];

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white px-5 pt-12 pb-0 border-b border-gray-100 sticky top-0 z-30">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">My Trips</h1>
        <div className="flex gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-3 text-sm font-semibold border-b-2 transition ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {loading ? (
          <div className="space-y-3 mt-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-4 animate-pulse border border-gray-100">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-1/2 mb-4" />
                <div className="h-3 bg-gray-200 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <span className="text-5xl mb-4">{empty.icon}</span>
            <h3 className="text-lg font-semibold text-gray-700">{empty.title}</h3>
            <p className="text-sm text-gray-400 mt-1">{empty.subtitle}</p>
            {activeTab === 'upcoming' && (
              <Link
                href="/search"
                className="mt-6 inline-block bg-blue-600 text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-700 transition"
              >
                Search Hotels
              </Link>
            )}
          </div>
        ) : (
          bookings.map((b) => (
            <Link
              key={b.bookingId}
              href={`/trips/${b.bookingId}`}
              className="block bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-sm transition"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0 pr-3">
                  <h3 className="font-bold text-gray-900 truncate">{b.hotelName}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{b.city}</p>
                  {b.roomTypeName && (
                    <p className="text-xs text-gray-500 mt-1">{b.roomTypeName}</p>
                  )}
                </div>
                <span
                  className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-semibold ${
                    statusStyle[b.status] || 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {b.status.replace(/_/g, ' ').toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between items-end mt-3 pt-3 border-t border-gray-50">
                <div>
                  <p className="text-xs text-gray-500">
                    {formatDate(b.checkinDate)} → {formatDate(b.checkoutDate)}
                  </p>
                  <p className="text-[10px] text-gray-300 font-mono mt-0.5">{b.bookingRef}</p>
                </div>
                <p className="text-base font-bold text-gray-900">{formatINR(b.totalValuePaise)}</p>
              </div>
            </Link>
          ))
        )}
      </div>

      <BottomNav />
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { dashboardApi, bookingsApi } from '@/lib/api';
import { formatINR } from '@/lib/format';
import Link from 'next/link';

interface DashboardData {
  hotel_id: string;
  period: string;
  total_bookings: number;
  total_revenue_paise: number;
  avg_occupancy_pct: number | null;
  avg_rating: number | null;
  pending_settlement_paise: number;
}

interface BookingRow {
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

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [checkins, setCheckins] = useState<BookingRow[]>([]);
  const [checkouts, setCheckouts] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      dashboardApi.get(),
      dashboardApi.todayCheckins().catch(() => ({ bookings: [] })),
      dashboardApi.todayCheckouts().catch(() => ({ bookings: [] })),
    ])
      .then(([d, ci, co]) => {
        setData(d);
        setCheckins(ci.bookings || []);
        setCheckouts(co.bookings || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-400 py-20 text-center">Loading dashboard...</div>;
  if (!data) return <div className="text-red-500 py-20 text-center">Failed to load dashboard</div>;

  const kpis = [
    { label: 'Total Bookings', value: data.total_bookings.toString(), sub: 'this month', color: 'bg-blue-500' },
    { label: 'Occupancy', value: data.avg_occupancy_pct ? `${data.avg_occupancy_pct}%` : 'N/A', sub: 'average', color: 'bg-purple-500' },
    { label: 'Revenue', value: formatINR(data.total_revenue_paise), sub: 'this month', color: 'bg-green-500' },
    { label: 'Avg Rating', value: data.avg_rating ? `${data.avg_rating}⭐` : 'N/A', sub: '', color: 'bg-amber-500' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard — {data.period}</h1>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <div className={`w-9 h-9 ${kpi.color} rounded-lg flex items-center justify-center mb-3`}>
              <span className="text-white text-sm font-bold">{kpi.label[0]}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{kpi.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Today's Check-ins */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Upcoming Check-ins Today</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {checkins.length === 0 ? (
              <p className="px-5 py-6 text-sm text-gray-400 text-center">No check-ins today</p>
            ) : checkins.map((b) => (
              <div key={b.booking_id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{b.guest_name}</p>
                  <p className="text-xs text-gray-400">{b.booking_ref} · {b.num_rooms} room(s)</p>
                </div>
                <button
                  onClick={() => bookingsApi.checkin(b.booking_id).then(() => window.location.reload())}
                  className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition"
                >
                  Check In
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Today's Check-outs */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Upcoming Check-outs Today</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {checkouts.length === 0 ? (
              <p className="px-5 py-6 text-sm text-gray-400 text-center">No check-outs today</p>
            ) : checkouts.map((b) => (
              <div key={b.booking_id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{b.guest_name}</p>
                  <p className="text-xs text-gray-400">{b.booking_ref}</p>
                </div>
                <button
                  onClick={() => bookingsApi.checkout(b.booking_id).then(() => window.location.reload())}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition"
                >
                  Check Out
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Settlement */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-3">Pending Settlement</h2>
          <p className="text-3xl font-bold text-green-600">{formatINR(data.pending_settlement_paise)}</p>
          <p className="text-xs text-gray-400 mt-1">Next payout: Tomorrow (T+1)</p>
          <Link href="/dashboard/settlement" className="text-sm text-blue-600 font-medium hover:underline mt-3 inline-block">
            View Statement →
          </Link>
        </div>

        {/* Ownership Mining Card */}
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-sm p-5 text-white">
          <h2 className="font-semibold mb-3 text-white/90">Ownership Mining</h2>
          <p className="text-sm text-white/70">Your performance earns equity in the platform</p>
          <Link href="/dashboard/ownership" className="mt-4 inline-block px-4 py-2 bg-white/20 rounded-lg text-sm font-medium hover:bg-white/30 transition">
            View Ownership Dashboard →
          </Link>
        </div>
      </div>
    </div>
  );
}

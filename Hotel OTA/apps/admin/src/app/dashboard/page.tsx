'use client';

import { useEffect, useState } from 'react';
import { dashboardApi, formatINR } from '@/lib/api';

interface KPIs {
  gmv_today_paise: number;
  gmv_month_paise: number;
  active_bookings: number;
  active_hotels: number;
  total_users: number;
  coin_liability_paise: number;
  pending_settlement_paise: number;
}

interface FeedItem {
  id: string;
  type: string;
  message: string;
  timestamp: string;
}

interface Alert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  timestamp: string;
}

function KPICard({
  label,
  value,
  sub,
  color = 'text-gray-900',
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

const severityStyle: Record<string, string> = {
  critical: 'bg-red-50 border-red-300 text-red-800',
  warning: 'bg-yellow-50 border-yellow-300 text-yellow-800',
  info: 'bg-blue-50 border-blue-300 text-blue-800',
};

const feedTypeColor: Record<string, string> = {
  booking: 'bg-green-100 text-green-700',
  user: 'bg-blue-100 text-blue-700',
  hotel: 'bg-purple-100 text-purple-700',
  settlement: 'bg-orange-100 text-orange-700',
};

export default function AdminOverview() {
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      dashboardApi.kpis(),
      dashboardApi.liveFeed(),
      dashboardApi.alerts(),
    ]).then(([k, f, a]) => {
      if (k.status === 'fulfilled') setKpis(k.value);
      if (f.status === 'fulfilled') setFeed(f.value.items ?? []);
      if (a.status === 'fulfilled') setAlerts(a.value.alerts ?? []);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-sm">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Admin Overview</h1>
        <span className="text-sm text-gray-500">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </span>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          label="GMV Today"
          value={kpis ? formatINR(kpis.gmv_today_paise) : '—'}
          color="text-green-700"
        />
        <KPICard
          label="GMV This Month"
          value={kpis ? formatINR(kpis.gmv_month_paise) : '—'}
          color="text-green-700"
        />
        <KPICard
          label="Active Bookings"
          value={kpis ? kpis.active_bookings.toLocaleString() : '—'}
        />
        <KPICard
          label="Active Hotels"
          value={kpis ? kpis.active_hotels.toLocaleString() : '—'}
        />
        <KPICard
          label="Total Users"
          value={kpis ? kpis.total_users.toLocaleString() : '—'}
        />
        <KPICard
          label="Coin Liability"
          value={kpis ? formatINR(kpis.coin_liability_paise) : '—'}
          color="text-red-600"
          sub="Outstanding balance"
        />
        <KPICard
          label="Pending Settlement"
          value={kpis ? formatINR(kpis.pending_settlement_paise) : '—'}
          color="text-orange-600"
          sub="Awaiting approval"
        />
      </div>

      {/* Charts Placeholder */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">GMV Trend (Last 30 days)</h2>
          <div className="h-40 flex items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
            <span className="text-sm text-gray-400">Recharts area chart — connect /admin/dashboard/gmv-trend</span>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Bookings by Channel</h2>
          <div className="h-40 flex items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
            <span className="text-sm text-gray-400">Recharts pie chart — connect /admin/dashboard/channels</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Live Feed */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="px-5 py-4 border-b">
            <h2 className="text-sm font-semibold text-gray-700">Live Activity Feed</h2>
          </div>
          <div className="divide-y max-h-72 overflow-y-auto">
            {feed.length === 0 ? (
              <div className="px-5 py-8 text-center text-gray-400 text-sm">No recent activity</div>
            ) : (
              feed.map((item) => (
                <div key={item.id} className="px-5 py-3 flex items-start gap-3">
                  <span
                    className={`mt-0.5 px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${
                      feedTypeColor[item.type] ?? 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {item.type}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 truncate">{item.message}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(item.timestamp).toLocaleTimeString('en-IN')}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Alerts Panel */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="px-5 py-4 border-b">
            <h2 className="text-sm font-semibold text-gray-700">
              Alerts{' '}
              {alerts.filter((a) => a.severity === 'critical').length > 0 && (
                <span className="ml-2 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-medium">
                  {alerts.filter((a) => a.severity === 'critical').length} critical
                </span>
              )}
            </h2>
          </div>
          <div className="divide-y max-h-72 overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="px-5 py-8 text-center text-gray-400 text-sm">No active alerts</div>
            ) : (
              alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`px-5 py-3 border-l-4 ${severityStyle[alert.severity]}`}
                >
                  <p className="text-sm font-medium">{alert.message}</p>
                  <p className="text-xs opacity-70 mt-0.5">
                    {new Date(alert.timestamp).toLocaleString('en-IN')}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

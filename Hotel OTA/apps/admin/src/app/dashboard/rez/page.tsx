'use client';

import { useEffect, useState } from 'react';
import { rezApi } from '@/lib/api';

interface WebhookHealth {
  status: 'healthy' | 'degraded' | 'down';
  last_received_at?: string;
  success_rate_24h: number;
  total_24h: number;
  failed_24h: number;
}

interface WebhookFailure {
  id: string;
  event_type: string;
  payload_summary: string;
  error_message: string;
  failed_at: string;
  retry_count: number;
}

interface AttributionLog {
  id: string;
  booking_ref: string;
  rez_booking_id: string;
  user_name: string;
  attribution_type: string;
  coins_awarded_paise: number;
  created_at: string;
}

const healthStyle: Record<string, string> = {
  healthy: 'bg-green-100 text-green-800',
  degraded: 'bg-yellow-100 text-yellow-800',
  down: 'bg-red-100 text-red-800',
};

export default function RezIntegrationPage() {
  const [health, setHealth] = useState<WebhookHealth | null>(null);
  const [failures, setFailures] = useState<WebhookFailure[]>([]);
  const [attributions, setAttributions] = useState<AttributionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'failures' | 'attribution'>('failures');
  const [retrying, setRetrying] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [h, f, a] = await Promise.allSettled([
        rezApi.webhookHealth(),
        rezApi.failures(),
        rezApi.attributionLog(),
      ]);
      if (h.status === 'fulfilled') setHealth(h.value);
      if (f.status === 'fulfilled') setFailures(f.value.failures ?? []);
      if (a.status === 'fulfilled') setAttributions(a.value.logs ?? []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRetry(id: string) {
    setRetrying(id);
    try {
      await rezApi.retryWebhook(id);
      load();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRetrying(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">ReZ Integration</h1>
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

      {/* Webhook Health Card */}
      <div className="bg-white rounded-xl shadow-sm border p-5">
        <h2 className="font-semibold text-gray-800 mb-4">Webhook Health</h2>
        {loading ? (
          <div className="text-sm text-gray-400">Loading...</div>
        ) : !health ? (
          <div className="text-sm text-gray-400">Unable to fetch webhook health</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="col-span-2 md:col-span-1">
              <p className="text-xs text-gray-500 mb-1">Status</p>
              <span
                className={`px-3 py-1 rounded-full text-sm font-semibold capitalize ${
                  healthStyle[health.status]
                }`}
              >
                {health.status}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Success Rate (24h)</p>
              <p className="text-xl font-bold text-gray-900">{health.success_rate_24h.toFixed(1)}%</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Total (24h)</p>
              <p className="text-xl font-bold text-gray-900">{health.total_24h}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Failed (24h)</p>
              <p className={`text-xl font-bold ${health.failed_24h > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                {health.failed_24h}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Last Received</p>
              <p className="text-sm font-medium text-gray-900">
                {health.last_received_at
                  ? new Date(health.last_received_at).toLocaleString('en-IN')
                  : 'N/A'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        <button
          onClick={() => setActiveTab('failures')}
          className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${
            activeTab === 'failures'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Webhook Failures
          {failures.length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 text-xs">
              {failures.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('attribution')}
          className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${
            activeTab === 'attribution'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Attribution Log
        </button>
      </div>

      {/* Failures Table */}
      {activeTab === 'failures' && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-4 py-3 text-left font-medium text-gray-600">Event Type</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Payload</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Error</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Retries</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Failed At</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {failures.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                    No webhook failures — everything looks good
                  </td>
                </tr>
              ) : (
                failures.map((f) => (
                  <tr key={f.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-xs bg-orange-50 text-orange-700 font-medium">
                        {f.event_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs">
                      <p className="truncate text-xs">{f.payload_summary}</p>
                    </td>
                    <td className="px-4 py-3 text-red-600 max-w-xs">
                      <p className="truncate text-xs">{f.error_message}</p>
                    </td>
                    <td className="px-4 py-3 text-center">{f.retry_count}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(f.failed_at).toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleRetry(f.id)}
                        disabled={retrying === f.id}
                        className="text-xs text-indigo-600 hover:underline font-medium disabled:opacity-40"
                      >
                        {retrying === f.id ? 'Retrying...' : 'Retry'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Attribution Log Table */}
      {activeTab === 'attribution' && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="px-4 py-3 text-left font-medium text-gray-600">Booking Ref</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">ReZ Booking ID</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">User</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Attribution Type</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Coins Awarded</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
              </tr>
            </thead>
            <tbody>
              {attributions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                    No attribution records yet
                  </td>
                </tr>
              ) : (
                attributions.map((a) => (
                  <tr key={a.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{a.booking_ref}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{a.rez_booking_id}</td>
                    <td className="px-4 py-3 font-medium">{a.user_name}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700 capitalize">
                        {a.attribution_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-indigo-700">
                      {a.coins_awarded_paise > 0 ? `+₹${(a.coins_awarded_paise / 100).toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(a.created_at).toLocaleString('en-IN')}
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

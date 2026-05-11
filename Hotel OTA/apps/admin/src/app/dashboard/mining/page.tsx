'use client';

import { useState } from 'react';
import { miningApi, formatINR } from '@/lib/api';

interface PreviewEntry {
  user_id: string;
  user_name: string;
  hotel_name: string;
  stay_nights: number;
  ownership_score: number;
  coins_to_award_paise: number;
}

interface RunStatus {
  run_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  processed: number;
  total: number;
  started_at: string;
  completed_at?: string;
  error?: string;
}

const statusStyle: Record<string, string> = {
  queued: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
};

export default function MiningRunPage() {
  const [period, setPeriod] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 7);
  });

  const [preview, setPreview] = useState<PreviewEntry[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');

  const [runStatus, setRunStatus] = useState<RunStatus | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState('');
  const [pollInterval, setPollInterval] = useState<ReturnType<typeof setInterval> | null>(null);

  async function handlePreview() {
    setPreviewLoading(true);
    setPreviewError('');
    setPreview(null);
    try {
      const data = await miningApi.preview(period);
      setPreview(data.entries ?? []);
    } catch (err: any) {
      setPreviewError(err.message);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleExecute() {
    if (!window.confirm(`Execute ownership mining for period ${period}? This cannot be undone.`)) return;
    setRunning(true);
    setRunError('');
    setRunStatus(null);
    try {
      const data = await miningApi.run(period);
      const runId = data.run_id;
      setRunStatus({ run_id: runId, status: 'queued', processed: 0, total: preview?.length ?? 0, started_at: new Date().toISOString() });

      const interval = setInterval(async () => {
        try {
          const status = await miningApi.status(runId);
          setRunStatus(status);
          if (status.status === 'completed' || status.status === 'failed') {
            clearInterval(interval);
            setPollInterval(null);
            setRunning(false);
          }
        } catch {
          clearInterval(interval);
          setPollInterval(null);
          setRunning(false);
        }
      }, 2000);

      setPollInterval(interval);
    } catch (err: any) {
      setRunError(err.message);
      setRunning(false);
    }
  }

  const totalCoins = preview?.reduce((sum, e) => sum + e.coins_to_award_paise, 0) ?? 0;

  const progressPct =
    runStatus && runStatus.total > 0
      ? Math.round((runStatus.processed / runStatus.total) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Ownership Mining — Run</h1>

      {/* Period selector */}
      <div className="bg-white rounded-xl shadow-sm border p-5">
        <h2 className="font-semibold text-gray-800 mb-4">Select Mining Period</h2>
        <div className="flex items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Period (YYYY-MM)</label>
            <input
              type="month"
              value={period}
              onChange={(e) => {
                setPeriod(e.target.value);
                setPreview(null);
                setRunStatus(null);
              }}
              className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 outline-none"
            />
          </div>
          <button
            onClick={handlePreview}
            disabled={previewLoading}
            className="px-5 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
          >
            {previewLoading ? 'Loading Preview...' : 'Preview Run'}
          </button>
          {preview !== null && preview.length > 0 && (
            <button
              onClick={handleExecute}
              disabled={running}
              className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {running ? 'Executing...' : 'Execute Mining Run'}
            </button>
          )}
        </div>

        {previewError && (
          <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-lg">
            {previewError}
          </div>
        )}
      </div>

      {/* Progress bar */}
      {runStatus && (
        <div className="bg-white rounded-xl shadow-sm border p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800">Run Progress</h2>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                statusStyle[runStatus.status]
              }`}
            >
              {runStatus.status}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-indigo-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>{runStatus.processed} processed</span>
            <span>{progressPct}%</span>
            <span>{runStatus.total} total</span>
          </div>
          {runStatus.status === 'completed' && (
            <p className="mt-2 text-sm text-green-700 font-medium">Mining run completed successfully.</p>
          )}
          {runStatus.status === 'failed' && (
            <p className="mt-2 text-sm text-red-700">{runStatus.error ?? 'Mining run failed.'}</p>
          )}
        </div>
      )}

      {runError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {runError}
        </div>
      )}

      {/* Preview table */}
      {preview !== null && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">
              Preview: {preview.length} eligible users for {period}
            </h2>
            <span className="text-sm text-gray-500">
              Total coins: <span className="font-semibold text-gray-900">{formatINR(totalCoins)}</span>
            </span>
          </div>

          {preview.length === 0 ? (
            <div className="px-5 py-10 text-center text-gray-400 text-sm">
              No eligible users found for this period
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="px-4 py-3 text-left font-medium text-gray-600">User</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Hotel</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Stay Nights</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Ownership Score</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Coins to Award</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((e, i) => (
                  <tr key={`${e.user_id}-${i}`} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{e.user_name}</td>
                    <td className="px-4 py-3 text-gray-600">{e.hotel_name}</td>
                    <td className="px-4 py-3 text-center">{e.stay_nights}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-mono">{e.ownership_score.toFixed(2)}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-indigo-700">
                      {formatINR(e.coins_to_award_paise)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

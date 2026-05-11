'use client';

import { useEffect, useState } from 'react';
import { pricingApi } from '@/lib/api';
import { formatINR } from '@/lib/format';

interface Suggestion {
  id: string;
  roomType: { name: string };
  date: string;
  currentRatePaise: number;
  suggestedRatePaise: number;
  confidenceScore: number;
  reason: string;
  status: string;
}

interface Forecast {
  date: string;
  predictedOccupancyPct: number;
  predictedAdrPaise: number;
  predictedRevenuePaise: number;
  confidenceLevel: string;
}

export default function AnalyticsPage() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [forecast, setForecast] = useState<Forecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'pricing' | 'forecast'>('pricing');

  useEffect(() => {
    Promise.all([
      pricingApi.getSuggestions().catch(() => ({ suggestions: [] })),
      pricingApi.getForecast().catch(() => ({ forecast: [] })),
    ]).then(([s, f]) => {
      setSuggestions(s.suggestions || []);
      setForecast(f.forecast || []);
    }).finally(() => setLoading(false));
  }, []);

  async function handleAccept(id: string) {
    await pricingApi.acceptSuggestion(id);
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
  }

  async function handleReject(id: string) {
    await pricingApi.rejectSuggestion(id);
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
  }

  if (loading) return <div className="text-gray-400 py-20 text-center">Loading analytics...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Analytics & Intelligence</h1>

      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab('pricing')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'pricing' ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600'}`}>
          Dynamic Pricing ({suggestions.length})
        </button>
        <button onClick={() => setTab('forecast')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === 'forecast' ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600'}`}>
          Demand Forecast
        </button>
      </div>

      {tab === 'pricing' && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50">
            <p className="text-sm text-gray-600">AI-suggested rate changes based on demand patterns</p>
          </div>
          {suggestions.length === 0 ? (
            <p className="px-5 py-10 text-center text-gray-400">No pricing suggestions. Rates look optimal!</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Room</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Current</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Suggested</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Reason</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Confidence</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map((s) => {
                  const change = s.suggestedRatePaise - s.currentRatePaise;
                  const changePct = Math.round((change / s.currentRatePaise) * 100);
                  return (
                    <tr key={s.id} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{s.roomType?.name || '—'}</td>
                      <td className="px-4 py-3">{new Date(s.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                      <td className="px-4 py-3 text-right">{formatINR(s.currentRatePaise)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={change > 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                          {formatINR(s.suggestedRatePaise)} ({changePct > 0 ? '+' : ''}{changePct}%)
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-xs">{s.reason}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          Number(s.confidenceScore) > 0.7 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>{Math.round(Number(s.confidenceScore) * 100)}%</span>
                      </td>
                      <td className="px-4 py-3 text-center space-x-1">
                        <button onClick={() => handleAccept(s.id)}
                          className="px-2.5 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700">Accept</button>
                        <button onClick={() => handleReject(s.id)}
                          className="px-2.5 py-1 bg-gray-200 text-gray-700 rounded text-xs font-medium hover:bg-gray-300">Reject</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'forecast' && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b bg-gray-50">
            <p className="text-sm text-gray-600">Predicted occupancy and revenue for the next 30 days</p>
          </div>
          {forecast.length === 0 ? (
            <p className="px-5 py-10 text-center text-gray-400">No forecast data available yet</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Occupancy</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Predicted ADR</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Predicted Revenue</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {forecast.map((f, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3">{new Date(f.date).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })}</td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${Number(f.predictedOccupancyPct)}%` }} />
                        </div>
                        <span className="text-xs font-medium">{Number(f.predictedOccupancyPct)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">{formatINR(f.predictedAdrPaise)}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatINR(f.predictedRevenuePaise)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        f.confidenceLevel === 'high' ? 'bg-green-100 text-green-700' :
                        f.confidenceLevel === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{f.confidenceLevel}</span>
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

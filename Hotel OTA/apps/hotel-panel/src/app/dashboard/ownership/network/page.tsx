'use client';

import { useEffect, useState } from 'react';
import { ownershipApi } from '@/lib/api';
import { formatINR } from '@/lib/format';
import Link from 'next/link';

export default function NetworkStandingPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [simAvailability, setSimAvailability] = useState('');
  const [simResult, setSimResult] = useState<any>(null);

  useEffect(() => { ownershipApi.networkStanding().then(setData).catch(console.error).finally(() => setLoading(false)); }, []);

  function runSimulator() {
    if (!data?.myHotel || !simAvailability) return;
    const my = data.myHotel;
    const avail = parseInt(simAvailability) / 100;
    const baseScore = my.roomsAllocated * avail * (my.adrPaise / 100000) * my.roomNightsBooked;
    const repeatMul = my.roomNightsBooked > 0 ? 1 + (my.repeatBookingCount / my.roomNightsBooked * 0.5) : 1;
    const ratingMul = (my.averageRating || 4) / 4.0;
    const cancelPen = 1 - ((my.cancellationRatePct || 0) / 100 * 2.0);
    const newScore = Math.max(0, baseScore * repeatMul * ratingMul * cancelPen);
    const newRank = (data.leaderboard || []).filter((h: any) => h.hcsScore > newScore && !h.isYou).length + 1;
    setSimResult({ score: newScore, rank: newRank, unitsDelta: newScore > my.rawScore ? Math.round((newScore - my.rawScore) / (data.networkTotal || 1) * (data.monthlyPoolUnits || 8333)) : 0 });
  }

  if (loading) return <div className="text-gray-400 py-20 text-center">Loading network data...</div>;

  const n = data || {};
  const board = n.leaderboard || [];
  const avgs = n.networkAverages || {};
  const comparison = n.comparison || {};

  return (
    <div>
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {[{h:'/dashboard/ownership',l:'My Ownership'},{h:'/dashboard/ownership/history',l:'Performance History'},{h:'/dashboard/ownership/vesting',l:'Vesting Timeline'},{h:'/dashboard/ownership/network',l:'Network Standing',a:true},{h:'/dashboard/ownership/dispute',l:'Raise a Dispute'}].map(n=>(
          <Link key={n.h} href={n.h} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${n.a?'bg-indigo-600 text-white':'bg-white border text-gray-600 hover:bg-gray-50'}`}>{n.l}</Link>
        ))}
      </div>

      {/* Leaderboard */}
      <div className="bg-white rounded-xl border overflow-hidden mb-6">
        <div className="px-5 py-4 border-b">
          <h2 className="font-bold text-gray-900">{n.period || 'Current'} — Network Standings</h2>
          <p className="text-xs text-gray-400 mt-0.5">{board.length} hotel partners · Updated monthly</p>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 border-b">
            <th className="px-4 py-3 text-left font-medium text-gray-600">Rank</th>
            <th className="px-4 py-3 text-left font-medium text-gray-600">Hotel</th>
            <th className="px-4 py-3 text-right font-medium text-gray-600">HCS Score</th>
            <th className="px-4 py-3 text-right font-medium text-gray-600">Units</th>
            <th className="px-4 py-3 text-right font-medium text-gray-600">Share %</th>
          </tr></thead>
          <tbody>
            {board.map((h: any) => (
              <tr key={h.rank} className={`border-b ${h.isYou ? 'bg-indigo-50 font-semibold' : 'hover:bg-gray-50'}`}>
                <td className="px-4 py-3">{h.isYou ? '→' : ''} #{h.rank}</td>
                <td className="px-4 py-3">{h.hotelName} {h.isYou && <span className="ml-2 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs">YOU</span>}</td>
                <td className="px-4 py-3 text-right">{Number(h.hcsScore).toFixed(0)}</td>
                <td className="px-4 py-3 text-right">{Number(h.unitsEarned).toFixed(1)}</td>
                <td className="px-4 py-3 text-right">{Number(h.sharePct).toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Network Averages vs You */}
      <div className="bg-white rounded-xl border p-6 mb-6">
        <h2 className="font-bold text-gray-900 mb-4">Your Hotel vs Network</h2>
        <div className="space-y-3">
          {[
            { label: 'HCS Score', yours: comparison.hcs, avg: avgs.avgHcs, higher: true },
            { label: 'ADR', yours: comparison.adr, avg: avgs.avgAdr, higher: true, fmt: true },
            { label: 'Availability', yours: comparison.availability, avg: avgs.avgAvailability, higher: true, pct: true },
            { label: 'Rating', yours: comparison.rating, avg: avgs.avgRating, higher: true },
            { label: 'Cancellation', yours: comparison.cancellation, avg: avgs.avgCancellation, higher: false, pct: true },
          ].map((m) => {
            const y = Number(m.yours || 0);
            const a = Number(m.avg || 0);
            const diff = y - a;
            const good = m.higher ? diff >= 0 : diff <= 0;
            return (
              <div key={m.label} className="flex items-center justify-between">
                <p className="text-sm text-gray-600 w-28">{m.label}</p>
                <div className="flex-1 mx-4 bg-gray-100 rounded-full h-2 relative">
                  <div className="bg-gray-300 h-2 rounded-full" style={{ width: '50%' }} />
                  <div className={`absolute top-0 h-2 rounded-full ${good ? 'bg-green-500' : 'bg-red-400'}`}
                    style={{ width: `${Math.min(Math.max((y / (a || 1)) * 50, 5), 95)}%` }} />
                </div>
                <div className="text-right w-32">
                  <span className="text-sm font-semibold">{m.fmt ? formatINR(y) : m.pct ? `${y.toFixed(1)}%` : y.toFixed(1)}</span>
                  <span className={`ml-2 text-xs ${good ? 'text-green-600' : 'text-red-500'}`}>{good ? '↑' : '↓'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* What-if Simulator */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="font-bold text-gray-900 mb-2">"What If" Simulator</h2>
        <p className="text-xs text-gray-400 mb-4">See how your score changes if you improve a metric</p>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-600 block mb-1">If availability was (%)</label>
            <input type="number" value={simAvailability} onChange={(e) => setSimAvailability(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="95" min={0} max={100} />
          </div>
          <button onClick={runSimulator} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Simulate</button>
        </div>
        {simResult && (
          <div className="mt-4 bg-indigo-50 rounded-lg p-4">
            <p className="text-sm text-indigo-800"><strong>Estimated HCS:</strong> {simResult.score.toFixed(0)}</p>
            <p className="text-sm text-indigo-800"><strong>Estimated rank:</strong> #{simResult.rank}</p>
            {simResult.unitsDelta > 0 && <p className="text-sm text-green-700 font-semibold mt-1">+{simResult.unitsDelta} more units per month</p>}
          </div>
        )}
        <Link href="/dashboard/calendar" className="block mt-3 text-xs text-indigo-600 font-medium hover:underline">Adjust your inventory →</Link>
      </div>
    </div>
  );
}

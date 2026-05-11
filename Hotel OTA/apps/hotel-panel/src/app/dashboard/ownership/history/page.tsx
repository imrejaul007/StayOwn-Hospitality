'use client';

import { useEffect, useState } from 'react';
import { ownershipApi } from '@/lib/api';
import { formatINR } from '@/lib/format';
import Link from 'next/link';

export default function PerformanceHistoryPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  useEffect(() => { ownershipApi.performanceHistory().then(setData).catch(console.error).finally(() => setLoading(false)); }, []);

  if (loading) return <div className="text-gray-400 py-20 text-center">Loading history...</div>;

  const h = data || {};

  return (
    <div>
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {[{h:'/dashboard/ownership',l:'My Ownership'},{h:'/dashboard/ownership/history',l:'Performance History',a:true},{h:'/dashboard/ownership/vesting',l:'Vesting Timeline'},{h:'/dashboard/ownership/network',l:'Network Standing'},{h:'/dashboard/ownership/dispute',l:'Raise a Dispute'}].map(n=>(
          <Link key={n.h} href={n.h} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${n.a?'bg-indigo-600 text-white':'bg-white border text-gray-600 hover:bg-gray-50'}`}>{n.l}</Link>
        ))}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4"><p className="text-xs text-gray-400">Total Units</p><p className="text-xl font-bold text-indigo-600">{(h.totalUnitsIssued || 0).toFixed(1)}</p></div>
        <div className="bg-white rounded-xl border p-4"><p className="text-xs text-gray-400">Avg Monthly Score</p><p className="text-xl font-bold text-gray-900">{(h.avgMonthlyScore || 0).toFixed(0)}</p></div>
        <div className="bg-white rounded-xl border p-4"><p className="text-xs text-gray-400">Best Month</p><p className="text-xl font-bold text-green-600">{h.bestMonth || 'N/A'}</p></div>
        <div className="bg-white rounded-xl border p-4"><p className="text-xs text-gray-400">Months Active</p><p className="text-xl font-bold text-gray-900">{h.monthsActive || 0}</p></div>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="px-4 py-3 text-left font-medium text-gray-600">Month</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">Rooms</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">Avail%</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">ADR</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">Nights</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">HCS</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">Rank</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Units</th>
            </tr>
          </thead>
          <tbody>
            {(h.history || []).map((row: any) => {
              const key = row.periodMonth;
              const expanded = expandedRow === key;
              return (<>
                <tr key={key} className="border-b hover:bg-gray-50 cursor-pointer" onClick={() => setExpandedRow(expanded ? null : key)}>
                  <td className="px-4 py-3 font-medium">{new Date(row.periodMonth).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</td>
                  <td className="px-4 py-3 text-center">{row.roomsAllocated}</td>
                  <td className="px-4 py-3 text-center">{Number(row.availabilityPct).toFixed(0)}%</td>
                  <td className="px-4 py-3 text-right">{formatINR(row.adrPaise)}</td>
                  <td className="px-4 py-3 text-center">{row.roomNightsBooked}</td>
                  <td className="px-4 py-3 text-right font-semibold">{Number(row.rawScore).toFixed(0)}</td>
                  <td className="px-4 py-3 text-center">#{row.networkRank}/{row.totalHotels}</td>
                  <td className="px-4 py-3 text-right font-semibold text-indigo-600">{Number(row.unitsIssued).toFixed(1)}</td>
                </tr>
                {expanded && (
                  <tr key={key+'-detail'} className="bg-gray-50">
                    <td colSpan={8} className="px-6 py-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div><span className="text-gray-400">Repeat bookings:</span> <span className="font-medium">{row.repeatBookingCount}</span></div>
                        <div><span className="text-gray-400">Avg rating:</span> <span className="font-medium">{Number(row.averageRating).toFixed(1)}⭐</span></div>
                        <div><span className="text-gray-400">Cancellation:</span> <span className="font-medium">{Number(row.cancellationRatePct).toFixed(1)}%</span></div>
                        <div><span className="text-gray-400">Normalized:</span> <span className="font-medium">{(Number(row.normalizedScore)*100).toFixed(2)}%</span></div>
                      </div>
                    </td>
                  </tr>
                )}
              </>);
            })}
            {(h.history || []).length === 0 && <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">No mining history yet</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

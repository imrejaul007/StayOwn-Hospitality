'use client';

import { useEffect, useState } from 'react';
import { ownershipApi } from '@/lib/api';
import Link from 'next/link';

export default function VestingTimelinePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'timeline' | 'table'>('timeline');

  useEffect(() => { ownershipApi.vestingTimeline().then(setData).catch(console.error).finally(() => setLoading(false)); }, []);

  if (loading) return <div className="text-gray-400 py-20 text-center">Loading vesting data...</div>;

  const v = data || {};
  const entries = v.entries || [];

  return (
    <div>
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {[{h:'/dashboard/ownership',l:'My Ownership'},{h:'/dashboard/ownership/history',l:'Performance History'},{h:'/dashboard/ownership/vesting',l:'Vesting Timeline',a:true},{h:'/dashboard/ownership/network',l:'Network Standing'},{h:'/dashboard/ownership/dispute',l:'Raise a Dispute'}].map(n=>(
          <Link key={n.h} href={n.h} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${n.a?'bg-indigo-600 text-white':'bg-white border text-gray-600 hover:bg-gray-50'}`}>{n.l}</Link>
        ))}
      </div>

      {/* Summary Bar */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
          <p className="text-xs text-amber-600 font-medium">🔒 Locked</p>
          <p className="text-xl font-bold text-amber-700 mt-1">{(v.lockedUnits || 0).toFixed(1)} units</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <p className="text-xs text-green-600 font-medium">✅ Vested</p>
          <p className="text-xl font-bold text-green-700 mt-1">{(v.vestedUnits || 0).toFixed(1)} units</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-xs text-gray-500 font-medium">Total</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{((v.lockedUnits||0)+(v.vestedUnits||0)+(v.forfeitedUnits||0)).toFixed(1)} units</p>
        </div>
      </div>

      {v.nextUnlock && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-indigo-800">Next unlock: {Number(v.nextUnlock.units).toFixed(1)} units</p>
            <p className="text-xs text-indigo-600 mt-0.5">{new Date(v.nextUnlock.date).toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})} ({v.nextUnlock.daysRemaining} days)</p>
          </div>
          <span className="text-2xl">⏳</span>
        </div>
      )}

      {/* View Toggle */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setViewMode('timeline')} className={`px-4 py-1.5 rounded-lg text-xs font-medium ${viewMode==='timeline'?'bg-indigo-600 text-white':'bg-white border text-gray-600'}`}>Timeline</button>
        <button onClick={() => setViewMode('table')} className={`px-4 py-1.5 rounded-lg text-xs font-medium ${viewMode==='table'?'bg-indigo-600 text-white':'bg-white border text-gray-600'}`}>Table</button>
      </div>

      {viewMode === 'timeline' ? (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {entries.map((e: any, i: number) => (
            <div key={i} className={`flex-shrink-0 w-36 rounded-xl border p-4 ${
              e.status === 'unlocked' ? 'bg-green-50 border-green-200' :
              e.status === 'pending' ? 'bg-amber-50 border-amber-200' :
              'bg-red-50 border-red-200'
            }`}>
              <p className="text-xs font-bold text-gray-700">{new Date(e.periodMonth).toLocaleDateString('en-IN',{month:'short',year:'2-digit'})}</p>
              <p className="text-lg font-bold mt-1">{Number(e.units).toFixed(1)}</p>
              <p className="text-[10px] text-gray-500">units</p>
              <div className="mt-2 pt-2 border-t border-gray-200">
                <p className="text-[10px] text-gray-400">Unlock: {new Date(e.vestingEndDate).toLocaleDateString('en-IN',{day:'2-digit',month:'short'})}</p>
                <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                  e.status==='unlocked'?'bg-green-100 text-green-700':e.status==='pending'?'bg-amber-100 text-amber-700':'bg-red-100 text-red-700'
                }`}>{e.status === 'unlocked' ? '✅ Vested' : e.status === 'pending' ? `🔒 ${e.daysRemaining}d` : '❌ Forfeited'}</span>
              </div>
            </div>
          ))}
          {entries.length === 0 && <p className="text-gray-400 py-10 text-center w-full">No vesting entries yet</p>}
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b">
              <th className="px-4 py-3 text-left font-medium text-gray-600">Issue Date</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Period</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">Units</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Vesting Date</th>
              <th className="px-4 py-3 text-center font-medium text-gray-600">Status</th>
            </tr></thead>
            <tbody>
              {entries.map((e: any, i: number) => (
                <tr key={i} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">{new Date(e.issueDate).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'2-digit'})}</td>
                  <td className="px-4 py-3">{new Date(e.periodMonth).toLocaleDateString('en-IN',{month:'short',year:'numeric'})}</td>
                  <td className="px-4 py-3 text-right font-semibold">{Number(e.units).toFixed(1)}</td>
                  <td className="px-4 py-3">{new Date(e.vestingEndDate).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</td>
                  <td className="px-4 py-3 text-center"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${e.status==='unlocked'?'bg-green-100 text-green-700':e.status==='pending'?'bg-amber-100 text-amber-700':'bg-red-100 text-red-700'}`}>{e.status}</span></td>
                </tr>
              ))}
              {entries.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">No entries</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-sm text-amber-800 font-medium">⚠️ Forfeiture Warning</p>
        <p className="text-xs text-amber-700 mt-1">If your hotel becomes inactive for 2+ months, locked units may be forfeited. Keep your inventory available to protect your units.</p>
      </div>
    </div>
  );
}

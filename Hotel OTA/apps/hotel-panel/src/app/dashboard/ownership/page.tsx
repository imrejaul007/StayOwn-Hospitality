'use client';

import { useEffect, useState } from 'react';
import { ownershipApi } from '@/lib/api';
import { formatINR } from '@/lib/format';
import Link from 'next/link';

const subNav = [
  { href: '/dashboard/ownership', label: 'My Ownership' },
  { href: '/dashboard/ownership/history', label: 'Performance History' },
  { href: '/dashboard/ownership/vesting', label: 'Vesting Timeline' },
  { href: '/dashboard/ownership/network', label: 'Network Standing' },
  { href: '/dashboard/ownership/dispute', label: 'Raise a Dispute' },
];

export default function OwnershipDashboard() {
  const [data, setData] = useState<any>(null);
  const [projections, setProjections] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      ownershipApi.dashboard().catch(() => null),
      ownershipApi.projections().catch(() => null),
    ]).then(([d, p]) => { setData(d); setProjections(p); }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-400 py-20 text-center">Loading ownership data...</div>;

  const d = data || {};
  const p = projections || {};

  return (
    <div>
      {/* Sub-nav */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {subNav.map((item, i) => (
          <Link key={item.href} href={item.href}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              i === 0 ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>{item.label}</Link>
        ))}
      </div>

      {/* Hero Summary */}
      <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-6 text-white mb-6">
        <p className="text-indigo-200 text-sm font-medium">Co-owner since {d.scoreHistory?.[d.scoreHistory.length-1]?.periodMonth ? new Date(d.scoreHistory[d.scoreHistory.length-1].periodMonth).toLocaleDateString('en-IN',{month:'long',year:'numeric'}) : 'joining'}</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-4">
          <div><p className="text-indigo-200 text-xs">Ownership units</p><p className="text-3xl font-bold mt-1">{(d.currentOwnershipUnits||0).toFixed(1)}</p></div>
          <div><p className="text-indigo-200 text-xs">Network share</p><button onClick={()=>setShowModal('share')} className="text-2xl font-bold mt-1 underline decoration-dotted">~{(d.estimatedNetworkShare||0).toFixed(2)}%</button></div>
          <div><p className="text-indigo-200 text-xs">Vesting soon</p><p className="text-2xl font-bold mt-1">{(d.vestingInNext12Months||0).toFixed(1)}</p></div>
          <div><p className="text-indigo-200 text-xs">Network rank</p><p className="text-2xl font-bold mt-1">{d.networkRank?`#${d.networkRank} of ${d.totalHotels}`:'N/A'}</p></div>
        </div>
      </div>

      {/* Projection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-5">
          <span className="text-2xl">💰</span>
          <h3 className="font-semibold text-gray-900 mt-2">Commission Saved</h3>
          <p className="text-2xl font-bold text-green-600 mt-1">{formatINR(p.commissionSavedPaise||0)}</p>
          <p className="text-xs text-gray-400 mt-1">vs Booking.com 18% rate</p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <span className="text-2xl">📈</span>
          <h3 className="font-semibold text-gray-900 mt-2">Dividend Potential</h3>
          <p className="text-2xl font-bold text-blue-600 mt-1">{formatINR(p.dividendPotentialPaise||0)}</p>
          <p className="text-xs text-gray-400 mt-1">at ₹10Cr profit · <button onClick={()=>setShowModal('dividend')} className="text-blue-600 underline">How?</button></p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <span className="text-2xl">🚀</span>
          <h3 className="font-semibold text-gray-900 mt-2">Exit Potential</h3>
          <p className="text-2xl font-bold text-purple-600 mt-1">{formatINR(p.exitPotentialPaise||0)}</p>
          <p className="text-xs text-gray-400 mt-1">at ₹100Cr valuation · Illustrative only</p>
        </div>
      </div>

      {/* This Month's Mining */}
      {d.thisMonth && (
        <div className="bg-white rounded-xl border p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">This Month's Mining</h2>
            <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-semibold">🟡 In Progress</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><p className="text-gray-400 text-xs">Rooms</p><p className="font-bold">{d.thisMonth.roomsAllocated}</p></div>
            <div><p className="text-gray-400 text-xs">Availability</p><p className="font-bold">{d.thisMonth.availabilityPct}% {d.thisMonth.availabilityPct>=80?'✅':'⚠️'}</p></div>
            <div><p className="text-gray-400 text-xs">ADR</p><p className="font-bold">{formatINR(d.thisMonth.adrPaise)}</p></div>
            <div><p className="text-gray-400 text-xs">Room nights</p><p className="font-bold">{d.thisMonth.roomNightsBooked}</p></div>
          </div>
          <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-4">
            <div><p className="text-xs text-gray-400">Your HCS</p><p className="text-xl font-bold text-indigo-600">{Number(d.thisMonth.hcsScore).toFixed(0)}</p></div>
            <div><p className="text-xs text-gray-400">Network Avg</p><p className="text-xl font-bold text-gray-500">{Number(d.thisMonth.networkAvgHcs).toFixed(0)}</p></div>
            <div><p className="text-xs text-gray-400">Est. Units</p><p className="text-xl font-bold text-green-600">~{Number(d.thisMonth.unitsEarned).toFixed(0)}</p></div>
          </div>
          <div className="mt-4 bg-blue-50 rounded-lg p-4">
            <p className="text-xs font-semibold text-blue-700 mb-2">💡 Tips to earn more</p>
            <ul className="text-xs text-blue-600 space-y-1">
              {d.thisMonth.availabilityPct>=80 ? <li>• Availability {d.thisMonth.availabilityPct}% — great! Keep above 80%.</li> : <li>• ⚠️ Availability {d.thisMonth.availabilityPct}% — increase to 80%+ for better score.</li>}
              <li>• Consider premium pricing on weekends to boost ADR.</li>
              <li>• Focus on repeat guests for bonus multiplier.</li>
            </ul>
          </div>
        </div>
      )}

      {/* Vesting Summary */}
      <div className="bg-white rounded-xl border p-6 mb-6">
        <h2 className="font-bold text-gray-900 mb-3">Vesting Summary</h2>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div><p className="text-xs text-gray-400">Locked</p><p className="text-xl font-bold text-amber-600">{(d.vestingInNext12Months||0).toFixed(1)}</p></div>
          <div><p className="text-xs text-gray-400">Vested</p><p className="text-xl font-bold text-green-600">{(d.currentOwnershipUnits||0).toFixed(1)}</p></div>
          <div><p className="text-xs text-gray-400">Total</p><p className="text-xl font-bold text-gray-900">{((d.currentOwnershipUnits||0)+(d.vestingInNext12Months||0)).toFixed(1)}</p></div>
        </div>
        <Link href="/dashboard/ownership/vesting" className="block mt-4 text-sm text-indigo-600 font-medium hover:underline text-center">View Full Timeline →</Link>
      </div>

      {/* Ownership Growth Chart */}
      {d.vestingTimeline?.length > 0 && (
        <div className="bg-white rounded-xl border p-6 mb-6">
          <h2 className="font-bold text-gray-900 mb-4">Ownership Growth</h2>
          <div className="flex items-end gap-1 h-32">
            {d.vestingTimeline.map((v:any,i:number)=>{const mx=Math.max(...d.vestingTimeline.map((t:any)=>Number(t.units)));const h=mx>0?(Number(v.units)/mx)*100:0;return(
              <div key={i} className="flex-1 flex flex-col items-center justify-end" title={`${Number(v.units).toFixed(1)} units`}>
                <div className={`w-full rounded-t ${v.status==='vested'?'bg-green-400':v.status==='locked'?'bg-amber-400':'bg-gray-300'}`} style={{height:`${Math.max(h,4)}%`}}/>
                <p className="text-[7px] text-gray-400 mt-1">{new Date(v.periodMonth).toLocaleDateString('en-IN',{month:'short'})}</p>
              </div>);})}
          </div>
          <div className="flex gap-4 mt-3 justify-center text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-400 rounded"/>Vested</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-amber-400 rounded"/>Locked</span>
          </div>
        </div>
      )}

      {/* Liquidity Roadmap */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="font-bold text-gray-900 mb-4">Liquidity Roadmap</h2>
        <div className="relative">
          <div className="absolute top-6 left-0 right-0 h-0.5 bg-gray-200"/>
          <div className="flex justify-between relative">
            {[{l:'NOW',s:'Commission savings',i:'✅',a:true},{l:'YEAR 2',s:'Buyback window',i:'🔓',a:false},{l:'YEAR 3+',s:'Dividend possible',i:'💰',a:false},{l:'YEAR 5+',s:'Exit potential',i:'🚀',a:false}].map(m=>(
              <div key={m.l} className="flex flex-col items-center text-center z-10">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg ${m.a?'bg-indigo-600 text-white':'bg-gray-100 text-gray-400'}`}>{m.i}</div>
                <p className={`text-xs font-bold mt-2 ${m.a?'text-indigo-600':'text-gray-500'}`}>{m.l}</p>
                <p className="text-[10px] text-gray-400 mt-0.5 max-w-[80px]">{m.s}</p>
              </div>))}
          </div>
        </div>
        <p className="text-xs text-gray-400 text-center mt-4 italic">You are here — earning through commission savings</p>
      </div>

      {/* Modals */}
      {showModal&&(<div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={()=>setShowModal(null)}><div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={e=>e.stopPropagation()}>
        {showModal==='share'&&<><h3 className="font-bold text-lg mb-3">Network Share</h3><p className="text-sm text-gray-600">You hold ~{(d.estimatedNetworkShare||0).toFixed(2)}% of the Hotel Owners Trust (HOT), which owns 25% of the OTA company.</p><p className="text-sm text-gray-600 mt-2">Effective OTA share: ~{((d.estimatedNetworkShare||0)*0.25).toFixed(3)}%</p></>}
        {showModal==='dividend'&&<><h3 className="font-bold text-lg mb-3">Dividend Calculation</h3><p className="text-sm text-gray-600">Your dividend = (Your units ÷ Total vested units) × Dividend amount</p><p className="text-xs text-gray-400 mt-3">Possible from Year 3+ when OTA is profitable. Illustrative only.</p></>}
        {showModal==='hot'&&<><h3 className="font-bold text-lg mb-3">Hotel Owners Trust</h3><p className="text-sm text-gray-600">HOT is a legal entity holding 25% equity in the OTA on behalf of all hotel partners. Your units determine your share of dividends, buybacks, and exit proceeds.</p></>}
        {showModal==='vesting'&&<><h3 className="font-bold text-lg mb-3">What is Vesting?</h3><p className="text-sm text-gray-600">Units earned each month are locked for 12 months. After that, they automatically vest. Vested units are permanently yours. If your hotel becomes inactive, only unvested units are forfeited.</p></>}
        <button onClick={()=>setShowModal(null)} className="mt-4 w-full py-2 bg-gray-100 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-200">Close</button>
      </div></div>)}
    </div>
  );
}

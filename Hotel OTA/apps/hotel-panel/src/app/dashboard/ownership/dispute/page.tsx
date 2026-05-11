'use client';

import { useEffect, useState } from 'react';
import { ownershipApi } from '@/lib/api';
import Link from 'next/link';
import dayjs from 'dayjs';

export default function DisputePage() {
  const [disputes, setDisputes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({ periodMonth: '', disputeField: '', claim: '', evidenceUrl: '' });

  const today = dayjs();
  const dayOfMonth = today.date();
  const isDisputeWindowOpen = dayOfMonth >= 1 && dayOfMonth <= 7;
  const nextWindowDate = dayOfMonth > 7 ? dayjs().add(1, 'month').startOf('month') : dayjs().startOf('month');
  const daysUntilWindow = isDisputeWindowOpen ? 0 : nextWindowDate.diff(today, 'day');

  useEffect(() => { ownershipApi.disputeStatus().then((d) => setDisputes(d.disputes || [])).catch(console.error).finally(() => setLoading(false)); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setSuccess('');
    try {
      const res = await ownershipApi.submitDispute({
        period_month: form.periodMonth,
        dispute_field: form.disputeField,
        claim: form.claim,
        evidence_url: form.evidenceUrl || undefined,
      });
      setSuccess(`Dispute submitted — Reference: ${res.disputeId || 'Pending'}`);
      setShowForm(false);
      setForm({ periodMonth: '', disputeField: '', claim: '', evidenceUrl: '' });
      ownershipApi.disputeStatus().then((d) => setDisputes(d.disputes || [])).catch(() => {});
    } catch (err: any) { alert(err.message); }
    finally { setSubmitting(false); }
  }

  return (
    <div>
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {[{h:'/dashboard/ownership',l:'My Ownership'},{h:'/dashboard/ownership/history',l:'Performance History'},{h:'/dashboard/ownership/vesting',l:'Vesting Timeline'},{h:'/dashboard/ownership/network',l:'Network Standing'},{h:'/dashboard/ownership/dispute',l:'Raise a Dispute',a:true}].map(n=>(
          <Link key={n.h} href={n.h} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${n.a?'bg-indigo-600 text-white':'bg-white border text-gray-600 hover:bg-gray-50'}`}>{n.l}</Link>
        ))}
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">Raise a Dispute</h1>

      {/* Window Status */}
      {isDisputeWindowOpen ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-green-800 font-semibold">✅ Dispute window is open</p>
          <p className="text-xs text-green-600 mt-1">You can dispute last month's scores until the 7th. {7 - dayOfMonth} days remaining.</p>
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-gray-600 font-medium">Dispute window closed</p>
          <p className="text-xs text-gray-400 mt-1">Next window opens in {daysUntilWindow} days ({nextWindowDate.format('D MMM YYYY')})</p>
        </div>
      )}

      {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm">{success}</div>}

      {/* New Dispute Form */}
      {isDisputeWindowOpen && !showForm && (
        <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 mb-6">
          + Raise New Dispute
        </button>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border p-6 mb-6 max-w-xl space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Period</label>
            <input type="month" value={form.periodMonth} onChange={(e) => setForm({ ...form, periodMonth: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm" required />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">What are you disputing?</label>
            <select value={form.disputeField} onChange={(e) => setForm({ ...form, disputeField: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm" required>
              <option value="">Select...</option>
              <option value="availability">Availability % is wrong</option>
              <option value="room_nights">Room nights count is wrong</option>
              <option value="rating">Rating data is wrong</option>
              <option value="cancellation">Cancellation rate is wrong</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Your claim</label>
            <textarea value={form.claim} onChange={(e) => setForm({ ...form, claim: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm h-24" placeholder="Describe the discrepancy..." required />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Evidence URL (optional)</label>
            <input type="url" value={form.evidenceUrl} onChange={(e) => setForm({ ...form, evidenceUrl: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Link to PMS export, screenshots, etc." />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={submitting} className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              {submitting ? 'Submitting...' : 'Submit Dispute'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium">Cancel</button>
          </div>
        </form>
      )}

      {/* Dispute History */}
      <h2 className="font-bold text-gray-900 mb-3">Your Disputes</h2>
      {loading ? <p className="text-gray-400">Loading...</p> : disputes.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center text-gray-400">No disputes raised yet</div>
      ) : (
        <div className="space-y-3">
          {disputes.map((d: any) => (
            <div key={d.id} className="bg-white rounded-xl border p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{d.disputeField} — {new Date(d.periodMonth).toLocaleDateString('en-IN',{month:'long',year:'numeric'})}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Ref: {d.id?.slice(0, 12)} · Submitted {new Date(d.createdAt).toLocaleDateString('en-IN')}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  d.status === 'resolved' ? 'bg-green-100 text-green-700' :
                  d.status === 'rejected' ? 'bg-red-100 text-red-700' :
                  'bg-amber-100 text-amber-700'
                }`}>{d.status}</span>
              </div>
              <p className="text-sm text-gray-600 mt-2">{d.claim}</p>
              {d.resolution && (
                <div className="mt-3 bg-gray-50 rounded-lg p-3">
                  <p className="text-xs font-semibold text-gray-700">Resolution:</p>
                  <p className="text-xs text-gray-600 mt-1">{d.resolution}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

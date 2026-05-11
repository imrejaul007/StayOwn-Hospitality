'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { hotelsApi, userApi } from '@/lib/api';

type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error';

export default function RegisterStayPage() {
  const router = useRouter();
  const [hotels, setHotels] = useState<any[]>([]);
  const [hotelsLoading, setHotelsLoading] = useState(false);
  const [form, setForm] = useState({
    hotelId: '',
    stayDate: '',
    checkoutDate: '',
    receiptUrl: '',
    notes: '',
  });
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [submittedData, setSubmittedData] = useState<any>(null);

  useEffect(() => {
    setHotelsLoading(true);
    hotelsApi
      .list(1, 100)
      .then((data) => setHotels(data.results || []))
      .catch(() => setHotels([]))
      .finally(() => setHotelsLoading(false));
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.hotelId || !form.stayDate || !form.receiptUrl) return;
    setStatus('submitting');
    setErrorMsg('');
    try {
      const res = await userApi.registerStay({
        hotel_id: form.hotelId,
        stay_date: form.stayDate,
        checkout_date: form.checkoutDate || undefined,
        receipt_url: form.receiptUrl,
        notes: form.notes || undefined,
      });
      setSubmittedData(res);
      setStatus('success');
    } catch (err: any) {
      setErrorMsg(err.message || 'Submission failed. Please try again.');
      setStatus('error');
    }
  }

  if (status === 'success') {
    return (
      <div className="max-w-lg mx-auto min-h-screen bg-gray-50 flex items-center justify-center px-5">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center w-full">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">✓</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900">Stay Registered!</h2>
          <p className="text-gray-500 text-sm mt-2">
            Your stay has been submitted for verification. You will receive ReZ Coins once approved.
          </p>

          {submittedData && (
            <div className="mt-5 bg-gray-50 rounded-xl p-4 text-left space-y-2">
              {submittedData.registration_id && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Reference ID</span>
                  <span className="font-mono text-gray-800">{submittedData.registration_id}</span>
                </div>
              )}
              {submittedData.status && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Status</span>
                  <span className="capitalize font-semibold text-amber-600">{submittedData.status}</span>
                </div>
              )}
              {submittedData.expected_coins_paise && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Expected Coins</span>
                  <span className="font-semibold text-green-600">
                    Up to ₹{(submittedData.expected_coins_paise / 100).toLocaleString('en-IN')}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => router.push('/rewards')}
              className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition text-sm"
            >
              Back to Rewards
            </button>
            <button
              onClick={() => {
                setStatus('idle');
                setSubmittedData(null);
                setForm({ hotelId: '', stayDate: '', checkoutDate: '', receiptUrl: '', notes: '' });
              }}
              className="flex-1 border border-gray-200 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-50 transition text-sm"
            >
              Register Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-gray-50 pb-10">
      {/* Top Bar */}
      <div className="bg-white px-5 pt-12 pb-4 flex items-center gap-3 border-b border-gray-100 sticky top-0 z-30">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700 text-lg">
          ←
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Register a Stay</h1>
          <p className="text-xs text-gray-400">Earn ReZ Coins for walk-in stays</p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="mx-4 mt-4 bg-purple-50 border border-purple-100 rounded-2xl p-4 flex gap-3">
        <span className="text-2xl shrink-0">🏷️</span>
        <div>
          <p className="text-sm font-semibold text-purple-800">How it works</p>
          <p className="text-xs text-purple-600 mt-0.5">
            Stayed at a partner hotel without booking through our app? Upload your receipt and earn ReZ Coins after verification (24–48 hrs).
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="px-4 mt-5 space-y-4">
        {/* Hotel Select */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Hotel <span className="text-red-500">*</span>
          </label>
          {hotelsLoading ? (
            <div className="w-full border border-gray-200 rounded-xl px-4 py-3 bg-gray-50 text-sm text-gray-400">
              Loading hotels...
            </div>
          ) : hotels.length > 0 ? (
            <select
              name="hotelId"
              value={form.hotelId}
              onChange={handleChange}
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
            >
              <option value="">Select a hotel</option>
              {hotels.map((h: any) => (
                <option key={h.hotelId} value={h.hotelId}>
                  {h.name} — {h.address || h.city}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              name="hotelId"
              value={form.hotelId}
              onChange={handleChange}
              placeholder="Enter hotel ID or name"
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          )}
        </div>

        {/* Stay Date */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Check-in Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            name="stayDate"
            value={form.stayDate}
            onChange={handleChange}
            required
            max={new Date().toISOString().split('T')[0]}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
          />
        </div>

        {/* Checkout Date */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Check-out Date</label>
          <input
            type="date"
            name="checkoutDate"
            value={form.checkoutDate}
            onChange={handleChange}
            min={form.stayDate || undefined}
            max={new Date().toISOString().split('T')[0]}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
          />
        </div>

        {/* Receipt URL */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Receipt URL <span className="text-red-500">*</span>
          </label>
          <input
            type="url"
            name="receiptUrl"
            value={form.receiptUrl}
            onChange={handleChange}
            placeholder="https://drive.google.com/... or any image URL"
            required
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <p className="text-xs text-gray-400 mt-1">
            Upload your receipt to Google Drive, Dropbox, or any cloud storage and paste the link here.
          </p>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Notes (optional)</label>
          <textarea
            name="notes"
            value={form.notes}
            onChange={handleChange}
            placeholder="Any additional information..."
            rows={2}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
          />
        </div>

        {/* Error */}
        {status === 'error' && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={status === 'submitting' || !form.hotelId || !form.stayDate || !form.receiptUrl}
          className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-base hover:bg-blue-700 disabled:opacity-50 transition shadow-lg"
        >
          {status === 'submitting' ? 'Submitting...' : 'Submit Stay Registration'}
        </button>

        <p className="text-xs text-gray-400 text-center">
          Coins will be credited after manual verification within 24–48 hours.
        </p>
      </form>
    </div>
  );
}

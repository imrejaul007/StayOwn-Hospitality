'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import { hotelsApi, walletApi, billPayApi, formatINR } from '@/lib/api';

interface Hotel {
  hotelId: string;
  name: string;
  starRating: number;
  category: string;
  address: string;
}

export default function BillPayPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Hotel[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null);
  const [billAmount, setBillAmount] = useState('');
  const [stayDate, setStayDate] = useState(new Date().toISOString().split('T')[0]);
  const [otaBurn, setOtaBurn] = useState(0);
  const [rezBurn, setRezBurn] = useState(0);
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const billPaise = Math.round(parseFloat(billAmount || '0') * 100);
  const otaMaxBurn = Math.floor(billPaise * 0.10);
  const rezMaxBurn = Math.floor(billPaise * 0.05);
  const pgAmount = billPaise - otaBurn - rezBurn;
  const otaEarnPreview = Math.floor(billPaise * 0.02);
  const rezEarnPreview = Math.floor(billPaise * 0.04);

  async function handleSearch(q: string) {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfter = new Date(); dayAfter.setDate(dayAfter.getDate() + 2);
      const data = await hotelsApi.search('Bangalore', tomorrow.toISOString().split('T')[0], dayAfter.toISOString().split('T')[0], 1, 1);
      setSearchResults((data.results || []).filter((h: any) => h.name.toLowerCase().includes(q.toLowerCase())));
    } catch { setSearchResults([]); }
    finally { setSearching(false); }
  }

  function selectHotel(hotel: Hotel) {
    setSelectedHotel(hotel);
    setStep(2);
    walletApi.get().then(setWallet).catch(() => {});
  }

  function proceedToCoins() {
    if (!billAmount || parseFloat(billAmount) < 1) { setError('Enter a valid amount'); return; }
    setError('');
    if (wallet && (wallet.ota_coin_balance_paise > 0 || wallet.rez_coin_balance_paise > 0)) {
      setStep(3);
    } else {
      setStep(4);
    }
  }

  async function handlePay() {
    if (!selectedHotel) return;

    const isDev =
      process.env.NEXT_PUBLIC_DEV_MODE === 'true' ||
      process.env.NODE_ENV === 'development';

    if (!isDev) {
      setError('Bill pay is not yet configured for production. Please contact support.');
      return;
    }

    setLoading(true); setError('');
    try {
      const initRes = await billPayApi.initiate({
        hotel_id: selectedHotel.hotelId,
        bill_amount_paise: billPaise,
        ota_coin_burn_paise: otaBurn,
        rez_coin_burn_paise: rezBurn,
        stay_date: stayDate,
      });

      // Dev mode only — production path returns early above
      const confirmRes = await billPayApi.confirm({
        payment_id: initRes.payment_id,
        razorpay_payment_id: `pay_dev_${Date.now()}`,
        razorpay_signature: 'dev_signature',
      });

      router.push(`/bill-pay/confirmed?hotel=${encodeURIComponent(selectedHotel.name)}&bill=${billPaise}&paid=${pgAmount}&otaEarned=${confirmRes.ota_coin_earned_paise || otaEarnPreview}&rezEarned=${confirmRes.rez_coin_earned_paise || rezEarnPreview}&ref=${confirmRes.payment_ref || ''}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-emerald-600 to-teal-700 px-5 pt-10 pb-6 rounded-b-3xl">
        <button onClick={() => step > 1 ? setStep(step - 1) : router.back()} className="text-white/80 text-sm mb-3">← Back</button>
        <h1 className="text-2xl font-bold text-white">Pay Hotel Bill</h1>
        <p className="text-emerald-200 text-sm mt-1">Earn coins on any hotel stay</p>
        {/* Progress */}
        <div className="flex gap-1.5 mt-4">
          {[1,2,3,4].map((s) => (
            <div key={s} className={`flex-1 h-1 rounded-full ${step >= s ? 'bg-white' : 'bg-white/20'}`} />
          ))}
        </div>
      </div>

      <div className="px-4 mt-5">
        {error && <div className="bg-red-50 text-red-700 px-4 py-2 rounded-xl text-sm mb-4">{error}</div>}

        {/* STEP 1: Find Hotel */}
        {step === 1 && (
          <div>
            <h2 className="font-bold text-gray-900 mb-3">Find your hotel</h2>
            <input type="text" value={searchQuery} onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search hotel name..." className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none" />

            {searching && <p className="text-sm text-gray-400 mt-3 text-center">Searching...</p>}

            <div className="mt-3 space-y-2">
              {searchResults.map((hotel) => (
                <button key={hotel.hotelId} onClick={() => selectHotel(hotel)}
                  className="w-full text-left bg-white rounded-xl border border-gray-100 p-4 hover:border-emerald-300 transition">
                  <p className="font-semibold text-gray-900">{hotel.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{'★'.repeat(hotel.starRating || 0)} · {hotel.category} · {hotel.address}</p>
                </button>
              ))}
            </div>

            {searchQuery.length === 0 && (
              <div className="text-center py-10">
                <span className="text-4xl">🏨</span>
                <p className="text-gray-400 mt-3">Search for the hotel where you're staying</p>
                <p className="text-xs text-gray-300 mt-1">You'll earn 2% Travel Coins + 4% ReZ Coins on the bill</p>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Enter Amount */}
        {step === 2 && selectedHotel && (
          <div>
            <div className="bg-white rounded-xl border p-4 mb-4">
              <p className="font-semibold text-gray-900">{selectedHotel.name}</p>
              <p className="text-xs text-gray-400">{'★'.repeat(selectedHotel.starRating || 0)} · {selectedHotel.address}</p>
            </div>

            <h2 className="font-bold text-gray-900 mb-3">Enter bill amount</h2>
            <div className="relative">
              <span className="absolute left-4 top-3.5 text-lg text-gray-400">₹</span>
              <input type="number" value={billAmount} onChange={(e) => setBillAmount(e.target.value)}
                placeholder="0" className="w-full pl-10 pr-4 py-3 text-2xl font-bold border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none" />
            </div>

            <div className="mt-3">
              <label className="text-xs text-gray-500 block mb-1">Stay date</label>
              <div className="flex gap-2">
                {['Today', 'Yesterday'].map((label, i) => {
                  const d = new Date(); if (i === 1) d.setDate(d.getDate() - 1);
                  const val = d.toISOString().split('T')[0];
                  return (
                    <button key={label} onClick={() => setStayDate(val)}
                      className={`px-4 py-2 rounded-lg text-xs font-medium ${stayDate === val ? 'bg-emerald-600 text-white' : 'bg-white border text-gray-600'}`}>
                      {label}
                    </button>
                  );
                })}
                <input type="date" value={stayDate} onChange={(e) => setStayDate(e.target.value)}
                  className="flex-1 px-3 py-2 border rounded-lg text-xs" />
              </div>
            </div>

            {billPaise > 0 && (
              <div className="mt-4 bg-emerald-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-emerald-700 mb-1">You'll earn:</p>
                <p className="text-sm text-emerald-800">🟡 {formatINR(otaEarnPreview)} Travel Coins (2%)</p>
                <p className="text-sm text-emerald-800">🔵 {formatINR(rezEarnPreview)} ReZ Coins (4%)</p>
              </div>
            )}

            <button onClick={proceedToCoins} disabled={!billAmount || parseFloat(billAmount) < 1}
              className="w-full mt-5 bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50 transition">
              Continue
            </button>
          </div>
        )}

        {/* STEP 3: Apply Coins */}
        {step === 3 && wallet && (
          <div>
            <h2 className="font-bold text-gray-900 mb-3">Apply rewards (optional)</h2>

            <div className="bg-white rounded-xl border p-4 mb-3">
              <p className="text-sm font-semibold text-gray-700 mb-2">🟡 Travel Coins</p>
              <p className="text-xs text-gray-400">Available: {formatINR(wallet.ota_coin_balance_paise || 0)} · Max: {formatINR(otaMaxBurn)} (10% cap)</p>
              <input type="range" min={0} max={Math.min(wallet.ota_coin_balance_paise || 0, otaMaxBurn)} value={otaBurn}
                onChange={(e) => setOtaBurn(parseInt(e.target.value))} className="w-full mt-2 accent-emerald-600" />
              <p className="text-right text-sm font-bold text-emerald-700">-{formatINR(otaBurn)}</p>
            </div>

            <div className="bg-white rounded-xl border p-4 mb-3">
              <p className="text-sm font-semibold text-gray-700 mb-2">🔵 ReZ Coins</p>
              <p className="text-xs text-gray-400">Available: {formatINR(wallet.rez_coin_balance_paise || 0)} · Max: {formatINR(rezMaxBurn)} (5% cap)</p>
              <input type="range" min={0} max={Math.min(wallet.rez_coin_balance_paise || 0, rezMaxBurn)} value={rezBurn}
                onChange={(e) => setRezBurn(parseInt(e.target.value))} className="w-full mt-2 accent-emerald-600" />
              <p className="text-right text-sm font-bold text-emerald-700">-{formatINR(rezBurn)}</p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mt-4">
              <div className="flex justify-between text-sm"><span className="text-gray-500">Bill total</span><span className="font-medium">{formatINR(billPaise)}</span></div>
              {otaBurn > 0 && <div className="flex justify-between text-sm mt-1"><span className="text-gray-500">Travel Coins</span><span className="text-emerald-600 font-medium">-{formatINR(otaBurn)}</span></div>}
              {rezBurn > 0 && <div className="flex justify-between text-sm mt-1"><span className="text-gray-500">ReZ Coins</span><span className="text-emerald-600 font-medium">-{formatINR(rezBurn)}</span></div>}
              <div className="border-t mt-2 pt-2 flex justify-between"><span className="font-bold text-gray-900">You pay</span><span className="text-xl font-bold text-emerald-700">{formatINR(pgAmount)}</span></div>
            </div>

            <button onClick={() => setStep(4)} className="w-full mt-5 bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition">
              Continue to Pay
            </button>
            <button onClick={() => { setOtaBurn(0); setRezBurn(0); setStep(4); }} className="w-full mt-2 text-emerald-600 text-sm hover:underline">Skip — pay full amount</button>
          </div>
        )}

        {/* STEP 4: Pay */}
        {step === 4 && selectedHotel && (
          <div>
            <h2 className="font-bold text-gray-900 mb-3">Confirm payment</h2>

            <div className="bg-white rounded-xl border p-5">
              <p className="font-semibold text-gray-900">{selectedHotel.name}</p>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Hotel bill</span><span className="font-medium">{formatINR(billPaise)}</span></div>
                {(otaBurn + rezBurn) > 0 && <div className="flex justify-between"><span className="text-gray-500">Coins applied</span><span className="text-emerald-600 font-medium">-{formatINR(otaBurn + rezBurn)}</span></div>}
                <div className="border-t pt-2 flex justify-between"><span className="font-bold">Amount to pay</span><span className="text-xl font-bold text-emerald-700">{formatINR(pgAmount)}</span></div>
              </div>
            </div>

            <div className="bg-emerald-50 rounded-xl p-4 mt-4">
              <p className="text-xs font-semibold text-emerald-700">After payment you'll earn:</p>
              <p className="text-sm text-emerald-800 mt-1">🟡 {formatINR(otaEarnPreview)} Travel Coins + 🔵 {formatINR(rezEarnPreview)} ReZ Coins</p>
            </div>

            <button onClick={handlePay} disabled={loading}
              className="w-full mt-5 bg-green-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-green-700 disabled:opacity-50 transition shadow-lg shadow-green-600/30">
              {loading ? 'Processing...' : `Pay ${formatINR(pgAmount)}`}
            </button>
            <p className="text-[10px] text-gray-400 text-center mt-2">Payment processed securely via Razorpay</p>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

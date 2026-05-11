'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authApi, setSessionCookie } from '@/lib/api';

const REZ_AUTH_URL = process.env.NEXT_PUBLIC_REZ_AUTH_URL || 'https://rez-auth-service.onrender.com';
const REZ_CLIENT_ID = process.env.NEXT_PUBLIC_REZ_OAUTH_CLIENT_ID || 'stay-owen';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://hotel-ota.vercel.app';

function initiateOAuth2(redirectTo = '/home') {
  const state = btoa(JSON.stringify({ redirectTo, ts: Date.now() }));
  const callbackUrl = `${APP_URL}/api/auth/callback`;
  const authUrl = `${REZ_AUTH_URL}/oauth/authorize?` +
    new URLSearchParams({
      client_id: REZ_CLIENT_ID,
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: 'profile wallet:read bookings',
      state,
    }).toString();
  window.location.href = authUrl;
}

export default function LandingPage() {
  const router = useRouter();
  const [showLogin, setShowLogin] = useState(false);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpRef, setOtpRef] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // If already logged in (cookie present), redirect
    if (document.cookie.includes('ota_session=')) router.push('/home');
  }, []);

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await authApi.sendOtp(phone);
      setOtpRef(res.otp_ref);
      if (res.dev_otp) setOtp(res.dev_otp);
      setStep('otp');
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await authApi.verifyOtp(phone, otp, otpRef);
      setSessionCookie(res.access_token);
      if (res.user) localStorage.setItem('ota_user', JSON.stringify(res.user));
      router.push('/home');
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-white">

      {/* ═══════════ NAV ═══════════ */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div>
            <span className="text-xl font-black text-blue-700">StayOwn</span>
            <span className="text-[9px] text-gray-400 ml-1 uppercase tracking-wider">by Hotels, for Travellers</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="#how" className="text-sm text-gray-600 hover:text-gray-900 hidden md:block">How It Works</Link>
            <Link href="#hotels" className="text-sm text-gray-600 hover:text-gray-900 hidden md:block">Hotels</Link>
            <button onClick={() => setShowLogin(true)}
              className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition">
              Login / Sign Up
            </button>
          </div>
        </div>
      </nav>

      {/* ═══════════ HERO ═══════════ */}
      <section className="relative pt-16 overflow-hidden">
        <div className="bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-800 min-h-[520px] flex items-center">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />
          <div className="max-w-6xl mx-auto px-4 py-16 relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="inline-block px-3 py-1 bg-white/20 rounded-full text-white text-xs font-medium mb-4">
                🚀 India's First Hotel-Owned OTA
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-white leading-tight">
                Book Hotels at<br />
                <span className="text-blue-200">Real Prices.</span><br />
                Earn Every Stay.
              </h1>
              <p className="text-blue-200 mt-4 text-lg max-w-lg">
                Hotels on StayOwn pay only 5% commission — not 18%. Those savings become your rewards. 6% back as Travel Coins on every booking.
              </p>
              <div className="flex gap-3 mt-8">
                <button onClick={() => setShowLogin(true)}
                  className="px-8 py-3.5 bg-white text-blue-700 rounded-xl font-bold hover:bg-blue-50 transition shadow-xl text-base">
                  Start Booking →
                </button>
                <Link href="#how" className="px-6 py-3.5 border-2 border-white/30 text-white rounded-xl font-semibold hover:bg-white/10 transition text-base">
                  How It Works
                </Link>
              </div>
              <div className="flex items-center gap-6 mt-8">
                <div><p className="text-2xl font-bold text-white">30+</p><p className="text-blue-200 text-xs">Hotels</p></div>
                <div className="w-px h-8 bg-blue-400/30" />
                <div><p className="text-2xl font-bold text-white">4,800+</p><p className="text-blue-200 text-xs">Travellers</p></div>
                <div className="w-px h-8 bg-blue-400/30" />
                <div><p className="text-2xl font-bold text-white">₹1.2Cr</p><p className="text-blue-200 text-xs">GMV</p></div>
              </div>
            </div>

            {/* Quick Search Card */}
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm mx-auto md:mx-0">
              <h3 className="font-bold text-gray-900 mb-4">Find your perfect stay</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">City</label>
                  <div className="px-3 py-2.5 bg-gray-50 rounded-lg flex items-center gap-2">
                    <span>📍</span><span className="font-semibold text-gray-900 text-sm">Bangalore</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Check-in</label>
                    <input type="date" className="w-full px-3 py-2.5 bg-gray-50 rounded-lg text-sm border-0" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Check-out</label>
                    <input type="date" className="w-full px-3 py-2.5 bg-gray-50 rounded-lg text-sm border-0" />
                  </div>
                </div>
                <button onClick={() => setShowLogin(true)}
                  className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition">
                  Search Hotels
                </button>
              </div>
              <p className="text-[10px] text-gray-400 text-center mt-3">Free cancellation on most bookings</p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ TRUST BADGES ═══════════ */}
      <section className="py-12 bg-gray-50">
        <div className="max-w-5xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: '💰', n: '5%', sub: 'Commission only', desc: 'vs 18-22% on other OTAs' },
            { icon: '🪙', n: '6%', sub: 'Cashback in coins', desc: 'On every single booking' },
            { icon: '🏛️', n: '25%', sub: 'Hotel ownership', desc: 'Hotels earn equity stake' },
            { icon: '⚡', n: 'T+1', sub: 'Hotel settlement', desc: 'Next-day payouts' },
          ].map((b) => (
            <div key={b.sub} className="bg-white rounded-xl p-5 text-center shadow-sm hover:shadow-md transition">
              <span className="text-3xl">{b.icon}</span>
              <p className="text-2xl font-black text-blue-700 mt-2">{b.n}</p>
              <p className="text-sm font-bold text-gray-900 mt-1">{b.sub}</p>
              <p className="text-xs text-gray-500 mt-0.5">{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════ HOW IT WORKS ═══════════ */}
      <section id="how" className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">How StayOwn Works</h2>
          <p className="text-gray-500 mb-10">Three steps to better hotel bookings</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: '01', icon: '🔍', title: 'Search & Compare', desc: 'Browse 30+ Bangalore hotels with real-time availability and transparent pricing.' },
              { step: '02', icon: '💳', title: 'Book & Earn', desc: 'Pay securely. Earn 6% Travel Coins + 4% ReZ Coins instantly on every booking.' },
              { step: '03', icon: '🎁', title: 'Save & Repeat', desc: 'Use coins on future stays. Up to 35% off with Gold tier. Hotels earn equity too.' },
            ].map((s) => (
              <div key={s.step}>
                <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">{s.icon}</span>
                </div>
                <p className="text-blue-600 font-bold text-xs mb-2">STEP {s.step}</p>
                <h4 className="font-bold text-gray-900 text-lg">{s.title}</h4>
                <p className="text-sm text-gray-500 mt-2 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ FOR HOTELS CTA ═══════════ */}
      <section className="py-16 bg-gradient-to-r from-indigo-600 to-purple-700">
        <div className="max-w-4xl mx-auto px-4 text-center text-white">
          <h2 className="text-2xl font-bold">Are you a Hotel Owner?</h2>
          <p className="text-indigo-200 mt-2 max-w-lg mx-auto">Join StayOwn and earn equity in the platform. 5% commission, T+1 settlement, ownership units every month.</p>
          <div className="flex justify-center gap-4 mt-6">
            <Link href={process.env.NEXT_PUBLIC_HOTEL_PANEL_URL || 'https://hotel-ota-admin.vercel.app'} className="px-6 py-3 bg-white text-indigo-700 rounded-xl font-bold hover:bg-indigo-50 transition">
              Hotel Partner Portal →
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════ FOOTER ═══════════ */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
            <div>
              <h5 className="font-bold text-white mb-3">StayOwn</h5>
              <p className="text-xs leading-relaxed">India's first hotel-owned OTA. Better prices, real rewards, shared ownership.</p>
            </div>
            <div><h5 className="font-bold text-white mb-3">Product</h5><p>How It Works</p><p>For Hotels</p><p>For Corporates</p></div>
            <div><h5 className="font-bold text-white mb-3">Support</h5><p>Help Center</p><p>Contact</p><p>FAQ</p></div>
            <div><h5 className="font-bold text-white mb-3">Legal</h5><p>Terms</p><p>Privacy</p><p>Cookies</p></div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-6 text-xs text-center text-gray-500">
            © 2024 StayOwn. All rights reserved. Made with ❤️ in Bangalore.
          </div>
        </div>
      </footer>

      {/* ═══════════ LOGIN MODAL ═══════════ */}
      {showLogin && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4" onClick={() => { setShowLogin(false); setStep('phone'); setError(''); }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-xl font-bold text-gray-900">{step === 'phone' ? 'Login / Sign Up' : 'Enter OTP'}</h3>
              <button onClick={() => { setShowLogin(false); setStep('phone'); setError(''); }} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
            </div>

            {error && <div className="bg-red-50 text-red-700 px-3 py-2 rounded-lg text-sm mb-3">{error}</div>}

            {step === 'phone' ? (
              <>
                {/* Continue with REZ option */}
                <button
                  onClick={() => initiateOAuth2()}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition mb-4"
                >
                  {/* REZ icon */}
                  <svg className="w-5 h-5 text-indigo-600 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
                  </svg>
                  Continue with REZ
                </button>

                <div className="relative flex items-center justify-center mb-4">
                  <div className="border-t border-gray-200 w-full" />
                  <span className="absolute bg-white px-3 text-xs text-gray-400">or</span>
                </div>

                <form onSubmit={handleSendOtp}>
                <label className="text-xs font-medium text-gray-500 block mb-1">Phone Number</label>
                <div className="flex border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500">
                  <span className="px-3 py-3 bg-gray-50 text-gray-500 text-sm border-r">+91</span>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9876543210" maxLength={10}
                    className="flex-1 px-3 py-3 text-base focus:outline-none" required />
                </div>
                <button type="submit" disabled={loading || phone.length !== 10}
                  className="w-full mt-4 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition">
                  {loading ? 'Sending...' : 'Send OTP'}
                </button>
              </form>
              </>
            ) : (
              <form onSubmit={handleVerify}>
                <p className="text-sm text-gray-500 mb-3">Code sent to +91 {phone}</p>
                <input type="text" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="000000" maxLength={6}
                  className="w-full px-4 py-3 border rounded-xl text-lg tracking-[0.5em] text-center focus:ring-2 focus:ring-blue-500 focus:outline-none" required />
                <button type="submit" disabled={loading || otp.length !== 6}
                  className="w-full mt-4 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition">
                  {loading ? 'Verifying...' : 'Verify & Login'}
                </button>
                <button type="button" onClick={() => { setStep('phone'); setOtp(''); }} className="w-full mt-2 text-blue-600 text-sm hover:underline">Change number</button>
              </form>
            )}

            <p className="text-[10px] text-gray-400 text-center mt-4">By continuing, you agree to our Terms & Privacy Policy</p>
          </div>
        </div>
      )}
    </div>
  );
}

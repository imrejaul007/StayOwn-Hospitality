'use client';

import { useState, useEffect, Suspense } from 'react';
import { authApi, setSessionCookie } from '@/lib/api';
import { useRouter, useSearchParams } from 'next/navigation';

const REZ_AUTH_URL = process.env.NEXT_PUBLIC_REZ_AUTH_URL || 'https://rez-auth-service.onrender.com';
const REZ_CLIENT_ID = process.env.NEXT_PUBLIC_REZ_OAUTH_CLIENT_ID || 'hotel-panel';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://hotel-panel.vercel.app';
const SCOPES = ['profile', 'merchant'];

function buildRezAuthorizeUrl(state?: string): string {
  const params = new URLSearchParams({
    client_id: REZ_CLIENT_ID,
    redirect_uri: `${APP_URL}/api/auth/callback`,
    response_type: 'code',
    scope: SCOPES.join(' '),
  });
  if (state) params.set('state', state);
  return `${REZ_AUTH_URL}/oauth/authorize?${params.toString()}`;
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpRef, setOtpRef] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const oauthError = searchParams.get('oauth_error');
    if (oauthError) {
      const messages: Record<string, string> = {
        access_denied: 'Sign-in was cancelled.',
        token_exchange_failed: 'Failed to complete sign-in.',
        callback_error: 'An error occurred during sign-in.',
        sso_failed: 'Failed to link your REZ account.',
      };
      setError(messages[oauthError] || 'Sign-in failed.');
    }
  }, [searchParams]);

  const handleReZLogin = () => {
    const state = Buffer.from(JSON.stringify({ redirectTo: '/dashboard' })).toString('base64');
    window.location.href = buildRezAuthorizeUrl(state);
  };

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await authApi.sendOtp(phone);
      setOtpRef(res.otp_ref);
      if (res.dev_otp) setOtp(res.dev_otp);
      setStep('otp');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await authApi.verifyOtp(phone, otp, otpRef);
      setSessionCookie(res.access_token);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('hotel_id', res.hotel_id);
      }
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Hotel Panel</h1>
          <p className="text-gray-500 mt-2">Sign in to manage your property</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {step === 'phone' ? (
          <>
            <button
              type="button"
              onClick={handleReZLogin}
              className="w-full flex items-center justify-center gap-3 px-6 py-3 mb-6
                bg-gradient-to-r from-purple-600 to-indigo-600
                text-white font-semibold rounded-lg
                hover:shadow-lg hover:scale-[1.01] active:scale-[0.99]
                transition-all duration-200"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
              </svg>
              Continue with ReZ
            </button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-500">or sign in with phone</span>
              </div>
            </div>

            <form onSubmit={handleSendOtp}>
            <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="9876543210"
              maxLength={10}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
              required
            />
            <button
              type="submit"
              disabled={loading || phone.length !== 10}
              className="w-full mt-4 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
          </form>
          </>
        ) : (
          <form onSubmit={handleVerifyOtp}>
            <p className="text-sm text-gray-500 mb-4">OTP sent to +91 {phone}</p>
            <label className="block text-sm font-medium text-gray-700 mb-2">Enter OTP</label>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="000000"
              maxLength={6}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg tracking-widest text-center"
              required
            />
            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full mt-4 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {loading ? 'Verifying...' : 'Verify & Login'}
            </button>
            <button
              type="button"
              onClick={() => { setStep('phone'); setOtp(''); }}
              className="w-full mt-2 text-blue-600 text-sm hover:underline"
            >
              Change phone number
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded mb-4" />
            <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto mb-8" />
            <div className="h-12 bg-gray-200 rounded mb-4" />
            <div className="h-12 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';
import { Step1HotelInfo } from '@/components/onboarding/Step1HotelInfo';
import { Step2Rooms } from '@/components/onboarding/Step2Rooms';
import { Step3Services } from '@/components/onboarding/Step3Services';
import { Step4Staff } from '@/components/onboarding/Step4Staff';
import { Step5Complete } from '@/components/onboarding/Step5Complete';
import { onboardingApi, OnboardingSession } from '@/lib/onboarding/api';

const TOTAL_STEPS = 5;

interface StoredSession {
  step: number;
  data: Partial<OnboardingSession>;
}

function OnboardingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [currentStep, setCurrentStep] = useState(1);
  const [session, setSession] = useState<OnboardingSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('hotel_onboarding_session');
    if (stored) {
      try {
        const parsed: StoredSession = JSON.parse(stored);
        setCurrentStep(parsed.step || 1);
        if (parsed.data) {
          setSession(parsed.data as OnboardingSession);
        }
      } catch {
        // Invalid stored data, start fresh
      }
    }
    setLoading(false);
  }, []);

  const saveSession = (step: number, data: Partial<OnboardingSession>) => {
    const toStore: StoredSession = { step, data: { ...session, ...data } as OnboardingSession };
    localStorage.setItem('hotel_onboarding_session', JSON.stringify(toStore));
    setSession({ ...session, ...data } as OnboardingSession);
  };

  const handleStartOnboarding = async () => {
    if (!token) {
      setError('Invalid onboarding link. Please request a new invitation.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await onboardingApi.start(token);
      setSession(response.session);
      setCurrentStep(1);
      saveSession(1, response.session);
    } catch (err: any) {
      setError(err.message || 'Failed to start onboarding');
    } finally {
      setLoading(false);
    }
  };

  const handleStep1Complete = async (data: Partial<OnboardingSession>) => {
    if (!session?.sessionId) { setError('Session expired.'); return; }
    setLoading(true); setError('');
    try {
      const response = await onboardingApi.saveStep1(session.sessionId, data);
      setSession(response.session); setCurrentStep(2); saveSession(2, response.session);
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  const handleStep2Complete = async (data: Partial<OnboardingSession>) => {
    if (!session?.sessionId) { setError('Session expired.'); return; }
    setLoading(true); setError('');
    try {
      const response = await onboardingApi.saveStep2(session.sessionId, data);
      setSession(response.session); setCurrentStep(3); saveSession(3, response.session);
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  const handleStep3Complete = async (data: Partial<OnboardingSession>) => {
    if (!session?.sessionId) { setError('Session expired.'); return; }
    setLoading(true); setError('');
    try {
      const response = await onboardingApi.saveStep3(session.sessionId, data);
      setSession(response.session); setCurrentStep(4); saveSession(4, response.session);
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  const handleStep4Complete = async (data: Partial<OnboardingSession>) => {
    if (!session?.sessionId) { setError('Session expired.'); return; }
    setLoading(true); setError('');
    try {
      const response = await onboardingApi.saveStep4(session.sessionId, data);
      setSession(response.session); setCurrentStep(5); saveSession(5, response.session);
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  const handleComplete = async () => {
    if (!session?.sessionId) { setError('Session expired.'); return; }
    setLoading(true); setError('');
    try {
      await onboardingApi.complete(session.sessionId);
      localStorage.removeItem('hotel_onboarding_session');
      router.push('/dashboard?onboarding=complete');
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  const handleGoToDashboard = () => {
    localStorage.removeItem('hotel_onboarding_session');
    router.push('/dashboard');
  };

  const handleDownloadQRCodes = () => {
    if (!session?.rooms) return;
    const qrData = session.rooms.map(room => ({ roomId: room.roomId, roomNumber: room.roomNumber, qrCode: room.qrCode, printUrl: room.printUrl }));
    const blob = new Blob([JSON.stringify(qrData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${session.hotelName?.replace(/\s+/g, '-').toLowerCase()}-qr-codes.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading && !session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading onboarding...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <header className="bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <span className="text-xl font-black text-blue-700">StayOwn</span>
            <span className="text-[9px] text-gray-400 ml-1 uppercase tracking-wider">Hotel Partner Setup</span>
          </div>
          {session && currentStep > 0 && currentStep < 5 && (
            <button onClick={() => { localStorage.removeItem('hotel_onboarding_session'); router.push('/'); }} className="text-sm text-gray-500 hover:text-gray-700">Exit Setup</button>
          )}
        </div>
      </header>

      {session && currentStep > 0 && currentStep < 5 && (
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <OnboardingProgress currentStep={currentStep} totalSteps={TOTAL_STEPS} />
          </div>
        </div>
      )}

      {error && (
        <div className="max-w-4xl mx-auto px-4 pt-4">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
            <div className="flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => setError('')} className="text-red-500 hover:text-red-700">Dismiss</button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-4xl mx-auto px-4 py-8">
        {!token && !session && (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6"><span className="text-4xl">🏨</span></div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Welcome to StayOwn Hotel Setup</h1>
            <p className="text-gray-600 max-w-md mx-auto mb-8">To get started, please use the onboarding invitation link sent to your email.</p>
            <p className="text-sm text-gray-500">Didnt receive an email? <a href="mailto:partners@stayown.com" className="text-blue-600 hover:underline">Contact support</a></p>
          </div>
        )}

        {token && !session && (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6"><span className="text-4xl">🚀</span></div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Ready to Get Started?</h1>
            <p className="text-gray-600 max-w-md mx-auto mb-8">Set up your hotel on StayOwn in less than 5 minutes.</p>
            <button onClick={handleStartOnboarding} disabled={loading} className="px-8 py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 disabled:opacity-50 transition shadow-lg">
              {loading ? 'Starting...' : 'Start Hotel Setup'}
            </button>
          </div>
        )}

        {session && currentStep === 1 && <Step1HotelInfo initialData={session} onComplete={handleStep1Complete} loading={loading} />}
        {session && currentStep === 2 && <Step2Rooms initialData={session} onComplete={handleStep2Complete} onBack={() => setCurrentStep(1)} loading={loading} />}
        {session && currentStep === 3 && <Step3Services initialData={session} onComplete={handleStep3Complete} onBack={() => setCurrentStep(2)} loading={loading} />}
        {session && currentStep === 4 && <Step4Staff initialData={session} onComplete={handleStep4Complete} onBack={() => setCurrentStep(3)} loading={loading} />}
        {session && currentStep === 5 && <Step5Complete session={session} onDownloadQRCodes={handleDownloadQRCodes} onGoToDashboard={handleGoToDashboard} />}
      </main>

      <footer className="mt-auto py-8 text-center text-sm text-gray-400">
        <p>Need help? <a href="mailto:partners@stayown.com" className="text-blue-600 hover:underline">Contact Support</a></p>
      </footer>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <OnboardingPageContent />
    </Suspense>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { OnboardingSession } from '@/lib/onboarding/api';

interface Step5CompleteProps {
  session: Partial<OnboardingSession>;
  onDownloadQRCodes: () => void;
  onGoToDashboard: () => void;
}

export function Step5Complete({ session, onDownloadQRCodes, onGoToDashboard }: Step5CompleteProps) {
  const [showConfetti, setShowConfetti] = useState(true);
  const [currentMessage, setCurrentMessage] = useState(0);

  const successMessages = [
    'Your hotel is ready to welcome guests!',
    'QR codes have been generated for all rooms.',
    'Your team will receive login instructions soon.',
    'You can customize everything from your dashboard.',
  ];

  useEffect(() => {
    // Rotate success messages
    const interval = setInterval(() => {
      setCurrentMessage((prev) => (prev + 1) % successMessages.length);
    }, 3000);

    // Stop confetti after 5 seconds
    const confettiTimer = setTimeout(() => {
      setShowConfetti(false);
    }, 5000);

    return () => {
      clearInterval(interval);
      clearTimeout(confettiTimer);
    };
  }, []);

  const roomCount = session.rooms?.length || 0;
  const enabledServices = session.services
    ? Object.entries(session.services).filter(([, enabled]) => enabled).length
    : 0;
  const staffInvites = session.staffInvites?.length || 0;

  return (
    <div className="max-w-2xl mx-auto text-center">
      {/* Confetti Animation */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
          {Array.from({ length: 50 }, (_, i) => (
            <div
              key={i}
              className="absolute animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`,
                backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'][
                  Math.floor(Math.random() * 5)
                ],
              }}
            />
          ))}
        </div>
      )}

      {/* Success Animation */}
      <div className="relative mb-8">
        <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-xl animate-bounce">
          <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        {/* Animated ring */}
        <div className="absolute inset-0 w-24 h-24 mx-auto animate-ping opacity-20">
          <div className="w-full h-full rounded-full border-4 border-green-400" />
        </div>
      </div>

      {/* Heading */}
      <h1 className="text-3xl font-bold text-gray-900 mb-2">
        Congratulations!
      </h1>
      <p className="text-xl text-gray-600 mb-4">
        {session.hotelName} is all set up!
      </p>

      {/* Rotating Success Message */}
      <div className="h-8 mb-8">
        <p className="text-gray-500 transition-opacity duration-500">
          {successMessages[currentMessage]}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100">
          <div className="text-3xl mb-2">🏨</div>
          <p className="text-2xl font-bold text-gray-900">{roomCount}</p>
          <p className="text-sm text-gray-500">Rooms</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100">
          <div className="text-3xl mb-2">✨</div>
          <p className="text-2xl font-bold text-gray-900">{enabledServices}</p>
          <p className="text-sm text-gray-500">Services</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100">
          <div className="text-3xl mb-2">👥</div>
          <p className="text-2xl font-bold text-gray-900">{staffInvites}</p>
          <p className="text-sm text-gray-500">Invites Sent</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100">
          <div className="text-3xl mb-2">📱</div>
          <p className="text-2xl font-bold text-gray-900">{roomCount}</p>
          <p className="text-sm text-gray-500">QR Codes</p>
        </div>
      </div>

      {/* QR Codes Download */}
      {roomCount > 0 && (
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-2xl p-6 mb-8 border border-indigo-100">
          <div className="flex items-center justify-between">
            <div className="text-left">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                QR Codes Ready!
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Download {roomCount} QR codes to print and place in your rooms
              </p>
            </div>
            <button
              onClick={onDownloadQRCodes}
              className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition shadow-md flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download
            </button>
          </div>
        </div>
      )}

      {/* Share via WhatsApp */}
      <div className="mb-8">
        <button
          onClick={() => {
            const message = encodeURIComponent(
              `Check out our hotel ${session.hotelName} on StayOwn! Book directly and earn Travel Coins on every stay.`
            );
            window.open(`https://wa.me/?text=${message}`, '_blank');
          }}
          className="px-6 py-3 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600 transition shadow-md inline-flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          Share on WhatsApp
        </button>
      </div>

      {/* Dashboard Button */}
      <div className="space-y-4">
        <button
          onClick={onGoToDashboard}
          className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition shadow-lg flex items-center justify-center gap-2"
        >
          Go to Dashboard
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>

        <p className="text-gray-400 text-sm">
          Your hotel will be live within 24 hours after verification
        </p>
      </div>

      {/* Next Steps */}
      <div className="mt-12 text-left bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
        <h3 className="font-bold text-gray-900 mb-4">What's next?</h3>
        <div className="space-y-3">
          {[
            { icon: '📧', text: 'Check your email for login credentials', done: true },
            { icon: '🖨️', text: 'Print and place QR codes in your rooms', done: false },
            { icon: '⚙️', text: 'Customize service pricing in your dashboard', done: false },
            { icon: '📱', text: 'Test the guest experience with a test booking', done: false },
          ].map((step, index) => (
            <div key={index} className="flex items-center gap-3">
              <span className="text-xl">{step.icon}</span>
              <span className={`flex-1 ${step.done ? 'text-gray-600' : 'text-gray-900'}`}>
                {step.text}
              </span>
              {step.done && (
                <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Confetti Keyframes */}
      <style jsx global>{`
        @keyframes confetti {
          0% {
            transform: translateY(-100vh) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .animate-confetti {
          position: absolute;
          width: 10px;
          height: 10px;
          border-radius: 2px;
          animation: confetti 3s ease-in-out forwards;
        }
      `}</style>
    </div>
  );
}

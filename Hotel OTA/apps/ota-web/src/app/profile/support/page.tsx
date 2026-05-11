'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChatWidget } from '@/components/ChatWidget';

interface FaqItem {
  question: string;
  answer: string;
}

const faqs: FaqItem[] = [
  {
    question: 'How do I earn OTA Coins?',
    answer:
      'You earn OTA Coins (Travel Coins) on every hotel booking through our app. The earn rate depends on your membership tier: Basic 2%, Silver 3%, Gold 5%, Platinum 8%. Coins are credited after checkout.',
  },
  {
    question: 'What are ReZ Coins?',
    answer:
      'ReZ Coins are loyalty coins you earn by registering walk-in stays, writing reviews, and referring friends. They can be used to get discounts on future bookings, just like OTA Coins.',
  },
  {
    question: 'How do I cancel a booking?',
    answer:
      'Go to My Trips, tap on the booking you want to cancel, and tap "Cancel Booking". Select a reason and confirm. Cancellation charges may apply based on hotel policy.',
  },
  {
    question: 'When will my coins expire?',
    answer:
      'OTA Coins are valid for 12 months from the date they are earned. ReZ Coins are valid for 6 months. You can check expiry dates in your Rewards History.',
  },
  {
    question: 'How do I use my coins to pay?',
    answer:
      'During checkout, you will see an option to apply your available coins. The coins will be deducted from your balance and reduce the amount you pay via your card or UPI.',
  },
  {
    question: 'What is the membership tier system?',
    answer:
      'We have 4 tiers: Basic, Silver, Gold, and Platinum. Your tier is based on your total bookings and activity. Higher tiers earn more coins per booking and unlock exclusive perks like room upgrades and priority support.',
  },
  {
    question: 'Can I transfer coins to another account?',
    answer:
      'No, coins are non-transferable and can only be used by the account that earned them. This is to prevent fraud and ensure fair use.',
  },
  {
    question: 'How do I register a walk-in stay?',
    answer:
      'Go to Rewards > Register a Stay. Select the hotel, enter your stay dates, and upload a link to your hotel receipt (invoice). Our team will verify within 24–48 hours and credit your ReZ Coins.',
  },
  {
    question: 'I did not receive an OTP. What should I do?',
    answer:
      'Wait 30 seconds and try again. Make sure you have network connectivity. If the problem persists, contact our support team via chat or call.',
  },
  {
    question: 'How do I update my profile information?',
    answer:
      'Go to Profile > Edit Profile. You can update your name, email, and profile photo URL. Your phone number is linked to your account and cannot be changed.',
  },
];

export default function SupportPage() {
  const router = useRouter();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  // For demo purposes - in production, these would come from auth context
  const hotelId = 'hotel-ota-demo';
  const userId = 'user-demo-123';

  function toggle(idx: number) {
    setOpenIndex((prev) => (prev === idx ? null : idx));
  }

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-gray-50 pb-10">
      {/* Top Bar */}
      <div className="bg-white px-5 pt-12 pb-4 flex items-center gap-3 border-b border-gray-100 sticky top-0 z-30">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700 text-lg">
          ←
        </button>
        <h1 className="text-lg font-bold text-gray-900">Help &amp; Support</h1>
      </div>

      {/* Contact Options */}
      <div className="mx-4 mt-5 grid grid-cols-2 gap-3">
        <a
          href="tel:+918001234567"
          className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col items-center gap-2 hover:shadow-sm transition"
        >
          <span className="text-3xl">📞</span>
          <p className="text-sm font-semibold text-gray-800">Call Us</p>
          <p className="text-xs text-gray-400 text-center">+91 800-123-4567</p>
          <p className="text-[10px] text-gray-300">Mon–Sat, 9am–9pm</p>
        </a>
        <a
          href="mailto:support@hotelota.in"
          className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-col items-center gap-2 hover:shadow-sm transition"
        >
          <span className="text-3xl">✉️</span>
          <p className="text-sm font-semibold text-gray-800">Email Us</p>
          <p className="text-xs text-gray-400 text-center">support@hotelota.in</p>
          <p className="text-[10px] text-gray-300">Response in 2–4 hrs</p>
        </a>
      </div>

      {/* Live Chat Banner */}
      <div className="mx-4 mt-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-4 flex items-center gap-3">
        <span className="text-3xl">💬</span>
        <div className="flex-1">
          <p className="text-white font-semibold text-sm">Live Chat Support</p>
          <p className="text-blue-200 text-xs mt-0.5">Get instant help from our team</p>
        </div>
        <button onClick={() => document.getElementById('chat-trigger')?.click()} className="shrink-0 bg-white text-blue-600 text-xs font-bold px-4 py-2 rounded-xl hover:bg-blue-50 transition">
          Chat Now
        </button>
      </div>

      {/* FAQ */}
      <div className="mx-4 mt-5">
        <h2 className="text-base font-bold text-gray-900 mb-3">Frequently Asked Questions</h2>
        <div className="space-y-2">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
            >
              <button
                onClick={() => toggle(idx)}
                className="w-full flex items-start justify-between px-5 py-4 text-left gap-3"
              >
                <span className="text-sm font-semibold text-gray-800 flex-1">{faq.question}</span>
                <span
                  className={`shrink-0 text-gray-400 transition-transform duration-200 ${
                    openIndex === idx ? 'rotate-180' : ''
                  }`}
                >
                  ▾
                </span>
              </button>
              {openIndex === idx && (
                <div className="px-5 pb-4 text-sm text-gray-600 leading-relaxed border-t border-gray-50">
                  <div className="pt-3">{faq.answer}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* App Info */}
      <div className="mx-4 mt-6 bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="font-bold text-gray-900 mb-3">App Information</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">App Version</span>
            <span className="text-gray-700 font-medium">1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">API Environment</span>
            <span className="text-gray-700 font-medium">Production</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Support Hours</span>
            <span className="text-gray-700 font-medium">9am – 9pm IST</span>
          </div>
        </div>
      </div>

      {/* AI Chat Widget */}
      <ChatWidget hotelId={hotelId} userId={userId} />
    </div>
  );
}

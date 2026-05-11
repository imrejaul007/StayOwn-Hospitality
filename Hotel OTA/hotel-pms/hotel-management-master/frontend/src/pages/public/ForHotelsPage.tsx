import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Hotel, CheckCircle, ArrowRight, BarChart3, Coins, Globe,
  Smartphone, Shield, Database, Zap, Users, Clock, Star,
  Building2, Layers, RefreshCw, HeadphonesIcon, Gift,
} from 'lucide-react';
import { withErrorBoundary } from '../../components/ErrorBoundary';

function ForHotelsPage() {
  useEffect(() => {
    document.title = 'REZ Hotels — For Hotels & Property Owners';
  }, []);

  const whatYouGet = [
    {
      icon: Globe,
      title: 'OTA Listing',
      desc: 'Your hotel is listed on REZ Hotels — visible to all REZ app users and web visitors. Real-time availability from your PMS.',
      color: 'from-blue-500 to-indigo-600',
    },
    {
      icon: Database,
      title: 'Full Hotel PMS',
      desc: 'Front desk, housekeeping, billing, inventory, staff management, maintenance, and reporting — all in one system.',
      color: 'from-green-500 to-emerald-600',
    },
    {
      icon: Coins,
      title: 'Hotel Brand Coin Program',
      desc: 'Launch your own loyalty coin — e.g. "Pentouz Points". Set earn % and max burn %. REZ handles the ledger.',
      color: 'from-yellow-400 to-amber-500',
    },
    {
      icon: Smartphone,
      title: 'Merchant Dashboard',
      desc: 'Manage your OTA listing, view bookings, track coin liability, and monitor revenue from the REZ Merchant app.',
      color: 'from-purple-500 to-violet-600',
    },
    {
      icon: BarChart3,
      title: 'Analytics & Reports',
      desc: 'Occupancy trends, revenue by room type, coin earn/burn stats, channel performance — all in one dashboard.',
      color: 'from-rose-500 to-pink-600',
    },
    {
      icon: Users,
      title: 'Guest Profile Access',
      desc: 'When a REZ user books via SSO, you get their profile (name, preferences, history) — without managing their identity.',
      color: 'from-cyan-500 to-teal-600',
    },
  ];

  const pmsModules = [
    'Front Desk & Check-In / Check-Out',
    'Room Management & Housekeeping',
    'Rate & Revenue Management',
    'Billing & Invoicing',
    'Staff Scheduling & Task Management',
    'Maintenance & Incident Tracking',
    'Restaurant / POS Integration',
    'Inventory & Supply Chain',
    'Digital Keys & Guest App',
    'Channel Manager (OTA sync)',
    'Travel Agent Portal',
    'Multi-Property Management',
  ];

  const onboardingSteps = [
    {
      step: '01',
      title: 'Apply & Verify',
      desc: 'Submit your hotel details via the REZ Merchant app or contact form. The REZ Admin team verifies your property and legal documents.',
    },
    {
      step: '02',
      title: 'PMS Setup',
      desc: 'Get access to the Hotel PMS. Configure rooms, room types, rates, amenities, and policies. Takes about 1–2 days.',
    },
    {
      step: '03',
      title: 'OTA Listing Goes Live',
      desc: 'Your hotel appears on REZ Hotels. Inventory is live-synced from PMS automatically via the inventory sync worker.',
    },
    {
      step: '04',
      title: 'Launch Brand Coin Program',
      desc: 'Optionally enable your hotel\'s loyalty coin. Set the earn rate (e.g. 5% of booking value) and max burn cap (e.g. 20%).',
    },
    {
      step: '05',
      title: 'Start Receiving Bookings',
      desc: 'Guests book through REZ Hotels. You receive instant hold/confirm webhooks in PMS. Staff manages check-in from the PMS front desk.',
    },
  ];

  const coinConfig = [
    { label: 'Program name', example: '"Pentouz Points", "GrandStay Coins"', icon: Gift },
    { label: 'Earn rate', example: '3–10% of booking value in coins', icon: Coins },
    { label: 'Max burn cap', example: 'Up to 20–30% of future booking', icon: Zap },
    { label: 'Expiry', example: '12 months from last earn', icon: Clock },
    { label: 'Toggle on/off', example: 'Enable or pause the program any time', icon: RefreshCw },
  ];

  const faq = [
    { q: 'Do I pay per booking or a monthly fee?', a: 'REZ Hotels charges a commission per confirmed booking. There\'s no monthly subscription for the OTA listing. PMS licensing is a separate flat fee.' },
    { q: 'Can I use my own PMS and just list on REZ Hotels OTA?', a: 'Currently REZ Hotels requires the REZ PMS for inventory sync. OTA-only listing without PMS integration is on the roadmap.' },
    { q: 'Who handles customer support for guest complaints?', a: 'First-line support is through the REZ Hotels platform (REZ team). Hotel staff handle on-property issues via PMS.' },
    { q: 'Can I run my brand coin program independently?', a: 'No — the hotel brand coin program runs through the REZ loyalty engine. This ensures secure ledger management and fraud protection.' },
    { q: 'What happens to my data if I leave the platform?', a: 'You keep your PMS data. Booking history and guest profiles are exportable. Coin balances are settled before offboarding.' },
  ];

  return (
    <div className="min-h-screen bg-white">

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative py-24 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 right-10 w-80 h-80 bg-yellow-500 rounded-full blur-3xl" />
          <div className="absolute bottom-10 left-10 w-96 h-96 bg-blue-500 rounded-full blur-3xl" />
        </div>
        <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-2 mb-6">
            <Hotel className="h-4 w-4 text-yellow-400" />
            <span className="text-white text-sm">For Hotels & Property Owners</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-6 leading-tight">
            List your hotel on REZ.<br />
            <span className="bg-gradient-to-r from-yellow-400 to-amber-300 bg-clip-text text-transparent">
              Get a full PMS free with it.
            </span>
          </h1>
          <p className="text-lg text-blue-200 max-w-2xl mx-auto mb-10">
            One onboarding gives you: OTA listing, property management system, brand loyalty coins, merchant dashboard, and access to millions of REZ app users.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/contact">
              <button className="inline-flex items-center gap-2 bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-black font-bold px-8 py-4 rounded-xl transition-all duration-200 shadow-xl text-lg">
                Apply to Join
                <ArrowRight className="h-5 w-5" />
              </button>
            </Link>
            <Link to="/about">
              <button className="inline-flex items-center gap-2 bg-white/10 border border-white/30 text-white hover:bg-white/20 font-semibold px-8 py-4 rounded-xl transition-all duration-200">
                How it works
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── What You Get ─────────────────────────────────────────────── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">Everything in One Package</h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">No piecing together separate tools. REZ Hotels is the whole stack.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {whatYouGet.map((item) => (
              <div
                key={item.title}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${item.color} flex items-center justify-center mb-4`}>
                  <item.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PMS Module List ──────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">What the PMS Covers</h2>
            <p className="text-gray-500 text-lg">Enterprise-grade hotel operations — no extra modules to buy</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pmsModules.map((mod) => (
              <div
                key={mod}
                className="flex items-center gap-3 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3"
              >
                <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                <span className="text-gray-700 text-sm font-medium">{mod}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Onboarding Steps ─────────────────────────────────────────── */}
      <section className="py-20 bg-gradient-to-br from-blue-950 via-slate-900 to-blue-950 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-72 h-72 bg-blue-500 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-indigo-500 rounded-full blur-3xl" />
        </div>
        <div className="max-w-4xl mx-auto px-4 relative z-10">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">Onboarding in 5 Steps</h2>
            <p className="text-blue-300 text-lg">From application to live booking — typically 3–5 business days</p>
          </div>
          <div className="space-y-6">
            {onboardingSteps.map((step, i) => (
              <div key={step.step} className="flex gap-6 items-start">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-yellow-400/20 border border-yellow-400/30 flex items-center justify-center">
                  <span className="text-yellow-400 font-black text-lg">{step.step}</span>
                </div>
                <div className="flex-1 pb-6 border-b border-white/10 last:border-0">
                  <h3 className="font-bold text-white mb-1">{step.title}</h3>
                  <p className="text-blue-300 text-sm leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Brand Coin Config ────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-full px-4 py-2 mb-4">
              <Coins className="h-4 w-4 text-yellow-600" />
              <span className="text-yellow-700 text-sm font-medium">Hotel Brand Coin Program</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">Your Own Loyalty Coin</h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">
              Hotels on REZ can launch a branded loyalty coin to drive repeat stays — all managed through the REZ loyalty engine.
            </p>
          </div>
          <div className="bg-gradient-to-br from-yellow-50 to-amber-50 border-2 border-yellow-200 rounded-2xl p-8">
            <div className="space-y-4">
              {coinConfig.map((item) => (
                <div key={item.label} className="flex items-center gap-4 bg-white rounded-xl p-4 shadow-sm">
                  <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center flex-shrink-0">
                    <item.icon className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-800 text-sm">{item.label}</div>
                    <div className="text-gray-500 text-sm">{item.example}</div>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-center text-yellow-700 text-sm mt-6">
              Coin liability is tracked by REZ Admin. Hotels fund their own brand coin rewards program.
            </p>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-3">
            {faq.map((item) => (
              <details
                key={item.q}
                className="group bg-white border border-gray-200 rounded-2xl p-6 cursor-pointer hover:border-blue-300 transition-colors"
              >
                <summary className="flex items-center justify-between font-semibold text-gray-800 list-none">
                  {item.q}
                  <ArrowRight className="h-5 w-5 text-gray-400 group-open:rotate-90 transition-transform duration-200 flex-shrink-0 ml-4" />
                </summary>
                <p className="mt-3 text-gray-600 leading-relaxed text-sm">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────── */}
      <section className="py-16 bg-gradient-to-r from-blue-600 to-indigo-700">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <Building2 className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-white mb-4">Ready to list your hotel?</h2>
          <p className="text-blue-100 text-lg mb-8">
            Contact the REZ Hotels team and we'll get your property onboarded within the week.
          </p>
          <Link to="/contact">
            <button className="inline-flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-black font-bold px-10 py-4 rounded-xl transition-all duration-200 shadow-xl text-lg">
              Get in Touch
              <ArrowRight className="h-5 w-5" />
            </button>
          </Link>
        </div>
      </section>

    </div>
  );
}

export default withErrorBoundary(ForHotelsPage);

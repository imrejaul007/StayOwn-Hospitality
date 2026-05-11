import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2, Globe, Coins, Smartphone, Shield, Zap,
  ArrowRight, CheckCircle, Users, BarChart3, Hotel,
  Layers, RefreshCw, Star, Cpu, Database, GitBranch,
} from 'lucide-react';
import { withErrorBoundary } from '../../components/ErrorBoundary';

function AboutPage() {
  useEffect(() => {
    document.title = 'About REZ Hotels — Platform Overview';
  }, []);

  const ecosystem = [
    {
      name: 'REZ Consumer App',
      role: 'Guest Identity & Wallet',
      desc: 'The REZ app is the guest\'s primary identity. OTP login, REZ coin wallet, and profile sync to Hotel OTA via secure SSO — no new account needed.',
      icon: Smartphone,
      color: 'from-blue-500 to-indigo-600',
      tag: 'SSO Provider',
    },
    {
      name: 'REZ Hotels (OTA)',
      role: 'Booking Platform',
      desc: 'The public-facing hotel marketplace. Guests search, compare, and book rooms. Inventory is live-synced from each hotel\'s PMS. Coins are earned and burned here.',
      icon: Globe,
      color: 'from-yellow-400 to-amber-500',
      tag: 'You are here',
    },
    {
      name: 'Hotel PMS',
      role: 'Property Management',
      desc: 'Each partner hotel runs the REZ Hotel PMS for real-time room management, front desk, housekeeping, billing, and inventory. PMS pushes availability to OTA automatically.',
      icon: Database,
      color: 'from-green-500 to-emerald-600',
      tag: 'Live inventory source',
    },
    {
      name: 'REZ Merchant App',
      role: 'Hotel Partner Dashboard',
      desc: 'Hotel owners and managers use the REZ Merchant app to manage their OTA listing, view bookings, configure brand coin programs, and track performance.',
      icon: BarChart3,
      color: 'from-purple-500 to-violet-600',
      tag: 'Hotel side',
    },
    {
      name: 'REZ Admin',
      role: 'Platform Operator',
      desc: 'The REZ Admin dashboard gives platform operators full visibility: hotel onboarding, coin liability across all properties, fraud monitoring, and revenue analytics.',
      icon: Shield,
      color: 'from-rose-500 to-pink-600',
      tag: 'Operations',
    },
  ];

  const coinSystem = [
    {
      name: 'OTA Coins',
      scope: 'Platform-wide',
      earn: 'Earned on every booking at any hotel on the platform',
      burn: 'Redeemable on any future booking across all hotels',
      color: 'border-blue-500 bg-blue-50',
      badge: 'bg-blue-500',
    },
    {
      name: 'REZ Coins',
      scope: 'REZ Ecosystem',
      earn: 'Earned in the REZ consumer app across merchants, offers, and activities',
      burn: 'Synced to Hotel OTA wallet — apply at hotel checkout for discounts',
      color: 'border-yellow-500 bg-yellow-50',
      badge: 'bg-yellow-500',
    },
    {
      name: 'Hotel Brand Coins',
      scope: 'Per-hotel',
      earn: 'Earned when staying at a specific hotel — e.g. "Pentouz Points" at The Pentouz',
      burn: 'Only redeemable at that specific hotel — drives guest loyalty and repeat stays',
      color: 'border-green-500 bg-green-50',
      badge: 'bg-green-500',
    },
  ];

  const pmsIntegration = [
    { icon: RefreshCw, title: 'Real-Time Inventory Sync', desc: 'PMS pushes room availability via BullMQ worker every few minutes. No overbookings.' },
    { icon: Zap, title: 'Hold & Confirm Flow', desc: 'Booking hold locks inventory in PMS for 15 minutes. Confirm converts it to a real booking and triggers coin earn.' },
    { icon: GitBranch, title: 'Webhook Notifications', desc: 'Check-in, check-out, cancellation, and modification events flow from PMS to OTA in real time.' },
    { icon: Cpu, title: 'Coin Lifecycle in PMS', desc: 'PMS staff can view guest coin balance, apply burns at front desk, and see brand coin history.' },
    { icon: Layers, title: 'Multi-Property Support', desc: 'One PMS deployment can manage multiple hotel properties under a group with shared staff and analytics.' },
    { icon: Database, title: 'Audit Trail', desc: 'Every booking, coin transaction, and inventory change is logged with full audit history in both OTA and PMS.' },
  ];

  const ownership = [
    { q: 'Who owns REZ Hotels?', a: 'REZ Hotels is operated by REZ — the same company behind the REZ consumer app, REZ Merchant platform, and partner network. It is not a standalone OTA; it is the hotel vertical of the REZ ecosystem.' },
    { q: 'Who owns each hotel\'s data?', a: 'Each hotel owns its own guest data, booking records, and operational data within their PMS. REZ holds platform-level booking metadata for support, fraud prevention, and coin ledger management.' },
    { q: 'Who manages coin liability?', a: 'OTA coin liability is managed by REZ centrally. Hotel brand coin liability sits with each hotel — REZ Admin tracks it for transparency but hotels fund their own reward programs.' },
    { q: 'Is the PMS managed by REZ or the hotel?', a: 'Hotels self-host or use the REZ-hosted PMS. REZ provides the software and integration; hotels own the operational configuration (rates, rooms, staff, policies).' },
  ];

  return (
    <div className="min-h-screen bg-white">

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section className="relative py-24 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-96 h-96 bg-blue-500 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-80 h-80 bg-indigo-500 rounded-full blur-3xl" />
        </div>
        <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-2 mb-6">
            <Building2 className="h-4 w-4 text-yellow-400" />
            <span className="text-white text-sm">About the Platform</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-6 leading-tight">
            REZ Hotels is not just an OTA.<br />
            <span className="bg-gradient-to-r from-yellow-400 to-amber-300 bg-clip-text text-transparent">
              It's a connected hotel ecosystem.
            </span>
          </h1>
          <p className="text-lg text-blue-200 max-w-3xl mx-auto">
            REZ Hotels connects the guest app, the hotel PMS, the merchant dashboard, and the admin platform
            into one unified system — real-time inventory, triple-layer loyalty, and a single identity for every guest.
          </p>
        </div>
      </section>

      {/* ── The 5-Platform Ecosystem ─────────────────────────────────── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">The REZ Ecosystem</h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              Five platforms. One coherent system. Here's how each piece fits together.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ecosystem.map((item) => (
              <div
                key={item.name}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${item.color} flex items-center justify-center flex-shrink-0`}>
                    <item.icon className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-gray-900">{item.name}</h3>
                      {item.tag === 'You are here' && (
                        <span className="text-xs bg-yellow-100 text-yellow-800 border border-yellow-200 px-2 py-0.5 rounded-full font-medium">
                          You are here
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 font-medium">{item.role}</p>
                  </div>
                </div>
                <p className="text-gray-600 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3-Layer Coin System ──────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-full px-4 py-2 mb-4">
              <Coins className="h-4 w-4 text-yellow-600" />
              <span className="text-yellow-700 text-sm font-medium">Triple-Layer Loyalty</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">How the Coin System Works</h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              REZ Hotels operates three types of coins simultaneously. They stack — a guest can earn all three on a single booking.
            </p>
          </div>
          <div className="space-y-4">
            {coinSystem.map((coin) => (
              <div key={coin.name} className={`rounded-2xl border-2 ${coin.color} p-6`}>
                <div className="flex items-start gap-4">
                  <span className={`${coin.badge} text-white text-xs font-bold px-3 py-1 rounded-full flex-shrink-0 mt-1`}>
                    {coin.scope}
                  </span>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 text-lg mb-2">{coin.name}</h3>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Earn</p>
                        <p className="text-gray-700 text-sm">{coin.earn}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Burn</p>
                        <p className="text-gray-700 text-sm">{coin.burn}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-gray-400 text-sm mt-6">
            Total discount cap: up to 40% of booking value via combined coin burns. Hotel brand coins are applied last.
          </p>
        </div>
      </section>

      {/* ── OTA ↔ PMS Integration ────────────────────────────────────── */}
      <section className="py-20 bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">OTA ↔ PMS Integration</h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto">
              REZ Hotels is backed by a live Property Management System — not a static room catalogue. Here's what that means in practice.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {pmsIntegration.map((item) => (
              <div
                key={item.title}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300 flex gap-4"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <item.icon className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 mb-1">{item.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Ownership & Governance ───────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">Ownership & Governance</h2>
            <p className="text-gray-500 text-lg">Clear answers on who owns what in the REZ Hotels ecosystem</p>
          </div>
          <div className="space-y-4">
            {ownership.map((item) => (
              <details
                key={item.q}
                className="group bg-gray-50 border border-gray-200 rounded-2xl p-6 cursor-pointer hover:border-blue-300 transition-colors"
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

      {/* ── CTA ──────────────────────────────────────────────────────── */}
      <section className="py-16 bg-gradient-to-r from-blue-600 to-indigo-700">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Want to join the platform?</h2>
          <p className="text-blue-100 text-lg mb-8 max-w-xl mx-auto">
            Hotels get a full PMS, OTA listing, brand coin program, and merchant dashboard — all in one onboarding.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/for-hotels">
              <button className="inline-flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-black font-bold px-8 py-3 rounded-xl transition-all duration-200 shadow-xl">
                For Hotels
                <ArrowRight className="h-5 w-5" />
              </button>
            </Link>
            <Link to="/rooms">
              <button className="inline-flex items-center gap-2 bg-white/10 border border-white/30 text-white hover:bg-white/20 font-semibold px-8 py-3 rounded-xl transition-all duration-200">
                Browse Hotels
              </button>
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}

export default withErrorBoundary(AboutPage);

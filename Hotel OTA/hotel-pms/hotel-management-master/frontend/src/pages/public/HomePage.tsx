import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Star, Shield, MapPin, Award, Sparkles, Search,
  Calendar, Users, Coins, ArrowRight, Building2,
  CheckCircle, Zap, Globe, TrendingUp, Gift,
  Smartphone, HeadphonesIcon, Clock, Hotel,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { withErrorBoundary } from '../../components/ErrorBoundary';

function HomePage() {
  const navigate = useNavigate();
  const [destination, setDestination] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState('2');

  useEffect(() => {
    document.title = 'REZ Hotels — Book Smarter, Earn Rewards';
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (destination) params.set('destination', destination);
    if (checkIn) params.set('checkIn', checkIn);
    if (checkOut) params.set('checkOut', checkOut);
    if (guests) params.set('guests', guests);
    navigate(`/rooms?${params.toString()}`);
  };

  const platformStats = [
    { value: '500+', label: 'Hotels' },
    { value: '50+', label: 'Cities' },
    { value: '2M+', label: 'Bookings' },
    { value: '4.8★', label: 'Avg Rating' },
  ];

  const categories = [
    { name: 'Luxury', desc: '5-star hotels & resorts', icon: '🏰', color: 'from-yellow-400 to-amber-500' },
    { name: 'Business', desc: 'Prime corporate locations', icon: '💼', color: 'from-blue-500 to-indigo-600' },
    { name: 'Boutique', desc: 'Unique local experiences', icon: '🌿', color: 'from-green-500 to-emerald-600' },
    { name: 'Budget', desc: 'Great value stays', icon: '💰', color: 'from-purple-500 to-violet-600' },
    { name: 'Resort', desc: 'Beach & hill getaways', icon: '🌊', color: 'from-cyan-500 to-teal-600' },
    { name: 'Heritage', desc: 'Historic & palace hotels', icon: '🕌', color: 'from-rose-500 to-pink-600' },
  ];

  const howItWorks = [
    {
      step: '01',
      title: 'Search & Compare',
      desc: 'Search across 500+ hotels. Filter by price, amenities, ratings, and REZ coin earning rates.',
      icon: Search,
      color: 'from-blue-500 to-indigo-600',
    },
    {
      step: '02',
      title: 'Book & Earn Coins',
      desc: 'Every booking earns you OTA coins and REZ coins. Use hotel brand coins for exclusive discounts at your favourite properties.',
      icon: Coins,
      color: 'from-yellow-400 to-amber-500',
    },
    {
      step: '03',
      title: 'Check In via REZ App',
      desc: 'Use your REZ identity to check in — no new accounts. Your profile, wallet, and coins sync instantly across platforms.',
      icon: Smartphone,
      color: 'from-green-500 to-emerald-600',
    },
  ];

  const coinFeatures = [
    { icon: TrendingUp, title: 'OTA Coins', desc: 'Earn on every booking across all hotels on the platform' },
    { icon: Gift, title: 'Hotel Brand Coins', desc: 'Earn property-specific coins for loyal guests at each hotel' },
    { icon: Zap, title: 'REZ Coins', desc: 'Your REZ wallet coins work here — seamlessly synced from the REZ app' },
    { icon: CheckCircle, title: 'Burn at Checkout', desc: 'Apply coins at booking to reduce your total — up to 40% off' },
  ];

  const whyRez = [
    { icon: Globe, title: 'Multi-Hotel Platform', desc: 'One platform, hundreds of hotels — not locked to a single property' },
    { icon: Shield, title: 'Verified Properties', desc: 'Every hotel is onboarded and verified through the REZ partner system' },
    { icon: HeadphonesIcon, title: '24/7 Support', desc: 'Round-the-clock support via REZ app, web, and phone' },
    { icon: Clock, title: 'Instant Confirmation', desc: 'Real-time inventory sync via PMS means no overbookings' },
    { icon: Award, title: 'Best Price Guarantee', desc: 'Find a lower price? We\'ll match it plus add bonus coins' },
    { icon: Hotel, title: 'PMS-Powered Accuracy', desc: 'Live room availability from hotel PMS — always up to date' },
  ];

  return (
    <div className="min-h-screen bg-white">

      {/* ── Hero with Search ─────────────────────────────────────────── */}
      <section className="relative min-h-[600px] flex items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              'linear-gradient(135deg, rgba(15,23,42,0.85) 0%, rgba(30,58,138,0.75) 100%), url(https://images.pexels.com/photos/1134176/pexels-photo-1134176.jpeg)',
          }}
        />
        {/* Animated orbs */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" />

        <div className="relative z-10 w-full max-w-5xl mx-auto px-4 py-20 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur border border-white/20 rounded-full px-4 py-2 mb-6">
            <Sparkles className="h-4 w-4 text-yellow-400" />
            <span className="text-white text-sm font-medium">Book hotels. Earn REZ Coins. Travel smarter.</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white mb-4 leading-tight">
            Find Your Perfect Stay <br />
            <span className="bg-gradient-to-r from-yellow-400 to-amber-300 bg-clip-text text-transparent">
              Across India
            </span>
          </h1>
          <p className="text-lg text-blue-100 mb-10 max-w-2xl mx-auto">
            500+ hotels on the REZ platform. Every booking earns coins. All managed by live PMS inventory.
          </p>

          {/* Search Bar */}
          <form
            onSubmit={handleSearch}
            className="bg-white rounded-2xl shadow-2xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 max-w-4xl mx-auto"
          >
            <div className="lg:col-span-2 flex items-center gap-2 border border-gray-200 rounded-xl px-4 py-3">
              <MapPin className="h-5 w-5 text-blue-500 flex-shrink-0" />
              <input
                type="text"
                placeholder="City or hotel name"
                value={destination}
                onChange={e => setDestination(e.target.value)}
                className="flex-1 text-sm text-gray-800 placeholder-gray-400 outline-none bg-transparent"
              />
            </div>
            <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-4 py-3">
              <Calendar className="h-5 w-5 text-blue-500 flex-shrink-0" />
              <input
                type="date"
                value={checkIn}
                onChange={e => setCheckIn(e.target.value)}
                className="flex-1 text-sm text-gray-800 outline-none bg-transparent"
                placeholder="Check-in"
              />
            </div>
            <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-4 py-3">
              <Calendar className="h-5 w-5 text-blue-500 flex-shrink-0" />
              <input
                type="date"
                value={checkOut}
                onChange={e => setCheckOut(e.target.value)}
                className="flex-1 text-sm text-gray-800 outline-none bg-transparent"
                placeholder="Check-out"
              />
            </div>
            <button
              type="submit"
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-semibold rounded-xl px-6 py-3 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <Search className="h-5 w-5" />
              Search
            </button>
          </form>
        </div>
      </section>

      {/* ── Platform Stats ────────────────────────────────────────────── */}
      <section className="bg-gradient-to-r from-blue-600 to-indigo-700 py-10">
        <div className="max-w-5xl mx-auto px-4 grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {platformStats.map((stat) => (
            <div key={stat.label}>
              <div className="text-3xl font-extrabold text-white">{stat.value}</div>
              <div className="text-blue-200 text-sm mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Hotel Categories ──────────────────────────────────────────── */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">Browse by Category</h2>
            <p className="text-gray-500 text-lg">From luxury resorts to budget stays — something for every traveller</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {categories.map((cat) => (
              <Link
                key={cat.name}
                to={`/rooms?category=${cat.name.toLowerCase()}`}
                className="group flex flex-col items-center text-center p-6 bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-gray-100"
              >
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-r ${cat.color} flex items-center justify-center text-2xl mb-3 group-hover:scale-110 transition-transform duration-300`}>
                  {cat.icon}
                </div>
                <div className="font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">{cat.name}</div>
                <div className="text-xs text-gray-400 mt-1">{cat.desc}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── REZ Coin Rewards ──────────────────────────────────────────── */}
      <section className="py-20 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-72 h-72 bg-yellow-500 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-blue-500 rounded-full blur-3xl" />
        </div>
        <div className="max-w-7xl mx-auto px-4 relative z-10">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-yellow-400/10 border border-yellow-400/30 rounded-full px-4 py-2 mb-4">
              <Coins className="h-4 w-4 text-yellow-400" />
              <span className="text-yellow-300 text-sm font-medium">REZ Coin Rewards — 3-Layer Loyalty</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">
              Every Booking Earns You More
            </h2>
            <p className="text-blue-300 text-lg max-w-2xl mx-auto">
              REZ Hotels runs a triple-loyalty system. Earn platform coins, hotel brand coins, and sync your REZ wallet — all in one booking.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {coinFeatures.map((f) => (
              <div
                key={f.title}
                className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all duration-300"
              >
                <div className="w-12 h-12 bg-yellow-400/20 rounded-xl flex items-center justify-center mb-4">
                  <f.icon className="h-6 w-6 text-yellow-400" />
                </div>
                <h3 className="font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-blue-300 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link to="/rooms">
              <button className="inline-flex items-center gap-2 bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-black font-bold px-8 py-4 rounded-xl transition-all duration-200 shadow-xl hover:shadow-2xl">
                Start Earning Coins
                <ArrowRight className="h-5 w-5" />
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">How REZ Hotels Works</h2>
            <p className="text-gray-500 text-lg">Search, book, earn, and check in — all in one connected ecosystem</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {howItWorks.map((step) => (
              <div key={step.step} className="relative text-center">
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${step.color} flex items-center justify-center mx-auto mb-6 shadow-lg`}>
                  <step.icon className="h-8 w-8 text-white" />
                </div>
                <div className="text-4xl font-black text-gray-100 absolute top-0 right-6 select-none">{step.step}</div>
                <h3 className="text-xl font-bold text-gray-800 mb-3">{step.title}</h3>
                <p className="text-gray-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why REZ Hotels ───────────────────────────────────────────── */}
      <section className="py-20 bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">Why REZ Hotels?</h2>
            <p className="text-gray-500 text-lg">Built differently — for guests who expect more than just a room</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {whyRez.map((item) => (
              <div
                key={item.title}
                className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border border-gray-100 flex gap-4"
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

      {/* ── REZ Ecosystem Banner ─────────────────────────────────────── */}
      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-8 sm:p-12 text-center relative overflow-hidden">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute -top-20 -right-20 w-64 h-64 bg-white rounded-full" />
              <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-white rounded-full" />
            </div>
            <div className="relative z-10">
              <Building2 className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Part of the REZ Ecosystem
              </h2>
              <p className="text-blue-100 text-lg max-w-2xl mx-auto mb-8">
                REZ Hotels is connected to the REZ consumer app, REZ merchant network, and hotel PMS —
                giving you a fully unified experience from search to stay to loyalty.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/rooms">
                  <button className="inline-flex items-center gap-2 bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-500 hover:to-amber-600 text-black font-bold px-8 py-3 rounded-xl transition-all duration-200 shadow-xl">
                    Browse Hotels
                    <ArrowRight className="h-5 w-5" />
                  </button>
                </Link>
                <Link to="/contact">
                  <button className="inline-flex items-center gap-2 bg-white/10 border border-white/30 text-white hover:bg-white/20 font-semibold px-8 py-3 rounded-xl transition-all duration-200">
                    List Your Hotel
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer CTA ───────────────────────────────────────────────── */}
      <section className="py-10 bg-gray-900 text-center">
        <p className="text-gray-400 text-sm">
          © {new Date().getFullYear()} REZ Hotels · Part of the REZ platform ·{' '}
          <Link to="/contact" className="text-blue-400 hover:text-blue-300">Contact Support</Link>
        </p>
      </section>

    </div>
  );
}

export default withErrorBoundary(HomePage);

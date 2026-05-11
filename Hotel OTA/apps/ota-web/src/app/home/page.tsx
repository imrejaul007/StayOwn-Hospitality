'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { hotelsApi, walletApi, formatINR } from '@/lib/api';
import BottomNav from '@/components/BottomNav';

interface Hotel {
  hotelId: string; name: string; starRating: number; category: string; address: string;
  availableRoomTypes: { ratePerNightPaise: number; totalForStayPaise: number; availableCount: number }[];
  otaCoinEarnPreviewPaise: number; rezCoinEarnPreviewPaise: number; amenities: string[];
}

export default function HomePage() {
  const router = useRouter();
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [wallet, setWallet] = useState<any>(null);
  const [checkin, setCheckin] = useState('');
  const [checkout, setCheckout] = useState('');
  const [rooms, setRooms] = useState(1);
  const [guests, setGuests] = useState(2);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date(); dayAfter.setDate(dayAfter.getDate() + 2);
    setCheckin(tomorrow.toISOString().split('T')[0]);
    setCheckout(dayAfter.toISOString().split('T')[0]);

    Promise.all([
      hotelsApi.search('Bangalore', tomorrow.toISOString().split('T')[0], dayAfter.toISOString().split('T')[0], 1, 2).catch(() => ({ results: [] })),
      walletApi.get().catch(() => null),
    ]).then(([h, w]) => { setHotels(h.results || []); setWallet(w); }).finally(() => setLoading(false));
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!checkin || !checkout) return;
    router.push(`/search?city=Bangalore&checkin=${checkin}&checkout=${checkout}&rooms=${rooms}&guests=${guests}`);
  }

  const categoryColors: Record<string, string> = {
    budget: 'from-green-400 to-emerald-600', midscale: 'from-blue-400 to-blue-700',
    upscale: 'from-amber-400 to-orange-600', boutique: 'from-purple-400 to-indigo-600',
    serviced_apartment: 'from-pink-400 to-rose-600',
  };

  return (
    <div className="min-h-screen bg-white">

      {/* ═══════ TOP BAR ═══════ */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/home" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center"><span className="text-white font-black text-sm">S</span></div>
            <span className="text-lg font-black text-gray-900">StayOwn</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/bill-pay" className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-blue-600 transition font-medium">💳 Pay Bill</Link>
            <Link href="/trips" className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-blue-600 transition font-medium">My Trips</Link>
            {wallet && (
              <Link href="/rewards" className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 rounded-full text-sm font-semibold text-amber-700 hover:bg-amber-100 transition">
                🪙 {formatINR(wallet.ota_coin_balance_paise || 0)}
              </Link>
            )}
            <Link href="/profile" className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm hover:bg-gray-200 transition">👤</Link>
          </div>
        </div>
      </div>

      {/* ═══════ HERO + SEARCH ═══════ */}
      <div className="relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-800 via-blue-700 to-indigo-900" />
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }} />

        <div className="relative z-10 max-w-6xl mx-auto px-4 pt-10 pb-20 md:pb-28">
          {/* Hero Text */}
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur rounded-full mb-5">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-white/90 text-xs font-medium">30+ hotels live in Bangalore</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-white leading-[1.1]">
              Find your perfect<br />hotel stay
            </h1>
            <p className="text-blue-200 mt-4 text-base md:text-lg max-w-lg">
              Book directly from hotels at 5% commission. Earn up to 10% back as Travel Coins on every booking.
            </p>
          </div>
        </div>
      </div>

      {/* ═══════ SEARCH WIDGET (overlapping hero) ═══════ */}
      <div className="max-w-5xl mx-auto px-4 -mt-14 relative z-20 mb-8">
        <form onSubmit={handleSearch} className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.12)] border border-gray-100">
          {/* Tab bar */}
          <div className="flex border-b border-gray-100">
            <div className="px-6 py-3 border-b-2 border-blue-600 text-sm font-bold text-blue-600">🏨 Hotels</div>
            <Link href="/bill-pay" className="px-6 py-3 text-sm font-medium text-gray-400 hover:text-gray-600 transition">💳 Pay Hotel Bill</Link>
          </div>

          <div className="p-4 md:p-5">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              {/* City */}
              <div className="md:col-span-3">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">City</label>
                <div className="flex items-center gap-2.5 px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-blue-300 transition cursor-pointer">
                  <span className="text-blue-600">📍</span>
                  <div>
                    <p className="text-sm font-bold text-gray-900">Bangalore</p>
                    <p className="text-[10px] text-gray-400">Karnataka, India</p>
                  </div>
                </div>
              </div>

              {/* Check-in */}
              <div className="md:col-span-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Check-in</label>
                <input type="date" value={checkin} onChange={(e) => setCheckin(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-semibold text-gray-900 border border-gray-100 hover:border-blue-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition" required />
              </div>

              {/* Check-out */}
              <div className="md:col-span-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Check-out</label>
                <input type="date" value={checkout} onChange={(e) => setCheckout(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-semibold text-gray-900 border border-gray-100 hover:border-blue-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition" required />
              </div>

              {/* Rooms & Guests */}
              <div className="md:col-span-3">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Rooms & Guests</label>
                <div className="flex gap-2">
                  <select value={rooms} onChange={(e) => setRooms(parseInt(e.target.value))}
                    className="flex-1 px-3 py-3 bg-gray-50 rounded-xl text-sm font-semibold text-gray-900 border border-gray-100 hover:border-blue-300 outline-none">
                    {[1,2,3,4,5].map((n) => <option key={n} value={n}>{n} Room{n>1?'s':''}</option>)}
                  </select>
                  <select value={guests} onChange={(e) => setGuests(parseInt(e.target.value))}
                    className="flex-1 px-3 py-3 bg-gray-50 rounded-xl text-sm font-semibold text-gray-900 border border-gray-100 hover:border-blue-300 outline-none">
                    {[1,2,3,4,5,6].map((n) => <option key={n} value={n}>{n} Guest{n>1?'s':''}</option>)}
                  </select>
                </div>
              </div>

              {/* Search Button */}
              <div className="md:col-span-2">
                <button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3.5 rounded-xl font-bold text-sm hover:from-blue-700 hover:to-blue-800 transition shadow-lg shadow-blue-500/25 active:scale-[0.98]">
                  Search →
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* ═══════ OFFERS / DEALS STRIP ═══════ */}
      <div className="max-w-6xl mx-auto px-4 mb-10">
        <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
          {[
            { bg: 'from-orange-500 to-red-600', tag: 'WEEKEND', title: 'Flat 20% OFF', sub: 'on weekend stays in Bangalore', cta: 'Book Now' },
            { bg: 'from-emerald-500 to-green-700', tag: 'COINS', title: '6% Cashback', sub: 'as Travel Coins on every booking', cta: 'Earn Now' },
            { bg: 'from-violet-500 to-purple-700', tag: 'NEW', title: 'Pay Hotel Bill', sub: 'Earn coins on any hotel stay', cta: 'Pay Now' },
            { bg: 'from-blue-500 to-cyan-600', tag: 'FIRST BOOKING', title: '₹200 OFF', sub: 'Use code: STAYOWN200', cta: 'Claim' },
          ].map((deal, i) => (
            <Link key={i} href={i === 2 ? '/bill-pay' : `/search?city=Bangalore&checkin=${checkin}&checkout=${checkout}`}
              className={`flex-shrink-0 w-[280px] bg-gradient-to-br ${deal.bg} rounded-2xl p-5 text-white hover:shadow-xl transition-all hover:-translate-y-0.5`}>
              <span className="text-[10px] font-black bg-white/20 px-2 py-0.5 rounded uppercase tracking-wider">{deal.tag}</span>
              <h4 className="text-lg font-black mt-2">{deal.title}</h4>
              <p className="text-white/80 text-xs mt-0.5">{deal.sub}</p>
              <p className="mt-3 text-xs font-bold underline underline-offset-2">{deal.cta} →</p>
            </Link>
          ))}
        </div>
      </div>

      {/* ═══════ QUICK ACCESS ROW ═══════ */}
      <div className="max-w-6xl mx-auto px-4 mb-10">
        <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
          {[
            { icon: '🏨', label: 'Hotels', href: `/search?city=Bangalore&checkin=${checkin}&checkout=${checkout}` },
            { icon: '💰', label: 'Budget', href: `/search?city=Bangalore&checkin=${checkin}&checkout=${checkout}&category=budget` },
            { icon: '✨', label: 'Luxury', href: `/search?city=Bangalore&checkin=${checkin}&checkout=${checkout}&category=upscale` },
            { icon: '🎨', label: 'Boutique', href: `/search?city=Bangalore&checkin=${checkin}&checkout=${checkout}&category=boutique` },
            { icon: '💳', label: 'Pay Bill', href: '/bill-pay' },
            { icon: '🏷️', label: 'Register Stay', href: '/rewards/register-stay' },
            { icon: '🪙', label: 'Rewards', href: '/rewards' },
            { icon: '❤️', label: 'Saved', href: '/saved' },
          ].map((item) => (
            <Link key={item.label} href={item.href}
              className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl hover:bg-blue-50 transition text-center group">
              <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-2xl group-hover:bg-blue-100 group-hover:scale-110 transition-all">
                {item.icon}
              </div>
              <span className="text-[11px] font-semibold text-gray-600 group-hover:text-blue-600">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* ═══════ REWARDS BANNER (logged in) ═══════ */}
      {wallet && (wallet.ota_coin_balance_paise > 0 || wallet.rez_coin_balance_paise > 0) && (
        <div className="max-w-6xl mx-auto px-4 mb-10">
          <Link href="/rewards" className="block bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 rounded-2xl p-5 text-white hover:shadow-xl transition group">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-[10px] font-bold uppercase tracking-wider">Your Reward Balance</p>
                <div className="flex items-center gap-4 mt-2">
                  <div>
                    <p className="text-2xl font-black">{formatINR(wallet.ota_coin_balance_paise || 0)}</p>
                    <p className="text-white/70 text-[10px]">Travel Coins</p>
                  </div>
                  <div className="w-px h-8 bg-white/20" />
                  <div>
                    <p className="text-2xl font-black">{formatINR(wallet.rez_coin_balance_paise || 0)}</p>
                    <p className="text-white/70 text-[10px]">ReZ Coins</p>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-4xl group-hover:scale-110 transition inline-block">🎁</span>
                <p className="text-white/80 text-xs mt-1 font-medium">Use now →</p>
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* ═══════ POPULAR HOTELS ═══════ */}
      <div className="max-w-6xl mx-auto px-4 mb-12">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-black text-gray-900">Popular Hotels in Bangalore</h2>
            <p className="text-sm text-gray-400 mt-0.5">Handpicked stays with best prices</p>
          </div>
          <Link href={`/search?city=Bangalore&checkin=${checkin}&checkout=${checkout}`} className="text-sm text-blue-600 font-semibold hover:underline whitespace-nowrap">
            View All →
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1,2,3,4].map((i) => <div key={i} className="rounded-2xl border p-4 animate-pulse"><div className="h-40 bg-gray-100 rounded-xl mb-3"/><div className="h-4 bg-gray-100 rounded w-3/4 mb-2"/><div className="h-3 bg-gray-100 rounded w-1/2"/></div>)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {hotels.slice(0, 8).map((hotel) => {
              const cheapest = hotel.availableRoomTypes?.length ? Math.min(...hotel.availableRoomTypes.map((r) => r.ratePerNightPaise)) : 0;
              return (
                <Link key={hotel.hotelId} href={`/hotel/${hotel.hotelId}?checkin=${checkin}&checkout=${checkout}&rooms=${rooms}&guests=${guests}`}
                  className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
                  {/* Hotel Image */}
                  <div className={`h-44 bg-gradient-to-br ${categoryColors[hotel.category] || 'from-gray-300 to-gray-500'} relative overflow-hidden`}>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                    {/* Badges */}
                    <div className="absolute top-3 left-3 flex gap-1.5">
                      <span className="px-2 py-0.5 bg-white/95 rounded-full text-[10px] font-bold text-gray-700 capitalize shadow-sm">{hotel.category}</span>
                      {hotel.starRating >= 4 && <span className="px-2 py-0.5 bg-amber-400 text-white rounded-full text-[10px] font-bold shadow-sm">Premium</span>}
                    </div>
                    <div className="absolute top-3 right-3">
                      <button className="w-8 h-8 bg-white/90 rounded-full flex items-center justify-center text-sm hover:bg-white transition shadow-sm">❤️</button>
                    </div>
                    {/* Earn badge */}
                    <div className="absolute bottom-3 left-3">
                      <span className="px-2.5 py-1 bg-green-500 text-white rounded-lg text-[10px] font-bold shadow-lg">
                        ✨ Earn {formatINR(hotel.otaCoinEarnPreviewPaise)}
                      </span>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-gray-900 truncate group-hover:text-blue-600 transition">{hotel.name}</h4>
                        <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                          <span className="text-amber-500">{'★'.repeat(hotel.starRating || 0)}</span>
                          <span>·</span>
                          <span className="truncate">{hotel.address}</span>
                        </p>
                      </div>
                    </div>

                    {/* Amenities */}
                    <div className="flex gap-1.5 mt-2.5 flex-wrap">
                      {hotel.amenities?.slice(0, 4).map((a) => (
                        <span key={a} className="px-2 py-0.5 bg-gray-50 text-gray-500 rounded-md text-[10px] capitalize font-medium">{a}</span>
                      ))}
                    </div>

                    {/* Price row */}
                    <div className="flex items-end justify-between mt-3 pt-3 border-t border-gray-50">
                      <div>
                        <p className="text-[10px] text-gray-400 line-through">₹{Math.round(cheapest * 1.18 / 100).toLocaleString('en-IN')}</p>
                        <p className="text-xl font-black text-gray-900">{formatINR(cheapest)}</p>
                        <p className="text-[10px] text-gray-400">per night + taxes</p>
                      </div>
                      <button className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition shadow-md shadow-blue-500/20 active:scale-95">
                        Book Now
                      </button>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* ═══════ BROWSE BY CATEGORY ═══════ */}
      <div className="bg-gray-50 py-10">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-xl font-black text-gray-900 mb-5">Explore by Property Type</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Budget Hotels', icon: '💵', sub: 'Under ₹2,000/night', cat: 'budget', color: 'from-green-500 to-emerald-600' },
              { label: 'Midscale Hotels', icon: '🏢', sub: '₹2,000 - ₹5,000', cat: 'midscale', color: 'from-blue-500 to-blue-700' },
              { label: 'Luxury Hotels', icon: '✨', sub: 'Above ₹5,000/night', cat: 'upscale', color: 'from-amber-500 to-orange-600' },
              { label: 'Boutique Stays', icon: '🎨', sub: 'Unique experiences', cat: 'boutique', color: 'from-purple-500 to-indigo-600' },
              { label: 'All Hotels', icon: '🏨', sub: `${hotels.length}+ properties`, cat: '', color: 'from-gray-600 to-gray-800' },
            ].map((c) => (
              <Link key={c.label} href={`/search?city=Bangalore&checkin=${checkin}&checkout=${checkout}&category=${c.cat}`}
                className={`bg-gradient-to-br ${c.color} rounded-2xl p-5 text-white hover:shadow-xl hover:-translate-y-0.5 transition-all group`}>
                <span className="text-3xl">{c.icon}</span>
                <h4 className="font-bold mt-2 text-sm group-hover:underline">{c.label}</h4>
                <p className="text-white/70 text-[10px] mt-0.5">{c.sub}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════ WHY STAYOWN ═══════ */}
      <div className="max-w-6xl mx-auto px-4 py-14">
        <div className="text-center mb-10">
          <h2 className="text-xl font-black text-gray-900">Why Book with StayOwn?</h2>
          <p className="text-sm text-gray-400 mt-1">We're different from every other OTA</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { icon: '💰', num: '5%', title: 'Lowest Commission', desc: 'Hotels pay only 5% commission vs 18-22% on Booking.com/MMT. Savings passed to you.' },
            { icon: '🪙', num: '10%', title: 'Earn on Every Stay', desc: '6% Travel Coins + 4% ReZ Coins. Use them as cash on your next booking.' },
            { icon: '🏛️', num: '25%', title: 'Hotels Own Us', desc: 'Hotel partners earn equity. Co-ownership = better service and lower prices.' },
            { icon: '⚡', num: 'T+1', title: 'Hotels Paid Next Day', desc: 'Happy hotels = better availability. Others take 30+ days to settle.' },
          ].map((item) => (
            <div key={item.title} className="text-center group">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-3 group-hover:bg-blue-100 group-hover:scale-110 transition-all">
                <span className="text-3xl">{item.icon}</span>
              </div>
              <p className="text-2xl font-black text-blue-600">{item.num}</p>
              <h4 className="font-bold text-gray-900 mt-1">{item.title}</h4>
              <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════ POPULAR LOCALITIES ═══════ */}
      <div className="bg-gray-50 py-10">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-xl font-black text-gray-900 mb-5">Popular Areas in Bangalore</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { name: 'Koramangala', hotels: 8, img: 'from-rose-400 to-pink-600' },
              { name: 'Indiranagar', hotels: 6, img: 'from-violet-400 to-purple-600' },
              { name: 'Whitefield', hotels: 10, img: 'from-cyan-400 to-blue-600' },
              { name: 'HSR Layout', hotels: 5, img: 'from-lime-400 to-green-600' },
              { name: 'MG Road', hotels: 7, img: 'from-amber-400 to-orange-600' },
              { name: 'Electronic City', hotels: 4, img: 'from-blue-400 to-indigo-600' },
              { name: 'Jayanagar', hotels: 3, img: 'from-teal-400 to-emerald-600' },
              { name: 'Marathahalli', hotels: 6, img: 'from-red-400 to-rose-600' },
            ].map((area) => (
              <Link key={area.name} href={`/search?city=Bangalore&checkin=${checkin}&checkout=${checkout}`}
                className={`bg-gradient-to-br ${area.img} rounded-2xl p-4 text-white relative overflow-hidden hover:shadow-xl hover:-translate-y-0.5 transition-all h-24 flex flex-col justify-end`}>
                <h4 className="font-bold text-sm">{area.name}</h4>
                <p className="text-white/70 text-[10px]">{area.hotels} hotels</p>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════ TESTIMONIALS ═══════ */}
      <div className="max-w-6xl mx-auto px-4 py-14">
        <h2 className="text-xl font-black text-gray-900 text-center mb-8">What Our Travellers Say</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { name: 'Priya S.', role: 'Frequent Traveller', text: 'Saved ₹2,400 in coins on my last 3 bookings. The cashback is real and easy to use!', stars: 5 },
            { name: 'Amit K.', role: 'Business Traveller', text: 'Direct hotel rates + instant confirmation. My company switched all Bangalore travel to StayOwn.', stars: 5 },
            { name: 'Sneha R.', role: 'Weekend Explorer', text: 'Love the bill pay feature — earned coins even on my MMT booking just by paying through StayOwn!', stars: 4 },
          ].map((review) => (
            <div key={review.name} className="bg-white border border-gray-100 rounded-2xl p-6 hover:shadow-lg transition">
              <div className="text-amber-400 text-sm mb-3">{'★'.repeat(review.stars)}{'☆'.repeat(5 - review.stars)}</div>
              <p className="text-sm text-gray-600 leading-relaxed italic">"{review.text}"</p>
              <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-50">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-sm font-bold text-blue-600">
                  {review.name.split(' ').map((n) => n[0]).join('')}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{review.name}</p>
                  <p className="text-[10px] text-gray-400">{review.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════ APP DOWNLOAD / CTA ═══════ */}
      <div className="bg-gradient-to-r from-blue-700 to-indigo-800 py-12">
        <div className="max-w-5xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-white text-center md:text-left">
            <h3 className="text-2xl font-black">Start saving on hotel stays today</h3>
            <p className="text-blue-200 mt-2">5% commission. 10% cashback. Hotels you can trust.</p>
            <div className="flex gap-3 mt-5 justify-center md:justify-start">
              <Link href={`/search?city=Bangalore&checkin=${checkin}&checkout=${checkout}`}
                className="px-8 py-3 bg-white text-blue-700 rounded-xl font-bold hover:bg-blue-50 transition shadow-xl text-sm">
                Search Hotels →
              </Link>
              <Link href="/bill-pay" className="px-6 py-3 border-2 border-white/30 text-white rounded-xl font-semibold hover:bg-white/10 transition text-sm">
                Pay Hotel Bill
              </Link>
            </div>
          </div>
          <div className="flex gap-4 items-center">
            <div className="bg-white/10 backdrop-blur rounded-2xl p-6 text-center text-white">
              <p className="text-3xl font-black">4,800+</p>
              <p className="text-blue-200 text-xs mt-1">Happy Travellers</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-2xl p-6 text-center text-white">
              <p className="text-3xl font-black">₹1.2Cr</p>
              <p className="text-blue-200 text-xs mt-1">Hotels Booked</p>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 text-sm">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center"><span className="text-white font-black text-sm">S</span></div>
                <span className="text-lg font-black text-white">StayOwn</span>
              </div>
              <p className="text-xs leading-relaxed">India's first hotel-owned OTA. Better prices, real rewards, shared ownership.</p>
            </div>
            <div><h5 className="font-bold text-white mb-3">Product</h5><div className="space-y-2"><p>Hotels</p><p>Pay Bill</p><p>Rewards</p><p>For Business</p></div></div>
            <div><h5 className="font-bold text-white mb-3">Company</h5><div className="space-y-2"><p>About</p><p>For Hotels</p><p>Careers</p><p>Blog</p></div></div>
            <div><h5 className="font-bold text-white mb-3">Support</h5><div className="space-y-2"><p>Help Center</p><p>Contact</p><p>FAQ</p><p>Safety</p></div></div>
            <div><h5 className="font-bold text-white mb-3">Legal</h5><div className="space-y-2"><p>Terms</p><p>Privacy</p><p>Cookies</p><p>Coin Terms</p></div></div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="text-xs text-gray-500">© 2024 StayOwn Technologies Pvt Ltd. All rights reserved.</p>
            <div className="flex gap-4 text-gray-500 text-sm">
              <span className="hover:text-white cursor-pointer transition">𝕏</span>
              <span className="hover:text-white cursor-pointer transition">📸</span>
              <span className="hover:text-white cursor-pointer transition">💼</span>
              <span className="hover:text-white cursor-pointer transition">▶️</span>
            </div>
          </div>
        </div>
      </footer>

      <BottomNav />
    </div>
  );
}

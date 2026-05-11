'use client';

import { useState } from 'react';
import Link from 'next/link';
import BottomNav from '@/components/BottomNav';
import { hotelsApi, formatINR } from '@/lib/api';

interface RoomType { roomTypeId: string; name: string; ratePerNightPaise: number; totalForStayPaise: number; availableCount: number; maxOccupancy: number; }
interface Hotel { hotelId: string; name: string; starRating: number; category: string; address: string; availableRoomTypes: RoomType[]; otaCoinEarnPreviewPaise: number; rezCoinEarnPreviewPaise: number; amenities: string[]; }

const AMENITY_OPTIONS = ['WiFi', 'Pool', 'Parking', 'Breakfast', 'Gym', 'AC'];

export default function SearchPage() {
  const [city, setCity] = useState('Bangalore');
  const [checkin, setCheckin] = useState('');
  const [checkout, setCheckout] = useState('');
  const [rooms, setRooms] = useState(1);
  const [guests, setGuests] = useState(2);
  const [results, setResults] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [sortBy, setSortBy] = useState('relevance');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Filter panel state
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [starFilter, setStarFilter] = useState<number[]>([]);
  const [amenityFilter, setAmenityFilter] = useState<string[]>([]);

  // Applied filters
  const [appliedPriceMin, setAppliedPriceMin] = useState<number | null>(null);
  const [appliedPriceMax, setAppliedPriceMax] = useState<number | null>(null);
  const [appliedStars, setAppliedStars] = useState<number[]>([]);
  const [appliedAmenities, setAppliedAmenities] = useState<string[]>([]);

  const hasActiveFilters = appliedPriceMin !== null || appliedPriceMax !== null || appliedStars.length > 0 || appliedAmenities.length > 0;

  async function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    if (!checkin || !checkout) return;
    setLoading(true);
    setSearchError('');
    try {
      const data = await hotelsApi.search(city, checkin, checkout, rooms, guests);
      setResults(data.results ?? []);
      setSearched(true);
    } catch (err: any) {
      setSearchError(err.message || 'Search failed. Please try again.');
      console.error(err);
    }
    finally { setLoading(false); }
  }

  function handleApplyFilters() {
    setAppliedPriceMin(priceMin ? parseInt(priceMin) * 100 : null);
    setAppliedPriceMax(priceMax ? parseInt(priceMax) * 100 : null);
    setAppliedStars([...starFilter]);
    setAppliedAmenities([...amenityFilter]);
    setFiltersOpen(false);
  }

  function handleReset() {
    setPriceMin('');
    setPriceMax('');
    setStarFilter([]);
    setAmenityFilter([]);
    setAppliedPriceMin(null);
    setAppliedPriceMax(null);
    setAppliedStars([]);
    setAppliedAmenities([]);
  }

  function toggleStar(s: number) {
    setStarFilter((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  }

  function toggleAmenity(a: string) {
    setAmenityFilter((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]);
  }

  let filtered = results;
  if (categoryFilter) filtered = filtered.filter((h) => h.category === categoryFilter);
  if (appliedStars.length > 0) filtered = filtered.filter((h) => appliedStars.includes(h.starRating));
  if (appliedAmenities.length > 0) filtered = filtered.filter((h) => appliedAmenities.every((a) => h.amenities.map((x) => x.toLowerCase()).includes(a.toLowerCase())));
  if (appliedPriceMin !== null) filtered = filtered.filter((h) => Math.min(...h.availableRoomTypes.map((r) => r.ratePerNightPaise)) >= appliedPriceMin!);
  if (appliedPriceMax !== null) filtered = filtered.filter((h) => Math.min(...h.availableRoomTypes.map((r) => r.ratePerNightPaise)) <= appliedPriceMax!);
  if (sortBy === 'price_asc') filtered = [...filtered].sort((a, b) => Math.min(...a.availableRoomTypes.map((r) => r.ratePerNightPaise)) - Math.min(...b.availableRoomTypes.map((r) => r.ratePerNightPaise)));
  if (sortBy === 'price_desc') filtered = [...filtered].sort((a, b) => Math.min(...b.availableRoomTypes.map((r) => r.ratePerNightPaise)) - Math.min(...a.availableRoomTypes.map((r) => r.ratePerNightPaise)));

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-gray-50 pb-20">
      <div className="bg-blue-600 text-white px-5 pt-10 pb-6 rounded-b-3xl">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-lg">📍</span>
            <select value={city} onChange={(e) => setCity(e.target.value)} className="bg-transparent text-white font-bold text-lg appearance-none focus:outline-none cursor-pointer">
              <option className="text-gray-900">Bangalore</option><option className="text-gray-900">Mumbai</option><option className="text-gray-900">Goa</option>
            </select>
          </div>
          <span className="text-xl">🔔</span>
        </div>
        <p className="text-blue-200 text-sm">Book hotels. Earn rewards. Own more.</p>
      </div>

      <form onSubmit={handleSearch} className="mx-4 -mt-5 bg-white rounded-2xl shadow-lg p-4 space-y-3 relative z-10">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-semibold text-gray-400 uppercase block mb-1">Check-in</label>
            <input type="date" value={checkin} onChange={(e) => setCheckin(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" required />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-400 uppercase block mb-1">Check-out</label>
            <input type="date" value={checkout} onChange={(e) => setCheckout(e.target.value)} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" required />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-semibold text-gray-400 uppercase block mb-1">Rooms</label>
            <select value={rooms} onChange={(e) => setRooms(parseInt(e.target.value))} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm">
              {[1,2,3,4,5].map((n) => <option key={n} value={n}>{n} Room{n>1?'s':''}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-gray-400 uppercase block mb-1">Guests</label>
            <select value={guests} onChange={(e) => setGuests(parseInt(e.target.value))} className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm">
              {[1,2,3,4,5,6].map((n) => <option key={n} value={n}>{n} Guest{n>1?'s':''}</option>)}
            </select>
          </div>
        </div>
        <button type="submit" disabled={loading || !checkin || !checkout} className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition">
          {loading ? 'Searching...' : 'Search Hotels'}
        </button>
      </form>

      {/* Category pills */}
      <div className="px-4 mt-5 flex gap-2 overflow-x-auto">
        {['', 'budget', 'midscale', 'upscale', 'boutique'].map((cat) => (
          <button key={cat} onClick={() => setCategoryFilter(cat)} className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${categoryFilter === cat ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}>{cat || 'All'}</button>
        ))}
      </div>

      {/* Filter toggle button */}
      <div className="px-4 mt-3 flex items-center gap-2">
        <button
          onClick={() => setFiltersOpen((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition ${filtersOpen || hasActiveFilters ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}
        >
          <span>⚙️</span>
          Filters
          {hasActiveFilters && <span className="bg-white text-blue-600 rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-black ml-0.5">{(appliedStars.length > 0 ? 1 : 0) + (appliedAmenities.length > 0 ? 1 : 0) + (appliedPriceMin !== null || appliedPriceMax !== null ? 1 : 0)}</span>}
        </button>
        {hasActiveFilters && (
          <button onClick={handleReset} className="text-xs text-red-500 font-semibold hover:underline">
            Reset
          </button>
        )}
      </div>

      {/* Collapsible filter panel */}
      {filtersOpen && (
        <div className="mx-4 mt-2 bg-white rounded-2xl border border-gray-100 p-5 space-y-5 shadow-sm">
          {/* Price range */}
          <div>
            <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">Price per Night (₹)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">Min</label>
                <input
                  type="number"
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                  placeholder="0"
                  min={0}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">Max</label>
                <input
                  type="number"
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                  placeholder="Any"
                  min={0}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Star rating */}
          <div>
            <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">Star Rating</p>
            <div className="flex gap-2 flex-wrap">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  onClick={() => toggleStar(s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                    starFilter.includes(s)
                      ? 'bg-amber-400 text-white border-amber-400'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-amber-300'
                  }`}
                >
                  {'★'.repeat(s)}
                </button>
              ))}
            </div>
          </div>

          {/* Amenities */}
          <div>
            <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">Amenities</p>
            <div className="grid grid-cols-2 gap-2">
              {AMENITY_OPTIONS.map((a) => (
                <label key={a} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={amenityFilter.includes(a)}
                    onChange={() => toggleAmenity(a)}
                    className="w-4 h-4 rounded text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{a}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={() => setFiltersOpen(false)}
              className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleApplyFilters}
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}

      {searched && (
        <div className="px-4 mt-3 flex items-center justify-between">
          <p className="text-sm text-gray-500">{filtered.length} hotels found</p>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="text-xs border rounded-lg px-2 py-1 text-gray-600">
            <option value="relevance">Recommended</option><option value="price_asc">Price: Low→High</option><option value="price_desc">Price: High→Low</option>
          </select>
        </div>
      )}

      {searchError && (
        <div className="mx-4 mt-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">{searchError}</div>
      )}

      {loading && <div className="px-4 mt-3 space-y-3">{[1,2,3].map((i) => <div key={i} className="bg-white rounded-2xl p-4 animate-pulse"><div className="h-4 bg-gray-200 rounded w-3/4 mb-2"/><div className="h-3 bg-gray-200 rounded w-1/2 mb-3"/><div className="h-3 bg-gray-200 rounded w-1/4"/></div>)}</div>}

      <div className="px-4 mt-3 space-y-3">
        {!loading && searched && filtered.length === 0 && (
          <div className="text-center py-10"><p className="text-gray-400 text-lg">No hotels found</p><p className="text-sm text-gray-400 mt-1">Try changing your dates or filters</p></div>
        )}
        {filtered.map((hotel) => {
          const cheapest = Math.min(...hotel.availableRoomTypes.map((r) => r.ratePerNightPaise));
          const minAvail = Math.min(...hotel.availableRoomTypes.map((r) => r.availableCount));
          return (
            <Link key={hotel.hotelId} href={`/hotel/${hotel.hotelId}?checkin=${checkin}&checkout=${checkout}&rooms=${rooms}&guests=${guests}`}
              className="block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition">
              <div className={`h-1.5 ${hotel.category==='upscale'?'bg-amber-400':hotel.category==='boutique'?'bg-purple-400':hotel.category==='midscale'?'bg-blue-400':'bg-green-400'}`}/>
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-gray-900 truncate">{hotel.name}</h3>
                    <p className="text-xs mt-0.5"><span className="text-amber-500">{'★'.repeat(hotel.starRating||0)}</span><span className="text-gray-400 ml-1 capitalize">· {hotel.category}</span></p>
                    <p className="text-xs text-gray-400 mt-1 truncate">{hotel.address}</p>
                  </div>
                  <div className="text-right ml-3 shrink-0">
                    <p className="text-lg font-bold text-gray-900">{formatINR(cheapest)}</p>
                    <p className="text-[10px] text-gray-400">per night</p>
                  </div>
                </div>
                <div className="flex gap-1.5 mt-3 flex-wrap">
                  {hotel.amenities.slice(0,5).map((a) => <span key={a} className="px-2 py-0.5 bg-gray-50 text-gray-500 rounded-md text-[10px] capitalize">{a}</span>)}
                </div>
                {minAvail <= 2 && <p className="text-xs text-red-500 font-semibold mt-2">Only {minAvail} room{minAvail>1?'s':''} left!</p>}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                  <span className="text-xs text-green-600 font-semibold">Earn {formatINR(hotel.otaCoinEarnPreviewPaise)} Travel Coins</span>
                  <span className="text-xs text-purple-600 font-semibold">+ {formatINR(hotel.rezCoinEarnPreviewPaise)} ReZ</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      <BottomNav />
    </div>
  );
}

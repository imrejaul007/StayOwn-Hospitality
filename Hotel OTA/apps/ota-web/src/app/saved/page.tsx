'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';
import { wishlistApi } from '@/lib/api';
import { SkeletonCard } from '@/components/SkeletonCard';

interface SavedHotel {
  hotelId: string;
  name: string;
  city: string;
  starRating: number;
  category: string;
  address?: string;
}

export default function SavedPage() {
  const router = useRouter();
  const [hotels, setHotels] = useState<SavedHotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    wishlistApi
      .list()
      .then((data) => setHotels(data.wishlists || data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleRemove(hotelId: string) {
    setRemoving(hotelId);
    try {
      await wishlistApi.remove(hotelId);
      setHotels((prev) => prev.filter((h) => h.hotelId !== hotelId));
    } catch (err: any) {
      alert(err.message || 'Failed to remove hotel');
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="max-w-lg mx-auto min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white px-5 pt-12 pb-4 border-b border-gray-100 sticky top-0 z-30">
        <h1 className="text-2xl font-bold text-gray-900">Saved Hotels</h1>
        <p className="text-sm text-gray-400 mt-0.5">Your wishlist</p>
      </div>

      <div className="px-4 py-5">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : hotels.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="text-5xl mb-4">❤️</span>
            <h3 className="text-lg font-bold text-gray-700">No saved hotels yet</h3>
            <p className="text-sm text-gray-400 mt-2 max-w-xs">
              Tap the heart icon on any hotel to save it here for later.
            </p>
            <button
              onClick={() => router.push('/search')}
              className="mt-6 bg-blue-600 text-white px-6 py-3 rounded-2xl font-semibold text-sm hover:bg-blue-700 transition"
            >
              Explore Hotels
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">
              {hotels.length} saved hotel{hotels.length !== 1 ? 's' : ''}
            </p>
            {hotels.map((hotel) => (
              <div
                key={hotel.hotelId}
                className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition"
              >
                {/* Image placeholder */}
                <div
                  className={`h-32 flex items-end px-4 pb-3 ${
                    hotel.category === 'upscale'
                      ? 'bg-gradient-to-br from-amber-400 to-orange-500'
                      : hotel.category === 'boutique'
                      ? 'bg-gradient-to-br from-purple-400 to-pink-500'
                      : hotel.category === 'midscale'
                      ? 'bg-gradient-to-br from-blue-400 to-cyan-500'
                      : 'bg-gradient-to-br from-green-400 to-teal-500'
                  }`}
                >
                  <span className="text-white text-xs font-semibold capitalize bg-black/20 px-2.5 py-1 rounded-full">
                    {hotel.category}
                  </span>
                </div>

                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 truncate">{hotel.name}</h3>
                      <p className="text-xs mt-0.5">
                        <span className="text-amber-500">{'★'.repeat(hotel.starRating || 0)}</span>
                        <span className="text-gray-300">{'★'.repeat(5 - (hotel.starRating || 0))}</span>
                        <span className="text-gray-400 ml-1">{hotel.starRating || 0}-star</span>
                      </p>
                      <p className="text-xs text-gray-400 mt-1 truncate">
                        📍 {hotel.city}{hotel.address ? ` · ${hotel.address}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemove(hotel.hotelId)}
                      disabled={removing === hotel.hotelId}
                      className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-50 transition disabled:opacity-50"
                      title="Remove from saved"
                    >
                      {removing === hotel.hotelId ? (
                        <span className="text-gray-300 text-sm">...</span>
                      ) : (
                        <span className="text-red-500 text-lg">❤️</span>
                      )}
                    </button>
                  </div>

                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => router.push(`/hotel/${hotel.hotelId}`)}
                      className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl font-semibold text-xs hover:bg-blue-700 transition"
                    >
                      View Hotel
                    </button>
                    <button
                      onClick={() => router.push(`/search`)}
                      className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl font-semibold text-xs hover:bg-gray-50 transition"
                    >
                      Check Rates
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

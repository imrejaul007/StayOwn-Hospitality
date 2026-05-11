import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Users, Wifi, Bed, Crown, Star, CheckCircle, Building2, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatIndianCurrency } from '../../utils/currency';
import { usePublicRoomCatalog } from '../../hooks/usePublicRoomCatalog';
import contactService from '../../services/contactService';
import { hotelLabel, persistPublicHotelId, resolvePublicHotelId } from '../../utils/publicBookingHotel';
import { withErrorBoundary } from '../../components/ErrorBoundary';

// Room types data - same as BookingPage (fallback when API has no rows)
const ROOM_TYPES = {
  single: {
    name: 'Single Room',
    description: 'Perfect for solo travelers with all essential amenities',
    baseRate: 2500,
    maxGuests: 1,
    icon: Bed,
    amenities: ['Free WiFi', 'AC', 'TV', 'Room Service', 'Daily Housekeeping'],
    image: 'https://images.pexels.com/photos/164595/pexels-photo-164595.jpeg?auto=compress&cs=tinysrgb&w=800',
    features: ['Queen Size Bed', 'Work Desk', 'Mini Fridge', 'Private Bathroom']
  },
  double: {
    name: 'Double Room', 
    description: 'Comfortable accommodation perfect for couples or friends',
    baseRate: 3500,
    maxGuests: 2,
    icon: Crown,
    amenities: ['Free WiFi', 'AC', 'TV', 'Mini Bar', 'Room Service', 'Daily Housekeeping'],
    image: 'https://images.pexels.com/photos/271618/pexels-photo-271618.jpeg?auto=compress&cs=tinysrgb&w=800',
    features: ['Twin/Double Beds', 'Seating Area', 'Mini Bar', 'Premium Bathroom']
  },
  suite: {
    name: 'Suite',
    description: 'Spacious luxury suite with separate living area',
    baseRate: 6500,
    maxGuests: 3,
    icon: Star,
    amenities: ['Free WiFi', 'AC', 'TV', 'Mini Bar', 'Balcony', 'Room Service', 'Kitchenette', 'Daily Housekeeping'],
    image: 'https://images.pexels.com/photos/1134176/pexels-photo-1134176.jpeg?auto=compress&cs=tinysrgb&w=800',
    features: ['Separate Living Room', 'Kitchenette', 'Balcony', 'Luxury Bathroom', 'Dining Area']
  },
  deluxe: {
    name: 'Deluxe Room',
    description: 'Premium accommodation with luxury amenities and city views', 
    baseRate: 8500,
    maxGuests: 4,
    icon: Crown,
    amenities: ['Free WiFi', 'AC', 'TV', 'Mini Bar', 'Balcony', 'Room Service', 'Jacuzzi', 'City View', 'Daily Housekeeping'],
    image: 'https://images.pexels.com/photos/1743229/pexels-photo-1743229.jpeg?auto=compress&cs=tinysrgb&w=800',
    features: ['King Size Bed', 'City View', 'Jacuzzi', 'Premium Amenities', 'Concierge Service']
  }
};

const API_IMAGES = [
  'https://images.pexels.com/photos/164595/pexels-photo-164595.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/271618/pexels-photo-271618.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/1134176/pexels-photo-1134176.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/1743229/pexels-photo-1743229.jpeg?auto=compress&cs=tinysrgb&w=800'
];

type DisplayRow = {
  slug: string;
  roomTypeId?: string;
  name: string;
  description: string;
  baseRate: number;
  maxGuests: number;
  icon: LucideIcon;
  image: string;
  features: string[];
  amenities: string[];
};

function RoomsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const hotelId = resolvePublicHotelId(searchParams);

  const { data: hotelsPayload, isLoading: hotelsLoading } = useQuery({
    queryKey: ['public-contact-hotels'],
    queryFn: () => contactService.getHotelsContact(),
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
  const hotels = hotelsPayload?.hotels ?? [];

  useEffect(() => {
    if (!hotels.length) return;
    const ids = new Set(hotels.map((h) => String(h.id)));
    if (ids.has(hotelId)) return;
    const fallback = String(hotels[0].id);
    persistPublicHotelId(fallback);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('hotelId', fallback);
        return next;
      },
      { replace: true }
    );
  }, [hotels, hotelId, setSearchParams]);

  const [filters, setFilters] = useState({
    checkIn: searchParams.get('checkIn') || '',
    checkOut: searchParams.get('checkOut') || '',
    roomType: searchParams.get('type') || '',
    guests: parseInt(searchParams.get('guests') || searchParams.get('adults') || '2'),
  });

  const isFirstHotelEffect = useRef(true);
  useEffect(() => {
    if (isFirstHotelEffect.current) {
      isFirstHotelEffect.current = false;
      return;
    }
    setFilters((prev) => ({ ...prev, roomType: '' }));
  }, [hotelId]);

  useEffect(() => {
    document.title = 'Our Rooms - The Pentouz';
  }, []);

  const { data: apiOptions, isLoading: catalogLoading } = usePublicRoomCatalog(hotelId);

  const displayRows: DisplayRow[] = useMemo(() => {
    if (apiOptions && apiOptions.length > 0) {
      return apiOptions.map((opt, i) => ({
        slug: opt.id,
        roomTypeId: opt.id,
        name: opt.name,
        description: `${opt.name} — sleeps up to ${opt.maxOccupancy} guests`,
        baseRate: opt.basePrice ?? opt.baseRate ?? 0,
        maxGuests: opt.maxOccupancy || 2,
        icon: Bed,
        image: API_IMAGES[i % API_IMAGES.length],
        features: ['Comfortable stay', 'Modern amenities', 'Daily housekeeping'],
        amenities: ['WiFi', 'AC', 'TV', 'Room Service']
      }));
    }
    return (Object.entries(ROOM_TYPES) as [keyof typeof ROOM_TYPES, typeof ROOM_TYPES['single']][]).map(
      ([slug, room]) => ({
        slug,
        roomTypeId: undefined,
        name: room.name,
        description: room.description,
        baseRate: room.baseRate,
        maxGuests: room.maxGuests,
        icon: room.icon,
        image: room.image,
        features: room.features,
        amenities: room.amenities
      })
    );
  }, [apiOptions]);

  const calculateNights = () => {
    if (!filters.checkIn || !filters.checkOut) return 0;
    const start = new Date(filters.checkIn);
    const end = new Date(filters.checkOut);
    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  };

  const nights = calculateNights();

  const handleFilterChange = (key: string, value: unknown) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleBookNow = (slug: string, roomTypeId?: string) => {
    const params = new URLSearchParams();
    params.set('hotelId', hotelId);
    if (filters.checkIn) params.set('checkIn', filters.checkIn);
    if (filters.checkOut) params.set('checkOut', filters.checkOut);
    if (filters.guests) params.set('guests', filters.guests.toString());
    if (roomTypeId) params.set('roomTypeId', roomTypeId);
    else params.set('roomType', slug);

    navigate(`/booking?${params.toString()}`);
  };

  const handlePropertyChange = (nextId: string) => {
    persistPublicHotelId(nextId);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('hotelId', nextId);
        return next;
      },
      { replace: true }
    );
  };

  const filteredRows = displayRows.filter((row) => {
    if (filters.roomType && filters.roomType !== row.slug) return false;
    if (filters.guests > row.maxGuests) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Our Room Types</h1>
          <p className="text-gray-600 mb-6">Choose from our carefully designed accommodations</p>
          
          {/* Search Filters */}
          <div className="bg-gray-50 rounded-lg p-4 sm:p-6">
            <div className="mb-4">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                <Building2 className="h-4 w-4 text-gray-500" />
                Property
              </label>
              <select
                value={hotelId}
                onChange={(e) => handlePropertyChange(e.target.value)}
                disabled={hotelsLoading}
                className="w-full max-w-xl border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
              >
                {hotels.length > 0 ? (
                  hotels.map((h) => (
                    <option key={String(h.id)} value={String(h.id)}>
                      {hotelLabel(h)}
                    </option>
                  ))
                ) : (
                  <option value={hotelId}>Default property (list unavailable)</option>
                )}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Room types and rates are for the property you select.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Check-in</label>
                <Input
                  type="date"
                  value={filters.checkIn}
                  onChange={(e) => handleFilterChange('checkIn', e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Check-out</label>
                <Input
                  type="date"
                  value={filters.checkOut}
                  onChange={(e) => handleFilterChange('checkOut', e.target.value)}
                  min={filters.checkIn || new Date().toISOString().split('T')[0]}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Guests</label>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleFilterChange('guests', Math.max(1, filters.guests - 1))}
                    disabled={filters.guests <= 1}
                  >
                    -
                  </Button>
                  <span className="w-12 text-center font-semibold">{filters.guests}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleFilterChange('guests', filters.guests + 1)}
                    disabled={filters.guests >= 4}
                  >
                    +
                  </Button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Room Type</label>
                <select
                  value={filters.roomType}
                  onChange={(e) => handleFilterChange('roomType', e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Types</option>
                  {displayRows.map((row) => (
                    <option key={row.slug} value={row.slug}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {nights > 0 && (
              <div className="mt-4 text-center">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                  <Calendar className="w-4 h-4 mr-1" />
                  {nights} Night{nights > 1 ? 's' : ''} Stay
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Room Types Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {catalogLoading && !apiOptions?.length ? (
          <div className="text-center py-12 text-gray-600">Loading room types…</div>
        ) : filteredRows.length === 0 ? (
          <div className="text-center py-12 sm:py-16">
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-4">No room types available</h2>
            <p className="text-gray-600">Try adjusting your search criteria</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            {filteredRows.map((room) => {
              const Icon = room.icon;
              const canAccommodate = filters.guests <= room.maxGuests;
              const totalPrice = nights > 0 ? room.baseRate * nights : room.baseRate;
              const isRecommended = room.name.toLowerCase().includes('double');

              return (
                <Card
                  key={room.slug}
                  className={`overflow-hidden hover:shadow-xl transition-all duration-300 ${
                    !canAccommodate ? 'opacity-60' : ''
                  } ${isRecommended ? 'ring-2 ring-blue-500' : ''}`}
                >
                  <div className="relative">
                    <img
                      src={room.image}
                      alt={room.name}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-64 object-cover"
                    />
                    {isRecommended && (
                      <div className="absolute top-4 left-4">
                        <Badge className="bg-blue-600 text-white">
                          <Star className="w-3 h-3 mr-1" />
                          Popular
                        </Badge>
                      </div>
                    )}
                    <div className="absolute top-4 right-4 bg-white bg-opacity-90 backdrop-blur-sm rounded-lg px-3 py-1">
                      <span className="text-lg font-bold text-gray-900">
                        {formatIndianCurrency(room.baseRate)}
                      </span>
                      <span className="text-sm text-gray-600">/night</span>
                    </div>
                  </div>
                  
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 gap-2">
                      <div className="flex items-center">
                        <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 mr-2" />
                        <h3 className="text-lg sm:text-xl font-bold text-gray-900">{room.name}</h3>
                      </div>
                      <Badge variant={canAccommodate ? "default" : "destructive"} className="self-start sm:self-auto">
                        Up to {room.maxGuests} Guest{room.maxGuests > 1 ? 's' : ''}
                      </Badge>
                    </div>
                    
                    <p className="text-gray-600 mb-4">{room.description}</p>

                    {/* Features */}
                    <div className="mb-4">
                      <h4 className="text-sm font-semibold text-gray-900 mb-2">Features</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-sm text-gray-600">
                        {room.features.map((feature, index) => (
                          <div key={`room-features-${index}-${feature}`} className="flex items-center">
                            <CheckCircle className="w-3 h-3 text-green-500 mr-1" />
                            <span>{feature}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Amenities */}
                    <div className="mb-6">
                      <h4 className="text-sm font-semibold text-gray-900 mb-2">Amenities</h4>
                      <div className="flex flex-wrap gap-2">
                        {room.amenities.slice(0, 6).map((amenity, index) => (
                          <span key={`-${index}-${amenity}`} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {amenity}
                          </span>
                        ))}
                        {room.amenities.length > 6 && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            +{room.amenities.length - 6} more
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Pricing */}
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        {nights > 0 ? (
                          <div>
                            <span className="text-xl sm:text-2xl font-bold text-blue-600">
                              {formatIndianCurrency(totalPrice)}
                            </span>
                            <span className="text-sm text-gray-600 ml-2">
                              for {nights} night{nights > 1 ? 's' : ''}
                            </span>
                            <div className="text-xs text-gray-500">
                              {formatIndianCurrency(room.baseRate)} per night
                            </div>
                          </div>
                        ) : (
                          <div>
                            <span className="text-xl sm:text-2xl font-bold text-gray-900">
                              {formatIndianCurrency(room.baseRate)}
                            </span>
                            <span className="text-gray-600">/night</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {!canAccommodate && (
                      <div className="mb-4 p-3 bg-red-50 rounded-md">
                        <p className="text-sm text-red-600">
                          This room can accommodate maximum {room.maxGuests} guest{room.maxGuests > 1 ? 's' : ''}. 
                          Please reduce the number of guests or choose a larger room.
                        </p>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                      <Button
                        variant="outline"
                        onClick={() =>
                          navigate(
                            `/rooms/${room.slug}?checkIn=${filters.checkIn}&checkOut=${filters.checkOut}&guests=${filters.guests}&hotelId=${hotelId}`
                          )
                        }
                        className="flex-1"
                      >
                        View Details
                      </Button>
                      <Button
                        onClick={() => handleBookNow(room.slug, room.roomTypeId)}
                        disabled={!canAccommodate}
                        className="flex-1"
                        size="lg"
                      >
                        {canAccommodate ? 'Book Now' : 'Cannot Accommodate'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Additional Information */}
      <div className="bg-white py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">Why Choose Our Rooms?</h2>
            <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto">
              Every room type is carefully designed to provide comfort, convenience, and memorable experiences
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            <div className="text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Wifi className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">Complimentary WiFi</h3>
              <p className="text-gray-600">High-speed internet access in all room types</p>
            </div>
            
            <div className="text-center">
              <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">24/7 Room Service</h3>
              <p className="text-gray-600">Round-the-clock service for your convenience</p>
            </div>
            
            <div className="text-center">
              <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">Quality Assurance</h3>
              <p className="text-gray-600">Regular quality checks and maintenance</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default withErrorBoundary(RoomsPage);

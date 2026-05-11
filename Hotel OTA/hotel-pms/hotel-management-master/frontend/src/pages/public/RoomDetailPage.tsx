import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Star,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Bed,
  Crown,
  Phone,
  Mail
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { formatIndianCurrency } from '../../utils/currency';
import { usePublicRoomCatalog } from '../../hooks/usePublicRoomCatalog';
import { resolvePublicHotelId } from '../../utils/publicBookingHotel';
import { withErrorBoundary } from '../../components/ErrorBoundary';

const API_FALLBACK_IMAGES = [
  'https://images.pexels.com/photos/164595/pexels-photo-164595.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/271618/pexels-photo-271618.jpeg?auto=compress&cs=tinysrgb&w=800',
  'https://images.pexels.com/photos/1134176/pexels-photo-1134176.jpeg?auto=compress&cs=tinysrgb&w=800'
];

function isLikelyObjectId(s: string) {
  return /^[a-f0-9]{24}$/i.test(s);
}

// Same room types data as other pages
const ROOM_TYPES = {
  single: {
    name: 'Single Room',
    description: 'Perfect for solo travelers with all essential amenities',
    longDescription: 'Our Single Rooms are thoughtfully designed for solo travelers who value comfort and functionality. Each room features modern amenities, ergonomic furniture, and a peaceful atmosphere perfect for rest and productivity.',
    baseRate: 2500,
    maxGuests: 1,
    icon: Bed,
    amenities: ['Free WiFi', 'AC', 'TV', 'Room Service', 'Daily Housekeeping'],
    images: [
      'https://images.pexels.com/photos/164595/pexels-photo-164595.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/271618/pexels-photo-271618.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/1134176/pexels-photo-1134176.jpeg?auto=compress&cs=tinysrgb&w=800'
    ],
    features: ['Queen Size Bed', 'Work Desk', 'Mini Fridge', 'Private Bathroom', 'City View', 'Reading Chair'],
    roomSize: '20 sqm',
    bedType: 'Queen Size Bed'
  },
  double: {
    name: 'Double Room', 
    description: 'Comfortable accommodation perfect for couples or friends',
    longDescription: 'Our Double Rooms provide ample space and comfort for two guests. Whether you\'re traveling with a partner or friend, these rooms offer the perfect balance of comfort, style, and modern conveniences.',
    baseRate: 3500,
    maxGuests: 2,
    icon: Crown,
    amenities: ['Free WiFi', 'AC', 'TV', 'Mini Bar', 'Room Service', 'Daily Housekeeping'],
    images: [
      'https://images.pexels.com/photos/271618/pexels-photo-271618.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/164595/pexels-photo-164595.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/1743229/pexels-photo-1743229.jpeg?auto=compress&cs=tinysrgb&w=800'
    ],
    features: ['Twin/Double Beds', 'Seating Area', 'Mini Bar', 'Premium Bathroom', 'Balcony', 'Work Station'],
    roomSize: '30 sqm',
    bedType: 'Twin or Double Bed'
  },
  suite: {
    name: 'Suite',
    description: 'Spacious luxury suite with separate living area',
    longDescription: 'Experience luxury in our spacious Suites featuring separate living and sleeping areas. Perfect for longer stays or when you need extra space to relax and entertain.',
    baseRate: 6500,
    maxGuests: 3,
    icon: Star,
    amenities: ['Free WiFi', 'AC', 'TV', 'Mini Bar', 'Balcony', 'Room Service', 'Kitchenette', 'Daily Housekeeping'],
    images: [
      'https://images.pexels.com/photos/1134176/pexels-photo-1134176.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/1743229/pexels-photo-1743229.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/271618/pexels-photo-271618.jpeg?auto=compress&cs=tinysrgb&w=800'
    ],
    features: ['Separate Living Room', 'Kitchenette', 'Balcony', 'Luxury Bathroom', 'Dining Area', 'Premium Bedding'],
    roomSize: '50 sqm',
    bedType: 'King Size Bed + Sofa Bed'
  },
  deluxe: {
    name: 'Deluxe Room',
    description: 'Premium accommodation with luxury amenities and city views', 
    longDescription: 'Our Deluxe Rooms represent the pinnacle of luxury accommodation. Featuring premium amenities, stunning city views, and exceptional service, these rooms are perfect for special occasions.',
    baseRate: 8500,
    maxGuests: 4,
    icon: Crown,
    amenities: ['Free WiFi', 'AC', 'TV', 'Mini Bar', 'Balcony', 'Room Service', 'Jacuzzi', 'City View', 'Daily Housekeeping'],
    images: [
      'https://images.pexels.com/photos/1743229/pexels-photo-1743229.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/1134176/pexels-photo-1134176.jpeg?auto=compress&cs=tinysrgb&w=800',
      'https://images.pexels.com/photos/271618/pexels-photo-271618.jpeg?auto=compress&cs=tinysrgb&w=800'
    ],
    features: ['King Size Bed', 'City View', 'Jacuzzi', 'Premium Amenities', 'Concierge Service', 'Butler Service'],
    roomSize: '45 sqm',
    bedType: 'King Size Bed'
  }
};

function RoomDetailPage() {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [bookingDates, setBookingDates] = useState({
    checkIn: searchParams.get('checkIn') || '',
    checkOut: searchParams.get('checkOut') || '',
    guests: parseInt(searchParams.get('guests') || '2')
  });

  const { data: catalog } = usePublicRoomCatalog(DEFAULT_PUBLIC_HOTEL_ID);

  const room = useMemo(() => {
    if (!type) return null;
    if (isLikelyObjectId(type) && catalog?.length) {
      const o = catalog.find((c) => c.id === type);
      if (o) {
        return {
          name: o.name,
          description: `${o.code} — up to ${o.maxOccupancy} guests`,
          longDescription: `Stay in our ${o.name}.`,
          baseRate: o.basePrice ?? o.baseRate ?? 0,
          maxGuests: o.maxOccupancy || 2,
          icon: Bed,
          amenities: ['Free WiFi', 'AC', 'TV', 'Room Service'],
          images: API_FALLBACK_IMAGES,
          features: ['Comfortable stay', 'Modern amenities', 'Daily housekeeping'],
          roomSize: '—',
          bedType: o.code
        };
      }
    }
    const roomType = type as keyof typeof ROOM_TYPES;
    return ROOM_TYPES[roomType] ?? null;
  }, [type, catalog]);

  useEffect(() => {
    document.title = room ? `${room.name} - The Pentouz` : 'Room Details - The Pentouz';
  }, [room]);

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Room Type Not Found</h2>
          <Button onClick={() => navigate('/rooms')}>
            Back to Rooms
          </Button>
        </div>
      </div>
    );
  }

  const calculateNights = () => {
    if (!bookingDates.checkIn || !bookingDates.checkOut) return 0;
    const start = new Date(bookingDates.checkIn);
    const end = new Date(bookingDates.checkOut);
    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  };

  const nights = calculateNights();
  const totalPrice = nights > 0 ? room.baseRate * nights : room.baseRate;

  const handleBookNow = () => {
    const params = new URLSearchParams();
    if (bookingDates.checkIn) params.set('checkIn', bookingDates.checkIn);
    if (bookingDates.checkOut) params.set('checkOut', bookingDates.checkOut);
    if (bookingDates.guests) params.set('guests', bookingDates.guests.toString());
    if (type && isLikelyObjectId(type) && catalog?.some((c) => c.id === type)) {
      params.set('roomTypeId', type);
    } else if (type) {
      params.set('roomType', type);
    }
    params.set('hotelId', hotelId);

    navigate(`/booking?${params.toString()}`);
  };

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % room.images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + room.images.length) % room.images.length);
  };

  const Icon = room.icon;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Back Button */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => navigate(`/rooms?hotelId=${hotelId}`)}
            className="flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Room Types
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Room Details */}
          <div className="lg:col-span-2 space-y-8">
            {/* Image Gallery */}
            <div className="relative">
              <div className="aspect-w-16 aspect-h-9 bg-gray-200 rounded-lg overflow-hidden">
                <img
                  src={room.images[currentImageIndex]}
                  alt={`${room.name} - Image ${currentImageIndex + 1}`}
                  className="w-full h-96 object-cover"
                />
                
                {/* Navigation Arrows */}
                <button aria-label="Previous"
                  onClick={prevImage}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full p-2 shadow-lg"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button aria-label="Next"
                  onClick={nextImage}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full p-2 shadow-lg"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>

                {/* Image Indicators */}
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
                  {room.images.map((_, index) => (
                    <button
                      key={`room-images-${index}`}
                      onClick={() => setCurrentImageIndex(index)}
                      className={`w-2 h-2 rounded-full ${
                        index === currentImageIndex ? 'bg-white' : 'bg-white bg-opacity-50'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Room Information */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Icon className="h-8 w-8 text-blue-600 mr-3" />
                    <CardTitle className="text-3xl">{room.name}</CardTitle>
                  </div>
                  <Badge className="bg-blue-100 text-blue-800">
                    Up to {room.maxGuests} Guest{room.maxGuests > 1 ? 's' : ''}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 text-lg mb-6">{room.longDescription}</p>
                
                {/* Room Specifications */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Room Details</h3>
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex justify-between">
                        <span>Room Size:</span>
                        <span className="font-medium">{room.roomSize}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Bed Type:</span>
                        <span className="font-medium">{room.bedType}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Max Occupancy:</span>
                        <span className="font-medium">{room.maxGuests} guests</span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Pricing</h3>
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex justify-between">
                        <span>Base Rate:</span>
                        <span className="font-medium text-lg text-blue-600">{formatIndianCurrency(room.baseRate)}/night</span>
                      </div>
                      {nights > 0 && (
                        <>
                          <div className="flex justify-between">
                            <span>{nights} night{nights > 1 ? 's' : ''}:</span>
                            <span className="font-medium">{formatIndianCurrency(room.baseRate * nights)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Taxes (18% GST):</span>
                            <span className="font-medium">{formatIndianCurrency(Math.round(totalPrice * 0.18))}</span>
                          </div>
                          <div className="border-t pt-2 flex justify-between text-lg font-bold">
                            <span>Total:</span>
                            <span className="text-blue-600">{formatIndianCurrency(totalPrice + Math.round(totalPrice * 0.18))}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Features */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Features & Amenities</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {room.features.map((feature, index) => (
                      <div key={`room-features-${index}-${feature}`} className="flex items-center">
                        <CheckCircle className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                        <span className="text-gray-700">{feature}</span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {room.amenities.map((amenity, index) => (
                      <span key={`room-amenities-${index}-${amenity}`} className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                        {amenity}
                      </span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Booking Widget */}
          <div className="lg:col-span-1">
            <div className="sticky top-8">
              <Card>
                <CardHeader>
                  <CardTitle className="text-center">Book This Room Type</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Check-in</label>
                      <Input
                        type="date"
                        value={bookingDates.checkIn}
                        onChange={(e) => setBookingDates(prev => ({ ...prev, checkIn: e.target.value }))}
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Check-out</label>
                      <Input
                        type="date"
                        value={bookingDates.checkOut}
                        onChange={(e) => setBookingDates(prev => ({ ...prev, checkOut: e.target.value }))}
                        min={bookingDates.checkIn || new Date().toISOString().split('T')[0]}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Guests</label>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setBookingDates(prev => ({ 
                            ...prev, 
                            guests: Math.max(1, prev.guests - 1)
                          }))}
                          disabled={bookingDates.guests <= 1}
                        >
                          -
                        </Button>
                        <span className="w-12 text-center font-semibold">{bookingDates.guests}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setBookingDates(prev => ({ 
                            ...prev, 
                            guests: Math.min(room.maxGuests, prev.guests + 1)
                          }))}
                          disabled={bookingDates.guests >= room.maxGuests}
                        >
                          +
                        </Button>
                      </div>
                      {bookingDates.guests > room.maxGuests && (
                        <p className="text-sm text-red-600 mt-1">
                          This room type can accommodate maximum {room.maxGuests} guests
                        </p>
                      )}
                    </div>

                    {nights > 0 && (
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <div className="text-center">
                          <p className="text-sm text-gray-600 mb-1">{nights} night{nights > 1 ? 's' : ''}</p>
                          <p className="text-2xl font-bold text-blue-600">{formatIndianCurrency(totalPrice + Math.round(totalPrice * 0.18))}</p>
                          <p className="text-xs text-gray-500">Including taxes</p>
                        </div>
                      </div>
                    )}

                    <Button
                      onClick={handleBookNow}
                      className="w-full py-3 text-lg"
                      size="lg"
                      disabled={bookingDates.guests > room.maxGuests}
                    >
                      Book Now
                    </Button>
                    
                    <div className="text-center text-sm text-gray-500">
                      <p>✓ Free cancellation</p>
                      <p>✓ No booking fees</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Contact Information */}
              <Card className="mt-6">
                <CardContent className="p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Need Help?</h3>
                  <div className="space-y-3">
                    <div className="flex items-center text-sm text-gray-600">
                      <Phone className="h-4 w-4 mr-2" />
                      <a href="tel:+918884449930" className="hover:text-blue-600 transition-colors">+91 8884449930</a>
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Mail className="h-4 w-4 mr-2" />
                      <a href="mailto:sales@pentouz.com" className="hover:text-blue-600 transition-colors">sales@pentouz.com</a>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default withErrorBoundary(RoomDetailPage);

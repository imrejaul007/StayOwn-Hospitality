import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  ArrowLeft,
  ArrowRight,
  Calendar,
  Users,
  User,
  Mail,
  Phone,
  CreditCard,
  CheckCircle,
  Edit3,
  Crown,
  Bed,
  Star,
  Building2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '../../context/AuthContext';
import { formatIndianCurrency } from '../../utils/currency';
import { bookingService } from '../../services/bookingService';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { withErrorBoundary } from '../../components/ErrorBoundary';
import { usePublicRoomCatalog } from '../../hooks/usePublicRoomCatalog';
import contactService from '../../services/contactService';
import { hotelLabel, persistPublicHotelId, resolvePublicHotelId } from '../../utils/publicBookingHotel';

// Room types data
const ROOM_TYPES = {
  single: {
    name: 'Single Room',
    description: 'Perfect for solo travelers',
    baseRate: 2500,
    maxGuests: 1,
    icon: Bed,
    amenities: ['Free WiFi', 'AC', 'TV', 'Room Service']
  },
  double: {
    name: 'Double Room', 
    description: 'Comfortable for couples',
    baseRate: 3500,
    maxGuests: 2,
    icon: Crown,
    amenities: ['Free WiFi', 'AC', 'TV', 'Mini Bar', 'Room Service']
  },
  suite: {
    name: 'Suite',
    description: 'Spacious luxury suite',
    baseRate: 6500,
    maxGuests: 3,
    icon: Star,
    amenities: ['Free WiFi', 'AC', 'TV', 'Mini Bar', 'Balcony', 'Room Service', 'Kitchenette']
  },
  deluxe: {
    name: 'Deluxe Room',
    description: 'Premium comfort and amenities', 
    baseRate: 8500,
    maxGuests: 4,
    icon: Crown,
    amenities: ['Free WiFi', 'AC', 'TV', 'Mini Bar', 'Balcony', 'Room Service', 'Jacuzzi', 'City View']
  }
};

// Form schemas
const guestDetailsSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  specialRequests: z.string().optional()
});

type GuestDetailsForm = z.infer<typeof guestDetailsSchema>;

const BookingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const hotelId = resolvePublicHotelId(searchParams);

  const { data: hotelsPayload } = useQuery({
    queryKey: ['public-contact-hotels'],
    queryFn: () => contactService.getHotelsContact(),
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
  const hotels = hotelsPayload?.hotels ?? [];

  useEffect(() => {
    document.title = 'Book Your Stay - The Pentouz';
  }, []);

  // Get URL parameters for pre-filling booking data
  const urlRoomType = searchParams.get('roomType') as keyof typeof ROOM_TYPES | null;
  const urlRoomTypeId = searchParams.get('roomTypeId');
  const urlGuests = parseInt(searchParams.get('guests') || '1');
  const urlCheckIn = searchParams.get('checkIn') || '';
  const urlCheckOut = searchParams.get('checkOut') || '';

  const { data: publicCatalog } = usePublicRoomCatalog(hotelId);

  // Booking state
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingData, setBookingData] = useState({
    roomType: urlRoomType && urlRoomType in ROOM_TYPES ? urlRoomType : null,
    roomTypeId: urlRoomTypeId || null as string | null,
    guests: urlGuests,
    checkIn: urlCheckIn,
    checkOut: urlCheckOut,
    guestDetails: null as GuestDetailsForm | null,
    paymentCompleted: false
  });

  useEffect(() => {
    if (!publicCatalog?.length) return;
    setBookingData((prev) => {
      if (!prev.roomTypeId) return prev;
      const ok = publicCatalog.some((c) => c.id === prev.roomTypeId);
      if (ok) return prev;
      return { ...prev, roomTypeId: null, roomType: null };
    });
  }, [publicCatalog]);

  // Form
  const { register, handleSubmit, formState: { errors } } = useForm<GuestDetailsForm>({
    resolver: zodResolver(guestDetailsSchema),
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || ''
    }
  });

  // Calculations
  const calculateNights = () => {
    if (!bookingData.checkIn || !bookingData.checkOut) return 0;
    const start = new Date(bookingData.checkIn);
    const end = new Date(bookingData.checkOut);
    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  };

  const nights = calculateNights();

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
    setBookingData((prev) => ({ ...prev, roomTypeId: null, roomType: null }));
  };

  const roomTypeData = useMemo(() => {
    if (bookingData.roomTypeId && publicCatalog?.length) {
      const o = publicCatalog.find((c) => c.id === bookingData.roomTypeId);
      if (o) {
        return {
          name: o.name,
          description: `${o.code} — up to ${o.maxOccupancy} guests`,
          baseRate: o.basePrice ?? o.baseRate ?? 0,
          maxGuests: o.maxOccupancy || 2,
          icon: Bed
        };
      }
    }
    if (bookingData.roomType && ROOM_TYPES[bookingData.roomType]) {
      return ROOM_TYPES[bookingData.roomType];
    }
    return null;
  }, [bookingData.roomType, bookingData.roomTypeId, publicCatalog]);
  const subtotal = roomTypeData ? roomTypeData.baseRate * nights : 0;
  const taxes = Math.round(subtotal * 0.18); // 18% GST
  const total = subtotal + taxes;

  const catalogRows = useMemo(() => {
    if (publicCatalog?.length) {
      return publicCatalog.map((o) => ({
        key: o.id,
        roomTypeId: o.id as string | null,
        roomType: null as keyof typeof ROOM_TYPES | null,
        name: o.name,
        description: `${o.code} — up to ${o.maxOccupancy} guests`,
        baseRate: o.basePrice ?? o.baseRate ?? 0,
        maxGuests: o.maxOccupancy || 2,
        icon: Bed
      }));
    }
    return (
      Object.entries(ROOM_TYPES) as [keyof typeof ROOM_TYPES, (typeof ROOM_TYPES)['single']][]
    ).map(([type, room]) => ({
      key: type,
      roomTypeId: null as string | null,
      roomType: type,
      name: room.name,
      description: room.description,
      baseRate: room.baseRate,
      maxGuests: room.maxGuests,
      icon: room.icon
    }));
  }, [publicCatalog]);

  // Step 1: Room Selection
  const renderStep1 = () => {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    return (
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Book Your Stay</h1>
          <p className="text-gray-600">Choose your room type and travel dates</p>
        </div>

        <Card className="border border-gray-200">
          <CardContent className="p-4 sm:p-6">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Building2 className="h-4 w-4 text-gray-500" />
              Property
            </label>
            <select
              value={hotelId}
              onChange={(e) => handlePropertyChange(e.target.value)}
              className="w-full max-w-xl border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              Room types and pricing below are for this property only.
            </p>
          </CardContent>
        </Card>

        {/* Date & Guest Selection */}
        <Card className="border-2">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Check-in</label>
                <Input
                  type="date"
                  value={bookingData.checkIn}
                  min={today}
                  onChange={(e) => setBookingData({
                    ...bookingData,
                    checkIn: e.target.value,
                    checkOut: bookingData.checkOut || tomorrow
                  })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Check-out</label>
                <Input
                  type="date"
                  value={bookingData.checkOut}
                  min={bookingData.checkIn || tomorrow}
                  onChange={(e) => setBookingData({
                    ...bookingData,
                    checkOut: e.target.value
                  })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Guests</label>
                <div className="flex items-center justify-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBookingData({
                      ...bookingData,
                      guests: Math.max(1, bookingData.guests - 1)
                    })}
                    disabled={bookingData.guests <= 1}
                  >
                    -
                  </Button>
                  <span className="w-12 text-center font-semibold">{bookingData.guests}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBookingData({
                      ...bookingData,
                      guests: bookingData.guests + 1
                    })}
                    disabled={bookingData.guests >= 4}
                  >
                    +
                  </Button>
                </div>
              </div>
              <div className="flex items-end">
                <div className="bg-blue-50 p-3 rounded-lg w-full text-center">
                  <p className="text-sm text-blue-600 font-medium">
                    {nights > 0 ? `${nights} Night${nights > 1 ? 's' : ''}` : 'Select dates'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Room Type Selection */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Choose Your Room Type</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {catalogRows.map((row) => {
              const Icon = row.icon;
              const isSelected =
                (row.roomTypeId != null && bookingData.roomTypeId === row.roomTypeId) ||
                (row.roomType != null && bookingData.roomType === row.roomType);
              const canAccommodate = bookingData.guests <= row.maxGuests;
              const totalPrice = nights > 0 ? row.baseRate * nights : row.baseRate;

              return (
                <Card
                  key={row.key}
                  className={`cursor-pointer transition-all hover:shadow-lg ${
                    isSelected 
                      ? 'border-2 border-blue-500 shadow-md' 
                      : canAccommodate 
                      ? 'border-2 border-gray-200 hover:border-blue-300' 
                      : 'border-2 border-gray-100 opacity-50 cursor-not-allowed'
                  }`}
                  onClick={() =>
                    canAccommodate &&
                    setBookingData({
                      ...bookingData,
                      roomTypeId: row.roomTypeId,
                      roomType: row.roomType
                    })
                  }
                >
                  <CardContent className="p-4 sm:p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center">
                        <Icon className={`h-6 w-6 mr-3 ${isSelected ? 'text-blue-600' : 'text-gray-600'}`} />
                        <div>
                          <h3 className={`font-semibold ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                            {row.name}
                          </h3>
                          <p className="text-sm text-gray-600">{row.description}</p>
                        </div>
                      </div>
                      {isSelected && <CheckCircle className="h-5 w-5 text-blue-600" />}
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Max Guests</span>
                        <Badge variant={canAccommodate ? "default" : "destructive"}>
                          {row.maxGuests} Guest{row.maxGuests > 1 ? 's' : ''}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Per Night</span>
                        <span className="font-semibold text-gray-900">
                          {formatIndianCurrency(row.baseRate)}
                        </span>
                      </div>

                      {nights > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600">{nights} Night{nights > 1 ? 's' : ''}</span>
                          <span className="font-bold text-blue-600 text-lg">
                            {formatIndianCurrency(totalPrice)}
                          </span>
                        </div>
                      )}

                      {!canAccommodate && (
                        <div className="mt-3 p-2 bg-red-50 rounded-md">
                          <p className="text-xs text-red-600">
                            This room can accommodate maximum {row.maxGuests} guest{row.maxGuests > 1 ? 's' : ''}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // Step 2: Guest Details
  const renderStep2 = () => {
    const onSubmit = (data: GuestDetailsForm) => {
      setBookingData({
        ...bookingData,
        guestDetails: data
      });
      setCurrentStep(3);
    };

    return (
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Guest Details</h1>
          <p className="text-gray-600">Please provide your information</p>
        </div>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <User className="h-4 w-4 inline mr-1" />
                    Full Name
                  </label>
                  <Input
                    {...register('name')}
                    placeholder="Enter your full name"
                    className={errors.name ? 'border-red-500' : ''}
                  />
                  {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Mail className="h-4 w-4 inline mr-1" />
                    Email Address
                  </label>
                  <Input
                    {...register('email')}
                    type="email"
                    placeholder="Enter your email"
                    className={errors.email ? 'border-red-500' : ''}
                  />
                  {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Phone className="h-4 w-4 inline mr-1" />
                    Phone Number
                  </label>
                  <Input
                    {...register('phone')}
                    placeholder="Enter your phone number"
                    className={errors.phone ? 'border-red-500' : ''}
                  />
                  {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Guests</label>
                  <div className="flex items-center justify-center space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setBookingData({
                        ...bookingData,
                        guests: Math.max(1, bookingData.guests - 1)
                      })}
                      disabled={bookingData.guests <= 1}
                    >
                      -
                    </Button>
                    <span className="w-12 text-center font-semibold">{bookingData.guests}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setBookingData({
                        ...bookingData,
                        guests: bookingData.guests + 1
                      })}
                      disabled={bookingData.guests >= (roomTypeData?.maxGuests || 4)}
                    >
                      +
                    </Button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Special Requests (Optional)
                </label>
                <textarea
                  {...register('specialRequests')}
                  rows={3}
                  placeholder="Any special requirements or requests..."
                  className="w-full p-3 border border-gray-300 rounded-md resize-none"
                />
              </div>

              <div className="flex flex-col sm:flex-row justify-between gap-4 pt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep(1)}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Room Selection
                </Button>
                <Button type="submit">
                  Continue to Review
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  };

  // Step 3: Review & Payment
  const renderStep3 = () => {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Review Your Booking</h1>
          <p className="text-gray-600">Confirm your details before payment</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Booking Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Room Details */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Room Details</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentStep(1)}
                >
                  <Edit3 className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              </CardHeader>
              <CardContent>
                {roomTypeData && (
                  <div className="flex items-center space-x-4">
                    <roomTypeData.icon className="h-8 w-8 text-blue-600" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{roomTypeData.name}</h3>
                      <p className="text-sm text-gray-600">{roomTypeData.description}</p>
                      <div className="flex items-center space-x-4 mt-2">
                        <Badge>{bookingData.guests} Guest{bookingData.guests > 1 ? 's' : ''}</Badge>
                        <span className="text-sm text-gray-600">{nights} Night{nights > 1 ? 's' : ''}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-gray-900">{formatIndianCurrency(subtotal)}</p>
                      <p className="text-sm text-gray-600">{formatIndianCurrency(roomTypeData.baseRate)}/night</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Guest Details */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Guest Information</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentStep(2)}
                >
                  <Edit3 className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              </CardHeader>
              <CardContent>
                {bookingData.guestDetails && (
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <User className="h-4 w-4 text-gray-500" />
                      <span>{bookingData.guestDetails.name}</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Mail className="h-4 w-4 text-gray-500" />
                      <span>{bookingData.guestDetails.email}</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Phone className="h-4 w-4 text-gray-500" />
                      <span>{bookingData.guestDetails.phone}</span>
                    </div>
                    {bookingData.guestDetails.specialRequests && (
                      <div className="pt-2 border-t">
                        <p className="text-sm font-medium text-gray-700">Special Requests:</p>
                        <p className="text-sm text-gray-600">{bookingData.guestDetails.specialRequests}</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Dates */}
            <Card>
              <CardContent className="p-4 sm:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                  <div>
                    <Calendar className="h-5 w-5 mx-auto mb-2 text-gray-500" />
                    <p className="text-sm text-gray-600">Check-in</p>
                    <p className="font-semibold">{bookingData.checkIn ? new Date(bookingData.checkIn + 'T00:00:00').toLocaleDateString('en-IN') : '--'}</p>
                  </div>
                  <div>
                    <Users className="h-5 w-5 mx-auto mb-2 text-gray-500" />
                    <p className="text-sm text-gray-600">Duration</p>
                    <p className="font-semibold">{nights} Night{nights > 1 ? 's' : ''}</p>
                  </div>
                  <div>
                    <Calendar className="h-5 w-5 mx-auto mb-2 text-gray-500" />
                    <p className="text-sm text-gray-600">Check-out</p>
                    <p className="font-semibold">{bookingData.checkOut ? new Date(bookingData.checkOut + 'T00:00:00').toLocaleDateString('en-IN') : '--'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Price Summary */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Price Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Room ({nights} night{nights > 1 ? 's' : ''})</span>
                  <span>{formatIndianCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Taxes & Fees (18% GST)</span>
                  <span>{formatIndianCurrency(taxes)}</span>
                </div>
                <div className="border-t pt-4">
                  <div className="flex justify-between text-lg font-semibold">
                    <span>Total</span>
                    <span className="text-blue-600">{formatIndianCurrency(total)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-6 text-center">
                <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-3" />
                <h3 className="font-semibold text-green-800 mb-2">Secure Payment</h3>
                <p className="text-sm text-green-700">Your payment is protected with 256-bit SSL encryption</p>
              </CardContent>
            </Card>

            <Button 
              className="w-full py-4 text-lg"
              onClick={async () => {
                if (!isAuthenticated) {
                  toast.error('Please login to complete booking');
                  navigate('/login');
                  return;
                }

                if (
                  (!bookingData.roomType && !bookingData.roomTypeId) ||
                  !bookingData.checkIn ||
                  !bookingData.checkOut ||
                  !bookingData.guestDetails
                ) {
                  toast.error('Please complete all booking details');
                  return;
                }

                setIsSubmitting(true);
                try {
                  // Create booking without room allocation - admin will assign rooms later
                  
                  // Calculate the total amount for the booking
                  const roomRate = roomTypeData?.baseRate ?? 0;
                  const catalogOpt = publicCatalog?.find((c) => c.id === bookingData.roomTypeId);
                  const lt = (catalogOpt?.legacyType || '').toLowerCase();
                  const roomTypeForApi =
                    bookingData.roomType ||
                    (lt === 'single' || lt === 'double' || lt === 'suite' || lt === 'deluxe' ? lt : 'double');
                  const subtotalAmount = roomRate * nights;
                  const taxAmount = Math.round(subtotalAmount * 0.18); // 18% GST
                  const totalAmount = subtotalAmount + taxAmount;

                  // Create booking request with room type info but no specific room assignment
                  const bookingRequest = {
                    hotelId,
                    roomIds: [], // No specific rooms assigned - admin will assign later
                    checkIn: new Date(bookingData.checkIn).toISOString(),
                    checkOut: new Date(bookingData.checkOut).toISOString(),
                    guestDetails: {
                      adults: bookingData.guests,
                      children: 0,
                      specialRequests: bookingData.guestDetails.specialRequests || ''
                    },
                    // Additional metadata for the booking
                    totalAmount: totalAmount,
                    currency: 'INR',
                    roomType: roomTypeForApi,
                    ...(bookingData.roomTypeId ? { roomTypeId: bookingData.roomTypeId } : {}),
                    primaryRoomQuantity: 1,
                    nights: nights,
                    ratePerNight: roomRate,
                    guestName: bookingData.guestDetails.name,
                    guestEmail: bookingData.guestDetails.email,
                    guestPhone: bookingData.guestDetails.phone,
                    // IDEMPOTENCY FIX: crypto.randomUUID() is collision-safe; Date.now() removed.
                    idempotencyKey: `booking-${user?._id || 'guest'}-${crypto.randomUUID()}`
                  };

                  
                  const response = await bookingService.createBooking(bookingRequest);
                  
                  if (response.status === 'success') {
                    // Invalidate all dashboard and booking queries to refresh data immediately
                    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
                    queryClient.invalidateQueries({ queryKey: ['bookings'] });
                    queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
                    queryClient.invalidateQueries({ queryKey: ['staff-bookings'] });
                    
                    toast.success('Booking created successfully! Awaiting admin confirmation.');
                    navigate('/app');
                  } else {
                    toast.error('Failed to create booking');
                  }
                } catch (error: unknown) {
                  const err = error as { response?: { data?: { message?: string } } };
                  toast.error(err.response?.data?.message || 'Failed to create booking');
                } finally {
                  setIsSubmitting(false);
                }
              }}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>Processing...</>
              ) : (
                <>
                  <CreditCard className="h-5 w-5 mr-2" />
                  Pay {formatIndianCurrency(total)}
                </>
              )}
            </Button>

            <div className="flex justify-center mt-4">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(2)}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Guest Details
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const canContinueStep1 = (bookingData.roomType || bookingData.roomTypeId) && bookingData.checkIn && bookingData.checkOut && nights > 0;

  return (
    <div className="min-h-screen bg-gray-50 py-6 sm:py-8">
      {/* Progress Steps */}
      <div className="max-w-4xl mx-auto px-4 mb-6 sm:mb-8">
        <div className="flex items-center justify-center space-x-4 sm:space-x-8 overflow-x-auto pb-2">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                currentStep >= step 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-200 text-gray-600'
              }`}>
                {currentStep > step ? <CheckCircle className="h-5 w-5" /> : step}
              </div>
              <span className={`ml-2 text-xs sm:text-sm font-medium whitespace-nowrap ${
                currentStep >= step ? 'text-blue-600' : 'text-gray-500'
              }`}>
                {step === 1 ? 'Room Selection' : step === 2 ? 'Guest Details' : 'Review & Payment'}
              </span>
              {step < 3 && <ArrowRight className="h-4 w-4 ml-2 sm:ml-4 text-gray-400 flex-shrink-0" />}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4">
        {currentStep === 1 && (
          <>
            {renderStep1()}
            <div className="flex flex-col sm:flex-row justify-between gap-4 mt-6 sm:mt-8 max-w-4xl mx-auto">
              <Button
                variant="outline"
                onClick={() => navigate('/')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
              <Button
                onClick={() => setCurrentStep(2)}
                disabled={!canContinueStep1}
                className="px-8"
              >
                Continue to Guest Details
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </>
        )}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
      </div>
    </div>
  );
};

export default withErrorBoundary(BookingPage, { level: 'page' });
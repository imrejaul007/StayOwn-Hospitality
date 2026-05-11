import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useProperty } from '../../context/PropertyContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { cn } from '../../utils/cn';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { withErrorBoundary } from '../../components/ErrorBoundary';
import {
  Search,
  CalendarDays,
  Tag,
  Users,
  Award,
  RefreshCw,
  CheckCircle,
  XCircle,
  Star,
  Hotel,
  Mail,
  Phone,
  DollarSign,
  Percent,
  Gift,
  ArrowUpCircle,
  ChevronLeft,
  ChevronRight,
  User,
  Eye,
  Loader2,
} from 'lucide-react';

// ─── Constants ──────────────────────────────────────────────────────────────
const PAGE_LIMIT = 20;

// ─── Types ──────────────────────────────────────────────────────────────────
interface PromoCode {
  _id: string;
  code: string;
  name: string;
  description?: string;
  type: 'percentage' | 'fixed_amount' | 'free_night' | 'upgrade';
  discount: {
    value: number;
    maxAmount?: number;
    freeNights?: number;
    upgradeRoomType?: string;
  };
  conditions: {
    minBookingValue?: number;
    minNights?: number;
    maxNights?: number;
    applicableRoomTypes?: string[];
    firstTimeGuests?: boolean;
    maxUsagePerGuest?: number;
    combinableWithOtherOffers?: boolean;
  };
  validity: {
    startDate: string;
    endDate: string;
  };
  usage: {
    totalUsageLimit?: number;
    currentUsage: number;
  };
  isActive: boolean;
  createdAt: string;
}

interface GuestCRM {
  _id: string;
  guestId: string;
  profile: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    nationality?: string;
    avatar?: string;
  };
  preferences: {
    roomType?: string;
    bedType?: string;
    floorLevel?: string;
    specialRequests?: string[];
    dietaryRestrictions?: string[];
  };
  bookingHistory: {
    totalBookings: number;
    totalSpent: number;
    averageBookingValue: number;
    lastBookingDate?: string;
    favoriteRoomTypes?: string[];
    cancellationRate: number;
  };
  segmentation: {
    lifetimeValue: number;
    segment: 'vip' | 'frequent' | 'potential' | 'at_risk' | 'lost' | 'new';
    loyaltyTier?: string;
    tags?: string[];
  };
  feedback?: {
    averageRating?: number;
  };
}

interface LoyaltyProgram {
  _id: string;
  programId: string;
  name: string;
  description?: string;
  isActive: boolean;
  tiers: Array<{
    name: string;
    minPoints: number;
    maxPoints: number;
    benefits: Array<{ type: string; description: string; value: string }>;
    perks: string[];
    color?: string;
  }>;
  pointsRules: {
    earningRates: Array<{
      action: string;
      pointsPerDollar?: number;
      fixedPoints?: number;
      multiplier?: number;
    }>;
    redemptionRates: Array<{
      reward: string;
      pointsRequired: number;
    }>;
  };
}

interface RoomResult {
  _id: string;
  roomNumber: string;
  type: string;
  currentRate: number;
  status: string;
  floor: number;
  amenities?: string[];
  maxOccupancy?: number;
  isAvailable?: boolean;
}

// ─── Main Page ──────────────────────────────────────────────────────────────
function FrontDeskBookingEngine() {
  const { selectedPropertyId } = useProperty();
  const [activeTab, setActiveTab] = useState<'quickbook' | 'promos' | 'crm' | 'loyalty'>('quickbook');
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  if (!selectedPropertyId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <Hotel className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">No Property Selected</h2>
            <p className="text-gray-500">Please select a property to access the Booking Engine tools.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleRefresh = () => {
    setRefreshing(true);
    setRefreshKey((k) => k + 1);
    setTimeout(() => setRefreshing(false), 500);
  };

  const tabs = [
    { key: 'quickbook' as const, label: 'Quick Book', icon: CalendarDays },
    { key: 'promos' as const, label: 'Promo Codes', icon: Tag },
    { key: 'crm' as const, label: 'Guest CRM', icon: Users },
    { key: 'loyalty' as const, label: 'Loyalty', icon: Award },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Booking Engine</h1>
          <p className="text-gray-600">Quick booking, promo validation, guest CRM, and loyalty tools</p>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing} variant="outline" className="flex items-center">
          <RefreshCw className={cn('w-4 h-4 mr-2', refreshing && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Info Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Front Desk Access:</strong> You can search rooms, create bookings, validate promo codes, and look up
          guest/loyalty information. Promo code creation, campaigns, and widget management require administrator access.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="border-b border-gray-200">
          <div className="flex space-x-8 px-4">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap flex items-center gap-2 transition-colors',
                    activeTab === tab.key
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'quickbook' && (
            <QuickBookTab propertyId={selectedPropertyId} key={`qb-${refreshKey}`} />
          )}
          {activeTab === 'promos' && (
            <PromoCodesTab propertyId={selectedPropertyId} key={`promo-${refreshKey}`} />
          )}
          {activeTab === 'crm' && (
            <GuestCRMTab propertyId={selectedPropertyId} key={`crm-${refreshKey}`} />
          )}
          {activeTab === 'loyalty' && (
            <LoyaltyTab propertyId={selectedPropertyId} key={`loyalty-${refreshKey}`} />
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 1: QUICK BOOK
// ═══════════════════════════════════════════════════════════════════════════
function QuickBookTab({ propertyId }: { propertyId: string }) {
  const { user } = useAuth();
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [roomType, setRoomType] = useState('');
  const [guests, setGuests] = useState(1);
  const [searchTriggered, setSearchTriggered] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<RoomResult | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);

  // Booking form state
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');

  const {
    data: roomsData,
    isLoading: roomsLoading,
    isFetching: roomsFetching,
  } = useQuery({
    queryKey: ['frontdesk-rooms', propertyId, checkIn, checkOut, roomType, searchTriggered],
    queryFn: async () => {
      const params: Record<string, string | number> = {
        hotelId: propertyId,
        page: 1,
        limit: PAGE_LIMIT,
      };
      if (checkIn) params.checkIn = checkIn;
      if (checkOut) params.checkOut = checkOut;
      if (roomType) params.type = roomType;
      const res = await api.get('/rooms', { params });
      return res.data;
    },
    enabled: searchTriggered && !!checkIn && !!checkOut,
    keepPreviousData: true,
  });

  const rooms: RoomResult[] = roomsData?.data?.rooms ?? roomsData?.data ?? [];

  const availableRooms = rooms.filter((r) => {
    const isAvail = r.isAvailable !== false && r.status !== 'occupied' && r.status !== 'maintenance';
    const fitsGuests = !r.maxOccupancy || r.maxOccupancy >= guests;
    return isAvail && fitsGuests;
  });

  const createBookingMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await api.post('/bookings', payload);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Booking created successfully! ID: ${data?.data?.bookingId || data?.data?._id || ''}`);
      setShowBookingModal(false);
      resetBookingForm();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to create booking');
    },
  });

  const resetBookingForm = () => {
    setGuestName('');
    setGuestEmail('');
    setGuestPhone('');
    setPromoCode('');
    setPaymentMethod('cash');
    setSelectedRoom(null);
  };

  const handleSearch = () => {
    if (!checkIn || !checkOut) {
      toast.error('Please select both check-in and check-out dates');
      return;
    }
    if (new Date(checkIn) >= new Date(checkOut)) {
      toast.error('Check-out must be after check-in');
      return;
    }
    setSearchTriggered(true);
  };

  const handleSelectRoom = (room: RoomResult) => {
    setSelectedRoom(room);
    setShowBookingModal(true);
  };

  const handleCreateBooking = () => {
    if (!selectedRoom || !guestName) {
      toast.error('Please fill in guest name');
      return;
    }
    createBookingMutation.mutate({
      hotelId: propertyId,
      roomIds: [selectedRoom._id],
      checkIn,
      checkOut,
      guestName,
      guestEmail: guestEmail || undefined,
      guestPhone: guestPhone || undefined,
      totalAmount: selectedRoom.currentRate *
        Math.max(1, Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)),
      currency: 'INR',
      source: 'frontdesk',
      paymentMethod,
      status: 'confirmed',
      paymentStatus: paymentMethod === 'cash' ? 'pending' : 'partial',
      guestDetails: {
        adults: guests,
        children: 0,
        name: guestName,
        email: guestEmail,
        phone: guestPhone,
      },
    });
  };

  const nights = checkIn && checkOut
    ? Math.max(1, Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000))
    : 0;

  return (
    <div className="space-y-6">
      {/* Search Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="w-5 h-5" />
            Room Availability Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Check-in</label>
              <Input
                type="date"
                value={checkIn}
                onChange={(e) => { setCheckIn(e.target.value); setSearchTriggered(false); }}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Check-out</label>
              <Input
                type="date"
                value={checkOut}
                onChange={(e) => { setCheckOut(e.target.value); setSearchTriggered(false); }}
                min={checkIn || new Date().toISOString().split('T')[0]}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Room Type</label>
              <select
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={roomType}
                onChange={(e) => { setRoomType(e.target.value); setSearchTriggered(false); }}
              >
                <option value="">All Types</option>
                <option value="single">Single</option>
                <option value="double">Double</option>
                <option value="suite">Suite</option>
                <option value="deluxe">Deluxe</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Guests</label>
              <Input
                type="number"
                min={1}
                max={10}
                value={guests}
                onChange={(e) => setGuests(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>
            <div>
              <Button onClick={handleSearch} className="w-full" disabled={roomsFetching}>
                {roomsFetching ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                Search
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {searchTriggered && (
        <div>
          {roomsLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : availableRooms.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <XCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500 font-medium">No available rooms found for these dates</p>
                <p className="text-sm text-gray-400 mt-1">Try different dates or room type</p>
              </CardContent>
            </Card>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800">
                  {availableRooms.length} Available Room{availableRooms.length !== 1 ? 's' : ''}
                </h3>
                {nights > 0 && (
                  <span className="text-sm text-gray-500">{nights} night{nights !== 1 ? 's' : ''}</span>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availableRooms.map((room) => (
                  <Card key={room._id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-semibold text-gray-900">Room {room.roomNumber}</h4>
                          <p className="text-sm text-gray-500 capitalize">{room.type}</p>
                        </div>
                        <Badge variant="success">Available</Badge>
                      </div>
                      <div className="space-y-1 text-sm text-gray-600 mb-3">
                        {room.floor != null && <p>Floor: {room.floor}</p>}
                        {room.maxOccupancy && <p>Max guests: {room.maxOccupancy}</p>}
                        {room.amenities && room.amenities.length > 0 && (
                          <p className="truncate" title={room.amenities.join(', ')}>
                            {room.amenities.slice(0, 3).join(', ')}
                            {room.amenities.length > 3 && ` +${room.amenities.length - 3}`}
                          </p>
                        )}
                      </div>
                      <div className="flex justify-between items-center pt-3 border-t">
                        <div>
                          <span className="text-lg font-bold text-blue-600">
                            {'\u20B9'}{room.currentRate?.toLocaleString('en-IN') || '0'}
                          </span>
                          <span className="text-xs text-gray-400"> /night</span>
                          {nights > 1 && (
                            <p className="text-xs text-gray-500">
                              Total: {'\u20B9'}{(room.currentRate * nights).toLocaleString('en-IN')}
                            </p>
                          )}
                        </div>
                        <Button size="sm" onClick={() => handleSelectRoom(room)}>
                          Book Now
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Booking Modal */}
      <Modal isOpen={showBookingModal} onClose={() => setShowBookingModal(false)} title="Create Booking" size="lg">
        {selectedRoom && (
          <div className="space-y-5">
            {/* Summary */}
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold text-gray-900">Room {selectedRoom.roomNumber} ({selectedRoom.type})</p>
                  <p className="text-sm text-gray-600">
                    {checkIn && format(new Date(checkIn + 'T00:00:00'), 'MMM dd, yyyy')}
                    {' '}&rarr;{' '}
                    {checkOut && format(new Date(checkOut + 'T00:00:00'), 'MMM dd, yyyy')}
                    {' '}({nights} night{nights !== 1 ? 's' : ''})
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-blue-600">
                    {'\u20B9'}{(selectedRoom.currentRate * nights).toLocaleString('en-IN')}
                  </p>
                  <p className="text-xs text-gray-500">{'\u20B9'}{selectedRoom.currentRate.toLocaleString('en-IN')}/night</p>
                </div>
              </div>
            </div>

            {/* Guest Details */}
            <div>
              <h4 className="font-medium text-gray-900 mb-3">Guest Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Guest Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Full name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <Input
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder="guest@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <Input
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                  />
                </div>
              </div>
            </div>

            {/* Payment & Promo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                <select
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="upi">UPI</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Promo Code (optional)</label>
                <Input
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  placeholder="SUMMER2026"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowBookingModal(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateBooking}
                disabled={createBookingMutation.isLoading || !guestName}
              >
                {createBookingMutation.isLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                Create Booking
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 2: PROMO CODES
// ═══════════════════════════════════════════════════════════════════════════
function PromoCodesTab({ propertyId }: { propertyId: string }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [validateCode, setValidateCode] = useState('');
  const [validateBookingValue, setValidateBookingValue] = useState('');
  const [validateCheckIn, setValidateCheckIn] = useState('');
  const [validateCheckOut, setValidateCheckOut] = useState('');
  const [validationResult, setValidationResult] = useState<any>(null);

  const { data: promosData, isLoading } = useQuery({
    queryKey: ['frontdesk-promos', propertyId, page, typeFilter],
    queryFn: async () => {
      const params: Record<string, string | number> = {
        hotelId: propertyId,
        page,
        limit: PAGE_LIMIT,
        isActive: 'true',
      };
      if (typeFilter) params.type = typeFilter;
      const res = await api.get('/booking-engine/promo-codes', { params });
      return res.data;
    },
    keepPreviousData: true,
  });

  const promos: PromoCode[] = promosData?.data ?? [];
  const totalCount = promosData?.totalCount ?? promos.length;
  const totalPages = promosData?.totalPages ?? Math.max(1, Math.ceil(totalCount / PAGE_LIMIT));

  // Client-side search filter (since the backend promo endpoint doesn't support text search directly)
  const filteredPromos = search
    ? promos.filter(
        (p) =>
          p.code.toLowerCase().includes(search.toLowerCase()) ||
          p.name.toLowerCase().includes(search.toLowerCase())
      )
    : promos;

  const validateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/booking-engine/promo-codes/validate', {
        code: validateCode,
        bookingValue: parseFloat(validateBookingValue) || 0,
        checkInDate: validateCheckIn || undefined,
        checkOutDate: validateCheckOut || undefined,
        hotelId: propertyId,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setValidationResult(data?.data ?? data);
    },
    onError: (err: any) => {
      setValidationResult({ valid: false, reason: err?.response?.data?.message || 'Validation failed' });
    },
  });

  const promoTypeIcon = (type: string) => {
    switch (type) {
      case 'percentage':
        return <Percent className="w-4 h-4" />;
      case 'fixed_amount':
        return <DollarSign className="w-4 h-4" />;
      case 'free_night':
        return <Gift className="w-4 h-4" />;
      case 'upgrade':
        return <ArrowUpCircle className="w-4 h-4" />;
      default:
        return <Tag className="w-4 h-4" />;
    }
  };

  const promoTypeBadge = (type: string) => {
    const labels: Record<string, string> = {
      percentage: 'Percentage',
      fixed_amount: 'Fixed Amount',
      free_night: 'Free Night',
      upgrade: 'Upgrade',
    };
    const variants: Record<string, 'default' | 'info' | 'success' | 'warning'> = {
      percentage: 'info',
      fixed_amount: 'success',
      free_night: 'warning',
      upgrade: 'default',
    };
    return <Badge variant={variants[type] || 'default'}>{labels[type] || type}</Badge>;
  };

  const formatDiscountValue = (promo: PromoCode) => {
    switch (promo.type) {
      case 'percentage':
        return `${promo.discount.value}%${promo.discount.maxAmount ? ` (max ${'\u20B9'}${promo.discount.maxAmount})` : ''}`;
      case 'fixed_amount':
        return `${'\u20B9'}${promo.discount.value}`;
      case 'free_night':
        return `${promo.discount.freeNights || promo.discount.value} free night(s)`;
      case 'upgrade':
        return `Upgrade to ${promo.discount.upgradeRoomType || 'next level'}`;
      default:
        return String(promo.discount.value);
    }
  };

  return (
    <div className="space-y-6">
      {/* Validate Promo Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Validate Promo Code
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Promo Code</label>
              <Input
                value={validateCode}
                onChange={(e) => setValidateCode(e.target.value.toUpperCase())}
                placeholder="Enter code"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Booking Value</label>
              <Input
                type="number"
                value={validateBookingValue}
                onChange={(e) => setValidateBookingValue(e.target.value)}
                placeholder="e.g. 5000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Check-in</label>
              <Input
                type="date"
                value={validateCheckIn}
                onChange={(e) => setValidateCheckIn(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Check-out</label>
              <Input
                type="date"
                value={validateCheckOut}
                onChange={(e) => setValidateCheckOut(e.target.value)}
              />
            </div>
            <div>
              <Button
                onClick={() => validateMutation.mutate()}
                disabled={!validateCode || validateMutation.isLoading}
                className="w-full"
              >
                {validateMutation.isLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                Validate
              </Button>
            </div>
          </div>

          {/* Validation Result */}
          {validationResult && (
            <div
              className={cn(
                'mt-4 p-4 rounded-lg border',
                validationResult.valid || validationResult.isValid
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                {validationResult.valid || validationResult.isValid ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600" />
                )}
                <span
                  className={cn(
                    'font-semibold',
                    validationResult.valid || validationResult.isValid ? 'text-green-800' : 'text-red-800'
                  )}
                >
                  {validationResult.valid || validationResult.isValid ? 'Valid Promo Code' : 'Invalid Promo Code'}
                </span>
              </div>
              {validationResult.reason && (
                <p className="text-sm text-gray-600 ml-7">{validationResult.reason}</p>
              )}
              {(validationResult.discount || validationResult.discountAmount) && (
                <p className="text-sm text-green-700 ml-7 font-medium">
                  Discount: {'\u20B9'}
                  {(validationResult.discountAmount || validationResult.discount?.amount || validationResult.discount?.value || 0).toLocaleString('en-IN')}
                </p>
              )}
              {validationResult.finalAmount != null && (
                <p className="text-sm text-green-700 ml-7">
                  Final Amount: {'\u20B9'}{validationResult.finalAmount.toLocaleString('en-IN')}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Promo List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Tag className="w-5 h-5" />
              Active Promo Codes
            </CardTitle>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  className="pl-9 w-56"
                  placeholder="Search codes..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={typeFilter}
                onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              >
                <option value="">All Types</option>
                <option value="percentage">Percentage</option>
                <option value="fixed_amount">Fixed Amount</option>
                <option value="free_night">Free Night</option>
                <option value="upgrade">Upgrade</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : filteredPromos.length === 0 ? (
            <div className="text-center py-12">
              <Tag className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500">No active promo codes found</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-gray-500">
                      <th className="pb-3 font-medium">Code</th>
                      <th className="pb-3 font-medium">Name</th>
                      <th className="pb-3 font-medium">Type</th>
                      <th className="pb-3 font-medium">Discount</th>
                      <th className="pb-3 font-medium">Valid Period</th>
                      <th className="pb-3 font-medium">Usage</th>
                      <th className="pb-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredPromos.map((promo) => {
                      const now = new Date();
                      const start = new Date(promo.validity.startDate);
                      const end = new Date(promo.validity.endDate);
                      const isExpired = end < now;
                      const isUpcoming = start > now;

                      return (
                        <tr key={promo._id} className="hover:bg-gray-50">
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              {promoTypeIcon(promo.type)}
                              <span className="font-mono font-semibold text-blue-600">{promo.code}</span>
                            </div>
                          </td>
                          <td className="py-3 text-gray-700">{promo.name}</td>
                          <td className="py-3">{promoTypeBadge(promo.type)}</td>
                          <td className="py-3 font-medium">{formatDiscountValue(promo)}</td>
                          <td className="py-3 text-gray-500 text-xs">
                            {format(new Date(promo.validity.startDate), 'MMM dd, yyyy')}
                            {' '}&ndash;{' '}
                            {format(new Date(promo.validity.endDate), 'MMM dd, yyyy')}
                          </td>
                          <td className="py-3">
                            <span className="text-gray-700">{promo.usage.currentUsage}</span>
                            {promo.usage.totalUsageLimit != null && (
                              <span className="text-gray-400"> / {promo.usage.totalUsageLimit}</span>
                            )}
                          </td>
                          <td className="py-3">
                            {isExpired ? (
                              <Badge variant="error">Expired</Badge>
                            ) : isUpcoming ? (
                              <Badge variant="warning">Upcoming</Badge>
                            ) : promo.isActive ? (
                              <Badge variant="success">Active</Badge>
                            ) : (
                              <Badge variant="secondary">Inactive</Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-gray-500">
                    Page {page} of {totalPages} ({totalCount} total)
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 3: GUEST CRM
// ═══════════════════════════════════════════════════════════════════════════
function GuestCRMTab({ propertyId }: { propertyId: string }) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [segment, setSegment] = useState('');
  const [page, setPage] = useState(1);
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: guestsData, isLoading } = useQuery({
    queryKey: ['frontdesk-crm-guests', propertyId, debouncedSearch, segment, page],
    queryFn: async () => {
      const params: Record<string, string | number> = {
        hotelId: propertyId,
        page,
        limit: PAGE_LIMIT,
        sortBy: 'lifetimeValue',
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (segment) params.segment = segment;
      const res = await api.get('/booking-engine/crm/guests', { params });
      return res.data;
    },
    keepPreviousData: true,
  });

  const guests: GuestCRM[] = guestsData?.data ?? [];
  const totalCount = guestsData?.totalCount ?? guests.length;
  const totalPages = guestsData?.totalPages ?? Math.max(1, Math.ceil(totalCount / PAGE_LIMIT));

  const { data: guestProfileData, isLoading: profileLoading } = useQuery({
    queryKey: ['frontdesk-crm-guest-profile', propertyId, selectedGuestId],
    queryFn: async () => {
      const res = await api.get(`/booking-engine/crm/guests/${selectedGuestId}`, {
        params: { hotelId: propertyId },
      });
      return res.data;
    },
    enabled: !!selectedGuestId,
  });

  const guestProfile: GuestCRM | null = guestProfileData?.data ?? null;

  const segmentColors: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info' | 'secondary'> = {
    vip: 'warning',
    frequent: 'success',
    potential: 'info',
    at_risk: 'error',
    lost: 'secondary',
    new: 'default',
  };

  return (
    <div className="space-y-6">
      {/* Search & Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="w-5 h-5" />
            Search Guests
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[250px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                className="pl-9"
                placeholder="Search by name, email, or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={segment}
              onChange={(e) => { setSegment(e.target.value); setPage(1); }}
            >
              <option value="">All Segments</option>
              <option value="vip">VIP</option>
              <option value="frequent">Frequent</option>
              <option value="potential">Potential</option>
              <option value="at_risk">At Risk</option>
              <option value="lost">Lost</option>
              <option value="new">New</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Guest List + Profile Side Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Guest List */}
        <div className={cn('lg:col-span-2', selectedGuestId && 'lg:col-span-2')}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5" />
                Guest Directory
                {totalCount > 0 && (
                  <span className="text-sm font-normal text-gray-500">({totalCount})</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <LoadingSpinner />
                </div>
              ) : guests.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-gray-500">No guests found</p>
                  <p className="text-sm text-gray-400 mt-1">Try a different search term or segment</p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {guests.map((guest) => (
                      <div
                        key={guest._id}
                        onClick={() => setSelectedGuestId(guest._id)}
                        className={cn(
                          'p-3 rounded-lg border cursor-pointer transition-all hover:shadow-sm',
                          selectedGuestId === guest._id
                            ? 'border-blue-400 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-semibold text-sm">
                              {(guest.profile.firstName?.[0] || '').toUpperCase()}
                              {(guest.profile.lastName?.[0] || '').toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                {guest.profile.firstName} {guest.profile.lastName}
                              </p>
                              <div className="flex items-center gap-3 text-xs text-gray-500">
                                {guest.profile.email && (
                                  <span className="flex items-center gap-1">
                                    <Mail className="w-3 h-3" />
                                    {guest.profile.email}
                                  </span>
                                )}
                                {guest.profile.phone && (
                                  <span className="flex items-center gap-1">
                                    <Phone className="w-3 h-3" />
                                    {guest.profile.phone}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={segmentColors[guest.segmentation.segment] || 'default'}>
                              {guest.segmentation.segment.toUpperCase()}
                            </Badge>
                            <div className="text-right text-xs">
                              <p className="font-semibold text-gray-700">
                                {'\u20B9'}{guest.segmentation.lifetimeValue?.toLocaleString('en-IN') || '0'}
                              </p>
                              <p className="text-gray-400">{guest.bookingHistory.totalBookings} stays</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <p className="text-sm text-gray-500">
                        Page {page} of {totalPages}
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={page <= 1}
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          disabled={page >= totalPages}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Guest Profile Panel */}
        <div className="lg:col-span-1">
          {selectedGuestId ? (
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Guest Profile
                </CardTitle>
              </CardHeader>
              <CardContent>
                {profileLoading ? (
                  <div className="flex justify-center py-8">
                    <LoadingSpinner />
                  </div>
                ) : guestProfile ? (
                  <div className="space-y-5">
                    {/* Header */}
                    <div className="text-center pb-4 border-b">
                      <div className="w-16 h-16 rounded-full bg-blue-100 mx-auto mb-3 flex items-center justify-center text-blue-600 font-bold text-xl">
                        {(guestProfile.profile.firstName?.[0] || '').toUpperCase()}
                        {(guestProfile.profile.lastName?.[0] || '').toUpperCase()}
                      </div>
                      <h3 className="font-semibold text-gray-900 text-lg">
                        {guestProfile.profile.firstName} {guestProfile.profile.lastName}
                      </h3>
                      <Badge
                        variant={segmentColors[guestProfile.segmentation.segment] || 'default'}
                        className="mt-1"
                      >
                        {guestProfile.segmentation.segment.toUpperCase()}
                      </Badge>
                      {guestProfile.segmentation.loyaltyTier && (
                        <p className="text-xs text-gray-500 mt-1">
                          Loyalty Tier: {guestProfile.segmentation.loyaltyTier}
                        </p>
                      )}
                    </div>

                    {/* Contact */}
                    <div>
                      <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Contact</h4>
                      <div className="space-y-1.5 text-sm">
                        {guestProfile.profile.email && (
                          <p className="flex items-center gap-2 text-gray-700">
                            <Mail className="w-3.5 h-3.5 text-gray-400" />
                            {guestProfile.profile.email}
                          </p>
                        )}
                        {guestProfile.profile.phone && (
                          <p className="flex items-center gap-2 text-gray-700">
                            <Phone className="w-3.5 h-3.5 text-gray-400" />
                            {guestProfile.profile.phone}
                          </p>
                        )}
                        {guestProfile.profile.nationality && (
                          <p className="text-gray-500">Nationality: {guestProfile.profile.nationality}</p>
                        )}
                      </div>
                    </div>

                    {/* Stats */}
                    <div>
                      <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Stay History</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-50 rounded-lg p-3 text-center">
                          <p className="text-lg font-bold text-gray-900">
                            {guestProfile.bookingHistory.totalBookings}
                          </p>
                          <p className="text-xs text-gray-500">Total Stays</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 text-center">
                          <p className="text-lg font-bold text-green-600">
                            {'\u20B9'}{guestProfile.bookingHistory.totalSpent?.toLocaleString('en-IN') || '0'}
                          </p>
                          <p className="text-xs text-gray-500">Total Spend</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 text-center">
                          <p className="text-lg font-bold text-blue-600">
                            {'\u20B9'}{guestProfile.bookingHistory.averageBookingValue?.toLocaleString('en-IN') || '0'}
                          </p>
                          <p className="text-xs text-gray-500">Avg. Booking</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 text-center">
                          <p className="text-lg font-bold text-gray-900">
                            {guestProfile.segmentation.lifetimeValue?.toLocaleString('en-IN') || '0'}
                          </p>
                          <p className="text-xs text-gray-500">Lifetime Value</p>
                        </div>
                      </div>
                    </div>

                    {guestProfile.bookingHistory.lastBookingDate && (
                      <p className="text-xs text-gray-500">
                        Last stayed:{' '}
                        {format(new Date(guestProfile.bookingHistory.lastBookingDate), 'MMM dd, yyyy')}
                      </p>
                    )}

                    {/* Preferences */}
                    {guestProfile.preferences && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Preferences</h4>
                        <div className="space-y-1 text-sm text-gray-600">
                          {guestProfile.preferences.roomType && (
                            <p>Room: {guestProfile.preferences.roomType}</p>
                          )}
                          {guestProfile.preferences.bedType && (
                            <p>Bed: {guestProfile.preferences.bedType}</p>
                          )}
                          {guestProfile.preferences.floorLevel && (
                            <p>Floor: {guestProfile.preferences.floorLevel}</p>
                          )}
                          {guestProfile.preferences.specialRequests &&
                            guestProfile.preferences.specialRequests.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {guestProfile.preferences.specialRequests.map((req, i) => (
                                  <Badge key={i} variant="outline" className="text-xs">
                                    {req}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          {guestProfile.preferences.dietaryRestrictions &&
                            guestProfile.preferences.dietaryRestrictions.length > 0 && (
                              <p>Diet: {guestProfile.preferences.dietaryRestrictions.join(', ')}</p>
                            )}
                        </div>
                      </div>
                    )}

                    {/* Rating */}
                    {guestProfile.feedback?.averageRating != null && (
                      <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        <span className="text-sm font-medium">{guestProfile.feedback.averageRating.toFixed(1)}</span>
                        <span className="text-xs text-gray-400">avg rating</span>
                      </div>
                    )}

                    {/* Tags */}
                    {guestProfile.segmentation.tags && guestProfile.segmentation.tags.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Tags</h4>
                        <div className="flex flex-wrap gap-1">
                          {guestProfile.segmentation.tags.map((tag, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">Guest profile not found</p>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-16 text-center">
                <Eye className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500 font-medium">Select a guest to view profile</p>
                <p className="text-sm text-gray-400 mt-1">Click on any guest from the directory</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB 4: LOYALTY
// ═══════════════════════════════════════════════════════════════════════════
function LoyaltyTab({ propertyId }: { propertyId: string }) {
  const [lookupEmail, setLookupEmail] = useState('');
  const [lookupResult, setLookupResult] = useState<any>(null);

  const { data: programsData, isLoading } = useQuery({
    queryKey: ['frontdesk-loyalty-programs', propertyId],
    queryFn: async () => {
      const res = await api.get('/booking-engine/loyalty-programs', {
        params: { hotelId: propertyId, page: 1, limit: PAGE_LIMIT },
      });
      return res.data;
    },
  });

  const programs: LoyaltyProgram[] = programsData?.data ?? [];

  // Guest loyalty lookup via CRM search (by email)
  const lookupMutation = useMutation({
    mutationFn: async () => {
      const res = await api.get('/booking-engine/crm/guests', {
        params: { hotelId: propertyId, search: lookupEmail, page: 1, limit: 1 },
      });
      return res.data;
    },
    onSuccess: async (data) => {
      const guests = data?.data ?? [];
      if (guests.length === 0) { setLookupResult({ notFound: true }); return; }
      const guest = guests[0];
      // Enrich with OTA coin balances if the guest has a rezUserId
      if (guest.rezUserId || guest.otaUserId) {
        try {
          const walletRes = await api.get('/booking-engine/ota-wallet', {
            params: { userId: guest.otaUserId || guest.rezUserId },
          });
          const wallet = walletRes.data?.data ?? walletRes.data ?? {};
          guest.otaCoinBalancePaise = wallet.ota_coin_balance_paise ?? 0;
          guest.rezCoinBalancePaise = wallet.rez_coin_balance_paise ?? 0;
        } catch {
          // Non-fatal — show guest without coin data
        }
      }
      setLookupResult(guest);
    },
    onError: () => {
      toast.error('Lookup failed');
    },
  });

  const getTierForValue = (program: LoyaltyProgram, lifetimeValue: number) => {
    if (!program.tiers || program.tiers.length === 0) return null;
    const sorted = [...program.tiers].sort((a, b) => b.minPoints - a.minPoints);
    return sorted.find((tier) => lifetimeValue >= tier.minPoints) || sorted[sorted.length - 1];
  };

  return (
    <div className="space-y-6">
      {/* Guest Loyalty Lookup */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="w-5 h-5" />
            Guest Loyalty Lookup
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Guest Email or Name</label>
              <Input
                value={lookupEmail}
                onChange={(e) => setLookupEmail(e.target.value)}
                placeholder="Search by email or name..."
                onKeyDown={(e) => e.key === 'Enter' && lookupEmail && lookupMutation.mutate()}
              />
            </div>
            <Button
              onClick={() => lookupMutation.mutate()}
              disabled={!lookupEmail || lookupMutation.isLoading}
            >
              {lookupMutation.isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Search className="w-4 h-4 mr-2" />
              )}
              Look Up
            </Button>
          </div>

          {/* Lookup Result */}
          {lookupResult && (
            <div className="mt-4">
              {lookupResult.notFound ? (
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <XCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-gray-500">No guest found with that email or name</p>
                </div>
              ) : (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-blue-200 flex items-center justify-center text-blue-700 font-bold">
                        {(lookupResult.profile?.firstName?.[0] || '').toUpperCase()}
                        {(lookupResult.profile?.lastName?.[0] || '').toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">
                          {lookupResult.profile?.firstName} {lookupResult.profile?.lastName}
                        </p>
                        <p className="text-sm text-gray-600">{lookupResult.profile?.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <p className="text-xs text-gray-500">Segment</p>
                        <Badge
                          variant={
                            ({
                              vip: 'warning',
                              frequent: 'success',
                              potential: 'info',
                              at_risk: 'error',
                              lost: 'secondary',
                              new: 'default',
                            } as Record<string, 'warning' | 'success' | 'info' | 'error' | 'secondary' | 'default'>)[lookupResult.segmentation?.segment] || 'default'
                          }
                        >
                          {lookupResult.segmentation?.segment?.toUpperCase() || 'N/A'}
                        </Badge>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500">Loyalty Tier</p>
                        <p className="font-semibold text-gray-900">
                          {lookupResult.segmentation?.loyaltyTier || 'None'}
                        </p>
                      </div>
                      {/* REZ OTA Coin balances */}
                      {(lookupResult.otaCoinBalancePaise != null || lookupResult.rezCoinBalancePaise != null) && (
                        <>
                          <div className="text-center">
                            <p className="text-xs text-gray-500">OTA Coins</p>
                            <p className="font-semibold text-cyan-600">
                              ₹{Math.round((lookupResult.otaCoinBalancePaise ?? 0) / 100).toLocaleString()}
                            </p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-gray-500">REZ Coins</p>
                            <p className="font-semibold text-purple-600">
                              ₹{Math.round((lookupResult.rezCoinBalancePaise ?? 0) / 100).toLocaleString()}
                            </p>
                          </div>
                        </>
                      )}
                      <div className="text-center">
                        <p className="text-xs text-gray-500">Total Stays</p>
                        <p className="font-semibold text-gray-900">
                          {lookupResult.bookingHistory?.totalBookings || 0}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500">Lifetime Value</p>
                        <p className="font-semibold text-green-600">
                          {'\u20B9'}{lookupResult.segmentation?.lifetimeValue?.toLocaleString('en-IN') || '0'}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500">Total Spend</p>
                        <p className="font-semibold text-blue-600">
                          {'\u20B9'}{lookupResult.bookingHistory?.totalSpent?.toLocaleString('en-IN') || '0'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Loyalty Programs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Award className="w-5 h-5" />
            Active Loyalty Programs
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : programs.length === 0 ? (
            <div className="text-center py-12">
              <Award className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500">No active loyalty programs</p>
              <p className="text-sm text-gray-400 mt-1">Contact admin to set up loyalty programs</p>
            </div>
          ) : (
            <div className="space-y-6">
              {programs.map((program) => (
                <div key={program._id} className="border rounded-lg p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-900 text-lg">{program.name}</h3>
                      {program.description && (
                        <p className="text-sm text-gray-500 mt-1">{program.description}</p>
                      )}
                    </div>
                    <Badge variant={program.isActive ? 'success' : 'secondary'}>
                      {program.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>

                  {/* Tiers */}
                  {program.tiers && program.tiers.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Tiers</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        {program.tiers.map((tier, idx) => (
                          <div
                            key={idx}
                            className="rounded-lg border p-3"
                            style={{
                              borderColor: tier.color || '#e5e7eb',
                              backgroundColor: tier.color ? `${tier.color}10` : '#fafafa',
                            }}
                          >
                            <p className="font-semibold text-gray-900">{tier.name}</p>
                            <p className="text-xs text-gray-500 mb-2">
                              {tier.minPoints?.toLocaleString()} - {tier.maxPoints?.toLocaleString()} pts
                            </p>
                            {tier.perks && tier.perks.length > 0 && (
                              <ul className="text-xs text-gray-600 space-y-0.5">
                                {tier.perks.slice(0, 4).map((perk, i) => (
                                  <li key={i} className="flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3 text-green-500 shrink-0" />
                                    <span>{perk}</span>
                                  </li>
                                ))}
                                {tier.perks.length > 4 && (
                                  <li className="text-gray-400">+{tier.perks.length - 4} more</li>
                                )}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Earning Rates */}
                  {program.pointsRules?.earningRates && program.pointsRules.earningRates.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Earning Rates</h4>
                      <div className="flex flex-wrap gap-2">
                        {program.pointsRules.earningRates.map((rate, idx) => (
                          <div
                            key={idx}
                            className="inline-flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-full px-3 py-1 text-xs text-green-800"
                          >
                            <Star className="w-3 h-3" />
                            <span className="capitalize">{rate.action?.replace(/_/g, ' ')}</span>
                            <span className="font-semibold">
                              {rate.pointsPerDollar
                                ? `${rate.pointsPerDollar} pts/$`
                                : rate.fixedPoints
                                ? `${rate.fixedPoints} pts`
                                : rate.multiplier
                                ? `${rate.multiplier}x`
                                : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Redemption Rates */}
                  {program.pointsRules?.redemptionRates && program.pointsRules.redemptionRates.length > 0 && (
                    <div className="mt-3">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Redemption Options</h4>
                      <div className="flex flex-wrap gap-2">
                        {program.pointsRules.redemptionRates.map((option, idx) => (
                          <div
                            key={idx}
                            className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-full px-3 py-1 text-xs text-blue-800"
                          >
                            <Gift className="w-3 h-3" />
                            <span className="capitalize">{option.reward?.replace(/_/g, ' ')}</span>
                            <span className="font-semibold">{option.pointsRequired?.toLocaleString()} pts</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default withErrorBoundary(FrontDeskBookingEngine);

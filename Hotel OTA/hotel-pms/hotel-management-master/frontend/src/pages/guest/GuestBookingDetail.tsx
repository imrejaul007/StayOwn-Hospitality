import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import {
  Calendar,
  MapPin,
  Users,
  Clock,
  CreditCard,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowLeft,
  DollarSign,
  TrendingDown,
  TrendingUp,
  User,
  Mail,
  Phone,
  Home,
  Tag,
  History,
  Info
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { withErrorBoundary } from '../../components/ErrorBoundary';
import { toEntityIdString } from '../../utils/entityId';

interface GuestDetails {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  adults: number;
  children: number;
  specialRequests?: string;
}

interface Room {
  roomId: {
    _id: string;
    roomNumber: string;
    type: string;
  };
  rate: number;
}

interface HotelInfo {
  _id: string;
  name: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode?: string;
  };
  contact?: {
    phone: string;
    email: string;
  };
  policies?: {
    checkInTime?: string;
    checkOutTime?: string;
  };
}

interface PriceAdjustment {
  adjustmentId: string;
  adjustmentType: string;
  amount: number;
  reason: string;
  adjustedBy: {
    userName: string;
    userRole: string;
  };
  adjustedAt: string;
  isReversed: boolean;
  previousAmount: number;
  newAmount: number;
}

interface BookingDetail {
  _id: string;
  bookingNumber: string;
  status: string;
  paymentStatus: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  totalAmount: number;
  originalAmount?: number;
  discountAmount?: number;
  surchargeAmount?: number;
  currency: string;
  guestDetails: GuestDetails;
  userId?: {
    _id: string;
    name?: string;
    email?: string;
    phone?: string;
  };
  rooms: Room[];
  hotelId: HotelInfo;
  createdAt: string;
  updatedAt: string;
  priceAdjustments?: PriceAdjustment[];
}

const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'confirmed': return 'success';
    case 'pending': return 'warning';
    case 'checked_in': return 'info';
    case 'checked_out': return 'default';
    case 'cancelled': return 'error';
    case 'no_show': return 'error';
    default: return 'default';
  }
};

const getPaymentStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'paid': return 'success';
    case 'pending': return 'warning';
    case 'failed': return 'error';
    case 'refunded': return 'info';
    case 'partially_paid': return 'warning';
    default: return 'default';
  }
};

const getStatusIcon = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'confirmed':
    case 'checked_in':
    case 'checked_out':
      return <CheckCircle className="w-4 h-4" />;
    case 'pending':
      return <Clock className="w-4 h-4" />;
    case 'cancelled':
    case 'no_show':
      return <XCircle className="w-4 h-4" />;
    default:
      return <AlertCircle className="w-4 h-4" />;
  }
};

const formatCurrency = (amount: number | undefined | null, currency: string = 'INR') => {
  const safeAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency || 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(safeAmount);
};

const formatDate = (dateString: string | undefined | null) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Invalid date';
  return date.toLocaleDateString('en-IN', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const formatDateTime = (dateString: string | undefined | null) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Invalid date';
  return date.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

function GuestBookingDetail() {
  const { id: rawParam } = useParams<{ id: string }>();
  const id = toEntityIdString(rawParam);
  const navigate = useNavigate();
  const [showHistory, setShowHistory] = useState(false);

  // Fetch booking details via TanStack Query
  const { data: booking, isLoading: loading, error: bookingError, refetch } = useQuery<BookingDetail | null, Error>({
    queryKey: ['booking-detail', id],
    queryFn: async () => {
      // Try the enhanced endpoint first; fall back to standard bookings endpoint
      let response;
      try {
        response = await api.get(`/bookings/enhanced/${id}`);
      } catch {
        response = await api.get(`/bookings/${id}`);
      }

      const bookingData = response.data?.data?.booking || response.data?.data || response.data?.booking || null;
      if (bookingData) {
        return bookingData;
      }
      throw new Error('Invalid response format');
    },
    enabled: !!id,
    staleTime: 2 * 60 * 1000, // 2 minutes for detail view
  });

  const error = bookingError?.message || null;

  // Fetch price history via TanStack Query (only when showHistory is toggled on)
  const { data: priceHistory = [], isLoading: historyLoading } = useQuery<PriceAdjustment[]>({
    queryKey: ['booking-price-history', id],
    queryFn: async () => {
      const response = await api.get(`/bookings/enhanced/${id}/price-history`);
      return response.data?.data?.adjustmentHistory || [];
    },
    enabled: !!id && showHistory,
    staleTime: 2 * 60 * 1000,
    meta: { errorMessage: 'Failed to load price history' },
  });

  if (!rawParam || !id) {
    return (
      <div className="max-w-lg mx-auto p-6 text-center">
        <p className="text-gray-700 mb-4">This booking link is invalid or incomplete.</p>
        <Button type="button" onClick={() => navigate('/app/bookings')}>
          Back to my bookings
        </Button>
      </div>
    );
  }

  const getAdjustmentTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      discount: 'bg-green-100 text-green-800 border-green-200',
      surcharge: 'bg-red-100 text-red-800 border-red-200',
      rate_change: 'bg-blue-100 text-blue-800 border-blue-200',
      promotion: 'bg-purple-100 text-purple-800 border-purple-200',
      manual_adjustment: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colors[type] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading booking details...</p>
        </div>
      </div>
    );
  }

  // Error State
  if (error || !booking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Error Loading Booking</h2>
          <p className="text-gray-600 mb-6">{error || 'Booking not found'}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={() => refetch()} className="bg-blue-600 hover:bg-blue-700">
              Try Again
            </Button>
            <Button onClick={() => navigate('/app/bookings')} className="bg-yellow-600 hover:bg-yellow-700">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Bookings
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const hasAdjustments = booking.originalAmount && booking.originalAmount !== booking.totalAmount;
  const totalDiscount = booking.discountAmount || 0;
  const totalSurcharge = booking.surchargeAmount || 0;

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header with Back Button */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/app/bookings')}
            className="mb-4 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to My Bookings
          </Button>

          {/* Gradient Header */}
          <div className="relative bg-gradient-to-r from-yellow-500 via-yellow-600 to-orange-500 text-white p-8 rounded-2xl overflow-hidden shadow-xl">
            {/* Animated background pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-0 left-0 w-40 h-40 bg-white rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 right-0 w-64 h-64 bg-white rounded-full blur-3xl"></div>
            </div>

            <div className="relative z-10">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-3 bg-white/20 backdrop-blur-md rounded-xl shadow-lg ring-2 ring-white/30">
                      <Home className="h-7 w-7 text-white drop-shadow-lg" />
                    </div>
                    <div>
                      <h1 className="text-3xl font-bold drop-shadow-md">{booking.hotelId?.name || 'Hotel'}</h1>
                      <p className="text-yellow-100 text-sm font-medium">
                        Booking #{booking.bookingNumber}
                      </p>
                    </div>
                  </div>
                  {booking.hotelId?.address && (
                    <div className="flex items-center text-sm text-yellow-100 ml-1">
                      <MapPin className="w-4 h-4 mr-1.5" />
                      {booking.hotelId.address.street}, {booking.hotelId.address.city}, {booking.hotelId.address.state}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge variant={getStatusColor(booking.status) as unknown} className="text-xs px-3 py-1">
                    {getStatusIcon(booking.status)}
                    <span className="ml-1.5 capitalize">{booking.status.replace('_', ' ')}</span>
                  </Badge>
                  <Badge variant={getPaymentStatusColor(booking.paymentStatus) as unknown} className="text-xs px-3 py-1">
                    <CreditCard className="w-3 h-3 mr-1.5" />
                    {booking.paymentStatus === 'paid' ? 'Paid' : booking.paymentStatus.replace('_', ' ')}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content - Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Booking Dates */}
            <Card className="p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-yellow-600" />
                Stay Details
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-4 border border-blue-200">
                  <p className="text-xs text-blue-700 font-semibold mb-1 uppercase tracking-wide">Check-in</p>
                  <p className="text-lg font-bold text-gray-900">{formatDate(booking.checkIn)}</p>
                  <p className="text-xs text-gray-600 mt-1">After {booking.hotelId?.policies?.checkInTime || '2:00 PM'}</p>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-xl p-4 border border-purple-200">
                  <p className="text-xs text-purple-700 font-semibold mb-1 uppercase tracking-wide">Check-out</p>
                  <p className="text-lg font-bold text-gray-900">{formatDate(booking.checkOut)}</p>
                  <p className="text-xs text-gray-600 mt-1">Before {booking.hotelId?.policies?.checkOutTime || '11:00 AM'}</p>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100/50 rounded-xl p-4 border border-green-200">
                  <p className="text-xs text-green-700 font-semibold mb-1 uppercase tracking-wide">Duration</p>
                  <p className="text-lg font-bold text-gray-900">{booking.nights} {booking.nights === 1 ? 'Night' : 'Nights'}</p>
                  <p className="text-xs text-gray-600 mt-1">Total stay</p>
                </div>
              </div>
            </Card>

            {/* Price Information - CRITICAL SECTION */}
            <Card className="p-6 border-2 border-yellow-200 shadow-lg">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-yellow-600" />
                Price Information
              </h2>

              {/* Current Price - Always Shown */}
              <div className="bg-gradient-to-br from-yellow-50 via-orange-50 to-yellow-50 rounded-xl p-6 mb-4 border-2 border-yellow-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-yellow-800 font-semibold mb-1">Current Price</p>
                    <p className="text-4xl font-bold text-gray-900">{formatCurrency(booking.totalAmount, booking.currency)}</p>
                  </div>
                  {hasAdjustments && (
                    <div className="text-right">
                      <Badge variant="success" className="text-xs mb-1">
                        <Tag className="w-3 h-3 mr-1" />
                        Price Adjusted
                      </Badge>
                    </div>
                  )}
                </div>
              </div>

              {/* Show Adjustments if Present */}
              {hasAdjustments && (
                <div className="space-y-3">
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm font-medium text-gray-600">Original Price</span>
                      <span className="text-lg font-semibold text-gray-500 line-through">
                        {formatCurrency(booking.originalAmount || 0, booking.currency)}
                      </span>
                    </div>

                    {totalDiscount > 0 && (
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                          <TrendingDown className="w-4 h-4 text-green-600" />
                          <span className="text-sm font-medium text-green-700">Discount Applied</span>
                        </div>
                        <span className="text-lg font-semibold text-green-600">
                          -{formatCurrency(totalDiscount, booking.currency)}
                        </span>
                      </div>
                    )}

                    {totalSurcharge > 0 && (
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-red-600" />
                          <span className="text-sm font-medium text-red-700">Additional Charges</span>
                        </div>
                        <span className="text-lg font-semibold text-red-600">
                          +{formatCurrency(totalSurcharge, booking.currency)}
                        </span>
                      </div>
                    )}

                    {/* Show Most Recent Adjustment Details */}
                    {booking.priceAdjustments && booking.priceAdjustments.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        {(() => {
                          const latestAdjustment = booking.priceAdjustments
                            .filter(adj => !adj.isReversed)
                            .sort((a, b) => new Date(b.adjustedAt).getTime() - new Date(a.adjustedAt).getTime())[0];

                          if (!latestAdjustment) return null;

                          return (
                            <div className="space-y-2">
                              <div className="flex items-start gap-2">
                                <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                                <div className="flex-1">
                                  <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1">Adjustment Reason</p>
                                  <p className="text-sm text-gray-600 leading-relaxed">{latestAdjustment.reason}</p>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3 mt-3">
                                <div className="bg-white rounded-lg p-2 border border-gray-200">
                                  <p className="text-xs text-gray-600 mb-0.5">Adjusted By</p>
                                  <p className="text-sm font-semibold text-gray-900">{latestAdjustment.adjustedBy.userName}</p>
                                  <p className="text-xs text-gray-500">{latestAdjustment.adjustedBy.userRole}</p>
                                </div>
                                <div className="bg-white rounded-lg p-2 border border-gray-200">
                                  <p className="text-xs text-gray-600 mb-0.5">Adjusted On</p>
                                  <p className="text-sm font-semibold text-gray-900">{formatDateTime(latestAdjustment.adjustedAt)}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Price History Toggle */}
                  {booking.priceAdjustments && booking.priceAdjustments.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowHistory(!showHistory)}
                      className="w-full text-blue-600 border-blue-300 hover:bg-blue-50"
                    >
                      <History className="w-4 h-4 mr-2" />
                      {showHistory ? 'Hide Price History' : 'View Full Price History'}
                    </Button>
                  )}
                </div>
              )}
            </Card>

            {/* Price History Section */}
            {showHistory && (
              <Card className="p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <History className="w-5 h-5 text-blue-600" />
                  Price Adjustment History
                </h2>
                {historyLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : priceHistory.length > 0 ? (
                  <div className="space-y-3">
                    {priceHistory.map((adjustment, index) => (
                      <div
                        key={adjustment.adjustmentId}
                        className={`border-l-4 ${
                          adjustment.amount < 0 ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'
                        } rounded-r-lg p-4 ${adjustment.isReversed ? 'opacity-50' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full border ${getAdjustmentTypeColor(adjustment.adjustmentType)}`}>
                                {adjustment.adjustmentType.replace('_', ' ').toUpperCase()}
                              </span>
                              {adjustment.isReversed && (
                                <Badge variant="error" size="sm">
                                  <XCircle className="w-3 h-3 mr-1" />
                                  Reversed
                                </Badge>
                              )}
                            </div>
                            <div className="mb-2">
                              <span className="text-sm font-semibold text-gray-700">
                                {formatCurrency(adjustment.previousAmount, booking.currency)}
                              </span>
                              <span className="mx-2 text-gray-400">→</span>
                              <span className="text-sm font-semibold text-gray-900">
                                {formatCurrency(adjustment.newAmount, booking.currency)}
                              </span>
                              <span className={`ml-2 text-sm font-bold ${adjustment.amount < 0 ? 'text-green-600' : 'text-red-600'}`}>
                                ({adjustment.amount > 0 ? '+' : ''}{formatCurrency(adjustment.amount, booking.currency)})
                              </span>
                            </div>
                            <p className="text-sm text-gray-700 mb-2 bg-white rounded px-3 py-2 border border-gray-200">
                              {adjustment.reason}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-gray-600">
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {adjustment.adjustedBy.userName} ({adjustment.adjustedBy.userRole})
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDateTime(adjustment.adjustedAt)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <History className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No price adjustment history available</p>
                  </div>
                )}
              </Card>
            )}

            {/* Rooms Section */}
            <Card className="p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Home className="w-5 h-5 text-yellow-600" />
                Room Details ({booking.rooms?.length || 0})
              </h2>
              <div className="space-y-3">
                {(booking.rooms || []).map((room, index) => (
                  <div key={room.roomId?._id || index} className="bg-gray-50 rounded-xl p-4 border border-gray-200 hover:border-yellow-300 transition-colors">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div>
                        <p className="text-base font-semibold text-gray-900 mb-1">
                          Room {room.roomId?.roomNumber || index + 1} - {room.roomId?.type || 'Standard'}
                        </p>
                        <p className="text-sm text-gray-600">
                          {booking.nights || 0} {booking.nights === 1 ? 'night' : 'nights'} x {formatCurrency(room.rate, booking.currency)}/night
                        </p>
                      </div>
                      <p className="text-lg font-bold text-gray-900">
                        {formatCurrency((room.rate || 0) * (booking.nights || 0), booking.currency)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Special Requests */}
            {booking.guestDetails.specialRequests && (
              <Card className="p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-blue-600" />
                  Special Requests
                </h2>
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <p className="text-sm text-gray-700 leading-relaxed">{booking.guestDetails.specialRequests}</p>
                </div>
              </Card>
            )}
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Guest Information */}
            <Card className="p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-yellow-600" />
                Guest Information
              </h2>
              <div className="space-y-3">
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <p className="text-xs text-gray-600 mb-1 uppercase tracking-wide">Name</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {booking.userId?.name?.split(' ')[0] || ''} {booking.userId?.name?.split(' ').slice(1).join(' ') || ''}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <p className="text-xs text-gray-600 mb-1 uppercase tracking-wide flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    Email
                  </p>
                  <p className="text-sm font-semibold text-gray-900 break-all">{booking.userId?.email || ''}</p>
                </div>
                {booking.userId?.phone && (
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <p className="text-xs text-gray-600 mb-1 uppercase tracking-wide flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      Phone
                    </p>
                    <p className="text-sm font-semibold text-gray-900">{booking.userId.phone}</p>
                  </div>
                )}
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <p className="text-xs text-gray-600 mb-1 uppercase tracking-wide flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    Guests
                  </p>
                  <p className="text-sm font-semibold text-gray-900">
                    {booking.guestDetails.adults} {booking.guestDetails.adults === 1 ? 'Adult' : 'Adults'}
                    {booking.guestDetails.children > 0 && `, ${booking.guestDetails.children} ${booking.guestDetails.children === 1 ? 'Child' : 'Children'}`}
                  </p>
                </div>
              </div>
            </Card>

            {/* Hotel Contact */}
            {booking.hotelId?.contact && (
              <Card className="p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">Hotel Contact</h2>
                <div className="space-y-3">
                  {booking.hotelId.contact.phone && (
                    <a
                      href={`tel:${booking.hotelId.contact.phone}`}
                      className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors"
                    >
                      <div className="p-2 bg-blue-500 rounded-lg">
                        <Phone className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-xs text-blue-700 font-semibold uppercase tracking-wide">Phone</p>
                        <p className="text-sm font-semibold text-gray-900">{booking.hotelId.contact.phone}</p>
                      </div>
                    </a>
                  )}
                  {booking.hotelId.contact.email && (
                    <a
                      href={`mailto:${booking.hotelId.contact.email}`}
                      className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg border border-purple-200 hover:bg-purple-100 transition-colors"
                    >
                      <div className="p-2 bg-purple-500 rounded-lg">
                        <Mail className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-xs text-purple-700 font-semibold uppercase tracking-wide">Email</p>
                        <p className="text-sm font-semibold text-gray-900 break-all">{booking.hotelId.contact.email}</p>
                      </div>
                    </a>
                  )}
                </div>
              </Card>
            )}

            {/* Booking Timeline */}
            <Card className="p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-yellow-600" />
                Booking Timeline
              </h2>
              <div className="space-y-3">
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <p className="text-xs text-gray-600 mb-1 uppercase tracking-wide">Booking Created</p>
                  <p className="text-sm font-semibold text-gray-900">{formatDateTime(booking.createdAt)}</p>
                </div>
                {booking.updatedAt !== booking.createdAt && (
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <p className="text-xs text-gray-600 mb-1 uppercase tracking-wide">Last Updated</p>
                    <p className="text-sm font-semibold text-gray-900">{formatDateTime(booking.updatedAt)}</p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}


export default withErrorBoundary(GuestBookingDetail, { level: 'page' });
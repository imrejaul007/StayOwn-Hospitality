import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { bookingService } from '../../services/bookingService';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Booking } from '../../types/booking';
import {
  Calendar,
  MapPin,
  Users,
  Clock,
  CreditCard,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  Download,
  Phone,
  Mail,
  Key,
  Edit,
  MessageSquare,
  Percent,
  TrendingDown,
  TrendingUp
} from 'lucide-react';
import BookingKeyGenerator from '../../components/ui/BookingKeyGenerator';
import BookingModificationModal from '../../components/ui/BookingModificationModal';
import BookingConversationModal from '../../components/ui/BookingConversationModal';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { toEntityIdString } from '../../utils/entityId';
import EmptyState from '../../components/ui/EmptyState';
import { useRealTime } from '../../services/realTimeService';
import toast from 'react-hot-toast';
import { withErrorBoundary } from '../../components/ErrorBoundary';

// Extended interface for bookings with populated hotel data
interface BookingWithHotel extends Omit<Booking, 'hotelId'> {
  hotelId:
    | string
    | {
        _id: string;
        name: string;
        address?: {
          street?: string;
          city?: string;
          state?: string;
        };
        contact?: {
          phone: string;
          email: string;
        };
      };
  /** Set on room-type-only holds when rooms[] is empty */
  roomType?: string;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'confirmed': return 'bg-green-100 text-green-800';
    case 'pending': return 'bg-yellow-100 text-yellow-800';
    case 'checked_in': return 'bg-blue-100 text-blue-800';
    case 'checked_out': return 'bg-gray-100 text-gray-800';
    case 'cancelled': return 'bg-red-100 text-red-800';
    case 'no_show': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getPaymentStatusColor = (status: string) => {
  switch (status) {
    case 'paid': return 'bg-green-100 text-green-800';
    case 'pending': return 'bg-yellow-100 text-yellow-800';
    case 'failed': return 'bg-red-100 text-red-800';
    case 'refunded': return 'bg-blue-100 text-blue-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

function hotelNameFromBooking(booking: BookingWithHotel): string {
  const h = booking.hotelId;
  if (h && typeof h === 'object' && h !== null && 'name' in h && (h as { name?: string }).name) {
    return (h as { name: string }).name;
  }
  return 'Hotel';
}

function hotelAddressLine(booking: BookingWithHotel): string | null {
  const h = booking.hotelId;
  if (!h || typeof h !== 'object' || !('address' in h) || !(h as { address?: unknown }).address) return null;
  const a = (h as { address: { street?: string; city?: string; state?: string } }).address;
  const parts = [a.street, a.city, a.state].filter((p) => p && String(p).trim());
  return parts.length ? parts.join(', ') : null;
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'confirmed': return <CheckCircle className="w-4 h-4" />;
    case 'pending': return <Clock className="w-4 h-4" />;
    case 'checked_in': return <CheckCircle className="w-4 h-4" />;
    case 'checked_out': return <CheckCircle className="w-4 h-4" />;
    case 'cancelled': return <XCircle className="w-4 h-4" />;
    case 'no_show': return <AlertCircle className="w-4 h-4" />;
    default: return <Clock className="w-4 h-4" />;
  }
};

// Helper function to check if booking has price adjustments
const hasPriceAdjustments = (booking: BookingWithHotel) => {
  return booking.priceAdjustments && booking.priceAdjustments.length > 0 &&
         booking.priceAdjustments.some(adj => !adj.isReversed);
};

// Helper function to calculate total discount/surcharge
const calculateAdjustmentAmount = (booking: BookingWithHotel) => {
  const discount = booking.discountAmount || 0;
  const surcharge = booking.surchargeAmount || 0;
  return discount - surcharge; // Positive = discount, Negative = surcharge
};

// Helper function to calculate savings percentage
const calculateSavingsPercentage = (booking: BookingWithHotel) => {
  const original = booking.originalAmount || booking.totalAmount;
  const adjustment = calculateAdjustmentAmount(booking);
  if (original === 0) return 0;
  return Math.round((adjustment / original) * 100);
};

const GuestBookingCard = React.memo(({ booking, hasDiscount, hasSurcharge, onNavigate, onCancel, onGenerateKey, onRequestModification, onStartConversation }: {
  booking: BookingWithHotel;
  hasDiscount: boolean;
  hasSurcharge: boolean;
  onNavigate: (id: string) => void;
  onCancel: (id: string) => void;
  onGenerateKey: (booking: BookingWithHotel) => void;
  onRequestModification: (booking: BookingWithHotel) => void;
  onStartConversation: (booking: BookingWithHotel) => void;
}) => (
  <Card
    className={`overflow-hidden transition-all duration-200 ${
      hasDiscount
        ? 'border-l-4 border-l-green-500 shadow-lg hover:shadow-xl'
        : hasSurcharge
        ? 'border-l-4 border-l-red-500 shadow-lg hover:shadow-xl'
        : 'hover:shadow-md'
    }`}
  >
    <div className="p-4 sm:p-6">
      {/* Booking Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-4 gap-3 sm:gap-0">
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900">
              {hotelNameFromBooking(booking)}
            </h3>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium w-fit ${getStatusColor(booking.status)}`}>
              {getStatusIcon(booking.status)}
              <span className="ml-1 capitalize">{booking.status.replace('_', ' ')}</span>
            </span>
          </div>
          <p className="text-sm text-gray-600 mb-1">Booking #{booking.bookingNumber}</p>
          {(() => {
            const line = hotelAddressLine(booking);
            return line ? (
              <div className="flex items-center text-sm text-gray-500">
                <MapPin className="w-4 h-4 mr-1 flex-shrink-0" />
                <span className="line-clamp-2">{line}</span>
              </div>
            ) : null;
          })()}
        </div>
        <div className="text-left sm:text-right">
          {hasPriceAdjustments(booking) && (
            <div className="mb-2 space-y-1">
              <div className="flex items-center justify-start sm:justify-end gap-2">
                <span className="text-sm text-gray-500 line-through">
                  {formatCurrency(booking.originalAmount || booking.totalAmount, booking.currency)}
                </span>
                {calculateAdjustmentAmount(booking) > 0 ? (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                    <TrendingDown className="w-3 h-3 mr-1" />
                    {calculateSavingsPercentage(booking)}% OFF
                  </span>
                ) : calculateAdjustmentAmount(booking) < 0 ? (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    +{Math.abs(calculateSavingsPercentage(booking))}%
                  </span>
                ) : null}
              </div>
              {booking.discountAmount && booking.discountAmount > 0 && (
                <div className="text-sm font-medium text-green-600 flex items-center justify-start sm:justify-end gap-1">
                  <Percent className="w-3 h-3" />
                  You Save {formatCurrency(booking.discountAmount, booking.currency)}
                </div>
              )}
              {booking.surchargeAmount && booking.surchargeAmount > 0 && (
                <div className="text-sm font-medium text-red-600 flex items-center justify-start sm:justify-end gap-1">
                  <TrendingUp className="w-3 h-3" />
                  Additional {formatCurrency(booking.surchargeAmount, booking.currency)}
                </div>
              )}
            </div>
          )}
          <div className="text-xl sm:text-2xl font-bold text-gray-900">
            {formatCurrency(booking.totalAmount, booking.currency)}
          </div>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium w-fit ${getPaymentStatusColor(booking.paymentStatus)}`}>
            <CreditCard className="w-3 h-3 mr-1" />
            {booking.paymentStatus === 'paid' ? 'Paid' : booking.paymentStatus.charAt(0).toUpperCase() + booking.paymentStatus.slice(1)}
          </span>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-4">
        <div className="flex items-center space-x-3">
          <Calendar className="w-5 h-5 text-yellow-600" />
          <div>
            <p className="text-sm font-medium text-gray-900">Check-in</p>
            <p className="text-sm text-gray-600">{formatDate(booking.checkIn)}</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Calendar className="w-5 h-5 text-yellow-600" />
          <div>
            <p className="text-sm font-medium text-gray-900">Check-out</p>
            <p className="text-sm text-gray-600">{formatDate(booking.checkOut)}</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Users className="w-5 h-5 text-yellow-600" />
          <div>
            <p className="text-sm font-medium text-gray-900">Guests</p>
            <p className="text-sm text-gray-600">
              {booking.guestDetails.adults}{' '}
              {booking.guestDetails.adults === 1 ? 'adult' : 'adults'}
              {booking.guestDetails.children > 0 &&
                `, ${booking.guestDetails.children} ${booking.guestDetails.children === 1 ? 'child' : 'children'}`}
            </p>
          </div>
        </div>
      </div>

      {/* Rooms */}
      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-900 mb-2">Rooms ({booking.rooms?.length || 0})</h4>
        <div className="space-y-2">
          {(booking.rooms || []).map((room, index) => (
            <div key={room.roomId || index} className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-gray-50 rounded-lg p-3 gap-2 sm:gap-0">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Room {room.roomId?.roomNumber || index + 1} - {room.roomId?.type || 'Standard'}
                </p>
                <p className="text-xs text-gray-500">
                  {booking.nights || 0} nights x {formatCurrency(room.rate, booking.currency)}/night
                </p>
              </div>
              <p className="text-sm font-semibold text-gray-900">
                {formatCurrency((room.rate || 0) * (booking.nights || 0), booking.currency)}
              </p>
            </div>
          ))}
          {(booking.rooms || []).length === 0 && booking.roomType && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-sm text-amber-900">
              Room assignment pending — <span className="font-medium capitalize">{booking.roomType}</span> requested.
              The property will assign a room before check-in.
            </div>
          )}
        </div>
      </div>

      {/* Special Requests */}
      {booking.guestDetails.specialRequests && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-900 mb-1">Special Requests</h4>
          <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
            {booking.guestDetails.specialRequests}
          </p>
        </div>
      )}

      {/* Price Adjustments */}
      {hasPriceAdjustments(booking) && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
            <Percent className="w-4 h-4 text-yellow-600" />
            Price Adjustments
          </h4>
          <div className="space-y-2">
            {booking.priceAdjustments
              ?.filter(adj => !adj.isReversed)
              .map((adjustment, index) => (
                <div
                  key={adjustment._id || index}
                  className={`flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-lg p-3 ${
                    adjustment.amount < 0
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-red-50 border border-red-200'
                  }`}
                >
                  <div className="flex items-start gap-2 mb-2 sm:mb-0">
                    {adjustment.amount < 0 ? (
                      <TrendingDown className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    ) : (
                      <TrendingUp className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                    )}
                    <div>
                      <p className={`text-sm font-medium ${adjustment.amount < 0 ? 'text-green-900' : 'text-red-900'}`}>
                        {adjustment.reason || (adjustment.amount < 0 ? 'Discount Applied' : 'Surcharge Applied')}
                      </p>
                      {adjustment.adjustedAt && (
                        <p className="text-xs text-gray-500 mt-0.5">Applied on {formatDate(adjustment.adjustedAt)}</p>
                      )}
                    </div>
                  </div>
                  <p className={`text-sm font-semibold ${adjustment.amount < 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {adjustment.amount < 0 ? '-' : '+'}{formatCurrency(Math.abs(adjustment.amount), booking.currency)}
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pt-4 border-t border-gray-200 gap-3 sm:gap-0">
        <div className="flex items-center space-x-4 text-sm text-gray-500">
          <span>Booked on {formatDate(booking.createdAt)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const bid = toEntityIdString(booking._id);
              if (bid) onNavigate(bid);
              else toast.error('Unable to open booking details');
            }}
            className="text-yellow-600 border-yellow-600 hover:bg-yellow-50"
          >
            <Eye className="w-4 h-4 mr-1" /> View Details
          </Button>
          {typeof booking.hotelId === 'object' &&
            booking.hotelId?.contact?.phone && (
            <Button variant="ghost" size="sm" onClick={() => window.open(`tel:${booking.hotelId.contact!.phone}`)}>
              <Phone className="w-4 h-4 mr-1" /> Call Hotel
            </Button>
          )}
          {typeof booking.hotelId === 'object' &&
            booking.hotelId?.contact?.email && (
            <Button variant="ghost" size="sm" onClick={() => window.open(`mailto:${booking.hotelId.contact!.email}`)}>
              <Mail className="w-4 h-4 mr-1" /> Email Hotel
            </Button>
          )}
          {['pending', 'confirmed'].includes(booking.status) && new Date(booking.checkIn) > new Date() && (
            <Button variant="ghost" size="sm" onClick={() => onRequestModification(booking)} className="text-yellow-600 border-yellow-600 hover:bg-yellow-50">
              <Edit className="w-4 h-4 mr-1" /> Request Changes
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => onStartConversation(booking)} className="text-blue-600 border-blue-600 hover:bg-blue-50">
            <MessageSquare className="w-4 h-4 mr-1" /> Contact Hotel
          </Button>
          {['confirmed', 'checked_in'].includes(booking.status) && new Date(booking.checkOut) > new Date() && (
            <Button variant="ghost" size="sm" onClick={() => onGenerateKey(booking)} className="text-blue-600 border-blue-600 hover:bg-blue-50">
              <Key className="w-4 h-4 mr-1" /> Digital Key
            </Button>
          )}
          {['pending', 'confirmed'].includes(booking.status) && new Date(booking.checkIn) > new Date(Date.now() + 24 * 60 * 60 * 1000) && (
            <Button variant="ghost" size="sm" onClick={() => {
              const bid = toEntityIdString(booking._id);
              if (bid) onCancel(bid);
            }} className="text-red-600 border-red-600 hover:bg-red-50">
              <XCircle className="w-4 h-4 mr-1" /> Cancel
            </Button>
          )}
        </div>
      </div>
    </div>
  </Card>
));
GuestBookingCard.displayName = 'GuestBookingCard';

function GuestBookings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { on, off } = useRealTime();
  const [filter, setFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const PAGE_LIMIT = 20;
  const [showKeyGenerator, setShowKeyGenerator] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingWithHotel | null>(null);
  const [showModificationModal, setShowModificationModal] = useState(false);
  const [selectedModificationBooking, setSelectedModificationBooking] = useState<BookingWithHotel | null>(null);
  const [showConversationModal, setShowConversationModal] = useState(false);
  const [selectedConversationBooking, setSelectedConversationBooking] = useState<BookingWithHotel | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

  // Reset page when filter changes
  const handleFilterChange = (newFilter: string) => {
    setFilter(newFilter);
    setPage(1);
  };

  // Map frontend filter to backend status param
  const getStatusParam = (f: string): string | undefined => {
    if (f === 'all') return undefined;
    if (f === 'upcoming') return 'confirmed,pending';
    if (f === 'active') return 'checked_in';
    if (f === 'past') return 'checked_out';
    if (f === 'cancelled') return 'cancelled,no_show';
    return f;
  };

  // Use React Query for data fetching with server-side pagination
  const { data: queryData, isLoading: loading, error } = useQuery({
    queryKey: ['bookings', 'user', user?._id, filter, page],
    queryFn: async () => {
      const response = await bookingService.getUserBookings({
        status: getStatusParam(filter),
        page,
        limit: PAGE_LIMIT
      });
      // Handle the actual API response structure
      const bookingsData = response.data?.bookings || response.data || [];
      const pagination = response.pagination || { page: 1, pages: 1, total: 0 };
      if (Array.isArray(bookingsData)) {
        return {
          bookings: bookingsData as BookingWithHotel[],
          pagination
        };
      } else {
        return { bookings: [], pagination: { page: 1, pages: 1, total: 0 } };
      }
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 3,
    placeholderData: (prev) => prev, // keep previous data while loading
  });

  const bookings = queryData?.bookings || [];
  const pagination = queryData?.pagination || { page: 1, pages: 1, total: 0 };

  // Bookings are already server-side filtered; use them directly
  const filteredBookings = bookings;

  // Real-time WebSocket updates for bookings
  useEffect(() => {
    const handleBookingUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
    };

    on('booking:created', handleBookingUpdate);
    on('booking:updated', handleBookingUpdate);
    on('booking:cancelled', handleBookingUpdate);
    on('booking:payment_updated', handleBookingUpdate);
    on('booking:modification_reviewed', handleBookingUpdate);

    return () => {
      off('booking:created', handleBookingUpdate);
      off('booking:updated', handleBookingUpdate);
      off('booking:cancelled', handleBookingUpdate);
      off('booking:payment_updated', handleBookingUpdate);
      off('booking:modification_reviewed', handleBookingUpdate);
    };
  }, [on, off, queryClient]);

  const handleCancelBooking = async (bookingId: string) => {
    setConfirmCancelId(bookingId);
  };

  const confirmCancelBooking = async () => {
    if (!confirmCancelId) return;
    const bookingId = confirmCancelId;
    setConfirmCancelId(null);

    try {
      const result = await bookingService.cancelBooking(bookingId);

      // Invalidate queries to refresh data immediately
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });

      const refundInfo = result?.data?.refund || result?.refund;
      if (refundInfo && refundInfo.amount > 0) {
        toast.success(`Booking cancelled. Refund of ${formatCurrency(refundInfo.amount)} will be processed.`);
      } else {
        toast.success('Booking cancelled successfully');
      }
    } catch (error: unknown) {
      const axiosErr = error as { response?: { data?: { message?: string } } };
      toast.error(axiosErr?.response?.data?.message || 'Failed to cancel booking');
    }
  };

  const handleGenerateKey = (booking: BookingWithHotel) => {
    setSelectedBooking(booking);
    setShowKeyGenerator(true);
  };

  const handleKeyGeneratorClose = () => {
    setShowKeyGenerator(false);
    setSelectedBooking(null);
  };

  const handleKeyGeneratorSuccess = () => {
    // Refresh data after successful key generation
    queryClient.invalidateQueries({ queryKey: ['bookings'] });
    queryClient.invalidateQueries({ queryKey: ['digital-keys'] });
  };

  const handleRequestModification = (booking: BookingWithHotel) => {
    setSelectedModificationBooking(booking);
    setShowModificationModal(true);
  };

  const handleModificationModalClose = () => {
    setShowModificationModal(false);
    setSelectedModificationBooking(null);
  };

  const handleModificationSuccess = () => {
    // Refresh data after successful modification request
    queryClient.invalidateQueries({ queryKey: ['bookings'] });
  };

  const handleStartConversation = (booking: BookingWithHotel) => {
    setSelectedConversationBooking(booking);
    setShowConversationModal(true);
  };

  const handleConversationModalClose = () => {
    setShowConversationModal(false);
    setSelectedConversationBooking(null);
  };

  if (loading && bookings.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (error && bookings.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Failed to load bookings</h2>
          <p className="text-gray-600 mb-4">{error instanceof Error ? error.message : 'An unexpected error occurred'}</p>
          <Button onClick={() => queryClient.invalidateQueries({ queryKey: ['bookings'] })} className="bg-yellow-600 hover:bg-yellow-700 text-white">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">My Bookings</h1>
        <p className="text-gray-600 text-sm sm:text-base">Manage your hotel reservations and view booking history</p>
      </div>

      {/* Filter Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto">
            {[
              { id: 'all', label: 'All Bookings' },
              { id: 'upcoming', label: 'Upcoming' },
              { id: 'active', label: 'Active' },
              { id: 'past', label: 'Past' },
              { id: 'cancelled', label: 'Cancelled' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => handleFilterChange(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap ${
                  filter === tab.id
                    ? 'border-yellow-500 text-yellow-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}{filter === tab.id && pagination.total > 0 ? ` (${pagination.total})` : ''}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Bookings List */}
      {filteredBookings.length === 0 ? (
        <EmptyState
          title="No bookings found"
          description={filter === 'all'
            ? "You haven't made any bookings yet. Browse rooms to get started."
            : `No ${filter} bookings found. Try a different filter.`}
          icon={<Calendar className="w-16 h-16" />}
          action={{ label: 'Browse Rooms', onClick: () => { navigate('/rooms'); } }}
        />
      ) : (
        <div className="space-y-6">
          {filteredBookings.map((booking) => {
            const hasDiscount = hasPriceAdjustments(booking) && calculateAdjustmentAmount(booking) > 0;
            const hasSurcharge = hasPriceAdjustments(booking) && calculateAdjustmentAmount(booking) < 0;

            return (
              <GuestBookingCard
                key={toEntityIdString(booking._id) ?? booking.bookingNumber}
                booking={booking}
                hasDiscount={hasDiscount}
                hasSurcharge={hasSurcharge}
                onNavigate={(id) => navigate(`/app/bookings/${id}`)}
                onCancel={handleCancelBooking}
                onGenerateKey={handleGenerateKey}
                onRequestModification={handleRequestModification}
                onStartConversation={handleStartConversation}
              />
            );
          })}
        </div>
      )}
      {/* Pagination Controls */}
      {pagination.pages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Showing {filteredBookings.length} of {pagination.total} bookings
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <span className="text-sm text-gray-700 px-2">
              Page {page} of {pagination.pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pagination.pages}
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Digital Key Generator Modal */}
      {showKeyGenerator && selectedBooking && (
        <BookingKeyGenerator
          booking={{
            _id: selectedBooking._id,
            bookingNumber: selectedBooking.bookingNumber,
            roomId: {
              number: selectedBooking.rooms[0]?.roomId?.roomNumber || '101',
              type: selectedBooking.rooms[0]?.roomId?.type || 'Standard',
              floor: '1'
            },
            hotelId: {
              name: hotelNameFromBooking(selectedBooking),
              address: hotelAddressLine(selectedBooking) || 'Hotel Address'
            },
            checkIn: selectedBooking.checkIn,
            checkOut: selectedBooking.checkOut,
            status: selectedBooking.status,
            guest: {
              name: (() => {
                const g = selectedBooking.guestDetails as {
                  firstName?: string;
                  lastName?: string;
                  name?: string;
                  email?: string;
                };
                const fromParts = [g.firstName, g.lastName].filter(Boolean).join(' ').trim();
                return fromParts || g.name || 'Guest';
              })(),
              email: selectedBooking.guestDetails.email || ''
            }
          }}
          onClose={handleKeyGeneratorClose}
          onSuccess={handleKeyGeneratorSuccess}
        />
      )}

      {/* Booking Modification Modal */}
      {showModificationModal && selectedModificationBooking && (
        <BookingModificationModal
          booking={{
            _id: selectedModificationBooking._id,
            bookingNumber: selectedModificationBooking.bookingNumber,
            checkIn: selectedModificationBooking.checkIn,
            checkOut: selectedModificationBooking.checkOut,
            totalAmount: selectedModificationBooking.totalAmount,
            currency: selectedModificationBooking.currency,
            guestDetails: selectedModificationBooking.guestDetails,
            nights: selectedModificationBooking.nights,
            status: selectedModificationBooking.status
          }}
          isOpen={showModificationModal}
          onClose={handleModificationModalClose}
          onSuccess={handleModificationSuccess}
        />
      )}

      {/* Booking Conversation Modal */}
      {showConversationModal && selectedConversationBooking && (
        <BookingConversationModal
          booking={{
            _id: selectedConversationBooking._id,
            bookingNumber: selectedConversationBooking.bookingNumber,
            checkIn: selectedConversationBooking.checkIn,
            checkOut: selectedConversationBooking.checkOut,
            status: selectedConversationBooking.status
          }}
          isOpen={showConversationModal}
          onClose={handleConversationModalClose}
        />
      )}

      {/* Cancel Booking Confirmation Dialog */}
      {confirmCancelId && (() => {
        const bookingToCancel = bookings?.find(b => toEntityIdString(b._id) === confirmCancelId);
        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="cancel-booking-title">
            <Card className="max-w-md w-full p-6">
              <h3 id="cancel-booking-title" className="text-lg font-semibold text-gray-900 mb-2">Cancel Booking</h3>
              <p className="text-gray-600">Are you sure you want to cancel this booking? This action cannot be undone.</p>
              {bookingToCancel && (
                <div className="mt-2 mb-4 p-2 bg-gray-50 rounded text-sm">
                  <p><strong>{hotelNameFromBooking(bookingToCancel)}</strong></p>
                  <p>{formatDate(bookingToCancel.checkIn)} - {formatDate(bookingToCancel.checkOut)}</p>
                </div>
              )}
              {!bookingToCancel && <div className="mb-4" />}
              <div className="flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setConfirmCancelId(null)}>Keep Booking</Button>
                <Button variant="ghost" className="text-red-600 hover:bg-red-50" onClick={confirmCancelBooking}>
                  <XCircle className="w-4 h-4 mr-1" /> Cancel Booking
                </Button>
              </div>
            </Card>
          </div>
        );
      })()}
    </div>
  );
}

export default withErrorBoundary(GuestBookings);

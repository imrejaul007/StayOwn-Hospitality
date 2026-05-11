import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useRealTime } from '../../services/realTimeService';
import { 
  Calendar,
  Clock, 
  MapPin,
  Users,
  Star,
  Eye,
  X,
  Filter,
  Search,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react';
import { hotelServicesService, ServiceBooking } from '../../services/hotelServicesService';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import BackButton from '../../components/ui/BackButton';
import { formatCurrency } from '../../utils/formatters';
import toast from 'react-hot-toast';
import { withErrorBoundary } from '../../components/ErrorBoundary';
import { resolvePublicHotelId } from '../../utils/publicBookingHotel';

const MyServiceBookings: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<ServiceBooking | null>(null);
  const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [page, setPage] = useState(1);

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const publicHotelId = useMemo(() => resolvePublicHotelId(searchParams), [searchParams]);
  const { on, off } = useRealTime();

  // Real-time updates for service booking status changes
  useEffect(() => {
    const handleBookingUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['service-bookings'] });
    };

    on('hotel-service-booking:updated', handleBookingUpdate);
    on('hotel-service-booking:confirmed', handleBookingUpdate);
    on('hotel-service-booking:cancelled', handleBookingUpdate);
    on('hotel-service-booking:completed', handleBookingUpdate);

    return () => {
      off('hotel-service-booking:updated', handleBookingUpdate);
      off('hotel-service-booking:confirmed', handleBookingUpdate);
      off('hotel-service-booking:cancelled', handleBookingUpdate);
      off('hotel-service-booking:completed', handleBookingUpdate);
    };
  }, [on, off, queryClient]);

  // Fetch user bookings
  const { data: bookingsData, isLoading, error } = useQuery({
    queryKey: ['service-bookings', page, statusFilter],
    queryFn: () => hotelServicesService.getUserBookings({
      page,
      limit: 10,
      status: statusFilter || undefined
    }),
    staleTime: 5 * 60 * 1000
  });

  // Cancel booking mutation
  const cancelMutation = useMutation({
    mutationFn: (data: { bookingId: string; reason: string }) =>
      hotelServicesService.cancelBooking(data.bookingId, { reason: data.reason }, publicHotelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-bookings'] });
      toast.success('Booking cancelled successfully');
      setCancellingBookingId(null);
      setCancelReason('');
    },
    onError: (error: Error) => {
      const axiosError = error as Error & { response?: { data?: { message?: string } } };
      toast.error(axiosError.response?.data?.message || 'Failed to cancel booking');
    }
  });

  const handleCancelBooking = (bookingId: string) => {
    if (!cancelReason.trim()) {
      toast.error('Please provide a reason for cancellation');
      return;
    }
    
    cancelMutation.mutate({ bookingId, reason: cancelReason });
  };

  const filteredBookings = bookingsData?.bookings?.filter(booking => 
    !searchTerm || 
    booking.serviceId.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    booking.serviceId.type.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle className="h-5 w-5 text-blue-500" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'cancelled':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const canCancelBooking = (booking: ServiceBooking) => {
    return hotelServicesService.canCancelBooking(booking) && 
           hotelServicesService.isUpcomingBooking(booking);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto">
          <BackButton to="/app/services" label="Back to Services" className="mb-6" />
          <Card className="p-8 text-center">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Unable to Load Bookings</h2>
            <p className="text-gray-600 mb-4">
              There was an error loading your service bookings. Please try again.
            </p>
            <Button onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <BackButton to="/app/services" label="Back to Services" className="mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            My Service Bookings
          </h1>
          <p className="text-gray-600">
            Manage your hotel service bookings and view booking history
          </p>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <Input
              type="text"
              placeholder="Search bookings by service name or type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Filter className="h-5 w-5 text-gray-500" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {(statusFilter || searchTerm) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStatusFilter('');
                  setSearchTerm('');
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>
        </div>

        {/* Bookings List */}
        {filteredBookings.length === 0 ? (
          <Card className="p-8 text-center">
            <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Bookings Found</h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || statusFilter ? 
                'No bookings match your search criteria.' :
                'You haven\'t made any service bookings yet.'
              }
            </p>
            <Button onClick={() => navigate('/app/services')}>
              Browse Services
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredBookings.map((booking) => (
              <Card key={booking._id} className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  {/* Booking Info */}
                  <div className="flex-1">
                    <div className="flex items-start gap-4">
                      {/* Service Image */}
                      <div className="w-16 h-16 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                        {booking.serviceId.images && booking.serviceId.images.length > 0 ? (
                          <img
                            src={booking.serviceId.images[0]}
                            alt={booking.serviceId.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <span className="text-2xl">
                              {hotelServicesService.getServiceTypeInfo(booking.serviceId.type).icon}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Service Details */}
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {booking.serviceId.name}
                          </h3>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(booking.status)}
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>
                              {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-3">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span>{formatDateTime(booking.bookingDate)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            <span>{booking.numberOfPeople} people</span>
                          </div>
                          {booking.hotelId?.name && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              <span>{booking.hotelId.name}</span>
                            </div>
                          )}
                        </div>

                        <div className="text-lg font-semibold text-green-600">
                          {formatCurrency(booking.totalAmount, booking.currency)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/app/services/bookings/confirmation/${booking._id}`)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Details
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedBooking(booking)}
                      className="text-gray-600 hover:text-gray-700"
                    >
                      Quick View
                    </Button>

                    {canCancelBooking(booking) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCancellingBookingId(booking._id)}
                        className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>

                {/* Special Requests */}
                {booking.specialRequests && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-sm text-gray-600">
                      <strong>Special Requests:</strong> {booking.specialRequests}
                    </p>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        {bookingsData?.pagination && bookingsData.pagination.totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-8">
            <Button
              variant="outline"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={!bookingsData.pagination.hasPrev}
            >
              Previous
            </Button>
            <span className="flex items-center px-4 py-2 text-sm text-gray-600">
              Page {bookingsData.pagination.currentPage} of {bookingsData.pagination.totalPages}
            </span>
            <Button
              variant="outline"
              onClick={() => setPage(page + 1)}
              disabled={!bookingsData.pagination.hasNext}
            >
              Next
            </Button>
          </div>
        )}

        {/* Booking Details Modal */}
        {selectedBooking && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <h2 className="text-xl font-semibold text-gray-900">Booking Details</h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedBooking(null)}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                <div className="space-y-6">
                  {/* Service Info */}
                  <div>
                    <h3 className="font-medium text-gray-900 mb-3">Service Information</h3>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900">{selectedBooking.serviceId.name}</h4>
                      <p className="text-gray-600 text-sm mt-1">{selectedBooking.serviceId.type}</p>
                    </div>
                  </div>

                  {/* Booking Details */}
                  <div>
                    <h3 className="font-medium text-gray-900 mb-3">Booking Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-gray-600">Booking Date</label>
                        <p className="font-medium">{formatDateTime(selectedBooking.bookingDate)}</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-600">Number of People</label>
                        <p className="font-medium">{selectedBooking.numberOfPeople}</p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-600">Total Amount</label>
                        <p className="font-medium text-green-600">
                          {formatCurrency(selectedBooking.totalAmount, selectedBooking.currency)}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm text-gray-600">Status</label>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(selectedBooking.status)}
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedBooking.status)}`}>
                            {selectedBooking.status.charAt(0).toUpperCase() + selectedBooking.status.slice(1)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Special Requests */}
                  {selectedBooking.specialRequests && (
                    <div>
                      <h3 className="font-medium text-gray-900 mb-3">Special Requests</h3>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-gray-700">{selectedBooking.specialRequests}</p>
                      </div>
                    </div>
                  )}

                  {/* Cancellation Info */}
                  {selectedBooking.status === 'cancelled' && selectedBooking.cancellationReason && (
                    <div>
                      <h3 className="font-medium text-gray-900 mb-3">Cancellation Information</h3>
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <p className="text-red-800"><strong>Reason:</strong> {selectedBooking.cancellationReason}</p>
                        {selectedBooking.cancelledAt && (
                          <p className="text-red-600 text-sm mt-1">
                            Cancelled on {new Date(selectedBooking.cancelledAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Cancel Booking Modal */}
        {cancellingBookingId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <Card className="max-w-md w-full">
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Cancel Booking</h2>
                <p className="text-gray-600 mb-4">
                  Please provide a reason for cancelling this booking:
                </p>
                
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Reason for cancellation..."
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
                />
                
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCancellingBookingId(null);
                      setCancelReason('');
                    }}
                  >
                    Close
                  </Button>
                  <Button
                    onClick={() => handleCancelBooking(cancellingBookingId)}
                    disabled={!cancelReason.trim() || cancelMutation.isPending}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {cancelMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Cancelling...
                      </>
                    ) : (
                      'Confirm Cancellation'
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default withErrorBoundary(MyServiceBookings, { level: 'page' });
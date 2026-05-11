import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { staffBookingService, StaffUpcomingBooking, StaffUpcomingStats, ExtraPersonCharge } from '../../services/staffBookingService';
import { format, parseISO, isToday, isTomorrow } from 'date-fns';
import toast from 'react-hot-toast';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { BookingEditModal } from '../../components/booking/BookingEditModal';
import { withErrorBoundary } from '../../components/ErrorBoundary';
import { useRealTime } from '../../services/realTimeService';
import {
  Calendar,
  Users,
  Clock,
  Eye,
  RefreshCw,
  CalendarDays,
  Phone,
  Mail,
  CreditCard,
  Search,
  CheckSquare,
  AlertTriangle,
  Star,
  MessageSquare,
  Edit
} from 'lucide-react';

function StaffUpcomingBookings() {
  const { on, off } = useRealTime();
  const [bookings, setBookings] = useState<StaffUpcomingBooking[]>([]);
  const [stats, setStats] = useState<StaffUpcomingStats>({
    todayArrivals: 0,
    tomorrowArrivals: 0,
    totalUpcoming: 0
  });
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    days: 3, // Staff typically focuses on next 3 days
    page: 1,
    limit: 20,
    search: ''
  });
  const [selectedBooking, setSelectedBooking] = useState<StaffUpcomingBooking | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedBookingForEdit, setSelectedBookingForEdit] = useState<StaffUpcomingBooking | null>(null);
  // Track whether the component is mounted to avoid state updates after unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Fetch upcoming bookings
  const fetchUpcomingBookings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await staffBookingService.getUpcomingBookings({
        days: filters.days,
        page: filters.page,
        limit: filters.limit
      });

      if (!mountedRef.current) return;
      setBookings(response.data || []);
      setStats(response.stats || { todayArrivals: 0, tomorrowArrivals: 0, totalUpcoming: 0 });
      setTotalPages(response.pagination?.pages ?? 1);
    } catch (_err) {
      if (!mountedRef.current) return;
      setError('Failed to load upcoming bookings. Please try again.');
      toast.error('Failed to load upcoming bookings');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [filters.days, filters.page, filters.limit]);

  useEffect(() => {
    fetchUpcomingBookings();
  }, [fetchUpcomingBookings]);

  // Real-time WebSocket listeners for booking events
  useEffect(() => {
    const handleBookingEvent = () => {
      fetchUpcomingBookings();
    };
    on('booking:created', handleBookingEvent);
    on('booking:updated', handleBookingEvent);
    on('booking:cancelled', handleBookingEvent);
    return () => {
      off('booking:created', handleBookingEvent);
      off('booking:updated', handleBookingEvent);
      off('booking:cancelled', handleBookingEvent);
    };
  }, [on, off, fetchUpcomingBookings]);

  const parseBookingDate = (value: unknown): Date | null => {
    if (!value) return null;

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }

    if (typeof value === 'number') {
      const fromNumber = new Date(value);
      return Number.isNaN(fromNumber.getTime()) ? null : fromNumber;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return null;
      const parsedIso = parseISO(trimmed);
      if (!Number.isNaN(parsedIso.getTime())) return parsedIso;
      const parsedDate = new Date(trimmed);
      return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
    }

    if (typeof value === 'object') {
      const candidate = value as { $date?: unknown; date?: unknown };
      return parseBookingDate(candidate.$date ?? candidate.date ?? null);
    }

    return null;
  };

  // Filter bookings by search term
  const filteredBookings = bookings.filter(booking => {
    if (!filters.search) return true;
    const searchTerm = filters.search.toLowerCase();
    return (
      booking.userId?.name?.toLowerCase().includes(searchTerm) ||
      booking.userId?.email?.toLowerCase().includes(searchTerm) ||
      booking.bookingNumber?.toLowerCase().includes(searchTerm) ||
      booking.rooms?.some(room => room.roomId?.roomNumber?.toLowerCase().includes(searchTerm))
    );
  });

  // Get arrival priority (today = high, tomorrow = medium, later = low)
  const getArrivalPriority = (checkIn: unknown) => {
    const date = parseBookingDate(checkIn);
    if (!date) {
      return { level: 'low', label: 'Date TBD', color: 'bg-gray-100 text-gray-800 border-gray-200' };
    }
    if (isToday(date)) return { level: 'high', label: 'Today', color: 'bg-red-100 text-red-800 border-red-200' };
    if (isTomorrow(date)) return { level: 'medium', label: 'Tomorrow', color: 'bg-orange-100 text-orange-800 border-orange-200' };
    return { level: 'low', label: format(date, 'MMM dd'), color: 'bg-gray-100 text-gray-800 border-gray-200' };
  };

  // Get status color for staff view
  const getStatusColor = (status: string): 'success' | 'warning' | 'info' | 'secondary' => {
    switch (status) {
      case 'confirmed': return 'success';
      case 'pending': return 'warning';
      case 'checked_in': return 'info';
      default: return 'secondary';
    }
  };

  // Separate bookings by priority.
  // Bookings with unparseable dates fall into "later" so they are still visible.
  const todayBookings = filteredBookings.filter((booking) => {
    const checkInDate = parseBookingDate(booking.checkIn);
    return checkInDate ? isToday(checkInDate) : false;
  });
  const tomorrowBookings = filteredBookings.filter((booking) => {
    const checkInDate = parseBookingDate(booking.checkIn);
    return checkInDate ? isTomorrow(checkInDate) : false;
  });
  const laterBookings = filteredBookings.filter((booking) => {
    const checkInDate = parseBookingDate(booking.checkIn);
    // null dates (unknown check-in) are included in "later" so they are visible
    if (!checkInDate) return true;
    return !isToday(checkInDate) && !isTomorrow(checkInDate);
  });

  // Render booking card
  const renderBookingCard = (booking: StaffUpcomingBooking) => {
    const priority = getArrivalPriority(booking.checkIn);
    const hasSpecialRequests = booking.guestDetails?.specialRequests;

    return (
      <Card key={booking._id} className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <Badge className={`${priority.color} border`}>
                {priority.label}
              </Badge>
              {hasSpecialRequests && (
                <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                  <MessageSquare className="h-3 w-3 mr-1" />
                  Special Request
                </Badge>
              )}
            </div>
            <Badge variant={getStatusColor(booking.status)}>
              {booking.status.replace(/_/g, ' ')}
            </Badge>
          </div>

          <div className="space-y-3">
            {/* Guest Info */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{booking.userId?.name}</h3>
                <p className="text-sm text-gray-600">{booking.bookingNumber}</p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-sm text-gray-600">
                  <Users className="h-4 w-4" />
                  <span>{booking.guestDetails?.adults || 1}</span>
                  {(booking.guestDetails?.children ?? 0) > 0 && (
                    <span>+{booking.guestDetails!.children}</span>
                  )}
                </div>
                {booking.extraPersons && booking.extraPersons.length > 0 && (
                  <div className="mt-1">
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                      +{booking.extraPersons.filter(p => p.isActive).length} extra
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Contact Info */}
            <div className="space-y-1">
              {booking.userId?.phone && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone className="h-4 w-4" />
                  <span>{booking.userId.phone}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Mail className="h-4 w-4" />
                <span className="truncate">{booking.userId?.email}</span>
              </div>
            </div>

            {/* Room Info */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Rooms & Duration:</span>
                <span className="text-sm text-gray-600">{booking.nights} nights</span>
              </div>
              {booking.rooms?.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {booking.rooms.map((room, idx) => (
                    <Badge key={room.roomId?._id ?? idx} variant="outline" className="bg-blue-50 text-blue-700">
                      {room.roomId?.roomNumber}
                    </Badge>
                  ))}
                </div>
              ) : (
                <Badge variant="outline" className="bg-gray-50 text-gray-600">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  No room assigned
                </Badge>
              )}
            </div>

            {/* Special Requests Preview */}
            {hasSpecialRequests && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2">
                <p className="text-sm text-yellow-800 line-clamp-2">
                  <strong>Special Request:</strong> {booking.guestDetails.specialRequests}
                </p>
              </div>
            )}

            {/* Payment Status */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium">
                  ₹{(booking.totalAmount ?? 0).toLocaleString()}
                </span>
                <Badge
                  variant={booking.paymentStatus === 'paid' ? 'success' : 'warning'}
                  className="text-xs"
                >
                  {booking.paymentStatus}
                </Badge>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedBooking(booking);
                    setShowDetailsModal(true);
                  }}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  View
                </Button>
                {['confirmed', 'checked_in', 'checked_out'].includes(booking.status) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedBookingForEdit(booking);
                      setIsEditModalOpen(true);
                    }}
                    aria-label="Edit booking"
                    title="Edit Booking (Add Extra Persons)"
                  >
                    <Edit className="h-4 w-4" aria-hidden="true" />
                  </Button>
                )}
              </div>
            </div>

            {/* Extra Person Payment Status */}
            {booking.extraPersons && booking.extraPersons.length > 0 && booking.extraPersonCharges && booking.extraPersonCharges.length > 0 && (
              (() => {
                const extraPersonCharges: ExtraPersonCharge[] = booking.extraPersonCharges ?? [];
                const unpaidCharges = extraPersonCharges.filter((c) => !c.isPaid);
                const totalUnpaid = unpaidCharges.reduce(
                  (sum, c) => sum + ((c.totalCharge ?? 0) - (c.paidAmount ?? 0)),
                  0
                );
                const hasUnpaid = unpaidCharges.length > 0 && totalUnpaid > 0;
                const totalPaid = extraPersonCharges.reduce((sum, c) => sum + (c.paidAmount ?? 0), 0);
                return (
                  <div className="pt-2 mt-2 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="text-sm">
                        {hasUnpaid ? (
                          <span className="text-red-600 font-medium flex items-center gap-1">
                            <span className="inline-block w-2 h-2 bg-red-500 rounded-full" aria-hidden="true"></span>
                            ₹{totalUnpaid.toLocaleString()} Due
                          </span>
                        ) : (
                          <span className="text-green-600 font-medium flex items-center gap-1">
                            <span className="inline-block w-2 h-2 bg-green-500 rounded-full" aria-hidden="true"></span>
                            ₹{totalPaid.toLocaleString()} Paid ✓
                          </span>
                        )}
                      </div>
                      {/* Proceed Payment Button - Only show if there are unpaid charges */}
                      {hasUnpaid && (
                        <Button
                          size="sm"
                          variant="default"
                          className="bg-orange-600 hover:bg-orange-700 text-white"
                          onClick={() => {
                            setSelectedBookingForEdit(booking);
                            setIsEditModalOpen(true);
                          }}
                        >
                          <CreditCard className="h-3 w-3 mr-1" />
                          Proceed Payment
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })()
            )}

            {/* Settlement Status */}
            {(() => {
              const settlement = booking.settlementTracking;
              // Show outstanding balance if there is one, OR show settled state if completed
              const hasOutstanding = settlement != null && (settlement.outstandingBalance ?? 0) > 0;
              const isSettled = settlement != null && settlement.status === 'completed' && !hasOutstanding;

              if (hasOutstanding || isSettled) {
                return (
                  <div className="pt-2 mt-2 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="text-sm">
                        {hasOutstanding ? (
                          <span className="text-yellow-600 font-medium flex items-center gap-1">
                            <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full" aria-hidden="true"></span>
                            ₹{(settlement!.outstandingBalance).toLocaleString()} Outstanding
                          </span>
                        ) : (
                          <span className="text-green-600 font-medium flex items-center gap-1">
                            <span className="inline-block w-2 h-2 bg-green-500 rounded-full" aria-hidden="true"></span>
                            ₹{(settlement?.finalAmount ?? 0).toLocaleString()} Settled ✓
                          </span>
                        )}
                      </div>

                      {hasOutstanding && (
                        <Button
                          size="sm"
                          variant="default"
                          className="bg-purple-600 hover:bg-purple-700 text-white"
                          onClick={() => {
                            setSelectedBookingForEdit(booking);
                            setIsEditModalOpen(true);
                          }}
                        >
                          <CreditCard className="h-3 w-3 mr-1" />
                          Pay Settlement
                        </Button>
                      )}
                    </div>
                  </div>
                );
              }
              return null;
            })()}
          </div>
        </CardContent>
      </Card>
    );
  };

  // Handle booking update after editing
  const handleBookingUpdated = () => {
    setIsEditModalOpen(false);
    setSelectedBookingForEdit(null);
    fetchUpcomingBookings(); // Refresh the list
    toast.success('Booking updated successfully');
  };

  if (loading && bookings.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error Banner */}
      {error && (
        <div role="alert" className="bg-red-50 border-l-4 border-red-400 p-4 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
          <button
            onClick={() => { setError(null); fetchUpcomingBookings(); }}
            className="text-sm text-red-600 font-medium hover:text-red-800 underline ml-4"
          >
            Retry
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Upcoming Arrivals</h1>
          <p className="text-gray-600">Prepare for guest arrivals and check-ins</p>
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={fetchUpcomingBookings}
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-700">Today's Arrivals</p>
                <p className="text-3xl font-bold text-red-600">{stats.todayArrivals}</p>
                <p className="text-xs text-red-600 mt-1">Requires immediate attention</p>
              </div>
              <div className="p-3 bg-red-100 rounded-lg">
                <Calendar className="h-8 w-8 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-700">Tomorrow's Arrivals</p>
                <p className="text-3xl font-bold text-orange-600">{stats.tomorrowArrivals}</p>
                <p className="text-xs text-orange-600 mt-1">Prepare rooms & amenities</p>
              </div>
              <div className="p-3 bg-orange-100 rounded-lg">
                <Clock className="h-8 w-8 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Upcoming</p>
                <p className="text-3xl font-bold text-blue-600">{stats.totalUpcoming}</p>
                <p className="text-xs text-gray-600 mt-1">Next {filters.days} days</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <CalendarDays className="h-8 w-8 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">View:</label>
              <select
                value={filters.days}
                onChange={(e) => setFilters(prev => ({ ...prev, days: parseInt(e.target.value), page: 1 }))}
                className="border border-gray-300 rounded-md px-3 py-1 text-sm"
              >
                <option value={1}>Today only</option>
                <option value={2}>Next 2 days</option>
                <option value={3}>Next 3 days</option>
                <option value={7}>Next 7 days</option>
              </select>
            </div>
            <div className="flex-1">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search by guest name, booking number, or room..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Today's Arrivals */}
      {todayBookings.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-red-600" />
            Today's Arrivals ({todayBookings.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {todayBookings.map(renderBookingCard)}
          </div>
        </div>
      )}

      {/* Tomorrow's Arrivals */}
      {tomorrowBookings.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-orange-600" />
            Tomorrow's Arrivals ({tomorrowBookings.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tomorrowBookings.map(renderBookingCard)}
          </div>
        </div>
      )}

      {/* Later Arrivals */}
      {laterBookings.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-gray-600" />
            Later Arrivals ({laterBookings.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {laterBookings.map(renderBookingCard)}
          </div>
        </div>
      )}

      {/* No Data State */}
      {filteredBookings.length === 0 && !loading && (
        <Card>
          <CardContent className="p-12 text-center">
            <CalendarDays className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Upcoming Arrivals</h3>
            <p className="text-gray-600">
              {filters.search
                ? "No bookings match your search criteria."
                : `No arrivals scheduled for the next ${filters.days} days.`
              }
            </p>
          </CardContent>
        </Card>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && !filters.search && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-gray-600">
            Page {filters.page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={filters.page <= 1 || loading}
              onClick={() => setFilters(prev => ({ ...prev, page: prev.page - 1 }))}
            >
              Previous
            </Button>
            <span className="text-sm text-gray-600">
              {filters.page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={filters.page >= totalPages || loading}
              onClick={() => setFilters(prev => ({ ...prev, page: prev.page + 1 }))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Booking Details Modal */}
      {showDetailsModal && selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Arrival Details</h2>
                <button aria-label="Close"
                  onClick={() => setShowDetailsModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="p-6 space-y-6">
              {/* Priority Badge */}
              <div className="flex items-center gap-2">
                <Badge className={`${getArrivalPriority(selectedBooking.checkIn).color} border`}>
                  {getArrivalPriority(selectedBooking.checkIn).label}
                </Badge>
                <Badge variant={getStatusColor(selectedBooking.status)}>
                  {selectedBooking.status.replace(/_/g, ' ')}
                </Badge>
              </div>

              {/* Guest Information */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Guest Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Name:</span>
                    <p className="font-medium">{selectedBooking.userId?.name}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Booking Number:</span>
                    <p className="font-medium">{selectedBooking.bookingNumber}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Email:</span>
                    <p className="font-medium break-all">{selectedBooking.userId?.email}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Phone:</span>
                    <p className="font-medium">{selectedBooking.userId?.phone || 'Not provided'}</p>
                  </div>
                </div>
              </div>

              {/* Stay Information */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Stay Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Check-in:</span>
                    <p className="font-medium">
                      {(() => {
                        const checkInDate = parseBookingDate(selectedBooking.checkIn);
                        return checkInDate ? format(checkInDate, 'PPP') : 'N/A';
                      })()}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Check-out:</span>
                    <p className="font-medium">
                      {(() => {
                        const checkOutDate = parseBookingDate(selectedBooking.checkOut);
                        return checkOutDate ? format(checkOutDate, 'PPP') : 'N/A';
                      })()}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Duration:</span>
                    <p className="font-medium">{selectedBooking.nights} nights</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Guests:</span>
                    <p className="font-medium">
                      {selectedBooking.guestDetails?.adults || 1} adults
                      {(selectedBooking.guestDetails?.children ?? 0) > 0 && `, ${selectedBooking.guestDetails!.children} children`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Room Information */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Room Assignment</h3>
                {selectedBooking.rooms?.length > 0 ? (
                  <div className="space-y-2">
                    {selectedBooking.rooms.map((room, idx) => (
                      <div key={room.roomId?._id ?? idx} className="flex justify-between items-center bg-green-50 p-3 rounded border border-green-200">
                        <span className="font-medium text-green-800">
                          Room {room.roomId?.roomNumber} ({room.roomId?.type})
                        </span>
                        <Badge variant="success">Ready for arrival</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-red-800">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="font-medium">No room assigned yet</span>
                    </div>
                    <p className="text-sm text-red-600 mt-1">
                      Contact admin to assign rooms before guest arrival.
                    </p>
                  </div>
                )}
              </div>

              {/* Special Requests */}
              {selectedBooking.guestDetails?.specialRequests && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Star className="h-4 w-4 text-yellow-500" />
                    Special Requests
                  </h3>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-sm text-yellow-800">
                      {selectedBooking.guestDetails.specialRequests}
                    </p>
                  </div>
                </div>
              )}

              {/* Payment Information */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Payment Status</h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Total Amount:</span>
                    <span className="font-semibold text-lg">₹{(selectedBooking.totalAmount ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-gray-600">Payment Status:</span>
                    <Badge variant={selectedBooking.paymentStatus === 'paid' ? 'success' : 'warning'}>
                      {selectedBooking.paymentStatus}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Staff Preparation Checklist */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-blue-500" />
                  Preparation Checklist
                </h3>
                <div className="space-y-2 text-sm">
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span>Room cleaned and inspected</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span>Amenities stocked</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span>Welcome kit prepared</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span>Special requests noted</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span>Payment status verified</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end">
              <Button onClick={() => setShowDetailsModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Booking Edit Modal */}
      <BookingEditModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedBookingForEdit(null);
        }}
        booking={selectedBookingForEdit}
        onBookingUpdated={handleBookingUpdated}
      />
    </div>
  );
}

export default withErrorBoundary(StaffUpcomingBookings, { level: 'page' });
import React, { useState, useEffect } from 'react';
import { DataTable } from '../../components/dashboard/DataTable';
import { StatusBadge } from '../../components/dashboard/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { adminService } from '../../services/adminService';
import { AdminBooking } from '../../types/admin';
import { formatCurrency, formatNumber, getStatusColor } from '../../utils/dashboardUtils';
import { format, parseISO, isToday, isTomorrow, addDays } from 'date-fns';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import { BookingEditModal } from '../../components/booking/BookingEditModal';
import { withErrorBoundary } from '../../components/ErrorBoundary';
import { useRealTime } from '../../services/realTimeService';
import {
  Calendar,
  Users,
  Clock,
  CheckCircle,
  Eye,
  UserCheck,
  Filter,
  RefreshCw,
  CalendarDays,
  MapPin,
  Phone,
  Mail,
  CreditCard,
  Building,
  Search,
  Edit
} from 'lucide-react';

interface UpcomingBookingsStats {
  todayArrivals: number;
  tomorrowArrivals: number;
  totalUpcoming: number;
}

function AdminUpcomingBookings() {
  const { user } = useAuth();
  const { on, off } = useRealTime();
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [stats, setStats] = useState<UpcomingBookingsStats>({
    todayArrivals: 0,
    tomorrowArrivals: 0,
    totalUpcoming: 0
  });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    days: 7,
    page: 1,
    limit: 50,
    search: ''
  });
  const [pagination, setPagination] = useState({
    current: 1,
    pages: 1,
    total: 0
  });
  const [selectedBooking, setSelectedBooking] = useState<AdminBooking | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedBookingForEdit, setSelectedBookingForEdit] = useState<AdminBooking | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Fetch upcoming bookings
  const fetchUpcomingBookings = async () => {
    try {
      setLoading(true);
      const response = await adminService.getUpcomingBookings({
        days: filters.days,
        page: filters.page,
        limit: filters.limit
      });

      setBookings(response.data || []);
      setStats(response.stats || { todayArrivals: 0, tomorrowArrivals: 0, totalUpcoming: 0 });
      setPagination(response.pagination || { current: 1, pages: 1, total: 0 });
    } catch (error) {
      toast.error('Failed to load upcoming bookings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUpcomingBookings();
  }, [filters.days, filters.page]);

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
  }, [on, off]);

  // Filter bookings by search term and remove invalid entries
  const filteredBookings = bookings
    .filter(booking => {
      // First, filter out any null/undefined bookings
      if (!booking) {
        return false;
      }

      // Then apply search filter
      if (!filters.search) return true;
      const searchTerm = filters.search.toLowerCase();
      return (
        booking.userId?.name?.toLowerCase().includes(searchTerm) ||
        booking.userId?.email?.toLowerCase().includes(searchTerm) ||
        booking.bookingNumber?.toLowerCase().includes(searchTerm) ||
        booking.rooms?.some(room => room.roomId?.roomNumber?.toLowerCase().includes(searchTerm))
      );
    });

  // Get arrival date info
  const getArrivalInfo = (checkIn: string) => {
    const date = parseISO(checkIn);
    if (isToday(date)) return { label: 'Today', color: 'bg-red-100 text-red-800' };
    if (isTomorrow(date)) return { label: 'Tomorrow', color: 'bg-orange-100 text-orange-800' };
    return { label: format(date, 'MMM dd'), color: 'bg-gray-100 text-gray-800' };
  };

  // Table columns for upcoming bookings
  const columns = [
    {
      key: 'arrival',
      header: 'Arrival',
      render: (value: unknown, booking: AdminBooking) => {
        if (!booking || !booking.checkIn) {
          return <span className="text-gray-500">Invalid booking</span>;
        }

        const info = getArrivalInfo(booking.checkIn);
        return (
          <div className="flex flex-col">
            <span className={`px-2 py-1 text-xs rounded-full font-medium ${info.color} inline-block w-fit`}>
              {info.label}
            </span>
            <span className="text-xs text-gray-500 mt-1">
              {format(parseISO(booking.checkIn), 'MMM dd, yyyy')}
            </span>
          </div>
        );
      }
    },
    {
      key: 'guest',
      header: 'Guest',
      render: (value: unknown, booking: AdminBooking) => {
        if (!booking) {
          return <span className="text-gray-500">Invalid booking</span>;
        }

        return (
          <div className="flex flex-col">
            <span className="font-medium">{booking.userId?.name || 'Unknown'}</span>
            <span className="text-sm text-gray-500">{booking.bookingNumber || 'N/A'}</span>
            <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
              <Users className="h-3 w-3" />
              <span>{booking.guestDetails?.adults || 1} adults</span>
              {booking.guestDetails?.children > 0 && (
                <span>, {booking.guestDetails.children} children</span>
              )}
              {booking.extraPersons && booking.extraPersons.length > 0 && (
                <div className="flex items-center gap-1 mt-1">
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                    +{booking.extraPersons.filter(p => p.isActive).length} extra
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      }
    },
    {
      key: 'rooms',
      header: 'Rooms',
      render: (value: unknown, booking: AdminBooking) => {
        if (!booking) {
          return <span className="text-gray-500">Invalid booking</span>;
        }

        return (
          <div className="flex flex-col">
            <div className="flex flex-wrap gap-1">
              {booking.rooms?.map((room, idx) => (
                <span key={idx} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                  {room.roomId?.roomNumber || `Room ${idx + 1}`}
                </span>
              )) || <span className="text-gray-500 text-sm">No rooms assigned</span>}
            </div>
            <span className="text-xs text-gray-500 mt-1">
              {booking.nights || 0} {(booking.nights === 1) ? 'night' : 'nights'}
            </span>
          </div>
        );
      }
    },
    {
      key: 'contact',
      header: 'Contact',
      render: (value: unknown, booking: AdminBooking) => {
        if (!booking) {
          return <span className="text-gray-500">Invalid booking</span>;
        }

        return (
          <div className="flex flex-col space-y-1">
            {booking.userId?.email && (
              <div className="flex items-center gap-1 text-xs">
                <Mail className="h-3 w-3 text-gray-400" />
                <span className="truncate max-w-[150px]">{booking.userId.email}</span>
              </div>
            )}
            {booking.userId?.phone && (
              <div className="flex items-center gap-1 text-xs">
                <Phone className="h-3 w-3 text-gray-400" />
                <span>{booking.userId.phone}</span>
              </div>
            )}
          </div>
        );
      }
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (value: unknown, booking: AdminBooking) => {
        if (!booking) {
          return <span className="text-gray-500">Invalid booking</span>;
        }

        return (
          <div className="flex flex-col">
            <span className="font-semibold">
              {formatCurrency(booking.totalAmount || 0, booking.currency || 'INR')}
            </span>
            <StatusBadge
              status={booking.paymentStatus || 'unknown'}
              variant={booking.paymentStatus === 'paid' ? 'success' :
                       booking.paymentStatus === 'pending' ? 'warning' : 'error'}
            />
          </div>
        );
      }
    },
    {
      key: 'status',
      header: 'Status',
      render: (value: unknown, booking: AdminBooking) => {
        if (!booking) {
          return <span className="text-gray-500">Invalid booking</span>;
        }

        return (
          <StatusBadge
            status={booking.status || 'unknown'}
            variant={booking.status === 'confirmed' ? 'success' :
                     booking.status === 'pending' ? 'warning' : 'default'}
          />
        );
      }
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (value: unknown, booking: AdminBooking) => {
        if (!booking) {
          return <span className="text-gray-500">Invalid booking</span>;
        }

        // Check if there are unpaid extra person charges
        const hasExtraPersons = booking.extraPersons && booking.extraPersons.length > 0;
        const extraPersonCharges = booking.extraPersonCharges || [];
        const unpaidCharges = extraPersonCharges.filter(charge => !charge.isPaid);
        const totalUnpaidCharges = unpaidCharges.reduce((sum, charge) => sum + (charge.totalCharge - (charge.paidAmount || 0)), 0);
        const hasUnpaidCharges = hasExtraPersons && unpaidCharges.length > 0 && totalUnpaidCharges > 0;

        return (
          <div className="flex flex-col gap-2 min-w-[220px]">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSelectedBooking(booking);
                  setShowDetailsModal(true);
                }}
                title="View Details"
              >
                <Eye className="h-4 w-4" />
              </Button>
              {['confirmed', 'checked_in', 'checked_out'].includes(booking.status) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedBookingForEdit(booking);
                    setIsEditModalOpen(true);
                  }}
                  title="Edit Booking (Add Extra Persons)"
                >
                  <Edit className="h-4 w-4" />
                </Button>
              )}
              {booking.status === 'pending' && (
                <Button
                  size="sm"
                  onClick={() => handleConfirmBooking(booking._id)}
                  title="Confirm Booking"
                >
                  <CheckCircle className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Extra Person Payment Status */}
            {hasExtraPersons && (
              <div className="flex flex-col gap-2 mt-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-gray-600 whitespace-nowrap">Extra charges:</span>
                  {hasUnpaidCharges ? (
                    <span className="bg-red-50 text-red-700 px-2 py-1 rounded text-xs font-medium whitespace-nowrap">
                      ₹{totalUnpaidCharges.toLocaleString()} Due
                    </span>
                  ) : (
                    (() => {
                      const totalPaidAmount = extraPersonCharges.reduce((sum, charge) => sum + (charge.paidAmount || 0), 0);
                      return (
                        <span className="bg-green-50 text-green-700 px-2 py-1 rounded text-xs font-medium whitespace-nowrap">
                          ₹{totalPaidAmount.toLocaleString()} Paid ✓
                        </span>
                      );
                    })()
                  )}
                </div>
                {hasUnpaidCharges && (
                  <Button
                    size="sm"
                    className="bg-orange-600 hover:bg-orange-700 text-white text-xs w-full"
                    onClick={() => {
                      setSelectedBookingForEdit(booking);
                      setIsEditModalOpen(true);
                    }}
                    title={`Pay ₹${totalUnpaidCharges.toLocaleString()} for extra person charges`}
                  >
                    <CreditCard className="h-3 w-3 mr-1" />
                    Proceed Payment
                  </Button>
                )}
              </div>
            )}

            {/* Settlement Status */}
            {(() => {
              const settlement = booking.settlementTracking;
              const hasSettlement = settlement && settlement.outstandingBalance > 0;
              const isSettled = settlement && settlement.status === 'completed';

              if (hasSettlement || isSettled) {
                return (
                  <div className="flex flex-col gap-2 mt-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-gray-600 whitespace-nowrap">Settlement:</span>
                      {hasSettlement ? (
                        <span className="bg-yellow-50 text-yellow-700 px-2 py-1 rounded text-xs font-medium whitespace-nowrap">
                          ₹{settlement.outstandingBalance.toLocaleString()} Outstanding
                        </span>
                      ) : (
                        <span className="bg-green-50 text-green-700 px-2 py-1 rounded text-xs font-medium whitespace-nowrap">
                          ₹{settlement?.finalAmount?.toLocaleString() || 0} Settled ✓
                        </span>
                      )}
                    </div>
                    {hasSettlement && (
                      <Button
                        size="sm"
                        className="bg-purple-600 hover:bg-purple-700 text-white text-xs w-full"
                        onClick={() => {
                          setSelectedBookingForEdit(booking);
                          setIsEditModalOpen(true);
                        }}
                        title={`Pay ₹${settlement.outstandingBalance.toLocaleString()} settlement amount`}
                      >
                        <CreditCard className="h-3 w-3 mr-1" />
                        Pay Settlement
                      </Button>
                    )}
                  </div>
                );
              }
              return null;
            })()}
          </div>
        );
      }
    }
  ];

  // Handle booking confirmation
  const handleConfirmBooking = async (bookingId: string) => {
    try {
      await adminService.updateBooking(bookingId, { status: 'confirmed' });
      toast.success('Booking confirmed successfully');
      fetchUpcomingBookings();
    } catch (error) {
      toast.error('Failed to confirm booking');
    }
  };

  // Handle booking update after editing
  const handleBookingUpdated = () => {
    setIsEditModalOpen(false);
    setSelectedBookingForEdit(null);
    fetchUpcomingBookings(); // Refresh the list
    toast.success('Booking updated successfully');
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <PropertyBreadcrumb items={['Upcoming Bookings']} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Upcoming Bookings</h1>
          <p className="text-gray-600">Manage upcoming guest arrivals and reservations</p>
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
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Today's Arrivals</p>
                <p className="text-3xl font-bold text-red-600">{stats.todayArrivals}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-lg">
                <Calendar className="h-8 w-8 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Tomorrow's Arrivals</p>
                <p className="text-3xl font-bold text-orange-600">{stats.tomorrowArrivals}</p>
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
              <label className="text-sm font-medium">Days ahead:</label>
              <select
                value={filters.days}
                onChange={(e) => setFilters(prev => ({ ...prev, days: parseInt(e.target.value), page: 1 }))}
                className="border border-gray-300 rounded-md px-3 py-1 text-sm"
              >
                <option value={3}>3 days</option>
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
              </select>
            </div>
            <div className="flex-1">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search by guest name, email, booking number, or room..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bookings Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Upcoming Arrivals ({filteredBookings.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            data={filteredBookings}
            columns={columns}
            loading={loading}
            pagination={true}
            pageSize={50}
            emptyMessage="No upcoming bookings found"
          />
        </CardContent>
      </Card>

      {/* Booking Details Modal */}
      {showDetailsModal && selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">Booking Details</h2>
                <button aria-label="Close"
                  onClick={() => setShowDetailsModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="p-6 space-y-6">
              {/* Guest Information */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Guest Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Name:</span>
                    <p className="font-medium">{selectedBooking.userId?.name}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Email:</span>
                    <p className="font-medium">{selectedBooking.userId?.email}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Phone:</span>
                    <p className="font-medium">{selectedBooking.userId?.phone}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Booking Number:</span>
                    <p className="font-medium">{selectedBooking.bookingNumber}</p>
                  </div>
                </div>
              </div>

              {/* Stay Information */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Stay Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Check-in:</span>
                    <p className="font-medium">{format(parseISO(selectedBooking.checkIn), 'PPP')}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Check-out:</span>
                    <p className="font-medium">{format(parseISO(selectedBooking.checkOut), 'PPP')}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Nights:</span>
                    <p className="font-medium">{selectedBooking.nights}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Guests:</span>
                    <p className="font-medium">
                      {selectedBooking.guestDetails?.adults || 1} adults
                      {selectedBooking.guestDetails?.children > 0 && `, ${selectedBooking.guestDetails.children} children`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Room Information */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Room Information</h3>
                {selectedBooking.rooms?.length > 0 ? (
                  <div className="space-y-2">
                    {selectedBooking.rooms.map((room, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-gray-50 p-3 rounded">
                        <span className="font-medium">{room.roomId?.roomNumber}</span>
                        <span className="text-gray-600">{formatCurrency(room.rate, selectedBooking.currency)}/night</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No rooms assigned yet</p>
                )}
              </div>

              {/* Payment Information */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Payment Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Total Amount:</span>
                    <p className="font-medium text-lg">{formatCurrency(selectedBooking.totalAmount, selectedBooking.currency)}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Payment Status:</span>
                    <StatusBadge
                      status={selectedBooking.paymentStatus}
                      variant={selectedBooking.paymentStatus === 'paid' ? 'success' :
                               selectedBooking.paymentStatus === 'pending' ? 'warning' : 'error'}
                    />
                  </div>
                  <div>
                    <span className="text-gray-600">Booking Status:</span>
                    <StatusBadge
                      status={selectedBooking.status}
                      variant={selectedBooking.status === 'confirmed' ? 'success' :
                               selectedBooking.status === 'pending' ? 'warning' : 'default'}
                    />
                  </div>
                </div>
              </div>

              {/* Special Requests */}
              {selectedBooking.guestDetails?.specialRequests && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Special Requests</h3>
                  <p className="text-sm bg-gray-50 p-3 rounded">
                    {selectedBooking.guestDetails.specialRequests}
                  </p>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowDetailsModal(false)}
              >
                Close
              </Button>
              {selectedBooking.status === 'pending' && (
                <Button
                  onClick={() => {
                    handleConfirmBooking(selectedBooking._id);
                    setShowDetailsModal(false);
                  }}
                >
                  Confirm Booking
                </Button>
              )}
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

export default withErrorBoundary(AdminUpcomingBookings, { level: 'page' });
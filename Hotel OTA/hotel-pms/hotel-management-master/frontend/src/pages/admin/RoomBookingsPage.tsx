import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRoom, useRoomBookings } from '../../hooks/useRooms';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { formatCurrency } from '../../utils/dashboardUtils';
import { withErrorBoundary } from '../../components/ErrorBoundary';
import {
  ArrowLeft,
  Calendar,
  User,
  Phone,
  Mail,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Filter,
  ChevronLeft,
  ChevronRight,
  Eye
} from 'lucide-react';

const getStatusColor = (status: string) => {
  switch (status) {
    case 'confirmed':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'checked_in':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'checked_out':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    case 'cancelled':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'no_show':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'pending':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'confirmed':
      return <CheckCircle className="h-4 w-4" />;
    case 'checked_in':
      return <CheckCircle className="h-4 w-4" />;
    case 'checked_out':
      return <CheckCircle className="h-4 w-4" />;
    case 'cancelled':
      return <XCircle className="h-4 w-4" />;
    case 'no_show':
      return <AlertCircle className="h-4 w-4" />;
    case 'pending':
      return <Clock className="h-4 w-4" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
};

const formatBookingStatus = (status: string) => {
  return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
};

function RoomBookingsPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  
  const [timeFilter, setTimeFilter] = useState<'all' | 'past' | 'future' | 'current'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const limit = 10;

  const roomQuery = useRoom(roomId!, { enabled: !!roomId });
  const bookingsQuery = useRoomBookings(roomId!, {
    timeFilter,
    status: statusFilter || undefined,
    page,
    limit
  });

  const room = roomQuery.data?.room;
  const bookings = bookingsQuery.data?.data?.bookings || [];
  const pagination = bookingsQuery.data?.data?.pagination;

  if (roomQuery.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (roomQuery.error || !room) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <Card className="text-center py-12">
            <CardContent>
              <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Room Not Found</h2>
              <p className="text-gray-600 mb-4">The room you're looking for doesn't exist or you don't have permission to view it.</p>
              <Button onClick={() => navigate('/admin/rooms')} className="mt-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Rooms
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              onClick={() => navigate(`/admin/rooms/${roomId}`)}
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Room Details
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Bookings - Room {room.roomNumber}
              </h1>
              <p className="text-gray-600 capitalize">
                {room.type} • Floor {room.floor}
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <Filter className="h-5 w-5 mr-2" />
                Filters
              </h2>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Time Period</label>
                <select
                  value={timeFilter}
                  onChange={(e) => {
                    setTimeFilter(e.target.value as 'all' | 'past' | 'future' | 'current');
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Bookings</option>
                  <option value="current">Current</option>
                  <option value="future">Future</option>
                  <option value="past">Past</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="checked_in">Checked In</option>
                  <option value="checked_out">Checked Out</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="no_show">No Show</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bookings List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Booking History
                {pagination && (
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    ({pagination.total} total)
                  </span>
                )}
              </h2>
            </div>
          </CardHeader>
          <CardContent>
            {bookingsQuery.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner size="md" />
              </div>
            ) : bookings.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Bookings Found</h3>
                <p className="text-gray-600">
                  {timeFilter === 'all' ? 'This room has no bookings yet.' : 
                   timeFilter === 'future' ? 'No upcoming bookings for this room.' :
                   timeFilter === 'past' ? 'No past bookings for this room.' :
                   'No current bookings for this room.'}
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {bookings.map((booking: Record<string, unknown>) => (
                    <div key={booking._id} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-3">
                            <div className={`px-2 py-1 rounded-full text-xs font-medium border flex items-center space-x-1 ${getStatusColor(booking.status)}`}>
                              {getStatusIcon(booking.status)}
                              <span>{formatBookingStatus(booking.status)}</span>
                            </div>
                            <span className="text-sm text-gray-500">
                              Booking ID: {booking._id.slice(-8).toUpperCase()}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Guest</label>
                              <div className="flex items-center space-x-2">
                                <User className="h-4 w-4 text-gray-400" />
                                <span className="text-sm font-medium text-gray-900">
                                  {booking.userId?.name || 'Unknown Guest'}
                                </span>
                              </div>
                              {booking.userId?.email && (
                                <div className="flex items-center space-x-2 mt-1">
                                  <Mail className="h-3 w-3 text-gray-400" />
                                  <span className="text-xs text-gray-600">
                                    {booking.userId.email}
                                  </span>
                                </div>
                              )}
                              {booking.userId?.phone && (
                                <div className="flex items-center space-x-2 mt-1">
                                  <Phone className="h-3 w-3 text-gray-400" />
                                  <span className="text-xs text-gray-600">
                                    {booking.userId.phone}
                                  </span>
                                </div>
                              )}
                            </div>
                            
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Check-in</label>
                              <div className="flex items-center space-x-2">
                                <Calendar className="h-4 w-4 text-gray-400" />
                                <span className="text-sm font-medium text-gray-900">
                                  {new Date(booking.checkIn).toLocaleDateString()}
                                </span>
                              </div>
                              <span className="text-xs text-gray-600">
                                {new Date(booking.checkIn).toLocaleDateString('en-US', { weekday: 'long' })}
                              </span>
                            </div>
                            
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Check-out</label>
                              <div className="flex items-center space-x-2">
                                <Calendar className="h-4 w-4 text-gray-400" />
                                <span className="text-sm font-medium text-gray-900">
                                  {new Date(booking.checkOut).toLocaleDateString()}
                                </span>
                              </div>
                              <span className="text-xs text-gray-600">
                                {new Date(booking.checkOut).toLocaleDateString('en-US', { weekday: 'long' })}
                              </span>
                            </div>
                            
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">Total Amount</label>
                              <span className="text-lg font-bold text-gray-900">
                                {formatCurrency(booking.totalAmount)}
                              </span>
                              <div className="text-xs text-gray-600">
                                {Math.ceil((new Date(booking.checkOut).getTime() - new Date(booking.checkIn).getTime()) / (1000 * 60 * 60 * 24))} nights
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/admin/bookings/${booking._id}`)}
                          className="ml-4"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </div>
                      
                      {booking.notes && (
                        <div className="mt-3 p-2 bg-gray-50 rounded text-sm text-gray-700">
                          <strong>Notes:</strong> {booking.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {pagination && pagination.pages > 1 && (
                  <div className="flex items-center justify-between mt-6">
                    <div className="flex items-center text-sm text-gray-700">
                      Showing {((page - 1) * limit) + 1} to {Math.min(page * limit, pagination.total)} of {pagination.total} bookings
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(page - 1)}
                        disabled={page === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      
                      <div className="flex items-center space-x-1">
                        {[...Array(pagination.pages)].map((_, i) => (
                          <Button
                            key={i + 1}
                            variant={page === i + 1 ? "default" : "outline"}
                            size="sm"
                            onClick={() => setPage(i + 1)}
                            className="w-8 h-8 p-0"
                          >
                            {i + 1}
                          </Button>
                        ))}
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(page + 1)}
                        disabled={page === pagination.pages}
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default withErrorBoundary(RoomBookingsPage);

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { bookingService } from '../../services/bookingService';
import { Booking } from '../../types/booking';
import {
  Calendar,
  CreditCard,
  MapPin,
  Clock,
  CheckCircle,
  Users,
  Star,
  Sparkles
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { RoomServiceWidget } from '../../components/guest/RoomServiceWidget';
import { withErrorBoundary } from '../../components/ErrorBoundary';
import toast from 'react-hot-toast';
import { toEntityIdString } from '../../utils/entityId';
import { guestServiceService } from '../../services/guestService';
import { useQueryClient } from '@tanstack/react-query';

function GuestDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: dashboardData, isLoading: loading, error, refetch } = useQuery({
    queryKey: ['guest-dashboard', user?._id],
    queryFn: async () => {
      const response = await bookingService.getUserBookings({ limit: 5 });
      const bookings = Array.isArray(response.data?.bookings) ? response.data.bookings :
                      Array.isArray(response.data) ? response.data : [];

      // Use server-provided stats/pagination when available, don't compute from limited dataset
      const resp = response as Record<string, unknown>;
      const pagination = (resp.pagination || resp.data?.pagination) as Record<string, number> | undefined;
      const stats = (resp.stats || resp.data?.stats) as Record<string, number> | undefined;

      const totalBookings = pagination?.total ?? stats?.totalBookings ?? bookings.length;
      const totalSpent = stats?.totalRevenue ?? bookings
        .filter((b: Booking) => b.paymentStatus === 'paid')
        .reduce((sum: number, b: Booking) => sum + (Number(b.totalAmount) || 0), 0);
      const upcomingBookings = stats?.upcomingCount ?? bookings
        .filter((b: Booking) => new Date(b.checkIn) > new Date() && b.status !== 'cancelled')
        .length;
      const loyaltyPoints = user?.loyalty?.points || 0;
      const loyaltyTier = user?.loyalty?.tier || 'bronze';

      return {
        bookings: bookings.slice(0, 5) as Booking[],
        stats: { totalBookings, totalSpent, upcomingBookings, loyaltyPoints, loyaltyTier }
      };
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  const bookings = dashboardData?.bookings || [];
  const stats = dashboardData?.stats || { totalBookings: 0, totalSpent: 0, upcomingBookings: 0, loyaltyPoints: 0, loyaltyTier: 'bronze' };

  // Find active checked-in booking for housekeeping requests
  const activeBookingForService = bookings.find(b => b.status === 'checked_in');

  const requestHousekeeping = async () => {
    if (!activeBookingForService) {
      toast.error('You need an active check-in to request housekeeping.');
      return;
    }
    try {
      await guestServiceService.createServiceRequest({
        bookingId: toEntityIdString(activeBookingForService._id) ?? '',
        serviceType: 'housekeeping',
        serviceVariation: 'Room cleaning',
        serviceVariations: ['Room cleaning'],
        priority: 'now',
        items: [{ name: 'Room Cleaning', quantity: 1, price: 0 }],
        specialInstructions: ''
      });
      toast.success('Housekeeping request submitted! Staff will be with you shortly.');
      queryClient.invalidateQueries({ queryKey: ['guest-requests'] });
    } catch {
      toast.error('Failed to submit housekeeping request. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (error && bookings.length === 0) {
    const message = error instanceof Error ? error.message : 'Unable to load your bookings. Please try again.';
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Clock className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Failed to load dashboard</h2>
          <p className="text-gray-600 mb-4">{message}</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-6 sm:py-8 text-white rounded-none sm:rounded-xl sm:mx-0">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-2">
                Welcome back, {user?.name}!
              </h1>
              <p className="text-blue-100 text-sm sm:text-base">
                Manage your bookings and explore your loyalty benefits
              </p>
            </div>
            {/* Connection status removed - using regular API calls */}
          </div>
        </div>
      </div>

      {/* Current Stay Banner — show if guest is checked in */}
      {bookings.some(b => b.status === 'checked_in') && (() => {
        const activeBooking = bookings.find(b => b.status === 'checked_in');
        return activeBooking ? (
          <Card className="p-4 sm:p-6 bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <MapPin className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-green-700 font-medium">Your Current Stay</p>
                  <p className="text-lg font-bold text-gray-900">
                    Room {activeBooking.rooms?.[0]?.roomId?.roomNumber || activeBooking.rooms?.[0]?.roomNumber || '—'}
                  </p>
                  <p className="text-xs text-gray-500">
                    Check-out: {formatDate(activeBooking.checkOut)}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <a
                  href={`/app/bookings/${toEntityIdString(activeBooking._id) ?? ''}`}
                  className="px-4 py-2 bg-white text-green-700 border border-green-300 rounded-lg text-sm font-medium hover:bg-green-50"
                >
                  View Details
                </a>
                <a
                  href="/app/services"
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                >
                  Request Service
                </a>
              </div>
            </div>
          </Card>
        ) : null;
      })()}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-6 sm:mb-8">
        <Card className="p-4 sm:p-5 lg:p-6 hover:shadow-lg hover:scale-105 transition-all duration-200 border-l-4 border-blue-500 bg-gradient-to-br from-white to-blue-50">
          <div className="flex items-center">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex-shrink-0 shadow-md">
              <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="ml-4 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-blue-700 truncate">Total Bookings</p>
              <p className="text-xl sm:text-2xl font-bold text-blue-900">{stats.totalBookings}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-5 lg:p-6 hover:shadow-lg hover:scale-105 transition-all duration-200 border-l-4 border-green-500 bg-gradient-to-br from-white to-green-50">
          <div className="flex items-center">
            <div className="p-3 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex-shrink-0 shadow-md">
              <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="ml-4 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-green-700 truncate">Upcoming</p>
              <p className="text-xl sm:text-2xl font-bold text-green-900">{stats.upcomingBookings}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-5 lg:p-6 hover:shadow-lg hover:scale-105 transition-all duration-200 border-l-4 border-yellow-500 bg-gradient-to-br from-white to-yellow-50">
          <div className="flex items-center">
            <div className="p-3 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl flex-shrink-0 shadow-md">
              <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="ml-4 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-yellow-700 truncate">Total Spent</p>
              <p className="text-xl sm:text-2xl font-bold text-yellow-900 truncate">
                {formatCurrency(stats.totalSpent)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 sm:p-5 lg:p-6 hover:shadow-lg hover:scale-105 transition-all duration-200 border-l-4 border-purple-500 bg-gradient-to-br from-white to-purple-50">
          <div className="flex items-center">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex-shrink-0 shadow-md">
              <Star className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div className="ml-4 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-purple-700 truncate">Loyalty Points</p>
              <p className="text-xl sm:text-2xl font-bold text-purple-900">{stats.loyaltyPoints}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Bookings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
        <Card className="p-6 shadow-lg hover:shadow-xl transition-shadow duration-300">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Recent Bookings</h2>
            <button 
              onClick={() => navigate('/app/bookings')}
              className="text-yellow-600 hover:text-yellow-700 text-sm font-medium"
            >
              View All
            </button>
          </div>

          {bookings.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="mx-auto h-8 w-8 text-gray-400 mb-3" />
              <p className="text-gray-500">No bookings yet</p>
              <button 
                onClick={() => navigate('/rooms')}
                className="mt-2 text-yellow-600 hover:text-yellow-700 text-sm font-medium"
              >
                Browse Rooms
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {bookings.map((booking) => (
                <a href={`/app/bookings/${toEntityIdString(booking._id) ?? ''}`} key={toEntityIdString(booking._id) ?? booking.bookingNumber} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-gray-50 rounded-lg gap-3 sm:gap-0 hover:bg-gray-100 transition-colors cursor-pointer">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{booking.hotelId?.name || 'Hotel'}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {formatDate(booking.checkIn)} - {formatDate(booking.checkOut)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">#{booking.bookingNumber}</p>
                  </div>
                  <div className="flex flex-row sm:flex-col items-start sm:items-end justify-between sm:justify-start gap-2 sm:gap-1">
                    <p className="font-semibold text-gray-900">
                      {formatCurrency(Number(booking.totalAmount) || 0, booking.currency || 'INR')}
                    </p>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
                      booking.status === 'confirmed'
                        ? 'bg-green-100 text-green-800'
                        : booking.status === 'checked_in'
                        ? 'bg-blue-100 text-blue-800'
                        : booking.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800'
                        : booking.status === 'cancelled'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {booking.status}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </Card>

        {/* Loyalty Program */}
        <Card className="p-6 shadow-lg hover:shadow-xl transition-shadow duration-300 bg-gradient-to-br from-white to-yellow-50">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Loyalty Status</h2>
            <a href="/app/loyalty" className="text-sm text-yellow-600 hover:text-yellow-700 font-medium">View Program →</a>
          </div>
          
          <div className="text-center mb-4 sm:mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full mb-3 sm:mb-4">
              <Star className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 capitalize mb-1">
              {user?.loyalty?.tier || 'Bronze'} Member
            </h3>
            <p className="text-gray-600 text-sm sm:text-base">{stats.loyaltyPoints} points</p>
          </div>

          {/* Loyalty Progress */}
          {(() => {
            const TIER_THRESHOLDS: Record<string, number> = {
              bronze: 1000,
              silver: 5000,
              gold: 10000,
              platinum: 25000,
              diamond: 50000
            };
            const currentTierThreshold = TIER_THRESHOLDS[user?.loyalty?.tier || 'bronze'] || 1000;
            const progress = (stats.loyaltyPoints % currentTierThreshold) / currentTierThreshold * 100;
            return (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Progress to next tier</span>
                  <span className="text-sm font-medium text-gray-900">
                    {Math.min(stats.loyaltyPoints % currentTierThreshold, currentTierThreshold)}/{currentTierThreshold}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-yellow-400 to-yellow-600 h-2 rounded-full"
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
              </div>
            );
          })()}

          {/* Benefits */}
          <div>
            <h4 className="font-medium text-gray-900 mb-3">Your Benefits</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-center">
                <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                Member-only rates and discounts
              </li>
              <li className="flex items-center">
                <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                Priority customer support
              </li>
              <li className="flex items-center">
                <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                Earn points on every stay
              </li>
              {(user?.loyalty?.tier === 'silver' || user?.loyalty?.tier === 'gold' || user?.loyalty?.tier === 'platinum') && (
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  Complimentary room upgrades
                </li>
              )}
              {(user?.loyalty?.tier === 'gold' || user?.loyalty?.tier === 'platinum') && (
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  Late checkout privileges
                </li>
              )}
              {user?.loyalty?.tier === 'platinum' && (
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  Exclusive platinum benefits
                </li>
              )}
            </ul>
          </div>
        </Card>
      </div>

      {/* Room Service Section - Only show if user has a checked-in booking */}
      {bookings.some(b => b.status === 'checked_in') && (() => {
        const activeBooking = bookings.find(b =>
          b.status === 'checked_in' && new Date(b.checkOut) > new Date()
        );
        if (!activeBooking) return null;
        const roomId = activeBooking.rooms?.[0]?.roomId?._id
          || activeBooking.rooms?.[0]?.roomId
          || undefined;
        return (
          <div className="mt-8">
            <RoomServiceWidget
              guestId={user?._id}
              bookingId={toEntityIdString(activeBooking._id) ?? ''}
              roomId={typeof roomId === 'string' ? roomId : undefined}
              onRequestService={(serviceType, items) => {
                toast.success(`Service request submitted (${Array.isArray(items) ? items.length : 0} items). Our team will be with you shortly.`);
              }}
            />
          </div>
        );
      })()}

      {/* Quick Actions */}
      <div className="mt-6 sm:mt-8">
        <Card className="p-6 shadow-lg hover:shadow-xl transition-shadow duration-300">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-6">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => navigate('/rooms')}
              className="group flex items-center justify-center p-5 bg-gradient-to-br from-yellow-50 to-yellow-100 border-2 border-yellow-200 rounded-xl hover:from-yellow-100 hover:to-yellow-200 hover:border-yellow-300 hover:scale-105 active:scale-95 transition-all duration-200 min-h-[3.5rem] touch-manipulation shadow-md"
            >
              <Calendar className="w-5 h-5 text-yellow-600 mr-3 flex-shrink-0 group-hover:scale-110 transition-transform" />
              <span className="font-semibold text-yellow-700 text-sm sm:text-base">Book a Room</span>
            </button>
            <button
              onClick={() => navigate('/app/bookings')}
              className="group flex items-center justify-center p-5 bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl hover:from-blue-100 hover:to-blue-200 hover:border-blue-300 hover:scale-105 active:scale-95 transition-all duration-200 min-h-[3.5rem] touch-manipulation shadow-md"
            >
              <CreditCard className="w-5 h-5 text-blue-600 mr-3 flex-shrink-0 group-hover:scale-110 transition-transform" />
              <span className="font-semibold text-blue-700 text-sm sm:text-base">My Bookings</span>
            </button>
            <button
              onClick={requestHousekeeping}
              disabled={!activeBookingForService}
              title={activeBookingForService ? 'Request room cleaning now' : 'You need an active check-in to request housekeeping'}
              className="group flex items-center justify-center p-5 bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200 rounded-xl hover:from-purple-100 hover:to-purple-200 hover:border-purple-300 hover:scale-105 active:scale-95 transition-all duration-200 min-h-[3.5rem] touch-manipulation shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              <Sparkles className="w-5 h-5 text-purple-600 mr-3 flex-shrink-0 group-hover:scale-110 transition-transform" />
              <span className="font-semibold text-purple-700 text-sm sm:text-base">Request Housekeeping</span>
            </button>
            <button
              onClick={() => navigate('/contact')}
              className="group flex items-center justify-center p-5 bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 rounded-xl hover:from-green-100 hover:to-green-200 hover:border-green-300 hover:scale-105 active:scale-95 transition-all duration-200 min-h-[3.5rem] touch-manipulation shadow-md"
            >
              <Users className="w-5 h-5 text-green-600 mr-3 flex-shrink-0 group-hover:scale-110 transition-transform" />
              <span className="font-semibold text-green-700 text-sm sm:text-base">Contact Support</span>
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default withErrorBoundary(GuestDashboard, { level: 'page' });
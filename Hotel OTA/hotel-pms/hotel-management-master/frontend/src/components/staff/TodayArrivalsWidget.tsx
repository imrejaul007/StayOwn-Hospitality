import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { staffBookingService, StaffUpcomingBooking, StaffUpcomingStats } from '../../services/staffBookingService';
import { parseISO, isToday, isTomorrow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  Users,
  ArrowRight,
  CheckSquare,
  AlertTriangle,
  Phone,
  MessageSquare
} from 'lucide-react';

export default function TodayArrivalsWidget() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<StaffUpcomingBooking[]>([]);
  const [stats, setStats] = useState<StaffUpcomingStats>({
    todayArrivals: 0,
    tomorrowArrivals: 0,
    totalUpcoming: 0
  });
  const [loading, setLoading] = useState(true);
  // Guard state updates after component unmounts (e.g. during interval fire)
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchUpcomingBookings = useCallback(async () => {
    try {
      if (mountedRef.current) setLoading(true);
      const response = await staffBookingService.getUpcomingBookings({ days: 3, limit: 10 });
      if (!mountedRef.current) return;
      setBookings(response.data || []);
      setStats(response.stats || { todayArrivals: 0, tomorrowArrivals: 0, totalUpcoming: 0 });
    } catch {
      // Error handled silently — widget is non-critical
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUpcomingBookings();
    // Keep widget in sync with backend every 60 seconds
    const interval = setInterval(fetchUpcomingBookings, 60000);
    return () => clearInterval(interval);
  }, [fetchUpcomingBookings]);

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

  const getTodayBookings = () => {
    return bookings
      .filter((booking) => {
        const checkInDate = parseBookingDate(booking.checkIn);
        return checkInDate ? isToday(checkInDate) : false;
      })
      .slice(0, 4);
  };

  const getTomorrowBookings = () => {
    return bookings
      .filter((booking) => {
        const checkInDate = parseBookingDate(booking.checkIn);
        return checkInDate ? isTomorrow(checkInDate) : false;
      })
      .slice(0, 2);
  };

  const getBookingPriority = (booking: StaffUpcomingBooking) => {
    const hasSpecialRequests = booking.guestDetails?.specialRequests;
    const hasNoRoom = !booking.rooms || booking.rooms.length === 0;
    const isPending = booking.status === 'pending';

    if (hasNoRoom) return 'high';
    if (isPending || hasSpecialRequests) return 'medium';
    return 'low';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-red-200 bg-red-50';
      case 'medium': return 'border-orange-200 bg-orange-50';
      default: return 'border-green-200 bg-green-50';
    }
  };

  const renderBookingCard = (booking: StaffUpcomingBooking, isCompact = false) => {
    const priority = getBookingPriority(booking);
    const hasSpecialRequests = booking.guestDetails?.specialRequests;
    const hasNoRoom = !booking.rooms || booking.rooms.length === 0;

    return (
      <div key={booking._id} className={`p-3 rounded-lg border ${getPriorityColor(priority)}`}>
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <div className="font-medium text-gray-900">{booking.userId?.name}</div>
            <div className="text-xs text-gray-600">{booking.bookingNumber}</div>
          </div>
          <div className="flex items-center gap-1">
            {hasNoRoom && <AlertTriangle className="h-4 w-4 text-red-500" />}
            {hasSpecialRequests && <MessageSquare className="h-4 w-4 text-yellow-500" />}
            <Badge
              variant={booking.status === 'confirmed' ? 'success' : 'warning'}
              className="text-xs"
            >
              {booking.status}
            </Badge>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-600">
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            <span>{booking.guestDetails?.adults || 1} guests</span>
          </div>
          <div className="flex items-center gap-1">
            {booking.userId?.phone && (
              <Phone className="h-3 w-3" />
            )}
          </div>
        </div>

        {!isCompact && hasSpecialRequests && (
          <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
            <div className="font-medium text-yellow-800">Special Request:</div>
            <div className="text-yellow-700 line-clamp-2">
              {booking.guestDetails.specialRequests}
            </div>
          </div>
        )}

        <div className="mt-2">
          {booking.rooms && booking.rooms.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {booking.rooms.map((room, idx) => (
                <Badge key={idx} variant="outline" className="text-xs bg-blue-50 text-blue-700">
                  {room.roomId?.roomNumber}
                </Badge>
              ))}
            </div>
          ) : (
            <Badge variant="destructive" className="text-xs">
              No room assigned
            </Badge>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Today's Check-ins
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const todayBookings = getTodayBookings();
  const tomorrowBookings = getTomorrowBookings();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Today's Check-ins
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/staff/upcoming-bookings')}
            className="text-blue-600 hover:text-blue-800"
          >
            View All
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center p-3 bg-red-100 rounded-lg border border-red-200">
            <div className="text-2xl font-bold text-red-700">{stats.todayArrivals}</div>
            <div className="text-xs text-red-600 font-medium">Today</div>
          </div>
          <div className="text-center p-3 bg-orange-100 rounded-lg border border-orange-200">
            <div className="text-2xl font-bold text-orange-700">{stats.tomorrowArrivals}</div>
            <div className="text-xs text-orange-600 font-medium">Tomorrow</div>
          </div>
        </div>

        {/* Today's Priority Arrivals */}
        {todayBookings.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-700 flex items-center gap-1">
                <Calendar className="h-4 w-4 text-red-500" />
                Today's Priority
              </h4>
              {/* Badge always rendered here since todayBookings.length > 0 is guaranteed */}
              <Badge className="bg-red-100 text-red-700 text-xs">
                {todayBookings.length} arrivals
              </Badge>
            </div>
            <div className="space-y-2">
              {todayBookings.map(booking => renderBookingCard(booking, true))}
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500">
            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No arrivals today</p>
          </div>
        )}

        {/* Tomorrow's Preview */}
        {tomorrowBookings.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-700 flex items-center gap-1">
                <Clock className="h-4 w-4 text-orange-500" />
                Tomorrow Preview
              </h4>
              <Badge className="bg-orange-100 text-orange-700 text-xs">
                {tomorrowBookings.length} arriving
              </Badge>
            </div>
            <div className="space-y-2">
              {tomorrowBookings.map(booking => renderBookingCard(booking, true))}
            </div>
          </div>
        )}

        {/* Preparation Status */}
        {(todayBookings.length > 0 || tomorrowBookings.length > 0) && (
          <div className="pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-blue-500" />
                <span className="text-xs text-gray-600">Preparation Status</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/staff/upcoming-bookings')}
                className="text-xs h-7"
              >
                Manage
              </Button>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              Ready for {stats.todayArrivals} check-ins today
            </div>
          </div>
        )}

        {/* No Arrivals State */}
        {todayBookings.length === 0 && tomorrowBookings.length === 0 && (
          <div className="text-center py-6 text-gray-500">
            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No upcoming arrivals</p>
            <p className="text-xs">Next few days are clear</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
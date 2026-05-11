import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { adminService } from '../../services/adminService';
import { AdminBooking } from '../../types/admin';
import { format, parseISO, isToday, isTomorrow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Clock,
  Users,
  ArrowRight,
  CalendarDays,
  AlertTriangle
} from 'lucide-react';

interface UpcomingArrivalsStats {
  todayArrivals: number;
  tomorrowArrivals: number;
  totalUpcoming: number;
}

export default function UpcomingArrivalsWidget() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [stats, setStats] = useState<UpcomingArrivalsStats>({
    todayArrivals: 0,
    tomorrowArrivals: 0,
    totalUpcoming: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUpcomingBookings();
  }, []);

  const fetchUpcomingBookings = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await adminService.getUpcomingBookings({ days: 7, limit: 5 });
      setBookings(response.data || []);
      setStats(response.stats || { todayArrivals: 0, tomorrowArrivals: 0, totalUpcoming: 0 });
    } catch {
      setError('Failed to load upcoming arrivals');
    } finally {
      setLoading(false);
    }
  };

  const getArrivalInfo = (checkIn: string) => {
    const date = parseISO(checkIn);
    if (isToday(date)) return { label: 'Today', color: 'bg-red-100 text-red-800' };
    if (isTomorrow(date)) return { label: 'Tomorrow', color: 'bg-orange-100 text-orange-800' };
    return { label: format(date, 'MMM dd'), color: 'bg-gray-100 text-gray-800' };
  };

  const getPriorityBookings = () => {
    return bookings.slice(0, 3); // Show top 3 priority bookings
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Upcoming Arrivals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Upcoming Arrivals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-red-400" />
            <p className="text-sm text-red-600">{error}</p>
            <Button onClick={fetchUpcomingBookings} variant="ghost" size="sm" className="mt-2">
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Upcoming Arrivals
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/admin/upcoming-bookings')}
            className="text-blue-600 hover:text-blue-800"
          >
            View All
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{stats.todayArrivals}</div>
            <div className="text-xs text-red-700 flex items-center justify-center gap-1">
              <Calendar className="h-3 w-3" />
              Today
            </div>
          </div>
          <div className="text-center p-3 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">{stats.tomorrowArrivals}</div>
            <div className="text-xs text-orange-700 flex items-center justify-center gap-1">
              <Clock className="h-3 w-3" />
              Tomorrow
            </div>
          </div>
        </div>

        {/* Priority Arrivals */}
        {getPriorityBookings().length > 0 ? (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700">Priority Arrivals</h4>
            {getPriorityBookings().map((booking) => {
              const arrival = getArrivalInfo(booking.checkIn);
              const hasIssues = booking.status === 'pending' || !booking.rooms || booking.rooms.length === 0;

              return (
                <div key={booking._id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={`${arrival.color} text-xs`}>
                        {arrival.label}
                      </Badge>
                      {hasIssues && (
                        <AlertTriangle className="h-3 w-3 text-yellow-500" />
                      )}
                    </div>
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {booking.userId?.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {booking.bookingNumber} • {booking.guestDetails?.adults || 1} guests
                    </div>
                  </div>
                  <div className="text-right">
                    {booking.rooms && booking.rooms.length > 0 ? (
                      <div className="text-xs text-gray-600">
                        {booking.rooms.map(room => room.roomId?.roomNumber).join(', ')}
                      </div>
                    ) : (
                      <div className="text-xs text-red-600">No room assigned</div>
                    )}
                    <Badge
                      variant={booking.status === 'confirmed' ? 'success' : 'warning'}
                      className="text-xs mt-1"
                    >
                      {booking.status}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6 text-gray-500">
            <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No upcoming arrivals</p>
          </div>
        )}

        {/* Quick Actions */}
        {stats.totalUpcoming > 0 && (
          <div className="pt-2 border-t border-gray-100">
            <div className="flex justify-between text-xs text-gray-500">
              <span>Total upcoming: {stats.totalUpcoming}</span>
              <button
                onClick={() => navigate('/admin/upcoming-bookings')}
                className="text-blue-600 hover:text-blue-800"
              >
                Manage all →
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
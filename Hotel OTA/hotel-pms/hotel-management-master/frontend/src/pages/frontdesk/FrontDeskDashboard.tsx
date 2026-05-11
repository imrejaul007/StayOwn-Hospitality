import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  Users,
  Bed,
  ClipboardList,
  Clock,
  CheckCircle,
  AlertCircle,
  Grid,
  FileCheck,
  Bell
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useProperty } from '../../context/PropertyContext';
import { api } from '../../services/api';
import { realTimeService } from '../../services/realTimeService';
import { withErrorBoundary } from '../../components/ErrorBoundary';

interface QuickStat {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  link?: string;
}

function FrontDeskDashboard() {
  const { user } = useAuth();
  const { selectedProperty } = useProperty();
  const queryClient = useQueryClient();

  // Fetch dashboard stats - calls /api/v1/dashboard/counts and transforms to flat structure
  const { data: stats, isLoading, error: statsError } = useQuery({
    queryKey: ['frontdesk-dashboard-stats', selectedProperty?._id],
    queryFn: async () => {
      const response = await api.get('/dashboard/counts', {
        params: { hotelId: selectedProperty?._id }
      });
      const raw = response.data?.data || response.data;
      // Transform backend nested structure → flat fields the UI expects
      return {
        totalBookings: raw?.reservations?.total || raw?.totalBookings || 0,
        todayArrivals: raw?.frontDesk?.checkIn || raw?.todayArrivals || 0,
        todayDepartures: raw?.frontDesk?.checkOut || raw?.todayDepartures || 0,
        availableRooms: raw?.frontDesk?.availableRooms || raw?.availableRooms || 0,
        activeBookings: raw?.reservations?.checkedIn || raw?.activeBookings || 0,
        checkedIn: raw?.reservations?.checkedIn || 0,
        housekeepingPending: raw?.housekeeping?.dirty || raw?.housekeepingPending || 0,
        pendingHousekeeping: raw?.housekeeping?.dirty || raw?.pendingHousekeeping || 0,
        pendingMaintenance: raw?.maintenance?.total || 0,
        pendingGuestServices: raw?.guestServices?.pending || 0,
        vipGuests: raw?.guestServices?.vipGuests || 0,
      };
    },
    enabled: !!selectedProperty,
    refetchInterval: 30000,
    retry: 2,
  });

  // Fetch pending approvals count using dedicated count endpoint
  const { data: pendingApprovalsData } = useQuery({
    queryKey: ['pending-approvals-count', selectedProperty?._id],
    queryFn: async () => {
      const response = await api.get('/approvals/pending-count', {
        params: { hotelId: selectedProperty?._id }
      });
      return response.data;
    },
    refetchInterval: 60000,
    enabled: !!user && !!selectedProperty,
  });

  // Fetch today's arrivals for the schedule section
  const { data: todayArrivals } = useQuery({
    queryKey: ['frontdesk-today-arrivals', selectedProperty?._id],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const response = await api.get('/bookings', {
        params: { hotelId: selectedProperty?._id, checkInDate: today, limit: 20 }
      });
      // Backend returns { data: bookings[] } where data is the array directly
      const raw = response.data?.data;
      return Array.isArray(raw) ? raw : (raw?.bookings || response.data?.bookings || []);
    },
    enabled: !!selectedProperty,
    refetchInterval: 30000,
  });

  // Fetch today's departures using checkout date (not the check-in list)
  const { data: todayDepartures } = useQuery({
    queryKey: ['frontdesk-today-departures', selectedProperty?._id],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const response = await api.get('/bookings', {
        params: { hotelId: selectedProperty?._id, checkOutDate: today, limit: 20 }
      });
      const raw = response.data?.data;
      return Array.isArray(raw) ? raw : (raw?.bookings || response.data?.bookings || []);
    },
    enabled: !!selectedProperty,
    refetchInterval: 30000,
  });

  // Fetch room status for mini grid — transform nested byStatus to flat fields
  const { data: roomStatus } = useQuery({
    queryKey: ['frontdesk-room-status', selectedProperty?._id],
    queryFn: async () => {
      const response = await api.get('/dashboard/room-status', {
        params: { hotelId: selectedProperty?._id }
      });
      const raw = response.data?.data || response.data;
      const byStatus = raw?.byStatus || raw?.summary || {};
      const total = raw?.total || 0;
      const occupied = byStatus?.occupied || raw?.occupied || 0;
      const dirty = byStatus?.dirty || byStatus?.vacant_dirty || raw?.dirty || 0;
      const maintenance = byStatus?.maintenance || raw?.maintenance || 0;
      const outOfOrder = byStatus?.out_of_order || byStatus?.outOfOrder || raw?.outOfOrder || 0;
      const available = raw?.available || byStatus?.available || byStatus?.vacant_clean || Math.max(0, total - occupied - dirty - maintenance - outOfOrder);
      return { available, occupied, dirty, maintenance, outOfOrder, total, occupancyRate: raw?.occupancyRate || 0 };
    },
    enabled: !!selectedProperty,
    refetchInterval: 30000,
  });

  // Fetch pending guest service requests so frontdesk can see what guests need
  const { data: guestServiceRequests } = useQuery({
    queryKey: ['frontdesk-guest-services', selectedProperty?._id],
    queryFn: async () => {
      const response = await api.get('/guest-services', {
        params: { hotelId: selectedProperty?._id, status: 'pending', page: 1, limit: 5 }
      });
      const raw = response.data?.data?.serviceRequests || response.data?.data || [];
      return Array.isArray(raw) ? raw : [];
    },
    enabled: !!selectedProperty,
    refetchInterval: 30000,
  });

  // Ensure the real-time WebSocket singleton is connected so event listeners below can fire.
  // Do NOT disconnect on unmount — realTimeService is a singleton shared across components.
  useEffect(() => {
    realTimeService.connect().catch(() => { /* WebSocket unavailable -- page still works via polling */ });
  }, []);

  // Real-time: listen for booking, room, and guest-service events to refresh dashboard immediately
  useEffect(() => {
    const invalidateAll = () => {
      queryClient.invalidateQueries({ queryKey: ['frontdesk-dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['frontdesk-today-arrivals'] });
      queryClient.invalidateQueries({ queryKey: ['frontdesk-today-departures'] });
      queryClient.invalidateQueries({ queryKey: ['frontdesk-room-status'] });
      queryClient.invalidateQueries({ queryKey: ['pending-approvals-count'] });
    };

    const handleGuestServiceEvent = () => {
      queryClient.invalidateQueries({ queryKey: ['frontdesk-guest-services'] });
      queryClient.invalidateQueries({ queryKey: ['frontdesk-dashboard-stats'] });
    };

    realTimeService.on('booking:created', invalidateAll);
    realTimeService.on('booking:updated', invalidateAll);
    realTimeService.on('booking:cancelled', invalidateAll);
    realTimeService.on('booking:status_changed', invalidateAll);
    realTimeService.on('booking:overdue_checkout', invalidateAll);
    realTimeService.on('room:status_changed', invalidateAll);
    realTimeService.on('guest-services:created', handleGuestServiceEvent);
    realTimeService.on('guest-services:assigned', handleGuestServiceEvent);
    realTimeService.on('guest-services:updated', handleGuestServiceEvent);
    realTimeService.on('guest-services:status_changed', handleGuestServiceEvent);
    realTimeService.on('guest-services:*', handleGuestServiceEvent);

    return () => {
      realTimeService.off('booking:created', invalidateAll);
      realTimeService.off('booking:updated', invalidateAll);
      realTimeService.off('booking:cancelled', invalidateAll);
      realTimeService.off('booking:status_changed', invalidateAll);
      realTimeService.off('booking:overdue_checkout', invalidateAll);
      realTimeService.off('room:status_changed', invalidateAll);
      realTimeService.off('guest-services:created', handleGuestServiceEvent);
      realTimeService.off('guest-services:assigned', handleGuestServiceEvent);
      realTimeService.off('guest-services:updated', handleGuestServiceEvent);
      realTimeService.off('guest-services:status_changed', handleGuestServiceEvent);
      realTimeService.off('guest-services:*', handleGuestServiceEvent);
    };
  }, [selectedProperty?._id, queryClient]);

  // /approvals/pending-count returns { count: N }
  const pendingApprovalCount = pendingApprovalsData?.count ?? pendingApprovalsData?.data?.count ?? 0;

  const pendingGuestServiceCount = stats?.pendingGuestServices || 0;

  const quickStats: QuickStat[] = [
    {
      label: 'Total Bookings',
      value: stats?.totalBookings || 0,
      icon: Calendar,
      color: 'blue',
      link: '/frontdesk/bookings'
    },
    {
      label: 'Today\'s Arrivals',
      value: stats?.todayArrivals || 0,
      icon: Users,
      color: 'green',
      link: '/frontdesk/upcoming-bookings'
    },
    {
      label: 'Available Rooms',
      value: stats?.availableRooms || 0,
      icon: Bed,
      color: 'purple',
      link: '/frontdesk/rooms'
    },
    {
      label: 'Guest Requests',
      value: pendingGuestServiceCount,
      icon: Bell,
      color: 'orange',
      link: '/frontdesk/guest-services'
    },
    {
      label: 'Pending Approvals',
      value: pendingApprovalCount,
      icon: FileCheck,
      color: 'yellow',
      link: '/frontdesk/my-approvals'
    }
  ];

  const quickActions = [
    {
      title: 'Tape Chart',
      description: 'View room availability',
      icon: Grid,
      link: '/frontdesk/tape-chart',
      color: 'blue'
    },
    {
      title: 'Upcoming Arrivals',
      description: 'Manage check-ins',
      icon: Clock,
      link: '/frontdesk/upcoming-bookings',
      color: 'green'
    },
    {
      title: 'Housekeeping',
      description: 'Room status updates',
      icon: ClipboardList,
      link: '/frontdesk/housekeeping',
      color: 'purple'
    },
    {
      title: 'Guest Services',
      description: 'Handle guest requests',
      icon: CheckCircle,
      link: '/frontdesk/guest-services',
      color: 'orange'
    }
  ];

  // No property selected — show a helpful message
  if (!selectedProperty) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Front Desk Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Welcome back, {user?.name}!
          </p>
        </div>
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-yellow-400 mr-3" />
            <p className="text-sm font-medium text-yellow-800">
              Please select a property to view the dashboard.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Front Desk Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Welcome back, {user?.name}! Here's your overview for today.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {quickStats.map((stat) => {
          const Icon = stat.icon;
          const bgColor = {
            blue: 'bg-blue-500',
            green: 'bg-green-500',
            purple: 'bg-purple-500',
            yellow: 'bg-yellow-500',
            orange: 'bg-orange-500'
          }[stat.color];

          return (
            <Link
              key={stat.label}
              to={stat.link || '#'}
              className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                  <p className="mt-2 text-3xl font-semibold text-gray-900">
                    {isLoading ? '...' : stat.value}
                  </p>
                </div>
                <div className={`${bgColor} p-3 rounded-lg`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Error Banner */}
      {statsError && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-lg">
          <p className="text-sm text-red-700">Failed to load dashboard data. Retrying...</p>
        </div>
      )}

      {/* Pending Approvals Alert */}
      {pendingApprovalCount > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-yellow-400 mr-3" />
            <div>
              <p className="text-sm font-medium text-yellow-800">
                You have {pendingApprovalCount} pending approval request{pendingApprovalCount > 1 ? 's' : ''}
              </p>
              <Link
                to="/frontdesk/my-approvals"
                className="text-sm text-yellow-700 underline hover:text-yellow-900"
              >
                View all requests
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            const bgColor = {
              blue: 'bg-blue-100',
              green: 'bg-green-100',
              purple: 'bg-purple-100',
              yellow: 'bg-yellow-100',
              orange: 'bg-orange-100'
            }[action.color];

            const iconColor = {
              blue: 'text-blue-600',
              green: 'text-green-600',
              purple: 'text-purple-600',
              yellow: 'text-yellow-600',
              orange: 'text-orange-600'
            }[action.color];

            return (
              <Link
                key={action.title}
                to={action.link}
                className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-all hover:scale-105"
              >
                <div className={`${bgColor} w-12 h-12 rounded-lg flex items-center justify-center mb-4`}>
                  <Icon className={`h-6 w-6 ${iconColor}`} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">{action.title}</h3>
                <p className="text-sm text-gray-600">{action.description}</p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Room Status Grid */}
      {roomStatus && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Room Status Overview</h2>
            <Link to="/frontdesk/tape-chart" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              Open Tape Chart →
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-700">{roomStatus?.available ?? 0}</p>
              <p className="text-xs text-green-600 mt-1">Available</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-700">{roomStatus?.occupied || 0}</p>
              <p className="text-xs text-blue-600 mt-1">Occupied</p>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <p className="text-2xl font-bold text-yellow-700">{roomStatus?.dirty ?? 0}</p>
              <p className="text-xs text-yellow-600 mt-1">Dirty</p>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <p className="text-2xl font-bold text-orange-700">{roomStatus?.maintenance || 0}</p>
              <p className="text-xs text-orange-600 mt-1">Maintenance</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <p className="text-2xl font-bold text-red-700">{roomStatus?.outOfOrder ?? 0}</p>
              <p className="text-xs text-red-600 mt-1">Out of Order</p>
            </div>
          </div>
        </div>
      )}

      {/* Today's Schedule */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Arrivals */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Today's Arrivals</h2>
            <span className="bg-green-100 text-green-700 text-xs font-medium px-2.5 py-1 rounded-full">
              {stats?.todayArrivals || 0} guests
            </span>
          </div>
          <div className="space-y-3">
            {todayArrivals && todayArrivals.length > 0 ? (
              todayArrivals.filter((b: any) => b.status === 'confirmed').slice(0, 5).map((booking: any) => (
                <div key={booking._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{booking.guestName || booking.userId?.name || 'Guest'}</p>
                    <p className="text-xs text-gray-500">Room {booking.rooms?.[0]?.roomId?.roomNumber || booking.rooms?.[0]?.roomNumber || booking.roomNumber || '—'}</p>
                  </div>
                  <Link
                    to="/frontdesk/bookings"
                    className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700"
                  >
                    Check In
                  </Link>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">No arrivals scheduled</p>
            )}
            <Link to="/frontdesk/upcoming-bookings" className="block text-center text-sm text-green-600 hover:text-green-700 font-medium pt-2">
              View all arrivals →
            </Link>
          </div>
        </div>

        {/* Departures */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Today's Departures</h2>
            <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2.5 py-1 rounded-full">
              {stats?.todayDepartures || 0} guests
            </span>
          </div>
          <div className="space-y-3">
            {todayDepartures && todayDepartures.length > 0 ? (
              todayDepartures.filter((b: any) => b.status === 'checked_in').slice(0, 5).map((booking: any) => (
                <div key={booking._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{booking.guestName || booking.userId?.name || 'Guest'}</p>
                    <p className="text-xs text-gray-500">Room {booking.rooms?.[0]?.roomId?.roomNumber || booking.rooms?.[0]?.roomNumber || booking.roomNumber || '—'}</p>
                  </div>
                  <Link
                    to="/frontdesk/bookings"
                    className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700"
                  >
                    Check Out
                  </Link>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">No departures today</p>
            )}
            <Link to="/frontdesk/bookings" className="block text-center text-sm text-blue-600 hover:text-blue-700 font-medium pt-2">
              View all bookings →
            </Link>
          </div>
        </div>
      </div>

      {/* Pending Guest Service Requests */}
      {guestServiceRequests && guestServiceRequests.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Bell className="h-5 w-5 text-orange-500" />
              Pending Guest Requests
            </h2>
            <Link to="/frontdesk/guest-services" className="text-sm text-orange-600 hover:text-orange-700 font-medium">
              View all requests →
            </Link>
          </div>
          <div className="space-y-3">
            {guestServiceRequests.map((request: any) => (
              <div key={request._id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 text-sm">
                    {request.serviceType || request.category || 'Service Request'}
                  </p>
                  <p className="text-xs text-gray-500">
                    Guest: {request.userId?.name || 'Unknown'} — Room {request.bookingId?.rooms?.[0]?.roomId?.roomNumber || '—'}
                  </p>
                  {request.description && (
                    <p className="text-xs text-gray-400 mt-1 truncate max-w-[300px]">{request.description}</p>
                  )}
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                  request.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                  request.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {request.priority || 'normal'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Summary */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center p-4 bg-purple-50 rounded-lg">
            <ClipboardList className="h-8 w-8 text-purple-600 mr-3" />
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats?.activeBookings || stats?.checkedIn || 0}</p>
              <p className="text-sm text-gray-600">Active Guests</p>
            </div>
          </div>
          <div className="flex items-center p-4 bg-green-50 rounded-lg">
            <CheckCircle className="h-8 w-8 text-green-600 mr-3" />
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats?.availableRooms || 0}</p>
              <p className="text-sm text-gray-600">Rooms Available</p>
            </div>
          </div>
          <div className="flex items-center p-4 bg-yellow-50 rounded-lg">
            <AlertCircle className="h-8 w-8 text-yellow-600 mr-3" />
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats?.housekeepingPending || stats?.pendingHousekeeping || 0}</p>
              <p className="text-sm text-gray-600">Housekeeping Pending</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default withErrorBoundary(FrontDeskDashboard);

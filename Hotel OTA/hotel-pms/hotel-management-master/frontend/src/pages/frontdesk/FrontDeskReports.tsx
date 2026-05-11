import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  TrendingUp,
  Users,
  Calendar,
  RefreshCw,
  AlertTriangle,
  Info,
  Bed,
  DollarSign,
  UserCheck,
  UserX,
  LogIn,
  LogOut,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { api } from '../../services/api';
import { withErrorBoundary } from '../../components/ErrorBoundary';

interface DashboardCounts {
  totalBookings?: number;
  todayCheckIns?: number;
  todayCheckOuts?: number;
  occupiedRooms?: number;
  availableRooms?: number;
  totalRooms?: number;
  totalRevenue?: number;
  pendingBookings?: number;
  cancelledBookings?: number;
  noShows?: number;
}

interface DashboardMetrics {
  occupancy?: {
    current?: number;
    trend?: number;
  };
  revenue?: {
    total?: number;
    roomRevenue?: number;
    serviceRevenue?: number;
    averageDailyRate?: number;
    revPar?: number;
  };
  guests?: {
    arrivals?: number;
    departures?: number;
    inHouse?: number;
    noShows?: number;
    cancellations?: number;
  };
}

interface RecentActivity {
  checkIns?: Array<{
    _id: string;
    checkIn: string;
    userId?: { name: string };
    rooms?: Array<{ roomId?: { roomNumber: string } }>;
  }>;
  checkOuts?: Array<{
    _id: string;
    createdAt: string;
    roomId?: { roomNumber: string };
    bookingId?: { userId?: { name: string } };
  }>;
  guestServices?: Array<{
    _id: string;
    title: string;
    status: string;
    createdAt: string;
    userId?: { name: string };
  }>;
}

const fetchDashboardCounts = async (): Promise<DashboardCounts> => {
  const { data } = await api.get('/dashboard/counts');
  return data.data || data;
};

const fetchDashboardMetrics = async (): Promise<DashboardMetrics> => {
  try {
    const { data } = await api.get('/analytics/dashboard/metrics');
    return data.data || data;
  } catch {
    return {};
  }
};

const fetchRecentActivity = async (): Promise<RecentActivity> => {
  try {
    const { data } = await api.get('/staff-dashboard/activity');
    return data.data || {};
  } catch {
    return {};
  }
};

type TabKey = 'occupancy' | 'revenue' | 'guests';

const tabConfig: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'occupancy', label: 'Occupancy', icon: Bed },
  { key: 'revenue', label: 'Revenue', icon: DollarSign },
  { key: 'guests', label: 'Guest Stats', icon: Users },
];

function FrontDeskReports() {
  const [activeTab, setActiveTab] = useState<TabKey>('occupancy');
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: counts,
    isLoading: countsLoading,
    error: countsError,
    refetch: refetchCounts,
  } = useQuery({
    queryKey: ['frontdesk-dashboard-counts'],
    queryFn: fetchDashboardCounts,
    refetchInterval: 60000,
  });

  const {
    data: metrics,
    isLoading: metricsLoading,
    refetch: refetchMetrics,
  } = useQuery({
    queryKey: ['frontdesk-dashboard-metrics'],
    queryFn: fetchDashboardMetrics,
    refetchInterval: 60000,
  });

  const {
    data: activity,
    isLoading: activityLoading,
    refetch: refetchActivity,
  } = useQuery({
    queryKey: ['frontdesk-recent-activity'],
    queryFn: fetchRecentActivity,
    refetchInterval: 60000,
  });

  const handleRefresh = () => {
    setRefreshing(true);
    Promise.all([refetchCounts(), refetchMetrics(), refetchActivity()]).finally(() =>
      setTimeout(() => setRefreshing(false), 500)
    );
  };

  const isLoading = countsLoading;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (countsError) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load reports</h3>
        <p className="text-gray-500 mb-4">There was an error loading the report data.</p>
        <Button onClick={() => refetchCounts()}>Try Again</Button>
      </div>
    );
  }

  const totalRooms = counts?.totalRooms || 0;
  const occupiedRooms = counts?.occupiedRooms || 0;
  const availableRooms = counts?.availableRooms || (totalRooms - occupiedRooms);
  const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const formatCurrency = (amount?: number) => {
    if (amount == null) return '--';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-600">View occupancy, revenue, and guest statistics</p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={refreshing}
          variant="outline"
          className="flex items-center"
        >
          <RefreshCw className={cn('w-4 h-4 mr-2', refreshing && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Info Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800 flex items-start gap-2">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>
            <strong>Front Desk Reports:</strong> Real-time overview of hotel performance.
            Data refreshes automatically every minute.
          </span>
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Occupancy Rate</p>
                <p className="text-2xl font-bold text-gray-900">{occupancyRate}%</p>
              </div>
              <Bed className="w-8 h-8 text-blue-500 opacity-70" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Today's Check-ins</p>
                <p className="text-2xl font-bold text-gray-900">{counts?.todayCheckIns ?? 0}</p>
              </div>
              <LogIn className="w-8 h-8 text-green-500 opacity-70" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Today's Check-outs</p>
                <p className="text-2xl font-bold text-gray-900">{counts?.todayCheckOuts ?? 0}</p>
              </div>
              <LogOut className="w-8 h-8 text-orange-500 opacity-70" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Bookings</p>
                <p className="text-2xl font-bold text-gray-900">{counts?.totalBookings ?? 0}</p>
              </div>
              <Calendar className="w-8 h-8 text-purple-500 opacity-70" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-4" aria-label="Report tabs">
          {tabConfig.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors',
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'occupancy' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Bed className="w-5 h-5" />
                Room Occupancy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Occupancy gauge */}
                <div className="text-center py-4">
                  <div className="relative inline-flex items-center justify-center w-32 h-32">
                    <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 36 36">
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#e5e7eb"
                        strokeWidth="3"
                      />
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke={occupancyRate >= 80 ? '#ef4444' : occupancyRate >= 50 ? '#f59e0b' : '#22c55e'}
                        strokeWidth="3"
                        strokeDasharray={`${occupancyRate}, 100`}
                      />
                    </svg>
                    <div className="absolute text-center">
                      <span className="text-2xl font-bold text-gray-900">{occupancyRate}%</span>
                    </div>
                  </div>
                  <Badge
                    className={cn('mt-2', occupancyRate >= 80 ? 'bg-red-100 text-red-800' : occupancyRate >= 50 ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800')}
                  >
                    {occupancyRate >= 80 ? 'High Occupancy' : occupancyRate >= 50 ? 'Moderate' : 'Low Occupancy'}
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <p className="text-sm text-blue-600 font-medium">Total</p>
                    <p className="text-xl font-bold text-blue-800">{totalRooms}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <p className="text-sm text-green-600 font-medium">Available</p>
                    <p className="text-xl font-bold text-green-800">{availableRooms}</p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-3 text-center">
                    <p className="text-sm text-orange-600 font-medium">Occupied</p>
                    <p className="text-xl font-bold text-orange-800">{occupiedRooms}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Key Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              {metricsLoading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner size="medium" />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">Average Daily Rate (ADR)</p>
                      <p className="text-xs text-gray-500">Revenue per occupied room</p>
                    </div>
                    <span className="text-lg font-bold text-blue-600">
                      {formatCurrency(metrics?.revenue?.averageDailyRate)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">RevPAR</p>
                      <p className="text-xs text-gray-500">Revenue per available room</p>
                    </div>
                    <span className="text-lg font-bold text-green-600">
                      {formatCurrency(metrics?.revenue?.revPar)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">Pending Bookings</p>
                      <p className="text-xs text-gray-500">Awaiting confirmation</p>
                    </div>
                    <Badge variant="outline" className="text-amber-700">
                      {counts?.pendingBookings ?? 0}
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'revenue' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Revenue Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              {metricsLoading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner size="medium" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4 text-center">
                    <p className="text-sm text-blue-600 font-medium">Total Revenue</p>
                    <p className="text-3xl font-bold text-blue-800 mt-1">
                      {formatCurrency(metrics?.revenue?.total ?? counts?.totalRevenue)}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-green-50 rounded-lg p-4 text-center">
                      <p className="text-sm text-green-600 font-medium">Room Revenue</p>
                      <p className="text-xl font-bold text-green-800">
                        {formatCurrency(metrics?.revenue?.roomRevenue)}
                      </p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4 text-center">
                      <p className="text-sm text-purple-600 font-medium">Service Revenue</p>
                      <p className="text-xl font-bold text-purple-800">
                        {formatCurrency(metrics?.revenue?.serviceRevenue)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Rate Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {metricsLoading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner size="medium" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">Average Daily Rate</p>
                      <p className="text-sm text-gray-500">Per occupied room per night</p>
                    </div>
                    <span className="text-xl font-bold text-blue-600">
                      {formatCurrency(metrics?.revenue?.averageDailyRate)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">RevPAR</p>
                      <p className="text-sm text-gray-500">Revenue per available room</p>
                    </div>
                    <span className="text-xl font-bold text-green-600">
                      {formatCurrency(metrics?.revenue?.revPar)}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'guests' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="w-5 h-5" />
                Guest Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <LogIn className="w-6 h-6 text-green-600 mx-auto mb-1" />
                  <p className="text-sm text-green-600 font-medium">Arrivals Today</p>
                  <p className="text-2xl font-bold text-green-800">
                    {metrics?.guests?.arrivals ?? counts?.todayCheckIns ?? 0}
                  </p>
                </div>
                <div className="bg-orange-50 rounded-lg p-4 text-center">
                  <LogOut className="w-6 h-6 text-orange-600 mx-auto mb-1" />
                  <p className="text-sm text-orange-600 font-medium">Departures Today</p>
                  <p className="text-2xl font-bold text-orange-800">
                    {metrics?.guests?.departures ?? counts?.todayCheckOuts ?? 0}
                  </p>
                </div>
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <UserCheck className="w-6 h-6 text-blue-600 mx-auto mb-1" />
                  <p className="text-sm text-blue-600 font-medium">In-House</p>
                  <p className="text-2xl font-bold text-blue-800">
                    {metrics?.guests?.inHouse ?? occupiedRooms}
                  </p>
                </div>
                <div className="bg-red-50 rounded-lg p-4 text-center">
                  <UserX className="w-6 h-6 text-red-600 mx-auto mb-1" />
                  <p className="text-sm text-red-600 font-medium">No-Shows</p>
                  <p className="text-2xl font-bold text-red-800">
                    {metrics?.guests?.noShows ?? counts?.noShows ?? 0}
                  </p>
                </div>
              </div>
              <div className="mt-4 p-3 bg-amber-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-amber-700">Cancellations</span>
                  <Badge className="bg-amber-100 text-amber-800">
                    {metrics?.guests?.cancellations ?? counts?.cancelledBookings ?? 0}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activityLoading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner size="medium" />
                </div>
              ) : (
                <div className="space-y-3 max-h-[360px] overflow-y-auto">
                  {activity?.checkIns?.slice(0, 3).map((checkin) => (
                    <div key={checkin._id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          Check-in: Room {checkin.rooms?.[0]?.roomId?.roomNumber || 'N/A'}
                        </p>
                        <p className="text-xs text-gray-600">{checkin.userId?.name || 'Guest'}</p>
                      </div>
                      <span className="text-xs text-green-600">{formatTimeAgo(checkin.checkIn)}</span>
                    </div>
                  ))}

                  {activity?.checkOuts?.slice(0, 3).map((checkout) => (
                    <div key={checkout._id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          Check-out: Room {checkout.roomId?.roomNumber || 'N/A'}
                        </p>
                        <p className="text-xs text-gray-600">{checkout.bookingId?.userId?.name || 'Guest'}</p>
                      </div>
                      <span className="text-xs text-orange-600">{formatTimeAgo(checkout.createdAt)}</span>
                    </div>
                  ))}

                  {activity?.guestServices?.slice(0, 3).map((service) => (
                    <div key={service._id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{service.title}</p>
                        <p className="text-xs text-gray-600">{service.userId?.name || 'Guest'}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {service.status?.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                  ))}

                  {(!activity?.checkIns?.length && !activity?.checkOuts?.length && !activity?.guestServices?.length) && (
                    <div className="text-center py-8 text-gray-500">
                      <Calendar className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                      <p className="text-sm">No recent activity</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default withErrorBoundary(FrontDeskReports);

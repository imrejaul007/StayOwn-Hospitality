import React, { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '../../utils/cn';
import {
  MetricCard,
  ChartCard,
  AlertCard,
  DataTable,
  FilterBar,
  RefreshButton,
  LineChart,
  DonutChart,
  HeatmapChart,
} from '../../components/dashboard';
import { RevenueBreakdownPopup } from '../../components/dashboard/RevenueBreakdownPopup';
import { OccupancyBreakdownPopup } from '../../components/dashboard/OccupancyBreakdownPopup';
import { BookingsBreakdownPopup } from '../../components/dashboard/BookingsBreakdownPopup';
import { SatisfactionBreakdownPopup } from '../../components/dashboard/SatisfactionBreakdownPopup';
import { StatusBadge } from '../../components/dashboard/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Building2, Activity, Clock, Settings } from 'lucide-react';
import { useDashboardOverview, useOccupancyData, useRevenueData } from '../../hooks/useDashboard';
import { formatCurrency, formatPercentage, formatRelativeTime } from '../../utils/dashboardUtils';
import { useAuth } from '../../context/AuthContext';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import { useNavigate } from 'react-router-dom';
import { InventoryDashboardWidget } from '../../components/admin/InventoryDashboardWidget';
import { InventoryNotifications } from '../../components/admin/InventoryNotifications';
import { SupplyRequestDashboardWidget } from '../../components/admin/SupplyRequestDashboardWidget';
import UpcomingArrivalsWidget from '../../components/admin/UpcomingArrivalsWidget';
import { withErrorBoundary } from '../../components/ErrorBoundary';

function AdminDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { selectedPropertyId, selectedProperty } = useProperty();

  // Use PropertyContext's selectedPropertyId
  const selectedHotelId = selectedPropertyId || user?.hotelId || '';
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [showRevenueBreakdown, setShowRevenueBreakdown] = useState(false);
  const [showOccupancyBreakdown, setShowOccupancyBreakdown] = useState(false);
  const [showBookingsBreakdown, setShowBookingsBreakdown] = useState(false);
  const [showSatisfactionBreakdown, setShowSatisfactionBreakdown] = useState(false);


  // Fetch dashboard data
  const {
    realTimeData,
    kpis,
    alerts,
    systemHealth,
    isLoading,
    error
  } = useDashboardOverview(selectedHotelId);

  const occupancyQuery = useOccupancyData(selectedHotelId, undefined, undefined, {
    enabled: !!selectedHotelId
  });
  const revenueQuery = useRevenueData(selectedHotelId, 'month', undefined, undefined, undefined, {
    enabled: !!selectedHotelId
  });
  const weekChangeCount = Math.max(0, Math.round(Math.abs(kpis.data?.data?.bookingGrowth || 0)));
  const operationalTimeSaved = Math.max(0, Math.round((kpis.data?.data?.occupancyGrowth || 0) * 0.8));

  // React Query will automatically refetch when selectedHotelId changes due to enabled condition
  // No manual refetch needed to avoid excessive API calls

  const handleRefresh = useCallback(() => {
    realTimeData.refetch();
    kpis.refetch();
    alerts.refetch();
    systemHealth.refetch();
    occupancyQuery.refetch();
    revenueQuery.refetch();
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  }, [realTimeData, kpis, alerts, systemHealth, occupancyQuery, revenueQuery, queryClient]);

  const handleFilterChange = (key: string, value: unknown) => {
    if (key === 'dateRange') {
      setDateRange(value as { start: string; end: string });
    }
  };

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load dashboard</h3>
          <p className="text-gray-500 mb-4">There was an error loading the dashboard data.</p>
          <Button onClick={handleRefresh}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 min-w-0">
      {/* Breadcrumb */}
      <PropertyBreadcrumb items={['Dashboard']} />

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">Real-time hotel management overview</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <Button
            onClick={() => navigate('/')}
            variant="secondary"
            className="flex items-center space-x-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span>Home</span>
          </Button>
          <RefreshButton
            onRefresh={handleRefresh}
            loading={isLoading}
            lastUpdated={realTimeData.data?.data?.lastUpdated}
            autoRefresh={true}
            showLastUpdated={true}
          />
        </div>
      </div>

      {/* Filters Section */}
      <FilterBar
        filters={[
          {
            key: 'dateRange',
            label: 'Date Range',
            type: 'daterange',
          },
        ]}
        values={{ dateRange }}
        onChange={handleFilterChange}
        className="mb-6"
      />

      {/* KPI Cards Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div 
          className="relative"
          onMouseEnter={() => setShowRevenueBreakdown(true)}
          onMouseLeave={() => setShowRevenueBreakdown(false)}
        >
          <MetricCard
            title="Monthly Revenue"
            value={realTimeData.data?.data?.monthly?.revenue || 0}
            type="currency"
            trend={{
              value: kpis.data?.data?.revenueGrowth || 0,
              direction: (kpis.data?.data?.revenueGrowth || 0) >= 0 ? 'up' : 'down',
              label: 'vs last month'
            }}
            icon={
              <div className="w-6 h-6 flex items-center justify-center text-lg font-bold">
                ₹
              </div>
            }
            color="green"
            loading={isLoading}
            className="transition-all duration-200 hover:shadow-lg hover:scale-[1.02] cursor-pointer"
          />
          <RevenueBreakdownPopup 
            isVisible={showRevenueBreakdown}
            hotelId={selectedHotelId}
            onClose={() => setShowRevenueBreakdown(false)}
            position="right"
          />
        </div>

        <div 
          className="relative"
          onMouseEnter={() => setShowOccupancyBreakdown(true)}
          onMouseLeave={() => setShowOccupancyBreakdown(false)}
        >
          <MetricCard
            title="Occupancy Rate"
            value={occupancyQuery.data?.data?.overallMetrics?.occupancyRate || 0}
            type="percentage"
            trend={{
              value: kpis.data?.data?.occupancyGrowth || 0,
              direction: (kpis.data?.data?.occupancyGrowth || 0) > 0 ? 'up' : 'down',
              label: 'vs last week'
            }}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            }
            color="blue"
            loading={isLoading}
            className="transition-all duration-200 hover:shadow-lg hover:scale-[1.02] cursor-pointer"
          />
          <OccupancyBreakdownPopup 
            isVisible={showOccupancyBreakdown}
            hotelId={selectedHotelId}
            onClose={() => setShowOccupancyBreakdown(false)}
            position="right"
          />
        </div>

        <div 
          className="relative"
          onMouseEnter={() => setShowBookingsBreakdown(true)}
          onMouseLeave={() => setShowBookingsBreakdown(false)}
        >
          <MetricCard
            title="Total Bookings"
            value={realTimeData.data?.data?.overview?.totalBookings || 0}
            trend={{
              value: kpis.data?.data?.bookingGrowth || 0,
              direction: (kpis.data?.data?.bookingGrowth || 0) >= 0 ? 'up' : 'down',
              label: 'vs last month'
            }}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
            }
            color="purple"
            loading={isLoading}
            className="transition-all duration-200 hover:shadow-lg hover:scale-[1.02] cursor-pointer"
          />
          <BookingsBreakdownPopup 
            isVisible={showBookingsBreakdown}
            hotelId={selectedHotelId}
            onClose={() => setShowBookingsBreakdown(false)}
            position="right"
          />
        </div>

        <div 
          className="relative"
          onMouseEnter={() => setShowSatisfactionBreakdown(true)}
          onMouseLeave={() => setShowSatisfactionBreakdown(false)}
        >
          <MetricCard
            title="Guest Satisfaction"
            value={realTimeData.data?.data?.guestSatisfaction?.averageRating || 0}
            suffix="/5"
            trend={{
              value: kpis.data?.data?.satisfactionGrowth || 0,
              direction: (kpis.data?.data?.satisfactionGrowth || 0) > 0 ? 'up' : 'down',
              label: 'vs last month'
            }}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            }
            color="yellow"
            loading={isLoading}
            className="transition-all duration-200 hover:shadow-lg hover:scale-[1.02] cursor-pointer"
          />
          <SatisfactionBreakdownPopup 
            isVisible={showSatisfactionBreakdown}
            hotelId={selectedHotelId}
            onClose={() => setShowSatisfactionBreakdown(false)}
            position="bottom"
          />
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Revenue Chart */}
        <ChartCard
          title="Revenue Trends"
          subtitle="Monthly revenue over time"
          loading={revenueQuery.isLoading}
          error={revenueQuery.error?.message}
          onRefresh={() => revenueQuery.refetch()}
          height="350px"
        >
          <LineChart
            data={(revenueQuery.data?.data?.timeSeries || []) as any}
            xDataKey="date"
            lines={[
              {
                dataKey: 'revenue',
                name: 'Revenue',
                color: '#10b981',
              },
              {
                dataKey: 'bookings',
                name: 'Bookings',
                color: '#3b82f6',
              }
            ]}
            height={300}
          />
        </ChartCard>

        {/* Occupancy Chart */}
        <ChartCard
          title="Occupancy by Room Type"
          subtitle="Current occupancy breakdown"
          loading={occupancyQuery.isLoading}
          error={occupancyQuery.error?.message}
          onRefresh={() => occupancyQuery.refetch()}
          height="350px"
        >
          <DonutChart
            data={occupancyQuery.data?.data?.roomTypeDistribution ? Object.entries(occupancyQuery.data.data.roomTypeDistribution).map(([roomType, rawData]: [string, unknown]) => {
              const data = (rawData || {}) as Record<string, number>;
              const total = Number(data.total) || 0;
              const occupied = Number(data.occupied) || 0;
              const available = Number(data.available) || 0;
              return {
                name: roomType.charAt(0).toUpperCase() + roomType.slice(1),
                value: total,
                percentage: total > 0 ? ((occupied / total) * 100) : 0,
                occupied,
                available,
              };
            }) : []}
            height={300}
            centerContent={
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {formatPercentage(occupancyQuery.data?.data?.overallMetrics?.occupancyRate || 0)}
                </div>
                <div className="text-sm text-gray-500">Overall</div>
              </div>
            }
          />
        </ChartCard>
      </div>

      {/* Room Status Heatmap */}
      <ChartCard
        title="Room Status Overview"
        subtitle="Real-time room status by floor"
        loading={occupancyQuery.isLoading}
        error={occupancyQuery.error?.message}
        onRefresh={() => occupancyQuery.refetch()}
        height="400px"
      >
        {(occupancyQuery.data?.data?.rooms?.length || 0) > 0 ? (
          <HeatmapChart
            data={(() => {
              const rooms = occupancyQuery.data?.data?.rooms || [];
              const floors: { [key: number]: { roomNumber: string; status: string; color: string }[] } = {};

              rooms.forEach(room => {
                const roomNum = room.roomNumber || '';
                const floor = parseInt(roomNum.charAt(0)) || 0;
                if (!floors[floor]) {
                  floors[floor] = [];
                }
                floors[floor].push({
                  roomNumber: room.roomNumber,
                  status: room.status,
                  color: room.status === 'occupied' ? '#ef4444' :
                         room.status === 'vacant' ? '#10b981' :
                         room.status === 'reserved' ? '#8b5cf6' :
                         room.status === 'dirty' ? '#f59e0b' :
                         room.status === 'maintenance' ? '#f97316' :
                         room.status === 'out_of_order' ? '#6b7280' : '#10b981'
                });
              });
              
              const result = Object.entries(floors).map(([floor, rooms]) => ({
                floor: parseInt(floor),
                rooms: rooms
              }));
              return result;
            })()}
            onRoomClick={(room) => {
              // Find the full room data to get the room ID
              const fullRoomData = occupancyQuery.data?.data?.rooms?.find(r => r.roomNumber === room.roomNumber);
              if (fullRoomData?._id) {
                navigate(`/admin/rooms/${fullRoomData._id}`);
              }
            }}
            height={350}
          />
        ) : (
          <div className="flex items-center justify-center h-64 text-gray-500">
            <div className="text-center">
              <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <p>No room data available</p>
              <p className="text-sm">Check if the backend is running and the hotel ID is correct</p>
            </div>
          </div>
        )}
      </ChartCard>

      {/* Inventory Dashboard Section */}
      <InventoryDashboardWidget
        hotelId={selectedHotelId}
        onNavigate={(path) => navigate(path)}
      />

      {/* Supply Request Dashboard Section */}
      <SupplyRequestDashboardWidget
        hotelId={selectedHotelId}
        onNavigate={(path) => navigate(path)}
      />

      {/* Upcoming Arrivals Widget */}
      <div className="mb-8">
        <UpcomingArrivalsWidget />
      </div>

      {/* Inventory Notifications Section */}
      <div className="mb-8">
        <InventoryNotifications />
      </div>

      {/* Multi-Property Management Section */}
      {(user?.properties && user.properties.length > 1) && (
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Multi-Property Management
                </CardTitle>
                <CardDescription className="mt-1">
                  Recent settings changes across your properties
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/admin/multi-property')}
                >
                  View Analytics
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/admin/reports')}
                >
                  View All
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-blue-600 font-medium">Properties Managed</p>
                    <p className="text-2xl font-bold text-blue-900">
                      {user?.properties?.length || 0}
                    </p>
                  </div>
                  <Building2 className="h-8 w-8 text-blue-600" />
                </div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-600 font-medium">Changes This Week</p>
                    <p className="text-2xl font-bold text-green-900">{weekChangeCount}</p>
                  </div>
                  <Activity className="h-8 w-8 text-green-600" />
                </div>
              </div>
              <div className="bg-orange-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-orange-600 font-medium">Time Saved</p>
                    <p className="text-2xl font-bold text-orange-900">{operationalTimeSaved}h</p>
                  </div>
                  <Clock className="h-8 w-8 text-orange-600" />
                </div>
              </div>
            </div>

            {/* Recent Changes - Placeholder for now */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-700">Recent Activity</h4>
              <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                <Settings className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                <p>No high-priority multi-property alerts in the selected period.</p>
                <p className="text-sm mt-1">Use View Analytics for detailed cross-property activity.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bottom Section - Tables and Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Recent Bookings */}
        <div className="lg:col-span-2">
          <DataTable
            title="Recent Bookings"
            data={realTimeData.data?.data?.recentActivity?.bookings || []}
            columns={[
              {
                key: 'bookingNumber',
                header: 'Booking #',
                width: '140px',
              },
              {
                key: 'userId',
                header: 'Guest',
                render: (_, row) => row.userId?.name || 'N/A',
              },
              {
                key: 'checkIn',
                header: 'Check-in',
                render: (value) => new Date(value).toLocaleDateString(),
              },
              {
                key: 'status',
                header: 'Status',
                render: (value) => <StatusBadge status={value} size="sm" />,
                width: '120px',
              },
              {
                key: 'totalAmount',
                header: 'Amount',
                render: (value) => formatCurrency(value),
                align: 'right' as const,
                width: '100px',
              },
            ]}
            loading={isLoading}
            pageSize={8}
            searchable={true}
            onRowClick={(row: any) => navigate('/admin/bookings')}
          />
        </div>

        {/* Alerts Panel */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Active Alerts</h3>
            <Badge variant="default">
              {alerts.data?.data?.alerts?.length || 0}
            </Badge>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {isLoading ? (
              Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-20 bg-gray-200 rounded"></div>
                </div>
              ))
            ) : (alerts.data?.data?.alerts?.length ?? 0) === 0 ? (
              <div className="text-center py-8">
                <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-gray-500 text-sm">No active alerts</p>
              </div>
            ) : (
              (alerts.data?.data?.alerts ?? []).slice(0, 5).map((alert) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  compact={true}
                  onViewDetails={() => navigate('/admin/notifications')}
                />
              ))
            )}
          </div>

          {(alerts.data?.data?.alerts?.length || 0) > 5 && (
            <Button variant="secondary" size="sm" className="w-full" onClick={() => navigate('/admin/notifications')}>
              View All Alerts ({alerts.data?.data?.alerts?.length ?? 0})
            </Button>
          )}
        </div>
      </div>

      {/* System Health Status */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center space-x-3">
            <div className={cn(
              'w-3 h-3 rounded-full',
              systemHealth.isLoading ? 'bg-gray-400 animate-pulse' :
              systemHealth.data?.data?.overall?.status === 'healthy' ? 'bg-green-500' :
              systemHealth.data?.data?.overall?.status === 'warning' ? 'bg-yellow-500' :
              systemHealth.error ? 'bg-gray-400' :
              'bg-green-500'
            )} />
            <span className="text-sm font-medium text-gray-900">
              System Status: {systemHealth.isLoading ? 'Checking...' : systemHealth.data?.data?.overall?.status || (systemHealth.error ? 'Check Unavailable' : 'Healthy')}
            </span>
          </div>
          <span className="text-xs text-gray-500">
            Last checked: {systemHealth.data?.data?.overall?.lastUpdated ?
              formatRelativeTime(systemHealth.data?.data?.overall?.lastUpdated) : (systemHealth.isLoading ? 'Checking...' : 'Just now')}
          </span>
        </div>
      </div>
    </div>
  );
}

export default withErrorBoundary(AdminDashboard);

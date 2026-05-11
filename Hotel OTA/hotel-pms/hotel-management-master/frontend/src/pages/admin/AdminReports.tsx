import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import ReportBuilder from './reports/ReportBuilder';
import BusinessIntelligenceDashboard from '../../components/reports/BusinessIntelligenceDashboard';
import ExecutiveDashboard from '../../components/admin/ExecutiveDashboard';
import { MetricCard, ChartCard, LineChart, BarChart } from '../../components/dashboard';
import { useRealTime } from '../../services/realTimeService';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDashboardReports, useReportDateRanges, useExportReport } from '../../hooks/useReports';
import { formatCurrency, formatPercentage } from '../../utils/dashboardUtils';
import { Wifi, WifiOff, Receipt } from 'lucide-react';
import toast from 'react-hot-toast';
import { withErrorBoundary } from '../../components/ErrorBoundary';

function AdminReports() {
  const { user } = useAuth();
  const { selectedPropertyId, selectedProperty, viewMode } = useProperty();
  const [currentView, setCurrentView] = useState<'executive' | 'business-intelligence' | 'overview' | 'builder'>('executive');
  const [selectedDateRange, setSelectedDateRange] = useState('thisYear');
  const [exportFormat, setExportFormat] = useState<'csv' | 'excel' | 'pdf'>('csv');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Use selected property context first; fallback to user's primary property only.
  const hotelId = selectedPropertyId || user?.hotelId || '';
  
  const dateRanges = useReportDateRanges();
  const currentRange = dateRanges[selectedDateRange as keyof typeof dateRanges];
  
  const reportsQuery = useDashboardReports(hotelId, currentRange, {
    enabled: currentView === 'overview' && !!hotelId
  });
  const exportMutation = useExportReport();

  // Real-time connection
  const { connectionState, connect, disconnect, on, off, isConnected } = useRealTime();

  // Auto refresh functionality
  React.useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      reportsQuery.refetchAll();
    }, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(interval);
  }, [autoRefresh, reportsQuery.refetchAll]);

  // Real-time connection setup
  // Do NOT disconnect on unmount — realTimeService is a singleton shared across components
  React.useEffect(() => {
    connect().catch(() => { /* WebSocket unavailable */ });
  }, [connect]);

  // Set up real-time event listeners
  React.useEffect(() => {
    if (!isConnected) return;
    
    const handleCheckoutInventoryUpdate = (data: Record<string, unknown>) => {
      reportsQuery.refetchAll();
      toast.success(`Checkout inventory updated: Room ${data.roomNumber || 'N/A'}`);
    };
    
    const handleRevenueUpdate = (data: Record<string, unknown>) => {
      reportsQuery.refetchAll();
      toast.success('Revenue data updated in real-time');
    };
    
    const handleBookingUpdate = (data: Record<string, unknown>) => {
      reportsQuery.refetchAll();
      toast.success('Booking data updated');
    };
    
    on('checkout-inventory:created', handleCheckoutInventoryUpdate);
    on('checkout-inventory:completed', handleCheckoutInventoryUpdate);
    on('checkout-inventory:payment_processed', handleCheckoutInventoryUpdate);
    on('booking:created', handleBookingUpdate);
    on('booking:updated', handleBookingUpdate);
    on('revenue:updated', handleRevenueUpdate);
    
    return () => {
      off('checkout-inventory:created', handleCheckoutInventoryUpdate);
      off('checkout-inventory:completed', handleCheckoutInventoryUpdate);
      off('checkout-inventory:payment_processed', handleCheckoutInventoryUpdate);
      off('booking:created', handleBookingUpdate);
      off('booking:updated', handleBookingUpdate);
      off('revenue:updated', handleRevenueUpdate);
    };
  }, [isConnected, on, off, reportsQuery.refetchAll]);

  if (currentView === 'builder') {
    return <ReportBuilder />;
  }

  if (currentView === 'executive') {
    return <ExecutiveDashboard />;
  }

  if (currentView === 'business-intelligence') {
    return (
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Property Breadcrumb */}
        <PropertyBreadcrumb items={['Reports', 'Business Intelligence']} />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Business Intelligence Dashboard</h1>
            <p className="text-gray-600 mt-1">Advanced KPI tracking and business analytics</p>
          </div>
          <div className="flex items-center space-x-3">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i} value={i + 1}>
                  {new Date(0, i).toLocaleString('en-US', { month: 'long' })}
                </option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Array.from({ length: 5 }, (_, i) => (
                <option key={i} value={new Date().getFullYear() - 2 + i}>
                  {new Date().getFullYear() - 2 + i}
                </option>
              ))}
            </select>
            <Button onClick={() => setCurrentView('overview')}>
              Classic Reports
            </Button>
          </div>
        </div>

        <BusinessIntelligenceDashboard 
          hotelId={hotelId} 
          month={selectedMonth}
          year={selectedYear}
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Property Breadcrumb */}
      <PropertyBreadcrumb items={['Reports']} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-600 mt-1">Comprehensive business intelligence and reporting</p>
        </div>
        <div className="flex items-center space-x-3">
          {/* Real-time connection status */}
          <div className={`flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            isConnected 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {isConnected ? (
              <><Wifi className="w-3 h-3 mr-1" /> Live Updates</>
            ) : (
              <><WifiOff className="w-3 h-3 mr-1" /> Offline</>
            )}
          </div>
          
          <Button
            variant={currentView === 'executive' ? 'primary' : 'secondary'}
            onClick={() => setCurrentView('executive')}
          >
            Executive Dashboard
          </Button>
          <Button
            variant={currentView === 'business-intelligence' ? 'primary' : 'secondary'}
            onClick={() => setCurrentView('business-intelligence')}
          >
            Business Intelligence
          </Button>
          <Button
            variant={currentView === 'overview' ? 'primary' : 'secondary'}
            onClick={() => setCurrentView('overview')}
          >
            Classic Reports
          </Button>
          <Button
            variant={currentView === 'builder' ? 'primary' : 'secondary'}
            onClick={() => setCurrentView('builder')}
          >
            Report Builder
          </Button>
        </div>
      </div>

      {/* Advanced Filters */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Date Range Selector */}
        <Card>
          <CardHeader>
            <CardTitle>Report Period</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(dateRanges).map(([key, range]) => (
                <Button
                  key={key}
                  variant={selectedDateRange === key ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setSelectedDateRange(key)}
                >
                  {key === 'today' ? 'Today' :
                   key === 'last7days' ? 'Last 7 Days' :
                   key === 'last30days' ? 'Last 30 Days' :
                   key === 'last90days' ? 'Last 90 Days' :
                   key === 'thisMonth' ? 'This Month' :
                   key === 'lastMonth' ? 'Last Month' :
                   key === 'thisYear' ? 'This Year' : key}
                </Button>
              ))}
            </div>
            <div className="mt-3 text-sm text-gray-600">
              Selected period: {currentRange.startDate} to {currentRange.endDate}
            </div>
          </CardContent>
        </Card>

        {/* Report Insights */}
        <Card>
          <CardHeader>
            <CardTitle>Key Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {reportsQuery.revenue.data && reportsQuery.revenue.data.breakdown.length > 0 ? (
                <div className="text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Best performing day:</span>
                    <span className="font-medium text-green-600">
                      {reportsQuery.revenue.data.breakdown
                        .reduce((max, item) => item.totalRevenue > max.totalRevenue ? item : max)
                        ._id.date}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Total report period:</span>
                    <span className="font-medium">
                      {Math.ceil((new Date(currentRange.endDate).getTime() - new Date(currentRange.startDate).getTime()) / (1000 * 60 * 60 * 24))} days
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Data freshness:</span>
                    <span className="font-medium text-blue-600">
                      Updated {new Date().toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500 text-center py-4">
                  {reportsQuery.isLoading ? 'Loading insights...' : 'No data available for insights'}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Loading State */}
      {reportsQuery.isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading reports...</span>
        </div>
      )}

      {/* Error State */}
      {reportsQuery.error && (
        <Card>
          <CardContent className="text-center py-8">
            <div className="text-red-500 mb-2">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load reports</h3>
            <p className="text-gray-600 mb-4">There was an error loading the report data.</p>
            <Button onClick={reportsQuery.refetchAll}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Reports Content */}
      {!reportsQuery.isLoading && !reportsQuery.error && (
        <>
          {/* Key Metrics Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              title="Total Revenue"
              value={reportsQuery.revenue.data?.summary.totalRevenue || 0}
              type="currency"
              icon={
                <div className="w-6 h-6 flex items-center justify-center text-lg font-bold">
                  ₹
                </div>
              }
              color="green"
              loading={reportsQuery.revenue.isLoading}
              trend={undefined}
            />
            
            <MetricCard
              title="Total Bookings"
              value={reportsQuery.revenue.data?.summary.totalBookings || 0}
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              }
              color="blue"
              loading={reportsQuery.bookings.isLoading}
            />

            <MetricCard
              title="Occupancy Rate"
              value={reportsQuery.occupancy.data?.summary.occupancyRate || 0}
              type="percentage"
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              }
              color="purple"
              loading={reportsQuery.occupancy.isLoading}
            />

            <MetricCard
              title="Avg Booking Value"
              value={reportsQuery.revenue.data?.summary.averageBookingValue || 0}
              type="currency"
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              }
              color="orange"
              loading={reportsQuery.revenue.isLoading}
            />
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Trend */}
            <ChartCard
              title="Revenue Trend"
              subtitle={`${selectedDateRange.replace(/([A-Z])/g, ' $1').toLowerCase()} revenue analysis`}
              loading={reportsQuery.revenue.isLoading}
              height="400px"
            >
              {reportsQuery.revenue.data?.breakdown && (
                <LineChart
                  data={reportsQuery.revenue.data.breakdown.map(item => ({
                    date: item._id.date,
                    revenue: item.totalRevenue,
                    bookings: item.bookingCount,
                  }))}
                  xDataKey="date"
                  lines={[
                    { dataKey: 'revenue', name: 'Revenue (₹)', color: '#3b82f6' },
                  ]}
                  height={350}
                />
              )}
            </ChartCard>

            {/* Booking Status Distribution */}
            <ChartCard
              title="Booking Status Distribution"
              subtitle="Current booking status breakdown"
              loading={reportsQuery.bookings.isLoading}
              height="400px"
            >
              {reportsQuery.bookings.data?.breakdown && (
                <BarChart
                  data={reportsQuery.bookings.data.breakdown.map(item => ({
                    status: item._id,
                    count: item.count,
                    revenue: item.totalRevenue,
                  }))}
                  xDataKey="status"
                  bars={[
                    { dataKey: 'count', name: 'Bookings', color: '#10b981' },
                  ]}
                  height={350}
                />
              )}
            </ChartCard>
          </div>

          {/* Detailed Reports Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Revenue Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue Summary</CardTitle>
              </CardHeader>
              <CardContent>
                {reportsQuery.revenue.data ? (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Revenue:</span>
                      <span className="font-semibold">{formatCurrency(reportsQuery.revenue.data.summary.totalRevenue)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Bookings:</span>
                      <span className="font-semibold">{reportsQuery.revenue.data.summary.totalBookings}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Avg. Booking Value:</span>
                      <span className="font-semibold">{formatCurrency(reportsQuery.revenue.data.summary.averageBookingValue)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-4">No revenue data available</div>
                )}
              </CardContent>
            </Card>

            {/* Occupancy Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Occupancy Summary</CardTitle>
              </CardHeader>
              <CardContent>
                {reportsQuery.occupancy.data ? (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Occupancy Rate:</span>
                      <span className="font-semibold">{formatPercentage(reportsQuery.occupancy.data.summary.occupancyRate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Room Nights:</span>
                      <span className="font-semibold">{reportsQuery.occupancy.data.summary.totalRoomNights.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Rooms:</span>
                      <span className="font-semibold">{reportsQuery.occupancy.data.summary.totalRooms}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-4">No occupancy data available</div>
                )}
              </CardContent>
            </Card>

            {/* Booking Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Booking Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                {reportsQuery.stats.data ? (
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Confirmed:</span>
                      <Badge variant="secondary">{reportsQuery.stats.data.stats.confirmed}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Checked In:</span>
                      <Badge variant="secondary">{reportsQuery.stats.data.stats.checkedIn}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Checked Out:</span>
                      <Badge variant="secondary">{reportsQuery.stats.data.stats.checkedOut}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Pending:</span>
                      <Badge variant="secondary">{reportsQuery.stats.data.stats.pending}</Badge>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-4">No booking stats available</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="secondary"
                  onClick={() => setCurrentView('builder')}
                >
                  Create Custom Report
                </Button>
                <Button
                  variant="secondary"
                  onClick={reportsQuery.refetchAll}
                  disabled={reportsQuery.isLoading}
                >
                  Refresh Data
                </Button>
                <Button
                  variant={autoRefresh ? 'primary' : 'secondary'}
                  onClick={() => setAutoRefresh(!autoRefresh)}
                >
                  {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
                </Button>
                <div className="flex items-center space-x-2">
                  <select
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value as 'csv' | 'excel' | 'pdf')}
                    className="px-3 py-1 border rounded-md text-sm"
                  >
                    <option value="csv">CSV</option>
                    <option value="excel">Excel</option>
                    <option value="pdf">PDF</option>
                  </select>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      exportMutation.mutate({
                        reportType: 'revenue',
                        filters: {
                          hotelId,
                          startDate: currentRange.startDate,
                          endDate: currentRange.endDate,
                          groupBy: 'day'
                        },
                        format: exportFormat
                      });
                    }}
                    disabled={exportMutation.isPending}
                  >
                    {exportMutation.isPending ? 'Exporting...' : 'Export Reports'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export default withErrorBoundary(AdminReports);

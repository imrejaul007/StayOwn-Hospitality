import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import {
  MetricCard,
  ChartCard,
  RefreshButton,
  LineChart,
} from '../../components/dashboard';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, Bed, TrendingUp, IndianRupee, ArrowRight } from 'lucide-react';
import { api } from '../../services/api';
import { formatCurrency, formatPercentage } from '../../utils/dashboardUtils';
import { withErrorBoundary } from '../../components/ErrorBoundary';

function PortfolioDashboard() {
  const navigate = useNavigate();
  const { properties, setSelectedPropertyId, setViewMode } = useProperty();

  // Fetch portfolio metrics
  const { data: metricsData, isLoading: metricsLoading, error: metricsError, refetch: refetchMetrics } = useQuery({
    queryKey: ['portfolio-metrics'],
    queryFn: async () => {
      const response = await api.get('/portfolio/metrics');
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch portfolio dashboard (trends + comparison in one call)
  const { data: dashboardData, isLoading: dashboardLoading, refetch: refetchDashboard } = useQuery({
    queryKey: ['portfolio-dashboard', '30d'],
    queryFn: async () => {
      const response = await api.get('/portfolio/dashboard', {
        params: { period: '30d' }
      });
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fill missing dates in trends so chart shows complete 30-day timeline
  const filledTrends = React.useMemo(() => {
    const raw = dashboardData?.trends || [];
    const dateMap = new Map(raw.map((t: { date: string; revenue: number; bookings: number }) => [t.date, t]));
    const result = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      result.push(dateMap.get(key) || { date: key, revenue: 0, bookings: 0 });
    }
    return result;
  }, [dashboardData?.trends]);

  const comparisonData = dashboardData?.propertyBreakdown;

  const handleRefresh = () => {
    refetchMetrics();
    refetchDashboard();
  };

  const handlePropertyClick = (propertyId: string) => {
    setSelectedPropertyId(propertyId);
    setViewMode('single');
    navigate('/admin/dashboard');
  };

  if (metricsError) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load portfolio</h3>
          <p className="text-gray-500 mb-4">{(metricsError as Error).message}</p>
          <Button onClick={handleRefresh}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 min-w-0">
      {/* Breadcrumb */}
      <PropertyBreadcrumb items={['Portfolio Dashboard']} />

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Portfolio Overview</h1>
          <p className="text-gray-600 mt-1">
            Aggregated metrics across {properties.length} {properties.length === 1 ? 'property' : 'properties'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => navigate('/admin/multi-property')}
            variant="outline"
            className="flex items-center space-x-2"
          >
            <Building2 className="h-4 w-4" />
            <span>Multi-Property Manager</span>
          </Button>
          <RefreshButton
            onRefresh={handleRefresh}
            loading={metricsLoading}
            autoRefresh={true}
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Properties"
          value={metricsData?.totalProperties || 0}
          icon={<Building2 className="h-6 w-6" />}
          color="blue"
          loading={metricsLoading}
        />
        <MetricCard
          title="Total Rooms"
          value={metricsData?.totalRooms || 0}
          icon={<Bed className="h-6 w-6" />}
          color="green"
          loading={metricsLoading}
        />
        <MetricCard
          title="Total Revenue"
          value={metricsData?.totalRevenue || 0}
          type="currency"
          icon={<IndianRupee className="h-6 w-6" />}
          color="purple"
          loading={metricsLoading}
        />
        <MetricCard
          title="Current Occupancy"
          value={metricsData?.avgOccupancy || 0}
          type="percentage"
          icon={<TrendingUp className="h-6 w-6" />}
          color="orange"
          loading={metricsLoading}
        />
      </div>

      {/* Revenue Trend Chart */}
      <ChartCard
        title="Revenue Trends (Last 30 Days)"
        subtitle="Aggregated revenue across all properties"
        loading={dashboardLoading}
        onRefresh={refetchDashboard}
        height="400px"
      >
        <LineChart
          data={filledTrends}
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
          height={350}
        />
      </ChartCard>

      {/* Property Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle>Property Performance Comparison</CardTitle>
          <CardDescription>Revenue and bookings by property</CardDescription>
        </CardHeader>
        <CardContent>
          {dashboardLoading ? (
            <div className="text-center py-8">Loading comparison...</div>
          ) : comparisonData && comparisonData.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Property</th>
                    <th className="text-left py-3 px-4">City</th>
                    <th className="text-right py-3 px-4">Bookings</th>
                    <th className="text-right py-3 px-4">Revenue</th>
                    <th className="text-right py-3 px-4">Occupancy</th>
                    <th className="text-right py-3 px-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonData.map((item: Record<string, unknown>) => (
                    <tr key={item.property.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{item.property.name}</td>
                      <td className="py-3 px-4 text-gray-600">{item.property.city}</td>
                      <td className="py-3 px-4 text-right">{item.metrics.bookings}</td>
                      <td className="py-3 px-4 text-right">{formatCurrency(item.metrics.revenue)}</td>
                      <td className="py-3 px-4 text-right">{formatPercentage(item.metrics.occupancy)}</td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handlePropertyClick(item.property.id)}
                        >
                          View <ArrowRight className="h-4 w-4 ml-1" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">No comparison data available</div>
          )}
        </CardContent>
      </Card>

      {/* Property Cards Grid */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Your Properties</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((property) => {
            // Enrich card with metrics from comparison data or portfolio metrics
            const comparison = comparisonData?.find(
              (c: Record<string, unknown>) => String(c.property?.id) === String(property._id)
            );
            const metricsProperty = metricsData?.properties?.find(
              (p: Record<string, unknown>) => String(p.id) === String(property._id)
            );
            const roomCount = metricsProperty?.totalRooms || property.totalRooms || 0;

            return (
              <Card
                key={property._id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => handlePropertyClick(property._id)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{property.name}</CardTitle>
                      <CardDescription>
                        {property.address?.city}{property.address?.state ? `, ${property.address.state}` : ''}
                      </CardDescription>
                    </div>
                    <Building2 className="h-5 w-5 text-blue-600" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total Rooms:</span>
                      <span className="font-medium">{roomCount}</span>
                    </div>
                    {comparison && (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Revenue (30d):</span>
                          <span className="font-medium">{formatCurrency(comparison.metrics?.revenue || 0)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Bookings (30d):</span>
                          <span className="font-medium">{comparison.metrics?.bookings || 0}</span>
                        </div>
                      </>
                    )}
                    {property.propertyGroupId && (
                      <div className="mt-2 inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                        Part of a group
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default withErrorBoundary(PortfolioDashboard);

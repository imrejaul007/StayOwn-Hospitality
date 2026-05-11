import React, { useState, useMemo } from 'react';
import { cn } from '../../../utils/cn';
import {
  MetricCard,
  ChartCard,
  DataTable,
  FilterBar,
  ExportButton,
  LineChart,
  BarChart,
  PieChart,
  AreaChart,
} from '../../../components/dashboard';
import { Button } from '@/components/ui/button';
import { useRevenueData } from '../../../hooks/useDashboard';
import { useProperty } from '../../../context/PropertyContext';
import { formatCurrency, formatPercentage, getDateRange } from '../../../utils/dashboardUtils';
import { withErrorBoundary } from '../../../components/ErrorBoundary';

function RevenueAnalytics() {
  const { selectedPropertyId, properties } = useProperty();

  const [filters, setFilters] = useState({
    hotelId: '',
    period: 'month',
    startDate: getDateRange('month').start,
    endDate: getDateRange('month').end,
    groupBy: 'day' as 'day' | 'week' | 'month',
    roomType: '',
    source: '',
  });

  // Use selected property from context, allow override via filter
  const activeHotelId = filters.hotelId || selectedPropertyId || '';

  const hotelOptions = useMemo(() =>
    properties.map((p) => ({ value: p._id, label: p.name })),
  [properties]);

  const revenueQuery = useRevenueData(
    activeHotelId,
    filters.period,
    filters.startDate,
    filters.endDate,
    filters.groupBy
  );

  const handleFilterChange = (key: string, value: unknown) => {
    setFilters(prev => {
      const updated = { ...prev, [key]: value };
      // When dates are changed manually, switch to custom period so backend uses them
      if (key === 'startDate' || key === 'endDate') {
        updated.period = 'custom';
      }
      return updated;
    });
  };

  const handleQuickPeriod = (period: 'today' | 'week' | 'month' | 'quarter' | 'year') => {
    const dateRange = getDateRange(period);
    setFilters(prev => ({
      ...prev,
      period,
      startDate: dateRange.start,
      endDate: dateRange.end,
    }));
  };

  const rawData = revenueQuery.data?.data;

  // Client-side filtering for roomType and source filters
  const data = useMemo(() => {
    if (!rawData) return undefined;
    return {
      ...rawData,
      byRoomType: filters.roomType
        ? rawData.byRoomType.filter(rt => rt.roomType === filters.roomType)
        : rawData.byRoomType,
      bySource: filters.source
        ? rawData.bySource.filter(s => s.source === filters.source)
        : rawData.bySource,
    };
  }, [rawData, filters.roomType, filters.source]);

  const noHotelSelected = !activeHotelId;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Revenue Analytics</h1>
          <p className="text-gray-600 mt-1">Detailed financial performance analysis</p>
        </div>
        <div className="flex items-center space-x-3">
          {!noHotelSelected && (
            <ExportButton
              endpoint="revenue"
              params={{
                hotelId: activeHotelId,
                startDate: filters.startDate,
                endDate: filters.endDate,
                groupBy: filters.groupBy,
              }}
              filename="revenue-analytics"
            />
          )}
          <Button
            onClick={() => revenueQuery.refetch()}
            loading={revenueQuery.isLoading}
            variant="secondary"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Quick Filters */}
      <div className="flex flex-wrap gap-2">
        {(['today', 'week', 'month', 'quarter', 'year'] as const).map((period) => (
          <Button
            key={period}
            variant={filters.period === period ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => handleQuickPeriod(period)}
          >
            {period.charAt(0).toUpperCase() + period.slice(1)}
          </Button>
        ))}
      </div>

      {/* Filters */}
      <FilterBar
        filters={[
          {
            key: 'hotelId',
            label: 'Hotel',
            type: 'select',
            placeholder: 'All Hotels',
            options: hotelOptions,
          },
          {
            key: 'startDate',
            label: 'Start Date',
            type: 'date',
          },
          {
            key: 'endDate',
            label: 'End Date',
            type: 'date',
          },
          {
            key: 'groupBy',
            label: 'Group By',
            type: 'select',
            options: [
              { value: 'day', label: 'Daily' },
              { value: 'week', label: 'Weekly' },
              { value: 'month', label: 'Monthly' },
            ],
          },
          {
            key: 'roomType',
            label: 'Room Type',
            type: 'select',
            placeholder: 'All Types',
            options: (rawData?.byRoomType || []).map(rt => ({
              value: rt.roomType,
              label: rt.roomType,
            })),
          },
          {
            key: 'source',
            label: 'Booking Source',
            type: 'select',
            placeholder: 'All Sources',
            options: (rawData?.bySource || []).map(s => ({
              value: s.source,
              label: s.source.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            })),
          },
        ]}
        values={filters}
        onChange={handleFilterChange}
      />

      {noHotelSelected && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
          <p className="text-blue-800 font-medium">Select a hotel to view revenue analytics</p>
          <p className="text-blue-600 text-sm mt-1">Choose a property from the Hotel filter above to load data.</p>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Revenue"
          value={data?.summary?.totalRevenue || 0}
          type="currency"
          trend={{
            value: data?.periodComparison?.changePercentage || 0,
            direction: (data?.periodComparison?.changePercentage || 0) > 0 ? 'up' : (data?.periodComparison?.changePercentage || 0) < 0 ? 'down' : 'neutral',
            label: 'vs previous period'
          }}
          color="green"
          loading={revenueQuery.isLoading}
        />

        <MetricCard
          title="Total Bookings"
          value={data?.summary?.totalBookings || 0}
          trend={{
            value: data?.summary?.bookingGrowth || 0,
            direction: (data?.summary?.bookingGrowth || 0) > 0 ? 'up' : (data?.summary?.bookingGrowth || 0) < 0 ? 'down' : 'neutral',
            label: 'booking growth'
          }}
          color="blue"
          loading={revenueQuery.isLoading}
        />

        <MetricCard
          title="Average Booking Value"
          value={data?.summary?.averageBookingValue || 0}
          type="currency"
          trend={{
            value: Math.abs(data?.periodComparison?.changePercentage || 0),
            direction: (data?.periodComparison?.changePercentage || 0) > 0 ? 'up' : (data?.periodComparison?.changePercentage || 0) < 0 ? 'down' : 'neutral',
            label: 'vs last period'
          }}
          color="purple"
          loading={revenueQuery.isLoading}
        />

        <MetricCard
          title="Revenue Growth"
          value={data?.summary?.revenueGrowth || 0}
          type="percentage"
          trend={{
            value: Math.abs(data?.summary?.revenueGrowth || 0),
            direction: (data?.summary?.revenueGrowth || 0) > 0 ? 'up' : (data?.summary?.revenueGrowth || 0) < 0 ? 'down' : 'neutral',
            label: 'growth rate'
          }}
          color={(data?.summary?.revenueGrowth || 0) >= 0 ? 'green' : 'red'}
          loading={revenueQuery.isLoading}
        />
      </div>

      {/* Period Comparison */}
      {data?.periodComparison && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Period Comparison</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <p className="text-sm text-gray-600">Current Period</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(data.periodComparison.current)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Previous Period</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(data.periodComparison.previous)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Change</p>
              <div className="flex items-center justify-center space-x-2">
                <p className={cn(
                  "text-2xl font-bold",
                  data.periodComparison.change > 0 ? "text-green-600" : data.periodComparison.change < 0 ? "text-red-600" : "text-gray-600"
                )}>
                  {data.periodComparison.change > 0 ? '+' : ''}{formatCurrency(data.periodComparison.change)}
                </p>
                {data.periodComparison.previous > 0 ? (
                  <p className={cn(
                    "text-sm",
                    data.periodComparison.changePercentage > 0 ? "text-green-600" : data.periodComparison.changePercentage < 0 ? "text-red-600" : "text-gray-600"
                  )}>
                    ({data.periodComparison.changePercentage > 0 ? '+' : ''}{formatPercentage(data.periodComparison.changePercentage)})
                  </p>
                ) : data.periodComparison.current > 0 ? (
                  <p className="text-sm text-green-600">(New)</p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trends */}
        <ChartCard
          title="Revenue Trends"
          subtitle={`${filters.groupBy.charAt(0).toUpperCase() + filters.groupBy.slice(1)}ly revenue over time`}
          loading={revenueQuery.isLoading}
          error={revenueQuery.error?.message}
          onRefresh={() => revenueQuery.refetch()}
          height="400px"
        >
          <LineChart
            data={data?.timeSeries || []}
            xDataKey="date"
            lines={[
              {
                dataKey: 'revenue',
                name: 'Revenue',
                color: '#10b981',
              },
              {
                dataKey: 'averageRate',
                name: 'Avg Rate',
                color: '#3b82f6',
              }
            ]}
            height={350}
          />
        </ChartCard>

        {/* Revenue Forecast */}
        <ChartCard
          title="Revenue Forecast"
          subtitle="Projected revenue for next periods"
          loading={revenueQuery.isLoading}
          height="400px"
        >
          <AreaChart
            data={data?.forecast || []}
            xDataKey="date"
            areas={[
              {
                dataKey: 'projectedRevenue',
                name: 'Projected Revenue',
                color: '#8b5cf6',
                fillOpacity: 0.3,
              }
            ]}
            height={350}
          />
        </ChartCard>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Source */}
        <ChartCard
          title="Revenue by Booking Source"
          subtitle="Revenue distribution by booking channels"
          loading={revenueQuery.isLoading}
          height="400px"
        >
          <PieChart
            data={data?.bySource?.map(item => ({
              name: item.source,
              value: item.amount,
              percentage: item.percentage,
            })) || []}
            height={350}
          />
        </ChartCard>

        {/* Revenue by Room Type */}
        <ChartCard
          title="Revenue by Room Type"
          subtitle="Performance comparison across room categories"
          loading={revenueQuery.isLoading}
          height="400px"
        >
          <BarChart
            data={data?.byRoomType || []}
            xDataKey="roomType"
            bars={[
              {
                dataKey: 'revenue',
                name: 'Revenue',
                color: '#3b82f6',
              },
              {
                dataKey: 'averageRate',
                name: 'Avg Rate',
                color: '#10b981',
              }
            ]}
            height={350}
          />
        </ChartCard>
      </div>

      {/* Payment Method Analysis */}
      <ChartCard
        title="Payment Method Analysis"
        subtitle="Revenue breakdown by payment method"
        loading={revenueQuery.isLoading}
        height="300px"
      >
        <BarChart
          data={data?.byPaymentStatus || []}
          xDataKey="status"
          bars={[
            {
              dataKey: 'amount',
              name: 'Amount',
              color: '#f59e0b',
            }
          ]}
          height={250}
        />
      </ChartCard>

      {/* Detailed Revenue Data Table */}
      <DataTable
        title="Revenue Details"
        data={data?.timeSeries || []}
        columns={[
          {
            key: 'date',
            header: 'Date',
            render: (value: string) => {
              // Handle week format "2026-W13" and month format "2026-03"
              if (typeof value === 'string' && value.includes('-W')) return value;
              const parsed = new Date(value);
              return isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
            },
            width: '120px',
          },
          {
            key: 'revenue',
            header: 'Revenue',
            render: (value) => formatCurrency(value),
            align: 'right' as const,
            sortable: true,
          },
          {
            key: 'bookings',
            header: 'Bookings',
            align: 'right' as const,
            sortable: true,
          },
          {
            key: 'averageRate',
            header: 'Avg Rate',
            render: (value) => formatCurrency(value),
            align: 'right' as const,
            sortable: true,
          },
        ]}
        loading={revenueQuery.isLoading}
        searchable={true}
        pagination={true}
        pageSize={15}
        actions={
          !noHotelSelected ? (
            <ExportButton
              endpoint="revenue"
              params={{
                hotelId: activeHotelId,
                startDate: filters.startDate,
                endDate: filters.endDate,
              }}
              formats={['csv', 'excel']}
              size="sm"
            />
          ) : undefined
        }
      />

      {/* Revenue by Source Table */}
      <DataTable
        title="Revenue by Booking Source"
        data={data?.bySource || []}
        columns={[
          {
            key: 'source',
            header: 'Source',
            width: '150px',
          },
          {
            key: 'amount',
            header: 'Revenue',
            render: (value) => formatCurrency(value),
            align: 'right' as const,
            sortable: true,
          },
          {
            key: 'percentage',
            header: 'Percentage',
            render: (value) => formatPercentage(value),
            align: 'right' as const,
            sortable: true,
          },
          {
            key: 'bookings',
            header: 'Bookings',
            align: 'right' as const,
            sortable: true,
          },
        ]}
        loading={revenueQuery.isLoading}
        searchable={false}
        pagination={false}
      />
    </div>
  );
}

export default withErrorBoundary(RevenueAnalytics);

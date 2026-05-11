import React, { useState } from 'react';
import { cn } from '../../../utils/cn';
import {
  MetricCard,
  ChartCard,
  DataTable,
  FilterBar,
  ExportButton,
  BarChart,
  DonutChart,
  HeatmapChart,
  RoomStatusGrid,
  ProgressBar,
} from '../../../components/dashboard';
import { StatusBadge } from '../../../components/dashboard/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useOccupancyData, useOperationsData } from '../../../hooks/useDashboard';
import { useProperty } from '../../../context/PropertyContext';
import { formatPercentage, calculateOccupancyRate } from '../../../utils/dashboardUtils';
import { withErrorBoundary } from '../../../components/ErrorBoundary';

function OccupancyAnalytics() {
  const { selectedPropertyId, properties } = useProperty();

  const [filters, setFilters] = useState({
    hotelId: '',
    floor: '',
    roomType: '',
    status: '',
  });

  const activeHotelId = filters.hotelId || selectedPropertyId || '';

  const occupancyQuery = useOccupancyData(
    activeHotelId,
    filters.floor,
    filters.roomType
  );

  const operationsQuery = useOperationsData(activeHotelId);

  const handleFilterChange = (key: string, value: unknown) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const data = occupancyQuery.data?.data;
  const operationsData = operationsQuery.data?.data;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Occupancy & Operations</h1>
          <p className="text-gray-600 mt-1">Room status, housekeeping, and maintenance analytics</p>
        </div>
        <div className="flex items-center space-x-3">
          <ExportButton
            endpoint="occupancy"
            params={{
              hotelId: activeHotelId,
              floor: filters.floor,
              roomType: filters.roomType,
            }}
            filename="occupancy-analytics"
          />
          <Button
            onClick={() => {
              occupancyQuery.refetch();
              operationsQuery.refetch();
            }}
            loading={occupancyQuery.isLoading || operationsQuery.isLoading}
            variant="secondary"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <FilterBar
        filters={[
          {
            key: 'hotelId',
            label: 'Hotel',
            type: 'select',
            options: [
              { value: '', label: 'All Hotels' },
              ...properties.map((p) => ({ value: p._id, label: p.name })),
            ],
          },
          {
            key: 'floor',
            label: 'Floor',
            type: 'select',
            options: [
              { value: '', label: 'All Floors' },
              { value: '1', label: 'Floor 1' },
              { value: '2', label: 'Floor 2' },
              { value: '3', label: 'Floor 3' },
              { value: '4', label: 'Floor 4' },
            ],
          },
          {
            key: 'roomType',
            label: 'Room Type',
            type: 'select',
            options: [
              { value: '', label: 'All Types' },
              { value: 'standard', label: 'Standard' },
              { value: 'deluxe', label: 'Deluxe' },
              { value: 'suite', label: 'Suite' },
            ],
          },
          {
            key: 'status',
            label: 'Room Status',
            type: 'select',
            options: [
              { value: '', label: 'All Status' },
              { value: 'occupied', label: 'Occupied' },
              { value: 'vacant_clean', label: 'Vacant Clean' },
              { value: 'vacant_dirty', label: 'Vacant Dirty' },
              { value: 'out_of_order', label: 'Out of Order' },
              { value: 'maintenance', label: 'Maintenance' },
            ],
          },
        ]}
        values={filters}
        onChange={handleFilterChange}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Overall Occupancy"
          value={data?.summary?.occupancyRate || 0}
          type="percentage"
          trend={{
            value: data?.summary?.occupancyTrend || 0,
            direction: (data?.summary?.occupancyTrend || 0) >= 0 ? 'up' : 'down',
            label: 'vs yesterday'
          }}
          color="blue"
          loading={occupancyQuery.isLoading}
        />

        <MetricCard
          title="Available Rooms"
          value={data?.summary?.availableRooms || 0}
          trend={{
            value: data?.summary?.availableRoomsTrend || 0,
            direction: (data?.summary?.availableRoomsTrend || 0) >= 0 ? 'up' : 'down',
            label: 'vs yesterday'
          }}
          color="green"
          loading={occupancyQuery.isLoading}
        />

        <MetricCard
          title="Out of Order"
          value={data?.summary?.outOfOrderRooms || 0}
          trend={{
            value: data?.summary?.outOfOrderTrend || 0,
            direction: (data?.summary?.outOfOrderTrend || 0) <= 0 ? 'down' : 'up',
            label: 'vs yesterday'
          }}
          color="red"
          loading={occupancyQuery.isLoading}
        />

        <MetricCard
          title="Average Rate"
          value={data?.summary?.averageRate || 0}
          type="currency"
          trend={{
            value: data?.summary?.averageRateTrend || 0,
            direction: (data?.summary?.averageRateTrend || 0) >= 0 ? 'up' : 'down',
            label: 'vs last week'
          }}
          color="purple"
          loading={occupancyQuery.isLoading}
        />
      </div>

      {/* Room Status Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Room Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Room Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {occupancyQuery.isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded mb-2"></div>
                    <div className="h-2 bg-gray-200 rounded"></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {[
                  { status: 'occupied', label: 'Occupied', count: data?.summary?.occupiedRooms || 0 },
                  { status: 'vacant_clean', label: 'Vacant Clean', count: data?.summary?.availableRooms || 0 },
                  { status: 'vacant_dirty', label: 'Vacant Dirty', count: data?.summary?.dirtyRooms || 0 },
                  { status: 'out_of_order', label: 'Out of Order', count: data?.summary?.outOfOrderRooms || 0 },
                  { status: 'maintenance', label: 'Maintenance', count: data?.summary?.maintenanceRooms || 0 },
                ].map((item) => {
                  const totalRooms = data?.summary?.totalRooms || 0;
                  const percentage = totalRooms > 0
                    ? (item.count / totalRooms) * 100
                    : 0;
                  
                  return (
                    <div key={item.status} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <StatusBadge status={item.status} size="sm" />
                        <span className="text-sm font-medium text-gray-900">
                          {item.count} ({formatPercentage(percentage)})
                        </span>
                      </div>
                      <ProgressBar
                        value={percentage}
                        size="sm"
                        color={
                          item.status === 'occupied' ? 'red' :
                          item.status === 'vacant_clean' ? 'green' :
                          item.status === 'vacant_dirty' ? 'yellow' :
                          item.status === 'out_of_order' ? 'gray' :
                          'orange'
                        }
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Floor-wise Occupancy */}
        <Card>
          <CardHeader>
            <CardTitle>Occupancy by Floor</CardTitle>
          </CardHeader>
          <CardContent>
            {occupancyQuery.isLoading ? (
              <div className="animate-pulse space-y-4">
                {Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className="h-6 bg-gray-200 rounded"></div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {data?.byFloor?.map((floor) => (
                  <div key={floor.floor} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">
                        Floor {floor.floor}
                      </span>
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900">
                          {formatPercentage(floor.occupancyRate)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {floor.occupiedRooms}/{floor.totalRooms}
                        </div>
                      </div>
                    </div>
                    <ProgressBar
                      value={floor.occupancyRate}
                      size="sm"
                      color="blue"
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Room Type Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Performance by Room Type</CardTitle>
          </CardHeader>
          <CardContent>
            {occupancyQuery.isLoading ? (
              <div className="animate-pulse space-y-4">
                {Array.from({ length: 3 }, (_, i) => (
                  <div key={i} className="h-16 bg-gray-200 rounded"></div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {data?.byRoomType?.map((roomType) => (
                  <div key={roomType.roomType} className="p-3 border border-gray-200 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm font-medium text-gray-900 capitalize">
                        {roomType.roomType}
                      </span>
                      <span className="text-sm font-bold text-blue-600">
                        {formatPercentage(roomType.occupancyRate)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                      <div>Occupied: {roomType.occupiedRooms}</div>
                      <div>Total: {roomType.totalRooms}</div>
                    </div>
                    <div className="mt-2">
                      <ProgressBar
                        value={roomType.occupancyRate}
                        size="sm"
                        color="blue"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Room Status Heatmap */}
      <ChartCard
        title="Room Status Heatmap"
        subtitle="Visual representation of all room statuses by floor"
        loading={occupancyQuery.isLoading}
        error={occupancyQuery.error?.message}
        onRefresh={() => occupancyQuery.refetch()}
        height="500px"
      >
        <RoomStatusGrid
          rooms={data?.roomDetails || []}
          onRoomClick={() => {}}
          groupByFloor={true}
        />
      </ChartCard>

      {/* Operations Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Housekeeping Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Housekeeping Status</CardTitle>
          </CardHeader>
          <CardContent>
            {operationsQuery.isLoading ? (
              <div className="animate-pulse space-y-4">
                <div className="h-8 bg-gray-200 rounded"></div>
                <div className="h-32 bg-gray-200 rounded"></div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {operationsData?.housekeeping.totalTasks || 0}
                    </div>
                    <div className="text-sm text-gray-600">Total Tasks</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      {operationsData?.housekeeping.completedTasks || 0}
                    </div>
                    <div className="text-sm text-gray-600">Completed</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-yellow-600">
                      {operationsData?.housekeeping.pendingTasks || 0}
                    </div>
                    <div className="text-sm text-gray-600">Pending</div>
                  </div>
                </div>

                {/* Progress Bar */}
                <ProgressBar
                  value={operationsData?.housekeeping.totalTasks 
                    ? (operationsData.housekeeping.completedTasks / operationsData.housekeeping.totalTasks) * 100
                    : 0}
                  size="lg"
                  color="green"
                  showPercentage={true}
                  label="Completion Rate"
                />

                {/* Status Breakdown */}
                <div className="space-y-2">
                  {operationsData?.housekeeping.byStatus?.map((status) => (
                    <div key={status.status} className="flex justify-between items-center text-sm">
                      <StatusBadge status={status.status} size="sm" />
                      <span className="font-medium">{status.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Maintenance Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Maintenance Status</CardTitle>
          </CardHeader>
          <CardContent>
            {operationsQuery.isLoading ? (
              <div className="animate-pulse space-y-4">
                <div className="h-8 bg-gray-200 rounded"></div>
                <div className="h-32 bg-gray-200 rounded"></div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {operationsData?.maintenance.totalTasks || 0}
                    </div>
                    <div className="text-sm text-gray-600">Total Tasks</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-600">
                      {operationsData?.maintenance.urgentTasks || 0}
                    </div>
                    <div className="text-sm text-gray-600">Urgent</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">
                      {operationsData?.maintenance.inProgressTasks || 0}
                    </div>
                    <div className="text-sm text-gray-600">In Progress</div>
                  </div>
                </div>

                {/* Priority Breakdown */}
                <div className="space-y-2">
                  {operationsData?.maintenance.byPriority?.map((priority) => (
                    <div key={priority.priority} className="flex justify-between items-center text-sm">
                      <span className="capitalize font-medium">{priority.priority}</span>
                      <span className="font-medium">{priority.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Room Table */}
      <DataTable
        title="Room Details"
        data={data?.roomDetails || []}
        columns={[
          {
            key: 'roomNumber',
            header: 'Room #',
            width: '100px',
            sortable: true,
          },
          {
            key: 'floor',
            header: 'Floor',
            width: '80px',
            align: 'center' as const,
            sortable: true,
          },
          {
            key: 'type',
            header: 'Type',
            width: '120px',
            render: (value) => (
              <span className="capitalize">{value}</span>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            render: (value) => <StatusBadge status={value} size="sm" />,
            width: '140px',
          },
          {
            key: 'housekeepingStatus',
            header: 'Housekeeping',
            render: (value) => <StatusBadge status={value} size="sm" />,
            width: '140px',
          },
          {
            key: 'maintenanceRequired',
            header: 'Maintenance',
            render: (value) => (
              <span className={cn(
                'px-2 py-1 text-xs font-medium rounded-full',
                value ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
              )}>
                {value ? 'Required' : 'None'}
              </span>
            ),
            width: '120px',
          },
          {
            key: 'currentBooking',
            header: 'Current Guest',
            render: (value) => value ? 'Occupied' : 'Vacant',
            width: '120px',
          },
        ]}
        loading={occupancyQuery.isLoading}
        searchable={true}
        pagination={true}
        pageSize={20}
        onRowClick={() => {}}
        actions={
          <ExportButton
            endpoint="occupancy"
            params={{
              hotelId: activeHotelId,
              detailed: 'true',
            }}
            formats={['csv', 'excel']}
            size="sm"
          />
        }
      />
    </div>
  );
}

export default withErrorBoundary(OccupancyAnalytics);

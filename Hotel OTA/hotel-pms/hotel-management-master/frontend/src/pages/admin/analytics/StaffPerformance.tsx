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
  LineChart,
  ProgressBar,
  CircularProgress,
} from '../../../components/dashboard';
import { StatusBadge } from '../../../components/dashboard/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useStaffPerformance } from '../../../hooks/useDashboard';
import { useProperty } from '../../../context/PropertyContext';
import { useAuth } from '../../../context/AuthContext';
import { formatPercentage, formatDuration } from '../../../utils/dashboardUtils';
import { withErrorBoundary } from '../../../components/ErrorBoundary';

function StaffPerformance() {
  const { selectedPropertyId, properties } = useProperty();
  const { user } = useAuth();

  // SECURITY: Staff performance analytics are sensitive HR data.
  // Only admin and manager roles may access this page.
  const ALLOWED_ROLES = ['admin', 'manager'];
  if (user && !ALLOWED_ROLES.includes(user.role)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-red-600 text-lg font-semibold mb-2">Access Denied</div>
          <p className="text-gray-600">Staff performance analytics are restricted to admin and manager roles.</p>
        </div>
      </div>
    );
  }

  const [filters, setFilters] = useState({
    hotelId: '',
    department: '',
    staffId: '',
    period: 'month',
  });

  const activeHotelId = filters.hotelId || selectedPropertyId || '';

  const staffQuery = useStaffPerformance(
    activeHotelId,
    filters.period,
    filters.department,
    filters.staffId
  );

  const handleFilterChange = (key: string, value: unknown) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const data = staffQuery.data?.data;

  // Guard: require a hotel to be selected before fetching
  if (!activeHotelId) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-gray-400 text-lg font-semibold mb-2">No Property Selected</div>
          <p className="text-gray-500">Please select a property to view staff performance data.</p>
        </div>
      </div>
    );
  }

  if (staffQuery.isError) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-red-600 text-lg font-semibold mb-2">Failed to load staff performance</div>
          <p className="text-gray-500 mb-4">There was an error fetching the data.</p>
          <Button onClick={() => staffQuery.refetch()} variant="secondary">Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Staff Performance</h1>
          <p className="text-gray-600 mt-1">Employee productivity and task management analytics</p>
        </div>
        <div className="flex items-center space-x-3">
          <ExportButton
            endpoint="staff-performance"
            params={{
              hotelId: activeHotelId,
              department: filters.department,
              period: filters.period,
            }}
            filename="staff-performance"
          />
          <Button
            onClick={() => staffQuery.refetch()}
            loading={staffQuery.isLoading}
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
            key: 'department',
            label: 'Department',
            type: 'select',
            options: [
              { value: '', label: 'All Departments' },
              { value: 'housekeeping', label: 'Housekeeping' },
              { value: 'maintenance', label: 'Maintenance' },
              { value: 'reception', label: 'Reception' },
              { value: 'food_beverage', label: 'Food & Beverage' },
            ],
          },
          {
            key: 'period',
            label: 'Period',
            type: 'select',
            options: [
              { value: 'week', label: 'This Week' },
              { value: 'month', label: 'This Month' },
              { value: 'quarter', label: 'This Quarter' },
            ],
          },
        ]}
        values={filters}
        onChange={handleFilterChange}
      />

      {/* Overview KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Staff"
          value={data?.overview?.totalStaff || 0}
          trend={{
            value: data?.overview?.newHires || 0,
            direction: (data?.overview?.newHires || 0) > 0 ? 'up' : 'neutral',
            label: 'new hires'
          }}
          color="blue"
          loading={staffQuery.isLoading}
        />

        <MetricCard
          title="Active Today"
          value={data?.overview?.activeToday || 0}
          trend={{
            value: data?.overview?.totalStaff
              ? Number(((data.overview.activeToday || 0) / data.overview.totalStaff * 100).toFixed(1))
              : 0,
            direction: 'neutral',
            label: 'attendance rate'
          }}
          color="green"
          loading={staffQuery.isLoading}
        />

        <MetricCard
          title="Tasks Completed"
          value={data?.overview?.completedTasksToday || 0}
          suffix={`/${data?.overview?.totalTasksToday || 0}`}
          trend={{
            value: data?.overview?.taskCompletionTrend || 0,
            direction: (data?.overview?.taskCompletionTrend || 0) >= 0 ? 'up' : 'down',
            label: 'vs yesterday'
          }}
          color="purple"
          loading={staffQuery.isLoading}
        />

        <MetricCard
          title="Performance Score"
          value={data?.overview?.averagePerformanceScore || 0}
          suffix="/100"
          trend={{
            value: data?.overview?.performanceTrend || 0,
            direction: (data?.overview?.performanceTrend || 0) >= 0 ? 'up' : 'down',
            label: 'vs last week'
          }}
          color="yellow"
          loading={staffQuery.isLoading}
        />
      </div>

      {/* Department Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Performance Chart */}
        <ChartCard
          title="Performance by Department"
          subtitle="Average performance scores by department"
          loading={staffQuery.isLoading}
          height="400px"
        >
          <BarChart
            data={data?.byDepartment || []}
            xDataKey="department"
            bars={[
              {
                dataKey: 'performanceScore',
                name: 'Performance Score',
                color: '#3b82f6',
              }
            ]}
            height={350}
          />
        </ChartCard>

        {/* Task Distribution */}
        <ChartCard
          title="Task Distribution"
          subtitle="Tasks breakdown by type"
          loading={staffQuery.isLoading}
          height="400px"
        >
          <DonutChart
            data={data?.taskDistribution?.map(item => {
              const totalAllTasks = data.taskDistribution.reduce((sum, t) => sum + t.total, 0);
              return {
                name: item.taskType,
                value: item.total,
                percentage: totalAllTasks > 0 ? (item.total / totalAllTasks) * 100 : 0
              };
            }) || []}
            height={350}
            centerContent={
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {data?.taskDistribution?.reduce((sum, item) => sum + item.total, 0) || 0}
                </div>
                <div className="text-sm text-gray-500">Total Tasks</div>
              </div>
            }
          />
        </ChartCard>
      </div>

      {/* Department Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data?.byDepartment?.map((dept) => (
          <Card key={dept.department}>
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <span className="capitalize">{dept.department}</span>
                <Badge variant="secondary">{dept.staffCount} staff</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Performance Score */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Performance Score</span>
                    <span className="text-sm font-medium">{dept.performanceScore}/100</span>
                  </div>
                  <ProgressBar
                    value={dept.performanceScore}
                    color={
                      dept.performanceScore >= 80 ? 'green' :
                      dept.performanceScore >= 60 ? 'yellow' :
                      'red'
                    }
                  />
                </div>

                {/* Task Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-lg font-bold text-gray-900">
                      {dept.tasks.completedTasks}
                    </div>
                    <div className="text-xs text-gray-600">Completed</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-gray-900">
                      {dept.tasks.pendingTasks}
                    </div>
                    <div className="text-xs text-gray-600">Pending</div>
                  </div>
                </div>

                {/* Completion Rate */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Task Completion</span>
                    <span className="text-sm font-medium">
                      {formatPercentage(dept.tasks.totalTasks > 0 ? (dept.tasks.completedTasks / dept.tasks.totalTasks) * 100 : 0)}
                    </span>
                  </div>
                  <ProgressBar
                    value={dept.tasks.totalTasks > 0 ? (dept.tasks.completedTasks / dept.tasks.totalTasks) * 100 : 0}
                    color="blue"
                    size="sm"
                  />
                </div>

                {/* Average Completion Time */}
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-lg font-bold text-gray-900">
                    {formatDuration(dept.tasks.averageCompletionTime)}
                  </div>
                  <div className="text-xs text-gray-600">Avg Completion Time</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Top Performers */}
      <Card>
        <CardHeader>
          <CardTitle>Top Performers</CardTitle>
        </CardHeader>
        <CardContent>
          {staffQuery.isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-24 bg-gray-200 rounded-lg"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data?.topPerformers?.slice(0, 6).map((performer, index) => (
                <div key={performer.staff._id} className="p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-medium text-gray-900">{performer.staff.name}</h4>
                      <p className="text-sm text-gray-600 capitalize">{performer.staff.department}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      {index < 3 && (
                        <div className={cn(
                          'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white',
                          index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-orange-400'
                        )}>
                          {index + 1}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Performance</span>
                      <span className="font-medium">{performer.performanceScore}/100</span>
                    </div>
                    <ProgressBar
                      value={performer.performanceScore}
                      size="sm"
                      color={
                        performer.performanceScore >= 90 ? 'green' :
                        performer.performanceScore >= 80 ? 'blue' :
                        'yellow'
                      }
                    />
                    
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 mt-3">
                      <div>Completed: {performer.tasks.completedTasks}</div>
                      <div>On Time: {performer.tasks.onTimeCompletion}%</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Task Performance Analysis */}
      <ChartCard
        title="Task Performance Over Time"
        subtitle="Daily task completion trends"
        loading={staffQuery.isLoading}
        height="400px"
      >
        {(data?.taskTrends && data.taskTrends.length > 0) ? (
          <LineChart
            data={data.taskTrends}
            xDataKey="date"
            lines={[
              {
                dataKey: 'completed',
                name: 'Completed Tasks',
                color: '#10b981',
              },
              {
                dataKey: 'pending',
                name: 'Pending Tasks',
                color: '#f59e0b',
              },
              {
                dataKey: 'total',
                name: 'Total Tasks',
                color: '#3b82f6',
              }
            ]}
            height={350}
          />
        ) : (
          <div className="flex items-center justify-center h-[350px] text-gray-500">
            No task performance data available yet
          </div>
        )}
      </ChartCard>

      {/* Detailed Staff Table */}
      <DataTable
        title="Staff Performance Details"
        data={data?.topPerformers || []}
        columns={[
          {
            key: 'staff',
            header: 'Staff Member',
            render: (_, row) => (
              <div>
                <div className="font-medium text-gray-900">{row.staff.name}</div>
                <div className="text-sm text-gray-600">{row.staff.email}</div>
              </div>
            ),
            width: '200px',
          },
          {
            key: 'staff',
            header: 'Department',
            render: (_, row) => (
              <span className="capitalize">{row.staff.department}</span>
            ),
            width: '120px',
          },
          {
            key: 'staff',
            header: 'Role',
            render: (_, row) => (
              <span className="capitalize">{row.staff.role}</span>
            ),
            width: '120px',
          },
          {
            key: 'performanceScore',
            header: 'Performance',
            render: (value) => (
              <div className="flex items-center space-x-2">
                <CircularProgress
                  value={value}
                  size={32}
                  strokeWidth={3}
                  showLabel={false}
                  color={
                    value >= 90 ? '#10b981' :
                    value >= 80 ? '#3b82f6' :
                    value >= 70 ? '#f59e0b' :
                    '#ef4444'
                  }
                />
                <span className="font-medium">{value}/100</span>
              </div>
            ),
            width: '120px',
            align: 'center' as const,
          },
          {
            key: 'tasks',
            header: 'Completed',
            render: (_, row) => row.tasks.completedTasks,
            align: 'center' as const,
            width: '100px',
          },
          {
            key: 'tasks',
            header: 'Pending',
            render: (_, row) => row.tasks.pendingTasks,
            align: 'center' as const,
            width: '100px',
          },
          {
            key: 'tasks',
            header: 'On Time %',
            render: (_, row) => formatPercentage(row.tasks.onTimeCompletion),
            align: 'center' as const,
            width: '100px',
          },
          {
            key: 'tasks',
            header: 'Avg Time',
            render: (_, row) => formatDuration(row.tasks.averageCompletionTime),
            align: 'center' as const,
            width: '100px',
          },
        ]}
        loading={staffQuery.isLoading}
        searchable={true}
        pagination={true}
        pageSize={15}
        actions={
          <ExportButton
            endpoint="staff-performance"
            params={{
              hotelId: activeHotelId,
              department: filters.department,
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

export default withErrorBoundary(StaffPerformance);

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  ClipboardList,
  AlertTriangle,
  RefreshCw,
  CheckCircle,
  Clock,
  Wrench,
  Bed,
  Info,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { api } from '../../services/api';
import { withErrorBoundary } from '../../components/ErrorBoundary';

interface TodayOverview {
  todayCheckIns: number;
  todayCheckOuts: number;
  pendingHousekeeping: number;
  activeMaintenanceRequests: number;
  occupiedRooms: number;
  availableRooms: number;
  pendingGuestServices: number;
}

const fetchTodayOverview = async (): Promise<TodayOverview> => {
  const { data } = await api.get('/staff-dashboard/today');
  return data.data || data;
};

interface StaffTask {
  _id: string;
  title: string;
  description?: string;
  taskType: string;
  status: string;
  priority: string;
  assignedTo?: {
    _id: string;
    name: string;
  };
  dueDate?: string;
  createdAt: string;
}

const fetchMyTasks = async (page = 1, limit = 20): Promise<{ tasks: StaffTask[] }> => {
  const skip = (page - 1) * limit;
  const { data } = await api.get(`/staff-tasks/my-tasks?limit=${limit}&skip=${skip}`);
  return data.data || { tasks: [] };
};

function FrontDeskStaffManagement() {
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: overview,
    isLoading: overviewLoading,
    error: overviewError,
    refetch: refetchOverview,
  } = useQuery({
    queryKey: ['frontdesk-staff-overview'],
    queryFn: fetchTodayOverview,
    refetchInterval: 60000,
  });

  const {
    data: tasksData,
    isLoading: tasksLoading,
    error: tasksError,
    refetch: refetchTasks,
  } = useQuery({
    queryKey: ['frontdesk-my-tasks'],
    queryFn: () => fetchMyTasks(1, 20),
  });

  const handleRefresh = () => {
    setRefreshing(true);
    Promise.all([refetchOverview(), refetchTasks()]).finally(() =>
      setTimeout(() => setRefreshing(false), 500)
    );
  };

  const tasks = tasksData?.tasks || [];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'in_progress':
        return <Clock className="w-4 h-4 text-blue-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  if (overviewLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  if (overviewError) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load staff overview</h3>
        <p className="text-gray-500 mb-4">There was an error loading the staff coordination data.</p>
        <Button onClick={() => refetchOverview()}>Try Again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff Coordination</h1>
          <p className="text-gray-600">View today's operational status and your assigned tasks</p>
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
            <strong>Front Desk Access:</strong> You can view today's operational status and your assigned tasks.
            Staff account management (creating, editing, deactivating accounts) is restricted to administrators.
          </span>
        </p>
      </div>

      {/* Today's Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Today's Check-ins</p>
                <p className="text-2xl font-bold text-gray-900">{overview?.todayCheckIns ?? 0}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500 opacity-70" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Today's Check-outs</p>
                <p className="text-2xl font-bold text-gray-900">{overview?.todayCheckOuts ?? 0}</p>
              </div>
              <Users className="w-8 h-8 text-green-500 opacity-70" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Pending Housekeeping</p>
                <p className="text-2xl font-bold text-gray-900">{overview?.pendingHousekeeping ?? 0}</p>
              </div>
              <Bed className="w-8 h-8 text-yellow-500 opacity-70" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Maintenance Requests</p>
                <p className="text-2xl font-bold text-gray-900">{overview?.activeMaintenanceRequests ?? 0}</p>
              </div>
              <Wrench className="w-8 h-8 text-red-500 opacity-70" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Room Availability Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bed className="w-5 h-5" />
            Room Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-green-50 rounded-lg p-4 text-center">
              <p className="text-sm text-green-600 font-medium">Available</p>
              <p className="text-3xl font-bold text-green-800">{overview?.availableRooms ?? 0}</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <p className="text-sm text-blue-600 font-medium">Occupied</p>
              <p className="text-3xl font-bold text-blue-800">{overview?.occupiedRooms ?? 0}</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-4 text-center">
              <p className="text-sm text-amber-600 font-medium">Pending Guest Services</p>
              <p className="text-3xl font-bold text-amber-800">{overview?.pendingGuestServices ?? 0}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* My Tasks */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardList className="w-5 h-5" />
            My Assigned Tasks
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tasksLoading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner size="medium" />
            </div>
          ) : tasksError ? (
            <div className="text-center py-8">
              <AlertTriangle className="mx-auto h-8 w-8 text-red-500 mb-2" />
              <p className="text-sm text-gray-500">Failed to load tasks</p>
              <Button variant="outline" size="sm" onClick={() => refetchTasks()} className="mt-2">
                Retry
              </Button>
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="mx-auto h-8 w-8 text-green-400 mb-2" />
              <p className="text-sm text-gray-500">No tasks assigned to you right now</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <div
                  key={task._id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(task.status)}
                    <div>
                      <p className="text-sm font-medium text-gray-900">{task.title}</p>
                      {task.description && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{task.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={cn('text-xs', getPriorityColor(task.priority))}>
                      {task.priority}
                    </Badge>
                    <Badge
                      variant={task.status === 'completed' ? 'success' : 'secondary'}
                      className="text-xs"
                    >
                      {task.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default withErrorBoundary(FrontDeskStaffManagement);

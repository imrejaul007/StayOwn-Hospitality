import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import {
  ClipboardCheck,
  Clock,
  CheckCircle,
  AlertTriangle,
  Play,
  RefreshCw,
  Calendar,
  CheckSquare,
  Wifi,
  WifiOff,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  Eye
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useAuth } from '../../context/AuthContext';
import {
  housekeepingService,
  HousekeepingTask,
  HousekeepingListResponse
} from '../../services/housekeepingService';
import { useRealTime } from '../../services/realTimeService';
import { toast } from 'react-hot-toast';
import { withErrorBoundary } from '../../components/ErrorBoundary';

const PAGE_LIMIT = 20;

function FrontDeskHousekeeping() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<HousekeepingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [taskTypeFilter, setTaskTypeFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Inspection modal state
  const [inspectingTask, setInspectingTask] = useState<HousekeepingTask | null>(null);
  const [inspectionNotes, setInspectionNotes] = useState('');
  const [inspectionRating, setInspectionRating] = useState(5);
  const [submitting, setSubmitting] = useState(false);

  // Stats
  const [stats, setStats] = useState<Array<{ _id: string; count: number; avgDuration: number | null }>>([]);

  const { connect, on, off, isConnected } = useRealTime();

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data: HousekeepingListResponse = await housekeepingService.getTasksFiltered({
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        taskType: taskTypeFilter || undefined,
        search: searchTerm || undefined,
        page,
        limit: PAGE_LIMIT
      });
      setTasks(data.data.tasks || []);
      setTotalPages(data.pagination?.pages ?? 1);
      setTotalCount(data.pagination?.total ?? 0);
    } catch {
      setError('Unable to load housekeeping tasks. Please check your connection.');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, priorityFilter, taskTypeFilter, searchTerm]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await housekeepingService.getStats();
      setStats(res.data?.stats || []);
    } catch {
      // Non-critical; stats are supplementary
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Real-time
  useEffect(() => {
    connect().catch(() => {});
  }, [connect]);

  useEffect(() => {
    if (!isConnected) return;
    const refresh = () => {
      fetchTasks();
      fetchStats();
    };
    on('housekeeping:task_created', refresh);
    on('housekeeping:task_assigned', refresh);
    on('housekeeping:task_updated', refresh);
    on('housekeeping:status_changed', refresh);
    return () => {
      off('housekeeping:task_created', refresh);
      off('housekeeping:task_assigned', refresh);
      off('housekeeping:task_updated', refresh);
      off('housekeeping:status_changed', refresh);
    };
  }, [isConnected, on, off, fetchTasks, fetchStats]);

  const handleInspect = async (passed: boolean) => {
    if (!inspectingTask) return;
    try {
      setSubmitting(true);
      await housekeepingService.inspectTask(inspectingTask._id, {
        passed,
        rating: inspectionRating,
        notes: inspectionNotes
      });
      toast.success(passed ? 'Inspection passed - room marked clean!' : 'Inspection failed - task reassigned for re-cleaning.');
      setInspectingTask(null);
      setInspectionNotes('');
      setInspectionRating(5);
      fetchTasks();
      fetchStats();
    } catch {
      toast.error('Failed to submit inspection. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatCount = (status: string) => {
    const stat = stats.find(s => s._id === status);
    return stat?.count ?? 0;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge className="bg-gray-100 text-gray-800">Pending</Badge>;
      case 'assigned': return <Badge className="bg-blue-100 text-blue-800">Assigned</Badge>;
      case 'in_progress': return <Badge className="bg-yellow-100 text-yellow-800">In Progress</Badge>;
      case 'completed': return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case 'inspected': return <Badge className="bg-purple-100 text-purple-800">Inspected</Badge>;
      case 'cancelled': return <Badge className="bg-red-100 text-red-800">Cancelled</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const getTaskTypeIcon = (taskType: string) => {
    switch (taskType) {
      case 'cleaning': return <ClipboardCheck className="w-4 h-4" />;
      case 'maintenance': return <AlertTriangle className="w-4 h-4" />;
      case 'inspection': return <CheckSquare className="w-4 h-4" />;
      default: return <ClipboardCheck className="w-4 h-4" />;
    }
  };

  const getAssigneeName = (task: HousekeepingTask): string => {
    const assignee = task.assignedToUserId || task.assignedTo;
    if (!assignee) return 'Unassigned';
    if (typeof assignee === 'string') return assignee;
    return assignee.name || 'Unknown';
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  };

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, priorityFilter, taskTypeFilter, searchTerm]);

  if (loading && tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (error && tasks.length === 0) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="text-center py-12">
          <AlertTriangle className="mx-auto h-8 w-8 text-red-500 mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Unable to Load Tasks</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={fetchTasks} className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Housekeeping Overview</h1>
          <p className="text-gray-600">Monitor and inspect all housekeeping tasks across the hotel</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className={`flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {isConnected ? (
              <><Wifi className="w-3 h-3 mr-1" /> Live</>
            ) : (
              <><WifiOff className="w-3 h-3 mr-1" /> Offline</>
            )}
          </div>
          <Button onClick={() => { fetchTasks(); fetchStats(); }} variant="secondary" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Total</p>
              <p className="text-lg font-semibold text-gray-900">{totalCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="text-lg font-semibold text-gray-900">{getStatCount('pending') + getStatCount('assigned')}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Play className="w-5 h-5 text-yellow-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">In Progress</p>
              <p className="text-lg font-semibold text-gray-900">{getStatCount('in_progress')}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-lg font-semibold text-gray-900">{getStatCount('completed')}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <CheckSquare className="w-5 h-5 text-purple-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Inspected</p>
              <p className="text-lg font-semibold text-gray-900">{getStatCount('inspected')}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Filters:</span>
            </div>
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 px-3 rounded-md border border-gray-200 text-sm"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="inspected">Inspected</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="h-9 px-3 rounded-md border border-gray-200 text-sm"
            >
              <option value="">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select
              value={taskTypeFilter}
              onChange={(e) => setTaskTypeFilter(e.target.value)}
              className="h-9 px-3 rounded-md border border-gray-200 text-sm"
            >
              <option value="">All Types</option>
              <option value="cleaning">Cleaning</option>
              <option value="deep_clean">Deep Clean</option>
              <option value="checkout_clean">Checkout Clean</option>
              <option value="inspection">Inspection</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Task Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <ClipboardCheck className="h-5 w-5 mr-2 text-blue-600" />
            Housekeeping Tasks ({totalCount})
            {loading && <RefreshCw className="w-4 h-4 ml-2 animate-spin text-gray-400" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No tasks match the current filters.</p>
          ) : (
            <div className="space-y-3">
              {tasks.map(task => (
                <div
                  key={task._id}
                  className={`p-4 rounded-lg border ${getPriorityColor(task.priority)} flex items-center justify-between`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getTaskTypeIcon(task.taskType)}
                      <span className="font-medium">{task.roomId?.roomNumber || 'No Room'}</span>
                      {getStatusBadge(task.status)}
                      <Badge variant="secondary" className="text-xs">
                        {task.taskType ? task.taskType.replace('_', ' ') : 'Unknown'}
                      </Badge>
                      <Badge variant="secondary" className="text-xs capitalize">
                        {task.priority}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-700 mb-1">{task.title || 'Untitled Task'}</p>
                    <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                      <span>Assigned: {getAssigneeName(task)}</span>
                      {task.estimatedDuration != null && (
                        <span className="flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {task.estimatedDuration} min
                        </span>
                      )}
                      {task.startedAt && (
                        <span>Started: {new Date(task.startedAt).toLocaleTimeString()}</span>
                      )}
                      {task.completedAt && (
                        <span>Completed: {new Date(task.completedAt).toLocaleTimeString()}</span>
                      )}
                      {task.actualDuration != null && (
                        <span>Duration: {task.actualDuration} min</span>
                      )}
                    </div>
                  </div>

                  {/* Inspect button for completed tasks */}
                  {task.status === 'completed' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setInspectingTask(task);
                        setInspectionNotes('');
                        setInspectionRating(5);
                      }}
                      className="ml-4 text-purple-600 border-purple-300 hover:bg-purple-50"
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      Inspect
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-6 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1 || loading}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
              <span className="text-sm text-gray-600">
                Page {page} of {totalPages} ({totalCount} total)
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages || loading}
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Inspection Modal */}
      {inspectingTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <h2 className="text-xl font-semibold mb-4">Inspect Task</h2>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-1">
                Room: <strong>{inspectingTask.roomId?.roomNumber || 'N/A'}</strong>
              </p>
              <p className="text-sm text-gray-600 mb-1">
                Task: <strong>{inspectingTask.title || 'Untitled'}</strong>
              </p>
              <p className="text-sm text-gray-600">
                Assigned to: <strong>{getAssigneeName(inspectingTask)}</strong>
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Rating (1-5)</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(r => (
                  <button
                    key={r}
                    onClick={() => setInspectionRating(r)}
                    className={`w-10 h-10 rounded-lg border-2 font-medium text-sm transition-colors ${
                      inspectionRating >= r
                        ? 'bg-yellow-400 border-yellow-500 text-white'
                        : 'bg-gray-100 border-gray-200 text-gray-500'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={inspectionNotes}
                onChange={(e) => setInspectionNotes(e.target.value)}
                className="w-full border border-gray-200 rounded-md p-2 text-sm h-20 resize-none"
                placeholder="Optional notes about the inspection..."
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setInspectingTask(null)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={() => handleInspect(false)}
                disabled={submitting}
                className="text-red-600 border-red-300 hover:bg-red-50"
              >
                {submitting ? 'Submitting...' : 'Fail'}
              </Button>
              <Button
                onClick={() => handleInspect(true)}
                disabled={submitting}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {submitting ? 'Submitting...' : 'Pass'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default withErrorBoundary(FrontDeskHousekeeping);

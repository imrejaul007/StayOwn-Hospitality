import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { TaskCompletionModal, getDefaultSteps } from '../../components/staff/TaskCompletionModal';
import InventoryConsumptionForm from '../../components/staff/InventoryConsumptionForm';
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
  Package,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { housekeepingService, HousekeepingTask, HousekeepingTaskStatus } from '../../services/housekeepingService';
import { useRealTime } from '../../services/realTimeService';
import { toast } from 'react-hot-toast';
import { withErrorBoundary } from '../../components/ErrorBoundary';

const PAGE_LIMIT = 20;

function StaffHousekeeping() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<HousekeepingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [selectedTask, setSelectedTask] = useState<HousekeepingTask | null>(null);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [inventoryTaskId, setInventoryTaskId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Real-time connection
  const { connect, on, off, isConnected } = useRealTime();

  // Stable refs so real-time handlers always use current values without
  // causing the listener effect to re-register on every page/user change.
  const userIdRef = useRef<string | undefined>(undefined);
  const pageRef = useRef(1);
  const fetchTasksRef = useRef<((userId?: string, p?: number) => Promise<void>) | null>(null);

  const fetchTasks = useCallback(async (assignedToUserId?: string, currentPage = 1) => {
    if (!assignedToUserId) {
      // No user context yet — clear state but don't enter loading limbo
      setTasks([]);
      setTotalPages(1);
      setTotalCount(0);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await housekeepingService.getTasks(assignedToUserId, currentPage, PAGE_LIMIT);
      setTasks(data.data.tasks || []);
      setTotalPages(data.pagination?.pages ?? 1);
      setTotalCount(data.pagination?.total ?? 0);
    } catch {
      setError('Unable to connect to server. Please check your internet connection.');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Keep refs in sync with current state so real-time handlers always use current values
  useEffect(() => { userIdRef.current = user?._id; }, [user?._id]);
  useEffect(() => { pageRef.current = page; }, [page]);
  useEffect(() => { fetchTasksRef.current = fetchTasks; }, [fetchTasks]);

  useEffect(() => {
    if (!user?._id) return;
    fetchTasks(user._id, page);
  }, [user?._id, page, fetchTasks]);

  // Real-time connection setup
  // Do NOT disconnect on unmount — realTimeService is a singleton shared across components
  useEffect(() => {
    connect().catch(() => { /* WebSocket unavailable */ });
  }, [connect]);

  // Set up real-time event listeners.
  // Uses refs for userId/page/fetchTasks so this effect only re-registers when the
  // socket connection state changes — NOT on every page navigation.
  useEffect(() => {
    if (!isConnected) return;

    // Helper: extract scalar user ID from a potentially-populated field
    const extractUserId = (field: unknown): string | undefined => {
      if (!field) return undefined;
      if (typeof field === 'string') return field;
      if (typeof field === 'object') {
        const obj = field as Record<string, unknown>;
        if (obj._id) return String(obj._id);
      }
      return undefined;
    };

    const handleTaskAssigned = (eventData: Record<string, unknown>) => {
      const currentUserId = userIdRef.current;
      if (!currentUserId) return;
      const task = (eventData.task as Record<string, unknown> | undefined) ?? eventData;
      const assignedId =
        extractUserId(task.assignedToUserId) ??
        extractUserId(task.assignedTo) ??
        extractUserId(eventData.assignedToUserId);
      if (assignedId === currentUserId) {
        fetchTasksRef.current?.(currentUserId, pageRef.current);
        toast.success(`New housekeeping task assigned: ${String(task.title || 'Task')}!`);
      }
    };

    const handleTaskUpdate = (eventData: Record<string, unknown>) => {
      const currentUserId = userIdRef.current;
      if (!currentUserId) return;
      const task = (eventData.task as Record<string, unknown> | undefined) ?? eventData;
      const assignedId =
        extractUserId(task.assignedToUserId) ??
        extractUserId(task.assignedTo) ??
        extractUserId(eventData.assignedToUserId);
      if (assignedId === currentUserId) {
        fetchTasksRef.current?.(currentUserId, pageRef.current);
        if (task.status === 'cancelled') {
          toast.error(`Task cancelled: ${String(task.title || 'Task')}`);
        } else {
          toast.success(`Task updated: ${String(task.title || 'Task')}`);
        }
      }
    };

    on('housekeeping:task_assigned', handleTaskAssigned);
    on('housekeeping:task_updated', handleTaskUpdate);
    on('housekeeping:status_changed', handleTaskUpdate);

    return () => {
      off('housekeeping:task_assigned', handleTaskAssigned);
      off('housekeeping:task_updated', handleTaskUpdate);
      off('housekeeping:status_changed', handleTaskUpdate);
    };
  }, [isConnected, on, off]); // stable — does NOT re-register on page/user changes

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      setUpdating(true);
      await housekeepingService.updateTaskStatus(taskId, newStatus as HousekeepingTaskStatus);
      await fetchTasks(user?._id, page);
      toast.success(`Task ${newStatus === 'in_progress' ? 'started' : 'updated'} successfully`);
    } catch {
      toast.error('Failed to update task status. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  const handleCompleteClick = (task: HousekeepingTask) => {
    setSelectedTask(task);
    setShowCompletionModal(true);
  };

  const handleCompleteTask = async (completedSteps: string[]) => {
    if (!selectedTask) return;

    try {
      setUpdating(true);
      await housekeepingService.completeTask(selectedTask._id, {
        status: 'completed',
        notes: completedSteps.length > 0 ? `Completed steps: ${completedSteps.join(', ')}` : 'Task completed'
      });
      await fetchTasks(user?._id, page);
      setShowCompletionModal(false);
      setSelectedTask(null);
      toast.success('Task completed successfully!');
    } catch {
      toast.error('Failed to complete task. Please try again.');
    } finally {
      setUpdating(false);
    }
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

  const getTaskTypeIcon = (taskType: string) => {
    switch (taskType) {
      case 'cleaning': return <ClipboardCheck className="w-4 h-4" />;
      case 'maintenance': return <AlertTriangle className="w-4 h-4" />;
      case 'inspection': return <CheckSquare className="w-4 h-4" />;
      default: return <ClipboardCheck className="w-4 h-4" />;
    }
  };

  const pendingTasks = tasks.filter(t => t.status === 'assigned' || t.status === 'pending');
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
  const completedTasks = tasks.filter(t => t.status === 'completed' || t.status === 'inspected');

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="text-center py-12">
          <AlertTriangle className="mx-auto h-8 w-8 text-red-500 mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Unable to Load Tasks</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={() => fetchTasks(user?._id, page)} className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Housekeeping Tasks</h1>
          <p className="text-gray-600">Manage your assigned room cleaning and maintenance tasks</p>
        </div>
        <div className="flex items-center space-x-3">
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
          <Button onClick={() => fetchTasks(user?._id, page)} variant="secondary" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Total Tasks</p>
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
              <p className="text-sm font-medium text-gray-600">Pending (this page)</p>
              <p className="text-lg font-semibold text-gray-900">{pendingTasks.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Play className="w-5 h-5 text-yellow-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">In Progress (this page)</p>
              <p className="text-lg font-semibold text-gray-900">{inProgressTasks.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Completed (this page)</p>
              <p className="text-lg font-semibold text-gray-900">{completedTasks.length}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Pending Tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Clock className="h-5 w-5 mr-2 text-orange-600" />
              Pending Tasks ({pendingTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingTasks.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No pending tasks</p>
              ) : (
                pendingTasks.map(task => (
                  <div key={task._id} className={`p-3 rounded-lg border ${getPriorityColor(task.priority)}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          {getTaskTypeIcon(task.taskType)}
                          <p className="font-medium ml-2">{task.roomId?.roomNumber || 'No Room'}</p>
                          <Badge variant="secondary" className="ml-2 text-xs">
                            {task.taskType ? task.taskType.replace('_', ' ') : 'Unknown'}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{task.title || 'Untitled Task'}</p>
                        <div className="flex items-center text-xs text-gray-500">
                          <Clock className="w-3 h-3 mr-1" />
                          <span>{task.estimatedDuration != null ? `${task.estimatedDuration} min` : 'N/A'}</span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); updateTaskStatus(task._id, 'in_progress'); }}
                        disabled={updating}
                      >
                        <Play className="w-3 h-3 mr-1" />
                        Start
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* In Progress Tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Play className="h-5 w-5 mr-2 text-yellow-600" />
              In Progress ({inProgressTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {inProgressTasks.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No tasks in progress</p>
              ) : (
                inProgressTasks.map(task => (
                  <div key={task._id} className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          {getTaskTypeIcon(task.taskType)}
                          <p className="font-medium ml-2">{task.roomId?.roomNumber || 'No Room'}</p>
                          <Badge variant="secondary" className="ml-2 text-xs">
                            {task.taskType ? task.taskType.replace('_', ' ') : 'Unknown'}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{task.title || 'Untitled Task'}</p>
                        <div className="flex items-center text-xs text-gray-500">
                          <Clock className="w-3 h-3 mr-1" />
                          <span>{task.startedAt ? `Started ${new Date(task.startedAt).toLocaleTimeString()}` : 'In progress'}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setInventoryTaskId(task._id);
                            setShowInventoryModal(true);
                          }}
                          disabled={updating}
                          className="text-blue-600 border-blue-600 hover:bg-blue-50"
                        >
                          <Package className="w-3 h-3 mr-1" />
                          Log Items
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleCompleteClick(task)}
                          disabled={updating}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Complete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Completed Tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CheckCircle className="h-5 w-5 mr-2 text-green-600" />
              Completed ({completedTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {completedTasks.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No completed tasks</p>
              ) : (
                completedTasks.map(task => (
                  <div key={task._id} className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center mb-2">
                          {getTaskTypeIcon(task.taskType)}
                          <p className="font-medium ml-2">{task.roomId?.roomNumber || 'No Room'}</p>
                          <Badge variant="secondary" className="ml-2 text-xs">
                            {task.taskType ? task.taskType.replace('_', ' ') : 'Unknown'}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{task.title || 'Untitled Task'}</p>
                        <div className="flex items-center text-xs text-gray-500">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          <span>
                            {task.completedAt
                              ? `Completed ${new Date(task.completedAt).toLocaleTimeString()}`
                              : 'Completed'}
                            {task.actualDuration != null && ` (${task.actualDuration} min)`}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-6">
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
            Page {page} of {totalPages} ({totalCount} total tasks)
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

      {/* Task Completion Modal */}
      {selectedTask && (
        <TaskCompletionModal
          isOpen={showCompletionModal}
          onClose={() => {
            setShowCompletionModal(false);
            setSelectedTask(null);
          }}
          onComplete={handleCompleteTask}
          title="Complete Housekeeping Task"
          taskName={`${selectedTask.roomId?.roomNumber ? `${selectedTask.roomId.roomNumber} - ` : ''}${selectedTask.title || 'Task'}`}
          steps={getDefaultSteps('housekeeping', selectedTask.taskType)}
          loading={updating}
        />
      )}

      {/* Inventory Consumption Modal */}
      {showInventoryModal && inventoryTaskId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Log Inventory Consumption</h2>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowInventoryModal(false);
                    setInventoryTaskId(null);
                  }}
                >
                  Close
                </Button>
              </div>

              <InventoryConsumptionForm
                mode="housekeeping"
                taskId={inventoryTaskId}
                roomId={tasks.find(t => t._id === inventoryTaskId)?.roomId?._id}
                onSuccess={() => {
                  setShowInventoryModal(false);
                  setInventoryTaskId(null);
                  toast.success('Inventory consumption logged successfully!');
                  fetchTasks(user?._id, page);
                }}
                onCancel={() => {
                  setShowInventoryModal(false);
                  setInventoryTaskId(null);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default withErrorBoundary(StaffHousekeeping);

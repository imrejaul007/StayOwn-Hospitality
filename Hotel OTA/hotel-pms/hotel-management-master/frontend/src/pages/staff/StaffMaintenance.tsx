import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wrench, Clock, CheckCircle, AlertTriangle, RefreshCw, User, Calendar, Flag, ChevronLeft, ChevronRight, Wifi, WifiOff } from 'lucide-react';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { TaskCompletionModal, getDefaultSteps } from '../../components/staff/TaskCompletionModal';
import { maintenanceService, MaintenanceTask, GroupedTasks } from '../../services/maintenanceService';
import { useRealTime } from '../../services/realTimeService';
import { toast } from 'react-hot-toast';
import { withErrorBoundary } from '../../components/ErrorBoundary';

function getApiErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    const response = e.response as Record<string, unknown> | undefined;
    if (response?.status === 401) return 'Authentication failed. Please login again.';
    if (response?.status === 403) return 'You do not have permission to perform this action.';
    if (response?.status === 404) return 'Task not found. It may have been deleted.';
    const data = response?.data as Record<string, unknown> | undefined;
    if (typeof data?.message === 'string') return data.message;
  }
  return fallback;
}

function StaffMaintenance() {
  const [tasks, setTasks] = useState<GroupedTasks | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<MaintenanceTask | null>(null);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [completedPage, setCompletedPage] = useState(1);

  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchTasksRef = useRef<(() => Promise<void>) | null>(null);
  const { connect, on, off, isConnected } = useRealTime();

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const groupedTasks = await maintenanceService.getTasksGrouped(completedPage);
      setTasks(groupedTasks);
    } catch (err) {
      const errorMessage = getApiErrorMessage(err, 'Failed to load maintenance tasks');
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [completedPage]);

  // Keep a stable ref to fetchTasks so real-time handlers always call the latest version
  // without needing to re-register socket listeners on every completedPage change.
  useEffect(() => {
    fetchTasksRef.current = fetchTasks;
  }, [fetchTasks]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, []);

  // Connect to real-time socket once on mount — do NOT include in completedPage effect
  // to avoid redundant reconnections on pagination.
  useEffect(() => {
    connect().catch(() => {
      // Keep page functional if socket connection is unavailable.
    });
  }, [connect]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    if (!isConnected) return;

    // Use ref so this handler always calls the latest fetchTasks without
    // needing to re-register listeners on every completedPage change.
    const handleMaintenanceRealtimeUpdate = () => {
      fetchTasksRef.current?.();
    };

    on('maintenance:created', handleMaintenanceRealtimeUpdate);
    on('maintenance:updated', handleMaintenanceRealtimeUpdate);
    on('maintenance:status_changed', handleMaintenanceRealtimeUpdate);

    return () => {
      off('maintenance:created', handleMaintenanceRealtimeUpdate);
      off('maintenance:updated', handleMaintenanceRealtimeUpdate);
      off('maintenance:status_changed', handleMaintenanceRealtimeUpdate);
    };
  }, [isConnected, on, off]); // stable — does NOT re-register on completedPage changes

  const handleStartTask = async (taskId: string) => {
    try {
      setActionLoading(taskId);
      await maintenanceService.startTask(taskId);
      await fetchTasks();
      toast.success('Task started successfully!');
    } catch (err) {
      const errorMessage = getApiErrorMessage(err, 'Failed to start task. Please try again.');
      // Show as inline banner, not page-level error (tasks remain visible)
      toast.error(errorMessage);
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      setError(errorMessage);
      errorTimerRef.current = setTimeout(() => setError(null), 5000);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCompleteClick = (task: MaintenanceTask) => {
    setSelectedTask(task);
    setShowCompletionModal(true);
  };

  const handleCompleteTask = async (completedSteps: string[]) => {
    if (!selectedTask) return;

    try {
      setActionLoading(selectedTask._id);
      await maintenanceService.completeTask(selectedTask._id, {
        completionNotes: completedSteps.length > 0
          ? `Completed steps: ${completedSteps.join(', ')}`
          : 'Task completed'
      });
      await fetchTasks();
      setShowCompletionModal(false);
      setSelectedTask(null);
      toast.success('Task completed successfully!');
    } catch (err) {
      const errorMessage = getApiErrorMessage(err, 'Failed to complete task. Please try again.');
      toast.error(errorMessage);
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      setError(errorMessage);
      errorTimerRef.current = setTimeout(() => setError(null), 3000);
    } finally {
      setActionLoading(null);
    }
  };

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Unknown';
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 60) {
      return `${diffInMinutes} min ago`;
    } else if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'emergency':
      case 'urgent':
        return 'text-red-600';
      case 'high':
        return 'text-orange-600';
      case 'medium':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full opacity-20 animate-pulse"></div>
            <LoadingSpinner />
          </div>
          <p className="mt-4 text-lg font-medium bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Loading Maintenance Tasks...
          </p>
        </div>
      </div>
    );
  }

  // Only show the full-page error screen on initial load failure (tasks never loaded)
  if (!tasks && error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="relative group mb-6">
              <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-pink-500 rounded-full blur opacity-75 group-hover:opacity-100 transition duration-200"></div>
              <div className="relative bg-white/90 backdrop-blur-sm p-6 rounded-full w-20 h-20 mx-auto flex items-center justify-center">
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
            </div>
            <h3 className="text-xl font-bold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent mb-4">
              Failed to load maintenance data
            </h3>
            <p className="text-gray-600 mb-6">{error}</p>
            <Button onClick={fetchTasks} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 rounded-xl px-6 py-3">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Safety guard: tasks is null only transiently during the initial fetch
  if (!tasks) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="p-6 max-w-7xl mx-auto">
        {/* Enhanced Header Section */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 transform -skew-y-1 shadow-xl rounded-3xl"></div>
          <div className="relative bg-white/90 backdrop-blur-sm p-6 sm:p-8 rounded-3xl shadow-2xl border border-white/20">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div className="mb-4 sm:mb-0">
                <div className="flex items-center mb-3">
                  <div className="relative group mr-4">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full blur opacity-75 group-hover:opacity-100 transition duration-200"></div>
                    <div className="relative bg-white/90 backdrop-blur-sm p-3 rounded-full">
                      <Wrench className="h-8 w-8 text-blue-600" />
                    </div>
                  </div>
                  <div>
                    <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                      Maintenance Management
                    </h1>
                    <p className="text-gray-600 text-lg">Handle maintenance requests and repairs efficiently</p>
                  </div>
                </div>

                {/* Task Summary Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                  <div className="bg-gradient-to-r from-red-500 to-pink-500 text-white px-3 py-2 rounded-xl text-center">
                    <div className="text-xl font-bold">{tasks?.urgentTotal ?? tasks?.urgent?.length ?? 0}</div>
                    <div className="text-xs opacity-90">Urgent</div>
                  </div>
                  <div className="bg-gradient-to-r from-orange-500 to-yellow-500 text-white px-3 py-2 rounded-xl text-center">
                    <div className="text-xl font-bold">{tasks?.pendingTotal ?? tasks?.pending?.length ?? 0}</div>
                    <div className="text-xs opacity-90">Pending</div>
                  </div>
                  <div className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-3 py-2 rounded-xl text-center">
                    <div className="text-xl font-bold">{tasks?.inProgressTotal ?? tasks?.inProgress?.length ?? 0}</div>
                    <div className="text-xs opacity-90">In Progress</div>
                  </div>
                  <div className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-3 py-2 rounded-xl text-center">
                    <div className="text-xl font-bold">{tasks?.completedTotal ?? tasks?.completed.length ?? 0}</div>
                    <div className="text-xs opacity-90">Completed</div>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className={`flex items-center px-3 py-1.5 rounded-full text-xs font-medium ${
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
                  onClick={fetchTasks}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 rounded-xl"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-pink-500 rounded-2xl blur opacity-75 group-hover:opacity-100 transition duration-200"></div>
              <div className="relative bg-white/90 backdrop-blur-sm p-4 rounded-2xl shadow-xl border border-white/20">
                <div className="flex items-center">
                  <AlertTriangle className="h-5 w-5 text-red-500 mr-3" />
                  <p className="text-red-700 font-medium">{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Urgent Issues */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-pink-500 rounded-3xl blur opacity-75 group-hover:opacity-100 transition duration-200"></div>
            <Card className="relative bg-white/90 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 rounded-3xl">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center text-xl font-bold">
                  <div className="relative group mr-3">
                    <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-pink-500 rounded-full blur opacity-75 group-hover:opacity-100 transition duration-200"></div>
                    <div className="relative bg-white/90 backdrop-blur-sm p-2 rounded-full">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                    </div>
                  </div>
                  <span className="bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent">
                    Urgent Issues ({tasks.urgent.length})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {tasks.urgent.length > 0 ? (
                    tasks.urgent.map((task) => (
                      <div key={task._id} className="group/task relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-red-100 to-pink-100 rounded-2xl opacity-70 group-hover/task:opacity-100 transition duration-200"></div>
                        <div className="relative flex items-center justify-between p-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-red-200 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-102">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center mb-2">
                              <Flag className="h-4 w-4 text-red-500 mr-2" />
                              <p className="font-semibold text-gray-900 truncate">{task.title}</p>
                            </div>
                            <p className="text-sm text-gray-600 mb-2 line-clamp-2">{task.description || 'No description'}</p>

                            <div className="flex flex-wrap gap-2 text-xs">
                              {task.roomId && (
                                <div className="flex items-center bg-blue-100 text-blue-800 px-2 py-1 rounded-lg">
                                  <User className="h-3 w-3 mr-1" />
                                  Room {task.roomId.roomNumber}
                                </div>
                              )}
                              <div className="flex items-center bg-red-100 text-red-800 px-2 py-1 rounded-lg">
                                <Calendar className="h-3 w-3 mr-1" />
                                Reported: {formatTimeAgo(task.createdAt)}
                              </div>
                              {task.reportedBy && (
                                <div className="flex items-center bg-purple-100 text-purple-800 px-2 py-1 rounded-lg">
                                  <User className="h-3 w-3 mr-1" />
                                  By: {task.reportedBy.name || 'Admin'}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="ml-4 flex-shrink-0">
                            <Button
                              size="sm"
                              className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 rounded-xl"
                              onClick={() => handleStartTask(task._id)}
                              disabled={actionLoading === task._id}
                            >
                              {actionLoading === task._id ? (
                                <>
                                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                  Starting...
                                </>
                              ) : (
                                'Attend Now'
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12">
                      <div className="relative group mb-4">
                        <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full blur opacity-75 group-hover:opacity-100 transition duration-200"></div>
                        <div className="relative bg-white/90 backdrop-blur-sm p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center">
                          <CheckCircle className="h-8 w-8 text-green-500" />
                        </div>
                      </div>
                      <p className="text-gray-600 font-medium">No urgent issues</p>
                      <p className="text-sm text-gray-500 mt-1">All critical tasks are handled</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Pending Tasks */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-3xl blur opacity-75 group-hover:opacity-100 transition duration-200"></div>
            <Card className="relative bg-white/90 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 rounded-3xl">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center text-xl font-bold">
                  <div className="relative group mr-3">
                    <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-full blur opacity-75 group-hover:opacity-100 transition duration-200"></div>
                    <div className="relative bg-white/90 backdrop-blur-sm p-2 rounded-full">
                      <Clock className="h-5 w-5 text-orange-600" />
                    </div>
                  </div>
                  <span className="bg-gradient-to-r from-orange-600 to-yellow-600 bg-clip-text text-transparent">
                    Pending Tasks ({tasks.pending.length})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {tasks.pending.length > 0 ? (
                    tasks.pending.map((task) => (
                      <div key={task._id} className="group/task relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-orange-100 to-yellow-100 rounded-2xl opacity-70 group-hover/task:opacity-100 transition duration-200"></div>
                        <div className="relative flex items-center justify-between p-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-orange-200 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-102">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center mb-2">
                              <Flag className="h-4 w-4 text-orange-500 mr-2" />
                              <p className="font-semibold text-gray-900 truncate">{task.title}</p>
                            </div>
                            <p className="text-sm text-gray-600 mb-2 line-clamp-2">{task.description || 'No description'}</p>

                            <div className="flex flex-wrap gap-2 text-xs">
                              {task.roomId && (
                                <div className="flex items-center bg-blue-100 text-blue-800 px-2 py-1 rounded-lg">
                                  <User className="h-3 w-3 mr-1" />
                                  Room {task.roomId.roomNumber}
                                </div>
                              )}
                              <div className={`flex items-center px-2 py-1 rounded-lg ${task.priority === 'urgent' || task.priority === 'emergency'
                                ? 'bg-red-100 text-red-800'
                                : task.priority === 'high'
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-yellow-100 text-yellow-800'}`}>
                                <Flag className="h-3 w-3 mr-1" />
                                Priority: {task.priority}
                              </div>
                              {task.dueDate && (
                                <div className="flex items-center bg-purple-100 text-purple-800 px-2 py-1 rounded-lg">
                                  <Calendar className="h-3 w-3 mr-1" />
                                  Due: {new Date(task.dueDate).toLocaleDateString()}
                                </div>
                              )}
                              {task.reportedBy && (
                                <div className="flex items-center bg-indigo-100 text-indigo-800 px-2 py-1 rounded-lg">
                                  <User className="h-3 w-3 mr-1" />
                                  By: {task.reportedBy.name || 'Admin'}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="ml-4 flex-shrink-0">
                            <Button
                              size="sm"
                              className="bg-gradient-to-r from-orange-600 to-yellow-600 hover:from-orange-700 hover:to-yellow-700 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 rounded-xl"
                              onClick={() => handleStartTask(task._id)}
                              disabled={actionLoading === task._id}
                            >
                              {actionLoading === task._id ? (
                                <>
                                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                  Starting...
                                </>
                              ) : (
                                'Start Task'
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12">
                      <div className="relative group mb-4">
                        <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full blur opacity-75 group-hover:opacity-100 transition duration-200"></div>
                        <div className="relative bg-white/90 backdrop-blur-sm p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center">
                          <CheckCircle className="h-8 w-8 text-green-500" />
                        </div>
                      </div>
                      <p className="text-gray-600 font-medium">No pending tasks</p>
                      <p className="text-sm text-gray-500 mt-1">All tasks are up to date</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* In Progress */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-3xl blur opacity-75 group-hover:opacity-100 transition duration-200"></div>
            <Card className="relative bg-white/90 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 rounded-3xl">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center text-xl font-bold">
                  <div className="relative group mr-3">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full blur opacity-75 group-hover:opacity-100 transition duration-200"></div>
                    <div className="relative bg-white/90 backdrop-blur-sm p-2 rounded-full">
                      <Wrench className="h-5 w-5 text-blue-600" />
                    </div>
                  </div>
                  <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    In Progress ({tasks.inProgress.length})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {tasks.inProgress.length > 0 ? (
                    tasks.inProgress.map((task) => (
                      <div key={task._id} className="group/task relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-2xl opacity-70 group-hover/task:opacity-100 transition duration-200"></div>
                        <div className="relative flex items-center justify-between p-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-blue-200 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-102">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center mb-2">
                              <div className="relative mr-2">
                                <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                                <div className="absolute inset-0 w-3 h-3 bg-blue-500 rounded-full animate-ping opacity-75"></div>
                              </div>
                              <p className="font-semibold text-gray-900 truncate">{task.title}</p>
                            </div>
                            <p className="text-sm text-gray-600 mb-2 line-clamp-2">{task.description || 'No description'}</p>

                            <div className="flex flex-wrap gap-2 text-xs">
                              {task.roomId && (
                                <div className="flex items-center bg-blue-100 text-blue-800 px-2 py-1 rounded-lg">
                                  <User className="h-3 w-3 mr-1" />
                                  Room {task.roomId.roomNumber}
                                </div>
                              )}
                              <div className="flex items-center bg-blue-100 text-blue-800 px-2 py-1 rounded-lg">
                                <Calendar className="h-3 w-3 mr-1" />
                                Started: {formatTimeAgo(task.startedDate ?? task.updatedAt)}
                              </div>
                              {task.reportedBy && (
                                <div className="flex items-center bg-purple-100 text-purple-800 px-2 py-1 rounded-lg">
                                  <User className="h-3 w-3 mr-1" />
                                  By: {task.reportedBy.name || 'Admin'}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="ml-4 flex-shrink-0">
                            <Button
                              size="sm"
                              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 rounded-xl"
                              onClick={() => handleCompleteClick(task)}
                              disabled={actionLoading === task._id}
                            >
                              {actionLoading === task._id ? (
                                <>
                                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                  Completing...
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Complete
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12">
                      <div className="relative group mb-4">
                        <div className="absolute inset-0 bg-gradient-to-r from-gray-400 to-gray-500 rounded-full blur opacity-75 group-hover:opacity-100 transition duration-200"></div>
                        <div className="relative bg-white/90 backdrop-blur-sm p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center">
                          <Clock className="h-8 w-8 text-gray-400" />
                        </div>
                      </div>
                      <p className="text-gray-600 font-medium">No tasks in progress</p>
                      <p className="text-sm text-gray-500 mt-1">Start working on pending tasks</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Completed Today */}
          <div className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-500 rounded-3xl blur opacity-75 group-hover:opacity-100 transition duration-200"></div>
            <Card className="relative bg-white/90 backdrop-blur-sm border-0 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 rounded-3xl">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center text-xl font-bold">
                  <div className="relative group mr-3">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full blur opacity-75 group-hover:opacity-100 transition duration-200"></div>
                    <div className="relative bg-white/90 backdrop-blur-sm p-2 rounded-full">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    </div>
                  </div>
                  <span className="bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                    Completed ({tasks.completedTotal ?? tasks.completed.length})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {tasks.completed.length > 0 ? (
                    tasks.completed.map((task) => (
                      <div key={task._id} className="group/task relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-green-100 to-emerald-100 rounded-2xl opacity-70 group-hover/task:opacity-100 transition duration-200"></div>
                        <div className="relative flex items-center justify-between p-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-green-200 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-102">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center mb-2">
                              <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                              <p className="font-semibold text-gray-900 truncate">{task.title}</p>
                            </div>
                            <p className="text-sm text-gray-600 mb-2 line-clamp-2">{task.description || 'No description'}</p>

                            <div className="flex flex-wrap gap-2 text-xs">
                              {task.roomId && (
                                <div className="flex items-center bg-blue-100 text-blue-800 px-2 py-1 rounded-lg">
                                  <User className="h-3 w-3 mr-1" />
                                  Room {task.roomId.roomNumber}
                                </div>
                              )}
                              <div className="flex items-center bg-green-100 text-green-800 px-2 py-1 rounded-lg">
                                <Calendar className="h-3 w-3 mr-1" />
                                Completed: {task.completedDate ? formatTimeAgo(task.completedDate) : formatTimeAgo(task.updatedAt)}
                              </div>
                              {task.reportedBy && (
                                <div className="flex items-center bg-purple-100 text-purple-800 px-2 py-1 rounded-lg">
                                  <User className="h-3 w-3 mr-1" />
                                  By: {task.reportedBy.name || 'Admin'}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="ml-4 flex-shrink-0">
                            <Badge className="bg-gradient-to-r from-green-600 to-emerald-600 text-white border-0 shadow-lg px-3 py-1 rounded-xl">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Completed
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12">
                      <div className="relative group mb-4">
                        <div className="absolute inset-0 bg-gradient-to-r from-gray-400 to-gray-500 rounded-full blur opacity-75 group-hover:opacity-100 transition duration-200"></div>
                        <div className="relative bg-white/90 backdrop-blur-sm p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center">
                          <Clock className="h-8 w-8 text-gray-400" />
                        </div>
                      </div>
                      <p className="text-gray-600 font-medium">No completed tasks</p>
                      <p className="text-sm text-gray-500 mt-1">Tasks you complete will appear here</p>
                    </div>
                  )}
                </div>

                {/* Completed Tasks Pagination */}
                {(tasks.completedTotal ?? 0) > 10 && (
                  <div className="flex items-center justify-center gap-3 mt-4 pt-3 border-t border-green-100">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCompletedPage(p => Math.max(1, p - 1))}
                      disabled={completedPage <= 1 || loading}
                      className="rounded-xl"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-xs text-gray-600">
                      Page {completedPage} of {Math.ceil((tasks.completedTotal ?? 0) / 10)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCompletedPage(p => p + 1)}
                      disabled={completedPage >= Math.ceil((tasks.completedTotal ?? 0) / 10) || loading}
                      className="rounded-xl"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Task Completion Modal */}
        {selectedTask && (
          <TaskCompletionModal
            isOpen={showCompletionModal}
            onClose={() => {
              setShowCompletionModal(false);
              setSelectedTask(null);
            }}
            onComplete={handleCompleteTask}
            title="Complete Maintenance Task"
            taskName={`${selectedTask.roomId?.roomNumber ? `Room ${selectedTask.roomId.roomNumber} - ` : ''}${selectedTask.title}`}
            steps={getDefaultSteps('maintenance', selectedTask.category)}
            loading={actionLoading === selectedTask._id}
          />
        )}
      </div>
    </div>
  );
}

export default withErrorBoundary(StaffMaintenance);

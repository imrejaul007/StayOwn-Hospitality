import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { api } from '../../services/api';
import {
  CheckSquare,
  Clock,
  AlertTriangle,
  Play,
  CheckCircle,
  Camera,
  MessageSquare,
  Calendar,
  Filter,
  RefreshCw,
  BarChart3
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '../LoadingSpinner';
import { useAuth } from '../../context/AuthContext';
import { formatRelativeTime } from '../../utils/dashboardUtils';
import { PhotoUpload } from '../inventory/PhotoUpload';

interface StaffTask {
  _id: string;
  title: string;
  description: string;
  taskType: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'overdue';
  dueDate: string;
  completedAt?: string;
  startedAt?: string;
  estimatedDuration: number;
  actualDuration?: number;
  roomIds: Array<{
    _id: string;
    roomNumber: string;
    type: string;
  }>;
  inventoryItems: Array<{
    itemId: {
      _id: string;
      name: string;
      category: string;
    };
    requiredQuantity: number;
    currentQuantity: number;
  }>;
  completionPercentage: number;
  isOverdue: boolean;
  timeRemaining: number;
  completionNotes?: string;
  completionPhotos?: string[];
  createdBy: {
    name: string;
    email: string;
  };
}

export function StaffTaskDashboard() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<StaffTask[]>([]);
  const [todaysTasks, setTodaysTasks] = useState<StaffTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedTask, setSelectedTask] = useState<StaffTask | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  // Guard state updates after unmount
  const mountedRef = React.useRef(true);
  React.useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetchTodaysTasks = useCallback(async () => {
    try {
      const { data } = await api.get('/staff-tasks/today');
      if (mountedRef.current) setTodaysTasks(data?.data?.tasks ?? []);
    } catch {
      // Today's tasks failure is non-critical; silent is acceptable
    }
  }, []);

  const fetchTasks = useCallback(async () => {
    try {
      if (mountedRef.current) setLoading(true);
      const params: Record<string, unknown> = {
        // Explicit pagination so we never fire an unbounded query
        limit: 100,
        skip: 0,
      };
      if (selectedStatus !== 'all') params.status = selectedStatus;

      const { data } = await api.get('/staff-tasks/my-tasks', { params });
      if (mountedRef.current) setTasks(data.data.tasks ?? []);
    } catch {
      if (mountedRef.current) toast.error('Failed to load tasks');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [selectedStatus]);

  useEffect(() => {
    fetchTasks();
    fetchTodaysTasks();
  }, [fetchTasks, fetchTodaysTasks]);

  const updateTaskStatus = useCallback(async (
    taskId: string,
    status: string,
    completionPayload?: Record<string, unknown>
  ) => {
    try {
      // The backend PATCH /:taskId/status accepts:
      //   { status, completionNotes, completionPhotos, completionData }
      // Extract each field to the correct top-level key.
      const body: Record<string, unknown> = { status };
      if (completionPayload) {
        if (completionPayload.completionNotes) {
          body.completionNotes = completionPayload.completionNotes;
        }
        if (Array.isArray(completionPayload.completionPhotos)) {
          body.completionPhotos = completionPayload.completionPhotos;
        }
        if (completionPayload.completionData) {
          body.completionData = completionPayload.completionData;
        }
      }
      await api.patch(`/staff-tasks/${taskId}/status`, body);
      if (mountedRef.current) {
        toast.success(`Task marked as ${status.replace(/_/g, ' ')}`);
      }
      await fetchTasks();
      await fetchTodaysTasks();
    } catch {
      if (mountedRef.current) {
        toast.error('Failed to update task status');
      }
    }
  }, [fetchTasks, fetchTodaysTasks]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'assigned': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-white';
      case 'low': return 'bg-green-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getTaskTypeIcon = (taskType: string) => {
    switch (taskType) {
      case 'daily_inventory_check': return <CheckSquare className="w-4 h-4" />;
      case 'inventory_restocking': return <RefreshCw className="w-4 h-4" />;
      case 'inventory_delivery': return <Clock className="w-4 h-4" />;
      default: return <CheckSquare className="w-4 h-4" />;
    }
  };

  const getTaskStats = () => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const inProgress = tasks.filter(t => t.status === 'in_progress').length;
    const overdue = tasks.filter(t => t.isOverdue).length;
    
    return { total, completed, inProgress, overdue };
  };

  const stats = getTaskStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Tasks</h1>
          <p className="text-gray-600 mt-1">Manage your daily work assignments</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button onClick={fetchTasks} variant="secondary" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BarChart3 className="w-5 h-5 text-blue-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Total Tasks</p>
              <p className="text-lg font-semibold text-gray-900">{stats.total}</p>
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
              <p className="text-lg font-semibold text-gray-900">{stats.inProgress}</p>
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
              <p className="text-lg font-semibold text-gray-900">{stats.completed}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Overdue</p>
              <p className="text-lg font-semibold text-gray-900">{stats.overdue}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Today's Tasks */}
      {todaysTasks.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Today's Priority Tasks</h2>
            <Badge variant="info">{todaysTasks.length} tasks</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {todaysTasks.map((task) => (
              <div key={task._id} className="p-4 bg-gray-50 rounded-lg border-l-4 border-blue-500">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    {getTaskTypeIcon(task.taskType)}
                    <Badge variant="secondary" className={getPriorityColor(task.priority)} size="sm">
                      {task.priority}
                    </Badge>
                  </div>
                  <Badge variant="secondary" className={getStatusColor(task.status)} size="sm">
                    {task.status.replace(/_/g, ' ')}
                  </Badge>
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{task.title}</h3>
                <p className="text-sm text-gray-600 mb-3">{task.description}</p>
                
                {task.roomIds.length > 0 && (
                  <div className="flex items-center space-x-1 mb-2">
                    <span className="text-xs text-gray-500">Rooms:</span>
                    {task.roomIds.slice(0, 3).map((room) => (
                      <Badge key={room._id} variant="secondary" size="sm" className="text-xs">
                        {room.roomNumber}
                      </Badge>
                    ))}
                    {task.roomIds.length > 3 && (
                      <span className="text-xs text-gray-500">+{task.roomIds.length - 3} more</span>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-gray-500">
                    {task.isOverdue ? (
                      <span className="text-red-600">Overdue</span>
                    ) : (
                      `${Math.floor(task.timeRemaining / 60)}h ${task.timeRemaining % 60}m left`
                    )}
                  </span>
                  <div className="flex space-x-1">
                    {task.status === 'assigned' && (
                      <Button
                        size="sm"
                        onClick={() => updateTaskStatus(task._id, 'in_progress')}
                        className="text-xs"
                      >
                        <Play className="w-3 h-3 mr-1" />
                        Start
                      </Button>
                    )}
                    {task.status === 'in_progress' && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedTask(task);
                          setShowTaskModal(true);
                        }}
                        className="text-xs"
                      >
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Complete
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Filter and All Tasks */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">All Tasks</h2>
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Status</option>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
        </div>

        {tasks.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="mx-auto h-8 w-8 text-green-500 mb-3" />
            <p className="text-gray-500">No tasks found</p>
            <p className="text-xs text-gray-400">All caught up!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => (
              <div key={task._id} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      {getTaskTypeIcon(task.taskType)}
                      <h3 className="font-semibold text-gray-900">{task.title}</h3>
                      <Badge variant="secondary" className={getPriorityColor(task.priority)} size="sm">
                        {task.priority}
                      </Badge>
                      <Badge variant="secondary" className={getStatusColor(task.status)} size="sm">
                        {task.status.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-3">{task.description}</p>
                    
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-4 h-4" />
                        <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Clock className="w-4 h-4" />
                        <span>{task.estimatedDuration} min</span>
                      </div>
                      {task.roomIds.length > 0 && (
                        <div className="flex items-center space-x-1">
                          <span>Rooms: {task.roomIds.map(r => r.roomNumber).join(', ')}</span>
                        </div>
                      )}
                    </div>

                    {task.status === 'in_progress' && task.completionPercentage > 0 && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                          <span>Progress</span>
                          <span>{task.completionPercentage}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${task.completionPercentage}%` }}
                          ></div>
                        </div>
                      </div>
                    )}

                    {task.status === 'completed' && (
                      <div className="mt-3 p-2 bg-green-50 rounded-md border border-green-200">
                        <div className="flex items-center text-sm text-green-800 mb-1">
                          <CheckCircle className="w-4 h-4 mr-1" />
                          <span>Completed: {task.completedAt ? new Date(task.completedAt).toLocaleString() : 'Recently'}</span>
                        </div>
                        {task.completionNotes && (
                          <p className="text-sm text-green-700 mt-1">{task.completionNotes}</p>
                        )}
                        {task.completionPhotos && task.completionPhotos.length > 0 && (
                          <div className="flex items-center text-xs text-green-600 mt-1">
                            <Camera className="w-3 h-3 mr-1" />
                            <span>{task.completionPhotos.length} photo{task.completionPhotos.length > 1 ? 's' : ''} attached</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    {task.status === 'assigned' && (
                      <Button
                        size="sm"
                        onClick={() => updateTaskStatus(task._id, 'in_progress')}
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Start
                      </Button>
                    )}
                    {task.status === 'in_progress' && (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setSelectedTask(task);
                            setShowTaskModal(true);
                          }}
                        >
                          <MessageSquare className="w-4 h-4 mr-2" />
                          Update
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedTask(task);
                            setShowTaskModal(true);
                          }}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Complete
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Task Completion Modal */}
      {showTaskModal && selectedTask && (
        <TaskCompletionModal
          task={selectedTask}
          onComplete={(completionData) => {
            updateTaskStatus(selectedTask._id, 'completed', completionData);
            setShowTaskModal(false);
            setSelectedTask(null);
          }}
          onClose={() => {
            setShowTaskModal(false);
            setSelectedTask(null);
          }}
        />
      )}
    </div>
  );
}

// Task Completion Modal Component
interface TaskCompletionModalProps {
  task: StaffTask;
  onComplete: (data: Record<string, unknown>) => void;
  onClose: () => void;
}

interface Photo {
  id: string;
  url: string;
  file?: File;
  description: string;
  uploadedAt: string;
  uploadedBy?: string;
  isUploading?: boolean;
}

function TaskCompletionModal({ task, onComplete, onClose }: TaskCompletionModalProps) {
  const [completionNotes, setCompletionNotes] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [completionData, setCompletionData] = useState<{ completedRooms?: string[]; [key: string]: unknown }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleComplete = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      // Upload photos that have a File object (not yet persisted to server)
      const photoUrls: string[] = [];
      for (const photo of photos) {
        if (photo.file) {
          // Upload photo to server and collect returned URL.
          // The endpoint is POST /photos/upload (multipart/form-data).
          // Response shape: { status: 'success', data: { url: '...', ... } }
          const formData = new FormData();
          formData.append('photo', photo.file);
          formData.append('description', photo.description || '');
          const { data: responseBody } = await api.post('/photos/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          // responseBody = { status, data: { url, ... } }
          const serverUrl: string =
            responseBody?.data?.url || responseBody?.url || photo.url;
          photoUrls.push(serverUrl);
        } else if (photo.url && !photo.url.startsWith('blob:')) {
          // Already-uploaded photo (server URL)
          photoUrls.push(photo.url);
        }
      }

      onComplete({
        completionNotes,
        completionPhotos: photoUrls,
        completionData: {
          ...completionData,
          completedAt: new Date().toISOString(),
          photosCount: photoUrls.length
        }
      });
    } catch (err) {
      toast.error('Failed to upload photos. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Complete Task</h2>
          <p className="text-gray-600 mt-1">{task.title}</p>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Completion Notes *
            </label>
            <textarea
              value={completionNotes}
              onChange={(e) => setCompletionNotes(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Describe what was completed, any issues encountered, or additional notes..."
              required
            />
          </div>

          {task.taskType === 'daily_inventory_check' && (
            <div className="space-y-3">
              <h3 className="font-medium text-gray-900">Rooms Checked</h3>
              <div className="bg-gray-50 p-3 rounded-md">
                {task.roomIds.map((room, index) => (
                  <div key={room._id} className="flex items-center space-x-3 py-1">
                    <input
                      type="checkbox"
                      id={`room-${room._id}`}
                      checked={(completionData.completedRooms ?? []).includes(room._id)}
                      onChange={(e) => {
                        const completedRooms = completionData.completedRooms ?? [];
                        if (e.target.checked) {
                          setCompletionData({
                            ...completionData,
                            completedRooms: [...completedRooms, room._id]
                          });
                        } else {
                          setCompletionData({
                            ...completionData,
                            completedRooms: completedRooms.filter((id) => id !== room._id)
                          });
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor={`room-${room._id}`} className="text-sm text-gray-700">
                      Room {room.roomNumber} ({room.type})
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Photo Upload Section */}
          <div className="space-y-3">
            <h3 className="font-medium text-gray-900 flex items-center">
              <Camera className="w-4 h-4 mr-2" />
              Completion Photos
            </h3>
            <p className="text-sm text-gray-600">
              Upload photos to document the completed work (optional)
            </p>
            <PhotoUpload
              photos={photos}
              onPhotosChange={setPhotos}
              maxPhotos={5}
              showCamera={true}
              label=""
              description=""
            />
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleComplete} 
            disabled={isSubmitting || !completionNotes.trim()}
            className="min-w-[140px]"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Completing...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Complete Task
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default StaffTaskDashboard;
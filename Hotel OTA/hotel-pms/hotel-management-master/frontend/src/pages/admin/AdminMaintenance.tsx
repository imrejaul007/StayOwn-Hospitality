import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Wrench,
  Clock,
  CheckCircle,
  AlertTriangle,
  Filter,
  Plus,
  Eye,
  Edit,
  Play,
  CheckSquare,
  X,
  User,
  MapPin,
  Save,
  RefreshCw,
  Activity,
  TrendingUp,
  BarChart3,
  Users,
  AlertCircle,
  Settings,
  Zap,
  Target
} from 'lucide-react';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/Modal';
import { DataTable } from '../../components/dashboard/DataTable';
import { StatusBadge } from '../../components/dashboard/StatusBadge';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import ErrorBoundary from '../../components/ErrorBoundary';
import { formatCurrency } from '../../utils/formatters';
import { adminMaintenanceService, MaintenanceTask, MaintenanceStats, CreateMaintenanceTaskData, MaintenanceFilters } from '../../services/adminMaintenanceService';
import { useRealTime } from '../../services/realTimeService';
import { useAuth } from '../../context/AuthContext';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import toast from 'react-hot-toast';


export default function AdminMaintenance() {
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [stats, setStats] = useState<MaintenanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [filters, setFilters] = useState<MaintenanceFilters>({ page: 1, limit: 20 });
  const [pagination, setPagination] = useState({ total: 0, pages: 0 });

  // Auth context
  const { user } = useAuth();
  const { selectedPropertyId } = useProperty();
  
  // Available staff and rooms for task creation
  const [availableStaff, setAvailableStaff] = useState<Array<{ _id: string; name: string; email: string; department?: string }>>([]);
  const [availableRooms, setAvailableRooms] = useState<Array<{ _id: string; roomNumber: string; type: string; floor?: string }>>([]);
  
  // Real-time connection
  const { connectionState, connect, disconnect, on, off, isConnected } = useRealTime();
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<MaintenanceTask | null>(null);
  
  // Form data
  const [formData, setFormData] = useState<CreateMaintenanceTaskData & { materialsText?: string; vendorRequired?: boolean }>({
    title: '',
    description: '',
    type: 'other',
    category: 'corrective',
    priority: 'medium',
    roomId: '',
    assignedToUserId: '',
    estimatedDuration: 60,
    estimatedCost: 0,
    notes: '',
    materialsText: '',
    vendorRequired: false
  });

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const taskFilters: MaintenanceFilters = { ...filters, hotelId: selectedPropertyId || undefined };
      const response = await adminMaintenanceService.getTasks(taskFilters);
      // Filter out any undefined or invalid tasks
      const validTasks = (response.data.tasks || []).filter(task => task && typeof task === 'object');
      setTasks(validTasks);
      setPagination({
        total: response.data.pagination?.total || 0,
        pages: response.data.pagination?.pages || 1
      });
    } catch (error) {
      toast.error('Failed to load maintenance tasks');
    } finally {
      setLoading(false);
    }
  }, [filters, selectedPropertyId]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await adminMaintenanceService.getStats(selectedPropertyId || undefined);
      setStats(response.data);
    } catch (error) {
      toast.error('Failed to load maintenance statistics');
    }
  }, [selectedPropertyId]);

  const fetchAvailableStaff = useCallback(async () => {
    try {
      const response = await adminMaintenanceService.getAvailableStaff(selectedPropertyId || undefined);
      setAvailableStaff(response.data);
    } catch (error) {
      toast.error('Failed to load available staff');
    }
  }, [selectedPropertyId]);

  const fetchAvailableRooms = useCallback(async () => {
    try {
      const response = await adminMaintenanceService.getAvailableRooms(selectedPropertyId || undefined);
      setAvailableRooms(response.data);
    } catch (error) {
      toast.error('Failed to load available rooms');
    }
  }, [selectedPropertyId]);

  // Reset pagination to page 1 when the selected property changes.
  const prevMaintenancePropertyRef = useRef<string | null>(null);
  useEffect(() => {
    if (selectedPropertyId && selectedPropertyId !== prevMaintenancePropertyRef.current) {
      prevMaintenancePropertyRef.current = selectedPropertyId;
      setFilters(prev => ({ ...prev, page: 1 }));
    }
  }, [selectedPropertyId]);

  useEffect(() => {
    if (!selectedPropertyId) return;

    fetchTasks();
    fetchStats();
    fetchAvailableStaff();
    fetchAvailableRooms();

    // Connect to real-time updates
    // Do NOT disconnect on unmount — realTimeService is a singleton shared across components
    connect().catch(() => { /* Error handled silently */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- connect/disconnect are excluded to prevent reconnection loops
  }, [filters, selectedPropertyId, fetchTasks, fetchStats, fetchAvailableStaff, fetchAvailableRooms]);
  
  // Set up real-time event listeners
  useEffect(() => {
    if (!isConnected) return;
    
    const handleMaintenanceUpdate = (_data: Record<string, unknown>) => {
      fetchTasks();
      fetchStats();
      toast.success('Maintenance data updated in real-time');
    };

    const handleMaintenanceCreate = (_data: Record<string, unknown>) => {
      fetchTasks();
      fetchStats();
      toast.success('New maintenance task created');
    };
    
    // Subscribe to maintenance events
    on('maintenance:created', handleMaintenanceCreate);
    on('maintenance:updated', handleMaintenanceUpdate);
    on('maintenance:status_changed', handleMaintenanceUpdate);
    
    return () => {
      off('maintenance:created', handleMaintenanceCreate);
      off('maintenance:updated', handleMaintenanceUpdate);
      off('maintenance:status_changed', handleMaintenanceUpdate);
    };
  }, [isConnected, on, off, fetchTasks, fetchStats]);

  // Handle task creation
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setUpdating(true);

      // Comprehensive validation
      if (!formData.title.trim()) {
        toast.error('Task title is required');
        return;
      }

      if (formData.estimatedDuration < 15) {
        toast.error('Estimated duration must be at least 15 minutes');
        return;
      }

      if (formData.estimatedDuration > 480) {
        toast.error('Estimated duration cannot exceed 8 hours (480 minutes)');
        return;
      }

      if (formData.estimatedCost < 0) {
        toast.error('Estimated cost cannot be negative');
        return;
      }

      // Parse materials from text input
      let materials = undefined;
      if (formData.materialsText && formData.materialsText.trim()) {
        materials = formData.materialsText.split(',').map(item => ({
          name: item.trim(),
          quantity: 1,
          unitCost: 0
        })).filter(item => item.name);
      }

      const cleanedFormData = {
        ...formData,
        hotelId: selectedPropertyId || undefined,
        roomId: formData.roomId || undefined,
        assignedToUserId: formData.assignedToUserId || undefined,
        estimatedDuration: formData.estimatedDuration || 60,
        estimatedCost: formData.estimatedCost || 0,
        materials,
        vendorRequired: formData.vendorRequired || false
      };

      // Remove the temporary fields before sending
      delete cleanedFormData.materialsText;

      await adminMaintenanceService.createTask(cleanedFormData);
      
      toast.success('Maintenance task created successfully');
      await fetchTasks();
      await fetchStats();
      setShowCreateModal(false);
      resetFormData();
    } catch (error) {
      toast.error('Failed to create maintenance task');
    } finally {
      setUpdating(false);
    }
  };

  // Handle status update
  const handleStatusUpdate = async (taskId: string, newStatus: 'assigned' | 'in_progress' | 'completed' | 'cancelled') => {
    try {
      setUpdating(true);
      await adminMaintenanceService.updateTask(taskId, { status: newStatus });
      
      await fetchTasks();
      await fetchStats();
      toast.success('Task status updated successfully');
    } catch (error) {
      toast.error('Failed to update task status');
    } finally {
      setUpdating(false);
    }
  };

  const resetFormData = () => {
    setFormData({
      title: '',
      description: '',
      type: 'other',
      category: 'corrective',
      priority: 'medium',
      roomId: '',
      assignedToUserId: '',
      estimatedDuration: 60,
      estimatedCost: 0,
      notes: '',
      materialsText: '',
      vendorRequired: false
    });
  };

  // Helper function to format duration
  const formatDuration = (durationInMinutes: number | null | undefined): string => {
    if (!durationInMinutes || durationInMinutes === 0) return '0';

    if (durationInMinutes < 60) {
      return `${Math.round(durationInMinutes)}`;
    }

    const hours = Math.floor(durationInMinutes / 60);
    const minutes = Math.round(durationInMinutes % 60);

    if (minutes === 0) {
      return `${hours}h`;
    }

    return `${hours}h ${minutes}m`;
  };

  const handleViewTask = (task: MaintenanceTask) => {
    setSelectedTask(task);
    setShowViewModal(true);
  };

  const getTaskTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      preventive: 'bg-blue-100 text-blue-800',
      corrective: 'bg-orange-100 text-orange-800',
      emergency: 'bg-red-100 text-red-800',
      inspection: 'bg-green-100 text-green-800',
      plumbing: 'bg-cyan-100 text-cyan-800',
      electrical: 'bg-yellow-100 text-yellow-800',
      hvac: 'bg-indigo-100 text-indigo-800',
      cleaning: 'bg-green-100 text-green-800',
      carpentry: 'bg-amber-100 text-amber-800',
      painting: 'bg-purple-100 text-purple-800',
      appliance: 'bg-pink-100 text-pink-800',
      safety: 'bg-red-100 text-red-800',
      other: 'bg-gray-100 text-gray-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'bg-gray-100 text-gray-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800',
      emergency: 'bg-red-200 text-red-900'
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
  };

  const columns = useMemo(() => [
    {
      key: 'title',
      header: 'Task',
      render: (value: unknown, task: MaintenanceTask) => (
        <div>
          <div className="font-medium text-gray-900">{task.title}</div>
          <div className="text-sm text-gray-500">{task.description}</div>
        </div>
      )
    },
    {
      key: 'type',
      header: 'Type',
      render: (value: unknown, task: MaintenanceTask) => {
        if (!task || !task.type) {
          return <span className="text-gray-400">N/A</span>;
        }
        return (
          <div className="space-y-1">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTaskTypeColor(task.type)}`}>
              {task.type.replace('_', ' ')}
            </span>
            {task.category && (
              <div className="text-xs text-gray-500">
                {task.category}
              </div>
            )}
          </div>
        );
      }
    },
    {
      key: 'priority',
      header: 'Priority',
      render: (value: unknown, task: MaintenanceTask) => {
        if (!task || !task.priority) {
          return <span className="text-gray-400">N/A</span>;
        }
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(task.priority)}`}>
            {task.priority}
          </span>
        );
      }
    },
    {
      key: 'roomId',
      header: 'Room',
      render: (value: unknown, task: MaintenanceTask) => {
        if (!task || !task.roomId) {
          return <span className="text-gray-400">No room assigned</span>;
        }
        return (
          <div className="text-sm">
            <div className="font-medium">{task.roomId.roomNumber || 'Unknown Room'}</div>
            <div className="text-gray-500">{task.roomId.type || 'Unknown Type'}</div>
          </div>
        );
      }
    },
    {
      key: 'assignedToUserId',
      header: 'Assigned To',
      render: (value: unknown, task: MaintenanceTask) => {
        if (!task) {
          return <span className="text-gray-400">N/A</span>;
        }
        return (
          <div className="text-sm">
            {task.assignedToUserId && task.assignedToUserId.name ? (
              <>
                <div className="font-medium">{task.assignedToUserId.name}</div>
                <div className="text-gray-500">{task.assignedToUserId.email || ''}</div>
              </>
            ) : (
              <span className="text-gray-400">Unassigned</span>
            )}
          </div>
        );
      }
    },
    {
      key: 'status',
      header: 'Status',
      render: (value: unknown, task: MaintenanceTask) => {
        if (!task || !task.status) {
          return <span className="text-gray-400">N/A</span>;
        }
        return (
          <StatusBadge
            status={task.status}
          />
        );
      }
    },
    {
      key: 'estimatedDuration',
      header: 'Duration',
      render: (value: unknown, task: MaintenanceTask) => {
        if (!task || !task.estimatedDuration) {
          return <span className="text-gray-400">N/A</span>;
        }
        return (
          <div className="text-sm text-gray-600">
            {formatDuration(task.estimatedDuration)}
          </div>
        );
      }
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (value: unknown, task: MaintenanceTask) => {
        if (!task || !task._id) {
          return <span className="text-gray-400">N/A</span>;
        }
        return (
          <div className="flex items-center space-x-1 sm:space-x-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleViewTask(task)}
            >
              <Eye className="h-4 w-4" />
            </Button>
            {task.status === 'pending' && (
              <Button
                size="sm"
                onClick={() => handleStatusUpdate(task._id, 'assigned')}
                disabled={updating}
              >
                <Play className="h-4 w-4" />
              </Button>
            )}
            {task.status === 'assigned' && (
              <Button
                size="sm"
                onClick={() => handleStatusUpdate(task._id, 'in_progress')}
                disabled={updating}
              >
                <Play className="h-4 w-4" />
              </Button>
            )}
            {(task.status === 'in_progress' || task.status === 'assigned') && (
              <Button
                size="sm"
                onClick={() => handleStatusUpdate(task._id, 'completed')}
                disabled={updating}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckSquare className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      },
      align: 'center' as const
    }
  ], [updating]);

  // Show message if no property is selected
  if (!selectedPropertyId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="p-6 max-w-7xl mx-auto">
          <PropertyBreadcrumb items={['Maintenance']} />
          <div className="text-center py-12">
            <div className="text-gray-500 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Property Selected</h3>
            <p className="text-gray-500">Please select a property to view maintenance tasks.</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading && !tasks.length) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <ErrorBoundary level="page" onError={(error, errorInfo) => {
      toast.error('An error occurred in the maintenance management page');
    }}>
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="p-4 sm:p-6 max-w-7xl mx-auto">
        {/* Breadcrumb */}
        <PropertyBreadcrumb items={['Maintenance']} />

        {/* Header */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 transform -skew-y-1 shadow-xl rounded-3xl"></div>
          <div className="relative bg-white/90 backdrop-blur-sm p-6 sm:p-8 rounded-3xl shadow-2xl border border-white/20">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-4 sm:space-y-0">
              <div className="flex items-center space-x-4">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg">
                  <Wrench className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                    Maintenance Management
                  </h1>
                  <p className="text-gray-600 mt-1">Create and manage maintenance tasks for hotel operations</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
                {/* Real-time connection status */}
                <div className="flex items-center space-x-2 px-3 py-2 bg-white/70 backdrop-blur-sm rounded-xl shadow-sm">
                  <div className={`w-2 h-2 rounded-full ${
                    connectionState === 'connected' ? 'bg-green-500 animate-pulse' :
                    connectionState === 'connecting' ? 'bg-yellow-500 animate-bounce' : 'bg-red-500'
                  }`}></div>
                  <span className="text-xs text-gray-600 capitalize font-medium">{connectionState}</span>
                </div>

                <Button
                  onClick={fetchTasks}
                  variant="secondary"
                  size="sm"
                  disabled={loading}
                  className="bg-white/80 hover:bg-white/90 backdrop-blur-sm border-white/20 shadow-lg transition-all duration-200 hover:shadow-xl"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                <Button
                  onClick={() => setShowCreateModal(true)}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Task
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-8">
            {/* Total Tasks */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl blur opacity-75 group-hover:opacity-100 transition duration-200"></div>
              <Card className="relative bg-white/90 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 rounded-xl h-24">
                <CardContent className="p-3 text-center flex flex-col justify-center h-full">
                  <div className="flex items-center justify-center mb-1">
                    <div className="p-1.5 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg">
                      <BarChart3 className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="text-xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">{stats.total}</div>
                  <div className="text-xs font-medium text-gray-600">Total Tasks</div>
                </CardContent>
              </Card>
            </div>

            {/* Pending */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-xl blur opacity-75 group-hover:opacity-100 transition duration-200"></div>
              <Card className="relative bg-white/90 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 rounded-xl h-24">
                <CardContent className="p-3 text-center flex flex-col justify-center h-full">
                  <div className="flex items-center justify-center mb-1">
                    <div className="p-1.5 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-lg">
                      <Clock className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="text-xl font-bold bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent">{stats.pending}</div>
                  <div className="text-xs font-medium text-gray-600">Pending</div>
                </CardContent>
              </Card>
            </div>

            {/* Assigned */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl blur opacity-75 group-hover:opacity-100 transition duration-200"></div>
              <Card className="relative bg-white/90 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 rounded-xl h-24">
                <CardContent className="p-3 text-center flex flex-col justify-center h-full">
                  <div className="flex items-center justify-center mb-1">
                    <div className="p-1.5 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg">
                      <Users className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">{stats.assigned}</div>
                  <div className="text-xs font-medium text-gray-600">Assigned</div>
                </CardContent>
              </Card>
            </div>

            {/* In Progress */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl blur opacity-75 group-hover:opacity-100 transition duration-200"></div>
              <Card className="relative bg-white/90 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 rounded-xl h-24">
                <CardContent className="p-3 text-center flex flex-col justify-center h-full">
                  <div className="flex items-center justify-center mb-1">
                    <div className="p-1.5 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg">
                      <Activity className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="text-xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">{stats.inProgress}</div>
                  <div className="text-xs font-medium text-gray-600">In Progress</div>
                </CardContent>
              </Card>
            </div>

            {/* Completed */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl blur opacity-75 group-hover:opacity-100 transition duration-200"></div>
              <Card className="relative bg-white/90 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 rounded-xl h-24">
                <CardContent className="p-3 text-center flex flex-col justify-center h-full">
                  <div className="flex items-center justify-center mb-1">
                    <div className="p-1.5 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="text-xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">{stats.completed}</div>
                  <div className="text-xs font-medium text-gray-600">Completed</div>
                </CardContent>
              </Card>
            </div>

            {/* Cancelled */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-pink-500 rounded-xl blur opacity-75 group-hover:opacity-100 transition duration-200"></div>
              <Card className="relative bg-white/90 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 rounded-xl h-24">
                <CardContent className="p-3 text-center flex flex-col justify-center h-full">
                  <div className="flex items-center justify-center mb-1">
                    <div className="p-1.5 bg-gradient-to-br from-red-500 to-pink-500 rounded-lg">
                      <X className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="text-xl font-bold bg-gradient-to-r from-red-600 to-pink-600 bg-clip-text text-transparent">{stats.cancelled}</div>
                  <div className="text-xs font-medium text-gray-600">Cancelled</div>
                </CardContent>
              </Card>
            </div>

            {/* Average Duration */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-violet-500 rounded-xl blur opacity-75 group-hover:opacity-100 transition duration-200"></div>
              <Card className="relative bg-white/90 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 rounded-xl h-24">
                <CardContent className="p-3 text-center flex flex-col justify-center h-full">
                  <div className="flex items-center justify-center mb-1">
                    <div className="p-1.5 bg-gradient-to-br from-purple-500 to-violet-500 rounded-lg">
                      <TrendingUp className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="text-xl font-bold bg-gradient-to-r from-purple-600 to-violet-600 bg-clip-text text-transparent">{formatDuration(stats.avgDuration)}</div>
                  <div className="text-xs font-medium text-gray-600">Avg Duration</div>
                </CardContent>
              </Card>
            </div>

            {/* Overdue */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-red-600 to-red-700 rounded-xl blur opacity-75 group-hover:opacity-100 transition duration-200"></div>
              <Card className="relative bg-white/90 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 rounded-xl h-24">
                <CardContent className="p-3 text-center flex flex-col justify-center h-full">
                  <div className="flex items-center justify-center mb-1">
                    <div className="p-1.5 bg-gradient-to-br from-red-600 to-red-700 rounded-lg">
                      <AlertCircle className="w-4 h-4 text-white animate-pulse" />
                    </div>
                  </div>
                  <div className="text-xl font-bold bg-gradient-to-r from-red-600 to-red-700 bg-clip-text text-transparent">{stats.overdueCount}</div>
                  <div className="text-xs font-medium text-gray-600">Overdue</div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Filters */}
        <Card className="mb-8 bg-white/90 backdrop-blur-sm border-0 shadow-xl rounded-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-slate-100 to-gray-100 px-6 py-4 border-b border-gray-200/50">
            <CardTitle className="flex items-center text-gray-800">
              <div className="p-2 bg-gradient-to-br from-slate-500 to-gray-600 rounded-xl mr-3">
                <Filter className="h-4 w-4 text-white" />
              </div>
              Filter Tasks
            </CardTitle>
          </div>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Status</label>
                <select
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 bg-white/80 backdrop-blur-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 font-medium text-gray-700"
                  value={filters.status || ''}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined, page: 1 })}
                >
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="assigned">Assigned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="on_hold">On Hold</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Type</label>
                <select
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 bg-white/80 backdrop-blur-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 font-medium text-gray-700"
                  value={filters.type || ''}
                  onChange={(e) => setFilters({ ...filters, type: e.target.value || undefined, page: 1 })}
                >
                  <option value="">All Types</option>
                  <option value="plumbing">Plumbing</option>
                  <option value="electrical">Electrical</option>
                  <option value="hvac">HVAC</option>
                  <option value="cleaning">Cleaning</option>
                  <option value="carpentry">Carpentry</option>
                  <option value="painting">Painting</option>
                  <option value="appliance">Appliance</option>
                  <option value="safety">Safety</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">Priority</label>
                <select
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 bg-white/80 backdrop-blur-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 font-medium text-gray-700"
                  value={filters.priority || ''}
                  onChange={(e) => setFilters({ ...filters, priority: e.target.value || undefined, page: 1 })}
                >
                  <option value="">All Priorities</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                  <option value="emergency">Emergency</option>
                </select>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={() => setFilters({ page: 1, limit: 20 })}
                  className="w-full bg-gradient-to-r from-slate-500 to-gray-600 hover:from-slate-600 hover:to-gray-700 shadow-lg hover:shadow-xl transition-all duration-200 rounded-xl py-3 font-semibold"
                >
                  Reset Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tasks Table */}
        <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-xl rounded-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-5 border-b border-gray-200/50">
            <CardTitle className="flex items-center text-gray-800">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl mr-3">
                <Wrench className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="text-xl font-bold">Maintenance Tasks</div>
                <div className="text-sm text-gray-600 mt-1">{pagination.total} total tasks</div>
              </div>
            </CardTitle>
          </div>
          <CardContent className="p-0">
            <ErrorBoundary level="component" fallback={
              <div className="p-8 text-center">
                <div className="p-4 bg-red-50 rounded-xl inline-block">
                  <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                  <div className="text-red-700 font-medium">Failed to load maintenance tasks table</div>
                </div>
              </div>
            }>
              <div className="overflow-x-auto">
                <div className="min-w-full">
                  <DataTable
                    data={tasks}
                    columns={columns}
                    loading={loading}
                    pagination={false}
                    emptyMessage="No maintenance tasks found. Create one to get started."
                  />
                </div>
              </div>
            </ErrorBoundary>
          </CardContent>
        
          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="px-6 py-5 bg-gradient-to-r from-gray-50 to-slate-50 border-t border-gray-200/50">
              <div className="flex flex-col sm:flex-row items-center justify-between space-y-3 sm:space-y-0">
                <div className="text-sm font-medium text-gray-700 bg-white/80 px-4 py-2 rounded-xl shadow-sm">
                  Showing {((filters.page || 1) - 1) * (filters.limit || 20) + 1} to{' '}
                  {Math.min((filters.page || 1) * (filters.limit || 20), pagination.total)} of{' '}
                  {pagination.total} results
                </div>
                <div className="flex items-center space-x-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={(filters.page || 1) <= 1}
                    onClick={() => setFilters({ ...filters, page: (filters.page || 1) - 1 })}
                    className="bg-white/80 hover:bg-white/90 border-gray-200 shadow-lg hover:shadow-xl transition-all duration-200 rounded-xl font-semibold"
                  >
                    Previous
                  </Button>
                  <span className="text-sm font-semibold text-gray-700 bg-white/80 px-4 py-2 rounded-xl shadow-sm">
                    Page {filters.page || 1} of {pagination.pages}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={(filters.page || 1) >= pagination.pages}
                    onClick={() => setFilters({ ...filters, page: (filters.page || 1) + 1 })}
                    className="bg-white/80 hover:bg-white/90 border-gray-200 shadow-lg hover:shadow-xl transition-all duration-200 rounded-xl font-semibold"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Create Task Modal */}
        <Modal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            resetFormData();
          }}
          title={
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl">
                <Plus className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Create Maintenance Task
              </span>
            </div>
          }
        >
          <form onSubmit={handleCreateTask} className="space-y-6 p-1">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 flex items-center">
                <Target className="w-4 h-4 mr-2 text-blue-500" />
                Task Title
              </label>
              <Input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter task title"
                className="border-2 border-gray-200 rounded-xl px-4 py-3 bg-white/80 backdrop-blur-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 font-medium"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 flex items-center">
                <Edit className="w-4 h-4 mr-2 text-blue-500" />
                Description
              </label>
              <textarea
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 h-24 resize-none bg-white/80 backdrop-blur-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 font-medium"
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter task description"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 flex items-center">
                  <Wrench className="w-4 h-4 mr-2 text-blue-500" />
                  Maintenance Type
                </label>
                <select
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 bg-white/80 backdrop-blur-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 font-medium text-gray-700"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as string })}
                  required
                >
                  <option value="plumbing">Plumbing</option>
                  <option value="electrical">Electrical</option>
                  <option value="hvac">HVAC</option>
                  <option value="cleaning">Cleaning</option>
                  <option value="carpentry">Carpentry</option>
                  <option value="painting">Painting</option>
                  <option value="appliance">Appliance</option>
                  <option value="safety">Safety</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 flex items-center">
                  <Settings className="w-4 h-4 mr-2 text-blue-500" />
                  Category
                </label>
                <select
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 bg-white/80 backdrop-blur-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 font-medium text-gray-700"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as string })}
                  required
                >
                  <option value="corrective">Corrective</option>
                  <option value="preventive">Preventive</option>
                  <option value="emergency">Emergency</option>
                  <option value="inspection">Inspection</option>
                </select>
              </div>
            </div>
          
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-2 text-orange-500" />
                  Priority
                </label>
                <select
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 bg-white/80 backdrop-blur-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 font-medium text-gray-700"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value as string })}
                  required
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                  <option value="emergency">Emergency</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 flex items-center">
                  <TrendingUp className="w-4 h-4 mr-2 text-green-500" />
                  Estimated Cost (₹)
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.estimatedCost}
                  onChange={(e) => setFormData({ ...formData, estimatedCost: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  className="border-2 border-gray-200 rounded-xl px-4 py-3 bg-white/80 backdrop-blur-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 flex items-center">
                  <MapPin className="w-4 h-4 mr-2 text-purple-500" />
                  Room
                </label>
                <select
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 bg-white/80 backdrop-blur-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 font-medium text-gray-700"
                  value={formData.roomId}
                  onChange={(e) => setFormData({ ...formData, roomId: e.target.value })}
                >
                  <option value="">Select Room</option>
                  {availableRooms.map((room) => (
                    <option key={room._id} value={room._id}>
                      Room {room.roomNumber} - {room.type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 flex items-center">
                  <User className="w-4 h-4 mr-2 text-indigo-500" />
                  Assign To
                </label>
                <select
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 bg-white/80 backdrop-blur-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 font-medium text-gray-700"
                  value={formData.assignedToUserId}
                  onChange={(e) => setFormData({ ...formData, assignedToUserId: e.target.value })}
                >
                  <option value="">Unassigned</option>
                  {availableStaff.map((staff) => (
                    <option key={staff._id} value={staff._id}>
                      {staff.name} - {staff.department || 'Staff'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 flex items-center">
                <Clock className="w-4 h-4 mr-2 text-blue-500" />
                Estimated Duration (minutes)
              </label>
              <Input
                type="number"
                min="15"
                max="480"
                required
                value={formData.estimatedDuration}
                onChange={(e) => setFormData({ ...formData, estimatedDuration: parseInt(e.target.value) || 60 })}
                placeholder="e.g., 60 (1 hour)"
                className="border-2 border-gray-200 rounded-xl px-4 py-3 bg-white/80 backdrop-blur-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 font-medium"
              />
              <span className="text-xs font-medium text-gray-500 bg-blue-50 px-3 py-1 rounded-lg inline-block">
                Between 15 minutes and 8 hours
              </span>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 flex items-center">
                <Settings className="w-4 h-4 mr-2 text-green-500" />
                Materials Needed
              </label>
              <Input
                type="text"
                value={formData.materialsText || ''}
                onChange={(e) => setFormData({ ...formData, materialsText: e.target.value })}
                placeholder="Enter materials (comma-separated, e.g., Spare parts, Tools)"
                className="border-2 border-gray-200 rounded-xl px-4 py-3 bg-white/80 backdrop-blur-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 font-medium"
              />
              <span className="text-xs font-medium text-gray-500 bg-green-50 px-3 py-1 rounded-lg inline-block">
                Optional: List materials needed for this task
              </span>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 flex items-center">
                <Edit className="w-4 h-4 mr-2 text-purple-500" />
                Notes
              </label>
              <textarea
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 h-20 resize-none bg-white/80 backdrop-blur-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 font-medium"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes (optional)"
              />
            </div>

            <div className="flex items-center space-x-3 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl border-2 border-yellow-200">
              <input
                type="checkbox"
                id="vendorRequired"
                checked={formData.vendorRequired || false}
                onChange={(e) => setFormData({ ...formData, vendorRequired: e.target.checked })}
                className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded-lg transition-all duration-200"
              />
              <label htmlFor="vendorRequired" className="text-sm font-semibold text-gray-700 flex items-center">
                <Zap className="w-4 h-4 mr-2 text-orange-500" />
                External vendor required
              </label>
            </div>

            <div className="flex items-center justify-end space-x-4 pt-6 border-t-2 border-gray-100">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowCreateModal(false)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 border-0 rounded-xl px-6 py-3 font-semibold transition-all duration-200 hover:shadow-lg"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updating}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 rounded-xl px-6 py-3 font-semibold"
              >
                {updating ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Create Task
                  </>
                )}
              </Button>
            </div>
        </form>
      </Modal>

        {/* View Task Modal */}
        {selectedTask && (
          <Modal
            isOpen={showViewModal}
            onClose={() => setShowViewModal(false)}
            title={
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl">
                  <Eye className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                  Task Details
                </span>
              </div>
            }
          >
            <div className="space-y-6 p-1">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-xl border-2 border-blue-100">
                <h3 className="text-xl font-bold text-gray-900 mb-2">{selectedTask.title}</h3>
                <p className="text-gray-600 leading-relaxed">{selectedTask.description}</p>
              </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Maintenance Type</label>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 ${getTaskTypeColor(selectedTask.type)}`}>
                  {selectedTask.type.replace('_', ' ')}
                </span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Category</label>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 ${getTaskTypeColor(selectedTask.category)}`}>
                  {selectedTask.category.replace('_', ' ')}
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Priority</label>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 ${getPriorityColor(selectedTask.priority)}`}>
                  {selectedTask.priority}
                </span>
              </div>
              {selectedTask.estimatedCost && selectedTask.estimatedCost > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Estimated Cost</label>
                  <div className="mt-1 text-sm text-gray-900">{formatCurrency(selectedTask.estimatedCost)}</div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Room</label>
                <div className="mt-1">
                  {selectedTask.roomId ? (
                    <>
                      <div className="font-medium">{selectedTask.roomId.roomNumber || 'Unknown Room'}</div>
                      <div className="text-sm text-gray-500">{selectedTask.roomId.type || 'Unknown Type'}</div>
                    </>
                  ) : (
                    <div className="text-gray-400">No room assigned</div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <div className="mt-1">
                  <StatusBadge
                    status={selectedTask.status}
                  />
                </div>
              </div>
            </div>

            {selectedTask.assignedToUserId && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Assigned To</label>
                <div className="mt-1">
                  <div className="font-medium">{selectedTask.assignedToUserId.name || 'Unknown User'}</div>
                  <div className="text-sm text-gray-500">{selectedTask.assignedToUserId.email || ''}</div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Estimated Duration</label>
                <div className="mt-1 text-sm text-gray-900">{formatDuration(selectedTask.estimatedDuration)}</div>
              </div>
              {selectedTask.actualDuration && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Actual Duration</label>
                  <div className="mt-1 text-sm text-gray-900">{formatDuration(selectedTask.actualDuration)}</div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Created</label>
                <div className="mt-1 text-sm text-gray-900">
                  {selectedTask.createdAt ? format(parseISO(selectedTask.createdAt), 'MMM dd, yyyy HH:mm') : 'N/A'}
                </div>
              </div>
              {selectedTask.completedAt && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Completed</label>
                  <div className="mt-1 text-sm text-gray-900">
                    {format(parseISO(selectedTask.completedAt), 'MMM dd, yyyy HH:mm')}
                  </div>
                </div>
              )}
            </div>

            {selectedTask.notes && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Notes</label>
                <div className="mt-1 text-sm text-gray-900 bg-gray-50 p-3 rounded-md">
                  {selectedTask.notes}
                </div>
              </div>
            )}

            {selectedTask.materials && selectedTask.materials.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Materials</label>
                <div className="mt-1 bg-gray-50 p-3 rounded-md">
                  {selectedTask.materials.map((material, index) => (
                    <div key={`selectedTask-materials-${index}-${material.name}`} className="text-sm text-gray-900 flex justify-between items-center py-1">
                      <span>{material.name} (Qty: {material.quantity})</span>
                      {material.unitCost && material.unitCost > 0 && (
                        <span className="text-gray-600">₹{material.unitCost}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedTask.vendorRequired && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Vendor Status</label>
                <div className="mt-1">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    External vendor required
                  </span>
                </div>
              </div>
            )}

            {selectedTask.vendor && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Vendor Information</label>
                <div className="mt-1 bg-gray-50 p-3 rounded-md">
                  <div className="text-sm text-gray-900">
                    <div className="font-medium">{selectedTask.vendor.name}</div>
                    {selectedTask.vendor.contact && (
                      <div className="text-gray-600">{selectedTask.vendor.contact}</div>
                    )}
                    {selectedTask.vendor.cost && selectedTask.vendor.cost > 0 && (
                      <div className="text-green-600 font-medium">₹{selectedTask.vendor.cost}</div>
                    )}
                  </div>
                </div>
              </div>
            )}

              <div className="flex items-center justify-end space-x-4 pt-6 border-t-2 border-gray-100">
                <Button
                  variant="secondary"
                  onClick={() => setShowViewModal(false)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 border-0 rounded-xl px-6 py-3 font-semibold transition-all duration-200 hover:shadow-lg"
                >
                  Close
                </Button>
                {selectedTask.status !== 'completed' && selectedTask.status !== 'cancelled' && (
                  <Button
                    onClick={() => {
                      const nextStatus = selectedTask.status === 'pending' ? 'assigned' :
                                       selectedTask.status === 'assigned' ? 'in_progress' :
                                       selectedTask.status === 'on_hold' ? 'in_progress' : 'completed';
                      handleStatusUpdate(selectedTask._id, nextStatus as 'assigned' | 'in_progress' | 'completed' | 'cancelled');
                      setShowViewModal(false);
                    }}
                    disabled={updating}
                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 rounded-xl px-6 py-3 font-semibold"
                  >
                    {selectedTask.status === 'pending' && 'Assign Task'}
                    {selectedTask.status === 'assigned' && 'Start Task'}
                    {selectedTask.status === 'in_progress' && 'Complete Task'}
                    {selectedTask.status === 'on_hold' && 'Resume Task'}
                  </Button>
                )}
              </div>
            </div>
          </Modal>
        )}
      </div>
    </div>
    </ErrorBoundary>
  );
}
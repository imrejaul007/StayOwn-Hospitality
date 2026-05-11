import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import {
  Wrench,
  Clock,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  Wifi,
  WifiOff,
  Plus,
  User,
  Calendar,
  Flag,
  DollarSign
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  maintenanceService,
  MaintenanceTask,
  MaintenancePaginatedResponse,
  MaintenanceStats
} from '../../services/maintenanceService';
import { useRealTime } from '../../services/realTimeService';
import { toast } from 'react-hot-toast';
import { api } from '../../services/api';
import { withErrorBoundary } from '../../components/ErrorBoundary';

const PAGE_LIMIT = 20;

interface StaffMember {
  _id: string;
  name: string;
  email: string;
  role: string;
  department?: string;
}

interface AvailableRoom {
  _id: string;
  roomNumber: string;
  type: string;
  floor: string;
}

function FrontDeskMaintenance() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<MaintenanceTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');

  // Stats
  const [stats, setStats] = useState<MaintenanceStats | null>(null);

  // Create task modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [roomList, setRoomList] = useState<AvailableRoom[]>([]);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    type: 'other' as string,
    priority: 'medium' as string,
    category: 'corrective' as string,
    roomId: '',
    assignedTo: '',
    estimatedDuration: '',
    estimatedCost: '',
    dueDate: '',
    roomOutOfOrder: false
  });

  // Assign modal
  const [assigningTask, setAssigningTask] = useState<MaintenanceTask | null>(null);
  const [assignTo, setAssignTo] = useState('');
  const [assigning, setAssigning] = useState(false);

  const { connect, on, off, isConnected } = useRealTime();
  const fetchTasksRef = useRef<(() => Promise<void>) | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res: MaintenancePaginatedResponse = await maintenanceService.getTasks({
        status: statusFilter || undefined,
        type: typeFilter || undefined,
        priority: priorityFilter || undefined,
        page,
        limit: PAGE_LIMIT
      });
      setTasks(res.data?.tasks || []);
      setTotalPages(res.data?.pagination?.pages ?? 1);
      setTotalCount(res.data?.pagination?.total ?? 0);
    } catch {
      setError('Unable to load maintenance tasks.');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, typeFilter, priorityFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await maintenanceService.getStats();
      setStats(res.data || null);
    } catch {
      // Stats are supplementary
    }
  }, []);

  const fetchStaffAndRooms = useCallback(async () => {
    try {
      const [staffRes, roomRes] = await Promise.all([
        api.get('/maintenance/available-staff'),
        api.get('/maintenance/available-rooms')
      ]);
      setStaffList(staffRes.data?.data || []);
      setRoomList(roomRes.data?.data || []);
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);
  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchTasksRef.current = fetchTasks; }, [fetchTasks]);

  // Real-time
  useEffect(() => { connect().catch(() => {}); }, [connect]);
  useEffect(() => {
    if (!isConnected) return;
    const refresh = () => {
      fetchTasksRef.current?.();
      fetchStats();
    };
    on('maintenance:created', refresh);
    on('maintenance:updated', refresh);
    on('maintenance:status_changed', refresh);
    return () => {
      off('maintenance:created', refresh);
      off('maintenance:updated', refresh);
      off('maintenance:status_changed', refresh);
    };
  }, [isConnected, on, off, fetchStats]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [statusFilter, typeFilter, priorityFilter]);

  const handleCreateTask = async () => {
    if (!newTask.title.trim() || !newTask.type || !newTask.priority) {
      toast.error('Title, type, and priority are required.');
      return;
    }
    try {
      setCreating(true);
      const payload: Record<string, unknown> = {
        title: newTask.title.trim(),
        description: newTask.description.trim(),
        type: newTask.type,
        priority: newTask.priority,
        category: newTask.category
      };
      if (newTask.roomId) payload.roomId = newTask.roomId;
      if (newTask.assignedTo) payload.assignedTo = newTask.assignedTo;
      if (newTask.estimatedDuration) payload.estimatedDuration = Number(newTask.estimatedDuration);
      if (newTask.estimatedCost) payload.estimatedCost = Number(newTask.estimatedCost);
      if (newTask.dueDate) payload.dueDate = newTask.dueDate;
      if (newTask.roomOutOfOrder) payload.roomOutOfOrder = true;

      await maintenanceService.createTask(payload as Parameters<typeof maintenanceService.createTask>[0]);
      toast.success('Maintenance task created successfully!');
      setShowCreateModal(false);
      setNewTask({
        title: '', description: '', type: 'other', priority: 'medium', category: 'corrective',
        roomId: '', assignedTo: '', estimatedDuration: '', estimatedCost: '', dueDate: '', roomOutOfOrder: false
      });
      fetchTasks();
      fetchStats();
    } catch {
      toast.error('Failed to create task.');
    } finally {
      setCreating(false);
    }
  };

  const handleAssignTask = async () => {
    if (!assigningTask || !assignTo) {
      toast.error('Select a staff member.');
      return;
    }
    try {
      setAssigning(true);
      await maintenanceService.assignTask(assigningTask._id, { assignedTo: assignTo });
      toast.success('Task assigned successfully!');
      setAssigningTask(null);
      setAssignTo('');
      fetchTasks();
      fetchStats();
    } catch {
      toast.error('Failed to assign task.');
    } finally {
      setAssigning(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-gray-100 text-gray-800',
      assigned: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
      on_hold: 'bg-orange-100 text-orange-800'
    };
    return <Badge className={styles[status] || 'bg-gray-100 text-gray-800'}>{status.replace('_', ' ')}</Badge>;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'emergency': return 'border-l-4 border-l-red-600 bg-red-50';
      case 'urgent': return 'border-l-4 border-l-red-400 bg-red-50';
      case 'high': return 'border-l-4 border-l-orange-400 bg-orange-50';
      case 'medium': return 'border-l-4 border-l-yellow-400 bg-yellow-50';
      case 'low': return 'border-l-4 border-l-green-400 bg-green-50';
      default: return 'border-l-4 border-l-gray-300';
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  };

  if (loading && tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (error && tasks.length === 0) {
    return (
      <div className="p-6 max-w-7xl mx-auto text-center py-12">
        <AlertTriangle className="mx-auto h-8 w-8 text-red-500 mb-3" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Unable to Load Tasks</h3>
        <p className="text-gray-600 mb-4">{error}</p>
        <Button onClick={fetchTasks}><RefreshCw className="h-4 w-4 mr-2" />Try Again</Button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Maintenance Management</h1>
          <p className="text-gray-600">Create, assign, and track maintenance tasks hotel-wide</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className={`flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {isConnected ? <><Wifi className="w-3 h-3 mr-1" /> Live</> : <><WifiOff className="w-3 h-3 mr-1" /> Offline</>}
          </div>
          <Button onClick={() => { fetchStaffAndRooms(); setShowCreateModal(true); }} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Create Task
          </Button>
          <Button onClick={() => { fetchTasks(); fetchStats(); }} variant="secondary" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
          <Card className="p-3"><div className="text-xs text-gray-500">Total</div><div className="text-lg font-bold">{stats.total ?? 0}</div></Card>
          <Card className="p-3"><div className="text-xs text-gray-500">Pending</div><div className="text-lg font-bold text-orange-600">{stats.pending ?? 0}</div></Card>
          <Card className="p-3"><div className="text-xs text-gray-500">In Progress</div><div className="text-lg font-bold text-blue-600">{stats.inProgress ?? 0}</div></Card>
          <Card className="p-3"><div className="text-xs text-gray-500">Completed</div><div className="text-lg font-bold text-green-600">{stats.completed ?? 0}</div></Card>
          <Card className="p-3"><div className="text-xs text-gray-500">Overdue</div><div className="text-lg font-bold text-red-600">{stats.overdueCount ?? 0}</div></Card>
          <Card className="p-3"><div className="text-xs text-gray-500">Avg Duration</div><div className="text-lg font-bold">{stats.avgDuration ? `${Math.round(stats.avgDuration)} min` : 'N/A'}</div></Card>
        </div>
      )}

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Filters:</span>
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 px-3 rounded-md border border-gray-200 text-sm">
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="on_hold">On Hold</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-9 px-3 rounded-md border border-gray-200 text-sm">
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
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="h-9 px-3 rounded-md border border-gray-200 text-sm">
              <option value="">All Priorities</option>
              <option value="emergency">Emergency</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Task List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Wrench className="h-5 w-5 mr-2 text-blue-600" />
            Maintenance Tasks ({totalCount})
            {loading && <RefreshCw className="w-4 h-4 ml-2 animate-spin text-gray-400" />}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No tasks match the current filters.</p>
          ) : (
            <div className="space-y-3">
              {tasks.map(task => (
                <div key={task._id} className={`p-4 rounded-lg ${getPriorityColor(task.priority)} flex items-center justify-between`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Wrench className="w-4 h-4 text-gray-500" />
                      <span className="font-medium">{task.title}</span>
                      {getStatusBadge(task.status)}
                      <Badge variant="secondary" className="text-xs">{task.type}</Badge>
                      <Badge variant="secondary" className="text-xs capitalize">{task.priority}</Badge>
                      {task.category && <Badge variant="secondary" className="text-xs">{task.category}</Badge>}
                    </div>
                    {task.description && <p className="text-sm text-gray-600 mb-1">{task.description}</p>}
                    <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                      {task.roomId && (
                        <span className="flex items-center"><User className="w-3 h-3 mr-1" />Room {task.roomId.roomNumber}</span>
                      )}
                      <span className="flex items-center">
                        <User className="w-3 h-3 mr-1" />
                        {task.assignedTo?.name || 'Unassigned'}
                      </span>
                      {task.reportedBy && (
                        <span>Reported by: {task.reportedBy.name}</span>
                      )}
                      {task.dueDate && (
                        <span className="flex items-center">
                          <Calendar className="w-3 h-3 mr-1" />
                          Due: {new Date(task.dueDate).toLocaleDateString()}
                        </span>
                      )}
                      {task.startedDate && (
                        <span>Started: {new Date(task.startedDate).toLocaleString()}</span>
                      )}
                      {task.completedDate && (
                        <span>Completed: {new Date(task.completedDate).toLocaleString()}</span>
                      )}
                      {task.actualDuration != null && (
                        <span className="flex items-center"><Clock className="w-3 h-3 mr-1" />{task.actualDuration} min</span>
                      )}
                      {task.actualCost != null && task.actualCost > 0 && (
                        <span className="flex items-center"><DollarSign className="w-3 h-3 mr-1" />${task.actualCost.toFixed(2)}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="ml-4 flex flex-col gap-1">
                    {(task.status === 'pending' || (task.status === 'assigned' && !task.assignedTo)) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          fetchStaffAndRooms();
                          setAssigningTask(task);
                          setAssignTo('');
                        }}
                        className="text-blue-600 border-blue-300 hover:bg-blue-50"
                      >
                        <User className="w-3 h-3 mr-1" />
                        Assign
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-6 pt-4 border-t">
              <Button variant="outline" size="sm" onClick={() => handlePageChange(page - 1)} disabled={page <= 1 || loading}>
                <ChevronLeft className="w-4 h-4 mr-1" />Previous
              </Button>
              <span className="text-sm text-gray-600">Page {page} of {totalPages} ({totalCount} total)</span>
              <Button variant="outline" size="sm" onClick={() => handlePageChange(page + 1)} disabled={page >= totalPages || loading}>
                Next<ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4">Create Maintenance Task</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <Input value={newTask.title} onChange={(e) => setNewTask(t => ({ ...t, title: e.target.value }))} placeholder="Brief description of the issue" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={newTask.description} onChange={(e) => setNewTask(t => ({ ...t, description: e.target.value }))} className="w-full border rounded-md p-2 text-sm h-20" placeholder="Detailed description..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                  <select value={newTask.type} onChange={(e) => setNewTask(t => ({ ...t, type: e.target.value }))} className="w-full h-9 px-3 rounded-md border border-gray-200 text-sm">
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority *</label>
                  <select value={newTask.priority} onChange={(e) => setNewTask(t => ({ ...t, priority: e.target.value }))} className="w-full h-9 px-3 rounded-md border border-gray-200 text-sm">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select value={newTask.category} onChange={(e) => setNewTask(t => ({ ...t, category: e.target.value }))} className="w-full h-9 px-3 rounded-md border border-gray-200 text-sm">
                    <option value="corrective">Corrective</option>
                    <option value="preventive">Preventive</option>
                    <option value="emergency">Emergency</option>
                    <option value="inspection">Inspection</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Room</label>
                  <select value={newTask.roomId} onChange={(e) => setNewTask(t => ({ ...t, roomId: e.target.value }))} className="w-full h-9 px-3 rounded-md border border-gray-200 text-sm">
                    <option value="">No room / General</option>
                    {roomList.map(r => (
                      <option key={r._id} value={r._id}>Room {r.roomNumber} ({r.type})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assign To</label>
                  <select value={newTask.assignedTo} onChange={(e) => setNewTask(t => ({ ...t, assignedTo: e.target.value }))} className="w-full h-9 px-3 rounded-md border border-gray-200 text-sm">
                    <option value="">Unassigned</option>
                    {staffList.map(s => (
                      <option key={s._id} value={s._id}>{s.name} ({s.role})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                  <Input type="date" value={newTask.dueDate} onChange={(e) => setNewTask(t => ({ ...t, dueDate: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Est. Duration (min)</label>
                  <Input type="number" min="0" value={newTask.estimatedDuration} onChange={(e) => setNewTask(t => ({ ...t, estimatedDuration: e.target.value }))} placeholder="Minutes" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Est. Cost ($)</label>
                  <Input type="number" min="0" step="0.01" value={newTask.estimatedCost} onChange={(e) => setNewTask(t => ({ ...t, estimatedCost: e.target.value }))} placeholder="0.00" />
                </div>
              </div>
              {newTask.roomId && (
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="roomOutOfOrder" checked={newTask.roomOutOfOrder} onChange={(e) => setNewTask(t => ({ ...t, roomOutOfOrder: e.target.checked }))} />
                  <label htmlFor="roomOutOfOrder" className="text-sm text-gray-700">Take room out of order</label>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowCreateModal(false)} disabled={creating}>Cancel</Button>
              <Button onClick={handleCreateTask} disabled={creating}>
                {creating ? 'Creating...' : 'Create Task'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {assigningTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-semibold mb-4">Assign Task</h2>
            <p className="text-sm text-gray-600 mb-3">
              Task: <strong>{assigningTask.title}</strong>
            </p>
            {assigningTask.roomId && (
              <p className="text-sm text-gray-600 mb-3">
                Room: <strong>{assigningTask.roomId.roomNumber}</strong>
              </p>
            )}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Assign to Staff Member</label>
              <select value={assignTo} onChange={(e) => setAssignTo(e.target.value)} className="w-full h-9 px-3 rounded-md border border-gray-200 text-sm">
                <option value="">Select staff member...</option>
                {staffList.map(s => (
                  <option key={s._id} value={s._id}>{s.name} ({s.role})</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setAssigningTask(null)} disabled={assigning}>Cancel</Button>
              <Button onClick={handleAssignTask} disabled={assigning || !assignTo}>
                {assigning ? 'Assigning...' : 'Assign'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default withErrorBoundary(FrontDeskMaintenance);

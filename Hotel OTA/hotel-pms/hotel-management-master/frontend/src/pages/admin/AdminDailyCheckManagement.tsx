import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ClipboardList,
  Users,
  Settings,
  Plus,
  UserCheck,
  Calendar,
  CheckCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  Search,
  Edit,
} from 'lucide-react';
import { LoadingSpinner } from '../../components/LoadingSpinner';
import { dailyRoutineCheckService } from '../../services/dailyRoutineCheckService';
import { useRealTime } from '../../services/realTimeService';
import { api } from '../../services/api';
import { TemplateEditModal } from '../../components/admin/TemplateEditModal';
import toast from 'react-hot-toast';
import { useProperty } from '../../context/PropertyContext';
import { useAuth } from '../../context/AuthContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import { withErrorBoundary } from '../../components/ErrorBoundary';

interface Staff {
  _id: string;
  name: string;
  email: string;
  role: string;
}

interface Room {
  _id: string;
  roomNumber: string;
  type: string;
  floor: string;
}

interface AssignmentSummary {
  staff: Staff;
  totalAssigned: number;
  completed: number;
  pending: number;
  rooms: Array<{
    roomNumber: string;
    type: string;
    status: string;
    checkedAt: string | null;
  }>;
}

interface AdminOverview {
  totalRooms: number;
  assignedRooms: number;
  pendingChecks: number;
  completedToday: number;
  overdueChecks: number;
  assignmentSummary: AssignmentSummary[];
  unassignedRooms: number;
}

interface Assignment {
  roomId: string;
  staffId: string;
}

// Templates Management Component
const TemplatesManagement = () => {
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [editingRoomType, setEditingRoomType] = useState(null);
  const [selectedRoomType, setSelectedRoomType] = useState('single');

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const response = await dailyRoutineCheckService.getInventoryTemplates();
      setTemplates(response.data?.templates || []);
    } catch (error) {
      toast.error('Failed to load templates');
    } finally {
      setLoadingTemplates(false);
    }
  };

  const roomTypes = [
    { value: 'single', label: 'Single Room', color: 'bg-blue-100 text-blue-800' },
    { value: 'double', label: 'Double Room', color: 'bg-green-100 text-green-800' },
    { value: 'deluxe', label: 'Deluxe Room', color: 'bg-purple-100 text-purple-800' },
    { value: 'suite', label: 'Suite', color: 'bg-amber-100 text-amber-800' }
  ];

  const selectedTemplate = templates.find(t => t.roomType === selectedRoomType);

  if (loadingTemplates) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Daily Check Templates</h2>
          <p className="text-sm text-gray-600 mt-1">
            Manage inventory templates for different room types. Each template defines the standard items to check during daily room inspections.
          </p>
        </div>
        <Button
          onClick={() => setEditingRoomType(selectedRoomType)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Edit className="w-4 h-4 mr-2" />
          {selectedTemplate ? 'Edit Template' : 'Create Template'}
        </Button>
      </div>

      {/* Room Type Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select Room Type</CardTitle>
          <p className="text-sm text-gray-600">Choose a room type to view or edit its daily check template</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {roomTypes.map(roomType => {
              const template = templates.find(t => t.roomType === roomType.value);
              const isSelected = selectedRoomType === roomType.value;

              return (
                <button
                  key={roomType.value}
                  onClick={() => setSelectedRoomType(roomType.value)}
                  className={`p-4 border rounded-lg text-left transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Badge className={roomType.color}>
                      {roomType.label}
                    </Badge>
                    {template ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    {template
                      ? `${template.fixedInventory?.length || 0} fixed + ${template.dailyInventory?.length || 0} daily items`
                      : 'No template configured'
                    }
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Est. {template?.estimatedCheckDuration || 15} minutes
                  </p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Template Details */}
      {selectedTemplate ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Fixed Inventory */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-gray-600" />
                  Fixed Inventory
                </CardTitle>
                <Badge variant="outline">
                  {selectedTemplate.fixedInventory?.length || 0} items
                </Badge>
              </div>
              <p className="text-sm text-gray-600">
                Permanent items that remain in the room (furniture, appliances, fixtures)
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {selectedTemplate.fixedInventory?.map((item, index) => (
                  <div key={`-${index}-${item.name}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <h4 className="font-medium">{item.name}</h4>
                      <p className="text-sm text-gray-600 capitalize">{item.category}</p>
                      <p className="text-xs text-gray-500">{item.description}</p>
                    </div>
                    <div className="text-right">
                      <Badge className="bg-blue-100 text-blue-800">
                        {item.expectedCondition}
                      </Badge>
                      {item.unitPrice > 0 && (
                        <p className="text-xs text-gray-500 mt-1">₹{item.unitPrice}</p>
                      )}
                    </div>
                  </div>
                )) || (
                  <div className="text-center py-8">
                    <Settings className="mx-auto h-8 w-8 text-gray-400 mb-3" />
                    <p className="text-gray-500">No fixed inventory items configured</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Daily Inventory */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-gray-600" />
                  Daily Inventory
                </CardTitle>
                <Badge variant="outline">
                  {selectedTemplate.dailyInventory?.length || 0} items
                </Badge>
              </div>
              <p className="text-sm text-gray-600">
                Daily consumables and amenities that need regular replenishment
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {selectedTemplate.dailyInventory?.map((item, index) => (
                  <div key={`-${index}-${item.name}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <h4 className="font-medium">{item.name}</h4>
                      <p className="text-sm text-gray-600 capitalize">{item.category}</p>
                      <p className="text-xs text-gray-500">{item.description}</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-green-100 text-green-800">
                          Qty: {item.standardQuantity}
                        </Badge>
                        <Badge className="bg-yellow-100 text-yellow-800">
                          {item.expectedCondition}
                        </Badge>
                      </div>
                      {item.unitPrice > 0 && (
                        <p className="text-xs text-gray-500 mt-1">₹{item.unitPrice} each</p>
                      )}
                    </div>
                  </div>
                )) || (
                  <div className="text-center py-8">
                    <Calendar className="mx-auto h-8 w-8 text-gray-400 mb-3" />
                    <p className="text-gray-500">No daily inventory items configured</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* No Template Found */
        <Card>
          <CardContent className="p-8">
            <div className="text-center">
              <AlertTriangle className="mx-auto h-12 w-12 text-amber-500 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Template Found</h3>
              <p className="text-gray-500 mb-6">
                No daily check template exists for {roomTypes.find(rt => rt.value === selectedRoomType)?.label} rooms.
              </p>
              <Button
                onClick={() => setEditingRoomType(selectedRoomType)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Template
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Template Summary */}
      {selectedTemplate && (
        <Card>
          <CardHeader>
            <CardTitle>Template Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {(selectedTemplate.fixedInventory?.length || 0) + (selectedTemplate.dailyInventory?.length || 0)}
                </div>
                <div className="text-sm text-gray-600">Total Items</div>
              </div>

              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {selectedTemplate.fixedInventory?.length || 0}
                </div>
                <div className="text-sm text-gray-600">Fixed Items</div>
              </div>

              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">
                  {selectedTemplate.dailyInventory?.length || 0}
                </div>
                <div className="text-sm text-gray-600">Daily Items</div>
              </div>

              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {selectedTemplate.estimatedCheckDuration || 15}
                </div>
                <div className="text-sm text-gray-600">Minutes</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Template Editing Modal */}
      <TemplateEditModal
        isOpen={!!editingRoomType}
        onClose={() => setEditingRoomType(null)}
        roomType={editingRoomType}
        onSave={() => {
          setEditingRoomType(null);
          fetchTemplates();
          toast.success('Template saved successfully!');
        }}
      />
    </div>
  );
};

function AdminDailyCheckManagement() {
  const { selectedPropertyId } = useProperty();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'manager';
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [unassignedRooms, setUnassignedRooms] = useState<Room[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignmentMode, setAssignmentMode] = useState(false);
  const [selectedAssignments, setSelectedAssignments] = useState<Assignment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [activeTab, setActiveTab] = useState<'overview' | 'assignments' | 'templates'>('overview');

  // Real-time connection
  const { connectionState, connect, on, off, isConnected } = useRealTime();

  const fetchData = useCallback(async (showLoading = true) => {
    if (!selectedPropertyId) return;

    try {
      if (showLoading) setLoading(true);
      const [overviewRes, unassignedRes, staffRes] = await Promise.allSettled([
        api.get(`/daily-routine-check/admin/overview`, { params: { hotelId: selectedPropertyId } }),
        api.get(`/daily-routine-check/admin/unassigned-rooms`, { params: { hotelId: selectedPropertyId } }),
        api.get(`/admin/users`, { params: { role: 'staff', hotelId: selectedPropertyId, limit: 100 } })
      ]);

      if (overviewRes.status === 'fulfilled') {
        setOverview(overviewRes.value.data.data);
      }
      if (unassignedRes.status === 'fulfilled') {
        setUnassignedRooms(unassignedRes.value.data.data?.rooms || []);
      }
      if (staffRes.status === 'fulfilled') {
        setStaff(staffRes.value.data.data?.users || []);
      }

      const failures = [overviewRes, unassignedRes, staffRes].filter(r => r.status === 'rejected');
      if (failures.length > 0 && showLoading) {
        toast.error('Some data failed to load. Try refreshing.');
      }
    } catch (error) {
      if (showLoading) toast.error('Failed to load daily check management data');
    } finally {
      setLoading(false);
    }
  }, [selectedPropertyId]);

  useEffect(() => {
    if (selectedPropertyId) {
      fetchData();
    }

    // Connect to real-time updates
    // Do NOT disconnect on unmount — realTimeService is a singleton shared across components
    connect().catch(() => { /* Error handled silently */ });
  }, [selectedPropertyId, fetchData, connect]);

  // Set up real-time event listeners
  useEffect(() => {
    if (!isConnected) return;

    const handleDailyCheckUpdate = () => {
      fetchData(false);
      toast.success('Daily check data updated in real-time');
    };

    const handleDailyCheckCreate = () => {
      fetchData(false);
      toast.success('New daily check assignment created');
    };

    const handleDailyCheckComplete = (data: Record<string, unknown>) => {
      fetchData(false);
      toast.success(`Room ${data?.roomNumber ?? ''} daily check completed!`);
    };

    // Subscribe to both legacy and backend event namespaces for compatibility.
    const assignmentEvents = ['daily-check:assigned', 'daily-routine-check:assigned'];
    const completionEvents = ['daily-check:completed', 'daily-routine-check:completed'];
    const statusEvents = [
      'daily-check:status_changed',
      'daily-routine-check:status_changed',
      'daily-routine-check:status_updated'
    ];
    assignmentEvents.forEach((eventName) => on(eventName, handleDailyCheckCreate));
    completionEvents.forEach((eventName) => on(eventName, handleDailyCheckComplete));
    statusEvents.forEach((eventName) => on(eventName, handleDailyCheckUpdate));

    return () => {
      assignmentEvents.forEach((eventName) => off(eventName, handleDailyCheckCreate));
      completionEvents.forEach((eventName) => off(eventName, handleDailyCheckComplete));
      statusEvents.forEach((eventName) => off(eventName, handleDailyCheckUpdate));
    };
  }, [isConnected, on, off, fetchData]);

  const handleAssignRooms = async () => {
    if (selectedAssignments.length === 0) {
      toast.error('Please select at least one room-staff assignment');
      return;
    }

    try {
      await dailyRoutineCheckService.assignDailyChecks(selectedAssignments);
      toast.success(`Successfully assigned ${selectedAssignments.length} rooms`);
      setSelectedAssignments([]);
      setAssignmentMode(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to assign rooms to staff');
    }
  };

  const addAssignment = (roomId: string, staffId: string) => {
    const existingIndex = selectedAssignments.findIndex(a => a.roomId === roomId);
    if (existingIndex >= 0) {
      // Update existing assignment
      const updated = [...selectedAssignments];
      updated[existingIndex].staffId = staffId;
      setSelectedAssignments(updated);
    } else {
      // Add new assignment
      setSelectedAssignments([...selectedAssignments, { roomId, staffId }]);
    }
  };

  const removeAssignment = (roomId: string) => {
    setSelectedAssignments(selectedAssignments.filter(a => a.roomId !== roomId));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Calculate filtered statistics based on current filter (memoized)
  const filteredStats = useMemo(() => {
    if (!overview?.assignmentSummary) return { assigned: 0, completed: 0, pending: 0, unassigned: 0 };

    let totalAssigned = 0;
    let totalCompleted = 0;
    let totalPending = 0;

    overview.assignmentSummary.forEach(summary => {
      summary.rooms.forEach(room => {
        if (filterStatus === 'all' || filterStatus === room.status ||
            (filterStatus === 'assigned' && (room.status === 'completed' || room.status === 'pending'))) {
          totalAssigned++;
          if (room.status === 'completed') totalCompleted++;
          if (room.status === 'pending') totalPending++;
        }
      });
    });

    return {
      assigned: filterStatus === 'all' ? (overview.assignedRooms ?? 0) : totalAssigned,
      completed: filterStatus === 'all' ? (overview.completedToday ?? 0) : totalCompleted,
      pending: filterStatus === 'all' ? (overview.pendingChecks ?? 0) : totalPending,
      unassigned: filterStatus === 'all' ? (overview.unassignedRooms ?? 0) :
                 (filterStatus === 'unassigned' ? (overview.unassignedRooms ?? 0) : 0)
    };
  }, [overview, filterStatus]);

  if (!selectedPropertyId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🏨</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Property Selected</h2>
          <p className="text-gray-600">Please select a property from the header to view daily check management.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Breadcrumb */}
      <PropertyBreadcrumb items={['Daily Check Management']} />

      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Daily Check Management</h1>
          <p className="text-gray-600">Manage daily routine checks, assignments, and templates</p>
        </div>
        <div className="flex items-center space-x-3">
          {/* Real-time connection status */}
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              connectionState === 'connected' ? 'bg-green-500' : 
              connectionState === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
            }`}></div>
            <span className="text-xs text-gray-500 capitalize">{connectionState}</span>
          </div>
          
          <Button onClick={fetchData} variant="secondary" size="sm" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6 border-b">
        <nav className="-mb-px flex space-x-8">
          {([
            { id: 'overview' as const, label: 'Overview', icon: ClipboardList },
            { id: 'assignments' as const, label: 'Room Assignments', icon: Users },
            ...(isAdmin ? [{ id: 'templates' as const, label: 'Templates', icon: Settings }] : [])
          ]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab - Error State */}
      {activeTab === 'overview' && !loading && !overview && (
        <Card>
          <CardContent className="p-8">
            <div className="text-center">
              <AlertTriangle className="mx-auto h-12 w-12 text-amber-500 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Unable to Load Overview</h3>
              <p className="text-gray-500 mb-6">
                Daily check data could not be loaded. Please try again.
              </p>
              <Button onClick={fetchData} variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overview Tab */}
      {activeTab === 'overview' && overview && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <ClipboardList className="w-6 h-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Rooms</p>
                  <p className="text-2xl font-semibold text-gray-900">{overview.totalRooms}</p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Completed Today</p>
                  <p className="text-2xl font-semibold text-gray-900">{overview.completedToday}</p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Clock className="w-6 h-6 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Pending Checks</p>
                  <p className="text-2xl font-semibold text-gray-900">{overview.pendingChecks}</p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Unassigned</p>
                  <p className="text-2xl font-semibold text-gray-900">{overview.unassignedRooms}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Staff Assignment Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  Staff Assignment Summary
                </span>
                <Button onClick={fetchData} variant="outline" size="sm">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {overview.assignmentSummary.length > 0 ? (
                  overview.assignmentSummary.map((summary, index) => (
                    <div key={`overview-assignmentSummary-${index}`} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-medium text-gray-900">{summary.staff.name}</h4>
                          <p className="text-sm text-gray-600">{summary.staff.email}</p>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant="outline">
                            {summary.totalAssigned} assigned
                          </Badge>
                          <Badge className="bg-green-100 text-green-800">
                            {summary.completed} completed
                          </Badge>
                          <Badge className="bg-yellow-100 text-yellow-800">
                            {summary.pending} pending
                          </Badge>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {summary.rooms.map((room, roomIndex) => (
                          <div key={roomIndex} className="text-xs p-2 bg-gray-50 rounded">
                            <div className="font-medium">Room {room.roomNumber}</div>
                            <div className="text-gray-600 capitalize">{room.type}</div>
                            <Badge 
                              size="sm" 
                              className={`mt-1 ${getStatusColor(room.status)}`}
                            >
                              {room.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <Users className="mx-auto h-8 w-8 text-gray-400 mb-3" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No assignments yet</h3>
                    <p className="text-gray-500">Use the Assignments tab to assign rooms to staff members</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Room Assignments Tab */}
      {activeTab === 'assignments' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Room Assignments</h2>
            <div className="flex gap-2">
              {assignmentMode ? (
                <>
                  <Button
                    onClick={() => {
                      setAssignmentMode(false);
                      setSelectedAssignments([]);
                    }}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAssignRooms}
                    disabled={selectedAssignments.length === 0}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <UserCheck className="w-4 h-4 mr-2" />
                    Assign {selectedAssignments.length} Rooms
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => {
                    setAssignmentMode(true);
                    // Auto-switch to unassigned filter when entering assignment mode
                    if (filterStatus !== 'all' && filterStatus !== 'unassigned') {
                      setFilterStatus('unassigned');
                    }
                  }}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Assign Rooms
                </Button>
              )}
            </div>
          </div>

          {/* Search and Filter */}
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search rooms..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Rooms</option>
              <option value="assigned">Assigned</option>
              <option value="unassigned">Unassigned</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          {/* Assignment Mode View */}
          {assignmentMode && (filterStatus === 'all' || filterStatus === 'unassigned') ? (
            <Card>
              <CardHeader>
                <CardTitle>Assign Rooms to Staff</CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Select staff members for unassigned rooms. Only rooms without current assignments are shown.
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {unassignedRooms
                    .filter(room => {
                      // Filter by search term
                      const matchesSearch = room.roomNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        room.type.toLowerCase().includes(searchTerm.toLowerCase());
                      return matchesSearch;
                    })
                    .map((room) => {
                      const assignment = selectedAssignments.find(a => a.roomId === room._id);
                      return (
                        <div key={room._id} className="border rounded-lg p-4 bg-yellow-50 border-yellow-200">
                          <div className="mb-3">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium">Room {room.roomNumber}</h4>
                              <Badge variant="outline" className="text-yellow-700 border-yellow-300">
                                Unassigned
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 capitalize">{room.type} • Floor {room.floor}</p>
                          </div>
                          <div className="space-y-2">
                            <select
                              value={assignment?.staffId || ''}
                              onChange={(e) => {
                                if (e.target.value) {
                                  addAssignment(room._id, e.target.value);
                                } else {
                                  removeAssignment(room._id);
                                }
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">Select staff member...</option>
                              {staff.map((member) => (
                                <option key={member._id} value={member._id}>
                                  {member.name} ({member.role})
                                </option>
                              ))}
                            </select>
                            {assignment && (
                              <Button
                                onClick={() => removeAssignment(room._id)}
                                variant="outline"
                                size="sm"
                                className="w-full text-red-600 hover:text-red-700"
                              >
                                Remove Assignment
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
                {unassignedRooms.length === 0 && (
                  <div className="text-center py-8">
                    <CheckCircle className="mx-auto h-8 w-8 text-green-500 mb-3" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">All Rooms Assigned</h3>
                    <p className="text-gray-500">All rooms have been assigned to staff members.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : assignmentMode && (filterStatus === 'assigned' || filterStatus === 'completed' || filterStatus === 'pending') ? (
            // Show message when trying to assign already assigned rooms
            <Card>
              <CardContent>
                <div className="text-center py-8">
                  <AlertTriangle className="mx-auto h-8 w-8 text-yellow-500 mb-3" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Cannot Assign {filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)} Rooms</h3>
                  <p className="text-gray-500 mb-4">
                    Assignment mode is only available for unassigned rooms.
                    {filterStatus === 'assigned' && ' These rooms already have staff assignments.'}
                    {filterStatus === 'completed' && ' These rooms have been completed and cannot be reassigned.'}
                    {filterStatus === 'pending' && ' These rooms are already assigned and pending completion.'}
                  </p>
                  <Button
                    onClick={() => setFilterStatus('unassigned')}
                    className="mr-2"
                  >
                    Show Unassigned Rooms
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setAssignmentMode(false)}
                  >
                    Exit Assignment Mode
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : filterStatus === 'unassigned' && !assignmentMode ? (
            /* Unassigned Rooms View */
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-orange-600" />
                      Unassigned Rooms ({unassignedRooms.length})
                    </span>
                    <Button
                      onClick={() => {
                        setAssignmentMode(true);
                        setFilterStatus('unassigned');
                      }}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Assign These Rooms
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {unassignedRooms.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {unassignedRooms
                        .filter(room =>
                          room.roomNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          room.type.toLowerCase().includes(searchTerm.toLowerCase())
                        )
                        .map((room) => (
                          <div key={room._id} className="border rounded-lg p-4 bg-orange-50 border-orange-200">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium text-gray-900">Room {room.roomNumber}</h4>
                              <Badge variant="outline" className="text-orange-700 border-orange-300">
                                Unassigned
                              </Badge>
                            </div>
                            <div className="text-sm text-gray-600 space-y-1">
                              <p><span className="font-medium">Type:</span> {room.type}</p>
                              <p><span className="font-medium">Floor:</span> {room.floor}</p>
                            </div>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <CheckCircle className="mx-auto h-8 w-8 text-green-500 mb-3" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">All Rooms Assigned</h3>
                      <p className="text-gray-500">All rooms have been assigned to staff members for today's checks.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            /* Current Assignments View */
            <div className="space-y-6">
              {/* Assignment Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="p-4">
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Users className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-600">Assigned</p>
                      <p className="text-xl font-semibold text-gray-900">
                        {filteredStats.assigned}
                      </p>
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
                      <p className="text-xl font-semibold text-gray-900">
                        {filteredStats.completed}
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center">
                    <div className="p-2 bg-yellow-100 rounded-lg">
                      <Clock className="w-5 h-5 text-yellow-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-600">Pending</p>
                      <p className="text-xl font-semibold text-gray-900">
                        {filteredStats.pending}
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center">
                    <div className="p-2 bg-red-100 rounded-lg">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-600">Unassigned</p>
                      <p className="text-xl font-semibold text-gray-900">
                        {filteredStats.unassigned}
                      </p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Room List with Assignment Status */}
              <Card>
                <CardHeader>
                  <CardTitle>All Rooms - Assignment Status</CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    Overview of all rooms with their current assignment and completion status.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Assigned Rooms */}
                    {overview?.assignmentSummary?.filter(summary => {
                      // Filter staff summaries based on current filter
                      if (filterStatus === 'all') return true;
                      if (filterStatus === 'assigned') return summary.rooms.length > 0;
                      // Only show staff that have rooms matching the filter
                      return summary.rooms.some(room => room.status === filterStatus);
                    }).map((summary, index) => (
                      <div key={`summary-${index}`} className="border rounded-lg p-4 bg-gray-50">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                              <span className="text-blue-600 font-semibold text-sm">
                                {(summary.staff.name || '?').split(' ').map(n => n[0] || '').join('').slice(0, 2)}
                              </span>
                            </div>
                            <div>
                              <h4 className="font-medium text-gray-900">{summary.staff.name}</h4>
                              <p className="text-sm text-gray-600">{summary.staff.email}</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Badge variant="outline" className="bg-blue-50">
                              {summary.totalAssigned} rooms
                            </Badge>
                            <Badge className="bg-green-100 text-green-800">
                              {summary.completed} completed
                            </Badge>
                            <Badge className="bg-yellow-100 text-yellow-800">
                              {summary.pending} pending
                            </Badge>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                          {summary.rooms
                            .filter(room => {
                              if (filterStatus === 'all') return true;
                              if (filterStatus === 'completed') return room.status === 'completed';
                              if (filterStatus === 'pending') return room.status === 'pending';
                              return true;
                            })
                            .filter(room =>
                              room.roomNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                              room.type.toLowerCase().includes(searchTerm.toLowerCase())
                            )
                            .map((room, roomIndex) => (
                            <div key={roomIndex} className="text-xs p-3 bg-white rounded border">
                              <div className="font-medium">Room {room.roomNumber}</div>
                              <div className="text-gray-600 capitalize">{room.type}</div>
                              <Badge
                                size="sm"
                                className={`mt-1 ${getStatusColor(room.status)}`}
                              >
                                {room.status}
                              </Badge>
                              {room.checkedAt && (
                                <div className="text-gray-500 text-xs mt-1">
                                  {new Date(room.checkedAt).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    {/* Unassigned Rooms Section */}
                    {overview && overview.unassignedRooms > 0 && (
                      <div className="border rounded-lg p-4 bg-red-50 border-red-200">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                              <AlertTriangle className="w-5 h-5 text-red-600" />
                            </div>
                            <div>
                              <h4 className="font-medium text-red-900">Unassigned Rooms</h4>
                              <p className="text-sm text-red-700">These rooms need staff assignment</p>
                            </div>
                          </div>
                          <Badge className="bg-red-100 text-red-800">
                            {overview.unassignedRooms} rooms
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => {
                              setAssignmentMode(true);
                              // Auto-switch to unassigned filter when entering assignment mode
                              if (filterStatus !== 'all' && filterStatus !== 'unassigned') {
                                setFilterStatus('unassigned');
                              }
                            }}
                            className="bg-red-600 hover:bg-red-700"
                            size="sm"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Assign These Rooms
                          </Button>
                        </div>
                      </div>
                    )}

                    {(!overview?.assignmentSummary || overview.assignmentSummary.length === 0) && (
                      <div className="text-center py-8">
                        <Users className="mx-auto h-8 w-8 text-gray-400 mb-3" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No Room Assignments</h3>
                        <p className="text-gray-500 mb-4">Start by assigning rooms to staff members</p>
                        <Button
                          onClick={() => setAssignmentMode(true)}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Assign Rooms
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Templates Tab - Admin/Manager only */}
      {activeTab === 'templates' && isAdmin && (
        <TemplatesManagement />
      )}
    </div>
  );
}

export default withErrorBoundary(AdminDailyCheckManagement, { level: 'page' });
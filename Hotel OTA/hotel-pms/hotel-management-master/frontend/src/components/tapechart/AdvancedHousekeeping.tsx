import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/utils/toast';
import {
  Bed, CheckCircle, Clock, Camera, AlertTriangle, Wrench,
  User, Star, Timer, Package, ClipboardCheck,
  Settings, Eye, RefreshCw, Award, Zap, Phone, Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { housekeepingService, HousekeepingTask } from '@/services/housekeepingService';

// Advanced Housekeeping Interfaces
interface InspectionTask {
  id: string;
  name: string;
  category: 'cleaning' | 'maintenance' | 'inventory' | 'amenity';
  required: boolean;
  completed: boolean;
  timeEstimate: number; // minutes
  notes?: string;
  photoRequired: boolean;
  photoTaken?: string;
}

interface RoomInspection {
  id: string;
  roomNumber: string;
  assignedStaff: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startTime?: string;
  completedTime?: string;
  estimatedDuration: number;
  actualDuration?: number;
  tasks: InspectionTask[];
  overallScore: number;
  issues: MaintenanceIssue[];
  inventory: InventoryItem[];
}

interface MaintenanceIssue {
  id: string;
  roomNumber: string;
  type: 'plumbing' | 'electrical' | 'hvac' | 'furniture' | 'other';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  description: string;
  reportedBy: string;
  reportedAt: string;
  assignedTo?: string;
  status: 'reported' | 'assigned' | 'in_progress' | 'completed';
  estimatedRepairTime?: number;
  photos: string[];
}

interface InventoryItem {
  id: string;
  name: string;
  category: 'linens' | 'amenities' | 'supplies' | 'minibar';
  currentStock: number;
  requiredStock: number;
  restockNeeded: boolean;
  lastRestocked?: string;
}

interface StaffPerformance {
  staffId: string;
  name: string;
  role: 'housekeeper' | 'supervisor' | 'maintenance';
  roomsCompleted: number;
  avgCleaningTime: number;
  qualityScore: number;
  efficiency: number;
  issuesReported: number;
}

/**
 * Maps a backend HousekeepingTask to the component's RoomInspection interface.
 * Tasks of type 'inspection', 'cleaning', 'deep_clean', or 'checkout_clean' are
 * displayed as room inspections. Each task becomes one inspection card with its
 * description broken into sub-tasks.
 */
function mapTaskToInspection(task: HousekeepingTask): RoomInspection {
  const roomNumber = task.roomId?.roomNumber || 'N/A';
  const assignedStaff =
    (task as Record<string, unknown>).assignedToUserName as string
    || ((task as Record<string, unknown>).assignedToUserId as { name?: string } | undefined)?.name
    || 'Unassigned';

  // Map backend status to the component's inspection status
  let status: RoomInspection['status'] = 'pending';
  if (task.status === 'in_progress') status = 'in_progress';
  else if (task.status === 'completed' || task.status === 'cancelled') status = 'completed';
  else if (task.status === 'assigned') status = 'pending';
  // 'pending' stays 'pending'

  // Build sub-tasks from the task description/title and standard checklist
  const inspectionTasks: InspectionTask[] = [
    { id: `${task._id}-main`, name: task.title, category: mapTaskTypeToCategory(task.taskType), required: true, completed: status === 'completed', timeEstimate: task.estimatedDuration || 30, photoRequired: false },
  ];

  if (task.description) {
    inspectionTasks.push({
      id: `${task._id}-desc`,
      name: task.description,
      category: mapTaskTypeToCategory(task.taskType),
      required: false,
      completed: status === 'completed',
      timeEstimate: 5,
      photoRequired: false,
    });
  }

  // Add supply-based tasks
  if (task.supplies && task.supplies.length > 0) {
    task.supplies.forEach((supply, idx) => {
      inspectionTasks.push({
        id: `${task._id}-supply-${idx}`,
        name: `Restock ${supply.name} (${supply.quantity} ${supply.unit})`,
        category: 'inventory',
        required: true,
        completed: status === 'completed',
        timeEstimate: 2,
        photoRequired: false,
      });
    });
  }

  // Derive an overall score from inspection data if available
  let overallScore = 0;
  const inspection = (task as Record<string, unknown>).inspection as
    { rating?: number; passed?: boolean } | undefined;
  if (inspection?.rating) {
    overallScore = Math.round((inspection.rating / 5) * 100);
  } else if (status === 'completed') {
    overallScore = 90; // default for completed tasks without a rating
  }

  // Build inventory from supplies
  const inventory: InventoryItem[] = (task.supplies || []).map((supply, idx) => ({
    id: `${task._id}-inv-${idx}`,
    name: supply.name,
    category: 'supplies' as const,
    currentStock: supply.quantity,
    requiredStock: supply.quantity,
    restockNeeded: false,
  }));

  return {
    id: task._id,
    roomNumber,
    assignedStaff,
    status,
    startTime: task.startedAt,
    completedTime: task.completedAt,
    estimatedDuration: task.estimatedDuration || 30,
    actualDuration: task.actualDuration,
    tasks: inspectionTasks,
    overallScore,
    issues: [],
    inventory,
  };
}

function mapTaskTypeToCategory(taskType: string): InspectionTask['category'] {
  switch (taskType) {
    case 'cleaning':
    case 'deep_clean':
    case 'checkout_clean':
      return 'cleaning';
    case 'maintenance':
      return 'maintenance';
    case 'inspection':
      return 'amenity';
    default:
      return 'cleaning';
  }
}

/**
 * Maps maintenance-type HousekeepingTasks to the MaintenanceIssue interface.
 */
function mapTaskToMaintenanceIssue(task: HousekeepingTask): MaintenanceIssue {
  const roomNumber = task.roomId?.roomNumber || 'N/A';

  let issueStatus: MaintenanceIssue['status'] = 'reported';
  if (task.status === 'assigned') issueStatus = 'assigned';
  else if (task.status === 'in_progress') issueStatus = 'in_progress';
  else if (task.status === 'completed' || task.status === 'cancelled') issueStatus = 'completed';

  return {
    id: task._id,
    roomNumber,
    type: 'other',
    priority: task.priority || 'medium',
    description: task.description || task.title,
    reportedBy: 'Staff',
    reportedAt: task.createdAt,
    assignedTo: ((task as Record<string, unknown>).assignedToUserId as { name?: string } | undefined)?.name,
    status: issueStatus,
    estimatedRepairTime: task.estimatedDuration,
    photos: (task as Record<string, unknown> & { beforeImages?: string[]; afterImages?: string[] }).beforeImages || [],
  };
}

interface AdvancedHousekeepingProps {}

export const AdvancedHousekeeping: React.FC<AdvancedHousekeepingProps> = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('inspections');
  const [roomInspections, setRoomInspections] = useState<RoomInspection[]>([]);
  const [maintenanceIssues, setMaintenanceIssues] = useState<MaintenanceIssue[]>([]);
  const [staffPerformance, setStaffPerformance] = useState<StaffPerformance[]>([]);
  const [loading, setLoading] = useState(false);
  const [inspectionsLoading, setInspectionsLoading] = useState(false);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [performanceLoading, setPerformanceLoading] = useState(false);
  const [inspectionsError, setInspectionsError] = useState<string | null>(null);
  const [maintenanceError, setMaintenanceError] = useState<string | null>(null);
  const [performanceError, setPerformanceError] = useState<string | null>(null);

  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  const fetchInspections = useCallback(async () => {
    setInspectionsLoading(true);
    setInspectionsError(null);
    try {
      const response = await housekeepingService.getTasks();
      if (!isMountedRef.current) return;

      const tasks: HousekeepingTask[] = response?.data?.tasks || [];
      // Filter to non-maintenance tasks for the inspections tab
      const inspectionTasks = tasks.filter(
        (t) => t.taskType !== 'maintenance'
      );
      setRoomInspections(inspectionTasks.map(mapTaskToInspection));
    } catch (error) {
      if (!isMountedRef.current) return;
      const message = error instanceof Error ? error.message : 'Failed to load inspections';
      setInspectionsError(message);
      toast.error('Failed to load housekeeping inspections');
    } finally {
      if (isMountedRef.current) setInspectionsLoading(false);
    }
  }, []);

  const fetchMaintenanceIssues = useCallback(async () => {
    setMaintenanceLoading(true);
    setMaintenanceError(null);
    try {
      const response = await housekeepingService.getTasks();
      if (!isMountedRef.current) return;

      const tasks: HousekeepingTask[] = response?.data?.tasks || [];
      // Filter to maintenance-type tasks only
      const maintenanceTasks = tasks.filter(
        (t) => t.taskType === 'maintenance'
      );
      setMaintenanceIssues(maintenanceTasks.map(mapTaskToMaintenanceIssue));
    } catch (error) {
      if (!isMountedRef.current) return;
      const message = error instanceof Error ? error.message : 'Failed to load maintenance issues';
      setMaintenanceError(message);
      toast.error('Failed to load maintenance issues');
    } finally {
      if (isMountedRef.current) setMaintenanceLoading(false);
    }
  }, []);

  const fetchStaffPerformance = useCallback(async () => {
    setPerformanceLoading(true);
    setPerformanceError(null);
    try {
      const response = await housekeepingService.getTasks();
      if (!isMountedRef.current) return;

      const tasks: HousekeepingTask[] = response?.data?.tasks || [];

      // Group tasks by assignedToUserId and compute performance metrics
      const staffMap = new Map<string, {
        staffId: string;
        name: string;
        totalRooms: number;
        completedRooms: number;
        totalDuration: number;
        completedDuration: number;
        maintenanceReported: number;
      }>();

      for (const task of tasks) {
        const assignedId =
          (typeof task.assignedToUserId === 'string'
            ? task.assignedToUserId
            : (task.assignedToUserId as { _id?: string } | undefined)?._id) || 'unassigned';
        const assignedName =
          (task.assignedToUserId as { name?: string } | undefined)?.name || 'Unassigned';

        if (assignedId === 'unassigned') continue;

        if (!staffMap.has(assignedId)) {
          staffMap.set(assignedId, {
            staffId: assignedId,
            name: assignedName,
            totalRooms: 0,
            completedRooms: 0,
            totalDuration: 0,
            completedDuration: 0,
            maintenanceReported: 0,
          });
        }

        const entry = staffMap.get(assignedId)!;
        entry.totalRooms += 1;
        if (task.status === 'completed') {
          entry.completedRooms += 1;
          entry.completedDuration += task.actualDuration || task.estimatedDuration || 30;
        }
        entry.totalDuration += task.estimatedDuration || 30;
        if (task.taskType === 'maintenance') {
          entry.maintenanceReported += 1;
        }
      }

      const performanceData: StaffPerformance[] = Array.from(staffMap.values()).map((entry) => {
        const avgCleaningTime = entry.completedRooms > 0
          ? Math.round(entry.completedDuration / entry.completedRooms)
          : 0;
        const efficiency = entry.totalRooms > 0
          ? Math.round((entry.completedRooms / entry.totalRooms) * 100)
          : 0;
        // Quality score derived from completion rate and timing
        const qualityScore = entry.completedRooms > 0
          ? Math.min(100, Math.round(efficiency * 0.6 + 40))
          : 0;

        return {
          staffId: entry.staffId,
          name: entry.name,
          role: entry.maintenanceReported > entry.completedRooms ? 'maintenance' as const : 'housekeeper' as const,
          roomsCompleted: entry.completedRooms,
          avgCleaningTime,
          qualityScore,
          efficiency,
          issuesReported: entry.maintenanceReported,
        };
      });

      setStaffPerformance(performanceData);
    } catch (error) {
      if (!isMountedRef.current) return;
      const message = error instanceof Error ? error.message : 'Failed to load staff performance';
      setPerformanceError(message);
      toast.error('Failed to load staff performance data');
    } finally {
      if (isMountedRef.current) setPerformanceLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInspections();
    fetchMaintenanceIssues();
    fetchStaffPerformance();
  }, [fetchInspections, fetchMaintenanceIssues, fetchStaffPerformance]);

  const handleCompleteTask = (inspectionId: string, taskId: string) => {
    setRoomInspections(prev => prev.map(inspection =>
      inspection.id === inspectionId ? {
        ...inspection,
        tasks: inspection.tasks.map(task =>
          task.id === taskId ? { ...task, completed: !task.completed } : task
        )
      } : inspection
    ));
  };

  const handleStartInspection = async (inspectionId: string) => {
    setLoading(true);
    try {
      await housekeepingService.updateTaskStatus(inspectionId, 'in_progress');
      if (!isMountedRef.current) return;

      setRoomInspections(prev => prev.map(inspection =>
        inspection.id === inspectionId ? {
          ...inspection,
          status: 'in_progress',
          startTime: new Date().toISOString()
        } : inspection
      ));

      toast.success('Room inspection started');
    } catch (error) {
      if (!isMountedRef.current) return;
      toast.error('Failed to start inspection');
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  const handleCompleteInspection = async (inspectionId: string) => {
    setLoading(true);
    try {
      const now = new Date().toISOString();
      await housekeepingService.completeTask(inspectionId, {
        status: 'completed',
        completedSteps: [],
        completedAt: now,
      });
      if (!isMountedRef.current) return;

      setRoomInspections(prev => prev.map(inspection =>
        inspection.id === inspectionId ? {
          ...inspection,
          status: 'completed',
          completedTime: now,
          actualDuration: inspection.startTime
            ? Math.round((Date.now() - new Date(inspection.startTime).getTime()) / 60000)
            : inspection.estimatedDuration
        } : inspection
      ));

      toast.success('Room inspection completed successfully');
    } catch (error) {
      if (!isMountedRef.current) return;
      toast.error('Failed to complete inspection');
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  const handleReportIssue = (roomNumber: string) => {
    toast.success(`Maintenance issue reporting form opened for room ${roomNumber}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50';
      case 'in_progress': return 'text-blue-600 bg-blue-50';
      case 'failed': return 'text-red-600 bg-red-50';
      case 'pending': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-700 bg-red-100';
      case 'high': return 'text-orange-700 bg-orange-100';
      case 'medium': return 'text-yellow-700 bg-yellow-100';
      case 'low': return 'text-green-700 bg-green-100';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'plumbing': return <Wrench className="h-4 w-4 text-blue-600" />;
      case 'electrical': return <Zap className="h-4 w-4 text-yellow-600" />;
      case 'hvac': return <Settings className="h-4 w-4 text-purple-600" />;
      case 'furniture': return <Bed className="h-4 w-4 text-brown-600" />;
      default: return <AlertTriangle className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="relative bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 hover:from-blue-100 hover:to-indigo-100 transition-all duration-200"
        >
          <ClipboardCheck className="h-4 w-4 mr-2 text-blue-600" />
          Housekeeping+
          <Badge
            variant="secondary"
            className="ml-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-0"
          >
            Pro
          </Badge>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-500">
              <ClipboardCheck className="h-5 w-5 text-white" />
            </div>
            Advanced Housekeeping & Maintenance
            <Badge className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white">
              Smart Workflows
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Comprehensive inspection workflows, maintenance tracking, and staff performance management
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="inspections" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Inspections
            </TabsTrigger>
            <TabsTrigger value="maintenance" className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Maintenance
            </TabsTrigger>
            <TabsTrigger value="inventory" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Inventory
            </TabsTrigger>
            <TabsTrigger value="performance" className="flex items-center gap-2">
              <Award className="h-4 w-4" />
              Performance
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inspections" className="space-y-6">
            {inspectionsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <span className="ml-3 text-gray-600">Loading inspections...</span>
              </div>
            ) : inspectionsError ? (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="p-6 text-center">
                  <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                  <p className="text-red-700 font-medium">Failed to load inspections</p>
                  <p className="text-sm text-red-600 mt-1">{inspectionsError}</p>
                  <Button size="sm" variant="outline" className="mt-3" onClick={fetchInspections}>
                    <RefreshCw className="h-3 w-3 mr-1" /> Retry
                  </Button>
                </CardContent>
              </Card>
            ) : (
            <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
                <CardContent className="p-4 text-center">
                  <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-green-700">
                    {roomInspections.filter(r => r.status === 'completed').length}
                  </p>
                  <p className="text-sm text-green-600">Completed Today</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200">
                <CardContent className="p-4 text-center">
                  <Clock className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-blue-700">
                    {roomInspections.filter(r => r.status === 'in_progress').length}
                  </p>
                  <p className="text-sm text-blue-600">In Progress</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200">
                <CardContent className="p-4 text-center">
                  <Timer className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-yellow-700">
                    {roomInspections.length > 0
                      ? Math.round(roomInspections.reduce((acc, r) => acc + (r.actualDuration || r.estimatedDuration), 0) / roomInspections.length)
                      : 0}
                  </p>
                  <p className="text-sm text-yellow-600">Avg Time (min)</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200">
                <CardContent className="p-4 text-center">
                  <Star className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-purple-700">
                    {roomInspections.length > 0
                      ? Math.round(roomInspections.reduce((acc, r) => acc + r.overallScore, 0) / roomInspections.length)
                      : 0}%
                  </p>
                  <p className="text-sm text-purple-600">Quality Score</p>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              {roomInspections.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="p-8 text-center">
                    <ClipboardCheck className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">No inspections found</p>
                    <p className="text-sm text-gray-400 mt-1">Housekeeping tasks will appear here once created</p>
                  </CardContent>
                </Card>
              ) : roomInspections.map((inspection) => (
                <Card key={inspection.id} className="transition-all hover:shadow-md">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-gray-100">
                          <Bed className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-medium">Room {inspection.roomNumber}</h4>
                          <p className="text-sm text-gray-600">Assigned to {inspection.assignedStaff}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className={getStatusColor(inspection.status)}>
                              {inspection.status.toUpperCase()}
                            </Badge>
                            <span className="text-sm text-gray-500">
                              Est: {inspection.estimatedDuration} min
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="flex items-center gap-2">
                            <Progress
                              value={(inspection.tasks.filter(t => t.completed).length / inspection.tasks.length) * 100}
                              className="w-20 h-2"
                            />
                            <span className="text-sm font-medium">
                              {inspection.tasks.filter(t => t.completed).length}/{inspection.tasks.length}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500">Tasks completed</p>
                        </div>

                        <div className="flex gap-2">
                          {inspection.status === 'pending' && (
                            <Button
                              size="sm"
                              onClick={() => handleStartInspection(inspection.id)}
                              disabled={loading}
                            >
                              <Timer className="h-3 w-3 mr-1" />
                              Start
                            </Button>
                          )}
                          {inspection.status === 'in_progress' && (
                            <Button
                              size="sm"
                              onClick={() => handleCompleteInspection(inspection.id)}
                              disabled={loading}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Complete
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReportIssue(inspection.roomNumber)}
                          >
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Report Issue
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h5 className="font-medium text-sm mb-2">Inspection Tasks</h5>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {inspection.tasks.map((task) => (
                            <div key={task.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                              <Checkbox
                                checked={task.completed}
                                onCheckedChange={() => handleCompleteTask(inspection.id, task.id)}
                                disabled={inspection.status === 'completed'}
                              />
                              <div className="flex-1">
                                <p className={`text-sm ${task.completed ? 'line-through text-gray-500' : ''}`}>
                                  {task.name}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="outline" className="text-xs">
                                    {task.category}
                                  </Badge>
                                  <span className="text-xs text-gray-500">{task.timeEstimate}min</span>
                                  {task.photoRequired && (
                                    <Camera className="h-3 w-3 text-blue-500" />
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h5 className="font-medium text-sm mb-2">Room Inventory</h5>
                        <div className="space-y-2">
                          {inspection.inventory.map((item) => (
                            <div key={item.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <div>
                                <p className="text-sm font-medium">{item.name}</p>
                                <p className="text-xs text-gray-500">{item.category}</p>
                              </div>
                              <div className="text-right">
                                <span className={`text-sm font-medium ${
                                  item.restockNeeded ? 'text-red-600' : 'text-green-600'
                                }`}>
                                  {item.currentStock}/{item.requiredStock}
                                </span>
                                {item.restockNeeded && (
                                  <Badge className="ml-2 text-xs bg-red-100 text-red-700">
                                    Restock
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            </>
            )}
          </TabsContent>

          <TabsContent value="maintenance" className="space-y-6">
            {maintenanceLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <span className="ml-3 text-gray-600">Loading maintenance issues...</span>
              </div>
            ) : maintenanceError ? (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="p-6 text-center">
                  <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                  <p className="text-red-700 font-medium">Failed to load maintenance issues</p>
                  <p className="text-sm text-red-600 mt-1">{maintenanceError}</p>
                  <Button size="sm" variant="outline" className="mt-3" onClick={fetchMaintenanceIssues}>
                    <RefreshCw className="h-3 w-3 mr-1" /> Retry
                  </Button>
                </CardContent>
              </Card>
            ) : (
            <>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Maintenance Issues</h3>
              <div className="flex items-center gap-2">
                <Badge className="bg-red-100 text-red-700">
                  {maintenanceIssues.filter(i => i.priority === 'urgent').length} Urgent
                </Badge>
                <Badge className="bg-orange-100 text-orange-700">
                  {maintenanceIssues.filter(i => i.priority === 'high').length} High
                </Badge>
              </div>
            </div>

            <div className="space-y-4">
              {maintenanceIssues.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="p-8 text-center">
                    <Wrench className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">No maintenance issues reported</p>
                    <p className="text-sm text-gray-400 mt-1">Maintenance tasks will appear here when reported</p>
                  </CardContent>
                </Card>
              ) : maintenanceIssues.map((issue) => (
                <Card key={issue.id} className={`transition-all hover:shadow-md border-l-4 ${
                  issue.priority === 'urgent' ? 'border-l-red-500' :
                  issue.priority === 'high' ? 'border-l-orange-500' :
                  issue.priority === 'medium' ? 'border-l-yellow-500' : 'border-l-green-500'
                }`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-gray-100">
                          {getTypeIcon(issue.type)}
                        </div>
                        <div>
                          <h4 className="font-medium">Room {issue.roomNumber}</h4>
                          <p className="text-sm text-gray-600">{issue.description}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge className={getPriorityColor(issue.priority)}>
                              {issue.priority.toUpperCase()}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {issue.type}
                            </Badge>
                            <Badge className={getStatusColor(issue.status)}>
                              {issue.status.replace('_', ' ').toUpperCase()}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-sm text-gray-600">Reported by</p>
                        <p className="font-medium">{issue.reportedBy}</p>
                        <p className="text-xs text-gray-500">
                          {format(new Date(issue.reportedAt), 'MMM dd, HH:mm')}
                        </p>
                        {issue.estimatedRepairTime && (
                          <p className="text-xs text-blue-600 mt-1">
                            Est: {issue.estimatedRepairTime} min
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {issue.assignedTo && (
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3 text-gray-500" />
                            <span className="text-sm text-gray-600">Assigned to {issue.assignedTo}</span>
                          </div>
                        )}
                        {issue.photos.length > 0 && (
                          <div className="flex items-center gap-1">
                            <Camera className="h-3 w-3 text-blue-500" />
                            <span className="text-sm text-blue-600">{issue.photos.length} photos</span>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          <Phone className="h-3 w-3 mr-1" />
                          Contact
                        </Button>
                        <Button size="sm">
                          <Eye className="h-3 w-3 mr-1" />
                          View Details
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            </>
            )}
          </TabsContent>

          <TabsContent value="inventory" className="space-y-6">
            {inspectionsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <span className="ml-3 text-gray-600">Loading inventory data...</span>
              </div>
            ) : inspectionsError ? (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="p-6 text-center">
                  <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                  <p className="text-red-700 font-medium">Failed to load inventory data</p>
                  <p className="text-sm text-red-600 mt-1">{inspectionsError}</p>
                  <Button size="sm" variant="outline" className="mt-3" onClick={fetchInspections}>
                    <RefreshCw className="h-3 w-3 mr-1" /> Retry
                  </Button>
                </CardContent>
              </Card>
            ) : (
            <>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Inventory Management</h3>
              <Button className="bg-gradient-to-r from-green-500 to-emerald-500">
                <Package className="h-4 w-4 mr-2" />
                Generate Restock Report
              </Button>
            </div>

            <div className="grid gap-4">
              {roomInspections.filter(i => i.inventory.length > 0).length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="p-8 text-center">
                    <Package className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">No inventory data available</p>
                    <p className="text-sm text-gray-400 mt-1">Room supply data will appear here when tasks include inventory details</p>
                  </CardContent>
                </Card>
              ) : roomInspections.filter(i => i.inventory.length > 0).map((inspection) => (
                <Card key={`inv-${inspection.id}`} className="transition-all hover:shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">Room {inspection.roomNumber} Inventory</h4>
                      <Badge variant="outline">
                        {inspection.inventory.filter(i => i.restockNeeded).length} items need restock
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {inspection.inventory.map((item) => (
                        <div key={item.id} className={`p-3 rounded-lg border ${
                          item.restockNeeded ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'
                        }`}>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-sm">{item.name}</p>
                              <p className="text-xs text-gray-500">{item.category}</p>
                            </div>
                            <div className="text-right">
                              <span className={`font-bold ${
                                item.restockNeeded ? 'text-red-600' : 'text-green-600'
                              }`}>
                                {item.currentStock}/{item.requiredStock}
                              </span>
                              {item.restockNeeded && (
                                <p className="text-xs text-red-600 mt-1">Restock needed</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            </>
            )}
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            {performanceLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <span className="ml-3 text-gray-600">Loading performance data...</span>
              </div>
            ) : performanceError ? (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="p-6 text-center">
                  <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                  <p className="text-red-700 font-medium">Failed to load performance data</p>
                  <p className="text-sm text-red-600 mt-1">{performanceError}</p>
                  <Button size="sm" variant="outline" className="mt-3" onClick={fetchStaffPerformance}>
                    <RefreshCw className="h-3 w-3 mr-1" /> Retry
                  </Button>
                </CardContent>
              </Card>
            ) : (
            <>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Staff Performance Analytics</h3>
              <Button variant="outline" onClick={fetchStaffPerformance}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Update Metrics
              </Button>
            </div>

            <div className="grid gap-4">
              {staffPerformance.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="p-8 text-center">
                    <Award className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">No staff performance data available</p>
                    <p className="text-sm text-gray-400 mt-1">Performance metrics will appear once tasks are assigned to staff</p>
                  </CardContent>
                </Card>
              ) : staffPerformance.map((staff) => (
                <Card key={staff.staffId} className="transition-all hover:shadow-md">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-blue-100">
                          <User className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-medium">{staff.name}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {staff.role}
                            </Badge>
                            <span className="text-sm text-gray-600">
                              {staff.roomsCompleted} rooms completed
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-6 text-center">
                        <div>
                          <p className="text-sm text-gray-600">Avg Time</p>
                          <p className="font-bold text-blue-600">{staff.avgCleaningTime}min</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Quality</p>
                          <p className="font-bold text-green-600">{staff.qualityScore}%</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Efficiency</p>
                          <p className="font-bold text-purple-600">{staff.efficiency}%</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Issues</p>
                          <p className="font-bold text-orange-600">{staff.issuesReported}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Quality Score</p>
                        <Progress value={staff.qualityScore} className="h-2" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Efficiency</p>
                        <Progress value={staff.efficiency} className="h-2" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Overall Performance</p>
                        <Progress value={(staff.qualityScore + staff.efficiency) / 2} className="h-2" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
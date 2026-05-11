import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from '@/utils/toast';
import {
  Workflow,
  Clock,
  User,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Eye,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Star,
  Building2,
  Users,
  Crown,
  Zap,
  Calendar,
  IndianRupee,
  Search,
  Filter,
  RefreshCw,
  TrendingUp,
  AlertCircle,
  Timer
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { formatCurrency } from '@/utils/currencyUtils';
import { format, formatDistanceToNow } from 'date-fns';
import { workflowEngine, ReservationWorkflow, WorkflowStep } from '@/utils/ReservationWorkflowEngine';

interface ReservationWorkflowPanelProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

const ReservationWorkflowPanel: React.FC<ReservationWorkflowPanelProps> = ({
  isOpen,
  onClose,
  className
}) => {
  const [workflows, setWorkflows] = useState<ReservationWorkflow[]>([]);
  const [filteredWorkflows, setFilteredWorkflows] = useState<ReservationWorkflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<ReservationWorkflow | null>(null);
  const [showWorkflowDetails, setShowWorkflowDetails] = useState(false);
  const [showStepAction, setShowStepAction] = useState(false);
  const [selectedStep, setSelectedStep] = useState<WorkflowStep | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'complete'>('approve');
  const [actionNotes, setActionNotes] = useState('');
  const [loading, setLoading] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [assignedToFilter, setAssignedToFilter] = useState<string>('all');

  // Stats
  const [stats, setStats] = useState<unknown>({});

  useEffect(() => {
    if (isOpen) {
      loadWorkflows();
      loadStats();

      // Set up real-time updates
      const interval = setInterval(() => {
        loadWorkflows();
        loadStats();
      }, 30000); // Refresh every 30 seconds

      return () => clearInterval(interval);
    }
  }, [isOpen]);

  // Apply filters
  useEffect(() => {
    let filtered = workflows;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(workflow =>
        workflow.reservationData.userId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        workflow.reservationData.bookingNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        workflow.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(workflow => workflow.status === statusFilter);
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(workflow => workflow.priority === priorityFilter);
    }

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(workflow => workflow.workflowType === typeFilter);
    }

    // Assigned to filter
    if (assignedToFilter !== 'all') {
      const currentStep = workflow => workflow.steps.find(s => s.status === 'in_progress');
      filtered = filtered.filter(workflow => {
        const step = currentStep(workflow);
        return step?.assignedToRole === assignedToFilter;
      });
    }

    // Sort by priority and creation time
    filtered.sort((a, b) => {
      const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
      const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder];
      const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder];

      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    setFilteredWorkflows(filtered);
  }, [workflows, searchTerm, statusFilter, priorityFilter, typeFilter, assignedToFilter]);

  const loadWorkflows = () => {
    const allWorkflows = workflowEngine.getAllActiveWorkflows();
    setWorkflows(allWorkflows);
  };

  const loadStats = () => {
    const workflowStats = workflowEngine.getWorkflowStats();
    setStats(workflowStats);
  };

  const getStatusColor = (status: string) => {
    const colors = {
      active: 'bg-blue-100 text-blue-800 border-blue-200',
      completed: 'bg-green-100 text-green-800 border-green-200',
      failed: 'bg-red-100 text-red-800 border-red-200',
      cancelled: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colors[status as keyof typeof colors] || colors.active;
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      urgent: 'bg-red-500 text-white',
      high: 'bg-orange-500 text-white',
      medium: 'bg-yellow-500 text-white',
      low: 'bg-green-500 text-white'
    };
    return colors[priority as keyof typeof colors] || colors.medium;
  };

  const getWorkflowTypeIcon = (type: string) => {
    const icons = {
      standard: <User className="w-4 h-4" />,
      vip: <Crown className="w-4 h-4" />,
      corporate: <Building2 className="w-4 h-4" />,
      group: <Users className="w-4 h-4" />
    };
    return icons[type as keyof typeof icons] || icons.standard;
  };

  const getStepStatusIcon = (status: string) => {
    const icons = {
      pending: <Clock className="w-4 h-4 text-gray-400" />,
      in_progress: <Play className="w-4 h-4 text-blue-500" />,
      completed: <CheckCircle className="w-4 h-4 text-green-500" />,
      failed: <XCircle className="w-4 h-4 text-red-500" />,
      skipped: <FastForward className="w-4 h-4 text-gray-400" />
    };
    return icons[status as keyof typeof icons] || icons.pending;
  };

  const calculateWorkflowProgress = (workflow: ReservationWorkflow): number => {
    const completedSteps = workflow.steps.filter(s => s.status === 'completed').length;
    return Math.round((completedSteps / workflow.steps.length) * 100);
  };

  const getCurrentStep = (workflow: ReservationWorkflow): WorkflowStep | null => {
    return workflow.steps.find(s => s.status === 'in_progress') || null;
  };

  const getTimeRemaining = (step: WorkflowStep): string => {
    if (!step.timeout || step.status !== 'in_progress') return '';

    const startTime = new Date().getTime() - (5 * 60 * 1000); // Assume step started 5 min ago for demo
    const timeoutTime = startTime + (step.timeout * 60 * 1000);
    const remaining = timeoutTime - new Date().getTime();

    if (remaining <= 0) return 'Overdue';

    const minutes = Math.floor(remaining / (1000 * 60));
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m remaining`;
    }
    return `${minutes}m remaining`;
  };

  const handleStepAction = async () => {
    if (!selectedWorkflow || !selectedStep) return;

    setLoading(true);
    try {
      let success = false;

      switch (actionType) {
        case 'approve':
          success = await workflowEngine.approveStep(
            selectedWorkflow.id,
            selectedStep.id,
            actionNotes
          );
          break;
        case 'reject':
          await workflowEngine.rejectStep(
            selectedWorkflow.id,
            selectedStep.id,
            actionNotes
          );
          success = true;
          break;
        case 'complete':
          success = await workflowEngine.completeManualStep(
            selectedWorkflow.id,
            selectedStep.id,
            { notes: actionNotes }
          );
          break;
      }

      if (success || actionType === 'reject') {
        toast.success(`Step ${actionType === 'reject' ? 'rejected' : 'completed'} successfully`);
        loadWorkflows();
        setShowStepAction(false);
        setActionNotes('');
      } else {
        toast.error('Failed to complete action');
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to complete action');
    } finally {
      setLoading(false);
    }
  };

  const openStepAction = (workflow: ReservationWorkflow, step: WorkflowStep, action: 'approve' | 'reject' | 'complete') => {
    setSelectedWorkflow(workflow);
    setSelectedStep(step);
    setActionType(action);
    setActionNotes('');
    setShowStepAction(true);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Workflow className="h-5 w-5" />
              Reservation Workflow Management
            </DialogTitle>
            <DialogDescription>
              Monitor and manage reservation workflows with real-time status tracking
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col h-full space-y-4">
            {/* Stats Dashboard */}
            <div className="grid grid-cols-6 gap-4">
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-blue-700">{stats.active || 0}</div>
                <div className="text-sm text-blue-600">Active</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-700">{stats.completed || 0}</div>
                <div className="text-sm text-green-600">Completed</div>
              </div>
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-red-700">{stats.failed || 0}</div>
                <div className="text-sm text-red-600">Failed</div>
              </div>
              <div className="bg-amber-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-amber-700">{stats.byPriority?.urgent || 0}</div>
                <div className="text-sm text-amber-600">Urgent</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-purple-700">{stats.byType?.vip || 0}</div>
                <div className="text-sm text-purple-600">VIP</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-gray-700">{Math.round(stats.avgCompletionTime || 0)}</div>
                <div className="text-sm text-gray-600">Avg Minutes</div>
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Search workflows..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-64"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                  <SelectItem value="corporate">Corporate</SelectItem>
                  <SelectItem value="group">Group</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex-1" />

              <Button
                variant="outline"
                size="sm"
                onClick={loadWorkflows}
                disabled={loading}
              >
                <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
              </Button>
            </div>

            {/* Workflows List */}
            <div className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                {filteredWorkflows.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Workflow className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>No workflows found</p>
                    <p className="text-sm">Try adjusting your filters</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredWorkflows.map(workflow => {
                      const currentStep = getCurrentStep(workflow);
                      const progress = calculateWorkflowProgress(workflow);

                      return (
                        <Card key={workflow.id} className="hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4 flex-1">
                                {/* Workflow Type Icon */}
                                <div className="flex-shrink-0">
                                  {getWorkflowTypeIcon(workflow.workflowType)}
                                </div>

                                {/* Workflow Info */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-2">
                                    <h4 className="font-medium truncate">
                                      {workflow.reservationData.userId?.name || 'Guest'}
                                    </h4>
                                    <Badge className={getStatusColor(workflow.status)}>
                                      {workflow.status}
                                    </Badge>
                                    <Badge className={getPriorityColor(workflow.priority)}>
                                      {workflow.priority}
                                    </Badge>
                                    {workflow.workflowType === 'vip' && (
                                      <Star className="w-4 h-4 text-yellow-500" />
                                    )}
                                  </div>

                                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                                    <span>ID: {workflow.id.slice(-8)}</span>
                                    <span>•</span>
                                    <span>Booking: {workflow.reservationData.bookingNumber || 'N/A'}</span>
                                    <span>•</span>
                                    <span>{workflow.reservationData.roomType || 'Standard Room'}</span>
                                    <span>•</span>
                                    <span>{formatCurrency(workflow.metadata.totalAmount)}</span>
                                  </div>

                                  {/* Current Step */}
                                  {currentStep && (
                                    <div className="flex items-center gap-2 text-sm">
                                      {getStepStatusIcon(currentStep.status)}
                                      <span className="font-medium">{currentStep.name}</span>
                                      {currentStep.assignedToRole && (
                                        <Badge variant="outline" className="text-xs">
                                          {currentStep.assignedToRole}
                                        </Badge>
                                      )}
                                      {currentStep.timeout && (
                                        <span className="text-orange-600 text-xs">
                                          <Timer className="w-3 h-3 inline mr-1" />
                                          {getTimeRemaining(currentStep)}
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  {/* Progress Bar */}
                                  <div className="mt-2">
                                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                                      <span>Progress</span>
                                      <span>{progress}%</span>
                                    </div>
                                    <Progress value={progress} className="h-2" />
                                  </div>
                                </div>

                                {/* Time Info */}
                                <div className="flex-shrink-0 text-center text-sm">
                                  <div className="font-medium text-gray-700">
                                    {formatDistanceToNow(workflow.createdAt, { addSuffix: true })}
                                  </div>
                                  <div className="text-gray-500 text-xs">Created</div>
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-2 ml-4">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setSelectedWorkflow(workflow);
                                        setShowWorkflowDetails(true);
                                      }}
                                    >
                                      <Eye className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>View Details</TooltipContent>
                                </Tooltip>

                                {/* Step Actions */}
                                {currentStep && currentStep.type === 'approval' && (
                                  <>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => openStepAction(workflow, currentStep, 'approve')}
                                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                        >
                                          <ThumbsUp className="w-4 h-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Approve</TooltipContent>
                                    </Tooltip>

                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => openStepAction(workflow, currentStep, 'reject')}
                                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                        >
                                          <ThumbsDown className="w-4 h-4" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Reject</TooltipContent>
                                    </Tooltip>
                                  </>
                                )}

                                {currentStep && currentStep.type !== 'approval' && !currentStep.autoExecute && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => openStepAction(workflow, currentStep, 'complete')}
                                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                      >
                                        <CheckCircle className="w-4 h-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Complete Step</TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Workflow Details Modal */}
      {selectedWorkflow && (
        <Dialog open={showWorkflowDetails} onOpenChange={setShowWorkflowDetails}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {getWorkflowTypeIcon(selectedWorkflow.workflowType)}
                Workflow Details - {selectedWorkflow.reservationData.userId?.name}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {/* Workflow Overview */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="font-medium">Status</label>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={getStatusColor(selectedWorkflow.status)}>
                        {selectedWorkflow.status}
                      </Badge>
                      <Badge className={getPriorityColor(selectedWorkflow.priority)}>
                        {selectedWorkflow.priority}
                      </Badge>
                    </div>
                  </div>

                  <div>
                    <label className="font-medium">Guest Information</label>
                    <div className="bg-gray-50 rounded-lg p-3 mt-1 space-y-2">
                      <div><strong>Name:</strong> {selectedWorkflow.reservationData.userId?.name}</div>
                      <div><strong>Email:</strong> {selectedWorkflow.reservationData.userId?.email}</div>
                      <div><strong>Booking:</strong> {selectedWorkflow.reservationData.bookingNumber}</div>
                      <div><strong>Room Type:</strong> {selectedWorkflow.reservationData.roomType}</div>
                      <div><strong>Total Amount:</strong> {formatCurrency(selectedWorkflow.metadata.totalAmount)}</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="font-medium">Timeline</label>
                    <div className="bg-gray-50 rounded-lg p-3 mt-1 space-y-2 text-sm">
                      <div><strong>Created:</strong> {format(selectedWorkflow.createdAt, 'PPp')}</div>
                      <div><strong>Updated:</strong> {format(selectedWorkflow.updatedAt, 'PPp')}</div>
                      <div><strong>Duration:</strong> {formatDistanceToNow(selectedWorkflow.createdAt)}</div>
                      <div><strong>Created By:</strong> {selectedWorkflow.createdBy}</div>
                    </div>
                  </div>

                  <div>
                    <label className="font-medium">Progress</label>
                    <div className="mt-1">
                      <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                        <span>{selectedWorkflow.steps.filter(s => s.status === 'completed').length} of {selectedWorkflow.steps.length} steps completed</span>
                        <span>{calculateWorkflowProgress(selectedWorkflow)}%</span>
                      </div>
                      <Progress value={calculateWorkflowProgress(selectedWorkflow)} className="h-3" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Steps */}
              <div>
                <h3 className="font-medium mb-3">Workflow Steps</h3>
                <div className="space-y-3">
                  {selectedWorkflow.steps.map((step, index) => (
                    <div
                      key={step.id}
                      className={cn(
                        'border rounded-lg p-3',
                        step.status === 'completed' && 'bg-green-50 border-green-200',
                        step.status === 'in_progress' && 'bg-blue-50 border-blue-200',
                        step.status === 'failed' && 'bg-red-50 border-red-200',
                        step.status === 'pending' && 'bg-gray-50 border-gray-200'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white border-2">
                            <span className="text-sm font-medium">{index + 1}</span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              {getStepStatusIcon(step.status)}
                              <span className="font-medium">{step.name}</span>
                              {step.assignedToRole && (
                                <Badge variant="outline" className="text-xs">
                                  {step.assignedToRole}
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-gray-600">{step.description}</div>
                          </div>
                        </div>

                        <div className="text-right text-sm">
                          {step.completedAt && (
                            <div className="text-green-600 font-medium">
                              Completed {format(step.completedAt, 'MMM dd, HH:mm')}
                            </div>
                          )}
                          {step.completedBy && (
                            <div className="text-gray-500">by {step.completedBy}</div>
                          )}
                          {step.timeout && step.status === 'in_progress' && (
                            <div className="text-orange-600">
                              <Timer className="w-3 h-3 inline mr-1" />
                              {getTimeRemaining(step)}
                            </div>
                          )}
                        </div>
                      </div>

                      {step.notes && (
                        <div className="mt-2 p-2 bg-white rounded text-sm">
                          <strong>Notes:</strong> {step.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Notifications */}
              {selectedWorkflow.notifications.length > 0 && (
                <div>
                  <h3 className="font-medium mb-3">Notifications</h3>
                  <div className="space-y-2">
                    {selectedWorkflow.notifications.map((notification, index) => (
                      <div key={`selectedWorkflow-notifications-${index}-${notification.type}`} className="bg-gray-50 rounded-lg p-3 text-sm">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium">{notification.type} to {notification.recipient}</div>
                            <div className="text-gray-600 mt-1">{notification.message}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-gray-500">{format(notification.sentAt, 'MMM dd, HH:mm')}</div>
                            <Badge variant={notification.status === 'sent' ? 'default' : 'destructive'} className="text-xs">
                              {notification.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Step Action Modal */}
      <Dialog open={showStepAction} onOpenChange={setShowStepAction}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' ? 'Approve Step' :
               actionType === 'reject' ? 'Reject Step' : 'Complete Step'}
            </DialogTitle>
            <DialogDescription>
              {selectedStep?.name} - {selectedWorkflow?.reservationData.userId?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder={`Add notes for this ${actionType}...`}
                rows={4}
                className="mt-1"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowStepAction(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleStepAction}
                disabled={loading}
                className={
                  actionType === 'approve' ? 'bg-green-600 hover:bg-green-700' :
                  actionType === 'reject' ? 'bg-red-600 hover:bg-red-700' :
                  'bg-blue-600 hover:bg-blue-700'
                }
              >
                {loading ? 'Processing...' :
                 actionType === 'approve' ? 'Approve' :
                 actionType === 'reject' ? 'Reject' : 'Complete'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ReservationWorkflowPanel;
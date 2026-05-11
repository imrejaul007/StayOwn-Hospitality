import React, { useState, useEffect, useRef} from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ScrollArea } from '../ui/scroll-area';
import { Textarea } from '../ui/textarea';
import {
  Calendar,
  Clock,
  Mail,
  Settings,
  Play,
  Trash2,
  Edit,
  Plus,
  Users,
  FileText,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  XCircle
} from 'lucide-react';
import { format, addDays, addWeeks, addMonths, isAfter } from 'date-fns';

interface ScheduledReport {
  id: string;
  name: string;
  description: string;
  reportTemplate: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  time: string;
  timezone: string;
  recipients: string[];
  isActive: boolean;
  lastRun?: Date;
  nextRun: Date;
  status: 'scheduled' | 'running' | 'completed' | 'failed';
  createdAt: Date;
  createdBy: string;
  executionHistory: {
    id: string;
    executedAt: Date;
    status: 'success' | 'failed';
    duration: number;
    recipients: number;
    errorMessage?: string;
  }[];
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  metrics: string[];
  filters: unknown[];
  exportFormat: 'csv' | 'excel' | 'pdf';
}

interface AutomatedReportSchedulingProps {
  reportTemplates?: ReportTemplate[];
  onCreateSchedule?: (schedule: Omit<ScheduledReport, 'id' | 'createdAt' | 'executionHistory'>) => void;
  onUpdateSchedule?: (id: string, updates: Partial<ScheduledReport>) => void;
  onDeleteSchedule?: (id: string) => void;
  onRunSchedule?: (id: string) => void;
}

// Default empty report templates - will be populated from props or remain empty
const defaultReportTemplates: ReportTemplate[] = [];

const timezones = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney'
];

const frequencies = [
  { value: 'daily', label: 'Daily', icon: Calendar },
  { value: 'weekly', label: 'Weekly', icon: Calendar },
  { value: 'monthly', label: 'Monthly', icon: Calendar },
  { value: 'quarterly', label: 'Quarterly', icon: Calendar }
];

export const AutomatedReportScheduling: React.FC<AutomatedReportSchedulingProps> = ({
  reportTemplates = defaultReportTemplates,
  onCreateSchedule,
  onUpdateSchedule,
  onDeleteSchedule,
  onRunSchedule
}) => {
  const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>([]);
  const [activeTab, setActiveTab] = useState<string>('schedules');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduledReport | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timer on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    reportTemplate: '',
    frequency: 'daily' as const,
    time: '08:00',
    timezone: 'UTC',
    recipients: [''],
    isActive: true
  });

  const calculateNextRun = (frequency: string, time: string, lastRun?: Date) => {
    const [hours, minutes] = time.split(':').map(Number);
    const now = new Date();
    let nextRun = new Date();
    nextRun.setHours(hours, minutes, 0, 0);

    switch (frequency) {
      case 'daily':
        if (nextRun <= now) {
          nextRun = addDays(nextRun, 1);
        }
        break;
      case 'weekly':
        if (nextRun <= now) {
          nextRun = addWeeks(nextRun, 1);
        }
        break;
      case 'monthly':
        if (nextRun <= now) {
          nextRun = addMonths(nextRun, 1);
        }
        break;
      case 'quarterly':
        if (nextRun <= now) {
          nextRun = addMonths(nextRun, 3);
        }
        break;
    }

    return nextRun;
  };

  // Populate form when editing an existing schedule
  useEffect(() => {
    if (editingSchedule) {
      setFormData({
        name: editingSchedule.name,
        description: editingSchedule.description || '',
        reportTemplate: editingSchedule.reportTemplate,
        frequency: editingSchedule.frequency as 'daily',
        time: editingSchedule.time,
        timezone: editingSchedule.timezone || 'UTC',
        recipients: editingSchedule.recipients.length > 0 ? editingSchedule.recipients : [''],
        isActive: editingSchedule.isActive,
      });
    }
  }, [editingSchedule]);

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleCreateSchedule = () => {
    const validRecipients = formData.recipients.filter(email => email.trim() !== '' && isValidEmail(email.trim()));
    if (validRecipients.length === 0) return;

    // If editing, update instead of create
    if (editingSchedule) {
      const updates = {
        ...formData,
        recipients: validRecipients,
        nextRun: calculateNextRun(formData.frequency, formData.time),
      };
      handleUpdateSchedule(editingSchedule.id, updates);
      resetForm();
      return;
    }

    const newSchedule: ScheduledReport = {
      id: `schedule-${Date.now()}`,
      ...formData,
      recipients: validRecipients,
      nextRun: calculateNextRun(formData.frequency, formData.time),
      status: 'scheduled',
      createdAt: new Date(),
      createdBy: 'current-user@hotel.com',
      executionHistory: []
    };

    setScheduledReports(prev => [...prev, newSchedule]);
    if (onCreateSchedule) {
      onCreateSchedule(newSchedule);
    }
    setShowCreateForm(false);
    resetForm();
  };

  const handleUpdateSchedule = (id: string, updates: Partial<ScheduledReport>) => {
    setScheduledReports(prev =>
      prev.map(schedule =>
        schedule.id === id ? { ...schedule, ...updates } : schedule
      )
    );
    if (onUpdateSchedule) {
      onUpdateSchedule(id, updates);
    }
  };

  const handleDeleteSchedule = (id: string) => {
    setScheduledReports(prev => prev.filter(schedule => schedule.id !== id));
    if (onDeleteSchedule) {
      onDeleteSchedule(id);
    }
  };

  const handleRunSchedule = (id: string) => {
    handleUpdateSchedule(id, { status: 'running' });
    if (onRunSchedule) {
      onRunSchedule(id);
    }

    // Simulate completion after 3 seconds
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const schedule = scheduledReports.find(s => s.id === id);
      if (schedule) {
        const newExecution = {
          id: `exec-${Date.now()}`,
          executedAt: new Date(),
          status: 'success' as const,
          duration: 2000,
          recipients: schedule.recipients.length
        };

        handleUpdateSchedule(id, {
          status: 'scheduled',
          lastRun: new Date(),
          nextRun: calculateNextRun(schedule.frequency, schedule.time),
          executionHistory: [newExecution, ...schedule.executionHistory]
        });
      }
    }, 3000);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      reportTemplate: '',
      frequency: 'daily',
      time: '08:00',
      timezone: 'UTC',
      recipients: [''],
      isActive: true
    });
    setEditingSchedule(null);
  };

  const addRecipient = () => {
    setFormData(prev => ({
      ...prev,
      recipients: [...prev.recipients, '']
    }));
  };

  const removeRecipient = (index: number) => {
    setFormData(prev => ({
      ...prev,
      recipients: prev.recipients.filter((_, i) => i !== index)
    }));
  };

  const updateRecipient = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      recipients: prev.recipients.map((email, i) => i === index ? value : email)
    }));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'running':
        return <RotateCcw className="h-4 w-4 text-yellow-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      scheduled: 'secondary',
      running: 'default',
      completed: 'default',
      failed: 'destructive'
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Automated Report Scheduling
          </div>
          <Button onClick={() => setShowCreateForm(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Schedule
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="schedules">Active Schedules</TabsTrigger>
            <TabsTrigger value="history">Execution History</TabsTrigger>
            <TabsTrigger value="templates">Report Templates</TabsTrigger>
          </TabsList>

          {/* Active Schedules */}
          <TabsContent value="schedules" className="space-y-4">
            <ScrollArea className="h-96">
              <div className="space-y-4">
                {scheduledReports.map((schedule) => (
                  <Card key={schedule.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-medium">{schedule.name}</h3>
                          {getStatusBadge(schedule.status)}
                          <Badge variant="outline">
                            {schedule.frequency}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          {schedule.description}
                        </p>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Next Run:</span>
                            <p className="font-medium">
                              {format(schedule.nextRun, 'MMM dd, yyyy HH:mm')}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Time:</span>
                            <p className="font-medium">{schedule.time} {schedule.timezone}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Recipients:</span>
                            <p className="font-medium">{schedule.recipients.length} recipients</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Last Run:</span>
                            <p className="font-medium">
                              {schedule.lastRun ? format(schedule.lastRun, 'MMM dd HH:mm') : 'Never'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        <Switch
                          checked={schedule.isActive}
                          onCheckedChange={(checked) =>
                            handleUpdateSchedule(schedule.id, { isActive: checked })
                          }
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRunSchedule(schedule.id)}
                          disabled={schedule.status === 'running'}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingSchedule(schedule)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteSchedule(schedule.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}

                {scheduledReports.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No scheduled reports yet</p>
                    <p className="text-sm">Create your first automated report schedule</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Execution History */}
          <TabsContent value="history" className="space-y-4">
            <ScrollArea className="h-96">
              <div className="space-y-4">
                {scheduledReports.flatMap(schedule =>
                  schedule.executionHistory.map(execution => (
                    <Card key={execution.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(execution.status)}
                          <div>
                            <h4 className="font-medium">{schedule.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              Executed on {format(execution.executedAt, 'MMM dd, yyyy HH:mm')}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            {(execution.duration / 1000).toFixed(1)}s duration
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {execution.recipients} recipients
                          </p>
                        </div>
                      </div>
                      {execution.errorMessage && (
                        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                          <p className="text-sm text-red-600">{execution.errorMessage}</p>
                        </div>
                      )}
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Report Templates */}
          <TabsContent value="templates" className="space-y-4">
            <ScrollArea className="h-96">
              <div className="space-y-4">
                {reportTemplates.map((template) => (
                  <Card key={template.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <h3 className="font-medium">{template.name}</h3>
                          <Badge variant="outline">{template.exportFormat.toUpperCase()}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          {template.description}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {template.metrics.map((metric) => (
                            <Badge key={metric} variant="secondary" className="text-xs">
                              {metric.replace('_', ' ')}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* Create/Edit Schedule Modal */}
        {(showCreateForm || editingSchedule) && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle>
                  {editingSchedule ? 'Edit Schedule' : 'Create New Schedule'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="scheduleName">Schedule Name</Label>
                    <Input
                      id="scheduleName"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Enter schedule name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="reportTemplate">Report Template</Label>
                    <Select
                      value={formData.reportTemplate}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, reportTemplate: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select template" />
                      </SelectTrigger>
                      <SelectContent>
                        {reportTemplates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description of this scheduled report"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="frequency">Frequency</Label>
                    <Select
                      value={formData.frequency}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, frequency: value as string }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {frequencies.map((freq) => (
                          <SelectItem key={freq.value} value={freq.value}>
                            {freq.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="time">Time</Label>
                    <Input
                      id="time"
                      type="time"
                      value={formData.time}
                      onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="timezone">Timezone</Label>
                    <Select
                      value={formData.timezone}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, timezone: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {timezones.map((tz) => (
                          <SelectItem key={tz} value={tz}>
                            {tz}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <Label>Recipients</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addRecipient}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Recipient
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {formData.recipients.map((email, index) => (
                      <div key={`formData-recipients-${index}-${email}`} className="flex items-center gap-2">
                        <Input
                          type="email"
                          value={email}
                          onChange={(e) => updateRecipient(index, e.target.value)}
                          placeholder="Enter email address"
                        />
                        {formData.recipients.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeRecipient(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isActive: checked }))}
                  />
                  <Label htmlFor="isActive">Enable this schedule</Label>
                </div>

                <Separator />

                <div className="flex items-center justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowCreateForm(false);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateSchedule}
                    disabled={
                      !formData.name ||
                      !formData.reportTemplate ||
                      formData.recipients.filter(e => e.trim() !== '' && isValidEmail(e.trim())).length === 0
                    }
                  >
                    {editingSchedule ? 'Update Schedule' : 'Create Schedule'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
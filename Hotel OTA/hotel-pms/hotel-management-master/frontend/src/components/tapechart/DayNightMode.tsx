import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/utils/toast';
import { withErrorBoundary } from '../ErrorBoundary';
import { nightAuditService } from '@/services/nightAuditService';
import {
  Sun, Moon, Clock, Calendar, Globe,
  Settings, Users, Building, MapPin,
  Sunrise, Sunset, Timer, RefreshCw,
  PlayCircle, CheckCircle2, XCircle, Loader2,
  Lock, AlertTriangle, ClipboardCheck, FileText,
  DollarSign, UserX, CreditCard, BarChart3
} from 'lucide-react';

// Day/Night Mode Types
interface OperationalHours {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  timezone: string;
  type: 'day' | 'night' | 'full_day' | 'custom';
  daysOfWeek: number[]; // 0=Sunday, 1=Monday, etc.
  enabled: boolean;
}

interface ShiftConfiguration {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  staff: number;
  color: string;
  permissions: string[];
  operationalMode: 'standard' | 'limited' | 'emergency';
  breakTimes: Array<{
    start: string;
    end: string;
    type: 'break' | 'meal';
  }>;
}

interface PropertySettings {
  propertyName: string;
  timezone: string;
  operationalCycle: 'midnight_to_midnight' | 'noon_to_noon' | 'custom';
  customStartTime: string;
  enableDayNightMode: boolean;
  autoSwitchTheme: boolean;
  seasonalAdjustments: boolean;
}

interface TimezoneSetting {
  propertyId: string;
  propertyName: string;
  timezone: string;
  currentTime: string;
  offset: string;
  daylightSaving: boolean;
}

// Night Audit Types (matching backend NightAudit model)
interface AuditStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  result?: Record<string, unknown>;
  errors?: string[];
  warnings?: string[];
}

interface AuditSummary {
  roomInventory?: {
    totalRooms: number;
    occupied: number;
    vacant: number;
    outOfOrder: number;
    discrepancies: number;
  };
  bookingReconciliation?: {
    totalBookings: number;
    confirmedArrivals: number;
    actualArrivals: number;
    noShows: number;
    cancellations: number;
    departures: number;
    stayovers: number;
  };
  revenue?: {
    roomRevenue: number;
    totalRevenue: number;
    journalEntriesCreated: number;
  };
  noShowProcessing?: {
    detected: number;
    processed: number;
    chargesApplied: number;
  };
  settlement?: {
    totalPaymentsReceived: number;
    totalChargesPosted: number;
    variance: number;
    unreconciledItems: number;
  };
}

interface NightAuditRecord {
  _id: string;
  hotelId: string;
  auditDate: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'partially_completed';
  startedAt?: string;
  completedAt?: string;
  initiatedBy: 'manual' | 'scheduled';
  initiatedByUser?: { _id: string; name: string } | null;
  steps: AuditStep[];
  summary: AuditSummary;
  locked: boolean;
  lockedAt?: string;
  lockedBy?: { _id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

const AUDIT_STEP_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  room_inventory_verification: { label: 'Room Inventory Verification', icon: <Building className="h-4 w-4" /> },
  booking_reconciliation: { label: 'Booking Reconciliation', icon: <ClipboardCheck className="h-4 w-4" /> },
  revenue_posting: { label: 'Revenue Posting', icon: <DollarSign className="h-4 w-4" /> },
  no_show_processing: { label: 'No-Show Processing', icon: <UserX className="h-4 w-4" /> },
  settlement_verification: { label: 'Settlement Verification', icon: <CreditCard className="h-4 w-4" /> },
  lock_day: { label: 'Lock Day', icon: <Lock className="h-4 w-4" /> },
};

const getStepStatusIcon = (status: AuditStep['status']) => {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case 'running':
      return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-600" />;
    case 'skipped':
      return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    case 'pending':
    default:
      return <Clock className="h-4 w-4 text-gray-400" />;
  }
};

const getStepStatusBadge = (status: AuditStep['status']) => {
  const styles: Record<string, string> = {
    completed: 'bg-green-100 text-green-800',
    running: 'bg-blue-100 text-blue-800',
    failed: 'bg-red-100 text-red-800',
    skipped: 'bg-yellow-100 text-yellow-800',
    pending: 'bg-gray-100 text-gray-600',
  };
  return styles[status] || styles.pending;
};

const getAuditStatusBadge = (status: NightAuditRecord['status']) => {
  const styles: Record<string, string> = {
    completed: 'bg-green-100 text-green-800',
    in_progress: 'bg-blue-100 text-blue-800',
    failed: 'bg-red-100 text-red-800',
    partially_completed: 'bg-yellow-100 text-yellow-800',
    pending: 'bg-gray-100 text-gray-600',
  };
  return styles[status] || styles.pending;
};

export const DayNightMode: React.FC = () => {
  const [currentMode, setCurrentMode] = useState<'day' | 'night' | 'auto'>('auto');
  const [propertySettings, setPropertySettings] = useState<PropertySettings>({
    propertyName: 'THE PENTOUZ Hotel',
    timezone: 'Asia/Kolkata',
    operationalCycle: 'midnight_to_midnight',
    customStartTime: '06:00',
    enableDayNightMode: true,
    autoSwitchTheme: true,
    seasonalAdjustments: false
  });

  const [operationalHours, setOperationalHours] = useState<OperationalHours[]>([]);
  const [shiftConfigs, setShiftConfigs] = useState<ShiftConfiguration[]>([]);
  const [timezoneSettings, setTimezoneSettings] = useState<TimezoneSetting[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Night Audit state
  const [auditHistory, setAuditHistory] = useState<NightAuditRecord[]>([]);
  const [activeAudit, setActiveAudit] = useState<NightAuditRecord | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditRunning, setAuditRunning] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditHistoryPage, setAuditHistoryPage] = useState(1);
  const [auditHistoryTotal, setAuditHistoryTotal] = useState(0);
  const AUDIT_PAGE_LIMIT = 10;

  const timezones = [
    { value: 'UTC', label: 'UTC - Coordinated Universal Time', offset: '+00:00' },
    { value: 'America/New_York', label: 'Eastern Time (US & Canada)', offset: '-05:00' },
    { value: 'America/Chicago', label: 'Central Time (US & Canada)', offset: '-06:00' },
    { value: 'America/Denver', label: 'Mountain Time (US & Canada)', offset: '-07:00' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (US & Canada)', offset: '-08:00' },
    { value: 'Europe/London', label: 'Greenwich Mean Time', offset: '+00:00' },
    { value: 'Europe/Paris', label: 'Central European Time', offset: '+01:00' },
    { value: 'Europe/Moscow', label: 'Moscow Time', offset: '+03:00' },
    { value: 'Asia/Dubai', label: 'Gulf Standard Time', offset: '+04:00' },
    { value: 'Asia/Kolkata', label: 'India Standard Time', offset: '+05:30' },
    { value: 'Asia/Singapore', label: 'Singapore Standard Time', offset: '+08:00' },
    { value: 'Asia/Tokyo', label: 'Japan Standard Time', offset: '+09:00' },
    { value: 'Australia/Sydney', label: 'Australian Eastern Time', offset: '+10:00' },
    { value: 'Pacific/Auckland', label: 'New Zealand Standard Time', offset: '+12:00' }
  ];

  const daysOfWeek = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
  ];

  useEffect(() => {
    initializeSettings();

    // Update current time every minute
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
      updateTimezoneClocks();
    }, 60000);

    // Check for auto mode changes
    const modeInterval = setInterval(() => {
      if (currentMode === 'auto' && propertySettings.autoSwitchTheme) {
        checkAutoModeSwitch();
      }
    }, 300000); // Check every 5 minutes

    return () => {
      clearInterval(timeInterval);
      clearInterval(modeInterval);
    };
  }, [currentMode, propertySettings]);

  const initializeSettings = () => {
    // Initialize operational hours
    const defaultOperationalHours: OperationalHours[] = [
      {
        id: 'day-shift',
        name: 'Day Shift',
        startTime: '06:00',
        endTime: '18:00',
        timezone: propertySettings.timezone,
        type: 'day',
        daysOfWeek: [1, 2, 3, 4, 5, 6, 0], // All days
        enabled: true
      },
      {
        id: 'night-shift',
        name: 'Night Shift',
        startTime: '18:00',
        endTime: '06:00',
        timezone: propertySettings.timezone,
        type: 'night',
        daysOfWeek: [1, 2, 3, 4, 5, 6, 0], // All days
        enabled: true
      },
      {
        id: 'business-hours',
        name: 'Business Hours',
        startTime: '09:00',
        endTime: '17:00',
        timezone: propertySettings.timezone,
        type: 'day',
        daysOfWeek: [1, 2, 3, 4, 5], // Weekdays only
        enabled: true
      }
    ];

    // Initialize shift configurations
    const defaultShifts: ShiftConfiguration[] = [
      {
        id: 'morning-shift',
        name: 'Morning Shift',
        startTime: '06:00',
        endTime: '14:00',
        staff: 12,
        color: '#FEF3C7', // Light yellow
        permissions: ['check_in', 'check_out', 'room_management', 'guest_services'],
        operationalMode: 'standard',
        breakTimes: [
          { start: '09:30', end: '09:45', type: 'break' },
          { start: '12:00', end: '13:00', type: 'meal' }
        ]
      },
      {
        id: 'afternoon-shift',
        name: 'Afternoon Shift',
        startTime: '14:00',
        endTime: '22:00',
        staff: 10,
        color: '#FED7AA', // Light orange
        permissions: ['check_in', 'check_out', 'room_management', 'guest_services', 'housekeeping'],
        operationalMode: 'standard',
        breakTimes: [
          { start: '17:00', end: '17:15', type: 'break' },
          { start: '19:00', end: '20:00', type: 'meal' }
        ]
      },
      {
        id: 'night-shift',
        name: 'Night Shift',
        startTime: '22:00',
        endTime: '06:00',
        staff: 6,
        color: '#E0E7FF', // Light indigo
        permissions: ['emergency_check_in', 'security', 'maintenance', 'night_audit'],
        operationalMode: 'limited',
        breakTimes: [
          { start: '02:00', end: '02:30', type: 'meal' },
          { start: '05:00', end: '05:15', type: 'break' }
        ]
      }
    ];

    // Initialize timezone settings for multi-property
    const defaultTimezones: TimezoneSetting[] = [
      {
        propertyId: 'prop-1',
        propertyName: 'THE PENTOUZ Delhi',
        timezone: 'Asia/Kolkata',
        currentTime: new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata' }),
        offset: '+05:30',
        daylightSaving: false
      },
      {
        propertyId: 'prop-2',
        propertyName: 'THE PENTOUZ Mumbai',
        timezone: 'Asia/Kolkata',
        currentTime: new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata' }),
        offset: '+05:30',
        daylightSaving: false
      },
      {
        propertyId: 'prop-3',
        propertyName: 'THE PENTOUZ Dubai',
        timezone: 'Asia/Dubai',
        currentTime: new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Dubai' }),
        offset: '+04:00',
        daylightSaving: false
      }
    ];

    setOperationalHours(defaultOperationalHours);
    setShiftConfigs(defaultShifts);
    setTimezoneSettings(defaultTimezones);
  };

  const updateTimezoneClocks = () => {
    setTimezoneSettings(prev =>
      prev.map(setting => ({
        ...setting,
        currentTime: new Date().toLocaleTimeString('en-US', { timeZone: setting.timezone })
      }))
    );
  };

  const checkAutoModeSwitch = () => {
    const now = new Date();
    const currentHour = now.getHours();

    // Determine if it's day or night based on typical hours
    // Day: 6 AM - 6 PM, Night: 6 PM - 6 AM
    const isDayTime = currentHour >= 6 && currentHour < 18;
    const newMode = isDayTime ? 'day' : 'night';

    if (newMode !== (currentMode === 'auto' ? (isDayTime ? 'day' : 'night') : currentMode)) {
      toast.info(`Automatically switched to ${newMode} mode`);
    }
  };

  const getCurrentShift = () => {
    const now = new Date();
    const currentTime = now.toTimeString().substring(0, 5);

    return shiftConfigs.find(shift => {
      const start = shift.startTime;
      const end = shift.endTime;

      // Handle overnight shifts
      if (start > end) {
        return currentTime >= start || currentTime <= end;
      } else {
        return currentTime >= start && currentTime <= end;
      }
    });
  };

  const getOperationalStatus = () => {
    const currentShift = getCurrentShift();
    if (!currentShift) return { status: 'closed', shift: null };

    return {
      status: currentShift.operationalMode === 'emergency' ? 'emergency' : 'open',
      shift: currentShift
    };
  };

  const toggleOperationalHours = (hoursId: string) => {
    setOperationalHours(prev =>
      prev.map(hours =>
        hours.id === hoursId ? { ...hours, enabled: !hours.enabled } : hours
      )
    );
  };

  const addCustomOperationalHours = () => {
    const newHours: OperationalHours = {
      id: `custom-${Date.now()}`,
      name: 'Custom Hours',
      startTime: '09:00',
      endTime: '17:00',
      timezone: propertySettings.timezone,
      type: 'custom',
      daysOfWeek: [1, 2, 3, 4, 5],
      enabled: true
    };

    setOperationalHours(prev => [...prev, newHours]);
    toast.success('Custom operational hours added');
  };

  const updatePropertyTimezone = (timezone: string) => {
    setPropertySettings(prev => ({ ...prev, timezone }));

    // Update all operational hours to use new timezone
    setOperationalHours(prev =>
      prev.map(hours => ({ ...hours, timezone }))
    );

    toast.success('Property timezone updated');
  };

  // --- Night Audit functions ---

  const fetchAuditHistory = useCallback(async (page = 1) => {
    setAuditLoading(true);
    setAuditError(null);
    try {
      const response = await nightAuditService.getAuditHistory({
        page,
        limit: AUDIT_PAGE_LIMIT,
      });
      const data = response.data || response;
      const audits: NightAuditRecord[] = data.data?.audits || data.audits || [];
      const pagination = data.pagination || {};
      setAuditHistory(audits);
      setAuditHistoryTotal(pagination.total || audits.length);
      setAuditHistoryPage(pagination.page || page);

      // If there's an in-progress audit, set it as the active one
      const running = audits.find(
        (a: NightAuditRecord) => a.status === 'in_progress'
      );
      if (running) {
        setActiveAudit(running);
      } else if (audits.length > 0) {
        setActiveAudit(audits[0]);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load audit history';
      setAuditError(message);
    } finally {
      setAuditLoading(false);
    }
  }, [AUDIT_PAGE_LIMIT]);

  const handleRunAudit = async () => {
    setAuditRunning(true);
    setAuditError(null);
    try {
      const response = await nightAuditService.runAudit({});
      const data = response.data || response;
      const audit: NightAuditRecord = data.data?.audit || data.audit;
      if (audit) {
        setActiveAudit(audit);
        toast.success('Night audit completed successfully');
      } else {
        toast.success('Night audit initiated');
      }
      // Refresh history to show the new audit
      await fetchAuditHistory(1);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to run night audit';
      setAuditError(message);
      toast.error(message);
    } finally {
      setAuditRunning(false);
    }
  };

  const handleLockAudit = async (auditId: string) => {
    try {
      await nightAuditService.lockAudit(auditId);
      toast.success('Audit day locked successfully');
      await fetchAuditHistory(auditHistoryPage);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to lock audit';
      toast.error(message);
    }
  };

  const handleViewAudit = (audit: NightAuditRecord) => {
    setActiveAudit(audit);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatAuditDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '--';
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const auditHistoryTotalPages = Math.ceil(auditHistoryTotal / AUDIT_PAGE_LIMIT);

  // --- End Night Audit functions ---

  const getThemeStyles = () => {
    const mode = currentMode === 'auto'
      ? (new Date().getHours() >= 6 && new Date().getHours() < 18 ? 'day' : 'night')
      : currentMode;

    return mode === 'day'
      ? 'bg-gradient-to-br from-yellow-50 to-orange-50'
      : 'bg-gradient-to-br from-indigo-900 to-purple-900 text-white';
  };

  const getModeIcon = () => {
    const mode = currentMode === 'auto'
      ? (new Date().getHours() >= 6 && new Date().getHours() < 18 ? 'day' : 'night')
      : currentMode;

    return mode === 'day' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />;
  };

  const operationalStatus = getOperationalStatus();
  const currentShift = getCurrentShift();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          {getModeIcon()}
          Day/Night Mode
          <Badge className="bg-indigo-100 text-indigo-800">Phase 3</Badge>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Day/Night Mode & Operational Flexibility
            <Badge className="bg-indigo-100 text-indigo-800">
              Innovation Leadership
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Flexible operational hours, shift-based views, and multi-timezone property management
          </DialogDescription>
        </DialogHeader>

        <div className={`rounded-lg p-4 mb-4 transition-all ${getThemeStyles()}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                {getModeIcon()}
                <span className="font-medium">
                  {currentMode === 'auto' ? 'Auto Mode' : `${currentMode.charAt(0).toUpperCase() + currentMode.slice(1)} Mode`}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span className="text-sm">
                  {currentTime.toLocaleTimeString()}
                </span>
              </div>

              {currentShift && (
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span className="text-sm">
                    {currentShift.name} ({currentShift.staff} staff)
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={currentMode === 'day' ? 'default' : 'outline'}
                onClick={() => setCurrentMode('day')}
                className="gap-1"
              >
                <Sun className="h-3 w-3" />
                Day
              </Button>
              <Button
                size="sm"
                variant={currentMode === 'night' ? 'default' : 'outline'}
                onClick={() => setCurrentMode('night')}
                className="gap-1"
              >
                <Moon className="h-3 w-3" />
                Night
              </Button>
              <Button
                size="sm"
                variant={currentMode === 'auto' ? 'default' : 'outline'}
                onClick={() => setCurrentMode('auto')}
                className="gap-1"
              >
                <Timer className="h-3 w-3" />
                Auto
              </Button>
            </div>
          </div>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="shifts">Shifts</TabsTrigger>
            <TabsTrigger value="hours">Operational Hours</TabsTrigger>
            <TabsTrigger value="timezones">Timezones</TabsTrigger>
            <TabsTrigger value="night-audit" onClick={() => { if (auditHistory.length === 0 && !auditLoading) fetchAuditHistory(); }}>Night Audit</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {/* Current Status Overview */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Property Status</p>
                      <p className={`text-2xl font-bold ${
                        operationalStatus.status === 'open' ? 'text-green-600' :
                        operationalStatus.status === 'emergency' ? 'text-orange-600' : 'text-red-600'
                      }`}>
                        {operationalStatus.status.toUpperCase()}
                      </p>
                      <p className="text-xs text-gray-600">
                        {operationalStatus.shift?.name || 'No active shift'}
                      </p>
                    </div>
                    <Building className={`h-8 w-8 ${
                      operationalStatus.status === 'open' ? 'text-green-600' :
                      operationalStatus.status === 'emergency' ? 'text-orange-600' : 'text-red-600'
                    }`} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Active Staff</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {currentShift?.staff || 0}
                      </p>
                      <p className="text-xs text-gray-600">On duty now</p>
                    </div>
                    <Users className="h-8 w-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Timezone</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {propertySettings.timezone.split('/')[1]}
                      </p>
                      <p className="text-xs text-gray-600">
                        {timezones.find(tz => tz.value === propertySettings.timezone)?.offset}
                      </p>
                    </div>
                    <Globe className="h-8 w-8 text-purple-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Current Shift Details */}
            {currentShift && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Current Shift: {currentShift.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <Label className="text-sm">Time</Label>
                      <div className="font-medium">
                        {currentShift.startTime} - {currentShift.endTime}
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm">Staff Count</Label>
                      <div className="font-medium">{currentShift.staff} members</div>
                    </div>

                    <div>
                      <Label className="text-sm">Mode</Label>
                      <Badge className={
                        currentShift.operationalMode === 'standard' ? 'bg-green-100 text-green-800' :
                        currentShift.operationalMode === 'limited' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }>
                        {currentShift.operationalMode.toUpperCase()}
                      </Badge>
                    </div>

                    <div>
                      <Label className="text-sm">Permissions</Label>
                      <div className="text-sm text-gray-600">
                        {currentShift.permissions.length} active
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <Label className="text-sm">Break Times</Label>
                    <div className="flex gap-2 mt-1">
                      {currentShift.breakTimes.map((breakTime, index) => (
                        <Badge key={`currentShift-breakTimes-${index}-${breakTime.type}`} variant="outline" className="text-xs">
                          {breakTime.start}-{breakTime.end} ({breakTime.type})
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Multi-Property Time Display */}
            <Card>
              <CardHeader>
                <CardTitle>Multi-Property Time Zones</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {timezoneSettings.map((setting) => (
                    <Card key={setting.propertyId} className="border-2">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{setting.propertyName}</div>
                            <div className="text-2xl font-bold text-blue-600">
                              {setting.currentTime}
                            </div>
                            <div className="text-xs text-gray-600">
                              {setting.timezone} ({setting.offset})
                            </div>
                          </div>
                          <div className="text-center">
                            <MapPin className="h-6 w-6 text-gray-400 mx-auto" />
                            {setting.daylightSaving && (
                              <Badge className="text-xs mt-1">DST</Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="shifts" className="space-y-4">
            {/* Shift Configurations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Shift Management
                  <Button size="sm" variant="outline">
                    Add Shift
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {shiftConfigs.map((shift) => (
                    <Card key={shift.id} className="border-l-4" style={{ borderLeftColor: shift.color }}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="font-medium text-lg">{shift.name}</div>
                            <div className="text-sm text-gray-600">
                              {shift.startTime} - {shift.endTime}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={
                              shift.operationalMode === 'standard' ? 'bg-green-100 text-green-800' :
                              shift.operationalMode === 'limited' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }>
                              {shift.operationalMode.toUpperCase()}
                            </Badge>
                            {shift.id === currentShift?.id && (
                              <Badge className="bg-blue-100 text-blue-800">ACTIVE</Badge>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                          <div>
                            <Label className="text-xs">Staff</Label>
                            <div className="font-medium">{shift.staff} members</div>
                          </div>

                          <div>
                            <Label className="text-xs">Permissions</Label>
                            <div className="text-sm">{shift.permissions.length} active</div>
                          </div>

                          <div>
                            <Label className="text-xs">Breaks</Label>
                            <div className="text-sm">{shift.breakTimes.length} scheduled</div>
                          </div>

                          <div>
                            <Label className="text-xs">Color</Label>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-4 h-4 rounded border"
                                style={{ backgroundColor: shift.color }}
                              />
                              <span className="text-sm">{shift.color}</span>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div>
                            <Label className="text-xs">Permissions</Label>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {shift.permissions.map((permission) => (
                                <Badge key={permission} variant="outline" className="text-xs">
                                  {permission.replace(/_/g, ' ')}
                                </Badge>
                              ))}
                            </div>
                          </div>

                          <div>
                            <Label className="text-xs">Break Schedule</Label>
                            <div className="flex gap-2 mt-1">
                              {shift.breakTimes.map((breakTime, index) => (
                                <Badge key={`shift-breakTimes-${index}-${breakTime.type}`} variant="secondary" className="text-xs">
                                  {breakTime.start}-{breakTime.end} ({breakTime.type})
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="hours" className="space-y-4">
            {/* Operational Hours Management */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Operational Hours
                  <Button size="sm" variant="outline" onClick={addCustomOperationalHours}>
                    Add Custom Hours
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {operationalHours.map((hours) => (
                    <Card key={hours.id} className="border">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <div className="font-medium">{hours.name}</div>
                              <Badge className={`${
                                hours.type === 'day' ? 'bg-yellow-100 text-yellow-800' :
                                hours.type === 'night' ? 'bg-indigo-100 text-indigo-800' :
                                hours.type === 'full_day' ? 'bg-green-100 text-green-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {hours.type.replace('_', ' ').toUpperCase()}
                              </Badge>
                            </div>
                            <div className="text-sm text-gray-600 mt-1">
                              {hours.startTime} - {hours.endTime}
                            </div>
                          </div>
                          <Switch
                            checked={hours.enabled}
                            onCheckedChange={() => toggleOperationalHours(hours.id)}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-xs">Timezone</Label>
                            <div className="text-sm">{hours.timezone}</div>
                          </div>

                          <div>
                            <Label className="text-xs">Active Days</Label>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {hours.daysOfWeek.map((day) => (
                                <Badge key={day} variant="outline" className="text-xs">
                                  {daysOfWeek[day].substring(0, 3)}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="timezones" className="space-y-4">
            {/* Timezone Management */}
            <Card>
              <CardHeader>
                <CardTitle>Multi-Property Timezone Management</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {timezoneSettings.map((setting) => (
                    <Card key={setting.propertyId}>
                      <CardContent className="p-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <Label className="text-sm">Property</Label>
                            <div className="font-medium">{setting.propertyName}</div>
                          </div>

                          <div>
                            <Label className="text-sm">Current Time</Label>
                            <div className="font-mono text-lg">{setting.currentTime}</div>
                          </div>

                          <div>
                            <Label className="text-sm">Timezone</Label>
                            <Select value={setting.timezone}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {timezones.map((tz) => (
                                  <SelectItem key={tz.value} value={tz.value}>
                                    {tz.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label className="text-sm">UTC Offset</Label>
                            <div className="font-medium">{setting.offset}</div>
                            {setting.daylightSaving && (
                              <Badge className="mt-1 text-xs">DST Active</Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="night-audit" className="space-y-4">
            <ScrollArea className="h-[60vh]">
              <div className="space-y-4 pr-4">
                {/* Action Bar */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    <h3 className="text-lg font-semibold">Night Audit</h3>
                    <Badge className="bg-indigo-100 text-indigo-800">Live</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => fetchAuditHistory(auditHistoryPage)}
                      disabled={auditLoading}
                    >
                      <RefreshCw className={`h-4 w-4 mr-1 ${auditLoading ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleRunAudit}
                      disabled={auditRunning}
                      className="gap-1"
                    >
                      {auditRunning ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <PlayCircle className="h-4 w-4" />
                      )}
                      {auditRunning ? 'Running Audit...' : 'Run Night Audit'}
                    </Button>
                  </div>
                </div>

                {/* Error State */}
                {auditError && (
                  <Card className="border-red-200 bg-red-50">
                    <CardContent className="p-4 flex items-center gap-3">
                      <XCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                      <div>
                        <p className="font-medium text-red-800">Error</p>
                        <p className="text-sm text-red-700">{auditError}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="ml-auto"
                        onClick={() => { setAuditError(null); fetchAuditHistory(); }}
                      >
                        Retry
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {/* Loading State */}
                {auditLoading && !activeAudit && (
                  <Card>
                    <CardContent className="p-8 flex flex-col items-center justify-center gap-3">
                      <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
                      <p className="text-sm text-gray-600">Loading audit data...</p>
                    </CardContent>
                  </Card>
                )}

                {/* Active Audit Detail */}
                {activeAudit && (
                  <>
                    {/* Audit Header */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <BarChart3 className="h-5 w-5" />
                            Audit: {formatAuditDate(activeAudit.auditDate)}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={getAuditStatusBadge(activeAudit.status)}>
                              {activeAudit.status.replace(/_/g, ' ').toUpperCase()}
                            </Badge>
                            {activeAudit.locked && (
                              <Badge className="bg-gray-200 text-gray-800">
                                <Lock className="h-3 w-3 mr-1" />
                                LOCKED
                              </Badge>
                            )}
                            {activeAudit.status === 'completed' && !activeAudit.locked && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleLockAudit(activeAudit._id)}
                              >
                                <Lock className="h-3 w-3 mr-1" />
                                Lock Day
                              </Button>
                            )}
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <Label className="text-xs text-gray-500">Initiated By</Label>
                            <div className="font-medium capitalize">{activeAudit.initiatedBy}</div>
                          </div>
                          <div>
                            <Label className="text-xs text-gray-500">User</Label>
                            <div className="font-medium">
                              {activeAudit.initiatedByUser?.name || 'System'}
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs text-gray-500">Started</Label>
                            <div className="font-medium">{formatTime(activeAudit.startedAt)}</div>
                          </div>
                          <div>
                            <Label className="text-xs text-gray-500">Completed</Label>
                            <div className="font-medium">{formatTime(activeAudit.completedAt)}</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Audit Steps */}
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Audit Steps</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {activeAudit.steps.map((step, index) => {
                            const stepMeta = AUDIT_STEP_LABELS[step.name] || {
                              label: step.name.replace(/_/g, ' '),
                              icon: <FileText className="h-4 w-4" />,
                            };
                            return (
                              <div
                                key={`audit-step-${index}-${step.name}`}
                                className="flex items-center gap-3 p-3 rounded-lg border bg-white"
                              >
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium text-gray-600">
                                  {index + 1}
                                </div>
                                <div className="flex-shrink-0">
                                  {stepMeta.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-sm">{stepMeta.label}</div>
                                  {step.errors && step.errors.length > 0 && (
                                    <div className="text-xs text-red-600 mt-0.5 truncate">
                                      {step.errors[0]}
                                    </div>
                                  )}
                                  {step.warnings && step.warnings.length > 0 && (
                                    <div className="text-xs text-yellow-600 mt-0.5 truncate">
                                      {step.warnings[0]}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {step.startedAt && step.completedAt && (
                                    <span className="text-xs text-gray-500">
                                      {formatTime(step.startedAt)} - {formatTime(step.completedAt)}
                                    </span>
                                  )}
                                  {getStepStatusIcon(step.status)}
                                  <Badge className={`text-xs ${getStepStatusBadge(step.status)}`}>
                                    {step.status.toUpperCase()}
                                  </Badge>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Audit Summary */}
                    {activeAudit.summary && activeAudit.status !== 'pending' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Room Inventory */}
                        {activeAudit.summary.roomInventory && (
                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm flex items-center gap-2">
                                <Building className="h-4 w-4" />
                                Room Inventory
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <div className="text-gray-500 text-xs">Total Rooms</div>
                                  <div className="text-lg font-bold">{activeAudit.summary.roomInventory.totalRooms}</div>
                                </div>
                                <div>
                                  <div className="text-gray-500 text-xs">Occupied</div>
                                  <div className="text-lg font-bold text-blue-600">{activeAudit.summary.roomInventory.occupied}</div>
                                </div>
                                <div>
                                  <div className="text-gray-500 text-xs">Vacant</div>
                                  <div className="text-lg font-bold text-green-600">{activeAudit.summary.roomInventory.vacant}</div>
                                </div>
                                <div>
                                  <div className="text-gray-500 text-xs">Out of Order</div>
                                  <div className="text-lg font-bold text-orange-600">{activeAudit.summary.roomInventory.outOfOrder}</div>
                                </div>
                                {activeAudit.summary.roomInventory.discrepancies > 0 && (
                                  <div className="col-span-2">
                                    <div className="flex items-center gap-1 text-red-600">
                                      <AlertTriangle className="h-3 w-3" />
                                      <span className="text-xs font-medium">
                                        {activeAudit.summary.roomInventory.discrepancies} discrepancies found
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {/* Booking Reconciliation */}
                        {activeAudit.summary.bookingReconciliation && (
                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm flex items-center gap-2">
                                <ClipboardCheck className="h-4 w-4" />
                                Booking Reconciliation
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <div className="text-gray-500 text-xs">Total Bookings</div>
                                  <div className="text-lg font-bold">{activeAudit.summary.bookingReconciliation.totalBookings}</div>
                                </div>
                                <div>
                                  <div className="text-gray-500 text-xs">Arrivals (Confirmed)</div>
                                  <div className="text-lg font-bold text-blue-600">{activeAudit.summary.bookingReconciliation.confirmedArrivals}</div>
                                </div>
                                <div>
                                  <div className="text-gray-500 text-xs">Actual Arrivals</div>
                                  <div className="text-lg font-bold text-green-600">{activeAudit.summary.bookingReconciliation.actualArrivals}</div>
                                </div>
                                <div>
                                  <div className="text-gray-500 text-xs">No-Shows</div>
                                  <div className="text-lg font-bold text-red-600">{activeAudit.summary.bookingReconciliation.noShows}</div>
                                </div>
                                <div>
                                  <div className="text-gray-500 text-xs">Cancellations</div>
                                  <div className="font-bold text-orange-600">{activeAudit.summary.bookingReconciliation.cancellations}</div>
                                </div>
                                <div>
                                  <div className="text-gray-500 text-xs">Departures</div>
                                  <div className="font-bold">{activeAudit.summary.bookingReconciliation.departures}</div>
                                </div>
                                <div className="col-span-2">
                                  <div className="text-gray-500 text-xs">Stayovers</div>
                                  <div className="font-bold">{activeAudit.summary.bookingReconciliation.stayovers}</div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {/* Revenue */}
                        {activeAudit.summary.revenue && (
                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm flex items-center gap-2">
                                <DollarSign className="h-4 w-4" />
                                Revenue
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <div className="text-gray-500 text-xs">Room Revenue</div>
                                  <div className="text-lg font-bold text-green-600">
                                    {formatCurrency(activeAudit.summary.revenue.roomRevenue)}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-gray-500 text-xs">Total Revenue</div>
                                  <div className="text-lg font-bold text-green-700">
                                    {formatCurrency(activeAudit.summary.revenue.totalRevenue)}
                                  </div>
                                </div>
                                <div className="col-span-2">
                                  <div className="text-gray-500 text-xs">Journal Entries Created</div>
                                  <div className="font-bold">{activeAudit.summary.revenue.journalEntriesCreated}</div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {/* No-Show Processing */}
                        {activeAudit.summary.noShowProcessing && (
                          <Card>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm flex items-center gap-2">
                                <UserX className="h-4 w-4" />
                                No-Show Processing
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <div className="text-gray-500 text-xs">Detected</div>
                                  <div className="text-lg font-bold">{activeAudit.summary.noShowProcessing.detected}</div>
                                </div>
                                <div>
                                  <div className="text-gray-500 text-xs">Processed</div>
                                  <div className="text-lg font-bold text-blue-600">{activeAudit.summary.noShowProcessing.processed}</div>
                                </div>
                                <div className="col-span-2">
                                  <div className="text-gray-500 text-xs">Charges Applied</div>
                                  <div className="text-lg font-bold text-orange-600">
                                    {formatCurrency(activeAudit.summary.noShowProcessing.chargesApplied)}
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {/* Settlement */}
                        {activeAudit.summary.settlement && (
                          <Card className="md:col-span-2">
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm flex items-center gap-2">
                                <CreditCard className="h-4 w-4" />
                                Settlement Verification
                              </CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                <div>
                                  <div className="text-gray-500 text-xs">Payments Received</div>
                                  <div className="text-lg font-bold text-green-600">
                                    {formatCurrency(activeAudit.summary.settlement.totalPaymentsReceived)}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-gray-500 text-xs">Charges Posted</div>
                                  <div className="text-lg font-bold text-blue-600">
                                    {formatCurrency(activeAudit.summary.settlement.totalChargesPosted)}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-gray-500 text-xs">Variance</div>
                                  <div className={`text-lg font-bold ${
                                    activeAudit.summary.settlement.variance !== 0 ? 'text-red-600' : 'text-green-600'
                                  }`}>
                                    {formatCurrency(activeAudit.summary.settlement.variance)}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-gray-500 text-xs">Unreconciled Items</div>
                                  <div className={`text-lg font-bold ${
                                    activeAudit.summary.settlement.unreconciledItems > 0 ? 'text-orange-600' : 'text-green-600'
                                  }`}>
                                    {activeAudit.summary.settlement.unreconciledItems}
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* Audit History */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Audit History
                      </span>
                      {auditHistoryTotal > 0 && (
                        <span className="text-sm font-normal text-gray-500">
                          {auditHistoryTotal} total audits
                        </span>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {auditHistory.length === 0 && !auditLoading && !auditError && (
                      <div className="text-center py-8 text-gray-500">
                        <FileText className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                        <p className="font-medium">No audit history yet</p>
                        <p className="text-sm mt-1">
                          Run a night audit to see results here.
                        </p>
                      </div>
                    )}

                    {auditHistory.length > 0 && (
                      <div className="space-y-2">
                        {auditHistory.map((audit) => (
                          <div
                            key={audit._id}
                            className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-gray-50 transition-colors ${
                              activeAudit?._id === audit._id ? 'border-blue-300 bg-blue-50' : ''
                            }`}
                            onClick={() => handleViewAudit(audit)}
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex-shrink-0">
                                {audit.status === 'completed' ? (
                                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                                ) : audit.status === 'failed' ? (
                                  <XCircle className="h-5 w-5 text-red-600" />
                                ) : audit.status === 'in_progress' ? (
                                  <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                                ) : (
                                  <Clock className="h-5 w-5 text-gray-400" />
                                )}
                              </div>
                              <div>
                                <div className="font-medium text-sm">
                                  {formatAuditDate(audit.auditDate)}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {audit.initiatedBy === 'manual' ? 'Manual' : 'Scheduled'}
                                  {audit.initiatedByUser?.name ? ` by ${audit.initiatedByUser.name}` : ''}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {audit.locked && (
                                <Lock className="h-3.5 w-3.5 text-gray-500" />
                              )}
                              <Badge className={`text-xs ${getAuditStatusBadge(audit.status)}`}>
                                {audit.status.replace(/_/g, ' ').toUpperCase()}
                              </Badge>
                            </div>
                          </div>
                        ))}

                        {/* Pagination */}
                        {auditHistoryTotalPages > 1 && (
                          <div className="flex items-center justify-between pt-3 border-t">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={auditHistoryPage <= 1 || auditLoading}
                              onClick={() => fetchAuditHistory(auditHistoryPage - 1)}
                            >
                              Previous
                            </Button>
                            <span className="text-sm text-gray-500">
                              Page {auditHistoryPage} of {auditHistoryTotalPages}
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={auditHistoryPage >= auditHistoryTotalPages || auditLoading}
                              onClick={() => fetchAuditHistory(auditHistoryPage + 1)}
                            >
                              Next
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            {/* Property Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Property Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Property Name</Label>
                    <Input
                      value={propertySettings.propertyName}
                      onChange={(e) => setPropertySettings(prev => ({ ...prev, propertyName: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Primary Timezone</Label>
                    <Select
                      value={propertySettings.timezone}
                      onValueChange={updatePropertyTimezone}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {timezones.map((tz) => (
                          <SelectItem key={tz.value} value={tz.value}>
                            {tz.label} ({tz.offset})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Operational Cycle</Label>
                  <Select
                    value={propertySettings.operationalCycle}
                    onValueChange={(value) => setPropertySettings(prev => ({ ...prev, operationalCycle: value as string }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="midnight_to_midnight">Midnight to Midnight</SelectItem>
                      <SelectItem value="noon_to_noon">Noon to Noon</SelectItem>
                      <SelectItem value="custom">Custom Start Time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {propertySettings.operationalCycle === 'custom' && (
                  <div className="space-y-2">
                    <Label>Custom Start Time</Label>
                    <Input
                      type="time"
                      value={propertySettings.customStartTime}
                      onChange={(e) => setPropertySettings(prev => ({ ...prev, customStartTime: e.target.value }))}
                    />
                  </div>
                )}

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Enable Day/Night Mode</Label>
                      <div className="text-sm text-gray-600 mt-1">
                        Automatically adjust interface based on time of day
                      </div>
                    </div>
                    <Switch
                      checked={propertySettings.enableDayNightMode}
                      onCheckedChange={(checked) => setPropertySettings(prev => ({ ...prev, enableDayNightMode: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Auto Switch Theme</Label>
                      <div className="text-sm text-gray-600 mt-1">
                        Automatically switch between light and dark themes
                      </div>
                    </div>
                    <Switch
                      checked={propertySettings.autoSwitchTheme}
                      onCheckedChange={(checked) => setPropertySettings(prev => ({ ...prev, autoSwitchTheme: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Seasonal Adjustments</Label>
                      <div className="text-sm text-gray-600 mt-1">
                        Adjust operational hours based on seasons
                      </div>
                    </div>
                    <Switch
                      checked={propertySettings.seasonalAdjustments}
                      onCheckedChange={(checked) => setPropertySettings(prev => ({ ...prev, seasonalAdjustments: checked }))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default withErrorBoundary(DayNightMode, { level: 'component' });
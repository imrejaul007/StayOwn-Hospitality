import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, addMinutes, addYears } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/textarea';
import { Checkbox } from '../ui/checkbox';
import { Select } from '../ui/Select';
import { Calendar } from '../ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Alert, AlertDescription } from '../ui/alert';
import { api } from '../../services/api';
import {
  Calendar as CalendarIcon,
  Clock,
  Info,
  Loader2,
  Eye,
  AlertCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cn } from '../../lib/utils';
import { ChangePreview } from './ChangePreview';

// Timezone options (common timezones)
const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'America/Phoenix', label: 'Arizona Time (AZ)' },
  { value: 'America/Anchorage', label: 'Alaska Time (AK)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (HI)' },
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'Asia/Shanghai', label: 'China (CST)' },
  { value: 'Asia/Tokyo', label: 'Japan (JST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEDT)' },
];

// Form validation schema
const scheduledUpdateSchema = z.object({
  scheduledDate: z.date({
    required_error: 'Scheduled date is required',
  }),
  scheduledTime: z.string().min(1, 'Scheduled time is required'),
  timezone: z.string().min(1, 'Timezone is required'),
  emailMe: z.boolean(),
  notifyManagers: z.boolean(),
  notes: z.string().max(500, 'Notes must be 500 characters or less').optional(),
}).refine((data) => {
  // Validate that scheduled time is at least 5 minutes in the future
  const now = new Date();
  const [hours, minutes] = data.scheduledTime.split(':').map(Number);
  const scheduledDateTime = new Date(data.scheduledDate);
  scheduledDateTime.setHours(hours, minutes, 0, 0);

  const minTime = addMinutes(now, 5);
  return scheduledDateTime >= minTime;
}, {
  message: 'Scheduled time must be at least 5 minutes in the future',
  path: ['scheduledTime'],
}).refine((data) => {
  // Validate that scheduled time is not more than 1 year in the future
  const now = new Date();
  const [hours, minutes] = data.scheduledTime.split(':').map(Number);
  const scheduledDateTime = new Date(data.scheduledDate);
  scheduledDateTime.setHours(hours, minutes, 0, 0);

  const maxTime = addYears(now, 1);
  return scheduledDateTime <= maxTime;
}, {
  message: 'Scheduled time cannot be more than 1 year in the future',
  path: ['scheduledDate'],
});

type ScheduledUpdateForm = z.infer<typeof scheduledUpdateSchema>;

interface ScheduledUpdateDialogProps {
  /**
   * Whether the dialog is open
   */
  isOpen: boolean;

  /**
   * Callback when dialog closes
   */
  onClose: () => void;

  /**
   * Callback when scheduling is successful
   */
  onSchedule?: (updateId: string, scheduledFor: Date) => void;

  /**
   * Setting type being scheduled
   */
  settingType: string;

  /**
   * Setting updates to schedule
   */
  settingUpdates: Record<string, unknown>;

  /**
   * Scope of the update
   */
  scope: 'single' | 'group' | 'all';

  /**
   * Property ID (required for single/group scope)
   */
  propertyId?: string;

  /**
   * Group ID (optional for group scope)
   */
  groupId?: string;

  /**
   * Setting name for display
   */
  settingName?: string;
}

export function ScheduledUpdateDialog({
  isOpen,
  onClose,
  onSchedule,
  settingType,
  settingUpdates,
  scope,
  propertyId,
  groupId,
  settingName = 'Settings'
}: ScheduledUpdateDialogProps) {
  const queryClient = useQueryClient();
  const [showPreview, setShowPreview] = useState(false);

  // Form setup
  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
    reset
  } = useForm<ScheduledUpdateForm>({
    resolver: zodResolver(scheduledUpdateSchema),
    defaultValues: {
      scheduledDate: new Date(),
      scheduledTime: '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
      emailMe: true,
      notifyManagers: false,
      notes: ''
    }
  });

  const watchedDate = watch('scheduledDate');
  const watchedTime = watch('scheduledTime');
  const watchedTimezone = watch('timezone');

  // Schedule mutation
  const scheduleMutation = useMutation({
    mutationFn: async (data: ScheduledUpdateForm) => {
      // Combine date and time
      const [hours, minutes] = data.scheduledTime.split(':').map(Number);
      const scheduledDateTime = new Date(data.scheduledDate);
      scheduledDateTime.setHours(hours, minutes, 0, 0);

      const response = await api.post('/scheduled-updates', {
        scheduledFor: scheduledDateTime.toISOString(),
        scope,
        propertyId,
        groupId,
        settingType,
        settingUpdates,
        settingName,
        notes: data.notes,
        notifications: {
          emailCreator: data.emailMe,
          notifyManagers: data.notifyManagers
        }
      });

      return response.data.data;
    },
    onSuccess: (data) => {
      const scheduledFor = new Date(data.update.scheduledFor);
      toast.success(
        `Update scheduled for ${format(scheduledFor, 'PPP')} at ${format(scheduledFor, 'p')}`,
        { duration: 5000 }
      );
      queryClient.invalidateQueries({ queryKey: ['scheduled-updates'] });
      reset();
      onClose();
      onSchedule?.(data.update._id, scheduledFor);
    },
    onError: (error: unknown) => {
      toast.error(error.response?.data?.message || 'Failed to schedule update');
    }
  });

  // Handle form submission
  const onSubmit = (data: ScheduledUpdateForm) => {
    scheduleMutation.mutate(data);
  };

  // Get preview text
  const getPreviewText = () => {
    if (!watchedDate || !watchedTime) return null;

    try {
      const [hours, minutes] = watchedTime.split(':').map(Number);
      const scheduledDateTime = new Date(watchedDate);
      scheduledDateTime.setHours(hours, minutes, 0, 0);

      const timezoneName = TIMEZONES.find(tz => tz.value === watchedTimezone)?.label || watchedTimezone;

      return `Scheduled for: ${format(scheduledDateTime, 'MMMM d, yyyy')} at ${format(scheduledDateTime, 'h:mm a')} ${timezoneName}`;
    } catch {
      return null;
    }
  };

  const handleClose = () => {
    if (!scheduleMutation.isPending) {
      reset();
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule Settings Update</DialogTitle>
          <DialogDescription>
            Schedule {settingName} to be applied at a specific date and time
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Date and Time Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
              <CalendarIcon className="h-5 w-5 text-gray-500" />
              <h3 className="text-lg font-semibold">Date & Time</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Date Picker */}
              <div className="space-y-2">
                <Label htmlFor="scheduledDate">
                  Date <span className="text-red-500">*</span>
                </Label>
                <Controller
                  control={control}
                  name="scheduledDate"
                  render={({ field }) => (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full justify-start text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? format(field.value, 'PPP') : 'Select date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                />
                {errors.scheduledDate && (
                  <p className="text-sm text-red-600">{errors.scheduledDate.message}</p>
                )}
              </div>

              {/* Time Input */}
              <div className="space-y-2">
                <Label htmlFor="scheduledTime">
                  Time <span className="text-red-500">*</span>
                </Label>
                <Controller
                  control={control}
                  name="scheduledTime"
                  render={({ field }) => (
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        {...field}
                        type="time"
                        className="pl-10"
                        placeholder="HH:MM"
                      />
                    </div>
                  )}
                />
                {errors.scheduledTime && (
                  <p className="text-sm text-red-600">{errors.scheduledTime.message}</p>
                )}
              </div>

              {/* Timezone Selector */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="timezone">
                  Timezone <span className="text-red-500">*</span>
                </Label>
                <Controller
                  control={control}
                  name="timezone"
                  render={({ field }) => (
                    <Select {...field}>
                      {TIMEZONES.map((tz) => (
                        <option key={tz.value} value={tz.value}>
                          {tz.label}
                        </option>
                      ))}
                    </Select>
                  )}
                />
              </div>
            </div>

            {/* Preview Text */}
            {getPreviewText() && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="font-medium">
                  {getPreviewText()}
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Preview Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b">
              <div className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-gray-500" />
                <h3 className="text-lg font-semibold">Preview Changes</h3>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
              >
                {showPreview ? 'Hide' : 'Show'} Preview
              </Button>
            </div>

            {showPreview && propertyId && (
              <ChangePreview
                scope={scope}
                propertyId={propertyId}
                groupId={groupId}
                settingType={settingType}
                settingUpdates={settingUpdates}
                showActions={false}
                className="border-0"
              />
            )}
          </div>

          {/* Notification Settings */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
              <AlertCircle className="h-5 w-5 text-gray-500" />
              <h3 className="text-lg font-semibold">Notifications</h3>
            </div>

            <div className="space-y-3">
              <Controller
                control={control}
                name="emailMe"
                render={({ field }) => (
                  <label className="flex items-center gap-3 cursor-pointer">
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                    <div>
                      <div className="text-sm font-medium">Email me when executed</div>
                      <div className="text-xs text-gray-500">
                        Get notified when the scheduled update is applied
                      </div>
                    </div>
                  </label>
                )}
              />

              <Controller
                control={control}
                name="notifyManagers"
                render={({ field }) => (
                  <label className="flex items-center gap-3 cursor-pointer">
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                    <div>
                      <div className="text-sm font-medium">Notify property managers</div>
                      <div className="text-xs text-gray-500">
                        Send notifications to managers of affected properties
                      </div>
                    </div>
                  </label>
                )}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">
              Notes <span className="text-gray-500">(optional)</span>
            </Label>
            <Controller
              control={control}
              name="notes"
              render={({ field }) => (
                <Textarea
                  {...field}
                  id="notes"
                  placeholder="Add any notes or reasons for scheduling this update..."
                  rows={4}
                  className="resize-none"
                />
              )}
            />
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Max 500 characters</span>
              <span>{watch('notes')?.length || 0}/500</span>
            </div>
            {errors.notes && (
              <p className="text-sm text-red-600">{errors.notes.message}</p>
            )}
          </div>

          {/* Info Alert */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              The scheduled update will be automatically executed at the specified time. You can cancel or reschedule it at any time before execution.
            </AlertDescription>
          </Alert>

          {/* Footer */}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={scheduleMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={scheduleMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {scheduleMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Scheduling...
                </>
              ) : (
                <>
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  Schedule Update
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default ScheduledUpdateDialog;

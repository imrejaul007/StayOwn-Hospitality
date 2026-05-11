import React, { useEffect } from 'react';
import { api } from '../../../services/api';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import {
  Bell,
  Users,
  ClipboardList,
  AlertTriangle,
  Volume2,
  Vibrate,
  Save,
  Loader2
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import toast from 'react-hot-toast';
import { withErrorBoundary } from '../../../components/ErrorBoundary';

interface StaffNotificationFormData {
  workAssignments: boolean;
  guestRequests: boolean;
  scheduleChanges: boolean;
  emergencyAlerts: boolean;
  maintenanceAlerts: boolean;
  inventoryAlerts: boolean;
  sound: boolean;
  vibration: boolean;
}

interface StaffNotificationSettingsProps {
  onSettingsChange?: (hasChanges: boolean) => void;
}

function StaffNotificationSettings({ onSettingsChange }: StaffNotificationSettingsProps = {}) {
  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { isDirty }
  } = useForm<StaffNotificationFormData>({
    defaultValues: {
      workAssignments: true,
      guestRequests: true,
      scheduleChanges: true,
      emergencyAlerts: true,
      maintenanceAlerts: true,
      inventoryAlerts: false,
      sound: true,
      vibration: true
    }
  });

  // Load saved notification preferences from backend
  // Uses /user-preferences/notifications which stores staff-specific category flags
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const { data: notifData } = await api.get('/user-preferences/notifications');

        const cats = notifData?.data?.notifications?.categories || {};
        const notifPrefs = notifData?.data?.notifications || {};

        setValue('workAssignments', cats.workAssignments ?? true, { shouldDirty: false });
        setValue('guestRequests', cats.guestRequests ?? true, { shouldDirty: false });
        setValue('scheduleChanges', cats.scheduleChanges ?? true, { shouldDirty: false });
        setValue('emergencyAlerts', cats.emergencyAlerts ?? true, { shouldDirty: false });
        setValue('maintenanceAlerts', cats.maintenanceAlerts ?? true, { shouldDirty: false });
        setValue('inventoryAlerts', cats.inventoryAlerts ?? false, { shouldDirty: false });
        setValue('sound', notifPrefs.sound ?? true, { shouldDirty: false });
        setValue('vibration', notifPrefs.vibration ?? true, { shouldDirty: false });
      } catch {
        // Use defaults if preferences not yet saved
      }
    };
    loadPreferences();
  }, [setValue]);

  // Watch for form changes
  useEffect(() => {
    if (onSettingsChange) {
      onSettingsChange(isDirty);
    }
  }, [isDirty, onSettingsChange]);

  // Save notification settings mutation
  // Persists to /user-preferences/notifications using the categories object
  const saveNotificationMutation = useMutation({
    mutationFn: async (data: StaffNotificationFormData) => {
      const { data: result } = await api.put('/user-preferences/notifications', {
        categories: {
          workAssignments: data.workAssignments,
          guestRequests: data.guestRequests,
          scheduleChanges: data.scheduleChanges,
          emergencyAlerts: data.emergencyAlerts,
          maintenanceAlerts: data.maintenanceAlerts,
          inventoryAlerts: data.inventoryAlerts
        },
        sound: data.sound,
        vibration: data.vibration
      });
      return { result, formData: data };
    },
    onSuccess: ({ formData }) => {
      reset(formData);
      toast.success('Notification settings updated successfully');
      if (onSettingsChange) {
        onSettingsChange(false);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update notification settings');
    }
  });

  const onSubmit = (data: StaffNotificationFormData) => {
    saveNotificationMutation.mutate(data);
  };

  return (
    <div className="p-6">
      <div className="max-w-3xl">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
            <Bell className="h-5 w-5" />
            <span>Notification Preferences</span>
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Configure which work-related notifications you want to receive
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Work Notifications */}
          <div>
            <h3 className="text-md font-medium text-gray-900 mb-4">Work Notifications</h3>
            <div className="space-y-4">
              <label className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                <input
                  {...register('workAssignments')}
                  type="checkbox"
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <ClipboardList className="h-5 w-5 text-gray-600" />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Work Assignments</p>
                  <p className="text-sm text-gray-500">New room assignments, daily checks, and task updates</p>
                </div>
              </label>

              <label className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                <input
                  {...register('guestRequests')}
                  type="checkbox"
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <Users className="h-5 w-5 text-gray-600" />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Guest Requests</p>
                  <p className="text-sm text-gray-500">Service requests, complaints, and guest inquiries</p>
                </div>
              </label>

              <label className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                <input
                  {...register('scheduleChanges')}
                  type="checkbox"
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <Bell className="h-5 w-5 text-gray-600" />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Schedule Changes</p>
                  <p className="text-sm text-gray-500">Shift updates, meeting reminders, and schedule modifications</p>
                </div>
              </label>

              <label className="flex items-center space-x-3 p-4 border border-red-200 rounded-lg hover:bg-red-50">
                <input
                  {...register('emergencyAlerts')}
                  type="checkbox"
                  className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <div className="flex-1">
                  <p className="font-medium text-red-900">Emergency Alerts</p>
                  <p className="text-sm text-red-600">Urgent notifications requiring immediate attention</p>
                </div>
              </label>

              <label className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                <input
                  {...register('maintenanceAlerts')}
                  type="checkbox"
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <AlertTriangle className="h-5 w-5 text-gray-600" />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Maintenance Alerts</p>
                  <p className="text-sm text-gray-500">Equipment issues, repair requests, and maintenance updates</p>
                </div>
              </label>

              <label className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                <input
                  {...register('inventoryAlerts')}
                  type="checkbox"
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <ClipboardList className="h-5 w-5 text-gray-600" />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Inventory Updates</p>
                  <p className="text-sm text-gray-500">Low stock alerts, supply requests, and inventory changes</p>
                </div>
              </label>
            </div>
          </div>

          {/* Notification Method */}
          <div>
            <h3 className="text-md font-medium text-gray-900 mb-4">Notification Method</h3>
            <div className="space-y-4">
              <label className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                <input
                  {...register('sound')}
                  type="checkbox"
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <Volume2 className="h-5 w-5 text-gray-600" />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Sound Notifications</p>
                  <p className="text-sm text-gray-500">Play sound when receiving notifications</p>
                </div>
              </label>

              <label className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                <input
                  {...register('vibration')}
                  type="checkbox"
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <Vibrate className="h-5 w-5 text-gray-600" />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Vibration</p>
                  <p className="text-sm text-gray-500">Vibrate device for notifications (mobile only)</p>
                </div>
              </label>
            </div>
          </div>

          {/* Priority Information */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Important Notes</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Emergency alerts cannot be disabled for safety reasons</li>
              <li>• Work assignment notifications are required for job functionality</li>
              <li>• You can still receive notifications in the app even if other methods are disabled</li>
            </ul>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-4 border-t border-gray-200">
            <Button
              type="submit"
              disabled={!isDirty || saveNotificationMutation.isPending}
              className="flex items-center space-x-2"
            >
              {saveNotificationMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span>Save Changes</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default withErrorBoundary(StaffNotificationSettings);

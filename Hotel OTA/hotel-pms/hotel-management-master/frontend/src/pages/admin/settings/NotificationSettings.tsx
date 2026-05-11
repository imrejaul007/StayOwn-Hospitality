import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import {
  Bell,
  Mail,
  Smartphone,
  Volume2,
  VolumeX,
  Clock,
  Save,
  Loader2
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import toast from 'react-hot-toast';
import { api } from '../../../services/api';
import { withErrorBoundary } from '../../../components/ErrorBoundary';

interface NotificationFormData {
  channels: {
    inApp: boolean;
    email: boolean;
    push: boolean;
  };
  categories: {
    bookings: boolean;
    payments: boolean;
    system: boolean;
    maintenance: boolean;
    workAssignments: boolean;
    guestRequests: boolean;
    scheduleChanges: boolean;
    emergencyAlerts: boolean;
  };
  quietHours: {
    enabled: boolean;
    start: string;
    end: string;
  };
  sound: boolean;
  desktop: boolean;
  vibration: boolean;
}

interface NotificationSettingsProps {
  onSettingsChange?: (hasChanges: boolean) => void;
}

function NotificationSettings({ onSettingsChange }: NotificationSettingsProps = {}) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { isDirty }
  } = useForm<NotificationFormData>({
    defaultValues: {
      channels: {
        inApp: true,
        email: true,
        push: true
      },
      categories: {
        bookings: true,
        payments: true,
        system: true,
        maintenance: true,
        workAssignments: true,
        guestRequests: true,
        scheduleChanges: true,
        emergencyAlerts: true
      },
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00'
      },
      sound: true,
      desktop: true,
      vibration: true
    }
  });

  const watchedValues = watch();

  // Fetch current notification settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data } = await api.get('/notifications/preferences');
        const preferences = data.data.preferences;
        if (preferences) {

          // Update form with current settings from the actual API structure
          setValue('channels.inApp', preferences.inApp?.enabled ?? true, { shouldDirty: false });
          setValue('channels.email', preferences.email?.enabled ?? true, { shouldDirty: false });
          setValue('channels.push', preferences.push?.enabled ?? true, { shouldDirty: false });

          // Map notification types to our categories
          setValue('categories.bookings', preferences.email?.types?.booking_confirmation ?? true, { shouldDirty: false });
          setValue('categories.payments', preferences.email?.types?.payment_success ?? true, { shouldDirty: false });
          setValue('categories.system', preferences.email?.types?.system_alert ?? true, { shouldDirty: false });
          setValue('categories.maintenance', preferences.email?.types?.service_booking ?? true, { shouldDirty: false });
          setValue('categories.workAssignments', preferences.inApp?.types?.booking_confirmation ?? true, { shouldDirty: false });
          setValue('categories.guestRequests', preferences.email?.types?.service_booking ?? true, { shouldDirty: false });
          setValue('categories.scheduleChanges', preferences.email?.types?.booking_reminder ?? true, { shouldDirty: false });
          setValue('categories.emergencyAlerts', preferences.email?.types?.system_alert ?? true, { shouldDirty: false });

          setValue('quietHours.enabled', preferences.email?.quietHours?.enabled ?? false, { shouldDirty: false });
          setValue('quietHours.start', preferences.email?.quietHours?.start ?? '22:00', { shouldDirty: false });
          setValue('quietHours.end', preferences.email?.quietHours?.end ?? '08:00', { shouldDirty: false });

          setValue('sound', preferences.inApp?.sound ?? true, { shouldDirty: false });
          setValue('desktop', true, { shouldDirty: false });
          setValue('vibration', preferences.inApp?.vibration ?? true, { shouldDirty: false });
        }
      } catch {
        // Error handled silently
      }
    };

    fetchSettings();
  }, [setValue]);

  // Watch for form changes
  useEffect(() => {
    if (onSettingsChange) {
      onSettingsChange(isDirty);
    }
  }, [isDirty, onSettingsChange]);

  // Save notification settings mutation
  const saveNotificationMutation = useMutation({
    mutationFn: async (data: NotificationFormData) => {
      // Transform the form data to match the backend API structure
      const apiData = {
        email: {
          enabled: data.channels.email,
          types: {
            booking_confirmation: data.categories.bookings,
            booking_reminder: data.categories.bookings,
            booking_cancellation: data.categories.bookings,
            payment_success: data.categories.payments,
            payment_failed: data.categories.payments,
            system_alert: data.categories.system,
            loyalty_points: true,
            service_booking: data.categories.guestRequests,
            service_reminder: data.categories.guestRequests,
            promotional: true,
            welcome: true,
            check_in: data.categories.bookings,
            check_out: data.categories.bookings,
            review_request: true,
            special_offer: true
          },
          quietHours: {
            enabled: data.quietHours.enabled,
            start: data.quietHours.start,
            end: data.quietHours.end
          }
        },
        push: {
          enabled: data.channels.push,
          types: {
            booking_confirmation: data.categories.bookings,
            booking_reminder: data.categories.bookings,
            payment_success: data.categories.payments,
            loyalty_points: true,
            system_alert: data.categories.system,
            booking_cancellation: data.categories.bookings,
            payment_failed: data.categories.payments,
            service_booking: data.categories.guestRequests,
            service_reminder: data.categories.guestRequests,
            promotional: true,
            welcome: true,
            check_in: data.categories.bookings,
            check_out: data.categories.bookings,
            review_request: true,
            special_offer: true
          },
          quietHours: {
            enabled: data.quietHours.enabled,
            start: data.quietHours.start,
            end: data.quietHours.end
          }
        },
        inApp: {
          enabled: data.channels.inApp,
          sound: data.sound,
          vibration: data.vibration,
          showBadge: true,
          types: {
            booking_confirmation: data.categories.bookings,
            booking_reminder: data.categories.bookings,
            loyalty_points: true,
            system_alert: data.categories.system,
            welcome: true,
            booking_cancellation: data.categories.bookings,
            payment_success: data.categories.payments,
            payment_failed: data.categories.payments,
            service_booking: data.categories.guestRequests,
            service_reminder: data.categories.guestRequests,
            promotional: true,
            check_in: data.categories.bookings,
            check_out: data.categories.bookings,
            review_request: true,
            special_offer: true
          }
        }
      };

      try {
        // Backend expects { channel, settings } per call, so send one request per channel
        const results = await Promise.all(
          Object.entries(apiData).map(([channel, settings]) =>
            api.patch('/notifications/preferences', { channel, settings })
          )
        );
        return results[results.length - 1].data;
      } catch (error: unknown) {
        throw error instanceof Error ? error : new Error('Failed to save notification preferences');
      }
    },
    onSuccess: () => {
      toast.success('Notification settings updated successfully');

      // Reset the form's dirty state without changing values
      // This tells the form that the current values are now the "saved" state
      const currentValues = watch();
      Object.keys(currentValues).forEach(key => {
        if (typeof currentValues[key] === 'object' && currentValues[key] !== null) {
          Object.keys(currentValues[key]).forEach(subKey => {
            setValue(`${key}.${subKey}`, currentValues[key][subKey], { shouldDirty: false });
          });
        } else {
          setValue(key, currentValues[key], { shouldDirty: false });
        }
      });

      if (onSettingsChange) {
        onSettingsChange(false);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update notification settings');
    }
  });

  const onSubmit = (data: NotificationFormData) => {
    saveNotificationMutation.mutate(data);
  };

  const categoryLabels = {
    bookings: 'Booking Updates',
    payments: 'Payment Notifications',
    system: 'System Alerts',
    maintenance: 'Maintenance Alerts',
    workAssignments: 'Work Assignments',
    guestRequests: 'Guest Requests',
    scheduleChanges: 'Schedule Changes',
    emergencyAlerts: 'Emergency Alerts'
  };

  return (
    <div className="p-6">
      <div className="max-w-3xl">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
            <Bell className="h-5 w-5" />
            <span>Notification Settings</span>
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Configure how and when you want to receive notifications
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Notification Channels */}
          <div>
            <h3 className="text-md font-medium text-gray-900 mb-4">Notification Channels</h3>
            <div className="space-y-4">
              <label className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                <input
                  {...register('channels.inApp')}
                  type="checkbox"
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <Smartphone className="h-5 w-5 text-gray-600" />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">In-App Notifications</p>
                  <p className="text-sm text-gray-500">Receive notifications within the application</p>
                </div>
              </label>

              <label className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                <input
                  {...register('channels.email')}
                  type="checkbox"
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <Mail className="h-5 w-5 text-gray-600" />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Email Notifications</p>
                  <p className="text-sm text-gray-500">Receive notifications via email</p>
                </div>
              </label>


              <label className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                <input
                  {...register('channels.push')}
                  type="checkbox"
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <Bell className="h-5 w-5 text-gray-600" />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Push Notifications</p>
                  <p className="text-sm text-gray-500">Receive browser push notifications</p>
                </div>
              </label>
            </div>
          </div>

          {/* Notification Categories */}
          <div>
            <h3 className="text-md font-medium text-gray-900 mb-4">Notification Categories</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(categoryLabels).map(([key, label]) => (
                <label key={key} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <input
                    {...register(`categories.${key}` as keyof NotificationFormData['categories'])}
                    type="checkbox"
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-medium text-gray-900">{label}</span>
                </label>
              ))}
            </div>
          </div>


          {/* Quiet Hours */}
          <div>
            <h3 className="text-md font-medium text-gray-900 mb-4 flex items-center space-x-2">
              <Clock className="h-4 w-4" />
              <span>Quiet Hours</span>
            </h3>
            <div className="space-y-4">
              <label className="flex items-center space-x-3">
                <input
                  {...register('quietHours.enabled')}
                  type="checkbox"
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="font-medium text-gray-900">Enable Quiet Hours</span>
              </label>

              {watchedValues.quietHours?.enabled && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Time
                    </label>
                    <input
                      {...register('quietHours.start')}
                      type="time"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Time
                    </label>
                    <input
                      {...register('quietHours.end')}
                      type="time"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Additional Settings */}
          <div>
            <h3 className="text-md font-medium text-gray-900 mb-4">Additional Settings</h3>
            <div className="space-y-4">
              <label className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                <input
                  {...register('sound')}
                  type="checkbox"
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                {watchedValues.sound ? (
                  <Volume2 className="h-5 w-5 text-gray-600" />
                ) : (
                  <VolumeX className="h-5 w-5 text-gray-600" />
                )}
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Sound Notifications</p>
                  <p className="text-sm text-gray-500">Play sound when receiving notifications</p>
                </div>
              </label>

              <label className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                <input
                  {...register('desktop')}
                  type="checkbox"
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <Bell className="h-5 w-5 text-gray-600" />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Desktop Notifications</p>
                  <p className="text-sm text-gray-500">Show desktop notifications when browser is minimized</p>
                </div>
              </label>

              <label className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                <input
                  {...register('vibration')}
                  type="checkbox"
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <Smartphone className="h-5 w-5 text-gray-600" />
                <div className="flex-1">
                  <p className="font-medium text-gray-900">Vibration</p>
                  <p className="text-sm text-gray-500">Vibrate device for notifications (mobile only)</p>
                </div>
              </label>
            </div>
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

export default withErrorBoundary(NotificationSettings);

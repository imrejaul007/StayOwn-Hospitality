import React, { useState, useEffect, useRef} from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  Clock,
  Ban,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  Shield
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import toast from 'react-hot-toast';
import { ApplyToSelector, ApplyToConfirmation, ApplyToScope } from '../../../components/settings/ApplyToSelector';
import { useSettingsInheritance, useAffectedPropertiesCount } from '../../../hooks/useSettingsInheritance';
import { useProperty } from '../../../context/PropertyContext';
import { Card, CardContent } from '../../../components/ui/card';
import { api } from '../../../services/api';
import { withErrorBoundary } from '../../../components/ErrorBoundary';

interface BookingRulesFormData {
  minimumStay: {
    enabled: boolean;
    nights: number;
    applyToWeekends: boolean;
  };
  maximumStay: {
    enabled: boolean;
    nights: number;
  };
  advanceBooking: {
    minDays: number;
    maxDays: number;
  };
  cutoffTime: {
    hours: number;
    sameDay: boolean;
  };
  blackoutDates: {
    enabled: boolean;
    dates: string[];
  };
  cancellationWindow: {
    hours: number;
    penaltyPercentage: number;
  };
  gapRules: {
    enabled: boolean;
    minGapNights: number;
  };
}

interface BookingRulesSettingsProps {
  onSettingsChange?: (hasChanges: boolean) => void;
}

function BookingRulesSettings({ onSettingsChange }: BookingRulesSettingsProps = {}) {
  const { selectedProperty, selectedPropertyId } = useProperty();
  const queryClient = useQueryClient();

  // Multi-property support
  const [applyToScope, setApplyToScope] = useState<ApplyToScope>('single');
  const [showSuccess, setShowSuccess] = useState(false);

  const {
    useInheritanceStatus,
    applySettings,
    isUpdating,
    updateError,
    showConfirmation,
    pendingUpdate,
    confirmBulkUpdate,
    cancelBulkUpdate,
  } = useSettingsInheritance();

  const { data: inheritanceStatus } = useInheritanceStatus(selectedPropertyId);
  const affectedCount = useAffectedPropertiesCount(
    applyToScope,
    inheritanceStatus?.groupPropertyCount || 0
  );

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty }
  } = useForm<BookingRulesFormData>({
    defaultValues: {
      minimumStay: {
        enabled: false,
        nights: 1,
        applyToWeekends: false
      },
      maximumStay: {
        enabled: false,
        nights: 30
      },
      advanceBooking: {
        minDays: 0,
        maxDays: 365
      },
      cutoffTime: {
        hours: 24,
        sameDay: false
      },
      blackoutDates: {
        enabled: false,
        dates: []
      },
      cancellationWindow: {
        hours: 24,
        penaltyPercentage: 0
      },
      gapRules: {
        enabled: false,
        minGapNights: 1
      }
    }
  });

  // Watch for form changes
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (onSettingsChange) {
      onSettingsChange(isDirty);
    }
  }, [isDirty, onSettingsChange]);

  // Fetch booking rules settings
  const { data: bookingRules, isLoading } = useQuery({
    queryKey: ['booking-rules-settings', selectedPropertyId],
    queryFn: async () => {
      const { data } = await api.get('/hotel-settings/booking-rules', {
        params: { propertyId: selectedPropertyId }
      });
      return data.data.bookingRules;
    }
  });

  // Update form values when booking rules data changes
  useEffect(() => {
    if (bookingRules) {
      setValue('minimumStay', bookingRules.minimumStay || {}, { shouldDirty: false });
      setValue('maximumStay', bookingRules.maximumStay || {}, { shouldDirty: false });
      setValue('advanceBooking', bookingRules.advanceBooking || {}, { shouldDirty: false });
      setValue('cutoffTime', bookingRules.cutoffTime || {}, { shouldDirty: false });
      setValue('blackoutDates', bookingRules.blackoutDates || {}, { shouldDirty: false });
      setValue('cancellationWindow', bookingRules.cancellationWindow || {}, { shouldDirty: false });
      setValue('gapRules', bookingRules.gapRules || {}, { shouldDirty: false });
    }
  }, [bookingRules, setValue]);

  const onSubmit = async (data: BookingRulesFormData) => {
    try {
      if (applyToScope !== 'single') {
        const result = await applySettings({
          scope: applyToScope,
          propertyId: selectedPropertyId,
          settingUpdates: data,
          settingType: 'booking_rules',
        });

        if (!result) return; // Confirmation dialog shown

        setShowSuccess(true);
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => setShowSuccess(false), 3000);
        toast.success(`Booking rules updated successfully${
          applyToScope !== 'single' ? ` for ${result.propertiesUpdated} properties` : ''
        }`);
        setApplyToScope('single');
      } else {
        // Single property update
        await api.put('/hotel-settings/booking-rules', {
          propertyId: selectedPropertyId,
          ...data
        });

        setShowSuccess(true);
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => setShowSuccess(false), 3000);
        toast.success('Booking rules updated successfully');
      }

      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['booking-rules-settings'] });

      // Reset form dirty state
      const currentValues = watch();
      Object.keys(currentValues).forEach(key => {
        setValue(key as keyof BookingRulesFormData, currentValues[key], { shouldDirty: false });
      });

      if (onSettingsChange) {
        onSettingsChange(false);
      }
    } catch (error) {
      toast.error('Failed to update booking rules');
    }
  };

  const handleConfirm = async () => {
    if (pendingUpdate) {
      const result = await confirmBulkUpdate();
      if (result) {
        setShowSuccess(true);
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => setShowSuccess(false), 3000);
        toast.success(`Settings updated for ${result.propertiesUpdated} properties`);
        setApplyToScope('single');
        queryClient.invalidateQueries({ queryKey: ['booking-rules-settings'] });

        if (onSettingsChange) {
          onSettingsChange(false);
        }
      }
    }
  };

  const minimumStayEnabled = watch('minimumStay.enabled');
  const maximumStayEnabled = watch('maximumStay.enabled');
  const blackoutDatesEnabled = watch('blackoutDates.enabled');
  const gapRulesEnabled = watch('gapRules.enabled');

  if (isLoading) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 transition-colors">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white dark:bg-gray-800 transition-colors">
      <div className="max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>Booking Rules</span>
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Configure booking restrictions, advance booking rules, and blackout dates
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Success Message */}
          {showSuccess && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 px-4 py-3 rounded-lg mb-4">
              <p className="font-medium">Booking rules updated successfully!</p>
              {applyToScope !== 'single' && affectedCount > 1 && (
                <p className="text-sm mt-1">Changes applied to {affectedCount} properties</p>
              )}
            </div>
          )}

          {/* Error Message */}
          {updateError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded-lg mb-4">
              <p className="font-medium">Error: {updateError}</p>
            </div>
          )}

          {/* Inheritance Status Card */}
          {inheritanceStatus?.isInheriting && inheritanceStatus?.hasGroup && (
            <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 mb-4">
              <CardContent className="p-4">
                <div className="flex items-start">
                  <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      This property is part of: {inheritanceStatus.groupName}
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                      Booking rules are inherited from the property group.
                      {inheritanceStatus.lastSyncedAt && (
                        <span className="ml-1">
                          Last synced: {new Date(inheritanceStatus.lastSyncedAt).toLocaleString()}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Minimum Stay Requirements */}
          <div>
            <h3 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center space-x-2">
              <Calendar className="h-4 w-4" />
              <span>Minimum Stay Requirements</span>
            </h3>
            <div className="space-y-4">
              <label className="flex items-center space-x-3">
                <input
                  {...register('minimumStay.enabled')}
                  type="checkbox"
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                <span className="font-medium text-gray-900 dark:text-gray-100">Enable Minimum Stay Requirement</span>
              </label>

              {minimumStayEnabled && (
                <div className="ml-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Minimum Nights
                      </label>
                      <input
                        {...register('minimumStay.nights', { min: 1, max: 30 })}
                        type="number"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <label className="flex items-center space-x-3">
                    <input
                      {...register('minimumStay.applyToWeekends')}
                      type="checkbox"
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Apply only to weekends (Fri-Sat)</span>
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Maximum Stay Limit */}
          <div>
            <h3 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center space-x-2">
              <Calendar className="h-4 w-4" />
              <span>Maximum Stay Limit</span>
            </h3>
            <div className="space-y-4">
              <label className="flex items-center space-x-3">
                <input
                  {...register('maximumStay.enabled')}
                  type="checkbox"
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                <span className="font-medium text-gray-900 dark:text-gray-100">Enable Maximum Stay Limit</span>
              </label>

              {maximumStayEnabled && (
                <div className="ml-6">
                  <div className="max-w-xs">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Maximum Nights
                    </label>
                    <input
                      {...register('maximumStay.nights', { min: 1, max: 365 })}
                      type="number"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Advance Booking Window */}
          <div>
            <h3 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center space-x-2">
              <Clock className="h-4 w-4" />
              <span>Advance Booking Window</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Minimum Advance Days
                </label>
                <input
                  {...register('advanceBooking.minDays', { min: 0, max: 365 })}
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Guests must book at least this many days in advance
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Maximum Advance Days
                </label>
                <input
                  {...register('advanceBooking.maxDays', { min: 1, max: 730 })}
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Maximum days in advance guests can book
                </p>
              </div>
            </div>
          </div>

          {/* Booking Cutoff Time */}
          <div>
            <h3 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center space-x-2">
              <Clock className="h-4 w-4" />
              <span>Booking Cutoff Time</span>
            </h3>
            <div className="space-y-4">
              <div className="max-w-xs">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Cutoff Hours Before Check-in
                </label>
                <input
                  {...register('cutoffTime.hours', { min: 0, max: 168 })}
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Stop accepting bookings this many hours before check-in
                </p>
              </div>

              <label className="flex items-center space-x-3">
                <input
                  {...register('cutoffTime.sameDay')}
                  type="checkbox"
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Allow same-day bookings</span>
              </label>
            </div>
          </div>

          {/* Cancellation Window */}
          <div>
            <h3 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center space-x-2">
              <Ban className="h-4 w-4" />
              <span>Cancellation Window</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Free Cancellation Hours
                </label>
                <input
                  {...register('cancellationWindow.hours', { min: 0, max: 168 })}
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Free cancellation up to this many hours before check-in
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Late Cancellation Penalty (%)
                </label>
                <input
                  {...register('cancellationWindow.penaltyPercentage', { min: 0, max: 100 })}
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Percentage of total booking amount charged for late cancellations
                </p>
              </div>
            </div>
          </div>

          {/* Gap Rules */}
          <div>
            <h3 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center space-x-2">
              <Calendar className="h-4 w-4" />
              <span>Gap Rules</span>
            </h3>
            <div className="space-y-4">
              <label className="flex items-center space-x-3">
                <input
                  {...register('gapRules.enabled')}
                  type="checkbox"
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                <span className="font-medium text-gray-900 dark:text-gray-100">Enable Gap Rules</span>
              </label>

              {gapRulesEnabled && (
                <div className="ml-6">
                  <div className="max-w-xs">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Minimum Gap Nights
                    </label>
                    <input
                      {...register('gapRules.minGapNights', { min: 1, max: 7 })}
                      type="number"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Prevent bookings that leave gaps smaller than this between reservations
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Multi-property selector */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
            <ApplyToSelector
              value={applyToScope}
              onChange={setApplyToScope}
              isInGroup={inheritanceStatus?.hasGroup || false}
              groupName={inheritanceStatus?.groupName}
              totalProperties={inheritanceStatus?.groupPropertyCount || 0}
              showWarning={true}
              warningMessage="These booking rules will be applied to all selected properties. Ensure restrictions like minimum stay, advance booking, and blackout dates are appropriate for all properties."
            />
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-600">
            <Button
              type="submit"
              disabled={!isDirty || isUpdating}
              className="flex items-center space-x-2"
            >
              {isUpdating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span>{isUpdating ? 'Saving...' : 'Save Changes'}</span>
            </Button>
          </div>
        </form>

        {/* Confirmation Dialog */}
        <ApplyToConfirmation
          isOpen={showConfirmation}
          scope={applyToScope}
          affectedCount={affectedCount}
          settingName="Booking Rules"
          groupName={inheritanceStatus?.groupName}
          onConfirm={handleConfirm}
          onCancel={cancelBulkUpdate}
        />
      </div>
    </div>
  );
}

export default withErrorBoundary(BookingRulesSettings);

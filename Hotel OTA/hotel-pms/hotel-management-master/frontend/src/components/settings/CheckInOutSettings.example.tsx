/**
 * CheckInOutSettings Component
 *
 * EXAMPLE IMPLEMENTATION for Phase 4: Settings Pages with Group Inheritance
 *
 * This component demonstrates the pattern for updating settings pages to support:
 * - Single property updates
 * - Property group updates
 * - All properties updates
 *
 * Use this as a template for updating the 30 settings pages.
 */

import React, { useState, useEffect, useRef} from 'react';
import { Clock, Save, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';
import { ApplyToSelector, ApplyToConfirmation, ApplyToScope } from './ApplyToSelector';
import { useSettingsInheritance, useAffectedPropertiesCount } from '../../hooks/useSettingsInheritance';
import { useProperty } from '../../context/PropertyContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

/**
 * Check-in/Check-out Settings Page
 *
 * Pattern to follow:
 * 1. Load current property settings
 * 2. Provide form for editing
 * 3. Include ApplyToSelector for scope selection
 * 4. Show confirmation dialog for bulk updates
 * 5. Handle success/error states
 */
export function CheckInOutSettings() {
  const { selectedProperty, selectedPropertyId } = useProperty();

  // Settings inheritance hook
  const {
    useInheritanceStatus,
    updateCheckInOut,
    isUpdating,
    updateError,
    showConfirmation,
    pendingUpdate,
    confirmBulkUpdate,
    cancelBulkUpdate,
  } = useSettingsInheritance();

  // Fetch inheritance status for current property
  const { data: inheritanceStatus } = useInheritanceStatus(selectedPropertyId);

  // Form state
  const [checkInTime, setCheckInTime] = useState('14:00');
  const [checkOutTime, setCheckOutTime] = useState('11:00');
  const [applyToScope, setApplyToScope] = useState<ApplyToScope>('single');
  const [hasChanges, setHasChanges] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Load current property settings
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (selectedProperty) {
      setCheckInTime(selectedProperty.policies?.checkInTime || '14:00');
      setCheckOutTime(selectedProperty.policies?.checkOutTime || '11:00');
      setHasChanges(false);
    }
  }, [selectedProperty]);

  // Get affected properties count for confirmation dialog
  const affectedCount = useAffectedPropertiesCount(
    applyToScope,
    inheritanceStatus?.hasGroup ? 5 : 0 // Replace with actual count from API
  );

  // Handle form changes
  const handleCheckInTimeChange = (value: string) => {
    setCheckInTime(value);
    setHasChanges(true);
  };

  const handleCheckOutTimeChange = (value: string) => {
    setCheckOutTime(value);
    setHasChanges(true);
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hasChanges) return;

    try {
      const result = await updateCheckInOut(checkInTime, checkOutTime, applyToScope);

      // If confirmation dialog was shown, result will be null
      if (result) {
        setShowSuccess(true);
        setHasChanges(false);

        // Hide success message after 3 seconds
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => setShowSuccess(false), 3000);
      }
    } catch {
      // Error handled silently
    }
  };

  // Handle confirmation dialog confirm
  const handleConfirm = async () => {
    try {
      await confirmBulkUpdate();

      setShowSuccess(true);
      setHasChanges(false);

      // Hide success message after 3 seconds
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      successTimerRef.current = setTimeout(() => setShowSuccess(false), 3000);
    } catch {
      // Error handled silently
    }
  };

  // Reset form to original values
  const handleReset = () => {
    if (selectedProperty) {
      setCheckInTime(selectedProperty.policies?.checkInTime || '14:00');
      setCheckOutTime(selectedProperty.policies?.checkOutTime || '11:00');
      setHasChanges(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Check-in & Check-out Times</h2>
        <p className="text-gray-600 mt-1">
          Configure check-in and check-out times for your property
        </p>
      </div>

      {/* Main Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="h-5 w-5 text-blue-600" />
            <span>Time Settings</span>
          </CardTitle>
          <CardDescription>
            Set the standard check-in and check-out times for guests
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Check-in Time */}
            <div>
              <label htmlFor="checkInTime" className="block text-sm font-medium text-gray-700 mb-2">
                Check-in Time
              </label>
              <input
                type="time"
                id="checkInTime"
                value={checkInTime}
                onChange={(e) => handleCheckInTimeChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Standard time when guests can check in to their rooms
              </p>
            </div>

            {/* Check-out Time */}
            <div>
              <label htmlFor="checkOutTime" className="block text-sm font-medium text-gray-700 mb-2">
                Check-out Time
              </label>
              <input
                type="time"
                id="checkOutTime"
                value={checkOutTime}
                onChange={(e) => handleCheckOutTimeChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Standard time when guests must check out of their rooms
              </p>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-200 my-6"></div>

            {/* Apply To Selector */}
            <ApplyToSelector
              value={applyToScope}
              onChange={setApplyToScope}
              isInGroup={inheritanceStatus?.hasGroup || false}
              groupName={inheritanceStatus?.groupName}
              totalProperties={5} // Replace with actual count from API
              showWarning={true}
              warningMessage="These check-in/out times will be applied to all selected properties. This will affect booking availability and guest communications."
            />

            {/* Success Message */}
            {showSuccess && (
              <div className="flex items-center space-x-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="h-5 w-5 rounded-full bg-green-100 flex items-center justify-center">
                  <svg className="h-3 w-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <p className="text-sm text-green-800">
                  Settings updated successfully!
                </p>
              </div>
            )}

            {/* Error Message */}
            {updateError && (
              <div className="flex items-start space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-900 mb-1">Update Failed</p>
                  <p className="text-xs text-red-800">
                    {updateError instanceof Error ? updateError.message : 'An error occurred while updating settings'}
                  </p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                disabled={!hasChanges || isUpdating}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reset
              </Button>

              <Button
                type="submit"
                disabled={!hasChanges || isUpdating}
              >
                {isUpdating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                {isUpdating ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Inheritance Info Card (if applicable) */}
      {inheritanceStatus?.hasGroup && inheritanceStatus.inheritanceEnabled && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-3">
              <div className="h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center mt-0.5">
                <svg className="h-3 w-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-blue-900 mb-1">
                  Group Inheritance Enabled
                </p>
                <p className="text-xs text-blue-800">
                  This property is part of "{inheritanceStatus.groupName}" group and inherits settings automatically.
                  {inheritanceStatus.lastSyncAt && (
                    <span className="block mt-1">
                      Last synced: {new Date(inheritanceStatus.lastSyncAt).toLocaleString()}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmation Dialog */}
      <ApplyToConfirmation
        isOpen={showConfirmation}
        scope={applyToScope}
        affectedCount={affectedCount}
        settingName="check-in/check-out time"
        groupName={inheritanceStatus?.groupName}
        onConfirm={handleConfirm}
        onCancel={cancelBulkUpdate}
      />
    </div>
  );
}

export default CheckInOutSettings;

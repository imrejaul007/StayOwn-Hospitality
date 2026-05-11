import React, { useState } from 'react';
import { Building2, LayoutGrid, FolderTree, AlertTriangle, Info, Calendar } from 'lucide-react';
import { useProperty } from '../../context/PropertyContext';
import { ChangePreview } from './ChangePreview';
import { ScheduledUpdateDialog } from './ScheduledUpdateDialog';

/**
 * ApplyTo Scope Type
 * Determines where settings changes will be applied
 */
export type ApplyToScope = 'single' | 'group' | 'all';

/**
 * Props for ApplyToSelector Component
 */
interface ApplyToSelectorProps {
  /** Currently selected scope */
  value: ApplyToScope;

  /** Callback when scope changes */
  onChange: (scope: ApplyToScope) => void;

  /** Whether the current property belongs to a group */
  isInGroup?: boolean;

  /** Name of the property group (if applicable) */
  groupName?: string;

  /** Total number of properties that will be affected */
  totalProperties?: number;

  /** Whether to show warning for bulk updates */
  showWarning?: boolean;

  /** Custom warning message */
  warningMessage?: string;

  /** Whether the selector is disabled */
  disabled?: boolean;

  /** Additional CSS classes */
  className?: string;

  /** Enable scheduling feature */
  enableScheduling?: boolean;

  /** Setting type (required for scheduling) */
  settingType?: string;

  /** Setting updates (required for scheduling) */
  settingUpdates?: Record<string, unknown>;

  /** Property ID (required for scheduling) */
  propertyId?: string;

  /** Group ID (optional for scheduling) */
  groupId?: string;

  /** Setting name for display */
  settingName?: string;

  /** Callback when scheduling is successful */
  onScheduled?: (updateId: string, scheduledFor: Date) => void;
}

/**
 * ApplyToSelector Component
 *
 * Radio button selector for choosing where to apply settings changes:
 * - Single property only
 * - Property group (if applicable)
 * - All user properties
 *
 * Displays warnings and information about the scope of changes.
 */
export function ApplyToSelector({
  value,
  onChange,
  isInGroup = false,
  groupName,
  totalProperties = 0,
  showWarning = true,
  warningMessage,
  disabled = false,
  className = '',
  enableScheduling = false,
  settingType,
  settingUpdates,
  propertyId,
  groupId,
  settingName = 'Settings',
  onScheduled
}: ApplyToSelectorProps) {
  const { selectedProperty, properties, isMultiProperty } = useProperty();
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduledDialogOpen, setScheduledDialogOpen] = useState(false);

  // Don't show if user only has one property
  if (!isMultiProperty) {
    return null;
  }

  const handleChange = (newScope: ApplyToScope) => {
    if (disabled) return;
    onChange(newScope);
  };

  const getAffectedPropertiesCount = () => {
    if (value === 'single') return 1;
    if (value === 'group') return totalProperties || 1;
    if (value === 'all') return properties.length;
    return 0;
  };

  const getScopeDescription = () => {
    const count = getAffectedPropertiesCount();

    if (value === 'single') {
      return `Changes will only affect ${selectedProperty?.name || 'this property'}`;
    }

    if (value === 'group') {
      const groupDisplay = groupName || 'this property group';
      return `Changes will affect ${count} ${count === 1 ? 'property' : 'properties'} in ${groupDisplay}`;
    }

    if (value === 'all') {
      return `Changes will affect all ${count} of your properties`;
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center space-x-2">
        <div className="h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center">
          <Info className="h-3 w-3 text-blue-600" />
        </div>
        <h3 className="text-sm font-medium text-gray-900">Apply Settings To</h3>
      </div>

      {/* Radio Options */}
      <div className="space-y-3">
        {/* Option 1: This Property Only */}
        <label
          className={`flex items-start space-x-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
            value === 'single'
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300 bg-white'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <input
            type="radio"
            name="applyTo"
            value="single"
            checked={value === 'single'}
            onChange={() => handleChange('single')}
            disabled={disabled}
            className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <Building2 className={`h-4 w-4 ${value === 'single' ? 'text-blue-600' : 'text-gray-400'}`} />
              <span className={`text-sm font-medium ${value === 'single' ? 'text-blue-900' : 'text-gray-900'}`}>
                This Property Only
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {selectedProperty?.name || 'Current property'}
            </p>
          </div>
        </label>

        {/* Option 2: Property Group (conditional) */}
        {isInGroup && (
          <label
            className={`flex items-start space-x-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
              value === 'group'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 bg-white'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <input
              type="radio"
              name="applyTo"
              value="group"
              checked={value === 'group'}
              onChange={() => handleChange('group')}
              disabled={disabled}
              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <FolderTree className={`h-4 w-4 ${value === 'group' ? 'text-blue-600' : 'text-gray-400'}`} />
                <span className={`text-sm font-medium ${value === 'group' ? 'text-blue-900' : 'text-gray-900'}`}>
                  Property Group
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {groupName || 'All properties in this group'}
                {totalProperties > 0 && ` (${totalProperties} ${totalProperties === 1 ? 'property' : 'properties'})`}
              </p>
            </div>
          </label>
        )}

        {/* Option 3: All My Properties */}
        <label
          className={`flex items-start space-x-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
            value === 'all'
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300 bg-white'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <input
            type="radio"
            name="applyTo"
            value="all"
            checked={value === 'all'}
            onChange={() => handleChange('all')}
            disabled={disabled}
            className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <LayoutGrid className={`h-4 w-4 ${value === 'all' ? 'text-blue-600' : 'text-gray-400'}`} />
              <span className={`text-sm font-medium ${value === 'all' ? 'text-blue-900' : 'text-gray-900'}`}>
                All My Properties
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              All {properties.length} {properties.length === 1 ? 'property' : 'properties'} you own
            </p>
          </div>
        </label>
      </div>

      {/* Info Message */}
      {value !== 'single' && (
        <div className="flex items-start space-x-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-blue-800">
            {getScopeDescription()}
          </p>
        </div>
      )}

      {/* Warning Message (for bulk updates) */}
      {showWarning && value !== 'single' && (
        <div className="flex items-start space-x-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-1">
              Bulk Update Warning
            </p>
            <p className="text-xs text-amber-800 dark:text-amber-200">
              {warningMessage ||
                'This action will update settings for multiple properties. Make sure you want to apply these changes to all selected properties. Individual properties can still override these settings later if needed.'}
            </p>
          </div>
        </div>
      )}

      {/* Schedule for Later Option */}
      {enableScheduling && (
        <div className="border-t pt-4 mt-4">
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={scheduleMode}
              onChange={(e) => setScheduleMode(e.target.checked)}
              disabled={disabled}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600 group-hover:text-blue-700" />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                Schedule for Later
              </span>
            </div>
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 ml-7 mt-1">
            Choose a specific date and time to apply these settings
          </p>

          {scheduleMode && (
            <div className="ml-7 mt-3">
              <button
                type="button"
                onClick={() => setScheduledDialogOpen(true)}
                disabled={disabled}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Calendar className="h-4 w-4 inline mr-2" />
                Select Date & Time
              </button>
            </div>
          )}
        </div>
      )}

      {/* Scheduled Update Dialog */}
      {enableScheduling && settingType && settingUpdates && propertyId && (
        <ScheduledUpdateDialog
          isOpen={scheduledDialogOpen}
          onClose={() => setScheduledDialogOpen(false)}
          onSchedule={(updateId, scheduledFor) => {
            setScheduleMode(false);
            onScheduled?.(updateId, scheduledFor);
          }}
          settingType={settingType}
          settingUpdates={settingUpdates}
          scope={value}
          propertyId={propertyId}
          groupId={groupId}
          settingName={settingName}
        />
      )}
    </div>
  );
}

/**
 * Confirmation Dialog for Bulk Updates
 * Should be used before applying changes to multiple properties
 */
interface ApplyToConfirmationProps {
  scope: ApplyToScope;
  affectedCount: number;
  settingName: string;
  settingType?: string;
  settingUpdates?: Record<string, unknown>;
  propertyId?: string;
  groupId?: string;
  groupName?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isOpen: boolean;
}

export function ApplyToConfirmation({
  scope,
  affectedCount,
  settingName,
  settingType,
  settingUpdates,
  propertyId,
  groupId,
  groupName,
  onConfirm,
  onCancel,
  isOpen
}: ApplyToConfirmationProps) {
  const [activeTab, setActiveTab] = useState<'summary' | 'preview'>('summary');

  if (!isOpen) return null;

  const getMessage = () => {
    if (scope === 'group') {
      return `Are you sure you want to apply these ${settingName} changes to all ${affectedCount} ${
        affectedCount === 1 ? 'property' : 'properties'
      } in ${groupName || 'this property group'}?`;
    }

    if (scope === 'all') {
      return `Are you sure you want to apply these ${settingName} changes to all ${affectedCount} of your properties?`;
    }

    return '';
  };

  const canShowPreview = settingType && settingUpdates && propertyId;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center space-x-3 p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Confirm Bulk Update</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">This will affect multiple properties</p>
          </div>
        </div>

        {/* Tabs */}
        {canShowPreview && (
          <div className="border-b border-gray-200 dark:border-gray-700">
            <div className="flex space-x-1 px-6">
              <button
                onClick={() => setActiveTab('summary')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'summary'
                    ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                Summary
              </button>
              <button
                onClick={() => setActiveTab('preview')}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'preview'
                    ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                Detailed Preview
              </button>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'summary' ? (
            <>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">{getMessage()}</p>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start space-x-2">
                  <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-blue-800 dark:text-blue-300">
                    Properties with inheritance disabled will not be affected. Individual properties can still override these settings after this update.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              {canShowPreview && (
                <ChangePreview
                  scope={scope}
                  propertyId={propertyId!}
                  groupId={groupId}
                  settingType={settingType!}
                  settingUpdates={settingUpdates!}
                  showActions={false}
                  className="border-0 shadow-none"
                />
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Confirm Update
          </button>
        </div>
      </div>
    </div>
  );
}

export default ApplyToSelector;

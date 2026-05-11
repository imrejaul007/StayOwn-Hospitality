import React, { useState, useEffect, useRef} from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../../context/ThemeContext';
import {
  Palette,
  Monitor,
  Sun,
  Moon,
  Globe,
  Calendar,
  Clock,
  DollarSign,
  Save,
  Loader2
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Card, CardContent } from '../../../components/ui/card';
import toast from 'react-hot-toast';
import { ApplyToSelector, ApplyToConfirmation, ApplyToScope } from '../../../components/settings/ApplyToSelector';
import { useSettingsInheritance, useAffectedPropertiesCount } from '../../../hooks/useSettingsInheritance';
import { api } from '../../../services/api';
import { useProperty } from '../../../context/PropertyContext';
import { withErrorBoundary } from '../../../components/ErrorBoundary';

interface DisplayFormData {
  theme: 'light' | 'dark' | 'auto';
  sidebarCollapsed: boolean;
  language: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  currency: string;
  numberFormat: string;
  compactView: boolean;
  highContrast: boolean;
}

interface DisplaySettingsProps {
  onSettingsChange?: (hasChanges: boolean) => void;
}

function DisplaySettings({ onSettingsChange }: DisplaySettingsProps = {}) {
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();

  // Multi-property support
  const { selectedProperty, selectedPropertyId } = useProperty();
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
    formState: { isDirty }
  } = useForm<DisplayFormData>({
    defaultValues: {
      theme: 'light',
      sidebarCollapsed: false,
      language: 'en',
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '24h',
      currency: 'INR',
      numberFormat: 'en-IN',
      compactView: false,
      highContrast: false
    }
  });

  const watchedValues = watch();

  // Watch for theme changes and apply immediately
  const watchedTheme = watch('theme');
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (watchedTheme && watchedTheme !== theme) {
      setTheme(watchedTheme as 'light' | 'dark' | 'auto');
    }
  }, [watchedTheme, theme, setTheme]);

  // Fetch current display settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data } = await api.get('/user-preferences/display');
        const preferences = data.data.display || data.data.preferences;
        if (preferences) {

          // Update form with current settings from the API
          setValue('theme', preferences.theme || theme, { shouldDirty: false });
          setValue('sidebarCollapsed', preferences.sidebarCollapsed || false, { shouldDirty: false });
          setValue('language', preferences.language || 'English', { shouldDirty: false });
          setValue('dateFormat', preferences.dateFormat || 'DD/MM/YYYY', { shouldDirty: false });
          setValue('timeFormat', preferences.timeFormat || '24 Hour', { shouldDirty: false });
          setValue('currency', preferences.currency || 'INR', { shouldDirty: false });
          setValue('numberFormat', preferences.numberFormat || 'en-IN', { shouldDirty: false });
          setValue('compactView', preferences.compactView || false, { shouldDirty: false });
          setValue('highContrast', preferences.highContrastMode || preferences.highContrast || false, { shouldDirty: false });
        }
      } catch {
        // Error handled silently
      }
    };

    fetchSettings();
  }, [setValue, theme]);

  // Sync form theme value with context theme
  useEffect(() => {
    setValue('theme', theme, { shouldDirty: false });
  }, [theme, setValue]);

  // Watch for form changes
  useEffect(() => {
    if (onSettingsChange) {
      onSettingsChange(isDirty);
    }
  }, [isDirty, onSettingsChange]);

  // Save display settings mutation
  const saveDisplayMutation = useMutation({
    mutationFn: async (data: DisplayFormData) => {
      const response = await api.put('/user-preferences/display', data);
      return response.data;
    },
    onSuccess: () => {
      toast.success('Display settings updated successfully');

      // Reset the form's dirty state without changing values
      // This tells the form that the current values are now the "saved" state
      const currentValues = watch();
      Object.keys(currentValues).forEach(key => {
        setValue(key as keyof DisplayFormData, currentValues[key], { shouldDirty: false });
      });

      if (onSettingsChange) {
        onSettingsChange(false);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update display settings');
    }
  });

  const onSubmit = async (data: DisplayFormData) => {
    // Update theme context if theme changed (this is user-specific, not property-specific)
    if (data.theme !== theme) {
      setTheme(data.theme as 'light' | 'dark' | 'auto');
    }

    // For display settings, only language, currency, and date/time formats should be property-level
    // Theme and layout preferences are user-specific
    const propertySettings = {
      language: data.language,
      currency: data.currency,
      dateFormat: data.dateFormat,
      timeFormat: data.timeFormat,
      numberFormat: data.numberFormat,
    };

    try {
      // If multi-property update, use applySettings for property-level settings
      if (applyToScope !== 'single') {
        const result = await applySettings({
          scope: applyToScope,
          propertyId: selectedPropertyId,
          settingUpdates: propertySettings,
          settingType: 'display_preferences',
        });

        if (!result) return; // Confirmation dialog shown

        setShowSuccess(true);
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => setShowSuccess(false), 3000);
        toast.success(`Display preferences updated successfully${
          applyToScope !== 'single' ? ` for ${result.propertiesUpdated} properties` : ''
        }`);
        setApplyToScope('single');
      }

      // Always save user-specific preferences (theme, layout) to current user
      saveDisplayMutation.mutate(data);
    } catch (error) {
      toast.error('Failed to update display settings');
    }
  };

  const handleConfirm = async () => {
    if (pendingUpdate) {
      const result = await confirmBulkUpdate();
      if (result) {
        setShowSuccess(true);
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => setShowSuccess(false), 3000);
        toast.success(`Display preferences updated for ${result.propertiesUpdated} properties`);
        queryClient.invalidateQueries({ queryKey: ['display-settings'] });
      }
    }
  };

  const languages = [
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Spanish' },
    { value: 'fr', label: 'French' },
    { value: 'de', label: 'German' },
    { value: 'hi', label: 'Hindi' },
    { value: 'ja', label: 'Japanese' }
  ];

  const currencies = [
    { value: 'INR', label: 'INR - Indian Rupee (₹)' },
    { value: 'USD', label: 'USD - US Dollar ($)' },
    { value: 'EUR', label: 'EUR - Euro (€)' },
    { value: 'GBP', label: 'GBP - British Pound (£)' },
    { value: 'JPY', label: 'JPY - Japanese Yen (¥)' }
  ];

  const dateFormats = [
    { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
    { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
    { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
    { value: 'DD-MM-YYYY', label: 'DD-MM-YYYY' }
  ];

  return (
    <div className="p-6 bg-white dark:bg-gray-800 transition-colors">
      <div className="max-w-3xl">
        {/* Success Message */}
        {showSuccess && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 px-4 py-3 rounded-lg mb-6">
            <p className="font-medium">Display preferences updated successfully!</p>
          </div>
        )}

        {/* Error Message */}
        {updateError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded-lg mb-6">
            <p className="font-medium">Error: {updateError}</p>
          </div>
        )}

        {/* Inheritance Status Card */}
        {inheritanceStatus?.isInheriting && inheritanceStatus?.hasGroup && (
          <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 mb-6">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    This property is part of: {inheritanceStatus.groupName}
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                    Display preferences are inherited from the property group
                    {inheritanceStatus.lastSyncAt && ` • Last synced: ${new Date(inheritanceStatus.lastSyncAt).toLocaleDateString()}`}
                  </p>
                </div>
                {inheritanceStatus.canOverride && (
                  <Badge variant="secondary" className="text-xs">
                    Override Enabled
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Header */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center space-x-2">
            <Palette className="h-5 w-5" />
            <span>Display Settings</span>
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Customize the appearance and formatting preferences
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Multi-Property Selector - Only for property-level settings */}
          <div className="pb-6 border-b border-gray-200 dark:border-gray-700">
            <div className="mb-4">
              <h3 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-2">
                Apply Property-Level Settings To
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Language, currency, and date/time formats can be applied across multiple properties.
                Theme and layout preferences are user-specific.
              </p>
            </div>
            <ApplyToSelector
              value={applyToScope}
              onChange={setApplyToScope}
              isInGroup={inheritanceStatus?.hasGroup || false}
              groupName={inheritanceStatus?.groupName}
              totalProperties={inheritanceStatus?.groupPropertyCount || 0}
              showWarning={true}
              warningMessage="Property-level display preferences (language, currency, date/time formats) will be applied to all selected properties. User-specific preferences (theme, layout) remain unchanged."
            />
          </div>
          {/* Theme Settings */}
          <div>
            <h3 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center space-x-2">
              <Monitor className="h-4 w-4" />
              <span>Theme</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className={`
                p-4 border-2 rounded-lg cursor-pointer transition-colors flex flex-col items-center space-y-2
                ${watchedValues.theme === 'light'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400'
                  : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }
              `}>
                <input
                  {...register('theme')}
                  type="radio"
                  value="light"
                  className="sr-only"
                />
                <Sun className="h-8 w-8 text-yellow-500" />
                <span className="font-medium text-gray-900 dark:text-gray-100">Light</span>
              </label>

              <label className={`
                p-4 border-2 rounded-lg cursor-pointer transition-colors flex flex-col items-center space-y-2
                ${watchedValues.theme === 'dark'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400'
                  : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }
              `}>
                <input
                  {...register('theme')}
                  type="radio"
                  value="dark"
                  className="sr-only"
                />
                <Moon className="h-8 w-8 text-gray-700 dark:text-gray-300" />
                <span className="font-medium text-gray-900 dark:text-gray-100">Dark</span>
              </label>

              <label className={`
                p-4 border-2 rounded-lg cursor-pointer transition-colors flex flex-col items-center space-y-2
                ${watchedValues.theme === 'auto'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400'
                  : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }
              `}>
                <input
                  {...register('theme')}
                  type="radio"
                  value="auto"
                  className="sr-only"
                />
                <Monitor className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                <span className="font-medium text-gray-900 dark:text-gray-100">Auto</span>
              </label>
            </div>
          </div>

          {/* Layout Settings */}
          <div>
            <h3 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4">Layout Preferences</h3>
            <div className="space-y-4">
              <label className="flex items-center space-x-3">
                <input
                  {...register('sidebarCollapsed')}
                  type="checkbox"
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="font-medium text-gray-900 dark:text-gray-100">Collapse sidebar by default</span>
              </label>

              <label className="flex items-center space-x-3">
                <input
                  {...register('compactView')}
                  type="checkbox"
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="font-medium text-gray-900 dark:text-gray-100">Use compact view</span>
              </label>

              <label className="flex items-center space-x-3">
                <input
                  {...register('highContrast')}
                  type="checkbox"
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="font-medium text-gray-900 dark:text-gray-100">High contrast mode</span>
              </label>
            </div>
          </div>

          {/* Localization */}
          <div>
            <h3 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center space-x-2">
              <Globe className="h-4 w-4" />
              <span>Localization</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Language
                </label>
                <select
                  {...register('language')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {languages.map(lang => (
                    <option key={lang.value} value={lang.value}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <DollarSign className="h-4 w-4 inline mr-1" />
                  Currency
                </label>
                <select
                  {...register('currency')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {currencies.map(currency => (
                    <option key={currency.value} value={currency.value}>
                      {currency.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Date & Time Format */}
          <div>
            <h3 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center space-x-2">
              <Calendar className="h-4 w-4" />
              <span>Date & Time Format</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Date Format
                </label>
                <select
                  {...register('dateFormat')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {dateFormats.map(format => (
                    <option key={format.value} value={format.value}>
                      {format.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Clock className="h-4 w-4 inline mr-1" />
                  Time Format
                </label>
                <select
                  {...register('timeFormat')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="12h">12 Hour (AM/PM)</option>
                  <option value="24h">24 Hour</option>
                </select>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-600">
            <Button
              type="submit"
              disabled={!isDirty || saveDisplayMutation.isPending || isUpdating}
              className="flex items-center space-x-2"
            >
              {(saveDisplayMutation.isPending || isUpdating) ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span>Save Changes</span>
            </Button>
          </div>
        </form>

        {/* Multi-Property Confirmation Dialog */}
        <ApplyToConfirmation
          isOpen={showConfirmation}
          scope={applyToScope}
          affectedCount={affectedCount}
          settingName="display preferences (language, currency, date/time formats)"
          groupName={inheritanceStatus?.groupName}
          onConfirm={handleConfirm}
          onCancel={cancelBulkUpdate}
        />
      </div>
    </div>
  );
}

export default withErrorBoundary(DisplaySettings);

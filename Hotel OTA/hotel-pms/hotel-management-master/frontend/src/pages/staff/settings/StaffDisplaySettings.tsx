import React, { useEffect } from 'react';
import { api } from '../../../services/api';
import { useForm } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import {
  Palette,
  Monitor,
  Sun,
  Moon,
  Globe,
  Zap,
  Clock,
  Calendar,
  Save,
  Loader2
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import toast from 'react-hot-toast';
import { withErrorBoundary } from '../../../components/ErrorBoundary';

interface StaffDisplayFormData {
  theme: 'light' | 'dark';
  compactView: boolean;
  language: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  quickActions: string[];
}

interface StaffDisplaySettingsProps {
  onSettingsChange?: (hasChanges: boolean) => void;
}

function StaffDisplaySettings({ onSettingsChange }: StaffDisplaySettingsProps = {}) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { isDirty }
  } = useForm<StaffDisplayFormData>({
    defaultValues: {
      theme: 'light',
      compactView: false,
      language: 'en',
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '24h',
      quickActions: ['daily-check', 'guest-request']
    }
  });

  const watchedValues = watch();

  // Load saved display preferences from backend
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const [{ data: displayData }, { data: staffData }, { data: profileData }] = await Promise.all([
          api.get('/user-preferences/display'),
          api.get('/user-preferences/staff'),
          api.get('/user-preferences/profile')
        ]);

        const displayPrefs = displayData?.data?.display || {};
        const staffPrefs = staffData?.data?.staff || {};
        const profilePrefs = profileData?.data?.profile || {};

        setValue('theme', displayPrefs.theme || 'light', { shouldDirty: false });
        setValue('compactView', displayPrefs.compactView ?? false, { shouldDirty: false });
        setValue('dateFormat', displayPrefs.dateFormat || 'DD/MM/YYYY', { shouldDirty: false });
        setValue('timeFormat', displayPrefs.timeFormat || '24h', { shouldDirty: false });
        setValue('language', profilePrefs.language || 'en', { shouldDirty: false });
        setValue('quickActions', staffPrefs.quickActions || ['daily-check', 'guest-request'], { shouldDirty: false });
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

  const languages = [
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Spanish' },
    { value: 'fr', label: 'French' },
    { value: 'hi', label: 'Hindi' }
  ];

  const dateFormats = [
    { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (31/12/2025)' },
    { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (12/31/2025)' },
    { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2025-12-31)' }
  ];

  const availableQuickActions = [
    { id: 'daily-check', label: 'Daily Room Check', icon: '🛏️' },
    { id: 'guest-request', label: 'Guest Request', icon: '👤' },
    { id: 'maintenance', label: 'Report Issue', icon: '🔧' },
    { id: 'inventory', label: 'Inventory Check', icon: '📦' },
    { id: 'housekeeping', label: 'Housekeeping Task', icon: '🧹' }
  ];

  // Save display settings mutation
  const saveDisplayMutation = useMutation({
    mutationFn: async (data: StaffDisplayFormData) => {
      await Promise.all([
        api.put('/user-preferences/display', {
          theme: data.theme,
          compactView: data.compactView,
          dateFormat: data.dateFormat,
          timeFormat: data.timeFormat
        }),
        api.put('/user-preferences/staff', {
          quickActions: data.quickActions
        }),
        api.put('/user-preferences/profile', {
          language: data.language
        })
      ]);
      return data;
    },
    onSuccess: (savedData) => {
      reset(savedData);
      toast.success('Display settings updated successfully');
      if (onSettingsChange) {
        onSettingsChange(false);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update display settings');
    }
  });

  const onSubmit = (data: StaffDisplayFormData) => {
    saveDisplayMutation.mutate(data);
  };

  const handleQuickActionToggle = (actionId: string) => {
    const currentActions = watchedValues.quickActions || [];
    const newActions = currentActions.includes(actionId)
      ? currentActions.filter(id => id !== actionId)
      : [...currentActions, actionId];
    setValue('quickActions', newActions, { shouldDirty: true });
  };

  return (
    <div className="p-6">
      <div className="max-w-3xl">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
            <Palette className="h-5 w-5" />
            <span>Display Settings</span>
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Customize the appearance and layout of your workspace
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Theme Settings */}
          <div>
            <h3 className="text-md font-medium text-gray-900 mb-4 flex items-center space-x-2">
              <Monitor className="h-4 w-4" />
              <span>Theme</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className={`
                p-4 border-2 rounded-lg cursor-pointer transition-colors flex items-center space-x-3
                ${watchedValues.theme === 'light' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}
              `}>
                <input
                  {...register('theme')}
                  type="radio"
                  value="light"
                  className="sr-only"
                />
                <Sun className="h-6 w-6 text-yellow-500" />
                <div>
                  <p className="font-medium text-gray-900">Light Theme</p>
                  <p className="text-sm text-gray-500">Best for daytime work</p>
                </div>
              </label>

              <label className={`
                p-4 border-2 rounded-lg cursor-pointer transition-colors flex items-center space-x-3
                ${watchedValues.theme === 'dark' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}
              `}>
                <input
                  {...register('theme')}
                  type="radio"
                  value="dark"
                  className="sr-only"
                />
                <Moon className="h-6 w-6 text-gray-700" />
                <div>
                  <p className="font-medium text-gray-900">Dark Theme</p>
                  <p className="text-sm text-gray-500">Easier on the eyes</p>
                </div>
              </label>
            </div>
          </div>

          {/* Layout Preferences */}
          <div>
            <h3 className="text-md font-medium text-gray-900 mb-4">Layout Preferences</h3>
            <div className="space-y-4">
              <label className="flex items-center space-x-3">
                <input
                  {...register('compactView')}
                  type="checkbox"
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="font-medium text-gray-900">Compact View</span>
                <span className="text-sm text-gray-500">- Show more information in less space</span>
              </label>
            </div>
          </div>

          {/* Language */}
          <div>
            <h3 className="text-md font-medium text-gray-900 mb-4 flex items-center space-x-2">
              <Globe className="h-4 w-4" />
              <span>Language</span>
            </h3>
            <select
              {...register('language')}
              className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {languages.map(lang => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date & Time Format */}
          <div>
            <h3 className="text-md font-medium text-gray-900 mb-4 flex items-center space-x-2">
              <Calendar className="h-4 w-4" />
              <span>Date &amp; Time Format</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date Format</label>
                <select
                  {...register('dateFormat')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {dateFormats.map(fmt => (
                    <option key={fmt.value} value={fmt.value}>
                      {fmt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Clock className="h-4 w-4 inline mr-1" />
                  Time Format
                </label>
                <div className="flex space-x-4">
                  <label className={`
                    flex-1 p-3 border-2 rounded-lg cursor-pointer text-center transition-colors
                    ${watchedValues.timeFormat === '12h' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}
                  `}>
                    <input
                      {...register('timeFormat')}
                      type="radio"
                      value="12h"
                      className="sr-only"
                    />
                    <p className="font-medium text-gray-900">12h</p>
                    <p className="text-xs text-gray-500">2:30 PM</p>
                  </label>
                  <label className={`
                    flex-1 p-3 border-2 rounded-lg cursor-pointer text-center transition-colors
                    ${watchedValues.timeFormat === '24h' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}
                  `}>
                    <input
                      {...register('timeFormat')}
                      type="radio"
                      value="24h"
                      className="sr-only"
                    />
                    <p className="font-medium text-gray-900">24h</p>
                    <p className="text-xs text-gray-500">14:30</p>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <h3 className="text-md font-medium text-gray-900 mb-4 flex items-center space-x-2">
              <Zap className="h-4 w-4" />
              <span>Quick Action Buttons</span>
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Choose which quick action buttons to display on your dashboard
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {availableQuickActions.map(action => (
                <label key={action.id} className={`
                  flex items-center space-x-3 p-3 border-2 rounded-lg cursor-pointer transition-colors
                  ${(watchedValues.quickActions || []).includes(action.id)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:bg-gray-50'
                  }
                `}>
                  <input
                    type="checkbox"
                    checked={(watchedValues.quickActions || []).includes(action.id)}
                    onChange={() => handleQuickActionToggle(action.id)}
                    className="sr-only"
                  />
                  <span className="text-lg">{action.icon}</span>
                  <span className="font-medium text-gray-900">{action.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-4 border-t border-gray-200">
            <Button
              type="submit"
              disabled={!isDirty || saveDisplayMutation.isPending}
              className="flex items-center space-x-2"
            >
              {saveDisplayMutation.isPending ? (
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

export default withErrorBoundary(StaffDisplaySettings);

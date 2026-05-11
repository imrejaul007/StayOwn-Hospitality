import React, { useState } from 'react';
import { Settings, X, Bell, Mail, Smartphone, Volume2, VolumeX, Moon, Sun, Check } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../services/api';

interface NotificationPreferences {
  channels: {
    inApp: boolean;
    email: boolean;
    push: boolean;
  };
  categories: {
    bookings: boolean;
    payments: boolean;
    services: boolean;
    system: boolean;
    maintenance?: boolean;
    inventory?: boolean;
    promotional?: boolean;
  };
  quietHours: {
    enabled: boolean;
    start: number;
    end: number;
  };
  sound: boolean;
  desktop: boolean;
  frequency: 'immediate' | 'digest' | 'weekly';
}

interface QuickNotificationSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export const QuickNotificationSettings: React.FC<QuickNotificationSettingsProps> = ({
  isOpen,
  onClose,
  className = ''
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'channels' | 'categories' | 'timing'>('channels');

  // Fetch current preferences
  const { data: preferences, isLoading } = useQuery<NotificationPreferences>({
    queryKey: ['notification-preferences', user?._id],
    queryFn: async () => {
      const response = await apiRequest('/api/v1/notifications/preferences');
      return response.data.preferences.notifications || getDefaultPreferences();
    },
    enabled: isOpen
  });

  // Update preferences mutation
  const updatePreferencesMutation = useMutation({
    mutationFn: async (updates: Partial<NotificationPreferences>) => {
      const response = await apiRequest('/api/v1/notifications/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ notifications: updates })
      });
      return response.data.preferences;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const getDefaultPreferences = (): NotificationPreferences => ({
    channels: {
      inApp: true,
      email: true,
      push: true
    },
    categories: {
      bookings: true,
      payments: true,
      services: true,
      system: true,
      ...(user?.role === 'staff' && {
        maintenance: true,
        inventory: true
      }),
      ...(user?.role === 'guest' && {
        promotional: false
      })
    },
    quietHours: {
      enabled: false,
      start: 22,
      end: 7
    },
    sound: true,
    desktop: true,
    frequency: 'immediate'
  });

  const handleChannelToggle = (channel: keyof NotificationPreferences['channels']) => {
    if (!preferences) return;

    const updatedChannels = {
      ...preferences.channels,
      [channel]: !preferences.channels[channel]
    };

    updatePreferencesMutation.mutate({
      ...preferences,
      channels: updatedChannels
    });
  };

  const handleCategoryToggle = (category: keyof NotificationPreferences['categories']) => {
    if (!preferences) return;

    const updatedCategories = {
      ...preferences.categories,
      [category]: !preferences.categories[category]
    };

    updatePreferencesMutation.mutate({
      ...preferences,
      categories: updatedCategories
    });
  };

  const handleQuietHoursToggle = () => {
    if (!preferences) return;

    const updatedQuietHours = {
      ...preferences.quietHours,
      enabled: !preferences.quietHours.enabled
    };

    updatePreferencesMutation.mutate({
      ...preferences,
      quietHours: updatedQuietHours
    });
  };

  const handleSoundToggle = () => {
    if (!preferences) return;

    updatePreferencesMutation.mutate({
      ...preferences,
      sound: !preferences.sound
    });
  };

  const handleFrequencyChange = (frequency: NotificationPreferences['frequency']) => {
    if (!preferences) return;

    updatePreferencesMutation.mutate({
      ...preferences,
      frequency
    });
  };

  if (!isOpen) return null;

  const channelIcons = {
    inApp: Bell,
    email: Mail,
    push: Smartphone
  };

  const channelLabels = {
    inApp: 'In-App',
    email: 'Email',
    push: 'Push'
  };

  const categoryLabels = {
    bookings: 'Bookings',
    payments: 'Payments',
    services: 'Services',
    system: 'System',
    maintenance: 'Maintenance',
    inventory: 'Inventory',
    promotional: 'Promotions'
  };

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 ${className}`}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Quick Settings</h3>
            </div>
            <button aria-label="Close"
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 py-3 border-b border-gray-200">
          <div className="flex space-x-4">
            {(['channels', 'categories', 'timing'] as const).map((tab) => (
              <button aria-label="Close"
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`text-sm font-medium pb-2 border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-800'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 bg-gray-200 rounded"></div>
                      <div className="h-4 bg-gray-200 rounded w-20"></div>
                    </div>
                    <div className="w-10 h-6 bg-gray-200 rounded-full"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : preferences ? (
            <>
              {/* Channels Tab */}
              {activeTab === 'channels' && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 mb-4">
                    Choose how you want to receive notifications
                  </p>
                  {Object.entries(preferences.channels).map(([channel, enabled]) => {
                    const Icon = channelIcons[channel as keyof typeof channelIcons];
                    return (
                      <div
                        key={channel}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-3">
                          <Icon className={`w-5 h-5 ${enabled ? 'text-blue-600' : 'text-gray-400'}`} />
                          <span className="font-medium text-gray-900">
                            {channelLabels[channel as keyof typeof channelLabels]}
                          </span>
                        </div>
                        <button aria-label="Toggle"
                          onClick={() => handleChannelToggle(channel as keyof NotificationPreferences['channels'])}
                          disabled={updatePreferencesMutation.isPending}
                          className={`relative w-11 h-6 rounded-full transition-colors ${
                            enabled ? 'bg-blue-600' : 'bg-gray-300'
                          } ${updatePreferencesMutation.isPending ? 'opacity-50' : ''}`}
                        >
                          <div
                            className={`absolute w-4 h-4 bg-white rounded-full shadow transition-transform ${
                              enabled ? 'translate-x-6' : 'translate-x-1'
                            } top-1`}
                          />
                        </button>
                      </div>
                    );
                  })}

                  {/* Sound & Desktop toggles */}
                  <div className="pt-4 border-t border-gray-200 space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50">
                      <div className="flex items-center gap-3">
                        {preferences.sound ? (
                          <Volume2 className="w-5 h-5 text-blue-600" />
                        ) : (
                          <VolumeX className="w-5 h-5 text-gray-400" />
                        )}
                        <span className="font-medium text-gray-900">Sound</span>
                      </div>
                      <button aria-label="Toggle"
                        onClick={handleSoundToggle}
                        disabled={updatePreferencesMutation.isPending}
                        className={`relative w-11 h-6 rounded-full transition-colors ${
                          preferences.sound ? 'bg-blue-600' : 'bg-gray-300'
                        }`}
                      >
                        <div
                          className={`absolute w-4 h-4 bg-white rounded-full shadow transition-transform ${
                            preferences.sound ? 'translate-x-6' : 'translate-x-1'
                          } top-1`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Categories Tab */}
              {activeTab === 'categories' && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 mb-4">
                    Select which types of notifications you want to receive
                  </p>
                  {Object.entries(preferences.categories).map(([category, enabled]) => (
                    <div
                      key={category}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${enabled ? 'bg-blue-600' : 'bg-gray-300'}`} />
                        <span className="font-medium text-gray-900">
                          {categoryLabels[category as keyof typeof categoryLabels]}
                        </span>
                      </div>
                      <button aria-label="Toggle"
                        onClick={() => handleCategoryToggle(category as keyof NotificationPreferences['categories'])}
                        disabled={updatePreferencesMutation.isPending}
                        className={`relative w-11 h-6 rounded-full transition-colors ${
                          enabled ? 'bg-blue-600' : 'bg-gray-300'
                        }`}
                      >
                        <div
                          className={`absolute w-4 h-4 bg-white rounded-full shadow transition-transform ${
                            enabled ? 'translate-x-6' : 'translate-x-1'
                          } top-1`}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Timing Tab */}
              {activeTab === 'timing' && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600 mb-4">
                    Control when and how often you receive notifications
                  </p>

                  {/* Quiet Hours */}
                  <div className="p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {preferences.quietHours.enabled ? (
                          <Moon className="w-5 h-5 text-blue-600" />
                        ) : (
                          <Sun className="w-5 h-5 text-gray-400" />
                        )}
                        <span className="font-medium text-gray-900">Quiet Hours</span>
                      </div>
                      <button aria-label="Toggle"
                        onClick={handleQuietHoursToggle}
                        disabled={updatePreferencesMutation.isPending}
                        className={`relative w-11 h-6 rounded-full transition-colors ${
                          preferences.quietHours.enabled ? 'bg-blue-600' : 'bg-gray-300'
                        }`}
                      >
                        <div
                          className={`absolute w-4 h-4 bg-white rounded-full shadow transition-transform ${
                            preferences.quietHours.enabled ? 'translate-x-6' : 'translate-x-1'
                          } top-1`}
                        />
                      </button>
                    </div>
                    {preferences.quietHours.enabled && (
                      <div className="text-sm text-gray-600">
                        {preferences.quietHours.start}:00 - {preferences.quietHours.end}:00
                      </div>
                    )}
                  </div>

                  {/* Frequency */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-900">Frequency</label>
                    <div className="space-y-2">
                      {([
                        { value: 'immediate', label: 'Immediate' },
                        { value: 'digest', label: 'Daily Digest' },
                        { value: 'weekly', label: 'Weekly Summary' }
                      ] as const).map((option) => (
                        <button aria-label="Close"
                          key={option.value}
                          onClick={() => handleFrequencyChange(option.value)}
                          disabled={updatePreferencesMutation.isPending}
                          className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                            preferences.frequency === option.value
                              ? 'border-blue-600 bg-blue-50 text-blue-600'
                              : 'border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <span className="font-medium">{option.label}</span>
                          {preferences.frequency === option.value && (
                            <Check className="w-5 h-5" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">
              {updatePreferencesMutation.isPending ? 'Saving...' : 'Changes saved automatically'}
            </span>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickNotificationSettings;
import React, { useState } from 'react';
import { Settings, Bell, BellOff, Volume2, VolumeX, Moon, Smartphone } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../services/api';
import { QuickNotificationSettings } from './QuickNotificationSettings';

interface QuickSettingsToggleProps {
  className?: string;
  variant?: 'icon' | 'button' | 'dropdown';
  showLabel?: boolean;
}

export const QuickSettingsToggle: React.FC<QuickSettingsToggleProps> = ({
  className = '',
  variant = 'icon',
  showLabel = false
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showSettings, setShowSettings] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Fetch quick status of notification preferences
  const { data: quickStatus } = useQuery({
    queryKey: ['notification-quick-status', user?._id],
    queryFn: async () => {
      const response = await apiRequest('/api/v1/notifications/preferences');
      const prefs = response.data.preferences.notifications;

      return {
        allEnabled: Object.values(prefs?.channels || {}).some(Boolean),
        soundEnabled: prefs?.sound !== false,
        quietHoursEnabled: prefs?.quietHours?.enabled || false,
        pushEnabled: prefs?.channels?.push !== false
      };
    },
    staleTime: 30000
  });

  // Quick toggle mutations
  const toggleAllMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      await apiRequest('/api/v1/notifications/preferences', {
        method: 'PATCH',
        body: JSON.stringify({
          notifications: {
            channels: {
              inApp: enabled,
              email: enabled,
              push: enabled,
              sms: false // Keep SMS off for quick toggle
            }
          }
        })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-quick-status'] });
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
    }
  });

  const toggleSoundMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      await apiRequest('/api/v1/notifications/preferences', {
        method: 'PATCH',
        body: JSON.stringify({
          notifications: { sound: enabled }
        })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-quick-status'] });
    }
  });

  const toggleQuietHoursMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      await apiRequest('/api/v1/notifications/preferences', {
        method: 'PATCH',
        body: JSON.stringify({
          notifications: {
            quietHours: { enabled, start: 22, end: 7 }
          }
        })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-quick-status'] });
    }
  });

  const handleQuickToggle = () => {
    if (quickStatus) {
      toggleAllMutation.mutate(!quickStatus.allEnabled);
    }
  };

  // Icon variant - just the settings icon
  if (variant === 'icon') {
    return (
      <>
        <button aria-label="Settings"
          onClick={() => setShowSettings(true)}
          className={`p-2 rounded-lg transition-colors hover:bg-gray-100 ${className}`}
          title="Notification Settings"
        >
          <Settings className={`w-5 h-5 ${quickStatus?.allEnabled ? 'text-blue-600' : 'text-gray-400'}`} />
        </button>

        <QuickNotificationSettings
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
        />
      </>
    );
  }

  // Button variant - settings button with optional label
  if (variant === 'button') {
    return (
      <>
        <button aria-label="Settings"
          onClick={() => setShowSettings(true)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors hover:bg-gray-100 ${className}`}
        >
          <Settings className={`w-4 h-4 ${quickStatus?.allEnabled ? 'text-blue-600' : 'text-gray-400'}`} />
          {showLabel && (
            <span className="text-sm font-medium text-gray-700">Settings</span>
          )}
        </button>

        <QuickNotificationSettings
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
        />
      </>
    );
  }

  // Dropdown variant - shows quick toggles inline
  return (
    <div className={`relative ${className}`}>
      <button aria-label="Settings"
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors hover:bg-gray-100"
      >
        <Settings className={`w-4 h-4 ${quickStatus?.allEnabled ? 'text-blue-600' : 'text-gray-400'}`} />
        {showLabel && (
          <span className="text-sm font-medium text-gray-700">Quick Settings</span>
        )}
      </button>

      {showDropdown && (
        <>
          {/* Backdrop */}
          <div aria-hidden="true"
            className="fixed inset-0 z-10"
            onClick={() => setShowDropdown(false)}
          />

          {/* Dropdown Menu */}
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-gray-900">Quick Settings</h4>
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    setShowSettings(true);
                  }}
                  className="text-blue-600 text-sm hover:text-blue-700"
                >
                  All Settings
                </button>
              </div>

              <div className="space-y-3">
                {/* All Notifications Toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {quickStatus?.allEnabled ? (
                      <Bell className="w-4 h-4 text-blue-600" />
                    ) : (
                      <BellOff className="w-4 h-4 text-gray-400" />
                    )}
                    <span className="text-sm font-medium">Notifications</span>
                  </div>
                  <button aria-label="Toggle"
                    onClick={handleQuickToggle}
                    disabled={toggleAllMutation.isPending}
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      quickStatus?.allEnabled ? 'bg-blue-600' : 'bg-gray-300'
                    } ${toggleAllMutation.isPending ? 'opacity-50' : ''}`}
                  >
                    <div
                      className={`absolute w-4 h-4 bg-white rounded-full shadow transition-transform top-0.5 ${
                        quickStatus?.allEnabled ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>

                {/* Sound Toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {quickStatus?.soundEnabled ? (
                      <Volume2 className="w-4 h-4 text-blue-600" />
                    ) : (
                      <VolumeX className="w-4 h-4 text-gray-400" />
                    )}
                    <span className="text-sm font-medium">Sound</span>
                  </div>
                  <button aria-label="Toggle"
                    onClick={() => toggleSoundMutation.mutate(!quickStatus?.soundEnabled)}
                    disabled={toggleSoundMutation.isPending}
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      quickStatus?.soundEnabled ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <div
                      className={`absolute w-4 h-4 bg-white rounded-full shadow transition-transform top-0.5 ${
                        quickStatus?.soundEnabled ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>

                {/* Quiet Hours Toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Moon className={`w-4 h-4 ${quickStatus?.quietHoursEnabled ? 'text-blue-600' : 'text-gray-400'}`} />
                    <span className="text-sm font-medium">Quiet Hours</span>
                  </div>
                  <button aria-label="Toggle"
                    onClick={() => toggleQuietHoursMutation.mutate(!quickStatus?.quietHoursEnabled)}
                    disabled={toggleQuietHoursMutation.isPending}
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      quickStatus?.quietHoursEnabled ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <div
                      className={`absolute w-4 h-4 bg-white rounded-full shadow transition-transform top-0.5 ${
                        quickStatus?.quietHoursEnabled ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>

                {/* Push Notifications Status */}
                <div className="pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Smartphone className={`w-4 h-4 ${quickStatus?.pushEnabled ? 'text-blue-600' : 'text-gray-400'}`} />
                      <span className="text-sm font-medium">Push Notifications</span>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      quickStatus?.pushEnabled
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {quickStatus?.pushEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Full Settings Modal */}
      <QuickNotificationSettings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
};

export default QuickSettingsToggle;
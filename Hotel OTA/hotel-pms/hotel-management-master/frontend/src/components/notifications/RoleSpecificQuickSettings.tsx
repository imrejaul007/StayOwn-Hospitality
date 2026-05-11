import React, { useState } from 'react';
import { Settings, Bell, AlertTriangle, Calendar, Users, Wrench, Package } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { apiRequest } from '../../services/api';

interface RoleSpecificQuickSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

// Admin Quick Settings
const AdminQuickSettings: React.FC<{ preferences: Record<string, unknown>; updatePreferences: unknown }> = ({
  preferences,
  updatePreferences
}) => {
  const adminCategories = {
    system: 'System Alerts',
    security: 'Security Alerts',
    financial: 'Financial Reports',
    occupancy: 'Occupancy Alerts',
    staff: 'Staff Management',
    compliance: 'Compliance Issues'
  };

  const prioritySettings = {
    urgent: { label: 'Critical Issues', color: 'text-red-600', bgColor: 'bg-red-50' },
    high: { label: 'Important Updates', color: 'text-orange-600', bgColor: 'bg-orange-50' },
    medium: { label: 'Regular Reports', color: 'text-blue-600', bgColor: 'bg-blue-50' },
    low: { label: 'Info & Updates', color: 'text-gray-600', bgColor: 'bg-gray-50' }
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          Priority Alerts
        </h4>
        <div className="space-y-2">
          {Object.entries(prioritySettings).map(([priority, config]) => (
            <div key={priority} className={`${config.bgColor} rounded-lg p-3`}>
              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium ${config.color}`}>
                  {config.label}
                </span>
                <button aria-label="Close"
                  onClick={() => updatePreferences({
                    ...preferences,
                    priorities: {
                      ...preferences.priorities,
                      [priority]: !preferences.priorities?.[priority]
                    }
                  })}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    preferences.priorities?.[priority] !== false ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <div
                    className={`absolute w-4 h-4 bg-white rounded-full shadow transition-transform top-0.5 ${
                      preferences.priorities?.[priority] !== false ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-3">Admin Categories</h4>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(adminCategories).map(([category, label]) => (
            <div key={category} className="flex items-center justify-between p-2 rounded border">
              <span className="text-sm">{label}</span>
              <button aria-label="Close"
                onClick={() => updatePreferences({
                  ...preferences,
                  categories: {
                    ...preferences.categories,
                    [category]: !preferences.categories?.[category]
                  }
                })}
                className={`w-4 h-4 rounded border-2 transition-colors ${
                  preferences.categories?.[category] !== false
                    ? 'bg-blue-600 border-blue-600'
                    : 'border-gray-300'
                }`}
              >
                {preferences.categories?.[category] !== false && (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full" />
                  </div>
                )}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Staff Quick Settings
const StaffQuickSettings: React.FC<{ preferences: Record<string, unknown>; updatePreferences: unknown }> = ({
  preferences,
  updatePreferences
}) => {
  const staffCategories = {
    tasks: 'Task Assignments',
    maintenance: 'Maintenance Requests',
    housekeeping: 'Housekeeping Tasks',
    guest_requests: 'Guest Requests',
    inventory: 'Inventory Alerts',
    schedule: 'Schedule Changes'
  };

  const shiftSettings = {
    morning: { label: 'Morning Shift (6AM-2PM)', icon: '🌅' },
    afternoon: { label: 'Afternoon Shift (2PM-10PM)', icon: '☀️' },
    night: { label: 'Night Shift (10PM-6AM)', icon: '🌙' }
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Wrench className="w-4 h-4 text-blue-500" />
          Work Categories
        </h4>
        <div className="space-y-2">
          {Object.entries(staffCategories).map(([category, label]) => (
            <div key={category} className="flex items-center justify-between p-2 rounded hover:bg-gray-50">
              <span className="text-sm font-medium">{label}</span>
              <button aria-label="Close"
                onClick={() => updatePreferences({
                  ...preferences,
                  categories: {
                    ...preferences.categories,
                    [category]: !preferences.categories?.[category]
                  }
                })}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  preferences.categories?.[category] !== false ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <div
                  className={`absolute w-4 h-4 bg-white rounded-full shadow transition-transform top-0.5 ${
                    preferences.categories?.[category] !== false ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-green-500" />
          Shift Preferences
        </h4>
        <div className="space-y-2">
          {Object.entries(shiftSettings).map(([shift, config]) => (
            <div key={shift} className="flex items-center justify-between p-2 rounded hover:bg-gray-50">
              <div className="flex items-center gap-2">
                <span>{config.icon}</span>
                <span className="text-sm">{config.label}</span>
              </div>
              <button aria-label="Close"
                onClick={() => updatePreferences({
                  ...preferences,
                  shifts: {
                    ...preferences.shifts,
                    [shift]: !preferences.shifts?.[shift]
                  }
                })}
                className={`w-4 h-4 rounded border-2 transition-colors ${
                  preferences.shifts?.[shift] !== false
                    ? 'bg-green-600 border-green-600'
                    : 'border-gray-300'
                }`}
              >
                {preferences.shifts?.[shift] !== false && (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full" />
                  </div>
                )}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Guest Quick Settings
const GuestQuickSettings: React.FC<{ preferences: Record<string, unknown>; updatePreferences: unknown }> = ({
  preferences,
  updatePreferences
}) => {
  const guestCategories = {
    bookings: 'My Bookings',
    payments: 'Payment Updates',
    services: 'Hotel Services',
    offers: 'Special Offers',
    loyalty: 'Loyalty Rewards',
    reviews: 'Review Requests'
  };

  const communicationPrefs = {
    immediate: { label: 'Immediate', desc: 'Get notified right away' },
    digest: { label: 'Daily Digest', desc: 'Once per day summary' },
    weekly: { label: 'Weekly', desc: 'Weekly summary only' }
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Bell className="w-4 h-4 text-blue-500" />
          What I Want to Know
        </h4>
        <div className="space-y-2">
          {Object.entries(guestCategories).map(([category, label]) => (
            <div key={category} className="flex items-center justify-between p-2 rounded hover:bg-gray-50">
              <span className="text-sm font-medium">{label}</span>
              <button aria-label="Close"
                onClick={() => updatePreferences({
                  ...preferences,
                  categories: {
                    ...preferences.categories,
                    [category]: !preferences.categories?.[category]
                  }
                })}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  preferences.categories?.[category] !== false ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <div
                  className={`absolute w-4 h-4 bg-white rounded-full shadow transition-transform top-0.5 ${
                    preferences.categories?.[category] !== false ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-3">How Often?</h4>
        <div className="space-y-2">
          {Object.entries(communicationPrefs).map(([freq, config]) => (
            <button aria-label="Close"
              key={freq}
              onClick={() => updatePreferences({
                ...preferences,
                frequency: freq
              })}
              className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors ${
                preferences.frequency === freq
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div>
                <div className="font-medium text-sm">{config.label}</div>
                <div className="text-xs text-gray-600">{config.desc}</div>
              </div>
              {preferences.frequency === freq && (
                <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                  <div className="w-2 h-2 bg-white rounded-full" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export const RoleSpecificQuickSettings: React.FC<RoleSpecificQuickSettingsProps> = ({
  isOpen,
  onClose,
  className = ''
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch current preferences
  const { data: preferences, isLoading } = useQuery({
    queryKey: ['notification-preferences', user?._id],
    queryFn: async () => {
      const response = await apiRequest('/api/v1/notifications/preferences');
      return response.data.preferences.notifications || {};
    },
    enabled: isOpen
  });

  // Update preferences mutation
  const updatePreferencesMutation = useMutation({
    mutationFn: async (updates: unknown) => {
      const response = await apiRequest('/api/v1/notifications/preferences', {
        method: 'PATCH',
        body: JSON.stringify({ notifications: updates })
      });
      return response.data.preferences;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
      queryClient.invalidateQueries({ queryKey: ['notification-quick-status'] });
    }
  });

  const handleUpdatePreferences = (updates: unknown) => {
    updatePreferencesMutation.mutate(updates);
  };

  if (!isOpen) return null;

  const getRoleTitle = () => {
    switch (user?.role) {
      case 'admin': return 'Admin Settings';
      case 'staff': return 'Staff Settings';
      case 'guest': return 'Guest Preferences';
      default: return 'Quick Settings';
    }
  };

  const getRoleIcon = () => {
    switch (user?.role) {
      case 'admin': return <Settings className="w-5 h-5 text-purple-600" />;
      case 'staff': return <Users className="w-5 h-5 text-blue-600" />;
      case 'guest': return <Bell className="w-5 h-5 text-green-600" />;
      default: return <Settings className="w-5 h-5 text-gray-600" />;
    }
  };

  return (
    <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 ${className}`}>
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getRoleIcon()}
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{getRoleTitle()}</h3>
                <p className="text-sm text-gray-600">Customize your notification experience</p>
              </div>
            </div>
            <button aria-label="Close"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-3"></div>
                  <div className="space-y-2">
                    <div className="h-10 bg-gray-200 rounded"></div>
                    <div className="h-10 bg-gray-200 rounded"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : preferences ? (
            <>
              {user?.role === 'admin' && (
                <AdminQuickSettings
                  preferences={preferences}
                  updatePreferences={handleUpdatePreferences}
                />
              )}
              {user?.role === 'staff' && (
                <StaffQuickSettings
                  preferences={preferences}
                  updatePreferences={handleUpdatePreferences}
                />
              )}
              {(user?.role === 'guest' || user?.role === 'travel_agent') && (
                <GuestQuickSettings
                  preferences={preferences}
                  updatePreferences={handleUpdatePreferences}
                />
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              {updatePreferencesMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  Saving changes...
                </span>
              ) : (
                <span className="text-green-600">✓ Changes saved automatically</span>
              )}
            </div>
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

export default RoleSpecificQuickSettings;
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  User,
  Bell,
  Palette,
  Clock,
  Save,
  ArrowLeft
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import StaffProfileSettings from './settings/StaffProfileSettings';
import StaffNotificationSettings from './settings/StaffNotificationSettings';
import StaffDisplaySettings from './settings/StaffDisplaySettings';
import StaffAvailabilitySettings from './settings/StaffAvailabilitySettings';
import { withErrorBoundary } from '../../components/ErrorBoundary';

interface TabItem {
  id: string;
  label: string;
  icon: React.ElementType;
  component: React.ComponentType<{ onSettingsChange: (hasChanges: boolean) => void }>;
}

function StaffSettings() {
  const navigate = useNavigate();
  const location = useLocation();

  // Get initial tab from URL or default to profile
  const getInitialTab = () => {
    const searchParams = new URLSearchParams(location.search);
    return searchParams.get('tab') || 'profile';
  };

  const [activeTab, setActiveTab] = useState(getInitialTab());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const tabs: TabItem[] = [
    {
      id: 'profile',
      label: 'Profile',
      icon: User,
      component: StaffProfileSettings
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: Bell,
      component: StaffNotificationSettings
    },
    {
      id: 'display',
      label: 'Display',
      icon: Palette,
      component: StaffDisplaySettings
    },
    {
      id: 'availability',
      label: 'Availability',
      icon: Clock,
      component: StaffAvailabilitySettings
    }
  ];

  const handleTabChange = (tabId: string) => {
    if (hasUnsavedChanges) {
      const confirmLeave = window.confirm(
        'You have unsaved changes. Are you sure you want to leave this section?'
      );
      if (!confirmLeave) return;
    }

    setActiveTab(tabId);
    setHasUnsavedChanges(false);

    // Update URL without triggering navigation
    const newUrl = `${location.pathname}?tab=${tabId}`;
    window.history.replaceState({}, '', newUrl);
  };

  const handleGoBack = () => {
    if (hasUnsavedChanges) {
      const confirmLeave = window.confirm(
        'You have unsaved changes. Are you sure you want to leave?'
      );
      if (!confirmLeave) return;
    }
    navigate('/staff');
  };

  const activeTabData = tabs.find(tab => tab.id === activeTab) || tabs[0];
  const ActiveComponent = activeTabData.component;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleGoBack}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Dashboard</span>
              </Button>
              <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
            </div>

            {hasUnsavedChanges && (
              <div className="flex items-center space-x-2 text-amber-600">
                <Save className="h-4 w-4" />
                <span className="text-sm">You have unsaved changes</span>
              </div>
            )}
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;

                return (
                  <button
                    aria-label={tab.label}
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`
                      flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
                      ${isActive
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }
                    `}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow-sm rounded-lg">
          <ActiveComponent onSettingsChange={setHasUnsavedChanges} />
        </div>
      </div>
    </div>
  );
}

export default withErrorBoundary(StaffSettings);

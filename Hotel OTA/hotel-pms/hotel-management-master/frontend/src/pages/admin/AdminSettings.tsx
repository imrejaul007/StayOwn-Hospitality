import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  User,
  Building,
  Bell,
  Palette,
  Shield,
  Globe,
  Save,
  ArrowLeft
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import ProfileSettings from './settings/ProfileSettings';
import HotelSettings from './settings/HotelSettings';
import NotificationSettings from './settings/NotificationSettings';
import DisplaySettings from './settings/DisplaySettings';
import SystemSettings from './settings/SystemSettings';
import IntegrationSettings from './settings/IntegrationSettings';
import { withErrorBoundary } from '../../components/ErrorBoundary';

interface TabItem {
  id: string;
  label: string;
  icon: React.ElementType;
  component: React.ComponentType<{ onSettingsChange?: (hasChanges: boolean) => void }>;
}

function AdminSettings() {
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedPropertyId, selectedProperty, viewMode } = useProperty();

  // Get initial tab from URL or default to profile
  const getInitialTab = () => {
    const searchParams = new URLSearchParams(location.search);
    return searchParams.get('tab') || 'profile';
  };

  const [activeTab, setActiveTab] = useState(getInitialTab());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Early return if no property selected in single mode
  if (!selectedPropertyId && viewMode === 'single') {
    return <div className="p-6">Please select a property</div>;
  }

  const tabs: TabItem[] = [
    {
      id: 'profile',
      label: 'Profile',
      icon: User,
      component: ProfileSettings
    },
    {
      id: 'hotel',
      label: 'Hotel',
      icon: Building,
      component: HotelSettings
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: Bell,
      component: NotificationSettings
    },
    {
      id: 'display',
      label: 'Display',
      icon: Palette,
      component: DisplaySettings
    },
    {
      id: 'system',
      label: 'System',
      icon: Shield,
      component: SystemSettings
    },
    {
      id: 'integrations',
      label: 'Integrations',
      icon: Globe,
      component: IntegrationSettings
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
    navigate('/admin');
  };

  const activeTabData = tabs.find(tab => tab.id === activeTab) || tabs[0];
  const ActiveComponent = activeTabData.component;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Property Breadcrumb */}
      <PropertyBreadcrumb items={['Configuration', 'Settings']} />

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

export default withErrorBoundary(AdminSettings);

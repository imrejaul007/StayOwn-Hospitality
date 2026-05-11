import React from 'react';
import { withErrorBoundary } from '../../components/ErrorBoundary';
import { MobileAppInfrastructure } from '../../components/mobile/MobileAppInfrastructure';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';

const AdminMobileApps: React.FC = () => {
  const { selectedPropertyId, selectedProperty, viewMode } = useProperty();

  // If in single mode and no property selected, show selection prompt
  if (!selectedPropertyId && viewMode === 'single') {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <PropertyBreadcrumb items={['Integration', 'Mobile Apps']} />
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-gray-600 text-lg">Please select a property to view mobile apps</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6">
        <PropertyBreadcrumb items={['Integration', 'Mobile Apps']} />
      </div>
      <MobileAppInfrastructure />
    </div>
  );
};

export default AdminMobileApps;
import React from 'react';
import { withErrorBoundary } from '../../components/ErrorBoundary';
import SimpleAutomationDashboard from '../../components/automation/SimpleAutomationDashboard';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';

const AdminAutomation: React.FC = () => {
  const { selectedPropertyId, viewMode } = useProperty();

  // If in single mode and no property selected, show selection prompt
  if (!selectedPropertyId && viewMode === 'single') {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <PropertyBreadcrumb items={['Integration', 'Automation']} />
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-gray-600 text-lg">Please select a property to view automation</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6">
        <PropertyBreadcrumb items={['Integration', 'Automation']} />
      </div>
      <SimpleAutomationDashboard />
    </div>
  );
};

export default withErrorBoundary(AdminAutomation);

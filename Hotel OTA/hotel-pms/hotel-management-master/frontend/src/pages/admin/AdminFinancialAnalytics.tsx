import React from 'react';
import BypassFinancialDashboard from '../../components/admin/BypassFinancialDashboard';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import { withErrorBoundary } from '../../components/ErrorBoundary';

function AdminFinancialAnalyticsPage() {
  const { selectedPropertyId, selectedProperty, viewMode } = useProperty();

  // If in single mode and no property selected, show selection prompt
  if (!selectedPropertyId && viewMode === 'single') {
    return (
      <div className="container mx-auto px-4 py-6">
        <PropertyBreadcrumb items={['Analytics', 'Financial Analytics']} />
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-gray-600 text-lg">Please select a property to view financial analytics</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <PropertyBreadcrumb items={['Analytics', 'Financial Analytics']} />
      <BypassFinancialDashboard />
    </div>
  );
}

export default withErrorBoundary(AdminFinancialAnalyticsPage);

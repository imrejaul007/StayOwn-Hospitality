import React from 'react';
import BypassApprovalCenter from '../../components/admin/BypassApprovalCenter';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import { Shield } from 'lucide-react';
import { withErrorBoundary } from '../../components/ErrorBoundary';

function AdminBypassApprovalsPage() {
  const { selectedPropertyId, viewMode } = useProperty();

  if (!selectedPropertyId && viewMode === 'single') {
    return (
      <div className="container mx-auto px-4 py-6">
        <PropertyBreadcrumb items={['Bypass Approvals']} />
        <div className="text-center py-12">
          <Shield className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Property Selected</h3>
          <p className="text-gray-500">Please select a property to view bypass approvals.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <PropertyBreadcrumb items={['Bypass Approvals']} />
      <BypassApprovalCenter />
    </div>
  );
}

export default withErrorBoundary(AdminBypassApprovalsPage);

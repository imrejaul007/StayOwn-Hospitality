import React from 'react';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import AdminBypassCheckout from '../../components/admin/AdminBypassCheckout';
import { withErrorBoundary } from '../../components/ErrorBoundary';

function AdminBypassCheckoutPage() {
  const { selectedPropertyId, selectedProperty, viewMode } = useProperty();

  if (!selectedPropertyId && viewMode === 'single') {
    return <div className="p-6">Please select a property</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <PropertyBreadcrumb items={['Bypass Checkout']} />

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Admin Bypass Checkout</h1>
        <p className="text-gray-600 mt-1">
          Emergency checkout option for special cases and urgent situations
        </p>
      </div>

      <AdminBypassCheckout propertyId={selectedPropertyId} />
    </div>
  );
}

export default withErrorBoundary(AdminBypassCheckoutPage);

import React from 'react';
import { withErrorBoundary } from '../../components/ErrorBoundary';
import { useAuth } from '../../context/AuthContext';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import InventoryCalendar from '../../components/inventory/InventoryCalendar';

const AdminInventoryManagement: React.FC = () => {
  const { user } = useAuth();
  const { selectedPropertyId } = useProperty();

  // Use PropertyContext's selectedPropertyId
  const hotelId = selectedPropertyId || user?.hotelId || '';

  // Show message if no property is selected
  if (!hotelId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30">
        <div className="p-6 max-w-7xl mx-auto">
          <PropertyBreadcrumb items={['Inventory Management']} />
          <div className="text-center py-12">
            <div className="text-gray-500 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Property Selected</h3>
            <p className="text-gray-500">Please select a property to view inventory management.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30">
      <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
        {/* Breadcrumb */}
        <PropertyBreadcrumb items={['Inventory Management']} />

        {/* Modern Header with Gradient */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-purple-600/10 rounded-3xl blur-3xl"></div>
          <div className="relative bg-white/80 backdrop-blur-sm border border-white/20 rounded-3xl p-4 sm:p-6 lg:p-8 shadow-xl">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 sm:gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 sm:gap-4 mb-4">
                  <div className="p-2 sm:p-3 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-2xl">
                    <svg className="h-6 w-6 sm:h-8 sm:w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div>
                    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
                      Inventory Management
                    </h1>
                    <p className="text-gray-600 text-sm sm:text-base mt-2">
                      Manage room availability, rates, and restrictions by date
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <InventoryCalendar hotelId={hotelId} />
      </div>
    </div>
  );
};

export default AdminInventoryManagement;
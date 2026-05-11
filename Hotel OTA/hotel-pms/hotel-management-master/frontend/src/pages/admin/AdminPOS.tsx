import React, { useState } from 'react';
import { withErrorBoundary } from '../../components/ErrorBoundary';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import POSDashboard from '../../components/pos/POSDashboard';
import POSOrderEntry from '../../components/pos/POSOrderEntry';
import OutletManagement from '../../components/pos/OutletManagement';
import MenuManagement from '../../components/pos/MenuManagement';
import UnifiedBillingSystem from '../../components/pos/UnifiedBillingSystem';
import POSReports from '../../components/pos/POSReports';

const AdminPOS: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { selectedPropertyId } = useProperty();

  const handleNewOrderClick = () => {
    setActiveTab('orders');
  };

  // Show message if no property is selected
  if (!selectedPropertyId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="p-6 max-w-7xl mx-auto">
          <PropertyBreadcrumb items={['POS']} />
          <div className="text-center py-12">
            <div className="text-gray-500 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Property Selected</h3>
            <p className="text-gray-500">Please select a property to access POS system.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
        {/* Breadcrumb */}
        <PropertyBreadcrumb items={['POS']} />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="orders">New Order</TabsTrigger>
          <TabsTrigger value="outlets">Outlets</TabsTrigger>
          <TabsTrigger value="menus">Menus</TabsTrigger>
          <TabsTrigger value="billing">Unified Billing</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <POSDashboard onNewOrderClick={handleNewOrderClick} />
        </TabsContent>

        <TabsContent value="orders">
          <POSOrderEntry />
        </TabsContent>

        <TabsContent value="outlets">
          <OutletManagement />
        </TabsContent>

        <TabsContent value="menus">
          <MenuManagement />
        </TabsContent>

        <TabsContent value="billing">
          <UnifiedBillingSystem />
        </TabsContent>

        <TabsContent value="reports">
          <POSReports />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPOS;
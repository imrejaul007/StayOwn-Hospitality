import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import PricingRulesManagement from '../../components/revenue/PricingRulesManagement';
import RevenueManagementDashboard from '../../components/revenue/RevenueManagementDashboard';
import PackageManagement from '../../components/revenue/PackageManagement';
import RateShoppingDashboard from '../../components/revenue/RateShoppingDashboard';
import CorporateRatesManagement from '../../components/revenue/CorporateRatesManagement';
import { withErrorBoundary } from '../../components/ErrorBoundary';

const AdminRevenueManagement: React.FC = () => {
  const { selectedPropertyId } = useProperty();

  // Property validation
  if (!selectedPropertyId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🏨</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Property Selected</h2>
          <p className="text-gray-600">Please select a property from the header to view revenue management.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Property Breadcrumb */}
      <PropertyBreadcrumb items={['Revenue Management']} />

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1 p-1 h-auto">
          <TabsTrigger value="dashboard" className="text-xs sm:text-sm px-2 py-2 min-h-[2.5rem]">Dashboard</TabsTrigger>
          <TabsTrigger value="pricing-rules" className="text-xs sm:text-sm px-2 py-2 min-h-[2.5rem]">Pricing Rules</TabsTrigger>
          <TabsTrigger value="packages" className="text-xs sm:text-sm px-2 py-2 min-h-[2.5rem]">Packages</TabsTrigger>
          <TabsTrigger value="competitors" className="text-xs sm:text-sm px-2 py-2 min-h-[2.5rem]">Rate Shopping</TabsTrigger>
          <TabsTrigger value="corporate" className="text-xs sm:text-sm px-2 py-2 min-h-[2.5rem]">Corporate Rates</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <RevenueManagementDashboard />
        </TabsContent>

        <TabsContent value="pricing-rules">
          <PricingRulesManagement />
        </TabsContent>

        <TabsContent value="packages">
          <PackageManagement />
        </TabsContent>

        <TabsContent value="competitors">
          <RateShoppingDashboard />
        </TabsContent>

        <TabsContent value="corporate">
          <CorporateRatesManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default withErrorBoundary(AdminRevenueManagement);
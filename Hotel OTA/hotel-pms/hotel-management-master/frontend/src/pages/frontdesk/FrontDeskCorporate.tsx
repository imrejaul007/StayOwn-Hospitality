import React, { useState } from 'react';
import {
  Building2,
  CalendarDays,
  RefreshCw,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { Button } from '@/components/ui/button';
import CorporateCompanyManagement from '../../components/admin/CorporateCompanyManagement';
import GroupBookingManagement from '../../components/admin/GroupBookingManagement';
import { withErrorBoundary } from '../../components/ErrorBoundary';

function FrontDeskCorporate() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('companies');

  const handleRefresh = () => {
    setRefreshing(true);
    // Increment key to force child components to refetch
    setRefreshKey(prev => prev + 1);
    // Reset spinner after a short delay (children handle their own loading)
    setTimeout(() => setRefreshing(false), 500);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Corporate Management</h1>
          <p className="text-gray-600">Manage corporate companies and group bookings</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            variant="outline"
            className="flex items-center"
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Info Notice - Only 2 tabs available for frontdesk */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Front Desk Access:</strong> You have access to Company Management and Group Bookings.
          For Overview, Credit Management, and GST/Invoicing, contact an administrator.
        </p>
      </div>

      {/* Navigation Tabs - ONLY 2 TABS FOR FRONTDESK */}
      <div className="bg-white rounded-lg shadow-sm mb-6">
        <div className="border-b border-gray-200">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('companies')}
              className={cn(
                "py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap",
                activeTab === 'companies'
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
            >
              <Building2 className="w-4 h-4 inline mr-2" />
              Company Management
            </button>
            <button
              onClick={() => setActiveTab('bookings')}
              className={cn(
                "py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap",
                activeTab === 'bookings'
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
            >
              <CalendarDays className="w-4 h-4 inline mr-2" />
              Group Bookings
            </button>
            {/* Removed: Overview, Credit Management, GST & Invoicing tabs */}
          </div>
        </div>

        {/* Tab Content */}
        <div className="mt-6">
          {/* Companies Tab */}
          {activeTab === 'companies' && (
            <CorporateCompanyManagement key={`companies-${refreshKey}`} readOnly />
          )}

          {/* Bookings Tab */}
          {activeTab === 'bookings' && (
            <GroupBookingManagement key={`bookings-${refreshKey}`} />
          )}
        </div>
      </div>
    </div>
  );
}

export default withErrorBoundary(FrontDeskCorporate);

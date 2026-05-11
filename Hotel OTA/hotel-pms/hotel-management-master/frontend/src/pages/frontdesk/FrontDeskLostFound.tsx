import React, { useState } from 'react';
import {
  RefreshCw,
  Info,
  AlertCircle,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { Button } from '@/components/ui/button';
import { useProperty } from '../../context/PropertyContext';
import LostFoundManager from '../../components/operational/LostFoundManager';
import { withErrorBoundary } from '../../components/ErrorBoundary';

function FrontDeskLostFound() {
  const { selectedProperty } = useProperty();
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    setRefreshKey((prev) => prev + 1);
    setTimeout(() => setRefreshing(false), 500);
  };

  // Property guard
  if (!selectedProperty) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lost & Found</h1>
          <p className="text-gray-600">Manage lost and found items</p>
        </div>
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-yellow-400 mr-3" />
            <p className="text-sm font-medium text-yellow-800">
              Please select a property to manage lost and found items.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lost & Found</h1>
          <p className="text-gray-600">Log, search, and manage lost and found items</p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={refreshing}
          variant="outline"
          className="flex items-center"
        >
          <RefreshCw className={cn('w-4 h-4 mr-2', refreshing && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Info Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800 flex items-start gap-2">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>
            <strong>Front Desk Access:</strong> You can log found items, search the inventory, mark
            items as claimed, and update item details. Bulk disposal of expired items is restricted
            to administrators.
          </span>
        </p>
      </div>

      {/* Lost & Found Manager Component */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <LostFoundManager key={`lost-found-${refreshKey}`} onRefresh={handleRefresh} />
      </div>
    </div>
  );
}

export default withErrorBoundary(FrontDeskLostFound);

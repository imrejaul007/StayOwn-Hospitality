import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import RoomTypeManagement from '../../components/admin/RoomTypeManagement';
import { withErrorBoundary } from '../../components/ErrorBoundary';

// FrontDesk version: View only, no "Add Room Type" button, no delete buttons
const FrontDeskRoomTypes: React.FC = () => {
  const { user } = useAuth();
  const { selectedPropertyId } = useProperty();

  // Use the authenticated user's hotelId as fallback
  const hotelId = selectedPropertyId || user?.hotelId;

  if (!hotelId) {
    return (
      <div className="space-y-6">
        <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-800">Please select a property or contact your administrator.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Property Breadcrumb */}
      <PropertyBreadcrumb items={['Configuration', 'Room Types']} />

      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Room Types (View Only)</h1>
        <p className="text-gray-600">View room types and configurations</p>
        <p className="text-sm text-yellow-600 mt-2">Note: Price changes require admin approval</p>
      </div>

      {/* Information Banner */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>Front Desk Staff:</strong> You can view room types but cannot add new types or delete existing ones.
          To request a price change, please contact an administrator.
        </p>
      </div>

      {/* Room Type Management Component in View-Only Mode */}
      <RoomTypeManagement hotelId={hotelId} viewOnly={true} />
    </div>
  );
};

export default withErrorBoundary(FrontDeskRoomTypes);

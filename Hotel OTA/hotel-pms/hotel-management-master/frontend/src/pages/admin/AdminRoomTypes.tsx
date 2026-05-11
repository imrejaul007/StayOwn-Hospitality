import React from 'react';
import RoomTypeManagement from '../../components/admin/RoomTypeManagement';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import { withErrorBoundary } from '../../components/ErrorBoundary';

const AdminRoomTypes: React.FC = () => {
  const { selectedPropertyId, selectedProperty, viewMode } = useProperty();

  // Early return if no property selected in single mode
  if (!selectedPropertyId && viewMode === 'single') {
    return <div className="p-6">Please select a property</div>;
  }

  return (
    <div className="space-y-6">
      {/* Property Breadcrumb */}
      <PropertyBreadcrumb items={['Configuration', 'Room Types']} />

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Room Type Management</h1>
        <p className="text-gray-600">Manage room types, configurations, and OTA mappings</p>
      </div>

      <RoomTypeManagement hotelId={selectedPropertyId!} />
    </div>
  );
};

export default withErrorBoundary(AdminRoomTypes);
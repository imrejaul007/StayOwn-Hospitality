import React, { useState, useEffect, useRef} from 'react';
import {
  Plus,
  Edit,
  Trash2,
  Users,
  Bed,
  Upload,
  Link,
  AlertCircle,
  CheckCircle,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Select } from '../ui/Select';
import { roomTypeService, type RoomType, type CreateRoomTypeData } from '../../services/roomTypeService';
import { otaIntegrationService } from '../../services/otaIntegrationService';
import { ApplyToSelector, ApplyToConfirmation, ApplyToScope } from '../settings/ApplyToSelector';
import { useSettingsInheritance, useAffectedPropertiesCount } from '../../hooks/useSettingsInheritance';
import { useProperty } from '../../context/PropertyContext';
import toast from 'react-hot-toast';
import { withErrorBoundary } from '../ErrorBoundary';

interface RoomTypeManagementProps {
  hotelId: string;
  viewOnly?: boolean;
}

const RoomTypeManagement: React.FC<RoomTypeManagementProps> = ({ hotelId, viewOnly = false }) => {
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRoomType, setSelectedRoomType] = useState<RoomType | null>(null);
  const [formData, setFormData] = useState<Partial<CreateRoomTypeData>>({});
  const [migrationStatus, setMigrationStatus] = useState<{
    currentStatus: { hasRoomTypes: boolean; hasInventoryRecords: boolean; roomsWithoutRoomTypes: number };
    migrationSteps: Array<{ step: string; completed: boolean; action: string }>;
    nextActions: string[];
  } | null>(null);

  // Multi-property support
  const { selectedPropertyId, properties } = useProperty();
  const [applyToScope, setApplyToScope] = useState<ApplyToScope>('single');
  const [targetPropertyId, setTargetPropertyId] = useState<string>(hotelId);
  const [showSuccess, setShowSuccess] = useState(false);

  const {
    useInheritanceStatus,
    applySettings,
    isUpdating,
    updateError,
    showConfirmation,
    pendingUpdate,
    confirmBulkUpdate,
    cancelBulkUpdate,
  } = useSettingsInheritance();

  const { data: inheritanceStatus } = useInheritanceStatus(selectedPropertyId);
  const affectedCount = useAffectedPropertiesCount(
    applyToScope,
    inheritanceStatus?.groupPropertyCount || 0
  );

  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  useEffect(() => {
    fetchRoomTypes();
    checkMigrationStatus();
  }, [hotelId]);

  const fetchRoomTypes = async () => {
    try {
      setLoading(true);
      const data = await roomTypeService.getRoomTypesWithStats(hotelId);
      
      // Ensure data is an array
      const roomTypesArray = Array.isArray(data) ? data : [];
      setRoomTypes(roomTypesArray);
      setError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch room types';
      setError(message);
      setRoomTypes([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const checkMigrationStatus = async () => {
    try {
      const status = await otaIntegrationService.migrationHelper(hotelId);
      setMigrationStatus(status);
    } catch {
      // Error handled silently
    }
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.code || !formData.basePrice || !formData.totalRooms) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      const effectiveHotelId = applyToScope === 'single' ? targetPropertyId : hotelId;
      const roomTypeData = {
        ...formData,
        hotelId: effectiveHotelId,
        maxOccupancy: formData.maxOccupancy || 2,
        basePrice: Number(formData.basePrice),
        totalRooms: Number(formData.totalRooms)
      };

      // If multi-property update, use applySettings
      if (applyToScope !== 'single') {
        const result = await applySettings({
          scope: applyToScope,
          propertyId: selectedPropertyId,
          settingUpdates: roomTypeData,
          settingType: 'room_types',
        });

        if (!result) return; // Confirmation dialog shown

        setShowSuccess(true);
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => setShowSuccess(false), 3000);
        toast.success(`Room type created successfully${
          applyToScope !== 'single' ? ` for ${result.propertiesUpdated} properties` : ''
        }`);
        setApplyToScope('single');
      } else {
        // Single property update
        await roomTypeService.createRoomType(roomTypeData as CreateRoomTypeData);
        toast.success('Room type created successfully');
      }

      // Refresh the room types data to get updated statistics
      await fetchRoomTypes();
      setShowCreateModal(false);
      setFormData({});
      setError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create room type';
      setError(message);
      toast.error(message);
    }
  };

  const handleUpdate = async () => {
    if (!selectedRoomType || !formData.name || !formData.code || !formData.basePrice || !formData.totalRooms) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      const updateData = {
        ...formData,
        basePrice: Number(formData.basePrice),
        maxOccupancy: Number(formData.maxOccupancy),
        totalRooms: Number(formData.totalRooms)
      };

      // If multi-property update, use applySettings
      if (applyToScope !== 'single') {
        const result = await applySettings({
          scope: applyToScope,
          propertyId: selectedPropertyId,
          settingUpdates: {
            roomTypeId: selectedRoomType._id,
            ...updateData
          },
          settingType: 'room_types_update',
        });

        if (!result) return; // Confirmation dialog shown

        setShowSuccess(true);
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => setShowSuccess(false), 3000);
        toast.success(`Room type updated successfully${
          applyToScope !== 'single' ? ` for ${result.propertiesUpdated} properties` : ''
        }`);
        setApplyToScope('single');
      } else {
        // Single property update
        await roomTypeService.updateRoomType(
          selectedRoomType._id,
          updateData
        );
        toast.success('Room type updated successfully');
      }

      // Refresh the room types data to get updated statistics
      await fetchRoomTypes();
      setShowEditModal(false);
      setSelectedRoomType(null);
      setFormData({});
      setError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update room type';
      setError(message);
      toast.error(message);
    }
  };

  const handleConfirm = async () => {
    if (pendingUpdate) {
      const result = await confirmBulkUpdate();
      if (result) {
        setShowSuccess(true);
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => setShowSuccess(false), 3000);
        toast.success(`Settings updated for ${result.propertiesUpdated} properties`);
        setApplyToScope('single');
        await fetchRoomTypes();
      }
    }
  };

  const handleDelete = async (roomType: RoomType) => {
    if (!window.confirm(`Are you sure you want to delete ${roomType.name}?`)) {
      return;
    }

    try {
      await roomTypeService.deleteRoomType(roomType._id);
      // Refresh the room types data to get updated statistics
      await fetchRoomTypes();
      setError(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete room type';
      setError(message);
    }
  };

  const openCreateModal = () => {
    setFormData({});
    setTargetPropertyId(hotelId);
    setApplyToScope('single');
    setShowCreateModal(true);
    setError(null);
  };

  const openEditModal = (roomType: RoomType) => {
    setSelectedRoomType(roomType);
    setFormData({
      name: roomType.name,
      code: roomType.code,
      maxOccupancy: roomType.maxOccupancy,
      basePrice: roomType.basePrice,
      totalRooms: roomType.totalRooms,
      description: roomType.description,
      amenities: roomType.amenities,
      legacyType: roomType.legacyType
    });
    setShowEditModal(true);
    setError(null);
  };

  const runMigration = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await roomTypeService.migrateRoomsToRoomTypes(hotelId);
      if (result?.migratedCount > 0) {
        toast.success(`Migration complete! ${result.migratedCount} room(s) migrated to room types.`);
      } else if (result?.totalRooms === 0) {
        toast('No rooms found to migrate. Create room types manually.', { icon: 'ℹ️' });
      } else {
        toast.success('Migration completed.');
      }
      await fetchRoomTypes();
      await checkMigrationStatus();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Migration failed';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin h-8 w-8 text-blue-600" />
        <span className="ml-2 text-gray-600">Loading room types...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <p className="text-gray-600">Manage your hotel's room types and configurations</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={fetchRoomTypes} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          {!viewOnly && (
            <Button onClick={openCreateModal} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Room Type
            </Button>
          )}
        </div>
      </div>

      {/* Success Message */}
      {showSuccess && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 px-4 py-3 rounded-lg">
          <p className="font-medium">Room type settings updated successfully!</p>
          {applyToScope !== 'single' && affectedCount > 1 && (
            <p className="text-sm mt-1">Changes applied to {affectedCount} properties</p>
          )}
        </div>
      )}

      {/* Error Message */}
      {updateError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 px-4 py-3 rounded-lg">
          <p className="font-medium">Error: {updateError}</p>
        </div>
      )}

      {/* Inheritance Status Card */}
      {inheritanceStatus?.isInheriting && inheritanceStatus?.hasGroup && (
        <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  This property is part of: {inheritanceStatus.groupName}
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  Room type settings are inherited from the property group.
                  {inheritanceStatus.lastSyncedAt && (
                    <span className="ml-1">
                      Last synced: {new Date(inheritanceStatus.lastSyncedAt).toLocaleString()}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center">
          <AlertCircle className="w-5 h-5 text-red-600 mr-3" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {/* Migration Status */}
      {migrationStatus && !migrationStatus.currentStatus.hasRoomTypes && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center text-yellow-700">
              <AlertCircle className="w-5 h-5 mr-2" />
              Migration Required
            </CardTitle>
            <CardDescription>
              Your hotel hasn't been migrated to the OTA-ready system yet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-yellow-50 p-4 rounded-lg">
                <p className="text-sm text-yellow-800 mb-3">
                  To use the new room type system, you need to migrate your existing rooms.
                  This will create room types based on your current room configurations.
                </p>
                <Button onClick={runMigration} className="bg-yellow-600 hover:bg-yellow-700">
                  <Upload className="w-4 h-4 mr-2" />
                  Run Migration
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="flex items-center p-6">
            <Bed className="w-8 h-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Room Types</p>
              <p className="text-2xl font-bold text-gray-900">{roomTypes.length}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex items-center p-6">
            <Users className="w-8 h-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Rooms</p>
              <p className="text-2xl font-bold text-gray-900">
                {roomTypes.reduce((sum, rt) => sum + (rt.totalRooms || 0), 0)}
              </p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex items-center p-6">
            <div className="w-8 h-8 text-yellow-600 flex items-center justify-center">
              <span className="text-2xl font-bold">₹</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Avg Base Rate</p>
              <p className="text-2xl font-bold text-gray-900">
                ₹{roomTypes.length > 0 ? Math.round(roomTypes.reduce((sum, rt) => sum + (Number(rt.basePrice || rt.baseRate) || 0), 0) / roomTypes.length) : 0}
              </p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex items-center p-6">
            <CheckCircle className="w-8 h-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Types</p>
              <p className="text-2xl font-bold text-gray-900">
                {roomTypes.filter(rt => rt.isActive).length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Room Types Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {roomTypes.map((roomType) => (
          <Card key={roomType._id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center">
                    <Bed className="w-5 h-5 mr-2 text-blue-600" />
                    {roomType.name}
                  </CardTitle>
                  <CardDescription>
                    Code: {roomType.code} • Max: {roomType.maxOccupancy} guests
                  </CardDescription>
                </div>
                <Badge variant={roomType.isActive ? 'success' : 'secondary'}>
                  {roomType.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent>
              <div className="space-y-4">
                {/* Pricing */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Base Rate</span>
                  <span className="text-lg font-bold text-gray-900">₹{Number(roomType.basePrice) || 0}</span>
                </div>
                
                {/* Room Count */}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Total Rooms</span>
                  <span className="text-sm font-semibold text-blue-600">
                    {roomType.totalRooms || 0} rooms
                  </span>
                </div>

                {/* Amenities */}
                {roomType.amenities && roomType.amenities.length > 0 && (
                  <div>
                    <span className="text-sm font-medium text-gray-600 block mb-2">Amenities</span>
                    <div className="flex flex-wrap gap-1">
                      {roomType.amenities.slice(0, 3).map((amenity, index) => (
                        <Badge key={typeof amenity === 'string' ? amenity : amenity.code || amenity.name || index} variant="outline" className="text-xs">
                          {typeof amenity === 'string' ? amenity : amenity.name || amenity.code || 'Unknown'}
                        </Badge>
                      ))}
                      {roomType.amenities.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{roomType.amenities.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Channel Mappings */}
                {roomType.channelMappings && roomType.channelMappings.length > 0 && (
                  <div>
                    <span className="text-sm font-medium text-gray-600 block mb-2">
                      OTA Channels ({roomType.channelMappings.length})
                    </span>
                    <div className="flex items-center text-sm text-green-600">
                      <Link className="w-4 h-4 mr-1" />
                      Ready for OTA sync
                    </div>
                  </div>
                )}

                {/* Actions */}
                {!viewOnly && (
                  <div className="flex justify-between pt-4 border-t border-gray-200">
                    <Button
                      onClick={() => openEditModal(roomType)}
                      variant="outline"
                      size="sm"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      onClick={() => handleDelete(roomType)}
                      variant="outline"
                      size="sm"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {roomTypes.length === 0 && !loading && (
        <Card>
          <CardContent className="text-center py-12">
            <Bed className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Room Types Found</h3>
            <p className="text-gray-600 mb-4">
              {viewOnly
                ? 'No room types have been configured yet. Contact an administrator.'
                : 'Create your first room type to start managing your inventory'
              }
            </p>
            {!viewOnly && (
              <Button onClick={openCreateModal} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Create Room Type
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Room Type"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <Input
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Deluxe Ocean View"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Code *
              </label>
              <Input
                value={formData.code || ''}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="e.g., DOV"
                maxLength={10}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Occupancy *
              </label>
              <Input
                type="number"
                min="1"
                max="10"
                value={formData.maxOccupancy || ''}
                onChange={(e) => setFormData({ ...formData, maxOccupancy: Number(e.target.value) })}
                placeholder="2"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Base Price (₹) *
              </label>
              <Input
                type="number"
                min="0"
                step="50"
                value={formData.basePrice || ''}
                onChange={(e) => setFormData({ ...formData, basePrice: Number(e.target.value) })}
                placeholder="2000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Total Rooms *
              </label>
              <Input
                type="number"
                min="1"
                max="100"
                value={formData.totalRooms || ''}
                onChange={(e) => setFormData({ ...formData, totalRooms: Number(e.target.value) })}
                placeholder="10"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe this room type..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Legacy Room Type (for migration)
            </label>
            <Select
              value={formData.legacyType || ''}
              onChange={(value) => setFormData({ ...formData, legacyType: value as string })}
              options={[
                { value: '', label: 'Select legacy type...' },
                { value: 'single', label: 'Single' },
                { value: 'double', label: 'Double' },
                { value: 'suite', label: 'Suite' },
                { value: 'deluxe', label: 'Deluxe' }
              ]}
            />
          </div>

          {/* Property selector */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Create Room Type For
            </label>
            <div className="space-y-2">
              {/* Single property option with dropdown */}
              <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                     onClick={() => setApplyToScope('single')}>
                <input
                  type="radio"
                  name="applyScope"
                  checked={applyToScope === 'single'}
                  onChange={() => setApplyToScope('single')}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="font-medium text-sm">Specific Property</div>
                  {applyToScope === 'single' && properties.length > 1 && (
                    <select
                      value={targetPropertyId}
                      onChange={(e) => setTargetPropertyId(e.target.value)}
                      className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {properties.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.name}{p.address?.city ? ` — ${p.address.city}` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                  {applyToScope === 'single' && properties.length <= 1 && (
                    <div className="text-xs text-gray-500 mt-1">
                      {properties[0]?.name || 'Current property'}
                    </div>
                  )}
                </div>
              </label>

              {/* All properties option */}
              <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                     onClick={() => setApplyToScope('all')}>
                <input
                  type="radio"
                  name="applyScope"
                  checked={applyToScope === 'all'}
                  onChange={() => setApplyToScope('all')}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium text-sm">All My Properties</div>
                  <div className="text-xs text-gray-500">
                    All {properties.length} properties you manage
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              onClick={() => setShowCreateModal(false)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Create Room Type
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={`Edit ${selectedRoomType?.name}`}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <Input
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Deluxe Ocean View"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Code *
              </label>
              <Input
                value={formData.code || ''}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="e.g., DOV"
                maxLength={10}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Occupancy *
              </label>
              <Input
                type="number"
                min="1"
                max="10"
                value={formData.maxOccupancy || ''}
                onChange={(e) => setFormData({ ...formData, maxOccupancy: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Base Price (₹) *
              </label>
              <Input
                type="number"
                min="0"
                step="50"
                value={formData.basePrice || ''}
                onChange={(e) => setFormData({ ...formData, basePrice: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Total Rooms *
              </label>
              <Input
                type="number"
                min="1"
                max="100"
                value={formData.totalRooms || ''}
                onChange={(e) => setFormData({ ...formData, totalRooms: Number(e.target.value) })}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe this room type..."
            />
          </div>

          {/* Multi-property selector */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <ApplyToSelector
              value={applyToScope}
              onChange={setApplyToScope}
              isInGroup={inheritanceStatus?.hasGroup || false}
              groupName={inheritanceStatus?.groupName}
              totalProperties={inheritanceStatus?.groupPropertyCount || 0}
              showWarning={true}
              warningMessage="This room type update will be applied to all selected properties. Ensure the changes are appropriate for all properties."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              onClick={() => setShowEditModal(false)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Update Room Type
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirmation Dialog */}
      <ApplyToConfirmation
        isOpen={showConfirmation}
        scope={applyToScope}
        affectedCount={affectedCount}
        settingName="Room Type Configuration"
        groupName={inheritanceStatus?.groupName}
        onConfirm={handleConfirm}
        onCancel={cancelBulkUpdate}
      />
    </div>
  );
};

export default withErrorBoundary(RoomTypeManagement, { level: 'component' });
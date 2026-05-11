import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Plus, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Checkbox } from '../../components/ui/checkbox';
import { useProperty } from '../../context/PropertyContext';
import { PropertyBreadcrumb } from '../../components/common/PropertyBreadcrumb';
import { api } from '../../services/api';
import { withErrorBoundary } from '../../components/ErrorBoundary';

interface RoomType {
  _id: string;
  name: string;
  code: string;
  baseRate?: number;
}

interface Channel {
  channelId: string;
  channelName: string;
  isActive: boolean;
  priority: number;
  commission: number;
  markup: number;
}

interface CreateAllotmentFormData {
  name: string;
  description: string;
  roomTypeId: string;
  defaultSettings: {
    totalInventory: number;
    defaultAllocationMethod: string;
    overbookingAllowed: boolean;
    overbookingLimit: number;
  };
  channels: Channel[];
}

const AdminRoomAllotmentCreate: React.FC = () => {
  const navigate = useNavigate();
  const { id: editId } = useParams<{ id?: string }>();
  const isEditMode = Boolean(editId);
  const { selectedPropertyId, selectedProperty, viewMode } = useProperty();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [existingAllotments, setExistingAllotments] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState<CreateAllotmentFormData>({
    name: '',
    description: '',
    roomTypeId: '',
    defaultSettings: {
      totalInventory: 10,
      defaultAllocationMethod: 'percentage',
      overbookingAllowed: false,
      overbookingLimit: 0,
    },
    channels: [
      { channelId: 'direct', channelName: 'Direct Booking', isActive: true, priority: 1, commission: 0, markup: 0 }
    ]
  });

  const channelOptions = [
    { id: 'direct', name: 'Direct Booking' },
    { id: 'booking_com', name: 'Booking.com' },
    { id: 'expedia', name: 'Expedia' },
    { id: 'airbnb', name: 'Airbnb' },
    { id: 'agoda', name: 'Agoda' },
    { id: 'hotels_com', name: 'Hotels.com' },
    { id: 'custom', name: 'Custom Channel' }
  ];

  useEffect(() => {
    loadRoomTypes();
    // Only load existing allotments if we can - it's not critical for form functionality
    loadExistingAllotments();
    if (isEditMode && editId) {
      loadAllotmentForEdit(editId);
    }
  }, [editId]);

  const loadAllotmentForEdit = async (id: string) => {
    try {
      setInitialLoading(true);
      const response = await api.get(`/allotments/${id}`);
      const allotment = response.data.data || response.data;
      setFormData({
        name: allotment.name || '',
        description: allotment.description || '',
        roomTypeId: allotment.roomTypeId?._id || allotment.roomTypeId || '',
        defaultSettings: {
          totalInventory: allotment.defaultSettings?.totalInventory || 10,
          defaultAllocationMethod: allotment.defaultSettings?.defaultAllocationMethod || 'percentage',
          overbookingAllowed: allotment.defaultSettings?.overbookingAllowed || false,
          overbookingLimit: allotment.defaultSettings?.overbookingLimit || 0,
        },
        channels: allotment.channels?.map((ch: Channel) => ({
          channelId: ch.channelId,
          channelName: ch.channelName,
          isActive: ch.isActive !== false,
          priority: ch.priority || 1,
          commission: ch.commission || 0,
          markup: ch.markup || 0,
        })) || [{ channelId: 'direct', channelName: 'Direct Booking', isActive: true, priority: 1, commission: 0, markup: 0 }]
      });
    } catch {
      toast.error('Failed to load allotment data');
      navigate('/admin/room-allotments');
    } finally {
      setInitialLoading(false);
    }
  };

  // Early return if no property selected in single mode
  if (!selectedPropertyId && viewMode === 'single') {
    return <div className="p-6">Please select a property</div>;
  }

  const loadRoomTypes = async () => {
    try {

      const response = await api.get(`/room-types/hotel/${selectedPropertyId}`);
      setRoomTypes(response.data.data || []);
    } catch (error) {
      
      setRoomTypes([]);
      toast.error('Failed to load room types. Please check your connection and try again.');
    }
  };

  const loadExistingAllotments = async () => {
    try {
      const response = await api.get('/allotments');
      const responseData = response.data;
      
      // Handle different response structures
      let allotments = [];
      if (responseData.data && Array.isArray(responseData.data)) {
        allotments = responseData.data;
      } else if (responseData.allotments && Array.isArray(responseData.allotments)) {
        allotments = responseData.allotments;
      } else if (Array.isArray(responseData)) {
        allotments = responseData;
      }
      
      const roomTypeIds = new Set<string>(
        allotments
          .filter((allotment: Record<string, unknown>) => allotment && allotment.roomTypeId)
          .map((allotment: Record<string, unknown>) => {
            const rtId = allotment.roomTypeId;
            return typeof rtId === 'object' && rtId !== null ? (rtId as Record<string, string>)._id : String(rtId);
          })
      );
      setExistingAllotments(roomTypeIds);
    } catch (error) {
      // Don't show error toast for this - it's not critical for form functionality
      // Set empty set so form still works
      setExistingAllotments(new Set());
    }
  };

  const handleInputChange = (field: keyof CreateAllotmentFormData, value: unknown) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleDefaultSettingsChange = (field: keyof CreateAllotmentFormData['defaultSettings'], value: unknown) => {
    setFormData(prev => ({
      ...prev,
      defaultSettings: {
        ...prev.defaultSettings,
        [field]: value
      }
    }));
  };

  const addChannel = () => {
    const availableChannels = channelOptions.filter(
      option => !formData.channels.some(channel => channel.channelId === option.id)
    );
    
    if (availableChannels.length === 0) {
      toast.error('All channels have been added');
      return;
    }

    const newChannel: Channel = {
      channelId: availableChannels[0].id,
      channelName: availableChannels[0].name,
      isActive: true,
      priority: formData.channels.length + 1,
      commission: 0,
      markup: 0
    };

    setFormData(prev => ({
      ...prev,
      channels: [...prev.channels, newChannel]
    }));
  };

  const removeChannel = (index: number) => {
    if (formData.channels.length === 1) {
      toast.error('At least one channel is required');
      return;
    }

    setFormData(prev => ({
      ...prev,
      channels: prev.channels.filter((_, i) => i !== index)
    }));
  };

  const updateChannel = (index: number, field: keyof Channel, value: unknown) => {
    setFormData(prev => ({
      ...prev,
      channels: prev.channels.map((channel, i) => 
        i === index ? { ...channel, [field]: value } : channel
      )
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Allotment name is required');
      return;
    }
    
    if (!formData.roomTypeId) {
      toast.error('Please select a room type');
      return;
    }

    if (formData.defaultSettings.totalInventory < 1) {
      toast.error('Total inventory must be at least 1');
      return;
    }

    if (formData.channels.length === 0) {
      toast.error('At least one distribution channel is required');
      return;
    }

    setLoading(true);

    try {
      const submitData = {
        ...formData,
        hotelId: selectedPropertyId,
        channels: formData.channels.map(ch => ({ ...ch, isActive: ch.isActive !== false }))
      };
      const response = isEditMode && editId
        ? await api.put(`/allotments/${editId}`, submitData)
        : await api.post('/allotments', submitData);

      if (response.data.success) {
        toast.success(isEditMode ? 'Room allotment updated successfully' : 'Room allotment created successfully');
        navigate('/admin/room-allotments');
      } else {
        toast.error(response.data.message || `Failed to ${isEditMode ? 'update' : 'create'} allotment`);
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string; error?: string } }; message?: string };
      const errorMessage = err.response?.data?.message || err.response?.data?.error || `Failed to ${isEditMode ? 'update' : 'create'} allotment`;
      
      // Handle specific error cases
      if (errorMessage.includes('already exists for this room type')) {
        toast.error('An active allotment already exists for this room type. Please choose a different room type or edit the existing allotment.');
      } else if (errorMessage.includes('Server error')) {
        toast.error('Server error occurred. Please check if the backend is running and try again.');
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Property Breadcrumb */}
      <PropertyBreadcrumb items={['Configuration', 'Room Allotments', isEditMode ? 'Edit' : 'Create']} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/admin/room-allotments')}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Allotments</span>
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Create Room Allotment</h1>
            <p className="text-gray-600">Set up inventory allocation for distribution channels</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Allotment Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Enter allotment name"
                required
                maxLength={200}
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Enter description (optional)"
                maxLength={1000}
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="roomType">Room Type *</Label>
              <Select value={formData.roomTypeId} onValueChange={(value) => handleInputChange('roomTypeId', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a room type" />
                </SelectTrigger>
                <SelectContent>
                  {roomTypes.map((roomType) => {
                    const hasExistingAllotment = existingAllotments.size > 0 && existingAllotments.has(roomType._id);
                    return (
                      <SelectItem 
                        key={roomType._id} 
                        value={roomType._id}
                        disabled={hasExistingAllotment}
                      >
                        {roomType.name} ({roomType.code})
                        {hasExistingAllotment && ' - Already configured'}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {existingAllotments.size === 0 && (
                <p className="text-sm text-gray-500 mt-1">
                  Note: If you get a "duplicate" error, that room type may already have an allotment configured.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Default Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Default Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="totalInventory">Total Inventory *</Label>
              <Input
                id="totalInventory"
                type="number"
                min="1"
                max="1000"
                value={formData.defaultSettings.totalInventory}
                onChange={(e) => handleDefaultSettingsChange('totalInventory', parseInt(e.target.value))}
                required
              />
            </div>

            <div>
              <Label htmlFor="allocationMethod">Default Allocation Method</Label>
              <Select 
                value={formData.defaultSettings.defaultAllocationMethod} 
                onValueChange={(value) => handleDefaultSettingsChange('defaultAllocationMethod', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select allocation method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage</SelectItem>
                  <SelectItem value="fixed">Fixed</SelectItem>
                  <SelectItem value="dynamic">Dynamic</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="overbookingAllowed"
                checked={formData.defaultSettings.overbookingAllowed}
                onCheckedChange={(checked) => handleDefaultSettingsChange('overbookingAllowed', checked)}
              />
              <Label htmlFor="overbookingAllowed">Allow Overbooking</Label>
            </div>

            {formData.defaultSettings.overbookingAllowed && (
              <div>
                <Label htmlFor="overbookingLimit">Overbooking Limit</Label>
                <Input
                  id="overbookingLimit"
                  type="number"
                  min="0"
                  max="50"
                  value={formData.defaultSettings.overbookingLimit}
                  onChange={(e) => handleDefaultSettingsChange('overbookingLimit', parseInt(e.target.value))}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Channels */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Distribution Channels</CardTitle>
            <Button type="button" onClick={addChannel} variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Channel
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {formData.channels.map((channel, index) => (
                <div key={channel.channelId} className="p-4 border rounded-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Channel {index + 1}</h4>
                    {formData.channels.length > 1 && (
                      <Button 
                        type="button"
                        onClick={() => removeChannel(index)}
                        variant="ghost"
                        size="sm"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Channel Type</Label>
                      <Select 
                        value={channel.channelId}
                        onValueChange={(value) => {
                          const selectedChannel = channelOptions.find(option => option.id === value);
                          updateChannel(index, 'channelId', value);
                          updateChannel(index, 'channelName', selectedChannel?.name || '');
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {channelOptions.map((option) => (
                            <SelectItem key={option.id} value={option.id}>
                              {option.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Priority</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={channel.priority}
                        onChange={(e) => updateChannel(index, 'priority', parseInt(e.target.value))}
                      />
                    </div>

                    <div>
                      <Label>Commission (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={channel.commission}
                        onChange={(e) => updateChannel(index, 'commission', parseFloat(e.target.value))}
                      />
                    </div>

                    <div>
                      <Label>Markup (%)</Label>
                      <Input
                        type="number"
                        min="-100"
                        max="1000"
                        step="0.01"
                        value={channel.markup}
                        onChange={(e) => updateChannel(index, 'markup', parseFloat(e.target.value))}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end space-x-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => navigate('/admin/room-allotments')}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            <Save className="w-4 h-4 mr-2" />
            {loading ? (isEditMode ? 'Updating...' : 'Creating...') : (isEditMode ? 'Update Allotment' : 'Create Allotment')}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default withErrorBoundary(AdminRoomAllotmentCreate);
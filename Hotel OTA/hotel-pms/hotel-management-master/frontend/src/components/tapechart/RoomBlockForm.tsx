import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency } from '@/utils/currencyUtils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Minus, 
  Building, 
  Users, 
  IndianRupee,
  Mail,
  Phone,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/utils/cn';
import roomBlockService, { CreateRoomBlockData, RoomBlock } from '@/services/roomBlockService';

interface RoomBlockFormProps {
  onSuccess: (roomBlock: RoomBlock) => void;
  onCancel: () => void;
  roomBlock?: RoomBlock; // For editing
}

interface AvailableRoom {
  _id: string;
  roomNumber: string;
  type: string;
  floor?: number;
  currentRate: number;
}

const RoomBlockForm: React.FC<RoomBlockFormProps> = ({
  onSuccess,
  onCancel,
  roomBlock
}) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState<CreateRoomBlockData>({
    blockName: '',
    groupName: '',
    hotelId: '', // Will be set from context/user
    eventType: 'conference',
    startDate: '',
    endDate: '',
    roomIds: [],
    contactPerson: {
      name: '',
      email: '',
      phone: '',
      title: ''
    },
    billingInstructions: 'master_account',
    specialInstructions: '',
    amenities: [],
    cateringRequirements: '',
    paymentTerms: {
      depositPercentage: 50,
      cancellationPolicy: 'standard'
    }
  });

  const [availableRooms, setAvailableRooms] = useState<AvailableRoom[]>([]);
  const [selectedRooms, setSelectedRooms] = useState<AvailableRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();

  // Set hotelId from user context (handle both string and populated object forms)
  useEffect(() => {
    if (user?.hotelId) {
      const hotelIdStr = typeof user.hotelId === 'string'
        ? user.hotelId
        : (user.hotelId as { _id?: string })?._id || undefined;
      if (hotelIdStr) {
        setFormData(prev => ({ ...prev, hotelId: hotelIdStr }));
      }
    }
  }, [user]);

  // Pre-fill form if editing
  useEffect(() => {
    if (roomBlock) {
      setFormData({
        blockName: roomBlock.blockName,
        groupName: roomBlock.groupName,
        hotelId: roomBlock.hotelId._id,
        eventType: roomBlock.eventType,
        startDate: roomBlock.startDate,
        endDate: roomBlock.endDate,
        roomIds: roomBlock.rooms.map(r => r.roomId._id),
        blockRate: roomBlock.blockRate,
        contactPerson: roomBlock.contactPerson,
        billingInstructions: roomBlock.billingInstructions,
        specialInstructions: roomBlock.specialInstructions,
        amenities: roomBlock.amenities,
        cateringRequirements: roomBlock.cateringRequirements,
        paymentTerms: roomBlock.paymentTerms
      });
      setStartDate(new Date(roomBlock.startDate));
      setEndDate(new Date(roomBlock.endDate));
    }
  }, [roomBlock]);

  // Fetch available rooms when dates change
  useEffect(() => {
    if (startDate && endDate && formData.hotelId && startDate < endDate) {
      fetchAvailableRooms();
    }
  }, [startDate, endDate, formData.hotelId]);

  const fetchAvailableRooms = async () => {
    if (!startDate || !endDate || !formData.hotelId || startDate >= endDate) return;

    try {
      setLoadingRooms(true);
      const rooms = await roomBlockService.getAvailableRooms(
        formData.hotelId,
        startDate.toISOString(),
        endDate.toISOString()
      );
      setAvailableRooms(rooms);
    } catch (error) {
      setAvailableRooms([]);
    } finally {
      setLoadingRooms(false);
    }
  };

  const handleInputChange = (field: string, value: unknown) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when field is updated
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleContactPersonChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      contactPerson: {
        ...prev.contactPerson,
        [field]: value
      }
    }));
  };

  const handlePaymentTermsChange = (field: string, value: unknown) => {
    setFormData(prev => ({
      ...prev,
      paymentTerms: {
        ...prev.paymentTerms,
        [field]: value
      }
    }));
  };

  const handleRoomSelection = (room: AvailableRoom, selected: boolean) => {
    if (selected) {
      setSelectedRooms(prev => [...prev, room]);
      setFormData(prev => ({
        ...prev,
        roomIds: [...prev.roomIds, room._id]
      }));
    } else {
      setSelectedRooms(prev => prev.filter(r => r._id !== room._id));
      setFormData(prev => ({
        ...prev,
        roomIds: prev.roomIds.filter(id => id !== room._id)
      }));
    }
  };

  const handleAmenityToggle = (amenity: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      amenities: checked
        ? [...(prev.amenities || []), amenity]
        : (prev.amenities || []).filter(a => a !== amenity)
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.blockName.trim()) {
      newErrors.blockName = 'Block name is required';
    }

    if (!formData.groupName.trim()) {
      newErrors.groupName = 'Group name is required';
    }

    if (!startDate) {
      newErrors.startDate = 'Start date is required';
    }

    if (!endDate) {
      newErrors.endDate = 'End date is required';
    }

    if (startDate && endDate && startDate >= endDate) {
      newErrors.endDate = 'End date must be after start date';
    }

    if (formData.roomIds.length === 0) {
      newErrors.rooms = 'At least one room must be selected';
    }

    if (!formData.billingInstructions) {
      newErrors.billingInstructions = 'Billing instructions are required';
    }

    if (formData.contactPerson.email && !/\S+@\S+\.\S+/.test(formData.contactPerson.email)) {
      newErrors.contactEmail = 'Invalid email format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      
      // Generate unique blockId
      const blockId = `block_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      const submitData: CreateRoomBlockData = {
        ...formData,
        blockId,
        startDate: startDate!.toISOString(),
        endDate: endDate!.toISOString(),
        totalRooms: formData.roomIds.length
      };

      const newRoomBlock = await roomBlockService.createRoomBlock(submitData);
      onSuccess(newRoomBlock);
      
    } catch (error: unknown) {
      setErrors({ submit: error instanceof Error ? error.message : 'Failed to create room block' });
    } finally {
      setLoading(false);
    }
  };

  const commonAmenities = [
    'WiFi', 'Breakfast', 'Parking', 'Meeting Room', 'Audio/Visual Equipment',
    'Welcome Reception', 'Airport Shuttle', 'Concierge Service'
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>Enter the basic details for the room block</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="blockName">Block Name *</Label>
              <Input
                id="blockName"
                value={formData.blockName}
                onChange={(e) => handleInputChange('blockName', e.target.value)}
                placeholder="Enter block name"
                className={cn(errors.blockName && 'border-red-500')}
              />
              {errors.blockName && <p className="text-sm text-red-500 mt-1">{errors.blockName}</p>}
            </div>

            <div>
              <Label htmlFor="groupName">Group Name *</Label>
              <Input
                id="groupName"
                value={formData.groupName}
                onChange={(e) => handleInputChange('groupName', e.target.value)}
                placeholder="Enter group name"
                className={cn(errors.groupName && 'border-red-500')}
              />
              {errors.groupName && <p className="text-sm text-red-500 mt-1">{errors.groupName}</p>}
            </div>
          </div>

          <div>
            <Label htmlFor="eventType">Event Type</Label>
            <Select value={formData.eventType} onValueChange={(value: Record<string, unknown>) => handleInputChange('eventType', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select event type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="conference">Conference</SelectItem>
                <SelectItem value="wedding">Wedding</SelectItem>
                <SelectItem value="corporate_event">Corporate Event</SelectItem>
                <SelectItem value="group_booking">Group Booking</SelectItem>
                <SelectItem value="convention">Convention</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Start Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground",
                      errors.startDate && "border-red-500"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : "Select start date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {errors.startDate && <p className="text-sm text-red-500 mt-1">{errors.startDate}</p>}
            </div>

            <div>
              <Label>End Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground",
                      errors.endDate && "border-red-500"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : "Select end date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              {errors.endDate && <p className="text-sm text-red-500 mt-1">{errors.endDate}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Room Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Room Selection</CardTitle>
          <CardDescription>Select rooms for the block</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingRooms ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2">Loading available rooms...</span>
            </div>
          ) : availableRooms.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Building className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No available rooms found for selected dates</p>
              <p className="text-sm">Please select dates to view available rooms</p>
            </div>
          ) : (
            <div>
              <div className="mb-4 flex items-center gap-2">
                <Building className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {availableRooms.length} rooms available | {selectedRooms.length} selected
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
                {availableRooms.map((room) => (
                  <div
                    key={room._id}
                    className={cn(
                      "border rounded-lg p-3 transition-colors",
                      formData.roomIds.includes(room._id)
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={formData.roomIds.includes(room._id)}
                        onCheckedChange={(checked) => handleRoomSelection(room, checked as boolean)}
                      />
                      <div className="flex-1">
                        <div className="font-medium">{room.roomNumber}</div>
                        <div className="text-sm text-gray-500">{room.type}</div>
                        <div className="text-sm text-gray-500">{formatCurrency(room.currentRate)}/night</div>
                        {room.floor && <div className="text-xs text-gray-400">Floor {room.floor}</div>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {errors.rooms && <p className="text-sm text-red-500 mt-2">{errors.rooms}</p>}
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
          <CardDescription>Primary contact for this room block</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="contactName">Contact Name</Label>
              <Input
                id="contactName"
                value={formData.contactPerson.name}
                onChange={(e) => handleContactPersonChange('name', e.target.value)}
                placeholder="Enter contact name"
              />
            </div>

            <div>
              <Label htmlFor="contactTitle">Title/Position</Label>
              <Input
                id="contactTitle"
                value={formData.contactPerson.title}
                onChange={(e) => handleContactPersonChange('title', e.target.value)}
                placeholder="Enter title or position"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="contactEmail">Email</Label>
              <Input
                id="contactEmail"
                type="email"
                value={formData.contactPerson.email}
                onChange={(e) => handleContactPersonChange('email', e.target.value)}
                placeholder="Enter email address"
                className={cn(errors.contactEmail && 'border-red-500')}
              />
              {errors.contactEmail && <p className="text-sm text-red-500 mt-1">{errors.contactEmail}</p>}
            </div>

            <div>
              <Label htmlFor="contactPhone">Phone</Label>
              <Input
                id="contactPhone"
                value={formData.contactPerson.phone}
                onChange={(e) => handleContactPersonChange('phone', e.target.value)}
                placeholder="Enter phone number"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Billing & Terms */}
      <Card>
        <CardHeader>
          <CardTitle>Billing & Terms</CardTitle>
          <CardDescription>Payment and billing information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="billingInstructions">Billing Instructions *</Label>
            <Select value={formData.billingInstructions} onValueChange={(value: Record<string, unknown>) => handleInputChange('billingInstructions', value)}>
              <SelectTrigger className={cn(errors.billingInstructions && 'border-red-500')}>
                <SelectValue placeholder="Select billing type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="master_account">Master Account</SelectItem>
                <SelectItem value="individual_folios">Individual Folios</SelectItem>
                <SelectItem value="split_billing">Split Billing</SelectItem>
              </SelectContent>
            </Select>
            {errors.billingInstructions && <p className="text-sm text-red-500 mt-1">{errors.billingInstructions}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="blockRate">Block Rate (₹)</Label>
              <Input
                id="blockRate"
                type="number"
                min="0"
                value={formData.blockRate || ''}
                onChange={(e) => handleInputChange('blockRate', parseFloat(e.target.value) || undefined)}
                placeholder="Enter block rate per room per night"
              />
            </div>

            <div>
              <Label htmlFor="depositPercentage">Deposit Percentage (%)</Label>
              <Input
                id="depositPercentage"
                type="number"
                min="0"
                max="100"
                value={formData.paymentTerms?.depositPercentage || 50}
                onChange={(e) => handlePaymentTermsChange('depositPercentage', parseInt(e.target.value))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Additional Details */}
      <Card>
        <CardHeader>
          <CardTitle>Additional Details</CardTitle>
          <CardDescription>Special requests and amenities</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Amenities</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
              {commonAmenities.map((amenity) => (
                <div key={amenity} className="flex items-center space-x-2">
                  <Checkbox
                    id={amenity}
                    checked={formData.amenities?.includes(amenity) || false}
                    onCheckedChange={(checked) => handleAmenityToggle(amenity, checked as boolean)}
                  />
                  <Label htmlFor={amenity} className="text-sm">{amenity}</Label>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="specialInstructions">Special Instructions</Label>
            <Textarea
              id="specialInstructions"
              value={formData.specialInstructions}
              onChange={(e) => handleInputChange('specialInstructions', e.target.value)}
              placeholder="Any special instructions or requirements"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="cateringRequirements">Catering Requirements</Label>
            <Textarea
              id="cateringRequirements"
              value={formData.cateringRequirements}
              onChange={(e) => handleInputChange('cateringRequirements', e.target.value)}
              placeholder="Describe catering needs if any"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Submit Buttons */}
      <div className="flex items-center justify-end space-x-4 pt-4 border-t">
        {errors.submit && (
          <div className="flex items-center text-red-600 text-sm mr-auto">
            <AlertCircle className="w-4 h-4 mr-2" />
            {errors.submit}
          </div>
        )}
        
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </Button>
        
        <Button
          type="submit"
          disabled={loading}
          className="min-w-[120px]"
        >
          {loading ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Creating...
            </div>
          ) : (
            roomBlock ? 'Update Block' : 'Create Block'
          )}
        </Button>
      </div>
    </form>
  );
};

export default RoomBlockForm;
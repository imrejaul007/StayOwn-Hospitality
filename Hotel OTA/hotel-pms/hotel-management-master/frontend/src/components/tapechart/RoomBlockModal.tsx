import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/utils/toast';
import {
  CalendarIcon,
  Users,
  Building2,
  Phone,
  Mail,
  MapPin,
  Clock,
  IndianRupee,
  Plus,
  X,
  AlertCircle
} from 'lucide-react';
import { format, addDays } from 'date-fns';

interface RoomBlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (blockData: Record<string, unknown>) => void;
  blockData?: unknown;
  availableRooms?: unknown[];
}

interface ContactPerson {
  name: string;
  email: string;
  phone: string;
  title: string;
}

interface RoomAssignment {
  roomId: string;
  roomNumber: string;
  roomType: string;
  rate: number;
  status: 'blocked' | 'reserved' | 'occupied' | 'released';
  guestName?: string;
  specialRequests?: string;
}

const RoomBlockModal: React.FC<RoomBlockModalProps> = ({
  isOpen,
  onClose,
  onSave,
  blockData,
  availableRooms = []
}) => {
  const [formData, setFormData] = useState({
    blockName: '',
    groupName: '',
    eventType: 'conference',
    startDate: new Date(),
    endDate: addDays(new Date(), 3),
    totalRooms: 1,
    blockRate: 15000,
    currency: 'INR',
    billingInstructions: 'master_account',
    specialInstructions: '',
    cateringRequirements: '',
    amenities: [] as string[]
  });

  const [contactPerson, setContactPerson] = useState<ContactPerson>({
    name: '',
    email: '',
    phone: '',
    title: ''
  });

  const [roomAssignments, setRoomAssignments] = useState<RoomAssignment[]>([]);
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set());
  const [showCalendar, setShowCalendar] = useState<'start' | 'end' | null>(null);
  const [newAmenity, setNewAmenity] = useState('');

  const eventTypes = [
    { value: 'conference', label: 'Conference' },
    { value: 'wedding', label: 'Wedding' },
    { value: 'corporate_event', label: 'Corporate Event' },
    { value: 'tour_group', label: 'Tour Group' },
    { value: 'other', label: 'Other' }
  ];

  const billingOptions = [
    { value: 'master_account', label: 'Master Account' },
    { value: 'individual_folios', label: 'Individual Folios' },
    { value: 'split_billing', label: 'Split Billing' }
  ];

  const commonAmenities = [
    'WiFi', 'Breakfast', 'Parking', 'Airport Shuttle',
    'Welcome Drinks', 'Late Checkout', 'Early Checkin',
    'Spa Access', 'Gym Access', 'Pool Access'
  ];

  useEffect(() => {
    if (blockData) {
      setFormData({
        blockName: blockData.blockName || '',
        groupName: blockData.groupName || '',
        eventType: blockData.eventType || 'conference',
        startDate: blockData.startDate ? new Date(blockData.startDate) : new Date(),
        endDate: blockData.endDate ? new Date(blockData.endDate) : addDays(new Date(), 3),
        totalRooms: blockData.totalRooms || 1,
        blockRate: blockData.blockRate || 15000,
        currency: blockData.currency || 'INR',
        billingInstructions: blockData.billingInstructions || 'master_account',
        specialInstructions: blockData.specialInstructions || '',
        cateringRequirements: blockData.cateringRequirements || '',
        amenities: blockData.amenities || []
      });

      if (blockData.contactPerson) {
        setContactPerson(blockData.contactPerson);
      }

      if (blockData.rooms) {
        setRoomAssignments(blockData.rooms);
        setSelectedRooms(new Set(blockData.rooms.map((room: Record<string, unknown>) => room.roomId)));
      }
    }
  }, [blockData]);

  const handleInputChange = (field: string, value: unknown) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleContactChange = (field: keyof ContactPerson, value: string) => {
    setContactPerson(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleRoomSelection = (roomId: string) => {
    const newSelectedRooms = new Set(selectedRooms);

    if (newSelectedRooms.has(roomId)) {
      newSelectedRooms.delete(roomId);
      setRoomAssignments(prev => prev.filter(room => room.roomId !== roomId));
    } else {
      if (newSelectedRooms.size >= formData.totalRooms) {
        toast.error(`Cannot select more than ${formData.totalRooms} rooms`);
        return;
      }

      newSelectedRooms.add(roomId);
      const room = availableRooms.find(r => r._id === roomId);
      if (room) {
        setRoomAssignments(prev => [...prev, {
          roomId: room._id,
          roomNumber: room.roomNumber,
          roomType: room.roomType,
          rate: formData.blockRate,
          status: 'blocked'
        }]);
      }
    }

    setSelectedRooms(newSelectedRooms);
  };

  const handleRoomAssignmentChange = (roomId: string, field: keyof RoomAssignment, value: unknown) => {
    setRoomAssignments(prev =>
      prev.map(room =>
        room.roomId === roomId
          ? { ...room, [field]: value }
          : room
      )
    );
  };

  const addAmenity = (amenity: string) => {
    if (!formData.amenities.includes(amenity)) {
      handleInputChange('amenities', [...formData.amenities, amenity]);
    }
    setNewAmenity('');
  };

  const removeAmenity = (amenity: string) => {
    handleInputChange('amenities', formData.amenities.filter(a => a !== amenity));
  };

  const validateForm = () => {
    if (!formData.blockName.trim()) {
      toast.error('Block name is required');
      return false;
    }

    if (!formData.groupName.trim()) {
      toast.error('Group name is required');
      return false;
    }

    if (!contactPerson.name.trim()) {
      toast.error('Contact person name is required');
      return false;
    }

    if (!contactPerson.email.trim()) {
      toast.error('Contact person email is required');
      return false;
    }

    if (roomAssignments.length === 0) {
      toast.error('At least one room must be assigned to the block');
      return false;
    }

    if (formData.startDate >= formData.endDate) {
      toast.error('End date must be after start date');
      return false;
    }

    return true;
  };

  const handleSave = () => {
    if (!validateForm()) return;

    const blockData = {
      ...formData,
      contactPerson,
      rooms: roomAssignments,
      roomsBooked: roomAssignments.filter(r => r.status === 'reserved').length,
      roomsReleased: roomAssignments.filter(r => r.status === 'released').length,
      status: 'active',
      cutOffDate: new Date(formData.startDate.getTime() - 7 * 24 * 60 * 60 * 1000),
      autoReleaseDate: new Date(formData.startDate.getTime() - 3 * 24 * 60 * 60 * 1000)
    };

    onSave(blockData);
  };

  const handleClose = () => {
    setFormData({
      blockName: '',
      groupName: '',
      eventType: 'conference',
      startDate: new Date(),
      endDate: addDays(new Date(), 3),
      totalRooms: 1,
      blockRate: 15000,
      currency: 'INR',
      billingInstructions: 'master_account',
      specialInstructions: '',
      cateringRequirements: '',
      amenities: []
    });
    setContactPerson({ name: '', email: '', phone: '', title: '' });
    setRoomAssignments([]);
    setSelectedRooms(new Set());
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {blockData ? 'Edit Room Block' : 'Create Room Block'}
          </DialogTitle>
          <DialogDescription>
            Create or modify a room block for group reservations, events, or special arrangements.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="blockName">Block Name *</Label>
              <Input
                id="blockName"
                value={formData.blockName}
                onChange={(e) => handleInputChange('blockName', e.target.value)}
                placeholder="e.g., Tech Conference 2025"
              />
            </div>

            <div>
              <Label htmlFor="groupName">Group Name *</Label>
              <Input
                id="groupName"
                value={formData.groupName}
                onChange={(e) => handleInputChange('groupName', e.target.value)}
                placeholder="e.g., TechCorp India Pvt Ltd"
              />
            </div>

            <div>
              <Label htmlFor="eventType">Event Type</Label>
              <Select value={formData.eventType} onValueChange={(value) => handleInputChange('eventType', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {eventTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Start Date *</Label>
                <Popover open={showCalendar === 'start'} onOpenChange={(open) => setShowCalendar(open ? 'start' : null)}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(formData.startDate, 'MMM dd, yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.startDate}
                      onSelect={(date) => {
                        if (date) {
                          handleInputChange('startDate', date);
                          setShowCalendar(null);
                        }
                      }}
                      disabled={(date) => date < new Date()}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label>End Date *</Label>
                <Popover open={showCalendar === 'end'} onOpenChange={(open) => setShowCalendar(open ? 'end' : null)}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(formData.endDate, 'MMM dd, yyyy')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.endDate}
                      onSelect={(date) => {
                        if (date) {
                          handleInputChange('endDate', date);
                          setShowCalendar(null);
                        }
                      }}
                      disabled={(date) => date <= formData.startDate}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="totalRooms">Total Rooms *</Label>
                <Input
                  id="totalRooms"
                  type="number"
                  min="1"
                  max="50"
                  value={formData.totalRooms}
                  onChange={(e) => handleInputChange('totalRooms', parseInt(e.target.value) || 1)}
                />
              </div>

              <div>
                <Label htmlFor="blockRate">Block Rate (₹) *</Label>
                <Input
                  id="blockRate"
                  type="number"
                  min="0"
                  step="100"
                  value={formData.blockRate}
                  onChange={(e) => handleInputChange('blockRate', parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Contact Person
            </h3>

            <div>
              <Label htmlFor="contactName">Name *</Label>
              <Input
                id="contactName"
                value={contactPerson.name}
                onChange={(e) => handleContactChange('name', e.target.value)}
                placeholder="Contact person name"
              />
            </div>

            <div>
              <Label htmlFor="contactEmail">Email *</Label>
              <Input
                id="contactEmail"
                type="email"
                value={contactPerson.email}
                onChange={(e) => handleContactChange('email', e.target.value)}
                placeholder="contact@company.com"
              />
            </div>

            <div>
              <Label htmlFor="contactPhone">Phone</Label>
              <Input
                id="contactPhone"
                value={contactPerson.phone}
                onChange={(e) => handleContactChange('phone', e.target.value)}
                placeholder="+91-9876543210"
              />
            </div>

            <div>
              <Label htmlFor="contactTitle">Title</Label>
              <Input
                id="contactTitle"
                value={contactPerson.title}
                onChange={(e) => handleContactChange('title', e.target.value)}
                placeholder="Event Manager"
              />
            </div>

            <div>
              <Label htmlFor="billingInstructions">Billing Instructions</Label>
              <Select value={formData.billingInstructions} onValueChange={(value) => handleInputChange('billingInstructions', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {billingOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Amenities */}
        <div className="space-y-3">
          <Label>Included Amenities</Label>
          <div className="flex flex-wrap gap-2 mb-2">
            {formData.amenities.map(amenity => (
              <Badge key={amenity} variant="secondary" className="flex items-center gap-1">
                {amenity}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => removeAmenity(amenity)}
                />
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={newAmenity}
              onChange={(e) => setNewAmenity(e.target.value)}
              placeholder="Add custom amenity"
              onKeyPress={(e) => {
                if (e.key === 'Enter' && newAmenity.trim()) {
                  addAmenity(newAmenity.trim());
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => newAmenity.trim() && addAmenity(newAmenity.trim())}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {commonAmenities.filter(amenity => !formData.amenities.includes(amenity)).map(amenity => (
              <Button
                key={amenity}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addAmenity(amenity)}
              >
                {amenity}
              </Button>
            ))}
          </div>
        </div>

        {/* Room Selection */}
        <div className="space-y-3">
          <Label>Room Assignments ({selectedRooms.size}/{formData.totalRooms})</Label>
          {availableRooms.length > 0 ? (
            <div className="max-h-48 overflow-y-auto border rounded-lg p-3">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {availableRooms.slice(0, 20).map(room => (
                  <div role="button" tabIndex={0}
                    key={room._id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedRooms.has(room._id)
                        ? 'bg-blue-50 border-blue-300'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                    onClick={() => handleRoomSelection(room._id)}
                   onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const clickHandler = () => handleRoomSelection(room._id); if (typeof clickHandler === 'function') { clickHandler(e as any); } } }}>
                    <div className="font-medium">{room.roomNumber}</div>
                    <div className="text-sm text-gray-600">{room.roomType}</div>
                    <div className="text-sm text-gray-500">Floor {room.floor}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500">
              <AlertCircle className="h-8 w-8 mx-auto mb-2" />
              No available rooms found
            </div>
          )}
        </div>

        {/* Special Instructions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="specialInstructions">Special Instructions</Label>
            <Textarea
              id="specialInstructions"
              value={formData.specialInstructions}
              onChange={(e) => handleInputChange('specialInstructions', e.target.value)}
              placeholder="Any special requests or instructions..."
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="cateringRequirements">Catering Requirements</Label>
            <Textarea
              id="cateringRequirements"
              value={formData.cateringRequirements}
              onChange={(e) => handleInputChange('cateringRequirements', e.target.value)}
              placeholder="Breakfast, lunch, dietary restrictions..."
              rows={3}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
            {blockData ? 'Update Block' : 'Create Block'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RoomBlockModal;
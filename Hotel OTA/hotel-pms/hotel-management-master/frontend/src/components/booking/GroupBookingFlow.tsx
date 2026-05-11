import React, { useState, useEffect, useRef} from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/utils/toast';
import { api } from '@/services/api';
import {
  Users,
  Calendar as CalendarIcon,
  Plus,
  Minus,
  ChevronRight,
  ChevronLeft,
  Building,
  Bed,
  IndianRupee,
  User,
  Phone,
  Mail,
  FileText,
  Star,
  Crown,
  Coffee,
  CreditCard,
  CheckCircle,
  AlertCircle,
  Clock,
  MapPin
} from 'lucide-react';
import { format, addDays } from 'date-fns';
import { formatCurrency } from '@/utils/currencyUtils';

interface RoomRequirement {
  id: string;
  roomType: string;
  quantity: number;
  occupants: number;
  preferences: string[];
  specialRequests: string;
  assignedRooms: string[];
}

interface GroupBookingData {
  groupName: string;
  organizationName: string;
  contactPerson: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    title: string;
  };
  checkInDate: Date | null;
  checkOutDate: Date | null;
  roomRequirements: RoomRequirement[];
  guestList: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    roomAssignment?: string;
    vipStatus: string;
    specialRequests: string;
  }>;
  blockName: string;
  paymentMethod: 'master_bill' | 'individual' | 'split';
  corporateAccount: string;
  totalRooms: number;
  estimatedRevenue: number;
  discountPercent: number;
  specialInstructions: string;
  amenitiesIncluded: string[];
  cutoffDate: Date | null;
  releasePolicy: string;
}

interface AvailableRoom {
  id: string;
  roomNumber: string;
  roomType: string;
  floor: number;
  rate: number;
  isAvailable: boolean;
  amenities: string[];
}

interface GroupBookingFlowProps {
  onComplete?: (bookingData: GroupBookingData) => void;
  onCancel?: () => void;
  existingData?: Partial<GroupBookingData>;
}

const GroupBookingFlow: React.FC<GroupBookingFlowProps> = ({ 
  onComplete, 
  onCancel, 
  existingData 
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [bookingData, setBookingData] = useState<GroupBookingData>({
    groupName: '',
    organizationName: '',
    contactPerson: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      title: ''
    },
    checkInDate: null,
    checkOutDate: null,
    roomRequirements: [
      {
        id: '1',
        roomType: 'standard',
        quantity: 1,
        occupants: 2,
        preferences: [],
        specialRequests: '',
        assignedRooms: []
      }
    ],
    guestList: [],
    blockName: '',
    paymentMethod: 'master_bill',
    corporateAccount: '',
    totalRooms: 1,
    estimatedRevenue: 0,
    discountPercent: 0,
    specialInstructions: '',
    amenitiesIncluded: [],
    cutoffDate: null,
    releasePolicy: 'non_refundable',
    ...existingData
  });

  const [availableRooms, setAvailableRooms] = useState<AvailableRoom[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const steps = [
    { id: 1, title: 'Group Details', icon: Building },
    { id: 2, title: 'Room Requirements', icon: Bed },
    { id: 3, title: 'Guest Information', icon: Users },
    { id: 4, title: 'Room Assignment', icon: MapPin },
    { id: 5, title: 'Payment & Policies', icon: CreditCard },
    { id: 6, title: 'Review & Confirm', icon: CheckCircle }
  ];

  const roomTypes = [
    { value: 'standard', label: 'Standard Room', baseRate: 150 },
    { value: 'deluxe', label: 'Deluxe Room', baseRate: 200 },
    { value: 'suite', label: 'Suite', baseRate: 350 },
    { value: 'executive', label: 'Executive Suite', baseRate: 500 }
  ];

  const amenityOptions = [
    'WiFi', 'Breakfast', 'Parking', 'Gym Access', 'Pool Access', 
    'Spa Discount', 'Late Checkout', 'Welcome Amenity'
  ];

  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (bookingData.checkInDate && bookingData.checkOutDate) {
      fetchAvailableRooms();
    }
  }, [bookingData.checkInDate, bookingData.checkOutDate]);

  useEffect(() => {
    calculateEstimatedRevenue();
  }, [bookingData.roomRequirements, bookingData.checkInDate, bookingData.checkOutDate, bookingData.discountPercent]);

  const fetchAvailableRooms = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/rooms', {
        params: {
          checkIn: bookingData.checkInDate?.toISOString(),
          checkOut: bookingData.checkOutDate?.toISOString(),
          available: true,
          limit: 50
        }
      });
      const data = response.data?.data;
      if (Array.isArray(data)) {
        const rooms: AvailableRoom[] = data.map((room: Record<string, unknown>) => ({
          id: String(room._id || room.id || ''),
          roomNumber: String(room.roomNumber || ''),
          roomType: String(room.roomType || room.type || 'standard'),
          floor: Number(room.floor || 1),
          rate: Number(room.rate || room.baseRate || 0),
          isAvailable: room.isAvailable !== false,
          amenities: Array.isArray(room.amenities) ? room.amenities.map(String) : []
        }));
        setAvailableRooms(rooms);
      } else {
        setAvailableRooms([]);
      }
    } catch {
      toast.error('Failed to fetch available rooms');
      setAvailableRooms([]);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateEstimatedRevenue = () => {
    if (!bookingData.checkInDate || !bookingData.checkOutDate) return;
    
    const nights = Math.ceil((bookingData.checkOutDate.getTime() - bookingData.checkInDate.getTime()) / (1000 * 60 * 60 * 24));
    let totalRevenue = 0;

    bookingData.roomRequirements.forEach(req => {
      const roomType = roomTypes.find(type => type.value === req.roomType);
      if (roomType) {
        totalRevenue += roomType.baseRate * req.quantity * nights;
      }
    });

    const discountAmount = (totalRevenue * bookingData.discountPercent) / 100;
    const finalRevenue = totalRevenue - discountAmount;

    setBookingData(prev => ({ 
      ...prev, 
      estimatedRevenue: finalRevenue,
      totalRooms: prev.roomRequirements.reduce((sum, req) => sum + req.quantity, 0)
    }));
  };

  const addRoomRequirement = () => {
    const newRequirement: RoomRequirement = {
      id: Date.now().toString(),
      roomType: 'standard',
      quantity: 1,
      occupants: 2,
      preferences: [],
      specialRequests: '',
      assignedRooms: []
    };
    
    setBookingData(prev => ({
      ...prev,
      roomRequirements: [...prev.roomRequirements, newRequirement]
    }));
  };

  const updateRoomRequirement = (id: string, updates: Partial<RoomRequirement>) => {
    setBookingData(prev => ({
      ...prev,
      roomRequirements: prev.roomRequirements.map(req =>
        req.id === id ? { ...req, ...updates } : req
      )
    }));
  };

  const removeRoomRequirement = (id: string) => {
    if (bookingData.roomRequirements.length === 1) return;
    
    setBookingData(prev => ({
      ...prev,
      roomRequirements: prev.roomRequirements.filter(req => req.id !== id)
    }));
  };

  const addGuest = () => {
    const newGuest = {
      id: Date.now().toString(),
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      vipStatus: 'none',
      specialRequests: ''
    };
    
    setBookingData(prev => ({
      ...prev,
      guestList: [...prev.guestList, newGuest]
    }));
  };

  const updateGuest = (id: string, updates: Record<string, unknown>) => {
    setBookingData(prev => ({
      ...prev,
      guestList: prev.guestList.map(guest =>
        guest.id === id ? { ...guest, ...updates } : guest
      )
    }));
  };

  const removeGuest = (id: string) => {
    setBookingData(prev => ({
      ...prev,
      guestList: prev.guestList.filter(guest => guest.id !== id)
    }));
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      // Validate booking data
      if (!bookingData.groupName || !bookingData.checkInDate || !bookingData.checkOutDate) {
        toast.error('Please fill in all required fields');
        return;
      }

      // Mock submission - replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 2000));
    if (!isMountedRef.current) return;
      
      toast.success('Group booking created successfully');
      onComplete?.(bookingData);
    } catch (error) {
      toast.error('Failed to create group booking');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-between mb-8">
      {steps.map((step, index) => {
        const Icon = step.icon;
        const isActive = step.id === currentStep;
        const isCompleted = step.id < currentStep;
        
        return (
          <div key={step.id} className="flex items-center">
            <div className={`
              flex items-center justify-center w-10 h-10 rounded-full border-2 
              ${isActive ? 'bg-blue-500 border-blue-500 text-white' : 
                isCompleted ? 'bg-green-500 border-green-500 text-white' : 
                'bg-white border-gray-300 text-gray-400'}
            `}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="ml-3 hidden sm:block">
              <p className={`text-sm font-medium ${isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-400'}`}>
                {step.title}
              </p>
            </div>
            {index < steps.length - 1 && (
              <ChevronRight className="w-5 h-5 text-gray-300 mx-4" />
            )}
          </div>
        );
      })}
    </div>
  );

  const renderStep1 = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building className="w-5 h-5" />
          Group Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="groupName">Group Name *</Label>
            <Input
              id="groupName"
              value={bookingData.groupName}
              onChange={(e) => setBookingData(prev => ({ ...prev, groupName: e.target.value }))}
              placeholder="Corporate Retreat 2024"
            />
          </div>
          <div>
            <Label htmlFor="organizationName">Organization Name</Label>
            <Input
              id="organizationName"
              value={bookingData.organizationName}
              onChange={(e) => setBookingData(prev => ({ ...prev, organizationName: e.target.value }))}
              placeholder="Acme Corporation"
            />
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <h4 className="font-medium">Contact Person</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="contactFirstName">First Name *</Label>
              <Input
                id="contactFirstName"
                value={bookingData.contactPerson.firstName}
                onChange={(e) => setBookingData(prev => ({ 
                  ...prev, 
                  contactPerson: { ...prev.contactPerson, firstName: e.target.value }
                }))}
              />
            </div>
            <div>
              <Label htmlFor="contactLastName">Last Name *</Label>
              <Input
                id="contactLastName"
                value={bookingData.contactPerson.lastName}
                onChange={(e) => setBookingData(prev => ({ 
                  ...prev, 
                  contactPerson: { ...prev.contactPerson, lastName: e.target.value }
                }))}
              />
            </div>
            <div>
              <Label htmlFor="contactEmail">Email *</Label>
              <Input
                id="contactEmail"
                type="email"
                value={bookingData.contactPerson.email}
                onChange={(e) => setBookingData(prev => ({ 
                  ...prev, 
                  contactPerson: { ...prev.contactPerson, email: e.target.value }
                }))}
              />
            </div>
            <div>
              <Label htmlFor="contactPhone">Phone *</Label>
              <Input
                id="contactPhone"
                value={bookingData.contactPerson.phone}
                onChange={(e) => setBookingData(prev => ({ 
                  ...prev, 
                  contactPerson: { ...prev.contactPerson, phone: e.target.value }
                }))}
              />
            </div>
            <div>
              <Label htmlFor="contactTitle">Title</Label>
              <Input
                id="contactTitle"
                value={bookingData.contactPerson.title}
                onChange={(e) => setBookingData(prev => ({ 
                  ...prev, 
                  contactPerson: { ...prev.contactPerson, title: e.target.value }
                }))}
                placeholder="Event Coordinator"
              />
            </div>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Check-in Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {bookingData.checkInDate ? format(bookingData.checkInDate, 'PPP') : 'Select date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={bookingData.checkInDate || undefined}
                  onSelect={(date) => setBookingData(prev => ({ ...prev, checkInDate: date || null }))}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label>Check-out Date *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {bookingData.checkOutDate ? format(bookingData.checkOutDate, 'PPP') : 'Select date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={bookingData.checkOutDate || undefined}
                  onSelect={(date) => setBookingData(prev => ({ ...prev, checkOutDate: date || null }))}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderStep2 = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bed className="w-5 h-5" />
          Room Requirements
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {bookingData.roomRequirements.map((requirement, index) => (
          <div key={requirement.id} className="p-4 border rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium">Room Requirement {index + 1}</h4>
              {bookingData.roomRequirements.length > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeRoomRequirement(requirement.id)}
                >
                  <Minus className="w-4 h-4" />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Room Type</Label>
                <Select
                  value={requirement.roomType}
                  onValueChange={(value) => updateRoomRequirement(requirement.id, { roomType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roomTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label} - {formatCurrency(type.baseRate)}/night
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min="1"
                  value={requirement.quantity}
                  onChange={(e) => updateRoomRequirement(requirement.id, { quantity: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div>
                <Label>Occupants per Room</Label>
                <Input
                  type="number"
                  min="1"
                  max="4"
                  value={requirement.occupants}
                  onChange={(e) => updateRoomRequirement(requirement.id, { occupants: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>

            <div className="mt-4">
              <Label>Special Requests</Label>
              <Textarea
                value={requirement.specialRequests}
                onChange={(e) => updateRoomRequirement(requirement.id, { specialRequests: e.target.value })}
                placeholder="High floor, quiet room, connecting rooms..."
              />
            </div>
          </div>
        ))}

        <Button onClick={addRoomRequirement} variant="outline" className="w-full">
          <Plus className="w-4 h-4 mr-2" />
          Add Room Requirement
        </Button>
      </CardContent>
    </Card>
  );

  // Navigation buttons
  const renderNavigation = () => (
    <div className="flex justify-between mt-8">
      <Button
        variant="outline"
        onClick={() => currentStep === 1 ? onCancel?.() : setCurrentStep(currentStep - 1)}
      >
        <ChevronLeft className="w-4 h-4 mr-2" />
        {currentStep === 1 ? 'Cancel' : 'Previous'}
      </Button>

      {currentStep < steps.length ? (
        <Button onClick={() => setCurrentStep(currentStep + 1)}>
          Next
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      ) : (
        <Button onClick={handleSubmit} disabled={isLoading}>
          {isLoading ? 'Creating...' : 'Create Group Booking'}
        </Button>
      )}
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Create Group Booking</h1>
        <p className="text-gray-600">Manage multi-room reservations for groups and corporate events</p>
      </div>

      {renderStepIndicator()}

      {currentStep === 1 && renderStep1()}
      {currentStep === 2 && renderStep2()}
      {/* Additional steps would be implemented here */}

      {renderNavigation()}
    </div>
  );
};

export default GroupBookingFlow;
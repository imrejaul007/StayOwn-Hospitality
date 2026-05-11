import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/Badge';
import { Textarea } from '../ui/textarea';
import {
  X,
  Plus,
  Building2,
  MapPin,
  Phone,
  Mail,
  Globe,
  Star,
  CheckCircle,
  AlertCircle,
  Bed,
  Clock,
  Shield,
  Settings
} from 'lucide-react';
import { api } from '../../services/api';
import { RoomSetupWizard } from './RoomSetupWizard';
import { withErrorBoundary } from '../ErrorBoundary';
import { useToast } from '@/components/ui/use-toast';
import { useCurrentUser } from '../../hooks/useCurrentUser';

interface AddPropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface RoomTypeConfig {
  count: number;
  basePrice: number;
  amenities: string[];
  size: number;
}

interface RoomsConfig {
  roomTypes: {
    [key: string]: RoomTypeConfig;
  };
  numberingPattern: 'sequential' | 'floor-based' | 'type-based' | 'custom';
  startingNumber: number;
  floorPlan?: {
    pattern: string;
    floors: number;
  };
}

interface PropertyFormData {
  name: string;
  description: string;
  propertyGroupId?: string;
  address: {
    street: string;
    city: string;
    state: string;
    country: string;
    zipCode: string;
    coordinates: {
      latitude: number;
      longitude: number;
    };
  };
  contact: {
    phone: string;
    email: string;
    website: string;
  };
  amenities: string[];
  type: string;
  images: string[];
  policies: {
    checkInTime: string;
    checkOutTime: string;
    cancellationPolicy: string;
    petPolicy: string;
    smokingPolicy: string;
  };
  settings: {
    currency: string;
    timezone: string;
    language: string;
  };
}

interface PropertyGroup {
  _id: string;
  name: string;
  description: string;
  groupType: string;
  settings?: {
    brandGuidelines?: unknown;
  };
}

const PROPERTY_TYPES = [
  { value: 'hotel', label: 'Hotel' },
  { value: 'resort', label: 'Resort' },
  { value: 'boutique', label: 'Boutique Hotel' },
  { value: 'aparthotel', label: 'Aparthotel' },
  { value: 'hostel', label: 'Hostel' }
];

const COMMON_AMENITIES = [
  'WiFi', 'Pool', 'Gym', 'Spa', 'Restaurant', 'Bar', 'Room Service',
  'Parking', 'Business Center', 'Conference Rooms', 'Airport Shuttle',
  'Pet Friendly', 'Air Conditioning', 'Laundry Service', 'Concierge',
  '24/7 Front Desk', 'Luggage Storage', 'Tour Desk', 'Currency Exchange',
  'Elevator', 'Non-Smoking Rooms', 'Family Rooms', 'Accessible Rooms'
];

const CURRENCIES = [
  { value: 'INR', label: 'Indian Rupee (₹)' },
  { value: 'USD', label: 'US Dollar ($)' },
  { value: 'EUR', label: 'Euro (€)' },
  { value: 'GBP', label: 'British Pound (£)' },
  { value: 'AED', label: 'UAE Dirham (د.إ)' }
];

const TIMEZONES = [
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'America/New_York (EST)' },
  { value: 'Europe/London', label: 'Europe/London (GMT)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST)' }
];

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' }
];

export const AddPropertyModal: React.FC<AddPropertyModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { toast } = useToast();
  const { data: currentUser } = useCurrentUser();
  const [formData, setFormData] = useState<PropertyFormData>({
    name: '',
    description: '',
    propertyGroupId: undefined,
    address: {
      street: '',
      city: '',
      state: '',
      country: '',
      zipCode: '',
      coordinates: {
        latitude: 0,
        longitude: 0
      }
    },
    contact: {
      phone: '',
      email: '',
      website: ''
    },
    amenities: [],
    type: 'hotel',
    images: [],
    policies: {
      checkInTime: '15:00',
      checkOutTime: '11:00',
      cancellationPolicy: 'Free cancellation 24 hours before check-in',
      petPolicy: 'Pets are not allowed',
      smokingPolicy: 'Smoking is not permitted in rooms'
    },
    settings: {
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      language: 'en'
    }
  });
  const [roomsConfig, setRoomsConfig] = useState<RoomsConfig | null>(null);
  const [showRoomWizard, setShowRoomWizard] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [newAmenity, setNewAmenity] = useState('');
  const [propertyGroups, setPropertyGroups] = useState<PropertyGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  // Fetch available property groups when modal opens (admin only)
  useEffect(() => {
    if (isOpen) {
      fetchPropertyGroups();
    }
  }, [isOpen]);

  const fetchPropertyGroups = async () => {
    setLoadingGroups(true);
    try {
      // Only fetch property groups for admin users
      if (currentUser?.role === 'admin') {
        const response = await api.get('/property-rooms/property-groups');
        if (response.data.success) {
          setPropertyGroups(response.data.data || []);
        }
      }
    } catch (error) {
      setPropertyGroups([]);
    } finally {
      setLoadingGroups(false);
    }
  };

  const handleInputChange = (field: string, value: unknown) => {
    if (field.includes('.')) {
      const parts = field.split('.');
      setFormData(prev => {
        const newData = { ...prev };
        let current: unknown = newData;
        
        for (let i = 0; i < parts.length - 1; i++) {
          if (!current[parts[i]]) {
            current[parts[i]] = {};
          }
          current = current[parts[i]];
        }
        
        current[parts[parts.length - 1]] = value;
        return newData;
      });
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleAddAmenity = (amenity: string) => {
    if (amenity && !formData.amenities.includes(amenity)) {
      setFormData(prev => ({
        ...prev,
        amenities: [...prev.amenities, amenity]
      }));
      setNewAmenity('');
    }
  };

  const handleRemoveAmenity = (amenity: string) => {
    setFormData(prev => ({
      ...prev,
      amenities: prev.amenities.filter(a => a !== amenity)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Create property with rooms using our integrated API
      const payload = {
        property: formData,
        roomsConfig: roomsConfig || undefined
      };

      await api.post('/property-rooms/create-with-rooms', payload);
      onSuccess();
      onClose();

      // Reset form
      setFormData({
        name: '',
        description: '',
        propertyGroupId: undefined,
        address: {
          street: '',
          city: '',
          state: '',
          country: '',
          zipCode: '',
          coordinates: {
            latitude: 0,
            longitude: 0
          }
        },
        contact: {
          phone: '',
          email: '',
          website: ''
        },
        amenities: [],
        type: 'hotel',
        images: [],
        policies: {
          checkInTime: '15:00',
          checkOutTime: '11:00',
          cancellationPolicy: 'Free cancellation 24 hours before check-in',
          petPolicy: 'Pets are not allowed',
          smokingPolicy: 'Smoking is not permitted in rooms'
        },
        settings: {
          currency: 'INR',
          timezone: 'Asia/Kolkata',
          language: 'en'
        }
      });
      setRoomsConfig(null);
      setShowRoomWizard(false);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast({
        variant: "destructive",
        title: "Error",
        description: err?.response?.data?.message || "Failed to create property. Please try again."
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto bg-white">
        <DialogHeader className="pb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-bold text-gray-900">Add New Property</DialogTitle>
              <p className="text-sm text-gray-600 mt-1">Create a new property in your portfolio</p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Information */}
          <div className="bg-gray-50 rounded-xl p-6 space-y-6">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Property Name <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Enter property name"
                  required
                  className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Property Type <span className="text-red-500">*</span>
                </label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => handleInputChange('type', value)}
                >
                  <SelectTrigger className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="Select property type" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTY_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* PropertyGroup selection - Admin only */}
            {(() => {
              return currentUser?.role === 'admin' && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Property Group (Optional)
                  </label>
                  <Select
                    value={formData.propertyGroupId || ''}
                    onValueChange={(value) => handleInputChange('propertyGroupId', value || undefined)}
                    disabled={loadingGroups}
                  >
                    <SelectTrigger className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                      <SelectValue placeholder={loadingGroups ? 'Loading property groups...' : 'Select a property group (optional)'} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">
                        <span className="text-gray-500">No Property Group</span>
                      </SelectItem>
                      {propertyGroups.map((group) => (
                        <SelectItem key={group._id} value={group._id}>
                          <div className="flex flex-col">
                            <span className="font-medium">{group.name}</span>
                            {group.description && (
                              <span className="text-xs text-gray-500">{group.description}</span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formData.propertyGroupId && (
                    <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                      <span className="font-medium">Note:</span> This property will inherit settings and policies from the selected property group.
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <Textarea
                className="min-h-[100px] border-gray-200 focus:border-blue-500 focus:ring-blue-500 resize-none"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Describe the property, its unique features, and what makes it special..."
              />
            </div>
          </div>

          {/* Address Information */}
          <div className="bg-gray-50 rounded-xl p-6 space-y-6">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Address Information</h3>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Street Address</label>
              <Input
                value={formData.address.street}
                onChange={(e) => handleInputChange('address.street', e.target.value)}
                placeholder="Enter street address"
                className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  City <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.address.city}
                  onChange={(e) => handleInputChange('address.city', e.target.value)}
                  placeholder="Enter city"
                  required
                  className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">State/Province</label>
                <Input
                  value={formData.address.state}
                  onChange={(e) => handleInputChange('address.state', e.target.value)}
                  placeholder="Enter state/province"
                  className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Country <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.address.country}
                  onChange={(e) => handleInputChange('address.country', e.target.value)}
                  placeholder="Enter country"
                  required
                  className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">ZIP/Postal Code</label>
                <Input
                  value={formData.address.zipCode}
                  onChange={(e) => handleInputChange('address.zipCode', e.target.value)}
                  placeholder="Enter ZIP/postal code"
                  className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="bg-gray-50 rounded-xl p-6 space-y-6">
            <div className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Contact Information</h3>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.contact.phone}
                  onChange={(e) => handleInputChange('contact.phone', e.target.value)}
                  placeholder="Enter phone number"
                  required
                  className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <Input
                  type="email"
                  value={formData.contact.email}
                  onChange={(e) => handleInputChange('contact.email', e.target.value)}
                  placeholder="Enter email address"
                  required
                  className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Website</label>
              <Input
                value={formData.contact.website}
                onChange={(e) => handleInputChange('contact.website', e.target.value)}
                placeholder="Enter website URL (e.g., https://example.com)"
                className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Amenities */}
          <div className="bg-gray-50 rounded-xl p-6 space-y-6">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Amenities & Features</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Quick Add Amenities</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {COMMON_AMENITIES.map(amenity => (
                    <button aria-label="Add"
                      key={amenity}
                      type="button"
                      onClick={() => handleAddAmenity(amenity)}
                      className={`px-4 py-2 text-sm rounded-lg border transition-all duration-200 ${
                        formData.amenities.includes(amenity)
                          ? 'bg-blue-100 border-blue-300 text-blue-700 shadow-sm'
                          : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
                      }`}
                    >
                      {amenity}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">Add Custom Amenity</label>
                <div className="flex gap-3">
                  <Input
                    value={newAmenity}
                    onChange={(e) => setNewAmenity(e.target.value)}
                    placeholder="Enter custom amenity"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddAmenity(newAmenity);
                      }
                    }}
                    className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                  />
                  <Button
                    type="button"
                    onClick={() => handleAddAmenity(newAmenity)}
                    className="px-4 bg-blue-600 hover:bg-blue-700"
                    disabled={!newAmenity.trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {formData.amenities.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700">Selected Amenities</label>
                    <span className="text-xs text-gray-500">{formData.amenities.length} selected</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.amenities.map(amenity => (
                      <Badge
                        key={amenity}
                        variant="secondary"
                        className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 border-blue-200"
                      >
                        {amenity}
                        <button aria-label="Delete"
                          type="button"
                          onClick={() => handleRemoveAmenity(amenity)}
                          className="hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Room Configuration */}
          <div className="bg-gray-50 rounded-xl p-6 space-y-6">
            <div className="flex items-center gap-2">
              <Bed className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Room Configuration</h3>
            </div>

            {!roomsConfig ? (
              <div className="text-center py-12">
                <div className="bg-white rounded-xl p-8 border-2 border-dashed border-gray-300 hover:border-blue-400 transition-colors">
                  <Bed className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-gray-900 mb-2">Set Up Your Rooms</h4>
                  <p className="text-gray-600 mb-6 max-w-md mx-auto">
                    Configure room types, pricing, amenities, and numbering system for your property.
                    You can also skip this step and add rooms later.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button
                      type="button"
                      onClick={() => setShowRoomWizard(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Configure Rooms
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="text-gray-600 border-gray-300 hover:bg-gray-50"
                    >
                      Skip for Now
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-white rounded-lg border border-green-200 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-green-700">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-medium">Room Configuration Complete</span>
                    </div>
                    <Button
                      type="button"
                      onClick={() => setShowRoomWizard(true)}
                      variant="outline"
                      size="sm"
                    >
                      Edit Configuration
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Total Rooms:</span>
                      <div className="font-medium">
                        {Object.values(roomsConfig.roomTypes).reduce((sum, type) => sum + type.count, 0)}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600">Room Types:</span>
                      <div className="font-medium">
                        {Object.keys(roomsConfig.roomTypes).length}
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-600">Numbering:</span>
                      <div className="font-medium capitalize">
                        {roomsConfig.numberingPattern}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(roomsConfig.roomTypes).map(([name, config]) => (
                        <Badge key={name} variant="secondary" className="bg-blue-100 text-blue-700">
                          {config.count} {name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {showRoomWizard && (
              <Dialog open={showRoomWizard} onOpenChange={() => setShowRoomWizard(false)}>
                <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Room Setup Wizard</DialogTitle>
                  </DialogHeader>
                  <RoomSetupWizard
                    initialConfig={roomsConfig || undefined}
                    onComplete={(config) => {
                      setRoomsConfig(config);
                      setShowRoomWizard(false);
                    }}
                    onCancel={() => setShowRoomWizard(false)}
                  />
                </DialogContent>
              </Dialog>
            )}
          </div>

          {/* Operational Settings */}
          <div className="bg-gray-50 rounded-xl p-6 space-y-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Operational Settings</h3>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Check-in Time <span className="text-red-500">*</span>
                </label>
                <Input
                  type="time"
                  value={formData.policies.checkInTime}
                  onChange={(e) => handleInputChange('policies.checkInTime', e.target.value)}
                  className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Check-out Time <span className="text-red-500">*</span>
                </label>
                <Input
                  type="time"
                  value={formData.policies.checkOutTime}
                  onChange={(e) => handleInputChange('policies.checkOutTime', e.target.value)}
                  className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Currency <span className="text-red-500">*</span>
                </label>
                <Select
                  value={formData.settings.currency}
                  onValueChange={(value) => handleInputChange('settings.currency', value)}
                >
                  <SelectTrigger className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((currency) => (
                      <SelectItem key={currency.value} value={currency.value}>
                        {currency.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Timezone <span className="text-red-500">*</span>
                </label>
                <Select
                  value={formData.settings.timezone}
                  onValueChange={(value) => handleInputChange('settings.timezone', value)}
                >
                  <SelectTrigger className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="Select timezone" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((timezone) => (
                      <SelectItem key={timezone.value} value={timezone.value}>
                        {timezone.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Default Language <span className="text-red-500">*</span>
                </label>
                <Select
                  value={formData.settings.language}
                  onValueChange={(value) => handleInputChange('settings.language', value)}
                >
                  <SelectTrigger className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((language) => (
                      <SelectItem key={language.value} value={language.value}>
                        {language.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Hotel Policies */}
          <div className="bg-gray-50 rounded-xl p-6 space-y-6">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Hotel Policies</h3>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Cancellation Policy</label>
                <Textarea
                  className="min-h-[80px] border-gray-200 focus:border-blue-500 focus:ring-blue-500 resize-none"
                  value={formData.policies.cancellationPolicy}
                  onChange={(e) => handleInputChange('policies.cancellationPolicy', e.target.value)}
                  placeholder="Describe your cancellation policy..."
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Pet Policy</label>
                  <Textarea
                    className="min-h-[80px] border-gray-200 focus:border-blue-500 focus:ring-blue-500 resize-none"
                    value={formData.policies.petPolicy}
                    onChange={(e) => handleInputChange('policies.petPolicy', e.target.value)}
                    placeholder="Describe your pet policy..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Smoking Policy</label>
                  <Textarea
                    className="min-h-[80px] border-gray-200 focus:border-blue-500 focus:ring-blue-500 resize-none"
                    value={formData.policies.smokingPolicy}
                    onChange={(e) => handleInputChange('policies.smokingPolicy', e.target.value)}
                    placeholder="Describe your smoking policy..."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Location Coordinates */}
          <div className="bg-gray-50 rounded-xl p-6 space-y-6">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Location Coordinates (Optional)</h3>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Latitude</label>
                <Input
                  type="number"
                  step="any"
                  value={formData.address.coordinates.latitude}
                  onChange={(e) => handleInputChange('address.coordinates.latitude', parseFloat(e.target.value) || 0)}
                  placeholder="Enter latitude"
                  className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Longitude</label>
                <Input
                  type="number"
                  step="any"
                  value={formData.address.coordinates.longitude}
                  onChange={(e) => handleInputChange('address.coordinates.longitude', parseFloat(e.target.value) || 0)}
                  placeholder="Enter longitude"
                  className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="h-11 px-6 border-gray-300 hover:bg-gray-50"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="h-11 px-8 bg-blue-600 hover:bg-blue-700 min-w-[140px]"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Create Property
                </div>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default withErrorBoundary(AddPropertyModal, { level: 'component' });
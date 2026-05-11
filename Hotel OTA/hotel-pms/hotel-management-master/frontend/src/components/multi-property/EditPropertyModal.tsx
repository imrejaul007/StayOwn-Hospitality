import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/Badge';
import { Textarea } from '../ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
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
  Trash2,
  Settings,
  Edit,
  Eye,
  MoreHorizontal
} from 'lucide-react';
import { api } from '../../services/api';
import { RoomSetupWizard } from './RoomSetupWizard';
import { withErrorBoundary } from '../ErrorBoundary';

interface EditPropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  property: Property | null;
}

interface Property {
  id: string;
  name: string;
  brand: string;
  type: 'hotel' | 'resort' | 'aparthotel' | 'hostel' | 'boutique';
  location: {
    address: string;
    city: string;
    country: string;
    coordinates: { lat: number; lng: number };
  };
  contact: {
    phone: string;
    email: string;
    manager: string;
  };
  rooms: {
    total: number;
    occupied: number;
    available: number;
    outOfOrder: number;
  };
  performance: {
    occupancyRate: number;
    adr: number;
    revpar: number;
    revenue: number;
    lastMonth: {
      occupancyRate: number;
      adr: number;
      revpar: number;
      revenue: number;
    };
  };
  amenities: string[];
  rating: number;
  status: 'active' | 'inactive' | 'maintenance';
  features: {
    pms: boolean;
    pos: boolean;
    spa: boolean;
    restaurant: boolean;
    parking: boolean;
    wifi: boolean;
    fitness: boolean;
    pool: boolean;
  };
  operationalHours: {
    checkIn: string;
    checkOut: string;
    frontDesk: string;
  };
  originalHotel?: unknown; // Store original hotel data for editing
}

interface PropertyFormData {
  name: string;
  brand: string;
  type: string;
  location: {
    address: string;
    city: string;
    country: string;
    coordinates: {
      lat: number;
      lng: number;
    };
  };
  contact: {
    phone: string;
    email: string;
    manager: string;
  };
  amenities: string[];
  features: {
    pms: boolean;
    pos: boolean;
    spa: boolean;
    restaurant: boolean;
    parking: boolean;
    wifi: boolean;
    fitness: boolean;
    pool: boolean;
  };
  operationalHours: {
    checkIn: string;
    checkOut: string;
    frontDesk: string;
  };
  rooms: {
    total: number;
    occupied: number;
    available: number;
    outOfOrder: number;
  };
  status: string;
  rating: number;
}

interface Room {
  _id: string;
  roomNumber?: string;
  number?: string;
  type?:
    | string
    | {
        _id: string;
        name: string;
        basePrice: number;
        amenities: string[];
      };
  roomTypeId?: { name?: string; basePrice?: number; amenities?: string[] } | string;
  status: string;
  effectiveStatus?: string;
  /** Live status from occupancy API (booking-aware); matches summary cards */
  liveStatus?: string;
  floor: number;
  size?: number;
  baseRate?: number;
  capacity?: number;
  pricing?: {
    baseRate: number;
    currency: string;
  };
  amenities?: string[];
  isActive?: boolean;
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

export const EditPropertyModal: React.FC<EditPropertyModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  property
}) => {
  const { toast } = useToast();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [formData, setFormData] = useState<PropertyFormData>({
    name: '',
    brand: '',
    type: 'hotel',
    location: {
      address: '',
      city: '',
      country: '',
      coordinates: {
        lat: 0,
        lng: 0
      }
    },
    contact: {
      phone: '',
      email: '',
      manager: ''
    },
    amenities: [],
    features: {
      pms: false,
      pos: false,
      spa: false,
      restaurant: false,
      parking: false,
      wifi: false,
      fitness: false,
      pool: false
    },
    operationalHours: {
      checkIn: '15:00',
      checkOut: '11:00',
      frontDesk: '24/7'
    },
    rooms: {
      total: 0,
      occupied: 0,
      available: 0,
      outOfOrder: 0
    },
    status: 'active',
    rating: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [newAmenity, setNewAmenity] = useState('');
  const [roomData, setRoomData] = useState({
    total: 0,
    occupied: 0,
    available: 0,
    outOfOrder: 0
  });
  const [activeTab, setActiveTab] = useState<'general' | 'rooms' | 'amenities' | 'operations'>('general');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [showRoomWizard, setShowRoomWizard] = useState(false);
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);

  /**
   * Room list + occupancy merge: DB `status` stays vacant until housekeeping updates it;
   * occupancy endpoint computes occupied from active bookings.
   */
  const fetchPropertyRooms = async (propertyId: string) => {
    setRoomsLoading(true);
    try {
      const [roomsRes, occRes] = await Promise.all([
        api.get(`/property-rooms/${propertyId}/rooms?limit=200&page=1`),
        api.get(`/admin-dashboard/occupancy?hotelId=${propertyId}`).catch(() => ({
          data: { data: { rooms: [] as { _id?: string; status?: string }[] } },
        })),
      ]);
      const roomsData = (roomsRes.data?.data?.rooms || []) as Room[];
      const occRooms = (occRes.data?.data?.rooms || []) as { _id?: string; status?: string }[];
      const statusById = new Map<string, string>();
      for (const r of occRooms) {
        if (r._id) statusById.set(String(r._id), r.status || 'vacant');
      }
      const merged = roomsData.map((r) => {
        const id = String(r._id);
        const live = statusById.get(id) || r.status || 'vacant';
        return { ...r, liveStatus: live };
      });
      setRooms(merged);
      return merged;
    } catch {
      setRooms([]);
      return [];
    } finally {
      setRoomsLoading(false);
    }
  };

  // Fetch real room data for the property
  const fetchRoomData = async (hotelId: string) => {
    try {

      // Try the occupancy endpoint first as it provides room status data
      const response = await api.get(`/admin-dashboard/occupancy?hotelId=${hotelId}`);
      const data = response.data.data;


      if (data && data.overallMetrics) {
        const roomCounts = {
          total: data.overallMetrics.totalRooms || 0,
          occupied: data.overallMetrics.occupiedRooms || 0,
          available: data.overallMetrics.availableRooms || 0,
          outOfOrder: (data.overallMetrics.maintenanceRooms || 0) + (data.overallMetrics.outOfOrderRooms || 0)
        };

        setRoomData(roomCounts);

        return roomCounts;
      } else {
        // Fallback: try to get room data from the rooms array if available
        const rooms = data?.rooms || [];

        const roomCounts = {
          total: rooms.length,
          occupied: rooms.filter((room: Record<string, unknown>) => room.status === 'occupied' || room.effectiveStatus === 'occupied').length,
          available: rooms.filter((room: Record<string, unknown>) => room.status === 'vacant' || room.effectiveStatus === 'available').length,
          outOfOrder: rooms.filter((room: Record<string, unknown>) =>
            room.status === 'maintenance' || room.effectiveStatus === 'maintenance' ||
            room.status === 'out_of_order' || room.effectiveStatus === 'out_of_order'
          ).length
        };

        setRoomData(roomCounts);

        return roomCounts;
      }
    } catch (error) {

      // Try alternative endpoint - real-time dashboard
      try {
        const response = await api.get(`/admin-dashboard/real-time?hotelId=${hotelId}`);
        const data = response.data.data;


        if (data && data.occupancy) {
          const roomCounts = {
            total: data.occupancy.total || 0,
            occupied: data.occupancy.occupied || 0,
            available: data.occupancy.available || 0,
            outOfOrder: (data.occupancy.roomStatus?.maintenance || 0) + (data.occupancy.roomStatus?.outOfOrder || 0)
          };

          setRoomData(roomCounts);

          return roomCounts;
        }
      } catch {
        // Error handled silently
      }

      // Return default counts if all APIs fail
      return {
        total: 0,
        occupied: 0,
        available: 0,
        outOfOrder: 0
      };
    }
  };

  // Update form data when property prop changes
  useEffect(() => {
    if (property) {
      
      // Get the property ID for fetching room data
      const propertyId = property.id || property._id;
      
      // Check if this is raw hotel data (has roomCount) or transformed property data
      const isRawHotelData = 'roomCount' in property;
      
      // Fetch real room data
      fetchRoomData(propertyId).then((roomCounts) => {
        // Also fetch detailed room information for room management
        if (activeTab === 'rooms') {
          fetchPropertyRooms(propertyId);
        }
        if (isRawHotelData) {
          // Handle raw hotel data structure
          setFormData({
            name: property.name || '',
            brand: 'Independent', // Default since raw hotel data doesn't have brand
            type: 'hotel', // Default since raw hotel data doesn't have type
            location: {
              address: property.address?.street || '',
              city: property.address?.city || '',
              country: property.address?.country || '',
              coordinates: {
                lat: 0, // Raw hotel data doesn't have coordinates
                lng: 0
              }
            },
            contact: {
              phone: property.contact?.phone || '',
              email: property.contact?.email || '',
              manager: property.ownerId?.name || ''
            },
            amenities: property.amenities || [],
            features: {
              pms: true, // Default features
              pos: false,
              spa: false,
              restaurant: false,
              parking: false,
              wifi: true,
              fitness: false,
              pool: false
            },
            operationalHours: {
              checkIn: property.policies?.checkInTime || '15:00',
              checkOut: property.policies?.checkOutTime || '11:00',
              frontDesk: '24/7'
            },
            rooms: {
              total: roomCounts.total || property.roomCount || 0,
              occupied: roomCounts.occupied || 0,
              available: roomCounts.available || 0,
              outOfOrder: roomCounts.outOfOrder || 0
            },
            status: property.isActive ? 'active' : 'inactive',
            rating: typeof hotel.rating === 'number' ? hotel.rating : 0
          });
        } else {
          // Handle transformed property data structure
          const sourceData = property.originalHotel || property;
          
          setFormData({
            name: property.name || '',
            brand: property.brand || '',
            type: property.type || 'hotel',
            location: {
              address: property.location?.address || '',
              city: property.location?.city || '',
              country: property.location?.country || '',
              coordinates: {
                lat: property.location?.coordinates?.lat || 0,
                lng: property.location?.coordinates?.lng || 0
              }
            },
            contact: {
              phone: property.contact?.phone || '',
              email: property.contact?.email || '',
              manager: property.contact?.manager || ''
            },
            amenities: property.amenities || [],
            features: {
              pms: property.features?.pms || false,
              pos: property.features?.pos || false,
              spa: property.features?.spa || false,
              restaurant: property.features?.restaurant || false,
              parking: property.features?.parking || false,
              wifi: property.features?.wifi || false,
              fitness: property.features?.fitness || false,
              pool: property.features?.pool || false
            },
            operationalHours: {
              checkIn: property.operationalHours?.checkIn || '15:00',
              checkOut: property.operationalHours?.checkOut || '11:00',
              frontDesk: property.operationalHours?.frontDesk || '24/7'
            },
            rooms: {
              total: roomCounts.total || property.rooms?.total || sourceData.roomCount || 0,
              occupied: roomCounts.occupied || property.rooms?.occupied || 0,
              available: roomCounts.available || property.rooms?.available || 0,
              outOfOrder: roomCounts.outOfOrder || property.rooms?.outOfOrder || 0
            },
            status: property.status || 'active',
            rating: property.rating || 0
          });
        }
      });
    }
  }, [property, activeTab]);

  // Fetch rooms when switching to rooms tab
  useEffect(() => {
    if (property && activeTab === 'rooms') {
      const propertyId = property.id || property._id;
      fetchPropertyRooms(propertyId);
    }
  }, [activeTab, property]);

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
    if (!property) return;

    setIsLoading(true);

    try {
      // Get the correct property ID (handle both raw hotel data and transformed property data)
      const propertyId = property.id || property._id;
      
      // Transform form data to match backend API expectations
      // Note: roomCount is not supported by the hotel update API - it's managed separately
      const apiData = {
        name: formData.name,
        description: '', // Backend expects description but we don't have it in our form
        address: {
          street: formData.location.address,
          city: formData.location.city,
          state: '', // Backend expects state but we don't have it
          country: formData.location.country,
          zipCode: '' // Backend expects zipCode but we don't have it
        },
        contact: {
          phone: formData.contact.phone,
          email: formData.contact.email,
          website: '' // Backend expects website but we have manager instead
        },
        amenities: formData.amenities,
        type: formData.type
      };

      
      const response = await api.put(`/admin/hotels/${propertyId}`, apiData);
      
      onSuccess();
      onClose();
    } catch (error) {
      // Handle error (show toast notification)
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = () => {
    if (!property) return;
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    setIsLoading(true);
    try {
      const propertyId = property?.id || property?._id;
      await api.delete(`/admin/hotels/${propertyId}`);
      onSuccess();
      onClose();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast({
        variant: "destructive",
        title: "Error",
        description: err?.response?.data?.message || "Failed to delete property."
      });
    } finally {
      setIsLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  if (!property) return null;

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden bg-gradient-to-br from-slate-50 to-white border-0 shadow-2xl">
        <DialogHeader className="pb-8 bg-gradient-to-r from-blue-600 to-indigo-600 -m-6 mb-0 px-8 py-6 text-white">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-bold text-white">
                {property?.name}
              </DialogTitle>
              <p className="text-blue-100 mt-1 text-sm">Manage property details, amenities, and room configurations</p>
            </div>
          </div>
        </DialogHeader>

        <div className="px-8 py-6 overflow-y-auto max-h-[calc(95vh-140px)]">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as unknown)} className="w-full">
            {/* Tab Navigation */}
            <TabsList className="grid w-full grid-cols-4 mb-8 bg-white shadow-lg rounded-xl border h-12">
              <TabsTrigger
                value="general"
                className="flex items-center gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white font-medium rounded-lg transition-all"
              >
                <Building2 className="h-4 w-4" />
                General
              </TabsTrigger>
              <TabsTrigger
                value="rooms"
                className="flex items-center gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white font-medium rounded-lg transition-all"
              >
                <Bed className="h-4 w-4" />
                Room Management
              </TabsTrigger>
              <TabsTrigger
                value="amenities"
                className="flex items-center gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white font-medium rounded-lg transition-all"
              >
                <Star className="h-4 w-4" />
                Amenities
              </TabsTrigger>
              <TabsTrigger
                value="operations"
                className="flex items-center gap-2 data-[state=active]:bg-blue-600 data-[state=active]:text-white font-medium rounded-lg transition-all"
              >
                <Settings className="h-4 w-4" />
                Operations
              </TabsTrigger>
            </TabsList>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* General Tab */}
            <TabsContent value="general" className="space-y-6">
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
                  Brand <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.brand}
                  onChange={(e) => handleInputChange('brand', e.target.value)}
                  placeholder="Enter brand name"
                  required
                  className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Rating <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  min="0"
                  max="5"
                  step="0.1"
                  value={formData.rating}
                  onChange={(e) => handleInputChange('rating', parseFloat(e.target.value) || 0)}
                  placeholder="Enter rating (0-5)"
                  className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Address Information */}
          <div className="bg-gray-50 rounded-xl p-6 space-y-6">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Address Information</h3>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Address</label>
              <Input
                value={formData.location.address}
                onChange={(e) => handleInputChange('location.address', e.target.value)}
                placeholder="Enter full address"
                className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  City <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.location.city}
                  onChange={(e) => handleInputChange('location.city', e.target.value)}
                  placeholder="Enter city"
                  required
                  className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Country <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.location.country}
                  onChange={(e) => handleInputChange('location.country', e.target.value)}
                  placeholder="Enter country"
                  required
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
              <label className="block text-sm font-medium text-gray-700">
                Manager Name <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.contact.manager}
                onChange={(e) => handleInputChange('contact.manager', e.target.value)}
                placeholder="Enter manager name"
                required
                className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>

            </TabsContent>

            {/* Room Management Tab */}
            <TabsContent value="rooms" className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Room Management</h3>
                  <p className="text-sm text-gray-600">Manage individual rooms and room types for this property</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={() => setShowRoomWizard(true)}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Rooms
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      if (property) {
                        const propertyId = property.id || property._id;
                        fetchPropertyRooms(propertyId);
                      }
                    }}
                    variant="outline"
                    disabled={roomsLoading}
                  >
                    {roomsLoading ? 'Loading...' : 'Refresh'}
                  </Button>
                </div>
              </div>

              {/* Room Statistics */}
              <div className="grid grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-blue-600">{formData.rooms.total}</div>
                    <div className="text-sm text-gray-600">Total Rooms</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-green-600">{formData.rooms.available}</div>
                    <div className="text-sm text-gray-600">Available</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-orange-600">{formData.rooms.occupied}</div>
                    <div className="text-sm text-gray-600">Occupied</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-red-600">{formData.rooms.outOfOrder}</div>
                    <div className="text-sm text-gray-600">Out of Order</div>
                  </CardContent>
                </Card>
              </div>

              {/* Rooms List */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bed className="h-5 w-5" />
                    Room Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {roomsLoading ? (
                    <div className="text-center py-8">
                      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      <p className="text-gray-600">Loading rooms...</p>
                    </div>
                  ) : rooms.length === 0 ? (
                    <div className="text-center py-12">
                      <Bed className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                      <h4 className="text-lg font-medium text-gray-900 mb-2">No Rooms Found</h4>
                      <p className="text-gray-600 mb-4">This property doesn't have any rooms configured yet.</p>
                      <Button onClick={() => setShowRoomWizard(true)} className="bg-blue-600 text-white">
                        <Plus className="h-4 w-4 mr-2" />
                        Add First Room
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-12 gap-2 text-sm font-medium text-gray-700 border-b pb-2">
                        <div className="col-span-2">Room Number</div>
                        <div className="col-span-2">Type</div>
                        <div className="col-span-1">Floor</div>
                        <div className="col-span-2">Status</div>
                        <div className="col-span-2">Price</div>
                        <div className="col-span-1">Size</div>
                        <div className="col-span-2">Active</div>
                      </div>
                      {rooms.map((room) => {
                        const displayStatus = room.liveStatus || room.effectiveStatus || room.status || 'vacant';
                        const typeLabel =
                          typeof room.type === 'object' && room.type && 'name' in room.type
                            ? room.type.name
                            : typeof room.roomTypeId === 'object' && room.roomTypeId?.name
                              ? room.roomTypeId.name
                              : String(room.type ?? '');
                        const rate = room.baseRate ?? room.pricing?.baseRate ?? 0;
                        return (
                        <div key={room._id} className="grid grid-cols-12 gap-2 items-center py-2 border-b border-gray-100">
                          <div className="col-span-2 font-medium">{room.roomNumber ?? room.number}</div>
                          <div className="col-span-2 text-sm capitalize">{typeLabel}</div>
                          <div className="col-span-1 text-sm">{room.floor}</div>
                          <div className="col-span-2">
                            <Badge
                              variant={
                                displayStatus === 'vacant' || displayStatus === 'available' ? 'default' :
                                displayStatus === 'occupied' ? 'secondary' : 'destructive'
                              }
                              className="text-xs capitalize"
                            >
                              {displayStatus.replace(/_/g, ' ')}
                            </Badge>
                          </div>
                          <div className="col-span-2 text-sm">₹{rate}/night</div>
                          <div className="col-span-1 text-sm">
                            {room.capacity != null ? `${room.capacity} guests` : '—'}
                          </div>
                          <div className="col-span-2">
                            <Badge variant="outline" className="text-xs">
                              {room.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Room Setup Wizard Modal */}
              {showRoomWizard && (
                <Dialog open={showRoomWizard} onOpenChange={() => setShowRoomWizard(false)}>
                  <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Add Rooms to Property</DialogTitle>
                    </DialogHeader>
                    <RoomSetupWizard
                      onComplete={async (config) => {
                        try {
                          const propertyId = property.id || property._id;
                          await api.post(`/property-rooms/${propertyId}/rooms/bulk`, config);
                          setShowRoomWizard(false);
                          fetchPropertyRooms(propertyId);
                          fetchRoomData(propertyId);
                        } catch {
                          // Error handled silently
                        }
                      }}
                      onCancel={() => setShowRoomWizard(false)}
                    />
                  </DialogContent>
                </Dialog>
              )}
            </TabsContent>

            {/* Amenities Tab */}
            <TabsContent value="amenities" className="space-y-8">
              <div className="bg-gradient-to-br from-white to-blue-50 rounded-2xl p-8 border border-blue-100 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Star className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Amenities & Features</h3>
                    <p className="text-sm text-gray-600">Select amenities that make your property special</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-4">Quick Add Amenities</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {COMMON_AMENITIES.map(amenity => (
                        <button aria-label="Add"
                          key={amenity}
                          type="button"
                          onClick={() => handleAddAmenity(amenity)}
                          className={`px-4 py-3 text-sm rounded-xl border-2 transition-all duration-300 font-medium ${
                            formData.amenities.includes(amenity)
                              ? 'bg-gradient-to-r from-blue-500 to-blue-600 border-blue-500 text-white shadow-lg transform scale-105'
                              : 'bg-white border-gray-200 text-gray-700 hover:bg-blue-50 hover:border-blue-300 hover:shadow-md'
                          }`}
                        >
                          {amenity}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white rounded-xl p-6 border border-gray-100">
                    <label className="block text-sm font-semibold text-gray-800 mb-4">Add Custom Amenity</label>
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
                        className="h-12 border-2 border-gray-200 focus:border-blue-500 focus:ring-blue-500 rounded-xl"
                      />
                      <Button
                        type="button"
                        onClick={() => handleAddAmenity(newAmenity)}
                        className="px-6 h-12 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-xl shadow-lg"
                        disabled={!newAmenity.trim()}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {formData.amenities.length > 0 && (
                    <div className="bg-white rounded-xl p-6 border border-gray-100">
                      <div className="flex items-center justify-between mb-4">
                        <label className="block text-sm font-semibold text-gray-800">Selected Amenities</label>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          </div>
                          <span className="text-sm font-medium text-green-700">{formData.amenities.length} selected</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {formData.amenities.map(amenity => (
                          <div
                            key={amenity}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl shadow-md"
                          >
                            <span className="font-medium">{amenity}</span>
                            <button aria-label="Delete"
                              type="button"
                              onClick={() => handleRemoveAmenity(amenity)}
                              className="hover:bg-white/20 rounded-full p-1 transition-colors"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Operations Tab */}
            <TabsContent value="operations" className="space-y-6">

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
                  value={formData.operationalHours.checkIn}
                  onChange={(e) => handleInputChange('operationalHours.checkIn', e.target.value)}
                  className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Check-out Time <span className="text-red-500">*</span>
                </label>
                <Input
                  type="time"
                  value={formData.operationalHours.checkOut}
                  onChange={(e) => handleInputChange('operationalHours.checkOut', e.target.value)}
                  className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Front Desk Hours
                </label>
                <Input
                  value={formData.operationalHours.frontDesk}
                  onChange={(e) => handleInputChange('operationalHours.frontDesk', e.target.value)}
                  placeholder="e.g., 24/7, 6AM-10PM"
                  className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="bg-gray-50 rounded-xl p-6 space-y-6">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Property Features</h3>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(formData.features).map(([feature, enabled]) => (
                <div key={feature} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={feature}
                    checked={enabled}
                    onChange={(e) => handleInputChange(`features.${feature}`, e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor={feature} className="text-sm font-medium text-gray-700 capitalize">
                    {feature.replace(/([A-Z])/g, ' $1').trim()}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Status */}
          <div className="bg-gray-50 rounded-xl p-6 space-y-6">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Property Status</h3>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Status <span className="text-red-500">*</span>
              </label>
              <Select
                value={formData.status}
                onValueChange={(value) => handleInputChange('status', value)}
              >
                <SelectTrigger className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
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
                  value={formData.location.coordinates.lat}
                  onChange={(e) => handleInputChange('location.coordinates.lat', parseFloat(e.target.value) || 0)}
                  placeholder="Enter latitude"
                  className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Longitude</label>
                <Input
                  type="number"
                  step="any"
                  value={formData.location.coordinates.lng}
                  onChange={(e) => handleInputChange('location.coordinates.lng', parseFloat(e.target.value) || 0)}
                  placeholder="Enter longitude"
                  className="h-11 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

            </TabsContent>

            {/* Submit Buttons */}
            <div className="flex flex-col sm:flex-row justify-between gap-4 pt-8 mt-8 border-t border-gray-200 bg-gradient-to-r from-gray-50 to-white -mx-8 -mb-8 px-8 py-6 rounded-b-2xl">
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isLoading}
                className="h-12 px-6 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 rounded-xl shadow-lg border-0"
              >
                <div className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4" />
                  Delete Property
                </div>
              </Button>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={isLoading}
                  className="h-12 px-8 border-2 border-gray-300 hover:bg-gray-50 rounded-xl font-medium"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="h-12 px-10 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-xl shadow-lg border-0 min-w-[160px] font-medium"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Updating...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Update Property
                    </div>
                  )}
                </Button>
              </div>
            </div>
          </form>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>

    {/* Delete Confirmation Dialog */}
    <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Property</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete &quot;{property?.name}&quot;? This will also remove all associated rooms and data. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
            Delete Property
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
};

export default withErrorBoundary(EditPropertyModal, { level: 'component' });
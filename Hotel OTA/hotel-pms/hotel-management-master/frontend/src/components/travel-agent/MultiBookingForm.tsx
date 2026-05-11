import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Trash2,
  Plus,
  Minus,
  User,
  Mail,
  Phone,
  Edit3,
  Check,
  X,
  Star,
  Gift,
  Bed,
  UserPlus
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { api } from '@/services/api';

interface GuestDetails {
  name: string;
  age: number;
}

interface AddOn {
  name: string;
  price: number;
  quantity: number;
}

interface RoomBooking {
  id: string;
  roomTypeId: string;
  roomTypeName: string;
  guestDetails: {
    primaryGuest: {
      name: string;
      email: string;
      phone: string;
    };
    additionalGuests: GuestDetails[];
    totalGuests: number;
  };
  specialRequests?: string;
  addOns: AddOn[];
  ratePerNight: number;
  specialRate?: number;
}

interface RoomType {
  _id: string;
  name: string;
  description: string;
  basePrice: number;
  maxOccupancy: number;
  amenities: string[];
  images: string[];
}

interface MultiBookingFormProps {
  roomBooking: RoomBooking;
  roomIndex: number;
  onUpdate: (updates: Partial<RoomBooking>) => void;
  onRemove: () => void;
  canRemove: boolean;
  hotelId: string;
  checkIn: Date;
  checkOut: Date;
}

const MultiBookingForm: React.FC<MultiBookingFormProps> = ({
  roomBooking,
  roomIndex,
  onUpdate,
  onRemove,
  canRemove,
  hotelId,
  checkIn,
  checkOut
}) => {
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [availableAddOns, setAvailableAddOns] = useState<AddOn[]>([
    { name: 'Extra Bed', price: 50, quantity: 0 },
    { name: 'Airport Transfer', price: 75, quantity: 0 },
    { name: 'Breakfast Package', price: 25, quantity: 0 },
    { name: 'Late Checkout', price: 30, quantity: 0 },
    { name: 'Room Upgrade', price: 100, quantity: 0 },
    { name: 'Spa Package', price: 150, quantity: 0 }
  ]);
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    fetchRoomTypes();
  }, [hotelId, checkIn, checkOut]);

  const fetchRoomTypes = async () => {
    try {
      const response = await api.get('/room-types', { params: { limit: 100 } });
      const rawRoomTypes = response.data?.data?.roomTypes || response.data?.data || response.data?.roomTypes || [];

      if (!Array.isArray(rawRoomTypes) || rawRoomTypes.length === 0) {
        setRoomTypes([]);
        return;
      }

      const mapped: RoomType[] = rawRoomTypes.map((rt: Record<string, unknown>) => ({
        _id: (rt._id as string) || '',
        name: (rt.name as string) || (rt.displayName as string) || '',
        description: (rt.description as string) || '',
        basePrice: (rt.basePrice as number) || (rt.baseRate as number) || (rt.ratePerNight as number) || 0,
        maxOccupancy: (rt.maxOccupancy as number) || (rt.capacity as number) || 2,
        amenities: Array.isArray(rt.amenities) ? (rt.amenities as string[]) : [],
        images: Array.isArray(rt.images) ? (rt.images as string[]) : [],
      }));

      setRoomTypes(mapped);
    } catch {
      toast.error('Failed to load room types');
    }
  };

  // Calculate validation errors without side effects
  const validationErrors = useMemo(() => {
    const errors: Record<string, string> = {};

    if (!roomBooking.guestDetails.primaryGuest.name.trim()) {
      errors.primaryGuestName = 'Primary guest name is required';
    }

    if (!roomBooking.guestDetails.primaryGuest.email.trim()) {
      errors.primaryGuestEmail = 'Primary guest email is required';
    } else if (!/\S+@\S+\.\S+/.test(roomBooking.guestDetails.primaryGuest.email)) {
      errors.primaryGuestEmail = 'Please enter a valid email address';
    }

    if (!roomBooking.guestDetails.primaryGuest.phone.trim()) {
      errors.primaryGuestPhone = 'Primary guest phone is required';
    }

    if (!roomBooking.roomTypeId) {
      errors.roomType = 'Please select a room type';
    }

    if (roomBooking.guestDetails.totalGuests < 1) {
      errors.totalGuests = 'At least one guest is required';
    }

    const selectedRoomType = roomTypes.find(rt => rt._id === roomBooking.roomTypeId);
    if (selectedRoomType && roomBooking.guestDetails.totalGuests > selectedRoomType.maxOccupancy) {
      errors.totalGuests = `Maximum ${selectedRoomType.maxOccupancy} guests allowed for this room type`;
    }

    return errors;
  }, [roomBooking, roomTypes]);

  const isFormValid = Object.keys(validationErrors).length === 0;

  const handleRoomTypeChange = (roomTypeId: string) => {
    const selectedRoomType = roomTypes.find(rt => rt._id === roomTypeId);
    if (selectedRoomType) {
      onUpdate({
        roomTypeId,
        roomTypeName: selectedRoomType.name,
        ratePerNight: selectedRoomType.basePrice
      });
    }
  };

  const handleGuestCountChange = (newCount: number) => {
    const selectedRoomType = roomTypes.find(rt => rt._id === roomBooking.roomTypeId);
    const maxOccupancy = selectedRoomType?.maxOccupancy || 4;

    if (newCount > maxOccupancy) {
      toast.error(`Maximum ${maxOccupancy} guests allowed for this room type`);
      return;
    }

    const additionalGuests = roomBooking.guestDetails.additionalGuests.slice();

    // Add or remove additional guests as needed
    if (newCount > roomBooking.guestDetails.totalGuests) {
      // Add guests
      for (let i = roomBooking.guestDetails.totalGuests; i < newCount; i++) {
        additionalGuests.push({ name: '', age: 18 });
      }
    } else if (newCount < roomBooking.guestDetails.totalGuests) {
      // Remove guests
      additionalGuests.splice(newCount - 1);
    }

    onUpdate({
      guestDetails: {
        ...roomBooking.guestDetails,
        totalGuests: newCount,
        additionalGuests
      }
    });
  };

  const handleAdditionalGuestChange = (index: number, field: keyof GuestDetails, value: string | number) => {
    const additionalGuests = [...roomBooking.guestDetails.additionalGuests];
    additionalGuests[index] = {
      ...additionalGuests[index],
      [field]: value
    };

    onUpdate({
      guestDetails: {
        ...roomBooking.guestDetails,
        additionalGuests
      }
    });
  };

  const handleAddOnChange = (addOnName: string, quantity: number) => {
    const existingAddOns = [...roomBooking.addOns];
    const existingIndex = existingAddOns.findIndex(addon => addon.name === addOnName);
    const baseAddOn = availableAddOns.find(addon => addon.name === addOnName);

    if (!baseAddOn) return;

    if (quantity === 0) {
      // Remove add-on
      if (existingIndex > -1) {
        existingAddOns.splice(existingIndex, 1);
      }
    } else {
      // Add or update add-on
      const addOnData = {
        name: addOnName,
        price: baseAddOn.price,
        quantity
      };

      if (existingIndex > -1) {
        existingAddOns[existingIndex] = addOnData;
      } else {
        existingAddOns.push(addOnData);
      }
    }

    onUpdate({ addOns: existingAddOns });
  };

  const getAddOnQuantity = (addOnName: string) => {
    const addOn = roomBooking.addOns.find(addon => addon.name === addOnName);
    return addOn?.quantity || 0;
  };

  const calculateRoomTotal = () => {
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
    const roomTotal = (roomBooking.specialRate || roomBooking.ratePerNight) * nights;
    const addOnsTotal = roomBooking.addOns.reduce((sum, addon) => sum + (addon.price * addon.quantity), 0);
    return roomTotal + addOnsTotal;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="border-2 border-gray-200 rounded-lg overflow-hidden"
    >
      {/* Room Header */}
      <div className="bg-gray-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 text-lg font-semibold text-gray-900 hover:text-indigo-600 transition-colors"
          >
            <Bed className="h-5 w-5" />
            Room {roomIndex + 1}
            {roomBooking.roomTypeName && (
              <span className="text-sm font-medium text-gray-600">
                - {roomBooking.roomTypeName}
              </span>
            )}
          </button>
          {roomBooking.guestDetails.primaryGuest.name && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {roomBooking.guestDetails.primaryGuest.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-gray-900">
            ₹{calculateRoomTotal().toLocaleString()}
          </span>
          {canRemove && (
            <button aria-label="Delete"
              onClick={onRemove}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Remove Room"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Room Form Content */}
      {isExpanded && (
        <div className="p-6 space-y-6">
          {/* Room Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Room Type *
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {roomTypes.map((roomType) => (
                <button
                  key={roomType._id}
                  onClick={() => handleRoomTypeChange(roomType._id)}
                  className={`p-4 border-2 rounded-lg text-left transition-colors ${
                    roomBooking.roomTypeId === roomType._id
                      ? 'border-indigo-600 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-gray-900">{roomType.name}</div>
                  <div className="text-sm text-gray-600 mt-1">{roomType.description}</div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-lg font-bold text-indigo-600">
                      ₹{roomType.basePrice}/night
                    </span>
                    <span className="text-xs text-gray-500">
                      Max {roomType.maxOccupancy} guests
                    </span>
                  </div>
                </button>
              ))}
            </div>
            {validationErrors.roomType && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.roomType}</p>
            )}
          </div>

          {/* Guest Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
              <Users className="h-5 w-5" />
              Guest Information
            </h3>

            {/* Guest Count */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Total Guests *
              </label>
              <div className="flex items-center gap-3">
                <button aria-label="Close"
                  onClick={() => handleGuestCountChange(Math.max(1, roomBooking.guestDetails.totalGuests - 1))}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  disabled={roomBooking.guestDetails.totalGuests <= 1}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="text-xl font-semibold text-gray-900 min-w-[3rem] text-center">
                  {roomBooking.guestDetails.totalGuests}
                </span>
                <button aria-label="Add"
                  onClick={() => handleGuestCountChange(roomBooking.guestDetails.totalGuests + 1)}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <span className="text-sm text-gray-600 ml-2">
                  {roomBooking.guestDetails.totalGuests === 1 ? 'guest' : 'guests'}
                </span>
              </div>
              {validationErrors.totalGuests && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.totalGuests}</p>
              )}
            </div>

            {/* Primary Guest */}
            <div className="bg-blue-50 p-4 rounded-lg mb-4">
              <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <User className="h-4 w-4" />
                Primary Guest
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={roomBooking.guestDetails.primaryGuest.name}
                    onChange={(e) => onUpdate({
                      guestDetails: {
                        ...roomBooking.guestDetails,
                        primaryGuest: {
                          ...roomBooking.guestDetails.primaryGuest,
                          name: e.target.value
                        }
                      }
                    })}
                    placeholder="Enter guest name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                  />
                  {validationErrors.primaryGuestName && (
                    <p className="mt-1 text-sm text-red-600">{validationErrors.primaryGuestName}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={roomBooking.guestDetails.primaryGuest.email}
                    onChange={(e) => onUpdate({
                      guestDetails: {
                        ...roomBooking.guestDetails,
                        primaryGuest: {
                          ...roomBooking.guestDetails.primaryGuest,
                          email: e.target.value
                        }
                      }
                    })}
                    placeholder="Enter email address"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                  />
                  {validationErrors.primaryGuestEmail && (
                    <p className="mt-1 text-sm text-red-600">{validationErrors.primaryGuestEmail}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone *
                  </label>
                  <input
                    type="tel"
                    value={roomBooking.guestDetails.primaryGuest.phone}
                    onChange={(e) => onUpdate({
                      guestDetails: {
                        ...roomBooking.guestDetails,
                        primaryGuest: {
                          ...roomBooking.guestDetails.primaryGuest,
                          phone: e.target.value
                        }
                      }
                    })}
                    placeholder="Enter phone number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                  />
                  {validationErrors.primaryGuestPhone && (
                    <p className="mt-1 text-sm text-red-600">{validationErrors.primaryGuestPhone}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Additional Guests */}
            {roomBooking.guestDetails.additionalGuests.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  Additional Guests
                </h4>
                <div className="space-y-3">
                  {roomBooking.guestDetails.additionalGuests.map((guest, index) => (
                    <div key={`roomBooking-guestDetails-additionalGuests-${index}-${guest.name}`} className="grid grid-cols-1 md:grid-cols-2 gap-4 p-3 border border-gray-200 rounded-lg">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Guest {index + 2} Name
                        </label>
                        <input
                          type="text"
                          value={guest.name}
                          onChange={(e) => handleAdditionalGuestChange(index, 'name', e.target.value)}
                          placeholder="Enter guest name"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Age
                        </label>
                        <input
                          type="number"
                          value={guest.age}
                          onChange={(e) => handleAdditionalGuestChange(index, 'age', parseInt(e.target.value) || 0)}
                          placeholder="Age"
                          min="0"
                          max="120"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Add-ons */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
              <Gift className="h-5 w-5" />
              Add-ons & Extras
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableAddOns.map((addOn) => (
                <div key={addOn.name} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900">{addOn.name}</h4>
                    <span className="text-sm font-medium text-gray-600">
                      ₹{addOn.price}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button aria-label="Add"
                      onClick={() => handleAddOnChange(addOn.name, Math.max(0, getAddOnQuantity(addOn.name) - 1))}
                      className="p-1 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                      disabled={getAddOnQuantity(addOn.name) === 0}
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="text-sm font-medium text-gray-900 min-w-[2rem] text-center">
                      {getAddOnQuantity(addOn.name)}
                    </span>
                    <button aria-label="Add"
                      onClick={() => handleAddOnChange(addOn.name, getAddOnQuantity(addOn.name) + 1)}
                      className="p-1 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Special Requests */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Special Requests (Optional)
            </label>
            <textarea
              value={roomBooking.specialRequests || ''}
              onChange={(e) => onUpdate({ specialRequests: e.target.value })}
              placeholder="Any special requests for this room..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
            />
          </div>

          {/* Validation Button */}
          <div className="flex justify-end">
            <button aria-label="Close"
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                isFormValid
                  ? 'bg-green-100 text-green-700'
                  : 'bg-yellow-100 text-yellow-700'
              }`}
            >
              {isFormValid ? (
                <>
                  <Check className="h-4 w-4" />
                  Room Valid
                </>
              ) : (
                <>
                  <X className="h-4 w-4" />
                  Please Complete Required Fields
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default MultiBookingForm;
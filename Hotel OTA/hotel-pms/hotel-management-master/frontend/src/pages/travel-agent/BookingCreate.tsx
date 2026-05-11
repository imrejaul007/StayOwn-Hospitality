import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Calendar,
  Users,
  MapPin,
  Phone,
  Mail,
  CreditCard,
  Check,
  Plus,
  Minus,
  AlertCircle,
  CheckCircle,
  Clock,
  Star,
  Bed,
  Wifi,
  Car,
  Coffee,
  Shield
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { format, addDays, differenceInDays } from 'date-fns';
import { toast } from 'sonner';
import { travelAgentService, TravelAgentBooking } from '../../services/travelAgentService';
import { withErrorBoundary } from '../../components/ErrorBoundary';
import { api } from '../../services/api';
import { useProperty } from '../../context/PropertyContext';

interface GuestInfo {
  name: string;
  email: string;
  phone: string;
  address: string;
  specialRequests: string;
}

interface RoomSelection {
  roomTypeId: string;
  roomTypeName: string;
  quantity: number;
  standardRate: number;
  specialRate?: number;
  maxOccupancy: number;
  amenities: string[];
  description: string;
}

interface BookingFormData {
  checkIn: string;
  checkOut: string;
  guestInfo: GuestInfo;
  rooms: RoomSelection[];
  totalGuests: number;
  paymentMethod: 'credit_card' | 'bank_transfer' | 'cash' | 'corporate_credit';
  specialConditions: {
    earlyCheckin: boolean;
    lateCheckout: boolean;
    roomUpgrade: boolean;
    specialRequests: string;
  };
}

const BookingCreate: React.FC = () => {
  const navigate = useNavigate();
  const { selectedPropertyId } = useProperty();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [availableRooms, setAvailableRooms] = useState<RoomSelection[]>([]);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [confirmationDetails, setConfirmationDetails] = useState<TravelAgentBooking | null>(null);

  const [formData, setFormData] = useState<BookingFormData>({
    checkIn: format(new Date(), 'yyyy-MM-dd'),
    checkOut: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    guestInfo: {
      name: '',
      email: '',
      phone: '',
      address: '',
      specialRequests: ''
    },
    rooms: [],
    totalGuests: 1,
    paymentMethod: 'credit_card',
    specialConditions: {
      earlyCheckin: false,
      lateCheckout: false,
      roomUpgrade: false,
      specialRequests: ''
    }
  });

  useEffect(() => {
    fetchAvailableRooms();
  }, [formData.checkIn, formData.checkOut, selectedPropertyId]);

  const fetchAvailableRooms = async () => {
    try {
      setLoading(true);

      if (!selectedPropertyId) {
        toast.error('Please select a property before creating a booking');
        setAvailableRooms([]);
        return;
      }

      // Fetch real room types from the backend
      const response = await api.get(`/room-types/hotel/${selectedPropertyId}`, { params: { limit: 100 } });
      const rawRoomTypes = response.data?.data?.roomTypes || response.data?.data || response.data?.roomTypes || [];

      if (!Array.isArray(rawRoomTypes) || rawRoomTypes.length === 0) {
        setAvailableRooms([]);
        return;
      }

      const mapped: RoomSelection[] = rawRoomTypes.map((rt: Record<string, unknown>) => {
        const baseRate = (rt.basePrice as number) || (rt.baseRate as number) || (rt.ratePerNight as number) || 0;
        const agentRate = Math.round(baseRate * 0.9); // 10% agent discount
        return {
          roomTypeId: (rt._id as string) || (rt.id as string) || '',
          roomTypeName: (rt.name as string) || (rt.displayName as string) || 'Room',
          quantity: 0,
          standardRate: baseRate,
          specialRate: agentRate,
          maxOccupancy: (rt.maxOccupancy as number) || (rt.capacity as number) || 2,
          amenities: (rt.amenities as string[]) || [],
          description: (rt.description as string) || ''
        };
      });

      setAvailableRooms(mapped);
    } catch (error) {
      toast.error('Failed to load available rooms');
      setAvailableRooms([]);
    } finally {
      setLoading(false);
    }
  };

  const nights = differenceInDays(new Date(formData.checkOut), new Date(formData.checkIn));

  const handleRoomQuantityChange = (roomTypeId: string, change: number) => {
    setFormData(prev => ({
      ...prev,
      rooms: prev.rooms.map(room =>
        room.roomTypeId === roomTypeId
          ? { ...room, quantity: Math.max(0, room.quantity + change) }
          : room
      )
    }));
  };

  const addRoomType = (roomType: Record<string, unknown>) => {
    const existingRoom = formData.rooms.find(r => r.roomTypeId === roomType.roomTypeId);
    if (existingRoom) {
      handleRoomQuantityChange(roomType.roomTypeId, 1);
    } else {
      setFormData(prev => ({
        ...prev,
        rooms: [...prev.rooms, { ...roomType, quantity: 1 }]
      }));
    }
  };

  const removeRoomType = (roomTypeId: string) => {
    setFormData(prev => ({
      ...prev,
      rooms: prev.rooms.filter(room => room.roomTypeId !== roomTypeId)
    }));
  };

  const calculateTotalAmount = () => {
    return formData.rooms.reduce((total, room) => {
      const rate = room.specialRate || room.standardRate;
      return total + (rate * room.quantity * nights);
    }, 0);
  };

  const calculateCommission = () => {
    const totalAmount = calculateTotalAmount();
    const commissionRate = 10; // Default 10% commission
    return (totalAmount * commissionRate) / 100;
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);

      const bookingData = {
        guestDetails: {
          primaryGuest: {
            name: formData.guestInfo.name,
            email: formData.guestInfo.email,
            phone: formData.guestInfo.phone
          },
          totalGuests: formData.totalGuests,
          totalRooms: formData.rooms.reduce((sum, room) => sum + room.quantity, 0)
        },
        bookingDetails: {
          checkIn: new Date(formData.checkIn),
          checkOut: new Date(formData.checkOut),
          nights,
          roomTypes: formData.rooms.map(room => ({
            roomTypeId: room.roomTypeId,
            quantity: room.quantity,
            ratePerNight: room.standardRate,
            specialRate: room.specialRate
          }))
        },
        pricing: {
          subtotal: calculateTotalAmount(),
          taxes: calculateTotalAmount() * 0.12,
          fees: 25,
          discounts: 0,
          totalAmount: calculateTotalAmount() * 1.12 + 25,
          specialRateDiscount: formData.rooms.reduce((sum, room) => {
            if (room.specialRate) {
              return sum + ((room.standardRate - room.specialRate) * room.quantity * nights);
            }
            return sum;
          }, 0)
        },
        paymentDetails: {
          method: formData.paymentMethod,
          status: 'pending'
        },
        specialConditions: formData.specialConditions
      };

      const booking = await travelAgentService.createSingleBooking(bookingData);
      setConfirmationDetails(booking);
      setBookingConfirmed(true);
      setStep(4);
      toast.success('Booking created successfully!');
    } catch (error) {
      toast.error('Failed to create booking. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getAmenityIcon = (amenity: string) => {
    switch (amenity.toLowerCase()) {
      case 'free wifi':
        return <Wifi className="h-4 w-4" />;
      case 'room service':
        return <Coffee className="h-4 w-4" />;
      case 'balcony':
        return <MapPin className="h-4 w-4" />;
      case 'parking':
        return <Car className="h-4 w-4" />;
      default:
        return <Star className="h-4 w-4" />;
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      {[1, 2, 3, 4].map((stepNum) => (
        <div key={stepNum} className="flex items-center">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
            stepNum <= step ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-600'
          }`}>
            {stepNum < step ? <Check className="h-5 w-5" /> : stepNum}
          </div>
          {stepNum < 4 && (
            <div className={`w-16 h-1 ${stepNum < step ? 'bg-indigo-600' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  );

  if (bookingConfirmed && confirmationDetails) {
    return (
      <div className="min-h-screen bg-gray-50 py-6">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg shadow-sm p-8 text-center"
          >
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Booking Confirmed!</h1>
            <p className="text-gray-600 mb-6">
              Your booking has been successfully created and confirmed.
            </p>

            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Booking Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                <div>
                  <p className="text-sm text-gray-600">Confirmation Number</p>
                  <p className="font-semibold">{confirmationDetails.confirmationNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Guest Name</p>
                  <p className="font-semibold">{confirmationDetails.guestDetails.primaryGuest.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Check-in Date</p>
                  <p className="font-semibold">
                    {format(new Date(confirmationDetails.bookingDetails.checkIn), 'MMM dd, yyyy')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Check-out Date</p>
                  <p className="font-semibold">
                    {format(new Date(confirmationDetails.bookingDetails.checkOut), 'MMM dd, yyyy')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Amount</p>
                  <p className="font-semibold text-green-600">
                    ₹{confirmationDetails.pricing.totalAmount.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Your Commission</p>
                  <p className="font-semibold text-indigo-600">
                    ₹{(confirmationDetails.commission.amount + (confirmationDetails.commission.bonusAmount || 0)).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-4 justify-center">
              <button
                onClick={() => navigate('/travel-agent')}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Back to Dashboard
              </button>
              <button
                onClick={() => window.print()}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Print Confirmation
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button aria-label="Previous"
                onClick={() => navigate('/travel-agent')}
                className="p-2 text-gray-600 hover:text-indigo-600 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Create New Booking</h1>
                <p className="text-gray-600">Book accommodations for your clients</p>
              </div>
            </div>
          </div>
        </div>

        {/* Step Indicator */}
        {renderStepIndicator()}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2">
            {/* Step 1: Dates and Guests */}
            {step === 1 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white rounded-lg shadow-sm p-6"
              >
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Select Dates and Guests</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Check-in Date
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="date"
                        value={formData.checkIn}
                        onChange={(e) => setFormData(prev => ({ ...prev, checkIn: e.target.value }))}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                        min={format(new Date(), 'yyyy-MM-dd')}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Check-out Date
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="date"
                        value={formData.checkOut}
                        onChange={(e) => setFormData(prev => ({ ...prev, checkOut: e.target.value }))}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                        min={formData.checkIn}
                      />
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Total Guests
                  </label>
                  <div className="relative">
                    <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="number"
                      value={formData.totalGuests}
                      onChange={(e) => setFormData(prev => ({ ...prev, totalGuests: parseInt(e.target.value) || 1 }))}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                      min="1"
                      max="20"
                    />
                  </div>
                </div>

                <div className="bg-indigo-50 rounded-lg p-4 mb-6">
                  <div className="flex items-center gap-2 text-indigo-700">
                    <Clock className="h-5 w-5" />
                    <span className="font-medium">Stay Duration: {nights} night{nights !== 1 ? 's' : ''}</span>
                  </div>
                </div>

                <button
                  onClick={() => setStep(2)}
                  disabled={!formData.checkIn || !formData.checkOut || nights < 1}
                  className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Continue to Room Selection
                </button>
              </motion.div>
            )}

            {/* Step 2: Room Selection */}
            {step === 2 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white rounded-lg shadow-sm p-6"
              >
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Select Rooms</h2>

                {availableRooms.length === 0 && !loading && (
                  <div className="text-center py-8 mb-6">
                    <Bed className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-600 font-medium">No room types available</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Room types are not configured yet. Please contact the hotel administrator.
                    </p>
                  </div>
                )}

                <div className="space-y-4 mb-6">
                  {availableRooms.map((room) => {
                    const selectedRoom = formData.rooms.find(r => r.roomTypeId === room.roomTypeId);
                    const savings = room.specialRate ? (room.standardRate - room.specialRate) * nights : 0;

                    return (
                      <div
                        key={room.roomTypeId}
                        className="border border-gray-200 rounded-lg p-4 hover:border-indigo-300 transition-colors"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Bed className="h-5 w-5 text-gray-600" />
                              <h3 className="font-semibold text-gray-900">{room.roomTypeName}</h3>
                              {room.specialRate && (
                                <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                                  Special Rate
                                </span>
                              )}
                            </div>
                            <p className="text-gray-600 text-sm mb-2">{room.description}</p>
                            <div className="flex flex-wrap gap-2 mb-2">
                              {room.amenities.map((amenity, index) => (
                                <span
                                  key={`room-amenities-${index}-${amenity}`}
                                  className="flex items-center gap-1 text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded"
                                >
                                  {getAmenityIcon(amenity)}
                                  {amenity}
                                </span>
                              ))}
                            </div>
                            <p className="text-sm text-gray-600">Max occupancy: {room.maxOccupancy} guests</p>
                          </div>

                          <div className="text-right">
                            <div className="flex flex-col items-end gap-1">
                              {room.specialRate ? (
                                <>
                                  <span className="text-sm text-gray-500 line-through">
                                    ₹{room.standardRate}/night
                                  </span>
                                  <span className="text-lg font-bold text-green-600">
                                    ₹{room.specialRate}/night
                                  </span>
                                  <span className="text-xs text-green-600">
                                    Save ₹{savings} total
                                  </span>
                                </>
                              ) : (
                                <span className="text-lg font-bold text-gray-900">
                                  ₹{room.standardRate}/night
                                </span>
                              )}
                            </div>

                            {selectedRoom ? (
                              <div className="flex items-center gap-2 mt-3">
                                <button aria-label="Close"
                                  onClick={() => handleRoomQuantityChange(room.roomTypeId, -1)}
                                  className="p-1 border border-gray-300 rounded hover:bg-gray-50"
                                >
                                  <Minus className="h-4 w-4" />
                                </button>
                                <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded">
                                  {selectedRoom.quantity}
                                </span>
                                <button aria-label="Add"
                                  onClick={() => handleRoomQuantityChange(room.roomTypeId, 1)}
                                  className="p-1 border border-gray-300 rounded hover:bg-gray-50"
                                >
                                  <Plus className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => removeRoomType(room.roomTypeId)}
                                  className="ml-2 text-red-600 hover:text-red-800"
                                >
                                  Remove
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => addRoomType(room)}
                                className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                              >
                                Add Room
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(1)}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    disabled={formData.rooms.length === 0}
                    className="flex-1 bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Continue to Guest Details
                  </button>
                </div>
              </motion.div>
            )}

            {/* Step 3: Guest Information */}
            {step === 3 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white rounded-lg shadow-sm p-6"
              >
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Guest Information</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={formData.guestInfo.name}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        guestInfo: { ...prev.guestInfo, name: e.target.value }
                      }))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                      placeholder="Enter guest full name"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address *
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="email"
                        value={formData.guestInfo.email}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          guestInfo: { ...prev.guestInfo, email: e.target.value }
                        }))}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                        placeholder="guest@example.com"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number *
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input
                        type="tel"
                        value={formData.guestInfo.phone}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          guestInfo: { ...prev.guestInfo, phone: e.target.value }
                        }))}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                        placeholder="+1 (555) 123-4567"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Payment Method
                    </label>
                    <div className="relative">
                      <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <select
                        value={formData.paymentMethod}
                        onChange={(e) => setFormData(prev => ({ ...prev, paymentMethod: e.target.value as string }))}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                      >
                        <option value="credit_card">Credit Card</option>
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="cash">Cash</option>
                        <option value="corporate_credit">Corporate Credit</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <textarea
                      value={formData.guestInfo.address}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        guestInfo: { ...prev.guestInfo, address: e.target.value }
                      }))}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                      placeholder="Enter guest address"
                      rows={3}
                    />
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Special Conditions
                  </label>
                  <div className="space-y-3">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.specialConditions.earlyCheckin}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          specialConditions: { ...prev.specialConditions, earlyCheckin: e.target.checked }
                        }))}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">Early Check-in (before 3 PM)</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.specialConditions.lateCheckout}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          specialConditions: { ...prev.specialConditions, lateCheckout: e.target.checked }
                        }))}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">Late Check-out (after 12 PM)</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.specialConditions.roomUpgrade}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          specialConditions: { ...prev.specialConditions, roomUpgrade: e.target.checked }
                        }))}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">Request Room Upgrade (subject to availability)</span>
                    </label>
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Special Requests
                  </label>
                  <textarea
                    value={formData.specialConditions.specialRequests}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      specialConditions: { ...prev.specialConditions, specialRequests: e.target.value }
                    }))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                    placeholder="Any special requests or requirements..."
                    rows={3}
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(2)}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Back
                  </button>
                  <button aria-label="Close"
                    onClick={handleSubmit}
                    disabled={!formData.guestInfo.name || !formData.guestInfo.email || !formData.guestInfo.phone || loading}
                    className="flex-1 bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-white" />
                        Creating Booking...
                      </>
                    ) : (
                      <>
                        <Shield className="h-5 w-5" />
                        Confirm Booking
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </div>

          {/* Booking Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Booking Summary</h3>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Check-in</span>
                  <span className="font-medium">
                    {format(new Date(formData.checkIn), 'MMM dd, yyyy')}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Check-out</span>
                  <span className="font-medium">
                    {format(new Date(formData.checkOut), 'MMM dd, yyyy')}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Nights</span>
                  <span className="font-medium">{nights}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Guests</span>
                  <span className="font-medium">{formData.totalGuests}</span>
                </div>
              </div>

              {formData.rooms.length > 0 && (
                <>
                  <div className="border-t border-gray-200 pt-4 mb-4">
                    <h4 className="font-medium text-gray-900 mb-3">Selected Rooms</h4>
                    <div className="space-y-3">
                      {formData.rooms.map((room) => {
                        const rate = room.specialRate || room.standardRate;
                        const totalCost = rate * room.quantity * nights;
                        return (
                          <div key={room.roomTypeId} className="text-sm">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <p className="font-medium text-gray-900">{room.roomTypeName}</p>
                                <p className="text-gray-600">
                                  {room.quantity} room{room.quantity > 1 ? 's' : ''} × {nights} night{nights > 1 ? 's' : ''}
                                </p>
                                <p className="text-gray-600">
                                  ₹{rate}/night
                                  {room.specialRate && (
                                    <span className="text-green-600 ml-1">(Special Rate)</span>
                                  )}
                                </p>
                              </div>
                              <span className="font-medium">₹{totalCost.toLocaleString()}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Subtotal</span>
                      <span>₹{calculateTotalAmount().toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Taxes (12%)</span>
                      <span>₹{(calculateTotalAmount() * 0.12).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Service Fee</span>
                      <span>₹25</span>
                    </div>
                    <div className="flex justify-between font-semibold text-lg border-t border-gray-200 pt-2">
                      <span>Total</span>
                      <span>₹{(calculateTotalAmount() * 1.12 + 25).toLocaleString()}</span>
                    </div>

                    <div className="bg-indigo-50 rounded-lg p-3 mt-4">
                      <div className="flex items-center gap-2 text-indigo-700 mb-1">
                        <Star className="h-4 w-4" />
                        <span className="font-medium text-sm">Your Commission</span>
                      </div>
                      <p className="text-lg font-bold text-indigo-600">
                        ₹{calculateCommission().toLocaleString()}
                      </p>
                      <p className="text-xs text-indigo-600">10% commission rate</p>
                    </div>
                  </div>
                </>
              )}

              {formData.rooms.length === 0 && step >= 2 && (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 text-sm">No rooms selected</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default withErrorBoundary(BookingCreate, { level: 'page' });
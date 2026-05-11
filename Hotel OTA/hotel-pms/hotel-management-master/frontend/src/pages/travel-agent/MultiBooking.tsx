import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Users,
  Plus,
  Minus,
  Building,
  Banknote,
  CheckCircle,
  AlertCircle,
  Clock,
  ArrowLeft,
  Save,
  CreditCard,
  FileText,
  UserCheck,
  MapPin
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { format, addDays } from 'date-fns';
import { toast } from 'sonner';
import MultiBookingForm from '../../components/travel-agent/MultiBookingForm';
import BulkPricingCalculator from '../../components/travel-agent/BulkPricingCalculator';
import GroupReservationManager from '../../components/travel-agent/GroupReservationManager';
import { travelAgentService } from '../../services/travelAgentService';
import { useProperty } from '../../context/PropertyContext';
import { withErrorBoundary } from '../../components/ErrorBoundary';

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
    additionalGuests: Array<{
      name: string;
      age: number;
    }>;
    totalGuests: number;
  };
  specialRequests?: string;
  addOns: Array<{
    name: string;
    price: number;
    quantity: number;
  }>;
  ratePerNight: number;
  specialRate?: number;
}

interface BookingDates {
  checkIn: Date;
  checkOut: Date;
  nights: number;
}

interface BulkPricing {
  subtotal: number;
  taxes: number;
  fees: number;
  discounts: number;
  totalAmount: number;
  commissionAmount: number;
  roomBreakdown: Array<{
    roomId: string;
    roomTotal: number;
    commission: number;
  }>;
}

const MultiBooking: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<'details' | 'review' | 'confirm'>('details');
  const [loading, setLoading] = useState(false);
  const { selectedPropertyId } = useProperty();
  const hotelId = selectedPropertyId || '';

  // Form state
  const [bookingDates, setBookingDates] = useState<BookingDates>({
    checkIn: addDays(new Date(), 1), // Default to tomorrow
    checkOut: addDays(new Date(), 3), // Default to day after tomorrow
    nights: 2
  });

  const [roomBookings, setRoomBookings] = useState<RoomBooking[]>([
    {
      id: '1',
      roomTypeId: '68cd01414419c17b5f6b4c1d', // Deluxe Room ObjectId
      roomTypeName: 'Deluxe Room',
      guestDetails: {
        primaryGuest: {
          name: '',
          email: '',
          phone: ''
        },
        additionalGuests: [],
        totalGuests: 1
      },
      addOns: [],
      ratePerNight: 5000 // Deluxe Room base rate
    }
  ]);

  const [bulkPricing, setBulkPricing] = useState<BulkPricing>({
    subtotal: 0,
    taxes: 0,
    fees: 0,
    discounts: 0,
    totalAmount: 0,
    commissionAmount: 0,
    roomBreakdown: []
  });

  const [paymentMethod, setPaymentMethod] = useState<'credit' | 'invoice' | 'deposit'>('credit');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [confirmationNumber, setConfirmationNumber] = useState('');

  useEffect(() => {
    calculateBulkPricing();
  }, [roomBookings, bookingDates]);

  const calculateBulkPricing = async () => {
    try {
      if (roomBookings.some(room => !room.roomTypeId)) return;

      const pricing = await travelAgentService.calculateBulkPricing({
        hotelId,
        checkIn: bookingDates.checkIn,
        checkOut: bookingDates.checkOut,
        rooms: roomBookings.map(room => ({
          roomTypeId: room.roomTypeId,
          guests: room.guestDetails.totalGuests,
          addOns: room.addOns
        }))
      });

      setBulkPricing(pricing);
    } catch {
      // Error handled silently
    }
  };

  const addRoomBooking = () => {
    const newRoom: RoomBooking = {
      id: Date.now().toString(),
      roomTypeId: '',
      roomTypeName: '',
      guestDetails: {
        primaryGuest: {
          name: '',
          email: '',
          phone: ''
        },
        additionalGuests: [],
        totalGuests: 1
      },
      addOns: [],
      ratePerNight: 0
    };
    setRoomBookings([...roomBookings, newRoom]);
  };

  const removeRoomBooking = (roomId: string) => {
    if (roomBookings.length > 1) {
      setRoomBookings(roomBookings.filter(room => room.id !== roomId));
    }
  };

  const updateRoomBooking = (roomId: string, updates: Partial<RoomBooking>) => {
    setRoomBookings(roomBookings.map(room =>
      room.id === roomId ? { ...room, ...updates } : room
    ));
  };

  const handleSubmitBooking = async () => {
    try {
      setLoading(true);

      const multiBookingData = {
        hotelId,
        bookingDates,
        roomBookings,
        paymentMethod,
        specialInstructions,
        bulkPricing
      };

      const result = await travelAgentService.createMultiBooking(multiBookingData);
      setConfirmationNumber(result.confirmationNumber);
      setCurrentStep('confirm');

      toast.success('Multi-booking created successfully!');
    } catch (error) {
      toast.error('Failed to create multi-booking');
    } finally {
      setLoading(false);
    }
  };

  const validateStep = () => {
    if (currentStep === 'details') {
      return roomBookings.every(room =>
        room.roomTypeId &&
        room.guestDetails.primaryGuest.name &&
        room.guestDetails.primaryGuest.email &&
        room.guestDetails.primaryGuest.phone
      );
    }
    return true;
  };

  const stepProgress = {
    details: 33,
    review: 67,
    confirm: 100
  };

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button aria-label="Previous"
                onClick={() => navigate('/travel-agent')}
                className="p-2 text-gray-600 hover:text-indigo-600 transition-colors"
              >
                <ArrowLeft className="h-6 w-6" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Multi-Room Booking</h1>
                <p className="text-gray-600 mt-2">
                  Create group reservations with multiple rooms efficiently
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Progress:</span>
              <div className="w-32 bg-gray-200 rounded-full h-2">
                <div
                  className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${stepProgress[currentStep]}%` }}
                />
              </div>
              <span className="text-sm font-medium text-indigo-600">
                {stepProgress[currentStep]}%
              </span>
            </div>
          </div>

          {/* Step Indicator */}
          <div className="mt-6">
            <div className="flex items-center justify-center space-x-8">
              {[
                { key: 'details', label: 'Booking Details', icon: FileText },
                { key: 'review', label: 'Review & Pricing', icon: Banknote },
                { key: 'confirm', label: 'Confirmation', icon: CheckCircle }
              ].map(({ key, label, icon: Icon }) => (
                <div key={key} className="flex items-center">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                    currentStep === key
                      ? 'bg-indigo-600 text-white'
                      : stepProgress[currentStep] > stepProgress[key as keyof typeof stepProgress]
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className={`ml-3 text-sm font-medium ${
                    currentStep === key ? 'text-indigo-600' : 'text-gray-600'
                  }`}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            <AnimatePresence mode="wait">
              {currentStep === 'details' && (
                <motion.div
                  key="details"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  {/* Booking Dates */}
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Booking Dates
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Check-in Date
                        </label>
                        <input
                          type="date"
                          value={format(bookingDates.checkIn, 'yyyy-MM-dd')}
                          min={format(new Date(), 'yyyy-MM-dd')} // Prevent selecting past dates
                          onChange={(e) => {
                            const checkIn = new Date(e.target.value);
                            const nights = Math.ceil((bookingDates.checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
                            setBookingDates({
                              checkIn,
                              checkOut: bookingDates.checkOut,
                              nights: Math.max(1, nights)
                            });
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Check-out Date
                        </label>
                        <input
                          type="date"
                          value={format(bookingDates.checkOut, 'yyyy-MM-dd')}
                          min={format(addDays(bookingDates.checkIn, 1), 'yyyy-MM-dd')} // Must be after check-in
                          onChange={(e) => {
                            const checkOut = new Date(e.target.value);
                            const nights = Math.ceil((checkOut.getTime() - bookingDates.checkIn.getTime()) / (1000 * 60 * 60 * 24));
                            setBookingDates({
                              checkIn: bookingDates.checkIn,
                              checkOut,
                              nights: Math.max(1, nights)
                            });
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                          required
                        />
                      </div>
                      <div className="flex items-end">
                        <div className="w-full">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Total Nights
                          </label>
                          <div className="bg-gray-50 px-3 py-2 border border-gray-300 rounded-lg">
                            <span className="text-lg font-semibold text-gray-900">
                              {bookingDates.nights}
                            </span>
                            <span className="text-sm text-gray-600 ml-1">
                              {bookingDates.nights === 1 ? 'night' : 'nights'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Room Bookings */}
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <Building className="h-5 w-5" />
                        Room Bookings ({roomBookings.length})
                      </h2>
                      <button
                        onClick={addRoomBooking}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                      >
                        <Plus className="h-4 w-4" />
                        Add Room
                      </button>
                    </div>

                    <div className="space-y-6">
                      {roomBookings.map((room, index) => (
                        <MultiBookingForm
                          key={room.id}
                          roomBooking={room}
                          roomIndex={index}
                          onUpdate={(updates) => updateRoomBooking(room.id, updates)}
                          onRemove={() => removeRoomBooking(room.id)}
                          canRemove={roomBookings.length > 1}
                          hotelId={hotelId}
                          checkIn={bookingDates.checkIn}
                          checkOut={bookingDates.checkOut}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {currentStep === 'review' && (
                <motion.div
                  key="review"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <GroupReservationManager
                    roomBookings={roomBookings}
                    bookingDates={bookingDates}
                    bulkPricing={bulkPricing}
                    hotelId={hotelId}
                  />

                  {/* Payment Method */}
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Payment Method
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {[
                        { key: 'credit', label: 'Credit Card', desc: 'Pay immediately with credit card' },
                        { key: 'invoice', label: 'Invoice', desc: 'Request invoice for later payment' },
                        { key: 'deposit', label: 'Deposit', desc: 'Pay partial amount now' }
                      ].map(({ key, label, desc }) => (
                        <button aria-label="Close"
                          key={key}
                          onClick={() => setPaymentMethod(key as typeof paymentMethod)}
                          className={`p-4 border-2 rounded-lg text-left transition-colors ${
                            paymentMethod === key
                              ? 'border-indigo-600 bg-indigo-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="font-medium text-gray-900">{label}</div>
                          <div className="text-sm text-gray-600 mt-1">{desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Special Instructions */}
                  <div className="bg-white rounded-lg shadow-sm p-6">
                    <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Special Instructions
                    </h2>
                    <textarea
                      value={specialInstructions}
                      onChange={(e) => setSpecialInstructions(e.target.value)}
                      placeholder="Any special requests or instructions for this group booking..."
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent"
                    />
                  </div>
                </motion.div>
              )}

              {currentStep === 'confirm' && (
                <motion.div
                  key="confirm"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white rounded-lg shadow-sm p-8 text-center"
                >
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">
                    Multi-Booking Confirmed!
                  </h2>
                  <p className="text-gray-600 mb-6">
                    Your group reservation has been successfully created.
                  </p>
                  <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    <p className="text-sm text-gray-600 mb-2">Confirmation Number</p>
                    <p className="text-2xl font-bold text-indigo-600">{confirmationNumber}</p>
                  </div>
                  <div className="flex justify-center gap-4">
                    <button
                      onClick={() => navigate('/travel-agent')}
                      className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      Back to Dashboard
                    </button>
                    <button
                      onClick={() => navigate('/travel-agent?tab=bookings')}
                      className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      View My Bookings
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Pricing Summary */}
            <BulkPricingCalculator
              roomBookings={roomBookings}
              bookingDates={bookingDates}
              bulkPricing={bulkPricing}
              onPricingUpdate={setBulkPricing}
            />

            {/* Navigation */}
            {currentStep !== 'confirm' && (
              <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="space-y-4">
                  {currentStep === 'details' && (
                    <button
                      onClick={() => setCurrentStep('review')}
                      disabled={!validateStep()}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                      Continue to Review
                      <ArrowLeft className="h-4 w-4 rotate-180" />
                    </button>
                  )}

                  {currentStep === 'review' && (
                    <div className="space-y-3">
                      <button aria-label="Close"
                        onClick={handleSubmitBooking}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                      >
                        {loading ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                            Creating Booking...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4" />
                            Confirm Multi-Booking
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => setCurrentStep('details')}
                        className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Back to Details
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Booking Summary */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Booking Summary</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Rooms:</span>
                  <span className="font-medium">{roomBookings.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Nights:</span>
                  <span className="font-medium">{bookingDates.nights}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Guests:</span>
                  <span className="font-medium">
                    {roomBookings.reduce((sum, room) => sum + room.guestDetails.totalGuests, 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Check-in:</span>
                  <span className="font-medium">{format(bookingDates.checkIn, 'MMM dd, yyyy')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Check-out:</span>
                  <span className="font-medium">{format(bookingDates.checkOut, 'MMM dd, yyyy')}</span>
                </div>
                <div className="border-t pt-3 flex justify-between text-lg font-semibold">
                  <span>Total Amount:</span>
                  <span className="text-indigo-600">₹{bulkPricing.totalAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>Your Commission:</span>
                  <span className="font-medium">₹{bulkPricing.commissionAmount.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default withErrorBoundary(MultiBooking);
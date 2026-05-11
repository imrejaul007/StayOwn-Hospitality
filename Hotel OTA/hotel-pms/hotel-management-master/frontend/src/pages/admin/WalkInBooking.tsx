import React, { useState, useEffect, useRef} from 'react';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/Modal';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { adminService } from '../../services/adminService';
import { formatCurrency } from '../../utils/dashboardUtils';
import { useAuth } from '../../context/AuthContext';
import PaymentCollectionModal from '../../components/admin/PaymentCollectionModal';
import { withErrorBoundary } from '../../components/ErrorBoundary';
import {
  User,
  Home,
  Calendar,
  CreditCard,
  Phone,
  Mail,
  MapPin,
  Users,
  Baby,
  FileText,
  CheckCircle,
  AlertCircle,
  Search,
  UserPlus,
  Loader2
} from 'lucide-react';

interface WalkInBookingProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  prefilledData?: {
    roomNumber?: string;
    checkIn?: string;
    checkOut?: string;
    nights?: number;
  };
}

interface GuestForm {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  idType: 'passport' | 'driving_license' | 'national_id' | 'other';
  idNumber: string;
}

interface BookingForm {
  hotelId: string;
  roomIds: string[];
  checkIn: string;
  checkOut: string;
  guestDetails: {
    adults: number;
    children: number;
    specialRequests: string;
  };
  totalAmount: number;
  currency: string;
  paymentStatus: 'pending' | 'paid';
  status: 'checked_in';
}

function WalkInBooking({ isOpen, onClose, onSuccess, prefilledData }: WalkInBookingProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [availableRooms, setAvailableRooms] = useState<unknown[]>([]);
  const [hotels, setHotels] = useState<unknown[]>([]);
  const [selectedHotelId, setSelectedHotelId] = useState<string>('');

  // User selection mode - NEW or EXISTING
  const [guestMode, setGuestMode] = useState<'new' | 'existing'>('new');
  const [userSearch, setUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState<unknown[]>([]);
  const [selectedExistingUser, setSelectedExistingUser] = useState<Record<string, unknown> | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState<unknown>(null);

  // Form states
  const [guestForm, setGuestForm] = useState<GuestForm>({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    country: 'India',
    idType: 'passport',
    idNumber: ''
  });

  const [bookingForm, setBookingForm] = useState<BookingForm>({
    hotelId: '',
    roomIds: [],
    checkIn: prefilledData?.checkIn || new Date().toISOString().split('T')[0],
    checkOut: prefilledData?.checkOut || new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    guestDetails: {
      adults: 1,
      children: 0,
      specialRequests: ''
    },
    totalAmount: 0,
    currency: 'INR',
    paymentStatus: 'pending',
    status: 'checked_in'
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Sync prefilledData into bookingForm when modal opens or prefilledData changes
  useEffect(() => {
    if (isOpen && prefilledData) {
      setBookingForm(prev => ({
        ...prev,
        ...(prefilledData.checkIn ? { checkIn: prefilledData.checkIn } : {}),
        ...(prefilledData.checkOut ? { checkOut: prefilledData.checkOut } : {}),
      }));
    }
  }, [isOpen, prefilledData?.checkIn, prefilledData?.checkOut]);

  // Fetch hotels on component mount
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchHotels();
    }
  }, [isOpen]);

  // Fetch available rooms when dates or hotel changes
  useEffect(() => {
    if (bookingForm.hotelId && bookingForm.checkIn && bookingForm.checkOut) {
      fetchAvailableRooms();
    }
  }, [bookingForm.hotelId, bookingForm.checkIn, bookingForm.checkOut]);

  // Auto-select room when prefilled
  useEffect(() => {
    if (prefilledData?.roomNumber && availableRooms.length > 0 && bookingForm.roomIds.length === 0) {
      const matchingRoom = availableRooms.find(room =>
        room.roomNumber === prefilledData.roomNumber && room.isAvailable
      );

      if (matchingRoom) {
        setBookingForm(prev => ({
          ...prev,
          roomIds: [matchingRoom._id]
        }));
      } else {
        toast.error(`Room ${prefilledData.roomNumber} is not available for the selected dates`);
      }
    }
  }, [availableRooms, prefilledData?.roomNumber, bookingForm.roomIds.length]);

  // Debounce user search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (guestMode === 'existing' && userSearch) {
        searchUsers(userSearch);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [userSearch, guestMode]);

  const fetchHotels = async () => {
    try {
      const response = await adminService.getHotels();
      const hotelsList = response.data.hotels || [];
      setHotels(hotelsList);

      let selectedHotel = '';

      // Extract hotelId string — user.hotelId may be a populated object or a string
      const userHotelIdStr = typeof user?.hotelId === 'object' && user?.hotelId?._id
        ? String(user.hotelId._id)
        : user?.hotelId ? String(user.hotelId) : '';

      if (userHotelIdStr) {
        const userHotel = hotelsList.find((hotel: { _id: string }) => hotel._id === userHotelIdStr);
        if (userHotel) {
          selectedHotel = userHotelIdStr;
        }
      }

      if (!selectedHotel && hotelsList.length > 0) {
        selectedHotel = hotelsList[0]._id;
      }

      if (selectedHotel) {
        setSelectedHotelId(selectedHotel);
        setBookingForm(prev => ({
          ...prev,
          hotelId: selectedHotel
        }));
      } else {
        toast.error('No hotels available. Please contact administrator.');
      }
    } catch (error) {
      toast.error('Failed to load hotel information. Please try again.');
    }
  };

  const fetchAvailableRooms = async () => {
    try {
      const response = await adminService.getAvailableRooms(
        bookingForm.hotelId,
        bookingForm.checkIn,
        bookingForm.checkOut
      );

      const rooms = response.data.rooms || [];
      setAvailableRooms(rooms);
    } catch (error: unknown) {
      const axiosErr = error as { response?: { status?: number } };
      if (axiosErr.response?.status === 404) {
        toast.error('No rooms found for the selected hotel.');
      } else if (axiosErr.response?.status === 401) {
        toast.error('Please log in again to access room information.');
      } else {
        toast.error('Failed to fetch room availability. Please try again.');
      }

      setAvailableRooms([]);
    }
  };

  // Search for existing users - starts from first character
  const searchUsers = async (query: string) => {
    if (!query || query.trim().length === 0) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    try {
      setSearchLoading(true);

      // Include hotelId in search to ensure proper filtering
      const searchParams: Record<string, unknown> = {
        search: query,
        role: 'guest'
      };

      // Add hotelId if available (handle populated object or string)
      const hotelId = selectedHotelId ||
        (typeof user?.hotelId === 'object' && user?.hotelId?._id ? String(user.hotelId._id) : user?.hotelId ? String(user.hotelId) : '');
      if (hotelId) {
        searchParams.hotelId = hotelId;
      }

      const response = await adminService.getUsers(searchParams);
      setSearchResults(response.data.users || []);
    } catch (error) {
      setSearchResults([]);
      toast.error('Failed to search users');
    } finally {
      setSearchLoading(false);
    }
  };

  const validateGuestForm = () => {
    const newErrors: Record<string, string> = {};

    if (guestMode === 'existing') {
      if (!selectedExistingUser) {
        newErrors.user = 'Please select an existing guest';
      }
    } else {
      if (!guestForm.name.trim()) newErrors.name = 'Name is required';
      if (!guestForm.email.trim()) {
        newErrors.email = 'Email is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestForm.email)) {
        newErrors.email = 'Please enter a valid email address';
      }
      if (!guestForm.phone.trim()) newErrors.phone = 'Phone is required';
      if (!guestForm.address.trim()) newErrors.address = 'Address is required';
      if (!guestForm.city.trim()) newErrors.city = 'City is required';
      if (!guestForm.state.trim()) newErrors.state = 'State is required';
      if (!guestForm.idNumber.trim()) newErrors.idNumber = 'ID Number is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateBookingForm = () => {
    const newErrors: Record<string, string> = {};

    if (!bookingForm.hotelId) {
      newErrors.hotel = 'Please select a property';
    }
    if (!bookingForm.roomIds.length) {
      newErrors.rooms = 'Please select at least one room';
    }
    if (!bookingForm.checkIn) {
      newErrors.checkIn = 'Check-in date is required';
    }
    if (!bookingForm.checkOut) {
      newErrors.checkOut = 'Check-out date is required';
    }
    if (bookingForm.guestDetails.adults < 1) {
      newErrors.adults = 'At least one adult is required';
    }

    if (bookingForm.checkIn && bookingForm.checkOut) {
      const checkInDate = new Date(bookingForm.checkIn);
      const checkOutDate = new Date(bookingForm.checkOut);

      // Walk-in bookings must be for today or future
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (checkInDate < today) {
        newErrors.checkIn = 'Check-in date cannot be in the past';
      }

      if (checkInDate >= checkOutDate) {
        newErrors.checkOut = 'Check-out date must be after check-in date';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const calculateTotalAmount = () => {
    if (!bookingForm.checkIn || !bookingForm.checkOut || bookingForm.roomIds.length === 0) {
      return 0;
    }

    const checkInDate = new Date(bookingForm.checkIn);
    const checkOutDate = new Date(bookingForm.checkOut);
    const nights = Math.max(1, Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)));

    const selectedRooms = availableRooms.filter((room: any) => bookingForm.roomIds.includes(room._id) && room.isAvailable);
    const roomsTotal = selectedRooms.reduce((total: number, room: any) => total + (room.currentRate || 0), 0);

    return Math.round(roomsTotal * nights * 100) / 100;
  };

  const handleNext = () => {
    if (step === 1) {
      const isValid = validateGuestForm();
      if (!isValid) return;
    }
    if (step === 2) {
      const isValid = validateBookingForm();
      if (!isValid) return;
    }

    if (step === 3) {
      // Step 3 is summary, open payment modal
      setShowPaymentModal(true);
      return;
    }

    setStep(step + 1);
  };

  const handlePrevious = () => {
    setStep(step - 1);
  };

  // Handle payment confirmation from PaymentCollectionModal
  const handlePaymentConfirm = async (paymentData: Record<string, unknown>) => {
    setPaymentDetails(paymentData);
    setShowPaymentModal(false);

    // Proceed with booking creation
    await handleCreateBooking(paymentData);
  };

  const handleCreateBooking = async (paymentData: unknown = null) => {
    try {
      setLoading(true);

      let userId: string;
      let guestName: string;
      let guestEmail: string;
      let guestPhone: string;

      // Handle user based on mode
      if (guestMode === 'existing') {
        // Using existing user
        if (!selectedExistingUser) {
          toast.error('Please select an existing guest');
          return;
        }
        userId = selectedExistingUser._id;
        guestName = selectedExistingUser.name;
        guestEmail = selectedExistingUser.email;
        guestPhone = selectedExistingUser.phone || '';
      } else {
        // Create new user
        const userData = {
          name: guestForm.name,
          email: guestForm.email,
          phone: guestForm.phone,
          role: 'guest',
          password: Math.random().toString(36).substring(2, 15),
          preferences: {
            other: `Walk-in guest. Address: ${guestForm.address}, ${guestForm.city}, ${guestForm.state}, ${guestForm.country}. ID: ${guestForm.idType} - ${guestForm.idNumber}`
          }
        };

        try {
          const userResponse = await adminService.createUser(userData);
          userId = userResponse.data.user._id;
          guestName = guestForm.name;
          guestEmail = guestForm.email;
          guestPhone = guestForm.phone;
          toast.success('Guest account created successfully');
        } catch (userError: unknown) {
          const uerr = userError as { response?: { status?: number; data?: { message?: string } } };
          // Check if user already exists
          if (uerr.response?.status === 409 && uerr.response?.data?.message?.includes('already exists')) {
            try {
              const existingUsersResponse = await adminService.getUsers({ search: guestForm.email });
              const existingUser = existingUsersResponse.data.users.find((u: Record<string, unknown>) => u.email === guestForm.email);
              if (existingUser) {
                userId = existingUser._id;
                guestName = existingUser.name;
                guestEmail = existingUser.email;
                guestPhone = existingUser.phone || guestForm.phone;
                toast.info(`Using existing guest account for ${guestForm.email}`);
              } else {
                toast.error('User exists but could not retrieve details. Please try again.');
                return;
              }
            } catch (fetchError) {
              toast.error('Could not retrieve existing user details. Please try again.');
              return;
            }
          } else {
            toast.error(`User creation failed: ${uerr.response?.data?.message || 'Invalid user data'}`);
            return;
          }
        }
      }

      // Prepare payment details
      const totalAmount = calculateTotalAmount();
      let paymentStatus: 'pending' | 'partially_paid' | 'paid' = 'pending';
      let totalPaid = 0;
      let paymentMethods: unknown[] = [];

      if (paymentData && paymentData.paymentMethods) {
        // Payment was collected
        paymentMethods = paymentData.paymentMethods;
        totalPaid = paymentMethods.reduce((sum: number, pm: Record<string, unknown>) => sum + pm.amount, 0);

        if (totalPaid >= totalAmount) {
          paymentStatus = 'paid';
        } else if (totalPaid > 0) {
          paymentStatus = 'partially_paid';
        }
      }

      // Create booking with proper payload
      const bookingData = {
        hotelId: bookingForm.hotelId,
        userId: userId,
        roomIds: bookingForm.roomIds,
        checkIn: bookingForm.checkIn,
        checkOut: bookingForm.checkOut,
        guestDetails: {
          adults: bookingForm.guestDetails.adults || 1,
          children: bookingForm.guestDetails.children || 0,
          specialRequests: bookingForm.guestDetails.specialRequests || '',
          // Include guest contact info for reference
          name: guestName,
          email: guestEmail,
          phone: guestPhone || 'N/A'
        },
        totalAmount: totalAmount,
        currency: bookingForm.currency,
        paymentStatus: paymentStatus,
        status: 'checked_in' as const, // Walk-in bookings are automatically checked in
        source: 'walk_in',
        // Payment details
        paymentMethods: paymentMethods,
        paidAmount: totalPaid,
        remainingAmount: Math.max(0, totalAmount - totalPaid),
        // Check-in time (guest is already at the hotel)
        checkInTime: new Date().toISOString(),
        // IDEMPOTENCY FIX: crypto.randomUUID() for collision-safe idempotency.
        idempotencyKey: `walkin-${crypto.randomUUID()}`
      };


      try {
        await adminService.createBooking(bookingData);

        // Show appropriate success message based on payment status
        if (paymentStatus === 'paid') {
          toast.success('Walk-in booking created and guest checked in successfully! Payment completed.');
        } else if (paymentStatus === 'partially_paid') {
          toast.success(`Walk-in booking created and guest checked in! Partial payment collected: ${formatCurrency(totalPaid, bookingForm.currency)}.`);
        } else {
          toast.success('Walk-in booking created and guest checked in successfully!');
        }

        // Invalidate queries
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        queryClient.invalidateQueries({ queryKey: ['rooms'] });
        queryClient.invalidateQueries({ queryKey: ['bookings'] });
        queryClient.invalidateQueries({ queryKey: ['real-time'] });
        queryClient.invalidateQueries({ queryKey: ['occupancy'] });
        queryClient.invalidateQueries({ queryKey: ['kpis'] });

        onSuccess();

        // Refresh available rooms
        if (bookingForm.hotelId && bookingForm.checkIn && bookingForm.checkOut) {
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => {
            fetchAvailableRooms();
          }, 500);
        }

        // Close modal
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          handleClose();
        }, 1500);
      } catch (bookingError: unknown) {
        const berr = bookingError as { response?: { status?: number; data?: { message?: string } } };
        if (berr.response?.status === 400) {
          toast.error(`Booking failed: ${berr.response?.data?.message || 'Invalid booking data'}`);
        } else if (berr.response?.status === 409) {
          toast.error('Selected rooms are no longer available. Please select different rooms.');
        } else {
          toast.error('Failed to create booking. Please try again.');
        }
      }
    } catch (error) {
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setGuestMode('new');
    setUserSearch('');
    setSearchResults([]);
    setSelectedExistingUser(null);
    setPaymentDetails(null);
    setGuestForm({
      name: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      country: 'India',
      idType: 'passport',
      idNumber: ''
    });
    setBookingForm({
      hotelId: selectedHotelId || '',
      roomIds: [],
      checkIn: new Date().toISOString().split('T')[0],
      checkOut: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      guestDetails: {
        adults: 1,
        children: 0,
        specialRequests: ''
      },
      totalAmount: 0,
      currency: 'INR',
      paymentStatus: 'pending',
      status: 'checked_in'
    });
    setErrors({});
    onClose();
  };

  const totalAmount = calculateTotalAmount();

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title={prefilledData?.roomNumber ? `New Booking - Room ${prefilledData.roomNumber}` : "Walk-in Booking"}
        size="xl"
      >
        <div className="space-y-6">
          {/* Pre-filled Info Banner */}
          {prefilledData?.roomNumber && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-blue-800">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">
                  Quick Booking from Tape Chart - Room {prefilledData.roomNumber}
                </span>
              </div>
              <p className="text-sm text-blue-600 mt-1">
                Check-in: {prefilledData.checkIn} | Check-out: {prefilledData.checkOut} | {prefilledData.nights} night{prefilledData.nights !== 1 ? 's' : ''}
              </p>
            </div>
          )}

          {/* Progress Steps */}
          <div className="flex items-center justify-center space-x-4 mb-6">
            {[1, 2, 3].map((stepNumber) => (
              <div key={stepNumber} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step >= stepNumber
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                  }`}>
                  {stepNumber}
                </div>
                {stepNumber < 3 && (
                  <div className={`w-12 h-1 mx-2 ${step > stepNumber ? 'bg-blue-600' : 'bg-gray-200'
                    }`} />
                )}
              </div>
            ))}
          </div>

          {/* Step 1: Guest Information */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-lg font-medium text-gray-900">Guest Information</h3>
                <p className="text-sm text-gray-600">Select or create a guest profile</p>
              </div>

              {/* Guest Mode Selection */}
              <div className="flex gap-4 mb-6">
                <button
                  onClick={() => {
                    setGuestMode('new');
                    setSelectedExistingUser(null);
                    setUserSearch('');
                  }}
                  className={`flex-1 p-4 rounded-lg border-2 transition-all ${guestMode === 'new'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                >
                  <UserPlus className="h-5 w-5 mx-auto mb-2" />
                  <div className="font-medium">New Guest</div>
                  <div className="text-xs mt-1">Create new account</div>
                </button>

                <button
                  onClick={() => {
                    setGuestMode('existing');
                    setGuestForm({
                      name: '',
                      email: '',
                      phone: '',
                      address: '',
                      city: '',
                      state: '',
                      country: 'India',
                      idType: 'passport',
                      idNumber: ''
                    });
                  }}
                  className={`flex-1 p-4 rounded-lg border-2 transition-all ${guestMode === 'existing'
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                >
                  <Search className="h-5 w-5 mx-auto mb-2" />
                  <div className="font-medium">Existing Guest</div>
                  <div className="text-xs mt-1">Search database</div>
                </button>
              </div>

              {/* Existing User Search */}
              {guestMode === 'existing' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Search for Guest
                    </label>
                    <div className="relative">
                      <Search className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
                      <Input
                        type="text"
                        required
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        placeholder="Search by name, email, or phone..."
                        className="pl-10"
                      />
                    </div>
                  </div>

                  {/* Search Results - Shows from first character */}
                  {userSearch.length >= 1 && (
                    <div className="border border-gray-300 rounded-lg max-h-60 overflow-y-auto">
                      {searchLoading ? (
                        <div className="p-4 text-center text-gray-500">
                          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                          Searching...
                        </div>
                      ) : searchResults.length > 0 ? (
                        searchResults.map((guest) => (
                          <div role="button" tabIndex={0}
                            key={guest._id}
                            onClick={() => {
                              setSelectedExistingUser(guest);
                              setUserSearch(guest.name);
                              setSearchResults([]);
                            }}
                            className={`p-3 cursor-pointer hover:bg-gray-50 border-b last:border-b-0 ${selectedExistingUser?._id === guest._id ? 'bg-blue-50' : ''
                              }`}
                           onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const clickHandler = () => {
                              setSelectedExistingUser(guest);
                              setUserSearch(guest.name);
                              setSearchResults([]);
                            }; if (typeof clickHandler === 'function') { clickHandler(e as any); } } }}>
                            <div className="font-medium">{guest.name}</div>
                            <div className="text-sm text-gray-600">{guest.email}</div>
                            {guest.phone && (
                              <div className="text-sm text-gray-600">{guest.phone}</div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="p-4 text-center text-gray-500">
                          No guests found matching "{userSearch}"
                        </div>
                      )}
                    </div>
                  )}

                  {/* Selected User Display */}
                  {selectedExistingUser && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-green-800 mb-2">
                        <CheckCircle className="h-5 w-5" />
                        <span className="font-medium">Selected Guest</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-600">Name:</span>
                          <span className="ml-2 font-medium">{selectedExistingUser.name}</span>
                        </div>
                        <div>
                          <span className="text-gray-600">Email:</span>
                          <span className="ml-2 font-medium">{selectedExistingUser.email}</span>
                        </div>
                        {selectedExistingUser.phone && (
                          <div>
                            <span className="text-gray-600">Phone:</span>
                            <span className="ml-2 font-medium">{selectedExistingUser.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {errors.user && (
                    <p className="text-red-500 text-sm">{errors.user}</p>
                  )}
                </div>
              )}

              {/* New Guest Form */}
              {guestMode === 'new' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name *
                    </label>
                    <div className="relative">
                      <User className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
                      <Input
                        type="text"
                        required
                        value={guestForm.name}
                        onChange={(e) => setGuestForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Enter full name"
                        className="pl-10"
                        error={errors.name}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email *
                    </label>
                    <div className="relative">
                      <Mail className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
                      <Input
                        type="email"
                        required
                        value={guestForm.email}
                        onChange={(e) => setGuestForm(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="Enter email address"
                        className="pl-10"
                        error={errors.email}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone Number *
                    </label>
                    <div className="relative">
                      <Phone className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
                      <Input
                        type="tel"
                        required
                        value={guestForm.phone}
                        onChange={(e) => setGuestForm(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="Enter phone number"
                        className="pl-10"
                        error={errors.phone}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ID Type *
                    </label>
                    <select
                      value={guestForm.idType}
                      onChange={(e) => setGuestForm(prev => ({
                        ...prev,
                        idType: e.target.value as 'passport' | 'driving_license' | 'national_id' | 'other'
                      }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2"
                    >
                      <option value="passport">Passport</option>
                      <option value="driving_license">Driving License</option>
                      <option value="national_id">National ID</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      ID Number *
                    </label>
                    <Input
                      type="text"
                      required
                      value={guestForm.idNumber}
                      onChange={(e) => setGuestForm(prev => ({ ...prev, idNumber: e.target.value }))}
                      placeholder="Enter ID number"
                      error={errors.idNumber}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Country
                    </label>
                    <Input
                      type="text"
                      value={guestForm.country}
                      onChange={(e) => setGuestForm(prev => ({ ...prev, country: e.target.value }))}
                      placeholder="Enter country"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address *
                    </label>
                    <div className="relative">
                      <MapPin className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
                      <Input
                        type="text"
                        required
                        value={guestForm.address}
                        onChange={(e) => setGuestForm(prev => ({ ...prev, address: e.target.value }))}
                        placeholder="Enter street address"
                        className="pl-10"
                        error={errors.address}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      City *
                    </label>
                    <Input
                      type="text"
                      required
                      value={guestForm.city}
                      onChange={(e) => setGuestForm(prev => ({ ...prev, city: e.target.value }))}
                      placeholder="Enter city"
                      error={errors.city}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      State *
                    </label>
                    <Input
                      type="text"
                      required
                      value={guestForm.state}
                      onChange={(e) => setGuestForm(prev => ({ ...prev, state: e.target.value }))}
                      placeholder="Enter state"
                      error={errors.state}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Booking Details (Keep existing implementation) */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-lg font-medium text-gray-900">Booking Details</h3>
                <p className="text-sm text-gray-600">Select rooms and dates for the stay</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hotel
                  </label>
                  <select
                    value={bookingForm.hotelId}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, hotelId: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    {hotels.map(hotel => (
                      <option key={hotel._id} value={hotel._id}>
                        {hotel.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Check-in Date *
                  </label>
                  <div className="relative">
                    <Calendar className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
                    <Input
                      type="date"
                      required
                      value={bookingForm.checkIn}
                      onChange={(e) => setBookingForm(prev => ({ ...prev, checkIn: e.target.value }))}
                      min={new Date().toISOString().split('T')[0]}
                      className="pl-10"
                      error={errors.checkIn}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Check-out Date *
                  </label>
                  <div className="relative">
                    <Calendar className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
                    <Input
                      type="date"
                      required
                      value={bookingForm.checkOut}
                      onChange={(e) => setBookingForm(prev => ({ ...prev, checkOut: e.target.value }))}
                      min={bookingForm.checkIn ? new Date(new Date(bookingForm.checkIn).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}
                      className="pl-10"
                      error={errors.checkOut}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Number of Adults *
                  </label>
                  <div className="relative">
                    <Users className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
                    <Input
                      type="number"
                      required
                      min="1"
                      value={bookingForm.guestDetails.adults}
                      onChange={(e) => setBookingForm(prev => ({
                        ...prev,
                        guestDetails: { ...prev.guestDetails, adults: parseInt(e.target.value) || 1 }
                      }))}
                      className="pl-10"
                      error={errors.adults}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Number of Children
                  </label>
                  <div className="relative">
                    <Baby className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
                    <Input
                      type="number"
                      min="0"
                      value={bookingForm.guestDetails.children}
                      onChange={(e) => setBookingForm(prev => ({
                        ...prev,
                        guestDetails: { ...prev.guestDetails, children: parseInt(e.target.value) || 0 }
                      }))}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              {/* Available Rooms */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Available Rooms * ({availableRooms.filter(room => room.isAvailable).length} available of {availableRooms.length} total)
                </label>

                {availableRooms.filter(room => room.isAvailable).length > 0 ? (
                  <div className="space-y-2 max-h-80 overflow-y-auto border border-gray-200 rounded-lg p-2">
                    {availableRooms.filter(room => room.isAvailable).map((room) => (
                      <div role="button" tabIndex={0}
                        key={room._id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${bookingForm.roomIds.includes(room._id)
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-300 hover:border-gray-400'
                          }`}
                        onClick={() => {
                          setBookingForm(prev => ({
                            ...prev,
                            roomIds: prev.roomIds.includes(room._id)
                              ? prev.roomIds.filter(id => id !== room._id)
                              : [...prev.roomIds, room._id]
                          }));
                        }}
                       onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const clickHandler = () => {
                          setBookingForm(prev => ({
                            ...prev,
                            roomIds: prev.roomIds.includes(room._id)
                              ? prev.roomIds.filter(id => id !== room._id)
                              : [...prev.roomIds, room._id]
                          }));
                        }; if (typeof clickHandler === 'function') { clickHandler(e as any); } } }}>
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="flex items-center">
                              <Home className="h-4 w-4 text-gray-400 mr-2" />
                              <span className="font-medium">Room {room.roomNumber}</span>
                              <span className="ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 rounded">Available</span>
                              {prefilledData?.roomNumber === room.roomNumber && (
                                <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded font-medium">
                                  Pre-selected
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-600">
                              {room.type} • Floor {room.floor} • Status: {room.currentStatus}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">
                              {formatCurrency(room.currentRate || 0, 'INR')}/night
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 border border-gray-300 rounded-lg bg-gray-50">
                    <p className="text-gray-600 text-center">
                      {bookingForm.checkIn && bookingForm.checkOut
                        ? 'No rooms available for selected dates'
                        : 'Please select check-in and check-out dates to see available rooms.'
                      }
                    </p>
                  </div>
                )}

                {errors.rooms && (
                  <p className="text-red-500 text-sm mt-1">{errors.rooms}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Special Requests
                </label>
                <div className="relative">
                  <FileText className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
                  <textarea
                    value={bookingForm.guestDetails.specialRequests}
                    onChange={(e) => setBookingForm(prev => ({
                      ...prev,
                      guestDetails: { ...prev.guestDetails, specialRequests: e.target.value }
                    }))}
                    placeholder="Any special requests or notes..."
                    className="w-full border border-gray-300 rounded-md px-3 py-2 pl-10"
                    rows={3}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Summary (Removed Payment Section - Will use Modal) */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="text-center mb-6">
                <h3 className="text-lg font-medium text-gray-900">Review & Confirm</h3>
                <p className="text-sm text-gray-600">Verify booking details before proceeding to payment</p>
              </div>

              {/* Guest Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Guest Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Name</p>
                      <p className="font-medium">
                        {guestMode === 'existing' ? selectedExistingUser?.name : guestForm.name}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Email</p>
                      <p className="font-medium">
                        {guestMode === 'existing' ? selectedExistingUser?.email : guestForm.email}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Phone</p>
                      <p className="font-medium">
                        {guestMode === 'existing' ? selectedExistingUser?.phone : guestForm.phone}
                      </p>
                    </div>
                    {guestMode === 'new' && (
                      <div>
                        <p className="text-sm text-gray-600">ID</p>
                        <p className="font-medium">{guestForm.idType} - {guestForm.idNumber}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Booking Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Booking Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Check-in</p>
                        <p className="font-medium">{new Date(bookingForm.checkIn).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Check-out</p>
                        <p className="font-medium">{new Date(bookingForm.checkOut).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Nights</p>
                        <p className="font-medium">
                          {Math.ceil((new Date(bookingForm.checkOut).getTime() - new Date(bookingForm.checkIn).getTime()) / (1000 * 60 * 60 * 24))}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Guests</p>
                        <p className="font-medium">
                          {bookingForm.guestDetails.adults} adult(s), {bookingForm.guestDetails.children} child(ren)
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-sm text-gray-600 mb-2">Selected Rooms</p>
                      <div className="space-y-2">
                        {availableRooms
                          .filter(room => bookingForm.roomIds.includes(room._id) && room.isAvailable)
                          .map(room => (
                            <div key={room._id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                              <span>Room {room.roomNumber} ({room.type})</span>
                              <span className="font-medium">
                                {formatCurrency(room.currentRate || 0, 'INR')}/night
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>

                    <div className="border-t pt-4">
                      <div className="flex justify-between items-center text-lg font-medium">
                        <span>Total Amount</span>
                        <span className="text-blue-600">{formatCurrency(totalAmount, 'INR')}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between pt-6 border-t">
            <Button
              variant="ghost"
              onClick={step === 1 ? handleClose : handlePrevious}
              disabled={loading}
            >
              {step === 1 ? 'Cancel' : 'Previous'}
            </Button>

            <div className="flex space-x-3">
              {step < 3 ? (
                <Button
                  onClick={handleNext}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Next
                </Button>
              ) : (
                <Button
                  onClick={handleNext}
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {loading ? 'Processing...' : 'Proceed to Payment'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* Payment Collection Modal */}
      <PaymentCollectionModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onConfirm={handlePaymentConfirm}
        totalAmount={totalAmount}
        currency="INR"
        bookingNumber={`TEMP-${Date.now()}`}
        mode="checkin"
        paidAmount={0}
      />
    </>
  );
}


export default withErrorBoundary(WalkInBooking, { level: 'page' });
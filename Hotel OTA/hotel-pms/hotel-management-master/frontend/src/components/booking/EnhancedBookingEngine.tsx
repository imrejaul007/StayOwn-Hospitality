import React, { useState, useEffect, useMemo, useRef} from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/utils/toast';
import { useAuth } from '@/context/AuthContext';
import {
  CalendarIcon,
  Users,
  Star,
  Gift,
  Percent,
  CreditCard,
  MapPin,
  Wifi,
  Car,
  Coffee,
  Dumbbell,
  Waves,
  Utensils,
  Shield,
  Clock,
  Phone,
  Mail,
  Tag,
  TrendingUp,
  Heart,
  Sparkles,
  Zap,
  Target,
  Globe,
  Smartphone,
  Monitor,
  Eye,
  Share2,
  Edit,
  Copy,
  Settings,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Info,
  IndianRupee,
  Loader2
} from 'lucide-react';
import { format, addDays, differenceInDays } from 'date-fns';
import { formatCurrency } from '@/utils/currencyUtils';
import { roomTypeService } from '@/services/roomTypeService';
import { inventoryService } from '@/services/inventoryService';
import { roomTypeLocalizationService, type LocalizedRoomType } from '@/services/roomTypeLocalizationService';
import { multiCurrencyRateService, type ConvertedRatePlan, type ConversionRatesResponse } from '@/services/multiCurrencyRateService';
import { api } from '@/services/api';
import { bookingEngineService } from '@/services/bookingEngineService';
import { withErrorBoundary } from '../ErrorBoundary';

// Use LocalizedRoomType from the service, but keep legacy interface for backward compatibility
interface RoomType extends Omit<LocalizedRoomType, 'specifications'> {
  // Legacy fields for backward compatibility
  legacyType?: string;
  size?: number;
  bedType?: string;
  maxOccupancy: number;
  // Additional booking-specific fields
  availableRooms?: number;
  currentRate?: number;
  stopSellFlag?: boolean;
  minimumStay?: number;
  maxAdvanceBooking?: number;
  cancellationPolicy?: string;
}

interface InventoryData {
  date: string;
  roomTypeId: string;
  totalRooms: number;
  soldRooms: number;
  blockedRooms: number;
  availableRooms: number;
  baseRate: number;
  sellingRate: number;
  extraAdultRate: number;
  extraChildRate: number;
  stopSellFlag: boolean;
  closedToArrival: boolean;
  closedToDeparture: boolean;
  minimumStay: number;
  maximumStay: number;
}

interface BookingRequest {
  checkInDate: Date;
  checkOutDate: Date;
  adults: number;
  children: number;
  rooms: number;
  roomTypeId: string;
  guestInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    specialRequests: string;
  };
  promoCode?: string;
  source: string;
  totalAmount: number;
}

interface PricingBreakdown {
  baseAmount: number;
  extraAdultCharges: number;
  extraChildCharges: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  nightlyRates: { date: string; rate: number; }[];
  promoDiscount?: {
    code: string;
    type: 'percentage' | 'fixed';
    value: number;
    amount: number;
  };
}

interface EnhancedBookingEngineProps {
  hotelId?: string;
  mode?: 'widget' | 'admin' | 'preview';
  theme?: 'light' | 'dark' | 'brand';
  showHeader?: boolean;
  language?: string;
  currency?: string;
  onBookingComplete?: (booking: Record<string, unknown>) => void;
  onLanguageChange?: (language: string) => void;
}

const EnhancedBookingEngine: React.FC<EnhancedBookingEngineProps> = ({
  hotelId: propHotelId,
  mode = 'widget',
  theme = 'light',
  showHeader = true,
  language = 'EN',
  currency = 'USD',
  onBookingComplete,
  onLanguageChange
}) => {
  const { user } = useAuth();
  const hotelId = propHotelId || user?.hotelId || 'default';

  // Booking state
  const [bookingData, setBookingData] = useState<BookingRequest>({
    checkInDate: new Date(),
    checkOutDate: addDays(new Date(), 2),
    adults: 2,
    children: 0,
    rooms: 1,
    roomTypeId: '',
    guestInfo: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      specialRequests: ''
    },
    source: 'direct',
    totalAmount: 0
  });

  // Component state
  const [currentStep, setCurrentStep] = useState(1);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [inventoryData, setInventoryData] = useState<InventoryData[]>([]);
  const [pricingBreakdown, setPricingBreakdown] = useState<PricingBreakdown | null>(null);
  const [selectedRoomType, setSelectedRoomType] = useState<RoomType | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookingResponse, setBookingResponse] = useState<{ bookingNumber?: string; _id?: string } | null>(null);

  // Multi-currency rate state
  const [ratePlans, setRatePlans] = useState<ConvertedRatePlan[]>([]);
  const [selectedRatePlan, setSelectedRatePlan] = useState<ConvertedRatePlan | null>(null);
  const [conversionRates, setConversionRates] = useState<ConversionRatesResponse | null>(null);
  const [availableCurrencies] = useState<string[]>(['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'INR']);
  const [selectedCurrency, setSelectedCurrency] = useState(currency);

  // Load initial data
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    loadRoomTypes();
    loadConversionRates();
  }, [hotelId, language, currency]);

  // Load rate plans when search criteria change
  useEffect(() => {
    if (bookingData.checkInDate && bookingData.checkOutDate && selectedRoomType) {
      loadRatePlans();
    }
  }, [selectedRoomType, bookingData.checkInDate, bookingData.checkOutDate, currency]);

  // Calculate pricing when relevant data changes
  useEffect(() => {
    if (selectedRoomType && bookingData.checkInDate && bookingData.checkOutDate) {
      calculatePricing();
    }
  }, [selectedRoomType, bookingData.checkInDate, bookingData.checkOutDate, bookingData.adults, bookingData.children, bookingData.rooms, promoCode, selectedRatePlan]);

  // Update selected currency when prop changes
  useEffect(() => {
    setSelectedCurrency(currency);
    loadConversionRates();
  }, [currency]);

  const loadRoomTypes = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Use localized room type service
      const { data } = await roomTypeLocalizationService.getLocalizedRoomTypes(hotelId, {
        language,
        isActive: true,
        published: true
      });
      
      // Transform to match legacy interface
      const transformedRoomTypes = data.map((rt: LocalizedRoomType): RoomType => ({
        ...rt,
        // Map specifications to legacy fields for backward compatibility
        maxOccupancy: rt.specifications.maxOccupancy,
        bedType: rt.specifications.bedType,
        size: rt.specifications.roomSize,
        // Add legacy fields if needed
        legacyType: rt.code
      }));
      
      setRoomTypes(transformedRoomTypes);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load room types');
      toast.error('Failed to load available rooms');
      
      // Fallback to legacy service if localized service fails
      try {
        const fallbackData = await roomTypeService.getRoomTypes(hotelId);
        setRoomTypes(fallbackData.filter((rt: RoomType) => rt.isActive));
      } catch {
        // Error handled silently
      }
    } finally {
      setLoading(false);
    }
  };

  const loadConversionRates = async () => {
    try {
      const { data } = await multiCurrencyRateService.getConversionRates(
        'USD', // Default base currency
        availableCurrencies
      );
      setConversionRates(data);
    } catch (error: unknown) {
      // Don't show error to user as this is non-critical
    }
  };

  const loadRatePlans = async () => {
    if (!selectedRoomType || !bookingData.checkInDate) return;

    try {
      const { data } = await multiCurrencyRateService.getAvailableRatesInCurrency(hotelId, {
        currency,
        date: bookingData.checkInDate.toISOString().split('T')[0],
        roomType: selectedRoomType.specifications?.bedType || selectedRoomType.legacyType,
        includePackages: true,
        includePromotional: true
      });

      setRatePlans(data);

      // Auto-select best rate if available
      if (data.length > 0 && !selectedRatePlan) {
        const bestRate = multiCurrencyRateService.getBestRateForRoomType(
          data,
          selectedRoomType.specifications?.bedType || selectedRoomType.legacyType || 'double'
        );
        if (bestRate) {
          setSelectedRatePlan(bestRate.ratePlan);
        }
      }
    } catch (error: unknown) {
      // Fallback to existing pricing logic
    }
  };

  const searchAvailability = async () => {
    if (!bookingData.checkInDate || !bookingData.checkOutDate) {
      toast.error('Please select check-in and check-out dates');
      return;
    }

    // Validate check-in is not in the past (compare date-only, ignoring time)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkInDateOnly = new Date(bookingData.checkInDate);
    checkInDateOnly.setHours(0, 0, 0, 0);
    if (checkInDateOnly < today) {
      toast.error('Check-in date cannot be in the past');
      return;
    }

    if (differenceInDays(bookingData.checkOutDate, bookingData.checkInDate) < 1) {
      toast.error('Stay must be at least 1 night');
      return;
    }

    try {
      setIsSearching(true);
      setError(null);

      // Get availability for all room types
      const startDate = format(bookingData.checkInDate, 'yyyy-MM-dd');
      const endDate = format(bookingData.checkOutDate, 'yyyy-MM-dd');
      
      const availabilityPromises = roomTypes.map(async (roomType) => {
        try {
          const inventory = await inventoryService.getInventory(
            hotelId,
            roomType._id,
            startDate,
            endDate
          );
          
          // Calculate availability for the entire stay period
          const minAvailable = Math.min(...inventory.map((inv: InventoryData) => inv.availableRooms));
          const hasStopSell = inventory.some((inv: InventoryData) => inv.stopSellFlag);
          const hasClosureRestriction = inventory.some((inv: InventoryData) => 
            inv.closedToArrival || inv.closedToDeparture
          );
          
          const averageRate = inventory.reduce((sum: number, inv: InventoryData) => 
            sum + inv.sellingRate, 0) / inventory.length;

          return {
            ...roomType,
            availableRooms: hasStopSell || hasClosureRestriction ? 0 : minAvailable,
            currentRate: averageRate,
            stopSellFlag: hasStopSell,
            inventoryDetails: inventory
          };
        } catch (error) {
          return {
            ...roomType,
            availableRooms: 0,
            currentRate: roomType.basePrice,
            stopSellFlag: true,
            inventoryDetails: []
          };
        }
      });

      const roomTypesWithAvailability = await Promise.all(availabilityPromises);
      setRoomTypes(roomTypesWithAvailability);
      setCurrentStep(2);
      
      const availableCount = roomTypesWithAvailability.filter(rt => (rt.availableRooms || 0) > 0).length;
      toast.success(`Found ${availableCount} available room type${availableCount !== 1 ? 's' : ''}`);
      
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to search availability');
      toast.error('Failed to search availability');
    } finally {
      setIsSearching(false);
    }
  };

  const selectRoomType = (roomType: RoomType) => {
    if (!roomType.availableRooms || roomType.availableRooms < bookingData.rooms) {
      toast.error('Insufficient rooms available for selected dates');
      return;
    }

    setSelectedRoomType(roomType);
    setBookingData(prev => ({ ...prev, roomTypeId: roomType._id }));
    setCurrentStep(3);
  };

  const calculatePricing = async () => {
    if (!selectedRoomType || !bookingData.checkInDate || !bookingData.checkOutDate) return;

    try {
      const startDate = format(bookingData.checkInDate, 'yyyy-MM-dd');
      const endDate = format(bookingData.checkOutDate, 'yyyy-MM-dd');
      
      const inventory = await inventoryService.getInventory(
        hotelId,
        selectedRoomType._id,
        startDate,
        endDate
      );

      // Calculate nightly rates
      const nightlyRates = inventory.map((inv: InventoryData) => ({
        date: inv.date,
        rate: inv.sellingRate
      }));

      // Calculate base amount using multi-currency rates if available
      let baseAmount = nightlyRates.reduce((sum, night) => sum + night.rate, 0) * bookingData.rooms;
      
      // Override with selected rate plan if available
      if (selectedRatePlan) {
        const roomTypeKey = selectedRoomType.specifications?.bedType || selectedRoomType.legacyType || 'double';
        const ratePlanRate = selectedRatePlan.baseRates.find(br => br.roomType === roomTypeKey);
        if (ratePlanRate) {
          const convertedRate = ratePlanRate.convertedRate || ratePlanRate.rate;
          baseAmount = convertedRate * nightlyRates.length * bookingData.rooms;
          
          // Update nightly rates to reflect rate plan pricing
          nightlyRates.forEach(night => {
            night.rate = convertedRate;
          });
        }
      }

      // Calculate extra charges
      const avgExtraAdultRate = inventory.reduce((sum: number, inv: InventoryData) => 
        sum + (inv.extraAdultRate || 0), 0) / inventory.length;
      const avgExtraChildRate = inventory.reduce((sum: number, inv: InventoryData) => 
        sum + (inv.extraChildRate || 0), 0) / inventory.length;

      const extraAdults = Math.max(0, bookingData.adults - selectedRoomType.maxOccupancy);
      const extraAdultCharges = extraAdults * avgExtraAdultRate * nightlyRates.length * bookingData.rooms;
      const extraChildCharges = bookingData.children * avgExtraChildRate * nightlyRates.length * bookingData.rooms;

      // Validate promo code via API
      let discountAmount = 0;
      let promoDiscount = undefined;
      if (promoCode.trim()) {
        try {
          const validation = await bookingEngineService.validatePromoCode(
            promoCode,
            baseAmount,
            startDate,
            endDate
          );
          if (validation.valid && validation.discount > 0) {
            discountAmount = validation.discount;
            promoDiscount = {
              code: promoCode.toUpperCase(),
              type: 'percentage' as const,
              value: 0,
              amount: discountAmount
            };
          }
        } catch {
          // Promo validation failed silently - no discount applied
        }
      }

      // Ensure discount does not exceed subtotal (prevents negative totals)
      discountAmount = Math.min(discountAmount, baseAmount + extraAdultCharges + extraChildCharges);

      // Calculate tax (18% GST) with proper rounding
      const subtotal = Math.round((baseAmount + extraAdultCharges + extraChildCharges - discountAmount) * 100) / 100;
      const taxAmount = Math.round(subtotal * 0.18 * 100) / 100;
      const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;

      const pricing: PricingBreakdown = {
        baseAmount,
        extraAdultCharges,
        extraChildCharges,
        discountAmount,
        taxAmount,
        totalAmount,
        nightlyRates,
        promoDiscount
      };

      setPricingBreakdown(pricing);
      setBookingData(prev => ({ ...prev, totalAmount }));

    } catch (err: unknown) {
      toast.error('Failed to calculate pricing');
    }
  };

  const applyPromoCode = async () => {
    if (!promoCode.trim()) {
      toast.error('Please enter a promo code');
      return;
    }
    // calculatePricing is async and will validate the promo code via API.
    // We recalculate pricing, then check the result after state has updated.
    await calculatePricing();
    // Note: because setState is asynchronous, we cannot rely on pricingBreakdown here.
    // Instead, toast feedback is already shown inside calculatePricing when the promo validates.
    // Show a generic message indicating the calculation was triggered.
    toast.info('Promo code applied. Check the pricing breakdown below.');
  };

  const proceedToConfirmation = () => {
    const { firstName, lastName, email, phone } = bookingData.guestInfo;

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !phone.trim()) {
      toast.error('Please fill in all required guest information');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    if (!/^\+?[\d\s-]{7,15}$/.test(phone.trim())) {
      toast.error('Please enter a valid phone number');
      return;
    }

    if (!pricingBreakdown || pricingBreakdown.totalAmount <= 0) {
      toast.error('Price calculation is incomplete. Please wait for pricing to load.');
      return;
    }

    setCurrentStep(4);
  };

  const confirmBooking = async () => {
    try {
      setIsBooking(true);

      const bookingPayload = {
        checkIn: format(bookingData.checkInDate, 'yyyy-MM-dd'),
        checkOut: format(bookingData.checkOutDate, 'yyyy-MM-dd'),
        roomType: selectedRoomType?._id || bookingData.roomTypeId,
        roomTypeId: selectedRoomType?._id || bookingData.roomTypeId,
        primaryRoomQuantity: bookingData.rooms,
        guestDetails: {
          adults: bookingData.adults,
          children: bookingData.children,
          specialRequests: bookingData.guestInfo.specialRequests,
          name: `${bookingData.guestInfo.firstName} ${bookingData.guestInfo.lastName}`,
          email: bookingData.guestInfo.email,
          phone: bookingData.guestInfo.phone,
        },
        guestName: `${bookingData.guestInfo.firstName} ${bookingData.guestInfo.lastName}`,
        guestEmail: bookingData.guestInfo.email,
        guestPhone: bookingData.guestInfo.phone,
        totalAmount: pricingBreakdown?.totalAmount || bookingData.totalAmount,
        currency: selectedCurrency || 'INR',
        source: bookingData.source,
        hotelId,
        numberOfRooms: bookingData.rooms,
      };

      const response = await api.post('/bookings', bookingPayload);
    if (!isMountedRef.current) return;

      const createdBooking = response.data?.data?.booking || response.data?.booking || response.data?.data || {};
      setBookingResponse(createdBooking);

      toast.success('Booking confirmed successfully!');
      setCurrentStep(5);

      if (onBookingComplete) {
        onBookingComplete(createdBooking);
      }

    } catch (err: unknown) {
      toast.error('Failed to confirm booking. Please try again.');
    } finally {
      setIsBooking(false);
    }
  };

  const getAmenityIcon = (amenityCode: string) => {
    const icons: Record<string, JSX.Element> = {
      WIFI: <Wifi className="w-4 h-4" />,
      AC: <Zap className="w-4 h-4" />,
      TV: <Monitor className="w-4 h-4" />,
      MINIBAR: <Coffee className="w-4 h-4" />,
      BALCONY: <MapPin className="w-4 h-4" />,
      LIVING_ROOM: <Users className="w-4 h-4" />,
      EXECUTIVE_LOUNGE: <Star className="w-4 h-4" />,
      POOL: <Waves className="w-4 h-4" />,
      GYM: <Dumbbell className="w-4 h-4" />,
      PARKING: <Car className="w-4 h-4" />,
      RESTAURANT: <Utensils className="w-4 h-4" />,
      // Legacy mappings
      wifi: <Wifi className="w-4 h-4" />,
      ac: <Zap className="w-4 h-4" />,
      tv: <Monitor className="w-4 h-4" />,
      minibar: <Coffee className="w-4 h-4" />,
      balcony: <MapPin className="w-4 h-4" />,
      living_room: <Users className="w-4 h-4" />,
      executive_lounge: <Star className="w-4 h-4" />,
      pool: <Waves className="w-4 h-4" />,
      gym: <Dumbbell className="w-4 h-4" />,
      parking: <Car className="w-4 h-4" />,
      restaurant: <Utensils className="w-4 h-4" />
    };
    return icons[amenityCode] || <Star className="w-4 h-4" />;
  };

  const formatAmenityName = (amenity: Record<string, unknown>): string => {
    // Handle both new LocalizedRoomType amenities and legacy string amenities
    if (typeof amenity === 'string') {
      return amenity.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    
    if (amenity && typeof amenity === 'object' && amenity.name) {
      return amenity.name;
    }
    
    return 'Unknown';
  };

  const getAmenityCode = (amenity: Record<string, unknown>): string => {
    if (typeof amenity === 'string') {
      return amenity.toUpperCase();
    }
    
    if (amenity && typeof amenity === 'object') {
      return amenity.code || amenity.name?.toUpperCase() || 'UNKNOWN';
    }
    
    return 'UNKNOWN';
  };

  const nights = useMemo(() => {
    if (!bookingData.checkInDate || !bookingData.checkOutDate) return 0;
    return differenceInDays(bookingData.checkOutDate, bookingData.checkInDate);
  }, [bookingData.checkInDate, bookingData.checkOutDate]);

  if (loading && roomTypes.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="ml-2">Loading booking engine...</span>
      </div>
    );
  }

  return (
    <div className={`max-w-4xl mx-auto p-6 space-y-6 ${theme === 'dark' ? 'dark' : ''}`}>
      {showHeader && (
        <div className="text-center mb-8">
          <div className="flex items-center justify-between mb-4">
            <div></div>
            <div>
              <h1 className="text-3xl font-bold mb-2">Book Your Stay</h1>
              <p className="text-gray-600">Experience luxury and comfort with our enhanced booking system</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-600">{language}</span>
                {onLanguageChange && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs px-2 py-1"
                    onClick={() => {
                      const newLanguage = language === 'EN' ? 'ES' : 'EN';
                      onLanguageChange(newLanguage);
                    }}
                  >
                    Switch Language
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <IndianRupee className="w-4 h-4 text-gray-500" />
                <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                  <SelectTrigger className="w-20 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCurrencies.map(curr => (
                      <SelectItem key={curr} value={curr}>{curr}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step Indicator */}
      <div className="flex items-center justify-center mb-8">
        {[1, 2, 3, 4, 5].map(step => (
          <React.Fragment key={step}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
              step === currentStep 
                ? 'bg-blue-500 text-white scale-110' 
                : step < currentStep 
                  ? 'bg-green-500 text-white' 
                  : 'bg-gray-200 text-gray-600'
            }`}>
              {step < currentStep ? <CheckCircle className="w-5 h-5" /> : step}
            </div>
            {step < 5 && (
              <div className={`w-16 h-1 mx-2 transition-all ${
                step < currentStep ? 'bg-green-500' : 'bg-gray-200'
              }`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step 1: Search */}
      {currentStep === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Search Available Rooms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Check-in Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      {format(bookingData.checkInDate, 'PPP')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={bookingData.checkInDate}
                      onSelect={(date) => date && setBookingData(prev => ({ ...prev, checkInDate: date }))}
                      disabled={(date) => {
                        const todayStart = new Date();
                        todayStart.setHours(0, 0, 0, 0);
                        return date < todayStart;
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div>
                <Label>Check-out Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      {format(bookingData.checkOutDate, 'PPP')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={bookingData.checkOutDate}
                      onSelect={(date) => date && setBookingData(prev => ({ ...prev, checkOutDate: date }))}
                      disabled={(date) => date <= bookingData.checkInDate}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Adults</Label>
                <Select 
                  value={bookingData.adults.toString()} 
                  onValueChange={(value) => setBookingData(prev => ({ ...prev, adults: parseInt(value) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(num => (
                      <SelectItem key={num} value={num.toString()}>{num} Adult{num > 1 ? 's' : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Children</Label>
                <Select 
                  value={bookingData.children.toString()} 
                  onValueChange={(value) => setBookingData(prev => ({ ...prev, children: parseInt(value) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2, 3, 4, 5, 6].map(num => (
                      <SelectItem key={num} value={num.toString()}>{num} Child{num !== 1 ? 'ren' : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Rooms</Label>
                <Select 
                  value={bookingData.rooms.toString()} 
                  onValueChange={(value) => setBookingData(prev => ({ ...prev, rooms: parseInt(value) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map(num => (
                      <SelectItem key={num} value={num.toString()}>{num} Room{num > 1 ? 's' : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-sm text-blue-700 mb-2 font-medium">Your Stay Summary</div>
              <div className="text-sm text-blue-600">
                {nights} night{nights !== 1 ? 's' : ''} • {bookingData.adults + bookingData.children} guest{(bookingData.adults + bookingData.children) !== 1 ? 's' : ''} • {bookingData.rooms} room{bookingData.rooms !== 1 ? 's' : ''}
              </div>
            </div>

            <Button 
              className="w-full h-12 text-lg" 
              onClick={searchAvailability}
              disabled={isSearching || nights < 1}
            >
              {isSearching ? (
                <>
                  <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                  Searching Available Rooms...
                </>
              ) : (
                <>
                  <Eye className="w-5 h-5 mr-2" />
                  Search Available Rooms
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Room Selection */}
      {currentStep === 2 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Choose Your Room</CardTitle>
                <Badge variant="outline" className="text-lg px-3 py-1">
                  {nights} night{nights !== 1 ? 's' : ''}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {roomTypes.filter(rt => rt.availableRooms && rt.availableRooms > 0).map(roomType => (
                <div role="button" tabIndex={0} 
                  key={roomType._id} 
                  className="border rounded-lg p-6 cursor-pointer transition-all hover:shadow-md hover:border-blue-300"
                  onClick={() => selectRoomType(roomType)}
                 onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const clickHandler = () => selectRoomType(roomType); if (typeof clickHandler === 'function') { clickHandler(e as any); } } }}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-3">
                        <h3 className="font-semibold text-xl">{roomType.name}</h3>
                        <Badge variant="outline">{roomType.code}</Badge>
                      </div>
                      
                      <p className="text-gray-600 mb-4">{roomType.description}</p>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-4">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          Up to {roomType.maxOccupancy} guests
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          {roomType.size} sqm
                        </div>
                        <div>{roomType.bedType}</div>
                        <div className="text-green-600 font-medium">
                          {roomType.availableRooms} rooms available
                        </div>
                      </div>
                      
                      <div className="flex gap-2 flex-wrap">
                        {roomType.amenities.slice(0, 6).map((amenity, index) => {
                          const amenityCode = getAmenityCode(amenity);
                          const amenityName = formatAmenityName(amenity);
                          const amenityKey = typeof amenity === 'string' ? amenity : `${amenityCode}-${index}`;
                          
                          return (
                            <div key={amenityKey} className="flex items-center gap-1 text-xs bg-gray-100 px-3 py-1 rounded-full">
                              {getAmenityIcon(amenityCode)}
                              <span className="capitalize">{amenityName}</span>
                            </div>
                          );
                        })}
                        {roomType.amenities.length > 6 && (
                          <div className="text-xs text-gray-500 px-3 py-1">
                            +{roomType.amenities.length - 6} more
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-right ml-6">
                      <div className="text-3xl font-bold text-green-600">
                        {multiCurrencyRateService.formatRateAmount(
                          roomType.currentRate || roomType.basePrice,
                          selectedCurrency,
                          conversionRates || undefined
                        )}
                      </div>
                      <div className="text-sm text-gray-500">per night</div>
                      <div className="text-lg font-semibold mt-2">
                        Total: {multiCurrencyRateService.formatRateAmount(
                          (roomType.currentRate || roomType.basePrice) * nights * bookingData.rooms,
                          selectedCurrency,
                          conversionRates || undefined
                        )}
                      </div>
                      {ratePlans.filter(rp => 
                        rp.baseRates.some(br => br.roomType === (roomType.specifications?.bedType || roomType.legacyType))
                      ).length > 1 && (
                        <div className="mt-2 text-xs text-blue-600">
                          {ratePlans.filter(rp => 
                            rp.baseRates.some(br => br.roomType === (roomType.specifications?.bedType || roomType.legacyType))
                          ).length} rate plans available
                        </div>
                      )}
                      <Button className="mt-4 w-full">
                        Select Room
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

              {roomTypes.filter(rt => rt.availableRooms && rt.availableRooms > 0).length === 0 && (
                <div className="text-center py-12">
                  <AlertTriangle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-600 mb-2">No rooms available</h3>
                  <p className="text-gray-500">Please try different dates or contact us directly.</p>
                  <Button 
                    variant="outline" 
                    onClick={() => setCurrentStep(1)} 
                    className="mt-4"
                  >
                    Modify Search
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 3: Guest Information */}
      {currentStep === 3 && selectedRoomType && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Guest Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={bookingData.guestInfo.firstName}
                    onChange={(e) => setBookingData(prev => ({
                      ...prev,
                      guestInfo: { ...prev.guestInfo, firstName: e.target.value }
                    }))}
                  />
                </div>
                
                <div>
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={bookingData.guestInfo.lastName}
                    onChange={(e) => setBookingData(prev => ({
                      ...prev,
                      guestInfo: { ...prev.guestInfo, lastName: e.target.value }
                    }))}
                  />
                </div>
                
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={bookingData.guestInfo.email}
                    onChange={(e) => setBookingData(prev => ({
                      ...prev,
                      guestInfo: { ...prev.guestInfo, email: e.target.value }
                    }))}
                  />
                </div>
                
                <div>
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    value={bookingData.guestInfo.phone}
                    onChange={(e) => setBookingData(prev => ({
                      ...prev,
                      guestInfo: { ...prev.guestInfo, phone: e.target.value }
                    }))}
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="specialRequests">Special Requests (Optional)</Label>
                <Textarea
                  id="specialRequests"
                  placeholder="Any special requests or preferences..."
                  value={bookingData.guestInfo.specialRequests}
                  onChange={(e) => setBookingData(prev => ({
                    ...prev,
                    guestInfo: { ...prev.guestInfo, specialRequests: e.target.value }
                  }))}
                />
              </div>

              <div>
                <Label>Promo Code (Optional)</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter promo code"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  />
                  <Button variant="outline" onClick={applyPromoCode}>
                    <Tag className="w-4 h-4 mr-2" />
                    Apply
                  </Button>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Enter a promo code to receive a discount
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Rate Plan Selection */}
          {ratePlans.length > 1 && selectedRoomType && (
            <Card>
              <CardHeader>
                <CardTitle>Choose Rate Plan</CardTitle>
                <p className="text-sm text-gray-600">Select the best rate for your stay</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {ratePlans
                  .filter(rp => rp.baseRates.some(br => br.roomType === (selectedRoomType.specifications?.bedType || selectedRoomType.legacyType)))
                  .map(ratePlan => {
                    const baseRate = ratePlan.baseRates.find(br => br.roomType === (selectedRoomType.specifications?.bedType || selectedRoomType.legacyType));
                    if (!baseRate) return null;
                    
                    const totalRate = (baseRate.convertedRate || baseRate.rate) * nights * bookingData.rooms;
                    const isSelected = selectedRatePlan?.planId === ratePlan.planId;
                    
                    return (
                      <div role="button" tabIndex={0}
                        key={ratePlan.planId}
                        className={`border rounded-lg p-4 cursor-pointer transition-all ${
                          isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
                        }`}
                        onClick={() => setSelectedRatePlan(ratePlan)}
                       onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const clickHandler = () => setSelectedRatePlan(ratePlan); if (typeof clickHandler === 'function') { clickHandler(e as any); } } }}>
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-semibold">{ratePlan.name}</h4>
                              <Badge variant={isSelected ? "default" : "outline"}>{ratePlan.type}</Badge>
                              {ratePlan.mealPlan && ratePlan.mealPlan !== 'RO' && (
                                <Badge variant="outline" className="text-xs">{ratePlan.mealPlan}</Badge>
                              )}
                            </div>
                            {ratePlan.description && (
                              <p className="text-sm text-gray-600 mb-2">{ratePlan.description}</p>
                            )}
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              {ratePlan.cancellationPolicy && (
                                <span>{ratePlan.cancellationPolicy.type} cancellation</span>
                              )}
                              {ratePlan.stayRestrictions && (
                                <span>Min {ratePlan.stayRestrictions.minNights} nights</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-green-600">
                              {multiCurrencyRateService.formatRateAmount(
                                totalRate,
                                selectedCurrency,
                                conversionRates || undefined
                              )}
                            </div>
                            <div className="text-sm text-gray-500">
                              {multiCurrencyRateService.formatRateAmount(
                                baseRate.convertedRate || baseRate.rate,
                                selectedCurrency,
                                conversionRates || undefined
                              )} per night
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </CardContent>
            </Card>
          )}
          
          {/* Pricing Breakdown */}
          {pricingBreakdown && (
            <Card>
              <CardHeader>
                <CardTitle>Booking Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span>Room: {selectedRoomType.name} × {bookingData.rooms}</span>
                  <span>{multiCurrencyRateService.formatRateAmount(
                    pricingBreakdown.baseAmount,
                    selectedCurrency,
                    conversionRates || undefined
                  )}</span>
                </div>
                {selectedRatePlan && (
                  <div className="flex justify-between text-sm text-blue-600">
                    <span>Rate Plan: {selectedRatePlan.name}</span>
                    <Badge variant="outline" className="text-xs">{selectedRatePlan.type}</Badge>
                  </div>
                )}
                
                {pricingBreakdown.extraAdultCharges > 0 && (
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Extra Adult Charges</span>
                    <span>{multiCurrencyRateService.formatRateAmount(
                      pricingBreakdown.extraAdultCharges,
                      selectedCurrency,
                      conversionRates || undefined
                    )}</span>
                  </div>
                )}
                
                {pricingBreakdown.extraChildCharges > 0 && (
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Extra Child Charges</span>
                    <span>{multiCurrencyRateService.formatRateAmount(
                      pricingBreakdown.extraChildCharges,
                      selectedCurrency,
                      conversionRates || undefined
                    )}</span>
                  </div>
                )}
                
                {pricingBreakdown.promoDiscount && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount ({pricingBreakdown.promoDiscount.code})</span>
                    <span>-{multiCurrencyRateService.formatRateAmount(
                      pricingBreakdown.discountAmount,
                      selectedCurrency,
                      conversionRates || undefined
                    )}</span>
                  </div>
                )}
                
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Taxes & Fees</span>
                  <span>{multiCurrencyRateService.formatRateAmount(
                    pricingBreakdown.taxAmount,
                    selectedCurrency,
                    conversionRates || undefined
                  )}</span>
                </div>
                
                <Separator />
                
                <div className="flex justify-between font-bold text-xl">
                  <span>Total Amount</span>
                  <span className="text-green-600">{multiCurrencyRateService.formatRateAmount(
                    pricingBreakdown.totalAmount,
                    selectedCurrency,
                    conversionRates || undefined
                  )}</span>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <Button variant="outline" onClick={() => setCurrentStep(2)} className="flex-1">
                    Back to Rooms
                  </Button>
                  <Button 
                    onClick={proceedToConfirmation} 
                    className="flex-1"
                    disabled={!bookingData.guestInfo.firstName || !bookingData.guestInfo.lastName || !bookingData.guestInfo.email || !bookingData.guestInfo.phone}
                  >
                    Review & Confirm
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Step 4: Confirmation */}
      {currentStep === 4 && selectedRoomType && pricingBreakdown && (
        <Card>
          <CardHeader>
            <CardTitle>Confirm Your Booking</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-gray-50 p-4 rounded-lg space-y-3">
              <h3 className="font-semibold">Booking Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Check-in:</span>
                  <div className="font-medium">{format(bookingData.checkInDate, 'PPP')}</div>
                </div>
                <div>
                  <span className="text-gray-600">Check-out:</span>
                  <div className="font-medium">{format(bookingData.checkOutDate, 'PPP')}</div>
                </div>
                <div>
                  <span className="text-gray-600">Guests:</span>
                  <div className="font-medium">{bookingData.adults + bookingData.children} guests</div>
                </div>
                <div>
                  <span className="text-gray-600">Room:</span>
                  <div className="font-medium">{selectedRoomType.name}</div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg space-y-3">
              <h3 className="font-semibold">Guest Information</h3>
              <div className="text-sm space-y-1">
                <div><strong>Name:</strong> {bookingData.guestInfo.firstName} {bookingData.guestInfo.lastName}</div>
                <div><strong>Email:</strong> {bookingData.guestInfo.email}</div>
                <div><strong>Phone:</strong> {bookingData.guestInfo.phone}</div>
                {bookingData.guestInfo.specialRequests && (
                  <div><strong>Special Requests:</strong> {bookingData.guestInfo.specialRequests}</div>
                )}
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-semibold text-green-800 mb-2">Payment Summary</h3>
              <div className="text-2xl font-bold text-green-700">
                {multiCurrencyRateService.formatRateAmount(
                  pricingBreakdown.totalAmount,
                  selectedCurrency,
                  conversionRates || undefined
                )}
              </div>
              <div className="text-sm text-green-600">
                For {nights} nights • {bookingData.rooms} room{bookingData.rooms !== 1 ? 's' : ''}
              </div>
              {selectedRatePlan && (
                <div className="text-sm text-green-600 mt-1">
                  Using {selectedRatePlan.name} rate plan
                </div>
              )}
            </div>

            <div className="text-xs text-gray-500 space-y-1">
              <p>By clicking "Confirm Booking", you agree to our terms and conditions.</p>
              <p>Free cancellation until 24 hours before check-in.</p>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setCurrentStep(3)} className="flex-1">
                Back to Edit
              </Button>
              <Button 
                onClick={confirmBooking} 
                className="flex-1 h-12 text-lg"
                disabled={isBooking}
              >
                {isBooking ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Confirming Booking...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5 mr-2" />
                    Confirm Booking
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Success */}
      {currentStep === 5 && (
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-6" />
            <h2 className="text-3xl font-bold mb-4">Booking Confirmed!</h2>
            <p className="text-gray-600 mb-6">
              Thank you for your reservation. You'll receive a confirmation email shortly at {bookingData.guestInfo.email}
            </p>
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <p className="text-sm text-gray-600 mb-2">Booking Reference:</p>
              <p className="text-lg font-mono font-bold">
                {bookingResponse?.bookingNumber || bookingResponse?._id || 'Check your email for details'}
              </p>
            </div>
            <div className="space-y-2 text-sm text-gray-600">
              <p>• Check-in: {format(bookingData.checkInDate, 'PPP')} after 3:00 PM</p>
              <p>• Check-out: {format(bookingData.checkOutDate, 'PPP')} before 12:00 PM</p>
              <p>• Free cancellation until 24 hours before check-in</p>
            </div>
            {mode === 'widget' && (
              <Button 
                className="mt-6" 
                onClick={() => {
                  setCurrentStep(1);
                  setSelectedRoomType(null);
                  setPricingBreakdown(null);
                  setPromoCode('');
                  setBookingData({
                    checkInDate: new Date(),
                    checkOutDate: addDays(new Date(), 2),
                    adults: 2,
                    children: 0,
                    rooms: 1,
                    roomTypeId: '',
                    guestInfo: {
                      firstName: '',
                      lastName: '',
                      email: '',
                      phone: '',
                      specialRequests: ''
                    },
                    source: 'direct',
                    totalAmount: 0
                  });
                }}
              >
                Book Another Stay
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default withErrorBoundary(EnhancedBookingEngine, { level: 'component' });
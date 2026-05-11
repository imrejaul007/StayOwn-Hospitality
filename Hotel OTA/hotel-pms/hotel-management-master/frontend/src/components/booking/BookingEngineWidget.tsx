import React, { useState, useEffect } from 'react';
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
  CheckCircle
} from 'lucide-react';
import { format, addDays, differenceInDays } from 'date-fns';
import { formatCurrency } from '@/utils/currencyUtils';
import { bookingService } from '@/services/bookingService';
import { bookingEngineService } from '@/services/bookingEngineService';
import { withErrorBoundary } from '../ErrorBoundary';

interface Room {
  _id: string;
  roomNumber: string;
  type: string;
  name: string;
  description: string;
  baseRate: number;
  currentRate: number;
  discountedRate?: number;
  images: string[];
  amenities: string[];
  maxOccupancy: number;
  size: number;
  bedType: string;
  availability: number;
  isPopular: boolean;
  cancellationPolicy: string;
  isActive: boolean;
}

interface PromoCode {
  _id: string;
  code: string;
  name: string;
  description: string;
  type: 'percentage' | 'fixed_amount' | 'free_night' | 'upgrade';
  discount: {
    value: number;
    maxAmount?: number;
    freeNights?: number;
    upgradeRoomType?: string;
  };
  conditions: {
    minBookingValue?: number;
    minNights?: number;
    maxNights?: number;
    applicableRoomTypes?: string[];
    firstTimeGuests?: boolean;
    maxUsagePerGuest?: number;
    combinableWithOtherOffers?: boolean;
  };
  validity: {
    startDate: string;
    endDate: string;
  };
  usage: {
    totalUsageLimit?: number;
    currentUsage: number;
  };
  isActive: boolean;
}

interface UpsellOffer {
  _id: string;
  title: string;
  description: string;
  type: 'room_upgrade' | 'package' | 'amenity' | 'service';
  originalPrice: number;
  discountedPrice: number;
  savings: number;
  isPopular: boolean;
  validDuration: number; // hours
  category: string;
  image: string;
}

interface BookingData {
  checkIn: Date | null;
  checkOut: Date | null;
  adults: number;
  children: number;
  rooms: number;
  selectedRoom?: Room;
  appliedPromo?: PromoCode;
  selectedUpsells: UpsellOffer[];
  guestInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    specialRequests: string;
  };
  totalAmount: number;
  originalAmount: number;
  savings: number;
}

interface WidgetSettings {
  theme: 'light' | 'dark' | 'brand';
  primaryColor: string;
  position: 'floating' | 'embedded' | 'popup';
  showPromoCodes: boolean;
  showUpsells: boolean;
  enableEmailMarketing: boolean;
  autoApplyBestRate: boolean;
  showRoomComparison: boolean;
  displayCurrency: string;
  languages: string[];
}

const BookingEngineWidget: React.FC = () => {
  const [bookingData, setBookingData] = useState<BookingData>({
    checkIn: new Date(),
    checkOut: addDays(new Date(), 2),
    adults: 2,
    children: 0,
    rooms: 1,
    selectedUpsells: [],
    guestInfo: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      specialRequests: ''
    },
    totalAmount: 0,
    originalAmount: 0,
    savings: 0
  });

  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [upsellOffers, setUpsellOffers] = useState<UpsellOffer[]>([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [promoInput, setPromoInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [widgetSettings, setWidgetSettings] = useState<WidgetSettings>({
    theme: 'light',
    primaryColor: '#3b82f6',
    position: 'embedded',
    showPromoCodes: true,
    showUpsells: true,
    enableEmailMarketing: true,
    autoApplyBestRate: true,
    showRoomComparison: true,
    displayCurrency: 'INR',
    languages: ['en', 'hi']
  });

  const [showSettings, setShowSettings] = useState(false);
  const [widgetCode, setWidgetCode] = useState('');

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    calculateTotal();
  }, [bookingData.selectedRoom, bookingData.appliedPromo, bookingData.selectedUpsells, bookingData.checkIn, bookingData.checkOut]);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      // Load promo codes
      const promoResponse = await bookingEngineService.getPromoCodes();
      setPromoCodes(promoResponse);

      // Load upsell offers (you may need to create this endpoint)
      // For now, we'll use an empty array
      setUpsellOffers([]);

      generateWidgetCode();
    } catch (error) {
      toast.error('Failed to load initial data');
    } finally {
      setIsLoading(false);
    }
  };

  const searchRooms = async () => {
    if (!bookingData.checkIn || !bookingData.checkOut) {
      toast.error('Please select check-in and check-out dates');
      return;
    }

    // Validate check-in is not in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkInDateOnly = new Date(bookingData.checkIn);
    checkInDateOnly.setHours(0, 0, 0, 0);
    if (checkInDateOnly < today) {
      toast.error('Check-in date cannot be in the past');
      return;
    }

    // Validate checkout is after checkin
    if (differenceInDays(bookingData.checkOut, bookingData.checkIn) < 1) {
      toast.error('Check-out date must be at least 1 night after check-in');
      return;
    }

    setIsSearching(true);
    try {
      // Real API call to search rooms
      const filters = {
        checkIn: format(bookingData.checkIn, 'yyyy-MM-dd'),
        checkOut: format(bookingData.checkOut, 'yyyy-MM-dd'),
        adults: bookingData.adults,
        children: bookingData.children,
        rooms: bookingData.rooms
      };

      const response = await bookingService.getRooms(filters);
      const rooms = response.data.rooms || [];
      
      setAvailableRooms(rooms);
      
      // Auto-apply best available rate if enabled
      if (widgetSettings.autoApplyBestRate && rooms.length > 0) {
        const bestPromo = promoCodes.find(promo => 
          promo.isActive && 
          new Date() >= new Date(promo.validity.startDate) &&
          new Date() <= new Date(promo.validity.endDate) &&
          (!promo.conditions.minNights || differenceInDays(bookingData.checkOut!, bookingData.checkIn!) >= promo.conditions.minNights)
        );
        if (bestPromo) {
          applyPromoCode(bestPromo);
        }
      }
      
      setCurrentStep(2);
      toast.success(`Found ${rooms.length} available rooms`);
    } catch (error) {
      toast.error('Failed to search rooms');
    } finally {
      setIsSearching(false);
    }
  };

  const applyPromoCode = async (promo?: PromoCode) => {
    if (!promo) {
      // Find promo code by input
      const foundPromo = promoCodes.find(p => 
        p.code.toLowerCase() === promoInput.toLowerCase() && 
        p.isActive &&
        new Date() >= new Date(p.validity.startDate) &&
        new Date() <= new Date(p.validity.endDate)
      );
      
      if (!foundPromo) {
        toast.error('Invalid or expired promo code');
        return;
      }
      promo = foundPromo;
    }

    // Validate promo code with backend
    try {
      if (bookingData.selectedRoom) {
        const roomTotal = (bookingData.selectedRoom.currentRate || bookingData.selectedRoom.baseRate) * 
          differenceInDays(bookingData.checkOut!, bookingData.checkIn!) * bookingData.rooms;
        
        const validation = await bookingEngineService.validatePromoCode(
          promo.code,
          roomTotal,
          format(bookingData.checkIn!, 'yyyy-MM-dd'),
          format(bookingData.checkOut!, 'yyyy-MM-dd')
        );

        if (validation.valid) {
          setBookingData(prev => ({ ...prev, appliedPromo: promo }));
          setPromoInput('');
          toast.success(`Promo code ${promo.code} applied successfully!`);
        } else {
          toast.error(validation.message || 'Promo code validation failed');
        }
      } else {
        // Apply promo without room selection (will be validated later)
        setBookingData(prev => ({ ...prev, appliedPromo: promo }));
        setPromoInput('');
        toast.success(`Promo code ${promo.code} applied successfully!`);
      }
    } catch (error) {
      toast.error('Failed to validate promo code');
    }
  };

  const toggleUpsell = (upsell: UpsellOffer) => {
    setBookingData(prev => ({
      ...prev,
      selectedUpsells: prev.selectedUpsells.find(u => u._id === upsell._id)
        ? prev.selectedUpsells.filter(u => u._id !== upsell._id)
        : [...prev.selectedUpsells, upsell]
    }));
  };

  const calculateTotal = () => {
    if (!bookingData.checkIn || !bookingData.checkOut || !bookingData.selectedRoom) {
      return;
    }

    const nights = differenceInDays(bookingData.checkOut, bookingData.checkIn);
    if (nights < 1) return;

    const roomRate = bookingData.selectedRoom.discountedRate || bookingData.selectedRoom.currentRate || bookingData.selectedRoom.baseRate;
    let subtotal = Math.round(roomRate * nights * bookingData.rooms * 100) / 100;

    // Apply promo code discount
    let promoDiscount = 0;
    if (bookingData.appliedPromo) {
      if (bookingData.appliedPromo.type === 'percentage') {
        promoDiscount = Math.round((subtotal * bookingData.appliedPromo.discount.value) / 100 * 100) / 100;
        if (bookingData.appliedPromo.discount.maxAmount) {
          promoDiscount = Math.min(promoDiscount, bookingData.appliedPromo.discount.maxAmount);
        }
      } else if (bookingData.appliedPromo.type === 'fixed_amount') {
        promoDiscount = bookingData.appliedPromo.discount.value;
      }
    }

    // Ensure discount cannot exceed subtotal
    promoDiscount = Math.min(promoDiscount, subtotal);

    // Add upsells
    const upsellTotal = bookingData.selectedUpsells.reduce((sum, upsell) =>
      sum + upsell.discountedPrice, 0
    );

    const originalUpsellTotal = bookingData.selectedUpsells.reduce((sum, upsell) =>
      sum + upsell.originalPrice, 0
    );

    const originalTotal = Math.round((bookingData.selectedRoom.baseRate * nights * bookingData.rooms + originalUpsellTotal) * 100) / 100;

    // Calculate tax (18% GST)
    const taxableAmount = Math.round((subtotal - promoDiscount + upsellTotal) * 100) / 100;
    const taxAmount = Math.round(taxableAmount * 0.18 * 100) / 100;
    const finalTotal = Math.round((taxableAmount + taxAmount) * 100) / 100;
    const totalSavings = Math.max(0, Math.round((originalTotal - finalTotal) * 100) / 100);

    setBookingData(prev => ({
      ...prev,
      totalAmount: finalTotal,
      originalAmount: originalTotal,
      savings: totalSavings
    }));
  };

  const generateWidgetCode = () => {
    const settings = encodeURIComponent(JSON.stringify(widgetSettings));
    const code = `
<!-- Hotel Booking Widget -->
<div id="hotel-booking-widget"></div>
<script>
  (function() {
    var widget = document.createElement('iframe');
    widget.src = 'https://booking.yourhotel.com/widget?settings=${settings}';
    widget.style.width = '100%';
    widget.style.height = '600px';
    widget.style.border = 'none';
    widget.style.borderRadius = '8px';
    document.getElementById('hotel-booking-widget').appendChild(widget);
  })();
</script>
    `.trim();
    setWidgetCode(code);
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateGuestInfo = (): boolean => {
    const { firstName, lastName, email, phone } = bookingData.guestInfo;
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !phone.trim()) {
      toast.error('Please fill in all required guest fields');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Please enter a valid email address');
      return false;
    }
    if (!/^\+?[\d\s-]{7,15}$/.test(phone.trim())) {
      toast.error('Please enter a valid phone number');
      return false;
    }
    return true;
  };

  const submitBooking = async () => {
    if (!bookingData.selectedRoom || !bookingData.checkIn || !bookingData.checkOut) {
      toast.error('Missing booking details. Please go back and complete all steps.');
      return;
    }

    if (!validateGuestInfo()) return;

    setIsSubmitting(true);
    try {
      const nights = differenceInDays(bookingData.checkOut, bookingData.checkIn);
      const response = await bookingService.createBooking({
        checkIn: format(bookingData.checkIn, 'yyyy-MM-dd'),
        checkOut: format(bookingData.checkOut, 'yyyy-MM-dd'),
        roomIds: [bookingData.selectedRoom._id],
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
        totalAmount: bookingData.totalAmount,
        currency: widgetSettings.displayCurrency,
        source: 'direct',
        numberOfRooms: bookingData.rooms,
      } as any);

      toast.success('Booking confirmed successfully!');
      setCurrentStep(4);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Booking failed. Please try again.';
      toast.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getAmenityIcon = (amenity: string) => {
    const icons = {
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
    return icons[amenity as keyof typeof icons] || <Star className="w-4 h-4" />;
  };

  const renderStep1 = () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-center">Book Your Perfect Stay</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Date Selection */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Check-in Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  <CalendarIcon className="w-4 h-4 mr-2" />
                  {bookingData.checkIn ? format(bookingData.checkIn, 'PPP') : 'Select date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={bookingData.checkIn || undefined}
                  onSelect={(date) => setBookingData(prev => ({ ...prev, checkIn: date || null }))}
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
                  {bookingData.checkOut ? format(bookingData.checkOut, 'PPP') : 'Select date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={bookingData.checkOut || undefined}
                  onSelect={(date) => setBookingData(prev => ({ ...prev, checkOut: date || null }))}
                  disabled={(date) => date <= (bookingData.checkIn || new Date())}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Guest Details */}
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
                {[1, 2, 3, 4, 5, 6].map(num => (
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
                {[0, 1, 2, 3, 4].map(num => (
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

        {/* Promo Code */}
        {widgetSettings.showPromoCodes && (
          <div>
            <Label>Promo Code (Optional)</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Enter promo code"
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
              />
              <Button variant="outline" onClick={() => applyPromoCode()}>
                <Tag className="w-4 h-4 mr-2" />
                Apply
              </Button>
            </div>
            
            {/* Show available promos */}
            <div className="mt-2 space-y-1">
              {promoCodes.filter(promo => promo.isActive).slice(0, 2).map(promo => (
                <div role="button" tabIndex={0} key={promo._id} className="text-xs text-blue-600 cursor-pointer hover:underline" 
                     onClick={() => applyPromoCode(promo)} onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const clickHandler = () => applyPromoCode(promo); if (typeof clickHandler === 'function') { clickHandler(e as any); } } }}>
                  <Tag className="w-3 h-3 inline mr-1" />
                  {promo.code} - {promo.description}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search Button */}
        <Button 
          className="w-full" 
          onClick={searchRooms}
          disabled={isSearching || !bookingData.checkIn || !bookingData.checkOut}
        >
          {isSearching ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Searching Rooms...
            </>
          ) : (
            <>
              <Eye className="w-4 h-4 mr-2" />
              Search Available Rooms
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Choose Your Room</CardTitle>
            <Badge variant="outline">
              {bookingData.checkIn && bookingData.checkOut && 
                differenceInDays(bookingData.checkOut, bookingData.checkIn)} nights
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {availableRooms.map(room => (
            <div role="button" tabIndex={0} 
              key={room._id} 
              className={`border rounded-lg p-4 cursor-pointer transition-all ${
                bookingData.selectedRoom?._id === room._id 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setBookingData(prev => ({ ...prev, selectedRoom: room }))}
             onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const clickHandler = () => setBookingData(prev => ({ ...prev, selectedRoom: room })); if (typeof clickHandler === 'function') { clickHandler(e as any); } } }}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-medium text-lg">{room.name || `${room.type} - ${room.roomNumber}`}</h3>
                    {room.isPopular && (
                      <Badge className="bg-orange-100 text-orange-700">
                        <Star className="w-3 h-3 mr-1" />
                        Popular
                      </Badge>
                    )}
                  </div>
                  
                  <p className="text-gray-600 text-sm mb-3">{room.description}</p>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      Up to {room.maxOccupancy} guests
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {room.size} sqm
                    </span>
                    <span>{room.bedType}</span>
                  </div>
                  
                  <div className="flex gap-2 flex-wrap mb-3">
                    {room.amenities.slice(0, 6).map(amenity => (
                      <div key={amenity} className="flex items-center gap-1 text-xs bg-gray-100 px-2 py-1 rounded">
                        {getAmenityIcon(amenity)}
                        <span className="capitalize">{amenity.replace('_', ' ')}</span>
                      </div>
                    ))}
                    {room.amenities.length > 6 && (
                      <div className="text-xs text-gray-500 px-2 py-1">
                        +{room.amenities.length - 6} more
                      </div>
                    )}
                  </div>
                  
                  <div className="text-xs text-green-600 mb-2">
                    <Shield className="w-3 h-3 inline mr-1" />
                    {room.cancellationPolicy}
                  </div>
                  
                  <div className="text-xs text-gray-500">
                    Only {room.availability} rooms left at this price!
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="space-y-1">
                    {room.discountedRate && room.discountedRate < room.currentRate && (
                      <div className="text-sm text-gray-500 line-through">
                        {formatCurrency(room.currentRate)}
                      </div>
                    )}
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(room.discountedRate || room.currentRate || room.baseRate)}
                    </div>
                    <div className="text-xs text-gray-500">per night</div>
                  </div>
                  
                  {room.discountedRate && room.discountedRate < room.currentRate && (
                    <Badge className="bg-red-100 text-red-700 mt-2">
                      Save {formatCurrency(room.currentRate - room.discountedRate)}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Upsells */}
      {widgetSettings.showUpsells && upsellOffers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Enhance Your Stay
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {upsellOffers.map(upsell => (
              <div key={upsell._id} className="border rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={bookingData.selectedUpsells.some(u => u._id === upsell._id)}
                      onCheckedChange={() => toggleUpsell(upsell)}
                    />
                    
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{upsell.title}</h4>
                        {upsell.isPopular && (
                          <Badge variant="outline" className="text-xs">Popular</Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{upsell.description}</p>
                      <div className="text-xs text-gray-500 mt-1">
                        <Clock className="w-3 h-3 inline mr-1" />
                        Book within {upsell.validDuration} hours
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-sm text-gray-500 line-through">
                      {formatCurrency(upsell.originalPrice)}
                    </div>
                    <div className="font-bold text-green-600">
                      {formatCurrency(upsell.discountedPrice)}
                    </div>
                    <div className="text-xs text-red-600">
                      Save {formatCurrency(upsell.savings)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Booking Summary */}
      {bookingData.selectedRoom && (
        <Card>
          <CardHeader>
            <CardTitle>Booking Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span>Room: {bookingData.selectedRoom.name || `${bookingData.selectedRoom.type} - ${bookingData.selectedRoom.roomNumber}`}</span>
              <span>{formatCurrency((bookingData.selectedRoom.discountedRate || bookingData.selectedRoom.currentRate || bookingData.selectedRoom.baseRate) * differenceInDays(bookingData.checkOut!, bookingData.checkIn!) * bookingData.rooms)}</span>
            </div>
            
            {bookingData.appliedPromo && (
              <div className="flex justify-between text-green-600">
                <span>Promo: {bookingData.appliedPromo.code}</span>
                <span>-{formatCurrency(bookingData.originalAmount - bookingData.totalAmount + bookingData.selectedUpsells.reduce((sum, u) => sum + u.discountedPrice, 0))}</span>
              </div>
            )}
            
            {bookingData.selectedUpsells.map(upsell => (
              <div key={upsell._id} className="flex justify-between">
                <span>{upsell.title}</span>
                <span>{formatCurrency(upsell.discountedPrice)}</span>
              </div>
            ))}
            
            <Separator />
            
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <div className="text-right">
                {bookingData.savings > 0 && (
                  <div className="text-sm text-gray-500 line-through">
                    {formatCurrency(bookingData.originalAmount)}
                  </div>
                )}
                <div className="text-green-600">
                  {formatCurrency(bookingData.totalAmount)}
                </div>
                {bookingData.savings > 0 && (
                  <div className="text-xs text-red-600">
                    You save {formatCurrency(bookingData.savings)}!
                  </div>
                )}
              </div>
            </div>
            
            <Button 
              className="w-full" 
              disabled={!bookingData.selectedRoom}
              onClick={() => setCurrentStep(3)}
            >
              Continue to Guest Details
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderStep3 = () => (
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
        
        {widgetSettings.enableEmailMarketing && (
          <div className="flex items-center gap-2">
            <Checkbox id="newsletter" />
            <Label htmlFor="newsletter" className="text-sm">
              Subscribe to our newsletter for exclusive offers and updates
            </Label>
          </div>
        )}
        
        <div className="flex gap-3 pt-4">
          <Button variant="outline" onClick={() => setCurrentStep(2)} className="flex-1">
            Back to Rooms
          </Button>
          <Button
            onClick={submitBooking}
            className="flex-1"
            disabled={isSubmitting || !bookingData.guestInfo.firstName || !bookingData.guestInfo.lastName || !bookingData.guestInfo.email || !bookingData.guestInfo.phone}
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Confirming Booking...
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4 mr-2" />
                Confirm & Pay
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header with Settings */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Booking Engine Widget</h1>
          <p className="text-gray-600">Customizable booking widget for your website</p>
        </div>
        
        <div className="flex gap-2">
          <Dialog open={showSettings} onOpenChange={setShowSettings}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Settings className="w-4 h-4 mr-2" />
                Widget Settings
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Widget Configuration</DialogTitle>
                <DialogDescription>
                  Customize the appearance and functionality of your booking widget
                </DialogDescription>
              </DialogHeader>
              
              {/* Widget settings form would go here */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Theme</Label>
                    <Select value={widgetSettings.theme} onValueChange={(value: string) =>
                      setWidgetSettings(prev => ({ ...prev, theme: value as 'light' | 'dark' | 'brand' }))
                    }>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="brand">Brand Colors</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Position</Label>
                    <Select value={widgetSettings.position} onValueChange={(value: string) =>
                      setWidgetSettings(prev => ({ ...prev, position: value as 'floating' | 'embedded' | 'popup' }))
                    }>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="embedded">Embedded</SelectItem>
                        <SelectItem value="floating">Floating</SelectItem>
                        <SelectItem value="popup">Popup</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      checked={widgetSettings.showPromoCodes}
                      onCheckedChange={(checked) => 
                        setWidgetSettings(prev => ({ ...prev, showPromoCodes: !!checked }))
                      }
                    />
                    <Label>Show Promo Code Input</Label>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      checked={widgetSettings.showUpsells}
                      onCheckedChange={(checked) => 
                        setWidgetSettings(prev => ({ ...prev, showUpsells: !!checked }))
                      }
                    />
                    <Label>Enable Upsell Offers</Label>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      checked={widgetSettings.autoApplyBestRate}
                      onCheckedChange={(checked) => 
                        setWidgetSettings(prev => ({ ...prev, autoApplyBestRate: !!checked }))
                      }
                    />
                    <Label>Auto-apply Best Available Rate</Label>
                  </div>
                </div>
                
                <div>
                  <Label>Widget Embed Code</Label>
                  <Textarea 
                    value={widgetCode}
                    readOnly
                    rows={8}
                    className="font-mono text-xs"
                  />
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="mt-2"
                    onClick={() => {
                      navigator.clipboard.writeText(widgetCode);
                      toast.success('Widget code copied to clipboard!');
                    }}
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    Copy Code
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Widget Preview */}
      <Card className="border-2 border-dashed border-gray-300">
        <CardHeader>
          <CardTitle className="text-center text-gray-500">Widget Preview</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Step Indicator */}
          <div className="flex items-center justify-center mb-6">
            {[1, 2, 3, 4].map(step => (
              <div key={step} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === currentStep 
                    ? 'bg-blue-500 text-white' 
                    : step < currentStep 
                      ? 'bg-green-500 text-white' 
                      : 'bg-gray-200 text-gray-600'
                }`}>
                  {step < currentStep ? <CheckCircle className="w-4 h-4" /> : step}
                </div>
                {step < 4 && (
                  <div className={`w-12 h-1 mx-2 ${
                    step < currentStep ? 'bg-green-500' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>

          {/* Step Content */}
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && (
            <Card>
              <CardContent className="p-6 text-center">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">Booking Complete!</h3>
                <p className="text-gray-600">Thank you for your reservation. You'll receive a confirmation email shortly.</p>
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">Booking confirmed - check your email for details</p>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default withErrorBoundary(BookingEngineWidget, { level: 'component' });
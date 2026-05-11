export interface Room {
  _id: string;
  hotelId: string;
  roomNumber: string;
  type: 'single' | 'double' | 'suite' | 'deluxe';
  baseRate: number;
  currentRate: number;
  status: 'vacant' | 'occupied' | 'dirty' | 'maintenance' | 'out_of_order';
  floor?: number;
  capacity: number;
  amenities: string[];
  images: string[];
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Booking {
  _id: string;
  hotelId: string | {
    _id: string;
    name: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      country?: string;
    } | string;
    contact?: {
      phone?: string;
      email?: string;
    };
  };
  userId: string | {
    _id: string;
    name: string;
    email?: string;
    phone?: string;
  };
  bookingNumber: string;
  rooms: {
    roomId: Room;
    rate: number;
  }[];
  checkIn: string;
  checkOut: string;
  nights: number;
  status: 'pending' | 'confirmed' | 'modified' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show';
  paymentStatus: 'pending' | 'paid' | 'partially_paid' | 'refunded' | 'failed';
  totalAmount: number;
  currency: string;
  stripePaymentId?: string;
  guestDetails: {
    adults: number;
    children: number;
    specialRequests?: string;
  };
  extras?: {
    name: string;
    price: number;
    quantity: number;
  }[];
  source: 'direct' | 'walk_in' | 'booking_com' | 'expedia' | 'airbnb';
  createdAt: string;
  updatedAt: string;
  // Price adjustment fields
  originalAmount?: number;
  discountAmount?: number;
  surchargeAmount?: number;
  priceAdjustments?: Array<{
    _id: string;
    amount: number;
    reason: string;
    type: 'discount' | 'surcharge';
    adjustedBy: string;
    adjustedAt: string;
    isReversed?: boolean;
  }>;
}

export interface BookingFilters {
  checkIn?: string;
  checkOut?: string;
  roomType?: string;
  minPrice?: number;
  maxPrice?: number;
  adults?: number;
  children?: number;
}

export interface CreateBookingRequest {
  hotelId?: string;
  roomIds?: string[];
  roomId?: string; // Single room ID (will be converted to roomIds array)
  checkIn: string;
  checkOut: string;
  guestDetails: {
    adults: number;
    children: number;
    specialRequests?: string;
  };
  roomType?: 'single' | 'double' | 'suite' | 'deluxe'; // Room type preference for room-type bookings
  /** RoomType ObjectId when using live catalog / inventory holds */
  roomTypeId?: string;
  primaryRoomQuantity?: number;
  totalAmount: number;
  currency?: string;
  idempotencyKey?: string;
}
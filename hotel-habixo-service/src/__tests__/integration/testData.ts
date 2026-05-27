// Mock data generators for tests
import { v4 as uuidv4 } from 'uuid';
import { IProperty } from '../../models/Property';
import { IBooking } from '../../models/Booking';
import { IFlatmateProfile } from '../../models/FlatmateProfile';

/**
 * Generate a random property ID
 */
export function generatePropertyId(): string {
  return `HAB-${uuidv4().substring(0, 8).toUpperCase()}`;
}

/**
 * Generate a random booking ID
 */
export function generateBookingId(): string {
  return `HBK-${uuidv4().substring(0, 8).toUpperCase()}`;
}

/**
 * Generate a random flatmate profile ID
 */
export function generateFlatmateId(): string {
  return `FLT-${uuidv4().substring(0, 8).toUpperCase()}`;
}

/**
 * Generate mock property data
 */
export function createMockProperty(overrides: Partial<IProperty> = {}): Partial<IProperty> {
  const propertyId = generatePropertyId();
  const hostId = `host_${uuidv4().substring(0, 8)}`;

  return {
    propertyId,
    hostId,
    brand: 'habixo_stay',
    title: `Modern Apartment in ${overrides.location?.city || 'Bangalore'}`,
    description: 'A beautiful apartment with all modern amenities',
    propertyType: 'apartment',
    roomType: 'entire_place',
    location: {
      address: '123 Main Street',
      city: 'Bangalore',
      state: 'Karnataka',
      country: 'India',
      pincode: '560001',
      lat: 12.9716 + (Math.random() - 0.5) * 0.1,
      lng: 77.5946 + (Math.random() - 0.5) * 0.1,
      neighborhood: 'Koramangala',
      ...overrides.location,
    },
    bedrooms: 2,
    bathrooms: 2,
    maxGuests: 4,
    beds: 2,
    amenities: ['wifi', 'ac', 'tv', 'kitchen', 'parking'],
    pricing: {
      basePrice: 2000 + Math.floor(Math.random() * 3000),
      cleaningFee: 500,
      serviceFee: 200,
      weeklyDiscount: 10,
      monthlyDiscount: 20,
      currency: 'INR',
      ...overrides.pricing,
    },
    availability: {
      checkInTime: '14:00',
      checkOutTime: '11:00',
      minNights: 1,
      maxNights: 30,
      ...overrides.availability,
    },
    rentalType: 'short_term',
    status: 'active',
    qualityScore: 75,
    trustScore: 80,
    verified: true,
    stats: {
      totalBookings: 0,
      rating: 4.5,
      reviewCount: 10,
      responseRate: 95,
      responseTime: 'within an hour',
      ...overrides.stats,
    },
    photos: [
      {
        url: 'https://example.com/photo1.jpg',
        caption: 'Living Room',
        isPrimary: true,
      },
    ],
    ...overrides,
  };
}

/**
 * Generate mock booking data
 */
export function createMockBooking(overrides: Partial<IBooking> & { property?: Partial<IProperty> } = {}): Partial<IBooking> {
  const bookingId = generateBookingId();
  const propertyId = generatePropertyId();
  const guestId = `guest_${uuidv4().substring(0, 8)}`;
  const hostId = `host_${uuidv4().substring(0, 8)}`;

  const checkIn = new Date();
  checkIn.setDate(checkIn.getDate() + 7);
  const checkOut = new Date(checkIn);
  checkOut.setDate(checkOut.getDate() + 3);
  const totalNights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

  const basePrice = overrides.property?.pricing?.basePrice || 2000;
  const subtotal = basePrice * totalNights;
  const cleaningFee = overrides.property?.pricing?.cleaningFee || 500;
  const serviceFee = subtotal * 0.03;
  const discount = totalNights >= 7 ? subtotal * 0.1 : 0;
  const taxes = (subtotal - discount + serviceFee) * 0.18;
  const total = subtotal - discount + cleaningFee + serviceFee + taxes;

  return {
    bookingId,
    propertyId,
    hostId,
    guestId,
    brand: 'habixo_stay',
    checkIn,
    checkOut,
    totalNights,
    guests: {
      adults: 2,
      children: 0,
      infants: 0,
      ...overrides.guests,
    },
    pricing: {
      nightlyRate: basePrice,
      cleaningFee,
      serviceFee,
      taxes,
      discount,
      subtotal,
      total,
      currency: 'INR',
      ...overrides.pricing,
    },
    lifecycleHooks: {
      coinsRewarded: false,
      streakUpdated: false,
      karmaUpdated: false,
      nudgeScheduled: false,
      ...overrides.lifecycleHooks,
    },
    status: 'confirmed',
    source: 'app',
    ...overrides,
  };
}

/**
 * Generate mock flatmate profile data
 */
export function createMockFlatmateProfile(overrides: Partial<IFlatmateProfile> = {}): Partial<IFlatmateProfile> {
  const profileId = generateFlatmateId();
  const userId = `user_${uuidv4().substring(0, 8)}`;

  return {
    profileId,
    userId,
    lifestyle: {
      vibeTags: ['chill', 'professional'],
      sleepSchedule: 'flexible',
      workFromHome: true,
      smoking: 'never',
      drinking: 'occasionally',
      pets: false,
      ...overrides.lifestyle,
    },
    preferences: {
      minBudget: 10000,
      maxBudget: 20000,
      preferredAreas: ['Bangalore', 'HSR', 'Koramangala'],
      ...overrides.preferences,
    },
    trustScore: 75,
    verified: false,
    status: 'active',
    ...overrides,
  };
}

/**
 * Generate multiple mock properties
 */
export function createMockProperties(count: number, overrides: Partial<IProperty> = {}): Partial<IProperty>[] {
  return Array.from({ length: count }, (_, i) => {
    const cities = ['Bangalore', 'Mumbai', 'Delhi', 'Chennai', 'Hyderabad'];
    return createMockProperty({
      ...overrides,
      location: {
        ...overrides.location,
        city: cities[i % cities.length],
      },
    });
  });
}

/**
 * Generate date range for bookings
 */
export function createDateRange(daysFromNow: number, nights: number): { checkIn: Date; checkOut: Date } {
  const checkIn = new Date();
  checkIn.setDate(checkIn.getDate() + daysFromNow);
  checkIn.setHours(14, 0, 0, 0);

  const checkOut = new Date(checkIn);
  checkOut.setDate(checkOut.getDate() + nights);
  checkOut.setHours(11, 0, 0, 0);

  return { checkIn, checkOut };
}

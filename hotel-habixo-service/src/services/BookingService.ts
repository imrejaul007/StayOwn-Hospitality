import { v4 as uuidv4 } from 'uuid';
import { Booking, IBooking, Property } from '../models';
import { NotFoundError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';
import { creditWallet, RewardAmounts } from '../integrations/rez-wallet';
import { incrementStreak } from '../integrations/rez-gamification';
import { addKarmaPoints } from '../integrations/rez-karma';
import { captureIntent, HabixoIntents } from '../integrations/rez-mind';
import { getGuestProfileForBooking } from '../integrations/rez-profile';
import { notificationService } from './NotificationService';

const bookingLogger = logger.child({ service: 'BookingService' });

export interface CreateBookingInput {
  propertyId: string;
  guestId: string;
  hostId: string;
  brand: 'habixo_stay' | 'habixo_rent' | 'habixo_hourly';
  checkIn: string;
  checkOut: string;
  guests?: {
    adults: number;
    children?: number;
    infants?: number;
  };
  source?: string;
}

export interface CreateHourlyBookingInput {
  propertyId: string;
  guestId: string;
  hostId: string;
  brand: 'habixo_hourly';
  bookingDate: string;
  startTime: string;
  endTime: string;
  guests?: {
    adults: number;
  };
  source?: string;
}

export interface BookingSearchInput {
  propertyId?: string;
  guestId?: string;
  hostId?: string;
  status?: string;
  brand?: string;
  page?: number;
  limit?: number;
}

/**
 * Create a new booking
 */
export async function createBooking(input: CreateBookingInput): Promise<IBooking> {
  const property = await Property.findOne({ propertyId: input.propertyId }).lean();
  if (!property) {
    throw new NotFoundError('Property', input.propertyId);
  }

  if (property.status !== 'active') {
    throw new ValidationError('Property is not available for booking');
  }

  const checkInDate = new Date(input.checkIn);
  const checkOutDate = new Date(input.checkOut);
  const totalNights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));

  if (totalNights < property.availability.minNights) {
    throw new ValidationError(`Minimum stay is ${property.availability.minNights} nights`);
  }

  if (totalNights > property.availability.maxNights) {
    throw new ValidationError(`Maximum stay is ${property.availability.maxNights} nights`);
  }

  const bookingId = `HBK-${uuidv4().substring(0, 8).toUpperCase()}`;

  // Calculate pricing
  let subtotal = property.pricing.basePrice * totalNights;
  const cleaningFee = property.pricing.cleaningFee || 0;
  const serviceFee = property.pricing.serviceFee || subtotal * 0.03; // 3% service fee

  // Apply discounts
  let discount = 0;
  if (totalNights >= 28 && property.pricing.monthlyDiscount) {
    discount = subtotal * (property.pricing.monthlyDiscount / 100);
  } else if (totalNights >= 7 && property.pricing.weeklyDiscount) {
    discount = subtotal * (property.pricing.weeklyDiscount / 100);
  }

  const taxes = (subtotal - discount + serviceFee) * 0.18; // 18% GST
  const total = subtotal - discount + cleaningFee + serviceFee + taxes;

  const booking = new Booking({
    bookingId,
    propertyId: input.propertyId,
    propertyTitle: property.title || property.propertyId,
    propertyImage: property.photos?.[0]?.url || undefined,
    hostId: input.hostId,
    guestId: input.guestId,
    brand: input.brand,
    checkIn: checkInDate,
    checkOut: checkOutDate,
    totalNights,
    guests: {
      adults: input.guests.adults,
      children: input.guests.children || 0,
      infants: input.guests.infants || 0,
    },
    pricing: {
      nightlyRate: property.pricing.basePrice,
      cleaningFee,
      serviceFee,
      taxes,
      discount,
      subtotal,
      total,
      currency: property.pricing.currency || 'INR',
    },
    status: 'confirmed',
    source: input.source || 'app',
    lifecycleHooks: {
      coinsRewarded: false,
      streakUpdated: false,
      karmaUpdated: false,
      nudgeScheduled: false,
      notificationSent: false,
      reviewRequested: false,
    },
  });

  await booking.save();

  // Trigger lifecycle hooks
  await triggerBookingConfirmedLifecycle(booking);

  bookingLogger.info({ bookingId, propertyId: input.propertyId, guestId: input.guestId }, 'Booking created');

  return booking;
}

/**
 * Trigger lifecycle hooks when booking is confirmed
 */
async function triggerBookingConfirmedLifecycle(booking: IBooking): Promise<void> {
  try {
    // 1. Credit coins to guest
    await creditWallet(booking.guestId, RewardAmounts.BOOKING_CONFIRMED, 'rez', 'Booking confirmed reward');
    await Booking.updateOne(
      { bookingId: booking.bookingId },
      { $set: { 'lifecycleHooks.coinsRewarded': true } }
    );

    // 2. Increment streak
    await incrementStreak(booking.guestId, 'habixo_booking');
    await Booking.updateOne(
      { bookingId: booking.bookingId },
      { $set: { 'lifecycleHooks.streakUpdated': true } }
    );

    // 3. Add karma points
    await addKarmaPoints(booking.guestId, 50, 'Booking completed');
    await Booking.updateOne(
      { bookingId: booking.bookingId },
      { $set: { 'lifecycleHooks.karmaUpdated': true } }
    );

    // 4. Capture intent for future nudges
    await captureIntent({
      userId: booking.guestId,
      ...HabixoIntents.stayBooked(booking.propertyId, booking.bookingId),
    });

    // 5. Send booking confirmation notification
    const notificationResult = await notificationService.notifyBookingConfirmed(booking);
    if (notificationResult.success) {
      await Booking.updateOne(
        { bookingId: booking.bookingId },
        { $set: { 'lifecycleHooks.notificationSent': true } }
      );
    }

    bookingLogger.info({ bookingId: booking.bookingId }, 'Lifecycle hooks triggered');
  } catch (error) {
    bookingLogger.error({ error, bookingId: booking.bookingId }, 'Lifecycle hooks failed');
  }
}

/**
 * Schedule booking reminder notifications
 * This should be called by a scheduled job
 */
export async function scheduleBookingReminders(daysBefore: number[] = [7, 3, 1]): Promise<void> {
  const now = new Date();

  for (const days of daysBefore) {
    const targetDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    const bookings = await Booking.find({
      status: 'confirmed',
      checkIn: { $gte: startOfDay, $lte: endOfDay },
    }).lean();

    for (const booking of bookings as unknown as IBooking[]) {
      await notificationService.notifyBookingReminder(booking, days);
    }
  }

  bookingLogger.info({ daysBefore }, 'Booking reminders scheduled');
}

/**
 * Get booking by ID
 */
export async function getBookingById(bookingId: string): Promise<IBooking> {
  const booking = await Booking.findOne({ bookingId }).lean();
  if (!booking) {
    throw new NotFoundError('Booking', bookingId);
  }
  return booking as unknown as IBooking;
}

/**
 * Get booking with guest profile
 * Returns booking data enriched with guest profile information from ReZ Profile Service
 */
export async function getBookingWithGuestProfile(bookingId: string): Promise<{
  booking: IBooking;
  guestProfile: {
    userId: string;
    firstName: string;
    avatar?: string;
    isVerified: boolean;
    memberSince: string;
  } | null;
}> {
  const booking = await getBookingById(bookingId);

  // Get guest profile from ReZ Profile Service
  const guestProfile = await getGuestProfileForBooking(booking.guestId);

  return { booking, guestProfile };
}

/**
 * Cancel booking
 */
export async function cancelBooking(
  bookingId: string,
  cancelledBy: 'guest' | 'host',
  cancellationReason?: string
): Promise<IBooking> {
  const booking = await Booking.findOneAndUpdate(
    { bookingId },
    { $set: { status: 'cancelled' } },
    { new: true }
  );

  if (!booking) {
    throw new NotFoundError('Booking', bookingId);
  }

  // Deduct karma points
  await addKarmaPoints(booking.guestId, -100, 'Booking cancellation');

  // Send cancellation notification
  await notificationService.notifyBookingCancellation(booking, cancelledBy, {
    cancellationReason,
  });

  bookingLogger.info({ bookingId, cancelledBy }, 'Booking cancelled');
  return booking as unknown as IBooking;
}

/**
 * Complete booking
 */
export async function completeBooking(bookingId: string): Promise<IBooking> {
  const booking = await Booking.findOneAndUpdate(
    { bookingId },
    { $set: { status: 'completed' } },
    { new: true }
  );

  if (!booking) {
    throw new NotFoundError('Booking', bookingId);
  }

  // Update property stats
  await Property.updateOne(
    { propertyId: booking.propertyId },
    { $inc: { 'stats.totalBookings': 1 } }
  );

  bookingLogger.info({ bookingId }, 'Booking completed');
  return booking as unknown as IBooking;
}

/**
 * Search bookings
 */
export async function searchBookings(input: BookingSearchInput): Promise<{
  bookings: IBooking[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const {
    propertyId,
    guestId,
    hostId,
    status,
    brand,
    page = 1,
    limit = 20,
  } = input;

  const query: Record<string, unknown> = {};
  if (propertyId) query.propertyId = propertyId;
  if (guestId) query.guestId = guestId;
  if (hostId) query.hostId = hostId;
  if (status) query.status = status;
  if (brand) query.brand = brand;

  const skip = (page - 1) * limit;

  const [bookings, total] = await Promise.all([
    Booking.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Booking.countDocuments(query),
  ]);

  return {
    bookings: bookings as unknown as IBooking[],
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Create hourly booking (co-working, day-use, studios)
 */
export async function createHourlyBooking(input: CreateHourlyBookingInput): Promise<IBooking> {
  const property = await Property.findOne({ propertyId: input.propertyId }).lean();
  if (!property) {
    throw new NotFoundError('Property', input.propertyId);
  }

  if (property.status !== 'active') {
    throw new ValidationError('Property is not available for booking');
  }

  // Check if property supports hourly booking
  if (!property.hourlyEnabled) {
    throw new ValidationError('Property does not support hourly booking');
  }

  const hourlyPricing = property.hourlyPricing!;
  const hourlyAvailability = property.hourlyAvailability!;

  // Calculate total hours
  const [startHour, startMin] = input.startTime.split(':').map(Number);
  const [endHour, endMin] = input.endTime.split(':').map(Number);
  const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
  const totalHours = totalMinutes / 60;

  if (totalHours < hourlyPricing.minHours) {
    throw new ValidationError(`Minimum booking is ${hourlyPricing.minHours} hours`);
  }

  if (totalHours > hourlyPricing.maxHours) {
    throw new ValidationError(`Maximum booking is ${hourlyPricing.maxHours} hours`);
  }

  // Calculate price
  let hourlyRate = hourlyPricing.hourlyRate;
  let subtotal = totalHours * hourlyRate;

  // Apply half-day or full-day rates
  if (totalHours >= 8 && hourlyPricing.fullDayRate) {
    subtotal = hourlyPricing.fullDayRate;
  } else if (totalHours >= 4 && hourlyPricing.halfDayRate) {
    subtotal = hourlyPricing.halfDayRate;
  } else if (hourlyPricing.hourlyDiscount && totalHours > 2) {
    const discount = subtotal * (hourlyPricing.hourlyDiscount / 100);
    subtotal = subtotal - discount;
  }

  // Calculate fees
  const serviceFee = Math.round(subtotal * 0.1); // 10% service fee
  const taxes = Math.round((subtotal + serviceFee) * 0.18); // 18% GST
  const total = subtotal + serviceFee + taxes;

  // Create booking dates
  const bookingDate = new Date(input.bookingDate);
  const [sh, sm] = input.startTime.split(':').map(Number);
  const [eh, em] = input.endTime.split(':').map(Number);
  const checkIn = new Date(bookingDate);
  checkIn.setHours(sh, sm, 0, 0);
  const checkOut = new Date(bookingDate);
  checkOut.setHours(eh, em, 0, 0);

  const bookingId = `HBK-${Date.now()}-${uuidv4().slice(0, 8).toUpperCase()}`;

  const booking = await Booking.create({
    bookingId,
    propertyId: property.propertyId,
    propertyTitle: property.title,
    propertyImage: property.photos?.[0]?.url,
    hostId: property.hostId,
    guestId: input.guestId,
    brand: 'habixo_hourly',
    checkIn,
    checkOut,
    totalHours,
    bookingType: 'hourly',
    startTime: input.startTime,
    endTime: input.endTime,
    hourlyRate: hourlyRate,
    guests: input.guests || { adults: 1 },
    pricing: {
      hourlyRate,
      totalHours,
      subtotal: subtotal,
      serviceFee,
      taxes,
      total,
      currency: 'INR',
    },
    lifecycleHooks: {
      coinsRewarded: false,
      streakUpdated: false,
      karmaUpdated: false,
      nudgeScheduled: false,
      notificationSent: false,
      reviewRequested: false,
    },
    status: 'confirmed',
    source: input.source || 'app',
  });

  // Capture intent
  await captureIntent(HabixoIntents.HOURLY_BOOKING, {
    propertyId: property.propertyId,
    guestId: input.guestId,
    bookingId,
    totalHours,
    total,
  });

  bookingLogger.info({ bookingId, propertyId: property.propertyId, totalHours, total });

  return booking as unknown as IBooking;
}

/**
 * Get available time slots for a property on a date
 */
export async function getAvailableTimeSlots(
  propertyId: string,
  date: string
): Promise<{ time: string; available: boolean }[]> {
  const property = await Property.findOne({ propertyId }).lean();
  if (!property || !property.hourlyEnabled) {
    throw new NotFoundError('Property', propertyId);
  }

  const hourlyAvailability = property.hourlyAvailability!;
  const [startHour] = hourlyAvailability.startTime.split(':').map(Number);
  const [endHour] = hourlyAvailability.endTime.split(':').map(Number);
  const bufferTime = hourlyAvailability.bufferTime || 30;

  // Get confirmed bookings for that date
  const targetDate = new Date(date);
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const bookings = await Booking.find({
    propertyId,
    brand: 'habixo_hourly',
    status: { $in: ['confirmed', 'pending'] },
    checkIn: { $gte: startOfDay, $lte: endOfDay },
  }).lean();

  const bookedSlots = (bookings as unknown as IBooking[]).map(b => ({
    start: b.startTime!,
    end: b.endTime!,
  }));

  const slots: { time: string; available: boolean }[] = [];

  for (let hour = startHour; hour < endHour; hour++) {
    const slotTime = `${hour.toString().padStart(2, '0')}:00`;
    const slotEndTime = `${(hour + 1).toString().padStart(2, '0')}:00`;

    const isBooked = bookedSlots.some(slot => {
      const slotStart = parseInt(slot.start.split(':')[0]);
      const slotEnd = parseInt(slot.end.split(':')[0]);
      return hour >= slotStart && hour < slotEnd;
    });

    slots.push({ time: slotTime, available: !isBooked });
  }

  return slots;
}

/**
 * Calculate hourly price estimate
 */
export async function calculateHourlyPrice(
  propertyId: string,
  hours: number
): Promise<{
  hourlyRate: number;
  subtotal: number;
  serviceFee: number;
  taxes: number;
  total: number;
}> {
  const property = await Property.findOne({ propertyId }).lean();
  if (!property || !property.hourlyEnabled) {
    throw new NotFoundError('Property', propertyId);
  }

  const hourlyPricing = property.hourlyPricing!;
  let hourlyRate = hourlyPricing.hourlyRate;
  let subtotal = hours * hourlyRate;

  // Apply rates based on duration
  if (hours >= 8 && hourlyPricing.fullDayRate) {
    subtotal = hourlyPricing.fullDayRate;
  } else if (hours >= 4 && hourlyPricing.halfDayRate) {
    subtotal = hourlyPricing.halfDayRate;
  } else if (hourlyPricing.hourlyDiscount && hours > 2) {
    const discount = subtotal * (hourlyPricing.hourlyDiscount / 100);
    subtotal = subtotal - discount;
  }

  const serviceFee = Math.round(subtotal * 0.1);
  const taxes = Math.round((subtotal + serviceFee) * 0.18);
  const total = subtotal + serviceFee + taxes;

  return { hourlyRate, subtotal, serviceFee, taxes, total };
}

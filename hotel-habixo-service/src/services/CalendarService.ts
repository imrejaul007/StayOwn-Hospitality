import { v4 as uuidv4 } from 'uuid';
import mongoose, { Schema, Document } from 'mongoose';
import { NotFoundError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';
import { Booking, Property } from '../models';

const calendarLogger = logger.child({ service: 'CalendarService' });

// ── Calendar Model ──────────────────────────────────────────────────────────────

export interface ICalendarEntry extends Document {
  calendarId: string;
  propertyId: string;
  date: Date;
  available: boolean;
  price?: number;
  bookingId?: string;
  note?: string;
  source: 'booking' | 'manual' | 'sync';
  createdAt: Date;
  updatedAt: Date;
}

const CalendarEntrySchema = new Schema<ICalendarEntry>(
  {
    calendarId: { type: String, required: true, unique: true },
    propertyId: { type: String, required: true, index: true },
    date: { type: Date, required: true },
    available: { type: Boolean, default: true },
    price: { type: Number },
    bookingId: { type: String, index: true },
    note: { type: String, maxlength: 200 },
    source: {
      type: String,
      enum: ['booking', 'manual', 'sync'],
      default: 'manual',
    },
  },
  { timestamps: true }
);

CalendarEntrySchema.index({ calendarId: 1 }, { unique: true });
CalendarEntrySchema.index({ propertyId: 1, date: 1 }, { unique: true });
CalendarEntrySchema.index({ propertyId: 1, available: 1 });
CalendarEntrySchema.index({ bookingId: 1 });

export const CalendarEntry = mongoose.model<ICalendarEntry>(
  'CalendarEntry',
  CalendarEntrySchema
);

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AvailabilityQuery {
  propertyId: string;
  startDate: Date;
  endDate: Date;
}

export interface CalendarUpdateInput {
  propertyId: string;
  updates: Array<{
    date: string;
    available?: boolean;
    price?: number;
    note?: string;
  }>;
}

export interface BlockedDatesInput {
  propertyId: string;
  startDate: Date;
  endDate: Date;
  reason?: string;
}

// ── Service Functions ───────────────────────────────────────────────────────────

/**
 * Get availability calendar for a property
 */
export async function getAvailability(
  propertyId: string,
  startDate: Date,
  endDate: Date
): Promise<{
  property: {
    propertyId: string;
    title: string;
    availability: {
      checkInTime: string;
      checkOutTime: string;
      minNights: number;
      maxNights: number;
    };
    pricing: {
      basePrice: number;
      currency: string;
    };
  };
  dates: Array<{
    date: string;
    available: boolean;
    price?: number;
    bookingId?: string;
    note?: string;
  }>;
  blockedCount: number;
  availableCount: number;
}> {
  // Verify property exists
  const property = await Property.findOne({ propertyId }).lean();
  if (!property) {
    throw new NotFoundError('Property', propertyId);
  }

  // Get calendar entries
  const entries = await CalendarEntry.find({
    propertyId,
    date: { $gte: startDate, $lte: endDate },
  }).lean();

  // Get confirmed/completed bookings for the date range
  const bookings = await Booking.find({
    propertyId,
    status: { $in: ['confirmed', 'pending'] },
    $or: [
      { checkIn: { $lte: endDate }, checkOut: { $gte: startDate } },
    ],
  }).lean();

  // Build date map from entries
  const entryMap = new Map<string, ICalendarEntry>();
  for (const entry of entries) {
    const dateKey = entry.date.toISOString().split('T')[0];
    entryMap.set(dateKey, entry as ICalendarEntry);
  }

  // Build date map from bookings
  const bookingMap = new Map<string, string>();
  for (const booking of bookings) {
    const checkIn = new Date(booking.checkIn);
    const checkOut = new Date(booking.checkOut);
    const current = new Date(checkIn);

    while (current < checkOut) {
      const dateKey = current.toISOString().split('T')[0];
      bookingMap.set(dateKey, booking.bookingId);
      current.setDate(current.getDate() + 1);
    }
  }

  // Generate all dates in range
  const dates: Array<{
    date: string;
    available: boolean;
    price?: number;
    bookingId?: string;
    note?: string;
  }> = [];

  let blockedCount = 0;
  let availableCount = 0;

  const current = new Date(startDate);
  while (current <= endDate) {
    const dateKey = current.toISOString().split('T')[0];
    const entry = entryMap.get(dateKey);
    const bookingId = bookingMap.get(dateKey);

    let available = !bookingId;
    let price = property.pricing.basePrice;
    let note: string | undefined;
    let entryBookingId: string | undefined;

    if (entry) {
      available = entry.available;
      if (entry.price) price = entry.price;
      if (entry.note) note = entry.note;
      if (entry.bookingId) entryBookingId = entry.bookingId;
    }

    if (bookingId) {
      available = false;
      entryBookingId = bookingId;
    }

    dates.push({
      date: dateKey,
      available,
      price,
      bookingId: entryBookingId,
      note,
    });

    if (available) {
      availableCount++;
    } else {
      blockedCount++;
    }

    current.setDate(current.getDate() + 1);
  }

  return {
    property: {
      propertyId: property.propertyId,
      title: property.title,
      availability: property.availability,
      pricing: {
        basePrice: property.pricing.basePrice,
        currency: property.pricing.currency,
      },
    },
    dates,
    blockedCount,
    availableCount,
  };
}

/**
 * Update calendar entries for a property
 */
export async function updateCalendar(
  input: CalendarUpdateInput
): Promise<ICalendarEntry[]> {
  const { propertyId, updates } = input;

  // Verify property exists and belongs to host
  const property = await Property.findOne({ propertyId }).lean();
  if (!property) {
    throw new NotFoundError('Property', propertyId);
  }

  const results: ICalendarEntry[] = [];

  for (const update of updates) {
    const date = new Date(update.date);
    date.setHours(0, 0, 0, 0);

    // Check if date is booked
    const conflictingBooking = await Booking.findOne({
      propertyId,
      status: { $in: ['confirmed', 'pending'] },
      checkIn: { $lte: date },
      checkOut: { $gt: date },
    }).lean();

    if (conflictingBooking && update.available === false) {
      calendarLogger.warn(
        { propertyId, date, bookingId: conflictingBooking.bookingId },
        'Cannot block date with existing booking'
      );
      continue;
    }

    const calendarId = `CAL-${uuidv4().substring(0, 8).toUpperCase()}`;

    const entry = await CalendarEntry.findOneAndUpdate(
      { propertyId, date },
      {
        $set: {
          available: update.available !== undefined ? update.available : true,
          price: update.price,
          note: update.note,
          source: 'manual',
        },
      },
      { upsert: true, new: true }
    );

    results.push(entry as unknown as ICalendarEntry);
  }

  calendarLogger.info(
    { propertyId, updatedCount: results.length },
    'Calendar updated'
  );

  return results;
}

/**
 * Block dates (unavailable)
 */
export async function blockDates(input: BlockedDatesInput): Promise<number> {
  const { propertyId, startDate, endDate, reason } = input;

  // Verify property exists
  const property = await Property.findOne({ propertyId }).lean();
  if (!property) {
    throw new NotFoundError('Property', propertyId);
  }

  // Check for conflicting bookings
  const conflictingBookings = await Booking.find({
    propertyId,
    status: { $in: ['confirmed', 'pending'] },
    $or: [
      {
        checkIn: { $lte: endDate, $gte: startDate },
      },
      {
        checkOut: { $gte: startDate, $lte: endDate },
      },
      {
        checkIn: { $lte: startDate },
        checkOut: { $gte: endDate },
      },
    ],
  }).lean();

  if (conflictingBookings.length > 0) {
    throw new ConflictError(
      `Cannot block dates. Found ${conflictingBookings.length} conflicting booking(s)`
    );
  }

  // Generate all dates
  const dates: Date[] = [];
  const current = new Date(startDate);
  while (current <= endDate) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  // Bulk upsert
  const operations = dates.map((date) => ({
    updateOne: {
      filter: { propertyId, date },
      update: {
        $set: {
          available: false,
          note: reason,
          source: 'manual',
        },
      },
      upsert: true,
    },
  }));

  const result = await CalendarEntry.bulkWrite(operations);

  calendarLogger.info(
    { propertyId, startDate, endDate, blockedCount: result.modifiedCount + result.upsertedCount },
    'Dates blocked'
  );

  return result.modifiedCount + result.upsertedCount;
}

/**
 * Unblock dates (make available)
 */
export async function unblockDates(
  propertyId: string,
  startDate: Date,
  endDate: Date
): Promise<number> {
  // Verify property exists
  const property = await Property.findOne({ propertyId }).lean();
  if (!property) {
    throw new NotFoundError('Property', propertyId);
  }

  // Check for bookings in date range
  const bookingsInRange = await Booking.countDocuments({
    propertyId,
    status: { $in: ['confirmed', 'pending'] },
    $or: [
      { checkIn: { $lte: endDate, $gte: startDate } },
      { checkOut: { $gte: startDate, $lte: endDate } },
      { checkIn: { $lte: startDate }, checkOut: { $gte: endDate } },
    ],
  });

  if (bookingsInRange > 0) {
    throw new ValidationError('Cannot unblock dates with existing bookings');
  }

  const result = await CalendarEntry.updateMany(
    {
      propertyId,
      date: { $gte: startDate, $lte: endDate },
      available: false,
    },
    {
      $set: {
        available: true,
        note: null,
      },
    }
  );

  calendarLogger.info(
    { propertyId, startDate, endDate, unblockedCount: result.modifiedCount },
    'Dates unblocked'
  );

  return result.modifiedCount;
}

/**
 * Sync calendar with external source (like Airbnb, Booking.com)
 */
export async function syncCalendar(
  propertyId: string,
  entries: Array<{
    date: string;
    available: boolean;
    price?: number;
  }>
): Promise<{ synced: number; errors: number }> {
  // Verify property exists
  const property = await Property.findOne({ propertyId }).lean();
  if (!property) {
    throw new NotFoundError('Property', propertyId);
  }

  let synced = 0;
  let errors = 0;

  for (const entry of entries) {
    try {
      const date = new Date(entry.date);
      date.setHours(0, 0, 0, 0);

      // Skip if date has a confirmed booking
      const conflictingBooking = await Booking.findOne({
        propertyId,
        status: { $in: ['confirmed', 'pending'] },
        checkIn: { $lte: date },
        checkOut: { $gt: date },
      }).lean();

      if (conflictingBooking) {
        calendarLogger.warn(
          { propertyId, date, bookingId: conflictingBooking.bookingId },
          'Skipping sync - date has booking'
        );
        errors++;
        continue;
      }

      await CalendarEntry.findOneAndUpdate(
        { propertyId, date },
        {
          $set: {
            available: entry.available,
            price: entry.price,
            source: 'sync',
          },
        },
        { upsert: true }
      );

      synced++;
    } catch (error) {
      calendarLogger.error({ error, propertyId, entry }, 'Sync entry failed');
      errors++;
    }
  }

  calendarLogger.info({ propertyId, synced, errors }, 'Calendar sync completed');

  return { synced, errors };
}

/**
 * Check if dates are available
 */
export async function checkAvailability(
  propertyId: string,
  checkIn: Date,
  checkOut: Date
): Promise<{
  available: boolean;
  blockedDates: string[];
  conflictingBookings: string[];
}> {
  // Verify property exists
  const property = await Property.findOne({ propertyId }).lean();
  if (!property) {
    throw new NotFoundError('Property', propertyId);
  }

  const blockedDates: string[] = [];
  const conflictingBookings: string[] = [];

  // Check calendar entries
  const calendarEntries = await CalendarEntry.find({
    propertyId,
    date: { $gte: checkIn, $lt: checkOut },
    available: false,
  }).lean();

  for (const entry of calendarEntries) {
    blockedDates.push(entry.date.toISOString().split('T')[0]);
  }

  // Check bookings
  const bookings = await Booking.find({
    propertyId,
    status: { $in: ['confirmed', 'pending'] },
    $or: [
      { checkIn: { $lt: checkOut }, checkOut: { $gt: checkIn } },
    ],
  }).lean();

  for (const booking of bookings) {
    conflictingBookings.push(booking.bookingId);
  }

  const available = blockedDates.length === 0 && conflictingBookings.length === 0;

  return {
    available,
    blockedDates,
    conflictingBookings,
  };
}

// Import ConflictError
import { ConflictError } from '../utils/errors';

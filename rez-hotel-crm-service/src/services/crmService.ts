/**
 * Guest CRM Service
 */

import { v4 as uuidv4 } from 'uuid';
import { Guest, IGuest } from '../models/guest';
import { Stay, IStay } from '../models/stay';

export interface CreateGuestParams {
  hotelId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  dateOfBirth?: Date;
  nationality?: string;
  preferences?: IGuest['preferences'];
  tags?: string[];
}

export async function createGuest(params: CreateGuestParams): Promise<IGuest> {
  const guestId = `GST-${Date.now().toString(36).toUpperCase()}`;

  const guest = new Guest({
    ...params,
    guestId,
    preferences: params.preferences || {},
    tags: params.tags || [],
  });

  await guest.save();
  return guest;
}

export async function getGuest(guestId: string): Promise<IGuest | null> {
  return Guest.findOne({ guestId });
}

export async function getGuestByPhone(hotelId: string, phone: string): Promise<IGuest | null> {
  return Guest.findOne({ hotelId, phone });
}

export async function getGuestByEmail(hotelId: string, email: string): Promise<IGuest | null> {
  return Guest.findOne({ hotelId, email: email.toLowerCase() });
}

export async function updateGuest(
  guestId: string,
  updates: Partial<IGuest>
): Promise<IGuest | null> {
  return Guest.findOneAndUpdate({ guestId }, updates, { new: true });
}

export async function searchGuests(
  hotelId: string,
  query: string
): Promise<IGuest[]> {
  const searchRegex = new RegExp(query, 'i');
  return Guest.find({
    hotelId,
    $or: [
      { firstName: searchRegex },
      { lastName: searchRegex },
      { email: searchRegex },
      { phone: searchRegex },
    ],
  }).limit(20);
}

export async function getVipGuests(hotelId: string): Promise<IGuest[]> {
  return Guest.find({ hotelId, vip: true }).sort({ totalSpend: -1 });
}

export async function getBlacklistedGuests(hotelId: string): Promise<IGuest[]> {
  return Guest.find({ hotelId, blacklisted: true });
}

export async function toggleVip(guestId: string): Promise<IGuest | null> {
  return Guest.findOneAndUpdate(
    { guestId },
    [{ $set: { vip: { $not: '$vip' } } }],
    { new: true }
  );
}

export async function blacklistGuest(guestId: string): Promise<IGuest | null> {
  return Guest.findOneAndUpdate(
    { guestId },
    { blacklisted: true },
    { new: true }
  );
}

export async function addGuestNote(
  guestId: string,
  note: string
): Promise<IGuest | null> {
  const guest = await Guest.findOne({ guestId });
  if (!guest) return null;

  const existingNotes = guest.notes ? `${guest.notes}\n` : '';
  return Guest.findOneAndUpdate(
    { guestId },
    { notes: `${existingNotes}[${new Date().toISOString()}] ${note}` },
    { new: true }
  );
}

// Stay management
export async function recordStay(params: {
  hotelId: string;
  guestId: string;
  bookingId: string;
  roomId: string;
  roomNumber: string;
  checkIn: Date;
  checkOut: Date;
  totalAmount: number;
}): Promise<IStay> {
  const stay = new Stay(params);
  await stay.save();

  // Update guest stats
  await Guest.findOneAndUpdate(
    { guestId: params.guestId },
    {
      $inc: { totalStays: 1, totalSpend: params.totalAmount },
      lastStay: new Date(),
    }
  );

  return stay;
}

export async function getGuestStays(guestId: string): Promise<IStay[]> {
  return Stay.find({ guestId }).sort({ checkIn: -1 });
}

export async function addFeedback(
  bookingId: string,
  rating: number,
  comment?: string
): Promise<IStay | null> {
  return Stay.findOneAndUpdate(
    { bookingId },
    {
      feedback: {
        rating,
        comment,
        submittedAt: new Date(),
      },
    },
    { new: true }
  );
}

// Analytics
export async function getGuestAnalytics(hotelId: string): Promise<{
  totalGuests: number;
  vipGuests: number;
  blacklisted: number;
  avgLifetimeValue: number;
  topSpenders: IGuest[];
  recentGuests: IGuest[];
}> {
  const [totalGuests, vipGuests, blacklisted, guests] = await Promise.all([
    Guest.countDocuments({ hotelId }),
    Guest.countDocuments({ hotelId, vip: true }),
    Guest.countDocuments({ hotelId, blacklisted: true }),
    Guest.find({ hotelId }).sort({ totalSpend: -1 }).limit(100),
  ]);

  const totalSpend = guests.reduce((sum, g) => sum + (g.totalSpend || 0), 0);
  const avgLifetimeValue = guests.length > 0 ? totalSpend / guests.length : 0;

  const topSpenders = guests.slice(0, 10);
  const recentGuests = await Guest.find({ hotelId })
    .sort({ createdAt: -1 })
    .limit(10);

  return {
    totalGuests,
    vipGuests,
    blacklisted,
    avgLifetimeValue,
    topSpenders,
    recentGuests,
  };
}

import { prisma } from '../../config/database';
import { Errors } from '../../utils/errors';
import crypto from 'crypto';

export class PmsService {
  /**
   * Generate a new API key for a hotel
   */
  static async generateApiKey(hotelId: string, label?: string) {
    const hotel = await prisma.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel) throw Errors.notFound('Hotel');

    const apiKey = `pms_${crypto.randomBytes(32).toString('hex')}`;

    return prisma.hotelApiKey.create({
      data: { hotelId, apiKey, label: label || 'PMS Integration' },
    });
  }

  /**
   * Revoke an API key
   */
  static async revokeApiKey(keyId: string) {
    return prisma.hotelApiKey.update({
      where: { id: keyId },
      data: { isActive: false, revokedAt: new Date() },
    });
  }

  /**
   * Validate API key and return hotel ID
   */
  static async validateApiKey(apiKey: string): Promise<string> {
    const key = await prisma.hotelApiKey.findUnique({ where: { apiKey } });
    if (!key || !key.isActive) throw Errors.forbidden();

    // Update last used
    await prisma.hotelApiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });

    return key.hotelId;
  }

  /**
   * Push inventory updates from PMS
   */
  static async pushInventory(hotelId: string, updates: Array<{
    room_type_id: string;
    date: string;
    available_rooms: number;
    rate_paise: number;
    is_blocked: boolean;
  }>) {
    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const u of updates) {
      try {
        await prisma.inventorySlot.upsert({
          where: {
            roomTypeId_date: { roomTypeId: u.room_type_id, date: new Date(u.date) },
          },
          create: {
            hotelId,
            roomTypeId: u.room_type_id,
            date: new Date(u.date),
            totalRooms: u.available_rooms,
            availableRooms: u.available_rooms,
            ratePaise: u.rate_paise,
            isBlocked: u.is_blocked,
          },
          update: {
            availableRooms: u.available_rooms,
            totalRooms: u.available_rooms,
            ratePaise: u.rate_paise,
            isBlocked: u.is_blocked,
          },
        });
        updated++;
      } catch (err: any) {
        failed++;
        errors.push(`${u.room_type_id}/${u.date}: ${err.message}`);
      }
    }

    return { updated, failed, errors };
  }

  /**
   * Get bookings for PMS pull
   */
  static async getBookings(hotelId: string, dateFrom?: string, dateTo?: string, status?: string) {
    const where: any = { hotelId };
    if (dateFrom) where.checkinDate = { ...where.checkinDate, gte: new Date(dateFrom) };
    if (dateTo) where.checkinDate = { ...where.checkinDate, lte: new Date(dateTo) };
    if (status) where.status = status;

    return prisma.booking.findMany({
      where,
      select: {
        bookingRef: true,
        roomTypeId: true,
        checkinDate: true,
        checkoutDate: true,
        guestName: true,
        guestPhone: true,
        numRooms: true,
        specialRequests: true,
        pgAmountPaise: true,
        status: true,
      },
      orderBy: { checkinDate: 'asc' },
    });
  }
}

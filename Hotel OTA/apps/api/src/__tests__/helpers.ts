import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export const prisma = new PrismaClient();

export function createUserToken(userId: string, phone: string, tier = 'basic'): string {
  return jwt.sign({ userId, phone, tier }, env.JWT_SECRET, { expiresIn: 3600 });
}

export function createAdminToken(): string {
  return jwt.sign({ adminId: 'test-admin', email: 'admin@ota.com', role: 'super_admin' }, env.JWT_ADMIN_SECRET, { expiresIn: 3600 });
}

export function createHotelStaffToken(staffId: string, hotelId: string): string {
  return jwt.sign({ staffId, hotelId, phone: '9876543210', role: 'manager' }, env.JWT_SECRET, { expiresIn: 3600 });
}

/**
 * Create a test user with wallet
 */
export async function createTestUser(phone = '9999900001') {
  const user = await prisma.user.create({ data: { phone } });
  const wallet = await prisma.coinWallet.create({ data: { userId: user.id } });
  return { user, wallet, token: createUserToken(user.id, phone) };
}

/**
 * Get first active hotel with inventory
 */
export async function getTestHotel() {
  const hotel = await prisma.hotel.findFirst({
    where: { onboardingStatus: 'active' },
    include: {
      roomTypes: { where: { isActive: true }, take: 1 },
      inventorySlots: { where: { isBlocked: false, availableRooms: { gt: 0 } }, take: 1 },
    },
  });
  return hotel;
}

/**
 * Clean up test data
 */
export async function cleanTestData() {
  // Delete in correct order to respect FK constraints
  await prisma.review.deleteMany({});
  await prisma.wishlist.deleteMany({});
  await prisma.referral.deleteMany({});
  await prisma.coinExpirySchedule.deleteMany({});
  await prisma.bookingEvent.deleteMany({});
  await prisma.coinTransaction.deleteMany({});
  await prisma.settlementEntry.deleteMany({});
  await prisma.booking.deleteMany({});
  // Restore inventory for test dates that may have been consumed
  await prisma.inventorySlot.updateMany({
    where: { availableRooms: { lt: 5 } },
    data: { availableRooms: 5 },
  });
  await prisma.coinWallet.deleteMany({ where: { user: { phone: { startsWith: '99999' } } } });
  await prisma.otpRecord.deleteMany({ where: { phone: { startsWith: '99999' } } });
  await prisma.user.deleteMany({ where: { phone: { startsWith: '99999' } } });
}

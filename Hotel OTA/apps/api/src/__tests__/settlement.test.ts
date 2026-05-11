import { prisma, createTestUser, getTestHotel, cleanTestData } from './helpers';
import { SettlementService } from '../services/payments/settlement.service';
import { BookingService } from '../services/booking/booking.service';

describe('Settlement Flow', () => {
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let hotel: any;

  beforeAll(async () => {
    testUser = await createTestUser('99999000088');
    hotel = await getTestHotel();
  });

  afterAll(async () => {
    await cleanTestData();
    await prisma.$disconnect();
  });

  it('should create settlement entry on booking confirmation', async () => {
    const roomType = hotel.roomTypes[0];
    // Use far-future dates (2026-08-XX) to avoid conflicts with E2E test data
    const checkin = '2026-05-30';
    const checkout = '2026-05-31';

    // Create and confirm a booking
    const hold = await BookingService.hold({
      userId: testUser.user.id, hotelId: hotel.id, roomTypeId: roomType.id,
      checkinDate: checkin, checkoutDate: checkout, numRooms: 1, numGuests: 1,
      guestName: 'Settlement Test', guestPhone: '99999000088',
      channelSource: 'ota_app', otaCoinBurnPaise: 0, rezCoinBurnPaise: 0, userTier: 'basic',
    });

    const confirmed = await BookingService.confirm({
      holdId: hold.holdId,
      razorpayPaymentId: `pay_test_${Date.now()}`,
      razorpaySignature: 'test_sig',
      userId: testUser.user.id,
    });

    // Check settlement entry created
    const entry = await prisma.settlementEntry.findFirst({
      where: { bookingId: hold.holdId },
    });
    expect(entry).not.toBeNull();
    expect(entry!.status).toBe('pending');
    expect(entry!.netPayablePaise).toBeGreaterThan(0);
    expect(entry!.commissionPaise).toBeGreaterThan(0);
  });

  it('should correctly deduct commission from hotel payout', async () => {
    const entry = await prisma.settlementEntry.findFirst({
      where: { hotel: { id: hotel.id } },
      orderBy: { createdAt: 'desc' },
    });

    // Null check: depends on the previous test having created a settlement entry
    expect(entry).not.toBeNull();
    if (!entry) return;
    expect(entry.netPayablePaise).toBe(entry.grossAmountPaise - entry.commissionPaise);
  });

  it('should update hotel wallet pending balance', async () => {
    const wallet = await prisma.hotelWallet.findUnique({ where: { hotelId: hotel.id } });
    expect(wallet).not.toBeNull();
    expect(wallet!.pendingBalancePaise).toBeGreaterThan(0);
  });
});

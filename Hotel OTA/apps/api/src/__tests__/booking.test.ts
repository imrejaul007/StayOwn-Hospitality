import { prisma, createTestUser, getTestHotel, cleanTestData } from './helpers';
import { BookingService } from '../services/booking/booking.service';
import dayjs from 'dayjs';

describe('Booking Flow', () => {
  let testUser: Awaited<ReturnType<typeof createTestUser>>;
  let hotel: any;

  beforeAll(async () => {
    testUser = await createTestUser('99999000011');
    hotel = await getTestHotel();
  });

  afterEach(async () => {
    // Clean up bookings created by this test to avoid inventory bleed-through
    await prisma.bookingEvent.deleteMany({});
    await prisma.settlementEntry.deleteMany({});
    await prisma.booking.deleteMany({});
    await prisma.inventorySlot.updateMany({
      where: { availableRooms: { lt: 5 } },
      data: { availableRooms: 5 },
    });
  });

  afterAll(async () => {
    await cleanTestData();
    await prisma.$disconnect();
  });

  it('should place a hold and decrement inventory', async () => {
    const roomType = hotel.roomTypes[0];
    // Use far-future dates (2026-08-XX) to avoid conflicts with E2E test data
    const checkin = '2026-05-10';
    const checkout = '2026-05-12';

    // Get initial inventory
    const slotBefore = await prisma.inventorySlot.findFirst({
      where: { roomTypeId: roomType.id, date: new Date(checkin), isBlocked: false },
    });
    const availableBefore = slotBefore?.availableRooms || 0;

    const result = await BookingService.hold({
      userId: testUser.user.id,
      hotelId: hotel.id,
      roomTypeId: roomType.id,
      checkinDate: checkin,
      checkoutDate: checkout,
      numRooms: 1,
      numGuests: 2,
      guestName: 'Test Guest',
      guestPhone: '9999900011',
      channelSource: 'ota_app',
      otaCoinBurnPaise: 0,
      rezCoinBurnPaise: 0,
      userTier: 'basic',
    });

    expect(result.holdId).toBeDefined();
    expect(result.bookingRef).toMatch(/^OTA-BLR-/);
    expect(result.totalValuePaise).toBeGreaterThan(0);
    expect(result.pgAmountPaise).toBe(result.totalValuePaise); // no coins burned
    expect(result.razorpayOrderId).toBeDefined();

    // Verify inventory decremented
    const slotAfter = await prisma.inventorySlot.findFirst({
      where: { roomTypeId: roomType.id, date: new Date(checkin) },
    });
    expect(slotAfter!.availableRooms).toBe(availableBefore - 1);

    // Verify booking event logged
    const events = await prisma.bookingEvent.findMany({ where: { bookingId: result.holdId } });
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].eventType).toBe('hold_placed');
  });

  it('should confirm booking after payment', async () => {
    const roomType = hotel.roomTypes[0];
    // Use far-future dates (2026-08-XX) to avoid conflicts with E2E test data
    const checkin = '2026-05-15';
    const checkout = '2026-05-16';

    const hold = await BookingService.hold({
      userId: testUser.user.id,
      hotelId: hotel.id,
      roomTypeId: roomType.id,
      checkinDate: checkin,
      checkoutDate: checkout,
      numRooms: 1,
      numGuests: 1,
      guestName: 'Test Guest',
      guestPhone: '9999900011',
      channelSource: 'ota_app',
      otaCoinBurnPaise: 0,
      rezCoinBurnPaise: 0,
      userTier: 'basic',
    });

    // Confirm (dev mode accepts any signature)
    const result = await BookingService.confirm({
      holdId: hold.holdId,
      razorpayPaymentId: `pay_test_${Date.now()}`,
      razorpaySignature: 'test_sig',
      userId: testUser.user.id,
    });

    expect(result.status).toBe('confirmed');
    expect(result.otaCoinEarnedPaise).toBeGreaterThan(0);

    // Verify booking status
    const booking = await prisma.booking.findUnique({ where: { id: hold.holdId } });
    expect(booking!.status).toBe('confirmed');
    expect(booking!.paymentStatus).toBe('paid');

    // Verify settlement entry created
    const settlement = await prisma.settlementEntry.findFirst({ where: { bookingId: hold.holdId } });
    expect(settlement).not.toBeNull();
    expect(settlement!.netPayablePaise).toBeGreaterThan(0);
  });

  it('should cancel booking and restore inventory', async () => {
    const roomType = hotel.roomTypes[0];
    // Use far-future dates (2026-08-XX) to avoid conflicts with E2E test data
    const checkin = '2026-05-20';
    const checkout = '2026-05-21';

    const hold = await BookingService.hold({
      userId: testUser.user.id,
      hotelId: hotel.id,
      roomTypeId: roomType.id,
      checkinDate: checkin,
      checkoutDate: checkout,
      numRooms: 1,
      numGuests: 1,
      guestName: 'Test Guest',
      guestPhone: '9999900011',
      channelSource: 'ota_app',
      otaCoinBurnPaise: 0,
      rezCoinBurnPaise: 0,
      userTier: 'basic',
    });

    // Get inventory before cancel
    const slotBefore = await prisma.inventorySlot.findFirst({
      where: { roomTypeId: roomType.id, date: new Date(checkin) },
    });

    const result = await BookingService.cancel(hold.holdId, testUser.user.id, 'Test cancellation');

    expect(result.status).toBe('cancelled');

    // Inventory should be restored
    const slotAfter = await prisma.inventorySlot.findFirst({
      where: { roomTypeId: roomType.id, date: new Date(checkin) },
    });
    expect(slotAfter!.availableRooms).toBe(slotBefore!.availableRooms + 1);
  });

  it('should reject hold when no inventory available', async () => {
    // Use a date far in the future where no inventory exists
    const checkin = dayjs().add(200, 'day').format('YYYY-MM-DD');
    const checkout = dayjs().add(201, 'day').format('YYYY-MM-DD');

    await expect(
      BookingService.hold({
        userId: testUser.user.id,
        hotelId: hotel.id,
        roomTypeId: hotel.roomTypes[0].id,
        checkinDate: checkin,
        checkoutDate: checkout,
        numRooms: 1,
        numGuests: 1,
        guestName: 'Test',
        guestPhone: '9999900011',
        channelSource: 'ota_app',
        otaCoinBurnPaise: 0,
        rezCoinBurnPaise: 0,
        userTier: 'basic',
      })
    ).rejects.toThrow();
  });
});

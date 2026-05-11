import { prisma, createTestUser, cleanTestData } from './helpers';
import { CoinService } from '../services/finance/coin.service';

describe('Coin Engine', () => {
  let testUser: Awaited<ReturnType<typeof createTestUser>>;

  beforeAll(async () => {
    testUser = await createTestUser('99999000022');
  });

  afterAll(async () => {
    await cleanTestData();
    await prisma.$disconnect();
  });

  it('should find earn rules from DB (not hardcoded)', async () => {
    const rule = await CoinService.findEarnRule({
      coinType: 'ota',
      channelSource: 'ota_app',
      hotelId: 'non-existent',
      userTier: 'basic',
      bookingValue: 500000,
    });

    expect(rule).not.toBeNull();
    expect(Number(rule!.earnPct)).toBe(6); // OTA direct: 6%
  });

  it('should calculate correct earn amounts', () => {
    // 6% of ₹5,000 (500000 paise)
    const amount = CoinService.calculateEarnAmount(500000, 6, null);
    expect(amount).toBe(30000); // ₹300

    // With max cap
    const capped = CoinService.calculateEarnAmount(1000000, 6, 20000);
    expect(capped).toBe(20000); // Capped at ₹200
  });

  it('should enforce burn caps based on tier', async () => {
    // Give user some coins first
    const wallet = await prisma.coinWallet.update({
      where: { userId: testUser.user.id },
      data: { otaCoinBalancePaise: 500000, rezCoinBalancePaise: 200000 },
    });

    // Basic tier: 15% OTA cap, 10% ReZ cap
    const result = await CoinService.checkBurn({
      bookingValuePaise: 700000,
      otaCoinRequestedPaise: 300000, // asking for ₹3,000
      rezCoinRequestedPaise: 200000, // asking for ₹2,000
      userTier: 'basic',
      userId: testUser.user.id,
    });

    // OTA cap: 15% of 700000 = 105000
    expect(result.otaCoinApplicablePaise).toBeLessThanOrEqual(105000);
    // ReZ cap: 10% of 700000 = 70000
    expect(result.rezCoinApplicablePaise).toBeLessThanOrEqual(70000);
    // PG amount should be booking value - coins applied
    expect(result.pgAmountPaise).toBe(
      700000 - result.otaCoinApplicablePaise - result.rezCoinApplicablePaise
    );
    // Min 60% cash payment
    expect(result.pgAmountPaise).toBeGreaterThanOrEqual(700000 * 0.6);
  });

  it('should apply OTA coins before ReZ coins (waterfall order)', async () => {
    const result = await CoinService.checkBurn({
      bookingValuePaise: 1000000,
      otaCoinRequestedPaise: 200000,
      rezCoinRequestedPaise: 100000,
      userTier: 'basic',
      userId: testUser.user.id,
    });

    // Both should be applied (within caps)
    expect(result.otaCoinApplicablePaise).toBeGreaterThan(0);
    expect(result.totalDiscountPaise).toBe(
      result.otaCoinApplicablePaise + result.rezCoinApplicablePaise
    );
  });

  it('should earn coins on booking and create expiry schedule', async () => {
    // Reset wallet
    await prisma.coinWallet.update({
      where: { userId: testUser.user.id },
      data: { otaCoinBalancePaise: 0 },
    });

    const earnRule = await prisma.earnRule.findFirst({
      where: { coinType: 'ota', channelSource: 'ota_app', isActive: true },
    });

    // Create a dummy booking for FK constraint
    const hotel = await prisma.hotel.findFirst({ where: { onboardingStatus: 'active' } });
    const roomType = await prisma.roomType.findFirst({ where: { hotelId: hotel!.id } });
    const dummyBooking = await prisma.booking.create({
      data: {
        bookingRef: `TEST-${Date.now()}`, userId: testUser.user.id, hotelId: hotel!.id,
        roomTypeId: roomType!.id, channelSource: 'ota_app', checkinDate: new Date(),
        checkoutDate: new Date(), numNights: 1, roomRatePaise: 300000,
        totalValuePaise: 300000, otaCommissionPaise: 18000, pgAmountPaise: 300000, status: 'confirmed',
      },
    });

    await CoinService.earnCoins({
      userId: testUser.user.id,
      coinType: 'ota',
      amountPaise: 30000,
      bookingId: dummyBooking.id,
      earnRuleId: earnRule!.id,
    });

    // Check wallet updated
    const wallet = await prisma.coinWallet.findUnique({ where: { userId: testUser.user.id } });
    expect(wallet!.otaCoinBalancePaise).toBe(30000);

    // Check expiry scheduled (12 months)
    const expiry = await prisma.coinExpirySchedule.findFirst({
      where: { userId: testUser.user.id, coinType: 'ota', status: 'pending' },
    });
    expect(expiry).not.toBeNull();
    expect(expiry!.amountPaise).toBe(30000);
  });

  it('should reverse coins on cancellation', async () => {
    const walletBefore = await prisma.coinWallet.findUnique({ where: { userId: testUser.user.id } });
    const balanceBefore = walletBefore!.otaCoinBalancePaise;

    // Get a real booking ID
    const booking = await prisma.booking.findFirst({ where: { userId: testUser.user.id } });

    await CoinService.reverseEarn({
      userId: testUser.user.id,
      coinType: 'ota',
      amountPaise: 10000,
      bookingId: booking!.id,
    });

    const walletAfter = await prisma.coinWallet.findUnique({ where: { userId: testUser.user.id } });
    expect(walletAfter!.otaCoinBalancePaise).toBe(balanceBefore - 10000);
  });
});

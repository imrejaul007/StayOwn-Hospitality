import { prisma, cleanTestData } from './helpers';
import { MiningService } from '../services/mining/mining.service';
import dayjs from 'dayjs';

describe('Mining Engine', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should preview HCS scores for all active hotels', async () => {
    const lastMonth = dayjs().subtract(1, 'month').startOf('month').toDate();
    const scores = await MiningService.previewScores(lastMonth);

    expect(scores.length).toBeGreaterThan(0);
    scores.forEach((s) => {
      expect(s.hotelId).toBeDefined();
      expect(s.rawScore).toBeGreaterThanOrEqual(0);
      expect(s.inputs.roomsAllocated).toBeGreaterThan(0);
      expect(s.inputs.availabilityPct).toBeDefined();
    });
  });

  it('should run mining cycle and issue ownership units', async () => {
    // Use a month that hasn't been mined yet
    const testMonth = dayjs('2025-01-01').toDate();

    // Clean any existing scores for this month
    await prisma.vestingSchedule.deleteMany({
      where: { ledger: { periodMonth: testMonth } },
    });
    await prisma.ownershipTokenLedger.deleteMany({ where: { periodMonth: testMonth } });
    await prisma.hotelContributionScore.deleteMany({ where: { periodMonth: testMonth } });

    const result = await MiningService.runMiningCycle(testMonth);

    expect(result.hotelsProcessed).toBeGreaterThan(0);
    expect(result.monthlyPoolUnits).toBeGreaterThan(0);
    // Network score may be 0 if no bookings exist for that period — that's valid
    if ((result as any).networkTotalScore > 0) {
      const totalIssued = result.results!.reduce((s: number, r: any) => s + r.unitsIssued, 0);
      expect(Math.abs(totalIssued - result.monthlyPoolUnits!)).toBeLessThan(1);
    }
  });

  it('should be idempotent — reject re-run for same month', async () => {
    const testMonth = dayjs('2025-01-01').toDate();

    await expect(
      MiningService.runMiningCycle(testMonth)
    ).rejects.toThrow('Mining already run for this period');
  });

  it('should get hotel ownership dashboard data', async () => {
    const hotel = await prisma.hotel.findFirst({ where: { onboardingStatus: 'active' } });
    const data = await MiningService.getHotelOwnership(hotel!.id);

    expect(data).toHaveProperty('currentOwnershipUnits');
    expect(data).toHaveProperty('vestingInNext12Months');
    expect(data).toHaveProperty('estimatedNetworkShare');
    expect(data).toHaveProperty('vestingTimeline');
    expect(data).toHaveProperty('scoreHistory');
  });

  it('should process vesting without errors', async () => {
    const result = await MiningService.processVesting();
    expect(result).toHaveProperty('processed');
    expect(result).toHaveProperty('unlocked');
    expect(result).toHaveProperty('forfeited');
  });
});

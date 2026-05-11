import { prisma } from '../../config/database';
import { Errors } from '../../utils/errors';
import dayjs from 'dayjs';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Ownership Mining Engine
 * Per 05_OWNERSHIP_MINING.md spec exactly.
 *
 * Monthly process:
 * 1. Calculate HCS (Hotel Contribution Score) for each hotel
 * 2. Normalize scores across network
 * 3. Issue Performance Units proportionally
 * 4. Start 12-month vesting clock on each issuance
 */
export class MiningService {
  /**
   * Preview HCS scores for a given month (before finalising)
   */
  static async previewScores(periodMonth: Date) {
    const scores = await this.calculateAllHCS(periodMonth);
    return scores.map((s) => ({
      hotelId: s.hotelId,
      hotelName: s.hotelName,
      rawScore: s.rawScore,
      normalizedScore: s.normalizedScore,
      estimatedUnits: s.estimatedUnits,
      inputs: s.inputs,
    }));
  }

  /**
   * Run the full mining cycle for a month.
   * Idempotent — checks if already run for this period.
   */
  static async runMiningCycle(periodMonth: Date) {
    const monthStart = dayjs(periodMonth).startOf('month').toDate();

    // Idempotency check
    const existing = await prisma.hotelContributionScore.findFirst({
      where: { periodMonth: monthStart },
    });
    if (existing) {
      throw Errors.validation('Mining already run for this period');
    }

    // Get current year's pool schedule
    const yearsSinceLaunch = dayjs(monthStart).diff(dayjs('2024-01-01'), 'year') + 1;
    const poolSchedule = await prisma.ownershipPoolSchedule.findFirst({
      where: { yearNumber: Math.min(yearsSinceLaunch, 5) },
    });
    if (!poolSchedule) throw Errors.internal('No pool schedule found');

    const monthlyPoolUnits = Math.floor(poolSchedule.totalUnitsAvailable / 12);

    // Calculate all HCS scores
    const scores = await this.calculateAllHCS(monthStart);
    if (scores.length === 0) {
      return { message: 'No eligible hotels found', scores: [] };
    }

    // Network total
    const networkTotal = scores.reduce((sum, s) => sum + s.rawScore, 0);

    // Store scores and issue units in transaction
    const results = await prisma.$transaction(async (tx) => {
      const issuedResults: any[] = [];

      for (const score of scores) {
        const normalizedScore = networkTotal > 0 ? score.rawScore / networkTotal : 0;
        const unitsIssued = normalizedScore * monthlyPoolUnits;

        // Store HCS score
        await tx.hotelContributionScore.create({
          data: {
            hotelId: score.hotelId,
            periodMonth: monthStart,
            roomsAllocated: score.inputs.roomsAllocated,
            availabilityPct: score.inputs.availabilityPct,
            adrPaise: score.inputs.adrPaise,
            roomNightsBooked: score.inputs.roomNightsBooked,
            repeatBookingCount: score.inputs.repeatBookingCount,
            averageRating: score.inputs.averageRating,
            cancellationRatePct: score.inputs.cancellationRatePct,
            rawScore: score.rawScore,
            normalizedScore,
            networkTotalScore: networkTotal,
          },
        });

        // Issue ownership tokens
        if (unitsIssued > 0) {
          const vestingStart = monthStart;
          const vestingEnd = dayjs(monthStart).add(12, 'month').toDate();

          const ledgerEntry = await tx.ownershipTokenLedger.create({
            data: {
              hotelId: score.hotelId,
              periodMonth: monthStart,
              unitsIssued,
              normalizedScoreUsed: normalizedScore,
              poolUnitsThisMonth: monthlyPoolUnits,
              vestingStartDate: vestingStart,
              vestingEndDate: vestingEnd,
              vestingStatus: 'locked',
            },
          });

          // Create vesting schedule (unlocks after 12 months)
          await tx.vestingSchedule.create({
            data: {
              ledgerId: ledgerEntry.id,
              hotelId: score.hotelId,
              unlockDate: vestingEnd,
              unitsToUnlock: unitsIssued,
              status: 'pending',
            },
          });
        }

        issuedResults.push({
          hotelId: score.hotelId,
          hotelName: score.hotelName,
          rawScore: score.rawScore,
          normalizedScore,
          unitsIssued,
        });
      }

      return issuedResults;
    });

    return {
      period: dayjs(monthStart).format('YYYY-MM'),
      networkTotalScore: networkTotal,
      monthlyPoolUnits,
      hotelsProcessed: results.length,
      results,
    };
  }

  /**
   * Calculate HCS for all eligible hotels for a given month.
   * Formula from 05_OWNERSHIP_MINING.md:
   *
   * base_score = rooms_allocated × availability_pct × (adr_paise / 100000) × room_nights_booked
   * repeat_multiplier = 1 + (repeat_booking_count / room_nights_booked × 0.5)
   * rating_multiplier = average_rating / 4.0
   * cancellation_penalty = 1 - (cancellation_rate_pct / 100 × 2.0)
   * HCS = base_score × repeat_multiplier × rating_multiplier × cancellation_penalty
   */
  private static async calculateAllHCS(periodMonth: Date) {
    const monthStart = dayjs(periodMonth).startOf('month').toDate();
    const monthEnd = dayjs(periodMonth).endOf('month').toDate();

    // Get all active, mining-eligible hotels
    const hotels = await prisma.hotel.findMany({
      where: { onboardingStatus: 'active', miningEligible: true },
      include: {
        roomTypes: { where: { isActive: true } },
        inventorySlots: {
          where: { date: { gte: monthStart, lte: monthEnd } },
        },
        bookings: {
          where: {
            status: { in: ['confirmed', 'checked_in', 'stayed'] },
            createdAt: { gte: monthStart, lte: monthEnd },
          },
        },
      },
    });

    const scores: any[] = [];

    for (const hotel of hotels) {
      // rooms_allocated: total room types × rooms per type
      const roomsAllocated = hotel.roomTypes.reduce((sum, rt) => sum + rt.maxOccupancy, 0);
      if (roomsAllocated === 0) continue;

      // availability_pct: % of days rooms were available (not blocked)
      const totalSlots = hotel.inventorySlots.length;
      const availableSlots = hotel.inventorySlots.filter((s) => !s.isBlocked && s.availableRooms > 0).length;
      const availabilityPct = totalSlots > 0 ? availableSlots / totalSlots : 0;

      // adr_paise: average daily rate
      const ratesWithBookings = hotel.bookings.map((b) => b.roomRatePaise);
      const adrPaise = ratesWithBookings.length > 0
        ? Math.round(ratesWithBookings.reduce((sum, r) => sum + r, 0) / ratesWithBookings.length)
        : hotel.roomTypes[0]?.baseRatePaise || 0;

      // room_nights_booked
      const roomNightsBooked = hotel.bookings.reduce((sum, b) => sum + b.numNights * b.numRooms, 0);

      // repeat_booking_count: bookings from users who booked before
      const userBookingCounts = new Map<string, number>();
      for (const b of hotel.bookings) {
        userBookingCounts.set(b.userId, (userBookingCounts.get(b.userId) || 0) + 1);
      }
      const repeatBookingCount = Array.from(userBookingCounts.values()).filter((c) => c > 1).length;

      // average_rating (placeholder — no review system yet, default 4.0)
      const averageRating = 4.0;

      // cancellation_rate_pct
      const totalBookingsIncCancelled = await prisma.booking.count({
        where: { hotelId: hotel.id, createdAt: { gte: monthStart, lte: monthEnd } },
      });
      const cancelledBookings = await prisma.booking.count({
        where: { hotelId: hotel.id, status: 'cancelled', createdAt: { gte: monthStart, lte: monthEnd } },
      });
      const cancellationRatePct = totalBookingsIncCancelled > 0
        ? (cancelledBookings / totalBookingsIncCancelled) * 100
        : 0;

      // HCS Formula
      const baseScore = roomsAllocated * availabilityPct * (adrPaise / 100000) * roomNightsBooked;
      const repeatMultiplier = roomNightsBooked > 0
        ? 1 + (repeatBookingCount / roomNightsBooked * 0.5)
        : 1;
      const ratingMultiplier = averageRating / 4.0;
      const cancellationPenalty = 1 - (cancellationRatePct / 100 * 2.0);

      const rawScore = Math.max(0, baseScore * repeatMultiplier * ratingMultiplier * cancellationPenalty);

      scores.push({
        hotelId: hotel.id,
        hotelName: hotel.name,
        rawScore,
        normalizedScore: 0, // calculated after all scores
        estimatedUnits: 0,
        inputs: {
          roomsAllocated,
          availabilityPct: Math.round(availabilityPct * 100 * 100) / 100,
          adrPaise,
          roomNightsBooked,
          repeatBookingCount,
          averageRating,
          cancellationRatePct: Math.round(cancellationRatePct * 100) / 100,
        },
      });
    }

    // Calculate normalized scores and estimated units
    const networkTotal = scores.reduce((sum, s) => sum + s.rawScore, 0);
    const yearsSinceLaunch = dayjs(periodMonth).diff(dayjs('2024-01-01'), 'year') + 1;
    const poolSchedule = await prisma.ownershipPoolSchedule.findFirst({
      where: { yearNumber: Math.min(yearsSinceLaunch, 5) },
    });
    const monthlyPool = poolSchedule ? Math.floor(poolSchedule.totalUnitsAvailable / 12) : 0;

    for (const score of scores) {
      score.normalizedScore = networkTotal > 0 ? score.rawScore / networkTotal : 0;
      score.estimatedUnits = score.normalizedScore * monthlyPool;
    }

    return scores;
  }

  /**
   * Process vesting — unlock due tranches
   */
  static async processVesting() {
    const today = dayjs().startOf('day').toDate();

    const dueVestings = await prisma.vestingSchedule.findMany({
      where: { unlockDate: { lte: today }, status: 'pending' },
      include: { ledger: true },
    });

    let unlocked = 0;

    for (const vesting of dueVestings) {
      // Check hotel is still active
      const hotel = await prisma.hotel.findUnique({ where: { id: vesting.hotelId } });
      if (!hotel || hotel.onboardingStatus === 'churned') {
        // Forfeit
        await prisma.$transaction(async (tx) => {
          await tx.vestingSchedule.update({
            where: { id: vesting.id },
            data: { status: 'forfeited', processedAt: new Date() },
          });
          await tx.ownershipTokenLedger.update({
            where: { id: vesting.ledgerId },
            data: { vestingStatus: 'forfeited' },
          });
        });
        continue;
      }

      // Unlock
      await prisma.$transaction(async (tx) => {
        await tx.vestingSchedule.update({
          where: { id: vesting.id },
          data: { status: 'unlocked', processedAt: new Date() },
        });
        await tx.ownershipTokenLedger.update({
          where: { id: vesting.ledgerId },
          data: { vestingStatus: 'vested' },
        });
      });
      unlocked++;
    }

    return { processed: dueVestings.length, unlocked, forfeited: dueVestings.length - unlocked };
  }

  /**
   * Get ownership dashboard data for a hotel
   */
  static async getHotelOwnership(hotelId: string) {
    const [totalUnits, vestingUnits, recentScores, allLedger] = await Promise.all([
      // Total vested units
      prisma.ownershipTokenLedger.aggregate({
        where: { hotelId, vestingStatus: 'vested' },
        _sum: { unitsIssued: true },
      }),
      // Units still vesting
      prisma.ownershipTokenLedger.aggregate({
        where: { hotelId, vestingStatus: 'locked' },
        _sum: { unitsIssued: true },
      }),
      // Recent HCS scores
      prisma.hotelContributionScore.findMany({
        where: { hotelId },
        orderBy: { periodMonth: 'desc' },
        take: 12,
      }),
      // All ledger entries for vesting timeline
      prisma.ownershipTokenLedger.findMany({
        where: { hotelId },
        orderBy: { periodMonth: 'asc' },
      }),
    ]);

    // Network rank
    const latestScore = recentScores[0];
    let networkRank: number | null = null;
    if (latestScore) {
      const higherScores = await prisma.hotelContributionScore.count({
        where: {
          periodMonth: latestScore.periodMonth,
          rawScore: { gt: latestScore.rawScore },
        },
      });
      networkRank = higherScores + 1;
    }

    const totalHotels = await prisma.hotel.count({ where: { onboardingStatus: 'active', miningEligible: true } });

    return {
      currentOwnershipUnits: Number(totalUnits._sum.unitsIssued || 0),
      vestingInNext12Months: Number(vestingUnits._sum.unitsIssued || 0),
      estimatedNetworkShare: latestScore ? Number(latestScore.normalizedScore) * 100 : 0,
      networkRank,
      totalHotels,
      thisMonth: latestScore ? {
        periodMonth: latestScore.periodMonth,
        roomsAllocated: latestScore.roomsAllocated,
        availabilityPct: Number(latestScore.availabilityPct),
        adrPaise: latestScore.adrPaise,
        roomNightsBooked: latestScore.roomNightsBooked,
        hcsScore: Number(latestScore.rawScore),
        networkAvgHcs: Number(latestScore.networkTotalScore) / totalHotels,
        unitsEarned: allLedger.find(
          (l) => l.periodMonth.getTime() === latestScore.periodMonth.getTime()
        )?.unitsIssued || 0,
      } : null,
      vestingTimeline: allLedger.map((l) => ({
        periodMonth: l.periodMonth,
        units: Number(l.unitsIssued),
        vestingEndDate: l.vestingEndDate,
        status: l.vestingStatus,
      })),
      scoreHistory: recentScores.map((s) => ({
        periodMonth: s.periodMonth,
        rawScore: Number(s.rawScore),
        normalizedScore: Number(s.normalizedScore),
      })),
    };
  }

  /**
   * Handle mining dispute — admin adjusts score and re-issues
   */
  static async adjustScore(scoreId: string, adjustments: Record<string, number>) {
    const score = await prisma.hotelContributionScore.findUnique({ where: { id: scoreId } });
    if (!score) throw Errors.notFound('Score');

    // Recalculate with adjustments
    const roomsAllocated = adjustments.roomsAllocated ?? score.roomsAllocated;
    const availabilityPct = adjustments.availabilityPct ?? Number(score.availabilityPct);
    const adrPaise = adjustments.adrPaise ?? score.adrPaise;
    const roomNightsBooked = adjustments.roomNightsBooked ?? score.roomNightsBooked;
    const repeatBookingCount = adjustments.repeatBookingCount ?? score.repeatBookingCount;
    const averageRating = adjustments.averageRating ?? Number(score.averageRating || 4.0);
    const cancellationRatePct = adjustments.cancellationRatePct ?? Number(score.cancellationRatePct || 0);

    const baseScore = roomsAllocated * (availabilityPct / 100) * (adrPaise / 100000) * roomNightsBooked;
    const repeatMultiplier = roomNightsBooked > 0 ? 1 + (repeatBookingCount / roomNightsBooked * 0.5) : 1;
    const ratingMultiplier = averageRating / 4.0;
    const cancellationPenalty = 1 - (cancellationRatePct / 100 * 2.0);
    const newRawScore = Math.max(0, baseScore * repeatMultiplier * ratingMultiplier * cancellationPenalty);

    await prisma.hotelContributionScore.update({
      where: { id: scoreId },
      data: {
        roomsAllocated,
        availabilityPct,
        adrPaise,
        roomNightsBooked,
        repeatBookingCount,
        averageRating,
        cancellationRatePct,
        rawScore: newRawScore,
        normalizedScore: newRawScore / Number(score.networkTotalScore),
      },
    });

    return { scoreId, newRawScore };
  }
}

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { authenticateAdmin, authenticateHotelStaff } from '../middleware/auth';
import { MiningService } from '../services/mining/mining.service';
import { Errors } from '../utils/errors';
import { prisma } from '../config/database';
import dayjs from 'dayjs';

const router = Router();

// ─── ADMIN MINING ENDPOINTS ─────────────────────────────────

/**
 * GET /admin/mining/preview
 * Preview scores before finalising
 */
router.get('/admin/preview', authenticateAdmin, asyncHandler(async (req: Request, res: Response) => {
  const month = req.query.month as string || dayjs().subtract(1, 'month').format('YYYY-MM-01');
  const scores = await MiningService.previewScores(new Date(month));
  res.json({ period: month, scores });
}));

/**
 * POST /admin/mining/run
 * Finalise and issue ownership units
 */
router.post('/admin/run', authenticateAdmin, asyncHandler(async (req: Request, res: Response) => {
  const month = req.body.month || dayjs().subtract(1, 'month').format('YYYY-MM-01');
  const result = await MiningService.runMiningCycle(new Date(month));
  res.json(result);
}));

/**
 * PUT /admin/mining/dispute/:id
 * Adjust a score for a disputed month
 */
router.put('/admin/dispute/:id', authenticateAdmin, asyncHandler(async (req: Request, res: Response) => {
  const result = await MiningService.adjustScore(req.params.id, req.body);
  res.json(result);
}));

// ─── HOTEL OWNERSHIP DASHBOARD ──────────────────────────────

/**
 * GET /hotel/ownership
 */
router.get('/hotel/dashboard', authenticateHotelStaff, asyncHandler(async (req: Request, res: Response) => {
  const result = await MiningService.getHotelOwnership(req.hotelStaff!.hotelId);
  res.json(result);
}));

// ─── OWNERSHIP PORTAL ENDPOINTS ─────────────────────────────

/**
 * GET /mining/hotel/performance-history
 * Month-by-month mining history for the hotel with network rank and summary stats.
 */
router.get('/hotel/performance-history', authenticateHotelStaff, asyncHandler(async (req: Request, res: Response) => {

  const hotelId = req.hotelStaff!.hotelId;

  const [scores, ledgerEntries] = await Promise.all([
    prisma.hotelContributionScore.findMany({
      where: { hotelId },
      orderBy: { periodMonth: 'desc' },
    }),
    prisma.ownershipTokenLedger.findMany({
      where: { hotelId },
    }),
  ]);

  const ledgerByMonth = new Map(
    ledgerEntries.map((l) => [dayjs(l.periodMonth).format('YYYY-MM-01'), l])
  );

  const history = await Promise.all(
    scores.map(async (s) => {
      const monthKey = dayjs(s.periodMonth).format('YYYY-MM-01');
      const ledger = ledgerByMonth.get(monthKey);

      const [higherCount, totalHotels] = await Promise.all([
        prisma.hotelContributionScore.count({
          where: {
            periodMonth: s.periodMonth,
            rawScore: { gt: s.rawScore },
          },
        }),
        prisma.hotelContributionScore.count({
          where: { periodMonth: s.periodMonth },
        }),
      ]);

      return {
        month: dayjs(s.periodMonth).format('YYYY-MM'),
        roomsAllocated: s.roomsAllocated,
        availabilityPct: Number(s.availabilityPct),
        adrPaise: s.adrPaise,
        roomNightsBooked: s.roomNightsBooked,
        repeatBookingCount: s.repeatBookingCount,
        averageRating: s.averageRating !== null ? Number(s.averageRating) : null,
        cancellationRatePct: s.cancellationRatePct !== null ? Number(s.cancellationRatePct) : null,
        rawScore: Number(s.rawScore),
        normalizedScore: Number(s.normalizedScore),
        unitsIssued: ledger ? Number(ledger.unitsIssued) : 0,
        networkRank: higherCount + 1,
        totalHotels,
      };
    })
  );

  // Summary stats
  const totalUnitsIssued = history.reduce((sum, h) => sum + h.unitsIssued, 0);
  const avgMonthlyScore = history.length > 0
    ? history.reduce((sum, h) => sum + h.rawScore, 0) / history.length
    : 0;
  const bestMonth = history.length > 0
    ? history.reduce((best, h) => (h.rawScore > best.rawScore ? h : best)).month
    : null;

  res.json({
    history,
    summary: {
      totalUnitsIssued,
      avgMonthlyScore,
      bestMonth,
      monthsActive: history.length,
    },
  });
}));

/**
 * GET /mining/hotel/vesting-timeline
 * All vesting schedule entries for the hotel with ledger details and summary.
 */
router.get('/hotel/vesting-timeline', authenticateHotelStaff, asyncHandler(async (req: Request, res: Response) => {

  const hotelId = req.hotelStaff!.hotelId;

  const vestingEntries = await prisma.vestingSchedule.findMany({
    where: { hotelId },
    include: { ledger: true },
    orderBy: { unlockDate: 'asc' },
  });

  const today = dayjs();

  const timeline = vestingEntries.map((v) => {
    const daysRemaining = dayjs(v.unlockDate).diff(today, 'day');
    return {
      issueDate: v.ledger.createdAt,
      periodMonth: dayjs(v.ledger.periodMonth).format('YYYY-MM'),
      units: Number(v.unitsToUnlock),
      vestingEndDate: v.unlockDate,
      status: v.status,
      daysRemaining: daysRemaining > 0 ? daysRemaining : 0,
    };
  });

  const lockedUnits = vestingEntries
    .filter((v) => v.status === 'pending')
    .reduce((sum, v) => sum + Number(v.unitsToUnlock), 0);

  const vestedUnits = vestingEntries
    .filter((v) => v.status === 'unlocked')
    .reduce((sum, v) => sum + Number(v.unitsToUnlock), 0);

  const forfeitedUnits = vestingEntries
    .filter((v) => v.status === 'forfeited')
    .reduce((sum, v) => sum + Number(v.unitsToUnlock), 0);

  // Next unlock: earliest pending vesting entry
  const nextPending = vestingEntries
    .filter((v) => v.status === 'pending')
    .sort((a, b) => a.unlockDate.getTime() - b.unlockDate.getTime())[0];

  const nextUnlock = nextPending
    ? { date: nextPending.unlockDate, amount: Number(nextPending.unitsToUnlock) }
    : null;

  res.json({
    timeline,
    summary: {
      lockedUnits,
      vestedUnits,
      forfeitedUnits,
      nextUnlock,
    },
  });
}));

/**
 * GET /mining/hotel/network-standing
 * Leaderboard for the most recent scored month with network averages and hotel comparison.
 */
router.get('/hotel/network-standing', authenticateHotelStaff, asyncHandler(async (req: Request, res: Response) => {

  const hotelId = req.hotelStaff!.hotelId;

  // Find the most recent scored month
  const latestScore = await prisma.hotelContributionScore.findFirst({
    where: { hotelId },
    orderBy: { periodMonth: 'desc' },
  });

  if (!latestScore) {
    return res.json({ leaderboard: [], networkAverages: null, hotelComparison: null });
  }

  const periodMonth = latestScore.periodMonth;

  // Get all scores for that month
  const allScores = await prisma.hotelContributionScore.findMany({
    where: { periodMonth },
    orderBy: { rawScore: 'desc' },
  });

  // Collect ledger entries for this month for units earned
  const ledgerEntries = await prisma.ownershipTokenLedger.findMany({
    where: {
      periodMonth,
      hotelId: { in: allScores.map((s) => s.hotelId) },
    },
  });
  const ledgerByHotel = new Map(ledgerEntries.map((l) => [l.hotelId, l]));

  const networkTotal = allScores.reduce((sum, s) => sum + Number(s.normalizedScore), 0);

  const leaderboard = allScores.map((s, index) => {
    const isOwnHotel = s.hotelId === hotelId;
    const ledger = ledgerByHotel.get(s.hotelId);
    const sharePct = networkTotal > 0 ? (Number(s.normalizedScore) / networkTotal) * 100 : 0;
    return {
      rank: index + 1,
      hotelName: isOwnHotel ? undefined : `Hotel #${index + 1}`,
      isOwnHotel,
      hcsScore: Number(s.rawScore),
      normalizedScore: Number(s.normalizedScore),
      unitsEarned: ledger ? Number(ledger.unitsIssued) : 0,
      sharePct: Math.round(sharePct * 100) / 100,
    };
  });

  // Network averages
  const count = allScores.length;
  const networkAverages = count > 0 ? {
    avgHcs: allScores.reduce((s, r) => s + Number(r.rawScore), 0) / count,
    avgAdr: allScores.reduce((s, r) => s + r.adrPaise, 0) / count,
    avgAvailability: allScores.reduce((s, r) => s + Number(r.availabilityPct), 0) / count,
    avgRating: allScores.reduce((s, r) => s + (r.averageRating !== null ? Number(r.averageRating) : 4.0), 0) / count,
    avgCancellation: allScores.reduce((s, r) => s + (r.cancellationRatePct !== null ? Number(r.cancellationRatePct) : 0), 0) / count,
  } : null;

  // Hotel's own comparison vs averages
  const hotelComparison = networkAverages ? {
    hcsVsAvg: Number(latestScore.rawScore) - networkAverages.avgHcs,
    adrVsAvg: latestScore.adrPaise - networkAverages.avgAdr,
    availabilityVsAvg: Number(latestScore.availabilityPct) - networkAverages.avgAvailability,
    ratingVsAvg: (latestScore.averageRating !== null ? Number(latestScore.averageRating) : 4.0) - networkAverages.avgRating,
    cancellationVsAvg: (latestScore.cancellationRatePct !== null ? Number(latestScore.cancellationRatePct) : 0) - networkAverages.avgCancellation,
  } : null;

  res.json({
    periodMonth: dayjs(periodMonth).format('YYYY-MM'),
    leaderboard,
    networkAverages,
    hotelComparison,
  });
}));

/**
 * POST /mining/hotel/dispute
 * Create a mining score dispute. Only allowed on days 1–7 of the month.
 */
router.post('/hotel/dispute', authenticateHotelStaff, asyncHandler(async (req: Request, res: Response) => {

  const hotelId = req.hotelStaff!.hotelId;
  const today = dayjs();

  // Enforce dispute window: 1st–7th of the month
  if (today.date() < 1 || today.date() > 7) {
    throw Errors.validation('Disputes can only be submitted between the 1st and 7th of the month');
  }

  const { periodMonth, disputeField, claim, evidenceUrl } = req.body;

  if (!periodMonth || !disputeField || !claim) {
    throw Errors.validation('periodMonth, disputeField, and claim are required');
  }

  const parsedMonth = dayjs(periodMonth).startOf('month').toDate();
  if (isNaN(parsedMonth.getTime())) {
    throw Errors.validation('Invalid periodMonth — use YYYY-MM or YYYY-MM-DD format');
  }

  // Verify a score exists for that month and hotel
  const score = await prisma.hotelContributionScore.findFirst({
    where: { hotelId, periodMonth: parsedMonth },
  });
  if (!score) {
    throw Errors.notFound('Score for the specified period');
  }

  const dispute = await prisma.miningDispute.create({
    data: {
      hotelId,
      periodMonth: parsedMonth,
      disputeField: String(disputeField),
      claim: String(claim),
      evidenceUrl: evidenceUrl ? String(evidenceUrl) : null,
    },
  });

  res.status(201).json({
    disputeId: dispute.id,
    status: dispute.status,
    periodMonth: dayjs(dispute.periodMonth).format('YYYY-MM'),
    createdAt: dispute.createdAt,
  });
}));

/**
 * GET /mining/hotel/dispute-status
 * List all disputes for this hotel with status tracking.
 */
router.get('/hotel/dispute-status', authenticateHotelStaff, asyncHandler(async (req: Request, res: Response) => {

  const hotelId = req.hotelStaff!.hotelId;

  const disputes = await prisma.miningDispute.findMany({
    where: { hotelId },
    orderBy: { createdAt: 'desc' },
  });

  const result = disputes.map((d) => ({
    disputeId: d.id,
    periodMonth: dayjs(d.periodMonth).format('YYYY-MM'),
    disputeField: d.disputeField,
    claim: d.claim,
    evidenceUrl: d.evidenceUrl,
    status: d.status,
    adminNote: d.adminNote,
    submittedAt: d.createdAt,
    resolvedAt: d.resolvedAt,
  }));

  res.json({ disputes: result });
}));

/**
 * GET /mining/hotel/projections
 * Financial projections: commission savings, dividend potential, exit potential.
 */
router.get('/hotel/projections', authenticateHotelStaff, asyncHandler(async (req: Request, res: Response) => {

  const hotelId = req.hotelStaff!.hotelId;

  const [hotel, hotelVestedAgg, totalVestedAgg, gmvAgg] = await Promise.all([
    // Hotel commission rate
    prisma.hotel.findUnique({
      where: { id: hotelId },
      select: { otaCommissionPct: true },
    }),
    // Hotel's own vested units
    prisma.ownershipTokenLedger.aggregate({
      where: { hotelId, vestingStatus: 'vested' },
      _sum: { unitsIssued: true },
    }),
    // Total vested units across all hotels
    prisma.ownershipTokenLedger.aggregate({
      where: { vestingStatus: 'vested' },
      _sum: { unitsIssued: true },
    }),
    // Total GMV for this hotel (all-time gross booking value in paise)
    prisma.settlementEntry.aggregate({
      where: { hotelId },
      _sum: { grossAmountPaise: true },
    }),
  ]);

  if (!hotel) throw Errors.notFound('Hotel');

  const hotelCommissionRate = Number(hotel.otaCommissionPct) / 100;
  const marketplaceCommissionRate = 0.18; // standard OTA rate (18%)

  const totalGmvPaise = Number(gmvAgg._sum.grossAmountPaise || 0);
  const hotelVestedUnits = Number(hotelVestedAgg._sum.unitsIssued || 0);
  const totalVestedUnits = Number(totalVestedAgg._sum.unitsIssued || 0);
  const ownershipShare = totalVestedUnits > 0 ? hotelVestedUnits / totalVestedUnits : 0;

  // Commission savings: how much the hotel saved vs a standard 18% OTA
  const commissionSavedPaise = Math.max(
    0,
    Math.round(totalGmvPaise * (marketplaceCommissionRate - hotelCommissionRate))
  );

  // Assumed annual profit pool (placeholder — ₹1 crore = 10,000,000 paise × 100 = 1,000,000,000 paise)
  const assumedAnnualProfitPaise = 100_000_000_00; // ₹10 crore
  const dividendPotentialPaise = Math.round(ownershipShare * assumedAnnualProfitPaise);

  // Exit potential: hotel's share of assumed network valuation (₹100 crore × 25% liquidity)
  const assumedValuationPaise = 1_000_000_000_00; // ₹100 crore
  const exitPotentialPaise = Math.round(ownershipShare * assumedValuationPaise * 0.25);

  res.json({
    hotelCommissionRatePct: Number(hotel.otaCommissionPct),
    marketplaceCommissionRatePct: marketplaceCommissionRate * 100,
    totalGmvPaise,
    commissionSavedPaise,
    hotelVestedUnits,
    totalVestedUnits,
    ownershipSharePct: Math.round(ownershipShare * 10000) / 100, // 2 decimal places
    dividendPotential: {
      assumedAnnualProfitPaise,
      hotelSharePaise: dividendPotentialPaise,
      note: 'Based on assumed annual profit pool. Actual dividends depend on network profitability.',
    },
    exitPotential: {
      assumedValuationPaise,
      liquidityPct: 25,
      hotelSharePaise: exitPotentialPaise,
      note: 'Based on assumed network valuation at 25% liquidity. Illustrative only.',
    },
  });
}));

export default router;

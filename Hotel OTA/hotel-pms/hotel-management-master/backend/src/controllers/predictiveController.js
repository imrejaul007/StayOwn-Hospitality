/**
 * Predictive Analytics Controller
 * Statistical predictions based on existing booking/guest data.
 * No ML models — uses weighted scoring on historical patterns.
 */
import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Room from '../models/Room.js';
import GuestCRMProfile from '../models/GuestCRMProfile.js';
import VIPGuest from '../models/VIPGuest.js';
import User from '../models/User.js';
import { catchAsync } from '../utils/catchAsync.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

/**
 * GET /analytics/predict/no-shows/:hotelId
 * Predict no-show probability for upcoming confirmed bookings.
 */
export const predictNoShows = catchAsync(async (req, res) => {
  const { hotelId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(hotelId)) {
    throw new ApplicationError('Invalid hotelId format', 400);
  }
  const days = parseInt(req.query.days) || 14;
  const hotelOid = new mongoose.Types.ObjectId(hotelId);

  const now = new Date();
  const futureDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  // Get upcoming confirmed bookings
  const bookings = await Booking.find({
    hotelId: hotelOid,
    status: { $in: ['confirmed', 'pending'] },
    checkIn: { $gte: now, $lte: futureDate },
  })
    .populate('userId', 'name email')
    .populate('roomId', 'roomNumber roomType')
    .select('checkIn checkOut totalAmount paymentStatus source userId roomId nights bookingId createdAt')
    .lean()
    .limit(100);

  const predictions = await Promise.all(
    bookings.map(async (booking) => {
      let noShowRate = 0;
      let previousStays = 0;

      // Look up guest CRM profile for historical no-show rate
      if (booking.userId) {
        const guestId = typeof booking.userId === 'object' ? booking.userId._id : booking.userId;
        const profile = await GuestCRMProfile.findOne({ userId: guestId, hotelId })
          .select('bookingHistory predictions')
          .lean();

        if (profile) {
          noShowRate = profile.bookingHistory?.noShowRate || 0;
          previousStays = profile.bookingHistory?.totalBookings || 0;
        }
      }

      // Calculate lead time in days
      const leadTimeDays = Math.max(0, Math.floor((new Date(booking.checkIn) - now) / (1000 * 60 * 60 * 24)));

      // Weighted scoring (0-100)
      const guestHistoryScore = Math.min(noShowRate * 100, 100) * 0.4;
      const leadTimeScore = (leadTimeDays < 2 ? 30 : leadTimeDays < 7 ? 15 : 5) * 0.2;
      const paymentScore = (booking.paymentStatus === 'pending' || booking.paymentStatus === 'unpaid' ? 30 : 5) * 0.2;
      const newGuestScore = (previousStays === 0 ? 25 : previousStays < 3 ? 15 : 5) * 0.1;
      const sourceScore = (['ota', 'third_party'].includes(booking.source) ? 20 : 10) * 0.1;

      const probability = Math.min(100, Math.round(guestHistoryScore + leadTimeScore + paymentScore + newGuestScore + sourceScore));

      const risk = probability > 60 ? 'high' : probability > 30 ? 'medium' : 'low';

      const factors = [];
      if (noShowRate > 0.1) factors.push('Previous no-show history');
      if (leadTimeDays < 2) factors.push('Very short lead time');
      if (booking.paymentStatus === 'pending') factors.push('No payment received');
      if (previousStays === 0) factors.push('First-time guest');
      if (['ota', 'third_party'].includes(booking.source)) factors.push('Third-party booking');
      if (factors.length === 0) factors.push('Standard booking pattern');

      const recommendedAction = risk === 'high'
        ? 'Contact guest to reconfirm. Consider overbooking.'
        : risk === 'medium'
          ? 'Send reminder email 24h before check-in.'
          : 'No action needed.';

      return {
        bookingId: booking.bookingId || booking._id.toString(),
        guestName: booking.userId?.name || 'Unknown Guest',
        checkInDate: booking.checkIn,
        roomType: booking.roomId?.roomType || 'Standard',
        roomNumber: booking.roomId?.roomNumber || '',
        noShowProbability: probability,
        risk,
        factors,
        recommendedAction,
        potentialRevenueLoss: booking.totalAmount || 0,
      };
    })
  );

  // Sort by probability descending
  predictions.sort((a, b) => b.noShowProbability - a.noShowProbability);

  res.json({
    success: true,
    data: {
      predictions,
      summary: {
        total: predictions.length,
        highRisk: predictions.filter(p => p.risk === 'high').length,
        mediumRisk: predictions.filter(p => p.risk === 'medium').length,
        lowRisk: predictions.filter(p => p.risk === 'low').length,
        totalRevenueAtRisk: predictions.filter(p => p.risk !== 'low').reduce((sum, p) => sum + p.potentialRevenueLoss, 0),
      },
    },
  });
});

/**
 * GET /analytics/predict/guest-value/:hotelId
 * Predict guest lifetime value and churn risk.
 */
export const predictGuestValue = catchAsync(async (req, res) => {
  const { hotelId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(hotelId)) {
    throw new ApplicationError('Invalid hotelId format', 400);
  }
  const hotelOid = new mongoose.Types.ObjectId(hotelId);
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const page = parseInt(req.query.page) || 1;

  const profiles = await GuestCRMProfile.find({ hotelId: hotelOid })
    .populate('userId', 'name email phone')
    .select('userId bookingHistory predictions satisfaction lifecycleStage')
    .sort({ 'bookingHistory.totalRevenue': -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const totalCount = await GuestCRMProfile.countDocuments({ hotelId: hotelOid });

  const predictions = await Promise.all(
    profiles.map(async (profile) => {
      const userId = typeof profile.userId === 'object' ? profile.userId._id : profile.userId;

      // Try to get VIP data
      let tier = 'bronze';
      const vip = await VIPGuest.findOne({ userId, hotelId }).select('vipLevel').lean();
      if (vip) tier = vip.vipLevel;
      else if ((profile.bookingHistory?.totalRevenue || 0) > 500000) tier = 'platinum';
      else if ((profile.bookingHistory?.totalRevenue || 0) > 200000) tier = 'gold';
      else if ((profile.bookingHistory?.totalRevenue || 0) > 50000) tier = 'silver';

      const currentValue = profile.bookingHistory?.totalRevenue || 0;
      const predictedLTV = profile.predictions?.lifetimeValuePrediction || currentValue * 1.5;
      const churnRisk = Math.round((profile.predictions?.churnProbability || 0.3) * 100);
      const nextBookingProb = Math.round((profile.predictions?.nextBookingProbability || 0.5) * 100);
      const loyaltyScore = Math.min(100, Math.round(
        ((profile.bookingHistory?.totalBookings || 0) * 5) +
        ((profile.satisfaction?.averageRating || 3) * 10) +
        (tier === 'platinum' ? 30 : tier === 'gold' ? 20 : tier === 'silver' ? 10 : 0)
      ));

      const recommendedPerks = [];
      if (tier === 'platinum' || tier === 'diamond') recommendedPerks.push('Complimentary suite upgrade', 'Airport transfer', 'Personal concierge');
      else if (tier === 'gold') recommendedPerks.push('Room upgrade', 'Late checkout', 'Welcome amenity');
      else if (tier === 'silver') recommendedPerks.push('Early check-in', 'Breakfast voucher');
      else recommendedPerks.push('Loyalty program enrollment', 'First-stay discount');

      if (churnRisk > 50) recommendedPerks.push('Win-back offer: 20% discount');

      return {
        guestId: userId?.toString() || profile._id.toString(),
        guestName: profile.userId?.name || 'Unknown',
        email: profile.userId?.email || '',
        currentValue,
        predictedLifetimeValue: Math.round(predictedLTV),
        valueTier: tier,
        loyaltyScore,
        churnRisk,
        nextBookingProbability: nextBookingProb,
        recommendedPerks,
        totalStays: profile.bookingHistory?.totalBookings || 0,
        lifecycleStage: profile.lifecycleStage || 'prospect',
      };
    })
  );

  res.json({
    success: true,
    data: {
      predictions,
      pagination: { page, limit, totalCount, totalPages: Math.ceil(totalCount / limit) },
    },
  });
});

/**
 * GET /analytics/predict/overbooking/:hotelId
 * Recommend optimal overbooking levels per room type per date.
 */
export const predictOverbooking = catchAsync(async (req, res) => {
  const { hotelId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(hotelId)) {
    throw new ApplicationError('Invalid hotelId format', 400);
  }
  const days = parseInt(req.query.days) || 14;
  const hotelOid = new mongoose.Types.ObjectId(hotelId);

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // Get room types and counts
  const roomsByType = await Room.aggregate([
    { $match: { hotelId: hotelOid, isActive: true } },
    { $group: { _id: '$roomType', count: { $sum: 1 } } },
  ]);

  if (roomsByType.length === 0) {
    return res.json({ success: true, data: { recommendations: [], summary: {} } });
  }

  // Get historical no-show rate by day of week (last 90 days)
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const noShowByDow = await Booking.aggregate([
    {
      $match: {
        hotelId: hotelOid,
        checkIn: { $gte: ninetyDaysAgo, $lt: now },
        status: { $in: ['confirmed', 'checked_in', 'no_show', 'completed'] },
      },
    },
    {
      $group: {
        _id: { $dayOfWeek: '$checkIn' },
        total: { $sum: 1 },
        noShows: { $sum: { $cond: [{ $eq: ['$status', 'no_show'] }, 1, 0] } },
      },
    },
  ]);

  const noShowRateByDow = {};
  for (const row of noShowByDow) {
    noShowRateByDow[row._id] = row.total > 0 ? row.noShows / row.total : 0;
  }

  const recommendations = [];

  for (let d = 0; d < days; d++) {
    const date = new Date(now.getTime() + d * 24 * 60 * 60 * 1000);
    const dow = date.getDay() + 1; // MongoDB dayOfWeek is 1-7
    const historicalNoShowRate = noShowRateByDow[dow] || 0.05;

    for (const rt of roomsByType) {
      const nextDay = new Date(date.getTime() + 24 * 60 * 60 * 1000);

      const currentBookings = await Booking.countDocuments({
        hotelId: hotelOid,
        roomType: rt._id,
        status: { $in: ['confirmed', 'checked_in'] },
        checkIn: { $lt: nextDay },
        checkOut: { $gt: date },
      });

      const capacity = rt.count;
      const occupancyPct = capacity > 0 ? currentBookings / capacity : 0;
      const optimalOverbooking = Math.round(capacity * historicalNoShowRate);
      const riskLevel = occupancyPct > 0.95 ? 'high' : occupancyPct > 0.8 ? 'medium' : 'low';

      // Estimate additional revenue from optimal overbooking
      const avgRate = 5000; // fallback; ideally from room type pricing
      const potentialRevenue = optimalOverbooking * avgRate;

      recommendations.push({
        date: date.toISOString().split('T')[0],
        roomType: rt._id,
        currentBookings,
        capacity,
        occupancyRate: Math.round(occupancyPct * 100),
        historicalNoShowRate: Math.round(historicalNoShowRate * 100),
        optimalOverbooking,
        riskLevel,
        expectedWalkIns: Math.round(capacity * 0.02),
        potentialRevenue,
        riskAssessment: riskLevel === 'high'
          ? 'High occupancy — overbooking carries displacement risk'
          : riskLevel === 'medium'
            ? 'Moderate occupancy — safe to overbook by recommended amount'
            : 'Low occupancy — overbooking unnecessary',
      });
    }
  }

  res.json({
    success: true,
    data: {
      recommendations,
      summary: {
        totalDays: days,
        roomTypes: roomsByType.length,
        avgNoShowRate: Math.round(
          (Object.values(noShowRateByDow).reduce((a, b) => a + b, 0) /
            Math.max(1, Object.keys(noShowRateByDow).length)) * 100
        ),
      },
    },
  });
});

/**
 * GET /analytics/predict/length-of-stay/:hotelId
 * Predict which in-house guests are likely to extend their stay.
 */
export const predictLengthOfStay = catchAsync(async (req, res) => {
  const { hotelId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(hotelId)) {
    throw new ApplicationError('Invalid hotelId format', 400);
  }
  const hotelOid = new mongoose.Types.ObjectId(hotelId);

  // Get currently checked-in bookings
  const inHouseBookings = await Booking.find({
    hotelId: hotelOid,
    status: 'checked_in',
  })
    .populate('userId', 'name email')
    .populate('roomId', 'roomNumber roomType')
    .select('checkIn checkOut nights totalAmount userId roomId bookingId')
    .lean()
    .limit(50);

  const predictions = await Promise.all(
    inHouseBookings.map(async (booking) => {
      let avgStay = 3; // default
      let guestProfile = null;

      if (booking.userId) {
        const guestId = typeof booking.userId === 'object' ? booking.userId._id : booking.userId;
        guestProfile = await GuestCRMProfile.findOne({ userId: guestId, hotelId })
          .select('bookingHistory behaviorProfile')
          .lean();

        if (guestProfile?.behaviorProfile?.bookingPattern?.averageLengthOfStay) {
          avgStay = guestProfile.behaviorProfile.bookingPattern.averageLengthOfStay;
        } else if (guestProfile?.bookingHistory?.totalNights && guestProfile?.bookingHistory?.totalBookings) {
          avgStay = guestProfile.bookingHistory.totalNights / guestProfile.bookingHistory.totalBookings;
        }
      }

      const currentNights = booking.nights || Math.ceil(
        (new Date(booking.checkOut) - new Date(booking.checkIn)) / (1000 * 60 * 60 * 24)
      );

      // Extension probability calculation
      let extensionProbability;
      if (avgStay > currentNights) {
        extensionProbability = Math.min(80, Math.round(((avgStay - currentNights) / avgStay) * 100));
      } else {
        extensionProbability = 10; // baseline probability
      }

      const predictedExtension = avgStay > currentNights ? Math.round(avgStay - currentNights) : 0;

      const factors = [];
      if (avgStay > currentNights) factors.push(`Guest average stay: ${avgStay.toFixed(1)} nights`);
      if ((guestProfile?.bookingHistory?.totalBookings || 0) > 5) factors.push('Repeat guest with long booking history');
      const daysUntilCheckout = Math.ceil((new Date(booking.checkOut) - new Date()) / (1000 * 60 * 60 * 24));
      if (daysUntilCheckout <= 1) factors.push('Checkout is tomorrow — extension decision imminent');
      if (factors.length === 0) factors.push('Standard stay pattern');

      const upsellOpportunities = [];
      if (extensionProbability > 40) {
        upsellOpportunities.push('Offer discounted extended stay rate');
        upsellOpportunities.push('Suggest room upgrade for remaining nights');
      }
      if (extensionProbability > 60) {
        upsellOpportunities.push('Offer spa/dining package for extended stay');
      }

      return {
        bookingId: booking.bookingId || booking._id.toString(),
        guestName: booking.userId?.name || 'Unknown Guest',
        roomNumber: booking.roomId?.roomNumber || '',
        roomType: booking.roomId?.roomType || 'Standard',
        initialStay: currentNights,
        predictedExtension,
        extensionProbability,
        factors,
        upsellOpportunities,
        checkOut: booking.checkOut,
      };
    })
  );

  predictions.sort((a, b) => b.extensionProbability - a.extensionProbability);

  res.json({
    success: true,
    data: {
      predictions,
      summary: {
        totalInHouse: predictions.length,
        likelyExtensions: predictions.filter(p => p.extensionProbability > 40).length,
        avgExtensionProbability: predictions.length > 0
          ? Math.round(predictions.reduce((sum, p) => sum + p.extensionProbability, 0) / predictions.length)
          : 0,
      },
    },
  });
});

import { Property, Booking, Review } from '../models';
import { NotFoundError } from '../utils/errors';
import { logger } from '../utils/logger';

const hostLogger = logger.child({ service: 'HostService' });

// ── Types ─────────────────────────────────────────────────────────────────────

export interface HostDashboardData {
  overview: {
    totalProperties: number;
    activeProperties: number;
    totalBookings: number;
    pendingBookings: number;
    completedBookings: number;
    totalEarnings: number;
    pendingPayouts: number;
    averageRating: number;
    responseRate: number;
  };
  recentActivity: Array<{
    type: 'booking' | 'review' | 'message' | 'payment';
    title: string;
    description: string;
    timestamp: Date;
  }>;
  topProperties: Array<{
    propertyId: string;
    title: string;
    bookings: number;
    earnings: number;
    rating: number;
  }>;
}

export interface EarningsData {
  totalEarnings: number;
  availableBalance: number;
  pendingBalance: number;
  currency: string;
  earningsByMonth: Array<{
    month: string;
    amount: number;
    bookings: number;
  }>;
  earningsByProperty: Array<{
    propertyId: string;
    title: string;
    amount: number;
    bookings: number;
  }>;
  platformFees: number;
  netEarnings: number;
}

export interface HostCalendarData {
  propertyId: string;
  title: string;
  dates: Array<{
    date: string;
    status: 'booked' | 'available' | 'blocked';
    bookingId?: string;
    checkIn?: string;
    checkOut?: string;
    guestName?: string;
    earnings?: number;
  }>;
  summary: {
    bookedDays: number;
    availableDays: number;
    blockedDays: number;
    monthEarnings: number;
  };
}

// ── Service Functions ───────────────────────────────────────────────────────────

/**
 * Get host dashboard data
 */
export async function getHostDashboard(hostId: string): Promise<HostDashboardData> {
  // Verify host has properties
  const propertyCount = await Property.countDocuments({ hostId });
  if (propertyCount === 0) {
    throw new NotFoundError('Host properties', hostId);
  }

  // Get property stats
  const properties = await Property.find({ hostId }).lean();
  const propertyIds = properties.map((p) => p.propertyId);

  // Get booking stats
  const bookingStats = await Booking.aggregate([
    { $match: { hostId } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        amount: { $sum: '$pricing.total' },
      },
    },
  ]);

  const bookingsByStatus = new Map<string, { count: number; amount: number }>();
  let totalBookings = 0;
  let totalEarnings = 0;

  for (const stat of bookingStats) {
    bookingsByStatus.set(stat._id, { count: stat.count, amount: stat.amount });
    totalBookings += stat.count;
    if (stat._id === 'completed') {
      totalEarnings += stat.amount;
    }
  }

  const pending = bookingsByStatus.get('pending') || { count: 0, amount: 0 };
  const confirmed = bookingsByStatus.get('confirmed') || { count: 0, amount: 0 };
  const completed = bookingsByStatus.get('completed') || { count: 0, amount: 0 };

  // Get reviews stats
  const reviewStats = await Review.aggregate([
    { $match: { hostId, reviewerType: 'guest' } },
    {
      $group: {
        _id: null,
        avgRating: { $avg: '$rating' },
        count: { $sum: 1 },
      },
    },
  ]);

  const averageRating = reviewStats[0]?.avgRating || 0;

  // Calculate response rate (simplified - would use actual messaging data)
  const totalReviews = reviewStats[0]?.count || 0;
  const responseRate = propertyCount > 0 ? Math.min(100, 90 + (totalReviews * 0.5)) : 0;

  // Get top properties
  const topProperties = await Booking.aggregate([
    { $match: { hostId, status: 'completed' } },
    {
      $group: {
        _id: '$propertyId',
        bookings: { $sum: 1 },
        earnings: { $sum: '$pricing.total' },
      },
    },
    { $sort: { earnings: -1 } },
    { $limit: 5 },
    {
      $lookup: {
        from: 'properties',
        localField: '_id',
        foreignField: 'propertyId',
        as: 'property',
      },
    },
    { $unwind: '$property' },
    {
      $project: {
        propertyId: '$_id',
        title: '$property.title',
        bookings: 1,
        earnings: 1,
        rating: '$property.stats.rating',
      },
    },
  ]);

  // Get recent activity
  const recentBookings = await Booking.find({ hostId })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  const recentReviews = await Review.find({ hostId })
    .sort({ createdAt: -1 })
    .limit(3)
    .lean();

  const recentActivity: HostDashboardData['recentActivity'] = [];

  for (const booking of recentBookings) {
    recentActivity.push({
      type: 'booking',
      title: `New ${booking.status} booking`,
      description: `Booking ${booking.bookingId} - ${booking.totalNights} nights`,
      timestamp: booking.createdAt,
    });
  }

  for (const review of recentReviews) {
    recentActivity.push({
      type: 'review',
      title: `New ${review.rating}-star review`,
      description: review.comment.substring(0, 50) + '...',
      timestamp: review.createdAt,
    });
  }

  // Sort by timestamp
  recentActivity.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return {
    overview: {
      totalProperties: propertyCount,
      activeProperties: properties.filter((p) => p.status === 'active').length,
      totalBookings,
      pendingBookings: pending.count + confirmed.count,
      completedBookings: completed.count,
      totalEarnings,
      pendingPayouts: pending.amount + confirmed.amount,
      averageRating: Math.round(averageRating * 10) / 10,
      responseRate: Math.round(responseRate),
    },
    recentActivity: recentActivity.slice(0, 10),
    topProperties: topProperties.map((p) => ({
      propertyId: p.propertyId,
      title: p.title,
      bookings: p.bookings,
      earnings: p.earnings,
      rating: p.rating,
    })),
  };
}

/**
 * Get host earnings data
 */
export async function getHostEarnings(
  hostId: string,
  options: {
    startDate?: Date;
    endDate?: Date;
    propertyId?: string;
  } = {}
): Promise<EarningsData> {
  const { startDate, endDate, propertyId } = options;

  // Build match query
  const matchQuery: Record<string, unknown> = {
    hostId,
    status: { $in: ['completed', 'confirmed'] },
  };

  if (propertyId) {
    matchQuery.propertyId = propertyId;
  }

  if (startDate || endDate) {
    matchQuery.createdAt = {};
    if (startDate) (matchQuery.createdAt as Record<string, Date>).$gte = startDate;
    if (endDate) (matchQuery.createdAt as Record<string, Date>).$lte = endDate;
  }

  // Overall stats
  const overallStats = await Booking.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalEarnings: { $sum: '$pricing.total' },
        platformFees: {
          $sum: { $add: ['$pricing.serviceFee', '$pricing.taxes'] },
        },
        count: { $sum: 1 },
      },
    },
  ]);

  const overall = overallStats[0] || { totalEarnings: 0, platformFees: 0, count: 0 };

  // Earnings by month (last 12 months)
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const earningsByMonth = await Booking.aggregate([
    {
      $match: {
        ...matchQuery,
        createdAt: { $gte: twelveMonthsAgo },
        status: 'completed',
      },
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
        },
        amount: { $sum: '$pricing.total' },
        bookings: { $sum: 1 },
      },
    },
    { $sort: { '_id.year': -1, '_id.month': -1 } },
    {
      $project: {
        month: {
          $dateToString: {
            format: '%Y-%m',
            date: {
              $dateFromParts: {
                year: '$_id.year',
                month: '$_id.month',
                day: 1,
              },
            },
          },
        },
        amount: 1,
        bookings: 1,
      },
    },
  ]);

  // Earnings by property
  const earningsByProperty = await Booking.aggregate([
    { $match: { ...matchQuery, status: 'completed' } },
    {
      $group: {
        _id: '$propertyId',
        amount: { $sum: '$pricing.total' },
        bookings: { $sum: 1 },
      },
    },
    { $sort: { amount: -1 } },
    {
      $lookup: {
        from: 'properties',
        localField: '_id',
        foreignField: 'propertyId',
        as: 'property',
      },
    },
    { $unwind: '$property' },
    {
      $project: {
        propertyId: '$_id',
        title: '$property.title',
        amount: 1,
        bookings: 1,
      },
    },
  ]);

  // Calculate pending balance (confirmed but not completed)
  const pendingStats = await Booking.aggregate([
    {
      $match: {
        hostId,
        status: 'confirmed',
        ...(propertyId ? { propertyId } : {}),
      },
    },
    {
      $group: {
        _id: null,
        pendingBalance: { $sum: '$pricing.total' },
      },
    },
  ]);

  const pendingBalance = pendingStats[0]?.pendingBalance || 0;

  return {
    totalEarnings: overall.totalEarnings,
    availableBalance: overall.totalEarnings - pendingBalance,
    pendingBalance,
    currency: 'INR',
    earningsByMonth: earningsByMonth.map((m) => ({
      month: m.month,
      amount: m.amount,
      bookings: m.bookings,
    })),
    earningsByProperty: earningsByProperty.map((p) => ({
      propertyId: p.propertyId,
      title: p.title,
      amount: p.amount,
      bookings: p.bookings,
    })),
    platformFees: overall.platformFees,
    netEarnings: overall.totalEarnings - overall.platformFees,
  };
}

/**
 * Get host calendar (all properties overview)
 */
export async function getHostCalendar(
  hostId: string,
  options: {
    startDate: Date;
    endDate: Date;
    propertyId?: string;
  }
): Promise<HostCalendarData[]> {
  const { startDate, endDate, propertyId } = options;

  // Get host's properties
  const propertyQuery: Record<string, unknown> = { hostId };
  if (propertyId) {
    propertyQuery.propertyId = propertyId;
  }

  const properties = await Property.find(propertyQuery).lean();
  if (properties.length === 0) {
    throw new NotFoundError('Host properties', hostId);
  }

  const results: HostCalendarData[] = [];

  for (const property of properties) {
    // Get bookings in date range
    const bookings = await Booking.find({
      propertyId: property.propertyId,
      status: { $in: ['confirmed', 'completed'] },
      $or: [
        { checkIn: { $lte: endDate }, checkOut: { $gte: startDate } },
      ],
    })
      .populate('guestId', 'name email')
      .lean();

    // Generate date entries
    const dates: HostCalendarData['dates'] = [];
    let bookedDays = 0;
    let availableDays = 0;
    let blockedDays = 0;
    let monthEarnings = 0;

    const current = new Date(startDate);
    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0];
      let status: 'booked' | 'available' | 'blocked' = 'available';
      let bookingId: string | undefined;
      let checkIn: string | undefined;
      let checkOut: string | undefined;
      let guestName: string | undefined;
      let earnings: number | undefined;

      // Check if date falls within any booking
      for (const booking of bookings) {
        const bookingCheckIn = new Date(booking.checkIn);
        const bookingCheckOut = new Date(booking.checkOut);

        if (current >= bookingCheckIn && current < bookingCheckOut) {
          status = 'booked';
          bookingId = booking.bookingId;

          // Set check-in/check-out info
          if (current.getTime() === bookingCheckIn.getTime()) {
            checkIn = bookingCheckIn.toISOString().split('T')[0];
          }
          if (current.getTime() === bookingCheckOut.getTime() - 86400000) {
            checkOut = bookingCheckOut.toISOString().split('T')[0];
          }

          // Guest info
          if (booking.guestId && typeof booking.guestId === 'object') {
            guestName = (booking.guestId as unknown as { name?: string }).name;
          }

          // Calculate daily earnings
          earnings = booking.pricing.nightlyRate;

          bookedDays++;
          break;
        }
      }

      if (status === 'available') {
        availableDays++;
      }

      dates.push({
        date: dateStr,
        status,
        bookingId,
        checkIn,
        checkOut,
        guestName,
        earnings,
      });

      current.setDate(current.getDate() + 1);
    }

    // Count blocked days (not implemented in this version)
    blockedDays = 0;

    // Calculate month earnings
    monthEarnings = bookings.reduce((sum, b) => sum + b.pricing.total, 0);

    results.push({
      propertyId: property.propertyId,
      title: property.title,
      dates,
      summary: {
        bookedDays,
        availableDays,
        blockedDays,
        monthEarnings,
      },
    });
  }

  hostLogger.info(
    { hostId, startDate, endDate, propertiesCount: results.length },
    'Host calendar retrieved'
  );

  return results;
}

/**
 * Get host performance metrics
 */
export async function getHostMetrics(hostId: string): Promise<{
  occupancyRate: number;
  averageDailyRate: number;
  revenuePerListing: number;
  guestSatisfaction: number;
  responseTime: string;
  listingQuality: number;
}> {
  const properties = await Property.find({ hostId }).lean();
  const propertyIds = properties.map((p) => p.propertyId);

  if (propertyIds.length === 0) {
    throw new NotFoundError('Host properties', hostId);
  }

  // Calculate occupancy rate
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const occupancyStats = await Booking.aggregate([
    {
      $match: {
        propertyId: { $in: propertyIds },
        status: { $in: ['confirmed', 'completed'] },
        checkIn: { $lte: new Date() },
        checkOut: { $gte: thirtyDaysAgo },
      },
    },
    {
      $group: {
        _id: null,
        totalBookedNights: { $sum: '$totalNights' },
      },
    },
  ]);

  const totalDays = 30 * propertyIds.length;
  const totalBookedNights = occupancyStats[0]?.totalBookedNights || 0;
  const occupancyRate = Math.round((totalBookedNights / totalDays) * 100);

  // Calculate ADR
  const adrStats = await Booking.aggregate([
    {
      $match: {
        propertyId: { $in: propertyIds },
        status: 'completed',
        createdAt: { $gte: thirtyDaysAgo },
      },
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$pricing.subtotal' },
        totalNights: { $sum: '$totalNights' },
      },
    },
  ]);

  const totalRevenue = adrStats[0]?.totalRevenue || 0;
  const totalNights = adrStats[0]?.totalNights || 1;
  const averageDailyRate = Math.round(totalRevenue / totalNights);

  // Calculate RevPAR (Revenue Per Available Listing)
  const revenuePerListing = Math.round(totalRevenue / propertyIds.length);

  // Calculate guest satisfaction from reviews
  const satisfactionStats = await Review.aggregate([
    {
      $match: {
        hostId,
        reviewerType: 'guest',
      },
    },
    {
      $group: {
        _id: null,
        avgRating: { $avg: '$rating' },
        avgCleanliness: { $avg: '$ratings.cleanliness' },
        avgAccuracy: { $avg: '$ratings.accuracy' },
        avgCommunication: { $avg: '$ratings.communication' },
      },
    },
  ]);

  const guestSatisfaction = satisfactionStats[0]
    ? Math.round(satisfactionStats[0].avgRating * 20)
    : 0;

  // Calculate listing quality (average of all property quality scores)
  const listingQuality = Math.round(
    properties.reduce((sum, p) => sum + (p.qualityScore || 0), 0) / properties.length
  );

  return {
    occupancyRate,
    averageDailyRate,
    revenuePerListing,
    guestSatisfaction,
    responseTime: 'within an hour',
    listingQuality,
  };
}

import User from '../models/User.js';
import Booking from '../models/Booking.js';
import Review from '../models/Review.js';
import Notification from '../models/Notification.js';
import DigitalKey from '../models/DigitalKey.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import mongoose from 'mongoose';
import { ensureTenantContext } from '../middleware/tenantIsolation.js';

const TENANT_SCOPED_ROLES = ['staff', 'frontdesk', 'manager'];

const buildGuestByIdFilter = (req, guestId) => {
  const filter = { _id: guestId, role: 'guest' };
  if (TENANT_SCOPED_ROLES.includes(req.user.role)) {
    filter.hotelId = req.user.hotelId;
  }
  // Guest role users can only access their own profile
  if (req.user.role === 'guest') {
    filter._id = req.user._id;
  }
  return filter;
};

// Get all guests with advanced filtering and search
export const getAllGuests = catchAsync(async (req, res) => {
  const { hotelId } = req.user;
  const {
    page = 1,
    limit = 20,
    search,
    loyaltyTier,
    guestType,
    hasBookings,
    hasReviews,
    lastStayDate,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  // Build query
  const query = { role: 'guest', hotelId };

  // Search functionality
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } }
    ];
  }

  // Filter by loyalty tier
  if (loyaltyTier) {
    query['loyalty.tier'] = loyaltyTier;
  }

  // Filter by guest type
  if (guestType) {
    query.guestType = guestType;
  }

  // Filter by booking history — use aggregation with limit to avoid unbounded distinct()
  const FILTER_ID_LIMIT = 10000;
  if (hasBookings === 'true') {
    const rows = await Booking.aggregate([
      { $match: { hotelId: mongoose.Types.ObjectId.isValid(hotelId) ? new mongoose.Types.ObjectId(hotelId) : hotelId } },
      { $group: { _id: '$userId' } },
      { $limit: FILTER_ID_LIMIT }
    ]);
    query._id = { $in: rows.map((r) => r._id) };
  } else if (hasBookings === 'false') {
    const rows = await Booking.aggregate([
      { $match: { hotelId: mongoose.Types.ObjectId.isValid(hotelId) ? new mongoose.Types.ObjectId(hotelId) : hotelId } },
      { $group: { _id: '$userId' } },
      { $limit: FILTER_ID_LIMIT }
    ]);
    query._id = { $nin: rows.map((r) => r._id) };
  }

  // Filter by review history — use aggregation with limit
  if (hasReviews === 'true') {
    const rows = await Review.aggregate([
      { $match: { hotelId: mongoose.Types.ObjectId.isValid(hotelId) ? new mongoose.Types.ObjectId(hotelId) : hotelId } },
      { $group: { _id: '$userId' } },
      { $limit: FILTER_ID_LIMIT }
    ]);
    query._id = { ...(query._id || {}), $in: rows.map((r) => r._id) };
  } else if (hasReviews === 'false') {
    const rows = await Review.aggregate([
      { $match: { hotelId: mongoose.Types.ObjectId.isValid(hotelId) ? new mongoose.Types.ObjectId(hotelId) : hotelId } },
      { $group: { _id: '$userId' } },
      { $limit: FILTER_ID_LIMIT }
    ]);
    query._id = { ...(query._id || {}), $nin: rows.map((r) => r._id) };
  }

  // Filter by last stay date — use aggregation with limit
  if (lastStayDate) {
    const date = new Date(lastStayDate);
    const rows = await Booking.aggregate([
      {
        $match: {
          hotelId: mongoose.Types.ObjectId.isValid(hotelId) ? new mongoose.Types.ObjectId(hotelId) : hotelId,
          checkOut: { $gte: date }
        }
      },
      { $group: { _id: '$userId' } },
      { $limit: FILTER_ID_LIMIT }
    ]);
    query._id = { ...(query._id || {}), $in: rows.map((r) => r._id) };
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

  const guests = await User.find(query)
    .populate('salutationId', 'title fullForm')
    .select('-password -passwordResetToken -passwordResetExpires')
    .sort(sort)
    .skip(skip)
    .limit(parseInt(limit)).lean();

  const total = await User.countDocuments(query);

  // Batch stats lookup: single aggregation per collection across ALL guests on this page
  const guestIds = guests.map((g) => g._id);
  const hotelObjectId = mongoose.Types.ObjectId.isValid(hotelId)
    ? new mongoose.Types.ObjectId(hotelId)
    : hotelId;

  const [bookingAggResults, reviewAggResults] = await Promise.all([
    Booking.aggregate([
      { $match: { userId: { $in: guestIds }, hotelId: hotelObjectId } },
      {
        $group: {
          _id: '$userId',
          totalBookings: { $sum: 1 },
          totalNights: { $sum: { $subtract: ['$checkOut', '$checkIn'] } },
          totalSpent: { $sum: '$totalAmount' },
          lastStay: { $max: '$checkOut' }
        }
      }
    ]),
    Review.aggregate([
      { $match: { userId: { $in: guestIds }, hotelId: hotelObjectId } },
      {
        $group: {
          _id: '$userId',
          totalReviews: { $sum: 1 },
          averageRating: { $avg: '$rating' }
        }
      }
    ])
  ]);

  // Build lookup maps keyed by guest ID string
  const bookingStatsByGuest = new Map(bookingAggResults.map((r) => [r._id.toString(), r]));
  const reviewStatsByGuest = new Map(reviewAggResults.map((r) => [r._id.toString(), r]));

  const guestsWithStats = guests.map((guest) => {
    const guestIdStr = guest._id.toString();
    const bStats = bookingStatsByGuest.get(guestIdStr) || { totalBookings: 0, totalNights: 0, totalSpent: 0, lastStay: null };
    const rStats = reviewStatsByGuest.get(guestIdStr) || { totalReviews: 0, averageRating: 0 };

    // Compute billing completeness: both a GST number and company name must be present
    const billing = guest.billingDetails || {};
    const hasCompleteBillingInfo = !!(
      billing.gstNumber && billing.gstNumber.trim() &&
      billing.companyName && billing.companyName.trim()
    );

    return {
      ...guest,
      hasCompleteBillingInfo,
      stats: {
        bookings: {
          totalBookings: bStats.totalBookings,
          totalNights: bStats.totalNights,
          totalSpent: bStats.totalSpent,
          lastStay: bStats.lastStay
        },
        reviews: {
          totalReviews: rStats.totalReviews,
          averageRating: rStats.averageRating
        }
      }
    };
  });

  res.json({
    status: 'success',
    results: guestsWithStats.length,
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      total
    },
    data: { guests: guestsWithStats }
  });
});

// Get guest by ID with detailed information
export const getGuest = catchAsync(async (req, res) => {
  const guest = await User.findOne(buildGuestByIdFilter(req, req.params.id))
    .populate('salutationId', 'title fullForm')
    .select('-password -passwordResetToken -passwordResetExpires').lean();

  if (!guest) {
    throw new ApplicationError('Guest not found', 404);
  }

  // Get detailed statistics
  const [bookingStats, recentBookings, reviews] = await Promise.all([
    // Booking statistics
    Booking.aggregate([
      { $match: { userId: guest._id, hotelId: guest.hotelId } },
      {
        $group: {
          _id: null,
          totalBookings: { $sum: 1 },
          totalNights: { $sum: { $subtract: ['$checkOut', '$checkIn'] } },
          totalSpent: { $sum: '$totalAmount' },
          averageStayLength: { $avg: { $subtract: ['$checkOut', '$checkIn'] } },
          firstStay: { $min: '$checkIn' },
          lastStay: { $max: '$checkOut' }
        }
      }
    ]),
    // Recent bookings
    Booking.find({ userId: guest._id, hotelId: guest.hotelId })
      .populate('rooms.roomId', 'roomNumber type')
      .sort({ createdAt: -1 })
      .limit(5),
    // Reviews
    Review.find({ userId: guest._id, hotelId: guest.hotelId })
      .sort({ createdAt: -1 })
      .limit(5)
  ]);

  const guestWithDetails = {
    ...guest,
    stats: {
      bookings: bookingStats[0] || {
        totalBookings: 0,
        totalNights: 0,
        totalSpent: 0,
        averageStayLength: 0,
        firstStay: null,
        lastStay: null
      },
      recentBookings,
      reviews
    }
  };

  res.json({
    status: 'success',
    data: { guest: guestWithDetails }
  });
});

// Create new guest
export const createGuest = catchAsync(async (req, res) => {
  const guestData = {
    ...req.body,
    role: 'guest',
    hotelId: req.user.hotelId
  };

  const guest = await User.create(guestData);
  await guest.populate('salutationId', 'title fullForm');

  res.status(201).json({
    status: 'success',
    data: { guest }
  });
});

// Fields that guest-role users are allowed to update on their own profile
const GUEST_SELF_UPDATE_ALLOWED_FIELDS = ['name', 'phone', 'preferences', 'avatar'];

// Update guest
export const updateGuest = catchAsync(async (req, res) => {
  let updateData = req.body;

  // For guest-role users, whitelist allowed fields to prevent privilege escalation
  if (req.user.role === 'guest') {
    const sanitized = {};
    for (const field of GUEST_SELF_UPDATE_ALLOWED_FIELDS) {
      if (updateData[field] !== undefined) {
        sanitized[field] = updateData[field];
      }
    }
    updateData = sanitized;

    if (Object.keys(updateData).length === 0) {
      throw new ApplicationError('No allowed fields to update', 400);
    }
  }

  const guest = await User.findOneAndUpdate(
    buildGuestByIdFilter(req, req.params.id),
    updateData,
    { new: true, runValidators: true }
  )
    .populate('salutationId', 'title fullForm')
    .select('-password -passwordResetToken -passwordResetExpires');

  if (!guest) {
    throw new ApplicationError('Guest not found', 404);
  }

  res.json({
    status: 'success',
    data: { guest }
  });
});

// Delete guest
export const deleteGuest = catchAsync(async (req, res) => {
  const guest = await User.findOne(buildGuestByIdFilter(req, req.params.id)).lean();

  if (!guest) {
    throw new ApplicationError('Guest not found', 404);
  }

  const guestId = guest._id;

  await User.findOneAndDelete(buildGuestByIdFilter(req, req.params.id));

  // Cascade: anonymize/clean up related data
  const cleanupPromises = [
    Booking.updateMany({ userId: guestId }, { $set: { 'guestDetails.anonymized': true } }),
    Review.updateMany({ userId: guestId }, { $set: { guestName: 'Deleted User', isAnonymous: true } }),
    Notification.deleteMany({ userId: guestId }),
    DigitalKey.updateMany({ userId: guestId }, { status: 'revoked', revokedReason: 'Account deleted' }),
  ];
  await Promise.allSettled(cleanupPromises);

  res.status(204).json({
    status: 'success',
    data: null
  });
});

// Bulk operations
export const bulkUpdateGuests = catchAsync(async (req, res) => {
  const { guestIds, updateData } = req.body;

  if (!Array.isArray(guestIds) || guestIds.length === 0) {
    throw new ApplicationError('Guest IDs array is required', 400);
  }

  const result = await User.updateMany(
    { _id: { $in: guestIds }, role: 'guest', hotelId: req.user.hotelId || req.user.hotel },
    updateData
  );

  res.json({
    status: 'success',
    data: {
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount
    }
  });
});

// Get guest analytics
export const getGuestAnalytics = catchAsync(async (req, res) => {
  const { hotelId } = req.user;

  const query = { role: 'guest', hotelId };

  const analytics = await User.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        totalGuests: { $sum: 1 },
        byLoyaltyTier: {
          $push: '$loyalty.tier'
        },
        byGuestType: {
          $push: '$guestType'
        },
        byRegistrationMonth: {
          $push: {
            month: { $month: '$createdAt' },
            year: { $year: '$createdAt' }
          }
        }
      }
    }
  ]);

  if (analytics.length === 0) {
    return res.json({
      status: 'success',
      data: {
        totalGuests: 0,
        loyaltyTierDistribution: {},
        guestTypeDistribution: {},
        registrationTrends: {}
      }
    });
  }

  const result = analytics[0];

  // Calculate loyalty tier distribution
  const loyaltyTierDistribution = {};
  result.byLoyaltyTier.forEach(tier => {
    loyaltyTierDistribution[tier] = (loyaltyTierDistribution[tier] || 0) + 1;
  });

  // Calculate guest type distribution
  const guestTypeDistribution = {};
  result.byGuestType.forEach(type => {
    guestTypeDistribution[type] = (guestTypeDistribution[type] || 0) + 1;
  });

  // Calculate registration trends
  const registrationTrends = {};
  result.byRegistrationMonth.forEach(item => {
    const key = `${item.year}-${item.month}`;
    registrationTrends[key] = (registrationTrends[key] || 0) + 1;
  });

  res.json({
    status: 'success',
    data: {
      totalGuests: result.totalGuests,
      loyaltyTierDistribution,
      guestTypeDistribution,
      registrationTrends
    }
  });
});

// Search guests with advanced criteria
export const searchGuests = catchAsync(async (req, res) => {
  const { hotelId } = req.user;
  const {
    query: searchQuery,
    filters = {},
    page = 1,
    limit = 20
  } = req.body;

  const query = { role: 'guest', hotelId };

  // Text search
  if (searchQuery) {
    query.$or = [
      { name: { $regex: searchQuery, $options: 'i' } },
      { email: { $regex: searchQuery, $options: 'i' } },
      { phone: { $regex: searchQuery, $options: 'i' } }
    ];
  }

  // Apply filters
  if (filters.loyaltyTier) {
    query['loyalty.tier'] = filters.loyaltyTier;
  }
  if (filters.guestType) {
    query.guestType = filters.guestType;
  }
  if (filters.hasBookings !== undefined) {
    const guestsWithBookings = await Booking.distinct('userId', { hotelId });
    if (filters.hasBookings) {
      query._id = { $in: guestsWithBookings };
    } else {
      query._id = { $nin: guestsWithBookings };
    }
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const guests = await User.find(query)
    .populate('salutationId', 'title fullForm')
    .select('-password -passwordResetToken -passwordResetExpires')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit)).lean();

  const total = await User.countDocuments(query);

  res.json({
    status: 'success',
    results: guests.length,
    pagination: {
      current: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      total
    },
    data: { guests }
  });
});

// Export guests to CSV
export const exportGuests = catchAsync(async (req, res) => {
  const { hotelId } = req.user;
  const { format = 'csv' } = req.query;

  const query = { role: 'guest', hotelId };

  const guests = await User.find(query)
    .populate('salutationId', 'title fullForm')
    .select('-password -passwordResetToken -passwordResetExpires')
    .sort({ createdAt: -1 }).lean().limit(1000);

  if (format === 'csv') {
    const csvHeader = 'Name,Email,Phone,Salutation,Loyalty Tier,Guest Type,Created At\n';
    const csvData = guests.map(guest => {
      const salutation = guest.salutationId ? guest.salutationId.title : '';
      return [
        guest.name,
        guest.email,
        guest.phone || '',
        salutation,
        guest.loyalty.tier,
        guest.guestType,
        guest.createdAt.toISOString()
      ].join(',');
    }).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=guests.csv');
    res.send(csvHeader + csvData);
  } else {
    res.json({
      status: 'success',
      results: guests.length,
      data: { guests }
    });
  }
});

export default {
  getAllGuests,
  getGuest,
  createGuest,
  updateGuest,
  deleteGuest,
  bulkUpdateGuests,
  getGuestAnalytics,
  searchGuests,
  exportGuests
};

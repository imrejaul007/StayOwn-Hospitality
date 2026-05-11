import mongoose from 'mongoose';
import MeetUpRequest from '../models/MeetUpRequest.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import logger from '../utils/logger.js';
import meetUpSupervisionAlertService from '../services/meetUpSupervisionAlertService.js';
import websocketService from '../services/websocketService.js';

/**
 * Get meet-ups requiring staff supervision
 * Filters based on safety levels and supervision needs
 */
export const getSupervisionMeetUps = catchAsync(async (req, res, next) => {
  const { page: rawPage = 1, limit: rawLimit = 20, status, priority, safetyLevel } = req.query;
  const { hotelId } = req.user;

  if (!hotelId) {
    return res.status(400).json({ status: 'error', message: 'Hotel context required' });
  }

  const parsedPage = Math.max(1, parseInt(rawPage) || 1);
  const parsedLimit = Math.min(100, Math.max(1, parseInt(rawLimit) || 20));

  // Build query for meet-ups that require supervision.
  // By default show only upcoming active meet-ups. When a specific status filter
  // is supplied (e.g. completed / cancelled) drop the date and default-status
  // constraints so staff can review historical supervised meet-ups.
  const UPCOMING_STATUSES = ['pending', 'accepted'];
  const PAST_ALLOWED_STATUSES = ['completed', 'declined', 'cancelled'];
  const isPastStatusFilter = status && PAST_ALLOWED_STATUSES.includes(status);

  const query = {
    hotelId
  };

  if (isPastStatusFilter) {
    query.status = status;
  } else {
    query.status = status || { $in: UPCOMING_STATUSES };
    query.proposedDate = { $gt: new Date() };
  }

  // When computed filters (priority/safetyLevel) are applied we must annotate all docs
  // before slicing, because those fields are not stored in MongoDB. We fetch all matching
  // docs from the DB and then paginate in-memory. The set is bounded to active/upcoming
  // meet-ups for a single hotel so this is safe.
  if (priority || safetyLevel) {
    const allMeetUps = await MeetUpRequest.find(query)
      .populate('requesterId', 'name email avatar')
      .populate('targetUserId', 'name email avatar')
      .populate('hotelId', 'name address')
      .populate('assignedStaff', 'name email')
      .sort({ proposedDate: 1, createdAt: -1 })
      .lean();

    const annotated = allMeetUps.map(meetUp => ({
      ...meetUp,
      supervision: {
        priority: calculateSupervisionPriority(meetUp),
        safetyLevel: calculateSafetyLevel(meetUp),
        requiresStaffPresence: meetUp.safety?.hotelStaffPresent || false,
        riskFactors: identifyRiskFactors(meetUp)
      }
    }));

    const filtered = annotated.filter(meetUp => {
      if (priority && meetUp.supervision.priority.priority !== priority) return false;
      if (safetyLevel && meetUp.supervision.safetyLevel.level !== safetyLevel) return false;
      return true;
    });

    const totalCount = filtered.length;
    const totalPages = parsedLimit > 0 ? Math.ceil(totalCount / parsedLimit) : 0;
    const skip = (parsedPage - 1) * parsedLimit;
    const paginated = filtered.slice(skip, skip + parsedLimit);

    return res.status(200).json({
      success: true,
      message: 'Supervision meet-ups retrieved successfully',
      data: {
        meetUps: paginated,
        pagination: {
          currentPage: parsedPage,
          totalPages,
          totalItems: totalCount,
          hasNext: parsedPage < totalPages,
          hasPrev: parsedPage > 1
        }
      }
    });
  }

  const skip = (parsedPage - 1) * parsedLimit;

  // No computed filters — use normal DB pagination.
  const [meetUps, totalCount] = await Promise.all([
    MeetUpRequest.find(query)
      .populate('requesterId', 'name email avatar')
      .populate('targetUserId', 'name email avatar')
      .populate('hotelId', 'name address')
      .populate('assignedStaff', 'name email')
      .sort({ proposedDate: 1, createdAt: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean(),
    MeetUpRequest.countDocuments(query)
  ]);

  // Annotate every meet-up with its computed supervision metadata
  const filteredMeetUps = meetUps.map(meetUp => ({
    ...meetUp,
    supervision: {
      priority: calculateSupervisionPriority(meetUp),
      safetyLevel: calculateSafetyLevel(meetUp),
      requiresStaffPresence: meetUp.safety?.hotelStaffPresent || false,
      riskFactors: identifyRiskFactors(meetUp)
    }
  }));

  const totalPages = parsedLimit > 0 ? Math.ceil(totalCount / parsedLimit) : 0;

  res.status(200).json({
    success: true,
    message: 'Supervision meet-ups retrieved successfully',
    data: {
      meetUps: filteredMeetUps,
      pagination: {
        currentPage: parsedPage,
        totalPages,
        totalItems: totalCount,
        hasNext: parsedPage < totalPages,
        hasPrev: parsedPage > 1
      }
    }
  });
});

/**
 * Assign staff member to supervise a meet-up
 */
export const assignStaffToMeetUp = catchAsync(async (req, res, next) => {
  const { meetUpId } = req.params;
  const { staffId, supervisionNotes } = req.body;
  const { hotelId } = req.user;

  if (!mongoose.Types.ObjectId.isValid(meetUpId)) {
    return next(new ApplicationError('Invalid meetUpId', 400));
  }

  if (!staffId) {
    return next(new ApplicationError('staffId is required', 400));
  }

  if (!mongoose.Types.ObjectId.isValid(staffId)) {
    return next(new ApplicationError('Invalid staffId', 400));
  }

  // Ensure the assigned staff belongs to the same hotel (prevent cross-hotel assignment)
  const User = (await import('../models/User.js')).default;
  const staffUser = await User.findOne({ _id: staffId, hotelId }).select('_id').lean();
  if (!staffUser) {
    return next(new ApplicationError('Staff member not found in this property', 404));
  }

  // Prevent race condition: only assign when supervision is not already in_progress or completed.
  // findOneAndUpdate is atomic so only one concurrent caller can match the filter.
  const meetUpDoc = await MeetUpRequest.findOneAndUpdate(
    {
      _id: meetUpId,
      hotelId,
      supervisionStatus: { $nin: ['in_progress', 'completed'] }
    },
    {
      $set: {
        assignedStaff: staffId,
        supervisionStatus: 'assigned',
        supervisionNotes: supervisionNotes || ''
      }
    },
    { new: true, runValidators: true }
  )
    .populate('requesterId', 'name email')
    .populate('targetUserId', 'name email')
    .populate('hotelId', 'name')
    .populate('assignedStaff', 'name email')
    .lean();

  if (!meetUpDoc) {
    // Distinguish between "not found" and "already supervised" by checking existence
    const exists = await MeetUpRequest.exists({ _id: meetUpId, hotelId });
    if (!exists) {
      return next(new ApplicationError('Meet-up not found', 404));
    }
    return next(new ApplicationError(
      'Cannot reassign supervision: meet-up is already in progress or completed',
      409
    ));
  }

  // Annotate with computed supervision fields
  const meetUp = {
    ...meetUpDoc,
    supervision: {
      priority: calculateSupervisionPriority(meetUpDoc),
      safetyLevel: calculateSafetyLevel(meetUpDoc),
      requiresStaffPresence: meetUpDoc.safety?.hotelStaffPresent || false,
      riskFactors: identifyRiskFactors(meetUpDoc)
    }
  };

  // Update related alert
  try {
    await meetUpSupervisionAlertService.updateAlertOnSupervisionChange(
      meetUpId,
      'assigned',
      staffId
    );
  } catch (error) {
    logger.warn('Failed to update supervision alert', { meetUpId, error: error.message });
  }

  // Broadcast real-time update to all hotel staff on supervision page
  try {
    if (websocketService.isInitialized()) {
      websocketService.broadcastToHotel(hotelId.toString(), 'meetup:supervision-updated', {
        meetUpId,
        supervisionStatus: 'assigned',
        assignedStaffId: staffId
      });
    }
  } catch (error) {
    logger.warn('Failed to broadcast supervision assignment', { meetUpId, error: error.message });
  }

  res.status(200).json({
    success: true,
    message: 'Staff assigned to meet-up successfully',
    data: meetUp
  });
});

/**
 * Get staff member's supervision assignments
 */
export const getStaffAssignments = catchAsync(async (req, res, next) => {
  const { page: rawAssignPage = 1, limit: rawAssignLimit = 20, status } = req.query;
  const { _id: staffId, hotelId } = req.user;

  if (!hotelId) {
    return res.status(400).json({ status: 'error', message: 'Hotel context required' });
  }

  const parsedAssignPage = Math.max(1, parseInt(rawAssignPage) || 1);
  const parsedAssignLimitVal = Math.min(100, Math.max(1, parseInt(rawAssignLimit) || 20));

  const query = {
    hotelId,
    assignedStaff: staffId
  };

  if (status) query.supervisionStatus = status;

  const skip = (parsedAssignPage - 1) * parsedAssignLimitVal;

  const [assignments, totalCount] = await Promise.all([
    MeetUpRequest.find(query)
      .populate('requesterId', 'name email avatar')
      .populate('targetUserId', 'name email avatar')
      .populate('hotelId', 'name address')
      .populate('assignedStaff', 'name email')
      .sort({ proposedDate: 1, createdAt: -1 })
      .skip(skip)
      .limit(parsedAssignLimitVal)
      .lean(),
    MeetUpRequest.countDocuments(query)
  ]);

  const assignmentsWithSupervision = assignments.map(meetUp => ({
    ...meetUp,
    supervision: {
      priority: calculateSupervisionPriority(meetUp),
      safetyLevel: calculateSafetyLevel(meetUp),
      requiresStaffPresence: meetUp.safety?.hotelStaffPresent || false,
      riskFactors: identifyRiskFactors(meetUp)
    }
  }));

  const totalPages = parsedAssignLimitVal > 0 ? Math.ceil(totalCount / parsedAssignLimitVal) : 0;

  res.status(200).json({
    success: true,
    message: 'Staff assignments retrieved successfully',
    data: {
      assignments: assignmentsWithSupervision,
      pagination: {
        currentPage: parsedAssignPage,
        totalPages,
        totalItems: totalCount,
        hasNext: parsedAssignPage < totalPages,
        hasPrev: parsedAssignPage > 1
      }
    }
  });
});

const VALID_SUPERVISION_STATUSES = ['not_required', 'assigned', 'in_progress', 'completed'];

/**
 * Update supervision status
 */
export const updateSupervisionStatus = catchAsync(async (req, res, next) => {
  const { meetUpId } = req.params;
  const { supervisionStatus, supervisionNotes } = req.body;
  const { _id: staffId, hotelId } = req.user;

  if (!mongoose.Types.ObjectId.isValid(meetUpId)) {
    return next(new ApplicationError('Invalid meetUpId', 400));
  }

  if (!supervisionStatus) {
    return next(new ApplicationError('supervisionStatus is required', 400));
  }

  if (!VALID_SUPERVISION_STATUSES.includes(supervisionStatus)) {
    return next(new ApplicationError(
      `Invalid supervisionStatus. Must be one of: ${VALID_SUPERVISION_STATUSES.join(', ')}`,
      400
    ));
  }

  if (supervisionNotes && typeof supervisionNotes !== 'string') {
    return next(new ApplicationError('supervisionNotes must be a string', 400));
  }

  if (supervisionNotes && supervisionNotes.length > 500) {
    return next(new ApplicationError('supervisionNotes cannot exceed 500 characters', 400));
  }

  const updateFields = {
    supervisionStatus
  };
  if (supervisionNotes) updateFields.supervisionNotes = supervisionNotes;
  if (supervisionStatus === 'completed') {
    updateFields.supervisionCompletedAt = new Date();
  }

  // Admins and managers can update supervision on any hotel meet-up.
  // Regular staff can only update their own assigned meet-ups.
  const isPrivileged = ['admin', 'manager'].includes(req.user.role);
  const findFilter = isPrivileged
    ? { _id: meetUpId, hotelId }
    : { _id: meetUpId, hotelId, assignedStaff: staffId };

  const meetUpDoc = await MeetUpRequest.findOneAndUpdate(
    findFilter,
    { $set: updateFields },
    { new: true, runValidators: true }
  )
    .populate('requesterId', 'name email')
    .populate('targetUserId', 'name email')
    .populate('hotelId', 'name')
    .populate('assignedStaff', 'name email')
    .lean();

  if (!meetUpDoc) {
    return next(new ApplicationError('Meet-up assignment not found or not authorized', 404));
  }

  // Annotate with computed supervision fields
  const meetUp = {
    ...meetUpDoc,
    supervision: {
      priority: calculateSupervisionPriority(meetUpDoc),
      safetyLevel: calculateSafetyLevel(meetUpDoc),
      requiresStaffPresence: meetUpDoc.safety?.hotelStaffPresent || false,
      riskFactors: identifyRiskFactors(meetUpDoc)
    }
  };

  // Update related alert
  try {
    await meetUpSupervisionAlertService.updateAlertOnSupervisionChange(
      meetUpId,
      supervisionStatus,
      staffId
    );
  } catch (error) {
    logger.warn('Failed to update supervision alert', { meetUpId, error: error.message });
  }

  // Broadcast real-time update to all hotel staff on supervision page
  try {
    if (websocketService.isInitialized()) {
      websocketService.broadcastToHotel(hotelId.toString(), 'meetup:supervision-updated', {
        meetUpId,
        supervisionStatus
      });
    }
  } catch (error) {
    logger.warn('Failed to broadcast supervision status update', { meetUpId, error: error.message });
  }

  res.status(200).json({
    success: true,
    message: 'Supervision status updated successfully',
    data: meetUp
  });
});

/**
 * Get supervision statistics for staff dashboard
 */
export const getSupervisionStats = catchAsync(async (req, res, next) => {
  const { hotelId: rawHotelId } = req.user;
  const { period = '7d' } = req.query;

  if (!rawHotelId) {
    return res.status(400).json({ status: 'error', message: 'Hotel context required' });
  }

  const hotelId = mongoose.Types.ObjectId.isValid(rawHotelId)
    ? new mongoose.Types.ObjectId(rawHotelId)
    : rawHotelId;

  // Calculate date range based on period
  const now = new Date();
  const startDate = new Date();

  switch (period) {
    case '24h':
      startDate.setHours(startDate.getHours() - 24);
      break;
    case '7d':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(startDate.getDate() - 30);
      break;
    default:
      startDate.setDate(startDate.getDate() - 7);
  }

  const stats = await MeetUpRequest.aggregate([
    {
      $match: {
        hotelId,
        createdAt: { $gte: startDate, $lte: now }
      }
    },
    {
      $group: {
        _id: null,
        totalMeetUps: { $sum: 1 },
        // Count both 'assigned' and 'in_progress' as pending supervision work
        pendingSupervision: {
          $sum: {
            $cond: [
              { $in: ['$supervisionStatus', ['assigned', 'in_progress']] },
              1,
              0
            ]
          }
        },
        completedSupervision: {
          $sum: { $cond: [{ $eq: ['$supervisionStatus', 'completed'] }, 1, 0] }
        },
        highRiskMeetUps: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $eq: ['$safety.publicLocation', false] },
                  { $eq: ['$safety.hotelStaffPresent', true] },
                  { $gt: ['$participants.maxParticipants', 4] }
                ]
              },
              1,
              0
            ]
          }
        },
        staffRequiredMeetUps: {
          $sum: { $cond: [{ $eq: ['$safety.hotelStaffPresent', true] }, 1, 0] }
        }
      }
    },
    {
      // Strip the internal _id: null field before returning
      $project: {
        _id: 0,
        totalMeetUps: 1,
        pendingSupervision: 1,
        completedSupervision: 1,
        highRiskMeetUps: 1,
        staffRequiredMeetUps: 1
      }
    }
  ]);

  const baseStats = stats[0] || {
    totalMeetUps: 0,
    pendingSupervision: 0,
    completedSupervision: 0,
    highRiskMeetUps: 0,
    staffRequiredMeetUps: 0
  };

  // Get supervision status breakdown
  const statusBreakdown = await MeetUpRequest.aggregate([
    {
      $match: {
        hotelId,
        createdAt: { $gte: startDate, $lte: now },
        assignedStaff: { $exists: true, $ne: null }
      }
    },
    {
      $group: {
        _id: '$supervisionStatus',
        count: { $sum: 1 }
      }
    }
  ]);

  // Get upcoming supervised meet-ups
  const upcomingSupervised = await MeetUpRequest.countDocuments({
    hotelId,
    proposedDate: { $gt: now },
    assignedStaff: { $exists: true, $ne: null },
    supervisionStatus: { $in: ['assigned', 'in_progress'] }
  });

  res.status(200).json({
    success: true,
    message: 'Supervision statistics retrieved successfully',
    data: {
      summary: {
        ...baseStats,
        upcomingSupervised
      },
      statusBreakdown,
      period,
      generatedAt: new Date().toISOString()
    }
  });
});

/**
 * Get meet-ups requiring immediate attention
 */
export const getUrgentSupervisionTasks = catchAsync(async (req, res, next) => {
  const { hotelId } = req.user;

  if (!hotelId) {
    return res.status(400).json({ status: 'error', message: 'Hotel context required' });
  }

  const now = new Date();
  const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const urgentMeetUps = await MeetUpRequest.find({
    hotelId,
    proposedDate: { $gte: now, $lte: next24Hours },
    $or: [
      { 'safety.hotelStaffPresent': true },
      { 'safety.publicLocation': false },
      { 'participants.maxParticipants': { $gt: 4 } },
      { assignedStaff: { $exists: false } }
    ]
  })
    .populate('requesterId', 'name email')
    .populate('targetUserId', 'name email')
    .populate('assignedStaff', 'name email')
    .sort({ proposedDate: 1 }).limit(50).lean();

  const urgentWithPriority = urgentMeetUps.map(meetUp => ({
    ...meetUp,
    supervision: {
      priority: calculateSupervisionPriority(meetUp),
      safetyLevel: calculateSafetyLevel(meetUp),
      requiresStaffPresence: meetUp.safety?.hotelStaffPresent || false,
      riskFactors: identifyRiskFactors(meetUp)
    }
  }));

  res.status(200).json({
    success: true,
    message: 'Urgent supervision tasks retrieved successfully',
    data: {
      urgentTasks: urgentWithPriority,
      count: urgentWithPriority.length
    }
  });
});

/**
 * Process upcoming meet-ups and create supervision alerts
 */
export const processSupervisionAlerts = catchAsync(async (req, res, next) => {
  const { hotelId } = req.user;

  if (!hotelId) {
    return res.status(400).json({ status: 'error', message: 'Hotel context required' });
  }

  try {
    const alertsCreated = await meetUpSupervisionAlertService.processUpcomingMeetUps(hotelId);

    res.status(200).json({
      success: true,
      message: 'Supervision alerts processed successfully',
      data: {
        alertsCreated: alertsCreated.length,
        alerts: alertsCreated.map(alert => ({
          id: alert._id,
          type: alert.type,
          priority: alert.priority,
          title: alert.title,
          meetUpId: alert.source.id,
          createdAt: alert.createdAt
        }))
      }
    });
  } catch (error) {
    logger.error('Error processing supervision alerts', { hotelId, error: error.message });
    return next(new ApplicationError('Failed to process supervision alerts', 500));
  }
});

/**
 * Get supervision alert statistics
 */
export const getSupervisionAlertStats = catchAsync(async (req, res, next) => {
  const { hotelId } = req.user;

  if (!hotelId) {
    return res.status(400).json({ status: 'error', message: 'Hotel context required' });
  }

  try {
    const stats = await meetUpSupervisionAlertService.getSupervisionAlertStats(hotelId);

    res.status(200).json({
      success: true,
      message: 'Supervision alert statistics retrieved successfully',
      data: stats
    });
  } catch (error) {
    logger.error('Error getting supervision alert statistics', { hotelId, error: error.message });
    return next(new ApplicationError('Failed to get supervision alert statistics', 500));
  }
});

// Utility functions
function calculateSupervisionPriority(meetUp) {
  let priorityScore = 0;
  const factors = [];

  // Safety factors
  if (!meetUp.safety?.publicLocation) {
    priorityScore += 3;
    factors.push('Private location');
  }
  if (meetUp.safety?.hotelStaffPresent) {
    priorityScore += 2;
    factors.push('Staff presence required');
  }
  if (!meetUp.safety?.verifiedOnly) {
    priorityScore += 1;
    factors.push('Unverified users allowed');
  }

  // Time factors
  const meetUpHour = new Date(meetUp.proposedDate).getHours();
  if (meetUpHour < 6 || meetUpHour > 22) {
    priorityScore += 2;
    factors.push('Late/early hours');
  }

  // Group size
  if ((meetUp.participants?.maxParticipants ?? 0) > 4) {
    priorityScore += 1;
    factors.push('Large group');
  }

  // Location factors
  if (meetUp.location?.type === 'other' || meetUp.location?.type === 'outdoor') {
    priorityScore += 1;
    factors.push('Non-standard location');
  }

  // Determine priority level
  let priority, color, label;
  if (priorityScore >= 5) {
    priority = 'high';
    color = 'bg-red-100 text-red-800';
    label = 'High Priority';
  } else if (priorityScore >= 2) {
    priority = 'medium';
    color = 'bg-yellow-100 text-yellow-800';
    label = 'Medium Priority';
  } else {
    priority = 'low';
    color = 'bg-green-100 text-green-800';
    label = 'Low Priority';
  }

  return {
    priority,
    color,
    label,
    score: priorityScore,
    factors
  };
}

function calculateSafetyLevel(meetUp) {
  let safetyScore = 0;

  if (meetUp.safety?.publicLocation) safetyScore += 2;
  if (meetUp.safety?.hotelStaffPresent) safetyScore += 2;
  if (meetUp.safety?.verifiedOnly) safetyScore += 1;

  let level, color, label;
  if (safetyScore >= 4) {
    level = 'high';
    color = 'bg-green-100 text-green-800';
    label = 'High Safety';
  } else if (safetyScore >= 2) {
    level = 'medium';
    color = 'bg-yellow-100 text-yellow-800';
    label = 'Standard';
  } else {
    level = 'low';
    color = 'bg-red-100 text-red-800';
    label = 'Requires Attention';
  }

  return {
    level,
    color,
    label,
    score: safetyScore
  };
}

function identifyRiskFactors(meetUp) {
  const risks = [];

  if (!meetUp.safety?.publicLocation) risks.push('Private location');
  if (!meetUp.safety?.verifiedOnly) risks.push('Unverified users');

  const meetUpHour = new Date(meetUp.proposedDate).getHours();
  if (meetUpHour < 6 || meetUpHour > 22) risks.push('Outside normal hours');

  if ((meetUp.participants?.maxParticipants ?? 0) > 4) risks.push('Large group size');
  if (meetUp.location?.type === 'other') risks.push('Unspecified location');
  if (meetUp.location?.type === 'outdoor') risks.push('Outdoor location');

  return risks;
}

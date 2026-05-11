import ApprovalRequest from '../models/ApprovalRequest.js';
import Booking from '../models/Booking.js';
import Room from '../models/Room.js';
import RoomType from '../models/RoomType.js';
import { ApplicationError } from '../middleware/errorHandler.js';
import { catchAsync } from '../utils/catchAsync.js';
import { refToHotelIdString } from '../middleware/propertyAccess.js';
import mongoose from 'mongoose';

/**
 * Safely resolve the hotelId for the current request.
 * Prefers the tenant-scoped req.tenantId (set by ensureTenantContext middleware)
 * and falls back to req.user.hotelId — handling populated ObjectId refs safely.
 */
const resolveHotelId = (req) => {
  const hotelId = req.tenantId || refToHotelIdString(req.user.hotelId);
  if (!hotelId) {
    throw new ApplicationError('Hotel context is required', 400, 'HOTEL_REQUIRED');
  }
  return hotelId;
};

/**
 * @desc    Create a new approval request
 * @route   POST /api/v1/approvals
 * @access  Private (frontdesk, manager, admin)
 */
export const createApprovalRequest = catchAsync(async (req, res) => {
  const {
    requestType,
    targetResource,
    targetResourceId,
    requestData
  } = req.body;

  // Validate required fields
  if (!requestType || !targetResource || !targetResourceId || !requestData) {
    throw new ApplicationError(
      'Missing required fields: requestType, targetResource, targetResourceId, requestData',
      400,
      'VALIDATION_ERROR'
    );
  }

  // Validate requestData structure
  if (!requestData.original || !requestData.proposed) {
    throw new ApplicationError(
      'requestData must contain both original and proposed fields',
      400,
      'VALIDATION_ERROR'
    );
  }

  // Safely resolve hotelId (handles populated refs and tenantContext)
  const hotelId = resolveHotelId(req);

  // Verify target resource exists
  let targetExists = false;
  const hotelIdObj = new mongoose.Types.ObjectId(hotelId);
  switch (targetResource) {
    case 'booking':
      targetExists = await Booking.exists({ _id: targetResourceId, hotelId: hotelIdObj });
      break;
    case 'room':
      targetExists = await Room.exists({ _id: targetResourceId, hotelId: hotelIdObj });
      break;
    case 'room_type':
      targetExists = await RoomType.exists({ _id: targetResourceId, hotelId: hotelIdObj });
      break;
    default:
      throw new ApplicationError(
        'Invalid target resource type',
        400,
        'INVALID_RESOURCE'
      );
  }

  if (!targetExists) {
    throw new ApplicationError(
      `Target ${targetResource} not found or does not belong to your hotel`,
      404,
      'RESOURCE_NOT_FOUND'
    );
  }

  // Create approval request
  const approvalRequest = await ApprovalRequest.create({
    requestedBy: req.user._id,
    requestType,
    targetResource,
    targetResourceId,
    requestData,
    hotelId,
    status: 'pending'
  });

  // Populate requester details
  await approvalRequest.populate('requestedBy', 'name email role');

  res.status(201).json({
    status: 'success',
    message: 'Approval request created successfully',
    data: {
      approvalRequest
    }
  });
});

/**
 * @desc    Get all approval requests (filtered by role)
 * @route   GET /api/v1/approvals
 * @access  Private (frontdesk, manager, admin)
 */
export const getApprovalRequests = catchAsync(async (req, res) => {
  const {
    status,
    requestType,
    targetResource,
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  const hotelId = resolveHotelId(req);

  // Build query
  const query = { hotelId: new mongoose.Types.ObjectId(hotelId) };

  // Determine if this is the /my-requests endpoint or the general listing.
  // /my-requests should always scope to the current user's requests, regardless of role.
  const isMyRequestsRoute = req.path === '/my-requests';

  if (isMyRequestsRoute) {
    // Always scope to current user for /my-requests
    query.requestedBy = req.user._id;
  } else if (req.user.role === 'frontdesk') {
    // Frontdesk users can only see their own requests on the general listing too
    query.requestedBy = req.user._id;
  }

  // Apply filters
  if (status) {
    query.status = status;
  }

  if (requestType) {
    query.requestType = requestType;
  }

  if (targetResource) {
    query.targetResource = targetResource;
  }

  // Sanitize pagination params
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const skip = (pageNum - 1) * limitNum;
  const sortOptions = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  // Execute query with pagination
  const [approvalRequests, totalCount] = await Promise.all([
    ApprovalRequest.find(query)
      .populate('requestedBy', 'name email role')
      .populate('reviewedBy', 'name email role')
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    ApprovalRequest.countDocuments(query),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / limitNum));

  res.status(200).json({
    data: approvalRequests,
    page: pageNum,
    limit: limitNum,
    totalCount,
    totalPages,
  });
});

/**
 * @desc    Get single approval request by ID
 * @route   GET /api/v1/approvals/:id
 * @access  Private (frontdesk, manager, admin)
 */
export const getApprovalRequestById = catchAsync(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApplicationError(
      'Invalid approval request ID',
      400,
      'INVALID_ID'
    );
  }

  const approvalRequest = await ApprovalRequest.findById(id)
    .populate('requestedBy', 'name email role')
    .populate('reviewedBy', 'name email role').lean();

  if (!approvalRequest) {
    throw new ApplicationError(
      'Approval request not found',
      404,
      'NOT_FOUND'
    );
  }

  // Verify user has access to this request (use resolveHotelId for safe comparison)
  const userHotelId = resolveHotelId(req);
  if (
    approvalRequest.hotelId.toString() !== userHotelId ||
    (req.user.role === 'frontdesk' && approvalRequest.requestedBy._id.toString() !== req.user._id.toString())
  ) {
    throw new ApplicationError(
      'You do not have permission to view this approval request',
      403,
      'ACCESS_DENIED'
    );
  }

  res.status(200).json({
    status: 'success',
    data: {
      approvalRequest
    }
  });
});

/**
 * @desc    Approve an approval request and apply changes
 * @route   PUT /api/v1/approvals/:id/approve
 * @access  Private (manager, admin only)
 */
export const approveRequest = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { reviewNotes } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApplicationError(
      'Invalid approval request ID',
      400,
      'INVALID_ID'
    );
  }

  // Only managers and admins can approve
  if (req.user.role !== 'manager' && req.user.role !== 'admin') {
    throw new ApplicationError(
      'Only managers and admins can approve requests',
      403,
      'ACCESS_DENIED'
    );
  }

  // Do NOT use .lean() here — we need a Mongoose document for .canBeModified() and .save()
  const approvalRequest = await ApprovalRequest.findById(id);

  if (!approvalRequest) {
    throw new ApplicationError(
      'Approval request not found',
      404,
      'NOT_FOUND'
    );
  }

  // Verify hotel access (use resolveHotelId for safe comparison when hotelId is populated)
  const approverHotelId = resolveHotelId(req);
  if (approvalRequest.hotelId.toString() !== approverHotelId) {
    throw new ApplicationError(
      'You do not have permission to approve this request',
      403,
      'ACCESS_DENIED'
    );
  }

  // Validate status transition: only 'pending' -> 'approved' is allowed
  if (approvalRequest.status !== 'pending') {
    throw new ApplicationError(
      `Cannot approve request: invalid transition from '${approvalRequest.status}' to 'approved'`,
      400,
      'INVALID_STATUS_TRANSITION'
    );
  }

  // Apply the changes based on request type
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { targetResource, targetResourceId, requestData } = approvalRequest;

    switch (targetResource) {
      case 'booking':
        await Booking.findByIdAndUpdate(
          targetResourceId,
          requestData.proposed,
          { new: true, session, runValidators: true }
        );
        break;

      case 'room':
        await Room.findByIdAndUpdate(
          targetResourceId,
          requestData.proposed,
          { new: true, session, runValidators: true }
        );
        break;

      case 'room_type':
        if (approvalRequest.requestType === 'room_type_delete') {
          await RoomType.findByIdAndDelete(targetResourceId, { session });
        } else {
          await RoomType.findByIdAndUpdate(
            targetResourceId,
            requestData.proposed,
            { new: true, session, runValidators: true }
          );
        }
        break;

      default:
        throw new ApplicationError(
          'Invalid target resource type',
          400,
          'INVALID_RESOURCE'
        );
    }

    // Update approval request status
    approvalRequest.status = 'approved';
    approvalRequest.reviewedBy = req.user._id;
    approvalRequest.reviewedAt = new Date();
    if (reviewNotes) {
      approvalRequest.reviewNotes = reviewNotes;
    }
    await approvalRequest.save({ session });

    await session.commitTransaction();

    // Populate reviewer details
    await approvalRequest.populate([
      { path: 'requestedBy', select: 'name email role' },
      { path: 'reviewedBy', select: 'name email role' }
    ]);

    res.status(200).json({
      status: 'success',
      message: 'Approval request approved and changes applied successfully',
      data: {
        approvalRequest
      }
    });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

/**
 * @desc    Reject an approval request
 * @route   PUT /api/v1/approvals/:id/reject
 * @access  Private (manager, admin only)
 */
export const rejectRequest = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { reviewNotes } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApplicationError(
      'Invalid approval request ID',
      400,
      'INVALID_ID'
    );
  }

  // Only managers and admins can reject
  if (req.user.role !== 'manager' && req.user.role !== 'admin') {
    throw new ApplicationError(
      'Only managers and admins can reject requests',
      403,
      'ACCESS_DENIED'
    );
  }

  const approvalRequest = await ApprovalRequest.findById(id);

  if (!approvalRequest) {
    throw new ApplicationError(
      'Approval request not found',
      404,
      'NOT_FOUND'
    );
  }

  // Verify hotel access (use resolveHotelId for safe comparison when hotelId is populated)
  const rejecterHotelId = resolveHotelId(req);
  if (approvalRequest.hotelId.toString() !== rejecterHotelId) {
    throw new ApplicationError(
      'You do not have permission to reject this request',
      403,
      'ACCESS_DENIED'
    );
  }

  // Check if request is still pending
  if (!approvalRequest.canBeModified()) {
    throw new ApplicationError(
      `Cannot reject request with status: ${approvalRequest.status}`,
      400,
      'INVALID_STATUS'
    );
  }

  // Rejection notes are recommended
  if (!reviewNotes) {
    throw new ApplicationError(
      'Review notes are required when rejecting a request',
      400,
      'NOTES_REQUIRED'
    );
  }

  // Validate status transition: only 'pending' -> 'rejected' is allowed
  if (approvalRequest.status !== 'pending') {
    throw new ApplicationError(
      `Cannot reject request: invalid transition from '${approvalRequest.status}' to 'rejected'`,
      400,
      'INVALID_STATUS_TRANSITION'
    );
  }

  // Update approval request status
  approvalRequest.status = 'rejected';
  approvalRequest.reviewedBy = req.user._id;
  approvalRequest.reviewedAt = new Date();
  approvalRequest.reviewNotes = reviewNotes;
  await approvalRequest.save();

  // Populate user details
  await approvalRequest.populate([
    { path: 'requestedBy', select: 'name email role' },
    { path: 'reviewedBy', select: 'name email role' }
  ]);

  res.status(200).json({
    status: 'success',
    message: 'Approval request rejected successfully',
    data: {
      approvalRequest
    }
  });
});

/**
 * @desc    Cancel a pending approval request (requester only)
 * @route   DELETE /api/v1/approvals/:id
 * @access  Private (requester only)
 */
export const cancelRequest = catchAsync(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApplicationError(
      'Invalid approval request ID',
      400,
      'INVALID_ID'
    );
  }

  const approvalRequest = await ApprovalRequest.findById(id);

  if (!approvalRequest) {
    throw new ApplicationError(
      'Approval request not found',
      404,
      'NOT_FOUND'
    );
  }

  // Only the requester can cancel their own request
  if (approvalRequest.requestedBy.toString() !== req.user._id.toString()) {
    throw new ApplicationError(
      'You can only cancel your own approval requests',
      403,
      'ACCESS_DENIED'
    );
  }

  // Can only cancel pending requests
  if (!approvalRequest.canBeModified()) {
    throw new ApplicationError(
      `Cannot cancel request with status: ${approvalRequest.status}`,
      400,
      'INVALID_STATUS'
    );
  }

  // Delete the approval request
  await approvalRequest.deleteOne();

  res.status(200).json({
    status: 'success',
    message: 'Approval request cancelled successfully',
    data: null
  });
});

/**
 * @desc    Get pending approval count
 * @route   GET /api/v1/approvals/pending-count
 * @access  Private (frontdesk, manager, admin)
 */
export const getPendingCount = catchAsync(async (req, res) => {
  const hotelId = resolveHotelId(req);

  // Build query based on role
  const query = { hotelId: new mongoose.Types.ObjectId(hotelId), status: 'pending' };

  // Frontdesk users can only see their own requests
  if (req.user.role === 'frontdesk') {
    query.requestedBy = req.user._id;
  }

  const count = await ApprovalRequest.countDocuments(query);

  res.status(200).json({
    count
  });
});

/**
 * @desc    Get approval statistics for the hotel
 * @route   GET /api/v1/approvals/stats
 * @access  Private (manager, admin only)
 */
export const getApprovalStats = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;
  const hotelId = resolveHotelId(req);

  // Only managers and admins can view stats
  if (req.user.role !== 'manager' && req.user.role !== 'admin') {
    throw new ApplicationError(
      'Only managers and admins can view approval statistics',
      403,
      'ACCESS_DENIED'
    );
  }

  const hotelIdObj = new mongoose.Types.ObjectId(hotelId);
  const stats = await ApprovalRequest.getApprovalStats(hotelIdObj, startDate, endDate);
  const pendingCount = await ApprovalRequest.getPendingCount(hotelIdObj);

  res.status(200).json({
    status: 'success',
    data: {
      stats,
      pendingCount
    }
  });
});

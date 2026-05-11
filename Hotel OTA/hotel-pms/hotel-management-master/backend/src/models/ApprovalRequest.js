import mongoose from 'mongoose';

/**
 * @swagger
 * components:
 *   schemas:
 *     ApprovalRequest:
 *       type: object
 *       required:
 *         - requestedBy
 *         - requestType
 *         - targetResource
 *         - targetResourceId
 *         - requestData
 *         - hotelId
 *       properties:
 *         _id:
 *           type: string
 *           description: Approval request ID
 *         requestedBy:
 *           type: string
 *           description: User ID who requested the approval
 *         requestType:
 *           type: string
 *           enum: [price_change, rate_adjustment, room_type_add, room_type_delete]
 *           description: Type of approval request
 *         targetResource:
 *           type: string
 *           enum: [room_type, booking, room]
 *           description: Resource type being modified
 *         targetResourceId:
 *           type: string
 *           description: ID of the resource being modified
 *         requestData:
 *           type: object
 *           properties:
 *             original:
 *               type: object
 *               description: Original data before changes
 *             proposed:
 *               type: object
 *               description: Proposed changes
 *           description: Contains original and proposed data
 *         status:
 *           type: string
 *           enum: [pending, approved, rejected]
 *           default: pending
 *           description: Approval request status
 *         reviewedBy:
 *           type: string
 *           description: User ID who reviewed the request
 *         reviewedAt:
 *           type: string
 *           format: date-time
 *           description: When the request was reviewed
 *         reviewNotes:
 *           type: string
 *           description: Notes from the reviewer
 *         hotelId:
 *           type: string
 *           description: Hotel ID this request belongs to
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

const approvalRequestSchema = new mongoose.Schema({
  requestedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'Requester is required'],
    index: true
  },
  requestType: {
    type: String,
    enum: {
      values: ['price_change', 'rate_adjustment', 'room_type_add', 'room_type_delete'],
      message: 'Request type must be one of: price_change, rate_adjustment, room_type_add, room_type_delete'
    },
    required: [true, 'Request type is required']
  },
  targetResource: {
    type: String,
    enum: {
      values: ['room_type', 'booking', 'room'],
      message: 'Target resource must be one of: room_type, booking, room'
    },
    required: [true, 'Target resource is required']
  },
  targetResourceId: {
    type: mongoose.Schema.ObjectId,
    required: [true, 'Target resource ID is required'],
    index: true
  },
  requestData: {
    original: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    proposed: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    }
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'approved', 'rejected'],
      message: 'Status must be one of: pending, approved, rejected'
    },
    default: 'pending',
    index: true
  },
  reviewedBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    default: null
  },
  reviewedAt: {
    type: Date,
    default: null
  },
  reviewNotes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Review notes cannot be more than 1000 characters']
  },
  hotelId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Hotel',
    required: [true, 'Hotel ID is required'],
    index: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes for efficient querying
approvalRequestSchema.index({ hotelId: 1, status: 1 });
approvalRequestSchema.index({ hotelId: 1, requestedBy: 1 });
approvalRequestSchema.index({ hotelId: 1, createdAt: -1 });
approvalRequestSchema.index({ status: 1, createdAt: -1 });

// Virtual for requester details
approvalRequestSchema.virtual('requester', {
  ref: 'User',
  localField: 'requestedBy',
  foreignField: '_id',
  justOne: true
});

// Virtual for reviewer details
approvalRequestSchema.virtual('reviewer', {
  ref: 'User',
  localField: 'reviewedBy',
  foreignField: '_id',
  justOne: true
});

// Instance method to check if request can be modified
approvalRequestSchema.methods.canBeModified = function() {
  return this.status === 'pending';
};

// Instance method to check if request is expired (older than 30 days)
approvalRequestSchema.methods.isExpired = function() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return this.createdAt < thirtyDaysAgo && this.status === 'pending';
};

// Static method to get pending requests count for a hotel
approvalRequestSchema.statics.getPendingCount = async function(hotelId) {
  try {
    return await this.countDocuments({ hotelId, status: 'pending' });
  } catch (error) {
    throw new Error(`${error.message}`);
  }
};

// Static method to get approval statistics
approvalRequestSchema.statics.getApprovalStats = async function(hotelId, startDate, endDate) {
  try {
    const match = { hotelId };

    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(endDate);
    }

    const stats = await this.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    return {
      total: stats.reduce((sum, item) => sum + item.count, 0),
      pending: stats.find(s => s._id === 'pending')?.count || 0,
      approved: stats.find(s => s._id === 'approved')?.count || 0,
      rejected: stats.find(s => s._id === 'rejected')?.count || 0
    };
  } catch (error) {
    throw new Error(`${error.message}`);
  }
};

// Pre-save middleware to validate status transitions
approvalRequestSchema.pre('save', function(next) {
  // If status is being changed from pending
  if (this.isModified('status') && this.status !== 'pending') {
    // Ensure reviewedBy and reviewedAt are set
    if (!this.reviewedBy) {
      return next(new Error('Reviewer is required when changing status'));
    }
    if (!this.reviewedAt) {
      this.reviewedAt = new Date();
    }
  }
  next();
});

export default mongoose.model('ApprovalRequest', approvalRequestSchema);

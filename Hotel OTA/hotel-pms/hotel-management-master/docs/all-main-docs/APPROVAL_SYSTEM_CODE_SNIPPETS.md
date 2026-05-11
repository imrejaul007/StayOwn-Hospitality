# Approval System - Key Code Snippets

## Table of Contents
1. [User Model Changes](#user-model-changes)
2. [ApprovalRequest Model](#approvalrequest-model)
3. [Controller Functions](#controller-functions)
4. [Routes Configuration](#routes-configuration)
5. [Error Handling](#error-handling)
6. [Usage Examples](#usage-examples)

---

## User Model Changes

### Updated Role Enum
**File:** `backend/src/models/User.js`

```javascript
role: {
  type: String,
  enum: ['guest', 'staff', 'frontdesk', 'manager', 'admin', 'travel_agent'],
  default: 'guest'
}
```

### Updated hotelId Required Function
```javascript
hotelId: {
  type: mongoose.Schema.ObjectId,
  ref: 'Hotel',
  required: function() {
    return this.role === 'staff' ||
           this.role === 'frontdesk' ||
           this.role === 'manager' ||
           this.role === 'admin';
  }
}
```

---

## ApprovalRequest Model

### Complete Schema Definition
**File:** `backend/src/models/ApprovalRequest.js`

```javascript
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
```

### Compound Indexes
```javascript
approvalRequestSchema.index({ hotelId: 1, status: 1 });
approvalRequestSchema.index({ hotelId: 1, requestedBy: 1 });
approvalRequestSchema.index({ hotelId: 1, createdAt: -1 });
approvalRequestSchema.index({ status: 1, createdAt: -1 });
```

### Instance Methods
```javascript
// Check if request can be modified
approvalRequestSchema.methods.canBeModified = function() {
  return this.status === 'pending';
};

// Check if request is expired (older than 30 days)
approvalRequestSchema.methods.isExpired = function() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return this.createdAt < thirtyDaysAgo && this.status === 'pending';
};
```

### Static Methods
```javascript
// Get pending count
approvalRequestSchema.statics.getPendingCount = async function(hotelId) {
  return await this.countDocuments({ hotelId, status: 'pending' });
};

// Get approval statistics
approvalRequestSchema.statics.getApprovalStats = async function(hotelId, startDate, endDate) {
  const match = { hotelId };
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = new Date(startDate);
    if (endDate) match.createdAt.$lte = new Date(endDate);
  }

  const stats = await this.aggregate([
    { $match: match },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);

  return {
    total: stats.reduce((sum, item) => sum + item.count, 0),
    pending: stats.find(s => s._id === 'pending')?.count || 0,
    approved: stats.find(s => s._id === 'approved')?.count || 0,
    rejected: stats.find(s => s._id === 'rejected')?.count || 0
  };
};
```

### Pre-save Middleware
```javascript
approvalRequestSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status !== 'pending') {
    if (!this.reviewedBy) {
      return next(new Error('Reviewer is required when changing status'));
    }
    if (!this.reviewedAt) {
      this.reviewedAt = new Date();
    }
  }
  next();
});
```

---

## Controller Functions

### Create Approval Request
**File:** `backend/src/controllers/approvalController.js`

```javascript
export const createApprovalRequest = catchAsync(async (req, res) => {
  const { requestType, targetResource, targetResourceId, requestData } = req.body;

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

  const hotelId = req.user.hotelId;
  if (!hotelId) {
    throw new ApplicationError(
      'User must be associated with a hotel',
      400,
      'HOTEL_REQUIRED'
    );
  }

  // Verify target resource exists
  let targetExists = false;
  switch (targetResource) {
    case 'booking':
      targetExists = await Booking.exists({ _id: targetResourceId, hotelId });
      break;
    case 'room':
      targetExists = await Room.exists({ _id: targetResourceId, hotelId });
      break;
    case 'room_type':
      targetExists = await RoomType.exists({ _id: targetResourceId, hotelId });
      break;
    default:
      throw new ApplicationError('Invalid target resource type', 400, 'INVALID_RESOURCE');
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

  await approvalRequest.populate('requestedBy', 'name email role');

  res.status(201).json({
    status: 'success',
    message: 'Approval request created successfully',
    data: { approvalRequest }
  });
});
```

### Approve Request with Transaction
```javascript
export const approveRequest = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { reviewNotes } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApplicationError('Invalid approval request ID', 400, 'INVALID_ID');
  }

  // Only managers and admins can approve
  if (req.user.role !== 'manager' && req.user.role !== 'admin') {
    throw new ApplicationError(
      'Only managers and admins can approve requests',
      403,
      'ACCESS_DENIED'
    );
  }

  const approvalRequest = await ApprovalRequest.findById(id);

  if (!approvalRequest) {
    throw new ApplicationError('Approval request not found', 404, 'NOT_FOUND');
  }

  if (approvalRequest.hotelId.toString() !== req.user.hotelId.toString()) {
    throw new ApplicationError(
      'You do not have permission to approve this request',
      403,
      'ACCESS_DENIED'
    );
  }

  if (!approvalRequest.canBeModified()) {
    throw new ApplicationError(
      `Cannot approve request with status: ${approvalRequest.status}`,
      400,
      'INVALID_STATUS'
    );
  }

  // Start transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { targetResource, targetResourceId, requestData } = approvalRequest;

    // Apply changes based on resource type
    switch (targetResource) {
      case 'booking':
        await Booking.findByIdAndUpdate(
          targetResourceId,
          requestData.proposed,
          { session, runValidators: true }
        );
        break;
      case 'room':
        await Room.findByIdAndUpdate(
          targetResourceId,
          requestData.proposed,
          { session, runValidators: true }
        );
        break;
      case 'room_type':
        if (approvalRequest.requestType === 'room_type_delete') {
          await RoomType.findByIdAndDelete(targetResourceId, { session });
        } else {
          await RoomType.findByIdAndUpdate(
            targetResourceId,
            requestData.proposed,
            { session, runValidators: true }
          );
        }
        break;
      default:
        throw new ApplicationError('Invalid target resource type', 400, 'INVALID_RESOURCE');
    }

    // Update approval request
    approvalRequest.status = 'approved';
    approvalRequest.reviewedBy = req.user._id;
    approvalRequest.reviewedAt = new Date();
    if (reviewNotes) approvalRequest.reviewNotes = reviewNotes;
    await approvalRequest.save({ session });

    await session.commitTransaction();

    await approvalRequest.populate([
      { path: 'requestedBy', select: 'name email role' },
      { path: 'reviewedBy', select: 'name email role' }
    ]);

    res.status(200).json({
      status: 'success',
      message: 'Approval request approved and changes applied successfully',
      data: { approvalRequest }
    });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});
```

### Get Requests with Role-Based Filtering
```javascript
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

  const hotelId = req.user.hotelId;
  const query = { hotelId };

  // Frontdesk users can only see their own requests
  if (req.user.role === 'frontdesk') {
    query.requestedBy = req.user._id;
  }

  // Apply filters
  if (status) query.status = status;
  if (requestType) query.requestType = requestType;
  if (targetResource) query.targetResource = targetResource;

  // Pagination
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const sortOptions = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

  // Execute query
  const approvalRequests = await ApprovalRequest.find(query)
    .populate('requestedBy', 'name email role')
    .populate('reviewedBy', 'name email role')
    .sort(sortOptions)
    .skip(skip)
    .limit(parseInt(limit));

  const total = await ApprovalRequest.countDocuments(query);

  res.status(200).json({
    status: 'success',
    results: approvalRequests.length,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit))
    },
    data: { approvalRequests }
  });
});
```

---

## Routes Configuration

### Complete Routes File
**File:** `backend/src/routes/approvals.js`

```javascript
import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { ensurePropertyAccess } from '../middleware/propertyAccess.js';
import {
  createApprovalRequest,
  getApprovalRequests,
  getApprovalRequestById,
  approveRequest,
  rejectRequest,
  cancelRequest,
  getApprovalStats
} from '../controllers/approvalController.js';

const router = express.Router();

// Create approval request
router.post(
  '/',
  authenticate,
  ensurePropertyAccess,
  authorize('frontdesk', 'manager', 'admin'),
  createApprovalRequest
);

// List approval requests
router.get(
  '/',
  authenticate,
  ensurePropertyAccess,
  authorize('frontdesk', 'manager', 'admin'),
  getApprovalRequests
);

// Get statistics (managers/admins only)
router.get(
  '/stats',
  authenticate,
  ensurePropertyAccess,
  authorize('manager', 'admin'),
  getApprovalStats
);

// Get single request
router.get(
  '/:id',
  authenticate,
  ensurePropertyAccess,
  authorize('frontdesk', 'manager', 'admin'),
  getApprovalRequestById
);

// Approve request (managers/admins only)
router.put(
  '/:id/approve',
  authenticate,
  ensurePropertyAccess,
  authorize('manager', 'admin'),
  approveRequest
);

// Reject request (managers/admins only)
router.put(
  '/:id/reject',
  authenticate,
  ensurePropertyAccess,
  authorize('manager', 'admin'),
  rejectRequest
);

// Cancel request (requester only)
router.delete(
  '/:id',
  authenticate,
  ensurePropertyAccess,
  authorize('frontdesk', 'manager', 'admin'),
  cancelRequest
);

export default router;
```

### Server.js Registration
**File:** `backend/src/server.js`

```javascript
// Import approval routes
import approvalRoutes from './routes/approvals.js';

// Register routes
app.use('/api/v1/approvals', approvalRoutes);
```

---

## Error Handling

### Using catchAsync Wrapper
```javascript
import { catchAsync } from '../utils/catchAsync.js';
import { ApplicationError } from '../middleware/errorHandler.js';

export const someFunction = catchAsync(async (req, res) => {
  // All errors are automatically caught and passed to error handler
  if (invalidCondition) {
    throw new ApplicationError('Error message', 400, 'ERROR_CODE');
  }

  // Success response
  res.status(200).json({
    status: 'success',
    data: result
  });
});
```

### Custom Error Responses
```javascript
// Validation Error
throw new ApplicationError(
  'Missing required fields',
  400,
  'VALIDATION_ERROR'
);

// Authentication Error
throw new ApplicationError(
  'Invalid or expired token',
  401,
  'AUTHENTICATION_ERROR'
);

// Authorization Error
throw new ApplicationError(
  'You do not have permission',
  403,
  'ACCESS_DENIED'
);

// Not Found Error
throw new ApplicationError(
  'Resource not found',
  404,
  'NOT_FOUND'
);
```

---

## Usage Examples

### Example 1: Create Price Change Request (Frontdesk)

```javascript
// Frontend code
const createPriceChangeRequest = async (bookingId, newPrice, oldPrice) => {
  try {
    const response = await fetch('/api/v1/approvals', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requestType: 'price_change',
        targetResource: 'booking',
        targetResourceId: bookingId,
        requestData: {
          original: {
            totalPrice: oldPrice,
            pricePerNight: oldPrice / 2
          },
          proposed: {
            totalPrice: newPrice,
            pricePerNight: newPrice / 2,
            reason: 'Guest loyalty discount'
          }
        }
      })
    });

    const data = await response.json();

    if (data.status === 'success') {
      console.log('Approval request created:', data.data.approvalRequest._id);
      return data.data.approvalRequest;
    } else {
      throw new Error(data.message);
    }
  } catch (error) {
    console.error('Failed to create approval request:', error);
    throw error;
  }
};
```

### Example 2: List Pending Requests (Manager)

```javascript
const getPendingApprovals = async () => {
  try {
    const response = await fetch(
      '/api/v1/approvals?status=pending&page=1&limit=20',
      {
        headers: {
          'Authorization': `Bearer ${managerToken}`
        }
      }
    );

    const data = await response.json();

    if (data.status === 'success') {
      console.log(`Found ${data.results} pending approvals`);
      return data.data.approvalRequests;
    }
  } catch (error) {
    console.error('Failed to fetch approvals:', error);
  }
};
```

### Example 3: Approve Request (Manager)

```javascript
const approveRequest = async (requestId, notes) => {
  try {
    const response = await fetch(`/api/v1/approvals/${requestId}/approve`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${managerToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        reviewNotes: notes || 'Approved'
      })
    });

    const data = await response.json();

    if (data.status === 'success') {
      console.log('Request approved, changes applied');
      return data.data.approvalRequest;
    }
  } catch (error) {
    console.error('Failed to approve request:', error);
  }
};
```

### Example 4: React Component Example

```javascript
import React, { useState, useEffect } from 'react';

const ApprovalRequestList = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const response = await fetch('/api/v1/approvals?status=pending', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setRequests(data.data.approvalRequests);
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      await fetch(`/api/v1/approvals/${id}/approve`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reviewNotes: 'Approved via dashboard' })
      });
      fetchRequests(); // Refresh list
    } catch (error) {
      console.error('Failed to approve:', error);
    }
  };

  const handleReject = async (id, notes) => {
    try {
      await fetch(`/api/v1/approvals/${id}/reject`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reviewNotes: notes })
      });
      fetchRequests(); // Refresh list
    } catch (error) {
      console.error('Failed to reject:', error);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="approval-list">
      <h2>Pending Approval Requests</h2>
      {requests.map(request => (
        <div key={request._id} className="approval-card">
          <h3>{request.requestType.replace('_', ' ').toUpperCase()}</h3>
          <p>Requested by: {request.requestedBy.name}</p>
          <p>Target: {request.targetResource}</p>
          <div className="actions">
            <button onClick={() => handleApprove(request._id)}>
              Approve
            </button>
            <button onClick={() => {
              const notes = prompt('Rejection reason:');
              if (notes) handleReject(request._id, notes);
            }}>
              Reject
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ApprovalRequestList;
```

---

## Testing Code

### Unit Test Example (Jest)

```javascript
import { approveRequest } from '../controllers/approvalController';
import ApprovalRequest from '../models/ApprovalRequest';
import Booking from '../models/Booking';

describe('Approval Controller', () => {
  describe('approveRequest', () => {
    it('should approve request and update booking', async () => {
      // Mock data
      const mockRequest = {
        _id: 'request123',
        status: 'pending',
        targetResource: 'booking',
        targetResourceId: 'booking123',
        requestData: {
          original: { totalPrice: 5000 },
          proposed: { totalPrice: 4500 }
        },
        hotelId: 'hotel123',
        canBeModified: () => true
      };

      // Mock functions
      jest.spyOn(ApprovalRequest, 'findById').mockResolvedValue(mockRequest);
      jest.spyOn(Booking, 'findByIdAndUpdate').mockResolvedValue({});

      // Execute
      const req = {
        params: { id: 'request123' },
        body: { reviewNotes: 'Test approval' },
        user: { _id: 'manager123', role: 'manager', hotelId: 'hotel123' }
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };

      await approveRequest(req, res, jest.fn());

      // Assertions
      expect(res.status).toHaveBeenCalledWith(200);
      expect(Booking.findByIdAndUpdate).toHaveBeenCalledWith(
        'booking123',
        { totalPrice: 4500 },
        expect.any(Object)
      );
    });
  });
});
```

---

**Document Version:** 1.0.0
**Last Updated:** 2025-01-19
**Total Code Lines:** ~900

# No-Show Endpoint Implementation

## Overview
A production-ready endpoint has been created to mark bookings as no-show with optional penalty charges.

## Endpoint Details

### URL
```
POST /api/v1/bookings/:id/no-show
```

### Authentication & Authorization
- **Middleware Stack:**
  1. `authenticate` - Requires user to be logged in
  2. `authorize(['admin', 'staff'])` - Only admin and staff roles allowed
  3. `ensurePropertyAccess` - Verifies property access (multi-property support)
  4. `catchAsync` - Error handling wrapper

### Request

#### Parameters
- **Path Parameter:**
  - `id` (string, required) - Booking ID

#### Request Body
```json
{
  "reason": "Guest did not arrive and did not cancel reservation",
  "chargeAmount": 2500
}
```

**Fields:**
- `reason` (string, required) - Reason for marking as no-show
  - Max length: 500 characters
  - Cannot be empty or whitespace-only
- `chargeAmount` (number, optional) - No-show penalty charge
  - Default: 0
  - Min: 0
  - Max: booking.totalAmount

### Response

#### Success Response (200 OK)
```json
{
  "status": "success",
  "data": {
    "booking": {
      "_id": "507f1f77bcf86cd799439011",
      "bookingNumber": "BK20250118001",
      "status": "no_show",
      "userId": {
        "name": "John Doe",
        "email": "john@example.com",
        "phone": "+91-9876543210"
      },
      "noShowRecorded": "2025-01-18T10:30:00.000Z",
      "noShowReason": "Guest did not arrive and did not cancel reservation",
      "noShowMarkedBy": {
        "userId": "507f1f77bcf86cd799439012",
        "userName": "Admin User",
        "userRole": "admin"
      },
      "noShowChargeAmount": 2500,
      "noShowChargeApplied": true,
      "totalAmount": 5000,
      "paymentDetails": {
        "paymentMethods": [
          {
            "method": "cash",
            "amount": 2500,
            "reference": "NO-SHOW-BK20250118001-1737195000000",
            "notes": "No-show cancellation charge: Guest did not arrive and did not cancel reservation",
            "processedBy": "507f1f77bcf86cd799439012",
            "processedAt": "2025-01-18T10:30:00.000Z"
          }
        ]
      },
      "statusHistory": [
        {
          "status": "no_show",
          "timestamp": "2025-01-18T10:30:00.000Z",
          "changedBy": {
            "source": "manual",
            "userId": "507f1f77bcf86cd799439012",
            "userName": "Admin User",
            "userRole": "admin"
          },
          "reason": "Guest did not arrive and did not cancel reservation"
        }
      ]
    },
    "message": "Booking marked as no-show successfully with a charge of ₹2500",
    "noShowDetails": {
      "markedAt": "2025-01-18T10:30:00.000Z",
      "markedBy": {
        "userId": "507f1f77bcf86cd799439012",
        "userName": "Admin User",
        "userRole": "admin"
      },
      "reason": "Guest did not arrive and did not cancel reservation",
      "chargeAmount": 2500,
      "charged": true
    }
  }
}
```

#### Error Responses

**404 Not Found - Booking doesn't exist**
```json
{
  "status": "error",
  "message": "Booking not found"
}
```

**400 Bad Request - Missing reason**
```json
{
  "status": "error",
  "message": "Reason is required for marking a booking as no-show"
}
```

**400 Bad Request - Reason too long**
```json
{
  "status": "error",
  "message": "Reason cannot exceed 500 characters"
}
```

**400 Bad Request - Invalid status**
```json
{
  "status": "error",
  "message": "Cannot mark booking as no-show. Current status: checked_out. Only confirmed or pending bookings can be marked as no-show."
}
```

**400 Bad Request - Charge amount too high**
```json
{
  "status": "error",
  "message": "Charge amount (7500) cannot exceed total booking amount (5000)"
}
```

**400 Bad Request - Negative charge**
```json
{
  "status": "error",
  "message": "Charge amount cannot be negative"
}
```

**403 Forbidden - No property access**
```json
{
  "status": "error",
  "message": "Access denied to this property"
}
```

**403 Forbidden - Unauthorized role**
```json
{
  "status": "error",
  "message": "Access denied. Required roles: admin, staff"
}
```

## Implementation Details

### Location
- **File:** `/backend/src/routes/bookings.js`
- **Lines:** 2814-3003 (190 lines including Swagger documentation)
- **Position:** Added before the `export default router;` statement

### Validation Logic

1. **Reason Validation:**
   - Required field
   - Must be a non-empty string
   - Max 500 characters
   - Trimmed before storage

2. **Charge Amount Validation:**
   - Defaults to 0 if not provided
   - Must be non-negative
   - Cannot exceed booking's total amount

3. **Booking Status Validation:**
   - Only `confirmed` or `pending` bookings can be marked as no-show
   - Prevents marking bookings that are:
     - Already checked in
     - Already checked out
     - Already cancelled
     - Already marked as no-show

4. **Property Access:**
   - Automatically handled by `ensurePropertyAccess` middleware
   - Supports multi-property scenarios

### Data Updates

#### Booking Status
```javascript
booking.status = 'no_show';
```

#### No-Show Details
```javascript
booking.noShowRecorded = new Date();
booking.noShowReason = reason.trim();
booking.noShowMarkedBy = {
  userId: req.user._id,
  userName: req.user.name,
  userRole: req.user.role
};
booking.noShowChargeAmount = chargeAmount;
booking.noShowChargeApplied = chargeAmount > 0;
```

#### Payment Details (if charge > 0)
```javascript
booking.paymentDetails.paymentMethods.push({
  method: 'cash',
  amount: chargeAmount,
  reference: `NO-SHOW-${booking.bookingNumber}-${Date.now()}`,
  notes: `No-show cancellation charge: ${reason.substring(0, 100)}...`,
  processedBy: req.user._id,
  processedAt: new Date()
});
```

#### Status History
```javascript
booking.statusHistory.push({
  status: 'no_show',
  timestamp: new Date(),
  changedBy: {
    source: 'manual',
    userId: req.user._id,
    userName: req.user.name,
    userRole: req.user.role
  },
  reason: reason.substring(0, 200)
});
```

### Logging

The endpoint logs comprehensive information to the console:

```javascript
console.log('⚠️ NO-SHOW MARKED:', {
  bookingNumber: booking.bookingNumber,
  guestName: booking.userId?.name || 'Unknown',
  reason: reason.substring(0, 50) + (reason.length > 50 ? '...' : ''),
  chargeAmount: chargeAmount,
  markedBy: req.user.name,
  timestamp: new Date().toISOString()
});
```

**Example Log Output:**
```
⚠️ NO-SHOW MARKED: {
  bookingNumber: 'BK20250118001',
  guestName: 'John Doe',
  reason: 'Guest did not arrive and did not cancel reserv...',
  chargeAmount: 2500,
  markedBy: 'Admin User',
  timestamp: '2025-01-18T10:30:00.000Z'
}
```

## Testing Examples

### Example 1: Mark as no-show without charge
```bash
curl -X POST http://localhost:5000/api/v1/bookings/507f1f77bcf86cd799439011/no-show \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "reason": "Guest called to cancel but past cancellation deadline"
  }'
```

### Example 2: Mark as no-show with penalty charge
```bash
curl -X POST http://localhost:5000/api/v1/bookings/507f1f77bcf86cd799439011/no-show \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <staff_token>" \
  -d '{
    "reason": "Guest did not arrive and did not respond to confirmation calls",
    "chargeAmount": 2500
  }'
```

### Example 3: Try to mark an already checked-out booking (should fail)
```bash
curl -X POST http://localhost:5000/api/v1/bookings/507f1f77bcf86cd799439011/no-show \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "reason": "Guest did not arrive",
    "chargeAmount": 1000
  }'
```
**Expected Response:** 400 Bad Request - Cannot mark checked-out booking as no-show

## Security Features

1. **Authentication Required:** Only logged-in users can access
2. **Role-Based Access:** Only admin and staff roles permitted
3. **Property Access Control:** Multi-property access verification
4. **Input Validation:** All inputs validated before processing
5. **SQL Injection Prevention:** Mongoose ODM handles escaping
6. **Audit Trail:** Complete tracking via statusHistory and noShowMarkedBy

## Database Schema Support

The endpoint uses existing Booking model fields:

```javascript
// From Booking.js model
noShowRecorded: { type: Date },
noShowReason: { type: String, maxlength: 500 },
noShowMarkedBy: {
  userId: { type: mongoose.Schema.ObjectId, ref: 'User' },
  userName: String,
  userRole: { type: String, enum: ['admin', 'staff', 'manager'] }
},
noShowChargeAmount: { type: Number, default: 0, min: 0 },
noShowChargeApplied: { type: Boolean, default: false }
```

## Integration Points

### Frontend Integration
```typescript
// Example React/TypeScript usage
const markBookingAsNoShow = async (bookingId: string, reason: string, chargeAmount?: number) => {
  try {
    const response = await api.post(`/bookings/${bookingId}/no-show`, {
      reason,
      chargeAmount
    });

    if (response.data.status === 'success') {
      toast.success(response.data.data.message);
      return response.data.data.booking;
    }
  } catch (error) {
    if (error.response?.data?.message) {
      toast.error(error.response.data.message);
    }
    throw error;
  }
};
```

### WebSocket Notifications (Future Enhancement)
The endpoint could be extended to send real-time notifications:
```javascript
// After booking.save()
websocketService.emit('booking:no-show', {
  bookingId: booking._id,
  bookingNumber: booking.bookingNumber,
  hotelId: booking.hotelId,
  guestName: booking.userId?.name,
  chargeAmount: chargeAmount
});
```

## Performance Considerations

1. **Database Queries:** Single query to find booking with populate
2. **Indexes:** Utilizes existing indexes on `bookingNumber` and `status`
3. **Async/Await:** Non-blocking I/O operations
4. **Error Handling:** Fast-fail validation before database operations

## Future Enhancements

1. **Email Notifications:** Send no-show confirmation to guest
2. **SMS Alerts:** Notify property managers
3. **Analytics:** Track no-show rates by property/time period
4. **Automatic Charge Processing:** Integration with payment gateway
5. **Cancellation Policy Enforcement:** Auto-calculate penalty based on policy
6. **Blacklist Integration:** Optionally add repeat no-show guests to blacklist

## Compliance & Audit

- **GDPR Compliant:** Stores reason for status change
- **Audit Trail:** Complete history in `statusHistory`
- **Reversibility:** Status can be changed if marked in error (requires separate endpoint)
- **Data Retention:** No-show records retained for reporting and analysis

## Issues Encountered

**None.** The implementation was straightforward because:
- ✅ Booking model already had no-show fields defined
- ✅ Middleware stack was well-established
- ✅ Error handling utilities were in place
- ✅ Similar endpoints provided good patterns to follow

## Verification Checklist

- [x] Endpoint added before export statement
- [x] All middleware applied correctly
- [x] Input validation implemented
- [x] Business logic validates booking status
- [x] Charge amount validation implemented
- [x] No-show details populated correctly
- [x] Payment details updated when charge applied
- [x] Status history updated
- [x] Comprehensive logging added
- [x] Error handling for all edge cases
- [x] Swagger documentation included
- [x] Property access control enforced
- [x] Multi-property support maintained
- [x] No syntax errors
- [x] Follows existing code patterns

## Summary

The no-show endpoint has been successfully implemented at lines 2814-3003 in `/backend/src/routes/bookings.js`. It provides a complete, production-ready solution for marking bookings as no-show with optional penalty charges, full validation, comprehensive error handling, and detailed audit logging.

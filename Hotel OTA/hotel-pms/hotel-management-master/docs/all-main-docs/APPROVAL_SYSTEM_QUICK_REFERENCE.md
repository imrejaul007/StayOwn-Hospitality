# Approval System Quick Reference Guide

## Base URL
```
Development: http://localhost:4000/api/v1
Production: https://hotel-management-xcsx.onrender.com/api/v1
```

---

## Endpoints Summary

### 1. Create Approval Request
```
POST /approvals
Auth: Required (frontdesk, manager, admin)
```

**Request Body:**
```json
{
  "requestType": "price_change",
  "targetResource": "booking",
  "targetResourceId": "648f1234567890abcdef1234",
  "requestData": {
    "original": { "field": "old_value" },
    "proposed": { "field": "new_value" }
  }
}
```

**Response:** `201 Created`

---

### 2. List Approval Requests
```
GET /approvals?status=pending&page=1&limit=20
Auth: Required (frontdesk, manager, admin)
```

**Query Parameters:**
- `status` - pending | approved | rejected
- `requestType` - price_change | rate_adjustment | room_type_add | room_type_delete
- `targetResource` - room_type | booking | room
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)
- `sortBy` - Field to sort by (default: createdAt)
- `sortOrder` - asc | desc (default: desc)

**Response:** `200 OK` with pagination

---

### 3. Get Single Request
```
GET /approvals/:id
Auth: Required (frontdesk, manager, admin)
```

**Response:** `200 OK`

---

### 4. Get Statistics
```
GET /approvals/stats?startDate=2024-01-01&endDate=2024-12-31
Auth: Required (manager, admin only)
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "stats": {
      "total": 100,
      "pending": 15,
      "approved": 75,
      "rejected": 10
    },
    "pendingCount": 15
  }
}
```

---

### 5. Approve Request
```
PUT /approvals/:id/approve
Auth: Required (manager, admin only)
```

**Request Body:**
```json
{
  "reviewNotes": "Optional approval notes"
}
```

**Response:** `200 OK` (changes applied to target resource)

---

### 6. Reject Request
```
PUT /approvals/:id/reject
Auth: Required (manager, admin only)
```

**Request Body:**
```json
{
  "reviewNotes": "Required rejection reason"
}
```

**Response:** `200 OK`

---

### 7. Cancel Request
```
DELETE /approvals/:id
Auth: Required (requester only)
```

**Response:** `200 OK`

---

## Request Types

| Type | Description | Target Resource |
|------|-------------|----------------|
| `price_change` | Modify booking price | booking |
| `rate_adjustment` | Adjust room rates | room_type |
| `room_type_add` | Add new room type | room_type |
| `room_type_delete` | Delete room type | room_type |

---

## Role Permissions

| Role | Create | View Own | View All | Approve | Reject | Cancel |
|------|--------|----------|----------|---------|--------|--------|
| frontdesk | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ (own) |
| manager | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (own) |
| admin | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ (own) |

---

## Status Flow

```
pending → approved (changes applied)
        → rejected (no changes)
        → cancelled (deleted by requester)
```

**Rules:**
- Only `pending` requests can be approved/rejected/cancelled
- Approved requests cannot be reverted
- Rejected requests can be recreated with modifications

---

## Error Codes

| Status | Code | Message |
|--------|------|---------|
| 400 | VALIDATION_ERROR | Missing or invalid fields |
| 400 | INVALID_ID | Invalid MongoDB ObjectId |
| 400 | INVALID_STATUS | Cannot modify non-pending request |
| 400 | INVALID_RESOURCE | Invalid target resource type |
| 400 | NOTES_REQUIRED | Review notes required for rejection |
| 401 | AUTHENTICATION_ERROR | Invalid or missing token |
| 403 | ACCESS_DENIED | Insufficient permissions |
| 404 | NOT_FOUND | Request not found |
| 404 | RESOURCE_NOT_FOUND | Target resource not found |

---

## Common Use Cases

### Use Case 1: Frontdesk Price Discount
1. Guest requests discount
2. Frontdesk creates approval request (POST /approvals)
3. Manager reviews and approves (PUT /approvals/:id/approve)
4. Booking price automatically updated

### Use Case 2: Room Type Addition
1. Frontdesk wants to add new room type
2. Creates approval request with room type details
3. Admin reviews and approves
4. New room type automatically created

### Use Case 3: Bulk Pricing Review
1. Manager lists all pending price change requests (GET /approvals?requestType=price_change&status=pending)
2. Reviews each request
3. Approves valid ones, rejects others with notes
4. Frontdesk sees rejection reasons and resubmits if needed

---

## Testing with cURL

### Create Request
```bash
curl -X POST http://localhost:4000/api/v1/approvals \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "requestType": "price_change",
    "targetResource": "booking",
    "targetResourceId": "648f1234567890abcdef1234",
    "requestData": {
      "original": {"totalPrice": 5000},
      "proposed": {"totalPrice": 4500}
    }
  }'
```

### List Pending Requests
```bash
curl -X GET "http://localhost:4000/api/v1/approvals?status=pending" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Approve Request
```bash
curl -X PUT http://localhost:4000/api/v1/approvals/648f9876543210fedcba9876/approve \
  -H "Authorization: Bearer MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reviewNotes": "Approved"}'
```

---

## Database Indexes

Optimized for common queries:

```javascript
// Single indexes
{ requestedBy: 1 }
{ targetResourceId: 1 }
{ status: 1 }
{ hotelId: 1 }

// Compound indexes
{ hotelId: 1, status: 1 }
{ hotelId: 1, requestedBy: 1 }
{ hotelId: 1, createdAt: -1 }
{ status: 1, createdAt: -1 }
```

---

## Integration Tips

### Frontend Implementation
```javascript
// Create approval request
const createApprovalRequest = async (requestData) => {
  const response = await fetch('/api/v1/approvals', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestData)
  });
  return response.json();
};

// List pending approvals
const getPendingApprovals = async () => {
  const response = await fetch('/api/v1/approvals?status=pending', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
};

// Approve request
const approveRequest = async (id, notes) => {
  const response = await fetch(`/api/v1/approvals/${id}/approve`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ reviewNotes: notes })
  });
  return response.json();
};
```

---

## Monitoring & Analytics

### Key Metrics to Track
1. **Approval Rate:** `approved / total * 100`
2. **Average Response Time:** `avg(reviewedAt - createdAt)`
3. **Pending Backlog:** Count of pending requests > 24 hours old
4. **Rejection Reasons:** Most common rejection patterns
5. **By Request Type:** Distribution of request types
6. **By User:** Most active requesters and reviewers

### Query Examples
```javascript
// Get approval rate for last 30 days
const stats = await ApprovalRequest.getApprovalStats(
  hotelId,
  new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  new Date()
);
const approvalRate = (stats.approved / stats.total * 100).toFixed(2);

// Get stale pending requests (>24h)
const stalePending = await ApprovalRequest.find({
  hotelId,
  status: 'pending',
  createdAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
});
```

---

## Best Practices

### For Frontdesk Users
1. ✅ Provide clear reason in proposed changes
2. ✅ Include all relevant details in requestData
3. ✅ Check for pending similar requests before creating new ones
4. ✅ Cancel requests that are no longer needed
5. ❌ Don't create duplicate requests
6. ❌ Don't modify booking directly - always use approval flow

### For Managers/Admins
1. ✅ Review pending requests daily
2. ✅ Provide detailed rejection reasons
3. ✅ Approve valid requests promptly
4. ✅ Monitor approval statistics regularly
5. ❌ Don't approve without reviewing details
6. ❌ Don't reject without explanation

---

## Troubleshooting

### Issue: "HOTEL_REQUIRED" error
**Cause:** User not associated with hotel
**Solution:** Ensure user has `hotelId` field set

### Issue: "ACCESS_DENIED" when approving
**Cause:** User role is frontdesk
**Solution:** Only managers and admins can approve

### Issue: "RESOURCE_NOT_FOUND"
**Cause:** Target resource doesn't exist or belongs to different hotel
**Solution:** Verify targetResourceId and hotelId match

### Issue: "INVALID_STATUS" when approving
**Cause:** Request already approved/rejected
**Solution:** Check request status before attempting to modify

---

## Support

For issues or questions:
1. Check Swagger docs at `/docs`
2. Review implementation guide: `FRONTDESK_APPROVAL_SYSTEM_IMPLEMENTATION.md`
3. Check server logs for detailed error messages
4. Verify JWT token is valid and not expired

---

**Last Updated:** 2025-01-19
**Version:** 1.0.0
**Status:** Production Ready

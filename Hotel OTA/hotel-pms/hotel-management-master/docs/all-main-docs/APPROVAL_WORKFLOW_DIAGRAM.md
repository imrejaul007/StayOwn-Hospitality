# Approval System Workflow Diagram

## System Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│  Frontdesk  │         │   Manager    │         │    Admin    │
│    User     │         │              │         │             │
└──────┬──────┘         └──────┬───────┘         └──────┬──────┘
       │                       │                        │
       │                       │                        │
       ▼                       ▼                        ▼
┌────────────────────────────────────────────────────────────────┐
│                    API Layer (Express)                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Authentication Middleware (JWT)                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Authorization Middleware (Role Check)            │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Property Access Middleware (Hotel Check)         │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────────────────────────────┐
│                   Approval Controller                           │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  • createApprovalRequest                                  │  │
│  │  • getApprovalRequests                                   │  │
│  │  • getApprovalRequestById                                │  │
│  │  • approveRequest                                        │  │
│  │  • rejectRequest                                         │  │
│  │  • cancelRequest                                         │  │
│  │  • getApprovalStats                                      │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────────────────────────────┐
│                   Database Layer (MongoDB)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │  Approval    │  │   Booking    │  │     Room     │        │
│  │   Request    │  │              │  │              │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
│  ┌──────────────┐  ┌──────────────┐                          │
│  │   RoomType   │  │     User     │                          │
│  │              │  │              │                          │
│  └──────────────┘  └──────────────┘                          │
└────────────────────────────────────────────────────────────────┘
```

---

## Request Creation Flow

```
┌──────────────┐
│  Frontdesk   │
│  needs to    │
│ change price │
└──────┬───────┘
       │
       │ 1. POST /approvals
       │    {requestType, targetResource, requestData}
       ▼
┌─────────────────────────────────────────┐
│  Validation                              │
│  • Required fields present?             │
│  • requestData has original & proposed? │
│  • User has hotelId?                    │
└───────────┬─────────────────────────────┘
            │
            │ Valid
            ▼
┌─────────────────────────────────────────┐
│  Resource Verification                   │
│  • Does target resource exist?          │
│  • Does it belong to user's hotel?      │
└───────────┬─────────────────────────────┘
            │
            │ Exists
            ▼
┌─────────────────────────────────────────┐
│  Create Approval Request                 │
│  • status = 'pending'                   │
│  • requestedBy = user._id               │
│  • hotelId = user.hotelId               │
│  • Save to database                     │
└───────────┬─────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│  Response: 201 Created                   │
│  • Return approval request with ID      │
│  • Populate requester details           │
└─────────────────────────────────────────┘
```

---

## Approval Flow (Manager/Admin)

```
┌──────────────┐
│   Manager    │
│  reviews     │
│   request    │
└──────┬───────┘
       │
       │ 1. GET /approvals?status=pending
       ▼
┌─────────────────────────────────────────┐
│  Fetch Pending Requests                  │
│  • Filter by hotelId                    │
│  • Populate user details                │
│  • Apply pagination                     │
└───────────┬─────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│  Manager Decides                         │
│  ┌──────────┐     ┌──────────┐         │
│  │ APPROVE  │     │  REJECT  │         │
│  └────┬─────┘     └────┬─────┘         │
└───────┼──────────────── ┼──────────────┘
        │                 │
        │                 │
        ▼                 ▼
┌───────────────┐   ┌─────────────────┐
│   APPROVE     │   │     REJECT      │
│   BRANCH      │   │     BRANCH      │
└───────┬───────┘   └────┬────────────┘
        │                │
        ▼                ▼
```

### Approve Branch

```
┌─────────────────────────────────────────┐
│  PUT /approvals/:id/approve              │
│  {reviewNotes: "optional"}              │
└───────────┬─────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│  Validations                             │
│  • User is manager/admin?               │
│  • Request belongs to user's hotel?     │
│  • Request status is 'pending'?         │
└───────────┬─────────────────────────────┘
            │
            │ Valid
            ▼
┌─────────────────────────────────────────┐
│  Start Database Transaction              │
│  (Ensures atomic operation)             │
└───────────┬─────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│  Apply Changes to Target Resource        │
│  • If booking: Update booking fields    │
│  • If room: Update room fields          │
│  • If room_type: Update/create/delete   │
└───────────┬─────────────────────────────┘
            │
            │ Success
            ▼
┌─────────────────────────────────────────┐
│  Update Approval Request                 │
│  • status = 'approved'                  │
│  • reviewedBy = manager._id             │
│  • reviewedAt = now                     │
│  • Save reviewNotes                     │
└───────────┬─────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│  Commit Transaction                      │
└───────────┬─────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│  Response: 200 OK                        │
│  • Return updated approval request      │
│  • Changes are now live!                │
└─────────────────────────────────────────┘
```

### Reject Branch

```
┌─────────────────────────────────────────┐
│  PUT /approvals/:id/reject               │
│  {reviewNotes: "REQUIRED"}              │
└───────────┬─────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│  Validations                             │
│  • User is manager/admin?               │
│  • Request belongs to user's hotel?     │
│  • Request status is 'pending'?         │
│  • reviewNotes provided?                │
└───────────┬─────────────────────────────┘
            │
            │ Valid
            ▼
┌─────────────────────────────────────────┐
│  Update Approval Request                 │
│  • status = 'rejected'                  │
│  • reviewedBy = manager._id             │
│  • reviewedAt = now                     │
│  • Save reviewNotes (reason)            │
│  • NO CHANGES to target resource        │
└───────────┬─────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│  Response: 200 OK                        │
│  • Return updated approval request      │
│  • Frontdesk notified via notes         │
└─────────────────────────────────────────┘
```

---

## Cancellation Flow (Frontdesk)

```
┌──────────────┐
│  Frontdesk   │
│  cancels own │
│   request    │
└──────┬───────┘
       │
       │ DELETE /approvals/:id
       ▼
┌─────────────────────────────────────────┐
│  Validations                             │
│  • Request exists?                      │
│  • requestedBy = current user?          │
│  • status = 'pending'?                  │
└───────────┬─────────────────────────────┘
            │
            │ Valid
            ▼
┌─────────────────────────────────────────┐
│  Delete Approval Request                 │
│  • Remove from database                 │
│  • Cannot be undone                     │
└───────────┬─────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│  Response: 200 OK                        │
│  • Confirmation message                 │
└─────────────────────────────────────────┘
```

---

## Role-Based View Filtering

```
┌────────────────────────────────────────────────────────────┐
│                  GET /approvals                             │
└────────────────────────┬───────────────────────────────────┘
                         │
            ┌────────────┴────────────┐
            │                         │
            ▼                         ▼
┌───────────────────────┐   ┌────────────────────────┐
│   Frontdesk Role      │   │  Manager/Admin Role    │
└───────────┬───────────┘   └────────┬───────────────┘
            │                        │
            │ Filter:                │ Filter:
            │ requestedBy = user._id │ All requests
            │ hotelId = user.hotelId │ hotelId = user.hotelId
            │                        │
            ▼                        ▼
┌───────────────────────┐   ┌────────────────────────┐
│ Returns ONLY          │   │ Returns ALL            │
│ Own Requests          │   │ Hotel Requests         │
└───────────────────────┘   └────────────────────────┘
```

---

## Transaction Safety Flow

```
┌─────────────────────────────────────────┐
│  Approval Request Processing             │
└───────────┬─────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│  session = startSession()                │
│  session.startTransaction()             │
└───────────┬─────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│  try {                                   │
│    // Update target resource            │
│    await Booking.update({...}, {session})│
│    // Update approval request           │
│    await ApprovalRequest.save({session})│
│    // Commit if all succeed             │
│    await session.commitTransaction()    │
│  }                                      │
└───────────┬─────────────────────────────┘
            │
            ├─── Success ──────────┐
            │                      │
            └─── Error ─────┐      │
                            │      │
                            ▼      ▼
            ┌────────────────────────────┐
            │ catch (error) {            │
            │   // Rollback on error     │
            │   session.abortTransaction()│
            │   throw error              │
            │ } finally {                │
            │   session.endSession()     │
            │ }                          │
            └────────────────────────────┘
                            │
                            ▼
            ┌────────────────────────────┐
            │  Either:                   │
            │  • All changes committed   │
            │  • All changes rolled back │
            │  (NO partial updates!)     │
            └────────────────────────────┘
```

---

## Status State Machine

```
                    ┌──────────┐
                    │  PENDING │
                    └────┬─────┘
                         │
          ┌──────────────┼──────────────┐
          │              │              │
          │              │              │
          ▼              ▼              ▼
    ┌──────────┐  ┌──────────┐  ┌──────────┐
    │ APPROVED │  │ REJECTED │  │ CANCELLED│
    └──────────┘  └──────────┘  └──────────┘
    (changes     (no changes)  (deleted)
     applied)

Rules:
• Can only approve/reject/cancel PENDING requests
• APPROVED: Final state, cannot be changed
• REJECTED: Final state, can create new request
• CANCELLED: Request deleted, can create new request
```

---

## Error Handling Flow

```
┌─────────────────────────────────────────┐
│  API Request Received                    │
└───────────┬─────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│  catchAsync Wrapper                      │
│  • Wraps controller function            │
│  • Catches all async errors             │
└───────────┬─────────────────────────────┘
            │
            ├─── Success ─────┐
            │                 │
            └─── Error ───────┤
                              │
                              ▼
            ┌─────────────────────────────┐
            │  Error Handler Middleware   │
            │  • ApplicationError?        │
            │    → Send custom error      │
            │  • Other error?             │
            │    → Send 500 error         │
            └────────────┬────────────────┘
                         │
                         ▼
            ┌─────────────────────────────┐
            │  Error Response             │
            │  {                          │
            │    status: 'error',         │
            │    message: '...',          │
            │    code: '...',             │
            │    details: {...}           │
            │  }                          │
            └─────────────────────────────┘
```

---

## Performance Optimization

```
┌─────────────────────────────────────────┐
│  Query Optimization Strategy             │
└───────────┬─────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│  Database Indexes                        │
│  • Single: requestedBy, status, hotelId │
│  • Compound: (hotelId, status)          │
│  •          (hotelId, requestedBy)      │
│  •          (status, createdAt)         │
└───────────┬─────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│  Query Execution                         │
│  • Uses indexes for filtering           │
│  • Pagination limits result size        │
│  • Selective population (only needed)   │
└───────────┬─────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────┐
│  Fast Response                           │
│  • < 100ms typical query time           │
│  • Scalable to thousands of requests    │
└─────────────────────────────────────────┘
```

---

## Complete Request Lifecycle

```
DAY 1 - 10:00 AM
┌──────────────────────────────────────────────────────┐
│ Frontdesk: Guest requests discount                   │
│ Action: Create approval request                     │
│ Status: PENDING                                     │
└──────────────────────────────────────────────────────┘

DAY 1 - 11:30 AM
┌──────────────────────────────────────────────────────┐
│ Manager: Reviews pending requests                    │
│ Action: GET /approvals?status=pending               │
│ Sees: All pending requests for hotel                │
└──────────────────────────────────────────────────────┘

DAY 1 - 11:45 AM
┌──────────────────────────────────────────────────────┐
│ Manager: Decides to approve                          │
│ Action: PUT /approvals/:id/approve                  │
│ Status: APPROVED                                    │
│ Effect: Booking price automatically updated         │
└──────────────────────────────────────────────────────┘

DAY 1 - 02:00 PM
┌──────────────────────────────────────────────────────┐
│ Frontdesk: Checks approval status                   │
│ Action: GET /approvals/:id                          │
│ Sees: APPROVED with manager's notes                │
│ Result: Proceeds with discounted booking            │
└──────────────────────────────────────────────────────┘
```

---

## Security Layers

```
┌─────────────────────────────────────────────────────────┐
│ LAYER 1: Authentication                                  │
│ • JWT token validation                                  │
│ • Token expiry check                                    │
│ • User exists check                                     │
└───────────────────────┬─────────────────────────────────┘
                        │ ✓ Valid Token
                        ▼
┌─────────────────────────────────────────────────────────┐
│ LAYER 2: Authorization                                   │
│ • Role check (frontdesk/manager/admin)                 │
│ • Endpoint-specific role requirements                   │
└───────────────────────┬─────────────────────────────────┘
                        │ ✓ Authorized Role
                        ▼
┌─────────────────────────────────────────────────────────┐
│ LAYER 3: Property Access                                 │
│ • User has hotelId                                      │
│ • Multi-property access check                           │
└───────────────────────┬─────────────────────────────────┘
                        │ ✓ Hotel Access
                        ▼
┌─────────────────────────────────────────────────────────┐
│ LAYER 4: Resource Ownership                              │
│ • Request belongs to user's hotel                       │
│ • Frontdesk can only see own requests                  │
└───────────────────────┬─────────────────────────────────┘
                        │ ✓ Access Granted
                        ▼
┌─────────────────────────────────────────────────────────┐
│ LAYER 5: Business Logic                                  │
│ • Status validation (can only modify pending)          │
│ • Requester can only cancel own requests               │
└─────────────────────────────────────────────────────────┘
```

---

**Legend:**
- `│` - Process flow
- `┌─┐` - Process box
- `▼` - Direction of flow
- `✓` - Validation passed
- `→` - Alternative path

---

**Document Version:** 1.0.0
**Last Updated:** 2025-01-19
**Diagram Type:** ASCII Art (Terminal-Safe)

# StayOwn-Hospitality Production Audit

**Audit Date:** May 26, 2026
**Scope:** Mock data, Empty catch blocks, In-memory stores, Silent success patterns
**Status:** CRITICAL ISSUES FOUND

---

## Executive Summary

| Category | Count | Risk Level |
|----------|-------|------------|
| Mock Data | 28 instances | HIGH |
| Empty Catch Blocks | 55 instances | CRITICAL |
| In-Memory Stores | 4 instances | CRITICAL |
| Silent Success | 70+ instances | MEDIUM |

**Critical Findings:**
- 55 silent `.catch(() => {})` patterns swallowing errors silently
- In-memory `syncLogs` array with no persistence (data loss on restart)
- Mock data hardcoded in production API routes
- Development-only code paths returning fake data in production

---

## 1. Mock Data Issues

### 1.1 Staff Dashboard Routes (staff-dashboard.routes.ts)

**Location:** `Hotel-OTA/apps/api/src/routes/staff/staff-dashboard.routes.ts`

| Line | Issue | Severity |
|------|-------|----------|
| 56-70 | `vacantRooms`, `cleaningRooms`, `maintenanceRooms` hardcoded as 15, 3, 2 | HIGH |
| 354-366 | Full mock room data array with guest names and check-in dates | HIGH |
| 419-451 | Mock conversations with fake guest data | HIGH |
| 468-497 | Mock messages with hardcoded timestamps | HIGH |
| 580-628 | Mock checkout data | MEDIUM |
| 717 | Mock notifications | MEDIUM |
| 919 | Mock location data | MEDIUM |
| 1075 | Mock performance data | MEDIUM |
| 1112 | Mock report data | MEDIUM |
| 1153-1175 | Mock user and staff data | MEDIUM |

**Code Example (Lines 65-70):**
```typescript
// Vacant rooms (mock)
15,
// Cleaning rooms (mock)
3,
// Maintenance rooms (mock)
2,
```

**Impact:** Dashboard shows fake room statistics instead of real-time data.

---

### 1.2 Channel Manager Service (channel-manager.service.ts)

**Location:** `Hotel-OTA/apps/api/src/services/channel-manager.service.ts`

| Line | Issue | Severity |
|------|-------|----------|
| 749-750 | Mock inventory push for MVP | HIGH |
| 809-836 | `getMockInventory()` generates 30 days of fake inventory | CRITICAL |

**Code Example (Lines 809-836):**
```typescript
private getMockInventory(): InventoryUpdate[] {
  const today = new Date();
  const updates: InventoryUpdate[] = [];

  // Generate 30 days of mock inventory
  for (let i = 0; i < 30; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);

    updates.push({
      roomTypeId: 'standard-room',
      date: date.toISOString().split('T')[0],
      available: 5,
      rate: 100 + (i % 7) * 10, // Weekend pricing
      currency: 'USD',
    });
    // ... more hardcoded data
  }
  return updates;
}
```

**Impact:** Channel distribution uses fake inventory data - guests may book rooms that don't exist.

---

### 1.3 Payment Service (rabtul-payment.service.ts)

**Location:** `Hotel-OTA/apps/api/src/services/payments/rabtul-payment.service.ts`

| Line | Issue | Severity |
|------|-------|----------|
| 98-107 | Dev-only mock order creation | HIGH |
| 165-173 | Dev-only mock refund creation | HIGH |

**Code Example (Lines 97-107):**
```typescript
static async createOrder(params: CreateOrderParams): Promise<OrderResult> {
  // In development without API keys, return mock order
  if (env.NODE_ENV === 'development' && !env.RAZORPAY_KEY_ID) {
    return {
      orderId: `order_dev_${Date.now()}`,
      razorpayOrderId: `order_dev_${Date.now()}`,
      amount: params.amount,
      currency: params.currency || 'INR',
      status: 'created',
    };
  }
  // ... real implementation
}
```

**Impact:** If `NODE_ENV` is misconfigured, fake orders are created with no actual payment processing.

---

### 1.4 AI Chat Stub

**Location:** `Hotel-OTA/apps/api/src/lib/chatAiStub.ts`

| Line | Issue | Severity |
|------|-------|----------|
| 136-200 | Full `StubAIChatService` class with hardcoded responses | MEDIUM |
| 301-340 | Stub analytics classes returning empty results | MEDIUM |

**Code Example (Lines 159-165):**
```typescript
async processMessage(request: {...}): Promise<AIChatResponse> {
  // Stub implementation - return a helpful default response
  return {
    message: this.getDefaultResponse(request.message),
    confidence: 0.5,
    suggestions: ['Contact front desk', 'Room service menu', 'Concierge help'],
  };
}
```

**Impact:** AI features silently degrade to stub responses without any indication to users.

---

### 1.5 Room Auto-Assignment

**Location:** `Hotel-OTA/apps/api/src/services/room/autoAssignment.ts`

| Line | Issue | Severity |
|------|-------|----------|
| 142-192 | Mock staff data with 5 fake staff members | HIGH |
| 448 | Comment indicating mock data usage | HIGH |

**Code Example (Lines 143-192):**
```typescript
// Mock data for demonstration
const mockStaff: StaffMember[] = [
  { id: 'staff-1', name: 'John Doe', role: 'housekeeper', skills: ['cleaning', 'laundry'], zone: 'Floor 1', efficiency: 0.85 },
  { id: 'staff-2', name: 'Jane Smith', role: 'housekeeper', skills: ['cleaning'], zone: 'Floor 2', efficiency: 0.92 },
  // ... more fake staff
];
```

---

## 2. Empty Catch Blocks (Silent Error Swallowing)

**Total: 55 instances**

### 2.1 Critical Silent Failures

**Location:** `Hotel-OTA/apps/api/src/routes/room-service.routes.ts`

| Line | Code | Impact |
|------|------|--------|
| 151 | `).catch(() => {});` | Failed notifications silently ignored |
| 162 | `}).catch(() => {});` | Failed queue adds silently ignored |
| 323 | `}).catch(() => {});` | Failed socket emits silently ignored |
| 753 | `}).catch(() => {});` | Failed updates silently ignored |
| 1409 | `}).catch(() => {});` | Failed room updates silently ignored |
| 1416 | `).catch(() => {});` | Failed room updates silently ignored |

**Code Example (Line 151):**
```typescript
await sendPushNotification({
  userId: guest.id,
  title: 'Request Update',
  body: `Your ${serviceType} request has been ${newStatus}`,
}).catch(() => {}); // Silent failure - user doesn't know
```

**Impact:** Users never know if their push notifications failed. Critical updates are lost.

---

### 2.2 Booking Service Silent Failures

**Location:** `Hotel-OTA/apps/api/src/services/booking/booking.service.ts`

| Line | Code | Impact |
|------|------|--------|
| 707 | `}).catch(() => {});` | Failed notification after booking creation |

---

### 2.3 Socket Handlers Silent Failures

**Location:** `Hotel-OTA/apps/api/src/socket/hotelSocket.ts`

| Line | Code | Impact |
|------|------|--------|
| 652 | `}).catch(() => {});` | Failed acknowledgment silently ignored |

---

### 2.4 Job Workers Silent Failures

**Location:** `Hotel-OTA/apps/api/src/jobs/workers.ts`

| Line | Code | Impact |
|------|------|--------|
| 612 | `}).catch(() => {});` | DB update failures silently ignored |

**Code Example (Line 612):**
```typescript
await prisma.booking.update({...}).catch(() => {}); // Don't fail the job if DB update fails
```

**Impact:** Data inconsistency - jobs complete successfully even when database updates fail.

---

### 2.5 Frontend Silent Failures

**Location:** `Hotel-OTA/apps/mobile/src/screens/HomeScreen.tsx`

| Line | Code | Impact |
|------|------|--------|
| 44 | `.catch(() => {});` | Failed API call silently ignored |
| 49 | `.catch(() => {});` | Failed API call silently ignored |
| 54 | `.catch(() => {})` | Failed API call silently ignored |

**Location:** `Hotel-OTA/apps/ota-web/src/app/hotel/[id]/page.tsx`

| Line | Code | Impact |
|------|------|--------|
| 59 | `}).catch(() => {});` | Failed reviews fetch silently ignored |
| 85 | `}).catch(() => {}).finally(...)` | Failed hotel data fetch silently ignored |

---

## 3. In-Memory Stores

### 3.1 Channel Manager Sync Logs (CRITICAL)

**Location:** `Hotel-OTA/apps/api/src/services/channel-manager.service.ts`

```typescript
private syncLogs: SyncLog[] = [];
```

**Problem:**
- Array accumulates sync logs in memory
- No persistence to database
- Lost on server restart
- Grows unbounded (capped at 1000 entries only in `clearSyncLogs`)

**Code (Lines 866-883):**
```typescript
private createSyncLog(...) {
  this.syncLogs.push({
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    // ... log data
    createdAt: new Date(),
  });

  // Keep only last 1000 logs
  if (this.syncLogs.length > 1000) {
    this.syncLogs = this.syncLogs.slice(-1000);
  }
}
```

**Impact:**
- Audit trail is ephemeral
- Cannot investigate historical sync issues
- Compliance/regulatory concern for financial transactions

---

### 3.2 Queue Cache (HIGH)

**Location:** `Hotel-OTA/apps/api/src/jobs/queues.ts`

```typescript
const queueCache: Map<string, Queue> = new Map();
```

**Problem:**
- Bull queues cached in memory
- Queue connections not persisted
- Reconnection logic may be inconsistent

---

### 3.3 Channel Adapters Map (MEDIUM)

**Location:** `Hotel-OTA/apps/api/src/services/channel-manager.service.ts`

```typescript
private adapters: Map<string, ChannelAdapter> = new Map();
private channelConfigs: Map<string, ChannelConfig> = new Map();
```

**Problem:**
- Channel adapter instances cached in memory
- Lost on restart requiring re-initialization

---

### 3.4 Event Bus Handlers (MEDIUM)

**Location:** `Hotel-OTA/apps/api/src/services/shared/event-bus.service.ts`

```typescript
private handlers: Map<string, EventHandler[]> = new Map();
```

**Problem:**
- Event handlers registered in memory
- Lost on restart

---

### 3.5 Socket Chat Services (MEDIUM)

**Location:** `Hotel-OTA/apps/api/src/socket/hotelSocket.ts` and `aiChatSocket.ts`

```typescript
private chatServices: Map<string, AIChatService> = new Map();
private namespaces: Map<string, ReturnType<SocketIOServer['of']>> = new Map();
```

**Problem:**
- Socket.io namespace and service mappings lost on restart

---

## 4. Silent Success Patterns

### 4.1 Non-Blocking Fire-and-Forget

**Location:** `Hotel-OTA/apps/api/src/routes/hotel.routes.ts`

| Line | Pattern | Risk |
|------|---------|------|
| 147 | `}).catch(() => {}); // Non-blocking` | Notification failed silently |
| 163 | `}).catch(() => {}); // Non-blocking` | Notification failed silently |

**Code Example (Line 147):**
```typescript
await sendNotification({...}).catch(() => {}); // Non-blocking
```

---

### 4.2 Webhook Success Without Processing

**Location:** `Hotel-OTA/apps/api/src/services/integrations/ota-pms-webhook-handler.ts`

Multiple instances where `{ success: true }` is returned without actual processing:

| Line | Context |
|------|---------|
| 165 | Not an error - may be walk-in booking |
| 233 | Empty success without validation |
| 335 | Empty success without processing |
| 403 | Empty success without action |
| 434 | Empty success without action |

---

### 4.3 Silent Auth Token Handling

**Location:** `Hotel-OTA/apps/api/src/middleware/auth.ts`

```typescript
}).catch(() => {});
```

**Line 238:** Token refresh failures silently ignored.

---

## 5. Recommendations

### 5.1 Immediate Actions (Critical)

| Priority | Action | Files |
|----------|--------|-------|
| P0 | Replace all `.catch(() => {})` with proper error handling + logging | 55 files |
| P0 | Persist `syncLogs` to database instead of memory | `channel-manager.service.ts` |
| P0 | Remove mock data from production routes | `staff-dashboard.routes.ts` |
| P0 | Add `NODE_ENV` validation to prevent mock data in production | `rabtul-payment.service.ts` |

### 5.2 Short-Term Fixes (High)

| Priority | Action | Files |
|----------|--------|-------|
| P1 | Add Zod validation to webhook handlers | `ota-pms-webhook-handler.ts` |
| P1 | Implement circuit breaker for external service calls | All service files |
| P1 | Add metrics/alerting for silent failures | All catch blocks |

### 5.3 Code Changes Required

**Fix Empty Catch Block Pattern:**
```typescript
// BEFORE (BAD)
await someOperation().catch(() => {});

// AFTER (GOOD)
try {
  await someOperation();
} catch (error) {
  logger.error('Operation failed', { error, context: 'someOperation' });
  // Optionally: metrics.increment('operation.failures')
}
```

**Fix In-Memory Store:**
```typescript
// BEFORE (BAD)
private syncLogs: SyncLog[] = [];

// AFTER (GOOD)
private async createSyncLog(...) {
  await prisma.syncLog.create({ data: { ... } });
}
```

**Fix Mock Data:**
```typescript
// BEFORE (BAD)
const vacantRooms = 15; // mock

// AFTER (GOOD)
const vacantRooms = await prisma.room.count({
  where: { hotelId, status: 'vacant' }
});
```

---

## 6. Risk Assessment

| Risk | Likelihood | Impact | Score |
|------|------------|--------|-------|
| Data loss from in-memory stores | HIGH | CRITICAL | 9 |
| Silent payment failures | MEDIUM | CRITICAL | 8 |
| Incorrect room availability | HIGH | HIGH | 7 |
| Missing notifications | MEDIUM | MEDIUM | 5 |
| Audit trail gaps | HIGH | MEDIUM | 6 |

---

## 7. Files Requiring Changes

| File | Issues |
|------|--------|
| `Hotel-OTA/apps/api/src/routes/staff/staff-dashboard.routes.ts` | Mock data (10+ instances) |
| `Hotel-OTA/apps/api/src/services/channel-manager.service.ts` | Mock data, in-memory store |
| `Hotel-OTA/apps/api/src/services/payments/rabtul-payment.service.ts` | Dev-only mock orders |
| `Hotel-OTA/apps/api/src/lib/chatAiStub.ts` | Stub implementation |
| `Hotel-OTA/apps/api/src/routes/room-service.routes.ts` | 6 silent catch blocks |
| `Hotel-OTA/apps/api/src/services/booking/booking.service.ts` | Silent catch block |
| `Hotel-OTA/apps/api/src/socket/hotelSocket.ts` | Silent catch block |
| `Hotel-OTA/apps/api/src/jobs/workers.ts` | Silent catch block |
| `Hotel-OTA/apps/api/src/services/integrations/ota-pms-webhook-handler.ts` | Silent success returns |
| `Hotel-OTA/apps/api/src/jobs/queues.ts` | In-memory queue cache |
| `Hotel-OTA/apps/api/src/services/shared/event-bus.service.ts` | In-memory handlers |
| `Hotel-OTA/apps/mobile/src/screens/HomeScreen.tsx` | 3 silent catch blocks |
| `Hotel-OTA/apps/ota-web/src/app/hotel/[id]/page.tsx` | 2 silent catch blocks |

---

**Audit Completed By:** Claude Code
**Next Steps:** Create tickets for P0 fixes, schedule implementation sprint

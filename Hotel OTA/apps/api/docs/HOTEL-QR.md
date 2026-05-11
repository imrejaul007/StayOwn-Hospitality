# Hotel QR — Room Operating System

## Overview

**Hotel QR** is a comprehensive room service platform that allows hotel guests to:
1. Scan a QR code on their room door to access all hotel services
2. Order anything (food, housekeeping, transport, spa, laundry) via the Room Hub
3. Chat with hotel staff in real-time
4. Track request status and view bills
5. Earn REZ coins for engagement

Guests can access Hotel QR via:
- **Room QR Scan** — Camera scan → Opens Room Hub
- **StayOwn App** — Navigate to active booking → Access Room Hub
- **REZ Now** — Hotel store page → Room-specific services

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              HOTEL QR ECOSYSTEM                            │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   Room QR Scan   │     │   StayOwn App    │     │   REZ Now App   │
│  (Guest Phone)   │     │  (Mobile App)    │     │  (Hotel Store)  │
└────────┬─────────┘     └────────┬─────────┘     └────────┬─────────┘
         │                        │                        │
         │ QR Code Scan           │ Login/Booking          │ Hotel Store
         │ /room-hub?roomId=...   │ /app/services         │ /hotel-slug
         │                        │                        │
         └────────────────────────┴────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ROOM HUB                                         │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌─────────┐ │
│  │Quick Actions│  │Cart/Order │  │  Chat    │  │ Requests  │  │  Bill  │ │
│  │ Housekeep  │  │Room Service│  │ Concierge │  │  Status   │  │  View  │ │
│  │ Laundry    │  │ Menu Items │  │  Staff    │  │  History  │  │ Checkout│ │
│  │ Transport  │  │  Checkout  │  │  RealTime │  │           │  │         │ │
│  │ Spa        │  │            │  │           │  │           │  │         │ │
│  │ Maintenance│  │           │  │           │  │           │  │         │ │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘  └─────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │                           │
                    ▼                           ▼
┌──────────────────────────┐    ┌──────────────────────────────────────────┐
│       HOTEL OTA          │    │              HOTEL PMS                    │
│   (Stayeon)              │    │           (Stayeon)                       │
│  ┌──────────────────┐   │    │  ┌──────────────────────────────────┐   │
│  │ RoomService API   │   │    │  │  Service Request Engine          │   │
│  │ - createRequest  │   │    │  │  - assignStaff()                 │   │
│  │ - trackRequest   │   │    │  │  - updateStatus()                │   │
│  │ - validateQR      │   │    │  │  - notifyGuest()                 │   │
│  └──────────────────┘   │    │  └──────────────────────────────────┘   │
│  ┌──────────────────┐   │    │  ┌──────────────────────────────────┐   │
│  │ Engagement Track  │   │    │  │  Staff Dashboard                │   │
│  │ - scan()         │   │    │  │  - Accept requests               │   │
│  │ - order()        │   │    │  │  - Update status                 │   │
│  │ - awardCoins()   │   │    │  │  - Chat with guest               │   │
│  └──────────────────┘   │    │  └──────────────────────────────────┘   │
│  ┌──────────────────┐   │    │  ┌──────────────────────────────────┐   │
│  │  Chat Service    │   │    │  │  Chat Thread Manager             │   │
│  │  - sendMessage() │   │    │  │  - Staff-Guest threads           │   │
│  │  - getMessages() │   │    │  │  - Real-time WebSocket           │   │
│  └──────────────────┘   │    │  └──────────────────────────────────┘   │
└──────────────────────────┘    └──────────────────────────────────────────┘
                    │                           │
                    │     Webhook / API          │
                    │                           │
                    ▼                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           REZ NOW                                          │
│  ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────────┐  │
│  │ Hotel Store      │   │ Coin Rewards      │   │ Wallet Integration   │  │
│  │ - storeType:     │   │ - scan_bonus     │   │ - burn coins         │  │
│  │   'hotel'        │   │ - order_cashback │   │ - track balance      │  │
│  │ - roomContext    │   │ - loyalty_tier   │   │ - auto-redeem       │  │
│  └──────────────────┘   └──────────────────┘   └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## QR Code Structure

### QR Code Payload (JSON)

```json
{
  "roomId": "room-uuid-123",
  "roomNumber": "101",
  "roomType": "Deluxe King",
  "floor": "1",
  "hotelId": "hotel-uuid-456",
  "hotelName": "Grand Hotel",
  "hotelSlug": "grand-hotel-delhi",
  "bookingId": "booking-uuid-789",
  "guestName": "John Doe",
  "checkIn": "2024-01-15T14:00:00Z",
  "checkOut": "2024-01-18T11:00:00Z",
  "expiresAt": "2024-01-18T11:00:00Z",
  "signature": "hmac-sha256-hex",
  "timestamp": 1705324800
}
```

### QR URL Format

```
https://stayown.app/room-hub?roomId=xxx&roomNumber=101&...
OR
https://reznow.app/grand-hotel-delhi/room/101
```

### QR Code Generation

- Generated by **Hotel PMS** admin panel (`/admin/room-qr`)
- Signed with HMAC-SHA256 using `ROOM_QR_SECRET`
- Valid until **checkout date** or configured expiry
- Can be regenerated per stay

---

## Services Available via Hotel QR

### 1. Housekeeping
| Service | Description | Price |
|---------|-------------|-------|
| Room Cleaning | Full room housekeeping | Free |
| Extra Towels | Bath/hand towels | Free |
| Extra Toiletries | Soap, shampoo, etc. | Free |
| Bedding Change | Linen replacement | Free |
| Deep Cleaning | Detailed cleaning | ₹500 |

### 2. Room Service (F&B)
| Category | Items |
|----------|-------|
| Beverages | Tea, Coffee, Juice, Water |
| Breakfast | Continental, Indian, Eggs |
| Meals | Lunch, Dinner ( Buffet/A la carte) |
| Snacks | Samosa, Sandwich, Biscuits |

### 3. Laundry
| Service | Price |
|---------|-------|
| Wash & Fold | ₹150/piece |
| Ironing | ₹20/piece |
| Dry Clean | ₹100/piece |
| Express Laundry | 2x Price |

### 4. Transport
| Service | Description | Price |
|---------|-------------|-------|
| Airport Drop | To airport | As per distance |
| Airport Pickup | From airport | As per distance |
| Local Travel | Within city | As per distance |
| Car Rental | With driver | Hourly/Daily |

### 5. Spa & Wellness
| Service | Duration | Price |
|---------|----------|-------|
| Swedish Massage | 60 min | ₹2,500 |
| Deep Tissue | 90 min | ₹3,500 |
| Aromatherapy | 60 min | ₹2,000 |
| Facial | 45 min | ₹1,500 |

### 6. Maintenance
| Service | Description |
|---------|-------------|
| AC Repair | Air conditioning issues |
| Wi-Fi Support | Internet connectivity |
| TV Setup | Channel/casting issues |
| Room Fixture | Lights, locks, etc. |

### 7. Concierge
| Service | Description |
|---------|-------------|
| Special Requests | Custom guest needs |
| Restaurant Reservations | External dining |
| Event Tickets | Local attractions |
| Luggage Storage | Before/after stay |

### 8. Fitness
| Service | Description |
|---------|-------------|
| Gym Access | 24/7 access |
| Personal Trainer | On request |
| Yoga Sessions | Morning/Evening |
| Swimming Pool | Timing-based |

---

## Chat Service

### Overview

Real-time chat between guest and hotel staff via WebSocket.

### Chat Architecture

```
┌─────────────┐     WebSocket      ┌─────────────────┐     REST API    ┌──────────────┐
│ Guest App   │◄──────────────────►│  Chat Gateway   │◄───────────────►│ Hotel PMS    │
│ (Room Hub)  │                    │  (Socket.io)    │                  │ (Staff App)  │
└─────────────┘                    └────────┬────────┘                  └──────────────┘
                                          │
                         ┌────────────────┴────────────────┐
                         │                                 │
                         ▼                                 ▼
                ┌─────────────────┐               ┌─────────────────┐
                │ Message Store   │               │ Notification    │
                │ (MongoDB)      │               │ Service         │
                └─────────────────┘               └─────────────────┘
```

### Chat Features

1. **Room-based threads** — One thread per room request
2. **Staff assignment** — Requests auto-assign to relevant department
3. **Quick replies** — Staff can use pre-defined responses
4. **Image sharing** — Guests can send photos (e.g., maintenance issues)
5. **Read receipts** — Know when staff has seen the message
6. **Typing indicators** — Real-time typing status

### Message Types

```typescript
type MessageType =
  | 'text'              // Plain text message
  | 'service_request'   // New service request notification
  | 'status_update'     // Request status changed
  | 'quick_reply'      // Pre-defined response
  | 'image'            // Photo attachment
  | 'system';          // System notification (checkout reminder, etc.)

interface ChatMessage {
  id: string;
  threadId: string;
  senderId: string;
  senderType: 'guest' | 'staff' | 'system';
  senderName: string;
  messageType: MessageType;
  content: string;
  metadata?: Record<string, any>;
  readAt?: Date;
  createdAt: Date;
}
```

### WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `chat:join` | Client→Server | Join room thread |
| `chat:message` | Client→Server | Send message |
| `chat:message:new` | Server→Client | New message received |
| `chat:typing` | Bidirectional | Typing indicator |
| `chat:read` | Client→Server | Mark messages as read |
| `chat:read:receipt` | Server→Client | Read receipt |

---

## Data Models

### Hotel OTA (PostgreSQL)

```prisma
model RoomServiceRequest {
  id               String    @id @default(uuid())
  bookingId        String
  hotelId          String
  roomId           String
  roomNumber       String
  guestName        String
  serviceType      String    // housekeeping, room_service, laundry, etc.
  description      String?
  items            String?   // JSON array of items
  totalAmountPaise Int       @default(0)
  status           String    @default("pending")
                   // pending → assigned → in_progress → completed / cancelled
  priority         String    @default("now")
  assignedTo      String?
  guestUserId      String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  completedAt      DateTime?

  @@index([hotelId, status])
  @@index([bookingId])
  @@index([roomId])
}

model RoomEngagement {
  id              String   @id @default(uuid())
  rezUserId       String
  otaUserId       String
  bookingId       String
  hotelId         String
  roomId          String
  roomNumber      String
  engagementType  String   // qr_scan, service_request, order, chat
  metadata        Json?
  engagedAt       DateTime @default(now())

  @@index([bookingId])
  @@index([hotelId])
}

model RoomChatThread {
  id          String    @id @default(uuid())
  bookingId   String
  roomId      String
  hotelId     String
  guestUserId String
  staffUserId String?
  status      String    @default("active")  // active, closed
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([bookingId])
  @@index([hotelId])
}

model RoomChatMessage {
  id          String   @id @default(uuid())
  threadId    String
  senderId    String
  senderType  String   // guest, staff, system
  senderName  String
  messageType String   // text, service_request, status_update, etc.
  content     String
  metadata    Json?
  readAt      DateTime?
  createdAt   DateTime @default(now())

  @@index([threadId, createdAt])
}
```

### Hotel PMS (MongoDB)

```javascript
// ServiceRequest Model
{
  _id: ObjectId,
  bookingId: ObjectId,
  roomId: ObjectId,
  roomNumber: String,
  serviceType: String,
  description: String,
  items: [{
    name: String,
    quantity: Number,
    price: Number
  }],
  totalAmount: Number,
  status: String, // pending, assigned, in_progress, completed, cancelled
  priority: String,
  assignedTo: ObjectId, // Staff user
  guestId: ObjectId,
  hotelId: ObjectId,
  createdAt: Date,
  updatedAt: Date,
  completedAt: Date,
  chatThreadId: String, // Link to chat thread
  notes: [{
    text: String,
    addedBy: ObjectId,
    createdAt: Date
  }]
}

// ChatThread Model
{
  _id: ObjectId,
  bookingId: ObjectId,
  roomId: ObjectId,
  hotelId: ObjectId,
  serviceRequestId: ObjectId, // Optional link to specific request
  participants: [{
    userId: ObjectId,
    role: String, // guest, staff, manager
    joinedAt: Date
  }],
  status: String, // active, archived
  lastMessageAt: Date,
  createdAt: Date
}

// ChatMessage Model
{
  _id: ObjectId,
  threadId: ObjectId,
  senderId: ObjectId,
  senderType: String,
  senderName: String,
  messageType: String,
  content: String,
  attachments: [{
    type: String, // image, file
    url: String
  }],
  readBy: [{
    userId: ObjectId,
    readAt: Date
  }],
  createdAt: Date
}
```

---

## API Endpoints

### Room QR (Public)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/room-qr/validate` | Validate scanned QR data |
| GET | `/api/room-qr/menu/:hotelId` | Get room service menu |

### Room Service (Authenticated)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/room-service` | Create service request |
| GET | `/v1/room-service` | List requests (with filters) |
| GET | `/v1/room-service/:id` | Get specific request |
| PATCH | `/v1/room-service/:id` | Update request status |
| GET | `/v1/room-service/guest/my-requests` | Guest's requests |
| GET | `/v1/room-service/menu/:hotelId` | Get service menu |

### Room Chat (Authenticated)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/room-chat/threads` | Create/get chat thread |
| GET | `/v1/room-chat/threads/:id` | Get thread with messages |
| GET | `/v1/room-chat/threads` | List guest's threads |
| POST | `/v1/room-chat/threads/:id/messages` | Send message |
| PATCH | `/v1/room-chat/threads/:id/read` | Mark as read |

### Webhook: REZ Room Engagement

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/room-engagement/webhook` | REZ → OTA events |
| POST | `/v1/room-engagement/sync` | Sync to REZ backend |

---

## Coin Rewards (REZ Integration)

| Action | Coins Earned | Description |
|--------|-------------|-------------|
| QR Scan (Check-in) | 5 coins | First scan of the stay |
| View Menu | 1 coin | Browse room service menu |
| First Order | 20 coins | First room service order |
| Order (per ₹100) | 2 coins | Cashback on orders |
| Chat with Staff | 2 coins | Per 5 messages |
| Checkout via QR | 10 coins | Scanning to checkout |
| Review Submitted | 15 coins | Post-stay review |

### Coin Redemption
- 1 REZ Coin = ₹1 discount
- Auto-suggest at checkout
- Can combine with other payment methods

---

## PMS Integration

### Service Request Flow

```
Guest Request (Hotel QR)
        │
        ▼
Hotel OTA (RoomServiceRequest created)
        │
        │ webhook (service_request_created)
        ▼
Hotel PMS (ServiceRequest created)
        │
        │ Staff accepts request
        ▼
Hotel PMS (status → assigned)
        │
        │ webhook (status_update)
        ▼
Hotel OTA (status synced)
        │
        │ Push notification to guest
        ▼
Guest App (Real-time update)
```

### Webhook Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `service_request_created` | OTA → PMS | Request details |
| `service_request_updated` | OTA → PMS | Status change |
| `request_assigned` | PMS → OTA | Staff assigned |
| `request_completed` | PMS → OTA | Mark complete |
| `chat_message` | Bidirectional | Chat sync |

---

## Frontend Pages

### Guest-Facing (Room Hub)

| Route | Component | Description |
|-------|-----------|-------------|
| `/room-hub` | RoomHub | Main room interface |
| `/room-hub/orders` | OrderHistory | Past orders |
| `/room-hub/chat` | ChatThread | Chat with staff |
| `/room-hub/bill` | RoomBill | View & pay bill |

### StayOwn App Integration

| Route | Description |
|-------|-------------|
| `/app/services` | Hotel services dashboard |
| `/app/services/room` | Room hub for active booking |
| `/app/requests` | Service request history |

### REZ Now Hotel

| Route | Description |
|-------|-------------|
| `/[hotel-slug]` | Hotel store (hotel type) |
| `/[hotel-slug]/room/[room-id]` | Room-specific services |
| `/[hotel-slug]/orders` | Order history |

### Admin Panel (Hotel PMS)

| Route | Description |
|-------|-------------|
| `/admin/room-qr` | Generate/manage room QR codes |
| `/admin/service-requests` | View all service requests |
| `/admin/chat-monitor` | Monitor active chats |

---

## Security

### QR Code Security
- HMAC-SHA256 signed payloads
- 5-minute timestamp tolerance
- Expiry at checkout date
- Hotel-specific secrets

### API Security
- JWT authentication for guest operations
- Staff role verification for admin ops
- Rate limiting (100 req/min per IP)
- Input validation & sanitization

### Chat Security
- End-to-end encryption (future)
- Message content moderation
- Staff-only file attachments
- Audit log for all messages

---

## Environment Variables

### Hotel OTA

| Variable | Description |
|----------|-------------|
| `ROOM_QR_SECRET` | HMAC secret for QR signing |
| `REZ_ROOM_ENGAGEMENT_SECRET` | REZ webhook verification |
| `REZ_API_BASE_URL` | REZ backend URL |

### Hotel PMS

| Variable | Description |
|----------|-------------|
| `ROOM_QR_SECRET` | Must match OTA secret |
| `CHAT_WS_SECRET` | WebSocket authentication |

### REZ Now

| Variable | Description |
|----------|-------------|
| `HOTEL_API_KEY` | API key for OTA integration |
| `HOTEL_WEBHOOK_SECRET` | Webhook verification |

---

## TODO

- [x] Room QR code generation
- [x] QR scanner component
- [x] RoomHub component
- [x] Room service API
- [x] Prisma schema for room_service_requests
- [x] REZ engagement webhook
- [ ] StayOwn app integration
- [ ] Chat service (WebSocket)
- [ ] REZ Now hotel store page
- [ ] PMS service request webhooks
- [ ] Coin reward integration
- [ ] Push notifications
- [ ] Real-time status updates

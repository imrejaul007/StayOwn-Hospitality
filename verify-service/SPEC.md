# Verify Service - SPEC.md

**Version:** 1.0.0
**Port:** (see config)
**Company:** StayOwn-Hospitality
**Category:** Verification

---

## Overview

Verification service for StayOwn properties and users. Handles identity verification, property verification, and generates QR codes for check-in/out processes.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Verify Service                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  Components:                                                                │
│  ├── Identity Verifier → User identity checks                             │
│  ├── Property Verifier → Property authenticity                          │
│  ├── QR Generator      → QR code generation                             │
│  └── Report Generator → Verification reports                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Models

### Verification
```typescript
{
  verificationId: string
  type: 'identity' | 'property' | 'document'
  entityId: string
  entityType: 'user' | 'hotel' | 'property'
  status: 'pending' | 'verified' | 'rejected'
  documents: string[]
  verifiedAt?: Date
  verifiedBy?: string
}
```

### QRCode
```typescript
{
  qrId: string
  entityId: string
  type: 'checkin' | 'checkout' | 'access' | 'key'
  data: string
  expiresAt?: Date
  used: boolean
  usedAt?: Date
}
```

---

## API Endpoints

### Verification
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/verification/request` | Request verification |
| GET | `/verification/:id` | Check status |
| POST | `/verification/:id/approve` | Approve |
| POST | `/verification/:id/reject` | Reject |

### QR Codes
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/qr/generate` | Generate QR code |
| GET | `/qr/:id` | Get QR details |
| POST | `/qr/:id/validate` | Validate QR |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |

---

## Dependencies

```json
{
  "@prisma/client": "^5.0.0",
  "next": "^14.0.0",
  "react": "^18.2.0",
  "qrcode": "^1.5.3",
  "bcryptjs": "^2.4.3",
  "jsonwebtoken": "^9.0.0",
  "recharts": "^2.8.0",
  "zod": "^3.22.0"
}
```

---

## Status

- [x] Identity verification
- [x] Property verification
- [x] QR code generation
- [x] Verification reports


# Habixo - Smart Living OS powered by ReZ

**Habixo** is a hybrid rental platform combining:
- **Habixo Stay** - Vacation rentals (Airbnb-style)
- **Habixo Rent** - Long-term premium rentals (Flent-style)
- **Habixo Match** - Flatmate matching (FlatX-style)

## Features

### Habixo Stay (Short-term Rentals)
- Dynamic pricing engine
- Instant book & request to book
- Host protection & insurance
- Calendar sync across platforms
- Multi-guest support

### Habixo Rent (Long-term Rentals)
- Fully furnished premium homes
- No brokerage fees
- Flexible lease terms (3-12 months)
- 58-point quality checks
- Full-service property management

### Habixo Match (Flatmate Matching)
- Lifestyle-based matching algorithm
- Compatibility scoring (0-100%)
- Browse by vibe tags
- Room swap support
- Verified profiles

### Trust Engine
- 4-component trust scoring
- Host reliability & quality
- Guest behavior tracking
- Karma integration (L1-L4)

### Retention Hooks
- Coin rewards on booking
- Streak tracking
- Karma point system
- ReZ Mind intent capture

## Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Express.js
- **Database**: MongoDB
- **Cache**: Redis
- **Language**: TypeScript

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Run development server
npm run dev

# Build for production
npm run build

# Start production
npm start
```

## API Endpoints

### Properties
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/habixo/properties` | Create property |
| GET | `/api/habixo/properties` | Search properties |
| GET | `/api/habixo/properties/:id` | Get property |
| PUT | `/api/habixo/properties/:id` | Update property |

### Bookings
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/habixo/bookings` | Create booking |
| GET | `/api/habixo/bookings` | Search bookings |
| GET | `/api/habixo/bookings/:id` | Get booking |
| POST | `/api/habixo/bookings/:id/cancel` | Cancel booking |

### Matching
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/habixo/match/profile` | Create profile |
| GET | `/api/habixo/match/suggestions` | Find matches |
| GET | `/api/habixo/match/profile/:userId` | Get profile |

### Trust
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/habixo/trust/:entityId?type=property|host|guest` | Get trust score |

## Webhooks

Habixo integrates with ReZ Mind for intent tracking:

- `POST /webhooks/habixo/stay/search` - Stay search intent
- `POST /webhooks/habixo/stay/view` - Stay view intent
- `POST /webhooks/habixo/rent/search` - Rent search intent
- `POST /webhooks/habixo/match/search` - Flatmate search intent

## Environment Variables

See `.env.example` for all configuration options.

## Architecture

```
┌─────────────────────────────────────────┐
│           Habixo API Gateway             │
└─────────────────┬───────────────────────┘
                  │
    ┌─────────────┼─────────────┬─────────────┐
    │             │             │             │
 Property      Booking        Match        Trust
 Service      Service       Service     Service
    │             │             │             │
    └─────────────┼─────────────┼─────────────┘
                  │
    ┌────────────┴────────────┐
    │    ReZ Ecosystem        │
    │  - Auth Service         │
    │  - Wallet Service       │
    │  - Karma Service        │
    │  - Notifications        │
    │  - ReZ Mind (Intent)    │
    └──────────────────────────┘
```

## License

Part of ReZ Ecosystem

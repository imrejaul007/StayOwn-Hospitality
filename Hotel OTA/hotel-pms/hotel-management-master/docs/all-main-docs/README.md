# Hotel Management System - Phase 1

A production-ready Hotel Management System with public website, guest web app, and admin dashboard.

## Features

- **Multi-tenant Architecture**: Support for multiple hotels
- **User Management**: Guest, Staff, and Admin roles with RBAC
- **Booking Engine**: Full reservation flow with availability checking
- **Payment Processing**: Stripe integration with webhooks
- **OTA Integration**: Booking.com availability sync (Phase 1)
- **Housekeeping Management**: Task assignment and tracking
- **Inventory Management**: Supply tracking and requests
- **Reporting**: Revenue and occupancy analytics
- **Security**: JWT authentication, encryption, rate limiting

## Tech Stack

- **Backend**: Node.js, Express.js, MongoDB, Mongoose
- **Frontend**: React, TypeScript, Vite, Tailwind CSS
- **Payments**: Stripe Payment Intents
- **Cache/Queue**: Redis
- **Deployment**: Google Cloud Run
- **CI/CD**: GitHub Actions

## Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- MongoDB Atlas account (or local MongoDB)
- Stripe account
- Google Cloud account (for deployment)

### Local Development

1. **Clone and setup**:
```bash
git clone <repository>
cd hotel-management-system
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

2. **Configure environment variables**:
   - Update `backend/.env` with your MongoDB, Stripe, and other credentials
   - Update `frontend/.env` with API URL

3. **Start with Docker Compose**:
```bash
docker-compose up --build
```

4. **Or run individually**:
```bash
# Backend
cd backend
npm install
npm run dev

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

5. **Seed data**:
```bash
cd backend
npm run seed
```

### Services

- Frontend: http://localhost:3000
- Backend API: http://localhost:4000
- API Docs: http://localhost:4000/docs
- MongoDB: localhost:27017
- Redis: localhost:6379

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register user
- `POST /api/v1/auth/login` - Login user
- `GET /api/v1/auth/me` - Get current user

### Rooms
- `GET /api/v1/rooms` - List rooms with availability
- `POST /api/v1/rooms` - Create room (admin)
- `PATCH /api/v1/rooms/:id` - Update room (admin)
- `DELETE /api/v1/rooms/:id` - Delete room (admin)

### Bookings
- `POST /api/v1/bookings` - Create booking
- `GET /api/v1/bookings` - List bookings
- `GET /api/v1/bookings/:id` - Get booking details
- `PATCH /api/v1/bookings/:id` - Update booking
- `DELETE /api/v1/bookings/:id` - Cancel booking

### Payments
- `POST /api/v1/payments/intent` - Create payment intent
- `POST /api/v1/payments/confirm` - Confirm payment
- `POST /api/v1/webhooks/stripe` - Stripe webhook handler

## Deployment

### Google Cloud Run

1. **Setup GCP**:
```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

2. **Deploy**:
```bash
# Backend
cd backend
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/hotel-backend
gcloud run deploy hotel-backend --image gcr.io/YOUR_PROJECT_ID/hotel-backend --platform managed

# Frontend
cd frontend
npm run build
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/hotel-frontend
gcloud run deploy hotel-frontend --image gcr.io/YOUR_PROJECT_ID/hotel-frontend --platform managed
```

### CI/CD with GitHub Actions

1. Configure secrets in GitHub:
   - `GCP_PROJECT_ID`
   - `GCP_SA_KEY` (Service Account JSON)
   - `MONGO_URI`
   - `STRIPE_SECRET_KEY`

2. Push to main branch to trigger deployment

## Testing

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test

# E2E tests
npm run test:e2e
```

## Security

- JWT tokens with RSA256 signing
- Password hashing with bcrypt
- Input validation with Joi
- Rate limiting
- CORS protection
- SQL injection prevention
- Encrypted sensitive data

## Architecture

```
├── backend/           # Express.js API server
├── frontend/          # React application  
├── infra/            # Infrastructure configs
├── docs/             # Documentation
└── docker-compose.yml # Local development
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Submit a pull request

## License

MIT License
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { env, validateEnv, validateCriticalEnv } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { redis } from './config/redis';
import { errorHandler } from './middleware/errorHandler';
import { sanitizeInput } from './middleware/sanitize';
import { requestLogger } from './middleware/requestLogger';
import { initializeHotelSocket } from './socket/hotelSocket';
import { createUnifiedAIChatSocketHandler } from './socket/unifiedAISocket';

// ── Global Error Handlers ──────────────────────────────────────────────────────
// Prevent Redis/BullMQ connection errors from crashing the server

process.on('uncaughtException', (err) => {
  // Log but don't crash on unexpected errors (especially from Redis/BullMQ)
  if (err.message?.includes('Connection is closed') ||
      err.message?.includes('ECONNRESET') ||
      err.message?.includes('EPIPE')) {
    console.warn('[Process] Caught non-fatal error:', err.message);
    return;
  }
  console.error('[Process] Uncaught exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  // Handle unhandled rejections gracefully
  const reasonStr = reason instanceof Error ? reason.message : String(reason);
  if (reasonStr.includes('Connection is closed') ||
      reasonStr.includes('ECONNRESET')) {
    console.warn('[Process] Unhandled rejection (non-fatal):', reasonStr);
    return;
  }
  console.error('[Process] Unhandled rejection at:', promise, 'reason:', reason);
});

// Routes
import authRoutes from './routes/auth.routes';
import hotelRoutes from './routes/hotel.routes';
import bookingRoutes, { razorpayWebhookRouter } from './routes/booking.routes';
import walletRoutes from './routes/wallet.routes';
import partnerRezRoutes from './routes/partner-rez.routes';
import partnerPmsRoutes from './routes/partner-pms.routes';
import hotelPanelRoutes from './routes/hotel-panel.routes';
import adminRoutes from './routes/admin.routes';
import userRoutes from './routes/user.routes';
import pmsRoutes, { webhookRouter as pmsWebhookRouter } from './routes/pms.routes';
import pmsOtaWebhookRoutes from './routes/pms-ota-webhooks.routes';
import corporateRoutes from './routes/corporate.routes';
import miningRoutes from './routes/mining.routes';
import channelManagerRoutes from './routes/channel-manager.routes';
import pricingRoutes from './routes/pricing.routes';
import governanceRoutes from './routes/governance.routes';
import affiliateRoutes from './routes/affiliate.routes';
import reviewRoutes from './routes/review.routes';
import seoRoutes from './routes/seo.routes';
import offlinePaymentRoutes from './routes/offline-payment.routes';
import roomServiceRoutes from './routes/room-service.routes';
import roomChatRoutes from './routes/room-chat.routes';
import rezRoomEngagementRoutes from './routes/rez-room-engagement.routes';
import roomQRRoutes from './routes/room-qr.routes';
import unifiedChatRoutes from './routes/unified-chat.routes';
import bookingSyncRoutes from './routes/booking-sync.routes';
import hotelOnboardingRoutes from './routes/hotel-onboarding/hotel-onboarding.routes';
import staffDashboardRoutes from './routes/staff/staff-dashboard.routes';
import chatAiRoutes from './routes/chatAi.routes';
import slaRoutes from './routes/sla.routes';

// Workers (start processing)
import './jobs/workers';
import { initializeScheduledJobs } from './jobs/scheduler';

const app = express();

// Disable X-Powered-By header
app.disable('x-powered-by');

// Global middleware
app.use(helmet());
// FIX-BUG-16: Require all CORS URLs via environment variables
// No hardcoded fallbacks — prevent using outdated domains if env vars missing
const ALLOWED_ORIGINS_PROD = [
  process.env.FRONTEND_URL,
  process.env.HOTEL_PANEL_URL,
  process.env.ADMIN_PANEL_URL,
].filter(Boolean) as string[];

// Fail startup if no CORS origins configured in production
if (process.env.NODE_ENV === 'production' && ALLOWED_ORIGINS_PROD.length === 0) {
  console.error('[CORS] CRITICAL: No allowed origins configured. Set FRONTEND_URL, HOTEL_PANEL_URL, ADMIN_PANEL_URL.');
  process.exit(1);
}

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? (origin, cb) => {
        if (!origin || ALLOWED_ORIGINS_PROD.includes(origin)) return cb(null, true);
        cb(new Error(`CORS: origin ${origin} not allowed`));
      }
    : true,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' })); // for image uploads
app.use(sanitizeInput);

// HOTEL-OTA-ARCH-001: Request ID injection for distributed tracing
app.use((req, _res, next) => {
  const { getRequestId } = require('./config/logger');
  (req as any).requestId = getRequestId(req.headers as Record<string, string>);
  next();
});

app.use(requestLogger);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.io / Redis adapter health check
app.get('/health/socket', async (_req, res) => {
  try {
    const redisOk = await redis.ping() === 'PONG';
    res.json({ status: 'ok', redis: redisOk, timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'degraded', redis: false, timestamp: new Date().toISOString() });
  }
});

// API routes
app.use('/v1/auth', authRoutes);
app.use('/v1/hotels', hotelRoutes);
app.use('/v1/bookings', bookingRoutes);
app.use('/v1/wallet', walletRoutes);
app.use('/v1/partner/rez', partnerRezRoutes);
app.use('/v1/partner/pms', partnerPmsRoutes);
app.use('/v1/hotel', hotelPanelRoutes);
app.use('/v1/admin', adminRoutes);
app.use('/v1/user', userRoutes);
app.use('/v1/pms', pmsRoutes);
app.use('/v1/admin/corporate', corporateRoutes);
app.use('/v1/mining', miningRoutes);
app.use('/v1/channel-manager', channelManagerRoutes);
app.use('/v1/pricing', pricingRoutes);
app.use('/v1/governance', governanceRoutes);
app.use('/v1/affiliate', affiliateRoutes);
app.use('/v1/seo', seoRoutes);
app.use('/v1', reviewRoutes); // handles /reviews/* and /wishlists/*
app.use('/v1', offlinePaymentRoutes); // handles /offline-payment/* and /hotel/bill-payments
app.use('/v1/room-service', roomServiceRoutes); // Room QR service requests
app.use('/v1/room-chat', roomChatRoutes); // Room QR chat
app.use('/v1/room-qr', roomQRRoutes); // Hotel QR code validation
app.use('/v1/room-engagement', rezRoomEngagementRoutes); // REZ engagement webhook
app.use('/v1/unified-chat', unifiedChatRoutes); // Cross-platform chat for all ReZ apps
app.use('/v1/booking-sync', bookingSyncRoutes); // Stay Owen ↔ Hotel PMS booking sync
app.use('/v1/hotel/onboarding', hotelOnboardingRoutes); // Hotel self-service onboarding
app.use('/v1/staff', staffDashboardRoutes); // Staff dashboard
app.use('/v1/chat', chatAiRoutes); // REZ MIND AI Chat
app.use('/v1', slaRoutes); // SLA monitoring routes

// Webhook routes for external integrations
app.use('/api/webhooks', pmsWebhookRouter);
app.use('/api/webhooks', razorpayWebhookRouter);
app.use('/api/webhooks', pmsOtaWebhookRoutes); // PMS↔OTA bidirectional webhooks

// Error handler (must be last)
app.use(errorHandler);

// Start server
async function start() {
  // BUG-25 FIX: Validate critical secrets FIRST — these must be present in ALL environments
  // validateCriticalEnv() calls process.exit(1) if missing, so execution stops here
  validateCriticalEnv();

  // Validate environment variables (warnings only, non-blocking)
  const envErrors = validateEnv();
  if (envErrors.length > 0) {
    console.warn('Environment validation warnings:', envErrors);
  }

  await connectDatabase();

  // Create HTTP server and integrate Socket.IO
  const httpServer = createServer(app);
  const hotelIO = initializeHotelSocket(httpServer);

  // Initialize Unified AI Chat Socket handler (supports all ReZ ecosystem apps)
  createUnifiedAIChatSocketHandler(hotelIO, {
    enableAI: !!process.env.ANTHROPIC_API_KEY
  });

  httpServer.listen(env.PORT, () => {
    console.log(`Hotel OTA API running on port ${env.PORT}`);
    console.log(`Environment: ${env.NODE_ENV}`);
    console.log(`Socket.IO namespaces: /hotel, /ai/hotel, /ai/support, /ai/restaurant, /ai/retail, /ai/general, /ai/room-qr, /ai/web-menu`);
    console.log(`AI Chat enabled: ${!!process.env.ANTHROPIC_API_KEY ? 'Yes (Anthropic API configured)' : 'No (set ANTHROPIC_API_KEY to enable)'}`);

    // Initialize scheduled jobs after server is up (non-blocking, won't crash on Redis failure)
    setTimeout(() => {
      initializeScheduledJobs()
        .then(() => console.log('[Scheduler] Jobs initialized'))
        .catch((err) => console.warn('[Scheduler] Jobs unavailable (Redis required):', err.message));
    }, 5000); // Wait 5s for Redis to fully connect
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await disconnectDatabase();
  process.exit(0);
});
process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down...');
  await disconnectDatabase();
  process.exit(0);
});

export default app;

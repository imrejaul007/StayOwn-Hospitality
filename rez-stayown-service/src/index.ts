/**
 * rez-stayown-service
 * StayOwn Hotel OTA Service - ReZ's own hotel booking platform
 *
 * Features:
 * - Hotel search and booking (OTA)
 * - Room QR generation for guest check-in
 * - Service charges and checkout billing
 */

import 'dotenv/config';

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import morgan from 'morgan';

// Sentry initialization
import * as Sentry from '@sentry/node';
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: 0.1,
});

// MongoDB connection
import { connectMongoDB, disconnectMongoDB } from './config/mongodb-auth';

// Routes
import stayownRoutes from './routes/stayownRoutes';
import roomQRRoutes from './routes/room-qr-routes';
import preArrivalRoutes from './routes/pre-arrival.routes';
import roomServiceHubRoutes from './routes/room-service-hub.routes';
import merchantQRRoutes from './routes/merchant-qr.routes';
import bulkQRRoutes from './routes/bulk-qr.routes';
import pmsWebhookRoutes from './routes/pms-webhooks.routes';
import roomQRManagerRoutes from './routes/room-qr-manager.routes';
import aiRoutes from './routes/ai-routes';
import googleHotelAdsRoutes from './routes/google-hotel-ads.routes';
import digitalCheckinRoutes from './routes/digital-checkin.routes';
import whatsappRoutes from './routes/whatsapp.routes';
import currencyRoutes from './routes/currency.routes';

// Services
import { handleRoomServiceWebhook } from './room-qr';

// Language Detection Middleware
import { languageDetector, switchLanguage, getLanguageSettings } from './middleware/languageDetector';

const app = express();
const PORT = parseInt(process.env.PORT || '4016', 10);

// ─── Middleware ───────────────────────────────────────────────────────────────

app.set('trust proxy', 1);

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
}));

// CORS
const allowedOrigins = (process.env.CORS_ORIGIN || 'https://admin.rez.money,https://rez.money,https://rez-app.vercel.app')
  .split(',')
  .map(s => s.trim());

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// MongoDB sanitize (prevent NoSQL injection)
app.use(mongoSanitize());

// Request logging
app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));

// ─── Health Endpoints ─────────────────────────────────────────────────────────

app.get('/health/live', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'rez-stayown-service' });
});

app.get('/health/ready', async (_req: Request, res: Response) => {
  const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};
  let isReady = true;

  // Check MongoDB
  try {
    const mongoose = require('mongoose');
    const mongoStart = Date.now();
    if (mongoose.connection.readyState !== 1) {
      throw new Error('not connected');
    }
    await mongoose.connection.db.admin().ping();
    checks.mongodb = { status: 'up', latencyMs: Date.now() - mongoStart };
  } catch (err: any) {
    checks.mongodb = { status: 'down', error: err.message };
    isReady = false;
  }

  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'ready' : 'not_ready',
    service: 'rez-stayown-service',
    timestamp: new Date().toISOString(),
    checks,
  });
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'rez-stayown-service',
    version: process.env.SERVICE_VERSION || '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health/detailed', async (_req: Request, res: Response) => {
  const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};
  let isHealthy = true;

  // Check MongoDB with latency
  try {
    const mongoose = require('mongoose');
    const mongoStart = Date.now();
    if (mongoose.connection.readyState !== 1) {
      throw new Error('not connected');
    }
    await mongoose.connection.db.admin().ping();
    checks.database = { status: 'up', latencyMs: Date.now() - mongoStart };
  } catch (err: any) {
    checks.database = { status: 'down', error: err.message };
    isHealthy = false;
  }

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    version: process.env.SERVICE_VERSION || '1.0.0',
    uptime: process.uptime(),
    checks,
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────

// StayOwn Hotel routes (search, booking)
app.use('/api/hotels', stayownRoutes);

// Room QR routes (generation, validation, charges, checkout)
app.use('/api/room-qr', roomQRRoutes);

// Pre-arrival routes
app.use('/api/pre-arrival', preArrivalRoutes);

// Room Service Hub routes (for consumer app)
app.use('/api/room-service', roomServiceHubRoutes);

// Merchant QR routes (for staff scanning)
app.use('/api/merchant', merchantQRRoutes);

// Bulk QR routes (for batch operations)
app.use('/api/room-qr/bulk', bulkQRRoutes);

// Room QR Manager routes (room-bound system)
app.use('/api/room-qr/manager', roomQRManagerRoutes);

// PMS Webhooks (room assignment from Hotel-PMS)
app.use('/api/webhooks/pms', pmsWebhookRoutes);

// AI Routes (REZ Mind integration - dynamic pricing, recommendations, insights)
app.use('/ai', aiRoutes);

// Digital Check-in Routes (guest check-in, ID verification, digital keys)
app.use('/api/digital-checkin', digitalCheckinRoutes);

// WhatsApp Business Routes (REZ Marketing platform integration)
app.use('/api/whatsapp', whatsappRoutes);

// Multi-Currency Routes (price conversion and formatting)
app.use('/api/currency', currencyRoutes);

// Google Hotel Ads Routes (product feed, click/conversion tracking)
app.use('/api/google-hotel-ads', googleHotelAdsRoutes);

// Google Hotel Ads webhooks (click tracking, conversion tracking)
app.use('/api/webhooks/google-hotel-ads', googleHotelAdsRoutes);

// Google Hotel Ads product feed (Google crawler endpoint)
app.use('/feeds', googleHotelAdsRoutes);

// ─── Webhook Endpoints ────────────────────────────────────────────────────────

// Room service webhook from Hotel OTA
app.post('/api/webhooks/room-service', async (req: Request, res: Response) => {
  try {
    const { event, bookingId, hotelId, roomId, data } = req.body;

    // Verify webhook secret
    const webhookSecret = req.headers['x-webhook-secret'] as string;
    const expectedSecret = process.env.ROOM_QR_WEBHOOK_SECRET;

    if (expectedSecret && webhookSecret !== expectedSecret) {
      return res.status(401).json({ success: false, message: 'Invalid webhook secret' });
    }

    await handleRoomServiceWebhook({ event, bookingId, hotelId, roomId, data });

    res.json({ success: true, message: 'Webhook processed' });
  } catch (error: any) {
    console.error('[Webhook] Room service error:', error);
    res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
});

// ─── Error Handler ───────────────────────────────────────────────────────────

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Error]', err.message);

  Sentry.captureException(err);

  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

// ─── Server Startup ───────────────────────────────────────────────────────────

async function startServer(): Promise<void> {
  console.log('[Startup] Starting rez-stayown-service...');

  try {
    // Connect to MongoDB
    console.log('[Startup] Connecting to MongoDB...');
    await connectMongoDB();
    console.log('[Startup] MongoDB connected');

    // Start server
    const server = app.listen(PORT, () => {
      console.log(`[Startup] rez-stayown-service running on port ${PORT}`);
      console.log(`[Startup] Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string): Promise<void> => {
      console.log(`[Shutdown] Received ${signal}, shutting down gracefully...`);

      server.close(async () => {
        console.log('[Shutdown] HTTP server closed');

        try {
          await disconnectMongoDB();
          console.log('[Shutdown] MongoDB disconnected');
        } catch (err) {
          console.error('[Shutdown] MongoDB disconnect error:', err);
        }

        process.exit(0);
      });

      // Force exit after 30 seconds
      setTimeout(() => {
        console.error('[Shutdown] Forcing exit after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error) {
    console.error('[Startup] Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;

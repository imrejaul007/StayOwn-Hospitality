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
import logger from './utils/logger';
import cors from 'cors';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import morgan from 'morgan';
import crypto from 'crypto';

// Sentry initialization
import * as Sentry from '@sentry/node';
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'development',
  tracesSampleRate: 0.1,
});

// MongoDB connection
import { connectMongoDB, disconnectMongoDB } from './config/mongodb-auth';
import { closeRedisClient } from './middleware/rateLimiter';

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

// ─── Environment Validation ───────────────────────────────────────────────────

interface EnvValidationResult {
  valid: boolean;
  errors: string[];
}

function validateEnvironment(): EnvValidationResult {
  const errors: string[] = [];

  // Required in production
  if (process.env.NODE_ENV === 'production') {
    const requiredProduction = [
      { key: 'JWT_SECRET', name: 'JWT Secret' },
      { key: 'MONGODB_URI', name: 'MongoDB URI' },
    ];

    for (const { key, name } of requiredProduction) {
      if (!process.env[key]) {
        errors.push(`${name} (${key}) is required in production`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// Validate at startup
const envValidation = validateEnvironment();
if (!envValidation.valid) {
  logger.error('[Startup] CRITICAL: Environment validation failed:');
  envValidation.errors.forEach(e => console.error('  -', e));
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

const app = express();
const PORT = parseInt(process.env.PORT || '4016', 10);

// ─── Correlation ID Middleware ────────────────────────────────────────────────

app.use((req: Request, res: Response, next: NextFunction) => {
  const correlationId = (req.headers['x-correlation-id'] as string) ||
                        crypto.randomUUID();
  req.headers['x-correlation-id'] = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  (req as any).correlationId = correlationId;
  next();
});

// ─── Middleware ───────────────────────────────────────────────────────────────

app.set('trust proxy', 1);

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      scriptSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS - strict configuration
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
  : [];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Log suspicious CORS attempts
    logger.warn(`[CORS] Blocked origin: ${origin}`);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Service-Key', 'X-Correlation-ID', 'X-Requested-With'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'X-Correlation-ID'],
  maxAge: 86400, // 24 hours
}));

// HTTPS enforcement in production
if (process.env.NODE_ENV === 'production') {
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(301, `https://${req.hostname}${req.url}`);
    }
    next();
  });
}

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

// CORS error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err.message.includes('CORS')) {
    res.status(403).json({
      success: false,
      error: 'Not allowed by CORS policy'
    });
    return;
  }

  console.error('[Error]', err.message);

  Sentry.captureException(err);

  // Never expose internal error details in production
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

// ─── Server Startup ───────────────────────────────────────────────────────────

async function startServer(): Promise<void> {
  logger.info('[Startup] Starting rez-stayown-service...');

  try {
    // Connect to MongoDB
    logger.info('[Startup] Connecting to MongoDB...');
    await connectMongoDB();
    logger.info('[Startup] MongoDB connected');

    // Start server
    const server = app.listen(PORT, () => {
      logger.info(`[Startup] rez-stayown-service running on port ${PORT}`);
      logger.info(`[Startup] Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string): Promise<void> => {
      logger.info(`[Shutdown] Received ${signal}, shutting down gracefully...`);

      server.close(async () => {
        logger.info('[Shutdown] HTTP server closed');

        // Close Redis connection
        try {
          await closeRedisClient();
        } catch (err) {
          console.error('[Shutdown] Redis disconnect error:', err);
        }

        // Disconnect MongoDB
        try {
          await disconnectMongoDB();
          logger.info('[Shutdown] MongoDB disconnected');
        } catch (err) {
          console.error('[Shutdown] MongoDB disconnect error:', err);
        }

        process.exit(0);
      });

      // Force exit after 15 seconds (reduced from 30)
      setTimeout(() => {
        logger.error('[Shutdown] Forcing exit after timeout');
        process.exit(1);
      }, 15000);
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

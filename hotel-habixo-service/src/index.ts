// Habixo - Smart Living OS powered by ReZ
// Hybrid rental platform: Stay + Rent + Match
import 'dotenv/config';

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';

import { config } from './config';
import { connectDB } from './database/mongodb';
import { logger } from './utils/logger';
import {
  initSentry,
  sentryRequestHandler,
  sentryTracingHandler,
  sentryErrorHandler,
  flushSentry,
} from './monitoring/sentry';
import { closeRedisClient } from './api/middleware/rateLimiter';

// Routes
import propertyRoutes from './api/routes/property.routes';
import bookingRoutes from './api/routes/booking.routes';
import matchRoutes from './api/routes/match.routes';
import trustRoutes from './api/routes/trust.routes';
import webhookRoutes from './api/routes/webhooks.routes';
import searchRoutes from './api/routes/search.routes';
import pricingRoutes from './api/routes/pricing.routes';
import wishlistRoutes from './api/routes/wishlist.routes';
import reviewRoutes from './api/routes/review.routes';
import calendarRoutes from './api/routes/calendar.routes';
import paymentRoutes from './api/routes/payment.routes';
import hostRoutes from './api/routes/host.routes';

const app = express();
const PORT = config.port;

// ── Sentry Initialization ─────────────────────────────────────────────────────

initSentry();

// ── Correlation ID Middleware ─────────────────────────────────────────────────

app.use((req: Request, res: Response, next: NextFunction) => {
  const correlationId = (req.headers['x-correlation-id'] as string) || crypto.randomUUID();
  req.headers['x-correlation-id'] = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  (req as any).correlationId = correlationId;
  next();
});

// ── Middleware ─────────────────────────────────────────────────────────────────

// Sentry request handler (must be first)
app.use(sentryRequestHandler());
app.use(sentryTracingHandler());

// Enhanced security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(compression());

// Body parsing with size limits
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use(morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) },
}));

// CORS
app.use(cors({
  origin: config.corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-ID'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'X-Correlation-ID'],
}));

// Rate Limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later' },
});
app.use(limiter);

// HTTPS enforcement in production
if (config.nodeEnv === 'production') {
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.headers['x-forwarded-proto'] !== 'https') {
      return res.redirect(301, `https://${req.hostname}${req.url}`);
    }
    next();
  });
}

// ── Health Check ───────────────────────────────────────────────────────────────

app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'habixo',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.get('/', (req: Request, res: Response) => {
  res.json({
    service: 'Habixo - Smart Living OS powered by ReZ',
    version: '1.0.0',
    description: 'Hybrid rental platform: Stay + Rent + Match',
    endpoints: {
      properties: '/api/habixo/properties',
      bookings: '/api/habixo/bookings',
      match: '/api/habixo/match',
      trust: '/api/habixo/trust',
      search: '/api/habixo/search',
      pricing: '/api/habixo/pricing',
      wishlists: '/api/habixo/wishlists',
      reviews: '/api/habixo/reviews',
      calendar: '/api/habixo/calendar',
      payments: '/api/habixo/payments',
      host: '/api/habixo/host',
      health: '/health',
    },
  });
});

// ── API Routes ────────────────────────────────────────────────────────────────

app.use('/api/habixo/properties', propertyRoutes);
app.use('/api/habixo/bookings', bookingRoutes);
app.use('/api/habixo/match', matchRoutes);
app.use('/api/habixo/trust', trustRoutes);
app.use('/api/habixo/search', searchRoutes);
app.use('/api/habixo/pricing', pricingRoutes);
app.use('/api/habixo/wishlists', wishlistRoutes);
app.use('/api/habixo/reviews', reviewRoutes);
app.use('/api/habixo/calendar', calendarRoutes);
app.use('/api/habixo/payments', paymentRoutes);
app.use('/api/habixo/host', hostRoutes);
app.use('/', webhookRoutes); // Webhooks at root level

// ── Error Handler ────────────────────────────────────────────────────────────

// Sentry error handler (must be before other error handlers)
app.use(sentryErrorHandler);

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error({ error: err, path: req.path, method: req.method }, 'Unhandled error');
  res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
});

// ── 404 Handler ──────────────────────────────────────────────────────────────

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// ── Startup ───────────────────────────────────────────────────────────────────

async function startServer() {
  try {
    // Connect to MongoDB
    await connectDB();
    logger.info('MongoDB connected');

    // Start server
    app.listen(PORT, () => {
      logger.info(`Habixo service running on port ${PORT}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
      logger.info(`API base: http://localhost:${PORT}/api/habixo`);
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await flushSentry();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await flushSentry();
  process.exit(0);
});

startServer();

export default app;

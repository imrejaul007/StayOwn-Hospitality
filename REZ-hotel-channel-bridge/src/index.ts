import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';

import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { authMiddleware, AuthenticatedRequest } from './middleware/auth.middleware.js';
import { errorHandler, notFoundHandler, ApiError } from './middleware/error.middleware.js';
import channelRoutes from './routes/channels.js';

// Initialize Express app
const app: Express = express();

// Security middleware
app.use(helmet());

// CORS configuration - CRITICAL FIX: Never allow '*' in production
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const corsOrigins = process.env.CORS_ORIGIN?.split(',').filter(Boolean) || [];

if (IS_PRODUCTION && corsOrigins.length === 0) {
  logger.error('[FATAL] CORS_ORIGIN must be set in production');
  process.exit(1);
}

app.use(cors({
  origin: IS_PRODUCTION ? corsOrigins : (corsOrigins.length > 0 ? corsOrigins : ['http://localhost:3000', 'http://localhost:8080']),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Internal-Token'],
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.security.rateLimitWindow,
  max: config.security.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later'
    },
    timestamp: new Date().toISOString()
  }
});
app.use(limiter);

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip
    });
  });

  next();
});

// Health check (no auth required)
app.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      service: 'rez-hotel-channel-bridge',
      version: '1.0.0',
      timestamp: new Date().toISOString()
    }
  });
});

// Readiness check
app.get('/ready', async (req: Request, res: Response) => {
  try {
    const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

    if (mongoStatus !== 'connected') {
      res.status(503).json({
        success: false,
        data: {
          status: 'not ready',
          mongodb: mongoStatus
        }
      });
      return;
    }

    res.json({
      success: true,
      data: {
        status: 'ready',
        mongodb: mongoStatus,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    res.status(503).json({
      success: false,
      data: {
        status: 'not ready',
        error: error.message
      }
    });
  }
});

// Apply auth middleware to API routes
app.use('/api', authMiddleware);

// Mount routes
app.use(channelRoutes);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use((err: ApiError, req: Request, res: Response, next: NextFunction) => {
  errorHandler(err, req, res, next);
});

// Database connection
const connectDatabase = async (): Promise<void> => {
  try {
    await mongoose.connect(config.mongodb.uri, config.mongodb.options);
    logger.info('Connected to MongoDB', { uri: config.mongodb.uri.replace(/\/\/.*@/, '//<credentials>@') });
  } catch (error: any) {
    logger.error('Failed to connect to MongoDB', { error: error.message });
    throw error;
  }
};

// Graceful shutdown
const gracefulShutdown = async (signal: string): Promise<void> => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  try {
    // Close HTTP server
    logger.info('Closing HTTP server...');

    // Close database connection
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error: any) {
    logger.error('Error during graceful shutdown', { error: error.message });
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled rejection', { reason, promise });
});

// Start server
const startServer = async (): Promise<void> => {
  try {
    // Connect to database
    await connectDatabase();

    // Start HTTP server
    app.listen(config.port, () => {
      logger.info(`Server started on port ${config.port}`, {
        environment: config.nodeEnv,
        port: config.port
      });
      logger.info(`Health check: http://localhost:${config.port}/health`);
      logger.info(`API base: http://localhost:${config.port}/api`);
    });
  } catch (error: any) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
};

startServer();

export default app;

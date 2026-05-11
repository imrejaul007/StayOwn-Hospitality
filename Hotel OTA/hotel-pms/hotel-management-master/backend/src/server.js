import 'dotenv/config';
import './config/mongooseIndexPatch.js';
import mongoose from 'mongoose';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import path from 'path';
import connectDB from './config/database.js';
import { validateEnvironment } from './utils/validateEnv.js';
import { requestTracing } from './middleware/requestTracing.js';
import { authenticate } from './middleware/auth.js';
import { authorizePolicy } from './middleware/rbacPolicy.js';
import {
    connectRedis,
    getRedisClient
} from './config/redis.js';
import {
    errorHandler
} from './middleware/errorHandler.js';
import { maintenanceMode } from './middleware/maintenanceMode.js';
import {
    requestLogger
} from './middleware/logger.js';
import {
    comprehensiveAPILogger
} from './middleware/comprehensiveLogger.js';
import apiMetricsMiddleware from './middleware/apiMetricsMiddleware.js';
import { apiVersioning, getApiVersionInfo } from './middleware/apiVersioning.js';
import logger from './utils/logger.js';
import websocketService from './services/websocketService.js';
import inventoryScheduler from './services/inventoryScheduler.js';
import reorderJob from './jobs/reorderJob.js';
import NotificationScheduler from './services/notificationScheduler.js';
import { startScheduledUpdatesJob, stopScheduledUpdatesJob } from './jobs/scheduledUpdatesJob.js';
import { scheduleNightAudit } from './jobs/nightAuditJob.js';
import loyaltyMaintenanceJob from './jobs/loyaltyMaintenanceJob.js';
import loyaltyEventQueueService from './services/loyaltyEventQueueService.js';
// import pricingScheduler from './schedulers/pricingScheduler.js'; // Temporarily disabled - requires tensorflow
import {
    applyEventMiddleware
} from './middleware/eventMiddleware.js';
import queueService from './services/queueService.js';
import bookingWorkflowEngine from './services/bookingWorkflowEngine.js';
import payloadRetentionService from './services/payloadRetentionService.js';
import otaPayloadService from './services/otaPayloadService.js';
import systemHealthMonitor from './services/systemHealthMonitor.js';
import { registerApiRoutes } from './app/registerApiRoutes.js';
import { setupGracefulShutdown } from './utils/gracefulShutdown.js';

const queueProcessorMode = process.env.QUEUE_PROCESSOR_MODE || 'api';
const shouldRunQueueProcessorInApi = queueProcessorMode === 'api';
const isExplicitTestEnv = process.env.NODE_ENV === 'test';
const hasJestWorker = typeof process.env.JEST_WORKER_ID !== 'undefined';
// Some hosts can leak JEST_WORKER_ID into runtime env; only honor it outside production.
const isTestRuntime = isExplicitTestEnv || (hasJestWorker && process.env.NODE_ENV !== 'production');

// Route imports
import authRoutes from './routes/auth.js';
import roomRoutes from './routes/rooms.js';
import bookingModule from './modules/booking/index.js';
import enhancedBookingRoutes from './routes/enhancedBookings.js';
import billingModule from './modules/billing/index.js';
import housekeepingRoutes from './routes/housekeeping.js';
import inventoryRoutes from './routes/inventory.js';
import guestRoutes from './routes/guests.js';
import reportRoutes from './routes/reports.js';
import otaRoutes from './routes/ota.js';
import webhookRoutes from './routes/webhooks.js';
import rezOtaWebhookRoutes from './routes/rezOtaWebhooks.js';
import hotelOtaWebhookRoutes from './routes/hotelOtaWebhooks.js';
import adminRoutes from './routes/admin.js';
import adminDashboardRoutes from './routes/adminDashboard.js';
import staffDashboardRoutes from './routes/staffDashboard.js';
import dailyInventoryCheckRoutes from './routes/dailyInventoryCheck.js';
import inventoryNotificationRoutes from './routes/inventoryNotifications.js';
import guestServiceRoutes from './routes/guestServices.js';
import reviewRoutes from './routes/reviews.js';
import maintenanceRoutes from './routes/maintenance.js';
import incidentRoutes from './routes/incidents.js';
import supplyRequestRoutes from './routes/supplyRequests.js';
import communicationRoutes from './routes/communications.js';
import messageTemplateRoutes from './routes/messageTemplates.js';
import contactRoutes from './routes/contact.js';
import billingHistoryRoutes from './routes/billingHistory.js';
import loyaltyRoutes from './routes/loyalty.js';
import adminLoyaltyRoutes from './routes/adminLoyalty.js';
import offerFavoriteRoutes from './routes/offerFavorites.js';
import hotelServicesRoutes from './routes/hotelServices.js';
import adminHotelServicesRoutes from './routes/adminHotelServices.js';
import staffServicesRoutes from './routes/staffServices.js';
import notificationRoutes from './routes/notifications.js';
import settlementNotificationRoutes from './routes/settlementNotifications.js';
import settlementNotificationService from './services/settlementNotificationService.js';
import userPreferencesRoutes from './routes/userPreferences.js';
import hotelSettingsRoutes from './routes/hotelSettings.js';
import settingsRoutes from './routes/settings.js';
import scheduledUpdatesRoutes from './routes/scheduledUpdates.js';
import integrationsRoutes from './routes/integrations.js';
import uploadRoutes from './routes/upload.js';
import digitalKeyRoutes from './routes/digitalKeys.js';
import roomQRRoutes from './routes/roomQR.js';
import staffAlertsRoutes from './routes/staffAlerts.js';
import staffMeetUpRoutes from './routes/staffMeetUp.js';
import meetUpRequestRoutes from './routes/meetUpRequests.js';
import meetUpResourceRoutes from './routes/meetUpResources.js';
import travelAgentRoutes from './routes/travelAgents.js';
import adminTravelDashboardRoutes from './routes/adminTravelDashboard.js';
import dashboardUpdatesRoutes from './routes/dashboardUpdates.js';
import corporateRoutes from './routes/corporate.js';
import roomInventoryRoutes from './routes/roomInventory.js';
import photoUploadRoutes from './routes/photoUpload.js';
import documentUploadRoutes from './routes/documentUpload.js';
import staffTaskRoutes from './routes/staffTasks.js';
import checkoutInventoryRoutes from './routes/checkoutInventory.js';
import dailyRoutineCheckRoutes from './routes/dailyRoutineCheck.js';
import testCheckoutsRoutes from './routes/testCheckouts.js';
import attractionsRoutes from './routes/attractions.js';
import analyticsRoutes from './routes/analytics.js';
import posRoutes from './routes/pos.js';
import revenueManagementRoutes from './routes/revenueManagement.js';
import channelManagerRoutes from './routes/channelManager.js';
import bookingEngineRoutes from './routes/bookingEngine.js';
import financialRoutes from './routes/financial.js';
import requestTemplatesRoutes from './routes/requestTemplates.js';
import requestCategoriesRoutes from './routes/requestCategories.js';
import vendorComparisonRoutes from './routes/vendorComparison.js';
import tapeChartRoutes from './routes/tapeChart.js';
import auditTrailRoutes from './routes/auditTrail.js';
import dashboardRoutes from './routes/dashboard.js';
import roomBlockRoutes from './routes/roomBlocks.js';
import assignmentRulesRoutes from './routes/assignmentRules.js';
// import advancedReservationsRoutes from './routes/advancedReservations.js';
import billingSessionRoutes from './routes/billingSessions.js';
import posReportsRoutes from './routes/posReports.js';
import guestLookupRoutes from './routes/guestLookup.js';
import availabilityRoutes from './routes/availability.js';
import rateManagementRoutes from './routes/rateManagement.js';
import roomTypesRoutes from './routes/roomTypes.js';
import channelManagementRoutes from './routes/channelManagement.js';
import otaWebhookRoutes from './routes/otaWebhooks.js';
import externalBookingsRoutes from './routes/externalBookings.js';
// import revenueOptimizationRoutes from './routes/revenueOptimization.js'; // Temporarily disabled - requires tensorflow
import inventoryManagementRoutes from './routes/inventoryManagement.js';
import mappingRoutes from './routes/mapping.js';
import currencyRoutes from './routes/currency.js';
import languageRoutes from './routes/language.js';
import translationRoutes from './routes/translations.js';
import channelLocalizationRoutes from './routes/channelLocalization.js';
import otaAmendmentRoutes from './routes/otaAmendments.js';
import auditRoutes from './routes/audit.js';
import auditLogRoutes from './routes/auditLog.js';
import laundryRoutes from './routes/laundry.js';
import aiRoutes from './routes/ai.js';
import roomTaxRoutes from './routes/roomTax.js';
import revenueAccountRoutes from './routes/revenueAccounts.js';
import roomChargeRoutes from './routes/roomCharges.js';
import phoneExtensionRoutes from './routes/phoneExtensions.js';
import billMessageRoutes from './routes/billMessages.js';
import hotelAreaRoutes from './routes/hotelAreas.js';
import webSettingsRoutes from './routes/webSettings.js';
import webOptimizationRoutes from './routes/webOptimization.js';
import salutationRoutes from './routes/salutations.js';
import guestImportRoutes from './routes/guestImport.js';
import blacklistRoutes from './routes/blacklist.js';
import vipRoutes from './routes/vip.js';
import customFieldRoutes from './routes/customFields.js';
import userManagementRoutes from './routes/userManagement.js';
import usersRoutes from './routes/users.js';
import loginActivityRoutes from './routes/loginActivity.js';
import userAnalyticsRoutes from './routes/userAnalytics.js';
import serviceTypesRoutes from './routes/serviceTypes.js';
import noShowRoutes from './routes/noShow.js';
import seasonalPricingRoutes from './routes/seasonalPricing.js';
import addOnServicesRoutes from './routes/addOnServices.js';
import dayUseRoutes from './routes/dayUse.js';
import bookingFormRoutes from './routes/bookingForm.js';
import allotmentRoutes from './routes/allotment.js';
import centralizedRatesRoutes from './routes/centralizedRates.js';
import propertyGroupsRoutes from './routes/propertyGroups.js';
import portfolioRoutes from './routes/portfolio.js';
import propertyRoomsRoutes from './routes/propertyRooms.js';
import departmentRoutes from './routes/departments.js';
import reasonRoutes from './routes/reasons.js';
import paymentMethodRoutes from './routes/paymentMethods.js';
import guestManagementRoutes from './routes/guestManagement.js';
import operationalManagementRoutes from './routes/operationalManagement.js';
import apiManagementRoutes from './routes/apiManagement.js';
import discountPricingRoutes from './routes/discountPricing.js';

// Security & Compliance Routes
import gdprRoutes from './routes/gdpr.js';
import credentialRoutes from './routes/credentials.js';
import rolePermissionRoutes from './routes/rolePermissions.js';
import dataPrivacyRoutes from './routes/dataPrivacy.js';
import securityMonitoringRoutes from './routes/securityMonitoring.js';
import checkoutAutomationRoutes from './routes/checkoutAutomation.js';
import laundryTemplatesRoutes from './routes/laundryTemplates.js';
import inventoryAutomationRoutes from './routes/inventoryAutomation.js';
import housekeepingAutomationRoutes from './routes/housekeepingAutomation.js';
import bookingConversationRoutes from './routes/bookingConversations.js';
import waitingListRoutes from './routes/waitingList.js';
import waitlistRoutes from './routes/waitlist.js';
import workflowRoutes from './routes/workflow.js';
import departmentBudgetRoutes from './routes/departmentBudget.js';
import vendorRoutes from './routes/vendors.js';
import purchaseOrderRoutes from './routes/purchaseOrders.js';
import enhancedAnalyticsRoutes from './routes/enhancedAnalytics.js';
import reorderRoutes from './routes/reorder.js';
import stockMovementsRoutes from './routes/stockMovements.js';
import inventoryAnalyticsRoutes from './routes/inventoryAnalytics.js';
import inventoryConsumptionRoutes from './routes/inventoryConsumption.js';
import adminBypassManagementRoutes from './routes/adminBypassManagement.js';
import bypassFinancialAnalyticsRoutes from './routes/bypassFinancialAnalytics.js';
import systemIntegrationRoutes from './routes/systemIntegration.js';
import emailCampaignRoutes from './routes/emailCampaigns.js';
import crmRoutes from './routes/crm.js';
import segmentationRoutes from './routes/segmentation.js';
import personalizationRoutes from './routes/personalization.js';
import extraPersonPricingRoutes from './routes/extraPersonPricing.js';
import settlementsRoutes from './routes/settlements.js';
import posSettlementIntegrationRoutes from './routes/posSettlementIntegration.js';
import approvalRoutes from './routes/approvals.js';

// ── Production Readiness: New routes ──
import featureFlagRoutes from './routes/featureFlags.js';
import nightAuditRoutes from './routes/nightAudit.js';
import cancellationRoutes from './routes/cancellations.js';
import dashboardConfigRoutes from './routes/dashboardConfig.js';

// ── Production Readiness: New middleware ──
import * as tenantIsolation from './middleware/tenantIsolation.js';
import * as securityHeadersMiddleware from './middleware/securityHeaders.js';

// ── Enhanced Audit Logger ──
import { enhancedAuditLogger } from './middleware/auditLogger.enhanced.js';
import AuditLog from './models/AuditLog.js';
const enhancedAuditLoggerMiddleware = enhancedAuditLogger(AuditLog);

const app = express();

// Initialize the application
async function initializeApp() {
    logger.info('🔄 Starting app initialization...');

    // Connect to databases
    try {
        logger.info('🔄 Connecting to MongoDB...');
        await connectDB();
        logger.info('✅ MongoDB connection completed');
    } catch (error) {
        if (process.env.NODE_ENV === 'production') {
            throw error;
        }
        logger.warn('❌ Database connection failed, continuing outside production', {
            error: error.message
        });
    }

    try {
        logger.info('🔄 Connecting to Redis...');
        await connectRedis();
        logger.info('✅ Redis connection completed');
    } catch (error) {
        logger.warn('❌ Redis connection failed, continuing with degraded mode', {
            error: error.message
        });
    }


    try {
        logger.info('🔄 Applying event middleware...');
        await applyEventMiddleware();
        logger.info('✅ Event middleware applied');

        logger.info('🔄 Initializing queue service...');
        await queueService.initialize();
        logger.info('✅ Queue service initialized');

        logger.info('🔄 Starting system health monitoring...');
        const healthMonitorStartupTimeoutMs =
            parseInt(process.env.HEALTH_MONITOR_STARTUP_TIMEOUT_MS || '', 10) ||
            (process.env.NODE_ENV === 'production' ? 15000 : 30000);

        try {
            await Promise.race([
                systemHealthMonitor.start(),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('System health monitoring startup timed out')), healthMonitorStartupTimeoutMs)
                )
            ]);
            logger.info('✅ System health monitoring started');
        } catch (healthMonitorError) {
            // In development, keep startup resilient and avoid hard warnings for slow startup.
            if (process.env.NODE_ENV === 'production') {
                throw healthMonitorError;
            }
            logger.info('⏭️ System health monitoring startup deferred in development', {
                error: healthMonitorError.message,
                timeoutMs: healthMonitorStartupTimeoutMs
            });
        }
    } catch (error) {
        logger.warn('❌ Event middleware, queue service, or health monitoring initialization failed:', {
            error: error.message
        });
    }

    logger.info('✅ App initialization completed successfully');
}

// Start initialization and fail closed in production.
// Wrapped in IIFE for Jest CJS compatibility (top-level await is ESM-only syntax).
if (!isTestRuntime) {
    (async () => {
        try {
            await initializeApp();
        } catch (error) {
            logger.error('App initialization failed:', error);
            process.exit(1);
        }
    })();
}

// Swagger configuration
const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Hotel Management System API',
            version: '1.0.0',
            description: 'A comprehensive hotel management system API',
        },
        servers: [{
            url: process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 4000}/api/v1`,
            description: 'API Server'
        }],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
        },
    },
    apis: ['./src/routes/*.js', './src/models/*.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Trust proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://api.stripe.com", "wss:", "ws:"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'", "https://js.stripe.com"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use(cookieParser());

/** Strip trailing slash so browser Origin matches env URLs consistently. */
function normalizeCorsOrigin(url) {
  if (!url || typeof url !== 'string') return '';
  return url.trim().replace(/\/$/, '');
}

/**
 * Merge comma-separated ALLOWED_ORIGINS with FRONTEND_URL / GUEST_APP_URL so split
 * deploys (e.g. separate Render static + API URLs) work without duplicating every origin.
 */
function buildAllowedOrigins() {
  const fromList = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000')
    .split(',')
    .map(normalizeCorsOrigin)
    .filter(Boolean);
  const fromSingle = [process.env.FRONTEND_URL, process.env.GUEST_APP_URL]
    .map(normalizeCorsOrigin)
    .filter(Boolean);
  return [...new Set([...fromList, ...fromSingle])];
}

const allowedOrigins = buildAllowedOrigins();

app.use(cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, curl, server-to-server)
      if (!origin) {
        return callback(null, true);
      }
      const normalized = normalizeCorsOrigin(origin);
      if (allowedOrigins.includes(normalized)) {
        return callback(null, true);
      }
      if (process.env.NODE_ENV === 'production') {
        logger.warn(`CORS rejected origin: ${origin}`);
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    optionsSuccessStatus: 200
}));

// Rate limiting - very lenient for development
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 1 * 60 * 1000, // 1 minute window
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || (process.env.NODE_ENV === 'production' ? 1000 : 10000), // 10k requests per minute in dev
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Skip rate limiting for health checks and static files
        return req.path === '/health' || req.path.startsWith('/uploads/');
    }
});
app.use('/api/', limiter);

// API version negotiation and compatibility routing (non-breaking v2 -> v1 alias).
app.use('/api', apiVersioning);

// Body parsing middleware
app.use('/api/v1/webhooks', express.raw({
    type: 'application/json'
}));
app.use(express.json({
    limit: '10mb',
    verify: (req, _res, buf) => {
        req.rawBody = buf.toString('utf8');
    }
}));
app.use(express.urlencoded({
    extended: true
}));

// Security sanitization
app.use(mongoSanitize());
app.use(hpp());

// Production Readiness: Enhanced security middleware
if (securityHeadersMiddleware) {
    app.use(securityHeadersMiddleware.requestId);
    app.use(securityHeadersMiddleware.sanitizeMongoOperators);
    app.use(securityHeadersMiddleware.noCacheForSensitive());
}

// Request tracing - assign correlation IDs to all requests
app.use(requestTracing);

// Compression
app.use(compression());

// Logging - Basic request logging
app.use(requestLogger);

// Comprehensive API logging (optimized for performance)
app.use(comprehensiveAPILogger({
    logPayloads: process.env.NODE_ENV === 'production' ? false : true, // Only log payloads in development
    maxPayloadSize: parseInt(process.env.MAX_LOG_PAYLOAD_SIZE) || 10 * 1024, // Reduced to 10KB
    storeOTAPayloads: false, // Disable database storage for performance
    excludePaths: ['/health', '/docs', '/uploads', '/api/v1/staff-dashboard', '/api/v1/admin-dashboard'] // Exclude frequent endpoints
}));

// API Metrics collection middleware (for real-time tracking without WebSockets)
app.use('/api/v1', apiMetricsMiddleware.trackRequest());

// CSRF protection (double-submit cookie pattern)
import { csrfProtection } from './middleware/csrf.js';
app.use('/api/v1', csrfProtection);

// Global pagination bounds (cap limit to 100, page >= 1)
import { paginationBounds } from './middleware/paginationBounds.js';
app.use('/api/v1', paginationBounds);

// Enhanced audit logger for all API routes (compliance: audit trails)
if (enhancedAuditLoggerMiddleware) app.use('/api/v1', enhancedAuditLoggerMiddleware);

// PII protection: mask PII in responses for unauthorized roles, log PII access, sanitize errors
import { piiResponseFilter, piiAccessLogger, piiErrorSanitizer } from './middleware/piiProtection.js';
app.use('/api/v1', piiAccessLogger);
app.use('/api/v1/guests', piiResponseFilter);
app.use('/api/v1/guest-management', piiResponseFilter);
app.use('/api/v1/guest-lookup', piiResponseFilter);
app.use('/api/v1/crm', piiResponseFilter);
app.use('/api/v1/guest-services', piiResponseFilter);
app.use('/api/v1/guest-import', piiResponseFilter);
app.use('/api/v1/bookings', piiResponseFilter);
app.use('/api/v1/travel-agents', piiResponseFilter);

// Maintenance mode middleware (returns 503 for non-health routes when enabled)
app.use(maintenanceMode);

// Block direct public access to sensitive document uploads.
// Serve uploads but exclude sensitive documents directory - documents have authenticated endpoints
app.use('/uploads', (req, res, next) => {
  if (req.path.startsWith('/documents')) {
    return res.status(403).json({ error: 'Access denied. Use the authenticated document endpoints.' });
  }
  next();
}, express.static('uploads'));

// API Documentation
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Health check with real system monitoring
app.get('/health', async (req, res) => {
    try {
        const healthSummary = await systemHealthMonitor.getHealthSummary();
        const wsStats = websocketService.getStats();

        res.status(healthSummary.overall === 'critical' ? 503 : 200).json({
            status: healthSummary.overall === 'healthy' ? 'success' : healthSummary.overall,
            message: healthSummary.overall === 'healthy' ? 'Server is healthy' : `Server status: ${healthSummary.overall}`,
            timestamp: healthSummary.timestamp,
            health: {
                overall: healthSummary.overall,
                alerts: healthSummary.alerts,
                uptime: healthSummary.uptime
            },
            websocket: {
                initialized: wsStats.isInitialized,
                totalConnections: wsStats.totalConnections,
                hotelConnections: wsStats.hotelConnections
            }
        });
    } catch (error) {
        logger.error('Health check failed:', error);
        res.status(503).json({
            status: 'error',
            message: 'Health check failed',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

// WebSocket specific health check
app.get('/health/websocket', (req, res) => {
    const wsStats = websocketService.getStats();
    res.status(200).json({
        status: wsStats.isInitialized ? 'healthy' : 'not_initialized',
        ...wsStats,
        timestamp: new Date().toISOString()
    });
});

// API version capability endpoint.
const sendVersionInfo = (_req, res) => {
    res.status(200).json({
        status: 'success',
        data: getApiVersionInfo()
    });
};
app.get('/api/versions', sendVersionInfo);
app.get('/api/v1/versions', sendVersionInfo);

// Detailed system health endpoints
app.get('/health/detailed', authenticate, authorizePolicy('health', 'staffAccess'), async (req, res) => {
    try {
        const healthData = await systemHealthMonitor.performHealthCheck();
        res.status(200).json({
            status: 'success',
            data: healthData,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Detailed health check failed:', error);
        res.status(500).json({
            status: 'error',
            message: 'Detailed health check failed',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// System alerts endpoint
app.get('/health/alerts', authenticate, authorizePolicy('health', 'staffAccess'), async (req, res) => {
    try {
        const alerts = systemHealthMonitor.getAlerts();
        res.status(200).json({
            status: 'success',
            data: alerts,
            total: alerts.length,
            critical: alerts.filter(a => a.severity === 'critical').length,
            warning: alerts.filter(a => a.severity === 'warning').length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Alerts retrieval failed:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to retrieve alerts',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// System metrics endpoint
app.get('/health/metrics', authenticate, authorizePolicy('health', 'staffAccess'), async (req, res) => {
    try {
        const metrics = systemHealthMonitor.getMetrics();
        res.status(200).json({
            status: 'success',
            data: metrics,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Metrics retrieval failed:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to retrieve metrics',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Queue health endpoint (for retry/DLQ observability and ops checks).
app.get('/health/queue', authenticate, authorizePolicy('health', 'staffAccess'), async (req, res) => {
    try {
        const queueStats = await queueService.getQueueStats();
        res.status(200).json({
            status: 'success',
            data: queueStats,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Queue health retrieval failed:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to retrieve queue health',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Redis caching for read-heavy endpoints
import { createCacheMiddleware, createCacheInvalidationMiddleware } from './middleware/cache.js';
const roomCacheMiddleware = createCacheMiddleware({ ttl: 300, keyGenerator: (req) => `rooms:${req.user?.hotelId}:${req.originalUrl}` });
const roomTypeCacheMiddleware = createCacheMiddleware({ ttl: 3600, keyGenerator: (req) => `roomtypes:${req.user?.hotelId}:${req.originalUrl}` });
const settingsCacheMiddleware = createCacheMiddleware({ ttl: 7200, keyGenerator: (req) => `settings:${req.user?.hotelId}:${req.originalUrl}` });

registerApiRoutes(app, {
    roomCacheMiddleware,
    settingsCacheMiddleware,
    roomTypeCacheMiddleware,
    authRoutes,
    roomRoutes,
    enhancedBookingRoutes,
    noShowRoutes,
    bookingRoutes: bookingModule.routes,
    extraPersonPricingRoutes,
    settlementsRoutes,
    posSettlementIntegrationRoutes,
    approvalRoutes,
    paymentRoutes: billingModule.paymentRoutes,
    housekeepingRoutes,
    inventoryRoutes,
    inventoryAnalyticsRoutes,
    guestRoutes,
    reportRoutes,
    otaRoutes,
    webhookRoutes,
    adminTravelDashboardRoutes,
    adminHotelServicesRoutes,
    adminBypassManagementRoutes,
    bypassFinancialAnalyticsRoutes,
    adminDashboardRoutes,
    adminRoutes,
    systemIntegrationRoutes,
    staffDashboardRoutes,
    staffAlertsRoutes,
    staffMeetUpRoutes,
    dailyInventoryCheckRoutes,
    inventoryNotificationRoutes,
    guestServiceRoutes,
    serviceTypesRoutes,
    reviewRoutes,
    maintenanceRoutes,
    incidentRoutes,
    invoiceRoutes: billingModule.invoiceRoutes,
    supplyRequestRoutes,
    communicationRoutes,
    messageTemplateRoutes,
    bookingConversationRoutes,
    contactRoutes,
    billingHistoryRoutes,
    loyaltyRoutes,
    adminLoyaltyRoutes,
    offerFavoriteRoutes,
    hotelServicesRoutes,
    staffServicesRoutes,
    notificationRoutes,
    settlementNotificationRoutes,
    userPreferencesRoutes,
    hotelSettingsRoutes,
    checkoutInventoryRoutes,
    integrationsRoutes,
    uploadRoutes,
    digitalKeyRoutes,
    roomQRRoutes,
    meetUpRequestRoutes,
    meetUpResourceRoutes,
    travelAgentRoutes,
    dashboardUpdatesRoutes,
    roomInventoryRoutes,
    photoUploadRoutes,
    documentUploadRoutes,
    staffTaskRoutes,
    settingsRoutes,
    scheduledUpdatesRoutes,
    dailyRoutineCheckRoutes,
    testCheckoutsRoutes,
    attractionsRoutes,
    corporateRoutes,
    analyticsRoutes,
    posRoutes,
    revenueManagementRoutes,
    channelManagerRoutes,
    bookingEngineRoutes,
    financialRoutes,
    tapeChartRoutes,
    auditTrailRoutes,
    dashboardRoutes,
    roomBlockRoutes,
    assignmentRulesRoutes,
    waitingListRoutes,
    waitlistRoutes,
    billingSessionRoutes,
    posReportsRoutes,
    guestLookupRoutes,
    availabilityRoutes,
    rateManagementRoutes,
    seasonalPricingRoutes,
    addOnServicesRoutes,
    dayUseRoutes,
    roomTypesRoutes,
    channelManagementRoutes,
    otaWebhookRoutes,
    rezOtaWebhookRoutes,
    hotelOtaWebhookRoutes,
    externalBookingsRoutes,
    inventoryManagementRoutes,
    mappingRoutes,
    currencyRoutes,
    languageRoutes,
    translationRoutes,
    channelLocalizationRoutes,
    otaAmendmentRoutes,
    auditRoutes,
    auditLogRoutes,
    laundryRoutes,
    aiRoutes,
    roomTaxRoutes,
    revenueAccountRoutes,
    roomChargeRoutes,
    phoneExtensionRoutes,
    billMessageRoutes,
    hotelAreaRoutes,
    webSettingsRoutes,
    webOptimizationRoutes,
    salutationRoutes,
    guestImportRoutes,
    blacklistRoutes,
    vipRoutes,
    customFieldRoutes,
    userManagementRoutes,
    usersRoutes,
    loginActivityRoutes,
    userAnalyticsRoutes,
    bookingFormRoutes,
    allotmentRoutes,
    centralizedRatesRoutes,
    propertyGroupsRoutes,
    portfolioRoutes,
    propertyRoomsRoutes,
    departmentRoutes,
    reasonRoutes,
    paymentMethodRoutes,
    guestManagementRoutes,
    operationalManagementRoutes,
    apiManagementRoutes,
    gdprRoutes,
    credentialRoutes,
    rolePermissionRoutes,
    dataPrivacyRoutes,
    securityMonitoringRoutes,
    checkoutAutomationRoutes,
    laundryTemplatesRoutes,
    inventoryAutomationRoutes,
    housekeepingAutomationRoutes,
    workflowRoutes,
    departmentBudgetRoutes,
    vendorRoutes,
    purchaseOrderRoutes,
    enhancedAnalyticsRoutes,
    requestTemplatesRoutes,
    requestCategoriesRoutes,
    vendorComparisonRoutes,
    reorderRoutes,
    stockMovementsRoutes,
    inventoryConsumptionRoutes,
    emailCampaignRoutes,
    crmRoutes,
    segmentationRoutes,
    personalizationRoutes,
    featureFlagRoutes,
    nightAuditRoutes,
    cancellationRoutes,
    dashboardConfigRoutes,
    discountPricingRoutes
});

// Serve widget.js for external websites
app.get('/widget.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    // RESTRICT CORS - use env var ALLOWED_WIDGET_ORIGINS (comma-separated) or specific default
    const allowedOrigins = (process.env.ALLOWED_WIDGET_ORIGINS || 'https://hotel.example.com,https://booking.example.com').split(',');
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Serve from frontend public directory
    const widgetPath = path.join(process.cwd(), 'frontend', 'public', 'widget.js');
    res.sendFile(widgetPath, (err) => {
        if (err) {
            logger.error('Error serving widget.js:', err);
            res.status(404).send('Widget script not found');
        }
    });
});

app.all('*', (req, res) => {
    res.status(404).json({
        status: 'error',
        message: `Can't find ${req.originalUrl} on this server`,
    });
});

// PII error sanitizer: strip PII from error messages before they reach clients
app.use(piiErrorSanitizer);

// Global error handler
app.use(errorHandler);

// Validate required environment variables before starting server
if (!isTestRuntime) {
    validateEnvironment();
}

const PORT = process.env.PORT || 4000;

async function waitForMongoConnection(timeoutMs = 30000) {
    if (mongoose.connection.readyState === 1) return true;
    await new Promise((resolve) => {
        const timer = setTimeout(resolve, timeoutMs);
        mongoose.connection.once('connected', () => {
            clearTimeout(timer);
            resolve();
        });
    });
    return mongoose.connection.readyState === 1;
}

let server = null;
if (!isTestRuntime) {
logger.info('Startup runtime mode', {
    nodeEnv: process.env.NODE_ENV,
    isTestRuntime,
    hasJestWorker,
    port: PORT
});
server = app.listen(PORT, async () => {
    logger.info(`🚀 Server running on port ${PORT}`);
    logger.info(`📚 API Documentation available at http://localhost:${PORT}/docs`);
    logger.info('✅ Server startup completed successfully');

    // Initialize services after server starts
    // RE-ENABLED FOR NOTIFICATION AUTOMATION
    try {
        logger.info('🔄 Starting post-server services initialization...');

        // Initialize WebSocket server for real-time notifications
        logger.info('🔄 Initializing WebSocket server...');
        websocketService.initialize(server);
        logger.info('✅ WebSocket server initialized');

        const mongoReady = await waitForMongoConnection(
            parseInt(process.env.MONGO_STARTUP_WAIT_MS || '', 10) || 30000
        );
        if (!mongoReady) {
            logger.warn('⚠️ MongoDB not connected yet. Deferring DB-dependent schedulers until connection is available.');
        }

        if (mongoReady) {
            logger.info('🔄 Starting inventory scheduler...');
            inventoryScheduler.start();
            logger.info('✅ Inventory scheduler started');

            // Initialize notification scheduler for hotel management automation
            logger.info('🔄 Initializing notification scheduler...');
            NotificationScheduler.initializeScheduledJobs();
            logger.info('✅ Notification scheduler initialized');

            // Initialize settlement notification service
            logger.info('🔄 Initializing settlement notification service...');
            // Settlement notification service auto-starts with cron jobs
            logger.info('✅ Settlement notification service initialized');

            // Start reorder job
            logger.info('🔄 Starting reorder job...');
            reorderJob.start();
            reorderJob.startWeeklySummary();
            logger.info('✅ Reorder job started');

            // Start scheduled updates cron job (Feature 1 - Phase 5.6)
            logger.info('🔄 Starting scheduled updates job...');
            startScheduledUpdatesJob();
            logger.info('✅ Scheduled updates job started (runs every 5 minutes)');

            // Start night audit cron job (runs at 2:00 AM daily)
            logger.info('🔄 Starting night audit job...');
            scheduleNightAudit();
            logger.info('✅ Night audit job started (runs at 2:00 AM daily)');

            logger.info('🔄 Starting loyalty maintenance job...');
            loyaltyMaintenanceJob.start();
            logger.info('✅ Loyalty maintenance job started');
            logger.info('🔄 Starting loyalty event queue...');
            await loyaltyEventQueueService.initialize();
            loyaltyEventQueueService.start();
            logger.info('✅ Loyalty event queue started');

            // Start backup scheduler
            logger.info('Starting backup scheduler...');
            try {
              const backupService = (await import('./services/backupService.js')).default;
              if (backupService && typeof backupService.startScheduler === 'function') {
                backupService.startScheduler();
                logger.info('Backup scheduler started');
              } else if (backupService && typeof backupService.scheduleBackups === 'function') {
                backupService.scheduleBackups();
                logger.info('Backup scheduler started');
              } else {
                logger.info('Backup service available but no scheduler method found');
              }
            } catch (error) {
              logger.warn('Backup scheduler initialization failed (non-critical):', error.message);
            }
        }

        // Start pricing scheduler (already auto-starts, but ensure it's initialized)
        // if (!pricingScheduler.isRunning) {
        //   pricingScheduler.start();
        // } // Temporarily disabled - requires tensorflow

        if (shouldRunQueueProcessorInApi) {
            try {
                logger.info('Starting queue processing in API mode...');
                await queueService.startProcessing();
                logger.info('Queue processing started in API mode');
            } catch (error) {
                logger.warn('Queue processing failed to start in API mode', {
                    error: error.message
                });
            }
        } else {
            logger.info('Queue processing skipped in API mode', {
                queueProcessorMode
            });
        }

        try {
            logger.info('🔄 Starting booking workflow engine...');
            await bookingWorkflowEngine.start();
            logger.info('✅ Booking workflow engine started');
        } catch (error) {
            logger.warn('❌ Booking workflow engine failed to start:', {
                error: error.message
            });
        }

        try {
            logger.info('🔄 Starting payload retention service...');
            payloadRetentionService.start();
            logger.info('✅ Payload retention service started');
        } catch (error) {
            logger.warn('❌ Payload retention service failed to start:', {
                error: error.message
            });
        }

        try {
            logger.info('🔄 Starting OTA payload service cleanup...');
            otaPayloadService.startCleanup();
            logger.info('✅ OTA payload service cleanup started');
        } catch (error) {
            logger.warn('❌ OTA payload service cleanup failed to start:', {
                error: error.message
            });
        }

        // Final success message
        logger.info('🚀 All services started successfully - Hotel Management System is ready!', {
            port: PORT,
            environment: process.env.NODE_ENV,
            features: {
                encryption: true,
                gdpr: true,
                rolePermissions: true,
                securityMonitoring: true,
                credentialManagement: true
            }
        });
    } catch (error) {
        logger.error('Failed to start services:', error);
        logger.warn('Server remains running in degraded mode while post-start services recover.');
    }
    // END OF POST-SERVER SERVICES INITIALIZATION
});
}

// ── Production Readiness: Enhanced Graceful Shutdown ──
// Ensures in-flight requests complete, DB/Redis connections close properly
// Centralized graceful shutdown for API and background services.
if (server) {
    setupGracefulShutdown(server, {
        logger,
        mongoose,
        redis: getRedisClient(),
        beforeExit: async () => {
            inventoryScheduler.stop();
            reorderJob.stop();
            stopScheduledUpdatesJob();
            bookingWorkflowEngine.stop();
            otaPayloadService.stopCleanup();
            systemHealthMonitor.stop();
            await queueService.stopProcessing();
            logger.info('Background services stopped');
        }
    });
}

// Log unhandled rejections but don't crash
process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Promise Rejection:', reason);
});

export default app;

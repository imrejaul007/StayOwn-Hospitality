"use strict";
/**
 * rez-stayown-service
 * StayOwn Hotel OTA Service - ReZ's own hotel booking platform
 *
 * Features:
 * - Hotel search and booking (OTA)
 * - Room QR generation for guest check-in
 * - Service charges and checkout billing
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const express_mongo_sanitize_1 = __importDefault(require("express-mongo-sanitize"));
const morgan_1 = __importDefault(require("morgan"));
// Sentry initialization
const Sentry = __importStar(require("@sentry/node"));
Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
});
// MongoDB connection
const mongodb_auth_1 = require("./config/mongodb-auth");
// Routes
const stayownRoutes_1 = __importDefault(require("./routes/stayownRoutes"));
const room_qr_routes_1 = __importDefault(require("./routes/room-qr-routes"));
const pre_arrival_routes_1 = __importDefault(require("./routes/pre-arrival.routes"));
const room_service_hub_routes_1 = __importDefault(require("./routes/room-service-hub.routes"));
const merchant_qr_routes_1 = __importDefault(require("./routes/merchant-qr.routes"));
const bulk_qr_routes_1 = __importDefault(require("./routes/bulk-qr.routes"));
const pms_webhooks_routes_1 = __importDefault(require("./routes/pms-webhooks.routes"));
// Services
const room_qr_1 = require("./room-qr");
const app = (0, express_1.default)();
const PORT = parseInt(process.env.PORT || '4015', 10);
// ─── Middleware ───────────────────────────────────────────────────────────────
app.set('trust proxy', 1);
// Security headers
app.use((0, helmet_1.default)({
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
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error(`CORS: origin ${origin} not allowed`));
        }
    },
    credentials: true,
}));
// Body parsing
app.use(express_1.default.json({ limit: '1mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
// MongoDB sanitize (prevent NoSQL injection)
app.use((0, express_mongo_sanitize_1.default)());
// Request logging
app.use((0, morgan_1.default)(':method :url :status :res[content-length] - :response-time ms'));
// ─── Health Endpoints ─────────────────────────────────────────────────────────
app.get('/health/live', (_req, res) => {
    res.json({ status: 'ok', service: 'rez-stayown-service' });
});
app.get('/health/ready', async (_req, res) => {
    const checks = {};
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
    }
    catch (err) {
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
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        service: 'rez-stayown-service',
        version: process.env.SERVICE_VERSION || '1.0.0',
        timestamp: new Date().toISOString(),
    });
});
app.get('/health/detailed', async (_req, res) => {
    const checks = {};
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
    }
    catch (err) {
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
app.use('/api/hotels', stayownRoutes_1.default);
// Room QR routes (generation, validation, charges, checkout)
app.use('/api/room-qr', room_qr_routes_1.default);
// Pre-arrival routes
app.use('/api/pre-arrival', pre_arrival_routes_1.default);
// Room Service Hub routes (for consumer app)
app.use('/api/room-service', room_service_hub_routes_1.default);
// Merchant QR routes (for staff scanning)
app.use('/api/merchant', merchant_qr_routes_1.default);
// Bulk QR routes (for batch operations)
app.use('/api/room-qr/bulk', bulk_qr_routes_1.default);
// Room QR Manager routes (room-bound system)
app.use('/api/room-qr/manager', require('./routes/room-qr-manager.routes').default);
// PMS Webhooks (room assignment from Hotel-PMS)
app.use('/api/webhooks/pms', pms_webhooks_routes_1.default);
// ─── Webhook Endpoints ────────────────────────────────────────────────────────
// Room service webhook from Hotel OTA
app.post('/api/webhooks/room-service', async (req, res) => {
    try {
        const { event, bookingId, hotelId, roomId, data } = req.body;
        // Verify webhook secret
        const webhookSecret = req.headers['x-webhook-secret'];
        const expectedSecret = process.env.ROOM_QR_WEBHOOK_SECRET;
        if (expectedSecret && webhookSecret !== expectedSecret) {
            return res.status(401).json({ success: false, message: 'Invalid webhook secret' });
        }
        await (0, room_qr_1.handleRoomServiceWebhook)({ event, bookingId, hotelId, roomId, data });
        res.json({ success: true, message: 'Webhook processed' });
    }
    catch (error) {
        console.error('[Webhook] Room service error:', error);
        res.status(500).json({ success: false, message: 'Webhook processing failed' });
    }
});
// ─── Error Handler ───────────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
    console.error('[Error]', err.message);
    Sentry.captureException(err);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
});
// 404 handler
app.use((_req, res) => {
    res.status(404).json({ success: false, error: 'Not found' });
});
// ─── Server Startup ───────────────────────────────────────────────────────────
async function startServer() {
    console.log('[Startup] Starting rez-stayown-service...');
    try {
        // Connect to MongoDB
        console.log('[Startup] Connecting to MongoDB...');
        await (0, mongodb_auth_1.connectMongoDB)();
        console.log('[Startup] MongoDB connected');
        // Start server
        const server = app.listen(PORT, () => {
            console.log(`[Startup] rez-stayown-service running on port ${PORT}`);
            console.log(`[Startup] Environment: ${process.env.NODE_ENV || 'development'}`);
        });
        // Graceful shutdown
        const shutdown = async (signal) => {
            console.log(`[Shutdown] Received ${signal}, shutting down gracefully...`);
            server.close(async () => {
                console.log('[Shutdown] HTTP server closed');
                try {
                    await (0, mongodb_auth_1.disconnectMongoDB)();
                    console.log('[Shutdown] MongoDB disconnected');
                }
                catch (err) {
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
    }
    catch (error) {
        console.error('[Startup] Failed to start server:', error);
        process.exit(1);
    }
}
startServer();
exports.default = app;
//# sourceMappingURL=index.js.map
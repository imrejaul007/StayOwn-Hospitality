"use strict";
/**
 * Authentication middleware for Channel Manager Service
 * Validates internal service tokens and hotel manager tokens
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateToken = authenticateToken;
exports.requireRole = requireRole;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || process.env.INTERNAL_JWT_SECRET;
function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;
    const serviceToken = req.headers['x-service-token'];
    // Check for internal service token first
    if (serviceToken) {
        const expectedToken = process.env.INTERNAL_SERVICE_TOKEN;
        if (expectedToken && serviceToken === expectedToken) {
            req.user = { id: 'internal-service', type: 'service' };
            return next();
        }
    }
    // Check for JWT token
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        if (!token) {
            res.status(401).json({ error: 'No token provided' });
            return;
        }
        if (!JWT_SECRET) {
            // Fail closed if no JWT secret configured
            res.status(500).json({ error: 'Server misconfiguration' });
            return;
        }
        try {
            const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
            req.user = {
                id: decoded.sub || decoded.userId,
                hotelId: decoded.hotelId,
                role: decoded.role,
                type: 'user',
            };
            return next();
        }
        catch (error) {
            res.status(401).json({ error: 'Invalid or expired token' });
            return;
        }
    }
    res.status(401).json({ error: 'Authentication required' });
}
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        if (req.user.type === 'service') {
            // Internal services bypass role checks
            return next();
        }
        if (roles.length > 0 && req.user.role && !roles.includes(req.user.role)) {
            res.status(403).json({ error: 'Insufficient permissions' });
            return;
        }
        next();
    };
}
//# sourceMappingURL=auth.js.map
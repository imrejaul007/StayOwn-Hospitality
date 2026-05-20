/**
 * REZ Room QR Service - Enhanced Features
 *
 * ADDED FEATURES:
 * 1. Rate Limiting
 * 2. Redis Caching
 * 3. ML Room Recommendations
 * 4. Predictive Analytics
 * 5. Support Integration
 * 6. WebSocket
 * 7. Full RABTUL Integration
 */

import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import axios from 'axios';
import rateLimit from 'express-rate-limit';
import Redis from 'ioredis';
import { Server as SocketIOServer } from 'socket.io';

// RABTUL Service Integration
import { auth, payment, wallet, notifications, agent, care, mind, intelligence, delivery, merchant } from '../integrations/rabtulIntegration';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  lazyConnect: true
});

redis.on('error', (err) => console.error('Redis error:', err.message));
redis.on('connect', () => console.log('Redis connected'));

let io: SocketIOServer;

// ============================================
// RATE LIMITING
// ============================================

export const scanLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Too many scan requests' }
});

export const orderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 50,
  message: { error: 'Too many order requests' }
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { error: 'Rate limit exceeded' }
});

// ============================================
// CACHE LAYER
// ============================================

class Cache {
  async get(key: string): Promise<any | null> {
    try {
      const data = await redis.get(`room-qr:${key}`);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  async set(key: string, data: any, ttl = 300): Promise<void> {
    try {
      await redis.setex(`room-qr:${key}`, ttl, JSON.stringify(data));
    } catch {}
  }

  async del(key: string): Promise<void> {
    try {
      await redis.del(`room-qr:${key}`);
    } catch {}
  }

  async invalidate(pattern: string): Promise<void> {
    try {
      const keys = await redis.keys(`room-qr:${pattern}*`);
      if (keys.length > 0) await redis.del(...keys);
    } catch {}
  }
}

export const cache = new Cache();

// ============================================
// MODELS
// ============================================

// Room QR Analytics
const RoomQRAnalytics = mongoose.model('RoomQRAnalytics', new mongoose.Schema({
  hotel_id: String,
  room_id: String,
  date: Date,
  scans: { type: Number, default: 0 },
  orders: { type: Number, default: 0 },
  revenue: { type: Number, default: 0 },
  avg_order_value: { type: Number, default: 0 },
  top_services: [String]
}));

// Service Request
const ServiceRequest = mongoose.model('ServiceRequest', new mongoose.Schema({
  request_id: { type: String, required: true, unique: true },
  hotel_id: String,
  room_id: String,
  guest_id: String,
  guest_name: String,
  guest_phone: String,
  request_type: {
    type: String,
    enum: ['housekeeping', 'room_service', 'maintenance', 'concierge', 'checkout']
  },
  description: String,
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  status: {
    type: String,
    enum: ['submitted', 'assigned', 'in_progress', 'completed', 'cancelled'],
    default: 'submitted'
  },
  assigned_to: String,
  notes: String,
  timeline: [{ status: String, note: String, timestamp: Date }],
  created_at: { type: Date, default: Date.now }
}));

// Guest Preference
const GuestPreference = mongoose.model('GuestPreference', new mongoose.Schema({
  guest_id: String,
  hotel_id: String,
  preferences: {
    room_temp: Number,
    pillow_type: String,
    dietary: [String],
    preferred_services: [String]
  },
  feedback_history: [{
    rating: Number,
    comment: String,
    date: Date
  }],
  updated_at: { type: Date, default: Date.now }
}));

// ============================================
// ROUTES
// ============================================

const router = express.Router();

// ============================================
// ML ROOM RECOMMENDATIONS
// ============================================

/**
 * GET /api/rooms/recommend
 * Get personalized room recommendations
 */
router.get('/rooms/recommend', async (req: Request, res: Response) => {
  const { hotel_id, guest_id, preferences } = req.query;

  // Try cache
  const cacheKey = `recommend:${hotel_id}:${guest_id}`;
  const cached = await cache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  // Get guest preferences
  let guestPrefs = null;
  if (guest_id) {
    guestPrefs = await GuestPreference.findOne({ guest_id, hotel_id });
  }

  // Get available rooms
  const rooms = await mongoose.model('Room').find({
    hotel_id,
    status: 'available'
  });

  // Score rooms based on preferences
  const scored = rooms.map(room => {
    let score = 50; // Base score

    // Room type match
    if (guestPrefs?.preferences?.preferred_services?.includes(room.type)) {
      score += 20;
    }

    // Floor preference
    if (guestPrefs?.preferences?.room_temp) {
      score += 15; // Quiet room
    }

    // Room features
    if (room.amenities) {
      score += room.amenities.length * 2;
    }

    return { ...room.toObject(), score };
  });

  // ML enhancement
  let mlRecs = null;
  try {
    const mlResponse = await axios.post(`${MIND_API}/api/recommend/rooms`, {
      guest_id,
      hotel_id,
      rooms: scored,
      preferences: guestPrefs?.preferences
    });
    mlRecs = mlResponse.data;
  } catch {}

  const result = {
    recommendations: scored.sort((a, b) => b.score - a.score).slice(0, 5),
    ml_enhancements: mlRecs
  };

  await cache.set(cacheKey, result, 600);
  res.json(result);
});

/**
 * POST /api/rooms/preferences
 * Save guest preferences
 */
router.post('/rooms/preferences', async (req: Request, res: Response) => {
  const { guest_id, hotel_id, preferences } = req.body;

  const pref = await GuestPreference.findOneAndUpdate(
    { guest_id, hotel_id },
    { preferences, updated_at: new Date() },
    { upsert: true, new: true }
  );

  // Invalidate cache
  await cache.del(`recommend:${hotel_id}:${guest_id}`);

  res.json({ success: true, preferences: pref });
});

// ============================================
// SERVICE REQUESTS
// ============================================

/**
 * POST /api/service-request
 * Create a service request
 */
router.post('/service-request', async (req: Request, res: Response) => {
  const {
    hotel_id, room_id, guest_id, guest_name, guest_phone,
    request_type, description, priority
  } = req.body;

  const request_id = `REQ-${Date.now()}`;

  const request = new ServiceRequest({
    request_id,
    hotel_id,
    room_id,
    guest_id,
    guest_name,
    guest_phone,
    request_type,
    description,
    priority: priority || 'medium',
    timeline: [{
      status: 'submitted',
      note: 'Request submitted',
      timestamp: new Date()
    }]
  });

  await request.save();

  // Emit WebSocket update
  if (io) {
    io.to(`hotel:${hotel_id}`).emit('service_request', { request_id, type: request_type });
  }

  // Send notification
  try {
    await axios.post(`${CARE_API}/api/auto-tickets`, {
      title: `Room Service Request - ${request_type}`,
      description: `Room ${room_id}: ${description}`,
      customer_id: guest_id,
      category: 'hotel_room_service',
      priority: priority || 'medium',
      platform: 'room_qr',
      metadata: { hotel_id, room_id, request_id }
    });
  } catch {}

  res.json({
    success: true,
    request_id,
    status: 'submitted',
    estimated_time: request_type === 'housekeeping' ? '30 mins' : '1 hour'
  });
});

/**
 * GET /api/service-request/:id
 * Get request status
 */
router.get('/service-request/:id', async (req: Request, res: Response) => {
  const request = await ServiceRequest.findOne({ request_id: req.params.id });

  if (!request) {
    return res.status(404).json({ error: 'Request not found' });
  }

  res.json(request);
});

/**
 * GET /api/service-requests
 * List service requests
 */
router.get('/service-requests', async (req: Request, res: Response) => {
  const { hotel_id, status, request_type, page = 1, limit = 20 } = req.query;

  const query: any = {};
  if (hotel_id) query.hotel_id = hotel_id;
  if (status) query.status = status;
  if (request_type) query.request_type = request_type;

  const requests = await ServiceRequest.find(query)
    .sort({ created_at: -1 })
    .skip((Number(page) - 1) * Number(limit))
    .limit(Number(limit));

  const total = await ServiceRequest.countDocuments(query);

  res.json({ requests, total, page: Number(page), limit: Number(limit) });
});

/**
 * POST /api/service-request/:id/assign
 * Assign service request
 */
router.post('/service-request/:id/assign', async (req: Request, res: Response) => {
  const { assigned_to } = req.body;

  const request = await ServiceRequest.findOneAndUpdate(
    { request_id: req.params.id },
    {
      assigned_to,
      status: 'assigned',
      $push: {
        timeline: {
          status: 'assigned',
          note: `Assigned to ${assigned_to}`,
          timestamp: new Date()
        }
      }
    },
    { new: true }
  );

  if (!request) {
    return res.status(404).json({ error: 'Request not found' });
  }

  // Notify guest
  try {
    await axios.post(`${CARE_API}/api/notifications/send`, {
      user_id: request.guest_id,
      title: 'Request Assigned',
      body: `Your ${request.request_type} request has been assigned`,
      data: { request_id: request.request_id }
    });
  } catch {}

  res.json({ success: true, request });
});

// ============================================
// ANALYTICS
// ============================================

/**
 * GET /api/analytics/room-qr
 * Get Room QR analytics
 */
router.get('/analytics/room-qr', async (req: Request, res: Response) => {
  const { hotel_id, from, to } = req.query;

  const match: any = {};
  if (hotel_id) match.hotel_id = hotel_id;
  if (from && to) {
    match.date = { $gte: new Date(from as string), $lte: new Date(to as string) };
  }

  const [total, byDate, byService] = await Promise.all([
    RoomQRAnalytics.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total_scans: { $sum: '$scans' },
          total_orders: { $sum: '$orders' },
          total_revenue: { $sum: '$revenue' },
          avg_order_value: { $avg: '$avg_order_value' }
        }
      }
    ]),
    RoomQRAnalytics.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          scans: { $sum: '$scans' },
          orders: { $sum: '$orders' },
          revenue: { $sum: '$revenue' }
        }
      },
      { $sort: { _id: -1 } },
      { $limit: 30 }
    ]),
    RoomQRAnalytics.aggregate([
      { $match: match },
      { $unwind: '$top_services' },
      { $group: { _id: '$top_services', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ])
  ]);

  // ML predictions
  let predictions = null;
  try {
    const mlResponse = await axios.post(`${INTELLIGENCE_API}/api/predict/room-qr-metrics`, {
      hotel_id,
      historical: total[0],
      forecast_days: 7
    });
    predictions = mlResponse.data;
  } catch {}

  res.json({
    summary: total[0] || {
      total_scans: 0,
      total_orders: 0,
      total_revenue: 0,
      avg_order_value: 0
    },
    trends: byDate,
    top_services: byService,
    ml_predictions: predictions
  });
});

/**
 * GET /api/analytics/guest-insights
 * Get guest insights
 */
router.get('/analytics/guest-insights', async (req: Request, res: Response) => {
  const { hotel_id } = req.query;

  const preferences = await GuestPreference.find({ hotel_id });

  const insights = {
    total_guests: preferences.length,
    avg_preferences: {
      dietary: 0,
      pillow_type: {}
    },
    common_requests: [],
    satisfaction_trend: []
  };

  // Calculate dietary preferences
  const dietaryCount: any = {};
  const pillowCount: any = {};

  for (const pref of preferences) {
    if (pref.preferences?.dietary) {
      for (const d of pref.preferences.dietary) {
        dietaryCount[d] = (dietaryCount[d] || 0) + 1;
      }
    }
    if (pref.preferences?.pillow_type) {
      pillowCount[pref.preferences.pillow_type] = (pillowCount[pref.preferences.pillow_type] || 0) + 1;
    }
  }

  insights.avg_preferences = {
    dietary: dietaryCount,
    pillow_type: pillowCount
  };

  res.json(insights);
});

// ============================================
// SUPPORT
// ============================================

/**
 * POST /api/support/ticket
 * Create support ticket
 */
router.post('/support/ticket', async (req: Request, res: Response) => {
  const { hotel_id, room_id, guest_id, guest_name, guest_phone, issue_type, description } = req.body;

  try {
    const ticket = await axios.post(`${CARE_API}/api/auto-tickets`, {
      title: `Room QR Support - ${issue_type}`,
      description: `${description}\n\nHotel: ${hotel_id}\nRoom: ${room_id}`,
      customer_id: guest_id,
      customer_name: guest_name,
      customer_phone: guest_phone,
      category: 'room_qr',
      priority: 'medium',
      platform: 'room_qr',
      metadata: { hotel_id, room_id }
    });

    res.json({
      success: true,
      ticket_id: ticket.data.data._id
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

// ============================================
// WEBSOCKET
// ============================================

export function initWebSocket(server: any) {
  io = new SocketIOServer(server, { cors: { origin: '*' } });

  io.on('connection', (socket) => {
    socket.on('join', (data: { hotel_id: string; room_id?: string }) => {
      socket.join(`hotel:${data.hotel_id}`);
      if (data.room_id) {
        socket.join(`room:${data.room_id}`);
      }
    });

    socket.on('subscribe', (data: { request_id: string }) => {
      socket.join(`request:${data.request_id}`);
    });
  });

  return io;
}

export function notifyServiceUpdate(hotel_id: string, data: any) {
  if (io) {
    io.to(`hotel:${hotel_id}`).emit('service_update', data);
  }
}

export { router };

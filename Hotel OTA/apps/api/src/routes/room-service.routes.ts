import { Router, Request, Response } from 'express';
import axios from 'axios';
import { prisma } from '../config/database';
import { authenticateUser, authenticateHotelStaff } from '../middleware/auth';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { PushNotificationService } from '../services/notifications/push-notification.service';

const router = Router();

// Apply auth middleware
// router.use(authMiddleware); // FIX: Use per-route auth instead

/**
 * Room Service Request Types
 */
export type ServiceType =
  | 'housekeeping'
  | 'room_service'
  | 'laundry'
  | 'maintenance'
  | 'concierge'
  | 'spa'
  | 'transport'
  | 'fitness';

export interface RoomServiceItem {
  name: string;
  quantity: number;
  pricePaise: number;
}

export interface RoomServiceRequest {
  id: string;
  bookingId: string;
  hotelId: string;
  roomId: string;
  roomNumber: string;
  guestName: string;
  serviceType: ServiceType;
  description?: string;
  items?: RoomServiceItem[];
  totalAmountPaise: number;
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'now';
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

/**
 * Create a room service request
 * POST /api/room-service
 */
router.post('/', authenticateUser, async (req: Request, res: Response) => {
  try {
    const {
      bookingId,
      roomId,
      serviceType,
      description,
      items,
      priority = 'now'
    } = req.body;

    const userId = req.user?.id;

    if (!bookingId || !roomId || !serviceType) {
      return res.status(400).json({
        success: false,
        message: 'bookingId, roomId, and serviceType are required'
      });
    }

    // Verify booking exists and is active
    const booking = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        status: { in: ['confirmed', 'checked_in'] }
      },
      include: {
        user: { select: { id: true, fullName: true, phone: true, fcmToken: true } },
        hotel: { select: { id: true, name: true } }
      }
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found or not active'
      });
    }

    const hotelId = booking.hotelId;

    // Calculate total amount from items
    const totalAmountPaise = items?.reduce(
      (sum: number, item: RoomServiceItem) => sum + (item.pricePaise * item.quantity),
      0
    ) || 0;

    // Get room details - use RoomType to find room number
    const bookingWithRoom = await prisma.booking.findFirst({
      where: { id: bookingId },
      include: {
        roomType: { select: { name: true } }
      }
    });

    // Create service request
    const serviceRequest = await prisma.roomServiceRequest.create({
      data: {
        bookingId,
        hotelId,
        roomId,
        roomNumber: 'N/A',
        guestName: booking.user?.fullName || booking.guestName || 'Guest',
        serviceType,
        description,
        items: items ? JSON.stringify(items) : undefined,
        totalAmountPaise,
        status: 'pending',
        priority,
        requestedBy: userId,
        guestUserId: booking.userId
      }
    });

    logger.info('Room service request created', {
      requestId: serviceRequest.id,
      bookingId,
      serviceType,
      hotelId
    });

    // Notify hotel staff of new request (Socket.IO in hotel-panel handles real-time)
    PushNotificationService.notifyHotelStaffNewRequest({
      hotelId,
      requestId: serviceRequest.id,
      serviceType,
      roomNumber: serviceRequest.roomNumber,
      priority,
      description,
    });

    // Confirm request to guest
    PushNotificationService.sendToUser(
      booking.userId,
      `${serviceType.replace('_', ' ')} request submitted`,
      `Your ${serviceType.replace('_', ' ')} request for Room ${serviceRequest.roomNumber} has been received.`,
      { type: 'room_service', request_id: serviceRequest.id, status: 'pending' }
    ).catch(() => {});

    // Track engagement for REZ coin rewards
    trackRoomEngagement({
      otaUserId: booking.userId,
      bookingId,
      hotelId,
      roomId,
      roomNumber: serviceRequest.roomNumber,
      eventType: 'service_requested',
      metadata: { serviceType, priority },
    }).catch(() => {});

    res.status(201).json({
      success: true,
      data: {
        id: serviceRequest.id,
        bookingId: serviceRequest.bookingId,
        serviceType: serviceRequest.serviceType,
        status: serviceRequest.status,
        totalAmountPaise: serviceRequest.totalAmountPaise,
        createdAt: serviceRequest.createdAt
      }
    });
  } catch (error: any) {
    logger.error('Failed to create room service request', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to create service request'
    });
  }
});

/**
 * Get room service requests for current hotel
 * GET /api/room-service
 */
router.get('/', authenticateHotelStaff, async (req: Request, res: Response) => {
  try {
    const hotelId = req.user?.hotelId;
    const { status, roomId, bookingId, page = '1', limit = '20' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const skip = (pageNum - 1) * limitNum;

    const where: any = { hotelId };
    if (status) where.status = status;
    if (roomId) where.roomId = roomId;
    if (bookingId) where.bookingId = bookingId;

    const [requests, total] = await Promise.all([
      prisma.roomServiceRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum
      }),
      prisma.roomServiceRequest.count({ where })
    ]);

    // Parse items JSON
    const parsedRequests = requests.map(req => ({
      ...req,
      items: req.items ? JSON.parse(req.items as string) : []
    }));

    res.json({
      success: true,
      data: {
        requests: parsedRequests,
        page: pageNum,
        limit: limitNum,
        totalCount: total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error: any) {
    logger.error('Failed to fetch room service requests', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch service requests'
    });
  }
});

/**
 * Get a specific room service request
 * GET /api/room-service/:id
 */
router.get('/:id', authenticateHotelStaff, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const hotelId = req.user?.hotelId;

    const request = await prisma.roomServiceRequest.findFirst({
      where: { id, hotelId }
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Service request not found'
      });
    }

    res.json({
      success: true,
      data: {
        ...request,
        items: request.items ? JSON.parse(request.items as string) : []
      }
    });
  } catch (error: any) {
    logger.error('Failed to fetch room service request', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch service request'
    });
  }
});

/**
 * Update room service request status
 * PATCH /api/room-service/:id
 */
router.patch('/:id', authenticateHotelStaff, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const hotelId = req.user?.hotelId;
    const { status, assignedTo } = req.body;

    const request = await prisma.roomServiceRequest.findFirst({
      where: { id, hotelId }
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Service request not found'
      });
    }

    const updateData: any = { status };
    if (assignedTo) updateData.assignedTo = assignedTo;
    if (status === 'completed') updateData.completedAt = new Date();

    const updated = await prisma.roomServiceRequest.update({
      where: { id },
      data: updateData
    });

    logger.info('Room service request updated', {
      requestId: id,
      status,
      hotelId
    });

    // Get hotel and guest info for notification
    if (status && status !== request.status && request.guestUserId) {
      const hotel = await prisma.hotel.findUnique({
        where: { id: hotelId },
        select: { name: true }
      });

      PushNotificationService.notifyRoomServiceStatusUpdated({
        guestUserId: request.guestUserId,
        requestId: id,
        serviceType: request.serviceType,
        status,
        hotelName: hotel?.name ?? 'the hotel',
        roomNumber: request.roomNumber,
      }).catch(() => {});
    }

    res.json({
      success: true,
      data: updated
    });
  } catch (error: any) {
    logger.error('Failed to update room service request', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to update service request'
    });
  }
});

/**
 * Get guest's service requests
 * GET /api/room-service/guest/my-requests
 */
router.get('/guest/my-requests', authenticateUser, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { status, page = '1', limit = '20' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 50);
    const skip = (pageNum - 1) * limitNum;

    // Find user's active bookings
    const bookings = await prisma.booking.findMany({
      where: {
        userId,
        status: { in: ['confirmed', 'checked_in'] }
      },
      select: { id: true }
    });

    const bookingIds = bookings.map(b => b.id);

    const where: any = {
      guestUserId: userId,
      bookingId: { in: bookingIds }
    };
    if (status) where.status = status;

    const [requests, total] = await Promise.all([
      prisma.roomServiceRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum
      }),
      prisma.roomServiceRequest.count({ where })
    ]);

    const parsedRequests = requests.map(req => ({
      ...req,
      items: req.items ? JSON.parse(req.items as string) : []
    }));

    res.json({
      success: true,
      data: {
        requests: parsedRequests,
        page: pageNum,
        limit: limitNum,
        totalCount: total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error: any) {
    logger.error('Failed to fetch guest service requests', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch service requests'
    });
  }
});

/**
 * Room service room menu
 * GET /api/room-service/menu/:hotelId
 */
router.get('/menu/:hotelId', async (req: Request, res: Response) => {
  try {
    const { hotelId } = req.params;

    // Return default room service menu
    // In production, this would come from hotel settings
    const menu = {
      beverages: [
        { id: 'tea', name: 'Masala Tea', pricePaise: 5000, category: 'beverages' },
        { id: 'coffee', name: 'Coffee', pricePaise: 7500, category: 'beverages' },
        { id: 'espresso', name: 'Espresso', pricePaise: 12000, category: 'beverages' },
        { id: 'juice', name: 'Fresh Juice', pricePaise: 10000, category: 'beverages' },
      ],
      snacks: [
        { id: 'samosa', name: 'Samosa (2pc)', pricePaise: 8000, category: 'snacks' },
        { id: 'pakoda', name: 'Onion Pakoda', pricePaise: 7000, category: 'snacks' },
        { id: 'sandwich', name: 'Sandwich', pricePaise: 12000, category: 'snacks' },
        { id: 'biscuits', name: 'Biscuits Plate', pricePaise: 10000, category: 'snacks' },
      ],
      meals: [
        { id: 'breakfast', name: 'Continental Breakfast', pricePaise: 35000, category: 'meals' },
        { id: 'lunch', name: 'Lunch Buffet', pricePaise: 55000, category: 'meals' },
        { id: 'dinner', name: 'Dinner Buffet', pricePaise: 65000, category: 'meals' },
      ],
      housekeeping: [
        { id: 'room_cleaning', name: 'Room Cleaning', pricePaise: 0, category: 'housekeeping' },
        { id: 'extra_towels', name: 'Extra Towels', pricePaise: 0, category: 'housekeeping' },
        { id: 'toiletries', name: 'Extra Toiletries', pricePaise: 0, category: 'housekeeping' },
        { id: 'bedding', name: 'Bedding Change', pricePaise: 0, category: 'housekeeping' },
      ],
      laundry: [
        { id: 'wash_fold', name: 'Wash & Fold (per kg)', pricePaise: 15000, category: 'laundry' },
        { id: 'ironing', name: 'Ironing (per piece)', pricePaise: 2000, category: 'laundry' },
        { id: 'dry_clean', name: 'Dry Clean (per piece)', pricePaise: 10000, category: 'laundry' },
      ]
    };

    res.json({
      success: true,
      data: menu
    });
  } catch (error: any) {
    logger.error('Failed to fetch room service menu', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to fetch menu'
    });
  }
});

// ─── Types ─────────────────────────────────────────────────────────────────────

export type RoomServiceCategory =
  | 'housekeeping'
  | 'room_service'
  | 'laundry'
  | 'maintenance'
  | 'spa'
  | 'transport'
  | 'concierge';

export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface RoomServiceRequestInput {
  hotelId: string;
  roomId: string;
  guestId: string;
  category: RoomServiceCategory;
  itemId?: string;
  priority: Priority;
  scheduledFor?: string;
  notes?: string;
  quantity?: number;
}

export interface MinibarItem {
  id: string;
  name: string;
  pricePaise: number;
  category: string;
  image?: string;
  isVeg?: boolean;
  isAvailable?: boolean;
}

export interface MinibarBill {
  items: Array<{
    id: string;
    name: string;
    pricePaise: number;
    quantity: number;
    consumedAt: string;
  }>;
  subtotalPaise: number;
  taxPaise: number;
  totalPaise: number;
}

export interface GuestFeedback {
  bookingId: string;
  roomId: string;
  overallRating: number;
  categories: {
    cleanliness: number;
    service: number;
    amenities: number;
    comfort: number;
  };
  comment?: string;
  issues?: string[];
  wouldRecommend: boolean;
}

export interface RoomPreferences {
  temperature: number;
  lighting: 'bright' | 'dim' | 'dark';
  pillowType: 'soft' | 'firm' | 'extra_pillows';
  dietaryRestrictions: string[];
  allergies: string[];
  language: 'en' | 'hi';
}

export interface ChargeItem {
  id: string;
  description: string;
  quantity: number;
  unitPricePaise: number;
  totalPaise: number;
  date: string;
  category: string;
}

export interface FolioBill {
  bookingId: string;
  guestName: string;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  roomCharges: ChargeItem[];
  minibar: ChargeItem[];
  laundry: ChargeItem[];
  restaurant: ChargeItem[];
  spa: ChargeItem[];
  transport: ChargeItem[];
  other: ChargeItem[];
  subtotalPaise: number;
  taxesPaise: number;
  totalPaise: number;
}

// ─── Minibar Endpoints ─────────────────────────────────────────────────────────

/**
 * Get minibar menu for a hotel
 * GET /v1/room-service/minibar/:hotelId/menu
 */
router.get('/minibar/:hotelId/menu', async (req: Request, res: Response) => {
  try {
    const { hotelId } = req.params;

    // Default minibar menu - in production would come from hotel settings
    const menu: Record<string, MinibarItem[]> = {
      beverages: [
        { id: 'water_small', name: 'Mineral Water (500ml)', pricePaise: 2000, category: 'beverages', isAvailable: true },
        { id: 'water_large', name: 'Mineral Water (1L)', pricePaise: 3500, category: 'beverages', isAvailable: true },
        { id: 'cola', name: 'Soft Drink (330ml)', pricePaise: 4000, category: 'beverages', isAvailable: true },
        { id: 'juice_box', name: 'Juice Box', pricePaise: 5000, category: 'beverages', isAvailable: true },
        { id: 'beer', name: 'Beer (330ml)', pricePaise: 12000, category: 'beverages', isAvailable: true },
        { id: 'wine_small', name: 'Wine (187ml)', pricePaise: 25000, category: 'beverages', isAvailable: true },
      ],
      snacks: [
        { id: 'chips', name: 'Chips Pack', pricePaise: 5000, category: 'snacks', isAvailable: true },
        { id: 'biscuits', name: 'Biscuits Pack', pricePaise: 4000, category: 'snacks', isAvailable: true },
        { id: 'chocolate', name: 'Chocolate Bar', pricePaise: 6000, category: 'snacks', isAvailable: true },
        { id: 'nuts', name: 'Mixed Nuts', pricePaise: 8000, category: 'snacks', isAvailable: true },
      ],
      instant: [
        { id: 'noodles', name: 'Instant Noodles', pricePaise: 5000, category: 'instant', isAvailable: true },
        { id: 'coffee_pack', name: 'Coffee Packet', pricePaise: 3000, category: 'instant', isAvailable: true },
        { id: 'tea_bag', name: 'Tea Bags (5pc)', pricePaise: 2000, category: 'instant', isAvailable: true },
      ],
    };

    logger.info('Minibar menu fetched', { hotelId });
    res.json({ success: true, data: menu });
  } catch (error: any) {
    logger.error('Failed to fetch minibar menu', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to fetch minibar menu' });
  }
});

/**
 * Get minibar bill for a room
 * GET /v1/room-service/minibar/:roomId/bill
 */
router.get('/minibar/:roomId/bill', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const userId = req.user?.id;

    // Verify user has active booking for this room
    const booking = await prisma.booking.findFirst({
      where: {
        userId,
        id: roomId || undefined,
        status: { in: ['confirmed', 'checked_in'] }
      },
      select: { id: true }
    });

    if (!booking) {
      return res.status(403).json({
        success: false,
        message: 'No active booking for this room'
      });
    }

    // Get minibar consumption records
    const consumptions = await prisma.minibarConsumption.findMany({
      where: {
        roomId,
        bookingId: booking.id,
        isCharged: false
      },
      orderBy: { consumedAt: 'desc' }
    });

    // Get item details
    const itemMap: Record<string, { name: string; pricePaise: number }> = {
      water_small: { name: 'Mineral Water (500ml)', pricePaise: 2000 },
      water_large: { name: 'Mineral Water (1L)', pricePaise: 3500 },
      cola: { name: 'Soft Drink (330ml)', pricePaise: 4000 },
      juice_box: { name: 'Juice Box', pricePaise: 5000 },
      beer: { name: 'Beer (330ml)', pricePaise: 12000 },
      wine_small: { name: 'Wine (187ml)', pricePaise: 25000 },
      chips: { name: 'Chips Pack', pricePaise: 5000 },
      biscuits: { name: 'Biscuits Pack', pricePaise: 4000 },
      chocolate: { name: 'Chocolate Bar', pricePaise: 6000 },
      nuts: { name: 'Mixed Nuts', pricePaise: 8000 },
      noodles: { name: 'Instant Noodles', pricePaise: 5000 },
      coffee_pack: { name: 'Coffee Packet', pricePaise: 3000 },
      tea_bag: { name: 'Tea Bags (5pc)', pricePaise: 2000 },
    };

    const items = consumptions.map(c => ({
      id: c.itemId,
      name: itemMap[c.itemId]?.name ?? c.itemId,
      pricePaise: itemMap[c.itemId]?.pricePaise ?? c.pricePaise,
      quantity: c.quantity,
      consumedAt: c.consumedAt.toISOString()
    }));

    const subtotalPaise = items.reduce((sum, item) => sum + (item.pricePaise * item.quantity), 0);
    const taxPaise = Math.round(subtotalPaise * 0.18); // 18% GST
    const totalPaise = subtotalPaise + taxPaise;

    res.json({
      success: true,
      data: {
        roomId,
        bookingId: booking.id,
        items,
        subtotalPaise,
        taxPaise,
        totalPaise
      }
    });
  } catch (error: any) {
    logger.error('Failed to fetch minibar bill', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to fetch minibar bill' });
  }
});

/**
 * Record minibar consumption
 * POST /v1/room-service/minibar/:roomId/consume
 */
router.post('/minibar/:roomId/consume', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;
    const { itemId, quantity = 1 } = req.body;
    const userId = req.user?.id;

    if (!itemId) {
      return res.status(400).json({
        success: false,
        message: 'itemId is required'
      });
    }

    // Verify user has active booking for this room
    const booking = await prisma.booking.findFirst({
      where: {
        userId,
        id: roomId || undefined,
        status: { in: ['confirmed', 'checked_in'] }
      },
      select: { id: true, hotelId: true }
    });

    if (!booking) {
      return res.status(403).json({
        success: false,
        message: 'No active booking for this room'
      });
    }

    // Price lookup
    const priceMap: Record<string, number> = {
      water_small: 2000, water_large: 3500, cola: 4000, juice_box: 5000,
      beer: 12000, wine_small: 25000, chips: 5000, biscuits: 4000,
      chocolate: 6000, nuts: 8000, noodles: 5000, coffee_pack: 3000, tea_bag: 2000
    };

    const pricePaise = priceMap[itemId] ?? 0;

    // Create consumption record
    const consumption = await prisma.minibarConsumption.create({
      data: {
        roomId,
        bookingId: booking.id,
        hotelId: booking.hotelId,
        itemId,
        quantity,
        pricePaise,
        items: { itemId, quantity, pricePaise },
        totalPaise: pricePaise * quantity,
        consumedAt: new Date(),
        isCharged: false
      }
    });

    logger.info('Minibar consumption recorded', {
      consumptionId: consumption.id,
      roomId,
      itemId,
      quantity
    });

    // Track engagement
    trackRoomEngagement({
      otaUserId: userId ?? '',
      bookingId: booking.id,
      hotelId: roomId, // Would need proper lookup
      roomId,
      roomNumber: 'N/A',
      eventType: 'order',
      metadata: { serviceType: 'minibar', itemId, quantity }
    }).catch(() => {});

    res.status(201).json({
      success: true,
      data: {
        id: consumption.id,
        itemId,
        quantity,
        pricePaise,
        consumedAt: consumption.consumedAt
      }
    });
  } catch (error: any) {
    logger.error('Failed to record minibar consumption', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to record consumption' });
  }
});

// ─── Feedback Endpoint ────────────────────────────────────────────────────────

/**
 * Submit guest feedback
 * POST /v1/room-service/feedback
 */
router.post('/feedback', authenticateUser, async (req: Request, res: Response) => {
  try {
    const {
      bookingId,
      roomId,
      overallRating,
      categories,
      comment,
      issues,
      wouldRecommend
    } = req.body;
    const userId = req.user?.id;

    if (!bookingId || !roomId || !overallRating || !categories) {
      return res.status(400).json({
        success: false,
        message: 'bookingId, roomId, overallRating, and categories are required'
      });
    }

    // Validate ratings (1-5)
    if (overallRating < 1 || overallRating > 5) {
      return res.status(400).json({
        success: false,
        message: 'overallRating must be between 1 and 5'
      });
    }

    for (const [key, value] of Object.entries(categories)) {
      if (typeof value === 'number' && (value < 1 || value > 5)) {
        return res.status(400).json({
          success: false,
          message: `Category ${key} rating must be between 1 and 5`
        });
      }
    }

    // Verify booking exists and belongs to user
    const booking = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        userId,
        status: { in: ['confirmed', 'checked_in', 'completed'] }
      },
      include: {
        hotel: { select: { id: true, name: true } }
      }
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check for existing feedback
    const existingFeedback = await prisma.guestFeedback.findFirst({
      where: { bookingId }
    });

    if (existingFeedback) {
      return res.status(409).json({
        success: false,
        message: 'Feedback already submitted for this booking'
      });
    }

    // Create feedback record
    const feedback = await prisma.guestFeedback.create({
      data: {
        bookingId,
        roomId,
        guestUserId: userId ?? '',
        hotelId: booking.hotelId,
        serviceType: 'general',
        rating: overallRating,
        overallRating,
        cleanlinessRating: categories.cleanliness,
        serviceRating: categories.service,
        amenitiesRating: categories.amenities,
        comfortRating: categories.comfort,
        comment,
        issues: issues ? JSON.stringify(issues) : null,
        wouldRecommend
      }
    });

    logger.info('Guest feedback submitted', {
      feedbackId: feedback.id,
      bookingId,
      overallRating
    });

    res.status(201).json({
      success: true,
      data: {
        id: feedback.id,
        bookingId: feedback.bookingId,
        overallRating: feedback.overallRating,
        wouldRecommend: feedback.wouldRecommend,
        submittedAt: feedback.createdAt
      }
    });
  } catch (error: any) {
    logger.error('Failed to submit feedback', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to submit feedback' });
  }
});

/**
 * Get feedback for a booking
 * GET /v1/room-service/feedback/:bookingId
 */
router.get('/feedback/:bookingId', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user?.id;

    const feedback = await prisma.guestFeedback.findFirst({
      where: {
        bookingId,
        guestUserId: userId
      }
    });

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: feedback.id,
        bookingId: feedback.bookingId,
        roomId: feedback.roomId,
        overallRating: feedback.overallRating,
        categories: {
          cleanliness: feedback.cleanlinessRating,
          service: feedback.serviceRating,
          amenities: feedback.amenitiesRating,
          comfort: feedback.comfortRating
        },
        comment: feedback.comment,
        issues: feedback.issues ? JSON.parse(feedback.issues as string) : [],
        wouldRecommend: feedback.wouldRecommend,
        submittedAt: feedback.createdAt
      }
    });
  } catch (error: any) {
    logger.error('Failed to fetch feedback', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to fetch feedback' });
  }
});

// ─── Preferences Endpoints ────────────────────────────────────────────────────

/**
 * Get room preferences for a guest
 * GET /v1/room-service/preferences/:guestId/:roomId
 */
router.get('/preferences/:guestId/:roomId', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { guestId, roomId } = req.params;
    const userId = req.user?.id;

    // Users can only access their own preferences
    if (userId !== guestId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const preferences = await prisma.roomPreferences.findFirst({
      where: {
        guestUserId: guestId,
        roomId
      }
    });

    if (!preferences) {
      // Return default preferences
      return res.json({
        success: true,
        data: {
          temperature: 22,
          lighting: 'dim',
          pillowType: 'soft',
          dietaryRestrictions: [],
          allergies: [],
          language: 'en',
          isDefault: true
        }
      });
    }

    res.json({
      success: true,
      data: {
        temperature: preferences.temperature,
        lighting: preferences.lighting as RoomPreferences['lighting'],
        pillowType: preferences.pillowType as RoomPreferences['pillowType'],
        dietaryRestrictions: preferences.dietaryRestrictions
          ? JSON.parse(preferences.dietaryRestrictions as string)
          : [],
        allergies: preferences.allergies ? JSON.parse(preferences.allergies as string) : [],
        language: preferences.language as RoomPreferences['language'],
        isDefault: false,
        updatedAt: preferences.updatedAt
      }
    });
  } catch (error: any) {
    logger.error('Failed to fetch preferences', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to fetch preferences' });
  }
});

/**
 * Update room preferences for a guest
 * PUT /v1/room-service/preferences/:guestId/:roomId
 */
router.put('/preferences/:guestId/:roomId', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { guestId, roomId } = req.params;
    const userId = req.user?.id;
    const {
      temperature,
      lighting,
      pillowType,
      dietaryRestrictions,
      allergies,
      language
    } = req.body;

    // Users can only update their own preferences
    if (userId !== guestId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Validate inputs
    if (temperature !== undefined && (temperature < 16 || temperature > 30)) {
      return res.status(400).json({
        success: false,
        message: 'Temperature must be between 16 and 30'
      });
    }

    const validLighting = ['bright', 'dim', 'dark'];
    if (lighting && !validLighting.includes(lighting)) {
      return res.status(400).json({
        success: false,
        message: 'Lighting must be bright, dim, or dark'
      });
    }

    const validPillows = ['soft', 'firm', 'extra_pillows'];
    if (pillowType && !validPillows.includes(pillowType)) {
      return res.status(400).json({
        success: false,
        message: 'PillowType must be soft, firm, or extra_pillows'
      });
    }

    const validLanguages = ['en', 'hi'];
    if (language && !validLanguages.includes(language)) {
      return res.status(400).json({
        success: false,
        message: 'Language must be en or hi'
      });
    }

    // Check for existing preferences
    const existing = await prisma.roomPreferences.findFirst({
      where: {
        guestUserId: guestId,
        roomId
      }
    });

    const updateData: any = {
      temperature: temperature ?? 22,
      lighting: lighting ?? 'dim',
      pillowType: pillowType ?? 'soft',
      dietaryRestrictions: dietaryRestrictions ? JSON.stringify(dietaryRestrictions) : '[]',
      allergies: allergies ? JSON.stringify(allergies) : '[]',
      language: language ?? 'en',
      updatedAt: new Date()
    };

    let preferences;
    if (existing) {
      preferences = await prisma.roomPreferences.update({
        where: { id: existing.id },
        data: updateData
      });
    } else {
      preferences = await prisma.roomPreferences.create({
        data: {
          guestUserId: guestId,
          roomId,
          ...updateData
        }
      });
    }

    logger.info('Room preferences updated', {
      preferencesId: preferences.id,
      guestId,
      roomId
    });

    res.json({
      success: true,
      data: {
        temperature: preferences.temperature,
        lighting: preferences.lighting,
        pillowType: preferences.pillowType,
        dietaryRestrictions: JSON.parse(preferences.dietaryRestrictions as string),
        allergies: JSON.parse(preferences.allergies as string),
        language: preferences.language,
        updatedAt: preferences.updatedAt
      }
    });
  } catch (error: any) {
    logger.error('Failed to update preferences', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to update preferences' });
  }
});

// ─── Checkout Bill Endpoint ───────────────────────────────────────────────────

/**
 * Get checkout bill (folio) for a booking
 * GET /v1/room-service/checkout/:bookingId/bill
 */
router.get('/checkout/:bookingId/bill', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user?.id;

    // Verify booking exists and belongs to user
    const booking = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        userId
      },
      include: {
        hotel: { select: { id: true, name: true } }
      }
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const roomCharges: ChargeItem[] = [];
    const minibar: ChargeItem[] = [];
    const laundry: ChargeItem[] = [];
    const restaurant: ChargeItem[] = [];
    const spa: ChargeItem[] = [];
    const transport: ChargeItem[] = [];
    const other: ChargeItem[] = [];

    // Room charges (nights * rate)
    if (booking.checkIn && booking.checkOut) {
      const checkIn = new Date(booking.checkIn);
      const checkOut = new Date(booking.checkOut);
      const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
      const nightlyRate = booking.roomRatePaise;

      roomCharges.push({
        id: 'room_charge',
        description: `Room Charges (${nights} night${nights > 1 ? 's' : ''})`,
        quantity: nights,
        unitPricePaise: nightlyRate,
        totalPaise: nightlyRate * nights,
        date: booking.checkIn.toISOString(),
        category: 'room'
      });
    }

    // Minibar charges
    const minibarConsumptions = await prisma.minibarConsumption.findMany({
      where: {
        bookingId,
        isCharged: true
      }
    });

    const minibarPriceMap: Record<string, number> = {
      water_small: 2000, water_large: 3500, cola: 4000, juice_box: 5000,
      beer: 12000, wine_small: 25000, chips: 5000, biscuits: 4000,
      chocolate: 6000, nuts: 8000, noodles: 5000, coffee_pack: 3000, tea_bag: 2000
    };

    for (const item of minibarConsumptions) {
      minibar.push({
        id: item.id,
        description: minibarPriceMap[item.itemId] ? `${item.itemId} (charged)` : item.itemId,
        quantity: item.quantity,
        unitPricePaise: item.pricePaise,
        totalPaise: item.pricePaise * item.quantity,
        date: item.consumedAt.toISOString(),
        category: 'minibar'
      });
    }

    // Room service charges
    const roomServices = await prisma.roomServiceRequest.findMany({
      where: {
        bookingId,
        status: 'completed'
      }
    });

    for (const service of roomServices) {
      other.push({
        id: service.id,
        description: `${service.serviceType.replace('_', ' ')}${service.description ? ': ' + service.description : ''}`,
        quantity: 1,
        unitPricePaise: service.totalAmountPaise,
        totalPaise: service.totalAmountPaise,
        date: service.completedAt?.toISOString() ?? service.createdAt.toISOString(),
        category: service.serviceType
      });
    }

    // Calculate totals
    const calculateSubtotal = (items: ChargeItem[]) =>
      items.reduce((sum, item) => sum + item.totalPaise, 0);

    const roomSubtotal = calculateSubtotal(roomCharges);
    const minibarSubtotal = calculateSubtotal(minibar);
    const otherSubtotal = calculateSubtotal(other);
    const subtotalPaise = roomSubtotal + minibarSubtotal + otherSubtotal;
    const taxesPaise = Math.round(subtotalPaise * 0.18); // 18% GST
    const totalPaise = subtotalPaise + taxesPaise;

    const folioBill: FolioBill = {
      bookingId,
      guestName: booking.guestName || 'Guest',
      roomNumber: 'N/A', // Would need room lookup
      checkIn: booking.checkIn?.toString() ?? '',
      checkOut: booking.checkOut?.toString() ?? '',
      roomCharges,
      minibar,
      laundry,
      restaurant,
      spa,
      transport,
      other,
      subtotalPaise,
      taxesPaise,
      totalPaise
    };

    logger.info('Checkout bill generated', {
      bookingId,
      totalPaise,
      itemCount: roomCharges.length + minibar.length + other.length
    });

    res.json({
      success: true,
      data: folioBill
    });
  } catch (error: any) {
    logger.error('Failed to generate checkout bill', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to generate checkout bill' });
  }
});

// ─── Enhanced Room Service (Priority/Scheduling) ───────────────────────────────

/**
 * Create an enhanced room service request with priority and scheduling
 * POST /v1/room-service/enhanced
 */
router.post('/enhanced', authenticateUser, async (req: Request, res: Response) => {
  try {
    const {
      hotelId,
      roomId,
      guestId,
      category,
      itemId,
      priority = 'medium',
      scheduledFor,
      notes,
      quantity = 1
    } = req.body;
    const userId = req.user?.id;

    if (!hotelId || !roomId || !guestId || !category) {
      return res.status(400).json({
        success: false,
        message: 'hotelId, roomId, guestId, and category are required'
      });
    }

    // Validate category
    const validCategories: RoomServiceCategory[] = [
      'housekeeping', 'room_service', 'laundry', 'maintenance',
      'spa', 'transport', 'concierge'
    ];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: `category must be one of: ${validCategories.join(', ')}`
      });
    }

    // Validate priority
    const validPriorities: Priority[] = ['low', 'medium', 'high', 'urgent'];
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({
        success: false,
        message: `priority must be one of: ${validPriorities.join(', ')}`
      });
    }

    // Verify booking exists
    const booking = await prisma.booking.findFirst({
      where: {
        id: guestId, // guestId is actually bookingId here
        hotelId,
        status: { in: ['confirmed', 'checked_in'] }
      },
      include: {
        user: { select: { id: true, fullName: true, phone: true } }
      }
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found or not active'
      });
    }

    // Parse scheduled time
    let scheduledAt: Date | undefined;
    if (scheduledFor) {
      scheduledAt = new Date(scheduledFor);
      if (isNaN(scheduledAt.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid scheduledFor date format'
        });
      }
      if (scheduledAt < new Date()) {
        return res.status(400).json({
          success: false,
          message: 'scheduledFor must be in the future'
        });
      }
    }

    // Get item details if itemId provided
    let itemDetails: { name: string; pricePaise: number } | null = null;
    if (itemId) {
      const priceMap: Record<string, { name: string; pricePaise: number }> = {
        // Housekeeping
        room_cleaning: { name: 'Room Cleaning', pricePaise: 0 },
        extra_towels: { name: 'Extra Towels', pricePaise: 0 },
        toiletries: { name: 'Extra Toiletries', pricePaise: 0 },
        bedding: { name: 'Bedding Change', pricePaise: 0 },
        // Laundry
        wash_fold: { name: 'Wash & Fold (per kg)', pricePaise: 15000 },
        ironing: { name: 'Ironing (per piece)', pricePaise: 2000 },
        dry_clean: { name: 'Dry Clean (per piece)', pricePaise: 10000 },
        // Spa
        massage: { name: 'Massage Service', pricePaise: 150000 },
        facial: { name: 'Facial Treatment', pricePaise: 200000 },
        // Transport
        airport_pickup: { name: 'Airport Pickup', pricePaise: 50000 },
        airport_dropoff: { name: 'Airport Drop-off', pricePaise: 50000 },
        city_tour: { name: 'City Tour (4 hours)', pricePaise: 150000 },
      };
      itemDetails = priceMap[itemId] ?? null;
    }

    const totalAmountPaise = itemDetails ? itemDetails.pricePaise * quantity : 0;

    // Create service request
    const serviceRequest = await prisma.roomServiceRequest.create({
      data: {
        bookingId: booking.id,
        hotelId,
        roomId,
        roomNumber: 'N/A',
        guestName: booking.user?.fullName || booking.guestName || 'Guest',
        serviceType: category,
        description: notes || itemDetails?.name,
        items: itemId ? JSON.stringify([{
          id: itemId,
          name: itemDetails?.name ?? itemId,
          pricePaise: itemDetails?.pricePaise ?? 0,
          quantity
        }]) : undefined,
        totalAmountPaise,
        status: 'pending',
        priority,
        requestedBy: userId,
        guestUserId: booking.userId,
        completedAt: scheduledAt ?? undefined
      }
    });

    logger.info('Enhanced room service request created', {
      requestId: serviceRequest.id,
      bookingId: booking.id,
      category,
      priority,
      scheduledFor
    });

    // Send notifications
    PushNotificationService.notifyHotelStaffNewRequest({
      hotelId,
      requestId: serviceRequest.id,
      serviceType: category,
      roomNumber: serviceRequest.roomNumber,
      priority,
      description: notes,
    }).catch(() => {});

    PushNotificationService.sendToUser(
      booking.userId,
      `${category.replace('_', ' ')} request submitted`,
      `Your ${category.replace('_', ' ')} request${scheduledAt ? ' scheduled for ' + scheduledAt.toLocaleString() : ''} has been received.`,
      { type: 'room_service', request_id: serviceRequest.id, status: 'pending', priority }
    ).catch(() => {});

    res.status(201).json({
      success: true,
      data: {
        id: serviceRequest.id,
        bookingId: serviceRequest.bookingId,
        category: serviceRequest.serviceType,
        priority: serviceRequest.priority,
        scheduledFor: scheduledAt?.toISOString(),
        notes,
        totalAmountPaise: serviceRequest.totalAmountPaise,
        status: serviceRequest.status,
        createdAt: serviceRequest.createdAt
      }
    });
  } catch (error: any) {
    logger.error('Failed to create enhanced room service request', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to create service request'
    });
  }
});

export default router;

// ── Engagement Tracking (REZ Coin Rewards) ─────────────────────────────────────

async function trackRoomEngagement(params: {
  otaUserId: string;
  bookingId: string;
  hotelId: string;
  roomId: string;
  roomNumber: string;
  eventType: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    // Record in Hotel OTA database
    await prisma.roomEngagement.create({
      data: {
        rezUserId: '', // Set by REZ Now via SSO
        otaUserId: params.otaUserId,
        bookingId: params.bookingId,
        hotelId: params.hotelId,
        roomId: params.roomId,
        roomNumber: params.roomNumber,
        engagementType: params.eventType,
        metadata: params.metadata as any,
      },
    });

    // Sync to REZ backend for coin rewards
    await axios.post(
      `${env.REZ_API_BASE_URL ?? 'http://localhost:4000'}/api/travel-webhooks/room-engagement`,
      {
        event: `room_${params.eventType}`,
        otaUserId: params.otaUserId,
        bookingId: params.bookingId,
        hotelId: params.hotelId,
        roomId: params.roomId,
        roomNumber: params.roomNumber,
        metadata: params.metadata,
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-internal-token': env.INTERNAL_SERVICE_TOKEN ?? 'dev-token',
        },
        timeout: 5000,
      }
    );
  } catch (error: any) {
    // Non-critical — don't fail the request if engagement tracking fails
    logger.warn('[RoomService] Engagement tracking failed', { error: error.message });
  }
}

